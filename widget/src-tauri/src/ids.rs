//! Los ids que arman una ruta (`<config>/<tipo>/<id>.json`): listas y tareas (#39), hábitos (#41) y
//! proyectos (#44, proyectos-ux.md 11.1). Una sola regla para todos, validada en Rust antes de armar la
//! ruta: la ventana manda el id, nunca la ruta.

/// Largo máximo de un id (11.1 de tareas y de proyectos), con su prefijo.
pub(crate) const TOPE_ID: usize = 40;

/// Un id de 11.1 (`^[a-z0-9-]{1,40}$`) que empieza con su prefijo (`l-`, `t-`, `s-`, `h-`, `p-`): nunca
/// `..`, una barra, un punto ni un nombre reservado de Windows (`con`, `nul`… no tienen prefijo).
pub(crate) fn id_con(prefijo: &str, id: &str) -> bool {
    id.len() <= TOPE_ID
        && id.len() > prefijo.len()
        && id.starts_with(prefijo)
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}
