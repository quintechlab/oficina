// Tests del historial de la charla en la ventana (docs/diseno/chat-avis-ux.md 9 y 14.1): el formato
// del archivo (ida y vuelta), cuándo se guarda, retomar desde el disco, recordar la última charla al
// arrancar (D11), buscar y borrar con confirmación (D24, D29). Funciones puras de chat.js y
// chatVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chatInicial, transicionChat, aArchivo, deArchivo, charlaDeCabecera, guardadosPendientes, coincideBusqueda, listaCharlas, RETOMAR_MS,
} from '../src/chat.js'
import { listaHistorial, cajon } from '../src/chatVista.js'

const AHORA = new Date(2026, 10, 24, 15, 30).getTime()
const MIN = 60000
const CTX = { ahoraMs: AHORA, id: 'c-1', mascota: 'Ascua', datos: { proyectos: [] } }
const SESION = '0a1b2c3d-0000-4000-8000-000000000000'

function abierta(extra = {}) {
  return transicionChat({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo', ...extra }, { tipo: 'abrir' }, CTX).chat
}
const evento = (c, tipo, datos = {}) => transicionChat(c, { tipo: 'backend', payload: { conversacion: c.conversacion.id, turno: c.turno, tipo, ...datos } }, CTX)
const enviar = (c, texto = 'hola', ctx = CTX) => transicionChat({ ...c, borrador: texto }, { tipo: 'enviar', texto, campo: true }, ctx)

/** Una charla con un turno completo: el mensaje, el init (la sesión), el eco, texto y fin. */
function conTurno(c = abierta(), texto = '¿En qué anda cada sesión?') {
  c = enviar(c, texto).chat
  c = evento(c, 'listo', { sesion: SESION }).chat
  c = evento(c, 'recibido').chat
  c = evento(c, 'herramienta', { nombre: 'Read', detalle: 'README.md' }).chat
  c = evento(c, 'texto', { texto: 'Todo **tranquilo**.' }).chat
  return evento(c, 'fin', { ms: 1800 }).chat
}

const DOC = {
  v: 1, id: 'c-7', titulo: 'Colores', creada: '2026-11-24T12:00:00.000Z', actualizada: '2026-11-24T12:05:00.000Z',
  motor: 'claude', carpeta: 'C:\\Desktop\\catalogo', sesionClaude: SESION, engramId: 12,
  mensajes: [
    { rol: 'usuario', texto: 'Mi color es verde', cuando: '2026-11-24T12:00:00.000Z', estado: 'ok', adjuntos: [] },
    { rol: 'mascota', texto: 'Anotado: verde.', cuando: '2026-11-24T12:00:02.000Z', estado: 'ok', herramientas: [{ nombre: 'Read', detalle: 'README.md' }], ms: 1800, avis: true },
  ],
}

// ------------------------------------------------------------------ el formato del archivo (9.1)

test('aArchivo: el formato v1 de 9.1, con las fechas en ISO y sin los datos de la ventana', () => {
  const c = conTurno()
  const doc = aArchivo(c.conversacion)
  assert.equal(doc.v, 1)
  assert.equal(doc.id, 'c-1')
  assert.equal(doc.titulo, '¿En qué anda cada sesión')
  assert.equal(doc.motor, 'claude')
  assert.equal(doc.carpeta, 'C:\\Desktop\\catalogo')
  assert.equal(doc.sesionClaude, SESION)
  assert.equal(doc.creada, new Date(AHORA).toISOString())
  assert.equal(doc.actualizada, new Date(AHORA).toISOString())
  assert.deepEqual(doc.mensajes, [
    { rol: 'usuario', texto: '¿En qué anda cada sesión?', cuando: new Date(AHORA).toISOString(), estado: 'ok', adjuntos: [] },
    { rol: 'mascota', texto: 'Todo **tranquilo**.', cuando: new Date(AHORA).toISOString(), estado: 'ok', herramientas: [{ nombre: 'Read', detalle: 'README.md' }], ms: 1800, avis: false },
  ])
  // Nada de lo que es solo de la ventana: el turno, las rutas de los adjuntos, "Charla nueva en"
  assert.ok(!/"turno"|"rutas"|"nuevaEn"|"ruta"/.test(JSON.stringify(doc)))
})

test('aArchivo: los adjuntos quedan con nombre y tamaño, nunca con su ruta (D23)', () => {
  let c = abierta()
  c = { ...c, adjuntos: [{ nombre: 'presupuesto-2027.pdf', tipo: 'pdf', bytes: 1468006, paginas: 14, ruta: 'C:\\Users\\x\\presupuesto-2027.pdf' }] }
  c = enviar(c, 'Resumime esto').chat
  const doc = aArchivo(c.conversacion)
  assert.deepEqual(doc.mensajes[0].adjuntos, [{ nombre: 'presupuesto-2027.pdf', tipo: 'pdf', bytes: 1468006, paginas: 14 }])
  assert.ok(!JSON.stringify(doc).includes('C:\\\\Users'))
})

test('aArchivo: la sesión de Claude Code va solo si ya se usó (si no, retomarla sería un --resume a nada)', () => {
  let c = abierta()
  // chat_abrir devuelve la sesión que Rust generó, antes de usarla
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-1', resultado: { proceso: 'arrancando', sesion: SESION } }, CTX).chat
  c = enviar(c).chat
  assert.equal(aArchivo(c.conversacion).sesionClaude, null)
  // Con el eco o el init, ya es una sesión de Claude Code
  assert.equal(aArchivo(evento(c, 'recibido').chat.conversacion).sesionClaude, SESION)
  assert.equal(aArchivo(evento(c, 'listo', { sesion: SESION }).chat.conversacion).sesionClaude, SESION)
})

test('aArchivo: una respuesta que quedó a medias (se cambió de charla) se guarda como error; sin texto, no se guarda', () => {
  let c = enviar(abierta()).chat
  assert.deepEqual(aArchivo(c.conversacion).mensajes.map(m => m.rol), ['usuario'])
  c = evento(c, 'texto', { texto: 'Parte' }).chat
  const m = aArchivo(c.conversacion).mensajes[1]
  assert.equal(m.estado, 'error')
  assert.equal(m.texto, 'Parte')
  // Frenada y no enviado quedan como están
  const f = transicionChat(c, { tipo: 'frenar' }, CTX).chat
  assert.equal(aArchivo(f.conversacion).mensajes[1].estado, 'frenada')
  const e = evento(enviar(abierta()).chat, 'error', { motivo: 'red' }).chat
  assert.deepEqual(aArchivo(e.conversacion).mensajes.map(x => x.estado), ['no-enviado'])
})

test('deArchivo: de vuelta a la ventana; ida y vuelta da lo mismo', () => {
  const conv = deArchivo(DOC)
  assert.equal(conv.id, 'c-7')
  assert.equal(conv.creada, Date.parse(DOC.creada))
  assert.equal(conv.actualizada, Date.parse(DOC.actualizada))
  assert.equal(conv.sesionClaude, SESION)
  assert.equal(conv.mensajes.length, 2)
  // Los turnos de la ventana empiezan en 1: lo retomado es el turno 0 (nunca choca con uno nuevo)
  assert.ok(conv.mensajes.every(m => m.turno === 0))
  assert.equal(conv.mensajes[1].avis, true)
  const { engramId, ...sinEngram } = DOC
  assert.equal(engramId, 12)
  // Un archivo de antes del #35 (sin `modelo`) se lee como "Por defecto" y se vuelve a guardar con él
  assert.equal(conv.modelo, null)
  assert.deepEqual(aArchivo(conv), { ...sinEngram, engramId: null, modelo: null })
  // Algo que no es una charla: null
  for (const malo of [null, {}, { ...DOC, v: 2 }, { ...DOC, id: 7 }, { ...DOC, mensajes: 'x' }]) assert.equal(deArchivo(malo), null)
})

test('charlaDeCabecera: lo que lista Rust (sin mensajes, con texto para buscar)', () => {
  const { mensajes, ...cab } = DOC
  const x = charlaDeCabecera({ ...cab, texto: 'Mi color es verde\nAnotado: verde.' })
  assert.deepEqual(x, { id: 'c-7', titulo: 'Colores', motor: 'claude', carpeta: 'C:\\Desktop\\catalogo', modelo: null, creada: Date.parse(DOC.creada), actualizada: Date.parse(DOC.actualizada), texto: 'Mi color es verde\nAnotado: verde.' })
  assert.equal(mensajes.length, 2)
  assert.equal(charlaDeCabecera({ id: 'c-1' })?.titulo ?? null, null)
  assert.equal(charlaDeCabecera(null), null)
})

test('coincideBusqueda también busca en el texto de una charla del disco', () => {
  const x = charlaDeCabecera({ ...DOC, mensajes: undefined, texto: 'Mi color es verde' })
  assert.ok(coincideBusqueda(x, 'VERDÉ'))
  assert.ok(coincideBusqueda(x, 'colores'))
  assert.ok(!coincideBusqueda(x, 'azul'))
})

// ------------------------------------------------------------------ cuándo se guarda (9.1)

const cuando = (antes, despues) => guardadosPendientes(antes, despues).map(g => [g.conversacion.id, g.cuando, g.engram])

test('se guarda al mandar, en cada fin (con Engram), frenada o error, y cada 2 s mientras llega texto', () => {
  const c0 = abierta()
  // Vacía: nada
  assert.deepEqual(cuando(chatInicial(), c0), [])
  const c1 = enviar(c0).chat
  assert.deepEqual(cuando(c0, c1), [['c-1', 'ya', false]])
  const c2 = evento(c1, 'listo', { sesion: SESION }).chat
  assert.deepEqual(cuando(c1, c2), [])
  const c3 = evento(c2, 'texto', { texto: 'Hola' }).chat
  assert.deepEqual(cuando(c2, c3), [['c-1', 'luego', false]])
  const c4 = evento(c3, 'fin', { ms: 10 }).chat
  assert.deepEqual(cuando(c3, c4), [['c-1', 'ya', true]])
  const f = transicionChat(c3, { tipo: 'frenar' }, CTX).chat
  assert.deepEqual(cuando(c3, f), [['c-1', 'ya', false]])
  const e = evento(c3, 'error', { motivo: 'proceso' }).chat
  assert.deepEqual(cuando(c3, e), [['c-1', 'ya', false]])
  // Lo que no cambia la charla (abrir el cajón, escribir), nada
  assert.deepEqual(cuando(c4, transicionChat(c4, { tipo: 'hist' }, CTX).chat), [])
  assert.deepEqual(cuando(c4, transicionChat(c4, { tipo: 'escribir', texto: 'x' }, CTX).chat), [])
})

test('cambiar de charla con una respuesta en curso guarda la de antes en ese momento', () => {
  const c = evento(enviar(abierta()).chat, 'texto', { texto: 'Parte' }).chat
  const nueva = transicionChat(c, { tipo: 'nueva' }, { ...CTX, id: 'c-2' }).chat
  assert.deepEqual(cuando(c, nueva), [['c-1', 'ya', false]])
  assert.equal(guardadosPendientes(c, nueva)[0].conversacion.mensajes.at(-1).texto, 'Parte')
  // Sin respuesta en curso ya estaba guardada: nada
  const quieta = conTurno()
  assert.deepEqual(cuando(quieta, transicionChat(quieta, { tipo: 'nueva' }, { ...CTX, id: 'c-2' }).chat), [])
})

// ------------------------------------------------------------------ el cajón con el disco

test('historial: el cajón lista lo del disco y lo de esta ejecución, sin repetir, lo más nuevo primero', () => {
  const c = conTurno()
  const vieja = { ...DOC, id: 'c-viejo', actualizada: new Date(AHORA - 3 * 24 * 60 * MIN).toISOString(), mensajes: undefined, texto: 'algo' }
  const deEsta = { ...DOC, id: 'c-1', titulo: 'versión del disco', actualizada: new Date(AHORA - MIN).toISOString(), mensajes: undefined, texto: '' }
  const r = transicionChat(c, { tipo: 'historial', charlas: [deEsta, vieja, { roto: true }] }, CTX)
  const lista = listaCharlas(r.chat)
  assert.deepEqual(lista.map(x => x.id), ['c-1', 'c-viejo'])
  // La de ahora es la de la ventana, no la copia del disco
  assert.equal(lista[0].titulo, '¿En qué anda cada sesión')
  // Al abrir el cajón se vuelve a leer el disco
  assert.deepEqual(transicionChat(c, { tipo: 'hist' }, CTX).efectos.map(e => e.tipo), ['historial', 'foco'])
  assert.deepEqual(transicionChat({ ...c, cajon: true }, { tipo: 'hist' }, CTX).efectos.map(e => e.tipo), ['foco'])
})

test('retomar una charla del disco: primero se lee, después se retoma con su sesión (--resume)', () => {
  const c = transicionChat(abierta(), { tipo: 'historial', charlas: [{ ...DOC, mensajes: undefined, texto: '' }] }, CTX).chat
  const r1 = transicionChat({ ...c, cajon: true }, { tipo: 'retomar', id: 'c-7' }, CTX)
  assert.deepEqual(r1.efectos, [{ tipo: 'leer', id: 'c-7', para: 'retomar' }])
  assert.equal(r1.chat.conversacion.id, 'c-1')
  const r2 = transicionChat(r1.chat, { tipo: 'retomar', id: 'c-7', conversacion: DOC }, CTX)
  assert.equal(r2.chat.conversacion.id, 'c-7')
  assert.equal(r2.chat.estado, 'listo')
  assert.equal(r2.chat.cajon, false)
  assert.deepEqual(r2.efectos.find(e => e.tipo === 'abrir'), { tipo: 'abrir', conversacion: 'c-7', motor: 'claude', carpeta: 'C:\\Desktop\\catalogo', sesionClaude: SESION, modelo: null })
  // Lo leído de otra charla no se mezcla
  assert.equal(transicionChat(r1.chat, { tipo: 'retomar', id: 'c-7', conversacion: { ...DOC, id: 'c-8' } }, CTX).chat, r1.chat)
})

test('al arrancar se recuerda la última charla si es de las últimas 12 h (D11); si no, nada', () => {
  const reciente = { ...DOC, actualizada: new Date(AHORA - 2 * 60 * MIN).toISOString(), mensajes: undefined, texto: '' }
  const r = transicionChat(chatInicial(), { tipo: 'historial', charlas: [reciente] }, CTX)
  assert.deepEqual(r.efectos, [{ tipo: 'leer', id: 'c-7', para: 'recordar' }])
  const vieja = { ...reciente, actualizada: new Date(AHORA - RETOMAR_MS - MIN).toISOString() }
  assert.deepEqual(transicionChat(chatInicial(), { tipo: 'historial', charlas: [vieja] }, CTX).efectos, [])
  // Recordar: la charla queda lista para cuando se abra la hoja, que la retoma
  const rec = transicionChat(r.chat, { tipo: 'recordar', conversacion: DOC }, { ...CTX, ahoraMs: Date.parse(DOC.actualizada) + MIN }).chat
  assert.equal(rec.conversacion.id, 'c-7')
  assert.equal(rec.abierta, false)
  const ab = transicionChat(rec, { tipo: 'abrir' }, { ...CTX, ahoraMs: Date.parse(DOC.actualizada) + MIN })
  assert.equal(ab.chat.conversacion.id, 'c-7')
  assert.equal(ab.chat.estado, 'listo')
  // Si ya hay una charla (se abrió la hoja antes de que llegara), recordar no la pisa
  const ya = abierta()
  assert.equal(transicionChat(ya, { tipo: 'recordar', conversacion: DOC }, CTX).chat, ya)
  assert.deepEqual(transicionChat(ya, { tipo: 'historial', charlas: [reciente] }, CTX).efectos, [])
})

// ------------------------------------------------------------------ borrar (D24, D29)

function conHistorial() {
  let c = conTurno()
  c = transicionChat(c, { tipo: 'historial', charlas: [{ ...DOC, mensajes: undefined, texto: '' }] }, CTX).chat
  return transicionChat(c, { tipo: 'hist' }, CTX).chat
}

test('borrar: el menú de la charla, confirmar en el mismo botón y recién ahí borrar', () => {
  let c = conHistorial()
  c = transicionChat(c, { tipo: 'menu-charla', id: 'c-7' }, CTX).chat
  assert.deepEqual(c.menuCharla, { id: 'c-7', confirmar: false })
  let html = listaHistorial({ chat: c, especie: 'ascua', ahoraMs: AHORA })
  assert.match(html, /role="menu"/)
  assert.match(html, /data-accion="ch-borrar"[^>]*>Borrar</)
  assert.match(html, /title="Borra la charla de Avis\. Claude Code guarda su propia copia"/)
  // Primer clic: pide confirmar
  let r = transicionChat(c, { tipo: 'borrar-charla' }, CTX)
  assert.deepEqual(r.efectos, [])
  assert.equal(r.chat.menuCharla.confirmar, true)
  html = listaHistorial({ chat: r.chat, especie: 'ascua', ahoraMs: AHORA })
  assert.match(html, />¿Borrar\? Sí</)
  // A los 3 s sin el segundo clic, vuelve solo
  assert.equal(transicionChat(r.chat, { tipo: 'no-borrar' }, CTX).chat.menuCharla.confirmar, false)
  // Segundo clic: borra
  r = transicionChat(r.chat, { tipo: 'borrar-charla' }, CTX)
  assert.deepEqual(r.efectos, [{ tipo: 'borrar', id: 'c-7' }, { tipo: 'foco', a: 'buscar' }])
  assert.equal(r.chat.menuCharla, null)
  assert.deepEqual(listaCharlas(r.chat).map(x => x.id), ['c-1'])
})

test('borrar la charla de ahora empieza una vacía; con una respuesta en curso no se puede', () => {
  let c = conHistorial()
  c = transicionChat(c, { tipo: 'menu-charla', id: 'c-1' }, CTX).chat
  c = transicionChat(c, { tipo: 'borrar-charla' }, CTX).chat
  const r = transicionChat(c, { tipo: 'borrar-charla' }, { ...CTX, id: 'c-9' })
  assert.equal(r.chat.conversacion.id, 'c-9')
  assert.equal(r.chat.conversacion.mensajes.length, 0)
  assert.equal(r.chat.estado, 'vacio')
  assert.deepEqual(r.efectos.map(e => e.tipo), ['borrar', 'abrir', 'foco'])
  // En curso
  let o = enviar(conHistorial()).chat
  o = transicionChat({ ...o, cajon: true }, { tipo: 'menu-charla', id: 'c-1' }, CTX).chat
  o = transicionChat(o, { tipo: 'borrar-charla' }, CTX).chat
  assert.deepEqual(transicionChat(o, { tipo: 'borrar-charla' }, CTX).efectos, [])
})

test('Esc: el menú de la charla se cierra antes que el cajón, y el foco vuelve a la charla', () => {
  let c = transicionChat(conHistorial(), { tipo: 'menu-charla', id: 'c-7' }, CTX).chat
  let r = transicionChat(c, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.menuCharla, null)
  assert.equal(r.chat.cajon, true)
  assert.deepEqual(r.efectos, [{ tipo: 'foco', a: 'charla', id: 'c-7' }])
  r = transicionChat(r.chat, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.cajon, false)
  // Cerrar el cajón cierra también el menú
  c = transicionChat(conHistorial(), { tipo: 'menu-charla', id: 'c-7' }, CTX).chat
  assert.equal(transicionChat(c, { tipo: 'hist' }, CTX).chat.menuCharla, null)
  // El mismo menú dos veces: se cierra
  assert.equal(transicionChat(c, { tipo: 'menu-charla', id: 'c-7' }, CTX).chat.menuCharla, null)
})

// ------------------------------------------------------------------ el pie del cajón

test('el pie del cajón dice dónde quedó guardado: también en Engram, o Engram apagado', () => {
  const c = conHistorial()
  assert.match(cajon({ chat: { ...c, engram: 'si' }, especie: 'ascua', ahoraMs: AHORA }), /Guardado en esta PC · también en Engram/)
  assert.match(cajon({ chat: { ...c, engram: 'no' }, especie: 'ascua', ahoraMs: AHORA }), /Guardado en esta PC · Engram apagado/)
})
