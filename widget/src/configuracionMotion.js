// Movimiento de la configuración (#23, docs/diseno/configuracion-ux.md 8): el acto de abrir la hoja,
// el indicador de la pestaña, el cambio de pestaña y la mascota (elegir una especie y su vista previa),
// con anime.js v4. Hover, interruptores, foco y la luz del escenario son CSS (estilos.css). Solo
// `transform` y `opacity` (el ancho del indicador, de 2 px, es la única excepción). Con movimiento reducido o "Pausar animaciones": sin desplazamientos, un fundido de 150 ms.

import { animate, stagger } from './vendor/animejs/anime.esm.min.js'
import { hayMovimiento } from './tableroMotion.js'
import { evolucionar, devolver, formaAlInstante } from './evolucionMotion.js'
import { modoVistaPrevia } from './configuracion.js'

const FUNDIDO_MS = 150

/** El fundido corto que reemplaza a todo con movimiento reducido o pausa. */
function fundido(objetivos) {
  if (!objetivos || (objetivos.length === 0)) return
  animate(objetivos, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' })
}

/**
 * Abrir (el acto de la pantalla, 8): encabezado y pestañas suben 8 px escalonados 55 ms; las filas
 * de la pestaña, 10 px escalonadas 35 ms desde los 120. En Mascota, además, las fichas crecen de .9
 * escalonadas 30 ms desde los 220 y el Avi del escenario sube 18 px desde los 160.
 */
export function abrirHoja(cabecera, pestanas, contenido) {
  const filas = contenido ? [...contenido.children] : []
  if (!hayMovimiento()) { fundido([cabecera, pestanas, ...filas].filter(Boolean)); return }
  animate([cabecera, pestanas].filter(Boolean), { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(55), ease: 'outQuart' })
  if (filas.length) animate(filas, { opacity: [0, 1], translateY: [10, 0], duration: 460, delay: stagger(35, { start: 120 }), ease: 'outQuart' })
  const fichas = contenido?.querySelectorAll('.esp')
  if (fichas?.length) animate(fichas, { opacity: [0, 1], scale: [0.9, 1], duration: 420, delay: stagger(30, { start: 220 }), ease: 'outBack(1.4)' })
  const fig = contenido?.querySelector('.esc-fig > .avi')
  if (fig) animate(fig, { opacity: [0, 1], translateY: [18, 0], duration: 620, delay: 160, ease: 'outBack(1.6)' })
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

/**
 * Cambiar de pestaña (8): el contenido entra 14 px desde el lado de la nueva, escalonado 28 ms. Al
 * salir de Mascota, el Avi de 40 aparece junto al título (`mini`, de .3); al volver, el del escenario
 * sube 16 px.
 */
export function cambioPestana(contenido, direccion, { mini = null } = {}) {
  const filas = contenido ? [...contenido.children] : []
  if (!filas.length) return
  if (!hayMovimiento()) { fundido([...filas, mini].filter(Boolean)); return }
  animate(filas, { opacity: [0, 1], translateX: [Math.sign(direccion || 1) * 14, 0], duration: 260, delay: stagger(28), ease: 'outQuart' })
  if (mini) animate(mini, { opacity: [0, 1], scale: [0.3, 1], duration: 480, ease: 'outBack(1.8)' })
  const fig = contenido.querySelector('.esc-fig > .avi')
  if (fig) animate(fig, { translateY: [16, 0], scale: [0.8, 1], duration: 520, ease: 'outBack(1.6)' })
}

/** Cerrar: lo del tablero vuelve subiendo 6 px, escalonado 50 ms (fundido sin movimiento). */
export function cerrarHoja(piezas) {
  const lista = [...(piezas ?? [])].filter(Boolean)
  if (!lista.length) return
  if (!hayMovimiento()) { fundido(lista); return }
  animate(lista, { opacity: [0, 1], translateY: [6, 0], duration: 320, delay: stagger(50), ease: 'outQuart' })
}

/**
 * Elegir una especie (8): el Avi nuevo del escenario nace de .55 y sube 14 px, los textos entran 10 px
 * escalonados 40 ms y la marca de la barra rebota de .7. La luz (`--cc`) cambia sola por CSS. Sin
 * movimiento, un fundido del Avi nuevo.
 */
export function elegirEspecie({ figura = null, textos = [], marca = null } = {}) {
  if (!hayMovimiento()) { fundido([figura].filter(Boolean)); return }
  if (figura) animate(figura, { opacity: [0, 1], scale: [0.55, 1], translateY: [14, 0], duration: 560, ease: 'outBack(1.7)' })
  if (textos.length) animate(textos, { opacity: [0, 1], translateX: [10, 0], duration: 300, delay: stagger(40), ease: 'outQuart' })
  if (marca) animate(marca, { scale: [0.7, 1], duration: 520, ease: 'outBack(1.8)' })
}

/**
 * Cambia la forma de la vista previa (8): el acto real de la especie (`evolucionar`, con el
 * escenario como contenedor del temblor de Morro, o `devolver`); con movimiento reducido o pausa, al instante.
 */
export function vistaPrevia(svg, especie, forma, contenedor) {
  if (!svg) return
  const reducido = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const pausa = document.body.classList.contains('pausa')
  const modo = modoVistaPrevia(forma, { reducido, pausa })
  if (modo === 'evolucionar') evolucionar(svg, especie, { contenedor })
  else if (modo === 'devolver') devolver(svg, especie)
  else formaAlInstante(svg, forma === 'evo')
}
