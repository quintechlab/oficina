// Tests de engram.rs (#22, docs/diseno/chat-avis-ux.md 9.2 y 14.2.8) contra un servidor falso en
// 127.0.0.1. Las respuestas del falso son las medidas contra un Engram 3.7.2 aparte (un
// `engram serve 7499` con su propio ENGRAM_DATA_DIR, nunca el del usuario): ver
// docs/investigacion/chat-claude-code.md 7.11.
use super::*;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::sync::Arc;

#[derive(Clone, Debug)]
struct Recibido {
    metodo: String,
    ruta: String,
    cabeceras: Vec<(String, String)>,
    cuerpo: String,
}

impl Recibido {
    fn json(&self) -> Value {
        serde_json::from_str(&self.cuerpo).unwrap_or(Value::Null)
    }
    fn cabecera(&self, nombre: &str) -> Option<String> {
        self.cabeceras.iter().find(|(k, _)| k.eq_ignore_ascii_case(nombre)).map(|(_, v)| v.clone())
    }
}

type Responder = Arc<dyn Fn(&Recibido) -> (u16, String) + Send + Sync>;

struct Falso {
    base: String,
    pedidos: Arc<Mutex<Vec<Recibido>>>,
}

impl Falso {
    fn pedidos(&self) -> Vec<Recibido> {
        self.pedidos.lock().unwrap().clone()
    }
    fn cuantos(&self, metodo: &str, prefijo: &str) -> usize {
        self.pedidos().iter().filter(|p| p.metodo == metodo && p.ruta.starts_with(prefijo)).count()
    }
}

fn leer_pedido(flujo: &mut std::net::TcpStream) -> Option<Recibido> {
    let mut lector = BufReader::new(flujo.try_clone().ok()?);
    let mut primera = String::new();
    lector.read_line(&mut primera).ok()?;
    let mut partes = primera.split_whitespace();
    let metodo = partes.next()?.to_string();
    let ruta = partes.next()?.to_string();
    let mut cabeceras = Vec::new();
    loop {
        let mut l = String::new();
        lector.read_line(&mut l).ok()?;
        let l = l.trim_end();
        if l.is_empty() {
            break;
        }
        if let Some((k, v)) = l.split_once(':') {
            cabeceras.push((k.trim().to_string(), v.trim().to_string()));
        }
    }
    let largo = cabeceras.iter().find(|(k, _)| k.eq_ignore_ascii_case("content-length")).and_then(|(_, v)| v.parse::<usize>().ok()).unwrap_or(0);
    let mut cuerpo = vec![0; largo];
    lector.read_exact(&mut cuerpo).ok()?;
    Some(Recibido { metodo, ruta, cabeceras, cuerpo: String::from_utf8_lossy(&cuerpo).into_owned() })
}

/// Un Engram falso: anota cada pedido y responde con `responder`.
fn falso(responder: impl Fn(&Recibido) -> (u16, String) + Send + Sync + 'static) -> Falso {
    let escucha = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let base = format!("http://127.0.0.1:{}", escucha.local_addr().unwrap().port());
    let pedidos = Arc::new(Mutex::new(Vec::new()));
    let anotados = pedidos.clone();
    let responder: Responder = Arc::new(responder);
    std::thread::spawn(move || {
        for flujo in escucha.incoming() {
            let Ok(mut flujo) = flujo else { continue };
            let Some(p) = leer_pedido(&mut flujo) else { continue };
            let (codigo, cuerpo) = responder(&p);
            anotados.lock().unwrap().push(p);
            let _ = write!(flujo, "HTTP/1.1 {codigo} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{cuerpo}", cuerpo.len());
        }
    });
    Falso { base, pedidos }
}

const SALUD: &str = r#"{"capabilities":{"isolated_session_registration":true,"root_session_resume":true,"runtime_session_resolution":true},"instance_id":"x","service":"engram","status":"ok","version":"3.7.2"}"#;
const SALUD_VIEJA: &str = r#"{"service":"engram","status":"ok","version":"3.0.0"}"#;

/// Lo de siempre de un Engram que anda (medido): salud, sesión creada y observación guardada con id 7.
fn comun(p: &Recibido) -> (u16, String) {
    match (p.metodo.as_str(), p.ruta.split('?').next().unwrap_or_default()) {
        ("GET", "/health") => (200, SALUD.into()),
        ("POST", "/sessions") => (201, r#"{"id":"avis-arranque","status":"created"}"#.into()),
        ("POST", "/observations") => (201, r#"{"id":7,"status":"saved"}"#.into()),
        ("POST", r) if r.ends_with("/end") => (200, r#"{"id":"avis-arranque","status":"completed"}"#.into()),
        _ => (404, r#"{"error":"not found"}"#.into()),
    }
}

fn engram(f: &Falso, token: Option<&str>) -> Engram {
    Engram::nuevo(f.base.clone(), token.map(String::from), "avis-arranque")
}

fn charla() -> Value {
    json!({
        "v": 1, "id": "c-1", "titulo": "¿En qué anda cada sesión", "creada": "2026-11-24T15:00:00.000Z", "actualizada": "2026-11-24T15:05:00.000Z",
        "motor": "claude", "carpeta": null, "sesionClaude": null, "engramId": null,
        "mensajes": [
            { "rol": "usuario", "texto": "¿En qué anda cada sesión?", "cuando": "2026-11-24T15:00:00.000Z", "estado": "ok", "adjuntos": [] },
            { "rol": "mascota", "texto": "oficina trabaja; catalogo te espera.", "cuando": "2026-11-24T15:00:02.000Z", "estado": "ok", "herramientas": [], "ms": 1800 },
        ],
    })
}

// ---------------------------------------------------------------- lo puro: contenido, título, operación

#[test]
fn el_contenido_son_lineas_vos_y_la_mascota_sin_el_bloque_avis() {
    let c = contenido(&charla(), "Ascua");
    assert_eq!(c, "Vos: ¿En qué anda cada sesión?\nAscua: oficina trabaja; catalogo te espera.");
    assert!(!c.contains("<avis>"));
}

#[test]
fn el_contenido_va_del_final_hacia_atras_hasta_8000_caracteres() {
    let mut d = charla();
    let mut mensajes = Vec::new();
    for k in 0..200 {
        mensajes.push(json!({ "rol": "usuario", "texto": format!("pregunta {k} {}", "x".repeat(60)), "cuando": "", "estado": "ok", "adjuntos": [] }));
        mensajes.push(json!({ "rol": "mascota", "texto": format!("respuesta {k}"), "cuando": "", "estado": "ok", "herramientas": [], "ms": 1 }));
    }
    d["mensajes"] = json!(mensajes);
    let c = contenido(&d, "Avi");
    assert!(c.chars().count() <= TOPE_CONTENIDO);
    assert!(c.ends_with("Avi: respuesta 199"));
    assert!(!c.contains("pregunta 0 "));
    assert!(c.starts_with("Vos: ") || c.starts_with("Avi: "));
    // Un solo mensaje más largo que el tope: entra cortado
    d["mensajes"] = json!([{ "rol": "mascota", "texto": "y".repeat(9000), "cuando": "", "estado": "ok", "herramientas": [], "ms": 1 }]);
    assert!(contenido(&d, "Avi").chars().count() <= TOPE_CONTENIDO);
}

#[test]
fn el_titulo_lleva_la_fecha_y_el_titulo_de_la_charla() {
    let fecha = chrono::DateTime::parse_from_rfc3339("2026-11-24T15:00:00.000Z").unwrap().with_timezone(&chrono::Local).format("%d/%m/%Y").to_string();
    assert_eq!(titulo(&charla()), format!("Chat de Avis · {fecha} · ¿En qué anda cada sesión"));
    let mut d = charla();
    d["titulo"] = Value::Null;
    assert!(titulo(&d).ends_with(" · Charla"));
}

#[test]
fn la_observacion_es_de_avis_con_su_tema_y_sin_prompt() {
    let o = observacion("avis-arranque", &charla(), "Avi");
    assert_eq!(o["session_id"], "avis-arranque");
    assert_eq!(o["project"], "avis");
    assert_eq!(o["scope"], "project");
    assert_eq!(o["type"], "conversation");
    assert_eq!(o["topic_key"], "avis/chat/c-1");
    assert_eq!(o["capture_prompt"], false);
    assert!(o["operation_id"].as_str().unwrap().starts_with("avis-c-1-2-"));
    // El mismo contenido, la misma operación (un reintento no duplica); otro contenido, otra
    assert_eq!(observacion("avis-arranque", &charla(), "Avi")["operation_id"], o["operation_id"]);
    let mut d = charla();
    d["mensajes"][1]["texto"] = json!("otra cosa");
    assert_ne!(observacion("avis-arranque", &d, "Avi")["operation_id"], o["operation_id"]);
}

// ---------------------------------------------------------------- detectar (9.2)

#[test]
fn health_caido_es_no_y_sin_reintentos() {
    // Un puerto cerrado
    let puerto = TcpListener::bind(("127.0.0.1", 0)).unwrap().local_addr().unwrap().port();
    let e = Engram::nuevo(format!("http://127.0.0.1:{puerto}"), None, "avis-arranque");
    let t0 = Instant::now();
    assert!(!e.hay());
    assert!(t0.elapsed() < Duration::from_secs(3));
    assert_eq!(e.guardar(&charla(), "Avi"), None);
    // Un Engram que responde 500: "no", y no se vuelve a preguntar antes de 5 min
    let f = falso(|_| (500, r#"{"error":"health check failed"}"#.into()));
    let e = engram(&f, None);
    assert!(!e.hay());
    assert!(!e.hay());
    assert_eq!(e.guardar(&charla(), "Avi"), None);
    assert_eq!(f.cuantos("GET", "/health"), 1);
    assert_eq!(f.pedidos().len(), 1);
}

#[test]
fn con_engram_la_salud_se_pregunta_como_mucho_cada_5_minutos() {
    let f = falso(comun);
    let e = engram(&f, None);
    assert!(e.hay());
    assert!(e.hay());
    assert_eq!(f.cuantos("GET", "/health"), 1);
    assert_eq!(CADA, Duration::from_secs(300));
}

// ---------------------------------------------------------------- guardar

#[test]
fn guardar_abre_una_sesion_aislada_una_vez_y_guarda_con_upsert() {
    let f = falso(comun);
    let e = engram(&f, None);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(7));
    assert_eq!(e.guardar(&charla(), "Avi"), Some(7));
    assert_eq!(f.cuantos("POST", "/sessions"), 1);
    let sesion = f.pedidos().into_iter().find(|p| p.ruta == "/sessions").unwrap().json();
    assert_eq!(sesion, json!({ "id": "avis-arranque", "project": "avis", "ownership_mode": "project_owned", "isolated": true }));
    let obs: Vec<Value> = f.pedidos().into_iter().filter(|p| p.ruta == "/observations").map(|p| p.json()).collect();
    assert_eq!(obs.len(), 2);
    assert_eq!(obs[0]["topic_key"], "avis/chat/c-1");
    assert_eq!(obs[0]["content"], contenido(&charla(), "Avi"));
    // Nunca otro proyecto, nunca el contexto de la carpeta, nunca /project/current
    assert!(f.pedidos().iter().all(|p| !p.ruta.starts_with("/project") && !p.ruta.starts_with("/prompts")));
    assert!(f.pedidos().iter().filter(|p| p.metodo == "POST").all(|p| p.json()["project"] == "avis" || p.ruta.ends_with("/end")));
}

#[test]
fn isolated_solo_con_la_capacidad() {
    let f = falso(|p| if p.ruta == "/health" { (200, SALUD_VIEJA.into()) } else { comun(p) });
    let e = engram(&f, None);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(7));
    let sesion = f.pedidos().into_iter().find(|p| p.ruta == "/sessions").unwrap().json();
    assert!(sesion.get("isolated").is_none(), "{sesion}");
    assert_eq!(sesion["project"], "avis");
}

#[test]
fn con_500_primero_consulta_save_result_y_no_reenvia_si_se_guardo() {
    let f = falso(|p| {
        if p.metodo == "POST" && p.ruta == "/observations" {
            (500, r#"{"error":"boom"}"#.into())
        } else if p.ruta.starts_with("/observations/save-result") {
            (200, r#"{"id":9,"status":"committed"}"#.into())
        } else {
            comun(p)
        }
    });
    let e = engram(&f, None);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(9));
    assert_eq!(f.cuantos("POST", "/observations"), 1);
    let consulta = f.pedidos().into_iter().find(|p| p.ruta.starts_with("/observations/save-result")).unwrap();
    let op = observacion("avis-arranque", &charla(), "Avi")["operation_id"].as_str().unwrap().to_string();
    assert_eq!(consulta.ruta, format!("/observations/save-result?operation_id={op}"));
}

#[test]
fn con_500_y_save_result_404_tipado_reenvia_una_sola_vez() {
    let posts = Arc::new(Mutex::new(0));
    let p2 = posts.clone();
    let f = falso(move |p| {
        if p.metodo == "POST" && p.ruta == "/observations" {
            let mut n = p2.lock().unwrap();
            *n += 1;
            if *n == 1 { (500, r#"{"error":"boom"}"#.into()) } else { (201, r#"{"id":11,"status":"saved"}"#.into()) }
        } else if p.ruta.starts_with("/observations/save-result") {
            (404, r#"{"code":"observation_save_result_not_found","error":"no committed result found for operation_id"}"#.into())
        } else {
            comun(p)
        }
    });
    let e = engram(&f, None);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(11));
    assert_eq!(f.cuantos("POST", "/observations"), 2);
    // Los dos con la misma operación
    let ops: Vec<Value> = f.pedidos().into_iter().filter(|p| p.ruta == "/observations").map(|p| p.json()["operation_id"].clone()).collect();
    assert_eq!(ops[0], ops[1]);
}

#[test]
fn con_500_y_save_result_dudoso_nunca_reenvia_a_ciegas() {
    for (codigo, cuerpo) in [(404, r#"{"error":"not found"}"#), (500, r#"{"error":"boom"}"#), (409, r#"{"error":"conflict"}"#)] {
        let f = falso(move |p| {
            if p.metodo == "POST" && p.ruta == "/observations" {
                (500, r#"{"error":"boom"}"#.into())
            } else if p.ruta.starts_with("/observations/save-result") {
                (codigo, cuerpo.into())
            } else {
                comun(p)
            }
        });
        let e = engram(&f, None);
        assert_eq!(e.guardar(&charla(), "Avi"), None);
        assert_eq!(f.cuantos("POST", "/observations"), 1, "con {codigo} {cuerpo}");
    }
    // Un 409 al guardar (la misma operación con otro contenido, medido): no se reintenta
    let f = falso(|p| if p.metodo == "POST" && p.ruta == "/observations" { (409, r#"{"error":"observation operation id conflicts with a different payload"}"#.into()) } else { comun(p) });
    assert_eq!(engram(&f, None).guardar(&charla(), "Avi"), None);
    assert_eq!(f.cuantos("POST", "/observations"), 1);
    assert_eq!(f.cuantos("GET", "/observations/save-result"), 0);
}

#[test]
fn sin_sesion_en_engram_la_vuelve_a_abrir_una_vez() {
    // Medido: "session not found" (404) si la sesión no existe; nada se guardó
    let posts = Arc::new(Mutex::new(0));
    let p2 = posts.clone();
    let f = falso(move |p| {
        if p.metodo == "POST" && p.ruta == "/observations" {
            let mut n = p2.lock().unwrap();
            *n += 1;
            if *n == 1 { (404, r#"{"error":"session not found"}"#.into()) } else { (201, r#"{"id":3,"status":"saved"}"#.into()) }
        } else {
            comun(p)
        }
    });
    let e = engram(&f, None);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(3));
    assert_eq!(f.cuantos("POST", "/sessions"), 2);
    assert_eq!(f.cuantos("POST", "/observations"), 2);
}

// ---------------------------------------------------------------- Bearer

#[test]
fn bearer_solo_si_existe_el_token() {
    let f = falso(comun);
    let e = engram(&f, Some("secreto-de-prueba"));
    assert_eq!(e.guardar(&charla(), "Avi"), Some(7));
    assert!(f.pedidos().iter().all(|p| p.cabecera("authorization").as_deref() == Some("Bearer secreto-de-prueba")));
    let f = falso(comun);
    let e = engram(&f, None);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(7));
    assert!(f.pedidos().iter().all(|p| p.cabecera("authorization").is_none()));
    // Un token vacío del entorno es como no tenerlo
    assert_eq!(token_de(Some(String::from("  "))), None);
    assert_eq!(token_de(Some(String::from("abc"))), Some(String::from("abc")));
    assert_eq!(token_de(None), None);
}

#[test]
fn el_puerto_sale_de_engram_port_o_es_7437() {
    assert_eq!(base_de(None), "http://127.0.0.1:7437");
    assert_eq!(base_de(Some(String::from("7499"))), "http://127.0.0.1:7499");
    assert_eq!(base_de(Some(String::from("no"))), "http://127.0.0.1:7437");
}

// ---------------------------------------------------------------- borrar

fn con_observacion(proyecto: &'static str, tema: &'static str) -> Falso {
    falso(move |p| match (p.metodo.as_str(), p.ruta.split('?').next().unwrap_or_default()) {
        ("GET", "/observations/7") => (200, json!({ "id": 7, "project": proyecto, "scope": "project", "topic_key": tema, "type": "conversation" }).to_string()),
        ("DELETE", "/observations/7") => (200, r#"{"hard_delete":false,"id":7,"status":"deleted"}"#.into()),
        _ => comun(p),
    })
}

#[test]
fn borrar_solo_lo_de_avis() {
    let f = con_observacion("avis", "avis/chat/c-1");
    assert!(engram(&f, None).borrar(7));
    let borrado = f.pedidos().into_iter().find(|p| p.metodo == "DELETE").unwrap();
    assert_eq!(borrado.ruta, "/observations/7?expected_project=avis");
    // Nunca algo sin project "avis" ni sin el tema avis/
    for (proyecto, tema) in [("oficina", "avis/chat/c-1"), ("avis", "decisiones/chat"), ("avis", "")] {
        let f = con_observacion(proyecto, tema);
        assert!(!engram(&f, None).borrar(7), "{proyecto} {tema}");
        assert_eq!(f.cuantos("DELETE", "/"), 0, "{proyecto} {tema}");
    }
    // Lo que ya no existe en Engram (medido: 404 "observation not found") cuenta como borrado
    let f = falso(|p| if p.ruta.starts_with("/observations/8") { (404, r#"{"error":"observation not found"}"#.into()) } else { comun(p) });
    assert!(engram(&f, None).borrar(8));
    assert_eq!(f.cuantos("DELETE", "/"), 0);
}

// ---------------------------------------------------------------- cerrar

#[test]
fn cerrar_termina_la_sesion_solo_si_se_abrio() {
    let f = falso(comun);
    let e = engram(&f, None);
    e.cerrar();
    assert_eq!(f.pedidos().len(), 0);
    assert_eq!(e.guardar(&charla(), "Avi"), Some(7));
    e.cerrar();
    assert_eq!(f.cuantos("POST", "/sessions/avis-arranque/end"), 1);
}

// ---------------------------------------------------------------- contra un Engram de verdad (a mano)
//
// Nunca el del usuario: solo con `AVIS_ENGRAM_PRUEBA` apuntando a un `engram serve <puerto>` aparte,
// con su propio ENGRAM_DATA_DIR en un directorio temporal:
// `AVIS_ENGRAM_PRUEBA=http://127.0.0.1:7499 cargo test real_engram -- --ignored --nocapture`.

#[test]
#[ignore]
fn real_engram_guardar_buscar_sin_tocar_otro_proyecto_y_borrar() {
    let base = std::env::var("AVIS_ENGRAM_PRUEBA").expect("AVIS_ENGRAM_PRUEBA con un Engram aparte (nunca el 7437 del usuario)");
    assert!(!base.ends_with(":7437"), "nunca el Engram del usuario");
    let carpeta = std::env::temp_dir().join(format!("avis-engram-real-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&carpeta);
    let e = Engram::nuevo(base.clone(), None, format!("avis-prueba-{}", std::process::id()));
    assert!(e.hay());
    // Otro proyecto con su propia observación, para mirar su contexto
    let otro = |metodo: &str, ruta: &str, cuerpo: Option<Value>| -> Value {
        let a = agente(Duration::from_secs(5));
        let url = format!("{base}{ruta}");
        let mut r = match (metodo, cuerpo) {
            ("POST", Some(c)) => a.post(&url).header("Content-Type", "application/json").send(c.to_string()).unwrap(),
            _ => a.get(&url).call().unwrap(),
        };
        let t = r.body_mut().read_to_string().unwrap();
        serde_json::from_str(&t).unwrap_or(Value::String(t))
    };
    otro("POST", "/sessions", Some(json!({ "id": "oficina-prueba", "project": "oficina", "ownership_mode": "project_owned" })));
    otro("POST", "/observations", Some(json!({ "session_id": "oficina-prueba", "project": "oficina", "scope": "project", "type": "decision", "title": "Decisión de oficina", "content": "Algo de oficina", "capture_prompt": false })));
    // La charla: el archivo y su copia
    let mut doc = charla();
    doc["mensajes"][0]["texto"] = json!("Mi color favorito es el turquesa");
    let doc = crate::historial::guardar(&carpeta, &doc).unwrap();
    let id = e.guardar(&doc, "Ascua").expect("no se guardó en Engram");
    crate::historial::poner_engram(&carpeta, "c-1", id).unwrap();
    let busca = otro("GET", "/search?q=turquesa&project=avis&type=conversation&response_format=compact", None);
    println!("search avis: {busca}");
    assert!(busca["results"].as_array().unwrap().iter().any(|r| r["id"] == id && r["topic_key"] == "avis/chat/c-1"));
    let contexto = otro("GET", "/context?project=oficina", None);
    println!("context oficina: {}", contexto.to_string().chars().take(400).collect::<String>());
    let ctx = contexto.to_string();
    assert!(ctx.contains("Decisión de oficina") || ctx.contains("Decisi"));
    assert!(!ctx.contains("turquesa") && !ctx.contains("Chat de Avis"));
    // Borrar quita el archivo y la observación
    let engram_id = crate::historial::borrar(&carpeta, "c-1").unwrap();
    assert_eq!(engram_id, Some(id));
    assert!(e.borrar(id));
    let busca = otro("GET", "/search?q=turquesa&project=avis&type=conversation&response_format=compact", None);
    assert_eq!(busca["results"], json!([]));
    assert!(crate::historial::listar(&carpeta).is_empty());
    e.cerrar();
    let _ = std::fs::remove_dir_all(&carpeta);
}
