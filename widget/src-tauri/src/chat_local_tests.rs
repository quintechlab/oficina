//! Los tests del motor local en la charla (docs/diseno/chat-avis-ux.md 8 y 14.2.9): el cuerpo del
//! pedido, el recorte de 3000 tokens (D22), el parseo de SSE sobre lo medido de llama-server (b12606,
//! `fixtures/local/*.sse`) y el turno entero contra un servidor falso en 127.0.0.1.

use super::*;
use crate::chat::{Chat, Emisor, Lanzador, Lanzamiento, Tiempos};
use std::io::{BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Medido el 24/11 contra llama-server b12606 con Qwen3-4B-Instruct-2507 (el modelo, la hora y el id, cambiados).
const COMPLETO: &str = include_str!("fixtures/local/completo.sse");
/// El mismo pedido con `max_tokens: 4`: `finish_reason: "length"`.
const CORTADO: &str = include_str!("fixtures/local/cortado.sse");

fn usuario(t: &str) -> Mensaje {
    Mensaje { rol: Rol::Usuario, texto: t.to_string() }
}

fn mascota(t: &str) -> Mensaje {
    Mensaje { rol: Rol::Mascota, texto: t.to_string() }
}

fn costo_total(sistema: &str, r: &Recorte) -> usize {
    costo(sistema) + r.historia.iter().map(|m| costo(&m.texto)).sum::<usize>() + costo(&r.ultimo)
}

// ---------------------------------------------------------------- el cuerpo y el recorte (8, D22)

#[test]
fn el_sistema_lleva_la_instruccion_con_la_mascota_y_el_bloque_avis() {
    let s = sistema_local("Ascua", None, "proyectos:\n  -\n    nombre: catalogo");
    assert!(s.starts_with("Sos Ascua, la mascota de Avis"), "{s}");
    assert!(s.contains("si no sabés algo de las sesiones, decilo"));
    assert!(s.ends_with("<avis>\nproyectos:\n  -\n    nombre: catalogo\n</avis>"), "{s}");
    // Sin herramientas: nunca promete leer archivos
    assert!(!s.contains("{Mascota}"));
    // Sin sesiones, el bloque lo dice (así no inventa)
    assert!(sistema_local("Avi", None, "  ").ends_with(&format!("<avis>\n{SIN_SESIONES}\n</avis>")));
    // Un nombre raro vuelve a "Avi", como en Claude Code
    assert!(sistema_local("", None, "x").starts_with("Sos Avi,"));
}

#[test]
fn el_cuerpo_pide_stream_con_la_cache_y_700_tokens() {
    let r = Recorte { historia: vec![usuario("¿Quién me espera?"), mascota("Nadie.")], ultimo: String::from("¿Y en catalogo?") };
    let c = cuerpo_local("SISTEMA", &r);
    assert_eq!(c["stream"], true);
    assert_eq!(c["cache_prompt"], true);
    assert_eq!(c["max_tokens"], 700);
    let m = c["messages"].as_array().unwrap();
    assert_eq!(m.len(), 4);
    assert_eq!(m[0], json!({ "role": "system", "content": "SISTEMA" }));
    assert_eq!(m[1], json!({ "role": "user", "content": "¿Quién me espera?" }));
    assert_eq!(m[2], json!({ "role": "assistant", "content": "Nadie." }));
    assert_eq!(m[3], json!({ "role": "user", "content": "¿Y en catalogo?" }));
    // Sin herramientas (sin --jinja, 8): ni tools ni nada que llame afuera
    assert!(c.get("tools").is_none());
}

#[test]
fn el_recorte_deja_todo_cuando_entra() {
    let h = vec![usuario("Hola"), mascota("¡Hola!"), usuario("¿Qué hay?"), mascota("Dos sesiones.")];
    let r = recorte_local("SISTEMA", &h, "¿Y ahora?");
    assert_eq!(r.historia, h);
    assert_eq!(r.ultimo, "¿Y ahora?");
}

#[test]
fn el_recorte_saca_primero_los_turnos_viejos_y_nunca_pasa_de_3000_tokens() {
    let largo = |n: usize| "palabra ".repeat(n);
    // Cada turno cuesta unos 1150 tokens: entran el bloque, el último y solo el turno más nuevo
    let h = vec![
        usuario("viejo"), mascota(&largo(500)),
        usuario("medio"), mascota(&largo(500)),
        usuario("nuevo"), mascota(&largo(500)),
    ];
    let sistema = format!("SISTEMA <avis>{}</avis>", "x".repeat(3000));
    let r = recorte_local(&sistema, &h, "¿Y ahora?");
    assert_eq!(r.historia.first().map(|m| m.texto.as_str()), Some("nuevo"), "el más nuevo queda");
    assert_eq!(r.historia.len(), 2, "los viejos se caen, por turno entero");
    assert!(costo_total(&sistema, &r) <= TOPE_TOKENS);
    assert_eq!(r.ultimo, "¿Y ahora?", "el último siempre va");
    // Un turno del medio que no entra corta ahí: nunca se salta a uno más viejo
    let h2 = vec![usuario("viejo"), mascota("corto"), usuario("medio"), mascota(&largo(3000)), usuario("nuevo"), mascota("corto")];
    let r2 = recorte_local("SISTEMA", &h2, "?");
    assert_eq!(r2.historia, vec![usuario("nuevo"), mascota("corto")]);
}

#[test]
fn el_recorte_con_un_ultimo_mensaje_enorme_lo_corta_y_deja_el_bloque() {
    let sistema = format!("SISTEMA <avis>{}</avis>", "x".repeat(6000));
    let ultimo = "a".repeat(20_000);
    let r = recorte_local(&sistema, &[usuario("antes"), mascota("sí")], &ultimo);
    assert!(r.historia.is_empty());
    assert!(r.ultimo.starts_with("aaaa") && r.ultimo.ends_with('…'));
    assert!(costo_total(&sistema, &r) <= TOPE_TOKENS);
}

#[test]
fn el_recorte_descarta_una_respuesta_suelta_del_principio() {
    let r = recorte_local("S", &[mascota("huérfana"), usuario("Hola"), mascota("¡Hola!")], "?");
    assert_eq!(r.historia, vec![usuario("Hola"), mascota("¡Hola!")]);
}

#[test]
fn la_historia_de_la_ventana_se_lee_con_cuidado() {
    let v = json!([
        { "rol": "usuario", "texto": "Hola" },
        { "rol": "mascota", "texto": "¡Hola!" },
        { "rol": "otro", "texto": "x" },
        { "rol": "usuario", "texto": "" },
        { "rol": "mascota" },
        "basura",
        { "rol": "usuario", "texto": "¿Qué hay?" },
    ]);
    assert_eq!(historia_de(&v), vec![usuario("Hola"), mascota("¡Hola!"), usuario("¿Qué hay?")]);
    assert!(historia_de(&Value::Null).is_empty());
    // Como mucho 200 mensajes, los últimos
    let muchos = Value::Array((0..250).map(|n| json!({ "rol": "usuario", "texto": format!("m{n}") })).collect());
    let h = historia_de(&muchos);
    assert_eq!(h.len(), 200);
    assert_eq!(h[0].texto, "m50");
}

#[test]
fn el_costo_es_3_5_caracteres_por_token_mas_el_del_mensaje() {
    assert_eq!(costo(""), TOKENS_POR_MENSAJE);
    assert_eq!(costo("1234567"), 2 + TOKENS_POR_MENSAJE);
    assert_eq!(costo("12345678"), 3 + TOKENS_POR_MENSAJE);
    // Cuenta caracteres, no bytes
    assert_eq!(costo("ñññññññ"), 2 + TOKENS_POR_MENSAJE);
}

// ---------------------------------------------------------------- SSE (medido)

#[test]
fn las_lineas_sse_medidas() {
    let lineas: Vec<&str> = COMPLETO.lines().filter(|l| !l.is_empty()).collect();
    assert_eq!(linea_sse(lineas[0]), Sse::Rol);
    assert_eq!(linea_sse(lineas[1]), Sse::Texto(String::from("¡")));
    assert_eq!(linea_sse(lineas[lineas.len() - 2]), Sse::Fin { cortado: false });
    assert_eq!(linea_sse(lineas[lineas.len() - 1]), Sse::Hecho);
    let corto: Vec<&str> = CORTADO.lines().filter(|l| !l.is_empty()).collect();
    assert_eq!(linea_sse(corto[corto.len() - 2]), Sse::Fin { cortado: true });
    assert_eq!(linea_sse("data: [DONE]"), Sse::Hecho);
}

#[test]
fn las_lineas_sse_raras_no_rompen() {
    assert_eq!(linea_sse(""), Sse::Nada);
    assert_eq!(linea_sse(": ping"), Sse::Nada);
    assert_eq!(linea_sse("data: {roto"), Sse::Nada);
    assert_eq!(linea_sse("data: {\"choices\":[]}"), Sse::Nada);
    assert_eq!(linea_sse("data: {\"choices\":[{\"delta\":{\"content\":\"\"}}]}"), Sse::Nada);
    assert_eq!(linea_sse("data: {\"error\":{\"code\":500,\"message\":\"se cayó\"}}"), Sse::Error(String::from("se cayó")));
    assert_eq!(linea_sse("error: {\"code\":500,\"message\":\"otra\"}"), Sse::Error(String::from("otra")));
}

fn leer(texto: &str, frenar: &AtomicBool) -> (FinLectura, Vec<Avance>) {
    let mut vistos = Vec::new();
    let mut lector = BufReader::new(texto.as_bytes());
    let fin = leer_sse(&mut lector, frenar, &mut |a| vistos.push(a));
    (fin, vistos)
}

#[test]
fn leer_un_stream_entero() {
    let (fin, vistos) = leer(COMPLETO, &AtomicBool::new(false));
    assert_eq!(fin, FinLectura::Hecho { cortado: false });
    assert_eq!(vistos[0], Avance::Rol);
    let texto: String = vistos.iter().filter_map(|a| if let Avance::Texto(t) = a { Some(t.as_str()) } else { None }).collect();
    assert_eq!(texto, "¡A ver si es el tío que me trajo el mate! 😏");
    assert_eq!(leer(CORTADO, &AtomicBool::new(false)).0, FinLectura::Hecho { cortado: true });
}

#[test]
fn un_stream_que_se_corta_sin_done_es_cortado() {
    let mitad: String = COMPLETO.lines().take(9).map(|l| format!("{l}\n")).collect();
    assert_eq!(leer(&mitad, &AtomicBool::new(false)).0, FinLectura::Cortado);
    // Con el fin pero sin [DONE], terminó bien
    let sin_done: String = COMPLETO.lines().filter(|l| !l.contains("[DONE]")).map(|l| format!("{l}\n")).collect();
    assert_eq!(leer(&sin_done, &AtomicBool::new(false)).0, FinLectura::Hecho { cortado: false });
}

#[test]
fn frenar_deja_de_leer_y_no_avisa_mas_texto() {
    let frenar = AtomicBool::new(true);
    let (fin, vistos) = leer(COMPLETO, &frenar);
    assert_eq!(fin, FinLectura::Frenado);
    assert!(vistos.is_empty());
}

#[test]
fn los_errores_del_motor_se_leen() {
    // Medido: un pedido que no entra en el contexto es un 400 antes del stream
    let cuerpo = r#"{"error":{"code":400,"message":"request (12009 tokens) exceeds the available context size (4096 tokens), try increasing it","type":"exceed_context_size_error","n_prompt_tokens":12009,"n_ctx":4096}}"#;
    assert_eq!(error_http(400, cuerpo), "La charla ya no entra en el modelo de esta PC: empezá una charla nueva");
    assert_eq!(error_http(503, r#"{"error":{"code":503,"message":"Loading model"}}"#), "el motor respondió 503: Loading model");
    assert_eq!(error_http(500, "no es json"), "el motor respondió 500");
}

// ---------------------------------------------------------------- el turno entero contra un servidor falso

/// Lo que vio el servidor falso: el cuerpo del pedido y si el cliente cortó antes del final.
#[derive(Default)]
struct Visto {
    cuerpo: Mutex<Option<Value>>,
    cortaron: AtomicBool,
    escritas: AtomicUsize,
}

/// Un llama-server falso en 127.0.0.1: atiende un pedido y escribe `lineas` (una cada `pausa`), con
/// `estado` como respuesta. Anota si el cliente cerró la conexión antes de terminar.
fn servidor(estado: u16, lineas: Vec<String>, pausa: Duration) -> (u16, Arc<Visto>) {
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let puerto = l.local_addr().unwrap().port();
    let visto = Arc::new(Visto::default());
    let v = visto.clone();
    std::thread::spawn(move || {
        let Ok((mut s, _)) = l.accept() else { return };
        let cuerpo = leer_pedido(&mut s);
        *v.cuerpo.lock().unwrap() = serde_json::from_slice(&cuerpo).ok();
        let tipo = if estado == 200 { "text/event-stream" } else { "application/json" };
        if s.write_all(format!("HTTP/1.1 {estado} X\r\nContent-Type: {tipo}\r\nConnection: close\r\n\r\n").as_bytes()).is_err() {
            return;
        }
        for linea in &lineas {
            std::thread::sleep(pausa);
            if s.write_all(format!("{linea}\n").as_bytes()).and_then(|()| s.flush()).is_err() {
                v.cortaron.store(true, Ordering::SeqCst);
                return;
            }
            v.escritas.fetch_add(1, Ordering::SeqCst);
        }
    });
    (puerto, visto)
}

fn leer_pedido(s: &mut TcpStream) -> Vec<u8> {
    let mut todo = Vec::new();
    let mut buf = [0u8; 4096];
    loop {
        let n = s.read(&mut buf).unwrap_or(0);
        if n == 0 {
            return Vec::new();
        }
        todo.extend_from_slice(&buf[..n]);
        if let Some(fin) = todo.windows(4).position(|w| w == b"\r\n\r\n") {
            let cabeza = String::from_utf8_lossy(&todo[..fin]).to_lowercase();
            let largo: usize = cabeza.lines().find_map(|l| l.strip_prefix("content-length:")).and_then(|n| n.trim().parse().ok()).unwrap_or(0);
            while todo.len() < fin + 4 + largo {
                let n = s.read(&mut buf).unwrap_or(0);
                if n == 0 {
                    break;
                }
                todo.extend_from_slice(&buf[..n]);
            }
            return todo[fin + 4..].to_vec();
        }
    }
}

struct UsoFalso;
impl UsoMotor for UsoFalso {
    fn diagnostico(&self) -> Option<String> {
        None
    }
}

#[derive(Clone, Default)]
struct Recibidos(Arc<Mutex<Vec<Value>>>);

impl Recibidos {
    fn emisor(&self) -> Emisor {
        let r = self.0.clone();
        Arc::new(move |v| r.lock().unwrap().push(v))
    }
    fn todos(&self) -> Vec<Value> {
        self.0.lock().unwrap().clone()
    }
    fn tipos(&self) -> Vec<String> {
        self.todos().iter().map(|v| v["tipo"].as_str().unwrap_or("").to_string()).collect()
    }
    fn esperar_final(&self) {
        let limite = Instant::now() + Duration::from_secs(10);
        while Instant::now() < limite {
            if self.tipos().iter().any(|t| t == "fin" || t == "error" || t == "frenada") {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        panic!("no llegó el final: {:?}", self.tipos());
    }
}

fn carpeta_temporal() -> PathBuf {
    let c = std::env::temp_dir().join(format!("avis-chat-local-{}", crate::chat::nuevo_uuid()));
    std::fs::create_dir_all(&c).unwrap();
    c
}

/// Un chat cuyo lanzador de Claude Code cuenta (y falla): una charla local nunca lo usa (regla 3).
fn chat_local(motor: Option<MotorLocal>) -> (Chat, Recibidos, Arc<AtomicUsize>, PathBuf) {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let lanzados = Arc::new(AtomicUsize::new(0));
    let cuenta = lanzados.clone();
    let lanzador: Lanzador = Arc::new(move |_l: &Lanzamiento| {
        cuenta.fetch_add(1, Ordering::SeqCst);
        Err(std::io::Error::new(std::io::ErrorKind::NotFound, "no"))
    });
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    if let Some(m) = motor {
        chat.poner_motor_local(m);
    }
    (chat, r, lanzados, carpeta)
}

fn motor_en(puerto: u16) -> MotorLocal {
    Arc::new(move || Ok((puerto, Box::new(UsoFalso) as Box<dyn UsoMotor>)))
}

fn lineas_de(texto: &str) -> Vec<String> {
    texto.lines().map(String::from).collect()
}

#[test]
fn un_turno_local_responde_en_streaming_sin_lanzar_claude() {
    let (puerto, visto) = servidor(200, lineas_de(COMPLETO), Duration::from_millis(2));
    let (chat, r, lanzados, carpeta) = chat_local(Some(motor_en(puerto)));
    let abierto = chat.abrir("c-l1", "local", None, "Ascua", None).unwrap();
    assert_eq!(abierto["proceso"], "apagado");
    let datos = json!({ "proyectos": [{ "nombre": "catalogo", "sesiones": [{ "actividad": "editando ventas.ts" }] }] });
    let historia = json!([{ "rol": "usuario", "texto": "Hola" }, { "rol": "mascota", "texto": "¡Hola!" }]);
    chat.enviar_con("c-l1", 3, "¿Quién me está esperando?", &[], &datos, &historia).unwrap();
    r.esperar_final();
    let tipos = r.tipos();
    assert_eq!(tipos.first().map(String::as_str), Some("listo"));
    assert_eq!(&tipos[1..3], ["recibido", "pensando"]);
    assert_eq!(tipos.last().map(String::as_str), Some("fin"));
    let texto: String = r.todos().iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap().to_string()).collect();
    assert_eq!(texto, "¡A ver si es el tío que me trajo el mate! 😏");
    for v in r.todos() {
        assert_eq!(v["conversacion"], "c-l1");
        assert_eq!(v["turno"], 3);
    }
    assert_eq!(lanzados.load(Ordering::SeqCst), 0, "nunca a la nube");
    // Lo que se le mandó al motor: la instrucción con la mascota y los datos, la historia y la pregunta
    let cuerpo = visto.cuerpo.lock().unwrap().clone().expect("el pedido");
    assert_eq!(cuerpo["stream"], true);
    let m = cuerpo["messages"].as_array().unwrap();
    let sistema = m[0]["content"].as_str().unwrap();
    assert!(sistema.starts_with("Sos Ascua,") && sistema.contains("<avis>\nproyectos:") && sistema.contains("editando ventas.ts"), "{sistema}");
    assert_eq!(m[1]["content"], "Hola");
    assert_eq!(m[2]["role"], "assistant");
    assert_eq!(m[3], json!({ "role": "user", "content": "¿Quién me está esperando?" }));
    // Sin nombre de usuario, no lo nombra
    assert!(!sistema.contains("La persona se llama"), "{sistema}");
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}

#[test]
fn un_turno_local_nombra_al_usuario_desde_el_turno_siguiente() {
    // #37 S3: el motor local toma el nombre en cada turno (no hay proceso que relanzar)
    let (puerto, visto) = servidor(200, lineas_de(COMPLETO), Duration::from_millis(2));
    let (chat, r, _, carpeta) = chat_local(Some(motor_en(puerto)));
    chat.abrir("c-l-usu", "local", None, "Pancho", None).unwrap();
    chat.poner_usuario("Nico");
    chat.enviar_con("c-l-usu", 1, "Hola", &[], &json!({}), &json!([])).unwrap();
    r.esperar_final();
    let cuerpo = visto.cuerpo.lock().unwrap().clone().expect("el pedido");
    let sistema = cuerpo["messages"][0]["content"].as_str().unwrap().to_string();
    assert!(sistema.starts_with("Sos Pancho,") && sistema.contains("La persona se llama Nico: llamala por su nombre."), "{sistema}");
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}

#[test]
fn frenar_un_turno_local_corta_la_conexion() {
    // Muchas líneas lentas: frenar a mitad deja de leer y el servidor ve la conexión cerrada
    let mut lineas = Vec::new();
    lineas.push(COMPLETO.lines().next().unwrap().to_string());
    for k in 0..400 {
        lineas.push(format!("data: {}", json!({ "choices": [{ "delta": { "content": format!("p{k} ") } }] })));
    }
    let (puerto, visto) = servidor(200, lineas, Duration::from_millis(10));
    let (chat, r, _, carpeta) = chat_local(Some(motor_en(puerto)));
    chat.abrir("c-l2", "local", None, "Avi", None).unwrap();
    chat.enviar_con("c-l2", 1, "Contame algo largo", &[], &Value::Null, &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(5);
    while !r.tipos().contains(&String::from("texto")) && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(5));
    }
    chat.frenar("c-l2", 1);
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("frenada"));
    // El servidor ve el corte: deja de escribir mucho antes del final
    let limite = Instant::now() + Duration::from_secs(5);
    while !visto.cortaron.load(Ordering::SeqCst) && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert!(visto.cortaron.load(Ordering::SeqCst), "llama-server deja de generar cuando se corta la conexión");
    assert!(visto.escritas.load(Ordering::SeqCst) < 200);
    // Y el turno siguiente sale
    let (puerto2, _) = servidor(200, lineas_de(COMPLETO), Duration::from_millis(1));
    chat.poner_motor_local(motor_en(puerto2));
    let antes = r.todos().len();
    chat.enviar_con("c-l2", 2, "Otra", &[], &Value::Null, &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(10);
    while !r.todos()[antes..].iter().any(|v| v["tipo"] == "fin") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert!(r.todos()[antes..].iter().any(|v| v["tipo"] == "fin" && v["turno"] == 2));
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}

#[test]
fn un_turno_local_por_vez_y_sin_archivos() {
    let lineas: Vec<String> = std::iter::repeat_n(format!("data: {}", json!({ "choices": [{ "delta": { "content": "x" } }] })), 300).collect();
    let (puerto, _) = servidor(200, lineas, Duration::from_millis(10));
    let (chat, r, _, carpeta) = chat_local(Some(motor_en(puerto)));
    chat.abrir("c-l3", "local", None, "Avi", None).unwrap();
    chat.enviar_con("c-l3", 1, "Hola", &[], &Value::Null, &Value::Null).unwrap();
    assert!(chat.enviar_con("c-l3", 2, "Otra", &[], &Value::Null, &Value::Null).is_err(), "D7: sin cola");
    assert!(chat.enviar_con("c-l3", 3, "  ", &[], &Value::Null, &Value::Null).is_err(), "vacío");
    assert!(chat.enviar_con("c-l3", 4, "Leé esto", &[String::from("C:\\a.pdf")], &Value::Null, &Value::Null).is_err(), "el modelo local no lee archivos");
    chat.frenar("c-l3", 1);
    r.esperar_final();
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}

#[test]
fn sin_motor_o_con_el_motor_caido_es_el_error_local() {
    // Sin el modelo: el error local con su detalle, nada a la nube
    let falta: MotorLocal = Arc::new(|| Err(String::from("falta el modelo de esta PC")));
    let (chat, r, lanzados, carpeta) = chat_local(Some(falta));
    chat.abrir("c-l4", "local", None, "Avi", None).unwrap();
    chat.enviar_con("c-l4", 1, "Hola", &[], &Value::Null, &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.todos(), vec![json!({ "conversacion": "c-l4", "turno": 1, "tipo": "error", "motivo": "local", "detalle": "falta el modelo de esta PC" })]);
    assert_eq!(lanzados.load(Ordering::SeqCst), 0);
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
    // El motor responde un 400 (la charla no entra): el error local con el texto legible
    let (puerto, _) = servidor(400, vec![String::from(r#"{"error":{"code":400,"message":"x","type":"exceed_context_size_error"}}"#)], Duration::ZERO);
    let (chat, r, _, carpeta) = chat_local(Some(motor_en(puerto)));
    chat.abrir("c-l5", "local", None, "Avi", None).unwrap();
    chat.enviar_con("c-l5", 1, "Hola", &[], &Value::Null, &Value::Null).unwrap();
    r.esperar_final();
    let ultimo = r.todos().last().cloned().unwrap();
    assert_eq!(ultimo["motivo"], "local");
    assert_eq!(ultimo["detalle"], "La charla ya no entra en el modelo de esta PC: empezá una charla nueva");
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
    // El stream se corta sin terminar (el motor se cayó)
    let mitad: Vec<String> = COMPLETO.lines().take(9).map(String::from).collect();
    let (puerto, _) = servidor(200, mitad, Duration::from_millis(1));
    let (chat, r, _, carpeta) = chat_local(Some(motor_en(puerto)));
    chat.abrir("c-l6", "local", None, "Avi", None).unwrap();
    chat.enviar_con("c-l6", 1, "Hola", &[], &Value::Null, &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.todos().last().unwrap()["motivo"], "local");
    assert_eq!(r.tipos().iter().filter(|t| *t == "error").count(), 1);
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}

#[test]
fn sin_motor_configurado_tampoco_va_a_la_nube() {
    let (chat, r, lanzados, carpeta) = chat_local(None);
    chat.abrir("c-l7", "local", None, "Avi", None).unwrap();
    chat.enviar_con("c-l7", 1, "Hola", &[], &Value::Null, &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.todos().last().unwrap()["motivo"], "local");
    assert_eq!(lanzados.load(Ordering::SeqCst), 0);
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}

/// Con el motor de verdad (`%LOCALAPPDATA%\avis-ia`, sin bajar nada): `cargo test --lib real_local -- --ignored`.
/// Arranca llama-server como lo hace Avis, pregunta por una sesión y frena una respuesta larga.
#[test]
#[ignore]
fn real_local_responde_en_streaming_y_frenar_corta() {
    let r = Recibidos::default();
    let carpeta = carpeta_temporal();
    let lanzador: Lanzador = Arc::new(|_l: &Lanzamiento| Err(std::io::Error::other("nunca claude")));
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_motor_local(Arc::new(|| crate::modelo::IA.motor_charla(&|_| {}).map(|(p, u)| (p, Box::new(u) as Box<dyn UsoMotor>))));
    chat.abrir("c-real", "local", None, "Avi", None).unwrap();
    let datos = json!({ "proyectos": [{ "nombre": "catalogo", "sesiones": [{ "tarea": 12, "actividad": "editando ventas.ts", "abierta_hace": "hace 20 min",
        "preguntas": [{ "encabezado": "Base de datos", "pregunta": "¿Uso Postgres o SQLite para las pruebas?" }] }] }] });
    let t0 = Instant::now();
    chat.enviar_con("c-real", 1, "¿Qué pregunta tengo pendiente?", &[], &datos, &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(300);
    let (mut listo, mut primero) = (None, None);
    while !r.tipos().iter().any(|t| t == "fin" || t == "error") && Instant::now() < limite {
        let tipos = r.tipos();
        if listo.is_none() && tipos.iter().any(|t| t == "listo") {
            listo = Some(t0.elapsed());
        }
        if primero.is_none() && tipos.iter().any(|t| t == "texto") {
            primero = Some(t0.elapsed());
        }
        std::thread::sleep(Duration::from_millis(5));
    }
    println!("motor listo a {listo:?}, primer texto a {primero:?}");
    let todos = r.todos();
    let texto: String = todos.iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap().to_string()).collect();
    let tramos = todos.iter().filter(|v| v["tipo"] == "texto").count();
    println!("primer turno en {:?}: {:?}\n{texto}", t0.elapsed(), r.tipos().iter().filter(|t| *t != "texto").collect::<Vec<_>>());
    assert_eq!(todos.last().unwrap()["tipo"], "fin", "{todos:?}");
    assert!(tramos > 1, "en streaming: {tramos} tramos");
    assert!(texto.to_lowercase().contains("postgres") || texto.to_lowercase().contains("sqlite"), "{texto}");
    // Frenar una respuesta larga a mitad
    let antes = todos.len();
    chat.enviar_con("c-real", 2, "Escribime un cuento largo de diez párrafos sobre una mascota.", &[], &datos, &json!([{ "rol": "usuario", "texto": "¿Qué pregunta tengo pendiente?" }, { "rol": "mascota", "texto": texto }])).unwrap();
    let limite = Instant::now() + Duration::from_secs(120);
    while r.todos()[antes..].iter().filter(|v| v["tipo"] == "texto").count() < 3 && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(10));
    }
    let frenado = Instant::now();
    chat.frenar("c-real", 2);
    let limite = Instant::now() + Duration::from_secs(10);
    while !r.todos()[antes..].iter().any(|v| v["tipo"] == "frenada" || v["tipo"] == "fin") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(5));
    }
    println!("frenada a {:?} del clic", frenado.elapsed());
    assert!(r.todos()[antes..].iter().any(|v| v["tipo"] == "frenada"));
    // llama-server ve la conexión cerrada y deja de generar (su registro lo dice)
    std::thread::sleep(Duration::from_millis(800));
    let registro = std::fs::read_to_string(crate::modelo::carpeta_base().unwrap().join("motor.log")).unwrap_or_default();
    let cancela = registro.lines().find(|l| l.contains("cancel task")).unwrap_or("");
    println!("registro: {cancela}");
    assert!(!cancela.is_empty(), "llama-server no canceló la tarea");
    crate::modelo::IA.apagar();
    chat.apagar();
    let _ = std::fs::remove_dir_all(carpeta);
}
