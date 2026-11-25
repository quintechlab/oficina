// Movimiento de Tareas (#39, docs/diseno/tareas-ux.md 10) con anime.js v4: abrir la hoja, cambiar de
// vista, las chispas y el salto de la mascota al tildar, el pliegue de la fila tildada, la fila que se
// agrega y "Hechas" que se despliega. El círculo, el visto, el tachado, el destello, el hover, el chip
// que late y la confirmación son CSS (estilos.css, bajo #tar). Solo `transform` y `opacity`, salvo el
// alto de la fila que se pliega. Con movimiento reducido: sin desplazamientos, escalas ni chispas, un
// fundido de 160 ms; con "Pausar animaciones", todo al instante (`modoMovimiento` de chat.js).

import { animate, stagger } from './vendor/animejs/anime.esm.min.js'
import { modoMovimiento } from './chat.js'

const FUNDIDO_MS = 160

/** `completo`, `fundido` (movimiento reducido) o `nada` (pausa). */
export function modo() {
  const reducido = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return modoMovimiento({ reducido, pausa: document.body.classList.contains('pausa') })
}

const lista = piezas => [...(piezas ?? [])].filter(Boolean)

/** Sin movimiento, el fundido (reducido) o nada (pausa). Devuelve si ya se encargó. */
function quieto(piezas) {
  const m = modo()
  if (m === 'completo') return false
  if (m === 'fundido' && piezas.length) animate(piezas, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' })
  return true
}

/**
 * Abrir la hoja (10): el encabezado y el cuerpo suben 8 px escalonados 55 ms; los botones del índice y
 * las filas, 10 px escalonados 30 ms desde los 140.
 */
export function abrirHoja(cabecera, cuerpo) {
  const bloques = lista([cabecera, cuerpo])
  const piezas = lista(cuerpo?.querySelectorAll('.idx > *, [data-parte="lista"] .fila, .vac, .primer > *'))
  if (quieto(bloques)) return
  animate(bloques, { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(55), ease: 'outQuart' })
  if (piezas.length) animate(piezas, { opacity: [0, 1], translateY: [10, 0], duration: 460, delay: stagger(30, { start: 140 }), ease: 'outQuart' })
}

/** Cambiar de vista (10): el encabezado del panel, el campo y las filas entran 8 px desde la derecha. */
export function cambioVista(pane) {
  const piezas = lista(pane?.querySelectorAll('.pane-h, [data-parte="err"] > *, [data-parte="nuevo"] > *, [data-parte="lista"] > *'))
  if (quieto(piezas)) return
  animate(piezas, { opacity: [0, 1], translateX: [8, 0], duration: 280, delay: stagger(26), ease: 'outQuart' })
}

/**
 * Al tildar (10): seis chispas salen del centro del tilde a 16 y 22 px, alternando el color de la
 * lista (`--c` de la fila) y el ámbar, y se apagan. Sin movimiento, nada.
 */
export function chispas(fila) {
  if (!fila || modo() !== 'completo') return
  const ps = Array.from({ length: 6 }, () => {
    const i = document.createElement('i')
    i.className = 'chispa'
    i.setAttribute('aria-hidden', 'true')
    fila.appendChild(i)
    return i
  })
  animate(ps, {
    translateX: (_, i) => Math.cos((i / 6) * Math.PI * 2 + 0.4) * (16 + (i % 2) * 6),
    translateY: (_, i) => Math.sin((i / 6) * Math.PI * 2 + 0.4) * (16 + (i % 2) * 6),
    opacity: [1, 0], scale: [1.2, 0.3], duration: 560, ease: 'outQuart',
    onComplete: () => ps.forEach(p => p.remove()),
  })
}

/** La mascota de 40 festeja: salta 6 px (la pose `feliz` la pone main.js). */
export function salto(mini) {
  if (!mini || modo() !== 'completo') return
  animate(mini, { translateY: [0, -6, 0], duration: 420, ease: 'outQuad' })
}

/** La fila tildada baja su alto a 0 y se apaga (300 ms); se resuelve al terminar. */
export function plegarFila(fila) {
  return new Promise(resolver => {
    if (!fila?.isConnected) { resolver(); return }
    fila.style.overflow = 'hidden'
    animate(fila, { height: [fila.offsetHeight, 0], opacity: [1, 0], duration: 300, ease: 'inOutQuad', onComplete: () => resolver() })
  })
}

/** La fila recién agregada baja 6 px y aparece (el destello ámbar es CSS, `.recien`). */
export function entraFila(fila) {
  if (!fila) return
  if (quieto([fila])) return
  animate(fila, { opacity: [0, 1], translateY: [-6, 0], duration: 360, ease: 'outBack(1.4)' })
}

/** "Hechas" que se despliega: sus filas bajan 4 px hasta .85, escalonadas 30 ms. */
export function abrirHechas(filas) {
  const ps = lista(filas)
  if (!ps.length || modo() !== 'completo') return
  animate(ps, { opacity: [0, 0.85], translateY: [-4, 0], duration: 260, delay: stagger(30), ease: 'outQuart' })
}

/** El chip de la barra late cuando cambia la cuenta (CSS `.late`): se vuelve a poner para repetirlo. */
export function latirChip(chip) {
  if (!chip || modo() !== 'completo') return
  chip.classList.remove('late')
  void chip.offsetWidth
  chip.classList.add('late')
}
