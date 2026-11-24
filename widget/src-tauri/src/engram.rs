//! La copia buscable del historial en Engram (#22, docs/diseno/chat-avis-ux.md 9.2 y
//! docs/investigacion/engram-para-avis.md 5), por HTTP desde Rust (la CSP de la ventana no deja
//! llegar a 127.0.0.1:7437).
//!
//! Reglas firmes:
//! - Todo con `project: "avis"`, `scope: "project"` y `topic_key` `avis/chat/<id>`: así el contexto de
//!   los proyectos de trabajo (`oficina`, `catalogo`…) nunca lo ve.
//! - Nunca se arranca ni se frena Engram, nunca `GET /project/current` (escribe) ni `engram` por
//!   línea de comandos. Sin `/health`, "no hay" (y no se vuelve a preguntar antes de 5 min).
//! - Nunca se edita ni se borra una observación que no sea de `avis` con tema `avis/`.
//! - Un guardado dudoso (red o `500`) primero se consulta en `save-result`; solo el `404` tipado
//!   autoriza reenviarlo, una vez. Nunca a ciegas.

use serde_json::{json, Value};
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

/// El proyecto de todo lo de Avis en Engram.
pub const PROYECTO: &str = "avis";
/// El prefijo de los temas de Avis: lo único que Avis edita o borra.
pub const PREFIJO_TEMA: &str = "avis/";
/// El contenido de una charla, del final hacia atrás (9.2).
pub const TOPE_CONTENIDO: usize = 8000;
/// Cada cuánto se vuelve a preguntar si hay Engram, como mucho (9.2).
pub const CADA: Duration = Duration::from_secs(5 * 60);
/// `/health` con 1 s de espera; lo demás, unos segundos.
const ESPERA_SALUD: Duration = Duration::from_secs(1);
const ESPERA: Duration = Duration::from_secs(5);
const PUERTO: u16 = 7437;

/// Lo que dijo `/health`: `None` si no hay Engram.
#[derive(Clone, Copy)]
struct Salud {
    aislada: bool,
}

#[derive(Default)]
struct Estado {
    visto: Option<(Instant, Option<Salud>)>,
    sesion_abierta: bool,
}

/// El cliente de Engram de esta ejecución de Avis (una sesión por arranque).
pub struct Engram {
    base: String,
    token: Option<String>,
    sesion: String,
    estado: Mutex<Estado>,
    /// Un pedido de escritura por vez: el último guardado siempre llega último.
    cola: Mutex<()>,
}

/// El de la aplicación (lo pone `lib.rs` al arrancar).
pub static ENGRAM: std::sync::OnceLock<Engram> = std::sync::OnceLock::new();

fn bloquear<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(PoisonError::into_inner)
}

/// `http://127.0.0.1:{ENGRAM_PORT|7437}`.
pub fn base_de(puerto: Option<String>) -> String {
    let p = puerto.and_then(|p| p.trim().parse::<u16>().ok()).filter(|p| *p > 0).unwrap_or(PUERTO);
    format!("http://127.0.0.1:{p}")
}

/// `ENGRAM_HTTP_TOKEN`, si existe y no está vacío.
pub fn token_de(token: Option<String>) -> Option<String> {
    token.map(|t| t.trim().to_string()).filter(|t| !t.is_empty())
}

/// "Vos: …" y "{Mascota}: …", del final hacia atrás hasta 8000 caracteres. El bloque `<avis>` no está
/// en el historial (viaja solo a Claude), así que tampoco llega acá.
pub fn contenido(conv: &Value, mascota: &str) -> String {
    let mensajes = conv["mensajes"].as_array().map(Vec::as_slice).unwrap_or_default();
    let mut lineas: Vec<String> = Vec::new();
    let mut largo = 0;
    for m in mensajes.iter().rev() {
        let texto = m["texto"].as_str().unwrap_or_default().trim();
        if texto.is_empty() {
            continue;
        }
        let quien = if m["rol"] == "usuario" { "Vos" } else { mascota };
        let linea = format!("{quien}: {texto}");
        let n = linea.chars().count() + usize::from(!lineas.is_empty());
        if largo + n > TOPE_CONTENIDO {
            if lineas.is_empty() {
                lineas.push(linea.chars().take(TOPE_CONTENIDO - 1).chain(std::iter::once('…')).collect());
            }
            break;
        }
        largo += n;
        lineas.push(linea);
    }
    lineas.reverse();
    lineas.join("\n")
}

/// "Chat de Avis · <fecha> · <titulo>", con la fecha local de cuando empezó la charla.
pub fn titulo(conv: &Value) -> String {
    let fecha = conv["creada"]
        .as_str()
        .and_then(|c| chrono::DateTime::parse_from_rfc3339(c).ok())
        .map(|d| d.with_timezone(&chrono::Local).format("%d/%m/%Y").to_string())
        .unwrap_or_default();
    let t = conv["titulo"].as_str().filter(|t| !t.trim().is_empty()).unwrap_or("Charla");
    format!("Chat de Avis · {fecha} · {t}")
}

/// FNV-1a de 32 bits: estable entre ejecuciones (el `operation_id` de un reintento tiene que ser el mismo).
fn huella(texto: &str) -> u32 {
    texto.bytes().fold(0x811c_9dc5_u32, |h, b| (h ^ u32::from(b)).wrapping_mul(0x0100_0193))
}

/// El pedido de `POST /observations` (9.2). `operation_id`: `avis-<id>-<n>-<huella>`, con `n` los
/// mensajes y la huella del contenido: el mismo guardado se repite sin duplicar, y otro contenido
/// nunca choca con uno anterior (medido: la misma operación con otro contenido da `409`).
pub fn observacion(sesion: &str, conv: &Value, mascota: &str) -> Value {
    let id = conv["id"].as_str().unwrap_or_default();
    let c = contenido(conv, mascota);
    let n = conv["mensajes"].as_array().map_or(0, Vec::len);
    json!({
        "session_id": sesion,
        "project": PROYECTO,
        "scope": "project",
        "type": "conversation",
        "topic_key": format!("{PREFIJO_TEMA}chat/{id}"),
        "title": titulo(conv),
        "content": c,
        "capture_prompt": false,
        "operation_id": format!("avis-{id}-{n}-{:08x}", huella(&c)),
    })
}

/// Un cliente solo para 127.0.0.1: sin proxy, sin redirecciones y con los códigos como respuesta.
fn agente(espera: Duration) -> ureq::Agent {
    ureq::Agent::config_builder().http_status_as_error(false).proxy(None).max_redirects(0).timeout_global(Some(espera)).build().into()
}

enum Metodo {
    Get,
    Post(Value),
    Delete,
}

impl Engram {
    pub fn nuevo(base: impl Into<String>, token: Option<String>, sesion: impl Into<String>) -> Engram {
        Engram { base: base.into(), token, sesion: sesion.into(), estado: Mutex::new(Estado::default()), cola: Mutex::new(()) }
    }

    /// Con `ENGRAM_PORT` y `ENGRAM_HTTP_TOKEN` del entorno.
    pub fn desde_entorno(sesion: impl Into<String>) -> Engram {
        Engram::nuevo(base_de(std::env::var("ENGRAM_PORT").ok()), token_de(std::env::var("ENGRAM_HTTP_TOKEN").ok()), sesion)
    }

    /// Un pedido: `(código, cuerpo)`, o `Err` sin respuesta (red, tiempo).
    fn pedir(&self, metodo: Metodo, ruta: &str, espera: Duration) -> Result<(u16, Value), String> {
        let url = format!("{}{ruta}", self.base);
        let a = agente(espera);
        let bearer = self.token.as_ref().map(|t| format!("Bearer {t}"));
        let respuesta = match metodo {
            Metodo::Get => {
                let mut p = a.get(&url);
                if let Some(b) = &bearer {
                    p = p.header("Authorization", b);
                }
                p.call()
            }
            Metodo::Delete => {
                let mut p = a.delete(&url);
                if let Some(b) = &bearer {
                    p = p.header("Authorization", b);
                }
                p.call()
            }
            Metodo::Post(cuerpo) => {
                let mut p = a.post(&url).header("Content-Type", "application/json");
                if let Some(b) = &bearer {
                    p = p.header("Authorization", b);
                }
                p.send(cuerpo.to_string())
            }
        };
        let mut r = respuesta.map_err(|e| e.to_string())?;
        let codigo = r.status().as_u16();
        let texto = r.body_mut().read_to_string().map_err(|e| e.to_string())?;
        Ok((codigo, serde_json::from_str(&texto).unwrap_or(Value::Null)))
    }

    /// `/health`, como mucho cada 5 min (lo de antes vale mientras tanto, también el "no").
    fn salud(&self) -> Option<Salud> {
        if let Some((cuando, s)) = bloquear(&self.estado).visto {
            if cuando.elapsed() < CADA {
                return s;
            }
        }
        let s = match self.pedir(Metodo::Get, "/health", ESPERA_SALUD) {
            Ok((200, v)) if v["status"] == "ok" => Some(Salud { aislada: v["capabilities"]["isolated_session_registration"] == json!(true) }),
            _ => None,
        };
        bloquear(&self.estado).visto = Some((Instant::now(), s));
        s
    }

    /// Lo que se ve al abrir la hoja: "Guardado en esta PC · también en Engram" o "· Engram apagado".
    pub fn hay(&self) -> bool {
        self.salud().is_some()
    }

    /// Sin respuesta en un pedido: Engram se fue (hasta la próxima pregunta, dentro de 5 min).
    fn se_fue(&self) {
        let mut e = bloquear(&self.estado);
        e.visto = Some((Instant::now(), None));
        e.sesion_abierta = false;
    }

    /// `POST /sessions`, una vez por arranque (`isolated` solo con la capacidad).
    fn abrir_sesion(&self, salud: Salud) -> bool {
        if bloquear(&self.estado).sesion_abierta {
            return true;
        }
        let mut cuerpo = json!({ "id": self.sesion, "project": PROYECTO, "ownership_mode": "project_owned" });
        if salud.aislada {
            cuerpo["isolated"] = json!(true);
        }
        match self.pedir(Metodo::Post(cuerpo), "/sessions", ESPERA) {
            Ok((200 | 201, _)) => {
                bloquear(&self.estado).sesion_abierta = true;
                true
            }
            Ok((codigo, v)) => {
                registrar(&format!("engram: no se pudo abrir la sesión ({codigo} {})", v["error"]));
                false
            }
            Err(e) => {
                registrar(&format!("engram: sin respuesta al abrir la sesión ({e})"));
                self.se_fue();
                false
            }
        }
    }

    fn mandar(&self, obs: &Value) -> Result<(u16, Value), String> {
        self.pedir(Metodo::Post(obs.clone()), "/observations", ESPERA)
    }

    /// Guarda (upsert por tema) la charla en cada `fin` (9.2). Devuelve el id de la observación.
    pub fn guardar(&self, conv: &Value, mascota: &str) -> Option<u64> {
        let _cola = bloquear(&self.cola);
        let salud = self.salud()?;
        if !self.abrir_sesion(salud) {
            return None;
        }
        let obs = observacion(&self.sesion, conv, mascota);
        let op = obs["operation_id"].as_str().unwrap_or_default().to_string();
        let id = |v: &Value| v["id"].as_u64();
        match self.mandar(&obs) {
            Ok((200 | 201, v)) => id(&v),
            // Medido: con una sesión que no existe nada se guarda; se abre de nuevo, una vez
            Ok((404, v)) if v["error"].as_str().is_some_and(|e| e.contains("session not found")) => {
                bloquear(&self.estado).sesion_abierta = false;
                if !self.abrir_sesion(salud) {
                    return None;
                }
                match self.mandar(&obs) {
                    Ok((200 | 201, v)) => id(&v),
                    _ => None,
                }
            }
            Ok((500, _)) | Err(_) => self.despues_de_la_duda(&obs, &op),
            Ok((codigo, v)) => {
                registrar(&format!("engram: no se guardó la charla ({codigo} {})", v["error"]));
                None
            }
        }
    }

    /// Un guardado dudoso: primero `save-result`; solo su `404` tipado autoriza reenviar, una vez.
    fn despues_de_la_duda(&self, obs: &Value, op: &str) -> Option<u64> {
        match self.pedir(Metodo::Get, &format!("/observations/save-result?operation_id={op}"), ESPERA) {
            Ok((200, v)) => v["id"].as_u64(),
            Ok((404, v)) if v["code"] == "observation_save_result_not_found" => match self.mandar(obs) {
                Ok((200 | 201, v)) => v["id"].as_u64(),
                _ => None,
            },
            Ok((codigo, _)) => {
                registrar(&format!("engram: guardado dudoso sin confirmar ({codigo}); no se reenvía"));
                None
            }
            Err(e) => {
                registrar(&format!("engram: sin respuesta ({e})"));
                self.se_fue();
                None
            }
        }
    }

    /// Borra la observación de una charla (`DELETE …?expected_project=avis`), solo si es de Avis.
    /// `true` si ya no está.
    pub fn borrar(&self, id: u64) -> bool {
        let _cola = bloquear(&self.cola);
        if self.salud().is_none() {
            return false;
        }
        match self.pedir(Metodo::Get, &format!("/observations/{id}"), ESPERA) {
            Ok((200, v)) => {
                let de_avis = v["project"] == PROYECTO && v["topic_key"].as_str().is_some_and(|t| t.starts_with(PREFIJO_TEMA));
                if !de_avis {
                    registrar(&format!("engram: la observación {id} no es de Avis; no se borra"));
                    return false;
                }
                matches!(self.pedir(Metodo::Delete, &format!("/observations/{id}?expected_project={PROYECTO}"), ESPERA), Ok((200 | 204, _)))
            }
            // Medido: 404 "observation not found" (ya borrada)
            Ok((404, _)) => true,
            _ => false,
        }
    }

    /// Al salir de Avis: `POST /sessions/{id}/end`, solo si se abrió.
    pub fn cerrar(&self) {
        if !std::mem::take(&mut bloquear(&self.estado).sesion_abierta) {
            return;
        }
        let _ = self.pedir(Metodo::Post(json!({})), &format!("/sessions/{}/end", self.sesion), ESPERA_SALUD);
    }
}

#[cfg(not(test))]
fn registrar(linea: &str) {
    if let Some(ruta) = crate::diagnostico::ruta_log() {
        let _ = crate::diagnostico::agregar_linea(&ruta, linea, chrono::Utc::now(), crate::diagnostico::TOPE_BYTES);
    }
}

#[cfg(test)]
fn registrar(_linea: &str) {}

#[cfg(test)]
#[path = "engram_tests.rs"]
mod tests;
