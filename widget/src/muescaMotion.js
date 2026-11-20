// Movimiento de la muesca (docs/diseno/estilo-avis-ux.md, 6.4): abrir, cerrar, plegar el tablero al
// acoplarlo y el golpe de la pregunta. El recorte usa la Web Animations API del WebView (sin
// dependencias); el golpe y el imán son clases de CSS (estilos.css). Con movimiento reducido o
// "Pausar animaciones" todo pasa al instante y no hay golpe (6.5).

import { hayMovimiento } from './tableroMotion.js'

export const ABRE_MS = 560
export const CIERRA_MS = 360
const APAGA_MS = 120
const GOLPE_MS = 1100
const EASE = 'cubic-bezier(.16, 1, .3, 1)'
const EASE_CIERRA = 'cubic-bezier(.5, 0, .75, 0)'

const fin = anim => anim.finished.catch(() => {})

/**
 * Abre: el recorte del tablero va de la muesca (`desde`) al panel entero (`hasta`) en 560 ms. La
 * muesca queda encima hasta que el recorte la supera y recién ahí se oculta (7.4).
 */
export async function abrir(marco, desde, hasta) {
  const cuerpo = document.body
  if (!hayMovimiento()) { cuerpo.classList.add('muesca-oculta'); return }
  const anim = marco.animate([{ clipPath: desde }, { clipPath: hasta }], { duration: ABRE_MS, easing: EASE })
  const ocultar = setTimeout(() => cuerpo.classList.add('muesca-oculta'), ABRE_MS * 0.25)
  await fin(anim)
  clearTimeout(ocultar)
  cuerpo.classList.add('muesca-oculta')
}

/**
 * Cierra: el contenido se apaga en los primeros 120 ms y el recorte vuelve a la muesca en 360 ms.
 * La muesca vuelve a verse antes de que termine. Devuelve con qué soltar el último cuadro, para
 * llamarlo recién cuando el tablero ya no se ve (si no, parpadea el panel entero).
 */
export async function cerrar(marco, contenido, desde, hasta) {
  const cuerpo = document.body
  if (!hayMovimiento()) { cuerpo.classList.remove('muesca-oculta'); return () => {} }
  const apaga = contenido.animate([{ opacity: 1 }, { opacity: 0 }], { duration: APAGA_MS, fill: 'forwards' })
  const anim = marco.animate([{ clipPath: hasta }, { clipPath: desde }], { duration: CIERRA_MS, easing: EASE_CIERRA, fill: 'forwards' })
  const mostrar = setTimeout(() => cuerpo.classList.remove('muesca-oculta'), CIERRA_MS * 0.7)
  await fin(anim)
  clearTimeout(mostrar)
  cuerpo.classList.remove('muesca-oculta')
  return () => { apaga.cancel(); anim.cancel() }
}

/**
 * Al soltar el tablero flotante junto a un borde, se pliega hacia ese lado (`recorte`: el
 * `inset(...)` final) en 360 ms antes de volverse muesca (6.4).
 */
export async function plegar(marco, recorte) {
  if (!hayMovimiento()) return () => {}
  const anim = marco.animate([{ clipPath: 'inset(0px 0px 0px 0px round 30px)' }, { clipPath: recorte, opacity: 0.4 }], { duration: CIERRA_MS, easing: EASE_CIERRA, fill: 'forwards' })
  await fin(anim)
  return () => anim.cancel()
}

/**
 * Golpe (6.4): la muesca se corre 6 px hacia el centro y vuelve, el Avi salta, la luz sube y el
 * chip late, una sola vez. Solo llama la atención: no abre ni responde nada.
 */
export function golpe() {
  if (!hayMovimiento()) return
  const cuerpo = document.body
  cuerpo.classList.remove('golpe')
  void cuerpo.offsetWidth
  cuerpo.classList.add('golpe')
  setTimeout(() => cuerpo.classList.remove('golpe'), GOLPE_MS)
}
