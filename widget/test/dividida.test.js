// Tests de la pantalla dividida (docs/diseno/dividida-ux.md): qué conversaciones hay y cómo se unen
// los dos lados (13.3), cuándo se abre sola (3.1), el lado izquierdo, los textos (5.2.1, 5.5, 5.6,
// 5.7, 5.10), la geometría de la mitad (6) y la cuenta de la vuelta (10). Funciones puras de dividida.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DIVIDIDA, MINUTOS_CONVERSA_QUIETA, ESPERA_VUELTA_MS, conversaciones, claveConversa, conversacionesNuevas, mensajesNuevos,
  convsVisibles, debeAbrirseSola, ladoIzquierdo, nombreLado, lineaConversa, textoTurno, textoCostura, textoUltimo, textoSub,
  textoFicha, haceCorto, duracionCorta, horaCorta, rastroConversa, geometriaDividida, cuentaVuelta, anuncioEmpieza, anuncioTermina,
} from '../src/dividida.js'

const AHORA = Date.parse('2026-11-22T13:30:00Z')
const iso = ms => new Date(ms).toISOString()
const haceS = s => iso(AHORA - s * 1000)
const haceM = m => iso(AHORA - m * 60000)

/** Una sesión que publica (Presencia mínima). */
const ses = (sesion, repo, extra = {}) => ({ sesion, repo, rama: 'main', actualizado: haceS(1), actividad: 'esperándote', agentes: [], ...extra })
/** Una entrada de `conversa` tal como la publica el mod v0.8 (solo lo que recibe: de 'otro'). */
const recibida = (con, conRepo, desde, cuando, { empezo = 'otro', de = 'otro' } = {}) => ({ con, conRepo, desde, empezo, ultimo: { de, cuando } })

const TIENDA = 'q/tienda-web', PAGOS = 'q/api-pagos', ADMIN = 'q/panel-admin'

/** tienda-web le escribió a api-pagos hace 40 s (solo api-pagos lo anota). */
function unLado() {
  return [
    ses('t', TIENDA),
    ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(6), haceS(40))] }),
  ]
}

// ------------------------------------------------------------------ conversaciones (13.3)

test('una conversación publicada por un solo lado: ids, desde, quién mandó, a quién le toca, sin hasta', () => {
  const [c, ...resto] = conversaciones(unLado(), AHORA)
  assert.equal(resto.length, 0)
  assert.deepEqual(c.par, ['p', 't'])
  assert.equal(c.a, 'p')
  assert.equal(c.b, 't')
  assert.equal(c.clave, claveConversa('t', 'p', haceM(6)))
  assert.equal(c.desde, haceM(6))
  assert.equal(c.empezo, 't')
  assert.deepEqual(c.ultimo, { emisor: 't', cuando: haceS(40) })
  assert.equal(c.turno, 'p')
  assert.equal(c.hasta, null)
  assert.equal(c.motivo, null)
  assert.deepEqual(c.repos, { p: PAGOS, t: TIENDA })
})

test('la clave es el par sin orden más el desde: no depende de quién publica', () => {
  assert.equal(claveConversa('a', 'b', haceM(3)), claveConversa('b', 'a', haceM(3)))
  assert.notEqual(claveConversa('a', 'b', haceM(3)), claveConversa('a', 'b', haceM(4)))
  assert.notEqual(claveConversa('a', 'b', haceM(3)), claveConversa('a', 'c', haceM(3)))
})

test('unión de los dos lados: desde es el mínimo, el último es el más reciente traducido a ids, el turno es del otro', () => {
  const sesiones = [
    ses('t', TIENDA, { conversa: [recibida('p', PAGOS, haceM(5), haceS(2), { empezo: 'otro' })] }),
    ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(6), haceS(40))] }),
  ]
  const [c] = conversaciones(sesiones, AHORA)
  assert.equal(c.desde, haceM(6))
  assert.equal(c.clave, claveConversa('t', 'p', haceM(6)))
  // empezó quien mandó el primer mensaje, según el lado del desde más antiguo
  assert.equal(c.empezo, 't')
  assert.deepEqual(c.ultimo, { emisor: 'p', cuando: haceS(2) })
  assert.equal(c.turno, 't')
})

test('de "yo" en el último mensaje se traduce a quien publica', () => {
  const sesiones = [ses('t', TIENDA, { conversa: [recibida('p', PAGOS, haceM(2), haceS(5), { empezo: 'yo', de: 'yo' })] })]
  const [c] = conversaciones(sesiones, AHORA)
  assert.equal(c.empezo, 't')
  assert.deepEqual(c.ultimo, { emisor: 't', cuando: haceS(5) })
  assert.equal(c.turno, 'p')
})

test('termina a los 5 min sin mensajes: hasta = último + 5 min, motivo "quieta"', () => {
  assert.equal(MINUTOS_CONVERSA_QUIETA, 5)
  const sesiones = [ses('t', TIENDA), ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(12), haceM(6))] })]
  const [c] = conversaciones(sesiones, AHORA)
  assert.equal(c.hasta, haceM(1))
  assert.equal(c.motivo, 'quieta')
  // un segundo antes de los 5 min sigue activa
  const [d] = conversaciones([ses('t', TIENDA), ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(12), iso(AHORA - 5 * 60000 + 1000))] })], AHORA)
  assert.equal(d.hasta, null)
})

test('termina si una de las dos sesiones desaparece de la lectura: hasta = esa lectura, motivo "cerro"', () => {
  const antes = conversaciones(unLado(), AHORA - 1500)
  const sinTienda = [ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(6), haceS(40))] })]
  const [c] = conversaciones(sinTienda, AHORA, antes)
  assert.equal(c.clave, antes[0].clave)
  assert.equal(c.hasta, iso(AHORA))
  assert.equal(c.motivo, 'cerro')
  assert.deepEqual(c.cerradas, ['t'])
  // la lectura siguiente conserva el hasta de la lectura en que desapareció
  const [d] = conversaciones(sinTienda, AHORA + 1500, [c])
  assert.equal(d.hasta, iso(AHORA))
})

test('si se va la sesión que publicaba, la conversación queda en memoria como cerrada', () => {
  const antes = conversaciones(unLado(), AHORA - 1500)
  const [c] = conversaciones([ses('t', TIENDA)], AHORA, antes)
  assert.equal(c.clave, antes[0].clave)
  assert.equal(c.motivo, 'cerro')
  assert.deepEqual(c.cerradas, ['p'])
  assert.equal(c.hasta, iso(AHORA))
})

test('una sesión que nunca se vio (otra máquina) no cierra la conversación: es "sin datos"', () => {
  const sesiones = [ses('p', PAGOS, { conversa: [recibida('campos', TIENDA, haceM(2), haceS(10))] })]
  const [c] = conversaciones(sesiones, AHORA, conversaciones(sesiones, AHORA - 1500))
  assert.equal(c.hasta, null)
  assert.deepEqual(c.repos, { campos: TIENDA, p: PAGOS })
})

test('la clave no salta cuando el otro lado aparece después con un desde más viejo', () => {
  const antes = conversaciones([ses('t', TIENDA, { conversa: [recibida('p', PAGOS, haceM(1), haceS(1))] }), ses('p', PAGOS)], AHORA - 1500)
  const dos = [
    ses('t', TIENDA, { conversa: [recibida('p', PAGOS, haceM(1), haceS(1))] }),
    ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(6), haceS(40))] }),
  ]
  const [c, ...resto] = conversaciones(dos, AHORA, antes)
  assert.equal(resto.length, 0)
  assert.equal(c.clave, antes[0].clave)
  assert.equal(c.desde, haceM(6))
  assert.equal(c.empezo, 't')
  assert.deepEqual(c.ultimo, { emisor: 'p', cuando: haceS(1) })
})

test('un mensaje después de 5 min de silencio es otra conversación (clave nueva)', () => {
  const vieja = conversaciones([ses('t', TIENDA), ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(20), haceM(10))] })], AHORA)
  const nueva = conversaciones([ses('t', TIENDA), ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceS(30), haceS(30))] })], AHORA, vieja)
  const activa = nueva.find(c => !c.hasta)
  assert.ok(activa)
  assert.notEqual(activa.clave, vieja[0].clave)
})

test('las terminadas se olvidan 30 min después de su hasta; sin conversa no hay conversaciones', () => {
  const vieja = conversaciones([ses('t', TIENDA), ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(50), haceM(40))] })], AHORA)
  assert.equal(vieja.length, 0)
  assert.deepEqual(conversaciones([ses('t', TIENDA), ses('p', PAGOS)], AHORA), [])
  // datos rotos no rompen nada
  assert.deepEqual(conversaciones([ses('p', PAGOS, { conversa: [{ con: 't' }, null, recibida('p', PAGOS, haceM(1), haceS(1))] })], AHORA), [])
})

test('conversaciones nuevas: la primera lectura no tiene; después, las claves que no estaban', () => {
  const convs = conversaciones(unLado(), AHORA)
  assert.deepEqual(conversacionesNuevas(null, convs), [])
  assert.deepEqual(conversacionesNuevas(new Set(), convs).map(c => c.clave), [convs[0].clave])
  assert.deepEqual(conversacionesNuevas(new Set([convs[0].clave]), convs), [])
})

test('mensajes nuevos: cambió el ultimo.cuando de una conversación que ya se conocía', () => {
  const convs = conversaciones(unLado(), AHORA)
  const k = convs[0].clave
  assert.deepEqual(mensajesNuevos(new Map(), convs), [])
  assert.deepEqual(mensajesNuevos(new Map([[k, haceS(40)]]), convs), [])
  assert.deepEqual(mensajesNuevos(new Map([[k, haceM(2)]]), convs), [k])
})

test('las fichas visibles: activas y terminadas hace menos de 5 min, sin las retiradas, por desde', () => {
  const sesiones = [
    ses('t', TIENDA, { conversa: [recibida('a', ADMIN, haceM(3), haceS(20))] }),
    ses('a', ADMIN),
    ses('p', PAGOS, { conversa: [recibida('t', TIENDA, haceM(12), haceM(7))] }),
    ses('x', 'q/x', { conversa: [recibida('t', TIENDA, haceM(20), haceM(14))] }),
  ]
  const convs = conversaciones(sesiones, AHORA)
  assert.equal(convs.length, 3)
  const vis = convsVisibles(convs, AHORA, new Set())
  assert.deepEqual(vis.map(c => c.par), [['p', 't'], ['a', 't']])
  assert.deepEqual(convsVisibles(convs, AHORA, new Set([vis[0].clave])).map(c => c.par), [['a', 't']])
})

// ------------------------------------------------------------------ se abre sola (3.1)

const conv = conversaciones(unLado(), AHORA)[0]
/** Un contexto en el que se cumplen todas las condiciones de 3.1. */
const ctxOk = (extra = {}) => ({
  nueva: true, panelVisible: true, proyectoVisto: PAGOS, divididaAbierta: false, preguntaDesplegada: false, enviando: false,
  focoEnCampo: false, arrastre: false, descartadas: new Set(), transicion: false, ...extra,
})

test('se abre sola cuando se cumplen todas las condiciones', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk()), 'abrir')
  assert.equal(debeAbrirseSola(conv, ctxOk({ proyectoVisto: TIENDA })), 'abrir')
})

test('3.1.1: solo una conversación nueva y activa', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ nueva: false })), 'no')
  assert.equal(debeAbrirseSola({ ...conv, hasta: haceS(1) }, ctxOk()), 'no')
})

test('3.1.2: el panel tiene que verse', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ panelVisible: false })), 'no')
})

test('3.1.3: el proyecto que mostrás tiene que ser uno de los dos', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ proyectoVisto: ADMIN })), 'no')
})

test('3.1.4: con la dividida abierta no se abre (entra como pestaña)', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ divididaAbierta: true })), 'no')
})

test('3.1.5: una pregunta desplegada o una respuesta enviándose la frenan', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ preguntaDesplegada: true })), 'no')
  assert.equal(debeAbrirseSola(conv, ctxOk({ enviando: true })), 'no')
})

test('3.1.6: el foco en un campo de texto o un arrastre la frenan', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ focoEnCampo: true })), 'no')
  assert.equal(debeAbrirseSola(conv, ctxOk({ arrastre: true })), 'no')
})

test('3.1.7: una conversación que cerraste no se reabre sola', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ descartadas: new Set([conv.clave]) })), 'no')
})

test('3.1.8: con una transición de ventana en curso, espera y se vuelve a evaluar', () => {
  assert.equal(debeAbrirseSola(conv, ctxOk({ transicion: true })), 'esperar')
  // la espera no salva una conversación que no es nueva
  assert.equal(debeAbrirseSola(conv, ctxOk({ transicion: true, nueva: false })), 'no')
})

// ------------------------------------------------------------------ lado izquierdo y nombres

test('lado izquierdo: el proyecto de la vista anterior si es uno de los dos; si no, quien empezó', () => {
  assert.equal(ladoIzquierdo(conv, PAGOS), 'p')
  assert.equal(ladoIzquierdo(conv, TIENDA), 't')
  assert.equal(ladoIzquierdo(conv, ADMIN), 't')
  // los dos del mismo proyecto: quien empezó
  const mismo = { ...conv, repos: { p: TIENDA, t: TIENDA } }
  assert.equal(ladoIzquierdo(mismo, TIENDA), 't')
})

test('nombre de cada lado: el proyecto; con el mismo proyecto a los dos lados, la rama', () => {
  const porId = new Map(unLado().map(s => [s.sesion, s]))
  assert.equal(nombreLado(conv, 'p', porId), 'api-pagos')
  assert.equal(nombreLado(conv, 't', porId), 'tienda-web')
  const mismo = { ...conv, repos: { p: TIENDA, t: TIENDA } }
  const ramas = new Map([['p', ses('p', TIENDA, { rama: 'feat/18-checkout' })], ['t', ses('t', TIENDA, { rama: 'main' })]])
  assert.equal(nombreLado(mismo, 'p', ramas), 'feat/18-checkout')
  // sin la sesión a la vista, el repo de conRepo
  assert.equal(nombreLado(conv, 't', new Map()), 'tienda-web')
})

// ------------------------------------------------------------------ textos

test('haceCorto y duracionCorta: segundos, minutos y horas', () => {
  assert.equal(duracionCorta(3000), '3 s')
  assert.equal(duracionCorta(40999), '40 s')
  assert.equal(duracionCorta(2 * 60000 + 5000), '2 min')
  assert.equal(duracionCorta(65 * 60000), '1 h 5 min')
  assert.equal(duracionCorta(-500), '0 s')
  assert.equal(haceCorto(haceS(3), AHORA), 'hace 3 s')
  assert.equal(haceCorto(haceS(40), AHORA), 'hace 40 s')
  assert.equal(haceCorto(haceM(2), AHORA), 'hace 2 min')
})

const nombre = id => ({ t: 'tienda-web', p: 'api-pagos', a: 'panel-admin' })[id]

test('línea de la mitad 1: una pregunta propia gana, en ámbar', () => {
  const s = ses('t', TIENDA, { preguntas: [{ id: 'q', agente: null, items: [] }] })
  const l = lineaConversa(s, conv, AHORA, nombre)
  assert.deepEqual(l, { animo: 'teEspera', texto: 'ahora · te hace una pregunta', color: 'var(--ambar)', conversa: false })
})

test('línea de la mitad 2: mandó y espera, si solo coordina, espera o piensa: pose pensando, celeste', () => {
  for (const extra of [{ actividad: 'esperándote' }, { actividad: 'pensando' }, { agentes: [{ id: '1', nombre: 'Delfina', estado: 'trabajando', tipo: 'x', desde: haceM(1) }] }]) {
    const l = lineaConversa(ses('t', TIENDA, extra), conv, AHORA, nombre)
    assert.deepEqual(l, { animo: 'pensando', texto: 'esperando a api-pagos · 40 s', color: 'var(--celeste)', conversa: true })
  }
  // una actividad concreta le gana a la espera
  const editando = lineaConversa(ses('t', TIENDA, { actividad: 'editando pago.vue' }), conv, AHORA, nombre)
  assert.deepEqual(editando, { animo: 'editando', texto: 'ahora · editando pago.vue', color: 'var(--ambar)', conversa: false })
})

test('línea de la mitad 3: el otro le contestó hace menos de 10 s; después, la actividad de hoy', () => {
  const recien = { ...conv, ultimo: { emisor: 't', cuando: haceS(4) }, turno: 'p' }
  const l = lineaConversa(ses('p', PAGOS, { actividad: 'leyendo pago.ts' }), recien, AHORA, nombre)
  assert.deepEqual(l, { animo: 'leyendo', texto: 'tienda-web le contestó', color: 'var(--celeste)', conversa: true })
  // El primer mensaje de la conversación no es una respuesta: "le escribió"
  const primero = { ...conv, desde: haceS(4), empezo: 't', ultimo: { emisor: 't', cuando: haceS(4) }, turno: 'p' }
  assert.equal(lineaConversa(ses('p', PAGOS, { actividad: 'leyendo pago.ts' }), primero, AHORA, nombre).texto, 'tienda-web le escribió')
  const tarde = lineaConversa(ses('p', PAGOS, { actividad: 'leyendo pago.ts' }), conv, AHORA, nombre)
  assert.deepEqual(tarde, { animo: 'leyendo', texto: 'ahora · leyendo pago.ts', color: 'var(--celeste)', conversa: false })
})

test('línea de la mitad 4: terminada, la actividad de hoy aunque haya mandado el último', () => {
  const fin = { ...conv, hasta: haceS(20), motivo: 'quieta' }
  const l = lineaConversa(ses('t', TIENDA), fin, AHORA, nombre)
  assert.deepEqual(l, { animo: 'esperando', texto: 'ahora · esperando tu mensaje', color: 'var(--crema)', conversa: false })
})

test('chip de turno: le toca (lleno), espera a … con el tiempo, terminó y sin datos', () => {
  assert.deepEqual(textoTurno(conv, 'p', AHORA, nombre), { clase: 'lleno', texto: 'le toca a api-pagos' })
  assert.deepEqual(textoTurno(conv, 't', AHORA, nombre), { clase: 'espera', texto: 'espera a api-pagos · 40 s' })
  const fin = { ...conv, hasta: haceS(20), motivo: 'quieta' }
  assert.deepEqual(textoTurno(fin, 't', AHORA, nombre), { clase: 'fin', texto: 'terminó · hace 20 s' })
  assert.deepEqual(textoTurno(conv, 't', AHORA, nombre, { sinDatos: true }), { clase: 'fin', texto: 'sin datos' })
})

test('píldora de la costura: la flecha del último mensaje y hace cuánto; terminada, "terminó"', () => {
  assert.deepEqual(textoCostura(conv, 't', AHORA), { texto: '→ hace 40 s', fin: false })
  assert.deepEqual(textoCostura(conv, 'p', AHORA), { texto: '← hace 40 s', fin: false })
  assert.deepEqual(textoCostura({ ...conv, hasta: haceS(5) }, 't', AHORA), { texto: 'terminó', fin: true })
})

test('ficha "Último": quién → a quién y hace cuánto; terminada, hace cuánto terminó', () => {
  assert.equal(textoUltimo(conv, AHORA, nombre), 'tienda-web → api-pagos · hace 40 s')
  assert.equal(textoUltimo({ ...conv, hasta: haceS(20) }, AHORA, nombre), 'terminó hace 20 s')
})

test('sub del encabezado (5.2.1): recién abierta sola y activa', () => {
  const ctx = { ahoraMs: AHORA, recienSola: true, vista: 'tienda-web', cuenta: null, siguiente: null, nombre }
  assert.equal(textoSub(conv, ctx), 'Se abrió sola · ‹ te lleva de vuelta a tienda-web')
  assert.equal(textoSub(conv, { ...ctx, recienSola: false }), `Conversan desde las ${horaCorta(haceM(6))} · 6 min`)
})

test('sub del encabezado (5.2.1): terminada con la cuenta corriendo, en pausa, cerrada y con otra conversación', () => {
  const fin = { ...conv, hasta: haceS(20), motivo: 'quieta', cerradas: [] }
  const ctx = { ahoraMs: AHORA, recienSola: true, vista: 'tienda-web', cuenta: { restante: 40000, pausada: false }, siguiente: null, nombre }
  assert.equal(textoSub(fin, ctx), 'Terminó hace 20 s · vuelve a tienda-web en 40 s')
  assert.equal(textoSub(fin, { ...ctx, cuenta: { restante: 40000, pausada: true } }), 'Terminó hace 20 s · la vuelta espera mientras estés acá')
  const cerro = { ...fin, motivo: 'cerro', cerradas: ['p'] }
  assert.equal(textoSub(cerro, ctx), 'api-pagos se cerró · vuelve a tienda-web en 40 s')
  assert.equal(textoSub(fin, { ...ctx, siguiente: 'tienda-web ⇄ panel-admin' }), 'Terminó hace 20 s · sigue tienda-web ⇄ panel-admin en 40 s')
  // sin cuenta empezada (el panel no se veía): los 60 s enteros
  assert.equal(textoSub(fin, { ...ctx, cuenta: null }), 'Terminó hace 20 s · vuelve a tienda-web en 60 s')
})

test('horaCorta: HH:MM en la hora local', () => {
  const d = new Date(haceM(6))
  assert.equal(horaCorta(haceM(6)), `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
})

test('nombre accesible de la ficha: quién con quién, desde cuándo, el último mensaje y si es nuevo', () => {
  assert.equal(textoFicha(conv, AHORA, nombre), `Conversación de tienda-web con api-pagos, desde las ${horaCorta(haceM(6))}, último mensaje hace 40 s. Abrir`)
  assert.equal(textoFicha(conv, AHORA, nombre, { nuevo: true }), `Conversación de tienda-web con api-pagos, desde las ${horaCorta(haceM(6))}, último mensaje hace 40 s, mensaje nuevo. Abrir`)
})

test('anuncios en vivo: empiezan (y si se abrió sola) y terminan con la vuelta', () => {
  assert.equal(anuncioEmpieza(conv, nombre, false), 'tienda-web y api-pagos empezaron a conversar')
  assert.equal(anuncioEmpieza(conv, nombre, true), 'tienda-web y api-pagos empezaron a conversar, se abrió la pantalla dividida')
  assert.equal(anuncioTermina(conv, nombre, 'tienda-web'), 'Terminó la conversación entre tienda-web y api-pagos. Vuelve a tienda-web en 60 segundos.')
})

test('rastro en la tarjeta: activa "conversa con … · t", terminada "habló con … · t · terminó hace …", sin conversación nada', () => {
  const s = ses('t', TIENDA)
  assert.deepEqual(rastroConversa(s, [conv], AHORA, nombre), { clave: conv.clave, texto: 'conversa con api-pagos · 6 min', fin: false })
  const fin = { ...conv, desde: haceM(9), hasta: haceM(1), motivo: 'quieta' }
  assert.deepEqual(rastroConversa(s, [fin], AHORA, nombre), { clave: conv.clave, texto: 'habló con api-pagos · 8 min · terminó hace 1 min', fin: true })
  assert.equal(rastroConversa(ses('x', ADMIN), [conv], AHORA, nombre), null)
  // con una activa y una terminada, la activa
  assert.equal(rastroConversa(s, [fin, { ...conv, clave: 'otra' }], AHORA, nombre).clave, 'otra')
})

// ------------------------------------------------------------------ geometría (6)

test('geometría de la mitad sin subagentes: Claude de 120 en el piso, la antena y el cable entre antenas', () => {
  assert.deepEqual(DIVIDIDA, { mitad: 272, costura: 26, cabecera: 66, alto: 218, piso: 164, claude: 120, sub: 46, ranura: 62, borde: 6 })
  const g = geometriaDividida(0, 0)
  assert.deepEqual(g.izq.claude, { t: 120, x: 136, y: 60 })
  assert.deepEqual(g.der.claude, { t: 120, x: 16, y: 60 })
  assert.deepEqual(g.izq.antena, { x: 196, y: 74 })
  assert.deepEqual(g.der.antena, { x: 76, y: 74 })
  assert.equal(g.izq.luz, 196)
  assert.equal(g.der.luz, 76)
  assert.deepEqual(g.izq.ranuras, [])
  assert.equal(g.izq.pila, null)
  assert.equal(g.cable.d, 'M196 140 Q285 120 374 140')
  assert.equal(g.cable.dInverso, 'M374 140 Q285 120 196 140')
  assert.deepEqual(g.cable.llegaA, { x: 196, y: 140 })
  assert.deepEqual(g.cable.llegaB, { x: 374, y: 140 })
})

test('geometría con 1 y 2 subagentes: la ranura de afuera primero, el destino del hilo y el rótulo', () => {
  const uno = geometriaDividida(1, 1)
  assert.deepEqual(uno.izq.ranuras.map(r => r.x), [6])
  assert.deepEqual(uno.der.ranuras.map(r => r.x), [220])
  const dos = geometriaDividida(2, 2)
  assert.deepEqual(dos.izq.ranuras.map(r => r.x), [6, 68])
  assert.deepEqual(dos.der.ranuras.map(r => r.x), [220, 158])
  assert.deepEqual(dos.izq.ranuras[1], { x: 68, y: 124, t: 46, destino: { x: 91, y: 136 }, rotulo: { x: 59, y: 168, ancho: 64 } })
  assert.equal(dos.izq.pila, null)
})

test('geometría con 3 o más: un Avi en la ranura de Claude y la pila "+n" en la de afuera', () => {
  const g = geometriaDividida(4, 3)
  assert.deepEqual(g.izq.ranuras.map(r => r.x), [68])
  assert.equal(g.izq.pila.x, 6)
  assert.deepEqual(g.izq.pila.destino, { x: 29, y: 136 })
  assert.deepEqual(g.der.ranuras.map(r => r.x), [158])
  assert.equal(g.der.pila.x, 220)
})

// ------------------------------------------------------------------ cuenta de la vuelta (10)

test('cuenta de la vuelta: 60 s que corren solo mientras corre, se pausan sin reiniciar y terminan en 0', () => {
  assert.equal(ESPERA_VUELTA_MS, 60000)
  let c = cuentaVuelta(null, { corre: false, ahoraMs: 0 })
  assert.deepEqual(c, { restante: 60000, desde: null, pausada: true, terminada: false })
  c = cuentaVuelta(c, { corre: true, ahoraMs: 1000 })
  assert.deepEqual(c, { restante: 60000, desde: 1000, pausada: false, terminada: false })
  c = cuentaVuelta(c, { corre: false, ahoraMs: 21000 })
  assert.deepEqual(c, { restante: 40000, desde: null, pausada: true, terminada: false })
  c = cuentaVuelta(c, { corre: false, ahoraMs: 90000 })
  assert.equal(c.restante, 40000)
  c = cuentaVuelta(c, { corre: true, ahoraMs: 100000 })
  c = cuentaVuelta(c, { corre: true, ahoraMs: 141000 })
  assert.deepEqual(c, { restante: 0, desde: null, pausada: false, terminada: true })
})

// ------------------------------------------------------------------ vista (divididaVista.js)

const texto = h => h.replace(/<[^>]+>/g, '')

test('vista: la mitad sin datos usa conRepo, "no se ve desde esta máquina", Claude al 60 % y el chip "sin datos"', async () => {
  const { mitad } = await import('../src/divididaVista.js')
  const porId = new Map([['p', ses('p', PAGOS)]])
  const h = mitad(conv, 't', { ahoraMs: AHORA, porId, nombre, geo: geometriaDividida(0, 0).der, lado: 'der' })
  assert.match(h, /class="mitad der sin"/)
  assert.match(h, /<span class="mh-n">tienda-web<\/span>/)
  assert.match(h, /no se ve desde esta máquina/)
  assert.match(h, /esc-claude dorm-c/)
  assert.match(h, /<span class="turno fin"><span data-vivo>sin datos<\/span><\/span>/)
  assert.doesNotMatch(h, /class="elenco"/)
})

test('vista: la mitad con datos lleva la línea de la conversación con "⇄", el chip y Claude en su sitio', async () => {
  const { mitad } = await import('../src/divididaVista.js')
  const porId = new Map(unLado().map(s => [s.sesion, s]))
  const geo = geometriaDividida(0, 0)
  const h = mitad(conv, 't', { ahoraMs: AHORA, porId, nombre, geo: geo.izq, lado: 'izq' })
  assert.match(h, /<p class="linea cv" style="--c:var\(--celeste\)" title="⇄ esperando a api-pagos · 40 s"><span class="cv-m" aria-hidden="true">⇄<\/span><span data-vivo>esperando a api-pagos · 40 s<\/span><\/p>/)
  assert.match(h, /<span class="turno espera"><svg class="arena"/)
  assert.match(h, /style="left:136px;top:60px"/)
  assert.match(h, /--t:120px/)
})

test('vista: el h1 se oye "tienda-web conversa con api-pagos"; con el mismo proyecto, "· 2 sesiones conversan"', async () => {
  const { cabConversa } = await import('../src/divididaVista.js')
  assert.equal(texto(cabConversa(conv, 't', { nombre, sub: 'x' }).match(/<h1[^>]*>(.*)<\/h1>/)[1]), 'tienda-web⇄ conversa con api-pagos')
  assert.match(cabConversa(conv, 't', { nombre, sub: 'x' }), /<span class="flecha-c" aria-hidden="true">⇄<\/span><span class="oculto"> conversa con <\/span>/)
  const mismo = { ...conv, repos: { p: TIENDA, t: TIENDA } }
  assert.equal(texto(cabConversa(mismo, 't', { nombre, sub: 'x' }).match(/<h1[^>]*>(.*)<\/h1>/)[1]), 'tienda-web · 2 sesiones conversan')
})

test('vista: pestañas solo con 2 o más, la activa con aria-selected y tabindex 0, el punto con ", mensaje nuevo"', async () => {
  const { pestanas } = await import('../src/divididaVista.js')
  assert.equal(pestanas([conv], { activa: conv.clave, nuevas: new Set(), nombre }), '')
  const otra = { ...conv, clave: 'k2', a: 'a', b: 't', par: ['a', 't'], empezo: 'a', repos: { a: ADMIN, t: TIENDA } }
  const h = pestanas([conv, otra], { activa: conv.clave, nuevas: new Set(['k2']), nombre })
  assert.match(h, /role="tablist"/)
  assert.match(h, /aria-selected="true" aria-controls="split" tabindex="0" data-accion="pest" data-clave="[^"]+"><span class="n">tienda-web/)
  assert.match(h, /aria-selected="false" aria-controls="split" tabindex="-1" data-accion="pest" data-clave="k2">.*<i class="pt-n" aria-hidden="true"><\/i><span class="oculto">, mensaje nuevo<\/span>/)
})

test('vista: las fichas "Conversan" escapan lo que viene de la sesión y llevan el punto si son nuevas', async () => {
  const { fichasConversan } = await import('../src/divididaVista.js')
  const malo = id => (id === 't' ? '<b>x</b>' : 'api-pagos')
  const porId = new Map(unLado().map(s => [s.sesion, s]))
  const h = fichasConversan([conv], { ahoraMs: AHORA, porId, nombre: malo, nuevas: new Set([conv.clave]) })
  assert.doesNotMatch(h, /<b>x<\/b>/)
  assert.match(h, /&lt;b&gt;x&lt;\/b&gt;/)
  assert.match(h, /<h2 class="rot-c" id="h-conversan">Conversan<\/h2>/)
  assert.match(h, /data-accion="conv"/)
  assert.match(h, /<i class="pt-n" aria-hidden="true"><\/i>/)
  assert.equal(fichasConversan([], { ahoraMs: AHORA, porId, nombre, nuevas: new Set() }), '')
})

test('esperaRespuesta: mandó el último y solo coordina, espera o piensa (para el festejo al recibir, 9.3)', async () => {
  const { esperaRespuesta } = await import('../src/dividida.js')
  assert.equal(esperaRespuesta(ses('t', TIENDA), conv, AHORA), true)
  assert.equal(esperaRespuesta(ses('t', TIENDA, { actividad: 'editando pago.vue' }), conv, AHORA), false)
  assert.equal(esperaRespuesta(ses('p', PAGOS), conv, AHORA), false)
  assert.equal(esperaRespuesta(ses('t', TIENDA), { ...conv, hasta: haceS(1) }, AHORA), false)
  assert.equal(esperaRespuesta(undefined, conv, AHORA), false)
})
