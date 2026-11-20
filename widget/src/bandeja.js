// Ícono de la bandeja: la cabeza pixel de Claude con la cuenta de preguntas en una insignia ámbar.
// Arma los bytes RGBA a mano (sin canvas), así se prueba con node y se le pasa tal cual a Tauri.

import { pixeles, P } from './mascotas.js'

export const LADO = 32
/** Cada celda de la mascota ocupa 2×2 píxeles; se recortan 16×16 celdas: antena y cabeza. */
const ESCALA = 2
const ORIGEN = { x: 4, y: 5 }

/** Dígitos de 3×5 para la insignia. */
const DIGITOS = {
  0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XXX', '..X', 'XXX', 'X..', 'XXX'],
  3: ['XXX', '..X', '.XX', '..X', 'XXX'], 4: ['X.X', 'X.X', 'XXX', '..X', '..X'], 5: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  6: ['XXX', 'X..', 'XXX', 'X.X', 'XXX'], 7: ['XXX', '..X', '.X.', '.X.', '.X.'], 8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'], '+': ['...', '.X.', 'XXX', '.X.', '...'],
}

export function textoInsignia(n) {
  if (!n || n < 1) return ''
  return n > 9 ? '9+' : String(n)
}

function rgba(color) {
  if (color.startsWith('rgba')) {
    const [r, g, b, a] = color.match(/[\d.]+/g).map(Number)
    return [r, g, b, Math.round(a * 255)]
  }
  const h = color.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(255)
}

/** Ícono de LADO×LADO con la cuenta de preguntas pendientes (0: sin insignia). */
export function iconoBandeja(pendientes) {
  const datos = new Uint8Array(LADO * LADO * 4)
  const poner = (x, y, c) => {
    if (x < 0 || y < 0 || x >= LADO || y >= LADO) return
    datos.set(c, (y * LADO + x) * 4)
  }
  const animo = pendientes ? 'teEspera' : 'esperando'
  const cuadro = pendientes ? { p: 'S', o: 'o', m: 'D' } : { p: 'S', o: 'u' }
  for (const [k, color] of pixeles(cuadro, P.crema, 'antena', animo)) {
    const [cx, cy] = k.split(',').map(Number)
    const c = rgba(color)
    if (c[3] < 255) continue
    for (let dy = 0; dy < ESCALA; dy++) for (let dx = 0; dx < ESCALA; dx++) poner((cx - ORIGEN.x) * ESCALA + dx, (cy - ORIGEN.y) * ESCALA + dy, c)
  }
  const texto = textoInsignia(pendientes)
  if (texto) {
    const ancho = texto.length === 1 ? 14 : 20, alto = 14
    const x0 = LADO - ancho, y0 = LADO - alto
    const ambar = rgba(P.amarillo), tinta = rgba(P.negro)
    // Pastilla ámbar con borde oscuro y esquinas recortadas
    for (let y = y0; y < LADO; y++) {
      for (let x = x0; x < LADO; x++) {
        const esquina = (x === x0 || x === LADO - 1) && (y === y0 || y === LADO - 1)
        if (esquina) continue
        const borde = x === x0 || x === LADO - 1 || y === y0 || y === LADO - 1
        poner(x, y, borde ? tinta : ambar)
      }
    }
    // Dígitos de 3×5 al doble en vertical (3×10 → 3 de ancho para que entren dos)
    let x = x0 + Math.floor((ancho - (texto.length * 4 - 1)) / 2)
    const y = y0 + 2
    for (const ch of texto) {
      DIGITOS[ch].forEach((fila, j) => [...fila].forEach((v, i) => {
        if (v === 'X') { poner(x + i, y + j * 2, tinta); poner(x + i, y + j * 2 + 1, tinta) }
      }))
      x += 4
    }
  }
  return { ancho: LADO, alto: LADO, rgba: datos }
}
