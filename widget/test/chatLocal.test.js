// Tests del motor local en la charla, del lado de la ventana (docs/diseno/chat-avis-ux.md 8, entrega
// 6): la historia que viaja con cada turno (llama-server no recuerda nada), los datos de Avis en cada
// turno, la tarjeta de descarga sin el modelo, la espera mientras despierta el motor y lo que se
// guarda. Funciones puras de chat.js y chatVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chatInicial, transicionChat, historiaLocal, puedeVencer, aArchivo, SIN_NOTICIAS_MS } from '../src/chat.js'
import { hilo } from '../src/chatVista.js'

const AHORA = new Date(2026, 10, 24, 15, 30).getTime()
const DATOS = { proyectos: [{ nombre: 'catalogo', sesiones: [{ actividad: 'editando ventas.ts' }] }] }
const CTX = { ahoraMs: AHORA, id: 'c-1', mascota: 'Ascua', datos: DATOS }
const SESION = '0a1b2c3d-0000-4000-8000-000000000000'

/** Una charla abierta con el motor local y el modelo en `local` ('instalado' si no se dice). */
function local(estado = 'instalado') {
  let c = transicionChat({ ...chatInicial(), motor: 'local' }, { tipo: 'abrir' }, CTX).chat
  c = transicionChat(c, { tipo: 'abierta', conversacion: c.conversacion.id, resultado: { proceso: 'apagado', sesion: SESION, local: estado } }, CTX).chat
  return c
}
const evento = (c, tipo, datos = {}) => transicionChat(c, { tipo: 'backend', payload: { conversacion: c.conversacion.id, turno: c.turno, tipo, ...datos } }, CTX).chat
const enviar = (c, texto, ctx = CTX) => transicionChat({ ...c, borrador: texto }, { tipo: 'enviar', texto, campo: true }, ctx)
const efecto = (r, tipo) => r.efectos.find(e => e.tipo === tipo)

/** Un turno local entero: listo (el motor), recibido, pensando, texto y fin. */
function turno(c, pregunta, respuesta) {
  c = enviar(c, pregunta).chat
  for (const t of ['listo', 'recibido', 'pensando']) c = evento(c, t)
  c = evento(c, 'texto', { texto: respuesta })
  return evento(c, 'fin', { ms: 900 })
}

test('historiaLocal: los mensajes anteriores que se vieron, sin los que no salieron ni las respuestas vacías', () => {
  const mensajes = [
    { rol: 'usuario', texto: 'Hola', estado: 'ok' },
    { rol: 'mascota', texto: '¡Hola!', estado: 'ok' },
    { rol: 'usuario', texto: 'No salió', estado: 'no-enviado' },
    { rol: 'usuario', texto: 'Contame', estado: 'ok' },
    { rol: 'mascota', texto: 'Había una vez', estado: 'frenada' },
    { rol: 'usuario', texto: 'Otra', estado: 'ok' },
    { rol: 'mascota', texto: '', estado: 'error' },
  ]
  assert.deepEqual(historiaLocal(mensajes), [
    { rol: 'usuario', texto: 'Hola' },
    { rol: 'mascota', texto: '¡Hola!' },
    { rol: 'usuario', texto: 'Contame' },
    { rol: 'mascota', texto: 'Había una vez' },
    { rol: 'usuario', texto: 'Otra' },
  ])
  assert.deepEqual(historiaLocal([]), [])
})

test('mandar con el motor local lleva la historia de la charla (llama-server no recuerda nada)', () => {
  let c = turno(local(), '¿Quién me espera?', 'Nadie te espera.')
  const r = enviar(c, '¿Y en catalogo?')
  const e = efecto(r, 'enviar')
  assert.deepEqual(e.historia, [{ rol: 'usuario', texto: '¿Quién me espera?' }, { rol: 'mascota', texto: 'Nadie te espera.' }])
  assert.equal(e.texto, '¿Y en catalogo?')
  assert.deepEqual(e.adjuntos, [])
  // El primer turno va sin historia
  assert.deepEqual(efecto(enviar(local(), 'Hola'), 'enviar').historia, [])
})

test('con Claude Code, mandar no cambia: sin historia (Claude Code la guarda en su sesión)', () => {
  const c = transicionChat({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo' }, { tipo: 'abrir' }, CTX).chat
  const e = efecto(enviar(c, 'Hola'), 'enviar')
  assert.equal('historia' in e, false)
  assert.deepEqual(Object.keys(e).sort(), ['adjuntos', 'conversacion', 'texto', 'tipo', 'turno'])
})

test('con el motor local, los datos de Avis viajan en cada turno ("Miró tus sesiones de Avis" siempre)', () => {
  let c = turno(local(), 'Hola', 'Hola.')
  assert.equal(c.conversacion.mensajes.at(-1).avis, true)
  c = turno(c, '¿Y ahora?', 'Igual.')
  assert.equal(c.conversacion.mensajes.at(-1).avis, true, 'mismos datos, igual viajan')
  // Con Claude Code sigue igual: solo si cambiaron
  let k = transicionChat({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo' }, { tipo: 'abrir' }, CTX).chat
  k = turno(k, 'Hola', 'Hola.')
  k = turno(k, '¿Y ahora?', 'Igual.')
  assert.equal(k.conversacion.mensajes.at(-1).avis, false)
})

test('sin el modelo (falta o bajando) no se manda nada y lo escrito queda; instalado o roto, sí', () => {
  for (const estado of ['falta', 'bajando']) {
    const c = local(estado)
    const r = enviar(c, '¿Quién me espera?')
    assert.equal(r.chat.estado, 'vacio', estado)
    assert.equal(r.chat.borrador, '¿Quién me espera?')
    assert.deepEqual(r.efectos, [])
  }
  for (const estado of ['instalado', 'roto']) assert.equal(enviar(local(estado), 'Hola').chat.estado, 'esperando', estado)
  // Antes de que chat_abrir diga qué hay (sin saber), un Enter rápido no se pierde: Rust dice si falta
  const pronto = transicionChat({ ...chatInicial(), motor: 'local' }, { tipo: 'abrir' }, CTX).chat
  assert.equal(pronto.local, 'sin-saber')
  assert.equal(enviar(pronto, 'Hola').chat.estado, 'esperando')
  assert.match(hilo({ chat: pronto, especie: 'avi', ahoraMs: AHORA, puedeAdjuntar: true }), /Te respondo con el modelo de esta PC/)
})

test('una charla local con mensajes y sin el modelo muestra la tarjeta de descarga y su progreso al final', () => {
  let c = turno(local(), 'Hola', 'Hola.')
  c = transicionChat(c, { tipo: 'modelo', modelo: 'falta', bajado: 0, total: 2_800_000_000 }, CTX).chat
  const m = { chat: c, especie: 'avi', ahoraMs: AHORA, puedeAdjuntar: true }
  let h = hilo(m)
  assert.ok(h.indexOf('Hola.') < h.indexOf('data-accion="ch-descargar"'), 'después de los mensajes')
  assert.match(h, /Descargar 2,6 GB/)
  c = transicionChat(c, { tipo: 'modelo', modelo: 'bajando', bajado: 1_400_000_000, total: 2_800_000_000 }, CTX).chat
  h = hilo({ ...m, chat: c })
  assert.match(h, /role="progressbar"[^>]*aria-valuenow="50"/)
  // Con el modelo instalado, sin tarjeta
  c = transicionChat(c, { tipo: 'modelo', modelo: 'listo', bajado: 2_800_000_000, total: 2_800_000_000 }, CTX).chat
  assert.equal(hilo({ ...m, chat: c }).includes('class="descarga"'), false)
})

test('mientras despierta el motor (paso 0) no vence la espera: Rust tiene sus propios topes', () => {
  let c = enviar(local(), 'Hola').chat
  assert.equal(puedeVencer(c), false)
  assert.equal(transicionChat(c, { tipo: 'vencio', turno: c.turno }, { ...CTX, ahoraMs: AHORA + SIN_NOTICIAS_MS }).chat, c)
  // Con el motor listo, sí: el error local (no "Claude Code no respondió") y se frena
  c = evento(c, 'listo')
  assert.equal(puedeVencer(c), true)
  const r = transicionChat(c, { tipo: 'vencio', turno: c.turno }, { ...CTX, ahoraMs: AHORA + SIN_NOTICIAS_MS })
  assert.equal(r.chat.estado, 'error')
  assert.deepEqual(r.chat.error, { motivo: 'local', detalle: 'Pasaron 2 minutos sin noticias' })
  assert.ok(efecto(r, 'frenar'))
})

test('con Claude Code, vencer sigue igual: también en el paso 0 y con el motivo tiempo', () => {
  const c = enviar(transicionChat({ ...chatInicial(), carpeta: 'C:\\x' }, { tipo: 'abrir' }, CTX).chat, 'Hola').chat
  assert.equal(puedeVencer(c), true)
  const r = transicionChat(c, { tipo: 'vencio', turno: c.turno }, { ...CTX, ahoraMs: AHORA + SIN_NOTICIAS_MS })
  assert.deepEqual(r.chat.error, { motivo: 'tiempo', detalle: null })
})

test('una charla local se guarda sin sesión de Claude Code', () => {
  const c = turno(local(), 'Hola', 'Hola.')
  const doc = aArchivo(c.conversacion)
  assert.equal(doc.motor, 'local')
  assert.equal(doc.carpeta, null)
  assert.equal(doc.sesionClaude, null)
  assert.equal(doc.mensajes[1].avis, true)
})
