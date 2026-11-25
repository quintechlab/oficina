//! El servidor MCP de Avis para la charla con la mascota (#43, docs/diseno/chat-herramientas-ux.md
//! 11.1, 11.4, 11.7 y 11.9): las herramientas de tareas que puede usar el `claude -p` de la charla.
//!
//! Reglas firmes (11.1, "No improvisar" de 14):
//! - Escucha solo en `127.0.0.1` con un puerto que elige el sistema. Rechaza antes de leer el cuerpo:
//!   `Host` distinto de `127.0.0.1:{puerto}` → 403 (rebinding de DNS), cualquier `Origin` → 403, un
//!   token que no existe → 401 sin detalle, más de 64 KB → 413. Un pedido por conexión, 10 s como mucho.
//! - Un token criptográfico por lanzamiento del proceso (`nuevo_token`, del generador del sistema),
//!   atado a la conversación; muere con el proceso (`revocar`). Nunca se anota en `widget.log`.
//! - Solo durante un turno (`empezar_turno` … `terminar_turno`): antes del primer mensaje, después del
//!   final o de frenar, ninguna herramienta anda. Como mucho 20 cambios por turno.
//! - Exactamente las cinco herramientas de 11.4: ver, crear, editar, tildar y mostrar. Nunca borrar,
//!   ni listas, ni subtareas. Solo toca `<config>/tareas/` con `tareas::modificar` (el candado de
//!   `tareas.rs`); nunca `~/.claude`, la carpeta de la charla, la red ni comandos.
//! - Lo que cambió lo cuenta Rust (D-c8): cada escritura emite `oficina://chat` (`tipo: "cambio"`) con
//!   su `antes` y `despues`, y `oficina://tareas` por cada lista tocada. Deshacer (`deshacer`) y
//!   reintentar (`reintentar`) son clics del usuario: no necesitan turno.
//! - Lo que pide Claude Code (M-H5, medido): `server/discover` → error -32601 y cae a `initialize`
//!   (repite la versión pedida); `notifications/*` → 202; `GET /mcp` → 405; sin SSE ni `Mcp-Session-Id`.

use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use crate::tareas::{self, Falla, Lectura};

/// Emite a la ventana (el mismo tipo que `chat::Emisor`).
pub type Emisor = Arc<dyn Fn(Value) + Send + Sync>;
/// La hora en ms desde 1970 (los tests la fijan).
pub type Reloj = Arc<dyn Fn() -> i64 + Send + Sync>;

/// Aviso de una lista que cambió por la charla (11.6): `{ lista, tarea, origen: "chat" }`.
pub const EVENTO_TAREAS: &str = "oficina://tareas";
/// Las herramientas, en el orden de `tools/list` (11.4). Claude Code las ve como `mcp__avis__<nombre>`.
pub const NOMBRES: [&str; 5] = ["tareas_ver", "tarea_crear", "tarea_editar", "tarea_tildar", "tarea_mostrar"];
/// Las que escriben: cuentan para el tope del turno y dejan un recibo con «Deshacer».
const ESCRIBEN: [&str; 3] = ["tarea_crear", "tarea_editar", "tarea_tildar"];
/// Topes de D-c16.
pub const TOPE_CUERPO: usize = 64 * 1024;
pub const TOPE_CAMBIOS: u32 = 20;
pub const TOPE_LECTURA: usize = 100;
/// Filas del resumen de una lectura (4.5).
const TOPE_FILAS: usize = 6;
const TOPE_CABECERAS: usize = 16 * 1024;
/// Conexiones a la vez: el cliente es uno solo (el proceso de la charla).
const TOPE_CONEXIONES: usize = 16;
/// Tiempo máximo por pedido (11.1).
pub const ESPERA_PEDIDO: Duration = Duration::from_secs(10);
/// Desfase fijo de Argentina (UTC-3, sin horario de verano), como `DESFASE_AR` de fechas.js.
const DESFASE_AR_MS: i64 = 3 * 3_600_000;
/// La versión de protocolo si el cliente pide una que no conocemos (la que pidió Claude Code, M-H5).
const VERSION_MCP: &str = "2025-11-25";
const VERSIONES_MCP: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

// Textos de 5.2 (los motivos los arma Rust) y de 11.1.
const SIN_TURNO: &str = "No hay un mensaje en curso.";
const SIN_LISTAS: &str = "No hay listas todavía: creá una en Tareas.";
const NO_ESTA: &str = "Esa tarea ya no está.";
const ROTA: &str = "El archivo de la lista está roto: no lo toco.";
const DISCO: &str = "No se pudo guardar. No cambió nada.";
const TOPE: &str = "Demasiados cambios en un mensaje: hacé de a 20.";
// Validaciones de la entrada del modelo (no están en 5.2: los lee el modelo para corregir el pedido).
const FALTA_TITULO: &str = "Falta el título.";
const TITULO_LARGO: &str = "El título es demasiado largo: hasta 200 letras.";
const NOTAS_LARGAS: &str = "Las notas son demasiado largas: hasta 4000 letras.";
const FECHA_MALA: &str = "La fecha no sirve: usá AAAA-MM-DD, \"hoy\", \"mañana\" o \"pasado mañana\".";
const FALTA_CAMBIO: &str = "Falta qué cambiar.";
/// Una regla interna de `deshacer`: la tarea ya no es como la dejó la charla.
const CAMBIO_DESPUES: &str = "\u{0}cambio-despues";

fn sin_lista(nombre: &str) -> String {
    format!("No existe la lista «{nombre}».")
}

fn bloquear<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

// ------------------------------------------------------------------ azar e ids

/// `n` bytes del generador criptográfico del sistema (nunca `semilla()` de chat.rs).
fn azar(n: usize) -> Option<Vec<u8>> {
    let mut b = vec![0u8; n];
    getrandom::fill(&mut b).ok().map(|()| b)
}

fn base36(mut n: u64) -> String {
    const D: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut s = Vec::new();
    loop {
        s.push(D[(n % 36) as usize]);
        n /= 36;
        if n == 0 {
            break;
        }
    }
    s.reverse();
    String::from_utf8(s).unwrap_or_default()
}

fn numero_al_azar() -> u64 {
    azar(8).map(|b| u64::from_le_bytes(b.try_into().unwrap_or([0; 8]))).unwrap_or_else(|| {
        // Un id no es un secreto: sin el generador, la hora alcanza
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as u64).unwrap_or(0)
    })
}

/// El id de un cambio (11.8): `c-` y 10 letras o dígitos.
fn id_cambio() -> String {
    format!("c-{:0>10}", base36(numero_al_azar() % 36u64.pow(10)))
}

/// El id de una tarea nueva, como `nuevoId` de tareas.js: `t-{ms en base 36}{6 al azar}`, sin repetir.
fn id_tarea(ahora: i64, usados: &HashSet<String>) -> String {
    loop {
        let id = format!("t-{}{:0>6}", base36(ahora.max(0) as u64), base36(numero_al_azar() % 36u64.pow(6)));
        if !usados.contains(&id) {
            return id;
        }
    }
}

fn id_con(prefijo: &str, id: &str) -> bool {
    id.len() <= 40 && id.len() > prefijo.len() && id.starts_with(prefijo) && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// ¿Es un id de tarea (`t-…`)?
pub fn id_tarea_valido(id: &str) -> bool {
    id_con("t-", id)
}

// ------------------------------------------------------------------ fechas de Argentina (D-c15)

/// El día de Argentina de un instante (como `hoyArgentina` de fechas.js).
pub fn dia_argentina(ahora: i64) -> chrono::NaiveDate {
    chrono::DateTime::from_timestamp_millis(ahora - DESFASE_AR_MS).map(|d| d.date_naive()).unwrap_or_default()
}

fn texto_dia(d: chrono::NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

fn dia_semana(d: chrono::NaiveDate) -> &'static str {
    use chrono::Datelike;
    ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][d.weekday().num_days_from_monday() as usize]
}

/// La fecha que pidió el modelo: `AAAA-MM-DD`, "hoy", "mañana" o "pasado mañana" (en el día de
/// Argentina de `ahora`), o `null` (sin fecha). Lo demás no sirve.
pub fn fecha_pedida(v: &Value, ahora: i64) -> Result<Value, String> {
    let s = match v {
        Value::Null => return Ok(Value::Null),
        Value::String(s) => s.trim().to_lowercase(),
        _ => return Err(String::from(FECHA_MALA)),
    };
    let hoy = dia_argentina(ahora);
    let dias = match s.as_str() {
        "hoy" => Some(0),
        "mañana" | "manana" => Some(1),
        "pasado mañana" | "pasado manana" | "pasado" => Some(2),
        _ => None,
    };
    if let Some(n) = dias {
        return Ok(json!(texto_dia(hoy + chrono::Duration::days(n))));
    }
    if s.len() == 10 && chrono::NaiveDate::parse_from_str(&s, "%Y-%m-%d").is_ok() {
        return Ok(json!(s));
    }
    Err(String::from(FECHA_MALA))
}

// ------------------------------------------------------------------ las herramientas (11.4)

/// Las definiciones de `tools/list`: exactamente las de 11.4, con sus descripciones tal cual.
pub fn definiciones() -> Value {
    let texto = |max: u64| json!({ "type": "string", "maxLength": max });
    let fecha = json!({ "type": ["string", "null"], "description": "AAAA-MM-DD, \"hoy\", \"mañana\" o \"pasado mañana\"" });
    let id = json!({ "type": "string", "description": "El id de la tarea (t-…), de tareas_ver" });
    json!([
        {
            "name": "tareas_ver",
            "description": "Muestra las tareas de Avis. vista: hoy, vencidas, lista o todas. Devuelve también la fecha de hoy.",
            "inputSchema": { "type": "object", "properties": {
                "vista": { "type": "string", "enum": ["hoy", "vencidas", "lista", "todas"] },
                "lista": { "type": "string", "description": "Nombre o id de la lista, con vista \"lista\"" },
                "hechas": { "type": "boolean" },
            }, "required": ["vista"], "additionalProperties": false },
        },
        {
            "name": "tarea_crear",
            "description": "Anota una tarea nueva. Sin lista va a la primera. fecha: AAAA-MM-DD, \"hoy\", \"mañana\" o \"pasado mañana\".",
            "inputSchema": { "type": "object", "properties": {
                "titulo": { "type": "string", "minLength": 1, "maxLength": 200 },
                "lista": { "type": "string", "description": "Nombre o id de la lista" },
                "fecha": fecha,
                "importante": { "type": "boolean" },
                "notas": texto(4000),
            }, "required": ["titulo"], "additionalProperties": false },
        },
        {
            "name": "tarea_editar",
            "description": "Cambia una tarea: título, fecha (null la quita), importante, notas o lista (la mueve). Pasá solo lo que cambia.",
            "inputSchema": { "type": "object", "properties": {
                "id": id,
                "titulo": { "type": "string", "minLength": 1, "maxLength": 200 },
                "fecha": fecha,
                "importante": { "type": "boolean" },
                "notas": texto(4000),
                "lista": { "type": "string", "description": "Nombre o id de la lista a la que se mueve" },
            }, "required": ["id"], "minProperties": 2, "additionalProperties": false },
        },
        {
            "name": "tarea_tildar",
            "description": "Tilda o destilda una tarea.",
            "inputSchema": { "type": "object", "properties": { "id": id, "hecha": { "type": "boolean" } }, "required": ["id", "hecha"], "additionalProperties": false },
        },
        {
            "name": "tarea_mostrar",
            "description": "No cambia nada: le muestra al usuario una tarea con un botón para abrirla. Usala cuando pida borrar una tarea (el borrado lo hace él).",
            "inputSchema": { "type": "object", "properties": { "id": id, "para": { "type": "string", "enum": ["borrar", "ver"] } }, "required": ["id", "para"], "additionalProperties": false },
        },
    ])
}

/// Lo que dejó una herramienta: el texto para el modelo, si es un error, el evento para la ventana
/// (`tipo` y `cambio`, 11.6 y 11.8) y las listas tocadas (`{ lista, tarea, origen }`).
#[derive(Debug)]
pub struct Hecho {
    pub texto: String,
    pub error: bool,
    pub tipo: &'static str,
    pub cambio: Option<Value>,
    pub tocadas: Vec<Value>,
}

/// Por qué no se pudo: el motivo de 5.2 y lo que se sabe del pedido.
struct Fallo {
    motivo: String,
    reintentable: bool,
    lista: Option<String>,
    tarea: Option<String>,
    titulo: Option<String>,
}

impl From<String> for Fallo {
    fn from(motivo: String) -> Fallo {
        Fallo { motivo, reintentable: false, lista: None, tarea: None, titulo: None }
    }
}

impl From<&str> for Fallo {
    fn from(motivo: &str) -> Fallo {
        Fallo::from(motivo.to_string())
    }
}

/// Una `Falla` de `tareas::modificar` → el motivo de 5.2. Solo el disco es reintentable (11.4).
fn de_falla(f: Falla, nombre_lista: &str) -> Fallo {
    match f {
        Falla::NoExiste => Fallo::from(sin_lista(nombre_lista)),
        Falla::Rota => Fallo::from(ROTA),
        Falla::Disco(e) => {
            registrar(&format!("mcp: no se pudo guardar una lista: {e}"));
            Fallo { reintentable: true, ..Fallo::from(DISCO) }
        }
        Falla::Regla(m) => Fallo::from(m),
    }
}

fn aviso(lista: &str, tarea: &str) -> Value {
    json!({ "lista": lista, "tarea": tarea, "origen": "chat" })
}

/// Lo que se guarda de lo que pidió el modelo (para «Reintentar», 11.9): solo las claves de las
/// herramientas, con sus topes.
fn args_guardables(args: &Value) -> Value {
    let mut m = Map::new();
    for (clave, tope) in [("titulo", 200), ("lista", 100), ("fecha", 40), ("notas", 4000), ("id", 40)] {
        match &args[clave] {
            Value::String(s) => {
                m.insert(clave.to_string(), json!(s.chars().take(tope).collect::<String>()));
            }
            Value::Null if args.get(clave).is_some() && clave == "fecha" => {
                m.insert(clave.to_string(), Value::Null);
            }
            _ => {}
        }
    }
    for clave in ["importante", "hecha"] {
        if let Some(b) = args[clave].as_bool() {
            m.insert(clave.to_string(), json!(b));
        }
    }
    Value::Object(m)
}

fn cambio_base(herramienta: &str, estado: &str, lista: Option<&str>, tarea: Option<&str>, titulo: Option<&str>) -> Value {
    json!({
        "id": id_cambio(), "herramienta": herramienta, "estado": estado, "lista": lista, "tarea": tarea, "titulo": titulo,
        "antes": null, "despues": null, "motivo": null, "reintentable": false, "args": null,
    })
}

fn texto_de(v: &Value, nombre: &str) -> Result<Option<String>, Fallo> {
    match v {
        Value::Null => Ok(None),
        Value::String(s) => Ok(Some(s.clone())),
        _ => Err(Fallo::from(format!("{nombre} no es texto."))),
    }
}

fn titulo_de(v: &Value) -> Result<String, Fallo> {
    let t = texto_de(v, "El título")?.map(|s| s.trim().to_string()).unwrap_or_default();
    if t.is_empty() {
        return Err(Fallo::from(FALTA_TITULO));
    }
    if t.chars().count() > 200 {
        return Err(Fallo::from(TITULO_LARGO));
    }
    Ok(t)
}

fn notas_de(v: &Value) -> Result<Option<String>, Fallo> {
    let n = texto_de(v, "Las notas")?;
    if n.as_ref().is_some_and(|n| n.chars().count() > 4000) {
        return Err(Fallo::from(NOTAS_LARGAS));
    }
    Ok(n)
}

fn booleano_de(v: &Value, nombre: &str) -> Result<Option<bool>, Fallo> {
    match v {
        Value::Null => Ok(None),
        Value::Bool(b) => Ok(Some(*b)),
        _ => Err(Fallo::from(format!("{nombre} tiene que ser true o false."))),
    }
}

fn id_de(v: &Value) -> Result<String, Fallo> {
    v.as_str().filter(|i| id_tarea_valido(i)).map(String::from).ok_or_else(|| Fallo::from(NO_ESTA))
}

/// La lista que nombró el modelo (por id o por nombre, sin importar mayúsculas).
fn buscar_lista<'a>(l: &'a Lectura, q: &str) -> Result<&'a Value, Fallo> {
    let q = q.trim();
    if tareas::id_valido(q) {
        if let Some(x) = l.listas.iter().find(|x| x["id"] == q) {
            return Ok(x);
        }
        if l.rotas.iter().any(|r| r["archivo"] == format!("{q}.json")) {
            return Err(Fallo::from(ROTA));
        }
    }
    let buscado = q.to_lowercase();
    l.listas
        .iter()
        .find(|x| x["nombre"].as_str().is_some_and(|n| n.trim().to_lowercase() == buscado))
        .ok_or_else(|| Fallo::from(sin_lista(q)))
}

/// La lista y la tarea con ese id.
fn buscar_tarea<'a>(l: &'a Lectura, id: &str) -> Option<(&'a Value, &'a Value)> {
    l.listas.iter().find_map(|x| x["tareas"].as_array()?.iter().find(|t| t["id"] == id).map(|t| (x, t)))
}

fn tarea_mut<'a>(doc: &'a mut Value, id: &str) -> Option<&'a mut Value> {
    doc["tareas"].as_array_mut()?.iter_mut().find(|t| t["id"] == id)
}

fn sacar_tarea(doc: &mut Value, id: &str) {
    if let Some(a) = doc["tareas"].as_array_mut() {
        a.retain(|t| t["id"] != id);
    }
}

fn poner_tarea(doc: &mut Value, t: &Value) -> Result<(), String> {
    let id = t["id"].clone();
    let a = doc["tareas"].as_array_mut().ok_or("la lista no tiene tareas")?;
    // Una sola copia (11.3): si ya estaba (un deshacer a medias), se reemplaza
    a.retain(|x| x["id"] != id);
    a.push(t.clone());
    Ok(())
}

fn nombre(lista: &Value) -> String {
    lista["nombre"].as_str().unwrap_or_default().to_string()
}

fn id_de_lista(lista: &Value) -> String {
    lista["id"].as_str().unwrap_or_default().to_string()
}

/// Corre una herramienta sobre `<config>/tareas` (sin turno ni tope: eso lo mira el servidor). `None`
/// si no es una de las cinco.
pub fn ejecutar(carpeta: &Path, herramienta: &str, args: &Value, ahora: i64) -> Option<Hecho> {
    let vacio = Value::Object(Map::new());
    let args = if args.is_object() { args } else { &vacio };
    let r = match herramienta {
        "tareas_ver" => ver(carpeta, args, ahora),
        "tarea_crear" => crear(carpeta, args, ahora),
        "tarea_editar" => editar(carpeta, args, ahora),
        "tarea_tildar" => tildar(carpeta, args, ahora),
        "tarea_mostrar" => mostrar(carpeta, args),
        _ => return None,
    };
    Some(r.unwrap_or_else(|f| fallo_a_hecho(herramienta, args, f)))
}

/// Un error: el texto para el modelo y, si la herramienta escribe, su recibo de error (4.7).
fn fallo_a_hecho(herramienta: &str, args: &Value, f: Fallo) -> Hecho {
    let cambio = ESCRIBEN.contains(&herramienta).then(|| {
        let titulo = f.titulo.clone().or_else(|| args["titulo"].as_str().map(|t| t.trim().chars().take(200).collect()));
        let mut c = cambio_base(herramienta, "error", f.lista.as_deref(), f.tarea.as_deref(), titulo.as_deref());
        c["motivo"] = json!(f.motivo);
        c["reintentable"] = json!(f.reintentable);
        c["args"] = args_guardables(args);
        c
    });
    Hecho { texto: f.motivo, error: true, tipo: "cambio", cambio, tocadas: Vec::new() }
}

fn ver(carpeta: &Path, args: &Value, ahora: i64) -> Result<Hecho, Fallo> {
    let vista = args["vista"].as_str().filter(|v| ["hoy", "vencidas", "lista", "todas"].contains(v)).ok_or("vista: hoy, vencidas, lista o todas.")?;
    let con_hechas = booleano_de(&args["hechas"], "hechas")?.unwrap_or(false);
    let l = tareas::listar(carpeta);
    let hoy = texto_dia(dia_argentina(ahora));
    let de_lista = match vista {
        "lista" => Some(id_de_lista(buscar_lista(&l, texto_de(&args["lista"], "La lista")?.as_deref().ok_or("Falta la lista.")?)?)),
        _ => None,
    };
    // Las de la vista (con las hechas), en el orden de las listas
    let mut de_la_vista: Vec<(&Value, &Value)> = Vec::new();
    for x in &l.listas {
        if de_lista.as_ref().is_some_and(|id| x["id"] != id.as_str()) {
            continue;
        }
        for t in x["tareas"].as_array().map(Vec::as_slice).unwrap_or_default() {
            let fecha = t["fecha"].as_str();
            let entra = match vista {
                "hoy" => fecha == Some(hoy.as_str()),
                "vencidas" => t["hecha"] != true && fecha.is_some_and(|f| f < hoy.as_str()),
                _ => true,
            };
            if entra {
                de_la_vista.push((x, t));
            }
        }
    }
    let fila = |x: &Value, t: &Value| json!({ "id": t["id"], "lista": x["id"], "titulo": t["titulo"], "fecha": t["fecha"], "importante": t["importante"], "hecha": t["hecha"] });
    let para_el_modelo: Vec<Value> = de_la_vista.iter().filter(|(_, t)| con_hechas || t["hecha"] != true).take(TOPE_LECTURA).map(|(x, t)| fila(x, t)).collect();
    let texto = json!({
        "hoy": hoy,
        "diaSemana": dia_semana(dia_argentina(ahora)),
        "listas": l.listas.iter().map(|x| json!({ "id": x["id"], "nombre": x["nombre"] })).collect::<Vec<_>>(),
        "tareas": para_el_modelo,
    })
    .to_string();
    // El resumen del recibo de lectura (4.5): pendientes (importantes primero, por fecha y creación),
    // después las tildadas
    let mut orden = de_la_vista.clone();
    orden.sort_by_key(|(_, t)| (t["hecha"] == true, t["importante"] != true, t["fecha"].as_str().unwrap_or("9999").to_string(), t["creada"].as_u64().unwrap_or(0)));
    let filas: Vec<Value> = orden.iter().take(TOPE_FILAS).map(|(x, t)| json!({ "tarea": t["id"], "lista": x["id"], "titulo": t["titulo"], "fecha": t["fecha"], "hecha": t["hecha"], "importante": t["importante"] })).collect();
    let mut c = cambio_base("tareas_ver", "lectura", de_lista.as_deref(), None, None);
    c["resumen"] = json!({
        "vista": vista,
        "nombre": de_lista.as_ref().and_then(|id| l.listas.iter().find(|x| x["id"] == id.as_str())).map(nombre),
        "hoy": hoy,
        "hechas": de_la_vista.iter().filter(|(_, t)| t["hecha"] == true).count(),
        "total": de_la_vista.len(),
        "mas": de_la_vista.len().saturating_sub(filas.len()),
        "filas": filas,
    });
    Ok(Hecho { texto, error: false, tipo: "lectura", cambio: Some(c), tocadas: Vec::new() })
}

fn crear(carpeta: &Path, args: &Value, ahora: i64) -> Result<Hecho, Fallo> {
    let titulo = titulo_de(&args["titulo"])?;
    let fecha = fecha_pedida(&args["fecha"], ahora).map_err(Fallo::from)?;
    let importante = booleano_de(&args["importante"], "importante")?.unwrap_or(false);
    let notas = notas_de(&args["notas"])?.unwrap_or_default();
    let pedida = texto_de(&args["lista"], "La lista")?.filter(|q| !q.trim().is_empty());
    let l = tareas::listar(carpeta);
    let destino = match &pedida {
        Some(q) => buscar_lista(&l, q)?,
        None => l.listas.first().ok_or(SIN_LISTAS)?,
    };
    let (lid, lnombre) = (id_de_lista(destino), nombre(destino));
    let usados: HashSet<String> = l.listas.iter().flat_map(|x| x["tareas"].as_array().cloned().unwrap_or_default()).filter_map(|t| t["id"].as_str().map(String::from)).collect();
    let id = id_tarea(ahora, &usados);
    let t = json!({ "id": id, "titulo": titulo, "hecha": false, "hechaEn": null, "fecha": fecha, "importante": importante, "notas": notas, "subtareas": [], "creada": ahora.max(0) });
    tareas::modificar(carpeta, &lid, |doc| poner_tarea(doc, &t)).map_err(|f| Fallo { lista: Some(lid.clone()), ..de_falla(f, &lnombre) })?;
    let para = fecha.as_str().map(|f| format!(", para el {f}")).unwrap_or_default();
    let mut c = cambio_base("tarea_crear", "hecho", Some(&lid), Some(&id), Some(&titulo));
    c["despues"] = json!({ "titulo": titulo, "fecha": fecha, "hecha": false, "importante": importante, "lista": lid });
    Ok(Hecho { texto: format!("Anotada «{titulo}» en {lnombre}{para}."), error: false, tipo: "cambio", cambio: Some(c), tocadas: vec![aviso(&lid, &id)] })
}

/// Mueve la tarea `t` (ya con sus cambios) de `origen` a `destino`: destino primero (11.3); si el
/// origen no se puede escribir, se saca del destino y nada cambió.
fn mover(carpeta: &Path, t: &Value, origen: (&str, &str), destino: (&str, &str)) -> Result<(), Fallo> {
    let id = t["id"].as_str().unwrap_or_default().to_string();
    tareas::modificar(carpeta, destino.0, |doc| poner_tarea(doc, t)).map_err(|f| de_falla(f, destino.1))?;
    if let Err(f) = tareas::modificar(carpeta, origen.0, |doc| {
        sacar_tarea(doc, &id);
        Ok(())
    }) {
        let _ = tareas::modificar(carpeta, destino.0, |doc| {
            sacar_tarea(doc, &id);
            Ok(())
        });
        return Err(de_falla(f, origen.1));
    }
    Ok(())
}

/// Lo que dice «Listo: …» de cada campo cambiado.
fn parte_cambio(clave: &str, v: &Value) -> String {
    match clave {
        "titulo" => format!("título «{}»", v.as_str().unwrap_or_default()),
        "fecha" => v.as_str().map(|f| format!("fecha {f}")).unwrap_or_else(|| String::from("sin fecha")),
        "importante" if v == &json!(true) => String::from("importante"),
        "importante" => String::from("ya no importante"),
        _ => String::from("notas"),
    }
}

fn editar(carpeta: &Path, args: &Value, ahora: i64) -> Result<Hecho, Fallo> {
    let id = id_de(&args["id"])?;
    // Los campos pedidos, en el orden de la descripción
    let mut campos: Vec<(&str, Value)> = Vec::new();
    if args.get("titulo").is_some() {
        campos.push(("titulo", json!(titulo_de(&args["titulo"])?)));
    }
    if args.get("fecha").is_some() {
        campos.push(("fecha", fecha_pedida(&args["fecha"], ahora).map_err(Fallo::from)?));
    }
    if let Some(b) = booleano_de(&args["importante"], "importante")? {
        campos.push(("importante", json!(b)));
    }
    if let Some(n) = notas_de(&args["notas"])? {
        campos.push(("notas", json!(n)));
    }
    let pedida = texto_de(&args["lista"], "La lista")?.filter(|q| !q.trim().is_empty());
    if campos.is_empty() && pedida.is_none() {
        return Err(Fallo::from(FALTA_CAMBIO));
    }
    let l = tareas::listar(carpeta);
    let (origen, t) = buscar_tarea(&l, &id).ok_or(NO_ESTA)?;
    let (oid, onombre) = (id_de_lista(origen), nombre(origen));
    let destino = pedida.as_deref().map(|q| buscar_lista(&l, q)).transpose()?;
    let (did, dnombre) = destino.map(|d| (id_de_lista(d), nombre(d))).unwrap_or_else(|| (oid.clone(), onombre.clone()));
    let se_mueve = did != oid;
    if campos.is_empty() && !se_mueve {
        return Err(Fallo::from(format!("Ya está en {onombre}.")));
    }
    let titulo_antes = t["titulo"].as_str().map(String::from);
    let con_contexto = |f: Fallo| Fallo { lista: Some(oid.clone()), tarea: Some(id.clone()), titulo: titulo_antes.clone(), ..f };
    let (mut antes, mut despues) = (Map::new(), Map::new());
    for (k, v) in &campos {
        antes.insert(k.to_string(), t[*k].clone());
        despues.insert(k.to_string(), v.clone());
    }
    antes.insert(String::from("lista"), json!(oid));
    despues.insert(String::from("lista"), json!(did));
    let titulo = if se_mueve {
        let mut nueva = t.clone();
        for (k, v) in &campos {
            nueva[*k] = v.clone();
        }
        mover(carpeta, &nueva, (&oid, &onombre), (&did, &dnombre)).map_err(con_contexto)?;
        nueva["titulo"].as_str().unwrap_or_default().to_string()
    } else {
        tareas::modificar(carpeta, &oid, |doc| {
            let t = tarea_mut(doc, &id).ok_or(NO_ESTA)?;
            for (k, v) in &campos {
                t[*k] = v.clone();
            }
            Ok(t["titulo"].as_str().unwrap_or_default().to_string())
        })
        .map(|(titulo, _)| titulo)
        .map_err(|f| con_contexto(de_falla(f, &onombre)))?
    };
    let mut partes: Vec<String> = campos.iter().map(|(k, v)| parte_cambio(k, v)).collect();
    if se_mueve {
        partes.push(format!("lista {dnombre}"));
    }
    let mut c = cambio_base("tarea_editar", "hecho", Some(&did), Some(&id), Some(&titulo));
    c["antes"] = Value::Object(antes);
    c["despues"] = Value::Object(despues);
    let mut tocadas = vec![aviso(&oid, &id)];
    if se_mueve {
        tocadas.push(aviso(&did, &id));
    }
    Ok(Hecho { texto: format!("Listo: {}.", partes.join(", ")), error: false, tipo: "cambio", cambio: Some(c), tocadas })
}

fn tildar(carpeta: &Path, args: &Value, ahora: i64) -> Result<Hecho, Fallo> {
    let id = id_de(&args["id"])?;
    let hecha = booleano_de(&args["hecha"], "hecha")?.ok_or("Falta hecha: true o false.")?;
    let l = tareas::listar(carpeta);
    let (origen, t) = buscar_tarea(&l, &id).ok_or(NO_ESTA)?;
    let (lid, lnombre) = (id_de_lista(origen), nombre(origen));
    let hecha_en = if hecha { json!(ahora.max(0)) } else { Value::Null };
    let antes = json!({ "hecha": t["hecha"], "hechaEn": t["hechaEn"], "lista": lid });
    let (titulo, _) = tareas::modificar(carpeta, &lid, |doc| {
        let t = tarea_mut(doc, &id).ok_or(NO_ESTA)?;
        t["hecha"] = json!(hecha);
        t["hechaEn"] = hecha_en.clone();
        Ok(t["titulo"].as_str().unwrap_or_default().to_string())
    })
    .map_err(|f| Fallo { lista: Some(lid.clone()), tarea: Some(id.clone()), titulo: t["titulo"].as_str().map(String::from), ..de_falla(f, &lnombre) })?;
    let mut c = cambio_base("tarea_tildar", "hecho", Some(&lid), Some(&id), Some(&titulo));
    c["antes"] = antes;
    c["despues"] = json!({ "hecha": hecha, "hechaEn": hecha_en, "lista": lid });
    let texto = format!("{} «{titulo}».", if hecha { "Tildada" } else { "Destildada" });
    Ok(Hecho { texto, error: false, tipo: "cambio", cambio: Some(c), tocadas: vec![aviso(&lid, &id)] })
}

fn mostrar(carpeta: &Path, args: &Value) -> Result<Hecho, Fallo> {
    let id = id_de(&args["id"])?;
    let para = args["para"].as_str().filter(|p| *p == "borrar" || *p == "ver").ok_or("para: borrar o ver.")?;
    let l = tareas::listar(carpeta);
    let (x, t) = buscar_tarea(&l, &id).ok_or(NO_ESTA)?;
    let titulo = t["titulo"].as_str().unwrap_or_default().to_string();
    let mut c = cambio_base("tarea_mostrar", "mostrar", x["id"].as_str(), Some(&id), Some(&titulo));
    c["resumen"] = json!({ "para": para });
    Ok(Hecho { texto: format!("Le mostré «{titulo}»."), error: false, tipo: "mostrar", cambio: Some(c), tocadas: Vec::new() })
}

// ------------------------------------------------------------------ deshacer (11.7) y reintentar (11.9)

/// Lo que dejó `deshacer`: `deshecho`, `cambio-despues` o `error` (con su motivo de 5.2), y las
/// listas que tocó (vacío si no hizo falta tocar nada).
#[derive(Debug)]
pub struct Deshacer {
    pub estado: &'static str,
    pub motivo: Option<String>,
    pub tocadas: Vec<Value>,
}

impl Deshacer {
    fn sin_tocar(estado: &'static str) -> Deshacer {
        Deshacer { estado, motivo: None, tocadas: Vec::new() }
    }
    fn tocando(tocadas: Vec<Value>) -> Deshacer {
        Deshacer { estado: "deshecho", motivo: None, tocadas }
    }
    fn de_falla(f: Falla, lista: &str) -> Deshacer {
        match f {
            Falla::Regla(m) if m == CAMBIO_DESPUES => Deshacer::sin_tocar("cambio-despues"),
            f => Deshacer { estado: "error", motivo: Some(de_falla(f, lista).motivo), tocadas: Vec::new() },
        }
    }
}

/// ¿La tarea `t` (en la lista `lista`) tiene los valores de `campos` (la clave `lista` es su lista)?
fn coincide(t: &Value, lista: &str, campos: &Map<String, Value>) -> bool {
    campos.iter().all(|(k, v)| if k == "lista" { v == lista } else { &t[k.as_str()] == v })
}

/// La forma de un cambio que se puede deshacer o reintentar: su herramienta, su tarea y su lista.
fn forma(cambio: &Value) -> Result<(&str, &str), String> {
    let herramienta = cambio["herramienta"].as_str().filter(|h| ESCRIBEN.contains(h)).ok_or("herramienta inválida")?;
    let estado = cambio["estado"].as_str().ok_or("estado inválido")?;
    if let Some(l) = cambio["lista"].as_str() {
        if !tareas::id_valido(l) {
            return Err(String::from("lista inválida"));
        }
    }
    if let Some(t) = cambio["tarea"].as_str() {
        if !id_tarea_valido(t) {
            return Err(String::from("tarea inválida"));
        }
    }
    Ok((herramienta, estado))
}

/// `chat_deshacer` (11.7): vuelve el cambio a su `antes`, con el candado de tareas, si la tarea sigue
/// como la dejó la charla; si cambió después (en la ventana), no toca nada. Deshacer otra vez lo que
/// ya está como antes es «Deshecho» sin tocar nada. Un cambio con otra forma es un error.
pub fn deshacer(carpeta: &Path, cambio: &Value, _ahora: i64) -> Result<Deshacer, String> {
    let (herramienta, estado) = forma(cambio)?;
    match estado {
        "deshecho" => return Ok(Deshacer::sin_tocar("deshecho")),
        "cambio-despues" => return Ok(Deshacer::sin_tocar("cambio-despues")),
        "hecho" => {}
        _ => return Err(String::from("ese cambio no se deshace")),
    }
    let id = cambio["tarea"].as_str().ok_or("sin tarea")?.to_string();
    let despues = cambio["despues"].as_object().ok_or("sin despues")?.clone();
    despues.get("lista").and_then(Value::as_str).filter(|l| tareas::id_valido(l)).ok_or("despues sin lista")?;
    let antes = match herramienta {
        "tarea_crear" => Map::new(),
        _ => cambio["antes"].as_object().ok_or("sin antes")?.clone(),
    };
    let l = tareas::listar(carpeta);
    let hallada = buscar_tarea(&l, &id).map(|(x, t)| (id_de_lista(x), nombre(x), t.clone()));
    if herramienta == "tarea_crear" {
        let Some((lid, lnombre, t)) = hallada else { return Ok(Deshacer::sin_tocar("deshecho")) };
        if !coincide(&t, &lid, &despues) {
            return Ok(Deshacer::sin_tocar("cambio-despues"));
        }
        let r = tareas::modificar(carpeta, &lid, |doc| {
            let igual = tarea_mut(doc, &id).is_some_and(|t| coincide(t, &lid, &despues));
            if !igual {
                return Err(String::from(CAMBIO_DESPUES));
            }
            sacar_tarea(doc, &id);
            Ok(())
        });
        return Ok(match r {
            Ok(_) => Deshacer::tocando(vec![aviso(&lid, &id)]),
            Err(f) => Deshacer::de_falla(f, &lnombre),
        });
    }
    let lista_antes = antes.get("lista").and_then(Value::as_str).filter(|l| tareas::id_valido(l)).ok_or("antes sin lista")?.to_string();
    let Some((lid, lnombre, t)) = hallada else { return Ok(Deshacer::sin_tocar("cambio-despues")) };
    if !coincide(&t, &lid, &despues) {
        let estado = if coincide(&t, &lid, &antes) { "deshecho" } else { "cambio-despues" };
        return Ok(Deshacer::sin_tocar(estado));
    }
    let a_restaurar: Vec<(String, Value)> = antes.iter().filter(|(k, _)| *k != "lista").map(|(k, v)| (k.clone(), v.clone())).collect();
    if lista_antes != lid {
        // La había movido: vuelve a su lista, destino primero (11.3)
        let mut vieja = t.clone();
        for (k, v) in &a_restaurar {
            vieja[k.as_str()] = v.clone();
        }
        let nombre_antes = l.listas.iter().find(|x| x["id"] == lista_antes.as_str()).map(nombre).unwrap_or_else(|| lista_antes.clone());
        return Ok(match mover(carpeta, &vieja, (&lid, &lnombre), (&lista_antes, &nombre_antes)) {
            Ok(()) => Deshacer::tocando(vec![aviso(&lista_antes, &id), aviso(&lid, &id)]),
            Err(f) => Deshacer { estado: "error", motivo: Some(f.motivo), tocadas: Vec::new() },
        });
    }
    let r = tareas::modificar(carpeta, &lid, |doc| {
        let t = tarea_mut(doc, &id).filter(|t| coincide(t, &lid, &despues)).ok_or(CAMBIO_DESPUES)?;
        for (k, v) in &a_restaurar {
            t[k.as_str()] = v.clone();
        }
        Ok(())
    });
    Ok(match r {
        Ok(_) => Deshacer::tocando(vec![aviso(&lid, &id)]),
        Err(f) => Deshacer::de_falla(f, &lnombre),
    })
}

/// `chat_reintentar` (11.9): repite la operación de un error reintentable con sus `args`, sin el
/// modelo ni turno (es un clic del usuario). Devuelve el cambio nuevo y las listas tocadas.
pub fn reintentar(carpeta: &Path, cambio: &Value, ahora: i64) -> Result<(Value, Vec<Value>), String> {
    let (herramienta, estado) = forma(cambio)?;
    if estado != "error" || cambio["reintentable"] != true {
        return Err(String::from("ese cambio no se reintenta"));
    }
    let args = cambio["args"].as_object().ok_or("sin args")?;
    let h = ejecutar(carpeta, herramienta, &Value::Object(args.clone()), ahora).ok_or("herramienta inválida")?;
    Ok((h.cambio.ok_or("sin cambio")?, h.tocadas))
}

/// El verbo de la fila de un cambio (5.2): «anotada», «tildada», «movida», «nueva fecha»…
pub fn verbo_cambio(cambio: &Value) -> String {
    let despues = &cambio["despues"];
    let verbo = match cambio["herramienta"].as_str().unwrap_or_default() {
        "tarea_crear" => "anotada",
        "tarea_tildar" if despues["hecha"] == true => "tildada",
        "tarea_tildar" => "destildada",
        _ => {
            let mut campos: Vec<&str> = despues.as_object().map(|o| o.keys().map(String::as_str).filter(|k| *k != "lista").collect()).unwrap_or_default();
            if cambio["antes"]["lista"] != despues["lista"] {
                campos.push("lista");
            }
            match campos.as_slice() {
                ["lista"] => "movida",
                ["fecha"] if despues["fecha"].is_null() => "sin fecha",
                ["fecha"] => "nueva fecha",
                ["titulo"] => "renombrada",
                ["importante"] if despues["importante"] == true => "importante",
                ["importante"] => "ya no importante",
                ["notas"] => "notas",
                _ => "editada",
            }
        }
    };
    verbo.to_string()
}

/// La línea `<avis-deshecho>` de un cambio deshecho (11.7), sin las marcas: «Deshecho: {verbo} «{título}».».
pub fn linea_deshecho(cambio: &Value) -> String {
    format!("Deshecho: {} «{}».", verbo_cambio(cambio), cambio["titulo"].as_str().unwrap_or_default())
}

// ------------------------------------------------------------------ el servidor (11.1)

/// Lo que se sabe del token de un lanzamiento: su conversación y su turno en curso.
struct Atadura {
    conversacion: String,
    turno: Option<u64>,
    cambios: u32,
}

struct Interno {
    carpeta: PathBuf,
    direccion: SocketAddr,
    tokens: Mutex<HashMap<String, Atadura>>,
    emitir_chat: Emisor,
    emitir_tareas: Emisor,
    reloj: Reloj,
    conexiones: AtomicUsize,
}

/// El servidor de las herramientas de la charla: uno por ejecución de Avis.
#[derive(Clone)]
pub struct McpAvis(Arc<Interno>);

/// Comparación de tiempo constante (el token).
fn iguales(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |x, (p, q)| x | (p ^ q)) == 0
}

impl McpAvis {
    /// Escucha en `127.0.0.1` con un puerto del sistema y atiende en sus hilos hasta que Avis sale.
    pub fn arrancar(carpeta: PathBuf, emitir_chat: Emisor, emitir_tareas: Emisor, reloj: Reloj) -> std::io::Result<McpAvis> {
        let oyente = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))?;
        let direccion = oyente.local_addr()?;
        let m = McpAvis(Arc::new(Interno { carpeta, direccion, tokens: Mutex::new(HashMap::new()), emitir_chat, emitir_tareas, reloj, conexiones: AtomicUsize::new(0) }));
        let servidor = m.clone();
        std::thread::Builder::new().name(String::from("avis-mcp")).spawn(move || {
            for conexion in oyente.incoming() {
                let Ok(s) = conexion else { continue };
                if servidor.0.conexiones.fetch_add(1, Ordering::SeqCst) >= TOPE_CONEXIONES {
                    servidor.0.conexiones.fetch_sub(1, Ordering::SeqCst);
                    continue;
                }
                let s2 = servidor.clone();
                let lanzado = std::thread::Builder::new().name(String::from("avis-mcp-pedido")).spawn(move || {
                    s2.atender(s);
                    s2.0.conexiones.fetch_sub(1, Ordering::SeqCst);
                });
                if lanzado.is_err() {
                    servidor.0.conexiones.fetch_sub(1, Ordering::SeqCst);
                }
            }
        })?;
        registrar(&format!("mcp: escuchando en 127.0.0.1:{}", direccion.port()));
        Ok(m)
    }

    #[cfg(test)]
    pub fn direccion(&self) -> SocketAddr {
        self.0.direccion
    }

    pub fn puerto(&self) -> u16 {
        self.0.direccion.port()
    }

    /// Un token nuevo de 32 bytes del generador del sistema, atado a la conversación (D-c7). `None`
    /// si el generador falla: entonces el proceso se lanza sin herramientas.
    pub fn nuevo_token(&self, conversacion: &str) -> Option<String> {
        let b = azar(32)?;
        let token: String = b.iter().map(|x| format!("{x:02x}")).collect();
        bloquear(&self.0.tokens).insert(token.clone(), Atadura { conversacion: conversacion.to_string(), turno: None, cambios: 0 });
        Some(token)
    }

    /// Empieza el turno `turno` de ese proceso: sus herramientas andan y el tope vuelve a cero.
    pub fn empezar_turno(&self, token: &str, turno: u64) {
        if let Some(a) = bloquear(&self.0.tokens).get_mut(token) {
            a.turno = Some(turno);
            a.cambios = 0;
        }
    }

    /// El turno terminó (su final, un corte o frenar): nada más cambia hasta el próximo mensaje.
    pub fn terminar_turno(&self, token: &str) {
        if let Some(a) = bloquear(&self.0.tokens).get_mut(token) {
            a.turno = None;
        }
    }

    /// El proceso salió: su token ya no sirve (401).
    pub fn revocar(&self, token: &str) {
        bloquear(&self.0.tokens).remove(token);
    }

    /// El token de la cabecera, si es uno vivo (comparado en tiempo constante).
    fn token_vivo(&self, autorizacion: Option<&str>) -> Option<String> {
        let dado = autorizacion?.strip_prefix("Bearer ")?;
        let tokens = bloquear(&self.0.tokens);
        let mut hallado = None;
        for t in tokens.keys() {
            if iguales(t.as_bytes(), dado.as_bytes()) {
                hallado = Some(t.clone());
            }
        }
        hallado
    }

    /// Una conexión: un pedido y su respuesta (siempre `Connection: close`), en 10 s como mucho.
    fn atender(&self, s: TcpStream) {
        let limite = Instant::now() + ESPERA_PEDIDO;
        let _ = s.set_read_timeout(Some(ESPERA_PEDIDO));
        let _ = s.set_write_timeout(Some(ESPERA_PEDIDO));
        let Ok(lectura) = s.try_clone() else { return };
        let mut lector = BufReader::new(lectura);
        let (codigo, cuerpo) = match self.leer_y_responder(&mut lector, &s, limite) {
            Ok(r) => r,
            Err(codigo) => (codigo, None),
        };
        let mut s = s;
        let _ = s.write_all(&respuesta(codigo, cuerpo.as_deref()));
        let _ = s.flush();
        // Lo que el cliente mandó y no se leyó (un 401 o un 413 antes del cuerpo) se descarta antes de
        // cerrar: si no, Windows corta con un RST y el cliente pierde la respuesta
        let _ = s.shutdown(std::net::Shutdown::Write);
        let _ = s.set_read_timeout(Some(Duration::from_millis(200)));
        let _ = std::io::copy(&mut lector.by_ref().take((TOPE_CUERPO + TOPE_CABECERAS) as u64), &mut std::io::sink());
    }

    fn leer_y_responder(&self, lector: &mut BufReader<TcpStream>, s: &TcpStream, limite: Instant) -> Result<(u16, Option<String>), u16> {
        let (metodo, ruta, cabeceras) = leer_cabeceras(lector, s, limite)?;
        let una = |k: &str| -> Result<Option<&str>, u16> {
            let v: Vec<&str> = cabeceras.iter().filter(|(n, _)| n == k).map(|(_, v)| v.as_str()).collect();
            match v.as_slice() {
                [] => Ok(None),
                [x] => Ok(Some(x)),
                _ => Err(400),
            }
        };
        // 11.1: los rechazos antes de leer el cuerpo
        if una("host")? != Some(format!("127.0.0.1:{}", self.puerto()).as_str()) {
            return Err(403);
        }
        if cabeceras.iter().any(|(n, _)| n == "origin") {
            return Err(403);
        }
        let token = self.token_vivo(una("authorization")?).ok_or(401u16)?;
        if ruta != "/mcp" {
            return Err(404);
        }
        if metodo != "POST" {
            return Err(405);
        }
        if una("transfer-encoding")?.is_some() {
            return Err(411);
        }
        let largo: usize = una("content-length")?.ok_or(411u16)?.trim().parse().map_err(|_| 400u16)?;
        if largo > TOPE_CUERPO {
            return Err(413);
        }
        let mut cuerpo = vec![0u8; largo];
        let restante = limite.saturating_duration_since(Instant::now());
        if restante.is_zero() {
            return Err(408);
        }
        let _ = s.set_read_timeout(Some(restante));
        lector.read_exact(&mut cuerpo).map_err(|_| 408u16)?;
        let pedido: Value = match serde_json::from_slice(&cuerpo) {
            Ok(v) => v,
            Err(_) => return Ok((200, Some(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "JSON inválido" } }).to_string()))),
        };
        Ok(match self.rpc(&token, &pedido) {
            Some(v) => (200, Some(v.to_string())),
            None => (202, None),
        })
    }

    /// Un pedido JSON-RPC: la respuesta, o `None` para una notificación (202).
    fn rpc(&self, token: &str, v: &Value) -> Option<Value> {
        let error = |id: &Value, code: i64, message: &str| json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } });
        if !v.is_object() {
            return Some(error(&Value::Null, -32600, "pedido inválido"));
        }
        let id = v.get("id")?.clone();
        let params = &v["params"];
        let resultado = match v["method"].as_str().unwrap_or_default() {
            "initialize" => {
                let pedida = params["protocolVersion"].as_str().filter(|p| VERSIONES_MCP.contains(p)).unwrap_or(VERSION_MCP);
                json!({ "protocolVersion": pedida, "capabilities": { "tools": { "listChanged": false } }, "serverInfo": { "name": "avis", "version": env!("CARGO_PKG_VERSION") } })
            }
            "ping" => json!({}),
            "tools/list" => json!({ "tools": definiciones() }),
            "tools/call" => {
                let nombre = params["name"].as_str().unwrap_or_default();
                if !NOMBRES.contains(&nombre) {
                    return Some(error(&id, -32601, "herramienta desconocida"));
                }
                self.llamar(token, nombre, &params["arguments"])
            }
            _ => return Some(error(&id, -32601, "método desconocido")),
        };
        Some(json!({ "jsonrpc": "2.0", "id": id, "result": resultado }))
    }

    /// `tools/call` de una de las cinco: solo con un turno en curso, con el tope de cambios; emite el
    /// cambio a la charla y los avisos de las listas.
    fn llamar(&self, token: &str, nombre: &str, args: &Value) -> Value {
        let resultado = |texto: &str, error: bool| json!({ "content": [{ "type": "text", "text": texto }], "isError": error });
        let (conversacion, turno, pasado) = {
            let mut tokens = bloquear(&self.0.tokens);
            let Some(a) = tokens.get_mut(token) else { return resultado(SIN_TURNO, true) };
            let Some(turno) = a.turno else { return resultado(SIN_TURNO, true) };
            let mut pasado = false;
            if ESCRIBEN.contains(&nombre) {
                a.cambios += 1;
                pasado = a.cambios > TOPE_CAMBIOS;
            }
            (a.conversacion.clone(), turno, pasado)
        };
        let vacio = Value::Object(Map::new());
        let args = if args.is_object() { args } else { &vacio };
        let hecho = if pasado {
            fallo_a_hecho(nombre, args, Fallo::from(TOPE))
        } else {
            match ejecutar(&self.0.carpeta, nombre, args, (self.0.reloj)()) {
                Some(h) => h,
                None => return resultado("herramienta desconocida", true),
            }
        };
        if let Some(cambio) = &hecho.cambio {
            (self.0.emitir_chat)(json!({ "conversacion": conversacion, "turno": turno, "tipo": hecho.tipo, "cambio": cambio }));
        }
        for t in &hecho.tocadas {
            (self.0.emitir_tareas)(t.clone());
        }
        resultado(&hecho.texto, hecho.error)
    }
}

/// La línea del pedido y sus cabeceras (nombres en minúsculas), con tope de 16 KB y el límite de tiempo.
fn leer_cabeceras(lector: &mut BufReader<TcpStream>, s: &TcpStream, limite: Instant) -> Result<(String, String, Vec<(String, String)>), u16> {
    let mut leidos = 0usize;
    let mut lineas: Vec<String> = Vec::new();
    loop {
        let restante = limite.saturating_duration_since(Instant::now());
        if restante.is_zero() {
            return Err(408);
        }
        let _ = s.set_read_timeout(Some(restante));
        let mut linea = Vec::new();
        let n = lector.by_ref().take((TOPE_CABECERAS - leidos + 1) as u64).read_until(b'\n', &mut linea).map_err(|_| 408u16)?;
        if n == 0 {
            return Err(400);
        }
        leidos += n;
        if leidos > TOPE_CABECERAS {
            return Err(431);
        }
        let texto = String::from_utf8(linea).map_err(|_| 400u16)?;
        let texto = texto.trim_end_matches(['\r', '\n']).to_string();
        if texto.is_empty() {
            if lineas.is_empty() {
                continue;
            }
            break;
        }
        lineas.push(texto);
    }
    let primera = lineas.remove(0);
    let partes: Vec<&str> = primera.split(' ').collect();
    let [metodo, ruta, version] = partes.as_slice() else { return Err(400) };
    if !version.starts_with("HTTP/1.") {
        return Err(400);
    }
    let mut cabeceras = Vec::new();
    for l in lineas {
        let (n, v) = l.split_once(':').ok_or(400u16)?;
        cabeceras.push((n.trim().to_ascii_lowercase(), v.trim().to_string()));
    }
    Ok((metodo.to_string(), ruta.to_string(), cabeceras))
}

fn respuesta(codigo: u16, cuerpo: Option<&str>) -> Vec<u8> {
    let razon = match codigo {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        408 => "Request Timeout",
        411 => "Length Required",
        413 => "Payload Too Large",
        _ => "Request Header Fields Too Large",
    };
    let mut r = format!("HTTP/1.1 {codigo} {razon}\r\nConnection: close\r\n");
    if codigo == 405 {
        r.push_str("Allow: POST\r\n");
    }
    match cuerpo {
        Some(c) => r.push_str(&format!("Content-Type: application/json\r\nContent-Length: {}\r\n\r\n{c}", c.len())),
        None => r.push_str("Content-Length: 0\r\n\r\n"),
    }
    r.into_bytes()
}

#[cfg(not(test))]
fn registrar(linea: &str) {
    if let Some(ruta) = crate::diagnostico::ruta_log() {
        let _ = crate::diagnostico::agregar_linea(&ruta, linea, chrono::Utc::now(), crate::diagnostico::TOPE_BYTES);
    }
}

#[cfg(test)]
fn registrar(_linea: &str) {}

#[cfg(test)]
#[path = "mcp_avis_tests.rs"]
mod tests;
