//! El historial de la charla en la PC (#22, docs/diseno/chat-avis-ux.md 9.1): un archivo por
//! conversación en `<config>/chat/<id>.json`, la fuente de verdad. Engram es solo la copia buscable
//! (`engram.rs`).
//!
//! - La ventana manda la conversación entera y Rust guarda solo el formato v1 de 9.1: lo que no es
//!   del formato no se escribe, y de los adjuntos quedan el nombre y el tamaño (D23), nunca la ruta.
//! - Escritura atómica (un `.tmp` propio y `rename`), de a una por vez en el proceso.
//! - Un archivo roto se salta al listar y se anota en `widget.log`; nunca se borra solo.
//! - Los cambios de la charla en las tareas (#43, chat-herramientas-ux.md 11.8) van con el mensaje de
//!   la mascota (`cambios`, opcional): uno que no sirve se descarta sin rechazar la charla.

use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
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
/// Cambios por mensaje (11.8, D-c16): 20 que escriben, y aparte hasta 10 lecturas o "para borrar".
const TOPE_CAMBIOS: usize = 20;
const TOPE_LECTURAS: usize = 10;
/// Las herramientas que dejan cambios (#43, 11.4) y sus estados (11.8).
const HERRAMIENTAS_AVIS: [&str; 5] = ["tareas_ver", "tarea_crear", "tarea_editar", "tarea_tildar", "tarea_mostrar"];
const ESTADOS_CAMBIO: [&str; 6] = ["hecho", "deshecho", "cambio-despues", "error", "lectura", "mostrar"];

/// Una escritura por vez en todo el proceso: dos guardados a la vez no se pisan el `rename`.
static ESCRITURA: Mutex<()> = Mutex::new(());

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
            // Los cambios de la charla en las tareas (#43): solo si hay alguno, así una charla de antes
            // se guarda igual
            let cambios = cambios_de(&m["cambios"]);
            if !cambios.is_empty() {
                x.insert(String::from("cambios"), Value::Array(cambios));
            }
            // El turno llevó el contexto de Avis ("↳ Miró tus sesiones de Avis", 4.1)
            if m["avis"] == json!(true) {
                x.insert(String::from("avis"), json!(true));
            }
        }
        _ => return Err(format!("rol desconocido: {rol:?}")),
    }
    Ok(Value::Object(x))
}

/// Un texto de hasta `tope` caracteres, o `null`.
fn corto_o_nulo(v: &Value, tope: usize) -> Option<Value> {
    match v {
        Value::Null => Some(Value::Null),
        Value::String(s) if s.chars().count() <= tope => Some(v.clone()),
        _ => None,
    }
}

/// Un id con su prefijo (`l-`, `t-`, `c-`), o `null`.
fn id_o_nulo(v: &Value, prefijo: &str) -> Option<Value> {
    match v {
        Value::Null => Some(Value::Null),
        Value::String(s) if s.len() <= 40 && s.len() > prefijo.len() && s.starts_with(prefijo) && s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') => Some(v.clone()),
        _ => None,
    }
}

fn fecha_o_nulo(v: &Value) -> Option<Value> {
    match v {
        Value::Null => Some(Value::Null),
        Value::String(s) if s.len() == 10 && chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok() => Some(v.clone()),
        _ => None,
    }
}

/// `antes` y `despues` (11.8): solo los campos que tocan las herramientas, cada uno con su forma.
fn campos_de_tarea(v: &Value) -> Option<Value> {
    if v.is_null() {
        return Some(Value::Null);
    }
    let o = v.as_object()?;
    let mut x = Map::new();
    for (k, valor) in o {
        let bueno = match k.as_str() {
            "titulo" => corto_o_nulo(valor, 200).filter(|v| v.is_string()),
            "fecha" => fecha_o_nulo(valor),
            "hecha" | "importante" => valor.is_boolean().then(|| valor.clone()),
            "hechaEn" => (valor.is_null() || valor.is_u64()).then(|| valor.clone()),
            "notas" => corto_o_nulo(valor, 4000).filter(|v| v.is_string()),
            "lista" => id_o_nulo(valor, "l-").filter(|v| v.is_string()),
            _ => continue,
        };
        x.insert(k.clone(), bueno?);
    }
    Some(Value::Object(x))
}

/// `args` de un error (para «Reintentar», 11.9): solo las claves de las herramientas.
fn args_de(v: &Value) -> Option<Value> {
    if v.is_null() {
        return Some(Value::Null);
    }
    let o = v.as_object()?;
    let mut x = Map::new();
    for (k, valor) in o {
        let bueno = match k.as_str() {
            "titulo" => corto_o_nulo(valor, 200),
            "lista" => corto_o_nulo(valor, 100),
            "fecha" => corto_o_nulo(valor, 40),
            "notas" => corto_o_nulo(valor, 4000),
            "id" => corto_o_nulo(valor, 40),
            "importante" | "hecha" => valor.is_boolean().then(|| valor.clone()),
            _ => continue,
        };
        x.insert(k.clone(), bueno?);
    }
    Some(Value::Object(x))
}

/// El resumen de una lectura o de "para borrar" (4.5, 4.6): la vista, las cuentas y hasta 6 filas.
fn resumen_de(v: &Value) -> Option<Value> {
    if v.is_null() {
        return Some(Value::Null);
    }
    let o = v.as_object()?;
    let mut x = Map::new();
    for (k, valor) in o {
        let bueno = match k.as_str() {
            "vista" => valor.as_str().filter(|s| ["hoy", "vencidas", "lista", "todas"].contains(s)).map(|_| valor.clone()),
            "para" => valor.as_str().filter(|s| *s == "borrar" || *s == "ver").map(|_| valor.clone()),
            "nombre" => corto_o_nulo(valor, 40),
            "hoy" => fecha_o_nulo(valor),
            "hechas" | "total" | "mas" => valor.is_u64().then(|| valor.clone()),
            "filas" => {
                let filas = valor.as_array()?;
                if filas.len() > 6 {
                    return None;
                }
                let filas = filas
                    .iter()
                    .map(|f| {
                        Some(json!({
                            "tarea": id_o_nulo(&f["tarea"], "t-").filter(Value::is_string)?,
                            "lista": id_o_nulo(&f["lista"], "l-").filter(Value::is_string)?,
                            "titulo": corto_o_nulo(&f["titulo"], 200).filter(Value::is_string)?,
                            "fecha": fecha_o_nulo(&f["fecha"])?,
                            "hecha": f["hecha"].as_bool()?,
                            "importante": f["importante"].as_bool()?,
                        }))
                    })
                    .collect::<Option<Vec<_>>>()?;
                Some(Value::Array(filas))
            }
            _ => continue,
        };
        x.insert(k.clone(), bueno?);
    }
    Some(Value::Object(x))
}

/// Un cambio de la charla (11.8) con su forma, o `None` si no sirve.
fn cambio(c: &Value) -> Option<Value> {
    let herramienta = c["herramienta"].as_str().filter(|h| HERRAMIENTAS_AVIS.contains(h))?;
    let estado = c["estado"].as_str().filter(|e| ESTADOS_CAMBIO.contains(e))?;
    let mut x = json!({
        "id": id_o_nulo(&c["id"], "c-").filter(Value::is_string)?,
        "herramienta": herramienta,
        "estado": estado,
        "lista": id_o_nulo(&c["lista"], "l-")?,
        "tarea": id_o_nulo(&c["tarea"], "t-")?,
        "titulo": corto_o_nulo(&c["titulo"], 200)?,
        "antes": campos_de_tarea(&c["antes"])?,
        "despues": campos_de_tarea(&c["despues"])?,
        "motivo": corto_o_nulo(&c["motivo"], TOPE_CORTO)?,
        "reintentable": c["reintentable"] == json!(true),
        "args": args_de(&c["args"])?,
    });
    if c.get("resumen").is_some() {
        x["resumen"] = resumen_de(&c["resumen"])?;
    }
    Some(x)
}

/// Los cambios de un mensaje de la mascota: los que sirven, en orden y con tope.
fn cambios_de(v: &Value) -> Vec<Value> {
    let Some(lista) = v.as_array() else { return Vec::new() };
    let (mut escriben, mut leen) = (0, 0);
    let mut r = Vec::new();
    for c in lista {
        let Some(c) = cambio(c) else {
            registrar("chat: historial: se descarta un cambio que no sirve");
            continue;
        };
        let lee = c["estado"] == "lectura" || c["estado"] == "mostrar";
        let (cuenta, tope) = if lee { (&mut leen, TOPE_LECTURAS) } else { (&mut escriben, TOPE_CAMBIOS) };
        if *cuenta < tope {
            *cuenta += 1;
            r.push(c);
        }
    }
    r
}

/// El formato v1 de 9.1, solo con sus campos (más `modelo`, opcional, de #35). `engramId` no lo
/// decide la ventana (queda nulo acá).
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
    let mut limpio = json!({
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
    });
    // El modelo de la charla (#35), opcional: solo uno de `chat::MODELOS`; si no, "Por defecto" (sin
    // la clave, como las charlas de antes). El motor local no tiene modelo, como no tiene carpeta (S4)
    if let Some(m) = doc["modelo"].as_str().filter(|m| motor != "local" && chat::modelo_valido(m)) {
        limpio["modelo"] = json!(m);
    }
    Ok(limpio)
}

fn bloquear() -> std::sync::MutexGuard<'static, ()> {
    ESCRITURA.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Escribe `<id>.json` con un temporal propio y `rename` (con el candado tomado; `atomico.rs`).
fn escribir(carpeta: &Path, id: &str, doc: &Value) -> Result<(), String> {
    let destino = ruta(carpeta, id).ok_or("id de charla inválido")?;
    crate::atomico::escribir(&destino, &serde_json::to_vec(doc).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
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

/// Todas las charlas de la carpeta, sin tope y rotas incluidas: `(id, bytes)` de cada `c-….json`.
/// Lo que no es una charla de Avis (otro nombre, una carpeta) no cuenta.
fn charlas(carpeta: &Path) -> Vec<(String, u64)> {
    let Ok(entradas) = fs::read_dir(carpeta) else { return Vec::new() };
    entradas
        .filter_map(Result::ok)
        .filter_map(|e| {
            let nombre = e.file_name().to_string_lossy().into_owned();
            let id = nombre.strip_suffix(".json")?.to_string();
            let meta = e.metadata().ok().filter(fs::Metadata::is_file)?;
            id_valido(&id).then(|| (id, meta.len()))
        })
        .collect()
}

/// Cuántas charlas hay y cuánto ocupan (configuración, pestaña Datos: "{n} charlas · {mb} MB").
pub fn contar(carpeta: &Path) -> (usize, u64) {
    let todas = charlas(carpeta);
    (todas.len(), todas.iter().map(|(_, b)| b).sum())
}

/// Lo que dejó "Borrar todo": cuántas se borraron, cuántas no, y los ids de sus copias en Engram.
#[derive(Debug, Clone, Default)]
pub struct BorradoTodo {
    pub borradas: usize,
    pub fallidas: usize,
    pub engram: Vec<u64>,
}

/// "Borrar todo" de la pestaña Datos: borra cada charla (como `borrar`, de a una) y junta los ids
/// de Engram para borrar también sus copias. Lo que no es una charla de Avis queda.
pub fn borrar_todo(carpeta: &Path) -> BorradoTodo {
    let mut r = BorradoTodo::default();
    for (id, _) in charlas(carpeta) {
        match borrar(carpeta, &id) {
            Ok(engram) => {
                r.borradas += 1;
                r.engram.extend(engram);
            }
            Err(e) => {
                r.fallidas += 1;
                registrar(&format!("chat: borrar todo: no se borró {id}.json ({e})"));
            }
        }
    }
    r
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
