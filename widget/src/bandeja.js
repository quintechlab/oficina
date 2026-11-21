// Ícono de Avis (boceto docs/diseno/bocetos/iconos.html, opción B "Ficha ámbar"): ficha ámbar
// redondeada con luz arriba a la izquierda, cabeza crema contorneada y foco rosa. La cuenta de
// preguntas pendientes es una pastilla oscura con el número en ámbar. Grilla de 16×16: la bandeja
// la dibuja a 2 px por celda (32×32) y scripts/icono.mjs la agranda para los íconos de la app.
// Arma los bytes RGBA a mano (sin canvas), así se prueba con node y se le pasa tal cual a Tauri.

export const LADO = 32
const N = 16
const ESCALA = LADO / N

/** Paleta de la grilla (la misma del boceto). */
export const PALETA = { k: '#1A1530', c: '#F3EBD8', s: '#CDBF9F', h: '#FFFFFF', w: '#FFFFFF', p: '#FF8FB1', a: '#F2B632', A: '#B98418', y: '#FFE3A0', r: '#E78FB3', R: '#B9567F' }

/** Dígitos de 3×5 para la insignia; más de 9 se muestra "+". */
const DIGITOS = {
  0: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], 1: ['.X.', 'XX.', '.X.', '.X.', 'XXX'], 2: ['XXX', '..X', 'XXX', 'X..', 'XXX'],
  3: ['XXX', '..X', '.XX', '..X', 'XXX'], 4: ['X.X', 'X.X', 'XXX', '..X', '..X'], 5: ['XXX', 'X..', 'XXX', '..X', 'XXX'],
  6: ['XXX', 'X..', 'XXX', 'X.X', 'XXX'], 7: ['XXX', '..X', '.X.', '.X.', '.X.'], 8: ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
  9: ['XXX', 'X.X', 'XXX', '..X', 'XXX'], '+': ['...', '.X.', 'XXX', '.X.', '...'],
}

export function textoInsignia(n) {
  if (!n || n < 1) return ''
  return n > 9 ? '+' : String(n)
}

const grilla = () => Array.from({ length: N }, () => Array(N).fill(null))
const pon = (g, x, y, c) => { if (y >= 0 && y < N && x >= 0 && x < N) g[y][x] = c }

/** Cabeza de Claude: caja con contorno (L..R, T..B), esquinas redondeadas, ojos chicos con brillo. */
function cabeza(g, { L, R, T, B }) {
  const ins = r => { const d = Math.min(r - T, B - r); return d === 0 ? 3 : d === 1 ? 2 : d === 2 ? 1 : 0 }
  for (let y = T; y <= B; y++) {
    const i = ins(y)
    if (y === T || y === B) { for (let x = L + i; x <= R - i; x++) pon(g, x, y, 'k'); continue }
    pon(g, L + i, y, 'k'); pon(g, R - i, y, 'k')
    for (let x = L + i + 1; x < R - i; x++) pon(g, x, y, (x === R - i - 1 || y === B - 1) ? 's' : 'c')
  }
  pon(g, L + 4, T + 1, 'h'); pon(g, L + 5, T + 1, 'h'); pon(g, L + 3, T + 2, 'h')
  const mid = (L + R + 1) / 2, ey = T + 3, m = x => L + R - x
  for (let v = 0; v < 3; v++) for (let u = 0; u < 2; u++) { pon(g, mid - 4 + u, ey + v, 'k'); pon(g, m(mid - 4 + u), ey + v, 'k') }
  pon(g, mid - 4, ey, 'w'); pon(g, m(mid - 3), ey, 'w')
  const by = ey + 3, bx = mid - 5
  pon(g, bx, by, 'p'); pon(g, bx + 1, by, 'p'); pon(g, m(bx), by, 'p'); pon(g, m(bx + 1), by, 'p')
  pon(g, mid - 2, by, 'k'); pon(g, mid + 1, by, 'k'); pon(g, mid - 1, by + 1, 'k'); pon(g, mid, by + 1, 'k')
}

function foco(g, luz, base, sombra) {
  pon(g, 7, 0, 'k'); pon(g, 8, 0, 'k'); pon(g, 6, 1, 'k'); pon(g, 7, 1, luz); pon(g, 8, 1, base); pon(g, 9, 1, 'k')
  pon(g, 6, 2, 'k'); pon(g, 7, 2, base); pon(g, 8, 2, sombra); pon(g, 9, 2, 'k')
}

function fichaRedonda(g, relleno, borde, luz) {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const esq = (x < 2 || x > N - 3) && (y < 2 || y > N - 3) && !((x === 1 || x === N - 2) && (y === 1 || y === N - 2))
    if (esq) continue
    const filo = x === 0 || x === N - 1 || y === 0 || y === N - 1 || ((x === 1 || x === N - 2) && (y === 1 || y === N - 2))
    g[y][x] = filo ? borde : ((y === 1 || x === 1) ? luz : relleno)
  }
}

function insignia(g, texto) {
  for (let y = 9; y < N; y++) for (let x = 9; x < N; x++) {
    if ((x === 9 || x === 15) && (y === 9 || y === 15)) continue
    g[y][x] = (x === 9 || x === 15 || y === 9 || y === 15) ? 'c' : 'k'
  }
  DIGITOS[texto].forEach((fila, j) => [...fila].forEach((v, i) => { if (v === 'X') g[10 + j][11 + i] = 'a' }))
}

/** La grilla de 16×16 del ícono (letras de PALETA o null), con la cuenta si hay preguntas. */
export function grillaFicha(pendientes) {
  const g = grilla()
  fichaRedonda(g, 'a', 'A', 'y')
  foco(g, 'w', 'r', 'R')
  cabeza(g, { L: 2, R: 13, T: 3, B: 14 })
  const texto = textoInsignia(pendientes)
  if (texto) insignia(g, texto)
  return g
}

const rgb = letra => { const h = PALETA[letra].replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) }

/** Una grilla pasada a RGBA, con cada celda de `escala`×`escala` píxeles. */
export function rgbaDeGrilla(g, escala) {
  const lado = g.length * escala
  const datos = new Uint8Array(lado * lado * 4)
  g.forEach((fila, cy) => fila.forEach((letra, cx) => {
    if (!letra) return
    const [r, gr, b] = rgb(letra)
    for (let dy = 0; dy < escala; dy++) for (let dx = 0; dx < escala; dx++) datos.set([r, gr, b, 255], ((cy * escala + dy) * lado + cx * escala + dx) * 4)
  }))
  return datos
}

/** Ícono de la bandeja de LADO×LADO con la cuenta de preguntas pendientes (0: sin insignia). */
export function iconoBandeja(pendientes) {
  return { ancho: LADO, alto: LADO, rgba: rgbaDeGrilla(grillaFicha(pendientes), ESCALA) }
}
