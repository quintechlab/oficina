mod adjuntos;
mod arranque;
mod atomico;
mod chat;
mod chat_local;
mod claves;
mod diagnostico;
mod engram;
mod equipo;
mod habitos;
mod historial;
mod ids;
mod preferencias;
mod proyectos;
mod mcp_avis;
mod modelo;
mod mod_auto;
mod transcripcion;
mod ordenes;
mod primeros_pasos;
mod respuestas;
mod sesiones;
mod tareas;
mod terminar;

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use tauri::image::Image;
use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, Wry};
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt;

const VENTANA: &str = "principal";
const BANDEJA: &str = "bandeja";
struct Estado {
    /// En la tira mini (lo avisa la ventana con `modo_mini`): abrir Avis otra vez la expande.
    mini: Mutex<bool>,
    login: Mutex<Option<String>>,
    menu: Mutex<Option<MenuBandeja>>,
    /// Borde donde está acoplada la muesca; `None` flota (7.5).
    acople: Mutex<Option<preferencias::Acople>>,
    /// "Siempre arriba" (configuracion-ux.md 9.1): vale para cuando flota; acoplada va siempre arriba.
    arriba: AtomicBool,
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

// ------------------------------------------------------------------ zona interactiva (9.6 y 9.7)
//
// Ventana única: acoplada, flotando y en la tira, la ventana es el área de trabajo entera del monitor
// y transparente. La muesca, la píldora, el tablero y la tira son elementos adentro: pasar de uno a
// otro es una animación, sin redimensionar (que en WebView2 deja la ventana transparente sin pintar
// ~0,4 s). Lo que no es la zona interactiva deja pasar los clics: un hilo mira el puntero cada 20 ms
// y prende o apaga `set_ignore_cursor_events` solo cuando cruza el borde de la zona.

/// Cada cuánto se mira el puntero mientras la ventana está a la vista.
const PASO_SONDEO: Duration = Duration::from_millis(20);
/// Sin sondeo (escondida en la bandeja o minimizada), el hilo duerme hasta que lo despierten o pase esto.
const ESPERA_QUIETO: Duration = Duration::from_millis(250);
/// Evento a la ventana cuando el puntero entra o sale de la zona: `{ dentro, n }`.
const EVENTO_ZONA: &str = "oficina://puntero-zona";
/// Evento con la posición global del puntero, `{ x, y }` en px lógicos de pantalla, para la mirada
/// del Avi que está a la vista: el de la marca con el panel abierto (docs/diseno/marca-avi-ux.md 6) o
/// el que asoma en la muesca cerrada (docs/diseno/muesca-avi-ux.md 9). Solo acoplada y si la ventana
/// lo pide (`mirada`).
const EVENTO_CURSOR: &str = "oficina://cursor";
/// Como mucho un aviso de la posición cada tanto.
const PASO_CURSOR: Duration = Duration::from_millis(50);

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

/// ¿Corre el sondeo? En todas las formas (acoplada, flotando o en la tira) mientras la ventana se ve:
/// siempre es el área entera y fuera de la zona los clics tienen que pasar. Escondida o minimizada,
/// no hay nada que mirar.
fn debe_sondear(visible: bool) -> bool {
    visible
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
    /// El Avi que está a la vista quiere el puntero (lo manda la ventana con la zona: la marca con el
    /// panel abierto o el Avi de la muesca cerrada, si se puede mover y su pose sigue al puntero): solo
    /// entonces se avisa la posición del puntero.
    mirada: bool,
    /// Última posición avisada (px físicos) y cuándo, para no repetirla ni pasar de un aviso cada 50 ms.
    cursor_enviado: Option<(f64, f64)>,
    cursor_cuando: Option<Duration>,
}

impl Default for Puntero {
    fn default() -> Self {
        Puntero {
            zona: None, toda: false, escala: 1.0, dentro: true, informado: false, ignorando: false, cambios: 0,
            mirada: false, cursor_enviado: None, cursor_cuando: None,
        }
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
    p.mirada = false;
}

/// La posición del puntero que hay que avisar para la mirada del Avi a la vista, en px lógicos de
/// pantalla, o nada: solo con el sondeo corriendo (la ventana a la vista) y
/// `mirada`, solo si cambió desde el último aviso y a lo sumo uno cada `PASO_CURSOR`. Compara con lo
/// último avisado (no con lo último visto): si se movió dentro de esos 50 ms, la posición final sale
/// igual en la vuelta siguiente. Sin `mirada` olvida lo avisado, así al volver avisa otra vez.
fn cursor_para_mirada(p: &mut Puntero, cursor: Option<(f64, f64)>, sondea: bool, ahora: Duration) -> Option<(f64, f64)> {
    if !sondea || !p.mirada {
        p.cursor_enviado = None;
        return None;
    }
    let c = cursor?;
    if p.cursor_enviado == Some(c) {
        return None;
    }
    if p.cursor_cuando.is_some_and(|t| ahora.saturating_sub(t) < PASO_CURSOR) {
        return None;
    }
    p.cursor_enviado = Some(c);
    p.cursor_cuando = Some(ahora);
    Some((c.0 / p.escala, c.1 / p.escala))
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
fn mirar_puntero(app: &AppHandle, estado: &Estado, ahora: Duration) -> bool {
    // Un lock envenenado no puede matar el hilo: si muere con los clics pasando, la ventana no responde más
    let sondea = debe_sondear(a_la_vista(app, estado));
    let cursor = if sondea { cursor_fisico(app) } else { None };
    let (paso, mirada) = {
        let mut p = estado.puntero.lock().unwrap_or_else(PoisonError::into_inner);
        (evaluar(&mut p, cursor, sondea), cursor_para_mirada(&mut p, cursor, sondea, ahora))
    };
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
    if let Some((x, y)) = mirada {
        let _ = app.emit(EVENTO_CURSOR, serde_json::json!({ "x": x, "y": y }));
    }
    sondea
}

/// El único hilo del sondeo (uno solo, para siempre): cada 20 ms con la ventana a la vista, o dormido
/// hasta que lo despierten (`despertar`) o pasen 250 ms. Termina con "Salir".
fn sondear_puntero(app: AppHandle) {
    let estado = app.state::<Estado>();
    let inicio = std::time::Instant::now();
    while !estado.apagar.load(Ordering::Relaxed) {
        let sondea = mirar_puntero(&app, &estado, inicio.elapsed());
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
    pausa: CheckMenuItem<Wry>,
}

/// Orden del menú de la bandeja (configuracion-ux.md 4.5): "Configuración…" debajo de "Mostrar
/// Avis", "Pausar animaciones" (se necesita rápido y sin abrir el panel) y "Salir". Lo demás vive en
/// la configuración: tamaño, acople, siempre arriba, avisar y arrancar con Windows (Panel), borrar el
/// modelo de IA (Modelos) y primeros pasos (Instalación).
const ORDEN_BANDEJA: [&str; 5] = ["mostrar", "configuracion", "pausa", "separador", "salir"];
/// Evento a la ventana: abrir la configuración (`{ abrir: true, tab? }`, configuracion-ux.md 9.3).
const EVENTO_CONFIGURACION: &str = "oficina://configuracion";

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
    // Acoplada, "Mostrar Avis" abre el panel (7.3); flotando, la ventana lo ignora
    let _ = app.emit("oficina://abrir", ());
}

/// "Configuración…" de la bandeja (configuracion-ux.md 4.1): muestra el panel como "Mostrar Avis" y
/// la ventana abre la configuración (acoplada, también el panel) con el foco en su título.
fn abrir_configuracion(app: &AppHandle) {
    if let Some(v) = ventana(app) {
        let _ = v.unminimize();
        let _ = v.show();
        let _ = v.set_focus();
    }
    despertar(&app.state::<Estado>());
    let _ = app.emit(EVENTO_CONFIGURACION, serde_json::json!({ "abrir": true }));
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

/// Acoplada, la ventana va siempre arriba y fuera de la barra de tareas. Flotando (tablero o tira),
/// en la barra de tareas y "Siempre arriba" según la marca del menú. El tamaño es siempre el del área.
fn aplicar_acople_ventana(v: &WebviewWindow, acoplada: bool, arriba_marcado: bool) -> tauri::Result<()> {
    v.set_skip_taskbar(acoplada)?;
    v.set_always_on_top(acoplada || arriba_marcado)
}

fn arriba_marcado(estado: &Estado) -> bool {
    estado.arriba.load(Ordering::Relaxed)
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

/// El monitor (índice en `monitores`, rectángulos en px físicos) que contiene `punto`: el borde
/// izquierdo y el de arriba cuentan, el derecho y el de abajo son del vecino. Ninguno si ya no está.
fn monitor_que_contiene(punto: (f64, f64), monitores: &[Rect]) -> Option<usize> {
    monitores.iter().position(|&(x, y, w, h)| {
        let (x, y, w, h) = (x as f64, y as f64, w as f64, h as f64);
        punto.0 >= x && punto.0 < x + w && punto.1 >= y && punto.1 < y + h
    })
}

/// El centro de un rectángulo en px físicos: el punto que se guarda para volver a ese monitor.
fn centro_de(r: Rect) -> (f64, f64) {
    (r.0 as f64 + r.2 as f64 / 2.0, r.1 as f64 + r.3 as f64 / 2.0)
}

/// El área de trabajo de un monitor, en px físicos.
fn area_fisica(m: &tauri::Monitor) -> Rect {
    let a = m.work_area();
    (a.position.x, a.position.y, a.size.width, a.size.height)
}

/// Guarda el monitor donde está la ventana (el centro de su área), para volver a él al arrancar.
fn guardar_monitor_actual(app: &AppHandle) -> Result<(), String> {
    let v = ventana(app).ok_or("sin ventana")?;
    let m = v.current_monitor().map_err(|e| e.to_string())?.ok_or("sin monitor")?;
    let ruta = ruta_preferencias(app).ok_or("no se conoce la carpeta de configuración")?;
    preferencias::guardar_monitor(&ruta, centro_de(area_fisica(&m)))
}

/// Al arrancar (9.7): la ventana ocupa el área de trabajo del monitor de la última vez (el que
/// contiene el punto guardado) o, si ya no está, la del principal. Se pone en px físicos, así no
/// depende de la escala de cada monitor; después la ventana ubica adentro la muesca o el tablero.
fn colocar_al_arrancar(app: &AppHandle, v: &WebviewWindow) -> Result<(), String> {
    let texto = |e: tauri::Error| e.to_string();
    let monitores = v.available_monitors().map_err(texto)?;
    let guardado = ruta_preferencias(app).and_then(|r| preferencias::leer_monitor(&r));
    let rects: Vec<Rect> = monitores.iter().map(rect_de).collect();
    let elegido = guardado.and_then(|p| monitor_que_contiene(p, &rects)).map(|i| monitores[i].clone());
    let monitor = match elegido {
        Some(m) => Some(m),
        None => v.primary_monitor().map_err(texto)?,
    };
    let m = monitor.ok_or("sin monitor")?;
    let (x, y, w, h) = area_fisica(&m);
    colocar_fisico(v, x, y, w as i32, h as i32)
}

fn ruta_preferencias(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|c| c.join("preferencias.json"))
}

/// Segunda vez que se abre Avis: no hay otra ventana, se muestra la que ya está.
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
    // Acoplada, se abre el panel como con "Mostrar Avis"; flotando, la ventana lo ignora
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
    modelo::IA.apagar();
    // El hilo del sondeo termina en su próxima vuelta
    let estado = app.state::<Estado>();
    estado.apagar.store(true, Ordering::Relaxed);
    despertar(&estado);
    // La posición flotante y el monitor ya se guardaron al soltar (preferencias.json)
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

/// Qué falta en la máquina para Avis (bienvenida-ux.md 3.3), solo con comandos de lectura.
/// Se llama al arrancar, al abrir el asistente y con "Volver a buscar"; nunca en el ciclo de 1,5 s.
#[tauri::command]
async fn revisar_primeros_pasos() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(primeros_pasos::revisar).await.map_err(|e| e.to_string())
}

/// La tarjeta "Mod de Claude Code" de la configuración (configuracion-ux.md 9.2 y 7.3):
/// `{ claude, mod, revisado, fallo }`. Solo comandos de lectura (`revisar_claude`) y la última
/// revisión guardada; se llama al abrir la configuración y cuando cambia el mod, nunca en el ciclo.
#[tauri::command]
async fn estado_mod(app: AppHandle) -> Result<serde_json::Value, String> {
    let guardada = ruta_preferencias(&app).as_deref().and_then(preferencias::leer_revision_mod);
    tauri::async_runtime::spawn_blocking(move || mod_auto::estado_para_ventana(&primeros_pasos::revisar_claude(&primeros_pasos::lugares()), guardada))
        .await
        .map_err(|e| e.to_string())
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

/// El aviso del mod automático (#17) que el tablero muestra una vez: `{ tipo: "instalo" | "actualizo",
/// version, desde? }`, o nada. Tomarlo lo vacía.
#[tauri::command]
fn tomar_aviso_mod() -> Option<serde_json::Value> {
    mod_auto::tomar_aviso()
}

/// Abre en el navegador una de las direcciones conocidas del asistente (nunca una que mande la ventana).
#[tauri::command]
fn abrir_enlace(cual: String) -> Result<(), String> {
    let url = primeros_pasos::enlace(&cual).ok_or("enlace desconocido")?;
    primeros_pasos::abrir_en_navegador(url)
}

// ------------------------------------------------------------------ el modelo de esta PC (#11; en la charla, chat-avis-ux.md 3.6)

/// `{ modelo, bajado, total, motor, primeraVez, aceleracion }`: solo lee disco y procesos propios,
/// nunca la red. Al abrir la hoja de la charla; nunca en el ciclo de 1,5 s.
#[tauri::command]
async fn estado_modelo() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(|| modelo::IA.estado()).await.map_err(|e| e.to_string())?
}

/// Solo con el clic en "Descargar": la única salida a la red, con URLs fijas. Lo que pasa llega como
/// `oficina://modelo` (`progreso`, `bajado`, `fallo`).
#[tauri::command]
fn descargar_modelo(app: AppHandle) -> Result<(), String> {
    modelo::IA.descargar(move |v| {
        let _ = app.emit(modelo::EVENTO, v);
    })
}

/// "Borrar" del modelo local en la configuración (configuracion-ux.md 7.2), solo con el segundo clic
/// de "¿Borrar …? Sí" (la confirmación es de la ventana, D5: sin cuadro nativo). Corta la descarga,
/// apaga el motor y borra `%LOCALAPPDATA%\avis-ia` entero; avisa el estado nuevo (`oficina://modelo`)
/// para que la hoja del chat y la tarjeta vuelvan a "falta". Devuelve los bytes liberados.
#[tauri::command]
async fn borrar_modelo(app: AppHandle) -> Result<u64, String> {
    let bytes = tauri::async_runtime::spawn_blocking(|| modelo::IA.borrar()).await.map_err(|e| e.to_string())?;
    match &bytes {
        Ok(b) => registrar(format!("modelo: modelo de IA borrado desde la configuración ({b} bytes)")),
        Err(e) => registrar(format!("modelo: no se pudo borrar el modelo: {e}")),
    }
    if let Ok(estado) = modelo::IA.estado() {
        let _ = app.emit(modelo::EVENTO, modelo::evento_estado(estado));
    }
    bytes
}

/// Las claves de API (configuracion-ux.md 9.2 y 9.4): por proveedor, si hay una guardada en
/// Credenciales de Windows y sus últimos 4 caracteres. Nunca la clave.
#[tauri::command]
async fn claves_estado() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(claves::estado).await.map_err(|e| e.to_string())
}

/// Guarda una clave de API en Credenciales de Windows (`Avis/api/<proveedor>`), con el clic en
/// "Guardar". La clave llega una sola vez y lo que vuelve es `{ guardada, final }`.
#[tauri::command]
async fn guardar_clave(proveedor: String, clave: String) -> Result<serde_json::Value, String> {
    let secreto = claves::Secreto::from(clave);
    tauri::async_runtime::spawn_blocking(move || claves::guardar(&proveedor, secreto)).await.map_err(|e| e.to_string())?
}

/// Borra la clave de un proveedor (el segundo clic de "¿Borrar la clave? Sí"). Si no había, no falla.
#[tauri::command]
async fn borrar_clave(proveedor: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || claves::borrar(&proveedor)).await.map_err(|e| e.to_string())?
}

/// "Probar" (solo con el clic): un pedido de solo lectura al proveedor con la clave guardada, 10 s
/// como mucho. `{ resultado: valida | rechazada | sin-red | otro, estado? }`.
#[tauri::command]
async fn probar_clave(proveedor: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || claves::probar(&proveedor)).await.map_err(|e| e.to_string())?
}

/// Solo con un clic: corta la descarga (queda para seguir) o el arranque del motor.
#[tauri::command]
fn cancelar_modelo(app: AppHandle) {
    modelo::IA.cancelar(&|v| {
        let _ = app.emit(modelo::EVENTO, v);
    });
}

// ------------------------------------------------------------------ charla con la mascota (#22, chat-avis-ux.md 7)

fn el_chat() -> Result<&'static chat::Chat, String> {
    chat::CHAT.get().ok_or_else(|| String::from("el chat no arrancó"))
}

/// `local` de `chat_abrir` (3.3): el estado del modelo de esta PC, sin red.
fn estado_local() -> &'static str {
    match modelo::IA.estado().ok().as_ref().and_then(|e| e["modelo"].as_str()) {
        Some("listo") => "instalado",
        Some("bajando") => "bajando",
        Some("roto") => "roto",
        _ => "falta",
    }
}

/// Al abrir la hoja o cambiar de conversación: con Claude Code, precalienta el proceso sin mandarle
/// nada (D19). `{ proceso, sesion, motivo?, engram, local }`. `sesionClaude`: la de una charla que
/// ya tuvo mensajes (se retoma con `--resume`). `modelo` (#35): `fable`, `opus`, `sonnet`, `haiku` o
/// `null` ("Por defecto", sin `--model`); cambiarlo sigue la misma conversación. `usuario` (#37): el
/// nombre del usuario, que toma el próximo proceso y el próximo turno local.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
async fn chat_abrir(conversacion: String, motor: String, carpeta: Option<String>, mascota: Option<String>, usuario: Option<String>, sesion_claude: Option<String>, modelo: Option<String>, proyecto: Option<String>) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let chat = el_chat()?;
        chat.poner_usuario(usuario.as_deref().unwrap_or(""));
        // #44 (proyectos-ux.md 11.4): con `proyecto` (un id), `carpeta` se ignora: Rust lee la del proyecto
        let mut r = chat.abrir_proyecto(&conversacion, &motor, carpeta.map(std::path::PathBuf::from), mascota.as_deref().unwrap_or(""), sesion_claude, modelo, proyecto.as_deref())?;
        // Si hay Engram (9.2): /health con 1 s, como mucho cada 5 min
        r["engram"] = serde_json::json!(if engram::ENGRAM.get().is_some_and(engram::Engram::hay) { "si" } else { "no" });
        r["local"] = serde_json::json!(estado_local());
        Ok(r)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Solo con Enter o Enviar: manda un turno. Lo que pasa llega como `oficina://chat`. `adjuntos`:
/// las rutas de los archivos (10); los bytes los lee Rust, nunca la ventana. `historia`: los mensajes
/// anteriores de la charla (`[{ rol, texto }]`), que solo usa el motor local (8).
#[tauri::command]
async fn chat_enviar(conversacion: String, turno: u64, texto: String, adjuntos: Option<Vec<String>>, datos: Option<serde_json::Value>, historia: Option<serde_json::Value>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        el_chat()?.enviar_con(&conversacion, turno, &texto, &adjuntos.unwrap_or_default(), &datos.unwrap_or_default(), &historia.unwrap_or_default())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Un archivo soltado sobre la hoja o elegido con el clip (10): `{ nombre, tipo, bytes, paginas }` o
/// `{ error: "adjunto", nombre }`. Solo lee el archivo para revisarlo (el tipo, el tamaño, las páginas).
#[tauri::command]
async fn chat_adjunto(ruta: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || adjuntos::info(std::path::Path::new(&ruta)))
        .await
        .map_err(|e| e.to_string())
}

/// El clip y "Resumime un PDF" (10, D10): el selector nativo de archivos con los tipos que se leen,
/// solo con ese clic. Las rutas elegidas, o ninguna si se canceló.
#[tauri::command]
async fn elegir_adjuntos(app: AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialogo = app
            .dialog()
            .file()
            .set_title("Elegí qué archivo leer")
            .add_filter("PDF, imágenes, texto o código", &adjuntos::EXTENSIONES);
        if let Some(v) = ventana(&app) {
            dialogo = dialogo.set_parent(&v);
        }
        dialogo
            .blocking_pick_files()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|r| r.into_path().ok())
            .map(|r| r.to_string_lossy().into_owned())
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

/// Frenar (o Esc): la interrupción del turno en curso (7.6).
#[tauri::command]
fn chat_frenar(conversacion: String, turno: u64) -> Result<(), String> {
    el_chat()?.frenar(&conversacion, turno);
    Ok(())
}

/// Cierra stdin del proceso de la conversación: termina su turno y sale.
#[tauri::command]
fn chat_cerrar(conversacion: String) -> Result<(), String> {
    el_chat()?.cerrar(&conversacion);
    Ok(())
}

/// Una copia a Engram por vez, con lo último del archivo: un guardado viejo nunca pisa a uno nuevo, y
/// borrar una charla espera a que termine la copia que estaba en curso (9.2).
static ENGRAM_COLA: Mutex<()> = Mutex::new(());

/// Copia la charla a Engram (en cada `fin`, 9.2), en otro hilo: la ventana no espera. El id de la
/// observación queda en el archivo (`engramId`).
fn copiar_a_engram(carpeta: std::path::PathBuf, id: String, mascota: String) {
    let _ = std::thread::Builder::new().name(String::from("avis-engram")).spawn(move || {
        let Some(e) = engram::ENGRAM.get() else { return };
        let _cola = ENGRAM_COLA.lock().unwrap_or_else(PoisonError::into_inner);
        // Lo último del archivo, no lo de este pedido; si ya se borró, nada
        let Ok(doc) = historial::leer(&carpeta, &id) else { return };
        if let Some(n) = e.guardar(&doc, &mascota) {
            if doc["engramId"].as_u64() != Some(n) {
                if let Err(err) = historial::poner_engram(&carpeta, &id, n) {
                    registrar(format!("chat: no se anotó el id de Engram: {err}"));
                }
            }
        }
    });
}

/// Guarda la charla en la PC (9.1): al mandar, en cada final y cada 2 s mientras llega el texto. Con
/// `engram` (el `fin` de un turno), también la copia a Engram si está.
#[tauri::command]
async fn chat_guardar(conversacion: serde_json::Value, mascota: Option<String>, engram: Option<bool>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let carpeta = el_chat()?.carpeta();
        let guardado = historial::guardar(&carpeta, &conversacion)?;
        if engram == Some(true) {
            let id = guardado["id"].as_str().unwrap_or_default().to_string();
            copiar_a_engram(carpeta, id, chat::nombre_mascota(mascota.as_deref().unwrap_or("")));
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// El cajón "Charlas" (9.1): las 100 más recientes, sin los mensajes y con `texto` para buscar.
#[tauri::command]
async fn chat_historial() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || Ok(serde_json::json!(historial::listar(&el_chat()?.carpeta()))))
        .await
        .map_err(|e| e.to_string())?
}

/// Una charla completa, para retomarla.
#[tauri::command]
async fn chat_leer(id: String) -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || historial::leer(&el_chat()?.carpeta(), &id))
        .await
        .map_err(|e| e.to_string())?
}

/// Borra la charla de Avis: el archivo y su copia en Engram (solo la de `avis`). La transcripción de
/// Claude Code no se toca (D29).
#[tauri::command]
async fn chat_borrar(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let carpeta = el_chat()?.carpeta();
        let engram_id = {
            let _cola = ENGRAM_COLA.lock().unwrap_or_else(PoisonError::into_inner);
            historial::borrar(&carpeta, &id)?
        };
        borrar_de_engram(engram_id.into_iter().collect());
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Borra en otro hilo las copias de Engram de las charlas borradas (solo las de `avis`).
fn borrar_de_engram(ids: Vec<u64>) {
    if ids.is_empty() {
        return;
    }
    let _ = std::thread::Builder::new().name(String::from("avis-engram")).spawn(move || {
        let _cola = ENGRAM_COLA.lock().unwrap_or_else(PoisonError::into_inner);
        for n in ids {
            if !engram::ENGRAM.get().is_some_and(|e| e.borrar(n)) {
                registrar(format!("chat: la copia {n} de Engram no se pudo borrar"));
            }
        }
    });
}

/// Configuración, pestaña Datos (#23, E5): `{ charlas, bytes }` de todo el historial (sin tope).
#[tauri::command]
async fn chat_contar() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (charlas, bytes) = historial::contar(&el_chat()?.carpeta());
        Ok(serde_json::json!({ "charlas": charlas, "bytes": bytes }))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// "Borrar todo" de la pestaña Datos (#23, E5), solo con el segundo clic: cada charla y su copia en
/// Engram (solo la de `avis`). Devuelve `{ borradas, fallidas }`.
#[tauri::command]
async fn chat_borrar_todo() -> Result<serde_json::Value, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let carpeta = el_chat()?.carpeta();
        let r = {
            let _cola = ENGRAM_COLA.lock().unwrap_or_else(PoisonError::into_inner);
            historial::borrar_todo(&carpeta)
        };
        registrar(format!("chat: borrar todo: {} borradas, {} sin borrar", r.borradas, r.fallidas));
        borrar_de_engram(r.engram);
        Ok(serde_json::json!({ "borradas": r.borradas, "fallidas": r.fallidas }))
    })
    .await
    .map_err(|e| e.to_string())?
}

// ------------------------------------------------------------------ tareas (#39)

/// `<config>/tareas`: un archivo por lista (`tareas.rs`).
fn carpeta_tareas(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_config_dir().map(|c| c.join("tareas")).map_err(|e| e.to_string())
}

/// Todas las listas, en orden, y los archivos rotos (S6, tareas-ux.md 11.3): `{ listas, rotas: [{ archivo, motivo }] }`.
#[tauri::command]
async fn tareas_leer(app: AppHandle) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_tareas(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        // Una carpeta que existe y no se puede leer es "Carpeta ilegible" (7.5), no el primer uso
        if let Err(e) = std::fs::read_dir(&carpeta) {
            if e.kind() != std::io::ErrorKind::NotFound {
                registrar(format!("tareas: no se pudo leer la carpeta: {e}"));
                return Err(e.to_string());
            }
        }
        let l = tareas::listar(&carpeta);
        // #43 (11.5): la huella de cada lista, para guardar sin pisar un cambio de la charla
        Ok(serde_json::json!({ "listas": l.listas, "rotas": l.rotas, "huellas": l.huellas }))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Guarda una lista entera (formato v1; lo que no sirve se rechaza sin tocar el archivo):
/// `{ ok: true, lista, huella }` con lo guardado, o `{ ok: false, error }` (lo anota la ventana, 7.4: una sola línea en widget.log).
/// `huella` (#43, 11.5): la de lo que leyó la ventana; si el archivo cambió desde entonces (la charla
/// escribió), no guarda y el error es `"cambio"`. Sin `huella`, guarda como siempre.
#[tauri::command]
async fn tareas_guardar(app: AppHandle, lista: serde_json::Value, huella: Option<String>) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_tareas(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || tareas::guardar_si(&carpeta, &lista, huella.as_deref())).await.map_err(|e| e.to_string())?;
    Ok(match r {
        Ok((lista, huella)) => serde_json::json!({ "ok": true, "lista": lista, "huella": huella }),
        Err(error) => serde_json::json!({ "ok": false, "error": error }),
    })
}

/// «Deshacer» de un recibo de la charla (#43, chat-herramientas-ux.md 11.7), solo con el clic: vuelve
/// el cambio a su `antes` si la tarea (o el hábito, C3) sigue como la dejó la charla. `{ estado:
/// "deshecho" | "cambio-despues" | "error", motivo? }`. No le manda nada a la mascota: el próximo
/// mensaje lleva `<avis-deshecho>`. Un cambio con otra forma es un error del comando.
#[tauri::command]
async fn chat_deshacer(app: AppHandle, conversacion: String, cambio: serde_json::Value) -> Result<serde_json::Value, String> {
    if !chat::conversacion_valida(&conversacion) {
        return Err(String::from("id de conversación inválido"));
    }
    let de_habitos = mcp_avis::es_de_habitos(&cambio);
    let carpeta = if de_habitos { carpeta_habitos(&app)? } else { carpeta_tareas(&app)? };
    let para_avisar = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let ahora = chrono::Utc::now().timestamp_millis();
        let (d, evento) = if de_habitos {
            (mcp_avis::deshacer_habito(&carpeta, &cambio, ahora)?, mcp_avis::EVENTO_HABITOS)
        } else {
            (mcp_avis::deshacer(&carpeta, &cambio, ahora)?, mcp_avis::EVENTO_TAREAS)
        };
        for t in &d.tocadas {
            let _ = para_avisar.emit(evento, t);
        }
        if d.estado == "deshecho" && !d.tocadas.is_empty() {
            el_chat()?.anotar_deshecho(&conversacion, &mcp_avis::linea_deshecho(&cambio));
        }
        if let Some(m) = &d.motivo {
            registrar(format!("chat: no se pudo deshacer: {m}"));
        }
        Ok(serde_json::json!({ "estado": d.estado, "motivo": d.motivo }))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// «Reintentar» de un recibo de error (#43, 11.9), solo con el clic: repite esa operación con lo que
/// pidió el modelo, sin turno. Devuelve el cambio nuevo, que reemplaza a la fila de error.
#[tauri::command]
async fn chat_reintentar(app: AppHandle, conversacion: String, cambio: serde_json::Value) -> Result<serde_json::Value, String> {
    if !chat::conversacion_valida(&conversacion) {
        return Err(String::from("id de conversación inválido"));
    }
    let de_habitos = mcp_avis::es_de_habitos(&cambio);
    let carpeta = if de_habitos { carpeta_habitos(&app)? } else { carpeta_tareas(&app)? };
    let para_avisar = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let ahora = chrono::Utc::now().timestamp_millis();
        let ((nuevo, tocadas), evento) = if de_habitos {
            (mcp_avis::reintentar_habito(&carpeta, &cambio, ahora)?, mcp_avis::EVENTO_HABITOS)
        } else {
            (mcp_avis::reintentar(&carpeta, &cambio, ahora)?, mcp_avis::EVENTO_TAREAS)
        };
        for t in &tocadas {
            let _ = para_avisar.emit(evento, t);
        }
        Ok(nuevo)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Borra una lista con sus tareas (solo con el segundo clic de "¿Borrar? Sí"); nunca un archivo roto. `{ ok, error? }`.
#[tauri::command]
async fn tareas_borrar_lista(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_tareas(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || tareas::borrar(&carpeta, &id)).await.map_err(|e| e.to_string())?;
    Ok(match r {
        Ok(()) => serde_json::json!({ "ok": true }),
        Err(error) => {
            registrar(format!("tareas: no se pudo borrar: {error}"));
            serde_json::json!({ "ok": false, "error": error })
        }
    })
}

/// Abre `<config>/tareas/` en el Explorador (la ruta es siempre la de Avis, nunca una de la ventana).
#[tauri::command]
fn tareas_abrir_carpeta(app: AppHandle) -> Result<(), String> {
    let carpeta = carpeta_tareas(&app)?;
    std::fs::create_dir_all(&carpeta).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer").arg(&carpeta).spawn().map(|_| ()).map_err(|e| e.to_string())
}

// ------------------------------------------------------------------ hábitos (#41)

/// `<config>/habitos`: un archivo por hábito (`habitos.rs`).
fn carpeta_habitos(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_config_dir().map(|c| c.join("habitos")).map_err(|e| e.to_string())
}

/// Todos los hábitos, en orden, y los archivos rotos (habitos-ux.md 11.5): `{ habitos, rotas: [{ archivo, motivo }] }`.
/// Una carpeta que existe y no se puede leer es un error, no "sin hábitos".
#[tauri::command]
async fn habitos_leer(app: AppHandle) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_habitos(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(e) = std::fs::read_dir(&carpeta) {
            if e.kind() != std::io::ErrorKind::NotFound {
                registrar(format!("hábitos: no se pudo leer la carpeta: {e}"));
                return Err(String::from("No se pudo abrir la carpeta de hábitos."));
            }
        }
        let l = habitos::listar(&carpeta);
        // #43 C3 (11.5): la huella de cada hábito, para guardar sin pisar una marca de la charla
        Ok(serde_json::json!({ "habitos": l.habitos, "rotas": l.rotas, "huellas": l.huellas }))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Guarda un hábito entero (formato v1; lo que no sirve se rechaza sin tocar el archivo):
/// `{ ok: true, habito, huella }` con lo guardado, o `{ ok: false, error }` (la ventana lo anota).
/// `huella` (#43 C3, 11.5, como `tareas_guardar`): la de lo que leyó la ventana; si el archivo cambió
/// desde entonces (la charla marcó), no guarda y el error es `"cambio"`. Sin `huella`, guarda como siempre.
#[tauri::command]
async fn habitos_guardar(app: AppHandle, habito: serde_json::Value, huella: Option<String>) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_habitos(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || habitos::guardar_si(&carpeta, &habito, huella.as_deref())).await.map_err(|e| e.to_string())?;
    Ok(match r {
        Ok((habito, huella)) => serde_json::json!({ "ok": true, "habito": habito, "huella": huella }),
        Err(error) => serde_json::json!({ "ok": false, "error": error }),
    })
}

/// Borra un hábito (solo con el segundo clic de "¿Borrar? Sí"); nunca un archivo roto. `{ ok, error? }`.
#[tauri::command]
async fn habitos_borrar(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_habitos(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || habitos::borrar(&carpeta, &id)).await.map_err(|e| e.to_string())?;
    Ok(match r {
        Ok(()) => serde_json::json!({ "ok": true }),
        Err(error) => {
            registrar(format!("hábitos: no se pudo borrar: {error}"));
            serde_json::json!({ "ok": false, "error": error })
        }
    })
}

/// Abre `<config>/habitos/` en el Explorador (la ruta es siempre la de Avis).
#[tauri::command]
fn habitos_abrir_carpeta(app: AppHandle) -> Result<(), String> {
    let carpeta = carpeta_habitos(&app)?;
    std::fs::create_dir_all(&carpeta).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer").arg(&carpeta).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// La frase del resumen semanal de hábitos (habitos-ux.md 8.4 y 11.7): `{ frase }` o un error (la ventana
/// usa la plantilla). Solo con el modelo de esta PC instalado (si no, error sin prender nada: nunca se
/// descarga nada); el motor se prende como para una charla (`motor_charla`, que avisa `preparando`) y se
/// apaga solo a los 10 min. Una respuesta, 60 tokens y 45 s; nada se guarda.
#[tauri::command]
async fn habitos_frase(app: AppHandle, datos: serde_json::Value) -> Result<serde_json::Value, String> {
    let motor: chat_local::MotorLocal = std::sync::Arc::new(move || {
        let avisar = |v: serde_json::Value| {
            let _ = app.emit(modelo::EVENTO, v);
        };
        modelo::IA.motor_charla(&avisar).map(|(puerto, uso)| (puerto, Box::new(uso) as Box<dyn chat_local::UsoMotor>))
    });
    let r = tauri::async_runtime::spawn_blocking(move || habitos::frase(&datos, &|| estado_local() == "instalado", motor, habitos::TOPE_FRASE))
        .await
        .map_err(|e| e.to_string())?;
    match r {
        Ok(frase) => Ok(serde_json::json!({ "frase": frase })),
        Err(e) => {
            registrar(format!("hábitos: sin la frase del resumen: {e}"));
            Err(e)
        }
    }
}

// ------------------------------------------------------------------ proyectos (#44)

/// `<config>/proyectos`: un archivo por proyecto (`proyectos.rs`).
fn carpeta_proyectos(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_config_dir().map(|c| c.join("proyectos")).map_err(|e| e.to_string())
}

/// Lo que no se acepta como carpeta de un proyecto (proyectos-ux.md 11.2): Windows, Archivos de
/// programa y la configuración de Avis (además de la raíz de un disco y la red, en `carpeta_valida`).
fn reglas_proyectos(app: &AppHandle) -> Result<proyectos::Reglas, String> {
    app.path().app_config_dir().map(|c| proyectos::Reglas::del_sistema(&c)).map_err(|e| e.to_string())
}

/// La respuesta de un error de los comandos de proyectos: `{ error, motivo? }`. `motivo`: `repetido`
/// (el nombre) o el de la carpeta (`grande`, `red`, `no-existe`, `crear`); la ventana elige el texto de 5.2.
fn error_proyecto(error: &str, motivo: Option<&str>) -> serde_json::Value {
    let motivo = motivo.or((error == proyectos::REPETIDO).then_some(proyectos::REPETIDO));
    serde_json::json!({ "error": error, "motivo": motivo })
}

/// La carpeta que pide la ventana con un modo, nunca con una ruta (11.2, D-p10): `"elegir"` abre el
/// diálogo de Windows (bloquea: se llama desde `spawn_blocking`) y valida lo elegido; `"avis"` crea
/// `Documentos › Avis › <nombre>`. `Ok(None)`: se canceló el diálogo. `Err`: la respuesta de error.
fn carpeta_pedida(app: &AppHandle, modo: &str, nombre: &str, reglas: &proyectos::Reglas) -> Result<Option<serde_json::Value>, serde_json::Value> {
    use tauri_plugin_dialog::DialogExt;
    let falla = |m: proyectos::Motivo| {
        registrar(format!("proyectos: carpeta rechazada ({})", m.codigo()));
        error_proyecto("carpeta rechazada", Some(m.codigo()))
    };
    match modo {
        "elegir" => {
            let mut dialogo = app.dialog().file().set_title("Elegí la carpeta del proyecto");
            if let Some(v) = ventana(app) {
                dialogo = dialogo.set_parent(&v);
            }
            let Some(elegida) = dialogo.blocking_pick_folder().and_then(|r| r.into_path().ok()) else { return Ok(None) };
            let r = proyectos::carpeta_valida(&elegida, reglas).map_err(falla)?;
            Ok(Some(serde_json::json!({ "tipo": "pc", "ruta": r.to_string_lossy() })))
        }
        "avis" => {
            let documentos = app.path().document_dir().map_err(|_| falla(proyectos::Motivo::Crear))?;
            let r = proyectos::crear_carpeta_avis(&documentos, nombre, reglas).map_err(falla)?;
            Ok(Some(serde_json::json!({ "tipo": "avis", "ruta": r.to_string_lossy() })))
        }
        _ => Err(error_proyecto("modo de carpeta desconocido", None)),
    }
}

/// Todos los proyectos, en orden, con el estado de su carpeta (proyectos-ux.md 11.3): `{ proyectos,
/// rotas: [{ archivo, motivo }] }`. Solo lectura. Una carpeta que existe y no se puede leer es un error.
#[tauri::command]
async fn proyectos_leer(app: AppHandle) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_proyectos(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(e) = std::fs::read_dir(&carpeta) {
            if e.kind() != std::io::ErrorKind::NotFound {
                registrar(format!("proyectos: no se pudo leer la carpeta: {e}"));
                return Err(String::from("No se pudo abrir la carpeta de proyectos."));
            }
        }
        let l = proyectos::listar(&carpeta);
        let lista: Vec<serde_json::Value> = l.proyectos.iter().map(proyectos::con_estado).collect();
        Ok(serde_json::json!({ "proyectos": lista, "rotas": l.rotas }))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Crea un proyecto (11.3): `datos` = `{ id, nombre, color, instrucciones, carpeta: "avis" | "elegir" }`.
/// Primero se revisa el nombre y el id; con `"elegir"`, después el diálogo (cancelado: `{ cancelado: true
/// }` y nada se crea); con `"avis"`, la carpeta en Documentos. `{ proyecto }` (con el estado de su
/// carpeta) o `{ error, motivo }`.
#[tauri::command]
async fn proyecto_crear(app: AppHandle, datos: serde_json::Value) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_proyectos(&app)?;
    let reglas = reglas_proyectos(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let ahora = chrono::Utc::now().timestamp_millis().max(0) as u64;
        let mut doc = match proyectos::nuevo(&carpeta, &datos, ahora) {
            Ok(d) => d,
            Err(e) => return Ok(error_proyecto(&e, None)),
        };
        let nombre = doc["nombre"].as_str().unwrap_or_default().to_string();
        doc["carpeta"] = match carpeta_pedida(&app, datos["carpeta"].as_str().unwrap_or_default(), &nombre, &reglas) {
            Ok(Some(c)) => c,
            Ok(None) => return Ok(serde_json::json!({ "cancelado": true })),
            Err(e) => return Ok(e),
        };
        Ok(match proyectos::crear(&carpeta, &doc) {
            Ok(p) => serde_json::json!({ "proyecto": proyectos::con_estado(&p) }),
            Err(e) => {
                registrar(format!("proyectos: no se pudo crear: {e}"));
                error_proyecto(&e, None)
            }
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Guarda lo que se edita de un proyecto (nombre, color, orden, instrucciones; 11.3). **La `carpeta` del
/// documento se ignora** (11.1). `{ proyecto }` o `{ error, motivo }` (la ventana lo anota).
#[tauri::command]
async fn proyectos_guardar(app: AppHandle, proyecto: serde_json::Value) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_proyectos(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || proyectos::guardar(&carpeta, &proyecto)).await.map_err(|e| e.to_string())?;
    Ok(match r {
        Ok(p) => serde_json::json!({ "proyecto": proyectos::con_estado(&p) }),
        Err(e) => error_proyecto(&e, None),
    })
}

/// Cambia la carpeta de un proyecto (Editar › «Cambiar…», «Elegir otra» o «Crear una nueva», 11.2):
/// `modo` `"elegir"` o `"avis"`. `{ proyecto }`, `{ cancelado: true }` o `{ error, motivo }`.
#[tauri::command]
async fn proyecto_cambiar_carpeta(app: AppHandle, id: String, modo: String) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_proyectos(&app)?;
    let reglas = reglas_proyectos(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let actual = match proyectos::leer(&carpeta, &id) {
            Ok(p) => p,
            Err(e) => return Ok(error_proyecto(&e, None)),
        };
        let nueva = match carpeta_pedida(&app, &modo, actual["nombre"].as_str().unwrap_or_default(), &reglas) {
            Ok(Some(c)) => c,
            Ok(None) => return Ok(serde_json::json!({ "cancelado": true })),
            Err(e) => return Ok(e),
        };
        Ok(match proyectos::cambiar_carpeta(&carpeta, &id, &nueva) {
            Ok(p) => serde_json::json!({ "proyecto": proyectos::con_estado(&p) }),
            Err(e) => {
                registrar(format!("proyectos: no se pudo cambiar la carpeta: {e}"));
                error_proyecto(&e, None)
            }
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Borra un proyecto (solo con el segundo clic de «¿Borrar…? Sí», D-p2): primero sus charlas (el archivo
/// y su copia de Engram, como `chat_borrar_todo`), después su archivo, y solo si todas se borraron.
/// **Nunca su carpeta** ni un archivo roto. `{ charlas, fallidas }` (las charlas borradas y las que no) o
/// `{ error }`.
#[tauri::command]
async fn proyecto_borrar(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_proyectos(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || {
        let carpeta_chat = el_chat()?.carpeta();
        let r = {
            let _cola = ENGRAM_COLA.lock().unwrap_or_else(PoisonError::into_inner);
            proyectos::borrar_con_charlas(&carpeta, &carpeta_chat, &id)
        };
        if let Ok(b) = &r {
            if b.fallidas > 0 {
                registrar(format!("proyectos: borrar: {} charlas sin borrar; el proyecto queda", b.fallidas));
            }
            borrar_de_engram(b.engram.clone());
        }
        r
    })
    .await
    .map_err(|e| e.to_string())?;
    Ok(match r {
        Ok(b) => serde_json::json!({ "charlas": b.borradas, "fallidas": b.fallidas }),
        Err(error) => {
            registrar(format!("proyectos: no se pudo borrar: {error}"));
            error_proyecto(&error, None)
        }
    })
}

/// Abre la carpeta de un proyecto en el Explorador (11.2): Rust lee la ruta del archivo del proyecto y la
/// revalida; nunca una ruta de la ventana.
#[tauri::command]
async fn proyecto_abrir_carpeta(app: AppHandle, id: String) -> Result<(), String> {
    let carpeta = carpeta_proyectos(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || proyectos::ruta_para_abrir(&carpeta, &id)).await.map_err(|e| e.to_string())??;
    std::process::Command::new("explorer").arg(&r).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// Copia los archivos soltados sobre la zona de un proyecto (11.2, P3): solo en una carpeta creada por Avis,
/// hasta 20 por vez y 200 MB cada uno; **copia, nunca mueve ni pisa** (« (2)»). La ventana manda el id y
/// las rutas que entregó el evento de soltar de Tauri; la carpeta destino sale del archivo del proyecto.
/// `{ copiados, renombrados, fallidos }` o `{ error }`. Al log, solo las cuentas.
#[tauri::command]
async fn proyecto_soltar(app: AppHandle, id: String, rutas: Vec<String>) -> Result<serde_json::Value, String> {
    let carpeta = carpeta_proyectos(&app)?;
    let reglas = reglas_proyectos(&app)?;
    let r = tauri::async_runtime::spawn_blocking(move || proyectos::soltar(&carpeta, &id, &rutas, &reglas)).await.map_err(|e| e.to_string())?;
    Ok(match r {
        Ok(v) => {
            let fallidos = v["fallidos"].as_array().map_or(0, Vec::len);
            if fallidos > 0 {
                registrar(format!("proyectos: soltar: {} copiados, {fallidos} sin copiar", v["copiados"].as_array().map_or(0, Vec::len)));
            }
            v
        }
        Err(error) => {
            registrar(format!("proyectos: no se pudo soltar: {error}"));
            error_proyecto(&error, None)
        }
    })
}

/// Abre `<config>/proyectos/` en el Explorador (7.6: «Abrir la carpeta» de un proyecto roto).
#[tauri::command]
fn proyectos_abrir_carpeta(app: AppHandle) -> Result<(), String> {
    let carpeta = carpeta_proyectos(&app)?;
    std::fs::create_dir_all(&carpeta).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer").arg(&carpeta).spawn().map(|_| ()).map_err(|e| e.to_string())
}

/// El motor, la carpeta y el modelo de la charla (chat-avis-ux.md 3.4 y #35): quedan para la próxima
/// charla nueva y la carpeta va primera en las recientes. `modelo`: uno de `chat::MODELOS` o `null`
/// ("Por defecto"), guardado tal cual. Devuelve `{ motor, carpeta, recientes, modelo }` como el `chat`
/// de `leer_configuracion`.
#[tauri::command]
fn guardar_chat(app: AppHandle, motor: String, carpeta: Option<String>, modelo: Option<String>) -> Result<serde_json::Value, String> {
    let ruta = ruta_preferencias(&app).ok_or_else(|| String::from("sin carpeta de configuración"))?;
    if carpeta.as_deref().is_some_and(|c| !std::path::Path::new(c).is_dir()) {
        return Err(String::from("la carpeta no existe"));
    }
    preferencias::guardar_chat(&ruta, &motor, carpeta.as_deref(), modelo.as_deref()).map(valor_chat)
}

/// "＋ Elegir otra carpeta…" (D10): el selector nativo de carpetas, solo con ese clic. `null` si se
/// canceló. Corre fuera del hilo principal (el diálogo bloquea hasta que el usuario elige).
#[tauri::command]
async fn elegir_carpeta(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialogo = app.dialog().file().set_title("Elegí la carpeta de la charla");
        if let Some(v) = ventana(&app) {
            dialogo = dialogo.set_parent(&v);
        }
        dialogo.blocking_pick_folder().and_then(|r| r.into_path().ok()).map(|r| r.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| e.to_string())
}

/// Todo lo que la ventana necesita al arrancar y para la configuración (configuracion-ux.md 9.2):
/// `{ mascota, acople, flotante, arriba, avisar, pausa, arranque, version, chat, tareasAvisado,
/// habitosRecordados, habitosResumen, habitosFrase }`.
/// `arranque` sale del sistema, no del archivo. Sin carpeta de configuración, los valores de fábrica.
/// Sin `tamano`: el panel va siempre al 100 % (#47).
#[tauri::command]
fn leer_configuracion(app: AppHandle, estado: State<'_, Estado>) -> serde_json::Value {
    let ruta = ruta_preferencias(&app);
    let interruptores = ruta.as_deref().map(preferencias::leer_interruptores).unwrap_or_default();
    let nombres = ruta.as_deref().map(preferencias::leer_nombres).unwrap_or_default();
    serde_json::json!({
        "mascota": ruta.as_deref().map(preferencias::leer_mascota).unwrap_or_else(|| String::from(preferencias::ESPECIES[0])),
        "nombreMascota": nombres.mascota,
        "nombreUsuario": nombres.usuario,
        "acople": preferencias::valor_de_acople(*estado.acople.lock().unwrap()),
        "flotante": ruta.as_deref().and_then(preferencias::leer_flotante).map(|f| serde_json::json!({ "x": f.x, "y": f.y })),
        "arriba": interruptores.arriba,
        "avisar": interruptores.avisar,
        "pausa": interruptores.pausa,
        "arranque": arranque::marca_real(app.autolaunch().is_enabled()),
        "version": app.package_info().version.to_string(),
        "chat": valor_chat(ruta.as_deref().map(preferencias::leer_chat).unwrap_or_default()),
        // El día del último aviso diario de tareas (tareas-ux.md 11.4), o null
        "tareasAvisado": ruta.as_deref().and_then(preferencias::leer_tareas_avisado),
        // Los hábitos ya recordados hoy (habitos-ux.md 8.3): `{ dia, ids }`, o null
        "habitosRecordados": ruta.as_deref().and_then(preferencias::leer_habitos_recordados),
        // El lunes de la semana del último resumen semanal visto (habitos-ux.md 8.4), o null
        "habitosResumen": ruta.as_deref().and_then(preferencias::leer_habitos_resumen),
        // La frase de esa semana (8.4): `{ lunes, frase }`, o null; así no se le pide de nuevo al modelo
        "habitosFrase": ruta.as_deref().and_then(preferencias::leer_habitos_frase),
    })
}

/// La charla guardada para la ventana: la carpeta y las recientes, solo las que siguen existiendo
/// (una carpeta borrada no se ofrece ni se abre). Sin carpeta, "Solo Avis" (D9).
fn valor_chat(c: preferencias::Chat) -> serde_json::Value {
    let existe = |r: &String| std::path::Path::new(r).is_dir();
    serde_json::json!({
        "motor": c.motor,
        "carpeta": c.carpeta.filter(existe),
        "recientes": c.recientes.into_iter().filter(existe).collect::<Vec<_>>(),
        "modelo": c.modelo,
    })
}

/// Guarda un ajuste de la configuración (`mascota`, `arriba`, `avisar` o `pausa`; configuracion-ux.md
/// 9.2; `tareasAvisado`, el día del aviso diario de tareas, tareas-ux.md 11.4; y `habitosRecordados`,
/// los hábitos ya recordados hoy, habitos-ux.md 8.3) y aplica su
/// efecto: "Siempre arriba" a la ventana, la pausa a la marca de la bandeja y a la ventana
/// (`oficina://pausa`), la mascota a la ventana (`oficina://mascota`); el aviso y los recordados, ninguno. Si no se
/// pudo guardar, no aplica nada y la ventana vuelve el control a su valor de antes.
#[tauri::command]
fn guardar_ajuste(app: AppHandle, estado: State<'_, Estado>, clave: String, valor: serde_json::Value) -> Result<serde_json::Value, String> {
    // Un error vuelve a la ventana, que lo anota en widget.log y muestra "No se pudo guardar"
    let ruta = ruta_preferencias(&app).ok_or("no se conoce la carpeta de configuración")?;
    preferencias::guardar_ajuste(&ruta, &clave, &valor)?;
    match (clave.as_str(), valor.as_bool()) {
        ("arriba", Some(v)) => {
            estado.arriba.store(v, Ordering::Relaxed);
            // Acoplada, la muesca queda siempre arriba; la marca vale para cuando flote
            let acoplada = estado.acople.lock().unwrap().is_some();
            if let Some(w) = ventana(&app) {
                let _ = w.set_always_on_top(v || acoplada);
            }
        }
        ("pausa", Some(v)) => {
            if let Some(m) = estado.menu.lock().unwrap().as_ref() {
                let _ = m.pausa.set_checked(v);
            }
            let _ = app.emit("oficina://pausa", v);
        }
        ("mascota", _) => {
            let _ = app.emit("oficina://mascota", serde_json::json!({ "mascota": valor }));
        }
        _ => {}
    }
    Ok(serde_json::json!({ "ok": true, "valor": valor }))
}

/// "Arrancar con Windows" de la configuración: solo con el clic del usuario cambia el inicio de
/// Windows. Devuelve la marca real del sistema después (si falló, no miente).
#[tauri::command]
fn poner_arranque(app: AppHandle, valor: bool) -> bool {
    let auto = app.autolaunch();
    let real = arranque::aplicar(valor, || auto.enable(), || auto.disable(), || auto.is_enabled());
    if real != valor {
        registrar(format!("configuración: arrancar con Windows quedó en {real}"));
    }
    real
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

/// Acopla la muesca a `borde` en `lugar` (0 a 1), o la deja flotando sin `borde`: lo guarda en
/// `preferencias.json` con el monitor donde está, ajusta la ventana (arriba y sin barra de tareas
/// acoplada). Lo que se ve lo anima el frontend, adentro de la ventana.
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
    if let Some(v) = ventana(&app) {
        aplicar_acople_ventana(&v, acople.is_some(), arriba_marcado(&estado)).map_err(|e| e.to_string())?;
    }
    let _ = guardar_monitor_actual(&app);
    match ruta_preferencias(&app) {
        Some(r) => preferencias::guardar_acople(&r, acople),
        None => Err(String::from("no se conoce la carpeta de configuración")),
    }
}

/// Guarda dónde quedó el tablero flotante (fracciones del lugar libre del área, `fraccionFlotante`
/// de `tamano.js`) y el monitor donde está la ventana, para volver ahí al arrancar (9.7).
#[tauri::command]
fn guardar_flotante(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    let _ = guardar_monitor_actual(&app);
    let ruta = ruta_preferencias(&app).ok_or("no se conoce la carpeta de configuración")?;
    preferencias::guardar_flotante(&ruta, preferencias::Flotante { x, y })
}

/// Lleva la ventana al área de trabajo que calculó el frontend (`ventanaDeArea`), en px lógicos:
/// solo al pasar a otro monitor o si cambió el área. Todo lo demás pasa adentro de la ventana.
#[tauri::command]
fn ajustar_ventana(app: AppHandle, ancho: f64, alto: f64, x: f64, y: f64) -> Result<(), String> {
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
/// `set_position` había cuadros con la ventana grande en el lugar viejo.
fn mover_y_redimensionar(v: &WebviewWindow, ancho: f64, alto: f64, x: f64, y: f64) -> Result<(), String> {
    let escala = v.scale_factor().map_err(|e| e.to_string())?;
    let (fx, fy, fa, fh) = rect_fisico(x, y, ancho, alto, escala);
    colocar_fisico(v, fx, fy, fa, fh)
}

/// Pone la ventana en un rectángulo de px físicos, en una sola operación de Windows.
#[cfg(windows)]
fn colocar_fisico(v: &WebviewWindow, x: i32, y: i32, ancho: i32, alto: i32) -> Result<(), String> {
    #[link(name = "user32")]
    extern "system" {
        fn SetWindowPos(hwnd: isize, despues: isize, x: i32, y: i32, cx: i32, cy: i32, banderas: u32) -> i32;
    }
    const SWP_NOZORDER: u32 = 0x0004;
    const SWP_NOACTIVATE: u32 = 0x0010;
    const SWP_NOOWNERZORDER: u32 = 0x0200;
    let hwnd = v.hwnd().map_err(|e| e.to_string())?.0 as isize;
    // SAFETY: hwnd es la ventana viva de Tauri; SetWindowPos no guarda punteros
    let ok = unsafe { SetWindowPos(hwnd, 0, x, y, ancho.max(1), alto.max(1), SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER) };
    if ok == 0 {
        // Si Windows la rechaza, el camino de antes en dos pasos
        v.set_size(PhysicalSize::new(ancho.max(1) as u32, alto.max(1) as u32)).map_err(|e| e.to_string())?;
        return v.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string());
    }
    Ok(())
}

#[cfg(not(windows))]
fn colocar_fisico(v: &WebviewWindow, x: i32, y: i32, ancho: i32, alto: i32) -> Result<(), String> {
    v.set_size(PhysicalSize::new(ancho.max(1) as u32, alto.max(1) as u32)).map_err(|e| e.to_string())?;
    v.set_position(PhysicalPosition::new(x, y)).map_err(|e| e.to_string())
}

/// La ventana avisa que pasó a la tira mini o volvió (la tira es un elemento adentro de la ventana
/// del área: no cambia nada de la ventana). Sirve para que abrir Avis otra vez la expanda.
#[tauri::command]
fn modo_mini(estado: State<'_, Estado>, mini: bool) {
    *estado.mini.lock().unwrap() = mini;
    despertar(&estado);
}

/// Esconde la ventana en la bandeja (la × de la barra de título).
#[tauri::command]
fn esconder(app: AppHandle, estado: State<'_, Estado>) {
    if let Some(v) = ventana(&app) {
        let _ = v.hide();
    }
    despertar(&estado);
}

/// Zona de la ventana que toma el mouse (9.6 y 9.7), en px lógicos de pantalla: acoplada, la muesca
/// con un margen (cerrada) o el tablero (abierta); flotando, el tablero; en la tira, la tira; o toda
/// la ventana (`toda`, mientras se arrastra). Fuera de
/// ella los clics pasan a lo que hay debajo. Devuelve si el puntero está adentro ahora; el cambio lo
/// aplica y lo avisa el hilo del sondeo (`oficina://puntero-zona`), el único que toca la ventana.
/// `mirada`: el Avi que está a la vista quiere el puntero (la marca con el panel abierto o el de la
/// muesca cerrada); entonces el sondeo avisa también su posición (`oficina://cursor`).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn zona_interactiva(app: AppHandle, estado: State<'_, Estado>, x: f64, y: f64, ancho: f64, alto: f64, toda: Option<bool>, mirada: Option<bool>) -> Result<bool, String> {
    let zona = zona_valida(x, y, ancho, alto).ok_or("zona inválida")?;
    let escala = ventana(&app).ok_or("sin ventana")?.scale_factor().map_err(|e| e.to_string())?;
    let toda = toda.unwrap_or(false);
    // Una zona nueva: la próxima vuelta del sondeo avisa el estado real aunque no haya cambiado
    let mut p = estado.puntero.lock().unwrap();
    poner_zona(&mut p, zona, toda, escala);
    // Si el Avi a la vista quiere el puntero, el sondeo avisa también su posición (su mirada)
    p.mirada = mirada.unwrap_or(false);
    drop(p);
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

fn carpeta_de_ordenes() -> Result<std::path::PathBuf, String> {
    ordenes::carpeta_ordenes().ok_or_else(|| String::from("no se conoce la carpeta del usuario"))
}

/// Deja una orden para una sesión (#19): `mensaje` (con `texto`), `frenar` o `cerrar` (#25). Devuelve
/// su id. Solo se llama desde un clic o un Enter del usuario: el widget nunca ordena por su cuenta.
#[tauri::command]
fn ordenar(sesion: String, tipo: String, texto: Option<String>) -> Result<String, String> {
    ordenes::escribir_orden(&carpeta_de_ordenes()?, &sesion, &tipo, texto.as_deref(), chrono::Utc::now())
}

/// `{ estado: "pendiente" | "ausente" }` o `{ estado: "consumida", resultado, motivo }`.
#[tauri::command]
fn estado_orden(sesion: String, id: String) -> Result<serde_json::Value, String> {
    ordenes::estado_orden(&carpeta_de_ordenes()?, &sesion, &id)
}

#[tauri::command]
fn borrar_orden(sesion: String) -> Result<(), String> {
    ordenes::borrar_orden(&carpeta_de_ordenes()?, &sesion)
}

/// Termina el proceso de Claude Code de una sesión dormida (odd/tasks/sesiones-dormidas.md, S2), solo
/// desde el segundo clic de «Terminar». Rust comprueba todo de nuevo (terminar.rs): la ventana no puede
/// terminar una sesión despierta ni otro proceso. `{ ok: true, pid }` o `{ ok: false, error }`.
#[tauri::command]
fn terminar_sesion(sesion: String) -> serde_json::Value {
    let (Some(oficina), Some(claude)) = (sesiones::carpeta_sesiones(), transcripcion::carpeta_claude()) else {
        return serde_json::json!({ "ok": false, "error": "fallo" });
    };
    #[cfg(windows)]
    let r = terminar::terminar_con(&oficina, &claude.join("sessions"), &sesion, chrono::Utc::now(), &terminar::Windows);
    #[cfg(not(windows))]
    let r: Result<serde_json::Value, terminar::Falla> = { let _ = (oficina, claude); Err(terminar::Falla::Fallo) };
    match r {
        Ok(v) => {
            registrar(format!("terminar: sesión {sesion}, proceso {} terminado", v["pid"]));
            v
        }
        Err(f) => {
            registrar(format!("terminar: sesión {sesion} no ({})", f.codigo()));
            serde_json::json!({ "ok": false, "error": f.codigo() })
        }
    }
}

/// Lo último de la conversación de una sesión (#25), en solo lectura de su transcripción:
/// `{ entradas: [{ rol, texto, cuando }] }`. Fuera del hilo principal: puede leer hasta 8 MB.
#[tauri::command]
async fn leer_historial(sesion: String) -> Result<serde_json::Value, String> {
    let claude = transcripcion::carpeta_claude().ok_or_else(|| String::from("no se conoce la carpeta del usuario"))?;
    tauri::async_runtime::spawn_blocking(move || transcripcion::leer_historial_de(&claude, &sesion))
        .await
        .map_err(|e| e.to_string())?
}

/// Una línea en el log de diagnóstico (clics del globo, envíos y errores del frontend).
#[tauri::command]
fn registrar(linea: String) {
    if let Some(ruta) = diagnostico::ruta_log() {
        let _ = diagnostico::agregar_linea(&ruta, &linea, chrono::Utc::now(), diagnostico::TOPE_BYTES);
    }
}

/// Notificación de Windows: una pregunta nueva o el recordatorio de un hábito (habitos-ux.md 8.3 y 5.5,
/// título y cuerpo, sin botones). Falta medir con el `.msi` el clic, cuál se tocó, imagen y botones (11.9).
#[tauri::command]
fn avisar(app: AppHandle, titulo: String, cuerpo: String) -> Result<(), String> {
    app.notification().builder().title(titulo).body(cuerpo).show().map_err(|e| e.to_string())
}

fn crear_bandeja(app: &AppHandle, pausa_guardada: bool) -> tauri::Result<()> {
    let mostrar_item = MenuItem::with_id(app, "mostrar", "Mostrar Avis", true, None::<&str>)?;
    let configuracion_item = MenuItem::with_id(app, "configuracion", "Configuración…", true, None::<&str>)?;
    // "Pausar animaciones" se queda en la bandeja: se necesita rápido y sin abrir el panel (4.5)
    let pausa = CheckMenuItem::with_id(app, "pausa", "Pausar animaciones", true, pausa_guardada, None::<&str>)?;
    let salir_item = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
    let separador = PredefinedMenuItem::separator(app)?;
    let items: Vec<&dyn IsMenuItem<Wry>> = ORDEN_BANDEJA
        .iter()
        .map(|id| -> &dyn IsMenuItem<Wry> {
            match *id {
                "mostrar" => &mostrar_item,
                "configuracion" => &configuracion_item,
                "pausa" => &pausa,
                "separador" => &separador,
                _ => &salir_item,
            }
        })
        .collect();
    let menu = Menu::with_items(app, &items)?;

    let mut bandeja = TrayIconBuilder::with_id(BANDEJA)
        .menu(&menu)
        .tooltip("Avis")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, evento| match evento.id().as_ref() {
            "mostrar" => mostrar(app),
            "configuracion" => abrir_configuracion(app),
            "pausa" => {
                let valor = app.state::<Estado>().menu.lock().unwrap().as_ref().and_then(|m| m.pausa.is_checked().ok()).unwrap_or(false);
                // Se guarda como desde la configuración: sobrevive al reinicio
                match ruta_preferencias(app) {
                    Some(r) => {
                        if let Err(e) = preferencias::guardar_ajuste(&r, "pausa", &serde_json::json!(valor)) {
                            registrar(format!("configuración: no se pudo guardar pausa: {e}"));
                        }
                    }
                    None => registrar(String::from("configuración: no se conoce la carpeta de configuración")),
                }
                let _ = app.emit("oficina://pausa", valor);
            }
            "salir" => salir(app),
            _ => {}
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
    *app.state::<Estado>().menu.lock().unwrap() = Some(MenuBandeja { pausa });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRINCIPAL: Rect = (0, 0, 1920, 1080);

    #[test]
    fn la_bandeja_queda_con_mostrar_configuracion_pausar_y_salir() {
        // configuracion-ux.md 4.5 (entrega 3): "Primeros pasos" y "Borrar el modelo de IA…" se mudan
        // a las pestañas Instalación y Modelos. Siguen "Mostrar Avis", "Configuración…" debajo,
        // "Pausar animaciones" (se necesita rápido y sin abrir el panel) y "Salir" al final
        assert_eq!(ORDEN_BANDEJA, ["mostrar", "configuracion", "pausa", "separador", "salir"]);
        assert_eq!(EVENTO_CONFIGURACION, "oficina://configuracion");
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
    fn el_sondeo_corre_en_todas_las_formas_mientras_la_ventana_se_ve() {
        // Ventana única (9.7): acoplada, flotando y en la tira la ventana es el área entera y fuera de
        // la zona los clics pasan; solo escondida en la bandeja o minimizada no hay nada que mirar
        assert!(debe_sondear(true));
        assert!(!debe_sondear(false));
    }

    #[test]
    fn al_arrancar_la_ventana_va_al_monitor_que_contiene_el_punto_guardado() {
        let monitores: [Rect; 3] = [PRINCIPAL, (1920, 0, 2560, 1440), (-1280, 100, 1280, 1024)];
        assert_eq!(monitor_que_contiene((960.0, 500.0), &monitores), Some(0));
        assert_eq!(monitor_que_contiene((3000.0, 700.0), &monitores), Some(1));
        assert_eq!(monitor_que_contiene((-10.0, 600.0), &monitores), Some(2));
        // El borde izquierdo y el de arriba cuentan; el derecho y el de abajo, del vecino
        assert_eq!(monitor_que_contiene((1920.0, 0.0), &monitores), Some(1));
        // Un monitor que ya no está: ninguno (va el principal)
        assert_eq!(monitor_que_contiene((9000.0, 9000.0), &monitores), None);
        assert_eq!(monitor_que_contiene((f64::NAN, 0.0), &monitores), None);
    }

    #[test]
    fn el_punto_que_se_guarda_es_el_centro_del_area_en_px_fisicos() {
        assert_eq!(centro_de((0, 0, 1920, 1032)), (960.0, 516.0));
        assert_eq!(centro_de((-1280, 100, 1280, 984)), (-640.0, 592.0));
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

    // Mirada del Avi a la vista (marca-avi-ux.md 6 y muesca-avi-ux.md 9): la posición global solo con
    // `mirada`, que la ventana manda con el panel abierto (la marca) o con la muesca cerrada (el Avi que asoma)
    const MS: fn(u64) -> Duration = Duration::from_millis;

    #[test]
    fn con_mirada_manda_la_posicion_en_px_logicos() {
        let mut p = Puntero { mirada: true, escala: 1.5, ..Puntero::default() };
        assert_eq!(cursor_para_mirada(&mut p, Some((300.0, 150.0)), true, MS(0)), Some((200.0, 100.0)));
    }

    #[test]
    fn con_la_muesca_cerrada_manda_la_posicion_solo_si_la_ventana_pide_mirada() {
        // Muesca cerrada: la zona es la muesca + 4 y el Avi que asoma sigue al puntero (reposo o pregunta)
        let mut p = Puntero::default();
        poner_zona(&mut p, ZONA, false, 1.0);
        assert_eq!(cursor_para_mirada(&mut p, Some((900.0, 400.0)), true, MS(0)), None);
        p.mirada = true;
        assert_eq!(cursor_para_mirada(&mut p, Some((900.0, 400.0)), true, MS(100)), Some((900.0, 400.0)));
        // Trabajando, durmiendo, pausa o movimiento reducido: la ventana manda mirada: false y no se avisa
        p.mirada = false;
        assert_eq!(cursor_para_mirada(&mut p, Some((901.0, 400.0)), true, MS(200)), None);
    }

    #[test]
    fn sin_mirada_escondida_o_sin_sondeo_no_manda_nada() {
        let mut p = Puntero::default();
        assert_eq!(cursor_para_mirada(&mut p, Some((300.0, 150.0)), true, MS(0)), None);
        p.mirada = true;
        // Sin sondeo (flotando, escondida, minimizada o en la tira) tampoco
        assert_eq!(cursor_para_mirada(&mut p, Some((300.0, 150.0)), false, MS(0)), None);
        assert_eq!(cursor_para_mirada(&mut p, None, true, MS(0)), None);
    }

    #[test]
    fn solo_manda_si_cambio_y_a_lo_sumo_cada_50_ms() {
        let mut p = Puntero { mirada: true, ..Puntero::default() };
        assert!(cursor_para_mirada(&mut p, Some((10.0, 10.0)), true, MS(0)).is_some());
        // Quieto: nada
        assert_eq!(cursor_para_mirada(&mut p, Some((10.0, 10.0)), true, MS(100)), None);
        // Se movió: avisa
        assert_eq!(cursor_para_mirada(&mut p, Some((11.0, 10.0)), true, MS(100)), Some((11.0, 10.0)));
        // Se movió otra vez, pero pasaron 20 ms del último aviso: espera
        assert_eq!(cursor_para_mirada(&mut p, Some((12.0, 10.0)), true, MS(120)), None);
        // A los 50 ms del último aviso manda la posición de ahora (la última nunca se pierde)
        assert_eq!(cursor_para_mirada(&mut p, Some((14.0, 10.0)), true, MS(150)), Some((14.0, 10.0)));
    }

    #[test]
    fn al_volver_a_pedir_mirada_manda_la_posicion_aunque_no_haya_cambiado() {
        let mut p = Puntero { mirada: true, ..Puntero::default() };
        cursor_para_mirada(&mut p, Some((10.0, 10.0)), true, MS(0));
        p.mirada = false;
        assert_eq!(cursor_para_mirada(&mut p, Some((10.0, 10.0)), true, MS(500)), None);
        p.mirada = true;
        assert_eq!(cursor_para_mirada(&mut p, Some((10.0, 10.0)), true, MS(1000)), Some((10.0, 10.0)));
    }

    #[test]
    fn la_zona_nueva_y_el_reacople_no_cambian_lo_que_ya_hacia_el_sondeo() {
        // Lo de antes sigue igual: poner_zona no toca `mirada` y olvidar_zona la apaga
        let mut p = Puntero { mirada: true, ..Puntero::default() };
        poner_zona(&mut p, ZONA, false, 1.0);
        assert!(p.mirada);
        assert_eq!(evaluar(&mut p, Some((150.0, 10.0)), true).avisar, Some((true, 1)));
        olvidar_zona(&mut p);
        assert!(!p.mirada);
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
        // Primero, como pide el plugin: una sola Avis por máquina; abrir otra muestra la que hay
        .plugin(tauri_plugin_single_instance::init(|app, _argumentos, _carpeta| al_segundo_arranque(app)))
        .plugin(tauri_plugin_notification::init())
        // El selector de carpetas de la charla (D10), llamado solo desde Rust
        .plugin(tauri_plugin_dialog::init())
        // Registrar el plugin no prende nada: el arranque con Windows solo cambia desde el menú
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .manage(Estado {
            mini: Mutex::new(false),
            login: Mutex::new(None),
            menu: Mutex::new(None),
            acople: Mutex::new(None),
            arriba: AtomicBool::new(true),
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
            // Los interruptores guardados (configuracion-ux.md 9.1): "Siempre arriba" a la ventana y
            // la pausa a la bandeja; la ventana los lee con `leer_configuracion`
            let interruptores = ruta_preferencias(&handle).map(|r| preferencias::leer_interruptores(&r)).unwrap_or_default();
            handle.state::<Estado>().arriba.store(interruptores.arriba, Ordering::Relaxed);
            crear_bandeja(&handle, interruptores.pausa)?;
            if let Some(v) = ventana(&handle) {
                // Ventana única (9.7): el área de trabajo del monitor de la última vez, antes de
                // mostrarla (arranca escondida). Adentro, la ventana pone la muesca o el tablero
                if let Err(e) = colocar_al_arrancar(&handle, &v) {
                    registrar(format!("al arrancar: {e}"));
                }
                let _ = aplicar_acople_ventana(&v, acople.is_some(), arriba_marcado(&handle.state::<Estado>()));
                let _ = v.show();
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
            // El mod automático (#17): instala el mod si falta y lo actualiza una vez por día, sin clic.
            // Un solo hilo para toda la vida de la app: nunca hay dos revisiones a la vez
            let para_mod = handle.clone();
            let ruta_mod = ruta_preferencias(&handle);
            std::thread::Builder::new().name(String::from("oficina-mod-auto")).spawn(move || {
                mod_auto::vigilar(ruta_mod, |evento, v| {
                    let _ = para_mod.emit(evento, v);
                })
            })?;
            // La charla con la mascota (#22): el ajustes.json fijo (7.2) y el proceso, que lanza el primer chat_abrir
            if let Ok(config) = handle.path().app_config_dir() {
                let carpeta_chat = config.join("chat");
                if let Err(e) = chat::escribir_ajustes(&carpeta_chat) {
                    registrar(format!("chat: no se pudo escribir ajustes.json: {e}"));
                }
                let para_chat = handle.clone();
                let emisor: chat::Emisor = std::sync::Arc::new(move |v| {
                    let _ = para_chat.emit(chat::EVENTO, v);
                });
                let el = chat::Chat::nuevo(carpeta_chat, std::sync::Arc::new(chat::comando_claude), emisor, chat::Tiempos::default());
                // El motor local (8): el de `modelo.rs`, que avisa su arranque por `oficina://modelo`
                let para_modelo = handle.clone();
                el.poner_motor_local(std::sync::Arc::new(move || {
                    let avisar = |v: serde_json::Value| {
                        let _ = para_modelo.emit(modelo::EVENTO, v);
                    };
                    modelo::IA.motor_charla(&avisar).map(|(puerto, uso)| (puerto, Box::new(uso) as Box<dyn chat_local::UsoMotor>))
                }));
                // Las herramientas de tareas y hábitos de la charla (#43, C3): el servidor arranca con el primer `claude`
                let para_tareas = handle.clone();
                let para_habitos = handle.clone();
                el.poner_herramientas(
                    mcp_avis::Carpetas { tareas: config.join("tareas"), habitos: config.join("habitos") },
                    std::sync::Arc::new(move |v| {
                        let _ = para_tareas.emit(mcp_avis::EVENTO_TAREAS, v);
                    }),
                    std::sync::Arc::new(move |v| {
                        let _ = para_habitos.emit(mcp_avis::EVENTO_HABITOS, v);
                    }),
                );
                // Las charlas de proyecto (#44, proyectos-ux.md 11.4): sus instrucciones y su carpeta se leen de acá
                el.poner_proyectos(config.join("proyectos"));
                // Las instrucciones de proyecto que quedaron de una ejecución cortada (B1 de P2)
                chat::limpiar_sistema(&el.carpeta());
                let _ = chat::CHAT.set(el);
            }
            // La copia del historial en Engram (9.2): una sesión por arranque, que se abre con la primera copia
            let arranque = format!("avis-{}-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"), std::process::id());
            let _ = engram::ENGRAM.set(engram::Engram::desde_entorno(arranque));
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
            leer_configuracion,
            guardar_ajuste,
            poner_arranque,
            geometria,
            ajustar_ventana,
            guardar_acople,
            guardar_flotante,
            modo_mini,
            esconder,
            zona_interactiva,
            poner_bandeja,
            avisar,
            responder,
            estado_respuesta,
            borrar_respuesta,
            ordenar,
            estado_orden,
            borrar_orden,
            terminar_sesion,
            leer_historial,
            registrar,
            revisar_primeros_pasos,
            estado_mod,
            correr_paso,
            cancelar_paso,
            abrir_enlace,
            tomar_aviso_mod,
            estado_modelo,
            descargar_modelo,
            cancelar_modelo,
            chat_abrir,
            chat_enviar,
            chat_adjunto,
            elegir_adjuntos,
            chat_frenar,
            chat_cerrar,
            chat_guardar,
            chat_historial,
            chat_leer,
            chat_borrar,
            chat_contar,
            chat_borrar_todo,
            chat_deshacer,
            chat_reintentar,
            tareas_leer,
            tareas_guardar,
            tareas_borrar_lista,
            tareas_abrir_carpeta,
            habitos_leer,
            habitos_guardar,
            habitos_borrar,
            habitos_abrir_carpeta,
            habitos_frase,
            proyectos_leer,
            proyecto_crear,
            proyectos_guardar,
            proyecto_cambiar_carpeta,
            proyecto_borrar,
            proyecto_abrir_carpeta,
            proyecto_soltar,
            proyectos_abrir_carpeta,
            guardar_chat,
            elegir_carpeta,
            borrar_modelo,
            claves_estado,
            guardar_clave,
            borrar_clave,
            probar_clave
        ])
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar el widget de la oficina")
        .run(|_app, evento| {
            // Cualquier salida de la aplicación, no solo "Salir" de la bandeja
            if let tauri::RunEvent::Exit = evento {
                apagar_paso();
                // El motor del modelo local y la descarga no quedan corriendo (el trabajo de Windows
                // lo mata igual si la aplicación se cae)
                modelo::IA.apagar();
                // El chat: la interrupción si hay un turno, cerrar stdin, 2 s y el trabajo de Windows (7.3)
                if let Some(c) = chat::CHAT.get() {
                    c.apagar();
                }
                // La sesión de Engram de este arranque, si se abrió (9.2)
                if let Some(e) = engram::ENGRAM.get() {
                    e.cerrar();
                }
            }
        });
}
