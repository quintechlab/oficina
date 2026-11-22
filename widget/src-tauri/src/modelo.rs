//! "¿En qué anda Claude?" (#11, docs/diseno/resumen-ia-ux.md 8): la descarga opcional del modelo y
//! del motor (llama.cpp), el proceso `llama-server` y el resumen.
//!
//! Reglas firmes (8.4):
//! - Nada sale a la red salvo la descarga que el usuario pidió con un clic (`descargar`), con URLs
//!   fijas compiladas en el binario. Solo `agente_red` arma un cliente para internet.
//! - El motor escucha solo en 127.0.0.1 y nunca descarga nada por su cuenta.
//! - El modelo solo resume: la instrucción fija vive acá y la ventana no tiene cómo escribirle.
//!   Este módulo no toca `respuestas/` ni nada de `AskUserQuestion`.
//! - Todo vive en `%LOCALAPPDATA%\avis-ia\` (fuera de OneDrive).
//! - El motor se apaga tras 10 minutos sin uso y con la aplicación.

use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{LazyLock, Mutex, PoisonError};
use std::time::{Duration, Instant};

use crate::primeros_pasos::trabajo::Trabajo;

/// Evento a la ventana con cada novedad (8.2): `{ tipo, ... }`.
pub const EVENTO: &str = "oficina://resumen";

/// El estado (`estado_resumen`) como evento `{ tipo: "estado", ... }`: lo manda la bandeja después
/// de borrar el modelo, así el globo abierto vuelve a "apagado" sin reabrirse.
pub fn evento_estado(estado: Value) -> Value {
    let mut ev = serde_json::Map::new();
    ev.insert(String::from("tipo"), Value::from("estado"));
    if let Value::Object(o) = estado {
        for (k, v) in o {
            if k != "tipo" {
                ev.insert(k, v);
            }
        }
    }
    Value::Object(ev)
}

// ------------------------------------------------------------------ qué se baja (datos medidos)

/// Commit del repositorio del modelo en Hugging Face: la URL queda fija a esta versión del archivo.
pub const COMMIT_MODELO: &str = "a06e946bb6b655725eafa393f4a9745d460374c9";
pub const ARCHIVO_MODELO: &str = "Qwen3-4B-Instruct-2507-Q4_K_M.gguf";
const URL_LLAMA: &str = "https://github.com/ggml-org/llama.cpp/releases/download/b12606/";

/// El motor que corre: con la placa de video NVIDIA (CUDA 12.4) o solo con el procesador.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Variante {
    Cuda,
    Cpu,
}

impl Variante {
    pub fn carpeta(self) -> &'static str {
        match self {
            Variante::Cuda => "cuda",
            Variante::Cpu => "cpu",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tipo {
    Modelo,
    /// Un zip del motor, que se descomprime en `motor\<variante>`.
    Motor(Variante),
}

/// Un archivo que se baja: nombre, URL fija, tamaño y SHA-256 esperados.
#[derive(Clone, Debug, PartialEq)]
pub struct Pieza {
    pub archivo: &'static str,
    pub url: String,
    pub bytes: u64,
    pub sha256: &'static str,
    pub tipo: Tipo,
}

pub fn pieza_modelo() -> Pieza {
    Pieza {
        archivo: ARCHIVO_MODELO,
        url: format!("https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/{COMMIT_MODELO}/{ARCHIVO_MODELO}"),
        bytes: 2_497_281_120,
        sha256: "3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597",
        tipo: Tipo::Modelo,
    }
}

fn pieza_llama(archivo: &'static str, bytes: u64, sha256: &'static str, variante: Variante) -> Pieza {
    Pieza { archivo, url: format!("{URL_LLAMA}{archivo}"), bytes, sha256, tipo: Tipo::Motor(variante) }
}

/// Lo que baja un clic en "Descargar": el motor que corresponde y el modelo. El zip de CUDA trae
/// también el backend de CPU; cudart va en la misma carpeta.
pub fn plan(variante: Variante) -> Vec<Pieza> {
    match variante {
        Variante::Cuda => vec![
            pieza_llama("llama-b12606-bin-win-cuda-12.4-x64.zip", 357_938_811, "23d08378e6771e5a4b8daf139d6ee53191d0ab2acd2cf7777ae9cefc74c9d958", Variante::Cuda),
            pieza_llama("cudart-llama-bin-win-cuda-12.4-x64.zip", 391_443_627, "8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6", Variante::Cuda),
            pieza_modelo(),
        ],
        Variante::Cpu => vec![
            pieza_llama("llama-b12606-bin-win-cpu-x64.zip", 25_009_049, "425eeb2a94a9600dadf369a7c9c7dd0141948921efc0fa9ec7872970fffc845d", Variante::Cpu),
            pieza_modelo(),
        ],
    }
}

/// Con una GPU NVIDIA se baja el motor CUDA; si no, el de CPU.
pub fn variante_a_bajar(nvidia: bool) -> Variante {
    if nvidia {
        Variante::Cuda
    } else {
        Variante::Cpu
    }
}

/// `nvidia-smi -L` lista una línea `GPU 0: NVIDIA …` por placa.
pub fn hay_nvidia(ok: bool, salida: &str) -> bool {
    ok && salida.lines().any(|l| l.trim_start().starts_with("GPU ") && l.contains("NVIDIA"))
}

// ------------------------------------------------------------------ carpetas y archivos

/// `%LOCALAPPDATA%\avis-ia`, fuera de OneDrive.
pub fn carpeta_base() -> Option<PathBuf> {
    base_desde(std::env::var_os("LOCALAPPDATA"))
}

/// La carpeta a partir del valor de `LOCALAPPDATA`: solo una ruta completa. Vacía, ausente o
/// relativa no da carpeta, así nada se baja ni se borra contra el directorio actual.
pub fn base_desde(valor: Option<std::ffi::OsString>) -> Option<PathBuf> {
    valor.map(PathBuf::from).filter(|d| d.is_absolute()).map(|d| d.join("avis-ia"))
}

/// Dónde queda la pieza ya verificada: el modelo en `modelo\`, los zips en `descargas\` (hasta
/// descomprimirlos).
pub fn ruta_final(base: &Path, pieza: &Pieza) -> PathBuf {
    match pieza.tipo {
        Tipo::Modelo => base.join("modelo").join(pieza.archivo),
        Tipo::Motor(_) => base.join("descargas").join(pieza.archivo),
    }
}

/// Lo bajado a medias: el mismo nombre con `.part`.
pub fn ruta_part(final_: &Path) -> PathBuf {
    let mut nombre = final_.file_name().map(|n| n.to_os_string()).unwrap_or_default();
    nombre.push(".part");
    final_.with_file_name(nombre)
}

pub fn carpeta_motor(base: &Path, variante: Variante) -> PathBuf {
    base.join("motor").join(variante.carpeta())
}

/// La marca de que un zip del motor ya se descomprimió (el zip se borra después).
fn marca_zip(base: &Path, pieza: &Pieza, variante: Variante) -> PathBuf {
    carpeta_motor(base, variante).join(format!(".avis-{}", pieza.archivo))
}

/// Marcas sueltas en la carpeta base.
const MARCA_ROTO: &str = "roto";
const MARCA_INSTALADO: &str = "instalado";
const MARCA_CUDA_FALLO: &str = "cuda-fallo";
const MARCA_CALENTADO: &str = ".calentado";
const LOG_MOTOR: &str = "motor.log";

fn marcar(ruta: &Path) -> std::io::Result<()> {
    if let Some(p) = ruta.parent() {
        fs::create_dir_all(p)?;
    }
    fs::write(ruta, b"")
}

fn tamano(ruta: &Path) -> Option<u64> {
    fs::metadata(ruta).ok().filter(|m| m.is_file()).map(|m| m.len())
}

// ------------------------------------------------------------------ estado (solo disco y procesos propios)

/// Lo que hay en disco de una pieza.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct EstadoPieza {
    pub bytes: u64,
    pub bajado: u64,
    pub hecha: bool,
    /// El archivo final está pero no mide lo que debe (se movió o se cortó): modelo roto.
    pub mal: bool,
}

pub fn mirar_pieza(base: &Path, pieza: &Pieza) -> EstadoPieza {
    let final_ = ruta_final(base, pieza);
    let parcial = tamano(&ruta_part(&final_)).unwrap_or(0).min(pieza.bytes);
    let mut e = EstadoPieza { bytes: pieza.bytes, bajado: parcial, ..Default::default() };
    match pieza.tipo {
        Tipo::Modelo => match tamano(&final_) {
            Some(n) if n == pieza.bytes => {
                e.bajado = pieza.bytes;
                e.hecha = true;
            }
            Some(_) => e.mal = true,
            None => {}
        },
        Tipo::Motor(v) => {
            if marca_zip(base, pieza, v).exists() {
                e.bajado = pieza.bytes;
                e.hecha = true;
            } else if tamano(&final_) == Some(pieza.bytes) {
                // Bajado y verificado, falta descomprimirlo
                e.bajado = pieza.bytes;
            }
        }
    }
    e
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EstadoModelo {
    Falta,
    Bajando,
    Listo,
    Roto,
}

impl EstadoModelo {
    pub fn nombre(self) -> &'static str {
        match self {
            EstadoModelo::Falta => "falta",
            EstadoModelo::Bajando => "bajando",
            EstadoModelo::Listo => "listo",
            EstadoModelo::Roto => "roto",
        }
    }
}

/// El estado del modelo a partir de las piezas del plan (la última es el modelo), con los bytes
/// bajados y totales del plan entero. `bajando` solo con una descarga en curso: una descarga a
/// medias sin hilo que la siga es `falta` con `bajado > 0` ("Seguir descargando · N de M").
/// `roto`: el hash no coincidió, el archivo no mide lo que debe, o estuvo instalado y ya no está.
pub fn resumir_estado(piezas: &[EstadoPieza], instalado_antes: bool, roto_marcado: bool, bajando: bool) -> (EstadoModelo, u64, u64) {
    let total = piezas.iter().map(|p| p.bytes).sum();
    let bajado = piezas.iter().map(|p| p.bajado).sum();
    let modelo = piezas.last().copied().unwrap_or_default();
    let desaparecio = instalado_antes && !modelo.hecha && modelo.bajado == 0;
    let estado = if bajando {
        EstadoModelo::Bajando
    } else if roto_marcado || modelo.mal || desaparecio {
        EstadoModelo::Roto
    } else if !piezas.is_empty() && piezas.iter().all(|p| p.hecha) {
        EstadoModelo::Listo
    } else {
        EstadoModelo::Falta
    };
    (estado, bajado, total)
}

/// Línea de diagnóstico para `widget.log` (cuándo y por qué el motor cree que falta algo): el
/// plan, cada pieza (`hecha`, `falta(bajado/bytes)` o `mal`) y el estado que sale. `que`: `estado`
/// o `descarga`.
pub fn linea_diagnostico(que: &str, variante: Variante, piezas: &[Pieza], estados: &[EstadoPieza], modelo: EstadoModelo, bajando: bool, instalado: bool) -> String {
    let si_no = |b: bool| if b { "si" } else { "no" };
    let detalle: Vec<String> = piezas
        .iter()
        .zip(estados)
        .map(|(p, e)| {
            let como = if e.hecha {
                String::from("hecha")
            } else if e.mal {
                String::from("mal")
            } else {
                format!("falta({}/{})", e.bajado, e.bytes)
            };
            format!("{}={como}", p.archivo)
        })
        .collect();
    format!(
        "resumen {que}: plan={} {} modelo={} bajando={} instalado={}",
        variante.carpeta(),
        detalle.join(" "),
        modelo.nombre(),
        si_no(bajando),
        si_no(instalado)
    )
}

/// Cuánto falta bajar.
pub fn faltan(bajado: u64, total: u64) -> u64 {
    total.saturating_sub(bajado)
}

fn plan_bajado(base: &Path, piezas: &[Pieza]) -> u64 {
    piezas.iter().map(|p| mirar_pieza(base, p).bajado).sum()
}

/// Un motor instalado: todos sus zips descomprimidos y `llama-server.exe` adentro.
pub fn motor_instalado(base: &Path, variante: Variante) -> Option<PathBuf> {
    let completo = plan(variante).iter().filter(|p| p.tipo == Tipo::Motor(variante)).all(|p| marca_zip(base, p, variante).exists());
    completo.then(|| buscar_servidor(&carpeta_motor(base, variante))).flatten()
}

/// `llama-server.exe` en la carpeta del motor o en una subcarpeta (por si el zip trae una).
pub fn buscar_servidor(carpeta: &Path) -> Option<PathBuf> {
    let directo = carpeta.join("llama-server.exe");
    if directo.is_file() {
        return Some(directo);
    }
    fs::read_dir(carpeta).ok()?.flatten().map(|e| e.path()).filter(|p| p.is_dir()).map(|p| p.join("llama-server.exe")).find(|p| p.is_file())
}

/// Con qué motor y qué dispositivo se arranca.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Arranque {
    /// La carpeta (el motor instalado).
    pub motor: Variante,
    /// El dispositivo: CUDA o solo CPU (el zip de CUDA también trae el backend de CPU).
    pub dispositivo: Variante,
}

/// Con CUDA instalado se arranca con la placa, salvo que ya haya fallado: entonces con el mismo
/// motor en CPU (sin bajar nada más). Sin CUDA, el de CPU si está.
pub fn elegir_arranque(cuda_instalado: bool, cpu_instalado: bool, cuda_fallo: bool) -> Option<Arranque> {
    match (cuda_instalado, cpu_instalado) {
        (true, _) if !cuda_fallo => Some(Arranque { motor: Variante::Cuda, dispositivo: Variante::Cuda }),
        (true, _) => Some(Arranque { motor: Variante::Cuda, dispositivo: Variante::Cpu }),
        (false, true) => Some(Arranque { motor: Variante::Cpu, dispositivo: Variante::Cpu }),
        (false, false) => None,
    }
}

/// `gpu` o `cpu` para la ventana.
pub fn aceleracion(dispositivo: Variante) -> &'static str {
    match dispositivo {
        Variante::Cuda => "gpu",
        Variante::Cpu => "cpu",
    }
}

/// Los argumentos de `llama-server`: siempre en 127.0.0.1, sin interfaz web, un pedido a la vez.
pub fn argumentos(modelo: &Path, puerto: u16, dispositivo: Variante) -> Vec<String> {
    let mut a: Vec<String> = vec![
        "-m".into(),
        modelo.to_string_lossy().into_owned(),
        "--host".into(),
        "127.0.0.1".into(),
        "--port".into(),
        puerto.to_string(),
        "-c".into(),
        "4096".into(),
        "-np".into(),
        "1".into(),
        "--no-webui".into(),
    ];
    let propios: [&str; 4] = match dispositivo {
        Variante::Cpu => ["-dev", "none", "-ngl", "0"],
        Variante::Cuda => ["-dev", "CUDA0", "-ngl", "99"],
    };
    a.extend(propios.iter().map(|s| s.to_string()));
    a
}

// ------------------------------------------------------------------ descarga (con Range y SHA-256)

/// Cómo seguir con un `.part` de `n` bytes.
#[derive(Debug, PartialEq, Eq)]
pub enum Reanudar {
    /// Nada bajado (o más de lo que debe: se tira): desde el principio.
    Empezar,
    /// Pedir el resto con `Range: bytes=n-`.
    Desde(u64),
    /// Ya está entero: solo verificar.
    Verificar,
}

pub fn reanudar(parcial: u64, total: u64) -> Reanudar {
    match parcial {
        0 => Reanudar::Empezar,
        n if n < total => Reanudar::Desde(n),
        n if n == total => Reanudar::Verificar,
        _ => Reanudar::Empezar,
    }
}

/// Qué hacer con la respuesta del servidor a un pedido desde `desde`.
#[derive(Debug, PartialEq, Eq)]
pub enum Escritura {
    /// 206: se agrega al `.part`.
    Agregar,
    /// 200: el servidor manda el archivo entero, se escribe de cero.
    DesdeCero,
    /// 416: el `.part` ya tiene todo (o algo raro): se verifica.
    Verificar,
    Error(u16),
}

pub fn como_seguir(estado: u16, desde: u64) -> Escritura {
    match estado {
        206 if desde > 0 => Escritura::Agregar,
        200 | 206 => Escritura::DesdeCero,
        416 if desde > 0 => Escritura::Verificar,
        e => Escritura::Error(e),
    }
}

/// SHA-256 en hexadecimal de lo que se lea, cortando si `cancelar` lo pide.
pub fn sha256_hex(mut r: impl Read, cancelar: &dyn Fn() -> bool) -> std::io::Result<Option<String>> {
    let mut h = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        if cancelar() {
            return Ok(None);
        }
        let n = r.read(&mut buf)?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(Some(h.finalize().iter().map(|b| format!("{b:02x}")).collect()))
}

/// ¿El archivo tiene el hash esperado? `None`: se canceló.
pub fn verificar(ruta: &Path, esperado: &str, cancelar: &dyn Fn() -> bool) -> std::io::Result<Option<bool>> {
    Ok(sha256_hex(File::open(ruta)?, cancelar)?.map(|h| h.eq_ignore_ascii_case(esperado)))
}

/// ¿Toca avisar el progreso? A lo sumo uno cada 250 ms (8.2).
pub fn toca_avisar(ultimo: Option<Instant>, ahora: Instant) -> bool {
    ultimo.is_none_or(|u| ahora.saturating_duration_since(u) >= Duration::from_millis(250))
}

/// Cómo terminó la descarga de una pieza o de todo el plan.
#[derive(Debug, PartialEq)]
pub enum FinDescarga {
    Cancelado,
    /// No se pudo bajar (red, disco, servidor): motivo `descarga`.
    Fallo(String),
    /// El archivo bajado no coincide con el hash fijo: se borró.
    Hash,
}

/// El único cliente que sale a internet (8.4.3): solo lo usa `bajar_pieza`, con URLs fijas.
fn agente_red() -> ureq::Agent {
    ureq::Agent::config_builder()
        .http_status_as_error(false)
        .user_agent("Avis")
        .timeout_connect(Some(Duration::from_secs(20)))
        .timeout_recv_response(Some(Duration::from_secs(60)))
        // Una conexión que se queda quieta no retiene la descarga ni "Cancelar" para siempre
        .timeout_per_read(Some(Duration::from_secs(30)))
        .build()
        .into()
}

/// Baja una pieza a su `.part` (retomando lo que haya con Range), verifica el SHA-256 y la deja con
/// su nombre final. `avance` recibe los bytes que tiene el `.part` en cada momento.
pub fn bajar_pieza(agente: &ureq::Agent, pieza: &Pieza, final_: &Path, cancelar: &dyn Fn() -> bool, avance: &mut dyn FnMut(u64)) -> Result<(), FinDescarga> {
    let disco = |e: std::io::Error| FinDescarga::Fallo(format!("disco: {e}"));
    let part = ruta_part(final_);
    if let Some(p) = final_.parent() {
        fs::create_dir_all(p).map_err(disco)?;
    }
    let parcial = tamano(&part).unwrap_or(0);
    let desde = match reanudar(parcial, pieza.bytes) {
        Reanudar::Empezar => 0,
        Reanudar::Desde(n) => n,
        Reanudar::Verificar => pieza.bytes,
    };
    avance(desde);
    if desde < pieza.bytes {
        let mut pedido = agente.get(&pieza.url);
        if desde > 0 {
            pedido = pedido.header("Range", format!("bytes={desde}-"));
        }
        let mut respuesta = pedido.call().map_err(|e| FinDescarga::Fallo(format!("red: {e}")))?;
        let estado = respuesta.status().as_u16();
        let mut archivo = match como_seguir(estado, desde) {
            Escritura::Agregar => OpenOptions::new().append(true).open(&part).map_err(disco)?,
            Escritura::DesdeCero => File::create(&part).map_err(disco)?,
            Escritura::Verificar => {
                // 416 con el .part a medias: el archivo del servidor no es el esperado; el hash decide
                drop(respuesta);
                return terminar_pieza(pieza, final_, &part, cancelar);
            }
            Escritura::Error(e) => return Err(FinDescarga::Fallo(format!("el servidor respondió {e}"))),
        };
        let mut escrito = if estado == 206 { desde } else { 0 };
        avance(escrito);
        let mut lector = respuesta.body_mut().as_reader();
        let mut buf = vec![0u8; 256 * 1024];
        loop {
            if cancelar() {
                return Err(FinDescarga::Cancelado);
            }
            let n = lector.read(&mut buf).map_err(|e| FinDescarga::Fallo(format!("red: {e}")))?;
            if n == 0 {
                break;
            }
            // Nunca más de lo que debe medir: lo de más sería otro archivo
            if escrito + n as u64 > pieza.bytes {
                return Err(descartar(&part, FinDescarga::Fallo(String::from("el servidor mandó más bytes de los esperados"))));
            }
            archivo.write_all(&buf[..n]).map_err(disco)?;
            escrito += n as u64;
            avance(escrito);
        }
        archivo.flush().map_err(disco)?;
        if escrito < pieza.bytes {
            // La conexión se cortó: lo bajado queda para seguir
            return Err(FinDescarga::Fallo(format!("la descarga se cortó en {escrito} de {} bytes", pieza.bytes)));
        }
    }
    terminar_pieza(pieza, final_, &part, cancelar)
}

fn descartar(part: &Path, fin: FinDescarga) -> FinDescarga {
    let _ = fs::remove_file(part);
    fin
}

/// Verifica el `.part` entero y lo renombra; si el hash no coincide, lo borra.
fn terminar_pieza(pieza: &Pieza, final_: &Path, part: &Path, cancelar: &dyn Fn() -> bool) -> Result<(), FinDescarga> {
    match verificar(part, pieza.sha256, cancelar) {
        Ok(Some(true)) => fs::rename(part, final_).map_err(|e| FinDescarga::Fallo(format!("disco: {e}"))),
        Ok(Some(false)) => Err(descartar(part, FinDescarga::Hash)),
        Ok(None) => Err(FinDescarga::Cancelado),
        Err(e) => Err(FinDescarga::Fallo(format!("disco: {e}"))),
    }
}

/// `tar.exe` de Windows (bsdtar, descomprime zip), sin consola.
fn descomprimir(zip: &Path, carpeta: &Path) -> Result<(), String> {
    fs::create_dir_all(carpeta).map_err(|e| format!("disco: {e}"))?;
    let raiz = std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    let tar = raiz.join("System32").join("tar.exe");
    let mut c = Command::new(&tar);
    c.arg("-xf").arg(zip).arg("-C").arg(carpeta).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    sin_consola(&mut c);
    let salida = c.output().map_err(|e| format!("no se pudo correr tar: {e}"))?;
    if salida.status.success() {
        Ok(())
    } else {
        let error = String::from_utf8_lossy(&salida.stderr);
        Err(format!("tar: {}", error.lines().find(|l| !l.trim().is_empty()).unwrap_or("sin detalle")))
    }
}

fn sin_consola(c: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW
        c.creation_flags(0x0800_0000);
    }
    #[cfg(not(windows))]
    let _ = c;
}

/// Baja el plan entero: cada pieza que falte, cada zip descomprimido en su carpeta, y la marca de
/// instalado al final. `progreso` recibe `(bajado, total)` del plan.
pub fn bajar_todo(base: &Path, piezas: &[Pieza], agente: &ureq::Agent, cancelar: &dyn Fn() -> bool, progreso: &mut dyn FnMut(u64, u64)) -> Result<(), FinDescarga> {
    let total: u64 = piezas.iter().map(|p| p.bytes).sum();
    let _ = fs::remove_file(base.join(MARCA_ROTO));
    let mut previas = 0u64;
    for pieza in piezas {
        let estado = mirar_pieza(base, pieza);
        let final_ = ruta_final(base, pieza);
        if estado.mal {
            let _ = fs::remove_file(&final_);
        }
        if !estado.hecha {
            if tamano(&final_) != Some(pieza.bytes) {
                let r = bajar_pieza(agente, pieza, &final_, cancelar, &mut |n| progreso(previas + n, total));
                if r == Err(FinDescarga::Hash) && pieza.tipo == Tipo::Modelo {
                    // 8.4.4: el modelo que no coincide se borró y queda "roto" (sin modelo)
                    let _ = marcar(&base.join(MARCA_ROTO));
                }
                r?;
            }
            if let Tipo::Motor(v) = pieza.tipo {
                if cancelar() {
                    return Err(FinDescarga::Cancelado);
                }
                descomprimir(&final_, &carpeta_motor(base, v)).map_err(FinDescarga::Fallo)?;
                marcar(&marca_zip(base, pieza, v)).map_err(|e| FinDescarga::Fallo(format!("disco: {e}")))?;
                let _ = fs::remove_file(&final_);
            }
        }
        previas += pieza.bytes;
        progreso(previas, total);
    }
    marcar(&base.join(MARCA_INSTALADO)).map_err(|e| FinDescarga::Fallo(format!("disco: {e}")))
}

// ------------------------------------------------------------------ pedido al modelo

/// La instrucción fija (8.4.1): solo resume, en la voz del Avi. Vive acá, no en la ventana.
pub const INSTRUCCION: &str = "Sos el Avi, la mascota de Avis, el panel de escritorio que muestra en qué anda Claude Code. \
Respondés en castellano rioplatense, hablando de vos, en 2 a 4 frases cortas, sin listas ni markdown. \
Solo resumís los datos que te paso. No inventes datos. No recomiendes ni decidas nada. \
Si hay una pregunta pendiente, podés decir que la hay y de qué trata, pero nunca la respondas ni sugieras una respuesta.";
/// La pregunta de cada pedido (la medida en esta PC, tal cual).
pub const PREGUNTA: &str = "En que anda Claude? Resumime lo importante.";
pub const MAX_TOKENS: u32 = 160;
/// Topes de lo que se le pasa (8.3), por si la ventana manda de más.
pub const TOPE_TEXTO: usize = 200;
pub const TOPE_LISTA: usize = 12;
/// Caracteres de datos como mucho: entra holgado en el contexto de 4096 con la instrucción y la respuesta.
pub const TOPE_DATOS: usize = 6000;
/// Lo que nunca se le pasa al modelo (8.3), aunque llegue: así no tiene de qué elegir ni qué filtrar.
pub const CLAVES_PROHIBIDAS: [&str; 10] = ["archivos", "usuario", "nota", "opciones", "options", "respuestas", "answers", "libres", "repo", "borrador"];
/// Largo máximo del resumen (como `limpiarTexto` de la ventana, 4.3).
pub const TOPE_RESPUESTA: usize = 600;

fn recortar_texto(s: &str, tope: usize) -> String {
    let limpio = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if limpio.chars().count() <= tope {
        return limpio;
    }
    let mut corto: String = limpio.chars().take(tope.saturating_sub(1)).collect();
    corto.push('…');
    corto
}

fn escribir_datos(v: &Value, nivel: usize, salida: &mut String) {
    let sangria = "  ".repeat(nivel);
    let escalar = |x: &Value| -> Option<String> {
        match x {
            Value::String(s) => Some(recortar_texto(s, TOPE_TEXTO)),
            Value::Number(n) => Some(n.to_string()),
            Value::Bool(b) => Some(if *b { "sí".into() } else { "no".into() }),
            _ => None,
        }
    };
    match v {
        Value::Object(m) => {
            for (k, x) in m {
                if CLAVES_PROHIBIDAS.contains(&k.as_str()) || x.is_null() {
                    continue;
                }
                match escalar(x) {
                    Some(t) => salida.push_str(&format!("{sangria}{k}: {t}\n")),
                    None => {
                        if x.as_array().is_some_and(|a| a.is_empty()) || x.as_object().is_some_and(|o| o.is_empty()) {
                            continue;
                        }
                        salida.push_str(&format!("{sangria}{k}:\n"));
                        escribir_datos(x, nivel + 1, salida);
                    }
                }
            }
        }
        Value::Array(a) => {
            for x in a.iter().take(TOPE_LISTA) {
                match escalar(x) {
                    Some(t) => salida.push_str(&format!("{sangria}- {t}\n")),
                    None if x.is_null() => {}
                    None => {
                        salida.push_str(&format!("{sangria}-\n"));
                        escribir_datos(x, nivel + 1, salida);
                    }
                }
            }
            if a.len() > TOPE_LISTA {
                salida.push_str(&format!("{sangria}- (y {} más)\n", a.len() - TOPE_LISTA));
            }
        }
        x => {
            if let Some(t) = escalar(x) {
                salida.push_str(&format!("{sangria}{t}\n"));
            }
        }
    }
}

/// Los datos que manda la ventana, como texto con sangría (menos tokens que JSON), sin las claves
/// prohibidas, con cada texto y cada lista recortados, y cortado a `TOPE_DATOS` en un fin de línea.
pub fn datos_como_texto(datos: &Value) -> String {
    let mut s = String::new();
    escribir_datos(datos, 0, &mut s);
    if s.chars().count() > TOPE_DATOS {
        let corte: String = s.chars().take(TOPE_DATOS).collect();
        let fin = corte.rfind('\n').unwrap_or(corte.len());
        s = format!("{}\n(… hay más datos)\n", &corte[..fin]);
    }
    s.trim_end().to_string()
}

/// El cuerpo de `POST /v1/chat/completions`.
pub fn cuerpo_pedido(datos: &Value) -> Value {
    let usuario = format!("Datos de Avis:\n{}\n\n{PREGUNTA}", datos_como_texto(datos));
    json!({
        "messages": [
            { "role": "system", "content": INSTRUCCION },
            { "role": "user", "content": usuario },
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": 0,
        "cache_prompt": true,
        "stream": false,
    })
}

/// Un pedido mínimo para que el motor termine de despertar (la primera respuesta con CUDA tarda).
pub fn cuerpo_calentar() -> Value {
    json!({
        "messages": [
            { "role": "system", "content": INSTRUCCION },
            { "role": "user", "content": "Hola" },
        ],
        "max_tokens": 1,
        "temperature": 0,
        "cache_prompt": true,
        "stream": false,
    })
}

fn fin_de_frase(c: char) -> bool {
    matches!(c, '.' | '!' | '?' | '…')
}

/// El texto que vuelve: sin bloques `<think>`, sin marcas de markdown, sin espacios ni saltos de
/// más, cortado a 600 caracteres en el último fin de frase (o en el último fin de frase si el
/// modelo se quedó sin tokens, `cortado`). `None` si queda vacío.
pub fn recortar_respuesta(texto: &str, cortado: bool) -> Option<String> {
    let mut t = texto.to_string();
    while let Some(i) = t.find("<think>") {
        match t[i..].find("</think>") {
            Some(j) => t.replace_range(i..i + j + "</think>".len(), ""),
            None => t.truncate(i),
        }
    }
    let t = t.replace("**", "").replace("__", "").replace('`', "");
    let mut lineas: Vec<String> = Vec::new();
    for l in t.lines() {
        let l = l.trim().trim_start_matches(['#', '>']).trim();
        let l = l.split_whitespace().collect::<Vec<_>>().join(" ");
        if l.is_empty() && lineas.last().is_none_or(|u| u.is_empty()) {
            continue;
        }
        lineas.push(l);
    }
    while lineas.last().is_some_and(|l| l.is_empty()) {
        lineas.pop();
    }
    let mut t = lineas.join("\n");
    let largo = t.chars().count();
    if largo > TOPE_RESPUESTA || cortado {
        let corte: String = t.chars().take(TOPE_RESPUESTA).collect();
        t = match corte.char_indices().rfind(|(_, c)| fin_de_frase(*c)) {
            Some((i, c)) => corte[..i + c.len_utf8()].to_string(),
            None if largo > TOPE_RESPUESTA => format!("{}…", corte.trim_end()),
            None => corte,
        };
    }
    let t = t.trim().to_string();
    (!t.is_empty()).then_some(t)
}

/// El texto y si se cortó por tokens, de la respuesta del motor.
pub fn leer_respuesta(cuerpo: &str) -> Option<(String, bool)> {
    let v: Value = serde_json::from_str(cuerpo).ok()?;
    let eleccion = &v["choices"][0];
    let texto = eleccion["message"]["content"].as_str()?.to_string();
    Some((texto, eleccion["finish_reason"] == "length"))
}

/// `GET /health` → `{"status":"ok"}` cuando el modelo terminó de cargar (antes, 503).
pub fn salud_lista(estado: u16, cuerpo: &str) -> bool {
    estado == 200 && serde_json::from_str::<Value>(cuerpo).is_ok_and(|v| v["status"] == "ok")
}

// ------------------------------------------------------------------ pedidos: uno por vez (8.4.6)

/// ¿Se acepta un pedido? Si hay otro en curso, solo uno más nuevo (gana el más alto). Sin ninguno en
/// curso, cualquiera (la ventana recargada vuelve a contar desde 1).
pub fn aceptar(pedido: u64, en_curso: Option<u64>) -> bool {
    en_curso.is_none_or(|c| pedido > c)
}

/// ¿Sigue valiendo un pedido? Solo el que está en curso; uno viejo o cancelado se descarta.
pub fn vigente(pedido: u64, en_curso: Option<u64>) -> bool {
    en_curso == Some(pedido)
}

/// ¿Hay que apagar el motor? Tras 10 minutos sin uso y sin ningún pedido corriendo.
pub const INACTIVIDAD: Duration = Duration::from_secs(10 * 60);

pub fn inactivo(ultimo_uso: Instant, ahora: Instant, ocupado: bool) -> bool {
    !ocupado && ahora.saturating_duration_since(ultimo_uso) >= INACTIVIDAD
}

/// Hasta cuándo se espera que el motor cargue (la primera vez con CUDA, ~78 s).
pub const ESPERA_SALUD: Duration = Duration::from_secs(240);
/// Lo que puede tardar la primera respuesta (con CUDA, ~80 s la primera vez).
pub const ESPERA_CALENTAR: Duration = Duration::from_secs(240);
/// Lo que puede tardar un resumen (la ventana corta a los 60 s y cancela).
pub const ESPERA_RESUMEN: Duration = Duration::from_secs(90);

/// Cómo terminó un intento de arrancar el motor.
#[derive(Debug, PartialEq)]
pub enum FinArranque {
    Listo,
    /// El proceso salió antes de estar listo, con su código.
    Salio(Option<i32>, String),
    Tiempo,
    Cancelado,
    NoArranco(String),
}

/// ¿Hay que apagar el motor después de este final de arranque? Sí en todo final que no sea Listo
/// (el vigilante de 10 min solo arranca con Listo) ni Cancelado (ya lo apagó quien canceló).
pub fn apaga_tras(fin: &FinArranque) -> bool {
    !matches!(fin, FinArranque::Listo | FinArranque::Cancelado)
}

/// Con CUDA, si el motor sale con error al arrancar, se prueba en CPU con el mismo motor.
pub fn probar_en_cpu(fin: &FinArranque, a: Arranque) -> bool {
    matches!(fin, FinArranque::Salio(..)) && a.dispositivo == Variante::Cuda
}

/// "llama-server · código de salida N" y la última línea de su registro.
pub fn detalle_salida(codigo: Option<i32>, ultima: &str) -> String {
    let base = match codigo {
        Some(c) => format!("llama-server · código de salida {}", c as u32),
        None => String::from("llama-server · se cerró"),
    };
    let ultima = ultima.trim();
    if ultima.is_empty() {
        base
    } else {
        format!("{base} · {}", recortar_texto(ultima, 140))
    }
}

/// Bytes con una cifra decimal y coma: "2,6 GB" (como `formatoGB` de la ventana).
pub fn formato_gb(bytes: u64) -> String {
    let gb = bytes as f64 / 1e9;
    format!("{:.1} GB", gb).replace('.', ",")
}

/// Botón "Sí" del cuadro de confirmación de Windows (`IDYES`).
pub const IDYES: i32 = 6;

/// El texto del cuadro "Borrar el modelo de IA…" de la bandeja.
pub fn texto_confirmar_borrado(bytes: u64) -> String {
    format!(
        "¿Borrar el modelo de IA?\n\nSe borran de esta PC el modelo y el motor ({}). El resumen con IA queda apagado hasta que lo vuelvas a descargar.",
        formato_gb(bytes)
    )
}

/// Solo el "Sí" del usuario borra: "No" o cerrar el cuadro no hacen nada.
pub fn debe_borrar(respuesta: i32) -> bool {
    respuesta == IDYES
}

// ------------------------------------------------------------------ lo que corre

struct Motor {
    proceso: Child,
    trabajo: Option<Trabajo>,
    puerto: u16,
    arranque: Arranque,
    listo: bool,
    generacion: u64,
}

impl Motor {
    fn matar(&mut self) {
        if let Some(t) = &self.trabajo {
            t.terminar();
        }
        let _ = self.proceso.kill();
        let _ = self.proceso.wait();
    }
}

#[derive(Default)]
struct Descarga {
    activa: bool,
    cancelar: bool,
}

/// El estado de la aplicación: descarga, motor y pedido en curso.
pub struct Ia {
    descarga: Mutex<Descarga>,
    motor: Mutex<Option<Motor>>,
    /// Solo un arranque del motor a la vez (los pedidos esperan acá, no en `motor`).
    arranque: Mutex<()>,
    preparando: AtomicBool,
    en_curso: Mutex<Option<u64>>,
    ocupados: AtomicUsize,
    ultimo_uso: Mutex<Instant>,
    generacion: AtomicU64,
    apagado: AtomicBool,
    nvidia: Mutex<Option<bool>>,
}

impl Default for Ia {
    fn default() -> Self {
        Ia {
            descarga: Mutex::new(Descarga::default()),
            motor: Mutex::new(None),
            arranque: Mutex::new(()),
            preparando: AtomicBool::new(false),
            en_curso: Mutex::new(None),
            ocupados: AtomicUsize::new(0),
            ultimo_uso: Mutex::new(Instant::now()),
            generacion: AtomicU64::new(0),
            apagado: AtomicBool::new(false),
            nvidia: Mutex::new(None),
        }
    }
}

pub static IA: LazyLock<Ia> = LazyLock::new(Ia::default);

fn base() -> Result<PathBuf, String> {
    carpeta_base().ok_or_else(|| String::from("no se conoce la carpeta de datos locales"))
}

/// Emite a la ventana.
pub type Emitir<'a> = &'a (dyn Fn(Value) + Sync);

fn evento(tipo: &str, mut datos: Value) -> Value {
    datos["tipo"] = json!(tipo);
    datos
}

impl Ia {
    fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
        m.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// ¿Hay NVIDIA? Con `nvidia-smi` (sin red, sin consola), una sola vez por arranque de la app.
    fn nvidia(&self) -> bool {
        let mut n = Self::lock(&self.nvidia);
        if let Some(v) = *n {
            return v;
        }
        let raiz = std::env::var_os("SystemRoot").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
        let mut candidatos = vec![raiz.join("System32").join("nvidia-smi.exe")];
        if let Some(pf) = std::env::var_os("ProgramFiles") {
            candidatos.push(PathBuf::from(pf).join("NVIDIA Corporation").join("NVSMI").join("nvidia-smi.exe"));
        }
        let hay = candidatos.iter().find(|p| p.is_file()).is_some_and(|exe| {
            let mut c = Command::new(exe);
            c.arg("-L").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
            sin_consola(&mut c);
            c.output().is_ok_and(|s| hay_nvidia(s.status.success(), &String::from_utf8_lossy(&s.stdout)))
        });
        *n = Some(hay);
        hay
    }

    /// El plan de esta máquina: si CUDA ya está instalado, ese; si no, según la placa.
    fn plan_actual(&self, base: &Path) -> (Variante, Vec<Pieza>) {
        let v = if motor_instalado(base, Variante::Cuda).is_some() { Variante::Cuda } else { variante_a_bajar(self.nvidia()) };
        (v, plan(v))
    }

    fn arranque_actual(&self, base: &Path) -> Option<Arranque> {
        elegir_arranque(
            motor_instalado(base, Variante::Cuda).is_some(),
            motor_instalado(base, Variante::Cpu).is_some(),
            base.join(MARCA_CUDA_FALLO).exists(),
        )
    }

    /// `estado_resumen` (8.1): solo lee disco y procesos propios. Nunca sale a la red.
    pub fn estado(&self) -> Result<Value, String> {
        let base = base()?;
        let (variante, piezas) = self.plan_actual(&base);
        let estados: Vec<EstadoPieza> = piezas.iter().map(|p| mirar_pieza(&base, p)).collect();
        let bajando = Self::lock(&self.descarga).activa;
        let instalado = base.join(MARCA_INSTALADO).exists();
        let (modelo, bajado, total) = resumir_estado(&estados, instalado, base.join(MARCA_ROTO).exists(), bajando);
        // Diagnóstico: si el globo ofrece descargar con todo bajado, acá queda por qué
        registrar(&linea_diagnostico("estado", variante, &piezas, &estados, modelo, bajando, instalado));
        let corriendo = Self::lock(&self.motor).as_mut().and_then(|m| matches!(m.proceso.try_wait(), Ok(None)).then_some((m.listo, m.arranque)));
        let motor = match corriendo {
            Some((true, _)) => "listo",
            _ if self.preparando.load(Ordering::SeqCst) => "preparando",
            Some((false, _)) => "preparando",
            None => "apagado",
        };
        let arranque = corriendo.map(|(_, a)| a).or_else(|| self.arranque_actual(&base));
        let dispositivo = match arranque {
            Some(a) => a.dispositivo,
            None => variante,
        };
        let primera_vez = !carpeta_motor(&base, arranque.map_or(variante, |a| a.motor)).join(calentado(dispositivo)).exists();
        Ok(json!({
            "modelo": modelo.nombre(),
            "bajado": bajado,
            "total": total,
            "motor": motor,
            "primeraVez": primera_vez,
            "aceleracion": aceleracion(dispositivo),
        }))
    }

    /// `descargar_modelo` (8.1): la única salida a la red, solo con el clic. Baja en un hilo lo que
    /// falte del plan y avisa `progreso`, `bajado` o `fallo`.
    pub fn descargar(&'static self, emitir: impl Fn(Value) + Send + Sync + 'static) -> Result<(), String> {
        if self.apagado.load(Ordering::SeqCst) {
            return Err(String::from("Avis se está cerrando"));
        }
        let base = base()?;
        {
            let mut d = Self::lock(&self.descarga);
            if d.activa {
                // Cancelada hace un instante y el hilo sigue vivo: sigue bajando sin empezar otro
                d.cancelar = false;
                return Ok(());
            }
            d.activa = true;
            d.cancelar = false;
        }
        let lanzado = std::thread::Builder::new().name(String::from("avis-ia-descarga")).spawn(move || {
            let agente = agente_red();
            let cancelar = || Self::lock(&self.descarga).cancelar || self.apagado.load(Ordering::SeqCst);
            let fin = loop {
                let (variante, piezas) = self.plan_actual(&base);
                // Diagnóstico: qué piezas ve antes de bajar (las que no están "hecha" se bajan)
                let vistas: Vec<EstadoPieza> = piezas.iter().map(|p| mirar_pieza(&base, p)).collect();
                let instalado = base.join(MARCA_INSTALADO).exists();
                let (antes, _, _) = resumir_estado(&vistas, instalado, base.join(MARCA_ROTO).exists(), false);
                registrar(&linea_diagnostico("descarga", variante, &piezas, &vistas, antes, true, instalado));
                let mut ultimo: Option<Instant> = None;
                let mut progreso = |bajado: u64, total: u64| {
                    let ahora = Instant::now();
                    if toca_avisar(ultimo, ahora) {
                        ultimo = Some(ahora);
                        emitir(evento("progreso", json!({ "bajado": bajado, "total": total })));
                    }
                };
                let r = bajar_todo(&base, &piezas, &agente, &cancelar, &mut progreso);
                let mut d = Self::lock(&self.descarga);
                // Cancelada y vuelta a pedir antes de que el hilo terminara: sigue
                if r == Err(FinDescarga::Cancelado) && !d.cancelar && !self.apagado.load(Ordering::SeqCst) {
                    continue;
                }
                d.activa = false;
                d.cancelar = false;
                break (r, piezas.iter().map(|p| p.bytes).sum::<u64>());
            };
            match fin {
                (Ok(()), total) => emitir(evento("bajado", json!({ "total": total }))),
                // El aviso de "cancelado" ya salió con el clic; lo bajado queda para seguir
                (Err(FinDescarga::Cancelado), total) => {
                    let bajado: u64 = plan_bajado(&base, &self.plan_actual(&base).1);
                    registrar(&format!("resumen: descarga cancelada; faltan {}", formato_gb(faltan(bajado, total))));
                }
                (Err(FinDescarga::Hash), _) => {
                    registrar("resumen: el archivo bajado no coincide con su SHA-256; se borró");
                    emitir(evento("fallo", json!({ "motivo": "falta", "detalle": "el archivo bajado no coincide con el esperado (SHA-256): se borró" })));
                }
                (Err(FinDescarga::Fallo(detalle)), _) => {
                    registrar(&format!("resumen: no se pudo bajar: {detalle}"));
                    emitir(evento("fallo", json!({ "motivo": "descarga", "detalle": detalle })));
                }
            }
        });
        lanzado.map(|_| ()).map_err(|e| {
            Self::lock(&self.descarga).activa = false;
            e.to_string()
        })
    }

    /// `cancelar_resumen` (8.1): corta la descarga (queda el `.part` para seguir), el arranque del
    /// motor (lo apaga) o el pedido en curso (su resultado se descarta). Avisa `cancelado`.
    pub fn cancelar(&self, emitir: Emitir) {
        let bajando = {
            let mut d = Self::lock(&self.descarga);
            if d.activa {
                d.cancelar = true;
            }
            d.activa
        };
        let pedido = Self::lock(&self.en_curso).take();
        if self.preparando.load(Ordering::SeqCst) {
            self.apagar_motor();
        }
        if bajando || pedido.is_some() {
            emitir(evento("cancelado", json!({ "pedido": pedido })));
        }
    }

    /// `pedir_resumen` (8.1): acepta el pedido (gana el más alto) y lo resuelve en un hilo:
    /// `preparando` si hay que arrancar el motor, `pensando`, y `listo` o `fallo`.
    pub fn pedir(&'static self, pedido: u64, datos: Value, emitir: impl Fn(Value) + Send + Sync + 'static) -> Result<(), String> {
        if self.apagado.load(Ordering::SeqCst) {
            return Err(String::from("Avis se está cerrando"));
        }
        if Self::lock(&self.descarga).activa {
            return Err(String::from("todavía se está bajando el modelo"));
        }
        {
            let mut c = Self::lock(&self.en_curso);
            if !aceptar(pedido, *c) {
                return Err(String::from("hay un pedido más nuevo"));
            }
            *c = Some(pedido);
        }
        let lanzado = std::thread::Builder::new().name(String::from("avis-ia-resumen")).spawn(move || {
            self.ocupados.fetch_add(1, Ordering::SeqCst);
            let emitir_si = |v: Value| {
                if vigente(pedido, *Self::lock(&self.en_curso)) {
                    emitir(v);
                }
            };
            if let Err((motivo, detalle)) = self.resolver(pedido, &datos, &emitir_si) {
                if motivo != "cancelado" {
                    if let Some(d) = &detalle {
                        registrar(&format!("resumen: {motivo}: {d}"));
                    }
                    emitir_si(evento("fallo", json!({ "pedido": pedido, "motivo": motivo, "detalle": detalle })));
                }
            }
            {
                let mut c = Self::lock(&self.en_curso);
                if *c == Some(pedido) {
                    *c = None;
                }
            }
            *Self::lock(&self.ultimo_uso) = Instant::now();
            self.ocupados.fetch_sub(1, Ordering::SeqCst);
        });
        lanzado.map(|_| ()).map_err(|e| {
            *Self::lock(&self.en_curso) = None;
            e.to_string()
        })
    }

    fn resolver(&'static self, pedido: u64, datos: &Value, emitir: Emitir) -> Result<(), (&'static str, Option<String>)> {
        let base = base().map_err(|e| ("falta", Some(e)))?;
        let modelo = ruta_final(&base, &pieza_modelo());
        let (_, piezas) = self.plan_actual(&base);
        let estados: Vec<EstadoPieza> = piezas.iter().map(|p| mirar_pieza(&base, p)).collect();
        let (estado, _, _) = resumir_estado(&estados, base.join(MARCA_INSTALADO).exists(), base.join(MARCA_ROTO).exists(), false);
        if estado != EstadoModelo::Listo {
            return Err(("falta", None));
        }
        let (puerto, arranque) = self.asegurar_motor(&base, &modelo, pedido, emitir)?;
        if !vigente(pedido, *Self::lock(&self.en_curso)) {
            return Err(("cancelado", None));
        }
        emitir(evento("pensando", json!({ "pedido": pedido })));
        *Self::lock(&self.ultimo_uso) = Instant::now();
        let inicio = Instant::now();
        let (texto, cortado) = chat(puerto, &cuerpo_pedido(datos), ESPERA_RESUMEN).map_err(|e| self.error_de_chat(e))?;
        let ms = inicio.elapsed().as_millis() as u64;
        let texto = recortar_respuesta(&texto, cortado).ok_or(("vacio", None))?;
        emitir(evento("listo", json!({ "pedido": pedido, "texto": texto, "ms": ms, "aceleracion": aceleracion(arranque.dispositivo) })));
        Ok(())
    }

    /// El motor de un pedido fallado se revisa: si se cerró, motivo `cerrado` con su código.
    fn error_de_chat(&self, e: ErrorChat) -> (&'static str, Option<String>) {
        let salio = Self::lock(&self.motor).as_mut().and_then(|m| m.proceso.try_wait().ok().flatten());
        match (e, salio) {
            (_, Some(s)) => {
                let base = carpeta_base();
                let ultima = base.map(|b| ultima_linea(&b.join(LOG_MOTOR))).unwrap_or_default();
                self.apagar_motor();
                ("cerrado", Some(detalle_salida(s.code(), &ultima)))
            }
            (ErrorChat::Tiempo, None) => ("tiempo", None),
            (ErrorChat::Otro(d), None) => ("cerrado", Some(d)),
        }
    }

    /// Devuelve el puerto de un motor listo, arrancándolo si hace falta (avisa `preparando`).
    fn asegurar_motor(&'static self, base: &Path, modelo: &Path, pedido: u64, emitir: Emitir) -> Result<(u16, Arranque), (&'static str, Option<String>)> {
        let _turno = Self::lock(&self.arranque);
        if let Some(m) = Self::lock(&self.motor).as_mut() {
            if m.listo && matches!(m.proceso.try_wait(), Ok(None)) {
                return Ok((m.puerto, m.arranque));
            }
        }
        self.apagar_motor();
        let mut arranque = self.arranque_actual(base).ok_or(("falta", Some(String::from("no está el motor llama.cpp"))))?;
        self.preparando.store(true, Ordering::SeqCst);
        let r = loop {
            let carpeta = carpeta_motor(base, arranque.motor);
            let primera_vez = !carpeta.join(calentado(arranque.dispositivo)).exists();
            emitir(evento("preparando", json!({ "pedido": pedido, "primeraVez": primera_vez })));
            let fin = self.arrancar(base, modelo, arranque);
            if probar_en_cpu(&fin, arranque) {
                // CUDA no arrancó: el zip de CUDA trae el backend de CPU, se sigue sin bajar nada
                registrar(&format!("resumen: CUDA no arrancó ({fin:?}); se prueba en CPU"));
                let _ = marcar(&base.join(MARCA_CUDA_FALLO));
                arranque.dispositivo = Variante::Cpu;
                continue;
            }
            break fin;
        };
        self.preparando.store(false, Ordering::SeqCst);
        // Un proceso que no quedó listo no puede seguir prendido sin vigilante (ni ocupando memoria)
        if apaga_tras(&r) {
            self.apagar_motor();
        }
        match r {
            FinArranque::Listo => {
                let _ = marcar(&carpeta_motor(base, arranque.motor).join(calentado(arranque.dispositivo)));
                let puerto = Self::lock(&self.motor).as_ref().map(|m| m.puerto).ok_or(("cerrado", None))?;
                Ok((puerto, arranque))
            }
            FinArranque::Cancelado => Err(("cancelado", None)),
            FinArranque::Tiempo => Err(("tiempo", Some(String::from("llama-server no estuvo listo en 240 s")))),
            FinArranque::Salio(codigo, ultima) => Err(("cerrado", Some(detalle_salida(codigo, &ultima)))),
            FinArranque::NoArranco(d) => Err(("cerrado", Some(d))),
        }
    }

    /// Lanza `llama-server` sin consola, en un trabajo de Windows que lo mata si Avis se cierra o
    /// se cae, con el directorio de trabajo en su carpeta (si no, no encuentra las DLL), y espera a
    /// que `/health` diga `ok` y a que conteste un primer pedido mínimo.
    fn arrancar(&'static self, base: &Path, modelo: &Path, arranque: Arranque) -> FinArranque {
        let Some(exe) = buscar_servidor(&carpeta_motor(base, arranque.motor)) else {
            return FinArranque::NoArranco(String::from("no está llama-server.exe"));
        };
        let Some(puerto) = puerto_libre() else { return FinArranque::NoArranco(String::from("no hay un puerto libre en 127.0.0.1")) };
        let log = base.join(LOG_MOTOR);
        let Ok(registro) = File::create(&log) else { return FinArranque::NoArranco(String::from("no se pudo escribir motor.log")) };
        let mut c = Command::new(&exe);
        c.args(argumentos(modelo, puerto, arranque.dispositivo))
            .current_dir(exe.parent().unwrap_or(base))
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::from(registro));
        sin_consola(&mut c);
        let proceso = match c.spawn() {
            Ok(p) => p,
            Err(e) => return FinArranque::NoArranco(format!("no se pudo correr llama-server: {e}")),
        };
        let trabajo = Trabajo::para(&proceso);
        let generacion = self.generacion.fetch_add(1, Ordering::SeqCst) + 1;
        *Self::lock(&self.motor) = Some(Motor { proceso, trabajo, puerto, arranque, listo: false, generacion });
        if self.apagado.load(Ordering::SeqCst) {
            self.apagar_motor();
            return FinArranque::Cancelado;
        }
        let local = agente_local(Duration::from_secs(2));
        let limite = Instant::now() + ESPERA_SALUD;
        loop {
            match self.revisar_motor(generacion) {
                Revision::Vivo => {}
                Revision::Salio(codigo) => return FinArranque::Salio(codigo, ultima_linea(&log)),
                Revision::Ausente => return FinArranque::Cancelado,
            }
            let sano = local
                .get(format!("http://127.0.0.1:{puerto}/health"))
                .call()
                .ok()
                .map(|mut r| {
                    let estado = r.status().as_u16();
                    (estado, r.body_mut().read_to_string().unwrap_or_default())
                })
                .is_some_and(|(e, b)| salud_lista(e, &b));
            if sano {
                break;
            }
            if Instant::now() >= limite {
                return FinArranque::Tiempo;
            }
            std::thread::sleep(Duration::from_millis(500));
        }
        // La primera respuesta es la lenta (con CUDA, ~80 s): se paga acá, en "preparando"
        if let Err(e) = chat(puerto, &cuerpo_calentar(), ESPERA_CALENTAR) {
            return match self.revisar_motor(generacion) {
                Revision::Salio(codigo) => FinArranque::Salio(codigo, ultima_linea(&log)),
                Revision::Ausente => FinArranque::Cancelado,
                Revision::Vivo if e == ErrorChat::Tiempo => FinArranque::Tiempo,
                Revision::Vivo => FinArranque::NoArranco(format!("{e:?}")),
            };
        }
        if let Some(m) = Self::lock(&self.motor).as_mut().filter(|m| m.generacion == generacion) {
            m.listo = true;
        } else {
            return FinArranque::Cancelado;
        }
        *Self::lock(&self.ultimo_uso) = Instant::now();
        self.vigilar_inactividad(generacion);
        FinArranque::Listo
    }

    fn revisar_motor(&self, generacion: u64) -> Revision {
        let mut m = Self::lock(&self.motor);
        match m.as_mut().filter(|m| m.generacion == generacion) {
            None => Revision::Ausente,
            Some(m) => match m.proceso.try_wait() {
                Ok(None) => Revision::Vivo,
                Ok(Some(s)) => Revision::Salio(s.code()),
                Err(_) => Revision::Salio(None),
            },
        }
    }

    /// Un hilo por motor: lo apaga tras 10 minutos sin uso; termina si el motor ya no es ese.
    fn vigilar_inactividad(&'static self, generacion: u64) {
        let _ = std::thread::Builder::new().name(String::from("avis-ia-inactividad")).spawn(move || loop {
            std::thread::sleep(Duration::from_secs(15));
            if self.apagado.load(Ordering::SeqCst) || !matches!(self.revisar_motor(generacion), Revision::Vivo) {
                break;
            }
            let ultimo = *Self::lock(&self.ultimo_uso);
            if inactivo(ultimo, Instant::now(), self.ocupados.load(Ordering::SeqCst) > 0) {
                let _turno = Self::lock(&self.arranque);
                let mut m = Self::lock(&self.motor);
                if m.as_ref().is_some_and(|m| m.generacion == generacion) {
                    if let Some(mut viejo) = m.take() {
                        viejo.matar();
                    }
                }
                break;
            }
        });
    }

    fn apagar_motor(&self) {
        if let Some(mut m) = Self::lock(&self.motor).take() {
            m.matar();
        }
    }

    /// Al salir de la aplicación (`RunEvent::Exit`): corta la descarga, apaga el motor y no deja
    /// empezar nada más.
    pub fn apagar(&self) {
        self.apagado.store(true, Ordering::SeqCst);
        Self::lock(&self.descarga).cancelar = true;
        *Self::lock(&self.en_curso) = None;
        self.apagar_motor();
    }

    /// "Borrar el modelo de IA…" de la bandeja: corta la descarga, apaga el motor y borra
    /// `%LOCALAPPDATA%\avis-ia` entero (modelo, motor, marcas). Devuelve los bytes liberados.
    pub fn borrar(&self) -> Result<u64, String> {
        let base = base()?;
        Self::lock(&self.descarga).cancelar = true;
        *Self::lock(&self.en_curso) = None;
        self.apagar_motor();
        // El hilo de la descarga suelta sus archivos en su próxima lectura
        let limite = Instant::now() + Duration::from_secs(10);
        while Self::lock(&self.descarga).activa && Instant::now() < limite {
            std::thread::sleep(Duration::from_millis(100));
        }
        let bytes = peso(&base);
        borrar_carpeta(&base)?;
        Ok(bytes)
    }

    /// ¿Hay algo para borrar? Los bytes de la carpeta (0 si no está).
    pub fn peso(&self) -> u64 {
        carpeta_base().map(|b| peso(&b)).unwrap_or(0)
    }
}

enum Revision {
    Vivo,
    Salio(Option<i32>),
    Ausente,
}

/// La marca de que el motor ya contestó una vez con ese dispositivo (después, "Despertando").
fn calentado(dispositivo: Variante) -> String {
    format!("{MARCA_CALENTADO}-{}", dispositivo.carpeta())
}

/// Borra la carpeta sin seguir enlaces: `remove_dir_all` quita un enlace o una unión sin entrar.
pub fn borrar_carpeta(carpeta: &Path) -> Result<(), String> {
    match fs::remove_dir_all(carpeta) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("no se pudo borrar {}: {e}", carpeta.display())),
    }
}

/// Los bytes de una carpeta (sin seguir enlaces).
pub fn peso(carpeta: &Path) -> u64 {
    let Ok(lista) = fs::read_dir(carpeta) else { return 0 };
    lista
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => peso(&e.path()),
            Ok(t) if t.is_file() => e.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}

/// Un puerto libre en 127.0.0.1 (lo elige Windows).
fn puerto_libre() -> Option<u16> {
    std::net::TcpListener::bind(("127.0.0.1", 0)).ok()?.local_addr().ok().map(|a| a.port())
}

/// Un cliente solo para 127.0.0.1: sin proxy (nunca sale de la máquina).
fn agente_local(espera: Duration) -> ureq::Agent {
    ureq::Agent::config_builder().http_status_as_error(false).proxy(None).max_redirects(0).timeout_global(Some(espera)).build().into()
}

#[derive(Debug, PartialEq)]
pub enum ErrorChat {
    Tiempo,
    Otro(String),
}

/// `POST /v1/chat/completions` al motor local.
pub fn chat(puerto: u16, cuerpo: &Value, espera: Duration) -> Result<(String, bool), ErrorChat> {
    let mut r = agente_local(espera)
        .post(format!("http://127.0.0.1:{puerto}/v1/chat/completions"))
        .header("Content-Type", "application/json")
        .send(cuerpo.to_string())
        .map_err(|e| match e {
            ureq::Error::Timeout(_) => ErrorChat::Tiempo,
            e => ErrorChat::Otro(format!("motor: {e}")),
        })?;
    let estado = r.status().as_u16();
    let texto = r.body_mut().read_to_string().map_err(|e| match e {
        ureq::Error::Timeout(_) => ErrorChat::Tiempo,
        e => ErrorChat::Otro(format!("motor: {e}")),
    })?;
    if estado != 200 {
        return Err(ErrorChat::Otro(format!("el motor respondió {estado}: {}", recortar_texto(&texto, 140))));
    }
    leer_respuesta(&texto).ok_or_else(|| ErrorChat::Otro(String::from("el motor devolvió una respuesta ilegible")))
}

/// La última línea no vacía del registro del motor.
fn ultima_linea(ruta: &Path) -> String {
    let Ok(mut f) = File::open(ruta) else { return String::new() };
    let largo = f.metadata().map(|m| m.len()).unwrap_or(0);
    let desde = largo.saturating_sub(4096);
    let mut texto = Vec::new();
    use std::io::Seek;
    if f.seek(std::io::SeekFrom::Start(desde)).is_err() || f.read_to_end(&mut texto).is_err() {
        return String::new();
    }
    String::from_utf8_lossy(&texto).lines().rev().map(str::trim).find(|l| !l.is_empty()).unwrap_or("").to_string()
}

fn registrar(linea: &str) {
    if let Some(ruta) = crate::diagnostico::ruta_log() {
        let _ = crate::diagnostico::agregar_linea(&ruta, linea, chrono::Utc::now(), crate::diagnostico::TOPE_BYTES);
    }
}

#[cfg(test)]
#[path = "modelo_tests.rs"]
mod tests;
