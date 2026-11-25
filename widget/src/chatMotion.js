// Movimiento de la charla (docs/diseno/chat-avis-ux.md 6): la mudanza de la mascota al abrir y al
// cerrar la hoja (6.1), el fundido al cambiar de lado (D2), la hoja que se pliega y se despliega con el
// panel (3.1) y el pie de una respuesta lista. Los bucles (cursor, chispa, pasos, palabras, cajón,
// menú, soltar) son CSS (estilos.css), todos dentro de `prefers-reduced-motion: no-preference` y
// `body:not(.pausa)`. Las pistas (tiempos, curvas, arcos) son puras y están en chat.js; acá solo se
// corren con anime.js v4 (src/vendor/animejs, versión fijada en package.json), salvo plegar y
// desplegar, que reusan los de muescaMotion.js (la misma forma que el tablero, 60 ms antes).
// Con movimiento reducido no hay vuelo ni recorte: fundidos de 160 ms (6.3). Con "Pausar
// animaciones", como el resto de Avis, todo pasa al instante. Un acto por vez: uno nuevo corta al de antes.

import { createTimeline, animate, stagger, cubicBezier } from './vendor/animejs/anime.esm.min.js'
import * as movimientoMuesca from './muescaMotion.js'
import { avi, claudeDe } from './avis.js'
import {
  PISTAS_ABRIR, PISTAS_CERRAR, FUNDIDO_MS, CAMBIA_LADO_MS, CURVAS, recorteHoja, pistaVuelo, pistaVuelta, modoMovimiento,
  PISTA_CHIP, pistaChip,
} from './chat.js'

const curva = nombre => cubicBezier(...CURVAS[nombre])

/** El modo de ahora (6.3): `completo`, `fundido` (movimiento reducido) o `nada` (pausa). */
export function modo() {
  return modoMovimiento({
    reducido: !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    pausa: document.body.classList.contains('pausa'),
  })
}

/** El acto en curso (abrir o cerrar): su línea de tiempo, el clon y con qué terminarlo. */
let acto = null

/** ¿Hay un acto de abrir o cerrar corriendo? (el lado no se funde ni se pliega en el medio). */
export const enActo = () => !!acto

/** Termina el acto en curso donde esté: saca el clon, limpia los estilos y resuelve su promesa. */
export function detener() {
  const a = acto
  if (!a) return
  acto = null
  a.tl?.cancel()
  a.terminar()
}

/** Las propiedades que un acto escribe en línea, para dejarlas como estaban al terminar. */
function limpiar(els, ...props) {
  for (const el of els) if (el) for (const p of props) el.style.removeProperty(p)
}

/**
 * Cuánto mide un px de pantalla en px CSS del documento (1 sin transformaciones; medido, no supuesto): con él,
 * las cajas de `getBoundingClientRect` pasan a `left`/`top` de una capa fija.
 */
const escalaDe = el => (el.offsetWidth && el.getBoundingClientRect().width ? el.offsetWidth / el.getBoundingClientRect().width : 1)
const lugarDe = (el, k) => { const r = el.getBoundingClientRect(); return { x: r.left * k, y: r.top * k } }

/** El clon de la mascota que vuela (`.vuela-chat`, 112 px), en `lugar` (px CSS), en forma base (D5). */
function clon(especie, lugar) {
  const el = document.createElement('div')
  el.className = 'vuela-chat'
  el.setAttribute('aria-hidden', 'true')
  el.style.left = `${lugar.x}px`
  el.style.top = `${lugar.y}px`
  el.innerHTML = avi(claudeDe(especie), 'saluda', 112, { marca: true })
  const inclina = el.querySelector('g.inclina')
  if (inclina) {
    inclina.style.transformBox = 'view-box'
    inclina.style.transformOrigin = '60px 104px'
  }
  document.body.append(el)
  return { el, inclina }
}

/** Fotogramas por porcentaje de anime.js desde una pista (`t` en %). */
const fotogramasCuerpo = pista => Object.fromEntries(pista.map(c => [`${c.t}%`, { translateX: c.x, translateY: c.y, scale: c.s }]))
const fotogramasGiro = pista => Object.fromEntries(pista.map(g => [`${g.t}%`, { rotate: g.r }]))

/** Una línea de tiempo con su promesa: se resuelve al completarse o al detenerla. */
function nuevoActo(limpieza) {
  let resolver
  const promesa = new Promise(r => { resolver = r })
  const a = {
    tl: null,
    terminar() { limpieza(); resolver() },
  }
  a.tl = createTimeline({ autoplay: true, onComplete: () => { if (acto === a) acto = null; a.terminar() } })
  acto = a
  return { a, promesa }
}

/** Un fundido de `el` (de `desde` a `hasta`) como acto; con `nada`, al instante. */
function fundido(els, desde, hasta) {
  const lista = els.filter(Boolean)
  for (const el of lista) el.style.opacity = String(desde)
  const { a, promesa } = nuevoActo(() => limpiar(lista, 'opacity'))
  a.tl.add(lista, { opacity: [desde, hasta], duration: FUNDIDO_MS, ease: 'linear' }, 0)
  return promesa
}

/**
 * Abrir la hoja (6.1, el acto estrella). `r`: `{ hoja, marcaAvi, chatAvi, destello, piezas, lado,
 * especie }`; la hoja ya está dibujada y a la vista, la marca ya lleva `.mudada` (su CSS funde el
 * fantasma al 14 % en 400 ms). Devuelve una promesa que se resuelve cuando la mascota aterrizó (o se
 * cortó): ahí va el foco al campo.
 */
export function abrirHoja(r) {
  detener()
  const m = modo()
  if (m === 'nada') return Promise.resolve()
  // Sin la marca a la vista (la pantalla dividida, D4) no hay desde dónde volar: solo el fundido
  if (m === 'fundido' || !r.marcaAvi?.offsetWidth || !r.chatAvi?.offsetWidth) return fundido([r.hoja], 0, 1)
  const P = PISTAS_ABRIR
  const rec = recorteHoja(r.lado)
  // Las medidas, antes de tocar nada: la hoja todavía sin recorte ni corrimiento
  const k = escalaDe(r.marcaAvi)
  const a = lugarDe(r.marcaAvi, k), b = lugarDe(r.chatAvi, k)
  const vuelo = pistaVuelo(b.x - a.x, b.y - a.y)
  const vuela = clon(r.especie, a)
  const agacha = r.marcaAvi.firstElementChild
  // El primer cuadro ya es el de t = 0: la hoja cerrada, el contenido abajo y el Avi real escondido
  r.hoja.style.clipPath = rec.cerrada
  r.hoja.style.transform = `translateX(${rec.dx}px)`
  r.chatAvi.style.opacity = '0'
  for (const p of r.piezas) p.style.opacity = '0'
  if (agacha) agacha.style.transformOrigin = '50% 100%'
  const { a: este, promesa } = nuevoActo(() => {
    vuela.el.remove()
    limpiar([r.hoja], 'clip-path', 'transform')
    limpiar([r.chatAvi, r.destello], 'opacity')
    limpiar(r.piezas, 'opacity', 'transform')
    limpiar([agacha], 'transform', 'transform-origin')
  })
  const tl = este.tl
  // 0: la marca se agacha (y vuelve, ya fantasma)
  if (agacha) tl.add(agacha, { scaleY: [{ from: 1, to: 0.9, duration: P.agacha.dura }, { to: 1, duration: P.agacha.dura }], ease: 'outQuad' }, P.agacha.en)
  // 80: la hoja se despliega desde el lado del tablero
  tl.add(r.hoja, { clipPath: [rec.cerrada, rec.abierta], translateX: [rec.dx, 0], duration: P.hoja.dura, ease: curva('ease') }, P.hoja.en)
  // 120: la mascota vuela; las alas, colas y tentáculos (g.inclina) llegan 80 ms tarde
  tl.add(vuela.el, { keyframes: fotogramasCuerpo(vuelo.cuerpo), duration: P.vuelo.dura, ease: 'linear', playbackEase: curva('vuelo') }, P.vuelo.en)
  if (vuela.inclina) tl.add(vuela.inclina, { keyframes: fotogramasGiro(vuelo.giro), duration: P.inclina.dura, ease: 'linear', playbackEase: curva('vuelo') }, P.inclina.en)
  // 600: el nombre, el estado, la cabecera, la bienvenida o el hilo y el composer suben y aparecen
  if (r.piezas.length) {
    tl.add(r.piezas, {
      opacity: [0, 1], translateY: [P.contenido.sube, 0], duration: P.contenido.dura, delay: stagger(P.contenido.escalon), ease: curva('ease'),
    }, P.contenido.en)
  }
  // 1020: aterriza: el Avi real toma el lugar del clon (mismo cuadro) y el piso destella
  tl.call(() => { vuela.el.remove(); r.chatAvi.style.removeProperty('opacity') }, P.llega.en)
  if (r.destello) {
    tl.add(r.destello, {
      opacity: [{ from: 0, to: 0.7, duration: P.aterriza.dura * 0.4 }, { to: 0.5, duration: P.aterriza.dura * 0.6 }, { to: 0, duration: 400 }], ease: 'outQuad',
    }, P.aterriza.en)
  }
  return promesa
}

/**
 * Cerrar la hoja (6.1, unos 700 ms): el contenido se funde, la mascota vuela de vuelta con el arco
 * invertido y la hoja se pliega. Mientras dura, la hoja y el fantasma siguen como estaban (main.js no
 * los toca); al resolverse, main.js esconde la hoja y devuelve la marca al 100 % en el mismo cuadro.
 */
export function cerrarHoja(r) {
  detener()
  const m = modo()
  if (m === 'nada') return Promise.resolve()
  if (m === 'fundido' || !r.marcaAvi?.offsetWidth || !r.chatAvi?.offsetWidth) return fundido([r.hoja], 1, 0)
  const P = PISTAS_CERRAR
  const rec = recorteHoja(r.lado)
  const k = escalaDe(r.marcaAvi)
  const a = lugarDe(r.marcaAvi, k), b = lugarDe(r.chatAvi, k)
  const vuelta = pistaVuelta(b.x - a.x, b.y - a.y)
  // El clon sale del escenario: arranca en la marca, corrido hasta el Avi del escenario
  const vuela = clon(r.especie, a)
  const c0 = vuelta.cuerpo[0]
  vuela.el.style.transform = `translateX(${c0.x}px) translateY(${c0.y}px) scale(${c0.s})`
  r.chatAvi.style.opacity = '0'
  const { a: este, promesa } = nuevoActo(() => {
    vuela.el.remove()
    limpiar([r.hoja], 'clip-path', 'transform')
    limpiar([r.chatAvi], 'opacity')
    limpiar(r.piezas, 'opacity')
  })
  const tl = este.tl
  tl.add(r.piezas, { opacity: [1, 0], duration: P.contenido.dura, ease: 'linear' }, P.contenido.en)
  tl.add(vuela.el, { keyframes: fotogramasCuerpo(vuelta.cuerpo), duration: P.vuelo.dura, ease: 'linear', playbackEase: curva('vuelo') }, P.vuelo.en)
  if (vuela.inclina) tl.add(vuela.inclina, { keyframes: fotogramasGiro(vuelta.giro), duration: P.vuelo.dura, ease: 'linear', playbackEase: curva('vuelo') }, P.vuelo.en)
  tl.add(r.hoja, { clipPath: [rec.abierta, rec.cerrada], translateX: [0, rec.dx], duration: P.hoja.dura, ease: curva('cierra') }, P.hoja.en)
  return promesa
}

/** El lado de la hoja cambió al soltar el tablero (D2): se funde en 180 ms en el lado nuevo. */
export function cambiarLado(hoja) {
  if (acto || modo() !== 'completo') return
  animate(hoja, { opacity: [0, 1], duration: CAMBIA_LADO_MS, ease: 'linear', onComplete: () => limpiar([hoja], 'opacity') })
}

/** El pie "Copiar · n s" de una respuesta que terminó aparece en 200 ms (6.2). */
export function aparecerPie(pie) {
  if (!pie || modo() !== 'completo') return
  animate(pie, { opacity: [0, 1], duration: 200, ease: 'linear', onComplete: () => limpiar([pie], 'opacity') })
}

/**
 * Al soltar (6.2): la capa se funde mientras el chip nace. `capa` sale del DOM (la vista ya no la
 * dibuja): un clon toma su lugar el tiempo del fundido y se va. Devuelve el centro de la capa en px
 * de la ventana, de donde nace el chip (o `null` si no había capa).
 */
export function fundirCapa(capa) {
  if (!capa?.isConnected) return null
  const r = capa.getBoundingClientRect()
  const centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  if (modo() !== 'completo') return centro
  const copia = capa.cloneNode(true)
  copia.removeAttribute('role')
  copia.setAttribute('aria-hidden', 'true')
  copia.classList.add('se-va')
  capa.parentElement.parentElement.append(copia)
  animate(copia, { opacity: [1, 0], duration: PISTA_CHIP.capa, ease: 'linear', onComplete: () => copia.remove() })
  return centro
}

/**
 * El chip de un adjunto nace desde el centro de la capa de soltar hasta su lugar en el composer
 * (6.2: `scale .6 → 1`, 420 ms, `--rebote`). Sin movimiento completo, aparece quieto.
 */
export function nacerChip(chip, desde) {
  if (!chip || !desde || modo() !== 'completo') return
  const k = escalaDe(chip)
  const { dx, dy } = pistaChip(desde, chip.getBoundingClientRect(), k)
  animate(chip, {
    translateX: [dx, 0], translateY: [dy, 0], scale: [PISTA_CHIP.escala, 1], duration: PISTA_CHIP.dura, ease: curva('rebote'),
    onComplete: () => limpiar([chip], 'transform'),
  })
}

/**
 * Lo de adentro de la hoja (el escenario y la charla) como un solo "contenido" para muescaMotion.js:
 * se apaga y se prende junto. `animate` devuelve algo que se puede cancelar, como una animación.
 */
function contenidoDe(hoja) {
  const hijos = [...hoja.children].filter(h => h.matches('.escenario, .charla'))
  return {
    animate(cuadros, opciones) {
      const anims = hijos.map(h => h.animate(cuadros, opciones))
      return { cancel: () => anims.forEach(x => x.cancel()) }
    },
  }
}

/**
 * La hoja se pliega con el panel (3.1) hasta `plegado` (`plegadoHacia` de muesca.js), igual que el
 * tablero; `viaje` para la tira. Devuelve con qué soltar su último cuadro, para llamarlo cuando la
 * hoja ya no se ve (la clase que la esconde está puesta).
 */
export function plegarHoja(hoja, plegado, opciones = {}) {
  detener()
  return movimientoMuesca.plegar(hoja, contenidoDe(hoja), plegado, opciones)
}

/** Al revés: la hoja nace con la forma de donde viene el panel y crece a su lugar, con él. */
export function desplegarHoja(hoja, plegado) {
  detener()
  return movimientoMuesca.desplegar(hoja, contenidoDe(hoja), plegado)
}
