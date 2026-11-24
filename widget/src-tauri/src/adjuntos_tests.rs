// Tests de adjuntos.rs (#22, docs/diseno/chat-avis-ux.md 10 y 14.1.12 del lado de Rust): qué entra,
// qué se rechaza con `adjunto` y el bloque de stream-json de cada tipo (7.4).
use super::*;
use std::fs;
use std::path::PathBuf;

/// Una carpeta temporal propia, fuera del repo.
fn carpeta_temporal() -> PathBuf {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static N: AtomicUsize = AtomicUsize::new(0);
    let c = std::env::temp_dir().join(format!("avis-adjuntos-{}-{}", std::process::id(), N.fetch_add(1, Ordering::SeqCst)));
    let _ = fs::remove_dir_all(&c);
    fs::create_dir_all(&c).unwrap();
    c
}

fn escribir(c: &Path, nombre: &str, bytes: &[u8]) -> PathBuf {
    let r = c.join(nombre);
    fs::write(&r, bytes).unwrap();
    r
}

const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR";
const JPG: &[u8] = b"\xff\xd8\xff\xe0\0\x10JFIF";
const GIF: &[u8] = b"GIF89a\x01\0\x01\0";
const WEBP: &[u8] = b"RIFF\x24\0\0\0WEBPVP8 ";

// ---------------------------------------------------------------- tipos y tamaños (10)

#[test]
fn la_clase_sale_de_la_extension_sin_mayusculas() {
    assert_eq!(clase_de("presupuesto.PDF"), Some(Clase::Pdf));
    for n in ["a.png", "a.jpg", "a.JPEG", "a.gif", "a.webp"] {
        assert_eq!(clase_de(n), Some(Clase::Imagen), "{n}");
    }
    for n in ["a.txt", "a.md", "a.json", "a.csv", "a.js", "a.ts", "a.tsx", "a.rs", "a.py", "a.html", "a.css", "a.yml", "a.toml", "a.sql", "a.log"] {
        assert_eq!(clase_de(n), Some(Clase::Texto), "{n}");
    }
    for n in ["planilla.xlsx", "a.exe", "sin-extension", "a.pdf.zip", ".pdf"] {
        assert_eq!(clase_de(n), None, "{n}");
    }
}

#[test]
fn el_filtro_del_clip_son_las_mismas_extensiones() {
    assert!(EXTENSIONES.iter().all(|e| clase_de(&format!("a.{e}")).is_some()));
    assert_eq!(EXTENSIONES.len(), 1 + IMAGENES.len() + TEXTOS.len());
}

#[test]
fn el_nombre_es_el_ultimo_tramo_de_la_ruta() {
    assert_eq!(nombre_de(Path::new(r"C:\Users\x\Descargas\presupuesto-2027.pdf")), "presupuesto-2027.pdf");
    assert_eq!(nombre_de(Path::new("notas.md")), "notas.md");
}

#[test]
fn las_imagenes_se_reconocen_por_sus_primeros_bytes() {
    assert_eq!(media_imagen(PNG), Some("image/png"));
    assert_eq!(media_imagen(JPG), Some("image/jpeg"));
    assert_eq!(media_imagen(GIF), Some("image/gif"));
    assert_eq!(media_imagen(WEBP), Some("image/webp"));
    assert_eq!(media_imagen(b"%PDF-1.4"), None);
    assert_eq!(media_imagen(b""), None);
}

#[test]
fn las_paginas_del_pdf_cuentan_type_page_y_no_pages() {
    let pdf = pdf_minimo("CEREZO");
    assert_eq!(paginas_pdf(&pdf), Some(1));
    let tres = b"%PDF-1.4 /Type /Pages /Type /Page /Type/Page /Type /Page\n";
    assert_eq!(paginas_pdf(tres), Some(3));
    assert_eq!(paginas_pdf(b"%PDF-1.4 sin paginas"), None);
}

#[test]
fn base64_estandar_con_relleno() {
    assert_eq!(base64(b""), "");
    assert_eq!(base64(b"f"), "Zg==");
    assert_eq!(base64(b"fo"), "Zm8=");
    assert_eq!(base64(b"foo"), "Zm9v");
    assert_eq!(base64(b"foobar"), "Zm9vYmFy");
    assert_eq!(base64(&[0xff, 0xfe, 0x00]), "//4A");
}

// ---------------------------------------------------------------- revisar (chat_adjunto, 7.8)

#[test]
fn un_pdf_de_20_mb_entra_y_uno_de_20_mb_mas_1_sale() {
    let c = carpeta_temporal();
    let mut justo = pdf_minimo("CEREZO");
    justo.resize(TOPE_ADJUNTO as usize, b' ');
    let r = escribir(&c, "justo.pdf", &justo);
    let a = revisar(&r).unwrap();
    assert_eq!((a.nombre.as_str(), a.clase, a.bytes, a.paginas), ("justo.pdf", Clase::Pdf, TOPE_ADJUNTO, Some(1)));
    justo.push(b' ');
    let r = escribir(&c, "pasado.pdf", &justo);
    assert_eq!(revisar(&r).unwrap_err(), "pasado.pdf");
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn texto_hasta_200_kb_y_en_utf8() {
    let c = carpeta_temporal();
    let r = escribir(&c, "a.ts", &vec![b'x'; TOPE_TEXTO as usize]);
    assert_eq!(revisar(&r).unwrap().clase, Clase::Texto);
    let r = escribir(&c, "b.ts", &vec![b'x'; TOPE_TEXTO as usize + 1]);
    assert_eq!(revisar(&r).unwrap_err(), "b.ts");
    let r = escribir(&c, "roto.txt", b"hola \xff\xfe chau");
    assert_eq!(revisar(&r).unwrap_err(), "roto.txt");
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn se_rechaza_lo_que_no_es_lo_que_dice_ser() {
    let c = carpeta_temporal();
    // Un .xlsx nunca entra; un .pdf o un .png que no lo son, tampoco
    assert_eq!(revisar(&escribir(&c, "planilla.xlsx", b"PK\x03\x04")).unwrap_err(), "planilla.xlsx");
    assert_eq!(revisar(&escribir(&c, "falso.pdf", b"hola")).unwrap_err(), "falso.pdf");
    assert_eq!(revisar(&escribir(&c, "falso.png", b"hola")).unwrap_err(), "falso.png");
    // Una carpeta o una ruta que no existe
    fs::create_dir_all(c.join("carpeta.pdf")).unwrap();
    assert_eq!(revisar(&c.join("carpeta.pdf")).unwrap_err(), "carpeta.pdf");
    assert_eq!(revisar(&c.join("no-esta.pdf")).unwrap_err(), "no-esta.pdf");
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn la_imagen_toma_el_tipo_de_sus_bytes() {
    let c = carpeta_temporal();
    // Un PNG guardado como .jpg viaja como image/png (la API rechaza un media_type que no coincide)
    let a = revisar(&escribir(&c, "foto.jpg", PNG)).unwrap();
    assert_eq!((a.clase, a.media), (Clase::Imagen, "image/png"));
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn info_para_la_ventana_o_el_error_adjunto() {
    let c = carpeta_temporal();
    let r = escribir(&c, "presupuesto.pdf", &pdf_minimo("CEREZO"));
    let v = info(&r);
    assert_eq!(v["nombre"], "presupuesto.pdf");
    assert_eq!(v["tipo"], "pdf");
    assert_eq!(v["paginas"], 1);
    assert_eq!(v["bytes"], pdf_minimo("CEREZO").len() as u64);
    assert!(v.get("error").is_none());
    let v = info(&escribir(&c, "notas.md", b"# Hola"));
    assert_eq!((v["tipo"].as_str(), v["paginas"].is_null()), (Some("texto"), true));
    assert_eq!(info(&escribir(&c, "foto.png", PNG))["tipo"], "imagen");
    let v = info(&escribir(&c, "planilla.xlsx", b"PK"));
    assert_eq!(v, json!({ "error": "adjunto", "nombre": "planilla.xlsx" }));
    let _ = fs::remove_dir_all(&c);
}

// ---------------------------------------------------------------- bloques de stream-json (7.4)

#[test]
fn el_pdf_va_como_document_en_base64() {
    let c = carpeta_temporal();
    let pdf = pdf_minimo("CEREZO");
    let b = bloques(&[escribir(&c, "p.pdf", &pdf).to_string_lossy().into_owned()]).unwrap();
    assert_eq!(b, vec![json!({ "type": "document", "source": { "type": "base64", "media_type": "application/pdf", "data": base64(&pdf) } })]);
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn la_imagen_va_como_image_con_su_tipo() {
    let c = carpeta_temporal();
    let b = bloques(&[escribir(&c, "f.webp", WEBP).to_string_lossy().into_owned()]).unwrap();
    assert_eq!(b, vec![json!({ "type": "image", "source": { "type": "base64", "media_type": "image/webp", "data": base64(WEBP) } })]);
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn el_texto_va_con_su_nombre_en_una_cerca_que_no_se_rompe() {
    let c = carpeta_temporal();
    let b = bloques(&[escribir(&c, "notas.md", "\u{feff}Hola\n```js\nx\n```\n".as_bytes()).to_string_lossy().into_owned()]).unwrap();
    // Sin el BOM; la cerca es más larga que cualquier tira de comillas del contenido
    assert_eq!(b, vec![json!({ "type": "text", "text": "Archivo: notas.md\n````md\nHola\n```js\nx\n```\n\n````" })]);
    let b = bloques(&[escribir(&c, "a.rs", b"fn main() {}").to_string_lossy().into_owned()]).unwrap();
    assert_eq!(b[0]["text"], "Archivo: a.rs\n```rs\nfn main() {}\n```");
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn hasta_5_por_mensaje_y_el_primero_que_falla_se_nombra() {
    let c = carpeta_temporal();
    let r = escribir(&c, "n.txt", b"x").to_string_lossy().into_owned();
    assert_eq!(bloques(&vec![r.clone(); MAX_ADJUNTOS]).unwrap().len(), MAX_ADJUNTOS);
    assert_eq!(bloques(&vec![r.clone(); MAX_ADJUNTOS + 1]).unwrap_err(), "n.txt");
    let mala = escribir(&c, "planilla.xlsx", b"PK").to_string_lossy().into_owned();
    assert_eq!(bloques(&[r, mala]).unwrap_err(), "planilla.xlsx");
    assert_eq!(bloques(&[]).unwrap(), Vec::<Value>::new());
    let _ = fs::remove_dir_all(&c);
}

#[test]
fn el_pdf_minimo_de_los_tests_es_un_pdf() {
    let pdf = pdf_minimo("CEREZO");
    let s = String::from_utf8_lossy(&pdf);
    assert!(s.starts_with("%PDF-1.4"));
    assert!(s.contains("(CEREZO)"));
    assert!(s.trim_end().ends_with("%%EOF"));
    // La tabla xref apunta al comienzo de cada objeto
    let xref: usize = s.split("startxref\n").nth(1).unwrap().lines().next().unwrap().parse().unwrap();
    assert!(s[xref..].starts_with("xref"));
    for (k, l) in s[xref..].lines().skip(3).take(4).enumerate() {
        let off: usize = l[..10].parse().unwrap();
        assert!(s[off..].starts_with(&format!("{} 0 obj", k + 1)), "objeto {}", k + 1);
    }
}
