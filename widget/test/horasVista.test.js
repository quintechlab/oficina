// Tests de horasVista.js (odd/tasks/horas-trabajo.md, S4): el selector de período, el total, la lista de
// features con su barra, el vacío, el error y la feature abierta. Puros: HTML, sin DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partesHoras, cabeceraHoras, valorFeature, claveDeValor, nombreFeature } from '../src/horasVista.js'
import { resumenHoras, detalleFeature, featureDe } from '../src/horas.js'

const MIN = 60000
const H = 60 * MIN
const AHORA = Date.parse('2026-11-27T18:00:00Z')
const iso = ms => new Date(ms).toISOString()
const SES = [
  { sesion: '8c9494fd-dbea-492d-a475-8660c720f9d9', actualizado: iso(AHORA), tramos: [
    { desde: iso(AHORA - 2 * H), hasta: iso(AHORA - H), repo: 'quintechlab/oficina', rama: 'feat/horas' },
    { desde: iso(AHORA - 10 * MIN), hasta: null, repo: 'quintechlab/oficina', rama: 'feat/horas' },
  ] },
  { sesion: 'b', actualizado: iso(AHORA), tramos: [{ desde: iso(AHORA - 3 * H), hasta: iso(AHORA - 2.5 * H), repo: 'quintechlab/catalogo', rama: null }] },
  { sesion: 'c', actualizado: iso(AHORA), tramos: [{ desde: iso(AHORA - 4 * H), hasta: iso(AHORA - 3.9 * H), repo: null, rama: null }] },
]
const datos = (extra = {}) => ({ periodo: 'hoy', resumen: resumenHoras(SES, AHORA, 'hoy'), detalle: null, leido: true, fantasmas: false, error: null, ahoraMs: AHORA, mascota: 'avi', ...extra })

test('el selector de período es un radiogroup con foco itinerante; el elegido es el único tabulable', () => {
  const h = cabeceraHoras({ periodo: 'semana', resumen: resumenHoras(SES, AHORA, 'semana'), leido: true })
  assert.match(h, /<div class="seg hor-per" role="radiogroup" aria-label="Período">/)
  assert.match(h, /role="radio" aria-checked="false" tabindex="-1" data-accion="hor-periodo" data-valor="hoy"/)
  assert.match(h, /role="radio" aria-checked="true" tabindex="0" data-accion="hor-periodo" data-valor="semana"/)
  assert.match(h, /<p class="hor-total"><b>1 h 46 min<\/b><span>en 3 features<\/span><\/p>/)
})

test('la lista: una fila por feature, la más reciente primero, con su nombre accesible, su total y su barra', () => {
  const { cuerpo, err } = partesHoras(datos())
  assert.equal(err, '')
  const filas = cuerpo.match(/<li [^>]*>/g)
  assert.equal(filas.length, 3)
  assert.ok(cuerpo.indexOf('oficina') < cuerpo.indexOf('catalogo') && cuerpo.indexOf('catalogo') < cuerpo.indexOf('fuera de un repo'))
  assert.match(cuerpo, /aria-label="oficina · feat\/horas: 1 h 10 min, 1 sesión, trabajando ahora"/)
  assert.match(cuerpo, /<span class="hor-r sin">sin rama<\/span>/)
  assert.match(cuerpo, /<b class="sin">fuera de un repo<\/b>/)
  // La más larga llena la barra; las demás, en proporción
  assert.match(filas[0], /--p:100%/)
  assert.match(filas[0], /class="activa"/)
  // Lo que viene de afuera va escapado
  const raro = partesHoras(datos({ resumen: resumenHoras([{ sesion: 'x', actualizado: iso(AHORA), tramos: [{ desde: iso(AHORA - H), hasta: iso(AHORA - 30 * MIN), repo: 'q/<b>', rama: '"><img>' }] }], AHORA, 'hoy') }))
  assert.doesNotMatch(raro.cuerpo, /<img>|"><img/)
})

test('el valor de una feature va y vuelve por data-valor', () => {
  const clave = featureDe('quintechlab/oficina', 'feat/horas').clave
  assert.equal(claveDeValor(valorFeature(clave)), clave)
  assert.doesNotMatch(valorFeature(clave), /\u0000/)
  assert.equal(nombreFeature(featureDe(null, null)), 'fuera de un repo')
})

test('sin nada en el período: el vacío con la mascota y qué cuenta el reloj', () => {
  const { cuerpo } = partesHoras(datos({ periodo: 'semana', resumen: { total: 0, max: 0, features: [] } }))
  assert.match(cuerpo, /<div class="primer hor-vacio">/)
  assert.match(cuerpo, /<b>Nada trabajado esta semana<\/b>/)
  assert.match(cuerpo, /se frena cuando Claude te pregunta algo o espera tu permiso/)
})

test('leyendo: las filas fantasma solo si tarda; con error y sin datos, el error en el cuerpo', () => {
  assert.equal(partesHoras(datos({ leido: false })).cuerpo, '')
  assert.match(partesHoras(datos({ leido: false, fantasmas: true })).cuerpo, /hor-lista fantasmas" aria-hidden="true"/)
  const e = partesHoras(datos({ leido: false, error: 'acceso denegado' }))
  assert.match(e.cuerpo, /<div class="err" role="alert">[\s\S]*No se pudieron leer las horas\.[\s\S]*acceso denegado[\s\S]*data-accion="hor-releer"/)
  // Con datos de antes: el error arriba y la lista sigue
  const con = partesHoras(datos({ error: 'acceso denegado' }))
  assert.match(con.err, /No se pudieron leer las horas\./)
  assert.match(con.cuerpo, /hor-lista/)
})

test('la feature abierta: volver al período, el total por día y las sesiones', () => {
  const clave = featureDe('quintechlab/oficina', 'feat/horas').clave
  const { cuerpo } = partesHoras(datos({ periodo: 'todo', detalle: detalleFeature(SES, AHORA, clave, 'todo') }))
  assert.match(cuerpo, /data-accion="hor-volver" data-k="volver">‹ Todo<\/button>/)
  assert.match(cuerpo, /<h2 id="hor-det-h" tabindex="-1"/)
  assert.match(cuerpo, /<p class="hor-det-s"><b>1 h 10 min<\/b> · 1 sesión · <span class="hor-ahora">/)
  assert.match(cuerpo, /<span class="d">hoy<\/span>/)
  assert.match(cuerpo, /<span class="oculto">Sesión <\/span>8c9494fd<\/span><span class="r">hoy 13:00 → ahora<\/span><span class="t">1 h 10 min<\/span>/)
})


test('sin nada en el período el total dice «0 min», no «menos de 1 min»', () => {
  assert.match(cabeceraHoras({ periodo: 'hoy', resumen: { total: 0, max: 0, features: [] }, leido: true }), /<b>0 min<\/b><span>sin features<\/span>/)
})
