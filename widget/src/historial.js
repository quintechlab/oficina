// "Qué hizo" (#25): los últimos turnos de una sesión, para decidir si se puede cerrar. Lógica pura:
// las entradas `{ rol: 'usuario' | 'claude', texto, cuando }` las lee historial.rs de la transcripción
// de Claude Code (solo lectura); acá se limpian, se agrupan en turnos y se recortan.
import { tiempoRelativo } from './logica.js'

/** Los turnos que se muestran: lo último que pidió el usuario y lo que respondió Claude. */
export const MAX_TURNOS = 6
/** Largo de cada texto en el detalle (caracteres; el CSS además lo limita a unas líneas). */
export const LARGO_PEDIDO = 220
export const LARGO_RESPUESTA = 360

/**
 * Un bloque `<etiqueta …>…</etiqueta>` que Claude Code pega al pedido (`system-reminder`,
 * `widget_context_…`, `ide_opened_file`): sus nombres llevan `-` o `_`, así un `<b>` que escribió el
 * usuario queda.
 */
const BLOQUE = /<([a-z][a-z0-9]*[-_][\w-]*)\b[^>]*>[\s\S]*?<\/\1>/gi

/**
 * El texto que escribió el usuario, o null si no es suyo: lo que empieza con una etiqueta (avisos de
 * tareas, comandos, recordatorios) o la marca de un turno interrumpido. Los bloques con etiqueta que
 * vienen pegados al pedido se sacan.
 */
export function limpiarPedido(texto) {
  const t = String(texto ?? '').trim()
  if (!t || t.startsWith('<') || t.startsWith('[Request interrupted')) return null
  const limpio = t.replace(BLOQUE, '').trim()
  return limpio || null
}

/** Una sola línea sin marcas de markdown, cortada en una palabra con "…" si pasa de `max`. */
export function recortar(texto, max) {
  const t = String(texto ?? '').replace(/\*\*|__|`/g, '').replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const corte = t.slice(0, max)
  const espacio = corte.lastIndexOf(' ')
  return `${(espacio > max / 2 ? corte.slice(0, espacio) : corte).trimEnd()}…`
}

/**
 * Los turnos de la conversación, del más viejo al más nuevo (los últimos `max`): cada pedido del
 * usuario con la última respuesta de Claude antes del pedido siguiente (la final, no el "voy a…").
 * Lo que Claude dijo antes del primer pedido visible es un turno sin pedido; un pedido que todavía no
 * tiene respuesta, uno sin respuesta.
 */
export function turnos(entradas, max = MAX_TURNOS) {
  const lista = []
  for (const e of entradas ?? []) {
    if (e?.rol === 'usuario') {
      const pedido = limpiarPedido(e.texto)
      if (pedido) lista.push({ pedido: recortar(pedido, LARGO_PEDIDO), respuesta: null, cuando: e.cuando ?? null })
    } else if (e?.rol === 'claude' && String(e.texto ?? '').trim()) {
      const respuesta = recortar(e.texto, LARGO_RESPUESTA)
      const ultimo = lista.at(-1)
      if (ultimo) ultimo.respuesta = respuesta
      else lista.push({ pedido: null, respuesta, cuando: e.cuando ?? null })
    }
  }
  return lista.slice(-max)
}

/** Cada cuánto se relee la transcripción mientras el detalle está abierto (main.js). */
export const MS_RELEER = 10000

// El error dice qué pasa después: se reintenta solo (D-d de cerrar-sesion-ux.md)
const TEXTO = {
  cargando: 'Leyendo la conversación…',
  error: `No se pudo leer la conversación · vuelvo a probar en ${MS_RELEER / 1000} s`,
  vacio: 'Todavía no hay conversación',
}

/**
 * Lo que muestra el detalle. `h`: `{ estado: 'cargando' }`, `{ estado: 'error', error }` o
 * `{ estado: 'listo', entradas }`. Los turnos van del más nuevo al más viejo, como los pasos de un
 * subagente, con hace cuánto empezó cada uno.
 */
export function vistaHistorial(h, ahoraMs) {
  if (h?.estado === 'cargando' || h?.estado === 'error') return { estado: h.estado, texto: TEXTO[h.estado], turnos: [] }
  const lista = turnos(h?.entradas)
  if (!lista.length) return { estado: 'vacio', texto: TEXTO.vacio, turnos: [] }
  return {
    estado: 'listo',
    texto: null,
    turnos: lista.reverse().map(t => ({ pedido: t.pedido, respuesta: t.respuesta, hace: t.cuando ? `hace ${tiempoRelativo(t.cuando, ahoraMs)}` : '' })),
  }
}

/** La firma de lo que se ve: cambia con el estado y los textos, no con la hora. */
export function firmaHistorial(h) {
  if (!h) return ''
  const v = vistaHistorial(h, 0)
  return `!${h.sesion}|${v.estado}|${v.turnos.map(t => `${t.pedido ?? ''}>${t.respuesta ?? ''}`).join('/')}`
}
