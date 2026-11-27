// Tests de la tira de repos con muchos proyectos (docs/diseno/tira-repos-ux.md, opción A «Dos renglones»):
// el nombre corto, el grupo y el orden por urgencia, el orden congelado, el reparto en dos renglones con el
// «+n», las teclas de la tira y de la lista, el vecino de ← → fuera de la tira, el HTML de los chips y de la
// lista, y, leyendo main.js, index.html y estilos.css como texto, el cableado (12).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  nombreCorto, grupoRepo, ordenTira, repartirTira, renglonesTira, pasoTira, pasoLista, repoVecino,
  ESPERA_REORDEN_MS, ANCHO_MAS, SEPARACION_TIRA, FILAS_TIRA, GRUPOS_TIRA,
} from '../src/modulos.js'
import { tiraRepos, listaRepos, contenidoMas, colorProyecto } from '../src/tablero.js'
import { agruparPorProyecto } from '../src/logica.js'

const AHORA = Date.parse('2026-11-27T15:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
/** Una sesión que espera tu mensaje (el mod v0.12, con su último turno hace 2 min). */
const sr = (repo, extra = {}) => ({ sesion: `${repo}-${extra.k ?? 0}`, repo, inicio: hace(30), actualizado: hace(0), actividad: 'esperándote', ultimoTurno: hace(2), agentes: [], ...extra })
const conPregunta = { preguntas: [{ id: 'p', agente: null, desde: hace(1), items: [{ pregunta: '¿?' }] }] }
const trabajando = { actividad: 'editando tablero.js', enTurno: true }
const dormidaS = { ultimoTurno: hace(125) }

// ------------------------------------------------------------------ 4.1 nombre corto

test('nombreCorto: un nombre generado x-AAAA-MM-DD-hash queda en base y sufijo; los demás, iguales', () => {
  assert.deepEqual(nombreCorto('scratch-2026-11-27-d5bfc1'), { base: 'scratch', sufijo: 'd5bfc1' })
  assert.deepEqual(nombreCorto('notas-2026-01-05-ab12'), { base: 'notas', sufijo: 'ab12' })
  assert.deepEqual(nombreCorto('datos-migracion-2026'), { base: 'datos-migracion-2026', sufijo: null })
  assert.deepEqual(nombreCorto('oficina'), { base: 'oficina', sufijo: null })
  // Sufijo de 4 a 12 letras o dígitos, sin importar mayúsculas
  assert.deepEqual(nombreCorto('x-2026-11-27-ABC'), { base: 'x-2026-11-27-ABC', sufijo: null })
  assert.deepEqual(nombreCorto('x-2026-11-27-ABCD'), { base: 'x', sufijo: 'ABCD' })
})

test('tiraRepos: el chip dibuja el nombre corto con el sufijo en small; title y nombre accesible, enteros', () => {
  const proyectos = agruparPorProyecto([sr('q/scratch-2026-11-27-d5bfc1')])
  const h = tiraRepos(proyectos, 0, proyectos.map(p => p.repo), AHORA)
  assert.match(h, /<span class="rch-n">scratch<small> · d5bfc1<\/small><\/span>/)
  assert.match(h, /title="q\/scratch-2026-11-27-d5bfc1"/)
  assert.match(h, /aria-label="scratch-2026-11-27-d5bfc1, 1 sesión, elegido"/)
})

test('estilos: el nombre del chip topa en 112 px (--ancho-nombre-repo) con «…»', () => {
  assert.match(css, /--ancho-nombre-repo: 112px/)
  assert.match(css, /\.rch-n \{[^}]*max-width: var\(--ancho-nombre-repo\);[^}]*overflow: hidden;[^}]*text-overflow: ellipsis/)
  assert.match(css, /\.rch-n small \{[^}]*font: 500 11px\/1 var\(--m\);[^}]*font-stretch: 75%;[^}]*color: var\(--tenue\)/)
})

// ------------------------------------------------------------------ 4.2 grupo y orden

test('grupoRepo: pregunta › trabajando › dormida (todas sus sesiones) › espera', () => {
  const [pre] = agruparPorProyecto([sr('q/a', { ...conPregunta, ...trabajando })])
  const [tra] = agruparPorProyecto([sr('q/b', trabajando), sr('q/b', { k: 1 })])
  const [dor] = agruparPorProyecto([sr('q/c', dormidaS), sr('q/c', { k: 1, ...dormidaS })])
  const [mix] = agruparPorProyecto([sr('q/d', dormidaS), sr('q/d', { k: 1 })])
  const [esp] = agruparPorProyecto([sr('q/e')])
  assert.equal(grupoRepo(pre, AHORA), 'pregunta')
  assert.equal(grupoRepo(tra, AHORA), 'trabajando')
  assert.equal(grupoRepo(dor, AHORA), 'dormida')
  assert.equal(grupoRepo(mix, AHORA), 'espera')
  assert.equal(grupoRepo(esp, AHORA), 'espera')
  // La pregunta de un subagente también cuenta (la misma cuenta del «1 ?»)
  const [sub] = agruparPorProyecto([sr('q/f', { preguntas: [{ id: 'x', agente: 'a1', items: [{ pregunta: '¿?' }] }] })])
  assert.equal(grupoRepo(sub, AHORA), 'pregunta')
  assert.deepEqual(GRUPOS_TIRA, ['pregunta', 'trabajando', 'espera', 'dormida'])
})

test('ordenTira suelta: pregunta › trabajando › espera › dormida; adentro, el orden de agruparPorProyecto (alfabético, fuera de repo al final)', () => {
  const proyectos = agruparPorProyecto([
    sr('q/zeta', dormidaS), sr('q/beta'), sr(null), sr('q/alfa', trabajando), sr('q/omega', conPregunta), sr('q/gamma'), sr('q/delta', trabajando),
  ])
  const { orden, pendiente } = ordenTira(proyectos, AHORA)
  assert.deepEqual(orden, ['q/omega', 'q/alfa', 'q/delta', 'q/beta', 'q/gamma', null, 'q/zeta'])
  assert.equal(pendiente, false)
})

test('ordenTira congelada: devuelve el anterior sin los que se fueron, suma los nuevos al final por urgencia y avisa si el suelto sería otro', () => {
  const proyectos = agruparPorProyecto([sr('q/a'), sr('q/b', conPregunta), sr('q/c', trabajando), sr('q/n1'), sr('q/n2', conPregunta)])
  const anterior = ['q/a', 'q/c', 'q/b', 'q/viejo']
  const r = ordenTira(proyectos, AHORA, anterior, true)
  assert.deepEqual(r.orden, ['q/a', 'q/c', 'q/b', 'q/n2', 'q/n1'])
  assert.equal(r.pendiente, true)
  // Sin cambios de urgencia, nada pendiente
  const suelto = ordenTira(proyectos, AHORA).orden
  assert.deepEqual(ordenTira(proyectos, AHORA, suelto, true), { orden: suelto, pendiente: false })
  // Suelta, el anterior no cuenta
  assert.deepEqual(ordenTira(proyectos, AHORA, anterior, false).orden, suelto)
})

// ------------------------------------------------------------------ 6 reparto en renglones

test('renglonesTira: llena de izquierda a derecha con la separación', () => {
  assert.equal(renglonesTira([100, 100, 100], 320, 6), 1)
  assert.equal(renglonesTira([100, 100, 100], 310, 6), 2)
  assert.equal(renglonesTira([], 300, 6), 0)
  assert.equal(SEPARACION_TIRA, 6)
  assert.equal(FILAS_TIRA, 2)
  assert.equal(ANCHO_MAS, 72)
})

test('repartirTira: si todos entran en dos renglones, todos visibles y sin «+n»', () => {
  const r = repartirTira({ anchos: [100, 100, 100, 100], ancho: 300 })
  assert.deepEqual(r, { visibles: [0, 1, 2, 3], ocultos: [], renglones: 2 })
})

test('repartirTira: si no, el prefijo más largo que entra en dos renglones dejando lugar al «+n» (72) al final', () => {
  // 496 de ancho: 3 de 120 por renglón (372); en el segundo, 3 + el «+n» (372 + 6 + 72 = 450)
  const anchos = Array(10).fill(120)
  const r = repartirTira({ anchos, ancho: 496 })
  assert.deepEqual(r.visibles, [0, 1, 2, 3, 4, 5])
  assert.deepEqual(r.ocultos, [6, 7, 8, 9])
  assert.equal(r.renglones, 2)
  // El «+n» de ancho fijo: el reparto no depende de cuántos dígitos tenga n
  assert.deepEqual(repartirTira({ anchos: Array(30).fill(120), ancho: 496 }).visibles, [0, 1, 2, 3, 4, 5])
})

test('repartirTira: un repo con una pregunta nunca queda en el «+n»; con muchos, la tira toma un tercer renglón', () => {
  const anchos = Array(10).fill(150)
  const r = repartirTira({ anchos, ancho: 496, obligados: [0, 1, 2, 3, 4, 5] })
  for (const i of [0, 1, 2, 3, 4, 5]) assert.ok(r.visibles.includes(i), `falta ${i}`)
  assert.equal(r.renglones, 3)
  assert.ok(r.ocultos.length > 0)
})

test('repartirTira: el elegido oculto ocupa el último lugar visible que no sea obligado; el desplazado pasa a ocultos', () => {
  const anchos = Array(10).fill(120)
  const r = repartirTira({ anchos, ancho: 496, elegido: 8, obligados: [0] })
  assert.deepEqual(r.visibles, [0, 1, 2, 3, 4, 8])
  assert.ok(r.ocultos.includes(5))
  // Si el elegido es más ancho y no entra, se oculta uno más
  const anchos2 = [...Array(8).fill(120), 300, 120]
  const r2 = repartirTira({ anchos: anchos2, ancho: 496, elegido: 8 })
  assert.deepEqual(r2.visibles, [0, 1, 2, 8])
  assert.equal(r2.renglones, 2)
})

test('repartirTira congelada: se respetan los visibles de antes; una pregunta nueva en un oculto se suma al final y un elegido oculto toma el último lugar', () => {
  const anchos = Array(10).fill(120)
  const congelados = [0, 1, 2, 3, 4, 5]
  // Sin excepciones, los mismos (aunque el suelto sería otro)
  assert.deepEqual(repartirTira({ anchos, ancho: 496, congelados }).visibles, congelados)
  // (a) una pregunta en el 8: pasa a ser el último chip visible, sin sacar a nadie (puede tomar un tercer renglón)
  const a = repartirTira({ anchos, ancho: 496, congelados, obligados: [8] })
  assert.deepEqual(a.visibles, [0, 1, 2, 3, 4, 5, 8])
  assert.equal(a.renglones, 3)
  // (b) elegir el 9: toma el último lugar visible y el 5 pasa a la lista
  const b = repartirTira({ anchos, ancho: 496, congelados, elegido: 9 })
  assert.deepEqual(b.visibles, [0, 1, 2, 3, 4, 9])
  assert.ok(b.ocultos.includes(5))
  // Los que ya no están se ignoran
  assert.deepEqual(repartirTira({ anchos: [120, 120], ancho: 496, congelados: [0, 1, 5] }).visibles, [0, 1])
})

// ------------------------------------------------------------------ 5.1 y 5.2 chips

test('tiraRepos: los chips van en el orden pedido, con data-repo; data-proy sigue siendo el índice en proyectos', () => {
  const proyectos = agruparPorProyecto([sr('q/a'), sr('q/b', conPregunta), sr('q/c', trabajando)])
  const orden = ['q/b', 'q/c', 'q/a']
  const h = tiraRepos(proyectos, 0, orden, AHORA)
  const repos = [...h.matchAll(/data-proy="(\d+)" data-repo="([^"]*)"/g)].map(m => [+m[1], m[2]])
  assert.deepEqual(repos, [[1, 'q/b'], [2, 'q/c'], [0, 'q/a']])
})

test('tiraRepos: la cuenta de sesiones sale solo con 2 o más; con una pregunta, «n ?» con cualquier cantidad; el nombre accesible la dice siempre', () => {
  const proyectos = agruparPorProyecto([sr('q/uno'), sr('q/dos'), sr('q/dos', { k: 1 }), sr('q/preg', conPregunta)])
  const h = tiraRepos(proyectos, -1, proyectos.map(p => p.repo), AHORA)
  const chip = repo => h.match(new RegExp(`<button[^>]*data-repo="${repo}"[^>]*>.*?</button>`))[0]
  assert.doesNotMatch(chip('q/uno'), /class="chip/)
  assert.match(chip('q/uno'), /aria-label="uno, 1 sesión"/)
  assert.match(chip('q/dos'), /<span class="chip" aria-hidden="true">2<\/span>/)
  assert.match(chip('q/dos'), /aria-label="dos, 2 sesiones"/)
  assert.match(chip('q/preg'), /<span class="chip chip-preg" aria-hidden="true">1 \?<\/span>/)
  assert.match(chip('q/preg'), /aria-label="preg, 1 pregunta pendiente"/)
})

test('tiraRepos: trabajando lleva el punto y «, trabajando»; dormida la clase y «, dormida»; el elegido «, elegido» al final', () => {
  const proyectos = agruparPorProyecto([sr('q/t', trabajando), sr('q/d', dormidaS), sr('q/e')])
  const h = tiraRepos(proyectos, proyectos.findIndex(p => p.repo === 'q/d'), proyectos.map(p => p.repo), AHORA)
  assert.match(h, /aria-label="t, 1 sesión, trabajando"><span class="pj-ic"[^>]*>t<\/span><span class="rch-n">t<\/span><i class="rch-trab" aria-hidden="true"><\/i><\/button>/)
  assert.match(h, /<button type="button" class="rch dormida" aria-current="true" data-accion="ir" data-proy="\d" data-repo="q\/d" title="q\/d" aria-label="d, 1 sesión, dormida, elegido">/)
  assert.doesNotMatch(h.match(/<button[^>]*data-repo="q\/e"[^>]*>.*?<\/button>/)[0], /rch-trab|dormida/)
})

test('tiraRepos: al final, el «+n» escondido (lo completa ajustarTira), con su ARIA de botón de menú y sin data-proy', () => {
  const proyectos = agruparPorProyecto([sr('q/a'), sr('q/b')])
  const h = tiraRepos(proyectos, 0, proyectos.map(p => p.repo), AHORA)
  assert.match(h, /<button type="button" class="rch rch-mas" data-accion="repos-mas" aria-haspopup="listbox" aria-expanded="false" aria-controls="repos-mas" hidden><span class="rch-pts" aria-hidden="true"><\/span><span class="rch-mas-n" aria-hidden="true"><\/span><\/button>$/)
  assert.doesNotMatch(h.match(/<button[^>]*rch-mas[^>]*>/)[0], /data-proy/)
  assert.equal(tiraRepos([], 0, [], AHORA), '')
})

test('contenidoMas: hasta 4 puntos con el color de los primeros ocultos en orden, «+n» y «n repos más»', () => {
  const proyectos = agruparPorProyecto(['a', 'b', 'c', 'd', 'e', 'f'].map(n => sr(`q/${n}`)))
  const m = contenidoMas(proyectos, ['q/f', 'q/b', 'q/c', 'q/d', 'q/e'])
  assert.equal(m.numero, '+5')
  assert.equal(m.etiqueta, '5 repos más')
  const colores = [...m.puntos.matchAll(/<i style="--c:([^"]+)"><\/i>/g)].map(x => x[1])
  assert.deepEqual(colores, ['f', 'b', 'c', 'd'].map(n => colorProyecto(n)))
})

// ------------------------------------------------------------------ 5.3 la lista

test('listaRepos: cabecera, grupos en orden con sus rótulos, filas en grilla de 2 columnas y opciones con su nombre entero', () => {
  const proyectos = agruparPorProyecto([
    sr('q/scratch-2026-11-27-d5bfc1'), sr('q/webs'), sr('q/temple', dormidaS), sr('q/crm', trabajando), sr('q/play', dormidaS),
  ])
  const ocultos = ['q/crm', 'q/scratch-2026-11-27-d5bfc1', 'q/webs', 'q/play', 'q/temple']
  const h = listaRepos(proyectos, ocultos, AHORA)
  assert.match(h, /^<div class="rm-cab" aria-hidden="true"><span>5 repos más<\/span><span><kbd>Esc<\/kbd> cierra<\/span><\/div>/)
  const grupos = [...h.matchAll(/<div role="group" aria-labelledby="(rm-g-\w+)"><p class="grp" id="\1">([^<]+)<\/p>/g)].map(m => m[2])
  assert.deepEqual(grupos, ['Trabajando', 'Esperan tu mensaje', 'Dormidas'])
  // La grilla: tantos renglones como la mitad, para bajar por la primera columna
  assert.match(h, /<div class="rm-filas" style="--filas:1">/)
  assert.match(h, /<div class="rm-filas" style="--filas:1"><button[^>]*data-repo="q\/scratch/)
  // La opción: role=option, el mismo data-accion="ir" con su índice, el nombre entero y el tiempo del último turno
  const k = proyectos.findIndex(p => p.repo === 'q/scratch-2026-11-27-d5bfc1')
  assert.match(h, new RegExp(`<button type="button" class="rm-op" role="option" aria-selected="false" tabindex="-1" data-accion="ir" data-proy="${k}" data-repo="q/scratch-2026-11-27-d5bfc1" title="q/scratch-2026-11-27-d5bfc1" aria-label="scratch-2026-11-27-d5bfc1, 1 sesión"><span class="pj-ic"[^>]*>[^<]*</span><span class="rm-n">scratch-2026-11-27-d5bfc1</span><span class="rm-t" aria-hidden="true">2 min</span></button>`))
  // La primera opción es la activa (tabindex 0); las dormidas con su clase
  assert.equal((h.match(/tabindex="0"/g) ?? []).length, 1)
  assert.match(h, /^.*?<button[^>]*tabindex="0"[^>]*data-repo="q\/crm"/)
  assert.match(h, /class="rm-op dormida"[^>]*data-repo="q\/play"/)
  assert.equal(listaRepos(proyectos, [], AHORA), '')
})

test('listaRepos: el grupo de 5 tiene 3 renglones; la cuenta sigue la regla de 5.1', () => {
  const proyectos = agruparPorProyecto([...['a', 'b', 'c', 'd'].map(n => sr(`q/${n}`)), sr('q/e'), sr('q/e', { k: 1 })])
  const h = listaRepos(proyectos, proyectos.map(p => p.repo), AHORA)
  assert.match(h, /<div class="rm-filas" style="--filas:3">/)
  assert.match(h, /aria-label="e, 2 sesiones"><span class="pj-ic"[^>]*>[^<]*<\/span><span class="rm-n">e<\/span><span class="chip" aria-hidden="true">2<\/span>/)
})

// ------------------------------------------------------------------ 8 teclado

const ITEMS = [{ mas: false }, { mas: false }, { mas: false }, { mas: true }]

test('pasoTira: ← → recorren los ítems visibles con vuelta; un chip se elige, el «+n» solo se enfoca; desde el «+n», → elige el primero', () => {
  assert.deepEqual(pasoTira(ITEMS, 0, 'ArrowRight'), { foco: 1, elegir: true, abrir: false })
  assert.deepEqual(pasoTira(ITEMS, 0, 'ArrowLeft'), { foco: 3, elegir: false, abrir: false })
  assert.deepEqual(pasoTira(ITEMS, 2, 'ArrowRight'), { foco: 3, elegir: false, abrir: false })
  assert.deepEqual(pasoTira(ITEMS, 3, 'ArrowRight'), { foco: 0, elegir: true, abrir: false })
})

test('pasoTira: ↑ ↓ mueven el foco sin elegir; en el «+n», ↓ abre la lista y ↑ va al anterior; Enter o Espacio en el «+n» abren', () => {
  assert.deepEqual(pasoTira(ITEMS, 0, 'ArrowDown'), { foco: 1, elegir: false, abrir: false })
  assert.deepEqual(pasoTira(ITEMS, 0, 'ArrowUp'), { foco: 3, elegir: false, abrir: false })
  assert.deepEqual(pasoTira(ITEMS, 3, 'ArrowDown'), { foco: 3, elegir: false, abrir: true })
  assert.deepEqual(pasoTira(ITEMS, 3, 'ArrowUp'), { foco: 2, elegir: false, abrir: false })
  assert.deepEqual(pasoTira(ITEMS, 3, 'Enter'), { foco: 3, elegir: false, abrir: true })
  assert.deepEqual(pasoTira(ITEMS, 3, ' '), { foco: 3, elegir: false, abrir: true })
  // Enter en un chip: el clic de siempre
  assert.equal(pasoTira(ITEMS, 1, 'Enter'), null)
  assert.equal(pasoTira(ITEMS, 1, 'a'), null)
})

test('pasoLista: ↓ ↑ en el orden del DOM sin vuelta; → ← a la otra columna del mismo renglón; Inicio y Fin', () => {
  // Dos grupos: 5 (3 renglones: 0 1 2 | 3 4) y 2 (1 renglón: 5 | 6)
  const t = [5, 2]
  assert.equal(pasoLista(t, 0, 'ArrowDown'), 1)
  assert.equal(pasoLista(t, 4, 'ArrowDown'), 5)
  assert.equal(pasoLista(t, 6, 'ArrowDown'), null)
  assert.equal(pasoLista(t, 0, 'ArrowUp'), null)
  assert.equal(pasoLista(t, 0, 'ArrowRight'), 3)
  assert.equal(pasoLista(t, 1, 'ArrowRight'), 4)
  assert.equal(pasoLista(t, 2, 'ArrowRight'), null)
  assert.equal(pasoLista(t, 4, 'ArrowLeft'), 1)
  assert.equal(pasoLista(t, 3, 'ArrowRight'), null)
  assert.equal(pasoLista(t, 0, 'ArrowLeft'), null)
  assert.equal(pasoLista(t, 5, 'ArrowRight'), 6)
  assert.equal(pasoLista(t, 6, 'ArrowLeft'), 5)
  assert.equal(pasoLista(t, 4, 'Home'), 0)
  assert.equal(pasoLista(t, 0, 'End'), 6)
  assert.equal(pasoLista(t, 0, 'Enter'), null)
})

test('repoVecino: ← → fuera de la tira recorren todos los repos en el orden de la tira, ocultos incluidos, con vuelta', () => {
  const orden = ['q/b', 'q/c', null, 'q/a']
  assert.deepEqual(repoVecino(orden, 'q/b', 1), { repo: 'q/c' })
  assert.deepEqual(repoVecino(orden, 'q/c', 1), { repo: null })
  assert.deepEqual(repoVecino(orden, 'q/a', 1), { repo: 'q/b' })
  assert.deepEqual(repoVecino(orden, 'q/b', -1), { repo: 'q/a' })
  // Como antes: con menos de 2 repos no hay a dónde ir; el actual que no está cuenta como el primero
  assert.equal(repoVecino(['q/a'], 'q/a', 1), null)
  assert.deepEqual(repoVecino(orden, 'q/x', 1), { repo: 'q/c' })
})

// ------------------------------------------------------------------ cableado (12)

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const css = readFileSync(new URL('../src/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const motion = readFileSync(new URL('../src/modulosMotion.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function cuerpo(nombre) {
  const desde = main.search(new RegExp(`\\n(async )?function ${nombre}\\(`))
  assert.notEqual(desde, -1, `main.js ya no declara ${nombre}`)
  return main.slice(desde, main.indexOf('\n}\n', desde) + 2)
}

test('index.html: div.repos-caja envuelve a la tira y a la lista del «+n», hermana del nav', () => {
  assert.match(html, /<div class="repos-caja">\s*<nav class="repos" id="repos" aria-label="Repos"><\/nav>\s*<div id="repos-mas" role="listbox" hidden><\/div>\s*<\/div>/)
})

test('main.js: la tira se congela con el puntero, el foco o la lista, y se reordena 400 ms después de soltarse', () => {
  assert.equal(ESPERA_REORDEN_MS, 400)
  assert.match(main, / {2}repos: \{ orden: \[\], visibles: \[\], ocultos: \[\], congelada: false, pendiente: false, abierta: false/)
  const sujeta = cuerpo('tiraSujeta')
  assert.match(sujeta, /st\.repos\.puntero/)
  assert.match(sujeta, /st\.repos\.abierta/)
  assert.match(sujeta, /document\.activeElement\?\.closest\?\.\('\.repos-caja'\)/)
  assert.match(cuerpo('soltarTira'), /setTimeout\([\s\S]*ESPERA_REORDEN_MS\)/)
  for (const ev of ['pointerenter', 'pointerleave', 'focusin', 'focusout']) assert.match(main, new RegExp(`cajaRepos\\.addEventListener\\('${ev}'`))
  assert.match(cuerpo('soltarTira'), /reordenarTira\(/)
})

test('main.js: pintar dibuja la tira con pintarTiraRepos, salvo con la lista abierta; ordena con ordenTira, dibuja con tiraRepos(…, orden, ahora) y ajusta', () => {
  assert.match(cuerpo('pintar'), /if \(!st\.repos\.abierta\) pintarTiraRepos\(i, ahora\)/)
  const f = cuerpo('pintarTiraRepos')
  assert.match(f, /ordenTira\(st\.proyectos, ahora, st\.repos\.orden, st\.repos\.congelada\)/)
  assert.match(f, /poner\('#repos', tiraRepos\(st\.proyectos, i, st\.repos\.orden, ahora\)\)/)
  assert.match(f, /ajustarTira\(\)/)
  // El redibujo no se lleva el foco (modulos-ux.md 9.4): el repo por data-repo, o el «+n»
  assert.match(f, /#repos \[data-repo=/)
  assert.match(cuerpo('ajustarTira'), /repartirTira\(/)
})

test('main.js: la tira entra al volver a Sesiones desde otra hoja (9), no al cambiar de proyecto; irModulo sigue igual', () => {
  const f = cuerpo('irModulo')
  assert.match(f, /if \(plan\.modulo === 'sesiones' && plan\.cerrar\.length\) movimientoModulos\.entraTira\(\$\('#repos'\)\)/)
  // Lo de antes de irModulo no cambió: cierra la hoja que se deja, abre la nueva y la píldora viaja
  assert.match(f, /st\.modulo = plan\.modulo/)
  assert.match(f, /movimientoModulos\.viajarPildora\(nav, desde\)/)
  assert.doesNotMatch(cuerpo('irAProyecto'), /entraTira/)
  // La lista se cierra al cambiar de módulo, al entrar a la dividida o si la tira se vacía (8.2)
  assert.match(cuerpo('pintar'), /if \(st\.repos\.abierta && \(st\.modulo !== 'sesiones' \|\| st\.dividida\.clave \|\| !st\.proyectos\.length\)\) cerrarListaRepos\(\{ foco: false, redibujar: false \}\)/)
})

test('main.js: se fueron desplazarTira, MASCARA_REPOS y verRepoElegido', () => {
  assert.doesNotMatch(main, /desplazarTira|MASCARA_REPOS|verRepoElegido/)
})

test('main.js: moverProyecto recorre el orden de la tira (8.1, fuera de la tira) con repoVecino', () => {
  const f = cuerpo('moverProyecto')
  assert.match(f, /repoVecino\(ordenTiraActual\(\), st\.repo, dir\)/)
  assert.match(f, /irAProyecto\(v\.repo, dir\)/)
})

test('main.js: elegir desde la lista cierra la lista y enfoca el chip elegido; Esc la cierra con el foco en el «+n»', () => {
  assert.match(main, /const deLista = !!b\.closest\('#repos-mas'\)/)
  assert.match(main, /if \(deLista\) cerrarListaRepos\(\{ foco: false \}\)/)
  assert.match(main, /if \(deLista\) \$\('#repos \[aria-current\]'\)\?\.focus\(\)/)
  assert.match(main, /if \(e\.key === 'Escape' && st\.repos\.abierta\) \{\n {4}e\.preventDefault\(\)\n {4}cerrarListaRepos\(\{ foco: 'mas' \}\)/)
  assert.match(cuerpo('abrirListaRepos'), /listaRepos\(st\.proyectos, st\.repos\.ocultos, Date\.now\(\)\)/)
  assert.match(cuerpo('abrirListaRepos'), /abrirLista\(/)
  assert.match(cuerpo('cerrarListaRepos'), /cerrarLista\(/)
})

test('main.js: las teclas de la tira usan pasoTira sobre los ítems visibles y las de la lista pasoLista', () => {
  assert.match(cuerpo('teclaTira'), /\[\.\.\.document\.querySelectorAll\('#repos \.rch:not\(\[hidden\]\)'\)\]/)
  assert.match(cuerpo('teclaTira'), /pasoTira\(/)
  assert.match(cuerpo('teclaListaRepos'), /pasoLista\(/)
})

test('modulosMotion.js: entraTira, entraChip, reordenarTira, abrirLista y cerrarLista con los tiempos de 9', () => {
  for (const f of ['entraTira', 'entraChip', 'reordenarTira', 'abrirLista', 'cerrarLista']) assert.match(motion, new RegExp(`export (async )?function ${f}\\(`), f)
  assert.match(motion, /TIRA_ENTRA_MS = 260/)
  assert.match(motion, /TIRA_ESCALON_MS = 30/)
  assert.match(motion, /TOPE_ESCALONES_TIRA = 8/)
  assert.match(motion, /REORDEN_MS = 300/)
  assert.match(motion, /LISTA_ABRE_MS = 220/)
  assert.match(motion, /LISTA_ESCALON_MS = 20/)
  assert.match(motion, /LISTA_CIERRA_MS = 140/)
  for (const t of ['--d-tira-entra: 260ms', '--tira-escalon: 30ms', '--d-reorden: 300ms', '--d-lista-abre: 220ms', '--lista-escalon: 20ms', '--d-lista-cierra: 140ms', '--ancho-mas: 72px']) assert.ok(css.includes(t), t)
})

test('estilos: la tira en renglones sin scroll ni máscara; el «+n», la lista y sus estados', () => {
  assert.match(css, /\.repos \{[^}]*display: flex;[^}]*flex-wrap: wrap;[^}]*gap: 6px;[^}]*padding: 2px/)
  assert.doesNotMatch(css, /\.repos \{[^}]*(overflow-x|mask-image|scrollbar-width)/)
  assert.doesNotMatch(css, /\.repos::-webkit-scrollbar/)
  assert.match(css, /\.rch-mas \{[^}]*width: var\(--ancho-mas\)/)
  assert.match(css, /\.rch\.dormida \{[^}]*border-style: dashed/)
  assert.match(css, /\.rch-trab \{[^}]*width: 6px;[^}]*height: 6px/)
  assert.match(css, /#repos-mas \{[^}]*position: absolute;[^}]*z-index: 9;[^}]*max-height: 360px/)
  assert.match(css, /\.rm-filas \{[^}]*grid-auto-flow: column;[^}]*grid-template-rows: repeat\(var\(--filas\), auto\)/)
  // Las transiciones del «+n» y de las opciones se apagan con movimiento reducido y en pausa
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n {2}\.mod, \.mod-ic, \.ind-mod, \.rch, \.rch-mas, \.rm-op \{ transition: none \}/)
  assert.match(css, /body\.pausa \.mod, body\.pausa \.mod-ic, body\.pausa \.ind-mod, body\.pausa \.rch, body\.pausa \.rch-mas, body\.pausa \.rm-op \{ transition: none \}/)
  // La tira no entra al cambiar de proyecto (tableroMotion la nombra por #repos; ahora la envuelve .repos-caja)
  assert.match(css, /\.principal > \.repos-caja\.cambia \{ animation: none \}/)
})
