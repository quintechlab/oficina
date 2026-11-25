//! Los proyectos en la PC (#44, docs/diseno/proyectos-ux.md 11.1 a 11.3): un archivo por proyecto en
//! `<config>/proyectos/<id>.json`, con las mismas reglas que `tareas.rs`.
//!
//! - La ventana manda el proyecto entero y Rust guarda el formato v1: lo que no es del formato no se
//!   escribe, los topes recortan (y se anota) y un proyecto que no sirve se rechaza sin tocar el archivo.
//! - Los campos que este Avis no conoce y ya estaban en el archivo se conservan.
//! - Escritura atómica (`atomico.rs`), de a una por vez en el proceso (el candado de este módulo).
//! - Un archivo roto se informa (`rotas`) y se anota en `widget.log`; nunca se pisa ni se borra.
//! - **La ventana nunca escribe `carpeta`** (11.2): `guardar` la toma del archivo. Solo la ponen `crear`
//!   y `cambiar_carpeta`, con una ruta que eligió el diálogo de Windows o que armó Rust
//!   (`crear_carpeta_avis`), siempre validada con `carpeta_valida`.
//! - Avis nunca mueve, renombra ni borra la carpeta de un proyecto ni sus archivos: borrar el proyecto
//!   borra solo su archivo.
//!
//! Formato v1: `{ v: 1, id: "p-…", nombre, color, orden, creado: ms, instrucciones, carpeta: { tipo:
//! "avis" | "pc", ruta } | null }`.

use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};

use crate::ids::id_con;
use crate::tareas::{desconocidas, ms, COLORES};

/// Topes de 11.1 (D-p18): recortan.
const TOPE_NOMBRE: usize = 40;
const TOPE_INSTRUCCIONES: usize = 4_000;
/// Contar archivos para la hoja (11.2): más que esto se muestra «999+».
pub const TOPE_ARCHIVOS: usize = 1_000;
/// El nombre de la carpeta que crea Avis (11.2), sin « (2)».
const TOPE_NOMBRE_CARPETA: usize = 60;

/// Las claves del formato: lo demás que traiga el archivo se conserva; lo demás que mande la ventana, no.
const CLAVES: [&str; 8] = ["v", "id", "nombre", "color", "orden", "creado", "instrucciones", "carpeta"];

/// El error de un nombre que ya usa otro proyecto (5.2: «Ya hay un proyecto con ese nombre.»).
pub const REPETIDO: &str = "repetido";

static ESCRITURA: Mutex<()> = Mutex::new(());

/// Un id de proyecto: `p-…` (`^p-[a-z0-9-]{1,38}$`, la regla de `ids.rs`).
pub fn id_valido(id: &str) -> bool {
    id_con("p-", id)
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
        registrar(&format!("proyectos: {nombre} recortado a {tope} caracteres"));
        return Ok(s.chars().take(tope).collect());
    }
    Ok(s.to_string())
}

/// La carpeta del formato: `null`, o `{ tipo: "avis" | "pc", ruta }` con una ruta no vacía.
fn carpeta_de(v: &Value) -> Result<Value, String> {
    match v {
        Value::Null => Ok(Value::Null),
        Value::Object(o) => {
            let tipo = o.get("tipo").and_then(Value::as_str).filter(|t| *t == "avis" || *t == "pc").ok_or("tipo de carpeta inválido")?;
            let r = o.get("ruta").and_then(Value::as_str).filter(|r| !r.trim().is_empty()).ok_or("ruta de carpeta inválida")?;
            Ok(json!({ "tipo": tipo, "ruta": r }))
        }
        _ => Err(String::from("carpeta inválida")),
    }
}

/// El proyecto en el formato v1 (solo sus claves), o por qué no sirve.
pub fn normalizar(doc: &Value) -> Result<Value, String> {
    if doc["v"] != json!(1) {
        return Err(String::from("versión desconocida"));
    }
    let id = doc["id"].as_str().filter(|i| id_valido(i)).ok_or("id de proyecto inválido")?;
    let instrucciones = match &doc["instrucciones"] {
        Value::Null => String::new(),
        v => texto(v, TOPE_INSTRUCCIONES, true, "instrucciones")?,
    };
    let color = doc["color"].as_str().filter(|c| COLORES.contains(c)).unwrap_or(COLORES[0]);
    Ok(json!({
        "v": 1,
        "id": id,
        "nombre": texto(&doc["nombre"], TOPE_NOMBRE, false, "nombre")?.trim(),
        "color": color,
        "orden": doc["orden"].as_u64().unwrap_or(0),
        "creado": ms(&doc["creado"], "creado")?,
        "instrucciones": instrucciones,
        "carpeta": carpeta_de(&doc["carpeta"])?,
    }))
}

/// Suma a `limpio` lo desconocido que ya tenía el archivo.
fn conservar(limpio: &mut Value, archivo: &Value) {
    if let Some(o) = limpio.as_object_mut() {
        o.extend(desconocidas(archivo, &CLAVES));
    }
}

/// Lee `<id>.json` tal cual está, si sirve (con sus claves desconocidas), o por qué no.
fn leer_crudo(r: &Path, id: &str) -> Result<Value, String> {
    let bytes = fs::read(r).map_err(|e| e.to_string())?;
    let v: Value = serde_json::from_slice(&bytes).map_err(|e| format!("no es JSON: {e}"))?;
    let d = normalizar(&v)?;
    if d["id"] != json!(id) {
        return Err(String::from("el archivo es de otro proyecto"));
    }
    Ok(v)
}

fn bloquear() -> std::sync::MutexGuard<'static, ()> {
    ESCRITURA.lock().unwrap_or_else(PoisonError::into_inner)
}

fn escribir(destino: &Path, doc: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(doc).map_err(|e| e.to_string())?;
    crate::atomico::escribir(destino, &bytes).map_err(|e| e.to_string())
}

/// Para comparar nombres (como `claveNombre` de tareas.js): sin espacios en los bordes, sin mayúsculas
/// ni tildes. Sin una tabla de Unicode: las letras con tilde del español y del portugués.
pub fn clave_nombre(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' | 'â' | 'ã' | 'å' => 'a',
            'é' | 'è' | 'ë' | 'ê' => 'e',
            'í' | 'ì' | 'ï' | 'î' => 'i',
            'ó' | 'ò' | 'ö' | 'ô' | 'õ' => 'o',
            'ú' | 'ù' | 'ü' | 'û' => 'u',
            'ñ' => 'n',
            'ç' => 'c',
            c => c,
        })
        .collect()
}

/// ¿Otro proyecto (no `propio`) ya usa ese nombre? Los rotos no cuentan (no se sabe su nombre).
fn repetido(carpeta: &Path, nombre: &str, propio: &str) -> bool {
    let clave = clave_nombre(nombre);
    listar(carpeta).proyectos.iter().any(|p| p["id"] != json!(propio) && p["nombre"].as_str().map(clave_nombre).as_deref() == Some(clave.as_str()))
}

/// Un proyecto nuevo con lo que manda la ventana (`{ id, nombre, color, instrucciones }`), sin carpeta
/// todavía: al final del orden, creado `ahora`. Antes del diálogo o de crear la carpeta (11.3): si el
/// nombre se repite (`REPETIDO`), el id no sirve o ya hay un archivo con ese id, no se elige nada.
pub fn nuevo(carpeta: &Path, datos: &Value, ahora: u64) -> Result<Value, String> {
    let l = listar(carpeta);
    let orden = l.proyectos.iter().filter_map(|p| p["orden"].as_u64()).map(|o| o + 1).max().unwrap_or(0);
    let doc = normalizar(&json!({
        "v": 1, "id": datos["id"], "nombre": datos["nombre"], "color": datos["color"], "orden": orden,
        "creado": ahora, "instrucciones": datos["instrucciones"], "carpeta": null,
    }))?;
    let id = doc["id"].as_str().unwrap_or_default();
    if ruta(carpeta, id).is_some_and(|r| r.exists()) {
        return Err(String::from("el proyecto ya existe"));
    }
    if repetido(carpeta, doc["nombre"].as_str().unwrap_or_default(), id) {
        return Err(String::from(REPETIDO));
    }
    Ok(doc)
}

/// Crea el archivo de un proyecto nuevo (con su carpeta ya elegida o creada por Rust). Nunca pisa un
/// archivo que ya está, aunque esté roto, ni repite un nombre.
pub fn crear(carpeta: &Path, doc: &Value) -> Result<Value, String> {
    let limpio = normalizar(doc)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let destino = ruta(carpeta, &id).ok_or("id de proyecto inválido")?;
    let _candado = bloquear();
    if destino.exists() {
        return Err(String::from("el proyecto ya existe"));
    }
    if repetido(carpeta, limpio["nombre"].as_str().unwrap_or_default(), &id) {
        return Err(String::from(REPETIDO));
    }
    escribir(&destino, &limpio)?;
    Ok(limpio)
}

/// Guarda lo que se edita de un proyecto que ya existe (`proyectos_guardar`): nombre, color, orden e
/// instrucciones. **La `carpeta` del documento se ignora**: queda la del archivo (11.1). Un archivo roto
/// no se pisa; un proyecto que no existe no se crea por acá.
pub fn guardar(carpeta: &Path, doc: &Value) -> Result<Value, String> {
    let mut sin_carpeta = doc.clone();
    if let Some(o) = sin_carpeta.as_object_mut() {
        o.insert(String::from("carpeta"), Value::Null);
    }
    let mut limpio = normalizar(&sin_carpeta)?;
    let id = limpio["id"].as_str().unwrap_or_default().to_string();
    let destino = ruta(carpeta, &id).ok_or("id de proyecto inválido")?;
    let _candado = bloquear();
    if !destino.is_file() {
        return Err(String::from("el proyecto no existe"));
    }
    let archivo = leer_crudo(&destino, &id).map_err(|e| format!("el archivo del proyecto está roto ({e}): no se pisa"))?;
    if repetido(carpeta, limpio["nombre"].as_str().unwrap_or_default(), &id) {
        return Err(String::from(REPETIDO));
    }
    limpio["carpeta"] = normalizar(&archivo)?["carpeta"].clone();
    conservar(&mut limpio, &archivo);
    escribir(&destino, &limpio)?;
    Ok(limpio)
}

/// Pone la carpeta de un proyecto (elegida o creada en Rust, ya validada) y conserva lo demás del archivo.
pub fn cambiar_carpeta(carpeta: &Path, id: &str, nueva: &Value) -> Result<Value, String> {
    let destino = ruta(carpeta, id).ok_or("id de proyecto inválido")?;
    let nueva = carpeta_de(nueva)?;
    let _candado = bloquear();
    if !destino.is_file() {
        return Err(String::from("el proyecto no existe"));
    }
    let archivo = leer_crudo(&destino, id).map_err(|e| format!("el archivo del proyecto está roto ({e}): no se pisa"))?;
    let mut limpio = normalizar(&archivo)?;
    limpio["carpeta"] = nueva;
    conservar(&mut limpio, &archivo);
    escribir(&destino, &limpio)?;
    Ok(limpio)
}

/// El proyecto `id` en el formato v1 (con sus desconocidas), o por qué no se puede leer.
pub fn leer(carpeta: &Path, id: &str) -> Result<Value, String> {
    let r = ruta(carpeta, id).ok_or("id de proyecto inválido")?;
    if !r.is_file() {
        return Err(String::from("el proyecto no existe"));
    }
    let crudo = leer_crudo(&r, id)?;
    let mut d = normalizar(&crudo)?;
    conservar(&mut d, &crudo);
    Ok(d)
}

/// Borra el archivo del proyecto (P1: todavía sin sus charlas, que llegan con P2). **Nunca la carpeta**
/// ni sus archivos. Lo que ya no existe no es un error; un archivo roto no se borra.
pub fn borrar(carpeta: &Path, id: &str) -> Result<(), String> {
    let r = ruta(carpeta, id).ok_or("id de proyecto inválido")?;
    let _candado = bloquear();
    if !r.exists() {
        return Ok(());
    }
    leer_crudo(&r, id).map_err(|e| format!("el archivo del proyecto está roto ({e}): no se borra"))?;
    fs::remove_file(&r).map_err(|e| e.to_string())
}

/// Lo que lee `proyectos_leer`: los proyectos que sirven, en orden, y los archivos rotos (`{ archivo, motivo }`).
#[derive(Debug, Default)]
pub struct Lectura {
    pub proyectos: Vec<Value>,
    pub rotas: Vec<Value>,
}

/// Todos los proyectos, por `orden`, `creado` e id (con sus claves desconocidas). Un archivo `p-….json`
/// que no se puede leer, no es del formato o es de otro proyecto va en `rotas` (y al log).
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
            Ok(d) => l.proyectos.push(d),
            Err(motivo) => {
                registrar(&format!("proyectos: {archivo}: {motivo}"));
                l.rotas.push(json!({ "archivo": archivo, "motivo": motivo }));
            }
        }
    }
    l.proyectos.sort_by(|a, b| {
        (a["orden"].as_u64(), a["creado"].as_u64(), a["id"].as_str()).cmp(&(b["orden"].as_u64(), b["creado"].as_u64(), b["id"].as_str()))
    });
    l.rotas.sort_by(|a, b| a["archivo"].as_str().cmp(&b["archivo"].as_str()));
    l
}

/// Los archivos de una carpeta, sin bajar a subcarpetas, solo archivos (no carpetas ni enlaces), con
/// tope `TOPE_ARCHIVOS` (11.2). Solo lectura.
pub fn contar_archivos(r: &Path) -> usize {
    let Ok(entradas) = fs::read_dir(r) else { return 0 };
    entradas.filter_map(Result::ok).filter(|e| e.file_type().is_ok_and(|t| t.is_file())).take(TOPE_ARCHIVOS).count()
}

/// El proyecto como lo ve la ventana (11.3): su `carpeta` pasa a `{ nombre, ruta, tipo, estado: "ok" |
/// "perdida" | "sin", archivos }`. `perdida`: la ruta no existe o no es una carpeta (7.4). Solo lee.
pub fn con_estado(doc: &Value) -> Value {
    let mut d = doc.clone();
    let c = &doc["carpeta"];
    d["carpeta"] = match (c["tipo"].as_str(), c["ruta"].as_str()) {
        (Some(tipo), Some(r)) => {
            let p = Path::new(r);
            let ok = p.is_dir();
            let nombre = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| r.to_string());
            json!({ "nombre": nombre, "ruta": r, "tipo": tipo, "estado": if ok { "ok" } else { "perdida" }, "archivos": if ok { contar_archivos(p) } else { 0 } })
        }
        _ => json!({ "nombre": "", "ruta": "", "tipo": null, "estado": "sin", "archivos": 0 }),
    };
    d
}

// ------------------------------------------------------------------ la carpeta (11.2)

/// Por qué no sirve una carpeta (5.2): `Grande` (raíz de un disco, Windows, Archivos de programa, la
/// configuración de Avis), `Red` (UNC o una unidad de red), `NoExiste` y `Crear` (no se pudo crear en
/// Documentos).
#[derive(Debug, PartialEq, Eq)]
pub enum Motivo {
    Grande,
    Red,
    NoExiste,
    Crear,
}

impl Motivo {
    /// El código que lee la ventana (`textoMotivoCarpeta` de proyectos.js).
    pub fn codigo(&self) -> &'static str {
        match self {
            Motivo::Grande => "grande",
            Motivo::Red => "red",
            Motivo::NoExiste => "no-existe",
            Motivo::Crear => "crear",
        }
    }
}

/// Las carpetas que no se aceptan, ni lo que tienen adentro (11.2, D-p11).
#[derive(Debug, Clone)]
pub struct Reglas {
    prohibidas: Vec<PathBuf>,
}

/// Sin el prefijo `\\?\` de `canonicalize` (las rutas UNC no llegan acá).
fn sin_prefijo(p: &Path) -> PathBuf {
    let s = p.to_string_lossy();
    PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s))
}

/// ¿Es una ruta de red? `\\servidor\…`, `//servidor/…`, `\\?\UNC\…` o un dispositivo (`\\.\…`).
fn es_red(s: &str) -> bool {
    let s = s.replace('/', "\\");
    if let Some(resto) = s.strip_prefix(r"\\?\") {
        return resto.to_ascii_uppercase().starts_with("UNC\\");
    }
    s.starts_with(r"\\")
}

/// En minúsculas, con `\` y sin la barra del final: para comparar rutas de Windows.
fn comparable(p: &Path) -> String {
    let s = p.to_string_lossy().replace('/', "\\").to_lowercase();
    s.trim_end_matches('\\').to_string()
}

/// ¿`p` es `base` o está adentro?
fn dentro(p: &Path, base: &Path) -> bool {
    let (p, b) = (comparable(p), comparable(base));
    !b.is_empty() && (p == b || p.starts_with(&format!("{b}\\")))
}

impl Reglas {
    /// Con estas carpetas prohibidas (cada una, resuelta con `canonicalize` si existe).
    pub fn con(prohibidas: Vec<PathBuf>) -> Reglas {
        Reglas { prohibidas: prohibidas.into_iter().map(|p| fs::canonicalize(&p).map(|c| sin_prefijo(&c)).unwrap_or(p)).collect() }
    }

    /// Las del sistema: `%WINDIR%`, `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%ProgramW6432%` y la
    /// carpeta de configuración de Avis (`config`).
    pub fn del_sistema(config: &Path) -> Reglas {
        let mut p: Vec<PathBuf> = ["WINDIR", "SystemRoot", "ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"]
            .iter()
            .filter_map(|v| std::env::var_os(v))
            .filter(|v| !v.is_empty())
            .map(PathBuf::from)
            .collect();
        p.push(config.to_path_buf());
        Reglas::con(p)
    }
}

/// `carpeta_valida` de 11.2: absoluta, existe y es carpeta; `canonicalize` sin el prefijo `\\?\`; y no es
/// la raíz de un disco, ni de red, ni una carpeta prohibida o algo adentro. Devuelve la ruta para guardar.
pub fn carpeta_valida(r: &Path, reglas: &Reglas) -> Result<PathBuf, Motivo> {
    // Antes de tocar el disco: una ruta de red puede tardar en contestar
    if es_red(&r.to_string_lossy()) {
        return Err(Motivo::Red);
    }
    if !r.is_absolute() || !r.is_dir() {
        return Err(Motivo::NoExiste);
    }
    let c = fs::canonicalize(r).map_err(|_| Motivo::NoExiste)?;
    // Una unidad de red mapeada (`Z:\`) se resuelve a `\\?\UNC\…`
    if es_red(&c.to_string_lossy()) {
        return Err(Motivo::Red);
    }
    let limpia = sin_prefijo(&c);
    if limpia.parent().is_none() {
        return Err(Motivo::Grande);
    }
    if reglas.prohibidas.iter().any(|b| dentro(&limpia, b)) {
        return Err(Motivo::Grande);
    }
    Ok(limpia)
}

/// Los nombres reservados de Windows (sin distinguir mayúsculas, también con extensión: `con.txt`).
fn reservado(n: &str) -> bool {
    let base = n.split('.').next().unwrap_or_default().trim_end().to_ascii_uppercase();
    matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ((base.starts_with("COM") || base.starts_with("LPT")) && base.len() == 4 && base.as_bytes()[3].is_ascii_digit() && base.as_bytes()[3] != b'0')
}

/// El nombre saneado de la carpeta que crea Avis (11.2): sin `< > : " / \ | ? *` ni caracteres de
/// control, sin espacios ni puntos al final, un nombre reservado suma « proyecto», vacío → «Proyecto»,
/// hasta 60 caracteres.
pub fn nombre_carpeta(nombre: &str) -> String {
    let limpio: String = nombre.chars().filter(|c| !c.is_control() && !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')).collect();
    let corto: String = limpio.trim().chars().take(TOPE_NOMBRE_CARPETA).collect();
    let n = corto.trim_end_matches([' ', '.']).trim_start().to_string();
    if n.is_empty() {
        return String::from("Proyecto");
    }
    if reservado(&n) {
        return format!("{n} proyecto");
    }
    n
}

/// Crea la carpeta de un proyecto en `Documentos › Avis › <nombre>` (11.2, D-p3): nunca usa una que ya
/// existe (« (2)», « (3)»…) y la valida con `carpeta_valida`.
pub fn crear_carpeta_avis(documentos: &Path, nombre: &str, reglas: &Reglas) -> Result<PathBuf, Motivo> {
    let base = documentos.join("Avis");
    fs::create_dir_all(&base).map_err(|_| Motivo::Crear)?;
    let n = nombre_carpeta(nombre);
    for k in 1..1000 {
        let candidata = if k == 1 { base.join(&n) } else { base.join(format!("{n} ({k})")) };
        match fs::create_dir(&candidata) {
            Ok(()) => return carpeta_valida(&candidata, reglas),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err(Motivo::Crear),
        }
    }
    Err(Motivo::Crear)
}

/// La carpeta de un proyecto para abrir en el Explorador (11.2): la del archivo, revalidada (`is_dir`).
/// Nunca una ruta de la ventana.
pub fn ruta_para_abrir(carpeta: &Path, id: &str) -> Result<PathBuf, String> {
    let d = leer(carpeta, id)?;
    let r = d["carpeta"]["ruta"].as_str().ok_or("el proyecto no tiene carpeta")?;
    let p = PathBuf::from(r);
    if !p.is_dir() {
        return Err(String::from("la carpeta del proyecto no está"));
    }
    Ok(p)
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
#[path = "proyectos_tests.rs"]
mod tests;
