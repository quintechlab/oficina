// Tests de chat.rs (#22, docs/diseno/chat-avis-ux.md 14.2, 1 a 6). Las líneas de Claude Code son
// las medidas en E0 (`src/fixtures/chat/*.jsonl`). Los procesos falsos son `cmd.exe` que leen una
// línea de stdin y escriben un fixture: nunca se lanza el `claude` real salvo en los tests
// `#[ignore]` del final (`cargo test real_ -- --ignored`).
use super::*;
use std::sync::atomic::AtomicUsize;

// ---------------------------------------------------------------- ayudas

const TEXTO: &str = include_str!("fixtures/chat/turno-texto.jsonl");
const HERRAMIENTAS: &str = include_str!("fixtures/chat/turno-herramientas.jsonl");
const IMAGEN: &str = include_str!("fixtures/chat/turno-imagen.jsonl");
const FRENADA: &str = include_str!("fixtures/chat/frenada.jsonl");
const SIN_RED: &str = include_str!("fixtures/chat/sin-red.jsonl");
const SIN_RED_DNS: &str = include_str!("fixtures/chat/sin-red-dns.jsonl");
const SIN_SESION: &str = include_str!("fixtures/chat/sin-sesion.jsonl");
const TOPE: &str = include_str!("fixtures/chat/tope.jsonl");
const PDF: &str = include_str!("fixtures/chat/pdf-15mb.jsonl");
const TODOS: [&str; 9] = [TEXTO, HERRAMIENTAS, IMAGEN, FRENADA, SIN_RED, SIN_RED_DNS, SIN_SESION, TOPE, PDF];

fn lineas(fixture: &str) -> Vec<Value> {
    fixture.lines().filter(|l| !l.trim().is_empty()).map(|l| serde_json::from_str(l).unwrap()).collect()
}

/// La primera línea del fixture que cumple `cumple`.
fn linea(fixture: &str, cumple: impl Fn(&Value) -> bool) -> Value {
    lineas(fixture).into_iter().find(|v| cumple(v)).expect("el fixture no tiene esa línea")
}

fn es(v: &Value, tipo: &str, subtipo: &str) -> bool {
    v["type"] == tipo && (subtipo.is_empty() || v["subtype"] == subtipo)
}

fn eventos(fixture: &str) -> Vec<EventoChat> {
    lineas(fixture).iter().filter_map(evento_de_linea).collect()
}

fn sesion_nueva() -> Sesion {
    Sesion::Nueva(String::from("8c9494fd-dbea-492d-a475-8660c720f9d9"))
}

fn args(sesion: &Sesion) -> Vec<String> {
    argumentos_chat(&Pedido { ajustes: Path::new(r"C:\config\chat\ajustes.json"), mascota: "Ascua", sesion })
}

/// El valor que sigue a `bandera` en la lista.
fn valor<'a>(a: &'a [String], bandera: &str) -> Option<&'a str> {
    a.iter().position(|x| x == bandera).and_then(|i| a.get(i + 1)).map(String::as_str)
}

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

/// Una carpeta temporal propia de cada test, fuera del repositorio.
fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-chat-test-{}-{n}", std::process::id()));
    borrar(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

/// Borra la carpeta de un test. Windows no deja borrar la carpeta de trabajo de un proceso que
/// todavía está saliendo (el trabajo de Windows lo mata, pero no al instante): reintenta 5 s.
fn borrar(c: &Path) {
    let limite = Instant::now() + Duration::from_secs(5);
    while fs::remove_dir_all(c).is_err() && c.exists() && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(100));
    }
}

// ---------------------------------------------------------------- 1. argumentos_chat (7.1)

#[test]
fn argumentos_exactos_de_7_1_la_primera_vez() {
    let a = args(&sesion_nueva());
    let esperado: Vec<String> = [
        "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--include-partial-messages", "--replay-user-messages",
        "--permission-mode", "manual",
        "--tools", "Read,Glob,Grep", "--allowedTools", "Read,Glob,Grep",
        "--permission-prompts", "none", "--safe-mode", "--strict-mcp-config",
        "--settings", r"C:\config\chat\ajustes.json",
        "--append-system-prompt", &instruccion_chat("Ascua"),
        "--max-budget-usd", "2",
        "--session-id", "8c9494fd-dbea-492d-a475-8660c720f9d9",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    assert_eq!(a, esperado);
}

#[test]
fn argumentos_con_las_barreras_de_seguridad() {
    for s in [sesion_nueva(), Sesion::Retomar(String::from("7ee41c33-05e9-4265-9ade-a67a92f48f2d"))] {
        let a = args(&s);
        assert_eq!(valor(&a, "--permission-mode"), Some("manual"));
        assert_eq!(valor(&a, "--tools"), Some("Read,Glob,Grep"));
        assert_eq!(valor(&a, "--allowedTools"), Some("Read,Glob,Grep"));
        for prohibido in ["bypassPermissions", "skip-permissions", "Bash", "Write", "Edit", "WebFetch"] {
            assert!(a.iter().all(|x| !x.contains(prohibido)), "aparece {prohibido} en {a:?}");
        }
        // E0 (D34): las tres juntas
        assert!(a.contains(&String::from("--safe-mode")));
        assert!(a.contains(&String::from("--strict-mcp-config")));
        assert_eq!(valor(&a, "--settings"), Some(r"C:\config\chat\ajustes.json"));
        assert_eq!(valor(&a, "--max-budget-usd"), Some("2"));
        assert!(!a.contains(&String::from("--model")), "D17: sin --model");
    }
}

#[test]
fn session_id_la_primera_vez_y_resume_despues_nunca_los_dos() {
    let nueva = args(&sesion_nueva());
    assert_eq!(valor(&nueva, "--session-id"), Some("8c9494fd-dbea-492d-a475-8660c720f9d9"));
    assert!(!nueva.contains(&String::from("--resume")));
    let retoma = args(&Sesion::Retomar(String::from("7ee41c33-05e9-4265-9ade-a67a92f48f2d")));
    assert_eq!(valor(&retoma, "--resume"), Some("7ee41c33-05e9-4265-9ade-a67a92f48f2d"));
    assert!(!retoma.contains(&String::from("--session-id")));
}

#[test]
fn la_instruccion_lleva_el_nombre_de_la_mascota() {
    let i = instruccion_chat("Ascua");
    assert!(i.starts_with("Sos Ascua, la mascota de Avis,"));
    assert!(!i.contains("{Mascota}"));
    assert!(i.contains("no modificás archivos ni corrés comandos"));
    // Sin saltos de línea: viaja como un argumento (y por `cmd.exe` si `claude` es un `.cmd`)
    assert!(!i.contains('\n') && !i.contains('\r'));
}

#[test]
fn un_nombre_de_mascota_raro_vuelve_a_avi() {
    assert_eq!(nombre_mascota("Ascua"), "Ascua");
    assert_eq!(nombre_mascota("  Brote  "), "Brote");
    assert_eq!(nombre_mascota(""), "Avi");
    assert_eq!(nombre_mascota("a\nb"), "Avi");
    assert_eq!(nombre_mascota(&"x".repeat(41)), "Avi");
}

#[test]
fn claude_de_npm_se_corre_directo_sin_cmd() {
    let cmd = Path::new(r"C:\npm\claude.cmd");
    let exe = Path::new(r"C:\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe");
    assert_eq!(claude_directo(cmd, |p| p == exe), exe);
    // Si no está el .exe al lado, el .cmd (lo corre la biblioteca estándar con cmd.exe)
    assert_eq!(claude_directo(cmd, |_| false), cmd);
    // Un .exe queda como está
    let nativo = Path::new(r"C:\Users\x\.local\bin\claude.exe");
    assert_eq!(claude_directo(nativo, |_| true), nativo);
}

// ---------------------------------------------------------------- 2. ajustes.json (7.2)

#[test]
fn ajustes_exactamente_7_2() {
    assert_eq!(
        ajustes_chat(),
        json!({
            "enabledPlugins": { "oficina@quintech": false, "engram@engram": false },
            "disableAllHooks": true,
            "outputStyle": "default"
        })
    );
}

#[test]
fn escribir_ajustes_deja_el_archivo_y_la_carpeta_de_trabajo() {
    let c = carpeta_temporal();
    let ruta = escribir_ajustes(&c).unwrap();
    assert_eq!(ruta, c.join("ajustes.json"));
    let leido: Value = serde_json::from_str(&fs::read_to_string(&ruta).unwrap()).unwrap();
    assert_eq!(leido, ajustes_chat());
    assert!(carpeta_trabajo(&c).is_dir());
    // Siempre igual: lo que haya se pisa
    fs::write(&ruta, "{\"disableAllHooks\":false}").unwrap();
    escribir_ajustes(&c).unwrap();
    let leido: Value = serde_json::from_str(&fs::read_to_string(&ruta).unwrap()).unwrap();
    assert_eq!(leido, ajustes_chat());
    assert!(!c.join("ajustes.json.tmp").exists());
    borrar(&c);
}

// ---------------------------------------------------------------- 3. evento_de_linea (7.5)

#[test]
fn init_es_listo_con_la_sesion() {
    let v = linea(TEXTO, |v| es(v, "system", "init"));
    assert_eq!(evento_de_linea(&v), Some(EventoChat::Listo { sesion: String::from("7ee41c33-05e9-4265-9ade-a67a92f48f2d") }));
}

#[test]
fn status_requesting_es_pidiendo() {
    let v = linea(TEXTO, |v| es(v, "system", "status"));
    assert_eq!(evento_de_linea(&v), Some(EventoChat::Pidiendo));
    let otro = json!({ "type": "system", "subtype": "status", "status": "compacting" });
    assert_eq!(evento_de_linea(&otro), None);
}

#[test]
fn pensamiento_es_pensando() {
    let inicio = linea(HERRAMIENTAS, |v| v["type"] == "stream_event" && v["event"]["content_block"]["type"] == "thinking");
    assert_eq!(evento_de_linea(&inicio), Some(EventoChat::Pensando));
    let tokens = linea(HERRAMIENTAS, |v| es(v, "system", "thinking_tokens"));
    assert_eq!(evento_de_linea(&tokens), Some(EventoChat::Pensando));
    // Los deltas del pensamiento no son texto
    let delta = linea(HERRAMIENTAS, |v| v["event"]["delta"]["type"] == "thinking_delta");
    assert_eq!(evento_de_linea(&delta), None);
}

#[test]
fn text_delta_es_texto() {
    let v = linea(HERRAMIENTAS, |v| v["event"]["delta"]["type"] == "text_delta");
    assert_eq!(evento_de_linea(&v), Some(EventoChat::Texto { texto: String::from("Me llamo Asc") }));
}

#[test]
fn herramientas_con_el_nombre_del_archivo_o_el_patron_nunca_la_ruta() {
    let de = |nombre: &str| {
        let v = linea(HERRAMIENTAS, |v| v["type"] == "assistant" && v["message"]["content"][0]["name"] == nombre);
        evento_de_linea(&v)
    };
    assert_eq!(de("Glob"), Some(EventoChat::Herramienta { nombre: String::from("Glob"), detalle: String::from("*.md") }));
    assert_eq!(de("Grep"), Some(EventoChat::Herramienta { nombre: String::from("Grep"), detalle: String::from("LIMONERO") }));
    assert_eq!(de("Read"), Some(EventoChat::Herramienta { nombre: String::from("Read"), detalle: String::from("nota.md") }));
    // Un patrón con ruta absoluta queda en su último tramo
    assert_eq!(detalle_herramienta("Glob", &json!({ "pattern": r"C:\Users\x\docs\*.md" })), "*.md");
    assert_eq!(detalle_herramienta("Read", &json!({ "file_path": "/home/x/README.md" })), "README.md");
    assert_eq!(detalle_herramienta("Read", &json!({})), "");
}

#[test]
fn un_assistant_de_texto_o_pensamiento_no_es_evento() {
    let texto = linea(TEXTO, |v| v["type"] == "assistant");
    assert_eq!(evento_de_linea(&texto), None);
    let pensamiento = linea(HERRAMIENTAS, |v| v["type"] == "assistant" && v["message"]["content"][0]["type"] == "thinking");
    assert_eq!(evento_de_linea(&pensamiento), None);
}

#[test]
fn task_summary_se_ignora() {
    let v = linea(HERRAMIENTAS, |v| es(v, "system", "task_summary"));
    assert_eq!(evento_de_linea(&v), None);
}

#[test]
fn result_sin_error_es_fin_con_su_duracion() {
    let v = linea(TEXTO, |v| v["type"] == "result");
    assert_eq!(evento_de_linea(&v), Some(EventoChat::Fin { ms: 3876 }));
}

#[test]
fn result_success_con_is_error_es_error() {
    for (fixture, motivo) in [(SIN_RED, "red"), (SIN_RED_DNS, "red"), (SIN_SESION, "sesion")] {
        let v = linea(fixture, |v| v["type"] == "result");
        assert_eq!(v["subtype"], "success");
        match evento_de_linea(&v) {
            Some(EventoChat::Error { motivo: m, .. }) => assert_eq!(m, motivo),
            otro => panic!("esperaba error {motivo}, salió {otro:?}"),
        }
    }
}

#[test]
fn api_retry_es_reintento() {
    let v = linea(SIN_RED, |v| es(v, "system", "api_retry"));
    assert_eq!(evento_de_linea(&v), Some(EventoChat::Reintento { intento: 1, maximo: 10, sin_respuesta: true }));
    let con_respuesta = json!({ "type": "system", "subtype": "api_retry", "attempt": 4, "max_retries": 10, "error_status": 529 });
    assert_eq!(evento_de_linea(&con_respuesta), Some(EventoChat::Reintento { intento: 4, maximo: 10, sin_respuesta: false }));
}

#[test]
fn result_abortado_es_frenada() {
    let v = linea(FRENADA, |v| v["type"] == "result");
    assert_eq!(evento_de_linea(&v), Some(EventoChat::Frenada));
}

#[test]
fn result_del_tope_es_error_tope() {
    let v = linea(TOPE, |v| v["type"] == "result");
    assert!(matches!(evento_de_linea(&v), Some(EventoChat::Error { motivo: "tope", .. })));
}

#[test]
fn rate_limit_se_lee_del_status_nunca_del_overage() {
    // Medido: `overageStatus: "rejected"` con el uso permitido
    let permitido = linea(TEXTO, |v| v["type"] == "rate_limit_event");
    assert_eq!(permitido["rate_limit_info"]["overageStatus"], "rejected");
    assert_eq!(evento_de_linea(&permitido), None);
    let mut rechazado = permitido.clone();
    rechazado["rate_limit_info"]["status"] = json!("rejected");
    assert!(matches!(evento_de_linea(&rechazado), Some(EventoChat::Error { motivo: "limite", .. })));
}

#[test]
fn el_eco_es_recibido_y_los_tool_result_no() {
    let eco = linea(TEXTO, |v| v["type"] == "user" && v["isReplay"] == true);
    assert_eq!(evento_de_linea(&eco), Some(EventoChat::Recibido));
    let resultado = linea(HERRAMIENTAS, |v| v["type"] == "user" && v["message"]["content"][0]["type"] == "tool_result");
    assert_eq!(evento_de_linea(&resultado), None);
    let interrumpido = linea(FRENADA, |v| v["type"] == "user" && v.get("isReplay").is_none());
    assert_eq!(evento_de_linea(&interrumpido), None);
}

#[test]
fn hooks_ui_status_post_turn_y_control_response_se_ignoran() {
    let post = linea(TEXTO, |v| es(v, "system", "post_turn_summary"));
    assert_eq!(evento_de_linea(&post), None);
    let control = linea(FRENADA, |v| v["type"] == "control_response");
    assert_eq!(evento_de_linea(&control), None);
    // Sin fixture (con --safe-mode y --settings no aparecen): se prueban como desconocidas
    for v in [
        json!({ "type": "system", "subtype": "hook_started", "hook_name": "SessionStart" }),
        json!({ "type": "system", "subtype": "hook_response", "output": "x" }),
        json!({ "type": "system", "subtype": "ui_status", "text": "x" }),
    ] {
        assert_eq!(evento_de_linea(&v), None);
    }
}

#[test]
fn una_linea_desconocida_o_rota_no_es_evento_ni_entra_en_panico() {
    assert_eq!(evento_de_linea(&json!({ "type": "algo_nuevo" })), None);
    assert_eq!(evento_de_linea(&json!("texto suelto")), None);
    assert_eq!(evento_de_linea(&json!(null)), None);
    assert_eq!(evento_de_texto("{\"type\":\"result\""), None);
    assert_eq!(evento_de_texto("Warning: claude.ai MCP servers blocked"), None);
    assert_eq!(evento_de_texto(""), None);
    assert_eq!(evento_de_texto("{\"type\":\"system\",\"subtype\":\"status\",\"status\":\"requesting\"}"), Some(EventoChat::Pidiendo));
}

#[test]
fn todas_las_lineas_medidas_pasan_sin_panico() {
    for f in TODOS {
        for l in f.lines() {
            let _ = evento_de_texto(l);
        }
    }
}

#[test]
fn un_turno_de_texto_en_orden() {
    let e = eventos(TEXTO);
    assert!(matches!(e.first(), Some(EventoChat::Listo { .. })));
    assert_eq!(e[1], EventoChat::Pidiendo);
    assert_eq!(e[2], EventoChat::Recibido);
    assert_eq!(e[3], EventoChat::Texto { texto: String::from("OK") });
    assert_eq!(e.last(), Some(&EventoChat::Fin { ms: 3876 }));
}

#[test]
fn los_eventos_van_a_la_ventana_con_su_forma() {
    assert_eq!(EventoChat::Listo { sesion: String::from("s") }.a_json(), json!({ "tipo": "listo", "sesion": "s" }));
    assert_eq!(EventoChat::Pidiendo.a_json(), json!({ "tipo": "pidiendo" }));
    assert_eq!(EventoChat::Pensando.a_json(), json!({ "tipo": "pensando" }));
    assert_eq!(EventoChat::Texto { texto: String::from("Ho") }.a_json(), json!({ "tipo": "texto", "texto": "Ho" }));
    assert_eq!(
        EventoChat::Herramienta { nombre: String::from("Read"), detalle: String::from("a.md") }.a_json(),
        json!({ "tipo": "herramienta", "nombre": "Read", "detalle": "a.md" })
    );
    assert_eq!(EventoChat::Fin { ms: 12 }.a_json(), json!({ "tipo": "fin", "ms": 12 }));
    assert_eq!(EventoChat::Error { motivo: "red", detalle: None }.a_json(), json!({ "tipo": "error", "motivo": "red" }));
    assert_eq!(
        EventoChat::Error { motivo: "otro", detalle: Some(String::from("x")) }.a_json(),
        json!({ "tipo": "error", "motivo": "otro", "detalle": "x" })
    );
    assert_eq!(EventoChat::Reintento { intento: 2, maximo: 10, sin_respuesta: true }.a_json(), json!({ "tipo": "reintento", "intento": 2, "maximo": 10 }));
    assert_eq!(EventoChat::Frenada.a_json(), json!({ "tipo": "frenada" }));
    assert_eq!(EventoChat::Recibido.a_json(), json!({ "tipo": "recibido" }));
}

// ---------------------------------------------------------------- 4. frenar y el turno (7.5, 7.6)

fn ahora() -> Instant {
    Instant::now()
}

#[test]
fn frenar_antes_del_init_queda_pendiente_y_sale_con_el_primer_evento() {
    let mut t = Turno::nuevo(1, ahora());
    assert!(!t.frenar(), "antes del init no se manda");
    let r = t.al_evento(EventoChat::Listo { sesion: String::from("s") });
    assert!(r.interrumpir, "sale con el init");
    // Una sola vez
    assert!(!t.frenar());
    assert!(!t.al_evento(EventoChat::Pidiendo).interrumpir);
}

#[test]
fn frenar_despues_del_init_sale_al_instante_y_una_sola_vez() {
    let mut t = Turno::nuevo(1, ahora());
    t.al_evento(EventoChat::Listo { sesion: String::from("s") });
    assert!(t.frenar());
    assert!(!t.frenar());
    let r = t.al_evento(EventoChat::Frenada);
    assert_eq!(r.emitir, vec![EventoChat::Frenada]);
    assert!(!t.activo());
}

#[test]
fn frenar_un_turno_terminado_no_hace_nada() {
    let mut t = Turno::nuevo(1, ahora());
    t.al_evento(EventoChat::Listo { sesion: String::from("s") });
    t.al_evento(EventoChat::Fin { ms: 1 });
    assert!(!t.frenar());
}

#[test]
fn sin_red_el_tercer_reintento_sin_respuesta_interrumpe_y_avisa_red_una_vez() {
    let mut t = Turno::nuevo(1, ahora());
    t.al_evento(EventoChat::Listo { sesion: String::from("s") });
    let r1 = t.al_evento(EventoChat::Reintento { intento: 1, maximo: 10, sin_respuesta: true });
    assert_eq!(r1, Reaccion { interrumpir: false, emitir: vec![EventoChat::Reintento { intento: 1, maximo: 10, sin_respuesta: true }] });
    t.al_evento(EventoChat::Reintento { intento: 2, maximo: 10, sin_respuesta: true });
    let r3 = t.al_evento(EventoChat::Reintento { intento: 3, maximo: 10, sin_respuesta: true });
    assert!(r3.interrumpir);
    assert_eq!(r3.emitir.last(), Some(&EventoChat::Error { motivo: "red", detalle: None }));
    // Lo que llega después (otro reintento, el result del corte) no repite el error
    assert_eq!(t.al_evento(EventoChat::Reintento { intento: 4, maximo: 10, sin_respuesta: true }), Reaccion::default());
    assert_eq!(t.al_evento(EventoChat::Frenada), Reaccion::default());
    assert!(!t.activo());
}

#[test]
fn los_reintentos_con_respuesta_del_servidor_no_son_red() {
    let mut t = Turno::nuevo(1, ahora());
    t.al_evento(EventoChat::Listo { sesion: String::from("s") });
    for intento in 1..=5 {
        let r = t.al_evento(EventoChat::Reintento { intento, maximo: 10, sin_respuesta: false });
        assert!(!r.interrumpir);
        assert_eq!(r.emitir.len(), 1);
    }
    assert!(t.activo());
}

#[test]
fn el_fixture_sin_red_da_un_solo_error_red_al_tercer_reintento() {
    let mut t = Turno::nuevo(1, ahora());
    let mut errores = Vec::new();
    let mut interrupciones = 0;
    for e in eventos(SIN_RED) {
        let r = t.al_evento(e);
        interrupciones += usize::from(r.interrumpir);
        errores.extend(r.emitir.into_iter().filter(|e| matches!(e, EventoChat::Error { .. })));
    }
    assert_eq!(errores, vec![EventoChat::Error { motivo: "red", detalle: None }]);
    assert_eq!(interrupciones, 1);
}

#[test]
fn un_solo_final_por_turno() {
    let mut t = Turno::nuevo(1, ahora());
    t.al_evento(EventoChat::Listo { sesion: String::from("s") });
    let limite = t.al_evento(EventoChat::Error { motivo: "limite", detalle: None });
    assert_eq!(limite.emitir.len(), 1);
    assert_eq!(t.al_evento(EventoChat::Error { motivo: "otro", detalle: None }), Reaccion::default());
}

#[test]
fn pidiendo_y_pensando_una_vez_por_turno() {
    let mut t = Turno::nuevo(1, ahora());
    assert_eq!(t.al_evento(EventoChat::Pidiendo).emitir, vec![EventoChat::Pidiendo]);
    assert!(t.al_evento(EventoChat::Pidiendo).emitir.is_empty());
    assert_eq!(t.al_evento(EventoChat::Pensando).emitir, vec![EventoChat::Pensando]);
    assert!(t.al_evento(EventoChat::Pensando).emitir.is_empty());
    assert_eq!(t.al_evento(EventoChat::Texto { texto: String::from("a") }).emitir.len(), 1);
}

#[test]
fn sin_noticias_a_los_15_s_del_envio() {
    let t0 = ahora();
    let mut t = Turno::nuevo(1, t0);
    assert!(!t.sin_noticias(t0 + Duration::from_secs(14), ECO_MAXIMO));
    assert!(t.sin_noticias(t0 + Duration::from_secs(15), ECO_MAXIMO));
    t.al_evento(EventoChat::Recibido);
    assert!(!t.sin_noticias(t0 + Duration::from_secs(60), ECO_MAXIMO));
}

#[test]
fn cortar_un_turno_da_su_error_una_vez() {
    let mut t = Turno::nuevo(1, ahora());
    assert_eq!(t.cortar("proceso"), Some(EventoChat::Error { motivo: "proceso", detalle: None }));
    assert_eq!(t.cortar("proceso"), None);
}

#[test]
fn el_pedido_de_frenar_es_el_medido() {
    assert_eq!(pedido_frenar(1), json!({ "type": "control_request", "request_id": "int-1", "request": { "subtype": "interrupt" } }));
}

#[test]
fn el_juntador_agrupa_los_tramos_de_50_ms() {
    let t0 = ahora();
    let mut j = Juntador::default();
    assert_eq!(j.espera(t0), None);
    j.agregar("Ho", t0);
    j.agregar("la", t0 + Duration::from_millis(20));
    assert!(!j.vencido(t0 + Duration::from_millis(49)));
    assert_eq!(j.espera(t0 + Duration::from_millis(20)), Some(Duration::from_millis(30)));
    assert!(j.vencido(t0 + Duration::from_millis(50)));
    assert_eq!(j.sacar(), Some(String::from("Hola")));
    assert_eq!(j.sacar(), None);
    assert!(!j.vencido(t0 + Duration::from_secs(1)));
}

// ---------------------------------------------------------------- 5. motivo_de_result (7.7)

#[test]
fn motivo_de_cada_fixture() {
    let result = |f: &str| linea(f, |v| v["type"] == "result");
    assert_eq!(motivo_de_result(&result(SIN_RED)), "red");
    assert_eq!(motivo_de_result(&result(SIN_RED_DNS)), "red");
    assert_eq!(motivo_de_result(&result(SIN_SESION)), "sesion");
    assert_eq!(motivo_de_result(&result(TOPE)), "tope");
}

#[test]
fn motivo_limite_y_otro_supuestos() {
    // Supuestos (no se pudo provocar): un 429 o el texto del límite de uso
    let limite = json!({ "type": "result", "subtype": "success", "is_error": true, "terminal_reason": "api_error", "api_error_status": 429, "result": "API Error: 429" });
    assert_eq!(motivo_de_result(&limite), "limite");
    let texto = json!({ "type": "result", "subtype": "success", "is_error": true, "result": "Claude AI usage limit reached|1795501200" });
    assert_eq!(motivo_de_result(&texto), "limite");
    let otro = json!({ "type": "result", "subtype": "error_during_execution", "is_error": true, "terminal_reason": "algo", "errors": ["x"] });
    assert_eq!(motivo_de_result(&otro), "otro");
}

#[test]
fn el_error_lleva_el_detalle_recortado() {
    let v = linea(SIN_RED, |v| v["type"] == "result");
    match evento_de_linea(&v) {
        Some(EventoChat::Error { detalle: Some(d), .. }) => assert!(d.contains("ECONNREFUSED")),
        otro => panic!("{otro:?}"),
    }
    let largo = json!({ "type": "result", "subtype": "success", "is_error": true, "result": "x".repeat(1000) });
    match evento_de_linea(&largo) {
        Some(EventoChat::Error { detalle: Some(d), .. }) => assert!(d.chars().count() <= 300),
        otro => panic!("{otro:?}"),
    }
}

// ---------------------------------------------------------------- la entrada (7.4)

#[test]
fn el_mensaje_lleva_el_bloque_avis_primero() {
    let m = mensaje_usuario("¿En qué anda?", Some("sesiones:\n  - x"));
    assert_eq!(
        m,
        json!({ "type": "user", "message": { "role": "user", "content": [
            { "type": "text", "text": "<avis>\nsesiones:\n  - x\n</avis>" },
            { "type": "text", "text": "¿En qué anda?" }
        ]}})
    );
    let solo = mensaje_usuario("Hola", None);
    assert_eq!(solo["message"]["content"], json!([{ "type": "text", "text": "Hola" }]));
}

#[test]
fn el_bloque_avis_va_solo_si_cambio_y_sin_las_claves_prohibidas() {
    let datos = json!({ "sesiones": [{ "proyecto": "catalogo", "repo": "quintechlab/catalogo", "borrador": "secreto" }] });
    let (bloque, firma) = bloque_avis(&datos, None);
    let bloque = bloque.expect("la primera vez va");
    assert!(bloque.contains("catalogo"));
    assert!(!bloque.contains("quintechlab/catalogo") && !bloque.contains("secreto"));
    // Igual: no va de nuevo y la firma sigue
    assert_eq!(bloque_avis(&datos, firma), (None, firma));
    // Cambió: va
    let otros = json!({ "sesiones": [{ "proyecto": "crm" }] });
    let (de_nuevo, firma2) = bloque_avis(&otros, firma);
    assert!(de_nuevo.is_some());
    assert_ne!(firma2, firma);
    // Sin datos: nada, y la firma no cambia
    assert_eq!(bloque_avis(&Value::Null, firma), (None, firma));
    assert_eq!(bloque_avis(&json!({}), firma), (None, firma));
}

#[test]
fn ids_validos_de_conversacion_y_sesion() {
    assert!(conversacion_valida("c-8c9494fd-dbea"));
    assert!(!conversacion_valida(""));
    assert!(!conversacion_valida("../x"));
    assert!(!conversacion_valida(&"a".repeat(129)));
    assert!(sesion_valida("8c9494fd-dbea-492d-a475-8660c720f9d9"));
    assert!(!sesion_valida("8c9494fd"));
    assert!(!sesion_valida("8c9494fd-dbea-492d-a475-8660c720f9dZ"));
    let u = nuevo_uuid();
    assert!(sesion_valida(&u), "{u}");
    assert_eq!(&u[14..15], "4", "versión 4");
    assert_ne!(nuevo_uuid(), nuevo_uuid());
}

// ---------------------------------------------------------------- 6. proceso falso

/// Eventos que emitió el chat (con `conversacion` y `turno`).
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
    /// Espera hasta que llegue un evento final o pasen 10 s.
    fn esperar_final(&self) {
        let limite = Instant::now() + Duration::from_secs(10);
        while Instant::now() < limite {
            if self.tipos().iter().any(|t| t == "fin" || t == "error" || t == "frenada") {
                return;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        panic!("no llegó el final: {:?}", self.tipos());
    }
}

/// Un lanzador que corre `cmd.exe /c <guion>` en vez de `claude` (los argumentos se ignoran).
#[cfg(windows)]
fn lanzador_cmd(guion: String) -> Lanzador {
    Arc::new(move |_l: &Lanzamiento| {
        use std::os::windows::process::CommandExt;
        let mut c = Command::new("cmd.exe");
        c.raw_arg(format!("/d /c {guion}"));
        Ok(c)
    })
}

#[cfg(windows)]
fn chat_falso(guion: String, tiempos: Tiempos) -> (Chat, Recibidos, PathBuf) {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador_cmd(guion), r.emisor(), tiempos);
    (chat, r, carpeta)
}

/// El fixture en un archivo (cortado en `hasta` líneas si se pide), para que `type` lo escriba.
#[cfg(windows)]
fn fixture_en_archivo(carpeta: &Path, fixture: &str, hasta: Option<usize>) -> PathBuf {
    let ruta = carpeta.join("fixture.jsonl");
    let texto: Vec<&str> = fixture.lines().take(hasta.unwrap_or(usize::MAX)).collect();
    fs::write(&ruta, texto.join("\n") + "\n").unwrap();
    ruta
}

#[cfg(windows)]
#[test]
fn proceso_falso_un_turno_completo() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    let (chat, r, carpeta) = chat_falso(format!("set /p x= & type \"{}\"", f.display()), Tiempos::default());
    let abierto = chat.abrir("c-1", "claude", None, "Avi", None).unwrap();
    assert_eq!(abierto["proceso"], "arrancando");
    chat.enviar("c-1", 7, "Respondé solo OK.", &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.tipos(), vec!["listo", "pidiendo", "recibido", "texto", "fin"]);
    for v in r.todos() {
        assert_eq!(v["conversacion"], "c-1");
        assert_eq!(v["turno"], 7);
    }
    assert_eq!(r.todos()[3]["texto"], "OK");
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_cortado_a_mitad_es_error_proceso() {
    let base = carpeta_temporal();
    // Hasta el primer text_delta: sin result
    let f = fixture_en_archivo(&base, TEXTO, Some(7));
    let (chat, r, carpeta) = chat_falso(format!("set /p x= & type \"{}\"", f.display()), Tiempos::default());
    chat.abrir("c-2", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-2", 1, "Hola", &Value::Null).unwrap();
    r.esperar_final();
    let todos = r.todos();
    let ultimo = todos.last().unwrap();
    assert_eq!(ultimo["tipo"], "error");
    assert_eq!(ultimo["motivo"], "proceso");
    assert_eq!(r.tipos().iter().filter(|t| *t == "error").count(), 1);
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_con_el_aviso_de_mcp_en_stderr_no_es_error() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    let guion = format!("set /p x= & echo Warning: claude.ai MCP servers blocked by enterprise policy: x 1>&2 & type \"{}\"", f.display());
    let (chat, r, carpeta) = chat_falso(guion, Tiempos::default());
    chat.abrir("c-3", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-3", 1, "Hola", &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"));
    assert!(!r.tipos().contains(&String::from("error")));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_un_turno_por_vez() {
    let base = carpeta_temporal();
    // Lee la línea y espera: el turno queda en curso
    let (chat, r, carpeta) = chat_falso(String::from("set /p x= & ping -n 30 127.0.0.1 >nul"), Tiempos::default());
    chat.abrir("c-4", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-4", 1, "Hola", &Value::Null).unwrap();
    assert!(chat.enviar("c-4", 2, "Otra", &Value::Null).is_err(), "D7: sin cola");
    assert!(chat.enviar("c-4", 3, "   ", &Value::Null).is_err(), "texto vacío");
    chat.apagar();
    assert!(r.tipos().iter().all(|t| t != "texto"));
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_sin_eco_a_tiempo_es_error_proceso_y_lo_mata() {
    let tiempos = Tiempos { eco: Duration::from_millis(400), ..Tiempos::default() };
    let (chat, r, carpeta) = chat_falso(String::from("set /p x= & ping -n 30 127.0.0.1 >nul"), tiempos);
    chat.abrir("c-5", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-5", 1, "Hola", &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.todos().last().unwrap()["motivo"], "proceso");
    // El proceso ya no está: el próximo envío lanza otro
    let limite = Instant::now() + Duration::from_secs(5);
    while chat.vivo("c-5") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(!chat.vivo("c-5"));
    chat.apagar();
    borrar(&carpeta);
}

#[cfg(windows)]
#[test]
fn proceso_falso_la_inactividad_cierra_stdin_y_el_proceso_sale() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Después del turno espera otra línea: solo sale si se cierra stdin
    let guion = format!("set /p x= & type \"{}\" & set /p y=", f.display());
    let tiempos = Tiempos { inactividad: Duration::from_millis(300), ..Tiempos::default() };
    let (chat, r, carpeta) = chat_falso(guion, tiempos);
    chat.abrir("c-6", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-6", 1, "Hola", &Value::Null).unwrap();
    r.esperar_final();
    let limite = Instant::now() + Duration::from_secs(5);
    while chat.vivo("c-6") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(50));
    }
    assert!(!chat.vivo("c-6"), "la inactividad cierra stdin y el proceso termina");
    assert_eq!(r.tipos().iter().filter(|t| *t == "error").count(), 0, "cerrar sin turno no es error");
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_cerrar_deja_terminar_el_turno() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Tarda un poco antes de responder: cerrar stdin en el medio no corta el turno
    let guion = format!("set /p x= & ping -n 2 127.0.0.1 >nul & type \"{}\"", f.display());
    let (chat, r, carpeta) = chat_falso(guion, Tiempos::default());
    chat.abrir("c-7", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-7", 1, "Hola", &Value::Null).unwrap();
    chat.cerrar("c-7");
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn sin_claude_el_envio_da_error_sin_claude() {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let lanzador: Lanzador = Arc::new(|_l: &Lanzamiento| Err(std::io::Error::new(std::io::ErrorKind::NotFound, "claude no está")));
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    let abierto = chat.abrir("c-8", "claude", None, "Avi", None).unwrap();
    assert_eq!(abierto["proceso"], "apagado");
    assert_eq!(abierto["motivo"], "sin-claude");
    chat.enviar("c-8", 1, "Hola", &Value::Null).unwrap();
    assert_eq!(r.todos(), vec![json!({ "conversacion": "c-8", "turno": 1, "tipo": "error", "motivo": "sin-claude" })]);
    borrar(&carpeta);
}

#[test]
fn abrir_valida_la_conversacion_y_la_carpeta() {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let lanzador: Lanzador = Arc::new(|_l: &Lanzamiento| Err(std::io::Error::new(std::io::ErrorKind::NotFound, "no")));
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    assert!(chat.abrir("../x", "claude", None, "Avi", None).is_err());
    assert!(chat.abrir("c-9", "claude", Some(carpeta.join("no-existe")), "Avi", None).is_err());
    assert!(chat.abrir("c-9", "claude", None, "Avi", Some(String::from("no-es-uuid"))).is_err());
    // El motor local no lanza nada (entrega 6)
    let local = chat.abrir("c-9", "local", None, "Avi", None).unwrap();
    assert_eq!(local["proceso"], "apagado");
    // Enviar sin abrir
    assert!(chat.enviar("c-otra", 1, "Hola", &Value::Null).is_err());
    borrar(&carpeta);
}

// ---------------------------------------------------------------- con el claude real (a mano)
//
// `cargo test real_ -- --ignored --nocapture`. Gastan unos centavos: usan Haiku por
// `ANTHROPIC_MODEL` (los argumentos de 7.1 no llevan `--model`).

#[cfg(windows)]
fn lanzador_real_haiku() -> Lanzador {
    Arc::new(|l: &Lanzamiento| {
        let mut c = comando_claude(l)?;
        c.env("ANTHROPIC_MODEL", "haiku");
        Ok(c)
    })
}

#[cfg(windows)]
#[test]
#[ignore]
fn real_el_init_lista_solo_read_glob_grep_y_no_oficina() {
    use std::io::{BufRead, Write as _};
    let carpeta = carpeta_temporal();
    let ajustes = escribir_ajustes(&carpeta).unwrap();
    let sesion = Sesion::Nueva(nuevo_uuid());
    let l = Lanzamiento { args: argumentos_chat(&Pedido { ajustes: &ajustes, mascota: "Avi", sesion: &sesion }), cwd: carpeta_trabajo(&carpeta) };
    let mut c = (lanzador_real_haiku())(&l).unwrap();
    c.current_dir(&l.cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
    let mut hijo = c.spawn().unwrap();
    let mut entrada = hijo.stdin.take().unwrap();
    writeln!(entrada, "{}", mensaje_usuario("Respondé solo OK.", None)).unwrap();
    let salida = std::io::BufReader::new(hijo.stdout.take().unwrap());
    let mut init = None;
    for l in salida.lines() {
        let v: Value = match serde_json::from_str(&l.unwrap()) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if es(&v, "system", "init") {
            init = Some(v.clone());
        }
        if v["type"] == "result" {
            break;
        }
    }
    drop(entrada);
    let _ = hijo.wait();
    let init = init.expect("sin init");
    println!("init: tools={} mcp={} plugins={} output_style={} permissionMode={}", init["tools"], init["mcp_servers"], init["plugins"], init["output_style"], init["permissionMode"]);
    assert_eq!(init["tools"], json!(["Glob", "Grep", "Read"]));
    assert_eq!(init["mcp_servers"], json!([]));
    assert!(!init["plugins"].to_string().contains("oficina"));
    assert!(!init["plugins"].to_string().contains("engram"));
    assert_eq!(init["output_style"], "default");
    borrar(&carpeta);
}

#[cfg(windows)]
#[test]
#[ignore]
fn real_texto_en_streaming_frenar_y_el_proceso_sigue_vivo() {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador_real_haiku(), r.emisor(), Tiempos::default());
    chat.abrir("c-real", "claude", None, "Ascua", None).unwrap();
    // Precalentado: el arranque pasa mientras "se escribe"
    std::thread::sleep(Duration::from_secs(3));
    let t0 = Instant::now();
    chat.enviar("c-real", 1, "Contá del 1 al 400, un número por línea, sin nada más.", &json!({ "sesiones": [{ "proyecto": "catalogo", "animo": "trabajando" }] })).unwrap();
    // Frenar con el primer texto
    let limite = Instant::now() + Duration::from_secs(60);
    while !r.tipos().contains(&String::from("texto")) && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(10));
    }
    println!("primer texto a {} ms", t0.elapsed().as_millis());
    chat.frenar("c-real", 1);
    r.esperar_final();
    let tipos = r.tipos();
    println!("turno 1: {tipos:?}");
    assert_eq!(tipos.last().map(String::as_str), Some("frenada"));
    let parcial: String = r.todos().iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    assert!(!parcial.is_empty() && !parcial.contains("400"), "el parcial: {parcial:?}");
    assert!(tipos.iter().filter(|t| *t == "texto").count() >= 1);
    assert!(chat.vivo("c-real"), "frenar deja el proceso vivo");
    // El mismo proceso responde el turno siguiente
    let antes = r.todos().len();
    chat.enviar("c-real", 2, "¿Cómo te llamás? Una palabra.", &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(60);
    while !r.todos()[antes..].iter().any(|v| v["tipo"] == "fin" || v["tipo"] == "error") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    let segundo: Vec<Value> = r.todos()[antes..].to_vec();
    println!("turno 2: {:?}", segundo.iter().map(|v| v["tipo"].clone()).collect::<Vec<_>>());
    let texto: String = segundo.iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    println!("respuesta: {texto}");
    assert_eq!(segundo.last().unwrap()["tipo"], "fin");
    assert!(texto.contains("Ascua"));
    chat.apagar();
    borrar(&carpeta);
}
