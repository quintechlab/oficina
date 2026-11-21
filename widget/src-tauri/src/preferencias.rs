//! Preferencias del widget que sobreviven entre usos: el tamaño elegido en la bandeja, el borde
//! donde está acoplada la muesca (docs/diseno/estilo-avis-ux.md, 7.5), la posición del tablero
//! flotante y el monitor de la última vez (9.7).
//! Se guardan en `<carpeta de configuración de la app>/preferencias.json`.

use std::path::Path;

use serde_json::{json, Value};

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

/// Guarda el tamaño elegido (solo uno de `PASOS`). Lo demás guardado se conserva.
pub fn guardar_tamano(ruta: &Path, tamano: u32) -> Result<(), String> {
    if !PASOS.contains(&tamano) {
        return Err(format!("tamaño desconocido: {tamano}"));
    }
    escribir(ruta, Preferencias { tamano, ..leer_todo(ruta) })
}

/// Todo lo que se guarda, junto: guardar una preferencia no borra las otras.
struct Preferencias {
    tamano: u32,
    acople: Option<Acople>,
    flotante: Option<Flotante>,
    monitor: Option<(f64, f64)>,
}

/// Lo guardado, ya leído y migrado (el tamaño de texto de la 0.2 pasa a número).
fn leer_todo(ruta: &Path) -> Preferencias {
    Preferencias { tamano: leer_tamano(ruta), acople: leer_acople(ruta), flotante: leer_flotante(ruta), monitor: leer_monitor(ruta) }
}

/// Escribe el archivo entero con todas las preferencias.
fn escribir(ruta: &Path, p: Preferencias) -> Result<(), String> {
    if let Some(carpeta) = ruta.parent() {
        std::fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    }
    let flotante = p.flotante.map_or(Value::Null, |f| json!({ "x": fraccion(Some(f.x)), "y": fraccion(Some(f.y)) }));
    let monitor = p.monitor.map_or(Value::Null, |(x, y)| json!({ "x": x, "y": y }));
    let valor = json!({ "tamano": p.tamano, "acople": valor_de_acople(p.acople), "flotante": flotante, "monitor": monitor });
    std::fs::write(ruta, valor.to_string()).map_err(|e| e.to_string())
}

fn leer_valor(ruta: &Path) -> Option<Value> {
    serde_json::from_str::<Value>(&std::fs::read_to_string(ruta).ok()?).ok()
}

// ------------------------------------------------------------------ ventana única (estilo-avis-ux.md 9.7)

/// Posición del tablero flotante adentro del área de trabajo: la fracción del lugar libre (0 arriba
/// a la izquierda, 1 abajo a la derecha; `fraccionFlotante` de `tamano.js`). Así vuelve adentro del
/// área aunque cambie el monitor, la barra de tareas o el tamaño elegido. Reemplaza a lo que
/// guardaba `tauri-plugin-window-state` de la ventana flotante.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Flotante {
    pub x: f64,
    pub y: f64,
}

/// Entre 0 y 1; lo que no es número, al medio.
fn fraccion(v: Option<f64>) -> f64 {
    match v {
        Some(n) if n.is_finite() => n.clamp(0.0, 1.0),
        _ => 0.5,
    }
}

/// Posición flotante guardada. Sin archivo, sin posición o `null`: ninguna (el tablero va al medio).
pub fn leer_flotante(ruta: &Path) -> Option<Flotante> {
    let v = leer_valor(ruta)?;
    let f = v.get("flotante")?.as_object()?;
    Some(Flotante { x: fraccion(f.get("x").and_then(Value::as_f64)), y: fraccion(f.get("y").and_then(Value::as_f64)) })
}

pub fn guardar_flotante(ruta: &Path, flotante: Flotante) -> Result<(), String> {
    escribir(ruta, Preferencias { flotante: Some(flotante), ..leer_todo(ruta) })
}

/// Monitor de la última vez: un punto en px físicos de pantalla (el centro de su área de trabajo).
/// Al arrancar, la ventana va al monitor que lo contiene, acoplada o flotando.
pub fn leer_monitor(ruta: &Path) -> Option<(f64, f64)> {
    let v = leer_valor(ruta)?;
    let m = v.get("monitor")?;
    let (x, y) = (m.get("x")?.as_f64()?, m.get("y")?.as_f64()?);
    (x.is_finite() && y.is_finite()).then_some((x, y))
}

pub fn guardar_monitor(ruta: &Path, punto: (f64, f64)) -> Result<(), String> {
    if !(punto.0.is_finite() && punto.1.is_finite()) {
        return Err(String::from("punto inválido"));
    }
    escribir(ruta, Preferencias { monitor: Some(punto), ..leer_todo(ruta) })
}

// ------------------------------------------------------------------ acople de la muesca (7.5)

/// Borde de la pantalla donde se acopla la muesca.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Borde {
    Arriba,
    Derecha,
    Abajo,
    Izquierda,
}

impl Borde {
    /// En el orden del submenú "Acoplar a" y de `bordes_libres`.
    pub const TODOS: [Borde; 4] = [Borde::Arriba, Borde::Derecha, Borde::Abajo, Borde::Izquierda];

    pub fn nombre(self) -> &'static str {
        match self {
            Borde::Arriba => "arriba",
            Borde::Derecha => "derecha",
            Borde::Abajo => "abajo",
            Borde::Izquierda => "izquierda",
        }
    }

    pub fn desde(texto: &str) -> Option<Borde> {
        Borde::TODOS.into_iter().find(|b| b.nombre() == texto)
    }
}

/// `{ borde, lugar }`: `lugar` (0 a 1) es el centro de la muesca a lo largo del borde.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Acople {
    pub borde: Borde,
    pub lugar: f64,
}

/// Lugar al medio si falta o no es número; si no, entre 0 y 1.
pub fn lugar_valido(lugar: Option<f64>) -> f64 {
    match lugar {
        Some(l) if l.is_finite() => l.clamp(0.0, 1.0),
        _ => 0.5,
    }
}

/// El acople de un valor guardado. `null`, un borde desconocido o cualquier otra cosa: flota.
pub fn acople_desde_valor(v: &Value) -> Option<Acople> {
    let borde = Borde::desde(v.get("borde")?.as_str()?)?;
    Some(Acople { borde, lugar: lugar_valido(v.get("lugar").and_then(Value::as_f64)) })
}

pub fn valor_de_acople(acople: Option<Acople>) -> Value {
    match acople {
        Some(a) => json!({ "borde": a.borde.nombre(), "lugar": lugar_valido(Some(a.lugar)) }),
        None => Value::Null,
    }
}

/// Acople guardado. Sin archivo, ilegible o de una versión sin muesca (0.3 y anteriores): flota.
pub fn leer_acople(ruta: &Path) -> Option<Acople> {
    acople_desde_valor(&leer_valor(ruta)?["acople"])
}

/// Guarda el acople (`None`: flota) y conserva lo demás, con el tamaño ya migrado al número.
pub fn guardar_acople(ruta: &Path, acople: Option<Acople>) -> Result<(), String> {
    escribir(ruta, Preferencias { acople, ..leer_todo(ruta) })
}

/// Ids del submenú "Acoplar a", en su orden: Arriba, Derecha, Abajo, Izquierda y Flotante.
pub const IDS_ACOPLE: [&str; 5] = ["acople:arriba", "acople:derecha", "acople:abajo", "acople:izquierda", "acople:flotante"];

/// Qué eligió el usuario en "Acoplar a": `Some(None)` es Flotante; `None`, otro ítem del menú.
pub fn eleccion_de_menu(id: &str) -> Option<Option<Borde>> {
    if id == IDS_ACOPLE[4] {
        return Some(None);
    }
    Some(Some(Borde::desde(id.strip_prefix("acople:")?)?))
}

/// Marcas del submenú: una sola, la del borde actual o Flotante.
pub fn marcas_acople(borde: Option<Borde>) -> [bool; 5] {
    let mut marcas = [false; 5];
    let i = borde.and_then(|b| Borde::TODOS.iter().position(|t| *t == b)).unwrap_or(4);
    marcas[i] = true;
    marcas
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

/// Qué hacer cuando se abre Avis con una ya abierta: nunca otra ventana, sino mostrar la que hay.
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
    fn un_archivo_viejo_sin_acople_flota_y_conserva_el_tamano() {
        let r = ruta_temporal("viejo");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        // Archivos de la 0.3: solo el tamaño (número o texto de la 0.2)
        fs::write(&r, r#"{"tamano":150}"#).unwrap();
        assert_eq!(leer_acople(&r), None);
        assert_eq!(leer_tamano(&r), 150);
        fs::write(&r, r#"{"tamano":"grande"}"#).unwrap();
        assert_eq!(leer_acople(&r), None);
        assert_eq!(leer_tamano(&r), 200);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
        // Sin archivo, también flota
        assert_eq!(leer_acople(&ruta_temporal("sin-archivo")), None);
    }

    #[test]
    fn el_acople_se_lee_con_el_lugar_entre_0_y_1() {
        let r = ruta_temporal("leer-acople");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        let casos = [
            (r#"{"tamano":100,"acople":{"borde":"arriba","lugar":0.42}}"#, Some(Acople { borde: Borde::Arriba, lugar: 0.42 })),
            (r#"{"acople":{"borde":"derecha","lugar":1.7}}"#, Some(Acople { borde: Borde::Derecha, lugar: 1.0 })),
            (r#"{"acople":{"borde":"abajo","lugar":-3}}"#, Some(Acople { borde: Borde::Abajo, lugar: 0.0 })),
            // Sin lugar o con uno que no es número: al medio
            (r#"{"acople":{"borde":"izquierda"}}"#, Some(Acople { borde: Borde::Izquierda, lugar: 0.5 })),
            (r#"{"acople":{"borde":"izquierda","lugar":"mitad"}}"#, Some(Acople { borde: Borde::Izquierda, lugar: 0.5 })),
            // Flotando, o un borde que no existe: flota
            (r#"{"acople":null}"#, None),
            (r#"{"acople":{"borde":"centro","lugar":0.5}}"#, None),
            (r#"{"acople":"arriba"}"#, None),
            ("no es json", None),
        ];
        for (texto, esperado) in casos {
            fs::write(&r, texto).unwrap();
            assert_eq!(leer_acople(&r), esperado, "{texto}");
        }
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn guardar_el_acople_conserva_el_tamano_y_guardar_el_tamano_conserva_el_acople() {
        let r = ruta_temporal("guardar-acople");
        guardar_tamano(&r, 175).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.3 })).unwrap();
        assert_eq!(leer_tamano(&r), 175);
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Abajo, lugar: 0.3 }));
        guardar_tamano(&r, 125).unwrap();
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Abajo, lugar: 0.3 }));
        assert_eq!(leer_tamano(&r), 125);
        // Flotar guarda `"acople": null`, como dice la dirección (7.5)
        guardar_acople(&r, None).unwrap();
        assert_eq!(leer_acople(&r), None);
        assert_eq!(leer_tamano(&r), 125);
        let guardado: serde_json::Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["acople"], serde_json::Value::Null);
        // El lugar se guarda ya ajustado entre 0 y 1
        guardar_acople(&r, Some(Acople { borde: Borde::Arriba, lugar: 4.0 })).unwrap();
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Arriba, lugar: 1.0 }));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn guardar_el_acople_migra_el_tamano_de_texto_de_la_version_anterior() {
        let r = ruta_temporal("migrar-acople");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tamano":"muy grande"}"#).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Izquierda, lugar: 0.5 })).unwrap();
        let guardado: serde_json::Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["tamano"], serde_json::json!(200));
        assert_eq!(guardado["acople"], serde_json::json!({ "borde": "izquierda", "lugar": 0.5 }));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn la_posicion_flotante_se_guarda_entre_0_y_1_y_no_borra_lo_demas() {
        let r = ruta_temporal("flotante");
        // Sin archivo, ni posición ni monitor: el tablero arranca al medio del principal
        assert_eq!(leer_flotante(&r), None);
        assert_eq!(leer_monitor(&r), None);
        guardar_tamano(&r, 150).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.3 })).unwrap();
        guardar_flotante(&r, Flotante { x: 0.25, y: 0.8 }).unwrap();
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.25, y: 0.8 }));
        // Guardar la posición conserva el tamaño y el acople, y al revés
        assert_eq!(leer_tamano(&r), 150);
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Abajo, lugar: 0.3 }));
        guardar_tamano(&r, 175).unwrap();
        guardar_acople(&r, None).unwrap();
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.25, y: 0.8 }));
        // Fuera de 0..1 se topa; lo que no es número va al medio
        guardar_flotante(&r, Flotante { x: 3.0, y: -1.0 }).unwrap();
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 1.0, y: 0.0 }));
        fs::write(&r, r#"{"flotante":{"x":"no","y":0.4}}"#).unwrap();
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.5, y: 0.4 }));
        fs::write(&r, r#"{"flotante":null}"#).unwrap();
        assert_eq!(leer_flotante(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn el_monitor_se_guarda_como_un_punto_y_sobrevive_a_las_otras_preferencias() {
        let r = ruta_temporal("monitor");
        guardar_monitor(&r, (2880.0, 700.0)).unwrap();
        assert_eq!(leer_monitor(&r), Some((2880.0, 700.0)));
        guardar_tamano(&r, 125).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Arriba, lugar: 0.5 })).unwrap();
        guardar_flotante(&r, Flotante { x: 0.5, y: 0.5 }).unwrap();
        assert_eq!(leer_monitor(&r), Some((2880.0, 700.0)));
        // Un punto que no sirve no se guarda ni se lee
        assert!(guardar_monitor(&r, (f64::INFINITY, 0.0)).is_err());
        fs::write(&r, r#"{"monitor":{"x":"a","y":1}}"#).unwrap();
        assert_eq!(leer_monitor(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn el_menu_acoplar_a_marca_una_sola_opcion() {
        assert_eq!(eleccion_de_menu("acople:arriba"), Some(Some(Borde::Arriba)));
        assert_eq!(eleccion_de_menu("acople:derecha"), Some(Some(Borde::Derecha)));
        assert_eq!(eleccion_de_menu("acople:abajo"), Some(Some(Borde::Abajo)));
        assert_eq!(eleccion_de_menu("acople:izquierda"), Some(Some(Borde::Izquierda)));
        assert_eq!(eleccion_de_menu("acople:flotante"), Some(None));
        assert_eq!(eleccion_de_menu("acople:centro"), None);
        assert_eq!(eleccion_de_menu("tamano:agrandar"), None);
        // Orden del submenú: Arriba, Derecha, Abajo, Izquierda, Flotante
        assert_eq!(marcas_acople(Some(Borde::Arriba)), [true, false, false, false, false]);
        assert_eq!(marcas_acople(Some(Borde::Izquierda)), [false, false, false, true, false]);
        assert_eq!(marcas_acople(None), [false, false, false, false, true]);
        assert_eq!(IDS_ACOPLE, ["acople:arriba", "acople:derecha", "acople:abajo", "acople:izquierda", "acople:flotante"]);
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
