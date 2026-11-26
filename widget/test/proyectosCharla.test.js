// Tests de la charla del proyecto en la ventana (#44, docs/diseno/proyectos-ux.md 4.4, 4.5, 8, 11.5 y 11.6
// casos 4 y 9, entrega P2): las charlas de cada proyecto y su cuenta, las marcas de contexto, la charla
// nueva del proyecto y la que se retoma, el historial con `proyecto`, la hoja (chip, carpeta fija, `.ctx-p`,
// pie, avisos de la carpeta perdida y del proyecto borrado), el cajón filtrado y la ficha con sus charlas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  charlasDe, cuentaCharlas, marcasContexto, pieContexto, lineaBorrar, textoBorradoFallido, textoMensajes, verLasCharlas,
  filtroCharlas, nombreChipProyecto, AVISO_CARPETA_PERDIDA, AVISO_CARPETA_CAMBIO, AVISO_PROYECTO_BORRADO, TOPE_CHARLAS_FICHA, proyectoParaAbrir,
} from '../src/proyectos.js'
import { chatInicial, transicionChat, aArchivo, deArchivo, charlaDeCabecera, listaCharlas } from '../src/chat.js'
import { cabecera, composer, hilo, listaHistorial, cajon, contextoProyecto, chipProyecto } from '../src/chatVista.js'
import { fichaProyecto } from '../src/proyectosVista.js'

const AHORA = new Date(2026, 10, 25, 15, 30).getTime()
const MIN = 60000
const CTX = { ahoraMs: AHORA, id: 'c-nueva', mascota: 'Pancho', datos: { proyectos: [] } }
const RUTA = 'C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027'
const INFO = { id: 'p-presu', nombre: 'Presupuestos 2027', color: 'ambar', carpeta: { nombre: 'Presupuestos 2027', ruta: RUTA, estado: 'ok' } }
const sinEtiquetas = html => html.replace(/<[^>]+>/g, '')

const charla = (id, proyecto, actualizada, extra = {}) => ({ id, titulo: id, motor: 'claude', carpeta: null, modelo: null, creada: actualizada, actualizada, texto: '', ...(proyecto ? { proyecto } : {}), ...extra })

// ------------------------------------------------------------------ 4. charlasDe y cuentaCharlas

test('charlasDe: solo las del proyecto, de la más nueva a la más vieja; cuentaCharlas por proyecto (caso 4)', () => {
  const lista = [charla('c-a', 'p-presu', 10), charla('c-b', null, 30), charla('c-c', 'p-presu', 20), charla('c-d', 'p-casa', 5)]
  assert.deepEqual(charlasDe(lista, 'p-presu').map(x => x.id), ['c-c', 'c-a'])
  assert.deepEqual(charlasDe(lista, 'p-nada'), [])
  assert.deepEqual(cuentaCharlas(lista), { 'p-presu': 2, 'p-casa': 1 })
  assert.equal(TOPE_CHARLAS_FICHA, 5)
})

// ------------------------------------------------------------------ 9. marcasContexto

test('marcasContexto: claude + ok, claude + perdida, local + ok (caso 9, 8.2); y el pie del campo', () => {
  assert.deepEqual(marcasContexto({ motor: 'claude', carpeta: 'ok' }), [{ tipo: 'si', texto: 'Instrucciones' }, { tipo: 'si', texto: 'Carpeta, cuando hace falta' }])
  assert.deepEqual(marcasContexto({ motor: 'claude', carpeta: 'perdida' }), [{ tipo: 'si', texto: 'Instrucciones' }, { tipo: 'mal', texto: 'Carpeta perdida' }])
  assert.deepEqual(marcasContexto({ motor: 'local', carpeta: 'ok' }), [{ tipo: 'si', texto: 'Instrucciones' }, { tipo: 'no', texto: 'Carpeta: solo con Claude Code' }])
  assert.deepEqual(marcasContexto({ motor: 'local', carpeta: 'perdida' }), [{ tipo: 'si', texto: 'Instrucciones' }, { tipo: 'no', texto: 'Carpeta: solo con Claude Code' }])
  assert.equal(pieContexto({ motor: 'claude', carpeta: 'ok' }), 'instrucciones + carpeta')
  assert.equal(pieContexto({ motor: 'local', carpeta: 'ok' }), 'solo instrucciones')
  assert.equal(pieContexto({ motor: 'claude', carpeta: 'perdida' }), 'solo instrucciones')
})

test('textos de P2: borrar con una charla en singular, el borrado fallido, mensajes, «Ver las n charlas», el filtro y el chip', () => {
  assert.equal(lineaBorrar(1), 'Se van el proyecto y su charla. La carpeta y sus archivos quedan en tu PC. Esc cancela.')
  assert.equal(lineaBorrar(2), 'Se van el proyecto y sus 2 charlas. La carpeta y sus archivos quedan en tu PC. Esc cancela.')
  assert.equal(textoBorradoFallido(3), 'No se pudieron borrar 3 charlas. Probá de nuevo.')
  assert.equal(textoBorradoFallido(1), 'No se pudo borrar 1 charla. Probá de nuevo.')
  assert.equal(textoMensajes(1), '1 mensaje')
  assert.equal(textoMensajes(12), '12 mensajes')
  assert.equal(verLasCharlas(7), 'Ver las 7 charlas')
  assert.equal(filtroCharlas('Presupuestos 2027', 1), 'Presupuestos 2027 · 1 charla')
  assert.equal(filtroCharlas('Presupuestos 2027', 7), 'Presupuestos 2027 · 7 charlas')
  assert.equal(nombreChipProyecto('Presupuestos 2027'), 'Proyecto Presupuestos 2027: ver el proyecto')
  assert.equal(AVISO_CARPETA_PERDIDA, 'No encuentro la carpeta del proyecto: sigo solo con las instrucciones.')
  assert.equal(AVISO_CARPETA_CAMBIO, 'La carpeta del proyecto cambió: Claude sigue sin lo que charlaron antes.')
  assert.equal(AVISO_PROYECTO_BORRADO, 'La charla se cerró porque borraste su proyecto.')
})

// ------------------------------------------------------------------ la charla del proyecto (8.1)

const conPreferencia = (extra = {}) => ({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo', modelo: 'sonnet', ...extra })

test('«Nueva charla» del proyecto: abre la hoja con una charla nueva del proyecto, el motor y el modelo de la preferencia, sin ruta (8.1, 11.2)', () => {
  const r = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX)
  const conv = r.chat.conversacion
  assert.equal(r.chat.abierta, true)
  assert.equal(conv.id, 'c-nueva')
  assert.equal(conv.proyecto, 'p-presu')
  assert.equal(conv.motor, 'claude')
  assert.equal(conv.modelo, 'sonnet')
  assert.equal(conv.carpeta, null, 'la carpeta la decide Rust')
  const abrir = r.efectos.find(e => e.tipo === 'abrir')
  assert.equal(abrir.proyecto, 'p-presu')
  assert.equal(abrir.carpeta, null)
  assert.ok(r.efectos.some(e => e.tipo === 'foco' && e.a === 'campo'))
  // La preferencia no cambia
  assert.equal(r.chat.carpeta, 'C:\\Desktop\\catalogo')
})

test('una charla sin proyecto se abre como antes: el efecto lleva proyecto null y la conversación no tiene la clave', () => {
  const r = transicionChat(conPreferencia(), { tipo: 'abrir' }, CTX)
  assert.equal(r.chat.conversacion.proyecto, undefined)
  assert.ok(!('proyecto' in r.efectos.find(e => e.tipo === 'abrir')))
  assert.equal(r.efectos.find(e => e.tipo === 'abrir').carpeta, 'C:\\Desktop\\catalogo')
})

test('«Charla nueva» dentro de una charla de proyecto crea otra del mismo proyecto (8.2)', () => {
  const c = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX).chat
  const r = transicionChat(c, { tipo: 'nueva' }, { ...CTX, id: 'c-otra' })
  assert.equal(r.chat.conversacion.id, 'c-otra')
  assert.equal(r.chat.conversacion.proyecto, 'p-presu')
  assert.equal(r.efectos.find(e => e.tipo === 'abrir').proyecto, 'p-presu')
})

test('«Charlar con» la mascota desde una charla de proyecto abre una sin proyecto (8.2)', () => {
  let c = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX).chat
  c = transicionChat(c, { tipo: 'cerrar' }, CTX).chat
  const r = transicionChat(c, { tipo: 'abrir' }, { ...CTX, id: 'c-libre' })
  assert.equal(r.chat.conversacion.id, 'c-libre')
  assert.equal(r.chat.conversacion.proyecto, undefined)
})

test('lo que devuelve chat_abrir: la carpeta del proyecto queda en la charla y, perdida, el aviso una vez (8.4)', () => {
  let c = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX).chat
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-nueva', resultado: { proceso: 'arrancando', sesion: 's', proyecto: INFO } }, CTX).chat
  assert.equal(c.conversacion.carpeta, RUTA)
  assert.deepEqual(c.conversacion.proyectoInfo, INFO)
  assert.deepEqual(c.conversacion.avisos ?? [], [])
  const perdida = { ...INFO, carpeta: { ...INFO.carpeta, estado: 'perdida' } }
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-nueva', resultado: { proceso: 'arrancando', sesion: 's', proyecto: perdida } }, CTX).chat
  assert.deepEqual(c.conversacion.avisos, [{ texto: AVISO_CARPETA_PERDIDA, desde: 0 }])
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-nueva', resultado: { proceso: 'arrancando', sesion: 's', proyecto: perdida } }, CTX).chat
  assert.equal(c.conversacion.avisos.length, 1, 'una sola vez')
  assert.match(hilo({ chat: c, especie: 'avi', ahoraMs: AHORA }), /<p class="nueva-en">No encuentro la carpeta del proyecto: sigo solo con las instrucciones\.<\/p>/)
})

test('la carpeta cambiada (8.4): si Claude Code no pudo retomar la sesión, el hilo lo dice; si la retoma (M-P3), nada', () => {
  const doc = { v: 1, id: 'c-vieja', titulo: 'Vieja', creada: '2026-11-24T12:00:00.000Z', actualizada: '2026-11-24T12:05:00.000Z', motor: 'claude', carpeta: 'D:\\Antes', sesionClaude: '0a1b2c3d-0000-4000-8000-000000000000', proyecto: 'p-presu', mensajes: [
    { rol: 'usuario', texto: 'Hola', cuando: '2026-11-24T12:00:00.000Z', estado: 'ok', adjuntos: [] },
    { rol: 'mascota', texto: 'Hola.', cuando: '2026-11-24T12:00:01.000Z', estado: 'ok', herramientas: [], ms: 9, avis: false }] }
  let c = transicionChat({ ...conPreferencia(), abierta: true, charlas: [charlaDeCabecera({ ...doc, mensajes: undefined })] }, { tipo: 'retomar', id: 'c-vieja', conversacion: doc }, CTX).chat
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-vieja', resultado: { proceso: 'listo', sesion: doc.sesionClaude, proyecto: INFO } }, CTX).chat
  assert.equal(c.conversacion.carpeta, RUTA)
  c = transicionChat(c, { tipo: 'enviar', texto: 'Sigo' }, CTX).chat
  const misma = transicionChat(c, { tipo: 'backend', payload: { conversacion: 'c-vieja', turno: c.turno, tipo: 'listo', sesion: doc.sesionClaude } }, CTX).chat
  assert.deepEqual(misma.conversacion.avisos ?? [], [])
  const otra = transicionChat(c, { tipo: 'backend', payload: { conversacion: 'c-vieja', turno: c.turno, tipo: 'listo', sesion: '9f8e7d6c-0000-4000-8000-000000000000' } }, CTX).chat
  assert.deepEqual(otra.conversacion.avisos, [{ texto: AVISO_CARPETA_CAMBIO, desde: 2 }])
})

test('retomar una charla del proyecto desde su ficha abre la hoja (4.5); del disco, primero se lee', () => {
  const cab = charlaDeCabecera({ id: 'c-disco', titulo: 'Del disco', motor: 'claude', carpeta: null, creada: '2026-11-24T12:00:00.000Z', actualizada: '2026-11-24T12:05:00.000Z', proyecto: 'p-presu', cuantos: 4 })
  const c = { ...conPreferencia(), charlas: [cab] }
  const r = transicionChat(c, { tipo: 'retomar', id: 'c-disco', abrir: true }, CTX)
  assert.deepEqual(r.efectos, [{ tipo: 'leer', id: 'c-disco', para: 'retomar', abrir: true }])
  assert.equal(r.chat.abierta, false)
  const doc = { v: 1, id: 'c-disco', titulo: 'Del disco', creada: '2026-11-24T12:00:00.000Z', actualizada: '2026-11-24T12:05:00.000Z', motor: 'claude', carpeta: RUTA, sesionClaude: null, proyecto: 'p-presu', mensajes: [] }
  const r2 = transicionChat(c, { tipo: 'retomar', id: 'c-disco', conversacion: doc, abrir: true }, CTX)
  assert.equal(r2.chat.abierta, true)
  assert.equal(r2.chat.conversacion.proyecto, 'p-presu')
  assert.equal(r2.efectos.find(e => e.tipo === 'abrir').proyecto, 'p-presu')
})

test('cambiar el motor de una charla de proyecto: sigue en el proyecto y la preferencia de carpeta no se toca (D8)', () => {
  let c = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX).chat
  const r = transicionChat(c, { tipo: 'motor', motor: 'local' }, CTX)
  assert.equal(r.chat.conversacion.proyecto, 'p-presu')
  assert.equal(r.chat.conversacion.motor, 'local')
  assert.equal(r.efectos.find(e => e.tipo === 'preferencias').carpeta, 'C:\\Desktop\\catalogo')
  // Con mensajes, la charla nueva también es del proyecto
  c = transicionChat(c, { tipo: 'enviar', texto: 'Hola' }, CTX).chat
  const r2 = transicionChat(c, { tipo: 'motor', motor: 'local' }, { ...CTX, id: 'c-local' })
  assert.equal(r2.chat.conversacion.id, 'c-local')
  assert.equal(r2.chat.conversacion.proyecto, 'p-presu')
  // El menú de carpetas no se abre en una charla de proyecto (D-p12)
  assert.equal(transicionChat(c, { tipo: 'menu' }, CTX).chat.menu, false)
})

test('borrar el proyecto con su charla abierta: una charla nueva sin proyecto, el borrador queda y el aviso (8.5)', () => {
  let c = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX).chat
  c = { ...c, borrador: 'a medio escribir', charlas: [charla('c-x', 'p-presu', 1), charla('c-y', null, 2)] }
  const r = transicionChat(c, { tipo: 'borrado-proyecto', proyecto: 'p-presu' }, { ...CTX, id: 'c-limpia' })
  assert.equal(r.chat.conversacion.id, 'c-limpia')
  assert.equal(r.chat.conversacion.proyecto, undefined)
  assert.equal(r.chat.borrador, 'a medio escribir')
  assert.deepEqual(r.chat.charlas.map(x => x.id), ['c-y'])
  assert.ok(r.efectos.some(e => e.tipo === 'anunciar' && e.texto === AVISO_PROYECTO_BORRADO))
  assert.ok(!('proyecto' in r.efectos.find(e => e.tipo === 'abrir')))
  // Otra charla abierta: solo se van las del proyecto de la lista
  const otra = transicionChat({ ...conPreferencia(), conversacion: { id: 'c-z', motor: 'claude', carpeta: null, mensajes: [], actualizada: 1 }, charlas: [charla('c-x', 'p-presu', 1)] }, { tipo: 'borrado-proyecto', proyecto: 'p-presu' }, CTX)
  assert.equal(otra.chat.conversacion.id, 'c-z')
  assert.deepEqual(otra.chat.charlas, [])
  assert.deepEqual(otra.efectos, [])
})

// ------------------------------------------------------------------ historial con proyecto (11.5)

test('aArchivo y deArchivo: el proyecto va y vuelve; sin proyecto, el archivo es el de antes (sin la clave)', () => {
  const conv = { id: 'c-a', titulo: 'T', motor: 'claude', carpeta: RUTA, modelo: null, sesionClaude: null, creada: AHORA, actualizada: AHORA, mensajes: [], proyecto: 'p-presu' }
  const doc = aArchivo(conv)
  assert.equal(doc.proyecto, 'p-presu')
  assert.equal(deArchivo(doc).proyecto, 'p-presu')
  const { proyecto: _, ...sin } = conv
  const docSin = aArchivo(sin)
  assert.ok(!('proyecto' in docSin))
  assert.ok(!('proyecto' in deArchivo(docSin)))
  // La vista del proyecto y los avisos no se guardan
  assert.ok(!('proyectoInfo' in aArchivo({ ...conv, proyectoInfo: INFO, avisos: [{ texto: 'x', desde: 0 }] })))
  assert.ok(!('avisos' in aArchivo({ ...conv, avisos: [{ texto: 'x', desde: 0 }] })))
})

test('charlaDeCabecera: el proyecto y cuántos mensajes (chat_historial); listaCharlas los conserva', () => {
  const cab = charlaDeCabecera({ id: 'c-a', titulo: 'T', motor: 'claude', carpeta: null, creada: '2026-11-24T12:00:00.000Z', actualizada: '2026-11-24T12:05:00.000Z', proyecto: 'p-presu', cuantos: 6 })
  assert.equal(cab.proyecto, 'p-presu')
  assert.equal(cab.cuantos, 6)
  assert.ok(!('proyecto' in charlaDeCabecera({ id: 'c-b', motor: 'claude' })))
  assert.equal(listaCharlas({ ...chatInicial(), charlas: [cab] })[0].proyecto, 'p-presu')
})

// ------------------------------------------------------------------ la hoja (8.2)

const vista = (conv, extra = {}) => ({ chat: { ...chatInicial(), abierta: true, conversacion: conv, ...extra }, especie: 'avi', nombre: 'Pancho', ahoraMs: AHORA, proyecto: INFO })
const convPro = (extra = {}) => ({ id: 'c-a', titulo: null, motor: 'claude', carpeta: RUTA, modelo: null, sesionClaude: null, creada: AHORA, actualizada: AHORA, mensajes: [], proyecto: 'p-presu', ...extra })

test('cabecera de una charla de proyecto: la carpeta abre el Explorador, sin el menú de carpetas (8.2, D-p12)', () => {
  const html = cabecera(vista(convPro()))
  assert.match(html, /class="carpeta pro" data-accion="ch-carpeta-pro" aria-label="Carpeta del proyecto: Presupuestos 2027" title="C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027">/)
  assert.doesNotMatch(html.slice(0, html.indexOf("</button>")), /aria-haspopup/)
  const local = cabecera(vista(convPro({ motor: 'local', carpeta: null })))
  assert.match(local, /class="carpeta pro tachada" data-accion="ch-carpeta-pro" aria-disabled="true" title="El modelo local no lee la carpeta"/)
  // Sin proyecto, la de siempre
  assert.match(cabecera({ ...vista(convPro({ proyecto: undefined })), proyecto: null }), /data-accion="ch-menu" aria-haspopup="menu"/)
})

test('las marcas de contexto (.ctx-p) y el pie del campo con el nombre de la mascota (8.2)', () => {
  const html = contextoProyecto(vista(convPro()))
  assert.match(html, /^<div class="ctx-p" role="group" aria-label="Qué usa Pancho en esta charla">/)
  assert.equal(sinEtiquetas(html), '✓Instrucciones✓Carpeta, cuando hace falta')
  assert.match(contextoProyecto(vista(convPro({ motor: 'local', carpeta: null }))), /<span class="ctx-i no"><i aria-hidden="true">—<\/i>Carpeta: solo con Claude Code<\/span>/)
  const perdida = { ...vista(convPro()), proyecto: { ...INFO, carpeta: { ...INFO.carpeta, estado: 'perdida' } } }
  assert.match(contextoProyecto(perdida), /<span class="ctx-i mal">Carpeta perdida<\/span>/)
  assert.equal(contextoProyecto({ ...vista(convPro({ proyecto: undefined })), proyecto: null }), '')
  assert.equal(composer(vista(convPro())).pie, 'instrucciones + carpeta')
  assert.equal(composer(vista(convPro({ motor: 'local', carpeta: null }))).pie, 'solo instrucciones')
  // Sin proyecto, el pie de siempre
  assert.equal(composer({ ...vista(convPro({ proyecto: undefined, carpeta: 'C:\\Desktop\\catalogo' })), proyecto: null }).pie, 'Claude Code · catalogo')
})

test('el chip del proyecto: su color, la inicial, el nombre y «proyecto», con su nombre accesible (8.2)', () => {
  const html = chipProyecto(INFO)
  assert.match(html, /^<button type="button" class="pj-chip" id="ch-proyecto" data-accion="ch-proyecto" data-id="p-presu" aria-label="Proyecto Presupuestos 2027: ver el proyecto" style="--c:var\(--ambar\)">/)
  assert.equal(sinEtiquetas(html), 'PPresupuestos 2027proyecto')
  assert.equal(chipProyecto(null), '')
  assert.match(chipProyecto({ ...INFO, nombre: '<b>' }), /&lt;b&gt;/)
})

test('el cajón: cada charla de un proyecto suma su punto y su nombre; filtrado, «{proyecto} · {n} charlas» y «Ver todas» (8.3)', () => {
  const c = { ...chatInicial(), abierta: true, cajon: true, conversacion: null, charlas: [charla('c-a', 'p-presu', AHORA - MIN), charla('c-b', null, AHORA - 2 * MIN), charla('c-c', 'p-borrado', AHORA - 3 * MIN)] }
  const m = { chat: c, ahoraMs: AHORA, listaProyectos: [INFO] }
  const html = listaHistorial(m)
  assert.match(html, /data-id="c-a">[^]*<i class="pt-pro" aria-hidden="true" style="--c:var\(--ambar\)"><\/i>Presupuestos 2027 · /)
  // Una charla cuyo proyecto no existe se muestra sin proyecto
  assert.doesNotMatch(html.slice(html.indexOf('data-id="c-c"')), /pt-pro/)
  const filtrado = { ...m, chat: { ...c, filtroProyecto: 'p-presu' } }
  assert.deepEqual([...listaHistorial(filtrado).matchAll(/data-id="(c-[a-z])"/g)].map(x => x[1]), ['c-a'])
  const caj = cajon(filtrado)
  assert.match(caj, /<div class="filtro-pro" style="--c:var\(--ambar\)"><span>Presupuestos 2027 · 1 charla<\/span><button type="button" class="lnk" data-accion="ch-filtro-todas">Ver todas<\/button><\/div>/)
  assert.doesNotMatch(cajon(m), /filtro-pro/)
})

test('«Ver las n charlas» abre el cajón filtrado por el proyecto; cerrar el cajón o «Ver todas» quitan el filtro (4.5, 8.3)', () => {
  const r = transicionChat(conPreferencia(), { tipo: 'hist-proyecto', proyecto: 'p-presu' }, CTX)
  assert.equal(r.chat.abierta, true)
  assert.equal(r.chat.cajon, true)
  assert.equal(r.chat.filtroProyecto, 'p-presu')
  assert.ok(r.efectos.some(e => e.tipo === 'historial'))
  assert.equal(transicionChat(r.chat, { tipo: 'filtro-todas' }, CTX).chat.filtroProyecto, null)
  assert.equal(transicionChat(r.chat, { tipo: 'hist' }, CTX).chat.filtroProyecto, null)
})

// ------------------------------------------------------------------ la ficha con sus charlas (4.4, 4.5)

const PRESU = { v: 1, id: 'p-presu', nombre: 'Presupuestos 2027', color: 'ambar', orden: 0, creado: 1, instrucciones: 'Pesos.', carpeta: { nombre: 'Presupuestos 2027', ruta: RUTA, tipo: 'avis', estado: 'ok', archivos: 3 } }

test('la ficha con charlas: «Nueva charla» prendido, las 5 más recientes con sus mensajes y su fecha, la abierta marcada y «Ver las n charlas» (4.4, 4.5)', () => {
  const charlas = Array.from({ length: 7 }, (_, k) => charla(`c-${k}`, 'p-presu', AHORA - k * 60 * MIN, { titulo: `Charla ${k}`, cuantos: k + 1 }))
  const html = fichaProyecto({ p: PRESU, n: 7, charlas, actual: 'c-1', ahoraMs: AHORA })
  assert.match(html, /<button type="button" class="cta" data-accion="pro-charla" data-k="cta">/)
  assert.doesNotMatch(html, /aria-disabled/)
  assert.match(sinEtiquetas(html), /Nueva charla/)
  assert.doesNotMatch(html, /class="vacio-ch"/)
  const filas = [...html.matchAll(/<button type="button" class="chf"[^>]*data-id="(c-\d)"/g)].map(x => x[1])
  assert.deepEqual(filas, ['c-0', 'c-1', 'c-2', 'c-3', 'c-4'])
  assert.match(html, /class="chf" data-accion="pro-retomar" data-id="c-1" data-k="ch-c-1" aria-current="true"><b>Charla 1<\/b><small>[^<]+<\/small><span>2 mensajes<\/span><\/button>/)
  assert.match(html, /<button type="button" class="lnk" data-accion="pro-ver-charlas" data-k="ver-charlas">Ver las 7 charlas<\/button>/)
  assert.match(html, /<h3 class="rot">Charlas<\/h3>/)
  // Con 5 o menos, sin «Ver las…»; sin charlas, el recuadro de 7.3 y «Empezar la primera charla»
  assert.doesNotMatch(fichaProyecto({ p: PRESU, n: 2, charlas: charlas.slice(0, 2), ahoraMs: AHORA }), /pro-ver-charlas/)
  const vacia = fichaProyecto({ p: PRESU, n: 0, charlas: [], ahoraMs: AHORA })
  assert.match(vacia, /class="vacio-ch"/)
  assert.match(sinEtiquetas(vacia), /Empezar la primera charla/)
})

test('la ficha: borrar armado con una charla dice «su charla» (5.1, decisión de P2)', () => {
  const html = fichaProyecto({ p: PRESU, n: 1, charlas: [charla('c-a', 'p-presu', AHORA)], armado: true, transcurrido: 0, ahoraMs: AHORA })
  assert.match(html, /¿Borrar con 1 charla\? Sí/)
  assert.match(html, /<small>Se van el proyecto y su charla\. La carpeta y sus archivos quedan en tu PC\. Esc cancela\.<\/small>/)
})

test('la ficha con el borrado fallido: el texto de 5.2 y «Reintentar» debajo de «Borrar proyecto»', () => {
  const html = fichaProyecto({ p: PRESU, n: 3, charlas: [], errorBorrar: 'No se pudieron borrar 2 charlas. Probá de nuevo.', ahoraMs: AHORA })
  assert.match(html, /<div class="borrar-z">.*<p class="pro-err" role="alert"><span>No se pudieron borrar 2 charlas\. Probá de nuevo\.<\/span><button type="button" class="lnk" data-accion="pro-borrar-reintentar" data-k="borrar-reintentar">Reintentar<\/button><\/p><\/div>/s)
})

// ------------------------------------------------------------------ corrección de P2 (L10: A1 y A2)

test('A1: al retomar una charla del proyecto la ventana no manda su carpeta (11.2); solo el id', () => {
  const doc = { v: 1, id: 'c-vieja', titulo: 'Vieja', creada: '2026-11-24T12:00:00.000Z', actualizada: '2026-11-24T12:05:00.000Z', motor: 'claude', carpeta: RUTA, sesionClaude: null, proyecto: 'p-presu', mensajes: [] }
  const r = transicionChat({ ...conPreferencia(), abierta: true, charlas: [charlaDeCabecera(doc)] }, { tipo: 'retomar', id: 'c-vieja', conversacion: doc }, CTX)
  const abrir = r.efectos.find(e => e.tipo === 'abrir')
  assert.equal(abrir.proyecto, 'p-presu')
  assert.equal(abrir.carpeta, null)
  // Sin proyecto, la carpeta viaja como antes
  const sin = transicionChat({ ...conPreferencia(), abierta: true, charlas: [charlaDeCabecera({ ...doc, proyecto: undefined })] }, { tipo: 'retomar', id: 'c-vieja', conversacion: { ...doc, proyecto: undefined } }, CTX)
  assert.equal(sin.efectos.find(e => e.tipo === 'abrir').carpeta, RUTA)
})

test('A2: si Rust abre la charla sin su proyecto (borrado o roto), se ve y se usa sin proyecto (8.3)', () => {
  let c = transicionChat(conPreferencia(), { tipo: 'proyecto-nueva', proyecto: 'p-presu' }, CTX).chat
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-nueva', resultado: { proceso: 'arrancando', sesion: 's' } }, CTX).chat
  assert.equal(c.conversacion.sinProyecto, true)
  assert.equal(c.conversacion.proyecto, 'p-presu', 'el archivo guarda el vínculo por si el proyecto vuelve')
  const m = { ...vista(c.conversacion), chat: c, proyecto: null }
  assert.match(cabecera(m), /data-accion="ch-menu" aria-haspopup="menu"/)
  assert.equal(contextoProyecto({ ...m, proyecto: INFO }), '')
  assert.doesNotMatch(composer(m).pie, /instrucciones/)
  // El menú de carpetas se abre y una charla nueva desde ahí no es del proyecto
  assert.equal(transicionChat(c, { tipo: 'menu' }, CTX).chat.menu, true)
  assert.equal(transicionChat(c, { tipo: 'nueva' }, { ...CTX, id: 'c-x' }).chat.conversacion.proyecto, undefined)
  // Si Rust lo vuelve a encontrar, vuelve a ser del proyecto
  c = transicionChat(c, { tipo: 'abierta', conversacion: 'c-nueva', resultado: { proceso: 'listo', sesion: 's', proyecto: INFO } }, CTX).chat
  assert.ok(!c.conversacion.sinProyecto)
})

test('A2: la ventana no pide el proyecto de una charla con mensajes que no está en su lista (borrado o roto)', () => {
  const lista = [{ id: 'p-presu' }]
  assert.equal(proyectoParaAbrir('p-presu', { lista, leido: true }, true), 'p-presu')
  assert.equal(proyectoParaAbrir('p-borrado', { lista, leido: true }, true), null)
  // Una charla nueva o la lista sin leer: el id va igual (Rust decide)
  assert.equal(proyectoParaAbrir('p-borrado', { lista, leido: true }, false), 'p-borrado')
  assert.equal(proyectoParaAbrir('p-borrado', { lista: [], leido: false }, true), 'p-borrado')
  assert.equal(proyectoParaAbrir(null, { lista, leido: true }, true), null)
})
