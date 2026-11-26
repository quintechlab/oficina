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

// ------------------------------------------------------------------ soltar archivos (11.2, P3)

/// Un proyecto con su carpeta creada por Avis (`tipo`), en `c/config`, y la carpeta en `c/Docs/Avis/<nombre>`.
fn con_carpeta(c: &Path, id: &str, tipo: &str) -> (PathBuf, PathBuf) {
    let config = c.join("config");
    let car = c.join("Docs").join("Avis").join(id);
    fs::create_dir_all(&car).unwrap();
    crear(&config, &proyecto(id, id, json!({ "tipo": tipo, "ruta": car.to_string_lossy() }))).unwrap();
    (config, car)
}

/// Los archivos de una carpeta, por nombre, con su hash.
fn contenido(car: &Path) -> Vec<(String, Vec<u8>)> {
    let mut v: Vec<(String, Vec<u8>)> = fs::read_dir(car).unwrap().filter_map(Result::ok).map(|e| (e.file_name().to_string_lossy().into_owned(), hash(&e.path()))).collect();
    v.sort();
    v
}

fn rutas(v: &[&PathBuf]) -> Vec<String> {
    v.iter().map(|p| p.to_string_lossy().into_owned()).collect()
}

#[test]
fn soltar_tres_con_uno_repetido_deja_cuatro_y_los_originales_intactos() {
    let c = carpeta_temporal();
    let (config, car) = con_carpeta(&c, "p-presu", "avis");
    fs::write(car.join("informe.pdf"), b"el informe que ya estaba").unwrap();
    let h_estaba = hash(&car.join("informe.pdf"));
    let origen = c.join("Descargas");
    fs::create_dir_all(&origen).unwrap();
    let (a, informe, notas) = (origen.join("tarifas.xlsx"), origen.join("informe.pdf"), origen.join("notas.md"));
    fs::write(&a, b"precios").unwrap();
    fs::write(&informe, b"el informe nuevo").unwrap();
    fs::write(&notas, b"# notas").unwrap();
    let antes = [hash(&a), hash(&informe), hash(&notas)];
    let r = soltar(&config, "p-presu", &rutas(&[&a, &informe, &notas]), &sin_reglas()).unwrap();
    assert_eq!(r["copiados"], json!(["tarifas.xlsx", "informe (2).pdf", "notas.md"]));
    assert_eq!(r["renombrados"], json!([{ "nombre": "informe.pdf", "como": "informe (2).pdf" }]));
    assert_eq!(r["fallidos"], json!([]));
    // Cuatro en la carpeta: el que estaba sin tocar y las copias con el contenido de los originales
    let dentro = contenido(&car);
    assert_eq!(dentro.iter().map(|(n, _)| n.as_str()).collect::<Vec<_>>(), ["informe (2).pdf", "informe.pdf", "notas.md", "tarifas.xlsx"]);
    assert_eq!(hash(&car.join("informe.pdf")), h_estaba);
    assert_eq!(hash(&car.join("informe (2).pdf")), antes[1]);
    assert_eq!(hash(&car.join("tarifas.xlsx")), antes[0]);
    // Copia, nunca mueve: los originales siguen donde estaban, iguales
    assert_eq!([hash(&a), hash(&informe), hash(&notas)], antes);
    // Soltar otra vez el mismo: « (3)», nunca pisa
    let r2 = soltar(&config, "p-presu", &rutas(&[&informe]), &sin_reglas()).unwrap();
    assert_eq!(r2["copiados"], json!(["informe (3).pdf"]));
    assert_eq!(hash(&car.join("informe (2).pdf")), antes[1]);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn soltar_una_carpeta_se_rechaza_y_no_copia_nada() {
    let c = carpeta_temporal();
    let (config, car) = con_carpeta(&c, "p-presu", "avis");
    let fotos = c.join("Fotos");
    fs::create_dir_all(&fotos).unwrap();
    fs::write(fotos.join("a.jpg"), b"a").unwrap();
    let r = soltar(&config, "p-presu", &rutas(&[&fotos]), &sin_reglas()).unwrap();
    assert_eq!(r["copiados"], json!([]));
    assert_eq!(r["fallidos"], json!([{ "nombre": "Fotos", "motivo": "carpeta" }]));
    assert!(contenido(&car).is_empty());
    assert!(fotos.join("a.jpg").is_file());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn soltar_21_copia_los_20_primeros_y_avisa_el_tope() {
    let c = carpeta_temporal();
    let (config, car) = con_carpeta(&c, "p-presu", "avis");
    let origen = c.join("Descargas");
    fs::create_dir_all(&origen).unwrap();
    let archivos: Vec<PathBuf> = (1..=21).map(|i| origen.join(format!("f{i:02}.txt"))).collect();
    for (i, a) in archivos.iter().enumerate() {
        fs::write(a, format!("archivo {i}")).unwrap();
    }
    let r = soltar(&config, "p-presu", &rutas(&archivos.iter().collect::<Vec<_>>()), &sin_reglas()).unwrap();
    assert_eq!(TOPE_SOLTAR, 20);
    assert_eq!(r["copiados"].as_array().unwrap().len(), 20);
    assert_eq!(r["copiados"][19], "f20.txt");
    assert_eq!(r["fallidos"], json!([{ "nombre": "f21.txt", "motivo": "tope" }]));
    assert_eq!(contenido(&car).len(), 20);
    assert!(!car.join("f21.txt").exists());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn soltar_solo_en_carpetas_creadas_por_avis() {
    let c = carpeta_temporal();
    let (config, car) = con_carpeta(&c, "p-lect", "pc");
    let a = c.join("a.txt");
    fs::write(&a, b"a").unwrap();
    assert!(soltar(&config, "p-lect", &rutas(&[&a]), &sin_reglas()).is_err());
    assert!(contenido(&car).is_empty());
    // Sin carpeta, perdida, o en una carpeta que ya no se acepta (11.2): nada
    crear(&config, &proyecto("p-sin", "Sin", Value::Null)).unwrap();
    assert!(soltar(&config, "p-sin", &rutas(&[&a]), &sin_reglas()).is_err());
    crear(&config, &proyecto("p-mud", "Mudanza", json!({ "tipo": "avis", "ruta": c.join("No esta").to_string_lossy() }))).unwrap();
    assert!(soltar(&config, "p-mud", &rutas(&[&a]), &sin_reglas()).is_err());
    let (_, car_presu) = con_carpeta(&c, "p-presu", "avis");
    assert!(soltar(&config, "p-presu", &rutas(&[&a]), &Reglas::con(vec![c.join("Docs")])).is_err());
    assert!(contenido(&car_presu).is_empty());
    // Un id que no es de proyecto nunca arma una ruta
    assert!(soltar(&config, "p-..", &rutas(&[&a]), &sin_reglas()).is_err());
    assert!(soltar(&config, "..\\p-presu", &rutas(&[&a]), &sin_reglas()).is_err());
    assert_eq!(hash(&a), Sha256::digest(b"a").to_vec());
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn soltar_rechaza_lo_que_no_es_un_archivo_de_afuera_y_sigue_con_el_resto() {
    let c = carpeta_temporal();
    let (config, car) = con_carpeta(&c, "p-presu", "avis");
    fs::write(car.join("ya.txt"), b"ya adentro").unwrap();
    let h_ya = hash(&car.join("ya.txt"));
    let bien = c.join("bien.txt");
    fs::write(&bien, b"bien").unwrap();
    let grande = c.join("grande.bin");
    fs::write(&grande, vec![7u8; 11]).unwrap();
    let pedido = vec![
        String::from("relativo.txt"),
        c.join("no-esta.txt").to_string_lossy().into_owned(),
        car.join("ya.txt").to_string_lossy().into_owned(),
        grande.to_string_lossy().into_owned(),
        bien.to_string_lossy().into_owned(),
    ];
    let r = soltar_con(&config, "p-presu", &pedido, &sin_reglas(), 10).unwrap();
    assert_eq!(r["copiados"], json!(["bien.txt"]));
    assert_eq!(
        r["fallidos"],
        json!([
            { "nombre": "relativo.txt", "motivo": "ruta" },
            { "nombre": "no-esta.txt", "motivo": "no-existe" },
            { "nombre": "ya.txt", "motivo": "adentro" },
            { "nombre": "grande.bin", "motivo": "grande" },
        ])
    );
    assert_eq!(hash(&car.join("ya.txt")), h_ya);
    assert!(!car.join("ya (2).txt").exists());
    assert!(!car.join("grande.bin").exists());
    assert_eq!(TOPE_BYTES_SOLTAR, 200 * 1024 * 1024);
    fs::remove_dir_all(c).unwrap();
}

#[test]
fn nombre_copia_suma_el_numero_antes_de_la_extension() {
    assert_eq!(nombre_copia("informe.pdf", 1), "informe.pdf");
    assert_eq!(nombre_copia("informe.pdf", 2), "informe (2).pdf");
    assert_eq!(nombre_copia("datos.tar.gz", 3), "datos.tar (3).gz");
    assert_eq!(nombre_copia("LEEME", 2), "LEEME (2)");
    assert_eq!(nombre_copia(".env", 2), ".env (2)");
}

// Sondas del verificador de P3 (25/11), como tests de regresión: copiar nunca pisa ni mueve, los rechazos
// no escriben nada, el tope de 20 y de 200 MB, la copia a medias, los destinos que no sirven y los nombres.
mod sondas {
    use super::*;
    use std::process::Command;

    /// La carpeta de cada sonda (dentro de `carpeta_temporal`). Al salir, primero se sacan los enlaces
    /// (junctions: uno apunta a C:\Windows\Temp) sin tocar su destino, y después se borra todo.
    struct Base(PathBuf);
    impl std::ops::Deref for Base {
        type Target = PathBuf;
        fn deref(&self) -> &PathBuf { &self.0 }
    }
    impl AsRef<Path> for Base {
        fn as_ref(&self) -> &Path { &self.0 }
    }
    impl Drop for Base {
        fn drop(&mut self) {
            fn sacar_enlaces(d: &Path) {
                let Ok(it) = fs::read_dir(d) else { return };
                for e in it.filter_map(Result::ok) {
                    let p = e.path();
                    match fs::symlink_metadata(&p) {
                        Ok(m) if m.file_type().is_symlink() || es_junction(&p) => { let _ = fs::remove_dir(&p).or_else(|_| fs::remove_file(&p)); }
                        Ok(m) if m.is_dir() => sacar_enlaces(&p),
                        _ => {}
                    }
                }
            }
            fn es_junction(p: &Path) -> bool {
                use std::os::windows::fs::MetadataExt;
                fs::symlink_metadata(p).map(|m| m.file_attributes() & 0x400 != 0).unwrap_or(false)
            }
            sacar_enlaces(&self.0);
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn base() -> Base {
        Base(carpeta_temporal())
    }
    fn lista(car: &Path) -> Vec<(String, Vec<u8>)> {
        let mut v: Vec<(String, Vec<u8>)> = Vec::new();
        for e in fs::read_dir(car).unwrap().filter_map(Result::ok) {
            let p = e.path();
            if p.is_dir() {
                for e2 in fs::read_dir(&p).unwrap().filter_map(Result::ok) {
                    v.push((e2.path().to_string_lossy().into_owned(), hash(&e2.path())));
                }
                v.push((p.to_string_lossy().into_owned(), vec![]));
            } else {
                v.push((p.to_string_lossy().into_owned(), hash(&p)));
            }
        }
        v.sort();
        v
    }
    fn r1(p: &Path) -> Vec<String> {
        vec![p.to_string_lossy().into_owned()]
    }
    fn junction(link: &Path, destino: &Path) -> bool {
        Command::new("cmd").args(["/C", "mklink", "/J"]).arg(link).arg(destino).output().map(|o| o.status.success()).unwrap_or(false)
    }

    #[test]
    fn sonda_tres_con_repetido_cuatro_y_originales_siguen() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        fs::write(car.join("informe.pdf"), b"viejo").unwrap();
        let h = hash(&car.join("informe.pdf"));
        let o = c.join("o");
        fs::create_dir_all(&o).unwrap();
        let fs3 = [o.join("informe.pdf"), o.join("b.txt"), o.join("c.md")];
        for (i, f) in fs3.iter().enumerate() {
            fs::write(f, format!("x{i}")).unwrap();
        }
        let antes: Vec<_> = fs3.iter().map(|f| hash(f)).collect();
        let r = soltar(&config, "p-a", &fs3.iter().map(|p| p.to_string_lossy().into_owned()).collect::<Vec<_>>(), &sin_reglas()).unwrap();
        assert_eq!(r["fallidos"], json!([]));
        assert_eq!(contenido(&car).len(), 4);
        assert_eq!(hash(&car.join("informe.pdf")), h);
        for (f, a) in fs3.iter().zip(&antes) {
            assert!(f.is_file());
            assert_eq!(&hash(f), a);
        }
        assert_eq!(hash(&car.join("informe (2).pdf")), antes[0]);
    }

    #[test]
    fn sonda_rechazos_no_escriben() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        fs::write(car.join("ya.txt"), b"ya").unwrap();
        fs::create_dir_all(car.join("sub")).unwrap();
        fs::write(car.join("sub").join("hondo.txt"), b"hondo").unwrap();
        let antes = lista(&car);
        let o = c.join("o");
        fs::create_dir_all(o.join("dir")).unwrap();
        fs::write(o.join("real.txt"), b"real").unwrap();
        let j = c.join("jun");
        assert!(junction(&j, &o.join("dir")), "mklink /J");
        let j2 = c.join("jdest");
        assert!(junction(&j2, &car), "mklink /J dest");
        let sl = c.join("sl.txt");
        let hay_sl = std::os::windows::fs::symlink_file(o.join("real.txt"), &sl).is_ok();
        let sl_adentro = c.join("sl-adentro.txt");
        let hay_sl2 = std::os::windows::fs::symlink_file(car.join("ya.txt"), &sl_adentro).is_ok();
        let mut pedido = vec![
            o.join("dir").to_string_lossy().into_owned(),
            j.to_string_lossy().into_owned(),
            c.join("nada.txt").to_string_lossy().into_owned(),
            String::from(r"o\real.txt"),
            String::from(""),
            car.join("ya.txt").to_string_lossy().into_owned(),
            car.join("YA.TXT").to_string_lossy().into_owned(),
            car.join("sub").join("hondo.txt").to_string_lossy().into_owned(),
            j2.join("ya.txt").to_string_lossy().into_owned(),
            format!("{}\\.\\ya.txt", car.to_string_lossy()),
            format!("{}\\sub\\..\\ya.txt", car.to_string_lossy()),
        ];
        if hay_sl {
            pedido.push(sl.to_string_lossy().into_owned());
        }
        if hay_sl2 {
            pedido.push(sl_adentro.to_string_lossy().into_owned());
        }
        let r = soltar(&config, "p-a", &pedido, &sin_reglas()).unwrap();
        eprintln!("rechazos: {r} (symlink={hay_sl},{hay_sl2})");
        assert_eq!(r["copiados"], json!([]), "{r}");
        assert_eq!(r["fallidos"].as_array().unwrap().len(), pedido.len());
        assert_eq!(lista(&car), antes);
        assert!(o.join("real.txt").is_file());
    }

    #[test]
    fn sonda_21_y_tope() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        let v: Vec<String> = (0..21)
            .map(|i| {
                let p = c.join(format!("f{i}.txt"));
                fs::write(&p, "z").unwrap();
                p.to_string_lossy().into_owned()
            })
            .collect();
        let r = soltar(&config, "p-a", &v, &sin_reglas()).unwrap();
        assert_eq!(r["copiados"].as_array().unwrap().len(), 20);
        assert_eq!(r["fallidos"], json!([{ "nombre": "f20.txt", "motivo": "tope" }]));
        assert_eq!(contenido(&car).len(), 20);
        assert!(!car.join("f20.txt").exists());
    }

    #[test]
    fn sonda_mas_de_200mb_disperso_no_deja_nada() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        let g = c.join("enorme.bin");
        let f = fs::File::create(&g).unwrap();
        f.set_len(TOPE_BYTES_SOLTAR + 1).unwrap();
        drop(f);
        let justo = c.join("justo.bin");
        fs::File::create(&justo).unwrap().set_len(TOPE_BYTES_SOLTAR).unwrap();
        let r = soltar(&config, "p-a", &[g.to_string_lossy().into_owned(), justo.to_string_lossy().into_owned()], &sin_reglas()).unwrap();
        assert_eq!(r["fallidos"], json!([{ "nombre": "enorme.bin", "motivo": "grande" }]), "{r}");
        assert_eq!(r["copiados"], json!(["justo.bin"]));
        assert!(!car.join("enorme.bin").exists());
        assert_eq!(fs::metadata(car.join("justo.bin")).unwrap().len(), TOPE_BYTES_SOLTAR);
        assert_eq!(fs::metadata(&g).unwrap().len(), TOPE_BYTES_SOLTAR + 1);
    }

    #[test]
    fn sonda_copia_a_medias_se_borra_y_la_que_estaba_no() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        fs::write(car.join("x.txt"), b"la que estaba").unwrap();
        let h = hash(&car.join("x.txt"));
        let src = c.join("x.txt");
        fs::write(&src, vec![1u8; 100_000]).unwrap();
        // Otro handle con candado exclusivo: abrir anda, leer falla (ERROR_LOCK_VIOLATION)
        let candado = fs::OpenOptions::new().read(true).write(true).open(&src).unwrap();
        candado.lock().unwrap();
        let r = soltar(&config, "p-a", &r1(&src), &sin_reglas()).unwrap();
        candado.unlock().unwrap();
        drop(candado);
        eprintln!("a medias: {r}");
        assert_eq!(r["copiados"], json!([]), "{r}");
        assert_eq!(r["fallidos"][0]["motivo"], "copiar");
        assert!(!car.join("x (2).txt").exists(), "la copia a medias quedó");
        assert_eq!(hash(&car.join("x.txt")), h);
        assert_eq!(contenido(&car).len(), 1);
        assert_eq!(fs::read(&src).unwrap().len(), 100_000);
    }

    #[test]
    fn sonda_destino_que_no_sirve() {
        let c = base();
        let a = c.join("a.txt");
        fs::write(&a, b"a").unwrap();
        let config = c.join("config");
        let (_, car_pc) = con_carpeta(&c, "p-pc", "pc");
        assert!(soltar(&config, "p-pc", &r1(&a), &sin_reglas()).is_err());
        assert!(contenido(&car_pc).is_empty());
        for (id, ruta) in [
            ("p-raiz", String::from(r"C:\")),
            ("p-win", String::from(r"C:\Windows\Temp")),
            ("p-unc", String::from(r"\\localhost\C$\Users")),
            ("p-arch", a.to_string_lossy().into_owned()),
        ] {
            crear(&config, &proyecto(id, id, json!({ "tipo": "avis", "ruta": ruta }))).unwrap();
            let r = soltar(&config, id, &r1(&a), &Reglas::del_sistema(&config));
            eprintln!("{id}: {r:?}");
            assert!(r.is_err(), "{id}");
        }
        assert!(!PathBuf::from(r"C:\a.txt").exists());
        let j = c.join("Docs").join("Avis").join("jwin");
        fs::create_dir_all(j.parent().unwrap()).unwrap();
        assert!(junction(&j, Path::new(r"C:\Windows\Temp")));
        crear(&config, &proyecto("p-jwin", "jwin", json!({ "tipo": "avis", "ruta": j.to_string_lossy() }))).unwrap();
        assert!(soltar(&config, "p-jwin", &r1(&a), &Reglas::del_sistema(&config)).is_err());
        for id in ["", "p-", "P-a", "p-a/../b", r"p-a\..\b", "..", "p-a.json", "con"] {
            assert!(soltar(&config, id, &r1(&a), &sin_reglas()).is_err(), "{id}");
        }
        assert!(soltar(&config, "p-noesta", &r1(&a), &sin_reglas()).is_err());
        let car = c.join("Docs").join("Avis").join("up");
        fs::create_dir_all(&car).unwrap();
        let creado = crear(&config, &proyecto("p-up", "up", json!({ "tipo": "AVIS", "ruta": car.to_string_lossy() })));
        eprintln!("tipo AVIS: crear {:?}", creado.as_ref().map(|d| d["carpeta"].clone()));
        assert!(soltar(&config, "p-up", &r1(&a), &sin_reglas()).is_err());
        assert!(contenido(&car).is_empty());
        assert_eq!(hash(&a), Sha256::digest(b"a").to_vec());
    }

    #[test]
    fn sonda_nombres() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        fs::write(car.join("a.txt"), b"uno").unwrap();
        fs::write(car.join("a (2).txt"), b"dos").unwrap();
        fs::write(car.join(".env"), b"env").unwrap();
        fs::write(car.join("LEEME"), b"leeme").unwrap();
        let antes = contenido(&car);
        let o = c.join("o");
        fs::create_dir_all(&o).unwrap();
        for (n, t) in [("a.txt", "A"), (".env", "E"), ("LEEME", "L")] {
            fs::write(o.join(n), t).unwrap();
        }
        let r = soltar(&config, "p-a", &[o.join("a.txt"), o.join(".env"), o.join("LEEME")].iter().map(|p| p.to_string_lossy().into_owned()).collect::<Vec<_>>(), &sin_reglas()).unwrap();
        assert_eq!(r["copiados"], json!(["a (3).txt", ".env (2)", "LEEME (2)"]), "{r}");
        for (n, h) in &antes {
            assert_eq!(&hash(&car.join(n)), h, "{n}");
        }
        assert_eq!(fs::read(car.join("a (3).txt")).unwrap(), b"A");
        let mut probados = Vec::new();
        for n in ["com1.txt", "nul.txt", "con.txt", "aux.pdf", "lpt1.log"] {
            let normal = o.join(n);
            let verbatim = PathBuf::from(format!(r"\\?\{}", normal.to_string_lossy()));
            let ok = fs::write(&verbatim, n.as_bytes()).is_ok();
            let es_archivo = fs::symlink_metadata(&normal).map(|m| m.is_file()).unwrap_or(false);
            probados.push(format!("{n}: creado={ok} visible_normal={es_archivo}"));
            if !ok {
                continue;
            }
            let r = soltar(&config, "p-a", &r1(&normal), &sin_reglas()).unwrap();
            let en_dest = PathBuf::from(format!(r"\\?\{}", car.join(n).to_string_lossy()));
            probados.push(format!("  -> {r} existe_en_destino={}", en_dest.is_file()));
            if r["copiados"].as_array().unwrap().len() == 1 {
                let como = r["copiados"][0].as_str().unwrap();
                let real = PathBuf::from(format!(r"\\?\{}", car.join(como).to_string_lossy()));
                assert!(real.is_file(), "{n}: dijo copiado y no está: {r}");
            }
        }
        eprintln!("{}", probados.join("\n"));
    }

    #[test]
    fn sonda_mismo_archivo_dos_veces_y_carrera() {
        let c = base();
        let (config, car) = con_carpeta(&c, "p-a", "avis");
        let a = c.join("d.txt");
        fs::write(&a, b"d").unwrap();
        let v = vec![a.to_string_lossy().into_owned(); 2];
        let (c1, c2) = (config.clone(), config.clone());
        let (v1, v2) = (v.clone(), v.clone());
        let t1 = std::thread::spawn(move || soltar(&c1, "p-a", &v1, &sin_reglas()).unwrap());
        let t2 = std::thread::spawn(move || soltar(&c2, "p-a", &v2, &sin_reglas()).unwrap());
        let (r1_, r2_) = (t1.join().unwrap(), t2.join().unwrap());
        let mut todos: Vec<String> = r1_["copiados"].as_array().unwrap().iter().chain(r2_["copiados"].as_array().unwrap()).map(|x| x.as_str().unwrap().to_string()).collect();
        todos.sort();
        todos.dedup();
        assert_eq!(todos.len(), 4, "{r1_} {r2_}");
        assert_eq!(contenido(&car).len(), 4);
    }
}
