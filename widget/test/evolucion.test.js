// Tests de la regla de evolución (docs/diseno/mascotas-avi-ux.md 6 y 6.1): el controlador de tres
// estados por clave, quién coordina, cuándo hay acto, el escalonado y el acto pendiente de la
// apertura. Funciones puras de evolucion.js y logica.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESPERA_EVOLUCION_MS, ESCALON_ACTOS_MS, TAMANO_MIN_ACTO, pasoEvolucion, algunaCoordina, debeActuar, ordenActos,
  actoPendiente, coordinaciones, avanzarEvolucion,
} from '../src/evolucion.js'
import { coordinaEquipo, agruparPorProyecto, preguntasPendientes } from '../src/logica.js'
import { sesiones, prepararProyecto, firmaEscenas, figuraMarca, carasMini, companero } from '../src/tablero.js'
import { figuraMuesca, contenidoPildora, estadoMuesca } from '../src/muesca.js'
import { globo, avisoOtroProyecto } from '../src/pregunta.js'
import { fichasConversan, riel, mitades } from '../src/divididaVista.js'
import { conversaciones, geometriaDividida } from '../src/dividida.js'
import { escena as escenaPasos, avisoMod } from '../src/primerosPasosVista.js'
import { DURACION_ACTOS, ACTOS_EVOLUCION } from '../src/evolucionMotion.js'
import { svgAvi, claudeDe } from '../src/avis.js'

const T = Date.parse('2026-11-23T12:00:00Z')
const ses = (sesion, repo, estados, extra = {}) => ({
  sesion, repo, rama: 'main', actualizado: new Date(T).toISOString(), actividad: 'esperándote',
  agentes: estados.map((estado, i) => ({ id: `${sesion}-${i}`, nombre: `S${i}`, estado, desde: new Date(T - 60000).toISOString() })), ...extra,
})

// ------------------------------------------------------------------ 6.4: la tabla, fila por fila (6.1.1)

test('20 s de espera antes de volver', () => {
  assert.equal(ESPERA_EVOLUCION_MS, 20000)
})

test('sin estado previo y coordinando: evoluciona con acto (al abrir o al aparecer una sesión que ya coordina)', () => {
  for (const previo of [undefined, null]) {
    assert.deepEqual(pasoEvolucion(previo, true, T), { estado: 'evo', hasta: null, acto: 'evoluciona' })
  }
})

test('sin estado previo y sin coordinar: base sin acto', () => {
  assert.deepEqual(pasoEvolucion(undefined, false, T), { estado: 'base', hasta: null, acto: null })
})

test('base y coordina: evoluciona', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'base', hasta: null }, true, T), { estado: 'evo', hasta: null, acto: 'evoluciona' })
})

test('base y no coordina: sigue en base', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'base', hasta: null }, false, T), { estado: 'base', hasta: null, acto: null })
})

test('evo y coordina: sigue evolucionada sin acto', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'evo', hasta: null }, true, T), { estado: 'evo', hasta: null, acto: null })
})

test('evo y deja de coordinar: empieza la cuenta de 20 s, sin acto', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'evo', hasta: null }, false, T), { estado: 'cuenta', hasta: T + 20000, acto: null })
})

test('cuenta y vuelve a coordinar: evo sin acto (reencender no anima ni parpadea)', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'cuenta', hasta: T + 9000 }, true, T), { estado: 'evo', hasta: null, acto: null })
})

test('cuenta, no coordina y no llegó: sigue con el mismo hasta', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'cuenta', hasta: T + 9000 }, false, T), { estado: 'cuenta', hasta: T + 9000, acto: null })
})

test('cuenta, no coordina y llegó: vuelve a la base con acto', () => {
  assert.deepEqual(pasoEvolucion({ estado: 'cuenta', hasta: T }, false, T + 5), { estado: 'base', hasta: null, acto: 'vuelve' })
})

// ------------------------------------------------------------------ 6.1.2 y 6.1.3

test('el borde de la cuenta: hasta − 1 sigue; hasta vuelve', () => {
  const previo = { estado: 'cuenta', hasta: T + 20000 }
  assert.equal(pasoEvolucion(previo, false, T + 19999).estado, 'cuenta')
  assert.deepEqual(pasoEvolucion(previo, false, T + 20000), { estado: 'base', hasta: null, acto: 'vuelve' })
})

test('secuencia completa: la cuenta se reinicia al reencender', () => {
  const t = T
  let e = pasoEvolucion({ estado: 'base', hasta: null }, true, t - 1000)
  assert.equal(e.acto, 'evoluciona')
  e = pasoEvolucion(e, false, t)
  assert.deepEqual(e, { estado: 'cuenta', hasta: t + 20000, acto: null })
  e = pasoEvolucion(e, true, t + 5000)
  assert.deepEqual(e, { estado: 'evo', hasta: null, acto: null })
  e = pasoEvolucion(e, false, t + 9000)
  assert.deepEqual(e, { estado: 'cuenta', hasta: t + 29000, acto: null })
  assert.equal(pasoEvolucion(e, false, t + 28999).estado, 'cuenta')
  assert.deepEqual(pasoEvolucion(e, false, t + 29000), { estado: 'base', hasta: null, acto: 'vuelve' })
})

// ------------------------------------------------------------------ 6.1.4 y 6.1.5: quién coordina

test('coordinaEquipo: algún subagente trabajando; no con listos, fallidos o sin agentes; sí con pregunta propia', () => {
  assert.equal(coordinaEquipo(ses('a', 'q/x', ['listo', 'trabajando'])), true)
  assert.equal(coordinaEquipo(ses('a', 'q/x', ['listo', 'fallo'])), false)
  assert.equal(coordinaEquipo(ses('a', 'q/x', [])), false)
  assert.equal(coordinaEquipo({ sesion: 'a' }), false)
  const conPregunta = ses('a', 'q/x', ['trabajando'], { preguntas: [{ id: 'p', agente: null, desde: new Date(T).toISOString(), items: [] }] })
  assert.equal(coordinaEquipo(conPregunta), true)
})

test('algunaCoordina: cualquier sesión de cualquier proyecto; sin sesiones, no', () => {
  const proyectos = agruparPorProyecto([ses('a', 'q/uno', ['listo']), ses('b', 'q/dos', ['trabajando'])])
  assert.equal(algunaCoordina(proyectos), true)
  assert.equal(algunaCoordina(agruparPorProyecto([ses('a', 'q/uno', ['listo'])])), false)
  assert.equal(algunaCoordina([]), false)
})

test('coordinaciones: una clave por sesión y la global "marca"; las sesiones del equipo también', () => {
  const proyectos = agruparPorProyecto([ses('a', 'q/uno', ['listo']), ses('b', 'q/dos', ['trabajando'])])
  const otra = ses('c', 'q/tres', ['trabajando'])
  const m = coordinaciones(proyectos, [otra])
  assert.deepEqual([...m].sort(), [['a', false], ['b', true], ['c', true], ['marca', true]])
  // La marca solo mira las sesiones propias, no las del equipo
  assert.equal(coordinaciones(agruparPorProyecto([ses('a', 'q/uno', ['listo'])]), [otra]).get('marca'), false)
})

test('avanzarEvolucion: un paso por clave, los actos con su apertura, el próximo hasta y las claves que se olvidan', () => {
  let r = avanzarEvolucion(new Map(), new Map([['a', true], ['b', false], ['marca', true]]), T)
  assert.deepEqual(r.actos, [{ clave: 'a', acto: 'evoluciona', apertura: true }, { clave: 'marca', acto: 'evoluciona', apertura: true }])
  assert.deepEqual([...r.formas].sort(), ['a', 'marca'])
  assert.equal(r.proximo, null)
  r = avanzarEvolucion(r.mapa, new Map([['a', false], ['b', true], ['marca', true]]), T + 1000)
  assert.deepEqual(r.actos, [{ clave: 'b', acto: 'evoluciona', apertura: false }])
  assert.equal(r.mapa.get('a').estado, 'cuenta')
  assert.deepEqual([...r.formas].sort(), ['a', 'b', 'marca'])
  assert.equal(r.proximo, T + 21000)
  // Una sesión que se cierra se olvida
  r = avanzarEvolucion(r.mapa, new Map([['b', true], ['marca', true]]), T + 2000)
  assert.equal(r.mapa.has('a'), false)
  assert.equal(r.proximo, null)
})

test('avanzarEvolucion: solo las claves del primer paso tienen apertura; una sesión que aparece después ya coordinando, no (6.8)', () => {
  let r = avanzarEvolucion(new Map(), new Map([['a', true], ['marca', true]]), T)
  assert.deepEqual(r.actos.map(a => a.apertura), [true, true])
  r = avanzarEvolucion(r.mapa, new Map([['a', true], ['nueva', true], ['marca', true]]), T + 1500)
  assert.deepEqual(r.actos, [{ clave: 'nueva', acto: 'evoluciona', apertura: false }])
})

// ------------------------------------------------------------------ 6.1.6 y 6.1.11: cuándo hay acto

test('debeActuar: solo visible, sin movimiento reducido y sin pausa', () => {
  assert.equal(debeActuar({ visible: true, reducido: false, pausa: false }), true)
  assert.equal(debeActuar({ visible: false, reducido: false, pausa: false }), false)
  assert.equal(debeActuar({ visible: true, reducido: true, pausa: false }), false)
  assert.equal(debeActuar({ visible: true, reducido: false, pausa: true }), false)
})

test('debeActuar con tamaño: las caras chicas (≤ 44) nunca actúan; desde 66, sí', () => {
  assert.equal(TAMANO_MIN_ACTO, 66)
  for (const t of [20, 26, 28, 32, 34, 44]) assert.equal(debeActuar({ visible: true, reducido: false, pausa: false, tamano: t }), false, t)
  for (const t of [66, 96, 112]) assert.equal(debeActuar({ visible: true, reducido: false, pausa: false, tamano: t }), true, t)
})

// ------------------------------------------------------------------ 6.1.9: el escalonado

test('ordenActos: tarjetas de arriba hacia abajo, después la marca y la muesca, cada 250 ms', () => {
  assert.equal(ESCALON_ACTOS_MS, 250)
  const actos = [
    { figura: 'muesca', lugar: 'muesca', arriba: 0 },
    { figura: 'tarjeta:c', lugar: 'tarjeta', arriba: 700 },
    { figura: 'marca', lugar: 'marca', arriba: 10 },
    { figura: 'tarjeta:a', lugar: 'tarjeta', arriba: 100 },
    { figura: 'tarjeta:b', lugar: 'tarjeta', arriba: 400 },
  ]
  assert.deepEqual(ordenActos(actos).map(a => [a.figura, a.retraso]), [
    ['tarjeta:a', 0], ['tarjeta:b', 250], ['tarjeta:c', 500], ['marca', 750], ['muesca', 1000],
  ])
  assert.deepEqual(ordenActos([]), [])
})

// ------------------------------------------------------------------ 6.1.10: el acto pendiente de la apertura

test('actoPendiente: hace el acto la primera vez que se ve, una sola vez; si volvió a la base, nada', () => {
  // No se ve: sigue pendiente
  assert.deepEqual(actoPendiente(true, { visible: false, evolucionada: true }), { actua: false, pendiente: true })
  // Se ve y sigue evolucionada: actúa y deja de estar pendiente
  const r = actoPendiente(true, { visible: true, evolucionada: true })
  assert.deepEqual(r, { actua: true, pendiente: false })
  // Una sola vez: después ya no hay pendiente
  assert.deepEqual(actoPendiente(r.pendiente, { visible: true, evolucionada: true }), { actua: false, pendiente: false })
  // Volvió a la base antes de verse: nada
  assert.deepEqual(actoPendiente(true, { visible: true, evolucionada: false }), { actua: false, pendiente: false })
  assert.deepEqual(actoPendiente(true, { visible: false, evolucionada: false }), { actua: false, pendiente: false })
})

// ------------------------------------------------------------------ las figuras de Claude (3.1, 6.2, 6.7, 6.1.7, 6.1.8 y 6.1.11)

/** Las figuras de Claude de un HTML: `[clave, clases]` de cada SVG con `data-evo`. */
const figuras = h => [...h.matchAll(/<svg viewBox="0 0 120 120" class="([^"]*)" aria-hidden="true" focusable="false" data-evo="([^"]*)"/g)].map(m => [m[2], m[1]])

test('la tarjeta: Claude con la clave de su sesión; evolucionada solo si su clave está en formas', () => {
  const lista = [ses('s1', 'q/x', ['trabajando', 'listo']), ses('s2', 'q/x', ['listo'])]
  const prep = prepararProyecto(agruparPorProyecto(lista)[0], T)
  const base = sesiones(prep, T, new Map(), null, {}, 'avi')
  assert.deepEqual(figuras(base), [['s1', 'm-avi e-coordinando'], ['s2', 'm-avi e-esperando']])
  const evo = sesiones(prep, T, new Map(), null, {}, 'avi', new Set(['s1']))
  assert.deepEqual(figuras(evo), [['s1', 'm-avi e-coordinando evol'], ['s2', 'm-avi e-esperando']])
  // Los subagentes nunca evolucionan ni llevan clave (6.3), aunque su sesión coordine
  assert.equal((evo.match(/ evol/g) ?? []).length, 1)
})

test('firmaTablero no cambia con la forma: solo cambia la clase evol, en su lugar (6.7)', () => {
  const prep = prepararProyecto(agruparPorProyecto([ses('s1', 'q/x', ['trabajando'])])[0], T)
  const base = sesiones(prep, T, new Map(), null, {}, 'avi', new Set())
  const evo = sesiones(prep, T, new Map(), null, {}, 'avi', new Set(['s1']))
  assert.notEqual(base, evo)
  assert.equal(evo.replace(' evol', ''), base)
  // firmaEscenas no recibe la forma ni la lleva
  assert.doesNotMatch(firmaEscenas('q/x', prep), /evol/)
})

test('la marca y la muesca siguen la clave "marca"; la marca nombra la forma (12)', () => {
  const formas = new Set(['marca'])
  assert.deepEqual(figuras(figuraMarca('coordinando', 'avi', formas)), [['marca', 'm-avi e-coordinando evol es-marca']])
  assert.deepEqual(figuras(figuraMuesca('coordinando', 'avi', formas)), [['marca', 'm-avi e-coordinando evol es-marca']])
  assert.deepEqual(figuras(figuraMuesca('esperando')), [['marca', 'm-avi e-esperando es-marca']])
  assert.match(figuraMarca('coordinando', 'avi', formas), /aria-label="Claude \(Faro\), coordinando el equipo"/)
  assert.match(figuraMarca('coordinando', 'avi'), /aria-label="Claude, coordinando el equipo"/)
  assert.match(figuraMarca('esperando', 'ascua'), /aria-label="Claude \(Ascua\), esperando"/)
  assert.match(figuraMarca('coordinando', 'ascua', formas), /aria-label="Claude \(Pira\), coordinando el equipo"/)
})

test('caras chicas: llevan chica y la clave de su sesión (o "marca" la píldora), sin acto (6.1.11)', () => {
  const formas = new Set(['s1', 'marca'])
  // Tira mini: la cara de Claude que pregunta es de su sesión
  assert.deepEqual(figuras(carasMini([{ nombre: 'Claude', animo: 'teEspera', color: '#F2B632', pj: 'antena', sesion: 's1' }], 'avi', formas)), [['s1', 'm-avi e-teEspera evol chica']])
  // Fila compacta del compañero: su sesión principal
  const s = ses('s1', 'q/x', ['trabajando'])
  const c = { usuario: 'NC', nombre: 'Nicolás Campos', actualizado: s.actualizado, sesiones: [s], principal: s }
  assert.deepEqual(figuras(companero(c, T, true, 'avi', formas)), [['s1', 'm-avi e-coordinando evol chica']])
  // Píldora: la de la marca
  assert.deepEqual(figuras(contenidoPildora(estadoMuesca([], T), 'avi', formas)), [['marca', 'm-avi e-durmiendo evol chica']])
  // Ninguna cara chica actúa
  assert.equal(debeActuar({ visible: true, reducido: false, pausa: false, tamano: 26 }), false)
})

test('pregunta: la cabecera, el aviso y el hecho de Claude siguen su sesión', () => {
  const item = { pregunta: '¿Sí?', encabezado: 'P', multiple: false, opciones: [{ etiqueta: 'Sí', descripcion: '.' }] }
  const s = ses('s1', 'q/x', ['trabajando'], { tarea: 4, preguntas: [{ id: 'p1', agente: null, desde: new Date(T).toISOString(), items: [item] }] })
  const proyectos = agruparPorProyecto([s])
  const formas = new Set(['s1'])
  const pend = preguntasPendientes(proyectos[0])
  assert.deepEqual(figuras(globo(pend, { ahoraMs: T, formas })), [['s1', 'm-avi e-teEspera evol chica']])
  assert.deepEqual(figuras(globo(pend, { ahoraMs: T, formas, ui: { plegado: true } })), [['s1', 'm-avi e-teEspera evol chica']])
  assert.deepEqual(figuras(avisoOtroProyecto(proyectos, -1, 'avi', formas)), [['s1', 'm-avi e-teEspera evol chica']])
  const hecho = { pj: 'antena', color: '#F2B632', especie: 'avi', claveEvo: 's1', listo: true, mensaje: 'Listo' }
  assert.deepEqual(figuras(globo([], { ahoraMs: T, formas, ui: { hecho } })), [['s1', 'm-avi e-listo evol chica']])
})

test('pantalla dividida: cada mitad y cada cara de "Conversan" con su sesión; el riel con la marca (S3)', () => {
  const recibida = (con, conRepo) => ({ con, conRepo, desde: new Date(T - 120000).toISOString(), empezo: 'otro', ultimo: { de: 'otro', cuando: new Date(T - 60000).toISOString() } })
  const lista = [ses('t', 'q/tienda-web', ['trabajando']), ses('p', 'q/api-pagos', [], { conversa: [recibida('t', 'q/tienda-web')] })]
  const conv = conversaciones(lista, T)[0]
  const porId = new Map(lista.map(x => [x.sesion, x]))
  const nombre = id => ({ t: 'tienda-web', p: 'api-pagos' })[id]
  const formas = new Set(['t', 'marca'])
  const ctx = { ahoraMs: T, porId, nombre, nuevas: new Set(), formas }
  const resumen = h => figuras(h).map(([k, cl]) => [k, cl.includes(' evol'), cl.includes('chica')]).sort()
  assert.deepEqual(resumen(mitades(conv, 'p', ctx, geometriaDividida(0, 1))), [['p', false, false], ['t', true, false]])
  assert.deepEqual(resumen(fichasConversan([conv], ctx)), [['p', false, true], ['t', true, true]])
  const r = riel(agruparPorProyecto(lista), [conv], { ...ctx, activa: conv.clave, origen: null, animoMarca: 'coordinando', estado: { error: false, texto: '' } })
  assert.deepEqual(figuras(r), [['marca', 'm-avi e-coordinando evol chica']])
  assert.match(r, /aria-label="Claude \(Faro\), coordinando el equipo"/)
})

test('primeros pasos: la mascota elegida en forma base; con el Avi, el Avi base de hoy (S1)', () => {
  const modelo = { pasos: { gh: {} } }
  const hora = () => '12:00'
  // Con el Avi (o sin elección), lo de hoy: el copete ámbar, sin clase de especie
  assert.equal(escenaPasos(modelo, 'listo', 'escenario', hora, 'avi'), escenaPasos(modelo, 'listo', 'escenario', hora))
  assert.match(escenaPasos(modelo, 'listo', 'escenario', hora), /class="e-listo"[\s\S]*class="copete"/)
  // Con otra especie, esa especie, nunca evolucionada ni con clave
  const nodo = escenaPasos(modelo, 'listo', 'hoja', hora, 'nodo')
  assert.match(nodo, /class="m-nodo e-listo"/)
  assert.doesNotMatch(nodo, /evol|data-evo/)
  const aviso = { tipo: 'instalo', version: '0.11.0' }
  assert.match(avisoMod(aviso, 'morro'), /class="m-morro e-listo"/)
  assert.equal(avisoMod(aviso, 'avi'), avisoMod(aviso))
})

// ------------------------------------------------------------------ 8.2 y 8.3: los actos de cada especie

/**
 * Un SVG falso para las pistas: `querySelector(All)` encuentra los elementos por sus clases en el
 * texto del SVG real (`.a.b` = un elemento con las dos clases), y una línea de tiempo falsa anota cada
 * pista (`add(el, params, en)`).
 */
function svgFalso(html) {
  const elementos = [...html.matchAll(/<(\w+) class="([^"]+)"/g)].map(([, tag, cls]) => ({ tag, clases: cls.split(' '), style: {} }))
  const busca = sel => elementos.filter(e => sel.split('.').filter(Boolean).every(c => e.clases.includes(c)))
  const s = { querySelector: sel => busca(sel)[0] ?? null, querySelectorAll: sel => busca(sel), style: {}, html }
  return s
}
const lineaFalsa = () => {
  const pistas = []
  return { pistas, add: (el, params, en = 0) => { pistas.push({ el, params, en }); return this } }
}

test('los actos de las ocho especies: duración y revela de la tabla 8.2 (Nimbo, del boceto de #46)', () => {
  assert.deepEqual(DURACION_ACTOS, {
    avi: { dur: 2300, revela: 820 }, ascua: { dur: 2400, revela: 1320 }, escarcha: { dur: 2300, revela: 960 },
    nodo: { dur: 1900, revela: 1000 }, bruma: { dur: 2600, revela: 700 }, morro: { dur: 2700, revela: 1352 },
    lumen: { dur: 2600, revela: 950 }, nimbo: { dur: 2300, revela: 900 },
  })
})

test('cada pista de la transformación y de la vuelta mueve una pieza que la especie tiene; lo que no es partícula termina a tiempo', () => {
  // Las piezas que mueve cada acto (8.2) y cada vuelta (8.3), además de la vuelta común (cambio y chispas)
  const esperadas = {
    ascua: [['trans', 'ala-s', 'brasa', 'llama', 'em', 'anillo'], ['em']],
    escarcha: [['trans', 'ala-s', 'copo', 'esq', 'barrido'], ['esq']],
    nodo: [['trans', 'flash-pant', 'linea', 'rayo'], ['flash-pant', 'linea']],
    bruma: [['trans', 'tents', 'contacto', 'anb', 'pl'], ['pl']],
    morro: [['ru', 'ruglow', 'puno-s', 'trans', 'contenedor', 'polvo', 'roca'], ['polvo']],
    lumen: [['ala-s', 'trans', 'halo-l', 'ocelo-f', 'espiral', 'mo'], ['mo']],
    nimbo: [['trans', 'ala-s', 'rayo-n', 'descarga', 'destello', 'gota'], ['gota']],
  }
  for (const [id, [acto, vuelta]] of Object.entries(esperadas)) {
    const s = svgFalso(svgAvi(claudeDe(id), 'coordinando', false, { claveEvo: 's1', evolucionada: true }))
    const contenedor = { clases: ['contenedor'] }
    const piezas = tl => [...new Set(tl.pistas.map(p => p.el.clases.find(c => acto.includes(c) || vuelta.includes(c) || c === 'contenedor') ?? p.el.clases.join('.')))]
    const t = lineaFalsa()
    ACTOS_EVOLUCION[id].transformacion(t, s, contenedor)
    assert.deepEqual(piezas(t).sort(), [...acto].sort(), `${id}: transformación`)
    // Las partículas (.pt) pueden seguir cayendo después del final del acto, como en el boceto
    for (const p of t.pistas.filter(p => !p.el.clases.includes('pt'))) assert.ok(p.en + p.params.duration <= DURACION_ACTOS[id].dur, `${id}: ${p.el.clases} termina a tiempo`)
    const v = lineaFalsa()
    ACTOS_EVOLUCION[id].vuelta(v, s)
    assert.deepEqual(piezas(v), vuelta, `${id}: vuelta`)
    for (const p of v.pistas.filter(p => !p.el.clases.includes('pt'))) assert.ok(p.en + p.params.duration <= 1300, `${id}: vuelta de ${p.el.clases}`)
  }
})

test('las pistas del boceto pasan tal cual: fotogramas con sus porcentajes y su curva (8.2)', () => {
  // Nodo: el colapso a una línea a 600 y 820 ms de 1900 y el rearmado (origen del acto 60 68)
  const s = svgFalso(svgAvi(claudeDe('nodo'), 'coordinando', false, { claveEvo: 's1' }))
  const t = lineaFalsa()
  ACTOS_EVOLUCION.nodo.transformacion(t, s)
  const trans = t.pistas.find(p => p.el.clases.includes('trans'))
  assert.equal(trans.params.duration, 1900)
  assert.deepEqual(trans.params.keyframes['31.579%'], { translateX: 0, translateY: 0, scaleX: 1.25, scaleY: 0.04, rotate: 0 })
  assert.deepEqual(trans.params.keyframes['52.632%'], { translateX: 0, translateY: 0, scaleX: 0.05, scaleY: 1.3, rotate: 0 })
  assert.equal(s.querySelector('.trans').style.transformOrigin, '60px 68px')
  // Lumen: las alas baten 16 medios golpes de 105 ms desde 250, de 1 a .42
  const l = svgFalso(svgAvi(claudeDe('lumen'), 'coordinando', false, { claveEvo: 's1' }))
  const tl = lineaFalsa()
  ACTOS_EVOLUCION.lumen.transformacion(tl, l)
  const ala = tl.pistas.find(p => p.el.clases.includes('ala-s'))
  assert.equal(ala.en, 250)
  assert.equal(ala.params.duration, 16 * 105)
  assert.equal(Object.keys(ala.params.keyframes).length, 17)
  assert.equal(ala.params.keyframes['6.25%'].scaleX, 0.42)
  assert.equal(ala.params.keyframes['100%'].scaleX, 1)
  // Una propiedad que falta en un fotograma se interpola entre los que la tienen (como la del navegador)
  const em = svgFalso(svgAvi(claudeDe('ascua'), 'coordinando', false, { claveEvo: 's1' }))
  const ta = lineaFalsa()
  ACTOS_EVOLUCION.ascua.transformacion(ta, em)
  const brasa = ta.pistas.find(p => p.el.clases.includes('em'))
  assert.deepEqual(Object.keys(brasa.params.keyframes), ['0%', '15%', '100%'])
  assert.equal(brasa.params.keyframes['15%'].opacity, 1)
  assert.equal(brasa.params.keyframes['15%'].translateX, 26 * 0.15)
})

test('Nimbo (#46): el acto del boceto pasa tal cual (se infla, retumba, cae el rayo, destella y llueve)', () => {
  const s = svgFalso(svgAvi(claudeDe('nimbo'), 'coordinando', false, { claveEvo: 's1', evolucionada: true }))
  const t = lineaFalsa()
  ACTOS_EVOLUCION.nimbo.transformacion(t, s)
  const de = cls => t.pistas.filter(p => p.el.clases.includes(cls))
  // Se infla y retumba: los fotogramas en sus porcentajes, tramos lineales y la curva sobre toda la pista
  const [trans] = de('trans')
  assert.equal(trans.en, 0)
  assert.equal(trans.params.duration, 2300)
  assert.equal(trans.params.ease, 'linear')
  assert.deepEqual(Object.keys(trans.params.keyframes), ['0%', '10%', '28%', '31%', '34%', '37%', '40%', '46%', '58%', '100%'])
  assert.deepEqual(trans.params.keyframes['31%'], { translateX: -2, translateY: -3, scaleX: 1.14, scaleY: 1.1, rotate: 0 })
  assert.deepEqual(trans.params.keyframes['46%'], { translateX: 0, translateY: 2, scaleX: 0.92, scaleY: 0.92, rotate: 0 })
  // Las orejas, espejadas
  const orejas = de('ala-s')
  assert.deepEqual(orejas.map(p => [p.el.clases.includes('ai') ? 'ai' : 'ad', p.en, p.params.duration, p.params.keyframes['28%'].rotate]), [['ai', 0, 2000, 14], ['ad', 0, 2000, -14]])
  // El rayo parpadea y cae la descarga; el destello tapa el cambio (revela 900)
  assert.deepEqual([de('rayo-n')[0].en, de('rayo-n')[0].params.duration, de('rayo-n')[0].params.keyframes['20%'].opacity], [500, 1400, 0.25])
  assert.deepEqual([de('descarga')[0].en, de('descarga')[0].params.duration], [760, 380])
  assert.deepEqual([de('destello')[0].en, de('destello')[0].params.duration, de('destello')[0].params.keyframes['12%']], [830, 600, { opacity: 0.85, scale: 1 }])
  // Llueve: diez gotas, 55 ms entre una y otra
  assert.deepEqual(de('gota').map(p => p.en), Array.from({ length: 10 }, (_, i) => 950 + i * 55))
  const v = lineaFalsa()
  ACTOS_EVOLUCION.nimbo.vuelta(v, s)
  assert.deepEqual(v.pistas.map(p => [p.en, p.params.duration]), Array.from({ length: 10 }, (_, i) => [200 + i * 40, 800]))
})
