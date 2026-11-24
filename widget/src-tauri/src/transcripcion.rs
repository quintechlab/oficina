//! Qué estuvo haciendo una sesión (#25): los últimos pedidos del usuario y las respuestas de Claude,
//! leídos en solo lectura de la transcripción que escribe Claude Code en
//! `%USERPROFILE%/.claude/projects/<carpeta del proyecto>/<id de sesión>.jsonl`.
//!
//! Solo se lee la cola del archivo (una transcripción larga pasa de varios MB): primero 256 KB y, si
//! no alcanzan para unos pedidos, el doble, hasta 8 MB. Acá se separan los textos; agruparlos en
//! turnos y recortarlos es de `historial.js`.

use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde_json::{json, Value};

/// La primera lectura de la cola; se duplica mientras falten pedidos.
pub const BYTES_INICIALES: u64 = 256 * 1024;
/// Nunca se lee más que esto del final del archivo.
pub const BYTES_MAXIMOS: u64 = 8 * 1024 * 1024;
/// Con esta cantidad de pedidos del usuario alcanza para los últimos 6 turnos (y uno de más).
pub const PEDIDOS_BUSCADOS: usize = 7;
/// Las últimas entradas que se devuelven a la ventana.
pub const MAX_ENTRADAS: usize = 80;
/// Cada texto se corta acá (en caracteres): la ventana lo recorta mucho más.
pub const MAX_CARACTERES: usize = 2000;
/// Claude Code acorta (y agrega un hash) los nombres de carpeta más largos que esto.
const MAX_CARPETA: usize = 200;

/// `%USERPROFILE%/.claude`.
pub fn carpeta_claude() -> Option<PathBuf> {
    let base = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(base).join(".claude"))
}

/// Un id de sesión (`^[A-Za-z0-9_-]{1,128}$`): así ningún id puede salir de la carpeta.
fn id_valido(sesion: &str) -> bool {
    !sesion.is_empty() && sesion.len() <= 128 && sesion.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// La carpeta de `projects` de un directorio de trabajo, como la arma Claude Code: cada carácter que
/// no es letra o dígito ASCII pasa a `-` (uno por unidad UTF-16, como el reemplazo de JavaScript).
/// `None` si pasa de 200: Claude Code la acorta con un hash, y entonces se busca por el id.
pub fn carpeta_de_proyecto(cwd: &str) -> Option<String> {
    let mut nombre = String::new();
    for c in cwd.chars() {
        if c.is_ascii_alphanumeric() {
            nombre.push(c);
        } else {
            for _ in 0..c.len_utf16() {
                nombre.push('-');
            }
        }
    }
    (nombre.len() <= MAX_CARPETA).then_some(nombre)
}

/// El directorio de trabajo de la sesión según `~/.claude/sessions/<pid>.json` (lo escribe Claude
/// Code mientras el proceso vive), o `None`.
fn cwd_de_sesion(claude: &Path, sesion: &str) -> Option<String> {
    let entradas = std::fs::read_dir(claude.join("sessions")).ok()?;
    entradas
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|ruta| ruta.extension().is_some_and(|x| x == "json"))
        .filter_map(|ruta| std::fs::read_to_string(ruta).ok())
        .filter_map(|texto| serde_json::from_str::<Value>(&texto).ok())
        .find(|v| v["sessionId"].as_str() == Some(sesion))
        .and_then(|v| v["cwd"].as_str().map(String::from))
}

/// Dónde está la transcripción de la sesión: primero en la carpeta de su directorio de trabajo y, si
/// no está (sesión ya cerrada, carpeta acortada), en cualquier carpeta de `projects`.
pub fn ruta_transcripcion(claude: &Path, sesion: &str) -> Option<PathBuf> {
    if !id_valido(sesion) {
        return None;
    }
    let proyectos = claude.join("projects");
    let archivo = format!("{sesion}.jsonl");
    if let Some(carpeta) = cwd_de_sesion(claude, sesion).as_deref().and_then(carpeta_de_proyecto) {
        let ruta = proyectos.join(carpeta).join(&archivo);
        if ruta.is_file() {
            return Some(ruta);
        }
    }
    std::fs::read_dir(&proyectos)
        .ok()?
        .filter_map(Result::ok)
        .map(|e| e.path().join(&archivo))
        .find(|ruta| ruta.is_file())
}

/// Los últimos `bytes` del archivo, sin la primera línea si quedó cortada, y si se leyó entero.
pub fn leer_cola(ruta: &Path, bytes: u64) -> std::io::Result<(String, bool)> {
    let mut f = File::open(ruta)?;
    let largo = f.metadata()?.len();
    let desde = largo.saturating_sub(bytes);
    f.seek(SeekFrom::Start(desde))?;
    let mut crudo = Vec::new();
    f.take(bytes).read_to_end(&mut crudo)?;
    let mut texto = String::from_utf8_lossy(&crudo).into_owned();
    if desde > 0 {
        // La primera línea empezó antes de lo leído: se descarta entera
        texto = texto.split_once('\n').map(|(_, resto)| resto.to_string()).unwrap_or_default();
    }
    Ok((texto, desde == 0))
}

/// Los textos de una línea de la transcripción: del usuario (sin los `isMeta`, que agrega Claude
/// Code) y de Claude, nunca de un subagente (`isSidechain`) ni los resultados de herramientas.
fn textos_de(v: &Value) -> Option<(&'static str, Vec<String>)> {
    if v["isSidechain"].as_bool() == Some(true) {
        return None;
    }
    let rol = match (v["type"].as_str(), v["message"]["role"].as_str()) {
        (Some("user"), Some("user")) if v["isMeta"].as_bool() != Some(true) => "usuario",
        (Some("assistant"), Some("assistant")) => "claude",
        _ => return None,
    };
    let contenido = &v["message"]["content"];
    let textos: Vec<String> = match contenido {
        Value::String(t) => vec![t.clone()],
        Value::Array(bloques) => bloques
            .iter()
            .filter(|b| b["type"].as_str() == Some("text"))
            .filter_map(|b| b["text"].as_str().map(String::from))
            .collect(),
        _ => Vec::new(),
    };
    Some((rol, textos))
}

fn cortar(texto: &str) -> String {
    match texto.char_indices().nth(MAX_CARACTERES) {
        Some((i, _)) => texto[..i].to_string(),
        None => texto.to_string(),
    }
}

/// Las entradas `{ rol: "usuario" | "claude", texto, cuando }` del texto de la transcripción, en
/// orden. Una línea ilegible (a medio escribir) o un texto en blanco se saltean.
pub fn entradas(texto: &str) -> Vec<Value> {
    texto
        .lines()
        .filter_map(|linea| serde_json::from_str::<Value>(linea).ok())
        .filter_map(|v| {
            let (rol, textos) = textos_de(&v)?;
            let cuando = v["timestamp"].clone();
            Some(
                textos
                    .into_iter()
                    .filter(|t| !t.trim().is_empty())
                    .map(|t| json!({ "rol": rol, "texto": cortar(&t), "cuando": cuando }))
                    .collect::<Vec<_>>(),
            )
        })
        .flatten()
        .collect()
}

/// Pedidos escritos por el usuario: sin los avisos del sistema (`<task-notification>`, comandos…).
fn pedidos(entradas: &[Value]) -> usize {
    entradas
        .iter()
        .filter(|e| e["rol"] == "usuario" && !e["texto"].as_str().unwrap_or("").trim_start().starts_with('<'))
        .count()
}

/// Lo último de la conversación de la sesión: `{ entradas }` (las últimas 80), con `entradas` vacío
/// si todavía no hay transcripción. Error solo si el archivo existe y no se puede leer.
pub fn leer_historial_de(claude: &Path, sesion: &str) -> Result<Value, String> {
    if !id_valido(sesion) {
        return Err(String::from("id de sesión inválido"));
    }
    let Some(ruta) = ruta_transcripcion(claude, sesion) else {
        return Ok(json!({ "entradas": [] }));
    };
    let mut bytes = BYTES_INICIALES;
    loop {
        let (texto, entero) = leer_cola(&ruta, bytes).map_err(|e| e.to_string())?;
        let todas = entradas(&texto);
        if entero || bytes >= BYTES_MAXIMOS || pedidos(&todas) >= PEDIDOS_BUSCADOS {
            let desde = todas.len().saturating_sub(MAX_ENTRADAS);
            return Ok(json!({ "entradas": todas[desde..] }));
        }
        bytes = (bytes * 2).min(BYTES_MAXIMOS);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn carpeta_temporal(nombre: &str) -> PathBuf {
        let unica = format!(
            "oficina-transcripcion-test-{}-{}-{}",
            nombre,
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        let c = std::env::temp_dir().join(unica);
        fs::create_dir_all(&c).unwrap();
        c
    }

    fn usuario(texto: &str, cuando: &str) -> String {
        json!({ "type": "user", "message": { "role": "user", "content": texto }, "timestamp": cuando }).to_string()
    }

    fn claude(texto: &str, cuando: &str) -> String {
        json!({ "type": "assistant", "message": { "role": "assistant", "content": [
            { "type": "thinking", "thinking": "no se muestra" },
            { "type": "text", "text": texto },
        ] }, "timestamp": cuando })
        .to_string()
    }

    #[test]
    fn la_carpeta_del_proyecto_como_la_arma_claude_code() {
        // Medido el 23/11 contra las carpetas reales de ~/.claude/projects
        assert_eq!(carpeta_de_proyecto(r"C:\Users\Nico\OneDrive\Desktop\oficina").unwrap(), "C--Users-Nico-OneDrive-Desktop-oficina");
        assert_eq!(
            carpeta_de_proyecto(r"C:\Users\Nico\OneDrive\Desktop\catalogo\.claude\worktrees\shipping-services-argentina-8f8e6b").unwrap(),
            "C--Users-Nico-OneDrive-Desktop-catalogo--claude-worktrees-shipping-services-argentina-8f8e6b"
        );
        // Una ñ es una unidad UTF-16 (un guion); un emoji, dos
        assert_eq!(carpeta_de_proyecto("C:/año/😀").unwrap(), "C--a-o---");
        assert_eq!(carpeta_de_proyecto(&"a".repeat(200)).unwrap().len(), 200);
        assert!(carpeta_de_proyecto(&"a".repeat(201)).is_none());
    }

    #[test]
    fn separa_pedidos_y_respuestas_sin_meta_subagentes_ni_herramientas() {
        let lineas = [
            usuario("arreglá el header", "2026-11-23T10:00:00Z"),
            json!({ "type": "user", "isMeta": true, "message": { "role": "user", "content": "Base directory for this skill" } }).to_string(),
            json!({ "type": "user", "message": { "role": "user", "content": [{ "type": "tool_result", "content": "salida" }] } }).to_string(),
            json!({ "type": "assistant", "isSidechain": true, "message": { "role": "assistant", "content": [{ "type": "text", "text": "de un subagente" }] } }).to_string(),
            json!({ "type": "assistant", "message": { "role": "assistant", "content": [{ "type": "tool_use", "name": "Bash" }] } }).to_string(),
            json!({ "type": "last-prompt", "lastPrompt": "arreglá el header" }).to_string(),
            String::from("{ a medio escribir"),
            claude("Listo, quedó arreglado.", "2026-11-23T10:01:00Z"),
            json!({ "type": "user", "message": { "role": "user", "content": [{ "type": "text", "text": "   " }] } }).to_string(),
        ];
        assert_eq!(
            entradas(&lineas.join("\n")),
            vec![
                json!({ "rol": "usuario", "texto": "arreglá el header", "cuando": "2026-11-23T10:00:00Z" }),
                json!({ "rol": "claude", "texto": "Listo, quedó arreglado.", "cuando": "2026-11-23T10:01:00Z" }),
            ]
        );
    }

    #[test]
    fn un_texto_largo_se_corta_en_2000_caracteres() {
        let e = entradas(&usuario(&"ñ".repeat(2500), "2026-11-23T10:00:00Z"));
        assert_eq!(e[0]["texto"].as_str().unwrap().chars().count(), MAX_CARACTERES);
    }

    #[test]
    fn la_cola_descarta_la_primera_linea_cortada() {
        let c = carpeta_temporal("cola");
        let ruta = c.join("t.jsonl");
        fs::write(&ruta, "primera linea larga\nsegunda\ntercera\n").unwrap();
        assert_eq!(leer_cola(&ruta, 15).unwrap(), (String::from("tercera\n"), false));
        assert_eq!(leer_cola(&ruta, 1000).unwrap(), (String::from("primera linea larga\nsegunda\ntercera\n"), true));
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn encuentra_la_transcripcion_por_el_cwd_de_la_sesion_o_buscando_el_id() {
        let c = carpeta_temporal("ruta");
        let sesion = "2426b96f-1738-432a-bfba-df037d8d476f";
        fs::create_dir_all(c.join("sessions")).unwrap();
        fs::write(c.join("sessions").join("123.json"), json!({ "pid": 123, "sessionId": sesion, "cwd": r"C:\demo\app" }).to_string()).unwrap();
        let propia = c.join("projects").join("C--demo-app");
        fs::create_dir_all(&propia).unwrap();
        fs::write(propia.join(format!("{sesion}.jsonl")), "").unwrap();
        assert_eq!(ruta_transcripcion(&c, sesion).unwrap(), propia.join(format!("{sesion}.jsonl")));
        // Sin el archivo de la sesión (ya cerrada), se busca en todas las carpetas
        let otra = "aaaa-bbbb";
        let lejos = c.join("projects").join("C--otra");
        fs::create_dir_all(&lejos).unwrap();
        fs::write(lejos.join(format!("{otra}.jsonl")), "").unwrap();
        assert_eq!(ruta_transcripcion(&c, otra).unwrap(), lejos.join(format!("{otra}.jsonl")));
        assert!(ruta_transcripcion(&c, "no-existe").is_none());
        // Un id con separadores nunca sale de la carpeta
        assert!(ruta_transcripcion(&c, "../C--otra/aaaa-bbbb").is_none());
        assert!(leer_historial_de(&c, "../x").is_err());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn sin_transcripcion_no_hay_entradas() {
        let c = carpeta_temporal("vacia");
        assert_eq!(leer_historial_de(&c, "ses1").unwrap(), json!({ "entradas": [] }));
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn lee_la_cola_y_la_agranda_hasta_juntar_pedidos() {
        let c = carpeta_temporal("agranda");
        let dir = c.join("projects").join("C--demo");
        fs::create_dir_all(&dir).unwrap();
        // Ocho turnos con una respuesta de 100 KB cada uno: 256 KB no alcanzan para 7 pedidos
        let mut lineas = Vec::new();
        for i in 0..8 {
            lineas.push(usuario(&format!("pedido {i}"), "2026-11-23T10:00:00Z"));
            lineas.push(json!({ "type": "user", "message": { "role": "user", "content": [{ "type": "tool_result", "content": "x".repeat(100_000) }] } }).to_string());
            lineas.push(claude(&format!("respuesta {i}"), "2026-11-23T10:00:01Z"));
        }
        fs::write(dir.join("ses1.jsonl"), lineas.join("\n") + "\n").unwrap();
        let r = leer_historial_de(&c, "ses1").unwrap();
        let textos: Vec<&str> = r["entradas"].as_array().unwrap().iter().map(|e| e["texto"].as_str().unwrap()).collect();
        assert!(textos.iter().filter(|t| t.starts_with("pedido")).count() >= PEDIDOS_BUSCADOS);
        assert_eq!(textos.last(), Some(&"respuesta 7"));
        fs::remove_dir_all(&c).unwrap();
    }
}
