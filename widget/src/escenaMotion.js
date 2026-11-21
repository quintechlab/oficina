// Movimiento del escenario de cada sesión (docs/diseno/panel-avis-ux.md 8): la entrada del piso,
// Claude, el elenco y los hilos, encadenada a la entrada escalonada y al cambio de proyecto; la
// entrada de un subagente nuevo; y la pausa de las tarjetas que quedan fuera de la vista. Todo es
// CSS (estilos.css: `.esc.entra`, `.nuevo`, `.ses.quieta`, `viaja`); este módulo solo pone las
// clases y los tiempos. Con movimiento reducido o "Pausar animaciones" no hay entradas y los
// puntos de los hilos no se ven (8.5).

import { hayMovimiento } from './tableroMotion.js'

/** Paso 3 de la entrada (8.3): el primer Avi del elenco arranca a los 200 ms, cada uno 50 después. */
const ELENCO_MS = 200
const ELENCO_ESCALON_MS = 50
/** Lo que tarda en entrar cada Avi (escala .9 → 1 con rebote). */
const BROTE_MS = 360
/** Paso 4: los hilos aparecen 120 ms después del último Avi, en 240 ms. */
const TRAS_ELENCO_MS = 120
const HILOS_MS = 240

/** Cuándo aparecen los hilos (desde la tarjeta) con `n` piezas en el elenco (Avis y pila). */
export function retrasoHilos(n) {
  return ELENCO_MS + Math.max(0, n - 1) * ELENCO_ESCALON_MS + BROTE_MS + TRAS_ELENCO_MS
}

/** Los ids de subagentes de las tarjetas de un proyecto, en orden: lo que compara `novedades`. */
export function idsDeEscena(repo, preparadas) {
  return { repo, ids: preparadas.flatMap(p => p.sub.map(a => a.id)) }
}

/**
 * Subagentes nuevos (8.4): ids que no estaban en la lectura anterior del mismo proyecto. La
 * primera lectura y el cambio de proyecto no tienen nuevos: ya entran con la entrada del escenario.
 */
export function novedades(antes, despues) {
  if (!antes || antes.repo !== despues.repo) return []
  const vistos = new Set(antes.ids)
  return despues.ids.filter(id => !vistos.has(id))
}

const vueltas = new WeakMap()

/**
 * Entrada del escenario de cada tarjeta (8.3). Se llama justo después de `entrada()` o de
 * `cambioProyecto()`: toma el retraso con el que entra la tarjeta (`.rv` o `.rv-ses`) y encadena el
 * piso, Claude, el elenco y los hilos. Mientras está `.entra`, los puntos de los hilos no corren.
 */
export function entradaEscenas(tarjetas) {
  if (!hayMovimiento()) return
  for (const tarjeta of tarjetas) {
    const esc = tarjeta.querySelector('.esc')
    if (!esc) continue
    const base = (parseFloat(getComputedStyle(tarjeta).animationDelay) || 0) * 1000
    const hilos = retrasoHilos(esc.querySelectorAll('.elenco > li').length)
    esc.classList.remove('entra')
    esc.style.setProperty('--base', `${base}ms`)
    esc.style.setProperty('--hilos', `${hilos}ms`)
    const vuelta = {}
    vueltas.set(esc, vuelta)
    // Fuerza el reinicio si la clase ya estaba (cambios de proyecto seguidos)
    void esc.offsetWidth
    esc.classList.add('entra')
    setTimeout(() => {
      if (vueltas.get(esc) !== vuelta) return
      esc.classList.remove('entra')
      esc.style.removeProperty('--base')
      esc.style.removeProperty('--hilos')
    }, base + hilos + HILOS_MS + 50)
  }
}

/**
 * Un subagente nuevo entra solo (8.4): su Avi crece desde el piso y su hilo aparece después. Las
 * clases quedan hasta el próximo redibujo (las animaciones corren una vez).
 */
export function marcarNuevos(raiz, ids) {
  if (!ids.length || !hayMovimiento()) return
  const nuevos = new Set(ids)
  for (const el of raiz.querySelectorAll('.elenco > li[data-id], .hilos path[data-id], .hilo-pt[data-id]')) {
    if (nuevos.has(el.dataset.id)) el.classList.add('nuevo')
  }
}

let observador = null

/**
 * Pausa las tarjetas que no se ven (8.5): con 3 o más sesiones, la columna desplaza y las de
 * afuera llevan `.quieta`. Se vuelve a llamar después de cada redibujo de las tarjetas.
 */
export function vigilarEscenas(principal) {
  observador?.disconnect()
  observador = null
  if (!principal || typeof IntersectionObserver !== 'function') return
  observador = new IntersectionObserver(entradas => {
    for (const e of entradas) e.target.classList.toggle('quieta', !e.isIntersecting)
  }, { root: principal })
  for (const ses of principal.querySelectorAll('#sesiones > .ses')) observador.observe(ses)
}
