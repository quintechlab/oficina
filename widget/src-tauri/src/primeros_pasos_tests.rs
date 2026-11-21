// Tests de primeros_pasos.rs con las salidas reales de los comandos de solo lectura, tomadas en la
// máquina del usuario el 2026-11-20 (P0, docs/diseno/bienvenida-ux.md 9.2).
use super::*;

fn lugares(path: &str) -> Lugares {
    Lugares {
        path: path.to_string(),
        perfil: Some(PathBuf::from(r"C:\Users\Ana")),
        archivos_de_programa: Some(PathBuf::from(r"C:\Program Files")),
        datos_locales: Some(PathBuf::from(r"C:\Users\Ana\AppData\Local")),
    }
}

// ---------------------------------------------------------------- PATH y ejecutables (9.4)

#[test]
fn el_path_suma_sistema_usuario_y_el_actual_sin_repetir() {
    let sistema = r"C:\Windows\system32;C:\Program Files\GitHub CLI\";
    let usuario = r"C:\Users\Ana\AppData\Roaming\npm;;C:\WINDOWS\System32";
    let actual = r"C:\Windows\system32;C:\herramientas";
    assert_eq!(
        unir_path(sistema, usuario, actual),
        r"C:\Windows\system32;C:\Program Files\GitHub CLI\;C:\Users\Ana\AppData\Roaming\npm;C:\herramientas"
    );
}

#[test]
fn sin_registro_queda_el_path_actual() {
    assert_eq!(unir_path("", "", r"C:\a; C:\b "), r"C:\a;C:\b");
}

#[test]
fn claude_se_busca_exe_en_el_path_despues_el_instalador_nativo_y_al_final_el_cmd() {
    let c = candidatos(Programa::Claude, &lugares(r"C:\npm;C:\otra"));
    let esperado: Vec<PathBuf> = [
        r"C:\npm\claude.exe",
        r"C:\otra\claude.exe",
        r"C:\Users\Ana\.local\bin\claude.exe",
        r"C:\npm\claude.cmd",
        r"C:\otra\claude.cmd",
    ]
    .iter()
    .map(PathBuf::from)
    .collect();
    assert_eq!(c, esperado);
}

#[test]
fn con_npm_se_encuentra_el_cmd() {
    let l = lugares(r"C:\Windows;C:\Users\Ana\AppData\Roaming\npm");
    let hay = |p: &Path| p == Path::new(r"C:\Users\Ana\AppData\Roaming\npm\claude.cmd");
    assert_eq!(
        primero_que_existe(candidatos(Programa::Claude, &l), hay),
        Some(PathBuf::from(r"C:\Users\Ana\AppData\Roaming\npm\claude.cmd"))
    );
    // Si además está el instalador nativo, gana el .exe
    let hay_los_dos = |p: &Path| hay(p) || p == Path::new(r"C:\Users\Ana\.local\bin\claude.exe");
    assert_eq!(
        primero_que_existe(candidatos(Programa::Claude, &l), hay_los_dos),
        Some(PathBuf::from(r"C:\Users\Ana\.local\bin\claude.exe"))
    );
}

#[test]
fn gh_recien_instalado_se_encuentra_en_archivos_de_programa_aunque_el_path_sea_viejo() {
    let l = lugares(r"C:\Windows");
    let hay = |p: &Path| p == Path::new(r"C:\Program Files\GitHub CLI\gh.exe");
    assert_eq!(primero_que_existe(candidatos(Programa::Gh, &l), hay), Some(PathBuf::from(r"C:\Program Files\GitHub CLI\gh.exe")));
    assert_eq!(primero_que_existe(candidatos(Programa::Gh, &l), |_| false), None);
}

#[test]
fn winget_se_busca_en_el_path_y_en_windowsapps() {
    let c = candidatos(Programa::Winget, &lugares(r"C:\x"));
    assert_eq!(c, vec![PathBuf::from(r"C:\x\winget.exe"), PathBuf::from(r"C:\Users\Ana\AppData\Local\Microsoft\WindowsApps\winget.exe")]);
}

// ---------------------------------------------------------------- lectores (9.2 y 9.3)

#[test]
fn lee_las_versiones() {
    assert_eq!(version_claude("2.1.329 (Claude Code)\n").as_deref(), Some("2.1.329"));
    assert_eq!(version_claude("error: algo\n"), None);
    assert_eq!(version_claude(""), None);
    assert_eq!(version_gh("gh version 2.103.3 (2026-10-26)\nhttps://github.com/cli/cli/releases/tag/v2.103.3\n").as_deref(), Some("2.103.3"));
    assert_eq!(version_gh("otra cosa"), None);
}

const LISTA_PLUGINS: &str = r#"[
  {"id": "code-review@claude-plugins-official", "version": "unknown", "scope": "project", "enabled": false,
   "projectPath": "c:\\Users\\Ana\\proyecto", "projectEnabled": false},
  {"id": "engram@engram", "version": "0.1.14", "scope": "user", "enabled": true},
  {"id": "oficina@quintech", "version": "0.6.0", "scope": "user", "enabled": true,
   "installPath": "C:\\Users\\Ana\\.claude\\plugins\\cache\\quintech\\oficina\\0.6.0", "projectEnabled": false, "hasUserConfig": true}
]"#;

#[test]
fn el_mod_instalado_y_activo_esta_hecho() {
    let m = estado_mod(LISTA_PLUGINS).unwrap();
    assert_eq!(m["instalado"], true);
    assert_eq!(m["activo"], true);
    assert_eq!(m["version"], "0.6.0");
}

#[test]
fn el_mod_apagado_o_ausente() {
    let apagado = estado_mod(r#"[{"id": "oficina@quintech", "version": "0.6.0", "scope": "user", "enabled": false}]"#).unwrap();
    assert_eq!((apagado["instalado"].clone(), apagado["activo"].clone()), (json!(true), json!(false)));
    let ausente = estado_mod(r#"[{"id": "engram@engram", "enabled": true}]"#).unwrap();
    assert_eq!((ausente["instalado"].clone(), ausente["activo"].clone()), (json!(false), json!(false)));
    assert!(ausente["version"].is_null());
    // Activo en cualquier scope: una entrada apagada de otro proyecto no lo apaga
    let dos = estado_mod(r#"[{"id": "oficina@quintech", "scope": "project", "enabled": false}, {"id": "oficina@quintech", "version": "0.6.0", "scope": "user", "enabled": true}]"#).unwrap();
    assert_eq!(dos["activo"], true);
    assert!(estado_mod("no es json").is_err());
    assert!(estado_mod(r#"{"error": "x"}"#).is_err());
}

#[test]
fn el_catalogo_quintech_se_ve_por_su_nombre() {
    let lista = r#"[
      {"name": "claude-plugins-official", "source": "github", "repo": "anthropics/claude-plugins-official"},
      {"name": "quintech", "source": "github", "repo": "quintechlab/oficina", "installLocation": "C:\\x"}
    ]"#;
    assert!(tiene_catalogo(lista));
    assert!(!tiene_catalogo(r#"[{"name": "engram", "repo": "Gentleman-Programming/engram"}]"#));
    assert!(!tiene_catalogo("roto"));
}

const CON_SESION: &str = r#"{"hosts":{"github.com":[{"state":"success","active":true,"host":"github.com","login":"nicoequintana","tokenSource":"keyring","scopes":"admin:ssh_signing_key, gist, project, read:org, repo, workflow","gitProtocol":"https"}]}}"#;

#[test]
fn cuenta_conectada_con_los_tres_permisos() {
    let c = cuenta_gh(CON_SESION);
    assert_eq!(c["estado"], "conectada");
    assert_eq!(c["login"], "nicoequintana");
    assert_eq!(c["faltan"], json!([]));
    // Nunca viaja un token: solo estado, login, permisos que faltan y error
    assert!(!c.to_string().contains("keyring"));
}

#[test]
fn cuenta_sin_el_permiso_project() {
    let t = CON_SESION.replace("project, ", "");
    let c = cuenta_gh(&t);
    assert_eq!(c["estado"], "conectada");
    assert_eq!(c["faltan"], json!(["project"]));
}

#[test]
fn read_org_lo_cubren_write_org_y_admin_org() {
    let t = CON_SESION.replace("read:org", "admin:org");
    assert_eq!(cuenta_gh(&t)["faltan"], json!([]));
    let t = CON_SESION.replace("read:org", "write:org");
    assert_eq!(cuenta_gh(&t)["faltan"], json!([]));
    // read:project no alcanza: el tablero escribe
    let t = CON_SESION.replace("project, ", "read:project, ");
    assert_eq!(cuenta_gh(&t)["faltan"], json!(["project"]));
}

#[test]
fn sin_sesion_gh_devuelve_hosts_vacio() {
    let c = cuenta_gh(r#"{"hosts":{}}"#);
    assert_eq!(c["estado"], "sin-sesion");
    assert!(c["login"].is_null());
    assert_eq!(cuenta_gh("")["estado"], "sin-sesion");
}

#[test]
fn sin_red_la_cuenta_queda_sin_conexion_con_la_primera_linea() {
    let t = r#"{"hosts":{"github.com":[{"state":"error","error":"Get \"https://api.github.com/\": proxyconnect tcp: dial tcp 127.0.0.1:9: connectex: No connection could be made because the target machine actively refused it.","active":true,"host":"github.com","login":"nicoequintana","tokenSource":"keyring","gitProtocol":"https"}]}}"#;
    let c = cuenta_gh(t);
    assert_eq!(c["estado"], "sin-conexion");
    assert_eq!(c["login"], "nicoequintana");
    assert!(c["error"].as_str().unwrap().starts_with("Get \"https://api.github.com/\""));
    assert!(c["error"].as_str().unwrap().chars().count() <= 140);
}

#[test]
fn un_token_invalido_sin_red_de_por_medio_pide_conectar_de_nuevo() {
    let t = r#"{"hosts":{"github.com":[{"state":"error","error":"The token in keyring is invalid.","active":true,"login":"ana"}]}}"#;
    assert_eq!(cuenta_gh(t)["estado"], "sin-sesion");
}

#[test]
fn membresia_activa_pendiente_y_no_miembro() {
    let activa = r#"{"url":"https://api.github.com/orgs/quintechlab/memberships/nicoequintana","state":"active","role":"admin"}"#;
    assert_eq!(membresia(true, activa, "")["estado"], "activa");
    assert_eq!(membresia(true, r#"{"state":"pending","role":"member"}"#, "")["estado"], "pendiente");
    // Salida real de una organización a la que no se pertenece (exit 1)
    let no = r#"{"message":"Not Found","documentation_url":"https://docs.github.com/rest/orgs/members#get-an-organization-membership-for-the-authenticated-user","status":"404"}"#;
    assert_eq!(membresia(false, no, "gh: Not Found (HTTP 404)\n")["estado"], "no-miembro");
}

#[test]
fn membresia_sin_red_o_con_otro_error() {
    let red = membresia(false, "", "Get \"https://api.github.com/user/memberships/orgs/quintechlab\": dial tcp: lookup api.github.com: no such host\n");
    assert_eq!(red["estado"], "sin-conexion");
    assert!(red["error"].as_str().unwrap().contains("no such host"));
    let otro = membresia(false, "", "gh: Resource not accessible by integration (HTTP 403)\n");
    assert_eq!(otro["estado"], "error");
    assert_eq!(otro["error"], "gh: Resource not accessible by integration (HTTP 403)");
    assert_eq!(membresia(true, "roto", "")["estado"], "error");
}

#[test]
fn errores_de_red() {
    for t in [
        "error connecting to api.github.com\ncheck your internet connection",
        "dial tcp: lookup api.github.com: no such host",
        "fatal: unable to access 'https://github.com/quintechlab/oficina.git/': Could not resolve host: github.com",
        "Error: getaddrinfo ENOTFOUND github.com",
        "read tcp 10.0.0.2:5000->140.82.112.6:443: i/o timeout",
    ] {
        assert!(es_error_de_red(t), "{t}");
    }
    assert!(!es_error_de_red("gh: Not Found (HTTP 404)"));
    assert!(!es_error_de_red("Plugin not found in marketplace"));
}

#[test]
fn el_codigo_de_un_solo_uso_sale_de_la_linea_de_gh() {
    assert_eq!(codigo_dispositivo("! First copy your one-time code: 4F2A-91C7").as_deref(), Some("4F2A-91C7"));
    assert_eq!(codigo_dispositivo("First copy your one-time code: ABCD-1234\n").as_deref(), Some("ABCD-1234"));
    // Sin terminal gh no abre el navegador: imprime la dirección, que no es un código
    assert_eq!(codigo_dispositivo("Open this URL to continue in your web browser: https://github.com/login/device"), None);
    assert_eq!(codigo_dispositivo("gh version 2.103.3 (2026-10-26)"), None);
    // Pegado a otras letras no cuenta
    assert_eq!(codigo_dispositivo("XABCD-1234"), None);
    assert_eq!(codigo_dispositivo("abcd-1234"), None);
    assert_eq!(codigo_dispositivo("ñ ABCD-1234 ñ").as_deref(), Some("ABCD-1234"));
}

#[test]
fn la_linea_de_error_es_la_primera_no_vacia_recortada_a_140() {
    assert_eq!(linea_de_error("", "\n  \n  gh: Not Found (HTTP 404)\nmás\n"), "gh: Not Found (HTTP 404)");
    let larga = "x".repeat(300);
    assert_eq!(linea_de_error("", &larga).chars().count(), 140);
    // claude --json deja el error en stdout
    assert_eq!(linea_de_error("{\"ok\":false,\"error\":\"Plugin not found\"}\n", ""), "Plugin not found");
    assert_eq!(linea_de_error("Failed to install\n", ""), "Failed to install");
    assert_eq!(linea_de_error("", ""), "sin detalle");
}

#[test]
fn codigo_vencido_y_permiso_negado() {
    assert!(es_codigo_vencido("error: authentication timed out"));
    assert!(es_codigo_vencido("the device code has expired"));
    assert!(!es_codigo_vencido("HTTP 401"));
    assert!(es_permiso_negado("Installer failed with exit code: 0x800704c7 : The operation was canceled by the user."));
    assert!(es_permiso_negado("Access is denied."));
    assert!(!es_permiso_negado("No package found matching input criteria."));
}

// ---------------------------------------------------------------- pasos que corren (9.2 y 9.5)

#[test]
fn cada_accion_se_lee_de_su_nombre_y_es_de_su_paso() {
    assert_eq!(Accion::desde("mod"), Some(Accion::Mod));
    assert_eq!(Accion::desde("activar"), Some(Accion::Activar));
    assert_eq!(Accion::desde("gh"), Some(Accion::Gh));
    assert_eq!(Accion::desde("conectar"), Some(Accion::Conectar));
    assert_eq!(Accion::desde("permiso"), Some(Accion::Permiso));
    assert_eq!(Accion::desde("rm -rf"), None);
    assert_eq!([Accion::Mod, Accion::Activar, Accion::Gh, Accion::Conectar, Accion::Permiso].map(Accion::paso), ["mod", "mod", "gh", "gh", "gh"]);
    assert!(Accion::Conectar.conecta() && Accion::Permiso.conecta());
    assert!(!Accion::Mod.conecta() && !Accion::Gh.conecta());
}

#[test]
fn instalar_el_mod_suma_el_catalogo_solo_si_falta() {
    let sin = plan(Accion::Mod, false);
    assert_eq!(sin.iter().map(|o| o.mostrar).collect::<Vec<_>>(), ["claude plugin marketplace add quintechlab/oficina", "claude plugin install oficina@quintech"]);
    assert_eq!(sin[0].args, ["plugin", "marketplace", "add", "quintechlab/oficina"]);
    assert_eq!(sin[1].args, ["plugin", "install", "oficina@quintech", "--scope", "user", "--json"]);
    assert!(sin.iter().all(|o| o.programa == Programa::Claude));
    let con = plan(Accion::Mod, true);
    assert_eq!(con.len(), 1);
    assert_eq!(con[0].mostrar, "claude plugin install oficina@quintech");
    assert_eq!(plan(Accion::Activar, true)[0].args, ["plugin", "enable", "oficina@quintech"]);
}

#[test]
fn winget_acepta_las_licencias_porque_el_clic_las_acepto_y_no_espera_respuestas() {
    let p = plan(Accion::Gh, true);
    assert_eq!(p[0].programa, Programa::Winget);
    assert_eq!(p[0].args, ["install", "--id", "GitHub.cli", "-e", "--source", "winget", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"]);
    assert_eq!(p[0].mostrar, "winget install --id GitHub.cli -e");
}

#[test]
fn conectar_pide_los_tres_permisos_por_el_navegador_sin_ssh_ni_portapapeles() {
    let p = plan(Accion::Conectar, true);
    assert_eq!(p[0].programa, Programa::Gh);
    assert_eq!(p[0].args, ["auth", "login", "--hostname", "github.com", "--web", "--git-protocol", "https", "--skip-ssh-key", "--scopes", "repo,read:org,project"]);
    // Copiar es un clic del usuario: nunca --clipboard; y nunca se pide el token
    assert!(!p[0].args.iter().any(|a| *a == "--clipboard" || *a == "--show-token"));
    let r = plan(Accion::Permiso, true);
    assert_eq!(r[0].args, ["auth", "refresh", "--hostname", "github.com", "--scopes", "repo,read:org,project"]);
}

#[test]
fn un_paso_por_vez() {
    let t = Turno::default();
    assert!(t.empezar(Accion::Mod).is_ok());
    assert_eq!(t.empezar(Accion::Gh).unwrap_err(), "ya corre otro paso");
    // Cancelar solo vale mientras se conecta
    assert!(!t.cancelar());
    t.terminar();
    assert!(t.empezar(Accion::Conectar).is_ok());
    assert!(t.cancelar());
    assert!(t.cancelado());
    t.terminar();
    assert!(!t.cancelado());
}

#[test]
fn el_final_lo_decide_lo_que_le_paso_al_proceso() {
    assert_eq!(desenlace(true, false), Desenlace::Siguio);
    // Cancelar llegó cuando gh ya había salido bien: es un éxito (se verifica y se olvida el login)
    assert_eq!(desenlace(true, true), Desenlace::Siguio);
    assert_eq!(desenlace(false, true), Desenlace::Cancelado);
    assert_eq!(desenlace(false, false), Desenlace::Fallo);
}

#[test]
fn el_turno_se_suelta_aunque_el_paso_se_caiga() {
    let t = Turno::default();
    t.empezar(Accion::Mod).unwrap();
    let caido = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _soltar = t.soltar_al_terminar();
        panic!("el paso se cayó");
    }));
    assert!(caido.is_err());
    assert!(t.empezar(Accion::Gh).is_ok());
}

// Procesos de prueba inofensivos (cmd, ping a 127.0.0.1): nunca se instala ni se conecta nada.
#[cfg(windows)]
mod procesos {
    use super::*;
    use std::time::{Duration, Instant};

    fn de_prueba(args: &[&str]) -> Child {
        let cmd = std::env::var("ComSpec").unwrap_or_else(|_| String::from(r"C:\Windows\System32\cmd.exe"));
        comando(Path::new(&cmd), args, &lugares(&std::env::var("PATH").unwrap_or_default())).spawn().expect("cmd de prueba")
    }

    fn ping_largo() -> Child {
        de_prueba(&["/c", "ping", "-n", "30", "127.0.0.1"])
    }

    fn hasta_que_salga(h: &mut Child, tope: Duration) -> Option<std::process::ExitStatus> {
        let inicio = Instant::now();
        while inicio.elapsed() < tope {
            if let Ok(Some(s)) = h.try_wait() {
                return Some(s);
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        None
    }

    #[test]
    fn espera_al_proceso_y_lee_su_salida() {
        let t = Turno::default();
        t.empezar(Accion::Mod).unwrap();
        let (o, e) = t.poner_hijo(de_prueba(&["/c", "echo", "hola"]));
        let vistas = Mutex::new(Vec::new());
        let r = esperar(&t, o, e, &|l| vistas.lock().unwrap().push(l.to_string()));
        assert!(r.exito && !r.matado);
        assert_eq!(r.salida.trim(), "hola");
        assert_eq!(*vistas.lock().unwrap(), ["hola"]);
    }

    #[test]
    fn cancelar_tarde_no_pisa_un_exito() {
        let t = Turno::default();
        t.empezar(Accion::Conectar).unwrap();
        let (o, e) = t.poner_hijo(de_prueba(&["/c", "exit", "0"]));
        // gh ya salió bien cuando llega Cancelar
        {
            let mut hijo = t.hijo.lock().unwrap();
            assert!(hasta_que_salga(&mut hijo.as_mut().unwrap().proceso, Duration::from_secs(10)).is_some());
        }
        assert!(t.cancelar());
        let r = esperar(&t, o, e, &|_| {});
        assert!(r.exito && !r.matado);
        assert_eq!(desenlace(r.exito, r.matado), Desenlace::Siguio);
    }

    #[test]
    fn cancelar_mata_el_proceso_y_suelta_enseguida() {
        let t = Turno::default();
        t.empezar(Accion::Conectar).unwrap();
        let (o, e) = t.poner_hijo(ping_largo());
        let inicio = Instant::now();
        let r = std::thread::scope(|s| {
            s.spawn(|| {
                std::thread::sleep(Duration::from_millis(300));
                assert!(t.cancelar());
            });
            esperar(&t, o, e, &|_| {})
        });
        assert!(!r.exito && r.matado);
        assert_eq!(desenlace(r.exito, r.matado), Desenlace::Cancelado);
        assert!(inicio.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn un_nieto_con_la_salida_abierta_no_retiene_el_turno() {
        let t = Turno::default();
        t.empezar(Accion::Mod).unwrap();
        // cmd sale enseguida y deja a ping con sus canales de salida abiertos
        let (o, e) = t.poner_hijo(de_prueba(&["/c", "start", "/b", "ping", "-n", "30", "127.0.0.1"]));
        let inicio = Instant::now();
        let r = esperar(&t, o, e, &|_| {});
        assert!(r.exito && !r.matado);
        assert!(inicio.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn al_salir_se_mata_el_paso_que_corre_y_no_empieza_otro() {
        let t = Turno::default();
        t.empezar(Accion::Gh).unwrap();
        let (o, e) = t.poner_hijo(ping_largo());
        let inicio = Instant::now();
        let r = std::thread::scope(|s| {
            s.spawn(|| {
                std::thread::sleep(Duration::from_millis(300));
                assert!(t.apagar().is_ok());
            });
            esperar(&t, o, e, &|_| {})
        });
        assert!(!r.exito && r.matado);
        assert!(inicio.elapsed() < Duration::from_secs(10));
        t.terminar();
        assert_eq!(t.empezar(Accion::Mod).unwrap_err(), "Avis se está cerrando");
        // Sin paso corriendo, salir no falla
        assert!(Turno::default().apagar().is_ok());
    }

    #[test]
    fn un_proceso_del_trabajo_muere_al_cerrar_el_trabajo() {
        // ping.exe directo (sin cmd de por medio): el que muere es el proceso asignado
        let sistema = std::env::var("SystemRoot").unwrap_or_else(|_| String::from(r"C:\Windows"));
        let ping = Path::new(&sistema).join("System32").join("PING.EXE");
        let mut h = comando(&ping, &["-n", "30", "127.0.0.1"], &lugares("")).stdout(Stdio::null()).spawn().expect("ping de prueba");
        let trabajo = trabajo::Trabajo::para(&h).expect("el proceso entra al trabajo de Windows");
        assert!(matches!(h.try_wait(), Ok(None)));
        let inicio = Instant::now();
        drop(trabajo);
        // ping tardaría 29 s; Windows lo termina al cerrar el trabajo (con código 0: no sirve para
        // saber cómo terminó, por eso Cancelar usa `TerminateJobObject` con código 1)
        assert!(hasta_que_salga(&mut h, Duration::from_secs(5)).is_some(), "el proceso sigue vivo");
        assert!(inicio.elapsed() < Duration::from_secs(5));
    }
}

#[test]
fn solo_se_abren_las_direcciones_conocidas() {
    assert_eq!(enlace("guia-claude"), Some("https://code.claude.com/docs/en/setup"));
    assert_eq!(enlace("gh-manual"), Some("https://cli.github.com/"));
    assert_eq!(enlace("dispositivo"), Some("https://github.com/login/device"));
    assert_eq!(enlace("invitacion"), Some("https://github.com/orgs/quintechlab/invitation"));
    assert_eq!(enlace("https://otro.sitio"), None);
}

#[test]
fn el_final_de_cada_paso_para_la_ventana() {
    assert_eq!(Fin::Listo.evento(Accion::Mod)["estado"], "listo");
    assert_eq!(Fin::Listo.evento(Accion::Mod)["paso"], "mod");
    assert_eq!(Fin::Cancelado.evento(Accion::Conectar)["estado"], "cancelado");
    assert_eq!(Fin::Vencido.evento(Accion::Conectar)["estado"], "vencido");
    let e = Fin::Error { comando: String::from("winget install --id GitHub.cli -e"), linea: String::from("x"), detalle: String::from("x\ny"), red: false, permiso: true }.evento(Accion::Gh);
    assert_eq!(e["estado"], "error");
    assert_eq!(e["accion"], "gh");
    assert_eq!(e["permiso"], true);
    assert_eq!(e["detalle"], "x\ny");
}

#[test]
fn texto_del_item_de_la_bandeja() {
    assert_eq!(texto_menu(None), "Primeros pasos…");
    assert_eq!(texto_menu(Some(0)), "Primeros pasos…");
    assert_eq!(texto_menu(Some(1)), "Primeros pasos (falta 1)…");
    assert_eq!(texto_menu(Some(3)), "Primeros pasos (faltan 3)…");
}
