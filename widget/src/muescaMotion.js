// Movimiento de la muesca y de la ventana única (docs/diseno/estilo-avis-ux.md, 6.4 y 6.6): abrir,
// cerrar, el golpe de la pregunta, y las formas que se transforman una en otra adentro de la ventana
// del área (la muesca y la píldora, el tablero que se pliega a la muesca o a la tira y se despliega).
// El recorte y los viajes usan la Web Animations API del WebView (sin dependencias); el golpe y el
// imán son clases de CSS (estilos.css). Con movimiento reducido o "Pausar animaciones" todo pasa al
// instante y no hay golpe (6.5). El velo queda solo para pasar la ventana a otro monitor (9.6).

import { hayMovimiento } from './tableroMotion.js'
import { secuenciaVelo, transformEntre, REAPARECE_MS } from './muesca.js'

export const ABRE_MS = 720
export const CIERRA_MS = 480
const APAGA_MS = 120
const PLIEGA_MS = 360
const GOLPE_MS = 1100
export const EASE_CIERRA = 'cubic-bezier(.5, 0, .75, 0)'
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
 * Los hombros del panel (body::before y ::after) acompañan al recorte: en la muesca (`inset`, px
 * CSS del tablero) están corridos hacia adentro, justo donde están los hombros de la muesca, y a lo
 * largo del borde quedan en su lugar. `abrir`: de la muesca al borde en el primer tramo; si no, al
 * revés en el último. Sin animación de pseudoelementos, quedan quietos en su lugar.
 */
function hombros(inset, abrir) {
  const borde = document.body.dataset.borde
  if (!borde || !inset) return []
  const [eje, a, b] = borde === 'arriba' || borde === 'abajo' ? ['X', 'izquierda', 'derecha'] : ['Y', 'arriba', 'abajo']
  const cerca = { transform: `translate${eje}(0px)` }
  return [['::before', inset[a]], ['::after', -inset[b]]].map(([pseudoElement, d]) => {
    const lejos = { transform: `translate${eje}(${d}px)` }
    const cuadros = abrir
      ? [{ ...lejos, easing: EASE_LARGO }, { ...cerca, offset: TRAMO_LARGO }, cerca]
      : [cerca, { ...cerca, offset: TRAMO_CIERRE, easing: EASE_CIERRA_LARGO }, lejos]
    try {
      return document.body.animate(cuadros, { duration: abrir ? ABRE_MS : CIERRA_MS, fill: 'both', pseudoElement })
    } catch { return null }
  }).filter(Boolean)
}

/**
 * Abre como una isla: el recorte va de la muesca (`desde`) a todo lo largo del borde (`medio`) y de
 * ahí hacia el centro hasta el panel entero (`hasta`), en un solo movimiento de 720 ms. El
 * contenido se funde recién en el segundo tramo, así el primero es solo la forma negra estirándose.
 */
export async function abrir(marco, { desde, medio, hasta, inset }, contenido) {
  const cuerpo = document.body
  if (!hayMovimiento()) { cuerpo.classList.add('muesca-oculta'); return }
  const anim = marco.animate([
    { clipPath: desde, easing: EASE_LARGO },
    { clipPath: medio, offset: TRAMO_LARGO, easing: EASE_ADENTRO },
    { clipPath: hasta },
  ], { duration: ABRE_MS })
  const animHombros = hombros(inset, true)
  contenido?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: ABRE_MS * (TRAMO_LARGO + 0.06), easing: 'ease-out', fill: 'backwards' })
  // El recorte nace con la forma de la muesca: en cuanto se pintó su primer cuadro, la muesca se
  // funde (90 ms) y queda solo el panel creciendo. Si se quedaba encima un rato, se veían las dos.
  let cuadro = requestAnimationFrame(() => { cuadro = requestAnimationFrame(() => cuerpo.classList.add('muesca-oculta')) })
  await fin(anim)
  cancelAnimationFrame(cuadro)
  cuerpo.classList.add('muesca-oculta')
  // Ya en su lugar: sin la animación quedan exactamente donde los pone el CSS
  for (const h of animHombros) h.cancel()
}

const VUELVE_MS = 320
let relojVuelve = null

/** La muesca reaparece (una sola vez por cierre) y su Avi entra con "vuelve". */
function reaparecer() {
  const cuerpo = document.body
  if (!cuerpo.classList.contains('muesca-oculta')) return
  cuerpo.classList.remove('muesca-oculta')
  cuerpo.classList.add('muesca-vuelve')
  clearTimeout(relojVuelve)
  relojVuelve = setTimeout(() => cuerpo.classList.remove('muesca-vuelve'), VUELVE_MS)
}

/**
 * Cierra: el contenido se apaga en los primeros 120 ms y el recorte vuelve a la muesca en 360 ms.
 * La muesca vuelve a verse antes de que termine. Devuelve con qué soltar el último cuadro, para
 * llamarlo recién cuando el tablero ya no se ve (si no, parpadea el panel entero).
 */
export async function cerrar(marco, contenido, { desde, medio, hasta, inset }) {
  const cuerpo = document.body
  if (!hayMovimiento()) { cuerpo.classList.remove('muesca-oculta'); return () => {} }
  const apaga = contenido.animate([{ opacity: 1 }, { opacity: 0 }], { duration: APAGA_MS, fill: 'forwards' })
  // Al revés que al abrir: primero se repliega hacia el borde y después se angosta hasta la muesca
  const anim = marco.animate([
    { clipPath: hasta, easing: EASE_CIERRA_ADENTRO },
    { clipPath: medio, offset: TRAMO_CIERRE, easing: EASE_CIERRA_LARGO },
    { clipPath: desde },
  ], { duration: CIERRA_MS, fill: 'forwards' })
  const animHombros = hombros(inset, false)
  // La muesca vuelve cuando el recorte ya casi tiene su forma: antes se veían las dos superpuestas.
  // Al reaparecer, el Avi vuelve a asomar desde abajo (body.muesca-vuelve, 320 ms, muesca-avi-ux.md 6)
  const mostrar = setTimeout(reaparecer, CIERRA_MS * 0.85)
  await fin(anim)
  clearTimeout(mostrar)
  reaparecer()
  return () => { apaga.cancel(); anim.cancel(); for (const h of animHombros) h.cancel() }
}

// ---- ventana única (estilo-avis-ux.md 9.7 y 6.6): la muesca, la píldora, el tablero y la tira son
// formas adentro de una ventana del área; pasar de una a otra es una de estas animaciones (solo
// transform, opacity y clip-path), sin redimensionar ni velar.

/** El tablero entero, sin recorte (radio de la ventana flotante, 26). */
const ENTERO = 'inset(0px 0px 0px 0px round 26px)'
/** Recorrido de una forma que se transforma en otra (la píldora y la muesca, la tira): como plegar. */
export const TRANSFORMA_MS = PLIEGA_MS
/** Minimizar a la tira o expandirla: lo que dura abrir la isla, en dos tramos. */
export const MINIMIZA_MS = ABRE_MS
/** Tramo de minimizar en el que el tablero se recoge en su lugar; después viaja. */
const TRAMO_RECOGE = 0.45

/** Las animaciones propias que siguen en `el` (una forma nueva corta a la anterior). */
const enCurso = new WeakMap()
function cortar(el) {
  for (const a of enCurso.get(el) ?? []) a.cancel()
  enCurso.delete(el)
}
function anotar(el, ...anims) {
  enCurso.set(el, anims.filter(Boolean))
}

/**
 * Una forma viaja de una caja a otra (px CSS de la ventana): con `llega`, `el` ya está en `hasta` y
 * entra desde `desde` (la muesca que vuelve de la píldora); sin `llega`, `el` está en `desde` y se
 * va hasta `hasta` (la tira que se acopla), y queda ahí hasta llamar a lo que devuelve. `apagar`:
 * además se funde al irse (o aparece al llegar); `apagarContenido`: al irse, lo de adentro se apaga
 * en los primeros 120 ms (la tira no se ve aplastada mientras se achica a la muesca).
 */
export async function viajar(el, desde, hasta, { llega = false, duracion = TRANSFORMA_MS, easing = EASE_ADENTRO, apagar = false, apagarContenido = false } = {}) {
  if (!el || !hayMovimiento()) return () => {}
  cortar(el)
  const lejos = { transform: llega ? transformEntre(hasta, desde) : transformEntre(desde, hasta), transformOrigin: '0 0', ...(apagar ? { opacity: 0 } : {}) }
  const cerca = { transform: 'translate(0px, 0px) scale(1, 1)', transformOrigin: '0 0', ...(apagar ? { opacity: 1 } : {}) }
  const anim = el.animate(llega ? [lejos, cerca] : [cerca, lejos], { duration: duracion, easing, fill: llega ? 'backwards' : 'forwards' })
  const apagados = !llega && apagarContenido ? [...el.children].map(h => h.animate([{ opacity: 1 }, { opacity: 0 }], { duration: APAGA_MS, fill: 'forwards' })) : []
  anotar(el, anim)
  await fin(anim)
  if (llega) { anotar(el); return () => {} }
  return () => { anim.cancel(); for (const a of apagados) a.cancel(); anotar(el) }
}

/**
 * El tablero se pliega hasta otra forma (`plegado`: `plegadoHacia` de muesca.js): el contenido se
 * apaga en 120 ms y el recorte se cierra a la forma nueva mientras viaja hasta ella. Junto a un borde
 * (hacia la muesca) es un solo movimiento de 360 ms; con `viaje` (minimizar a la tira), primero se
 * recoge en su lugar y después viaja con el resorte, en 720 ms. Devuelve con qué soltar el último
 * cuadro, para llamarlo cuando la forma nueva ya está a la vista.
 */
export async function plegar(marco, contenido, { clip, transform }, { viaje = false } = {}) {
  if (!hayMovimiento()) return () => {}
  cortar(marco)
  const entero = { clipPath: ENTERO, transform: 'translate(0px, 0px) scale(1, 1)', transformOrigin: '0 0' }
  const final = { clipPath: clip, transform, transformOrigin: '0 0' }
  const cuadros = viaje
    ? [{ ...entero, easing: EASE_CIERRA_ADENTRO }, { ...final, transform: entero.transform, offset: TRAMO_RECOGE, easing: EASE_ADENTRO }, final]
    : [{ ...entero, easing: EASE_CIERRA }, final]
  const apaga = contenido?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: APAGA_MS, fill: 'forwards' })
  const anim = marco.animate(cuadros, { duration: viaje ? MINIMIZA_MS : PLIEGA_MS, fill: 'forwards' })
  anotar(marco, anim)
  await fin(anim)
  return () => { anim.cancel(); apaga?.cancel(); anotar(marco) }
}

/**
 * Al revés que plegar, como abrir la isla: el tablero nace con la forma de donde viene (la píldora
 * soltada, la tira o la muesca), viaja a su lugar (38 %) y crece con el resorte hasta entero, en
 * 720 ms; el contenido se funde en el segundo tramo. Arranca en esta misma tarea (el primer cuadro
 * ya tiene la forma de origen), así quien llama puede esconder la forma vieja enseguida.
 */
export function desplegar(marco, contenido, { clip, transform }) {
  if (!hayMovimiento()) return Promise.resolve()
  cortar(marco)
  const origen = { clipPath: clip, transform, transformOrigin: '0 0' }
  const anim = marco.animate([
    { ...origen, easing: EASE_LARGO },
    { ...origen, transform: 'translate(0px, 0px) scale(1, 1)', offset: TRAMO_LARGO, easing: EASE_ADENTRO },
    { clipPath: ENTERO, transform: 'translate(0px, 0px) scale(1, 1)', transformOrigin: '0 0' },
  ], { duration: ABRE_MS, fill: 'backwards' })
  anotar(marco, anim)
  contenido?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: ABRE_MS * (TRAMO_LARGO + 0.06), easing: 'ease-out', fill: 'backwards' })
  return fin(anim).then(() => anotar(marco))
}

/** Lo de adentro de una forma recién llegada (la tira) se funde en 160 ms. */
export function aparecerContenido(el) {
  if (!el || !hayMovimiento()) return
  for (const hijo of el.children) hijo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REAPARECE_MS, easing: 'ease-out', fill: 'backwards' })
}

// ---- velo para pasar a otro monitor (9.6 y 9.7): WebView2 deja la ventana transparente sin pintar
// después de moverla y redimensionarla. Lo que se ve (muesca, luz, píldora, tablero con sus hombros
// y tira) se esconde al instante con `body.velada` (estilos.css) y vuelve cuando ya se pintó.

/** Lo que se esconde mientras la ventana pasa a otra área. */
const VELADOS = ['#muesca', '#marco', '#luz', '#pildora', '#tira']
/** Si nadie revela (un error en el medio), el velo se levanta solo a este tiempo. */
const VELO_MAXIMO_MS = 1500
let turnoVelo = 0
let seguroVelo = null

/** Un cuadro pintado; si el WebView no pinta (ventana escondida, sin cuadros), a los 100 ms igual sigue. */
const CUADRO_MAXIMO_MS = 100
const cuadro = () => new Promise(r => {
  const t = setTimeout(r, CUADRO_MAXIMO_MS)
  requestAnimationFrame(() => { clearTimeout(t); r() })
})
const espera = ms => new Promise(r => setTimeout(r, ms))

/**
 * Esconde al instante lo que se ve, antes de redimensionar (en la misma tarea que el cambio, así
 * ningún cuadro muestra la ventana rota). Devuelve el turno, para `revelar`.
 */
export function velar() {
  turnoVelo++
  document.body.classList.add('velada')
  const t = turnoVelo
  clearTimeout(seguroVelo)
  seguroVelo = setTimeout(() => revelar(t), VELO_MAXIMO_MS)
  return t
}

/** ¿Hay un velo puesto? */
export const velada = () => document.body.classList.contains('velada')

/**
 * Después de redimensionar: espera dos cuadros y el asiento (`secuenciaVelo`) y vuelve a mostrar
 * lo velado, fundido en 160 ms (al instante sin movimiento). Si mientras tanto se veló otra vez
 * (`turno` viejo), no hace nada: revela el último. Sin `turno`, el último.
 */
export async function revelar(turno = turnoVelo) {
  if (!velada()) return
  const pasos = secuenciaVelo(hayMovimiento())
  const { cuadros, ms } = pasos.find(p => p.paso === 'esperar')
  for (let i = 0; i < cuadros; i++) await cuadro()
  await espera(ms)
  if (turno !== turnoVelo || !velada()) return
  clearTimeout(seguroVelo)
  document.body.classList.remove('velada')
  const fundido = pasos.find(p => p.paso === 'mostrar').ms
  if (!fundido) return
  // Desde transparente hasta lo que cada uno tenga (la luz queda en .75, la muesca oculta en 0)
  const opciones = { duration: fundido, easing: 'ease-out' }
  for (const sel of VELADOS) document.querySelector(sel)?.animate([{ opacity: 0 }], opciones)
  // Los hombros del panel abierto (body::before y ::after)
  try {
    for (const pseudoElement of ['::before', '::after']) document.body.animate([{ opacity: 0 }], { ...opciones, pseudoElement })
  } catch { /* sin animación de pseudoelementos: aparecen al instante */ }
}

/**
 * Golpe (6.4 y muesca-avi-ux.md 6): la muesca crece desde el borde y vuelve, el Avi salta, el globo
 * reaparece y la luz sube, una sola vez. Solo llama la atención: no abre ni responde nada.
 */
export function golpe() {
  if (!hayMovimiento()) return
  const cuerpo = document.body
  cuerpo.classList.remove('golpe')
  void cuerpo.offsetWidth
  cuerpo.classList.add('golpe')
  setTimeout(() => cuerpo.classList.remove('golpe'), GOLPE_MS)
}
