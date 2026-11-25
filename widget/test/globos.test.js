// Tests de globos.js (#41, docs/diseno/habitos-ux.md 8.1, 8.2 y 11.6, entrega H2): la cola de globos,
// uno por vez, con la prioridad aprobada (D-h5: pregunta › recordatorio › tareas › resumen) y el lugar
// de siempre (marca, dividida o muesca). Puros: se prueban en node, por la interfaz pública.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encolar, quitar, actual, lugarGlobo, claveRec, PRIORIDAD } from '../src/globos.js'
import { lugarAviso } from '../src/tareas.js'

const rec = (id, extra = {}) => ({ tipo: 'rec', clave: claveRec(id, '2026-11-26'), id, dia: '2026-11-26', hora: '16:00', ...extra })
const TAR = { tipo: 'tareas', clave: 'tareas' }
const RES = { tipo: 'resumen', clave: 'resumen:2026-11-23' }
/** La forma de siempre: el panel con la barra lateral y nada abierto. */
const f = (extra = {}) => ({ barra: true, hojaAbierta: 'sesiones', ...extra })

// ------------------------------------------------------------------ encolar y quitar (8.2)

test('encolar: por prioridad (recordatorio › tareas › resumen) y, a igual prioridad, por llegada', () => {
  assert.deepEqual(PRIORIDAD, { rec: 1, tareas: 2, resumen: 3 })
  let c = []
  c = encolar(c, RES)
  c = encolar(c, TAR)
  c = encolar(c, rec('h-agua'))
  c = encolar(c, rec('h-caminar'))
  assert.deepEqual(c.map(a => a.clave), [claveRec('h-agua', '2026-11-26'), claveRec('h-caminar', '2026-11-26'), 'tareas', 'resumen:2026-11-23'])
  // Cada uno con su prioridad y su orden de llegada
  assert.deepEqual(c.map(a => a.prioridad), [1, 1, 2, 3])
  assert.ok(c[0].orden < c[1].orden)
})

test('encolar: sin repetir (por clave); el que ya está queda como estaba', () => {
  const c = encolar(encolar([], TAR), rec('h-agua'))
  assert.equal(encolar(c, TAR), c)
  assert.equal(encolar(c, rec('h-agua', { hora: '07:00' })), c)
  assert.equal(c.length, 2)
  // Sin clave o de un tipo desconocido, nada
  assert.equal(encolar(c, { tipo: 'rec' }), c)
  assert.equal(encolar(c, { tipo: 'otro', clave: 'x' }), c)
})

test('encolar no cambia la cola de antes', () => {
  const antes = encolar([], TAR)
  const copia = structuredClone(antes)
  encolar(antes, rec('h-agua'))
  assert.deepEqual(antes, copia)
})

test('quitar: saca uno por clave; si no está, la misma cola', () => {
  const c = encolar(encolar([], TAR), rec('h-agua'))
  assert.deepEqual(quitar(c, 'tareas').map(a => a.clave), [claveRec('h-agua', '2026-11-26')])
  assert.equal(quitar(c, 'nada'), c)
})

test('claveRec: un recordatorio por hábito y por día (el de mañana es otro)', () => {
  assert.equal(claveRec('h-agua', '2026-11-26'), 'rec:h-agua:2026-11-26')
  assert.notEqual(claveRec('h-agua', '2026-11-26'), claveRec('h-agua', '2026-11-27'))
})

// ------------------------------------------------------------------ actual (8.1)

test('actual: un globo por vez, el de más prioridad, en el lugar de lugarGlobo', () => {
  const c = encolar(encolar(encolar([], TAR), RES), rec('h-agua'))
  assert.deepEqual(actual(c, f()), { aviso: c[0], lugar: 'marca' })
  assert.equal(actual(c, f({ dividida: true })).lugar, 'dividida')
  assert.equal(actual(c, f({ acoplada: true, abierta: false })).lugar, 'muesca')
  assert.equal(actual([], f()), null)
})

test('actual: con una pregunta pendiente, ningún globo se ve, en la marca, la dividida ni la muesca (D-h5, D-m4)', () => {
  const c = encolar(encolar([], TAR), rec('h-agua'))
  for (const forma of [f(), f({ dividida: true }), f({ acoplada: true, abierta: false }), f({ acoplada: true, abierta: true })]) {
    assert.equal(actual(c, { ...forma, pregunta: true }), null, JSON.stringify(forma))
  }
  // Esperan y vuelven después: la cola no cambia
  assert.equal(actual(c, f()).aviso.tipo, 'rec')
})

test('actual: con Tareas abierta, el de tareas no se ve y el recordatorio sí', () => {
  assert.equal(actual(encolar([], TAR), f({ hojaAbierta: 'tareas' })), null)
  const c = encolar(encolar([], TAR), rec('h-agua'))
  assert.equal(actual(c, f({ hojaAbierta: 'tareas' })).aviso.tipo, 'rec')
  // Sin el recordatorio, con Tareas abierta, pasa el de abajo (el resumen)
  assert.equal(actual(encolar(encolar([], TAR), RES), f({ hojaAbierta: 'tareas' })).aviso.tipo, 'resumen')
})

test('actual: con Hábitos abierta, el resumen no se ve; el recordatorio y el de tareas sí (D-h14)', () => {
  assert.equal(actual(encolar([], RES), f({ hojaAbierta: 'habitos' })), null)
  assert.equal(actual(encolar(encolar([], RES), rec('h-agua')), f({ hojaAbierta: 'habitos' })).aviso.tipo, 'rec')
  assert.equal(actual(encolar(encolar([], RES), TAR), f({ hojaAbierta: 'habitos' })).aviso.tipo, 'tareas')
})

test('actual: el que estaba vuelve cuando se va el de más prioridad', () => {
  let c = encolar([], TAR)
  assert.equal(actual(c, f()).aviso.clave, 'tareas')
  // Llega un recordatorio: se ve él; el de tareas espera en la cola
  c = encolar(c, rec('h-agua'))
  assert.equal(actual(c, f()).aviso.tipo, 'rec')
  // Se va el recordatorio (clic, × o hecho por otro camino): vuelve el de tareas
  c = quitar(c, claveRec('h-agua', '2026-11-26'))
  assert.equal(actual(c, f()).aviso.clave, 'tareas')
})

test('actual: espera en la tira, la bandeja, con la charla, a mitad de un arrastre y sin barra', () => {
  const c = encolar([], rec('h-agua'))
  for (const espera of [{ mini: true }, { fuera: true }, { chat: true }, { arrastrando: true }, { barra: false }]) {
    assert.equal(actual(c, f(espera)), null, JSON.stringify(espera))
  }
  // Acoplada y plegada no necesita la barra
  assert.equal(actual(c, f({ acoplada: true, abierta: false, barra: false })).lugar, 'muesca')
})

test('el aviso de Tareas solo en la cola va al mismo lugar que dice lugarAviso de tareas.js (sigue igual, salvo D-m4)', () => {
  const pendiente = { evaluado: true, pendiente: true, dia: '2026-11-26', visto: false }
  const C = { hoy: 1, vencidas: 0 }
  const formas = [
    {}, { acoplada: true, abierta: true }, { dividida: true }, { acoplada: true, abierta: false }, { acoplada: true, abierta: false, barra: false },
    { mini: true }, { fuera: true }, { chat: true }, { arrastrando: true }, { barra: false },
  ]
  for (const extra of formas) {
    const forma = { barra: true, ...extra }
    for (const pregunta of [false, true]) {
      const esperado = lugarAviso(pendiente, { ...forma, cuentas: C, pregunta })
      assert.equal(actual(encolar([], TAR), { ...forma, pregunta, hojaAbierta: 'sesiones' })?.lugar ?? null, esperado, JSON.stringify({ ...extra, pregunta }))
      // Con la hoja de Tareas abierta, ninguno de los dos
      assert.equal(lugarAviso(pendiente, { ...forma, cuentas: C, pregunta, hoja: true }), null)
      assert.equal(actual(encolar([], TAR), { ...forma, pregunta, hojaAbierta: 'tareas' }), null)
    }
  }
})

// ------------------------------------------------------------------ lugarGlobo (la parte de «dónde» de lugarAviso)

test('lugarGlobo: marca, dividida o muesca, o null si espera (sin cuentas ni hoja)', () => {
  assert.equal(lugarGlobo(f()), 'marca')
  assert.equal(lugarGlobo(f({ acoplada: true, abierta: true })), 'marca')
  assert.equal(lugarGlobo(f({ dividida: true })), 'dividida')
  assert.equal(lugarGlobo(f({ acoplada: true, abierta: false })), 'muesca')
  assert.equal(lugarGlobo(f({ acoplada: true, abierta: false, dividida: true })), 'muesca')
  for (const espera of [{ mini: true }, { fuera: true }, { chat: true }, { arrastrando: true }, { barra: false }]) {
    assert.equal(lugarGlobo(f(espera)), null, JSON.stringify(espera))
  }
})
