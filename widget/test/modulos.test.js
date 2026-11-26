// Tests de modulos.js y modulosVista.js (#42, docs/diseno/modulos-ux.md, entregas M1 y M2): la barra como menú
// de módulos. La lógica pura (qué módulo abrir y qué hoja cerrar, el Esc por capas, las cuentas y los
// nombres de cada fila, la pregunta vista desde otro módulo, a dónde vuelve el panel al expandirse) y,
// leyendo main.js e index.html como texto, que todos los caminos pasen por `irModulo` (11.1).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MODULOS, MODULOS_ACTIVOS, irModulo, alEscModulo, cuentaModulo, nombreModulo, avisoPregunta, moduloAlExpandir, tituloModulo,
  cuentasModulosMini, RESUMEN_MINIMO_MINI, ANCHO_CUENTA_MINI, desplazarTira,
} from '../src/modulos.js'
import { avisoPreguntaHtml, cuentasMiniHtml } from '../src/modulosVista.js'
import { agruparPorProyecto } from '../src/logica.js'
import { ladoFilaTareas } from '../src/tareasVista.js'
import { nombreFilaTareas } from '../src/tareas.js'
import { ladoFilaHabitos, cuentaMiniHabitos } from '../src/habitosVista.js'
import { ladoFilaProyectos } from '../src/proyectosVista.js'
import { nombreFilaProyectos } from '../src/proyectos.js'

const AHORA = Date.parse('2026-11-25T15:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const ses = (repo, extra = {}) => ({ sesion: `s-${repo}`, repo, usuario: 'q', inicio: hace(30), actividad: 'esperándote', agentes: [], ...extra })
const preg = (id, extra = {}) => ({ id, agente: null, desde: hace(2), items: [{ pregunta: '¿Precios?', opciones: [{ etiqueta: 'Sí' }] }], ...extra })

// ------------------------------------------------------------------ MODULOS (11.3)

test('MODULOS: Sesiones, Tareas, Hábitos, Proyectos y Configuración, en ese orden; Configuración va al pie', () => {
  assert.deepEqual(MODULOS.map(m => m.id), ['sesiones', 'tareas', 'habitos', 'proyectos', 'config'])
  assert.deepEqual(MODULOS.map(m => m.nombre), ['Sesiones', 'Tareas', 'Hábitos', 'Proyectos', 'Configuración'])
  assert.deepEqual(MODULOS.map(m => m.atajo), ['Escape', 'Control+T', 'Control+H', 'Control+P', 'Control+Comma'])
  assert.deepEqual(MODULOS.filter(m => m.pie).map(m => m.id), ['config'])
  // Hábitos (#41, H1) y Proyectos (#44, P1, proyectos-ux.md 11.7) ya se pueden abrir
  assert.deepEqual(MODULOS_ACTIVOS, ['sesiones', 'tareas', 'habitos', 'proyectos', 'config'])
})

test('tituloModulo: el title de cada fila, «{Módulo} ({atajo})» (5)', () => {
  assert.equal(tituloModulo('sesiones'), 'Sesiones (Esc)')
  assert.equal(tituloModulo('tareas'), 'Tareas (Ctrl T)')
  assert.equal(tituloModulo('habitos'), 'Hábitos (Ctrl H)')
  assert.equal(tituloModulo('proyectos'), 'Proyectos (Ctrl P)')
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

test('irModulo: un id desconocido no cambia nada; uno que no está activo, tampoco', () => {
  assert.equal(irModulo({ modulo: 'sesiones' }, 'charlas'), null)
  assert.equal(irModulo({ modulo: 'tareas' }, undefined), null)
  assert.equal(irModulo({ modulo: 'sesiones', activos: ['sesiones', 'tareas', 'habitos', 'config'] }, 'proyectos'), null)
  assert.equal(irModulo({ modulo: 'sesiones', activos: ['sesiones', 'tareas', 'config'] }, 'habitos'), null)
})

test('irModulo con Hábitos (#41): abre su hoja; desde Tareas cierra Tareas; a Sesiones la cierra; otra vez, el foco al h1', () => {
  assert.deepEqual(irModulo({ modulo: 'sesiones' }, 'habitos'), { modulo: 'habitos', cerrar: [], abrir: 'habitos', repo: null })
  assert.deepEqual(irModulo({ modulo: 'tareas' }, 'habitos'), { modulo: 'habitos', cerrar: ['tareas'], abrir: 'habitos', repo: null })
  assert.deepEqual(irModulo({ modulo: 'habitos' }, 'config'), { modulo: 'config', cerrar: ['habitos'], abrir: 'config', repo: null })
  assert.deepEqual(irModulo({ modulo: 'habitos' }, 'sesiones'), { modulo: 'sesiones', cerrar: ['habitos'], abrir: null, repo: null })
  assert.deepEqual(irModulo({ modulo: 'habitos' }, 'habitos'), { modulo: 'habitos', cerrar: [], abrir: null, repo: null, foco: 'h1' })
  // Tareas sigue igual
  assert.deepEqual(irModulo({ modulo: 'sesiones' }, 'tareas'), { modulo: 'tareas', cerrar: [], abrir: 'tareas', repo: null })
})

test('irModulo con Proyectos (#44, proyectos-ux.md 3.1): abre su hoja y cierra la que se deja, como las demás', () => {
  assert.deepEqual(irModulo({ modulo: 'sesiones' }, 'proyectos'), { modulo: 'proyectos', cerrar: [], abrir: 'proyectos', repo: null })
  assert.deepEqual(irModulo({ modulo: 'habitos' }, 'proyectos'), { modulo: 'proyectos', cerrar: ['habitos'], abrir: 'proyectos', repo: null })
  assert.deepEqual(irModulo({ modulo: 'proyectos' }, 'tareas'), { modulo: 'tareas', cerrar: ['proyectos'], abrir: 'tareas', repo: null })
  assert.deepEqual(irModulo({ modulo: 'proyectos' }, 'sesiones'), { modulo: 'sesiones', cerrar: ['proyectos'], abrir: null, repo: null })
  assert.deepEqual(irModulo({ modulo: 'proyectos' }, 'proyectos'), { modulo: 'proyectos', cerrar: [], abrir: null, repo: null, foco: 'h1' })
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
  // Hábitos (habitos-ux.md 9.1): vaciar, desarmar, cancelar el formulario y cerrar el hábito son capas; cerrar, Sesiones
  for (const capa of ['vaciar', 'desarmar', 'cancelar-nuevo', 'cerrar-habito']) assert.equal(alEscModulo('habitos', capa), 'capa', capa)
  assert.equal(alEscModulo('habitos', 'cerrar'), 'sesiones')
  // Proyectos (proyectos-ux.md 9.1, `alEscProyectos`): las tres primeras capas son del módulo; la última, Sesiones
  for (const capa of ['desarmar', 'avisar-descartar', 'descartar', 'cerrar-form']) assert.equal(alEscModulo('proyectos', capa), 'capa', capa)
  assert.equal(alEscModulo('proyectos', 'cerrar'), 'sesiones')
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
  // Con hábitos (habitos-ux.md 4.1): la misma pieza que dibuja la fila («—» o el anillo)
  assert.equal(cuentaModulo('habitos', { hechos: 0, total: 0, habitos: 2 }), ladoFilaHabitos({ hechos: 0, total: 0, habitos: 2 }))
  assert.equal(cuentaModulo('habitos', { hechos: 2, total: 5, habitos: 5 }), ladoFilaHabitos({ hechos: 2, total: 5, habitos: 5 }))
  // Proyectos (proyectos-ux.md 4.1): sin proyectos, la pista del atajo; con, la pieza de su fila
  assert.equal(cuentaModulo('proyectos', []), '<kbd aria-hidden="true">Ctrl P</kbd>')
  assert.equal(cuentaModulo('proyectos', null), '<kbd aria-hidden="true">Ctrl P</kbd>')
  const P = [{ id: 'p-a', nombre: 'A', carpeta: { estado: 'ok' } }, { id: 'p-b', nombre: 'B', carpeta: { estado: 'perdida' } }]
  assert.equal(cuentaModulo('proyectos', P), ladoFilaProyectos(P))
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
  assert.equal(nombreModulo('habitos', { hechos: 0, total: 0, habitos: 2 }), 'Hábitos, hoy no toca ninguno')
  assert.equal(nombreModulo('habitos', { hechos: 3, total: 3, habitos: 3 }), 'Hábitos, los 3 de hoy hechos')
  assert.equal(nombreModulo('proyectos', []), 'Proyectos')
  assert.equal(nombreModulo('proyectos', [{ id: 'p-a', carpeta: { estado: 'perdida' } }]), nombreFilaProyectos([{ id: 'p-a', carpeta: { estado: 'perdida' } }]))
  assert.equal(nombreModulo('proyectos', [{ id: 'p-a', carpeta: { estado: 'perdida' } }]), 'Proyectos, 1, 1 con la carpeta perdida')
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

// ------------------------------------------------------------------ cuentasModulosMini (8, M2)

const T = { hoy: 2, vencidas: 0 }
const H = { hechos: 2, total: 5 }

test('cuentasModulosMini: con lugar entran las dos; si el resumen quedaría por debajo de 120, se va Hábitos y después Tareas', () => {
  assert.equal(RESUMEN_MINIMO_MINI, 120)
  assert.deepEqual(cuentasModulosMini(T, H, 220), { tareas: true, habitos: true })
  assert.deepEqual(cuentasModulosMini(T, H, 160), { tareas: true, habitos: false })
  assert.deepEqual(cuentasModulosMini(T, H, 110), { tareas: false, habitos: false })
  // El borde: el resumen se queda con 120 justos
  const { tareas: aT, habitos: aH } = ANCHO_CUENTA_MINI
  assert.deepEqual(cuentasModulosMini(T, H, 120 + aT + aH), { tareas: true, habitos: true })
  assert.deepEqual(cuentasModulosMini(T, H, 120 + aT + aH - 1), { tareas: true, habitos: false })
  assert.deepEqual(cuentasModulosMini(T, H, 120 + aT), { tareas: true, habitos: false })
  assert.deepEqual(cuentasModulosMini(T, H, 120 + aT - 1), { tareas: false, habitos: false })
})

test('cuentasModulosMini: sin nada que contar no ocupa lugar (sin pista de atajo en la tira)', () => {
  assert.deepEqual(cuentasModulosMini({ hoy: 0, vencidas: 0 }, H, 200), { tareas: false, habitos: true })
  assert.deepEqual(cuentasModulosMini(null, null, 400), { tareas: false, habitos: false })
  // Sin cuentas de Hábitos (todavía sin leer): solo Tareas, con su propio ancho
  assert.deepEqual(cuentasModulosMini({ hoy: 0, vencidas: 1 }, null, 120 + ANCHO_CUENTA_MINI.tareas), { tareas: true, habitos: false })
  assert.deepEqual(cuentasModulosMini(T, { hechos: 0, total: 0 }, 400), { tareas: true, habitos: false })
})

test('cuentasModulosMini: la insignia de preguntas no se toca (no es parte de lo que se esconde)', () => {
  assert.deepEqual(Object.keys(cuentasModulosMini(T, H, 0)).sort(), ['habitos', 'tareas'])
})

test('cuentasMiniHtml: la cuenta chica de Tareas (la de su fila, sin la pista) con su nombre para el lector; nada si no entra', () => {
  assert.equal(cuentasMiniHtml(T, null, { tareas: false, habitos: false }), '')
  assert.equal(cuentasMiniHtml({ hoy: 0, vencidas: 0 }, null, { tareas: true, habitos: false }), '')
  assert.equal(cuentasMiniHtml(T, null, { tareas: true, habitos: false }), `${ladoFilaTareas(T)}<span class="oculto">Tareas, 2 para hoy</span>`)
  assert.equal(cuentasMiniHtml({ hoy: 1, vencidas: 2 }, null, { tareas: true, habitos: false }), '<span class="chip chip-venc" aria-hidden="true"><i></i>3</span><span class="oculto">Tareas, 1 para hoy, 2 vencidas</span>')
})

test('cuentasMiniHtml con Hábitos (#41): después de Tareas, el anillo con su nombre; nada si no entra o no hay de hoy', () => {
  const Hab = { hechos: 2, total: 5, habitos: 5 }
  assert.equal(cuentasMiniHtml(T, Hab, { tareas: true, habitos: true }), `${ladoFilaTareas(T)}<span class="oculto">Tareas, 2 para hoy</span>${cuentaMiniHabitos(Hab)}`)
  assert.equal(cuentasMiniHtml(T, Hab, { tareas: false, habitos: true }), cuentaMiniHabitos(Hab))
  assert.equal(cuentasMiniHtml(T, Hab, { tareas: true, habitos: false }), `${ladoFilaTareas(T)}<span class="oculto">Tareas, 2 para hoy</span>`)
  assert.equal(cuentasMiniHtml(null, { hechos: 0, total: 0, habitos: 2 }, { tareas: false, habitos: true }), '')
})

// ------------------------------------------------------------------ desplazarTira (4.4: el chip elegido queda a la vista)

test('desplazarTira: un chip a la vista no mueve la tira; uno escondido a la izquierda o debajo de la máscara la corre lo justo', () => {
  // Tira de 300 con 20 de máscara a la derecha
  assert.equal(desplazarTira({ izq: 40, ancho: 90 }, { scroll: 0, visible: 300 }, 20), 0)
  assert.equal(desplazarTira({ izq: 40, ancho: 90 }, { scroll: 100, visible: 300 }, 20), 40)
  assert.equal(desplazarTira({ izq: 260, ancho: 90 }, { scroll: 0, visible: 300 }, 20), 70)
  assert.equal(desplazarTira({ izq: 260, ancho: 90 }, { scroll: 80, visible: 300 }, 20), 80)
  // Más ancho que la tira: su comienzo
  assert.equal(desplazarTira({ izq: 500, ancho: 400 }, { scroll: 0, visible: 300 }, 20), 500)
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
  const resto = sin('irModulo', 'abrirConfig', 'cerrarConfig', 'abrirTareasHoja', 'cerrarTareasHoja', 'abrirHabitosHoja', 'cerrarHabitosHoja', 'abrirProyectosHoja', 'cerrarProyectosHoja')
  for (const f of ['abrirConfig', 'cerrarConfig', 'abrirTareasHoja', 'cerrarTareasHoja', 'abrirHabitosHoja', 'cerrarHabitosHoja', 'abrirProyectosHoja', 'cerrarProyectosHoja']) {
    assert.doesNotMatch(resto, new RegExp(`\\b${f}\\(`), `${f} se llama fuera de irModulo`)
  }
  // abrirConfiguracion/cerrarConfiguracion y abrirTareas/cerrarTareas (las que escriben `abierta`) solo en sus funciones
  const resto2 = sin('abrirConfig', 'cerrarConfig', 'abrirTareasHoja', 'cerrarTareasHoja', 'escTareas', 'abrirHabitosHoja', 'cerrarHabitosHoja', 'abrirProyectosHoja', 'cerrarProyectosHoja')
  assert.doesNotMatch(resto2, /\b(abrirConfiguracion|cerrarConfiguracion|abrirTareas|cerrarTareas|abrirHabitos|cerrarHabitos|abrirProyectos|cerrarProyectos)\(/)
  // irModulo cierra y abre Hábitos como las demás hojas
  assert.match(cuerpo('irModulo'), /else if \(h === 'habitos'\) cerrarHabitosHoja\(\{ acto: !plan\.abrir \}\)/)
  assert.match(cuerpo('irModulo'), /else if \(plan\.abrir === 'habitos'\) abrirHabitosHoja\(\{ ver, foco: enfocarTitulo \}\)/)
  // Proyectos (#44, proyectos-ux.md 3.1): igual, con el proyecto pedido; el mismo módulo con otro proyecto lo elige
  assert.match(cuerpo('irModulo'), /else if \(h === 'proyectos'\) cerrarProyectosHoja\(\{ acto: !plan\.abrir \}\)/)
  assert.match(cuerpo('irModulo'), /else if \(plan\.abrir === 'proyectos'\) abrirProyectosHoja\(\{ proyecto, foco: enfocarTitulo \}\)/)
  assert.match(cuerpo('irModulo'), /if \(id === 'proyectos' && proyecto\) elegirEnHoja\(proyecto\)/)
})

test('cada camino de hoy abre su módulo por irModulo: filas, atajos, bandeja, globo de Tareas, aviso, tira, muesca y primeros pasos', () => {
  assert.match(main, /esAtajoConfiguracion\(e\)\) \{[\s\S]{0,200}irModulo\('config'\)/)
  assert.match(main, /esAtajoTareas\(e\)\) \{[\s\S]{0,200}irModulo\('tareas'\)/)
  assert.match(main, /esAtajoHabitos\(e\)\) \{[\s\S]{0,200}irModulo\('habitos'\)/)
  // Ctrl P (proyectos-ux.md 9.2, D-p16): el preventDefault va primero, para frenar el diálogo de imprimir de WebView2
  assert.match(main, /if \(esAtajoProyectos\(e\)\) \{\n {4}e\.preventDefault\(\)\n[\s\S]{0,120}irModulo\('proyectos'\)/)
  assert.match(cuerpo('escProyectos'), /alEscModulo\('proyectos', accion\) === 'sesiones'\) \{ irModulo\('sesiones', \{ foco: 'fila' \}\)/)
  assert.match(cuerpo('escHabitos'), /alEscModulo\('habitos', accion\) === 'sesiones'\) \{ irModulo\('sesiones', \{ foco: 'fila' \}\)/)
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
  // Tareas ya no está en .lado-cfg; Hábitos (#41) va en el menú, después de Tareas
  assert.doesNotMatch(html.slice(html.indexOf('<div class="lado-cfg">'), html.indexOf('</div>', html.indexOf('<div class="lado-cfg">'))), /tar-fila|hab-fila/)
  assert.match(html, /<button type="button" class="mod hab" id="hab-fila" data-accion="mod" data-mod="habitos" aria-keyshortcuts="Control\+H" title="Hábitos \(Ctrl H\)" aria-label="Hábitos">/)
  assert.ok(html.indexOf('id="tar-fila"') < html.indexOf('id="hab-fila"') && html.indexOf('id="hab-fila"') < html.indexOf('</nav>', html.indexOf('<nav class="mods"')))
  assert.match(html, /<path class="arco" d="M13\.2 8\.6A5\.2 5\.2 0 1 1 11\.6 4\.2"\/><path d="M12\.2 1\.8v2\.8H9\.4"\/>/)
  // La hoja #hab es hermana de #cfg y #tar; la mascota de 40 junto al título
  assert.match(html, /<div id="tar"><\/div>[\s\S]*<div id="hab"><\/div>/)
  assert.match(html, /<span class="hab-mini" id="hab-mini" aria-hidden="true"><\/span>/)
  assert.doesNotMatch(html, /cfg-volver|tar-volver|‹ Tablero/)
  // `#volver` es la salida de la dividida: se queda
  assert.match(html, /id="volver" data-accion="volver"/)
  // #aviso-p va entre el encabezado y las hojas
  assert.match(html, /<\/header>[\s\S]*<div id="aviso-p"><\/div>[\s\S]*<div id="cfg"><\/div>/)
  // M2: en el menú quedan solo las filas de los módulos; los repos ya no cuelgan de Sesiones (la única
  // mención de «proyectos» es el módulo #44)
  const menu = html.slice(html.indexOf('<nav class="mods"'), html.indexOf('</nav>', html.indexOf('<nav class="mods"')))
  assert.doesNotMatch(menu, /data-proy|id="proyectos"/)
  // Proyectos (#44, proyectos-ux.md 3.3 y 4.1): la cuarta fila, después de Hábitos; su hoja #pro, hermana de las otras
  assert.match(html, /<button type="button" class="mod pro" id="pro-fila" data-accion="mod" data-mod="proyectos" aria-keyshortcuts="Control\+P" title="Proyectos \(Ctrl P\)" aria-label="Proyectos">/)
  assert.ok(html.indexOf('id="hab-fila"') < html.indexOf('id="pro-fila"') && html.indexOf('id="pro-fila"') < html.indexOf('</nav>', html.indexOf('<nav class="mods"')))
  assert.match(html, /<div id="hab"><\/div>[\s\S]*<div id="pro"><\/div>/)
})

test('index.html (M2, 3.4 y 4.4): la tira de repos en la columna, entre las hojas y #otro, y fuera de la barra', () => {
  assert.doesNotMatch(html, /id="proyectos"|class="proyectos"|id="h-proyectos"/)
  assert.match(html, /<nav class="repos" id="repos" aria-label="Repos"><\/nav>/)
  const lado = html.slice(html.indexOf('<aside class="lado">'), html.indexOf('</aside>'))
  assert.doesNotMatch(lado, /id="repos"/)
  assert.ok(html.indexOf('<main class="principal">') < html.indexOf('id="repos"'))
  assert.ok(html.indexOf('<div id="tar"></div>') < html.indexOf('id="repos"'))
  assert.ok(html.indexOf('id="repos"') < html.indexOf('<div id="otro"></div>'))
  // La tira mini: las cuentas de los módulos van después de la insignia de preguntas (8)
  assert.match(html, /<span id="tira-pend"><\/span>\s*(<!--[\s\S]*?-->\s*)?<span class="tira-mods" id="tira-mods"><\/span>/)
})

test('la tira de repos se dibuja solo en Sesiones; las hojas, el vacío, la carga y primeros pasos no la tocan', () => {
  assert.doesNotMatch(main, /barraProyectos|#proyectos/)
  // En Sesiones, el elegido; el redibujo no se lleva el foco (9.4)
  assert.match(cuerpo('pintar'), /const enfocado = document\.activeElement\?\.closest\?\.\('#repos \[data-proy\]'\)\n {2}if \(poner\('#repos', tiraRepos\(st\.proyectos, i\)\) && enfocado\) \{/)
  assert.match(cuerpo('pintar'), /\$\(`#repos \[data-proy="\$\{enfocado\.dataset\.proy\}"\]`\)\?\.focus\(\)/)
  // Vacío, cargando y el escenario de primeros pasos la vacían, como antes la barra
  assert.equal((cuerpo('pintar').match(/poner\('#repos', ''\); poner\('#otro', ''\); poner\('#w-globo', ''\); poner\('#conteos', ''\); poner\('#sesiones', ''\)/g) ?? []).length, 2)
  for (const f of ['pintarHojaConfiguracion', 'pintarHojaTareas']) assert.doesNotMatch(cuerpo(f), /#repos|tiraRepos/, f)
})

test('el encabezado de Sesiones (M2): h1 «Sesiones», title el repositorio y la bajada con el proyecto; vacío, carga y primeros pasos como antes', () => {
  const f = cuerpo('pintar')
  assert.match(f, /const cab = encabezadoSesiones\(proyecto, preparadas, c\)\n {2}texto\('#titulo', cab\.titulo\)\n {2}\$\('#titulo'\)\.title = cab\.title\n {2}texto\('#subtitulo', cab\.subtitulo\)/)
  assert.doesNotMatch(f, /texto\('#titulo', proyecto\.nombre\)/)
  assert.match(f, /texto\('#titulo', 'Primeros pasos'\)\n {4}texto\('#subtitulo', ''\)/)
  assert.match(f, /texto\('#titulo', cargando \? 'Buscando sesiones…' : 'No hay sesiones de Claude Code abiertas\.'\)/)
  assert.match(f, /texto\('#subtitulo', cargando \? '' : 'Cuando abras una, aparece acá con sus subagentes\.'\)/)
  // Las hojas siguen poniendo su propio título
  assert.match(cuerpo('pintarHojaConfiguracion'), /texto\('#titulo', 'Configuración'\)/)
  assert.match(cuerpo('pintarHojaTareas'), /texto\('#titulo', 'Tareas'\)/)
})

test('elegir un repo de la tira: el mismo manejador de siempre, el chip queda a la vista y el foco se queda en él (4.4, 9.4)', () => {
  // El manejador de data-accion="ir" no cambia: en Sesiones, irAProyecto; desde otro módulo, irModulo con el repo
  assert.match(main, /\n {4}if \(p\) irAProyecto\(p\.repo, 1\)\n/)
  assert.match(main, /if \(p && st\.modulo !== 'sesiones'\) \{\n {6}await irModulo\('sesiones', \{ repo: p\.repo, foco: false \}\)\n {6}\$\(`#repos \[data-proy="\$\{b\.dataset\.proy\}"\]`\)\?\.focus\(\)/)
  // Cambiar de proyecto (tira, ← →, aviso, riel) corre la tira hasta el elegido
  assert.match(cuerpo('irAProyecto'), /verRepoElegido\(\)/)
  assert.match(cuerpo('verRepoElegido'), /desplazarTira\(/)
})

test('← → siguen cambiando de proyecto en Sesiones; con el foco en la tira, el foco sigue al elegido; ↑ ↓ siguen moviendo el foco', () => {
  assert.match(main, /if \(st\.modulo !== 'sesiones'\) return\n {2}if \(e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowRight'\) \{/)
  assert.match(main, /moverProyecto\(e\.key === 'ArrowLeft' \? -1 : 1\)\n {4}if \(enTira\) \$\('#repos \[aria-current\]'\)\?\.focus\(\)/)
  assert.match(main, /const fila = e\.target\.closest\?\.\('#repos \[data-proy\]'\)\n {2}if \(fila && \(e\.key === 'ArrowUp' \|\| e\.key === 'ArrowDown'\)\)/)
  // moverProyecto no cambia: el siguiente o el anterior, en ronda
  assert.match(cuerpo('moverProyecto'), /irAProyecto\(st\.proyectos\[\(i \+ dir \+ n\) % n\]\.repo, dir\)/)
})

test('el foco que se queda sin lugar vuelve al repo elegido: tras cerrar una sesión, al salir de la dividida y por defecto', () => {
  assert.match(cuerpo('trasCierre'), /\|\| \$\('#repos \[aria-current\]'\)/)
  assert.match(main, /if \(focoAdentro\) \$\('#repos \[aria-current\]'\)\?\.focus\(\)/)
  assert.match(cuerpo('aplicarFoco'), /else \(\$\('#repos \[aria-current\]'\) \?\? \$\('#repos \[data-proy\]'\) \?\? \$\('#marco \[data-accion="pin"\]'\)\)\?\.focus\(\)/)
})

test('la tira mini (8, M2): caras, resumen e insignia como siempre; después, las cuentas de los módulos que entran', () => {
  const f = cuerpo('pintarTira')
  assert.match(f, /const r = resumenMini\(st\.proyectos, ahora, st\.mascota\)/)
  assert.match(f, /poner\('#tira-pend', insignia\(r\.pendientes\)\)/)
  assert.match(f, /cuentasModulosMini\(/)
  assert.match(f, /poner\('#tira-mods', cuentasMiniHtml\(/)
  // Hábitos suma su cuenta (#41): la de hoy, ya leída
  assert.match(f, /const habitos = st\.habitos\.leido \? cuentasHoy\(st\.habitos\.lista, hoyHabitos\(\)\) : null/)
  assert.match(f, /cuentasMiniHtml\(tareas, habitos, cuentasModulosMini\(tareas, habitos, libre\)\)/)
  // La insignia se pone antes y sin condición: nunca se esconde
  assert.ok(f.indexOf("poner('#tira-pend'") < f.indexOf('cuentasModulosMini('))
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
  assert.equal((main.match(/if \(!st\.mini && \(!st\.acople \|\| st\.vista\)\) irModulo\('(config|tareas|habitos)'\)/g) ?? []).length, 3)
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
  assert.match(main, /if \(st\.modulo !== 'sesiones'\) return\n {2}if \(e\.key === 'ArrowLeft' \|\| e\.key === 'ArrowRight'\)/)
})

test('el aviso diario de Tareas sigue en la marca con una hoja abierta y sin sesiones (lugarAviso, barra)', () => {
  assert.match(main, /barra: st\.proyectos\.length > 0 \|\| st\.modulo !== 'sesiones',/)
})

test('estilos: se van las reglas de «‹ Tablero»; el menú, la píldora y #aviso-p tienen las suyas (6, 11.4)', () => {
  assert.doesNotMatch(css, /#cfg-volver|#tar-volver|\.pj\.(engr|tar)\b/)
  assert.match(css, /--alto-modulo: 40px;/)
  assert.match(css, /\.ind-mod \{[^}]*height: var\(--alto-modulo\)[^}]*overflow: hidden/)
  assert.match(css, /\.ind-mod::before \{[^}]*width: 3px; background: var\(--ambar\)/)
  assert.match(css, /\.aviso-p \{[^}]*min-height: 46px/)
  // El latido del «1 ?» solo con movimiento y sin pausa
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\n[^}]*body:not\(\.pausa\) #mod-sesiones \.chip-preg\.late \{ animation: modLate \.5s var\(--rebote\) 2 \}/)
})

test('estilos (M2): la tira de repos (4.4) y sus chips; la píldora ya no se apaga en Sesiones (4.3); se van las reglas de la barra de proyectos', () => {
  assert.doesNotMatch(css, /\.pj \{|\.pj\.activo|\.pj-n|\.mods > \.proyectos|#proyectos/)
  // La píldora se apaga solo con Configuración (no baja hasta .lado-cfg)
  assert.match(css, /#marco\.mod-config \.ind-mod \{ opacity: 0 \}/)
  assert.doesNotMatch(css, /#marco\.mod-sesiones \.ind-mod|#marco\.mod-sesiones #mod-sesiones/)
  // Una sola fila con scroll horizontal sin barra y la máscara a la derecha; solo en Sesiones
  assert.match(css, /\.repos \{[^}]*display: flex;[^}]*gap: 6px;[^}]*overflow-x: auto;[^}]*scrollbar-width: none;[^}]*linear-gradient\(90deg, #000 88%, transparent\)/)
  assert.match(css, /#repos:empty, #marco:not\(\.mod-sesiones\) #repos, #marco\.dividida #repos, #marco\.vacio #repos, #marco\.cargando #repos, #marco\.escenario #repos \{ display: none \}/)
  // El chip: alto 32, píldora, borde --linea; elegido en crema con texto --tinta y el contorno del foco en --tinta (12)
  assert.match(css, /\.rch \{[^}]*min-height: 32px;[^}]*border: 1px solid var\(--linea\);[^}]*border-radius: var\(--r-pildora\)/)
  assert.match(css, /\.rch\[aria-current="true"\] \{ background: var\(--crema\); color: var\(--tinta\); border-color: var\(--crema\) \}/)
  assert.match(css, /\.rch\[aria-current="true"\] \.chip:not\(\.chip-preg\) \{ background: rgba\(20, 17, 12, \.12\); color: var\(--tinta\) \}/)
  assert.match(css, /\.rch\[aria-current="true"\]:focus-visible \{ outline-color: var\(--tinta\) \}/)
  // La tira mini: la insignia de preguntas no se achica; las cuentas tampoco (se esconden enteras)
  assert.match(css, /\.pend \{ flex: none;/)
  assert.match(css, /\.tira-mods \{[^}]*flex: none/)
})
