//! Terminar una sesión dormida (odd/tasks/sesiones-dormidas.md, S2): Avis termina el proceso de Claude
//! Code de una sesión sin turnos hace más de 20 min, solo con el clic confirmado del usuario. Cambia la
//! regla de #25 «el widget nunca mata procesos» (decisión de Quintana del 26/11).
//!
//! Antes de terminar comprueba, en este orden:
//! 1. el id de la sesión es válido;
//! 2. su presencia (`~/.claude/oficina/sesiones/<id>.json`) es de esa sesión, late (como `sesion_viva`
//!    de sesiones.rs: la que el widget muestra) y dice que está dormida: no cerrada, sin turno,
//!    pregunta, subagente trabajando ni procesos, y con `ultimoTurno` de hace más de 20 min (las mismas
//!    reglas que `dormida` de logica.js: la ventana no puede pedir que se termine una sesión despierta);
//! 3. un solo `~/.claude/sessions/<pid>.json` de Claude Code asocia un PID a esa sesión, con su `procStart`;
//! 4. el proceso con ese PID arrancó exactamente en `procStart` (un PID reusado no coincide) y es
//!    `claude.exe` o `node.exe`; la comprobación y la terminación usan el mismo handle.
//!
//! Recién entonces lo termina y deja la presencia como cerrada, así la tarjeta se va en el ciclo siguiente.

use std::path::Path;

use chrono::{DateTime, Duration, Utc};
use serde_json::{json, Value};

/// Sin turnos hace más de esto, la sesión duerme (igual que `MINUTOS_INACTIVO` de logica.js).
pub const MINUTOS_DORMIDA: i64 = 20;

/// Los ejecutables de Claude Code: el nativo y el de npm (`claude.cmd` corre `node.exe`).
const EJECUTABLES: [&str; 2] = ["claude.exe", "node.exe"];

/// Por qué no se terminó. `codigo` es lo que recibe la ventana.
#[derive(Debug, PartialEq, Eq)]
pub enum Falla {
    /// El id no es válido.
    Id,
    /// La presencia no existe, está cerrada o la sesión no está dormida.
    Despierta,
    /// Claude Code no tiene un proceso registrado para la sesión (o tiene más de uno).
    SinProceso,
    /// El PID existe pero no es el que registró Claude Code (otro arranque u otro ejecutable).
    NoCoincide,
    /// Windows no dejó abrirlo o terminarlo.
    Fallo,
}

impl Falla {
    pub fn codigo(&self) -> &'static str {
        match self {
            Falla::Id => "id",
            Falla::Despierta => "despierta",
            Falla::SinProceso => "sin-proceso",
            Falla::NoCoincide => "no-coincide",
            Falla::Fallo => "fallo",
        }
    }
}

/// Un proceso abierto: lo que se comprueba y lo que se hace, sobre el mismo handle.
pub trait Proceso {
    /// Cuándo arrancó: FILETIME (unidades de 100 ns desde 1601), como el `procStart` de Claude Code.
    fn arranque(&self) -> Option<u64>;
    /// El nombre del ejecutable, sin la carpeta.
    fn nombre(&self) -> Option<String>;
    /// Lo termina; true si Windows lo aceptó.
    fn terminar(&self) -> bool;
}

/// Abre procesos por PID (en Windows, `OpenProcess`; en los tests, uno falso).
pub trait Procesos {
    fn abrir(&self, pid: u32) -> Option<Box<dyn Proceso>>;
}

fn id_valido(sesion: &str) -> bool {
    !sesion.is_empty() && sesion.len() <= 128 && sesion.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// ¿La presencia dice que la sesión duerme? Las mismas reglas que `dormida` de logica.js.
pub fn presencia_dormida(p: &Value, ahora: DateTime<Utc>) -> bool {
    if !p.is_object() || p["cerrada"].as_bool() == Some(true) || p["enTurno"].as_bool() == Some(true) {
        return false;
    }
    let vacia = |clave: &str| p[clave].as_array().is_none_or(|a| a.is_empty());
    let coordina = p["agentes"].as_array().is_some_and(|a| a.iter().any(|x| x["estado"] == "trabajando"));
    if !vacia("preguntas") || !vacia("procesos") || coordina {
        return false;
    }
    p["ultimoTurno"]
        .as_str()
        .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
        .is_some_and(|t| ahora - t.with_timezone(&Utc) > Duration::minutes(MINUTOS_DORMIDA))
}

/// El PID y el `procStart` que Claude Code registró para la sesión, si hay exactamente uno.
pub fn proceso_de_sesion(carpeta: &Path, sesion: &str) -> Option<(u32, u64)> {
    let mut hallados = Vec::new();
    for e in std::fs::read_dir(carpeta).ok()?.filter_map(Result::ok) {
        let ruta = e.path();
        if ruta.extension().is_none_or(|x| x != "json") {
            continue;
        }
        let Some(v) = std::fs::read_to_string(&ruta).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()) else {
            continue;
        };
        if v["sessionId"].as_str() != Some(sesion) {
            continue;
        }
        let pid = v["pid"].as_u64().and_then(|p| u32::try_from(p).ok());
        // El archivo se llama como su PID: uno que no coincide no se usa
        let nombre_ok = pid.is_some_and(|p| ruta.file_stem().is_some_and(|s| s.to_string_lossy() == p.to_string()));
        let arranque = match &v["procStart"] {
            Value::String(s) => s.parse::<u64>().ok(),
            Value::Number(n) => n.as_u64(),
            _ => None,
        };
        match (pid, arranque) {
            (Some(p), Some(a)) if nombre_ok => hallados.push((p, a)),
            _ => {}
        }
    }
    if hallados.len() == 1 { hallados.pop() } else { None }
}

/// Comprueba todo (ver el encabezado) y termina el proceso de la sesión. `oficina`: la carpeta de las
/// presencias; `claude`: `~/.claude/sessions` de Claude Code.
pub fn terminar_con(oficina: &Path, claude: &Path, sesion: &str, ahora: DateTime<Utc>, procesos: &dyn Procesos) -> Result<Value, Falla> {
    if !id_valido(sesion) {
        return Err(Falla::Id);
    }
    let ruta = oficina.join(format!("{sesion}.json"));
    let p = std::fs::read_to_string(&ruta).ok().and_then(|t| serde_json::from_str::<Value>(&t).ok()).ok_or(Falla::Despierta)?;
    // La presencia tiene que ser la que el widget muestra: de esta sesión y latiendo (`sesion_viva`)
    let viva = crate::sesiones::sesion_viva(&p, ahora - Duration::minutes(crate::sesiones::MINUTOS_VIGENCIA));
    if p["sesion"].as_str() != Some(sesion) || !viva || !presencia_dormida(&p, ahora) {
        return Err(Falla::Despierta);
    }
    let (pid, arranque) = proceso_de_sesion(claude, sesion).ok_or(Falla::SinProceso)?;
    let proceso = procesos.abrir(pid).ok_or(Falla::Fallo)?;
    let nombre = proceso.nombre().map(|n| n.to_ascii_lowercase());
    if proceso.arranque() != Some(arranque) || !nombre.is_some_and(|n| EJECUTABLES.contains(&n.as_str())) {
        return Err(Falla::NoCoincide);
    }
    if !proceso.terminar() {
        return Err(Falla::Fallo);
    }
    // El mod ya no puede escribir: la presencia queda cerrada y la tarjeta se va en el ciclo siguiente
    let _ = crate::atomico::escribir(&ruta, json!({ "sesion": sesion, "cerrada": true }).to_string().as_bytes());
    Ok(json!({ "ok": true, "pid": pid }))
}

/// Los procesos de verdad: `OpenProcess` con permiso para consultar y terminar.
#[cfg(windows)]
pub struct Windows;

#[cfg(windows)]
mod nativo {
    use super::{Proceso, Procesos, Windows};
    use windows_sys::Win32::Foundation::{CloseHandle, FILETIME, HANDLE};
    use windows_sys::Win32::System::Threading::{
        GetProcessTimes, OpenProcess, QueryFullProcessImageNameW, TerminateProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
        PROCESS_TERMINATE,
    };

    struct Abierto(HANDLE);

    impl Drop for Abierto {
        fn drop(&mut self) {
            // SAFETY: el handle salió de OpenProcess y se cierra una sola vez
            unsafe { CloseHandle(self.0) };
        }
    }

    impl Proceso for Abierto {
        fn arranque(&self) -> Option<u64> {
            let cero = FILETIME { dwLowDateTime: 0, dwHighDateTime: 0 };
            let (mut creado, mut salida, mut nucleo, mut usuario) = (cero, cero, cero, cero);
            // SAFETY: handle vivo con PROCESS_QUERY_LIMITED_INFORMATION; las cuatro salidas son locales
            let ok = unsafe { GetProcessTimes(self.0, &mut creado, &mut salida, &mut nucleo, &mut usuario) } != 0;
            ok.then(|| (u64::from(creado.dwHighDateTime) << 32) | u64::from(creado.dwLowDateTime))
        }

        fn nombre(&self) -> Option<String> {
            let mut buf = [0u16; 1024];
            let mut largo = buf.len() as u32;
            // SAFETY: `buf` tiene `largo` unidades; Windows escribe hasta ahí y deja en `largo` lo escrito
            let ok = unsafe { QueryFullProcessImageNameW(self.0, PROCESS_NAME_WIN32, buf.as_mut_ptr(), &mut largo) } != 0;
            if !ok {
                return None;
            }
            let ruta = String::from_utf16_lossy(&buf[..largo as usize]);
            ruta.rsplit(['\\', '/']).next().map(str::to_string)
        }

        fn terminar(&self) -> bool {
            // Código 0: terminarla es lo pedido, no una falla. Con 1, la extensión de VS Code muestra
            // «Claude Code process exited with code 1» sobre la pestaña de esa sesión.
            // SAFETY: handle vivo con PROCESS_TERMINATE
            unsafe { TerminateProcess(self.0, 0) != 0 }
        }
    }

    impl Procesos for Windows {
        fn abrir(&self, pid: u32) -> Option<Box<dyn Proceso>> {
            // SAFETY: sin punteros; un handle nulo es que no existe o no hay permiso
            let h = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE, 0, pid) };
            if h.is_null() { None } else { Some(Box::new(Abierto(h))) }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::fs;
    use std::path::PathBuf;
    use std::rc::Rc;

    const SESION: &str = "99fa3cc5-8b6b-40a2-aec8-c32bf9e287ba";
    const PID: u32 = 23688;
    const ARRANQUE: u64 = 134401775701135559;

    fn ahora() -> DateTime<Utc> {
        DateTime::parse_from_rfc3339("2026-11-26T16:30:00Z").unwrap().with_timezone(&Utc)
    }
    fn hace(min: i64) -> String {
        (ahora() - Duration::minutes(min)).to_rfc3339()
    }

    struct Carpetas {
        raiz: PathBuf,
        oficina: PathBuf,
        claude: PathBuf,
    }
    impl Drop for Carpetas {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.raiz);
        }
    }
    fn carpetas(nombre: &str) -> Carpetas {
        let raiz = std::env::temp_dir().join(format!("avis-terminar-{nombre}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&raiz);
        let (oficina, claude) = (raiz.join("sesiones"), raiz.join("sessions"));
        fs::create_dir_all(&oficina).unwrap();
        fs::create_dir_all(&claude).unwrap();
        Carpetas { raiz, oficina, claude }
    }
    fn presencia(c: &Carpetas, extra: Value) -> PathBuf {
        let mut p = json!({ "v": 1, "sesion": SESION, "actualizado": hace(0), "actividad": "esperándote", "enTurno": false,
            "ultimoTurno": hace(125), "agentes": [], "preguntas": [], "procesos": [] });
        for (k, v) in extra.as_object().unwrap() {
            p[k] = v.clone();
        }
        let ruta = c.oficina.join(format!("{SESION}.json"));
        fs::write(&ruta, p.to_string()).unwrap();
        ruta
    }
    fn registro(c: &Carpetas, archivo: &str, v: Value) {
        fs::write(c.claude.join(archivo), v.to_string()).unwrap();
    }
    fn registro_bien(c: &Carpetas) {
        registro(c, &format!("{PID}.json"), json!({ "pid": PID, "sessionId": SESION, "procStart": ARRANQUE.to_string(), "entrypoint": "claude-vscode" }));
    }

    /// Procesos falsos: el PID con su arranque y su nombre; anota a quién se terminó.
    #[derive(Clone)]
    struct Falsos {
        vivos: Vec<(u32, u64, &'static str)>,
        terminados: Rc<RefCell<Vec<u32>>>,
        niega: bool,
    }
    struct Falso {
        pid: u32,
        arranque: u64,
        nombre: &'static str,
        terminados: Rc<RefCell<Vec<u32>>>,
        niega: bool,
    }
    impl Proceso for Falso {
        fn arranque(&self) -> Option<u64> {
            Some(self.arranque)
        }
        fn nombre(&self) -> Option<String> {
            Some(self.nombre.to_string())
        }
        fn terminar(&self) -> bool {
            if self.niega {
                return false;
            }
            self.terminados.borrow_mut().push(self.pid);
            true
        }
    }
    impl Procesos for Falsos {
        fn abrir(&self, pid: u32) -> Option<Box<dyn Proceso>> {
            let (pid, arranque, nombre) = *self.vivos.iter().find(|(p, ..)| *p == pid)?;
            Some(Box::new(Falso { pid, arranque, nombre, terminados: self.terminados.clone(), niega: self.niega }))
        }
    }
    fn falsos(vivos: Vec<(u32, u64, &'static str)>) -> Falsos {
        Falsos { vivos, terminados: Rc::new(RefCell::new(Vec::new())), niega: false }
    }

    #[test]
    fn termina_la_sesion_dormida_y_deja_su_presencia_cerrada() {
        let c = carpetas("bien");
        let ruta = presencia(&c, json!({}));
        registro_bien(&c);
        let p = falsos(vec![(PID, ARRANQUE, "claude.exe"), (17924, 1, "claude.exe")]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Ok(json!({ "ok": true, "pid": PID })));
        assert_eq!(*p.terminados.borrow(), vec![PID]);
        let v: Value = serde_json::from_str(&fs::read_to_string(ruta).unwrap()).unwrap();
        assert_eq!(v, json!({ "sesion": SESION, "cerrada": true }));
    }

    #[test]
    fn tambien_el_claude_de_npm() {
        let c = carpetas("npm");
        presencia(&c, json!({}));
        registro_bien(&c);
        let p = falsos(vec![(PID, ARRANQUE, "NODE.EXE")]);
        assert!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p).is_ok());
        assert_eq!(*p.terminados.borrow(), vec![PID]);
    }

    #[test]
    fn un_id_invalido_no_toca_nada() {
        let c = carpetas("id");
        let p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
        for id in ["", "../sesiones/x", "a b", &"x".repeat(129)] {
            assert_eq!(terminar_con(&c.oficina, &c.claude, id, ahora(), &p), Err(Falla::Id));
        }
        assert!(p.terminados.borrow().is_empty());
    }

    #[test]
    fn una_sesion_despierta_no_se_termina() {
        let casos = [
            json!({ "ultimoTurno": hace(20) }),
            json!({ "ultimoTurno": null }),
            json!({ "ultimoTurno": "no es fecha" }),
            json!({ "enTurno": true }),
            json!({ "cerrada": true }),
            json!({ "preguntas": [{ "id": "p1", "agente": null }] }),
            json!({ "procesos": [{ "id": "b1", "descripcion": "npm run dev" }] }),
            json!({ "agentes": [{ "id": "a1", "estado": "trabajando" }] }),
        ];
        for (k, extra) in casos.into_iter().enumerate() {
            let c = carpetas(&format!("despierta-{k}"));
            presencia(&c, extra.clone());
            registro_bien(&c);
            let p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
            assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::Despierta), "caso {extra}");
            assert!(p.terminados.borrow().is_empty());
        }
        // Sin presencia, tampoco
        let c = carpetas("sin-presencia");
        registro_bien(&c);
        let p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::Despierta));
    }

    #[test]
    fn una_presencia_vieja_o_de_otra_sesion_no_sirve() {
        // Sin latir hace más de 2 min (el widget ya no la muestra) o con otro id adentro (A2 del verificador)
        for (k, extra) in [json!({ "actualizado": hace(3) }), json!({ "sesion": "otra-sesion" })].into_iter().enumerate() {
            let c = carpetas(&format!("vieja-{k}"));
            presencia(&c, extra);
            registro_bien(&c);
            let p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
            assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::Despierta));
            assert!(p.terminados.borrow().is_empty());
        }
    }

    #[test]
    fn un_subagente_que_ya_termino_no_la_despierta() {
        let c = carpetas("sub-listo");
        presencia(&c, json!({ "agentes": [{ "id": "a1", "estado": "listo" }] }));
        registro_bien(&c);
        let p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
        assert!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p).is_ok());
    }

    #[test]
    fn sin_un_registro_unico_de_claude_code_no_se_termina() {
        // Sin registro
        let c = carpetas("sin-registro");
        presencia(&c, json!({}));
        let p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::SinProceso));
        // Sin procStart
        registro(&c, &format!("{PID}.json"), json!({ "pid": PID, "sessionId": SESION }));
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::SinProceso));
        // El archivo no se llama como su PID
        let c = carpetas("otro-nombre");
        presencia(&c, json!({}));
        registro(&c, "555.json", json!({ "pid": PID, "sessionId": SESION, "procStart": ARRANQUE.to_string() }));
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::SinProceso));
        // Dos procesos dicen ser la sesión
        let c = carpetas("dos");
        presencia(&c, json!({}));
        registro_bien(&c);
        registro(&c, "777.json", json!({ "pid": 777, "sessionId": SESION, "procStart": 5 }));
        let p = falsos(vec![(PID, ARRANQUE, "claude.exe"), (777, 5, "claude.exe")]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::SinProceso));
        assert!(p.terminados.borrow().is_empty());
    }

    #[test]
    fn un_pid_reusado_u_otro_ejecutable_no_se_termina() {
        let c = carpetas("reusado");
        presencia(&c, json!({}));
        registro_bien(&c);
        // El PID existe pero arrancó en otro momento: es otro proceso
        let p = falsos(vec![(PID, ARRANQUE + 1, "claude.exe")]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::NoCoincide));
        // Mismo arranque, otro ejecutable
        let p = falsos(vec![(PID, ARRANQUE, "explorer.exe")]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::NoCoincide));
        assert!(p.terminados.borrow().is_empty());
        // Ya no existe
        let p = falsos(vec![]);
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::Fallo));
    }

    #[test]
    fn si_windows_no_deja_terminarlo_la_presencia_queda_igual() {
        let c = carpetas("niega");
        let ruta = presencia(&c, json!({}));
        let antes = fs::read_to_string(&ruta).unwrap();
        registro_bien(&c);
        let mut p = falsos(vec![(PID, ARRANQUE, "claude.exe")]);
        p.niega = true;
        assert_eq!(terminar_con(&c.oficina, &c.claude, SESION, ahora(), &p), Err(Falla::Fallo));
        assert_eq!(fs::read_to_string(&ruta).unwrap(), antes);
    }

    #[cfg(windows)]
    #[test]
    fn el_proceso_propio_se_lee_sin_terminarlo() {
        let p = Windows.abrir(std::process::id()).expect("abre el propio proceso");
        assert!(p.arranque().is_some_and(|a| a > 0));
        assert!(p.nombre().is_some_and(|n| n.to_ascii_lowercase().ends_with(".exe")));
    }

    /// Medición, solo lectura: cada sesión viva de Claude Code en esta máquina tiene un `procStart` igual
    /// al arranque que da Windows. `cargo test --lib real_procstart -- --ignored --nocapture`.
    #[cfg(windows)]
    #[test]
    #[ignore]
    fn real_procstart_coincide_con_el_arranque_de_windows() {
        let carpeta = crate::transcripcion::carpeta_claude().unwrap().join("sessions");
        let mut vistos = 0;
        for e in fs::read_dir(&carpeta).unwrap().filter_map(Result::ok) {
            let Ok(v) = serde_json::from_str::<Value>(&fs::read_to_string(e.path()).unwrap_or_default()) else { continue };
            let (Some(pid), Some(inicio)) = (v["pid"].as_u64(), v["procStart"].as_str().and_then(|s| s.parse::<u64>().ok())) else { continue };
            let Some(p) = Windows.abrir(pid as u32) else { continue };
            println!("pid {pid}: procStart {inicio}, Windows {:?}, {:?}", p.arranque(), p.nombre());
            assert_eq!(p.arranque(), Some(inicio));
            vistos += 1;
        }
        assert!(vistos > 0);
    }

    #[test]
    fn el_registro_real_de_claude_code_se_lee_con_procstart_en_texto() {
        // Forma medida el 26/11 en ~/.claude/sessions/23688.json (Claude Code 2.1.332)
        let c = carpetas("real");
        registro(&c, "23688.json", json!({ "pid": 23688, "sessionId": SESION, "cwd": "c:\\Users\\Nico\\OneDrive\\Desktop\\catalogo",
            "startedAt": 1795703973172u64, "procStart": "134401775701135559", "kind": "interactive", "entrypoint": "claude-vscode", "status": "idle" }));
        registro(&c, "17924.json", json!({ "pid": 17924, "sessionId": "df433eb3-4c2d-4044-9387-89744f99ee8a", "procStart": "134401825240125323" }));
        assert_eq!(proceso_de_sesion(&c.claude, SESION), Some((23688, 134401775701135559)));
    }
}
