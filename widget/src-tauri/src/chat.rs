//! La charla con la mascota por Claude Code (#22, docs/diseno/chat-avis-ux.md 7): un proceso
//! `claude -p` de larga vida por conversación, que solo responde.
//!
//! Reglas firmes (7.1, 7.2 y 11):
//! - Los argumentos son fijos (`argumentos_chat`) y los fijan los tests: `--permission-mode manual`
//!   y `--tools Read,Glob,Grep` son la barrera real (el usuario tiene `bypassPermissions`), sin los MCP
//!   del usuario (`--strict-mcp-config`), sin hooks, sin plugins del usuario y con `--restricted`.
//!   `--restricted` reemplazó a `--safe-mode` en #43: `--safe-mode` apaga también `--mcp-config` (M-H2).
//!   Además encierra Read, Glob y Grep en la carpeta de trabajo: lo de afuera da `permission_denied`
//!   («--restricted: path outside the working directory»), medido el 25/11. Los adjuntos no pasan por
//!   ahí (Rust los lee y los manda como bloques).
//!   Cualquier herramienta nueva vuelve a diseño: la única vuelta fue #43 (docs/diseno/chat-herramientas-ux.md),
//!   que suma el servidor de Avis (`mcp_avis.rs`) con sus cinco herramientas de tareas y (C3) las dos de
//!   hábitos, por nombre exacto en `--allowedTools` y con un token por lanzamiento (`Mcp`).
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

use crate::adjuntos;
use crate::chat_local::{self, Avance, FinLectura, MotorLocal};
use crate::mcp_avis::{self, McpAvis};
use crate::modelo;
use crate::primeros_pasos::{self, trabajo::Trabajo, Programa};

/// Evento a la ventana (7.5): `{ conversacion, turno, tipo, ... }`.
pub const EVENTO: &str = "oficina://chat";

/// Las instrucciones de sistema (4.3), con `{Mascota}` en lugar del nombre. Una sola línea: viaja
/// como argumento.
/// #43 (chat-herramientas-ux.md 11.3) la reemplazó: suma las herramientas de tareas de Avis, y C3 las
/// de hábitos («ver, anotar, editar y tildar las tareas de Avis y ver y marcar los hábitos de hoy»: las
/// dos sustituciones de 11.3 aplicadas al pie de la letra rompían la frase; ver la nota de 11.3). La última frase es de #44 (L9 de Proyectos, decisión
/// de Quintana del 25/11): medido, Haiku dejaba de leer la carpeta después de un turno sin herramientas
/// («solo tengo las de Avis»).
pub const INSTRUCCION_CHAT: &str = "Sos {Mascota}, la mascota de Avis, el panel que muestra en qué anda Claude Code. \
Respondés en español rioplatense, de vos, breve y concreto. \
No modificás archivos ni corrés comandos (no tenés esas herramientas). \
Sí podés ver, anotar, editar y tildar las tareas de Avis y ver y marcar los hábitos de hoy con tus herramientas de Avis: usalas solo cuando el usuario lo pida y después confirmá en una frase corta qué hiciste, sin repetir los detalles (Avis muestra cada cambio con «Deshacer»). \
Nunca borrás: si te piden borrar una tarea, usá tarea_mostrar con para \"borrar\" y decí que el borrado lo hace el usuario con un clic. \
Para saber qué día es hoy, usá tareas_ver. \
Si te piden algo que requiere actuar fuera de eso, explicá qué haría falta. \
Cuando el mensaje traiga un bloque `<avis>`, son los datos en vivo de las sesiones: usalos para responder sobre ellas. \
Usá Markdown simple (títulos, listas, código). \
Podés leer los archivos de la carpeta de trabajo con Read, Glob y Grep cuando la pregunta lo pida.";

/// Las únicas herramientas propias de Claude Code en el chat (7.1): solo leer.
pub const HERRAMIENTAS: &str = "Read,Glob,Grep";
/// Las de Avis (#43, 11.2): la lista exacta, sin comodín (D-c5). `--tools` no las filtra (M-H3), así
/// que van solo en `--allowedTools`; lo que no está acá, Claude Code lo niega solo (M-H4).
/// C3 suma exactamente las dos de hábitos.
pub const HERRAMIENTAS_AVIS: &str = "mcp__avis__tareas_ver,mcp__avis__tarea_crear,mcp__avis__tarea_editar,mcp__avis__tarea_tildar,mcp__avis__tarea_mostrar,mcp__avis__habitos_ver,mcp__avis__habito_marcar";
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

/// Los modelos que se pueden elegir para la charla (#35), con el alias que entiende `--model`.
/// Sin modelo es "Por defecto" (el de Claude Code). La misma lista para el chat, las preferencias
/// y el historial.
pub const MODELOS: [&str; 4] = ["fable", "opus", "sonnet", "haiku"];

/// ¿Es uno de `MODELOS` (texto exacto)?
pub fn modelo_valido(m: &str) -> bool {
    MODELOS.contains(&m)
}

/// El servidor de Avis para un lanzamiento (#43, 11.2): su puerto en 127.0.0.1 y el token de ese proceso.
#[derive(Clone)]
pub struct Mcp {
    pub puerto: u16,
    pub token: String,
}

pub struct Pedido<'a> {
    pub ajustes: &'a Path,
    pub mascota: &'a str,
    /// El nombre del usuario (#37), o `None` si no cargó uno.
    pub usuario: Option<&'a str>,
    pub sesion: &'a Sesion,
    /// Uno de `MODELOS`, o `None` ("Por defecto").
    pub modelo: Option<&'a str>,
    /// El servidor de las herramientas de Avis (#43); sin él, los argumentos de antes.
    pub mcp: Option<&'a Mcp>,
    /// El archivo con las instrucciones del proyecto (#44, proyectos-ux.md 11.4, camino A); sin
    /// proyecto (o sin instrucciones), `None` y los argumentos de antes.
    pub sistema: Option<&'a Path>,
}

/// `INSTRUCCION_CHAT` con el nombre de la mascota y, si hay, el del usuario (#37 S3).
pub fn instruccion_chat(mascota: &str, usuario: Option<&str>) -> String {
    format!("{}{}", INSTRUCCION_CHAT.replace("{Mascota}", &nombre_mascota(mascota)), frase_usuario(usuario))
}

/// La frase que agrega el nombre del usuario a las instrucciones (con Claude Code y con el modelo
/// local), con un espacio adelante; vacía si no hay nombre o no sirve.
pub fn frase_usuario(usuario: Option<&str>) -> String {
    match usuario.and_then(nombre_usuario) {
        Some(u) => format!(" La persona se llama {u}: llamala por su nombre."),
        None => String::new(),
    }
}

/// El nombre del usuario que manda la ventana, sin espacios de más; `None` si viene vacío, largo
/// (más de 40 caracteres) o con caracteres de control (#37 S4).
pub fn nombre_usuario(nombre: &str) -> Option<String> {
    let n = nombre.trim();
    (!n.is_empty() && n.chars().count() <= 40 && !n.chars().any(char::is_control)).then(|| n.to_string())
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

/// `--mcp-config` como texto JSON en el argumento (M-H1: Claude Code lo lee así en Windows), con
/// las claves en el orden de 11.2. El token es hexadecimal y el puerto un número: nada que escapar.
pub fn config_mcp(m: &Mcp) -> String {
    format!(r#"{{"mcpServers":{{"avis":{{"type":"http","url":"http://127.0.0.1:{}/mcp","headers":{{"Authorization":"Bearer {}"}}}}}}}}"#, m.puerto, m.token)
}

/// La lista fija de 7.1; con el servidor de Avis (#43, 11.2), sus herramientas por nombre exacto en
/// `--allowedTools` y `--mcp-config` justo antes de `--settings` (es variádico).
pub fn argumentos_chat(p: &Pedido) -> Vec<String> {
    let permitidas = match p.mcp {
        Some(_) => format!("{HERRAMIENTAS},{HERRAMIENTAS_AVIS}"),
        None => String::from(HERRAMIENTAS),
    };
    let mut a: Vec<String> = [
        "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--include-partial-messages", "--replay-user-messages",
        "--permission-mode", "manual",
        "--tools", HERRAMIENTAS, "--allowedTools", &permitidas,
        "--permission-prompts", "none", "--restricted", "--strict-mcp-config",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    if let Some(m) = p.mcp {
        a.push(String::from("--mcp-config"));
        a.push(config_mcp(m));
    }
    a.push(String::from("--settings"));
    a.push(p.ajustes.to_string_lossy().into_owned());
    a.push(String::from("--append-system-prompt"));
    a.push(instruccion_chat(p.mascota, p.usuario));
    // #44 (11.4, camino A, medido en M-P1): las instrucciones del proyecto, de varias líneas, en un
    // archivo aparte; `INSTRUCCION_CHAT` sigue en una sola línea
    if let Some(r) = p.sistema {
        a.push(String::from("--append-system-prompt-file"));
        a.push(r.to_string_lossy().into_owned());
    }
    a.push(String::from("--max-budget-usd"));
    a.push(String::from(TOPE_USD));
    // #35 (S3): "Por defecto" no pasa `--model`; un alias, sí (Claude Code lo resuelve al último de
    // su familia). Reemplaza D17 ("Sin `--model`").
    if let Some(m) = p.modelo {
        a.extend([String::from("--model"), m.to_string()]);
    }
    match p.sesion {
        Sesion::Nueva(id) => a.extend([String::from("--session-id"), id.clone()]),
        Sesion::Retomar(id) => a.extend([String::from("--resume"), id.clone()]),
    }
    a
}

// ------------------------------------------------------------------ proyectos (#44, proyectos-ux.md 11.4)

/// Saca `<proyecto` y `</proyecto>` (sin distinguir mayúsculas) hasta que no quede ninguno: el texto del
/// usuario nunca abre ni cierra el bloque.
fn sin_etiquetas_proyecto(s: &str) -> String {
    let mut t = s.to_string();
    loop {
        let bajo = t.to_ascii_lowercase();
        let Some((i, largo)) = bajo.find("</proyecto>").map(|i| (i, 11)).or_else(|| bajo.find("<proyecto").map(|i| (i, 9))) else { return t };
        t.replace_range(i..i + largo, "");
    }
}

/// El nombre del proyecto dentro del bloque: `"` → `'` (11.4) y sin saltos de línea.
fn nombre_en_bloque(nombre: &str) -> String {
    nombre.replace('"', "'").chars().map(|c| if c.is_control() { ' ' } else { c }).collect()
}

/// El bloque del proyecto de 11.4: las instrucciones (sin las etiquetas) entre `<proyecto nombre="…">` y
/// `</proyecto>`, y la frase que dice de quién son. `con_carpeta`: Claude Code (lee la carpeta); el
/// motor local va sin esa parte.
pub fn texto_proyecto(nombre: &str, instrucciones: &str, con_carpeta: bool) -> String {
    let nombre = nombre_en_bloque(nombre);
    let carpeta = if con_carpeta { " La carpeta de trabajo es la del proyecto: leé sus archivos solo cuando la pregunta lo necesite." } else { "" };
    format!(
        "<proyecto nombre=\"{nombre}\">\n{}\n</proyecto>\nEstás en el proyecto «{nombre}». Las instrucciones de arriba son del usuario para este proyecto.{carpeta}\n",
        sin_etiquetas_proyecto(instrucciones)
    )
}

/// Lo que la charla necesita de un proyecto (11.4), leído en Rust del archivo del proyecto: la ventana
/// manda solo el id, nunca una ruta (11.2).
#[derive(Clone, Debug, PartialEq)]
pub struct ProyectoChat {
    pub id: String,
    pub nombre: String,
    pub color: String,
    pub instrucciones: String,
    /// La carpeta del proyecto si existe; si no (perdida o sin carpeta), `None`: la charla corre en la
    /// carpeta de trabajo vacía (8.4, D-p14).
    pub carpeta: Option<PathBuf>,
    /// `ok`, `perdida` o `sin` (como `proyectos::con_estado`).
    pub estado: String,
    pub nombre_carpeta: String,
    pub ruta: String,
}

impl ProyectoChat {
    /// Lo que devuelve `chat_abrir` (11.4): `{ id, nombre, color, carpeta: { nombre, ruta, estado } }`.
    pub fn a_json(&self) -> Value {
        json!({ "id": self.id, "nombre": self.nombre, "color": self.color, "carpeta": { "nombre": self.nombre_carpeta, "ruta": self.ruta, "estado": self.estado } })
    }

    /// El texto del archivo de sistema (camino A), o `None` sin instrucciones: sin ellas la charla es
    /// como siempre, en la carpeta del proyecto.
    fn sistema(&self) -> Option<String> {
        (!self.instrucciones.trim().is_empty()).then(|| texto_proyecto(&self.nombre, &self.instrucciones, true))
    }
}

/// Lee el proyecto `id` de `<config>/proyectos` para la charla. Un id inválido, un proyecto que no está o
/// un archivo roto: «el proyecto no existe» (11.4).
pub fn leer_proyecto(carpeta_proyectos: &Path, id: &str) -> Result<ProyectoChat, String> {
    let d = crate::proyectos::leer(carpeta_proyectos, id).map_err(|_| String::from("el proyecto no existe"))?;
    let v = crate::proyectos::con_estado(&d);
    let c = &v["carpeta"];
    let estado = c["estado"].as_str().unwrap_or("sin").to_string();
    let ruta = c["ruta"].as_str().unwrap_or_default().to_string();
    let carpeta = (estado == "ok").then(|| PathBuf::from(&ruta));
    Ok(ProyectoChat {
        id: id.to_string(),
        nombre: v["nombre"].as_str().unwrap_or_default().to_string(),
        color: v["color"].as_str().unwrap_or_default().to_string(),
        instrucciones: v["instrucciones"].as_str().unwrap_or_default().to_string(),
        carpeta,
        estado,
        nombre_carpeta: c["nombre"].as_str().unwrap_or_default().to_string(),
        ruta,
    })
}

/// `<config>/chat/sistema/<conversacion>.txt`: el archivo de las instrucciones del proyecto (11.4, camino A).
pub fn ruta_sistema(carpeta_chat: &Path, conversacion: &str) -> PathBuf {
    carpeta_chat.join("sistema").join(format!("{conversacion}.txt"))
}

/// Borra los archivos de sistema que quedaron (`<config>/chat/sistema/*.txt`): al arrancar y al salir de
/// Avis (B1 de P2). Lo que no es un `.txt` de esa carpeta queda.
pub fn limpiar_sistema(carpeta_chat: &Path) {
    let Ok(entradas) = fs::read_dir(carpeta_chat.join("sistema")) else { return };
    for e in entradas.filter_map(Result::ok) {
        if e.path().extension().is_some_and(|x| x == "txt") && e.file_type().is_ok_and(|t| t.is_file()) {
            let _ = fs::remove_file(e.path());
        }
    }
}

/// La firma de un texto (como la de `bloque_avis`): `DefaultHasher::new()` tiene claves fijas.
fn firma_texto(t: &str) -> u64 {
    let mut h = std::collections::hash_map::DefaultHasher::new();
    h.write(t.as_bytes());
    h.finish()
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

/// Una línea de stdout de Claude Code → el primero de sus eventos (`eventos_de_linea`), o `None`.
#[cfg(test)]
pub fn evento_de_linea(v: &Value) -> Option<EventoChat> {
    eventos_de_linea(v).into_iter().next()
}

/// Una línea de stdout de Claude Code → sus eventos para la ventana (ninguno si no le importa). Un
/// mensaje con varios `tool_use` da uno por cada uno (#43, 16; M-H8).
pub fn eventos_de_linea(v: &Value) -> Vec<EventoChat> {
    if v["type"] == "assistant" {
        return v["message"]["content"]
            .as_array()
            .map(|c| {
                c.iter()
                    .filter(|c| c["type"] == "tool_use")
                    .map(|c| {
                        let nombre = c["name"].as_str().unwrap_or_default().to_string();
                        let detalle = detalle_herramienta(&nombre, &c["input"]);
                        EventoChat::Herramienta { nombre, detalle }
                    })
                    .collect()
            })
            .unwrap_or_default();
    }
    uno_de_linea(v).into_iter().collect()
}

/// Lo que no es un `assistant`: un evento o ninguno.
fn uno_de_linea(v: &Value) -> Option<EventoChat> {
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

/// Lo mismo desde el texto de la línea: un JSON roto o una línea suelta es `None`. (`leer_stdout` hace
/// lo mismo con el valor ya leído, porque además mira `sesion_perdida`.)
#[cfg(test)]
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

/// `--resume` con una sesión que Claude Code ya no tiene (medido en E4: un `result`
/// `error_during_execution` con "No conversation found…" en `errors`, y sale con código 1).
pub fn sesion_perdida(v: &Value) -> bool {
    v["type"] == "result" && v["errors"].as_array().is_some_and(|e| e.iter().any(|x| x.as_str().is_some_and(|x| x.contains("No conversation found"))))
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

/// La línea de stdin de un mensaje (7.4): el bloque `<avis>` (si va), los adjuntos (los bloques de
/// `adjuntos::bloques`, en su orden) y el texto. Sin texto (solo un archivo) no va un bloque de
/// texto vacío, que la API no acepta.
#[cfg(test)]
pub fn mensaje_usuario(texto: &str, avis: Option<&str>, adjuntos: &[Value]) -> Value {
    mensaje_usuario_con(texto, avis, &[], adjuntos)
}

/// `mensaje_usuario` con los cambios que el usuario deshizo desde el último turno (#43, 11.7): un
/// bloque con una línea `<avis-deshecho>…</avis-deshecho>` por cada uno, después de `<avis>` y antes
/// de los adjuntos y el texto, así el modelo no cree que la tarea sigue ahí.
pub fn mensaje_usuario_con(texto: &str, avis: Option<&str>, deshechos: &[String], adjuntos: &[Value]) -> Value {
    let mut contenido = Vec::new();
    if let Some(a) = avis {
        contenido.push(json!({ "type": "text", "text": format!("<avis>\n{a}\n</avis>") }));
    }
    if !deshechos.is_empty() {
        let lineas: Vec<String> = deshechos.iter().map(|d| format!("<avis-deshecho>{d}</avis-deshecho>")).collect();
        contenido.push(json!({ "type": "text", "text": lineas.join("\n") }));
    }
    contenido.extend(adjuntos.iter().cloned());
    if !texto.is_empty() || contenido.is_empty() {
        contenido.push(json!({ "type": "text", "text": texto }));
    }
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
    /// stdout: `--resume` de una sesión que Claude Code ya no tiene (medido en E4).
    SesionPerdida,
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
    /// La charla es del motor local (8): nunca lanza `claude` (regla 3), responde el modelo de esta PC.
    local: bool,
    /// El modelo elegido (#35): uno de `MODELOS`, o `None` ("Por defecto"). A diferencia del motor y
    /// la carpeta, cambia también con mensajes: la conversación sigue con `--resume`.
    modelo: Option<String>,
    /// El proyecto de la charla (#44, 11.4), releído en cada `abrir` y cada `enviar`: sus instrucciones
    /// y su carpeta pueden cambiar con la charla abierta (D-p15).
    proyecto: Option<ProyectoChat>,
}

impl Conversacion {
    /// El texto del archivo de sistema: Claude Code con un proyecto con instrucciones.
    fn sistema(&self) -> Option<String> {
        if self.local {
            return None;
        }
        self.proyecto.as_ref().and_then(ProyectoChat::sistema)
    }
}

/// El turno en curso del motor local (8): uno por vez, como los pedidos a llama-server (`-np 1`).
struct TurnoLocal {
    generacion: u64,
    conversacion: String,
    numero: u64,
    /// Frenar (o salir de Avis): el hilo deja de leer y corta la conexión; llama-server deja de generar.
    frenar: Arc<AtomicBool>,
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
    /// El modelo con que se lanzó: si la conversación cambia de modelo, el próximo uso lanza otro.
    modelo: Option<String>,
    /// La carpeta y la firma de las instrucciones del proyecto con que se lanzó (#44, 11.4): si cambian,
    /// el próximo uso lanza otro con `--resume`, como con el modelo.
    cwd: PathBuf,
    sistema: Option<u64>,
    /// El token del servidor de Avis de este lanzamiento (#43): se revoca cuando el proceso sale.
    token: Option<String>,
}

impl Proceso {
    /// ¿Se lanzó con lo que la conversación pide ahora (modelo, carpeta e instrucciones)?
    fn sirve_para(&self, c: &Conversacion) -> bool {
        // La carpeta cuenta solo en una charla de proyecto: es la única que cambia de carpeta con el proceso
        // vivo (D-p15); las demás siguen como antes de #44
        self.modelo == c.modelo && (c.proyecto.is_none() || self.cwd == c.cwd) && self.sistema == c.sistema().as_deref().map(firma_texto)
    }

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
    /// El turno del motor local que corre.
    local: Option<TurnoLocal>,
    generacion_local: u64,
    /// El nombre del usuario (#37), ya validado.
    usuario: Option<String>,
    /// Los cambios deshechos desde el último turno, por conversación (#43, 11.7): viajan una vez con
    /// el próximo mensaje.
    deshechos: HashMap<String, Vec<String>>,
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
    /// El modelo de esta PC (8): lo pone `lib.rs` con `modelo::IA`; los tests, uno falso.
    motor_local: Mutex<Option<MotorLocal>>,
    /// Las herramientas de Avis (#43): las carpetas de tareas y hábitos y el servidor, que arranca con
    /// el primer lanzamiento de `claude`.
    herramientas: Mutex<Herramientas>,
    /// `<config>/proyectos` (#44): de ahí se leen las instrucciones y la carpeta de cada charla de proyecto.
    proyectos: Mutex<Option<PathBuf>>,
}

/// Lo que hace falta para el servidor de Avis (#43): sin carpeta, la charla no tiene herramientas.
#[derive(Default)]
struct Herramientas {
    carpetas: Option<mcp_avis::Carpetas>,
    emitir_tareas: Option<Emisor>,
    emitir_habitos: Option<Emisor>,
    servidor: Option<McpAvis>,
}

/// Cuántos deshechos se guardan por conversación hasta el próximo mensaje.
const TOPE_DESHECHOS: usize = 20;

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
        Chat(Arc::new(Interno {
            carpeta,
            lanzador,
            emitir,
            tiempos,
            estado: Mutex::new(Estado::default()),
            apagado: AtomicBool::new(false),
            motor_local: Mutex::new(None),
            herramientas: Mutex::new(Herramientas::default()),
            proyectos: Mutex::new(None),
        }))
    }

    /// Las herramientas de Avis para la charla (#43): `<config>/tareas` y `<config>/habitos` (C3), y los
    /// avisos `oficina://tareas` y `oficina://habitos`. El servidor arranca recién con el primer
    /// lanzamiento de `claude` (11.1).
    pub fn poner_herramientas(&self, carpetas: mcp_avis::Carpetas, emitir_tareas: Emisor, emitir_habitos: Emisor) {
        let mut h = bloquear(&self.0.herramientas);
        h.carpetas = Some(carpetas);
        h.emitir_tareas = Some(emitir_tareas);
        h.emitir_habitos = Some(emitir_habitos);
    }

    /// El servidor de Avis, arrancado si hace falta. `None` sin herramientas o si no pudo escuchar.
    fn servidor(&self) -> Option<McpAvis> {
        let mut h = bloquear(&self.0.herramientas);
        if h.servidor.is_none() {
            let (carpetas, emitir_tareas, emitir_habitos) = (h.carpetas.clone()?, h.emitir_tareas.clone()?, h.emitir_habitos.clone()?);
            let reloj: mcp_avis::Reloj = Arc::new(|| chrono::Utc::now().timestamp_millis());
            match McpAvis::arrancar(carpetas, self.0.emitir.clone(), emitir_tareas, emitir_habitos, reloj) {
                Ok(s) => h.servidor = Some(s),
                Err(e) => {
                    registrar(&format!("chat: el servidor de Avis no arrancó: {e}"));
                    return None;
                }
            }
        }
        h.servidor.clone()
    }

    /// El servidor ya arrancado (sin arrancarlo).
    fn servidor_vivo(&self) -> Option<McpAvis> {
        bloquear(&self.0.herramientas).servidor.clone()
    }

    /// El turno de un proceso empieza o termina en el servidor de Avis (11.1: solo durante un turno).
    fn turno_mcp(&self, token: Option<&str>, turno: Option<u64>) {
        let (Some(token), Some(s)) = (token, self.servidor_vivo()) else { return };
        match turno {
            Some(n) => s.empezar_turno(token, n),
            None => s.terminar_turno(token),
        }
    }

    /// Un cambio que el usuario deshizo (`chat_deshacer`, 11.7): viaja con el próximo mensaje de esa
    /// conversación como `<avis-deshecho>`.
    pub fn anotar_deshecho(&self, conversacion: &str, linea: &str) {
        let mut e = self.estado();
        let lista = e.deshechos.entry(conversacion.to_string()).or_default();
        if lista.len() < TOPE_DESHECHOS {
            lista.push(linea.chars().take(300).collect());
        }
    }

    /// `<config>/proyectos` (#44): sin esto, una charla de proyecto es un error («el proyecto no existe»).
    pub fn poner_proyectos(&self, carpeta: PathBuf) {
        *bloquear(&self.0.proyectos) = Some(carpeta);
    }

    /// El proyecto `id` leído del disco (11.4).
    fn proyecto(&self, id: &str) -> Result<ProyectoChat, String> {
        let carpeta = bloquear(&self.0.proyectos).clone().ok_or_else(|| String::from("el proyecto no existe"))?;
        leer_proyecto(&carpeta, id)
    }

    /// La carpeta de trabajo vacía de Avis, creada si hace falta.
    fn trabajo(&self) -> Result<PathBuf, String> {
        let c = carpeta_trabajo(&self.0.carpeta);
        fs::create_dir_all(&c).map_err(|e| format!("no se pudo crear la carpeta de trabajo: {e}"))?;
        Ok(c)
    }

    /// Relee el proyecto de una charla antes de un envío: sus instrucciones o su carpeta pudieron cambiar
    /// con la charla abierta (11.4). Si no se puede leer, sigue con lo último que se leyó.
    fn refrescar_proyecto(&self, conversacion: &str) {
        let Some(id) = self.estado().conversaciones.get(conversacion).and_then(|c| c.proyecto.as_ref().map(|p| p.id.clone())) else { return };
        let leido = match self.proyecto(&id) {
            Ok(p) => p,
            Err(e) => {
                registrar(&format!("chat: no se pudo releer el proyecto de la charla ({e})"));
                return;
            }
        };
        let cwd = match leido.carpeta.clone() {
            Some(c) => c,
            None => match self.trabajo() {
                Ok(c) => c,
                Err(_) => return,
            },
        };
        if let Some(c) = self.estado().conversaciones.get_mut(conversacion) {
            if !c.local {
                c.cwd = cwd;
            }
            c.proyecto = Some(leido);
        }
    }

    /// El modelo de esta PC para las charlas del motor local (8).
    pub fn poner_motor_local(&self, motor: MotorLocal) {
        *bloquear(&self.0.motor_local) = Some(motor);
    }

    /// El nombre del usuario (#37): lo toma el próximo proceso de Claude Code y el próximo turno del
    /// motor local. Vacío o raro, ninguno.
    pub fn poner_usuario(&self, nombre: &str) {
        self.estado().usuario = nombre_usuario(nombre);
    }

    fn estado(&self) -> MutexGuard<'_, Estado> {
        bloquear(&self.0.estado)
    }

    /// `<config>/chat`: también la carpeta del historial (`historial.rs`, 9.1).
    pub fn carpeta(&self) -> PathBuf {
        self.0.carpeta.clone()
    }

    /// `abrir_con` con "Por defecto" (sin modelo).
    #[cfg(test)]
    pub fn abrir(&self, conversacion: &str, motor: &str, carpeta: Option<PathBuf>, mascota: &str, sesion_claude: Option<String>) -> Result<Value, String> {
        self.abrir_con(conversacion, motor, carpeta, mascota, sesion_claude, None)
    }

    /// `abrir_proyecto` sin proyecto (la charla de antes de #44).
    #[cfg(test)]
    pub fn abrir_con(&self, conversacion: &str, motor: &str, carpeta: Option<PathBuf>, mascota: &str, sesion_claude: Option<String>, modelo: Option<String>) -> Result<Value, String> {
        self.abrir_proyecto(conversacion, motor, carpeta, mascota, sesion_claude, modelo, None)
    }

    /// `chat_abrir` (7.8): conoce la conversación y, con el motor Claude Code, precalienta el
    /// proceso sin mandarle nada (D19). `{ proceso: "arrancando" | "listo" | "apagado", sesion, motivo? }`.
    /// `modelo` (#35): uno de `MODELOS` o `None` ("Por defecto"). Cambia también en una charla con
    /// mensajes: el proceso vivo se retira y otro retoma la misma sesión con el modelo nuevo. Si hay
    /// un turno en curso, el cambio espera al próximo envío (nunca dos procesos en la misma sesión).
    /// `proyecto` (#44, 11.4): con un proyecto, `carpeta` se ignora y manda la del proyecto (si existe;
    /// si no, la de trabajo, 8.4); sus instrucciones van por el archivo de sistema. Una charla de proyecto
    /// con mensajes sí cambia de carpeta (D-p15: corre en la actual): el proceso se relanza con
    /// `--resume`. Devuelve además `proyecto` (`ProyectoChat::a_json`).
    #[allow(clippy::too_many_arguments)]
    pub fn abrir_proyecto(&self, conversacion: &str, motor: &str, carpeta: Option<PathBuf>, mascota: &str, sesion_claude: Option<String>, modelo: Option<String>, proyecto: Option<&str>) -> Result<Value, String> {
        if !conversacion_valida(conversacion) {
            return Err(String::from("id de conversación inválido"));
        }
        if modelo.as_deref().is_some_and(|m| !modelo_valido(m)) {
            return Err(String::from("modelo desconocido"));
        }
        if sesion_claude.as_deref().is_some_and(|s| !sesion_valida(s)) {
            return Err(String::from("id de sesión de Claude Code inválido"));
        }
        // A2 de P2 (8.3): una charla con historia (su sesión de Claude Code, o ya usada en esta ejecución) cuyo
        // proyecto se borró o está roto sigue, sin proyecto: en su carpeta o la de trabajo, como antes de #44.
        // «el proyecto no existe» queda para una charla nueva de un proyecto que no está
        let pedido = proyecto;
        let proyecto = match pedido.map(|id| self.proyecto(id)) {
            Some(Ok(p)) => Some(p),
            Some(Err(error)) => {
                let con_historia = sesion_claude.is_some() || self.estado().conversaciones.get(conversacion).is_some_and(|c| c.usada);
                if !con_historia {
                    return Err(error);
                }
                registrar("chat: el proyecto de la charla no está; sigue sin proyecto");
                None
            }
            None => None,
        };
        let sin_proyecto = pedido.is_some() && proyecto.is_none();
        let cwd = match (&proyecto, carpeta) {
            (Some(p), _) => match &p.carpeta {
                Some(c) => c.clone(),
                None => self.trabajo()?,
            },
            (None, Some(c)) if c.is_dir() => c,
            (None, Some(_)) => return Err(String::from("la carpeta no existe")),
            (None, None) => self.trabajo()?,
        };
        let mascota = nombre_mascota(mascota);
        let local = motor != "claude";
        let id_proyecto = proyecto.as_ref().map(|p| p.id.clone());
        let datos_proyecto = proyecto.as_ref().map(ProyectoChat::a_json);
        let mut e = self.estado();
        match e.conversaciones.get_mut(conversacion) {
            Some(c) if c.usada && !sin_proyecto && c.proyecto.as_ref().map(|p| &p.id) != id_proyecto.as_ref() => return Err(String::from("el proyecto de una charla con mensajes no cambia")),
            Some(c) if c.usada && (c.local != local || (id_proyecto.is_none() && !sin_proyecto && c.cwd != cwd)) => return Err(String::from("la carpeta y el motor de una charla con mensajes no cambian")),
            Some(c) if !c.usada => {
                // Vacía: la cabecera cambia (D8) y la mascota es la del primer mensaje
                c.cwd = cwd;
                c.mascota = mascota;
                c.local = local;
                c.modelo = modelo;
                c.proyecto = proyecto;
            }
            // Con mensajes, el modelo sí cambia (S1): sigue la misma conversación. La de un proyecto corre
            // en la carpeta actual del proyecto, con sus instrucciones de ahora (D-p15)
            Some(c) => {
                c.modelo = modelo;
                if c.proyecto.is_some() {
                    c.cwd = cwd;
                    c.proyecto = proyecto;
                }
            }
            None => {
                let usada = sesion_claude.is_some();
                let sesion = sesion_claude.unwrap_or_else(nuevo_uuid);
                e.conversaciones.insert(conversacion.to_string(), Conversacion { sesion, usada, cwd, mascota, firma: None, local, modelo, proyecto });
            }
        }
        let sesion = e.conversaciones[conversacion].sesion.clone();
        let con_proyecto = |mut v: Value| -> Result<Value, String> {
            if let Some(p) = &datos_proyecto {
                v["proyecto"] = p.clone();
            }
            Ok(v)
        };
        if motor != "claude" {
            return con_proyecto(json!({ "proceso": "apagado", "sesion": sesion }));
        }
        if e.proceso.as_ref().is_some_and(|p| p.conversacion != conversacion) {
            e.retirar();
        }
        if let Some(p) = &e.proceso {
            let sirve = p.sirve_para(&e.conversaciones[conversacion]);
            if !p.vivo.salio() && bloquear(&p.entrada).is_some() && (sirve || p.turno_activo()) {
                let usada = e.conversaciones[conversacion].usada;
                return con_proyecto(json!({ "proceso": if usada { "listo" } else { "arrancando" }, "sesion": sesion }));
            }
        }
        match self.lanzar(&mut e, conversacion) {
            Ok(()) => con_proyecto(json!({ "proceso": "arrancando", "sesion": sesion })),
            Err(detalle) => {
                registrar(&format!("chat: no se pudo lanzar claude: {detalle}"));
                con_proyecto(json!({ "proceso": "apagado", "sesion": sesion, "motivo": "sin-claude" }))
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
        // #43 (D-c7): un token nuevo por lanzamiento, atado a la conversación
        let servidor = self.servidor();
        let mcp = servidor.as_ref().and_then(|s| s.nuevo_token(conversacion).map(|token| Mcp { puerto: s.puerto(), token }));
        let revocar = |m: &Option<Mcp>| {
            if let (Some(s), Some(m)) = (&servidor, m) {
                s.revocar(&m.token);
            }
        };
        // #44 (11.4, camino A): las instrucciones del proyecto en su archivo, escrito antes de lanzar
        let texto_sistema = c.sistema();
        let sistema = match &texto_sistema {
            Some(t) => {
                let r = ruta_sistema(&self.0.carpeta, conversacion);
                let escrito = r.parent().map_or(Ok(()), fs::create_dir_all).and_then(|()| crate::atomico::escribir(&r, t.as_bytes()));
                if let Err(err) = escrito {
                    revocar(&mcp);
                    return Err(format!("instrucciones del proyecto: {err}"));
                }
                Some(r)
            }
            None => None,
        };
        let l = Lanzamiento { args: argumentos_chat(&Pedido { ajustes: &ajustes, mascota: &c.mascota, usuario: e.usuario.as_deref(), sesion: &sesion, modelo: c.modelo.as_deref(), mcp: mcp.as_ref(), sistema: sistema.as_deref() }), cwd: c.cwd.clone() };
        let mut comando = match (self.0.lanzador)(&l) {
            Ok(c) => c,
            Err(e) => {
                revocar(&mcp);
                return Err(e.to_string());
            }
        };
        comando.current_dir(&l.cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut hijo = match comando.spawn() {
            Ok(h) => h,
            Err(e) => {
                revocar(&mcp);
                return Err(e.to_string());
            }
        };
        let trabajo = Trabajo::para(&hijo);
        let (Some(stdin), Some(stdout), Some(stderr)) = (hijo.stdin.take(), hijo.stdout.take(), hijo.stderr.take()) else {
            let _ = hijo.kill();
            revocar(&mcp);
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
        registrar(&format!("chat: claude lanzado ({}, modelo {})", if c.usada { "retoma" } else { "nueva" }, c.modelo.as_deref().unwrap_or("por defecto")));
        let modelo = c.modelo.clone();
        let token = mcp.map(|m| m.token);
        let firma_sistema = texto_sistema.as_deref().map(firma_texto);
        e.proceso = Some(Proceso { generacion, conversacion: conversacion.to_string(), entrada: Arc::new(Mutex::new(Some(stdin))), vivo, turno: None, ultimo_uso: Instant::now(), interrupciones: 0, modelo, token, cwd: l.cwd.clone(), sistema: firma_sistema });
        Ok(())
    }

    /// `chat_enviar` (7.4): manda un turno. Sin un turno en curso (D7) y con texto o algún adjunto.
    /// `adjuntos`: rutas; Rust las lee recién acá (la ventana nunca toca los bytes). Uno que no entra
    /// (o el sexto) es el error `adjunto` con su nombre, sin escribirle nada al proceso.
    #[cfg(test)]
    pub fn enviar(&self, conversacion: &str, turno: u64, texto: &str, adjuntos: &[String], datos: &Value) -> Result<(), String> {
        self.enviar_con(conversacion, turno, texto, adjuntos, datos, &Value::Null)
    }

    /// `chat_enviar` (7.8): como `enviar`, con la historia de la charla que manda la ventana
    /// (`[{ rol, texto }]`), que solo usa el motor local (8: llama-server no recuerda nada entre pedidos).
    pub fn enviar_con(&self, conversacion: &str, turno: u64, texto: &str, adjuntos: &[String], datos: &Value, historia: &Value) -> Result<(), String> {
        let texto = texto.trim();
        if texto.is_empty() && adjuntos.is_empty() {
            return Err(String::from("el mensaje está vacío"));
        }
        if texto.chars().count() > MAX_TEXTO {
            return Err(String::from("el mensaje es demasiado largo"));
        }
        // #44: las instrucciones o la carpeta del proyecto pudieron cambiar con la charla abierta
        self.refrescar_proyecto(conversacion);
        let e = self.estado();
        match e.conversaciones.get(conversacion) {
            None => return Err(String::from("la charla no está abierta")),
            // Nunca a la nube una charla del motor local (regla 3): la responde el modelo de esta PC
            Some(c) if c.local => {
                drop(e);
                return self.enviar_local(conversacion, turno, texto, adjuntos, datos, historia);
            }
            Some(_) => {}
        }
        if e.proceso.as_ref().is_some_and(|p| p.conversacion == conversacion && p.turno_activo()) {
            return Err(String::from("hay una respuesta en curso"));
        }
        // Los archivos se leen fuera del candado (hasta 5 de 20 MB)
        drop(e);
        let bloques = match adjuntos::bloques(adjuntos) {
            Ok(b) => b,
            Err(nombre) => {
                registrar("chat: un adjunto no entra");
                (self.0.emitir)(con_turno(conversacion, turno, &EventoChat::Error { motivo: "adjunto", detalle: Some(nombre) }));
                return Ok(());
            }
        };
        let mut e = self.estado();
        if e.proceso.as_ref().is_some_and(|p| p.conversacion == conversacion && p.turno_activo()) {
            return Err(String::from("hay una respuesta en curso"));
        }
        // Si la charla cambió de modelo durante el turno anterior (#35), o de instrucciones o de carpeta
        // del proyecto (#44), el proceso vivo ya no sirve: otro retoma la misma sesión
        let sirve = match (e.proceso.as_ref(), e.conversaciones.get(conversacion)) {
            (Some(p), Some(c)) => p.conversacion == conversacion && !p.vivo.salio() && bloquear(&p.entrada).is_some() && p.sirve_para(c),
            _ => false,
        };
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
        let deshechos = e.deshechos.remove(conversacion).unwrap_or_default();
        let linea = mensaje_usuario_con(texto, avis.as_deref(), &deshechos, &bloques);
        let p = e.proceso.as_mut().ok_or("sin proceso")?;
        p.turno = Some(Turno::nuevo(turno, Instant::now()));
        // 11.1: las herramientas de Avis andan desde ahora hasta el final del turno
        self.turno_mcp(p.token.as_deref(), Some(turno));
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
        // El motor local (8): el hilo deja de leer y corta la conexión
        if let Some(t) = e.local.as_ref().filter(|t| t.conversacion == conversacion && t.numero == turno) {
            t.frenar.store(true, Ordering::SeqCst);
        }
        let Some(p) = e.proceso.as_mut().filter(|p| p.conversacion == conversacion) else { return };
        let es_el_turno = p.turno.as_ref().is_some_and(|t| t.numero == turno && t.activo());
        let mandar = p.turno.as_mut().filter(|t| t.numero == turno).is_some_and(Turno::frenar);
        if mandar {
            p.interrumpir();
        }
        // 11.1: después de frenar, el servidor de Avis no cambia nada más
        if es_el_turno {
            self.turno_mcp(p.token.as_deref(), None);
        }
    }

    /// `chat_cerrar`: cierra stdin. Un turno en curso termina igual y el proceso sale solo.
    /// Las instrucciones del proyecto (#44, 11.4) se borran: el proceso ya las leyó al arrancar.
    pub fn cerrar(&self, conversacion: &str) {
        if let Some(p) = self.estado().proceso.as_ref().filter(|p| p.conversacion == conversacion) {
            p.cerrar_entrada();
        }
        if conversacion_valida(conversacion) {
            let _ = fs::remove_file(ruta_sistema(&self.0.carpeta, conversacion));
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
            if let Some(t) = &e.local {
                t.frenar.store(true, Ordering::SeqCst);
            }
            // La interrupción antes de cerrar stdin: `retirar` lo cierra. Los que ya salían tienen
            // stdin cerrado; si no terminan a tiempo, se matan abajo.
            if let Some(p) = e.proceso.as_mut().filter(|p| p.turno_activo()) {
                p.interrumpir();
            }
            e.retirar();
            for p in &e.saliendo {
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
        // #44 (B1 de P2): ninguna instrucción de proyecto queda en disco al salir de Avis
        limpiar_sistema(&self.0.carpeta);
    }

    /// Un turno del motor local (8): con texto y sin archivos. Arma el pedido (la instrucción con la
    /// mascota, el bloque `<avis>` y la historia recortada a 3000 tokens, D22) y lo resuelve en un hilo.
    /// Un turno por vez (D7); si quedó corriendo el de otra charla, se frena.
    fn enviar_local(&self, conversacion: &str, turno: u64, texto: &str, adjuntos: &[String], datos: &Value, historia: &Value) -> Result<(), String> {
        if !adjuntos.is_empty() {
            return Err(String::from("el modelo de esta PC no lee archivos"));
        }
        if texto.is_empty() {
            return Err(String::from("el mensaje está vacío"));
        }
        if self.0.apagado.load(Ordering::SeqCst) {
            return Err(String::from("Avis se está cerrando"));
        }
        let mut e = self.estado();
        if let Some(t) = &e.local {
            if t.conversacion == conversacion {
                return Err(String::from("hay una respuesta en curso"));
            }
            t.frenar.store(true, Ordering::SeqCst);
        }
        let (mascota, proyecto) = e.conversaciones.get(conversacion).map(|c| (c.mascota.clone(), c.proyecto.clone())).ok_or("la charla no está abierta")?;
        let usuario = e.usuario.clone();
        let frenar = Arc::new(AtomicBool::new(false));
        e.generacion_local += 1;
        let generacion = e.generacion_local;
        e.local = Some(TurnoLocal { generacion, conversacion: conversacion.to_string(), numero: turno, frenar: frenar.clone() });
        drop(e);
        // #44 (11.4): con el motor local van solo las instrucciones del proyecto, nunca su carpeta
        let proyecto = proyecto.as_ref().filter(|p| !p.instrucciones.trim().is_empty()).map(|p| (p.nombre.as_str(), p.instrucciones.as_str()));
        let sistema = chat_local::sistema_local_con(&mascota, usuario.as_deref(), &modelo::datos_como_texto(datos), proyecto);
        let recorte = chat_local::recorte_local(&sistema, &chat_local::historia_de(historia), texto);
        let cuerpo = chat_local::cuerpo_local(&sistema, &recorte);
        let chat = self.clone();
        let conversacion = conversacion.to_string();
        let desde = Instant::now();
        let lanzado = std::thread::Builder::new().name(String::from("avis-chat-local")).spawn(move || {
            let fin = chat.turno_local(&conversacion, turno, &cuerpo, &frenar, desde);
            let mut e = chat.estado();
            if e.local.as_ref().is_some_and(|t| t.generacion == generacion) {
                e.local = None;
            }
            drop(e);
            (chat.0.emitir)(con_turno(&conversacion, turno, &fin));
        });
        lanzado.map(|_| ()).map_err(|err| {
            self.estado().local = None;
            err.to_string()
        })
    }

    /// El turno local, en su hilo: el motor (lo arranca si hace falta: "Despertando"), el pedido en
    /// streaming y su final. Emite `listo` con el motor listo, `recibido` con el pedido aceptado,
    /// `pensando` con el primer tramo y el texto junto cada 50 ms (7.5); devuelve el final.
    fn turno_local(&self, conversacion: &str, turno: u64, cuerpo: &Value, frenar: &AtomicBool, desde: Instant) -> EventoChat {
        let error = |detalle: String| EventoChat::Error { motivo: "local", detalle: Some(detalle.chars().take(TOPE_DETALLE).collect()) };
        let emitir = |ev: &EventoChat| (self.0.emitir)(con_turno(conversacion, turno, ev));
        let motor = bloquear(&self.0.motor_local).clone();
        let Some(motor) = motor else { return error(String::from("no está el modelo de esta PC")) };
        let (puerto, uso) = match motor() {
            Ok(m) => m,
            Err(detalle) => {
                registrar(&format!("chat local: el motor no arrancó: {detalle}"));
                return error(detalle);
            }
        };
        if frenar.load(Ordering::SeqCst) {
            return EventoChat::Frenada;
        }
        emitir(&EventoChat::Listo { sesion: String::new() });
        let mut juntador = Juntador::default();
        let soltar = |j: &mut Juntador| {
            if let Some(texto) = j.sacar() {
                emitir(&EventoChat::Texto { texto });
            }
        };
        let r = chat_local::pedir(puerto, cuerpo, frenar, &mut |a| match a {
            Avance::Aceptado => emitir(&EventoChat::Recibido),
            Avance::Rol => emitir(&EventoChat::Pensando),
            Avance::Texto(t) => {
                let ahora = Instant::now();
                juntador.agregar(&t, ahora);
                if juntador.vencido(ahora) {
                    soltar(&mut juntador);
                }
            }
        });
        if !frenar.load(Ordering::SeqCst) {
            soltar(&mut juntador);
        }
        let fallo = |d: String| {
            registrar(&format!("chat local: {d}"));
            error(uso.diagnostico().unwrap_or(d))
        };
        match r {
            _ if frenar.load(Ordering::SeqCst) => EventoChat::Frenada,
            Ok(FinLectura::Hecho { .. }) => EventoChat::Fin { ms: desde.elapsed().as_millis() as u64 },
            Ok(FinLectura::Frenado) => EventoChat::Frenada,
            Ok(FinLectura::Cortado) => fallo(String::from("se cortó la respuesta")),
            Ok(FinLectura::Error(d)) | Err(d) => fallo(d),
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
                self.turno_mcp(p.token.as_deref(), None);
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
                Ok(Linea::SesionPerdida) => self.sesion_perdida(generacion),
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
        // El proceso salió: su token del servidor de Avis ya no sirve (D-c7)
        if let (Some(token), Some(s)) = (e.proceso_mut(generacion).and_then(|p| p.token.clone()), self.servidor_vivo()) {
            s.revocar(&token);
        }
        let conversacion = e.proceso_mut(generacion).map(|p| p.conversacion.clone());
        if e.proceso.as_ref().is_some_and(|p| p.generacion == generacion) {
            e.proceso = None;
        }
        e.saliendo.retain(|p| p.generacion != generacion);
        // #44 (B1 de P2): las instrucciones del proyecto no sobreviven al proceso que las usó, salvo que otro
        // proceso de la misma charla ya las haya vuelto a escribir (relanzar con `--resume`). El próximo
        // lanzamiento las escribe de nuevo
        if let Some(c) = conversacion.filter(|c| !e.proceso.iter().chain(e.saliendo.iter()).any(|p| &p.conversacion == c)) {
            let _ = fs::remove_file(ruta_sistema(&self.0.carpeta, &c));
        }
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
            let termino = !t.activo();
            if r.interrumpir {
                p.interrumpir();
            }
            // 11.1: el final del turno cierra las herramientas de Avis hasta el próximo mensaje
            if termino {
                self.turno_mcp(p.token.as_deref(), None);
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

    /// Claude Code ya no tiene la sesión de la charla (se borró su transcripción): la próxima vez
    /// empieza una nueva, con otro id. Lo hablado sigue en el historial de Avis, no en Claude Code.
    fn sesion_perdida(&self, generacion: u64) {
        let mut e = self.estado();
        let Some(conversacion) = e.proceso_mut(generacion).map(|p| p.conversacion.clone()) else { return };
        if let Some(c) = e.conversaciones.get_mut(&conversacion) {
            registrar("chat: Claude Code ya no tiene la sesión de la charla; la próxima empieza una nueva");
            c.sesion = nuevo_uuid();
            c.usada = false;
            c.firma = None;
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
            let v = std::str::from_utf8(&linea).ok().and_then(|l| serde_json::from_str::<Value>(l).ok());
            if v.as_ref().is_some_and(sesion_perdida) && tx.send(Linea::SesionPerdida).is_err() {
                break;
            }
            let eventos = v.as_ref().map(eventos_de_linea).unwrap_or_default();
            if linea.capacity() > 1024 * 1024 {
                linea = Vec::new();
            }
            if eventos.into_iter().any(|ev| tx.send(Linea::Evento(ev)).is_err()) {
                break;
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
