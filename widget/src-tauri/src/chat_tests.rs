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
/// Medido en E4: `--resume` con una sesión que Claude Code ya no tiene (sale enseguida, código 1).
const SIN_CONVERSACION: &str = include_str!("fixtures/chat/sin-conversacion.jsonl");
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
    args_con_modelo(sesion, None)
}

fn args_con_modelo(sesion: &Sesion, modelo: Option<&str>) -> Vec<String> {
    argumentos_chat(&Pedido { ajustes: Path::new(r"C:\config\chat\ajustes.json"), mascota: "Ascua", usuario: None, sesion, modelo, mcp: None, sistema: None })
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
        "--permission-prompts", "none", "--restricted", "--strict-mcp-config",
        "--settings", r"C:\config\chat\ajustes.json",
        "--append-system-prompt", &instruccion_chat("Ascua", None),
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
        assert!(a.contains(&String::from("--restricted")));
        // #43 (M-H2): --safe-mode apaga --mcp-config; nunca vuelve
        assert!(!a.contains(&String::from("--safe-mode")));
        assert!(a.contains(&String::from("--strict-mcp-config")));
        assert_eq!(valor(&a, "--settings"), Some(r"C:\config\chat\ajustes.json"));
        assert_eq!(valor(&a, "--max-budget-usd"), Some("2"));
        // "Por defecto" (#35): sin `--model`, el modelo por defecto de Claude Code
        assert!(!a.contains(&String::from("--model")), "por defecto: sin --model");
    }
}

#[test]
fn los_modelos_son_los_cuatro_alias_y_nada_mas() {
    assert_eq!(MODELOS, ["fable", "opus", "sonnet", "haiku"]);
    for m in MODELOS {
        assert!(modelo_valido(m), "{m}");
    }
    for malo in ["", "Sonnet", " sonnet", "sonnet ", "claude-sonnet-4-5", "default", "por-defecto", "opus[1m]", "--model"] {
        assert!(!modelo_valido(malo), "{malo:?}");
    }
}

#[test]
fn con_modelo_va_model_con_el_alias_una_vez_y_el_resto_igual() {
    // #35 (S3): `--model <alias>`, antes del par de la sesión; lo demás de 7.1 no cambia
    for s in [sesion_nueva(), Sesion::Retomar(String::from("7ee41c33-05e9-4265-9ade-a67a92f48f2d"))] {
        let sin = args(&s);
        for m in MODELOS {
            let a = args_con_modelo(&s, Some(m));
            assert_eq!(a.iter().filter(|x| *x == "--model").count(), 1, "{a:?}");
            assert_eq!(valor(&a, "--model"), Some(m));
            let k = a.iter().position(|x| x == "--model").unwrap();
            let par = a.iter().position(|x| x == "--session-id" || x == "--resume").unwrap();
            assert!(k < par, "--model antes de la sesión: {a:?}");
            let mut resto = a.clone();
            resto.drain(k..k + 2);
            assert_eq!(resto, sin);
        }
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
    let i = instruccion_chat("Ascua", None);
    assert!(i.starts_with("Sos Ascua, la mascota de Avis,"));
    assert!(!i.contains("{Mascota}"));
    assert!(i.contains("No modificás archivos ni corrés comandos"));
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
fn la_instruccion_nombra_al_usuario_solo_si_hay_nombre() {
    // #37 S3
    let i = instruccion_chat("Pancho", Some("Nico"));
    assert!(i.starts_with("Sos Pancho, la mascota de Avis,"), "{i}");
    assert!(i.contains("La persona se llama Nico: llamala por su nombre."), "{i}");
    assert!(!i.contains('\n') && !i.contains('\r'));
    assert!(!instruccion_chat("Ascua", None).contains("La persona se llama"));
}

#[test]
fn un_nombre_de_usuario_raro_no_se_usa() {
    assert_eq!(nombre_usuario("  Nico "), Some(String::from("Nico")));
    assert_eq!(nombre_usuario(""), None);
    assert_eq!(nombre_usuario("   "), None);
    assert_eq!(nombre_usuario("a\nb"), None);
    assert_eq!(nombre_usuario(&"x".repeat(41)), None);
}

#[cfg(windows)]
#[test]
fn proceso_falso_el_proceso_nuevo_lleva_el_nombre_del_usuario() {
    let (lanzador, lanzados) = lanzador_que_anota(String::from("ping -n 5 127.0.0.1 >nul"));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_usuario("Nico");
    chat.abrir_con("c-usu", "claude", None, "Pancho", None, None).unwrap();
    let a = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(valor(&a, "--append-system-prompt"), Some(instruccion_chat("Pancho", Some("Nico")).as_str()));
    // Sin nombre (o uno raro), la instrucción de siempre en la próxima charla
    chat.poner_usuario("a\nb");
    chat.abrir_con("c-usu2", "claude", None, "Pancho", None, None).unwrap();
    let b = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(valor(&b, "--append-system-prompt"), Some(instruccion_chat("Pancho", None).as_str()));
    chat.apagar();
    borrar(&carpeta);
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
    // Sin fixture (con --safe-mode y --settings no aparecen, medido en E0): se prueban como desconocidas
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
    let m = mensaje_usuario("¿En qué anda?", Some("sesiones:\n  - x"), &[]);
    assert_eq!(
        m,
        json!({ "type": "user", "message": { "role": "user", "content": [
            { "type": "text", "text": "<avis>\nsesiones:\n  - x\n</avis>" },
            { "type": "text", "text": "¿En qué anda?" }
        ]}})
    );
    let solo = mensaje_usuario("Hola", None, &[]);
    assert_eq!(solo["message"]["content"], json!([{ "type": "text", "text": "Hola" }]));
}

#[test]
fn el_mensaje_con_adjuntos_va_avis_archivos_y_texto() {
    // 7.4: el bloque <avis>, los archivos en el orden en que se adjuntaron y al final lo escrito
    let doc = json!({ "type": "document", "source": { "type": "base64", "media_type": "application/pdf", "data": "JVBE" } });
    let img = json!({ "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBO" } });
    let m = mensaje_usuario("Resumime esto", Some("x"), &[doc.clone(), img.clone()]);
    assert_eq!(m["message"]["content"], json!([{ "type": "text", "text": "<avis>\nx\n</avis>" }, doc, img, { "type": "text", "text": "Resumime esto" }]));
    // Solo un archivo, sin texto: la API no acepta un bloque de texto vacío
    let m = mensaje_usuario("", None, &[doc.clone()]);
    assert_eq!(m["message"]["content"], json!([doc]));
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
    chat.enviar("c-1", 7, "Respondé solo OK.", &[], &Value::Null).unwrap();
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
    chat.enviar("c-2", 1, "Hola", &[], &Value::Null).unwrap();
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
    chat.enviar("c-3", 1, "Hola", &[], &Value::Null).unwrap();
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
    chat.enviar("c-4", 1, "Hola", &[], &Value::Null).unwrap();
    assert!(chat.enviar("c-4", 2, "Otra", &[], &Value::Null).is_err(), "D7: sin cola");
    assert!(chat.enviar("c-4", 3, "   ", &[], &Value::Null).is_err(), "texto vacío");
    chat.apagar();
    assert!(r.tipos().iter().all(|t| t != "texto"));
    borrar(&carpeta);
    borrar(&base);
}

/// 7.3: al salir de Avis con un turno en curso, la interrupción llega por stdin antes de cerrarlo.
#[cfg(windows)]
#[test]
fn proceso_falso_apagar_con_un_turno_en_curso_manda_la_interrupcion() {
    let base = carpeta_temporal();
    let copia = base.join("segunda.json");
    // Lee el mensaje, después la línea siguiente, y la guarda (vacía si stdin se cerró)
    let guion = format!(
        "powershell -NoProfile -Command \"$m=[Console]::In.ReadLine(); $s=[Console]::In.ReadLine(); [IO.File]::WriteAllText('{}', [string]$s)\"",
        copia.display()
    );
    let (chat, _r, carpeta) = chat_falso(guion, Tiempos::default());
    chat.abrir("c-ap", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-ap", 1, "Hola", &[], &Value::Null).unwrap();
    chat.apagar();
    let segunda = fs::read_to_string(&copia).unwrap_or_default();
    let linea: Value = serde_json::from_str(&segunda).unwrap_or(Value::Null);
    assert_eq!(linea, pedido_frenar(1), "la segunda línea es la interrupción: {segunda:?}");
    borrar(&carpeta);
    borrar(&base);
}

/// E5: el archivo viaja en la línea de stdin como su bloque (7.4), y sin texto también se manda.
#[cfg(windows)]
#[test]
fn proceso_falso_un_adjunto_viaja_en_la_linea_y_sin_texto_tambien_se_manda() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    let pdf = crate::adjuntos::pdf_minimo("CEREZO");
    let ruta_pdf = base.join("presupuesto.pdf");
    fs::write(&ruta_pdf, &pdf).unwrap();
    let ruta_md = base.join("notas.md");
    fs::write(&ruta_md, "# Notas").unwrap();
    let copia = base.join("linea.json");
    // PowerShell guarda la línea que llega por stdin y escribe el fixture
    let guion = format!(
        "powershell -NoProfile -Command \"$l=[Console]::In.ReadLine(); [IO.File]::WriteAllText('{}', $l); [Console]::Out.Write([IO.File]::ReadAllText('{}'))\"",
        copia.display(),
        f.display()
    );
    let (chat, r, carpeta) = chat_falso(guion, Tiempos::default());
    chat.abrir("c-adj", "claude", None, "Avi", None).unwrap();
    let rutas = [ruta_pdf.to_string_lossy().into_owned(), ruta_md.to_string_lossy().into_owned()];
    chat.enviar("c-adj", 1, "", &rutas, &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"), "{:?}", r.tipos());
    let linea: Value = serde_json::from_str(&fs::read_to_string(&copia).unwrap()).unwrap();
    let contenido = linea["message"]["content"].as_array().unwrap();
    assert_eq!(contenido.len(), 2, "el PDF y el texto, sin un bloque de texto vacío");
    assert_eq!(contenido[0]["type"], "document");
    assert_eq!(contenido[0]["source"]["data"], crate::adjuntos::base64(&pdf));
    assert_eq!(contenido[1]["text"], "Archivo: notas.md\n```md\n# Notas\n```");
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

/// E5: un adjunto que no entra (un .xlsx, o uno que ya no está) es el error `adjunto` con su nombre,
/// sin escribirle nada al proceso; el turno no queda en curso.
#[cfg(windows)]
#[test]
fn proceso_falso_un_adjunto_que_no_entra_es_error_adjunto_sin_mandar_nada() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    let xlsx = base.join("planilla.xlsx");
    fs::write(&xlsx, b"PK\x03\x04").unwrap();
    let (chat, r, carpeta) = chat_falso(format!("set /p x= & type \"{}\"", f.display()), Tiempos::default());
    chat.abrir("c-xl", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-xl", 1, "¿Qué tiene?", &[xlsx.to_string_lossy().into_owned()], &Value::Null).unwrap();
    assert_eq!(r.todos(), vec![json!({ "conversacion": "c-xl", "turno": 1, "tipo": "error", "motivo": "adjunto", "detalle": "planilla.xlsx" })]);
    // Seis archivos, tampoco
    let md = base.join("n.md");
    fs::write(&md, "x").unwrap();
    chat.enviar("c-xl", 2, "Hola", &vec![md.to_string_lossy().into_owned(); 6], &Value::Null).unwrap();
    assert_eq!(r.todos()[1]["motivo"], "adjunto");
    // Nada quedó en curso: el turno siguiente sale y responde
    chat.enviar("c-xl", 3, "Hola", &[], &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(10);
    while !r.tipos().contains(&String::from("fin")) && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"), "{:?}", r.tipos());
    // Sin texto y sin archivos, nada
    assert!(chat.enviar("c-xl", 4, "  ", &[], &Value::Null).is_err());
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_sin_eco_a_tiempo_es_error_proceso_y_lo_mata() {
    let tiempos = Tiempos { eco: Duration::from_millis(400), ..Tiempos::default() };
    let (chat, r, carpeta) = chat_falso(String::from("set /p x= & ping -n 30 127.0.0.1 >nul"), tiempos);
    chat.abrir("c-5", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-5", 1, "Hola", &[], &Value::Null).unwrap();
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
    chat.enviar("c-6", 1, "Hola", &[], &Value::Null).unwrap();
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
    chat.enviar("c-7", 1, "Hola", &[], &Value::Null).unwrap();
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
    chat.enviar("c-8", 1, "Hola", &[], &Value::Null).unwrap();
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
    // El motor local no lanza nada al abrir (no hay nada que precalentar: el motor arranca al mandar, 8)
    let local = chat.abrir("c-9", "local", None, "Avi", None).unwrap();
    assert_eq!(local["proceso"], "apagado");
    // Enviar sin abrir
    assert!(chat.enviar("c-otra", 1, "Hola", &[], &Value::Null).is_err());
    borrar(&carpeta);
}

#[test]
fn una_charla_del_motor_local_nunca_lanza_claude() {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let lanzados = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let cuenta = lanzados.clone();
    let lanzador: Lanzador = Arc::new(move |_l: &Lanzamiento| {
        cuenta.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        Err(std::io::Error::new(std::io::ErrorKind::NotFound, "no"))
    });
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.abrir("c-local", "local", None, "Avi", None).unwrap();
    // Mandar con el motor local no puede terminar en la nube (regla 3): sin el modelo de esta PC
    // (este chat no tiene motor local), el error `local` y nada lanzado
    chat.enviar("c-local", 1, "¿Quién me espera?", &[], &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.todos(), vec![json!({ "conversacion": "c-local", "turno": 1, "tipo": "error", "motivo": "local", "detalle": "no está el modelo de esta PC" })]);
    assert_eq!(lanzados.load(std::sync::atomic::Ordering::SeqCst), 0);
    // Una charla vacía puede pasar a Claude Code (D8: solo cambia la cabecera) y entonces sí lanza
    chat.abrir("c-vacia", "local", None, "Avi", None).unwrap();
    chat.abrir("c-vacia", "claude", None, "Avi", None).unwrap();
    assert_eq!(lanzados.load(std::sync::atomic::Ordering::SeqCst), 1);
    // Y una de Claude Code vacía puede volver a local: deja de lanzar
    chat.abrir("c-vacia", "local", None, "Avi", None).unwrap();
    chat.enviar("c-vacia", 2, "Hola", &[], &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(5);
    while r.todos().len() < 2 && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(10));
    }
    assert_eq!(r.todos()[1]["motivo"], "local");
    assert_eq!(lanzados.load(std::sync::atomic::Ordering::SeqCst), 1);
    borrar(&carpeta);
}

// ---------------------------------------------------------------- el modelo de la charla (#35)

/// Un lanzador `cmd.exe` que anota los argumentos de cada lanzamiento.
#[cfg(windows)]
fn lanzador_que_anota(guion: String) -> (Lanzador, Arc<Mutex<Vec<Vec<String>>>>) {
    let lanzados: Arc<Mutex<Vec<Vec<String>>>> = Arc::default();
    let anotar = lanzados.clone();
    let interno = lanzador_cmd(guion);
    let lanzador: Lanzador = Arc::new(move |l: &Lanzamiento| {
        anotar.lock().unwrap().push(l.args.clone());
        interno(l)
    });
    (lanzador, lanzados)
}

#[cfg(windows)]
#[test]
fn proceso_falso_cambiar_el_modelo_de_una_charla_usada_sigue_la_misma_sesion() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Responde un turno y queda vivo, con stdin abierto
    let (lanzador, lanzados) = lanzador_que_anota(format!("set /p x= & type \"{}\" & ping -n 30 127.0.0.1 >nul", f.display()));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    let cuantos = || lanzados.lock().unwrap().len();
    let ultimo = || lanzados.lock().unwrap().last().unwrap().clone();
    let abierto = chat.abrir_con("c-mod", "claude", None, "Avi", None, Some(String::from("haiku"))).unwrap();
    let sesion = abierto["sesion"].as_str().unwrap().to_string();
    assert_eq!(valor(&ultimo(), "--model"), Some("haiku"));
    assert_eq!(valor(&ultimo(), "--session-id"), Some(sesion.as_str()));
    chat.enviar("c-mod", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"));
    // El mismo modelo: el mismo proceso
    let mismo = chat.abrir_con("c-mod", "claude", None, "Avi", None, Some(String::from("haiku"))).unwrap();
    assert_eq!(mismo["proceso"], "listo");
    assert_eq!(cuantos(), 1);
    // Otro modelo en una charla con mensajes (S1): sin error, la misma conversación con `--resume`
    let otro = chat.abrir_con("c-mod", "claude", None, "Avi", None, Some(String::from("sonnet"))).unwrap();
    assert_eq!(otro["sesion"], json!(sesion));
    assert_eq!(cuantos(), 2);
    let a = ultimo();
    assert_eq!(valor(&a, "--resume"), Some(sesion.as_str()));
    assert_eq!(valor(&a, "--model"), Some("sonnet"));
    assert!(!a.contains(&String::from("--session-id")));
    // Volver a "Por defecto": sin `--model`, la misma sesión
    chat.abrir_con("c-mod", "claude", None, "Avi", None, None).unwrap();
    assert_eq!(cuantos(), 3);
    let a = ultimo();
    assert_eq!(valor(&a, "--resume"), Some(sesion.as_str()));
    assert!(!a.contains(&String::from("--model")));
    // La carpeta y el motor de una charla con mensajes siguen sin cambiar (D8)
    assert!(chat.abrir_con("c-mod", "local", None, "Avi", None, None).is_err());
    assert!(chat.abrir_con("c-mod", "claude", Some(base.clone()), "Avi", None, None).is_err());
    // Un modelo desconocido no se acepta
    assert_eq!(chat.abrir_con("c-mod", "claude", None, "Avi", None, Some(String::from("gpt"))), Err(String::from("modelo desconocido")));
    assert_eq!(chat.abrir_con("c-otra", "claude", None, "Avi", None, Some(String::from("Sonnet"))), Err(String::from("modelo desconocido")));
    assert_eq!(cuantos(), 3);
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_cambiar_el_modelo_con_un_turno_en_curso_espera_al_proximo_envio() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Tarda ~2 s en responder: el turno sigue en curso cuando cambia el modelo
    let (lanzador, lanzados) = lanzador_que_anota(format!("set /p x= & ping -n 3 127.0.0.1 >nul & type \"{}\" & ping -n 30 127.0.0.1 >nul", f.display()));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    let abierto = chat.abrir_con("c-curso", "claude", None, "Avi", None, Some(String::from("haiku"))).unwrap();
    let sesion = abierto["sesion"].as_str().unwrap().to_string();
    chat.enviar("c-curso", 1, "Hola", &[], &Value::Null).unwrap();
    // El turno no se corta ni se lanza otro proceso sobre la misma sesión
    chat.abrir_con("c-curso", "claude", None, "Avi", None, Some(String::from("sonnet"))).unwrap();
    assert_eq!(lanzados.lock().unwrap().len(), 1);
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"));
    // El envío siguiente sale con el modelo nuevo, en la misma sesión
    chat.enviar("c-curso", 2, "Otra", &[], &Value::Null).unwrap();
    let l = lanzados.lock().unwrap().clone();
    assert_eq!(l.len(), 2);
    assert_eq!(valor(&l[1], "--model"), Some("sonnet"));
    assert_eq!(valor(&l[1], "--resume"), Some(sesion.as_str()));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

// ---------------------------------------------------------------- 7. una sesión que Claude Code ya no tiene (E4)

#[test]
fn sesion_perdida_solo_con_el_result_de_sin_conversacion() {
    assert!(sesion_perdida(&linea(SIN_CONVERSACION, |v| v["type"] == "result")));
    for f in TODOS {
        assert!(lineas(f).iter().all(|v| !sesion_perdida(v)));
    }
    // Sigue siendo un error del turno, con el texto de siempre
    assert!(matches!(evento_de_linea(&linea(SIN_CONVERSACION, |v| v["type"] == "result")), Some(EventoChat::Error { motivo: "otro", .. })));
}

#[cfg(windows)]
#[test]
fn proceso_falso_retomar_una_sesion_perdida_empieza_una_nueva() {
    let base = carpeta_temporal();
    let f = fixture_en_archivo(&base, SIN_CONVERSACION, None);
    let lanzados: Arc<Mutex<Vec<Vec<String>>>> = Arc::default();
    let anotar = lanzados.clone();
    let interno = lanzador_cmd(format!("set /p x= & type \"{}\"", f.display()));
    let lanzador: Lanzador = Arc::new(move |l: &Lanzamiento| {
        anotar.lock().unwrap().push(l.args.clone());
        interno(l)
    });
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    let vieja = "11111111-2222-4333-8444-555555555555";
    chat.abrir("c-9", "claude", None, "Avi", Some(String::from(vieja))).unwrap();
    chat.enviar("c-9", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.todos().last().unwrap()["motivo"], "otro");
    let primero = lanzados.lock().unwrap()[0].clone();
    assert!(primero.windows(2).any(|w| w[0] == "--resume" && w[1] == vieja));
    // Reintentar: otra sesión, nueva, nunca la perdida
    let limite = Instant::now() + Duration::from_secs(10);
    while chat.vivo("c-9") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(50));
    }
    chat.enviar("c-9", 2, "Hola", &[], &Value::Null).unwrap();
    let ultimo = lanzados.lock().unwrap().last().unwrap().clone();
    assert!(!ultimo.contains(&String::from("--resume")), "{ultimo:?}");
    let k = ultimo.iter().position(|a| a == "--session-id").expect("sin --session-id");
    assert_ne!(ultimo[k + 1], vieja);
    assert!(sesion_valida(&ultimo[k + 1]));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

// ---------------------------------------------------------------- con el claude real (a mano)
//
// `cargo test real_ -- --ignored --nocapture`. Gastan unos centavos: usan Haiku por
// `ANTHROPIC_MODEL` (sin modelo elegido, los argumentos de 7.1 no llevan `--model`), salvo el de
// #35, que lo elige con `--model`.

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
    let l = Lanzamiento { args: argumentos_chat(&Pedido { ajustes: &ajustes, mascota: "Avi", usuario: None, sesion: &sesion, modelo: None, mcp: None, sistema: None }), cwd: carpeta_trabajo(&carpeta) };
    let mut c = (lanzador_real_haiku())(&l).unwrap();
    c.current_dir(&l.cwd).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
    let mut hijo = c.spawn().unwrap();
    let mut entrada = hijo.stdin.take().unwrap();
    writeln!(entrada, "{}", mensaje_usuario("Respondé solo OK.", None, &[])).unwrap();
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
    chat.enviar("c-real", 1, "Contá del 1 al 400, un número por línea, sin nada más.", &[], &json!({ "sesiones": [{ "proyecto": "catalogo", "animo": "trabajando" }] })).unwrap();
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
    chat.enviar("c-real", 2, "¿Cómo te llamás? Una palabra.", &[], &Value::Null).unwrap();
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

/// E5: Claude lee un PDF adjunto por la misma vía que la ventana (`chat_enviar` con su ruta), y un
/// texto adjunto sin nada escrito (lo pide #22).
#[cfg(windows)]
#[test]
#[ignore]
fn real_un_pdf_adjunto_se_lee() {
    let carpeta = carpeta_temporal();
    let ruta = carpeta.join("palabra.pdf");
    fs::write(&ruta, crate::adjuntos::pdf_minimo("CEREZO")).unwrap();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador_real_haiku(), r.emisor(), Tiempos::default());
    chat.abrir("c-pdf", "claude", None, "Avi", None).unwrap();
    let t0 = Instant::now();
    chat.enviar("c-pdf", 1, "¿Qué palabra dice el PDF? Respondé solo la palabra.", &[ruta.to_string_lossy().into_owned()], &Value::Null).unwrap();
    let hasta_fin = |r: &Recibidos, desde: usize| {
        let limite = Instant::now() + Duration::from_secs(90);
        while !r.todos()[desde..].iter().any(|v| ["fin", "error", "frenada"].contains(&v["tipo"].as_str().unwrap_or(""))) && Instant::now() < limite {
            std::thread::sleep(Duration::from_millis(20));
        }
    };
    hasta_fin(&r, 0);
    let texto: String = r.todos().iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    println!("PDF: {texto:?} en {} ms; eventos {:?}", t0.elapsed().as_millis(), r.tipos());
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"));
    assert!(texto.to_uppercase().contains("CEREZO"));
    // Un .md sin texto escrito: llega como "Archivo: …" en una cerca
    let md = carpeta.join("clave.md");
    fs::write(&md, "La clave del depósito es ALMENDRO.").unwrap();
    let antes = r.todos().len();
    chat.enviar("c-pdf", 2, "", &[md.to_string_lossy().into_owned()], &Value::Null).unwrap();
    hasta_fin(&r, antes);
    let texto: String = r.todos()[antes..].iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    println!("texto: {texto:?}; eventos {:?}", r.todos()[antes..].iter().map(|v| v["tipo"].clone()).collect::<Vec<_>>());
    assert_eq!(r.todos().last().unwrap()["tipo"], "fin");
    assert!(texto.to_uppercase().contains("ALMENDRO"));
    chat.apagar();
    borrar(&carpeta);
}

/// E4: el historial sobrevive a cerrar Avis y la charla retomada con `--resume` recuerda lo hablado.
/// Dos `Chat` distintos (como dos arranques de Avis) y el archivo de `historial.rs` en el medio.
#[cfg(windows)]
#[test]
#[ignore]
fn real_retomar_despues_de_cerrar_avis_recuerda_lo_hablado() {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador_real_haiku(), r.emisor(), Tiempos::default());
    chat.abrir("c-recuerda", "claude", None, "Avi", None).unwrap();
    chat.enviar("c-recuerda", 1, "Mi color favorito es el turquesa. Respondé solo: anotado.", &[], &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"), "{:?}", r.tipos());
    let sesion = r.todos().iter().find(|v| v["tipo"] == "listo").and_then(|v| v["sesion"].as_str().map(String::from)).expect("sin init");
    // Lo que guarda la ventana (9.1), con la sesión ya usada
    let doc = json!({
        "v": 1, "id": "c-recuerda", "titulo": "Mi color favorito", "creada": "2026-11-24T12:00:00.000Z", "actualizada": "2026-11-24T12:00:05.000Z",
        "motor": "claude", "carpeta": null, "sesionClaude": sesion,
        "mensajes": [
            { "rol": "usuario", "texto": "Mi color favorito es el turquesa.", "cuando": "2026-11-24T12:00:00.000Z", "estado": "ok", "adjuntos": [] },
            { "rol": "mascota", "texto": "anotado", "cuando": "2026-11-24T12:00:05.000Z", "estado": "ok", "herramientas": [], "ms": 1000 },
        ],
    });
    crate::historial::guardar(&carpeta, &doc).unwrap();
    chat.apagar();
    drop(chat);
    // "Avis se abre de nuevo": otro Chat, que solo sabe lo que hay en el archivo
    let leido = crate::historial::leer(&carpeta, "c-recuerda").unwrap();
    let r2 = Recibidos::default();
    let chat2 = Chat::nuevo(carpeta.clone(), lanzador_real_haiku(), r2.emisor(), Tiempos::default());
    let abierto = chat2.abrir("c-recuerda", "claude", None, "Avi", leido["sesionClaude"].as_str().map(String::from)).unwrap();
    assert_eq!(abierto["sesion"], json!(sesion));
    chat2.enviar("c-recuerda", 1, "¿Cuál es mi color favorito? Una palabra.", &[], &Value::Null).unwrap();
    r2.esperar_final();
    let texto: String = r2.todos().iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    println!("sesión {sesion}; retomada responde: {texto:?}; eventos {:?}", r2.tipos());
    assert_eq!(r2.tipos().last().map(String::as_str), Some("fin"));
    assert!(texto.to_lowercase().contains("turquesa"));
    let listo2 = r2.todos().iter().find(|v| v["tipo"] == "listo").and_then(|v| v["sesion"].as_str().map(String::from));
    assert_eq!(listo2.as_deref(), Some(sesion.as_str()), "retomar sigue en la misma sesión");
    chat2.apagar();
    borrar(&carpeta);
}

/// #35 (S1): cambiar el modelo a mitad de una charla sigue la misma conversación con el modelo nuevo
/// (`--resume` con otro `--model`). Qué modelo respondió cada turno sale de la transcripción de
/// Claude Code (el `init` no viaja a la ventana).
#[cfg(windows)]
#[test]
#[ignore]
fn real_cambiar_de_haiku_a_sonnet_sigue_la_misma_sesion() {
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), Arc::new(comando_claude), r.emisor(), Tiempos::default());
    chat.abrir_con("c-modelo", "claude", None, "Avi", None, Some(String::from("haiku"))).unwrap();
    chat.enviar("c-modelo", 1, "Respondé solo OK.", &[], &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(r.tipos().last().map(String::as_str), Some("fin"), "{:?}", r.tipos());
    let sesion = r.todos().iter().find(|v| v["tipo"] == "listo").and_then(|v| v["sesion"].as_str().map(String::from)).expect("sin init");
    let antes = r.todos().len();
    let abierto = chat.abrir_con("c-modelo", "claude", None, "Avi", None, Some(String::from("sonnet"))).unwrap();
    assert_eq!(abierto["sesion"], json!(sesion));
    chat.enviar("c-modelo", 2, "Respondé solo OK otra vez.", &[], &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(90);
    while !r.todos()[antes..].iter().any(|v| ["fin", "error", "frenada"].contains(&v["tipo"].as_str().unwrap_or(""))) && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    let segundo: Vec<Value> = r.todos()[antes..].to_vec();
    println!("turno 2: {:?}", segundo.iter().map(|v| v["tipo"].clone()).collect::<Vec<_>>());
    assert_eq!(segundo.last().unwrap()["tipo"], "fin");
    let listo2 = segundo.iter().find(|v| v["tipo"] == "listo").and_then(|v| v["sesion"].as_str().map(String::from));
    assert_eq!(listo2.as_deref(), Some(sesion.as_str()), "el cambio de modelo sigue en la misma sesión");
    chat.apagar();
    let claude = crate::transcripcion::carpeta_claude().expect("sin ~/.claude");
    let ruta = crate::transcripcion::ruta_transcripcion(&claude, &sesion).expect("sin transcripción");
    let mut modelos: Vec<String> = fs::read_to_string(ruta)
        .unwrap()
        .lines()
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .filter(|v| v["type"] == "assistant")
        .filter_map(|v| v["message"]["model"].as_str().map(String::from))
        .collect();
    modelos.dedup();
    println!("sesión {sesion}; modelos: {modelos:?}");
    assert!(modelos.first().is_some_and(|m| m.contains("haiku")), "{modelos:?}");
    assert!(modelos.last().is_some_and(|m| m.contains("sonnet")), "{modelos:?}");
    borrar(&carpeta);
}

// ---------------------------------------------------------------- #43: herramientas de Avis (chat-herramientas-ux.md 11.2, 11.3, 11.7, 16)

const MCP_DOS: &str = include_str!("fixtures/chat/mcp-dos-herramientas.jsonl");
const MCP_DENEGADA: &str = include_str!("fixtures/chat/mcp-denegada.jsonl");

fn mcp_prueba() -> Mcp {
    Mcp { puerto: 51234, token: String::from("ab").repeat(32) }
}

fn args_con_mcp(sesion: &Sesion) -> Vec<String> {
    let m = mcp_prueba();
    argumentos_chat(&Pedido { ajustes: Path::new(r"C:\config\chat\ajustes.json"), mascota: "Ascua", usuario: None, sesion, modelo: None, mcp: Some(&m), sistema: None })
}

#[test]
fn argumentos_exactos_de_11_2_con_el_servidor_de_avis() {
    let a = args_con_mcp(&sesion_nueva());
    let config = format!(r#"{{"mcpServers":{{"avis":{{"type":"http","url":"http://127.0.0.1:51234/mcp","headers":{{"Authorization":"Bearer {}"}}}}}}}}"#, "ab".repeat(32));
    let esperado: Vec<String> = [
        "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--include-partial-messages", "--replay-user-messages",
        "--permission-mode", "manual",
        "--tools", "Read,Glob,Grep",
        "--allowedTools", "Read,Glob,Grep,mcp__avis__tareas_ver,mcp__avis__tarea_crear,mcp__avis__tarea_editar,mcp__avis__tarea_tildar,mcp__avis__tarea_mostrar,mcp__avis__habitos_ver,mcp__avis__habito_marcar",
        "--permission-prompts", "none", "--restricted", "--strict-mcp-config",
        "--mcp-config", &config,
        "--settings", r"C:\config\chat\ajustes.json",
        "--append-system-prompt", &instruccion_chat("Ascua", None),
        "--max-budget-usd", "2",
        "--session-id", "8c9494fd-dbea-492d-a475-8660c720f9d9",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    assert_eq!(a, esperado);
    // El JSON de --mcp-config es JSON de verdad, con 127.0.0.1 (nunca localhost ni 0.0.0.0)
    let v: Value = serde_json::from_str(&config).unwrap();
    assert_eq!(v["mcpServers"].as_object().unwrap().len(), 1);
    assert!(!a.iter().any(|x| x.contains("localhost") || x.contains("0.0.0.0")));
    // Sin comodín (D-c5) ni herramientas de borrar
    assert!(!a.iter().any(|x| x.contains('*') || x.contains("tarea_borrar")));
}

#[test]
fn sin_servidor_los_argumentos_son_los_de_antes() {
    // Lo de antes (11.2): sin el servidor de Avis, ni --mcp-config ni nombres de herramientas de Avis
    let a = args(&sesion_nueva());
    assert_eq!(valor(&a, "--allowedTools"), Some("Read,Glob,Grep"));
    assert!(!a.contains(&String::from("--mcp-config")));
}

#[test]
fn con_el_servidor_siguen_las_barreras_de_seguridad() {
    for s in [sesion_nueva(), Sesion::Retomar(String::from("7ee41c33-05e9-4265-9ade-a67a92f48f2d"))] {
        let a = args_con_mcp(&s);
        assert_eq!(valor(&a, "--permission-mode"), Some("manual"));
        assert_eq!(valor(&a, "--tools"), Some("Read,Glob,Grep"));
        for bandera in ["--restricted", "--strict-mcp-config", "--mcp-config"] {
            assert_eq!(a.iter().filter(|x| *x == bandera).count(), 1, "{bandera}");
        }
        for prohibido in ["bypassPermissions", "skip-permissions", "Bash", "Write", "Edit", "WebFetch"] {
            assert!(a.iter().all(|x| !x.contains(prohibido)), "aparece {prohibido}");
        }
    }
}

#[test]
fn la_instruccion_de_11_3_es_una_sola_linea() {
    assert_eq!(
        INSTRUCCION_CHAT,
        "Sos {Mascota}, la mascota de Avis, el panel que muestra en qué anda Claude Code. Respondés en español rioplatense, de vos, breve y concreto. No modificás archivos ni corrés comandos (no tenés esas herramientas). Sí podés ver, anotar, editar y tildar las tareas de Avis y ver y marcar los hábitos de hoy con tus herramientas de Avis: usalas solo cuando el usuario lo pida y después confirmá en una frase corta qué hiciste, sin repetir los detalles (Avis muestra cada cambio con «Deshacer»). Nunca borrás: si te piden borrar una tarea, usá tarea_mostrar con para \"borrar\" y decí que el borrado lo hace el usuario con un clic. Para saber qué día es hoy, usá tareas_ver. Si te piden algo que requiere actuar fuera de eso, explicá qué haría falta. Cuando el mensaje traiga un bloque `<avis>`, son los datos en vivo de las sesiones: usalos para responder sobre ellas. Usá Markdown simple (títulos, listas, código). Podés leer los archivos de la carpeta de trabajo con Read, Glob y Grep cuando la pregunta lo pida."
    );
    assert!(!INSTRUCCION_CHAT.contains('\n') && !INSTRUCCION_CHAT.contains('\r'));
}

#[test]
fn la_instruccion_local_dice_que_no_toca_tareas() {
    let i = crate::chat_local::INSTRUCCION_CHAT_LOCAL;
    assert!(i.contains(" No podés tocar tareas ni hábitos: si te lo piden, decí que con el modelo local todavía no y que lo puede hacer en una charla con Claude Code."));
    // L9 de Proyectos (#44, decisión de Quintana del 25/11): las instrucciones del proyecto mandan en idioma y estilo
    assert!(i.ends_with(" Si el bloque <proyecto> pide otro idioma o estilo, seguilo antes que lo de arriba."));
    assert!(!i.contains('\n'));
    // Lo de antes sigue igual
    assert!(i.starts_with("Sos {Mascota}, la mascota de Avis,"));
    assert!(i.contains("Usá Markdown simple (títulos, listas, código)."));
}

#[test]
fn las_herramientas_de_avis_llegan_con_su_nombre_completo() {
    // M-H8: dos tool_use del mismo mensaje en dos líneas assistant
    let herramientas: Vec<String> = lineas(MCP_DOS)
        .iter()
        .flat_map(eventos_de_linea)
        .filter_map(|e| match e {
            EventoChat::Herramienta { nombre, .. } => Some(nombre),
            _ => None,
        })
        .collect();
    assert_eq!(herramientas, ["mcp__avis__tarea_crear", "mcp__avis__tarea_crear"]);
    // La denegada (M-H4) también sale: la ventana no la muestra (`textoHerramientas`)
    assert!(lineas(MCP_DENEGADA).iter().flat_map(eventos_de_linea).any(|e| matches!(&e, EventoChat::Herramienta { nombre, .. } if nombre == "mcp__avis__tarea_tildar")));
}

#[test]
fn todos_los_tool_use_de_un_mensaje_son_eventos() {
    // 16: `evento_de_linea` tomaba solo el primero
    let v = json!({ "type": "assistant", "message": { "id": "msg_1", "content": [
        { "type": "text", "text": "Voy" },
        { "type": "tool_use", "id": "toolu_1", "name": "Read", "input": { "file_path": "C:\\x\\README.md" } },
        { "type": "tool_use", "id": "toolu_2", "name": "mcp__avis__tarea_crear", "input": { "titulo": "Pan" } },
    ] } });
    assert_eq!(
        eventos_de_linea(&v),
        vec![
            EventoChat::Herramienta { nombre: String::from("Read"), detalle: String::from("README.md") },
            EventoChat::Herramienta { nombre: String::from("mcp__avis__tarea_crear"), detalle: String::new() },
        ]
    );
    // Lo de antes: en cada línea medida, el primero es el de siempre y solo un assistant da más de uno
    for f in TODOS {
        for v in lineas(f) {
            let todos = eventos_de_linea(&v);
            assert_eq!(todos.first(), evento_de_linea(&v).as_ref());
            assert!(todos.len() <= 1 || v["type"] == "assistant");
        }
    }
}

#[test]
fn el_mensaje_lleva_los_deshechos_antes_del_texto() {
    let deshechos = [String::from("Deshecho: anotada «Pan»."), String::from("Deshecho: tildada «Yerba».")];
    let m = mensaje_usuario_con("Hola", Some("datos"), &deshechos, &[]);
    let c = m["message"]["content"].as_array().unwrap();
    assert_eq!(c.len(), 3);
    assert_eq!(c[0]["text"], "<avis>\ndatos\n</avis>");
    assert_eq!(c[1]["text"], "<avis-deshecho>Deshecho: anotada «Pan».</avis-deshecho>\n<avis-deshecho>Deshecho: tildada «Yerba».</avis-deshecho>");
    assert_eq!(c[2]["text"], "Hola");
    // Sin deshechos, lo de antes
    assert_eq!(mensaje_usuario_con("Hola", None, &[], &[]), mensaje_usuario("Hola", None, &[]));
}

/// El `--mcp-config` de unos argumentos: `(puerto, token)`.
fn mcp_de(a: &[String]) -> (u16, String) {
    let v: Value = serde_json::from_str(valor(a, "--mcp-config").expect("sin --mcp-config")).unwrap();
    let s = &v["mcpServers"]["avis"];
    let puerto = s["url"].as_str().unwrap().trim_start_matches("http://127.0.0.1:").trim_end_matches("/mcp").parse().unwrap();
    (puerto, s["headers"]["Authorization"].as_str().unwrap().trim_start_matches("Bearer ").to_string())
}

/// Un pedido HTTP crudo al servidor de la charla: la respuesta entera.
fn http_crudo(puerto: u16, token: &str, cuerpo: &str) -> String {
    let mut s = std::net::TcpStream::connect(("127.0.0.1", puerto)).unwrap();
    let pedido = format!(
        "POST /mcp HTTP/1.1\r\nHost: 127.0.0.1:{puerto}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{cuerpo}",
        cuerpo.len()
    );
    std::io::Write::write_all(&mut s, pedido.as_bytes()).unwrap();
    let mut r = String::new();
    std::io::Read::read_to_string(&mut s, &mut r).unwrap();
    r
}

/// Un `tools/call` de `tarea_crear`: la respuesta JSON-RPC.
fn crear_por_http(puerto: u16, token: &str, titulo: &str) -> Value {
    let cuerpo = json!({ "jsonrpc": "2.0", "id": 9, "method": "tools/call", "params": { "name": "tarea_crear", "arguments": { "titulo": titulo } } }).to_string();
    let r = http_crudo(puerto, token, &cuerpo);
    serde_json::from_str(r.split("\r\n\r\n").nth(1).unwrap()).unwrap()
}

#[cfg(windows)]
fn lista_casa(tareas: &Path) {
    crate::tareas::guardar(tareas, &json!({ "v": 1, "id": "l-casa", "nombre": "Casa", "orden": 0, "tareas": [] })).unwrap();
}

#[cfg(windows)]
#[test]
fn proceso_falso_el_servidor_cambia_solo_durante_el_turno_y_el_token_muere_con_el_proceso() {
    let base = carpeta_temporal();
    let tareas = carpeta_temporal();
    lista_casa(&tareas);
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Tarda ~2 s en responder: el turno está en curso mientras se llama al servidor
    let (lanzador, lanzados) = lanzador_que_anota(format!("set /p x= & ping -n 3 127.0.0.1 >nul & type \"{}\"", f.display()));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    let avisos = Recibidos::default();
    chat.poner_herramientas(mcp_avis::Carpetas { tareas: tareas.clone(), habitos: tareas.join("habitos") }, avisos.emisor(), Recibidos::default().emisor());
    chat.abrir("c-her", "claude", None, "Avi", None).unwrap();
    let (puerto, token) = mcp_de(&lanzados.lock().unwrap()[0]);
    // Antes del primer mensaje: nada
    let antes = crear_por_http(puerto, &token, "Antes");
    assert_eq!(antes["result"]["isError"], true);
    assert_eq!(antes["result"]["content"][0]["text"], "No hay un mensaje en curso.");
    chat.enviar("c-her", 3, "Anotame pan", &[], &Value::Null).unwrap();
    let durante = crear_por_http(puerto, &token, "Pan");
    assert_eq!(durante["result"]["isError"], false, "{durante}");
    r.esperar_final();
    // El cambio llegó a la ventana con su conversación y su turno, y la lista avisó
    let cambio = r.todos().into_iter().find(|v| v["tipo"] == "cambio").expect("sin cambio");
    assert_eq!(cambio["conversacion"], "c-her");
    assert_eq!(cambio["turno"], 3);
    assert_eq!(cambio["cambio"]["estado"], "hecho");
    assert_eq!(avisos.todos(), vec![json!({ "lista": "l-casa", "tarea": cambio["cambio"]["tarea"], "origen": "chat" })]);
    // Después del fin: nada
    let despues = crear_por_http(puerto, &token, "Después");
    assert_eq!(despues["result"]["content"][0]["text"], "No hay un mensaje en curso.");
    let titulos: Vec<Value> = crate::tareas::listar(&tareas).listas[0]["tareas"].as_array().unwrap().iter().map(|t| t["titulo"].clone()).collect();
    assert_eq!(titulos, [json!("Pan")]);
    // El proceso sale: su token ya no sirve
    chat.cerrar("c-her");
    let limite = Instant::now() + Duration::from_secs(10);
    while chat.vivo("c-her") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(50));
    }
    std::thread::sleep(Duration::from_millis(500));
    let texto = http_crudo(puerto, &token, "{}");
    assert!(texto.starts_with("HTTP/1.1 401"), "{texto}");
    chat.apagar();
    borrar(&carpeta);
    borrar(&tareas);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_frenar_corta_los_cambios_del_turno() {
    let base = carpeta_temporal();
    let tareas = carpeta_temporal();
    lista_casa(&tareas);
    let f = fixture_en_archivo(&base, TEXTO, None);
    let (lanzador, lanzados) = lanzador_que_anota(format!("set /p x= & ping -n 3 127.0.0.1 >nul & type \"{}\"", f.display()));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_herramientas(mcp_avis::Carpetas { tareas: tareas.clone(), habitos: tareas.join("habitos") }, Recibidos::default().emisor(), Recibidos::default().emisor());
    chat.abrir("c-fre", "claude", None, "Avi", None).unwrap();
    let (puerto, token) = mcp_de(&lanzados.lock().unwrap()[0]);
    chat.enviar("c-fre", 1, "Anotame pan", &[], &Value::Null).unwrap();
    chat.frenar("c-fre", 1);
    let r2 = crear_por_http(puerto, &token, "Pan");
    assert_eq!(r2["result"]["content"][0]["text"], "No hay un mensaje en curso.");
    assert!(crate::tareas::listar(&tareas).listas[0]["tareas"].as_array().unwrap().is_empty());
    chat.apagar();
    borrar(&carpeta);
    borrar(&tareas);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_un_deshecho_viaja_una_vez_con_el_proximo_mensaje() {
    let base = carpeta_temporal();
    let eco = base.join("eco.txt");
    let f = fixture_en_archivo(&base, TEXTO, None);
    // El proceso anota cada línea que recibe (`set` la escribe sin interpretar < ni >)
    let guion = format!(
        "set /p lineaavis= & set lineaavis> \"{eco}\" & type \"{f}\" & set /p lineaavis= & set lineaavis>> \"{eco}\" & type \"{f}\"",
        eco = eco.display(),
        f = f.display()
    );
    let (chat, r, carpeta) = chat_falso(guion, Tiempos::default());
    chat.abrir("c-des", "claude", None, "Avi", None).unwrap();
    chat.anotar_deshecho("c-des", "Deshecho: anotada «Pan».");
    chat.enviar("c-des", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    chat.enviar("c-des", 2, "Chau", &[], &Value::Null).unwrap();
    let limite = Instant::now() + Duration::from_secs(10);
    while r.tipos().iter().filter(|t| *t == "fin").count() < 2 && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    let lineas_eco: Vec<String> = String::from_utf8_lossy(&fs::read(&eco).unwrap_or_default()).lines().map(String::from).collect();
    assert_eq!(lineas_eco.len(), 2, "{lineas_eco:?} {:?} {:?}", r.tipos(), fs::read_dir(&base).unwrap().map(|e| e.unwrap().file_name()).collect::<Vec<_>>());
    assert!(lineas_eco[0].contains("<avis-deshecho>Deshecho: anotada"), "{}", lineas_eco[0]);
    assert!(!lineas_eco[1].contains("avis-deshecho"), "{}", lineas_eco[1]);
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

// ---------------------------------------------------------------- proyectos (#44, P2: proyectos-ux.md 11.4, 11.5 y 11.6 tests 12 y 13)
// Viven acá (y no en historial_tests.rs, chat_local_tests.rs o proyectos_tests.rs) porque los tres
// cambian juntos con la charla del proyecto: el contrato de `chat_abrir`, el historial y el borrado.

/// Medido en E0 de P2 (25/11, Claude Code 2.1.332, Haiku): `--resume` desde otra carpeta encuentra la
/// sesión y sigue (M-P3); Glob y Read miran la carpeta nueva.
const RETOMA_OTRA_CARPETA: &str = include_str!("fixtures/chat/proyecto-retoma-otra-carpeta.jsonl");
/// Medido en E0 de P2: `--append-system-prompt-file` junto con `--append-system-prompt` (M-P1), con un
/// archivo de 48 líneas y 4051 caracteres con tildes: el `init` limpio y la respuesta usa el archivo.
const SISTEMA_ARCHIVO: &str = include_str!("fixtures/chat/proyecto-sistema-archivo.jsonl");

/// Un proyecto en `<carpeta>/<id>.json` (formato v1 de proyectos-ux.md 11.1).
fn proyecto_en(carpeta: &Path, id: &str, nombre: &str, instrucciones: &str, ruta: Option<&Path>) {
    fs::create_dir_all(carpeta).unwrap();
    let c = ruta.map(|r| json!({ "tipo": "pc", "ruta": r.to_string_lossy() })).unwrap_or(Value::Null);
    let doc = json!({ "v": 1, "id": id, "nombre": nombre, "color": "violeta", "orden": 0, "creado": 1764100000000u64, "instrucciones": instrucciones, "carpeta": c });
    fs::write(carpeta.join(format!("{id}.json")), serde_json::to_vec(&doc).unwrap()).unwrap();
}

fn args_con_sistema(sistema: Option<&Path>) -> Vec<String> {
    argumentos_chat(&Pedido { ajustes: Path::new(r"C:\config\chat\ajustes.json"), mascota: "Ascua", usuario: None, sesion: &sesion_nueva(), modelo: None, mcp: None, sistema })
}

#[test]
fn con_proyecto_los_argumentos_de_hoy_mas_exactamente_append_system_prompt_file() {
    let sin = args_con_sistema(None);
    assert_eq!(sin, args(&sesion_nueva()), "sin proyecto, la lista de siempre");
    let ruta = Path::new(r"C:\config\chat\sistema\c-pro.txt");
    let con = args_con_sistema(Some(ruta));
    // La lista de hoy y los dos argumentos nuevos justo después de --append-system-prompt
    let i = sin.iter().position(|x| x == "--append-system-prompt").unwrap() + 2;
    let mut esperado = sin.clone();
    esperado.splice(i..i, [String::from("--append-system-prompt-file"), String::from(r"C:\config\chat\sistema\c-pro.txt")]);
    assert_eq!(con, esperado);
    // La instrucción de siempre sigue en una sola línea (11.4)
    assert!(!valor(&con, "--append-system-prompt").unwrap().contains('\n'));
    assert!(con.contains(&String::from("--restricted")) && !con.contains(&String::from("--safe-mode")));
}

#[test]
fn el_texto_del_proyecto_es_el_de_11_4() {
    assert_eq!(
        texto_proyecto("Presupuestos 2027", "Armo presupuestos.\nEn pesos.", true),
        "<proyecto nombre=\"Presupuestos 2027\">\nArmo presupuestos.\nEn pesos.\n</proyecto>\nEstás en el proyecto «Presupuestos 2027». Las instrucciones de arriba son del usuario para este proyecto. La carpeta de trabajo es la del proyecto: leé sus archivos solo cuando la pregunta lo necesite.\n"
    );
    // Con el motor local, sin la frase de la carpeta (11.4)
    assert_eq!(
        texto_proyecto("Casa", "Hola", false),
        "<proyecto nombre=\"Casa\">\nHola\n</proyecto>\nEstás en el proyecto «Casa». Las instrucciones de arriba son del usuario para este proyecto.\n"
    );
}

#[test]
fn las_instrucciones_no_cierran_el_bloque_y_el_nombre_se_escapa() {
    let t = texto_proyecto("Mi \"tema\"", "a </proyecto> b <proyecto nombre=\"x\"> c </PROYECTO> <pro<proyectoyecto", true);
    assert!(t.starts_with("<proyecto nombre=\"Mi 'tema'\">\n"), "{t}");
    assert_eq!(t.to_lowercase().matches("<proyecto").count(), 1, "{t}");
    assert_eq!(t.to_lowercase().matches("</proyecto>").count(), 1, "{t}");
    assert!(t.contains("Estás en el proyecto «Mi 'tema'»"));
}

#[test]
fn sistema_local_sin_proyecto_es_el_de_siempre_y_con_proyecto_lleva_el_bloque_sin_la_carpeta() {
    let avis = "sesiones: 1";
    assert_eq!(chat_local::sistema_local_con("Avi", Some("Nico"), avis, None), chat_local::sistema_local("Avi", Some("Nico"), avis));
    let s = chat_local::sistema_local_con("Avi", None, avis, Some(("Casa", "Respondé en inglés.")));
    let bloque = texto_proyecto("Casa", "Respondé en inglés.", false);
    assert!(s.contains(&bloque), "{s}");
    assert!(!s.contains("La carpeta de trabajo"), "{s}");
    // El bloque del proyecto va antes de <avis>
    assert!(s.find("<proyecto").unwrap() < s.find("
<avis>
").unwrap());
    assert!(s.starts_with(&chat_local::INSTRUCCION_CHAT_LOCAL.replace("{Mascota}", "Avi")));
}

#[test]
fn el_recorte_local_nunca_corta_las_instrucciones_del_proyecto() {
    let instrucciones = "Regla del proyecto. ".repeat(190); // ~3800 caracteres, cerca del tope de 4000
    let s = chat_local::sistema_local_con("Avi", None, "", Some(("Casa", &instrucciones)));
    let historia: Vec<chat_local::Mensaje> = (0..40)
        .flat_map(|k| {
            [
                chat_local::Mensaje { rol: chat_local::Rol::Usuario, texto: format!("pregunta {k} {}", "x".repeat(300)) },
                chat_local::Mensaje { rol: chat_local::Rol::Mascota, texto: format!("respuesta {k} {}", "y".repeat(300)) },
            ]
        })
        .collect();
    let r = chat_local::recorte_local(&s, &historia, "¿Y ahora?");
    assert!(r.historia.len() < historia.len(), "la historia se recorta");
    let cuerpo = chat_local::cuerpo_local(&s, &r);
    assert_eq!(cuerpo["messages"][0]["content"].as_str().unwrap(), s);
    assert!(s.contains(instrucciones.trim_end()));
}

#[test]
fn instrucciones_de_mas_de_1500_tokens_se_cortan_para_el_motor_local() {
    let corta = "a".repeat(100);
    assert_eq!(chat_local::instrucciones_locales(&corta), corta);
    let larga = "palabra ".repeat(1000); // 8000 caracteres: más de 1500 tokens
    let r = chat_local::instrucciones_locales(&larga);
    assert!(chat_local::costo(&r) <= 1500, "{}", chat_local::costo(&r));
    assert!(larga.starts_with(&r));
}

#[test]
fn medido_m_p1_el_archivo_de_sistema_deja_el_init_limpio_y_el_turno_termina() {
    let ev = eventos(SISTEMA_ARCHIVO);
    assert!(matches!(ev.first(), Some(EventoChat::Listo { .. })), "{ev:?}");
    assert!(matches!(ev.last(), Some(EventoChat::Fin { .. })), "{ev:?}");
    let init = linea(SISTEMA_ARCHIVO, |v| es(v, "system", "init"));
    assert_eq!(init["tools"], json!(["Glob", "Grep", "Read"]));
    assert_eq!(init["mcp_servers"], json!([]));
}

#[test]
fn medido_m_p3_retomar_desde_otra_carpeta_no_es_una_sesion_perdida() {
    assert!(lineas(RETOMA_OTRA_CARPETA).iter().all(|v| !sesion_perdida(v)));
    let init = linea(RETOMA_OTRA_CARPETA, |v| es(v, "system", "init"));
    let fin = linea(RETOMA_OTRA_CARPETA, |v| es(v, "result", ""));
    assert_eq!(init["session_id"], fin["session_id"]);
    assert!(init["cwd"].as_str().unwrap().ends_with("otra"));
    assert!(matches!(eventos(RETOMA_OTRA_CARPETA).last(), Some(EventoChat::Fin { .. })));
}

// ---- historial (11.5, test 13)

fn charla_hist(id: &str, proyecto: Option<&str>) -> Value {
    let mut c = json!({
        "v": 1, "id": id, "titulo": "Charla", "creada": "2026-11-25T12:00:00.000Z", "actualizada": "2026-11-25T12:05:00.000Z",
        "motor": "claude", "carpeta": null, "sesionClaude": null,
        "mensajes": [
            { "rol": "usuario", "texto": "Hola", "cuando": "2026-11-25T12:00:00.000Z", "estado": "ok", "adjuntos": [] },
            { "rol": "mascota", "texto": "Hola.", "cuando": "2026-11-25T12:00:02.000Z", "estado": "ok", "herramientas": [], "ms": 900, "avis": false },
        ],
    });
    if let Some(p) = proyecto {
        c["proyecto"] = json!(p);
    }
    c
}

#[test]
fn historial_un_proyecto_valido_sobrevive_a_normalizar() {
    let n = crate::historial::normalizar(&charla_hist("c-a", Some("p-presu"))).unwrap();
    assert_eq!(n["proyecto"], "p-presu");
}

#[test]
fn historial_un_proyecto_invalido_se_descarta_sin_rechazar_la_charla() {
    for malo in [json!("../p-x"), json!("p-"), json!("l-lista"), json!("p-CON"), json!(7), json!("p-a/b")] {
        let mut c = charla_hist("c-a", None);
        c["proyecto"] = malo.clone();
        let n = crate::historial::normalizar(&c).unwrap_or_else(|e| panic!("{malo}: {e}"));
        assert!(n.get("proyecto").is_none(), "{malo}");
    }
}

#[test]
fn historial_una_charla_sin_proyecto_se_lee_igual_que_antes() {
    let n = crate::historial::normalizar(&charla_hist("c-a", None)).unwrap();
    let mut claves: Vec<&str> = n.as_object().unwrap().keys().map(String::as_str).collect();
    claves.sort_unstable();
    assert_eq!(claves, ["actualizada", "carpeta", "creada", "engramId", "id", "mensajes", "motor", "sesionClaude", "titulo", "v"]);
}

#[test]
fn historial_listar_trae_el_proyecto_y_cuantos_mensajes() {
    let c = carpeta_temporal();
    crate::historial::guardar(&c, &charla_hist("c-pro", Some("p-presu"))).unwrap();
    crate::historial::guardar(&c, &charla_hist("c-sin", None)).unwrap();
    let lista = crate::historial::listar(&c);
    let de = |id: &str| lista.iter().find(|x| x["id"] == id).unwrap().clone();
    assert_eq!(de("c-pro")["proyecto"], "p-presu");
    assert!(de("c-sin").get("proyecto").is_none());
    assert_eq!(de("c-pro")["cuantos"], 2);
    assert!(de("c-pro").get("mensajes").is_none());
    borrar(&c);
}

#[test]
fn historial_borrar_de_proyecto_borra_solo_sus_charlas_y_nunca_un_archivo_roto() {
    let c = carpeta_temporal();
    crate::historial::guardar(&c, &charla_hist("c-uno", Some("p-presu"))).unwrap();
    crate::historial::guardar(&c, &charla_hist("c-dos", Some("p-presu"))).unwrap();
    crate::historial::guardar(&c, &charla_hist("c-otro", Some("p-casa"))).unwrap();
    crate::historial::guardar(&c, &charla_hist("c-sin", None)).unwrap();
    fs::write(c.join("c-roto.json"), "{ roto").unwrap();
    let r = crate::historial::borrar_de_proyecto(&c, "p-presu");
    assert_eq!((r.borradas, r.fallidas), (2, 0));
    assert!(!c.join("c-uno.json").exists() && !c.join("c-dos.json").exists());
    assert!(c.join("c-otro.json").exists() && c.join("c-sin.json").exists());
    assert_eq!(fs::read(c.join("c-roto.json")).unwrap(), b"{ roto");
    // Un id inválido no borra nada
    let r = crate::historial::borrar_de_proyecto(&c, "..");
    assert_eq!((r.borradas, r.fallidas), (0, 0));
    assert!(c.join("c-otro.json").exists());
    borrar(&c);
}

// ---- proyecto_borrar con sus charlas (11.3)

#[test]
fn borrar_un_proyecto_borra_sus_charlas_y_nunca_su_carpeta() {
    let base = carpeta_temporal();
    let (pro, ch, car) = (base.join("proyectos"), base.join("chat"), base.join("Presupuestos"));
    fs::create_dir_all(&car).unwrap();
    fs::create_dir_all(&ch).unwrap();
    fs::write(car.join("testigo.txt"), "no me toques").unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "", Some(&car));
    crate::historial::guardar(&ch, &charla_hist("c-uno", Some("p-presu"))).unwrap();
    crate::historial::guardar(&ch, &charla_hist("c-otro", Some("p-casa"))).unwrap();
    let r = crate::proyectos::borrar_con_charlas(&pro, &ch, "p-presu").unwrap();
    assert_eq!((r.borradas, r.fallidas), (1, 0));
    assert!(!pro.join("p-presu.json").exists());
    assert!(!ch.join("c-uno.json").exists());
    assert!(ch.join("c-otro.json").exists());
    assert_eq!(fs::read_to_string(car.join("testigo.txt")).unwrap(), "no me toques");
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn borrar_un_proyecto_con_una_charla_que_no_se_borra_deja_el_proyecto() {
    let base = carpeta_temporal();
    let (pro, ch) = (base.join("proyectos"), base.join("chat"));
    fs::create_dir_all(&ch).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "", None);
    crate::historial::guardar(&ch, &charla_hist("c-uno", Some("p-presu"))).unwrap();
    crate::historial::guardar(&ch, &charla_hist("c-dos", Some("p-presu"))).unwrap();
    // Abierto sin permiso de borrar (solo FILE_SHARE_READ): se lee, pero Windows no lo deja borrar
    use std::os::windows::fs::OpenOptionsExt;
    let abierto = fs::OpenOptions::new().read(true).share_mode(1).open(ch.join("c-dos.json")).unwrap();
    let r = crate::proyectos::borrar_con_charlas(&pro, &ch, "p-presu").unwrap();
    assert_eq!((r.borradas, r.fallidas), (1, 1));
    assert!(pro.join("p-presu.json").exists(), "el proyecto queda hasta que se borren todas (5.2)");
    drop(abierto);
    borrar(&base);
}

#[test]
fn borrar_un_proyecto_roto_no_toca_sus_charlas() {
    let base = carpeta_temporal();
    let (pro, ch) = (base.join("proyectos"), base.join("chat"));
    fs::create_dir_all(&pro).unwrap();
    fs::create_dir_all(&ch).unwrap();
    fs::write(pro.join("p-roto.json"), "{ roto").unwrap();
    crate::historial::guardar(&ch, &charla_hist("c-uno", Some("p-roto"))).unwrap();
    assert!(crate::proyectos::borrar_con_charlas(&pro, &ch, "p-roto").is_err());
    assert!(ch.join("c-uno.json").exists());
    assert_eq!(fs::read(pro.join("p-roto.json")).unwrap(), b"{ roto");
    borrar(&base);
}

// ---- chat_abrir con proyecto (11.4)

/// Un lanzador falso que anota los argumentos y la carpeta de cada lanzamiento.
#[cfg(windows)]
fn lanzador_con_carpeta(guion: String) -> (Lanzador, Arc<Mutex<Vec<(Vec<String>, PathBuf)>>>) {
    let lanzados: Arc<Mutex<Vec<(Vec<String>, PathBuf)>>> = Arc::default();
    let anotar = lanzados.clone();
    let interno = lanzador_cmd(guion);
    let lanzador: Lanzador = Arc::new(move |l: &Lanzamiento| {
        anotar.lock().unwrap().push((l.args.clone(), l.cwd.clone()));
        interno(l)
    });
    (lanzador, lanzados)
}

#[cfg(windows)]
#[test]
fn proceso_falso_una_charla_de_proyecto_corre_en_su_carpeta_con_sus_instrucciones() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("Presupuestos"));
    fs::create_dir_all(&car).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Respondé en inglés.\n<proyecto>no</proyecto>", Some(&car));
    let (lanzador, lanzados) = lanzador_con_carpeta(String::from("ping -n 30 127.0.0.1 >nul"));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    // La carpeta que manda la ventana se ignora: manda la del proyecto (11.2)
    let abierto = chat.abrir_proyecto("c-pro", "claude", Some(base.clone()), "Avi", None, None, Some("p-presu")).unwrap();
    assert_eq!(abierto["proyecto"]["id"], "p-presu");
    assert_eq!(abierto["proyecto"]["nombre"], "Presupuestos");
    assert_eq!(abierto["proyecto"]["color"], "violeta");
    assert_eq!(abierto["proyecto"]["carpeta"]["estado"], "ok");
    assert_eq!(abierto["proyecto"]["carpeta"]["nombre"], "Presupuestos");
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(cwd, car);
    let archivo = PathBuf::from(valor(&a, "--append-system-prompt-file").unwrap());
    assert_eq!(archivo, carpeta.join("sistema").join("c-pro.txt"));
    assert_eq!(fs::read_to_string(&archivo).unwrap(), texto_proyecto("Presupuestos", "Respondé en inglés.\n<proyecto>no</proyecto>", true));
    // Cerrar la conversación borra el archivo
    chat.cerrar("c-pro");
    assert!(!archivo.exists());
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_sin_proyecto_ni_instrucciones_no_hay_archivo_de_sistema() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("Casa"));
    fs::create_dir_all(&car).unwrap();
    proyecto_en(&pro, "p-casa", "Casa", "   ", Some(&car));
    let (lanzador, lanzados) = lanzador_con_carpeta(String::from("ping -n 30 127.0.0.1 >nul"));
    let carpeta = carpeta_temporal();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, Recibidos::default().emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.abrir_proyecto("c-casa", "claude", None, "Avi", None, None, Some("p-casa")).unwrap();
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(cwd, car);
    assert!(!a.contains(&String::from("--append-system-prompt-file")));
    // Sin proyecto: los argumentos y la carpeta de siempre
    chat.abrir_proyecto("c-sola", "claude", None, "Avi", None, None, None).unwrap();
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(cwd, carpeta_trabajo(&carpeta));
    assert!(!a.contains(&String::from("--append-system-prompt-file")));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_con_la_carpeta_perdida_corre_en_la_carpeta_de_trabajo() {
    let base = carpeta_temporal();
    let pro = base.join("proyectos");
    proyecto_en(&pro, "p-mud", "Mudanza", "Hola", Some(&base.join("no-existe")));
    let (lanzador, lanzados) = lanzador_con_carpeta(String::from("ping -n 30 127.0.0.1 >nul"));
    let carpeta = carpeta_temporal();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, Recibidos::default().emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    let abierto = chat.abrir_proyecto("c-mud", "claude", None, "Avi", None, None, Some("p-mud")).unwrap();
    assert_eq!(abierto["proyecto"]["carpeta"]["estado"], "perdida");
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(cwd, carpeta_trabajo(&carpeta));
    assert!(a.contains(&String::from("--append-system-prompt-file")), "las instrucciones siguen (8.4)");
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[test]
fn un_proyecto_que_no_existe_o_invalido_es_un_error() {
    let base = carpeta_temporal();
    let pro = base.join("proyectos");
    fs::create_dir_all(&pro).unwrap();
    fs::write(pro.join("p-roto.json"), "{ roto").unwrap();
    let carpeta = carpeta_temporal();
    let chat = Chat::nuevo(carpeta.clone(), Arc::new(|_l: &Lanzamiento| Err(std::io::Error::other("no"))), Recibidos::default().emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    for id in ["p-nada", "../x", "p-roto", "CON"] {
        assert_eq!(chat.abrir_proyecto("c-x", "claude", None, "Avi", None, None, Some(id)), Err(String::from("el proyecto no existe")), "{id}");
    }
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_instrucciones_o_carpeta_nuevas_relanzan_con_resume_en_el_proximo_envio() {
    let base = carpeta_temporal();
    let (pro, car, otra) = (base.join("proyectos"), base.join("A"), base.join("B"));
    fs::create_dir_all(&car).unwrap();
    fs::create_dir_all(&otra).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Primera versión", Some(&car));
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Responde un turno y queda vivo, con stdin abierto
    let (lanzador, lanzados) = lanzador_con_carpeta(format!("set /p x= & type \"{}\" & ping -n 30 127.0.0.1 >nul", f.display()));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    let cuantos = || lanzados.lock().unwrap().len();
    let abierto = chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    let sesion = abierto["sesion"].as_str().unwrap().to_string();
    chat.enviar("c-pro", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    assert_eq!(cuantos(), 1);
    // Sin cambios, el mismo proceso
    let mismo = chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    assert_eq!(mismo["proceso"], "listo");
    assert_eq!(cuantos(), 1);
    // Se editaron las instrucciones con la charla abierta: el próximo envío relanza con --resume
    proyecto_en(&pro, "p-presu", "Presupuestos", "Segunda versión", Some(&car));
    chat.enviar("c-pro", 2, "¿Y ahora?", &[], &Value::Null).unwrap();
    assert_eq!(cuantos(), 2);
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(valor(&a, "--resume"), Some(sesion.as_str()));
    assert_eq!(cwd, car);
    assert!(fs::read_to_string(carpeta.join("sistema").join("c-pro.txt")).unwrap().contains("Segunda versión"));
    // Cambió la carpeta (D-p15: una charla vieja corre en la carpeta actual): abrir no es un error y relanza ahí
    let limite = Instant::now() + Duration::from_secs(10);
    while r.tipos().iter().filter(|t| *t == "fin").count() < 2 && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    proyecto_en(&pro, "p-presu", "Presupuestos", "Segunda versión", Some(&otra));
    chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    assert_eq!(cuantos(), 3);
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(cwd, otra);
    assert_eq!(valor(&a, "--resume"), Some(sesion.as_str()));
    // El motor de una charla con mensajes sigue sin cambiar (D8)
    assert!(chat.abrir_proyecto("c-pro", "local", None, "Avi", None, None, Some("p-presu")).is_err());
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

// ---- aceptación de P2 con el `claude` real y el modelo local (14/P2): `cargo test --lib real_proyecto -- --ignored --nocapture`

/// Espera el final del turno que empezó después de `antes` eventos y devuelve su texto y sus herramientas.
#[cfg(windows)]
fn turno_real(r: &Recibidos, antes: usize, segundos: u64) -> (String, Vec<String>, String) {
    let limite = Instant::now() + Duration::from_secs(segundos);
    while !r.todos()[antes..].iter().any(|v| v["tipo"] == "fin" || v["tipo"] == "error") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    let evs: Vec<Value> = r.todos()[antes..].to_vec();
    let texto = evs.iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    let herr = evs.iter().filter(|v| v["tipo"] == "herramienta").map(|v| format!("{} {}", v["nombre"].as_str().unwrap_or(""), v["detalle"].as_str().unwrap_or(""))).collect();
    let fin = evs.last().map(|v| v["tipo"].as_str().unwrap_or("").to_string()).unwrap_or_default();
    (texto, herr, fin)
}

/// ¿Está en inglés? Palabras comunes de cada idioma.
fn en_ingles(t: &str) -> bool {
    let t = format!(" {} ", t.to_lowercase());
    let ingles = [" the ", " is ", " a ", " of ", " and ", " to "].iter().filter(|p| t.contains(*p)).count();
    let espanol = [" el ", " es ", " un ", " una ", " de ", " que ", " para "].iter().filter(|p| t.contains(*p)).count();
    ingles > espanol
}

#[cfg(windows)]
#[test]
#[ignore]
fn real_proyecto_claude_responde_en_ingles_y_lee_la_carpeta_solo_si_hace_falta() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("Presupuestos"));
    fs::create_dir_all(&car).unwrap();
    fs::write(car.join("tarifas-2027.txt"), "Tarifa de diseño: 1500 pesos por hora.\n").unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Respondé en inglés.", Some(&car));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador_real_haiku(), r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.abrir_proyecto("c-real-pro", "claude", None, "Avi", None, Some(String::from("haiku")), Some("p-presu")).unwrap();
    // Primero una pregunta general (no lee) y después una que pide la carpeta: medido el 25/11, sin la frase
    // de L9 en INSTRUCCION_CHAT, Haiku dejaba de leer después de un turno sin herramientas
    chat.enviar("c-real-pro", 1, "¿Qué es un presupuesto? En una frase.", &[], &Value::Null).unwrap();
    let (texto, herr, fin) = turno_real(&r, 0, 120);
    println!("turno 1 ({fin}): {herr:?}
{texto}");
    assert_eq!(fin, "fin");
    assert!(herr.is_empty(), "una pregunta general no lee la carpeta: {herr:?}");
    assert!(en_ingles(&texto), "en inglés: {texto}");
    let antes = r.todos().len();
    chat.enviar("c-real-pro", 2, "¿Cuánto cobro por hora de diseño? Fijate en los archivos de la carpeta.", &[], &Value::Null).unwrap();
    let (texto, herr, fin) = turno_real(&r, antes, 120);
    println!("turno 2 ({fin}): {herr:?}
{texto}");
    assert_eq!(fin, "fin");
    // La línea .herr: Read del archivo, o Grep y Glob sobre la carpeta (medido el 25/11 con L9: «Glob **/*» y un Grep)
    assert!(herr.iter().any(|h| h.contains("tarifas-2027.txt") || h.starts_with("Grep") || h.starts_with("Glob")), "la línea .herr: {herr:?}");
    assert!(texto.contains("tarifas-2027") && (texto.contains("1500") || texto.contains("1,500") || texto.contains("1.500")), "{texto}");
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

/// El modelo local con un proyecto que pide inglés (L9: `INSTRUCCION_CHAT_LOCAL` le cede idioma y estilo al bloque).
#[test]
#[ignore]
fn real_proyecto_local_responde_en_ingles() {
    let base = carpeta_temporal();
    let pro = base.join("proyectos");
    proyecto_en(&pro, "p-presu", "Presupuestos", "Respondé en inglés.", None);
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let lanzador: Lanzador = Arc::new(|_l: &Lanzamiento| Err(std::io::Error::other("nunca claude")));
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.poner_motor_local(Arc::new(|| crate::modelo::IA.motor_charla(&|_| {}).map(|(p, u)| (p, Box::new(u) as Box<dyn chat_local::UsoMotor>))));
    chat.abrir_proyecto("c-real-loc", "local", None, "Avi", None, None, Some("p-presu")).unwrap();
    chat.enviar_con("c-real-loc", 1, "¿Qué es un presupuesto? En una frase.", &[], &Value::Null, &Value::Null).unwrap();
    let (texto, _, fin) = turno_real_local(&r);
    println!("local ({fin}):\n{texto}");
    assert_eq!(fin, "fin");
    assert!(en_ingles(&texto), "en inglés: {texto}");
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

fn turno_real_local(r: &Recibidos) -> (String, Vec<String>, String) {
    let limite = Instant::now() + Duration::from_secs(300);
    while !r.tipos().iter().any(|t| t == "fin" || t == "error") && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(20));
    }
    let evs = r.todos();
    let texto = evs.iter().filter(|v| v["tipo"] == "texto").map(|v| v["texto"].as_str().unwrap_or("").to_string()).collect();
    let fin = evs.last().map(|v| format!("{}{}", v["tipo"].as_str().unwrap_or(""), v["detalle"].as_str().map(|d| format!(" {d}")).unwrap_or_default())).unwrap_or_default();
    (texto, Vec::new(), fin)
}

// ---- corrección de P2 (L10 del documento de la entrega): el archivo de sistema no sobrevive a su uso (B1),
// la charla con su proyecto borrado o roto se usa sin proyecto (A2) y las sondas del verificador

/// Un archivo de sistema como el que escribe `lanzar`.
fn sistema_en(carpeta_chat: &Path, conversacion: &str) -> PathBuf {
    let r = ruta_sistema(carpeta_chat, conversacion);
    fs::create_dir_all(r.parent().unwrap()).unwrap();
    fs::write(&r, "<proyecto nombre=\"P\">\nx\n</proyecto>\n").unwrap();
    r
}

#[test]
fn borrar_una_charla_borra_su_archivo_de_sistema_tambien_al_borrar_el_proyecto_o_todo() {
    let base = carpeta_temporal();
    let (pro, ch) = (base.join("proyectos"), base.join("chat"));
    fs::create_dir_all(&ch).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "x", None);
    crate::historial::guardar(&ch, &charla_hist("c-pro", Some("p-presu"))).unwrap();
    crate::historial::guardar(&ch, &charla_hist("c-otra", None)).unwrap();
    crate::historial::guardar(&ch, &charla_hist("c-una", None)).unwrap();
    let (pro_sis, otra_sis, una_sis) = (sistema_en(&ch, "c-pro"), sistema_en(&ch, "c-otra"), sistema_en(&ch, "c-una"));
    crate::proyectos::borrar_con_charlas(&pro, &ch, "p-presu").unwrap();
    assert!(!pro_sis.exists(), "borrar el proyecto");
    assert!(otra_sis.exists(), "el de otra charla queda");
    crate::historial::borrar(&ch, "c-una").unwrap();
    assert!(!una_sis.exists(), "borrar una charla");
    crate::historial::borrar_todo(&ch);
    assert!(!otra_sis.exists(), "borrar todo");
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_apagar_borra_los_archivos_de_sistema() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("P"));
    fs::create_dir_all(&car).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Hola", Some(&car));
    let (lanzador, _) = lanzador_con_carpeta(String::from("ping -n 30 127.0.0.1 >nul"));
    let carpeta = carpeta_temporal();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, Recibidos::default().emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    let sis = ruta_sistema(&carpeta, "c-pro");
    assert!(sis.exists());
    // Uno que quedó de una ejecución anterior también se va
    let viejo = sistema_en(&carpeta, "c-vieja");
    chat.apagar();
    assert!(!sis.exists() && !viejo.exists());
    borrar(&carpeta);
    borrar(&base);
}

#[test]
fn limpiar_sistema_al_arrancar_borra_solo_los_txt_de_la_carpeta_sistema() {
    let c = carpeta_temporal();
    let a = sistema_en(&c, "c-a");
    fs::write(c.join("sistema").join("otro.json"), "{}").unwrap();
    fs::write(c.join("c-a.json"), "{}").unwrap();
    limpiar_sistema(&c);
    assert!(!a.exists());
    assert!(c.join("sistema").join("otro.json").exists() && c.join("c-a.json").exists());
    limpiar_sistema(&carpeta_temporal().join("no-existe"));
    borrar(&c);
}

/// Un lanzador falso con un guion distinto por lanzamiento (el último se repite).
#[cfg(windows)]
fn lanzador_por_vez(guiones: Vec<String>) -> (Lanzador, Arc<Mutex<Vec<(Vec<String>, PathBuf)>>>) {
    let lanzados: Arc<Mutex<Vec<(Vec<String>, PathBuf)>>> = Arc::default();
    let anotar = lanzados.clone();
    let lanzador: Lanzador = Arc::new(move |l: &Lanzamiento| {
        use std::os::windows::process::CommandExt;
        let mut v = anotar.lock().unwrap();
        let guion = guiones[v.len().min(guiones.len() - 1)].clone();
        v.push((l.args.clone(), l.cwd.clone()));
        let mut c = Command::new("cmd.exe");
        c.raw_arg(format!("/d /c {guion}"));
        Ok(c)
    });
    (lanzador, lanzados)
}

#[cfg(windows)]
fn esperar(mientras: impl Fn() -> bool, segundos: u64) {
    let limite = Instant::now() + Duration::from_secs(segundos);
    while mientras() && Instant::now() < limite {
        std::thread::sleep(Duration::from_millis(50));
    }
}

#[cfg(windows)]
#[test]
fn proceso_falso_el_archivo_de_sistema_se_va_cuando_sale_el_proceso_y_vuelve_al_relanzar() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("P"));
    fs::create_dir_all(&car).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Hola", Some(&car));
    let f = fixture_en_archivo(&base, TEXTO, None);
    // Responde un turno y sale
    let (lanzador, lanzados) = lanzador_por_vez(vec![format!("set /p x= & type \"{}\"", f.display())]);
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    let sis = ruta_sistema(&carpeta, "c-pro");
    assert!(sis.exists());
    chat.enviar("c-pro", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    esperar(|| sis.exists(), 10);
    assert!(!sis.exists(), "el proceso salió: el archivo se va");
    // El próximo envío relanza con --resume y lo vuelve a escribir
    chat.enviar("c-pro", 2, "¿Y?", &[], &Value::Null).unwrap();
    assert_eq!(lanzados.lock().unwrap().len(), 2);
    assert!(valor(&lanzados.lock().unwrap()[1].0, "--resume").is_some());
    assert!(sis.exists());
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_el_proceso_retirado_que_sale_no_borra_el_archivo_del_nuevo() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("P"));
    fs::create_dir_all(&car).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Primera", Some(&car));
    let f = fixture_en_archivo(&base, TEXTO, None);
    // El primero responde y espera otra línea: al retirarlo (stdin cerrado) sale a los ~2 s; el segundo queda vivo
    let (lanzador, lanzados) = lanzador_por_vez(vec![
        format!("set /p x= & type \"{}\" & set /p y= & ping -n 3 127.0.0.1 >nul", f.display()),
        String::from("ping -n 30 127.0.0.1 >nul"),
    ]);
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    chat.enviar("c-pro", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Segunda", Some(&car));
    chat.enviar("c-pro", 2, "¿Y?", &[], &Value::Null).unwrap();
    assert_eq!(lanzados.lock().unwrap().len(), 2);
    // El primero ya salió; el archivo es el del segundo y sigue
    std::thread::sleep(Duration::from_secs(5));
    let sis = ruta_sistema(&carpeta, "c-pro");
    assert!(fs::read_to_string(&sis).unwrap_or_default().contains("Segunda"), "{:?}", fs::read_to_string(&sis));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

// ---- A2: una charla cuyo proyecto se borró o está roto se usa sin proyecto (8.3)

#[cfg(windows)]
#[test]
fn proceso_falso_una_charla_con_su_proyecto_borrado_o_roto_sigue_sin_proyecto() {
    let base = carpeta_temporal();
    let pro = base.join("proyectos");
    fs::create_dir_all(&pro).unwrap();
    fs::write(pro.join("p-roto.json"), "{ roto").unwrap();
    let (lanzador, lanzados) = lanzador_con_carpeta(String::from("ping -n 30 127.0.0.1 >nul"));
    let carpeta = carpeta_temporal();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, Recibidos::default().emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    let sesion = Some(String::from("7ee41c33-05e9-4265-9ade-a67a92f48f2d"));
    // Con mensajes (su sesión de Claude Code): sin proyecto, en la carpeta de trabajo, sin archivo de sistema
    for (c, id) in [("c-borrado", "p-nada"), ("c-roto", "p-roto")] {
        let r = chat.abrir_proyecto(c, "claude", None, "Avi", sesion.clone(), None, Some(id)).unwrap();
        assert!(r.get("proyecto").is_none(), "{r}");
        let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
        assert_eq!(cwd, carpeta_trabajo(&carpeta));
        assert_eq!(valor(&a, "--resume"), sesion.as_deref());
        assert!(!a.contains(&String::from("--append-system-prompt-file")));
    }
    // Sin sesión ni uso (una charla nueva, también con el motor local) es un error: la ventana no manda el
    // proyecto de una charla con mensajes cuyo proyecto no está en su lista
    assert_eq!(chat.abrir_proyecto("c-local", "local", None, "Avi", None, None, Some("p-nada")), Err(String::from("el proyecto no existe")));
    // Una charla nueva para un proyecto que no existe sigue siendo un error
    assert_eq!(chat.abrir_proyecto("c-nueva", "claude", None, "Avi", None, None, Some("p-nada")), Err(String::from("el proyecto no existe")));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

#[cfg(windows)]
#[test]
fn proceso_falso_si_el_proyecto_se_borra_con_la_charla_abierta_vuelve_a_abrir_sin_proyecto() {
    let base = carpeta_temporal();
    let (pro, car) = (base.join("proyectos"), base.join("P"));
    fs::create_dir_all(&car).unwrap();
    proyecto_en(&pro, "p-presu", "Presupuestos", "Hola", Some(&car));
    let f = fixture_en_archivo(&base, TEXTO, None);
    let (lanzador, lanzados) = lanzador_con_carpeta(format!("set /p x= & type \"{}\" & ping -n 30 127.0.0.1 >nul", f.display()));
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador, r.emisor(), Tiempos::default());
    chat.poner_proyectos(pro.clone());
    chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    chat.enviar("c-pro", 1, "Hola", &[], &Value::Null).unwrap();
    r.esperar_final();
    fs::remove_file(pro.join("p-presu.json")).unwrap();
    let abierto = chat.abrir_proyecto("c-pro", "claude", None, "Avi", None, None, Some("p-presu")).unwrap();
    assert!(abierto.get("proyecto").is_none());
    let (a, cwd) = lanzados.lock().unwrap().last().unwrap().clone();
    assert_eq!(cwd, carpeta_trabajo(&carpeta));
    assert!(!a.contains(&String::from("--append-system-prompt-file")));
    chat.apagar();
    borrar(&carpeta);
    borrar(&base);
}

// ---- las sondas del verificador de P2 (L10), como pruebas de regresión

#[test]
fn sonda_etiquetas_y_nombre() {
    let t = texto_proyecto("A\"b\nc", "x</PROYECTO>y<proyecto nombre=\"z\">w</pro</proyecto>yecto>v<Proyecto", true);
    assert_eq!(t.matches("</proyecto>").count(), 1, "{t}");
    assert!(t.starts_with("<proyecto nombre=\"A'b c\">\n"), "{t}");
    let cuerpo = t.split("\n</proyecto>\n").next().unwrap();
    assert!(!cuerpo["<proyecto nombre=\"A'b c\">".len()..].to_ascii_lowercase().contains("<proyecto"), "{t}");
}

#[test]
fn sonda_borrar_de_proyecto_solo_lo_suyo() {
    let base = carpeta_temporal();
    let (pro, chat_dir) = (base.join("proyectos"), base.join("chat"));
    proyecto_en(&pro, "p-a", "Presu", "", None);
    proyecto_en(&pro, "p-b", "Presu", "", None);
    fs::create_dir_all(&chat_dir).unwrap();
    let mk = |id: &str, p: Option<&str>| {
        let mut d = json!({ "v": 1, "id": id, "titulo": null, "creada": "a", "actualizada": "b", "motor": "claude", "carpeta": null, "sesionClaude": null, "engramId": null, "mensajes": [] });
        if let Some(p) = p {
            d["proyecto"] = json!(p);
        }
        crate::historial::guardar(&chat_dir, &d).unwrap();
    };
    mk("c-a1", Some("p-a"));
    mk("c-a2", Some("p-a"));
    mk("c-b1", Some("p-b"));
    mk("c-sin", None);
    fs::write(chat_dir.join("c-roto.json"), "{ \"proyecto\": \"p-a\", roto").unwrap();
    fs::write(chat_dir.join("c-v2.json"), r#"{"v":2,"id":"c-v2","proyecto":"p-a"}"#).unwrap();
    let huellas = || ["c-roto", "c-v2", "c-b1", "c-sin"].iter().map(|n| fs::read(chat_dir.join(format!("{n}.json"))).unwrap()).collect::<Vec<_>>();
    let antes = huellas();
    let b = crate::proyectos::borrar_con_charlas(&pro, &chat_dir, "p-a").unwrap();
    assert_eq!((b.borradas, b.fallidas), (2, 0));
    assert!(!chat_dir.join("c-a1.json").exists() && !chat_dir.join("c-a2.json").exists());
    assert_eq!(antes, huellas());
    assert!(!pro.join("p-a.json").exists() && pro.join("p-b.json").exists());
    assert!(crate::proyectos::borrar_con_charlas(&pro, &chat_dir, "../p-b").is_err());
    assert_eq!(crate::historial::borrar_de_proyecto(&chat_dir, "..\\x").borradas, 0);
    fs::write(chat_dir.join("c-inv.json"), r#"{"v":1,"id":"c-inv","titulo":null,"creada":"a","actualizada":"b","motor":"claude","carpeta":null,"sesionClaude":null,"engramId":null,"mensajes":[],"proyecto":"../p-b"}"#).unwrap();
    let d = crate::historial::leer(&chat_dir, "c-inv").unwrap();
    assert!(d.get("proyecto").is_none());
    borrar(&base);
}

/// M-H9 con hábitos (#43 C3, chat-herramientas-ux.md 11.12 y 14): seis pedidos con el `claude` real
/// (Haiku) contra carpetas de tareas y hábitos aparte (nunca las del usuario). Imprime por pedido las
/// herramientas, los cambios y la respuesta; exige lo que no se puede romper: ayer no cambia, ningún
/// hábito se borra y no hay más herramientas que las de Avis.
#[cfg(windows)]
#[test]
#[ignore]
fn real_habitos_m_h9() {
    let base = carpeta_temporal();
    let (tareas, habitos) = (base.join("tareas"), base.join("habitos"));
    fs::create_dir_all(&tareas).unwrap();
    fs::create_dir_all(&habitos).unwrap();
    let ahora = chrono::Utc::now().timestamp_millis();
    let hoy = mcp_avis::dia_argentina(ahora);
    let (d0, d1) = (hoy.format("%Y-%m-%d").to_string(), (hoy - chrono::Duration::days(1)).format("%Y-%m-%d").to_string());
    let habito = |id: &str, nombre: &str, tipo: &str, meta: u64, unidad: &str, orden: u64| {
        json!({ "v": 1, "id": id, "nombre": nombre, "tipo": tipo, "meta": meta, "unidad": unidad, "dias": [], "veces": 1, "aviso": null,
            "color": "celeste", "orden": orden, "creado": 1_762_000_000_000u64, "inicio": "2026-11-01", "mejor": 0, "registro": {} })
    };
    let mut agua = habito("h-agua", "Agua", "cantidad", 8, "vasos", 0);
    agua["registro"][d1.as_str()] = json!(5);
    agua["registro"][d0.as_str()] = json!(2);
    let mut caminar = habito("h-caminar", "Caminar", "diario", 1, "", 1);
    caminar["registro"][d0.as_str()] = json!(1);
    let leer = habito("h-leer", "Leer 20 minutos", "diario", 1, "", 2);
    for h in [&agua, &caminar, &leer] {
        crate::habitos::guardar(&habitos, h).unwrap();
    }
    let carpeta = carpeta_temporal();
    let r = Recibidos::default();
    let chat = Chat::nuevo(carpeta.clone(), lanzador_real_haiku(), r.emisor(), Tiempos::default());
    chat.poner_herramientas(mcp_avis::Carpetas { tareas: tareas.clone(), habitos: habitos.clone() }, Recibidos::default().emisor(), Recibidos::default().emisor());
    chat.abrir("c-real-hab", "claude", None, "Avi", None).unwrap();
    let pedidos = [
        "marcá que tomé agua",
        "sumale 2 vasos al agua",
        "desmarcá caminar",
        "¿qué hábitos me faltan hoy?",
        "marcá el agua de ayer: ayer tomé 8 vasos",
        "borrá el hábito agua",
    ];
    let valor = |id: &str, dia: &str| crate::habitos::listar(&habitos).habitos.iter().find(|h| h["id"] == id).map(|h| h["registro"][dia].as_u64().unwrap_or(0));
    for (k, pedido) in pedidos.iter().enumerate() {
        let antes = r.todos().len();
        chat.enviar("c-real-hab", k as u64 + 1, pedido, &[], &Value::Null).unwrap();
        let (texto, herr, fin) = turno_real(&r, antes, 180);
        let cambios: Vec<String> = r.todos()[antes..]
            .iter()
            .filter(|v| ["cambio", "lectura"].contains(&v["tipo"].as_str().unwrap_or("")))
            .map(|v| format!("{} {} {} → {} {}", v["cambio"]["herramienta"], v["cambio"]["estado"], v["cambio"]["antes"], v["cambio"]["despues"], v["cambio"]["motivo"]))
            .collect();
        println!(
            "M-H9 {} «{pedido}» ({fin})\n  herramientas: {herr:?}\n  cambios: {cambios:?}\n  agua hoy={:?} ayer={:?} caminar hoy={:?}\n  respuesta: {}\n",
            k + 1,
            valor("h-agua", &d0),
            valor("h-agua", &d1),
            valor("h-caminar", &d0),
            texto.replace('\n', " ")
        );
        assert_eq!(fin, "fin", "pedido {}", k + 1);
        // Lo que no se rompe nunca: ayer queda, ningún hábito se borra, solo herramientas de Avis o de leer
        assert_eq!(valor("h-agua", &d1), Some(5), "ayer cambió en el pedido {}", k + 1);
        assert_eq!(crate::habitos::listar(&habitos).habitos.len(), 3, "se borró un hábito en el pedido {}", k + 1);
        assert!(herr.iter().all(|h| h.starts_with("mcp__avis__") || h.starts_with("Read") || h.starts_with("Glob") || h.starts_with("Grep")), "{herr:?}");
    }
    chat.apagar();
    borrar(&carpeta);
    println!("carpeta de la prueba (no se borra): {}", base.display());
}
