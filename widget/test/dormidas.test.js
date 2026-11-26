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

// ------------------------------------------------------------------ «Terminar» (S2)
import { clicTerminar, MS_CONFIRMAR_TERMINAR, barraPlegada, lineaTerminar } from '../src/control.js'

test('Terminar: el primer clic pide confirmar 3 s, el segundo termina, y nunca por tiempo', () => {
  assert.equal(MS_CONFIRMAR_TERMINAR, 3000)
  const r1 = clicTerminar({}, AHORA)
  assert.deepEqual(r1, { terminaHasta: AHORA + 3000, terminar: false })
  assert.deepEqual(clicTerminar({ terminaHasta: r1.terminaHasta }, AHORA + 2999), { terminaHasta: null, terminar: true })
  // Pasados los 3 s, vuelve a pedir confirmación
  assert.deepEqual(clicTerminar({ terminaHasta: r1.terminaHasta }, AHORA + 3000), { terminaHasta: AHORA + 6000, terminar: false })
  // Terminando, el clic se ignora
  assert.deepEqual(clicTerminar({ terminando: true, terminaHasta: AHORA + 1000 }, AHORA), { terminaHasta: null, terminar: false })
})

test('la tarjeta plegada lleva «Terminar» con el nombre de la sesión; confirmando y terminando cambian el botón', () => {
  const s = ses({ ultimoTurno: hace(125) })
  const h = barraPlegada(s, {}, AHORA)
  assert.match(h, /^<div class="dorm" role="group" aria-label="Sesión dormida en feat\/mejoras-s2" data-sesion="ses-1">/)
  assert.match(h, /data-accion="dorm-terminar" data-sesion="ses-1" aria-label="Terminar la sesión feat\/mejoras-s2">Terminar<\/button>/)
  const c = barraPlegada(s, { terminaHasta: AHORA + 1000 }, AHORA)
  assert.match(c, /class="btn sec ctl-cerrar ctl-terminar confirma"/)
  assert.match(c, /style="--ya:-2000ms"/)
  assert.match(c, />¿Terminar\? Sí<\/button>/)
  assert.match(c, /Cierra su proceso de Claude Code\. La conversación queda guardada\./)
  const t = barraPlegada(s, { terminando: true }, AHORA)
  assert.match(t, /aria-disabled="true"[^>]*>Terminando…<\/button>/)
  const e = barraPlegada(s, { error: 'despierta' }, AHORA)
  assert.match(e, /data-tono="error">La sesión volvió a trabajar: no se terminó\.</)
  // El nombre escapa lo que viene de la sesión
  assert.match(barraPlegada(ses({ rama: '<x>' }), {}, AHORA), /Sesión dormida en &lt;x&gt;/)
})

test('cada error de Rust tiene su texto; uno desconocido, el genérico', () => {
  assert.equal(lineaTerminar('despierta'), 'La sesión volvió a trabajar: no se terminó.')
  assert.equal(lineaTerminar('sin-proceso'), 'No encuentro el proceso de esta sesión.')
  assert.equal(lineaTerminar('no-coincide'), 'El proceso ya no es el de esta sesión: no se terminó.')
  assert.equal(lineaTerminar('fallo'), 'Windows no dejó terminarla. Probá de nuevo.')
  assert.equal(lineaTerminar('otra cosa'), 'Windows no dejó terminarla. Probá de nuevo.')
})

test('la tarjeta plegada lleva su barra, y la firma cambia al confirmar o terminar', () => {
  const [p] = agruparPorProyecto([ses({ ultimoTurno: hace(125) })])
  const prep = prepararProyecto(p, AHORA)
  assert.match(sesiones(prep, AHORA, new Map(), null, { 'ses-1': {} }), /<div class="dorm"[\s\S]*<\/div><\/article>$/)
  const quieta = firmaEscenas(p.repo, prep, new Map(), null, null, {})
  assert.notEqual(quieta, firmaEscenas(p.repo, prep, new Map(), null, null, { 'ses-1': { terminaHasta: AHORA + 3000 } }))
  assert.notEqual(quieta, firmaEscenas(p.repo, prep, new Map(), null, null, { 'ses-1': { terminando: true } }))
  assert.notEqual(quieta, firmaEscenas(p.repo, prep, new Map(), null, null, { 'ses-1': { error: 'fallo' } }))
})

test('no se pliega mientras le escribís: con borrador, el foco en su campo o una orden en curso (B1 del verificador)', () => {
  const [p] = agruparPorProyecto([ses({ sesion: 'a', ultimoTurno: hace(30) }), ses({ sesion: 'b', ultimoTurno: hace(30) })])
  const prep = prepararProyecto(p, AHORA, 'avi', new Set(['a']))
  assert.deepEqual(prep.map(x => [x.s.sesion, x.plegada]), [['a', false], ['b', true]])
  // Sin retener, las dos se pliegan como antes
  assert.deepEqual(prepararProyecto(p, AHORA).map(x => x.plegada), [true, true])
})

test('un doble clic no termina: la confirmación recién vale después de 350 ms (A1 del verificador)', () => {
  const armado = clicTerminar({}, AHORA)
  assert.deepEqual(clicTerminar(armado, AHORA + 200), { terminaHasta: armado.terminaHasta, terminar: false })
  assert.deepEqual(clicTerminar(armado, AHORA + 350), { terminaHasta: null, terminar: true })
})

// ------------------------------------------------------------------ Abrir una plegada (decisión del 26/11)
test('la plegada se abre con «Abrir»; abierta es la tarjeta de siempre con «Plegar», y la firma cambia', () => {
  const [p] = agruparPorProyecto([ses({ ultimoTurno: hace(125), puedeCerrar: true })])
  const plegada = sesiones(prepararProyecto(p, AHORA), AHORA)
  assert.match(plegada, /<button type="button" class="ses-abrir" data-accion="ses-abrir" data-sesion="ses-1" aria-expanded="false" aria-label="Abrir la sesión feat\/mejoras-s2">Abrir<\/button>/)
  const prep = prepararProyecto(p, AHORA, 'avi', new Set(['ses-1']))
  assert.equal(prep[0].plegada, false)
  assert.equal(prep[0].abierta, true)
  const abierta = sesiones(prep, AHORA, new Map(), null, { 'ses-1': {} })
  assert.match(abierta, /^<article class="ses">/)
  assert.match(abierta, /<textarea/)
  assert.match(abierta, /data-accion="ctl-cerrar"/)
  assert.match(abierta, /<button type="button" class="ses-abrir" data-accion="ses-plegar" data-sesion="ses-1" aria-expanded="true" aria-label="Plegar la sesión feat\/mejoras-s2">Plegar<\/button>/)
  assert.notEqual(firmaEscenas(p.repo, prepararProyecto(p, AHORA)), firmaEscenas(p.repo, prep))
  // Despierta (con un turno), no lleva «Plegar» aunque esté en el conjunto
  const [q] = agruparPorProyecto([ses({ ultimoTurno: hace(2) })])
  const despierta = prepararProyecto(q, AHORA, 'avi', new Set(['ses-1']))
  assert.equal(despierta[0].abierta, false)
  assert.doesNotMatch(sesiones(despierta, AHORA), /ses-abrir/)
})

test('abrir una plegada no la sube de lugar: sigue al fondo mientras duerme', () => {
  const vieja = ses({ sesion: 'vieja', inicio: hace(300), ultimoTurno: hace(125) })
  const nueva = ses({ sesion: 'nueva', inicio: hace(10), ultimoTurno: hace(1) })
  const [p] = agruparPorProyecto([vieja, nueva])
  assert.deepEqual(prepararProyecto(p, AHORA, 'avi', new Set(['vieja'])).map(x => x.s.sesion), ['nueva', 'vieja'])
})

// ------------------------------------------------------------------ Orden por actividad (pedido del 26/11)
test('arriba las que trabajan o preguntan, después las que esperan tu mensaje, al fondo las dormidas', () => {
  const quieta = ses({ sesion: 'quieta', inicio: hace(300) }) // mod anterior, esperando tu mensaje
  const dormida = ses({ sesion: 'dormida', inicio: hace(280), ultimoTurno: hace(90) })
  const coordina = ses({ sesion: 'coordina', inicio: hace(200), actividad: 'pensando', enTurno: true, agentes: [{ id: 'a1', nombre: 'Panel', estado: 'trabajando', desde: hace(40), hasta: null }] })
  const pregunta = ses({ sesion: 'pregunta', inicio: hace(150), preguntas: [{ id: 'p1', agente: null }] })
  const espera = ses({ sesion: 'espera', inicio: hace(100), ultimoTurno: hace(3) })
  const edita = ses({ sesion: 'edita', inicio: hace(50), actividad: 'editando main.js', enTurno: true })
  const [p] = agruparPorProyecto([quieta, dormida, coordina, pregunta, espera, edita])
  assert.deepEqual(prepararProyecto(p, AHORA).map(x => x.s.sesion), ['coordina', 'pregunta', 'edita', 'quieta', 'espera', 'dormida'])
})
