// Movimiento de los recibos de la charla (#43, C2; docs/diseno/chat-herramientas-ux.md 10): el recibo
// que llega con su sello (la luz que barre el borde y el visto que se dibuja), la fila que se suma, la
// raya de Deshacer, el error sin rebote, las filas de la lectura y el globo de «Puede tocar». Las pistas
// son puras (`PISTAS_RECIBO` de recibos.js); acá solo se corren con anime.js v4 (src/vendor/animejs).
// main.js lo llama una vez por cambio (`vivo.sellados`): lo ya visto se dibuja quieto.
// Con movimiento reducido, fundidos de 160 ms, sin barrido ni rebote, el visto ya dibujado y la raya
// entera; con "Pausar animaciones", todo al instante (`modoMovimiento` de chat.js).

import { animate, stagger, cubicBezier } from './vendor/animejs/anime.esm.min.js'
import { modoMovimiento, FUNDIDO_MS, CURVAS } from './chat.js'
import { PISTAS_RECIBO as P } from './recibos.js'

const EASE = cubicBezier(...CURVAS.ease)

/** El modo de ahora: `completo`, `fundido` (movimiento reducido) o `nada` (pausa). */
function modo() {
  return modoMovimiento({
    reducido: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    pausa: document.body.classList.contains('pausa'),
  })
}

const fundir = els => animate(els, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' })

/** El visto de las filas tildadas se dibuja (`stroke-dashoffset 14 → 0`). */
function dibujarVistos(el, en = P.tilde.en) {
  const vistos = [...el.querySelectorAll('.cir.on svg')]
  if (vistos.length) animate(vistos, { strokeDashoffset: [P.tilde.trazo, 0], duration: P.tilde.dura, delay: en, ease: EASE })
}

/**
 * Un recibo que llega (10): el de cambios entra 10 px desde abajo con `scale .96 → 1` y rebote, la luz
 * barre el borde una vez y el visto se dibuja; el de error, sin rebote y con su barrido rojo; la lectura
 * y «para borrar», sin barrido, con las filas escalonadas.
 */
export function llega(sec) {
  const m = modo()
  if (!sec?.isConnected || m === 'nada') return
  if (m === 'fundido') { fundir(sec); return }
  const tipo = sec.dataset.rec
  if (tipo === 'lectura' || tipo === 'mostrar') {
    const filas = [...sec.querySelectorAll('.rf, .mas-l')]
    fundir(sec)
    if (filas.length) animate(filas, { opacity: [0, 1], translateY: [P.lectura.sube, 0], duration: P.lectura.dura, delay: stagger(P.lectura.escalon), ease: P.lectura.curva })
    return
  }
  if (tipo === 'error' || tipo === 'nollego') {
    animate(sec, { opacity: [0, 1], translateY: [P.error.sube, 0], duration: P.error.dura, ease: P.error.curva })
  } else {
    animate(sec, { opacity: { from: 0, to: 1, duration: 240, ease: 'linear' }, translateY: [P.llega.sube, 0], scale: [P.llega.escala, 1], duration: P.llega.dura, ease: P.llega.curva })
    dibujarVistos(sec)
  }
  const luz = sec.querySelector('.rec-luz')
  if (luz) animate(luz, { translateX: ['-100%', '100%'], duration: P.sello.dura, delay: P.sello.en, ease: EASE })
}

/** Filas que se suman a un recibo puesto: entran 8 px desde abajo, escalonadas 70 ms, y su visto se dibuja. */
export function sumaFilas(filas) {
  const ps = (filas ?? []).filter(f => f?.isConnected)
  const m = modo()
  if (!ps.length || m === 'nada') return
  if (m === 'fundido') { fundir(ps); return }
  animate(ps, { opacity: [0, 1], translateY: [P.fila.sube, 0], duration: P.fila.dura, delay: stagger(P.fila.escalon), ease: P.fila.curva })
  for (const f of ps) dibujarVistos(f, 120)
}

/**
 * Deshacer (10): la raya crece de 0 a 100 % sobre el título, la fila baja a 45 % y «Deshecho» entra con
 * un fundido. Reducido: la raya aparece entera y «Deshecho» se funde en 160 ms.
 */
export function deshacer(fila) {
  const m = modo()
  if (!fila?.isConnected || m === 'nada') return
  const raya = fila.querySelector('.raya')
  const estado = fila.querySelector('.estado-d')
  if (m === 'fundido') { if (estado) fundir(estado); return }
  if (raya) animate(raya, { scaleX: [0, 1], duration: P.deshacer.raya, ease: EASE })
  const tenues = [...fila.querySelectorAll(':scope > .cir, :scope > .tx')]
  if (tenues.length) animate(tenues, { opacity: [1, P.deshacer.opacidad], duration: P.deshacer.raya, ease: EASE })
  if (estado) animate(estado, { opacity: [0, 1], duration: P.deshacer.estado, delay: 120, ease: 'linear' })
}

/** El globo de «Puede tocar» baja 6 px y aparece (220 ms). */
export function globo(el) {
  const m = modo()
  if (!el || m === 'nada') return
  if (m === 'fundido') { fundir(el); return }
  animate(el, { opacity: [0, 1], translateY: [-P.globo.baja, 0], duration: P.globo.dura, ease: P.globo.curva })
}
