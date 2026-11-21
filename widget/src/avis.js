// Los Avis (docs/diseno/estilo-avis-ux.md, sección 5): huevos crema con pico ámbar; el color de
// cada personaje vive solo en las mejillas y en su accesorio. Generador de SVG puro y `poseAvi`,
// que pasa del ánimo de los datos a la pose que se dibuja. Los trazados son los del boceto
// aprobado (docs/diseno/bocetos/estilo-avis.html): ATRAS, FRENTE, OJOS y los efectos de cada estado.
// Las poses y sus bucles están en avis.css.

import { escapar, personajeDeNombre } from './logica.js'

/**
 * Poses que se dibujan. "proceso" (5.5): espera procesos en segundo plano. "saluda": el Avi base de
 * primeros pasos levanta la mano (docs/diseno/bienvenida-ux.md 6.3). "baja", "calienta", "contando",
 * "feliz" y "error": la voz del Avi de la marca con el globo del resumen abierto
 * (docs/diseno/resumen-ia-ux.md 6.2); solo las usa la marca, ningún ánimo de sesión las devuelve.
 */
export const POSES = ['esperando', 'escribiendo', 'leyendo', 'pensando', 'coordinando', 'teEspera', 'durmiendo', 'inactiva', 'listo', 'fallo', 'proceso', 'saluda', 'baja', 'calienta', 'contando', 'feliz', 'error']

/** El personaje de Claude: antena con foco, en ámbar. */
export const CLAUDE = personajeDeNombre('Claude')
/** El Avi base, marca de la familia: copete ámbar como el pico. */
export const PERSONAJE_BASE = { pj: 'copete', color: '#F2B632' }

const POSE_DE_ANIMO = {
  teEspera: 'teEspera', coordinando: 'coordinando', esperando: 'esperando', editando: 'escribiendo',
  comando: 'escribiendo', leyendo: 'leyendo', pensando: 'pensando', inactiva: 'inactiva',
  escribiendo: 'escribiendo', listo: 'listo', fallo: 'fallo', durmiendo: 'durmiendo', proceso: 'proceso',
  // heredados de escena.js
  comiendo: 'escribiendo', reposo: 'listo',
  // Primeros pasos (bienvenida-ux.md 6.3); antes, heredado de escena.js, era "esperando"
  saluda: 'saluda',
  // La voz del resumen (resumen-ia-ux.md 6.2): marcaMotion.js las pide por nombre
  baja: 'baja', calienta: 'calienta', contando: 'contando', feliz: 'feliz', error: 'error',
}

/**
 * De los datos a la pose (tabla 5.4). `animo` sale de `animoSesion` o `animoSubagente`, que ya
 * resuelven la prioridad de la línea de Claude, el "durmiendo" a los 6 s y la sesión inactiva.
 * `comando`: escribe igual, pero el logo de la notebook es verde.
 */
export function poseAvi(animo) {
  return { pose: POSE_DE_ANIMO[animo] ?? 'esperando', comando: animo === 'comando' }
}

/** Desfase de cada Avi, así no respiran todos juntos: -((índice × 0,83) mod 3,3) s. */
export function desfase(indice) {
  return `-${Number(((indice * 0.83) % 3.3).toFixed(2))}s`
}

/** Definiciones compartidas por todos los Avis (5.1): una vez por documento, ocultas. */
export function defsAvis() {
  return `<svg class="avis-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>`
    + `<radialGradient id="gPiel" cx="36%" cy="28%" r="78%"><stop offset="0" stop-color="#FFFCF4"/><stop offset=".42" stop-color="#F5EDDC"/><stop offset=".8" stop-color="#E1D4B6"/><stop offset="1" stop-color="#CBBB97"/></radialGradient>`
    + `<radialGradient id="gSuelo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#F2B632" stop-opacity=".22"/><stop offset="1" stop-color="#F2B632" stop-opacity="0"/></radialGradient>`
    + `<filter id="fBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.7"/></filter>`
    // Marca "Escenario" (marca-avi-ux.md 5.2 y 5.3): el brillo sin filtro (se mueve cada cuadro) y la pelota
    + `<radialGradient id="gBrillo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".55" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="gBola" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFD873"/><stop offset=".6" stop-color="#F2B632"/><stop offset="1" stop-color="#C98A12"/></radialGradient>`
    + `</defs></svg>`
}

/** Accesorios que van detrás del cuerpo (salen de la cabeza). La antena es solo de Claude. */
const ATRAS = {
  antena: c => `<path d="M60 38V19" stroke="#CDBE9C" stroke-width="3.2" stroke-linecap="round"/><circle class="halo" cx="60" cy="14" r="9.5" fill="${c}" opacity=".22"/><circle class="bulbo" cx="60" cy="14" r="5.4" fill="${c}"/><circle cx="58.2" cy="12.3" r="1.7" fill="#fff" opacity=".85"/>`,
  gata: c => `<path d="M30 58L33 25L56 39Z" fill="url(#gPiel)"/><path d="M90 58L87 25L64 39Z" fill="url(#gPiel)"/><path d="M35.5 45L37 31.5L47.5 39Z" fill="${c}" opacity=".9"/><path d="M84.5 45L83 31.5L72.5 39Z" fill="${c}" opacity=".9"/>`,
  raton: c => `<circle cx="32" cy="41" r="14" fill="url(#gPiel)"/><circle cx="88" cy="41" r="14" fill="url(#gPiel)"/><circle cx="30.5" cy="39.5" r="7.5" fill="${c}" opacity=".8"/><circle cx="89.5" cy="39.5" r="7.5" fill="${c}" opacity=".8"/>`,
  brote: c => `<path d="M60 37Q57 26 61 18" stroke="#78B078" stroke-width="2.8" fill="none" stroke-linecap="round"/><path d="M61 20Q70 8 81 15Q72 25 61 20Z" fill="${c}"/><path d="M59.5 26Q50 16 41 22Q50 31 59.5 26Z" fill="${c}" opacity=".75"/>`,
  mono: c => `<circle cx="22" cy="70" r="10.5" fill="url(#gPiel)"/><circle cx="98" cy="70" r="10.5" fill="url(#gPiel)"/><circle cx="21" cy="70" r="5.2" fill="${c}" opacity=".75"/><circle cx="99" cy="70" r="5.2" fill="${c}" opacity=".75"/>`,
  cuernos: c => `<path d="M40 45Q31 31 39 21Q43 33 52 38Z" fill="${c}"/><path d="M80 45Q89 31 81 21Q77 33 68 38Z" fill="${c}"/>`,
  // Copete ámbar, como el pico: la firma de la familia (solo el Avi base)
  copete: c => `<g class="copete"><path d="M56 38Q50 24 60 18Q56 28 64 36Z" fill="${c}"/><path d="M62 37Q64 26 74 25Q67 30 67 38Z" fill="${c}" opacity=".85"/></g>`,
}
/** Accesorios por delante del cuerpo: el jopo de Delfina. */
const FRENTE = {
  mono: c => `<path d="M49 40Q57 24 71 34Q62 31 58 41Q55 36 49 40Z" fill="${c}"/>`,
}
const OJOS = {
  base: `<ellipse class="ojo" cx="49" cy="70" rx="4.5" ry="5.8"/><ellipse class="ojo" cx="71" cy="70" rx="4.5" ry="5.8"/><circle class="luz" cx="50.7" cy="67.6" r="1.5"/><circle class="luz" cx="72.7" cy="67.6" r="1.5"/>`,
  cerrados: `<path class="trazo" d="M44.5 71Q49 75 53.5 71M66.5 71Q71 75 75.5 71"/>`,
  feliz: `<path class="trazo" d="M44.5 72.5Q49 65.5 53.5 72.5M66.5 72.5Q71 65.5 75.5 72.5"/>`,
  x: `<path class="trazo" d="M45.5 66.5l7 7m0-7l-7 7M67.5 66.5l7 7m0-7l-7 7"/>`,
}
const ojosDe = pose => (pose === 'durmiendo' || pose === 'inactiva') ? OJOS.cerrados : pose === 'listo' ? OJOS.feliz : pose === 'fallo' ? OJOS.x : OJOS.base

/** Crema de las manos (las de "escribiendo", "leyendo" y "saluda"). */
const CREMA_MANO = '#EFE6D2'

/** Verde del logo de la notebook cuando corre un comando (la pantalla de comando de hoy). */
const VERDE_COMANDO = '#8FD694'

/** Efectos de cada pose, delante del Avi. `c`: color del personaje. */
function efectos(pose, c, comando) {
  switch (pose) {
    case 'escribiendo': return `<ellipse cx="60" cy="79" rx="24" ry="8" fill="${c}" opacity=".14"/>`
      + `<rect x="35" y="80" width="50" height="21" rx="4.5" fill="#1C1C21" stroke="#34343B" stroke-width="1.2"/>`
      + `<circle class="logo" cx="60" cy="90.5" r="2.8" fill="${comando ? VERDE_COMANDO : c}"/>`
      + `<rect x="28" y="100" width="64" height="5" rx="2.5" fill="#2A2A31"/>`
      + `<ellipse class="mano" cx="43" cy="81" rx="5.5" ry="3.8" fill="#EFE6D2"/><ellipse class="mano m2" cx="77" cy="81" rx="5.5" ry="3.8" fill="#EFE6D2"/>`
    case 'leyendo': return `<path d="M60 84Q50 79 39 83V100Q50 96 60 101Z" fill="#A58BFF"/><path d="M60 84Q70 79 81 83V100Q70 96 60 101Z" fill="#8C70F0"/>`
      + `<path d="M44 88Q50 86 56 88M44 92Q50 90 56 92M64 88Q70 86 76 88" stroke="#E9E2FF" stroke-width="1.3" fill="none" opacity=".7"/>`
      + `<ellipse cx="44" cy="84" rx="5" ry="3.6" fill="#EFE6D2"/><ellipse cx="76" cy="84" rx="5" ry="3.6" fill="#EFE6D2"/>`
    case 'pensando': return `<circle class="p" cx="88" cy="36" r="3" fill="#F3EBD8"/><circle class="p p2" cx="96" cy="25" r="4.2" fill="#F3EBD8"/><circle class="p p3" cx="106" cy="12" r="5.6" fill="#F3EBD8"/>`
    case 'coordinando': return `<circle class="onda" cx="60" cy="14" r="11" stroke="${c}"/><circle class="onda o2" cx="60" cy="14" r="11" stroke="${c}"/>`
    case 'teEspera': return `<g class="burbuja"><path d="M86 6h18a9 9 0 0 1 9 9v6a9 9 0 0 1-9 9h-9l-7 7v-7a9 9 0 0 1-8-9v-6a9 9 0 0 1 9-9z" fill="#F2B632"/><text x="95" y="25.5" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="17" fill="#000">!</text></g>`
    case 'durmiendo': case 'inactiva': return `<text class="z" x="86" y="44">z</text><text class="z z2" x="94" y="32" font-size="15">z</text><text class="z z3" x="103" y="18" style="font-size:18px">Z</text>`
    case 'listo': return `<path class="chispa" d="M20 34l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#F2B632"/><path class="chispa c2" d="M100 26l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#8FD694"/><circle class="chispa c3" cx="104" cy="62" r="2.6" fill="#A58BFF"/><circle class="chispa c4" cx="16" cy="66" r="2.2" fill="#E78FB3"/>`
    // Despierto, mira un anillo celeste que gira: indeterminado, sin porcentaje (5.5)
    case 'proceso': return `<circle cx="103" cy="42" r="10" fill="none" stroke="#24242A" stroke-width="4"/><circle class="giro" cx="103" cy="42" r="10" fill="none" stroke="#7FB3FF" stroke-width="4" stroke-linecap="round" stroke-dasharray="20 43"/>`
    case 'fallo': return `<path d="M84 30q3-7 10-3q6-4 9 3" stroke="#8A8478" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M89 22l3 3m0-3l-3 3" stroke="#FF7A6B" stroke-width="2" stroke-linecap="round"/>`
    // La mano crema en alto a la derecha (palma, pulgar que la une al cuerpo y pliegue) y dos trazos
    // de vaivén. Va fuera de g.cuerpo: no respira con el cuerpo, se lee como gesto (bienvenida-ux.md 6.3)
    case 'saluda': return `<g class="saludo"><ellipse cx="103" cy="61" rx="6.6" ry="8" fill="${CREMA_MANO}"/>`
      + `<ellipse cx="97.6" cy="65.5" rx="2.6" ry="3.6" fill="${CREMA_MANO}" transform="rotate(-35 97.6 65.5)"/>`
      + `<path d="M100 55.5q3-1.6 6 0" stroke="#D9CCAD" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`
      + `<path class="vaiven" d="M112 50q4 5 2.5 11M116.5 45.5q6.5 7 3.5 17" stroke="#8A8478" stroke-width="2" fill="none" stroke-linecap="round"/>`
    default: return ''
  }
}

// ------------------------------------------------------------------ marca "Escenario" (marca-avi-ux.md 5.3)
// Cada transformación vive en su propio grupo, así no se pisan el CSS (respirar, parpadear) y el JS de
// marcaMotion.js (mirada, juegos). Los grupos que mueve el JS van con transform-box: view-box (avis.css).

/** La mano de "saluda": palma 6,6 × 8, pulgar que la une al cuerpo y pliegue, centrada en (0,0). */
const MANO = `<ellipse rx="6.6" ry="8" fill="${CREMA_MANO}"/><ellipse cx="-5.4" cy="4.5" rx="2.6" ry="3.6" fill="${CREMA_MANO}" transform="rotate(-35 -5.4 4.5)"/>`
  + `<path d="M-3 -5.5q3-1.6 6 0" stroke="#D9CCAD" stroke-width="1.4" fill="none" stroke-linecap="round"/>`

/** Ojos contentos ∩ (canta, festeja) y cerrados ∪ (se estira, siesta). */
const OJOS_FELIZ_MARCA = `<path class="trazo e-fe" d="M44.5 72Q49 65.5 53.5 72M66.5 72Q71 65.5 75.5 72"/>`
/** Cejas preocupadas, solo visibles en la pose "error" de la voz (resumen-ia-ux.md 6.2). */
const CEJAS_MARCA = '<path class="trazo cejas" d="M44 60.5L52.5 57.5M76 60.5L67.5 57.5"/>'
const OJOS_CERRADOS_MARCA = `<path class="trazo e-ce" d="M44.5 70Q49 74.5 53.5 70M66.5 70Q71 74.5 75.5 70"/>`

/** La antena de Claude con el foco y el bulbo en grupos propios (el juego los escala y los apaga). */
const antenaMarca = c => `<g class="antena"><path d="M60 38V19" stroke="#CDBE9C" stroke-width="3.2" stroke-linecap="round"/>`
  + `<g class="foco"><circle class="halo" cx="60" cy="14" r="9.5" fill="${c}" opacity=".22"/></g>`
  + `<g class="bulbo"><circle cx="60" cy="14" r="5.4" fill="${c}"/><circle cx="58.2" cy="12.3" r="1.7" fill="#fff" opacity=".85"/></g></g>`

/** El Avi de la marca: el mismo dibujo con las capas del escenario, las manos, el globito y la pelota. */
function svgMarca({ pj, color }, e, comando) {
  const c = color
  const atras = pj === 'antena' ? antenaMarca(c) : (ATRAS[pj]?.(c) ?? '')
  const frente = FRENTE[pj]?.(c) ?? ''
  const clase = `e-${e}${e === 'escribiendo' && comando ? ' comando' : ''} es-marca`
  return `<svg viewBox="0 0 120 120" class="${clase}" aria-hidden="true" focusable="false">`
    + `<ellipse class="suelo" cx="60" cy="104" rx="42" ry="9"/>`
    + `<ellipse class="contacto" cx="60" cy="104" rx="26" ry="3.6"/>`
    + `<ellipse class="b-sombra" cx="0" cy="104" rx="6.5" ry="1.8" fill="#000" opacity="0"/>`
    + `<g class="actua"><g class="inclina"><g class="cuerpo">${atras}`
    + `<ellipse class="pata" cx="47" cy="101" rx="8.5" ry="4.4"/><ellipse class="pata" cx="73" cy="101" rx="8.5" ry="4.4"/>`
    + `<path class="piel" d="M60 34C84 34 97 52 97 74C97 92 81 102 60 102C39 102 23 92 23 74C23 52 36 34 60 34Z"/>`
    + `<path class="sombreado" d="M25 80C30 95 90 95 95 80C92 99 28 99 25 80Z"/>`
    + `<g class="c-brillo"><ellipse class="brillo" cx="43" cy="49" rx="12" ry="6.4" transform="rotate(-30 43 49)"/></g>`
    + `<g class="c-mejillas"><ellipse cx="37" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/><ellipse cx="83" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/></g>`
    + CEJAS_MARCA
    + `<g class="mirada"><g class="parpado"><g class="ojos"><g class="e-ab">${ojosDe(e)}</g>${OJOS_FELIZ_MARCA}${OJOS_CERRADOS_MARCA}</g></g></g>`
    + `<g class="c-pico"><ellipse class="boca" cx="60" cy="81.5" rx="3.4" ry="3.6"/>`
    + `<path class="pico pico-i" d="M56.4 79.2Q60 81.2 63.6 79.2Q60 85.5 56.4 79.2Z"/><path class="pico pico-s" d="M56 78.5Q60 76.8 64 78.5Q60 80.8 56 78.5Z"/></g>`
    + `${frente}</g>`
    + `<g class="manito mn-i" opacity="0">${MANO}</g><g class="manito mn-d" opacity="0"><g transform="scale(-1 1)">${MANO}</g></g>`
    + `<g class="zs"><text class="z" x="88" y="50">z</text><text class="z z2" x="95" y="40" style="font-size:14px">z</text></g>`
    + `</g></g>`
    // En un grupo propio: la muesca (muesca-avi-ux.md 5.2) los esconde enteros; en la marca no cambia nada
    + `<g class="efectos">${efectos(e, c, comando)}</g>`
    + `<g class="notas"></g>`
    // Globito de "Te llama": crema con texto negro, nunca ámbar (el ámbar con "!" es la pregunta de Claude)
    + `<g class="globo" opacity="0"><rect x="-20" y="-13" width="40" height="22" rx="11" fill="#F3EBD8"/><path d="M-12 7L-19 17L-4 8Z" fill="#F3EBD8"/>`
    + `<text x="0" y="2.6" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="12" fill="#000">¡ey!</text></g>`
    + `<g class="bola" opacity="0"><g class="bola-r"><circle r="7" fill="url(#gBola)"/>`
    + `<path d="M-6.4 -2.6Q0 1.8 6.4 -2.6M-2.4 -6.6Q1.6 0 -2.4 6.6" stroke="#1D1707" stroke-opacity=".45" stroke-width="1.1" fill="none"/></g>`
    + `<circle cx="-2.6" cy="-3" r="1.6" fill="#fff" opacity=".7"/></g>`
    + `</svg>`
}

/**
 * El SVG de un Avi en una pose (`viewBox` 0 0 120 120, se escala con el contenedor). `personaje`:
 * `{ pj, color }` de `personajeDeNombre`. Siempre `aria-hidden`: el nombre, si hace falta, lo
 * lleva el contenedor (`avi`). `marca`: el Avi de la marca, con las capas del escenario.
 */
export function svgAvi({ pj, color }, pose, comando = false, { marca = false } = {}) {
  const e = POSES.includes(pose) ? pose : 'esperando'
  if (marca) return svgMarca({ pj, color }, e, comando)
  const c = color
  const atras = ATRAS[pj]?.(c) ?? ''
  const frente = FRENTE[pj]?.(c) ?? ''
  const clase = `e-${e}${e === 'escribiendo' && comando ? ' comando' : ''}`
  return `<svg viewBox="0 0 120 120" class="${clase}" aria-hidden="true" focusable="false">`
    + `<ellipse class="suelo" cx="60" cy="104" rx="42" ry="9"/>`
    + `<ellipse class="contacto" cx="60" cy="104" rx="26" ry="3.6"/>`
    + `<g class="cuerpo">${atras}`
    + `<ellipse class="pata" cx="47" cy="101" rx="8.5" ry="4.4"/><ellipse class="pata" cx="73" cy="101" rx="8.5" ry="4.4"/>`
    + `<path class="piel" d="M60 34C84 34 97 52 97 74C97 92 81 102 60 102C39 102 23 92 23 74C23 52 36 34 60 34Z"/>`
    + `<path class="sombreado" d="M25 80C30 95 90 95 95 80C92 99 28 99 25 80Z"/>`
    + `<ellipse class="brillo" cx="43" cy="49" rx="11" ry="5.6" transform="rotate(-30 43 49)"/>`
    + `<ellipse cx="37" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/><ellipse cx="83" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/>`
    + `<g class="mirada"><g class="ojos">${ojosDe(e)}</g></g>`
    + `<path class="pico" d="M56 78.5Q60 85.5 64 78.5Q60 76.8 56 78.5Z"/>`
    + `${frente}</g>`
    + efectos(e, c, comando)
    + `</svg>`
}

/**
 * Un Avi de `tamano` px en el ánimo de los datos (pasa por `poseAvi`). Decorativo (`aria-hidden`)
 * donde el texto de al lado ya dice quién es y qué hace; con `alt` lleva `role="img"` y nombre
 * (solo la marca y el vacío, 5.6). `indice`: para el desfase de la respiración.
 */
export function avi(personaje, animo, tamano, { alt = '', indice = 0, marca = false } = {}) {
  const { pose, comando } = poseAvi(animo)
  const a11y = alt ? ` role="img" aria-label="${escapar(alt)}"` : ' aria-hidden="true"'
  return `<span class="avi" style="--t:${tamano}px;--d:${desfase(indice)}"${a11y}>${svgAvi(personaje, pose, comando, { marca })}</span>`
}
