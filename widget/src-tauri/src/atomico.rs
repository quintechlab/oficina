//! Escritura atómica común (el historial del chat, #22, y las listas de tareas, #39): un temporal
//! propio junto al destino y `rename`. Si algo falla, el temporal se borra y el destino queda como
//! estaba. El candado de "una escritura por vez" es de cada módulo (protege también su lectura previa).

use std::fs;
use std::io;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static TEMPORALES: AtomicU64 = AtomicU64::new(0);

/// Escribe `bytes` en `destino` (crea la carpeta si falta) con un `.tmp` propio y `rename`.
pub fn escribir(destino: &Path, bytes: &[u8]) -> io::Result<()> {
    let carpeta = destino.parent().ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destino sin carpeta"))?;
    fs::create_dir_all(carpeta)?;
    let nombre = destino.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let n = TEMPORALES.fetch_add(1, Ordering::Relaxed);
    let temporal = carpeta.join(format!("{nombre}.{}-{n}.tmp", std::process::id()));
    let resultado = fs::write(&temporal, bytes).and_then(|()| fs::rename(&temporal, destino));
    if resultado.is_err() {
        let _ = fs::remove_file(&temporal);
    }
    resultado
}
