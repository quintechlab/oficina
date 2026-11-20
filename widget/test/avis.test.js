// Tests de los Avis (dirección docs/diseno/estilo-avis-ux.md, sección 5): de los datos a la pose
// (5.4), el generador de SVG (5.1 y 5.2) y la accesibilidad (5.6). Funciones puras de avis.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { poseAvi, POSES, svgAvi, avi, desfase, defsAvis, CLAUDE, PERSONAJE_BASE } from '../src/avis.js'
import { animoSesion, animoSubagente, personajeDeNombre, textoActividad, tituloActividad, MS_FESTEJO } from '../src/logica.js'

const AHORA = Date.parse('2026-11-20T12:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const haceMs = ms => new Date(AHORA - ms).toISOString()

test('poseAvi sigue la tabla 5.4: cada ánimo de sesión y de subagente tiene su pose', () => {
  const tabla = {
    teEspera: 'teEspera', coordinando: 'coordinando', esperando: 'esperando', editando: 'escribiendo',
    leyendo: 'leyendo', pensando: 'pensando', inactiva: 'inactiva', escribiendo: 'escribiendo',
    listo: 'listo', fallo: 'fallo', durmiendo: 'durmiendo',
    // heredados de escena.js
    comiendo: 'escribiendo', reposo: 'listo', saluda: 'esperando',
  }
  for (const [animo, pose] of Object.entries(tabla)) assert.deepEqual(poseAvi(animo), { pose, comando: false }, animo)
  // Corriendo un comando: escribe igual, pero el logo de la notebook es verde
  assert.deepEqual(poseAvi('comando'), { pose: 'escribiendo', comando: true })
})

test('un ánimo desconocido o vacío queda esperando', () => {
  assert.deepEqual(poseAvi(undefined), { pose: 'esperando', comando: false })
  assert.deepEqual(poseAvi('raro'), { pose: 'esperando', comando: false })
})

test('"proceso" (5.5): despierto, mira un anillo celeste que gira, sin porcentaje', () => {
  assert.deepEqual(poseAvi('proceso'), { pose: 'proceso', comando: false })
  assert.ok(POSES.includes('proceso'))
  const svg = svgAvi(CLAUDE, 'proceso')
  assert.match(svg, /class="e-proceso"/)
  // El anillo: un riel oscuro y un arco celeste que gira (indeterminado: no dice cuánto falta)
  assert.match(svg, /class="giro"[^>]*stroke="#7FB3FF"/)
  // Ojos abiertos (despierto), sin zetas
  assert.match(svg, /class="ojo"/)
  assert.doesNotMatch(svg, /class="z/)
})

test('la pose de Claude con procesos en segundo plano: los espera solo cuando no hace otra cosa', () => {
  const s = { sesion: 'a', actualizado: hace(0), actividad: 'esperando 1 proceso', procesos: [{ id: 'b1', descripcion: 'Arma el instalador', desde: hace(2) }] }
  const dos = [...s.procesos, { id: 'b2', descripcion: 'npm run dev', desde: hace(1) }]
  const trabajando = { id: '1', nombre: 'Lucas', estado: 'trabajando', desde: hace(2) }
  const pregunta = { id: 'p', agente: null, items: [{ pregunta: '¿?' }] }
  const caso = (x, pose, linea) => {
    assert.equal(poseAvi(animoSesion(x, AHORA)).pose, pose)
    assert.equal(textoActividad(x, AHORA), linea)
  }
  // 1) pregunta propia y 2) equipo trabajando siguen ganando
  caso({ ...s, preguntas: [pregunta] }, 'teEspera', 'ahora · te hace una pregunta')
  caso({ ...s, agentes: [trabajando] }, 'coordinando', 'ahora · coordinando el equipo')
  // 3) procesos pendientes, antes que "esperando tu mensaje"
  caso(s, 'proceso', 'ahora · esperando 1 proceso')
  caso({ ...s, actividad: 'esperándote', procesos: dos }, 'proceso', 'ahora · esperando 2 procesos')
  caso({ ...s, actividad: null }, 'proceso', 'ahora · esperando 1 proceso')
  // Una sesión que ya no publica hace rato sigue esperando su proceso, no se duerme
  caso({ ...s, actualizado: hace(25) }, 'proceso', 'ahora · esperando 1 proceso')
  // Si Claude está haciendo otra cosa, se ve eso (un servidor de desarrollo no tapa todo)
  caso({ ...s, actividad: 'editando main.js' }, 'escribiendo', 'ahora · editando main.js')
  // Sin procesos: lo de siempre
  caso({ ...s, actividad: 'esperándote', procesos: [] }, 'esperando', 'ahora · esperando tu mensaje')
  // Lo que publica el mod sin la lista (un compañero leído de GitHub): la línea basta
  caso({ sesion: 'b', actualizado: hace(0), actividad: 'esperando 2 procesos' }, 'proceso', 'ahora · esperando 2 procesos')
})

test('los procesos de la sesión se nombran en el título de su línea', () => {
  const s = { sesion: 'a', actualizado: hace(0), actividad: 'esperando 2 procesos', procesos: [{ id: 'b1', descripcion: 'Arma el instalador', desde: hace(2) }, { id: 'b2', descripcion: 'npm run dev', desde: hace(1) }] }
  assert.equal(tituloActividad(s, AHORA), 'Arma el instalador · hace 2 min\nnpm run dev · hace 1 min')
  // Sin procesos, el título es la actividad tal cual
  assert.equal(tituloActividad({ ...s, procesos: [], actividad: 'editando main.js' }, AHORA), 'editando main.js')
  assert.equal(tituloActividad({ sesion: 'c' }, AHORA), '')
})

test('la pose de Claude respeta la prioridad de la línea: pregunta, equipo, "esperándote", actividad', () => {
  const s = { sesion: 'a', actualizado: hace(0), actividad: 'editando main.js' }
  const trabajando = { id: '1', nombre: 'Lucas', estado: 'trabajando', desde: hace(2) }
  const pregunta = { id: 'p', agente: null, items: [{ pregunta: '¿?' }] }
  const caso = (x, pose, linea) => {
    assert.equal(poseAvi(animoSesion(x, AHORA)).pose, pose)
    assert.equal(textoActividad(x, AHORA), linea)
  }
  caso({ ...s, agentes: [trabajando], actividad: 'esperándote', preguntas: [pregunta] }, 'teEspera', 'ahora · te hace una pregunta')
  caso({ ...s, agentes: [trabajando], actividad: 'esperándote' }, 'coordinando', 'ahora · coordinando el equipo')
  caso({ ...s, actividad: 'esperándote' }, 'esperando', 'ahora · esperando tu mensaje')
  caso(s, 'escribiendo', 'ahora · editando main.js')
  caso({ ...s, actividad: 'corriendo npm test' }, 'escribiendo', 'ahora · corriendo npm test')
  assert.equal(poseAvi(animoSesion({ ...s, actividad: 'corriendo npm test' }, AHORA)).comando, true)
  caso({ ...s, actividad: 'leyendo logica.js' }, 'leyendo', 'ahora · leyendo logica.js')
  caso({ ...s, actividad: 'pensando' }, 'pensando', 'ahora · pensando')
  caso({ ...s, actividad: 'lanzando Delfina' }, 'esperando', 'ahora · lanzando Delfina')
  // Sin publicar hace más de 20 min: duerme
  caso({ ...s, actualizado: hace(25) }, 'inactiva', 'sin actividad hace 25 min')
})

test('un subagente festeja o se tambalea 6 s al terminar y después se duerme', () => {
  const ag = (estado, hasta) => ({ id: '1', nombre: 'Lucas', estado, desde: hace(9), hasta })
  assert.equal(poseAvi(animoSubagente(ag('listo', haceMs(2000)), AHORA)).pose, 'listo')
  assert.equal(poseAvi(animoSubagente(ag('fallo', haceMs(2000)), AHORA)).pose, 'fallo')
  assert.equal(poseAvi(animoSubagente(ag('listo', haceMs(MS_FESTEJO + 1)), AHORA)).pose, 'durmiendo')
  assert.equal(poseAvi(animoSubagente(ag('fallo', haceMs(MS_FESTEJO + 1)), AHORA)).pose, 'durmiendo')
  assert.equal(poseAvi(animoSubagente({ ...ag('trabajando', null), tipo: 'Explore' }, AHORA)).pose, 'leyendo')
  assert.equal(poseAvi(animoSubagente(ag('trabajando', null), AHORA)).pose, 'escribiendo')
  assert.equal(poseAvi(animoSubagente(ag('trabajando', null), AHORA, true)).pose, 'teEspera')
})

test('el generador dibuja el huevo de la familia: viewBox 120, piel, pico, patas y mejillas del personaje', () => {
  const h = svgAvi(personajeDeNombre('Camila'), 'esperando')
  assert.match(h, /^<svg viewBox="0 0 120 120" class="e-esperando" aria-hidden="true" focusable="false">/)
  assert.match(h, /<path class="piel" d="M60 34C84 34 97 52 97 74C97 92 81 102 60 102C39 102 23 92 23 74C23 52 36 34 60 34Z"\/>/)
  assert.match(h, /<path class="pico" d="M56 78.5Q60 85.5 64 78.5Q60 76.8 56 78.5Z"\/>/)
  assert.equal((h.match(/class="pata"/g) ?? []).length, 2)
  // Las mejillas llevan el color del personaje al 36 %
  assert.equal((h.match(/fill="#E78FB3" opacity=".36"/g) ?? []).length, 2)
  // El cuerpo nunca toma el color: es crema (gPiel) para todos
  assert.match(h, /<g class="cuerpo">/)
})

test('cada personaje lleva su accesorio; la antena es de Claude y el copete solo del Avi base', () => {
  const marcas = { antena: /class="bulbo"/, gata: /M30 58L33 25L56 39Z/, raton: /<circle cx="32" cy="41" r="14"/, brote: /M61 20Q70 8 81 15Q72 25 61 20Z/, mono: /M49 40Q57 24 71 34Q62 31 58 41Q55 36 49 40Z/, cuernos: /M40 45Q31 31 39 21Q43 33 52 38Z/ }
  for (const nombre of ['Claude', 'Camila', 'Ramiro', 'Lucas', 'Delfina', 'Inés']) {
    const p = personajeDeNombre(nombre)
    const h = svgAvi(p, 'esperando')
    assert.match(h, marcas[p.pj], nombre)
    for (const [otro, re] of Object.entries(marcas)) if (otro !== p.pj) assert.doesNotMatch(h, re, `${nombre} no lleva ${otro}`)
    assert.doesNotMatch(h, /class="copete"/, `${nombre} no lleva copete`)
  }
  assert.match(svgAvi(PERSONAJE_BASE, 'esperando'), /class="copete"/)
  assert.equal(PERSONAJE_BASE.color, '#F2B632')
})

test('los ojos cambian con la pose: cerrados al dormir, felices al festejar, en "x" al fallar', () => {
  const ojos = pose => svgAvi(CLAUDE, pose).match(/<g class="ojos">([\s\S]*?)<\/g>/)[1]
  assert.match(ojos('esperando'), /class="ojo"/)
  assert.match(ojos('durmiendo'), /M44.5 71Q49 75 53.5 71/)
  assert.match(ojos('inactiva'), /M44.5 71Q49 75 53.5 71/)
  assert.match(ojos('listo'), /M44.5 72.5Q49 65.5 53.5 72.5/)
  assert.match(ojos('fallo'), /M45.5 66.5l7 7/)
})

test('el dibujo de cada estado: notebook, libro, burbujas, ondas, "!", zetas, chispas y nubecita', () => {
  const c = CLAUDE
  assert.match(svgAvi(c, 'escribiendo'), /<rect x="35" y="80" width="50" height="21"[\s\S]*class="logo"[^>]*fill="#F2B632"[\s\S]*class="mano m2"/)
  // Con un comando, el logo de la notebook es verde
  assert.match(svgAvi(c, 'escribiendo', true), /class="logo"[^>]*fill="#8FD694"/)
  assert.match(svgAvi(c, 'escribiendo', true), /class="e-escribiendo comando"/)
  assert.match(svgAvi(c, 'leyendo'), /fill="#A58BFF"/)
  assert.equal((svgAvi(c, 'pensando').match(/class="p( |")/g) ?? []).length, 3)
  assert.equal((svgAvi(c, 'coordinando').match(/class="onda/g) ?? []).length, 2)
  assert.match(svgAvi(c, 'teEspera'), /<g class="burbuja">[\s\S]*>!<\/text>/)
  assert.equal((svgAvi(c, 'durmiendo').match(/class="z/g) ?? []).length, 3)
  assert.equal((svgAvi(c, 'inactiva').match(/class="z/g) ?? []).length, 3)
  assert.equal((svgAvi(c, 'listo').match(/class="chispa/g) ?? []).length, 4)
  assert.match(svgAvi(c, 'fallo'), /stroke="#FF7A6B"/)
  assert.doesNotMatch(svgAvi(c, 'esperando'), /class="(z|chispa|onda|burbuja|logo)/)
})

test('el Avi es decorativo donde el texto ya dice quién es; solo lleva nombre donde está solo', () => {
  const decorativo = avi(CLAUDE, 'coordinando', 84)
  assert.match(decorativo, /^<span class="avi" style="--t:84px;--d:-0s" aria-hidden="true"><svg viewBox="0 0 120 120" class="e-coordinando"/)
  assert.doesNotMatch(decorativo, /role="img"|aria-label/)
  const solo = avi(CLAUDE, 'coordinando', 54, { alt: 'Claude, coordinando el equipo', indice: 2 })
  assert.match(solo, /^<span class="avi" style="--t:54px;--d:-1.66s" role="img" aria-label="Claude, coordinando el equipo">/)
  assert.doesNotMatch(solo, /<span[^>]*aria-hidden/)
  // El nombre se escapa
  assert.match(avi(CLAUDE, 'esperando', 32, { alt: '<b>"x"</b>' }), /aria-label="&lt;b&gt;&quot;x&quot;&lt;\/b&gt;"/)
  // El ánimo pasa por poseAvi: "comando" se dibuja escribiendo con el logo verde
  assert.match(avi(CLAUDE, 'comando', 56), /class="e-escribiendo comando"/)
})

test('cada Avi respira desfasado: -((índice × 0,83) mod 3,3) s', () => {
  assert.equal(desfase(0), '-0s')
  assert.equal(desfase(1), '-0.83s')
  assert.equal(desfase(3), '-2.49s')
  assert.equal(desfase(4), '-0.02s')
  assert.equal(desfase(5), '-0.85s')
})

test('las definiciones compartidas (gPiel, gSuelo, fBlur) van una vez, ocultas y sin display:none', () => {
  const d = defsAvis()
  for (const id of ['gPiel', 'gSuelo', 'fBlur']) assert.equal((d.match(new RegExp(`id="${id}"`, 'g')) ?? []).length, 1)
  assert.match(d, /aria-hidden="true"/)
  assert.doesNotMatch(d, /display:\s*none/)
  assert.match(d, /stop-color="#FFFCF4"[\s\S]*offset=".42" stop-color="#F5EDDC"[\s\S]*offset=".8" stop-color="#E1D4B6"[\s\S]*stop-color="#CBBB97"/)
})
