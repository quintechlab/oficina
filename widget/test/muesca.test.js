// Tests de la muesca acoplable (estilo Avis, F4): imán, lugar a lo largo del borde, rectángulos de
// la ventana cerrada y abierta, estado y nombre de la muesca, abrir y cerrar con el mouse y el
// teclado, y el golpe de la pregunta. Funciones puras de muesca.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BORDES, IMAN, HOMBRO, LUZ, HOLGURA, MARGEN_PANEL, ESPERA_ABRIR, ESPERA_CERRAR, CADA_GOLPE, PILDORA,
  esHorizontal, bordeCercano, lugarDe, lugarAjustado, rectMuesca, rectPanel, recorte, cajaArrastre, rectLuz, relativo,
  estadoMuesca, ESTADO_INICIAL, siguiente, tocaGolpe, dentroDe, posicionFlotante, contenidoMuesca, contenidoPildora,
} from '../src/muesca.js'
import { agruparPorProyecto } from '../src/logica.js'

const AREA = { x: 0, y: 0, ancho: 1920, alto: 1040 }
const TODOS = { arriba: true, derecha: true, abajo: true, izquierda: true }
const caja = (x, y, ancho = 0, alto = 0) => ({ x, y, ancho, alto })

// ------------------------------------------------------------------ imán (7.3)

test('las constantes son las de la dirección: imán de 20, hombros de 16, esperas de 180 y 650 ms, golpe cada 90 s', () => {
  assert.deepEqual(BORDES, ['arriba', 'derecha', 'abajo', 'izquierda'])
  assert.equal(IMAN, 20)
  assert.equal(HOMBRO, 16)
  assert.equal(LUZ, 12)
  assert.equal(MARGEN_PANEL, 8)
  assert.equal(ESPERA_ABRIR, 180)
  assert.equal(ESPERA_CERRAR, 650)
  assert.equal(CADA_GOLPE, 90000)
  assert.ok(HOLGURA >= 8, 'la ventana deja lugar al golpe (6 px) y al hover (2 px)')
  assert.ok(esHorizontal('arriba') && esHorizontal('abajo') && !esHorizontal('derecha') && !esHorizontal('izquierda'))
})

test('imán: acopla a 20 px o menos de un borde y no a 21', () => {
  assert.equal(bordeCercano(caja(900, 20), AREA, TODOS), 'arriba')
  assert.equal(bordeCercano(caja(900, 21), AREA, TODOS), null)
  assert.equal(bordeCercano(caja(1900, 500), AREA, TODOS), 'derecha')
  assert.equal(bordeCercano(caja(1899, 500), AREA, TODOS), null)
  assert.equal(bordeCercano(caja(900, 1020), AREA, TODOS), 'abajo')
  assert.equal(bordeCercano(caja(20, 500), AREA, TODOS), 'izquierda')
  // Pasado el borde también cuenta
  assert.equal(bordeCercano(caja(-30, 500), AREA, TODOS), 'izquierda')
})

test('imán: mide desde el lado de la caja que mira a cada borde, no desde su esquina', () => {
  // Tablero de 600 × 400 cuyo lado derecho queda a 15 px del borde derecho
  assert.equal(bordeCercano(caja(1305, 300, 600, 400), AREA, TODOS), 'derecha')
  // Su lado de abajo a 10 px de la barra de tareas
  assert.equal(bordeCercano(caja(600, 630, 600, 400), AREA, TODOS), 'abajo')
  // Con un área corrida (otro monitor a la derecha del principal)
  assert.equal(bordeCercano(caja(1930, 10), { x: 1920, y: 0, ancho: 2560, alto: 1400 }, TODOS), 'arriba')
})

test('imán en una esquina: gana el borde más cercano y, empatados, el primero de arriba, derecha, abajo, izquierda', () => {
  assert.equal(bordeCercano(caja(5, 12), AREA, TODOS), 'izquierda')
  assert.equal(bordeCercano(caja(12, 5), AREA, TODOS), 'arriba')
  assert.equal(bordeCercano(caja(10, 10), AREA, TODOS), 'arriba')
  assert.equal(bordeCercano(caja(1910, 1030), AREA, TODOS), 'derecha')
  assert.equal(bordeCercano(caja(10, 1030), AREA, TODOS), 'abajo')
})

test('imán: lejos de todo borde flota, y un borde que toca a otro monitor no acopla', () => {
  assert.equal(bordeCercano(caja(960, 520), AREA, TODOS), null)
  assert.equal(bordeCercano(caja(300, 300, 400, 300), AREA, TODOS), null)
  const sinDerecha = { ...TODOS, derecha: false }
  assert.equal(bordeCercano(caja(1910, 500), AREA, sinDerecha), null)
  // En la esquina, si el más cercano no acopla, el otro sí
  assert.equal(bordeCercano(caja(1915, 15), AREA, sinDerecha), 'arriba')
  // Sin datos de los bordes, todos acoplan
  assert.equal(bordeCercano(caja(1910, 500), AREA), 'derecha')
})

test('lugar: proyección sobre el borde, entre 0 y 1', () => {
  assert.equal(lugarDe('arriba', { x: 960, y: 3 }, AREA), 0.5)
  assert.equal(lugarDe('abajo', { x: 480, y: 1040 }, AREA), 0.25)
  assert.equal(lugarDe('derecha', { x: 1920, y: 260 }, AREA), 0.25)
  assert.equal(lugarDe('izquierda', { x: 0, y: 780 }, { x: 0, y: 0, ancho: 1920, alto: 1040 }), 0.75)
  assert.equal(lugarDe('arriba', { x: -400, y: 0 }, AREA), 0)
  assert.equal(lugarDe('arriba', { x: 5000, y: 0 }, AREA), 1)
  assert.equal(lugarDe('derecha', { x: 1920, y: -10 }, AREA), 0)
  // Con el área corrida, relativo al área
  assert.equal(lugarDe('arriba', { x: 1920 + 1280, y: 0 }, { x: 1920, y: 0, ancho: 2560, alto: 1400 }), 0.5)
})

test('lugar ajustado: la muesca y sus hombros entran en el área', () => {
  // Muesca de 120 en un borde de 1920: la mitad (60) más un hombro (16) desde cada punta
  assert.equal(lugarAjustado(0, 120, 1920), 76 / 1920)
  assert.equal(lugarAjustado(1, 120, 1920), 1 - 76 / 1920)
  assert.equal(lugarAjustado(0.42, 120, 1920), 0.42)
  // Fuera de rango o raro: dentro del rango, al medio si no es número
  assert.equal(lugarAjustado(-2, 120, 1920), 76 / 1920)
  assert.equal(lugarAjustado(Number.NaN, 120, 1920), 0.5)
  // Un área más chica que la muesca: al medio
  assert.equal(lugarAjustado(0.1, 120, 100), 0.5)
})

// ------------------------------------------------------------------ rectángulos de la ventana (7.1, 7.4)

const MUESCA_H = { largo: 120, grosor: 40 }
const MUESCA_V = { largo: 130, grosor: 52 }

test('muesca cerrada arriba: pegada al borde, centrada en el lugar, con hombros, luz y holgura para el golpe', () => {
  const r = rectMuesca({ borde: 'arriba', lugar: 0.5 }, MUESCA_H, AREA)
  const largo = 120 + 2 * HOMBRO + 2 * LUZ
  assert.deepEqual({ x: r.x, y: r.y, ancho: r.ancho, alto: r.alto }, { x: 960 - largo / 2, y: 0, ancho: largo, alto: 40 + HOLGURA })
  // La caja negra de la muesca, en coordenadas de pantalla
  assert.deepEqual(r.caja, { x: 900, y: 0, ancho: 120, alto: 40 })
})

test('muesca cerrada en los cuatro bordes: la caja toca el borde del área y la ventana la contiene', () => {
  for (const borde of BORDES) {
    const tam = esHorizontal(borde) ? MUESCA_H : MUESCA_V
    const r = rectMuesca({ borde, lugar: 0.3 }, tam, AREA)
    const c = r.caja
    if (borde === 'arriba') assert.equal(c.y, AREA.y)
    if (borde === 'abajo') assert.equal(c.y + c.alto, AREA.y + AREA.alto)
    if (borde === 'izquierda') assert.equal(c.x, AREA.x)
    if (borde === 'derecha') assert.equal(c.x + c.ancho, AREA.x + AREA.ancho)
    assert.ok(dentroDe({ x: c.x, y: c.y }, r) && dentroDe({ x: c.x + c.ancho - 1, y: c.y + c.alto - 1 }, r), borde)
    // A los costados, la muesca es una columna: el largo va en vertical
    if (!esHorizontal(borde)) assert.deepEqual([c.ancho, c.alto], [52, 130])
    // Centro en el lugar
    const centro = esHorizontal(borde) ? c.x + c.ancho / 2 : c.y + c.alto / 2
    const largoArea = esHorizontal(borde) ? AREA.ancho : AREA.alto
    assert.equal(centro, 0.3 * largoArea, borde)
  }
})

test('muesca cerrada abajo queda sobre la barra de tareas (el borde del área de trabajo)', () => {
  const area = { x: 0, y: 0, ancho: 1920, alto: 1032 }
  const r = rectMuesca({ borde: 'abajo', lugar: 0.5 }, MUESCA_H, area)
  assert.equal(r.y + r.alto, 1032)
  assert.equal(r.caja.y + r.caja.alto, 1032)
})

test('muesca cerrada en una punta: el lugar se ajusta para que entren los hombros', () => {
  const r = rectMuesca({ borde: 'arriba', lugar: 0 }, MUESCA_H, AREA)
  assert.equal(r.caja.x, HOMBRO)
})

test('el tamaño elegido agranda los hombros, la luz y la holgura con el zoom', () => {
  const r = rectMuesca({ borde: 'arriba', lugar: 0.5 }, { largo: 240, grosor: 80 }, AREA, 2)
  assert.equal(r.ancho, 240 + 2 * (2 * HOMBRO + 2 * LUZ))
  assert.equal(r.alto, 80 + 2 * HOLGURA)
})

test('panel abierto arriba: el tablero cuelga del borde, centrado en la muesca, con hombros a los lados', () => {
  const tablero = { ancho: 700, alto: 500 }
  const m = rectMuesca({ borde: 'arriba', lugar: 0.5 }, MUESCA_H, AREA)
  const p = rectPanel({ borde: 'arriba', lugar: 0.5 }, tablero, MUESCA_H, AREA)
  assert.deepEqual(p.tablero, { x: 610, y: 0, ancho: 700, alto: 500 })
  assert.deepEqual({ x: p.x, y: p.y, ancho: p.ancho, alto: p.alto }, { x: 610 - HOMBRO, y: 0, ancho: 700 + 2 * HOMBRO, alto: 500 })
  // La muesca queda adentro del panel, en el mismo lugar de la pantalla
  assert.ok(m.caja.x >= p.tablero.x && m.caja.x + m.caja.ancho <= p.tablero.x + p.tablero.ancho)
})

test('panel abierto en los otros bordes: pegado a su borde y abre hacia el centro', () => {
  const tablero = { ancho: 700, alto: 500 }
  const abajo = rectPanel({ borde: 'abajo', lugar: 0.5 }, tablero, MUESCA_H, AREA)
  assert.equal(abajo.tablero.y + abajo.tablero.alto, 1040)
  const der = rectPanel({ borde: 'derecha', lugar: 0.5 }, tablero, MUESCA_V, AREA)
  assert.equal(der.tablero.x + der.tablero.ancho, 1920)
  assert.deepEqual([der.ancho, der.alto], [700, 500 + 2 * HOMBRO])
  assert.equal(der.tablero.y, 520 - 250)
  const izq = rectPanel({ borde: 'izquierda', lugar: 0.5 }, tablero, MUESCA_V, AREA)
  assert.equal(izq.tablero.x, 0)
  assert.equal(izq.y, izq.tablero.y - HOMBRO)
})

test('panel abierto cerca de una punta: se ajusta al área de trabajo con un margen de 8', () => {
  const tablero = { ancho: 700, alto: 500 }
  const p = rectPanel({ borde: 'arriba', lugar: 0 }, tablero, MUESCA_H, AREA)
  assert.equal(p.tablero.x, MARGEN_PANEL)
  const q = rectPanel({ borde: 'derecha', lugar: 1 }, tablero, MUESCA_V, AREA)
  assert.equal(q.tablero.y + q.tablero.alto, 1040 - MARGEN_PANEL)
})

test('panel abierto más grande que el área: se achica para entrar (después desplaza)', () => {
  const p = rectPanel({ borde: 'arriba', lugar: 0.5 }, { ancho: 3000, alto: 3000 }, MUESCA_H, AREA)
  assert.ok(p.tablero.ancho <= AREA.ancho - 2 * MARGEN_PANEL)
  assert.ok(p.tablero.alto <= AREA.alto * 0.9)
  assert.ok(p.x >= AREA.x - HOMBRO && p.x + p.ancho <= AREA.x + AREA.ancho + HOMBRO)
})

test('recorte: del tablero a la muesca, en px del tablero y con los radios de cada borde', () => {
  const m = rectMuesca({ borde: 'arriba', lugar: 0.5 }, MUESCA_H, AREA)
  const p = rectPanel({ borde: 'arriba', lugar: 0.5 }, { ancho: 700, alto: 500 }, MUESCA_H, AREA)
  const r = recorte(m.caja, p.tablero, 'arriba')
  assert.deepEqual(r.inset, { arriba: 0, derecha: 700 - (900 - 610) - 120, abajo: 460, izquierda: 900 - 610 })
  assert.equal(r.desde, 'inset(0px 290px 460px 290px round 0px 0px 22px 22px)')
  assert.equal(r.hasta, 'inset(0px 0px 0px 0px round 0px 0px 26px 26px)')
  assert.match(recorte(m.caja, p.tablero, 'derecha').hasta, /round 26px 0px 0px 26px\)$/)
  assert.match(recorte(m.caja, p.tablero, 'abajo').desde, /round 22px 22px 0px 0px\)$/)
  assert.match(recorte(m.caja, p.tablero, 'izquierda').desde, /round 0px 22px 22px 0px\)$/)
  // Con zoom, en px CSS del tablero (los de la ventana divididos por el zoom)
  assert.equal(recorte(m.caja, p.tablero, 'arriba', 2).inset.izquierda, 145)
})

test('la luz de pregunta va sobre el borde, 3 px, a lo largo de la muesca, los hombros y 12 px más', () => {
  const m = rectMuesca({ borde: 'arriba', lugar: 0.5 }, MUESCA_H, AREA)
  assert.deepEqual(rectLuz(m, 'arriba'), { x: m.x, y: 0, ancho: 120 + 2 * (HOMBRO + LUZ), alto: 3 })
  const d = rectMuesca({ borde: 'derecha', lugar: 0.5 }, MUESCA_V, AREA)
  assert.deepEqual(rectLuz(d, 'derecha'), { x: 1917, y: d.y, ancho: 3, alto: 130 + 2 * (HOMBRO + LUZ) })
  const b = rectMuesca({ borde: 'abajo', lugar: 0.5 }, MUESCA_H, AREA)
  assert.equal(rectLuz(b, 'abajo').y, 1037)
  assert.equal(rectLuz(rectMuesca({ borde: 'izquierda', lugar: 0.5 }, MUESCA_V, AREA), 'izquierda').x, 0)
  assert.equal(relativo({ x: 110, y: 50, ancho: 20, alto: 10 }, { x: 100, y: 40 }, 2).x, 5)
})

test('arrastre: la caja que se mide es la píldora centrada en el puntero, o el tablero con su agarre', () => {
  assert.deepEqual(cajaArrastre({ x: 500, y: 300 }, null, PILDORA), { x: 500 - PILDORA.ancho / 2, y: 300 - PILDORA.alto / 2, ...PILDORA })
  assert.deepEqual(cajaArrastre({ x: 500, y: 300 }, { x: 40, y: 20 }, { ancho: 700, alto: 500 }), { x: 460, y: 280, ancho: 700, alto: 500 })
})

test('al flotar, el tablero se abre donde se soltó, ajustado al área de trabajo', () => {
  assert.deepEqual(posicionFlotante({ x: 960, y: 500 }, { ancho: 700, alto: 500 }, AREA), { x: 610, y: 480 })
  assert.deepEqual(posicionFlotante({ x: 10, y: 1000 }, { ancho: 700, alto: 500 }, AREA), { x: 0, y: 540 })
})

// ------------------------------------------------------------------ estado y nombre (7.1, 7.2)

const AHORA = Date.parse('2026-11-20T12:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const ses = (sesion, repo, extra = {}) => ({ sesion, repo, inicio: hace(30), actualizado: hace(0), actividad: 'esperándote', agentes: [], ...extra })
const trabajando = { id: 'a1', nombre: 'Delfina', tarea: 'x', tipo: 'general-purpose', estado: 'trabajando', desde: hace(3), hasta: null }
const pregunta = { id: 'toolu_1', agente: null, desde: hace(1), items: [{ pregunta: '¿Sí?', opciones: [{ etiqueta: 'Sí' }] }] }

test('reposo: Avi esperando, punto crema y la cantidad de sesiones', () => {
  const p = agruparPorProyecto([ses('a', 'q/oficina'), ses('b', 'q/catalogo'), ses('c', 'q/catalogo'), ses('d', 'q/crm')])
  const e = estadoMuesca(p, AHORA)
  assert.deepEqual({ animo: e.animo, punto: e.punto, chip: e.chip, pregunta: e.pregunta }, { animo: 'esperando', punto: 'crema', chip: '4', pregunta: false })
  assert.equal(e.nombre, 'Oficina: 4 sesiones abiertas. Abrir')
})

test('trabajando: Avi coordinando, punto ámbar y cuántas sesiones trabajan', () => {
  const p = agruparPorProyecto([ses('a', 'q/oficina', { agentes: [trabajando] }), ses('b', 'q/crm', { actividad: 'editando main.js' }), ses('c', 'q/crm')])
  const e = estadoMuesca(p, AHORA)
  assert.deepEqual({ animo: e.animo, punto: e.punto, chip: e.chip }, { animo: 'coordinando', punto: 'ambar', chip: '3' })
  assert.equal(e.nombre, 'Oficina: 2 sesiones trabajando. Abrir')
})

test('pregunta: Avi te espera, punto ámbar, chip "1 ?" y el nombre dice quién pregunta y dónde', () => {
  const p = agruparPorProyecto([ses('a', 'q/oficina'), ses('b', 'quintechlab/catalogo', { preguntas: [pregunta] })])
  const e = estadoMuesca(p, AHORA)
  assert.deepEqual({ animo: e.animo, punto: e.punto, chip: e.chip, pregunta: e.pregunta, pendientes: e.pendientes }, { animo: 'teEspera', punto: 'ambar', chip: '1 ?', pregunta: true, pendientes: 1 })
  assert.equal(e.nombre, 'Oficina: Claude te hace una pregunta en catalogo. Abrir')
  assert.equal(e.chipNombre, '1 pregunta pendiente')
  const dos = agruparPorProyecto([ses('b', 'q/catalogo', { preguntas: [pregunta, { ...pregunta, id: 'toolu_2' }] })])
  assert.equal(estadoMuesca(dos, AHORA).nombre, 'Oficina: 2 preguntas pendientes. Abrir')
})

test('sin sesiones o todas dormidas: punto tenue', () => {
  assert.deepEqual([estadoMuesca([], AHORA).punto, estadoMuesca([], AHORA).chip], ['tenue', '0'])
  assert.equal(estadoMuesca([], AHORA).nombre, 'Oficina: sin sesiones abiertas. Abrir')
  const dormidas = agruparPorProyecto([ses('a', 'q/oficina', { actividad: 'editando x', actualizado: hace(40) })])
  assert.equal(estadoMuesca(dormidas, AHORA).punto, 'tenue')
  assert.equal(estadoMuesca(agruparPorProyecto([ses('a', 'q/oficina')]), AHORA).nombre, 'Oficina: 1 sesión abierta. Abrir')
})

test('adentro de la muesca: el Avi de Claude que asoma, el punto y el chip, todo decorativo', () => {
  const p = agruparPorProyecto([ses('b', 'q/catalogo', { preguntas: [pregunta] })])
  const html = contenidoMuesca(estadoMuesca(p, AHORA))
  assert.match(html, /^<span class="asoma"><span class="avi" style="--t:44px[^"]*" aria-hidden="true"><svg viewBox="0 0 120 120" class="e-teEspera"/)
  assert.match(html, /<span class="pt pt-ambar" aria-hidden="true"><\/span>/)
  assert.match(html, /<span class="chip chip-preg" aria-hidden="true">1 \?<\/span>$/)
  assert.doesNotMatch(html, /role="img"/)
  const pildora = contenidoPildora(estadoMuesca([], AHORA))
  assert.match(pildora, /<b>Oficina<\/b><span class="chip">0<\/span>$/)
})

// ------------------------------------------------------------------ abrir y cerrar (7.2)

const correr = (eventos, desde = ESTADO_INICIAL) => eventos.reduce((e, ev) => siguiente(e, typeof ev === 'string' ? { tipo: ev } : ev), desde)

test('mouse encima: espera 180 ms y abre sin tomar el foco', () => {
  const e = correr(['entra'])
  assert.equal(e.abierta, false)
  assert.deepEqual(e.espera, { que: 'abrir', ms: ESPERA_ABRIR })
  const abierta = siguiente(e, { tipo: 'tiempo', que: 'abrir' })
  assert.equal(abierta.abierta, true)
  assert.equal(abierta.efecto, 'abrir')
  assert.equal(abierta.foco, null)
})

test('el mouse sale antes de los 180 ms: no abre', () => {
  const e = correr(['entra', 'sale'])
  assert.equal(e.espera, null)
  assert.equal(siguiente(e, { tipo: 'tiempo', que: 'abrir' }).abierta, false)
})

test('mouse afuera 650 ms cierra; si vuelve antes, se cancela', () => {
  const abierta = correr(['entra', { tipo: 'tiempo', que: 'abrir' }])
  const saliendo = siguiente(abierta, { tipo: 'sale' })
  assert.deepEqual(saliendo.espera, { que: 'cerrar', ms: ESPERA_CERRAR })
  const cerrada = siguiente(saliendo, { tipo: 'tiempo', que: 'cerrar' })
  assert.equal(cerrada.abierta, false)
  assert.equal(cerrada.efecto, 'cerrar')
  const volvio = siguiente(saliendo, { tipo: 'entra' })
  assert.equal(volvio.espera, null)
  assert.equal(siguiente(volvio, { tipo: 'tiempo', que: 'cerrar' }).abierta, true)
})

test('después de cerrar no vuelve a abrir por hover hasta que el mouse salga una vez', () => {
  const cerrada = correr(['entra', { tipo: 'tiempo', que: 'abrir' }, 'sale', { tipo: 'tiempo', que: 'cerrar' }])
  const otraVez = siguiente(cerrada, { tipo: 'entra' })
  assert.equal(otraVez.espera, null)
  const armada = correr(['sale', 'entra'], cerrada)
  assert.deepEqual(armada.espera, { que: 'abrir', ms: ESPERA_ABRIR })
})

test('"Mantener abierta": el mouse afuera no cierra', () => {
  const fija = correr(['entra', { tipo: 'tiempo', que: 'abrir' }, 'fijar', 'sale'])
  assert.equal(fija.fija, true)
  assert.equal(fija.espera, null)
  assert.equal(fija.abierta, true)
  // Al soltarla con el mouse afuera, vuelve a cerrar a los 650 ms
  const suelta = siguiente(fija, { tipo: 'fijar' })
  assert.equal(suelta.fija, false)
  assert.deepEqual(suelta.espera, { que: 'cerrar', ms: ESPERA_CERRAR })
})

test('clic, Enter o Espacio sobre la muesca: abre y lleva el foco al proyecto activo', () => {
  const e = siguiente(ESTADO_INICIAL, { tipo: 'clic' })
  assert.equal(e.abierta, true)
  assert.equal(e.efecto, 'abrir')
  assert.equal(e.foco, 'proyecto')
})

test('Esc cierra aunque esté fijada, la desfija y devuelve el foco a la muesca', () => {
  const fija = correr(['clic', 'fijar'])
  const e = siguiente(fija, { tipo: 'esc' })
  assert.deepEqual({ abierta: e.abierta, fija: e.fija, efecto: e.efecto, foco: e.foco }, { abierta: false, fija: false, efecto: 'cerrar', foco: 'muesca' })
  // Cerrada, Esc no hace nada
  const otra = siguiente(e, { tipo: 'esc' })
  assert.equal(otra.efecto, null)
})

test('el golpe o cualquier otro evento no abre ni cierra la muesca', () => {
  for (const tipo of ['golpe', 'luz', 'pregunta', 'nada']) {
    const e = siguiente(ESTADO_INICIAL, { tipo })
    assert.equal(e.abierta, false, tipo)
    assert.equal(e.efecto, null, tipo)
  }
})

// ------------------------------------------------------------------ golpe (6.4)

test('golpe: al llegar una pregunta y cada 90 s mientras siga y la muesca esté cerrada', () => {
  assert.equal(tocaGolpe({ pendientes: 1, nueva: true, abierta: false, ultimo: null, ahora: 0 }), true)
  assert.equal(tocaGolpe({ pendientes: 1, nueva: false, abierta: false, ultimo: 0, ahora: 30000 }), false)
  assert.equal(tocaGolpe({ pendientes: 1, nueva: false, abierta: false, ultimo: 0, ahora: 89999 }), false)
  assert.equal(tocaGolpe({ pendientes: 1, nueva: false, abierta: false, ultimo: 0, ahora: 90000 }), true)
  // Una pregunta nueva golpea aunque el último golpe sea reciente
  assert.equal(tocaGolpe({ pendientes: 2, nueva: true, abierta: false, ultimo: 0, ahora: 1000 }), true)
})

test('golpe: nunca con la muesca abierta ni sin preguntas', () => {
  assert.equal(tocaGolpe({ pendientes: 1, nueva: true, abierta: true, ultimo: null, ahora: 0 }), false)
  assert.equal(tocaGolpe({ pendientes: 0, nueva: false, abierta: false, ultimo: null, ahora: 999999 }), false)
})

test('dentroDe: el puntero dentro de un rectángulo (borde derecho y de abajo afuera)', () => {
  const r = { x: 10, y: 10, ancho: 100, alto: 40 }
  assert.equal(dentroDe({ x: 10, y: 10 }, r), true)
  assert.equal(dentroDe({ x: 109, y: 49 }, r), true)
  assert.equal(dentroDe({ x: 110, y: 20 }, r), false)
  assert.equal(dentroDe(null, r), false)
})
