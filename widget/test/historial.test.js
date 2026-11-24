// Tests de "Qué hizo" (#25): los últimos turnos de una sesión, leídos de su transcripción.
// Lógica pura de historial.js; la lectura del archivo es de historial.rs y el DOM de main.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_TURNOS, LARGO_PEDIDO, LARGO_RESPUESTA, limpiarPedido, recortar, turnos, vistaHistorial } from '../src/historial.js'
import { sesiones, prepararProyecto, firmaEscenas } from '../src/tablero.js'
import { agruparPorProyecto } from '../src/logica.js'

const AHORA = Date.parse('2026-11-23T15:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const u = (texto, min) => ({ rol: 'usuario', texto, cuando: hace(min) })
const c = (texto, min) => ({ rol: 'claude', texto, cuando: hace(min) })

test('un pedido sin los avisos del sistema: lo que empieza con una etiqueta no es del usuario', () => {
  assert.equal(limpiarPedido('  arreglá el header  '), 'arreglá el header')
  for (const t of ['<task-notification>\n<task-id>x</task-id>', '<command-name>/clear</command-name>', '<system-reminder>ojo</system-reminder>', '[Request interrupted by user]', '   ', '']) {
    assert.equal(limpiarPedido(t), null, t)
  }
  // Los bloques que Claude Code pega al final del pedido se sacan
  assert.equal(limpiarPedido('si dale, perfecto\n\n<widget_context_x>\nmucho\n</widget_context_x>'), 'si dale, perfecto')
  assert.equal(limpiarPedido('mirá esto <system-reminder>nada</system-reminder> y seguí'), 'mirá esto  y seguí')
})

test('recortar: una sola línea, sin marcas de markdown, cortada en una palabra con "…"', () => {
  assert.equal(recortar('**Listo.** Quedó en `tablero.js`:\n\n- uno\n- dos', 200), 'Listo. Quedó en tablero.js: - uno - dos')
  assert.equal(recortar('uno dos tres cuatro', 12), 'uno dos…')
  assert.equal(recortar('abcdefghijklmnop', 5), 'abcde…')
  assert.equal(recortar('corto', 50), 'corto')
})

test('los turnos: cada pedido con la última respuesta de Claude, los últimos 6, del más viejo al más nuevo', () => {
  assert.equal(MAX_TURNOS, 6)
  const entradas = []
  for (let i = 0; i < 8; i++) entradas.push(u(`pedido ${i}`, 80 - i * 10), c(`voy ${i}`, 79 - i * 10), c(`respuesta ${i}`, 78 - i * 10))
  const t = turnos(entradas)
  assert.equal(t.length, 6)
  assert.deepEqual(t[0], { pedido: 'pedido 2', respuesta: 'respuesta 2', cuando: hace(60) })
  assert.deepEqual(t.at(-1), { pedido: 'pedido 7', respuesta: 'respuesta 7', cuando: hace(10) })
})

test('lo que Claude dijo antes del primer pedido visible y un pedido sin respuesta todavía también son turnos', () => {
  const t = turnos([c('terminé lo anterior', 30), u('<task-notification>x</task-notification>', 29), u('ahora esto', 20)])
  assert.deepEqual(t, [
    { pedido: null, respuesta: 'terminé lo anterior', cuando: hace(30) },
    { pedido: 'ahora esto', respuesta: null, cuando: hace(20) },
  ])
  assert.deepEqual(turnos([]), [])
})

test('los textos largos se recortan: el pedido y la respuesta con su largo', () => {
  const [t] = turnos([u('p '.repeat(400), 5), c('r '.repeat(400), 4)])
  assert.ok(t.pedido.length <= LARGO_PEDIDO + 1 && t.pedido.endsWith('…'))
  assert.ok(t.respuesta.length <= LARGO_RESPUESTA + 1 && t.respuesta.endsWith('…'))
})

test('la vista: cargando, error, vacío y los turnos del más nuevo al más viejo con hace cuánto', () => {
  assert.deepEqual(vistaHistorial({ estado: 'cargando' }, AHORA), { estado: 'cargando', texto: 'Leyendo la conversación…', turnos: [] })
  assert.deepEqual(vistaHistorial({ estado: 'error', error: 'permiso denegado' }, AHORA), { estado: 'error', texto: 'No se pudo leer la conversación', turnos: [] })
  assert.deepEqual(vistaHistorial({ estado: 'listo', entradas: [] }, AHORA), { estado: 'vacio', texto: 'Todavía no hay conversación', turnos: [] })
  // Solo avisos del sistema: tampoco hay conversación
  assert.equal(vistaHistorial({ estado: 'listo', entradas: [u('<command-name>/clear</command-name>', 3)] }, AHORA).estado, 'vacio')
  const v = vistaHistorial({ estado: 'listo', entradas: [u('uno', 30), c('hecho uno', 29), u('dos', 5)] }, AHORA)
  assert.equal(v.estado, 'listo')
  assert.deepEqual(v.turnos, [
    { pedido: 'dos', respuesta: null, hace: 'hace 5 min' },
    { pedido: 'uno', respuesta: 'hecho uno', hace: 'hace 30 min' },
  ])
})

// ------------------------------------------------------------------ en la tarjeta

const ses = extra => ({ sesion: 'ses-1', repo: 'q/oficina', rama: 'feat/25-cerrar', inicio: hace(30), actualizado: hace(0), puedeControlar: true, agentes: [], ...extra })
const prep = s => prepararProyecto(agruparPorProyecto([s])[0], AHORA)

test('cada tarjeta lleva "Qué hizo" en la cabecera, plegado, con su sesión', () => {
  const h = sesiones(prep(ses()), AHORA)
  assert.match(h, /<div class="ses-cab">[\s\S]*<button type="button" class="ses-hizo" data-accion="historial" data-sesion="ses-1" aria-expanded="false">Qué hizo<\/button><\/div>/)
  assert.doesNotMatch(h, /class="det-sub det-hist"/)
})

test('abierto: el detalle va debajo de la cabecera, con sus estados y nombrado por la rama', () => {
  const abierto = estado => sesiones(prep(ses()), AHORA, new Map(), null, {}, 'avi', new Set(), { sesion: 'ses-1', ...estado })
  const cargando = abierto({ estado: 'cargando' })
  assert.match(cargando, /data-accion="historial" data-sesion="ses-1" aria-expanded="true" aria-controls="hist-ses-1"/)
  assert.match(cargando, /<div class="det-sub det-hist" id="hist-ses-1" role="region" aria-label="Qué hizo feat\/25-cerrar" aria-busy="true">/)
  assert.match(cargando, /Leyendo la conversación…/)
  // Antes del escenario: se despliega debajo del botón
  assert.ok(cargando.indexOf('det-hist') < cargando.indexOf('class="esc'))
  assert.match(abierto({ estado: 'error', error: 'x' }), /class="det-vacio" data-tono="error">No se pudo leer la conversación</)
  assert.match(abierto({ estado: 'listo', entradas: [] }), /class="det-vacio">Todavía no hay conversación</)
  const listo = abierto({ estado: 'listo', entradas: [u('arreglá <b>el</b> header', 10), c('Listo & probado', 9)] })
  assert.match(listo, /<ol class="hist-turnos">/)
  assert.match(listo, /<span class="hist-quien">Vos<\/span>[\s\S]*arreglá &lt;b&gt;el&lt;\/b&gt; header/)
  assert.match(listo, /<span class="hist-quien">Claude<\/span>[\s\S]*Listo &amp; probado/)
  assert.match(listo, /<time data-vivo>hace 10 min<\/time>/)
  // Otra sesión no se despliega
  assert.doesNotMatch(sesiones(prep(ses({ sesion: 'ses-2' })), AHORA, new Map(), null, {}, 'avi', new Set(), { sesion: 'ses-1', estado: 'cargando' }), /det-hist/)
})

test('la firma de las escenas cambia al abrir "Qué hizo" y con lo que se lee, no con la hora', () => {
  const p = prep(ses())
  const cerrada = firmaEscenas('q/oficina', p)
  const cargando = firmaEscenas('q/oficina', p, new Map(), null, { sesion: 'ses-1', estado: 'cargando' })
  const listo = firmaEscenas('q/oficina', p, new Map(), null, { sesion: 'ses-1', estado: 'listo', entradas: [u('uno', 3)] })
  assert.notEqual(cerrada, cargando)
  assert.notEqual(cargando, listo)
  assert.equal(listo, firmaEscenas('q/oficina', p, new Map(), null, { sesion: 'ses-1', estado: 'listo', entradas: [u('uno', 3)] }))
  // Lo de antes: sin "Qué hizo" abierto la firma no cambia
  assert.equal(cerrada, firmaEscenas('q/oficina', p, new Map(), null, null))
})
