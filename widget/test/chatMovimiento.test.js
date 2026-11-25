// Tests del movimiento de la charla (docs/diseno/chat-avis-ux.md 6, entrega 3): las pistas de abrir y
// cerrar la hoja, el recorte por lado, el vuelo de la mascota, el modo según movimiento reducido y
// pausa, las palabras que entran sin volver a animar las que ya están, y que los bucles de CSS solo
// corran con movimiento y sin pausa. Funciones puras de chat.js y chatVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PISTAS_ABRIR, PISTAS_CERRAR, FUNDIDO_MS, CAMBIA_LADO_MS, ADELANTO_PLIEGUE_MS, recorteHoja, pistaVuelo, pistaVuelta,
  modoMovimiento, piezasPalabras, tramoVivo, ESCALA_VUELO,
} from '../src/chat.js'
import { textoVivo, htmlPalabras } from '../src/chatVista.js'

// ------------------------------------------------------------------ 6.1: abrir la hoja

test('las pistas de abrir son las de 6.1 (inicio y duración en ms)', () => {
  const P = PISTAS_ABRIR
  assert.deepEqual(P.agacha, { en: 0, dura: 120 })
  assert.deepEqual(P.fantasma, { en: 0, dura: 400 })
  assert.deepEqual(P.hoja, { en: 80, dura: 640 })
  assert.deepEqual(P.vuelo, { en: 120, dura: 900 })
  // Las alas, colas y tentáculos llegan 80 ms tarde
  assert.deepEqual(P.inclina, { en: 200, dura: 900 })
  assert.deepEqual(P.contenido, { en: 600, dura: 520, escalon: 45, sube: 10 })
  // Aterriza cuando termina el vuelo: el destello del piso dura 300 ms y el Avi real aparece ahí
  assert.equal(P.aterriza.en, P.vuelo.en + P.vuelo.dura)
  assert.equal(P.aterriza.dura, 300)
  assert.equal(P.llega.en, 1020)
})

test('las pistas de cerrar: el contenido se funde en 160, el vuelo de vuelta dura 700 y la hoja se pliega en 420', () => {
  const P = PISTAS_CERRAR
  assert.deepEqual(P.contenido, { en: 0, dura: 160 })
  assert.deepEqual(P.vuelo, { en: 0, dura: 700 })
  assert.equal(P.hoja.dura, 420)
  assert.ok(P.hoja.en + P.hoja.dura <= P.vuelo.dura, 'la hoja termina antes de que la mascota llegue')
  assert.equal(P.llega.en, 700)
})

test('fundidos y tiempos sueltos: 160 ms con movimiento reducido, 180 al cambiar de lado, 60 de adelanto al plegar', () => {
  assert.equal(FUNDIDO_MS, 160)
  assert.equal(CAMBIA_LADO_MS, 180)
  assert.equal(ADELANTO_PLIEGUE_MS, 60)
})

test('recorteHoja: se despliega desde el lado del tablero', () => {
  // A la derecha (o encima, tapando la columna): crece de izquierda a derecha y entra desde -30
  for (const lado of ['derecha', 'encima']) {
    assert.deepEqual(recorteHoja(lado), {
      cerrada: 'inset(0px 100% 0px 0px round 26px)', abierta: 'inset(0px 0% 0px 0px round 26px)', dx: -30,
    })
  }
  // A la izquierda: crece desde la derecha y entra desde +30
  assert.deepEqual(recorteHoja('izquierda'), {
    cerrada: 'inset(0px 0px 0px 100% round 26px)', abierta: 'inset(0px 0px 0px 0% round 26px)', dx: 30,
  })
})

test('pistaVuelo: el arco de 6.1, con la escala 96/112 y el giro según hacia dónde vuela', () => {
  assert.equal(ESCALA_VUELO, 96 / 112)
  const k = 96 / 112
  const { cuerpo, giro } = pistaVuelo(200, 100)
  assert.deepEqual(cuerpo.map(c => c.t), [0, 50, 86, 100])
  assert.deepEqual(cuerpo[0], { t: 0, x: 0, y: 0, s: 1 })
  assert.deepEqual(cuerpo[1], { t: 50, x: 90, y: -75, s: 1.08 })
  assert.deepEqual(cuerpo[2], { t: 86, x: 200, y: 100, s: +(k * 1.06).toFixed(4) })
  assert.deepEqual(cuerpo[3], { t: 100, x: 200, y: 100, s: +k.toFixed(4) })
  // Hacia la derecha: se inclina -10 en el aire y +3 al llegar; hacia la izquierda, al revés
  assert.deepEqual(giro.map(g => [g.t, g.r]), [[0, 0], [50, -10], [86, 3], [100, 0]])
  assert.deepEqual(pistaVuelo(-200, 100).giro.map(g => g.r), [0, 10, -3, 0])
})

test('pistaVuelta: el mismo arco al revés, desde el escenario hasta la marca', () => {
  const ida = pistaVuelo(200, 100)
  const vuelta = pistaVuelta(200, 100)
  assert.deepEqual(vuelta.cuerpo.map(c => c.t), [0, 14, 50, 100])
  assert.deepEqual(vuelta.cuerpo.map(({ x, y, s }) => ({ x, y, s })), ida.cuerpo.slice().reverse().map(({ x, y, s }) => ({ x, y, s })))
  // De vuelta vuela hacia el otro lado: el giro cambia de signo
  assert.deepEqual(vuelta.giro.map(g => [g.t, g.r]), [[0, 0], [14, -3], [50, 10], [100, 0]])
})

test('modoMovimiento: completo; con movimiento reducido, solo fundidos; con pausa, nada', () => {
  assert.equal(modoMovimiento({ reducido: false, pausa: false }), 'completo')
  assert.equal(modoMovimiento({ reducido: true, pausa: false }), 'fundido')
  assert.equal(modoMovimiento({ reducido: false, pausa: true }), 'nada')
  assert.equal(modoMovimiento({ reducido: true, pausa: true }), 'nada')
})

// ------------------------------------------------------------------ 6.2: las palabras

test('piezasPalabras: una palabra por pieza, con sus espacios; juntas dan el texto', () => {
  assert.deepEqual(piezasPalabras('Hola, ¿cómo va?'), ['Hola, ', '¿cómo ', 'va?'])
  assert.deepEqual(piezasPalabras(' y  sigue\n'), [' y  ', 'sigue\n'])
  assert.deepEqual(piezasPalabras('   '), ['   '])
  assert.deepEqual(piezasPalabras(''), [])
  const t = 'Uno dos\ntres  cuatro '
  assert.equal(piezasPalabras(t).join(''), t)
})

test('tramoVivo: lo que llega se agrega al bloque abierto sin tocar lo ya puesto', () => {
  const r = tramoVivo('Hola, est', 'Hola, estoy acá')
  assert.equal(r.continua, true)
  assert.equal(r.reinicia, false)
  assert.equal(r.visto, 'Hola, est')
  assert.equal(r.nuevo, 'oy acá')
  assert.deepEqual(r.cerrados, [])
})

test('tramoVivo: al cerrarse un bloque, el abierto nuevo trae solo lo que no se vio', () => {
  const r = tramoVivo('Hola.\n\nSeg', 'Hola.\n\nSegundo párrafo.\n\nTer')
  assert.equal(r.continua, false)
  assert.deepEqual(r.cerrados, ['Hola.', 'Segundo párrafo.'])
  assert.equal(r.abierto, 'Ter')
  assert.equal(r.visto, '')
  assert.equal(r.nuevo, 'Ter')
  // Un bloque cerrado por la cerca: lo que ya estaba a la vista no vuelve a entrar
  const c = tramoVivo('```js\nx', '```js\nx\n```\nDespués')
  assert.deepEqual(c.cerrados, ['```js\nx\n```'])
  assert.equal(c.visto, '')
  assert.equal(c.nuevo, 'Después')
  // Lo visto del bloque abierto nuevo, cuando el corte cae a mitad de lo que ya estaba
  const d = tramoVivo('Uno\n\nDos tr', 'Uno\n\nDos tres')
  assert.equal(d.continua, true)
  assert.equal(d.visto, 'Dos tr')
  assert.equal(d.nuevo, 'es')
})

test('tramoVivo: si el texto no sigue a lo que había, se dibuja de nuevo entero', () => {
  assert.equal(tramoVivo('Hola', 'Chau').reinicia, true)
  assert.equal(tramoVivo('', 'Hola').reinicia, false)
  assert.equal(tramoVivo('', 'Hola').nuevo, 'Hola')
})

test('textoVivo sin lo mostrado: como antes, el abierto como texto, sin palabras animadas', () => {
  const html = textoVivo('Hola.\n\nSegun')
  assert.match(html, /<p class="abierto">Segun<\/p>/)
  assert.doesNotMatch(html, /class="w"/)
  assert.match(html, /data-bloques="1"/)
})

test('textoVivo con lo mostrado: solo lo nuevo entra con .w; lo ya visto queda quieto', () => {
  const todo = textoVivo('Hola, ¿cómo va?', '')
  assert.equal((todo.match(/class="w"/g) ?? []).length, 3)
  const parte = textoVivo('Hola, ¿cómo va?', 'Hola, ')
  assert.match(parte, /<p class="abierto">Hola, <span class="w">¿cómo <\/span><span class="w">va\?<\/span><\/p>/)
  // Sin movimiento, nada de .w (el texto llega igual)
  assert.doesNotMatch(textoVivo('Hola, ¿cómo va?', '', false), /class="w"/)
})

test('htmlPalabras escapa cada palabra: el texto del modelo nunca es HTML', () => {
  assert.equal(htmlPalabras('<b>x</b> y'), '<span class="w">&lt;b&gt;x&lt;/b&gt; </span><span class="w">y</span>')
  assert.equal(htmlPalabras('<i>', false), '&lt;i&gt;')
  assert.equal(htmlPalabras(''), '')
})

// ------------------------------------------------------------------ 6.2 y 6.3: los bucles de CSS

const css = readFileSync(new URL('../src/estilos.css', import.meta.url), 'utf8')

/** Las reglas de primer nivel de un texto de CSS, con el @media que las contiene (si hay). */
function reglas(texto) {
  const salida = []
  const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '')
  let i = 0
  const leer = (hasta, media) => {
    let sel = ''
    while (i < hasta) {
      const ch = sinComentarios[i]
      if (ch === '{') {
        const cabeza = sel.trim()
        let prof = 1, j = i + 1
        while (prof && j < sinComentarios.length) { if (sinComentarios[j] === '{') prof++; else if (sinComentarios[j] === '}') prof--; j++ }
        const cuerpo = sinComentarios.slice(i + 1, j - 1)
        if (cabeza.startsWith('@media')) { const fin = j; i += 1; leer(j - 1, cabeza); i = fin } else { salida.push({ media, selector: cabeza, cuerpo }); i = j }
        sel = ''
      } else { sel += ch; i++ }
    }
  }
  leer(sinComentarios.length, null)
  return salida
}

test('los bucles de la hoja solo corren con movimiento y sin pausa (6.3)', () => {
  const bucles = reglas(css).filter(r => /#hoja/.test(r.selector) && /animation:[^;]*infinite/.test(r.cuerpo))
  // El cursor, el paso que late, la barra, la chispa y el documento que flota
  assert.ok(bucles.length >= 5, `bucles encontrados: ${bucles.length}`)
  for (const r of bucles) {
    assert.equal(r.media, '@media (prefers-reduced-motion: no-preference)', r.selector)
    for (const s of r.selector.split(',')) assert.match(s.trim(), /^body:not\(\.pausa\)/, s)
  }
})

test('las palabras, la chispa, el cajón, el menú y la capa de soltar se animan solo con movimiento', () => {
  const animadas = reglas(css).filter(r => /#hoja/.test(r.selector) && /animation:/.test(r.cuerpo) && !/animation-play-state/.test(r.cuerpo))
  const sel = animadas.map(r => r.selector).join('\n')
  for (const parte of ['.w', '.m-m.vivo::after', '.cajon', '.velo', '.menu', '.soltar', '.hoja-doc']) assert.ok(sel.includes(parte), parte)
  for (const r of animadas) assert.equal(r.media, '@media (prefers-reduced-motion: no-preference)', r.selector)
})

test('plegada, ningún bucle de la hoja corre; mientras se pliega con el panel, se ve', () => {
  const pausa = reglas(css).find(r => /animation-play-state:\s*paused/.test(r.cuerpo) && /#hoja \*/.test(r.selector))
  assert.ok(pausa, 'la regla que pausa la hoja plegada')
  assert.match(pausa.selector, /body\.mini/)
  assert.match(pausa.selector, /body\.acoplada:not\(\.desplegada\)/)
  // animation-play-state no se hereda: la barra de la espera y la chispa son ::after (medido en Edge: seguían corriendo)
  for (const forma of ['body.mini', 'body.acoplada:not(.desplegada)']) {
    for (const pseudo of ['::before', '::after']) assert.ok(pausa.selector.split(',').map(s => s.trim()).includes(`${forma} #hoja *${pseudo}`), `${forma} ${pseudo}`)
  }
  const oculta = reglas(css).find(r => /visibility:\s*hidden/.test(r.cuerpo) && /body\.mini[^,]*#hoja/.test(r.selector))
  assert.ok(oculta)
  assert.match(oculta.selector, /body\.mini:not\(\.hoja-mueve\) #hoja/)
  assert.match(oculta.selector, /body\.acoplada:not\(\.desplegada\):not\(\.hoja-mueve\) #hoja/)
})

test('ningún @keyframes se llama igual que otro: el último pisaría al primero (la muesca "trabajando" usa late)', () => {
  const nombres = ['estilos.css', 'especies.css', 'avis.css']
    .flatMap(f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8').match(/@keyframes\s+[\w-]+/g) ?? [])
    .map(k => k.split(/\s+/)[1])
  const repetidos = nombres.filter((n, i) => nombres.indexOf(n) !== i)
  assert.deepEqual(repetidos, [])
  // La muesca trabajando sigue latiendo con su `late` (escala y opacidad), no con la del paso de la charla
  assert.match(css, /@keyframes late \{ 0%, 100% \{ transform: scale\(\.8\); opacity: \.12 \}/)
  assert.match(css, /#hoja \.paso\.ahora i \{ animation: late-paso /)
})

// ------------------------------------------------------------------ #43, C2: el movimiento de los recibos (chat-herramientas-ux.md 10)

test('las pistas de los recibos son las de 10: llega 600 con rebote, sello a los 100 por 900, visto a los 250 por 500', async () => {
  const { PISTAS_RECIBO: P } = await import('../src/recibos.js')
  assert.deepEqual(P.llega, { dura: 600, sube: 10, escala: 0.96, curva: 'outBack(1.6)' })
  assert.deepEqual(P.sello, { en: 100, dura: 900 })
  assert.deepEqual(P.tilde, { en: 250, dura: 500, trazo: 14 })
  // La fila que se suma: 8 px, 420 ms, escalonadas 70; el error, sin rebote; la lectura, escalonada 50
  assert.deepEqual(P.fila, { dura: 420, sube: 8, escalon: 70, curva: 'outExpo' })
  assert.deepEqual(P.error, { dura: 420, sube: 10, curva: 'outExpo' })
  assert.deepEqual(P.lectura, { dura: 360, escalon: 50, sube: 8, curva: 'outQuart' })
  assert.deepEqual(P.deshacer, { raya: 400, estado: 300, opacidad: 0.45 })
  assert.deepEqual(P.globo, { dura: 220, baja: 6, curva: 'outQuart' })
})

test('el ícono de Deshacer gira solo con movimiento y sin pausa; quieto, el recibo no esconde nada', () => {
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\r?\n  body:not\(\.pausa\) #hoja \.deshacer\.gira svg \{ animation: recGira/)
  // La luz del borde descansa fuera de la caja y la raya en 0: sin el acto (reducido, pausa) no se ven
  assert.match(css, /#hoja \.rec-luz \{[^}]*transform: translateX\(-100%\)/)
  assert.match(css, /#hoja \.rf\.deshecho \.raya \{ transform: none \}/)
})

test('la fila deshecha queda entera al 45 % (4.4), salvo «Deshecho», que se tiene que leer', () => {
  assert.match(css, /#hoja \.rf\.deshecho > \.cir, #hoja \.rf\.deshecho > \.tx \{ opacity: \.45 \}/)
})
