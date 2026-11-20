// Movimiento de la muesca (docs/diseno/estilo-avis-ux.md, 6.4): abrir, cerrar, plegar el tablero al
// acoplarlo y el golpe de la pregunta. El recorte usa la Web Animations API del WebView (sin
// dependencias); el golpe y el imán son clases de CSS (estilos.css). Con movimiento reducido o
// "Pausar animaciones" todo pasa al instante y no hay golpe (6.5).

import { hayMovimiento } from './tableroMotion.js'

export const ABRE_MS = 720
export const CIERRA_MS = 480
const APAGA_MS = 120
const PLIEGA_MS = 360
const GOLPE_MS = 1100
const EASE_CIERRA = 'cubic-bezier(.5, 0, .75, 0)'
// Isla (6.4): primero a lo largo del borde, después hacia el centro. Los tramos se encadenan sin
// frenar en el medio: el primero termina con velocidad y el segundo arranca con ella.
const TRAMO_LARGO = 0.38
const EASE_LARGO = 'cubic-bezier(.32, 0, .67, .55)'
// Resorte críticamente amortiguado (como la isla del iPhone): arranca con la velocidad que trae el
// primer tramo y se asienta con una cola larga y suave, sin rebote (más allá del borde no se vería)
const EASE_ADENTRO = 'linear(0, 0.146, 0.304, 0.451, 0.577, 0.680, 0.761, 0.824, 0.871, 0.907, 0.933, 0.953, 0.967, 0.977, 0.984, 0.989, 0.993, 0.996, 0.998, 0.999, 1)'
const TRAMO_CIERRE = 0.55
const EASE_CIERRA_ADENTRO = 'cubic-bezier(.4, 0, .8, .45)'
const EASE_CIERRA_LARGO = 'cubic-bezier(.3, .5, .6, 1)'

const fin = anim => anim.finished.catch(() => {})

/**
 * Abre como una isla: el recorte va de la muesca (`desde`) a todo lo largo del borde (`medio`) y de
 * ahí hacia el centro hasta el panel entero (`hasta`), en un solo movimiento de 720 ms. El
 * contenido se funde recién en el segundo tramo, así el primero es solo la forma negra estirándose.
 */
export async function abrir(marco, { desde, medio, hasta }, contenido) {
  const cuerpo = document.body
  if (!hayMovimiento()) { cuerpo.classList.add('muesca-oculta'); return }
  const anim = marco.animate([
    { clipPath: desde, easing: EASE_LARGO },
    { clipPath: medio, offset: TRAMO_LARGO, easing: EASE_ADENTRO },
    { clipPath: hasta },
  ], { duration: ABRE_MS })
  contenido?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: ABRE_MS * (TRAMO_LARGO + 0.06), easing: 'ease-out', fill: 'backwards' })
  // El recorte nace con la forma de la muesca: en cuanto se pintó su primer cuadro, la muesca se
  // funde (90 ms) y queda solo el panel creciendo. Si se quedaba encima un rato, se veían las dos.
  let cuadro = requestAnimationFrame(() => { cuadro = requestAnimationFrame(() => cuerpo.classList.add('muesca-oculta')) })
  await fin(anim)
  cancelAnimationFrame(cuadro)
  cuerpo.classList.add('muesca-oculta')
}

/**
 * Cierra: el contenido se apaga en los primeros 120 ms y el recorte vuelve a la muesca en 360 ms.
 * La muesca vuelve a verse antes de que termine. Devuelve con qué soltar el último cuadro, para
 * llamarlo recién cuando el tablero ya no se ve (si no, parpadea el panel entero).
 */
export async function cerrar(marco, contenido, { desde, medio, hasta }) {
  const cuerpo = document.body
  if (!hayMovimiento()) { cuerpo.classList.remove('muesca-oculta'); return () => {} }
  const apaga = contenido.animate([{ opacity: 1 }, { opacity: 0 }], { duration: APAGA_MS, fill: 'forwards' })
  // Al revés que al abrir: primero se repliega hacia el borde y después se angosta hasta la muesca
  const anim = marco.animate([
    { clipPath: hasta, easing: EASE_CIERRA_ADENTRO },
    { clipPath: medio, offset: TRAMO_CIERRE, easing: EASE_CIERRA_LARGO },
    { clipPath: desde },
  ], { duration: CIERRA_MS, fill: 'forwards' })
  // La muesca vuelve cuando el recorte ya casi tiene su forma: antes se veían las dos superpuestas
  const mostrar = setTimeout(() => cuerpo.classList.remove('muesca-oculta'), CIERRA_MS * 0.85)
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
  const anim = marco.animate([{ clipPath: 'inset(0px 0px 0px 0px round 26px)' }, { clipPath: recorte, opacity: 0.4 }], { duration: PLIEGA_MS, easing: EASE_CIERRA, fill: 'forwards' })
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
