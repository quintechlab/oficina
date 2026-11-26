// Movimiento de Proyectos (#44, docs/diseno/proyectos-ux.md 10) con anime.js v4: entrar al módulo, la
// píldora del índice que viaja al proyecto elegido (con su color), las piezas del proyecto que entran, la
// fila nueva que se abre con su punto que late y la fila borrada que se pliega. La cuenta de 3 s del
// borrado armado y las hormigas de la zona de soltar son CSS (estilos.css, bajo #pro). Solo `transform` y
// `opacity`, salvo el alto de la fila que se abre o se pliega. Con movimiento reducido: la píldora salta
// y lo demás es un fundido de 160 ms; con "Pausar animaciones", todo al instante (`modoMovimiento` de chat.js).

import { animate, stagger } from './vendor/animejs/anime.esm.min.js'
import { modoMovimiento } from './chat.js'

const FUNDIDO_MS = 160
/** El alto de una fila del índice (4.2). */
const ALTO_FILA = 36

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

/** Las piezas del proyecto o del formulario, en el orden en que entran (10). */
const piezasPanel = pane => lista(pane?.querySelectorAll('.ficha > *, .form > *, .vacio > *'))

/**
 * Entrar al módulo (10, el acto de modulos-ux 10): el encabezado y el contenido de la hoja llegan 10 px
 * desde la derecha, escalonados 34 ms, 320 ms `outQuart`.
 */
export function abrirHoja(cabecera, cuerpo) {
  const piezas = lista([cabecera, ...lista(cuerpo?.querySelectorAll('.pro-rotos > *, .ix-filas > *')), ...piezasPanel(cuerpo)])
  if (quieto(piezas)) return
  animate(piezas, { opacity: [0, 1], translateX: [10, 0], duration: 320, delay: stagger(34), ease: 'outQuart' })
}

/** Elegir un proyecto, crearlo o volver del formulario (10): las piezas suben 8 px, escalonadas 40 ms, 420 ms `outExpo`. */
export function entraPanel(pane) {
  const piezas = piezasPanel(pane)
  if (quieto(piezas)) return
  animate(piezas, { opacity: [0, 1], translateY: [8, 0], duration: 420, delay: stagger(40), ease: 'outExpo' })
}

// ------------------------------------------------------------------ la píldora del índice (4.2)

/** El viaje en curso de la píldora: mientras dura, el redibujo no la mueve. */
let viaje = null

const pildora = nav => nav?.querySelector(':scope > .ind-ix')
const filaElegida = nav => nav?.querySelector('.ix-b[aria-current="page"]')
const enY = y => `translateY(${y}px)`

/** El color de la píldora: el del proyecto elegido; con «+ Nuevo», ámbar. */
function pintarPildora(ind, fila) {
  const c = fila.classList.contains('mas') ? 'var(--ambar)' : fila.style.getPropertyValue('--c') || 'var(--ambar)'
  if (ind.style.getPropertyValue('--c') !== c) ind.style.setProperty('--c', c)
}

/** Dónde está ahora la píldora (su `transform`), para viajar desde ahí después de elegir otro. */
export function posicionPildora(nav) {
  return pildora(nav)?.style.transform ?? ''
}

/** La píldora sobre la fila elegida, sin viaje (cada redibujo). Sin fila elegida, se apaga. */
export function colocarPildora(nav) {
  const ind = pildora(nav)
  if (!ind || viaje) return
  const fila = filaElegida(nav)
  ind.classList.toggle('apagada', !fila)
  if (!fila) return
  pintarPildora(ind, fila)
  const t = enY(fila.offsetTop)
  if (ind.style.transform !== t) ind.style.transform = t
}

/**
 * Elegir otro (10): la píldora viaja desde `desde` (`posicionPildora` antes del cambio) hasta la fila
 * nueva, 380 ms `outBack(1.3)`, y su borde toma el color del proyecto (CSS). Reducido o en pausa, salta.
 */
export function viajarPildora(nav, desde) {
  const ind = pildora(nav)
  const fila = filaElegida(nav)
  if (!ind || !fila) { colocarPildora(nav); return }
  ind.classList.remove('apagada')
  pintarPildora(ind, fila)
  const hasta = fila.offsetTop
  const de = Number(/translateY\((-?[\d.]+)px\)/.exec(desde ?? '')?.[1])
  if (modo() !== 'completo' || !Number.isFinite(de) || de === hasta) {
    viaje?.cancel?.()
    viaje = null
    ind.style.transform = enY(hasta)
    return
  }
  viaje?.cancel?.()
  ind.style.transform = enY(de)
  viaje = animate(ind, { translateY: [de, hasta], duration: 380, ease: 'outBack(1.3)', onComplete: () => { viaje = null; ind.style.transform = enY(hasta) } })
}

// ------------------------------------------------------------------ crear y borrar (10)

/**
 * Crear (10): la fila nueva del índice se abre de 0 a 36 de alto (360 ms `outQuart`) y su punto late una
 * vez (`scale 1 → 1.6 → 1`, 500 ms). Reducido, un fundido; en pausa, nada.
 */
export function entraFila(fila) {
  if (!fila) return
  if (quieto([fila])) return
  fila.style.overflow = 'hidden'
  animate(fila, { height: [0, ALTO_FILA], minHeight: [0, ALTO_FILA], opacity: [0, 1], duration: 360, ease: 'outQuart', onComplete: () => { fila.style.overflow = ''; fila.style.height = ''; fila.style.minHeight = '' } })
  const punto = fila.querySelector('.pt')
  if (punto) animate(punto, { scale: [1, 1.6, 1], duration: 500, delay: 200, ease: 'outBack(2)' })
}

/**
 * Borrar (10): la fila del índice se pliega (alto a 0, opacidad a 0), 320 ms `outQuart`; se resuelve al
 * terminar. Reducido, un fundido de 160 ms; en pausa, al instante.
 */
export function plegarFila(fila) {
  return new Promise(resolver => {
    const m = modo()
    if (!fila?.isConnected || m === 'nada') { resolver(); return }
    if (m === 'fundido') { animate(fila, { opacity: [1, 0], duration: FUNDIDO_MS, ease: 'linear', onComplete: () => resolver() }); return }
    fila.style.overflow = 'hidden'
    animate(fila, { height: [fila.offsetHeight, 0], minHeight: [fila.offsetHeight, 0], opacity: [1, 0], duration: 320, ease: 'outQuart', onComplete: () => resolver() })
  })
}
