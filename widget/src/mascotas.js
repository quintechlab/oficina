// Motor de mascotas pixel del widget. Es el mismo del boceto aprobado
// (docs/diseno/bocetos/index.html y widget.html): lienzo de 24x28 celdas, cabeza grande,
// ojos con brillo, cachetes y contorno. Cada personaje tiene silueta propia.
// Solo arma texto SVG: no toca el DOM, así se puede usar desde node.

export const P = {
  amarillo: '#F2B632', negro: '#0B0D12', gris: '#9AA0AC', azul: '#7FB3FF',
  verde: '#8FD694', rosa: '#E78FB3', crema: '#F3EBD8', rojo: '#FF6B6B',
}

function hex(h) {
  h = h.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

export function mezcla(a, b, t) {
  const A = hex(a), B = hex(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

const POSES = { S: { l: 0, bw: 8, bh: 4, s: 12 }, Q: { l: 0, bw: 10, bh: 3, s: 14 }, T: { l: 1, bw: 6, bh: 5, s: 10 }, H: { l: 3, bw: 8, bh: 4, s: 8 }, X: { l: 5, bw: 8, bh: 4, s: 6 } }
const INS = [4, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2]
const OJO = [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4]]
const BRILLO = { o: [[2, 1], [1, 2], [2, 2], [3, 2], [2, 3]], s: [[1, 1], [2, 2], [3, 3]] }
const OJOS = {
  '-': [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], '^': [[0, 3], [1, 2], [2, 1], [3, 2], [4, 3], [1, 3], [3, 3]], u: [[0, 2], [1, 3], [2, 3], [3, 3], [4, 2]],
  x: [[0, 0], [4, 0], [1, 1], [3, 1], [2, 2], [1, 3], [3, 3], [0, 4], [4, 4]], '>': [[1, 0], [2, 1], [3, 2], [2, 3], [1, 4]], '<': [[3, 0], [2, 1], [1, 2], [2, 3], [3, 4]],
}
const MIRA = { o: [0, 0], s: [0, 0], L: [-1, 0], R: [1, 0], U: [0, -1], l: [-1, 1], r: [1, 1] }
const BOCA = { '.': [[-2, 0], [1, 0], [-1, 1], [0, 1]], _: [[-1, 0], [0, 0]], O: [[-1, 0], [0, 0], [-1, 1], [0, 1]], D: [[-2, 0], [-1, 0], [0, 0], [1, 0]], '~': [[-2, 1], [-1, 0], [0, 1], [1, 0]] }

/** Las celdas de un cuadro: mapa "x,y" → color. */
export function pixeles(f, color, pj, animo) {
  const m = new Map(), fig = new Set()
  const ok = (x, y) => x >= 0 && x < 24 && y >= 0 && y < 28
  const S = (x, y, c) => { if (ok(x, y)) m.set(x + ',' + y, c) }
  const F = (x, y, c) => { if (ok(x, y)) { m.set(x + ',' + y, c); fig.add(x + ',' + y) } }
  const po = POSES[f.p], dx = f.dx || 0, cx = 12 + dx, mir = x => 2 * cx - 1 - x
  const sh = mezcla(color, '#000000', 0.3), hl = mezcla(color, '#ffffff', 0.55), lin = mezcla(color, '#0B0D12', 0.78), E = '#1A1530'
  const bb = 24 - po.l, bt = bb - po.bh + 1, hb = bt - 1, ht = hb - 10
  for (let x = 12 - po.s / 2; x < 12 + po.s / 2; x++) S(x, 26, 'rgba(0,0,0,.5)')
  if (pj === 'antena') {
    F(cx - 1, ht - 1, sh); F(cx - 1, ht - 2, sh); F(cx, ht - 3, sh)
    ;[[cx, ht - 5], [cx + 1, ht - 5], [cx, ht - 4], [cx + 1, ht - 4]].forEach(([x, y]) => F(x, y, P.amarillo)); F(cx, ht - 5, '#FFF1C2')
  }
  if (pj === 'gata') {
    ;[[cx - 7, ht - 2, 0], [cx - 7, ht - 1, 0], [cx - 6, ht - 1, 0], [cx - 7, ht, 0], [cx - 6, ht, 1], [cx - 5, ht, 0]].forEach(([x, y, i]) => { F(x, y, i ? hl : color); F(mir(x), y, i ? hl : sh) })
    F(cx - 5, bb - 1, color); F(cx - 6, bb - 2, color); F(cx - 6, bb - 3, color); F(cx - 7, bb - 4, hl)
  }
  if (pj === 'raton') {
    const E4 = [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3]], ci = mezcla(color, '#ffffff', 0.5)
    E4.forEach(([a, b]) => { F(cx - 10 + a, ht - 2 + b, color); F(mir(cx - 10 + a), ht - 2 + b, sh) })
    ;[[1, 1], [2, 1], [1, 2], [2, 2]].forEach(([a, b]) => { F(cx - 10 + a, ht - 2 + b, ci); F(mir(cx - 10 + a), ht - 2 + b, ci) })
  }
  if (pj === 'brote') {
    const hj = '#C6F0A8', ho = mezcla(P.verde, '#000000', 0.3); F(cx - 1, ht - 1, ho); F(cx - 1, ht - 2, ho)
    ;[[cx - 4, ht - 3], [cx - 3, ht - 3], [cx - 3, ht - 2], [cx - 2, ht - 2], [cx, ht - 4], [cx + 1, ht - 4], [cx + 2, ht - 4], [cx, ht - 3], [cx + 1, ht - 3]].forEach(([x, y]) => F(x, y, hj))
  }
  if (pj === 'mono') {
    const la = P.rosa, nu = mezcla(P.rosa, '#000000', 0.3)
    ;[[cx + 1, ht - 3], [cx + 2, ht - 3], [cx + 1, ht - 2], [cx + 2, ht - 2], [cx + 3, ht - 2], [cx + 1, ht - 1], [cx + 2, ht - 1], [cx + 7, ht - 3], [cx + 6, ht - 3], [cx + 7, ht - 2], [cx + 6, ht - 2], [cx + 5, ht - 2], [cx + 7, ht - 1], [cx + 6, ht - 1]].forEach(([x, y]) => F(x, y, la))
    F(cx + 4, ht - 2, nu); F(cx + 4, ht - 1, nu); F(cx + 1, ht - 3, '#FFD0E0')
  }
  if (pj === 'cuernos') {
    const cu = '#F3EBD8', cs = '#C9BFA8'
    ;[[cx - 6, ht + 1, cu], [cx - 6, ht, cu], [cx - 7, ht - 1, cu], [cx - 7, ht - 2, cs], [cx - 5, ht, cs]].forEach(([x, y, c]) => { F(x, y, c); F(mir(x), y, c === cu ? cs : cu) })
  }
  for (let r = 0; r < 11; r++) { const i = INS[r]; for (let x = cx - 8 + i; x <= cx + 7 - i; x++) F(x, ht + r, (r === 10 || x === cx + 7 - i) ? sh : color) }
  F(cx - 5, ht + 1, hl); F(cx - 4, ht + 1, hl); F(cx - 6, ht + 2, hl)
  const bl = cx - po.bw / 2, br = cx + po.bw / 2 - 1
  for (let y = bt; y <= bb; y++) for (let x = bl; x <= br; x++) F(x, y, (x === br || y === bb) ? sh : color)
  if (po.bh >= 4) { F(cx - 1, bt + 1, hl); F(cx, bt + 1, hl) }
  ;[bl, bl + 1, br - 1, br].forEach(x => F(x, bb + 1, sh))
  const a = f.a || 0
  const up1 = [[cx + 4, bt], [cx + 5, bt], [cx + 6, hb], [cx + 7, hb - 1], [cx + 8, hb - 2], [cx + 8, hb - 3], [cx + 9, hb - 3], [cx + 8, hb - 4], [cx + 9, hb - 4]]
  const up2 = [[cx + 4, bt], [cx + 5, bt], [cx + 6, hb], [cx + 7, hb], [cx + 8, hb - 1], [cx + 9, hb - 1], [cx + 9, hb - 2], [cx + 10, hb - 2], [cx + 10, hb - 1]]
  const nub = [[br + 1, bt + 1]]
  ;(a === 1 || a === 3 ? up1 : a === 2 ? up2 : nub).forEach(([x, y]) => F(x, y, color))
  ;(a === 3 ? up1 : nub).forEach(([x, y]) => F(mir(x), y, color))
  if (f.k) {
    for (let x = cx - 4; x <= cx + 3; x++) { F(x, hb, (x === cx - 1 || x === cx) ? '#8A90A0' : '#F3EBD8'); F(x, bt, P.amarillo); F(x, bt + 1, P.amarillo); F(x, bt + 2, '#B98418') }
    if (f.k === 2) for (let x = cx; x <= cx + 3; x++) F(x, hb - 1, '#FFFFFF')
  }
  if (f.lap) { F(cx + 4, bt + 2, '#3A3F52'); F(cx + 5, bt + 1, '#E9D7A8'); F(cx + 6, bt, P.amarillo); F(cx + 7, hb, P.amarillo); F(cx + 8, hb - 1, P.rosa) }
  for (const k of fig) {
    const [x, y] = k.split(',').map(Number)
    ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([u, v]) => { if (ok(x + u, y + v) && !fig.has((x + u) + ',' + (y + v))) m.set((x + u) + ',' + (y + v), lin) })
  }
  const ey = ht + 3, o = f.o || 'o'
  ;[[cx - 7, 'L'], [cx + 2, 'R']].forEach(([ex, lado]) => {
    if (MIRA[o]) {
      const [ox, oy] = MIRA[o]
      OJO.forEach(([u, v]) => S(ex + u + ox, ey + v + oy, E))
      ;(BRILLO[o] || BRILLO.o).forEach(([u, v]) => S(ex + u + ox, ey + v + oy, '#FFFFFF'))
    } else {
      const pts = o === '>' ? (lado === 'L' ? OJOS['>'] : OJOS['<']) : OJOS[o]
      ;(pts || []).forEach(([u, v]) => S(ex + u, ey + v, E))
    }
  })
  const my = ht + 8, bo = f.m || '.'
  if (!(f.k === 2 && bo === '.')) (BOCA[bo] || []).forEach(([u, v]) => S(cx + u, my + v, E))
  if (bo === 'D') { S(cx - 1, my + 1, '#FF6F91'); S(cx, my + 1, '#FF6F91') }
  if (animo !== 'fallo') { const bc = color === P.rosa ? '#D94A7B' : '#FF8FB1'; [cx - 7, cx - 6, cx + 5, cx + 6].forEach(x => S(x, my, bc)) }
  return m
}

/** Convierte las celdas en paths, uno por color, juntando corridas horizontales. */
export function aPath(m) {
  const por = new Map()
  for (const [k, c] of m) { const [x, y] = k.split(',').map(Number); if (!por.has(c)) por.set(c, []); por.get(c).push([x, y]) }
  let s = ''
  for (const [c, pts] of por) {
    pts.sort((a, b) => a[1] - b[1] || a[0] - b[0])
    let d = '', i = 0
    while (i < pts.length) {
      const [x, y] = pts[i]; let n = 1
      while (i + n < pts.length && pts[i + n][1] === y && pts[i + n][0] === x + n) n++
      d += `M${x} ${y}h${n}v1h-${n}z`; i += n
    }
    s += `<path d="${d}" fill="${c}"/>`
  }
  return s
}

const GL = {
  q: ['XXX', '..X', '.XX', '...', '.X.'], nota: ['..XX', '..X.', '..X.', 'XXX.', 'XX..'], z: ['XXX', '..X', '.X.', 'X..', 'XXX'], ex: ['X', 'X', 'X', '.', 'X'],
  chispa: ['.X.', 'XXX', '.X.'], tok: ['XX', 'XX'], gota: ['.X.', 'XXX', 'XXX', '.X.'], humo: ['XX', 'XX'],
}
function gl(n, x, y, c, st) {
  let d = ''
  GL[n].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') d += `M${x + i} ${y + j}h1v1h-1z` }))
  return `<path class="fx" d="${d}" fill="${c}" style="${st}"/>`
}

/** Efectos alrededor de la mascota según el ánimo (signos, chispas, notas, confeti). */
function efectos(a) {
  switch (a) {
    case 'pensando': return gl('q', 20, 4, P.amarillo, 'animation:flota 2s ease-in-out infinite')
    case 'comando': return gl('gota', 1, 10, P.azul, 'opacity:0;animation:gota 1.1s ease-out infinite') + `<rect x="20" y="19" width="4" height="4" fill="#1B2030"/><rect x="20" y="19" width="4" height="1" fill="#2E3548"/><rect class="fx" x="21" y="21" width="2" height="1" fill="${P.verde}" style="animation:parpadeo .5s step-end infinite"/>`
    case 'editando': return gl('chispa', 20, 4, P.amarillo, 'animation:brilla 1.2s ease-in-out infinite') + gl('chispa', 0, 9, P.rosa, 'animation:brilla 1.2s ease-in-out -.6s infinite')
    case 'saluda': return gl('chispa', 1, 5, '#FFFFFF', 'animation:brilla 1.4s ease-in-out infinite') + gl('chispa', 20, 2, '#FFFFFF', 'animation:brilla 1.4s ease-in-out -.7s infinite')
    case 'comiendo': return [0, 1, 2].map(i => gl('tok', 21, 18, P.amarillo, `opacity:0;animation:token 1.2s linear ${-i * 0.4}s infinite`)).join('')
    case 'listo': {
      const cols = [P.amarillo, P.rosa, P.azul, P.verde]
      let s = gl('nota', 19, 4, P.amarillo, 'opacity:0;animation:nota 1.6s ease-out infinite') + gl('nota', 0, 6, P.verde, 'opacity:0;animation:nota 1.6s ease-out .8s infinite')
      for (let i = 0; i < 9; i++) s += `<rect class="fx" x="${1 + ((i * 2.6) | 0)}" y="0" width="1" height="1" fill="${cols[i % 4]}" style="opacity:0;--dx:${(i % 2 ? 1 : -1) * (1 + i % 3)}px;animation:confeti 1.4s ease-in ${(i * 0.16).toFixed(2)}s infinite"/>`
      return s
    }
    case 'fallo': return gl('ex', 21, 4, P.rojo, 'animation:parpadeo .8s step-end infinite') + gl('humo', 16, 6, '#7A8090', 'opacity:0;animation:humo 1.8s ease-out infinite') + gl('humo', 6, 7, '#7A8090', 'opacity:0;animation:humo 1.8s ease-out -.9s infinite')
    case 'inactiva': return gl('z', 18, 9, P.gris, 'opacity:0;animation:zeta 2.4s ease-out infinite') + `<g transform="translate(20 2) scale(1.5)">${gl('z', 0, 0, P.gris, 'opacity:0;animation:zeta 2.4s ease-out -1.2s infinite')}</g>`
    case 'esperando': return [0, 1, 2].map(i => `<rect class="fx" x="${16 + i * 2}" y="6" width="1" height="1" fill="${P.crema}" style="animation:puntos 1.5s step-end ${i * 0.25}s infinite"/>`).join('')
    case 'teEspera': return `<rect x="19" y="1" width="5" height="9" fill="#FFFFFF"/><rect x="18" y="2" width="7" height="7" fill="#FFFFFF"/><rect x="18" y="9" width="2" height="2" fill="#FFFFFF"/>` + gl('ex', 21, 3, P.amarillo, 'animation:flota 1.1s ease-in-out infinite')
    default: return ''
  }
}

/** Secuencias de cuadros por ánimo (p: pose, o: ojos, m: boca, a: brazo, k: libro, lap: lápiz). */
const SEC = {
  pensando: [{ p: 'S', o: 'o', ms: 700 }, { p: 'S', o: 's', ms: 300 }, { p: 'S', o: '-', ms: 110 }, { p: 'S', o: 'U', m: '_', dx: 1, ms: 600 }, { p: 'S', o: 'U', m: '_', dx: 1, ms: 500 }, { p: 'S', o: 'o', ms: 400 }, { p: 'T', o: 'o', ms: 140 }, { p: 'S', o: 's', ms: 400 }],
  leyendo: [{ p: 'S', o: 'l', k: 1, ms: 700 }, { p: 'S', o: 'l', k: 2, ms: 160 }, { p: 'S', o: 'r', k: 1, ms: 700 }, { p: 'S', o: '-', k: 1, ms: 110 }, { p: 'S', o: 'r', k: 1, ms: 500 }, { p: 'S', o: 'l', k: 1, ms: 600 }],
  comando: [{ p: 'S', o: '>', m: 'O', ms: 160 }, { p: 'Q', o: '>', m: '_', ms: 110 }, { p: 'T', o: '>', m: 'D', ms: 80 }, { p: 'H', o: '>', m: 'D', ms: 140 }, { p: 'T', o: '>', m: 'D', ms: 80 }, { p: 'Q', o: '>', m: '_', ms: 110 }, { p: 'S', o: '>', m: 'O', ms: 180 }],
  editando: [{ p: 'S', o: 'o', lap: 1, ms: 350 }, { p: 'S', o: 's', lap: 1, ms: 250 }, { p: 'Q', o: '^', m: 'D', lap: 1, ms: 120 }, { p: 'T', o: '^', m: 'D', lap: 1, ms: 90 }, { p: 'H', o: '^', m: 'D', lap: 1, ms: 170 }, { p: 'T', o: '^', m: 'D', lap: 1, ms: 90 }, { p: 'Q', o: '^', lap: 1, ms: 120 }, { p: 'S', o: '-', lap: 1, ms: 110 }],
  comiendo: [{ p: 'S', o: 'o', m: 'D', ms: 220 }, { p: 'Q', o: '^', m: 'O', ms: 90 }, { p: 'S', o: '^', m: '.', ms: 90 }],
  listo: [{ p: 'Q', o: '^', m: 'D', a: 3, ms: 120 }, { p: 'T', o: 'o', m: 'D', a: 3, ms: 90 }, { p: 'X', o: 's', m: 'D', a: 3, ms: 220 }, { p: 'H', o: 'o', m: 'D', a: 3, ms: 120 }, { p: 'Q', o: '^', m: 'D', a: 3, ms: 120 },
    { p: 'S', o: 'o', m: 'D', a: 1, ms: 200 }, { p: 'S', o: 's', m: 'D', a: 2, ms: 200 }, { p: 'S', o: 'o', m: 'D', a: 1, ms: 200 }, { p: 'S', o: 's', m: 'D', a: 2, ms: 200 }],
  // Terminó hace rato: quieto, contento y atenuado
  reposo: [{ p: 'S', o: '^', m: '.', ms: 1000 }],
  fallo: [{ p: 'S', o: 'x', m: '~', dx: -1, ms: 70 }, { p: 'S', o: 'x', m: '~', dx: 1, ms: 70 }, { p: 'S', o: 'x', m: '~', dx: -1, ms: 70 }, { p: 'S', o: 'x', m: '~', dx: 1, ms: 70 }, { p: 'S', o: 'x', m: '~', ms: 300 }, { p: 'Q', o: 'x', m: '~', ms: 2000 }, { p: 'S', o: 'x', m: '~', ms: 500 }],
  inactiva: [{ p: 'S', o: '-', m: '_', ms: 900 }, { p: 'Q', o: '-', m: '_', ms: 1100 }, { p: 'S', o: '-', m: '_', ms: 700 }, { p: 'Q', o: '-', m: '.', ms: 700 }],
  esperando: [{ p: 'S', o: 'u', ms: 1200 }, { p: 'Q', o: 'u', ms: 700 }, { p: 'S', o: 'u', ms: 900 }, { p: 'S', o: 'R', m: 'D', a: 1, ms: 350 }, { p: 'S', o: 'R', m: 'D', a: 2, ms: 350 }, { p: 'S', o: 'R', m: 'D', a: 1, ms: 350 }, { p: 'S', o: 'u', ms: 500 }],
  teEspera: [{ p: 'S', o: 'o', m: 'D', a: 1, ms: 260 }, { p: 'S', o: 's', m: 'D', a: 2, ms: 260 }, { p: 'S', o: 'o', m: 'D', a: 1, ms: 260 }, { p: 'S', o: 's', m: 'D', a: 2, ms: 260 }, { p: 'S', o: 'o', m: '.', ms: 900 }, { p: 'S', o: '-', m: '.', ms: 110 }, { p: 'T', o: 'o', m: '.', ms: 140 }, { p: 'S', o: 'o', m: '.', ms: 600 }],
  saluda: [{ p: 'S', o: 'o', m: 'D', a: 1, ms: 260 }, { p: 'S', o: 'o', m: 'D', a: 2, ms: 260 }, { p: 'S', o: 's', m: 'D', a: 1, ms: 260 }, { p: 'S', o: 's', m: 'D', a: 2, ms: 260 }, { p: 'Q', o: '^', m: 'D', a: 1, ms: 120 }, { p: 'T', o: 'o', m: 'D', a: 1, ms: 90 }, { p: 'H', o: 'o', m: 'D', a: 2, ms: 180 }, { p: 'T', o: 'o', m: 'D', a: 1, ms: 90 }, { p: 'Q', o: '^', m: 'D', a: 1, ms: 120 }, { p: 'S', o: '-', m: 'D', a: 2, ms: 110 }],
}

export const KF = `.fx{transform-box:fill-box;transform-origin:center}
@keyframes flota{0%,100%{transform:translateY(0);opacity:.6}50%{transform:translateY(-1.5px);opacity:1}}
@keyframes gota{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(-2px,-4px);opacity:0}}
@keyframes parpadeo{0%{opacity:1}50%{opacity:0}}
@keyframes brilla{0%,100%{opacity:0;transform:scale(.3)}50%{opacity:1;transform:scale(1)}}
@keyframes token{0%{transform:translateX(0);opacity:0}15%,75%{opacity:1}100%{transform:translateX(-9px);opacity:0}}
@keyframes nota{0%{transform:translate(0,0) rotate(0deg);opacity:0}15%{opacity:1}100%{transform:translate(2px,-8px) rotate(14deg);opacity:0}}
@keyframes confeti{0%{transform:translate(0,0) rotate(0deg);opacity:0}10%{opacity:1}100%{transform:translate(var(--dx),20px) rotate(200deg);opacity:0}}
@keyframes humo{0%{transform:translate(0,0) scale(.5);opacity:0}25%{opacity:.8}100%{transform:translate(1px,-7px) scale(1.5);opacity:0}}
@keyframes zeta{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(3px,-6px);opacity:0}}
@keyframes puntos{0%,15%{opacity:.15}20%,80%{opacity:1}85%,100%{opacity:.15}}
@keyframes titila{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes sube{to{transform:translateY(-18px)}}
@keyframes gira{to{transform:rotate(360deg)}}
@keyframes luz{0%,100%{opacity:.05}50%{opacity:.09}}
@keyframes mota{0%,100%{transform:translate(0,0);opacity:.15}50%{transform:translate(4px,-6px);opacity:.8}}`

let UID = 0
/** Prefijo único para ids y keyframes de cada dibujo. */
export const nuevoId = p => p + (UID++)

/** Una mascota animada: grupos SVG con un cuadro cada uno y su CSS de keyframes. */
export function sprite(animo, color, pj, { x = 0, y = 0, s = 2 } = {}) {
  const u = nuevoId('s'), seq = SEC[animo] ?? SEC.esperando, D = seq.reduce((a, f) => a + f.ms, 0)
  const col = animo === 'inactiva' ? mezcla(color, '#6B7180', 0.35) : color
  let css = '', g = '', t = 0
  if (seq.length === 1) {
    g = aPath(pixeles(seq[0], col, pj, animo))
  } else {
    seq.forEach((f, i) => {
      const a = +(t / D * 100).toFixed(2), b = +((t + f.ms) / D * 100).toFixed(2); t += f.ms
      css += `@keyframes ${u}f${i}{${a > 0 ? '0%{opacity:0}' : ''}${a}%{opacity:1}${b < 100 ? b + '%{opacity:0}' : ''}100%{opacity:0}}`
      g += `<g style="opacity:0;animation:${u}f${i} ${D}ms step-end infinite">${aPath(pixeles(f, col, pj, animo))}</g>`
    })
  }
  g += efectos(animo)
  const dim = animo === 'reposo' ? 'opacity:.45' : ''
  return { g: `<g transform="translate(${x} ${y}) scale(${s})"><g style="${dim}">${g}</g></g>`, css }
}

export function svgDoc(w, h, body, css, alt, dw = w, dh = h, vb = `0 0 ${w} ${h}`) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="${vb}" shape-rendering="crispEdges" role="img" aria-label="${alt}" font-family="Segoe UI, Manrope, Helvetica, Arial, sans-serif"><style>${KF}${css}</style>${body}</svg>`
}

/** Cabeza recortada para la barra de título y el globo. */
export function cabeza(animo, color, pj, alt) {
  const sp = sprite(animo, color, pj, { s: 1 })
  return svgDoc(24, 18, sp.g, sp.css, alt, 30, 22, '0 4 24 18')
}
