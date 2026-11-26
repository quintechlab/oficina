// Tests de historial.rs (#22, docs/diseno/chat-avis-ux.md 9.1 y 14.2.7): escribir y leer de nuevo,
// un archivo roto que se salta (y nunca se borra), listar en orden y con tope, borrar, y guardar dos
// veces a la vez sin romper el archivo.
use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, SystemTime};

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-historial-test-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

fn charla(id: &str, titulo: &str) -> Value {
    json!({
        "v": 1, "id": id, "titulo": titulo, "creada": "2026-11-24T12:00:00.000Z", "actualizada": "2026-11-24T12:05:00.000Z",
        "motor": "claude", "carpeta": "C:\\Desktop\\catalogo", "sesionClaude": "0a1b2c3d-0000-4000-8000-000000000000",
        "mensajes": [
            { "rol": "usuario", "texto": "¿En qué anda cada sesión?", "cuando": "2026-11-24T12:00:00.000Z", "estado": "ok",
              "adjuntos": [{ "nombre": "presupuesto-2027.pdf", "tipo": "pdf", "bytes": 1468006, "paginas": 14 }] },
            { "rol": "mascota", "texto": "Todo tranquilo.", "cuando": "2026-11-24T12:00:02.000Z", "estado": "ok",
              "herramientas": [{ "nombre": "Read", "detalle": "README.md" }], "ms": 1800, "avis": true },
        ],
    })
}

fn modificado(ruta: &Path, hace_segundos: u64) {
    let f = fs::OpenOptions::new().write(true).open(ruta).unwrap();
    f.set_modified(SystemTime::now() - Duration::from_secs(hace_segundos)).unwrap();
}

// ---------------------------------------------------------------- ids y rutas

#[test]
fn solo_ids_de_charla_c_guion_y_sin_rutas() {
    assert!(id_valido("c-0a1b2c3d-0000-4000-8000-000000000000"));
    assert!(id_valido("c-abc_1"));
    for malo in ["", "ajustes", "c-", "c-../x", "c-a b", "c-a\\b", "x-123", &format!("c-{}", "a".repeat(200))] {
        assert!(!id_valido(malo), "{malo:?}");
    }
    let c = PathBuf::from("C:\\config\\chat");
    assert_eq!(ruta(&c, "c-1"), Some(c.join("c-1.json")));
    assert_eq!(ruta(&c, "../c-1"), None);
}

// ---------------------------------------------------------------- escribir y leer

#[test]
fn guardar_y_leer_de_nuevo_da_lo_mismo() {
    let c = carpeta_temporal();
    let doc = charla("c-1", "¿En qué anda cada sesión");
    guardar(&c, &doc).unwrap();
    let leido = leer(&c, "c-1").unwrap();
    let mut esperado = doc.clone();
    esperado["engramId"] = Value::Null;
    assert_eq!(leido, esperado);
    // Escritura atómica: no queda ningún temporal
    let sobras: Vec<_> = fs::read_dir(&c).unwrap().filter_map(Result::ok).filter(|e| e.file_name().to_string_lossy().ends_with(".tmp")).collect();
    assert!(sobras.is_empty());
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn los_adjuntos_quedan_solo_con_nombre_y_tamano_y_lo_desconocido_no_se_guarda() {
    // D23: ni la ruta ni los bytes del archivo; tampoco campos que no son del formato (9.1)
    let c = carpeta_temporal();
    let mut doc = charla("c-1", "Presupuesto");
    doc["mensajes"][0]["adjuntos"][0]["ruta"] = json!("C:\\Users\\x\\presupuesto-2027.pdf");
    doc["mensajes"][0]["rutas"] = json!([{ "ruta": "C:\\Users\\x\\presupuesto-2027.pdf" }]);
    doc["mensajes"][0]["turno"] = json!(3);
    doc["otra"] = json!("cosa");
    guardar(&c, &doc).unwrap();
    let texto = fs::read_to_string(ruta(&c, "c-1").unwrap()).unwrap();
    assert!(!texto.contains("C:\\\\Users"), "{texto}");
    assert!(!texto.contains("turno") && !texto.contains("otra"));
    let leido = leer(&c, "c-1").unwrap();
    assert_eq!(leido["mensajes"][0]["adjuntos"], json!([{ "nombre": "presupuesto-2027.pdf", "tipo": "pdf", "bytes": 1468006, "paginas": 14 }]));
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn guardar_rechaza_lo_que_no_es_una_charla() {
    let c = carpeta_temporal();
    let mut malos = vec![json!(null), json!({ "v": 1 })];
    let mut d = charla("c-1", "x");
    d["v"] = json!(2);
    malos.push(d);
    let mut d = charla("../c-1", "x");
    malos.push(d.take());
    let mut d = charla("c-1", "x");
    d["motor"] = json!("bash");
    malos.push(d);
    let mut d = charla("c-1", "x");
    d["sesionClaude"] = json!("no-es-un-uuid");
    malos.push(d);
    let mut d = charla("c-1", "x");
    d["mensajes"][0]["rol"] = json!("sistema");
    malos.push(d);
    let mut d = charla("c-1", "x");
    d["mensajes"][1]["estado"] = json!("escribiendo");
    malos.push(d);
    let mut d = charla("c-1", "x");
    d["mensajes"][0]["adjuntos"] = json!(vec![json!({ "nombre": "a.pdf", "tipo": "pdf", "bytes": 1 }); 6]);
    malos.push(d);
    for d in &malos {
        assert!(guardar(&c, d).is_err(), "{d}");
    }
    assert_eq!(fs::read_dir(&c).unwrap().count(), 0);
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn el_motor_local_no_tiene_carpeta() {
    let c = carpeta_temporal();
    let mut d = charla("c-1", "x");
    d["motor"] = json!("local");
    d["sesionClaude"] = Value::Null;
    guardar(&c, &d).unwrap();
    assert_eq!(leer(&c, "c-1").unwrap()["carpeta"], Value::Null);
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn el_motor_local_no_guarda_modelo() {
    // #35: el modelo es de Claude Code; el motor local es uno solo (S4), como la carpeta
    let c = carpeta_temporal();
    let mut d = charla("c-1", "x");
    d["motor"] = json!("local");
    d["sesionClaude"] = Value::Null;
    d["modelo"] = json!("sonnet");
    guardar(&c, &d).unwrap();
    assert!(leer(&c, "c-1").unwrap().get("modelo").is_none());
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn el_modelo_de_la_charla_se_guarda_si_es_uno_de_los_cuatro() {
    // #35: `modelo` es opcional; sin él (o desconocido) es "Por defecto"
    let c = carpeta_temporal();
    for m in chat::MODELOS {
        let mut d = charla("c-1", "x");
        d["modelo"] = json!(m);
        assert_eq!(guardar(&c, &d).unwrap()["modelo"], json!(m));
        assert_eq!(leer(&c, "c-1").unwrap()["modelo"], json!(m));
    }
    for malo in [json!("gpt-4"), json!("Sonnet"), json!(""), json!(3), json!(["opus"]), Value::Null] {
        let mut d = charla("c-1", "x");
        d["modelo"] = malo.clone();
        guardar(&c, &d).unwrap();
        let leido = leer(&c, "c-1").unwrap();
        assert!(leido.get("modelo").is_none(), "{malo}: {leido}");
        let texto = fs::read_to_string(ruta(&c, "c-1").unwrap()).unwrap();
        assert!(!texto.contains("modelo"), "{texto}");
    }
    // Un archivo escrito a mano con un modelo desconocido se lee igual, sin el modelo
    let mut d = charla("c-1", "x");
    d["engramId"] = Value::Null;
    d["modelo"] = json!("claude-sonnet-9");
    fs::write(ruta(&c, "c-1").unwrap(), d.to_string()).unwrap();
    assert!(leer(&c, "c-1").unwrap().get("modelo").is_none());
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn una_charla_de_antes_sin_modelo_se_lee_como_antes() {
    let c = carpeta_temporal();
    let doc = charla("c-1", "De antes");
    fs::write(ruta(&c, "c-1").unwrap(), doc.to_string()).unwrap();
    let mut esperado = doc.clone();
    esperado["engramId"] = Value::Null;
    assert_eq!(leer(&c, "c-1").unwrap(), esperado);
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn guardar_conserva_el_engram_id_que_ya_tenia() {
    // La ventana no conoce el id de Engram: lo pone Rust (9.2) y un guardado nuevo no lo pierde
    let c = carpeta_temporal();
    guardar(&c, &charla("c-1", "x")).unwrap();
    poner_engram(&c, "c-1", 123).unwrap();
    let mut d = charla("c-1", "x");
    d["engramId"] = json!(999);
    guardar(&c, &d).unwrap();
    assert_eq!(leer(&c, "c-1").unwrap()["engramId"], json!(123));
    // Sin el archivo, poner el id no lo crea
    assert!(poner_engram(&c, "c-2", 5).is_err());
    assert!(!c.join("c-2.json").exists());
    let _ = fs::remove_dir_all(&c);
}

// ---------------------------------------------------------------- listar

#[test]
fn listar_de_la_mas_nueva_a_la_mas_vieja_sin_los_mensajes_y_con_el_texto_para_buscar() {
    let c = carpeta_temporal();
    for (k, id) in ["c-a", "c-b", "c-c"].iter().enumerate() {
        guardar(&c, &charla(id, id)).unwrap();
        modificado(&c.join(format!("{id}.json")), 100 - k as u64 * 10);
    }
    // Lo que no es una charla en la misma carpeta (ajustes.json, la carpeta de trabajo) no aparece
    fs::write(c.join("ajustes.json"), "{}").unwrap();
    fs::create_dir_all(c.join("trabajo")).unwrap();
    let lista = listar(&c);
    assert_eq!(lista.iter().map(|x| x["id"].as_str().unwrap()).collect::<Vec<_>>(), ["c-c", "c-b", "c-a"]);
    let x = &lista[0];
    assert!(x.get("mensajes").is_none());
    assert_eq!(x["titulo"], "c-c");
    assert_eq!(x["motor"], "claude");
    assert_eq!(x["carpeta"], "C:\\Desktop\\catalogo");
    assert_eq!(x["actualizada"], "2026-11-24T12:05:00.000Z");
    assert_eq!(x["texto"], "¿En qué anda cada sesión?\nTodo tranquilo.");
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn listar_con_tope_de_100_y_el_texto_para_buscar_con_tope() {
    let c = carpeta_temporal();
    for k in 0..105 {
        let id = format!("c-{k}");
        let mut d = charla(&id, &id);
        if k == 104 {
            d["mensajes"][1]["texto"] = json!("x".repeat(TOPE_TEXTO_BUSCAR + 500));
        }
        guardar(&c, &d).unwrap();
        modificado(&c.join(format!("{id}.json")), 1000 - k as u64);
    }
    let lista = listar(&c);
    assert_eq!(lista.len(), TOPE_LISTA);
    assert_eq!(lista[0]["id"], "c-104");
    assert_eq!(lista[99]["id"], "c-5");
    assert!(lista[0]["texto"].as_str().unwrap().len() <= TOPE_TEXTO_BUSCAR);
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn un_archivo_roto_se_salta_y_nunca_se_borra_solo() {
    let c = carpeta_temporal();
    guardar(&c, &charla("c-bien", "bien")).unwrap();
    fs::write(c.join("c-roto.json"), "{ esto no es json").unwrap();
    fs::write(c.join("c-otro.json"), "{\"v\":1,\"id\":\"c-otro\"}").unwrap();
    let lista = listar(&c);
    assert_eq!(lista.iter().map(|x| x["id"].as_str().unwrap()).collect::<Vec<_>>(), ["c-bien"]);
    assert!(leer(&c, "c-roto").is_err());
    assert!(c.join("c-roto.json").exists());
    assert!(c.join("c-otro.json").exists());
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn listar_sin_carpeta_es_una_lista_vacia() {
    let c = std::env::temp_dir().join(format!("avis-historial-no-existe-{}", std::process::id()));
    assert!(listar(&c).is_empty());
}

// ---------------------------------------------------------------- borrar

#[test]
fn borrar_quita_el_archivo_y_devuelve_el_id_de_engram() {
    let c = carpeta_temporal();
    guardar(&c, &charla("c-1", "x")).unwrap();
    guardar(&c, &charla("c-2", "y")).unwrap();
    poner_engram(&c, "c-1", 42).unwrap();
    assert_eq!(borrar(&c, "c-1").unwrap(), Some(42));
    assert!(!c.join("c-1.json").exists());
    assert_eq!(borrar(&c, "c-2").unwrap(), None);
    // Lo que no existe: no es un error (ya está borrado); un id inválido sí
    assert_eq!(borrar(&c, "c-1").unwrap(), None);
    assert!(borrar(&c, "../c-1").is_err());
    assert!(listar(&c).is_empty());
    let _ = fs::remove_dir_all(&c);
}

// ---------------------------------------------------------------- configuración, pestaña Datos (#23, E5)

#[test]
fn contar_suma_todas_las_charlas_y_sus_bytes_sin_tope_y_solo_las_de_avis() {
    let c = carpeta_temporal();
    for i in 0..(TOPE_LISTA + 3) {
        guardar(&c, &charla(&format!("c-{i}"), "x")).unwrap();
    }
    // Una rota también es una charla guardada (ocupa lugar y "Borrar todo" la borra)
    fs::write(c.join("c-roto.json"), "{ esto no es json").unwrap();
    // Lo que no es una charla de Avis no cuenta
    fs::write(c.join("notas.txt"), "hola").unwrap();
    fs::write(c.join("otro.json"), "{}").unwrap();
    fs::create_dir_all(c.join("c-carpeta.json")).unwrap();
    let esperados: u64 = fs::read_dir(&c)
        .unwrap()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().unwrap().is_file())
        .filter(|e| e.file_name().to_string_lossy().starts_with("c-"))
        .map(|e| e.metadata().unwrap().len())
        .sum();
    assert_eq!(contar(&c), (TOPE_LISTA + 4, esperados));
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn contar_sin_carpeta_es_cero() {
    let c = std::env::temp_dir().join(format!("avis-historial-contar-no-existe-{}", std::process::id()));
    assert_eq!(contar(&c), (0, 0));
}

#[test]
fn borrar_todo_borra_cada_charla_y_junta_los_ids_de_engram() {
    let c = carpeta_temporal();
    guardar(&c, &charla("c-1", "x")).unwrap();
    guardar(&c, &charla("c-2", "y")).unwrap();
    guardar(&c, &charla("c-3", "z")).unwrap();
    poner_engram(&c, "c-1", 42).unwrap();
    poner_engram(&c, "c-3", 7).unwrap();
    fs::write(c.join("c-roto.json"), "{ esto no es json").unwrap();
    fs::write(c.join("notas.txt"), "hola").unwrap();
    let r = borrar_todo(&c);
    assert_eq!(r.borradas, 4);
    assert_eq!(r.fallidas, 0);
    let mut engram = r.engram.clone();
    engram.sort_unstable();
    assert_eq!(engram, [7, 42]);
    assert_eq!(contar(&c), (0, 0));
    // Lo que no es de Avis queda
    assert!(c.join("notas.txt").exists());
    // Sin nada que borrar: cero, sin error
    let r = borrar_todo(&c);
    assert_eq!((r.borradas, r.fallidas, r.engram.len()), (0, 0, 0));
    let _ = fs::remove_dir_all(&c);
}

// ---------------------------------------------------------------- a la vez

#[test]
fn guardar_dos_veces_a_la_vez_no_rompe_el_archivo() {
    let c = carpeta_temporal();
    let hilos: Vec<_> = (0..8)
        .map(|k| {
            let c = c.clone();
            std::thread::spawn(move || {
                for n in 0..10 {
                    let mut d = charla("c-1", &format!("hilo {k} vuelta {n}"));
                    d["mensajes"][1]["texto"] = json!("y".repeat(20_000 + k * 100 + n));
                    guardar(&c, &d).unwrap();
                }
            })
        })
        .collect();
    for h in hilos {
        h.join().unwrap();
    }
    let leido = leer(&c, "c-1").unwrap();
    assert!(leido["titulo"].as_str().unwrap().starts_with("hilo "));
    let nombres: Vec<String> = fs::read_dir(&c).unwrap().filter_map(Result::ok).map(|e| e.file_name().to_string_lossy().into_owned()).collect();
    assert_eq!(nombres, ["c-1.json"]);
    let _ = fs::remove_dir_all(&c);
}

// ---------------------------------------------------------------- #43: los cambios de la charla (11.8)

fn cambio_crear() -> Value {
    json!({
        "id": "c-7k2m9q", "herramienta": "tarea_crear", "estado": "hecho", "lista": "l-k3f9a2", "tarea": "t-9x2b7q",
        "titulo": "Comprar pan", "antes": null,
        "despues": { "titulo": "Comprar pan", "fecha": "2026-11-26", "hecha": false, "importante": false, "lista": "l-k3f9a2" },
        "motivo": null, "reintentable": false, "args": null,
    })
}

fn con_cambios(cambios: Value) -> Value {
    let mut doc = charla("c-1", "Pan");
    doc["mensajes"][1]["cambios"] = cambios;
    doc
}

#[test]
fn los_cambios_validos_sobreviven_a_normalizar() {
    let error = json!({
        "id": "c-err1", "herramienta": "tarea_crear", "estado": "error", "lista": null, "tarea": null, "titulo": "Llamar",
        "antes": null, "despues": null, "motivo": "No se pudo guardar. No cambió nada.", "reintentable": true,
        "args": { "titulo": "Llamar", "fecha": "mañana" },
    });
    let lectura = json!({
        "id": "c-lee1", "herramienta": "tareas_ver", "estado": "lectura", "lista": null, "tarea": null, "titulo": null,
        "antes": null, "despues": null, "motivo": null, "reintentable": false, "args": null,
        "resumen": { "vista": "hoy", "nombre": null, "hoy": "2026-11-25", "hechas": 1, "total": 2, "mas": 0,
            "filas": [{ "tarea": "t-1", "lista": "l-k3f9a2", "titulo": "Pan", "fecha": "2026-11-25", "hecha": true, "importante": false }] },
    });
    let doc = con_cambios(json!([cambio_crear(), error, lectura]));
    let n = normalizar(&doc).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"], doc["mensajes"][1]["cambios"]);
    // Y se guarda y se lee igual
    let c = carpeta_temporal();
    guardar(&c, &doc).unwrap();
    assert_eq!(leer(&c, "c-1").unwrap()["mensajes"][1]["cambios"], doc["mensajes"][1]["cambios"]);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn la_lista_nueva_de_un_cambio_se_guarda_y_una_que_no_sirve_se_descarta() {
    // La lista que armó la charla sin listas (25/11): `{ nombre, color }` para el «· nueva» del recibo
    let mut nueva = cambio_crear();
    nueva["listaNueva"] = json!({ "nombre": "Tareas", "color": "celeste" });
    let n = normalizar(&con_cambios(json!([nueva.clone()]))).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"], json!([nueva]));
    // Un color que no es de la lista o un nombre largo: el cambio queda, sin la marca
    for mala in [json!({ "nombre": "Tareas", "color": "fucsia" }), json!({ "nombre": "x".repeat(101), "color": "celeste" }), json!(true)] {
        let mut c = cambio_crear();
        c["listaNueva"] = mala;
        assert_eq!(normalizar(&con_cambios(json!([c]))).unwrap()["mensajes"][1]["cambios"], json!([cambio_crear()]));
    }
}

#[test]
fn un_cambio_invalido_se_descarta_sin_rechazar_la_charla() {
    let mut desconocido = cambio_crear();
    desconocido["estado"] = json!("rehecho");
    let mut con_ruta = cambio_crear();
    con_ruta["tarea"] = json!("t-../x");
    con_ruta["id"] = json!("c-otro");
    let mut otra_herramienta = cambio_crear();
    otra_herramienta["herramienta"] = json!("tarea_borrar");
    let n = normalizar(&con_cambios(json!([desconocido, cambio_crear(), con_ruta, otra_herramienta, "x"]))).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"], json!([cambio_crear()]));
}

#[test]
fn lo_desconocido_de_un_cambio_no_se_guarda() {
    let mut c = cambio_crear();
    c["inventado"] = json!(1);
    c["despues"]["ruta"] = json!("C:/x");
    let n = normalizar(&con_cambios(json!([c]))).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"], json!([cambio_crear()]));
}

#[test]
fn los_cambios_tienen_tope() {
    let muchos: Vec<Value> = (0..30).map(|k| { let mut c = cambio_crear(); c["id"] = json!(format!("c-{k}")); c }).collect();
    let n = normalizar(&con_cambios(json!(muchos))).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"].as_array().unwrap().len(), 20);
}

#[test]
fn una_charla_vieja_sin_cambios_se_lee_igual() {
    let doc = charla("c-1", "Vieja");
    let n = normalizar(&doc).unwrap();
    assert_eq!(n["mensajes"][1].get("cambios"), None);
    assert_eq!(n["mensajes"], doc["mensajes"]);
}

// ---------------------------------------------------------------- #43 C3: los cambios de hábitos

fn cambio_marcar() -> Value {
    json!({
        "id": "c-hab1", "herramienta": "habito_marcar", "estado": "hecho", "lista": null, "tarea": null, "habito": "h-agua",
        "titulo": "Agua", "antes": { "dia": "2026-11-25", "valor": 2 }, "despues": { "dia": "2026-11-25", "valor": 3 },
        "marca": { "tipo": "cantidad", "meta": 8, "unidad": "vasos", "color": "celeste" },
        "motivo": null, "reintentable": false, "args": null,
    })
}

#[test]
fn un_cambio_de_habito_y_su_lectura_sobreviven_a_normalizar() {
    let error = json!({
        "id": "c-herr", "herramienta": "habito_marcar", "estado": "error", "lista": null, "tarea": null, "habito": "h-agua", "titulo": "Agua",
        "antes": null, "despues": null, "motivo": "Solo se marcan los hábitos de hoy.", "reintentable": false,
        "args": { "id": "h-agua", "sumar": -2, "dia": "2026-11-25" },
    });
    let lectura = json!({
        "id": "c-hlee", "herramienta": "habitos_ver", "estado": "lectura", "lista": null, "tarea": null, "titulo": null,
        "antes": null, "despues": null, "motivo": null, "reintentable": false, "args": null,
        "resumen": { "vista": "habitos", "hoy": "2026-11-25", "hechas": 1, "total": 2, "mas": 0,
            "habitos": [
                { "habito": "h-agua", "nombre": "Agua", "tipo": "cantidad", "meta": 8, "valor": 3, "hecho": false, "color": "celeste" },
                { "habito": "h-caminar", "nombre": "Caminar", "tipo": "diario", "meta": 1, "valor": 1, "hecho": true, "color": "verde" },
            ] },
    });
    let doc = con_cambios(json!([cambio_marcar(), error, lectura]));
    let n = normalizar(&doc).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"], doc["mensajes"][1]["cambios"]);
}

#[test]
fn un_cambio_de_habito_que_no_sirve_se_descarta() {
    let mut malos = Vec::new();
    for (k, v) in [
        ("habito", json!("h-../x")),
        ("habito", json!(null)),
        ("habito", json!("t-agua")),
        ("antes", json!({ "dia": "ayer", "valor": 2 })),
        ("despues", json!({ "dia": "2026-11-25", "valor": 1000 })),
        ("despues", json!({ "dia": "2026-11-25", "valor": -1 })),
    ] {
        let mut c = cambio_marcar();
        c[k] = v;
        malos.push(c);
    }
    let n = normalizar(&con_cambios(json!(malos))).unwrap();
    assert_eq!(n["mensajes"][1].get("cambios"), None);
    // Una marca que no sirve: el cambio queda, sin la marca
    let mut sin_marca = cambio_marcar();
    sin_marca["marca"] = json!({ "tipo": "raro", "meta": 8, "unidad": "vasos", "color": "celeste" });
    let n = normalizar(&con_cambios(json!([sin_marca]))).unwrap();
    let mut esperado = cambio_marcar();
    esperado.as_object_mut().unwrap().remove("marca");
    assert_eq!(n["mensajes"][1]["cambios"], json!([esperado]));
}

#[test]
fn un_cambio_de_tareas_no_suma_claves_de_habitos() {
    // Lo de antes: un cambio de tareas se guarda igual que en C1 (sin `habito` ni `marca`)
    let n = normalizar(&con_cambios(json!([cambio_crear()]))).unwrap();
    assert_eq!(n["mensajes"][1]["cambios"], json!([cambio_crear()]));
    let mut con_habito = cambio_crear();
    con_habito["habito"] = json!("h-agua");
    assert_eq!(normalizar(&con_cambios(json!([con_habito]))).unwrap()["mensajes"][1]["cambios"], json!([cambio_crear()]));
}
