// El estado de la ventana (`st` en main.js): una clave repetida en el literal hace que la última
// pise a la primera sin aviso. Pasó con `historial` ("Qué hizo" de #25 y el historial del chat de
// #23): al cerrar "Qué hizo" quedaba en null y la configuración dejaba de dibujarse.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

/** Las claves de primer nivel del literal `const st = { … }` (dos espacios de sangría). */
function clavesDeSt(texto) {
  const desde = texto.indexOf('\nconst st = {\n')
  assert.notEqual(desde, -1, 'main.js ya no declara `const st = {`')
  const hasta = texto.indexOf('\n}\n', desde)
  return [...texto.slice(desde, hasta).matchAll(/^ {2}([A-Za-z_$][\w$]*)\s*:/gm)].map(m => m[1])
}

test('el estado de la ventana no repite ninguna clave', () => {
  const claves = clavesDeSt(main)
  assert.ok(claves.length > 20, 'no se encontraron las claves de st')
  const repetidas = claves.filter((c, i) => claves.indexOf(c) !== i)
  assert.deepEqual(repetidas, [])
})

test('"Qué hizo" y el historial del chat de la configuración usan claves distintas', () => {
  const claves = clavesDeSt(main)
  assert.ok(claves.includes('historial'), '"Qué hizo" (#25) sigue en st.historial')
  assert.ok(claves.includes('historialChat'), 'el historial del chat (#23) va en st.historialChat')
  assert.match(main, /textoHistorial\(st\.historialChat\)/)
  assert.doesNotMatch(main, /textoHistorial\(st\.historial\)/)
})
