//! El motor local en la charla (#22, docs/diseno/chat-avis-ux.md 8): el modelo de esta PC
//! (`modelo.rs`, llama-server en 127.0.0.1) responde en streaming por el mismo `oficina://chat`, así la
//! ventana no distingue motores.
//!
//! Reglas firmes: el pedido va solo a 127.0.0.1 y sin proxy (sin internet: la única salida a la red
//! del modelo sigue siendo la descarga con un clic); sin herramientas ni archivos; el modelo solo
//! responde. llama-server no recuerda nada entre pedidos: cada turno lleva la instrucción, el bloque
//! `<avis>` y la historia que entra en 3000 tokens (D22).

use serde_json::{json, Value};
use std::io::{BufRead, BufReader};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use crate::chat::{frase_usuario, nombre_mascota, texto_proyecto, MAX_TEXTO};

/// La instrucción de 4.3 sin herramientas, con "si no sabés algo de las sesiones, decilo" (8) y lo
/// que el resumen aprendió de los datos (#11: "abierta_hace" no es cuánto espera). La última frase es de
/// #44 (L9 de Proyectos, decisión de Quintana del 25/11): medido, «Respondés en español rioplatense» le
/// ganaba al «Respondé en inglés» de un proyecto.
pub const INSTRUCCION_CHAT_LOCAL: &str = "Sos {Mascota}, la mascota de Avis, el panel que muestra en qué anda Claude Code. \
Respondés en español rioplatense, de vos, breve y concreto. \
Solo respondés con lo que sabés: no leés archivos, ni carpetas, ni internet. \
Los datos en vivo de las sesiones vienen en el bloque <avis>: usalos para responder sobre ellas, y si no sabés algo de las sesiones, decilo. \
Lo único pendiente son las preguntas: una sesión quieta no espera nada, y \"abierta_hace\" es cuánto hace que se abrió, no cuánto hace que espera. \
Usá Markdown simple (títulos, listas, código). \
No podés tocar tareas ni hábitos: si te lo piden, decí que con el modelo local todavía no y que lo puede hacer en una charla con Claude Code. \
Si el bloque <proyecto> pide otro idioma o estilo, seguilo antes que lo de arriba.";
/// Lo que va en el bloque `<avis>` sin sesiones (así no inventa ninguna).
pub const SIN_SESIONES: &str = "No hay sesiones abiertas en Avis.";
/// La entrada como mucho (D22), con el contexto de 4096 de `modelo::argumentos` y `MAX_TOKENS` de salida.
pub const TOPE_TOKENS: usize = 3000;
/// Las instrucciones de un proyecto como mucho (#44, proyectos-ux.md 11.4): más que esto se corta y se anota.
pub const TOPE_INSTRUCCIONES: usize = 1500;
/// La respuesta como mucho (8).
pub const MAX_TOKENS: u32 = 700;
/// La estimación de D22. Medido con `/tokenize` de llama-server (24/11): 3,76 en el bloque `<avis>`,
/// 3,53 en la instrucción, 3,71 en una respuesta y 3,24 en código.
pub const CARACTERES_POR_TOKEN: f64 = 3.5;
/// Lo que suma cada mensaje en la plantilla de chat (`<|im_start|>rol\n…<|im_end|>\n`).
pub const TOKENS_POR_MENSAJE: usize = 4;
/// Cuántos mensajes de la historia se leen como mucho (la ventana dibuja los últimos 60 con más de 200, D32).
const TOPE_HISTORIA: usize = 200;
/// Hasta el primer byte de la respuesta y entre lecturas (la lectura del pedido en CPU puede tardar).
const ESPERA_RESPUESTA: Duration = Duration::from_secs(60);
const ESPERA_LECTURA: Duration = Duration::from_secs(240);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rol {
    Usuario,
    Mascota,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Mensaje {
    pub rol: Rol,
    pub texto: String,
}

/// Lo que entra en el pedido: la historia (los turnos más nuevos) y el último mensaje (cortado solo
/// si no entra ni solo).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Recorte {
    pub historia: Vec<Mensaje>,
    pub ultimo: String,
}

/// Los tokens estimados de un mensaje: 3,5 caracteres por token, más los de la plantilla.
pub fn costo(texto: &str) -> usize {
    (texto.chars().count() as f64 / CARACTERES_POR_TOKEN).ceil() as usize + TOKENS_POR_MENSAJE
}

/// El mensaje de sistema (8): la instrucción con la mascota (y el usuario, si hay: #37) y el bloque
/// `<avis>` (el texto de `modelo::datos_como_texto`, sin las claves prohibidas y con el tope de 6000
/// caracteres).
#[cfg(test)]
pub fn sistema_local(mascota: &str, usuario: Option<&str>, avis: &str) -> String {
    sistema_local_con(mascota, usuario, avis, None)
}

/// `sistema_local` con el proyecto de la charla (#44, 11.4): `(nombre, instrucciones)`. El bloque
/// `<proyecto>` (el de Claude Code sin la frase de la carpeta: el modelo local no la ve) va antes de
/// `<avis>`. Es parte del sistema: `recorte_local` recorta la historia, nunca las instrucciones.
pub fn sistema_local_con(mascota: &str, usuario: Option<&str>, avis: &str, proyecto: Option<(&str, &str)>) -> String {
    let avis = if avis.trim().is_empty() { SIN_SESIONES } else { avis.trim_end() };
    let instruccion = INSTRUCCION_CHAT_LOCAL.replace("{Mascota}", &nombre_mascota(mascota));
    let bloque = match proyecto {
        Some((nombre, instrucciones)) => format!("\n\n{}", texto_proyecto(nombre, &instrucciones_locales(instrucciones), false).trim_end()),
        None => String::new(),
    };
    format!("{instruccion}{}{bloque}\n\n<avis>\n{avis}\n</avis>", frase_usuario(usuario))
}

/// Las instrucciones de un proyecto para el motor local (11.4): si solas pasan de `TOPE_INSTRUCCIONES`
/// tokens (`costo`), se cortan ahí y se anota. Con el tope de 4000 caracteres del proyecto no pasa.
pub fn instrucciones_locales(instrucciones: &str) -> String {
    if costo(instrucciones) <= TOPE_INSTRUCCIONES {
        return instrucciones.to_string();
    }
    let caracteres = ((TOPE_INSTRUCCIONES - TOKENS_POR_MENSAJE) as f64 * CARACTERES_POR_TOKEN).floor() as usize;
    registrar_corte();
    instrucciones.chars().take(caracteres).collect()
}

#[cfg(not(test))]
fn registrar_corte() {
    if let Some(ruta) = crate::diagnostico::ruta_log() {
        let _ = crate::diagnostico::agregar_linea(&ruta, "chat local: las instrucciones del proyecto se cortaron en 1500 tokens", chrono::Utc::now(), crate::diagnostico::TOPE_BYTES);
    }
}

#[cfg(test)]
fn registrar_corte() {}

/// La historia que manda la ventana (`[{ rol: "usuario" | "mascota", texto }]`): lo que no tiene esa
/// forma o viene vacío se saltea; los últimos 200 mensajes, cada uno con el tope de `MAX_TEXTO`.
pub fn historia_de(v: &Value) -> Vec<Mensaje> {
    let Some(lista) = v.as_array() else { return Vec::new() };
    let mensajes: Vec<Mensaje> = lista
        .iter()
        .filter_map(|m| {
            let rol = match m["rol"].as_str()? {
                "usuario" => Rol::Usuario,
                "mascota" => Rol::Mascota,
                _ => return None,
            };
            let texto = m["texto"].as_str()?.trim();
            (!texto.is_empty()).then(|| Mensaje { rol, texto: texto.chars().take(MAX_TEXTO).collect() })
        })
        .collect();
    let desde = mensajes.len().saturating_sub(TOPE_HISTORIA);
    mensajes[desde..].to_vec()
}

/// El presupuesto de D22: el sistema (con el bloque `<avis>`) y el último mensaje siempre van; si el
/// último no entra ni solo, se corta con "…". Después se suman los turnos anteriores (una pregunta y
/// sus respuestas, enteros) del más nuevo al más viejo, hasta el primero que no entra. Una respuesta
/// suelta al principio, sin su pregunta, no va.
pub fn recorte_local(sistema: &str, historia: &[Mensaje], ultimo: &str) -> Recorte {
    let fijo = costo(sistema);
    let mut ultimo = ultimo.to_string();
    if fijo + costo(&ultimo) > TOPE_TOKENS {
        let tokens = TOPE_TOKENS.saturating_sub(fijo + TOKENS_POR_MENSAJE);
        let caracteres = ((tokens as f64 * CARACTERES_POR_TOKEN).floor() as usize).saturating_sub(1);
        ultimo = format!("{}…", ultimo.chars().take(caracteres).collect::<String>().trim_end());
    }
    let mut usado = fijo + costo(&ultimo);
    // Los turnos: cada pregunta con las respuestas que la siguen
    let mut turnos: Vec<&[Mensaje]> = Vec::new();
    let mut inicio: Option<usize> = None;
    for (k, m) in historia.iter().enumerate() {
        if m.rol == Rol::Usuario {
            if let Some(i) = inicio {
                turnos.push(&historia[i..k]);
            }
            inicio = Some(k);
        }
    }
    if let Some(i) = inicio {
        turnos.push(&historia[i..]);
    }
    let mut entran: Vec<&[Mensaje]> = Vec::new();
    for t in turnos.iter().rev() {
        let c: usize = t.iter().map(|m| costo(&m.texto)).sum();
        if usado + c > TOPE_TOKENS {
            break;
        }
        usado += c;
        entran.push(t);
    }
    let historia = entran.iter().rev().flat_map(|t| t.iter().cloned()).collect();
    Recorte { historia, ultimo }
}

/// `POST /v1/chat/completions` (8): en streaming, con la caché del prefijo y los valores que
/// recomienda la ficha de Qwen3-4B-Instruct-2507 (temperatura 0,7, top_p 0,8, top_k 20). Sin `tools`.
pub fn cuerpo_local(sistema: &str, r: &Recorte) -> Value {
    let mut mensajes = vec![json!({ "role": "system", "content": sistema })];
    for m in &r.historia {
        let rol = if m.rol == Rol::Usuario { "user" } else { "assistant" };
        mensajes.push(json!({ "role": rol, "content": m.texto }));
    }
    mensajes.push(json!({ "role": "user", "content": r.ultimo }));
    json!({
        "messages": mensajes,
        "stream": true,
        "cache_prompt": true,
        "max_tokens": MAX_TOKENS,
        "temperature": 0.7,
        "top_p": 0.8,
        "top_k": 20,
    })
}

// ------------------------------------------------------------------ la respuesta (SSE)

/// Una línea del stream de llama-server (medido en b12606: `data: {…chat.completion.chunk…}`,
/// separadas por una línea en blanco, y `data: [DONE]` al final).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Sse {
    /// El primer tramo (`delta.role`, sin texto): llega con el primer token, después de leer el pedido.
    Rol,
    Texto(String),
    /// `finish_reason`: `stop`, o `length` si se quedó sin tokens (`cortado`).
    Fin { cortado: bool },
    /// `data: [DONE]`.
    Hecho,
    Error(String),
    Nada,
}

fn mensaje_de_error(e: &Value) -> String {
    e["message"].as_str().or_else(|| e.as_str()).unwrap_or("error del motor").chars().take(200).collect()
}

pub fn linea_sse(linea: &str) -> Sse {
    let linea = linea.trim();
    if let Some(resto) = linea.strip_prefix("error:") {
        return match serde_json::from_str::<Value>(resto.trim()) {
            Ok(v) => Sse::Error(mensaje_de_error(&v)),
            Err(_) => Sse::Error(resto.trim().chars().take(200).collect()),
        };
    }
    let Some(datos) = linea.strip_prefix("data:").map(str::trim) else { return Sse::Nada };
    if datos == "[DONE]" {
        return Sse::Hecho;
    }
    let Ok(v) = serde_json::from_str::<Value>(datos) else { return Sse::Nada };
    if !v["error"].is_null() {
        return Sse::Error(mensaje_de_error(&v["error"]));
    }
    let eleccion = &v["choices"][0];
    if let Some(t) = eleccion["delta"]["content"].as_str().filter(|t| !t.is_empty()) {
        return Sse::Texto(t.to_string());
    }
    if let Some(motivo) = eleccion["finish_reason"].as_str() {
        return Sse::Fin { cortado: motivo == "length" };
    }
    if eleccion["delta"]["role"].is_string() {
        return Sse::Rol;
    }
    Sse::Nada
}

/// Lo que se le avisa a quien pide, en orden.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Avance {
    /// El motor aceptó el pedido (200): llegó a llama-server.
    Aceptado,
    Rol,
    Texto(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FinLectura {
    Hecho { cortado: bool },
    /// Se pidió frenar: se dejó de leer (la conexión se cierra al soltar el lector).
    Frenado,
    /// El stream terminó sin su final (el motor se cayó).
    Cortado,
    Error(String),
}

/// Lee el stream línea a línea hasta `[DONE]`, avisando el rol y el texto. Con `frenar`, deja de leer
/// y no avisa nada más (lo que llegue después del clic no se ve, 7.6).
pub fn leer_sse(lector: &mut dyn BufRead, frenar: &AtomicBool, al: &mut dyn FnMut(Avance)) -> FinLectura {
    let mut fin: Option<bool> = None;
    let mut linea = String::new();
    loop {
        if frenar.load(Ordering::SeqCst) {
            return FinLectura::Frenado;
        }
        linea.clear();
        let leido = lector.read_line(&mut linea);
        if frenar.load(Ordering::SeqCst) {
            return FinLectura::Frenado;
        }
        match leido {
            Ok(0) => return fin.map_or(FinLectura::Cortado, |cortado| FinLectura::Hecho { cortado }),
            Err(e) => return FinLectura::Error(format!("motor: {e}")),
            Ok(_) => {}
        }
        match linea_sse(&linea) {
            Sse::Hecho => return FinLectura::Hecho { cortado: fin.unwrap_or(false) },
            Sse::Fin { cortado } => fin = Some(cortado),
            Sse::Error(d) => return FinLectura::Error(d),
            Sse::Rol => al(Avance::Rol),
            Sse::Texto(t) => al(Avance::Texto(t)),
            Sse::Nada => {}
        }
    }
}

/// El error de una respuesta que no es 200. Medido: un pedido que no entra en el contexto es un 400
/// `exceed_context_size_error` antes del stream. Sin punto final (la ventana lo agrega).
pub fn error_http(estado: u16, cuerpo: &str) -> String {
    let v: Value = serde_json::from_str(cuerpo).unwrap_or(Value::Null);
    if v["error"]["type"] == "exceed_context_size_error" {
        return String::from("La charla ya no entra en el modelo de esta PC: empezá una charla nueva");
    }
    match v["error"]["message"].as_str() {
        Some(m) => format!("el motor respondió {estado}: {}", m.chars().take(140).collect::<String>()),
        None => format!("el motor respondió {estado}"),
    }
}

/// El pedido en streaming a 127.0.0.1, sin proxy (nunca sale de la máquina). `Err` si no llegó al
/// motor o no fue aceptado; si no, cómo terminó la lectura. Frenar corta la conexión al soltar el
/// lector: medido, llama-server cancela la tarea en ~20 ms ("stop: cancel task").
pub fn pedir(puerto: u16, cuerpo: &Value, frenar: &AtomicBool, al: &mut dyn FnMut(Avance)) -> Result<FinLectura, String> {
    let agente: ureq::Agent = ureq::Agent::config_builder()
        .http_status_as_error(false)
        .proxy(None)
        .max_redirects(0)
        .timeout_connect(Some(Duration::from_secs(2)))
        .timeout_recv_response(Some(ESPERA_RESPUESTA))
        .timeout_per_read(Some(ESPERA_LECTURA))
        .build()
        .into();
    let r = agente
        .post(format!("http://127.0.0.1:{puerto}/v1/chat/completions"))
        .header("Content-Type", "application/json")
        .send(cuerpo.to_string())
        .map_err(|e| format!("motor: {e}"))?;
    let estado = r.status().as_u16();
    let mut cuerpo_r = r.into_body();
    if estado != 200 {
        let texto = cuerpo_r.with_config().limit(64 * 1024).read_to_string().unwrap_or_default();
        return Err(error_http(estado, &texto));
    }
    al(Avance::Aceptado);
    let mut lector = BufReader::new(cuerpo_r.into_reader());
    Ok(leer_sse(&mut lector, frenar, al))
}

/// El motor de un turno, mientras se usa (`modelo::EnUso`): al soltarlo queda libre.
pub trait UsoMotor: Send {
    /// Si el motor se cerró: el porqué (código y última línea de su registro).
    fn diagnostico(&self) -> Option<String>;
}

/// Da el puerto de un motor listo (arrancándolo si hace falta) y su uso.
pub type MotorLocal = Arc<dyn Fn() -> Result<(u16, Box<dyn UsoMotor>), String> + Send + Sync>;

#[cfg(test)]
#[path = "chat_local_tests.rs"]
mod tests;
