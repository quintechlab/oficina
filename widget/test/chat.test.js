// Tests de la charla con la mascota (docs/diseno/chat-avis-ux.md 14.1): la geometría de la hoja, la
// máquina de estados, los pasos de la espera, el Markdown seguro, los bloques progresivos y los
// textos. Funciones puras de chat.js y chatVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ANCHO_HOJA, HUECO_HOJA, ladoHoja, rectHoja, hojaBaja, anuncioAdjuntos,chatInicial, transicionChat, pasoEspera, relojEspera, markdownSeguro,
  partirBloques, textoHerramientas, grupoDeFecha, tituloConversacion, sugerencias, validarAdjunto, coincideBusqueda,
  animoChat, datosAvis, firmaDatos, cifrasDescarga, formatoGB, duracionContando, contarPalabras, actividadParaAvis,
  ACTIVIDAD_QUIETA, TOPES_DATOS, formatoReloj, nombreCarpeta, listaCharlas, mensajesVisibles, TARDA_MS, SIN_NOTICIAS_MS,
} from '../src/chat.js'
import { hilo, escena, cabecera, composer, menuCarpeta, cajon, capaSoltar, textoError } from '../src/chatVista.js'
import { zonaInteractiva, disposicionFlotante, disposicionAcoplada, disposicionTira } from '../src/muesca.js'
import { agruparPorProyecto } from '../src/logica.js'

const AHORA = new Date(2026, 10, 23, 15, 30).getTime()
const MIN = 60000
const AREA = { x: 0, y: 0, ancho: 1920, alto: 1040 }
const TABLERO = { x: 600, y: 200, ancho: 690, alto: 640 }

// ------------------------------------------------------------------ 1 y 2: geometría (3.1)

test('ladoHoja flotando: a la derecha si entra; si no, a la izquierda; si no, encima', () => {
  assert.equal(ANCHO_HOJA, 420)
  assert.equal(HUECO_HOJA, 14)
  assert.equal(ladoHoja(TABLERO, AREA, 'flotante', null, 1), 'derecha')
  // El borde justo: 1290 + 14 + 420 = 1724
  assert.equal(ladoHoja(TABLERO, { ...AREA, ancho: 1724 }, 'flotante', null, 1), 'derecha')
  assert.equal(ladoHoja(TABLERO, { ...AREA, ancho: 1723 }, 'flotante', null, 1), 'izquierda')
  // Sin lugar a ningún lado
  assert.equal(ladoHoja({ ...TABLERO, x: 300 }, { ...AREA, ancho: 1300 }, 'flotante', null, 1), 'encima')
})

test('ladoHoja acoplada: lejos del borde; arriba y abajo prefieren la derecha', () => {
  const t = { x: 615, y: 0, ancho: 690, alto: 640 }
  assert.equal(ladoHoja({ ...t, x: 1230 }, AREA, 'acoplada', 'derecha', 1), 'izquierda')
  assert.equal(ladoHoja({ ...t, x: 0 }, AREA, 'acoplada', 'izquierda', 1), 'derecha')
  assert.equal(ladoHoja(t, AREA, 'acoplada', 'arriba', 1), 'derecha')
  assert.equal(ladoHoja({ ...t, x: 1100 }, AREA, 'acoplada', 'arriba', 1), 'izquierda')
  assert.equal(ladoHoja({ ...t, x: 1100 }, AREA, 'acoplada', 'abajo', 1), 'izquierda')
  // Pegada a la derecha sin lugar a la izquierda: encima (no se va al borde de la muesca)
  assert.equal(ladoHoja({ ...t, x: 300, ancho: 1620 }, AREA, 'acoplada', 'derecha', 1), 'encima')
})

test('ladoHoja al 200 % con un área de 1366: encima', () => {
  const area = { x: 0, y: 0, ancho: 1366, alto: 728 }
  const t = { x: 68, y: 0, ancho: 1229, alto: 655 }
  assert.equal(ladoHoja(t, area, 'flotante', null, 2), 'encima')
  assert.equal(ladoHoja(t, area, 'acoplada', 'arriba', 2), 'encima')
})

test('rectHoja: 420·z de ancho, 14·z de hueco, la misma y y el mismo alto que el tablero', () => {
  assert.deepEqual(rectHoja(TABLERO, 'derecha', 1), { x: 1304, y: 200, ancho: 420, alto: 640 })
  assert.deepEqual(rectHoja(TABLERO, 'izquierda', 1), { x: 166, y: 200, ancho: 420, alto: 640 })
  assert.deepEqual(rectHoja(TABLERO, 'derecha', 2), { x: 1318, y: 200, ancho: 840, alto: 640 })
  // Encima: tapa la columna principal desde la barra lateral
  assert.deepEqual(rectHoja(TABLERO, 'encima', 1, 200), { x: 800, y: 200, ancho: 490, alto: 640 })
})

test('rectHoja encima: si la columna deja menos de 320·z, tapa el tablero entero con la barra (18, B2)', () => {
  const angosto = { x: 0, y: 0, ancho: 320, alto: 700 }
  assert.deepEqual(rectHoja(angosto, 'encima', 1, 188), { x: 0, y: 0, ancho: 320, alto: 700 })
  // Justo 320 de columna: sigue dejando la barra a la vista
  assert.deepEqual(rectHoja({ ...angosto, ancho: 508 }, 'encima', 1, 188), { x: 188, y: 0, ancho: 320, alto: 700 })
  // Al 200 %, el mínimo es 640 px de pantalla
  assert.deepEqual(rectHoja({ ...angosto, ancho: 1000 }, 'encima', 2, 376), { x: 0, y: 0, ancho: 1000, alto: 700 })
})

test('hojaBaja: menos de 520 px CSS de alto compacta el escenario (18, B1)', () => {
  assert.equal(hojaBaja(328), true)
  assert.equal(hojaBaja(519), true)
  assert.equal(hojaBaja(520), false)
  assert.equal(hojaBaja(640), false)
})

test('anuncioAdjuntos: un solo anuncio por soltada (18, M3)', () => {
  assert.equal(anuncioAdjuntos(['notas.md']), 'Adjuntaste notas.md')
  assert.equal(anuncioAdjuntos(['presupuesto-2027.pdf', 'notas.md']), 'Adjuntaste presupuesto-2027.pdf y notas.md')
  assert.equal(anuncioAdjuntos(['a.pdf', 'b.md', 'c.txt']), 'Adjuntaste 3 archivos: a.pdf, b.md y c.txt')
})

// ------------------------------------------------------------------ 3: zona interactiva

test('zonaInteractiva con la hoja: la unión exacta del tablero y la hoja', () => {
  const d = disposicionFlotante({ x: 600, y: 200 }, { ancho: 690, alto: 640 }, AREA)
  const hoja = rectHoja(d.tablero, 'derecha', 1)
  assert.deepEqual(zonaInteractiva(d, { abierta: false, hoja }), { x: 600, y: 200, ancho: 1124, alto: 640, toda: false })
  const izq = rectHoja(d.tablero, 'izquierda', 1)
  assert.deepEqual(zonaInteractiva(d, { abierta: false, hoja: izq }), { x: 166, y: 200, ancho: 1124, alto: 640, toda: false })
  // Acoplada y abierta, la unión con el tablero del panel; cerrada, la muesca (la hoja no se ve)
  const a = disposicionAcoplada({ borde: 'arriba', lugar: 0.5 }, { largo: 150, grosor: 54 }, { ancho: 690, alto: 640 }, AREA)
  const h2 = rectHoja(a.p.tablero, 'derecha', 1)
  const z = zonaInteractiva(a, { abierta: true, hoja: h2 })
  assert.deepEqual(z, { x: a.p.tablero.x, y: a.p.tablero.y, ancho: h2.x + h2.ancho - a.p.tablero.x, alto: 640, toda: false })
  assert.deepEqual(zonaInteractiva(a, { abierta: false, hoja: h2 }), zonaInteractiva(a, { abierta: false }))
})

test('zonaInteractiva sin la hoja: la de hoy en todos los modos', () => {
  const f = disposicionFlotante({ x: 600, y: 200 }, { ancho: 690, alto: 640 }, AREA)
  assert.deepEqual(zonaInteractiva(f, { abierta: false }), { ...f.tablero, toda: false })
  assert.deepEqual(zonaInteractiva(f, { abierta: false, hoja: null }), { ...f.tablero, toda: false })
  const t = disposicionTira(null, { ancho: 400, alto: 56 }, AREA)
  assert.deepEqual(zonaInteractiva(t, { abierta: false, hoja: rectHoja(TABLERO, 'derecha') }), { ...t.tira, toda: false })
  assert.deepEqual(zonaInteractiva(f, { abierta: false, arrastrando: true, hoja: rectHoja(TABLERO, 'derecha') }), { ...f.ventana, toda: true })
})

// ------------------------------------------------------------------ 4: transicionChat (3.3)

const CTX = { ahoraMs: AHORA, id: 'c-1', mascota: 'Ascua', datos: { proyectos: [] } }
const tipos = efectos => efectos.map(e => e.tipo)
/** Una charla abierta, vacía y con el motor Claude Code en "catalogo". */
function abierta(extra = {}) {
  const { chat } = transicionChat({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo', ...extra }, { tipo: 'abrir' }, CTX)
  return chat
}
const evento = (c, tipo, datos = {}) => transicionChat(c, { tipo: 'backend', payload: { conversacion: c.conversacion.id, turno: c.turno, tipo, ...datos } }, CTX)
/** Manda "hola" desde el campo. */
const enviar = (c, texto = 'hola', ctx = CTX) => transicionChat({ ...c, borrador: texto }, { tipo: 'enviar', texto, campo: true }, ctx)

test('abrir: una charla vacía con el último motor y la última carpeta; precalienta y lleva el foco al campo', () => {
  const { chat, efectos } = transicionChat({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo' }, { tipo: 'abrir' }, CTX)
  assert.equal(chat.abierta, true)
  assert.equal(chat.estado, 'vacio')
  assert.equal(chat.conversacion.id, 'c-1')
  assert.equal(chat.conversacion.motor, 'claude')
  assert.equal(chat.conversacion.carpeta, 'C:\\Desktop\\catalogo')
  assert.deepEqual(efectos.find(e => e.tipo === 'abrir'), { tipo: 'abrir', conversacion: 'c-1', motor: 'claude', carpeta: 'C:\\Desktop\\catalogo', sesionClaude: null, modelo: null })
  assert.deepEqual(efectos.find(e => e.tipo === 'foco'), { tipo: 'foco', a: 'campo' })
  // Abrir no manda nada (regla 1)
  assert.ok(!tipos(efectos).includes('enviar'))
})

test('retoma la última charla si es de las últimas 12 h (D11); si no, una vacía', () => {
  let c = abierta()
  c = enviar(c).chat
  c = transicionChat(c, { tipo: 'cerrar' }, CTX).chat
  const otra = transicionChat(c, { tipo: 'abrir' }, { ...CTX, ahoraMs: AHORA + 11 * 60 * MIN, id: 'c-2' }).chat
  assert.equal(otra.conversacion.id, 'c-1')
  const vieja = transicionChat(c, { tipo: 'abrir' }, { ...CTX, ahoraMs: AHORA + 13 * 60 * MIN, id: 'c-2' }).chat
  assert.equal(vieja.conversacion.id, 'c-2')
  assert.equal(vieja.estado, 'vacio')
  // La anterior queda en el historial de esta ejecución
  assert.deepEqual(listaCharlas(vieja).map(x => x.id), ['c-1'])
})

test('vacio + enviar → esperando con el efecto chat_enviar; el borrador se vacía', () => {
  const { chat, efectos } = enviar(abierta(), '¿En qué anda cada sesión?')
  assert.equal(chat.estado, 'esperando')
  assert.equal(chat.paso, 0)
  assert.equal(chat.turno, 1)
  assert.equal(chat.borrador, '')
  assert.deepEqual(efectos.find(e => e.tipo === 'enviar'), { tipo: 'enviar', conversacion: 'c-1', turno: 1, texto: '¿En qué anda cada sesión?', adjuntos: [] })
  assert.deepEqual(efectos.find(e => e.tipo === 'anunciar'), { tipo: 'anunciar', texto: 'Ascua está pensando' })
  assert.equal(chat.conversacion.titulo, '¿En qué anda cada sesión')
  assert.deepEqual(chat.conversacion.mensajes.map(m => [m.rol, m.estado]), [['usuario', 'no-enviado'], ['mascota', 'escribiendo']])
})

test('esperando + texto → escribiendo; escribiendo + fin → listo; listo + enviar → esperando', () => {
  let c = enviar(abierta()).chat
  c = evento(c, 'recibido').chat
  assert.equal(c.conversacion.mensajes[0].estado, 'ok')
  c = evento(c, 'texto', { texto: 'Hola, ' }).chat
  assert.equal(c.estado, 'escribiendo')
  c = evento(c, 'texto', { texto: 'todo bien.' }).chat
  assert.equal(c.conversacion.mensajes[1].texto, 'Hola, todo bien.')
  const fin = evento(c, 'fin', { ms: 2100 })
  c = fin.chat
  assert.equal(c.estado, 'listo')
  assert.equal(c.conversacion.mensajes[1].estado, 'ok')
  assert.equal(c.conversacion.mensajes[1].ms, 2100)
  assert.deepEqual(fin.efectos.find(e => e.tipo === 'anunciar'), { tipo: 'anunciar', texto: 'Ascua respondió: Hola, todo bien.' })
  const otro = enviar(c, 'y ahora?')
  assert.equal(otro.chat.estado, 'esperando')
  assert.equal(otro.chat.turno, 2)
})

test('el anuncio de fin lleva los primeros 140 caracteres', () => {
  let c = evento(enviar(abierta()).chat, 'texto', { texto: 'x'.repeat(300) }).chat
  const { efectos } = evento(c, 'fin', { ms: 10 })
  assert.equal(efectos.find(e => e.tipo === 'anunciar').texto, `Ascua respondió: ${'x'.repeat(140)}`)
  // El lector de pantalla no lee las marcas del Markdown
  c = evento(enviar(abierta()).chat, 'texto', { texto: '## Hola\n\nTenés **3 sesiones** y `main` ([guía](https://x.dev)).' }).chat
  assert.equal(evento(c, 'fin', { ms: 10 }).efectos.find(e => e.tipo === 'anunciar').texto, 'Ascua respondió: Hola Tenés 3 sesiones y main (guía).')
})

test('frenar: al instante, con el efecto chat_frenar; un texto del mismo turno después se descarta', () => {
  let c = evento(enviar(abierta()).chat, 'texto', { texto: 'Parcial' }).chat
  const fr = transicionChat(c, { tipo: 'frenar' }, CTX)
  assert.equal(fr.chat.estado, 'frenada')
  assert.deepEqual(fr.efectos.find(e => e.tipo === 'frenar'), { tipo: 'frenar', conversacion: 'c-1', turno: 1 })
  assert.deepEqual(fr.efectos.find(e => e.tipo === 'anunciar'), { tipo: 'anunciar', texto: 'Respuesta frenada' })
  assert.equal(fr.chat.conversacion.mensajes[1].estado, 'frenada')
  c = fr.chat
  const tarde = evento(c, 'texto', { texto: ' y más' })
  assert.equal(tarde.chat, c)
  assert.equal(evento(c, 'frenada').chat, c)
  assert.equal(evento(c, 'fin', { ms: 1 }).chat, c)
  // Frenar sin un turno en curso no hace nada
  assert.equal(transicionChat(abierta(), { tipo: 'frenar' }, CTX).efectos.length, 0)
})

test('un evento de otra conversación o de un turno viejo: sin cambios', () => {
  const c = enviar(abierta()).chat
  const ajena = transicionChat(c, { tipo: 'backend', payload: { conversacion: 'c-9', turno: 1, tipo: 'texto', texto: 'x' } }, CTX)
  assert.equal(ajena.chat, c)
  const vieja = transicionChat(c, { tipo: 'backend', payload: { conversacion: 'c-1', turno: 0, tipo: 'texto', texto: 'x' } }, CTX)
  assert.equal(vieja.chat, c)
  // Un tipo desconocido tampoco cambia nada
  assert.equal(evento(c, 'otra-cosa').chat, c)
})

test('error: conserva el borrador y los adjuntos; el mensaje que no salió vuelve al campo', () => {
  let c = enviar(abierta(), 'Armame la documentación').chat
  c = evento(c, 'error', { motivo: 'red' }).chat
  assert.equal(c.estado, 'error')
  assert.deepEqual(c.error, { motivo: 'red', detalle: null })
  assert.equal(c.borrador, 'Armame la documentación')
  const [u, ...resto] = c.conversacion.mensajes
  assert.equal(u.estado, 'no-enviado')
  assert.equal(resto.length, 0, 'sin respuesta, la mascota no deja un mensaje vacío')
  // Lo que el usuario escribió mientras tanto no se pisa (regla 2)
  let d = enviar(abierta(), 'uno').chat
  d = transicionChat(d, { tipo: 'escribir', texto: 'lo que sigo escribiendo' }, CTX).chat
  d = evento(d, 'error', { motivo: 'red' }).chat
  assert.equal(d.borrador, 'lo que sigo escribiendo')
  // Los adjuntos del mensaje vuelven con él
  let e = transicionChat({ ...abierta(), adjuntos: [{ nombre: 'a.pdf', ruta: 'C:\\a.pdf', tipo: 'pdf', bytes: 10 }] }, { tipo: 'enviar', texto: 'leelo', campo: true }, CTX).chat
  assert.deepEqual(e.adjuntos, [])
  e = evento(e, 'error', { motivo: 'proceso' }).chat
  assert.deepEqual(e.adjuntos.map(a => a.nombre), ['a.pdf'])
})

test('reintentar manda el mismo texto con los mismos adjuntos', () => {
  const adj = [{ nombre: 'a.pdf', ruta: 'C:\\a.pdf', tipo: 'pdf', bytes: 10 }]
  let c = transicionChat({ ...abierta(), adjuntos: adj }, { tipo: 'enviar', texto: 'leelo', campo: true }, CTX).chat
  c = evento(c, 'error', { motivo: 'red' }).chat
  const r = transicionChat(c, { tipo: 'reintentar' }, CTX)
  assert.equal(r.chat.estado, 'esperando')
  assert.deepEqual(r.efectos.find(e => e.tipo === 'enviar'), { tipo: 'enviar', conversacion: 'c-1', turno: 2, texto: 'leelo', adjuntos: ['C:\\a.pdf'] })
  // El mensaje fallido no queda dos veces, y el campo queda libre
  assert.deepEqual(r.chat.conversacion.mensajes.filter(m => m.rol === 'usuario').map(m => m.texto), ['leelo'])
  assert.equal(r.chat.borrador, '')
  assert.deepEqual(r.chat.adjuntos, [])
  // Sin error, reintentar no hace nada
  assert.equal(transicionChat(abierta(), { tipo: 'reintentar' }, CTX).efectos.length, 0)
})

test('"Volver a preguntar" después de frenar manda de nuevo el último mensaje', () => {
  let c = transicionChat(enviar(abierta(), 'contame').chat, { tipo: 'frenar' }, CTX).chat
  const r = transicionChat(c, { tipo: 'volver-a-preguntar' }, CTX)
  assert.equal(r.efectos.find(e => e.tipo === 'enviar').texto, 'contame')
  assert.equal(r.chat.turno, 2)
})

test('enviar con un turno en curso: sin cambios (D7); con el texto vacío y sin adjuntos: sin cambios', () => {
  const c = enviar(abierta()).chat
  const ocupada = transicionChat(c, { tipo: 'enviar', texto: 'otra', campo: true }, CTX)
  assert.equal(ocupada.chat, c)
  assert.equal(ocupada.efectos.length, 0)
  const e = evento(c, 'texto', { texto: 'a' }).chat
  assert.equal(transicionChat(e, { tipo: 'enviar', texto: 'otra' }, CTX).chat, e)
  const vacia = abierta()
  assert.equal(transicionChat(vacia, { tipo: 'enviar', texto: '   ', campo: true }, CTX).chat, vacia)
  assert.equal(enviar(vacia, '').efectos.length, 0)
})

test('Esc en este orden: menú > cajón > frenar > cerrar', () => {
  let c = enviar(abierta()).chat
  c = { ...c, menu: true, cajon: true }
  let r = transicionChat(c, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.menu, false)
  assert.equal(r.chat.cajon, true)
  assert.deepEqual(r.efectos, [{ tipo: 'foco', a: 'carpeta' }])
  r = transicionChat(r.chat, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.cajon, false)
  assert.deepEqual(r.efectos, [{ tipo: 'foco', a: 'hist' }])
  r = transicionChat(r.chat, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.estado, 'frenada')
  assert.ok(tipos(r.efectos).includes('frenar'))
  assert.equal(r.chat.abierta, true)
  r = transicionChat(r.chat, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.abierta, false)
  assert.deepEqual(r.efectos, [{ tipo: 'foco', a: 'marca' }])
})

test('cerrar la hoja nunca frena: el turno sigue y su respuesta llega', () => {
  let c = enviar(abierta()).chat
  const r = transicionChat(c, { tipo: 'cerrar' }, CTX)
  assert.ok(!tipos(r.efectos).includes('frenar'))
  assert.equal(r.chat.estado, 'esperando')
  c = evento(r.chat, 'texto', { texto: 'llegó' }).chat
  c = evento(c, 'fin', { ms: 5 }).chat
  assert.equal(c.estado, 'listo')
  assert.equal(c.conversacion.mensajes[1].texto, 'llegó')
})

test('cambiar el motor o la carpeta con mensajes: charla nueva; sin mensajes, solo la cabecera (D8)', () => {
  const vacia = abierta()
  const r1 = transicionChat(vacia, { tipo: 'carpeta', carpeta: 'C:\\Desktop\\oficina' }, { ...CTX, id: 'c-2' })
  assert.equal(r1.chat.conversacion.id, 'c-1')
  assert.equal(r1.chat.conversacion.carpeta, 'C:\\Desktop\\oficina')
  assert.ok(tipos(r1.efectos).includes('abrir'))
  assert.deepEqual(r1.efectos.find(e => e.tipo === 'preferencias'), { tipo: 'preferencias', motor: 'claude', carpeta: 'C:\\Desktop\\oficina', modelo: null })
  const r2 = transicionChat(vacia, { tipo: 'motor', motor: 'local' }, { ...CTX, id: 'c-2' })
  assert.equal(r2.chat.conversacion.id, 'c-1')
  assert.equal(r2.chat.conversacion.motor, 'local')
  assert.equal(r2.chat.conversacion.carpeta, null, 'el modelo local no tiene carpeta')
  let llena = evento(enviar(abierta()).chat, 'fin', { ms: 1 }).chat
  const r3 = transicionChat(llena, { tipo: 'carpeta', carpeta: 'C:\\Desktop\\oficina' }, { ...CTX, id: 'c-2' })
  assert.equal(r3.chat.conversacion.id, 'c-2')
  assert.equal(r3.chat.conversacion.nuevaEn, 'oficina')
  assert.equal(r3.chat.estado, 'vacio')
  assert.deepEqual(listaCharlas(r3.chat).map(x => x.id), ['c-1'])
  const r4 = transicionChat(llena, { tipo: 'motor', motor: 'local' }, { ...CTX, id: 'c-3' })
  assert.equal(r4.chat.conversacion.id, 'c-3')
  assert.equal(r4.chat.conversacion.motor, 'local')
  // La misma carpeta o el mismo motor: nada
  assert.equal(transicionChat(llena, { tipo: 'motor', motor: 'claude' }, CTX).chat, llena)
  // Con el motor local, la carpeta no se cambia
  assert.equal(transicionChat(r2.chat, { tipo: 'carpeta', carpeta: 'C:\\x' }, CTX).chat, r2.chat)
})

test('la respuesta de chat_abrir pone el proceso, la sesión de Claude Code y lo que sabe Rust', () => {
  const c = abierta()
  const { chat } = transicionChat(c, { tipo: 'abierta', conversacion: 'c-1', resultado: { proceso: 'arrancando', sesion: '0a1b2c3d-0000-4000-8000-000000000000', engram: 'sin-saber', local: 'falta' } }, CTX)
  assert.equal(chat.proceso, 'arrancando')
  assert.equal(chat.conversacion.sesionClaude, '0a1b2c3d-0000-4000-8000-000000000000')
  assert.equal(chat.local, 'falta')
  // De otra conversación, nada
  assert.equal(transicionChat(c, { tipo: 'abierta', conversacion: 'c-9', resultado: { proceso: 'listo' } }, CTX).chat, c)
})

test('el historial (cajón) y el menú se abren y cierran; elegir una charla la retoma con su sesión', () => {
  let c = evento(enviar(abierta()).chat, 'fin', { ms: 1 }).chat
  c = { ...c, conversacion: { ...c.conversacion, sesionClaude: '0a1b2c3d-0000-4000-8000-000000000000' } }
  c = transicionChat(c, { tipo: 'nueva' }, { ...CTX, id: 'c-2' }).chat
  assert.equal(c.conversacion.id, 'c-2')
  let r = transicionChat(c, { tipo: 'hist' }, CTX)
  assert.equal(r.chat.cajon, true)
  // E4: al abrir el cajón también se vuelve a leer la lista del disco (9.1)
  assert.deepEqual(r.efectos, [{ tipo: 'historial' }, { tipo: 'foco', a: 'buscar' }])
  r = transicionChat(r.chat, { tipo: 'retomar', id: 'c-1' }, CTX)
  assert.equal(r.chat.cajon, false)
  assert.equal(r.chat.conversacion.id, 'c-1')
  assert.equal(r.chat.estado, 'listo')
  assert.deepEqual(r.efectos.find(e => e.tipo === 'abrir'), { tipo: 'abrir', conversacion: 'c-1', motor: 'claude', carpeta: 'C:\\Desktop\\catalogo', sesionClaude: '0a1b2c3d-0000-4000-8000-000000000000', modelo: null })
  const m = transicionChat(abierta(), { tipo: 'menu' }, CTX)
  assert.equal(m.chat.menu, true)
  assert.equal(transicionChat(m.chat, { tipo: 'menu' }, CTX).chat.menu, false)
})

test('a los 120 s sin noticias, error con motivo tiempo (y se frena el turno de Rust)', () => {
  const c = enviar(abierta()).chat
  const r = transicionChat(c, { tipo: 'vencio', turno: 1 }, CTX)
  assert.equal(r.chat.estado, 'error')
  assert.equal(r.chat.error.motivo, 'tiempo')
  assert.ok(tipos(r.efectos).includes('frenar'))
  // Un vencimiento de otro turno, nada
  assert.equal(transicionChat(c, { tipo: 'vencio', turno: 7 }, CTX).chat, c)
})

test('las herramientas del turno y el contexto de Avis quedan en la respuesta', () => {
  let c = enviar(abierta(), 'hola', { ...CTX, datos: { proyectos: [{ nombre: 'oficina', sesiones: [] }] } }).chat
  assert.equal(c.conversacion.mensajes[1].avis, true)
  c = evento(c, 'herramienta', { nombre: 'Read', detalle: 'README.md' }).chat
  assert.deepEqual(c.conversacion.mensajes[1].herramientas, [{ nombre: 'Read', detalle: 'README.md' }])
  c = evento(c, 'fin', { ms: 1 }).chat
  // Los mismos datos en el turno siguiente no viajan otra vez (como bloque_avis de Rust)
  c = enviar(c, 'otra', { ...CTX, datos: { proyectos: [{ nombre: 'oficina', sesiones: [] }] } }).chat
  assert.equal(c.conversacion.mensajes[3].avis, false)
  // Sin sesiones no hay bloque
  const sin = enviar(abierta(), 'x', { ...CTX, datos: { proyectos: [] } }).chat
  assert.equal(sin.conversacion.mensajes[1].avis, false)
})

// ------------------------------------------------------------------ 5: pasos de la espera

test('pasoEspera: 0 hasta listo; 1 hasta pidiendo o el primer stream_event; 2 hasta el primer texto', () => {
  assert.equal(pasoEspera(0, 'recibido'), 0)
  assert.equal(pasoEspera(0, 'listo'), 1)
  assert.equal(pasoEspera(1, 'pidiendo'), 2)
  assert.equal(pasoEspera(1, 'pensando'), 2)
  assert.equal(pasoEspera(0, 'pidiendo'), 2)
  // Nunca vuelve atrás
  assert.equal(pasoEspera(2, 'listo'), 2)
  let c = enviar(abierta()).chat
  c = evento(c, 'listo', { sesion: 'x' }).chat
  assert.equal(c.paso, 1)
  c = evento(c, 'pidiendo').chat
  assert.equal(c.paso, 2)
})

test('relojEspera: m:ss desde enviar; a los 45 s la nota de "tardando"; a los 120 s sin eventos, vencido', () => {
  assert.equal(TARDA_MS, 45000)
  assert.equal(SIN_NOTICIAS_MS, 120000)
  assert.deepEqual(relojEspera(AHORA, AHORA, AHORA + 5000), { reloj: '0:05', tarda: false, vencido: false })
  assert.deepEqual(relojEspera(AHORA, AHORA + 40000, AHORA + 45000), { reloj: '0:45', tarda: true, vencido: false })
  // Hubo eventos: no vence aunque pasen los 120 s desde enviar
  assert.equal(relojEspera(AHORA, AHORA + 100000, AHORA + 130000).vencido, false)
  assert.equal(relojEspera(AHORA, AHORA, AHORA + 120000).vencido, true)
  assert.equal(formatoReloj(61000), '1:01')
  assert.equal(formatoReloj(0), '0:00')
})

// ------------------------------------------------------------------ 6: Markdown seguro (5.6)

test('markdownSeguro: <script>, <img onerror> y javascript: salen como texto', () => {
  const h = markdownSeguro('<script>alert(1)</script> y <img src=x onerror="alert(2)"> y [x](javascript:alert(3))')
  assert.ok(!/<script|<img/i.test(h))
  assert.match(h, /&lt;script&gt;/)
  assert.ok(!/href|onerror=/.test(h.replace(/onerror=&quot;/, '')))
  assert.ok(!h.includes('<a'))
  assert.match(h, /x \(javascript:alert\(3\)\)/)
})

test('markdownSeguro: los enlaces quedan "texto (url)" sin href; las imágenes se descartan', () => {
  assert.equal(markdownSeguro('Mirá [la guía](https://x.dev/g).'), '<p>Mirá la guía (https://x.dev/g).</p>')
  assert.equal(markdownSeguro('Antes ![logo](https://x.dev/l.png) después'), '<p>Antes  después</p>')
})

test('markdownSeguro: títulos, negrita, itálica, código en línea y párrafos', () => {
  assert.equal(markdownSeguro('# Uno\n## Dos\n### Tres'), '<h4>Uno</h4><h4>Dos</h4><h4>Tres</h4>')
  assert.equal(markdownSeguro('**fuerte** y *suave* con `a<b`'), '<p><b>fuerte</b> y <i>suave</i> con <code>a&lt;b</code></p>')
  assert.equal(markdownSeguro('uno\ndos\n\ntres'), '<p>uno<br>dos</p><p>tres</p>')
  // `**` sin cerrar queda literal
  assert.equal(markdownSeguro('esto **no cierra'), '<p>esto **no cierra</p>')
  // Nada de atributos ni style
  assert.ok(!/style=|class="(?!leng|copiar|tabla)/.test(markdownSeguro('# t\n- a\n```js\nx\n```\n| a | b |')))
})

test('markdownSeguro: código cercado con su lenguaje, listas de un nivel anidado y tablas en mono', () => {
  const c = markdownSeguro('```js\nconst a = "<b>"\n```')
  assert.equal(c, '<pre><span class="leng">js</span><button type="button" class="copiar" data-accion="ch-copiar-codigo" aria-label="Copiar código">Copiar</button><code>const a = &quot;&lt;b&gt;&quot;</code></pre>')
  assert.equal(markdownSeguro('- uno\n- dos\n  - dos.a\n- tres'), '<ul><li>uno</li><li>dos<ul><li>dos.a</li></ul></li><li>tres</li></ul>')
  assert.equal(markdownSeguro('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>')
  assert.equal(markdownSeguro('| a | b |\n|---|---|\n| 1 | 2 |'), '<pre class="tabla">| a | b |\n|---|---|\n| 1 | 2 |</pre>')
  // Una cerca sin cerrar (el texto sigue llegando) igual se ve como código
  assert.match(markdownSeguro('```\na'), /<pre><button[^>]*>Copiar<\/button><code>a<\/code><\/pre>/)
})

// ------------------------------------------------------------------ 7: bloques progresivos (6.2)

test('bloques progresivos: el abierto va como texto; se cierra con una línea en blanco o la cerca', () => {
  assert.deepEqual(partirBloques('Hola, est'), { cerrados: [], abierto: 'Hola, est' })
  assert.deepEqual(partirBloques('Hola.\n\nSegun'), { cerrados: ['Hola.'], abierto: 'Segun' })
  assert.deepEqual(partirBloques('Mirá:\n```js\nx\n'), { cerrados: ['Mirá:'], abierto: '```js\nx\n' })
  assert.deepEqual(partirBloques('```js\nx\n```\nDespués'), { cerrados: ['```js\nx\n```'], abierto: 'Después' })
  // Una línea en blanco adentro de la cerca no la cierra
  assert.deepEqual(partirBloques('```\na\n\nb\n'), { cerrados: [], abierto: '```\na\n\nb\n' })
})

test('bloques progresivos: los cerrados no cambian con los tramos que siguen', () => {
  const texto = '# Título\n\nUn párrafo largo.\n\n- uno\n- dos\n\n```rs\nfn main() {}\n```\nY el final, sin cerrar todavía'
  let antes = []
  for (let i = 1; i <= texto.length; i++) {
    const { cerrados } = partirBloques(texto.slice(0, i))
    assert.deepEqual(cerrados.slice(0, antes.length), antes, `en ${i}`)
    antes = cerrados
  }
  assert.deepEqual(antes, ['# Título', 'Un párrafo largo.', '- uno\n- dos', '```rs\nfn main() {}\n```'])
})

// ------------------------------------------------------------------ 8: herramientas (4.1)

test('textoHerramientas: Read, Grep y Glob en una línea; nunca una ruta completa', () => {
  assert.equal(textoHerramientas([{ nombre: 'Read', detalle: 'README.md' }], 'catalogo'), 'Leyó <b>README.md</b>')
  const seis = ['README.md', 'arquitectura.md', 'a.md', 'b.md', 'c.md', 'd.md'].map(d => ({ nombre: 'Read', detalle: d }))
  assert.equal(textoHerramientas(seis, 'catalogo'), 'Leyó <b>6 archivos</b>: README.md, arquitectura.md…')
  assert.equal(textoHerramientas(seis.slice(0, 2), 'catalogo'), 'Leyó <b>2 archivos</b>: README.md, arquitectura.md')
  assert.equal(textoHerramientas([{ nombre: 'Grep', detalle: 'pedido' }], 'catalogo'), 'Buscó «pedido» en catalogo')
  assert.equal(textoHerramientas([{ nombre: 'Glob', detalle: '**/*.md' }], 'catalogo'), 'Miró «**/*.md»')
  assert.equal(textoHerramientas([], 'catalogo', { avis: true }), 'Miró tus sesiones de Avis')
  assert.equal(textoHerramientas([], 'catalogo'), '')
  // Una ruta que se coló: solo el último tramo, y todo escapado
  assert.equal(textoHerramientas([{ nombre: 'Read', detalle: 'C:\\Users\\x\\secreto.txt' }], 'c'), 'Leyó <b>secreto.txt</b>')
  assert.equal(textoHerramientas([{ nombre: 'Grep', detalle: '<b>' }], 'c'), 'Buscó «&lt;b&gt;» en c')
  const todo = textoHerramientas([{ nombre: 'Glob', detalle: '*.rs' }, { nombre: 'Grep', detalle: 'x' }, { nombre: 'Read', detalle: 'a.rs' }], 'c', { avis: true })
  assert.equal(todo, 'Miró tus sesiones de Avis · Leyó <b>a.rs</b> · Buscó «x» en c · Miró «*.rs»')
})

// ------------------------------------------------------------------ 9 y 10: historial y títulos

test('grupoDeFecha: hoy, ayer, esta semana (lunes a hoy) y antes, con el día en hora local', () => {
  // AHORA es lunes 23/11/2026 15:30
  const lun = new Date(2026, 10, 23, 15, 30).getTime()
  assert.equal(grupoDeFecha(new Date(2026, 10, 23, 0, 0).getTime(), lun), 'Hoy')
  assert.equal(grupoDeFecha(new Date(2026, 10, 22, 23, 59).getTime(), lun), 'Ayer')
  assert.equal(grupoDeFecha(new Date(2026, 10, 21, 12).getTime(), lun), 'Antes')
  const jue = new Date(2026, 10, 26, 10).getTime()
  assert.equal(grupoDeFecha(new Date(2026, 10, 25, 22).getTime(), jue), 'Ayer')
  assert.equal(grupoDeFecha(new Date(2026, 10, 23, 8).getTime(), jue), 'Esta semana')
  assert.equal(grupoDeFecha(new Date(2026, 10, 22, 8).getTime(), jue), 'Antes')
})

test('tituloConversacion: las primeras 6 palabras sin signos al final; vacío o solo un adjunto', () => {
  assert.equal(tituloConversacion('¿En qué anda cada sesión?'), '¿En qué anda cada sesión')
  assert.equal(tituloConversacion('Armame la documentación de catalogo para alguien nuevo.'), 'Armame la documentación de catalogo para')
  assert.equal(tituloConversacion('  hola!!!  '), 'hola')
  assert.equal(tituloConversacion('', [{ nombre: 'presupuesto.pdf' }]), 'Charla sobre presupuesto.pdf')
  assert.equal(tituloConversacion('', []), 'Charla')
})

// ------------------------------------------------------------------ 11 y 12: sugerencias y adjuntos

test('sugerencias(motor, carpeta): los textos de 4.1 con la carpeta; sin carpeta, los de sesiones', () => {
  assert.deepEqual(sugerencias('claude', 'catalogo').map(s => s.texto), ['¿En qué anda cada sesión?', '¿Qué cambió hoy en catalogo?', 'Armame la documentación de catalogo', 'Resumime un PDF'])
  assert.deepEqual(sugerencias('claude', null).map(s => s.texto), ['¿En qué anda cada sesión?', '¿Quién me está esperando?', '¿Qué preguntas tengo pendientes?', 'Resumime un PDF'])
  assert.deepEqual(sugerencias('local', null).map(s => s.texto), ['¿Quién me está esperando?', '¿Cuántos subagentes trabajan ahora?', '¿Qué pregunta tengo pendiente?'])
  // "Resumime un PDF" abre el selector de archivos, no manda nada
  assert.deepEqual(sugerencias('claude', 'x').map(s => !!s.adjuntar), [false, false, false, true])
})

test('validarAdjunto: PDF hasta 20 MB, texto hasta 200 KB, 5 por mensaje y nada con el motor local', () => {
  const MB = 1024 * 1024
  assert.deepEqual(validarAdjunto({ nombre: 'a.pdf', bytes: 20 * MB }), { ok: true, tipo: 'pdf' })
  assert.deepEqual(validarAdjunto({ nombre: 'a.pdf', bytes: 20 * MB + 1 }), { ok: false, motivo: 'adjunto' })
  assert.deepEqual(validarAdjunto({ nombre: 'planilla.xlsx', bytes: 10 }), { ok: false, motivo: 'adjunto' })
  assert.deepEqual(validarAdjunto({ nombre: 'main.ts', bytes: 200 * 1024 }), { ok: true, tipo: 'texto' })
  assert.deepEqual(validarAdjunto({ nombre: 'main.ts', bytes: 200 * 1024 + 1 }), { ok: false, motivo: 'adjunto' })
  assert.deepEqual(validarAdjunto({ nombre: 'FOTO.PNG', bytes: MB }), { ok: true, tipo: 'imagen' })
  assert.deepEqual(validarAdjunto({ nombre: 'a.pdf', bytes: 10 }, { cuantos: 5 }), { ok: false, motivo: 'adjunto' })
  assert.deepEqual(validarAdjunto({ nombre: 'a.pdf', bytes: 10 }, { cuantos: 4 }), { ok: true, tipo: 'pdf' })
  assert.deepEqual(validarAdjunto({ nombre: 'a.pdf', bytes: 10 }, { motor: 'local' }), { ok: false, motivo: 'adjunto' })
  assert.deepEqual(validarAdjunto({ nombre: 'sin-extension', bytes: 10 }), { ok: false, motivo: 'adjunto' })
})

// ------------------------------------------------------------------ 14 y 15

test('coincideBusqueda: sin tildes ni mayúsculas, contra el título y el texto', () => {
  const conv = { titulo: 'Documentación de catalogo', mensajes: [{ rol: 'usuario', texto: '¿Por qué se colgó el widget?' }] }
  assert.ok(coincideBusqueda(conv, 'DOCUMENTACION'))
  assert.ok(coincideBusqueda(conv, 'colgo'))
  assert.ok(coincideBusqueda(conv, ''))
  assert.ok(!coincideBusqueda(conv, 'pedido'))
})

test('animoChat: la tabla de 3.3', () => {
  assert.equal(animoChat('vacio', 0, false, { reciente: true }), 'saluda')
  assert.equal(animoChat('vacio', 0, false), 'esperando')
  assert.equal(animoChat('esperando', 0, false), 'calienta')
  assert.equal(animoChat('esperando', 1, false), 'calienta')
  assert.equal(animoChat('esperando', 2, false), 'pensando')
  assert.equal(animoChat('escribiendo', 2, true), 'contando')
  assert.equal(animoChat('listo', 2, false, { reciente: true }), 'feliz')
  assert.equal(animoChat('listo', 2, false), 'esperando')
  assert.equal(animoChat('frenada', 2, false), 'esperando')
  assert.equal(animoChat('error', 0, false), 'error')
  assert.equal(animoChat('listo', 0, false, { cajon: true }), 'leyendo')
  assert.equal(animoChat('vacio', 0, false, { soltando: true }), 'baja')
})

// ------------------------------------------------------------------ lo que pasa del resumen (3.6)

const hace = ms => new Date(AHORA - ms).toISOString()
const sesion = (extra = {}) => ({
  v: 1, sesion: 's1', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando', repo: 'quintechlab/oficina',
  rama: 'feat/22-chat', tarea: 22, nota: 'nota privada', inicio: hace(42 * MIN), actualizado: hace(5000),
  archivos: ['widget/src/main.js'], actividad: 'editando main.js', agentes: [], preguntas: [], procesos: [], ...extra,
})

test('datosAvis: lo que ya ve Avis, sin archivos, usuario, nota, repo, opciones ni respuestas', () => {
  const s = sesion({
    preguntas: [{ id: 'q1', items: [{ pregunta: '¿Mergeo?', encabezado: 'Merge', opciones: [{ etiqueta: 'Sí (Recomendada)' }] }] }],
  })
  const d = datosAvis(agruparPorProyecto([s]), AHORA)
  assert.equal(d.proyectos[0].nombre, 'oficina')
  assert.equal(d.proyectos[0].sesiones[0].abierta_hace, '42 min')
  assert.deepEqual(d.proyectos[0].sesiones[0].preguntas, [{ encabezado: 'Merge', pregunta: '¿Mergeo?' }])
  const json = JSON.stringify(d)
  for (const prohibido of ['widget/src/main.js', 'nicoequintana', 'Quintana', 'nota privada', 'quintechlab/oficina', 'Recomendada', 'opciones']) {
    assert.ok(!json.includes(prohibido), `no pasa "${prohibido}"`)
  }
  assert.deepEqual(TOPES_DATOS, { sesiones: 12, subagentes: 6, procesos: 4, texto: 200 })
  assert.equal(actividadParaAvis({ actividad: 'esperándote', preguntas: [] }, AHORA), ACTIVIDAD_QUIETA)
  assert.equal(firmaDatos({ proyectos: [{ nombre: 'a', sesiones: [] }] }), firmaDatos({ proyectos: [{ nombre: 'a', sesiones: [] }] }))
})

test('cifras de la descarga, la duración de "contando" y las palabras (pasaron del resumen)', () => {
  const GB = 1024 ** 3
  assert.equal(formatoGB(2.6 * GB), '2,6 GB')
  assert.deepEqual(cifrasDescarga({ bajado: 1.3 * GB, total: 2.6 * GB }), { cifra: '1,3', total: '2,6 GB', porcentaje: 50, fraccion: 0.5 })
  assert.equal(duracionContando(10), 600)
  assert.equal(duracionContando(1000), 1800)
  assert.equal(contarPalabras(' uno  dos\ntres '), 3)
})

test('nombreCarpeta: el último tramo; sin carpeta, "Solo Avis"', () => {
  assert.equal(nombreCarpeta('C:\\Users\\Nico\\Desktop\\catalogo'), 'catalogo')
  assert.equal(nombreCarpeta('C:\\Users\\Nico\\Desktop\\catalogo\\'), 'catalogo')
  assert.equal(nombreCarpeta(null), 'Solo Avis')
})

test('con más de 200 mensajes el hilo dibuja los últimos 60 (D32)', () => {
  const muchos = Array.from({ length: 201 }, (_, i) => ({ rol: 'usuario', texto: String(i) }))
  const v = mensajesVisibles(muchos, false)
  assert.equal(v.mensajes.length, 60)
  assert.equal(v.ocultos, 141)
  assert.equal(mensajesVisibles(muchos, true).mensajes.length, 201)
  assert.equal(mensajesVisibles(muchos.slice(0, 200), false).ocultos, 0)
})

// ------------------------------------------------------------------ la vista (chatVista.js): textos de 4

const MODELO = (extra = {}) => ({ chat: abierta(), especie: 'ascua', ahoraMs: AHORA, puedeAdjuntar: true, ...extra })
const comp = m => Object.values(composer(m)).join('')

test('vista vacía con Claude Code: el saludo con la carpeta, las sugerencias y la pista', () => {
  const h = hilo(MODELO())
  assert.match(h, /¡Hola! Estoy en <b>catalogo<\/b> con Claude Code\. Preguntame por tus sesiones, pedime documentación o pasame un archivo\./)
  assert.match(h, /¿Qué cambió hoy en catalogo\?/)
  assert.match(h, /⤓ Arrastrá un PDF o cualquier archivo acá/)
  const solo = hilo(MODELO({ chat: abierta({ carpeta: null }) }))
  assert.match(solo, /¡Hola! Preguntame por tus sesiones de Avis o pasame un archivo\./)
  const local = transicionChat(abierta(), { tipo: 'motor', motor: 'local' }, CTX).chat
  const hl = hilo(MODELO({ chat: { ...local, local: 'instalado' } }))
  assert.match(hl, /¡Hola! Te respondo con el modelo de esta PC: privado y sin internet\. Sé lo que pasa en tus sesiones de Avis\./)
  assert.match(hl, /El modelo local no lee carpetas ni archivos/)
  const falta = hilo(MODELO({ chat: { ...local, local: 'falta', progreso: { bajado: 0, total: 2.6 * 1024 ** 3 } } }))
  assert.match(falta, /Para charlar sin internet necesito bajar el modelo de esta PC \(2,6 GB, una sola vez\)\./)
  assert.match(falta, /Descargar 2,6 GB/)
  assert.match(falta, /Usar Claude Code/)
})

test('vista con nombres propios: la mascota se llama como la nombraron y saluda al usuario (#37 S2, S3)', () => {
  const h = hilo(MODELO({ nombre: 'Pancho', usuario: 'Nico' }))
  assert.match(h, /¡Hola, Nico! Estoy en <b>catalogo<\/b> con Claude Code\./)
  assert.match(escena(MODELO({ nombre: 'Pancho' })), /<b class="esc-nom">Pancho<\/b>/)
  const local = transicionChat(abierta(), { tipo: 'motor', motor: 'local' }, CTX).chat
  assert.match(hilo(MODELO({ chat: { ...local, local: 'instalado' }, usuario: 'Nico' })), /¡Hola, Nico! Te respondo con el modelo de esta PC/)
  // Sin nombres: la especie y el saludo de siempre
  assert.match(escena(MODELO()), /<b class="esc-nom">Ascua<\/b>/)
  assert.match(hilo(MODELO()), /¡Hola! Estoy en/)
  // Escapado
  assert.match(hilo(MODELO({ usuario: '<b>' })), /¡Hola, &lt;b&gt;!/)
})

test('vista esperando: título, reloj, tres pasos y la nota; a los 45 s la de "tardando"', () => {
  const c = enviar(abierta()).chat
  const h = hilo(MODELO({ chat: c, ahoraMs: AHORA + 5000 }))
  assert.match(h, /Ascua está despertando a Claude/)
  assert.match(h, /0:05/)
  assert.match(h, /Abriendo Claude Code en catalogo/)
  assert.match(h, /Mandando tu pregunta/)
  assert.match(h, /Pensando la respuesta/)
  assert.match(h, /La primera respuesta tarda unos segundos\. Las que siguen, menos\./)
  assert.match(hilo(MODELO({ chat: c, ahoraMs: AHORA + 46000 })), /Está tardando más de lo normal\. Podés esperar o frenar/)
})

test('vista: el texto del modelo nunca es HTML, frenada y listo con su pie', () => {
  let c = evento(enviar(abierta()).chat, 'texto', { texto: '<img src=x onerror=alert(1)> **ok**' }).chat
  const fr = transicionChat(c, { tipo: 'frenar' }, CTX).chat
  const h = hilo(MODELO({ chat: fr }))
  assert.ok(!h.includes('<img'))
  assert.match(h, /■ frenaste acá/)
  assert.match(h, /Volver a preguntar/)
  c = evento(evento(enviar(abierta()).chat, 'texto', { texto: 'Listo.' }).chat, 'fin', { ms: 18000 }).chat
  assert.match(hilo(MODELO({ chat: c })), /18 s · Claude Code/)
})

test('vista error por motivo: títulos y cuerpos de 4.2, "No se envió" y la línea sin internet', () => {
  assert.deepEqual(textoError('red'), { titulo: 'No llego a Claude Code', cuerpo: 'Parece que no hay conexión. Tu mensaje no se perdió: lo mando de nuevo cuando quieras.', acciones: [['ch-reintentar', 'Reintentar'], ['ch-usar-local', 'Preguntarle al modelo local']] })
  assert.equal(textoError('sin-claude').titulo, 'No encuentro Claude Code')
  assert.equal(textoError('sesion').cuerpo, 'Abrí `claude` en una terminal para iniciar sesión y volvé a probar.')
  assert.equal(textoError('limite').titulo, 'Llegaste al límite de uso')
  assert.deepEqual(textoError('tope').acciones, [['ch-nueva', 'Charla nueva']])
  assert.equal(textoError('tiempo').cuerpo, 'Pasaron 2 minutos sin noticias.')
  assert.equal(textoError('proceso').titulo, 'Se cortó la sesión de Claude Code')
  assert.equal(textoError('adjunto', 'a.xlsx').titulo, 'No puedo leer a.xlsx')
  assert.equal(textoError('otro').titulo, 'Se cortó la sesión de Claude Code')
  let c = evento(enviar(abierta(), 'doc').chat, 'error', { motivo: 'red' }).chat
  const h = hilo(MODELO({ chat: { ...c, local: 'instalado' } }))
  assert.match(h, /No se envió/)
  assert.match(h, /role="alert"/)
  assert.match(h, /Sin internet · el modelo local sigue andando/)
  assert.ok(!hilo(MODELO({ chat: { ...c, local: 'falta' } })).includes('Sin internet'))
})

test('vista: escenario, cabecera, composer, menú, cajón y capa de soltar con sus nombres accesibles', () => {
  const c = abierta()
  assert.match(escena(MODELO()), /Ascua/)
  assert.match(escena(MODELO()), /te escucha · vía Claude Code/)
  const cab = cabecera(MODELO())
  assert.match(cab, /aria-label="Carpeta: catalogo"/)
  assert.match(cab, /role="radiogroup" aria-label="Motor"/)
  assert.match(comp(MODELO()), /Enter envía · Shift\+Enter, línea nueva/)
  assert.match(comp(MODELO()), /Claude Code · catalogo/)
  const ocupada = comp(MODELO({ chat: enviar(c).chat }))
  assert.match(ocupada, /aria-label="Frenar la respuesta"/)
  assert.match(ocupada, /Esperá la respuesta o frená con Esc/)
  const menu = menuCarpeta(MODELO({ chat: { ...c, menu: true, recientes: ['C:\\Users\\x\\Downloads'] } }))
  assert.match(menu, /role="menu"/)
  assert.match(menu, /Solo Avis/)
  assert.match(menu, /Sin carpeta: sabe de tus sesiones/)
  assert.match(menu, /Recientes/)
  assert.match(menu, /Downloads/)
  assert.match(menu, /＋ Elegir otra carpeta…/)
  const caj = cajon(MODELO({ chat: { ...c, cajon: true } }))
  assert.match(caj, /role="dialog" aria-modal="true"/)
  assert.match(caj, /Todavía no charlamos\. Lo que hablemos queda acá\./)
  assert.match(caj, /aria-label="Buscar en charlas"/)
  assert.match(capaSoltar(MODELO({ chat: { ...c, soltando: { nombre: 'a.pdf' } } })), /Soltalo y Ascua lo lee/)
})

test('el resumen se fue: ni resumen.js, ni #resumen, ni pedir_resumen', () => {
  const raiz = new URL('../', import.meta.url)
  const html = readFileSync(new URL('src/index.html', raiz), 'utf8')
  assert.ok(!/id="resumen"|anuncio-resumen/.test(html))
  assert.ok(html.includes('id="hoja"'))
  const main = readFileSync(new URL('src/main.js', raiz), 'utf8')
  assert.ok(!/resumen\.js|resumenMotion|pedir_resumen|estado_resumen|oficina:\/\/resumen/.test(main))
  assert.throws(() => readFileSync(new URL('src/resumen.js', raiz)))
  const lib = readFileSync(new URL('src-tauri/src/lib.rs', raiz), 'utf8')
  assert.ok(!/pedir_resumen|estado_resumen|cancelar_resumen/.test(lib))
  assert.ok(lib.includes('estado_modelo'))
})
