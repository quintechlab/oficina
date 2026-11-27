// La hoja «Horas» (odd/tasks/horas-trabajo.md, S4): el selector de período, el total, la lista de features
// (repo · rama) con su barra proporcional y, al abrir una, su total por día y sus sesiones. Solo HTML,
// como tareasVista.js (de donde reusa la tarjeta de error y el botón de texto): los datos llegan armados
// desde main.js y nada de acá toca el DOM. main.js redibuja por partes (`data-parte`), sin el sistema
// de diseño nuevo: el de Tareas, Hábitos y Proyectos (sin boceto, S4).

import { escapar, plural, tiempoRelativo } from './logica.js'
import { avi, claudeDe } from './avis.js'
import { especieValida } from './especies.js'
import { horaArgentina, hoyArgentina } from './fechas.js'
import { colorProyecto } from './tablero.js'
import { err, boton } from './tareasVista.js'
import { PERIODOS, duracion, etiquetaDia, FUERA_DE_UN_REPO } from './horas.js'

const NOMBRE_VOLVER = { hoy: 'Hoy', semana: 'Esta semana', todo: 'Todo' }
const VACIO = {
  hoy: 'Nada trabajado hoy',
  semana: 'Nada trabajado esta semana',
  todo: 'Todavía no hay horas',
}

/** El valor de una feature en `data-valor` (su clave lleva un separador que no va en un atributo). */
export const valorFeature = clave => encodeURIComponent(clave)
export const claveDeValor = valor => decodeURIComponent(valor)

/** El color de una feature: el del repo en la tira de repos; fuera de un repo, apagado. */
const colorDe = f => (f.repo ? colorProyecto(f.nombre) : 'var(--tenue)')
const pct = (ms, max) => `${max ? Math.max(2, Math.round((ms / max) * 1000) / 10) : 0}%`

/** «oficina · feat/horas» o «fuera de un repo», para el lector y los `title`. */
export function nombreFeature(f) {
  return f.repo ? `${f.nombre} · ${f.rotulo}` : FUERA_DE_UN_REPO
}

// ------------------------------------------------------------------ esqueleto

/** Lo que no cambia mientras la hoja está abierta: el cuerpo y los anuncios. */
export function esqueletoHoras() {
  return '<div id="hor-cuerpo"><div class="hor-cab" data-parte="cab"></div><div data-parte="err"></div>'
    + '<div class="hor-desplaza" data-parte="cuerpo"></div></div><p class="oculto" role="status" id="hor-vivo"></p>'
}

// ------------------------------------------------------------------ el encabezado: período y total

/** Segmentos con foco itinerante (`radiogroup`): el elegido es el único en el orden de tabulación. */
function selectorPeriodo(periodo) {
  const botones = PERIODOS.map(([v, t]) => {
    const sel = v === periodo
    return `<button type="button" role="radio" aria-checked="${sel}" tabindex="${sel ? 0 : -1}" data-accion="hor-periodo" data-valor="${v}" data-k="per-${v}">${t}</button>`
  }).join('')
  return `<div class="seg hor-per" role="radiogroup" aria-label="Período">${botones}</div>`
}

/**
 * El encabezado (siempre arriba): el selector y el total del período («2 h 15 min» y «en 3 features»).
 * Mientras se lee la primera vez, sin total.
 */
export function cabeceraHoras({ periodo, resumen, leido }) {
  const total = leido && resumen
    ? `<p class="hor-total"><b>${resumen.total > 0 ? escapar(duracion(resumen.total)) : '0 min'}</b><span>${resumen.features.length ? `en ${escapar(plural(resumen.features.length, 'feature', 'features'))}` : 'sin features'}</span></p>`
    : '<p class="hor-total esperando" aria-hidden="true"><b>…</b></p>'
  return selectorPeriodo(periodo) + total
}

// ------------------------------------------------------------------ la lista de features

/** «2 sesiones · hace 5 min» o «1 sesión · ahora». */
function metaFeature(f, ahoraMs) {
  const cuando = f.activa ? '<span class="hor-ahora"><i aria-hidden="true"></i>trabajando ahora</span>' : escapar(`hace ${tiempoRelativo(new Date(f.ultimo).toISOString(), ahoraMs)}`)
  return `${escapar(plural(f.sesiones, 'sesión', 'sesiones'))} · ${cuando}`
}

/** El nombre accesible de una fila: «oficina · feat/horas: 1 h 5 min, 2 sesiones, trabajando ahora». */
function etiquetaFila(f, ahoraMs) {
  const cuando = f.activa ? 'trabajando ahora' : `la última hace ${tiempoRelativo(new Date(f.ultimo).toISOString(), ahoraMs)}`
  return `${nombreFeature(f)}: ${duracion(f.ms)}, ${plural(f.sesiones, 'sesión', 'sesiones')}, ${cuando}`
}

/** Una fila de feature: punto del repo, repo y rama, total, meta y la barra proporcional al más largo. */
function filaFeature(f, max, ahoraMs, k) {
  const v = valorFeature(f.clave)
  const nombre = f.repo
    ? `<b>${escapar(f.nombre)}</b><span class="hor-r${f.rama ? '' : ' sin'}">${escapar(f.rotulo)}</span>`
    : `<b class="sin">${escapar(FUERA_DE_UN_REPO)}</b>`
  return `<li style="--c:${colorDe(f)};--p:${pct(f.ms, max)};--i:${k}"${f.activa ? ' class="activa"' : ''}>`
    + `<button type="button" class="hor-f" data-accion="hor-feature" data-valor="${escapar(v)}" data-k="f-${escapar(v)}" aria-label="${escapar(etiquetaFila(f, ahoraMs))}" title="${escapar(f.repo ? `${f.repo} · ${f.rotulo}` : FUERA_DE_UN_REPO)}">`
    + `<i class="pt" aria-hidden="true"></i><span class="hor-n" aria-hidden="true">${nombre}</span>`
    + `<span class="hor-t" aria-hidden="true">${escapar(duracion(f.ms))}</span>`
    + `<span class="hor-m" aria-hidden="true">${metaFeature(f, ahoraMs)}</span>`
    + '<span class="hor-b" aria-hidden="true"><i></i></span></button></li>'
}

const FANTASMAS = '<ul class="hor-lista fantasmas" aria-hidden="true"><li></li><li></li><li></li></ul>'

/** Sin nada en el período: la mascota y qué cuenta el reloj (7.2, como los vacíos de Tareas y Hábitos). */
function vacioHoras(periodo, mascota) {
  const extra = periodo === 'todo'
    ? 'Cuando un agente trabaje en una sesión, su tiempo aparece acá por feature (repo + rama).'
    : 'Lo que se trabaje aparece acá por feature (repo + rama).'
  return `<div class="primer hor-vacio">${avi(claudeDe(especieValida(mascota)), 'esperando', 72)}<b>${VACIO[periodo] ?? VACIO.hoy}</b>`
    + `<p>El reloj corre mientras algún agente trabaja y se frena cuando Claude te pregunta algo o espera tu permiso. ${extra}</p></div>`
}

/** La lista de features del período, la de actividad más reciente primero. */
export function listaHoras({ periodo, resumen, ahoraMs, mascota = 'avi' }) {
  if (!resumen.features.length) return vacioHoras(periodo, mascota)
  return `<ul class="hor-lista" aria-label="Features">${resumen.features.map((f, k) => filaFeature(f, resumen.max, ahoraMs, k)).join('')}</ul>`
}

// ------------------------------------------------------------------ la feature abierta

/** «hoy 10:05 → 12:30», «jue 26/11 10:05 → vie 27/11 01:30»; con un tramo vivo, «… → ahora». */
function rangoSesion(x, hoy) {
  const dia = ms => etiquetaDia(hoyArgentina(ms), hoy)
  const desde = `${dia(x.desde)} ${horaArgentina(x.desde)}`
  if (x.activa) return `${desde} → ahora`
  const hasta = dia(x.hasta) === dia(x.desde) ? horaArgentina(x.hasta) : `${dia(x.hasta)} ${horaArgentina(x.hasta)}`
  return `${desde} → ${hasta}`
}

/**
 * La feature abierta, en el lugar de la lista (como la tarea abierta de Tareas): «‹ {período}», el
 * nombre, el total, el total por día (el más nuevo arriba, con su barra) y las sesiones que sumaron.
 */
export function detalleHoras({ periodo, detalle: d, ahoraMs }) {
  const hoy = hoyArgentina(ahoraMs)
  const maxDia = d.dias.reduce((n, x) => Math.max(n, x.ms), 0)
  const titulo = d.repo
    ? `<span>${escapar(d.nombre)}</span><span class="hor-r${d.rama ? '' : ' sin'}">${escapar(d.rotulo)}</span>`
    : `<span>${escapar(FUERA_DE_UN_REPO)}</span>`
  const estado = d.sesiones.some(x => x.activa) ? ' · <span class="hor-ahora"><i aria-hidden="true"></i>trabajando ahora</span>' : ''
  const dias = d.dias.map((x, k) => `<li style="--p:${pct(x.ms, maxDia)};--i:${k}"><span class="d">${escapar(etiquetaDia(x.dia, hoy))}</span>`
    + `<span class="hor-b" aria-hidden="true"><i></i></span><span class="t">${escapar(duracion(x.ms))}</span></li>`).join('')
  const ses = d.sesiones.map((x, k) => `<li style="--i:${k}"${x.activa ? ' class="activa"' : ''}><span class="id" title="${escapar(x.sesion)}"><span class="oculto">Sesión </span>${escapar(x.sesion.slice(0, 8))}</span>`
    + `<span class="r">${escapar(rangoSesion(x, hoy))}</span><span class="t">${escapar(duracion(x.ms))}</span></li>`).join('')
  return `<div class="hor-det" style="--c:${colorDe(d)}">`
    + `<button type="button" class="lnk atras" data-accion="hor-volver" data-k="volver">‹ ${escapar(NOMBRE_VOLVER[periodo] ?? 'Hoy')}</button>`
    + `<h2 id="hor-det-h" tabindex="-1" title="${escapar(d.repo ? `${d.repo} · ${d.rotulo}` : FUERA_DE_UN_REPO)}"><i class="pt" aria-hidden="true"></i>${titulo}</h2>`
    + `<p class="hor-det-s"><b>${escapar(duracion(d.ms))}</b> · ${escapar(plural(d.sesiones.length, 'sesión', 'sesiones'))}${estado}</p>`
    + `<h3 class="rot-p">Por día</h3><ul class="hor-dias">${dias}</ul>`
    + `<h3 class="rot-p">Sesiones</h3><ul class="hor-ses">${ses}</ul></div>`
}

// ------------------------------------------------------------------ errores

/** Las horas no se pudieron leer (5.2): con datos de antes, arriba de la lista; sin datos, en su lugar. */
export function errorHoras(detalle) {
  return err('No se pudieron leer las horas.', escapar(detalle ?? ''), boton('hor-releer', 'releer', 'Volver a leer'))
}

/**
 * Las tres partes de la hoja: `{ cab, err, cuerpo }`. `detalle` (de `detalleFeature`) manda sobre la
 * lista; sin leer todavía, las filas fantasma (si tarda) o nada; con error y sin datos, el error en el
 * cuerpo.
 */
export function partesHoras({ periodo, resumen, detalle, leido, fantasmas, error, ahoraMs, mascota }) {
  const cab = cabeceraHoras({ periodo, resumen, leido })
  if (!leido) {
    if (error) return { cab, err: '', cuerpo: errorHoras(error) }
    return { cab, err: '', cuerpo: fantasmas ? FANTASMAS : '' }
  }
  return {
    cab,
    err: error ? errorHoras(error) : '',
    cuerpo: detalle ? detalleHoras({ periodo, detalle, ahoraMs }) : listaHoras({ periodo, resumen, ahoraMs, mascota }),
  }
}
