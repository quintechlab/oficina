// Tests de los adjuntos de la charla (docs/diseno/chat-avis-ux.md 10, entrega 5): soltar sobre la
// hoja, el clip, los chips y el error `adjunto`. Funciones puras de chat.js y chatVista.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  chatInicial, transicionChat, sobreHoja, nombreArchivo, tamanoArchivo, detalleAdjunto, MAX_ADJUNTOS, TOPE_ADJUNTO, PISTA_CHIP, pistaChip,
} from '../src/chat.js'
import { hilo, composer, capaSoltar, clipAdjuntar } from '../src/chatVista.js'

const AHORA = new Date(2026, 10, 24, 15, 30).getTime()
const MB = 1024 * 1024
let n = 0
const CTX = { ahoraMs: AHORA, get id() { return `c-${++n}` }, mascota: 'Ascua', datos: null }

function abierta(extra = {}) {
  return transicionChat({ ...chatInicial(), carpeta: 'C:\\Desktop\\catalogo', ...extra }, { tipo: 'abrir' }, CTX).chat
}
const local = () => transicionChat(abierta(), { tipo: 'motor', motor: 'local' }, CTX).chat
const PDF = { nombre: 'presupuesto-2027.pdf', tipo: 'pdf', bytes: 1468006, paginas: 14 }
const RUTA = 'C:\\Users\\x\\Descargas\\presupuesto-2027.pdf'
/** El resultado de `chat_adjunto` para una ruta. */
const adjunto = (c, ruta = RUTA, resultado = PDF, extra = {}) => transicionChat(c, { tipo: 'adjunto', ruta, resultado, ...extra }, CTX)
const MODELO = chat => ({ chat, especie: 'ascua', ahoraMs: AHORA, puedeAdjuntar: true })

// ------------------------------------------------------------------ dónde se suelta (10, D26)

test('sobreHoja: la posición del arrastre (px físicos) contra la hoja (px CSS de la ventana, con zoom)', () => {
  const hoja = { x: 704, y: 200, ancho: 420, alto: 640 }
  // 100 % y pantalla al 150 %: el borde de arriba a la izquierda entra, el de afuera no
  assert.equal(sobreHoja({ x: 704 * 1.5, y: 200 * 1.5 }, 1.5, hoja, 1), true)
  assert.equal(sobreHoja({ x: 703 * 1.5, y: 300 * 1.5 }, 1.5, hoja, 1), false)
  assert.equal(sobreHoja({ x: (704 + 420) * 1.5, y: 300 * 1.5 }, 1.5, hoja, 1), false)
  // Al 200 % de zoom, la hoja mide el doble en la ventana
  assert.equal(sobreHoja({ x: 704 * 2 + 830, y: 400 + 1270 }, 1, hoja, 2), true)
  assert.equal(sobreHoja({ x: 704 * 2 + 841, y: 400 }, 1, hoja, 2), false)
  // Sin hoja (cerrada o plegada) o sin posición, nunca
  assert.equal(sobreHoja({ x: 800, y: 300 }, 1, null, 1), false)
  assert.equal(sobreHoja(null, 1, hoja, 1), false)
})

test('soltar fuera de la hoja no hace nada; sobre la hoja, la capa con el nombre (D26)', () => {
  const c = abierta()
  const encima = transicionChat(c, { tipo: 'soltando', nombre: 'presupuesto-2027.pdf' }, CTX)
  assert.deepEqual(encima.chat.soltando, { nombre: 'presupuesto-2027.pdf' })
  assert.match(capaSoltar(MODELO(encima.chat)), /Soltalo y Ascua lo lee/)
  assert.match(capaSoltar(MODELO(encima.chat)), /presupuesto-2027\.pdf · PDF, imágenes, texto o código/)
  // Soltar revisa las rutas en Rust (`chat_adjunto`) y saca la capa
  const r = transicionChat(encima.chat, { tipo: 'soltado', rutas: [RUTA, 'C:\\a.md'] }, CTX)
  assert.equal(r.chat.soltando, null)
  assert.deepEqual(r.efectos, [{ tipo: 'revisar-adjuntos', rutas: [RUTA, 'C:\\a.md'], desdeCapa: true }])
  // Con la hoja cerrada, nada
  const cerrada = transicionChat(c, { tipo: 'cerrar' }, CTX).chat
  assert.deepEqual(transicionChat(cerrada, { tipo: 'soltado', rutas: [RUTA] }, CTX).efectos, [])
  // Salir de la hoja sin soltar saca la capa
  assert.equal(transicionChat(encima.chat, { tipo: 'soltando', nombre: null }, CTX).chat.soltando, null)
})

test('con el motor local, soltar muestra su aviso y no adjunta nada', () => {
  const c = transicionChat(local(), { tipo: 'soltando', nombre: 'a.pdf' }, CTX).chat
  const capa = capaSoltar(MODELO(c))
  assert.match(capa, /El modelo local no lee archivos/)
  assert.match(capa, /Cambiá a Claude Code/)
  const r = transicionChat(c, { tipo: 'soltado', rutas: [RUTA] }, CTX)
  assert.equal(r.chat.soltando, null)
  assert.deepEqual(r.efectos, [])
  assert.deepEqual(r.chat.adjuntos, [])
  // Y un resultado que llega igual (cambió de motor en el medio) no entra
  assert.deepEqual(adjunto(c).chat.adjuntos, [])
})

// ------------------------------------------------------------------ el clip (10, D10)

test('el clip y "Resumime un PDF" abren el selector de archivos; con el motor local, el clip se apaga', () => {
  const c = abierta()
  assert.deepEqual(transicionChat(c, { tipo: 'adjuntar' }, CTX).efectos, [{ tipo: 'elegir-adjuntos' }])
  assert.deepEqual(transicionChat(local(), { tipo: 'adjuntar' }, CTX).efectos, [])
  assert.deepEqual(clipAdjuntar(MODELO(c)), { deshabilitado: false, titulo: 'Adjuntar archivo' })
  assert.deepEqual(clipAdjuntar(MODELO(local())), { deshabilitado: true, titulo: 'El modelo local no lee archivos' })
  // La sugerencia se ve con Claude Code
  assert.match(hilo(MODELO(c)), /Resumime un PDF/)
  // Lo elegido se revisa igual que lo soltado, sin la capa
  assert.deepEqual(transicionChat(c, { tipo: 'elegidos', rutas: [RUTA] }, CTX).efectos, [{ tipo: 'revisar-adjuntos', rutas: [RUTA], desdeCapa: false }])
  assert.deepEqual(transicionChat(c, { tipo: 'elegidos', rutas: [] }, CTX).efectos, [])
})

// ------------------------------------------------------------------ el chip (4.1) y el error (4.2)

test('un adjunto que entra es un chip con su nombre, páginas y tamaño; se anuncia', () => {
  const r = adjunto(abierta(), RUTA, PDF, { desdeCapa: true })
  assert.deepEqual(r.chat.adjuntos, [{ ruta: RUTA, ...PDF }])
  assert.deepEqual(r.efectos, [{ tipo: 'anunciar', texto: 'Adjuntaste presupuesto-2027.pdf', adjunto: 'presupuesto-2027.pdf' }, { tipo: 'chip', ruta: RUTA, desdeCapa: true }])
  const chips = composer(MODELO(r.chat)).adjuntos
  assert.match(chips, /presupuesto-2027\.pdf/)
  assert.match(chips, /14 páginas · 1,4 MB/)
  assert.match(chips, />PDF</)
  assert.match(chips, /aria-label="Quitar presupuesto-2027\.pdf"/)
  // Con un adjunto, Enviar se prende aunque no haya texto
  assert.ok(!/disabled/.test(composer(MODELO(r.chat)).boton))
  // La misma ruta dos veces no se repite
  assert.equal(adjunto(r.chat).chat.adjuntos.length, 1)
})

test('quitar un chip lo saca y el foco vuelve al campo', () => {
  const c = adjunto(adjunto(abierta()).chat, 'C:\\a.md', { nombre: 'a.md', tipo: 'texto', bytes: 300, paginas: null }).chat
  const r = transicionChat(c, { tipo: 'quitar', ruta: RUTA }, CTX)
  assert.deepEqual(r.chat.adjuntos.map(a => a.nombre), ['a.md'])
  assert.deepEqual(r.efectos, [{ tipo: 'foco', a: 'campo' }])
})

test('el .xlsx y el de más de 20 MB son el error adjunto, que solo se cierra; lo escrito queda', () => {
  const c = { ...abierta(), borrador: 'Mirá esto' }
  const xlsx = adjunto(c, 'C:\\planilla.xlsx', { error: 'adjunto', nombre: 'planilla.xlsx' }).chat
  assert.deepEqual(xlsx.errorAdjunto, { nombre: 'planilla.xlsx' })
  assert.deepEqual(xlsx.adjuntos, [])
  assert.equal(xlsx.borrador, 'Mirá esto')
  assert.equal(xlsx.estado, 'vacio', 'no es un error del turno')
  const h = hilo(MODELO(xlsx))
  assert.match(h, /role="alert"/)
  assert.match(h, /No puedo leer planilla\.xlsx/)
  assert.match(h, /Puedo leer PDF, imágenes, texto y código, de hasta 20 MB\./)
  assert.match(h, /data-accion="ch-descartar-adjunto"/)
  // Rust ya lo revisó, pero la ventana vuelve a mirar: uno de 20 MB + 1 tampoco entra
  const grande = adjunto(c, RUTA, { ...PDF, bytes: TOPE_ADJUNTO + 1 }).chat
  assert.deepEqual(grande.errorAdjunto, { nombre: 'presupuesto-2027.pdf' })
  // Cerrar la tarjeta
  assert.equal(transicionChat(xlsx, { tipo: 'descartar-adjunto' }, CTX).chat.errorAdjunto, null)
  // Un adjunto que entra después también la saca
  assert.equal(adjunto(xlsx).chat.errorAdjunto, null)
})

test('un sexto archivo no entra', () => {
  let c = abierta()
  for (let k = 0; k < MAX_ADJUNTOS; k++) c = adjunto(c, `C:\\${k}.pdf`, { ...PDF, nombre: `${k}.pdf` }).chat
  assert.equal(c.adjuntos.length, 5)
  const sexto = adjunto(c, 'C:\\6.pdf', { ...PDF, nombre: '6.pdf' }).chat
  assert.equal(sexto.adjuntos.length, 5)
  assert.deepEqual(sexto.errorAdjunto, { nombre: '6.pdf' })
})

test('mandar lleva las rutas a Rust y el mensaje guarda solo nombre y tamaño; mientras responde se puede adjuntar', () => {
  const c = adjunto(abierta(), RUTA, PDF).chat
  const r = transicionChat({ ...c, borrador: '' }, { tipo: 'enviar', texto: '', campo: true }, CTX)
  assert.equal(r.chat.estado, 'esperando')
  assert.deepEqual(r.efectos[0], { tipo: 'enviar', conversacion: c.conversacion.id, turno: 1, texto: '', adjuntos: [RUTA] })
  assert.deepEqual(r.chat.adjuntos, [])
  assert.equal(r.chat.conversacion.titulo, 'Charla sobre presupuesto-2027.pdf')
  const u = r.chat.conversacion.mensajes[0]
  assert.deepEqual(u.adjuntos, [PDF])
  assert.match(hilo(MODELO(r.chat)), /presupuesto-2027\.pdf/)
  // Con el turno en curso, el clip y soltar siguen andando (D7 solo frena el envío)
  assert.equal(adjunto(r.chat, 'C:\\b.md', { nombre: 'b.md', tipo: 'texto', bytes: 9, paginas: null }).chat.adjuntos.length, 1)
  // Un error adjunto de Rust al mandar (el archivo cambió) es del turno: "No se envió" y el chip vuelve
  const e = transicionChat(r.chat, { tipo: 'backend', payload: { conversacion: c.conversacion.id, turno: 1, tipo: 'error', motivo: 'adjunto', detalle: 'presupuesto-2027.pdf' } }, CTX).chat
  assert.equal(e.estado, 'error')
  assert.deepEqual(e.adjuntos.map(a => a.ruta), [RUTA])
  assert.match(hilo(MODELO(e)), /No puedo leer presupuesto-2027\.pdf/)
})

// ------------------------------------------------------------------ el chip nace de la capa (6.2)

test('pistaChip: el chip arranca en el centro de la capa, a 0,6, y llega en 420 ms con rebote', () => {
  assert.deepEqual(PISTA_CHIP, { dura: 420, escala: 0.6, capa: 300 })
  // La capa centrada en (900, 400); el chip, de 180 × 44 en (720, 760): su centro está en (810, 782)
  const chip = { left: 720, top: 760, width: 180, height: 44 }
  assert.deepEqual(pistaChip({ x: 900, y: 400 }, chip, 1), { dx: 90, dy: -382 })
  // Al 200 %, un px CSS del chip son dos de la ventana: la mitad de corrimiento
  assert.deepEqual(pistaChip({ x: 900, y: 400 }, chip, 0.5), { dx: 45, dy: -191 })
})

// ------------------------------------------------------------------ cifras del chip

test('tamanoArchivo, detalleAdjunto y nombreArchivo', () => {
  assert.equal(tamanoArchivo(512), '512 B')
  assert.equal(tamanoArchivo(12 * 1024 + 300), '12 KB')
  assert.equal(tamanoArchivo(1468006), '1,4 MB')
  assert.equal(tamanoArchivo(20 * MB), '20 MB')
  assert.equal(detalleAdjunto(PDF), '14 páginas · 1,4 MB')
  assert.equal(detalleAdjunto({ ...PDF, paginas: 1 }), '1 página · 1,4 MB')
  assert.equal(detalleAdjunto({ ...PDF, paginas: null }), '1,4 MB')
  assert.equal(detalleAdjunto({ tipo: 'imagen', bytes: 2048 }), '2 KB')
  assert.equal(nombreArchivo('C:\\Users\\x\\Descargas\\a b.pdf'), 'a b.pdf')
  assert.equal(nombreArchivo('/home/x/notas.md'), 'notas.md')
  assert.equal(nombreArchivo('notas.md'), 'notas.md')
})

test('sin zoom (#47): soltar sobre la hoja sin escala es lo mismo que al 100 %', () => {
  const hoja = { x: 704, y: 200, ancho: 420, alto: 640 }
  for (const dpr of [1, 1.25, 1.5, 2]) {
    for (const [x, y] of [[704, 200], [703, 300], [1123, 839], [1124, 300], [900, 840]]) {
      const p = { x: x * dpr, y: y * dpr }
      assert.equal(sobreHoja(p, dpr, hoja), sobreHoja(p, dpr, hoja, 1), `${x},${y} a ${dpr}`)
    }
  }
})
