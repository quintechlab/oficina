// Tests del ícono (boceto iconos.html, opción B "Ficha ámbar"): ficha ámbar redondeada, cabeza
// crema contorneada, foco rosa; la cuenta de preguntas es una pastilla oscura con número ámbar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iconoBandeja, textoInsignia, grillaFicha, LADO } from '../src/bandeja.js'

const pixel = (ic, x, y) => Array.from(ic.rgba.slice((y * ic.ancho + x) * 4, (y * ic.ancho + x) * 4 + 4))
/** Color de una celda de la grilla de 16 (cada celda ocupa 2×2 en el ícono de 32). */
const celda = (ic, cx, cy) => pixel(ic, cx * 2, cy * 2)
const AMBAR = [0xF2, 0xB6, 0x32, 255]
const TINTA = [0x1A, 0x15, 0x30, 255]
const CREMA = [0xF3, 0xEB, 0xD8, 255]
const ROSA = [0xE7, 0x8F, 0xB3, 255]

test('texto de la insignia: un dígito, o "+" si pasa de 9', () => {
  assert.equal(textoInsignia(0), '')
  assert.equal(textoInsignia(3), '3')
  assert.equal(textoInsignia(9), '9')
  assert.equal(textoInsignia(12), '+')
})

test('la grilla es de 16×16 y con esquinas redondeadas', () => {
  const g = grillaFicha(0)
  assert.equal(g.length, 16)
  assert.ok(g.every(f => f.length === 16))
  assert.equal(g[0][0], null)
  assert.equal(g[15][15], null)
})

test('sin preguntas: ficha ámbar, cabeza crema contorneada y foco rosa', () => {
  const ic = iconoBandeja(0)
  assert.equal(ic.ancho, LADO)
  assert.equal(ic.alto, LADO)
  assert.equal(LADO, 32)
  assert.equal(ic.rgba.length, LADO * LADO * 4)
  assert.equal(pixel(ic, 0, 0)[3], 0, 'esquina transparente')
  assert.deepEqual(celda(ic, 14, 8), AMBAR, 'fondo ámbar al costado de la cabeza')
  assert.deepEqual(celda(ic, 2, 8), TINTA, 'contorno de la cabeza')
  assert.deepEqual(celda(ic, 7, 12), CREMA, 'cara crema')
  assert.deepEqual(celda(ic, 8, 1), ROSA, 'foco rosa')
  // Sin insignia, la esquina de abajo a la derecha sigue siendo la ficha
  assert.deepEqual(celda(ic, 13, 13), AMBAR)
})

test('con preguntas: pastilla oscura abajo a la derecha con el número en ámbar', () => {
  const ic = iconoBandeja(2)
  assert.deepEqual(celda(ic, 10, 13), TINTA, 'fondo oscuro de la pastilla')
  assert.deepEqual(celda(ic, 9, 12), CREMA, 'borde crema de la pastilla')
  // El "2" del boceto: fila de arriba entera en ámbar
  assert.deepEqual([11, 12, 13].map(x => celda(ic, x, 10)), [AMBAR, AMBAR, AMBAR])
  assert.notDeepEqual(Array.from(iconoBandeja(3).rgba), Array.from(iconoBandeja(4).rgba))
  assert.notDeepEqual(Array.from(iconoBandeja(9).rgba), Array.from(iconoBandeja(10).rgba))
})
