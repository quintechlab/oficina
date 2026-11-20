// Evita una consola extra en Windows en la versión de producción.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    oficina_widget_lib::run()
}
