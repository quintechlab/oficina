// Las especies de la mascota (docs/diseno/mascotas-avi-ux.md): el Avi de hoy y seis nuevas. Datos
// puros copiados de `M` y `FIRMA` del boceto aprobado (docs/diseno/bocetos/mascotas-avi.html): nombre,
// nombre de la forma evolucionada, tokens (5.1: `--c` acento, `--mano`, trazo de los ojos ∪ ∩ x),
// centro de los ojos, emisor de las ondas de "coordinando" y rasgo firma (5.2).
// Entrega 2 (13): las partes de la forma evolucionada del Avi (Faro), copiadas de `M.avi` del boceto
// (`evoAtras`, `evoFrente`, `fx`), más las chispas comunes de la vuelta.
// Entrega 3: las seis especies nuevas, copiadas de `M` del boceto: las piezas de la forma base
// (`atras`, `cuerpo`, `ojos`, `boca`, `extra`), las de su forma evolucionada (`evoAtras`, `evoFrente`)
// y las partículas de su acto (`fx`), con sus degradés. Lo único agregado al boceto es la clase
// `evo-fino` en el detalle fino que la forma chica omite (5.5).
// Entrega 4: las 24 variantes de subagente de las especies nuevas (`VARIANTES` del boceto, 7.1) y
// `datosVariante`, que arma cada una igual que `datos` del boceto.

/** Redondeo de las coordenadas generadas (`f` del boceto). */
const f = n => +n.toFixed(2)
/** El lado derecho de un par: el izquierdo espejado (3.2). */
const esp = s => `<g transform="matrix(-1 0 0 1 120 0)">${s}</g>`
/** Par lateral (3.2): envoltura de la forma evolucionada (-e), del acto (-s) y del bucle propio. */
const par = (cls, s) => `<g class="${cls}-e ev ai"><g class="${cls}-s ai"><g class="${cls} ai">${s}</g></g></g><g class="${cls}-e ev ad"><g class="${cls}-s ad"><g class="${cls} ad">${esp(s)}</g></g></g>`
/** Origen en unidades del viewBox y orden de aparición `--k` de una parte (3.2). */
const org = (x, y, k = 0) => `style="transform-box:view-box;transform-origin:${x}px ${y}px;--k:${k}"`

/** Borde mullido: n bultos sobre una elipse (la pelusa de Lumen). */
function festoneado(cx, cy, rx, ry, n, a) {
  let d = ''
  for (let i = 0; i < n; i++) {
    const t0 = i / n * 2 * Math.PI, t1 = (i + 1) / n * 2 * Math.PI, tm = (t0 + t1) / 2
    if (!i) d += `M${f(cx + rx * Math.cos(t0))} ${f(cy + ry * Math.sin(t0))}`
    d += `Q${f(cx + (rx + a * 2) * Math.cos(tm))} ${f(cy + (ry + a * 2) * Math.sin(tm))} ${f(cx + rx * Math.cos(t1))} ${f(cy + ry * Math.sin(t1))}`
  }
  return d + 'Z'
}
/** Ojos cerrados (∪), felices (∩) y en x, en los centros de cada mascota (estilo-avis-ux.md 5.1). */
export function variantesOjos({ x1, x2, y, r }, tr) {
  const st = `stroke="${tr}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"`
  const ce = x => `M${x - r} ${y + 1}Q${x} ${y + 5.5} ${x + r} ${y + 1}`
  const fe = x => `M${x - r} ${y + 2.5}Q${x} ${y - 5} ${x + r} ${y + 2.5}`
  const xx = x => `M${x - 3.5} ${y - 3.5}l7 7m0-7l-7 7`
  return { ce: `<path d="${ce(x1)}${ce(x2)}" ${st}/>`, fe: `<path d="${fe(x1)}${fe(x2)}" ${st}/>`, x: `<path d="${xx(x1)}${xx(x2)}" ${st}/>` }
}

// ------------------------------------------------------------------ Faro (el Avi evolucionado, 5.3)
const alaAvi = `<path d="M31 64C18 52 6 54 3 62C8 63 9 67 5 71C11 72 12 76 9 80C16 79 21 82 25 81C27 76 30 72 33 72Z" fill="#F5EDDC" stroke="#CBBB97" stroke-width="1.2" stroke-linejoin="round"/><path d="M3 62C8 63 9 67 5 71C11 72 12 76 9 80" stroke="#F2B632" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 66L10 63M28 71L12 74" stroke="#CBBB97" stroke-width=".9" fill="none"/>`
const rayosAvi = Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); return `M${f(60 + c * 9)} ${f(10 + s * 9)}L${f(60 + c * 26)} ${f(10 + s * 26)}` }).join('')

/** Chispas de la vuelta (8.3): comunes a todas las especies, del color `--c` de cada una (`g.fx`). */
export const CHISPAS_VUELTA = Array.from({ length: 8 }, (_, i) => `<circle class="pt vu acento" cx="60" cy="64" r="${1.4 + (i % 3) * 0.5}" opacity="0"/>`).join('')

/**
 * Las partes de Faro (5.3): `evoAtras` (detrás del cuerpo: alas, copete y cola de plumas),
 * `evoFrente` (delante: marcas de mejilla y el faro, aro y haces) y `fx` (las partículas del acto: el
 * aro y los ocho haces del estallido y las seis plumas). Las de detalle fino llevan `evo-fino`: la
 * forma chica (≤ 44 px, 5.5) las omite. La antena que crece (`tallo-e`, `foco-e`) la arma avis.js,
 * porque en la marca lleva los grupos que mueve marcaMotion.js.
 */
const FARO = {
  evoAtras: `<g class="evo-p" ${org(60, 72)}>${par('ala', alaAvi)}</g>`
    + `<g class="evo-p" ${org(60, 36, 1)}><path d="M52 38Q42 24 47 13Q51 26 58 34Z" fill="#F2B632"/><path d="M68 38Q78 24 73 13Q69 26 62 34Z" fill="#E9A13B"/></g>`
    + `<g class="evo-p" ${org(88, 90, 2)}><path d="M86 92Q104 92 112 78Q100 84 90 84Z" fill="#F2B632"/><path d="M86 96Q106 100 114 90Q100 94 88 90Z" fill="#E9A13B"/></g>`,
  evoFrente: `<g class="evo-p evo-fino" ${org(60, 80, 2)}><path d="M28.5 77.5H35.5M29.5 81.5H36.5M84.5 77.5H91.5M83.5 81.5H90.5" stroke="#F2B632" stroke-width="1.6" stroke-linecap="round"/></g>`
    + `<g class="evo-p evo-fino" ${org(60, 8, 3)}><g class="rayos" style="transform-box:view-box;transform-origin:60px 8px"><path d="M60 8L32 -14L42 -22Z" fill="url(#gRayo)"/><path d="M60 8L88 -14L78 -22Z" fill="url(#gRayo)"/></g><circle class="aro" cx="60" cy="7.4" r="11" fill="none" stroke="#F2B632" stroke-width="1.4" stroke-dasharray="3 4"/></g>`,
  fx: `<circle class="anillo-f" cx="60" cy="10" r="10" fill="none" stroke="#F2B632" stroke-width="2" opacity="0" ${org(60, 10)}/><g class="rayos-f" opacity="0" ${org(60, 10)}><path d="${rayosAvi}" stroke="#FFD873" stroke-width="2" stroke-linecap="round"/></g>`
    + Array.from({ length: 6 }, (_, i) => `<path class="pt pluma" d="M60 17Q63.4 20.5 60 26Q56.6 20.5 60 17Z" fill="${i % 2 ? '#F5EDDC' : '#F2B632'}" opacity="0"/>`).join(''),
}

// ------------------------------------------------------------------ piezas de las especies nuevas (5.2 y 5.3)
const alaAsDe = (fill = 'url(#gAsAla)', borde = '#E0663E') => `<path d="M36 58C26 44 14 38 6 42C10 48 9 54 6 58C12 59 15 63 14 68C20 66 25 68 27 73C30 68 34 66 38 68Z" fill="${fill}" stroke="${borde}" stroke-width="1.6" stroke-linejoin="round"/><path d="M35 60L10 46M34 63L12 60M34 66L21 68" stroke="${borde}" stroke-width="1" opacity=".55" fill="none"/>`
const alaAs = alaAsDe()
const colaAs = (tronco = '#8C3220', luz = '#C9502F') => `<g class="cola-s"><g class="cola"><path d="M80 97Q100 102 106 88Q110 77 102 71" stroke="${tronco}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M82 96Q99 99 104 88" stroke="${luz}" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".8"/><g class="punta-e ev"><g class="punta"><path d="M101 57Q110 65 106.5 73Q103.5 78.5 99 74.5Q95 67 101 57Z" fill="url(#gAsLlama)"/></g></g></g></g>`
const crestaAs = `<path d="M55.5 31.5L59.5 21.5L63.5 31Z" fill="#F3D7A8"/><path d="M47.5 34.5L48.5 27L53.5 32.5ZM72.5 34.5L71.5 27L66.5 32.5Z" fill="#F3D7A8"/>`
const cuernoAs = `<path d="M45 40Q33 30 37 15Q43 27 54 33Z" fill="#F3D7A8"/><path d="M45 39Q38 31 39.5 21" stroke="#C9A877" stroke-width="1.1" fill="none"/>`
const ojoAs = x => `<ellipse cx="${x}" cy="59" rx="5.8" ry="6.8" fill="#3E140D"/><ellipse cx="${x}" cy="59" rx="4.8" ry="5.8" fill="#FFD166"/><ellipse cx="${x + .6}" cy="59.6" rx="2" ry="4.6" fill="#1A0B07"/><circle cx="${x + 2}" cy="56.2" r="1.5" fill="#fff"/>`

const alaEs = `<path d="M33 58L6 34L12 52L0 58L14 64L6 74L29 72Z" fill="url(#gEsAla)" stroke="#F2FBFF" stroke-width="1" stroke-linejoin="round"/><path d="M31 60L9 39M31 64L5 58M29 68L10 72" stroke="#F2FBFF" stroke-width=".8" opacity=".6" fill="none"/>`
const ojoEs = x => `<ellipse cx="${x}" cy="66" rx="4.8" ry="6" fill="#0B1E4A"/><circle cx="${x + 1.7}" cy="63.6" r="1.7" fill="#fff"/><circle cx="${x - 1.5}" cy="68.2" r=".9" fill="#7DF9FF"/>`
const hombroEs = `<path d="M32 52L14 30L37 44Z" fill="#BFE6FA" stroke="#F2FBFF" stroke-width=".9" stroke-linejoin="round"/><path d="M32 50L20 35" stroke="#fff" stroke-width=".7" opacity=".7"/>`
const hexa = [30, 90, 150, 210, 270, 330].map(g => { const a = g * Math.PI / 180; return `${f(60 + Math.cos(a) * 50)},${f(58 + Math.sin(a) * 50)}` }).join(' ')
function copo() {
  let d = ''
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, c = Math.cos(a), s = Math.sin(a)
    const bx = 60 + c * 13, by = 62 + s * 13
    d += `M60 62L${f(60 + c * 24)} ${f(62 + s * 24)}M${f(bx)} ${f(by)}L${f(bx + Math.cos(a + .7) * 6)} ${f(by + Math.sin(a + .7) * 6)}M${f(bx)} ${f(by)}L${f(bx + Math.cos(a - .7) * 6)} ${f(by + Math.sin(a - .7) * 6)}`
  }
  return `<g class="copo" opacity="0" ${org(60, 62)}><path d="${d}" stroke="#E8F7FF" stroke-width="1.8" stroke-linecap="round" fill="none"/><circle cx="60" cy="62" r="4" fill="#7DF9FF" opacity=".8"/></g>`
}

const orejaNo = `<g transform="rotate(-16 36 42)"><rect x="30" y="6" width="12" height="36" rx="6" fill="url(#gNoCaja)" stroke="#C6FF3D" stroke-opacity=".7" stroke-width="1.2"/><rect x="32.6" y="9" width="6.8" height="10" rx="3.4" fill="#C6FF3D"/><rect x="34.8" y="23" width="2.4" height="12" rx="1.2" fill="#0F1712"/></g>`
const aletaNo = `<path d="M26 54L2 38L8 56L-2 66L12 70L6 84L26 76Z" fill="#C6FF3D" fill-opacity=".14" stroke="#C6FF3D" stroke-width="1.4" stroke-linejoin="round"/><path d="M24 58L6 44M24 64L2 64M24 70L10 80" stroke="#C6FF3D" stroke-width=".8" opacity=".6"/>`
const ojoNo = x => `<rect x="${x - 4}" y="56" width="8" height="10" rx="2" fill="#C6FF3D"/><rect x="${x + .4}" y="57.2" width="2.4" height="2.4" fill="#F4FFE0"/>`

const tentaculos = [['M35 70Q29 82 35 90Q41 98 34 105', '#FF5FD2', 35, 70], ['M47 72Q43 86 49 94Q54 101 48 107', '#B88CFF', 47, 72], ['M60 72Q57 86 62 96Q66 103 60 109', '#FF5FD2', 60, 72], ['M73 72Q77 86 71 94Q66 101 72 107', '#B88CFF', 73, 72], ['M85 70Q91 82 85 90Q79 98 86 105', '#FF5FD2', 85, 70]]
const ojoBr = x => `<ellipse cx="${x}" cy="53" rx="5" ry="6.4" fill="#170A33"/><circle cx="${x + 1.8}" cy="50.4" r="1.8" fill="#fff"/><circle cx="${x - 1.6}" cy="55.4" r=".9" fill="#FF9BEA"/>`
const orbBr = [0, 72, 144, 216, 288].map((g, i) => { const a = g * Math.PI / 180; return `<circle cx="${f(60 + Math.cos(a) * 46)}" cy="${f(50 + Math.sin(a) * 46)}" r="2.1" fill="${i % 2 ? '#7CF7FF' : '#FF7BE0'}"/>` }).join('')

const punoMo = `<ellipse cx="24" cy="84" rx="9.5" ry="10.5" fill="url(#gMoRoca)" stroke="#24222B" stroke-width="1.2"/><path d="M18.5 80.5H28M18 85H27.5" stroke="#24222B" stroke-width="1" opacity=".55"/><path class="ru r4" d="M21 90.5L24 87.5L27 90.5" stroke="#FFC24A" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
const cejaMo = `<path d="M37 51Q48 44 56 50L56 54Q48 49.5 38 54.5Z" fill="#33313D"/>`
const ojoMo = x => `<ellipse cx="${x}" cy="60" rx="5.2" ry="5.6" fill="#1E1A14"/><ellipse cx="${x}" cy="60" rx="3.6" ry="4.2" fill="#FFC24A"/><circle cx="${x + 1}" cy="58.6" r="1.3" fill="#FFF4D0"/>`
const cristalMo = `<path d="M40 40L30 18L47 34Z" fill="url(#gMoCristal)" stroke="#FFF1C2" stroke-width=".7" stroke-linejoin="round"/><path d="M40 40L35 25L43 35Z" fill="#FFF1C2" opacity=".55"/>`
const rocas = [[18, 101], [34, 102], [62, 102], [84, 102], [100, 101]].map(([x, y], i) => `<path class="pt roca" d="M${x} ${y}l${2 + i % 2} -5l4 1l1 4z" fill="${i % 2 ? '#726E82' : '#A9A5B8'}" opacity="0"/>`).join('')

const alaLu = `<path d="M42 60C22 30 4 30 3 48C2 62 18 72 40 70Z" fill="url(#gLuAlaS)" stroke="#FFD9B0" stroke-width=".9"/><path d="M40 64L13 42M40 67L8 58" stroke="#FFD9B0" stroke-width=".7" opacity=".45" fill="none"/><circle cx="19" cy="50" r="7.4" fill="#2A1033"/><circle class="ocelo" cx="19" cy="50" r="5.6" fill="#5CE1E6"/><circle cx="19" cy="50" r="2.4" fill="#12303A"/><circle cx="20.2" cy="48.6" r=".9" fill="#fff"/><circle class="ocelo-f" cx="19" cy="50" r="8.5" fill="#BFFBFF" opacity="0"/><path d="M43 76C26 77 14 90 22 100C30 106 40 97 46 85Z" fill="url(#gLuAlaI)" stroke="#FFD9B0" stroke-width=".9"/>`
const antLu = `<path d="M55 38Q44 26 33 11Q46 16 51 25Q55 31 55 38Z" fill="#F0C08F"/><path d="M55 38Q45 25 34 12" stroke="#C98F62" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
const colaLu = `<path d="M30 96Q16 108 22 120Q29 110 35 101Z" fill="url(#gLuAlaI)" stroke="#FFD9B0" stroke-width=".8"/><circle cx="23" cy="114" r="2" fill="#5CE1E6"/>`
const ojoLu = x => `<ellipse cx="${x}" cy="63" rx="6.4" ry="7.4" fill="#1E1220"/><circle cx="${x + 2}" cy="60" r="2.2" fill="#fff"/><circle cx="${x - 2.2}" cy="65.8" r="1" fill="#FFD9B0"/>`

// ------------------------------------------------------------------ las seis especies nuevas
// Las piezas de la forma base y las de la forma evolucionada, de `M` del boceto. Pares laterales con
// `par` (3.2); las partes `.evo-p` con su origen y su orden `--k`; el detalle fino, con `evo-fino` (5.5).

/** ascua: las piezas de la forma base (`M.ascua` del boceto). */
const ASCUA = {
  atras: `${colaAs()}${par('ala', alaAs)}<g class="cuernos-e ev">${cuernoAs}${esp(cuernoAs)}</g>`,
  cuerpo: `<ellipse cx="46" cy="102" rx="9" ry="4.4" fill="#7A2A1C"/><ellipse cx="74" cy="102" rx="9" ry="4.4" fill="#7A2A1C"/>`
    + `<path d="M60 30C83 30 95 48 95 68C95 90 82 103 60 103C38 103 25 90 25 68C25 48 37 30 60 30Z" fill="url(#gAsPiel)"/>`
    + crestaAs
    + `<ellipse cx="44" cy="45" rx="10" ry="4.6" transform="rotate(-30 44 45)" fill="#fff" opacity=".22"/>`
    + `<path d="M45 89Q60 83 75 89Q76 101 60 102Q44 101 45 89Z" fill="#E9946A"/><path d="M47 94H73M49 98.5H71" stroke="#B8452A" stroke-width="1.2" fill="none" opacity=".55" stroke-linecap="round"/>`
    + `<circle class="brasa" cx="60" cy="92.5" r="8" fill="url(#gAsBrasa)"/><path d="M60 87.5L63.4 92.5L60 97.5L56.6 92.5Z" fill="url(#gAsBrasa)" stroke="#FFF1B8" stroke-width=".8"/>`
    + `<ellipse cx="35" cy="70" rx="5.6" ry="3" fill="#FFB054" opacity=".5"/><ellipse cx="85" cy="70" rx="5.6" ry="3" fill="#FFB054" opacity=".5"/>`
    + `<ellipse cx="60" cy="73.5" rx="12.5" ry="7.4" fill="#E27A52"/><ellipse cx="60" cy="71.4" rx="8.5" ry="3" fill="#F5A07A" opacity=".55"/><ellipse cx="55.6" cy="72" rx="1.3" ry=".9" fill="#5E2116"/><ellipse cx="64.4" cy="72" rx="1.3" ry=".9" fill="#5E2116"/>`,
  ojos: ojoAs(46) + ojoAs(74),
  boca: `<path d="M54 77Q60 81 66 77" stroke="#5E2116" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M62.4 78.6L63.4 81.4L64.6 78Z" fill="#FFF6E6"/>`,
}
/** ascua: las partes de su forma evolucionada y las partículas del acto. */
const PIRA = {
  evoAtras: `<g class="evo-p" ${org(60, 32)}><path class="llamita" d="M51 34Q45 24 50 14Q54 25 57 31Z" fill="url(#gAsLlama)"/><path class="llamita l2" d="M60 31Q53 16 60 2Q67 16 60 31Z" fill="url(#gAsLlama)"/><path class="llamita" d="M69 34Q75 24 70 14Q66 25 63 31Z" fill="url(#gAsLlama)"/></g>`,
  evoFrente: `<g class="evo-p evo-fino" ${org(60, 72, 2)}><path class="vetas" d="M32 56Q37 64 33 72Q30 79 34 86M88 56Q83 64 87 72Q90 79 86 86" stroke="#FFC15A" stroke-width="1.7" fill="none" stroke-linecap="round"/></g>`,
  fx: `<g class="llama" opacity="0" ${org(66, 78)}><path d="M66 78C76 66 96 62 124 66C113 72 113 81 124 88C98 92 78 90 66 78Z" fill="url(#gAsFuego)"/><path d="M66 78C76 72 90 70 106 72C99 76 99 80 106 84C90 86 76 84 66 78Z" fill="#FFF6C9" opacity=".85"/></g>`
    + Array.from({ length: 9 }, (_, i) => `<circle class="pt em" cx="${74 + (i % 3) * 2}" cy="${76 + (i % 2) * 2}" r="${1.3 + (i % 3) * .5}" fill="${i % 2 ? '#FFC15A' : '#FFF1B8'}" opacity="0"/>`).join('')
    + `<circle class="anillo" cx="100" cy="76" r="12" fill="none" stroke="#FFC15A" stroke-width="2" opacity="0" ${org(100, 76)}/>`,
}

/** escarcha: las piezas de la forma base (`M.escarcha` del boceto). */
const ESCARCHA = {
  atras: `<path d="M78 98L104 106L97 98L112 95L90 89Z" fill="#7FBCEB" stroke="#E8F7FF" stroke-width=".9" stroke-linejoin="round"/>${par('ala', alaEs)}`
    + `<g class="puas-e ev"><g class="puas-s"><path d="M46 38L37 10L55 32Z" fill="#BFE6FA" stroke="#F2FBFF" stroke-width=".9" stroke-linejoin="round"/><path d="M55 31L61 1L67 31Z" fill="#E3F5FF" stroke="#F2FBFF" stroke-width=".9" stroke-linejoin="round"/><path d="M74 38L84 12L66 32Z" fill="#A9D8F5" stroke="#F2FBFF" stroke-width=".9" stroke-linejoin="round"/><path d="M61 4V28" stroke="#fff" stroke-width=".8" opacity=".7"/><path class="chisp" d="M61 -4l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" fill="#fff"/></g></g>`,
  cuerpo: `<path d="M40 99L46 105L52 99L46 95ZM68 99L74 105L80 99L74 95Z" fill="#6FA6E0" stroke="#E8F7FF" stroke-width=".7"/>`
    + `<path d="M60 28L83 38L95 66L88 94L60 103L32 94L25 66L37 38Z" fill="url(#gEsCuerpo)" stroke="#E8F7FF" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<path d="M60 28L37 38L25 66L48 56Z" fill="#fff" opacity=".45"/><path d="M60 28L83 38L95 66L72 56Z" fill="#DDF2FD" opacity=".35"/><path d="M25 66L40 80L60 90L60 103L32 94Z" fill="#6FA6E0" opacity=".55"/><path d="M95 66L80 80L60 90L60 103L88 94Z" fill="#3F6FC0" opacity=".6"/><path d="M48 56L72 56L80 80L60 90L40 80Z" fill="#EEF9FF" opacity=".55"/>`
    + `<path d="M48 56L60 28L72 56M40 80L25 66M80 80L95 66M60 90V103" stroke="#fff" stroke-width=".7" opacity=".55" fill="none"/>`
    + `<g clip-path="url(#cEs)"><path class="barrido" d="M8 20L18 20L2 110L-8 110Z" fill="#fff" opacity=".5"/></g>`
    + `<ellipse cx="43" cy="75" rx="4.4" ry="2.4" fill="#B7A6FF" opacity=".7"/><ellipse cx="77" cy="75" rx="4.4" ry="2.4" fill="#B7A6FF" opacity=".7"/><path d="M57.6 73.5H62.4L60 76.5Z" fill="#3F6FC0"/>`,
  ojos: ojoEs(50) + ojoEs(70),
  boca: `<path d="M55.5 79Q60 82 64.5 79" stroke="#22407A" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
}
/** escarcha: las partes de su forma evolucionada y las partículas del acto. */
const GLACIAR = {
  evoAtras: `<g class="evo-p evo-fino" ${org(60, 58)}><polygon class="hexa" points="${hexa}" fill="none" stroke="#7DF9FF" stroke-width="1.2" stroke-dasharray="4 5" opacity=".55" style="transform-box:view-box;transform-origin:60px 58px"/></g>`
    + `<g class="evo-p" ${org(60, 48, 1)}>${hombroEs}${esp(hombroEs)}</g>`,
  evoFrente: `<path class="evo-p evo-fino" d="M60 44.5L63.6 50L60 55.5L56.4 50Z" fill="#7DF9FF" stroke="#fff" stroke-width=".8" ${org(60, 50, 2)}/>`
    + `<g class="evo-p evo-fino" ${org(60, 64, 3)}><g class="orb-es"><path d="M104 61l3 4.2-3 4.2-3-4.2z" fill="#E8F7FF"/><path d="M15 68l2.4 3.4-2.4 3.4-2.4-3.4z" fill="#7DF9FF"/></g></g>`,
  fx: copo() + Array.from({ length: 10 }, (_, i) => `<path class="pt esq" d="M60 58.5L62.2 62L60 65.5L57.8 62Z" fill="${i % 2 ? '#7DF9FF' : '#F2FBFF'}" opacity="0"/>`).join(''),
}

/** nodo: las piezas de la forma base (`M.nodo` del boceto). */
const NODO = {
  atras: par('oreja', orejaNo),
  cuerpo: `<rect x="35" y="97" width="17" height="8" rx="4" fill="#1B201D" stroke="#C6FF3D" stroke-opacity=".35"/><rect x="68" y="97" width="17" height="8" rx="4" fill="#1B201D" stroke="#C6FF3D" stroke-opacity=".35"/>`
    + `<rect x="24" y="34" width="72" height="66" rx="24" fill="url(#gNoCaja)" stroke="#C6FF3D" stroke-opacity=".5" stroke-width="1.2"/>`
    + `<path d="M38 38.5Q60 34 82 38.5" stroke="#8A9A90" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`
    + `<rect x="32" y="46" width="56" height="36" rx="11" fill="url(#gNoPant)" stroke="#0A0E0B" stroke-width="1.6"/>`
    + `<g clip-path="url(#cNo)"><rect class="scan" x="32" y="44" width="56" height="3" fill="#C6FF3D" opacity=".14"/><path d="M34 47L52 47L38 62Z" fill="#fff" opacity=".05"/></g>`
    + `<rect x="36" y="68.5" width="6" height="2" rx="1" fill="#5CFFB0" opacity=".6"/><rect x="78" y="68.5" width="6" height="2" rx="1" fill="#5CFFB0" opacity=".6"/>`
    + `<circle class="led" cx="52" cy="91" r="1.9" fill="#C6FF3D"/><circle class="led l2" cx="60" cy="91" r="1.9" fill="#C6FF3D"/><circle class="led l3" cx="68" cy="91" r="1.9" fill="#C6FF3D"/>`,
  ojos: ojoNo(48) + ojoNo(72),
  boca: `<path d="M55 72.5h2.5v2h5v-2H65" stroke="#C6FF3D" stroke-width="1.6" fill="none" stroke-linejoin="round"/><rect class="flash-pant" x="32" y="46" width="56" height="36" rx="11" fill="#C6FF3D" opacity="0"/>`,
  extra: `<g class="orbita" opacity=".85"><rect x="100" y="64" width="4" height="4" fill="#C6FF3D"/><rect x="15" y="60" width="3" height="3" fill="#5CFFB0"/><rect x="79" y="29" width="3" height="3" fill="#C6FF3D"/></g>`,
}
/** nodo: las partes de su forma evolucionada y las partículas del acto. */
const NODO_OMEGA = {
  evoAtras: `<g class="evo-p" ${org(60, 66)}>${aletaNo}${esp(aletaNo)}<circle class="aura evo-fino" cx="60" cy="66" r="52" fill="none" stroke="#C6FF3D" stroke-width="1.2" stroke-dasharray="2 7" opacity=".7" ${org(60, 66)}/></g>`,
  evoFrente: `<g class="evo-p" ${org(60, -4, 2)}><g class="corona"><rect x="50" y="-4" width="5" height="5" fill="#C6FF3D"/><rect x="57.5" y="-10" width="5" height="5" fill="#E9FFB8"/><rect x="65" y="-4" width="5" height="5" fill="#C6FF3D"/></g></g>`,
  fx: `<rect class="linea" x="4" y="67" width="112" height="2" rx="1" fill="#E9FFB8" opacity="0" ${org(60, 68)}/>`
    + [30, 40, 50, 60, 70, 80, 90].map(x => `<rect class="pt rayo" x="${x}" y="52" width="1.6" height="16" fill="#C6FF3D" opacity="0"/>`).join(''),
}

/** bruma: las piezas de la forma base (`M.bruma` del boceto). */
const BRUMA = {
  atras: `<g class="tents-e ev"><g class="tents">${tentaculos.map(([d, c, x, y], i) => `<path class="tent t${i + 1}" d="${d}" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".9" ${org(x, y)}/>`).join('')}</g></g>`,
  cuerpo: `<path d="M60 28C86 28 98 48 96 70Q90 76 84 71Q78 78 72 72Q66 79 60 73Q54 79 48 72Q42 78 36 71Q30 76 24 70C22 48 34 28 60 28Z" fill="url(#gBrCampana)"/>`
    + `<path d="M28 66Q60 74 92 66" stroke="#E9D5FF" stroke-width="1.2" fill="none" opacity=".35"/><ellipse cx="60" cy="44" rx="20" ry="10" fill="#EBDDFF" opacity=".16"/>`
    + `<path d="M38 38Q60 22 82 38" stroke="#F1E6FF" stroke-width="1.8" fill="none" opacity=".55" stroke-linecap="round"/>`
    + `<circle class="spot" cx="38" cy="45" r="2.1" fill="#FF7BE0"/><circle class="spot s2" cx="82" cy="42" r="1.8" fill="#FF7BE0"/><circle class="spot s3" cx="88" cy="58" r="1.4" fill="#7CF7FF"/><circle class="spot s4" cx="31" cy="59" r="1.4" fill="#7CF7FF"/>`
    + `<ellipse cx="39" cy="61" rx="5" ry="2.6" fill="#FF7BE0" opacity=".55"/><ellipse cx="81" cy="61" rx="5" ry="2.6" fill="#FF7BE0" opacity=".55"/>`,
  ojos: ojoBr(49) + ojoBr(71),
  boca: `<ellipse cx="60" cy="62.5" rx="2.4" ry="2" fill="#170A33"/>`,
}
/** bruma: las partes de su forma evolucionada y las partículas del acto. */
const REGIA = {
  evoAtras: `<g class="evo-p" ${org(60, 32)}><path d="M37 37Q40 20 48 30Q52 10 60 25Q68 10 72 30Q80 20 83 37Z" fill="#FF5FD2" opacity=".92"/><path d="M45 34Q50 24 54 31M66 31Q70 24 75 34" stroke="#FFD3F4" stroke-width="1" fill="none" opacity=".7"/></g>`
    + `<g class="evo-p evo-fino" ${org(60, 72, 1)}><path class="hilo" d="M41 72Q33 92 42 104Q48 112 40 120" stroke="#7CF7FF" stroke-width="1.6" fill="none" opacity=".85" stroke-linecap="round" ${org(41, 72)}/><path class="hilo h2" d="M79 72Q87 92 78 104Q72 112 80 120" stroke="#7CF7FF" stroke-width="1.6" fill="none" opacity=".85" stroke-linecap="round" ${org(79, 72)}/></g>`
    + `<g class="evo-p evo-fino" ${org(60, 50, 2)}><g class="orb-br">${orbBr}</g></g>`,
  evoFrente: `<g class="evo-p evo-fino" ${org(60, 42, 1)}><g class="bandas"><path d="M33 44Q60 34 87 44" stroke="#FF7BE0" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M27 66Q60 75 93 66" stroke="#7CF7FF" stroke-width="1.3" fill="none" stroke-linecap="round" opacity=".8"/></g></g>`,
  fx: [0, 1, 2].map(i => `<circle class="anb" cx="60" cy="52" r="16" fill="none" stroke="${i === 1 ? '#7CF7FF' : '#FF5FD2'}" stroke-width="2" opacity="0" ${org(60, 52)}/>`).join('')
    + Array.from({ length: 10 }, (_, i) => `<circle class="pt pl" cx="${34 + i * 5.6}" cy="${70 + (i * 7) % 18}" r="${1 + (i % 3) * .4}" fill="${i % 3 ? '#FFB3EE' : '#7CF7FF'}" opacity="0"/>`).join(''),
}

/** morro: las piezas de la forma base (`M.morro` del boceto). */
const MORRO = {
  atras: `<g class="musgo"><path d="M43 34Q44 25 51 30Q54 21 60 28Q66 20 69 30Q75 25 77 34Z" fill="#6E9E5A"/><path d="M50 32Q53 26 57 30Q61 25 64 31Z" fill="#A6D18A"/></g>`,
  cuerpo: `<rect x="35" y="96" width="19" height="9" rx="4.5" fill="#3A3845"/><rect x="66" y="96" width="19" height="9" rx="4.5" fill="#3A3845"/>`
    + `<path d="M36 40Q38 31 48 30L74 30Q84 31 86 40L94 76Q96 97 82 101L38 101Q24 97 26 76Z" fill="url(#gMoRoca)" stroke="#24222B" stroke-width="1.2"/>`
    + `<path d="M44 34L72 33L64 46L41 48Z" fill="#C9C5D6" opacity=".2"/><path d="M89 49L84 56L87 62M33 84L39 89L37 95" stroke="#24222B" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<circle class="ruglow" cx="60" cy="87" r="11" fill="url(#gMoRuna)"/>`
    + `<path class="ru" d="M57 35.5L60 40.5L63 35.5M60 40.5V45" stroke="#FFC24A" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<circle class="ru r2" cx="60" cy="87" r="6" stroke="#FFC24A" stroke-width="1.6" fill="none"/><path class="ru r3" d="M60 82V92M55.5 87H64.5" stroke="#FFC24A" stroke-width="1.6" stroke-linecap="round"/>`
    + `${cejaMo}${esp(cejaMo)}<ellipse cx="38" cy="70" rx="5" ry="2.6" fill="#FF9F7A" opacity=".3"/><ellipse cx="82" cy="70" rx="5" ry="2.6" fill="#FF9F7A" opacity=".3"/>`
    + par('puno', punoMo),
  ojos: ojoMo(47) + ojoMo(73),
  boca: `<path d="M52 74L56 76.2L60 74.6L64 76.2L68 74" stroke="#24222B" stroke-width="1.8" fill="none" stroke-linejoin="round" stroke-linecap="round"/><g class="flare" opacity="0"><circle cx="47" cy="60" r="9" fill="url(#gMoRuna)"/><circle cx="73" cy="60" r="9" fill="url(#gMoRuna)"/></g>`,
}
/** morro: las partes de su forma evolucionada y las partículas del acto. */
const MONOLITO = {
  evoAtras: `<g class="evo-p" ${org(60, 36)}>${cristalMo}${esp(cristalMo)}<path d="M55 32L60 10L65 32Z" fill="url(#gMoCristal)" stroke="#FFF1C2" stroke-width=".7" stroke-linejoin="round"/><path d="M58 30L60 15L62 30Z" fill="#FFF1C2" opacity=".6"/></g>`,
  evoFrente: `<g class="evo-p evo-fino" ${org(60, 70, 1)}><path d="M31 63L35 67L31 71M89 63L85 67L89 71M48 92L44 97M72 92L76 97" stroke="#FFC24A" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`
    + `<g class="evo-p evo-fino" ${org(60, 46, 2)}><g class="orb-mo"><path d="M103 30l3-4 4 1 1 4-4 2z" fill="#A9A5B8"/><path d="M13 44l3-3 3 1 0 3-3 2z" fill="#726E82"/><path d="M62 -4l2-3 3 1 0 3-3 1z" fill="#A9A5B8"/></g></g>`,
  fx: `<ellipse class="pt polvo" cx="40" cy="103" rx="9" ry="3" fill="#A9A5B8" opacity="0"/><ellipse class="pt polvo" cx="80" cy="103" rx="9" ry="3" fill="#A9A5B8" opacity="0"/>${rocas}`,
}

/** lumen: las piezas de la forma base (`M.lumen` del boceto). */
const LUMEN = {
  atras: `<circle class="halo-l" cx="60" cy="66" r="46" fill="url(#gLuHalo)" opacity="0" ${org(60, 66)}/>${par('ant', antLu)}${par('ala', alaLu)}`,
  cuerpo: `<ellipse cx="50" cy="102" rx="5" ry="3" fill="#C98F62"/><ellipse cx="70" cy="102" rx="5" ry="3" fill="#C98F62"/>`
    + `<path d="${festoneado(60, 70, 30, 31, 22, 1.5)}" fill="url(#gLuPiel)"/>`
    + `<ellipse cx="45" cy="50" rx="10" ry="5" transform="rotate(-30 45 50)" fill="#fff" opacity=".4"/>`
    + `<path d="${festoneado(60, 86, 19, 7, 12, 1.3)}" fill="#FFF6EA" opacity=".9"/>`
    + `<ellipse cx="37" cy="74" rx="5.4" ry="2.8" fill="#FF8A8A" opacity=".5"/><ellipse cx="83" cy="74" rx="5.4" ry="2.8" fill="#FF8A8A" opacity=".5"/>`
    + `<circle class="mota-i" cx="14" cy="72" r="1.3" fill="#FFE9A8"/><circle class="mota-i m2" cx="106" cy="66" r="1.3" fill="#FFE9A8"/>`,
  ojos: ojoLu(48) + ojoLu(72),
  boca: `<path d="M57.5 74Q60 76 62.5 74" stroke="#8A4B3A" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
}
/** lumen: las partes de su forma evolucionada y las partículas del acto. */
const AURORA = {
  evoAtras: `<g class="evo-p evo-fino" ${org(60, 40)}><path class="aur" d="M2 44Q30 22 60 32Q90 42 118 22" stroke="#5CE1E6" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/><path class="aur a2" d="M4 54Q32 34 60 42Q88 50 116 34" stroke="#FFB37A" stroke-width="2" fill="none" stroke-linecap="round" opacity=".5"/></g>`
    + `<g class="evo-p" ${org(60, 98, 1)}>${colaLu}${esp(colaLu)}</g>`,
  evoFrente: `<g class="evo-p evo-fino" ${org(60, 38, 2)}><g class="tiara"><circle cx="53" cy="40.5" r="1.7" fill="#FFE9A8"/><path d="M60 32.5l1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z" fill="#5CE1E6"/><circle cx="67" cy="40.5" r="1.7" fill="#FFE9A8"/></g></g>`,
  fx: `<g class="espiral" ${org(60, 66)}>${Array.from({ length: 12 }, (_, i) => `<circle class="pt mo" cx="60" cy="66" r="${1.5 + (i % 3) * .45}" fill="${i % 4 ? '#FFE9A8' : '#5CE1E6'}" opacity="0"/>`).join('')}</g>`,
}

/**
 * Degradés y recortes de las especies, para `defsAvis()` (5.1): una vez por documento, con los ids del
 * boceto. Los haces del faro (Faro), las pieles, alas, llamas y brillos de las especies nuevas y la luz
 * de piso de cada una (`gSu-<especie>`; el Avi usa `gSuelo`, el de siempre).
 */
export const DEGRADES_ESPECIES = [
  '<radialGradient id="gRayo" gradientUnits="userSpaceOnUse" cx="60" cy="8" r="34"><stop offset="0" stop-color="#FFF1C2" stop-opacity=".85"/><stop offset=".6" stop-color="#FFD873" stop-opacity=".3"/><stop offset="1" stop-color="#FFD873" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gAsPiel" cx="38%" cy="26%" r="80%"><stop offset="0" stop-color="#F08A5D"/><stop offset=".45" stop-color="#C9502F"/><stop offset=".85" stop-color="#8C3220"/><stop offset="1" stop-color="#5E2116"/></radialGradient>',
  '<radialGradient id="gAsBrasa" cx="50%" cy="35%" r="65%"><stop offset="0" stop-color="#FFF1B8"/><stop offset=".35" stop-color="#FFC15A"/><stop offset=".75" stop-color="#FF7A2E"/><stop offset="1" stop-color="#D9471C"/></radialGradient>',
  '<linearGradient id="gAsAla" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8C3220"/><stop offset="1" stop-color="#3E140D"/></linearGradient>',
  '<radialGradient id="gAsLlama" cx="50%" cy="75%" r="70%"><stop offset="0" stop-color="#FFF6C9"/><stop offset=".35" stop-color="#FFD45A"/><stop offset=".75" stop-color="#FF7A2E"/><stop offset="1" stop-color="#E0401A"/></radialGradient>',
  '<linearGradient id="gAsFuego" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFF6C9"/><stop offset=".25" stop-color="#FFD45A"/><stop offset=".6" stop-color="#FF7A2E"/><stop offset=".9" stop-color="#E0401A" stop-opacity=".6"/><stop offset="1" stop-color="#E0401A" stop-opacity="0"/></linearGradient>',
  '<linearGradient id="gEsCuerpo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2FBFF"/><stop offset=".4" stop-color="#BFE6FA"/><stop offset=".75" stop-color="#7FBCEB"/><stop offset="1" stop-color="#4A7FD0"/></linearGradient>',
  '<linearGradient id="gEsAla" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3F5FF"/><stop offset="1" stop-color="#6FA6E0"/></linearGradient>',
  '<clipPath id="cEs"><path d="M60 28L83 38L95 66L88 94L60 103L32 94L25 66L37 38Z"/></clipPath>',
  '<linearGradient id="gNoCaja" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#56635B"/><stop offset=".55" stop-color="#2E3631"/><stop offset="1" stop-color="#1B201D"/></linearGradient>',
  '<linearGradient id="gNoPant" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121B15"/><stop offset="1" stop-color="#060907"/></linearGradient>',
  '<clipPath id="cNo"><rect x="32" y="46" width="56" height="36" rx="11"/></clipPath>',
  '<radialGradient id="gBrCampana" cx="45%" cy="30%" r="75%"><stop offset="0" stop-color="#D2B4FF"/><stop offset=".42" stop-color="#8A4DFF"/><stop offset=".8" stop-color="#5323C9"/><stop offset="1" stop-color="#2E1170"/></radialGradient>',
  '<radialGradient id="gMoRoca" cx="40%" cy="25%" r="85%"><stop offset="0" stop-color="#A9A5B8"/><stop offset=".45" stop-color="#726E82"/><stop offset=".8" stop-color="#4A4757"/><stop offset="1" stop-color="#2F2D38"/></radialGradient>',
  '<radialGradient id="gMoRuna"><stop offset="0" stop-color="#FFE6A0" stop-opacity=".9"/><stop offset=".5" stop-color="#F2B632" stop-opacity=".45"/><stop offset="1" stop-color="#F2B632" stop-opacity="0"/></radialGradient>',
  '<linearGradient id="gMoCristal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1C2"/><stop offset=".5" stop-color="#FFC24A"/><stop offset="1" stop-color="#C98A12"/></linearGradient>',
  '<radialGradient id="gLuPiel" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#FFF8EE"/><stop offset=".45" stop-color="#FFE3C2"/><stop offset=".8" stop-color="#F0C08F"/><stop offset="1" stop-color="#C98F62"/></radialGradient>',
  '<linearGradient id="gLuAlaS" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFB37A"/><stop offset=".45" stop-color="#FF7E6B"/><stop offset=".8" stop-color="#B8437A"/><stop offset="1" stop-color="#5E2350"/></linearGradient>',
  '<linearGradient id="gLuAlaI" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFC98F"/><stop offset=".55" stop-color="#E06A6A"/><stop offset="1" stop-color="#6B2A55"/></linearGradient>',
  '<radialGradient id="gLuHalo"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".75"/><stop offset="1" stop-color="#FFB37A" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gSu-ascua"><stop offset="0" stop-color="#FF7A2E" stop-opacity=".26"/><stop offset="1" stop-color="#FF7A2E" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gSu-escarcha"><stop offset="0" stop-color="#7DF9FF" stop-opacity=".22"/><stop offset="1" stop-color="#7DF9FF" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gSu-nodo"><stop offset="0" stop-color="#C6FF3D" stop-opacity=".2"/><stop offset="1" stop-color="#C6FF3D" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gSu-bruma"><stop offset="0" stop-color="#FF5FD2" stop-opacity=".24"/><stop offset="1" stop-color="#FF5FD2" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gSu-morro"><stop offset="0" stop-color="#FFC24A" stop-opacity=".22"/><stop offset="1" stop-color="#FFC24A" stop-opacity="0"/></radialGradient>',
  '<radialGradient id="gSu-lumen"><stop offset="0" stop-color="#FFB37A" stop-opacity=".24"/><stop offset="1" stop-color="#FFB37A" stop-opacity="0"/></radialGradient>',
].join('')

/** Las especies, en el orden de la dirección. Es la lista que acepta `preferencias.json` (9.1). */
export const NOMBRES_ESPECIES = ['avi', 'ascua', 'escarcha', 'nodo', 'bruma', 'morro', 'lumen']

/** Sin elección, con basura o con un valor desconocido: el Avi (9.1). */
export const ESPECIE_POR_DEFECTO = 'avi'

/** La especie si es una de las siete (texto exacto); si no, el Avi. */
export function especieValida(especie) {
  return NOMBRES_ESPECIES.includes(especie) ? especie : ESPECIE_POR_DEFECTO
}

/**
 * Datos de cada especie (tabla 5.1 y 5.2). `ojo`: centros y radio de los ojos (x1, x2, y, r), donde
 * se dibujan los ojos ∪, ∩ y x; `emisor`: el punto de donde salen las ondas de "coordinando";
 * `flota`: no camina (Bruma: contacto de `rx` 20); `piezas`: el dibujo de la forma base de las
 * especies nuevas (el Avi se dibuja con el generador de siempre, avis.js); `evo`: su forma evolucionada.
 */
export const ESPECIES = {
  avi: {
    nombre: 'Avi', evoNombre: 'Faro', c: '#F2B632', mano: '#EFE6D2', trazo: '#1B1712',
    ojo: { x1: 49, x2: 71, y: 70, r: 4.5 }, emisor: [60, 14], firma: 'la antena con foco',
    evo: FARO,
  },
  ascua: {
    nombre: 'Ascua', evoNombre: 'Pira', c: '#FF7A2E', mano: '#E27A52', trazo: '#2A0F08',
    ojo: { x1: 46, x2: 74, y: 59, r: 4.6 }, emisor: [60, 20], firma: 'escamas naranja, cuernos hueso curvos y cresta',
    piezas: ASCUA, evo: PIRA,
  },
  escarcha: {
    nombre: 'Escarcha', evoNombre: 'Glaciar', c: '#7DF9FF', mano: '#BFE6FA', trazo: '#0B1E4A',
    ojo: { x1: 50, x2: 70, y: 66, r: 4.4 }, emisor: [61, 4], firma: 'las tres púas y el celeste hielo',
    piezas: ESCARCHA, evo: GLACIAR,
  },
  nodo: {
    nombre: 'Nodo', evoNombre: 'Nodo Ω', c: '#C6FF3D', mano: '#56635B', trazo: '#C6FF3D',
    ojo: { x1: 48, x2: 72, y: 61, r: 4.2 }, emisor: [60, 22], firma: 'orejas de antena y pantalla lima',
    piezas: NODO, evo: NODO_OMEGA,
  },
  bruma: {
    nombre: 'Bruma', evoNombre: 'Regia', c: '#FF5FD2', mano: '#B88CFF', trazo: '#170A33',
    ojo: { x1: 49, x2: 71, y: 53, r: 4.6 }, emisor: [60, 28], firma: 'campana violeta con bioluz magenta', flota: true,
    piezas: BRUMA, evo: REGIA,
  },
  morro: {
    nombre: 'Morro', evoNombre: 'Monolito', c: '#FFC24A', mano: '#726E82', trazo: '#FFC24A',
    ojo: { x1: 47, x2: 73, y: 60, r: 4 }, emisor: [60, 40], firma: 'basalto con runas ámbar y musgo',
    piezas: MORRO, evo: MONOLITO,
  },
  lumen: {
    nombre: 'Lumen', evoNombre: 'Aurora', c: '#FFB37A', mano: '#F0C08F', trazo: '#1E1220',
    ojo: { x1: 48, x2: 72, y: 63, r: 5 }, emisor: [60, 24], firma: 'alas coral con ocelos turquesa',
    piezas: LUMEN, evo: AURORA,
  },
}

/**
 * Las partes de la forma evolucionada de una especie (`{ evoAtras, evoFrente, fx }`): las de detrás y
 * delante del cuerpo y las partículas de su acto. Las siete las tienen.
 */
export function partesEvolucion(especie) {
  return ESPECIES[especieValida(especie)].evo ?? null
}

/** Los datos de una especie; los del Avi si no se conoce. */
export function datosEspecie(especie) {
  return ESPECIES[especieValida(especie)]
}

// ------------------------------------------------------------------ voz y juegos de la marca (entrega 5)

/**
 * Los canales de la marca en cada especie nueva (mascotas-avi-ux.md 10, P2 y P3): las pistas de
 * `ACTOS` y `VOCES` (marca.js) son las del Avi; cambia la pieza que mueve cada canal.
 * - `ant`: el apéndice que sigue, en lugar de la antena: alas (Ascua, Escarcha), orejas (Nodo),
 *   tentáculos (Bruma), el musgo de la coronilla (Morro) y las antenas (Lumen). Los pares giran
 *   espejados (`--s`).
 * - `luz`: la luz propia, en lugar del foco (`crece`, con luz > 0) y del bulbo (`apaga`, con luz < 0):
 *   la brasa, el destello de la púa, los LEDs, las manchas, las runas y los ocelos (el destello y el
 *   ocelo mismo). Son las piezas que el acto de cada especie ya enciende (evolucionMotion.js).
 * - `boca`: donde se abre la boca de la especie (`y`, el centro de su trazo) y su color (el de su boca).
 * Con el Avi, `null`: la antena, el foco, el bulbo y el pico de siempre.
 */
const CANALES = {
  ascua: { ant: '.ala', luz: { crece: ['.brasa'], apaga: ['.brasa'] }, boca: { y: 79, color: '#5E2116' } },
  escarcha: { ant: '.ala', luz: { crece: ['.chisp'], apaga: ['.chisp'] }, boca: { y: 80.5, color: '#22407A' } },
  nodo: { ant: '.oreja', luz: { crece: ['.led'], apaga: ['.led'] }, boca: { y: 73.5, color: '#C6FF3D' } },
  bruma: { ant: '.tents', luz: { crece: ['.spot'], apaga: ['.spot'] }, boca: { y: 62.5, color: '#170A33' } },
  morro: { ant: '.musgo', luz: { crece: ['.ru', '.ruglow'], apaga: ['.ru', '.ruglow'] }, boca: { y: 75, color: '#24222B' } },
  lumen: { ant: '.ant', luz: { crece: ['.ocelo-f'], apaga: ['.ocelo'] }, boca: { y: 75, color: '#8A4B3A' } },
}

/** Los canales de la marca de una especie nueva (`CANALES`); con el Avi o una desconocida, `null`. */
export function canalesEspecie(especie) {
  return CANALES[especieValida(especie)] ?? null
}

/**
 * Las cejas preocupadas de "error" (P2): el trazo de las del Avi (resumen-ia-ux.md 6.2,
 * `M44 60.5L52.5 57.5M76 60.5L67.5 57.5`) llevado a los ojos de cada especie, en el color de su trazo.
 */
export function cejasEspecie({ x1, x2, y }, trazo) {
  return `<path class="cejas" d="M${x1 - 5} ${y - 9.5}L${x1 + 3.5} ${y - 12.5}M${x2 + 5} ${y - 9.5}L${x2 - 3.5} ${y - 12.5}" stroke="${trazo}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
}

// ------------------------------------------------------------------ variantes de subagente (entrega 4, 7)
// Copia de la ronda 3 del boceto (`G`, los degradés de las variantes, sus piezas y `VARIANTES`): misma
// especie y mismo esqueleto que la mascota de Claude, con silueta o rasgo propio. Las del Avi no están:
// con el Avi los subagentes siguen con el elenco por nombre (decisión P1, 7.3).

/** Un degradé radial (`r`) o lineal con paradas parejas (`G` del boceto). */
const G = (id, colores, tipo = 'r', attrs = 'cx="38%" cy="28%" r="80%"') => tipo === 'r'
  ? `<radialGradient id="${id}" ${attrs}>${colores.map((c, i) => `<stop offset="${f(i / (colores.length - 1))}" stop-color="${c}"/>`).join('')}</radialGradient>`
  : `<linearGradient id="${id}" ${attrs}>${colores.map((c, i) => `<stop offset="${f(i / (colores.length - 1))}" stop-color="${c}"/>`).join('')}</linearGradient>`
const DIAG = 'x1="1" y1="0" x2="0" y2="1"', DIAG2 = 'x1="1" y1="1" x2="0" y2="0"'

/** Los degradés de las variantes, para `defsAvis()` (los de `Q(document, ".defs defs")` de la ronda 3). */
export const DEGRADES_VARIANTES = [
  G('gAsTizon', ['#A0725E', '#6B4A3E', '#4A332C', '#2E1D18']), G('gAsAlaOsc', ['#3A2620', '#1A0F0C'], 'l', DIAG),
  G('gAsChispa', ['#FFD58A', '#F59A4A', '#C9602A', '#8C3A18']),
  G('gAsCeniza', ['#D2CCDA', '#8E8A9A', '#5F5A6B', '#3E3A48']), G('gAsAlaGris', ['#6E6A7C', '#2F2D38'], 'l', DIAG),
  G('gAsFogata', ['#F0716E', '#B32D3A', '#7A1426', '#4A0C18']), G('gAsAlaRoja', ['#7A1426', '#3A0810'], 'l', DIAG),
  G('gEsNieve', ['#FFFFFF', '#E8F3FA', '#B9D3E6', '#8FB0CC']), G('gEsCuarzo', ['#FBF4FF', '#E6D0FA', '#C29CEB', '#8A5CC9'], 'l', 'x1="0" y1="0" x2="1" y2="1"'),
  G('gEsAlaCuarzo', ['#F5EAFF', '#B08AE0'], 'l', DIAG), G('gEsTempano', ['#9FD8F5', '#3F8FC9', '#1E4F8F', '#12306A'], 'l', 'x1="0" y1="0" x2="1" y2="1"'),
  G('gEsGranizo', ['#FFFFFF', '#D6EEFA', '#9CC9E8', '#6F9FCC']),
  G('gNoClaro', ['#EEF2EF', '#B4BEB8', '#7A847E'], 'l', 'x1="0" y1="0" x2="0" y2="1"'),
  G('gBrPerla', ['#FFFFFF', '#F5E6F0', '#D9BFD3', '#A88AA3'], 'r', 'cx="45%" cy="30%" r="75%"'), G('gBrTinta', ['#6A78D8', '#34409A', '#1B1F5A', '#0E1036'], 'r', 'cx="45%" cy="30%" r="75%"'),
  G('gBrCoral', ['#FFD0B0', '#FF8A5C', '#E0503A', '#9A2A20'], 'r', 'cx="45%" cy="30%" r="75%"'), G('gBrSifon', ['#B8FFE0', '#3FC9A0', '#1E8A78', '#0E4A48'], 'r', 'cx="45%" cy="30%" r="75%"'),
  G('gMoArena', ['#F2DFC0', '#D9C3A0', '#A88E6A', '#6E5A44'], 'r', 'cx="40%" cy="25%" r="85%"'), G('gMoPizarra', ['#9AAAC2', '#5A6A82', '#3A475C', '#232C3A'], 'r', 'cx="40%" cy="25%" r="85%"'),
  G('gMoArcilla', ['#F09A78', '#B8553A', '#8A3A26', '#5A2418'], 'r', 'cx="40%" cy="25%" r="85%"'), G('gMoVerde', ['#B2BEA6', '#7A866C', '#4A5442', '#2E3428'], 'r', 'cx="40%" cy="25%" r="85%"'),
  G('gLuCarbon', ['#D2C8D8', '#9A8EA0', '#6B6070', '#4A4050'], 'r', 'cx="40%" cy="30%" r="80%"'), G('gLuAlaCarbon', ['#A89CAE', '#6B6070', '#3A3240', '#221C28'], 'l', DIAG2), G('gLuAlaCarbon2', ['#9A8EA0', '#3A3240'], 'l', DIAG),
  G('gLuSeda', ['#FFFFFF', '#F8F3EC', '#E6DDD0', '#C9BCA8'], 'r', 'cx="40%" cy="30%" r="80%"'), G('gLuAlaSeda', ['#FFFFFF', '#EDE6DA', '#C9BCA8'], 'l', DIAG2),
  G('gLuAlaLuna', ['#F0FFE0', '#B8E88A', '#6FAA4A'], 'l', DIAG2), G('gLuLunaPiel', ['#FFFFF4', '#F0F5E0', '#D6E0BC', '#A8B88A'], 'r', 'cx="40%" cy="30%" r="80%"'),
  G('gLuLucero', ['#FFE9C8', '#E0B880', '#B08A58', '#7A5A38'], 'r', 'cx="40%" cy="30%" r="80%"'), G('gLuAlaLucero', ['#A8784E', '#4A2A18'], 'l', DIAG),
  '<radialGradient id="gLuBulbo"><stop offset="0" stop-color="#FFF3A0" stop-opacity=".9"/><stop offset="1" stop-color="#FFE08A" stop-opacity="0"/></radialGradient>',
].join('')

/** Polígono de púas (Granizo). */
const estrellaP = (cx, cy, R, r, n) => Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R; return `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * d)} ${f(cy + Math.sin(a) * d)}` }).join('') + 'Z'
const copoChico = Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return `M60 48L${f(60 + Math.cos(a) * 5.5)} ${f(48 + Math.sin(a) * 5.5)}` }).join('')
const cuernoCorto = `<path d="M46 38Q41 30 44 25Q48 31 53 34Z" fill="#9A8A7A"/>`
const cuernoLargo = `<path d="M44 40Q30 36 16 22Q32 28 52 33Z" fill="#E8E2D2"/>`
const cuernoRecto = `<path d="M47 38L41 4L55 32Z" fill="#F3D7A8"/><path d="M47 34L43 10" stroke="#C9A877" stroke-width="1.1"/>`
const abanicoAs = `<path d="M28 58L14 40L32 44L26 24L44 34L46 14L58 28L60 8L62 28L74 14L76 34L94 24L88 44L106 40L92 58Z" fill="#FFC15A" stroke="#E0663E" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 52L20 42M40 44L32 30M50 38L48 20M60 34V14M70 38L72 20M80 44L88 30M88 52L100 42" stroke="#E0663E" stroke-width="1" opacity=".6"/>`
const colaEs = `<path d="M78 98L104 106L97 98L112 95L90 89Z" fill="#7FBCEB" stroke="#E8F7FF" stroke-width=".9" stroke-linejoin="round"/>`
const patasEs = `<path d="M40 99L46 105L52 99L46 95ZM68 99L74 105L80 99L74 95Z" fill="#6FA6E0" stroke="#E8F7FF" stroke-width=".7"/>`
const mejillasEs = `<ellipse cx="43" cy="75" rx="4.4" ry="2.4" fill="#B7A6FF" opacity=".7"/><ellipse cx="77" cy="75" rx="4.4" ry="2.4" fill="#B7A6FF" opacity=".7"/>`
const cuernitoEs = `<path d="M45 44L40 30L52 40Z" fill="#E3F5FF" stroke="#F2FBFF" stroke-width=".8" stroke-linejoin="round"/>`
const orejaTri = `<path d="M30 46L24 22L46 40Z" fill="url(#gNoCaja)" stroke="#C6FF3D" stroke-opacity=".7" stroke-width="1.2" stroke-linejoin="round"/><path d="M30 40L27 28L38 37Z" fill="#C6FF3D"/>`
const tentsDe = s => `<g class="tents-e ev"><g class="tents">${s}</g></g>`
const tent = (cls, d, c, w, x, y) => `<path class="tent ${cls}" d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" ${org(x, y)}/>`
const RUGLOW = '<circle class="ruglow" cx="60" cy="87" r="11" fill="url(#gMoRuna)"/>'
const antFina = `<path d="M55 38Q48 24 40 15" stroke="#B8A9BE" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="40" cy="15" r="2.2" fill="#FF9A3D"/>`
const antPluma = `<path d="M55 38Q36 30 24 6Q46 10 52 24Q56 30 55 38Z" fill="#F5EDDC" stroke="#CBBB97" stroke-width=".8"/><path d="M55 38Q42 26 26 8" stroke="#CBBB97" stroke-width="1.1" fill="none"/>`
const antCorta = `<path d="M55 38Q50 30 46 25" stroke="#8A5A38" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="46" cy="25" r="2.4" fill="#FFE08A"/>`
const colaLuna = `<path d="M30 94Q18 112 28 124Q31 110 37 100Z" fill="url(#gLuAlaLuna)" stroke="#E8FFD0" stroke-width=".8"/>`
const alaLucero = `<path d="M44 56C34 40 20 44 19 56C18 68 30 74 42 70Z" fill="url(#gLuAlaLucero)" stroke="#FFD9B0" stroke-width=".9"/><circle cx="29" cy="58" r="3" fill="#FFE08A"/>`


/**
 * Las cuatro variantes de subagente de cada especie nueva (tabla 7.1; `VARIANTES` del boceto sin la fila
 * del Avi). Cada una: `nombre` y `rasgo` (solo internos, 4), acento `c`, `mano` y `trazo` propios si
 * cambian, `talla` si es más chica, piezas que cambia (`campos`), marcas debajo de los ojos (`mas`) y
 * colores o trazos reemplazados en todo el dibujo (`reemplazos`, en orden).
 */
export const VARIANTES = {
  ascua: [
    { nombre: 'Tizón', rasgo: 'carbón con grietas de lava y cuernos cortos', c: '#FF9A3D', mano: '#6B4A3E', trazo: '#FFD166',
      campos: { atras: colaAs('#2E1D18', '#5A4038') + par('ala', alaAsDe('url(#gAsAlaOsc)', '#FF7A2E')) + cuernoCorto + esp(cuernoCorto) },
      reemplazos: [['url(#gAsPiel)', 'url(#gAsTizon)'], [crestaAs, ''], ['#E27A52', '#4A332C'], ['#F5A07A', '#6B4A3E'], ['#E9946A', '#3A2620'], ['#FFB054', '#FF7A2E']],
      mas: `<path d="M36 50L42 57L38 64M85 48L79 56L84 62M31 76L37 81" stroke="#FF9A3D" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` },
    { nombre: 'Chispa', rasgo: 'chica, sin alas, con abanico de cuello', c: '#FFC15A', mano: '#F59A4A', talla: .9,
      campos: { atras: colaAs('#C9602A', '#FFC15A') + abanicoAs }, reemplazos: [['url(#gAsPiel)', 'url(#gAsChispa)'], [crestaAs, '']] },
    { nombre: 'Ceniza', rasgo: 'gris ceniza, cuernos largos hacia atrás y brasas sueltas', c: '#FF8A5C', mano: '#A39DAE',
      campos: { atras: colaAs('#5F5A6B', '#8E8A9A') + par('ala', alaAsDe('url(#gAsAlaGris)', '#B8B2C2')) + cuernoLargo + esp(cuernoLargo) },
      reemplazos: [['url(#gAsPiel)', 'url(#gAsCeniza)'], [crestaAs, ''], ['#E27A52', '#A39DAE'], ['#F5A07A', '#C4BECD'], ['#E9946A', '#C4BECD'], ['#FFB054', '#FF8A5C']],
      mas: `<circle cx="38" cy="48" r="2" fill="#FF8A5C"/><circle cx="83" cy="52" r="1.7" fill="#FF8A5C"/><circle cx="30" cy="62" r="1.3" fill="#FFC15A"/><circle cx="90" cy="68" r="1.2" fill="#FFC15A"/>` },
    { nombre: 'Fogata', rasgo: 'carmesí con dos cuernos rectos', c: '#FF5A6E', mano: '#E0606E',
      campos: { atras: colaAs('#7A1426', '#B32D3A') + par('ala', alaAsDe('url(#gAsAlaRoja)', '#FF7A8A')) + cuernoRecto + esp(cuernoRecto) },
      reemplazos: [['url(#gAsPiel)', 'url(#gAsFogata)'], ['#E27A52', '#E0606E'], ['#F5A07A', '#F28A94'], ['#E9946A', '#F28A94'], ['#FFB054', '#FF9AA6']] },
  ],
  escarcha: [
    { nombre: 'Copo', rasgo: 'bola de nieve redonda, sin alas', c: '#A9D8F5', mano: '#F2FBFF',
      campos: { atras: cuernitoEs + esp(cuernitoEs), cuerpo: patasEs + `<circle cx="60" cy="70" r="33" fill="url(#gEsNieve)" stroke="#F2FBFF" stroke-width="1.2"/><ellipse cx="46" cy="52" rx="9" ry="4.6" transform="rotate(-30 46 52)" fill="#fff" opacity=".7"/><path d="${copoChico}" stroke="#7FA6D0" stroke-width="1.4" stroke-linecap="round"/>${mejillasEs}<path d="M57.6 73.5H62.4L60 76.5Z" fill="#7FA6D0"/>` } },
    { nombre: 'Cuarzo', rasgo: 'cristal lila con un solo cuerno', c: '#E0A6FF', mano: '#E6D2FF',
      campos: { atras: colaEs + par('ala', alaEs) + `<path d="M54 32L60 -2L66 32Z" fill="#F2E6FF" stroke="#fff" stroke-width=".9" stroke-linejoin="round"/><path d="M60 2V28" stroke="#fff" stroke-width=".8" opacity=".7"/>` },
      reemplazos: [['url(#gEsCuerpo)', 'url(#gEsCuarzo)'], ['url(#gEsAla)', 'url(#gEsAlaCuarzo)'], ['#6FA6E0', '#B08AE0'], ['#3F6FC0', '#7A52B8'], ['#DDF2FD', '#F2E6FF'], ['#EEF9FF', '#FBF4FF'], ['#B7A6FF', '#FF9EC8'], ['#7FBCEB', '#C9A6F0']] },
    { nombre: 'Témpano', rasgo: 'alto y afilado, con barba de carámbanos', c: '#5CC8FF', mano: '#7FBCEB',
      campos: { atras: colaEs + par('ala', alaEs), cuerpo: patasEs + `<path d="M60 20L80 40L88 70L80 96L60 104L40 96L32 70L40 40Z" fill="url(#gEsTempano)" stroke="#BFE6FA" stroke-width="1.2" stroke-linejoin="round"/><path d="M60 20L40 40L32 70L48 56Z" fill="#fff" opacity=".22"/><path d="M48 56L72 56L77 78L60 86L43 78Z" fill="#CFEAF8" opacity=".78"/><path d="M48 56L60 20L72 56M60 86V104" stroke="#BFE6FA" stroke-width=".7" opacity=".6" fill="none"/><path d="M52 86L54 97L56 86ZM58 88L60 101L62 88ZM64 86L66 97L68 86Z" fill="#E3F5FF"/><ellipse cx="45" cy="74" rx="3.6" ry="2.2" fill="#B7A6FF" opacity=".7"/><ellipse cx="75" cy="74" rx="3.6" ry="2.2" fill="#B7A6FF" opacity=".7"/><path d="M57.6 73.5H62.4L60 76.5Z" fill="#1E4F8F"/>` } },
    { nombre: 'Granizo', rasgo: 'chico y erizado de púas por todos lados', c: '#9EE7D8', mano: '#DFF3FF', talla: .88,
      campos: { atras: '', cuerpo: patasEs + `<path d="${estrellaP(60, 68, 41, 31, 16)}" fill="url(#gEsGranizo)" stroke="#F2FBFF" stroke-width="1" stroke-linejoin="round"/><circle cx="60" cy="68" r="25" fill="#F4FBFF" opacity=".6"/>${mejillasEs}<path d="M57.6 73.5H62.4L60 76.5Z" fill="#6F9FCC"/>` } },
  ],
  nodo: [
    { nombre: 'Bit', rasgo: 'chico, con una sola antena y pantalla cian', c: '#5CF2FF', trazo: '#5CF2FF', talla: .88,
      campos: { atras: `<path d="M60 36V14" stroke="#56635B" stroke-width="3.2" stroke-linecap="round"/><circle cx="60" cy="11" r="5" fill="#5CF2FF"/><circle cx="58.6" cy="9.6" r="1.5" fill="#fff"/>` },
      reemplazos: [['#5CFFB0', '#B8F7FF'], ['#C6FF3D', '#5CF2FF'], ['#F4FFE0', '#F0FDFF']] },
    { nombre: 'Caché', rasgo: 'orejas caídas a los costados y pantalla ámbar', c: '#FFC24A', trazo: '#FFC24A',
      campos: { atras: par('oreja', orejaNo.split('rotate(-16 36 42)').join('rotate(-66 36 42)')) },
      reemplazos: [['#5CFFB0', '#FFE6A0'], ['#C6FF3D', '#FFC24A'], ['#F4FFE0', '#FFF8E0']] },
    { nombre: 'Búfer', rasgo: 'ancho, con orejas de triángulo y pantalla magenta', c: '#FF6FD8', trazo: '#FF6FD8',
      campos: { atras: orejaTri + esp(orejaTri) },
      reemplazos: [['x="24" y="34" width="72" height="66" rx="24"', 'x="16" y="40" width="88" height="60" rx="20"'], ['M38 38.5Q60 34 82 38.5', 'M28 44.5Q60 40 92 44.5'], ['#5CFFB0', '#FFB3EE'], ['#C6FF3D', '#FF6FD8'], ['#F4FFE0', '#FFF0FA']] },
    { nombre: 'Ping', rasgo: 'redondo, claro y con auriculares', c: '#5CFFB0', trazo: '#5CFFB0',
      campos: { atras: `<path d="M24 64Q24 22 60 22Q96 22 96 64" stroke="#3A433E" stroke-width="5" fill="none" stroke-linecap="round"/>` },
      mas: `<rect x="15" y="56" width="12" height="20" rx="5" fill="#C6FF3D" stroke="#2E3631" stroke-width="1.2"/><rect x="93" y="56" width="12" height="20" rx="5" fill="#C6FF3D" stroke="#2E3631" stroke-width="1.2"/>`,
      reemplazos: [['<rect x="24" y="34" width="72" height="66" rx="24" fill="url(#gNoCaja)"', '<circle cx="60" cy="68" r="35" fill="url(#gNoClaro)"'], ['#5CFFB0', '#D6FFF0'], ['#C6FF3D', '#5CFFB0'], ['#F4FFE0', '#F0FFF8']] },
  ],
  bruma: [
    { nombre: 'Perla', rasgo: 'nácar, tres tentáculos gruesos y una perla', c: '#FFB3D9', mano: '#F5E1EC',
      campos: { atras: tentsDe(tent('t1', 'M42 72Q36 86 43 96Q48 103 42 108', '#F2C9DF', 5.2, 42, 72) + tent('t3', 'M60 74Q56 88 62 98Q66 104 60 110', '#E6B8D2', 5.2, 60, 74) + tent('t5', 'M78 72Q84 86 77 96Q72 103 78 108', '#F2C9DF', 5.2, 78, 72)) },
      mas: `<circle cx="60" cy="25.5" r="5" fill="#FFF8FC" stroke="#D9BFD3" stroke-width="1"/><circle cx="58.3" cy="23.8" r="1.6" fill="#fff"/>`,
      reemplazos: [['url(#gBrCampana)', 'url(#gBrPerla)'], ['#FF7BE0', '#FF9EC8'], ['#7CF7FF', '#FFFFFF'], ['#EBDDFF', '#FFFFFF']] },
    { nombre: 'Tinta', rasgo: 'tinta oscura, ojos de luz y siete hilos largos', c: '#7CF7FF', mano: '#5C6CD8', trazo: '#E8F4FF',
      campos: { atras: tentsDe([30, 40, 50, 60, 70, 80, 90].map((x, i) => tent(`t${(i % 5) + 1}`, `M${x} 71Q${x - 5} 88 ${x + 1} 98Q${x + 6} 108 ${x - 1} 116`, i % 2 ? '#7CF7FF' : '#5C6CFF', 1.8, x, 71)).join('')) },
      reemplazos: [['url(#gBrCampana)', 'url(#gBrTinta)'], ['#FF7BE0', '#7CF7FF'], ['#170A33', '#E8F4FF'], ['#EBDDFF', '#9AA8FF']] },
    { nombre: 'Coral', rasgo: 'chica, con falda de volantes', c: '#FF8A5C', mano: '#FFB59A', talla: .9,
      campos: { atras: tentsDe(`<path class="tent t3" d="M30 70Q34 84 40 76Q44 90 50 78Q55 92 60 79Q65 92 70 78Q76 90 80 76Q86 84 90 70Z" fill="#FF9A7A" opacity=".95" ${org(60, 72)}/>`) },
      reemplazos: [['url(#gBrCampana)', 'url(#gBrCoral)'], ['#FF7BE0', '#FFE08A'], ['#7CF7FF', '#FFF1C2'], ['#EBDDFF', '#FFE6D6']] },
    { nombre: 'Sifón', rasgo: 'capucha alta y dos brazos largos', c: '#5CE8B8', mano: '#8FE8C8',
      campos: { atras: tentsDe(tent('t1', 'M38 72Q26 96 40 116', '#7CF7C8', 3, 38, 72) + tent('t5', 'M82 72Q94 96 80 116', '#7CF7C8', 3, 82, 72) + tent('t2', 'M50 74Q47 84 52 91', '#3FC9A0', 3, 50, 74) + tent('t3', 'M60 75Q58 86 61 93', '#3FC9A0', 3, 60, 75) + tent('t4', 'M70 74Q73 84 68 91', '#3FC9A0', 3, 70, 74)) },
      reemplazos: [['M60 28C86 28 98 48 96 70', 'M60 12C88 12 98 46 96 70'], ['C22 48 34 28 60 28Z', 'C22 46 32 12 60 12Z'], ['url(#gBrCampana)', 'url(#gBrSifon)'], ['#FF7BE0', '#B8FF9A'], ['#7CF7FF', '#E0FFF2']] },
  ],
  morro: [
    { nombre: 'Guijarro', rasgo: 'canto rodado redondo, sin brazos', c: '#7DF9FF', mano: '#B8A07C', trazo: '#7DF9FF',
      campos: { atras: '', cuerpo: `<rect x="38" y="96" width="16" height="8" rx="4" fill="#6E5A44"/><rect x="66" y="96" width="16" height="8" rx="4" fill="#6E5A44"/><ellipse cx="60" cy="72" rx="34" ry="30" fill="url(#gMoArena)" stroke="#5A4A38" stroke-width="1.2"/><path d="M42 52Q52 45 64 47" stroke="#FFF1DA" stroke-width="2.2" fill="none" stroke-linecap="round" opacity=".55"/><circle cx="40" cy="86" r="1.2" fill="#8A7558"/><circle cx="78" cy="90" r="1.4" fill="#8A7558"/><circle cx="86" cy="66" r="1" fill="#8A7558"/><circle class="ru r2" cx="60" cy="88" r="5" stroke="#FFC24A" stroke-width="1.6" fill="none"/>${cejaMo.split('#33313D').join('#6E5A44')}${esp(cejaMo.split('#33313D').join('#6E5A44'))}<ellipse cx="40" cy="70" rx="4.6" ry="2.4" fill="#FF9F7A" opacity=".35"/><ellipse cx="80" cy="70" rx="4.6" ry="2.4" fill="#FF9F7A" opacity=".35"/>` },
      reemplazos: [['#FFC24A', '#7DF9FF']] },
    { nombre: 'Pizarra', rasgo: 'losa alta y angosta, con un brote', c: '#8FD694', mano: '#5A6A82', trazo: '#8FD694',
      campos: { atras: `<path d="M60 17Q58 9 62 3" stroke="#78B078" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M62 5Q71 -2 78 4Q70 11 62 5Z" fill="#8FD694"/>` },
      reemplazos: [['M36 40Q38 31 48 30L74 30Q84 31 86 40L94 76Q96 97 82 101L38 101Q24 97 26 76Z', 'M40 26Q41 16 50 16L70 16Q79 16 80 26L84 92Q84 101 75 101L45 101Q36 101 36 92Z'], ['M44 34L72 33L64 46L41 48Z', 'M46 22L72 21L66 36L44 38Z'], ['M89 49L84 56L87 62M33 84', 'M78 46L74 53L77 58M41 84'], ['url(#gMoRoca)', 'url(#gMoPizarra)'], [RUGLOW, ''], ['#FFC24A', '#8FD694']] },
    { nombre: 'Ladrillo', rasgo: 'arcilla roja con almenas y juntas', c: '#FF8A6B', mano: '#B8553A', trazo: '#FFF1D6',
      campos: { atras: `<path d="M38 33V21H46V29H55V21H65V29H74V21H82V33Z" fill="url(#gMoArcilla)" stroke="#24222B" stroke-width="1.2" stroke-linejoin="round"/>` },
      mas: `<path d="M34 58H86M30 76H90M32 92H88M50 32V58M72 58V76M44 76V92M80 76V92" stroke="#7A3020" stroke-width="1.1" opacity=".5" fill="none"/>`,
      reemplazos: [['url(#gMoRoca)', 'url(#gMoArcilla)'], [RUGLOW, ''], ['#FFC24A', '#FFF1D6'], ['#24222B', '#5A2418'], ['#33313D', '#6E2A1C'], ['#3A3845', '#5A2418']] },
    { nombre: 'Musgoso', rasgo: 'cubierto de musgo, con una flor', c: '#9AD67A', mano: '#6E7A62', trazo: '#B8FF9A',
      campos: { atras: '' },
      mas: `<path d="M27 50Q25 30 42 27Q48 16 60 22Q72 14 80 26Q96 30 93 50Q82 42 60 44Q38 42 27 50Z" fill="#6E9E5A"/><path d="M36 40Q44 30 54 32M66 30Q78 28 86 40" stroke="#A6D18A" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="76" cy="22" r="3.6" fill="#FF9EC8"/><circle cx="76" cy="22" r="1.4" fill="#FFE08A"/>`,
      reemplazos: [['url(#gMoRoca)', 'url(#gMoVerde)'], [RUGLOW, ''], ['#FFC24A', '#B8FF9A']] },
  ],
  lumen: [
    { nombre: 'Pavesa', rasgo: 'polilla de carbón con ocelos naranja', c: '#FF9A3D', mano: '#9A8EA0',
      campos: { atras: par('ant', antFina) + par('ala', alaLu) },
      reemplazos: [['url(#gLuPiel)', 'url(#gLuCarbon)'], ['url(#gLuAlaS)', 'url(#gLuAlaCarbon)'], ['url(#gLuAlaI)', 'url(#gLuAlaCarbon2)'], ['#5CE1E6', '#FF9A3D'], ['#FFF6EA', '#B8AEBE'], ['#FFD9B0', '#B8A9BE']] },
    { nombre: 'Seda', rasgo: 'blanca, con antenas de pluma grandes', c: '#C9A6FF', mano: '#F5EDDC',
      campos: { atras: par('ant', antPluma) + par('ala', alaLu) },
      reemplazos: [['url(#gLuPiel)', 'url(#gLuSeda)'], ['url(#gLuAlaS)', 'url(#gLuAlaSeda)'], ['url(#gLuAlaI)', 'url(#gLuAlaSeda)'], ['#5CE1E6', '#C9A6FF'], ['#FF8A8A', '#FFB3C8'], ['#FFD9B0', '#CBBB97']] },
    { nombre: 'Luna', rasgo: 'alas verde pálido con colas largas', c: '#B8F07A', mano: '#E8F0D0',
      campos: { atras: colaLuna + esp(colaLuna) + par('ant', antLu) + par('ala', alaLu) },
      reemplazos: [['url(#gLuPiel)', 'url(#gLuLunaPiel)'], ['url(#gLuAlaS)', 'url(#gLuAlaLuna)'], ['url(#gLuAlaI)', 'url(#gLuAlaLuna)'], ['#5CE1E6', '#E8FF8A'], ['#2A1033', '#3A5A20'], ['#FFD9B0', '#E8FFD0']] },
    { nombre: 'Lucero', rasgo: 'luciérnaga de alas angostas y panza que brilla', c: '#FFE08A', mano: '#C9A26A', talla: .9,
      campos: { atras: par('ant', antCorta) + par('ala', alaLucero) },
      mas: `<ellipse cx="60" cy="94" rx="15" ry="9" fill="url(#gLuBulbo)"/><ellipse class="bulbo-l" cx="60" cy="93" rx="11" ry="6.5" fill="#FFF3A0"/>`,
      reemplazos: [['url(#gLuPiel)', 'url(#gLuLucero)'], ['#FFF6EA', '#E8C890']] },
  ],
}


/** Las variantes por especie (7.1). */
export const VARIANTES_POR_ESPECIE = 4

/** La variante si es una de las cuatro (entero de 0 a 3); si no, null. */
const varianteValida = v => (Number.isInteger(v) && v >= 0 && v < VARIANTES_POR_ESPECIE ? v : null)

/**
 * Los datos de una variante de subagente (`datos` del boceto): la especie con las piezas cambiadas
 * (`campos`), las marcas debajo de los ojos (`mas`), los colores reemplazados en todo el dibujo
 * (`reemplazos`, en orden), su acento, mano, trazo y talla. Nunca trae forma evolucionada ni
 * partículas (`evo: null`, 7.1). Con el Avi, sin variante o con una que no existe: la especie tal cual.
 */
export function datosVariante(especie, variante) {
  const e = especieValida(especie)
  const b = ESPECIES[e]
  const vi = varianteValida(variante)
  if (!b.piezas || vi == null) return b
  const v = VARIANTES[e][vi]
  const pz = { ...b.piezas, ...v.campos }
  pz.cuerpo = pz.cuerpo + (v.mas || '')
  pz.boca = pz.boca + (v.frente || '')
  for (const k of ['atras', 'cuerpo', 'ojos', 'boca', 'extra']) for (const [a, z] of v.reemplazos || []) pz[k] = (pz[k] || '').split(a).join(z)
  return { ...b, c: v.c, mano: v.mano ?? b.mano, trazo: v.trazo ?? b.trazo, talla: v.talla ?? null, piezas: pz, evo: null }
}
