// Movimiento del menú de módulos (#42, docs/diseno/modulos-ux.md 10) con anime.js v4: la píldora ámbar
// que viaja a la fila abierta, `#aviso-p` que baja al llegar una pregunta y el chip «1 ?» de Sesiones que
// late dos veces (el latido es CSS, `.late`, bajo `prefers-reduced-motion: no-preference` y
// `body:not(.pausa)`). Abrir una hoja usa su propio acto (`tareasMotion.abrirHoja`, `configuracionMotion`);
// volver a Sesiones, el de siempre (`configuracionMotion.cerrarHoja`). Solo `transform` y `opacity`.
// Con movimiento reducido la píldora salta y `#aviso-p` aparece con un fundido de 160 ms; con "Pausar
// animaciones", todo al instante (`modoMovimiento` de chat.js).

import { animate } from './vendor/animejs/anime.esm.min.js'
import { modoMovimiento } from './chat.js'

const FUNDIDO_MS = 160

/** `completo`, `fundido` (movimiento reducido) o `nada` (pausa). */
export function modo() {
  const reducido = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return modoMovimiento({ reducido, pausa: document.body.classList.contains('pausa') })
}

/** El viaje en curso de la píldora: mientras dura, el redibujo no la mueve. */
let viaje = null

const pildora = nav => nav?.querySelector(':scope > .ind-mod')
/** La fila abierta del grupo de arriba (Configuración está aparte: con ella abierta no hay ninguna). */
const filaAbierta = nav => nav?.querySelector(':scope > .mod[aria-current="page"]')
const enY = y => `translateY(${y}px)`

/** Dónde está ahora la píldora (su `transform`), para viajar desde ahí después de cambiar de módulo. */
export function posicionPildora(nav) {
  return pildora(nav)?.style.transform ?? ''
}

/**
 * La píldora sobre la fila abierta, sin viaje (cada redibujo: el alto de la barra puede cambiar con el
 * zoom). Sin fila abierta en el grupo (Configuración) queda donde estaba; el CSS la apaga.
 */
export function colocarPildora(nav) {
  const ind = pildora(nav)
  const fila = filaAbierta(nav)
  if (!ind || !fila || viaje) return
  const t = enY(fila.offsetTop)
  if (ind.style.transform !== t) ind.style.transform = t
}

/**
 * Cambiar de módulo (10): la píldora viaja desde `desde` (lo que dio `posicionPildora` antes del cambio)
 * hasta la fila nueva, 380 ms `outBack(1.3)`. Reducido o en pausa, salta.
 */
export function viajarPildora(nav, desde) {
  const ind = pildora(nav)
  const fila = filaAbierta(nav)
  if (!ind || !fila) return
  viaje?.cancel()
  viaje = null
  const y = fila.offsetTop
  if (modo() !== 'completo' || !desde || desde === enY(y)) { ind.style.transform = enY(y); return }
  ind.style.transform = desde
  const a = animate(ind, { translateY: y, duration: 380, ease: 'outBack(1.3)', onComplete: () => { if (viaje === a) viaje = null } })
  viaje = a
}

/**
 * Llega una pregunta (10): `#aviso-p` baja 12 px desde arriba y crece de .96, 460 ms `outBack(1.5)`.
 * Reducido, un fundido de 160 ms; en pausa, nada.
 */
export function llegaAviso(boton) {
  if (!boton) return
  const m = modo()
  if (m === 'nada') return
  if (m === 'fundido') { animate(boton, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' }); return }
  animate(boton, { opacity: [0, 1], translateY: [-12, 0], scale: [0.96, 1], duration: 460, ease: 'outBack(1.5)' })
}

/** El chip «1 ?» de Sesiones late dos veces al llegar una pregunta (4.2): solo con movimiento completo. */
export function latirPregunta(chip) {
  if (!chip || modo() !== 'completo') return
  chip.classList.remove('late')
  void chip.offsetWidth
  chip.classList.add('late')
}
