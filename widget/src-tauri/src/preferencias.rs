//! Preferencias del widget que sobreviven entre usos: el borde donde está acoplada la muesca
//! (docs/diseno/estilo-avis-ux.md, 7.5), la posición del tablero
//! flotante, el monitor de la última vez (9.7), la última revisión automática del mod (#17) y la
//! mascota de Claude (docs/diseno/mascotas-avi-ux.md 9.1), los interruptores de la configuración
//! (docs/diseno/configuracion-ux.md 9.1: `arriba`, `avisar`, `pausa`) y el motor, la carpeta y las
//! carpetas recientes de la charla (docs/diseno/chat-avis-ux.md 3.4).
//! Se guardan en `<carpeta de configuración de la app>/preferencias.json`. Nunca claves de API.
//! El panel va siempre al 100 % (#47): la clave `tamano` de las versiones con zoom queda sin uso; no
//! se lee ni se escribe, y `escribir` la conserva tal cual, como cualquier clave que no conoce (D9).

use std::path::Path;

use serde_json::{json, Value};

use crate::chat;

/// Lo que Rust escribe con forma propia: guardar una preferencia no borra las otras. Lo demás del
/// archivo (la mascota, los interruptores, una clave de otra entrega o de una versión más nueva) se
/// conserva tal cual (D9); `ajustes` pisa solo las claves que trae.
struct Preferencias {
    acople: Option<Acople>,
    flotante: Option<Flotante>,
    monitor: Option<(f64, f64)>,
    revision_mod: Option<RevisionMod>,
    /// La charla con la mascota (chat-avis-ux.md 3.4): sin la clave, nada.
    chat: Option<Chat>,
    /// Claves sueltas de la configuración (`guardar_ajuste`), ya validadas.
    ajustes: Vec<(&'static str, Value)>,
}

/// Lo guardado, ya leído.
fn leer_todo(ruta: &Path) -> Preferencias {
    Preferencias {
        acople: leer_acople(ruta),
        flotante: leer_flotante(ruta),
        monitor: leer_monitor(ruta),
        revision_mod: leer_revision_mod(ruta),
        chat: leer_valor(ruta).and_then(|v| v.get("chat").map(chat_de_valor)),
        ajustes: Vec::new(),
    }
}

/// Escribe el archivo: parte de lo leído (si es un objeto) y pisa solo sus claves (D9 de
/// configuracion-ux.md 9.1). Así una clave que esta versión no conoce sobrevive a guardar el acople.
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
    valor.insert(String::from("acople"), valor_de_acople(p.acople));
    valor.insert(String::from("flotante"), flotante);
    valor.insert(String::from("monitor"), monitor);
    valor.insert(String::from("mod"), revision_mod);
    for (clave, v) in p.ajustes {
        valor.insert(String::from(clave), v);
    }
    if let Some(c) = p.chat {
        valor.insert(String::from("chat"), json!({ "motor": c.motor, "carpeta": c.carpeta, "recientes": c.recientes, "modelo": c.modelo }));
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

/// Las claves que escribe `guardar_ajuste` (el acople tiene su comando propio; `tamano`, ninguno: #47). Los nombres (#37) son
/// `nombreMascota` y `nombreUsuario`. Las
/// mismas que `validarAjuste` de configuracion.js; `motor` llega con el chat. `tareasAvisado` es el
/// día del aviso diario de tareas (tareas-ux.md 11.4) y se guarda adentro de `"tareas"`.
/// `habitosRecordados` son los hábitos ya recordados hoy (habitos-ux.md 8.3 y 11.5), `habitosResumen` el
/// lunes de la semana del último resumen semanal que se vio y `habitosFrase` la frase de esa semana
/// (`{ lunes, frase }`, 8.4: se pide como mucho una vez por semana), las tres tal cual.
const AJUSTES: [&str; 10] = ["mascota", "arriba", "avisar", "pausa", "nombreMascota", "nombreUsuario", "tareasAvisado", "habitosRecordados", "habitosResumen", "habitosFrase"];

/// La frase de la semana como mucho (habitos-ux.md 8.4, `MAX_FRASE` de habitos.js).
const MAX_FRASE: usize = 160;

/// Cuántos hábitos recordados se guardan como mucho (habitos-ux.md 11.5; `MAX_RECORDADOS` de habitos.js).
const MAX_RECORDADOS: usize = 100;

/// ¿`valor` sirve para `clave`? La mascota, una de `ESPECIES` (texto exacto); los interruptores,
/// solo booleanos; el aviso de tareas, un día que existe `AAAA-MM-DD` o vacío; los hábitos recordados,
/// `{ dia, ids }` (`recordados_validos`); el resumen de hábitos, un lunes que existe o vacío; los nombres (#37),
/// texto que sirva para `nombre_valido`. Cualquier otra clave, no.
pub fn ajuste_valido(clave: &str, valor: &Value) -> bool {
    match clave {
        "mascota" => valor.as_str().is_some_and(|m| ESPECIES.contains(&m)),
        "arriba" | "avisar" | "pausa" => valor.is_boolean(),
        "tareasAvisado" => valor.as_str().is_some_and(|d| d.is_empty() || dia_valido(d)),
        "habitosRecordados" => recordados_validos(valor),
        "habitosResumen" => valor.as_str().is_some_and(|d| d.is_empty() || lunes_valido(d)),
        "habitosFrase" => frase_semana_valida(valor),
        "nombreMascota" | "nombreUsuario" => valor.as_str().is_some_and(nombre_valido),
        _ => false,
    }
}

/// ¿`AAAA-MM-DD` de un día que existe? Solo dígitos y los dos guiones (sin hora ni signo).
fn dia_valido(d: &str) -> bool {
    let b = d.as_bytes();
    b.len() == 10
        && b.iter().enumerate().all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
        && chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok()
}

/// ¿Un día que existe y es lunes? (el de `habitosResumen`, habitos-ux.md 8.4: la semana va de lunes a domingo)
fn lunes_valido(d: &str) -> bool {
    dia_valido(d) && chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok_and(|f| chrono::Datelike::weekday(&f) == chrono::Weekday::Mon)
}

/// La frase de la semana (habitos-ux.md 8.4): un objeto con solo `lunes` (un lunes que existe) y `frase`
/// (una línea de 0 a 160 caracteres; "" si el pedido falló y va la plantilla). Así, entre arranques, el
/// modelo se usa como mucho una vez por semana.
fn frase_semana_valida(valor: &Value) -> bool {
    let Some(o) = valor.as_object() else { return false };
    let lunes = o.get("lunes").and_then(Value::as_str).is_some_and(lunes_valido);
    let frase = o.get("frase").and_then(Value::as_str).is_some_and(|f| !f.contains(['\n', '\r']) && f.chars().count() <= MAX_FRASE);
    o.len() == 2 && lunes && frase
}

/// Los hábitos recordados (habitos-ux.md 11.5): un objeto con solo `dia` (un día que existe) e `ids`
/// (hasta 100 ids de hábito válidos, `habitos::id_valido`). Así un reinicio el mismo día no repite el
/// recordatorio (8.3).
fn recordados_validos(valor: &Value) -> bool {
    let Some(o) = valor.as_object() else { return false };
    let dia = o.get("dia").and_then(Value::as_str).is_some_and(dia_valido);
    let ids = o.get("ids").and_then(Value::as_array).is_some_and(|ids| {
        ids.len() <= MAX_RECORDADOS && ids.iter().all(|id| id.as_str().is_some_and(crate::habitos::id_valido))
    });
    o.len() == 2 && dia && ids
}

/// Un nombre de la configuración (#37 S4): hasta 40 caracteres sin contar los espacios de los
/// bordes y sin caracteres de control. Vacío sirve: es "el de siempre".
pub fn nombre_valido(n: &str) -> bool {
    n.trim().chars().count() <= 40 && !n.chars().any(char::is_control)
}

/// Los nombres de la configuración (#37), sin espacios de más; vacío si no hay o no sirve.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Nombres {
    pub mascota: String,
    pub usuario: String,
}

pub fn leer_nombres(ruta: &Path) -> Nombres {
    let v = leer_valor(ruta);
    let leer = |clave: &str| {
        v.as_ref()
            .and_then(|v| v.get(clave)?.as_str())
            .filter(|n| nombre_valido(n))
            .map(|n| n.trim().to_string())
            .unwrap_or_default()
    };
    Nombres { mascota: leer("nombreMascota"), usuario: leer("nombreUsuario") }
}

/// Guarda un ajuste de la configuración y conserva lo demás. Uno inválido no toca el archivo. El aviso
/// de tareas va a `"tareas": { "avisado" }` (11.4), conservando lo demás que haya en `"tareas"`.
pub fn guardar_ajuste(ruta: &Path, clave: &str, valor: &Value) -> Result<(), String> {
    let clave = AJUSTES
        .into_iter()
        .find(|c| *c == clave && ajuste_valido(c, valor))
        .ok_or_else(|| format!("ajuste inválido: {clave}"))?;
    let ajuste = if clave == "tareasAvisado" {
        let mut tareas = match leer_valor(ruta).and_then(|v| v.get("tareas").cloned()) {
            Some(Value::Object(m)) => m,
            _ => serde_json::Map::new(),
        };
        tareas.insert(String::from("avisado"), valor.clone());
        ("tareas", Value::Object(tareas))
    } else {
        (clave, valor.clone())
    };
    escribir(ruta, Preferencias { ajustes: vec![ajuste], ..leer_todo(ruta) })
}

/// Los hábitos ya recordados (`habitosRecordados`, habitos-ux.md 8.3), o `None` si no hay o no sirven
/// (lo escrito a mano que no pasa `recordados_validos` se lee como nada recordado).
pub fn leer_habitos_recordados(ruta: &Path) -> Option<Value> {
    leer_valor(ruta).and_then(|v| v.get("habitosRecordados").cloned()).filter(recordados_validos)
}

/// El lunes de la semana del último resumen semanal visto (`habitosResumen`, habitos-ux.md 8.4), o `None`
/// si no hay, está vacío o no es un lunes que existe (lo escrito a mano que no sirve se lee como nunca visto).
pub fn leer_habitos_resumen(ruta: &Path) -> Option<String> {
    leer_valor(ruta)
        .and_then(|v| v.get("habitosResumen")?.as_str().map(String::from))
        .filter(|d| lunes_valido(d))
}

/// La frase guardada de la semana (`habitosFrase`, habitos-ux.md 8.4), o `None` si no hay o no sirve.
pub fn leer_habitos_frase(ruta: &Path) -> Option<Value> {
    leer_valor(ruta).and_then(|v| v.get("habitosFrase").cloned()).filter(frase_semana_valida)
}

/// El día del último aviso diario de tareas (`tareas.avisado`, 11.4). Sin archivo, sin la clave,
/// vacío o algo que no es un día: `None` (nunca avisado).
pub fn leer_tareas_avisado(ruta: &Path) -> Option<String> {
    leer_valor(ruta)
        .and_then(|v| v.get("tareas")?.get("avisado")?.as_str().map(String::from))
        .filter(|d| dia_valido(d))
}

// ------------------------------------------------------------------ mascota (docs/diseno/mascotas-avi-ux.md 9.1)

/// Las especies de la mascota, en el orden de la dirección (`NOMBRES_ESPECIES` de especies.js).
pub const ESPECIES: [&str; 8] = ["avi", "ascua", "escarcha", "nodo", "bruma", "morro", "lumen", "nimbo"];

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

/// El motor, la carpeta y el modelo de la próxima charla nueva (D11 y #35) y las últimas carpetas
/// elegidas. `carpeta: None` es "Solo Avis" (D9); `modelo: None`, "Por defecto" (uno de
/// `chat::MODELOS` si no). Que la carpeta exista lo revisa quien la usa.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Chat {
    pub motor: Option<String>,
    pub carpeta: Option<String>,
    pub recientes: Vec<String>,
    pub modelo: Option<String>,
}

fn motor_valido(m: &str) -> bool {
    m == "claude" || m == "local"
}

fn chat_de_valor(v: &Value) -> Chat {
    Chat {
        motor: v.get("motor").and_then(Value::as_str).filter(|m| motor_valido(m)).map(String::from),
        carpeta: v.get("carpeta").and_then(Value::as_str).filter(|c| !c.is_empty()).map(String::from),
        recientes: v.get("recientes").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).filter(|c| !c.is_empty()).take(RECIENTES).map(String::from).collect()).unwrap_or_default(),
        // Un modelo desconocido se lee como "Por defecto"
        modelo: v.get("modelo").and_then(Value::as_str).filter(|m| chat::modelo_valido(m)).map(String::from),
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

/// Guarda el motor, la carpeta y el modelo de la charla (la carpeta, también en las recientes) y
/// conserva lo demás. El modelo se guarda tal cual llega: `None` es "Por defecto". Devuelve lo guardado.
pub fn guardar_chat(ruta: &Path, motor: &str, carpeta: Option<&str>, modelo: Option<&str>) -> Result<Chat, String> {
    if !motor_valido(motor) {
        return Err(format!("motor desconocido: {motor}"));
    }
    if modelo.is_some_and(|m| !chat::modelo_valido(m)) {
        return Err(String::from("modelo desconocido"));
    }
    let todo = leer_todo(ruta);
    let antes = todo.chat.clone().unwrap_or_default();
    let carpeta = carpeta.filter(|c| !c.is_empty());
    let chat = Chat {
        motor: Some(motor.to_string()),
        carpeta: carpeta.map(String::from),
        recientes: carpeta.map_or(antes.recientes.clone(), |c| con_reciente(&antes.recientes, c)),
        modelo: modelo.map(String::from),
    };
    escribir(ruta, Preferencias { chat: Some(chat.clone()), ..todo })?;
    Ok(chat)
}

// ------------------------------------------------------------------ ventana única (estilo-avis-ux.md 9.7)

/// Posición del tablero flotante adentro del área de trabajo: la fracción del lugar libre (0 arriba
/// a la izquierda, 1 abajo a la derecha; `fraccionFlotante` de `tamano.js`). Así vuelve adentro del
/// área aunque cambie el monitor, la barra de tareas o el tamaño del tablero. Reemplaza a lo que
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

/// Guarda el acople (`None`: flota) y conserva lo demás.
pub fn guardar_acople(ruta: &Path, acople: Option<Acople>) -> Result<(), String> {
    escribir(ruta, Preferencias { acople, ..leer_todo(ruta) })
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
    fn un_tamano_viejo_no_rompe_la_lectura_y_queda_sin_uso() {
        // #47 (S2): el panel va siempre al 100 %; el `tamano` de antes (125–200, "grande", "muy
        // grande" o basura) no cambia nada de lo que se lee y escribir lo conserva tal cual (D9)
        for viejo in [json!(125), json!(200), json!("grande"), json!("muy grande"), json!("basura"), json!([1])] {
            let r = ruta_temporal("tamano-viejo");
            fs::create_dir_all(r.parent().unwrap()).unwrap();
            let texto = json!({
                "tamano": viejo, "mascota": "ascua", "arriba": false,
                "acople": { "borde": "arriba", "lugar": 0.42 }, "flotante": { "x": 0.25, "y": 0.8 },
            });
            fs::write(&r, texto.to_string()).unwrap();
            assert_eq!(leer_mascota(&r), "ascua", "{viejo}");
            assert!(!leer_interruptores(&r).arriba, "{viejo}");
            assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Arriba, lugar: 0.42 }), "{viejo}");
            assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.25, y: 0.8 }), "{viejo}");
            guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
            guardar_acople(&r, None).unwrap();
            guardar_monitor(&r, (10.0, 20.0)).unwrap();
            let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
            assert_eq!(guardado["tamano"], viejo, "{viejo}");
            assert_eq!(leer_mascota(&r), "ascua", "{viejo}");
            assert!(leer_interruptores(&r).pausa, "{viejo}");
            fs::remove_dir_all(r.parent().unwrap()).unwrap();
        }
    }

    #[test]
    fn guardar_no_agrega_un_tamano() {
        // #47: sin zoom, ninguna preferencia escribe `tamano`
        let r = ruta_temporal("sin-tamano");
        guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.3 })).unwrap();
        guardar_flotante(&r, Flotante { x: 0.5, y: 0.5 }).unwrap();
        guardar_monitor(&r, (10.0, 20.0)).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: false }).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado.get("tamano"), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn un_archivo_viejo_sin_acople_flota() {
        let r = ruta_temporal("viejo");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        // Archivos de la 0.3: solo el tamaño (número o texto de la 0.2)
        fs::write(&r, r#"{"tamano":150}"#).unwrap();
        assert_eq!(leer_acople(&r), None);
        fs::write(&r, r#"{"tamano":"grande"}"#).unwrap();
        assert_eq!(leer_acople(&r), None);
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
    fn guardar_el_acople_conserva_el_monitor_y_guardar_el_monitor_conserva_el_acople() {
        let r = ruta_temporal("guardar-acople");
        guardar_monitor(&r, (175.0, 0.0)).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.3 })).unwrap();
        assert_eq!(leer_monitor(&r), Some((175.0, 0.0)));
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Abajo, lugar: 0.3 }));
        guardar_monitor(&r, (125.0, 0.0)).unwrap();
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Abajo, lugar: 0.3 }));
        assert_eq!(leer_monitor(&r), Some((125.0, 0.0)));
        // Flotar guarda `"acople": null`, como dice la dirección (7.5)
        guardar_acople(&r, None).unwrap();
        assert_eq!(leer_acople(&r), None);
        assert_eq!(leer_monitor(&r), Some((125.0, 0.0)));
        let guardado: serde_json::Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["acople"], serde_json::Value::Null);
        // El lugar se guarda ya ajustado entre 0 y 1
        guardar_acople(&r, Some(Acople { borde: Borde::Arriba, lugar: 4.0 })).unwrap();
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Arriba, lugar: 1.0 }));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn la_posicion_flotante_se_guarda_entre_0_y_1_y_no_borra_lo_demas() {
        let r = ruta_temporal("flotante");
        // Sin archivo, ni posición ni monitor: el tablero arranca al medio del principal
        assert_eq!(leer_flotante(&r), None);
        assert_eq!(leer_monitor(&r), None);
        guardar_monitor(&r, (150.0, 0.0)).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.3 })).unwrap();
        guardar_flotante(&r, Flotante { x: 0.25, y: 0.8 }).unwrap();
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.25, y: 0.8 }));
        // Guardar la posición conserva el monitor y el acople, y al revés
        assert_eq!(leer_monitor(&r), Some((150.0, 0.0)));
        assert_eq!(leer_acople(&r), Some(Acople { borde: Borde::Abajo, lugar: 0.3 }));
        guardar_monitor(&r, (175.0, 0.0)).unwrap();
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
        guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
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
        guardar_monitor(&r, (150.0, 0.0)).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: true }).unwrap();
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_000_000_000, fallo: true }));
        assert_eq!(leer_monitor(&r), Some((150.0, 0.0)));
        // Guardar cualquier otra preferencia no la borra
        guardar_monitor(&r, (175.0, 0.0)).unwrap();
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
        assert_eq!(ESPECIES, ["avi", "ascua", "escarcha", "nodo", "bruma", "morro", "lumen", "nimbo"]);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn sin_archivo_la_charla_no_tiene_motor_ni_carpeta_ni_recientes() {
        let r = ruta_temporal("chat-defecto");
        assert_eq!(leer_chat(&r), Chat::default());
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        // Basura: un motor desconocido, recientes que no son texto y de más
        fs::write(&r, r#"{"chat":{"motor":"gpt","carpeta":7,"recientes":["a",3,"b","c","d","e","f","g"]}}"#).unwrap();
        assert_eq!(leer_chat(&r), Chat { motor: None, carpeta: None, recientes: ["a", "b", "c", "d", "e"].map(String::from).to_vec(), modelo: None });
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
        let c = guardar_chat(&r, "claude", Some("C:\\uno"), None).unwrap();
        assert_eq!(c, Chat { motor: Some(String::from("claude")), carpeta: Some(String::from("C:\\uno")), recientes: vec![String::from("C:\\uno")], modelo: None });
        guardar_chat(&r, "claude", Some("C:\\dos"), None).unwrap();
        // "Solo Avis" (sin carpeta) no toca las recientes
        let c = guardar_chat(&r, "claude", None, None).unwrap();
        assert_eq!(c.carpeta, None);
        assert_eq!(c.recientes, ["C:\\dos", "C:\\uno"].map(String::from).to_vec());
        // El motor local guarda el motor; un motor desconocido no se guarda
        assert_eq!(guardar_chat(&r, "local", None, None).unwrap().motor, Some(String::from("local")));
        assert!(guardar_chat(&r, "otro", None, None).is_err());
        assert_eq!(leer_valor(&r).unwrap()["tamano"], json!(150));
        assert_eq!(leer_mascota(&r), "ascua");
        // Guardar otra preferencia no borra la charla
        guardar_monitor(&r, (175.0, 0.0)).unwrap();
        guardar_acople(&r, None).unwrap();
        assert_eq!(leer_chat(&r).recientes, ["C:\\dos", "C:\\uno"].map(String::from).to_vec());
        assert_eq!(leer_chat(&r).motor, Some(String::from("local")));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn el_modelo_de_las_charlas_nuevas_se_guarda_tal_cual_llega() {
        // #35 (S2): uno de los cuatro alias, o ninguno ("Por defecto")
        let r = ruta_temporal("chat-modelo");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tamano":150,"otra":{"de":"una version nueva"}}"#).unwrap();
        for m in crate::chat::MODELOS {
            assert_eq!(guardar_chat(&r, "claude", None, Some(m)).unwrap().modelo.as_deref(), Some(m));
            assert_eq!(leer_chat(&r).modelo.as_deref(), Some(m));
        }
        // Guardar sin modelo es "Por defecto", aunque antes hubiera uno
        assert_eq!(guardar_chat(&r, "claude", Some("C:\\uno"), None).unwrap().modelo, None);
        assert_eq!(leer_chat(&r).modelo, None);
        // Uno desconocido no se guarda ni toca el archivo
        guardar_chat(&r, "claude", None, Some("sonnet")).unwrap();
        let antes = fs::read_to_string(&r).unwrap();
        for malo in ["gpt", "Sonnet", "", "claude-opus-4"] {
            assert_eq!(guardar_chat(&r, "claude", None, Some(malo)), Err(String::from("modelo desconocido")), "{malo:?}");
        }
        assert_eq!(fs::read_to_string(&r).unwrap(), antes);
        // Las claves que esta versión no conoce siguen ahí
        assert!(antes.contains("una version nueva"));
        assert_eq!(leer_valor(&r).unwrap()["tamano"], json!(150));
        // Guardado a mano con basura: "Por defecto"
        for texto in [r#"{"chat":{"motor":"claude","modelo":"gpt"}}"#, r#"{"chat":{"motor":"claude","modelo":3}}"#, r#"{"chat":{"motor":"claude"}}"#] {
            fs::write(&r, texto).unwrap();
            assert_eq!(leer_chat(&r).modelo, None, "{texto}");
            assert_eq!(leer_chat(&r).motor.as_deref(), Some("claude"));
        }
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn guardar_el_monitor_o_el_acople_no_borra_la_mascota() {
        let r = ruta_temporal("conserva-mascota");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        // La escribe Configuración (#23), o el usuario a mano: Rust solo la conserva
        fs::write(&r, r#"{"tamano":150,"mascota":"bruma"}"#).unwrap();
        guardar_monitor(&r, (175.0, 0.0)).unwrap();
        assert_eq!(leer_mascota(&r), "bruma");
        guardar_acople(&r, Some(Acople { borde: Borde::Arriba, lugar: 0.5 })).unwrap();
        assert_eq!(leer_mascota(&r), "bruma");
        guardar_acople(&r, None).unwrap();
        guardar_flotante(&r, Flotante { x: 0.2, y: 0.4 }).unwrap();
        guardar_monitor(&r, (100.0, 200.0)).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: false }).unwrap();
        assert_eq!(leer_mascota(&r), "bruma");
        // Un texto que esta versión no conoce (una especie futura) también se conserva tal cual
        fs::write(&r, r#"{"tamano":100,"mascota":"futura"}"#).unwrap();
        guardar_monitor(&r, (125.0, 0.0)).unwrap();
        let guardado: serde_json::Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["mascota"], serde_json::json!("futura"));
        assert_eq!(leer_mascota(&r), "avi");
        // Sin mascota guardada, guardar otra cosa no la inventa
        fs::write(&r, r#"{"tamano":100}"#).unwrap();
        guardar_monitor(&r, (150.0, 0.0)).unwrap();
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
    fn el_aviso_de_tareas_acepta_un_dia_que_existe_o_vacio() {
        // tareas-ux.md 11.4: el día de Argentina en que se vio el globo, "AAAA-MM-DD"
        for bueno in ["2026-11-24", "2024-02-29", ""] {
            assert!(ajuste_valido("tareasAvisado", &json!(bueno)), "{bueno}");
        }
        for malo in [
            json!("2026-02-30"), json!("2025-02-29"), json!("2026-13-01"), json!("2026-11-24T10:00"), json!("2026-11-24 10:00"),
            json!("2026-1-05"), json!("+026-11-24"), json!("24/11/2026"), json!(20261124), json!(true), Value::Null, json!({}),
        ] {
            assert!(!ajuste_valido("tareasAvisado", &malo), "{malo}");
        }
    }

    #[test]
    fn los_nombres_aceptan_texto_corto_sin_caracteres_de_control() {
        // #37 S4: hasta 40 caracteres; vacío es "el de siempre"
        for clave in ["nombreMascota", "nombreUsuario"] {
            for bueno in [json!("Pancho"), json!(""), json!("María José"), json!("x".repeat(40)), json!("  Nico  ")] {
                assert!(ajuste_valido(clave, &bueno), "{clave} {bueno}");
            }
            for malo in [json!("x".repeat(41)), json!("a\nb"), json!("a\tb"), json!(3), Value::Null, json!(true), json!(["Nico"])] {
                assert!(!ajuste_valido(clave, &malo), "{clave} {malo}");
            }
        }
    }

    #[test]
    fn el_aviso_de_tareas_se_guarda_en_tareas_avisado_sin_borrar_lo_demas() {
        let r = ruta_temporal("tareas-avisado");
        assert_eq!(leer_tareas_avisado(&r), None);
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tareas":{"futura":3},"otra":[1]}"#).unwrap();
        guardar_ajuste(&r, "arriba", &json!(false)).unwrap();
        guardar_ajuste(&r, "mascota", &json!("lumen")).unwrap();
        guardar_monitor(&r, (150.0, 0.0)).unwrap();
        guardar_ajuste(&r, "tareasAvisado", &json!("2026-11-24")).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        // Dentro de "tareas" (11.4), sin pisar lo que esa clave ya traía ni lo demás del archivo
        assert_eq!(guardado["tareas"], json!({ "avisado": "2026-11-24", "futura": 3 }));
        assert!(guardado.get("tareasAvisado").is_none());
        assert_eq!(guardado["otra"], json!([1]));
        assert_eq!(leer_tareas_avisado(&r).as_deref(), Some("2026-11-24"));
        assert!(!leer_interruptores(&r).arriba);
        assert_eq!(leer_mascota(&r), "lumen");
        assert_eq!(leer_monitor(&r), Some((150.0, 0.0)));
        // Y guardar otra cosa después no lo borra
        guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
        guardar_monitor(&r, (100.0, 0.0)).unwrap();
        assert_eq!(leer_tareas_avisado(&r).as_deref(), Some("2026-11-24"));
        // Uno inválido no toca el archivo
        let antes = fs::read_to_string(&r).unwrap();
        assert!(guardar_ajuste(&r, "tareasAvisado", &json!("2026-02-30")).is_err());
        assert_eq!(fs::read_to_string(&r).unwrap(), antes);
        // Vacío: nunca avisado
        guardar_ajuste(&r, "tareasAvisado", &json!("")).unwrap();
        assert_eq!(leer_tareas_avisado(&r), None);
        // Lo guardado a mano que no es un día se lee como nunca avisado
        fs::write(&r, r#"{"tareas":{"avisado":"ayer"}}"#).unwrap();
        assert_eq!(leer_tareas_avisado(&r), None);
        fs::write(&r, r#"{"tareas":"basura"}"#).unwrap();
        assert_eq!(leer_tareas_avisado(&r), None);
        guardar_ajuste(&r, "tareasAvisado", &json!("2026-11-25")).unwrap();
        assert_eq!(leer_tareas_avisado(&r).as_deref(), Some("2026-11-25"));
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn los_habitos_recordados_aceptan_un_dia_y_ids_de_habito_hasta_100() {
        // habitos-ux.md 8.3 y 11.5: `{ dia, ids }`, el día de Argentina y los hábitos ya recordados ese día
        let cien: Vec<String> = (0..100).map(|i| format!("h-{i}")).collect();
        for bueno in [json!({ "dia": "2026-11-26", "ids": [] }), json!({ "dia": "2026-11-26", "ids": ["h-agua", "h-mf3k-2a"] }), json!({ "dia": "2024-02-29", "ids": cien })] {
            assert!(ajuste_valido("habitosRecordados", &bueno), "{bueno}");
        }
        let ciento_uno: Vec<String> = (0..101).map(|i| format!("h-{i}")).collect();
        for malo in [
            json!({ "dia": "2026-02-30", "ids": [] }), json!({ "dia": "", "ids": [] }), json!({ "ids": [] }), json!({ "dia": "2026-11-26" }),
            json!({ "dia": "2026-11-26", "ids": ["l-trabajo"] }), json!({ "dia": "2026-11-26", "ids": ["h-../x"] }), json!({ "dia": "2026-11-26", "ids": ["h-A"] }),
            json!({ "dia": "2026-11-26", "ids": [3] }), json!({ "dia": "2026-11-26", "ids": "h-agua" }), json!({ "dia": "2026-11-26", "ids": ciento_uno }),
            json!({ "dia": "2026-11-26", "ids": [], "otra": 1 }), json!("2026-11-26"), Value::Null, json!(true), json!([]),
        ] {
            assert!(!ajuste_valido("habitosRecordados", &malo), "{malo}");
        }
    }

    #[test]
    fn los_habitos_recordados_se_guardan_sin_borrar_lo_demas_y_se_leen_validados() {
        let r = ruta_temporal("habitos-recordados");
        assert_eq!(leer_habitos_recordados(&r), None);
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tareas":{"avisado":"2026-11-26"},"futura":[1],"mascota":"ascua"}"#).unwrap();
        let valor = json!({ "dia": "2026-11-26", "ids": ["h-agua", "h-caminar"] });
        guardar_ajuste(&r, "habitosRecordados", &valor).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["habitosRecordados"], valor);
        // Lo demás del archivo sigue: el aviso de tareas, la mascota y una clave que esta versión no conoce
        assert_eq!(guardado["tareas"], json!({ "avisado": "2026-11-26" }));
        assert_eq!(guardado["futura"], json!([1]));
        assert_eq!(leer_mascota(&r), "ascua");
        assert_eq!(leer_tareas_avisado(&r).as_deref(), Some("2026-11-26"));
        assert_eq!(leer_habitos_recordados(&r), Some(valor.clone()));
        // Uno inválido no toca el archivo
        assert!(guardar_ajuste(&r, "habitosRecordados", &json!({ "dia": "ayer", "ids": [] })).is_err());
        assert_eq!(leer_habitos_recordados(&r), Some(valor));
        // Guardar otro ajuste no lo borra
        guardar_ajuste(&r, "tareasAvisado", &json!("2026-11-27")).unwrap();
        assert!(leer_habitos_recordados(&r).is_some());
        // Lo escrito a mano que no sirve se lee como nada recordado
        fs::write(&r, r#"{"habitosRecordados":{"dia":"2026-11-26","ids":["../x"]}}"#).unwrap();
        assert_eq!(leer_habitos_recordados(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn el_resumen_de_habitos_acepta_un_lunes_que_existe_o_vacio() {
        // habitos-ux.md 8.4 y 11.5: el lunes de la semana resumida, "AAAA-MM-DD", o vacío
        for bueno in ["2026-11-23", "2024-01-01", ""] {
            assert!(ajuste_valido("habitosResumen", &json!(bueno)), "{bueno}");
        }
        for malo in [
            json!("2026-11-24"), json!("2026-11-29"), json!("2026-02-30"), json!("2026-11-23T00:00"), json!("23/11/2026"),
            json!(20261123), json!(true), Value::Null, json!({}), json!(["2026-11-23"]),
        ] {
            assert!(!ajuste_valido("habitosResumen", &malo), "{malo}");
        }
        // Las otras claves siguen igual: el aviso de tareas acepta cualquier día, no solo lunes
        assert!(ajuste_valido("tareasAvisado", &json!("2026-11-24")));
        assert!(!ajuste_valido("habitosRecordados", &json!("2026-11-23")));
    }

    #[test]
    fn el_resumen_de_habitos_se_guarda_sin_borrar_lo_demas_y_se_lee_validado() {
        let r = ruta_temporal("habitos-resumen");
        assert_eq!(leer_habitos_resumen(&r), None);
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        let recordados = json!({ "dia": "2026-11-26", "ids": ["h-agua"] });
        fs::write(&r, r#"{"tareas":{"avisado":"2026-11-26"},"futura":[1],"mascota":"ascua"}"#).unwrap();
        guardar_ajuste(&r, "habitosRecordados", &recordados).unwrap();
        guardar_ajuste(&r, "habitosResumen", &json!("2026-11-23")).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["habitosResumen"], "2026-11-23");
        // Lo demás del archivo sigue
        assert_eq!(guardado["tareas"], json!({ "avisado": "2026-11-26" }));
        assert_eq!(guardado["futura"], json!([1]));
        assert_eq!(leer_mascota(&r), "ascua");
        assert_eq!(leer_habitos_recordados(&r), Some(recordados));
        assert_eq!(leer_habitos_resumen(&r).as_deref(), Some("2026-11-23"));
        // Uno inválido no toca el archivo
        let antes = fs::read_to_string(&r).unwrap();
        assert!(guardar_ajuste(&r, "habitosResumen", &json!("2026-11-24")).is_err());
        assert_eq!(fs::read_to_string(&r).unwrap(), antes);
        // Guardar otro ajuste no lo borra
        guardar_ajuste(&r, "tareasAvisado", &json!("2026-11-27")).unwrap();
        assert_eq!(leer_habitos_resumen(&r).as_deref(), Some("2026-11-23"));
        // Vacío: nunca visto
        guardar_ajuste(&r, "habitosResumen", &json!("")).unwrap();
        assert_eq!(leer_habitos_resumen(&r), None);
        // Lo escrito a mano que no es un lunes se lee como nada visto
        fs::write(&r, r#"{"habitosResumen":"2026-11-24"}"#).unwrap();
        assert_eq!(leer_habitos_resumen(&r), None);
        fs::write(&r, r#"{"habitosResumen":5}"#).unwrap();
        assert_eq!(leer_habitos_resumen(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn la_frase_de_la_semana_acepta_un_lunes_y_una_frase_de_una_linea_hasta_160() {
        // habitos-ux.md 8.4: `{ lunes, frase }`; frase "" si el pedido falló (va la plantilla)
        let larga = "a".repeat(160);
        for bueno in [json!({ "lunes": "2026-11-23", "frase": "Bien." }), json!({ "lunes": "2026-11-23", "frase": "" }), json!({ "lunes": "2024-01-01", "frase": larga })] {
            assert!(ajuste_valido("habitosFrase", &bueno), "{bueno}");
        }
        let mas_larga = "a".repeat(161);
        for malo in [
            json!({ "lunes": "2026-11-24", "frase": "Bien." }), json!({ "lunes": "", "frase": "" }), json!({ "lunes": "2026-02-30", "frase": "" }),
            json!({ "lunes": "2026-11-23", "frase": "a\nb" }), json!({ "lunes": "2026-11-23", "frase": "a\rb" }), json!({ "lunes": "2026-11-23", "frase": mas_larga }),
            json!({ "lunes": "2026-11-23", "frase": 5 }), json!({ "lunes": "2026-11-23" }), json!({ "frase": "" }),
            json!({ "lunes": "2026-11-23", "frase": "", "otra": 1 }), json!("2026-11-23"), Value::Null, json!([]),
        ] {
            assert!(!ajuste_valido("habitosFrase", &malo), "{malo}");
        }
    }

    #[test]
    fn la_frase_de_la_semana_se_guarda_sin_borrar_lo_demas_y_se_lee_validada() {
        let r = ruta_temporal("habitos-frase");
        assert_eq!(leer_habitos_frase(&r), None);
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tareas":{"avisado":"2026-11-26"},"habitosResumen":"2026-11-16","futura":[1]}"#).unwrap();
        let valor = json!({ "lunes": "2026-11-23", "frase": "Caminaste 5 de 7 días." });
        guardar_ajuste(&r, "habitosFrase", &valor).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["habitosFrase"], valor);
        assert_eq!(guardado["futura"], json!([1]));
        assert_eq!(leer_tareas_avisado(&r).as_deref(), Some("2026-11-26"));
        assert_eq!(leer_habitos_resumen(&r).as_deref(), Some("2026-11-16"));
        assert_eq!(leer_habitos_frase(&r), Some(valor.clone()));
        // Uno inválido no toca el archivo
        let antes = fs::read_to_string(&r).unwrap();
        assert!(guardar_ajuste(&r, "habitosFrase", &json!({ "lunes": "2026-11-24", "frase": "" })).is_err());
        assert_eq!(fs::read_to_string(&r).unwrap(), antes);
        // Guardar otro ajuste no la borra
        guardar_ajuste(&r, "habitosResumen", &json!("2026-11-23")).unwrap();
        assert_eq!(leer_habitos_frase(&r), Some(valor));
        // Lo escrito a mano que no sirve se lee como nada guardado
        fs::write(&r, r#"{"habitosFrase":{"lunes":"2026-11-23","frase":"a\nb"}}"#).unwrap();
        assert_eq!(leer_habitos_frase(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn los_nombres_se_guardan_y_se_leen_sin_espacios_de_mas() {
        let r = ruta_temporal("nombres");
        assert_eq!(leer_nombres(&r), Nombres::default());
        guardar_ajuste(&r, "nombreMascota", &json!(" Pancho ")).unwrap();
        guardar_ajuste(&r, "nombreUsuario", &json!("Nico")).unwrap();
        // Cambiar de especie no toca el nombre (S2)
        guardar_ajuste(&r, "mascota", &json!("ascua")).unwrap();
        assert_eq!(leer_nombres(&r), Nombres { mascota: String::from("Pancho"), usuario: String::from("Nico") });
        assert_eq!(leer_mascota(&r), "ascua");
        // Vacío vuelve al de siempre (S1)
        guardar_ajuste(&r, "nombreMascota", &json!("")).unwrap();
        assert_eq!(leer_nombres(&r), Nombres { mascota: String::new(), usuario: String::from("Nico") });
        // Uno inválido no toca el archivo
        let antes = fs::read_to_string(&r).unwrap();
        assert!(guardar_ajuste(&r, "nombreUsuario", &json!("a\nb")).is_err());
        assert_eq!(fs::read_to_string(&r).unwrap(), antes);
        // Basura escrita a mano: se lee como vacío
        fs::write(&r, r#"{"nombreMascota":"a\nb","nombreUsuario":7}"#).unwrap();
        assert_eq!(leer_nombres(&r), Nombres::default());
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
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
    fn guardar_el_acople_el_monitor_o_la_revision_del_mod_no_borra_los_ajustes() {
        let r = ruta_temporal("conserva-ajustes");
        guardar_ajuste(&r, "arriba", &json!(false)).unwrap();
        guardar_ajuste(&r, "avisar", &json!(false)).unwrap();
        guardar_ajuste(&r, "pausa", &json!(true)).unwrap();
        guardar_ajuste(&r, "mascota", &json!("bruma")).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Derecha, lugar: 0.2 })).unwrap();
        guardar_acople(&r, None).unwrap();
        guardar_flotante(&r, Flotante { x: 0.1, y: 0.9 }).unwrap();
        guardar_monitor(&r, (10.0, 20.0)).unwrap();
        guardar_revision_mod(&r, RevisionMod { revisado: 1_795_000_000_000, fallo: false }).unwrap();
        assert_eq!(leer_interruptores(&r), Interruptores { arriba: false, avisar: false, pausa: true });
        assert_eq!(leer_mascota(&r), "bruma");
        // Y guardar un ajuste no borra lo demás
        guardar_ajuste(&r, "pausa", &json!(false)).unwrap();
        assert_eq!(leer_flotante(&r), Some(Flotante { x: 0.1, y: 0.9 }));
        assert_eq!(leer_monitor(&r), Some((10.0, 20.0)));
        assert_eq!(leer_revision_mod(&r), Some(RevisionMod { revisado: 1_795_000_000_000, fallo: false }));
        assert_eq!(leer_acople(&r), None);
        fs::remove_dir_all(r.parent().unwrap()).unwrap();
    }

    #[test]
    fn una_clave_desconocida_sobrevive_a_guardar() {
        // D9: `escribir` parte de lo leído y pisa solo sus claves (otra entrega o una versión más nueva)
        let r = ruta_temporal("desconocida");
        fs::create_dir_all(r.parent().unwrap()).unwrap();
        fs::write(&r, r#"{"tamano":100,"motor":"local","futura":{"a":[1,2]},"arriba":"basura"}"#).unwrap();
        guardar_monitor(&r, (150.0, 0.0)).unwrap();
        guardar_acople(&r, Some(Acople { borde: Borde::Abajo, lugar: 0.5 })).unwrap();
        guardar_ajuste(&r, "avisar", &json!(false)).unwrap();
        let guardado: Value = serde_json::from_str(&fs::read_to_string(&r).unwrap()).unwrap();
        assert_eq!(guardado["motor"], json!("local"));
        assert_eq!(guardado["futura"], json!({ "a": [1, 2] }));
        // Lo que no se entiende se conserva tal cual, y se lee como el de fábrica
        assert_eq!(guardado["arriba"], json!("basura"));
        assert!(leer_interruptores(&r).arriba);
        assert_eq!(guardado["tamano"], json!(100));
        assert_eq!(guardado["avisar"], json!(false));
        // Un archivo que no es un objeto se reemplaza entero
        fs::write(&r, "[1,2,3]").unwrap();
        guardar_monitor(&r, (125.0, 0.0)).unwrap();
        assert_eq!(leer_monitor(&r), Some((125.0, 0.0)));
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
