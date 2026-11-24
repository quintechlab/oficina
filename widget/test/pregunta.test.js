// Tests de la tarjeta de pregunta (estilo Avis, F2; dirección 4.5 y 11): misma forma de contrato
// que el globo (data-accion, data-pregunta, data-item, data-globo), sin opción por defecto.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { globo, avisoOtroProyecto, anuncioPregunta } from '../src/pregunta.js'
import { agruparPorProyecto, preguntasPendientes } from '../src/logica.js'

const AHORA = Date.parse('2026-11-20T12:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()

const ITEM_PRECIOS = {
  pregunta: '¿Cómo mostramos los precios?', encabezado: 'Precios', multiple: false,
  opciones: [
    { etiqueta: 'Precio tachado (Recomendada)', descripcion: 'Se ve el ahorro.' },
    { etiqueta: 'Solo el nuevo', descripcion: 'Más limpio.' },
  ],
}
const ITEM_FOTOS = {
  pregunta: '¿Qué tamaños exportamos?', encabezado: 'Fotos', multiple: true,
  opciones: [{ etiqueta: 'Miniatura', descripcion: 'Listado.' }, { etiqueta: 'Ficha', descripcion: 'Principal.' }],
}

function proyecto({ items = [ITEM_PRECIOS], responde = true, repo = 'q/catalogo', agentes = [], agente = null } = {}) {
  const s = {
    sesion: 's1', repo, tarea: 48, rama: 'feat/48-precios', inicio: hace(10), actualizado: hace(0), puedeResponder: responde,
    agentes, preguntas: [{ id: 'toolu_1', agente, desde: hace(2), items }],
  }
  return agruparPorProyecto([s])[0]
}
const pend = p => preguntasPendientes(p)
const opciones = h => [...h.matchAll(/<button type="button" class="op[^"]*"[^>]*>/g)].map(m => m[0])

test('una opción: tarjeta con el contrato del globo, cabecera, texto y pie con "Otra respuesta" y "Más tarde"', () => {
  const h = globo(pend(proyecto()), { ahoraMs: AHORA })
  assert.match(h, /^<div class="preg[^"]*" role="dialog" aria-labelledby="g-p" data-globo data-pregunta="toolu_1" data-item="0">/)
  assert.match(h, /<b>Claude<\/b> te pregunta · #48 · hace 2 min/)
  // Cabecera: el Avi de 38 de quien pregunta, en teEspera y decorativo (5.6)
  assert.match(h, /<div class="preg-cab"><span class="avi" style="--t:28px;[^"]*" aria-hidden="true"><svg[^>]*class="m-avi e-teEspera chica"/)
  assert.match(h, /<p class="preg-txt" id="g-p">¿Cómo mostramos los precios\?<\/p>/)
  assert.equal(opciones(h).length, 2)
  for (const b of opciones(h)) assert.match(b, /data-accion="op" data-i="\d" data-pregunta="toolu_1" data-item="0"/)
  assert.match(h, /<button type="button" class="preg-link" data-accion="otra">Otra respuesta<\/button>/)
  assert.match(h, /<button type="button" class="btn sec" data-accion="tarde">Más tarde<\/button>/)
  // La tarjeta no tiene cola: nada de --cola
  assert.doesNotMatch(h, /--cola/)
})

test('"Recomendada" es solo un rótulo: la opción se ve igual que las demás, sin marca ni foco', () => {
  const h = globo(pend(proyecto()), { ahoraMs: AHORA })
  assert.match(h, /Precio tachado<span class="recom">Recomendada<\/span>/)
  const [rec, otra] = opciones(h)
  // Mismos atributos salvo el índice: ni clase propia, ni aria-pressed, ni autofocus, ni tabindex
  assert.equal(rec.replace('data-i="0"', 'data-i="1"'), otra)
  assert.doesNotMatch(h, /autofocus|tabindex|aria-pressed="true"|aria-checked/)
})

test('selección múltiple: aria-pressed, la marcada lleva ✓, y "Enviar" queda deshabilitado sin marcas', () => {
  const p = proyecto({ items: [ITEM_FOTOS] })
  const [q] = pend(p)
  const vacio = globo([q], { ahoraMs: AHORA })
  assert.match(vacio, /<p class="preg-modo">Se pueden elegir varias<\/p>/)
  assert.match(vacio, /<button type="button" class="btn" data-accion="enviar-multi" data-pregunta="toolu_1" data-item="0" disabled>Enviar<\/button>/)
  assert.doesNotMatch(vacio, /data-accion="tarde"/)
  for (const b of opciones(vacio)) assert.match(b, /aria-pressed="false"/)
  const marcado = globo([q], { ahoraMs: AHORA, ui: { seleccionDe: q.clave, seleccion: new Set([1]) } })
  assert.match(marcado, /data-i="1"[^>]*aria-pressed="true"><span class="n" aria-hidden="true">✓<\/span>/)
  assert.match(marcado, /data-accion="enviar-multi" data-pregunta="toolu_1" data-item="0">Enviar \(1\)<\/button>/)
})

test('varias preguntas: pestañas con quién y el encabezado, el modo dice que se envían juntas, "Seguir" hasta la última', () => {
  const p = proyecto({ items: [ITEM_FOTOS, ITEM_PRECIOS] })
  const lista = pend(p)
  const h = globo(lista, { ahoraMs: AHORA, ui: { seleccionDe: lista[0].clave, seleccion: new Set([0]) } })
  assert.match(h, /<div class="preg-tabs" role="tablist" aria-label="Preguntas pendientes">/)
  assert.match(h, /role="tab" aria-selected="true" data-accion="tab" data-i="0">.*Claude · Fotos <span aria-hidden="true">!<\/span>/)
  assert.match(h, /<p class="preg-modo">Se pueden elegir varias · pregunta 1 de 2: se envían juntas<\/p>/)
  assert.match(h, />Seguir \(1\)<\/button>/)
  // Con la primera ya respondida en el borrador: su pestaña lleva ✓ y la segunda envía
  const conBorrador = globo(lista, { activa: 1, ahoraMs: AHORA, ui: { borradores: { toolu_1: { [ITEM_FOTOS.pregunta]: { valor: 'Ficha' } } } } })
  assert.match(conBorrador, /Claude · Fotos <span aria-hidden="true">✓<\/span>/)
  assert.match(conBorrador, /<p class="preg-modo">Pregunta 2 de 2: se envían juntas<\/p>/)
})

test('"Otra respuesta": el campo conserva el texto escrito y su botón envía o sigue', () => {
  const h = globo(pend(proyecto()), { ahoraMs: AHORA, ui: { otra: true, textoOtra: 'Mayorista <2027>' } })
  assert.match(h, /<label for="g-otra-in">Tu respuesta<\/label><input id="g-otra-in" type="text" autocomplete="off" value="Mayorista &lt;2027&gt;">/)
  assert.match(h, /<button type="button" class="btn" data-accion="enviar-otra" data-pregunta="toolu_1" data-item="0">Enviar<\/button>/)
})

test('solo lectura: opciones sin botones ni acciones y la nota para responder en Claude', () => {
  const h = globo(pend(proyecto({ responde: false })), { ahoraMs: AHORA })
  assert.match(h, /^<div class="preg[^"]*" role="dialog" aria-labelledby="g-p" data-globo>/)
  assert.doesNotMatch(h, /<button|data-accion/)
  assert.equal((h.match(/<li class="op ro">/g) ?? []).length, 2)
  assert.match(h, /<p class="preg-nota" role="status">Responder en Claude: la sesión espera tu respuesta en su ventana.<\/p>/)
})

test('envío: mientras se envía las opciones quedan en solo lectura; después, los textos de hoy', () => {
  const lista = pend(proyecto())
  const enviando = globo(lista, { ahoraMs: AHORA, ui: { envios: { toolu_1: { estado: 'enviando' } } } })
  assert.doesNotMatch(enviando, /data-accion="op"/)
  assert.match(enviando, /role="status">Enviando tu respuesta a Claude…<\/p>/)
  const enClaude = globo(lista, { ahoraMs: AHORA, ui: { envios: { toolu_1: { estado: 'enClaude' } } } })
  assert.match(enClaude, /role="status">Respondé en Claude: la sesión no tomó la respuesta del widget.<\/p>/)
  const ya = globo(lista, { ahoraMs: AHORA, ui: { envios: { toolu_1: { estado: 'yaRespondida' } } } })
  assert.match(ya, /role="status">Ya se respondió en Claude.<\/p>/)
})

test('hecho: una píldora con estado, que se achica al salir', () => {
  const hecho = { mensaje: 'Listo, le respondiste a Claude: «Ficha»', listo: true, color: '#F2B632', pj: 'claude' }
  const h = globo([], { ahoraMs: AHORA, ui: { hecho } })
  assert.match(h, /^<div class="hecho" role="status">[\s\S]*Listo, le respondiste a Claude: «Ficha»<\/div>$/)
  assert.match(globo([], { ahoraMs: AHORA, ui: { hecho, saliendo: true } }), /^<div class="hecho sale" role="status">/)
})

test('plegada con "Más tarde": el aviso vuelve a mostrarla y no responde nada', () => {
  const uno = globo(pend(proyecto()), { ahoraMs: AHORA, ui: { plegado: true } })
  assert.match(uno, /^<button type="button" class="aviso" data-accion="ver">[\s\S]*<span><b>Claude<\/b> te pregunta algo<\/span><span class="ir">Ver →<\/span><\/button>$/)
  assert.doesNotMatch(uno, /data-pregunta|data-globo/)
  const varias = globo(pend(proyecto({ items: [ITEM_PRECIOS, ITEM_FOTOS, ITEM_PRECIOS] })), { ahoraMs: AHORA, ui: { plegado: true } })
  assert.match(varias, /<span>3 preguntas esperan<\/span><span class="ir">Ver →<\/span>/)
})

test('aviso de una pregunta en otro proyecto: quién pregunta, dónde y "Ver →"', () => {
  const proyectos = agruparPorProyecto([
    { sesion: 'a', repo: 'q/oficina', inicio: hace(1), actualizado: hace(0) },
    { sesion: 'b', repo: 'q/catalogo', inicio: hace(1), actualizado: hace(0), preguntas: [{ id: 'p', agente: null, desde: hace(1), items: [ITEM_PRECIOS] }] },
  ])
  const k = proyectos.findIndex(p => p.nombre === 'catalogo')
  const h = avisoOtroProyecto(proyectos, 1 - k)
  assert.match(h, new RegExp(`^<button type="button" class="aviso" data-accion="ir" data-proy="${k}">`))
  assert.match(h, /<span><b>Claude<\/b> te pregunta algo en <b>catalogo<\/b><\/span><span class="ir">Ver →<\/span><\/button>$/)
  assert.equal(avisoOtroProyecto(proyectos, k), '')
})

test('anuncio en vivo: una vez por pregunta nueva, con quién y en qué proyecto', () => {
  const sesiones = [{ sesion: 'b', repo: 'q/catalogo', preguntas: [{ id: 'p1', agente: null, items: [ITEM_PRECIOS] }] }]
  assert.equal(anuncioPregunta([{ id: 'p1', quien: 'Claude' }], sesiones), 'Claude te pregunta algo en catalogo')
  assert.equal(anuncioPregunta([], sesiones), '')
})

test('los Avis de la pregunta: Camila de 38 en teEspera en la cabecera; el hecho festeja con el de 34', () => {
  const agentes = [{ id: 'c9', nombre: 'Camila', estado: 'trabajando', desde: hace(3) }]
  const h = globo(pend(proyecto({ agentes, agente: 'c9' })), { ahoraMs: AHORA })
  assert.match(h, /<div class="preg-cab"><span class="avi" style="--t:28px;[^"]*" aria-hidden="true"><svg[^>]*class="e-teEspera"[\s\S]*?M30 58L33 25L56 39Z[\s\S]*?<\/svg><\/span><span><b>Camila<\/b> te pregunta/)
  const hecho = globo([], { ahoraMs: AHORA, ui: { hecho: { mensaje: 'Listo.', listo: true, color: '#F2B632', pj: 'antena' } } })
  assert.match(hecho, /<span class="avi" style="--t:26px;[^"]*" aria-hidden="true"><svg[^>]*class="e-listo"/)
  const ya = globo([], { ahoraMs: AHORA, ui: { hecho: { mensaje: 'Ya se respondió en Claude.', listo: false, color: '#F2B632', pj: 'antena' } } })
  assert.match(ya, /class="e-esperando"/)
  // Aviso de otra pregunta: Avi de 36 en teEspera
  assert.match(globo(pend(proyecto()), { ahoraMs: AHORA, ui: { plegado: true } }), /<span class="avi" style="--t:28px;[^"]*" aria-hidden="true"><svg[^>]*class="m-avi e-teEspera chica"/)
})
