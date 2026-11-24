//! Claves de API (#23, docs/diseno/configuracion-ux.md 9.4 y 7.1): Claude (Anthropic), OpenAI y
//! Gemini (Google) en el Administrador de credenciales de Windows, nunca en un archivo.
//!
//! - Cada una es una credencial genérica `Avis/api/<proveedor>`, usuario "avis", el blob en UTF-8,
//!   guardada en el perfil del usuario de Windows (`CRED_PERSIST_LOCAL_MACHINE`).
//! - La clave cruza a Rust una sola vez (al guardar) y nunca vuelve a la ventana: `estado` devuelve
//!   solo si hay una y sus últimos 4 caracteres. Ni el log (`linea_registro`), ni los errores
//!   (`error_windows`), ni los JSON la llevan. En memoria vive en un `Secreto`, que no se puede
//!   imprimir y pisa sus bytes con ceros al soltarse.
//! - "Probar" (solo con el clic) es un pedido de solo lectura que lista modelos. Medido el 24/11/2026
//!   contra los tres sin clave y con una falsa: Anthropic y OpenAI responden 401; Gemini, 403 sin clave
//!   y 400 con `API_KEY_INVALID` con una que no sirve (por eso `resultado_de` mira el cuerpo).

use std::time::Duration;

use serde_json::{json, Value};

use crate::diagnostico;

/// Los únicos proveedores (lista fija): nada más llega a Credenciales.
pub const PROVEEDORES: [&str; 3] = ["anthropic", "openai", "gemini"];
/// Una clave más corta no es una clave (la misma regla que `formaClave` de configuracion.js).
pub const LARGO_MINIMO: usize = 20;
/// Tope del blob de una credencial (`CRED_MAX_CREDENTIAL_BLOB_SIZE`).
pub const TOPE_BLOB: usize = 2560;
/// "Probar" espera esto y después es "sin conexión" (9.4).
pub const ESPERA_PRUEBA: Duration = Duration::from_secs(10);
/// Versión de la API de Anthropic que piden sus pedidos (`anthropic-version`).
const VERSION_ANTHROPIC: &str = "2023-06-01";

/// ¿Es uno de los tres? Texto exacto.
pub fn proveedor_valido(p: &str) -> bool {
    PROVEEDORES.contains(&p)
}

/// El `TargetName` de la credencial de un proveedor.
pub fn objetivo(p: &str) -> String {
    format!("Avis/api/{p}")
}

/// Los últimos 4 caracteres (no bytes): lo único de la clave que vuelve a la ventana.
pub fn final_de(clave: &str) -> String {
    let n = clave.chars().count();
    clave.chars().skip(n.saturating_sub(4)).collect()
}

/// La clave sin los espacios de las puntas, si tiene forma de clave: sin espacios en el medio, de
/// 20 caracteres o más y que entre en el blob. Rust la vuelve a validar aunque la ventana ya lo hizo.
pub fn forma_valida(texto: &str) -> Option<&str> {
    let t = texto.trim();
    let ok = t.chars().count() >= LARGO_MINIMO && !t.chars().any(char::is_whitespace) && t.len() <= TOPE_BLOB;
    ok.then_some(t)
}

/// Lo que dice "Probar" (9.4).
#[derive(Debug, PartialEq)]
pub enum Resultado {
    /// 200: el proveedor aceptó la clave.
    Valida,
    /// 401 o 403 (o el 400 `API_KEY_INVALID` de Gemini): la rechazó.
    Rechazada,
    /// Sin conexión, o no respondió en 10 s.
    SinRed,
    /// Cualquier otra respuesta, con su código.
    Otro(u16),
}

impl Resultado {
    /// Lo que recibe la ventana: el resultado y, si es otro, el código. Nada de la clave.
    pub fn json(&self) -> Value {
        match self {
            Resultado::Otro(c) => json!({ "resultado": "otro", "estado": c }),
            r => json!({ "resultado": r.nombre() }),
        }
    }

    fn nombre(&self) -> &'static str {
        match self {
            Resultado::Valida => "valida",
            Resultado::Rechazada => "rechazada",
            Resultado::SinRed => "sin-red",
            Resultado::Otro(_) => "otro",
        }
    }
}

/// 200 → válida; 401 o 403 → rechazada; sin respuesta → sin red; lo demás, otro con su código.
pub fn resultado_de_estado(estado: Option<u16>) -> Resultado {
    match estado {
        None => Resultado::SinRed,
        Some(200) => Resultado::Valida,
        Some(401 | 403) => Resultado::Rechazada,
        Some(c) => Resultado::Otro(c),
    }
}

/// Como `resultado_de_estado`, más lo medido de Gemini: una clave que no sirve responde 400 con
/// `API_KEY_INVALID` (no 401), y eso también es rechazada.
pub fn resultado_de(proveedor: &str, estado: Option<u16>, cuerpo: &str) -> Resultado {
    if proveedor == "gemini" && estado == Some(400) && cuerpo.contains("API_KEY_INVALID") {
        return Resultado::Rechazada;
    }
    resultado_de_estado(estado)
}

/// La línea de widget.log: qué pasó y con qué proveedor. Nunca la clave.
pub fn linea_registro(accion: &str, proveedor: &str) -> String {
    format!("claves: {accion} {proveedor}")
}

fn anotar(accion: &str, proveedor: &str) {
    if let Some(ruta) = diagnostico::ruta_log() {
        let _ = diagnostico::agregar_linea(&ruta, &linea_registro(accion, proveedor), chrono::Utc::now(), diagnostico::TOPE_BYTES);
    }
}

/// El error que vuelve a la ventana cuando Windows no deja: solo el código.
pub fn error_windows(codigo: u32) -> String {
    format!("windows:{codigo}")
}

/// El pedido de solo lectura de cada proveedor: listar los modelos.
pub fn url_de(proveedor: &str) -> Option<&'static str> {
    match proveedor {
        "anthropic" => Some("https://api.anthropic.com/v1/models"),
        "openai" => Some("https://api.openai.com/v1/models"),
        "gemini" => Some("https://generativelanguage.googleapis.com/v1beta/models"),
        _ => None,
    }
}

/// Las cabeceras con la clave (nunca en la dirección: quedaría en registros de proxies).
pub fn cabeceras(proveedor: &str, clave: &str) -> Vec<(&'static str, String)> {
    match proveedor {
        "anthropic" => vec![("x-api-key", clave.to_string()), ("anthropic-version", VERSION_ANTHROPIC.to_string())],
        "openai" => vec![("Authorization", format!("Bearer {clave}"))],
        "gemini" => vec![("x-goog-api-key", clave.to_string())],
        _ => Vec::new(),
    }
}

/// El cliente de "Probar": sin seguir redirecciones (la clave va en una cabecera y no viaja a otro
/// lugar), y con 10 s en total.
fn agente_prueba() -> ureq::Agent {
    ureq::Agent::config_builder()
        .http_status_as_error(false)
        .user_agent("Avis")
        .max_redirects(0)
        .timeout_global(Some(ESPERA_PRUEBA))
        .build()
        .into()
}

/// `GET url` con las cabeceras del proveedor. Solo se lee el cuerpo de un 400 (lo necesita Gemini),
/// con tope; el de un 200 puede ser largo y no hace falta.
pub fn probar_en(agente: &ureq::Agent, proveedor: &str, url: &str, clave: &str) -> Resultado {
    let mut pedido = agente.get(url);
    for (k, v) in cabeceras(proveedor, clave) {
        pedido = pedido.header(k, v);
    }
    match pedido.call() {
        Ok(mut r) => {
            let estado = r.status().as_u16();
            let cuerpo = if estado == 400 { r.body_mut().with_config().limit(64 * 1024).read_to_string().unwrap_or_default() } else { String::new() };
            resultado_de(proveedor, Some(estado), &cuerpo)
        }
        // Sin conexión, sin nombre, tiempo agotado o TLS: no se pudo preguntar
        Err(_) => Resultado::SinRed,
    }
}

// ---------------------------------------------------------------- la clave en memoria

/// La clave mientras está en Rust: sin Debug ni Display (no se puede meter en un `format!` por
/// error) y, al soltarse, sus bytes se pisan con ceros.
pub struct Secreto(Vec<u8>);

impl From<String> for Secreto {
    fn from(s: String) -> Self {
        Secreto(s.into_bytes())
    }
}

impl Secreto {
    pub fn texto(&self) -> &str {
        std::str::from_utf8(&self.0).unwrap_or("")
    }
}

impl Drop for Secreto {
    fn drop(&mut self) {
        for b in self.0.iter_mut() {
            // SAFETY: escritura en un byte propio y válido; volátil para que el compilador no la saque
            unsafe { std::ptr::write_volatile(b, 0) };
        }
    }
}

// ---------------------------------------------------------------- Credenciales de Windows

#[cfg(windows)]
mod nativo {
    use super::Secreto;
    use windows_sys::Win32::Foundation::ERROR_NOT_FOUND;
    use windows_sys::Win32::Security::Credentials::{CredDeleteW, CredFree, CredReadW, CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC};

    fn ancho(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn ultimo_error() -> u32 {
        std::io::Error::last_os_error().raw_os_error().unwrap_or(0) as u32
    }

    /// Crea o reemplaza la credencial genérica `objetivo` con `clave` en UTF-8.
    pub fn escribir(objetivo: &str, clave: &str) -> Result<(), u32> {
        let mut nombre = ancho(objetivo);
        let mut usuario = ancho("avis");
        let mut blob = clave.as_bytes().to_vec();
        let cred = CREDENTIALW {
            Type: CRED_TYPE_GENERIC,
            TargetName: nombre.as_mut_ptr(),
            CredentialBlobSize: blob.len() as u32,
            CredentialBlob: blob.as_mut_ptr(),
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            UserName: usuario.as_mut_ptr(),
            ..Default::default()
        };
        // SAFETY: `cred` apunta a búferes vivos hasta después de la llamada; CredWriteW los copia
        let ok = unsafe { CredWriteW(&cred, 0) } != 0;
        let error = if ok { 0 } else { ultimo_error() };
        drop(Secreto(blob));
        if ok { Ok(()) } else { Err(error) }
    }

    /// La clave guardada en `objetivo`, o None si no hay.
    pub fn leer(objetivo: &str) -> Result<Option<Secreto>, u32> {
        let nombre = ancho(objetivo);
        let mut p: *mut CREDENTIALW = std::ptr::null_mut();
        // SAFETY: `nombre` termina en 0; si sale bien, Windows deja en `p` un bloque que se libera con CredFree
        if unsafe { CredReadW(nombre.as_ptr(), CRED_TYPE_GENERIC, 0, &mut p) } == 0 {
            let e = ultimo_error();
            return if e == ERROR_NOT_FOUND { Ok(None) } else { Err(e) };
        }
        // SAFETY: `p` es válido hasta CredFree; el blob mide CredentialBlobSize
        let bytes = unsafe {
            let c = &*p;
            let b = if c.CredentialBlob.is_null() { Vec::new() } else { std::slice::from_raw_parts(c.CredentialBlob, c.CredentialBlobSize as usize).to_vec() };
            // El bloque de Windows también se pisa antes de devolverlo
            if !c.CredentialBlob.is_null() {
                std::ptr::write_bytes(c.CredentialBlob, 0, c.CredentialBlobSize as usize);
            }
            CredFree(p as *const _);
            b
        };
        Ok(Some(Secreto(bytes)))
    }

    /// Borra la credencial; si no estaba, no es un error.
    pub fn borrar(objetivo: &str) -> Result<(), u32> {
        let nombre = ancho(objetivo);
        // SAFETY: `nombre` termina en 0
        if unsafe { CredDeleteW(nombre.as_ptr(), CRED_TYPE_GENERIC, 0) } != 0 {
            return Ok(());
        }
        match ultimo_error() {
            ERROR_NOT_FOUND => Ok(()),
            e => Err(e),
        }
    }
}

#[cfg(not(windows))]
mod nativo {
    use super::Secreto;
    /// ERROR_NOT_SUPPORTED: Avis es solo para Windows.
    const NO: u32 = 50;
    pub fn escribir(_: &str, _: &str) -> Result<(), u32> {
        Err(NO)
    }
    pub fn leer(_: &str) -> Result<Option<Secreto>, u32> {
        Err(NO)
    }
    pub fn borrar(_: &str) -> Result<(), u32> {
        Err(NO)
    }
}

pub fn escribir_en(objetivo: &str, clave: &str) -> Result<(), u32> {
    nativo::escribir(objetivo, clave)
}

pub fn leer_de(objetivo: &str) -> Result<Option<Secreto>, u32> {
    nativo::leer(objetivo)
}

pub fn borrar_de(objetivo: &str) -> Result<(), u32> {
    nativo::borrar(objetivo)
}

// ---------------------------------------------------------------- lo que piden los comandos

/// `claves_estado` (9.2): por proveedor, si hay una guardada y sus últimos 4. Nunca la clave.
pub fn estado() -> Value {
    let filas: Vec<Value> = PROVEEDORES
        .iter()
        .map(|p| match leer_de(&objetivo(p)).map(|s| s.map(|s| final_de(s.texto()))) {
            Ok(Some(fin)) => json!({ "proveedor": p, "guardada": true, "final": fin }),
            Ok(None) => json!({ "proveedor": p, "guardada": false }),
            Err(e) => {
                anotar(&format!("no se pudo leer ({})", error_windows(e)), p);
                json!({ "proveedor": p, "guardada": false, "error": error_windows(e) })
            }
        })
        .collect();
    Value::Array(filas)
}

/// `guardar_clave` (9.2): valida el proveedor y la forma, la escribe y suelta la memoria. Devuelve
/// `{ guardada: true, final }`; los errores son "proveedor desconocido", "forma" o "windows:<código>".
pub fn guardar(proveedor: &str, clave: Secreto) -> Result<Value, String> {
    if !proveedor_valido(proveedor) {
        return Err(String::from("proveedor desconocido"));
    }
    let Some(limpia) = forma_valida(clave.texto()) else { return Err(String::from("forma")) };
    let fin = final_de(limpia);
    match escribir_en(&objetivo(proveedor), limpia) {
        Ok(()) => {
            anotar("guardada", proveedor);
            Ok(json!({ "guardada": true, "final": fin }))
        }
        Err(e) => {
            anotar(&format!("no se pudo guardar ({})", error_windows(e)), proveedor);
            Err(error_windows(e))
        }
    }
}

/// `borrar_clave` (9.2): no falla si no había.
pub fn borrar(proveedor: &str) -> Result<Value, String> {
    if !proveedor_valido(proveedor) {
        return Err(String::from("proveedor desconocido"));
    }
    borrar_de(&objetivo(proveedor)).map_err(|e| {
        anotar(&format!("no se pudo borrar ({})", error_windows(e)), proveedor);
        error_windows(e)
    })?;
    anotar("borrada", proveedor);
    Ok(json!({ "guardada": false }))
}

/// `probar_clave` (9.2 y 9.4): lee la clave guardada y hace el pedido de solo lectura. Solo con el
/// clic del usuario. Sin clave guardada, error "sin clave".
pub fn probar(proveedor: &str) -> Result<Value, String> {
    let Some(url) = url_de(proveedor) else { return Err(String::from("proveedor desconocido")) };
    let secreto = leer_de(&objetivo(proveedor)).map_err(error_windows)?.ok_or("sin clave")?;
    let r = probar_en(&agente_prueba(), proveedor, url, secreto.texto());
    drop(secreto);
    anotar(&format!("probada: {}", r.nombre()), proveedor);
    Ok(r.json())
}

#[cfg(test)]
#[path = "claves_tests.rs"]
mod tests;
