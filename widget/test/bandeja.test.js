// Tests del ícono de la bandeja: la cabeza de Claude con la cuenta de preguntas en ámbar.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { iconoBandeja, textoInsignia, LADO } from '../src/bandeja.js'

const pixel = (ic, x, y) => Array.from(ic.rgba.slice((y * ic.ancho + x) * 4, (y * ic.ancho + x) * 4 + 4))
const AMBAR = [0xF2, 0xB6, 0x32, 255]
const contar = (ic, color, x0, y0, x1, y1) => {
  let n = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (pixel(ic, x, y).join() === color.join()) n++
  return n
}

test('texto de la insignia', () => {
  assert.equal(textoInsignia(0), '')
  assert.equal(textoInsignia(3), '3')
  assert.equal(textoInsignia(9), '9')
  assert.equal(textoInsignia(12), '9+')
})

test('el ícono es un cuadrado RGBA con la cabeza de Claude', () => {
  const ic = iconoBandeja(0)
  assert.equal(ic.ancho, LADO)
  assert.equal(ic.alto, LADO)
  assert.equal(ic.rgba.length, LADO * LADO * 4)
  // Cara crema en el centro y esquinas transparentes
  assert.deepEqual(pixel(ic, LADO / 2, LADO / 2 - 4), [0xF3, 0xEB, 0xD8, 255])
  assert.equal(pixel(ic, 0, 0)[3], 0)
})

test('sin preguntas no hay insignia; con preguntas, insignia ámbar abajo a la derecha con el número', () => {
  const sin = iconoBandeja(0), con = iconoBandeja(3)
  const h = LADO / 2
  const ambarSin = contar(sin, AMBAR, h, h, LADO, LADO)
  const ambarCon = contar(con, AMBAR, h, h, LADO, LADO)
  assert.ok(ambarCon > ambarSin + 60, `ámbar con insignia: ${ambarCon}, sin: ${ambarSin}`)
  assert.ok(contar(con, [0x0B, 0x0D, 0x12, 255], h, h, LADO, LADO) >= 8, 'el número se dibuja en oscuro')
  assert.notDeepEqual(Array.from(iconoBandeja(3).rgba), Array.from(iconoBandeja(4).rgba))
})
