//! Los hábitos en la PC (#41, docs/diseno/habitos-ux.md 11.1 y 11.5): un archivo por hábito en
//! `<config>/habitos/<id>.json`, con el mismo cuidado que las listas de tareas (`tareas.rs`):
//!
//! - La ventana manda el hábito entero y Rust guarda el formato v1: lo que no es del formato no se
//!   escribe, los topes recortan (y se anota), y un hábito que no sirve se rechaza sin tocar el archivo.
//! - Los campos que este Avis no conoce y ya estaban en el archivo (de una versión futura) se conservan.
//! - Escritura atómica (`atomico.rs`), de a una por vez en el proceso.
//! - Un archivo roto se informa (`rotas`) y se anota en `widget.log`; nunca se pisa ni se borra.
//!
//! Formato v1: `{ v: 1, id: "h-…", nombre, tipo: "diario" | "cantidad" | "dias" | "semana", meta,
//! unidad, dias: [0..6], veces, aviso: "HH:MM" | null, color, orden, creado: ms, inicio: "AAAA-MM-DD",
//! mejor, registro: { "AAAA-MM-DD": n } }`.
//!
//! El registro de más de 2 000 días se recorta (quedan los más nuevos) y `mejor` no baja: 11.1 dice
//! también que más de 2 000 entradas se rechaza; se siguió el recorte, que es lo que piden sus casos
//! de prueba (11.6).

use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use crate::tareas::{desconocidas, fecha, id_con, ms, COLORES};

/// Los tipos de hábito (S2).
pub const TIPOS: [&str; 4] = ["diario", "cantidad", "dias", "semana"];
/// Topes de 11.1: recortan.
const TOPE_NOMBRE: usize = 40;
const TOPE_UNIDAD: usize = 16;
const TOPE_REGISTRO: usize = 2_000;
const TOPE_CANTIDAD: u64 = 999;
/// Rangos de 11.1: fuera de ellos, el hábito no sirve.
const META: std::ops::RangeInclusive<u64> = 1..=99;
const VECES: std::ops::RangeInclusive<u64> = 1..=6;

const CLAVES: [&str; 15] =
    ["v", "id", "nombre", "tipo", "meta", "unidad", "dias", "veces", "aviso", "color", "orden", "creado", "inicio", "mejor", "registro"];

static ESCRITURA: Mutex<()> = Mutex::new(());

/// Un id de hábito: `h-…` (`^[a-z0-9-]{1,40}$`, nunca una ruta).
pub fn id_valido(id: &str) -> bool {
    id_con("h-", id)
}

fn ruta(carpeta: &Path, id: &str) -> Option<PathBuf> {
    id_valido(id).then(|| carpeta.join(format!("{id}.json")))
}

/// Texto sin espacios a los lados, recortado a `tope` caracteres (lo anota). `vacio`: si puede quedar vacío.
fn texto(v: &Value, tope: usize, vacio: bool, nombre: &str) -> Result<String, String> {
    let s = match v {
        Value::Null if vacio => "",
        _ => v.as_str().ok_or_else(|| format!("{nombre} no es texto"))?,
    }
    .trim();
    if !vacio && s.is_empty() {
        return Err(format!("{nombre} vacío"));
    }
    if s.chars().count() > tope {
        registrar(&format!("hábitos: {nombre} recortado a {tope} caracteres"));
        return Ok(s.chars().take(tope).collect());
    }
    Ok(s.to_string())
}

/// Un entero en `rango`, o `defecto` si no viene.
fn entero(v: &Value, rango: std::ops::RangeInclusive<u64>, defecto: u64, nombre: &str) -> Result<u64, String> {
    match v {
        Value::Null => Ok(defecto),
        _ => v.as_u64().filter(|n| rango.contains(n)).ok_or_else(|| format!("{nombre} fuera de rango")),
    }
}

/// `HH:MM` de 00:00 a 23:59, o `null`.
fn hora(v: &Value) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        Value::String(s) if s.len() == 5 && chrono::NaiveTime::parse_from_str(s, "%H:%M").is_ok() => Ok(v.clone()),
        _ => Err(String::from("hora de aviso inválida")),
    }
}

/// Lunes = 0 … domingo = 6, ordenados y sin repetir.
fn dias(v: &Value) -> Result<Vec<u64>, String> {
    let mut d = match v {
        Value::Null => Vec::new(),
        Value::Array(a) => a.iter().map(|x| x.as_u64().filter(|n| *n <= 6).ok_or("día inválido")).collect::<Result<Vec<_>, _>>()?,
        _ => return Err(String::from("días inválidos")),
    };
    d.sort_unstable();
    d.dedup();
    Ok(d)
}

/// El registro: solo días que existen y cantidades de 1 a 999 (0 no se guarda, más se recorta); de
/// más de 2 000 días quedan los más nuevos.
fn registro(v: &Value) -> Result<Map<String, Value>, String> {
    let o = match v {
        Value::Null => return Ok(Map::new()),
        Value::Object(o) => o,
        _ => return Err(String::from("registro inválido")),
    };
    let mut r: Vec<(String, u64)> = Vec::with_capacity(o.len());
    for (dia, n) in o {
        if fecha(&json!(dia)).is_err() {
            return Err(format!("fecha del registro inválida: {dia}"));
        }
        let n = n.as_u64().ok_or("cantidad del registro inválida")?;
        if n > 0 {
            r.push((dia.clone(), n.min(TOPE_CANTIDAD)));
        }
    }
    if r.len() > TOPE_REGISTRO {
        registrar(&format!("hábitos: registro recortado a {TOPE_REGISTRO} días"));
        r.sort_by(|a, b| b.0.cmp(&a.0));
        r.truncate(TOPE_REGISTRO);
    }
    Ok(r.into_iter().map(|(d, n)| (d, json!(n))).collect())
}

/// El hábito en el formato v1 (solo sus claves), o por qué no sirve.
pub fn normalizar(doc: &Value) -> Result<Value, String> {
    if doc["v"] != json!(1) {
        return Err(String::from("versión desconocida"));
    }
    let id = doc["id"].as_str().filter(|i| id_valido(i)).ok_or("id de hábito inválido")?;
    let tipo = doc["tipo"].as_str().filter(|t| TIPOS.contains(t)).ok_or("tipo de hábito desconocido")?;
    let dias = dias(&doc["dias"])?;
    if tipo == "dias" && dias.is_empty() {
        return Err(String::from("un hábito de algunos días necesita al menos un día"));
    }
    let inicio = fecha(&doc["inicio"])?;
    Ok(json!({
        "v": 1,
        "id": id,
        "nombre": texto(&doc["nombre"], TOPE_NOMBRE, false, "nombre")?,
        "tipo": tipo,
        "meta": entero(&doc["meta"], META, 1, "meta")?,
        "unidad": texto(&doc["unidad"], TOPE_UNIDAD, true, "unidad")?,
        "dias": dias,
        "veces": entero(&doc["veces"], VECES, 1, "veces")?,
        "aviso": hora(&doc["aviso"])?,
        "color": doc["color"].as_str().filter(|c| COLORES.contains(c)).unwrap_or(COLORES[0]),
        "orden": doc["orden"].as_u64().unwrap_or(0),
        "creado": ms(&doc["creado"], "creado")?,
        "inicio": inicio,
        "mejor": doc["mejor"].as_u64().unwrap_or(0),
        "registro": registro(&doc["registro"])?,
    }))
}

/// Lee `<id>.json` tal cual está, si sirve: el valor crudo (con sus desconocidas) o por qué no.
fn leer_crudo(r: &Path, id: &str) -> Result<Value, String> {
    let bytes = fs::read(r).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|e| format!("no es JSON: {e}"))?;
    let d = normalizar(&v)?;
    if d["id"] != json!(id) {
        return Err(String::from("el archivo es de otro hábito"));
    }
    Ok(v)
}

fn bloquear() -> std::sync::MutexGuard<'static, ()> {
    ESCRITURA.lock().unwrap_or_else(PoisonError::into_inner)
}

/// Guarda el hábito (atómico) y devuelve lo guardado. Nunca pisa un archivo roto.
pub fn guardar(carpeta: &Path, doc: &Value) -> Result<Value, String> {
    let mut limpio = normalizar(doc)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let destino = ruta(carpeta, &id).ok_or("id de hábito inválido")?;
    let _candado = bloquear();
    if destino.exists() {
        let archivo = leer_crudo(&destino, &id).map_err(|e| format!("el archivo del hábito está roto ({e}): no se pisa"))?;
        if let Some(o) = limpio.as_object_mut() {
            o.extend(desconocidas(&archivo, &CLAVES));
        }
    }
    crate::atomico::escribir(&destino, &serde_json::to_vec(&limpio).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok(limpio)
}

/// Borra el archivo del hábito. Lo que ya no existe no es un error; un archivo roto no se borra.
pub fn borrar(carpeta: &Path, id: &str) -> Result<(), String> {
    let r = ruta(carpeta, id).ok_or("id de hábito inválido")?;
    let _candado = bloquear();
    if !r.exists() {
        return Ok(());
    }
    leer_crudo(&r, id).map_err(|e| format!("el archivo del hábito está roto ({e}): no se borra"))?;
    fs::remove_file(&r).map_err(|e| e.to_string())
}

/// Lo que lee `habitos_leer`: los hábitos que sirven, en orden, y los archivos rotos (`{ archivo, motivo }`).
#[derive(Debug, Default)]
pub struct Lectura {
    pub habitos: Vec<Value>,
    pub rotas: Vec<Value>,
}

/// Todos los hábitos, ordenados por `orden`, `creado` e id (con sus claves desconocidas).
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
            if let Some(o) = d.as_object_mut() {
                o.extend(desconocidas(&crudo, &CLAVES));
            }
            Ok(d)
        }) {
            Ok(d) => l.habitos.push(d),
            Err(motivo) => {
                registrar(&format!("hábitos: {archivo}: {motivo}"));
                l.rotas.push(json!({ "archivo": archivo, "motivo": motivo }));
            }
        }
    }
    l.habitos.sort_by(|a, b| {
        (a["orden"].as_u64(), a["creado"].as_u64(), a["id"].as_str()).cmp(&(b["orden"].as_u64(), b["creado"].as_u64(), b["id"].as_str()))
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
#[path = "habitos_tests.rs"]
mod tests;
