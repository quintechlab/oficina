mod arranque;
mod diagnostico;
mod equipo;
mod preferencias;
mod primeros_pasos;
mod respuestas;
mod sesiones;

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, WebviewWindow, Wry};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const VENTANA: &str = "principal";
const BANDEJA: &str = "bandeja";
/// Tamaño por defecto de la ventana expandida. Después manda el contenido (`ajustar_ventana`).
const ANCHO: f64 = 400.0;
const ALTO: f64 = 620.0;
/// Mínimo de la ventana expandida (el mismo que `MINIMO` de `tamano.js`).
const MINIMO: (f64, f64) = (320.0, 120.0);

/// Qué se recuerda de la ventana entre usos.
fn banderas_estado() -> StateFlags {
    // Solo la posición: el tamaño lo decide el contenido y el estado guardado no tiene que pelearle
    StateFlags::POSITION
}

struct Estado {
    /// Tamaño de la ventana expandida antes de pasar a la tira mini.
    tamano_previo: Mutex<Option<LogicalSize<f64>>>,
    mini: Mutex<bool>,
    login: Mutex<Option<String>>,
    menu: Mutex<Option<MenuBandeja>>,
    /// Borde donde está acoplada la muesca; `None` flota (7.5).
    acople: Mutex<Option<preferencias::Acople>>,
    /// Zona que toma el mouse y si la ventana deja pasar los clics (9.6). Solo el hilo del sondeo
    /// cambia `dentro` e `ignorando`; los comandos cambian la zona y lo despiertan.
    puntero: Mutex<Puntero>,
    /// El hilo del sondeo del puntero, para despertarlo cuando cambia el modo o la zona.
    sondeo: Mutex<Option<std::thread::Thread>>,
    /// "Salir": el hilo del sondeo termina en su próxima vuelta.
    apagar: AtomicBool,
    /// La ventana nativa (HWND), para saber si está a la vista sin pasar por el hilo principal.
    #[cfg_attr(not(windows), allow(dead_code))]
    hwnd: AtomicIsize,
}

// ------------------------------------------------------------------ zona interactiva (9.6)
//
// Acoplada, la ventana tiene siempre el tamaño del panel abierto: abrir y cerrar son solo el recorte
// adentro (sin redimensionar, que en WebView2 deja la ventana transparente sin pintar ~0,4 s). Lo que
// no es la muesca (cerrada) o el tablero (abierta) deja pasar los clics: un hilo mira el puntero cada
// 20 ms y prende o apaga `set_ignore_cursor_events` solo cuando cruza el borde de la zona.

/// Cada cuánto se mira el puntero mientras la muesca está acoplada y a la vista.
const PASO_SONDEO: Duration = Duration::from_millis(20);
/// Sin sondeo (flotando, escondida o en la tira), el hilo duerme hasta que lo despierten o pase esto.
const ESPERA_QUIETO: Duration = Duration::from_millis(250);
/// Evento a la ventana cuando el puntero entra o sale de la zona: `{ dentro, n }`.
const EVENTO_ZONA: &str = "oficina://puntero-zona";

/// Rectángulo en px lógicos de pantalla (los de Tauri y de `muesca.js`).
#[derive(Clone, Copy, Debug, PartialEq)]
struct Zona {
    x: f64,
    y: f64,
    ancho: f64,
    alto: f64,
}

/// Una zona con números finitos, tamaño positivo y dentro de lo razonable; si no, `None`.
fn zona_valida(x: f64, y: f64, ancho: f64, alto: f64) -> Option<Zona> {
    let valido = |n: f64| n.is_finite() && n.abs() < 100_000.0;
    (valido(x) && valido(y) && valido(ancho) && valido(alto) && ancho > 0.0 && alto > 0.0).then_some(Zona { x, y, ancho, alto })
}

/// ¿El puntero (px físicos, los de `GetCursorPos`) está en la zona (px lógicos)? La zona pasa a px
/// físicos con la escala de la ventana, redondeada como `rect_fisico`. El borde izquierdo y el de
/// arriba cuentan; el derecho y el de abajo no (igual que `dentroDe` de `muesca.js`).
fn dentro_de_zona(cursor: (f64, f64), zona: &Zona, escala: f64) -> bool {
    let px = |v: f64| (v * escala).round();
    let (x0, y0) = (px(zona.x), px(zona.y));
    let (x1, y1) = (px(zona.x + zona.ancho), px(zona.y + zona.alto));
    cursor.0 >= x0 && cursor.0 < x1 && cursor.1 >= y0 && cursor.1 < y1
}

/// ¿Corre el sondeo? Solo acoplada, a la vista y fuera de la tira mini. Si no, la ventana toma
/// todos los clics, como siempre.
fn debe_sondear(acoplada: bool, visible: bool, mini: bool) -> bool {
    acoplada && visible && !mini
}

/// Lo que sabe el sondeo: la zona que mandó la ventana (`toda`: arrastrando, toda la ventana), la
/// escala de la ventana, si el puntero estaba adentro, si la ventana ya sabe ese estado
/// (`informado`), si deja pasar los clics y cuántos avisos se dieron (el `n` de cada evento, para
/// descartar uno viejo).
#[derive(Debug)]
struct Puntero {
    zona: Option<Zona>,
    toda: bool,
    escala: f64,
    dentro: bool,
    /// Falso al arrancar, con cada zona nueva y al volver a sondear: la próxima vuelta con zona
    /// avisa el estado real aunque coincida con `dentro` (que arranca en "adentro" para tomar los
    /// clics). Sin esto, con el puntero ya sobre la muesca al arrancar, el hover no abría nunca.
    informado: bool,
    ignorando: bool,
    cambios: u64,
}

impl Default for Puntero {
    fn default() -> Self {
        Puntero { zona: None, toda: false, escala: 1.0, dentro: true, informado: false, ignorando: false, cambios: 0 }
    }
}

/// La zona nueva que mandó la ventana: la próxima vuelta avisa el estado real.
fn poner_zona(p: &mut Puntero, zona: Zona, toda: bool, escala: f64) {
    p.zona = Some(zona);
    p.toda = toda;
    p.escala = escala;
    p.informado = false;
}

/// Al acoplar (otro borde, otro lugar o flotante) la zona vieja ya no vale: sin zona la ventana
/// toma los clics y no avisa nada hasta que llegue la nueva.
fn olvidar_zona(p: &mut Puntero) {
    p.zona = None;
    p.toda = false;
    p.informado = false;
}

/// Lo que hay que hacer después de mirar el puntero: avisar a la ventana (`dentro`, `n`) y prender o
/// apagar el paso de los clics. Vacío si nada cambió.
#[derive(Debug, Default, PartialEq)]
struct Paso {
    avisar: Option<(bool, u64)>,
    ignorar: Option<bool>,
}

/// Mira el puntero y actualiza `p`. Sin sondeo, la ventana vuelve a tomar los clics. Sin zona todavía
/// o arrastrando, el puntero cuenta como adentro (nunca deja pasar los clics sin saber dónde está la
/// muesca); sin zona tampoco avisa nada. Sin posición del puntero no cambia nada. Con zona avisa
/// cuando `dentro` cambia y, una vez, el primer estado después de una zona nueva o de volver a sondear.
fn evaluar(p: &mut Puntero, cursor: Option<(f64, f64)>, sondea: bool) -> Paso {
    let mut paso = Paso::default();
    if !sondea {
        // Mientras nadie mira, el puntero puede moverse: al volver se avisa lo que haya
        p.informado = false;
        if p.ignorando {
            p.ignorando = false;
            paso.ignorar = Some(false);
        }
        return paso;
    }
    let dentro = match (p.zona, cursor) {
        _ if p.toda => true,
        (None, _) => true,
        (Some(z), Some(c)) => dentro_de_zona(c, &z, p.escala),
        (Some(_), None) => return paso,
    };
    if p.zona.is_some() && (dentro != p.dentro || !p.informado) {
        p.cambios += 1;
        p.informado = true;
        paso.avisar = Some((dentro, p.cambios));
    }
    p.dentro = dentro;
    if p.ignorando == dentro {
        p.ignorando = !dentro;
        paso.ignorar = Some(!dentro);
    }
    paso
}

/// El puntero y si la ventana está a la vista, directo de Windows: sin pasar por el hilo principal y
/// sin reservar memoria en cada vuelta.
#[cfg(windows)]
mod nativo {
    #[repr(C)]
    struct Punto {
        x: i32,
        y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetCursorPos(punto: *mut Punto) -> i32;
        fn IsWindowVisible(hwnd: isize) -> i32;
        fn IsIconic(hwnd: isize) -> i32;
    }

    /// Posición del puntero en px físicos de pantalla.
    pub fn cursor() -> Option<(f64, f64)> {
        let mut p = Punto { x: 0, y: 0 };
        // SAFETY: GetCursorPos solo escribe en el Punto que se le pasa
        (unsafe { GetCursorPos(&mut p) } != 0).then_some((p.x as f64, p.y as f64))
    }

    /// Visible y no minimizada.
    pub fn a_la_vista(hwnd: isize) -> bool {
        // SAFETY: con un HWND que ya no existe, las dos devuelven 0
        hwnd != 0 && unsafe { IsWindowVisible(hwnd) != 0 && IsIconic(hwnd) == 0 }
    }
}

#[cfg(windows)]
fn cursor_fisico(_app: &AppHandle) -> Option<(f64, f64)> {
    nativo::cursor()
}

#[cfg(not(windows))]
fn cursor_fisico(app: &AppHandle) -> Option<(f64, f64)> {
    app.cursor_position().ok().map(|c| (c.x, c.y))
}

#[cfg(windows)]
fn a_la_vista(_app: &AppHandle, estado: &Estado) -> bool {
    nativo::a_la_vista(estado.hwnd.load(Ordering::Relaxed))
}

#[cfg(not(windows))]
fn a_la_vista(app: &AppHandle, _estado: &Estado) -> bool {
    ventana(app).is_some_and(|v| v.is_visible().unwrap_or(false) && !v.is_minimized().unwrap_or(false))
}

/// Una vuelta del sondeo: decide con `evaluar` y, fuera de todo lock, cambia el paso de los clics y
/// avisa a la ventana, solo si algo cambió. Devuelve si el sondeo está corriendo.
fn mirar_puntero(app: &AppHandle, estado: &Estado) -> bool {
    // Un lock envenenado no puede matar el hilo: si muere con los clics pasando, la muesca no responde más
    let acoplada = estado.acople.lock().unwrap_or_else(PoisonError::into_inner).is_some();
    let mini = *estado.mini.lock().unwrap_or_else(PoisonError::into_inner);
    let sondea = debe_sondear(acoplada, a_la_vista(app, estado), mini);
    let cursor = if sondea { cursor_fisico(app) } else { None };
    let paso = evaluar(&mut estado.puntero.lock().unwrap_or_else(PoisonError::into_inner), cursor, sondea);
    if let Some(ignorar) = paso.ignorar {
        let aplicado = ventana(app).is_some_and(|v| v.set_ignore_cursor_events(ignorar).is_ok());
        if !aplicado {
            // Si Windows no lo aplicó, la marca vuelve atrás y la próxima vuelta lo reintenta
            estado.puntero.lock().unwrap_or_else(PoisonError::into_inner).ignorando = !ignorar;
        }
    }
    if let Some((dentro, n)) = paso.avisar {
        let _ = app.emit(EVENTO_ZONA, serde_json::json!({ "dentro": dentro, "n": n }));
    }
    sondea
}

/// El único hilo del sondeo (uno solo, para siempre): cada 20 ms acoplada y a la vista, o dormido
/// hasta que lo despierten (`despertar`) o pasen 250 ms. Termina con "Salir".
fn sondear_puntero(app: AppHandle) {
    let estado = app.state::<Estado>();
    while !estado.apagar.load(Ordering::Relaxed) {
        let sondea = mirar_puntero(&app, &estado);
        std::thread::park_timeout(if sondea { PASO_SONDEO } else { ESPERA_QUIETO });
    }
}

/// Despierta al hilo del sondeo: cambió el modo (acoplada, flotante, tira, escondida) o la zona.
fn despertar(estado: &Estado) {
    if let Some(hilo) = estado.sondeo.lock().unwrap().as_ref() {
        hilo.unpark();
    }
}

struct MenuBandeja {
    arriba: CheckMenuItem<Wry>,
    avisar: CheckMenuItem<Wry>,
    pausa: CheckMenuItem<Wry>,
    arranque: CheckMenuItem<Wry>,
    agrandar: MenuItem<Wry>,
    achicar: MenuItem<Wry>,
    tamano_actual: MenuItem<Wry>,
    /// "Acoplar a": Arriba, Derecha, Abajo, Izquierda y Flotante (`preferencias::IDS_ACOPLE`).
    acople: Vec<CheckMenuItem<Wry>>,
    /// "Primeros pasos (falta n)…" (bienvenida-ux.md 3.5): el texto sigue a la última revisión.
    primeros_pasos: MenuItem<Wry>,
}

/// Orden del menú de la bandeja: "Primeros pasos" va justo debajo de "Mostrar oficina" (3.5).
const ORDEN_BANDEJA: [&str; 10] = ["mostrar", "primeros-pasos", "arriba", "avisar", "pausa", "acoplar", "tamano", "arranque", "separador", "salir"];

fn ventana(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(VENTANA)
}

fn mostrar(app: &AppHandle) {
    if let Some(v) = ventana(app) {
        let _ = v.unminimize();
        let _ = v.show();
        let _ = v.set_focus();
    }
    despertar(&app.state::<Estado>());
    // Acoplada, "Mostrar oficina" abre el panel (7.3); flotando, la ventana lo ignora
    let _ = app.emit("oficina://abrir", ());
}

/// "Primeros pasos…" de la bandeja (bienvenida-ux.md 3.5): muestra la ventana como "Mostrar
/// oficina" y la ventana abre el asistente (acoplada, también el panel) con el foco en su
/// encabezado. Abrirlo solo revisa: no corre ningún paso.
fn abrir_primeros_pasos(app: &AppHandle) {
    if let Some(v) = ventana(app) {
        let _ = v.unminimize();
        let _ = v.show();
        let _ = v.set_focus();
    }
    despertar(&app.state::<Estado>());
    let _ = app.emit("oficina://primeros-pasos-abrir", ());
}

/// Rectángulo de un monitor en píxeles físicos: x, y, ancho y alto.
type Rect = (i32, i32, u32, u32);

/// Bordes del monitor (arriba, derecha, abajo, izquierda) donde se puede acoplar: los que no tocan
/// a otro monitor (7.3). Tocar en una sola esquina no cuenta.
fn bordes_libres(monitor: Rect, otros: &[Rect]) -> [bool; 4] {
    let (x, y, w, h) = (monitor.0 as i64, monitor.1 as i64, monitor.2 as i64, monitor.3 as i64);
    let mut libres = [true; 4];
    for o in otros {
        let (ox, oy, ow, oh) = (o.0 as i64, o.1 as i64, o.2 as i64, o.3 as i64);
        let cruza_x = ox < x + w && ox + ow > x;
        let cruza_y = oy < y + h && oy + oh > y;
        if oy + oh == y && cruza_x {
            libres[0] = false;
        }
        if ox == x + w && cruza_y {
            libres[1] = false;
        }
        if oy == y + h && cruza_x {
            libres[2] = false;
        }
        if ox + ow == x && cruza_y {
            libres[3] = false;
        }
    }
    libres
}

fn rect_de(m: &tauri::Monitor) -> Rect {
    (m.position().x, m.position().y, m.size().width, m.size().height)
}

/// Acoplada, la ventana va siempre arriba, fuera de la barra de tareas y sin tamaño mínimo (la
/// muesca mide unos 112 × 40). Flotando, vuelve a lo de hoy: el mínimo del tablero y "Siempre
/// arriba" según la marca del menú.
fn aplicar_acople_ventana(v: &WebviewWindow, acoplada: bool, arriba_marcado: bool) -> tauri::Result<()> {
    if acoplada {
        v.set_min_size(None::<LogicalSize<f64>>)?;
        v.set_skip_taskbar(true)?;
        v.set_always_on_top(true)
    } else {
        v.set_min_size(Some(LogicalSize::new(MINIMO.0, MINIMO.1)))?;
        v.set_skip_taskbar(false)?;
        v.set_always_on_top(arriba_marcado)
    }
}

/// Pone las marcas de "Acoplar a" (una sola) según el acople actual.
fn marcar_acople(estado: &Estado) {
    let borde = estado.acople.lock().unwrap().map(|a| a.borde);
    if let Some(m) = estado.menu.lock().unwrap().as_ref() {
        for (item, marca) in m.acople.iter().zip(preferencias::marcas_acople(borde)) {
            let _ = item.set_checked(marca);
        }
    }
}

fn arriba_marcado(estado: &Estado) -> bool {
    estado.menu.lock().unwrap().as_ref().and_then(|m| m.arriba.is_checked().ok()).unwrap_or(true)
}

fn alternar(app: &AppHandle) {
    if let Some(v) = ventana(app) {
        let visible = v.is_visible().unwrap_or(false) && !v.is_minimized().unwrap_or(false);
        if visible {
            let _ = v.hide();
            despertar(&app.state::<Estado>());
        } else {
            mostrar(app);
        }
    }
}

/// Pasa la ventana a la tira mini (del tamaño que pide el frontend según la escala elegida) o la
/// devuelve a su tamaño anterior; después el contenido vuelve a mandar.
fn aplicar_mini(v: &WebviewWindow, estado: &Estado, mini: bool, tira: Option<LogicalSize<f64>>) -> tauri::Result<()> {
    let mut actual = estado.mini.lock().unwrap();
    if mini {
        let tira = tira.unwrap_or(LogicalSize::new(ANCHO, 56.0));
        if !*actual {
            let escala = v.scale_factor()?;
            *estado.tamano_previo.lock().unwrap() = Some(v.inner_size()?.to_logical(escala));
        }
        v.set_min_size(Some(tira))?;
        v.set_size(tira)?;
    } else if *actual {
        let previo = estado.tamano_previo.lock().unwrap().take().unwrap_or(LogicalSize::new(ANCHO, ALTO));
        v.set_min_size(Some(LogicalSize::new(MINIMO.0, MINIMO.1)))?;
        v.set_size(previo)?;
    }
    *actual = mini;
    Ok(())
}

fn ruta_preferencias(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|c| c.join("preferencias.json"))
}

fn tamano_guardado(app: &AppHandle) -> u32 {
    ruta_preferencias(app).map(|r| preferencias::leer_tamano(&r)).unwrap_or(preferencias::PASO_POR_DEFECTO)
}

/// Agranda (1), achica (-1) o vuelve a 100 % (0): guarda, actualiza el submenú y avisa a la ventana.
fn cambiar_tamano_app(app: &AppHandle, direccion: i32) -> u32 {
    let nuevo = preferencias::paso(tamano_guardado(app), direccion);
    if let Some(r) = ruta_preferencias(app) {
        let _ = preferencias::guardar_tamano(&r, nuevo);
    }
    let (puede_agrandar, puede_achicar, texto) = preferencias::menu_tamano(nuevo);
    if let Some(m) = app.state::<Estado>().menu.lock().unwrap().as_ref() {
        let _ = m.agrandar.set_enabled(puede_agrandar);
        let _ = m.achicar.set_enabled(puede_achicar);
        let _ = m.tamano_actual.set_text(texto);
    }
    let _ = app.emit("oficina://tamano", nuevo);
    nuevo
}

/// Segunda vez que se abre Oficina: no hay otra ventana, se muestra la que ya está.
fn al_segundo_arranque(app: &AppHandle) {
    let Some(v) = ventana(app) else { return };
    let mini = *app.state::<Estado>().mini.lock().unwrap();
    let acciones = preferencias::al_segundo_arranque(
        v.is_visible().unwrap_or(false),
        v.is_minimized().unwrap_or(false),
        mini,
    );
    for accion in acciones {
        match accion {
            preferencias::Accion::SalirDeMini => {
                let _ = app.emit("oficina://expandir", ());
            }
            preferencias::Accion::Restaurar => {
                let _ = v.unminimize();
            }
            preferencias::Accion::Mostrar => {
                let _ = v.show();
            }
            preferencias::Accion::Enfocar => {
                let _ = v.set_focus();
            }
        }
    }
    // Acoplada, se abre el panel como con "Mostrar oficina"; flotando, la ventana lo ignora
    let _ = app.emit("oficina://abrir", ());
}

/// Al salir, el paso de primeros pasos que corre (gh, winget, claude) no queda huérfano: se mata
/// sin esperarlo. Si no se puede (un instalador ya elevado), se anota y la salida sigue.
fn apagar_paso() {
    if let Err(e) = primeros_pasos::TURNO.apagar() {
        if let Some(ruta) = diagnostico::ruta_log() {
            let _ = diagnostico::agregar_linea(&ruta, &format!("primeros pasos al salir: {e}"), chrono::Utc::now(), diagnostico::TOPE_BYTES);
        }
    }
}

fn salir(app: &AppHandle) {
    apagar_paso();
    // El hilo del sondeo termina en su próxima vuelta
    let estado = app.state::<Estado>();
    estado.apagar.store(true, Ordering::Relaxed);
    despertar(&estado);
    // Guardar el tamaño expandido, no el de la tira mini
    if let Some(v) = ventana(app) {
        let _ = aplicar_mini(&v, &app.state::<Estado>(), false, None);
    }
    let _ = app.save_window_state(banderas_estado());
    app.exit(0);
}

/// Sesiones vivas de Claude Code de esta máquina, leídas de `~/.claude/oficina/sesiones`.
#[tauri::command]
fn leer_sesiones() -> Vec<serde_json::Value> {
    match sesiones::carpeta_sesiones() {
        Some(carpeta) => sesiones::leer_sesiones_de(&carpeta, chrono::Utc::now()),
        None => Vec::new(),
    }
}

/// Comentarios del Issue "Presencia" y tu login, con el `gh` de la máquina. Nunca falla:
/// un problema con `gh` vuelve como `error` para mostrarlo en una línea.
#[tauri::command]
async fn leer_equipo(estado: State<'_, Estado>) -> Result<serde_json::Value, String> {
    let guardado = estado.login.lock().unwrap().clone();
    let yo = match guardado {
        Some(login) => Some(login),
        None => {
            let leido = tauri::async_runtime::spawn_blocking(|| equipo::correr_gh(&["api", "user"]))
                .await
                .map_err(|e| e.to_string())?
                .ok()
                .and_then(|t| equipo::login_desde_json(&t));
            if leido.is_some() {
                *estado.login.lock().unwrap() = leido.clone();
            }
            leido
        }
    };
    let comentarios = tauri::async_runtime::spawn_blocking(|| equipo::correr_gh(&["api", equipo::RUTA_COMENTARIOS]))
        .await
        .map_err(|e| e.to_string())?
        .and_then(|t| equipo::comentarios_desde_json(&t));
    Ok(equipo::respuesta(yo, comentarios))
}

/// Qué falta en la máquina para la Oficina (bienvenida-ux.md 3.3), solo con comandos de lectura.
/// Se llama al arrancar, al abrir el asistente y con "Volver a buscar"; nunca en el ciclo de 1,5 s.
#[tauri::command]
async fn revisar_primeros_pasos() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(primeros_pasos::revisar).await.map_err(|e| e.to_string())
}

/// Pone el texto del ítem "Primeros pasos" de la bandeja según los pasos que faltan (3.5).
#[tauri::command]
fn menu_primeros_pasos(estado: State<'_, Estado>, faltan: Option<u32>) -> Result<(), String> {
    if let Some(m) = estado.menu.lock().unwrap().as_ref() {
        m.primeros_pasos.set_text(primeros_pasos::texto_menu(faltan)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Corre un paso de primeros pasos porque el usuario tocó su botón (bienvenida-ux.md 9.5). Un paso
/// por vez: si ya corre otro, se rechaza. Lo que pasa llega a la ventana como `oficina://primeros-pasos`.
/// Al conectar una cuenta, el login guardado de `leer_equipo` se olvida (el tablero lee la cuenta nueva).
#[tauri::command]
fn correr_paso(app: AppHandle, paso: String) -> Result<(), String> {
    let accion = primeros_pasos::Accion::desde(&paso).ok_or("paso desconocido")?;
    primeros_pasos::TURNO.empezar(accion)?;
    let lanzado = std::thread::Builder::new().name(String::from("oficina-paso")).spawn(move || {
        let emitir = |v: serde_json::Value| {
            let _ = app.emit(primeros_pasos::EVENTO, v);
        };
        let para_abrir = app.clone();
        // Sin terminal, gh imprime la dirección en vez de abrir el navegador: se abre en el mismo clic
        let abrir = move || {
            let _ = para_abrir.run_on_main_thread(|| {
                if let Err(e) = primeros_pasos::abrir_en_navegador(primeros_pasos::URL_DISPOSITIVO) {
                    if let Some(ruta) = diagnostico::ruta_log() {
                        let _ = diagnostico::agregar_linea(&ruta, &format!("primeros pasos: {e}"), chrono::Utc::now(), diagnostico::TOPE_BYTES);
                    }
                }
            });
        };
        let fin = {
            // El turno se suelta al salir de este bloque, aunque el paso se caiga
            let _soltar = primeros_pasos::TURNO.soltar_al_terminar();
            let fin = primeros_pasos::ejecutar(accion, &primeros_pasos::TURNO, &emitir, &abrir);
            if fin == primeros_pasos::Fin::Listo && accion.conecta() {
                *app.state::<Estado>().login.lock().unwrap_or_else(PoisonError::into_inner) = None;
            }
            fin
        };
        emitir(fin.evento(accion));
    });
    lanzado.map(|_| ()).map_err(|e| {
        primeros_pasos::TURNO.terminar();
        e.to_string()
    })
}

/// "Cancelar" mientras se pide o se muestra el código de GitHub: mata el proceso de `gh`.
#[tauri::command]
fn cancelar_paso() -> bool {
    primeros_pasos::TURNO.cancelar()
}

/// Abre en el navegador una de las direcciones conocidas del asistente (nunca una que mande la ventana).
#[tauri::command]
fn abrir_enlace(cual: String) -> Result<(), String> {
    let url = primeros_pasos::enlace(&cual).ok_or("enlace desconocido")?;
    primeros_pasos::abrir_en_navegador(url)
}

/// Fija la ventana arriba de las demás y sincroniza la marca del menú de la bandeja.
#[tauri::command]
fn fijar_arriba(app: AppHandle, estado: State<'_, Estado>, valor: bool) -> Result<(), String> {
    if let Some(v) = ventana(&app) {
        v.set_always_on_top(valor).map_err(|e| e.to_string())?;
    }
    if let Some(m) = estado.menu.lock().unwrap().as_ref() {
        let _ = m.arriba.set_checked(valor);
    }
    Ok(())
}

/// Marcas del menú de la bandeja, para que la ventana arranque sincronizada.
#[tauri::command]
fn estado_menu(app: AppHandle, estado: State<'_, Estado>) -> serde_json::Value {
    let menu = estado.menu.lock().unwrap();
    let marca = |item: Option<&CheckMenuItem<Wry>>| item.and_then(|i| i.is_checked().ok());
    serde_json::json!({
        "arriba": marca(menu.as_ref().map(|m| &m.arriba)),
        "avisar": marca(menu.as_ref().map(|m| &m.avisar)),
        "pausa": marca(menu.as_ref().map(|m| &m.pausa)),
        "tamano": tamano_guardado(&app),
        "acople": preferencias::valor_de_acople(*estado.acople.lock().unwrap()),
    })
}

/// Ctrl + / Ctrl − / Ctrl 0 desde la ventana: el mismo cambio que el submenú "Tamaño".
#[tauri::command]
fn cambiar_tamano(app: AppHandle, direccion: i32) -> u32 {
    cambiar_tamano_app(&app, direccion.signum())
}

/// Posición y tamaño de la ventana, área de trabajo de su monitor y bordes donde se puede acoplar
/// (los que no tocan a otro monitor), en píxeles lógicos. Con `puntero`, el monitor es el que está
/// bajo el puntero (para el imán al arrastrar, 9.4); si no, el de la ventana.
#[tauri::command]
fn geometria(app: AppHandle, puntero: Option<bool>) -> Result<serde_json::Value, String> {
    let v = ventana(&app).ok_or("sin ventana")?;
    let escala = v.scale_factor().map_err(|e| e.to_string())?;
    let pos = v.outer_position().map_err(|e| e.to_string())?.to_logical::<f64>(escala);
    let tam = v.inner_size().map_err(|e| e.to_string())?.to_logical::<f64>(escala);
    let bajo_puntero = if puntero == Some(true) {
        let c = v.cursor_position().map_err(|e| e.to_string())?;
        v.monitor_from_point(c.x, c.y).map_err(|e| e.to_string())?
    } else {
        None
    };
    let monitor = match bajo_puntero {
        Some(m) => m,
        None => v.current_monitor().map_err(|e| e.to_string())?.ok_or("sin monitor")?,
    };
    let area = monitor.work_area();
    let esc_m = monitor.scale_factor();
    let propio = rect_de(&monitor);
    let otros: Vec<Rect> = v.available_monitors().map_err(|e| e.to_string())?.iter().map(rect_de).filter(|r| *r != propio).collect();
    let libres = bordes_libres(propio, &otros);
    Ok(serde_json::json!({
        "x": pos.x, "y": pos.y, "ancho": tam.width, "alto": tam.height,
        "area": {
            "x": area.position.x as f64 / esc_m, "y": area.position.y as f64 / esc_m,
            "ancho": area.size.width as f64 / esc_m, "alto": area.size.height as f64 / esc_m,
        },
        "libres": { "arriba": libres[0], "derecha": libres[1], "abajo": libres[2], "izquierda": libres[3] },
    }))
}

/// Mueve la ventana sin cambiarle el tamaño (arrastre propio, 9.3), en píxeles lógicos.
#[tauri::command]
fn mover_ventana(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if !(x.is_finite() && y.is_finite() && x.abs() < 100_000.0 && y.abs() < 100_000.0) {
        return Err(String::from("posición inválida"));
    }
    let v = ventana(&app).ok_or("sin ventana")?;
    v.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())
}

/// Acopla la muesca a `borde` en `lugar` (0 a 1), o la deja flotando sin `borde`: lo guarda en
/// `preferencias.json`, ajusta la ventana (arriba, sin barra de tareas, sin mínimo) y las marcas de
/// "Acoplar a". Mover y animar la ventana lo hace el frontend.
#[tauri::command]
fn guardar_acople(app: AppHandle, estado: State<'_, Estado>, borde: Option<String>, lugar: Option<f64>) -> Result<(), String> {
    let acople = match borde {
        Some(b) => Some(preferencias::Acople {
            borde: preferencias::Borde::desde(&b).ok_or_else(|| format!("borde desconocido: {b}"))?,
            lugar: preferencias::lugar_valido(lugar),
        }),
        None => None,
    };
    *estado.acople.lock().unwrap() = acople;
    // La zona del acople anterior ya no vale (ni "toda" de un arrastre): hasta que la ventana mande
    // la nueva, toma los clics; con la nueva, el sondeo avisa el estado real en su primera vuelta
    olvidar_zona(&mut estado.puntero.lock().unwrap_or_else(PoisonError::into_inner));
    // Flotando, el sondeo se detiene y la ventana vuelve a tomar todos los clics; acoplada, arranca
    despertar(&estado);
    marcar_acople(&estado);
    if let Some(v) = ventana(&app) {
        aplicar_acople_ventana(&v, acople.is_some(), arriba_marcado(&estado)).map_err(|e| e.to_string())?;
    }
    match ruta_preferencias(&app) {
        Some(r) => preferencias::guardar_acople(&r, acople),
        None => Err(String::from("no se conoce la carpeta de configuración")),
    }
}

/// Ajusta la ventana al contenido: tamaño y posición ya calculados por `tamano.js`.
/// En la tira mini no hace nada (la tira tiene su propio tamaño).
#[tauri::command]
fn ajustar_ventana(app: AppHandle, estado: State<'_, Estado>, ancho: f64, alto: f64, x: f64, y: f64) -> Result<(), String> {
    if *estado.mini.lock().unwrap() {
        return Ok(());
    }
    let valido = |n: f64| n.is_finite() && n.abs() < 100_000.0;
    if !(valido(ancho) && valido(alto) && valido(x) && valido(y)) || ancho < 1.0 || alto < 1.0 {
        return Err(String::from("tamaño inválido"));
    }
    let v = ventana(&app).ok_or("sin ventana")?;
    mover_y_redimensionar(&v, ancho, alto, x, y)
}

/// Posición y tamaño en píxeles físicos (x, y, ancho, alto), redondeados, con 1 px de mínimo.
fn rect_fisico(x: f64, y: f64, ancho: f64, alto: f64, escala: f64) -> (i32, i32, i32, i32) {
    let px = |v: f64| (v * escala).round() as i32;
    (px(x), px(y), px(ancho).max(1), px(alto).max(1))
}

/// Mueve y redimensiona en UNA operación de Windows (`SetWindowPos`). Con `set_size` y después
/// `set_position` había cuadros con la ventana grande en el lugar viejo: el parpadeo al abrir la muesca.
#[cfg(windows)]
fn mover_y_redimensionar(v: &WebviewWindow, ancho: f64, alto: f64, x: f64, y: f64) -> Result<(), String> {
    #[link(name = "user32")]
    extern "system" {
        fn SetWindowPos(hwnd: isize, despues: isize, x: i32, y: i32, cx: i32, cy: i32, banderas: u32) -> i32;
    }
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_NOOWNERZORDER: u32 = 0x0200;
    let hwnd = v.hwnd().map_err(|e| e.to_string())?.0 as isize;
    let escala = v.scale_factor().map_err(|e| e.to_string())?;
    let (fx, fy, fa, fh) = rect_fisico(x, y, ancho, alto, escala);
    // SAFETY: hwnd es la ventana viva de Tauri; SetWindowPos no guarda punteros
    let ok = unsafe { SetWindowPos(hwnd, 0, fx, fy, fa, fh, SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER) };
    if ok == 0 {
        // Si Windows la rechaza, el camino de antes en dos pasos
        v.set_size(LogicalSize::new(ancho, alto)).map_err(|e| e.to_string())?;
        return v.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
fn mover_y_redimensionar(v: &WebviewWindow, ancho: f64, alto: f64, x: f64, y: f64) -> Result<(), String> {
    v.set_size(LogicalSize::new(ancho, alto)).map_err(|e| e.to_string())?;
    v.set_position(LogicalPosition::new(x, y)).map_err(|e| e.to_string())
}

#[tauri::command]
fn modo_mini(app: AppHandle, estado: State<'_, Estado>, mini: bool, ancho: Option<f64>, alto: Option<f64>) -> Result<(), String> {
    let v = ventana(&app).ok_or("sin ventana")?;
    let tira = match (ancho, alto) {
        (Some(a), Some(h)) if a.is_finite() && h.is_finite() && a >= 1.0 && h >= 1.0 => Some(LogicalSize::new(a, h)),
        _ => None,
    };
    let hecho = aplicar_mini(&v, &estado, mini, tira).map_err(|e| e.to_string());
    despertar(&estado);
    hecho
}

/// Esconde la ventana en la bandeja (la × de la barra de título).
#[tauri::command]
fn esconder(app: AppHandle, estado: State<'_, Estado>) {
    if let Some(v) = ventana(&app) {
        let _ = v.hide();
    }
    despertar(&estado);
}

/// Zona de la ventana acoplada que toma el mouse (9.6), en px lógicos de pantalla: la muesca con un
/// margen (cerrada), el tablero (abierta) o toda la ventana (`toda`, mientras se arrastra). Fuera de
/// ella los clics pasan a lo que hay debajo. Devuelve si el puntero está adentro ahora; el cambio lo
/// aplica y lo avisa el hilo del sondeo (`oficina://puntero-zona`), el único que toca la ventana.
#[tauri::command]
fn zona_interactiva(app: AppHandle, estado: State<'_, Estado>, x: f64, y: f64, ancho: f64, alto: f64, toda: Option<bool>) -> Result<bool, String> {
    let zona = zona_valida(x, y, ancho, alto).ok_or("zona inválida")?;
    let escala = ventana(&app).ok_or("sin ventana")?.scale_factor().map_err(|e| e.to_string())?;
    let toda = toda.unwrap_or(false);
    // Una zona nueva: la próxima vuelta del sondeo avisa el estado real aunque no haya cambiado
    poner_zona(&mut estado.puntero.lock().unwrap(), zona, toda, escala);
    despertar(&estado);
    Ok(toda || cursor_fisico(&app).is_none_or(|c| dentro_de_zona(c, &zona, escala)))
}

/// Cambia el ícono de la bandeja (la cabeza con la cuenta de preguntas, dibujada en `bandeja.js`).
#[tauri::command]
fn poner_bandeja(app: AppHandle, rgba: Vec<u8>, ancho: u32, alto: u32, texto: String) -> Result<(), String> {
    if rgba.len() != (ancho * alto * 4) as usize {
        return Err(String::from("ícono con tamaño inválido"));
    }
    let bandeja = app.tray_by_id(BANDEJA).ok_or("sin bandeja")?;
    bandeja.set_icon(Some(Image::new_owned(rgba, ancho, alto))).map_err(|e| e.to_string())?;
    bandeja.set_tooltip(Some(texto)).map_err(|e| e.to_string())
}

fn carpeta_de_respuestas() -> Result<std::path::PathBuf, String> {
    respuestas::carpeta_respuestas().ok_or_else(|| String::from("no se conoce la carpeta del usuario"))
}

/// Deja la respuesta que el usuario tocó en el globo para la sesión que pregunta. Solo se llama
/// desde un clic: el widget nunca responde por su cuenta.
#[tauri::command]
fn responder(id: String, answers: serde_json::Map<String, serde_json::Value>, libres: Vec<String>) -> Result<(), String> {
    respuestas::escribir_respuesta(&carpeta_de_respuestas()?, &id, &answers, &libres, chrono::Utc::now())
}

/// `pendiente`, `consumida` o `ausente`: si la sesión tomó la respuesta enviada.
#[tauri::command]
fn estado_respuesta(id: String) -> Result<&'static str, String> {
    respuestas::estado_respuesta(&carpeta_de_respuestas()?, &id)
}

#[tauri::command]
fn borrar_respuesta(id: String) -> Result<(), String> {
    respuestas::borrar_respuesta(&carpeta_de_respuestas()?, &id)
}

/// Una línea en el log de diagnóstico (clics del globo, envíos y errores del frontend).
#[tauri::command]
fn registrar(linea: String) {
    if let Some(ruta) = diagnostico::ruta_log() {
        let _ = diagnostico::agregar_linea(&ruta, &linea, chrono::Utc::now(), diagnostico::TOPE_BYTES);
    }
}

/// Notificación de Windows con una pregunta nueva.
#[tauri::command]
fn avisar(app: AppHandle, titulo: String, cuerpo: String) -> Result<(), String> {
    app.notification().builder().title(titulo).body(cuerpo).show().map_err(|e| e.to_string())
}

fn crear_bandeja(app: &AppHandle) -> tauri::Result<()> {
    let mostrar_item = MenuItem::with_id(app, "mostrar", "Mostrar oficina", true, None::<&str>)?;
    let arriba = CheckMenuItem::with_id(app, "arriba", "Siempre arriba", true, true, None::<&str>)?;
    let avisar_item = CheckMenuItem::with_id(app, "avisar", "Avisarme con cada pregunta", true, true, None::<&str>)?;
    let pausa = CheckMenuItem::with_id(app, "pausa", "Pausar animaciones", true, false, None::<&str>)?;
    // Apagado salvo que el usuario lo haya prendido: la marca sale del estado real de Windows
    let arranca = arranque::marca_real(app.autolaunch().is_enabled());
    let arranque_item = CheckMenuItem::with_id(app, "arranque", "Arrancar con Windows", true, arranca, None::<&str>)?;
    // Submenú "Tamaño": agrandar y achicar de a un paso (100 % a 200 %) y el porcentaje actual
    let (puede_agrandar, puede_achicar, texto) = preferencias::menu_tamano(tamano_guardado(app));
    let agrandar = MenuItem::with_id(app, "tamano:agrandar", "Agrandar", puede_agrandar, Some("Ctrl+Plus"))?;
    let achicar = MenuItem::with_id(app, "tamano:achicar", "Achicar", puede_achicar, Some("Ctrl+Minus"))?;
    let tamano_actual = MenuItem::with_id(app, "tamano:actual", texto, false, None::<&str>)?;
    let submenu = Submenu::with_items(app, "Tamaño", true, &[&agrandar, &achicar, &PredefinedMenuItem::separator(app)?, &tamano_actual])?;
    // Submenú "Acoplar a" (7.3): una sola marca, la del borde guardado o Flotante
    let marcas = preferencias::marcas_acople(app.state::<Estado>().acople.lock().unwrap().map(|a| a.borde));
    let textos = ["Arriba", "Derecha", "Abajo", "Izquierda", "Flotante"];
    let mut acople = Vec::new();
    for ((id, texto), marca) in preferencias::IDS_ACOPLE.iter().zip(textos).zip(marcas) {
        acople.push(CheckMenuItem::with_id(app, *id, texto, true, marca, None::<&str>)?);
    }
    let submenu_acople = Submenu::with_items(
        app,
        "Acoplar a",
        true,
        &[&acople[0], &acople[1], &acople[2], &acople[3], &PredefinedMenuItem::separator(app)?, &acople[4]],
    )?;
    let salir_item = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let separador = PredefinedMenuItem::separator(app)?;
    let primeros_pasos_item = MenuItem::with_id(app, "primeros-pasos", primeros_pasos::texto_menu(None), true, None::<&str>)?;
    let items: Vec<&dyn IsMenuItem<Wry>> = ORDEN_BANDEJA
        .iter()
        .map(|id| -> &dyn IsMenuItem<Wry> {
            match *id {
                "mostrar" => &mostrar_item,
                "primeros-pasos" => &primeros_pasos_item,
                "arriba" => &arriba,
                "avisar" => &avisar_item,
                "pausa" => &pausa,
                "acoplar" => &submenu_acople,
                "tamano" => &submenu,
                "arranque" => &arranque_item,
                "separador" => &separador,
                _ => &salir_item,
            }
        })
        .collect();
    let menu = Menu::with_items(app, &items)?;

    let mut bandeja = TrayIconBuilder::with_id(BANDEJA)
        .menu(&menu)
        .tooltip("Oficina")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| {
            let estado = app.state::<Estado>();
            let marca = |f: fn(&MenuBandeja) -> &CheckMenuItem<Wry>| {
                estado.menu.lock().unwrap().as_ref().and_then(|m| f(m).is_checked().ok()).unwrap_or(false)
            };
            match evento.id().as_ref() {
                "mostrar" => mostrar(app),
                "primeros-pasos" => abrir_primeros_pasos(app),
                "arriba" => {
                    let valor = marca(|m| &m.arriba);
                    // Acoplada, la muesca queda siempre arriba; la marca vale para cuando flote
                    let acoplada = estado.acople.lock().unwrap().is_some();
                    if let Some(v) = ventana(app) {
                        let _ = v.set_always_on_top(valor || acoplada);
                    }
                    let _ = app.emit("oficina://arriba", valor);
                }
                "avisar" => {
                    let _ = app.emit("oficina://avisar", marca(|m| &m.avisar));
                }
                "pausa" => {
                    let _ = app.emit("oficina://pausa", marca(|m| &m.pausa));
                }
                "arranque" => {
                    // Solo con este clic del usuario cambia el inicio de Windows
                    let deseado = marca(|m| &m.arranque);
                    let auto = app.autolaunch();
                    let real = arranque::aplicar(deseado, || auto.enable(), || auto.disable(), || auto.is_enabled());
                    if let Some(m) = app.state::<Estado>().menu.lock().unwrap().as_ref() {
                        let _ = m.arranque.set_checked(real);
                    }
                }
                "tamano:agrandar" => {
                    cambiar_tamano_app(app, 1);
                }
                "tamano:achicar" => {
                    cambiar_tamano_app(app, -1);
                }
                "salir" => salir(app),
                id => {
                    if let Some(eleccion) = preferencias::eleccion_de_menu(id) {
                        // El clic ya cambió la marca del ítem: se vuelve a la marca actual hasta que
                        // la ventana acople de verdad (guardar_acople), así nunca quedan dos marcadas
                        marcar_acople(&estado);
                        let _ = app.emit("oficina://acoplar", eleccion.map(|b| b.nombre()));
                    }
                }
            }
        })
        .on_tray_icon_event(|bandeja, evento| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = evento {
                alternar(bandeja.app_handle());
            }
        });
    if let Some(icono) = app.default_window_icon() {
        bandeja = bandeja.icon(icono.clone());
    }
    bandeja.build(app)?;
    *app.state::<Estado>().menu.lock().unwrap() = Some(MenuBandeja {
        arriba,
        avisar: avisar_item,
        pausa,
        arranque: arranque_item,
        agrandar,
        achicar,
        tamano_actual,
        acople,
        primeros_pasos: primeros_pasos_item,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRINCIPAL: Rect = (0, 0, 1920, 1080);

    #[test]
    fn primeros_pasos_va_debajo_de_mostrar_y_el_resto_del_menu_no_cambia() {
        assert_eq!(ORDEN_BANDEJA, ["mostrar", "primeros-pasos", "arriba", "avisar", "pausa", "acoplar", "tamano", "arranque", "separador", "salir"]);
    }

    #[test]
    fn el_rectangulo_fisico_redondea_posicion_y_tamano_con_la_escala() {
        // Al 100 % queda igual; al 125 % y 150 % se multiplica y se redondea al píxel más cercano
        assert_eq!(rect_fisico(100.0, 20.0, 676.0, 656.0, 1.0), (100, 20, 676, 656));
        assert_eq!(rect_fisico(100.5, 20.2, 676.0, 656.0, 1.25), (126, 25, 845, 820));
        assert_eq!(rect_fisico(-1920.0, 0.0, 362.0, 96.0, 1.5), (-2880, 0, 543, 144));
        // Nunca menos de 1 px de tamaño
        assert_eq!(rect_fisico(0.0, 0.0, 0.2, 0.2, 1.0), (0, 0, 1, 1));
    }

    const ZONA: Zona = Zona { x: 100.0, y: 0.0, ancho: 200.0, alto: 50.0 };

    #[test]
    fn el_puntero_esta_en_la_zona_con_el_borde_izquierdo_y_el_de_arriba_adentro() {
        // Al 100 %: el izquierdo y el de arriba cuentan, el derecho y el de abajo no (como dentroDe)
        assert!(dentro_de_zona((100.0, 0.0), &ZONA, 1.0));
        assert!(dentro_de_zona((299.0, 49.0), &ZONA, 1.0));
        assert!(!dentro_de_zona((300.0, 10.0), &ZONA, 1.0));
        assert!(!dentro_de_zona((150.0, 50.0), &ZONA, 1.0));
        assert!(!dentro_de_zona((99.0, 10.0), &ZONA, 1.0));
        // Al 150 %: la zona lógica 100..300 es 150..450 en px físicos
        assert!(dentro_de_zona((150.0, 0.0), &ZONA, 1.5));
        assert!(dentro_de_zona((449.0, 74.0), &ZONA, 1.5));
        assert!(!dentro_de_zona((450.0, 10.0), &ZONA, 1.5));
        assert!(!dentro_de_zona((149.0, 10.0), &ZONA, 1.5));
        // Un monitor a la izquierda del principal (coordenadas negativas)
        let izq = Zona { x: -1280.0, y: 0.0, ancho: 140.0, alto: 56.0 };
        assert!(dentro_de_zona((-1920.0, 0.0), &izq, 1.5));
        assert!(!dentro_de_zona((-1921.0, 0.0), &izq, 1.5));
    }

    #[test]
    fn el_sondeo_corre_solo_acoplada_visible_y_fuera_de_la_tira() {
        assert!(debe_sondear(true, true, false));
        // Flotando, escondida en la bandeja o en la tira mini: no
        assert!(!debe_sondear(false, true, false));
        assert!(!debe_sondear(true, false, false));
        assert!(!debe_sondear(true, true, true));
        assert!(!debe_sondear(false, false, true));
    }

    #[test]
    fn sin_zona_la_ventana_toma_los_clics() {
        // Hasta que la ventana diga su zona, nunca deja pasar los clics ni avisa nada
        let mut p = Puntero::default();
        let paso = evaluar(&mut p, Some((5000.0, 5000.0)), true);
        assert_eq!(paso.ignorar, None);
        assert_eq!(paso.avisar, None);
        assert!(p.dentro && !p.ignorando);
    }

    #[test]
    fn al_arrancar_con_el_puntero_sobre_la_muesca_avisa_que_esta_adentro() {
        // El sondeo arranca suponiendo "adentro" (toma los clics); el primer estado con zona se
        // avisa igual, aunque coincida, porque la ventana todavía no sabe nada
        let mut p = Puntero::default();
        poner_zona(&mut p, ZONA, false, 1.0);
        let paso = evaluar(&mut p, Some((150.0, 10.0)), true);
        assert_eq!(paso.avisar, Some((true, 1)));
        assert_eq!(paso.ignorar, None);
        // Ya avisado, el mismo estado no se repite
        assert_eq!(evaluar(&mut p, Some((160.0, 20.0)), true), Paso::default());
    }

    #[test]
    fn cada_zona_nueva_avisa_una_vez_el_estado_real() {
        let mut p = Puntero::default();
        poner_zona(&mut p, ZONA, false, 1.0);
        evaluar(&mut p, Some((150.0, 10.0)), true);
        // Abrir, cerrar o reacomodar manda otra zona: la primera vuelta avisa lo que hay
        poner_zona(&mut p, ZONA, false, 1.0);
        assert_eq!(evaluar(&mut p, Some((150.0, 10.0)), true).avisar, Some((true, 2)));
        poner_zona(&mut p, Zona { x: 0.0, y: 0.0, ancho: 50.0, alto: 50.0 }, false, 1.0);
        let afuera = evaluar(&mut p, Some((150.0, 10.0)), true);
        assert_eq!(afuera.avisar, Some((false, 3)));
        assert_eq!(afuera.ignorar, Some(true));
    }

    #[test]
    fn al_reacoplar_la_zona_vieja_se_olvida_hasta_que_llegue_la_nueva() {
        let mut p = Puntero::default();
        poner_zona(&mut p, ZONA, true, 1.0);
        evaluar(&mut p, Some((10.0, 10.0)), true);
        poner_zona(&mut p, ZONA, false, 1.0);
        evaluar(&mut p, Some((10.0, 10.0)), true);
        assert!(p.ignorando);
        // guardar_acople: sin zona ni "toda", la ventana toma los clics y no avisa con datos viejos
        olvidar_zona(&mut p);
        assert_eq!(p.zona, None);
        assert!(!p.toda);
        let paso = evaluar(&mut p, Some((10.0, 10.0)), true);
        assert_eq!(paso.ignorar, Some(false));
        assert_eq!(paso.avisar, None);
        // Llega la zona del borde nuevo con el puntero encima: avisa "adentro" aunque ya lo suponía
        poner_zona(&mut p, ZONA, false, 1.0);
        let adentro = evaluar(&mut p, Some((150.0, 10.0)), true);
        assert_eq!(adentro.avisar.map(|(d, _)| d), Some(true));
        assert_eq!(adentro.ignorar, None);
    }

    #[test]
    fn al_volver_a_sondear_avisa_el_estado_real() {
        // Escondida o en la tira el puntero se movió sin que nadie mirara: al volver, se avisa
        let mut p = Puntero::default();
        poner_zona(&mut p, ZONA, false, 1.0);
        evaluar(&mut p, Some((150.0, 10.0)), true);
        evaluar(&mut p, Some((150.0, 10.0)), false);
        assert_eq!(evaluar(&mut p, Some((150.0, 10.0)), true).avisar, Some((true, 2)));
    }

    #[test]
    fn el_puntero_que_sale_de_la_zona_deja_pasar_los_clics_y_avisa_una_sola_vez() {
        let mut p = Puntero { zona: Some(ZONA), ..Puntero::default() };
        let afuera = evaluar(&mut p, Some((10.0, 10.0)), true);
        assert_eq!(afuera.ignorar, Some(true));
        assert_eq!(afuera.avisar, Some((false, 1)));
        // El mismo estado otra vez: nada que hacer (ni ventana ni evento)
        assert_eq!(evaluar(&mut p, Some((20.0, 20.0)), true), Paso::default());
        // Vuelve a entrar: toma los clics y avisa con el número siguiente
        let adentro = evaluar(&mut p, Some((150.0, 10.0)), true);
        assert_eq!(adentro.ignorar, Some(false));
        assert_eq!(adentro.avisar, Some((true, 2)));
        // Sin posición del puntero, no cambia nada
        assert_eq!(evaluar(&mut p, None, true), Paso::default());
    }

    #[test]
    fn arrastrando_toda_la_ventana_toma_los_clics() {
        let mut p = Puntero { zona: Some(ZONA), toda: true, ..Puntero::default() };
        let paso = evaluar(&mut p, Some((5000.0, 5000.0)), true);
        assert_eq!(paso.ignorar, None);
        assert!(p.dentro);
    }

    #[test]
    fn flotando_escondida_o_en_la_tira_la_ventana_vuelve_a_tomar_los_clics() {
        let mut p = Puntero { zona: Some(ZONA), ..Puntero::default() };
        evaluar(&mut p, Some((10.0, 10.0)), true);
        assert!(p.ignorando);
        let paso = evaluar(&mut p, Some((10.0, 10.0)), false);
        assert_eq!(paso.ignorar, Some(false));
        assert_eq!(paso.avisar, None);
        assert!(!p.ignorando);
        // Ya soltada, no se repite
        assert_eq!(evaluar(&mut p, Some((10.0, 10.0)), false), Paso::default());
    }

    #[test]
    fn la_zona_se_guarda_en_px_logicos_validos() {
        assert_eq!(zona_valida(10.0, 20.0, 30.0, 40.0), Some(Zona { x: 10.0, y: 20.0, ancho: 30.0, alto: 40.0 }));
        assert_eq!(zona_valida(f64::NAN, 0.0, 10.0, 10.0), None);
        assert_eq!(zona_valida(0.0, 0.0, -1.0, 10.0), None);
        assert_eq!(zona_valida(0.0, 0.0, 10.0, 1e9), None);
    }

    #[test]
    fn flotando_se_sigue_recordando_solo_la_posicion() {
        // El tamaño lo decide el contenido; la posición la guarda window-state, como antes de la muesca
        assert_eq!(banderas_estado().bits(), StateFlags::POSITION.bits());
    }

    #[test]
    fn con_un_solo_monitor_los_cuatro_bordes_acoplan() {
        assert_eq!(bordes_libres(PRINCIPAL, &[]), [true, true, true, true]);
    }

    #[test]
    fn el_borde_que_toca_otro_monitor_no_acopla() {
        // Otro monitor a la derecha, a la misma altura
        assert_eq!(bordes_libres(PRINCIPAL, &[(1920, 0, 2560, 1440)]), [true, false, true, true]);
        // Otro arriba, corrido pero tocando parte del borde
        assert_eq!(bordes_libres(PRINCIPAL, &[(500, -1080, 1920, 1080)]), [false, true, true, true]);
        // A la izquierda y abajo
        assert_eq!(bordes_libres(PRINCIPAL, &[(-1280, 100, 1280, 1024), (0, 1080, 1920, 1080)]), [true, true, false, false]);
        // Solo se toca en una esquina: los bordes siguen libres
        assert_eq!(bordes_libres(PRINCIPAL, &[(1920, 1080, 800, 600)]), [true, true, true, true]);
        // Un monitor separado no toca nada
        assert_eq!(bordes_libres(PRINCIPAL, &[(2000, 0, 800, 600)]), [true, true, true, true]);
        // El propio monitor en la lista no cuenta
        assert_eq!(bordes_libres(PRINCIPAL, &[PRINCIPAL]), [true, true, true, true]);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Primero, como pide el plugin: una sola Oficina por máquina; abrir otra muestra la que hay
        .plugin(tauri_plugin_single_instance::init(|app, _argumentos, _carpeta| al_segundo_arranque(app)))
        .plugin(tauri_plugin_notification::init())
        // Registrar el plugin no prende nada: el arranque con Windows solo cambia desde el menú
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(banderas_estado()).build())
        .manage(Estado {
            tamano_previo: Mutex::new(None),
            mini: Mutex::new(false),
            login: Mutex::new(None),
            menu: Mutex::new(None),
            acople: Mutex::new(None),
            puntero: Mutex::new(Puntero::default()),
            sondeo: Mutex::new(None),
            apagar: AtomicBool::new(false),
            hwnd: AtomicIsize::new(0),
        })
        .setup(|app| {
            let handle = app.handle().clone();
            // El acople guardado, antes del menú (sus marcas) y de que la ventana lo pida
            let acople = ruta_preferencias(&handle).and_then(|r| preferencias::leer_acople(&r));
            *handle.state::<Estado>().acople.lock().unwrap() = acople;
            crear_bandeja(&handle)?;
            if acople.is_some() {
                // La ventana ya está en la última posición guardada (window-state): la muesca vuelve
                // en ese monitor. El frontend la lleva al borde.
                if let Some(v) = ventana(&handle) {
                    let _ = aplicar_acople_ventana(&v, true, true);
                }
            }
            // El sondeo del puntero (9.6): un solo hilo para toda la vida de la app
            #[cfg(windows)]
            if let Some(v) = ventana(&handle) {
                if let Ok(h) = v.hwnd() {
                    handle.state::<Estado>().hwnd.store(h.0 as isize, Ordering::Relaxed);
                }
            }
            let para_sondeo = handle.clone();
            let hilo = std::thread::Builder::new().name(String::from("oficina-puntero")).spawn(move || sondear_puntero(para_sondeo))?;
            *handle.state::<Estado>().sondeo.lock().unwrap() = Some(hilo.thread().clone());
            // Clic en la notificación: mostrar la ventana
            let al_clic = handle.clone();
            let _ = handle.notification().on_action(move |_| mostrar(&al_clic));
            Ok(())
        })
        .on_window_event(|v, evento| {
            // Alt+F4 o el cierre del sistema esconden en la bandeja; "Salir" del menú cierra de verdad
            match evento {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = v.hide();
                    despertar(&v.app_handle().state::<Estado>());
                }
                // Otro monitor con otra escala: la zona se sigue pasando bien a px físicos
                tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                    v.app_handle().state::<Estado>().puntero.lock().unwrap().escala = *scale_factor;
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            leer_sesiones,
            leer_equipo,
            fijar_arriba,
            estado_menu,
            geometria,
            ajustar_ventana,
            mover_ventana,
            guardar_acople,
            cambiar_tamano,
            modo_mini,
            esconder,
            zona_interactiva,
            poner_bandeja,
            avisar,
            responder,
            estado_respuesta,
            borrar_respuesta,
            registrar,
            revisar_primeros_pasos,
            menu_primeros_pasos,
            correr_paso,
            cancelar_paso,
            abrir_enlace
        ])
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar el widget de la oficina")
        .run(|_app, evento| {
            // Cualquier salida de la aplicación, no solo "Salir" de la bandeja
            if let tauri::RunEvent::Exit = evento {
                apagar_paso();
            }
        });
}
