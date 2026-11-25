// Tests de tareas.rs (#39, docs/diseno/tareas-ux.md 11.1, 11.3 y 11.5 punto 13): escribir atómico y
// volver a leer el formato v1, los topes recortan, un campo desconocido del archivo sobrevive, un
// archivo roto se informa y queda igual (ni se pisa ni se borra), y los ids nunca son rutas.
use super::*;
use std::sync::atomic::{AtomicUsize, Ordering};

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-tareas-test-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

fn tarea(id: &str, titulo: &str) -> Value {
    json!({
        "id": id, "titulo": titulo, "hecha": false, "hechaEn": null, "fecha": "2026-11-25", "importante": true,
        "notas": "Pedir el logo en SVG", "subtareas": [{ "id": "s-1", "titulo": "Mandar mail", "hecha": true }],
        "creada": 1_763_800_000_000u64,
    })
}

fn lista(id: &str, nombre: &str, orden: u64) -> Value {
    json!({ "v": 1, "id": id, "nombre": nombre, "color": "verde", "orden": orden, "creada": 1_764_000_000_000u64, "tareas": [tarea("t-1", "Presupuesto Café Molienda")] })
}

fn sin_temporales(c: &Path) -> bool {
    fs::read_dir(c).unwrap().filter_map(Result::ok).all(|e| !e.file_name().to_string_lossy().ends_with(".tmp"))
}

#[test]
fn guardar_y_leer_devuelve_el_formato_v1() {
    let c = carpeta_temporal();
    let guardada = guardar(&c, &lista("l-trabajo", "Trabajo", 0)).unwrap();
    let l = listar(&c);
    assert!(l.rotas.is_empty());
    assert_eq!(l.listas, vec![guardada.clone()]);
    assert_eq!(guardada["color"], "verde");
    assert_eq!(guardada["tareas"][0]["subtareas"][0]["titulo"], "Mandar mail");
    assert_eq!(guardada["tareas"][0]["fecha"], "2026-11-25");
    assert_eq!(guardada["tareas"][0]["creada"], 1_763_800_000_000u64);
    assert!(sin_temporales(&c));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn lo_que_no_es_del_formato_se_rechaza_sin_tocar_el_archivo() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-casa", "Casa", 1)).unwrap();
    let antes = fs::read(c.join("l-casa.json")).unwrap();
    let malas: Vec<(&str, Box<dyn Fn(&mut Value)>)> = vec![
        ("nombre vacío", Box::new(|d| d["nombre"] = json!("   "))),
        ("versión", Box::new(|d| d["v"] = json!(2))),
        ("fecha imposible", Box::new(|d| d["tareas"][0]["fecha"] = json!("2026-02-30"))),
        ("fecha con hora", Box::new(|d| d["tareas"][0]["fecha"] = json!("2026-11-25T10:00"))),
        ("título vacío", Box::new(|d| d["tareas"][0]["titulo"] = json!(""))),
        ("hecha no booleana", Box::new(|d| d["tareas"][0]["hecha"] = json!("si"))),
        ("creada no es un número", Box::new(|d| d["tareas"][0]["creada"] = json!("ayer"))),
        ("id de tarea con ruta", Box::new(|d| d["tareas"][0]["id"] = json!("t-../x"))),
        ("id de tarea repetido", Box::new(|d| { let t = d["tareas"][0].clone(); d["tareas"].as_array_mut().unwrap().push(t) })),
        ("subtarea sin id", Box::new(|d| d["tareas"][0]["subtareas"][0]["id"] = json!(null))),
    ];
    for (nombre, romper) in malas {
        let mut d = lista("l-casa", "Casa", 1);
        romper(&mut d);
        assert!(guardar(&c, &d).is_err(), "{nombre}");
        assert_eq!(fs::read(c.join("l-casa.json")).unwrap(), antes, "{nombre}");
    }
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn los_topes_recortan() {
    // 11.1: nombre 40, título 200, notas 4 000, 50 subtareas de 200
    let c = carpeta_temporal();
    let mut d = lista("l-x", &"n".repeat(45), 0);
    d["tareas"][0]["titulo"] = json!("t".repeat(250));
    d["tareas"][0]["notas"] = json!("ñ".repeat(4_100));
    d["tareas"][0]["subtareas"] = json!((0..60).map(|k| json!({ "id": format!("s-{k}"), "titulo": "s".repeat(300), "hecha": false })).collect::<Vec<_>>());
    let g = guardar(&c, &d).unwrap();
    assert_eq!(g["nombre"].as_str().unwrap().chars().count(), 40);
    assert_eq!(g["tareas"][0]["titulo"].as_str().unwrap().chars().count(), 200);
    assert_eq!(g["tareas"][0]["notas"].as_str().unwrap().chars().count(), 4_000);
    let subs = g["tareas"][0]["subtareas"].as_array().unwrap();
    assert_eq!(subs.len(), 50);
    assert_eq!(subs[0]["titulo"].as_str().unwrap().chars().count(), 200);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn un_color_desconocido_se_lee_como_celeste() {
    let c = carpeta_temporal();
    for (color, esperado) in [("rosa", "rosa"), ("ambar", "ambar"), ("dorado", "celeste")] {
        let mut d = lista("l-x", "X", 0);
        d["color"] = json!(color);
        assert_eq!(guardar(&c, &d).unwrap()["color"], esperado, "{color}");
    }
    let mut d = lista("l-x", "X", 0);
    d.as_object_mut().unwrap().remove("color");
    assert_eq!(guardar(&c, &d).unwrap()["color"], "celeste");
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn un_campo_desconocido_del_archivo_sobrevive_a_guardar() {
    // 11.1: "Campos desconocidos se conservan al reescribir" (los de una versión futura)
    let c = carpeta_temporal();
    let mut futura = lista("l-trabajo", "Trabajo", 0);
    futura["icono"] = json!("maletin");
    futura["tareas"][0]["repetir"] = json!({ "cada": "semana" });
    futura["tareas"][0]["subtareas"][0]["minutos"] = json!(15);
    fs::write(c.join("l-trabajo.json"), serde_json::to_vec(&futura).unwrap()).unwrap();
    // La ventana manda lo que leyó (sin los desconocidos) con un cambio, y alguno suyo propio
    let mut de_la_ventana = lista("l-trabajo", "Laburo", 0);
    de_la_ventana["inventado"] = json!("no");
    let g = guardar(&c, &de_la_ventana).unwrap();
    assert_eq!(g["nombre"], "Laburo");
    assert_eq!(g["icono"], "maletin");
    assert_eq!(g["tareas"][0]["repetir"], json!({ "cada": "semana" }));
    // También en las subtareas (por id)
    assert_eq!(g["tareas"][0]["subtareas"][0]["minutos"], 15);
    assert_eq!(g.get("inventado"), None);
    let en_disco: Value = serde_json::from_slice(&fs::read(c.join("l-trabajo.json")).unwrap()).unwrap();
    assert_eq!(en_disco, g);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn los_ids_nunca_son_rutas() {
    for bueno in ["l-trabajo", "l-k3f9a2", &format!("l-{}", "a".repeat(38))] {
        assert!(id_valido(bueno), "{bueno}");
    }
    for malo in ["", "l-", "trabajo", "l-../x", "l-a/b", "l-a\\b", "l-Casa", "c-123", "con", "CON", "l-a.b", &format!("l-{}", "a".repeat(39))] {
        assert!(!id_valido(malo), "{malo}");
    }
}

#[test]
fn un_archivo_roto_se_informa_y_queda_igual() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-trabajo", "Trabajo", 0)).unwrap();
    fs::write(c.join("l-rota.json"), "{ esto no es json").unwrap();
    let mut ajena = lista("l-otra", "Otra", 2);
    ajena["id"] = json!("l-distinta");
    fs::write(c.join("l-otra.json"), serde_json::to_vec(&ajena).unwrap()).unwrap();
    fs::write(c.join("notas.txt"), "hola").unwrap();
    let rota_antes = fs::read(c.join("l-rota.json")).unwrap();
    let l = listar(&c);
    assert_eq!(l.listas.len(), 1);
    let archivos: Vec<&str> = l.rotas.iter().map(|r| r["archivo"].as_str().unwrap()).collect();
    assert_eq!(archivos, ["l-otra.json", "l-rota.json"]);
    assert!(l.rotas.iter().all(|r| !r["motivo"].as_str().unwrap().is_empty()));
    // Nunca se pisa ni se borra
    assert!(guardar(&c, &lista("l-rota", "Rota", 3)).is_err());
    assert!(borrar(&c, "l-rota").is_err());
    assert_eq!(fs::read(c.join("l-rota.json")).unwrap(), rota_antes);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn borrar_saca_solo_la_lista_pedida() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-trabajo", "Trabajo", 0)).unwrap();
    guardar(&c, &lista("l-casa", "Casa", 1)).unwrap();
    borrar(&c, "l-casa").unwrap();
    assert!(!c.join("l-casa.json").exists());
    assert!(c.join("l-trabajo.json").exists());
    // Lo que ya no está no es un error; un id con ruta, sí
    borrar(&c, "l-casa").unwrap();
    assert!(borrar(&c, "l-../trabajo").is_err());
    assert!(c.join("l-trabajo.json").exists());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn listar_ordena_por_orden_y_despues_por_creacion() {
    let c = carpeta_temporal();
    let mut compras = lista("l-compras", "Compras", 1);
    compras["creada"] = json!(1_763_000_000_000u64);
    guardar(&c, &lista("l-casa", "Casa", 1)).unwrap();
    guardar(&c, &compras).unwrap();
    guardar(&c, &lista("l-trabajo", "Trabajo", 0)).unwrap();
    let nombres: Vec<String> = listar(&c).listas.iter().map(|l| l["nombre"].as_str().unwrap().to_string()).collect();
    assert_eq!(nombres, ["Trabajo", "Compras", "Casa"]);
    let nada = listar(&c.join("no-existe"));
    assert!(nada.listas.is_empty() && nada.rotas.is_empty());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn una_tarea_minima_toma_los_valores_por_defecto() {
    let c = carpeta_temporal();
    let doc = json!({ "v": 1, "id": "l-x", "nombre": "X", "orden": 0, "tareas": [{ "id": "t-a", "titulo": "Algo" }] });
    let g = guardar(&c, &doc).unwrap();
    assert_eq!(g["creada"], Value::Null);
    assert_eq!(g["tareas"][0], json!({
        "id": "t-a", "titulo": "Algo", "hecha": false, "hechaEn": null, "fecha": null, "importante": false, "notas": "", "subtareas": [], "creada": null,
    }));
    fs::remove_dir_all(c).unwrap();
}

// ---------------------------------------------------------------- #43: huella (11.5) y modificar (11.4)

#[test]
fn listar_da_la_huella_de_los_bytes_de_cada_lista() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-casa", "Casa", 0)).unwrap();
    let l = listar(&c);
    let esperada = huella(&fs::read(c.join("l-casa.json")).unwrap());
    assert_eq!(l.huellas.get("l-casa"), Some(&esperada));
    assert_eq!(esperada.len(), 64);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn guardar_con_la_huella_de_lo_leido_guarda_y_da_la_nueva() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-casa", "Casa", 0)).unwrap();
    let h = listar(&c).huellas["l-casa"].clone();
    let mut d = lista("l-casa", "Casa", 0);
    d["tareas"][0]["hecha"] = json!(true);
    let (g, nueva) = guardar_si(&c, &d, Some(&h)).unwrap();
    assert_eq!(g["tareas"][0]["hecha"], true);
    assert_eq!(nueva, huella(&fs::read(c.join("l-casa.json")).unwrap()));
    assert_ne!(nueva, h);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn guardar_con_una_huella_vieja_no_escribe_y_avisa_cambio() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-casa", "Casa", 0)).unwrap();
    let vieja = listar(&c).huellas["l-casa"].clone();
    // Otro escritor (la charla) cambió el archivo después de leerlo la ventana
    let mut otra = lista("l-casa", "Casa", 0);
    otra["tareas"][0]["titulo"] = json!("Cambiada por la charla");
    guardar(&c, &otra).unwrap();
    let en_disco = fs::read(c.join("l-casa.json")).unwrap();
    let mut d = lista("l-casa", "Casa", 0);
    d["tareas"][0]["hecha"] = json!(true);
    assert_eq!(guardar_si(&c, &d, Some(&vieja)).unwrap_err(), "cambio");
    assert_eq!(fs::read(c.join("l-casa.json")).unwrap(), en_disco);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn guardar_sin_huella_guarda_como_antes() {
    // Lo de antes (11.5): sin huella, `tareas_guardar` pisa como siempre, y da lo mismo que `guardar`
    let c = carpeta_temporal();
    guardar(&c, &lista("l-casa", "Casa", 0)).unwrap();
    let mut d = lista("l-casa", "Casa", 0);
    d["nombre"] = json!("Hogar");
    let (g, h) = guardar_si(&c, &d, None).unwrap();
    assert_eq!(g, guardar(&c, &d).unwrap());
    assert_eq!(g["nombre"], "Hogar");
    assert_eq!(h, huella(&fs::read(c.join("l-casa.json")).unwrap()));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn modificar_cambia_con_el_candado_y_conserva_lo_desconocido() {
    let c = carpeta_temporal();
    let mut futura = lista("l-casa", "Casa", 0);
    futura["icono"] = json!("casita");
    futura["tareas"][0]["repetir"] = json!("semana");
    fs::write(c.join("l-casa.json"), serde_json::to_vec(&futura).unwrap()).unwrap();
    let (n, g) = modificar(&c, "l-casa", |doc| {
        doc["tareas"][0]["hecha"] = json!(true);
        Ok(doc["tareas"].as_array().map(Vec::len).unwrap_or(0))
    })
    .unwrap();
    assert_eq!(n, 1);
    assert_eq!(g["tareas"][0]["hecha"], true);
    assert_eq!(g["icono"], "casita");
    assert_eq!(g["tareas"][0]["repetir"], "semana");
    let en_disco: Value = serde_json::from_slice(&fs::read(c.join("l-casa.json")).unwrap()).unwrap();
    assert_eq!(en_disco, g);
    assert!(sin_temporales(&c));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn modificar_una_lista_rota_o_que_no_existe_no_toca_nada() {
    let c = carpeta_temporal();
    fs::write(c.join("l-rota.json"), "{ roto").unwrap();
    assert!(matches!(modificar(&c, "l-rota", |_| Ok(())), Err(Falla::Rota)));
    assert_eq!(fs::read(c.join("l-rota.json")).unwrap(), b"{ roto");
    assert!(matches!(modificar(&c, "l-nada", |_| Ok(())), Err(Falla::NoExiste)));
    assert!(!c.join("l-nada.json").exists());
    assert!(matches!(modificar(&c, "l-../x", |_| Ok(())), Err(Falla::NoExiste)));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn modificar_con_un_error_propio_o_un_resultado_invalido_no_escribe() {
    let c = carpeta_temporal();
    guardar(&c, &lista("l-casa", "Casa", 0)).unwrap();
    let antes = fs::read(c.join("l-casa.json")).unwrap();
    assert!(matches!(modificar(&c, "l-casa", |_| Err::<(), _>(String::from("no"))), Err(Falla::Regla(m)) if m == "no"));
    assert!(matches!(modificar(&c, "l-casa", |doc| { doc["tareas"][0]["fecha"] = json!("mañana"); Ok(()) }), Err(Falla::Regla(_))));
    assert_eq!(fs::read(c.join("l-casa.json")).unwrap(), antes);
    fs::remove_dir_all(c).unwrap();
}
