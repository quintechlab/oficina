// Tests del tablero (estilo Avis, F1 y F3): barra de proyectos, encabezado, cuadros de conteo,
// tarjetas de sesión, fichas de subagente, equipo, vacío y tira. Funciones puras de tablero.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  iniciales, colorProyecto, COLORES_PROYECTO, conteos, lineaEncabezado, subagentesVisibles, textoMas,
  animoMarca, colorEstado, barraProyectos, sesiones, prepararProyecto, estadoMarca,
  MAX_SUBAGENTES_VISIBLES, firmaTablero, figuraMarca, figuraVacio, carasMini, companero,
} from '../src/tablero.js'
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

test('tarjeta de sesión: hasta 4 fichas y "+n"; dormido atenúa solo el Avi, nunca el texto', () => {
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
  // Los Avis de la tarjeta son decorativos (5.6): Claude de 84 coordinando y las fichas de 56
  assert.match(h, /<div class="ses-top"><span class="avi" style="--t:84px;--d:[^"]*" aria-hidden="true"><svg viewBox="0 0 120 120" class="e-coordinando"/)
  assert.equal((h.match(/<li class="sub[^"]*" style="[^"]*"><span class="avi" style="--t:56px;--d:[^"]*" aria-hidden="true">/g) ?? []).length, 4)
  assert.doesNotMatch(h, /role="img"/)
  // Inés terminó hace 3 min: duerme con ojos cerrados y "z"; su texto conserva "listo"
  assert.match(h, /<li class="sub dorm"[^>]*><span class="avi[^>]*><svg[^>]*class="e-durmiendo"[\s\S]*?<b>Inés<\/b>[\s\S]*?<span class="est">listo · hace 3 min<\/span>/)
})

test('el reparto: hasta MAX_SUBAGENTES_VISIBLES (4) con ficha y el resto como "+n"', () => {
  assert.equal(MAX_SUBAGENTES_VISIBLES, 4)
  const lista = n => Array.from({ length: n }, (_, k) => ({ id: String(k), animo: 'escribiendo' }))
  for (const [n, vis, resto] of [[0, 0, 0], [1, 1, 0], [4, 4, 0], [5, 4, 1], [9, 4, 5]]) {
    const r = subagentesVisibles(lista(n))
    assert.equal(r.visibles.length, vis, `${n} subagentes`)
    assert.equal(r.resto, resto)
    assert.equal(r.ocultos.length, resto)
  }
})

test('la firma del tablero cambia con la pose de un subagente y no con el tiempo que pasa', () => {
  const s = { sesion: 'a', repo: 'q/oficina', inicio: hace(42), actualizado: hace(0), agentes: [sub('1', 'Lucas', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const f = firmaTablero(prepararProyecto(p, AHORA))
  assert.equal(firmaTablero(prepararProyecto(p, AHORA + 30000)), f)
  const [q] = agruparPorProyecto([{ ...s, agentes: [sub('1', 'Lucas', 'listo', { hasta: hace(0) })] }])
  assert.notEqual(firmaTablero(prepararProyecto(q, AHORA)), f)
})

test('la marca y el vacío: Avi de Claude solo, con nombre y estado (role="img")', () => {
  assert.match(figuraMarca('coordinando'), /^<span class="avi" style="--t:54px;--d:[^"]*" role="img" aria-label="Claude, coordinando el equipo"><svg viewBox="0 0 120 120" class="e-coordinando"/)
  assert.match(figuraMarca('teEspera'), /aria-label="Claude, esperándote"><svg[^>]*class="e-teEspera"/)
  assert.match(figuraVacio('durmiendo'), /^<span class="avi" style="--t:120px;--d:[^"]*" role="img" aria-label="Claude, durmiendo"><svg[^>]*class="e-durmiendo"/)
  assert.match(figuraVacio('esperando'), /aria-label="Claude, esperando"><svg[^>]*class="e-esperando"/)
})

test('tira mini: cabecitas de 32 decorativas y un nombre para el grupo', () => {
  const h = carasMini([{ nombre: 'Claude', animo: 'teEspera', color: '#F2B632', pj: 'antena' }, { nombre: 'Lucas', animo: 'escribiendo', color: '#8FD694', pj: 'brote' }])
  assert.match(h, /^<span class="cabezas-g" role="img" aria-label="Claude y Lucas">/)
  assert.equal((h.match(/<span class="avi" style="--t:32px;--d:[^"]*" aria-hidden="true">/g) ?? []).length, 2)
  assert.match(h, /class="e-teEspera"[\s\S]*class="e-escribiendo"/)
  assert.equal(carasMini([]), '')
})

test('equipo: la fila del compañero lleva a Claude de 32 y cabecitas de 24 con nombre de grupo', () => {
  const s = { sesion: 'c', repo: 'q/catalogo', rama: 'feat/51-carrito', tarea: 51, inicio: hace(30), actualizado: hace(4), actividad: 'editando carrito.ts', agentes: [sub('1', 'Lucas', 'trabajando')] }
  const c = { usuario: 'NC', nombre: 'Nicolás Campos', actualizado: hace(4), sesiones: [s], principal: s }
  const h = companero(c, AHORA, true)
  assert.match(h, /<div class="fila"><span class="avi" style="--t:32px;[^"]*" aria-hidden="true"><svg[^>]*class="e-coordinando"/)
  assert.match(h, /<span class="cabezas" role="img" aria-label="Lucas"><span class="avi" style="--t:24px;[^"]*" aria-hidden="true"><svg[^>]*class="e-escribiendo"/)
})
