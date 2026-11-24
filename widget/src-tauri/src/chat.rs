//! La charla con la mascota por Claude Code (#22, docs/diseno/chat-avis-ux.md 7): un proceso
//! `claude -p` de larga vida por conversación, que solo responde.
//!
//! Reglas firmes (7.1, 7.2 y 11):
//! - Los argumentos son fijos (`argumentos_chat`) y los fijan los tests: `--permission-mode manual`
//!   y `--tools Read,Glob,Grep` son la barrera real (el usuario tiene `bypassPermissions`), sin MCP,
//!   sin hooks, sin plugins del usuario y con `--safe-mode`. Cualquier herramienta nueva vuelve a diseño.
//! - Nada se manda sin un clic o Enter: `enviar` solo lo llama la ventana con el mensaje del usuario.
//!   Abrir (precalentar) lanza el proceso sin escribirle nada, y así no gasta tokens (medido en E0).
//! - Como mucho un proceso vivo (D20), dentro de un trabajo de Windows que lo mata con Avis.
//! - El eco de cada mensaje repite el contenido entero (20 MB con un PDF de 15 MB): las líneas se
//!   leen sin tope chico y nunca se guardan ni se anotan.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::hash::{BuildHasher, Hasher};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock, PoisonError};
use std::time::{Duration, Instant};

use crate::modelo;
use crate::primeros_pasos::{self, trabajo::Trabajo, Programa};

/// Evento a la ventana (7.5): `{ conversacion, turno, tipo, ... }`.
pub const EVENTO: &str = "oficina://chat";

/// Las instrucciones de sistema (4.3), con `{Mascota}` en lugar del nombre. Una sola línea: viaja
/// como argumento.
pub const INSTRUCCION_CHAT: &str = "Sos {Mascota}, la mascota de Avis, el panel que muestra en qué anda Claude Code. \
Respondés en español rioplatense, de vos, breve y concreto. \
Solo respondés: no modificás archivos ni corrés comandos (no tenés esas herramientas). \
Si te piden algo que requiere actuar, explicá qué haría falta. \
Cuando el mensaje traiga un bloque `<avis>`, son los datos en vivo de las sesiones: usalos para responder sobre ellas. \
Usá Markdown simple (títulos, listas, código).";

/// Las únicas herramientas del chat (7.1): solo leer.
pub const HERRAMIENTAS: &str = "Read,Glob,Grep";
/// Tope de gasto por proceso (D16).
pub const TOPE_USD: &str = "2";
/// Sin eco ni ningún evento del turno a los 15 s del envío: error `proceso` (7.4).
pub const ECO_MAXIMO: Duration = Duration::from_secs(15);
/// D33: el error `red` sale con el tercer `api_retry` sin respuesta del servidor.
pub const REINTENTOS_SIN_RED: u64 = 3;
/// Los tramos de texto se juntan cada tanto (7.5).
pub const JUNTAR: Duration = Duration::from_millis(50);
/// Al salir de Avis: cuánto se espera a que los procesos terminen solos antes de matarlos (7.3).
pub const ESPERA_SALIDA: Duration = Duration::from_secs(2);
/// Largo máximo del detalle de un error (va al `title`).
const TOPE_DETALLE: usize = 300;
/// Largo máximo de un mensaje del usuario, en caracteres.
pub const MAX_TEXTO: usize = 100_000;

// ------------------------------------------------------------------ argumentos (7.1) y ajustes (7.2)

/// La sesión de Claude Code de una conversación: nueva (con el id que genera Avis) o retomada.
#[derive(Clone, Debug, PartialEq)]
pub enum Sesion {
    Nueva(String),
    Retomar(String),
}

pub struct Pedido<'a> {
    pub ajustes: &'a Path,
    pub mascota: &'a str,
    pub sesion: &'a Sesion,
}

/// `INSTRUCCION_CHAT` con el nombre de la mascota.
pub fn instruccion_chat(mascota: &str) -> String {
    INSTRUCCION_CHAT.replace("{Mascota}", &nombre_mascota(mascota))
}

/// El nombre que manda la ventana, o "Avi" si viene vacío, largo o con caracteres de control.
pub fn nombre_mascota(nombre: &str) -> String {
    let n = nombre.trim();
    if n.is_empty() || n.chars().count() > 40 || n.chars().any(char::is_control) {
        String::from("Avi")
    } else {
        n.to_string()
    }
}

/// La lista fija de 7.1.
pub fn argumentos_chat(p: &Pedido) -> Vec<String> {
    let mut a: Vec<String> = [
        "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--include-partial-messages", "--replay-user-messages",
        "--permission-mode", "manual",
        "--tools", HERRAMIENTAS, "--allowedTools", HERRAMIENTAS,
        "--permission-prompts", "none", "--safe-mode", "--strict-mcp-config",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    a.push(String::from("--settings"));
    a.push(p.ajustes.to_string_lossy().into_owned());
    a.push(String::from("--append-system-prompt"));
    a.push(instruccion_chat(p.mascota));
    a.push(String::from("--max-budget-usd"));
    a.push(String::from(TOPE_USD));
    match p.sesion {
        Sesion::Nueva(id) => a.extend([String::from("--session-id"), id.clone()]),
        Sesion::Retomar(id) => a.extend([String::from("--resume"), id.clone()]),
    }
    a
}

/// `ajustes.json` del chat (7.2), siempre igual.
pub fn ajustes_chat() -> Value {
    json!({
        "enabledPlugins": { "oficina@quintech": false, "engram@engram": false },
        "disableAllHooks": true,
        "outputStyle": "default"
    })
}

/// `<config>/chat/trabajo`: la carpeta vacía propia de "Solo Avis" (D9).
pub fn carpeta_trabajo(carpeta_chat: &Path) -> PathBuf {
    carpeta_chat.join("trabajo")
}

/// Escribe `<config>/chat/ajustes.json` (atómico) y crea la carpeta de trabajo. Devuelve la ruta.
pub fn escribir_ajustes(carpeta_chat: &Path) -> std::io::Result<PathBuf> {
    fs::create_dir_all(carpeta_trabajo(carpeta_chat))?;
    let ruta = carpeta_chat.join("ajustes.json");
    let tmp = carpeta_chat.join("ajustes.json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(&ajustes_chat()).unwrap_or_default())?;
    fs::rename(&tmp, &ruta)?;
    Ok(ruta)
}

/// `claude.cmd` de npm tiene al lado el ejecutable de verdad: se corre directo, sin `cmd.exe`
/// (que reinterpreta los argumentos). Si no está, la ruta tal cual.
pub fn claude_directo(ruta: &Path, existe: impl Fn(&Path) -> bool) -> PathBuf {
    let es_cmd = ruta.extension().is_some_and(|e| e.eq_ignore_ascii_case("cmd"));
    if let (true, Some(carpeta)) = (es_cmd, ruta.parent()) {
        let exe = carpeta.join("node_modules").join("@anthropic-ai").join("claude-code").join("bin").join("claude.exe");
        if existe(&exe) {
            return exe;
        }
    }
    ruta.to_path_buf()
}

// ------------------------------------------------------------------ salida (7.5) y motivos (7.7)

#[derive(Clone, Debug, PartialEq)]
pub enum EventoChat {
    Listo { sesion: String },
    Pidiendo,
    Pensando,
    Texto { texto: String },
    Herramienta { nombre: String, detalle: String },
    Fin { ms: u64 },
    Error { motivo: &'static str, detalle: Option<String> },
    /// `sin_respuesta`: `error_status: null`, el servidor no contestó (no viaja a la ventana).
    Reintento { intento: u64, maximo: u64, sin_respuesta: bool },
    Frenada,
    Recibido,
}

impl EventoChat {
    /// La forma que recibe la ventana, sin `conversacion` ni `turno`.
    pub fn a_json(&self) -> Value {
        match self {
            EventoChat::Listo { sesion } => json!({ "tipo": "listo", "sesion": sesion }),
            EventoChat::Pidiendo => json!({ "tipo": "pidiendo" }),
            EventoChat::Pensando => json!({ "tipo": "pensando" }),
            EventoChat::Texto { texto } => json!({ "tipo": "texto", "texto": texto }),
            EventoChat::Herramienta { nombre, detalle } => json!({ "tipo": "herramienta", "nombre": nombre, "detalle": detalle }),
            EventoChat::Fin { ms } => json!({ "tipo": "fin", "ms": ms }),
            EventoChat::Error { motivo, detalle: None } => json!({ "tipo": "error", "motivo": motivo }),
            EventoChat::Error { motivo, detalle: Some(d) } => json!({ "tipo": "error", "motivo": motivo, "detalle": d }),
            EventoChat::Reintento { intento, maximo, .. } => json!({ "tipo": "reintento", "intento": intento, "maximo": maximo }),
            EventoChat::Frenada => json!({ "tipo": "frenada" }),
            EventoChat::Recibido => json!({ "tipo": "recibido" }),
        }
    }

    fn es_final(&self) -> bool {
        matches!(self, EventoChat::Fin { .. } | EventoChat::Error { .. } | EventoChat::Frenada)
    }
}

/// Una línea de stdout de Claude Code → el evento para la ventana, o `None` si no le importa.
pub fn evento_de_linea(v: &Value) -> Option<EventoChat> {
    let texto = |x: &Value| x.as_str().map(String::from);
    match (v["type"].as_str()?, v["subtype"].as_str().unwrap_or("")) {
        ("system", "init") => Some(EventoChat::Listo { sesion: texto(&v["session_id"]).unwrap_or_default() }),
        ("system", "status") => (v["status"] == "requesting").then_some(EventoChat::Pidiendo),
        ("system", "thinking_tokens") => Some(EventoChat::Pensando),
        ("system", "api_retry") => Some(EventoChat::Reintento {
            intento: v["attempt"].as_u64().unwrap_or(0),
            maximo: v["max_retries"].as_u64().unwrap_or(0),
            sin_respuesta: v["error_status"].is_null(),
        }),
        ("stream_event", _) => {
            let e = &v["event"];
            match e["type"].as_str()? {
                "content_block_start" if e["content_block"]["type"] == "thinking" => Some(EventoChat::Pensando),
                "content_block_delta" if e["delta"]["type"] == "text_delta" => Some(EventoChat::Texto { texto: texto(&e["delta"]["text"])? }),
                _ => None,
            }
        }
        ("assistant", _) => v["message"]["content"].as_array()?.iter().find(|c| c["type"] == "tool_use").map(|c| {
            let nombre = texto(&c["name"]).unwrap_or_default();
            let detalle = detalle_herramienta(&nombre, &c["input"]);
            EventoChat::Herramienta { nombre, detalle }
        }),
        ("user", _) => (v["isReplay"] == true).then_some(EventoChat::Recibido),
        ("rate_limit_event", _) => (v["rate_limit_info"]["status"] == "rejected").then_some(EventoChat::Error { motivo: "limite", detalle: None }),
        ("result", subtipo) => {
            // Medido en E0: sin red y sin sesión llegan como `success` con `is_error: true`
            if subtipo == "success" && v["is_error"] != true {
                return Some(EventoChat::Fin { ms: v["duration_ms"].as_u64().unwrap_or(0) });
            }
            if v["terminal_reason"] == "aborted_streaming" {
                return Some(EventoChat::Frenada);
            }
            let detalle = texto(&v["result"]).or_else(|| v["errors"].as_array().and_then(|e| e.first()).and_then(texto)).map(|d| d.chars().take(TOPE_DETALLE).collect());
            Some(EventoChat::Error { motivo: motivo_de_result(v), detalle })
        }
        _ => None,
    }
}

/// Lo mismo desde el texto de la línea: un JSON roto o una línea suelta es `None`.
pub fn evento_de_texto(linea: &str) -> Option<EventoChat> {
    serde_json::from_str::<Value>(linea).ok().as_ref().and_then(evento_de_linea)
}

/// El motivo de un `result` de error (7.7).
pub fn motivo_de_result(v: &Value) -> &'static str {
    let texto = v["result"].as_str().unwrap_or("").to_lowercase();
    if v["subtype"] == "error_max_budget_usd" || v["terminal_reason"] == "budget_exhausted" {
        return "tope";
    }
    if texto.contains("not logged in") || texto.contains("/login") {
        return "sesion";
    }
    // Supuesto (no se pudo provocar en E0): un 429 o el texto del límite de uso
    if v["api_error_status"] == 429 || (texto.contains("limit") && (texto.contains("usage") || texto.contains("hit your"))) {
        return "limite";
    }
    let red = ["econnrefused", "enotfound", "etimedout", "econnreset", "eai_again", "connection", "internet"];
    if v["terminal_reason"] == "api_error" && red.iter().any(|r| texto.contains(r)) {
        return "red";
    }
    "otro"
}

/// El último tramo de una ruta (con `/` o `\`).
fn ultimo_tramo(s: &str) -> &str {
    s.rsplit(['/', '\\']).find(|t| !t.is_empty()).unwrap_or("")
}

/// Solo el nombre del archivo (Read) o el patrón (Glob, Grep), nunca la ruta completa.
pub fn detalle_herramienta(nombre: &str, entrada: &Value) -> String {
    let campo = if nombre == "Read" { "file_path" } else { "pattern" };
    let valor = entrada[campo].as_str().unwrap_or("");
    let absoluta = valor.starts_with(['/', '\\']) || valor.get(1..3).is_some_and(|d| d == ":\\" || d == ":/");
    let corto = if nombre == "Read" || absoluta { ultimo_tramo(valor) } else { valor };
    corto.chars().take(80).collect()
}

// ------------------------------------------------------------------ entrada (7.4) y frenar (7.6)

/// La línea de stdin de un mensaje: el bloque `<avis>` (si va) y el texto.
pub fn mensaje_usuario(texto: &str, avis: Option<&str>) -> Value {
    let mut contenido = Vec::new();
    if let Some(a) = avis {
        contenido.push(json!({ "type": "text", "text": format!("<avis>\n{a}\n</avis>") }));
    }
    contenido.push(json!({ "type": "text", "text": texto }));
    json!({ "type": "user", "message": { "role": "user", "content": contenido } })
}

/// El bloque `<avis>` de los datos de la ventana y su firma: va solo si cambió desde el último turno
/// de la conversación. Sin datos, nada y la firma sigue igual. Usa `modelo::datos_como_texto`, con
/// las `CLAVES_PROHIBIDAS` de siempre (D21).
pub fn bloque_avis(datos: &Value, firma_anterior: Option<u64>) -> (Option<String>, Option<u64>) {
    let texto = modelo::datos_como_texto(datos);
    if texto.is_empty() {
        return (None, firma_anterior);
    }
    // `DefaultHasher::new()` tiene claves fijas: la misma firma en cada llamada
    let mut h = std::collections::hash_map::DefaultHasher::new();
    h.write(texto.as_bytes());
    let firma = Some(h.finish());
    if firma == firma_anterior {
        (None, firma_anterior)
    } else {
        (Some(texto), firma)
    }
}

/// La interrupción medida (7.6).
pub fn pedido_frenar(n: u64) -> Value {
    json!({ "type": "control_request", "request_id": format!("int-{n}"), "request": { "subtype": "interrupt" } })
}

/// `^[A-Za-z0-9_-]{1,128}$`, como los ids de sesión de `ordenes.rs`.
pub fn conversacion_valida(id: &str) -> bool {
    !id.is_empty() && id.len() <= 128 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Un UUID en minúsculas (`8-4-4-4-12`).
pub fn sesion_valida(id: &str) -> bool {
    let partes: Vec<&str> = id.split('-').collect();
    partes.iter().map(|p| p.len()).eq([8, 4, 4, 4, 12]) && partes.iter().all(|p| p.chars().all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c)))
}

/// Un UUID v4 nuevo, sin dependencias (el azar de `RandomState`).
pub fn nuevo_uuid() -> String {
    let n = (u128::from(semilla()) << 64) | u128::from(semilla());
    // Versión 4 y variante RFC 4122
    let n = (n & !(0xf << 76) & !(0x3 << 62)) | (0x4 << 76) | (0x2 << 62);
    let h = format!("{n:032x}");
    format!("{}-{}-{}-{}-{}", &h[0..8], &h[8..12], &h[12..16], &h[16..20], &h[20..32])
}

// ------------------------------------------------------------------ el turno (puro)

#[derive(Debug, Default, PartialEq)]
pub struct Reaccion {
    /// Mandar ya la interrupción (7.6).
    pub interrumpir: bool,
    pub emitir: Vec<EventoChat>,
}

/// Lo que se sabe de un turno en curso: si ya arrancó (para frenar), si hay un frenar pendiente, si
/// llegó alguna noticia (el eco de 15 s) y si ya tuvo su final (uno solo por turno).
#[derive(Debug)]
pub struct Turno {
    pub numero: u64,
    desde: Instant,
    arrancado: bool,
    noticias: bool,
    frenar_pendiente: bool,
    interrumpido: bool,
    terminado: bool,
    vio_pidiendo: bool,
    vio_pensando: bool,
}

impl Turno {
    pub fn nuevo(numero: u64, desde: Instant) -> Turno {
        Turno { numero, desde, arrancado: false, noticias: false, frenar_pendiente: false, interrumpido: false, terminado: false, vio_pidiendo: false, vio_pensando: false }
    }

    pub fn activo(&self) -> bool {
        !self.terminado
    }

    /// `chat_frenar`: `true` si hay que mandar la interrupción ya; si el turno no arrancó, queda
    /// pendiente y sale con el primer evento (medido: antes del `init` no hace nada).
    pub fn frenar(&mut self) -> bool {
        if self.terminado || self.interrumpido || self.frenar_pendiente {
            return false;
        }
        if self.arrancado {
            self.interrumpido = true;
            true
        } else {
            self.frenar_pendiente = true;
            false
        }
    }

    pub fn al_evento(&mut self, ev: EventoChat) -> Reaccion {
        self.noticias = true;
        let mut r = Reaccion::default();
        if self.terminado {
            // Un solo final por turno: lo que llegue después (el result del corte) no se repite
            return r;
        }
        self.arrancado = true;
        if self.frenar_pendiente {
            self.frenar_pendiente = false;
            self.interrumpido = true;
            r.interrumpir = true;
        }
        match ev {
            EventoChat::Pidiendo if self.vio_pidiendo => {}
            EventoChat::Pensando if self.vio_pensando => {}
            EventoChat::Pidiendo => {
                self.vio_pidiendo = true;
                r.emitir.push(ev);
            }
            EventoChat::Pensando => {
                self.vio_pensando = true;
                r.emitir.push(ev);
            }
            EventoChat::Reintento { intento, sin_respuesta, .. } => {
                r.emitir.push(ev);
                // D33: sin red no se esperan los 3 minutos de reintentos de Claude Code
                if sin_respuesta && intento >= REINTENTOS_SIN_RED {
                    if !self.interrumpido {
                        self.interrumpido = true;
                        r.interrumpir = true;
                    }
                    self.terminado = true;
                    r.emitir.push(EventoChat::Error { motivo: "red", detalle: None });
                }
            }
            ev => {
                self.terminado = ev.es_final();
                r.emitir.push(ev);
            }
        }
        r
    }

    /// ¿Pasó `eco` desde el envío sin ninguna noticia del turno?
    pub fn sin_noticias(&self, ahora: Instant, eco: Duration) -> bool {
        !self.terminado && !self.noticias && ahora.saturating_duration_since(self.desde) >= eco
    }

    /// Termina el turno con un error propio (proceso, sin-claude), una sola vez.
    pub fn cortar(&mut self, motivo: &'static str) -> Option<EventoChat> {
        if self.terminado {
            return None;
        }
        self.terminado = true;
        Some(EventoChat::Error { motivo, detalle: None })
    }
}

/// Junta los tramos de texto que llegan en `JUNTAR` (7.5).
#[derive(Debug, Default)]
pub struct Juntador {
    pendiente: String,
    desde: Option<Instant>,
}

impl Juntador {
    pub fn agregar(&mut self, texto: &str, ahora: Instant) {
        self.pendiente.push_str(texto);
        self.desde.get_or_insert(ahora);
    }

    pub fn vencido(&self, ahora: Instant) -> bool {
        self.desde.is_some_and(|d| ahora.saturating_duration_since(d) >= JUNTAR)
    }

    /// Cuánto falta para vencer, si hay algo.
    pub fn espera(&self, ahora: Instant) -> Option<Duration> {
        self.desde.map(|d| JUNTAR.saturating_sub(ahora.saturating_duration_since(d)))
    }

    pub fn sacar(&mut self) -> Option<String> {
        self.desde = None;
        (!self.pendiente.is_empty()).then(|| std::mem::take(&mut self.pendiente))
    }
}

// ------------------------------------------------------------------ el proceso (7.3)

/// Emite a la ventana.
pub type Emisor = Arc<dyn Fn(Value) + Send + Sync>;

/// Lo que hace falta para lanzar: los argumentos de `argumentos_chat` y la carpeta.
pub struct Lanzamiento {
    pub args: Vec<String>,
    pub cwd: PathBuf,
}

/// Arma el comando (sin stdio ni carpeta, que pone el chat). Un error es `sin-claude`.
pub type Lanzador = Arc<dyn Fn(&Lanzamiento) -> std::io::Result<Command> + Send + Sync>;

/// Los tiempos del chat (los tests los acortan).
#[derive(Clone, Copy, Debug)]
pub struct Tiempos {
    pub eco: Duration,
    pub inactividad: Duration,
    pub salida: Duration,
}

impl Default for Tiempos {
    fn default() -> Self {
        Tiempos { eco: ECO_MAXIMO, inactividad: modelo::INACTIVIDAD, salida: ESPERA_SALIDA }
    }
}

/// `claude` con los argumentos, sin consola y con el PATH unido (`primeros_pasos::ruta`).
pub fn comando_claude(l: &Lanzamiento) -> std::io::Result<Command> {
    let lugares = primeros_pasos::lugares();
    let ruta = primeros_pasos::ruta(Programa::Claude, &lugares).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "claude no está instalado"))?;
    let exe = claude_directo(&ruta, |p| p.is_file());
    let mut c = Command::new(exe);
    c.args(&l.args).env("PATH", &lugares.path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW
        c.creation_flags(0x0800_0000);
    }
    Ok(c)
}

/// Lo que mandan los hilos que leen el proceso.
enum Linea {
    Evento(EventoChat),
    /// stderr: "Session ID … is already in use" (medido en E0): la sesión ya existe.
    SesionEnUso,
    /// stdout terminó.
    Fin,
}

struct Conversacion {
    sesion: String,
    /// Ya tuvo un turno (llegó su `init` o su eco): la próxima vez, `--resume`. Medido: un
    /// `--session-id` precalentado y cerrado sin mensaje se puede volver a usar.
    usada: bool,
    cwd: PathBuf,
    mascota: String,
    firma: Option<u64>,
}

/// El proceso y su trabajo de Windows. Soltar el trabajo mata el proceso: vive hasta que sale.
struct Vivo {
    hijo: Mutex<Child>,
    trabajo: Option<Trabajo>,
}

impl Vivo {
    fn matar(&self) {
        if let Some(t) = &self.trabajo {
            t.terminar();
        }
        let _ = bloquear(&self.hijo).kill();
    }

    fn salio(&self) -> bool {
        !matches!(bloquear(&self.hijo).try_wait(), Ok(None))
    }
}

struct Proceso {
    generacion: u64,
    conversacion: String,
    /// `None`: stdin cerrado (inactividad, `chat_cerrar` u otra conversación); termina su turno y sale.
    entrada: Arc<Mutex<Option<ChildStdin>>>,
    vivo: Arc<Vivo>,
    turno: Option<Turno>,
    ultimo_uso: Instant,
    interrupciones: u64,
}

impl Proceso {
    fn turno_activo(&self) -> bool {
        self.turno.as_ref().is_some_and(Turno::activo)
    }

    fn escribir(&self, linea: &Value) -> bool {
        escribir_linea(&self.entrada, linea)
    }

    fn interrumpir(&mut self) {
        self.interrupciones += 1;
        let _ = self.escribir(&pedido_frenar(self.interrupciones));
    }

    fn cerrar_entrada(&self) {
        *bloquear(&self.entrada) = None;
    }
}

fn escribir_linea(entrada: &Mutex<Option<ChildStdin>>, linea: &Value) -> bool {
    let mut e = bloquear(entrada);
    let Some(stdin) = e.as_mut() else { return false };
    let mut texto = linea.to_string();
    texto.push('\n');
    stdin.write_all(texto.as_bytes()).and_then(|()| stdin.flush()).is_ok()
}

#[derive(Default)]
struct Estado {
    conversaciones: HashMap<String, Conversacion>,
    /// El proceso de la conversación actual (D20).
    proceso: Option<Proceso>,
    /// Los que terminan su turno con stdin cerrado después de cambiar de conversación.
    saliendo: Vec<Proceso>,
    generacion: u64,
}

impl Estado {
    fn proceso_mut(&mut self, generacion: u64) -> Option<&mut Proceso> {
        self.proceso.iter_mut().chain(self.saliendo.iter_mut()).find(|p| p.generacion == generacion)
    }

    /// Saca el proceso actual del lugar: cierra su stdin y, si sigue un turno, lo deja terminar.
    fn retirar(&mut self) {
        if let Some(p) = self.proceso.take() {
            p.cerrar_entrada();
            self.saliendo.push(p);
        }
    }
}

struct Interno {
    carpeta: PathBuf,
    lanzador: Lanzador,
    emitir: Emisor,
    tiempos: Tiempos,
    estado: Mutex<Estado>,
    apagado: AtomicBool,
}

/// El chat: las conversaciones conocidas y el proceso vivo.
#[derive(Clone)]
pub struct Chat(Arc<Interno>);

/// El de la aplicación (lo pone `lib.rs` al arrancar, con `<config>/chat`).
pub static CHAT: OnceLock<Chat> = OnceLock::new();

fn bloquear<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

fn con_turno(conversacion: &str, turno: u64, ev: &EventoChat) -> Value {
    let mut v = ev.a_json();
    v["conversacion"] = json!(conversacion);
    v["turno"] = json!(turno);
    v
}

impl Chat {
    pub fn nuevo(carpeta: PathBuf, lanzador: Lanzador, emitir: Emisor, tiempos: Tiempos) -> Chat {
        Chat(Arc::new(Interno { carpeta, lanzador, emitir, tiempos, estado: Mutex::new(Estado::default()), apagado: AtomicBool::new(false) }))
    }

    fn estado(&self) -> MutexGuard<'_, Estado> {
        bloquear(&self.0.estado)
    }

    /// `chat_abrir` (7.8): conoce la conversación y, con el motor Claude Code, precalienta el
    /// proceso sin mandarle nada (D19). `{ proceso: "arrancando" | "listo" | "apagado", sesion, motivo? }`.
    pub fn abrir(&self, conversacion: &str, motor: &str, carpeta: Option<PathBuf>, mascota: &str, sesion_claude: Option<String>) -> Result<Value, String> {
        if !conversacion_valida(conversacion) {
            return Err(String::from("id de conversación inválido"));
        }
        if sesion_claude.as_deref().is_some_and(|s| !sesion_valida(s)) {
            return Err(String::from("id de sesión de Claude Code inválido"));
        }
        let cwd = match carpeta {
            Some(c) if c.is_dir() => c,
            Some(_) => return Err(String::from("la carpeta no existe")),
            None => {
                let c = carpeta_trabajo(&self.0.carpeta);
                fs::create_dir_all(&c).map_err(|e| format!("no se pudo crear la carpeta de trabajo: {e}"))?;
                c
            }
        };
        let mascota = nombre_mascota(mascota);
        let mut e = self.estado();
        match e.conversaciones.get_mut(conversacion) {
            Some(c) if c.usada && c.cwd != cwd => return Err(String::from("la carpeta de una charla con mensajes no cambia")),
            Some(c) if !c.usada => {
                // Vacía: la cabecera cambia (D8) y la mascota es la del primer mensaje
                c.cwd = cwd;
                c.mascota = mascota;
            }
            Some(_) => {}
            None => {
                let usada = sesion_claude.is_some();
                let sesion = sesion_claude.unwrap_or_else(nuevo_uuid);
                e.conversaciones.insert(conversacion.to_string(), Conversacion { sesion, usada, cwd, mascota, firma: None });
            }
        }
        let sesion = e.conversaciones[conversacion].sesion.clone();
        if motor != "claude" {
            return Ok(json!({ "proceso": "apagado", "sesion": sesion }));
        }
        if e.proceso.as_ref().is_some_and(|p| p.conversacion != conversacion) {
            e.retirar();
        }
        if let Some(p) = &e.proceso {
            if !p.vivo.salio() && bloquear(&p.entrada).is_some() {
                let usada = e.conversaciones[conversacion].usada;
                return Ok(json!({ "proceso": if usada { "listo" } else { "arrancando" }, "sesion": sesion }));
            }
        }
        match self.lanzar(&mut e, conversacion) {
            Ok(()) => Ok(json!({ "proceso": "arrancando", "sesion": sesion })),
            Err(detalle) => {
                registrar(&format!("chat: no se pudo lanzar claude: {detalle}"));
                Ok(json!({ "proceso": "apagado", "sesion": sesion, "motivo": "sin-claude" }))
            }
        }
    }

    /// Lanza el proceso de la conversación (el lugar tiene que estar libre o con uno que ya no sirve).
    fn lanzar(&self, e: &mut Estado, conversacion: &str) -> Result<(), String> {
        if self.0.apagado.load(Ordering::SeqCst) {
            return Err(String::from("Avis se está cerrando"));
        }
        e.retirar();
        let c = e.conversaciones.get(conversacion).ok_or("conversación desconocida")?;
        let ajustes = escribir_ajustes(&self.0.carpeta).map_err(|e| format!("ajustes.json: {e}"))?;
        let sesion = if c.usada { Sesion::Retomar(c.sesion.clone()) } else { Sesion::Nueva(c.sesion.clone()) };
        let l = Lanzamiento { args: argumentos_chat(&Pedido { ajustes: &ajustes, mascota: &c.mascota, sesion: &sesion }), cwd: c.cwd.clone() };
        let mut comando = (self.0.lanzador)(&l).map_err(|e| e.to_string())?;
        comando.current_dir(&l.cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut hijo = comando.spawn().map_err(|e| e.to_string())?;
        let trabajo = Trabajo::para(&hijo);
        let (Some(stdin), Some(stdout), Some(stderr)) = (hijo.stdin.take(), hijo.stdout.take(), hijo.stderr.take()) else {
            let _ = hijo.kill();
            return Err(String::from("sin stdio"));
        };
        e.generacion += 1;
        let generacion = e.generacion;
        let vivo = Arc::new(Vivo { hijo: Mutex::new(hijo), trabajo });
        let (tx, rx) = mpsc::channel();
        leer_stdout(stdout, tx.clone());
        leer_stderr(stderr, tx);
        let chat = self.clone();
        let para_hilo = vivo.clone();
        std::thread::Builder::new()
            .name(String::from("avis-chat"))
            .spawn(move || chat.vigilar(generacion, para_hilo, rx))
            .map_err(|e| e.to_string())?;
        registrar(&format!("chat: claude lanzado ({})", if c.usada { "retoma" } else { "nueva" }));
        e.proceso = Some(Proceso { generacion, conversacion: conversacion.to_string(), entrada: Arc::new(Mutex::new(Some(stdin))), vivo, turno: None, ultimo_uso: Instant::now(), interrupciones: 0 });
        Ok(())
    }

    /// `chat_enviar` (7.4): manda un turno. Sin un turno en curso (D7) y con texto.
    pub fn enviar(&self, conversacion: &str, turno: u64, texto: &str, datos: &Value) -> Result<(), String> {
        let texto = texto.trim();
        if texto.is_empty() {
            return Err(String::from("el mensaje está vacío"));
        }
        if texto.chars().count() > MAX_TEXTO {
            return Err(String::from("el mensaje es demasiado largo"));
        }
        let mut e = self.estado();
        if !e.conversaciones.contains_key(conversacion) {
            return Err(String::from("la charla no está abierta"));
        }
        if e.proceso.as_ref().is_some_and(|p| p.conversacion == conversacion && p.turno_activo()) {
            return Err(String::from("hay una respuesta en curso"));
        }
        let sirve = e.proceso.as_ref().is_some_and(|p| p.conversacion == conversacion && !p.vivo.salio() && bloquear(&p.entrada).is_some());
        if !sirve {
            if let Err(detalle) = self.lanzar(&mut e, conversacion) {
                registrar(&format!("chat: no se pudo lanzar claude: {detalle}"));
                drop(e);
                (self.0.emitir)(con_turno(conversacion, turno, &EventoChat::Error { motivo: "sin-claude", detalle: None }));
                return Ok(());
            }
        }
        let c = e.conversaciones.get_mut(conversacion).ok_or("la charla no está abierta")?;
        let (avis, firma) = bloque_avis(datos, c.firma);
        c.firma = firma;
        let linea = mensaje_usuario(texto, avis.as_deref());
        let p = e.proceso.as_mut().ok_or("sin proceso")?;
        p.turno = Some(Turno::nuevo(turno, Instant::now()));
        p.ultimo_uso = Instant::now();
        let entrada = p.entrada.clone();
        let generacion = p.generacion;
        drop(e);
        // Fuera del candado: con adjuntos la línea puede pesar 20 MB
        if !escribir_linea(&entrada, &linea) {
            self.cortar(generacion, "proceso", true);
        }
        Ok(())
    }

    /// `chat_frenar` (7.6): solo el turno en curso de esa conversación.
    pub fn frenar(&self, conversacion: &str, turno: u64) {
        let mut e = self.estado();
        let Some(p) = e.proceso.as_mut().filter(|p| p.conversacion == conversacion) else { return };
        let mandar = p.turno.as_mut().filter(|t| t.numero == turno).is_some_and(Turno::frenar);
        if mandar {
            p.interrumpir();
        }
    }

    /// `chat_cerrar`: cierra stdin. Un turno en curso termina igual y el proceso sale solo.
    pub fn cerrar(&self, conversacion: &str) {
        if let Some(p) = self.estado().proceso.as_ref().filter(|p| p.conversacion == conversacion) {
            p.cerrar_entrada();
        }
    }

    /// ¿Hay un proceso vivo de esa conversación?
    #[cfg(test)]
    pub fn vivo(&self, conversacion: &str) -> bool {
        self.estado().proceso.as_ref().is_some_and(|p| p.conversacion == conversacion && !p.vivo.salio())
    }

    /// Al salir de Avis (7.3): la interrupción si hay un turno, cerrar stdin, esperar y matar.
    pub fn apagar(&self) {
        self.0.apagado.store(true, Ordering::SeqCst);
        let vivos: Vec<Arc<Vivo>> = {
            let mut e = self.estado();
            e.retirar();
            for p in e.saliendo.iter_mut() {
                if p.turno_activo() {
                    p.interrumpir();
                }
                p.cerrar_entrada();
            }
            e.saliendo.iter().map(|p| p.vivo.clone()).collect()
        };
        let limite = Instant::now() + self.0.tiempos.salida;
        while vivos.iter().any(|v| !v.salio()) && Instant::now() < limite {
            std::thread::sleep(Duration::from_millis(50));
        }
        for v in &vivos {
            if !v.salio() {
                v.matar();
            }
        }
    }

    /// Termina el turno en curso de ese proceso con un error propio y, si se pide, lo mata.
    fn cortar(&self, generacion: u64, motivo: &'static str, matar: bool) {
        let salida = {
            let mut e = self.estado();
            let Some(p) = e.proceso_mut(generacion) else { return };
            if matar {
                p.vivo.matar();
            }
            let conversacion = p.conversacion.clone();
            let ev = p.turno.as_mut().and_then(|t| t.cortar(motivo).map(|ev| (t.numero, ev)));
            if ev.is_some() {
                if let Some(c) = e.conversaciones.get_mut(&conversacion) {
                    c.firma = None;
                }
            }
            ev.map(|(n, ev)| con_turno(&conversacion, n, &ev))
        };
        if let Some(v) = salida {
            (self.0.emitir)(v);
        }
    }

    /// El hilo de cada proceso: junta el texto, emite, vigila el eco y la inactividad, y al final
    /// espera la salida.
    fn vigilar(&self, generacion: u64, vivo: Arc<Vivo>, rx: Receiver<Linea>) {
        let mut juntador = Juntador::default();
        let mut destino: Option<(String, u64)> = None;
        loop {
            let espera = juntador.espera(Instant::now()).unwrap_or(Duration::from_millis(250)).min(Duration::from_millis(250));
            match rx.recv_timeout(espera) {
                Ok(Linea::Evento(ev)) => self.al_evento(generacion, ev, &mut juntador, &mut destino),
                Ok(Linea::SesionEnUso) => self.sesion_en_uso(generacion),
                Ok(Linea::Fin) | Err(RecvTimeoutError::Disconnected) => break,
                Err(RecvTimeoutError::Timeout) => {}
            }
            let ahora = Instant::now();
            if juntador.vencido(ahora) {
                self.soltar_texto(&mut juntador, &destino);
            }
            self.revisar(generacion, ahora);
        }
        self.soltar_texto(&mut juntador, &destino);
        // stdout cerró: el proceso está saliendo
        let limite = Instant::now() + Duration::from_secs(5);
        while !vivo.salio() && Instant::now() < limite {
            std::thread::sleep(Duration::from_millis(50));
        }
        if !vivo.salio() {
            vivo.matar();
        }
        self.cortar(generacion, "proceso", false);
        let mut e = self.estado();
        if e.proceso.as_ref().is_some_and(|p| p.generacion == generacion) {
            e.proceso = None;
        }
        e.saliendo.retain(|p| p.generacion != generacion);
        let codigo = bloquear(&vivo.hijo).try_wait().ok().flatten().and_then(|s| s.code());
        registrar(&format!("chat: claude salió (código {codigo:?})"));
    }

    fn soltar_texto(&self, juntador: &mut Juntador, destino: &Option<(String, u64)>) {
        if let (Some(texto), Some((conversacion, turno))) = (juntador.sacar(), destino) {
            (self.0.emitir)(con_turno(conversacion, *turno, &EventoChat::Texto { texto }));
        }
    }

    fn al_evento(&self, generacion: u64, ev: EventoChat, juntador: &mut Juntador, destino: &mut Option<(String, u64)>) {
        let salida = {
            let mut e = self.estado();
            let Some(p) = e.proceso_mut(generacion) else { return };
            p.ultimo_uso = Instant::now();
            let conversacion = p.conversacion.clone();
            let Some(t) = p.turno.as_mut() else { return };
            let numero = t.numero;
            let r = t.al_evento(ev.clone());
            if r.interrumpir {
                p.interrumpir();
            }
            // Ya tuvo un turno: la próxima vez se retoma
            let usada = matches!(ev, EventoChat::Listo { .. } | EventoChat::Recibido);
            let fallo = r.emitir.iter().any(|x| matches!(x, EventoChat::Error { .. }));
            if let Some(c) = e.conversaciones.get_mut(&conversacion) {
                c.usada |= usada;
                if fallo {
                    c.firma = None;
                }
            }
            (conversacion, numero, r.emitir)
        };
        let (conversacion, numero, emitir) = salida;
        *destino = Some((conversacion.clone(), numero));
        for ev in emitir {
            match ev {
                EventoChat::Texto { texto } => juntador.agregar(&texto, Instant::now()),
                otro => {
                    self.soltar_texto(juntador, destino);
                    (self.0.emitir)(con_turno(&conversacion, numero, &otro));
                }
            }
        }
    }

    fn sesion_en_uso(&self, generacion: u64) {
        let mut e = self.estado();
        let Some(conversacion) = e.proceso_mut(generacion).map(|p| p.conversacion.clone()) else { return };
        if let Some(c) = e.conversaciones.get_mut(&conversacion) {
            c.usada = true;
        }
    }

    /// Cada vuelta: el eco de 15 s del turno en curso y la inactividad sin turno.
    fn revisar(&self, generacion: u64, ahora: Instant) {
        let sin_eco = {
            let e = self.estado();
            let Some(p) = e.proceso.iter().chain(e.saliendo.iter()).find(|p| p.generacion == generacion) else { return };
            match &p.turno {
                Some(t) if t.activo() => t.sin_noticias(ahora, self.0.tiempos.eco),
                _ => {
                    if ahora.duration_since(p.ultimo_uso) >= self.0.tiempos.inactividad {
                        if bloquear(&p.entrada).is_some() {
                            registrar("chat: sin uso, se cierra stdin");
                        }
                        p.cerrar_entrada();
                    }
                    false
                }
            }
        };
        if sin_eco {
            registrar("chat: el mensaje no tuvo eco, se corta el proceso");
            self.cortar(generacion, "proceso", true);
        }
    }
}

/// Lee stdout línea a línea, sin tope chico (el eco de un PDF es una línea de 20 MB), y manda solo
/// los eventos. Nunca guarda ni anota las líneas.
fn leer_stdout(stdout: std::process::ChildStdout, tx: Sender<Linea>) {
    let _ = std::thread::Builder::new().name(String::from("avis-chat-stdout")).spawn(move || {
        let mut lector = BufReader::with_capacity(64 * 1024, stdout);
        let mut linea = Vec::new();
        loop {
            linea.clear();
            match lector.read_until(b'\n', &mut linea) {
                Ok(0) | Err(_) => break,
                Ok(_) => {}
            }
            let ev = std::str::from_utf8(&linea).ok().and_then(evento_de_texto);
            if linea.capacity() > 1024 * 1024 {
                linea = Vec::new();
            }
            if let Some(ev) = ev {
                if tx.send(Linea::Evento(ev)).is_err() {
                    break;
                }
            }
        }
        let _ = tx.send(Linea::Fin);
    });
}

/// stderr va al log (siempre trae el aviso de MCP bloqueados, que no es un error).
fn leer_stderr(stderr: std::process::ChildStderr, tx: Sender<Linea>) {
    let _ = std::thread::Builder::new().name(String::from("avis-chat-stderr")).spawn(move || {
        let lector = BufReader::new(stderr);
        for linea in lector.lines() {
            let Ok(linea) = linea else { break };
            if linea.trim().is_empty() {
                continue;
            }
            if linea.contains("is already in use") {
                let _ = tx.send(Linea::SesionEnUso);
            }
            registrar(&format!("chat stderr: {}", linea.chars().take(200).collect::<String>()));
        }
    });
}

#[cfg(not(test))]
fn registrar(linea: &str) {
    if let Some(ruta) = crate::diagnostico::ruta_log() {
        let _ = crate::diagnostico::agregar_linea(&ruta, linea, chrono::Utc::now(), crate::diagnostico::TOPE_BYTES);
    }
}

#[cfg(test)]
fn registrar(_linea: &str) {}

fn semilla() -> u64 {
    static CONTADOR: AtomicU64 = AtomicU64::new(0);
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u64(CONTADOR.fetch_add(1, Ordering::Relaxed));
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or_default());
    h.finish()
}

#[cfg(test)]
#[path = "chat_tests.rs"]
mod tests;
