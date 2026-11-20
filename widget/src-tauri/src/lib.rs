mod sesiones;

/// Sesiones vivas de Claude Code de esta máquina, leídas de `~/.claude/oficina/sesiones`.
#[tauri::command]
fn leer_sesiones() -> Vec<serde_json::Value> {
    match sesiones::carpeta_sesiones() {
        Some(carpeta) => sesiones::leer_sesiones_de(&carpeta, chrono::Utc::now()),
        None => Vec::new(),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // TODO(bandeja): ícono en la bandeja de Windows y cerrar a la bandeja en vez de salir.
    // TODO(avisos): notificación de Windows cuando llega una pregunta con la ventana oculta.
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![leer_sesiones])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar el widget de la oficina");
}
