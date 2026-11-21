// Movimiento del globo de "¿En qué anda Claude?" (docs/diseno/resumen-ia-ux.md 9): nace de la cola,
// los bloques de adentro entran en cascada, las palabras del resumen salen una tras otra, el globo se
// cierra hacia la cola y lo de abajo (#pp, conteos, sesiones) se acomoda con FLIP en vez de animar
// el alto. Sin dependencias: Web Animations, solo transform y opacity. Una animación por vez: cada
// paso termina (`finish()`) lo anterior. Con movimiento reducido, "Pausar animaciones" o `quieto`
// (arrastre, cambio de forma, panel que no se ve) todo pasa al instante.

import { hayMovimiento } from './tableroMotion.js'

const EASE = 'cubic-bezier(.16,1,.3,1)'
const EASE_CIERRA = 'cubic-bezier(.5,0,.75,0)'
const REBOTE = 'cubic-bezier(.34,1.56,.64,1)'
/** Tiempos de 9.1 (los mismos que los tokens --d-nace, --d-contenido, --d-escalon-c y --d-palabra). */
export const TIEMPOS_RESUMEN = Object.freeze({ nace: 480, contenido: 380, escalon: 45, palabra: 420, cadaPalabra: 18, topePalabras: 900, flip: 340, cierra: 200 })
const T = TIEMPOS_RESUMEN

/** Las animaciones en curso, para terminarlas de una. */
let vivas = new Set()

function animar(el, cuadros, opciones) {
  const a = el.animate(cuadros, opciones)
  vivas.add(a)
  const fuera = () => vivas.delete(a)
  a.addEventListener('finish', fuera)
  a.addEventListener('cancel', fuera)
  return a
}

const mover = quieto => !quieto && hayMovimiento()

/** Termina al instante todo lo que se mueve (estado nuevo, panel plegado, ventana escondida). */
export function terminar() {
  for (const a of [...vivas]) {
    try { a.finish() } catch { a.cancel() }
  }
  vivas = new Set()
}

/** Los bloques de adentro entran en cascada: opacidad y 5 px hacia arriba, 45 ms entre uno y otro. */
function cascada(globo) {
  const bloques = [...globo.querySelectorAll('.rz-c > *')].filter(b => !b.hidden)
  bloques.forEach((b, i) => animar(b, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], {
    duration: T.contenido, delay: i * T.escalon, easing: EASE, fill: 'backwards',
  }))
}

/** Lo de abajo viene desde donde estaba (`delta` px más arriba o más abajo) hasta su lugar. */
export function flip(hermanos, delta, { quieto = false } = {}) {
  if (!delta || !mover(quieto)) return
  for (const h of hermanos) {
    animar(h, [{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: T.flip, easing: EASE })
  }
}

/** Nace de la cola (sin cola, desde arriba): opacidad y escala .9 → 1 con rebote, y la cascada de adentro. */
export function nace(globo, { quieto = false } = {}) {
  terminar()
  if (!globo || !mover(quieto)) return
  animar(globo, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: T.nace, easing: REBOTE })
  cascada(globo)
}

/** Cambio de estado: el contenido nuevo entra en cascada y lo de abajo se acomoda con FLIP. */
export function cambia(globo, hermanos, delta, { quieto = false } = {}) {
  if (!globo || !mover(quieto)) return
  cascada(globo)
  flip(hermanos, delta, { quieto })
}

/** Las palabras del resumen salen de a una: 18 ms entre palabras, el retraso topado en 900 ms. */
export function palabras(globo, { quieto = false } = {}) {
  if (!globo || !mover(quieto)) return
  globo.querySelectorAll('.rz-texto .w').forEach((w, i) => animar(w, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], {
    duration: T.palabra, delay: Math.min(i * T.cadaPalabra, T.topePalabras), easing: EASE, fill: 'backwards',
  }))
}

/** Un bloque que aparece solo (el aviso "Cambió algo"): entra como los de la cascada. */
export function entra(el, { quieto = false } = {}) {
  if (!el || !mover(quieto)) return
  animar(el, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: T.contenido, easing: EASE })
}

/** Se cierra hacia la cola (opacidad y escala .96, 200 ms). La promesa se cumple al terminar. */
export function cierra(globo, { quieto = false } = {}) {
  terminar()
  if (!globo || !mover(quieto)) return Promise.resolve()
  const a = animar(globo, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: T.cierra, easing: EASE_CIERRA, fill: 'forwards' })
  return a.finished.then(() => {}, () => {})
}
