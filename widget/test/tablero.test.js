// Tests del tablero (estilo Avis, F1): barra de proyectos, encabezado, cuadros de conteo,
// tarjetas de sesión y fichas de subagente. Funciones puras de escena.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  iniciales, colorProyecto, COLORES_PROYECTO, conteos, lineaEncabezado, subagentesVisibles, textoMas,
  animoMarca, colorEstado, barraProyectos, sesiones, prepararProyecto, estadoMarca,
} from '../src/escena.js'
import { agruparPorProyecto } from '../src/logica.js'

const AHORA = Date.parse('2026-11-20T12:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const sub = (id, nombre, estado, extra = {}) => ({ id, nombre, tarea: `tarea de ${nombre}`, tipo: 'general-purpose', estado, desde: hace(10), hasta: estado === 'trabajando' ? null : hace(3), ...extra })

test('iniciales: la primera letra de las dos primeras palabras; una sola palabra, una letra', () => {
  assert.equal(iniciales('central-nucleo-main'), 'cn')
  assert.equal(iniciales('oficina'), 'o')
  assert.equal(iniciales('mi_proyecto nuevo'), 'mp')
  assert.equal(iniciales('Nicolás Campos'), 'NC')
  assert.equal(iniciales('fuera de un repositorio'), '·')
})

test('el color del ícono de un proyecto es fijo por nombre y sale de la paleta del tablero', () => {
  assert.deepEqual(COLORES_PROYECTO, ['var(--ambar)', 'var(--celeste)', 'var(--violeta)', 'var(--verde)', 'var(--rosa)'])
  for (const n of ['oficina', 'catalogo', 'central-nucleo-main']) {
    assert.ok(COLORES_PROYECTO.includes(colorProyecto(n)))
    assert.equal(colorProyecto(n), colorProyecto(n))
  }
})

test('cuadros de conteo: trabajando, terminados (con los fallidos) y el tiempo de la sesión más larga', () => {
  const s1 = { sesion: 'a', repo: 'q/oficina', inicio: hace(42), actualizado: hace(0), agentes: [sub('1', 'Delfina', 'trabajando'), sub('2', 'Ramiro', 'trabajando'), sub('3', 'Lucas', 'listo'), sub('4', 'Inés', 'fallo')] }
  const s2 = { sesion: 'b', repo: 'q/oficina', inicio: hace(5), actualizado: hace(0), agentes: [sub('5', 'Camila', 'trabajando')] }
  const [p] = agruparPorProyecto([s1, s2])
  const c = conteos(prepararProyecto(p, AHORA), AHORA)
  assert.equal(c.trabajando, 3)
  assert.equal(c.terminados, 2)
  assert.equal(c.fallidos, 1)
  assert.equal(c.tiempo, '42 min')
  assert.equal(c.rotuloTiempo, 'la más larga')
  const [solo] = agruparPorProyecto([s2])
  assert.equal(conteos(prepararProyecto(solo, AHORA), AHORA).rotuloTiempo, 'lleva la sesión')
})

test('la línea del encabezado cuenta sesiones y subagentes trabajando, o avisa la pregunta', () => {
  const s = { sesion: 'a', repo: 'q/oficina', inicio: hace(42), actualizado: hace(0), agentes: [sub('1', 'Delfina', 'trabajando'), sub('2', 'Ramiro', 'trabajando'), sub('3', 'Lucas', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const prep = prepararProyecto(p, AHORA)
  assert.equal(lineaEncabezado(prep, conteos(prep, AHORA)), '1 sesión · 3 subagentes trabajando')
  const [q] = agruparPorProyecto([{ ...s, agentes: [], preguntas: [{ id: 'x', agente: null, items: [{ pregunta: '¿?' }] }] }, { ...s, sesion: 'b', agentes: [] }])
  const prepQ = prepararProyecto(q, AHORA)
  assert.equal(lineaEncabezado(prepQ, conteos(prepQ, AHORA)), '2 sesiones · te hace una pregunta')
  const [quieto] = agruparPorProyecto([{ ...s, agentes: [] }])
  const prepQuieto = prepararProyecto(quieto, AHORA)
  assert.equal(lineaEncabezado(prepQuieto, conteos(prepQuieto, AHORA)), '1 sesión')
})

test('hasta 4 fichas: primero la pregunta y el trabajo, y en el orden en que se lanzaron', () => {
  const lista = [
    { id: 'a', animo: 'durmiendo' }, { id: 'b', animo: 'escribiendo' }, { id: 'c', animo: 'listo' },
    { id: 'd', animo: 'teEspera' }, { id: 'e', animo: 'leyendo' }, { id: 'f', animo: 'fallo' },
  ]
  const r = subagentesVisibles(lista)
  assert.deepEqual(r.visibles.map(a => a.id), ['b', 'd', 'e', 'f'])
  assert.deepEqual(r.ocultos.map(a => a.id), ['a', 'c'])
  assert.equal(r.resto, 2)
  const pocos = subagentesVisibles(lista.slice(0, 3))
  assert.equal(pocos.resto, 0)
  assert.deepEqual(pocos.ocultos, [])
})

test('"+n" dice quiénes quedan afuera, con su tarea y su estado', () => {
  assert.equal(textoMas([{ nombre: 'Camila', tarea: 'copy del aviso', animo: 'durmiendo', estado: 'listo' }]), '1 subagente más: Camila — copy del aviso (listo)')
  assert.equal(
    textoMas([{ nombre: 'Camila', tarea: 'copy', animo: 'listo', estado: 'listo' }, { nombre: 'Lucas', tarea: 'tests', animo: 'escribiendo', estado: 'trabajando' }]),
    '2 subagentes más: Camila — copy (listo); Lucas — tests (escribiendo)',
  )
})

test('el estado de la marca: pregunta, después coordinando, después esperando; sin sesiones, durmiendo', () => {
  const base = { sesion: 'a', repo: 'q/x', inicio: hace(1), actualizado: hace(0), actividad: 'pensando' }
  assert.equal(animoMarca([], AHORA), 'durmiendo')
  assert.equal(animoMarca(agruparPorProyecto([base]), AHORA), 'esperando')
  assert.equal(animoMarca(agruparPorProyecto([base, { ...base, sesion: 'b', agentes: [sub('1', 'Lucas', 'trabajando')] }]), AHORA), 'coordinando')
  assert.equal(animoMarca(agruparPorProyecto([{ ...base, sesion: 'b', agentes: [sub('1', 'Lucas', 'trabajando')] }, { ...base, repo: 'q/y', preguntas: [{ id: 'p', agente: null, items: [{ pregunta: '¿?' }] }] }]), AHORA), 'teEspera')
  assert.equal(estadoMarca(4), '4 sesiones abiertas')
  assert.equal(estadoMarca(1), '1 sesión abierta')
})

test('el color de la línea de estado sigue la tabla de la dirección', () => {
  for (const a of ['teEspera', 'coordinando', 'editando', 'comando', 'escribiendo']) assert.equal(colorEstado(a), 'var(--ambar)')
  assert.equal(colorEstado('esperando'), 'var(--crema)')
  assert.equal(colorEstado('pensando'), 'var(--crema)')
  assert.equal(colorEstado('leyendo'), 'var(--celeste)')
  assert.equal(colorEstado('inactiva'), 'var(--tenue)')
  assert.equal(colorEstado('listo'), 'var(--verde)')
  assert.equal(colorEstado('fallo'), 'var(--rojo)')
})

test('barra de proyectos: el activo lleva aria-current, la pregunta pasa el chip a "1 ?" con nombre en palabras', () => {
  const s = (repo, extra = {}) => ({ sesion: repo, repo, inicio: hace(1), actualizado: hace(0), ...extra })
  const proyectos = agruparPorProyecto([s('q/oficina'), s('q/catalogo', { preguntas: [{ id: 'p', agente: null, items: [{ pregunta: '¿?' }] }] })])
  const h = barraProyectos(proyectos, proyectos.findIndex(p => p.nombre === 'oficina'))
  assert.match(h, /<button type="button" class="pj activo" aria-current="true" data-accion="ir" data-proy="1" title="q\/oficina">/)
  assert.match(h, /<span class="chip chip-preg" aria-label="1 pregunta pendiente">1 \?<\/span>/)
  assert.match(h, /<span class="chip" aria-label="1 sesión">1<\/span>/)
  assert.equal((h.match(/aria-current/g) ?? []).length, 1)
})

test('tarjeta de sesión: hasta 4 fichas y "+n"; dormido atenúa solo la mascota, nunca el texto', () => {
  const agentes = [sub('1', 'Delfina', 'trabajando'), sub('2', 'Ramiro', 'trabajando', { tipo: 'Explore' }), sub('3', 'Lucas', 'trabajando'), sub('4', 'Inés', 'listo', { hasta: hace(3) }), sub('5', 'Camila', 'listo', { hasta: hace(4), tarea: 'copy del aviso' })]
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'feat/12-estilo-avis', tarea: 12, inicio: hace(42), actualizado: hace(0), agentes }
  const [p] = agruparPorProyecto([s])
  const h = sesiones(prepararProyecto(p, AHORA), AHORA)
  assert.equal((h.match(/<li class="sub/g) ?? []).length, 4)
  assert.match(h, /<li class="mas" title="1 subagente más: Camila — copy del aviso \(listo\)" aria-label="1 subagente más: Camila — copy del aviso \(listo\)">\+1<\/li>/)
  assert.match(h, /<span class="tag">#12<\/span>/)
  assert.match(h, /ahora · coordinando el equipo/)
  assert.match(h, /<li class="sub dorm"/)
  // La ficha dormida no lleva opacidad propia: estilos.css atenúa solo su .avi
  assert.doesNotMatch(h, /<li[^>]*opacity/)
  assert.doesNotMatch(h, /<(b|small|span class="est")[^>]*opacity/)
})
