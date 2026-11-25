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
