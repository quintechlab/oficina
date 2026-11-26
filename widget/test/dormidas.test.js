// Tests de las sesiones dormidas (odd/tasks/sesiones-dormidas.md, S1 y S3): una sesión sin turno del
// hilo principal hace más de 20 min se pliega y va al fondo de su proyecto. Solo con `ultimoTurno`
// (mod v0.12): con el mod anterior nada cambia.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dormida, animoSesion, textoActividad, agruparPorProyecto } from '../src/logica.js'
import { prepararProyecto, sesiones, firmaEscenas } from '../src/tablero.js'

const AHORA = Date.parse('2026-11-26T16:30:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const ses = extra => ({
  sesion: 'ses-1', repo: 'q/catalogo', rama: 'feat/mejoras-s2', inicio: hace(240), actualizado: hace(0),
  actividad: 'esperándote', enTurno: false, puedeControlar: true, agentes: [], preguntas: [], procesos: [], ...extra,
})

test('se duerme sin turno del hilo principal hace más de 20 min, y solo entonces', () => {
  assert.equal(dormida(ses({ ultimoTurno: hace(21) }), AHORA), true)
  assert.equal(dormida(ses({ ultimoTurno: hace(20) }), AHORA), false)
  assert.equal(dormida(ses({ ultimoTurno: hace(5) }), AHORA), false)
})

test('con el mod anterior (sin ultimoTurno) nunca se duerme', () => {
  assert.equal(dormida(ses(), AHORA), false)
  assert.equal(dormida(ses({ ultimoTurno: 'no es una fecha' }), AHORA), false)
  // Lo de antes sigue igual
  assert.equal(animoSesion(ses(), AHORA), 'esperando')
  assert.equal(textoActividad(ses(), AHORA), 'ahora · esperando tu mensaje')
})

test('no se duerme con algo en curso: turno, pregunta, subagente trabajando o procesos', () => {
  const vieja = { ultimoTurno: hace(90) }
  assert.equal(dormida(ses({ ...vieja, enTurno: true }), AHORA), false)
  assert.equal(dormida(ses({ ...vieja, preguntas: [{ id: 'p1', agente: null }] }), AHORA), false)
  assert.equal(dormida(ses({ ...vieja, preguntas: [{ id: 'p2', agente: 'a1' }] }), AHORA), false)
  assert.equal(dormida(ses({ ...vieja, agentes: [{ id: 'a1', nombre: 'Edad', estado: 'trabajando', desde: hace(10), hasta: null }] }), AHORA), false)
  assert.equal(dormida(ses({ ...vieja, procesos: [{ id: 'b1', descripcion: 'npm run dev', desde: hace(80) }] }), AHORA), false)
  // Un subagente que ya terminó no la despierta
  assert.equal(dormida(ses({ ...vieja, agentes: [{ id: 'a1', nombre: 'Edad', estado: 'listo', desde: hace(80), hasta: hace(70) }] }), AHORA), true)
})

test('dormida, el Avi duerme y la línea dice hace cuánto no tiene turnos', () => {
  const s = ses({ ultimoTurno: hace(125) })
  assert.equal(animoSesion(s, AHORA), 'inactiva')
  assert.equal(textoActividad(s, AHORA), 'dormida · sin turnos hace 2 h 5 min')
})

test('las dormidas van al fondo del proyecto; las demás conservan su orden', () => {
  const a = ses({ sesion: 'a', inicio: hace(300), ultimoTurno: hace(60) })
  const b = ses({ sesion: 'b', inicio: hace(200), ultimoTurno: hace(2) })
  const c = ses({ sesion: 'c', inicio: hace(100), ultimoTurno: hace(30) })
  const d = ses({ sesion: 'd', inicio: hace(50), enTurno: true, ultimoTurno: hace(1) })
  const [p] = agruparPorProyecto([a, b, c, d])
  const prep = prepararProyecto(p, AHORA)
  assert.deepEqual(prep.map(x => x.s.sesion), ['b', 'd', 'a', 'c'])
  assert.deepEqual(prep.map(x => x.plegada), [false, false, true, true])
})

test('la tarjeta plegada lleva la cabecera y la línea, sin escenario ni campo para escribir', () => {
  const [p] = agruparPorProyecto([ses({ ultimoTurno: hace(125) })])
  const h = sesiones(prepararProyecto(p, AHORA), AHORA)
  assert.match(h, /^<article class="ses plegada"/)
  assert.match(h, /feat\/mejoras-s2/)
  assert.match(h, /class="ses-hizo"/)
  assert.match(h, /dormida · sin turnos hace 2 h 5 min/)
  assert.doesNotMatch(h, /class="esc[ "]/)
  assert.doesNotMatch(h, /<textarea/)
  // Despierta, la tarjeta de siempre
  const [q] = agruparPorProyecto([ses({ ultimoTurno: hace(3) })])
  const despierta = sesiones(prepararProyecto(q, AHORA), AHORA)
  assert.match(despierta, /^<article class="ses">/)
  assert.match(despierta, /class="esc[ "]/)
})

test('la firma de las escenas cambia cuando la sesión se pliega', () => {
  const [p] = agruparPorProyecto([ses({ ultimoTurno: hace(19) })])
  const [q] = agruparPorProyecto([ses({ ultimoTurno: hace(19) })])
  const antes = firmaEscenas(p.repo, prepararProyecto(p, AHORA))
  const despues = firmaEscenas(q.repo, prepararProyecto(q, AHORA + 2 * 60000))
  assert.notEqual(antes, despues)
})
