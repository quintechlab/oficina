//! Presencia del equipo: los comentarios del Issue "Presencia", leídos con el `gh` autenticado
//! de la máquina. Nunca se guarda un token: cada consulta sale con la sesión de `gh`.
//! El contenido de cada comentario lo interpreta el frontend (`equipo.js`, igual que el mod).

use crate::primeros_pasos::{self, Programa};
use serde_json::{json, Value};

/// Repositorio privado de datos y número del Issue "Presencia" (los valores por defecto del mod).
pub const RUTA_COMENTARIOS: &str = "repos/quintechlab/oficina-datos/issues/1/comments?per_page=100";

/// `[{ usuario, cuerpo }]` a partir de la respuesta de `gh api .../comments`.
/// Los elementos sin autor o sin cuerpo se saltean.
pub fn comentarios_desde_json(texto: &str) -> Result<Vec<Value>, String> {
    let datos: Value = serde_json::from_str(texto).map_err(|_| String::from("respuesta ilegible de GitHub"))?;
    let lista = datos.as_array().ok_or_else(|| String::from("GitHub no devolvió los comentarios"))?;
    Ok(lista
        .iter()
        .filter_map(|c| {
            let usuario = c["user"]["login"].as_str()?;
            let cuerpo = c["body"].as_str()?;
            Some(json!({ "usuario": usuario, "cuerpo": cuerpo }))
        })
        .collect())
}

/// El login a partir de la respuesta de `gh api user`.
pub fn login_desde_json(texto: &str) -> Option<String> {
    let datos: Value = serde_json::from_str(texto).ok()?;
    datos["login"].as_str().map(String::from)
}

/// Corre `gh` sin abrir una consola y devuelve su salida, o un error de una línea. `gh` se busca
/// como lo hace el asistente de primeros pasos (bienvenida-ux.md 9.4): con el PATH releído del
/// registro y en su carpeta de instalación, así se encuentra aunque se haya instalado después de
/// abrir el widget.
pub fn correr_gh(args: &[&str]) -> Result<String, String> {
    let salida = primeros_pasos::correr(Programa::Gh, args, &primeros_pasos::lugares())?;
    salida_de_gh(salida.ok, &salida.stdout, &salida.stderr)
}

/// La salida de `gh` si terminó bien; si no, la primera línea de su error (140 caracteres).
pub fn salida_de_gh(ok: bool, stdout: &str, stderr: &str) -> Result<String, String> {
    if !ok {
        let linea = stderr.lines().find(|l| !l.trim().is_empty()).unwrap_or("gh falló");
        return Err(linea.trim().chars().take(140).collect());
    }
    Ok(stdout.to_string())
}

/// Resultado para el frontend: quién sos, los comentarios y el error si lo hubo.
pub fn respuesta(yo: Option<String>, comentarios: Result<Vec<Value>, String>) -> Value {
    match comentarios {
        Ok(lista) => json!({ "yo": yo, "comentarios": lista, "error": Value::Null }),
        Err(e) => json!({ "yo": yo, "comentarios": [], "error": e }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lee_autor_y_cuerpo_de_cada_comentario() {
        let texto = r#"[
          {"id": 1, "user": {"login": "nicoequintana"}, "body": "<!-- oficina:presencia -->\n```json\n{}\n```"},
          {"id": 2, "user": {"login": "NCsolucionesdigitales"}, "body": "hola"},
          {"id": 3, "user": null, "body": "sin autor"},
          {"id": 4, "user": {"login": "x"}, "body": null}
        ]"#;
        let r = comentarios_desde_json(texto).unwrap();
        assert_eq!(r.len(), 2);
        assert_eq!(r[0]["usuario"], "nicoequintana");
        assert!(r[0]["cuerpo"].as_str().unwrap().starts_with("<!-- oficina:presencia -->"));
        assert_eq!(r[1]["usuario"], "NCsolucionesdigitales");
        assert_eq!(r[1]["cuerpo"], "hola");
    }

    #[test]
    fn una_respuesta_que_no_es_lista_es_un_error() {
        assert!(comentarios_desde_json(r#"{"message": "Not Found"}"#).is_err());
        assert!(comentarios_desde_json("no es json").is_err());
        assert_eq!(comentarios_desde_json("[]").unwrap().len(), 0);
    }

    #[test]
    fn lee_el_login() {
        assert_eq!(login_desde_json(r#"{"login": "nicoequintana", "name": "Nico"}"#).as_deref(), Some("nicoequintana"));
        assert_eq!(login_desde_json(r#"{"name": "sin login"}"#), None);
        assert_eq!(login_desde_json("roto"), None);
    }

    #[test]
    fn la_salida_de_gh_o_la_primera_linea_de_su_error() {
        assert_eq!(salida_de_gh(true, "[]", "").as_deref(), Ok("[]"));
        assert_eq!(salida_de_gh(false, "", "\n  gh: Not Found (HTTP 404)\nmás").unwrap_err(), "gh: Not Found (HTTP 404)");
        assert_eq!(salida_de_gh(false, "", "").unwrap_err(), "gh falló");
        assert_eq!(salida_de_gh(false, "", &"x".repeat(200)).unwrap_err().chars().count(), 140);
    }

    #[test]
    fn la_respuesta_lleva_el_error_sin_romper() {
        let r = respuesta(None, Err(String::from("gh no está instalado")));
        assert_eq!(r["error"], "gh no está instalado");
        assert_eq!(r["comentarios"].as_array().unwrap().len(), 0);
        assert!(r["yo"].is_null());
    }
}
