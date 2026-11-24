//! El historial de la charla en la PC (#22, docs/diseno/chat-avis-ux.md 9.1): un archivo por
//! conversación en `<config>/chat/<id>.json`, la fuente de verdad. Engram es solo la copia buscable
//! (`engram.rs`).
//!
//! - La ventana manda la conversación entera y Rust guarda solo el formato v1 de 9.1: lo que no es
//!   del formato no se escribe, y de los adjuntos quedan el nombre y el tamaño (D23), nunca la ruta.
//! - Escritura atómica (un `.tmp` propio y `rename`), de a una por vez en el proceso.
//! - Un archivo roto se salta al listar y se anota en `widget.log`; nunca se borra solo.

use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, PoisonError};

use crate::chat;

/// Cuántas charlas lista el cajón (9.1).
pub const TOPE_LISTA: usize = 100;
/// Cuánto texto de cada charla viaja con la lista para buscar (la búsqueda es de la ventana,
/// `coincideBusqueda`).
pub const TOPE_TEXTO_BUSCAR: usize = 32 * 1024;
/// Topes del formato: lo que pase de acá no es una charla de Avis.
const TOPE_MENSAJES: usize = 10_000;
const TOPE_TEXTO: usize = 2_000_000;
const TOPE_CORTO: usize = 300;
/// Hasta 5 archivos por mensaje (D27).
const TOPE_ADJUNTOS: usize = 5;
const TOPE_HERRAMIENTAS: usize = 500;

/// Una escritura por vez en todo el proceso: dos guardados a la vez no se pisan el `rename`.
static ESCRITURA: Mutex<()> = Mutex::new(());
static TEMPORALES: AtomicU64 = AtomicU64::new(0);

/// Un id de charla de Avis: `c-…` y lo que acepta `conversacion_valida` (sin rutas).
pub fn id_valido(id: &str) -> bool {
    id.len() > 2 && id.starts_with("c-") && chat::conversacion_valida(id)
}

/// `<carpeta>/<id>.json`, o `None` con un id inválido.
pub fn ruta(carpeta: &Path, id: &str) -> Option<PathBuf> {
    id_valido(id).then(|| carpeta.join(format!("{id}.json")))
}

fn texto(v: &Value, tope: usize) -> Option<String> {
    v.as_str().filter(|s| s.len() <= tope).map(str::to_string)
}

fn texto_o_nulo(v: &Value, tope: usize, nombre: &str) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        Value::String(_) => texto(v, tope).map(Value::String).ok_or_else(|| format!("{nombre} demasiado largo")),
        _ => Err(format!("{nombre} no es texto")),
    }
}

fn numero_o_nulo(v: &Value, nombre: &str) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        _ => v.as_u64().map(Value::from).ok_or_else(|| format!("{nombre} no es un número")),
    }
}

fn mensaje(m: &Value) -> Result<Value, String> {
    let rol = m["rol"].as_str().unwrap_or_default();
    let estado = m["estado"].as_str().unwrap_or_default();
    if !["ok", "frenada", "no-enviado", "error"].contains(&estado) {
        return Err(format!("estado de mensaje desconocido: {estado:?}"));
    }
    let mut x = Map::new();
    x.insert(String::from("rol"), json!(rol));
    x.insert(String::from("texto"), json!(texto(&m["texto"], TOPE_TEXTO).ok_or("texto de mensaje inválido")?));
    x.insert(String::from("cuando"), json!(texto(&m["cuando"], 40).ok_or("cuando inválido")?));
    x.insert(String::from("estado"), json!(estado));
    match rol {
        "usuario" => {
            let adjuntos = m["adjuntos"].as_array().map(Vec::as_slice).unwrap_or_default();
            if adjuntos.len() > TOPE_ADJUNTOS {
                return Err(String::from("demasiados adjuntos"));
            }
            let adjuntos = adjuntos
                .iter()
                .map(|a| {
                    Ok(json!({
                        "nombre": texto(&a["nombre"], 260).ok_or("adjunto sin nombre")?,
                        "tipo": texto(&a["tipo"], 20).ok_or("adjunto sin tipo")?,
                        "bytes": a["bytes"].as_u64().ok_or("adjunto sin tamaño")?,
                        "paginas": numero_o_nulo(&a["paginas"], "paginas")?,
                    }))
                })
                .collect::<Result<Vec<_>, String>>()?;
            x.insert(String::from("adjuntos"), Value::Array(adjuntos));
        }
        "mascota" => {
            let herramientas = m["herramientas"].as_array().map(Vec::as_slice).unwrap_or_default();
            if herramientas.len() > TOPE_HERRAMIENTAS {
                return Err(String::from("demasiadas herramientas"));
            }
            let herramientas = herramientas
                .iter()
                .map(|h| Ok(json!({ "nombre": texto(&h["nombre"], 40).ok_or("herramienta sin nombre")?, "detalle": texto(&h["detalle"], TOPE_CORTO).ok_or("detalle inválido")? })))
                .collect::<Result<Vec<_>, String>>()?;
            x.insert(String::from("herramientas"), Value::Array(herramientas));
            x.insert(String::from("ms"), numero_o_nulo(&m["ms"], "ms")?);
            // El turno llevó el contexto de Avis ("↳ Miró tus sesiones de Avis", 4.1)
            if m["avis"] == json!(true) {
                x.insert(String::from("avis"), json!(true));
            }
        }
        _ => return Err(format!("rol desconocido: {rol:?}")),
    }
    Ok(Value::Object(x))
}

/// El formato v1 de 9.1, solo con sus campos. `engramId` no lo decide la ventana (queda nulo acá).
pub fn normalizar(doc: &Value) -> Result<Value, String> {
    if doc["v"] != json!(1) {
        return Err(String::from("versión desconocida"));
    }
    let id = doc["id"].as_str().filter(|id| id_valido(id)).ok_or("id de charla inválido")?;
    let motor = doc["motor"].as_str().filter(|m| *m == "claude" || *m == "local").ok_or("motor desconocido")?;
    let sesion = match &doc["sesionClaude"] {
        Value::Null => Value::Null,
        v => json!(v.as_str().filter(|s| chat::sesion_valida(s)).ok_or("sesión de Claude Code inválida")?),
    };
    let mensajes = doc["mensajes"].as_array().ok_or("sin mensajes")?;
    if mensajes.len() > TOPE_MENSAJES {
        return Err(String::from("demasiados mensajes"));
    }
    let mensajes = mensajes.iter().map(mensaje).collect::<Result<Vec<_>, String>>()?;
    Ok(json!({
        "v": 1,
        "id": id,
        "titulo": texto_o_nulo(&doc["titulo"], TOPE_CORTO, "titulo")?,
        "creada": texto(&doc["creada"], 40).ok_or("creada inválida")?,
        "actualizada": texto(&doc["actualizada"], 40).ok_or("actualizada inválida")?,
        "motor": motor,
        // El motor local no tiene carpeta (3.4)
        "carpeta": if motor == "local" { Value::Null } else { texto_o_nulo(&doc["carpeta"], 1024, "carpeta")? },
        "sesionClaude": sesion,
        "engramId": Value::Null,
        "mensajes": mensajes,
    }))
}

fn bloquear() -> std::sync::MutexGuard<'static, ()> {
    ESCRITURA.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Escribe `<id>.json` con un temporal propio y `rename` (con el candado tomado).
fn escribir(carpeta: &Path, id: &str, doc: &Value) -> Result<(), String> {
    let destino = ruta(carpeta, id).ok_or("id de charla inválido")?;
    fs::create_dir_all(carpeta).map_err(|e| e.to_string())?;
    let n = TEMPORALES.fetch_add(1, Ordering::Relaxed);
    let temporal = carpeta.join(format!("{id}.json.{}-{n}.tmp", std::process::id()));
    let resultado = fs::write(&temporal, serde_json::to_vec(doc).map_err(|e| e.to_string())?).and_then(|()| fs::rename(&temporal, &destino));
    if resultado.is_err() {
        let _ = fs::remove_file(&temporal);
    }
    resultado.map_err(|e| e.to_string())
}

fn leer_archivo(carpeta: &Path, id: &str) -> Result<Value, String> {
    let r = ruta(carpeta, id).ok_or("id de charla inválido")?;
    let texto = fs::read(&r).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_slice(&texto).map_err(|e| format!("archivo roto: {e}"))?;
    let mut doc = normalizar(&v)?;
    if v["id"] != json!(id) {
        return Err(String::from("el archivo es de otra charla"));
    }
    doc["engramId"] = v["engramId"].as_u64().map(Value::from).unwrap_or(Value::Null);
    Ok(doc)
}

/// Guarda la conversación (al mandar, en cada final y cada 2 s mientras llega texto; 9.1). Conserva el
/// `engramId` que ya tenía el archivo. Devuelve lo guardado.
pub fn guardar(carpeta: &Path, doc: &Value) -> Result<Value, String> {
    let mut limpio = normalizar(doc)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let _candado = bloquear();
    if let Ok(antes) = leer_archivo(carpeta, &id) {
        limpio["engramId"] = antes["engramId"].clone();
    }
    escribir(carpeta, &id, &limpio)?;
    Ok(limpio)
}

/// La conversación completa (`chat_leer`).
pub fn leer(carpeta: &Path, id: &str) -> Result<Value, String> {
    leer_archivo(carpeta, id)
}

/// Anota el id de la observación de Engram (9.2) en un archivo que ya existe.
pub fn poner_engram(carpeta: &Path, id: &str, engram_id: u64) -> Result<(), String> {
    let _candado = bloquear();
    let mut doc = leer_archivo(carpeta, id)?;
    doc["engramId"] = json!(engram_id);
    escribir(carpeta, id, &doc)
}

/// Borra el archivo de la charla. Devuelve su `engramId` (para borrar también la copia de Engram).
/// Lo que ya no existe no es un error.
pub fn borrar(carpeta: &Path, id: &str) -> Result<Option<u64>, String> {
    let r = ruta(carpeta, id).ok_or("id de charla inválido")?;
    let _candado = bloquear();
    let engram = leer_archivo(carpeta, id).ok().and_then(|d| d["engramId"].as_u64());
    match fs::remove_file(&r) {
        Ok(()) => Ok(engram),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// El texto de la charla para buscar (título aparte): los mensajes, uno por línea, con tope.
fn texto_para_buscar(doc: &Value) -> String {
    let mut t = String::new();
    for m in doc["mensajes"].as_array().map(Vec::as_slice).unwrap_or_default() {
        let s = m["texto"].as_str().unwrap_or_default();
        if s.is_empty() {
            continue;
        }
        if !t.is_empty() {
            t.push('\n');
        }
        t.push_str(s);
        if t.len() >= TOPE_TEXTO_BUSCAR {
            break;
        }
    }
    if t.len() > TOPE_TEXTO_BUSCAR {
        let mut corte = TOPE_TEXTO_BUSCAR;
        while !t.is_char_boundary(corte) {
            corte -= 1;
        }
        t.truncate(corte);
    }
    t
}

/// Las 100 más recientes por fecha de modificación (`chat_historial`): todo menos los mensajes, más
/// `texto` para buscar. Un archivo roto se salta y se anota.
pub fn listar(carpeta: &Path) -> Vec<Value> {
    let Ok(entradas) = fs::read_dir(carpeta) else { return Vec::new() };
    let mut archivos: Vec<(std::time::SystemTime, String)> = entradas
        .filter_map(Result::ok)
        .filter_map(|e| {
            let nombre = e.file_name().to_string_lossy().into_owned();
            let id = nombre.strip_suffix(".json")?.to_string();
            let meta = e.metadata().ok().filter(fs::Metadata::is_file)?;
            id_valido(&id).then(|| (meta.modified().unwrap_or(std::time::UNIX_EPOCH), id))
        })
        .collect();
    archivos.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    let mut lista = Vec::new();
    for (_, id) in archivos {
        if lista.len() >= TOPE_LISTA {
            break;
        }
        match leer_archivo(carpeta, &id) {
            Ok(mut doc) => {
                let texto = texto_para_buscar(&doc);
                if let Some(o) = doc.as_object_mut() {
                    o.remove("mensajes");
                    o.insert(String::from("texto"), json!(texto));
                }
                lista.push(doc);
            }
            Err(e) => registrar(&format!("chat: historial: se salta {id}.json ({e})")),
        }
    }
    lista
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
#[path = "historial_tests.rs"]
mod tests;
