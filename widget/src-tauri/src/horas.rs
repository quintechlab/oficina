//! Lectura de las horas trabajadas que mide el mod (odd/tasks/horas-trabajo.md, contrato).
//!
//! Cada sesión de Claude Code escribe `%USERPROFILE%/.claude/oficina/horas/<id de sesión>.json`:
//! `{ v: 1, sesion, actualizado, tramos: [{ desde, hasta, repo, rama }] }`. El widget solo lee:
//! nunca escribe, renombra ni borra un archivo de esa carpeta, tampoco uno roto. Un nombre que no
//! es un id de sesión, un archivo de más de `TOPE_BYTES` o uno que no se entiende se saltea.

use std::io::Read;
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

/// Lo más grande que se lee de un archivo de horas. Un tramo ocupa ~150 bytes: 1 MB son miles de tramos.
pub const TOPE_BYTES: u64 = 1024 * 1024;

/// `%USERPROFILE%/.claude/oficina/horas`, o `None` si no se conoce la carpeta del usuario.
pub fn carpeta_horas() -> Option<PathBuf> {
    let base = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(base).join(".claude").join("oficina").join("horas"))
}

/// Un id de sesión como los de `sesiones/` y `ordenes/`: `^[A-Za-z0-9_-]{1,128}$`.
fn id_valido(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Un texto o null; cualquier otra cosa no sirve.
fn texto_o_nulo(v: &Value) -> Option<Value> {
    match v {
        Value::Null => Some(Value::Null),
        Value::String(s) => Some(json!(s)),
        _ => None,
    }
}

/// Un tramo que se entiende: `desde` texto, `hasta` texto o null, `repo` y `rama` texto o null (o ausentes).
/// Las fechas las valida la ventana (`horas.js`): acá solo la forma.
fn tramo_valido(t: &Value) -> Option<Value> {
    let desde = t.get("desde")?.as_str()?;
    let hasta = texto_o_nulo(t.get("hasta").unwrap_or(&Value::Null))?;
    let repo = texto_o_nulo(t.get("repo").unwrap_or(&Value::Null))?;
    let rama = texto_o_nulo(t.get("rama").unwrap_or(&Value::Null))?;
    Some(json!({ "desde": desde, "hasta": hasta, "repo": repo, "rama": rama }))
}

/// Lee un archivo con tope: `None` si no se pudo abrir, pasa el tope o no es UTF-8.
fn leer_con_tope(ruta: &Path) -> Option<String> {
    let archivo = std::fs::File::open(ruta).ok()?;
    if archivo.metadata().ok()?.len() > TOPE_BYTES {
        return None;
    }
    let mut texto = String::new();
    // Por si crece entre `metadata` y la lectura: nunca más del tope + 1
    archivo.take(TOPE_BYTES + 1).read_to_string(&mut texto).ok()?;
    if texto.len() as u64 > TOPE_BYTES {
        return None;
    }
    Some(texto)
}

/// Una sesión del archivo `ruta` con id `id`, o `None` si el archivo no se entiende (se saltea entero).
fn sesion_de(ruta: &Path, id: &str) -> Option<Value> {
    let v: Value = serde_json::from_str(&leer_con_tope(ruta)?).ok()?;
    if v.get("v")?.as_u64()? != 1 {
        return None;
    }
    let actualizado = v.get("actualizado")?.as_str()?;
    let tramos: Vec<Value> = v.get("tramos")?.as_array()?.iter().filter_map(tramo_valido).collect();
    Some(json!({ "sesion": id, "actualizado": actualizado, "tramos": tramos }))
}

/// Las sesiones de la carpeta, ordenadas por id: `{ sesion, actualizado, tramos }`. El id sale del
/// nombre del archivo (el mismo que usa el mod). Una carpeta que no existe da una lista vacía.
pub fn leer_horas_de(carpeta: &Path) -> Vec<Value> {
    let Ok(entradas) = std::fs::read_dir(carpeta) else {
        return Vec::new();
    };
    let mut sesiones: Vec<Value> = entradas
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|ruta| ruta.extension().is_some_and(|x| x == "json"))
        .filter_map(|ruta| {
            let id = ruta.file_stem()?.to_str()?.to_string();
            // Un enlace o una carpeta con nombre .json no se leen
            let meta = std::fs::symlink_metadata(&ruta).ok()?;
            if !meta.file_type().is_file() || !id_valido(&id) {
                return None;
            }
            sesion_de(&ruta, &id)
        })
        .collect();
    sesiones.sort_by(|a, b| a["sesion"].as_str().cmp(&b["sesion"].as_str()));
    sesiones
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Carpeta temporal única para cada test, fuera del repositorio y de la carpeta real.
    fn carpeta_temporal(nombre: &str) -> PathBuf {
        let unica = format!(
            "oficina-widget-horas-{}-{}-{}",
            nombre,
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let ruta = std::env::temp_dir().join(unica);
        fs::create_dir_all(&ruta).unwrap();
        ruta
    }

    fn escribir(carpeta: &Path, archivo: &str, contenido: &str) {
        fs::write(carpeta.join(archivo), contenido).unwrap();
    }

    fn ids(sesiones: &[Value]) -> Vec<&str> {
        sesiones.iter().map(|s| s["sesion"].as_str().unwrap_or_default()).collect()
    }

    const BUENO: &str = r#"{"v":1,"sesion":"x","actualizado":"2026-11-27T12:00:30Z","tramos":[
        {"desde":"2026-11-27T10:00:00Z","hasta":"2026-11-27T10:30:00Z","repo":"quintechlab/oficina","rama":"feat/horas"},
        {"desde":"2026-11-27T11:00:00Z","hasta":null,"repo":null,"rama":null}]}"#;

    #[test]
    fn devuelve_cada_sesion_con_sus_tramos_y_su_actualizado() {
        let c = carpeta_temporal("buena");
        escribir(&c, "8c9494fd-dbea-492d-a475-8660c720f9d9.json", BUENO);
        let r = leer_horas_de(&c);
        assert_eq!(ids(&r), vec!["8c9494fd-dbea-492d-a475-8660c720f9d9"]);
        assert_eq!(r[0]["actualizado"], "2026-11-27T12:00:30Z");
        let t = r[0]["tramos"].as_array().unwrap();
        assert_eq!(t.len(), 2);
        assert_eq!(t[0]["repo"], "quintechlab/oficina");
        assert_eq!(t[0]["rama"], "feat/horas");
        assert_eq!(t[0]["hasta"], "2026-11-27T10:30:00Z");
        assert!(t[1]["hasta"].is_null());
        assert!(t[1]["repo"].is_null());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn saltea_los_rotos_y_no_los_toca() {
        let c = carpeta_temporal("rotos");
        escribir(&c, "a.json", BUENO);
        escribir(&c, "roto.json", r#"{"v":1,"actualiz"#);
        escribir(&c, "lista.json", "[1,2]");
        escribir(&c, "otra-version.json", r#"{"v":2,"actualizado":"2026-11-27T12:00:30Z","tramos":[]}"#);
        escribir(&c, "sin-tramos.json", r#"{"v":1,"actualizado":"2026-11-27T12:00:30Z"}"#);
        escribir(&c, "sin-fecha.json", r#"{"v":1,"tramos":[]}"#);
        escribir(&c, "notas.txt", BUENO);
        fs::create_dir_all(c.join("carpeta.json")).unwrap();
        assert_eq!(ids(&leer_horas_de(&c)), vec!["a"]);
        // Nada se borró ni cambió
        assert_eq!(fs::read_to_string(c.join("roto.json")).unwrap(), r#"{"v":1,"actualiz"#);
        assert_eq!(fs::read_dir(&c).unwrap().count(), 8);
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn saltea_los_nombres_que_no_son_un_id_de_sesion() {
        let c = carpeta_temporal("nombres");
        escribir(&c, "bien_1-a.json", BUENO);
        escribir(&c, "con espacio.json", BUENO);
        escribir(&c, "punto.raro.json", BUENO);
        escribir(&c, &format!("{}.json", "a".repeat(129)), BUENO);
        assert_eq!(ids(&leer_horas_de(&c)), vec!["bien_1-a"]);
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn saltea_un_archivo_de_mas_de_1_mb() {
        let c = carpeta_temporal("grande");
        let relleno = " ".repeat(TOPE_BYTES as usize);
        escribir(&c, "grande.json", &format!("{BUENO}{relleno}"));
        escribir(&c, "chico.json", BUENO);
        assert_eq!(ids(&leer_horas_de(&c)), vec!["chico"]);
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn saltea_los_tramos_que_no_se_entienden_y_conserva_los_demas() {
        let c = carpeta_temporal("tramos");
        escribir(&c, "a.json", r#"{"v":1,"actualizado":"2026-11-27T12:00:30Z","tramos":[
            {"desde":"2026-11-27T10:00:00Z","hasta":"2026-11-27T10:30:00Z"},
            {"hasta":"2026-11-27T10:30:00Z"},
            {"desde":5,"hasta":null},
            {"desde":"2026-11-27T11:00:00Z","hasta":null,"repo":3},
            "nada"]}"#);
        let r = leer_horas_de(&c);
        let t = r[0]["tramos"].as_array().unwrap();
        assert_eq!(t.len(), 1);
        assert!(t[0]["repo"].is_null() && t[0]["rama"].is_null());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn carpeta_inexistente_da_lista_vacia() {
        let c = std::env::temp_dir().join("oficina-widget-horas-no-existe-5c1e");
        assert!(leer_horas_de(&c).is_empty());
    }
}
