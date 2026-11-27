// Movimiento de Horas (odd/tasks/horas-trabajo.md, S4) con anime.js v4, en el idioma de Proyectos y
// Hábitos: entrar al módulo (el encabezado y las filas llegan desde la derecha), cambiar de período (las
// filas suben escalonadas y cada barra crece desde la izquierda), abrir una feature (sus piezas suben;
// las barras por día crecen) y el total que cuenta hasta su cifra nueva. El punto de «trabajando ahora»
// late con CSS (estilos.css, bajo #hor). Solo `transform` y `opacity`. Con movimiento reducido, un
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

/** Las filas de la lista o las piezas de la feature abierta, en el orden en que entran. */
const piezasCuerpo = cuerpo => lista(cuerpo?.querySelectorAll('.hor-lista > li, .hor-det > *, .hor-vacio > *, .err'))
/** Las barras (la de cada feature y la de cada día). */
const barras = cuerpo => lista(cuerpo?.querySelectorAll('.hor-b > i'))

/** Las barras crecen desde la izquierda, escalonadas como sus filas. */
function crecerBarras(cuerpo, retraso) {
  const b = barras(cuerpo)
  if (!b.length) return
  animate(b, { scaleX: [0, 1], duration: 700, delay: stagger(45, { start: retraso }), ease: 'outExpo' })
}

/**
 * Entrar al módulo (el acto de modulos-ux 10, como Proyectos): el encabezado y las filas llegan 10 px
 * desde la derecha, escalonados 34 ms, 320 ms `outQuart`; las barras crecen después.
 */
export function abrirHoja(cabecera, cuerpo) {
  const piezas = lista([cabecera, cuerpo?.querySelector('.hor-cab'), ...piezasCuerpo(cuerpo)])
  if (quieto(piezas)) return
  animate(piezas, { opacity: [0, 1], translateX: [10, 0], duration: 320, delay: stagger(34), ease: 'outQuart' })
  crecerBarras(cuerpo, 180)
}

/** Otro período, una feature abierta o de vuelta a la lista: las piezas suben 8 px, escalonadas 40 ms, 420 ms `outExpo`. */
export function entraCuerpo(cuerpo) {
  const piezas = piezasCuerpo(cuerpo)
  if (quieto(piezas)) return
  animate(piezas, { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(40), ease: 'outExpo' })
  crecerBarras(cuerpo, 120)
}

/** El total del encabezado, al cambiar de período: la cifra nueva baja 6 px y aparece. */
export function cambiaTotal(cab) {
  const t = cab?.querySelector('.hor-total')
  if (!t || modo() === 'nada') return
  if (modo() === 'fundido') { animate(t, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear' }); return }
  animate(t, { opacity: [0, 1], translateY: [-6, 0], duration: 360, ease: 'outQuart' })
}
