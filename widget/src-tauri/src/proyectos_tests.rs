// Tests de proyectos.rs (#44, docs/diseno/proyectos-ux.md 11.1, 11.2 y 11.6 caso 11): ida y vuelta del
// formato v1, las claves desconocidas del archivo se conservan, `guardar` nunca cambia la carpeta, un
// archivo roto no se pisa ni se borra (mismo hash), los ids nunca son rutas, `carpeta_valida` rechaza lo
// que no se lee (raíz, Windows, la config de Avis, red), los nombres de carpeta se sanean y borrar un
// proyecto nunca toca su carpeta. Todo en carpetas temporales propias, nunca en Documentos ni en la config.
use super::*;
use sha2::{Digest, Sha256};
use std::sync::atomic::{AtomicUsize, Ordering};

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-proyectos-test-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

fn hash(r: &Path) -> Vec<u8> {
    Sha256::digest(fs::read(r).unwrap()).to_vec()
}

fn proyecto(id: &str, nombre: &str, carpeta: Value) -> Value {
    json!({
        "v": 1, "id": id, "nombre": nombre, "color": "ambar", "orden": 0, "creado": 1_764_100_000_000u64,
        "instrucciones": "Armo presupuestos para clientes.\nRespondé en pesos.", "carpeta": carpeta,
    })
}

fn sin_reglas() -> Reglas {
    Reglas::con(Vec::new())
}

// ------------------------------------------------------------------ formato (11.1)

#[test]
fn crear_y_leer_devuelve_el_formato_v1() {
    let c = carpeta_temporal();
    let doc = proyecto("p-presu", "Presupuestos 2027", json!({ "tipo": "pc", "ruta": "D:\\Presupuestos" }));
    let g = crear(&c, &doc).unwrap();
    assert_eq!(g, doc);
    let l = listar(&c);
    assert!(l.rotas.is_empty());
    assert_eq!(l.proyectos, vec![doc.clone()]);
    assert_eq!(leer(&c, "p-presu").unwrap(), doc);
    assert!(fs::read_dir(&c).unwrap().filter_map(Result::ok).all(|e| !e.file_name().to_string_lossy().ends_with(".tmp")));
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn los_topes_recortan_y_un_color_desconocido_es_celeste() {
    let mut doc = proyecto("p-largo", &"n".repeat(55), Value::Null);
    doc["instrucciones"] = json!("é".repeat(4_100));
    doc["color"] = json!("fucsia");
    let d = normalizar(&doc).unwrap();
    assert_eq!(d["nombre"].as_str().unwrap().chars().count(), 40);
    assert_eq!(d["instrucciones"].as_str().unwrap().chars().count(), 4_000);
    assert_eq!(d["color"], "celeste");
    // 4 000 justas quedan tal cual
    doc["instrucciones"] = json!("a".repeat(4_000));
    assert_eq!(normalizar(&doc).unwrap()["instrucciones"].as_str().unwrap().len(), 4_000);
}

#[test]
fn lo_que_no_sirve_se_rechaza() {
    assert!(normalizar(&json!({ "v": 2, "id": "p-a", "nombre": "A" })).is_err());
    assert!(normalizar(&proyecto("p-a", "   ", Value::Null)).is_err());
    assert!(normalizar(&proyecto("p-a", "A", json!({ "tipo": "red", "ruta": "C:\\x" }))).is_err());
    assert!(normalizar(&proyecto("p-a", "A", json!({ "tipo": "pc", "ruta": "" }))).is_err());
    assert!(normalizar(&proyecto("p-a", "A", json!("C:\\x"))).is_err());
}

#[test]
fn un_campo_desconocido_del_archivo_sobrevive_a_guardar_y_el_de_la_ventana_no_se_escribe() {
    let c = carpeta_temporal();
    let mut doc = proyecto("p-presu", "Presupuestos", Value::Null);
    crear(&c, &doc).unwrap();
    // Una versión futura escribió un campo que este Avis no conoce
    let r = c.join("p-presu.json");
    let mut crudo: Value = serde_json::from_slice(&fs::read(&r).unwrap()).unwrap();
    crudo["plantilla"] = json!({ "x": 1 });
    fs::write(&r, serde_json::to_vec(&crudo).unwrap()).unwrap();
    doc["nombre"] = json!("Presupuestos 2027");
    doc["inventado"] = json!(true);
    let g = guardar(&c, &doc).unwrap();
    assert_eq!(g["plantilla"], json!({ "x": 1 }));
    assert_eq!(g["nombre"], "Presupuestos 2027");
    let en_disco: Value = serde_json::from_slice(&fs::read(&r).unwrap()).unwrap();
    assert_eq!(en_disco["plantilla"], json!({ "x": 1 }));
    assert!(en_disco.get("inventado").is_none());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn guardar_con_carpeta_en_el_documento_no_la_cambia() {
    let c = carpeta_temporal();
    let original = json!({ "tipo": "avis", "ruta": "C:\\Users\\x\\Documents\\Avis\\Presupuestos" });
    crear(&c, &proyecto("p-presu", "Presupuestos", original.clone())).unwrap();
    // La ventana manda otra carpeta (o la que leyó, con estado y archivos): se ignora
    let mut doc = proyecto("p-presu", "Presupuestos", json!({ "tipo": "pc", "ruta": "C:\\Windows" }));
    doc["instrucciones"] = json!("Otras");
    let g = guardar(&c, &doc).unwrap();
    assert_eq!(g["carpeta"], original);
    assert_eq!(leer(&c, "p-presu").unwrap()["carpeta"], original);
    assert_eq!(leer(&c, "p-presu").unwrap()["instrucciones"], "Otras");
    // Sin carpeta en el documento, tampoco se pierde
    let mut sin = doc.clone();
    sin.as_object_mut().unwrap().remove("carpeta");
    assert_eq!(guardar(&c, &sin).unwrap()["carpeta"], original);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn guardar_no_crea_un_proyecto_que_no_existe() {
    let c = carpeta_temporal();
    assert!(guardar(&c, &proyecto("p-nuevo", "Nuevo", Value::Null)).is_err());
    assert!(!c.join("p-nuevo.json").exists());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn un_nombre_repetido_se_rechaza_sin_mayusculas_ni_tildes() {
    let c = carpeta_temporal();
    crear(&c, &proyecto("p-a", "Presupuestos 2027", Value::Null)).unwrap();
    crear(&c, &proyecto("p-b", "Lecturas", Value::Null)).unwrap();
    assert_eq!(crear(&c, &proyecto("p-c", "presupuestos 2027", Value::Null)).unwrap_err(), REPETIDO);
    assert_eq!(nuevo(&c, &json!({ "id": "p-c", "nombre": " PRESUPUÉSTOS 2027 " }), 1).unwrap_err(), REPETIDO);
    // Renombrar a otro que existe, no; quedarse con el propio, sí
    assert_eq!(guardar(&c, &proyecto("p-b", "Presupuestos 2027", Value::Null)).unwrap_err(), REPETIDO);
    assert!(guardar(&c, &proyecto("p-a", "presupuestos 2027", Value::Null)).is_ok());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn nuevo_va_al_final_del_orden_sin_carpeta_y_no_reusa_un_id() {
    let c = carpeta_temporal();
    let mut a = proyecto("p-a", "A", Value::Null);
    a["orden"] = json!(4);
    crear(&c, &a).unwrap();
    let n = nuevo(&c, &json!({ "id": "p-b", "nombre": "B", "color": "verde", "instrucciones": "x", "carpeta": "elegir" }), 99).unwrap();
    assert_eq!(n, json!({ "v": 1, "id": "p-b", "nombre": "B", "color": "verde", "orden": 5, "creado": 99, "instrucciones": "x", "carpeta": null }));
    assert!(nuevo(&c, &json!({ "id": "p-a", "nombre": "Otro" }), 1).is_err());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn cambiar_carpeta_pone_la_nueva_y_conserva_lo_demas() {
    let c = carpeta_temporal();
    crear(&c, &proyecto("p-a", "A", json!({ "tipo": "pc", "ruta": "D:\\Vieja" }))).unwrap();
    let g = cambiar_carpeta(&c, "p-a", &json!({ "tipo": "avis", "ruta": "C:\\Docs\\Avis\\A" })).unwrap();
    assert_eq!(g["carpeta"], json!({ "tipo": "avis", "ruta": "C:\\Docs\\Avis\\A" }));
    assert_eq!(g["nombre"], "A");
    assert!(cambiar_carpeta(&c, "p-no", &json!({ "tipo": "pc", "ruta": "D:\\x" })).is_err());
    fs::remove_dir_all(c).unwrap();
}

// ------------------------------------------------------------------ archivos rotos (7.6)

#[test]
fn un_archivo_roto_va_en_rotas_y_queda_igual_despues_de_usar_la_hoja() {
    let c = carpeta_temporal();
    crear(&c, &proyecto("p-bien", "Bien", Value::Null)).unwrap();
    let roto = c.join("p-roto.json");
    fs::write(&roto, b"{ \"v\": 1, \"id\": \"p-roto\", \"nombre\": ").unwrap();
    let otro = c.join("p-otro.json");
    fs::write(&otro, serde_json::to_vec(&proyecto("p-distinto", "X", Value::Null)).unwrap()).unwrap();
    let (h1, h2) = (hash(&roto), hash(&otro));
    let l = listar(&c);
    assert_eq!(l.proyectos.len(), 1);
    assert_eq!(l.rotas.iter().map(|r| r["archivo"].as_str().unwrap()).collect::<Vec<_>>(), ["p-otro.json", "p-roto.json"]);
    // Usar la hoja: guardar, crear con ese id, cambiar la carpeta y borrar no lo tocan
    assert!(guardar(&c, &proyecto("p-roto", "Roto", Value::Null)).is_err());
    assert!(crear(&c, &proyecto("p-roto", "Roto", Value::Null)).is_err());
    assert!(nuevo(&c, &json!({ "id": "p-roto", "nombre": "Roto" }), 1).is_err());
    assert!(cambiar_carpeta(&c, "p-roto", &json!({ "tipo": "pc", "ruta": "D:\\x" })).is_err());
    assert!(borrar(&c, "p-roto").is_err());
    assert!(borrar(&c, "p-otro").is_err());
    guardar(&c, &proyecto("p-bien", "Bien 2", Value::Null)).unwrap();
    listar(&c);
    assert_eq!(hash(&roto), h1);
    assert_eq!(hash(&otro), h2);
    fs::remove_dir_all(c).unwrap();
}

// ------------------------------------------------------------------ ids (11.1)

#[test]
fn un_id_que_no_es_de_proyecto_nunca_arma_una_ruta() {
    for malo in ["p-..", "p-../x", "p-a/b", "p-a\\b", "con", "CON", "p-CON", "l-lista", "presu", "p-", "p-a.json", &format!("p-{}", "a".repeat(39))] {
        assert!(!id_valido(malo), "{malo}");
        assert!(ruta(Path::new("C:\\cfg"), malo).is_none(), "{malo}");
    }
    assert!(id_valido("p-k3f9a2"));
    assert!(id_valido(&format!("p-{}", "a".repeat(38))));
    let c = carpeta_temporal();
    assert!(crear(&c, &proyecto("p-../fuera", "X", Value::Null)).is_err());
    assert!(borrar(&c, "p-../fuera").is_err());
    assert!(leer(&c, "../p-a").is_err());
    assert_eq!(fs::read_dir(&c).unwrap().count(), 0);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn la_regla_de_ids_es_la_misma_para_tareas_y_proyectos() {
    // `id_con` vive en ids.rs; tareas la sigue usando igual
    assert!(crate::tareas::id_valido("l-casa"));
    assert!(!crate::tareas::id_valido("p-casa"));
    assert!(crate::ids::id_con("p-", "p-casa"));
    assert!(!crate::ids::id_con("p-", "p-"));
}

// ------------------------------------------------------------------ carpeta_valida (11.2)

#[test]
fn carpeta_valida_rechaza_la_raiz_de_un_disco_windows_la_config_y_la_red() {
    let config = carpeta_temporal();
    let reglas = Reglas::del_sistema(&config);
    assert_eq!(carpeta_valida(Path::new("C:\\"), &reglas), Err(Motivo::Grande));
    assert_eq!(carpeta_valida(Path::new("c:/"), &reglas), Err(Motivo::Grande));
    let windows = std::env::var("WINDIR").unwrap_or_else(|_| String::from("C:\\Windows"));
    assert_eq!(carpeta_valida(Path::new(&windows), &reglas), Err(Motivo::Grande));
    assert_eq!(carpeta_valida(&Path::new(&windows).join("System32"), &reglas), Err(Motivo::Grande));
    if let Ok(pf) = std::env::var("ProgramFiles") {
        assert_eq!(carpeta_valida(Path::new(&pf), &reglas), Err(Motivo::Grande));
    }
    // La carpeta de configuración de Avis y todo lo que tiene adentro
    let adentro = config.join("proyectos");
    fs::create_dir_all(&adentro).unwrap();
    assert_eq!(carpeta_valida(&config, &reglas), Err(Motivo::Grande));
    assert_eq!(carpeta_valida(&adentro, &reglas), Err(Motivo::Grande));
    // Red: antes de tocar el disco
    assert_eq!(carpeta_valida(Path::new("\\\\servidor\\compartida\\proyectos"), &reglas), Err(Motivo::Red));
    assert_eq!(carpeta_valida(Path::new("//servidor/compartida"), &reglas), Err(Motivo::Red));
    assert_eq!(carpeta_valida(Path::new("\\\\?\\UNC\\servidor\\c"), &reglas), Err(Motivo::Red));
    // Relativa, que no existe o que es un archivo
    assert_eq!(carpeta_valida(Path::new("relativa"), &reglas), Err(Motivo::NoExiste));
    assert_eq!(carpeta_valida(&config.join("no-esta"), &reglas), Err(Motivo::NoExiste));
    fs::write(config.join("a.txt"), b"x").unwrap();
    assert_eq!(carpeta_valida(&config.join("a.txt"), &sin_reglas()), Err(Motivo::NoExiste));
    fs::remove_dir_all(config).unwrap();
}

#[test]
fn carpeta_valida_acepta_una_carpeta_normal_sin_el_prefijo() {
    let c = carpeta_temporal();
    let normal = c.join("Presupuestos 2027");
    fs::create_dir_all(&normal).unwrap();
    let config = carpeta_temporal();
    let ok = carpeta_valida(&normal, &Reglas::del_sistema(&config)).unwrap();
    assert!(!ok.to_string_lossy().starts_with("\\\\?\\"), "{}", ok.display());
    assert!(ok.ends_with("Presupuestos 2027"));
    assert!(ok.is_dir());
    // Con `..` se resuelve y se guarda sin él
    let con_puntos = normal.join("..").join("Presupuestos 2027");
    assert_eq!(carpeta_valida(&con_puntos, &sin_reglas()).unwrap(), ok);
    fs::remove_dir_all(c).unwrap();
    fs::remove_dir_all(config).unwrap();
}

// ------------------------------------------------------------------ la carpeta que crea Avis (11.2)

#[test]
fn nombre_carpeta_sanea_lo_que_windows_no_acepta() {
    assert_eq!(nombre_carpeta("CON"), "CON proyecto");
    assert_eq!(nombre_carpeta("nul"), "nul proyecto");
    assert_eq!(nombre_carpeta("com1"), "com1 proyecto");
    assert_eq!(nombre_carpeta("LPT9.txt"), "LPT9.txt proyecto");
    assert_eq!(nombre_carpeta("Consola"), "Consola");
    assert_eq!(nombre_carpeta("COM0"), "COM0");
    assert_eq!(nombre_carpeta("a/b:c"), "abc");
    assert_eq!(nombre_carpeta("<x>|\"y\"?*\\"), "xy");
    assert_eq!(nombre_carpeta("  ."), "Proyecto");
    assert_eq!(nombre_carpeta(""), "Proyecto");
    assert_eq!(nombre_carpeta("Mudanza. . "), "Mudanza");
    assert_eq!(nombre_carpeta("tab\there"), "tabhere");
    assert_eq!(nombre_carpeta(&"ñ".repeat(80)).chars().count(), 60);
    assert_eq!(nombre_carpeta("Presupuestos 2027"), "Presupuestos 2027");
}

#[test]
fn crear_carpeta_avis_va_en_documentos_avis_y_nunca_reusa_una_que_existe() {
    let docs = carpeta_temporal();
    let config = carpeta_temporal();
    let reglas = Reglas::del_sistema(&config);
    let primera = crear_carpeta_avis(&docs, "Presupuestos 2027", &reglas).unwrap();
    assert_eq!(primera, carpeta_valida(&docs.join("Avis").join("Presupuestos 2027"), &reglas).unwrap());
    // Ya existe (con un archivo del usuario adentro): « (2)», y la de antes queda igual
    fs::write(primera.join("tarifas.xlsx"), b"precios").unwrap();
    let h = hash(&primera.join("tarifas.xlsx"));
    let segunda = crear_carpeta_avis(&docs, "presupuestos 2027", &reglas).unwrap_or_else(|m| panic!("{m:?}"));
    // Windows no distingue mayúsculas: la misma carpeta, así que va « (2)»
    assert!(segunda.ends_with("presupuestos 2027 (2)") || segunda.ends_with("Presupuestos 2027 (2)"), "{}", segunda.display());
    let tercera = crear_carpeta_avis(&docs, "Presupuestos 2027", &reglas).unwrap();
    assert!(tercera.ends_with("Presupuestos 2027 (3)"), "{}", tercera.display());
    assert_eq!(hash(&primera.join("tarifas.xlsx")), h);
    assert_eq!(contar_archivos(&primera), 1);
    fs::remove_dir_all(docs).unwrap();
    fs::remove_dir_all(config).unwrap();
}

// ------------------------------------------------------------------ leer para la hoja (11.3)

#[test]
fn con_estado_cuenta_archivos_y_avisa_la_carpeta_perdida() {
    let c = carpeta_temporal();
    let car = c.join("Mudanza");
    fs::create_dir_all(car.join("sub")).unwrap();
    fs::write(car.join("a.pdf"), b"a").unwrap();
    fs::write(car.join("b.txt"), b"b").unwrap();
    fs::write(car.join("sub").join("c.txt"), b"c").unwrap();
    let ruta_car = car.to_string_lossy().into_owned();
    let e = con_estado(&proyecto("p-a", "A", json!({ "tipo": "avis", "ruta": ruta_car })));
    assert_eq!(e["carpeta"], json!({ "nombre": "Mudanza", "ruta": ruta_car, "tipo": "avis", "estado": "ok", "archivos": 2 }));
    let perdida = con_estado(&proyecto("p-a", "A", json!({ "tipo": "pc", "ruta": "Z:\\No\\Esta" })));
    assert_eq!(perdida["carpeta"]["estado"], "perdida");
    assert_eq!(perdida["carpeta"]["nombre"], "Esta");
    assert_eq!(perdida["carpeta"]["archivos"], 0);
    assert_eq!(con_estado(&proyecto("p-a", "A", Value::Null))["carpeta"]["estado"], "sin");
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn contar_archivos_tiene_tope() {
    let c = carpeta_temporal();
    for i in 0..(TOPE_ARCHIVOS + 5) {
        fs::write(c.join(format!("{i}.txt")), b"").unwrap();
    }
    assert_eq!(contar_archivos(&c), TOPE_ARCHIVOS);
    fs::remove_dir_all(c).unwrap();
}

// ------------------------------------------------------------------ borrar (11.3, P1)

#[test]
fn borrar_el_proyecto_no_toca_su_carpeta() {
    let c = carpeta_temporal();
    let car = c.join("Presupuestos");
    fs::create_dir_all(&car).unwrap();
    let testigo = car.join("tarifas-2027.xlsx");
    fs::write(&testigo, b"precios de 2027").unwrap();
    let h = hash(&testigo);
    let config = c.join("config");
    crear(&config, &proyecto("p-presu", "Presupuestos", json!({ "tipo": "avis", "ruta": car.to_string_lossy() }))).unwrap();
    crear(&config, &proyecto("p-otro", "Otro", json!({ "tipo": "avis", "ruta": car.to_string_lossy() }))).unwrap();
    assert_eq!(ruta_para_abrir(&config, "p-presu").unwrap(), car);
    borrar(&config, "p-presu").unwrap();
    assert!(!config.join("p-presu.json").exists());
    assert!(config.join("p-otro.json").exists());
    assert_eq!(hash(&testigo), h);
    assert!(car.is_dir());
    // Lo que ya no está no es un error
    borrar(&config, "p-presu").unwrap();
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn ruta_para_abrir_revalida_la_carpeta() {
    let c = carpeta_temporal();
    crear(&c, &proyecto("p-a", "A", json!({ "tipo": "pc", "ruta": "Z:\\No\\Esta" }))).unwrap();
    crear(&c, &proyecto("p-b", "B", Value::Null)).unwrap();
    assert!(ruta_para_abrir(&c, "p-a").is_err());
    assert!(ruta_para_abrir(&c, "p-b").is_err());
    assert!(ruta_para_abrir(&c, "p-..").is_err());
    fs::remove_dir_all(c).unwrap();
}
