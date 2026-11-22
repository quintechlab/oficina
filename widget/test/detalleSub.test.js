// Tests del detalle de un subagente (#14): qué se muestra al hacer clic en su ficha.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detalleSubagente } from '../src/detalleSub.js'

const AHORA = Date.parse('2026-11-22T15:10:00.000Z')
const BASE = { id: 'a1', nombre: 'Camila', inventado: false, tipo: 'general-purpose', tarea: 'rediseño del header', desde: '2026-11-22T15:00:00.000Z', estado: 'trabajando', hasta: null }

test('trabajando: tarea, tipo, hace cuánto arrancó, qué hace ahora y los pasos del más nuevo al más viejo', () => {
  const a = {
    ...BASE,
    actividad: 'editando tablero.js',
    pasos: [
      { texto: 'leyendo main.js', cuando: '2026-11-22T15:02:00.000Z' },
      { texto: 'editando tablero.js', cuando: '2026-11-22T15:09:30.000Z' },
    ],
  }
  assert.deepEqual(detalleSubagente(a, AHORA), {
    nombre: 'Camila',
    tipo: 'general-purpose',
    tarea: 'rediseño del header',
    estado: 'trabajando',
    tiempo: '10 min',
    ahora: 'editando tablero.js',
    pasos: [
      { texto: 'editando tablero.js', hace: 'hace menos de 1 min' },
      { texto: 'leyendo main.js', hace: 'hace 8 min' },
    ],
    vacio: null,
  })
})

test('terminado: no hay "ahora", el tiempo es hace cuánto terminó y el estado dice listo o falló', () => {
  const listo = { ...BASE, estado: 'listo', hasta: '2026-11-22T15:07:00.000Z', actividad: null, pasos: [{ texto: 'corriendo npm test', cuando: '2026-11-22T15:06:00.000Z' }] }
  const d = detalleSubagente(listo, AHORA)
  assert.equal(d.estado, 'listo')
  assert.equal(d.tiempo, 'hace 3 min')
  assert.equal(d.ahora, null)
  assert.deepEqual(d.pasos, [{ texto: 'corriendo npm test', hace: 'hace 4 min' }])
  assert.equal(detalleSubagente({ ...listo, estado: 'fallo' }, AHORA).estado, 'falló')
})

test('sin pasos: "todavía no usó herramientas"; con un mod anterior (sin el campo), lo dice', () => {
  const nuevo = detalleSubagente({ ...BASE, actividad: null, pasos: [] }, AHORA)
  assert.deepEqual([nuevo.pasos, nuevo.ahora, nuevo.vacio], [[], null, 'todavía no usó herramientas'])
  const viejo = detalleSubagente(BASE, AHORA)
  assert.deepEqual([viejo.pasos, viejo.ahora, viejo.vacio], [[], null, 'el mod de esta sesión no manda los pasos: actualizalo'])
})

test('un nombre inventado lleva el tipo; uno con nombre propio también, y la tarea va completa', () => {
  const largo = 'revisar a fondo la accesibilidad del tablero, la muesca y la tira a 100 y 200 %'
  const d = detalleSubagente({ ...BASE, inventado: true, nombre: 'Tobías', tipo: 'Explore', tarea: largo, pasos: [] }, AHORA)
  assert.equal(d.nombre, 'Tobías')
  assert.equal(d.tipo, 'Explore')
  assert.equal(d.tarea, largo)
})
