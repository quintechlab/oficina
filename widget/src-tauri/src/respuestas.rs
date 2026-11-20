//! Respuestas desde el globo del widget: un archivo por pregunta en
//! `%USERPROFILE%/.claude/oficina/respuestas/<id de la pregunta>.json`, que la sesión de
//! Claude Code lee, valida y, si lo acepta, marca como usado (`consumida: true`).

use std::path::{Path, PathBuf};

use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{json, Map, Value};

/// `%USERPROFILE%/.claude/oficina/respuestas`.
pub fn carpeta_respuestas() -> Option<PathBuf> {
    let base = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(base).join(".claude").join("oficina").join("respuestas"))
}

/// Ruta del archivo de una pregunta. Rechaza ids que no sean de la forma de un `tool_use_id`,
/// así ningún id puede salir de la carpeta (`..`, separadores, unidades).
pub fn ruta_respuesta(carpeta: &Path, id: &str) -> Result<PathBuf, String> {
    let valido = !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !valido {
        return Err(String::from("id de pregunta inválido"));
    }
    Ok(carpeta.join(format!("{id}.json")))
}

/// Escribe la respuesta tal como la espera el mod: `{ v, origen, tocadoEn, answers, libres }`.
pub fn escribir_respuesta(
    carpeta: &Path,
    id: &str,
    answers: &Map<String, Value>,
    libres: &[String],
    ahora: DateTime<Utc>,
) -> Result<(), String> {
    let ruta = ruta_respuesta(carpeta, id)?;
    if answers.is_empty() || answers.values().any(|v| !v.is_string()) {
        return Err(String::from("respuesta vacía o mal formada"));
    }
    std::fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    let texto = serde_json::to_string_pretty(&cuerpo(answers, libres, ahora)).map_err(|e| e.to_string())?;
    // Se escribe aparte y se renombra: la sesión nunca lee un archivo a medio escribir
    let temporal = carpeta.join(format!("{id}.json.tmp"));
    std::fs::write(&temporal, texto).map_err(|e| e.to_string())?;
    std::fs::rename(&temporal, &ruta).map_err(|e| e.to_string())
}

/// Qué pasó con una respuesta enviada: `pendiente` (nadie la tomó), `consumida` (la sesión la
/// usó) o `ausente` (no hay archivo).
pub fn estado_respuesta(carpeta: &Path, id: &str) -> Result<&'static str, String> {
    let ruta = ruta_respuesta(carpeta, id)?;
    let Ok(texto) = std::fs::read_to_string(ruta) else {
        return Ok("ausente");
    };
    let consumida = serde_json::from_str::<Value>(&texto).ok().and_then(|v| v["consumida"].as_bool()) == Some(true);
    Ok(if consumida { "consumida" } else { "pendiente" })
}

/// Borra el archivo de una respuesta, si existe.
pub fn borrar_respuesta(carpeta: &Path, id: &str) -> Result<(), String> {
    let ruta = ruta_respuesta(carpeta, id)?;
    match std::fs::remove_file(ruta) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

fn iso(ahora: DateTime<Utc>) -> String {
    ahora.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn cuerpo(answers: &Map<String, Value>, libres: &[String], ahora: DateTime<Utc>) -> Value {
    json!({ "v": 1, "origen": "widget", "tocadoEn": iso(ahora), "answers": answers, "libres": libres })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn carpeta_temporal(nombre: &str) -> PathBuf {
        let unica = format!(
            "oficina-widget-resp-{}-{}-{}",
            nombre,
            std::process::id(),
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        );
        std::env::temp_dir().join(unica)
    }

    fn ahora() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-19T23:50:00Z").unwrap().with_timezone(&Utc)
    }

    fn respuestas() -> Map<String, Value> {
        let mut m = Map::new();
        m.insert(String::from("¿Qué boceto?"), json!("Terrario (Recomendada)"));
        m.insert(String::from("¿Qué incluyo?"), json!("Tests, CI"));
        m
    }

    #[test]
    fn escribe_el_json_exacto_que_espera_el_mod() {
        let c = carpeta_temporal("escribe");
        escribir_respuesta(&c, "toolu_01AbC-9", &respuestas(), &[String::from("¿Qué incluyo?")], ahora()).unwrap();
        let texto = fs::read_to_string(c.join("toolu_01AbC-9.json")).unwrap();
        let v: Value = serde_json::from_str(&texto).unwrap();
        assert_eq!(
            v,
            json!({
                "v": 1,
                "origen": "widget",
                "tocadoEn": "2026-11-19T23:50:00.000Z",
                "answers": { "¿Qué boceto?": "Terrario (Recomendada)", "¿Qué incluyo?": "Tests, CI" },
                "libres": ["¿Qué incluyo?"]
            })
        );
        fs::remove_dir_all(&c).unwrap();
    }

    #[test]
    fn rechaza_ids_con_separadores_o_puntos() {
        let c = carpeta_temporal("ids");
        for id in ["", "..", "../x", "a/b", "a\\b", "C:x", "toolu.json", "a b", &"x".repeat(129)] {
            assert!(ruta_respuesta(&c, id).is_err(), "aceptó {id:?}");
            assert!(escribir_respuesta(&c, id, &respuestas(), &[], ahora()).is_err(), "escribió {id:?}");
        }
        assert!(!c.exists(), "no tiene que crear nada con un id inválido");
        assert_eq!(ruta_respuesta(&c, "toolu_01").unwrap(), c.join("toolu_01.json"));
    }

    #[test]
    fn rechaza_respuestas_vacias_o_que_no_son_texto() {
        let c = carpeta_temporal("vacias");
        assert!(escribir_respuesta(&c, "toolu_1", &Map::new(), &[], ahora()).is_err());
        let mut rara = Map::new();
        rara.insert(String::from("¿Qué?"), json!(3));
        assert!(escribir_respuesta(&c, "toolu_1", &rara, &[], ahora()).is_err());
        assert!(!c.exists());
    }

    #[test]
    fn estado_y_borrado() {
        let c = carpeta_temporal("estado");
        assert_eq!(estado_respuesta(&c, "toolu_1").unwrap(), "ausente");
        escribir_respuesta(&c, "toolu_1", &respuestas(), &[], ahora()).unwrap();
        assert_eq!(estado_respuesta(&c, "toolu_1").unwrap(), "pendiente");
        fs::write(c.join("toolu_1.json"), r#"{"v":1,"consumida":true,"tocadoEn":"2026-11-19T23:50:01.000Z"}"#).unwrap();
        assert_eq!(estado_respuesta(&c, "toolu_1").unwrap(), "consumida");
        borrar_respuesta(&c, "toolu_1").unwrap();
        assert_eq!(estado_respuesta(&c, "toolu_1").unwrap(), "ausente");
        // Borrar lo que no está no es un error
        borrar_respuesta(&c, "toolu_1").unwrap();
        assert!(estado_respuesta(&c, "../x").is_err());
        fs::remove_dir_all(&c).unwrap();
    }
}
