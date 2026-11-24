// Tests de modelo.rs (#11, docs/diseno/resumen-ia-ux.md 8 y 12). No bajan nada ni levantan
// llama-server: las descargas y el motor se prueban contra servidores falsos en 127.0.0.1.
use super::*;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::sync::atomic::AtomicUsize;
use std::thread::JoinHandle;

// ---------------------------------------------------------------- ayudas

static CONTADOR: AtomicUsize = AtomicUsize::new(0);

/// Una carpeta temporal propia de cada test, fuera del repositorio (se borra al final del test).
fn carpeta_temporal() -> PathBuf {
    let n = CONTADOR.fetch_add(1, Ordering::SeqCst);
    let c = std::env::temp_dir().join(format!("avis-ia-test-{}-{n}", std::process::id()));
    let _ = fs::remove_dir_all(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

fn http(estado: &str, cabeceras: &[(&str, String)], cuerpo: &[u8]) -> Vec<u8> {
    let mut r = format!("HTTP/1.1 {estado}\r\nContent-Length: {}\r\nConnection: close\r\n", cuerpo.len());
    for (k, v) in cabeceras {
        r.push_str(&format!("{k}: {v}\r\n"));
    }
    r.push_str("\r\n");
    let mut b = r.into_bytes();
    b.extend_from_slice(cuerpo);
    b
}

/// Un servidor HTTP falso en 127.0.0.1 que atiende `veces` conexiones con `manejar(pedido, puerto)`
/// y devuelve los pedidos que recibió.
fn servidor(veces: usize, manejar: impl Fn(&str, u16) -> Vec<u8> + Send + 'static) -> (u16, JoinHandle<Vec<String>>) {
    let escucha = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let puerto = escucha.local_addr().unwrap().port();
    let hilo = std::thread::spawn(move || {
        let mut vistos = Vec::new();
        for _ in 0..veces {
            let Ok((mut conexion, _)) = escucha.accept() else { break };
            let mut lector = BufReader::new(conexion.try_clone().unwrap());
            let mut pedido = String::new();
            let mut largo = 0usize;
            loop {
                let mut linea = String::new();
                if lector.read_line(&mut linea).unwrap_or(0) == 0 || linea == "\r\n" {
                    break;
                }
                if let Some(v) = linea.to_lowercase().strip_prefix("content-length:") {
                    largo = v.trim().parse().unwrap_or(0);
                }
                pedido.push_str(&linea);
            }
            let mut cuerpo = vec![0u8; largo];
            let _ = lector.read_exact(&mut cuerpo);
            pedido.push_str("\r\n");
            pedido.push_str(&String::from_utf8_lossy(&cuerpo));
            let _ = conexion.write_all(&manejar(&pedido, puerto));
            vistos.push(pedido);
        }
        vistos
    });
    (puerto, hilo)
}

fn rango(pedido: &str) -> Option<u64> {
    let l = pedido.to_lowercase();
    let i = l.find("range: bytes=")? + "range: bytes=".len();
    l[i..].split('-').next()?.trim().parse().ok()
}

fn hex(b: &[u8]) -> String {
    sha256_hex(b, &|| false).unwrap().unwrap()
}

/// Una pieza del modelo de prueba servida desde 127.0.0.1 (el SHA-256 se calcula de `contenido`).
fn pieza_local(puerto: u16, contenido: &[u8]) -> Pieza {
    let sha: &'static str = Box::leak(hex(contenido).into_boxed_str());
    Pieza { archivo: "modelo-de-prueba.gguf", url: format!("http://127.0.0.1:{puerto}/archivo"), bytes: contenido.len() as u64, sha256: sha, tipo: Tipo::Modelo }
}

fn agente_de_prueba() -> ureq::Agent {
    ureq::Agent::config_builder().http_status_as_error(false).proxy(None).timeout_global(Some(Duration::from_secs(10))).build().into()
}

const CONTENIDO: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";

/// Sirve CONTENIDO respetando Range (206) desde el byte pedido.
fn sirve_con_rango(pedido: &str, _: u16) -> Vec<u8> {
    match rango(pedido) {
        Some(n) => http("206 Partial Content", &[("Content-Range", format!("bytes {n}-{}/{}", CONTENIDO.len() - 1, CONTENIDO.len()))], &CONTENIDO[n as usize..]),
        None => http("200 OK", &[], CONTENIDO),
    }
}

// ---------------------------------------------------------------- qué se baja

#[test]
fn la_url_del_modelo_queda_fija_al_commit_y_nunca_a_main() {
    let m = pieza_modelo();
    assert_eq!(m.url, format!("https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/{COMMIT_MODELO}/{ARCHIVO_MODELO}"));
    assert!(!m.url.contains("/resolve/main/"));
    assert_eq!(COMMIT_MODELO.len(), 40);
    assert_eq!(m.bytes, 2_497_281_120);
    assert_eq!(m.sha256, "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597");
}

#[test]
fn las_urls_del_motor_son_las_de_la_version_b12606() {
    for v in [Variante::Cuda, Variante::Cpu] {
        for p in plan(v).iter().filter(|p| p.tipo != Tipo::Modelo) {
            assert_eq!(p.url, format!("https://github.com/ggml-org/llama.cpp/releases/download/b12606/{}", p.archivo));
            assert_eq!(p.sha256.len(), 64);
        }
    }
}

#[test]
fn con_nvidia_se_baja_cuda_con_cudart_y_el_modelo() {
    assert_eq!(variante_a_bajar(true), Variante::Cuda);
    let p = plan(Variante::Cuda);
    let archivos: Vec<&str> = p.iter().map(|p| p.archivo).collect();
    assert_eq!(archivos, ["llama-b12606-bin-win-cuda-12.4-x64.zip", "cudart-llama-bin-win-cuda-12.4-x64.zip", ARCHIVO_MODELO]);
    assert_eq!(p.iter().map(|p| p.bytes).sum::<u64>(), 357_938_811 + 391_443_627 + 2_497_281_120);
    // cudart va en la misma carpeta que el zip de CUDA
    assert_eq!(p[1].tipo, Tipo::Motor(Variante::Cuda));
}

#[test]
fn sin_nvidia_se_baja_el_motor_de_cpu_y_el_modelo() {
    assert_eq!(variante_a_bajar(false), Variante::Cpu);
    let p = plan(Variante::Cpu);
    assert_eq!(p[0].archivo, "llama-b12606-bin-win-cpu-x64.zip");
    assert_eq!(p[0].bytes, 25_009_049);
    assert_eq!(p.iter().map(|p| p.bytes).sum::<u64>(), 25_009_049 + 2_497_281_120);
}

#[test]
fn nvidia_se_detecta_por_la_lista_de_nvidia_smi() {
    assert!(hay_nvidia(true, "GPU 0: NVIDIA GeForce GTX 1650 Ti (UUID: GPU-db77407a)\n"));
    assert!(!hay_nvidia(false, "GPU 0: NVIDIA GeForce GTX 1650 Ti\n"));
    assert!(!hay_nvidia(true, "NVIDIA-SMI has failed because it couldn't communicate with the NVIDIA driver.\n"));
    assert!(!hay_nvidia(true, ""));
}

// ---------------------------------------------------------------- el motor

#[test]
fn el_motor_escucha_solo_en_127_0_0_1_sin_interfaz_web() {
    let a = argumentos(Path::new(r"C:\ia\modelo.gguf"), 4321, Variante::Cpu);
    let i = a.iter().position(|x| x == "--host").unwrap();
    assert_eq!(a[i + 1], "127.0.0.1");
    for (k, v) in [("-m", r"C:\ia\modelo.gguf"), ("--port", "4321"), ("-c", "4096"), ("-np", "1")] {
        let i = a.iter().position(|x| x == k).unwrap();
        assert_eq!(a[i + 1], v);
    }
    assert!(a.contains(&"--no-webui".to_string()));
    assert!(!a.iter().any(|x| x == "0.0.0.0"));
}

#[test]
fn en_cpu_va_sin_dispositivo_y_en_cuda_con_todas_las_capas_en_la_placa() {
    let cpu = argumentos(Path::new("m.gguf"), 1, Variante::Cpu);
    assert_eq!(&cpu[cpu.len() - 4..], ["-dev", "none", "-ngl", "0"]);
    let cuda = argumentos(Path::new("m.gguf"), 1, Variante::Cuda);
    assert_eq!(&cuda[cuda.len() - 4..], ["-dev", "CUDA0", "-ngl", "99"]);
}

#[test]
fn se_arranca_con_cuda_y_si_fallo_con_el_mismo_motor_en_cpu() {
    assert_eq!(elegir_arranque(true, false, false), Some(Arranque { motor: Variante::Cuda, dispositivo: Variante::Cuda }));
    // CUDA falló: el zip de CUDA trae el backend de CPU, no se baja nada más
    assert_eq!(elegir_arranque(true, false, true), Some(Arranque { motor: Variante::Cuda, dispositivo: Variante::Cpu }));
    assert_eq!(elegir_arranque(false, true, false), Some(Arranque { motor: Variante::Cpu, dispositivo: Variante::Cpu }));
    assert_eq!(elegir_arranque(false, false, false), None);
}

#[test]
fn solo_un_cierre_al_arrancar_con_cuda_hace_probar_en_cpu() {
    let cuda = Arranque { motor: Variante::Cuda, dispositivo: Variante::Cuda };
    let cpu = Arranque { motor: Variante::Cuda, dispositivo: Variante::Cpu };
    assert!(probar_en_cpu(&FinArranque::Salio(Some(-1073741819), String::new()), cuda));
    assert!(!probar_en_cpu(&FinArranque::Salio(Some(1), String::new()), cpu));
    assert!(!probar_en_cpu(&FinArranque::Tiempo, cuda));
    assert!(!probar_en_cpu(&FinArranque::Cancelado, cuda));
}

#[test]
fn el_detalle_del_cierre_lleva_el_codigo_de_salida_de_windows() {
    // 0xC0000005 llega como i32 negativo
    assert_eq!(detalle_salida(Some(-1073741819), ""), "llama-server · código de salida 3221225477");
    assert_eq!(detalle_salida(Some(1), "  error: no se pudo cargar el modelo \n"), "llama-server · código de salida 1 · error: no se pudo cargar el modelo");
    assert_eq!(detalle_salida(None, ""), "llama-server · se cerró");
}

#[test]
fn el_motor_esta_listo_cuando_health_dice_ok() {
    assert!(salud_lista(200, r#"{"status":"ok"}"#));
    assert!(!salud_lista(503, r#"{"error":{"code":503,"message":"Loading model"}}"#));
    assert!(!salud_lista(200, "ok"));
}

#[test]
fn el_motor_se_apaga_tras_10_minutos_sin_uso_y_nunca_con_un_pedido_corriendo() {
    let t0 = Instant::now();
    assert!(!inactivo(t0, t0 + Duration::from_secs(599), false));
    assert!(inactivo(t0, t0 + Duration::from_secs(600), false));
    assert!(!inactivo(t0, t0 + Duration::from_secs(3600), true));
    // Un reloj que va para atrás no apaga nada
    assert!(!inactivo(t0 + Duration::from_secs(5), t0, false));
}

// ---------------------------------------------------------------- archivos y estado

#[test]
fn lo_bajado_a_medias_lleva_part() {
    assert_eq!(ruta_part(Path::new(r"C:\ia\modelo\m.gguf")), PathBuf::from(r"C:\ia\modelo\m.gguf.part"));
    let base = Path::new(r"C:\ia");
    assert_eq!(ruta_final(base, &pieza_modelo()), base.join("modelo").join(ARCHIVO_MODELO));
    assert_eq!(ruta_final(base, &plan(Variante::Cpu)[0]), base.join("descargas").join("llama-b12606-bin-win-cpu-x64.zip"));
}

#[test]
fn cuanto_falta_bajar() {
    assert_eq!(faltan(1_100_000_000, 2_600_000_000), 1_500_000_000);
    assert_eq!(faltan(10, 5), 0);
}

#[test]
fn se_retoma_desde_lo_bajado() {
    assert_eq!(reanudar(0, 100), Reanudar::Empezar);
    assert_eq!(reanudar(40, 100), Reanudar::Desde(40));
    assert_eq!(reanudar(100, 100), Reanudar::Verificar);
    // Más de lo que debe medir: es otro archivo, se empieza de nuevo
    assert_eq!(reanudar(150, 100), Reanudar::Empezar);
}

#[test]
fn la_respuesta_del_servidor_decide_si_se_agrega_o_se_reescribe() {
    assert_eq!(como_seguir(206, 40), Escritura::Agregar);
    // El servidor ignoró el Range: manda todo y se escribe de cero
    assert_eq!(como_seguir(200, 40), Escritura::DesdeCero);
    assert_eq!(como_seguir(200, 0), Escritura::DesdeCero);
    assert_eq!(como_seguir(416, 40), Escritura::Verificar);
    assert_eq!(como_seguir(404, 0), Escritura::Error(404));
    assert_eq!(como_seguir(416, 0), Escritura::Error(416));
}

#[test]
fn el_sha256_se_calcula_y_se_compara() {
    assert_eq!(hex(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    let c = carpeta_temporal();
    let f = c.join("a.bin");
    fs::write(&f, b"abc").unwrap();
    assert_eq!(verificar(&f, "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD", &|| false).unwrap(), Some(true));
    assert_eq!(verificar(&f, &"0".repeat(64), &|| false).unwrap(), Some(false));
    // Cancelar a mitad de la verificación no decide nada
    assert_eq!(verificar(&f, "x", &|| true).unwrap(), None);
    fs::remove_dir_all(&c).unwrap();
}

#[test]
fn el_progreso_se_avisa_a_lo_sumo_cada_250_ms() {
    let t0 = Instant::now();
    assert!(toca_avisar(None, t0));
    assert!(!toca_avisar(Some(t0), t0 + Duration::from_millis(249)));
    assert!(toca_avisar(Some(t0), t0 + Duration::from_millis(250)));
}

fn pieza(bytes: u64, bajado: u64, hecha: bool) -> EstadoPieza {
    EstadoPieza { bytes, bajado, hecha, mal: false }
}

#[test]
fn sin_nada_bajado_el_modelo_falta_con_el_total_del_plan() {
    assert_eq!(resumir_estado(&[pieza(25, 0, false), pieza(100, 0, false)], false, false, false), (EstadoModelo::Falta, 0, 125));
}

#[test]
fn con_una_descarga_a_medias_falta_pero_informa_lo_bajado() {
    // "Seguir descargando · N de M"
    assert_eq!(resumir_estado(&[pieza(25, 25, true), pieza(100, 40, false)], false, false, false), (EstadoModelo::Falta, 65, 125));
}

#[test]
fn bajando_solo_con_una_descarga_en_curso() {
    assert_eq!(resumir_estado(&[pieza(25, 25, true), pieza(100, 40, false)], false, false, true).0, EstadoModelo::Bajando);
}

#[test]
fn con_todo_instalado_el_modelo_esta_listo() {
    assert_eq!(resumir_estado(&[pieza(25, 25, true), pieza(100, 100, true)], true, false, false), (EstadoModelo::Listo, 125, 125));
    // El motor sin descomprimir todavía no está listo
    assert_eq!(resumir_estado(&[pieza(25, 25, false), pieza(100, 100, true)], true, false, false).0, EstadoModelo::Falta);
}

#[test]
fn un_hash_distinto_un_tamano_raro_o_un_modelo_que_desaparecio_es_roto() {
    let todo = [pieza(25, 25, true), pieza(100, 100, true)];
    assert_eq!(resumir_estado(&todo, true, true, false).0, EstadoModelo::Roto);
    let mal = [pieza(25, 25, true), EstadoPieza { bytes: 100, bajado: 0, hecha: false, mal: true }];
    assert_eq!(resumir_estado(&mal, true, false, false).0, EstadoModelo::Roto);
    let sin_modelo = [pieza(25, 25, true), pieza(100, 0, false)];
    assert_eq!(resumir_estado(&sin_modelo, true, false, false).0, EstadoModelo::Roto);
    // Sin haber estado instalado (o después de "Borrar el modelo"), solo falta
    assert_eq!(resumir_estado(&sin_modelo, false, false, false).0, EstadoModelo::Falta);
}

#[test]
fn en_disco_se_ve_el_part_el_modelo_entero_y_el_que_no_mide_lo_que_debe() {
    let base = carpeta_temporal();
    let m = pieza_modelo();
    let final_ = ruta_final(&base, &m);
    fs::create_dir_all(final_.parent().unwrap()).unwrap();
    fs::write(ruta_part(&final_), vec![0u8; 1000]).unwrap();
    assert_eq!(mirar_pieza(&base, &m), EstadoPieza { bytes: m.bytes, bajado: 1000, hecha: false, mal: false });
    fs::write(&final_, b"corto").unwrap();
    assert!(mirar_pieza(&base, &m).mal);
    // Un zip del motor está hecho cuando tiene su marca de descomprimido
    let zip = &plan(Variante::Cpu)[0];
    assert!(!mirar_pieza(&base, zip).hecha);
    marcar(&carpeta_motor(&base, Variante::Cpu).join(format!(".avis-{}", zip.archivo))).unwrap();
    assert!(mirar_pieza(&base, zip).hecha);
    assert_eq!(mirar_pieza(&base, zip).bajado, zip.bytes);
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn el_servidor_del_motor_se_busca_en_su_carpeta_o_en_una_subcarpeta() {
    let c = carpeta_temporal();
    assert_eq!(buscar_servidor(&c), None);
    fs::create_dir_all(c.join("bin")).unwrap();
    fs::write(c.join("bin").join("llama-server.exe"), b"").unwrap();
    assert_eq!(buscar_servidor(&c), Some(c.join("bin").join("llama-server.exe")));
    fs::write(c.join("llama-server.exe"), b"").unwrap();
    assert_eq!(buscar_servidor(&c), Some(c.join("llama-server.exe")));
    fs::remove_dir_all(&c).unwrap();
}

// ---------------------------------------------------------------- descarga contra un servidor falso

#[test]
fn una_descarga_nueva_se_verifica_y_queda_con_su_nombre() {
    let base = carpeta_temporal();
    let (puerto, hilo) = servidor(1, sirve_con_rango);
    let p = pieza_local(puerto, CONTENIDO);
    let final_ = ruta_final(&base, &p);
    let mut visto = Vec::new();
    bajar_pieza(&agente_de_prueba(), &p, &final_, &|| false, &mut |n| visto.push(n)).unwrap();
    assert_eq!(fs::read(&final_).unwrap(), CONTENIDO);
    assert!(!ruta_part(&final_).exists());
    assert_eq!(visto.last(), Some(&(CONTENIDO.len() as u64)));
    assert_eq!(rango(&hilo.join().unwrap()[0]), None);
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn una_descarga_cortada_se_retoma_con_range_desde_el_part() {
    let base = carpeta_temporal();
    let (puerto, hilo) = servidor(1, sirve_con_rango);
    let p = pieza_local(puerto, CONTENIDO);
    let final_ = ruta_final(&base, &p);
    fs::create_dir_all(final_.parent().unwrap()).unwrap();
    fs::write(ruta_part(&final_), &CONTENIDO[..10]).unwrap();
    bajar_pieza(&agente_de_prueba(), &p, &final_, &|| false, &mut |_| {}).unwrap();
    assert_eq!(rango(&hilo.join().unwrap()[0]), Some(10));
    assert_eq!(fs::read(&final_).unwrap(), CONTENIDO);
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn el_range_sigue_a_traves_de_la_redireccion_al_cdn() {
    // Hugging Face y GitHub redirigen a su CDN: el pedido redirigido tiene que llevar el Range
    let base = carpeta_temporal();
    let (puerto, hilo) = servidor(2, |pedido, puerto| {
        if pedido.starts_with("GET /archivo ") {
            http("302 Found", &[("Location", format!("http://127.0.0.1:{puerto}/cdn"))], b"")
        } else {
            sirve_con_rango(pedido, puerto)
        }
    });
    let p = pieza_local(puerto, CONTENIDO);
    let final_ = ruta_final(&base, &p);
    fs::create_dir_all(final_.parent().unwrap()).unwrap();
    fs::write(ruta_part(&final_), &CONTENIDO[..7]).unwrap();
    bajar_pieza(&agente_de_prueba(), &p, &final_, &|| false, &mut |_| {}).unwrap();
    let pedidos = hilo.join().unwrap();
    assert!(pedidos[1].starts_with("GET /cdn "));
    assert_eq!(rango(&pedidos[1]), Some(7));
    assert_eq!(fs::read(&final_).unwrap(), CONTENIDO);
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn si_el_servidor_ignora_el_range_se_escribe_de_cero() {
    let base = carpeta_temporal();
    let (puerto, _hilo) = servidor(1, |_, _| http("200 OK", &[], CONTENIDO));
    let p = pieza_local(puerto, CONTENIDO);
    let final_ = ruta_final(&base, &p);
    fs::create_dir_all(final_.parent().unwrap()).unwrap();
    fs::write(ruta_part(&final_), b"basura").unwrap();
    bajar_pieza(&agente_de_prueba(), &p, &final_, &|| false, &mut |_| {}).unwrap();
    assert_eq!(fs::read(&final_).unwrap(), CONTENIDO);
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn cancelar_deja_lo_bajado_para_seguir() {
    let base = carpeta_temporal();
    let (puerto, _hilo) = servidor(1, sirve_con_rango);
    let p = pieza_local(puerto, CONTENIDO);
    let final_ = ruta_final(&base, &p);
    fs::create_dir_all(final_.parent().unwrap()).unwrap();
    fs::write(ruta_part(&final_), &CONTENIDO[..5]).unwrap();
    assert_eq!(bajar_pieza(&agente_de_prueba(), &p, &final_, &|| true, &mut |_| {}), Err(FinDescarga::Cancelado));
    assert_eq!(fs::read(ruta_part(&final_)).unwrap(), &CONTENIDO[..5]);
    assert!(!final_.exists());
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn un_archivo_con_otro_hash_se_borra_y_el_modelo_queda_roto() {
    let base = carpeta_temporal();
    let (puerto, _hilo) = servidor(1, |_, _| http("200 OK", &[], b"0123456789abcdefghijklmnopqrstuvwxyZ"));
    let p = pieza_local(puerto, CONTENIDO);
    let final_ = ruta_final(&base, &p);
    let r = bajar_todo(&base, std::slice::from_ref(&p), &agente_de_prueba(), &|| false, &mut |_, _| {});
    assert_eq!(r, Err(FinDescarga::Hash));
    assert!(!final_.exists());
    assert!(!ruta_part(&final_).exists());
    let e = mirar_pieza(&base, &p);
    assert_eq!(resumir_estado(&[e], base.join(MARCA_INSTALADO).exists(), base.join(MARCA_ROTO).exists(), false).0, EstadoModelo::Roto);
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn bajar_todo_avisa_el_progreso_del_plan_y_deja_la_marca_de_instalado() {
    let base = carpeta_temporal();
    marcar(&base.join(MARCA_ROTO)).unwrap();
    let (puerto, _hilo) = servidor(1, sirve_con_rango);
    let p = pieza_local(puerto, CONTENIDO);
    let mut avisos = Vec::new();
    bajar_todo(&base, std::slice::from_ref(&p), &agente_de_prueba(), &|| false, &mut |b, t| avisos.push((b, t))).unwrap();
    let total = CONTENIDO.len() as u64;
    assert_eq!(avisos.last(), Some(&(total, total)));
    assert!(base.join(MARCA_INSTALADO).exists());
    // Volver a descargar saca la marca de roto
    assert!(!base.join(MARCA_ROTO).exists());
    fs::remove_dir_all(&base).unwrap();
}

#[test]
fn solo_la_descarga_arma_un_cliente_para_internet() {
    // Nada sale a la red salvo la descarga (8.4.3): `agente_red` se define una vez y se usa una vez
    // Sin depender de los finales de línea (un clon en Windows con autocrlf tiene CRLF)
    let fuente = include_str!("modelo.rs").replace("\r\n", "\n");
    assert_eq!(fuente.matches("agente_red()").count(), 2);
    let uso = fuente.find("let agente = agente_red();").unwrap();
    let descargar = fuente.find("pub fn descargar(").unwrap();
    let siguiente = fuente[descargar..].find("\n    pub fn ").map(|i| descargar + i).unwrap();
    assert!(uso > descargar && uso < siguiente);
    // El cliente local no usa proxy: nunca sale de la máquina
    assert!(fuente.contains("fn agente_local(espera: Duration) -> ureq::Agent {\n    ureq::Agent::config_builder().http_status_as_error(false).proxy(None)"));
}

// ---------------------------------------------------------------- el pedido al modelo

fn datos_de_ejemplo() -> Value {
    json!({
        "proyectos": [{
            "nombre": "oficina",
            "repo": "quintechlab/oficina",
            "sesiones": [{
                "tarea": 11,
                "rama": "feat/11-resumen-ia",
                "actividad": "editando modelo.rs",
                "lleva": "hace 20 min",
                "usuario": "nicoequintana",
                "nota": "privado",
                "archivos": ["widget/src-tauri/src/modelo.rs"],
                "subagentes": [{ "nombre": "Delfina", "tarea": "boceto", "estado": "trabajando", "desde": "hace 3 min" }],
                "procesos": [{ "descripcion": "cargo test", "desde": "hace 1 min" }],
                "preguntas": [{ "encabezado": "Motor", "pregunta": "¿Probamos con CUDA o con CPU?", "opciones": ["CUDA", "CPU"] }],
                "respuestas": { "Motor": "CUDA" },
            }],
        }],
    })
}

#[test]
fn al_modelo_le_llegan_sesiones_subagentes_procesos_y_el_texto_de_las_preguntas() {
    let t = datos_como_texto(&datos_de_ejemplo());
    for esperado in ["nombre: oficina", "tarea: 11", "rama: feat/11-resumen-ia", "actividad: editando modelo.rs", "Delfina", "cargo test", "¿Probamos con CUDA o con CPU?"] {
        assert!(t.contains(esperado), "falta {esperado:?} en:\n{t}");
    }
}

#[test]
fn nunca_le_llegan_opciones_respuestas_archivos_usuario_nota_ni_repo() {
    let t = datos_como_texto(&datos_de_ejemplo());
    for prohibido in ["opciones", "CPU\n", "- CUDA", "respuestas", "archivos", "nicoequintana", "privado", "quintechlab/oficina", "widget/src-tauri"] {
        assert!(!t.contains(prohibido), "no debería estar {prohibido:?} en:\n{t}");
    }
}

#[test]
fn cada_texto_y_cada_lista_tienen_tope() {
    let largo = "a".repeat(500);
    let muchos: Vec<Value> = (0..20).map(|i| json!({ "tarea": i })).collect();
    let t = datos_como_texto(&json!({ "actividad": largo, "sesiones": muchos }));
    let linea = t.lines().find(|l| l.starts_with("actividad: ")).unwrap();
    assert_eq!(linea.trim_start_matches("actividad: ").chars().count(), TOPE_TEXTO);
    assert_eq!(t.matches("tarea:").count(), TOPE_LISTA);
    assert!(t.contains("(y 8 más)"));
    // Y el texto entero también
    let enorme: Vec<Value> = (0..12).map(|_| json!({ "a": "x".repeat(200), "b": "y".repeat(200), "c": "z".repeat(200) })).collect();
    let t = datos_como_texto(&json!({ "p": [{ "s": enorme.clone() }, { "s": enorme.clone() }, { "s": enorme }] }));
    assert!(t.chars().count() <= TOPE_DATOS + 30);
    assert!(t.ends_with("(… hay más datos)"));
}

#[test]
fn la_instruccion_solo_resume_y_nunca_responde_una_pregunta() {
    for regla in ["2 a 4 frases cortas", "sin listas ni markdown", "No inventes datos", "No recomiendes ni decidas nada", "nunca la respondas ni sugieras una respuesta", "castellano rioplatense"] {
        assert!(INSTRUCCION.contains(regla), "falta {regla:?}");
    }
}

#[test]
fn la_respuesta_del_motor_se_lee_de_choices() {
    let cuerpo = r#"{"choices":[{"index":0,"message":{"role":"assistant","content":"Claude está con el resumen."},"finish_reason":"stop"}]}"#;
    assert_eq!(leer_respuesta(cuerpo), Some((String::from("Claude está con el resumen."), false)));
    let cortado = r#"{"choices":[{"message":{"content":"Claude"},"finish_reason":"length"}]}"#;
    assert_eq!(leer_respuesta(cortado), Some((String::from("Claude"), true)));
    assert_eq!(leer_respuesta("{}"), None);
}

#[test]
fn el_chat_va_al_motor_local_con_el_pedido_entero() {
    let (puerto, hilo) = servidor(1, |_, _| {
        http("200 OK", &[("Content-Type", String::from("application/json"))], br#"{"choices":[{"message":{"content":"Listo."},"finish_reason":"stop"}]}"#)
    });
    let r = chat(puerto, &cuerpo_calentar(), Duration::from_secs(5));
    assert_eq!(r, Ok((String::from("Listo."), false)));
    let pedido = &hilo.join().unwrap()[0];
    assert!(pedido.starts_with("POST /v1/chat/completions "));
    assert!(pedido.contains("\"max_tokens\":1"));
}

#[test]
fn un_error_del_motor_no_es_un_resumen() {
    let (puerto, _hilo) = servidor(1, |_, _| http("500 Internal Server Error", &[], b"boom"));
    assert!(matches!(chat(puerto, &cuerpo_calentar(), Duration::from_secs(5)), Err(ErrorChat::Otro(_))));
}

#[test]
fn un_motor_que_no_contesta_es_tiempo() {
    let escucha = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let puerto = escucha.local_addr().unwrap().port();
    let hilo = std::thread::spawn(move || {
        let (c, _) = escucha.accept().unwrap();
        std::thread::sleep(Duration::from_millis(1500));
        drop(c);
    });
    assert_eq!(chat(puerto, &cuerpo_calentar(), Duration::from_millis(300)), Err(ErrorChat::Tiempo));
    hilo.join().unwrap();
}

// ---------------------------------------------------------------- un pedido por vez y la salida

#[test]
fn al_salir_no_empieza_ninguna_descarga_ni_ningun_pedido() {
    let ia: &'static Ia = Box::leak(Box::new(Ia::default()));
    ia.apagar();
    assert!(ia.descargar(|_| {}).is_err());
    // Ni un turno de la charla: no arranca el motor
    assert_eq!(ia.motor_charla(&|_| {}).err().as_deref(), Some("Avis se está cerrando"));
    assert!(ia.motor.lock().unwrap().is_none());
}

#[test]
fn cancelar_sin_nada_en_curso_no_avisa_nada() {
    let ia = Ia::default();
    let avisos = Mutex::new(Vec::new());
    ia.cancelar(&|v| avisos.lock().unwrap().push(v));
    assert!(avisos.lock().unwrap().is_empty());
}

#[test]
fn cancelar_un_pedido_avisa_cancelado_y_lo_descarta() {
    let ia = Ia::default();
    *ia.en_curso.lock().unwrap() = Some(4);
    let avisos = Mutex::new(Vec::new());
    ia.cancelar(&|v| avisos.lock().unwrap().push(v));
    assert_eq!(avisos.lock().unwrap().as_slice(), [json!({ "tipo": "cancelado", "pedido": 4 })]);
    assert!(ia.en_curso.lock().unwrap().is_none());
}

// ---------------------------------------------------------------- bandeja: borrar el modelo

#[test]
fn borrar_pide_confirmacion_con_lo_que_se_libera() {
    let t = texto_confirmar_borrado(3_246_663_558);
    assert!(t.starts_with("¿Borrar el modelo de IA?"));
    assert!(t.contains("3,2 GB"));
    // Solo "Sí" borra; cerrar el cuadro o "No", nada
    assert!(debe_borrar(IDYES));
    assert!(!debe_borrar(7));
    assert!(!debe_borrar(0));
}

#[test]
fn los_gigas_van_con_una_cifra_y_coma() {
    assert_eq!(formato_gb(2_497_281_120), "2,5 GB");
    assert_eq!(formato_gb(1_100_000_000), "1,1 GB");
    assert_eq!(formato_gb(0), "0,0 GB");
}

#[test]
fn borrar_la_carpeta_quita_todo_y_no_falla_si_no_esta() {
    let c = carpeta_temporal();
    fs::create_dir_all(c.join("motor").join("cuda")).unwrap();
    fs::write(c.join("motor").join("cuda").join("x.dll"), vec![0u8; 10]).unwrap();
    fs::write(c.join("instalado"), b"").unwrap();
    assert_eq!(peso(&c), 10);
    borrar_carpeta(&c).unwrap();
    assert!(!c.exists());
    assert!(borrar_carpeta(&c).is_ok());
    assert_eq!(peso(&c), 0);
}

#[test]
fn al_borrar_el_modelo_la_ventana_recibe_el_estado_nuevo_como_evento() {
    // La UI espera { tipo: 'estado', ...lo mismo que estado_modelo } para volver el globo a "apagado"
    let estado = serde_json::json!({ "modelo": "falta", "bajado": 0, "total": 2497281120u64, "motor": "apagado", "primeraVez": true, "aceleracion": "cpu" });
    let ev = evento_estado(estado.clone());
    assert_eq!(ev["tipo"], "estado");
    for (k, v) in estado.as_object().unwrap() {
        assert_eq!(&ev[k], v, "{k}");
    }
    // Un estado que no es objeto no se inventa: queda solo el tipo
    assert_eq!(evento_estado(serde_json::json!(null)), serde_json::json!({ "tipo": "estado" }));
}

#[test]
fn todo_arranque_que_no_queda_listo_apaga_el_motor_que_lanzo() {
    // El vigilante de 10 min solo arranca con Listo: cualquier otro final no puede dejar el proceso prendido
    assert!(!apaga_tras(&FinArranque::Listo));
    assert!(apaga_tras(&FinArranque::Tiempo));
    assert!(apaga_tras(&FinArranque::NoArranco(String::from("500 al calentar"))));
    assert!(apaga_tras(&FinArranque::Salio(Some(1), String::new())));
    // Cancelado ya lo apagó quien canceló; apagar otra vez no hace daño, pero no hace falta
    assert!(!apaga_tras(&FinArranque::Cancelado));
}

#[test]
fn la_carpeta_base_exige_una_ruta_completa() {
    use std::ffi::OsString;
    assert_eq!(base_desde(Some(OsString::from(r"C:\Users\x\AppData\Local"))), Some(PathBuf::from(r"C:\Users\x\AppData\Local").join("avis-ia")));
    // Vacía, ausente o relativa: no hay carpeta (nunca se borra contra el directorio actual)
    assert_eq!(base_desde(Some(OsString::new())), None);
    assert_eq!(base_desde(None), None);
    assert_eq!(base_desde(Some(OsString::from("rel"))), None);
}

#[test]
fn la_linea_de_diagnostico_dice_el_plan_cada_pieza_y_el_estado() {
    let piezas = plan(Variante::Cuda);
    let hecha = EstadoPieza { bytes: 1, bajado: 1, hecha: true, mal: false };
    let falta = EstadoPieza { bytes: 10, bajado: 4, hecha: false, mal: false };
    let linea = linea_diagnostico("estado", Variante::Cuda, &piezas, &[hecha, falta, hecha], EstadoModelo::Falta, false, true);
    assert!(linea.starts_with("modelo estado: plan=cuda"), "{linea}");
    assert!(linea.contains("llama-b12606-bin-win-cuda-12.4-x64.zip=hecha"), "{linea}");
    assert!(linea.contains("cudart-llama-bin-win-cuda-12.4-x64.zip=falta(4/10)"), "{linea}");
    assert!(linea.contains("Qwen3-4B-Instruct-2507-Q4_K_M.gguf=hecha"), "{linea}");
    assert!(linea.ends_with("modelo=falta bajando=no instalado=si"), "{linea}");
    // Una pieza que no mide lo que debe se ve como "mal"
    let mal = EstadoPieza { bytes: 10, bajado: 0, hecha: false, mal: true };
    assert!(linea_diagnostico("descarga", Variante::Cpu, &plan(Variante::Cpu), &[falta, mal], EstadoModelo::Roto, true, false).contains("=mal"));
}
