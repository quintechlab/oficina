//! "Arrancar con Windows" del menú de la bandeja. Apagado por defecto: solo el usuario lo
//! prende, porque cambia la configuración de inicio de Windows. La marca del menú muestra
//! siempre el estado real del sistema, no lo que se pidió.

/// Marca del menú a partir de lo que dice el sistema; si no se puede saber, apagada.
pub fn marca_real<E>(estado: Result<bool, E>) -> bool {
    estado.unwrap_or(false)
}

/// Aplica lo que el usuario pidió con un clic (`deseado`) y devuelve la marca real después,
/// consultando otra vez al sistema: si prender o apagar falló, la marca no miente.
pub fn aplicar<E>(
    deseado: bool,
    activar: impl FnOnce() -> Result<(), E>,
    desactivar: impl FnOnce() -> Result<(), E>,
    consultar: impl FnOnce() -> Result<bool, E>,
) -> bool {
    // El error de prender o apagar no importa acá: manda lo que el sistema diga después
    let _ = if deseado { activar() } else { desactivar() };
    marca_real(consultar())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;

    #[test]
    fn la_marca_sale_del_sistema_y_ante_la_duda_queda_apagada() {
        assert!(marca_real::<String>(Ok(true)));
        assert!(!marca_real::<String>(Ok(false)));
        assert!(!marca_real::<String>(Err(String::from("sin acceso al registro"))));
    }

    #[test]
    fn prender_llama_solo_a_activar_y_la_marca_refleja_el_sistema() {
        let activado = Cell::new(false);
        let desactivado = Cell::new(false);
        let marca = aplicar::<String>(
            true,
            || { activado.set(true); Ok(()) },
            || { desactivado.set(true); Ok(()) },
            || Ok(true),
        );
        assert!(marca);
        assert!(activado.get());
        assert!(!desactivado.get());
    }

    #[test]
    fn apagar_llama_solo_a_desactivar() {
        let activado = Cell::new(false);
        let marca = aplicar::<String>(false, || { activado.set(true); Ok(()) }, || Ok(()), || Ok(false));
        assert!(!marca);
        assert!(!activado.get());
    }

    #[test]
    fn si_prender_falla_la_marca_queda_como_esta_el_sistema() {
        let marca = aplicar::<String>(true, || Err(String::from("denegado")), || Ok(()), || Ok(false));
        assert!(!marca);
        let sin_saber = aplicar::<String>(true, || Ok(()), || Ok(()), || Err(String::from("sin acceso")));
        assert!(!sin_saber);
    }
}
