//! Las listas de tareas en la PC (#39, docs/diseno/tareas-ux.md 11.1 y 11.3): un archivo por lista
//! en `<config>/tareas/<id>.json`.
//!
//! - La ventana manda la lista entera y Rust guarda el formato v1: lo que no es del formato no se
//!   escribe, los topes recortan (y se anota), y una lista que no sirve se rechaza sin tocar el archivo.
//! - Los campos que este Avis no conoce y ya estaban en el archivo (de una versión futura) se conservan.
//! - Escritura atómica (`atomico.rs`, la misma del historial del chat), de a una por vez en el proceso.
//! - Un archivo roto se informa (`rotas`) y se anota en `widget.log`; nunca se pisa ni se borra.
//!
//! Formato v1: `{ v: 1, id: "l-…", nombre, color, orden, creada: ms, tareas: [{ id: "t-…", titulo,
//! hecha, hechaEn: ms | null, fecha: "AAAA-MM-DD" | null, importante, notas, subtareas: [{ id, titulo,
//! hecha }], creada: ms }] }`.

use serde_json::{json, Map, Value};
use std::collections::HashSet;
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

static ESCRITURA: Mutex<()> = Mutex::new(());

/// Un id de 11.1 (`^[a-z0-9-]{1,40}$`) que empieza con su prefijo (`l-`, `t-`, `s-`): nunca `..`, una
/// barra, un punto ni un nombre reservado de Windows (`con`, `nul`… no tienen prefijo).
fn id_con(prefijo: &str, id: &str) -> bool {
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
fn ms(v: &Value, nombre: &str) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        _ => v.as_u64().map(Value::from).ok_or_else(|| format!("{nombre} no es un número")),
    }
}

/// `AAAA-MM-DD` de un día que existe, o `null`.
fn fecha(v: &Value) -> Result<Value, String> {
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
fn desconocidas(de: &Value, conocidas: &[&str]) -> Map<String, Value> {
    de.as_object()
        .map(|o| o.iter().filter(|(k, _)| !conocidas.contains(&k.as_str())).map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default()
}

/// Suma a `limpio` lo desconocido que ya tenía el archivo: de la lista y de cada tarea (por id).
fn conservar(limpio: &mut Value, archivo: &Value) {
    if let Some(o) = limpio.as_object_mut() {
        o.extend(desconocidas(archivo, &CLAVES_LISTA));
    }
    let viejas: Vec<&Value> = archivo["tareas"].as_array().map(|a| a.iter().collect()).unwrap_or_default();
    if let Some(tareas) = limpio["tareas"].as_array_mut() {
        for t in tareas {
            if let Some(vieja) = viejas.iter().find(|v| v["id"] == t["id"]) {
                if let Some(o) = t.as_object_mut() {
                    o.extend(desconocidas(vieja, &CLAVES_TAREA));
                }
            }
        }
    }
}

/// Lee `<id>.json` tal cual está, si sirve: el valor crudo (con sus desconocidas) o por qué no.
fn leer_crudo(r: &Path, id: &str) -> Result<Value, String> {
    let bytes = fs::read(r).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|e| format!("no es JSON: {e}"))?;
    let d = normalizar(&v)?;
    if d["id"] != json!(id) {
        return Err(String::from("el archivo es de otra lista"));
    }
    Ok(v)
}

fn bloquear() -> std::sync::MutexGuard<'static, ()> {
    ESCRITURA.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Guarda la lista (atómico) y devuelve lo guardado. Nunca pisa un archivo roto.
pub fn guardar(carpeta: &Path, doc: &Value) -> Result<Value, String> {
    let mut limpio = normalizar(doc)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let destino = ruta(carpeta, &id).ok_or("id de lista inválido")?;
    let _candado = bloquear();
    if destino.exists() {
        let archivo = leer_crudo(&destino, &id).map_err(|e| format!("el archivo de la lista está roto ({e}): no se pisa"))?;
        conservar(&mut limpio, &archivo);
    }
    crate::atomico::escribir(&destino, &serde_json::to_vec(&limpio).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
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

/// Lo que lee `tareas_leer`: las listas que sirven, en orden, y los archivos rotos (`{ archivo, motivo }`).
#[derive(Debug, Default)]
pub struct Lectura {
    pub listas: Vec<Value>,
    pub rotas: Vec<Value>,
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
        match leer_crudo(&e.path(), id).and_then(|crudo| {
            let mut d = normalizar(&crudo)?;
            conservar(&mut d, &crudo);
            Ok(d)
        }) {
            Ok(d) => l.listas.push(d),
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
