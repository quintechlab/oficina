//! Lectura del estado local que publica cada sesión de Claude Code.
//!
//! Cada sesión abierta escribe `<id de sesión>.json` con su `Presencia` más `cerrada`.
//! Al cerrarse deja `{ sesion, cerrada: true, actualizado }`.

use std::path::{Path, PathBuf};

use chrono::{DateTime, Duration, Utc};
use serde_json::Value;

/// Una sesión que no publica hace este tiempo se descarta (máquina apagada, proceso cortado sin
/// `session.end`). Desde la v0.5.2 el mod renueva la hora de su archivo cada 30 s aunque la sesión
/// esté quieta, así que 2 min son cuatro latidos perdidos.
pub const MINUTOS_VIGENCIA: i64 = 2;

/// `%USERPROFILE%/.claude/oficina/sesiones`, o `None` si no se conoce la carpeta del usuario.
pub fn carpeta_sesiones() -> Option<PathBuf> {
    let base = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(base).join(".claude").join("oficina").join("sesiones"))
}

/// Las sesiones vivas de la carpeta: descarta las cerradas, las viejas y los archivos ilegibles.
pub fn leer_sesiones_de(carpeta: &Path, ahora: DateTime<Utc>) -> Vec<Value> {
    let Ok(entradas) = std::fs::read_dir(carpeta) else {
        return Vec::new();
    };
    let limite = ahora - Duration::minutes(MINUTOS_VIGENCIA);
    entradas
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|ruta| ruta.is_file() && ruta.extension().is_some_and(|x| x == "json"))
        .filter_map(|ruta| std::fs::read_to_string(ruta).ok())
        .filter_map(|texto| serde_json::from_str::<Value>(&texto).ok())
        .filter(|sesion| sesion_viva(sesion, limite))
        .collect()
}

/// Un objeto no cerrado cuya última publicación es posterior al límite.
pub(crate) fn sesion_viva(sesion: &Value, limite: DateTime<Utc>) -> bool {
    if !sesion.is_object() || sesion["cerrada"].as_bool() == Some(true) {
        return false;
    }
    sesion["actualizado"]
        .as_str()
        .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
        .is_some_and(|t| t.with_timezone(&Utc) >= limite)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Carpeta temporal única para cada test, fuera del repositorio y de la carpeta real.
    fn carpeta_temporal(nombre: &str) -> PathBuf {
        let unica = format!(
            "oficina-widget-test-{}-{}-{}",
            nombre,
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let ruta = std::env::temp_dir().join(unica);
        fs::create_dir_all(&ruta).unwrap();
        ruta
    }

    fn ahora() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-19T23:50:00Z").unwrap().with_timezone(&Utc)
    }

    fn escribir(carpeta: &Path, archivo: &str, contenido: &str) {
        fs::write(carpeta.join(archivo), contenido).unwrap();
    }

    fn ids(sesiones: &[Value]) -> Vec<String> {
        let mut v: Vec<String> = sesiones
            .iter()
            .map(|s| s["sesion"].as_str().unwrap_or_default().to_string())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn devuelve_las_sesiones_abiertas_con_todos_sus_campos() {
        let c = carpeta_temporal("abiertas");
        escribir(&c, "a.json", r#"{"sesion":"a","repo":"quintechlab/oficina","actividad":"pensando","agentes":[],"preguntas":[],"actualizado":"2026-11-19T23:49:00Z","cerrada":false}"#);
        escribir(&c, "b.json", r#"{"sesion":"b","repo":null,"actualizado":"2026-11-19T23:48:30Z"}"#);
        let r = leer_sesiones_de(&c, ahora());
        assert_eq!(ids(&r), vec!["a", "b"]);
        let a = r.iter().find(|s| s["sesion"] == "a").unwrap();
        assert_eq!(a["repo"], "quintechlab/oficina");
        assert_eq!(a["actividad"], "pensando");
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn la_carpeta_de_la_sesion_llega_a_la_ventana_y_sin_ella_se_lee_igual() {
        // Desde la v0.11 el mod deja `cwd` en el archivo local (chat-avis-ux.md, entrega 7); el del
        // mod anterior no lo trae y se sigue leyendo como siempre.
        let c = carpeta_temporal("cwd");
        escribir(&c, "nueva.json", r#"{"sesion":"nueva","repo":"quintechlab/catalogo","cwd":"C:\\Users\\x\\Desktop\\catalogo","actualizado":"2026-11-19T23:49:00Z","cerrada":false}"#);
        escribir(&c, "vieja.json", r#"{"sesion":"vieja","repo":"quintechlab/oficina","actualizado":"2026-11-19T23:49:00Z","cerrada":false}"#);
        let r = leer_sesiones_de(&c, ahora());
        assert_eq!(ids(&r), vec!["nueva", "vieja"]);
        let nueva = r.iter().find(|s| s["sesion"] == "nueva").unwrap();
        assert_eq!(nueva["cwd"], "C:\\Users\\x\\Desktop\\catalogo");
        let vieja = r.iter().find(|s| s["sesion"] == "vieja").unwrap();
        assert!(vieja.get("cwd").is_none());
        assert_eq!(vieja["repo"], "quintechlab/oficina");
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn descarta_las_sesiones_cerradas() {
        let c = carpeta_temporal("cerradas");
        escribir(&c, "a.json", r#"{"sesion":"a","actualizado":"2026-11-19T23:49:00Z","cerrada":false}"#);
        escribir(&c, "b.json", r#"{"sesion":"b","cerrada":true,"actualizado":"2026-11-19T23:49:30Z"}"#);
        assert_eq!(ids(&leer_sesiones_de(&c, ahora())), vec!["a"]);
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn descarta_las_que_no_publican_hace_mas_de_2_minutos() {
        // El mod late cada 30 s: una sesión que se perdió cuatro latidos murió sin avisar
        // (proceso cortado, ventana de VS Code recargada) y no tiene que seguir en la oficina.
        let c = carpeta_temporal("viejas");
        escribir(&c, "nueva.json", r#"{"sesion":"nueva","actualizado":"2026-11-19T23:48:00Z"}"#);
        escribir(&c, "vieja.json", r#"{"sesion":"vieja","actualizado":"2026-11-19T23:47:59Z"}"#);
        escribir(&c, "sin-fecha.json", r#"{"sesion":"sin-fecha"}"#);
        escribir(&c, "fecha-rota.json", r#"{"sesion":"fecha-rota","actualizado":"ayer"}"#);
        assert_eq!(ids(&leer_sesiones_de(&c, ahora())), vec!["nueva"]);
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn ignora_json_roto_y_archivos_que_no_son_json() {
        let c = carpeta_temporal("rotos");
        escribir(&c, "a.json", r#"{"sesion":"a","actualizado":"2026-11-19T23:49:00Z"}"#);
        escribir(&c, "roto.json", r#"{"sesion":"roto","actualiz"#);
        escribir(&c, "lista.json", r#"[1,2,3]"#);
        escribir(&c, "notas.txt", r#"{"sesion":"txt","actualizado":"2026-11-19T23:49:00Z"}"#);
        fs::create_dir_all(c.join("sub.json")).unwrap();
        assert_eq!(ids(&leer_sesiones_de(&c, ahora())), vec!["a"]);
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn carpeta_inexistente_da_lista_vacia() {
        let c = std::env::temp_dir().join("oficina-widget-test-no-existe-7f3a");
        assert!(leer_sesiones_de(&c, ahora()).is_empty());
    }
}
