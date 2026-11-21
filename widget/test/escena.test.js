// Tests del movimiento del escenario (panel-avis-ux.md 8.4 y 9.4): qué subagentes entran como
// nuevos entre dos lecturas. La parte con DOM (entrada y pausa fuera de la vista) se revisa en la
// vista de desarrollo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { novedades, idsDeEscena, retrasoHilos } from '../src/escenaMotion.js'

test('novedades: los ids que no estaban en la lectura anterior del mismo proyecto', () => {
  const antes = { repo: 'q/oficina', ids: ['a1', 'a2'] }
  assert.deepEqual(novedades(antes, { repo: 'q/oficina', ids: ['a1', 'a2', 'a3'] }), ['a3'])
  assert.deepEqual(novedades(antes, { repo: 'q/oficina', ids: ['a2'] }), [])
  // La primera lectura y el cambio de proyecto ya entran con la entrada del escenario
  assert.deepEqual(novedades(null, { repo: 'q/oficina', ids: ['a1'] }), [])
  assert.deepEqual(novedades(antes, { repo: 'q/otro', ids: ['b1'] }), [])
})

test('los ids de una escena salen de las sesiones preparadas, en orden', () => {
  const preparadas = [{ sub: [{ id: 'a1' }, { id: 'a2' }] }, { sub: [] }, { sub: [{ id: 'b1' }] }]
  assert.deepEqual(idsDeEscena('q/oficina', preparadas), { repo: 'q/oficina', ids: ['a1', 'a2', 'b1'] })
})

test('los hilos aparecen 120 ms después de que entra el último Avi del elenco (8.3)', () => {
  // Paso 3: el Avi j arranca a 200 + j × 50 y dura 360; paso 4: 120 ms después del último
  assert.equal(retrasoHilos(1), 680)
  assert.equal(retrasoHilos(4), 830)
  assert.equal(retrasoHilos(0), 680)
})
