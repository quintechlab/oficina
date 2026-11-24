// Tests del modelo de Claude en la charla (#35): el selector de la cabecera (S1), el de las charlas
// nuevas en la configuración (S2), qué viaja a Rust (S3: `chat_abrir` y `guardar_chat` con el juego
// completo), sin selector con el motor local (S4) y el archivo de cada charla (`modelo`, opcional).
// Funciones puras de chat.js, chatVista.js, configuracion.js y configuracionVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MODELOS, modeloValido, nombreModelo, chatInicial, transicionChat, aArchivo, deArchivo, charlaDeCabecera, guardadosPendientes,
} from '../src/chat.js'
import { cabecera, menuModelo, menuCarpeta } from '../src/chatVista.js'
import { OPCIONES_MODELO, modeloDeValor, textoModelo } from '../src/configuracion.js'
import { partesModelos } from '../src/configuracionVista.js'

const AHORA = new Date(2026, 10, 24, 15, 30).getTime()
const CTX = { ahoraMs: AHORA, id: 'c-1', mascota: 'Ascua', datos: { proyectos: [] } }
const SESION = '0a1b2c3d-0000-4000-8000-000000000000'
const CATALOGO = 'C:\\Desktop\\catalogo'
const tipos = efectos => efectos.map(e => e.tipo)

function abierta(extra = {}) {
  return transicionChat({ ...chatInicial(), carpeta: CATALOGO, ...extra }, { tipo: 'abrir' }, CTX).chat
}
const evento = (c, tipo, datos = {}) => transicionChat(c, { tipo: 'backend', payload: { conversacion: c.conversacion.id, turno: c.turno, tipo, ...datos } }, CTX)
const enviar = (c, texto = 'hola') => transicionChat({ ...c, borrador: texto }, { tipo: 'enviar', texto, campo: true }, CTX)
/** Una charla con un turno terminado (mensajes y sesión de Claude Code). */
const conTurno = (c = abierta()) => evento(evento(enviar(c).chat, 'listo', { sesion: SESION }).chat, 'fin', { ms: 5 }).chat
const elegir = (c, modelo, ctx = CTX) => transicionChat(c, { tipo: 'elegir-modelo', modelo }, ctx)
/** Lo mínimo de la pestaña Modelos: sin claves y el modelo local sin leer. */
const DATOS_MODELOS = { claves: {}, modelo: textoModelo({}) }
const VISTA = chat => ({ chat, especie: 'ascua', ahoraMs: AHORA, puedeAdjuntar: true, proyectos: [] })

// ------------------------------------------------------------------ la lista (S1, S3)

test('MODELOS: Por defecto, Fable, Opus, Sonnet y Haiku, con sus alias y sus pistas', () => {
  assert.deepEqual(MODELOS.map(m => [m.id, m.nombre]), [
    [null, 'Por defecto'], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku'],
  ])
  assert.equal(MODELOS[0].pista, 'El de Claude Code')
  assert.equal(MODELOS.find(m => m.id === 'fable').pista, 'Más capaz, gasta más')
  assert.equal(MODELOS.find(m => m.id === 'haiku').pista, 'Rápido, gasta menos')
  // Un valor desconocido es "Por defecto"
  for (const v of ['opus', 'fable', 'sonnet', 'haiku']) assert.equal(modeloValido(v), v)
  for (const v of [null, undefined, '', 'gpt-5', 'Opus', 7, {}]) assert.equal(modeloValido(v), null)
  assert.equal(nombreModelo('opus'), 'Opus')
  assert.equal(nombreModelo('cualquiera'), 'Por defecto')
})

// ------------------------------------------------------------------ S1: el selector de la cabecera

test('la cabecera: el botón del modelo junto al motor, con su menú de cinco opciones y la elegida marcada', () => {
  const c = abierta()
  const cab = cabecera(VISTA(c))
  assert.match(cab, /<button type="button" class="modelo" data-accion="ch-modelo-menu" aria-haspopup="menu" aria-controls="chat-menu" aria-expanded="false" aria-label="Modelo: Por defecto"/)
  // Va después del motor ("junto a Claude Code | Local")
  assert.ok(cab.indexOf('role="radiogroup" aria-label="Motor"') < cab.indexOf('class="modelo"'))
  const abiertoMenu = transicionChat(c, { tipo: 'menu-modelo' }, CTX).chat
  assert.equal(abiertoMenu.menuModelo, true)
  assert.match(cabecera(VISTA(abiertoMenu)), /aria-expanded="true" aria-label="Modelo: Por defecto"/)
  const menu = menuModelo(VISTA({ ...c, conversacion: { ...c.conversacion, modelo: 'opus' } }))
  assert.match(menu, /^<div class="menu" role="menu" aria-label="Elegir modelo">/)
  assert.equal((menu.match(/role="menuitemradio"/g) ?? []).length, 5)
  assert.match(menu, /aria-checked="false" data-accion="ch-modelo" data-modelo=""><span><b>Por defecto<\/b><small>El de Claude Code<\/small><\/span>/)
  assert.match(menu, /aria-checked="true" data-accion="ch-modelo" data-modelo="opus"><span><b>Opus<\/b>/)
  assert.match(menu, /data-modelo="fable"><span><b>Fable<\/b><small>Más capaz, gasta más<\/small>/)
  assert.match(menu, /data-modelo="haiku"><span><b>Haiku<\/b><small>Rápido, gasta menos<\/small>/)
  assert.match(cabecera(VISTA({ ...c, conversacion: { ...c.conversacion, modelo: 'opus' } })), /aria-label="Modelo: Opus"[^>]*><span>Opus<\/span>/)
})

test('S1: cambiar el modelo con mensajes sigue la misma charla, la reabre con el modelo nuevo y lo guarda como preferencia', () => {
  const c = conTurno()
  const r = elegir({ ...c, menuModelo: true }, 'opus', { ...CTX, id: 'c-2' })
  assert.equal(r.chat.conversacion.id, 'c-1')
  assert.equal(r.chat.conversacion.modelo, 'opus')
  assert.equal(r.chat.conversacion.mensajes, c.conversacion.mensajes)
  assert.equal(r.chat.estado, 'listo')
  assert.equal(r.chat.menuModelo, false)
  assert.equal(r.chat.modelo, 'opus')
  assert.deepEqual(r.efectos.find(e => e.tipo === 'abrir'), { tipo: 'abrir', conversacion: 'c-1', motor: 'claude', carpeta: CATALOGO, sesionClaude: SESION, modelo: 'opus' })
  assert.deepEqual(r.efectos.find(e => e.tipo === 'preferencias'), { tipo: 'preferencias', motor: 'claude', carpeta: CATALOGO, modelo: 'opus' })
  // Nada en el cajón: no hubo charla nueva
  assert.deepEqual(r.chat.charlas, c.charlas)
  // "Por defecto" vuelve a null
  const d = elegir(r.chat, null)
  assert.equal(d.chat.conversacion.modelo, null)
  assert.equal(d.efectos.find(e => e.tipo === 'abrir').modelo, null)
  // El mismo modelo: solo se cierra el menú, sin reabrir nada
  const igual = elegir({ ...r.chat, menuModelo: true }, 'opus')
  assert.deepEqual(igual.efectos, [])
  assert.equal(igual.chat.menuModelo, false)
  // Uno que no existe: nada
  assert.equal(elegir(r.chat, 'gpt-5').chat, r.chat)
})

test('S1: sin mensajes, el mismo cambio en su lugar', () => {
  const c = abierta()
  const r = elegir(c, 'haiku', { ...CTX, id: 'c-2' })
  assert.equal(r.chat.conversacion.id, 'c-1')
  assert.equal(r.chat.conversacion.modelo, 'haiku')
  assert.equal(r.chat.estado, 'vacio')
  assert.deepEqual(r.efectos.find(e => e.tipo === 'abrir'), { tipo: 'abrir', conversacion: 'c-1', motor: 'claude', carpeta: CATALOGO, sesionClaude: null, modelo: 'haiku' })
  assert.deepEqual(r.efectos.find(e => e.tipo === 'preferencias'), { tipo: 'preferencias', motor: 'claude', carpeta: CATALOGO, modelo: 'haiku' })
})

test('con un turno en curso el selector no se usa: el evento no cambia nada y la vista lo dice', () => {
  const esperando = enviar(abierta()).chat
  assert.equal(esperando.estado, 'esperando')
  const escribiendo = evento(esperando, 'texto', { texto: 'va' }).chat
  assert.equal(escribiendo.estado, 'escribiendo')
  for (const c of [esperando, escribiendo]) {
    assert.equal(elegir(c, 'opus').chat, c)
    assert.equal(transicionChat(c, { tipo: 'menu-modelo' }, CTX).chat, c)
    assert.match(cabecera(VISTA(c)), /class="modelo" data-accion="ch-modelo-menu"[^>]*aria-disabled="true" title="Cambialo cuando termine la respuesta"/)
  }
  // Mandar cierra el menú abierto
  assert.equal(enviar({ ...abierta(), menuModelo: true }).chat.menuModelo, false)
  // Al terminar, se usa de nuevo
  const listo = evento(escribiendo, 'fin', { ms: 3 }).chat
  assert.doesNotMatch(cabecera(VISTA(listo)), /aria-disabled="true" title="Cambialo/)
  assert.equal(elegir(listo, 'opus').chat.conversacion.modelo, 'opus')
})

// ------------------------------------------------------------------ S4: el motor local no tiene selector

test('S4: con el motor local no hay selector, el evento no hace nada y Rust no recibe modelo', () => {
  const local = transicionChat(abierta({ modelo: 'opus' }), { tipo: 'motor', motor: 'local' }, CTX)
  assert.equal(local.chat.conversacion.motor, 'local')
  assert.equal(local.efectos.find(e => e.tipo === 'abrir').modelo, null)
  // La preferencia de las charlas de Claude Code sigue
  assert.deepEqual(local.efectos.find(e => e.tipo === 'preferencias'), { tipo: 'preferencias', motor: 'local', carpeta: CATALOGO, modelo: 'opus' })
  const cab = cabecera(VISTA(local.chat))
  assert.doesNotMatch(cab, /ch-modelo-menu|class="modelo"/)
  assert.equal(elegir(local.chat, 'haiku').chat, local.chat)
  assert.equal(transicionChat(local.chat, { tipo: 'menu-modelo' }, CTX).chat, local.chat)
  // De vuelta a Claude Code (sin mensajes): la preferencia
  const claude = transicionChat(local.chat, { tipo: 'motor', motor: 'claude' }, CTX)
  assert.equal(claude.chat.conversacion.modelo, 'opus')
  assert.equal(claude.efectos.find(e => e.tipo === 'abrir').modelo, 'opus')
})

// ------------------------------------------------------------------ S2: el de las charlas nuevas

test('S2: "modelo-nuevas" cambia solo la preferencia; la charla nueva y la que se abre después de 12 h arrancan con él', () => {
  const c = conTurno()
  const r = transicionChat(c, { tipo: 'modelo-nuevas', modelo: 'haiku' }, CTX)
  assert.deepEqual(r.efectos, [])
  assert.equal(r.chat.modelo, 'haiku')
  assert.equal(r.chat.conversacion, c.conversacion)
  assert.equal(transicionChat(c, { tipo: 'modelo-nuevas', modelo: 'gpt-5' }, CTX).chat, c)
  assert.equal(transicionChat(r.chat, { tipo: 'modelo-nuevas', modelo: null }, CTX).chat.modelo, null)
  const n = transicionChat(r.chat, { tipo: 'nueva' }, { ...CTX, id: 'c-2' })
  assert.equal(n.chat.conversacion.id, 'c-2')
  assert.equal(n.chat.conversacion.modelo, 'haiku')
  assert.equal(n.efectos.find(e => e.tipo === 'abrir').modelo, 'haiku')
  // Al abrir la hoja sin charla: la preferencia
  const a = transicionChat({ ...chatInicial(), modelo: 'sonnet' }, { tipo: 'abrir' }, CTX)
  assert.equal(a.chat.conversacion.modelo, 'sonnet')
  assert.equal(a.efectos.find(e => e.tipo === 'abrir').modelo, 'sonnet')
  // Sin preferencia, "Por defecto"
  assert.equal(chatInicial().modelo, null)
  assert.equal(abierta().conversacion.modelo, null)
})

// ------------------------------------------------------------------ menú y Esc (como el de carpeta)

test('el menú del modelo: abre y cierra, cierra el de carpeta y Esc lo cierra primero con el foco en su botón', () => {
  const c = abierta()
  const conCarpeta = transicionChat(c, { tipo: 'menu' }, CTX).chat
  const m = transicionChat(conCarpeta, { tipo: 'menu-modelo' }, CTX).chat
  assert.equal(m.menuModelo, true)
  assert.equal(m.menu, false)
  assert.equal(transicionChat(m, { tipo: 'menu-modelo' }, CTX).chat.menuModelo, false)
  // Abrir el de carpeta cierra el del modelo
  const k = transicionChat(m, { tipo: 'menu' }, CTX).chat
  assert.equal(k.menu, true)
  assert.equal(k.menuModelo, false)
  const r = transicionChat({ ...m, cajon: true }, { tipo: 'esc' }, CTX)
  assert.equal(r.chat.menuModelo, false)
  assert.equal(r.chat.cajon, true)
  assert.deepEqual(r.efectos, [{ tipo: 'foco', a: 'modelo' }])
  // Cerrar la hoja y abrir el cajón también lo cierran
  assert.equal(transicionChat(m, { tipo: 'cerrar' }, CTX).chat.menuModelo, false)
  assert.equal(transicionChat(m, { tipo: 'hist' }, CTX).chat.menuModelo, false)
  // El menú de carpeta sigue igual
  assert.match(menuCarpeta(VISTA(conCarpeta)), /role="menu" aria-label="Elegir carpeta"/)
})

// ------------------------------------------------------------------ D8 sigue para el motor y la carpeta

test('D8 sigue: la carpeta con mensajes abre una charla nueva con el modelo de la de antes; la preferencia va completa', () => {
  const c = elegir(conTurno(), 'sonnet').chat
  const r = transicionChat(c, { tipo: 'carpeta', carpeta: 'C:\\Desktop\\oficina' }, { ...CTX, id: 'c-2' })
  assert.equal(r.chat.conversacion.id, 'c-2')
  assert.equal(r.chat.conversacion.modelo, 'sonnet')
  assert.deepEqual(r.efectos.find(e => e.tipo === 'abrir'), { tipo: 'abrir', conversacion: 'c-2', motor: 'claude', carpeta: 'C:\\Desktop\\oficina', sesionClaude: null, modelo: 'sonnet' })
  assert.deepEqual(r.efectos.find(e => e.tipo === 'preferencias'), { tipo: 'preferencias', motor: 'claude', carpeta: 'C:\\Desktop\\oficina', modelo: 'sonnet' })
})

// ------------------------------------------------------------------ el archivo de cada charla

test('el archivo guarda el modelo; ida y vuelta da lo mismo; desconocido o sin él es "Por defecto"; el local no tiene', () => {
  const c = elegir(conTurno(), 'fable').chat
  const doc = aArchivo(c.conversacion)
  assert.equal(doc.modelo, 'fable')
  assert.equal(deArchivo(doc).modelo, 'fable')
  assert.deepEqual(aArchivo(deArchivo(doc)), doc)
  assert.equal(aArchivo(abierta().conversacion).modelo, null)
  assert.equal(deArchivo({ ...doc, modelo: 'gpt-5' }).modelo, null)
  const { modelo, ...sinModelo } = doc
  assert.equal(modelo, 'fable')
  assert.equal(deArchivo(sinModelo).modelo, null)
  assert.equal(deArchivo({ ...doc, motor: 'local', modelo: 'opus' }).modelo, null)
  const local = transicionChat(abierta(), { tipo: 'motor', motor: 'local' }, CTX).chat
  assert.equal(aArchivo({ ...local.conversacion, modelo: 'opus' }).modelo, null)
  // La lista del disco también lo trae
  assert.equal(charlaDeCabecera({ id: 'c-7', modelo: 'haiku' }).modelo, 'haiku')
  assert.equal(charlaDeCabecera({ id: 'c-7', modelo: 'x' }).modelo, null)
  assert.equal(charlaDeCabecera({ id: 'c-7' }).modelo, null)
})

test('cambiar el modelo de una charla con mensajes la guarda ya (sin Engram); sin mensajes, no', () => {
  const c = conTurno()
  const r = elegir(c, 'opus').chat
  assert.deepEqual(guardadosPendientes(c, r), [{ conversacion: r.conversacion, cuando: 'ya', engram: false }])
  assert.deepEqual(guardadosPendientes(abierta(), elegir(abierta(), 'opus').chat), [])
})

test('retomar una charla del disco la reabre con su modelo, no con la preferencia', () => {
  const doc = { ...aArchivo(elegir(conTurno(), 'sonnet').chat.conversacion), id: 'c-7' }
  let c = transicionChat({ ...abierta(), modelo: 'haiku' }, { tipo: 'historial', charlas: [charlaDeCabecera(doc)] }, CTX).chat
  c = { ...c, cajon: true }
  const r = transicionChat(c, { tipo: 'retomar', id: 'c-7', conversacion: doc }, CTX)
  assert.equal(r.chat.conversacion.id, 'c-7')
  assert.equal(r.chat.conversacion.modelo, 'sonnet')
  assert.equal(r.efectos.find(e => e.tipo === 'abrir').modelo, 'sonnet')
  assert.equal(r.chat.modelo, 'haiku')
})

// ------------------------------------------------------------------ S2: la fila de la configuración

test('Configuración › Modelos › Charla: la fila "Modelo" debajo de "Quién responde", con la preferencia marcada', () => {
  assert.deepEqual(OPCIONES_MODELO, [['defecto', 'Por defecto'], ['fable', 'Fable'], ['opus', 'Opus'], ['sonnet', 'Sonnet'], ['haiku', 'Haiku']])
  assert.equal(modeloDeValor('defecto'), null)
  assert.equal(modeloDeValor('opus'), 'opus')
  assert.equal(modeloDeValor('gpt-5'), undefined)
  const p = partesModelos({ ...DATOS_MODELOS, motor: 'claude', modeloNuevas: 'opus' })
  assert.ok(p.charla.indexOf('Quién responde') < p.charla.indexOf('>Modelo<'))
  assert.match(p.charla, /role="radiogroup" aria-label="Modelo"/)
  assert.match(p.charla, /aria-checked="true" tabindex="0" data-accion="cfg-modelo" data-valor="opus" data-k="cfg-modelo-opus">Opus</)
  assert.match(p.charla, /aria-checked="false" tabindex="-1" data-accion="cfg-modelo" data-valor="defecto" data-k="cfg-modelo-defecto">Por defecto</)
  // Sin preferencia, "Por defecto"
  assert.match(partesModelos(DATOS_MODELOS).charla, /aria-checked="true" tabindex="0" data-accion="cfg-modelo" data-valor="defecto"/)
  // El error al guardar, debajo de su fila
  assert.match(partesModelos({ ...DATOS_MODELOS, error: 'modelo-claude' }).charla, /No se pudo guardar\. Probá de nuevo\./)
  // "Quién responde" sigue con sus dos segmentos
  assert.match(p.charla, /data-accion="cfg-motor" data-valor="claude"/)
})

// ------------------------------------------------------------------ el contrato con Rust (main.js)

test('main.js manda siempre el juego completo a guardar_chat y el modelo a chat_abrir', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const llamadas = [...main.matchAll(/invocar\('guardar_chat', \{([^}]*)\}/g)].map(m => m[1])
  assert.ok(llamadas.length >= 4, `guardar_chat: ${llamadas.length} llamadas`)
  for (const l of llamadas) assert.match(l, /motor[\s\S]*carpeta[\s\S]*modelo/, l)
  const abrir = [...main.matchAll(/invocar\('chat_abrir', \{([^}]*)\}/g)].map(m => m[1])
  assert.equal(abrir.length, 1)
  assert.match(abrir[0], /modelo: e\.modelo/)
  // La preferencia se lee al arrancar
  assert.match(main, /modelo: modeloValido\(m\.chat\.modelo\)/)
})
