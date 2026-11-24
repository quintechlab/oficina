//! Los adjuntos de la charla (#22, docs/diseno/chat-avis-ux.md 10): qué archivos entran y su bloque
//! de stream-json (7.4). La ventana nunca toca los bytes: manda rutas, y Rust las revisa
//! (`chat_adjunto`) y las lee al mandar el mensaje.
//!
//! - PDF → bloque `document`; PNG, JPG, GIF y WebP → bloque `image` (el tipo sale de los primeros
//!   bytes, no del nombre: la API rechaza un `media_type` que no coincide); texto y código (UTF-8
//!   válido, hasta 200 KB) → bloque `text` con "Archivo: {nombre}" y el contenido en una cerca.
//! - Hasta 20 MB por archivo y 5 por mensaje (D27). Cualquier otro se rechaza: el error `adjunto`
//!   con el nombre del archivo.
//! - Sin dependencias: el base64 es propio (`base64`).

use serde_json::{json, Value};
use std::fs;
use std::path::Path;

/// Hasta 20 MB por archivo (D27; un PDF de 15 MB entra, medido en E0).
pub const TOPE_ADJUNTO: u64 = 20 * 1024 * 1024;
/// Texto y código, hasta 200 KB (10).
pub const TOPE_TEXTO: u64 = 200 * 1024;
/// Hasta 5 archivos por mensaje (D27).
pub const MAX_ADJUNTOS: usize = 5;

const TEXTOS: [&str; 15] = ["txt", "md", "json", "csv", "js", "ts", "tsx", "rs", "py", "html", "css", "yml", "toml", "sql", "log"];
const IMAGENES: [&str; 5] = ["png", "jpg", "jpeg", "gif", "webp"];
/// Todas las que se leen: el filtro del selector de archivos del clip (10).
pub const EXTENSIONES: [&str; 21] = [
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", "md", "json", "csv", "js", "ts", "tsx", "rs", "py", "html", "css", "yml", "toml", "sql", "log",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Clase {
    Pdf,
    Imagen,
    Texto,
}

impl Clase {
    /// El `tipo` que ve la ventana (`validarAdjunto` de chat.js).
    pub fn tipo(self) -> &'static str {
        match self {
            Clase::Pdf => "pdf",
            Clase::Imagen => "imagen",
            Clase::Texto => "texto",
        }
    }
}

/// Un archivo que entra: su nombre, su clase, su tamaño, las páginas (PDF) y su `media_type`.
#[derive(Debug)]
pub struct Adjunto {
    pub nombre: String,
    pub clase: Clase,
    pub bytes: u64,
    pub paginas: Option<u32>,
    pub media: &'static str,
}

/// La extensión, sin mayúsculas (`""` si no tiene o si el nombre es solo la extensión).
fn extension(nombre: &str) -> String {
    match nombre.rsplit_once('.') {
        Some((base, ext)) if !base.is_empty() => ext.to_lowercase(),
        _ => String::new(),
    }
}

/// La clase que dice el nombre del archivo, o `None` si no se lee.
pub fn clase_de(nombre: &str) -> Option<Clase> {
    let ext = extension(nombre);
    if ext == "pdf" {
        Some(Clase::Pdf)
    } else if IMAGENES.contains(&ext.as_str()) {
        Some(Clase::Imagen)
    } else if TEXTOS.contains(&ext.as_str()) {
        Some(Clase::Texto)
    } else {
        None
    }
}

/// El nombre del archivo, sin la carpeta (lo único que viaja a la ventana y al historial).
pub fn nombre_de(ruta: &Path) -> String {
    ruta.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| ruta.to_string_lossy().into_owned())
}

/// El `media_type` de una imagen por sus primeros bytes.
pub fn media_imagen(b: &[u8]) -> Option<&'static str> {
    if b.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some("image/png")
    } else if b.starts_with(b"\xff\xd8\xff") {
        Some("image/jpeg")
    } else if b.starts_with(b"GIF87a") || b.starts_with(b"GIF89a") {
        Some("image/gif")
    } else if b.len() >= 12 && &b[0..4] == b"RIFF" && &b[8..12] == b"WEBP" {
        Some("image/webp")
    } else {
        None
    }
}

/// ¿Es un PDF? La firma `%PDF-` en el primer KB (algunos generadores dejan basura antes).
fn es_pdf(b: &[u8]) -> bool {
    b[..b.len().min(1024)].windows(5).any(|w| w == b"%PDF-")
}

/// Las páginas de un PDF, contando `/Type /Page` (no `/Pages`): un estimado (10). Sin ninguna, `None`.
pub fn paginas_pdf(b: &[u8]) -> Option<u32> {
    let mut n = 0u32;
    let mut i = 0;
    while let Some(k) = b[i..].windows(5).position(|w| w == b"/Type") {
        let mut j = i + k + 5;
        while j < b.len() && b[j].is_ascii_whitespace() {
            j += 1;
        }
        let es_page = b[j..].starts_with(b"/Page");
        let sigue = b.get(j + 5).copied();
        if es_page && !sigue.is_some_and(|c| c.is_ascii_alphanumeric()) {
            n += 1;
        }
        i = i + k + 5;
    }
    (n > 0).then_some(n)
}

/// Base64 estándar con relleno (RFC 4648), sin dependencias.
pub fn base64(b: &[u8]) -> String {
    const A: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut s = String::with_capacity(b.len().div_ceil(3) * 4);
    for t in b.chunks(3) {
        let n = (u32::from(t[0]) << 16) | (u32::from(*t.get(1).unwrap_or(&0)) << 8) | u32::from(*t.get(2).unwrap_or(&0));
        s.push(A[(n >> 18) as usize & 63] as char);
        s.push(A[(n >> 12) as usize & 63] as char);
        s.push(if t.len() > 1 { A[(n >> 6) as usize & 63] as char } else { '=' });
        s.push(if t.len() > 2 { A[n as usize & 63] as char } else { '=' });
    }
    s
}

/// El texto de un archivo, sin el BOM; `None` si no es UTF-8 válido.
fn texto_de(b: &[u8]) -> Option<&str> {
    std::str::from_utf8(b.strip_prefix(b"\xef\xbb\xbf").unwrap_or(b)).ok()
}

/// Revisa y lee el archivo. `Err(nombre)` si no entra.
fn leer(ruta: &Path) -> Result<(Adjunto, Vec<u8>), String> {
    let nombre = nombre_de(ruta);
    let no = || nombre.clone();
    let clase = clase_de(&nombre).ok_or_else(no)?;
    let meta = fs::metadata(ruta).map_err(|_| no())?;
    let tope = if clase == Clase::Texto { TOPE_TEXTO } else { TOPE_ADJUNTO };
    if !meta.is_file() || meta.len() > tope {
        return Err(no());
    }
    let b = fs::read(ruta).map_err(|_| no())?;
    if b.len() as u64 > tope {
        return Err(no());
    }
    let (media, paginas) = match clase {
        Clase::Pdf if es_pdf(&b) => ("application/pdf", paginas_pdf(&b)),
        Clase::Imagen => (media_imagen(&b).ok_or_else(no)?, None),
        Clase::Texto if texto_de(&b).is_some() => ("text/plain", None),
        _ => return Err(no()),
    };
    let bytes = b.len() as u64;
    Ok((Adjunto { nombre, clase, bytes, paginas, media }, b))
}

/// Revisa un archivo sin quedarse con sus bytes.
pub fn revisar(ruta: &Path) -> Result<Adjunto, String> {
    leer(ruta).map(|(a, _)| a)
}

/// Lo que devuelve `chat_adjunto` (7.8): `{ nombre, tipo, bytes, paginas }` o `{ error: "adjunto", nombre }`.
pub fn info(ruta: &Path) -> Value {
    match revisar(ruta) {
        Ok(a) => json!({ "nombre": a.nombre, "tipo": a.clase.tipo(), "bytes": a.bytes, "paginas": a.paginas }),
        Err(nombre) => json!({ "error": "adjunto", "nombre": nombre }),
    }
}

/// Una cerca de código más larga que cualquier tira de comillas del contenido (como mínimo, tres).
fn cerca_para(texto: &str) -> String {
    let mut largo = 0;
    let mut mas_largo = 0;
    for c in texto.chars() {
        largo = if c == '`' { largo + 1 } else { 0 };
        mas_largo = mas_largo.max(largo);
    }
    "`".repeat((mas_largo + 1).max(3))
}

/// El bloque de stream-json de un archivo ya revisado (7.4).
fn bloque(a: &Adjunto, b: &[u8]) -> Value {
    match a.clase {
        Clase::Pdf => json!({ "type": "document", "source": { "type": "base64", "media_type": a.media, "data": base64(b) } }),
        Clase::Imagen => json!({ "type": "image", "source": { "type": "base64", "media_type": a.media, "data": base64(b) } }),
        Clase::Texto => {
            let texto = texto_de(b).unwrap_or_default();
            let cerca = cerca_para(texto);
            json!({ "type": "text", "text": format!("Archivo: {}\n{cerca}{}\n{texto}\n{cerca}", a.nombre, extension(&a.nombre)) })
        }
    }
}

/// Los bloques de los adjuntos de un mensaje, en orden. `Err(nombre)` con el primero que no entra (o
/// el sexto: hasta 5 por mensaje).
pub fn bloques(rutas: &[String]) -> Result<Vec<Value>, String> {
    if let Some(sobra) = rutas.get(MAX_ADJUNTOS) {
        return Err(nombre_de(Path::new(sobra)));
    }
    rutas.iter().map(|r| leer(Path::new(r)).map(|(a, b)| bloque(&a, &b))).collect()
}

/// Un PDF de una página con `palabra` en Helvetica, con su tabla xref correcta: lo leen la API y los
/// tests (chat_tests.rs lo manda al `claude` real).
#[cfg(test)]
pub fn pdf_minimo(palabra: &str) -> Vec<u8> {
    let contenido = format!("BT /F1 24 Tf 40 60 Td ({palabra}) Tj ET");
    let objetos = [
        String::from("<< /Type /Catalog /Pages 2 0 R >>"),
        String::from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
        String::from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"),
        format!("<< /Length {} >>\nstream\n{contenido}\nendstream", contenido.len()),
        String::from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    ];
    let mut s = String::from("%PDF-1.4\n");
    let mut lugares = Vec::new();
    for (k, o) in objetos.iter().enumerate() {
        lugares.push(s.len());
        s.push_str(&format!("{} 0 obj\n{o}\nendobj\n", k + 1));
    }
    let xref = s.len();
    s.push_str(&format!("xref\n0 {}\n0000000000 65535 f \n", objetos.len() + 1));
    for l in lugares {
        s.push_str(&format!("{l:010} 00000 n \n"));
    }
    s.push_str(&format!("trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n", objetos.len() + 1));
    s.into_bytes()
}

#[cfg(test)]
#[path = "adjuntos_tests.rs"]
mod tests;
