// Tests de la carpeta de los proyectos de la barra en la charla (docs/diseno/chat-avis-ux.md 3.4, entrega 7):
// el mod deja `cwd` en el archivo local de cada sesión y el menú de carpeta lo ofrece. Funciones puras
// de logica.js, chat.js y chatVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPorProyecto } from '../src/logica.js'
import { chatInicial, carpetasDeProyectos } from '../src/chat.js'
import { menuCarpeta } from '../src/chatVista.js'

const CATALOGO = 'C:\\Users\\quintana\\Desktop\\catalogo'
const AHORA = '2026-11-24T15:00:00.000Z'

/** Una sesión como la devuelve `leer_sesiones` (el archivo local tal cual). */
const sesion = (id, repo, extra = {}) => ({
  v: 1, sesion: id, usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando', repo, rama: 'main', tarea: null,
  nota: null, inicio: AHORA, tareaDesde: null, actualizado: AHORA, archivos: [], cerrada: false, ...extra,
})

const modelo = (proyectos, recientes = []) => ({
  chat: { ...chatInicial(), abierta: true, menu: true, recientes, conversacion: { id: 'c-1', motor: 'claude', carpeta: null, mensajes: [] } },
  especie: 'ascua', ahoraMs: Date.parse(AHORA), puedeAdjuntar: true, proyectos,
})

test('una sesión abierta en catalogo da "catalogo" con su carpeta', () => {
  const proyectos = agruparPorProyecto([sesion('s-1', 'quintechlab/catalogo', { cwd: CATALOGO })])
  assert.deepEqual(carpetasDeProyectos(proyectos), [{ nombre: 'catalogo', cwd: CATALOGO }])
})

test('una sesión del mod anterior (sin cwd) se sigue leyendo y no suma carpeta', () => {
  const proyectos = agruparPorProyecto([sesion('s-1', 'quintechlab/catalogo'), sesion('s-2', 'quintechlab/oficina', { cwd: '' })])
  assert.deepEqual(proyectos.map(p => p.nombre), ['catalogo', 'oficina'])
  assert.deepEqual(carpetasDeProyectos(proyectos), [])
})

test('dos sesiones en la misma carpeta son un solo proyecto; en carpetas distintas, uno por carpeta', () => {
  const proyectos = agruparPorProyecto([
    sesion('s-1', 'quintechlab/catalogo', { cwd: CATALOGO }),
    sesion('s-2', 'quintechlab/catalogo', { cwd: CATALOGO }),
    sesion('s-3', 'quintechlab/oficina', { cwd: 'C:\\tmp\\oficina-22' }),
  ])
  assert.deepEqual(carpetasDeProyectos(proyectos), [
    { nombre: 'catalogo', cwd: CATALOGO },
    { nombre: 'oficina', cwd: 'C:\\tmp\\oficina-22' },
  ])
})

test('el menú muestra "catalogo" con su carpeta bajo "Proyectos de la barra", y elegirlo manda esa carpeta', () => {
  const proyectos = carpetasDeProyectos(agruparPorProyecto([sesion('s-1', 'quintechlab/catalogo', { cwd: CATALOGO })]))
  const menu = menuCarpeta(modelo(proyectos))
  assert.match(menu, /Proyectos de la barra/)
  assert.match(menu, /data-accion="ch-carpeta" data-carpeta="C:\\Users\\quintana\\Desktop\\catalogo">.*<b>catalogo<\/b><small>C:\\Users\\quintana\\Desktop\\catalogo<\/small>/)
  // El orden de 3.4: Solo Avis, los proyectos, las recientes y "Elegir otra carpeta…"
  const orden = ['Solo Avis', 'Proyectos de la barra', '<b>catalogo</b>', 'Elegir otra carpeta'].map(t => menu.indexOf(t))
  assert.ok(orden.every((i, n) => i >= 0 && (n === 0 || i > orden[n - 1])))
})

test('sin proyectos con carpeta, el menú queda como antes: Solo Avis, las recientes y "Elegir otra carpeta…"', () => {
  const menu = menuCarpeta(modelo([], ['C:\\Users\\x\\Downloads']))
  assert.ok(!menu.includes('Proyectos de la barra'))
  assert.match(menu, /Solo Avis/)
  assert.match(menu, /Recientes/)
  assert.match(menu, /＋ Elegir otra carpeta…/)
})

test('una reciente que ya es un proyecto de la barra no se repite', () => {
  const menu = menuCarpeta(modelo([{ nombre: 'catalogo', cwd: CATALOGO }], [CATALOGO, 'C:\\Users\\x\\Downloads']))
  assert.equal(menu.split(`data-carpeta="${CATALOGO}"`).length - 1, 1)
  assert.match(menu, /Downloads/)
})
