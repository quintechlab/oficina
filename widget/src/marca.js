// Lógica pura de la marca "Escenario" (docs/diseno/marca-avi-ux.md): el planificador del repertorio de
// reposo (7.2), los juegos como datos (las pistas de 7.3, las del boceto docs/diseno/bocetos/marca-avi.html)
// y la mirada (6). No toca el DOM: marcaMotion.js lo dibuja y los tests lo revisan con node --test.

// ------------------------------------------------------------------ tiempos (5.2)

/** Quietud antes del primer juego de una racha. */
export const REPOSO_PRIMERO_MS = 40000
/** Intervalo al azar entre juegos, desde que terminó el anterior. */
export const REPOSO_ENTRE_MS = [60000, 150000]
/** Quietud antes de la siesta (desde tu última actividad en la ventana o el último trabajo de Claude). */
export const REPOSO_SIESTA_MS = 480000
/** Separación mínima entre dos "Te llama". */
export const REPOSO_LLAMA_MS = 900000
/** Pesos del sorteo. */
export const PESOS_REPOSO = { pelota: 4, canta: 3, estira: 2, llama: 1 }
/** Salida de un juego interrumpido (`--d-suelta`). */
export const SUELTA_MS = 280

export const TIEMPOS_REPOSO = { primero: REPOSO_PRIMERO_MS, entre: REPOSO_ENTRE_MS, siesta: REPOSO_SIESTA_MS, llama: REPOSO_LLAMA_MS }

// ------------------------------------------------------------------ planificador (7.2)

/**
 * El juego que toca en `en`: por `pesos`, nunca el mismo dos veces seguidas (salvo que el repertorio
 * tenga un solo juego, como el cucú de la muesca), y "te llama" nunca el primero de una racha
 * (`juegos` 0) ni antes de 15 min de la llamada anterior.
 */
function sortear({ en, ultimo, ultimaLlamada, juegos, r, llama, pesos }) {
  const unico = Object.keys(pesos).length === 1
  const candidatos = Object.entries(pesos).filter(([id]) => (unico || id !== ultimo)
    && !(id === 'llama' && (juegos === 0 || (ultimaLlamada != null && en - ultimaLlamada < llama))))
  let resto = r * candidatos.reduce((s, [, p]) => s + p, 0)
  for (const [id, p] of candidatos) {
    if (resto < p) return id
    resto -= p
  }
  return candidatos[candidatos.length - 1][0]
}

/**
 * El próximo evento del reposo, `{ id, en }` (ms, en el mismo reloj que `quietoDesde`). El primer juego de una racha
 * (`juegos` 0) a los 40 s de `quietoDesde`; los siguientes, de 60 a 150 s después de `ultimoFin`. Si
 * ese momento llega a los 8 min de quietud, en su lugar va la siesta, justo a los 8 min. `azar()`
 * (de 0 a 1) se pide siempre dos veces y en este orden: el intervalo y el sorteo. `pesos`: el
 * repertorio (la muesca juega solo al cucú, `{ cucu: 1 }`, y trata la siesta como "se aquieta").
 * `tiempos`: para acortarlos en la vista de desarrollo.
 */
export function proximoReposo({ quietoDesde, ultimoFin, ultimo, ultimaLlamada, juegos, azar, pesos = PESOS_REPOSO }, tiempos = TIEMPOS_REPOSO) {
  const intervalo = azar()
  const r = azar()
  const [min, max] = tiempos.entre
  const en = juegos === 0 || ultimoFin == null
    ? quietoDesde + tiempos.primero
    : ultimoFin + min + intervalo * (max - min)
  const siesta = quietoDesde + tiempos.siesta
  if (siesta <= en) return { id: 'siesta', en: siesta }
  return { id: sortear({ en, ultimo, ultimaLlamada, juegos, r, llama: tiempos.llama, pesos }), en }
}

// ------------------------------------------------------------------ pistas (7.3)

/** Curvas: o salida cúbica, i entrada cúbica, io entrada y salida, b back de salida (1,70158), s escalón. */
export const CURVAS = {
  l: t => t,
  o: t => 1 - (1 - t) ** 3,
  i: t => t ** 3,
  io: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  b: t => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  s: t => (t >= 1 ? 1 : 0),
}

/**
 * Valor de una pista `[[t, valor, curva?], …]` en `t` ms. Cada tramo usa la curva de su punto final
 * (por defecto `io`); antes del primero vale el primero y después del último, el último.
 */
export function valorPista(pista, t) {
  if (t <= pista[0][0]) return pista[0][1]
  for (let n = 1; n < pista.length; n++) {
    const [t1, v1, curva = 'io'] = pista[n]
    if (t > t1) continue
    const [t0, v0] = pista[n - 1]
    const p = t1 === t0 ? 1 : (t - t0) / (t1 - t0)
    return p >= 1 ? v1 : v0 + (v1 - v0) * CURVAS[curva](p)
  }
  return pista[pista.length - 1][1]
}

/**
 * El reposo de cada canal. Cuerpo: x, y, sx, sy, r (con origen en el piso, 60,104); antena: ant y luz
 * (foco > 0 crece, < 0 se apaga); mirada del juego: gx, gy, gw (cuánto manda el juego), gb (cuánto
 * mira la pelota); ojos (0 abiertos, 1 contentos, 2 cerrados), par (párpado), boca; manos (mo
 * opacidad, x, y, r); globo; pelota (bx, by, bs aplastado, bo opacidad, br rotación); asir (0/1: el
 * Avi de la muesca se agarra del alféizar con las dos manos; la marca lo ignora).
 */
export const REPOSO = Object.freeze({
  x: 0, y: 0, sx: 1, sy: 1, r: 0, ant: 0, luz: 0, gx: 0, gy: 0, gw: 0, gb: 0, ojos: 0, par: 1, boca: 0,
  moI: 0, mIx: 0, mIy: 0, mIr: 0, moD: 0, mDx: 0, mDy: 0, mDr: 0, globo: 0, bx: 0, by: 97, bs: 1, bo: 0, br: 0, asir: 0,
})

/** Los valores de todos los canales de un acto en `t` ms (los que el acto no nombra, en reposo). */
export function estadoActo(def, t) {
  const v = { ...REPOSO }
  for (const k in def.pistas) v[k] = valorPista(def.pistas[k], t)
  return v
}

/**
 * El repertorio, tal cual el objeto `ACTOS` del boceto. Cada acto: `dur`, `pistas` y, si hace falta,
 * `eventos` (`[t, 'nota', { dir, doble, grande }]` o `[t, 'siesta']`) y `lazo` (queda en su último
 * cuadro: la siesta).
 */
export const ACTOS = {
  pelota: () => ({ id: 'pelota', dur: 6600, pistas: {
    bo: [[0, 0], [120, 1, 'l'], [5800, 1], [6300, 0, 'o']],
    bx: [[0, -22], [480, -22, 'l'], [1000, 14, 'l'], [1180, 38, 'l'], [1650, 92, 'l'], [2080, 128, 'l'], [2400, 121, 'l'], [2700, 115, 'l'], [2860, 112, 'l'], [3000, 110, 'l'], [3700, 90, 'o'], [5500, 90], [6300, 146, 'i']],
    by: [[0, -6], [480, 97, 'i'], [1000, 18, 'o'], [1180, 26, 'i'], [1650, 6, 'o'], [2080, 97, 'i'], [2400, 66, 'o'], [2700, 97, 'i'], [2860, 88, 'o'], [3000, 97, 'i']],
    bs: [[0, 1], [470, 1], [480, 0.68, 'l'], [560, 1.06, 'o'], [640, 1, 'o'], [1170, 1], [1180, 0.8, 'l'], [1260, 1, 'o'], [2070, 1], [2080, 0.72, 'l'], [2160, 1.05, 'o'], [2240, 1, 'o'], [2690, 1], [2700, 0.84, 'l'], [2780, 1, 'o']],
    br: [[0, 0], [480, 0], [1180, 120, 'l'], [2080, 320, 'l'], [3000, 420, 'l'], [3700, 256, 'o'], [5500, 256], [6300, 714, 'i']],
    gb: [[0, 0], [200, 1, 'o'], [6200, 1], [6600, 0, 'io']],
    y: [[0, 0], [1000, 0], [1180, -14, 'o'], [1380, 0, 'i'], [4300, 0], [4480, -6, 'o'], [4640, 0, 'i'], [4820, -6, 'o'], [4980, 0, 'i']],
    sx: [[0, 1], [780, 1], [1000, 1.08, 'o'], [1100, 0.94, 'o'], [1300, 1], [1380, 1.07, 'l'], [1620, 1, 'b'], [4290, 1], [4300, 1.05, 'l'], [4420, 0.97, 'o'], [4640, 1.05, 'i'], [4760, 0.97, 'o'], [4980, 1.04, 'i'], [5200, 1, 'b']],
    sy: [[0, 1], [780, 1], [1000, 0.88, 'o'], [1100, 1.08, 'o'], [1300, 1], [1380, 0.9, 'l'], [1620, 1, 'b'], [4290, 1], [4300, 0.94, 'l'], [4420, 1.04, 'o'], [4640, 0.94, 'i'], [4760, 1.04, 'o'], [4980, 0.95, 'i'], [5200, 1, 'b']],
    r: [[0, 0], [480, -4], [900, 0], [1650, 4], [2600, 6], [3700, 3], [4200, 0], [5600, 0], [6100, 5], [6600, 0]],
    ant: [[0, 0], [1170, 0], [1260, -22, 'o'], [1400, 16], [1540, -10], [1680, 6], [1820, -3], [1960, 0]],
    ojos: [[0, 0], [4260, 1, 's'], [5320, 0, 's']],
    boca: [[0, 0], [4250, 0], [4400, 0.6, 'o'], [5200, 0.6], [5400, 0]],
    moI: [[0, 0], [4150, 0], [4320, 1, 'b'], [5250, 1], [5450, 0, 'o']], mIx: [[0, 0], [4150, 0], [4320, -4, 'b']], mIy: [[0, 0], [4150, 0], [4320, -26, 'b']],
    moD: [[0, 0], [4150, 0], [4320, 1, 'b'], [5250, 1], [5450, 0, 'o']], mDx: [[0, 0], [4150, 0], [4320, 4, 'b']], mDy: [[0, 0], [4150, 0], [4320, -26, 'b']],
    par: [[0, 1], [5320, 1], [5400, 0.1, 'o'], [5500, 1, 'o']],
  } }),

  canta: () => {
    const B = 520, t0 = 400, n = 8, fin = t0 + n * B
    const r = [[0, 0]], sy = [[0, 1], [300, 1.04, 'o']], sx = [[0, 1], [300, 0.97, 'o']], boca = [[0, 0]], luz = [[0, 0]], eventos = []
    for (let k = 0; k < n; k++) {
      const t = t0 + k * B
      r.push([t + 60, k % 2 ? 6 : -6])
      sy.push([t, 0.95, 'o'], [t + 200, 1.02, 'o'])
      sx.push([t, 1.04, 'o'], [t + 200, 0.99, 'o'])
      boca.push([t + 70, 1, 'o'], [t + 400, 0.2])
      luz.push([t + 40, 0.7, 'o'], [t + 420, 0])
      eventos.push([t + 80, 'nota', { dir: k % 2 ? 1 : -1, doble: k % 3 === 2, grande: false }])
    }
    r.push([fin, 0], [6200, 0]); sy.push([fin, 1.08, 'b'], [5300, 1.06], [5600, 1]); sx.push([fin, 0.95, 'b'], [5300, 0.96], [5600, 1])
    boca.push([fin + 60, 1, 'o'], [5300, 1], [5500, 0]); luz.push([fin, 1, 'o'], [5300, 0.8], [5700, 0])
    eventos.push([fin + 60, 'nota', { dir: 0, doble: true, grande: true }])
    const arriba = v => [[0, 0], [fin - 120, 0], [fin + 60, v, 'b']]
    return { id: 'canta', dur: 6200, eventos, pistas: { r, sy, sx, boca, luz,
      y: [[0, 0], [300, -2, 'o'], [400, 0], [fin - 100, 0], [fin, -5, 'b'], [5300, -5], [5600, 0]],
      ojos: [[0, 0], [300, 1, 's'], [5440, 0, 's']], par: [[0, 1], [5440, 1], [5520, 0.1, 'o'], [5640, 1, 'o']],
      gw: [[0, 0], [300, 1]], gy: [[0, -0.3]],
      moI: [[0, 0], [fin - 120, 0], [fin + 60, 1, 'b'], [5300, 1], [5560, 0, 'o']], mIx: arriba(-7), mIy: arriba(-20),
      moD: [[0, 0], [fin - 120, 0], [fin + 60, 1, 'b'], [5300, 1], [5560, 0, 'o']], mDx: arriba(7), mDy: arriba(-20),
    } }
  },

  llama: () => ({ id: 'llama', dur: 4600, pistas: {
    sy: [[0, 1], [220, 0.88, 'o'], [420, 1.1, 'o'], [600, 1, 'i'], [610, 0.9, 'l'], [700, 0.92], [880, 1.08, 'o'], [1040, 1, 'i'], [1050, 0.92, 'l'], [1300, 1, 'b']],
    sx: [[0, 1], [220, 1.08, 'o'], [420, 0.93, 'o'], [600, 1, 'i'], [610, 1.07, 'l'], [700, 1.05], [880, 0.95, 'o'], [1040, 1, 'i'], [1050, 1.06, 'l'], [1300, 1, 'b']],
    y: [[0, 0], [220, 0], [420, -16, 'o'], [600, 0, 'i'], [700, 0], [880, -11, 'o'], [1040, 0, 'i']],
    gx: [[0, 0]], gy: [[0, -0.15]], gw: [[0, 0], [200, 1, 'o'], [3700, 1], [4300, 0]],
    globo: [[0, 0], [300, 0], [560, 1, 'b'], [3500, 1], [3800, 0, 'i']],
    boca: [[0, 0], [320, 0], [460, 0.75, 'o'], [700, 0.15], [860, 0.6, 'o'], [1150, 0]],
    luz: [[0, 0], [300, 1, 'o'], [600, 0], [860, 1, 'o'], [1200, 0]],
    moD: [[0, 0], [180, 0], [420, 1, 'b'], [3500, 1], [3800, 0, 'o']], mDx: [[0, 0], [180, 0], [420, 5, 'b']], mDy: [[0, 0], [180, 0], [420, -28, 'b']],
    mDr: [[0, 0], [1200, 0], [1350, -28], [1550, 18], [1750, -28], [1950, 18], [2150, -28], [2350, 18], [2550, 0]],
    r: [[0, 0], [2600, 0], [2950, 8, 'b'], [3600, 8], [4100, 0]],
    ant: [[0, 0], [400, 0], [600, -10, 'o'], [760, 8], [900, -4], [1040, 0], [1100, 0], [1250, -8, 'o'], [1400, 5], [1550, 0]],
    par: [[0, 1], [3000, 1], [3080, 0.1, 'o'], [3200, 1, 'o']],
  } }),

  estira: () => ({ id: 'estira', dur: 4400, pistas: {
    sy: [[0, 1], [900, 1.14], [2000, 1.15], [2350, 0.9, 'i'], [2800, 1, 'b']],
    sx: [[0, 1], [900, 0.9], [2000, 0.89], [2350, 1.08, 'i'], [2800, 1, 'b']],
    y: [[0, 0], [900, -3], [2000, -3], [2350, 0, 'i']],
    ojos: [[0, 0], [350, 2, 's'], [2570, 0, 's']],
    boca: [[0, 0], [900, 0], [1350, 1, 'o'], [1900, 0.95], [2300, 0]],
    moI: [[0, 0], [150, 0], [500, 1, 'o'], [2250, 1], [2550, 0, 'o']], mIx: [[0, 0], [150, 0], [900, 14]], mIy: [[0, 0], [150, 0], [900, -58], [2000, -60], [2400, -20, 'i']], mIr: [[0, 0], [900, -30]],
    moD: [[0, 0], [150, 0], [500, 1, 'o'], [2250, 1], [2550, 0, 'o']], mDx: [[0, 0], [150, 0], [900, -14]], mDy: [[0, 0], [150, 0], [900, -58], [2000, -60], [2400, -20, 'i']], mDr: [[0, 0], [900, 30]],
    r: [[0, 0], [1000, 0], [1100, 1.5], [1200, -1.5], [1300, 1.5], [1400, -1.5], [1500, 1], [1600, 0], [2900, 0], [3050, -5], [3200, 5], [3350, -3], [3500, 2], [3650, 0]],
    ant: [[0, 0], [2350, 0], [2450, 12, 'o'], [2600, -8], [2750, 4], [2900, 0], [3050, -10], [3200, 10], [3350, -6], [3500, 3], [3650, 0]],
    par: [[0, 1], [3700, 1], [3780, 0.1, 'o'], [3880, 1, 'o']],
    gy: [[0, 0], [300, -0.5], [2400, -0.5], [2900, 0]], gw: [[0, 0], [300, 1], [3900, 1], [4400, 0]],
  } }),

  siesta: () => ({ id: 'siesta', dur: 3400, lazo: true, eventos: [[3200, 'siesta']], pistas: {
    par: [[0, 1], [600, 0.45], [900, 1, 'o'], [1600, 0.35], [1760, 0.85, 'o'], [2400, 0.3], [2700, 0.25]],
    ojos: [[0, 0], [2700, 2, 's']],
    y: [[0, 0], [600, 2], [900, 0, 'o'], [1600, 3], [1760, 0, 'o'], [2400, 3], [3000, 2]],
    r: [[0, 0], [2400, 0], [3200, 7]], sy: [[0, 1], [2700, 1], [3200, 0.97]], sx: [[0, 1], [2700, 1], [3200, 1.02]],
    luz: [[0, 0], [2700, 0], [3300, -1]], gy: [[0, 0], [600, 0.4]], gw: [[0, 0], [300, 1]],
  } }),

  despierta: () => ({ id: 'despierta', dur: 1000, pistas: {
    ojos: [[0, 2], [60, 0, 's']], par: [[0, 0.25], [60, 1.28, 's'], [500, 1.28], [700, 1, 'o'], [800, 0.1, 'o'], [900, 1, 'o']],
    y: [[0, 2], [160, -10, 'o'], [340, 0, 'i']], r: [[0, 7], [200, -3, 'o'], [500, 0, 'b']],
    sy: [[0, 0.97], [160, 1.1, 'o'], [340, 0.9, 'i'], [600, 1, 'b']], sx: [[0, 1.02], [160, 0.93, 'o'], [340, 1.07, 'i'], [600, 1, 'b']],
    luz: [[0, -1], [200, 0.8, 'o'], [700, 0]], ant: [[0, 0], [200, -14, 'o'], [380, 10], [520, -5], [660, 0]],
  } }),

  // El único juego de la muesca (muesca-avi-ux.md 7.3): se esconde 62 u detrás del alféizar (queda
  // afuera la punta ámbar de la antena), espera 0,7 s y vuelve de golpe con sobrepique, contento y
  // agarrado del borde con las dos manos. La mirada sigue al puntero todo el tiempo (sin gw).
  cucu: () => ({ id: 'cucu', dur: 2600, pistas: {
    y: [[0, 0], [304, 62, 'o'], [988, 62], [1254, -14.5, 'o'], [1520, -3.6, 'o'], [1900, 0, 'o']],
    ojos: [[0, 0], [1150, 1, 's'], [2600, 0, 's']],
    asir: [[0, 0], [1150, 1, 's'], [2600, 0, 's']],
  } }),
}

/**
 * Soltar un juego interrumpido (7.4): desde los valores de ahora, todos los canales vuelven al reposo
 * en 280 ms (salida cúbica), la pelota y el globito se funden en 180 y los ojos se abren de una.
 */
export function salida(desde) {
  const pistas = {}
  for (const k in REPOSO) pistas[k] = [[0, desde[k]], [SUELTA_MS, REPOSO[k], 'o']]
  pistas.ojos = [[0, 0]]
  pistas.bo = [[0, desde.bo], [180, 0, 'o']]
  pistas.globo = [[0, desde.globo], [180, 0, 'o']]
  return { id: 'salida', dur: SUELTA_MS, pistas }
}

// ------------------------------------------------------------------ mirada (6)

/** Adónde mira el Avi de la muesca mientras trabaja: lo suyo, abajo y a la derecha (muesca-avi-ux.md 9). */
export const MIRA_OCUPADO = Object.freeze({ x: 0.3, y: 0.7 })

/** Poses en las que el Avi sigue al puntero: esperando y te espera. Las demás miran lo suyo. */
export function siguePuntero(pose) {
  return pose === 'esperando' || pose === 'teEspera'
}

/**
 * ¿Sigue al puntero ahora? En una pose que mira, salvo que trabaje (`ocupado`) y no se le haya pedido
 * seguir igual (`sigueOcupado`). La muesca sigue igual (pedido del usuario, 21/11: "Siempre te
 * sigue"): el trabajo se nota en la luz de la cara y la antena; la marca, trabajando, mira lo suyo.
 */
export function sigueAhora(pose, ocupado, sigueOcupado = false) {
  return siguePuntero(pose) && (sigueOcupado || !ocupado)
}

/** Adónde mira por su cuenta: a lo suyo si trabaja y no sigue igual; si no, a ningún lado fijo. */
export const miraPropia = (ocupado, sigueOcupado = false) => (ocupado && !sigueOcupado ? MIRA_OCUPADO : null)

const saturar = (d, r) => d / (Math.abs(d) + r)
const limitar = n => Math.max(-1, Math.min(1, n))
const mezclar = (a, b, t) => a * (1 - t) + b * t

/** El centro de la mirada del Avi en su caja (px de la ventana): al medio y un poco abajo, en los ojos. */
const centro = caja => ({ x: caja.left + caja.width / 2, y: caja.top + caja.height * 0.55 })

/** Hacia dónde mira con el puntero en (`px`, `py`): satura con d / (|d| + 170) en x y d / (|d| + 140) en y. */
export function mirarPuntero(px, py, caja) {
  const c = centro(caja)
  return { x: saturar(px - c.x, 170), y: saturar(py - c.y, 140) }
}

/** Al salir de la ventana flotante: el vector hacia el punto de salida, normalizado y × 0,9. */
export function direccionSalida(px, py, caja) {
  const c = centro(caja)
  const dx = px - c.x, dy = py - c.y, n = Math.hypot(dx, dy) || 1
  return { x: (dx / n) * 0.9, y: (dy / n) * 0.9 }
}

/** Curiosea con el puntero quieto (`t` ms desde que empezó): izquierda 1,4 s, derecha 1,4 s, arriba 1,2 s, centro; ciclo de 7 s. */
export function curiosear(t) {
  const k = t % 7000
  return k < 1400 ? { x: -0.75, y: 0.05 } : k < 2800 ? { x: 0.7, y: -0.2 } : k < 4000 ? { x: 0, y: -0.55 } : { x: 0, y: 0 }
}

const SALIDA_MIRADA_MS = 1500
const QUIETO_MIRADA_MS = 5000

/**
 * Hacia dónde mira el Avi ahora y con qué suavizado (la parte del camino que recorre cada cuadro).
 * `sigue`: la pose sigue al puntero; `quieto`: movimiento reducido o pausa (al frente, sin suavizar);
 * `puntero`: la última posición conocida (px de la ventana) o null; `dentro`: el puntero está en la
 * ventana; `modo`: 'acoplada' (la posición global llega de Rust) o 'flotante'; `salio` y `dir`:
 * cuándo y hacia dónde salió; `ultimoMov`: último movimiento del puntero; `acto`: los valores del
 * juego en curso o null; `mira`: adónde mira cuando no sigue (por defecto, al frente; la muesca
 * trabajando, `MIRA_OCUPADO`).
 */
export function objetivoMirada({ sigue, quieto, puntero, dentro, modo, caja, ahora, salio, dir, ultimoMov, acto, mira = null }) {
  if (quieto) return { x: 0, y: 0, suave: 1 }
  let x = 0, y = 0, suave = 0.1
  if (!sigue) return { x: mira?.x ?? 0, y: mira?.y ?? 0, suave }
  const global = puntero != null && (dentro || modo === 'acoplada')
  if (global) ({ x, y } = mirarPuntero(puntero.x, puntero.y, caja))
  else if (ahora - salio < SALIDA_MIRADA_MS) ({ x, y } = dir)
  else suave = 0.06
  if (!acto && ahora - ultimoMov > QUIETO_MIRADA_MS && (global || ahora - salio > SALIDA_MIRADA_MS)) {
    ({ x, y } = curiosear(ahora - ultimoMov - QUIETO_MIRADA_MS))
    suave = 0.05
  }
  if (acto) {
    x = mezclar(x, acto.gx, acto.gw)
    y = mezclar(y, acto.gy, acto.gw)
    if (acto.gb > 0) {
      x = mezclar(x, limitar((acto.bx - 60) / 40), acto.gb)
      y = mezclar(y, limitar((acto.by - 66) / 34), acto.gb)
      suave = 0.24
    }
  }
  return { x, y, suave }
}

/**
 * El próximo momento en que la mirada cambia sola, sin que se mueva el puntero (fin de la mirada al
 * borde, comienzo del curioseo o el próximo tramo del curioseo). Así no hace falta un cuadro
 * permanente: un `setTimeout` la despierta.
 */
export function cambioMirada({ ahora, salio, ultimoMov }) {
  const momentos = []
  if (ahora - salio < SALIDA_MIRADA_MS) momentos.push(salio + SALIDA_MIRADA_MS)
  const t = ahora - ultimoMov - QUIETO_MIRADA_MS
  if (t < 0) momentos.push(ultimoMov + QUIETO_MIRADA_MS)
  else {
    const k = t % 7000
    momentos.push(ahora + ((k < 1400 ? 1400 : k < 2800 ? 2800 : k < 4000 ? 4000 : 7000) - k))
  }
  return Math.min(...momentos)
}
