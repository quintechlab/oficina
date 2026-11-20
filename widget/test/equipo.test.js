// Tests de la lectura de los comentarios del Issue "Presencia" (igual que extraerComentario del mod).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extraerComentario, companeros } from '../src/equipo.js'

const AHORA = Date.parse('2026-11-19T23:50:00Z')
const hace = ms => new Date(AHORA - ms).toISOString()
const MIN = 60000
const MARCA = '<!-- oficina:presencia -->'
const envolver = d => `${MARCA}\n\`\`\`json\n${JSON.stringify(d, null, 2)}\n\`\`\``

const sesion = extra => ({
  v: 1, sesion: 's1', usuario: 'NCsolucionesdigitales', nombre: 'Campos', estado: 'trabajando',
  repo: 'quintechlab/web', rama: 'feat/8-landing', tarea: 8, nota: null, inicio: hace(30 * MIN),
  tareaDesde: hace(30 * MIN), actualizado: hace(MIN), archivos: [], ...extra,
})

test('lee un comentario v2 con varias sesiones y los campos de la v0.4', () => {
  const c = extraerComentario(envolver({
    v: 2, usuario: 'NCsolucionesdigitales', nombre: 'Campos', ausente: false, actualizado: hace(MIN),
    sesiones: [
      sesion({ actividad: 'corriendo tests', agentes: [{ id: 'a1', nombre: 'Lucas', inventado: false, tipo: 'general-purpose', tarea: 'hero', desde: hace(MIN), estado: 'trabajando', hasta: null }, { id: 'roto' }], preguntas: [] }),
      sesion({ sesion: 's2', repo: null, rama: null, tarea: null, archivos: [1, 'a.ts'] }),
      { sesion: 'sin-usuario', actualizado: hace(MIN) },
    ],
  }))
  assert.equal(c.v, 2)
  assert.equal(c.usuario, 'NCsolucionesdigitales')
  assert.equal(c.nombre, 'Campos')
  assert.equal(c.ausente, false)
  assert.deepEqual(c.sesiones.map(s => s.sesion), ['s1', 's2'])
  assert.equal(c.sesiones[0].actividad, 'corriendo tests')
  assert.deepEqual(c.sesiones[0].agentes.map(a => a.id), ['a1'])
  assert.deepEqual(c.sesiones[1].archivos, ['a.ts'])
  assert.equal('actividad' in c.sesiones[1], false)
})

test('lee un comentario v1 como una sola sesión; v1 "fuera" queda ausente y sin sesiones', () => {
  const c = extraerComentario(envolver(sesion({ sesion: undefined })))
  assert.equal(c.v, 2)
  assert.equal(c.ausente, false)
  assert.deepEqual(c.sesiones.map(s => s.sesion), ['v1'])
  const f = extraerComentario(envolver(sesion({ estado: 'fuera' })))
  assert.equal(f.ausente, true)
  assert.deepEqual(f.sesiones, [])
})

test('un comentario que no es del mod o con JSON roto no cuenta', () => {
  assert.equal(extraerComentario('¡Buen día! ```json\n{"v":2}\n```'), null)
  assert.equal(extraerComentario(`${MARCA}\n\`\`\`json\n{"v": 2, "usuario": \n\`\`\``), null)
  assert.equal(extraerComentario(`${MARCA}\nsin bloque json`), null)
  assert.equal(extraerComentario(envolver({ v: 3, usuario: 'x' })), null)
  assert.equal(extraerComentario(null), null)
})

test('compañeros: saca tu propio comentario, junta los duplicados y elige la sesión principal', () => {
  const comentarios = [
    { usuario: 'nicoequintana', cuerpo: envolver({ v: 2, usuario: 'nicoequintana', nombre: 'Quintana', ausente: false, actualizado: hace(MIN), sesiones: [sesion({ usuario: 'nicoequintana', nombre: 'Quintana' })] }) },
    { usuario: 'NCsolucionesdigitales', cuerpo: envolver({ v: 2, usuario: 'NCsolucionesdigitales', nombre: 'Campos', ausente: false, actualizado: hace(2 * MIN), sesiones: [sesion({ sesion: 'fuera-repo', repo: null, rama: null, tarea: null, actualizado: hace(MIN) })] }) },
    // Un comentario viejo de la misma persona (sesión con una versión anterior del mod)
    { usuario: 'NCsolucionesdigitales', cuerpo: envolver(sesion({ sesion: 'web', actualizado: hace(3 * MIN) })) },
    { usuario: 'otro', cuerpo: 'Un comentario cualquiera' },
  ]
  const lista = companeros(comentarios, 'NICOEQUINTANA', AHORA)
  assert.equal(lista.length, 1)
  const [campos] = lista
  assert.equal(campos.nombre, 'Campos')
  assert.equal(campos.ausente, false)
  // La principal es la que está en un repositorio y con tarea, aunque la otra publicó más recién
  assert.equal(campos.principal.sesion, 'web')
  assert.deepEqual(campos.sesiones.map(s => s.sesion).sort(), ['fuera-repo', 'web'])
})

test('compañeros: ausente o con sesiones viejas queda sin sesión principal', () => {
  const ausente = { usuario: 'NCsolucionesdigitales', cuerpo: envolver({ v: 2, usuario: 'NCsolucionesdigitales', nombre: 'Campos', ausente: true, actualizado: hace(MIN), sesiones: [sesion({})] }) }
  assert.equal(companeros([ausente], 'nicoequintana', AHORA)[0].principal, null)
  const viejo = { usuario: 'NCsolucionesdigitales', cuerpo: envolver({ v: 2, usuario: 'NCsolucionesdigitales', nombre: 'Campos', ausente: false, actualizado: hace(13 * 60 * MIN), sesiones: [sesion({ actualizado: hace(13 * 60 * MIN) })] }) }
  assert.equal(companeros([viejo], 'nicoequintana', AHORA)[0].principal, null)
})

test('compañeros sin saber quién sos: se muestran todos', () => {
  const c = { usuario: 'nicoequintana', cuerpo: envolver(sesion({ usuario: 'nicoequintana', nombre: 'Quintana' })) }
  assert.equal(companeros([c], null, AHORA).length, 1)
})
