//! Mod automático (#17): el widget instala el mod si falta y lo actualiza si hay una versión nueva,
//! sin clic. Si está apagado no lo prende: la ventana muestra "El mod está apagado" con "Prender",
//! que corre `Accion::Activar` con el clic del usuario (primerosPasos.js). Revisa al arrancar y
//! después una vez por día; la hora de la última revisión que corrió un comando queda en
//! `preferencias.json`. Nunca corre dos veces a la vez ni durante un paso de Primeros pasos: un solo
//! hilo revisa y cada comando toma el mismo `Turno`. Sin red o con un error, lo anota en
//! `widget.log` y reintenta en la próxima revisión diaria, sin bucle.
//!
//! Reusa todo de primeros_pasos.rs: la búsqueda de `claude`, la ejecución sin consola, la lectura
//! de `plugin list --json` (`revisar_claude`) y el plan de cada acción (`plan`, `ejecutar`).

use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::Duration;

use serde_json::{json, Value};

use crate::diagnostico;
use crate::preferencias::{self, RevisionMod};
use crate::primeros_pasos::{self, Accion, Fin, TURNO};

/// Evento a la ventana: `{ estado: "empieza", accion }` cuando arranca una instalación sola (el
/// asistente la muestra como si se hubiera tocado su botón) y `{ estado: "aviso" }` cuando hay un
/// aviso para el tablero (`tomar_aviso`).
pub const EVENTO: &str = "oficina://mod-auto";
/// Un día, en milisegundos: cada cuánto se busca una versión nueva.
pub const DIA_MS: i64 = 24 * 60 * 60 * 1000;
/// Si corre un paso de Primeros pasos, se vuelve a intentar a los 10 minutos.
pub const REINTENTO_OCUPADO_MS: i64 = 10 * 60 * 1000;
/// La primera revisión espera que la ventana esté lista para escuchar los avisos.
pub const ARRANQUE_MS: i64 = 5_000;
/// El hilo duerme de a 30 minutos como mucho y mira la hora: una suspensión del equipo no lo atrasa.
pub const VUELTA_MS: i64 = 30 * 60 * 1000;

/// Lo que importa del mod según `revisar_claude`.
#[derive(Debug, Default, PartialEq)]
pub struct Lectura {
    pub claude: bool,
    /// `None`: la lista de plugins se leyó bien.
    pub error: Option<String>,
    pub instalado: bool,
    pub activo: bool,
    pub version: Option<String>,
}

/// La lectura a partir de lo que devuelve `primeros_pasos::revisar_claude`.
pub fn lectura(revision: &Value) -> Lectura {
    if revision["claude"]["encontrado"] != true {
        return Lectura::default();
    }
    let m = &revision["mod"];
    Lectura {
        claude: true,
        error: m["error"].as_str().map(String::from),
        instalado: m["instalado"] == true,
        activo: m["activo"] == true,
        version: m["version"].as_str().map(String::from),
    }
}

/// ¿Toca buscar una versión nueva? Nunca se revisó, pasó un día, o la hora guardada quedó en el
/// futuro (se atrasó el reloj): sí.
pub fn toca_actualizar(guardada: Option<RevisionMod>, ahora: i64) -> bool {
    match guardada {
        None => true,
        Some(g) => ahora - g.revisado >= DIA_MS || g.revisado > ahora,
    }
}

/// Qué hace una revisión.
#[derive(Debug, PartialEq)]
pub enum Decision {
    /// Corre un paso de Primeros pasos: se reintenta en `REINTENTO_OCUPADO_MS`.
    Esperar,
    /// Sin Claude Code no hay dónde instalar el mod (lo dice el paso 1 del asistente).
    SinClaude,
    /// No se pudo leer la lista de plugins: no se instala a ciegas.
    Ilegible,
    /// Falta: se instala (catálogo si no está + `plugin install`).
    Instalar,
    /// Falta, pero la última instalación falló hace menos de un día: espera la próxima revisión diaria.
    NoReintentar,
    /// Instalado y apagado: no se prende solo (respeta que se apague a propósito).
    Apagado,
    /// Prendido y pasó un día: `plugin marketplace update quintech` + `plugin update`.
    Actualizar,
    /// Prendido y ya revisado hoy.
    AlDia,
}

pub fn decidir(l: &Lectura, ocupado: bool, guardada: Option<RevisionMod>, ahora: i64) -> Decision {
    let toca = toca_actualizar(guardada, ahora);
    if ocupado {
        Decision::Esperar
    } else if !l.claude {
        Decision::SinClaude
    } else if l.error.is_some() {
        Decision::Ilegible
    } else if !l.instalado {
        // Falta: se instala en cualquier revisión, salvo que la última instalación haya fallado hoy
        if guardada.is_some_and(|g| g.fallo) && !toca {
            Decision::NoReintentar
        } else {
            Decision::Instalar
        }
    } else if !l.activo {
        Decision::Apagado
    } else if toca {
        Decision::Actualizar
    } else {
        Decision::AlDia
    }
}

/// Cuánto esperar hasta la próxima revisión después de una.
pub fn espera_tras(d: &Decision) -> i64 {
    match d {
        Decision::Esperar => REINTENTO_OCUPADO_MS,
        _ => DIA_MS,
    }
}

/// Cuánto dormir antes de mirar otra vez, o `None` si ya toca revisar. Si la próxima quedó a más de
/// un día (se atrasó el reloj), toca ahora.
pub fn falta_para(proxima: i64, ahora: i64) -> Option<i64> {
    let falta = proxima - ahora;
    if falta <= 0 || falta > DIA_MS + REINTENTO_OCUPADO_MS {
        return None;
    }
    Some(falta.min(VUELTA_MS))
}

/// El aviso para el tablero después de una acción que salió bien: `{ tipo: "instalo", version }` o
/// `{ tipo: "actualizo", version, desde }`. Sin versión nueva (ya estaba al día), ninguno.
pub fn aviso(accion: Accion, antes: Option<&str>, despues: Option<&str>) -> Option<Value> {
    let version = despues?;
    match accion {
        Accion::Mod => Some(json!({ "tipo": "instalo", "version": version })),
        Accion::Actualizar if antes != Some(version) => Some(json!({ "tipo": "actualizo", "version": version, "desde": antes })),
        _ => None,
    }
}

/// Lo que muestra la tarjeta "Mod de Claude Code" de la configuración (`estado_mod`,
/// configuracion-ux.md 9.2 y 7.3): la lectura de `revisar_claude` (solo comandos de lectura) y la
/// última revisión automática guardada, `{ claude, mod, revisado, fallo }`. Sin revisión, `revisado`
/// es null. El aviso de una vez no va acá: lo toma la ventana con `tomar_aviso`.
pub fn estado_para_ventana(revision: &Value, guardada: Option<RevisionMod>) -> Value {
    json!({
        "claude": revision["claude"].clone(),
        "mod": revision["mod"].clone(),
        "revisado": guardada.map(|g| g.revisado),
        "fallo": guardada.is_some_and(|g| g.fallo),
    })
}

// ------------------------------------------------------------------ lo que corre

/// El aviso pendiente: la ventana lo toma una vez (`tomar_aviso`) y queda vacío.
static AVISO: Mutex<Option<Value>> = Mutex::new(None);

pub fn tomar_aviso() -> Option<Value> {
    AVISO.lock().unwrap_or_else(PoisonError::into_inner).take()
}

fn registrar(texto: &str) {
    if let Some(ruta) = diagnostico::ruta_log() {
        let _ = diagnostico::agregar_linea(&ruta, &format!("mod automático: {texto}"), chrono::Utc::now(), diagnostico::TOPE_BYTES);
    }
}

fn ahora_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

/// El hilo de la revisión: la primera a los `ARRANQUE_MS` y después según `espera_tras`. Uno solo
/// para toda la vida de la aplicación: nunca hay dos revisiones a la vez.
pub fn vigilar(ruta: Option<PathBuf>, emitir: impl Fn(&str, Value) + Sync) {
    let mut proxima = ahora_ms() + ARRANQUE_MS;
    loop {
        while let Some(ms) = falta_para(proxima, ahora_ms()) {
            std::thread::sleep(Duration::from_millis(ms.max(1) as u64));
        }
        let d = revisar_una_vez(ruta.as_deref(), &emitir);
        proxima = ahora_ms() + espera_tras(&d);
    }
}

/// Una revisión: lee el mod (solo lectura), decide y, si toca, corre la acción con el turno tomado.
fn revisar_una_vez(ruta: Option<&Path>, emitir: &(dyn Fn(&str, Value) + Sync)) -> Decision {
    let ahora = ahora_ms();
    let guardada = ruta.and_then(preferencias::leer_revision_mod);
    let ocupado = TURNO.ocupado();
    let l = if ocupado { Lectura::default() } else { lectura(&primeros_pasos::revisar_claude(&primeros_pasos::lugares())) };
    let d = decidir(&l, ocupado, guardada, ahora);
    let accion = match d {
        Decision::Instalar => Accion::Mod,
        Decision::Actualizar => Accion::Actualizar,
        Decision::Esperar => {
            registrar("corre un paso de Primeros pasos; se reintenta en 10 minutos");
            return d;
        }
        Decision::SinClaude => {
            registrar("Claude Code no está; no se revisa el mod");
            return d;
        }
        Decision::Ilegible => {
            registrar(&format!("no se pudo leer la lista de plugins: {}", l.error.as_deref().unwrap_or("sin detalle")));
            return d;
        }
        Decision::NoReintentar => {
            registrar("falta el mod y la última instalación falló; se reintenta en la próxima revisión diaria");
            return d;
        }
        Decision::Apagado => {
            registrar("el mod está apagado; no se prende solo");
            return d;
        }
        Decision::AlDia => return d,
    };
    if TURNO.empezar(accion).is_err() {
        registrar("corre un paso de Primeros pasos; se reintenta en 10 minutos");
        return Decision::Esperar;
    }
    let instala = accion == Accion::Mod;
    if instala {
        emitir(EVENTO, json!({ "estado": "empieza", "accion": accion.nombre() }));
    }
    let fin = {
        // El turno se suelta al salir de este bloque, aunque el paso se caiga
        let _soltar = TURNO.soltar_al_terminar();
        // Instalar avisa al asistente como un clic en "Instalar en Claude Code"; actualizar, no
        let al_asistente = |v: Value| {
            if instala {
                emitir(primeros_pasos::EVENTO, v);
            }
        };
        primeros_pasos::ejecutar(accion, &TURNO, &al_asistente, &|| {})
    };
    if instala {
        emitir(primeros_pasos::EVENTO, fin.evento(accion));
    }
    let guardar = |fallo: bool| {
        if let Some(r) = ruta {
            if let Err(e) = preferencias::guardar_revision_mod(r, RevisionMod { revisado: ahora, fallo }) {
                registrar(&format!("no se pudo guardar la hora de la revisión: {e}"));
            }
        }
    };
    match fin {
        Fin::Listo => {
            let despues = lectura(&primeros_pasos::revisar_claude(&primeros_pasos::lugares())).version;
            match aviso(accion, l.version.as_deref(), despues.as_deref()) {
                Some(a) => {
                    registrar(&texto_de_aviso(&a));
                    *AVISO.lock().unwrap_or_else(PoisonError::into_inner) = Some(a);
                    emitir(EVENTO, json!({ "estado": "aviso" }));
                }
                None => registrar(&format!("al día ({})", despues.as_deref().unwrap_or("versión desconocida"))),
            }
            guardar(false);
        }
        Fin::Error { comando, linea, .. } => {
            registrar(&format!("falló {comando}: {linea}; se reintenta en la próxima revisión diaria"));
            guardar(true);
        }
        // Avis se está cerrando: no se anota como revisado
        Fin::Cancelado | Fin::Vencido => registrar("cortado al cerrar Avis"),
    }
    d
}

fn texto_de_aviso(a: &Value) -> String {
    let version = a["version"].as_str().unwrap_or("?");
    match a["tipo"].as_str() {
        Some("actualizo") => format!("actualizado de {} a {version}", a["desde"].as_str().unwrap_or("?")),
        _ => format!("instalado {version}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::primeros_pasos::{estado_mod, plan, Programa};

    /// La entrada del mod en `claude plugin list --json`, tal cual salió en la máquina de Quintana el
    /// 2026-11-22 (0.9.0, prendido, para el usuario), con otra de otro proyecto apagada al lado.
    const LISTA_REAL: &str = r#"[
  {
    "id": "engram@engram",
    "version": "0.1.14",
    "scope": "user",
    "enabled": true,
    "installPath": "C:\\Users\\Nico\\.claude\\plugins\\cache\\engram\\engram\\0.1.14",
    "installedAt": "2026-04-26T19:15:44.453Z",
    "lastUpdated": "2026-10-20T23:56:45.155Z",
    "projectEnabled": false
  },
  {
    "id": "oficina@quintech",
    "version": "0.9.0",
    "scope": "user",
    "enabled": true,
    "installPath": "C:\\Users\\Nico\\.claude\\plugins\\cache\\quintech\\oficina\\0.9.0",
    "installedAt": "2026-11-12T13:32:48.555Z",
    "lastUpdated": "2026-11-22T16:55:31.514Z",
    "projectEnabled": false,
    "hasUserConfig": true
  }
]"#;

    /// Una revisión como la arma `revisar_claude`, con la lista de plugins dada.
    fn revision(claude: bool, lista: &str) -> Value {
        let mut m = estado_mod(lista).unwrap();
        m["catalogo"] = json!(true);
        m["error"] = Value::Null;
        json!({ "claude": { "encontrado": claude, "version": if claude { json!("2.1.329") } else { Value::Null } }, "mod": m })
    }

    fn con(instalado: bool, activo: bool) -> Lectura {
        Lectura { claude: true, error: None, instalado, activo, version: instalado.then(|| String::from("0.9.0")) }
    }

    const AHORA: i64 = 1_795_000_000_000;
    const HACE_UNA_HORA: i64 = AHORA - 60 * 60 * 1000;
    const AYER: i64 = AHORA - DIA_MS;

    fn guardada(revisado: i64, fallo: bool) -> Option<RevisionMod> {
        Some(RevisionMod { revisado, fallo })
    }

    #[test]
    fn la_lectura_sale_de_la_lista_real_de_plugins() {
        assert_eq!(
            lectura(&revision(true, LISTA_REAL)),
            Lectura { claude: true, error: None, instalado: true, activo: true, version: Some(String::from("0.9.0")) }
        );
        // Apagado: instalado, no prendido
        let apagada = LISTA_REAL.replace("\"enabled\": true,\n    \"installPath\": \"C:\\\\Users\\\\Nico\\\\.claude\\\\plugins\\\\cache\\\\quintech", "\"enabled\": false,\n    \"installPath\": \"C:\\\\Users\\\\Nico\\\\.claude\\\\plugins\\\\cache\\\\quintech");
        assert_ne!(apagada, LISTA_REAL);
        assert_eq!(lectura(&revision(true, &apagada)), Lectura { claude: true, error: None, instalado: true, activo: false, version: Some(String::from("0.9.0")) });
        // Sin el mod en la lista
        assert_eq!(lectura(&revision(true, "[]")), Lectura { claude: true, error: None, instalado: false, activo: false, version: None });
        // Sin Claude Code
        let sin = json!({ "claude": { "encontrado": false, "version": null }, "mod": { "instalado": false, "activo": false, "version": null, "catalogo": false, "error": null } });
        assert_eq!(lectura(&sin), Lectura::default());
        // La lista no se pudo leer: el error viaja (y no cuenta como "falta")
        let mala = json!({ "claude": { "encontrado": true, "version": "2.1.329" }, "mod": { "instalado": false, "activo": false, "version": null, "catalogo": true, "error": "Claude Code devolvió una lista ilegible" } });
        assert_eq!(lectura(&mala).error.as_deref(), Some("Claude Code devolvió una lista ilegible"));
    }

    #[test]
    fn falta_el_mod_se_instala_solo() {
        assert_eq!(decidir(&con(false, false), false, None, AHORA), Decision::Instalar);
        // Al arrancar se instala aunque la última revisión (que salió bien) haya sido hace una hora
        assert_eq!(decidir(&con(false, false), false, guardada(HACE_UNA_HORA, false), AHORA), Decision::Instalar);
    }

    #[test]
    fn prendido_busca_version_nueva_una_vez_por_dia() {
        assert_eq!(decidir(&con(true, true), false, None, AHORA), Decision::Actualizar);
        assert_eq!(decidir(&con(true, true), false, guardada(AYER, false), AHORA), Decision::Actualizar);
        assert_eq!(decidir(&con(true, true), false, guardada(HACE_UNA_HORA, false), AHORA), Decision::AlDia);
        // Un error de hace un día no frena la revisión diaria
        assert_eq!(decidir(&con(true, true), false, guardada(AYER, true), AHORA), Decision::Actualizar);
    }

    #[test]
    fn apagado_no_se_prende_ni_se_actualiza_solo() {
        assert_eq!(decidir(&con(true, false), false, None, AHORA), Decision::Apagado);
        assert_eq!(decidir(&con(true, false), false, guardada(AYER, false), AHORA), Decision::Apagado);
    }

    #[test]
    fn nunca_corre_durante_un_paso_de_primeros_pasos() {
        for l in [con(false, false), con(true, true), con(true, false)] {
            assert_eq!(decidir(&l, true, None, AHORA), Decision::Esperar);
        }
        assert_eq!(espera_tras(&Decision::Esperar), REINTENTO_OCUPADO_MS);
    }

    #[test]
    fn tras_un_error_no_insiste_hasta_la_proxima_revision_diaria() {
        // La instalación falló hace una hora: no se reintenta, ni al arrancar otra vez
        assert_eq!(decidir(&con(false, false), false, guardada(HACE_UNA_HORA, true), AHORA), Decision::NoReintentar);
        // Al día siguiente, sí
        assert_eq!(decidir(&con(false, false), false, guardada(AYER, true), AHORA), Decision::Instalar);
        // Una actualización que falló espera también el día
        assert_eq!(decidir(&con(true, true), false, guardada(HACE_UNA_HORA, true), AHORA), Decision::AlDia);
        // Después de cualquier revisión que no espera turno, la próxima es en un día
        for d in [Decision::SinClaude, Decision::Ilegible, Decision::Instalar, Decision::NoReintentar, Decision::Apagado, Decision::Actualizar, Decision::AlDia] {
            assert_eq!(espera_tras(&d), DIA_MS, "{d:?}");
        }
    }

    #[test]
    fn sin_claude_o_sin_poder_leer_la_lista_no_hace_nada() {
        assert_eq!(decidir(&Lectura::default(), false, None, AHORA), Decision::SinClaude);
        let mala = Lectura { claude: true, error: Some(String::from("ilegible")), ..Lectura::default() };
        assert_eq!(decidir(&mala, false, None, AHORA), Decision::Ilegible);
    }

    #[test]
    fn toca_actualizar_si_nunca_se_reviso_paso_un_dia_o_se_atraso_el_reloj() {
        assert!(toca_actualizar(None, AHORA));
        assert!(toca_actualizar(guardada(AYER, false), AHORA));
        assert!(!toca_actualizar(guardada(AYER + 1, false), AHORA));
        assert!(!toca_actualizar(guardada(AHORA, false), AHORA));
        // La hora guardada quedó en el futuro: el reloj se atrasó, no se espera para siempre
        assert!(toca_actualizar(guardada(AHORA + 60 * 60 * 1000, false), AHORA));
    }

    #[test]
    fn el_hilo_duerme_de_a_tramos_y_revisa_cuando_toca() {
        assert_eq!(falta_para(AHORA, AHORA), None);
        assert_eq!(falta_para(AHORA - 1, AHORA), None);
        assert_eq!(falta_para(AHORA + 5_000, AHORA), Some(5_000));
        // De a 30 minutos como mucho
        assert_eq!(falta_para(AHORA + DIA_MS, AHORA), Some(VUELTA_MS));
        // A más de un día: el reloj se atrasó, toca ahora
        assert_eq!(falta_para(AHORA + DIA_MS + REINTENTO_OCUPADO_MS + 1, AHORA), None);
    }

    #[test]
    fn el_aviso_dice_que_se_instalo_o_a_que_version_se_actualizo() {
        assert_eq!(aviso(Accion::Mod, None, Some("0.9.0")), Some(json!({ "tipo": "instalo", "version": "0.9.0" })));
        assert_eq!(aviso(Accion::Actualizar, Some("0.9.0"), Some("0.9.1")), Some(json!({ "tipo": "actualizo", "version": "0.9.1", "desde": "0.9.0" })));
        // Ya estaba al día: sin aviso
        assert_eq!(aviso(Accion::Actualizar, Some("0.9.0"), Some("0.9.0")), None);
        // Sin versión después (no se pudo leer): sin aviso
        assert_eq!(aviso(Accion::Mod, None, None), None);
        assert_eq!(aviso(Accion::Actualizar, Some("0.9.0"), None), None);
        // Las demás acciones no avisan
        assert_eq!(aviso(Accion::Activar, Some("0.9.0"), Some("0.9.0")), None);
    }

    #[test]
    fn actualizar_refresca_el_catalogo_y_actualiza_el_mod_y_la_ventana_no_lo_puede_pedir() {
        let p = plan(Accion::Actualizar, true);
        assert_eq!(p.iter().map(|o| (o.programa, o.args.clone())).collect::<Vec<_>>(), vec![
            (Programa::Claude, vec!["plugin", "marketplace", "update", "quintech", "--json"]),
            (Programa::Claude, vec!["plugin", "update", "oficina@quintech", "--json"]),
        ]);
        assert_eq!(p.iter().map(|o| o.mostrar).collect::<Vec<_>>(), vec!["claude plugin marketplace update quintech", "claude plugin update oficina@quintech"]);
        // Con o sin catálogo, el mismo plan (si está instalado, el catálogo está)
        assert_eq!(plan(Accion::Actualizar, false).len(), 2);
        // La ventana solo pide pasos con un clic: "actualizar" no es uno
        assert_eq!(Accion::desde("actualizar"), None);
        assert_eq!(Accion::Actualizar.paso(), "mod");
        // El resto de los planes del mod no cambia
        assert_eq!(plan(Accion::Mod, true).iter().map(|o| o.mostrar).collect::<Vec<_>>(), vec!["claude plugin install oficina@quintech"]);
        assert_eq!(plan(Accion::Activar, true).iter().map(|o| o.mostrar).collect::<Vec<_>>(), vec!["claude plugin enable oficina@quintech"]);
        for (texto, a) in [("mod", Accion::Mod), ("activar", Accion::Activar), ("gh", Accion::Gh), ("conectar", Accion::Conectar), ("permiso", Accion::Permiso)] {
            assert_eq!(Accion::desde(texto), Some(a));
        }
    }

    #[test]
    fn el_turno_ocupado_lo_ve_la_revision() {
        let t = primeros_pasos::Turno::default();
        assert!(!t.ocupado());
        t.empezar(Accion::Mod).unwrap();
        assert!(t.ocupado());
        // Un clic mientras corre la revisión se rechaza, y al revés
        assert!(t.empezar(Accion::Activar).is_err());
        t.terminar();
        assert!(!t.ocupado());
    }

    #[test]
    fn el_estado_para_la_configuracion_junta_la_lectura_y_la_ultima_revision() {
        // configuracion-ux.md 9.2: { claude, mod, revisado, fallo }, sin correr nada que escriba
        let e = estado_para_ventana(&revision(true, LISTA_REAL), guardada(HACE_UNA_HORA, false));
        assert_eq!(e["claude"], json!({ "encontrado": true, "version": "2.1.329" }));
        assert_eq!(e["mod"]["instalado"], true);
        assert_eq!(e["mod"]["activo"], true);
        assert_eq!(e["mod"]["version"], "0.9.0");
        assert_eq!(e["revisado"], HACE_UNA_HORA);
        assert_eq!(e["fallo"], false);
        // La revisión que falló se ve; sin revisión guardada, null (nunca un número inventado)
        assert_eq!(estado_para_ventana(&revision(true, LISTA_REAL), guardada(AYER, true))["fallo"], true);
        let nunca = estado_para_ventana(&revision(true, "[]"), None);
        assert_eq!(nunca["revisado"], Value::Null);
        assert_eq!(nunca["fallo"], false);
        assert_eq!(nunca["mod"]["instalado"], false);
        // Sin Claude Code
        assert_eq!(estado_para_ventana(&revision(false, "[]"), None)["claude"]["encontrado"], false);
    }

    #[test]
    fn el_estado_para_la_configuracion_dice_lo_mismo_que_la_lectura_del_mod_automatico() {
        // La tarjeta de la configuración y la decisión de mod_auto leen la misma revisión
        for lista in [LISTA_REAL, "[]"] {
            let r = revision(true, lista);
            let e = estado_para_ventana(&r, None);
            let l = lectura(&r);
            assert_eq!(e["mod"]["instalado"], l.instalado);
            assert_eq!(e["mod"]["activo"], l.activo);
            assert_eq!(e["mod"]["version"].as_str().map(String::from), l.version);
        }
    }
}
