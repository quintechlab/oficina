//! Primeros pasos (#10, docs/diseno/bienvenida-ux.md 9): revisar qué falta en la máquina (solo
//! lectura) y leer la salida de cada comando. Todo proceso sale sin consola (CREATE_NO_WINDOW),
//! con argumentos fijos (nunca se interpola texto del usuario) y con el PATH releído del registro:
//! después de instalar algo, el PATH que heredó el widget al arrancar queda viejo (9.4). Nunca se
//! guarda ni se muestra un token: la sesión es la de `gh`.

use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStderr, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{LazyLock, Mutex, PoisonError};
use std::time::{Duration, Instant};

/// El mod, su catálogo y la organización del equipo (9.2).
pub const MOD: &str = "oficina@quintech";
pub const CATALOGO: &str = "quintech";
pub const ORGANIZACION: &str = "quintechlab";
/// Permisos de GitHub que necesitan el tablero (`repo`, `project`) y la membresía (`read:org`).
pub const PERMISOS: [&str; 3] = ["repo", "read:org", "project"];
/// Largo máximo de la línea de error que se muestra (como `correr_gh`).
const TOPE_LINEA: usize = 140;

// ------------------------------------------------------------------ PATH y ejecutables (9.4)

/// El PATH para buscar y correr los programas: el del sistema y el del usuario (releídos del
/// registro) y después el que heredó el widget, sin repetir carpetas (sin distinguir mayúsculas
/// ni la barra final).
pub fn unir_path(sistema: &str, usuario: &str, actual: &str) -> String {
    let mut vistos: Vec<String> = Vec::new();
    let mut partes: Vec<&str> = Vec::new();
    for parte in [sistema, usuario, actual].iter().flat_map(|p| p.split(';')) {
        let p = parte.trim();
        if p.is_empty() {
            continue;
        }
        let clave = p.trim_end_matches(&['\\', '/'][..]).to_lowercase();
        if vistos.contains(&clave) {
            continue;
        }
        vistos.push(clave);
        partes.push(p);
    }
    partes.join(";")
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Programa {
    Claude,
    Gh,
    Winget,
}

impl Programa {
    fn nombre(self) -> &'static str {
        match self {
            Programa::Claude => "claude",
            Programa::Gh => "gh",
            Programa::Winget => "winget",
        }
    }
}

/// Dónde buscar: el PATH unido y las carpetas conocidas del usuario y del sistema.
pub struct Lugares {
    pub path: String,
    pub perfil: Option<PathBuf>,
    pub archivos_de_programa: Option<PathBuf>,
    pub datos_locales: Option<PathBuf>,
}

/// Rutas posibles de cada programa, en orden. `std::process::Command` en Windows solo prueba `.exe`
/// en el PATH: `claude` instalado con npm es `claude.cmd` y no lo encontraría (9.4).
pub fn candidatos(programa: Programa, l: &Lugares) -> Vec<PathBuf> {
    let carpetas: Vec<PathBuf> = l.path.split(';').map(str::trim).filter(|p| !p.is_empty()).map(PathBuf::from).collect();
    let en_path = |archivo: &str| carpetas.iter().map(|c| c.join(archivo)).collect::<Vec<_>>();
    let mut c = Vec::new();
    match programa {
        Programa::Claude => {
            c.extend(en_path("claude.exe"));
            if let Some(p) = &l.perfil {
                // Instalador nativo (supuesto, 9.4)
                c.push(p.join(".local").join("bin").join("claude.exe"));
            }
            c.extend(en_path("claude.cmd"));
        }
        Programa::Gh => {
            c.extend(en_path("gh.exe"));
            if let Some(p) = &l.archivos_de_programa {
                c.push(p.join("GitHub CLI").join("gh.exe"));
            }
        }
        Programa::Winget => {
            c.extend(en_path("winget.exe"));
            if let Some(p) = &l.datos_locales {
                c.push(p.join("Microsoft").join("WindowsApps").join("winget.exe"));
            }
        }
    }
    c
}

pub fn primero_que_existe(candidatos: Vec<PathBuf>, existe: impl Fn(&Path) -> bool) -> Option<PathBuf> {
    candidatos.into_iter().find(|c| existe(c))
}

fn ruta_de_entorno(variable: &str) -> Option<PathBuf> {
    std::env::var_os(variable).filter(|v| !v.is_empty()).map(PathBuf::from)
}

/// Los lugares de ahora: el PATH se relee del registro en cada búsqueda.
pub fn lugares() -> Lugares {
    let actual = std::env::var("PATH").unwrap_or_default();
    let (sistema, usuario) = registro::path_del_registro();
    Lugares {
        path: unir_path(&sistema, &usuario, &actual),
        perfil: ruta_de_entorno("USERPROFILE"),
        archivos_de_programa: ruta_de_entorno("ProgramFiles"),
        datos_locales: ruta_de_entorno("LOCALAPPDATA"),
    }
}

/// La ruta del programa, o `None` si no está. `symlink_metadata`: `winget.exe` es un alias de
/// ejecución de aplicaciones y no siempre se puede seguir.
pub fn ruta(programa: Programa, l: &Lugares) -> Option<PathBuf> {
    primero_que_existe(candidatos(programa, l), |p| std::fs::symlink_metadata(p).is_ok_and(|m| !m.is_dir()))
}

/// Un proceso sin consola, con el PATH unido, sin entrada (nunca espera una respuesta) y sin
/// colores ni preguntas de `gh`. Un `.cmd` lo corre la biblioteca estándar a través de `cmd.exe`
/// y escapa los argumentos (todos fijos).
pub fn comando(ruta: &Path, args: &[&str], l: &Lugares) -> Command {
    let mut c = Command::new(ruta);
    c.args(args)
        .env("PATH", &l.path)
        .env("GH_PROMPT_DISABLED", "1")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: sin esto, cada comando abre y cierra una consola
        c.creation_flags(0x0800_0000);
    }
    c
}

/// Salida de un comando que terminó.
pub struct Salida {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

/// Corre un programa hasta que termina. Error: no está o no se pudo lanzar.
pub fn correr(programa: Programa, args: &[&str], l: &Lugares) -> Result<Salida, String> {
    let r = ruta(programa, l).ok_or_else(|| format!("{} no está instalado", programa.nombre()))?;
    let salida = comando(&r, args, l).output().map_err(|e| format!("no se pudo correr {}: {e}", programa.nombre()))?;
    Ok(Salida {
        ok: salida.status.success(),
        stdout: String::from_utf8_lossy(&salida.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&salida.stderr).into_owned(),
    })
}

// ------------------------------------------------------------------ lectores (9.2 y 9.3)

/// `2.1.329 (Claude Code)` → `2.1.329`.
pub fn version_claude(s: &str) -> Option<String> {
    s.split_whitespace().next().filter(|v| v.starts_with(|c: char| c.is_ascii_digit())).map(String::from)
}

/// `gh version 2.103.3 (2026-10-26)` → `2.103.3`.
pub fn version_gh(s: &str) -> Option<String> {
    let linea = s.lines().find(|l| l.trim_start().starts_with("gh version"))?;
    linea.split_whitespace().nth(2).map(String::from)
}

/// `{ instalado, activo, version }` del mod a partir de `claude plugin list --json`. Activo en
/// cualquier scope (9.3): una entrada apagada de otro proyecto no lo apaga.
pub fn estado_mod(texto: &str) -> Result<Value, String> {
    let datos: Value = serde_json::from_str(texto).map_err(|_| String::from("Claude Code devolvió una lista ilegible"))?;
    let lista = datos.as_array().ok_or_else(|| String::from("Claude Code no devolvió la lista de plugins"))?;
    let propias: Vec<&Value> = lista.iter().filter(|p| p["id"] == MOD).collect();
    let activa = propias.iter().find(|p| p["enabled"] == true);
    let elegida = activa.or(propias.first());
    Ok(json!({
        "instalado": !propias.is_empty(),
        "activo": activa.is_some(),
        "version": elegida.and_then(|p| p["version"].as_str()),
    }))
}

/// ¿Está el catálogo `quintech`? (`claude plugin marketplace list --json`). Se busca por nombre:
/// la instalación lo nombra (`oficina@quintech`).
pub fn tiene_catalogo(texto: &str) -> bool {
    serde_json::from_str::<Value>(texto)
        .ok()
        .and_then(|d| d.as_array().map(|l| l.iter().any(|m| m["name"] == CATALOGO)))
        .unwrap_or(false)
}

/// ¿Tiene la cuenta el permiso? `read:org` también lo dan `write:org` y `admin:org`.
fn cubre(scopes: &[&str], permiso: &str) -> bool {
    match permiso {
        "read:org" => scopes.iter().any(|s| matches!(*s, "read:org" | "write:org" | "admin:org")),
        p => scopes.contains(&p),
    }
}

/// La cuenta de GitHub a partir de `gh auth status --hostname github.com --active --json hosts`:
/// `{ estado, login, faltan, error }`. `estado`: `conectada`, `sin-sesion` o `sin-conexion` (la
/// validación del token falló por red). Nunca lleva el token ni de dónde sale.
pub fn cuenta_gh(texto: &str) -> Value {
    let sin_sesion = |login: Option<&str>| json!({ "estado": "sin-sesion", "login": login, "faltan": [], "error": Value::Null });
    let Ok(datos) = serde_json::from_str::<Value>(texto) else { return sin_sesion(None) };
    let Some(lista) = datos["hosts"]["github.com"].as_array() else { return sin_sesion(None) };
    let Some(c) = lista.iter().find(|c| c["active"] == true).or(lista.first()) else { return sin_sesion(None) };
    let login = c["login"].as_str();
    if c["state"] == "success" {
        let scopes: Vec<&str> = c["scopes"].as_str().unwrap_or("").split(',').map(str::trim).collect();
        let faltan: Vec<&str> = PERMISOS.iter().copied().filter(|p| !cubre(&scopes, p)).collect();
        return json!({ "estado": "conectada", "login": login, "faltan": faltan, "error": Value::Null });
    }
    let error = c["error"].as_str().unwrap_or("");
    if es_error_de_red(error) {
        return json!({ "estado": "sin-conexion", "login": login, "faltan": [], "error": linea_de_error("", error) });
    }
    sin_sesion(login)
}

/// La membresía en `quintechlab` a partir de `gh api user/memberships/orgs/quintechlab`:
/// `{ estado, error }` con `activa`, `pendiente`, `no-miembro` (404), `sin-conexion` o `error`.
pub fn membresia(ok: bool, stdout: &str, stderr: &str) -> Value {
    if ok {
        let estado = match serde_json::from_str::<Value>(stdout).ok().as_ref().and_then(|d| d["state"].as_str()) {
            Some("active") => "activa",
            Some("pending") => "pendiente",
            _ => return json!({ "estado": "error", "error": "GitHub devolvió una membresía ilegible" }),
        };
        return json!({ "estado": estado, "error": Value::Null });
    }
    if stderr.contains("HTTP 404") || stdout.contains("\"status\":\"404\"") {
        return json!({ "estado": "no-miembro", "error": Value::Null });
    }
    let estado = if es_error_de_red(stderr) { "sin-conexion" } else { "error" };
    json!({ "estado": estado, "error": linea_de_error("", stderr) })
}

/// Señales de un error de red en la salida de `gh`, de `git` o de Node (no de permisos).
const SENALES_DE_RED: [&str; 16] = [
    "error connecting to",
    "dial tcp",
    "no such host",
    "connectex",
    "i/o timeout",
    "tls handshake",
    "proxyconnect",
    "network is unreachable",
    "connection refused",
    "connection reset",
    "could not resolve host",
    "unable to access",
    "getaddrinfo",
    "enotfound",
    "econnrefused",
    "etimedout",
];

pub fn es_error_de_red(texto: &str) -> bool {
    let t = texto.to_lowercase();
    SENALES_DE_RED.iter().any(|s| t.contains(s))
}

/// El código de un solo uso que imprime `gh auth login --web` (9.5): el primer `XXXX-XXXX` de
/// mayúsculas y dígitos que no esté pegado a otras letras.
pub fn codigo_dispositivo(texto: &str) -> Option<String> {
    let b = texto.as_bytes();
    if b.len() < 9 {
        return None;
    }
    let vale = |c: &u8| c.is_ascii_uppercase() || c.is_ascii_digit();
    (0..=b.len() - 9).find_map(|i| {
        let v = &b[i..i + 9];
        let forma = v[4] == b'-' && v[..4].iter().all(vale) && v[5..].iter().all(vale);
        let antes = i == 0 || !b[i - 1].is_ascii_alphanumeric();
        let despues = i + 9 == b.len() || !b[i + 9].is_ascii_alphanumeric();
        // Los 9 bytes son ASCII: los dos cortes caen en límites de carácter
        (forma && antes && despues).then(|| texto[i..i + 9].to_string())
    })
}

/// La línea que se muestra de un error (9.5): la primera no vacía de `stderr`, recortada a 140.
/// Si `stderr` no trae nada, la de `stdout` (`claude … --json` deja ahí `{ "error": … }`).
pub fn linea_de_error(stdout: &str, stderr: &str) -> String {
    let primera = |t: &str| t.lines().map(str::trim).find(|l| !l.is_empty()).map(String::from);
    let linea = primera(stderr)
        .or_else(|| {
            stdout.lines().rev().find_map(|l| {
                let v: Value = serde_json::from_str(l.trim()).ok()?;
                v["error"].as_str().or(v["message"].as_str()).map(String::from)
            })
        })
        .or_else(|| primera(stdout))
        .unwrap_or_else(|| String::from("sin detalle"));
    linea.chars().take(TOPE_LINEA).collect()
}

/// `gh` sale con error cuando el código de GitHub venció (15 minutos, supuesto en 9.5).
pub fn es_codigo_vencido(texto: &str) -> bool {
    let t = texto.to_lowercase();
    t.contains("timed out") || t.contains("expired")
}

/// winget sin el permiso de Windows (UAC cancelado o denegado). Supuesto (9.5): si no se puede
/// distinguir, el texto es el genérico y la verdad la dice `gh --version` después.
pub fn es_permiso_negado(texto: &str) -> bool {
    let t = texto.to_lowercase();
    t.contains("0x800704c7") || t.contains("canceled by the user") || t.contains("cancelled by the user") || t.contains("access is denied") || t.contains("0x80070005")
}

/// Texto del ítem de la bandeja (3.5) según los pasos que faltan; sin revisar todavía, sin número.
pub fn texto_menu(faltan: Option<u32>) -> String {
    match faltan {
        Some(1) => String::from("Primeros pasos (falta 1)…"),
        Some(n) if n > 1 => format!("Primeros pasos (faltan {n})…"),
        _ => String::from("Primeros pasos…"),
    }
}

// ------------------------------------------------------------------ revisar (3.3): solo lectura

/// Lo que hay en la máquina, solo con comandos de lectura: Claude Code, el mod y su catálogo,
/// GitHub CLI (y winget si falta), la cuenta y la membresía. Claude y GitHub se revisan a la par.
pub fn revisar() -> Value {
    let l = lugares();
    let (claude, github) = std::thread::scope(|s| {
        let claude = s.spawn(|| revisar_claude(&l));
        let github = revisar_github(&l);
        (claude.join().unwrap_or_else(|_| json!({})), github)
    });
    let mut r = github;
    r["claude"] = claude["claude"].clone();
    r["mod"] = claude["mod"].clone();
    r
}

pub fn revisar_claude(l: &Lugares) -> Value {
    let version = correr(Programa::Claude, &["--version"], l).ok().filter(|s| s.ok).and_then(|s| version_claude(&s.stdout));
    let sin_mod = json!({ "instalado": false, "activo": false, "version": Value::Null, "catalogo": false, "error": Value::Null });
    let estado_del_mod = if version.is_some() {
        let catalogo = correr(Programa::Claude, &["plugin", "marketplace", "list", "--json"], l).is_ok_and(|s| s.ok && tiene_catalogo(&s.stdout));
        let lista = correr(Programa::Claude, &["plugin", "list", "--json"], l);
        let mut m = match lista {
            Ok(s) if s.ok => estado_mod(&s.stdout).unwrap_or_else(|e| json!({ "instalado": false, "activo": false, "version": Value::Null, "error": e })),
            Ok(s) => json!({ "instalado": false, "activo": false, "version": Value::Null, "error": linea_de_error(&s.stdout, &s.stderr) }),
            Err(e) => json!({ "instalado": false, "activo": false, "version": Value::Null, "error": e }),
        };
        m["catalogo"] = json!(catalogo);
        m
    } else {
        sin_mod
    };
    json!({ "claude": { "encontrado": version.is_some(), "version": version }, "mod": estado_del_mod })
}

const COMANDO_CUENTA: &str = "gh auth status --hostname github.com --active --json hosts";

fn revisar_github(l: &Lugares) -> Value {
    let version = correr(Programa::Gh, &["--version"], l).ok().filter(|s| s.ok).and_then(|s| version_gh(&s.stdout));
    // winget solo importa si falta gh (para ofrecer instalarlo)
    let winget = version.is_none() && correr(Programa::Winget, &["--version"], l).is_ok_and(|s| s.ok);
    let mut cuenta = if version.is_some() {
        match correr(Programa::Gh, &["auth", "status", "--hostname", "github.com", "--active", "--json", "hosts"], l) {
            Ok(s) => cuenta_gh(&s.stdout),
            Err(e) => json!({ "estado": "sin-sesion", "login": Value::Null, "faltan": [], "error": e }),
        }
    } else {
        json!({ "estado": "sin-gh", "login": Value::Null, "faltan": [], "error": Value::Null })
    };
    cuenta["comando"] = json!(COMANDO_CUENTA);
    let lista_para_membresia = cuenta["estado"] == "conectada" && cuenta["faltan"].as_array().is_some_and(|f| f.is_empty());
    let membresia_v = if lista_para_membresia {
        let ruta_api = format!("user/memberships/orgs/{ORGANIZACION}");
        let mut m = match correr(Programa::Gh, &["api", &ruta_api], l) {
            Ok(s) => membresia(s.ok, &s.stdout, &s.stderr),
            Err(e) => json!({ "estado": "error", "error": e }),
        };
        m["comando"] = json!(format!("gh api {ruta_api}"));
        m
    } else {
        Value::Null
    };
    json!({ "gh": { "instalado": version.is_some(), "version": version, "winget": winget }, "cuenta": cuenta, "membresia": membresia_v })
}

// ------------------------------------------------------------------ pasos que corren (9.5): solo con un clic

/** Evento a la ventana con cada novedad del paso que corre. */
pub const EVENTO: &str = "oficina://primeros-pasos";
/** Donde se pega el código de GitHub. */
pub const URL_DISPOSITIVO: &str = "https://github.com/login/device";

/// Lo que el usuario puede correr con un clic, y nada más (los argumentos son fijos). `Actualizar`
/// no lo pide la ventana (`desde` no lo conoce): lo corre solo la revisión automática del mod (#17,
/// mod_auto.rs), que también corre `Mod` sin clic cuando falta.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Accion {
    Mod,
    Activar,
    Gh,
    Conectar,
    Permiso,
    Actualizar,
}

impl Accion {
    pub fn desde(texto: &str) -> Option<Accion> {
        match texto {
            "mod" => Some(Accion::Mod),
            "activar" => Some(Accion::Activar),
            "gh" => Some(Accion::Gh),
            "conectar" => Some(Accion::Conectar),
            "permiso" => Some(Accion::Permiso),
            _ => None,
        }
    }
    pub fn nombre(self) -> &'static str {
        match self {
            Accion::Mod => "mod",
            Accion::Activar => "activar",
            Accion::Gh => "gh",
            Accion::Conectar => "conectar",
            Accion::Permiso => "permiso",
            Accion::Actualizar => "actualizar",
        }
    }
    /// El paso del asistente al que pertenece.
    pub fn paso(self) -> &'static str {
        match self {
            Accion::Mod | Accion::Activar | Accion::Actualizar => "mod",
            _ => "gh",
        }
    }
    /// Conectar y sumar el permiso: muestran un código de GitHub y se pueden cancelar.
    pub fn conecta(self) -> bool {
        matches!(self, Accion::Conectar | Accion::Permiso)
    }
}

/// Un comando del plan: el programa, sus argumentos fijos y lo que se muestra en el registro.
#[derive(Debug)]
pub struct Orden {
    pub programa: Programa,
    pub args: Vec<&'static str>,
    pub mostrar: &'static str,
}

/// Los comandos de cada acción (9.2). El catálogo se suma solo si falta.
pub fn plan(accion: Accion, catalogo: bool) -> Vec<Orden> {
    let orden = |programa, args: &[&'static str], mostrar| Orden { programa, args: args.to_vec(), mostrar };
    match accion {
        Accion::Mod => {
            let mut p = Vec::new();
            if !catalogo {
                p.push(orden(Programa::Claude, &["plugin", "marketplace", "add", "quintechlab/oficina"], "claude plugin marketplace add quintechlab/oficina"));
            }
            p.push(orden(Programa::Claude, &["plugin", "install", MOD, "--scope", "user", "--json"], "claude plugin install oficina@quintech"));
            p
        }
        Accion::Activar => vec![orden(Programa::Claude, &["plugin", "enable", MOD], "claude plugin enable oficina@quintech")],
        // Revisión automática (#17): refresca el catálogo y actualiza si hay versión nueva. Sin -y: si el
        // catálogo algún día declara un comando para instalar, la actualización se niega y queda anotada
        Accion::Actualizar => vec![
            orden(Programa::Claude, &["plugin", "marketplace", "update", CATALOGO, "--json"], "claude plugin marketplace update quintech"),
            orden(Programa::Claude, &["plugin", "update", MOD, "--json"], "claude plugin update oficina@quintech"),
        ],
        // Los dos --accept-* evitan que winget espere una respuesta sin consola: el clic en "Instalar
        // GitHub CLI", con la nota de la licencia a la vista, es la aceptación del usuario
        Accion::Gh => vec![orden(
            Programa::Winget,
            &["install", "--id", "GitHub.cli", "-e", "--source", "winget", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"],
            "winget install --id GitHub.cli -e",
        )],
        // Sin --clipboard (copiar es un clic) y con --git-protocol https y --skip-ssh-key para que no
        // pregunte nada. Sin terminal, gh no ofrece configurar git como ayudante de credenciales
        Accion::Conectar => vec![orden(
            Programa::Gh,
            &["auth", "login", "--hostname", "github.com", "--web", "--git-protocol", "https", "--skip-ssh-key", "--scopes", "repo,read:org,project"],
            "gh auth login --hostname github.com --web --scopes repo,read:org,project",
        )],
        // Los tres permisos: refresh suma los que falten y deja los que ya están
        Accion::Permiso => vec![orden(
            Programa::Gh,
            &["auth", "refresh", "--hostname", "github.com", "--scopes", "repo,read:org,project"],
            "gh auth refresh --hostname github.com --scopes repo,read:org,project",
        )],
    }
}

/// Las direcciones que el asistente puede abrir en el navegador; ninguna otra.
pub fn enlace(cual: &str) -> Option<&'static str> {
    match cual {
        // Supuesto (9.4): confirmar la dirección vigente antes de publicar
        "guia-claude" => Some("https://code.claude.com/docs/en/setup"),
        "gh-manual" => Some("https://cli.github.com/"),
        "dispositivo" => Some(URL_DISPOSITIVO),
        "invitacion" => Some("https://github.com/orgs/quintechlab/invitation"),
        _ => None,
    }
}

/// Cómo terminó una acción.
#[derive(Debug, PartialEq)]
pub enum Fin {
    Listo,
    Cancelado,
    Vencido,
    Error { comando: String, linea: String, detalle: String, red: bool, permiso: bool },
}

impl Fin {
    /// El aviso final para la ventana. Nunca lleva un token: `gh auth login` no lo imprime.
    pub fn evento(&self, accion: Accion) -> Value {
        let base = json!({ "accion": accion.nombre(), "paso": accion.paso() });
        let mut v = match self {
            Fin::Listo => json!({ "estado": "listo" }),
            Fin::Cancelado => json!({ "estado": "cancelado" }),
            Fin::Vencido => json!({ "estado": "vencido" }),
            Fin::Error { comando, linea, detalle, red, permiso } => {
                json!({ "estado": "error", "comando": comando, "linea": linea, "detalle": detalle, "red": red, "permiso": permiso })
            }
        };
        for (k, x) in base.as_object().into_iter().flatten() {
            v[k] = x.clone();
        }
        v
    }
}

/// Cómo terminó un proceso del plan, según lo que de verdad pasó.
#[derive(Debug, PartialEq)]
pub enum Desenlace {
    /// Salió bien: el plan sigue (y al final, la verificación de siempre).
    Siguio,
    /// Lo terminó Cancelar (o la salida de la aplicación).
    Cancelado,
    /// Salió con error por su cuenta.
    Fallo,
}

/// Decide por lo que pasó, no por lo que se pidió: si el proceso salió bien es un éxito aunque
/// Cancelar haya llegado tarde; "cancelado" solo si lo terminó la orden de matarlo (`matado`).
pub fn desenlace(exito: bool, matado: bool) -> Desenlace {
    match (exito, matado) {
        (true, _) => Desenlace::Siguio,
        (false, true) => Desenlace::Cancelado,
        (false, false) => Desenlace::Fallo,
    }
}

/// El proceso que corre y el trabajo de Windows que lo contiene con sus hijos (`None` si no se
/// pudo asignar: entonces solo se mata el proceso).
struct Hijo {
    proceso: Child,
    trabajo: Option<trabajo::Trabajo>,
}

/// Un paso por vez (3.1): quién corre, su proceso (para cancelar), si se pidió cancelar, si una
/// orden de matarlo lo encontró vivo y si la aplicación se está cerrando.
#[derive(Default)]
pub struct Turno {
    corriendo: Mutex<Option<Accion>>,
    hijo: Mutex<Option<Hijo>>,
    cancelado: AtomicBool,
    matado: AtomicBool,
    apagado: AtomicBool,
}

impl Turno {
    pub fn empezar(&self, accion: Accion) -> Result<(), String> {
        if self.apagado.load(Ordering::SeqCst) {
            return Err(String::from("Avis se está cerrando"));
        }
        let mut c = self.corriendo.lock().unwrap_or_else(PoisonError::into_inner);
        if c.is_some() {
            return Err(String::from("ya corre otro paso"));
        }
        *c = Some(accion);
        self.cancelado.store(false, Ordering::SeqCst);
        self.matado.store(false, Ordering::SeqCst);
        Ok(())
    }
    /// ¿Hay un paso corriendo (de Primeros pasos o de la revisión automática del mod)?
    pub fn ocupado(&self) -> bool {
        self.corriendo.lock().unwrap_or_else(PoisonError::into_inner).is_some()
    }
    pub fn terminar(&self) {
        *self.hijo.lock().unwrap_or_else(PoisonError::into_inner) = None;
        self.cancelado.store(false, Ordering::SeqCst);
        self.matado.store(false, Ordering::SeqCst);
        *self.corriendo.lock().unwrap_or_else(PoisonError::into_inner) = None;
    }
    /// Suelta el turno al terminar su alcance, también si el paso se cae: nunca queda tomado.
    pub fn soltar_al_terminar(&self) -> Soltar<'_> {
        Soltar(self)
    }
    /// "Cancelar" (solo mientras se conecta): mata el proceso de `gh`. Devuelve si había qué cancelar.
    pub fn cancelar(&self) -> bool {
        let conecta = self.corriendo.lock().unwrap_or_else(PoisonError::into_inner).is_some_and(Accion::conecta);
        if !conecta {
            return false;
        }
        self.cancelado.store(true, Ordering::SeqCst);
        let _ = self.matar();
        true
    }
    /// Al salir de la aplicación: mata el proceso del paso que corre, si hay, sin esperarlo, y no deja
    /// empezar otro. Error: no se pudo terminar (por ejemplo, un instalador que ya pidió permisos de
    /// administrador); se anota y la salida sigue.
    pub fn apagar(&self) -> Result<(), String> {
        self.apagado.store(true, Ordering::SeqCst);
        self.matar()
    }
    pub fn cancelado(&self) -> bool {
        self.cancelado.load(Ordering::SeqCst)
    }
    fn apagado(&self) -> bool {
        self.apagado.load(Ordering::SeqCst)
    }
    fn matado(&self) -> bool {
        self.matado.load(Ordering::SeqCst)
    }
    /// Mata el proceso guardado (con su trabajo: también sus hijos) si sigue vivo. Uno que ya
    /// terminó no se marca como matado: su salida decide (`desenlace`).
    fn matar(&self) -> Result<(), String> {
        let mut guardado = self.hijo.lock().unwrap_or_else(PoisonError::into_inner);
        let Some(h) = guardado.as_mut() else { return Ok(()) };
        if !matches!(h.proceso.try_wait(), Ok(None)) {
            return Ok(());
        }
        let por_trabajo = h.trabajo.as_ref().is_some_and(trabajo::Trabajo::terminar);
        match h.proceso.kill() {
            Ok(()) => {
                self.matado.store(true, Ordering::SeqCst);
                Ok(())
            }
            Err(_) if por_trabajo => {
                self.matado.store(true, Ordering::SeqCst);
                Ok(())
            }
            Err(e) => Err(format!("no se pudo terminar el proceso del paso: {e}")),
        }
    }
    /// Guarda el proceso recién lanzado dentro de un trabajo de Windows que lo mata (con sus hijos)
    /// si la aplicación se cierra o se cae. Si ya pidieron cancelar o salir, lo mata enseguida.
    pub fn poner_hijo(&self, mut proceso: Child) -> (Option<ChildStdout>, Option<ChildStderr>) {
        let canales = (proceso.stdout.take(), proceso.stderr.take());
        let trabajo = trabajo::Trabajo::para(&proceso);
        *self.hijo.lock().unwrap_or_else(PoisonError::into_inner) = Some(Hijo { proceso, trabajo });
        if self.cancelado() || self.apagado() {
            let _ = self.matar();
        }
        canales
    }
    /// Si el proceso terminó, lo saca (cerrar su trabajo mata a los hijos que hayan quedado, que
    /// si no retendrían la salida abierta) y dice si salió bien. Sin proceso guardado, terminó mal.
    fn fin_del_hijo(&self) -> Option<bool> {
        let mut guardado = self.hijo.lock().unwrap_or_else(PoisonError::into_inner);
        let estado = match guardado.as_mut() {
            Some(h) => h.proceso.try_wait(),
            None => return Some(false),
        };
        match estado {
            Ok(None) => None,
            Ok(Some(s)) => {
                *guardado = None;
                Some(s.success())
            }
            Err(_) => {
                *guardado = None;
                Some(false)
            }
        }
    }
}

/// Suelta el turno cuando sale de su alcance (ver `Turno::soltar_al_terminar`).
pub struct Soltar<'a>(&'a Turno);

impl Drop for Soltar<'_> {
    fn drop(&mut self) {
        self.0.terminar();
    }
}

/// El turno de la aplicación.
pub static TURNO: LazyLock<Turno> = LazyLock::new(Turno::default);

/// Cada cuánto se mira si el proceso terminó.
const VUELTA: Duration = Duration::from_millis(100);
/// Después de que el proceso termina, cuánto se espera todavía su salida. Solo cuenta si quedó un
/// hijo suyo con la salida abierta fuera de un trabajo de Windows: no retiene el turno.
const DRENAJE: Duration = Duration::from_secs(2);

/// Lo que dejó un proceso del plan.
pub struct Termino {
    pub salida: String,
    pub errores: String,
    pub exito: bool,
    pub matado: bool,
}

fn lector(canal: impl Read + Send + 'static, es_salida: bool, tx: Sender<(bool, String)>) {
    let _ = std::thread::Builder::new().name(String::from("oficina-paso-lector")).spawn(move || {
        for linea in BufReader::new(canal).lines().map_while(Result::ok) {
            if tx.send((es_salida, linea)).is_err() {
                break;
            }
        }
    });
}

/// Espera el proceso guardado en el turno leyendo su salida línea por línea (no `output()`, que
/// espera al final) y pasando cada línea a `mirar`. Termina cuando el proceso terminó y su salida
/// se cerró, o `DRENAJE` después de que terminó: un proceso muerto nunca retiene el turno.
pub fn esperar(turno: &Turno, stdout: Option<ChildStdout>, stderr: Option<ChildStderr>, mirar: &dyn Fn(&str)) -> Termino {
    let (tx, rx) = mpsc::channel();
    if let Some(c) = stdout {
        lector(c, true, tx.clone());
    }
    if let Some(c) = stderr {
        lector(c, false, tx.clone());
    }
    drop(tx);
    let (mut salida, mut errores) = (String::new(), String::new());
    let mut abiertos = true;
    let mut exito = None;
    let mut plazo = Instant::now();
    loop {
        if abiertos {
            match rx.recv_timeout(VUELTA) {
                Ok((es_salida, linea)) => {
                    mirar(&linea);
                    let destino = if es_salida { &mut salida } else { &mut errores };
                    destino.push_str(&linea);
                    destino.push('\n');
                }
                Err(RecvTimeoutError::Disconnected) => abiertos = false,
                Err(RecvTimeoutError::Timeout) => {}
            }
        } else if exito.is_none() {
            std::thread::sleep(VUELTA);
        }
        if exito.is_none() {
            exito = turno.fin_del_hijo();
            plazo = Instant::now() + DRENAJE;
        }
        if exito.is_some() && (!abiertos || Instant::now() >= plazo) {
            break;
        }
    }
    Termino { salida, errores, exito: exito == Some(true), matado: turno.matado() }
}

/// Corre una acción hasta el final: cada comando del plan, uno por vez, leyendo su salida línea por
/// línea (no `output()`, que espera al final) y avisando con `emitir`. Al conectar, cuando aparece el
/// código llama a `abrir` (el navegador en github.com/login/device: sin terminal `gh` no lo abre).
pub fn ejecutar(accion: Accion, turno: &Turno, emitir: &(dyn Fn(Value) + Sync), abrir: &(dyn Fn() + Sync)) -> Fin {
    let l = lugares();
    let catalogo = accion != Accion::Mod
        || correr(Programa::Claude, &["plugin", "marketplace", "list", "--json"], &l).is_ok_and(|s| s.ok && tiene_catalogo(&s.stdout));
    let avisar = |estado: &str, mut extra: Value| {
        extra["accion"] = json!(accion.nombre());
        extra["paso"] = json!(accion.paso());
        extra["estado"] = json!(estado);
        emitir(extra);
    };
    for orden in plan(accion, catalogo) {
        avisar("comando", json!({ "comando": orden.mostrar }));
        let error = |linea: String, detalle: String| Fin::Error {
            comando: orden.mostrar.to_string(),
            red: es_error_de_red(&detalle),
            permiso: accion == Accion::Gh && es_permiso_negado(&detalle),
            linea,
            detalle,
        };
        let Some(r) = ruta(orden.programa, &l) else {
            let falta = format!("{} no está instalado", orden.programa.nombre());
            return error(falta.clone(), falta);
        };
        // La aplicación se está cerrando: no se lanza nada más
        if turno.apagado() {
            return Fin::Cancelado;
        }
        let hijo = match comando(&r, &orden.args, &l).spawn() {
            Ok(h) => h,
            Err(e) => {
                let texto = format!("no se pudo correr {}: {e}", orden.programa.nombre());
                return error(texto.clone(), texto);
            }
        };
        // Si cancelaron antes de guardar el proceso, `poner_hijo` lo mata ahora
        let (stdout, stderr) = turno.poner_hijo(hijo);
        let codigo_visto = AtomicBool::new(false);
        let mirar = |linea: &str| {
            if accion.conecta() && !codigo_visto.load(Ordering::SeqCst) {
                if let Some(c) = codigo_dispositivo(linea) {
                    codigo_visto.store(true, Ordering::SeqCst);
                    avisar("codigo", json!({ "codigo": c }));
                    abrir();
                }
            }
        };
        let Termino { salida, errores, exito, matado } = esperar(turno, stdout, stderr, &mirar);
        match desenlace(exito, matado) {
            Desenlace::Siguio => {}
            Desenlace::Cancelado => return Fin::Cancelado,
            Desenlace::Fallo => {
                let detalle = if errores.trim().is_empty() { salida.clone() } else { format!("{errores}{salida}") };
                if accion.conecta() && es_codigo_vencido(&detalle) {
                    return Fin::Vencido;
                }
                return error(linea_de_error(&salida, &errores), detalle.trim().to_string());
            }
        }
        avisar("comando-hecho", json!({ "comando": orden.mostrar }));
    }
    Fin::Listo
}

/// Abre una dirección conocida (`enlace`) con el navegador del sistema.
#[cfg(windows)]
pub fn abrir_en_navegador(url: &str) -> Result<(), String> {
    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(hwnd: isize, operacion: *const u16, archivo: *const u16, parametros: *const u16, carpeta: *const u16, mostrar: i32) -> isize;
    }
    let ancho = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<u16>>();
    let (operacion, archivo) = (ancho("open"), ancho(url));
    // SAFETY: cadenas terminadas en cero que viven durante la llamada; SW_SHOWNORMAL = 1
    let r = unsafe { ShellExecuteW(0, operacion.as_ptr(), archivo.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
    if r > 32 {
        Ok(())
    } else {
        Err(format!("no se pudo abrir el navegador ({r})"))
    }
}

#[cfg(not(windows))]
pub fn abrir_en_navegador(_url: &str) -> Result<(), String> {
    Err(String::from("solo en Windows"))
}

// ------------------------------------------------------------------ trabajo de Windows (job object)

/// Un trabajo de Windows con `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`: al cerrarse (al terminar el
/// paso, al salir o si la aplicación se cae) Windows mata lo que quede adentro, también los hijos
/// del proceso (el `node` de `claude.cmd`). Un instalador que ya pidió permisos de administrador
/// no queda adentro. `BREAKAWAY_OK` deja salir a quien lo pida explícitamente.
#[cfg(windows)]
pub mod trabajo {
    use std::ffi::c_void;
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;

    const JOB_OBJECT_LIMIT_BREAKAWAY_OK: u32 = 0x0000_0800;
    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x0000_2000;
    /// JobObjectExtendedLimitInformation
    const CLASE_LIMITES_EXTENDIDOS: i32 = 9;

    /// JOBOBJECT_BASIC_LIMIT_INFORMATION
    #[repr(C)]
    #[derive(Default)]
    struct LimitesBasicos {
        tiempo_por_proceso: i64,
        tiempo_por_trabajo: i64,
        banderas: u32,
        memoria_minima: usize,
        memoria_maxima: usize,
        procesos_activos: u32,
        afinidad: usize,
        prioridad: u32,
        planificacion: u32,
    }

    /// IO_COUNTERS
    #[repr(C)]
    #[derive(Default)]
    struct Contadores {
        lecturas: u64,
        escrituras: u64,
        otras: u64,
        bytes_leidos: u64,
        bytes_escritos: u64,
        otros_bytes: u64,
    }

    /// JOBOBJECT_EXTENDED_LIMIT_INFORMATION
    #[repr(C)]
    #[derive(Default)]
    struct LimitesExtendidos {
        basicos: LimitesBasicos,
        contadores: Contadores,
        memoria_por_proceso: usize,
        memoria_por_trabajo: usize,
        pico_por_proceso: usize,
        pico_por_trabajo: usize,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateJobObjectW(atributos: *const c_void, nombre: *const u16) -> isize;
        fn SetInformationJobObject(trabajo: isize, clase: i32, informacion: *const c_void, largo: u32) -> i32;
        fn AssignProcessToJobObject(trabajo: isize, proceso: isize) -> i32;
        fn TerminateJobObject(trabajo: isize, codigo: u32) -> i32;
        fn CloseHandle(objeto: isize) -> i32;
    }

    pub struct Trabajo(isize);

    impl Trabajo {
        /// Un trabajo nuevo con el proceso adentro, o `None` si Windows no lo deja (se mata solo el proceso).
        pub fn para(proceso: &Child) -> Option<Trabajo> {
            // SAFETY: sin atributos ni nombre
            let manija = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if manija == 0 {
                return None;
            }
            // Desde acá, `Drop` cierra la manija en cualquier salida
            let trabajo = Trabajo(manija);
            let limites = LimitesExtendidos {
                basicos: LimitesBasicos { banderas: JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_BREAKAWAY_OK, ..Default::default() },
                ..Default::default()
            };
            let largo = std::mem::size_of::<LimitesExtendidos>() as u32;
            // SAFETY: `limites` vive durante la llamada y `largo` es su tamaño
            let limitado = unsafe { SetInformationJobObject(trabajo.0, CLASE_LIMITES_EXTENDIDOS, (&limites as *const LimitesExtendidos).cast(), largo) } != 0;
            // SAFETY: la manija del proceso es válida mientras viva `proceso`
            let asignado = limitado && unsafe { AssignProcessToJobObject(trabajo.0, proceso.as_raw_handle() as isize) } != 0;
            asignado.then_some(trabajo)
        }
        /// Mata todo lo que hay adentro. Devuelve si Windows lo aceptó.
        pub fn terminar(&self) -> bool {
            // SAFETY: manija válida hasta `Drop`
            unsafe { TerminateJobObject(self.0, 1) != 0 }
        }
    }

    impl Drop for Trabajo {
        fn drop(&mut self) {
            // SAFETY: manija propia, se cierra una sola vez
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(not(windows))]
pub mod trabajo {
    pub struct Trabajo;

    impl Trabajo {
        pub fn para(_proceso: &std::process::Child) -> Option<Trabajo> {
            None
        }
        pub fn terminar(&self) -> bool {
            false
        }
    }
}

// ------------------------------------------------------------------ registro de Windows (9.4)

#[cfg(windows)]
mod registro {
    use std::ffi::c_void;
    use std::ptr::null_mut;

    // HKEY predefinidas: se extienden con signo, como en los encabezados de Windows
    const HKEY_CURRENT_USER: isize = 0x8000_0001u32 as i32 as isize;
    const HKEY_LOCAL_MACHINE: isize = 0x8000_0002u32 as i32 as isize;
    const RRF_RT_REG_SZ: u32 = 0x0000_0002;
    const RRF_RT_REG_EXPAND_SZ: u32 = 0x0000_0004;
    const RRF_NOEXPAND: u32 = 0x1000_0000;

    #[link(name = "advapi32")]
    extern "system" {
        fn RegGetValueW(hkey: isize, subclave: *const u16, valor: *const u16, banderas: u32, tipo: *mut u32, datos: *mut c_void, tam: *mut u32) -> i32;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn ExpandEnvironmentStringsW(origen: *const u16, destino: *mut u16, largo: u32) -> u32;
    }

    fn ancho(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }

    fn hasta_el_cero(b: &[u16]) -> String {
        let fin = b.iter().position(|&c| c == 0).unwrap_or(b.len());
        String::from_utf16_lossy(&b[..fin])
    }

    /// Un valor de texto del registro, sin expandir (`%USERPROFILE%` queda como está).
    fn leer(hkey: isize, subclave: &str, valor: &str) -> Option<String> {
        let (subclave, valor) = (ancho(subclave), ancho(valor));
        let banderas = RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ | RRF_NOEXPAND;
        let mut tam: u32 = 0;
        // SAFETY: punteros a cadenas terminadas en cero que viven durante la llamada; sin datos, solo el tamaño
        let r = unsafe { RegGetValueW(hkey, subclave.as_ptr(), valor.as_ptr(), banderas, null_mut(), null_mut(), &mut tam) };
        if r != 0 || tam == 0 {
            return None;
        }
        let mut datos = vec![0u16; (tam as usize).div_ceil(2) + 1];
        let mut tam = (datos.len() * 2) as u32;
        // SAFETY: `datos` tiene `tam` bytes
        let r = unsafe { RegGetValueW(hkey, subclave.as_ptr(), valor.as_ptr(), banderas, null_mut(), datos.as_mut_ptr().cast(), &mut tam) };
        (r == 0).then(|| hasta_el_cero(&datos))
    }

    fn expandir(s: &str) -> String {
        let origen = ancho(s);
        // SAFETY: sin destino, solo pide el largo
        let largo = unsafe { ExpandEnvironmentStringsW(origen.as_ptr(), null_mut(), 0) };
        if largo == 0 {
            return s.to_string();
        }
        let mut destino = vec![0u16; largo as usize];
        // SAFETY: `destino` tiene `largo` caracteres
        let escrito = unsafe { ExpandEnvironmentStringsW(origen.as_ptr(), destino.as_mut_ptr(), largo) };
        if escrito == 0 || escrito > largo {
            return s.to_string();
        }
        hasta_el_cero(&destino)
    }

    /// El `Path` del sistema y el del usuario, como los ve una consola nueva.
    pub fn path_del_registro() -> (String, String) {
        let sistema = leer(HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment", "Path");
        let usuario = leer(HKEY_CURRENT_USER, "Environment", "Path");
        (sistema.map(|s| expandir(&s)).unwrap_or_default(), usuario.map(|s| expandir(&s)).unwrap_or_default())
    }
}

#[cfg(not(windows))]
mod registro {
    pub fn path_del_registro() -> (String, String) {
        (String::new(), String::new())
    }
}

#[cfg(test)]
#[path = "primeros_pasos_tests.rs"]
mod tests;
