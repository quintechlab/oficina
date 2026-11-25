//! Las listas de tareas en la PC (#39, docs/diseno/tareas-ux.md 11.1 y 11.3): un archivo por lista
//! en `<config>/tareas/<id>.json`.
//!
//! - La ventana manda la lista entera y Rust guarda el formato v1: lo que no es del formato no se
//!   escribe, los topes recortan (y se anota), y una lista que no sirve se rechaza sin tocar el archivo.
//! - Los campos que este Avis no conoce y ya estaban en el archivo (de una versión futura) se conservan.
//! - Escritura atómica (`atomico.rs`, la misma del historial del chat), de a una por vez en el proceso.
//! - Un archivo roto se informa (`rotas`) y se anota en `widget.log`; nunca se pisa ni se borra.
//! - Dos escritores (#43, chat-herramientas-ux.md 11.5): la ventana guarda la lista entera con la
//!   `huella` (SHA-256 de los bytes) de lo que leyó; si el archivo cambió desde entonces, no escribe
//!   (`guardar_si` → "cambio"). El servidor de la charla (`mcp_avis.rs`) cambia con `modificar`:
//!   lee, cambia y escribe con el mismo candado, nunca con un documento armado aparte.
//!
//! Formato v1: `{ v: 1, id: "l-…", nombre, color, orden, creada: ms, tareas: [{ id: "t-…", titulo,
//! hecha, hechaEn: ms | null, fecha: "AAAA-MM-DD" | null, importante, notas, subtareas: [{ id, titulo,
//! hecha }], creada: ms }] }`.

use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

/// Topes de 11.1 (D-n9): recortan.
const TOPE_NOMBRE: usize = 40;
const TOPE_TITULO: usize = 200;
const TOPE_NOTAS: usize = 4_000;
const TOPE_SUBTAREAS: usize = 50;
/// Tope de forma: más que esto no es una lista de Avis.
const TOPE_TAREAS: usize = 5_000;
const TOPE_ID: usize = 40;
/// Los colores de lista (6); otro valor se lee como el primero.
pub const COLORES: [&str; 6] = ["celeste", "verde", "rosa", "violeta", "ambar", "rojo"];

/// Las claves del formato: lo demás que traiga el archivo se conserva; lo demás que mande la ventana, no.
const CLAVES_LISTA: [&str; 7] = ["v", "id", "nombre", "color", "orden", "creada", "tareas"];
const CLAVES_TAREA: [&str; 9] = ["id", "titulo", "hecha", "hechaEn", "fecha", "importante", "notas", "subtareas", "creada"];
const CLAVES_SUBTAREA: [&str; 3] = ["id", "titulo", "hecha"];

static ESCRITURA: Mutex<()> = Mutex::new(());

/// Un id de 11.1 (`^[a-z0-9-]{1,40}$`) que empieza con su prefijo (`l-`, `t-`, `s-`): nunca `..`, una
/// barra, un punto ni un nombre reservado de Windows (`con`, `nul`… no tienen prefijo).
pub(crate) fn id_con(prefijo: &str, id: &str) -> bool {
    id.len() <= TOPE_ID
        && id.len() > prefijo.len()
        && id.starts_with(prefijo)
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Un id de lista: `l-…`.
pub fn id_valido(id: &str) -> bool {
    id_con("l-", id)
}

fn ruta(carpeta: &Path, id: &str) -> Option<PathBuf> {
    id_valido(id).then(|| carpeta.join(format!("{id}.json")))
}

/// Texto recortado a `tope` caracteres (lo anota). `vacio`: si puede quedar vacío sin los espacios.
fn texto(v: &Value, tope: usize, vacio: bool, nombre: &str) -> Result<String, String> {
    let s = v.as_str().ok_or_else(|| format!("{nombre} no es texto"))?;
    if !vacio && s.trim().is_empty() {
        return Err(format!("{nombre} vacío"));
    }
    if s.chars().count() > tope {
        registrar(&format!("tareas: {nombre} recortado a {tope} caracteres"));
        return Ok(s.chars().take(tope).collect());
    }
    Ok(s.to_string())
}

fn booleano(v: &Value, nombre: &str) -> Result<bool, String> {
    match v {
        Value::Null => Ok(false),
        Value::Bool(b) => Ok(*b),
        _ => Err(format!("{nombre} no es sí o no")),
    }
}

/// Un instante en ms, o `null`.
pub(crate) fn ms(v: &Value, nombre: &str) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        _ => v.as_u64().map(Value::from).ok_or_else(|| format!("{nombre} no es un número")),
    }
}

/// `AAAA-MM-DD` de un día que existe, o `null`.
pub(crate) fn fecha(v: &Value) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        Value::String(s) if s.len() == 10 && chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok() => Ok(v.clone()),
        _ => Err(String::from("fecha inválida")),
    }
}

/// Los ids de `items` (en `clave`) no se repiten.
fn sin_repetir(items: &[Value]) -> bool {
    let mut vistos = HashSet::new();
    items.iter().all(|x| vistos.insert(x["id"].as_str().unwrap_or_default().to_string()))
}

fn subtarea(s: &Value) -> Result<Value, String> {
    let id = s["id"].as_str().filter(|i| id_con("s-", i)).ok_or("id de subtarea inválido")?;
    Ok(json!({ "id": id, "titulo": texto(&s["titulo"], TOPE_TITULO, false, "subtarea")?, "hecha": booleano(&s["hecha"], "hecha")? }))
}

fn tarea(t: &Value) -> Result<Value, String> {
    let id = t["id"].as_str().filter(|i| id_con("t-", i)).ok_or("id de tarea inválido")?;
    let subtareas: Vec<Value> = match &t["subtareas"] {
        Value::Null => Vec::new(),
        Value::Array(a) => {
            if a.len() > TOPE_SUBTAREAS {
                registrar(&format!("tareas: subtareas recortadas a {TOPE_SUBTAREAS}"));
            }
            a.iter().take(TOPE_SUBTAREAS).map(subtarea).collect::<Result<_, _>>()?
        }
        _ => return Err(String::from("subtareas inválidas")),
    };
    if !sin_repetir(&subtareas) {
        return Err(String::from("id de subtarea repetido"));
    }
    let notas = match &t["notas"] {
        Value::Null => String::new(),
        v => texto(v, TOPE_NOTAS, true, "notas")?,
    };
    Ok(json!({
        "id": id,
        "titulo": texto(&t["titulo"], TOPE_TITULO, false, "título")?,
        "hecha": booleano(&t["hecha"], "hecha")?,
        "hechaEn": ms(&t["hechaEn"], "hechaEn")?,
        "fecha": fecha(&t["fecha"])?,
        "importante": booleano(&t["importante"], "importante")?,
        "notas": notas,
        "subtareas": subtareas,
        "creada": ms(&t["creada"], "creada")?,
    }))
}

/// La lista en el formato v1 (solo sus claves), o por qué no sirve.
pub fn normalizar(doc: &Value) -> Result<Value, String> {
    if doc["v"] != json!(1) {
        return Err(String::from("versión desconocida"));
    }
    let id = doc["id"].as_str().filter(|i| id_valido(i)).ok_or("id de lista inválido")?;
    let tareas: Vec<Value> = match &doc["tareas"] {
        Value::Null => Vec::new(),
        Value::Array(a) if a.len() <= TOPE_TAREAS => a.iter().map(tarea).collect::<Result<_, _>>()?,
        _ => return Err(String::from("tareas inválidas")),
    };
    if !sin_repetir(&tareas) {
        return Err(String::from("id de tarea repetido"));
    }
    let color = doc["color"].as_str().filter(|c| COLORES.contains(c)).unwrap_or(COLORES[0]);
    Ok(json!({
        "v": 1,
        "id": id,
        "nombre": texto(&doc["nombre"], TOPE_NOMBRE, false, "nombre")?.trim(),
        "color": color,
        "orden": doc["orden"].as_u64().unwrap_or(0),
        "creada": ms(&doc["creada"], "creada")?,
        "tareas": tareas,
    }))
}

/// Las claves de `de` que no son del formato.
pub(crate) fn desconocidas(de: &Value, conocidas: &[&str]) -> Map<String, Value> {
    de.as_object()
        .map(|o| o.iter().filter(|(k, _)| !conocidas.contains(&k.as_str())).map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}

/// Suma a cada elemento de `nuevos[clave]` lo desconocido de su par (mismo id) en `viejos[clave]`.
fn conservar_items(nuevos: &mut Value, viejos: &Value, clave: &str, conocidas: &[&str]) {
    let Some(lista) = nuevos[clave].as_array_mut() else { return };
    for x in lista {
        let Some(viejo) = viejos[clave].as_array().and_then(|a| a.iter().find(|v| v["id"] == x["id"])) else { continue };
        if let Some(o) = x.as_object_mut() {
            o.extend(desconocidas(viejo, conocidas));
        }
        if clave == "tareas" {
            conservar_items(x, viejo, "subtareas", &CLAVES_SUBTAREA);
        }
    }
}

/// Suma a `limpio` lo desconocido que ya tenía el archivo: de la lista, de cada tarea y de cada
/// subtarea (por id).
fn conservar(limpio: &mut Value, archivo: &Value) {
    if let Some(o) = limpio.as_object_mut() {
        o.extend(desconocidas(archivo, &CLAVES_LISTA));
    }
    conservar_items(limpio, archivo, "tareas", &CLAVES_TAREA);
}

/// La huella de un archivo de lista (11.5): SHA-256 de sus bytes, en hexadecimal.
pub fn huella(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|b| format!("{b:02x}")).collect()
}

/// Lee `<id>.json` tal cual está, si sirve: el valor crudo (con sus desconocidas) y su huella, o por qué no.
fn leer_con_huella(r: &Path, id: &str) -> Result<(Value, String), String> {
    let bytes = fs::read(r).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|e| format!("no es JSON: {e}"))?;
    let d = normalizar(&v)?;
    if d["id"] != json!(id) {
        return Err(String::from("el archivo es de otra lista"));
    }
    Ok((v, huella(&bytes)))
}

fn leer_crudo(r: &Path, id: &str) -> Result<Value, String> {
    leer_con_huella(r, id).map(|(v, _)| v)
}

fn bloquear() -> std::sync::MutexGuard<'static, ()> {
    ESCRITURA.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Guarda la lista (atómico) y devuelve lo guardado. Nunca pisa un archivo roto.
#[cfg(test)]
pub fn guardar(carpeta: &Path, doc: &Value) -> Result<Value, String> {
    guardar_si(carpeta, doc, None).map(|(limpio, _)| limpio)
}

/// `guardar` con la huella de lo que leyó la ventana (11.5): si el archivo ya no tiene esa huella (lo
/// cambió la charla, o ya no está), no escribe y el error es `"cambio"`. Sin huella, guarda como
/// siempre. Devuelve lo guardado y su huella nueva.
pub fn guardar_si(carpeta: &Path, doc: &Value, huella_leida: Option<&str>) -> Result<(Value, String), String> {
    let mut limpio = normalizar(doc)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let destino = ruta(carpeta, &id).ok_or("id de lista inválido")?;
    let _candado = bloquear();
    if let Some(h) = huella_leida {
        let actual = fs::read(&destino).ok().map(|b| huella(&b));
        if actual.as_deref() != Some(h) {
            return Err(String::from("cambio"));
        }
    }
    if destino.exists() {
        let archivo = leer_crudo(&destino, &id).map_err(|e| format!("el archivo de la lista está roto ({e}): no se pisa"))?;
        conservar(&mut limpio, &archivo);
    }
    let bytes = serde_json::to_vec(&limpio).map_err(|e| e.to_string())?;
    crate::atomico::escribir(&destino, &bytes).map_err(|e| e.to_string())?;
    Ok((limpio, huella(&bytes)))
}

/// Por qué no se pudo `modificar` una lista.
#[derive(Debug)]
pub enum Falla {
    /// No hay un archivo de esa lista (o el id no es de lista).
    NoExiste,
    /// El archivo está roto: no se toca.
    Rota,
    /// No se pudo escribir (el disco): no cambió nada.
    Disco(String),
    /// Lo dijo el cambio (`f`), o lo que dejó no es una lista del formato: no se escribe.
    Regla(String),
}

/// Lee la lista `id`, la cambia con `f` y la escribe, todo con el candado de las escrituras tomado
/// (11.4): la ventana y la charla nunca se pisan a medias. `f` recibe la lista del formato con sus
/// claves desconocidas; lo que deja se normaliza (los topes recortan) y lo desconocido del archivo se
/// conserva. Devuelve lo que devolvió `f` y lo guardado.
pub fn modificar<R>(carpeta: &Path, id: &str, f: impl FnOnce(&mut Value) -> Result<R, String>) -> Result<(R, Value), Falla> {
    let destino = ruta(carpeta, id).ok_or(Falla::NoExiste)?;
    let _candado = bloquear();
    if !destino.is_file() {
        return Err(Falla::NoExiste);
    }
    let crudo = leer_crudo(&destino, id).map_err(|e| {
        registrar(&format!("tareas: {id}.json: {e}"));
        Falla::Rota
    })?;
    let mut doc = normalizar(&crudo).map_err(|_| Falla::Rota)?;
    conservar(&mut doc, &crudo);
    let r = f(&mut doc).map_err(Falla::Regla)?;
    let mut limpio = normalizar(&doc).map_err(Falla::Regla)?;
    if limpio["id"] != json!(id) {
        return Err(Falla::Regla(String::from("el cambio es de otra lista")));
    }
    conservar(&mut limpio, &crudo);
    let bytes = serde_json::to_vec(&limpio).map_err(|e| Falla::Disco(e.to_string()))?;
    crate::atomico::escribir(&destino, &bytes).map_err(|e| Falla::Disco(e.to_string()))?;
    Ok((r, limpio))
}

/// Crea el archivo de una lista nueva (#43: la primera tarea de la charla sin listas), con el candado de
/// las escrituras tomado. Nunca pisa un archivo que ya está, aunque esté roto: entonces `Regla`.
pub fn crear(carpeta: &Path, doc: &Value) -> Result<Value, Falla> {
    let limpio = normalizar(doc).map_err(Falla::Regla)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let destino = ruta(carpeta, &id).ok_or_else(|| Falla::Regla(String::from("id de lista inválido")))?;
    let _candado = bloquear();
    if destino.exists() {
        return Err(Falla::Regla(String::from("la lista ya existe")));
    }
    fs::create_dir_all(carpeta).map_err(|e| Falla::Disco(e.to_string()))?;
    let bytes = serde_json::to_vec(&limpio).map_err(|e| Falla::Disco(e.to_string()))?;
    crate::atomico::escribir(&destino, &bytes).map_err(|e| Falla::Disco(e.to_string()))?;
    Ok(limpio)
}

/// Borra el archivo de la lista (con sus tareas). Lo que ya no existe no es un error; un archivo
/// roto no se borra.
pub fn borrar(carpeta: &Path, id: &str) -> Result<(), String> {
    let r = ruta(carpeta, id).ok_or("id de lista inválido")?;
    let _candado = bloquear();
    if !r.exists() {
        return Ok(());
    }
    leer_crudo(&r, id).map_err(|e| format!("el archivo de la lista está roto ({e}): no se borra"))?;
    fs::remove_file(&r).map_err(|e| e.to_string())
}

/// Lo que lee `tareas_leer`: las listas que sirven, en orden, los archivos rotos (`{ archivo, motivo }`)
/// y la huella de cada lista que sirve (por id, 11.5).
#[derive(Debug, Default)]
pub struct Lectura {
    pub listas: Vec<Value>,
    pub rotas: Vec<Value>,
    pub huellas: HashMap<String, String>,
}

/// Todas las listas, ordenadas por `orden`, `creada` e id (con sus claves desconocidas). Un archivo
/// `l-….json` que no se puede leer, no es del formato o es de otra lista va en `rotas`.
pub fn listar(carpeta: &Path) -> Lectura {
    let mut l = Lectura::default();
    let Ok(entradas) = fs::read_dir(carpeta) else { return l };
    for e in entradas.filter_map(Result::ok) {
        let archivo = e.file_name().to_string_lossy().into_owned();
        let Some(id) = archivo.strip_suffix(".json").filter(|i| id_valido(i)) else { continue };
        if !e.metadata().is_ok_and(|m| m.is_file()) {
            continue;
        }
        match leer_con_huella(&e.path(), id).and_then(|(crudo, h)| {
            let mut d = normalizar(&crudo)?;
            conservar(&mut d, &crudo);
            Ok((d, h))
        }) {
            Ok((d, h)) => {
                l.huellas.insert(id.to_string(), h);
                l.listas.push(d);
            }
            Err(motivo) => {
                registrar(&format!("tareas: {archivo}: {motivo}"));
                l.rotas.push(json!({ "archivo": archivo, "motivo": motivo }));
            }
        }
    }
    l.listas.sort_by(|a, b| {
        (a["orden"].as_u64(), a["creada"].as_u64(), a["id"].as_str()).cmp(&(b["orden"].as_u64(), b["creada"].as_u64(), b["id"].as_str()))
    });
    l.rotas.sort_by(|a, b| a["archivo"].as_str().cmp(&b["archivo"].as_str()));
    l
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
#[path = "tareas_tests.rs"]
mod tests;
