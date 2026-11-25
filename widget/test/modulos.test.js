// Tests de modulos.js y modulosVista.js (#42, docs/diseno/modulos-ux.md, entrega M1): la barra como menú
// de módulos. La lógica pura (qué módulo abrir y qué hoja cerrar, el Esc por capas, las cuentas y los
// nombres de cada fila, la pregunta vista desde otro módulo, a dónde vuelve el panel al expandirse) y,
// leyendo main.js e index.html como texto, que todos los caminos pasen por `irModulo` (11.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MODULOS, MODULOS_ACTIVOS, irModulo, alEscModulo, cuentaModulo, nombreModulo, avisoPregunta, moduloAlExpandir, tituloModulo,
} from '../src/modulos.js'
import { avisoPreguntaHtml } from '../src/modulosVista.js'
import { agruparPorProyecto } from '../src/logica.js'
import { ladoFilaTareas } from '../src/tareasVista.js'
import { nombreFilaTareas } from '../src/tareas.js'

const AHORA = Date.parse('2026-11-25T15:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const ses = (repo, extra = {}) => ({ sesion: `s-${repo}`, repo, usuario: 'q', inicio: hace(30), actividad: 'esperándote', agentes: [], ...extra })
const preg = (id, extra = {}) => ({ id, agente: null, desde: hace(2), items: [{ pregunta: '¿Precios?', opciones: [{ etiqueta: 'Sí' }] }], ...extra })

// ------------------------------------------------------------------ MODULOS (11.3)

test('MODULOS: Sesiones, Tareas, Hábitos y Configuración, en ese orden; Configuración va al pie', () => {
  assert.deepEqual(MODULOS.map(m => m.id), ['sesiones', 'tareas', 'habitos', 'config'])
  assert.deepEqual(MODULOS.map(m => m.nombre), ['Sesiones', 'Tareas', 'Hábitos', 'Configuración'])
  assert.deepEqual(MODULOS.map(m => m.atajo), ['Escape', 'Control+T', 'Control+H', 'Control+Comma'])
  assert.deepEqual(MODULOS.filter(m => m.pie).map(m => m.id), ['config'])
  // Hábitos (#41) tiene su lugar previsto, pero todavía no se puede abrir
  assert.deepEqual(MODULOS_ACTIVOS, ['sesiones', 'tareas', 'config'])
})

test('tituloModulo: el title de cada fila, «{Módulo} ({atajo})» (5)', () => {
  assert.equal(tituloModulo('sesiones'), 'Sesiones (Esc)')
  assert.equal(tituloModulo('tareas'), 'Tareas (Ctrl T)')
  assert.equal(tituloModulo('habitos'), 'Hábitos (Ctrl H)')
  assert.equal(tituloModulo('config'), 'Configuración (Ctrl ,)')
})

// ------------------------------------------------------------------ irModulo (3.2, 11.3)

test('irModulo: de Tareas a Configuración cierra Tareas y abre Configuración', () => {
  assert.deepEqual(irModulo({ modulo: 'tareas' }, 'config'), { modulo: 'config', cerrar: ['tareas'], abrir: 'config', repo: null })
})

test('irModulo: de Sesiones a una hoja no cierra nada; de una hoja a Sesiones la cierra y no abre otra', () => {
  assert.deepEqual(irModulo({ modulo: 'sesiones' }, 'tareas'), { modulo: 'tareas', cerrar: [], abrir: 'tareas', repo: null })
  assert.deepEqual(irModulo({ modulo: 'config' }, 'sesiones'), { modulo: 'sesiones', cerrar: ['config'], abrir: null, repo: null })
})

test('irModulo: a Sesiones con `repo` lo devuelve (elegir un proyecto lleva a Sesiones en ese proyecto)', () => {
  assert.deepEqual(irModulo({ modulo: 'tareas' }, 'sesiones', { repo: 'q/catalogo' }), { modulo: 'sesiones', cerrar: ['tareas'], abrir: null, repo: 'q/catalogo' })
  // El repo es solo de Sesiones: las hojas no tienen proyecto
  assert.equal(irModulo({ modulo: 'sesiones' }, 'config', { repo: 'q/catalogo' }).repo, null)
})

test('irModulo: el mismo módulo no cierra ni abre nada, solo lleva el foco al h1', () => {
  assert.deepEqual(irModulo({ modulo: 'config' }, 'config'), { modulo: 'config', cerrar: [], abrir: null, repo: null, foco: 'h1' })
  // En Sesiones, con otro proyecto, va a ese proyecto
  assert.deepEqual(irModulo({ modulo: 'sesiones' }, 'sesiones', { repo: 'q/x' }), { modulo: 'sesiones', cerrar: [], abrir: null, repo: 'q/x', foco: 'h1' })
})

test('irModulo: un id desconocido (o Hábitos, que todavía no existe) no cambia nada', () => {
  assert.equal(irModulo({ modulo: 'sesiones' }, 'proyectos'), null)
  assert.equal(irModulo({ modulo: 'tareas' }, undefined), null)
  assert.equal(irModulo({ modulo: 'sesiones' }, 'habitos'), null)
  // Con #41 el módulo se activa sin tocar la función
  assert.deepEqual(irModulo({ modulo: 'sesiones', activos: [...MODULOS_ACTIVOS, 'habitos'] }, 'habitos'), { modulo: 'habitos', cerrar: [], abrir: 'habitos', repo: null })
})

// ------------------------------------------------------------------ alEscModulo (9.1)

test('alEscModulo: Tareas con una capa → capa; sin capas → sesiones; en Sesiones → nada (el Esc de siempre)', () => {
  for (const capa of ['vaciar', 'cancelar-lista', 'cancelar-sub', 'desarmar', 'cerrar-tarea']) assert.equal(alEscModulo('tareas', capa), 'capa', capa)
  assert.equal(alEscModulo('tareas', 'cerrar'), 'sesiones')
  assert.equal(alEscModulo('tareas', null), 'sesiones')
  // Configuración: la clave que se escribe y el "¿Borrar? Sí" son capas; cerrar la hoja pasa a ser ir a Sesiones
  assert.equal(alEscModulo('config', 'cancelar-clave'), 'capa')
  assert.equal(alEscModulo('config', 'desarmar'), 'capa')
  assert.equal(alEscModulo('config', 'cerrar'), 'sesiones')
  assert.equal(alEscModulo('sesiones', 'cerrar'), 'nada')
  assert.equal(alEscModulo('sesiones', null), 'nada')
})

// ------------------------------------------------------------------ cuentaModulo y nombreModulo (4.1, 4.2)

test('cuentaModulo de Sesiones: el número de sesiones (también 0) y, con preguntas, «1 ?»; todo aria-hidden', () => {
  assert.equal(cuentaModulo('sesiones', { sesiones: 0, preguntas: 0 }), '<span class="cuentas" aria-hidden="true"><span class="chip">0</span></span>')
  assert.equal(cuentaModulo('sesiones', { sesiones: 3, preguntas: 0 }), '<span class="cuentas" aria-hidden="true"><span class="chip">3</span></span>')
  assert.equal(cuentaModulo('sesiones', { sesiones: 3, preguntas: 1 }), '<span class="cuentas" aria-hidden="true"><span class="chip">3</span><span class="chip chip-preg">1 ?</span></span>')
  assert.match(cuentaModulo('sesiones', { sesiones: 3, preguntas: 2 }), /<span class="chip chip-preg">2 \?<\/span>/)
  // Cargando (7): «…»
  assert.equal(cuentaModulo('sesiones', { sesiones: null }), '<span class="cuentas" aria-hidden="true"><span class="chip">…</span></span>')
})

test('cuentaModulo de Tareas, Hábitos y Configuración: la pista del atajo sin nada que contar', () => {
  assert.equal(cuentaModulo('tareas', { hoy: 0, vencidas: 0 }), '<kbd aria-hidden="true">Ctrl T</kbd>')
  assert.equal(cuentaModulo('tareas', null), '<kbd aria-hidden="true">Ctrl T</kbd>')
  // Con algo, la de hoy (tareas-ux.md 4.1): la misma pieza que dibuja la fila
  assert.equal(cuentaModulo('tareas', { hoy: 2, vencidas: 2 }), ladoFilaTareas({ hoy: 2, vencidas: 2 }))
  assert.equal(cuentaModulo('habitos', null), '<kbd aria-hidden="true">Ctrl H</kbd>')
  assert.equal(cuentaModulo('habitos', { hechos: 0, total: 0 }), '<kbd aria-hidden="true">Ctrl H</kbd>')
  assert.equal(cuentaModulo('config', null), '<kbd aria-hidden="true">Ctrl ,</kbd>')
  // Con algo que mirar, el punto de pestaña (configuracion-ux.md 6.3)
  assert.equal(cuentaModulo('config', { punto: { tono: 'error', texto: ', una clave rechazada' } }), '<i class="pt t-error" aria-hidden="true"></i>')
  assert.equal(cuentaModulo('desconocido', {}), '')
})

test('nombreModulo: el nombre accesible de cada fila, en singular o plural y sin la parte que vale 0', () => {
  assert.equal(nombreModulo('sesiones', { sesiones: 3, preguntas: 1 }), 'Sesiones, 3 abiertas, 1 te hace una pregunta')
  assert.equal(nombreModulo('sesiones', { sesiones: 1, preguntas: 0 }), 'Sesiones, 1 abierta')
  assert.equal(nombreModulo('sesiones', { sesiones: 2, preguntas: 2 }), 'Sesiones, 2 abiertas, 2 te hacen una pregunta')
  assert.equal(nombreModulo('sesiones', { sesiones: 0, preguntas: 0 }), 'Sesiones')
  assert.equal(nombreModulo('sesiones', { sesiones: null }), 'Sesiones, buscando')
  assert.equal(nombreModulo('tareas', { hoy: 2, vencidas: 2 }), nombreFilaTareas({ hoy: 2, vencidas: 2 }))
  assert.equal(nombreModulo('tareas', { hoy: 2, vencidas: 2 }), 'Tareas, 2 para hoy, 2 vencidas')
  assert.equal(nombreModulo('tareas', null), 'Tareas')
  assert.equal(nombreModulo('habitos', { hechos: 2, total: 5 }), 'Hábitos, 2 de 5 hechos hoy')
  assert.equal(nombreModulo('habitos', null), 'Hábitos')
  assert.equal(nombreModulo('config', null), 'Configuración')
  assert.equal(nombreModulo('config', { punto: { tono: 'aviso', texto: ', el mod necesita atención' } }), 'Configuración, el mod necesita atención')
})

// ------------------------------------------------------------------ avisoPregunta (4.5, 5)

const PROYECTOS = agruparPorProyecto([
  ses('q/oficina'),
  ses('q/catalogo', { tarea: 48, preguntas: [preg('p1')] }),
])
const OFICINA = PROYECTOS.find(p => p.nombre === 'oficina').repo
const CATALOGO = PROYECTOS.find(p => p.nombre === 'catalogo').repo

test('avisoPregunta: en Sesiones y el mismo proyecto, nada (la pregunta ya está a la vista)', () => {
  assert.equal(avisoPregunta(PROYECTOS, 'sesiones', CATALOGO, 'avi', AHORA), null)
})

test('avisoPregunta: en Sesiones y otro proyecto, el de la pregunta', () => {
  const a = avisoPregunta(PROYECTOS, 'sesiones', OFICINA, 'avi', AHORA)
  assert.equal(a.proy, PROYECTOS.findIndex(p => p.repo === CATALOGO))
  assert.equal(a.repo, CATALOGO)
  assert.equal(a.proyecto, 'catalogo')
  assert.equal(a.quien.nombre, 'Claude')
  assert.equal(a.hace, '2 min')
})

test('avisoPregunta: en Tareas o Configuración, también el mismo proyecto', () => {
  for (const m of ['tareas', 'config']) {
    const a = avisoPregunta(PROYECTOS, m, CATALOGO, 'avi', AHORA)
    assert.equal(a?.repo, CATALOGO, m)
    assert.equal(avisoPregunta(PROYECTOS, m, OFICINA, 'avi', AHORA)?.repo, CATALOGO, m)
  }
})

test('avisoPregunta: sin preguntas, nada', () => {
  assert.equal(avisoPregunta(agruparPorProyecto([ses('q/oficina')]), 'tareas', 'q/oficina', 'avi', AHORA), null)
  assert.equal(avisoPregunta([], 'config', null, 'avi', AHORA), null)
})

test('avisoPregunta: un subagente que pregunta lleva su nombre (quienPregunta)', () => {
  const p = agruparPorProyecto([ses('q/catalogo', { agentes: [{ id: 'a1', nombre: 'Camila', estado: 'trabajando', desde: hace(5) }], preguntas: [preg('p2', { agente: 'a1' })] })])
  assert.equal(avisoPregunta(p, 'tareas', null, 'avi', AHORA).quien.nombre, 'Camila')
})

test('avisoPreguntaHtml (5): «{quien} te hace una pregunta», «{proyecto} · hace {tiempo}» y «Responder →», escapado', () => {
  assert.equal(avisoPreguntaHtml(null), '')
  const h = avisoPreguntaHtml(avisoPregunta(PROYECTOS, 'tareas', OFICINA, 'avi', AHORA))
  assert.match(h, /^<button type="button" class="aviso-p" data-accion="aviso-p" data-proy="\d" data-k="aviso-p">/)
  assert.match(h, /<span class="cara" aria-hidden="true"><span class="avi" /)
  assert.match(h, /<span class="t">Claude te hace una pregunta<small>catalogo · hace 2 min<\/small><\/span><span class="ir">Responder →<\/span><\/button>$/)
  const raro = avisoPreguntaHtml({ proy: 0, quien: { ...avisoPregunta(PROYECTOS, 'tareas', OFICINA, 'avi', AHORA).quien, nombre: '<b>x' }, proyecto: 'a&b', hace: '1 h' })
  assert.match(raro, /&lt;b&gt;x te hace una pregunta<small>a&amp;b · hace 1 h<\/small>/)
})

// ------------------------------------------------------------------ moduloAlExpandir (8)

test('moduloAlExpandir: con pregunta, Sesiones en su proyecto; sin pregunta, el módulo actual', () => {
  assert.deepEqual(moduloAlExpandir({ modulo: 'tareas', repo: OFICINA, preguntas: [{ repo: CATALOGO }] }), { modulo: 'sesiones', repo: CATALOGO })
  assert.deepEqual(moduloAlExpandir({ modulo: 'config', repo: OFICINA, preguntas: [] }), { modulo: 'config', repo: null })
  assert.deepEqual(moduloAlExpandir({ modulo: 'sesiones', repo: OFICINA }), { modulo: 'sesiones', repo: null })
  // Si el proyecto a la vista ya tiene una pregunta, se queda en él
  assert.deepEqual(moduloAlExpandir({ modulo: 'tareas', repo: CATALOGO, preguntas: [{ repo: OFICINA }, { repo: CATALOGO }] }), { modulo: 'sesiones', repo: CATALOGO })
})

// ------------------------------------------------------------------ cableado en main.js e index.html (11.1)

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

/** El cuerpo de una función de main.js (de `function nombre(` hasta la llave que la cierra en la columna 0). */
function cuerpo(nombre) {
  const desde = main.search(new RegExp(`\\n(async )?function ${nombre}\\(`))
  assert.notEqual(desde, -1, `main.js ya no declara ${nombre}`)
  return main.slice(desde, main.indexOf('\n}\n', desde) + 2)
}
/** main.js sin el cuerpo de las funciones nombradas. */
function sin(...nombres) {
  return nombres.reduce((t, n) => t.replace(cuerpo(n), ''), main)
}

test('solo irModulo cambia st.modulo, y arranca en Sesiones (3.2, D-m8)', () => {
  assert.match(main, /\n {2}modulo: 'sesiones',/)
  assert.match(cuerpo('irModulo'), /st\.modulo = /)
  assert.doesNotMatch(sin('irModulo'), /st\.modulo\s*=[^=]/)
})

test('abrir y cerrar las hojas pasa solo por irModulo: ningún otro camino deja dos hojas o ninguna (14, Risk 3)', () => {
  const resto = sin('irModulo', 'abrirConfig', 'cerrarConfig', 'abrirTareasHoja', 'cerrarTareasHoja')
  for (const f of ['abrirConfig', 'cerrarConfig', 'abrirTareasHoja', 'cerrarTareasHoja']) {
    assert.doesNotMatch(resto, new RegExp(`\\b${f}\\(`), `${f} se llama fuera de irModulo`)
  }
  // abrirConfiguracion/cerrarConfiguracion y abrirTareas/cerrarTareas (las que escriben `abierta`) solo en sus funciones
  const resto2 = sin('abrirConfig', 'cerrarConfig', 'abrirTareasHoja', 'cerrarTareasHoja', 'escTareas')
  assert.doesNotMatch(resto2, /\b(abrirConfiguracion|cerrarConfiguracion|abrirTareas|cerrarTareas)\(/)
})

test('cada camino de hoy abre su módulo por irModulo: filas, atajos, bandeja, globo de Tareas, aviso, tira, muesca y primeros pasos', () => {
  assert.match(main, /esAtajoConfiguracion\(e\)\) \{[\s\S]{0,200}irModulo\('config'\)/)
  assert.match(main, /esAtajoTareas\(e\)\) \{[\s\S]{0,200}irModulo\('tareas'\)/)
  assert.match(main, /oficina:\/\/configuracion', ev => \{ if \(ev\.payload\?\.abrir\) irModulo\('config', \{ tab: ev\.payload\.tab \}\)/)
  assert.match(main, /case 'tar-globo': if \(!justoArrastro\) await irModulo\('tareas', \{ ver: 'hoy' \}\)/)
  assert.match(main, /case 'tar-abrir': await irModulo\('tareas'\)/)
  assert.match(main, /case 'cfg-abrir': await irModulo\('config', \{ tab: b\.dataset\.tab \}\)/)
  // Los «‹ Tablero» se fueron, pero sus acciones quedan como alias de ir a Sesiones (11.1)
  assert.match(main, /case 'tar-cerrar': await irModulo\('sesiones'\)/)
  assert.match(main, /case 'cfg-cerrar': await irModulo\('sesiones'\)/)
  assert.match(main, /a === 'mod'\) \{[\s\S]{0,200}irModulo\(b\.dataset\.mod/)
  assert.match(main, /a === 'aviso-p'\) \{[\s\S]{0,300}responderDesdeAviso\(/)
  assert.match(cuerpo('responderDesdeAviso'), /st\.plegado = false[\s\S]*irModulo\('sesiones', \{ repo: p\?\.repo/)
  // Las fichas «Conversan» van a Sesiones antes de abrir la dividida; un proyecto de la barra, a Sesiones en ese proyecto
  assert.match(main, /a === 'conv'\) \{[\s\S]{0,300}irModulo\('sesiones', \{ foco: false \}\)\n {4}abrirConversacion\(/)
  assert.match(main, /if \(p && st\.modulo !== 'sesiones'\) \{\n {6}await irModulo\('sesiones', \{ repo: p\.repo, foco: false \}\)/)
  // Expandir la tira (botón y bandeja) y abrir la muesca o el panel desde la bandeja: el módulo actual o la pregunta (8)
  assert.match(cuerpo('expandir'), /abrirPanelAlModulo\(\)/)
  assert.match(main, /oficina:\/\/expandir', \(\) => expandir\(\)\)/)
  assert.match(main, /muescaEl\.addEventListener\('click', async \(\) => \{[\s\S]{0,300}abrirPanelAlModulo\(\)\n {2}evento\(\{ tipo: 'alternar' \}\)/)
  // Esc por capas: la última capa de cada hoja va a Sesiones con el foco en su fila (9.1)
  assert.match(main, /alEscModulo\('config', accion\) === 'sesiones'\) irModulo\('sesiones', \{ foco: 'fila' \}\)/)
  assert.match(cuerpo('escTareas'), /alEscModulo\('tareas', accion\) === 'sesiones'\) \{ irModulo\('sesiones', \{ foco: 'fila' \}\)/)
  assert.match(cuerpo('abrirAsistente'), /irModulo\('sesiones'/)
  assert.match(cuerpo('abrirPanelAlModulo'), /moduloAlExpandir\(/)
  assert.match(cuerpo('abrirPanelAlModulo'), /irModulo\(/)
})

test('index.html: el menú de módulos con la píldora, Tareas sube al menú, Configuración queda al pie y se van los «‹ Tablero» (3.4)', () => {
  assert.match(html, /<nav class="mods" id="mods" aria-label="Módulos">\s*<span class="ind-mod" aria-hidden="true"><\/span>/)
  assert.match(html, /<button type="button" class="mod" id="mod-sesiones" data-accion="mod" data-mod="sesiones" aria-keyshortcuts="Escape" title="Sesiones \(Esc\)"/)
  assert.match(html, /<button type="button" class="mod tar" id="tar-fila" data-accion="mod" data-mod="tareas" aria-keyshortcuts="Control\+T" title="Tareas \(Ctrl T\)"/)
  assert.match(html, /<div class="lado-cfg">\s*(<!--[\s\S]*?-->\s*)?<button type="button" class="mod engr" id="cfg-fila" data-accion="mod" data-mod="config" aria-keyshortcuts="Control\+Comma" title="Configuración \(Ctrl ,\)"/)
  // Tareas ya no está en .lado-cfg; el lugar de Hábitos queda previsto sin fila
  assert.doesNotMatch(html.slice(html.indexOf('<div class="lado-cfg">'), html.indexOf('</div>', html.indexOf('<div class="lado-cfg">'))), /tar-fila/)
  assert.doesNotMatch(html, /id="hab-fila"/)
  assert.doesNotMatch(html, /cfg-volver|tar-volver|‹ Tablero/)
  // `#volver` es la salida de la dividida: se queda
  assert.match(html, /id="volver" data-accion="volver"/)
  // #aviso-p va entre el encabezado y las hojas
  assert.match(html, /<\/header>[\s\S]*<div id="aviso-p"><\/div>[\s\S]*<div id="cfg"><\/div>/)
  // Los proyectos siguen en la barra en M1, colgados de Sesiones: entre su fila y la de Tareas (14, el paso intermedio de B)
  assert.ok(html.indexOf('id="mod-sesiones"') < html.indexOf('id="proyectos"'))
  assert.ok(html.indexOf('id="proyectos"') < html.indexOf('id="tar-fila"'))
})

// ------------------------------------------------------------------ lo de antes sigue igual (Risk 3: código compartido)

const css = readFileSync(new URL('../src/estilos.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('abrir Configuración sigue igual: lee el mod, las claves, el modelo y el historial, hace su acto y, acoplada, abre el panel con el foco en el título', () => {
  const f = cuerpo('abrirConfig')
  assert.match(f, /st\.config = \{ \.\.\.abrirConfiguracion\(st\.config, tab\), error: null \}/)
  for (const leer of ['leerEstadoMod()', 'leerClaves()', 'leerModelo()', 'leerHistorialConfig()']) assert.ok(f.includes(leer), leer)
  assert.match(f, /movimientoConfig\.abrirHoja\(/)
  assert.match(f, /if \(st\.acople\) \{\n {4}evento\(\{ tipo: 'clic' \}\)\n {4}if \(foco\) \{ st\.focoPendiente = 'cfg'; aplicarFoco\(\) \}/)
  // Ya abierta, la pestaña pedida (la bandeja con `tab`) y el foco al título: ahora lo hace irModulo
  assert.match(cuerpo('irModulo'), /if \(id === 'config' && tab && tab !== st\.config\.tab\) cambiarPestanaConfig\(tab\)/)
})

test('abrir Tareas sigue igual: el aviso diario se va, relee las listas, hace su acto y, acoplada, abre el panel', () => {
  const f = cuerpo('abrirTareasHoja')
  assert.match(f, /st\.avisoTar = soltarAviso\(st\.avisoTar\)\n {2}st\.tareas = abrirTareas\(st\.tareas, ver\)\n {2}leerTareas\(\)/)
  assert.match(f, /movimientoTareas\.abrirHoja\(\$\('#marco \.cab'\), \$\('#tar-cuerpo'\)\)/)
  assert.match(f, /if \(foco\) \{ st\.focoPendiente = 'tar'; aplicarFoco\(\) \}/)
})

test('cerrar una hoja sigue igual: guarda lo diferido de Tareas y el tablero vuelve con su acto (solo hacia Sesiones)', () => {
  assert.match(cuerpo('cerrarTareasHoja'), /diferidoTareas\.todos\(\)\n {2}st\.tareas = cerrarTareas\(st\.tareas\)/)
  for (const f of ['cerrarConfig', 'cerrarTareasHoja']) assert.match(cuerpo(f), /if \(acto\) movimientoConfig\.cerrarHoja\(\[\$\('#otro'\), \$\('#w-globo'\), \$\('#conteos'\)/, f)
  assert.match(cuerpo('irModulo'), /cerrarConfig\(\{ acto: !plan\.abrir \}\)/)
})

test('abrir una hoja sigue saliendo de la dividida y de la tira; los atajos solo con el panel a la vista', () => {
  assert.match(cuerpo('irModulo'), /if \(plan\.abrir\) \{\n {4}if \(st\.dividida\.clave\) await cerrarConversacion\(\{ descartar: true \}\)\n {4}if \(st\.mini\) await ponerMini\(false\)/)
  assert.equal((main.match(/if \(!st\.mini && \(!st\.acople \|\| st\.vista\)\) irModulo\('(config|tareas)'\)/g) ?? []).length, 2)
})

test('elegir un proyecto en Sesiones y la dividida siguen igual', () => {
  // En Sesiones, un proyecto de la barra cambia de proyecto como siempre
  assert.match(main, /\n {4}if \(p\) irAProyecto\(p\.repo, 1\)\n/)
  // En la dividida, el riel o el aviso de una pregunta salen de ella hacia ese proyecto (dividida-ux.md 5.3)
  assert.match(main, /if \(a === 'ir' && st\.dividida\.clave\) \{[\s\S]{0,400}cerrarConversacion\(\{ descartar: true, repo: p\.repo \}\)/)
  // «‹ vista anterior» (#volver) sigue saliendo de la dividida
  assert.match(main, /if \(a === 'volver'\) \{[\s\S]{0,200}cerrarConversacion\(\{ descartar: true \}\)/)
  // Una conversación nueva se abre sola solo en Sesiones; en otro módulo late su ficha (dividida.js no cambia)
  assert.match(cuerpo('aperturaSola'), /proyectoVisto: st\.modulo === 'sesiones' \? st\.repo : null/)
})

test('la muesca, primeros pasos y el Esc de Sesiones siguen igual', () => {
  // La muesca: el mismo evento `alternar` (muesca.js no cambia) y Esc la cierra fuera de la pregunta
  assert.match(main, /evento\(\{ tipo: 'alternar' \}\)/)
  assert.match(main, /if \(e\.key === 'Escape' && st\.acople && st\.muesca\.abierta\) \{ e\.preventDefault\(\); evento\(\{ tipo: 'esc' \}\); return \}/)
  // Primeros pasos: abre la hoja de pasos, revisa (solo lectura) y pinta, como siempre
  assert.match(cuerpo('abrirAsistente'), /st\.pp\.abierto = true\n {2}st\.pp\.cerrado = false[\s\S]*revisarPasos\(\)\n {2}pintar\(\)/)
  // Esc con una hoja abierta va primero a sus capas: `alEsc` y `alEscTareas`, sin cambios
  assert.match(main, /if \(e\.key === 'Escape' && st\.config\.abierta\) \{[\s\S]{0,200}const \{ config, accion \} = alEsc\(st\.config\)/)
  assert.match(cuerpo('escTareas'), /alEscTareas\(antes, campo \?/)
  // ← → no cambian de proyecto fuera de Sesiones
  assert.match(main, /if \(st\.modulo !== 'sesiones'\) return\n {2}if \(e\.key === 'ArrowLeft'\)/)
})

test('el aviso diario de Tareas sigue en la marca con una hoja abierta y sin sesiones (lugarAviso, barra)', () => {
  assert.match(main, /barra: st\.proyectos\.length > 0 \|\| st\.modulo !== 'sesiones',/)
})

test('estilos: se van las reglas de «‹ Tablero»; el menú, la píldora y #aviso-p tienen las suyas (6, 11.4)', () => {
  assert.doesNotMatch(css, /#cfg-volver|#tar-volver|\.pj\.(engr|tar)\b/)
  assert.match(css, /--alto-modulo: 40px;/)
  assert.match(css, /\.ind-mod \{[^}]*height: var\(--alto-modulo\)[^}]*overflow: hidden/)
  assert.match(css, /\.ind-mod::before \{[^}]*width: 3px; background: var\(--ambar\)/)
  assert.match(css, /#marco:not\(\.mod-sesiones\) \.mods > \.proyectos \{ display: none \}/)
  assert.match(css, /\.aviso-p \{[^}]*min-height: 46px/)
  // El latido del «1 ?» solo con movimiento y sin pausa
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n[^}]*body:not\(\.pausa\) #mod-sesiones \.chip-preg\.late \{ animation: modLate \.5s var\(--rebote\) 2 \}/)
})
