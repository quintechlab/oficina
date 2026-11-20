//! Preferencias del widget que sobreviven entre usos: el tamaño elegido en la bandeja.
//! Se guardan en `<carpeta de configuración de la app>/preferencias.json`.

use std::path::Path;

/// Pasos del tamaño, en porcentaje del tamaño original (el de la versión 0.1): de 100 % a 200 %.
pub const PASOS: [u32; 5] = [100, 125, 150, 175, 200];
pub const PASO_POR_DEFECTO: u32 = 100;

/// Tamaño guardado. Sin archivo o ilegible, 100 %. Migra el valor de la 0.2: "normal" es 100 %,
/// "grande" y "muy grande" son 200 % (lo más grande que hay ahora).
pub fn leer_tamano(ruta: &Path) -> u32 {
    let guardado = std::fs::read_to_string(ruta)
        .ok()
        .and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok())
        .map(|v| v["tamano"].clone())
        .unwrap_or(serde_json::Value::Null);
    match guardado {
        serde_json::Value::Number(n) => n.as_u64().map(|n| n as u32).filter(|n| PASOS.contains(n)).unwrap_or(PASO_POR_DEFECTO),
        serde_json::Value::String(t) => match t.as_str() {
            "grande" | "muy-grande" | "muy grande" => 200,
            _ => PASO_POR_DEFECTO,
        },
        _ => PASO_POR_DEFECTO,
    }
}

/// Guarda el tamaño elegido (solo uno de `PASOS`).
pub fn guardar_tamano(ruta: &Path, tamano: u32) -> Result<(), String> {
    if !PASOS.contains(&tamano) {
        return Err(format!("tamaño desconocido: {tamano}"));
    }
    if let Some(carpeta) = ruta.parent() {
        std::fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    }
    std::fs::write(ruta, serde_json::json!({ "tamano": tamano }).to_string()).map_err(|e| e.to_string())
}

/// El paso siguiente: `direccion` 1 agranda, -1 achica, 0 vuelve a 100 %. Se frena en las puntas.
pub fn paso(actual: u32, direccion: i32) -> u32 {
    if direccion == 0 {
        return PASO_POR_DEFECTO;
    }
    let i = PASOS.iter().position(|p| *p == actual).unwrap_or(0) as i32;
    let j = (i + direccion.signum()).clamp(0, PASOS.len() as i32 - 1);
    PASOS[j as usize]
}

/// Estado del submenú: si se puede agrandar, si se puede achicar, y la línea con el porcentaje.
pub fn menu_tamano(actual: u32) -> (bool, bool, String) {
    let primero = PASOS[0];
    let ultimo = PASOS[PASOS.len() - 1];
    (actual < ultimo, actual > primero, format!("Tamaño actual: {actual} %"))
}

/// Qué hacer cuando se abre Oficina con una ya abierta: nunca otra ventana, sino mostrar la que hay.
#[derive(Debug, PartialEq, Eq)]
pub enum Accion {
    /// Volver a expandir la tira mini.
    SalirDeMini,
    /// Sacarla de la barra de tareas si estaba minimizada.
    Restaurar,
    /// Mostrarla si estaba escondida en la bandeja.
    Mostrar,
    Enfocar,
}

pub fn al_segundo_arranque(visible: bool, minimizada: bool, mini: bool) -> Vec<Accion> {
    let mut acciones = Vec::new();
    if mini {
        acciones.push(Accion::SalirDeMini);
    }
    if minimizada {
        acciones.push(Accion::Restaurar);
    }
    if !visible {
        acciones.push(Accion::Mostrar);
    }
    acciones.push(Accion::Enfocar);
    acciones
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn ruta_temporal(nombre: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!("oficina-widget-pref-{}-{}-{}", nombre, std::process::id(), chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()))
            .join("preferencias.json")
    }

    #[test]
    fn sin_archivo_o_con_basura_el_tamano_es_100() {
        let r = ruta_temporal("defecto");
        assert_eq!(leer_tamano(&r), 100);
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, "no es json").unwrap();
        assert_eq!(leer_tamano(&r), 100);
        fs::write(&r, r#"{"tamano":"gigante"}"#).unwrap();
        assert_eq!(leer_tamano(&r), 100);
        fs::write(&r, r#"{"tamano":130}"#).unwrap();
        assert_eq!(leer_tamano(&r), 100);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn migra_el_tamano_de_la_version_anterior() {
        let r = ruta_temporal("migrar");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        for (viejo, nuevo) in [("normal", 100), ("grande", 200), ("muy-grande", 200), ("muy grande", 200)] {
            fs::write(&r, format!(r#"{{"tamano":"{viejo}"}}"#)).unwrap();
            assert_eq!(leer_tamano(&r), nuevo, "{viejo}");
        }
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn el_tamano_elegido_se_guarda_y_se_vuelve_a_leer() {
        let r = ruta_temporal("guardar");
        guardar_tamano(&r, 175).unwrap();
        assert_eq!(leer_tamano(&r), 175);
        guardar_tamano(&r, 100).unwrap();
        assert_eq!(leer_tamano(&r), 100);
        assert!(guardar_tamano(&r, 130).is_err());
        assert_eq!(leer_tamano(&r), 100);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn agrandar_y_achicar_de_a_un_paso_frenando_en_las_puntas() {
        assert_eq!(paso(100, 1), 125);
        assert_eq!(paso(175, 1), 200);
        assert_eq!(paso(200, 1), 200);
        assert_eq!(paso(150, -1), 125);
        assert_eq!(paso(100, -1), 100);
        assert_eq!(paso(175, 0), 100);
        // Un valor fuera de los pasos arranca desde 100 %
        assert_eq!(paso(130, 1), 125);
    }

    #[test]
    fn el_submenu_muestra_el_porcentaje_y_se_apaga_en_las_puntas() {
        assert_eq!(menu_tamano(100), (true, false, String::from("Tamaño actual: 100 %")));
        assert_eq!(menu_tamano(150), (true, true, String::from("Tamaño actual: 150 %")));
        assert_eq!(menu_tamano(200), (false, true, String::from("Tamaño actual: 200 %")));
    }

    #[test]
    fn segundo_arranque_muestra_la_ventana_que_ya_hay() {
        assert_eq!(al_segundo_arranque(true, false, false), vec![Accion::Enfocar]);
        assert_eq!(al_segundo_arranque(false, false, false), vec![Accion::Mostrar, Accion::Enfocar]);
        assert_eq!(al_segundo_arranque(true, true, false), vec![Accion::Restaurar, Accion::Enfocar]);
        assert_eq!(
            al_segundo_arranque(false, true, true),
            vec![Accion::SalirDeMini, Accion::Restaurar, Accion::Mostrar, Accion::Enfocar]
        );
    }
}
