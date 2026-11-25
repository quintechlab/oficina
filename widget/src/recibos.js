// Los recibos de la charla con herramientas (#43, C2; docs/diseno/chat-herramientas-ux.md 4, 5 y 11.10):
// qué recibos lleva un mensaje de la mascota, sus encabezados, los verbos de cada fila, sus etiquetas,
// cuándo sale el recibo de lectura, los cambios que no llegaron, la línea «Puede tocar» y los anuncios.
// Puro: el recibo dice la verdad de Avis (lo arma con los `cambios` que emitió Rust al escribir, 11.6),
// nunca con el texto del modelo. recibosVista.js lo dibuja y main.js lo pone en el hilo.

import { etiquetaFecha, colorDe, fechaCorta } from './tareas.js'
import { diasEntre } from './fechas.js'

/** Las herramientas que escriben (11.4): sus cambios van al recibo de cambios, con «Deshacer». */
export const ESCRIBEN = Object.freeze(['tarea_crear', 'tarea_editar', 'tarea_tildar'])
const PREFIJO = 'mcp__avis__'
const escribe = c => ESCRIBEN.includes(c?.herramienta)
const cambiosDe = msg => (Array.isArray(msg?.cambios) ? msg.cambios.filter(c => typeof c?.id === 'string') : [])
const terminado = msg => msg?.estado !== 'escribiendo'

/** Los campos que cambió un `tarea_editar` (los de `despues` sin la lista, más `lista` si la movió). */
function camposEditados(c) {
  const despues = c.despues ?? {}
  const campos = Object.keys(despues).filter(k => k !== 'lista')
  if ((c.antes?.lista ?? null) !== (despues.lista ?? null)) campos.push('lista')
  return campos
}

/** El verbo de la fila (5.2), el mismo que `verbo_cambio` de mcp_avis.rs: «anotada», «movida», «nueva fecha»… */
export function verboCambio(c) {
  const despues = c?.despues ?? {}
  switch (c?.herramienta) {
    case 'tarea_crear': return 'anotada'
    case 'tarea_tildar': return despues.hecha === true ? 'tildada' : 'destildada'
    default: {
      const campos = camposEditados(c ?? {})
      if (campos.length !== 1) return 'editada'
      switch (campos[0]) {
        case 'lista': return 'movida'
        case 'fecha': return despues.fecha == null ? 'sin fecha' : 'nueva fecha'
        case 'titulo': return 'renombrada'
        case 'importante': return despues.importante === true ? 'importante' : 'ya no importante'
        case 'notas': return 'notas'
        default: return 'editada'
      }
    }
  }
}

/** El encabezado del recibo de cambios (5.2): por herramienta con uno; «{n} cambios» con varios. */
export function encabezadoRecibo(cambios) {
  const cs = cambios ?? []
  if (cs.length > 1) return `${cs.length} cambios`
  const c = cs[0]
  if (!c) return ''
  if (c.herramienta === 'tarea_crear') return 'Anoté en Tareas'
  if (c.herramienta === 'tarea_tildar') return c.despues?.hecha === true ? 'Tildé en Tareas' : 'Destildé en Tareas'
  return verboCambio(c) === 'movida' ? 'Moví en Tareas' : 'Cambié en Tareas'
}

/** El encabezado de un recibo de error (4.7). */
export function encabezadoError(c) {
  if (c?.herramienta === 'tarea_crear') return 'No se anotó'
  if (c?.herramienta === 'tarea_tildar') return 'No se tildó'
  return 'No se cambió'
}

const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const esDia = f => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)

/** Una fecha en un «antes → después»: «ayer», «hoy», «mañana» o «vie 27/11». */
function fechaFlecha(f, hoy) {
  if (f == null) return 'sin fecha'
  if (!esDia(f)) return String(f)
  const n = diasEntre(f, hoy)
  if (n >= -1 && n <= 1) return etiquetaFecha(f, hoy).corto
  const d = new Date(`${f}T12:00:00Z`)
  return `${SEMANA[d.getUTCDay()]} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}

/**
 * El tono de una fecha (4.3): `cerca` (ámbar: hoy o mañana), `vencida` (rojo) o `nada`. Una palabra
 * que no es un día (lo que pidió el modelo en un error: «mañana») va sin tono.
 */
function chipFecha(f, hoy, hecha = false) {
  if (!f || hecha) return null
  if (!esDia(f)) return { tipo: 'fecha', texto: String(f), tono: 'nada' }
  const e = etiquetaFecha(f, hoy)
  const n = diasEntre(f, hoy)
  return { tipo: 'fecha', texto: e.corto, tono: e.tono === 'error' ? 'vencida' : n === 0 || n === 1 ? 'cerca' : 'nada' }
}

const listaDe = (listas, id) => (listas ?? []).find(l => l.id === id) ?? null
const chipLista = (listas, id) => {
  const l = listaDe(listas, id)
  return l ? { tipo: 'lista', texto: String(l.nombre ?? ''), color: colorDe(l.color) } : null
}

/**
 * Las etiquetas de la fila de un cambio (4.3): la de fecha (`etiquetaFecha` de tareas.js) y la de lista
 * (con su color). Para «movida», «Casa → Compras»; para «nueva fecha», «hoy → vie 27/11». Una lista
 * que ya no existe (o que todavía no se leyó) no lleva chip. `[{ tipo, texto, tono | color }]`.
 */
export function metaCambio(c, listas, hoy) {
  const despues = c?.despues ?? {}
  const antes = c?.antes ?? {}
  const meta = []
  if (c?.estado === 'error') {
    meta.push(chipFecha(c.args?.fecha, hoy))
  } else if (c?.herramienta === 'tarea_crear') {
    meta.push(chipFecha(despues.fecha, hoy))
  } else if (c?.herramienta === 'tarea_editar' && 'fecha' in despues && despues.fecha != null) {
    meta.push('fecha' in antes && antes.fecha != null
      ? { tipo: 'fecha', texto: `${fechaFlecha(antes.fecha, hoy)} → ${fechaFlecha(despues.fecha, hoy)}`, tono: 'nada' }
      : chipFecha(despues.fecha, hoy))
  }
  const destino = despues.lista ?? c?.lista
  if (c?.herramienta === 'tarea_editar' && antes.lista && antes.lista !== despues.lista) {
    const de = listaDe(listas, antes.lista)
    const a = listaDe(listas, despues.lista)
    meta.push(de && a ? { tipo: 'lista', texto: `${de.nombre} → ${a.nombre}`, color: colorDe(a.color) } : null)
  } else if (destino) {
    meta.push(chipLista(listas, destino))
  }
  return meta.filter(Boolean)
}

/** Las etiquetas de una fila del recibo de lectura (4.5): su fecha (tildada, ninguna) y su lista. */
export function metaFila(f, listas, hoy) {
  return [chipFecha(f?.fecha, hoy, !!f?.hecha), chipLista(listas, f?.lista)].filter(Boolean)
}

/** Los nombres de herramientas de Avis del turno, sin el prefijo (`mcp__avis__`), en orden. */
const deAvis = msg => (msg?.herramientas ?? []).map(h => String(h?.nombre ?? '')).filter(n => n.startsWith(PREFIJO)).map(n => n.slice(PREFIJO.length))

/**
 * ¿Sale el recibo de lectura (4.5)? Solo si el turno terminó, no hizo ningún cambio (ni uno que
 * falló) y su última llamada fue `tareas_ver` con vista `hoy`, `vencidas` o `lista`: una lectura que el
 * modelo hace para buscar un id antes de cambiar algo no deja recibo (D-c10).
 */
export function debeMostrarLectura(msg) {
  if (!terminado(msg)) return false
  const cambios = cambiosDe(msg)
  if (cambios.some(escribe)) return false
  const ultimo = cambios.at(-1)
  if (ultimo?.estado !== 'lectura' || !['hoy', 'vencidas', 'lista'].includes(ultimo.resumen?.vista)) return false
  const llamadas = deAvis(msg)
  return !llamadas.length || llamadas.at(-1) === 'tareas_ver'
}

/**
 * Cuántos cambios pidió el modelo (`tool_use` de crear, editar o tildar) que Avis no registró, ni
 * hechos ni con error (4.8). Las lecturas no cuentan.
 */
export function faltantes(msg) {
  const pedidos = deAvis(msg).filter(n => ESCRIBEN.includes(n)).length
  const registrados = cambiosDe(msg).filter(escribe).length
  return Math.max(0, pedidos - registrados)
}

/**
 * Los recibos de un mensaje de la mascota, en el orden en que llegan (3.2): como mucho uno de cambios
 * (donde llegó el primero), los de error y «para borrar»; al terminar el turno, el de lectura y el de
 * «no llegó». `[{ tipo: 'cambios', cambios } | { tipo: 'error' | 'mostrar' | 'lectura', cambio } | { tipo: 'nollego', n }]`.
 */
export function armarRecibos(msg) {
  const recibos = []
  let deCambios = null
  for (const c of cambiosDe(msg)) {
    if (escribe(c) && c.estado === 'error') recibos.push({ tipo: 'error', cambio: c })
    else if (escribe(c)) {
      if (!deCambios) { deCambios = { tipo: 'cambios', cambios: [] }; recibos.push(deCambios) }
      deCambios.cambios.push(c)
    } else if (c.estado === 'mostrar') recibos.push({ tipo: 'mostrar', cambio: c })
  }
  if (debeMostrarLectura(msg)) recibos.push({ tipo: 'lectura', cambio: cambiosDe(msg).at(-1) })
  const n = terminado(msg) ? faltantes(msg) : 0
  if (n) recibos.push({ tipo: 'nollego', n })
  return recibos
}

/** El encabezado del recibo de lectura (5.2): «Hoy · miércoles 25/11», «Vencidas» o el nombre de la lista. */
export function tituloLectura(r) {
  if (r?.vista === 'vencidas') return 'Vencidas'
  if (r?.vista === 'lista') return String(r.nombre ?? 'Lista')
  return esDia(r?.hoy) ? `Hoy · ${fechaCorta(r.hoy)}` : 'Hoy'
}

/**
 * El lado derecho del pie del recibo (4.4): «Deshacer los {n}» mientras haya 2 o más por deshacer;
 * cuando no queda ninguno, «Deshechos {k} de {n}» si alguno no se pudo (cambió después).
 */
export function pieDeshacer(cambios) {
  const cs = cambios ?? []
  const pendientes = cs.filter(c => c.estado === 'hecho').length
  if (pendientes >= 2) return { boton: `Deshacer los ${pendientes}`, estado: null }
  if (pendientes) return { boton: null, estado: null }
  const k = cs.filter(c => c.estado === 'deshecho').length
  return { boton: null, estado: k < cs.length ? `Deshechos ${k} de ${cs.length}` : null }
}

/**
 * La línea «Puede tocar» y su globo (4.1, 5.1): `{ local, texto, fuerte, pista, etiqueta, globo, nueva }`.
 * `globo`: tramos `{ t, b }` (b: en negrita). `habitos`: la entrega C3. `mascota`: su nombre.
 */
export function lineaPuede({ motor, habitos = false, mascota = 'Avi' } = {}) {
  if (motor === 'local') {
    return {
      local: true, texto: 'Tareas y hábitos: ', fuerte: 'todavía no con Local', pista: '?',
      etiqueta: 'Tareas y hábitos: todavía no con el modelo local. Ver más',
      globo: [{ t: `Con el modelo local, ${mascota} todavía no toca tus tareas ni tus hábitos: solo charla. Para que los maneje, charlá con Claude Code.` }],
      nueva: 'Charla nueva con Claude Code',
    }
  }
  const fuerte = habitos ? 'tus tareas y hábitos' : 'tus tareas'
  return {
    local: false, texto: 'Puede tocar ', fuerte, pista: 'borrar, no ›',
    etiqueta: `Puede tocar ${fuerte}. Ver qué puede y qué no`,
    globo: [
      { t: 'Puede ver tus tareas, anotar, cambiar fecha, lista, notas o si es importante, y tildar. ' },
      { t: 'No puede borrar', b: true },
      { t: `: eso lo hacés vos con un clic. Cada cambio queda acá con «Deshacer».${habitos ? ' Y ver y marcar tus hábitos de hoy.' : ''}` },
    ],
    nueva: null,
  }
}

const mayuscula = s => (s ? s[0].toUpperCase() + s.slice(1) : s)

/**
 * El anuncio de un recibo (5.3), uno por recibo cuando el turno termina: «Anotada: {título}, {fecha}»,
 * «{n} cambios: {verbo} {título}; …» o «No se anotó: {título}. {motivo}».
 */
export function anuncioRecibo(cambios, hoy) {
  const cs = cambios ?? []
  if (!cs.length) return ''
  const c = cs[0]
  if (cs.length === 1 && c.estado === 'error') return `${encabezadoError(c)}: ${c.titulo ?? c.args?.titulo ?? ''}. ${c.motivo ?? ''}`.trim()
  if (cs.length === 1) {
    const fecha = c.herramienta === 'tarea_crear' && esDia(c.despues?.fecha) ? `, ${etiquetaFecha(c.despues.fecha, hoy).corto}` : ''
    return `${mayuscula(verboCambio(c))}: ${c.titulo ?? ''}${fecha}`
  }
  return `${cs.length} cambios: ${cs.map(x => `${verboCambio(x)} ${x.titulo ?? ''}`).join('; ')}`
}

/**
 * El anuncio de Deshacer (5.3): `[[cambio, estado]]` con `deshecho`, `cambio-despues` o `error`. Uno:
 * «Deshecho: {título}», «No se pudo deshacer {título}» y, el que 5.3 no define, «Cambió después: {título}»;
 * varios («Deshacer los {n}»), con el formato del anuncio de fin: «{n} cambios: deshecho {título}; …».
 */
export function anuncioDeshacer(resultados) {
  const rs = resultados ?? []
  const frase = ([c, estado], varios) => {
    const titulo = c?.titulo ?? ''
    if (estado === 'deshecho') return `${varios ? 'deshecho' : 'Deshecho:'} ${titulo}`
    if (estado === 'cambio-despues') return `${varios ? 'cambió después' : 'Cambió después:'} ${titulo}`
    return `${varios ? 'no se pudo deshacer' : 'No se pudo deshacer'} ${titulo}`
  }
  if (!rs.length) return ''
  if (rs.length === 1) return frase(rs[0], false)
  return `${rs.length} cambios: ${rs.map(r => frase(r, true)).join('; ')}`
}

/** Los anuncios de todos los recibos de un mensaje que terminó, en una línea (5.3). */
export function anunciosMensaje(msg, hoy) {
  return armarRecibos(msg).map(r => {
    if (r.tipo === 'cambios') return anuncioRecibo(r.cambios, hoy)
    if (r.tipo === 'error') return anuncioRecibo([r.cambio], hoy)
    if (r.tipo === 'nollego') return 'Un cambio no llegó a Avis'
    return ''
  }).filter(Boolean).map(t => (/[.!?]$/.test(t) ? t : `${t}.`)).join(' ')
}

/**
 * Las pistas del movimiento de los recibos (10), en ms y px: las corre recibosMotion.js con anime.js.
 * Con movimiento reducido, todo es un fundido de 160 ms (`FUNDIDO_MS` de chat.js); en pausa, nada.
 */
export const PISTAS_RECIBO = Object.freeze({
  llega: Object.freeze({ dura: 600, sube: 10, escala: 0.96, curva: 'outBack(1.6)' }),
  sello: Object.freeze({ en: 100, dura: 900 }),
  tilde: Object.freeze({ en: 250, dura: 500, trazo: 14 }),
  fila: Object.freeze({ dura: 420, sube: 8, escalon: 70, curva: 'outExpo' }),
  deshacer: Object.freeze({ raya: 400, estado: 300, opacidad: 0.45 }),
  error: Object.freeze({ dura: 420, sube: 10, curva: 'outExpo' }),
  lectura: Object.freeze({ dura: 360, escalon: 50, sube: 8, curva: 'outQuart' }),
  globo: Object.freeze({ dura: 220, baja: 6, curva: 'outQuart' }),
})

/**
 * ¿Lo único nuevo en el mensaje son cambios agregados al final? (11.11): `{ nuevos }` con los que
 * llegaron (puede ser vacío); si algo cambió de otra forma (un estado, el orden, menos), null y
 * pintarHilo redibuja los recibos de ese mensaje.
 */
export function diferenciaRecibos(antes, ahora) {
  const a = cambiosDe(antes)
  const b = cambiosDe(ahora)
  if (b.length < a.length) return null
  for (let i = 0; i < a.length; i++) if (a[i].id !== b[i].id || a[i].estado !== b[i].estado) return null
  return { nuevos: b.slice(a.length) }
}
