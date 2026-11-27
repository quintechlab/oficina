// Movimiento del menú de módulos (#42, docs/diseno/modulos-ux.md 10) con anime.js v4: la píldora ámbar
// que viaja a la fila abierta, `#aviso-p` que baja al llegar una pregunta y el chip «1 ?» de Sesiones que
// late dos veces (el latido es CSS, `.late`, bajo `prefers-reduced-motion: no-preference` y
// `body:not(.pausa)`). Abrir una hoja usa su propio acto (`tareasMotion.abrirHoja`, `configuracionMotion`);
// volver a Sesiones, el de siempre (`configuracionMotion.cerrarHoja`). Solo `transform` y `opacity`.
// Con movimiento reducido la píldora salta y `#aviso-p` aparece con un fundido de 160 ms; con "Pausar
// animaciones", todo al instante (`modoMovimiento` de chat.js).
// La tira de repos con muchos proyectos (tira-repos-ux.md 9): la entrada de la tira y de un chip nuevo, el
// reorden con FLIP al soltarla y la lista del «+n» que abre y cierra.

import { animate, cubicBezier } from './vendor/animejs/anime.esm.min.js'
import { modoMovimiento, CURVAS } from './chat.js'

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
 * contenido). Sin fila abierta en el grupo (Configuración) queda donde estaba; el CSS la apaga.
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

// ------------------------------------------------------------------ la tira de repos (tira-repos-ux.md 9)

/** Los tiempos de 9, espejos de los tokens de `estilos.css` (`--d-tira-entra`, `--tira-escalon`…). */
export const TIRA_ENTRA_MS = 260
export const TIRA_ESCALON_MS = 30
export const TOPE_ESCALONES_TIRA = 8
export const REORDEN_MS = 300
export const LISTA_ABRE_MS = 220
export const LISTA_ESCALON_MS = 20
export const LISTA_FILA_DESDE_MS = 80
export const LISTA_FILA_MS = 200
export const TOPE_ESCALONES_LISTA = 10
export const LISTA_CIERRA_MS = 140

const EASE = cubicBezier(...CURVAS.ease)
const EASE_CIERRA = cubicBezier(...CURVAS.cierra)

/** Al terminar, sin `transform` ni `opacity` en línea: el `:active` de los chips vuelve a mandar. */
const limpiar = els => () => { for (const el of els) { el.style.removeProperty('transform'); el.style.removeProperty('opacity') } }
/** El escalón de la pieza `k`, con tope (con 15 repos, todo quieto a los 500 ms). */
const escalon = (paso, tope) => (_, k) => Math.min(k, tope) * paso

/** Los chips que se ven (los ocultos esperan en el DOM con `hidden`) y el «+n». */
const chipsVisibles = nav => [...(nav?.querySelectorAll(':scope > .rch:not([hidden])') ?? [])]

/**
 * La tira entra (9): al volver a Sesiones desde otro módulo. Cada chip, `opacity` 0→1 y `translateY` 4→0
 * en 260 ms, escalonados 30 ms con tope de 8. Reducido, un fundido de 160 ms; en pausa, nada.
 */
export function entraTira(nav) {
  const chips = chipsVisibles(nav)
  const m = modo()
  if (!chips.length || m === 'nada') return
  if (m === 'fundido') { animate(chips, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear', onComplete: limpiar(chips) }); return }
  animate(chips, { opacity: [0, 1], translateY: [4, 0], duration: TIRA_ENTRA_MS, delay: escalon(TIRA_ESCALON_MS, TOPE_ESCALONES_TIRA), ease: EASE, onComplete: limpiar(chips) })
}

/** Un repo nuevo entra solo (9): 260 ms, sin escalón. Reducido, un fundido; en pausa, nada. */
export function entraChip(chip) {
  const m = modo()
  if (!chip || chip.hidden || m === 'nada') return
  if (m === 'fundido') { animate(chip, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear', onComplete: limpiar([chip]) }); return }
  animate(chip, { opacity: [0, 1], translateY: [4, 0], duration: TIRA_ENTRA_MS, ease: EASE, onComplete: limpiar([chip]) })
}

/** Dónde está cada chip visible, por su `data-repo` (la llave estable: `data-proy` es un índice). */
export function lugaresTira(nav) {
  return new Map(chipsVisibles(nav).filter(c => c.dataset.repo != null).map(c => [c.dataset.repo, c.getBoundingClientRect()]))
}

/**
 * Reordenar al soltar la tira (4.3 y 9): FLIP de 300 ms. `antes`: lo que dio `lugaresTira` antes de
 * redibujar; cada chip que sigue a la vista y cambió de lugar viaja con `translate` desde el viejo. Los que
 * recién se ven entran como un chip nuevo. Reducido o en pausa, al instante.
 */
export function reordenarTira(nav, antes) {
  if (!antes || modo() !== 'completo') return
  for (const chip of chipsVisibles(nav)) {
    const repo = chip.dataset.repo
    if (repo == null) continue
    const viejo = antes.get(repo)
    if (!viejo) { entraChip(chip); continue }
    const nuevo = chip.getBoundingClientRect()
    const dx = viejo.left - nuevo.left
    const dy = viejo.top - nuevo.top
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue
    animate(chip, { translateX: [dx, 0], translateY: [dy, 0], duration: REORDEN_MS, ease: EASE, onComplete: limpiar([chip]) })
  }
}

/** La lista que abre o cierra ahora: un cierre que llega tarde no esconde una lista que se volvió a abrir. */
let listaEnCurso = null

/**
 * La lista del «+n» abre (9): `opacity` 0→1, `translateY` -4→0 y `scaleY` .96→1 desde arriba en 220 ms; las
 * filas, desde los 80 ms, cada 20 ms con tope de 10, `opacity` y `translateY` 4→0 en 200 ms. Reducido, un
 * fundido de 160 ms; en pausa, al instante.
 */
export function abrirLista(panel) {
  if (!panel) return
  listaEnCurso?.cancel?.()
  listaEnCurso = null
  panel.hidden = false
  const m = modo()
  if (m === 'nada') { limpiar([panel])(); return }
  if (m === 'fundido') { listaEnCurso = animate(panel, { opacity: [0, 1], duration: FUNDIDO_MS, ease: 'linear', onComplete: limpiar([panel]) }); return }
  listaEnCurso = animate(panel, { opacity: [0, 1], translateY: [-4, 0], scaleY: [0.96, 1], duration: LISTA_ABRE_MS, ease: EASE, onComplete: limpiar([panel]) })
  const filas = [...panel.querySelectorAll('.rm-op')]
  if (filas.length) animate(filas, { opacity: [0, 1], translateY: [4, 0], duration: LISTA_FILA_MS, delay: (el, k) => LISTA_FILA_DESDE_MS + escalon(LISTA_ESCALON_MS, TOPE_ESCALONES_LISTA)(el, k), ease: EASE, onComplete: limpiar(filas) })
}

/**
 * La lista del «+n» cierra (9): `opacity` 1→0 y `translateY` 0→-4 en 140 ms con `--ease-cierra`, y después
 * `hidden`. Devuelve una promesa que se cumple al esconderla. Reducido, un fundido de 160 ms; en pausa, al instante.
 */
export function cerrarLista(panel) {
  return new Promise(resolver => {
    if (!panel || panel.hidden) { resolver(); return }
    listaEnCurso?.cancel?.()
    const m = modo()
    const esconder = () => { if (listaEnCurso === a || a == null) { panel.hidden = true; limpiar([panel])(); listaEnCurso = null } resolver() }
    let a = null
    if (m === 'nada') { esconder(); return }
    a = m === 'fundido'
      ? animate(panel, { opacity: [1, 0], duration: FUNDIDO_MS, ease: 'linear', onComplete: esconder })
      : animate(panel, { opacity: [1, 0], translateY: [0, -4], duration: LISTA_CIERRA_MS, ease: EASE_CIERRA, onComplete: esconder })
    listaEnCurso = a
  })
}
