// El HTML de los recibos y de la línea «Puede tocar» (#43, C2; docs/diseno/chat-herramientas-ux.md 3.3,
// 4, 5 y 12). Puro, como chatVista.js: main.js lo pone en el hilo (agregando sin reescribir, 11.11) y
// recibos.test.js lo revisa. Todo lo que viene del modelo o del disco pasa por `escapar`.
//
// `v` (la vista): `{ listas, hoy, ui, mascota, enCurso }`. `listas`: las de Tareas en pantalla (para
// los nombres y colores; una que ya no está va sin chip); `ui`: el estado de «Deshacer» por id de
// cambio (`curso` o `fallo`, solo de esta ejecución); `enCurso`: el turno del mensaje sigue corriendo.

import { escapar } from './logica.js'
import { buscarTarea } from './tareas.js'
import {
  armarRecibos, verboCambio, encabezadoRecibo, encabezadoError, metaCambio, metaFila, tituloLectura, pieDeshacer, lineaPuede,
} from './recibos.js'

const ICONO = Object.freeze({
  tilde: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6-6.3"/></svg>',
  deshacer: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 4L2.5 6.5 5 9"/><path d="M2.5 6.5H10a3.5 3.5 0 0 1 0 7H7"/></svg>',
  puede: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="3.2"/><path d="M5.3 8.2l1.9 1.9 3.6-4"/></svg>',
  cerrar: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
})

const DESPUES_TITULO = 'La tarea cambió en Tareas después de esto: cambiala a mano.'

// ------------------------------------------------------------------ la línea «Puede tocar» (4.1)

/** La línea fija entre la cabecera y el hilo. `abierto`: su globo se ve (`aria-expanded`). */
export function lineaPuedeHtml({ motor, abierto = false, habitos = false }) {
  const l = lineaPuede({ motor, habitos })
  return `<button type="button" class="puede${l.local ? ' no' : ''}" id="ch-puede" data-accion="ch-puede" aria-expanded="${!!abierto}" aria-label="${escapar(l.etiqueta)}">`
    + `<span class="ico" aria-hidden="true">${ICONO.puede}</span><span class="t" aria-hidden="true">${escapar(l.texto)}<b>${escapar(l.fuerte)}</b></span>`
    + `<span class="mas" aria-hidden="true">${escapar(l.pista)}</span></button>`
}

/** El globo de la línea (`role=dialog`): el texto de 5.1 y, con Local, «Charla nueva con Claude Code». */
export function globoPuedeHtml({ motor, abierto = false, habitos = false, mascota = 'Avi' }) {
  if (!abierto) return ''
  const l = lineaPuede({ motor, habitos, mascota })
  const texto = l.globo.map(s => (s.b ? `<b>${escapar(s.t)}</b>` : escapar(s.t))).join('')
  const nueva = l.nueva ? `<div class="acc"><button type="button" class="mini pri" data-accion="ch-puede-nueva">${escapar(l.nueva)}</button></div>` : ''
  return `<div class="puede-globo" role="dialog" aria-label="Qué puede tocar"><p>${texto}</p>${nueva}`
    + `<button type="button" class="ic" data-accion="ch-puede" aria-label="Cerrar">${ICONO.cerrar}</button></div>`
}

// ------------------------------------------------------------------ las piezas de una fila (4.3)

const COLOR = c => `var(--${c})`
const TONO = { cerca: ' h', vencida: ' v', nada: '' }

function chips(meta) {
  return meta.map(m => (m.tipo === 'lista'
    ? `<span class="tg" style="--c:${COLOR(m.color)}"><i aria-hidden="true"></i>${escapar(m.texto)}</span>`
    : `<span class="tg${TONO[m.tono] ?? ''}">${escapar(m.texto)}</span>`)).join('')
}

/** El círculo de Tareas (decorativo: el verbo lo dice); tildado, ámbar con el visto. */
const circulo = (on, extra = '') => `<span class="cir${on ? ' on' : ''}${extra}" aria-hidden="true">${on ? ICONO.tilde : ''}</span>`

/** «Deshacer» de una fila (4.4) o, ya hecho, «Deshecho» / «Cambió después» (enfocables por código, 9.3). */
function accionFila(c, solo, ui) {
  const id = escapar(c.id)
  if (c.estado === 'deshecho') return `<span class="estado-d" tabindex="-1" data-estado="${id}">Deshecho</span>`
  if (c.estado === 'cambio-despues') return `<span class="estado-d" tabindex="-1" data-estado="${id}" title="${DESPUES_TITULO}">Cambió después</span>`
  const curso = ui?.get(c.id) === 'curso'
  const etiqueta = `Deshacer: ${verboCambio(c)} ${c.titulo ?? ''}`
  return `<button type="button" class="deshacer${solo ? ' solo' : ''}${curso ? ' gira' : ''}" data-accion="ch-deshacer" data-cambio="${id}" aria-label="${escapar(etiqueta)}"`
    + `${solo ? ` title="Deshacer"` : ''}${curso ? ' aria-busy="true" aria-disabled="true"' : ''}>${ICONO.deshacer}${solo ? '' : 'Deshacer'}</button>`
}

/** Una fila de cambio (`.rf`, 4.3): marca, título, verbo y etiquetas, y su acción. Exportada para agregarla sola. */
export function filaCambioHtml(c, v, { solo = false } = {}) {
  const verbo = verboCambio(c)
  const tildada = c.herramienta === 'tarea_tildar' && c.despues?.hecha === true
  const clases = ['rf', c.estado === 'deshecho' ? 'deshecho' : ''].filter(Boolean).join(' ')
  const fallo = v.ui?.get(c.id) === 'fallo' ? '<p class="rf-err" role="alert">No se pudo deshacer. Probá de nuevo.</p>' : ''
  return `<div class="${clases}" data-cambio="${escapar(c.id)}" role="group" aria-label="${escapar(`${verbo}: ${c.titulo ?? ''}`)}">`
    + `${circulo(tildada)}<span class="tx"><b>${escapar(c.titulo ?? '')}<i class="raya" aria-hidden="true"></i></b>`
    + `<span class="meta"><span class="vb">${escapar(verbo)} ·</span>${chips(metaCambio(c, v.listas, v.hoy))}</span></span>`
    + `${accionFila(c, solo, v.ui)}${fallo}</div>`
}

/** El vínculo del encabezado: «Ver en Tareas →» del último cambio (4.2). */
function verEnTareas(cambios) {
  const u = cambios.at(-1)
  return `<button type="button" class="lnk" data-accion="ch-ver-tareas" data-lista="${escapar(u?.lista ?? '')}" data-tarea="${escapar(u?.tarea ?? '')}">Ver en Tareas →</button>`
}

/** El pie del recibo de cambios (desde 2): «tareas» y «Deshacer los {n}» o «Deshechos {k} de {n}». */
export function pieCambiosHtml(cambios, k) {
  if (cambios.length < 2) return ''
  const p = pieDeshacer(cambios)
  const derecha = p.boton
    ? `<button type="button" class="deshacer" data-accion="ch-deshacer-todos" data-i="${k}">${ICONO.deshacer}${escapar(p.boton)}</button>`
    : p.estado ? `<span class="estado-d" tabindex="-1" data-estado="pie-${k}">${escapar(p.estado)}</span>` : ''
  // Enfocable por código: «Deshacer los {n}» deja ahí el foco aunque no quede ningún botón (9.3)
  return `<div class="rec-pie" tabindex="-1" data-pie="${k}"><span>tareas</span>${derecha}</div>`
}

/** El encabezado del recibo de cambios (su texto cambia solo, 7). */
export const encabezadoCambiosHtml = cambios => `<div class="rec-h"><span class="rec-t">${escapar(encabezadoRecibo(cambios))}</span>${verEnTareas(cambios)}</div>`

// ------------------------------------------------------------------ cada recibo (4.2 a 4.8)

function reciboCambios(cambios, k, v) {
  const solo = cambios.length > 1
  return `<section class="rec" data-rec="cambios" aria-label="${escapar(encabezadoRecibo(cambios))}"><i class="rec-luz" aria-hidden="true"></i>`
    + `${encabezadoCambiosHtml(cambios)}${cambios.map(c => filaCambioHtml(c, v, { solo })).join('')}${pieCambiosHtml(cambios, k)}</section>`
}

function reciboError(c, v) {
  const titulo = c.titulo ?? c.args?.titulo ?? ''
  const reintentar = c.reintentable ? `<button type="button" class="mini pri" data-accion="ch-reintentar-cambio" data-cambio="${escapar(c.id)}">Reintentar</button>` : ''
  return `<section class="rec mal" data-rec="error" data-cambio="${escapar(c.id)}" aria-label="${escapar(encabezadoError(c))}"><i class="rec-luz" aria-hidden="true"></i>`
    + `<div class="rec-h"><span class="rec-t">${escapar(encabezadoError(c))}</span></div>`
    + `<div class="rf pedida" role="group" aria-label="${escapar(titulo)}">${circulo(false)}<span class="tx"><b>${escapar(titulo)}</b>`
    + `<span class="meta">${chips(metaCambio(c, [], v.hoy).filter(m => m.tipo === 'fecha'))}</span></span></div>`
    + `<p class="motivo">${escapar(c.motivo ?? '')}</p>`
    + `<div class="rec-pie">${reintentar}<button type="button" class="mini sutil" data-accion="ch-abrir-tareas">Abrir Tareas</button></div></section>`
}

function reciboMostrar(c, v) {
  const existe = !v.listas?.length || !!buscarTarea(v.listas, c.tarea)
  const ir = existe
    ? `<button type="button" class="mini pri" data-accion="ch-ir-tarea" data-lista="${escapar(c.lista ?? '')}" data-tarea="${escapar(c.tarea ?? '')}">Ir a la tarea →</button>`
    : `<button type="button" class="mini pri" data-accion="ch-ir-tarea" data-lista="${escapar(c.lista ?? '')}" data-tarea="${escapar(c.tarea ?? '')}" aria-disabled="true">Ya no está</button>`
  const tarea = existe ? buscarTarea(v.listas, c.tarea)?.tarea : null
  const meta = tarea ? metaFila({ fecha: tarea.fecha, lista: c.lista, hecha: tarea.hecha }, v.listas, v.hoy) : metaFila({ lista: c.lista }, v.listas, v.hoy)
  const titulo = c.resumen?.para === 'ver' ? 'En Tareas' : 'Para borrar'
  return `<section class="rec neutro" data-rec="mostrar" data-cambio="${escapar(c.id)}" aria-label="${titulo}"><div class="rec-h"><span class="rec-t">${titulo}</span></div>`
    + `<div class="rf" role="group" aria-label="${escapar(c.titulo ?? '')}">${circulo(!!tarea?.hecha)}<span class="tx"><b>${escapar(c.titulo ?? '')}</b><span class="meta">${chips(meta)}</span></span>${ir}</div></section>`
}

function reciboLectura(c, v) {
  const r = c.resumen ?? {}
  const total = Number(r.total) || 0
  const hechas = Number(r.hechas) || 0
  const p = total ? Math.round((hechas / total) * 1000) / 10 : 0
  const titulo = tituloLectura(r)
  const filas = (Array.isArray(r.filas) ? r.filas : []).slice(0, 6).map(f => {
    const vencida = !f.hecha && typeof f.fecha === 'string' && f.fecha < v.hoy
    return `<div class="rf${f.hecha ? ' hecha' : ''}${vencida ? ' vencida' : ''}">${circulo(!!f.hecha)}<span class="tx"><b>${escapar(f.titulo ?? '')}</b>`
      + `<span class="meta">${chips(metaFila(f, v.listas, v.hoy))}</span></span></div>`
  }).join('')
  const mas = Number(r.mas) > 0 ? `<p class="mas-l">y ${Number(r.mas)} más</p>` : ''
  return `<section class="rec lee" data-rec="lectura" data-cambio="${escapar(c.id)}" aria-label="${escapar(titulo)}"><div class="rec-h"><span class="rec-t">${escapar(titulo)}</span>`
    + `<span class="prog" aria-hidden="true" style="--p:${p}%"><i></i></span><span class="cuenta">${hechas} de ${total}</span></div>`
    + `${filas}${mas}<div class="rec-pie"><span>solo lectura · no cambió nada</span><button type="button" class="mini pri" data-accion="ch-abrir-tareas">Abrir Tareas →</button></div></section>`
}

function reciboNoLlego() {
  return '<section class="rec mal" data-rec="nollego" aria-label="Un cambio no llegó a Avis"><i class="rec-luz" aria-hidden="true"></i>'
    + '<div class="rec-h"><span class="rec-t">Un cambio no llegó a Avis</span></div>'
    + `<p class="motivo">${escapar('Avi intentó cambiar algo y Avis no lo recibió. No cambió nada; revisá en Tareas.')}</p>`
    + '<div class="rec-pie"><button type="button" class="mini sutil" data-accion="ch-abrir-tareas">Abrir Tareas</button></div></section>'
}

/** El HTML de un recibo de `armarRecibos`. */
export function reciboHtml(r, k, v) {
  switch (r.tipo) {
    case 'cambios': return reciboCambios(r.cambios, k, v)
    case 'error': return reciboError(r.cambio, v)
    case 'mostrar': return reciboMostrar(r.cambio, v)
    case 'lectura': return reciboLectura(r.cambio, v)
    case 'nollego': return reciboNoLlego()
    default: return ''
  }
}

/**
 * Los recibos de un mensaje de la mascota (`div.recibos`, después de su texto, 3.2), o nada si no
 * tiene: así una charla sin tareas se dibuja igual que antes. `k`: el índice del mensaje.
 * Mientras el turno corre, la región es `aria-live="polite"` (12).
 */
export function recibosHtml(msg, k, v) {
  const recibos = armarRecibos(msg)
  if (!recibos.length) return ''
  return `<div class="recibos" data-i="${k}"${v.enCurso ? ' aria-live="polite"' : ''}>${recibos.map(r => reciboHtml(r, k, v)).join('')}</div>`
}
