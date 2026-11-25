// Tests del motor de especies (docs/diseno/mascotas-avi-ux.md, entrega 1 de la sección 13): la elección
// de la mascota (9.1), los datos de cada especie (5.1), `claudeDe` (9.2) y que el Avi de hoy no cambia
// ni un carácter (13.1). Funciones puras de especies.js, avis.js y de las vistas que dibujan a Claude.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { ESPECIES, NOMBRES_ESPECIES, ESPECIE_POR_DEFECTO, especieValida, datosEspecie, VARIANTES, datosVariante, canalesEspecie } from '../src/especies.js'
import { svgAvi, avi, POSES, PERSONAJE_BASE, claudeDe, defsAvis } from '../src/avis.js'
import { personajeDeNombre, agruparPorProyecto, resumenMini, personajeSubagente, variantesEquipo } from '../src/logica.js'
import { figuraMarca, figuraVacio, sesiones, prepararProyecto, carasMini, companero, firmaTablero } from '../src/tablero.js'
import { figuraMuesca, contenidoPildora, estadoMuesca } from '../src/muesca.js'
import { quienPregunta, globo, avisoOtroProyecto } from '../src/pregunta.js'
import { fichasConversan, riel, mitades } from '../src/divididaVista.js'
import { conversaciones, geometriaDividida } from '../src/dividida.js'
import { preguntasPendientes } from '../src/logica.js'

const AHORA = Date.parse('2026-11-23T12:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()

// ------------------------------------------------------------------ la elección (9.1)

test('las ocho especies, en el orden de la dirección (Nimbo al final, #46), y el Avi por defecto', () => {
  assert.deepEqual(NOMBRES_ESPECIES, ['avi', 'ascua', 'escarcha', 'nodo', 'bruma', 'morro', 'lumen', 'nimbo'])
  assert.equal(ESPECIE_POR_DEFECTO, 'avi')
})

test('mascota ausente, basura o desconocida: "avi"', () => {
  for (const malo of [undefined, null, '', 'gato', 'AVI', 'Ascua', ' ascua', 42, {}, ['nodo'], true]) {
    assert.equal(especieValida(malo), 'avi', JSON.stringify(malo))
  }
  for (const e of NOMBRES_ESPECIES) assert.equal(especieValida(e), e)
})

// ------------------------------------------------------------------ datos (5.1 y 5.2)

test('tokens de cada especie: los de la tabla 5.1 (copiados del boceto)', () => {
  const tabla = {
    avi: ['Avi', 'Faro', '#F2B632', '#EFE6D2', '#1B1712', [49, 71, 70, 4.5], [60, 14]],
    ascua: ['Ascua', 'Pira', '#FF7A2E', '#E27A52', '#2A0F08', [46, 74, 59, 4.6], [60, 20]],
    escarcha: ['Escarcha', 'Glaciar', '#7DF9FF', '#BFE6FA', '#0B1E4A', [50, 70, 66, 4.4], [61, 4]],
    nodo: ['Nodo', 'Nodo Ω', '#C6FF3D', '#56635B', '#C6FF3D', [48, 72, 61, 4.2], [60, 22]],
    bruma: ['Bruma', 'Regia', '#FF5FD2', '#B88CFF', '#170A33', [49, 71, 53, 4.6], [60, 28]],
    morro: ['Morro', 'Monolito', '#FFC24A', '#726E82', '#FFC24A', [47, 73, 60, 4], [60, 40]],
    lumen: ['Lumen', 'Aurora', '#FFB37A', '#F0C08F', '#1E1220', [48, 72, 63, 5], [60, 24]],
    nimbo: ['Nimbo', 'Centella', '#FFE53D', '#F2F1FF', '#1C1A4A', [48, 72, 68, 4.6], [59, 24]],
  }
  assert.deepEqual(Object.keys(ESPECIES), NOMBRES_ESPECIES)
  for (const [id, [nombre, evoNombre, c, mano, trazo, [x1, x2, y, r], emisor]] of Object.entries(tabla)) {
    const d = ESPECIES[id]
    assert.deepEqual([d.nombre, d.evoNombre, d.c, d.mano, d.trazo], [nombre, evoNombre, c, mano, trazo], id)
    assert.deepEqual(d.ojo, { x1, x2, y, r }, id)
    assert.deepEqual(d.emisor, emisor, id)
    assert.equal(typeof d.firma, 'string', id)
  }
  // Bruma y Nimbo flotan (5.1: contacto de rx 20)
  assert.deepEqual(NOMBRES_ESPECIES.filter(id => ESPECIES[id].flota), ['bruma', 'nimbo'])
})

test('datosEspecie: la de la especie, o la del Avi si no se conoce', () => {
  assert.equal(datosEspecie('morro'), ESPECIES.morro)
  assert.equal(datosEspecie('dragon'), ESPECIES.avi)
  assert.equal(datosEspecie(undefined), ESPECIES.avi)
})

// ------------------------------------------------------------------ el Avi de hoy, idéntico (13.1)

/**
 * Huellas del SVG de hoy (antes del motor de especies), por personaje y pose, en el orden de POSES:
 * sha256 (16 primeros) de las cuatro salidas de svgAvi (normal, comando, marca, marca con comando).
 */
const HUELLAS_DE_HOY = {
  antena: 'b158fa889762fc7b 7539a537a435d8b2 c00f1388f5295117 908d8dcd331c7030 8c61adea46005173 3f5676e7b473d1f8 399bf48553b03c53 b151d5f85e61dd37 d3cfcc598f0eca42 cb79180594118bf9 f0f4622bc1d36b48 0fdd5120c2049c3e e309afc4f6053a2b 084cbc927d62db39 200ff5a3a8aa01d6 3d6a36021dc8202f 6848a99ed245a2ff',
  copete: '052c54e7149c0e26 e33eb4dcfee31d3c deea8b1e677e48fd 51c3a723a93c7b4e b4f8dfd8cd7e34cb 2510b57af403241a 6247c5f4c53e0684 820b50d78c5e6ff6 9e79ed633fcfc485 22abd69f9338c325 9e63443553c87a90 740add07d0e36eb3 270ef5c849d38093 6e30b3e2455144d8 4a1a8119c3cff045 7fef349d978b37f9 9186799ef6e45d70',
  gata: 'e02085997ab0f07a ab379634a3b59bf6 aa17be09a34e091c 8870ce92cc2c4106 ef36b11378cc68cf 04ea7ac00c12905c b71e449fe881adc4 c091dcb0818c8661 e4d49bdf07d4ecd4 84461940609a3ed0 550ee1d49af13d71 8da5330807de9360 cb53ead32b691dd8 c2a9d50b2551b210 8eb930637a9a0aa3 7205e7f2df317cf5 db49f2d3e85c525b',
  raton: 'bd76221393e8272e 7a12ad9fab4183f8 16ae62167b38e69d 733adfa4b0b49b73 435d05da6c4fb1b4 0da792c748bb4893 e1fbc7e25385090a 02bd303f3edc6e92 2e56ade14a931222 76f56137644abfea b0a7b25e1656389b 0b463a4513fa2060 c179d9c454afed8a 2b5187932c86f334 a0b2ef5a01e257dd e73399772dce546a 2b9de3aa235af84a',
  brote: '77b6a0dce81577d2 7889db9d37c69118 2bce843df1863487 eec5bd75bbfa2750 cb099678926a00a2 d813ba1af0f8bf9c 7f829d97f4f51232 dec9d7e75e488b2a d3fb0a24b07df1fe 96c7c92e0e3ecafd bb23247318459f16 f055878a4e0899b4 7e4d9199c567ddb0 db0e7fb148249cd9 d17a25bf4076fab8 790895227b600444 8104620cd2a9d297',
  mono: '5625a20265464411 b5653ad3b2c480e8 39bfb68268e66bef bc960c894ff93193 3b2a2c1634137bca 1dabb1a35f24a09b ab20822de144c7dc 96a0d72b3936870c 5d727765744412a1 21f7bae9a698fcdb d52d12e58456ae8f 40f99a88e323d9a7 0c3ead3879c2f021 5709b7a5ebb168be 5692673f82419ce9 e0946e6e9bde943e 83877197f56cea49',
  cuernos: '51e7ad3fd753ba3c 7d3899dcfaf3565d d4910e9bd21aaeb1 69ea1609cc0367da 17397e8360e48f9f 6fa85cfa702599da 9be077f365ca3c02 44d5529fc72c3111 22074be67aa55d2f 15c8f87e025159ec 6660c36fec642ec1 1ba99a7077e689e5 9565d11b384292b2 d7744091ee6bd5ff d62514f51e4d4cd4 b8462a79bb5bd7fb d0a1c0c7db74c10e',
}
const PERSONAJES_AVI = {
  antena: claudeDe('avi'), copete: PERSONAJE_BASE, gata: personajeDeNombre('Camila'), raton: personajeDeNombre('Ramiro'),
  brote: personajeDeNombre('Lucas'), mono: personajeDeNombre('Delfina'), cuernos: personajeDeNombre('Inés'),
}
const huella = (p, pose) => createHash('sha256')
  .update([[false, false], [true, false], [false, true], [true, true]].map(([c, m]) => svgAvi(p, pose, c, { marca: m })).join('\n'))
  .digest('hex').slice(0, 16)

test('el SVG de cada personaje del Avi en las 17 poses es idéntico al de hoy (normal y marca, con y sin comando)', () => {
  assert.equal(POSES.length, 17)
  for (const [pj, p] of Object.entries(PERSONAJES_AVI)) {
    assert.equal(p.pj, pj)
    const esperadas = HUELLAS_DE_HOY[pj].split(' ')
    POSES.forEach((pose, k) => assert.equal(huella(p, pose), esperadas[k], `${pj} · ${pose}`))
    // Con la especie y la variante explícitas, lo mismo
    POSES.forEach((pose, k) => assert.equal(huella({ ...p, especie: 'avi', variante: null }, pose), esperadas[k], `${pj} · ${pose} (especie avi)`))
  }
})

test('claudeDe: el personaje de Claude de la especie elegida, sin variante', () => {
  assert.deepEqual(claudeDe('avi'), { pj: 'antena', color: '#F2B632', especie: 'avi', variante: null })
  assert.deepEqual(claudeDe('nodo'), { pj: 'antena', color: '#F2B632', especie: 'nodo', variante: null })
  // Lo que no es una especie: el Avi
  assert.equal(claudeDe('basura').especie, 'avi')
  assert.equal(claudeDe().especie, 'avi')
  // Cada llamada da un objeto nuevo (nadie pisa el de otro)
  assert.notEqual(claudeDe('avi'), claudeDe('avi'))
})

test('evolucionada: solo Claude lleva la clase evol; un subagente o el Avi base nunca (6.1.7)', () => {
  const claude = svgAvi(claudeDe('avi'), 'coordinando', false, { evolucionada: true })
  // Con la forma pedida, el dibujo de Faro (9.2): la clase m-avi y las partes
  assert.match(claude, /^<svg viewBox="0 0 120 120" class="m-avi e-coordinando evol"/)
  assert.match(svgAvi(claudeDe('avi'), 'escribiendo', true, { evolucionada: true, marca: true }), /class="m-avi e-escribiendo comando evol es-marca"/)
  for (const p of [personajeDeNombre('Camila'), personajeDeNombre('Delfina'), PERSONAJE_BASE, { especie: 'ascua', variante: 2, pj: 'gata', color: '#FF9A3D' }]) {
    assert.doesNotMatch(svgAvi(p, 'coordinando', false, { evolucionada: true }), /evol/, JSON.stringify(p))
    assert.doesNotMatch(svgAvi(p, 'coordinando', false, { evolucionada: true, marca: true }), /evol/, JSON.stringify(p))
  }
  // Sin evolucionada, igual que hoy
  assert.equal(svgAvi(claudeDe('avi'), 'coordinando', false, { evolucionada: false }), svgAvi(claudeDe('avi'), 'coordinando'))
  // avi() la pasa
  assert.match(avi(claudeDe('avi'), 'coordinando', 96, { evolucionada: true }), /class="m-avi e-coordinando evol"/)
})

test('otra especie lleva su clase m-<especie> (3.2); el Avi no lleva ninguna', () => {
  assert.match(svgAvi(claudeDe('ascua'), 'esperando'), /^<svg viewBox="0 0 120 120" class="m-ascua e-esperando"/)
  assert.match(svgAvi(claudeDe('lumen'), 'escribiendo', true, { marca: true, evolucionada: true }), /class="m-lumen e-escribiendo comando evol es-marca"/)
  assert.doesNotMatch(svgAvi(claudeDe('avi'), 'esperando'), /m-avi/)
})

// ------------------------------------------------------------------ Claude con la mascota elegida (9.2)

const conClase = (h, especie) => h.includes(`class="m-${especie} `)

test('figuras de Claude de tablero.js: siguen la mascota; sin ella, la de hoy', () => {
  assert.ok(conClase(figuraMarca('coordinando', 'bruma'), 'bruma'))
  assert.ok(conClase(figuraVacio('durmiendo', 'morro'), 'morro'))
  assert.equal(figuraMarca('coordinando', 'avi'), figuraMarca('coordinando'))
  assert.equal(figuraVacio('esperando', 'avi'), figuraVacio('esperando'))
  // Con el Avi, la figura que evoluciona lleva m-avi (3.2); ninguna otra especie
  assert.doesNotMatch(figuraMarca('coordinando'), /m-(ascua|escarcha|nodo|bruma|morro|lumen)/)
})

test('la tarjeta: Claude del escenario con la mascota, los subagentes como hoy', () => {
  const s = {
    sesion: 's1', repo: 'q/catalogo', rama: 'main', actualizado: hace(0), actividad: 'esperándote',
    agentes: [{ id: 'a1', nombre: 'Camila', tarea: 'copy', estado: 'trabajando', desde: hace(3) }],
  }
  const prep = prepararProyecto(agruparPorProyecto([s])[0], AHORA)
  const h = sesiones(prep, AHORA, new Map(), null, {}, 'escarcha')
  const claude = h.match(/<div class="esc-claude"[^>]*>(.*?)<\/span><\/div>/)[1]
  assert.ok(conClase(claude, 'escarcha'))
  // Un solo Claude con la especie: la ficha de Camila sigue siendo la gata de hoy
  assert.equal(h.split('m-escarcha').length - 1, 1)
  assert.equal(sesiones(prep, AHORA, new Map(), null, {}, 'avi'), sesiones(prep, AHORA, new Map(), null, {}))
})

test('caras chicas de Claude: tira mini y fila del compañero con la mascota', () => {
  const caras = [{ nombre: 'Claude', animo: 'teEspera', color: '#F2B632', pj: 'antena' }, { nombre: 'Lucas', animo: 'escribiendo', color: '#8FD694', pj: 'brote' }]
  const h = carasMini(caras, 'nodo')
  assert.equal(h.split('m-nodo').length - 1, 1)
  assert.equal(carasMini(caras, 'avi'), carasMini(caras))
  const ses = { sesion: 's', repo: 'q/api', rama: 'main', actualizado: hace(1), actividad: 'esperándote', agentes: [] }
  const c = { usuario: 'NC', nombre: 'Nicolás Campos', actualizado: hace(1), sesiones: [ses], principal: ses }
  assert.ok(conClase(companero(c, AHORA, true, 'lumen'), 'lumen'))
  assert.equal(companero(c, AHORA, true, 'avi'), companero(c, AHORA, true))
})

test('muesca y píldora: Claude con la mascota', () => {
  assert.ok(conClase(figuraMuesca('esperando', 'ascua'), 'ascua'))
  assert.equal(figuraMuesca('esperando', 'avi'), figuraMuesca('esperando'))
  const e = estadoMuesca([], AHORA)
  assert.ok(conClase(contenidoPildora(e, 'morro'), 'morro'))
  assert.equal(contenidoPildora(e, 'avi'), contenidoPildora(e))
})

test('pregunta: Claude pregunta con la mascota; un subagente que pregunta, con su variante (como su ficha)', () => {
  assert.equal(quienPregunta({ quien: 'Claude', agente: null, tarea: 48 }, 'bruma').especie, 'bruma')
  // Con el Avi, el personaje de su nombre, como siempre (P1)
  assert.deepEqual(quienPregunta({ quien: 'Camila', agente: 'a1', tarea: 48 }, 'avi'), { ...personajeDeNombre('Camila'), nombre: 'Camila', ses: '#48' })
  // Con otra especie, la variante de su ficha: variantesEquipo sobre la lista completa de la sesión (3.1, 7.3)
  const equipo = [
    { id: 'toolu_01Hq8c', nombre: 'Delfina', estado: 'trabajando', desde: hace(4), hasta: null },
    { id: 'toolu_01Zr3m', nombre: 'Ramiro', estado: 'listo', desde: hace(3), hasta: hace(1) },
    { id: 'toolu_01Ab7x', nombre: 'Camila', estado: 'trabajando', desde: hace(2), hasta: null },
  ]
  const sq = {
    sesion: 's2', repo: 'q/catalogo', tarea: 48, rama: 'feat/48-precios', inicio: hace(10), actualizado: hace(0), agentes: equipo,
    preguntas: [{ id: 'toolu_9', agente: 'toolu_01Ab7x', desde: hace(1), items: [{ pregunta: '¿Sí?', encabezado: 'P', multiple: false, opciones: [{ etiqueta: 'Sí', descripcion: '.' }] }] }],
  }
  const [qs] = preguntasPendientes(agruparPorProyecto([sq])[0])
  const ficha = personajeSubagente(equipo[2], 'bruma', variantesEquipo(equipo))
  assert.equal(ficha.variante, 1)
  assert.deepEqual(quienPregunta(qs, 'bruma'), { ...ficha, nombre: 'Camila', ses: '#48' })
  const s = {
    sesion: 's1', repo: 'q/catalogo', tarea: 48, rama: 'feat/48-precios', inicio: hace(10), actualizado: hace(0), puedeResponder: true, agentes: [],
    preguntas: [{ id: 'toolu_1', agente: null, desde: hace(2), items: [{ pregunta: '¿Sí?', encabezado: 'P', multiple: false, opciones: [{ etiqueta: 'Sí', descripcion: '.' }] }] }],
  }
  const proyectos = agruparPorProyecto([s])
  const pend = preguntasPendientes(proyectos[0])
  assert.ok(conClase(globo(pend, { ahoraMs: AHORA, mascota: 'nodo' }), 'nodo'))
  assert.ok(conClase(globo(pend, { ahoraMs: AHORA, mascota: 'nodo', ui: { plegado: true } }), 'nodo'))
  assert.equal(globo(pend, { ahoraMs: AHORA, mascota: 'avi' }), globo(pend, { ahoraMs: AHORA }))
  assert.ok(conClase(avisoOtroProyecto(proyectos, -1, 'escarcha'), 'escarcha'))
  assert.equal(avisoOtroProyecto(proyectos, -1, 'avi'), avisoOtroProyecto(proyectos, -1))
  // "Listo, le respondiste": el Avi de quien preguntó, con su especie
  assert.ok(conClase(globo([], { ahoraMs: AHORA, ui: { hecho: { pj: 'antena', color: '#F2B632', especie: 'lumen', listo: true, mensaje: 'Listo' } } }), 'lumen'))
  // …y el subagente con su variante
  const hecho = { color: ficha.color, especie: 'bruma', variante: 1, listo: true, mensaje: 'Listo' }
  assert.ok(globo([], { ahoraMs: AHORA, ui: { hecho } }).includes(avi({ color: ficha.color, especie: 'bruma', variante: 1 }, 'listo', 26)))
})

test('pantalla dividida: el Claude de cada mitad, las caras de "Conversan" y el riel con la mascota', () => {
  const ses = (sesion, repo, extra = {}) => ({ sesion, repo, rama: 'main', actualizado: hace(0), actividad: 'esperándote', agentes: [], ...extra })
  const recibida = (con, conRepo) => ({ con, conRepo, desde: hace(2), empezo: 'otro', ultimo: { de: 'otro', cuando: hace(1) } })
  const lista = [ses('t', 'q/tienda-web'), ses('p', 'q/api-pagos', { conversa: [recibida('t', 'q/tienda-web')] })]
  const conv = conversaciones(lista, AHORA)[0]
  const porId = new Map(lista.map(s => [s.sesion, s]))
  const nombre = id => ({ t: 'tienda-web', p: 'api-pagos' })[id]
  const ctx = { ahoraMs: AHORA, porId, nombre, nuevas: new Set() }
  const fichas = fichasConversan([conv], { ...ctx, mascota: 'ascua' })
  assert.equal(fichas.split('m-ascua').length - 1, 2)
  assert.equal(fichasConversan([conv], { ...ctx, mascota: 'avi' }), fichasConversan([conv], ctx))
  const rielCtx = { ...ctx, activa: conv.clave, origen: null, animoMarca: 'esperando', estado: { error: false, texto: '' } }
  assert.ok(conClase(riel(agruparPorProyecto(lista), [conv], { ...rielCtx, mascota: 'morro' }), 'morro'))
  assert.equal(riel(agruparPorProyecto(lista), [conv], { ...rielCtx, mascota: 'avi' }), riel(agruparPorProyecto(lista), [conv], rielCtx))
  const geo = geometriaDividida(0, 0)
  const m = mitades(conv, 'p', { ...ctx, mascota: 'nodo' }, geo)
  assert.equal(m.split('m-nodo').length - 1, 2)
  assert.equal(mitades(conv, 'p', { ...ctx, mascota: 'avi' }, geo), mitades(conv, 'p', ctx, geo))
})

// ------------------------------------------------------------------ entrega 3: las especies nuevas (5.2, 5.3 y 5.5)

const NUEVAS = ['ascua', 'escarcha', 'nodo', 'bruma', 'morro', 'lumen', 'nimbo']
/** Las 13 poses del boceto (13.3): las de POSES sin la voz del resumen, con "comando" (escribiendo con comando). */
const POSES_13 = [['esperando'], ['escribiendo'], ['escribiendo', true], ['leyendo'], ['pensando'], ['coordinando'], ['teEspera'], ['proceso'], ['listo'], ['fallo'], ['durmiendo'], ['inactiva'], ['saluda']]
const cuenta = (h, re) => (h.match(re) ?? []).length
/** Cada `<g` abre y cada `</g>` cierra: el SVG está bien anidado. */
const gBalanceado = h => {
  let n = 0
  for (const m of h.matchAll(/<g[\s>]|<\/g>/g)) { n += m[0] === '</g>' ? -1 : 1; if (n < 0) return false }
  return n === 0
}

test('las siete especies nuevas traen las piezas de su forma base y las partes de su forma evolucionada (5.2 y 5.3)', () => {
  for (const id of NUEVAS) {
    const { piezas, evo } = ESPECIES[id]
    for (const k of ['atras', 'cuerpo', 'ojos', 'boca']) assert.ok(piezas?.[k]?.startsWith('<'), `${id}.${k}`)
    for (const k of ['evoAtras', 'evoFrente', 'fx']) assert.ok(evo?.[k]?.startsWith('<'), `${id}.evo.${k}`)
  }
  // Solo Nodo tiene piezas que no respiran (la órbita de bits)
  assert.deepEqual(NUEVAS.filter(id => ESPECIES[id].piezas.extra), ['nodo'])
})

test('la forma evolucionada de cada especie: sus partes .evo-p y sus envolturas .ev (tabla 5.3)', () => {
  const tabla = {
    ascua: [2, ['ala-e', 'cuernos-e', 'punta-e']],
    escarcha: [4, ['ala-e', 'puas-e']],
    nodo: [2, ['oreja-e']],
    bruma: [4, ['tents-e']],
    morro: [3, ['puno-e']],
    lumen: [3, ['ala-e', 'ant-e']],
    nimbo: [3, ['ala-e', 'mechon-e']],
  }
  for (const [id, [partes, envolturas]] of Object.entries(tabla)) {
    const h = svgAvi(claudeDe(id), 'esperando', false, { claveEvo: 's1' })
    assert.equal(cuenta(h, /class="evo-p[ "]/g), partes, `${id}: partes`)
    const ev = [...new Set([...h.matchAll(/class="([\w-]+-e) ev/g)].map(m => m[1]))].sort()
    assert.deepEqual(ev, envolturas, `${id}: envolturas`)
  }
})

test('forma chica: el detalle fino de cada forma lleva evo-fino; la silueta no (tabla 5.5)', () => {
  // Pira: vetas; Glaciar: hexágono, gema y órbita; Nodo Ω: aura; Regia: hilos, órbita y bandas;
  // Monolito: runas extra y piedras; Aurora: cintas y tiara; Centella: las tres estrellas que giran
  const fino = { ascua: 1, escarcha: 3, nodo: 1, bruma: 3, morro: 2, lumen: 2, nimbo: 1 }
  for (const [id, n] of Object.entries(fino)) {
    const h = svgAvi(claudeDe(id), 'esperando', false, { claveEvo: 's1' })
    assert.equal(cuenta(h, /evo-fino/g), n, id)
  }
  assert.match(svgAvi(claudeDe('ascua'), 'esperando', false, { claveEvo: 's1' }), /class="evo-p evo-fino"[^>]*><path class="vetas"/)
  assert.match(svgAvi(claudeDe('nodo'), 'esperando', false, { claveEvo: 's1' }), /<circle class="aura evo-fino"/)
  // Lo que queda (silueta) no es fino: la melena de Pira y las aletas de Nodo Ω
  assert.match(svgAvi(claudeDe('ascua'), 'esperando', false, { claveEvo: 's1' }), /class="evo-p" [^>]*><path class="llamita"/)
  assert.match(svgAvi(claudeDe('nodo'), 'esperando', false, { claveEvo: 's1' }), /class="evo-p" [^>]*><path d="M26 54L2 38/)
  // La cara chica lleva la clase chica (y el CSS esconde lo fino)
  assert.match(avi(claudeDe('morro'), 'coordinando', 26, { claveEvo: 's1', evolucionada: true }), /class="m-morro e-coordinando evol chica"/)
})

test('el SVG de una especie nueva: tokens, suelo propio, capas de 3.2 y ojos ∪ ∩ x con su trazo', () => {
  for (const id of NUEVAS) {
    const d = ESPECIES[id]
    const h = svgAvi(claudeDe(id), 'esperando', false, { claveEvo: 's1' })
    assert.ok(h.startsWith(`<svg viewBox="0 0 120 120" class="m-${id} e-esperando" aria-hidden="true" focusable="false" data-evo="s1" style="--c:${d.c};--mano:${d.mano};--oy:${d.ojo.y}px">`), id)
    assert.match(h, /<ellipse class="suelo" cx="60" cy="104" rx="44" ry="9.5"\/><ellipse class="sello" cx="60" cy="104" rx="40" ry="8"\/>/, id)
    assert.ok(h.includes(`<ellipse class="contacto" cx="60" cy="104" rx="${d.flota ? 20 : 26}" ry="3.6"/>`), id)
    assert.match(h, /<g class="vuela"><g class="trans"><g class="talla"><g class="cambio"><g class="cuerpo"><g class="evo-p/, id)
    assert.ok(h.includes(`<g class="mirada"><g class="ojos-pose"><g class="ojos"><g class="o-ab">${d.piezas.ojos}</g><g class="o-ce"><path `), id)
    assert.match(h, /<g class="o-ce">[\s\S]*?<\/g><g class="o-fe">[\s\S]*?<\/g><g class="o-x">/, id)
    assert.equal(h.match(/<g class="o-ce"><path [^>]*stroke="([^"]+)"/)[1], d.trazo, id)
    assert.match(h, /<g class="efectos">[\s\S]*<g class="fx">[\s\S]*class="pt vu acento"/, id)
    assert.ok(gBalanceado(h), id)
  }
  // Sin clave (primeros pasos, y las variantes de la entrega 4): sin anillo de suelo, sin clave y sin partes
  const base = svgAvi({ ...claudeDe('nodo'), soloBase: true }, 'esperando')
  assert.ok(base.startsWith('<svg viewBox="0 0 120 120" class="m-nodo e-esperando" aria-hidden="true" focusable="false" style="--c:#C6FF3D;--mano:#56635B;--oy:61px">'))
  assert.doesNotMatch(base, /sello|data-evo|evo-p/)
  assert.ok(gBalanceado(base))
})

test('el idioma de los estados es el mismo en todas las especies (1, regla de oro)', () => {
  for (const id of NUEVAS) {
    const d = ESPECIES[id]
    const [ex, ey] = d.emisor
    const pose = (p, c = false) => svgAvi(claudeDe(id), p, c, { claveEvo: 's1' })
    assert.match(pose('teEspera'), /<g class="burbuja"><path [^>]*fill="#F2B632"\/><text [^>]*>!<\/text>/, id)
    assert.match(pose('proceso'), /class="giro" [^>]*stroke="#7FB3FF"/, id)
    assert.match(pose('listo'), /class="chispa"/, id)
    assert.match(pose('fallo'), /stroke="#FF7A6B"/, id)
    assert.match(pose('durmiendo'), /<text class="z"/, id)
    assert.match(pose('inactiva'), /<text class="z"/, id)
    // Las ondas de "coordinando" salen del emisor de la especie, en su acento
    assert.ok(pose('coordinando').includes(`<circle class="onda" cx="${ex}" cy="${ey}" r="11" stroke="${d.c}"/>`), id)
    assert.ok(pose('coordinando').includes(`<circle class="emisor" cx="${ex}" cy="${ey}" r="5.5" fill="${d.c}" opacity=".35"/>`), id)
    // Las manos de las poses, del color de la especie (--mano); el logo verde con un comando
    assert.equal(cuenta(pose('escribiendo'), new RegExp(`class="mano[^"]*"[^>]*fill="${d.mano}"`, 'g')), 2, id)
    const efectosDe = h => h.slice(h.indexOf('<g class="efectos">'), h.indexOf('<g class="fx">'))
    assert.equal(cuenta(efectosDe(pose('leyendo')), new RegExp(`fill="${d.mano}"`, 'g')), 2, id)
    assert.doesNotMatch(efectosDe(pose('leyendo')), /#EFE6D2/, id)
    assert.match(pose('escribiendo', true), /class="logo" [^>]*fill="#8FD694"/, id)
    assert.match(pose('saluda'), new RegExp(`<g class="saludo">[\\s\\S]*fill="${d.mano}"`), id)
    // El pulgar del saludo no lleva `mano`: su transform-box fill-box movería el centro de su rotate (16.1.1)
    const pulgar = pose('saluda').match(/<ellipse[^>]*cx="97\.6"[^>]*>/)?.[0] ?? ''
    assert.ok(pulgar.includes(`fill="${d.mano}"`), id)
    assert.doesNotMatch(pulgar, /class="mano/, id)
  }
})

test('las 13 poses en las dos formas: SVG bien anidado, y la forma cambia solo con la clase evol (13.3, 6.7)', () => {
  for (const id of NUEVAS) {
    for (const [pose, comando = false] of POSES_13) {
      for (const marca of [false, true]) {
        const base = svgAvi(claudeDe(id), pose, comando, { claveEvo: 'marca', marca })
        const evo = svgAvi(claudeDe(id), pose, comando, { claveEvo: 'marca', marca, evolucionada: true })
        assert.ok(gBalanceado(base), `${id} · ${pose} · ${marca}`)
        assert.equal(evo.replace(' evol', ''), base, `${id} · ${pose} · ${marca}`)
        assert.ok(evo.includes(`class="m-${id} e-${pose}${comando ? ' comando' : ''} evol${marca ? ' es-marca' : ''}"`), `${id} · ${pose}`)
      }
    }
  }
})

test('la marca y la muesca de una especie nueva: los grupos que mueve marcaMotion.js y los efectos aparte', () => {
  for (const id of NUEVAS) {
    const h = svgAvi(claudeDe(id), 'esperando', false, { claveEvo: 'marca', marca: true })
    assert.match(h, /<g class="vuela"><g class="trans"><g class="talla"><g class="actua"><g class="inclina"><g class="cambio"><g class="cuerpo">/, id)
    for (const g of ['mirada', 'parpado', 'ojos-pose', 'c-pico', 'manito mn-i', 'manito mn-d', 'zs', 'efectos', 'notas', 'globo', 'bola', 'bola-r', 'fx']) assert.match(h, new RegExp(`<g class="${g}"`), `${id}: ${g}`)
    for (const e of ['b-sombra', 'contacto']) assert.match(h, new RegExp(`class="${e}"`), `${id}: ${e}`)
    assert.ok(gBalanceado(h), id)
  }
})

test('defsAvis trae todos los degradés y recortes que usan las especies (una vez cada uno)', () => {
  const defs = defsAvis()
  const usados = new Set()
  for (const id of NUEVAS) {
    for (const [pose, comando = false] of POSES_13) {
      for (const marca of [false, true]) {
        for (const m of svgAvi(claudeDe(id), pose, comando, { claveEvo: 's1', marca }).matchAll(/url\(#([\w-]+)\)/g)) usados.add(m[1])
      }
    }
  }
  for (const id of NUEVAS) usados.add(`gSu-${id}`)
  assert.ok(usados.size > 20)
  for (const u of usados) assert.equal(cuenta(defs, new RegExp(`id="${u}"`, 'g')), 1, u)
})

// ------------------------------------------------------------------ entrega 4: variantes de subagente (7)

const TABLA_7_1 = {
  ascua: [['Tizón', '#FF9A3D'], ['Chispa', '#FFC15A', 0.9], ['Ceniza', '#FF8A5C'], ['Fogata', '#FF5A6E']],
  escarcha: [['Copo', '#A9D8F5'], ['Cuarzo', '#E0A6FF'], ['Témpano', '#5CC8FF'], ['Granizo', '#9EE7D8', 0.88]],
  nodo: [['Bit', '#5CF2FF', 0.88], ['Caché', '#FFC24A'], ['Búfer', '#FF6FD8'], ['Ping', '#5CFFB0']],
  bruma: [['Perla', '#FFB3D9'], ['Tinta', '#7CF7FF'], ['Coral', '#FF8A5C', 0.9], ['Sifón', '#5CE8B8']],
  morro: [['Guijarro', '#7DF9FF'], ['Pizarra', '#8FD694'], ['Ladrillo', '#FF8A6B'], ['Musgoso', '#9AD67A']],
  lumen: [['Pavesa', '#FF9A3D'], ['Seda', '#C9A6FF'], ['Luna', '#B8F07A'], ['Lucero', '#FFE08A', 0.9]],
  nimbo: [['Llovizna', '#7FC4FF'], ['Celaje', '#FF9EB8'], ['Niebla', '#C9D2DC', 0.9], ['Iris', '#8FE3A0']],
}
const subDe = (especie, variante) => ({ especie, variante })

test('las 28 variantes (tabla 7.1 y las cuatro de Nimbo, #46): nombre, acento y talla', () => {
  assert.deepEqual(Object.keys(VARIANTES), NUEVAS)
  for (const id of NUEVAS) {
    assert.deepEqual(VARIANTES[id].map(v => [v.nombre, v.c, ...(v.talla ? [v.talla] : [])]), TABLA_7_1[id], id)
    for (let k = 0; k < 4; k++) {
      const d = datosVariante(id, k)
      assert.equal(d.c, TABLA_7_1[id][k][1], `${id} ${k}`)
      assert.equal(d.talla, TABLA_7_1[id][k][2] ?? null, `${id} ${k}`)
      assert.equal(d.evo, null, `${id} ${k}: nunca forma evolucionada`)
    }
  }
})

test('datosVariante: con el Avi, sin variante o con una que no existe, la especie tal cual', () => {
  assert.equal(datosVariante('avi', 2), ESPECIES.avi)
  for (const malo of [null, undefined, -1, 4, 1.5, '2', NaN]) assert.equal(datosVariante('ascua', malo), ESPECIES.ascua, String(malo))
  assert.equal(datosVariante('gato', 1), ESPECIES.avi)
})

test('el SVG de una variante: su acento, mano y talla, sus piezas, y nada de la forma evolucionada', () => {
  const h = svgAvi(subDe('ascua', 1), 'escribiendo')
  assert.ok(h.startsWith('<svg viewBox="0 0 120 120" class="m-ascua e-escribiendo" aria-hidden="true" focusable="false" style="--c:#FFC15A;--mano:#F59A4A;--oy:59px">'), h.slice(0, 200))
  assert.match(h, /<g class="talla" style="transform:scale\(0\.9\)"><g class="cambio">/)
  assert.match(h, /url\(#gAsChispa\)/)
  assert.doesNotMatch(h, /url\(#gAsPiel\)/)
  // Sin el detalle de Claude: ni anillo, ni clave, ni partes, ni partículas
  assert.doesNotMatch(h, /class="sello"|data-evo|evo-p|class="fx"|class="pt /)
  // Sin talla propia, el grupo talla no lleva estilo
  assert.match(svgAvi(subDe('ascua', 0), 'escribiendo'), /<g class="talla"><g class="cambio">/)
  // Los ojos ∪ ∩ x con el trazo de la variante (Tinta: ojos de luz)
  assert.equal(svgAvi(subDe('bruma', 1), 'listo').match(/<g class="o-ce"><path [^>]*stroke="([^"]+)"/)[1], '#E8F4FF')
  // Lucero lleva la panza que brilla (su bucle propio, 7.2)
  assert.match(svgAvi(subDe('lumen', 3), 'esperando'), /class="bulbo-l"/)
})

test('las cuatro variantes de cada especie son distintas entre sí y de Claude, y nunca evolucionan', () => {
  for (const id of NUEVAS) {
    const svgs = [0, 1, 2, 3].map(k => svgAvi(subDe(id, k), 'escribiendo'))
    svgs.push(svgAvi(claudeDe(id), 'escribiendo'))
    assert.equal(new Set(svgs).size, 5, id)
    for (let k = 0; k < 4; k++) {
      const pedido = svgAvi(subDe(id, k), 'coordinando', false, { evolucionada: true, claveEvo: 's1' })
      assert.equal(pedido, svgAvi(subDe(id, k), 'coordinando'), `${id} ${k}`)
      assert.doesNotMatch(avi(subDe(id, k), 'escribiendo', 58, { evolucionada: true, claveEvo: 's1' }), /evol|data-evo|evo-p|chica/, `${id} ${k}`)
    }
  }
})

test('las variantes en las 13 poses: SVG bien anidado y el mismo idioma de estados', () => {
  for (const id of NUEVAS) {
    for (let k = 0; k < 4; k++) {
      for (const [pose, comando = false] of POSES_13) {
        const h = svgAvi(subDe(id, k), pose, comando)
        assert.ok(gBalanceado(h), `${id} ${k} ${pose}`)
        assert.ok(h.includes(`class="m-${id} e-${pose}${comando ? ' comando' : ''}"`), `${id} ${k} ${pose}`)
      }
      assert.match(svgAvi(subDe(id, k), 'teEspera'), /<g class="burbuja">/)
      assert.ok(svgAvi(subDe(id, k), 'coordinando').includes(`stroke="${TABLA_7_1[id][k][1]}"`), `${id} ${k}: ondas en su acento`)
    }
  }
})

test('defsAvis trae todos los degradés que usan las variantes (una vez cada uno)', () => {
  const defs = defsAvis()
  const usados = new Set()
  for (const id of NUEVAS) for (let k = 0; k < 4; k++) for (const [pose, comando = false] of POSES_13) {
    for (const m of svgAvi(subDe(id, k), pose, comando).matchAll(/url\(#([\w-]+)\)/g)) usados.add(m[1])
  }
  for (const g of ['gAsTizon', 'gEsNieve', 'gNoClaro', 'gBrPerla', 'gMoArena', 'gLuBulbo', 'gNiGris', 'gNiIris']) assert.ok(usados.has(g), g)
  for (const u of usados) assert.equal(cuenta(defs, new RegExp(`id="${u}"`, 'g')), 1, u)
})

// Asignación (7.3): los ids del boceto, lanzados uno por minuto
const IDS_EQUIPO = ['toolu_01Hq8c', 'toolu_01Zr3m', 'toolu_01Ab7x', 'toolu_01Kp2v', 'toolu_01Wn9d', 'toolu_01Ty4s']
const NOMBRES_EQUIPO = ['Camila', 'Ramiro', 'Lucas', 'Delfina', 'Inés', 'Bruno']
const sesionCon = (n, extra = {}) => ({
  sesion: 's1', repo: 'q/catalogo', rama: 'main', actualizado: hace(0), actividad: 'esperándote',
  agentes: IDS_EQUIPO.slice(0, n).map((id, k) => ({ id, nombre: NOMBRES_EQUIPO[k], tarea: 't', estado: 'trabajando', desde: hace(30 - k) })),
  ...extra,
})

test('prepararProyecto con otra especie: cada subagente con la especie, su variante y su acento', () => {
  const [p] = prepararProyecto(agruparPorProyecto([sesionCon(4)])[0], AHORA, 'nodo')
  assert.deepEqual(p.sub.map(a => [a.id, a.especie, a.variante, a.color]), [
    ['toolu_01Hq8c', 'nodo', 2, '#FF6FD8'], ['toolu_01Zr3m', 'nodo', 0, '#5CF2FF'], ['toolu_01Ab7x', 'nodo', 1, '#FFC24A'], ['toolu_01Kp2v', 'nodo', 3, '#5CFFB0'],
  ])
  // El nombre de la ficha no cambia (sale del mod); el personaje por nombre ya no va
  assert.deepEqual(p.sub.map(a => a.nombre), NOMBRES_EQUIPO.slice(0, 4))
  assert.ok(p.sub.every(a => a.pj === undefined))
  assert.ok(p.sub.every(a => a.animo === 'escribiendo'))
})

test('prepararProyecto con el Avi (P1): el personaje por nombre de hoy, sin variante', () => {
  const lista = agruparPorProyecto([sesionCon(4)])[0]
  const [p] = prepararProyecto(lista, AHORA, 'avi')
  assert.deepEqual(p.sub.map(a => [a.nombre, a.pj, a.color, a.especie]), [
    ['Camila', 'gata', '#E78FB3', 'avi'], ['Ramiro', 'raton', '#7FB3FF', 'avi'], ['Lucas', 'brote', '#8FD694', 'avi'], ['Delfina', 'mono', '#F2B632', 'avi'],
  ])
  assert.ok(p.sub.every(a => !('variante' in a)))
  // Sin especie o con basura, el Avi
  assert.deepEqual(prepararProyecto(lista, AHORA), prepararProyecto(lista, AHORA, 'avi'))
  assert.deepEqual(prepararProyecto(lista, AHORA, 'basura'), prepararProyecto(lista, AHORA, 'avi'))
})

/** Los `--c` de las fichas de subagente del escenario. */
const acentosFichas = h => [...h.matchAll(/<li class="sub[^"]*" style="left:[^;]+;width:[^;]+;--c:([^;]+);/g)].map(m => m[1])

test('con 4 subagentes, 4 variantes distintas en el escenario', () => {
  const prep = prepararProyecto(agruparPorProyecto([sesionCon(4)])[0], AHORA, 'morro')
  const h = sesiones(prep, AHORA, new Map(), null, {}, 'morro')
  const acentos = acentosFichas(h)
  assert.equal(acentos.length, 4)
  assert.equal(new Set(acentos).size, 4)
  // Claude y sus cuatro, todos de la especie elegida
  assert.equal(cuenta(h, /class="m-morro /g), 5)
})

test('con 6 subagentes, 3 fichas y la pila "+3"', () => {
  const prep = prepararProyecto(agruparPorProyecto([sesionCon(6)])[0], AHORA, 'lumen')
  const h = sesiones(prep, AHORA, new Map(), null, {}, 'lumen')
  assert.equal(acentosFichas(h).length, 3)
  assert.equal(new Set(acentosFichas(h)).size, 3)
  assert.match(h, />\+3</)
  // Las cabecitas de la pila también son variantes de la especie, nunca evolucionadas
  const pila = h.slice(h.indexOf('class="cab-p"'))
  assert.ok(cuenta(pila, /class="m-lumen /g) >= 1)
  assert.doesNotMatch(pila, /evol|data-evo/)
})

test('el mismo subagente conserva su variante entre redibujos y reinicios (sale solo de los datos)', () => {
  const s = sesionCon(5)
  const una = prepararProyecto(agruparPorProyecto([s])[0], AHORA, 'bruma')[0].sub
  // Otro momento, los agentes en otro orden y uno terminado: las mismas variantes
  const otra = { ...s, agentes: [...s.agentes].reverse().map((a, k) => (k === 0 ? { ...a, estado: 'listo', hasta: hace(1) } : a)) }
  const dos = prepararProyecto(agruparPorProyecto([otra])[0], AHORA + 60000, 'bruma')[0].sub
  const porId = sub => Object.fromEntries(sub.map(a => [a.id, a.variante]))
  assert.deepEqual(porId(dos), porId(una))
  // La firma no cambia por la especie: la variante sale de los mismos ids
  assert.equal(firmaTablero(prepararProyecto(agruparPorProyecto([s])[0], AHORA, 'bruma')), firmaTablero(prepararProyecto(agruparPorProyecto([s])[0], AHORA, 'avi')))
})

test('la fila del compañero y la tira mini: las cabecitas de los subagentes con su variante', () => {
  const s = sesionCon(2)
  const c = { usuario: 'NC', nombre: 'Nicolás Campos', actualizado: hace(1), sesiones: [s], principal: s }
  assert.equal(cuenta(companero(c, AHORA, true, 'escarcha'), /class="m-escarcha /g), 3)
  assert.equal(companero(c, AHORA, true, 'avi'), companero(c, AHORA, true))
  const r = resumenMini(agruparPorProyecto([s]), AHORA, 'escarcha')
  assert.deepEqual(r.caras.map(x => [x.nombre, x.especie, x.variante]), [['Camila', 'escarcha', 2], ['Ramiro', 'escarcha', 0]])
  assert.equal(cuenta(carasMini(r.caras, 'escarcha'), /class="m-escarcha /g), 2)
  // Con el Avi, las caras de hoy
  assert.deepEqual(resumenMini(agruparPorProyecto([s]), AHORA, 'avi').caras.map(x => [x.nombre, x.pj]), [['Camila', 'gata'], ['Ramiro', 'raton']])
})

test('la pantalla dividida: los subagentes de cada mitad con la variante de su sesión', () => {
  const recibida = { con: 't', conRepo: 'q/tienda-web', desde: hace(2), empezo: 'otro', ultimo: { de: 'otro', cuando: hace(1) } }
  const t = { sesion: 't', repo: 'q/tienda-web', rama: 'main', actualizado: hace(0), actividad: 'esperándote', agentes: [] }
  const lista = [t, sesionCon(2, { sesion: 'p', repo: 'q/api-pagos', conversa: [recibida] })]
  const conv = conversaciones(lista, AHORA)[0]
  const ctx = { ahoraMs: AHORA, porId: new Map(lista.map(s => [s.sesion, s])), nombre: id => id, nuevas: new Set(), mascota: 'ascua' }
  const h = mitades(conv, 'p', ctx, geometriaDividida(2, 0))
  // Los dos Claude y los dos subagentes de "p", de la especie elegida; los subagentes nunca evolucionados
  assert.equal(cuenta(h, /class="m-ascua /g), 4)
  const fichas = [...h.matchAll(/<li class="sub-d[\s\S]*?<\/li>/g)].map(m => m[0])
  assert.equal(fichas.length, 2)
  assert.deepEqual(fichas.map(f => f.match(/--c:([^;]+);/)[1]), ['#FF8A5C', '#FF9A3D'])
  for (const f of fichas) assert.doesNotMatch(f, /evol|data-evo/)
})

// ------------------------------------------------------------------ voz y juegos de la marca (entrega 5: 10, P2 y P3)

/** Las clases de todos los elementos de un SVG (una por token). */
const clasesDe = h => new Set([...h.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(' ')))

test('canalesEspecie: el apéndice (ant), la luz propia (luz) y la boca de cada especie nueva; el Avi usa los suyos', () => {
  assert.equal(canalesEspecie('avi'), null)
  assert.equal(canalesEspecie('dragon'), null)
  const esperados = {
    ascua: ['.ala', ['.brasa'], ['.brasa']], escarcha: ['.ala', ['.chisp'], ['.chisp']], nodo: ['.oreja', ['.led'], ['.led']],
    bruma: ['.tents', ['.spot'], ['.spot']], morro: ['.musgo', ['.ru', '.ruglow'], ['.ru', '.ruglow']], lumen: ['.ant', ['.ocelo-f'], ['.ocelo']],
    nimbo: ['.ala', ['.rayo-f'], ['.rayo-n']],
  }
  for (const id of NUEVAS) {
    const k = canalesEspecie(id)
    assert.deepEqual([k.ant, k.luz.crece, k.luz.apaga], esperados[id], id)
    // Cada selector existe en la marca de la especie (sin eso el canal no movería nada)
    const clases = clasesDe(svgAvi(claudeDe(id), 'esperando', false, { claveEvo: 'marca', marca: true }))
    for (const sel of [k.ant, ...k.luz.crece, ...k.luz.apaga]) assert.ok(clases.has(sel.slice(1)), `${id}: ${sel}`)
  }
})

test('la marca de una especie nueva: cejas de "error" con su trazo, boca que se abre y manitos de su color', () => {
  for (const id of NUEVAS) {
    const d = ESPECIES[id], { x1, x2, y } = d.ojo, k = canalesEspecie(id)
    const h = svgAvi(claudeDe(id), 'error', false, { claveEvo: 'marca', marca: true })
    // Cejas: las del Avi (resumen-ia-ux.md 6.2) llevadas a los ojos de la especie, en el color de su trazo
    const cejas = `M${x1 - 5} ${y - 9.5}L${x1 + 3.5} ${y - 12.5}M${x2 + 5} ${y - 9.5}L${x2 - 3.5} ${y - 12.5}`
    assert.ok(h.includes(`<path class="cejas" d="${cejas}" stroke="${d.trazo}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`), id)
    // Antes de la mirada, dentro del cuerpo (respira con él)
    assert.match(h, /<g class="cuerpo">[\s\S]*class="cejas"[\s\S]*<g class="mirada">/, id)
    // La boca abierta: escondida en reposo (marcaMotion.js la escala con el canal boca), detrás de la boca de la especie
    assert.ok(h.includes(`<g class="c-pico"><ellipse class="boca" cx="60" cy="${k.boca.y + 1}" rx="3.4" ry="3.6" data-y="${k.boca.y}" style="fill:${k.boca.color}" transform="scale(1 0)"/>${d.piezas.boca}</g>`), id)
    // Manitos de los juegos: la mano del saludo de la especie (sombra y --mano), centrada en (0,0)
    for (const lado of ['mn-i', 'mn-d']) assert.match(h, new RegExp(`<g class="manito ${lado}" opacity="0">[\\s\\S]*?fill="#0C0C0E"[\\s\\S]*?fill="${d.mano}"`), `${id}: ${lado}`)
    assert.doesNotMatch(h.match(/<g class="manito mn-i"[\s\S]*?<g class="zs">/)[0], /#EFE6D2/, id)
    assert.ok(gBalanceado(h), id)
  }
  // La cara de las cejas del Avi (resumen-ia-ux.md 6.2) sale de la misma fórmula: es la referencia
  const { x1, x2, y } = ESPECIES.avi.ojo
  assert.equal(`M${x1 - 5} ${y - 9.5}L${x1 + 3.5} ${y - 12.5}M${x2 + 5} ${y - 9.5}L${x2 - 3.5} ${y - 12.5}`, 'M44 60.5L52.5 57.5M76 60.5L67.5 57.5')
})

test('fuera de la marca, una especie nueva no lleva cejas, boca abierta ni manitos (el escenario y la muesca de hoy)', () => {
  for (const id of NUEVAS) {
    for (const pose of ['esperando', 'error', 'feliz']) {
      const h = svgAvi(claudeDe(id), pose, false, { claveEvo: 's1' })
      assert.doesNotMatch(h, /class="cejas"|class="boca"|manito/, `${id} · ${pose}`)
    }
  }
})

test('las cinco poses de la voz en las especies nuevas: su clase, sus ojos ∩ y sus cejas (P2)', () => {
  for (const id of NUEVAS) {
    for (const pose of ['baja', 'calienta', 'contando', 'feliz', 'error']) {
      const h = svgAvi(claudeDe(id), pose, false, { claveEvo: 'marca', marca: true })
      assert.ok(h.includes(`class="m-${id} e-${pose} es-marca"`), `${id} · ${pose}`)
      assert.match(h, /<g class="o-fe"><path /, `${id} · ${pose}`)
      assert.ok(gBalanceado(h), `${id} · ${pose}`)
    }
  }
})

test('Nimbo: el rayo de la coronilla (.rayo-n) y su brillo (.rayo-f, apagado en reposo) en mechon-e; Niebla va sin coronilla', () => {
  const h = svgAvi(claudeDe('nimbo'), 'esperando', false, { claveEvo: 's1' })
  assert.match(h, /<g class="mechon-e ev"><circle class="rayo-f" cx="59" cy="32" r="9" fill="#FFE53D" opacity="0"\/><path class="rayo-n" /)
  // Las orejas de nube son un par (ala), como las alas de Ascua: el canal ant las mueve espejadas
  assert.equal(cuenta(h, /class="ala ai"|class="ala ad"/g), 2)
  // Centella: tres estrellas que giran (orb-ni) y diez gotas de lluvia para el acto
  assert.match(h, /<g class="orb-ni">(<path d="[^"]+" fill="#FFE53D"\/>){3}<\/g>/)
  assert.equal(cuenta(h, /class="pt gota"/g), 10)
  assert.doesNotMatch(svgAvi(subDe('nimbo', 2), 'esperando'), /rayo-n|rayo-f/)
})

test('Lumen: el ocelo de las alas lleva su clase (la luz que se apaga); el dibujo no cambia', () => {
  const h = svgAvi(claudeDe('lumen'), 'esperando', false, { claveEvo: 's1' })
  assert.equal(h.match(/<circle class="ocelo" cx="19" cy="50" r="5\.6" fill="#5CE1E6"\/>/g).length, 2)
})

// ------------------------------------------------------------------ tipo y concepto (configuracion-ux.md 5 y 9.5)

test('cada especie trae el tipo y el concepto del boceto de mascotas (M), para la pestaña Mascota', () => {
  const esperado = {
    avi: ['Familia · el de siempre', 'El Avi de Claude de hoy, sin cambios: huevo crema, pico y antena ámbar. Ahora también evoluciona.'],
    ascua: ['Dracónico · brasa', 'Un dragoncito que guarda una brasa en el pecho: cuanto más trabaja, más brilla.'],
    escarcha: ['Dracónico · cristal', 'Un dragón tallado en hielo, todo facetas: piensa en frío y nunca pierde la forma.'],
    nodo: ['Digital · datos', 'Nació en la memoria caché: cara de pantalla, orejas de antena y una evolución guardada.'],
    bruma: ['Abisal · bioluz', 'Viene del fondo del mar de datos: no camina, flota, y brilla cuando piensa.'],
    morro: ['Gólem · runas', 'Un gólem petiso de basalto: lento, firme, y sus runas se encienden cuando algo importa.'],
    lumen: ['Polilla · luz', 'Una polilla mullida que junta la luz de las pantallas y la devuelve en polvo.'],
    nimbo: ['Nube · tormenta', 'Una nube de bolsillo que flota sobre el escritorio: tranquila hasta que algo importa, y entonces truena.'],
  }
  for (const e of NOMBRES_ESPECIES) assert.deepEqual([ESPECIES[e].tipo, ESPECIES[e].concepto], esperado[e], e)
  // Sumar el tipo y el concepto no toca lo que ya había (nombre, forma evolucionada y acento)
  assert.deepEqual(NOMBRES_ESPECIES.map(e => [ESPECIES[e].nombre, ESPECIES[e].evoNombre, ESPECIES[e].c]), [
    ['Avi', 'Faro', '#F2B632'], ['Ascua', 'Pira', '#FF7A2E'], ['Escarcha', 'Glaciar', '#7DF9FF'], ['Nodo', 'Nodo Ω', '#C6FF3D'],
    ['Bruma', 'Regia', '#FF5FD2'], ['Morro', 'Monolito', '#FFC24A'], ['Lumen', 'Aurora', '#FFB37A'], ['Nimbo', 'Centella', '#FFE53D'],
  ])
})
