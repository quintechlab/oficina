//! Preferencias del widget que sobreviven entre usos: el tamaño elegido en la bandeja, el borde
//! donde está acoplada la muesca (docs/diseno/estilo-avis-ux.md, 7.5), la posición del tablero
//! flotante, el monitor de la última vez (9.7), la última revisión automática del mod (#17) y la
//! mascota de Claude (docs/diseno/mascotas-avi-ux.md 9.1), los interruptores de la configuración
//! (docs/diseno/configuracion-ux.md 9.1: `arriba`, `avisar`, `pausa`) y el motor, la carpeta y las
//! carpetas recientes de la charla (docs/diseno/chat-avis-ux.md 3.4).
//! Se guardan en `<carpeta de configuración de la app>/preferencias.json`. Nunca claves de API.

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

/// Lo que Rust escribe con forma propia: guardar una preferencia no borra las otras. Lo demás del
/// archivo (la mascota, los interruptores, una clave de otra entrega o de una versión más nueva) se
/// conserva tal cual (D9); `ajustes` pisa solo las claves que trae.
struct Preferencias {
    tamano: u32,
    acople: Option<Acople>,
    flotante: Option<Flotante>,
    monitor: Option<(f64, f64)>,
    revision_mod: Option<RevisionMod>,
    /// La charla con la mascota (chat-avis-ux.md 3.4): sin la clave, nada.
    chat: Option<Chat>,
    /// Claves sueltas de la configuración (`guardar_ajuste`), ya validadas.
    ajustes: Vec<(&'static str, Value)>,
}

/// Lo guardado, ya leído y migrado (el tamaño de texto de la 0.2 pasa a número).
fn leer_todo(ruta: &Path) -> Preferencias {
    Preferencias {
        tamano: leer_tamano(ruta),
        acople: leer_acople(ruta),
        flotante: leer_flotante(ruta),
        monitor: leer_monitor(ruta),
        revision_mod: leer_revision_mod(ruta),
        chat: leer_valor(ruta).and_then(|v| v.get("chat").map(chat_de_valor)),
        ajustes: Vec::new(),
    }
}

/// Escribe el archivo: parte de lo leído (si es un objeto) y pisa solo sus claves (D9 de
/// configuracion-ux.md 9.1). Así una clave que esta versión no conoce sobrevive a guardar el tamaño.
fn escribir(ruta: &Path, p: Preferencias) -> Result<(), String> {
    if let Some(carpeta) = ruta.parent() {
        std::fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    }
    let mut valor = match leer_valor(ruta) {
        Some(Value::Object(m)) => m,
        _ => serde_json::Map::new(),
    };
    let flotante = p.flotante.map_or(Value::Null, |f| json!({ "x": fraccion(Some(f.x)), "y": fraccion(Some(f.y)) }));
    let monitor = p.monitor.map_or(Value::Null, |(x, y)| json!({ "x": x, "y": y }));
    let revision_mod = p.revision_mod.map_or(Value::Null, |r| json!({ "revisado": r.revisado, "fallo": r.fallo }));
    valor.insert(String::from("tamano"), json!(p.tamano));
    valor.insert(String::from("acople"), valor_de_acople(p.acople));
    valor.insert(String::from("flotante"), flotante);
    valor.insert(String::from("monitor"), monitor);
    valor.insert(String::from("mod"), revision_mod);
    for (clave, v) in p.ajustes {
        valor.insert(String::from(clave), v);
    }
    if let Some(c) = p.chat {
        valor.insert(String::from("chat"), json!({ "motor": c.motor, "carpeta": c.carpeta, "recientes": c.recientes }));
    }
    std::fs::write(ruta, Value::Object(valor).to_string()).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ configuración (configuracion-ux.md 9.1)

/// Los interruptores de la pestaña Panel. De fábrica: siempre arriba, avisar con cada pregunta y las
/// animaciones andando. Antes de #23 no se guardaban: volvían a esto en cada arranque.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Interruptores {
    pub arriba: bool,
    pub avisar: bool,
    pub pausa: bool,
}

impl Default for Interruptores {
    fn default() -> Self {
        Interruptores { arriba: true, avisar: true, pausa: false }
    }
}

/// Los interruptores guardados. Ausente, de otro tipo o el archivo ilegible: el de fábrica.
pub fn leer_interruptores(ruta: &Path) -> Interruptores {
    let v = leer_valor(ruta);
    let leer = |clave: &str, defecto: bool| v.as_ref().and_then(|v| v.get(clave)?.as_bool()).unwrap_or(defecto);
    let f = Interruptores::default();
    Interruptores { arriba: leer("arriba", f.arriba), avisar: leer("avisar", f.avisar), pausa: leer("pausa", f.pausa) }
}

/// Las claves que escribe `guardar_ajuste` (el tamaño y el acople tienen sus comandos propios). Las
/// mismas que `validarAjuste` de configuracion.js; `motor` llega con el chat.
const AJUSTES: [&str; 4] = ["mascota", "arriba", "avisar", "pausa"];

/// ¿`valor` sirve para `clave`? La mascota, una de `ESPECIES` (texto exacto); los interruptores,
/// solo booleanos. Cualquier otra clave, no.
pub fn ajuste_valido(clave: &str, valor: &Value) -> bool {
    match clave {
        "mascota" => valor.as_str().is_some_and(|m| ESPECIES.contains(&m)),
        "arriba" | "avisar" | "pausa" => valor.is_boolean(),
        _ => false,
    }
}

/// Guarda un ajuste de la configuración y conserva lo demás. Uno inválido no toca el archivo.
pub fn guardar_ajuste(ruta: &Path, clave: &str, valor: &Value) -> Result<(), String> {
    let clave = AJUSTES
        .into_iter()
        .find(|c| *c == clave && ajuste_valido(c, valor))
        .ok_or_else(|| format!("ajuste inválido: {clave}"))?;
    escribir(ruta, Preferencias { ajustes: vec![(clave, valor.clone())], ..leer_todo(ruta) })
}

// ------------------------------------------------------------------ mascota (docs/diseno/mascotas-avi-ux.md 9.1)

/// Las especies de la mascota, en el orden de la dirección (`NOMBRES_ESPECIES` de especies.js).
pub const ESPECIES: [&str; 7] = ["avi", "ascua", "escarcha", "nodo", "bruma", "morro", "lumen"];

/// La mascota elegida para Claude. La escribe Configuración (#23); sin la clave, con basura o con un
/// valor desconocido (texto exacto), el Avi.
pub fn leer_mascota(ruta: &Path) -> String {
    leer_valor(ruta)
        .and_then(|v| v.get("mascota")?.as_str().map(String::from))
        .filter(|m| ESPECIES.contains(&m.as_str()))
        .unwrap_or_else(|| String::from(ESPECIES[0]))
}

fn leer_valor(ruta: &Path) -> Option<Value> {
    serde_json::from_str::<Value>(&std::fs::read_to_string(ruta).ok()?).ok()
}

// ------------------------------------------------------------------ la charla (docs/diseno/chat-avis-ux.md 3.4)

/// Cuántas carpetas recientes recuerda el menú de la charla.
pub const RECIENTES: usize = 5;

/// El motor y la carpeta de la próxima charla nueva (D11) y las últimas carpetas elegidas.
/// `carpeta: None` es "Solo Avis" (D9). Que la carpeta exista lo revisa quien la usa.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Chat {
    pub motor: Option<String>,
    pub carpeta: Option<String>,
    pub recientes: Vec<String>,
}

fn motor_valido(m: &str) -> bool {
    m == "claude" || m == "local"
}

fn chat_de_valor(v: &Value) -> Chat {
    Chat {
        motor: v.get("motor").and_then(Value::as_str).filter(|m| motor_valido(m)).map(String::from),
        carpeta: v.get("carpeta").and_then(Value::as_str).filter(|c| !c.is_empty()).map(String::from),
        recientes: v.get("recientes").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).filter(|c| !c.is_empty()).take(RECIENTES).map(String::from).collect()).unwrap_or_default(),
    }
}

/// Lo guardado de la charla. Sin archivo, sin la clave o con basura: nada.
pub fn leer_chat(ruta: &Path) -> Chat {
    leer_valor(ruta).and_then(|v| v.get("chat").map(chat_de_valor)).unwrap_or_default()
}

/// Las recientes con `carpeta` primera, sin repetir y con tope de `RECIENTES`.
pub fn con_reciente(recientes: &[String], carpeta: &str) -> Vec<String> {
    std::iter::once(carpeta.to_string()).chain(recientes.iter().filter(|r| r.as_str() != carpeta).cloned()).take(RECIENTES).collect()
}

/// Guarda el motor y la carpeta de la charla (la carpeta, también en las recientes) y conserva lo
/// demás. Devuelve lo guardado.
pub fn guardar_chat(ruta: &Path, motor: &str, carpeta: Option<&str>) -> Result<Chat, String> {
    if !motor_valido(motor) {
        return Err(format!("motor desconocido: {motor}"));
    }
    let todo = leer_todo(ruta);
    let antes = todo.chat.clone().unwrap_or_default();
    let carpeta = carpeta.filter(|c| !c.is_empty());
    let chat = Chat {
        motor: Some(motor.to_string()),
        carpeta: carpeta.map(String::from),
        recientes: carpeta.map_or(antes.recientes.clone(), |c| con_reciente(&antes.recientes, c)),
    };
    escribir(ruta, Preferencias { chat: Some(chat.clone()), ..todo })?;
    Ok(chat)
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

// ------------------------------------------------------------------ mod automático (#17)

/// La última revisión automática del mod que corrió un comando (instalar o actualizar): cuándo, en
/// milisegundos desde 1970, y si falló. Con eso se revisa una vez por día y no se insiste tras un error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RevisionMod {
    pub revisado: i64,
    pub fallo: bool,
}

/// La revisión guardada. Sin archivo, sin revisión o ilegible: ninguna (toca revisar).
pub fn leer_revision_mod(ruta: &Path) -> Option<RevisionMod> {
    let v = leer_valor(ruta)?;
    let m = v.get("mod")?;
    Some(RevisionMod { revisado: m.get("revisado")?.as_i64()?, fallo: m.get("fallo").and_then(Value::as_bool).unwrap_or(false) })
}

/// Guarda la revisión y conserva lo demás.
pub fn guardar_revision_mod(ruta: &Path, revision: RevisionMod) -> Result<(), String> {
    escribir(ruta, Preferencias { revision_mod: Some(revision), ..leer_todo(ruta) })
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
    /// En el orden de "Dónde vive" de la configuración y de `bordes_libres`.
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

/// El paso siguiente: `direccion` 1 agranda, -1 achica, 0 vuelve a 100 %. Se frena en las puntas.
pub fn paso(actual: u32, direccion: i32) -> u32 {
    if direccion == 0 {
        return PASO_POR_DEFECTO;
    }
    let i = PASOS.iter().position(|p| *p == actual).unwrap_or(0) as i32;
    let j = (i + direccion.signum()).clamp(0, PASOS.len() as i32 - 1);
    PASOS[j as usize]
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
    fn la_revision_del_mod_se_guarda_y_sobrevive_a_las_otras_preferencias() {
        let r = ruta_temporal("revision-mod");
        // Sin archivo: ninguna revisión (toca revisar)
        assert_eq!(leer_revision_mod(&r), None);
        guardar_tamano(&r, 150).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: true }).unwrap();
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_000_000_000, fallo: true }));
        assert_eq!(leer_tamano(&r), 150);
        // Guardar cualquier otra preferencia no la borra
        guardar_tamano(&r, 175).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.3 })).unwrap();
        guardar_flotante(&r, Flotante { x: 0.2, y: 0.4 }).unwrap();
        guardar_monitor(&r, (100.0, 200.0)).unwrap();
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_000_000_000, fallo: true }));
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_100_000_000, fallo: false }).unwrap();
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_100_000_000, fallo: false }));
        assert_eq!(leer_monitor(&r), Some((100.0, 200.0)));
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.2, y: 0.4 }));
        // Lo que no se entiende es como no haber revisado
        fs::write(&r, r#"{"mod":{"revisado":"ayer","fallo":false}}"#).unwrap();
        assert_eq!(leer_revision_mod(&r), None);
        fs::write(&r, r#"{"mod":{"revisado":1795000000000}}"#).unwrap();
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_000_000_000, fallo: false }));
        fs::write(&r, r#"{"mod":null}"#).unwrap();
        assert_eq!(leer_revision_mod(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn la_mascota_ausente_basura_o_desconocida_es_avi() {
        let r = ruta_temporal("mascota");
        // Sin archivo
        assert_eq!(leer_mascota(&r), "avi");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        for texto in [
            "no es json",
            r#"{"tamano":100}"#,
            r#"{"mascota":null}"#,
            r#"{"mascota":3}"#,
            r#"{"mascota":["nodo"]}"#,
            r#"{"mascota":"dragon"}"#,
            r#"{"mascota":"Ascua"}"#,
            r#"{"mascota":" nodo"}"#,
            r#"{"mascota":""}"#,
        ] {
            fs::write(&r, texto).unwrap();
            assert_eq!(leer_mascota(&r), "avi", "{texto}");
        }
        for especie in ESPECIES {
            fs::write(&r, format!(r#"{{"tamano":125,"mascota":"{especie}"}}"#)).unwrap();
            assert_eq!(leer_mascota(&r), especie);
        }
        assert_eq!(ESPECIES, ["avi", "ascua", "escarcha", "nodo", "bruma", "morro", "lumen"]);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn sin_archivo_la_charla_no_tiene_motor_ni_carpeta_ni_recientes() {
        let r = ruta_temporal("chat-defecto");
        assert_eq!(leer_chat(&r), Chat::default());
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        // Basura: un motor desconocido, recientes que no son texto y de más
        fs::write(&r, r#"{"chat":{"motor":"gpt","carpeta":7,"recientes":["a",3,"b","c","d","e","f","g"]}}"#).unwrap();
        assert_eq!(leer_chat(&r), Chat { motor: None, carpeta: None, recientes: ["a", "b", "c", "d", "e"].map(String::from).to_vec() });
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn la_carpeta_elegida_va_primera_en_las_recientes_sin_repetir_y_con_tope_5() {
        let lista: Vec<String> = ["a", "b", "c", "d", "e"].map(String::from).to_vec();
        assert_eq!(con_reciente(&lista, "c"), ["c", "a", "b", "d", "e"].map(String::from).to_vec());
        assert_eq!(con_reciente(&lista, "f"), ["f", "a", "b", "c", "d"].map(String::from).to_vec());
        assert_eq!(con_reciente(&[], "x"), vec![String::from("x")]);
    }

    #[test]
    fn guardar_la_charla_suma_la_carpeta_a_las_recientes_y_conserva_lo_demas() {
        let r = ruta_temporal("chat-guarda");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tamano":150,"mascota":"ascua"}"#).unwrap();
        let c = guardar_chat(&r, "claude", Some("C:\\uno")).unwrap();
        assert_eq!(c, Chat { motor: Some(String::from("claude")), carpeta: Some(String::from("C:\\uno")), recientes: vec![String::from("C:\\uno")] });
        guardar_chat(&r, "claude", Some("C:\\dos")).unwrap();
        // "Solo Avis" (sin carpeta) no toca las recientes
        let c = guardar_chat(&r, "claude", None).unwrap();
        assert_eq!(c.carpeta, None);
        assert_eq!(c.recientes, ["C:\\dos", "C:\\uno"].map(String::from).to_vec());
        // El motor local guarda el motor; un motor desconocido no se guarda
        assert_eq!(guardar_chat(&r, "local", None).unwrap().motor, Some(String::from("local")));
        assert!(guardar_chat(&r, "otro", None).is_err());
        assert_eq!(leer_tamano(&r), 150);
        assert_eq!(leer_mascota(&r), "ascua");
        // Guardar otra preferencia no borra la charla
        guardar_tamano(&r, 175).unwrap();
        guardar_acople(&r, None).unwrap();
        assert_eq!(leer_chat(&r).recientes, ["C:\\dos", "C:\\uno"].map(String::from).to_vec());
        assert_eq!(leer_chat(&r).motor, Some(String::from("local")));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn guardar_el_tamano_o_el_acople_no_borra_la_mascota() {
        let r = ruta_temporal("conserva-mascota");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        // La escribe Configuración (#23), o el usuario a mano: Rust solo la conserva
        fs::write(&r, r#"{"tamano":150,"mascota":"bruma"}"#).unwrap();
        guardar_tamano(&r, 175).unwrap();
        assert_eq!(leer_mascota(&r), "bruma");
        guardar_acople(&r, Some(Acople { borde: Borde::Arriba, lugar: 0.5 })).unwrap();
        assert_eq!(leer_mascota(&r), "bruma");
        guardar_acople(&r, None).unwrap();
        guardar_flotante(&r, Flotante { x: 0.2, y: 0.4 }).unwrap();
        guardar_monitor(&r, (100.0, 200.0)).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: false }).unwrap();
        assert_eq!(leer_mascota(&r), "bruma");
        assert_eq!(leer_tamano(&r), 175);
        // Un texto que esta versión no conoce (una especie futura) también se conserva tal cual
        fs::write(&r, r#"{"tamano":100,"mascota":"futura"}"#).unwrap();
        guardar_tamano(&r, 125).unwrap();
        let guardado: serde_json::Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["mascota"], serde_json::json!("futura"));
        assert_eq!(leer_mascota(&r), "avi");
        // Sin mascota guardada, guardar otra cosa no la inventa
        fs::write(&r, r#"{"tamano":100}"#).unwrap();
        guardar_tamano(&r, 150).unwrap();
        let guardado: serde_json::Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado.get("mascota"), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    // ------------------------------------------------------------------ configuración (#23, configuracion-ux.md 9.1)

    #[test]
    fn los_interruptores_ausentes_o_con_basura_son_los_de_fabrica() {
        let r = ruta_temporal("interruptores");
        let fabrica = Interruptores { arriba: true, avisar: true, pausa: false };
        // Sin archivo
        assert_eq!(leer_interruptores(&r), fabrica);
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        for texto in [
            "no es json",
            r#"{"tamano":100}"#,
            r#"{"arriba":null,"avisar":"no","pausa":1}"#,
            r#"{"arriba":"false","avisar":[false],"pausa":"true"}"#,
            "[true]",
        ] {
            fs::write(&r, texto).unwrap();
            assert_eq!(leer_interruptores(&r), fabrica, "{texto}");
        }
        fs::write(&r, r#"{"arriba":false,"avisar":false,"pausa":true}"#).unwrap();
        assert_eq!(leer_interruptores(&r), Interruptores { arriba: false, avisar: false, pausa: true });
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn ajuste_valido_acepta_solo_las_claves_y_los_tipos_de_la_direccion() {
        for clave in ["arriba", "avisar", "pausa"] {
            assert!(ajuste_valido(clave, &json!(true)), "{clave}");
            assert!(ajuste_valido(clave, &json!(false)), "{clave}");
            for malo in [json!("true"), json!(1), Value::Null, json!({})] {
                assert!(!ajuste_valido(clave, &malo), "{clave} {malo}");
            }
        }
        for especie in ESPECIES {
            assert!(ajuste_valido("mascota", &json!(especie)), "{especie}");
        }
        for malo in [json!("Ascua"), json!(""), Value::Null, json!("dragon"), json!(3)] {
            assert!(!ajuste_valido("mascota", &malo), "{malo}");
        }
        // Claves desconocidas o que tienen su propio comando: rechazadas
        for clave in ["tamano", "acople", "mod", "clave", "anthropic", ""] {
            assert!(!ajuste_valido(clave, &json!(true)), "{clave}");
        }
    }

    #[test]
    fn guardar_un_ajuste_lo_persiste_y_uno_invalido_no_toca_el_archivo() {
        let r = ruta_temporal("guardar-ajuste");
        guardar_ajuste(&r, "arriba", &json!(false)).unwrap();
        guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
        assert_eq!(leer_interruptores(&r), Interruptores { arriba: false, avisar: true, pausa: true });
        guardar_ajuste(&r, "avisar", &json!(false)).unwrap();
        guardar_ajuste(&r, "mascota", &json!("nodo")).unwrap();
        assert_eq!(leer_interruptores(&r), Interruptores { arriba: false, avisar: false, pausa: true });
        assert_eq!(leer_mascota(&r), "nodo");
        let antes = fs::read_to_string(&r).unwrap();
        assert!(guardar_ajuste(&r, "arriba", &json!("si")).is_err());
        assert!(guardar_ajuste(&r, "tamano", &json!(200)).is_err());
        assert_eq!(fs::read_to_string(&r).unwrap(), antes);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn guardar_el_tamano_el_acople_o_la_revision_del_mod_no_borra_los_ajustes() {
        let r = ruta_temporal("conserva-ajustes");
        guardar_ajuste(&r, "arriba", &json!(false)).unwrap();
        guardar_ajuste(&r, "avisar", &json!(false)).unwrap();
        guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
        guardar_ajuste(&r, "mascota", &json!("bruma")).unwrap();
        guardar_tamano(&r, 175).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Derecha, lugar: 0.2 })).unwrap();
        guardar_acople(&r, None).unwrap();
        guardar_flotante(&r, Flotante { x: 0.1, y: 0.9 }).unwrap();
        guardar_monitor(&r, (10.0, 20.0)).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: false }).unwrap();
        assert_eq!(leer_interruptores(&r), Interruptores { arriba: false, avisar: false, pausa: true });
        assert_eq!(leer_mascota(&r), "bruma");
        assert_eq!(leer_tamano(&r), 175);
        // Y guardar un ajuste no borra lo demás
        guardar_ajuste(&r, "pausa", &json!(false)).unwrap();
        assert_eq!(leer_tamano(&r), 175);
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.1, y: 0.9 }));
        assert_eq!(leer_monitor(&r), Some((10.0, 20.0)));
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_000_000_000, fallo: false }));
        assert_eq!(leer_acople(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn una_clave_desconocida_sobrevive_a_guardar_el_tamano() {
        // D9: `escribir` parte de lo leído y pisa solo sus claves (otra entrega o una versión más nueva)
        let r = ruta_temporal("desconocida");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tamano":100,"motor":"local","futura":{"a":[1,2]},"arriba":"basura"}"#).unwrap();
        guardar_tamano(&r, 150).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.5 })).unwrap();
        guardar_ajuste(&r, "avisar", &json!(false)).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["motor"], json!("local"));
        assert_eq!(guardado["futura"], json!({ "a": [1, 2] }));
        // Lo que no se entiende se conserva tal cual, y se lee como el de fábrica
        assert_eq!(guardado["arriba"], json!("basura"));
        assert!(leer_interruptores(&r).arriba);
        assert_eq!(guardado["tamano"], json!(150));
        assert_eq!(guardado["avisar"], json!(false));
        // Un archivo que no es un objeto se reemplaza entero
        fs::write(&r, "[1,2,3]").unwrap();
        guardar_tamano(&r, 125).unwrap();
        assert_eq!(leer_tamano(&r), 125);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn los_bordes_se_nombran_y_se_leen_en_el_orden_de_donde_vive() {
        // El orden de "Dónde vive" de la configuración (después de Flota): Arriba, Derecha, Abajo, Izquierda
        assert_eq!(Borde::TODOS.map(Borde::nombre), ["arriba", "derecha", "abajo", "izquierda"]);
        for b in Borde::TODOS {
            assert_eq!(Borde::desde(b.nombre()), Some(b));
        }
        assert_eq!(Borde::desde("centro"), None);
        assert_eq!(Borde::desde("flotante"), None);
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
