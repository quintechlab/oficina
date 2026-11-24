//! Órdenes del widget a una sesión (#19): un archivo por sesión en
//! `%USERPROFILE%/.claude/oficina/ordenes/<id de la sesión>.json`, con una orden por vez
//! (`mensaje`, `frenar` o, desde la v0.11, `cerrar`). La sesión de Claude Code lo lee, hace lo pedido y lo reescribe con
//! `consumida: true` y el `resultado`. Solo se escribe desde un clic (o Enter) del usuario.

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{json, Value};

/// Largo máximo del texto de un mensaje, en unidades UTF-16 (como `length` en el mod).
pub const MAX_TEXTO: usize = 10_000;
/// Una orden sin consumir de menos de esto todavía puede ejecutarse: no se pisa.
pub const MS_ORDEN_VIGENTE: i64 = 120_000;
/// Una `creada` más de esto en el futuro la descarta el mod: tampoco frena una orden nueva.
const MS_FUTURO_TOLERADO: i64 = 60_000;
const LARGO_ID: usize = 16;
const ALFABETO: &[u8; 36] = b"abcdefghijklmnopqrstuvwxyz0123456789";

/// `%USERPROFILE%/.claude/oficina/ordenes`.
pub fn carpeta_ordenes() -> Option<PathBuf> {
    let base = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(base).join(".claude").join("oficina").join("ordenes"))
}

/// Ruta del archivo de una sesión. Rechaza lo que no sea un id de sesión
/// (`^[A-Za-z0-9_-]{1,128}$`), así ningún id puede salir de la carpeta.
pub fn ruta_orden(carpeta: &Path, sesion: &str) -> Result<PathBuf, String> {
    let valido = !sesion.is_empty()
        && sesion.len() <= 128
        && sesion.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !valido {
        return Err(String::from("id de sesión inválido"));
    }
    Ok(carpeta.join(format!("{sesion}.json")))
}

fn id_valido(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
}

/// Escribe la orden y devuelve su id. `tipo`: `mensaje` (con `texto`) o `frenar`. No pisa una
/// orden sin consumir de menos de 120 s: "todavía hay una orden pendiente".
pub fn escribir_orden(
    carpeta: &Path,
    sesion: &str,
    tipo: &str,
    texto: Option<&str>,
    ahora: DateTime<Utc>,
) -> Result<String, String> {
    let ruta = ruta_orden(carpeta, sesion)?;
    let texto = match tipo {
        "mensaje" => Some(texto_valido(texto)?),
        "frenar" | "cerrar" => None,
        _ => return Err(String::from("tipo de orden inválido")),
    };
    if hay_pendiente(&ruta, ahora) {
        return Err(String::from("todavía hay una orden pendiente"));
    }
    std::fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    let id = nuevo_id();
    let mut cuerpo = json!({ "v": 1, "origen": "widget", "id": id, "tipo": tipo, "creada": iso(ahora) });
    if let Some(t) = texto {
        cuerpo["texto"] = json!(t);
    }
    let contenido = serde_json::to_string_pretty(&cuerpo).map_err(|e| e.to_string())?;
    // Se escribe aparte y se renombra: la sesión nunca lee un archivo a medio escribir
    let temporal = carpeta.join(format!("{sesion}.json.tmp"));
    std::fs::write(&temporal, contenido).map_err(|e| e.to_string())?;
    std::fs::rename(&temporal, &ruta).map_err(|e| e.to_string())?;
    Ok(id)
}

/// El texto tal cual, si no queda vacío sin los espacios de los bordes y entra en el máximo.
fn texto_valido(texto: Option<&str>) -> Result<&str, String> {
    let t = texto.unwrap_or("");
    if t.trim().is_empty() {
        return Err(String::from("el mensaje está vacío"));
    }
    if t.encode_utf16().count() > MAX_TEXTO {
        return Err(format!("el mensaje pasa de {MAX_TEXTO} caracteres"));
    }
    Ok(t)
}

/// ¿Hay una orden sin consumir que todavía puede ejecutarse? Un archivo ilegible, consumido o
/// viejo se puede pisar.
fn hay_pendiente(ruta: &Path, ahora: DateTime<Utc>) -> bool {
    let Ok(texto) = std::fs::read_to_string(ruta) else {
        return false;
    };
    let Ok(v) = serde_json::from_str::<Value>(&texto) else {
        return false;
    };
    if v["consumida"].as_bool() == Some(true) {
        return false;
    }
    let Some(creada) = v["creada"].as_str().and_then(|c| DateTime::parse_from_rfc3339(c).ok()) else {
        return false;
    };
    let edad = (ahora - creada.with_timezone(&Utc)).num_milliseconds();
    (-MS_FUTURO_TOLERADO..MS_ORDEN_VIGENTE).contains(&edad)
}

/// Qué pasó con la orden `id`: `{ estado: "pendiente" }`, `{ estado: "ausente" }` (no hay
/// archivo, o es de otra orden) o `{ estado: "consumida", resultado, motivo }`.
pub fn estado_orden(carpeta: &Path, sesion: &str, id: &str) -> Result<Value, String> {
    let ruta = ruta_orden(carpeta, sesion)?;
    if !id_valido(id) {
        return Err(String::from("id de orden inválido"));
    }
    // Solo "no existe" es ausente. Cualquier otro error de lectura (p. ej. en Windows, el archivo
    // abierto por la sesión mientras lo reescribe) es pendiente: se vuelve a mirar en la vuelta siguiente
    let texto = match std::fs::read_to_string(ruta) {
        Ok(texto) => texto,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(json!({ "estado": "ausente" })),
        Err(_) => return Ok(json!({ "estado": "pendiente" })),
    };
    // A medio escribir por la sesión: se vuelve a mirar en la vuelta siguiente
    let Ok(v) = serde_json::from_str::<Value>(&texto) else {
        return Ok(json!({ "estado": "pendiente" }));
    };
    if v["id"].as_str() != Some(id) {
        return Ok(json!({ "estado": "ausente" }));
    }
    if v["consumida"].as_bool() == Some(true) {
        return Ok(json!({ "estado": "consumida", "resultado": v["resultado"].clone(), "motivo": v["motivo"].clone() }));
    }
    Ok(json!({ "estado": "pendiente" }))
}

/// Borra el archivo de órdenes de una sesión, si existe.
pub fn borrar_orden(carpeta: &Path, sesion: &str) -> Result<(), String> {
    let ruta = ruta_orden(carpeta, sesion)?;
    match std::fs::remove_file(ruta) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

/// 16 caracteres `[a-z0-9]`, distintos en cada llamada (sin dependencias: el azar de `RandomState`).
fn nuevo_id() -> String {
    static CONTADOR: AtomicU64 = AtomicU64::new(0);
    let mut id = String::with_capacity(LARGO_ID);
    while id.len() < LARGO_ID {
        let mut h = RandomState::new().build_hasher();
        h.write_u64(CONTADOR.fetch_add(1, Ordering::Relaxed));
        h.write_i64(Utc::now().timestamp_nanos_opt().unwrap_or_default());
        let mut n = h.finish();
        for _ in 0..8 {
            if id.len() == LARGO_ID {
                break;
            }
            id.push(ALFABETO[(n % 36) as usize] as char);
            n /= 36;
        }
    }
    id
}

fn iso(ahora: DateTime<Utc>) -> String {
    ahora.to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn carpeta_temporal(nombre: &str) -> PathBuf {
        let unica = format!(
            "oficina-widget-ord-{}-{}-{}",
            nombre,
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        std::env::temp_dir().join(unica)
    }

    fn ahora() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-22T15:00:00Z").unwrap().with_timezone(&Utc)
    }

    fn leer(c: &Path, sesion: &str) -> Value {
        serde_json::from_str(&fs::read_to_string(c.join(format!("{sesion}.json"))).unwrap()).unwrap()
    }

    #[test]
    fn escribe_el_mensaje_exacto_que_espera_el_mod_sin_temporal() {
        let c = carpeta_temporal("mensaje");
        let id = escribir_orden(&c, "ses_01-Ab", "mensaje", Some("  probá de nuevo  "), ahora()).unwrap();
        assert_eq!(id.len(), 16);
        assert!(id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit()), "id raro: {id}");
        assert_eq!(
            leer(&c, "ses_01-Ab"),
            json!({ "v": 1, "origen": "widget", "id": id, "tipo": "mensaje", "texto": "  probá de nuevo  ", "creada": "2026-11-22T15:00:00.000Z" })
        );
        // Atómica: el temporal ya se renombró
        assert!(!c.join("ses_01-Ab.json.tmp").exists());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn frenar_va_sin_texto() {
        let c = carpeta_temporal("frenar");
        let id = escribir_orden(&c, "ses1", "frenar", Some("se ignora"), ahora()).unwrap();
        assert_eq!(
            leer(&c, "ses1"),
            json!({ "v": 1, "origen": "widget", "id": id, "tipo": "frenar", "creada": "2026-11-22T15:00:00.000Z" })
        );
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn cerrar_va_sin_texto() {
        // Desde la v0.11 (#25): la sesión de terminal sale como con /exit
        let c = carpeta_temporal("cerrar");
        let id = escribir_orden(&c, "ses1", "cerrar", Some("se ignora"), ahora()).unwrap();
        assert_eq!(
            leer(&c, "ses1"),
            json!({ "v": 1, "origen": "widget", "id": id, "tipo": "cerrar", "creada": "2026-11-22T15:00:00.000Z" })
        );
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn los_ids_no_se_repiten() {
        let ids: std::collections::HashSet<String> = (0..200).map(|_| nuevo_id()).collect();
        assert_eq!(ids.len(), 200);
    }

    #[test]
    fn rechaza_sesiones_con_separadores_o_puntos() {
        let c = carpeta_temporal("sesiones");
        for s in ["", "..", "../x", "a/b", "a\\b", "C:x", "s.json", "a b", &"x".repeat(129)] {
            assert!(ruta_orden(&c, s).is_err(), "aceptó {s:?}");
            assert!(escribir_orden(&c, s, "frenar", None, ahora()).is_err(), "escribió {s:?}");
            assert!(estado_orden(&c, s, "abc").is_err());
            assert!(borrar_orden(&c, s).is_err());
        }
        assert!(!c.exists(), "no tiene que crear nada con una sesión inválida");
        assert_eq!(ruta_orden(&c, &"x".repeat(128)).unwrap(), c.join(format!("{}.json", "x".repeat(128))));
    }

    #[test]
    fn rechaza_tipos_y_textos_invalidos() {
        let c = carpeta_temporal("textos");
        assert!(escribir_orden(&c, "ses1", "borrar", Some("x"), ahora()).is_err());
        assert!(escribir_orden(&c, "ses1", "mensaje", None, ahora()).is_err());
        assert!(escribir_orden(&c, "ses1", "mensaje", Some(" \n\t "), ahora()).is_err());
        assert!(escribir_orden(&c, "ses1", "mensaje", Some(&"a".repeat(MAX_TEXTO + 1)), ahora()).is_err());
        // 5000 emojis son 10000 unidades UTF-16: entran justo; uno más ya no
        assert!(!c.exists());
        assert!(escribir_orden(&c, "ses1", "mensaje", Some(&"😀".repeat(5000)), ahora()).is_ok());
        borrar_orden(&c, "ses1").unwrap();
        assert!(escribir_orden(&c, "ses1", "mensaje", Some(&"😀".repeat(5001)), ahora()).is_err());
        assert!(escribir_orden(&c, "ses1", "mensaje", Some(&"a".repeat(MAX_TEXTO)), ahora()).is_ok());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn no_pisa_una_orden_vigente_sin_consumir() {
        let c = carpeta_temporal("vigente");
        let id = escribir_orden(&c, "ses1", "mensaje", Some("hola"), ahora()).unwrap();
        let despues = ahora() + chrono::Duration::seconds(119);
        let error = escribir_orden(&c, "ses1", "frenar", None, despues).unwrap_err();
        assert_eq!(error, "todavía hay una orden pendiente");
        assert_eq!(leer(&c, "ses1")["id"], json!(id), "la orden de antes sigue intacta");
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn pisa_una_orden_vieja_consumida_o_ilegible() {
        let c = carpeta_temporal("vieja");
        escribir_orden(&c, "ses1", "mensaje", Some("hola"), ahora()).unwrap();
        let tarde = ahora() + chrono::Duration::seconds(121);
        let nueva = escribir_orden(&c, "ses1", "frenar", None, tarde).unwrap();
        assert_eq!(leer(&c, "ses1")["id"], json!(nueva));
        fs::write(c.join("ses1.json"), r#"{"v":1,"id":"abc","consumida":true,"resultado":"enviado","cuando":"2026-11-22T15:00:01.000Z"}"#).unwrap();
        assert!(escribir_orden(&c, "ses1", "frenar", None, ahora()).is_ok());
        fs::write(c.join("ses1.json"), "{ a medio").unwrap();
        assert!(escribir_orden(&c, "ses1", "frenar", None, ahora()).is_ok());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn estado_pendiente_consumida_ausente_y_otro_id() {
        let c = carpeta_temporal("estado");
        assert_eq!(estado_orden(&c, "ses1", "abc").unwrap(), json!({ "estado": "ausente" }));
        let id = escribir_orden(&c, "ses1", "mensaje", Some("hola"), ahora()).unwrap();
        assert_eq!(estado_orden(&c, "ses1", &id).unwrap(), json!({ "estado": "pendiente" }));
        assert_eq!(estado_orden(&c, "ses1", "otroid").unwrap(), json!({ "estado": "ausente" }));
        fs::write(
            c.join("ses1.json"),
            format!(r#"{{"v":1,"id":"{id}","consumida":true,"resultado":"en-cola","cuando":"2026-11-22T15:00:01.000Z"}}"#),
        )
        .unwrap();
        assert_eq!(estado_orden(&c, "ses1", &id).unwrap(), json!({ "estado": "consumida", "resultado": "en-cola", "motivo": null }));
        fs::write(
            c.join("ses1.json"),
            format!(r#"{{"v":1,"id":"{id}","consumida":true,"resultado":"descartada","motivo":"vieja","cuando":"x"}}"#),
        )
        .unwrap();
        assert_eq!(estado_orden(&c, "ses1", &id).unwrap(), json!({ "estado": "consumida", "resultado": "descartada", "motivo": "vieja" }));
        // Descartada sin id (null): para esta orden es ausente
        fs::write(c.join("ses1.json"), r#"{"v":1,"id":null,"consumida":true,"resultado":"descartada","motivo":"sin id"}"#).unwrap();
        assert_eq!(estado_orden(&c, "ses1", &id).unwrap(), json!({ "estado": "ausente" }));
        assert!(estado_orden(&c, "ses1", "../x").is_err());
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn un_error_de_lectura_que_no_es_no_existe_es_pendiente() {
        let c = carpeta_temporal("ilegible");
        // Una carpeta en lugar del archivo: leerla falla sin ser NotFound en todo sistema
        fs::create_dir_all(c.join("ses1.json")).unwrap();
        assert_eq!(estado_orden(&c, "ses1", "abc").unwrap(), json!({ "estado": "pendiente" }));
        fs::remove_dir_all(c.join("ses1.json")).unwrap();
        // Bytes que no son UTF-8 (a medio escribir): también pendiente
        fs::write(c.join("ses1.json"), [0xff, 0xfe, 0x00]).unwrap();
        assert_eq!(estado_orden(&c, "ses1", "abc").unwrap(), json!({ "estado": "pendiente" }));
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn borrar() {
        let c = carpeta_temporal("borrar");
        let id = escribir_orden(&c, "ses1", "frenar", None, ahora()).unwrap();
        borrar_orden(&c, "ses1").unwrap();
        assert_eq!(estado_orden(&c, "ses1", &id).unwrap(), json!({ "estado": "ausente" }));
        // Borrar lo que no está no es un error
        borrar_orden(&c, "ses1").unwrap();
        // Después de borrar se puede ordenar de nuevo enseguida
        assert!(escribir_orden(&c, "ses1", "frenar", None, ahora()).is_ok());
        fs::remove_dir_all(&c).unwrap();
    }
}
