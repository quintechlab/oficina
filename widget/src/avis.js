// Los Avis (docs/diseno/estilo-avis-ux.md, sección 5): huevos crema con pico ámbar; el color de
// cada personaje vive solo en las mejillas y en su accesorio. Generador de SVG puro y `poseAvi`,
// que pasa del ánimo de los datos a la pose que se dibuja. Los trazados son los del boceto
// aprobado (docs/diseno/bocetos/estilo-avis.html): ATRAS, FRENTE, OJOS y los efectos de cada estado.
// Las poses y sus bucles están en avis.css.

import { escapar, personajeDeNombre } from './logica.js'
import { especieValida, datosEspecie, datosVariante, partesEvolucion, variantesOjos, canalesEspecie, cejasEspecie, CHISPAS_VUELTA, DEGRADES_ESPECIES, DEGRADES_VARIANTES } from './especies.js'

/**
 * Poses que se dibujan. "proceso" (5.5): espera procesos en segundo plano. "saluda": el Avi base de
 * primeros pasos levanta la mano (docs/diseno/bienvenida-ux.md 6.3). "baja", "calienta", "contando",
 * "feliz" y "error": la voz de la mascota (docs/diseno/resumen-ia-ux.md 6.2), que hoy actúa en el
 * escenario de la charla (chat-avis-ux.md 3.3, `animoChat`); ningún ánimo de sesión las devuelve.
 */
export const POSES = ['esperando', 'escribiendo', 'leyendo', 'pensando', 'coordinando', 'teEspera', 'durmiendo', 'inactiva', 'listo', 'fallo', 'proceso', 'saluda', 'baja', 'calienta', 'contando', 'feliz', 'error']

/**
 * El personaje de Claude con la mascota elegida (docs/diseno/mascotas-avi-ux.md 9.2): con el Avi, la
 * antena con foco en ámbar de siempre; `especie` (una de `NOMBRES_ESPECIES`, si no el Avi) y sin
 * variante (las variantes son de los subagentes, 7).
 */
export function claudeDe(especie) {
  return { ...personajeDeNombre('Claude'), especie: especieValida(especie), variante: null }
}
/** El Avi base, marca de la familia: copete ámbar como el pico. */
export const PERSONAJE_BASE = { pj: 'copete', color: '#F2B632' }

/**
 * La mascota de primeros pasos (mascotas-avi-ux.md 3.1 y 9.2, S1): con el Avi, el Avi base de hoy
 * (copete ámbar); con otra especie, esa especie. Siempre en forma base (`soloBase`: no es Claude).
 */
export function mascotaPrimerosPasos(especie) {
  const e = especieValida(especie)
  return e === 'avi' ? { ...PERSONAJE_BASE } : { ...PERSONAJE_BASE, especie: e, variante: null, soloBase: true }
}

/**
 * Cómo se nombra a Claude (mascotas-avi-ux.md 12): "Claude" con el Avi base, como hoy; con la forma
 * evolucionada, su nombre entre paréntesis ("Claude (Faro)"); con otra especie en base, la especie.
 */
export function nombreClaude(especie, evolucionada = false) {
  const d = datosEspecie(especie)
  if (evolucionada) return `Claude (${d.evoNombre})`
  return especieValida(especie) === 'avi' ? 'Claude' : `Claude (${d.nombre})`
}

const POSE_DE_ANIMO = {
  teEspera: 'teEspera', coordinando: 'coordinando', esperando: 'esperando', editando: 'escribiendo',
  comando: 'escribiendo', leyendo: 'leyendo', pensando: 'pensando', inactiva: 'inactiva',
  escribiendo: 'escribiendo', listo: 'listo', fallo: 'fallo', durmiendo: 'durmiendo', proceso: 'proceso',
  // heredados de escena.js
  comiendo: 'escribiendo', reposo: 'listo',
  // Primeros pasos (bienvenida-ux.md 6.3); antes, heredado de escena.js, era "esperando"
  saluda: 'saluda',
  // La voz de la mascota (resumen-ia-ux.md 6.2; hoy, la charla: chat-avis-ux.md 3.3)
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
    // La forma evolucionada (mascotas-avi-ux.md 5.1): los haces del faro
    + DEGRADES_ESPECIES
    // Las variantes de subagente de las especies nuevas (7.1)
    + DEGRADES_VARIANTES
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

/**
 * La antena de Faro (mascotas-avi-ux.md 5.3): el tallo y el foco en envolturas que crecen con la forma
 * evolucionada (`tallo-e`, `foco-e`). En la marca, adentro van los grupos de marcaMotion.js. `halo-f`
 * es el brillo del acto (evolucionMotion.js): el halo de la pose lo mueve el CSS (un dueño por capa).
 */
const HALO_ACTO = c => `<circle class="halo-f" cx="60" cy="14" r="9.5" fill="${c}" opacity="0" style="transform-box:view-box;transform-origin:60px 14px"/>`
const TALLO = '<g class="tallo-e ev"><path d="M60 38V19" stroke="#CDBE9C" stroke-width="3.2" stroke-linecap="round"/></g>'
const antenaFaro = c => `<g class="antena">${TALLO}<g class="foco-e ev"><circle class="halo" cx="60" cy="14" r="9.5" fill="${c}" opacity=".22"/>${HALO_ACTO(c)}`
  + `<circle class="bulbo" cx="60" cy="14" r="5.4" fill="${c}"/><circle cx="58.2" cy="12.3" r="1.7" fill="#fff" opacity=".85"/></g></g>`
const antenaFaroMarca = c => `<g class="antena">${TALLO}<g class="foco-e ev"><g class="foco"><circle class="halo" cx="60" cy="14" r="9.5" fill="${c}" opacity=".22"/>${HALO_ACTO(c)}</g>`
  + `<g class="bulbo"><circle cx="60" cy="14" r="5.4" fill="${c}"/><circle cx="58.2" cy="12.3" r="1.7" fill="#fff" opacity=".85"/></g></g></g>`

/** Sin forma evolucionada: las capas extra vacías, así el SVG es el de siempre carácter por carácter. */
const SIN_FORMA = { attrs: '', sello: '', abre: '', cierra: '', cambio: '', cambioFin: '', evoAtras: '', evoFrente: '', fx: '', faro: false }

/**
 * Las capas de la forma evolucionada de Claude (mascotas-avi-ux.md 3.2): la clave (`data-evo`, que
 * main.js usa para poner o sacar `evol` en su lugar), los tokens de la especie, el anillo de suelo,
 * las envolturas `trans` (el acto) › `talla` (la forma) y `cambio` (el rebote), y las partes de la
 * forma y del acto de la especie, si ya las tiene (hasta la entrega 3, solo el Avi: Faro).
 */
function capasForma(especie, claveEvo) {
  const d = datosEspecie(especie)
  const partes = partesEvolucion(especie)
  return {
    attrs: `${claveEvo != null ? ` data-evo="${escapar(claveEvo)}"` : ''} style="--c:${d.c};--mano:${d.mano};--oy:${d.ojo.y}px"`,
    sello: '<ellipse class="sello" cx="60" cy="104" rx="40" ry="8"/>',
    abre: '<g class="trans"><g class="talla">', cierra: '</g></g>',
    cambio: '<g class="cambio">', cambioFin: '</g>',
    evoAtras: partes?.evoAtras ?? '', evoFrente: partes?.evoFrente ?? '',
    fx: `<g class="fx">${partes ? partes.fx + CHISPAS_VUELTA : ''}</g>`,
    faro: !!partes,
  }
}

// Las piezas de la marca que no son del cuerpo: iguales para todas las especies (marcaMotion.js las mueve)
/** La sombra de la pelota, sobre el piso. */
const B_SOMBRA = `<ellipse class="b-sombra" cx="0" cy="104" rx="6.5" ry="1.8" fill="#000" opacity="0"/>`
/** Las dos manitos de los juegos: crema en el Avi; en las otras especies, la mano de su color (`manoEspecie`). */
const manitos = m => `<g class="manito mn-i" opacity="0">${m}</g><g class="manito mn-d" opacity="0"><g transform="scale(-1 1)">${m}</g></g>`
const MANITOS = manitos(MANO)
/**
 * La mano de los juegos de una especie nueva (mascotas-avi-ux.md 10, P3: manitos con `--mano`): la del
 * saludo de la especie (`efectosEspecie`, la del boceto), con su sombra para leerse sobre cuerpos
 * oscuros, centrada en (0,0) como `MANO`.
 */
const manoEspecie = mano => `<ellipse rx="8" ry="9.4" fill="#0C0C0E" opacity=".55"/><ellipse rx="6.6" ry="8" fill="${mano}"/>`
  + `<ellipse cx="-5.4" cy="4.5" rx="2.6" ry="3.6" transform="rotate(-35 -5.4 4.5)" fill="${mano}"/>`
  + `<path d="M-3 -5.5q3-1.6 6 0" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none" stroke-linecap="round"/>`
/**
 * La boca que se abre en una especie nueva (P3: "boca" mueve la boca de la especie): como la del Avi
 * de la marca (`.boca`, 3,4 × 3,6), en el centro del trazo de su boca y del color de su boca, detrás
 * de él. Cerrada (escala 0) hasta que marcaMotion.js la abre desde `data-y`.
 */
const bocaEspecie = ({ y, color }) => `<ellipse class="boca" cx="60" cy="${y + 1}" rx="3.4" ry="3.6" data-y="${y}" style="fill:${color}" transform="scale(1 0)"/>`
/** Las "z" de la siesta. */
const ZS = `<g class="zs"><text class="z" x="88" y="50">z</text><text class="z z2" x="95" y="40" style="font-size:14px">z</text></g>`
/** Las notas de "canta", el globito de "te llama" y la pelota. */
const NOTAS_GLOBO_BOLA = `<g class="notas"></g>`
  // Globito de "Te llama": crema con texto negro, nunca ámbar (el ámbar con "!" es la pregunta de Claude)
  + `<g class="globo" opacity="0"><rect x="-20" y="-13" width="40" height="22" rx="11" fill="#F3EBD8"/><path d="M-12 7L-19 17L-4 8Z" fill="#F3EBD8"/>`
  + `<text x="0" y="2.6" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="12" fill="#000">¡ey!</text></g>`
  + `<g class="bola" opacity="0"><g class="bola-r"><circle r="7" fill="url(#gBola)"/>`
  + `<path d="M-6.4 -2.6Q0 1.8 6.4 -2.6M-2.4 -6.6Q1.6 0 -2.4 6.6" stroke="#1D1707" stroke-opacity=".45" stroke-width="1.1" fill="none"/></g>`
  + `<circle cx="-2.6" cy="-3" r="1.6" fill="#fff" opacity=".7"/></g>`

/** El Avi de la marca: el mismo dibujo con las capas del escenario, las manos, el globito y la pelota. */
function svgMarca({ pj, color }, e, comando, clases, w = SIN_FORMA) {
  const c = color
  const atras = pj === 'antena' ? (w.faro ? antenaFaroMarca(c) : antenaMarca(c)) : (ATRAS[pj]?.(c) ?? '')
  const frente = FRENTE[pj]?.(c) ?? ''
  const clase = `${clases} es-marca`
  return `<svg viewBox="0 0 120 120" class="${clase}" aria-hidden="true" focusable="false"${w.attrs}>`
    + `<ellipse class="suelo" cx="60" cy="104" rx="42" ry="9"/>${w.sello}`
    + `<ellipse class="contacto" cx="60" cy="104" rx="26" ry="3.6"/>`
    + B_SOMBRA
    + `${w.abre}<g class="actua"><g class="inclina">${w.cambio}<g class="cuerpo">${w.evoAtras}${atras}`
    + `<ellipse class="pata" cx="47" cy="101" rx="8.5" ry="4.4"/><ellipse class="pata" cx="73" cy="101" rx="8.5" ry="4.4"/>`
    + `<path class="piel" d="M60 34C84 34 97 52 97 74C97 92 81 102 60 102C39 102 23 92 23 74C23 52 36 34 60 34Z"/>`
    + `<path class="sombreado" d="M25 80C30 95 90 95 95 80C92 99 28 99 25 80Z"/>`
    + `<g class="c-brillo"><ellipse class="brillo" cx="43" cy="49" rx="12" ry="6.4" transform="rotate(-30 43 49)"/></g>`
    + `<g class="c-mejillas"><ellipse cx="37" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/><ellipse cx="83" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/></g>`
    + CEJAS_MARCA
    + `<g class="mirada"><g class="parpado"><g class="ojos"><g class="e-ab">${ojosDe(e)}</g>${OJOS_FELIZ_MARCA}${OJOS_CERRADOS_MARCA}</g></g></g>`
    + `<g class="c-pico"><ellipse class="boca" cx="60" cy="81.5" rx="3.4" ry="3.6"/>`
    + `<path class="pico pico-i" d="M56.4 79.2Q60 81.2 63.6 79.2Q60 85.5 56.4 79.2Z"/><path class="pico pico-s" d="M56 78.5Q60 76.8 64 78.5Q60 80.8 56 78.5Z"/></g>`
    + `${frente}${w.evoFrente}</g>${w.cambioFin}`
    + MANITOS + ZS
    + `</g></g>${w.cierra}`
    // En un grupo propio: la muesca (muesca-avi-ux.md 5.2) los esconde enteros; en la marca no cambia nada
    + `<g class="efectos">${efectos(e, c, comando)}</g>`
    + NOTAS_GLOBO_BOLA
    + `${w.fx}</svg>`
}

// ------------------------------------------------------------------ las especies nuevas (mascotas-avi-ux.md 3.2 y 5)

/**
 * Los efectos de cada pose en una especie nueva: los del Avi (el mismo idioma de estados, 1), con las
 * ondas de "coordinando" desde el emisor de la especie (más su brillo, `.emisor`) y las manos de
 * escribir, leer y saludar del color de la especie (`--mano`, 5.1). El saludo es el del boceto: la
 * mano lleva una sombra para leerse sobre cuerpos oscuros.
 */
function efectosEspecie(pose, { c, mano, emisor: [ex, ey] }, comando) {
  switch (pose) {
    case 'coordinando': return `<circle class="emisor" cx="${ex}" cy="${ey}" r="5.5" fill="${c}" opacity=".35"/>`
      + `<circle class="onda" cx="${ex}" cy="${ey}" r="11" stroke="${c}"/><circle class="onda o2" cx="${ex}" cy="${ey}" r="11" stroke="${c}"/>`
    case 'saluda': return `<g class="saludo"><ellipse cx="103" cy="61" rx="8" ry="9.4" fill="#0C0C0E" opacity=".55"/><ellipse class="mano" cx="103" cy="61" rx="6.6" ry="8" fill="${mano}"/>`
      // El pulgar sin `mano`: el transform-box fill-box de `.avi .mano` movería el centro de su rotate
      + `<ellipse cx="97.6" cy="65.5" rx="2.6" ry="3.6" transform="rotate(-35 97.6 65.5)" fill="${mano}"/>`
      + `<path d="M100 55.5q3-1.6 6 0" stroke="#000" stroke-opacity=".18" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`
      + `<path class="vaiven" d="M112 50q4 5 2.5 11M116.5 45.5q6.5 7 3.5 17" stroke="#8A8478" stroke-width="2" fill="none" stroke-linecap="round"/>`
    default: return efectos(pose, c, comando).replaceAll(`fill="${CREMA_MANO}"`, `fill="${mano}"`)
  }
}

/** El anillo de suelo de la forma evolucionada (5.3). */
const SELLO = '<ellipse class="sello" cx="60" cy="104" rx="40" ry="8"/>'

/**
 * Una especie nueva (Ascua, Escarcha, Nodo, Bruma, Morro, Lumen, Nimbo), con las capas de 3.2: suelo propio
 * (`gSu-<especie>`, especies.css), anillo de suelo y contacto; `vuela` (Bruma y Nimbo flotan) › `trans` (el
 * acto) › `talla` (la forma) › [`actua` › `inclina`, solo la marca] › `cambio` › `cuerpo` (partes de la
 * forma detrás, piezas, ojos, boca y partes delante); la órbita que no respira (`extra`), los efectos
 * de la pose en `g.efectos` (la muesca los esconde) y las partículas del acto en `g.fx`. Los ojos ∪ ∩ x
 * van todos dibujados y la pose elige cuál se ve (especies.css). `evolutiva`: Claude, con su clave o
 * con la forma pedida: anillo, partes de la forma y partículas; si no (primeros pasos), solo la base.
 * En la marca: los grupos que mueve marcaMotion.js (`actua`, `inclina`, `parpado`, la boca en `c-pico`,
 * las manitos, las "z", el globito y la pelota), más las cejas de "error", la boca que se abre y las
 * manitos del color de la especie (entrega 5, P2 y P3; qué pieza mueve cada canal: `canalesEspecie`).
 * `variante` (0..3): un subagente (`datosVariante`), con su talla en `g.talla` y nunca evolutivo.
 */
function svgEspecie(especie, e, comando, clase, { evolutiva, claveEvo, marca, variante }) {
  const d = datosVariante(especie, variante)
  const pz = d.piezas
  const evo = evolutiva ? d.evo : null
  const v = variantesOjos(d.ojo, d.trazo)
  const attrs = `${evolutiva && claveEvo != null ? ` data-evo="${escapar(claveEvo)}"` : ''} style="--c:${d.c};--mano:${d.mano};--oy:${d.ojo.y}px"`
  const ojos = `<g class="ojos-pose"><g class="ojos"><g class="o-ab">${pz.ojos}</g><g class="o-ce">${v.ce}</g><g class="o-fe">${v.fe}</g><g class="o-x">${v.x}</g></g></g>`
  // En la marca (P2 y P3): las cejas de "error", la boca que se abre y las manitos de su color
  const k = marca ? canalesEspecie(especie) : null
  const cuerpo = `<g class="cuerpo">${evo?.evoAtras ?? ''}${pz.atras}${pz.cuerpo}${k ? cejasEspecie(d.ojo, d.trazo) : ''}`
    + `<g class="mirada">${marca ? `<g class="parpado">${ojos}</g>` : ojos}</g>`
    + `${marca ? `<g class="c-pico">${bocaEspecie(k.boca)}${pz.boca}</g>` : pz.boca}${evo?.evoFrente ?? ''}</g>${pz.extra ?? ''}`
  const capas = marca
    ? `<g class="actua"><g class="inclina"><g class="cambio">${cuerpo}</g>${manitos(manoEspecie(d.mano))}${ZS}</g></g>`
    : `<g class="cambio">${cuerpo}</g>`
  return `<svg viewBox="0 0 120 120" class="${clase}${marca ? ' es-marca' : ''}" aria-hidden="true" focusable="false"${attrs}>`
    + `<ellipse class="suelo" cx="60" cy="104" rx="44" ry="9.5"/>${evolutiva ? SELLO : ''}`
    + `<ellipse class="contacto" cx="60" cy="104" rx="${d.flota ? 20 : 26}" ry="3.6"/>`
    + (marca ? B_SOMBRA : '')
    + `<g class="vuela"><g class="trans"><g class="talla"${d.talla ? ` style="transform:scale(${d.talla})"` : ''}>${capas}</g></g>`
    + `<g class="efectos">${efectosEspecie(e, d, comando)}</g>`
    + `${evo ? `<g class="fx">${evo.fx}${CHISPAS_VUELTA}</g>` : ''}</g>`
    + (marca ? NOTAS_GLOBO_BOLA : '')
    + '</svg>'
}

/**
 * ¿Puede evolucionar? Solo Claude (mascotas-avi-ux.md 6.3): con el Avi, la antena; con otra especie,
 * la figura sin variante. Los subagentes y el Avi base de primeros pasos, nunca.
 */
const esClaude = ({ pj, especie, variante, soloBase }) => !soloBase && variante == null && (especie !== 'avi' || pj === 'antena')

/**
 * Las clases del SVG (mascotas-avi-ux.md 3.2): `m-<especie>` (con el Avi, solo en la figura de
 * Claude que puede evolucionar, así el SVG de siempre no cambia), `e-<pose>`, `comando`, `evol` (la
 * forma evolucionada, 6.6) y `chica` (la forma chica de las caras de 44 px o menos, 5.5).
 */
function clasesSvg(personaje, e, comando, { evolutiva, evolucionada, chica }) {
  const m = personaje.especie === 'avi' && !evolutiva ? '' : `m-${personaje.especie} `
  return `${m}e-${e}${e === 'escribiendo' && comando ? ' comando' : ''}${evolutiva && evolucionada ? ' evol' : ''}${evolutiva && chica ? ' chica' : ''}`
}

/**
 * El SVG de un Avi en una pose (`viewBox` 0 0 120 120, se escala con el contenedor). `personaje`:
 * `{ pj, color }` de `personajeDeNombre` o de `claudeDe`, más `especie` (por defecto el Avi) y
 * `variante` (0..3 o null). Siempre `aria-hidden`: el nombre, si hace falta, lo lleva el contenedor
 * (`avi`). `marca`: el Avi de la marca, con las capas del escenario. `evolucionada`: la forma
 * evolucionada, solo para Claude (clase `evol`; las partes de cada forma llegan con su entrega).
 * Con el Avi y sin `evolucionada`, el SVG es el de siempre, carácter por carácter (13.1). Las otras
 * especies se dibujan con `svgEspecie`; con `variante`, la de ese subagente (7.1), siempre en base.
 */
export function svgAvi(personaje, pose, comando = false, { marca = false, evolucionada = false, claveEvo = null, chica = false } = {}) {
  const { pj, color } = personaje
  const p = { pj, especie: especieValida(personaje.especie), variante: personaje.variante ?? null, soloBase: !!personaje.soloBase }
  const e = POSES.includes(pose) ? pose : 'esperando'
  // Solo Claude puede evolucionar (6.3): con una clave (para cambiar la forma en su lugar) o con la forma pedida
  const evolutiva = esClaude(p) && (claveEvo != null || evolucionada)
  const clase = clasesSvg(p, e, comando, { evolutiva, evolucionada, chica: chica && !marca })
  if (p.especie !== 'avi') return svgEspecie(p.especie, e, comando, clase, { evolutiva, claveEvo, marca, variante: p.variante })
  const w = evolutiva ? capasForma(p.especie, claveEvo) : SIN_FORMA
  if (marca) return svgMarca({ pj, color }, e, comando, clase, w)
  const c = color
  const atras = pj === 'antena' && w.faro ? antenaFaro(c) : (ATRAS[pj]?.(c) ?? '')
  const frente = FRENTE[pj]?.(c) ?? ''
  return `<svg viewBox="0 0 120 120" class="${clase}" aria-hidden="true" focusable="false"${w.attrs}>`
    + `<ellipse class="suelo" cx="60" cy="104" rx="42" ry="9"/>${w.sello}`
    + `<ellipse class="contacto" cx="60" cy="104" rx="26" ry="3.6"/>`
    + `${w.abre}${w.cambio}<g class="cuerpo">${w.evoAtras}${atras}`
    + `<ellipse class="pata" cx="47" cy="101" rx="8.5" ry="4.4"/><ellipse class="pata" cx="73" cy="101" rx="8.5" ry="4.4"/>`
    + `<path class="piel" d="M60 34C84 34 97 52 97 74C97 92 81 102 60 102C39 102 23 92 23 74C23 52 36 34 60 34Z"/>`
    + `<path class="sombreado" d="M25 80C30 95 90 95 95 80C92 99 28 99 25 80Z"/>`
    + `<ellipse class="brillo" cx="43" cy="49" rx="11" ry="5.6" transform="rotate(-30 43 49)"/>`
    + `<ellipse cx="37" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/><ellipse cx="83" cy="81" rx="6.8" ry="3.5" fill="${c}" opacity=".36"/>`
    + `<g class="mirada"><g class="ojos">${ojosDe(e)}</g></g>`
    + `<path class="pico" d="M56 78.5Q60 85.5 64 78.5Q60 76.8 56 78.5Z"/>`
    + `${frente}${w.evoFrente}</g>${w.cambioFin}${w.cierra}`
    + efectos(e, c, comando)
    + `${w.fx}</svg>`
}

/** Hasta este tamaño la cara de Claude es "chica" (mascotas-avi-ux.md 5.5): sin detalle fino ni acto. */
export const TAMANO_CHICA = 44

/**
 * Un Avi de `tamano` px en el ánimo de los datos (pasa por `poseAvi`). Decorativo (`aria-hidden`)
 * donde el texto de al lado ya dice quién es y qué hace; con `alt` lleva `role="img"` y nombre
 * (solo la marca y el vacío, 5.6). `indice`: para el desfase de la respiración. `evolucionada`: la
 * forma evolucionada de Claude (ver `svgAvi`).
 */
export function avi(personaje, animo, tamano, { alt = '', indice = 0, marca = false, evolucionada = false, claveEvo = null } = {}) {
  const { pose, comando } = poseAvi(animo)
  const a11y = alt ? ` role="img" aria-label="${escapar(alt)}"` : ' aria-hidden="true"'
  return `<span class="avi" style="--t:${tamano}px;--d:${desfase(indice)}"${a11y}>${svgAvi(personaje, pose, comando, { marca, evolucionada, claveEvo, chica: tamano <= TAMANO_CHICA })}</span>`
}
