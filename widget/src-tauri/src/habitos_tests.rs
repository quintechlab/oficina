// Tests de habitos.rs (#41, docs/diseno/habitos-ux.md 11.1, 11.5 y 11.6): ida y vuelta del formato
// v1, topes que recortan (también el registro de más de 2000 días, sin bajar `mejor`), lo que no
// sirve se rechaza sin tocar el archivo, las claves desconocidas del archivo se conservan y las de la
// ventana no se escriben, un archivo roto no se pisa ni se borra y va en `rotas`, y los ids nunca son rutas.
use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-habitos-test-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

fn habito(id: &str, nombre: &str) -> Value {
    json!({
        "v": 1, "id": id, "nombre": nombre, "tipo": "cantidad", "meta": 8, "unidad": "vasos", "dias": [], "veces": 1,
        "aviso": "16:00", "color": "verde", "orden": 0, "creado": 1_764_100_000_000u64, "inicio": "2026-11-02", "mejor": 21,
        "registro": { "2026-11-23": 8, "2026-11-24": 6 },
    })
}

#[test]
fn guardar_y_leer_devuelve_el_formato_v1() {
    let c = carpeta_temporal();
    let g = guardar(&c, &habito("h-agua", "Agua")).unwrap();
    let l = listar(&c);
    assert!(l.rotas.is_empty());
    assert_eq!(l.habitos, vec![g.clone()]);
    assert_eq!(g, habito("h-agua", "Agua"));
    assert!(fs::read_dir(&c).unwrap().filter_map(Result::ok).all(|e| !e.file_name().to_string_lossy().ends_with(".tmp")));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn un_habito_minimo_toma_los_valores_por_defecto() {
    let c = carpeta_temporal();
    let g = guardar(&c, &json!({ "v": 1, "id": "h-x", "nombre": " Caminar ", "tipo": "diario" })).unwrap();
    assert_eq!(g, json!({
        "v": 1, "id": "h-x", "nombre": "Caminar", "tipo": "diario", "meta": 1, "unidad": "", "dias": [], "veces": 1,
        "aviso": null, "color": "celeste", "orden": 0, "creado": null, "inicio": null, "mejor": 0, "registro": {},
    }));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn los_dias_se_ordenan_sin_repetir_y_los_ceros_del_registro_no_se_guardan() {
    let c = carpeta_temporal();
    let mut d = habito("h-gym", "Gimnasio");
    d["tipo"] = json!("dias");
    d["dias"] = json!([4, 0, 2, 0]);
    d["registro"] = json!({ "2026-11-23": 1, "2026-11-24": 0 });
    let g = guardar(&c, &d).unwrap();
    assert_eq!(g["dias"], json!([0, 2, 4]));
    assert_eq!(g["registro"], json!({ "2026-11-23": 1 }));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn lo_que_no_es_del_formato_se_rechaza_sin_tocar_el_archivo() {
    let c = carpeta_temporal();
    guardar(&c, &habito("h-agua", "Agua")).unwrap();
    let antes = fs::read(c.join("h-agua.json")).unwrap();
    let malas: Vec<(&str, Box<dyn Fn(&mut Value)>)> = vec![
        ("versión", Box::new(|d| d["v"] = json!(2))),
        ("nombre vacío", Box::new(|d| d["nombre"] = json!("  "))),
        ("tipo desconocido", Box::new(|d| d["tipo"] = json!("mensual"))),
        ("meta 0", Box::new(|d| d["meta"] = json!(0))),
        ("meta 100", Box::new(|d| d["meta"] = json!(100))),
        ("veces 7", Box::new(|d| d["veces"] = json!(7))),
        ("día 7", Box::new(|d| d["dias"] = json!([7]))),
        ("algunos días sin días", Box::new(|d| { d["tipo"] = json!("dias"); d["dias"] = json!([]) })),
        ("aviso 24:00", Box::new(|d| d["aviso"] = json!("24:00"))),
        ("aviso sin cero", Box::new(|d| d["aviso"] = json!("9:30"))),
        ("inicio imposible", Box::new(|d| d["inicio"] = json!("2026-02-30"))),
        ("fecha del registro imposible", Box::new(|d| d["registro"] = json!({ "2026-02-30": 1 }))),
        ("cantidad negativa", Box::new(|d| d["registro"] = json!({ "2026-11-23": -1 }))),
        ("registro no es un objeto", Box::new(|d| d["registro"] = json!([1, 2]))),
        ("id con ruta", Box::new(|d| d["id"] = json!("h-../x"))),
    ];
    for (nombre, romper) in malas {
        let mut d = habito("h-agua", "Agua");
        romper(&mut d);
        assert!(guardar(&c, &d).is_err(), "{nombre}");
        assert_eq!(fs::read(c.join("h-agua.json")).unwrap(), antes, "{nombre}");
    }
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn los_topes_recortan_y_el_registro_largo_no_baja_mejor() {
    let c = carpeta_temporal();
    let mut d = habito("h-agua", &"n".repeat(45));
    d["unidad"] = json!("u".repeat(20));
    let mut registro = serde_json::Map::new();
    let primero = chrono::NaiveDate::from_ymd_opt(2020, 1, 1).unwrap();
    for k in 0..2_100 {
        registro.insert((primero + chrono::Days::new(k)).format("%Y-%m-%d").to_string(), json!(1));
    }
    registro.insert(String::from("2026-11-24"), json!(5_000));
    d["registro"] = Value::Object(registro);
    d["mejor"] = json!(300);
    let g = guardar(&c, &d).unwrap();
    assert_eq!(g["nombre"].as_str().unwrap().chars().count(), 40);
    assert_eq!(g["unidad"].as_str().unwrap().chars().count(), 16);
    let r = g["registro"].as_object().unwrap();
    assert_eq!(r.len(), 2_000);
    // Se van los más viejos
    assert!(!r.contains_key("2020-01-01"));
    assert_eq!(r["2026-11-24"], 999);
    assert_eq!(g["mejor"], 300);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn un_campo_desconocido_del_archivo_sobrevive_y_el_de_la_ventana_no() {
    let c = carpeta_temporal();
    let mut futuro = habito("h-agua", "Agua");
    futuro["icono"] = json!("gota");
    fs::write(c.join("h-agua.json"), serde_json::to_vec(&futuro).unwrap()).unwrap();
    let mut de_la_ventana = habito("h-agua", "Agua fría");
    de_la_ventana["inventado"] = json!(1);
    let g = guardar(&c, &de_la_ventana).unwrap();
    assert_eq!(g["nombre"], "Agua fría");
    assert_eq!(g["icono"], "gota");
    assert_eq!(g.get("inventado"), None);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn los_ids_nunca_son_rutas() {
    for bueno in ["h-agua", "h-k3f9a2", &format!("h-{}", "a".repeat(38))] {
        assert!(id_valido(bueno), "{bueno}");
    }
    for malo in ["", "h-", "agua", "h-../x", "h-a/b", "h-a\\b", "h-Agua", "l-agua", "con", "h-a.b", &format!("h-{}", "a".repeat(39))] {
        assert!(!id_valido(malo), "{malo}");
    }
}

#[test]
fn un_archivo_roto_se_informa_y_queda_igual() {
    let c = carpeta_temporal();
    guardar(&c, &habito("h-agua", "Agua")).unwrap();
    fs::write(c.join("h-roto.json"), "{ no es json").unwrap();
    fs::write(c.join("notas.txt"), "hola").unwrap();
    let antes = fs::read(c.join("h-roto.json")).unwrap();
    let l = listar(&c);
    assert_eq!(l.habitos.len(), 1);
    assert_eq!(l.rotas.len(), 1);
    assert_eq!(l.rotas[0]["archivo"], "h-roto.json");
    assert!(guardar(&c, &habito("h-roto", "Roto")).is_err());
    assert!(borrar(&c, "h-roto").is_err());
    assert_eq!(fs::read(c.join("h-roto.json")).unwrap(), antes);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn borrar_y_listar_en_orden() {
    let c = carpeta_temporal();
    let mut leer = habito("h-leer", "Leer");
    leer["orden"] = json!(1);
    let mut correr = habito("h-correr", "Correr");
    correr["orden"] = json!(1);
    correr["creado"] = json!(1_764_000_000_000u64);
    guardar(&c, &leer).unwrap();
    guardar(&c, &correr).unwrap();
    guardar(&c, &habito("h-agua", "Agua")).unwrap();
    let nombres: Vec<String> = listar(&c).habitos.iter().map(|h| h["nombre"].as_str().unwrap().to_string()).collect();
    assert_eq!(nombres, ["Agua", "Correr", "Leer"]);
    borrar(&c, "h-leer").unwrap();
    borrar(&c, "h-leer").unwrap();
    assert!(borrar(&c, "h-../agua").is_err());
    assert_eq!(listar(&c).habitos.len(), 2);
    assert!(listar(&c.join("no-existe")).habitos.is_empty());
    fs::remove_dir_all(c).unwrap();
}


// ---------------------------------------------------------------- la frase del resumen (H3: 8.4 y 11.7)

use crate::chat_local::{MotorLocal, UsoMotor};
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Arc;
use std::time::{Duration, Instant};

fn datos_semana() -> Value {
    json!({ "habitos": [
        { "nombre": "Caminar", "tipo": "diario", "hechos": 5, "tocaban": 7 },
        { "nombre": "Agua", "tipo": "cantidad", "hechos": 3, "tocaban": 7 },
        { "nombre": "Gimnasio", "tipo": "dias", "hechos": 2, "tocaban": 3 },
        { "nombre": "Correr", "tipo": "semana", "hechos": 3, "tocaban": 3 },
    ] })
}

struct UsoFalso;
impl UsoMotor for UsoFalso {
    fn diagnostico(&self) -> Option<String> {
        None
    }
}

/// Un motor falso que da `puerto` y cuenta cuántas veces lo prendieron.
fn motor_falso(puerto: u16, prendido: Arc<AtomicUsize>) -> MotorLocal {
    Arc::new(move || {
        prendido.fetch_add(1, Ordering::SeqCst);
        Ok((puerto, Box::new(UsoFalso) as Box<dyn UsoMotor>))
    })
}

/// Un llama-server falso: atiende un pedido, guarda su cuerpo y, si `lineas` trae algo, responde en SSE;
/// si no, se queda callado (para el tiempo agotado).
fn servidor(lineas: Vec<&'static str>) -> (u16, Arc<std::sync::Mutex<Option<Value>>>) {
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let puerto = l.local_addr().unwrap().port();
    let visto = Arc::new(std::sync::Mutex::new(None));
    let v = visto.clone();
    std::thread::spawn(move || {
        let Ok((mut s, _)) = l.accept() else { return };
        let mut todo = Vec::new();
        let mut buf = [0u8; 4096];
        let cuerpo = loop {
            let n = s.read(&mut buf).unwrap_or(0);
            if n == 0 {
                return;
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
                break todo[fin + 4..].to_vec();
            }
        };
        *v.lock().unwrap() = serde_json::from_slice(&cuerpo).ok();
        if lineas.is_empty() {
            std::thread::sleep(Duration::from_secs(5));
            return;
        }
        let _ = s.write_all(b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n");
        for linea in lineas {
            let _ = s.write_all(format!("{linea}\n\n").as_bytes());
        }
    });
    (puerto, visto)
}

#[test]
fn las_lineas_de_la_frase_salen_de_los_datos_y_lo_que_no_sirve_se_saltea() {
    assert_eq!(
        lineas_frase(&datos_semana()).unwrap(),
        "- Caminar: 5 de 7 días\n- Agua: 3 de 7 días con la meta\n- Gimnasio: 2 de 3 días\n- Correr: 3 de 3 veces"
    );
    let raros = json!({ "habitos": [
        { "nombre": "Leer\nmucho", "tipo": "diario", "hechos": 1, "tocaban": 2 },
        { "nombre": "", "tipo": "diario", "hechos": 1, "tocaban": 2 },
        { "nombre": "Otro", "tipo": "raro", "hechos": 1, "tocaban": 2 },
        { "nombre": "Más", "tipo": "diario", "hechos": 9, "tocaban": 7 },
        { "nombre": "Menos", "tipo": "diario", "hechos": -1, "tocaban": 7 },
        { "nombre": "x".repeat(60), "tipo": "semana", "hechos": 1, "tocaban": 2 },
    ] });
    assert_eq!(lineas_frase(&raros).unwrap(), format!("- Leer mucho: 1 de 2 días\n- {}: 1 de 2 veces", "x".repeat(40)));
    assert!(lineas_frase(&json!({ "habitos": [] })).is_err());
    assert!(lineas_frase(&json!({})).is_err());
}

#[test]
fn el_pedido_de_la_frase_es_uno_solo_sin_historia_con_60_tokens_y_sin_modo_de_pensar() {
    let c = cuerpo_frase("- Caminar: 5 de 7 días");
    assert_eq!(c["max_tokens"], 60);
    assert_eq!(c["stream"], true);
    assert_eq!(c["chat_template_kwargs"]["enable_thinking"], false);
    assert!(c.get("tools").is_none());
    let m = c["messages"].as_array().unwrap();
    assert_eq!(m.len(), 2);
    assert_eq!(m[0]["role"], "system");
    assert_eq!(m[0]["content"], INSTRUCCION_FRASE);
    assert!(INSTRUCCION_FRASE.starts_with("Escribí una o dos oraciones en español rioplatense, de hasta 160 caracteres"));
    assert_eq!(m[1]["role"], "user");
    assert_eq!(m[1]["content"], "- Caminar: 5 de 7 días");
    assert_eq!(TOPE_FRASE, Duration::from_secs(45));
}

#[test]
fn sin_modelo_la_frase_es_un_error_sin_prender_nada() {
    let prendido = Arc::new(AtomicUsize::new(0));
    let r = frase(&datos_semana(), &|| false, motor_falso(9, prendido.clone()), Duration::from_secs(2));
    assert!(r.is_err());
    assert_eq!(prendido.load(Ordering::SeqCst), 0);
    // Sin datos, tampoco se prende
    assert!(frase(&json!({ "habitos": [] }), &|| true, motor_falso(9, prendido.clone()), Duration::from_secs(2)).is_err());
    assert_eq!(prendido.load(Ordering::SeqCst), 0);
}

#[test]
fn con_el_tiempo_agotado_la_frase_es_un_error() {
    let (puerto, _) = servidor(vec![]);
    let prendido = Arc::new(AtomicUsize::new(0));
    let antes = Instant::now();
    let r = frase(&datos_semana(), &|| true, motor_falso(puerto, prendido.clone()), Duration::from_millis(400));
    assert!(r.unwrap_err().contains("tardó"));
    assert!(antes.elapsed() < Duration::from_secs(3));
    assert_eq!(prendido.load(Ordering::SeqCst), 1);
    // Un motor que tarda en arrancar también cuenta en el tope
    let lento: MotorLocal = Arc::new(|| {
        std::thread::sleep(Duration::from_secs(2));
        Err(String::from("no"))
    });
    let antes = Instant::now();
    assert!(frase(&datos_semana(), &|| true, lento, Duration::from_millis(300)).unwrap_err().contains("tardó"));
    assert!(antes.elapsed() < Duration::from_secs(1));
}

#[test]
fn la_frase_es_la_respuesta_del_motor_en_una_linea_y_el_pedido_lleva_los_datos() {
    let (puerto, visto) = servidor(vec![
        r#"data: {"choices":[{"delta":{"role":"assistant"}}]}"#,
        r#"data: {"choices":[{"delta":{"content":" Caminaste 5 de 7 días"}}]}"#,
        r#"data: {"choices":[{"delta":{"content":" y el gimnasio salió completo. "}}]}"#,
        r#"data: {"choices":[{"delta":{},"finish_reason":"stop"}]}"#,
        "data: [DONE]",
    ]);
    let prendido = Arc::new(AtomicUsize::new(0));
    let r = frase(&datos_semana(), &|| true, motor_falso(puerto, prendido), Duration::from_secs(5)).unwrap();
    assert_eq!(r, "Caminaste 5 de 7 días y el gimnasio salió completo.");
    let cuerpo = visto.lock().unwrap().clone().unwrap();
    assert_eq!(cuerpo["max_tokens"], 60);
    assert!(cuerpo["messages"][1]["content"].as_str().unwrap().contains("- Correr: 3 de 3 veces"));
    // Un motor que no arranca: su error
    let roto: MotorLocal = Arc::new(|| Err(String::from("el modelo no arrancó")));
    assert_eq!(frase(&datos_semana(), &|| true, roto, Duration::from_secs(2)).unwrap_err(), "el modelo no arrancó");
}

#[test]
fn si_el_motor_prende_despues_del_tope_no_se_manda_el_pedido() {
    // El motor tarda más que el tope en arrancar: la frase ya venció y el pedido nunca sale
    let l = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    l.set_nonblocking(true).unwrap();
    let puerto = l.local_addr().unwrap().port();
    let lento: MotorLocal = Arc::new(move || {
        std::thread::sleep(Duration::from_millis(500));
        Ok((puerto, Box::new(UsoFalso) as Box<dyn UsoMotor>))
    });
    assert!(frase(&datos_semana(), &|| true, lento, Duration::from_millis(150)).unwrap_err().contains("tardó"));
    std::thread::sleep(Duration::from_millis(900));
    assert!(l.accept().is_err(), "el pedido salió después del corte");
}

// ---------------------------------------------------------------- #43 C3: `modificar` (la charla marca un hábito)

#[test]
fn modificar_lee_cambia_y_escribe_con_el_formato() {
    let c = carpeta_temporal();
    guardar(&c, &habito("h-agua", "Agua")).unwrap();
    let (r, guardado) = modificar(&c, "h-agua", |doc| {
        doc["registro"]["2026-11-25"] = json!(3);
        Ok(7)
    })
    .unwrap();
    assert_eq!(r, 7);
    assert_eq!(guardado["registro"]["2026-11-25"], 3);
    assert_eq!(listar(&c).habitos[0]["registro"], json!({ "2026-11-23": 8, "2026-11-24": 6, "2026-11-25": 3 }));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn modificar_conserva_lo_desconocido_del_archivo() {
    let c = carpeta_temporal();
    let mut futuro = habito("h-agua", "Agua");
    futuro["icono"] = json!("gota");
    fs::write(c.join("h-agua.json"), serde_json::to_vec(&futuro).unwrap()).unwrap();
    modificar(&c, "h-agua", |doc| {
        doc["registro"]["2026-11-25"] = json!(1);
        Ok(())
    })
    .unwrap();
    let crudo: Value = serde_json::from_slice(&fs::read(c.join("h-agua.json")).unwrap()).unwrap();
    assert_eq!(crudo["icono"], "gota");
    assert_eq!(crudo["registro"]["2026-11-25"], 1);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn modificar_no_toca_un_archivo_roto_ni_uno_que_no_esta_ni_lo_que_la_regla_niega() {
    let c = carpeta_temporal();
    guardar(&c, &habito("h-agua", "Agua")).unwrap();
    fs::write(c.join("h-roto.json"), "{ roto").unwrap();
    let roto = fs::read(c.join("h-roto.json")).unwrap();
    let agua = fs::read(c.join("h-agua.json")).unwrap();
    assert!(matches!(modificar(&c, "h-roto", |_| Ok(())), Err(crate::tareas::Falla::Rota)));
    assert!(matches!(modificar(&c, "h-nada", |_| Ok(())), Err(crate::tareas::Falla::NoExiste)));
    assert!(matches!(modificar(&c, "../x", |_| Ok(())), Err(crate::tareas::Falla::NoExiste)));
    assert!(matches!(modificar(&c, "h-agua", |_| Err::<(), _>(String::from("no"))), Err(crate::tareas::Falla::Regla(m)) if m == "no"));
    // Lo que deja la regla tiene que ser un hábito del formato, del mismo id
    assert!(matches!(modificar(&c, "h-agua", |doc| { doc["tipo"] = json!("raro"); Ok(()) }), Err(crate::tareas::Falla::Regla(_))));
    assert!(matches!(modificar(&c, "h-agua", |doc| { doc["id"] = json!("h-otro"); Ok(()) }), Err(crate::tareas::Falla::Regla(_))));
    assert_eq!(fs::read(c.join("h-roto.json")).unwrap(), roto);
    assert_eq!(fs::read(c.join("h-agua.json")).unwrap(), agua);
    assert!(!c.join("h-otro.json").exists());
    fs::remove_dir_all(c).unwrap();
}
