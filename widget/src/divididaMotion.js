// Movimiento de la pantalla dividida (docs/diseno/dividida-ux.md 9): abrir, volver, el mensaje que
// cruza el cable, el fin de la conversación, la barra de la cuenta, el latido de las fichas y el
// cambio de pestaña. Las secuencias que cambian el layout se encadenan con la Web Animations API
// (como muescaMotion.js): necesitan `finished` para hacer el cambio en el cuadro justo. Solo
// transform, opacity, offset-distance y clip-path. Todo pasa por `hayMovimiento()`: con movimiento
// reducido o "Pausar animaciones", abrir, volver y cambiar de pestaña son instantáneos y no cruza nada.

import { hayMovimiento } from './tableroMotion.js'
import { retrasoHilos } from './escenaMotion.js'

const EASE = 'cubic-bezier(.16, 1, .3, 1)'
const EASE_CIERRA = 'cubic-bezier(.5, 0, .75, 0)'
const REBOTE = 'cubic-bezier(.34, 1.56, .64, 1)'
/** El recorrido de la pastilla por el cable (9.3). */
const EASE_CRUZA = 'cubic-bezier(.45, 0, .2, 1)'

/** 9.3: la pastilla recorre en 1680 ms, se apaga hasta 1904 y el anillo va de 1570 a 2800. */
const CRUZA_MS = 1680
const APARECE_MS = 224
const APAGA_MS = 1904
export const CAMBIA_MS = 1570
const ANILLO_MS = 1230
const TOTAL_CRUCE_MS = CAMBIA_MS + ANILLO_MS

/** En la apertura (9.1), el elenco empieza a los 700 ms; en el escenario, a los 200 (`retrasoHilos`). */
const ELENCO_DIVIDIDA_MS = 700
const ELENCO_ESCENA_MS = 200

const animar = (el, keyframes, opciones) => (el ? el.animate(keyframes, { fill: 'both', ...opciones }) : null)
const terminada = a => (a ? a.finished.then(() => {}, () => {}) : Promise.resolve())
/** Cuando terminan todas, se cancelan: el estilo vuelve al de la hoja, que es el del último cuadro. */
const limpiar = anims => Promise.all(anims.map(terminada)).then(() => anims.forEach(a => a?.cancel()))
const espera = t => new Promise(r => setTimeout(r, t))
const entraDesde = (x, y = 0) => [{ opacity: 0, transform: `translate(${x}px, ${y}px)` }, { opacity: 1, transform: 'none' }]

/**
 * Se abre (9.1), una vez por apertura: la barra y la columna se van (120 ms), `cambiar()` pone el
 * layout de la dividida en un cuadro y entran el riel, el encabezado, las mitades, la costura que se
 * cose de arriba abajo, la ficha, el elenco y el puente desde la antena de quien empezó
 * (`desdeDerecha`). Devuelve cuando se puede cruzar el último mensaje (~1240 ms).
 */
export async function abrirDividida(marco, cambiar, { desdeDerecha = false } = {}) {
  if (!hayMovimiento()) { cambiar(); return }
  const salida = [marco.querySelector('.lado'), marco.querySelector('.principal')]
    .map(el => animar(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-8px)' }], { duration: 120, easing: EASE_CIERRA }))
  await Promise.all(salida.map(terminada))
  cambiar()
  salida.forEach(a => a?.cancel())

  const $ = s => marco.querySelector(s)
  const anims = []
  const riel = $('.riel')
  anims.push(animar(riel, entraDesde(-24), { duration: 450, easing: EASE }))
  ;[...(riel?.children ?? [])].forEach((p, i) => anims.push(animar(p, [{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: i * 40, easing: EASE })))
  for (const el of [$('.cab-c-t'), $('.volver'), $('#pestanas')]) anims.push(animar(el, entraDesde(0, 14), { duration: 480, delay: 40, easing: EASE }))
  anims.push(animar($('.mitad.izq'), entraDesde(-40), { duration: 620, delay: 80, easing: EASE }))
  anims.push(animar($('.mitad.der'), entraDesde(40), { duration: 620, delay: 145, easing: EASE }))
  const costura = $('.costura')
  anims.push(animar(costura, [{ transform: 'scaleY(0)', transformOrigin: '50% 0' }, { transform: 'scaleY(1)', transformOrigin: '50% 0' }], { duration: 500, delay: 200, easing: EASE, pseudoElement: '::before' }))
  anims.push(animar(costura?.querySelector('.pild'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 700, easing: EASE }))
  anims.push(animar($('.ficha-u'), entraDesde(0, 40), { duration: 620, delay: 210, easing: EASE }))
  // El elenco de cada mitad brota desde el piso, escalonado; sus hilos, 120 ms después del último
  for (const m of marco.querySelectorAll('.mitad')) {
    const lis = [...m.querySelectorAll('.elenco > li')]
    lis.forEach((li, j) => anims.push(animar(li, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: ELENCO_DIVIDIDA_MS - 120 + j * 50, easing: REBOTE })))
    const hilos = ELENCO_DIVIDIDA_MS - 120 - ELENCO_ESCENA_MS + retrasoHilos(lis.length)
    anims.push(animar(m.querySelector('.hilos'), [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: hilos, easing: 'ease' }))
  }
  // El puente se tiende desde la antena de quien empezó; el cable punteado entra a los +180
  const desde = desdeDerecha ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
  const puente = $('.puente')
  anims.push(animar(puente, [{ clipPath: desde }, { clipPath: 'inset(0)' }], { duration: 420, delay: 700, easing: EASE }))
  anims.push(animar(puente?.querySelector('.cable'), [{ opacity: 0 }, { opacity: 0.8 }], { duration: 240, delay: 880, easing: EASE }))
  limpiar(anims.filter(Boolean))
  await espera(1120)
}

/**
 * Vuelve (9.5): las mitades se juntan hacia la costura, la costura se descose hacia abajo, el resto se
 * apaga y el riel se va; a los 260 ms `cambiar()` pone la vista anterior y entran la barra (escalonada),
 * la columna y, una vez, el rastro de la tarjeta.
 */
export async function cerrarDividida(marco, cambiar) {
  if (!hayMovimiento()) { cambiar(); return }
  const $ = s => marco.querySelector(s)
  const sale = { duration: 240, easing: EASE_CIERRA }
  const salida = [
    animar($('.mitad.izq'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(12px) scale(.97)' }], sale),
    animar($('.mitad.der'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-12px) scale(.97)' }], sale),
    animar($('.costura'), [{ transform: 'scaleY(1)', transformOrigin: '50% 100%' }, { transform: 'scaleY(0)', transformOrigin: '50% 100%' }], { ...sale, pseudoElement: '::before' }),
    animar($('.puente'), [{ opacity: 1 }, { opacity: 0 }], sale),
    ...[$('.cab-c-t'), $('.volver'), $('.drena'), $('#pestanas'), $('.ficha-u'), $('.costura .pild')].map(el => animar(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease' })),
    animar($('.riel'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-24px)' }], { duration: 200, easing: EASE_CIERRA }),
  ].filter(Boolean)
  await espera(260)
  cambiar()
  salida.forEach(a => a.cancel())
  const anims = [...marco.querySelectorAll('.lado > *')].map((p, i) => animar(p, entraDesde(-12), { duration: 360, delay: i * 30, easing: EASE }))
  anims.push(animar($('.principal'), [{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: EASE }))
  for (const r of marco.querySelectorAll('#sesiones .rastro')) anims.push(animar(r, entraDesde(0, 4), { duration: 360, delay: 340, easing: EASE }))
  limpiar(anims.filter(Boolean))
}

/** Cambio de pestaña (9.6): el split entra 14 px desde el lado de la pestaña elegida, 240 ms. */
export function cambiarPestana(split, direccion) {
  if (!hayMovimiento() || !split) return
  limpiar([animar(split, entraDesde((direccion < 0 ? -1 : 1) * 14), { duration: 240, easing: EASE })])
}

let cruce = null
let siguienteCruce = null
const enCurso = new Set()

/**
 * Un mensaje cruza (9.3), una vez: la pastilla aparece en la antena de quien manda, recorre el cable
 * (`d`, ya en el sentido del mensaje), se apaga en la otra antena y deja un anillo (`llega`). A los
 * 1570 ms llama `alCambiar()` (los textos cambian con un fundido). Cola de 1: un mensaje en medio
 * de un cruce sale cuando termina el actual; los de más se juntan en el último.
 */
export function cruzarMensaje(split, { d, llega, alCambiar }) {
  if (!hayMovimiento() || !split) { alCambiar?.(); return }
  if (cruce) { siguienteCruce = { split, d, llega, alCambiar }; return }
  const msj = split.querySelector('.msj'), anillo = split.querySelector('.llega')
  if (!msj || !anillo) { alCambiar?.(); return }
  msj.style.offsetPath = `path('${d}')`
  anillo.style.left = `${llega.x}px`
  anillo.style.top = `${llega.y}px`
  const anims = [
    msj.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: CRUZA_MS, easing: EASE_CRUZA, fill: 'both' }),
    msj.animate([
      { opacity: 0, transform: 'scale(.5)' },
      { opacity: 1, transform: 'scale(1)', offset: APARECE_MS / APAGA_MS },
      { opacity: 1, transform: 'scale(1)', offset: CRUZA_MS / APAGA_MS },
      { opacity: 0, transform: 'scale(.6)' },
    ], { duration: APAGA_MS, fill: 'both' }),
    anillo.animate([
      { opacity: 0, transform: 'scale(.4)' },
      { opacity: 0.95, transform: 'scale(.7)', offset: 0.135 },
      { opacity: 0, transform: 'scale(2.3)' },
    ], { duration: ANILLO_MS, delay: CAMBIA_MS, easing: 'ease-out', fill: 'both' }),
  ]
  anims.forEach(a => enCurso.add(a))
  const reloj = setTimeout(() => alCambiar?.(), CAMBIA_MS)
  cruce = { anims, reloj, alCambiar }
  Promise.all(anims.map(terminada)).then(() => {
    anims.forEach(a => { a.cancel(); enCurso.delete(a) })
    clearTimeout(reloj)
    cruce = null
    const sig = siguienteCruce
    siguienteCruce = null
    if (sig && sig.split.isConnected) cruzarMensaje(sig.split, sig)
  })
}

/**
 * Lo que corre con WAAPI termina de una (el cruce en curso, los latidos): el panel dejó de verse.
 * Los textos que esperaban al cruce cambian ya.
 */
export function detener() {
  const c = cruce
  siguienteCruce = null
  if (c) { clearTimeout(c.reloj); c.alCambiar?.() }
  for (const a of [...enCurso]) a.finish()
}

/**
 * Termina (9.4): el cable y el halo se apagan y aparece el trazado cortado (fundido cruzado de 360 ms).
 * La clase `.fin` del puente deja el estado final.
 */
export function terminar(split) {
  const puente = split?.querySelector('.puente')
  if (!puente) return
  puente.classList.add('fin')
  if (!hayMovimiento()) return
  const opc = { duration: 360, easing: EASE_CIERRA }
  puente.querySelector('.cable')?.animate([{ opacity: 0.8 }, { opacity: 0 }], opc)
  puente.querySelector('.halo-p')?.animate([{ opacity: 0.1 }, { opacity: 0 }], opc)
  puente.querySelector('.cortado')?.animate([{ opacity: 0 }, { opacity: 0.45 }], opc)
}

/** Textos que cambian al llegar el mensaje (9.3): fundido de 200 ms. */
export function fundido(els) {
  if (!hayMovimiento()) return
  for (const el of els) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })
}

const drenas = new WeakMap()

/**
 * La barra de la cuenta (9.4): un `scaleX` de 1 a 0 lineal en `total` ms que sigue a la cuenta pura
 * (`cuentaVuelta` de dividida.js, que es la que decide la vuelta): se pone en `total - restante` y
 * corre o queda quieta con ella. Con movimiento reducido o en pausa no se ve (CSS) y no corre.
 */
export function drena(el, { restante, total, corre }) {
  const relleno = el?.querySelector('i')
  if (!relleno) return
  if (!el.classList.contains('ve')) {
    el.classList.add('ve')
    if (hayMovimiento()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' })
  }
  let a = drenas.get(el)
  if (!a) {
    a = relleno.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: total, easing: 'linear', fill: 'both' })
    drenas.set(el, a)
  }
  a.pause()
  a.currentTime = Math.max(0, total - restante)
  if (corre && hayMovimiento()) a.play()
}

/** La barra de la cuenta se va (la conversación volvió, se cambió de pestaña o se cerró la dividida). */
export function quitarDrena(el) {
  if (!el) return
  drenas.get(el)?.cancel()
  drenas.delete(el)
  el.classList.remove('ve')
}

/**
 * Late la ficha (9.2): el punto titila `veces` (3 al llegar, 1 por mensaje sin abrir) y queda fijo.
 * `entra`: la ficha nueva entra con rebote. Sin movimiento, el punto queda fijo y nada entra.
 */
export function latirFicha(punto, veces, { entra = null } = {}) {
  if (!hayMovimiento()) return
  if (entra) {
    const a = entra.animate([{ opacity: 0, transform: 'translateX(-16px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: REBOTE, fill: 'backwards' })
    enCurso.add(a)
    terminada(a).then(() => enCurso.delete(a))
  }
  if (!punto) return
  const a = punto.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], { duration: 1400, iterations: veces, easing: 'ease-in-out' })
  enCurso.add(a)
  terminada(a).then(() => enCurso.delete(a))
}

/** Lo que dura un cruce entero (para la vista de desarrollo y los tiempos de main.js). */
export const DURACION_CRUCE_MS = TOTAL_CRUCE_MS
