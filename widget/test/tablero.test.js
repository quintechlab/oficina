// Tests del tablero (estilo Avis, F1 y F3; panel "Escenario + chips", panel-avis-ux.md): tira de
// proyectos, encabezado, chips de conteo, tarjetas escenario con su elenco, equipo, vacío y tira.
// Funciones puras de tablero.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  iniciales, colorProyecto, COLORES_PROYECTO, conteos, lineaEncabezado, subagentesVisibles, textoMas,
  animoMarca, colorEstado, tiraRepos, encabezadoSesiones, sesiones, prepararProyecto, estadoMarca, animoTexto,
  MAX_SUBAGENTES_VISIBLES, firmaTablero, figuraMarca, figuraVacio, carasMini, companero, cifraConUnidades, chips, tiempoCorto,
  ESCENA, geometriaEscena, trazoHilo, estadoCorto, tiempoMini, ESTADO_CORTO, firmaEscenas,
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

test('conteos: trabajando, terminados (con los fallidos) y el tiempo de la sesión más larga', () => {
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

// ------------------------------------------------------------------ tira de repos (modulos-ux.md 4.4, #42 M2)

const sr = (repo, extra = {}) => ({ sesion: `${repo}-${extra.k ?? 0}`, repo, inicio: hace(1), actualizado: hace(0), ...extra })
const conPregunta = { preguntas: [{ id: 'p', agente: null, items: [{ pregunta: '¿?' }] }] }

test('tira de repos: el elegido lleva aria-current="true" y «, elegido» en su nombre; uno solo', () => {
  const proyectos = agruparPorProyecto([sr('q/oficina'), sr('q/oficina', { k: 1 }), sr('q/catalogo', conPregunta)])
  const k = proyectos.findIndex(p => p.nombre === 'oficina')
  const h = tiraRepos(proyectos, k)
  assert.match(h, new RegExp(`<button type="button" class="rch" aria-current="true" data-accion="ir" data-proy="${k}" data-repo="q/oficina" title="q/oficina" aria-label="oficina, 2 sesiones, elegido">`))
  assert.equal((h.match(/aria-current/g) ?? []).length, 1)
  assert.equal((h.match(/, elegido"/g) ?? []).length, 1)
  // Los mismos data-accion="ir" y data-proy de la barra de antes: el manejador de main.js no cambia (11.1)
  assert.equal((h.match(/data-accion="ir" data-proy="\d+"/g) ?? []).length, 2)
})

test('tira de repos: cada chip lleva el ícono del proyecto, el nombre y la cuenta; con pregunta, «1 ?» en lugar de las sesiones; con una sola sesión, sin número (tira-repos-ux.md 5.1)', () => {
  const proyectos = agruparPorProyecto([sr('q/oficina'), sr('q/catalogo', conPregunta)])
  const k = proyectos.findIndex(p => p.nombre === 'catalogo')
  const h = tiraRepos(proyectos, -1)
  assert.match(h, new RegExp(`data-proy="${k}" data-repo="q/catalogo" title="q/catalogo" aria-label="catalogo, 1 pregunta pendiente"><span class="pj-ic" style="--c:${colorProyecto('catalogo').replace(/[()]/g, '\\$&')}" aria-hidden="true">c</span><span class="rch-n">catalogo</span><span class="chip chip-preg" aria-hidden="true">1 \\?</span></button>`))
  assert.match(h, /aria-label="oficina, 1 sesión"><span class="pj-ic"[^>]*>o<\/span><span class="rch-n">oficina<\/span><\/button>/)
  // Sin proyecto elegido (no pasa en Sesiones, pero no rompe): ningún aria-current
  assert.doesNotMatch(h, /aria-current/)
})

test('tira de repos: nombres y repositorios escapados', () => {
  const [p] = agruparPorProyecto([sr('q/<x>&"y"')])
  const h = tiraRepos([{ ...p, nombre: '<x>&"y"' }], 0)
  assert.doesNotMatch(h, /<x>/)
  assert.match(h, /title="q\/&lt;x&gt;&amp;&quot;y&quot;"/)
  assert.match(h, /aria-label="&lt;x&gt;&amp;&quot;y&quot;, 1 sesión, elegido"/)
  assert.match(h, /<span class="rch-n">&lt;x&gt;&amp;&quot;y&quot;<\/span>/)
})

test('tira de repos: sin proyectos, nada', () => {
  assert.equal(tiraRepos([], 0), '')
})

test('encabezado de Sesiones (M2, 5): h1 «Sesiones», title el repositorio y la bajada «{proyecto} · {lineaEncabezado}»', () => {
  const [p] = agruparPorProyecto([sr('q/catalogo', conPregunta)])
  const preparadas = prepararProyecto(p, AHORA)
  const c = conteos(preparadas, AHORA)
  assert.deepEqual(encabezadoSesiones(p, preparadas, c), { titulo: 'Sesiones', title: 'q/catalogo', subtitulo: 'catalogo · 1 sesión · te hace una pregunta' })
  const [q] = agruparPorProyecto([sr('q/oficina'), sr('q/oficina', { k: 1 })])
  const pq = prepararProyecto(q, AHORA)
  assert.deepEqual(encabezadoSesiones(q, pq, conteos(pq, AHORA)), { titulo: 'Sesiones', title: 'q/oficina', subtitulo: 'oficina · 2 sesiones' })
  // La bajada sigue siendo la línea de siempre después del nombre
  assert.equal(encabezadoSesiones(q, pq, conteos(pq, AHORA)).subtitulo, `oficina · ${lineaEncabezado(pq, conteos(pq, AHORA))}`)
})

/** Las tarjetas escenario de una sola sesión con estos subagentes. */
const escenario = (agentes, extra = {}) => {
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'feat/14-panel', tarea: 14, inicio: hace(42), actualizado: hace(0), agentes, ...extra }
  const [p] = agruparPorProyecto([s])
  return sesiones(prepararProyecto(p, AHORA), AHORA)
}
const cuenta = (h, re) => (h.match(re) ?? []).length

test('escenario con 2 subagentes: Claude de 96 en el piso, el elenco de 58 y el rótulo de 3 líneas', () => {
  const h = escenario([sub('1', 'Delfina', 'trabajando', { desde: hace(5) }), sub('2', 'Mateo', 'listo', { hasta: hace(8) })])
  assert.match(h, /<span class="tag">#14<\/span>/)
  assert.match(h, /ahora · coordinando el equipo/)
  assert.match(h, /<div class="esc"/)
  assert.match(h, /<div class="piso" aria-hidden="true"><\/div>/)
  // Los Avis del escenario son decorativos: Claude de 96 coordinando y dos de 58
  assert.equal(cuenta(h, /<span class="avi" style="--t:96px;[^"]*" aria-hidden="true"><svg viewBox="0 0 120 120" class="m-avi e-coordinando"/g), 1)
  assert.equal(cuenta(h, /<span class="avi" style="--t:58px;[^"]*" aria-hidden="true">/g), 2)
  assert.doesNotMatch(h, /role="img"/)
  assert.match(h, /<ul class="elenco" aria-label="Subagentes">/)
  assert.equal(cuenta(h, /<li class="sub/g), 2)
  assert.doesNotMatch(h, /<li class="mas/)
  // Rótulo: nombre, tarea entera en el DOM, estado corto visible y el completo para lectores
  assert.match(h, /<b>Delfina<\/b><span class="tarea">tarea de Delfina<\/span><em aria-hidden="true" data-vivo>escribe 5m<\/em><span class="oculto" data-vivo>escribiendo · 5 min<\/span>/)
  assert.match(h, /title="Delfina — tarea de Delfina \(escribiendo · 5 min\)"/)
  // Mateo terminó hace 8 min: duerme, atenuado solo el Avi (clase), y su texto conserva "listo"
  assert.match(h, /<li class="sub dorm"[^>]*title="Mateo — tarea de Mateo \(listo · hace 8 min\)"[\s\S]*?class="e-durmiendo"[\s\S]*?<em aria-hidden="true" data-vivo>listo 8m<\/em><span class="oculto" data-vivo>listo · hace 8 min<\/span>/)
  assert.doesNotMatch(h, /<li[^>]*opacity/)
  // Ranuras de 112: el Avi de Delfina centrado en la primera (x 110 + 27)
  assert.match(h, /<li class="sub" style="left:110px;width:112px;/)
  assert.match(h, /<span class="fig" style="left:27px">/)
})

test('escenario con 5 o más: 3 Avis por orden de lanzamiento y la pila "+n" solo informativa', () => {
  const h = escenario([
    sub('1', 'Bruno', 'listo', { hasta: hace(4) }), sub('2', 'Delfina', 'trabajando'), sub('3', 'Tomás', 'listo', { hasta: hace(9) }),
    sub('4', 'Mateo', 'trabajando', { tipo: 'Explore' }), sub('5', 'Lía', 'trabajando'),
  ])
  assert.equal(cuenta(h, /<li class="sub/g), 3)
  // Los que trabajan quedan afuera de la pila, en el orden en que se lanzaron
  assert.deepEqual([...h.matchAll(/<li class="sub[^>]*><button[^>]*><span class="fig"[^>]*>[\s\S]*?<b>([^<]+)<\/b>/g)].map(m => m[1]), ['Delfina', 'Mateo', 'Lía'])
  // Cada uno de los 3 es un botón que despliega su detalle (#14)
  assert.equal(cuenta(h, /<button type="button" class="sub-boton"/g), 3)
  const mas = '2 subagentes más: Bruno — tarea de Bruno (listo); Tomás — tarea de Tomás (listo)'
  // No es un control: sin botón, sin tabindex; el texto completo en title y oculto para lectores
  assert.match(h, new RegExp(`<li class="mas" style="left:332px;width:74px;--j:3" title="${mas.replace(/[()]/g, '\\$&')}">`))
  assert.match(h, /<li class="mas"[\s\S]*?<span class="rotulo" aria-hidden="true"><b>\+2<\/b><span>terminados<\/span><\/span><span class="oculto">2 subagentes más: [^<]*<\/span><\/li>/)
  assert.doesNotMatch(h.slice(h.indexOf('<li class="mas"')), /<button|tabindex/)
  // Las cabecitas de la pila: Avis de 36 durmiendo
  assert.equal(cuenta(h, /<span class="avi" style="--t:36px;[^"]*" aria-hidden="true"><svg viewBox="0 0 120 120" class="e-durmiendo"/g), 2)
})

test('la pila dice "más" si alguno de los de la pila trabaja, y le llega un hilo', () => {
  const h = escenario(['Delfina', 'Mateo', 'Lía', 'Bruno', 'Tomás'].map((n, k) => sub(String(k), n, 'trabajando')))
  assert.match(h, /<b>\+2<\/b><span>más<\/span>/)
  assert.equal(cuenta(h, /<path d="M50 26 /g), 4)
})

test('los hilos van de la antena solo hacia los subagentes que trabajan', () => {
  const h = escenario([sub('1', 'Delfina', 'trabajando'), sub('2', 'Mateo', 'listo', { hasta: hace(8) }), sub('3', 'Lía', 'fallo', { hasta: hace(1) })])
  assert.equal(cuenta(h, /<path d="M50 26 /g), 1)
  assert.equal(cuenta(h, /<i class="hilo-pt"/g), 1)
  // Ranuras de 99 con 3: Delfina en x 110, su coronilla en (110 + 20,5 + 29, 63)
  assert.match(h, /<svg class="hilos" aria-hidden="true"><path d="M50 26 Q104.75 2 159.5 63" data-id="1"\/><\/svg>/)
  assert.match(h, /<i class="hilo-pt" style="offset-path:path\('M50 26 Q104.75 2 159.5 63'\);--k:0" data-id="1" aria-hidden="true"><\/i>/)
  // El que te pregunta conserva su hilo (sigue "trabajando"); sin nadie trabajando, no hay hilos
  const p = escenario([sub('1', 'Delfina', 'trabajando')], { preguntas: [{ id: 'q', agente: '1', items: [{ pregunta: '¿?' }] }] })
  assert.match(p, /class="e-teEspera"[\s\S]*pregunta /)
  assert.equal(cuenta(p, /<path d="M50 26 /g), 1)
  const quietos = escenario([sub('1', 'Delfina', 'listo', { hasta: hace(8) })])
  assert.doesNotMatch(quietos, /class="hilos"|hilo-pt/)
})

test('sin subagentes: escenario más bajo con "sin subagentes"', () => {
  const h = escenario([])
  assert.match(h, /<div class="esc solo">/)
  assert.match(h, /<p class="esc-nada">sin subagentes<\/p>/)
  assert.doesNotMatch(h, /<ul class="elenco"|class="hilos"/)
  assert.equal(cuenta(h, /<span class="avi" style="--t:96px;/g), 1)
})

test('el tipo de un nombre inventado solo va en el title y para lectores, nunca visible', () => {
  const h = escenario([sub('1', 'Pixel', 'trabajando', { inventado: true, tipo: 'Explore', desde: hace(2) }), sub('2', 'Mateo', 'trabajando', { tipo: 'Explore' })])
  assert.match(h, /title="Pixel \(Explore\) — tarea de Pixel \(leyendo · 2 min\)"/)
  assert.match(h, /<b>Pixel<span class="oculto"> \(Explore\)<\/span><\/b>/)
  // Sin inventar el nombre, el tipo no aparece
  assert.match(h, /title="Mateo — tarea de Mateo/)
  assert.doesNotMatch(h, /<b>Mateo<span/)
})

test('la tarjeta escenario: la rama en una línea con title y el tiempo vivo, que se reescribe en su lugar', () => {
  const h = escenario([])
  assert.match(h, /<div class="ses-cab"><h3 class="ses-tit"><span class="tag">#14<\/span><b title="feat\/14-panel">feat\/14-panel<\/b><\/h3><span class="lleva"><span class="oculto">lleva <\/span><span data-vivo>42 min<\/span><\/span><button type="button" class="ses-hizo" data-accion="historial" data-sesion="a" aria-label="Qué hizo en feat\/14-panel" aria-expanded="false">Qué hizo<\/button><\/div>/)
  assert.match(h, /<span class="pt" aria-hidden="true"><\/span><span data-vivo>ahora · /)
})

test('geometría del escenario: Claude, el foco de la antena, las ranuras y la pila (5.2)', () => {
  assert.deepEqual(ESCENA, { ancho: 408, piso: 98, claude: { t: 96, x: 2 }, x0: 110, zona: 298, ranuraMax: 112, sub: 58, pila: 36 })
  const g0 = geometriaEscena(0)
  assert.deepEqual(g0.claude, { t: 96, x: 2, y: 15 })
  assert.deepEqual(g0.foco, { x: 50, y: 26 })
  assert.deepEqual(g0.ranuras, [])
  assert.equal(g0.pila, null)
  for (const [k, ancho] of [[1, 112], [2, 112], [3, 99], [4, 74]]) {
    const g = geometriaEscena(k)
    assert.equal(g.ranuras.length, k)
    g.ranuras.forEach((r, j) => {
      assert.equal(r.x, 110 + j * ancho)
      assert.equal(r.ancho, ancho)
      assert.deepEqual(r.avi, { x: r.x + (ancho - 58) / 2, y: 48 })
      assert.deepEqual(r.destino, { x: r.avi.x + 29, y: 63 })
    })
  }
  // 5 o más: 3 ranuras y la pila en la cuarta, con hasta 3 cabecitas de 36
  const g = geometriaEscena(4, { pila: 2 })
  assert.equal(g.ranuras.length, 3)
  assert.deepEqual(g.pila, { x: 332, y: 52, ancho: 74, alto: 52, cabezas: [{ x: 4, y: 2 }, { x: 28, y: 8 }], destino: { x: 369, y: 63 } })
  assert.deepEqual(geometriaEscena(4, { pila: 6 }).pila.cabezas, [{ x: 4, y: 2 }, { x: 19, y: 8 }, { x: 34, y: 2 }])
})

test('el trazo del hilo: curva cuadrática con el control 24 px arriba del más alto', () => {
  assert.equal(trazoHilo({ x: 50, y: 26 }, { x: 166, y: 63 }), 'M50 26 Q108 2 166 63')
})

test('estado corto del rótulo: verbo corto y tiempo mínimo', () => {
  const a = (estado, animo, extra = {}) => ({ ...sub('1', 'X', estado, extra), animo })
  assert.equal(estadoCorto(a('trabajando', 'escribiendo', { desde: hace(5) }), AHORA), 'escribe 5m')
  assert.equal(estadoCorto(a('trabajando', 'comando', { desde: hace(5) }), AHORA), 'escribe 5m')
  assert.equal(estadoCorto(a('trabajando', 'leyendo', { desde: hace(1) }), AHORA), 'lee 1m')
  assert.equal(estadoCorto(a('trabajando', 'teEspera', { desde: hace(0) }), AHORA), 'pregunta <1m')
  assert.equal(estadoCorto(a('listo', 'listo', { hasta: hace(0) }), AHORA), 'listo <1m')
  assert.equal(estadoCorto(a('listo', 'durmiendo', { hasta: hace(8) }), AHORA), 'listo 8m')
  assert.equal(estadoCorto(a('fallo', 'durmiendo', { hasta: hace(125) }), AHORA), 'falló 2h5m')
  assert.equal(ESTADO_CORTO.esperando, 'espera')
  assert.equal(ESTADO_CORTO.inactiva, 'inactiva')
})

test('tiempo mínimo: de tiempoSubagente a "5m", "2h5m", "2h" o "<1m"', () => {
  assert.equal(tiempoMini('menos de 1 min'), '<1m')
  assert.equal(tiempoMini('5 min'), '5m')
  assert.equal(tiempoMini('hace 8 min'), '8m')
  assert.equal(tiempoMini('2 h 5 min'), '2h5m')
  assert.equal(tiempoMini('2 h'), '2h')
  assert.equal(tiempoMini('hace 12 h 59 min'), '12h59m')
})

test('la firma de las escenas no lleva el minuto: el tiempo que pasa no redibuja', () => {
  const s = { sesion: 'a', repo: 'q/oficina', inicio: hace(42), actualizado: hace(0), agentes: [sub('1', 'Lucas', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const f = firmaEscenas(p.repo, prepararProyecto(p, AHORA))
  assert.equal(f, `q/oficina/${firmaTablero(prepararProyecto(p, AHORA))}`)
  assert.equal(firmaEscenas(p.repo, prepararProyecto(p, AHORA + 3 * 60000)), f)
  assert.notEqual(firmaEscenas('q/otro', prepararProyecto(p, AHORA)), f)
})

test('subagentesVisibles con { conMas: 3 }: hasta 4 van todos; con 5 o más, 3 y "+n"', () => {
  const lista = n => Array.from({ length: n }, (_, k) => ({ id: String(k), animo: 'escribiendo' }))
  for (const [n, vis, resto] of [[0, 0, 0], [3, 3, 0], [4, 4, 0], [5, 3, 2], [9, 3, 6]]) {
    const r = subagentesVisibles(lista(n), { conMas: 3 })
    assert.equal(r.visibles.length, vis, `${n} subagentes`)
    assert.equal(r.resto, resto)
  }
})

test('el pie del equipo no cambia: 4 cabecitas y "+n" con 5 subagentes', () => {
  const agentes = ['Delfina', 'Mateo', 'Lía', 'Bruno', 'Tomás'].map((n, k) => sub(String(k), n, 'trabajando'))
  const s = { sesion: 'c', repo: 'q/catalogo', rama: 'main', inicio: hace(30), actualizado: hace(4), agentes }
  const h = companero({ usuario: 'NC', nombre: 'Nicolás Campos', actualizado: hace(4), sesiones: [s], principal: s }, AHORA, true)
  assert.equal(cuenta(h, /<span class="avi" style="--t:20px;/g), 4)
  assert.match(h, /aria-label="Delfina, Mateo, Lía y Bruno, y 1 más"/)
  assert.match(h, /<span class="mas-c" title="1 subagente más: Tomás — tarea de Tomás \(escribiendo\)">\+1<\/span>/)
})

test('chips de conteo: trabajando, terminados con "· N con error" y el tiempo, con el nombre accesible de siempre', () => {
  const h = chips({ trabajando: 3, terminados: 2, fallidos: 1, tiempo: '18 h 43 min', rotuloTiempo: 'lleva la sesión' })
  assert.equal(cuenta(h, /<div class="conteo" role="group" aria-label="[^"]+">/g), 3)
  assert.match(h, /aria-label="3 subagentes trabajando"><i class="conteo-pt" style="--c:var\(--ambar\)" aria-hidden="true"><\/i><b aria-hidden="true">3<\/b><span aria-hidden="true">trabajando<\/span><\/div>/)
  assert.match(h, /aria-label="2 subagentes terminados, 1 con error"><i class="conteo-pt" style="--c:var\(--verde\)" aria-hidden="true"><\/i><b aria-hidden="true">2<\/b><span aria-hidden="true">terminados<\/span><span class="conteo-err" aria-hidden="true">· <b>1<\/b> con error<\/span><\/div>/)
  assert.match(h, /aria-label="La sesión lleva 18 h 43 min"><svg class="reloj"[^>]*aria-hidden="true">[\s\S]*?<\/svg><b aria-hidden="true">18 <span class="u">h<\/span> 43 <span class="u">m<\/span><\/b><span aria-hidden="true">lleva<\/span><\/div>/)
  // Singular, sin error y con varias sesiones
  const uno = chips({ trabajando: 1, terminados: 1, fallidos: 0, tiempo: '—', rotuloTiempo: 'la más larga' })
  assert.match(uno, /aria-label="1 subagente trabajando"/)
  assert.match(uno, /aria-label="1 subagente terminado"[^>]*>[\s\S]*?<span aria-hidden="true">terminado<\/span><\/div>/)
  assert.doesNotMatch(uno, /conteo-err/)
  assert.match(uno, /aria-label="La sesión más larga lleva —">[\s\S]*?<b aria-hidden="true">—<\/b><span aria-hidden="true">la más larga<\/span>/)
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
  // La marca "Escenario" (marca-avi-ux.md 3): el Avi de Claude de 112, con las capas del escenario
  assert.match(figuraMarca('coordinando'), /^<span class="avi" style="--t:112px;--d:[^"]*" role="img" aria-label="Claude, coordinando el equipo"><svg viewBox="0 0 120 120" class="m-avi e-coordinando es-marca"/)
  assert.match(figuraMarca('teEspera'), /aria-label="Claude, esperándote"><svg[^>]*class="m-avi e-teEspera es-marca"/)
  assert.match(figuraMarca('esperando'), /aria-label="Claude, esperando">/)
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
  assert.match(h, /<div class="fila"><span class="avi" style="--t:26px;[^"]*" aria-hidden="true"><svg[^>]*class="m-avi e-coordinando chica"/)
  assert.match(h, /<span class="cabezas" role="img" aria-label="Lucas"><span class="avi" style="--t:20px;[^"]*" aria-hidden="true"><svg[^>]*class="e-escribiendo"/)
})

test('una sesión que espera procesos: línea celeste, anillo, y los procesos en el título', () => {
  const procesos = [{ id: 'b1', descripcion: 'Arma el instalador', desde: hace(2) }]
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'feat/10-x', tarea: 10, inicio: hace(5), actualizado: hace(0), actividad: 'esperando 1 proceso', procesos }
  assert.equal(colorEstado('proceso'), 'var(--celeste)')
  const [p] = agruparPorProyecto([s])
  const h = sesiones(prepararProyecto(p, AHORA), AHORA)
  assert.match(h, /<svg[^>]*class="m-avi e-proceso"/)
  assert.match(h, /<p class="linea" style="--c:var\(--celeste\)" title="Arma el instalador · hace 2 min">.*ahora · esperando 1 proceso<\/span><\/p>/)
  // Un proceso más (o uno menos) cambia la firma: la tarjeta se redibuja enseguida, no al minuto
  const otra = agruparPorProyecto([{ ...s, procesos: [...procesos, { id: 'b2', descripcion: 'npm run dev', desde: hace(1) }] }])[0]
  assert.notEqual(firmaTablero(prepararProyecto(p, AHORA)), firmaTablero(prepararProyecto(otra, AHORA)))
  // Sin procesos, el título sigue siendo la actividad
  const quieta = agruparPorProyecto([{ ...s, actividad: 'editando main.js', procesos: [] }])[0]
  assert.match(sesiones(prepararProyecto(quieta, AHORA), AHORA), /title="editando main.js"/)
})

test('la cifra del tiempo lleva las unidades más chicas para no desbordar el chip', () => {
  assert.equal(cifraConUnidades('11 h 37 min'), '11 <span class="u">h</span> 37 <span class="u">min</span>')
  assert.equal(cifraConUnidades('3'), '3')
  assert.equal(cifraConUnidades('—'), '—')
  // Escapa antes de marcar: nada del dato se vuelve HTML
  assert.equal(cifraConUnidades('<b>'), '&lt;<span class="u">b</span>&gt;')
  const html = chips({ trabajando: 0, terminados: 0, fallidos: 0, tiempo: '11 h 37 min', rotuloTiempo: 'lleva la sesión' })
  assert.match(html, /<b aria-hidden="true">11 <span class="u">h<\/span> 37 <span class="u">m<\/span><\/b>/)
  // El nombre accesible sigue diciendo el tiempo entero
  assert.match(html, /aria-label="La sesión lleva 11 h 37 min"/)
})

test('con horas, el chip acorta los minutos a "m"; sin horas queda igual', () => {
  assert.equal(tiempoCorto('18 h 43 min'), '18 h 43 m')
  assert.equal(tiempoCorto('42 min'), '42 min')
  assert.equal(tiempoCorto('3 h'), '3 h')
  assert.equal(tiempoCorto('menos de 1 min'), 'menos de 1 min')
  const html = chips({ trabajando: 1, terminados: 1, fallidos: 0, tiempo: '18 h 43 min', rotuloTiempo: 'lleva la sesión' })
  assert.match(html, /18 <span class="u">h<\/span> 43 <span class="u">m<\/span>/)
  assert.match(html, /aria-label="La sesión lleva 18 h 43 min"/)
})

// ------------------------------------------------------------------ pantalla dividida (dividida-ux.md 5.10 y 6)

test('subagentesVisibles con { max: 2, conMas: 1 } (la mitad de la dividida): hasta 2 van todos; con 3 o más, el de mayor prioridad', () => {
  const lista = [{ id: 'a', animo: 'listo' }, { id: 'b', animo: 'teEspera' }, { id: 'c', animo: 'escribiendo' }]
  assert.deepEqual(subagentesVisibles(lista.slice(0, 2), { max: 2, conMas: 1 }).visibles.map(a => a.id), ['a', 'b'])
  const r = subagentesVisibles(lista, { max: 2, conMas: 1 })
  assert.deepEqual(r.visibles.map(a => a.id), ['b'])
  assert.deepEqual(r.ocultos.map(a => a.id), ['a', 'c'])
  assert.equal(r.resto, 2)
})

test('sin max, subagentesVisibles reparte como siempre (hasta 4 con ficha)', () => {
  const lista = n => Array.from({ length: n }, (_, k) => ({ id: String(k), animo: 'escribiendo' }))
  assert.equal(subagentesVisibles(lista(4)).visibles.length, 4)
  assert.equal(subagentesVisibles(lista(5)).visibles.length, 4)
  assert.deepEqual(subagentesVisibles(lista(5)), subagentesVisibles(lista(5), { max: MAX_SUBAGENTES_VISIBLES }))
})

test('la tarjeta con rastro activo: "⇄ conversa con …" debajo de la línea, todo celeste, con title y tiempo vivo', () => {
  const s = { sesion: 'a', repo: 'q/tienda-web', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: [] }
  const [p] = agruparPorProyecto([s])
  const prep = prepararProyecto(p, AHORA)
  const h = sesiones(prep, AHORA, new Map([['a', { clave: 'k', texto: 'conversa con api-pagos · 6 min', fin: false }]]))
  assert.match(h, /<\/p><p class="rastro" title="⇄ conversa con api-pagos · 6 min"><span class="rastro-m" aria-hidden="true">⇄<\/span> <span data-vivo>conversa con api-pagos · 6 min<\/span><\/p><div class="esc/)
  const fin = sesiones(prep, AHORA, new Map([['a', { clave: 'k', texto: 'habló con api-pagos · 8 min · terminó hace 1 min', fin: true }]]))
  assert.match(fin, /<p class="rastro fin" title="⇄ habló con api-pagos · 8 min · terminó hace 1 min">/)
})

test('sin rastros, las tarjetas y su firma quedan como siempre', () => {
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: [sub('1', 'Lucas', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const prep = prepararProyecto(p, AHORA)
  assert.equal(sesiones(prep, AHORA, new Map()), sesiones(prep, AHORA))
  assert.doesNotMatch(sesiones(prep, AHORA), /rastro/)
  assert.equal(firmaEscenas(p.repo, prep, new Map()), firmaEscenas(p.repo, prep))
  assert.equal(firmaEscenas(p.repo, prep), `q/oficina/${firmaTablero(prep)}`)
})

test('la firma de las escenas cambia si aparece o termina un rastro, no con el tiempo que dice', () => {
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: [] }
  const [p] = agruparPorProyecto([s])
  const prep = prepararProyecto(p, AHORA)
  const activo = t => new Map([['a', { clave: 'k', texto: `conversa con api-pagos · ${t}`, fin: false }]])
  assert.notEqual(firmaEscenas(p.repo, prep, activo('6 min')), firmaEscenas(p.repo, prep))
  assert.equal(firmaEscenas(p.repo, prep, activo('6 min')), firmaEscenas(p.repo, prep, activo('7 min')))
  assert.notEqual(firmaEscenas(p.repo, prep, new Map([['a', { clave: 'k', texto: 'x', fin: true }]])), firmaEscenas(p.repo, prep, activo('6 min')))
})

// ------------------------------------------------------------------ detalle del subagente (#14)

const conPasos = (id, nombre, estado) => sub(id, nombre, estado, {
  actividad: estado === 'trabajando' ? 'editando tablero.js' : null,
  pasos: [{ texto: 'leyendo main.js', cuando: hace(6) }, { texto: 'editando tablero.js', cuando: hace(1) }],
})

test('cada Avi del escenario es un botón que despliega su detalle, cerrado por defecto', () => {
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: [conPasos('1', 'Camila', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const h = sesiones(prepararProyecto(p, AHORA), AHORA)
  assert.match(h, /<button type="button" class="sub-boton" data-accion="sub" data-sesion="a" data-id="1" aria-expanded="false">/)
  assert.doesNotMatch(h, /det-sub/)
})

test('con un subagente abierto, la tarjeta suma su detalle debajo del escenario: tarea, ahora y los pasos del más nuevo al más viejo', () => {
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: [conPasos('1', 'Camila', 'trabajando'), sub('2', 'Lucas', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const h = sesiones(prepararProyecto(p, AHORA), AHORA, new Map(), { sesion: 'a', id: '1' })
  assert.match(h, /data-id="1" aria-expanded="true" aria-controls="det-a-1">/)
  assert.match(h, /data-id="2" aria-expanded="false">/)
  assert.match(h, /<\/div><div class="det-sub" id="det-a-1" role="region" aria-label="Qué hace Camila"/)
  assert.match(h, /<p class="det-tarea">tarea de Camila<\/p>/)
  assert.match(h, /<p class="det-ahora"><span class="det-rot">ahora<\/span> <span>editando tablero.js<\/span><\/p>/)
  assert.match(h, /<li><span>editando tablero.js<\/span><time data-vivo>hace 1 min<\/time><\/li><li><span>leyendo main.js<\/span><time data-vivo>hace 6 min<\/time><\/li>/)
  // Otra sesión no despliega nada
  assert.doesNotMatch(sesiones(prepararProyecto(p, AHORA), AHORA, new Map(), { sesion: 'b', id: '1' }), /det-sub/)
})

test('el detalle de un subagente sin pasos lo explica, y uno que ya no está no despliega nada', () => {
  const s = { sesion: 'a', repo: 'q/oficina', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: [sub('1', 'Lucas', 'trabajando')] }
  const [p] = agruparPorProyecto([s])
  const prep = prepararProyecto(p, AHORA)
  assert.match(sesiones(prep, AHORA, new Map(), { sesion: 'a', id: '1' }), /<p class="det-vacio">el mod de esta sesión no manda los pasos: actualizalo<\/p>/)
  assert.doesNotMatch(sesiones(prep, AHORA, new Map(), { sesion: 'a', id: '9' }), /det-sub/)
})

test('la firma de las escenas cambia al abrir un detalle o sumar un paso, no con el tiempo de los pasos', () => {
  const agentes = [conPasos('1', 'Camila', 'trabajando')]
  const firma = (ag, abierto) => {
    const [p] = agruparPorProyecto([{ sesion: 'a', repo: 'q/oficina', rama: 'main', inicio: hace(42), actualizado: hace(0), agentes: ag }])
    return firmaEscenas(p.repo, prepararProyecto(p, AHORA), new Map(), abierto)
  }
  const abierto = { sesion: 'a', id: '1' }
  assert.equal(firma(agentes, null), firma(agentes))
  assert.notEqual(firma(agentes, abierto), firma(agentes))
  const otroPaso = [{ ...agentes[0], pasos: [...agentes[0].pasos, { texto: 'corriendo npm test', cuando: hace(0) }] }]
  assert.notEqual(firma(otroPaso, abierto), firma(agentes, abierto))
  const masTarde = [{ ...agentes[0], pasos: agentes[0].pasos.map(p => ({ ...p, cuando: hace(0) })) }]
  assert.equal(firma(masTarde, abierto), firma(agentes, abierto))
})

test('el ánimo real describe al Avi-botón ("Claude, esperando"); pasó del resumen a tablero.js', () => {
  assert.equal(animoTexto('esperando'), 'Claude, esperando')
  assert.equal(animoTexto('coordinando'), 'Claude, coordinando el equipo')
  assert.equal(animoTexto('teEspera'), 'Claude, esperándote')
})
