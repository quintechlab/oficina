// Tests de claves.rs (#23, docs/diseno/configuracion-ux.md 9.4 y caso 10 de la sección 10). Ninguno
// usa una clave real: los valores son falsos a la vista ("FALSA"). "Probar" se prueba contra un
// servidor falso en 127.0.0.1 que devuelve lo medido el 24/11/2026 contra cada proveedor (sin clave y
// con una clave falsa): Anthropic y OpenAI responden 401; Gemini, 403 sin clave y 400 con
// `API_KEY_INVALID` con una clave que no sirve.
use super::*;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread::JoinHandle;

const FALSA: &str = "sk-ant-FALSA-de-prueba-0000000000000000";

// ---------------------------------------------------------------- respuestas medidas

/// Anthropic, `GET /v1/models` con una clave falsa (medido): 401.
const ANTHROPIC_401: &str = r#"{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"},"request_id":"req_011ChM1g6fYqVUdwxvVsZG61"}"#;
/// OpenAI, `GET /v1/models` con una clave falsa (medido, con el final de la clave enmascarado por OpenAI): 401.
const OPENAI_401: &str = r#"{"error":{"message":"Incorrect API key provided: sk-FALSA***********************0000. You can find your API key at https://platform.openai.com/account/api-keys.","type":"invalid_request_error","param":null,"code":"invalid_api_key"}}"#;
/// Gemini, `GET /v1beta/models` con una clave falsa (medido): 400 con `API_KEY_INVALID`, no 401.
const GEMINI_400_CLAVE: &str = r#"{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID","domain":"googleapis.com","metadata":{"service":"generativelanguage.googleapis.com"}}]}}"#;
/// Gemini sin clave (medido): 403 `PERMISSION_DENIED`.
const GEMINI_403: &str = r#"{"error":{"code":403,"message":"Permission denied on the service.","status":"PERMISSION_DENIED"}}"#;

// ---------------------------------------------------------------- ayudas

fn http(estado: &str, cuerpo: &str) -> Vec<u8> {
    format!("HTTP/1.1 {estado}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{cuerpo}", cuerpo.len()).into_bytes()
}

/// Un servidor falso que atiende una conexión con `respuesta` y devuelve el pedido que recibió.
fn servidor(respuesta: Vec<u8>) -> (u16, JoinHandle<String>) {
    let escucha = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let puerto = escucha.local_addr().unwrap().port();
    let hilo = std::thread::spawn(move || {
        let Ok((mut conexion, _)) = escucha.accept() else { return String::new() };
        let mut lector = BufReader::new(conexion.try_clone().unwrap());
        let mut pedido = String::new();
        loop {
            let mut linea = String::new();
            if lector.read_line(&mut linea).unwrap_or(0) == 0 || linea == "\r\n" {
                break;
            }
            pedido.push_str(&linea);
        }
        let _ = conexion.write_all(&respuesta);
        pedido
    });
    (puerto, hilo)
}

fn agente_de_prueba(espera: Duration) -> ureq::Agent {
    ureq::Agent::config_builder().http_status_as_error(false).proxy(None).max_redirects(0).timeout_global(Some(espera)).build().into()
}

/// Prueba `proveedor` contra el servidor falso y devuelve el resultado y el pedido que llegó.
fn probar_contra(proveedor: &str, respuesta: Vec<u8>) -> (Resultado, String) {
    let (puerto, hilo) = servidor(respuesta);
    let r = probar_en(&agente_de_prueba(Duration::from_secs(5)), proveedor, &format!("http://127.0.0.1:{puerto}/v1/models"), FALSA);
    (r, hilo.join().unwrap())
}

// ---------------------------------------------------------------- partes puras (caso 10)

#[test]
fn solo_los_tres_proveedores_son_validos() {
    assert_eq!(PROVEEDORES, ["anthropic", "openai", "gemini"]);
    for p in PROVEEDORES {
        assert!(proveedor_valido(p), "{p}");
    }
    for p in ["", "Anthropic", "google", "anthropic ", "../anthropic", "claude"] {
        assert!(!proveedor_valido(p), "{p}");
    }
}

#[test]
fn el_objetivo_en_credenciales_es_avis_api_y_el_proveedor() {
    assert_eq!(objetivo("anthropic"), "Avis/api/anthropic");
    assert_eq!(objetivo("openai"), "Avis/api/openai");
    assert_eq!(objetivo("gemini"), "Avis/api/gemini");
}

#[test]
fn el_final_son_los_ultimos_4_caracteres_no_bytes() {
    assert_eq!(final_de(FALSA), "0000");
    assert_eq!(final_de("sk-ant-FALSA-a1B2"), "a1B2");
    // Por caracteres: con letras de varios bytes no corta un carácter por la mitad
    assert_eq!(final_de("clave-falsa-ñandú"), "andú");
    assert_eq!(final_de("abc"), "abc");
    assert_eq!(final_de(""), "");
}

#[test]
fn la_forma_vuelve_a_validarse_en_rust() {
    // Recorta las puntas; vacía, con espacios en el medio o corta, no sirve
    assert_eq!(forma_valida(&format!("  {FALSA}\n")), Some(FALSA));
    assert_eq!(forma_valida(""), None);
    assert_eq!(forma_valida("   "), None);
    assert_eq!(forma_valida("sk-ant-FALSA de-prueba-0000000000"), None);
    assert_eq!(forma_valida("sk-ant-FALSA-corta"), None);
    // El blob de Credenciales tiene un tope de 2 560 bytes
    assert_eq!(forma_valida(&"x".repeat(TOPE_BLOB)), Some("x".repeat(TOPE_BLOB).as_str()));
    assert_eq!(forma_valida(&"x".repeat(TOPE_BLOB + 1)), None);
}

#[test]
fn el_resultado_sale_del_estado_http() {
    assert_eq!(resultado_de_estado(Some(200)), Resultado::Valida);
    assert_eq!(resultado_de_estado(Some(401)), Resultado::Rechazada);
    assert_eq!(resultado_de_estado(Some(403)), Resultado::Rechazada);
    assert_eq!(resultado_de_estado(Some(500)), Resultado::Otro(500));
    assert_eq!(resultado_de_estado(Some(429)), Resultado::Otro(429));
    assert_eq!(resultado_de_estado(None), Resultado::SinRed);
}

#[test]
fn gemini_rechaza_con_400_y_api_key_invalid() {
    // Medido: Gemini no responde 401 con una clave que no sirve, sino 400 con API_KEY_INVALID
    assert_eq!(resultado_de("gemini", Some(400), GEMINI_400_CLAVE), Resultado::Rechazada);
    // Otro 400 de Gemini, o un 400 de otro proveedor, no es una clave rechazada
    assert_eq!(resultado_de("gemini", Some(400), r#"{"error":{"code":400,"status":"INVALID_ARGUMENT"}}"#), Resultado::Otro(400));
    assert_eq!(resultado_de("openai", Some(400), GEMINI_400_CLAVE), Resultado::Otro(400));
    assert_eq!(resultado_de("gemini", Some(403), GEMINI_403), Resultado::Rechazada);
}

#[test]
fn el_resultado_va_a_la_ventana_sin_nada_de_la_clave() {
    assert_eq!(Resultado::Valida.json(), serde_json::json!({ "resultado": "valida" }));
    assert_eq!(Resultado::Rechazada.json(), serde_json::json!({ "resultado": "rechazada" }));
    assert_eq!(Resultado::SinRed.json(), serde_json::json!({ "resultado": "sin-red" }));
    assert_eq!(Resultado::Otro(500).json(), serde_json::json!({ "resultado": "otro", "estado": 500 }));
}

#[test]
fn el_registro_dice_que_paso_y_con_que_proveedor_nunca_la_clave() {
    assert_eq!(linea_registro("guardada", "anthropic"), "claves: guardada anthropic");
    assert_eq!(linea_registro("probada: rechazada", "gemini"), "claves: probada: rechazada gemini");
}

#[test]
fn los_pedidos_de_prueba_son_los_de_solo_lectura_de_cada_proveedor() {
    assert_eq!(url_de("anthropic"), Some("https://api.anthropic.com/v1/models"));
    assert_eq!(url_de("openai"), Some("https://api.openai.com/v1/models"));
    assert_eq!(url_de("gemini"), Some("https://generativelanguage.googleapis.com/v1beta/models"));
    assert_eq!(url_de("otro"), None);
    assert_eq!(cabeceras("anthropic", FALSA), vec![("x-api-key", FALSA.to_string()), ("anthropic-version", "2023-06-01".to_string())]);
    assert_eq!(cabeceras("openai", FALSA), vec![("Authorization", format!("Bearer {FALSA}"))]);
    assert_eq!(cabeceras("gemini", FALSA), vec![("x-goog-api-key", FALSA.to_string())]);
    // La clave nunca va en la dirección (quedaría en registros de proxies)
    for p in PROVEEDORES {
        assert!(!url_de(p).unwrap().contains('?'), "{p}");
    }
}

// ---------------------------------------------------------------- Probar contra el servidor falso

#[test]
fn probar_anthropic_manda_get_con_sus_cabeceras_y_un_401_es_rechazada() {
    let (r, pedido) = probar_contra("anthropic", http("401 Unauthorized", ANTHROPIC_401));
    assert_eq!(r, Resultado::Rechazada);
    let p = pedido.to_lowercase();
    assert!(p.starts_with("get /v1/models http/1.1"), "{pedido}");
    assert!(p.contains(&format!("x-api-key: {}", FALSA.to_lowercase())));
    assert!(p.contains("anthropic-version: 2023-06-01"));
}

#[test]
fn probar_openai_con_bearer_y_un_401_es_rechazada() {
    let (r, pedido) = probar_contra("openai", http("401 Unauthorized", OPENAI_401));
    assert_eq!(r, Resultado::Rechazada);
    assert!(pedido.to_lowercase().contains(&format!("authorization: bearer {}", FALSA.to_lowercase())));
}

#[test]
fn probar_gemini_con_su_cabecera_y_el_400_medido_es_rechazada() {
    let (r, pedido) = probar_contra("gemini", http("400 Bad Request", GEMINI_400_CLAVE));
    assert_eq!(r, Resultado::Rechazada);
    assert!(pedido.to_lowercase().contains(&format!("x-goog-api-key: {}", FALSA.to_lowercase())));
}

#[test]
fn probar_con_200_es_valida_y_con_500_otro() {
    assert_eq!(probar_contra("anthropic", http("200 OK", r#"{"data":[],"has_more":false}"#)).0, Resultado::Valida);
    assert_eq!(probar_contra("openai", http("500 Internal Server Error", "{}")).0, Resultado::Otro(500));
}

#[test]
fn probar_sin_conexion_es_sin_red() {
    // Un puerto que nadie escucha
    let puerto = TcpListener::bind(("127.0.0.1", 0)).unwrap().local_addr().unwrap().port();
    let r = probar_en(&agente_de_prueba(Duration::from_secs(5)), "openai", &format!("http://127.0.0.1:{puerto}/v1/models"), FALSA);
    assert_eq!(r, Resultado::SinRed);
}

#[test]
fn probar_que_no_responde_a_tiempo_es_sin_red() {
    let escucha = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let puerto = escucha.local_addr().unwrap().port();
    // Acepta y nunca contesta
    let hilo = std::thread::spawn(move || {
        let c = escucha.accept();
        std::thread::sleep(Duration::from_secs(3));
        drop(c);
    });
    let r = probar_en(&agente_de_prueba(Duration::from_millis(600)), "anthropic", &format!("http://127.0.0.1:{puerto}/v1/models"), FALSA);
    assert_eq!(r, Resultado::SinRed);
    hilo.join().unwrap();
}

#[test]
fn una_redireccion_no_se_sigue() {
    // La clave va en una cabecera: un 3xx no la lleva a otro lugar
    let (r, _) = probar_contra("openai", b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:1/robo\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_vec());
    assert_eq!(r, Resultado::Otro(302));
}

#[test]
fn la_espera_de_probar_es_de_10_segundos() {
    assert_eq!(ESPERA_PRUEBA, Duration::from_secs(10));
}

// ---------------------------------------------------------------- el secreto en memoria

// `Secreto` no implementa Debug ni Display: no se puede meter en un format! por error (lo frena el
// compilador). Se lee con `texto()` y al soltarlo se pisan sus bytes con ceros
#[test]
fn el_secreto_se_lee_como_texto() {
    let s = Secreto::from(String::from(FALSA));
    assert_eq!(s.texto(), FALSA);
    let t = Secreto::from(String::from("  sk-ant-FALSA-de-prueba-0000000000 "));
    assert_eq!(t.texto(), "  sk-ant-FALSA-de-prueba-0000000000 ");
}

// ---------------------------------------------------------------- Credenciales de Windows (de verdad)

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

/// Un objetivo propio de cada test, que no es el de Avis: nunca toca las claves del usuario.
fn objetivo_de_prueba() -> String {
    format!("Avis/prueba-cargo/{}-{}", std::process::id(), CONTADOR.fetch_add(1, Ordering::SeqCst))
}

#[cfg(windows)]
#[test]
fn credenciales_guarda_lee_y_borra_un_valor_falso() {
    let o = objetivo_de_prueba();
    assert!(leer_de(&o).unwrap().is_none(), "no había nada");
    escribir_en(&o, FALSA).unwrap();
    assert_eq!(leer_de(&o).unwrap().unwrap().texto(), FALSA);
    // Reemplazar pisa la anterior
    escribir_en(&o, "sk-ant-FALSA-reemplazo-1111111111111").unwrap();
    assert_eq!(leer_de(&o).unwrap().unwrap().texto(), "sk-ant-FALSA-reemplazo-1111111111111");
    borrar_de(&o).unwrap();
    assert!(leer_de(&o).unwrap().is_none(), "quedó borrada");
    // Borrar lo que no está no es un error
    borrar_de(&o).unwrap();
}

#[test]
fn el_proveedor_desconocido_no_llega_a_credenciales() {
    assert!(guardar("google", Secreto::from(String::from(FALSA))).is_err());
    assert!(borrar("../otro").is_err());
    assert_eq!(probar("nadie"), Err(String::from("proveedor desconocido")));
}

#[test]
fn guardar_una_clave_con_mala_forma_no_llega_a_credenciales() {
    assert_eq!(guardar("anthropic", Secreto::from(String::from("corta"))).unwrap_err(), "forma");
    assert_eq!(guardar("anthropic", Secreto::from(String::from("con espacios en el medio 000000000"))).unwrap_err(), "forma");
}

#[test]
fn el_error_de_windows_es_corto_y_sin_la_clave() {
    assert_eq!(error_windows(1312), "windows:1312");
}

// Se lee el fuente: ninguna línea que registra, devuelve un error o arma un JSON lleva la clave; la
// única que la formatea es la cabecera de OpenAI ("Bearer …"), que va al proveedor
#[test]
fn el_codigo_nunca_formatea_la_clave() {
    let fuente = include_str!("claves.rs");
    let mut bearer = 0;
    for (i, l) in fuente.lines().enumerate() {
        let l = l.trim();
        if l.starts_with("//") || !(l.contains("format!") || l.contains("json!") || l.contains("anotar(")) {
            continue;
        }
        if l.contains("format!(\"Bearer {clave}\")") {
            bearer += 1;
            continue;
        }
        assert!(!l.contains("{clave") && !l.contains("texto()"), "línea {}: {l}", i + 1);
    }
    assert_eq!(bearer, 1);
}
