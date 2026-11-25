// La hoja de Proyectos (#44, docs/diseno/proyectos-ux.md 3.3, 4, 5 y 7, opción B "Carpeta"): la cuenta de
// la fila del menú, el esqueleto, el índice, el proyecto (encabezado, botón de charla, charlas,
// instrucciones, carpeta, la matriz de qué ve cada motor y borrar), el formulario, el primer uso, la carga
// y los errores. Solo HTML, como tareasVista.js y habitosVista.js: los datos llegan armados desde main.js
// y nada de acá toca el DOM. main.js redibuja por partes (`data-parte`) y nunca pisa un campo mientras se
// escribe en él. Los textos son los de la sección 5.
// Entrega P1: el botón de charla queda apagado (`aria-disabled`) y cada proyecto tiene 0 charlas hasta la
// entrega P2; la zona de soltar abre la carpeta (soltar archivos es P3).

import { escapar } from './logica.js'
import { avi, claudeDe } from './avis.js'
import { especieValida } from './especies.js'
import { colorDe, COLORES } from './tareas.js'
import { NOMBRES_COLOR } from './habitos.js'
import { confirmable } from './tareasVista.js'
import {
  conPerdida, lineaProyecto, textoBorrar, lineaBorrar, etiquetaCarpeta, pieSoltar, abreviarRuta, previaCarpetaAvis,
  textoErrorNombre, textoErrorInstrucciones, cuentaInstrucciones, textoRotos,
} from './proyectos.js'

/** Los íconos de la hoja (los del boceto): la carpeta de 15 de la fila del menú, la grande del bloque y el lápiz. */
export const ICONO_PRO = {
  fila: '<svg viewBox="0 0 16 16"><path d="M2.5 5.2V12a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5A1.5 1.5 0 0 0 12 5H8L6.6 3.2H4A1.5 1.5 0 0 0 2.5 4.7z"/></svg>',
  carpeta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9.5a2 2 0 0 0-2-2h-7.5L9.5 5H5a2 2 0 0 0-2 2.5z"/></svg>',
  lapiz: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3l2.5 2.5L6 12.5 3 13l.5-3z"/></svg>',
}

const color = c => `var(--${colorDe(c)})`
const mascotaDe = especie => claudeDe(especieValida(especie))
const inicial = nombre => escapar(([...String(nombre ?? '').trim()][0] ?? '?').toUpperCase())

// ------------------------------------------------------------------ la fila del menú (4.1)

/**
 * A la derecha de la fila «Proyectos» (4.1), `aria-hidden` (el texto va en el nombre de la fila): sin
 * proyectos, la pista del atajo; con, el chip con el número y, si alguno tiene la carpeta perdida, el
 * punto rojo a su derecha.
 */
export function ladoFilaProyectos(lista) {
  const n = (lista ?? []).length
  if (!n) return '<kbd aria-hidden="true">Ctrl P</kbd>'
  const mal = conPerdida(lista) ? '<i class="pt pro-mal"></i>' : ''
  return `<span class="cuentas" aria-hidden="true"><span class="chip">${n}</span>${mal}</span>`
}

// ------------------------------------------------------------------ la hoja (3.3)

/** Lo que no cambia mientras la hoja está abierta: el cuerpo y la región de los anuncios (5.3). */
export function esqueletoProyectos() {
  return '<div id="pro-cuerpo"></div><p class="oculto" role="status" id="pro-vivo"></p>'
}

/**
 * La carpeta (3.3): la línea de los rotos, el índice (con la píldora, que no se redibuja: viaja) y el
 * panel, cada uno por partes. `sinIndice`: sin proyectos el índice no se dibuja (3.4).
 */
export function carpetaPro(sinIndice = false) {
  const idx = sinIndice ? '' : '<nav class="idx" aria-label="Proyectos"><span class="ind-ix" aria-hidden="true"></span><div class="ix-filas" data-parte="idx"></div></nav>'
  return `<div class="carp${sinIndice ? ' sin-idx' : ''}"><div class="pro-rotos" data-parte="rotos"></div>${idx}`
    + '<section class="pane" id="pro-pane" aria-labelledby="pro-h2" data-parte="pane"></section></div>'
}

// ------------------------------------------------------------------ el índice (4.2)

/**
 * El índice (4.2): el rótulo, una fila por proyecto (su punto, el nombre y el número de charlas, o el
 * punto rojo de la carpeta perdida) y «+ Nuevo». El elegido (o «+ Nuevo» con el formulario nuevo) lleva
 * `aria-current="page"`. `charlas`: `{ [id]: n }`. `recien`: la fila que entra con su acto (10).
 */
export function indiceProyectos({ lista, elegido, vista, charlas = {}, recien = null }) {
  const filas = ['<span class="rot">Proyectos</span>']
  for (const p of lista) {
    const id = escapar(p.id)
    const cur = vista !== 'nuevo' && p.id === elegido ? ' aria-current="page"' : ''
    const n = charlas[p.id] ?? 0
    const lado = p.carpeta?.estado === 'perdida'
      ? '<span class="mal-p" role="img" aria-label="carpeta perdida"></span>'
      : `<span class="ct" aria-hidden="true">${n}</span><span class="oculto">, ${n} ${n === 1 ? 'charla' : 'charlas'}</span>`
    filas.push(`<button type="button" class="ix-b${p.id === recien ? ' recien' : ''}" data-accion="pro-ver" data-id="${id}" data-k="ix-${id}"${cur} style="--c:${color(p.color)}" title="${escapar(p.nombre)}">`
      + `<i class="pt" aria-hidden="true"></i><span class="n">${escapar(p.nombre)}</span>${lado}</button>`)
  }
  filas.push(`<button type="button" class="ix-b mas" data-accion="pro-nuevo" data-k="ix-nuevo"${vista === 'nuevo' ? ' aria-current="page"' : ''}><i aria-hidden="true">+</i><span class="n">Nuevo</span></button>`)
  return filas.join('')
}

/** El índice mientras se lee por primera vez (7.1): tres filas esqueleto, sin brillo. */
export function indiceCargando() {
  return '<span class="rot">Proyectos</span>' + '<span class="ix-fantasma" aria-hidden="true"></span>'.repeat(3)
}

// ------------------------------------------------------------------ el proyecto (4.3 a 4.9)

/** La tabla de qué ve cada motor (4.8): en el proyecto y en el formulario. El ✓ y el — siempre con su texto. */
export const MATRIZ = '<div class="matriz" role="table" aria-label="Qué ve cada motor">'
  + '<div class="mz-f" role="row"><span class="h" role="columnheader">Motor</span><span class="h" role="columnheader">Instrucciones</span><span class="h" role="columnheader">Carpeta</span></div>'
  + '<div class="mz-f" role="row"><span class="mt" role="rowheader">Claude Code</span><span class="si" role="cell">en cada charla</span><span class="si" role="cell">la lee <small>cuando hace falta</small></span></div>'
  + '<div class="mz-f" role="row"><span class="mt" role="rowheader">Local</span><span class="si" role="cell">en cada charla</span><span class="no" role="cell">no la ve</span></div>'
  + '</div>'

/** La línea de un error de 5.2 (en `--rojo`), con su botón si tiene. */
export function lineaError(texto, boton = '') {
  return `<p class="pro-err" role="alert"><span>${escapar(texto)}</span>${boton}</p>`
}

/** «Reintentar», «Abrir la carpeta»…: un `.lnk` de la hoja. */
const lnk = (accion, k, texto) => `<button type="button" class="lnk" data-accion="${accion}" data-k="${k}">${texto}</button>`

/** El nombre y la ruta de la carpeta, con el ícono de su color (4.7). */
function carpetaNombre(c) {
  return `<div class="car-n">${ICONO_PRO.carpeta}<div><b>${escapar(c.nombre || c.ruta)}</b><small title="${escapar(c.ruta)}">${escapar(abreviarRuta(c.ruta))}</small></div></div>`
}

/**
 * El bloque Carpeta (4.7, 7.4): creada por Avis, la zona de soltar (que abre la carpeta; encendida, `.vivo`,
 * sin archivos ni charlas, 7.3); de la PC, «Abrir» y «Cambiar»; perdida, el texto de 5.2 con «Elegir otra»
 * y «Crear una nueva». `error`: la carpeta rechazada o que no se pudo crear (5.2).
 */
function bloqueCarpeta(p, n, error) {
  const c = p.carpeta ?? { estado: 'sin' }
  const err = error ? lineaError(error) : ''
  const otra = '<div class="mini-acc"><button type="button" class="mini pri" data-accion="pro-carpeta-elegir" data-k="car-elegir">Elegir otra</button>'
    + '<button type="button" class="mini" data-accion="pro-carpeta-crear" data-k="car-crear">Crear una nueva</button></div>'
  const cab = '<h3 class="rot">Carpeta</h3>'
  if (c.estado === 'perdida') {
    return `<section class="bloque car mal">${cab}${carpetaNombre(c)}`
      + `<p><b>No encuentro ${escapar(c.ruta)}.</b> ¿La moviste o es de un disco que no está? Las charlas siguen, solo con las instrucciones.</p>${otra}${err}</section>`
  }
  if (c.estado === 'sin') return `<section class="bloque car">${cab}${otra}${err}</section>`
  const extra = c.tipo === 'avis'
    ? `<button type="button" class="soltar${!c.archivos && !n ? ' vivo' : ''}" data-accion="pro-abrir-carpeta" data-k="soltar">Soltá archivos acá<small>${escapar(pieSoltar(c.archivos))}</small></button>`
    : '<div class="mini-acc"><button type="button" class="mini" data-accion="pro-abrir-carpeta" data-k="car-abrir">Abrir</button>'
      + '<button type="button" class="mini" data-accion="pro-carpeta-elegir" data-k="car-cambiar">Cambiar</button></div>'
  return `<section class="bloque car">${cab}${carpetaNombre(c)}<span class="tag">${escapar(etiquetaCarpeta(c))}</span>${extra}${err}</section>`
}

/** El bloque Instrucciones (4.6): el texto cortado a 5 líneas con la comilla del color, o el vacío con «Escribirlas». */
function bloqueInstrucciones(p) {
  const hay = !!String(p.instrucciones ?? '').trim()
  const boton = hay
    ? '<button type="button" class="bl-b" data-accion="pro-editar-ins" data-k="editar-ins" aria-label="Editar las instrucciones">Editar</button>'
    : '<button type="button" class="bl-b" data-accion="pro-editar-ins" data-k="editar-ins">Escribirlas</button>'
  const cuerpo = hay
    ? `<p class="instr">${escapar(p.instrucciones)}</p><small class="pie">Van al empezar cada charla</small>`
    : '<p class="instr-no">Sin instrucciones: Avi charla como siempre.</p>'
  return `<section class="bloque ins"><div class="bl-cab"><h3 class="rot">Instrucciones</h3>${boton}</div>${cuerpo}</section>`
}

/**
 * Sin charlas (4.5, 7.3): el recuadro punteado con la mascota feliz de 36 y «Listo, ya existe.» (con una
 * carpeta de la PC, sin la parte de soltar).
 */
function sinCharlas(p, especie) {
  const texto = p.carpeta?.tipo === 'avis'
    ? 'Soltá los archivos del tema en la carpeta y empezá a charlar: Avi ya conoce tus instrucciones.'
    : 'Empezá a charlar: Avi ya conoce tus instrucciones.'
  return `<p class="vacio-ch"><span class="av" aria-hidden="true">${avi(mascotaDe(especie), 'feliz', 36)}</span><span><b>Listo, ya existe.</b> ${texto}</span></p>`
}

/**
 * El proyecto elegido (3.4, 4.3 a 4.9), en el orden en que se usa: el encabezado con el lápiz, el botón
 * de charla, las charlas, las instrucciones, la carpeta, la matriz y «Borrar proyecto». `n`: sus charlas
 * (0 hasta P2). `armado`/`transcurrido`: el borrado que espera el segundo clic (4.11).
 */
export function fichaProyecto({ p, n = 0, especie = 'avi', armado = false, transcurrido = 0, errorCarpeta = null }) {
  const nombre = escapar(p.nombre)
  const perdida = p.carpeta?.estado === 'perdida'
  const linea = perdida ? escapar(lineaProyecto(p, n)).replace('carpeta perdida', '<span class="rojo">carpeta perdida</span>') : escapar(lineaProyecto(p, n))
  const cab = `<div class="f-cab"><span class="pj-ic" aria-hidden="true">${inicial(p.nombre)}</span>`
    + `<div class="f-t"><h2 id="pro-h2" tabindex="-1">${nombre}</h2><small>${linea}</small></div>`
    + `<button type="button" class="tb" data-accion="pro-editar" data-k="editar" aria-label="Editar ${nombre}" title="Editar">${ICONO_PRO.lapiz}</button></div>`
  // La charla del proyecto llega con P2: hasta entonces el botón se ve pero no hace nada
  const cta = `<button type="button" class="cta" data-accion="pro-charla" data-k="cta" aria-disabled="true"><span class="cta-av" aria-hidden="true">${avi(mascotaDe(especie), 'saluda', 30)}</span>`
    + `<span>${n ? 'Nueva charla' : 'Empezar la primera charla'}</span></button>`
  const borrar = `<div class="borrar-z">${confirmable('pro-borrar', p.id, 'borrar', 'Borrar proyecto', textoBorrar(n), armado, transcurrido)}`
    + (armado ? `<small>${escapar(lineaBorrar(n))}</small>` : '') + '</div>'
  // Los `h3` de 12: «Charlas» y «Qué ve cada motor» no tienen rótulo a la vista (boceto), van para el lector
  return `<div class="ficha" style="--c:${color(p.color)}">${cab}${cta}<h3 class="oculto">Charlas</h3>${sinCharlas(p, especie)}`
    + `${bloqueInstrucciones(p)}${bloqueCarpeta(p, n, errorCarpeta)}<h3 class="oculto">Qué ve cada motor</h3>${MATRIZ}${borrar}</div>`
}

// ------------------------------------------------------------------ el formulario (4.10)

/**
 * Nuevo o Editar (4.10): Nombre, Instrucciones (con su ayuda y, cerca del tope, la cuenta), en Editar el
 * Color, la Carpeta (en Nuevo, el grupo «Que Avis cree una» / «Una de esta PC»; en Editar, la actual con
 * «Cambiar…»), la matriz, el aviso de descartar y los botones. Los errores van debajo de su campo
 * (`aria-describedby`); el de guardar, debajo de los botones con «Reintentar» (7.7).
 */
export function formularioProyecto({ form, proyecto = null, errorForm = null, errorCarpeta = null }) {
  const editar = !!form.id
  const e = form.errores ?? {}
  const errN = textoErrorNombre(e.nombre)
  const errI = textoErrorInstrucciones(e.instrucciones)
  const cuenta = cuentaInstrucciones(form.instrucciones)
  const nombre = `<div class="fl"><label for="pro-nombre">Nombre</label>`
    + `<input id="pro-nombre" class="inp" data-campo="nombre" data-k="f-nombre" autocomplete="off" value="${escapar(form.nombre)}"${errN ? ' aria-invalid="true" aria-describedby="pro-nombre-err"' : ''}>`
    + (errN ? `<p class="f-err" id="pro-nombre-err">${errN}</p>` : '') + '</div>'
  const describe = ['pro-ins-ayuda', errI ? 'pro-ins-err' : ''].filter(Boolean).join(' ')
  const ins = '<div class="fl"><label for="pro-ins">Instrucciones</label>'
    + `<textarea id="pro-ins" class="inp" data-campo="instrucciones" data-k="f-ins" placeholder="Qué tiene que saber Avi de este tema, cómo querés que responda…" aria-describedby="${describe}"${errI ? ' aria-invalid="true"' : ''}>${escapar(form.instrucciones)}</textarea>`
    + '<div class="f-pie"><small id="pro-ins-ayuda">Van al empezar cada charla del proyecto, con los dos motores.</small>'
    + `<small class="f-cuenta" data-cuenta>${cuenta ?? ''}</small></div>`
    + (errI ? `<p class="f-err" id="pro-ins-err">${errI}</p>` : '') + '</div>'
  const colores = editar
    ? '<div class="fl"><span class="lbl" id="pro-color-l">Color</span><div class="colores" role="radiogroup" aria-labelledby="pro-color-l">'
      + COLORES.map(c => { const sel = c === colorDe(form.color); return `<button type="button" class="col" role="radio" aria-checked="${sel}" tabindex="${sel ? 0 : -1}" aria-label="${NOMBRES_COLOR[c]}" style="--c:var(--${c})" data-accion="pro-color" data-valor="${c}" data-k="col-${c}"></button>` }).join('')
      + '</div></div>'
    : ''
  let carpeta
  if (editar) {
    const c = proyecto?.carpeta
    const actual = c && c.estado !== 'sin' ? carpetaNombre(c) : ''
    carpeta = `<div class="fl"><span class="lbl">Carpeta</span><div class="car-act${c?.estado === 'perdida' ? ' mal' : ''}" style="--c:${color(form.color)}">${actual}`
      + '<button type="button" class="mini" data-accion="pro-carpeta-elegir" data-k="f-cambiar">Cambiar…</button></div>'
      + (errorCarpeta ? lineaError(errorCarpeta) : '') + '</div>'
  } else {
    const op = (valor, titulo, texto, previa = false) => {
      const sel = form.carpeta === valor
      return `<button type="button" class="oc" role="radio" aria-checked="${sel}" tabindex="${sel ? 0 : -1}" data-accion="pro-car-modo" data-valor="${valor}" data-k="oc-${valor}">`
        + `<b>${titulo}</b><span${previa ? ' data-previa' : ''}>${escapar(texto)}</span></button>`
    }
    carpeta = '<div class="fl"><span class="lbl" id="pro-car-l">Carpeta</span><div class="opc-c" role="radiogroup" aria-labelledby="pro-car-l">'
      + op('avis', 'Que Avis cree una', previaCarpetaAvis(form.nombre), true)
      + op('elegir', 'Una de esta PC', 'Elegir carpeta… Claude Code la lee; Avis no la toca.')
      + '</div></div>'
  }
  const aviso = form.aviso ? '<p class="f-aviso" role="status">¿Descartar los cambios? Esc otra vez</p>' : ''
  const botones = '<div class="form-acc">'
    + `<button type="button" class="btn-pri" data-accion="pro-guardar" data-k="f-guardar">${editar ? 'Guardar cambios' : 'Crear proyecto'}</button>`
    + '<button type="button" class="btn-sec" data-accion="pro-cancelar" data-k="f-cancelar">Cancelar</button></div>'
  const err = errorForm ? lineaError(errorForm.texto, errorForm.reintentar ? lnk('pro-guardar', 'f-reintentar', 'Reintentar') : '') : ''
  return `<form class="form" id="pro-form" aria-labelledby="pro-h2" novalidate style="--c:${color(form.color)}">`
    + `<h2 id="pro-h2" tabindex="-1">${editar ? 'Editar proyecto' : 'Nuevo proyecto'}</h2>`
    + nombre + ins + colores + carpeta + MATRIZ + aviso + botones + err + '</form>'
}

// ------------------------------------------------------------------ vacíos y errores (7.2, 5.2)

/**
 * El primer uso (7.2): la mascota de 96 saludando sobre la luz ámbar, el título y el texto de 5.2, tres
 * píldoras y «Crear mi primer proyecto».
 */
export function primerUsoProyectos(especie) {
  const pildora = (c, t) => `<span><i style="--c:var(--${c})"></i>${t}</span>`
  return `<div class="vacio"><div class="piso" aria-hidden="true">${avi(mascotaDe(especie), 'saluda', 96)}</div>`
    + '<h2 id="pro-h2" tabindex="-1">Tus proyectos van acá</h2>'
    + '<p>Un proyecto junta lo que Avi tiene que saber de un tema: tus instrucciones, una carpeta con archivos y sus charlas.</p>'
    + `<div class="tres">${pildora('ambar', 'Instrucciones')}${pildora('celeste', 'Carpeta')}${pildora('verde', 'Charlas')}</div>`
    + '<button type="button" class="btn-pri" data-accion="pro-nuevo" data-k="primer">Crear mi primer proyecto</button></div>'
}

/** No se pudo leer la carpeta de proyectos (5.2), con «Reintentar». */
export function errorLecturaProyectos() {
  return lineaError('No se pudo abrir la carpeta de proyectos.', lnk('pro-releer', 'releer', 'Reintentar'))
}

/** Proyectos rotos (7.6): arriba del índice, con «Abrir la carpeta» (`<config>/proyectos/`). */
export function lineaRotos(n) {
  return n ? lineaError(textoRotos(n), lnk('pro-carpeta-cfg', 'rotos', 'Abrir la carpeta')) : ''
}
