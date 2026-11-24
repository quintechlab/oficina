// Movimiento de la configuración (#23, docs/diseno/configuracion-ux.md 8): el acto de abrir la hoja,
// el indicador de la pestaña y el cambio de pestaña, con anime.js v4. Hover, interruptores y foco
// son CSS (estilos.css). Solo `transform` y `opacity` (el ancho del indicador, de 2 px, es la única
// excepción). Con movimiento reducido o "Pausar animaciones": sin desplazamientos, un fundido de 150 ms.

import { animate, stagger } from './vendor/animejs/anime.esm.min.js'
import { hayMovimiento } from './tableroMotion.js'

const FUNDIDO_MS = 150

/** El fundido corto que reemplaza a todo con movimiento reducido o pausa. */
function fundido(objetivos) {
  if (!objetivos || (objetivos.length === 0)) return
  animate(objetivos, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' })
}

/**
 * Abrir (el acto de la pantalla, 8): encabezado y pestañas suben 8 px escalonados 55 ms; las filas
 * de la pestaña, 10 px escalonadas 35 ms desde los 120.
 */
export function abrirHoja(cabecera, pestanas, contenido) {
  const filas = contenido ? [...contenido.children] : []
  if (!hayMovimiento()) { fundido([cabecera, pestanas, ...filas].filter(Boolean)); return }
  animate([cabecera, pestanas].filter(Boolean), { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(55), ease: 'outQuart' })
  if (filas.length) animate(filas, { opacity: [0, 1], translateY: [10, 0], duration: 460, delay: stagger(35, { start: 120 }), ease: 'outQuart' })
}

/**
 * Lleva el indicador (`.ind`) debajo de la pestaña elegida: 8 px adentro de cada lado. Con
 * `animado`, viaja 320 ms; sin movimiento, salta.
 */
export function colocarIndicador(lista, animado) {
  const ind = lista?.querySelector('.ind')
  const t = lista?.querySelector('[role="tab"][aria-selected="true"]')
  if (!ind || !t || !t.offsetWidth) return
  const destino = { translateX: t.offsetLeft + 8, width: Math.max(0, t.offsetWidth - 16) }
  if (animado && hayMovimiento()) {
    animate(ind, { ...destino, duration: 320, ease: 'outQuart' })
  } else {
    ind.style.transform = `translateX(${destino.translateX}px)`
    ind.style.width = `${destino.width}px`
  }
}

/** Cambiar de pestaña (8): el contenido entra 14 px desde el lado de la nueva, escalonado 28 ms. */
export function cambioPestana(contenido, direccion) {
  const filas = contenido ? [...contenido.children] : []
  if (!filas.length) return
  if (!hayMovimiento()) { fundido(filas); return }
  animate(filas, { opacity: [0, 1], translateX: [Math.sign(direccion || 1) * 14, 0], duration: 260, delay: stagger(28), ease: 'outQuart' })
}

/** Cerrar: lo del tablero vuelve subiendo 6 px, escalonado 50 ms (fundido sin movimiento). */
export function cerrarHoja(piezas) {
  const lista = [...(piezas ?? [])].filter(Boolean)
  if (!lista.length) return
  if (!hayMovimiento()) { fundido(lista); return }
  animate(lista, { opacity: [0, 1], translateY: [6, 0], duration: 320, delay: stagger(50), ease: 'outQuart' })
}
