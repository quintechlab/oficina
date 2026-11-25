// Movimiento de Hábitos (#41, docs/diseno/habitos-ux.md 10) con anime.js v4: abrir la hoja, cambiar de
// vista y abrir un hábito, las chispas del tilde, la gota y la onda del vaso, la píldora del hito y el
// día completo. El círculo del tilde, el visto, el tramo nuevo del anillo, el número que rueda, la celda
// que salta, la brasa que crece y titila, la franja de hoy, la fila nueva, el arco de la fila del menú y
// el anillo que late son CSS (estilos.css, bajo #hab y .mod.hab). Solo `transform` y `opacity`. Con
// movimiento reducido: sin desplazamientos, escalas, chispas, gotas ni ondas; la hoja, las vistas y la
// píldora aparecen con un fundido de 160 ms. Con "Pausar animaciones", todo al instante. La mascota
// que salta y el chip que late son los de Tareas (`tareasMotion.salto`, `tareasMotion.latirChip`).

import { animate, stagger } from './vendor/animejs/anime.esm.min.js'
import { modo } from './tareasMotion.js'

export { modo }
export { salto, latirChip } from './tareasMotion.js'

const FUNDIDO_MS = 160
const lista = piezas => [...(piezas ?? [])].filter(Boolean)

/** Sin movimiento, el fundido (reducido) o nada (pausa). Devuelve si ya se encargó. */
function quieto(piezas) {
  const m = modo()
  if (m === 'completo') return false
  if (m === 'fundido' && piezas.length) animate(piezas, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' })
  return true
}

/**
 * Abrir el módulo (10): el encabezado y la carpeta suben 8 px escalonados 55 ms (420 ms); el índice y
 * las filas, 10 px escalonados 32 ms desde los 140 (460 ms).
 */
export function abrirHoja(cabecera, cuerpo) {
  const bloques = lista([cabecera, cuerpo])
  const piezas = lista(cuerpo?.querySelectorAll('.idx > *, [data-parte="cuerpo"] .fila, [data-parte="cuerpo"] .mat-r, .vac, .primer > *'))
  if (quieto(bloques)) return
  animate(bloques, { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(55), ease: 'outQuart' })
  if (piezas.length) animate(piezas, { opacity: [0, 1], translateY: [10, 0], duration: 460, delay: stagger(32, { start: 140 }), ease: 'outQuart' })
}

/** Cambiar de vista o abrir un hábito (10): el encabezado del panel, el error y lo de la vista entran 10 px desde la derecha, escalonados 28 ms. */
export function cambioVista(pane) {
  const piezas = lista(pane?.querySelectorAll('[data-parte="pane-h"] > *, [data-parte="err"] > *, [data-parte="cuerpo"] > *, [data-parte="cuerpo"] > .det > *'))
  if (quieto(piezas)) return
  animate(piezas, { opacity: [0, 1], translateX: [10, 0], duration: 300, delay: stagger(28), ease: 'outQuart' })
}

/**
 * Al tildar o llegar a la meta (10): ocho chispas salen del centro del control a 17 y 24 px, alternando
 * el color del hábito (`--c` de la fila) y el ámbar, de `scale 1.2` a `.3`. Sin movimiento, nada.
 */
export function chispas(control) {
  if (!control || modo() !== 'completo') return
  const ps = Array.from({ length: 8 }, () => {
    const i = document.createElement('i')
    i.className = 'chispa'
    i.setAttribute('aria-hidden', 'true')
    control.appendChild(i)
    return i
  })
  animate(ps, {
    translateX: (_, i) => Math.cos((i / 8) * Math.PI * 2 + 0.3) * (17 + (i % 2) * 7),
    translateY: (_, i) => Math.sin((i / 8) * Math.PI * 2 + 0.3) * (17 + (i % 2) * 7),
    opacity: [1, 0], scale: [1.2, 0.3], duration: 600, ease: 'outQuart',
    onComplete: () => ps.forEach(p => p.remove()),
  })
}

/**
 * Sumar un vaso (10): una gota del color del hábito cae desde 22 px al centro del anillo (`scaleY 1.3 → .7`,
 * 340 ms `inQuad`) y deja una onda que se abre de .35 a 1.4 (520 ms `outQuart` desde los 300). Sin movimiento, nada.
 */
export function gota(sumador) {
  if (!sumador || modo() !== 'completo') return
  const g = document.createElement('i')
  g.className = 'gota'
  const o = document.createElement('i')
  o.className = 'onda'
  for (const el of [g, o]) { el.setAttribute('aria-hidden', 'true'); sumador.appendChild(el) }
  animate(g, { translateY: [-22, 0], opacity: [0, 1, 0], scaleY: [1.3, 0.7], duration: 340, ease: 'inQuad' })
  animate(o, { scale: [0.35, 1.4], opacity: [0.8, 0], duration: 520, delay: 300, ease: 'outQuart', onComplete: () => { g.remove(); o.remove() } })
}

/**
 * La píldora del hito (4.14): entra 12 px desde arriba con `scale .8 → 1` (560 ms `outBack(1.8)`), queda
 * 2,2 s y se va 6 px hacia arriba (300 ms `inQuad`). Reducido: un fundido; en pausa, aparece y se va.
 */
export function hito(contenedor, html) {
  if (!contenedor) return
  const plantilla = document.createElement('template')
  plantilla.innerHTML = html
  const el = plantilla.content.firstElementChild
  if (!el) return
  contenedor.appendChild(el)
  const m = modo()
  if (m !== 'completo') {
    if (m === 'fundido') animate(el, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' })
    setTimeout(() => el.remove(), 2400)
    return
  }
  // La salida empieza al terminar la entrada (dos animaciones de las mismas propiedades a la vez se pisan)
  const sale = () => animate(el, { opacity: [1, 0], translateY: [0, -6], duration: 300, ease: 'inQuad', onComplete: () => el.remove() })
  animate(el, { opacity: [0, 1], translateY: [-12, 0], scale: [0.8, 1], duration: 560, ease: 'outBack(1.8)', onComplete: () => setTimeout(sale, 1640) })
}

/**
 * Día completo (10): en Semana la franja de hoy se enciende fila por fila (CSS `.completo` en `.mat`,
 * escalonada 70 ms); en Hoy la barra destella (`.destella`). Se sacan al terminar para poder repetirlo.
 */
export function diaCompleto(raiz) {
  if (!raiz || modo() !== 'completo') return
  for (const el of lista(raiz.querySelectorAll('.mat, .pane-s .prog'))) {
    const clase = el.classList.contains('prog') ? 'destella' : 'completo'
    el.classList.remove(clase)
    void el.offsetWidth
    el.classList.add(clase)
    setTimeout(() => el.classList.remove(clase), 1600)
  }
}
