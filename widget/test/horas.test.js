// Tests de horas.js (odd/tasks/horas-trabajo.md, T2: S1, S4 y el contrato): el tramo abierto vivo o
// sin latido, la medianoche de Argentina, las features (repo + rama), los períodos, el detalle, el
// formato de la duración, el reloj de la tarjeta y el estado de la hoja. Puros: se prueban en node.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  tramosNormalizados, partirPorDia, featureDe, resumenHoras, detalleFeature, totalHoy, duracion, duracionCorta,
  trabajadoMs, textoTrabajado, etiquetaDia, nombreFilaHoras, subtituloHoras, alEscHoras, horasInicial, abrirHoras,
  cerrarHoras, elegirPeriodo, abrirFeature, cerrarFeature, MS_SIN_LATIDO, PERIODOS, FUERA_DE_UN_REPO,
} from '../src/horas.js'

const MIN = 60000
const H = 60 * MIN
// Ahora: viernes 27/11/2026 15:00 en Argentina (18:00 UTC); la semana empieza el lunes 23
const AHORA = Date.parse('2026-11-27T18:00:00Z')
const iso = ms => new Date(ms).toISOString()
const tramo = (desdeMs, hastaMs, repo = 'quintechlab/oficina', rama = 'feat/horas') => ({
  desde: iso(desdeMs), hasta: hastaMs == null ? null : iso(hastaMs), repo, rama,
})
const sesion = (id, tramos, actualizadoMs = AHORA) => ({ sesion: id, actualizado: iso(actualizadoMs), tramos })

// ------------------------------------------------------------------ el tramo abierto (contrato)

test('un tramo abierto de un archivo que late cuenta hasta ahora', () => {
  const t = tramosNormalizados([sesion('a', [tramo(AHORA - 30 * MIN, null)], AHORA - 20000)], AHORA)
  assert.equal(t.length, 1)
  assert.equal(t[0].hasta - t[0].desde, 30 * MIN)
  assert.equal(t[0].vivo, true)
})

test('un tramo abierto de un archivo que no late hace más de 2 min cuenta hasta su actualizado', () => {
  const act = AHORA - MS_SIN_LATIDO - 1000
  const t = tramosNormalizados([sesion('a', [tramo(AHORA - H, null)], act)], AHORA)
  assert.equal(t[0].hasta, act)
  assert.equal(t[0].vivo, false)
  // Justo en los 2 min todavía late
  const justo = tramosNormalizados([sesion('a', [tramo(AHORA - H, null)], AHORA - MS_SIN_LATIDO)], AHORA)
  assert.equal(justo[0].hasta, AHORA)
})

test('los tramos cerrados cuentan tal cual; los que no se entienden o no duran se saltean', () => {
  const t = tramosNormalizados([sesion('a', [
    tramo(AHORA - 3 * H, AHORA - 2 * H),
    { desde: 'ayer', hasta: null, repo: null, rama: null },
    tramo(AHORA - H, AHORA - 2 * H),
    { desde: iso(AHORA - H), hasta: 'nunca', repo: null, rama: null },
  ])], AHORA)
  assert.equal(t.length, 1)
  assert.equal(t[0].hasta - t[0].desde, H)
  assert.equal(t[0].vivo, false)
})

test('nada pasa de ahora (un reloj adelantado no suma futuro)', () => {
  const t = tramosNormalizados([sesion('a', [tramo(AHORA - H, AHORA + H)])], AHORA)
  assert.equal(t[0].hasta, AHORA)
})

// ------------------------------------------------------------------ la medianoche de Argentina

test('un tramo que cruza la medianoche de Argentina se parte en dos días', () => {
  // De 23:00 del 26 a 01:30 del 27 en Argentina (02:00 a 04:30 UTC del 27)
  const d = partirPorDia(Date.parse('2026-11-27T02:00:00Z'), Date.parse('2026-11-27T04:30:00Z'))
  assert.deepEqual(d, [{ dia: '2026-11-26', ms: H }, { dia: '2026-11-27', ms: 1.5 * H }])
})

test('un tramo de un solo día queda entero y uno de varios días se parte en cada uno', () => {
  assert.deepEqual(partirPorDia(Date.parse('2026-11-27T12:00:00Z'), Date.parse('2026-11-27T13:00:00Z')), [{ dia: '2026-11-27', ms: H }])
  const largo = partirPorDia(Date.parse('2026-11-25T02:00:00Z'), Date.parse('2026-11-27T04:00:00Z'))
  assert.deepEqual(largo.map(x => x.dia), ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'])
  assert.equal(largo.reduce((n, x) => n + x.ms, 0), 50 * H)
})

// ------------------------------------------------------------------ las features (S1)

test('la feature es repo + rama: main queda main, sin rama y fuera de un repo', () => {
  assert.deepEqual(featureDe('quintechlab/oficina', 'feat/horas'), { clave: 'quintechlab/oficina\u0000feat/horas', repo: 'quintechlab/oficina', rama: 'feat/horas', nombre: 'oficina', rotulo: 'feat/horas' })
  assert.equal(featureDe('quintechlab/oficina', 'main').rotulo, 'main')
  assert.equal(featureDe('quintechlab/oficina', null).rotulo, 'sin rama')
  const fuera = featureDe(null, 'algo')
  assert.equal(fuera.nombre, FUERA_DE_UN_REPO)
  assert.equal(fuera.nombre, 'fuera de un repo')
  assert.equal(fuera.rotulo, '')
  assert.equal(fuera.clave, featureDe(null, null).clave)
})

test('lo trabajado en una rama suma a su feature, venga de la sesión que venga', () => {
  const r = resumenHoras([
    sesion('a', [tramo(AHORA - 4 * H, AHORA - 3 * H), tramo(AHORA - 2 * H, AHORA - 1.5 * H, 'quintechlab/oficina', 'main')]),
    sesion('b', [tramo(AHORA - 3 * H, AHORA - 2.5 * H)]),
    sesion('c', [tramo(AHORA - 30 * MIN, AHORA - 20 * MIN, null, null)]),
  ], AHORA, 'todo')
  const por = Object.fromEntries(r.features.map(f => [f.rotulo || f.nombre, f]))
  assert.equal(por['feat/horas'].ms, 1.5 * H)
  assert.equal(por['feat/horas'].sesiones, 2)
  assert.equal(por.main.ms, 30 * MIN)
  assert.equal(por['fuera de un repo'].ms, 10 * MIN)
  assert.equal(r.total, 2 * H + 10 * MIN)
})

test('la feature con actividad más reciente va primero, y la que corre ahora dice activa', () => {
  const r = resumenHoras([
    sesion('a', [tramo(AHORA - 5 * H, AHORA - H, 'quintechlab/catalogo', 'main')]),
    sesion('b', [tramo(AHORA - 10 * MIN, null)]),
    sesion('c', [tramo(AHORA - 3 * H, AHORA - 2 * H, 'quintechlab/crm', 'feat/x')]),
  ], AHORA, 'todo')
  assert.deepEqual(r.features.map(f => f.nombre), ['oficina', 'catalogo', 'crm'])
  assert.deepEqual(r.features.map(f => f.activa), [true, false, false])
  assert.equal(r.max, 4 * H)
})

// ------------------------------------------------------------------ los períodos (S4)

test('Hoy, Semana (desde el lunes de Argentina) y Todo', () => {
  const s = [sesion('a', [
    tramo(AHORA - H, AHORA - 30 * MIN), // hoy, viernes 27
    tramo(Date.parse('2026-11-23T12:00:00Z'), Date.parse('2026-11-23T14:00:00Z')), // lunes 23
    tramo(Date.parse('2026-11-22T12:00:00Z'), Date.parse('2026-11-22T13:00:00Z')), // domingo 22: la semana pasada
  ])]
  assert.equal(resumenHoras(s, AHORA, 'hoy').total, 30 * MIN)
  assert.equal(resumenHoras(s, AHORA, 'semana').total, 2.5 * H)
  assert.equal(resumenHoras(s, AHORA, 'todo').total, 3.5 * H)
  assert.equal(totalHoy(s, AHORA), 30 * MIN)
  assert.deepEqual(PERIODOS.map(([v]) => v), ['hoy', 'semana', 'todo'])
})

test('un tramo que cruzó la medianoche cuenta en Hoy solo desde las 00:00', () => {
  // De 23:00 del 26 a 01:00 del 27 en Argentina
  const s = [sesion('a', [tramo(Date.parse('2026-11-27T02:00:00Z'), Date.parse('2026-11-27T04:00:00Z'))])]
  assert.equal(resumenHoras(s, AHORA, 'hoy').total, H)
})

test('una feature sin nada en el período no aparece', () => {
  const s = [sesion('a', [tramo(Date.parse('2026-11-20T12:00:00Z'), Date.parse('2026-11-20T13:00:00Z'))])]
  assert.deepEqual(resumenHoras(s, AHORA, 'semana').features, [])
  assert.equal(resumenHoras(s, AHORA, 'todo').features.length, 1)
})

// ------------------------------------------------------------------ el detalle de una feature (S4)

test('el detalle trae el total por día (el más nuevo arriba) y sus sesiones', () => {
  const clave = featureDe('quintechlab/oficina', 'feat/horas').clave
  const d = detalleFeature([
    sesion('a', [tramo(AHORA - 2 * H, AHORA - H), tramo(Date.parse('2026-11-26T12:00:00Z'), Date.parse('2026-11-26T12:45:00Z'))]),
    sesion('b', [tramo(AHORA - 20 * MIN, null)]),
    sesion('c', [tramo(AHORA - H, AHORA - 30 * MIN, 'quintechlab/oficina', 'main')]),
  ], AHORA, clave, 'semana')
  assert.equal(d.ms, H + 45 * MIN + 20 * MIN)
  assert.deepEqual(d.dias, [{ dia: '2026-11-27', ms: H + 20 * MIN }, { dia: '2026-11-26', ms: 45 * MIN }])
  assert.deepEqual(d.sesiones.map(x => [x.sesion, x.ms, x.activa]), [['b', 20 * MIN, true], ['a', H + 45 * MIN, false]])
  assert.equal(d.rotulo, 'feat/horas')
})

test('el detalle de una feature que no está da null', () => {
  assert.equal(detalleFeature([], AHORA, 'nada', 'todo'), null)
})

// ------------------------------------------------------------------ el formato de la duración

test('la duración se escribe como el resto de Avis', () => {
  assert.equal(duracion(0), 'menos de 1 min')
  assert.equal(duracion(59999), 'menos de 1 min')
  assert.equal(duracion(12 * MIN + 59000), '12 min')
  assert.equal(duracion(H + 5 * MIN), '1 h 5 min')
  assert.equal(duracion(2 * H), '2 h')
  assert.equal(duracion(26 * H + 10 * MIN), '26 h 10 min')
})

test('la corta, para la fila del menú', () => {
  assert.equal(duracionCorta(0), '—')
  assert.equal(duracionCorta(30000), '<1m')
  assert.equal(duracionCorta(12 * MIN), '12m')
  assert.equal(duracionCorta(3 * H + 20 * MIN), '3h20')
  assert.equal(duracionCorta(3 * H + 5 * MIN), '3h05')
  assert.equal(duracionCorta(2 * H), '2h')
})

test('el día del detalle: hoy, ayer o «lun 23/11»', () => {
  assert.equal(etiquetaDia('2026-11-27', '2026-11-27'), 'hoy')
  assert.equal(etiquetaDia('2026-11-26', '2026-11-27'), 'ayer')
  assert.equal(etiquetaDia('2026-11-23', '2026-11-27'), 'lun 23/11')
})

// ------------------------------------------------------------------ el reloj de la tarjeta (S4)

test('el reloj de la tarjeta: ms cerrados más el tramo abierto hasta ahora', () => {
  assert.equal(trabajadoMs({ trabajado: { ms: 10 * MIN, desde: iso(AHORA - 5 * MIN) } }, AHORA), 15 * MIN)
  assert.equal(trabajadoMs({ trabajado: { ms: 10 * MIN, desde: null } }, AHORA), 10 * MIN)
  // Un `desde` en el futuro no resta
  assert.equal(trabajadoMs({ trabajado: { ms: 10 * MIN, desde: iso(AHORA + MIN) } }, AHORA), 10 * MIN)
})

test('sin `trabajado` (un mod anterior) o con uno que no se entiende, la tarjeta no muestra reloj', () => {
  assert.equal(trabajadoMs({}, AHORA), null)
  assert.equal(trabajadoMs({ trabajado: null }, AHORA), null)
  assert.equal(trabajadoMs({ trabajado: { ms: 'x', desde: null } }, AHORA), null)
  assert.equal(textoTrabajado({}, AHORA), null)
})

test('el texto del reloj: la cifra, si corre y lo que lee el lector', () => {
  const t = textoTrabajado({ trabajado: { ms: H, desde: iso(AHORA - 5 * MIN) } }, AHORA)
  assert.deepEqual(t, { cifra: '1 h 5 min', corre: true, lector: 'trabajado 1 h 5 min, el reloj corre', title: 'Trabajado: 1 h 5 min · corre mientras algún agente trabaja' })
  const quieto = textoTrabajado({ trabajado: { ms: 12 * MIN, desde: null } }, AHORA)
  assert.equal(quieto.corre, false)
  assert.equal(quieto.lector, 'trabajado 12 min, frenado')
})

// ------------------------------------------------------------------ la fila del menú y la bajada

test('el nombre de la fila del menú y la bajada de la hoja', () => {
  assert.equal(nombreFilaHoras(null), 'Horas')
  assert.equal(nombreFilaHoras(0), 'Horas, nada trabajado hoy')
  assert.equal(nombreFilaHoras(H + 5 * MIN), 'Horas, 1 h 5 min hoy')
  assert.equal(subtituloHoras({ periodo: 'hoy', total: 2 * H, features: 3 }), 'Hoy · 2 h · 3 features')
  assert.equal(subtituloHoras({ periodo: 'semana', total: 0, features: 0 }), 'Esta semana · nada todavía')
  assert.equal(subtituloHoras({ periodo: 'todo', total: MIN, features: 1 }), 'Todo · 1 min · 1 feature')
})

// ------------------------------------------------------------------ el estado de la hoja y Esc

test('abrir, elegir período, abrir y cerrar una feature, cerrar', () => {
  let h = horasInicial()
  assert.equal(h.abierta, false)
  assert.equal(h.periodo, 'hoy')
  h = abrirHoras(h)
  assert.equal(h.abierta, true)
  h = elegirPeriodo(h, 'semana')
  assert.equal(h.periodo, 'semana')
  assert.equal(elegirPeriodo(h, 'mes').periodo, 'semana')
  h = abrirFeature(h, 'k')
  assert.equal(h.feature, 'k')
  assert.equal(cerrarFeature(h).feature, null)
  const c = cerrarHoras(h)
  assert.equal(c.abierta, false)
  assert.equal(c.feature, null)
  // El período elegido se recuerda mientras la ventana sigue abierta
  assert.equal(c.periodo, 'semana')
})

test('Esc: con una feature abierta la cierra; si no, la última capa (que lleva a Sesiones)', () => {
  assert.equal(alEscHoras({ ...horasInicial(), abierta: true, feature: 'k' }), 'cerrar-feature')
  assert.equal(alEscHoras({ ...horasInicial(), abierta: true }), 'cerrar')
})
