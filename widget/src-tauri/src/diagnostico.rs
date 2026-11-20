//! Log de diagnóstico del widget: `%USERPROFILE%/.claude/oficina/widget.log`, una línea por
//! evento (clics del globo y su decisión, resultado de `responder`, errores del frontend).
//! Tiene tope de tamaño: al pasarlo se conserva la mitad más reciente.

use std::path::{Path, PathBuf};

use chrono::{DateTime, SecondsFormat, Utc};

/// Tope del archivo (~200 KB).
pub const TOPE_BYTES: u64 = 200 * 1024;
/// Largo máximo de una línea; lo que sobra se corta.
const LARGO_LINEA: usize = 400;

pub fn ruta_log() -> Option<PathBuf> {
    let base = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME"))?;
    Some(PathBuf::from(base).join(".claude").join("oficina").join("widget.log"))
}

/// Agrega `<hora ISO> <texto>` en una sola línea. Si el archivo pasa `tope`, conserva la mitad
/// final (desde un salto de línea) antes de agregar.
pub fn agregar_linea(ruta: &Path, texto: &str, ahora: DateTime<Utc>, tope: u64) -> Result<(), String> {
    use std::io::Write;
    let limpio: String = texto.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(LARGO_LINEA).collect();
    let linea = format!("{} {}\n", hora(ahora), limpio);
    if let Some(carpeta) = ruta.parent() {
        std::fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    }
    let tamano = std::fs::metadata(ruta).map(|m| m.len()).unwrap_or(0);
    if tamano + linea.len() as u64 > tope {
        // Conservar la mitad más reciente, empezando en una línea entera
        let previo = std::fs::read_to_string(ruta).unwrap_or_default();
        let mut desde = previo.len().saturating_sub((tope / 2) as usize);
        while !previo.is_char_boundary(desde) {
            desde += 1;
        }
        let corte = previo[desde..].find('\n').map(|i| desde + i + 1).unwrap_or(previo.len());
        std::fs::write(ruta, &previo[corte..]).map_err(|e| e.to_string())?;
    }
    let mut archivo = std::fs::OpenOptions::new().create(true).append(true).open(ruta).map_err(|e| e.to_string())?;
    archivo.write_all(linea.as_bytes()).map_err(|e| e.to_string())
}

fn hora(ahora: DateTime<Utc>) -> String {
    ahora.to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn ruta_temporal(nombre: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!("oficina-widget-log-{}-{}-{}", nombre, std::process::id(), Utc::now().timestamp_nanos_opt().unwrap_or_default()))
            .join("widget.log")
    }

    fn ahora() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-20T01:00:00Z").unwrap().with_timezone(&Utc)
    }

    #[test]
    fn agrega_una_linea_por_evento_con_la_hora() {
        let r = ruta_temporal("lineas");
        agregar_linea(&r, "clic pregunta=toolu_1 item=0 -> enviar", ahora(), TOPE_BYTES).unwrap();
        agregar_linea(&r, "responder toolu_1 -> error: algo\ncon salto", ahora(), TOPE_BYTES).unwrap();
        let texto = fs::read_to_string(&r).unwrap();
        assert_eq!(
            texto,
            "2026-11-20T01:00:00.000Z clic pregunta=toolu_1 item=0 -> enviar\n2026-11-20T01:00:00.000Z responder toolu_1 -> error: algo con salto\n"
        );
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn corta_las_lineas_largas() {
        let r = ruta_temporal("larga");
        agregar_linea(&r, &"x".repeat(5000), ahora(), TOPE_BYTES).unwrap();
        let texto = fs::read_to_string(&r).unwrap();
        assert!(texto.len() < 500, "{}", texto.len());
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn no_pasa_el_tope_y_conserva_lo_mas_reciente() {
        let r = ruta_temporal("tope");
        for i in 0..400 {
            agregar_linea(&r, &format!("evento {i:04} {}", "y".repeat(40)), ahora(), 4096).unwrap();
        }
        let texto = fs::read_to_string(&r).unwrap();
        assert!(texto.len() as u64 <= 4096, "pesa {}", texto.len());
        assert!(texto.contains("evento 0399"));
        assert!(!texto.contains("evento 0000"));
        // Siempre empieza en una línea entera
        assert!(texto.starts_with("2026-"));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }
}
