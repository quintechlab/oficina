// Tests de mcp_avis.rs (#43, docs/diseno/chat-herramientas-ux.md 11.1, 11.4, 11.7, 11.9 y 11.10
// puntos 11 y 12): un cliente HTTP de prueba contra el servidor en 127.0.0.1, sin `claude`. Las
// carpetas de tareas son temporales, fuera del repositorio.
use super::*;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicUsize, Ordering};

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-mcp-test-{}-{n}", std::process::id()));
    let _ = std::fs::remove_dir_all(&c);
    std::fs::create_dir_all(&c).unwrap();
    c
}

/// Miércoles 25/11/2026 a las 12:00 de Argentina (15:00 UTC), en ms.
const MEDIODIA: i64 = 1_795_618_800_000;

fn ms_argentina(fecha_hora: &str) -> i64 {
    let local = chrono::NaiveDateTime::parse_from_str(fecha_hora, "%Y-%m-%d %H:%M").unwrap();
    local.and_utc().timestamp_millis() + 3 * 3_600_000
}

#[derive(Clone, Default)]
struct Avisos(Arc<Mutex<Vec<Value>>>);

impl Avisos {
    fn emisor(&self) -> Emisor {
        let a = self.0.clone();
        Arc::new(move |v| a.lock().unwrap().push(v))
    }
    fn todos(&self) -> Vec<Value> {
        self.0.lock().unwrap().clone()
    }
}

struct Prueba {
    mcp: McpAvis,
    carpeta: PathBuf,
    /// `<config>/habitos` de la prueba (#43 C3), aparte de la de tareas.
    habitos: PathBuf,
    chat: Avisos,
    tareas: Avisos,
    avisos_habitos: Avisos,
    token: String,
}

impl Drop for Prueba {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.carpeta);
        let _ = std::fs::remove_dir_all(&self.habitos);
    }
}

fn lista(id: &str, nombre: &str, orden: u64, tareas: Value) -> Value {
    json!({ "v": 1, "id": id, "nombre": nombre, "color": "verde", "orden": orden, "creada": 1_764_000_000_000u64, "tareas": tareas })
}

fn tarea(id: &str, titulo: &str, fecha: Value) -> Value {
    json!({ "id": id, "titulo": titulo, "hecha": false, "hechaEn": null, "fecha": fecha, "importante": false, "notas": "", "subtareas": [], "creada": 1_764_000_000_000u64 })
}

/// Un hábito del formato v1 de habitos.rs: sí/no con `inicio` el 1/11; `extra` pisa lo que haga falta.
fn habito(id: &str, nombre: &str, extra: Value) -> Value {
    let mut h = json!({
        "v": 1, "id": id, "nombre": nombre, "tipo": "diario", "meta": 1, "unidad": "", "dias": [], "veces": 1, "aviso": null,
        "color": "celeste", "orden": 0, "creado": 1_762_000_000_000u64, "inicio": "2026-11-01", "mejor": 0, "registro": {},
    });
    for (k, v) in extra.as_object().unwrap() {
        h[k] = v.clone();
    }
    h
}

/// Un servidor con dos listas (Casa primero por `orden`, Compras después), cuatro hábitos (Agua de 8
/// vasos con 2 hoy, Caminar todos los días, Yoga solo los martes y Correr 3 por semana), el reloj a
/// `ahora` y un token de la conversación `c-1` con el turno 4 en curso.
fn prueba_con(ahora: i64) -> Prueba {
    let carpeta = carpeta_temporal();
    tareas::guardar(&carpeta, &lista("l-compras", "Compras", 1, json!([tarea("t-yerba", "Yerba", json!("2026-11-25"))]))).unwrap();
    tareas::guardar(&carpeta, &lista("l-casa", "Casa", 0, json!([tarea("t-luz", "Pagar la luz", json!("2026-11-20"))]))).unwrap();
    let habitos = carpeta_temporal();
    for h in [
        habito("h-agua", "Agua", json!({ "tipo": "cantidad", "meta": 8, "unidad": "vasos", "orden": 0, "registro": { "2026-11-24": 8, "2026-11-25": 2 } })),
        habito("h-caminar", "Caminar", json!({ "color": "verde", "orden": 1 })),
        habito("h-yoga", "Yoga", json!({ "tipo": "dias", "dias": [1], "color": "rosa", "orden": 2 })),
        habito("h-correr", "Correr", json!({ "tipo": "semana", "veces": 3, "color": "violeta", "orden": 3 })),
    ] {
        crate::habitos::guardar(&habitos, &h).unwrap();
    }
    let chat = Avisos::default();
    let avisos_tareas = Avisos::default();
    let avisos_habitos = Avisos::default();
    let carpetas = Carpetas { tareas: carpeta.clone(), habitos: habitos.clone() };
    let mcp = McpAvis::arrancar(carpetas, chat.emisor(), avisos_tareas.emisor(), avisos_habitos.emisor(), Arc::new(move || ahora)).unwrap();
    let token = mcp.nuevo_token("c-1").unwrap();
    mcp.empezar_turno(&token, 4);
    Prueba { mcp, carpeta, habitos, chat, tareas: avisos_tareas, avisos_habitos, token }
}

fn prueba() -> Prueba {
    prueba_con(MEDIODIA)
}

/// Un pedido HTTP crudo: `(estado, cabeceras y cuerpo)`.
fn crudo(puerto: u16, pedido: &[u8]) -> (u16, String) {
    let mut s = TcpStream::connect(("127.0.0.1", puerto)).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(15))).unwrap();
    let _ = s.write_all(pedido);
    let mut r = Vec::new();
    let _ = s.read_to_end(&mut r);
    let texto = String::from_utf8_lossy(&r).into_owned();
    let estado = texto.split(' ').nth(1).and_then(|e| e.parse().ok()).unwrap_or(0);
    (estado, texto)
}

fn post(puerto: u16, cabeceras: &[(&str, &str)], cuerpo: &str) -> (u16, String) {
    let mut p = format!("POST /mcp HTTP/1.1\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n", cuerpo.len());
    for (k, v) in cabeceras {
        p.push_str(&format!("{k}: {v}\r\n"));
    }
    p.push_str("\r\n");
    p.push_str(cuerpo);
    crudo(puerto, p.as_bytes())
}

fn cuerpo_de(texto: &str) -> Value {
    serde_json::from_str(texto.split("\r\n\r\n").nth(1).unwrap_or("")).unwrap_or(Value::Null)
}

impl Prueba {
    fn host(&self) -> String {
        format!("127.0.0.1:{}", self.mcp.puerto())
    }
    fn rpc_con(&self, token: &str, metodo: &str, params: Value) -> (u16, Value) {
        let cuerpo = json!({ "jsonrpc": "2.0", "id": 1, "method": metodo, "params": params }).to_string();
        let bearer = format!("Bearer {token}");
        let (e, t) = post(self.mcp.puerto(), &[("Host", &self.host()), ("Authorization", &bearer)], &cuerpo);
        (e, cuerpo_de(&t))
    }
    fn rpc(&self, metodo: &str, params: Value) -> Value {
        let (e, v) = self.rpc_con(&self.token, metodo, params);
        assert_eq!(e, 200, "{v}");
        v
    }
    /// `tools/call`: `(texto, isError)`.
    fn llamar(&self, nombre: &str, args: Value) -> (String, bool) {
        let v = self.rpc("tools/call", json!({ "name": nombre, "arguments": args }));
        let r = &v["result"];
        (r["content"][0]["text"].as_str().unwrap_or_default().to_string(), r["isError"] == true)
    }
    fn listas(&self) -> Vec<Value> {
        tareas::listar(&self.carpeta).listas
    }
    fn lista(&self, id: &str) -> Value {
        self.listas().into_iter().find(|l| l["id"] == id).unwrap()
    }
    fn titulos(&self, id: &str) -> Vec<String> {
        self.lista(id)["tareas"].as_array().unwrap().iter().map(|t| t["titulo"].as_str().unwrap().to_string()).collect()
    }
    fn bytes(&self, id: &str) -> Vec<u8> {
        std::fs::read(self.carpeta.join(format!("{id}.json"))).unwrap()
    }
    /// Los cambios emitidos a la charla (`tipo: "cambio"`).
    fn cambios(&self) -> Vec<Value> {
        self.chat.todos().into_iter().filter(|v| v["tipo"] == "cambio").map(|v| v["cambio"].clone()).collect()
    }
    fn ultimo_cambio(&self) -> Value {
        self.cambios().pop().expect("sin cambios")
    }
}

// ---------------------------------------------------------------- 11.1: el transporte y sus rechazos

#[test]
fn escucha_solo_en_127_0_0_1() {
    let p = prueba();
    assert_eq!(p.mcp.direccion().ip().to_string(), "127.0.0.1");
    assert_ne!(p.mcp.puerto(), 0);
}

#[test]
fn sin_token_o_con_uno_equivocado_es_401() {
    let p = prueba();
    let cuerpo = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    let (e, t) = post(p.mcp.puerto(), &[("Host", &p.host())], &cuerpo);
    assert_eq!(e, 401);
    assert!(!t.contains(&p.token));
    for malo in [String::from("Bearer x"), format!("Bearer {}x", p.token), format!("bearer{}", p.token), format!("Basic {}", p.token)] {
        let (e, _) = post(p.mcp.puerto(), &[("Host", &p.host()), ("Authorization", &malo)], &cuerpo);
        assert_eq!(e, 401, "{malo}");
    }
}

#[test]
fn un_token_revocado_o_de_otra_ejecucion_es_401() {
    let p = prueba();
    let otro = p.mcp.nuevo_token("c-2").unwrap();
    assert_ne!(otro, p.token);
    assert_eq!(otro.len(), 64);
    p.mcp.revocar(&otro);
    let (e, _) = p.rpc_con(&otro, "tools/list", json!({}));
    assert_eq!(e, 401);
}

#[test]
fn un_host_ajeno_es_403() {
    let p = prueba();
    let bearer = format!("Bearer {}", p.token);
    let cuerpo = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    let otro_puerto = format!("127.0.0.1:{}", p.mcp.puerto().wrapping_add(1));
    for host in ["localhost", "evil.example", &format!("localhost:{}", p.mcp.puerto()), otro_puerto.as_str()] {
        let (e, _) = post(p.mcp.puerto(), &[("Host", host), ("Authorization", &bearer)], &cuerpo);
        assert_eq!(e, 403, "{host}");
    }
    // Sin Host, también
    let (e, _) = post(p.mcp.puerto(), &[("Authorization", &bearer)], &cuerpo);
    assert_eq!(e, 403);
}

#[test]
fn con_origin_es_403() {
    let p = prueba();
    let bearer = format!("Bearer {}", p.token);
    let cuerpo = json!({ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }).to_string();
    for origen in ["http://127.0.0.1", "null", "https://evil.example"] {
        let (e, _) = post(p.mcp.puerto(), &[("Host", &p.host()), ("Authorization", &bearer), ("Origin", origen)], &cuerpo);
        assert_eq!(e, 403, "{origen}");
    }
}

#[test]
fn un_cuerpo_de_65_kb_es_413_sin_leerlo() {
    let p = prueba();
    let pedido = format!(
        "POST /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Length: {}\r\n\r\n",
        p.host(),
        p.token,
        65 * 1024
    );
    // Solo las cabeceras: si leyera el cuerpo, esperaría los 10 s
    let desde = std::time::Instant::now();
    let (e, _) = crudo(p.mcp.puerto(), pedido.as_bytes());
    assert_eq!(e, 413);
    assert!(desde.elapsed() < Duration::from_secs(5));
}

#[test]
fn otra_ruta_es_404_y_get_es_405() {
    let p = prueba();
    let pedido = format!("GET /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nAccept: text/event-stream\r\n\r\n", p.host(), p.token);
    assert_eq!(crudo(p.mcp.puerto(), pedido.as_bytes()).0, 405);
    let pedido = format!("POST /otra HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Length: 2\r\n\r\n{{}}", p.host(), p.token);
    assert_eq!(crudo(p.mcp.puerto(), pedido.as_bytes()).0, 404);
}

#[test]
fn un_pedido_que_no_termina_se_corta() {
    let p = prueba();
    let pedido = format!("POST /mcp HTTP/1.1\r\nHost: {}\r\nAuthorization: Bearer {}\r\nContent-Length: 50\r\n\r\n{{", p.host(), p.token);
    let mut s = TcpStream::connect(("127.0.0.1", p.mcp.puerto())).unwrap();
    s.write_all(pedido.as_bytes()).unwrap();
    s.set_read_timeout(Some(Duration::from_secs(20))).unwrap();
    let desde = std::time::Instant::now();
    let mut r = Vec::new();
    let _ = s.read_to_end(&mut r);
    // El servidor la cierra a los 10 s (ESPERA_PEDIDO), no queda colgada
    assert!(desde.elapsed() < Duration::from_secs(15));
}

// ---------------------------------------------------------------- 11.1: el protocolo (M-H5)

#[test]
fn el_saludo_que_pide_claude_code() {
    let p = prueba();
    // server/discover: error JSON-RPC (el cliente cae a initialize)
    let v = p.rpc("server/discover", json!({}));
    assert_eq!(v["error"]["code"], -32601);
    // initialize: repite la versión pedida
    let v = p.rpc("initialize", json!({ "protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": { "name": "claude-code" } }));
    assert_eq!(v["result"]["protocolVersion"], "2025-11-25");
    assert_eq!(v["result"]["serverInfo"]["name"], "avis");
    assert!(v["result"]["capabilities"]["tools"].is_object());
    // notifications/initialized: 202 sin cuerpo
    let cuerpo = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" }).to_string();
    let bearer = format!("Bearer {}", p.token);
    let (e, t) = post(p.mcp.puerto(), &[("Host", &p.host()), ("Authorization", &bearer)], &cuerpo);
    assert_eq!(e, 202);
    assert!(t.split("\r\n\r\n").nth(1).unwrap_or("").is_empty());
    // ping
    assert_eq!(p.rpc("ping", json!({}))["result"], json!({}));
}

#[test]
fn tools_list_son_exactamente_las_siete() {
    let p = prueba();
    let v = p.rpc("tools/list", json!({}));
    let herramientas = v["result"]["tools"].as_array().unwrap();
    let nombres: Vec<&str> = herramientas.iter().map(|h| h["name"].as_str().unwrap()).collect();
    assert_eq!(nombres, ["tareas_ver", "tarea_crear", "tarea_editar", "tarea_tildar", "tarea_mostrar", "habitos_ver", "habito_marcar"]);
    let descripcion = |n: &str| herramientas.iter().find(|h| h["name"] == n).unwrap()["description"].as_str().unwrap().to_string();
    assert_eq!(descripcion("tareas_ver"), "Muestra las tareas de Avis. vista: hoy, vencidas, lista o todas. Devuelve también la fecha de hoy.");
    assert_eq!(descripcion("tarea_crear"), "Anota una tarea nueva. Sin lista va a la primera. fecha: AAAA-MM-DD, \"hoy\", \"mañana\" o \"pasado mañana\".");
    assert_eq!(descripcion("tarea_editar"), "Cambia una tarea: título, fecha (null la quita), importante, notas o lista (la mueve). Pasá solo lo que cambia.");
    assert_eq!(descripcion("tarea_tildar"), "Tilda o destilda una tarea.");
    assert_eq!(descripcion("tarea_mostrar"), "No cambia nada: le muestra al usuario una tarea con un botón para abrirla. Usala cuando pida borrar una tarea (el borrado lo hace él).");
    assert_eq!(descripcion("habitos_ver"), "Muestra los hábitos de hoy con lo que lleva cada uno. Devuelve también la fecha de hoy.");
    assert_eq!(descripcion("habito_marcar"), "Marca un hábito de hoy. valor: lo que lleva hoy (0 lo desmarca); o sumar: cuánto agregar.");
    for h in herramientas {
        assert_eq!(h["inputSchema"]["type"], "object", "{h}");
    }
}

#[test]
fn una_herramienta_que_no_existe_es_error_de_metodo() {
    let p = prueba();
    let antes = p.bytes("l-casa");
    let v = p.rpc("tools/call", json!({ "name": "tarea_borrar", "arguments": { "id": "t-luz" } }));
    assert_eq!(v["error"]["code"], -32601);
    assert_eq!(p.bytes("l-casa"), antes);
    // Un método desconocido, también
    assert_eq!(p.rpc("resources/list", json!({}))["error"]["code"], -32601);
}

// ---------------------------------------------------------------- 11.1: solo durante un turno

#[test]
fn sin_turno_en_curso_ninguna_herramienta_anda() {
    let p = prueba();
    p.mcp.terminar_turno(&p.token);
    let antes = p.bytes("l-casa");
    for (nombre, args) in [
        ("tarea_crear", json!({ "titulo": "Pan" })),
        ("tarea_tildar", json!({ "id": "t-luz", "hecha": true })),
        ("tareas_ver", json!({ "vista": "hoy" })),
    ] {
        let (texto, error) = p.llamar(nombre, args);
        assert!(error, "{nombre}");
        assert_eq!(texto, "No hay un mensaje en curso.");
    }
    assert_eq!(p.bytes("l-casa"), antes);
    assert!(p.chat.todos().is_empty());
    // Con un turno nuevo, otra vez sí
    p.mcp.empezar_turno(&p.token, 5);
    assert!(!p.llamar("tarea_crear", json!({ "titulo": "Pan" })).1);
    assert_eq!(p.chat.todos().last().unwrap()["turno"], 5);
}

#[test]
fn el_cambio_21_de_un_turno_da_error() {
    let p = prueba();
    for k in 0..20 {
        let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": format!("T{k}") }));
        assert!(!error, "{k}: {texto}");
    }
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "La 21" }));
    assert!(error);
    assert_eq!(texto, "Demasiados cambios en un mensaje: hacé de a 20.");
    assert!(!p.titulos("l-casa").contains(&String::from("La 21")));
    let c = p.ultimo_cambio();
    assert_eq!(c["estado"], "error");
    assert_eq!(c["reintentable"], false);
    // Leer no cuenta, y el turno siguiente empieza de cero
    assert!(!p.llamar("tareas_ver", json!({ "vista": "todas" })).1);
    p.mcp.empezar_turno(&p.token, 5);
    assert!(!p.llamar("tarea_crear", json!({ "titulo": "Otro turno" })).1);
}

// ---------------------------------------------------------------- 11.4: tarea_crear

#[test]
fn crear_sin_lista_va_a_la_primera_por_orden() {
    let p = prueba();
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "Comprar pan", "fecha": "2026-11-27" }));
    assert!(!error);
    assert_eq!(texto, "Anotada «Comprar pan» en Casa, para el 2026-11-27.");
    let casa = p.lista("l-casa");
    let nueva = casa["tareas"].as_array().unwrap().last().unwrap().clone();
    assert_eq!(nueva["titulo"], "Comprar pan");
    assert_eq!(nueva["hecha"], false);
    assert_eq!(nueva["creada"], MEDIODIA);
    assert!(tareas::id_valido(&nueva["id"].as_str().unwrap().replacen("t-", "l-", 1)));
    // El cambio que va a la ventana y el aviso de la lista
    let c = p.ultimo_cambio();
    assert_eq!(c["herramienta"], "tarea_crear");
    assert_eq!(c["estado"], "hecho");
    assert_eq!(c["lista"], "l-casa");
    assert_eq!(c["tarea"], nueva["id"]);
    assert_eq!(c["antes"], Value::Null);
    assert_eq!(c["despues"], json!({ "titulo": "Comprar pan", "fecha": "2026-11-27", "hecha": false, "importante": false, "lista": "l-casa" }));
    assert!(c["id"].as_str().unwrap().starts_with("c-"));
    let ev = p.chat.todos().pop().unwrap();
    assert_eq!((ev["conversacion"].as_str(), ev["turno"].as_u64(), ev["tipo"].as_str()), (Some("c-1"), Some(4), Some("cambio")));
    assert_eq!(p.tareas.todos(), vec![json!({ "lista": "l-casa", "tarea": nueva["id"], "origen": "chat" })]);
}

#[test]
fn crear_con_la_lista_por_nombre_o_por_id() {
    let p = prueba();
    assert!(!p.llamar("tarea_crear", json!({ "titulo": "Pan", "lista": "compras" })).1);
    assert!(!p.llamar("tarea_crear", json!({ "titulo": "Leche", "lista": "l-compras", "importante": true, "notas": "Entera" })).1);
    assert_eq!(p.titulos("l-compras"), ["Yerba", "Pan", "Leche"]);
    let leche = p.lista("l-compras")["tareas"][2].clone();
    assert_eq!((leche["importante"].clone(), leche["notas"].clone()), (json!(true), json!("Entera")));
}

#[test]
fn crear_en_una_lista_que_no_existe_da_error_y_no_escribe_nada() {
    let p = prueba();
    let (casa, compras) = (p.bytes("l-casa"), p.bytes("l-compras"));
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "Pan", "lista": "Facultad" }));
    assert!(error);
    assert_eq!(texto, "No existe la lista «Facultad».");
    assert_eq!((p.bytes("l-casa"), p.bytes("l-compras")), (casa, compras));
    let c = p.ultimo_cambio();
    assert_eq!((c["estado"].as_str(), c["motivo"].as_str(), c["reintentable"].as_bool()), (Some("error"), Some("No existe la lista «Facultad»."), Some(false)));
    assert_eq!(c["args"]["lista"], "Facultad");
    assert!(p.tareas.todos().is_empty());
}

/// Deja la carpeta de la prueba sin ninguna lista.
fn sin_listas(p: &Prueba) {
    std::fs::remove_file(p.carpeta.join("l-casa.json")).unwrap();
    std::fs::remove_file(p.carpeta.join("l-compras.json")).unwrap();
}

#[test]
fn sin_listas_la_primera_tarea_arma_la_lista_tareas() {
    // Decisión de Quintana (25/11): sin listas, la charla anota igual en una lista nueva «Tareas»
    let p = prueba();
    sin_listas(&p);
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "Pan", "fecha": "mañana" }));
    assert!(!error, "{texto}");
    assert_eq!(texto, "Anotada «Pan» en Tareas (lista nueva), para el 2026-11-26.");
    let l = p.lista("l-tareas");
    assert_eq!((l["nombre"].as_str(), l["color"].as_str()), (Some("Tareas"), Some(tareas::COLORES[0])));
    assert_eq!(p.titulos("l-tareas"), ["Pan"]);
    let c = p.ultimo_cambio();
    assert_eq!((c["estado"].as_str(), c["lista"].as_str()), (Some("hecho"), Some("l-tareas")));
    assert_eq!(c["listaNueva"], json!({ "nombre": "Tareas", "color": tareas::COLORES[0] }));
    // La segunda va a esa misma lista, ya sin «lista nueva»
    let (texto, _) = p.llamar("tarea_crear", json!({ "titulo": "Leche" }));
    assert_eq!(texto, "Anotada «Leche» en Tareas.");
    assert_eq!(p.titulos("l-tareas"), ["Pan", "Leche"]);
    assert!(p.ultimo_cambio().get("listaNueva").is_none());
}

#[test]
fn sin_listas_deshacer_saca_la_tarea_y_la_lista_queda() {
    let p = prueba();
    sin_listas(&p);
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    let r = deshacer(&p.carpeta, &p.ultimo_cambio(), MEDIODIA).unwrap();
    assert_eq!(r.estado, "deshecho");
    assert!(p.titulos("l-tareas").is_empty());
}

#[test]
fn sin_listas_un_archivo_roto_con_ese_id_no_se_pisa() {
    let p = prueba();
    sin_listas(&p);
    std::fs::write(p.carpeta.join("l-tareas.json"), "{ roto").unwrap();
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    assert!(!error, "{texto}");
    assert_eq!(std::fs::read(p.carpeta.join("l-tareas.json")).unwrap(), b"{ roto");
    assert_eq!(p.titulos("l-tareas-2"), ["Pan"]);
    assert_eq!(p.ultimo_cambio()["lista"], "l-tareas-2");
}

#[test]
fn sin_listas_con_una_lista_pedida_sigue_el_error_de_antes() {
    // Lo de antes: pedir una lista que no existe no la crea
    let p = prueba();
    sin_listas(&p);
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "Pan", "lista": "Facultad" }));
    assert!(error);
    assert_eq!(texto, "No existe la lista «Facultad».");
    assert!(p.listas().is_empty());
}

#[test]
fn una_lista_rota_da_error_y_queda_con_el_mismo_hash() {
    let p = prueba();
    std::fs::write(p.carpeta.join("l-rota.json"), "{ roto").unwrap();
    let antes = tareas::huella(&p.bytes("l-rota"));
    let (texto, error) = p.llamar("tarea_crear", json!({ "titulo": "Pan", "lista": "l-rota" }));
    assert!(error);
    assert_eq!(texto, "El archivo de la lista está roto: no lo toco.");
    assert_eq!(tareas::huella(&p.bytes("l-rota")), antes);
}

#[test]
fn un_campo_desconocido_de_la_lista_sobrevive() {
    let p = prueba();
    let mut futura = lista("l-casa", "Casa", 0, json!([tarea("t-luz", "Pagar la luz", json!(null))]));
    futura["icono"] = json!("casita");
    futura["tareas"][0]["repetir"] = json!("mes");
    std::fs::write(p.carpeta.join("l-casa.json"), serde_json::to_vec(&futura).unwrap()).unwrap();
    assert!(!p.llamar("tarea_crear", json!({ "titulo": "Pan" })).1);
    assert!(!p.llamar("tarea_tildar", json!({ "id": "t-luz", "hecha": true })).1);
    let crudo: Value = serde_json::from_slice(&p.bytes("l-casa")).unwrap();
    assert_eq!(crudo["icono"], "casita");
    assert_eq!(crudo["tareas"][0]["repetir"], "mes");
}

#[test]
fn las_validaciones_de_crear() {
    let p = prueba();
    let antes = p.bytes("l-casa");
    for args in [json!({}), json!({ "titulo": "   " }), json!({ "titulo": "t".repeat(201) }), json!({ "titulo": "Pan", "fecha": "el jueves" }), json!({ "titulo": "Pan", "fecha": "2026-02-30" }), json!({ "titulo": "Pan", "importante": "si" }), json!({ "titulo": "Pan", "notas": "n".repeat(4001) })] {
        assert!(p.llamar("tarea_crear", args.clone()).1, "{args}");
    }
    assert_eq!(p.bytes("l-casa"), antes);
}

// ---------------------------------------------------------------- D-c15: fechas de Argentina

#[test]
fn manana_a_las_23_30_de_argentina_es_el_dia_siguiente_de_argentina() {
    // 23:30 del 25/11 en Argentina = 02:30 del 26/11 en UTC
    let p = prueba_con(ms_argentina("2026-11-25 23:30"));
    let (texto, _) = p.llamar("tarea_crear", json!({ "titulo": "Pan", "fecha": "mañana" }));
    assert_eq!(texto, "Anotada «Pan» en Casa, para el 2026-11-26.");
    assert_eq!(p.ultimo_cambio()["despues"]["fecha"], "2026-11-26");
}

#[test]
fn las_fechas_relativas_las_resuelve_rust() {
    let ahora = ms_argentina("2026-11-25 23:30");
    for (pedida, esperada) in [
        (json!("hoy"), json!("2026-11-25")),
        (json!("Hoy"), json!("2026-11-25")),
        (json!("mañana"), json!("2026-11-26")),
        (json!("manana"), json!("2026-11-26")),
        (json!("pasado mañana"), json!("2026-11-27")),
        (json!("2026-12-31"), json!("2026-12-31")),
        (json!(null), json!(null)),
    ] {
        assert_eq!(fecha_pedida(&pedida, ahora), Ok(esperada.clone()), "{pedida}");
    }
    for mala in [json!("ayer"), json!("2026-13-01"), json!(5), json!("26/11")] {
        assert!(fecha_pedida(&mala, ahora).is_err(), "{mala}");
    }
    // 00:30 del 26 en Argentina (03:30 UTC): hoy ya es el 26
    assert_eq!(fecha_pedida(&json!("hoy"), ms_argentina("2026-11-26 00:30")), Ok(json!("2026-11-26")));
}

// ---------------------------------------------------------------- 11.4: tarea_editar, tarea_tildar, tarea_mostrar, tareas_ver

#[test]
fn editar_cambia_solo_lo_pedido() {
    let p = prueba();
    let (texto, error) = p.llamar("tarea_editar", json!({ "id": "t-luz", "fecha": "hoy", "importante": true }));
    assert!(!error, "{texto}");
    assert_eq!(texto, "Listo: fecha 2026-11-25, importante.");
    let t = p.lista("l-casa")["tareas"][0].clone();
    assert_eq!((t["fecha"].clone(), t["importante"].clone(), t["titulo"].clone()), (json!("2026-11-25"), json!(true), json!("Pagar la luz")));
    let c = p.ultimo_cambio();
    assert_eq!(c["antes"], json!({ "fecha": "2026-11-20", "importante": false, "lista": "l-casa" }));
    assert_eq!(c["despues"], json!({ "fecha": "2026-11-25", "importante": true, "lista": "l-casa" }));
    // null quita la fecha
    assert!(!p.llamar("tarea_editar", json!({ "id": "t-luz", "fecha": null })).1);
    assert_eq!(p.lista("l-casa")["tareas"][0]["fecha"], Value::Null);
    // Sin nada que cambiar, o una tarea que no está: error
    assert!(p.llamar("tarea_editar", json!({ "id": "t-luz" })).1);
    let (texto, error) = p.llamar("tarea_editar", json!({ "id": "t-nada", "titulo": "X" }));
    assert!(error);
    assert_eq!(texto, "Esa tarea ya no está.");
}

#[test]
fn editar_con_lista_la_mueve_y_deja_una_sola_copia() {
    let p = prueba();
    let (texto, error) = p.llamar("tarea_editar", json!({ "id": "t-luz", "lista": "Compras" }));
    assert!(!error, "{texto}");
    assert_eq!(texto, "Listo: lista Compras.");
    assert_eq!(p.titulos("l-casa"), Vec::<String>::new());
    assert_eq!(p.titulos("l-compras"), ["Yerba", "Pagar la luz"]);
    let copias = p.listas().iter().flat_map(|l| l["tareas"].as_array().unwrap().clone()).filter(|t| t["id"] == "t-luz").count();
    assert_eq!(copias, 1);
    let c = p.ultimo_cambio();
    assert_eq!((c["antes"].clone(), c["despues"].clone()), (json!({ "lista": "l-casa" }), json!({ "lista": "l-compras" })));
    assert_eq!(c["lista"], "l-compras");
    // Avisa las dos listas
    let listas: Vec<Value> = p.tareas.todos().iter().map(|a| a["lista"].clone()).collect();
    assert!(listas.contains(&json!("l-casa")) && listas.contains(&json!("l-compras")));
}

#[test]
fn tildar_y_destildar() {
    let p = prueba();
    let (texto, _) = p.llamar("tarea_tildar", json!({ "id": "t-yerba", "hecha": true }));
    assert_eq!(texto, "Tildada «Yerba».");
    let t = p.lista("l-compras")["tareas"][0].clone();
    assert_eq!((t["hecha"].clone(), t["hechaEn"].clone()), (json!(true), json!(MEDIODIA)));
    assert_eq!(p.ultimo_cambio()["despues"], json!({ "hecha": true, "hechaEn": MEDIODIA, "lista": "l-compras" }));
    let (texto, _) = p.llamar("tarea_tildar", json!({ "id": "t-yerba", "hecha": false }));
    assert_eq!(texto, "Destildada «Yerba».");
    assert_eq!(p.lista("l-compras")["tareas"][0]["hechaEn"], Value::Null);
    assert!(p.llamar("tarea_tildar", json!({ "id": "t-yerba" })).1);
}

#[test]
fn mostrar_no_cambia_nada_y_deja_el_boton() {
    let p = prueba();
    let antes = p.bytes("l-casa");
    let (texto, error) = p.llamar("tarea_mostrar", json!({ "id": "t-luz", "para": "borrar" }));
    assert!(!error);
    assert_eq!(texto, "Le mostré «Pagar la luz».");
    assert_eq!(p.bytes("l-casa"), antes);
    let ev = p.chat.todos().pop().unwrap();
    assert_eq!(ev["tipo"], "mostrar");
    assert_eq!(ev["cambio"]["estado"], "mostrar");
    assert_eq!(ev["cambio"]["tarea"], "t-luz");
    assert_eq!(ev["cambio"]["resumen"]["para"], "borrar");
    assert!(p.tareas.todos().is_empty());
    assert!(p.llamar("tarea_mostrar", json!({ "id": "t-luz", "para": "tirar" })).1);
}

#[test]
fn ver_devuelve_hoy_y_las_tareas() {
    let p = prueba();
    let (texto, error) = p.llamar("tareas_ver", json!({ "vista": "hoy" }));
    assert!(!error);
    let v: Value = serde_json::from_str(&texto).unwrap();
    assert_eq!(v["hoy"], "2026-11-25");
    assert_eq!(v["diaSemana"], "miércoles");
    assert_eq!(v["listas"], json!([{ "id": "l-casa", "nombre": "Casa" }, { "id": "l-compras", "nombre": "Compras" }]));
    assert_eq!(v["tareas"], json!([{ "id": "t-yerba", "lista": "l-compras", "titulo": "Yerba", "fecha": "2026-11-25", "importante": false, "hecha": false }]));
    let ev = p.chat.todos().pop().unwrap();
    assert_eq!(ev["tipo"], "lectura");
    assert_eq!(ev["cambio"]["resumen"]["vista"], "hoy");
    assert_eq!(ev["cambio"]["resumen"]["total"], 1);
    let vencidas: Value = serde_json::from_str(&p.llamar("tareas_ver", json!({ "vista": "vencidas" })).0).unwrap();
    assert_eq!(vencidas["tareas"][0]["id"], "t-luz");
    let de_lista: Value = serde_json::from_str(&p.llamar("tareas_ver", json!({ "vista": "lista", "lista": "Compras" })).0).unwrap();
    assert_eq!(de_lista["tareas"].as_array().unwrap().len(), 1);
    assert!(p.llamar("tareas_ver", json!({ "vista": "lista" })).1);
    assert!(p.llamar("tareas_ver", json!({ "vista": "semana" })).1);
}

#[test]
fn ver_devuelve_hasta_100_tareas() {
    let p = prueba();
    let muchas: Vec<Value> = (0..130).map(|k| tarea(&format!("t-{k}"), &format!("T{k}"), json!(null))).collect();
    tareas::guardar(&p.carpeta, &lista("l-casa", "Casa", 0, json!(muchas))).unwrap();
    let v: Value = serde_json::from_str(&p.llamar("tareas_ver", json!({ "vista": "todas" })).0).unwrap();
    assert_eq!(v["tareas"].as_array().unwrap().len(), 100);
}

// ---------------------------------------------------------------- 11.7: deshacer (punto 12)

fn deshacer_en(p: &Prueba, cambio: &Value) -> &'static str {
    deshacer(&p.carpeta, cambio, MEDIODIA).unwrap().estado
}

#[test]
fn crear_y_deshacer_la_saca() {
    let p = prueba();
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    let c = p.ultimo_cambio();
    let r = deshacer(&p.carpeta, &c, MEDIODIA).unwrap();
    assert_eq!(r.estado, "deshecho");
    assert_eq!(r.tocadas, vec![json!({ "lista": "l-casa", "tarea": c["tarea"], "origen": "chat" })]);
    assert_eq!(p.titulos("l-casa"), ["Pagar la luz"]);
    // Dos veces: la segunda es "Deshecho" sin tocar nada
    let antes = p.bytes("l-casa");
    let r = deshacer(&p.carpeta, &c, MEDIODIA).unwrap();
    assert_eq!(r.estado, "deshecho");
    assert!(r.tocadas.is_empty());
    assert_eq!(p.bytes("l-casa"), antes);
}

#[test]
fn crear_tildar_en_la_ventana_y_deshacer_es_cambio_despues_sin_tocar_nada() {
    let p = prueba();
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    let c = p.ultimo_cambio();
    // La ventana la tilda
    let mut casa = p.lista("l-casa");
    casa["tareas"][1]["hecha"] = json!(true);
    tareas::guardar(&p.carpeta, &casa).unwrap();
    let antes = p.bytes("l-casa");
    assert_eq!(deshacer_en(&p, &c), "cambio-despues");
    assert_eq!(p.bytes("l-casa"), antes);
}

#[test]
fn editar_y_cambiar_a_mano_es_cambio_despues() {
    let p = prueba();
    p.llamar("tarea_editar", json!({ "id": "t-luz", "fecha": "2026-11-28", "titulo": "Pagar la luz y el gas" }));
    let c = p.ultimo_cambio();
    let mut casa = p.lista("l-casa");
    casa["tareas"][0]["titulo"] = json!("Otro título");
    tareas::guardar(&p.carpeta, &casa).unwrap();
    let antes = p.bytes("l-casa");
    assert_eq!(deshacer_en(&p, &c), "cambio-despues");
    assert_eq!(p.bytes("l-casa"), antes);
}

#[test]
fn editar_y_deshacer_vuelve_solo_los_campos_que_cambio() {
    let p = prueba();
    p.llamar("tarea_editar", json!({ "id": "t-luz", "fecha": "2026-11-28" }));
    let c = p.ultimo_cambio();
    // La ventana cambia otro campo (notas): no impide deshacer y queda
    let mut casa = p.lista("l-casa");
    casa["tareas"][0]["notas"] = json!("Con débito");
    tareas::guardar(&p.carpeta, &casa).unwrap();
    assert_eq!(deshacer_en(&p, &c), "deshecho");
    let t = p.lista("l-casa")["tareas"][0].clone();
    assert_eq!((t["fecha"].clone(), t["notas"].clone()), (json!("2026-11-20"), json!("Con débito")));
}

#[test]
fn mover_y_deshacer_vuelve_a_su_lista_con_una_sola_copia() {
    let p = prueba();
    p.llamar("tarea_editar", json!({ "id": "t-luz", "lista": "l-compras" }));
    let c = p.ultimo_cambio();
    assert_eq!(deshacer_en(&p, &c), "deshecho");
    assert_eq!(p.titulos("l-casa"), ["Pagar la luz"]);
    assert_eq!(p.titulos("l-compras"), ["Yerba"]);
    assert_eq!(deshacer_en(&p, &c), "deshecho");
    assert_eq!(p.titulos("l-casa"), ["Pagar la luz"]);
}

#[test]
fn tildar_y_deshacer() {
    let p = prueba();
    p.llamar("tarea_tildar", json!({ "id": "t-yerba", "hecha": true }));
    let c = p.ultimo_cambio();
    assert_eq!(deshacer_en(&p, &c), "deshecho");
    let t = p.lista("l-compras")["tareas"][0].clone();
    assert_eq!((t["hecha"].clone(), t["hechaEn"].clone()), (json!(false), Value::Null));
    // Tildada de nuevo en la ventana: el viejo cambio ya no se deshace solo... la segunda vez es
    // "Deshecho" mientras siga como antes
    assert_eq!(deshacer_en(&p, &c), "deshecho");
    let mut compras = p.lista("l-compras");
    compras["tareas"][0]["hecha"] = json!(true);
    compras["tareas"][0]["hechaEn"] = json!(MEDIODIA + 5);
    tareas::guardar(&p.carpeta, &compras).unwrap();
    assert_eq!(deshacer_en(&p, &c), "cambio-despues");
}

#[test]
fn deshacer_valida_la_forma_del_cambio() {
    let p = prueba();
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    let bueno = p.ultimo_cambio();
    let antes = p.bytes("l-casa");
    let mut malos = Vec::new();
    for (k, v) in [("herramienta", json!("tarea_borrar")), ("tarea", json!("t-../x")), ("lista", json!("l-a/b")), ("estado", json!("error")), ("despues", json!("x"))] {
        let mut m = bueno.clone();
        m[k] = v;
        malos.push(m);
    }
    malos.push(json!("x"));
    for m in malos {
        assert!(deshacer(&p.carpeta, &m, MEDIODIA).is_err(), "{m}");
    }
    assert_eq!(p.bytes("l-casa"), antes);
}

#[test]
fn la_linea_de_deshecho_lleva_el_verbo_y_el_titulo() {
    let p = prueba();
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    assert_eq!(linea_deshecho(&p.ultimo_cambio()), "Deshecho: anotada «Pan».");
    p.llamar("tarea_tildar", json!({ "id": "t-yerba", "hecha": true }));
    assert_eq!(linea_deshecho(&p.ultimo_cambio()), "Deshecho: tildada «Yerba».");
    for (args, verbo) in [
        (json!({ "id": "t-luz", "lista": "Compras" }), "movida"),
        (json!({ "id": "t-luz", "fecha": "hoy" }), "nueva fecha"),
        (json!({ "id": "t-luz", "fecha": null }), "sin fecha"),
        (json!({ "id": "t-luz", "titulo": "Luz" }), "renombrada"),
        (json!({ "id": "t-luz", "importante": true }), "importante"),
        (json!({ "id": "t-luz", "importante": false }), "ya no importante"),
        (json!({ "id": "t-luz", "notas": "x" }), "notas"),
        (json!({ "id": "t-luz", "notas": "y", "importante": true }), "editada"),
    ] {
        p.llamar("tarea_editar", args.clone());
        assert_eq!(verbo_cambio(&p.ultimo_cambio()), verbo, "{args}");
    }
}

// ---------------------------------------------------------------- 11.9: reintentar

#[test]
fn reintentar_repite_la_operacion_solo_con_un_error_reintentable() {
    let p = prueba();
    let error = json!({
        "id": "c-err", "herramienta": "tarea_crear", "estado": "error", "lista": null, "tarea": null, "titulo": "Pan",
        "antes": null, "despues": null, "motivo": "No se pudo guardar. No cambió nada.", "reintentable": true,
        "args": { "titulo": "Pan", "fecha": "mañana" },
    });
    let (nuevo, tocadas) = reintentar(&p.carpeta, &error, MEDIODIA).unwrap();
    assert_eq!(nuevo["estado"], "hecho");
    assert_ne!(nuevo["id"], "c-err");
    assert_eq!(nuevo["despues"]["fecha"], "2026-11-26");
    assert_eq!(tocadas.len(), 1);
    assert_eq!(p.titulos("l-casa"), ["Pagar la luz", "Pan"]);
    // Sin turno ni tope: es un clic del usuario. Lo que no es reintentable, no
    let mut no = error.clone();
    no["reintentable"] = json!(false);
    assert!(reintentar(&p.carpeta, &no, MEDIODIA).is_err());
    assert!(reintentar(&p.carpeta, &nuevo, MEDIODIA).is_err());
    assert_eq!(p.titulos("l-casa"), ["Pagar la luz", "Pan"]);
}

// ---------------------------------------------------------------- C3: los hábitos (11.4, 11.7 y 11.10)

impl Prueba {
    fn habito(&self, id: &str) -> Value {
        crate::habitos::listar(&self.habitos).habitos.into_iter().find(|h| h["id"] == id).unwrap()
    }
    fn hoy_de(&self, id: &str) -> Value {
        self.habito(id)["registro"].get("2026-11-25").cloned().unwrap_or(Value::Null)
    }
    fn bytes_habito(&self, id: &str) -> Vec<u8> {
        std::fs::read(self.habitos.join(format!("{id}.json"))).unwrap()
    }
}

#[test]
fn habitos_ver_devuelve_hoy_y_lo_que_lleva_cada_uno() {
    let p = prueba();
    let (texto, error) = p.llamar("habitos_ver", json!({}));
    assert!(!error, "{texto}");
    let v: Value = serde_json::from_str(&texto).unwrap();
    assert_eq!(v["hoy"], "2026-11-25");
    assert_eq!(
        v["habitos"],
        json!([
            { "id": "h-agua", "nombre": "Agua", "tipo": "cantidad", "meta": 8, "unidad": "vasos", "hoy": 2, "toca": true, "hecho": false },
            { "id": "h-caminar", "nombre": "Caminar", "tipo": "diario", "meta": 1, "unidad": "", "hoy": 0, "toca": true, "hecho": false },
            { "id": "h-yoga", "nombre": "Yoga", "tipo": "dias", "meta": 1, "unidad": "", "hoy": 0, "toca": false, "hecho": false },
            { "id": "h-correr", "nombre": "Correr", "tipo": "semana", "meta": 1, "unidad": "", "hoy": 0, "toca": true, "hecho": false },
        ])
    );
    // El recibo de lectura (4.5): los de hoy (los que tocan) como píldoras, y nada escrito
    let ev = p.chat.todos().pop().unwrap();
    assert_eq!(ev["tipo"], "lectura");
    let c = &ev["cambio"];
    assert_eq!(c["herramienta"], "habitos_ver");
    assert_eq!(c["estado"], "lectura");
    assert_eq!(c["resumen"]["vista"], "habitos");
    assert_eq!(c["resumen"]["hoy"], "2026-11-25");
    assert_eq!((c["resumen"]["hechas"].clone(), c["resumen"]["total"].clone()), (json!(0), json!(3)));
    let nombres: Vec<&str> = c["resumen"]["habitos"].as_array().unwrap().iter().map(|h| h["nombre"].as_str().unwrap()).collect();
    assert_eq!(nombres, ["Agua", "Caminar", "Correr"]);
    assert_eq!(c["resumen"]["habitos"][0], json!({ "habito": "h-agua", "nombre": "Agua", "tipo": "cantidad", "meta": 8, "valor": 2, "hecho": false, "color": "celeste" }));
    assert!(p.avisos_habitos.todos().is_empty());
}

#[test]
fn marcar_con_sumar_suma_a_lo_de_hoy() {
    let p = prueba();
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    assert!(!error, "{texto}");
    assert_eq!(texto, "Marcado «Agua»: 3 de 8.");
    assert_eq!(p.hoy_de("h-agua"), 3);
    // Ayer queda como estaba
    assert_eq!(p.habito("h-agua")["registro"]["2026-11-24"], 8);
    let c = p.ultimo_cambio();
    assert_eq!(c["herramienta"], "habito_marcar");
    assert_eq!(c["estado"], "hecho");
    assert_eq!(c["habito"], "h-agua");
    assert_eq!(c["titulo"], "Agua");
    assert_eq!((c["lista"].clone(), c["tarea"].clone()), (Value::Null, Value::Null));
    assert_eq!(c["antes"], json!({ "dia": "2026-11-25", "valor": 2 }));
    assert_eq!(c["despues"], json!({ "dia": "2026-11-25", "valor": 3 }));
    assert_eq!(c["marca"], json!({ "tipo": "cantidad", "meta": 8, "unidad": "vasos", "color": "celeste" }));
    // Avisa a la hoja de Hábitos, no a la de Tareas
    assert_eq!(p.avisos_habitos.todos(), vec![json!({ "habito": "h-agua", "origen": "chat" })]);
    assert!(p.tareas.todos().is_empty());
    // Restar no baja de 0; sumar no pasa de 999
    assert!(!p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": -10 })).1);
    assert_eq!(p.hoy_de("h-agua"), Value::Null);
    assert!(!p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 999 })).1);
    assert!(!p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 5 })).1);
    assert_eq!(p.hoy_de("h-agua"), 999);
}

#[test]
fn marcar_con_valor_pone_lo_de_hoy() {
    let p = prueba();
    let (texto, _) = p.llamar("habito_marcar", json!({ "id": "h-agua", "valor": 8 }));
    assert_eq!(texto, "Marcado «Agua»: 8 de 8.");
    assert_eq!(p.hoy_de("h-agua"), 8);
    // Un sí/no guarda 1 (habitos-ux 11.1), aunque pidan más
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-caminar", "valor": 5 }));
    assert!(!error);
    assert_eq!(texto, "Marcado «Caminar»: 1.");
    assert_eq!(p.hoy_de("h-caminar"), 1);
    // Por semana marca el día de hoy
    assert!(!p.llamar("habito_marcar", json!({ "id": "h-correr", "sumar": 1 })).1);
    assert_eq!(p.hoy_de("h-correr"), 1);
}

#[test]
fn desmarcar_con_valor_0_saca_el_dia_del_registro() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-caminar", "valor": 1 }));
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-caminar", "valor": 0 }));
    assert!(!error);
    assert_eq!(texto, "Marcado «Caminar»: 0.");
    assert!(p.habito("h-caminar")["registro"].as_object().unwrap().is_empty());
    assert_eq!(p.ultimo_cambio()["despues"], json!({ "dia": "2026-11-25", "valor": 0 }));
}

#[test]
fn marcar_otro_dia_da_error_y_no_escribe() {
    let p = prueba();
    let antes = p.bytes_habito("h-agua");
    for args in [
        json!({ "id": "h-agua", "valor": 1, "dia": "2026-11-24" }),
        json!({ "id": "h-agua", "valor": 1, "fecha": "ayer" }),
        json!({ "id": "h-agua", "sumar": 1, "dia": "mañana" }),
    ] {
        let (texto, error) = p.llamar("habito_marcar", args.clone());
        assert!(error, "{args}");
        assert_eq!(texto, "Solo se marcan los hábitos de hoy.", "{args}");
    }
    assert_eq!(p.bytes_habito("h-agua"), antes);
    let c = p.ultimo_cambio();
    assert_eq!(c["estado"], "error");
    assert_eq!(c["habito"], "h-agua");
    assert_eq!(c["titulo"], "Agua");
    assert_eq!(c["reintentable"], false);
    assert!(p.avisos_habitos.todos().is_empty());
    // Hoy dicho como día sí sirve
    assert!(!p.llamar("habito_marcar", json!({ "id": "h-agua", "valor": 4, "dia": "hoy" })).1);
    assert_eq!(p.hoy_de("h-agua"), 4);
}

#[test]
fn las_validaciones_de_marcar() {
    let p = prueba();
    let antes = p.bytes_habito("h-agua");
    for args in [
        json!({ "id": "h-agua" }),
        json!({ "id": "h-agua", "valor": 1, "sumar": 1 }),
        json!({ "id": "h-agua", "valor": -1 }),
        json!({ "id": "h-agua", "valor": 1000 }),
        json!({ "id": "h-agua", "valor": "3" }),
        json!({ "id": "h-agua", "valor": 2.5 }),
        json!({ "id": "h-agua", "sumar": 1000 }),
        json!({ "id": "h-agua", "sumar": -1000 }),
        json!({ "valor": 1 }),
    ] {
        assert!(p.llamar("habito_marcar", args.clone()).1, "{args}");
    }
    assert_eq!(p.bytes_habito("h-agua"), antes);
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-nada", "valor": 1 }));
    assert!(error);
    assert_eq!(texto, "Ese hábito ya no está.");
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-../x", "valor": 1 }));
    assert!(error);
    assert_eq!(texto, "Ese hábito ya no está.");
    // Un hábito de algunos días que hoy no toca
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-yoga", "valor": 1 }));
    assert!(error);
    assert_eq!(texto, "Hoy no toca «Yoga».");
    assert_eq!(p.hoy_de("h-yoga"), Value::Null);
}

#[test]
fn un_habito_roto_da_error_y_queda_con_los_mismos_bytes() {
    let p = prueba();
    std::fs::write(p.habitos.join("h-roto.json"), "{ roto").unwrap();
    let antes = p.bytes_habito("h-roto");
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-roto", "valor": 1 }));
    assert!(error);
    assert_eq!(texto, "El archivo del hábito está roto: no lo toco.");
    assert_eq!(p.bytes_habito("h-roto"), antes);
    // habitos_ver sigue con los que sirven
    let v: Value = serde_json::from_str(&p.llamar("habitos_ver", json!({})).0).unwrap();
    assert_eq!(v["habitos"].as_array().unwrap().len(), 4);
}

#[test]
fn un_campo_desconocido_del_habito_sobrevive() {
    let p = prueba();
    let mut futuro = p.habito("h-agua");
    futuro["icono"] = json!("gota");
    std::fs::write(p.habitos.join("h-agua.json"), serde_json::to_vec(&futuro).unwrap()).unwrap();
    assert!(!p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 })).1);
    let crudo: Value = serde_json::from_slice(&p.bytes_habito("h-agua")).unwrap();
    assert_eq!(crudo["icono"], "gota");
    assert_eq!(crudo["registro"]["2026-11-25"], 3);
}

#[test]
fn crear_editar_o_borrar_habitos_no_existe() {
    let p = prueba();
    let antes = p.bytes_habito("h-agua");
    for nombre in ["habito_crear", "habito_editar", "habito_borrar", "habitos_borrar", "habito_marcar_dia"] {
        let v = p.rpc("tools/call", json!({ "name": nombre, "arguments": { "id": "h-agua", "nombre": "X" } }));
        assert_eq!(v["error"]["code"], -32601, "{nombre}");
    }
    assert_eq!(p.bytes_habito("h-agua"), antes);
    assert!(p.chat.todos().is_empty());
}

#[test]
fn sin_turno_los_habitos_tampoco_andan() {
    let p = prueba();
    p.mcp.terminar_turno(&p.token);
    let antes = p.bytes_habito("h-agua");
    for (nombre, args) in [("habito_marcar", json!({ "id": "h-agua", "sumar": 1 })), ("habitos_ver", json!({}))] {
        let (texto, error) = p.llamar(nombre, args);
        assert!(error, "{nombre}");
        assert_eq!(texto, "No hay un mensaje en curso.");
    }
    assert_eq!(p.bytes_habito("h-agua"), antes);
    assert!(p.chat.todos().is_empty());
}

#[test]
fn marcar_cuenta_para_el_tope_de_20_cambios() {
    let p = prueba();
    for k in 0..20 {
        assert!(!p.llamar("tarea_crear", json!({ "titulo": format!("T{k}") })).1);
    }
    let antes = p.bytes_habito("h-agua");
    let (texto, error) = p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    assert!(error);
    assert_eq!(texto, "Demasiados cambios en un mensaje: hacé de a 20.");
    assert_eq!(p.bytes_habito("h-agua"), antes);
    assert_eq!(p.ultimo_cambio()["habito"], "h-agua");
    // Leer los hábitos no cuenta
    assert!(!p.llamar("habitos_ver", json!({})).1);
}

fn deshacer_hab(p: &Prueba, cambio: &Value, ahora: i64) -> Deshacer {
    deshacer_habito(&p.habitos, cambio, ahora).unwrap()
}

#[test]
fn marcar_y_deshacer_vuelve_lo_de_antes() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    let c = p.ultimo_cambio();
    let r = deshacer_hab(&p, &c, MEDIODIA);
    assert_eq!(r.estado, "deshecho");
    assert_eq!(r.tocadas, vec![json!({ "habito": "h-agua", "origen": "chat" })]);
    assert_eq!(p.hoy_de("h-agua"), 2);
    // Dos veces: la segunda es "Deshecho" sin tocar nada
    let antes = p.bytes_habito("h-agua");
    let r = deshacer_hab(&p, &c, MEDIODIA);
    assert_eq!(r.estado, "deshecho");
    assert!(r.tocadas.is_empty());
    assert_eq!(p.bytes_habito("h-agua"), antes);
    // Desmarcar y deshacer: vuelve a estar marcado
    p.llamar("habito_marcar", json!({ "id": "h-caminar", "valor": 1 }));
    p.llamar("habito_marcar", json!({ "id": "h-caminar", "valor": 0 }));
    assert_eq!(deshacer_hab(&p, &p.ultimo_cambio(), MEDIODIA).estado, "deshecho");
    assert_eq!(p.hoy_de("h-caminar"), 1);
}

#[test]
fn marcar_cambiar_en_la_ventana_y_deshacer_es_cambio_despues() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    let c = p.ultimo_cambio();
    // La ventana suma otro vaso
    let mut agua = p.habito("h-agua");
    agua["registro"]["2026-11-25"] = json!(4);
    crate::habitos::guardar(&p.habitos, &agua).unwrap();
    let antes = p.bytes_habito("h-agua");
    let r = deshacer_hab(&p, &c, MEDIODIA);
    assert_eq!(r.estado, "cambio-despues");
    assert!(r.tocadas.is_empty());
    assert_eq!(p.bytes_habito("h-agua"), antes);
    // El hábito ya no está: también
    std::fs::remove_file(p.habitos.join("h-agua.json")).unwrap();
    assert_eq!(deshacer_hab(&p, &c, MEDIODIA).estado, "cambio-despues");
}

#[test]
fn deshacer_otro_dia_es_cambio_despues() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    let c = p.ultimo_cambio();
    let antes = p.bytes_habito("h-agua");
    // 00:30 del 26 en Argentina: ya no es el mismo día
    assert_eq!(deshacer_hab(&p, &c, ms_argentina("2026-11-26 00:30")).estado, "cambio-despues");
    assert_eq!(p.bytes_habito("h-agua"), antes);
}

#[test]
fn deshacer_un_habito_valida_la_forma_del_cambio() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    let bueno = p.ultimo_cambio();
    let antes = p.bytes_habito("h-agua");
    let mut malos = Vec::new();
    for (k, v) in [
        ("herramienta", json!("tarea_tildar")),
        ("habito", json!("h-../x")),
        ("habito", json!(null)),
        ("estado", json!("error")),
        ("despues", json!({ "dia": "2026-11-25" })),
        ("antes", json!({ "dia": "2026-11-24", "valor": 2 })),
        ("despues", json!({ "dia": "x", "valor": 3 })),
    ] {
        let mut m = bueno.clone();
        m[k] = v;
        malos.push(m);
    }
    for m in malos {
        assert!(deshacer_habito(&p.habitos, &m, MEDIODIA).is_err(), "{m}");
    }
    // El deshacer de tareas no acepta un cambio de hábitos (y al revés)
    assert!(deshacer(&p.carpeta, &bueno, MEDIODIA).is_err());
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    assert!(deshacer_habito(&p.habitos, &p.ultimo_cambio(), MEDIODIA).is_err());
    assert_eq!(p.bytes_habito("h-agua"), antes);
}

#[test]
fn el_verbo_y_la_linea_de_deshecho_de_un_habito() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-agua", "sumar": 1 }));
    assert_eq!(verbo_cambio(&p.ultimo_cambio()), "marcado");
    assert_eq!(linea_deshecho(&p.ultimo_cambio()), "Deshecho: marcado «Agua».");
    assert!(es_de_habitos(&p.ultimo_cambio()));
    p.llamar("tarea_crear", json!({ "titulo": "Pan" }));
    assert!(!es_de_habitos(&p.ultimo_cambio()));
}

#[test]
fn reintentar_un_habito_repite_la_marca_solo_el_mismo_dia() {
    let p = prueba();
    let error = json!({
        "id": "c-err", "herramienta": "habito_marcar", "estado": "error", "lista": null, "tarea": null, "habito": "h-agua", "titulo": "Agua",
        "antes": null, "despues": null, "motivo": "No se pudo guardar. No cambió nada.", "reintentable": true,
        "args": { "id": "h-agua", "sumar": 1, "dia": "2026-11-25" },
    });
    let (nuevo, tocadas) = reintentar_habito(&p.habitos, &error, MEDIODIA).unwrap();
    assert_eq!(nuevo["estado"], "hecho");
    assert_eq!(nuevo["despues"], json!({ "dia": "2026-11-25", "valor": 3 }));
    assert_eq!(tocadas, vec![json!({ "habito": "h-agua", "origen": "chat" })]);
    // Al día siguiente no marca otro día: error
    let (otro, tocadas) = reintentar_habito(&p.habitos, &error, ms_argentina("2026-11-26 09:00")).unwrap();
    assert_eq!(otro["estado"], "error");
    assert_eq!(otro["motivo"], "Solo se marcan los hábitos de hoy.");
    assert!(tocadas.is_empty());
    assert_eq!(p.hoy_de("h-agua"), 3);
    // Lo que no es reintentable, no; el de tareas no acepta uno de hábitos
    let mut no = error.clone();
    no["reintentable"] = json!(false);
    assert!(reintentar_habito(&p.habitos, &no, MEDIODIA).is_err());
    assert!(reintentar(&p.carpeta, &error, MEDIODIA).is_err());
}

#[test]
fn un_error_de_marcar_guarda_el_dia_en_sus_args() {
    let p = prueba();
    p.llamar("habito_marcar", json!({ "id": "h-yoga", "valor": 1 }));
    let c = p.ultimo_cambio();
    assert_eq!(c["estado"], "error");
    assert_eq!(c["args"], json!({ "id": "h-yoga", "valor": 1, "dia": "2026-11-25" }));
}

#[test]
fn las_herramientas_de_tareas_siguen_igual_con_los_habitos() {
    // Lo de antes: crear, tildar y ver tareas no tocan los hábitos ni avisan a su hoja
    let p = prueba();
    let antes = p.bytes_habito("h-agua");
    assert_eq!(p.llamar("tarea_crear", json!({ "titulo": "Pan" })).0, "Anotada «Pan» en Casa.");
    assert_eq!(p.llamar("tarea_tildar", json!({ "id": "t-yerba", "hecha": true })).0, "Tildada «Yerba».");
    assert!(p.ultimo_cambio().get("habito").is_none());
    assert_eq!(p.bytes_habito("h-agua"), antes);
    assert!(p.avisos_habitos.todos().is_empty());
    assert_eq!(p.tareas.todos().len(), 2);
}
