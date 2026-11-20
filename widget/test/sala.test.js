// Tests de la sala (boceto notebook, opción A): cada agente en su escritorio con su notebook.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { animoVisual, pantallaNotebook, desplazamiento, distribucion, MAX_SUBAGENTES_VISIBLES } from '../src/sala.js'

test('escribir en la notebook reemplaza a "comiendo tokens" (y al lápiz de editar)', () => {
  assert.equal(animoVisual('comiendo'), 'escribiendo')
  assert.equal(animoVisual('editando'), 'escribiendo')
  for (const a of ['pensando', 'leyendo', 'comando', 'esperando', 'teEspera', 'inactiva', 'listo', 'fallo', 'coordinando']) assert.equal(animoVisual(a), a)
})

test('la pantalla de la notebook sigue al ánimo', () => {
  assert.equal(pantallaNotebook('escribiendo'), 'codigo')
  assert.equal(pantallaNotebook('comando'), 'comando')
  assert.equal(pantallaNotebook('teEspera'), 'espera')
  assert.equal(pantallaNotebook('listo'), 'listo')
  assert.equal(pantallaNotebook('reposo'), 'listo')
  assert.equal(pantallaNotebook('inactiva'), 'apagada')
  // Coordinando el equipo: la pantalla muestra actividad; esperando tu mensaje, solo el cursor
  assert.equal(pantallaNotebook('coordinando'), 'codigo')
  assert.equal(pantallaNotebook('esperando'), 'cursor')
  assert.equal(pantallaNotebook('pensando'), 'cursor')
  assert.equal(pantallaNotebook('leyendo'), 'cursor')
})

test('dormido se hunde 2 pixeles en la silla; festejando se levanta sobre el escritorio', () => {
  // El sprite va a escala 2: 4 unidades son 2 pixeles del dibujo
  assert.equal(desplazamiento('inactiva'), 4)
  assert.ok(desplazamiento('listo') < 0)
  assert.equal(desplazamiento('escribiendo'), 0)
})

test('Claude a la izquierda y hasta 4 subagentes al lado; el resto como "+n"', () => {
  assert.equal(MAX_SUBAGENTES_VISIBLES, 4)
  assert.deepEqual(distribucion(0), { claude: 14, subs: [], resto: 0 })
  assert.deepEqual(distribucion(2), { claude: 14, subs: [86, 154], resto: 0 })
  assert.deepEqual(distribucion(6), { claude: 14, subs: [86, 154, 222, 290], resto: 2 })
})

test('un subagente que terminó o falló se dibuja durmiendo: hundido, ojos cerrados, zetas, pantalla apagada', () => {
  assert.equal(animoVisual('durmiendo'), 'inactiva')
  assert.equal(desplazamiento(animoVisual('durmiendo')), 4)
  assert.equal(pantallaNotebook(animoVisual('durmiendo')), 'apagada')
})
