// Tests de la marca "Escenario" (docs/diseno/marca-avi-ux.md): planificador del repertorio de reposo,
// pistas de los juegos, mirada y el SVG del Avi de la marca. Funciones puras de marca.js y avis.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  proximoReposo, REPOSO_PRIMERO_MS, REPOSO_ENTRE_MS, REPOSO_SIESTA_MS, REPOSO_LLAMA_MS, PESOS_REPOSO,
  ACTOS, REPOSO, valorPista, estadoActo, mirarPuntero, direccionSalida, objetivoMirada, cambioMirada,
  siguePuntero, sigueAhora, miraPropia, salida, SUELTA_MS, MIRA_OCUPADO, VOCES, VOZ_MS, canalesVoz, haciaVoz, puedeJugar, pesosMarca, opacidadLuz, escalaLuz,
} from '../src/marca.js'
import { svgAvi, claudeDe, POSES, poseAvi } from '../src/avis.js'

const CLAUDE = claudeDe('avi')

/** Un azar que devuelve los valores dados, en orden (y repite el último). */
const azarDe = (...v) => { let k = 0; return () => v[Math.min(k++, v.length - 1)] }
/** Todos los juegos que salen barriendo el azar del sorteo de 0 a 1. */
function sorteados(estado) {
  const ids = new Set()
  for (let k = 0; k < 200; k++) ids.add(proximoReposo({ ...estado, azar: azarDe(0.5, k / 200) }).id)
  return ids
}
const T0 = 1_000_000

test('los tiempos y pesos del reposo son los de la dirección (5.2)', () => {
  assert.equal(REPOSO_PRIMERO_MS, 40000)
  assert.deepEqual(REPOSO_ENTRE_MS, [60000, 150000])
  assert.equal(REPOSO_SIESTA_MS, 480000)
  assert.equal(REPOSO_LLAMA_MS, 900000)
  assert.deepEqual(PESOS_REPOSO, { pelota: 4, canta: 3, estira: 2, llama: 1 })
  assert.equal(SUELTA_MS, 280)
})

test('el primer juego de una racha sale a los 40 s de quietud', () => {
  const r = proximoReposo({ ahora: T0 + 1000, quietoDesde: T0, ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0, azar: azarDe(0.3) })
  assert.equal(r.en, T0 + 40000)
  assert.notEqual(r.id, 'siesta')
})

test('después del primero, uno cada 60 a 150 s al azar desde que terminó el anterior', () => {
  const base = { ahora: T0 + 50000, quietoDesde: T0, ultimoFin: T0 + 47000, ultimo: 'pelota', ultimaLlamada: null, juegos: 1 }
  assert.equal(proximoReposo({ ...base, azar: azarDe(0, 0.5) }).en, T0 + 47000 + 60000)
  assert.equal(proximoReposo({ ...base, azar: azarDe(0.5, 0.5) }).en, T0 + 47000 + 105000)
  const tope = proximoReposo({ ...base, azar: azarDe(0.9999, 0.5) }).en - (T0 + 47000)
  assert.ok(tope <= 150000 && tope > 149000)
})

test('nunca el mismo juego dos veces seguidas', () => {
  for (const ultimo of ['pelota', 'canta', 'estira', 'llama']) {
    const ids = sorteados({ ahora: T0, quietoDesde: T0, ultimoFin: T0, ultimo, ultimaLlamada: null, juegos: 3 })
    assert.ok(!ids.has(ultimo), `repitió ${ultimo}`)
    assert.ok(ids.size >= 2)
  }
})

test('"te llama" nunca es el primero de una racha', () => {
  const ids = sorteados({ ahora: T0, quietoDesde: T0, ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0 })
  assert.deepEqual([...ids].sort(), ['canta', 'estira', 'pelota'])
})

test('"te llama" sale a lo sumo una vez cada 15 min', () => {
  // El próximo juego cae 60 s después de ultimoFin (azar 0): la llamada fue 14 min antes de eso
  const base = { ahora: T0, quietoDesde: T0 - 60000, ultimoFin: T0, ultimo: 'pelota', juegos: 2 }
  const en = T0 + 60000
  assert.ok(!sorteadosCon({ ...base, ultimaLlamada: en - 14 * 60000 }).has('llama'))
  assert.ok(sorteadosCon({ ...base, ultimaLlamada: en - 15 * 60000 }).has('llama'))
  assert.ok(sorteadosCon({ ...base, ultimaLlamada: null }).has('llama'))
})
function sorteadosCon(estado) {
  const ids = new Set()
  for (let k = 0; k < 200; k++) ids.add(proximoReposo({ ...estado, azar: azarDe(0, k / 200) }).id)
  return ids
}

test('el sorteo respeta los pesos 4 · 3 · 2 · 1', () => {
  const cuenta = {}
  const n = 1000
  for (let k = 0; k < n; k++) {
    const id = proximoReposo({ ahora: T0, quietoDesde: T0, ultimoFin: T0, ultimo: null, ultimaLlamada: null, juegos: 1, azar: azarDe(0, (k + 0.5) / n) }).id
    cuenta[id] = (cuenta[id] ?? 0) + 1
  }
  assert.deepEqual(cuenta, { pelota: 400, canta: 300, estira: 200, llama: 100 })
})

test('a los 8 min de quietud, en lugar de un juego, siesta', () => {
  // El próximo juego caería después de los 8 min: va la siesta, justo a los 8 min
  const r = proximoReposo({ ahora: T0 + 470000, quietoDesde: T0, ultimoFin: T0 + 460000, ultimo: 'canta', ultimaLlamada: null, juegos: 6, azar: azarDe(0.5, 0.5) })
  assert.deepEqual(r, { id: 'siesta', en: T0 + REPOSO_SIESTA_MS })
  // Si el juego cae antes de los 8 min, va el juego
  const j = proximoReposo({ ahora: T0 + 300000, quietoDesde: T0, ultimoFin: T0 + 300000, ultimo: 'canta', ultimaLlamada: null, juegos: 4, azar: azarDe(0, 0.5) })
  assert.equal(j.en, T0 + 360000)
  assert.notEqual(j.id, 'siesta')
})

test('los juegos duran lo de la tabla 7.3', () => {
  const dur = Object.fromEntries(Object.entries(ACTOS).map(([id, f]) => [id, f().dur]))
  assert.deepEqual(dur, { pelota: 6600, canta: 6200, llama: 4600, estira: 4400, siesta: 3400, despierta: 1000, cucu: 2600 })
  assert.equal(ACTOS.siesta().lazo, true)
})

// Canales de la mirada: los suaviza la mirada (6), así que no necesitan terminar en el reposo
const MIRADA = new Set(['gx', 'gy', 'gw', 'gb'])
/** Canales que no se ven cuando su opacidad termina en 0 (la pelota y cada mano). */
const OCULTOS = { bo: ['bx', 'br', 'bs', 'by'], moI: ['mIx', 'mIy', 'mIr'], moD: ['mDx', 'mDy', 'mDr'] }

test('todos los juegos (menos la siesta) terminan en el reposo', () => {
  for (const [id, f] of Object.entries(ACTOS)) {
    const def = f()
    if (def.lazo) continue
    const fin = estadoActo(def, def.dur)
    const ocultos = new Set(Object.entries(OCULTOS).filter(([o]) => fin[o] === 0).flatMap(([, v]) => v))
    for (const k of Object.keys(REPOSO)) {
      if (MIRADA.has(k) || ocultos.has(k)) continue
      assert.ok(Math.abs(fin[k] - REPOSO[k]) < 1e-9, `${id}: ${k} termina en ${fin[k]}, no en ${REPOSO[k]}`)
    }
  }
})

test('las pistas usan canales conocidos, con tiempos que no retroceden y dentro de la duración', () => {
  for (const [id, f] of Object.entries(ACTOS)) {
    const def = f()
    for (const [k, pista] of Object.entries(def.pistas)) {
      assert.ok(k in REPOSO, `${id}: canal desconocido ${k}`)
      for (let n = 1; n < pista.length; n++) assert.ok(pista[n][0] >= pista[n - 1][0], `${id}.${k} retrocede`)
      assert.ok(pista[pista.length - 1][0] <= def.dur, `${id}.${k} pasa la duración`)
    }
    for (const [t] of def.eventos ?? []) assert.ok(t >= 0 && t <= def.dur)
  }
})

test('la pelota nunca sale de la zona de juego (x de −40 a 160, y ≥ −6)', () => {
  const def = ACTOS.pelota()
  for (let t = 0; t <= def.dur; t += 20) {
    const v = estadoActo(def, t)
    if (v.bo === 0) continue
    assert.ok(v.bx >= -40 && v.bx <= 160, `bx ${v.bx} a los ${t} ms`)
    assert.ok(v.by >= -6, `by ${v.by} a los ${t} ms`)
  }
})

test('canta: 8 notas en compases de 520 ms y una nota final grande', () => {
  const ev = ACTOS.canta().eventos.filter(([, que]) => que === 'nota')
  assert.equal(ev.length, 9)
  assert.equal(ev[1][0] - ev[0][0], 520)
  assert.equal(ev[8][2].grande, true)
})

test('las curvas de las pistas: salida, entrada, escalón y back', () => {
  const p = [[0, 0], [100, 1, 'o']]
  assert.equal(valorPista(p, -5), 0)
  assert.equal(valorPista(p, 50), 1 - 0.5 ** 3)
  assert.equal(valorPista(p, 500), 1)
  assert.equal(valorPista([[0, 0], [100, 1, 'i']], 50), 0.125)
  assert.equal(valorPista([[0, 0], [100, 2, 's']], 99), 0)
  assert.ok(valorPista([[0, 0], [100, 1, 'b']], 70) > 1)
})

test('soltar un juego: todos los canales vuelven al reposo en 280 ms; pelota y globito en 180', () => {
  const desde = { ...REPOSO, y: -10, sx: 1.08, bo: 1, globo: 1, ant: -22 }
  const s = salida(desde)
  assert.equal(s.dur, SUELTA_MS)
  assert.equal(estadoActo(s, 0).y, -10)
  assert.equal(estadoActo(s, 180).bo, 0)
  assert.equal(estadoActo(s, 180).globo, 0)
  const fin = estadoActo(s, SUELTA_MS)
  for (const k of Object.keys(REPOSO)) assert.equal(fin[k], REPOSO[k], k)
})

test('la mirada satura: nunca bizquea ni sale de la cara', () => {
  const caja = { left: 100, top: 100, width: 112, height: 112 }
  const cx = 156, cy = 100 + 112 * 0.55
  assert.deepEqual(mirarPuntero(cx, cy, caja), { x: 0, y: 0 })
  const m = mirarPuntero(cx + 170, cy - 140, caja)
  assert.equal(m.x, 0.5)
  assert.equal(m.y, -0.5)
  const lejos = mirarPuntero(cx + 1e6, cy + 1e6, caja)
  assert.ok(lejos.x < 1 && lejos.y < 1 && lejos.x > 0.99)
})

test('al salir mira 0,9 hacia el borde por donde salió el puntero', () => {
  const caja = { left: 0, top: 0, width: 100, height: 100 }
  const d = direccionSalida(50 + 300, 55, caja)
  assert.ok(Math.abs(d.x - 0.9) < 1e-9 && Math.abs(d.y) < 1e-9)
})

const CAJA = { left: 40, top: 20, width: 112, height: 112 }
const base = { sigue: true, quieto: false, dentro: true, modo: 'flotante', caja: CAJA, ahora: 10000, salio: -Infinity, dir: { x: 0, y: 0 }, ultimoMov: 9000, acto: null }

test('mirada: dentro de la ventana sigue al puntero con suavizado del 10 %', () => {
  const o = objetivoMirada({ ...base, puntero: { x: 400, y: 76 } })
  assert.equal(o.suave, 0.1)
  assert.deepEqual({ x: o.x, y: o.y }, mirarPuntero(400, 76, CAJA))
})

test('mirada fuera: acoplada sigue la posición global; flotante mira 1,5 s al borde y vuelve al centro', () => {
  const fuera = { ...base, dentro: false, puntero: { x: -300, y: 76 }, salio: 9500, dir: { x: -0.9, y: 0 } }
  const acoplada = objetivoMirada({ ...fuera, modo: 'acoplada' })
  assert.deepEqual({ x: acoplada.x, y: acoplada.y }, mirarPuntero(-300, 76, CAJA))
  const flotante = objetivoMirada(fuera)
  assert.deepEqual({ x: flotante.x, y: flotante.y }, { x: -0.9, y: 0 })
  const despues = objetivoMirada({ ...fuera, ahora: 11100 })
  assert.deepEqual(despues, { x: 0, y: 0, suave: 0.06 })
})

test('mirada: con el puntero quieto 5 s curiosea (izquierda, derecha, arriba, centro)', () => {
  const q = { ...base, puntero: { x: 400, y: 76 }, ultimoMov: 0 }
  const a = objetivoMirada({ ...q, ahora: 5000 + 100 })
  const b = objetivoMirada({ ...q, ahora: 5000 + 2000 })
  const c = objetivoMirada({ ...q, ahora: 5000 + 3000 })
  const d = objetivoMirada({ ...q, ahora: 5000 + 5000 })
  assert.ok(a.x < 0 && b.x > 0 && c.y < 0 && d.x === 0 && d.y === 0)
  assert.equal(a.suave, 0.05)
})

test('mirada: durante un juego manda el juego; con la pelota la sigue con suavizado del 24 %', () => {
  const v = { ...REPOSO, gw: 1, gx: 0, gy: -0.3 }
  const canta = objetivoMirada({ ...base, puntero: { x: 400, y: 76 }, acto: v })
  assert.equal(canta.x, 0)
  assert.equal(canta.y, -0.3)
  const pelota = objetivoMirada({ ...base, puntero: { x: 400, y: 76 }, acto: { ...REPOSO, gb: 1, bx: 100, by: 66 } })
  assert.equal(pelota.x, 1)
  assert.equal(pelota.y, 0)
  assert.equal(pelota.suave, 0.24)
})

test('mirada: con movimiento reducido o en una pose que no sigue, al frente', () => {
  assert.deepEqual(objetivoMirada({ ...base, quieto: true, puntero: { x: 400, y: 76 } }), { x: 0, y: 0, suave: 1 })
  assert.equal(objetivoMirada({ ...base, sigue: false, puntero: { x: 400, y: 76 } }).x, 0)
  assert.ok(siguePuntero('esperando') && siguePuntero('teEspera'))
  for (const p of ['escribiendo', 'leyendo', 'proceso', 'durmiendo', 'coordinando']) assert.ok(!siguePuntero(p))
})

test('la mirada se despierta sola en el próximo cambio por tiempo (sin un cuadro permanente)', () => {
  assert.equal(cambioMirada({ ahora: 1000, salio: -Infinity, ultimoMov: 0 }), 5000)
  assert.equal(cambioMirada({ ahora: 1000, salio: 500, ultimoMov: 0 }), 2000)
  assert.equal(cambioMirada({ ahora: 5000 + 100, salio: -Infinity, ultimoMov: 0 }), 5000 + 1400)
  assert.equal(cambioMirada({ ahora: 5000 + 4500, salio: -Infinity, ultimoMov: 0 }), 5000 + 7000)
})

test('el Avi de la marca trae las capas del escenario (5.3) y el brillo sin filtro', () => {
  const s = svgAvi(CLAUDE, 'esperando', false, { marca: true })
  for (const c of ['actua', 'inclina', 'cuerpo', 'antena', 'foco', 'bulbo', 'c-brillo', 'c-mejillas', 'mirada', 'parpado', 'ojos', 'e-ab', 'e-fe', 'e-ce', 'c-pico', 'boca', 'pico-i', 'pico-s', 'mn-i', 'mn-d', 'zs', 'notas', 'globo', 'bola', 'bola-r', 'b-sombra', 'contacto']) {
    assert.match(s, new RegExp(`class="[^"]*\\b${c}\\b`), c)
  }
  assert.match(s, /class="e-esperando es-marca"/)
  assert.match(s, /M56 78\.5Q60 76\.8 64 78\.5Q60 80\.8 56 78\.5Z/)
  assert.match(s, /M56\.4 79\.2Q60 81\.2 63\.6 79\.2Q60 85\.5 56\.4 79\.2Z/)
  assert.match(s, />¡ey!</)
  assert.doesNotMatch(s, /fBlur/)
})

test('los demás Avis no cambian: sin capas del escenario, pico entero y brillo de siempre', () => {
  const s = svgAvi(CLAUDE, 'esperando')
  assert.match(s, /^<svg viewBox="0 0 120 120" class="e-esperando" aria-hidden="true" focusable="false"><ellipse class="suelo"/)
  assert.match(s, /<g class="cuerpo"><path d="M60 38V19"/)
  assert.match(s, /<path class="pico" d="M56 78\.5Q60 85\.5 64 78\.5Q60 76\.8 56 78\.5Z"\/>/)
  for (const c of ['actua', 'inclina', 'parpado', 'globo', 'bola', 'notas']) assert.doesNotMatch(s, new RegExp(`class="${c}"`))
})

// ------------------------------------------------------------------ muesca A "Asoma" (muesca-avi-ux.md 7 y 9)

test('cucú: 2600 ms, se esconde 62 u (queda la antena) y nunca más, vuelve con sobrepique y termina en el reposo', () => {
  const def = ACTOS.cucu()
  assert.equal(def.id, 'cucu')
  assert.equal(def.dur, 2600)
  let max = -Infinity
  for (let t = 0; t <= def.dur; t += 2) max = Math.max(max, estadoActo(def, t).y)
  assert.equal(max, 62)
  assert.equal(estadoActo(def, 600).y, 62)
  assert.ok(estadoActo(def, 1254).y < -14, 'sobrepique hacia arriba al volver')
  const fin = estadoActo(def, def.dur)
  for (const k of Object.keys(REPOSO)) assert.equal(fin[k], REPOSO[k], k)
})

test('cucú: ojos contentos y manos agarradas al alféizar de 1150 a 2600 ms', () => {
  const def = ACTOS.cucu()
  assert.equal(REPOSO.asir, 0)
  assert.deepEqual([estadoActo(def, 1149).ojos, estadoActo(def, 1149).asir], [0, 0])
  assert.deepEqual([estadoActo(def, 1150).ojos, estadoActo(def, 1150).asir], [1, 1])
  assert.deepEqual([estadoActo(def, 2599).ojos, estadoActo(def, 2599).asir], [1, 1])
  assert.deepEqual([estadoActo(def, 2600).ojos, estadoActo(def, 2600).asir], [0, 0])
  // Soltarlo a mitad de camino también suelta las manos
  assert.equal(estadoActo(salida(estadoActo(def, 2000)), SUELTA_MS).asir, 0)
})

test('repertorio de la muesca { cucu: 1 }: siempre cucú, 40 s y 60–150 s, siesta (se aquieta) a los 8 min', () => {
  const pesos = { cucu: 1 }
  const primero = proximoReposo({ quietoDesde: T0, ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0, azar: azarDe(0.3, 0.9), pesos })
  assert.deepEqual(primero, { id: 'cucu', en: T0 + REPOSO_PRIMERO_MS })
  // Con un solo juego no aplica "nunca dos veces seguidas"
  for (let k = 0; k < 20; k++) {
    const r = proximoReposo({ quietoDesde: T0, ultimoFin: T0 + 41000, ultimo: 'cucu', ultimaLlamada: null, juegos: 3, azar: azarDe(0, k / 20), pesos })
    assert.equal(r.id, 'cucu')
  }
  assert.equal(proximoReposo({ quietoDesde: T0, ultimoFin: T0 + 41000, ultimo: 'cucu', ultimaLlamada: null, juegos: 1, azar: azarDe(0, 0.5), pesos }).en, T0 + 41000 + 60000)
  assert.equal(proximoReposo({ quietoDesde: T0, ultimoFin: T0 + 41000, ultimo: 'cucu', ultimaLlamada: null, juegos: 1, azar: azarDe(1, 0.5), pesos }).en, T0 + 41000 + 150000)
  assert.deepEqual(proximoReposo({ quietoDesde: T0, ultimoFin: T0 + 460000, ultimo: 'cucu', ultimaLlamada: null, juegos: 6, azar: azarDe(0.5, 0.5), pesos }), { id: 'siesta', en: T0 + REPOSO_SIESTA_MS })
  // El azar se pide dos veces, en el mismo orden, también con un solo juego
  let pedidos = 0
  proximoReposo({ quietoDesde: T0, ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0, azar: () => { pedidos++; return 0.5 }, pesos })
  assert.equal(pedidos, 2)
})

test('la marca no cambia: sin pesos sortea con los de siempre (4 · 3 · 2 · 1)', () => {
  for (let k = 0; k < 50; k++) {
    const e = { quietoDesde: T0, ultimoFin: T0, ultimo: 'canta', ultimaLlamada: null, juegos: 2 }
    const a = proximoReposo({ ...e, azar: azarDe(0.4, k / 50) })
    const b = proximoReposo({ ...e, azar: azarDe(0.4, k / 50), pesos: PESOS_REPOSO })
    assert.deepEqual(a, b)
    assert.notEqual(a.id, 'cucu')
  }
})

test('mirada con `mira`: si no sigue (trabajando) mira fijo hacia lo suyo, abajo a la derecha', () => {
  assert.deepEqual(MIRA_OCUPADO, { x: 0.3, y: 0.7 })
  const o = objetivoMirada({ ...base, sigue: false, mira: MIRA_OCUPADO, puntero: { x: 400, y: 76 } })
  assert.deepEqual({ x: o.x, y: o.y }, MIRA_OCUPADO)
  // Sin `mira`, al frente (la marca de siempre)
  assert.deepEqual(objetivoMirada({ ...base, sigue: false, puntero: { x: 400, y: 76 } }), { x: 0, y: 0, suave: 0.1 })
  // Movimiento reducido o pausa: al frente aunque trabaje
  assert.deepEqual(objetivoMirada({ ...base, sigue: false, quieto: true, mira: MIRA_OCUPADO }), { x: 0, y: 0, suave: 1 })
})

test('el curioseo se repite mientras el puntero siga quieto (la marca y la muesca)', () => {
  const q = { ...base, puntero: { x: 400, y: 76 }, ultimoMov: 0 }
  // Segunda vuelta: otra vez izquierda, derecha, arriba
  assert.ok(objetivoMirada({ ...q, ahora: 5000 + 7000 + 100 }).x < 0)
  assert.ok(objetivoMirada({ ...q, ahora: 5000 + 7000 + 2000 }).x > 0)
  assert.equal(cambioMirada({ ahora: 5000 + 7000 + 4500, salio: -Infinity, ultimoMov: 0 }), 5000 + 14000)
})

test('el Avi de la marca envuelve los efectos de la pose en g.efectos (la muesca los esconde enteros)', () => {
  const s = svgAvi(CLAUDE, 'teEspera', false, { marca: true })
  assert.match(s, /<g class="efectos"><g class="burbuja">.*?<\/g><\/g><g class="notas">/)
  assert.match(svgAvi(CLAUDE, 'esperando', false, { marca: true }), /<g class="efectos"><\/g><g class="notas">/)
  // Los demás Avis no lo llevan
  assert.doesNotMatch(svgAvi(CLAUDE, 'teEspera'), /class="efectos"/)
})

test('la muesca te sigue aunque trabaje ("Siempre te sigue"); la marca, trabajando, mira lo suyo', () => {
  // Muesca (sigueOcupado): trabajando igual sigue y no tiene mirada propia
  assert.ok(sigueAhora('esperando', true, true))
  assert.equal(miraPropia(true, true), null)
  // Marca (lo de antes, sin cambios): trabajando no sigue y mira lo suyo
  assert.ok(!sigueAhora('esperando', true))
  assert.deepEqual(miraPropia(true), MIRA_OCUPADO)
  // Sin trabajo, las dos siguen; las poses que no miran nunca siguen
  assert.ok(sigueAhora('esperando', false) && sigueAhora('teEspera', false, true))
  assert.ok(!sigueAhora('durmiendo', false, true))
  assert.equal(miraPropia(false), null)
})

// ------------------------------------------------------------------ voz del resumen (resumen-ia-ux.md 6.2 y 6.3)

const listo = { visto: true, quieto: false, reposo: true, pose: 'esperando', ocupado: false, voz: null }

test('juegos: sin voz, la marca juega como siempre (se ve, se mueve, en reposo, esperando y sin trabajo)', () => {
  assert.equal(puedeJugar(listo), true)
  for (const k of ['visto', 'reposo']) assert.equal(puedeJugar({ ...listo, [k]: false }), false, k)
  assert.equal(puedeJugar({ ...listo, quieto: true }), false)
  assert.equal(puedeJugar({ ...listo, ocupado: true }), false)
  assert.equal(puedeJugar({ ...listo, pose: 'teEspera' }), false)
})

test('juegos suspendidos: con una voz puesta (el globo abierto) no juega, aunque la voz sea "esperando"', () => {
  for (const voz of Object.keys(VOCES)) assert.equal(puedeJugar({ ...listo, voz }), false, voz)
})

test('VOCES: la mirada y los canales sostenidos de cada pose (6.2)', () => {
  assert.deepEqual(Object.keys(VOCES).sort(), ['baja', 'calienta', 'contando', 'error', 'esperando', 'feliz', 'pensando', 'teEspera'])
  assert.equal(VOZ_MS, 360)
  assert.equal(VOCES.esperando.mira, null, 'apagado: sigue al puntero')
  assert.equal(VOCES.teEspera.mira, null)
  assert.deepEqual(VOCES.baja.mira, { x: 0.55, y: 0.6 })
  assert.deepEqual(VOCES.calienta.mira, { x: 0, y: 0 })
  assert.deepEqual(VOCES.pensando.mira, { x: 0.5, y: -0.75 })
  assert.deepEqual(VOCES.contando.mira, { x: 0.6, y: 0.15 })
  assert.deepEqual(VOCES.feliz.mira, { x: 0.6, y: 0.15 })
  assert.deepEqual(VOCES.error.mira, { x: 0, y: 0 })
  assert.equal(canalesVoz('calienta').par, 0.9)
  assert.equal(canalesVoz('feliz').ojos, 1)
  assert.deepEqual([canalesVoz('error').ant, canalesVoz('error').luz, canalesVoz('error').par], [18, -1, 0.8])
})

test('cada voz deja los canales dentro de la zona de juego; null los devuelve al reposo', () => {
  for (const pose of Object.keys(VOCES)) {
    const v = canalesVoz(pose)
    assert.deepEqual(Object.keys(v).sort(), Object.keys(REPOSO).sort(), pose)
    assert.ok(Math.abs(v.ant) <= 22 && v.luz >= -1 && v.luz <= 1 && v.par >= 0 && v.par <= 1.28 && [0, 1, 2].includes(v.ojos), pose)
    assert.ok(v.boca >= 0 && v.boca <= 1 && v.bo === 0 && v.globo === 0, `${pose}: sin pelota ni globito`)
  }
  assert.deepEqual(canalesVoz(null), REPOSO)
})

test('llevar los canales a una voz: 360 ms desde los de ahora y termina en los de la voz', () => {
  const desde = { ...REPOSO, ant: -10, par: 0.4 }
  const def = haciaVoz(desde, 'error')
  assert.equal(def.dur, 360)
  assert.equal(def.sostiene, true, 'queda en su último cuadro')
  assert.deepEqual(estadoActo(def, 0), { ...desde, ojos: canalesVoz('error').ojos })
  assert.deepEqual(estadoActo(def, 360), canalesVoz('error'))
})

test('las poses nuevas de la voz: solo las dibuja la marca, con las cejas en "error"', () => {
  for (const pose of ['baja', 'calienta', 'contando', 'feliz', 'error']) {
    assert.ok(POSES.includes(pose), pose)
    assert.equal(poseAvi(pose).pose, pose)
    assert.match(svgAvi(CLAUDE, pose, false, { marca: true }), new RegExp(`class="e-${pose} es-marca"`))
  }
  assert.match(svgAvi(CLAUDE, 'error', false, { marca: true }), /<path class="trazo cejas" d="M44 60\.5L52\.5 57\.5M76 60\.5L67\.5 57\.5"\/>/)
  // Los demás Avis no llevan cejas, y el ánimo de una sesión nunca pide estas poses
  assert.doesNotMatch(svgAvi(CLAUDE, 'error'), /cejas/)
  assert.equal(poseAvi('editando').pose, 'escribiendo')
})

// ------------------------------------------------------------------ las especies nuevas (mascotas-avi-ux.md 10, P3)

test('entrega 5 (P3): todas las especies juegan el repertorio del Avi, con las mismas pistas', () => {
  for (const e of ['avi', 'ascua', 'escarcha', 'nodo', 'bruma', 'morro', 'lumen', 'nimbo']) assert.equal(pesosMarca(e), PESOS_REPOSO, e)
  // Lo que no es una especie es el Avi (especieValida): el mismo repertorio
  assert.equal(pesosMarca('dragon'), PESOS_REPOSO)
  assert.equal(pesosMarca(undefined), PESOS_REPOSO)
  // Los cinco juegos salen del sorteo de siempre (la siesta, a los 8 min)
  assert.deepEqual([...sorteados({ quietoDesde: T0, ultimoFin: T0 + 50000, ultimo: null, ultimaLlamada: null, juegos: 1, pesos: pesosMarca('nodo') })].sort(), ['canta', 'estira', 'llama', 'pelota'])
})

test('la luz propia de cada especie (P2 y P3): sube hacia 1 y crece como el foco; se apaga como el bulbo del Avi', () => {
  // Reposo: la de siempre, tamaño 1
  for (const base of [0, 0.2, 0.7, 1]) {
    assert.equal(opacidadLuz(base, 0), base)
    assert.equal(escalaLuz(0), 1)
  }
  // Sube: hacia 1 en proporción; con 1, entera y un 40 % más grande (el foco del Avi: 1 + luz × 0,4)
  assert.equal(opacidadLuz(0.2, 1), 1)
  assert.equal(+opacidadLuz(0.2, 0.5).toFixed(3), 0.6)
  assert.equal(escalaLuz(1), 1.4)
  assert.equal(escalaLuz(0.5), 1.2)
  // Se apaga: con −1 queda al 45 % de la de reposo (el bulbo del Avi: 1 − 0,55 × |luz|), sin achicarse
  assert.equal(+opacidadLuz(1, -1).toFixed(3), 0.45)
  assert.equal(+opacidadLuz(0.2, -1).toFixed(3), 0.09)
  assert.equal(escalaLuz(-1), 1)
})

test('sin juegos (un repertorio vacío): solo la siesta a los 8 min', () => {
  // Sin juegos, el próximo evento es la siesta a los 8 min de quietud (el azar se pide igual dos veces)
  let pedidos = 0
  const azar = () => { pedidos++; return 0.3 }
  assert.deepEqual(proximoReposo({ quietoDesde: T0, ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0, azar, pesos: {} }), { id: 'siesta', en: T0 + REPOSO_SIESTA_MS })
  assert.equal(pedidos, 2)
  assert.deepEqual(proximoReposo({ quietoDesde: T0, ultimoFin: T0 + 5000, ultimo: 'siesta', ultimaLlamada: null, juegos: 1, azar: azarDe(0.1), pesos: {} }), { id: 'siesta', en: T0 + REPOSO_SIESTA_MS })
  // Con el repertorio de siempre, nada cambia: el primer juego a los 40 s
  assert.equal(proximoReposo({ quietoDesde: T0, ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0, azar: azarDe(0.3, 0) }).en, T0 + REPOSO_PRIMERO_MS)
})
