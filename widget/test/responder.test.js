// Tests de la lógica pura del globo que responde: solo lo que el usuario toca se envía.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  puedeResponder, armarRespuesta, cuerpoRespuesta, siguienteSinResponder, textoRespondido, estadoEnvio, MS_CONFIRMACION,
} from '../src/responder.js'

const UNA = { pregunta: '¿Qué boceto?', encabezado: 'Boceto', multiple: false, opciones: [{ etiqueta: 'Terrario (Recomendada)', descripcion: '' }, { etiqueta: 'Vitrina', descripcion: '' }] }
const VARIAS = { pregunta: '¿Qué incluyo?', encabezado: 'Alcance', multiple: true, opciones: [{ etiqueta: 'Tests', descripcion: '' }, { etiqueta: 'Docs', descripcion: '' }, { etiqueta: 'CI', descripcion: '' }] }
const PREGUNTA = { id: 'toolu_1', agente: null, desde: '2026-11-19T23:49:00Z', items: [UNA, VARIAS] }

test('solo se responde a una sesión que lo soporta', () => {
  assert.equal(puedeResponder({ puedeResponder: true }), true)
  assert.equal(puedeResponder({}), false)
  assert.equal(puedeResponder({ puedeResponder: 'si' }), false)
})

test('una opción elegida: la etiqueta original, con su marca de recomendada', () => {
  assert.deepEqual(armarRespuesta(UNA, { opcion: 0 }), { valor: 'Terrario (Recomendada)', libre: false })
  assert.deepEqual(armarRespuesta(UNA, { opcion: 1 }), { valor: 'Vitrina', libre: false })
  assert.equal(armarRespuesta(UNA, { opcion: 2 }), null)
})

test('varias elegidas: en el orden de las opciones, separadas por coma', () => {
  assert.deepEqual(armarRespuesta(VARIAS, { opciones: [2, 0] }), { valor: 'Tests, CI', libre: false })
  assert.deepEqual(armarRespuesta(VARIAS, { opciones: [1, 1] }), { valor: 'Docs', libre: false })
  assert.equal(armarRespuesta(VARIAS, { opciones: [] }), null)
  assert.equal(armarRespuesta(UNA, { opciones: [0, 1] }), null, 'una pregunta de una sola opción no acepta varias')
})

test('otra respuesta: el texto escrito, marcado como libre', () => {
  assert.deepEqual(armarRespuesta(UNA, { texto: '  Uno mezclado ' }), { valor: 'Uno mezclado', libre: true })
  assert.equal(armarRespuesta(UNA, { texto: '   ' }), null)
})

test('sin un clic no hay respuesta: nada se elige por defecto, ni la recomendada', () => {
  assert.equal(armarRespuesta(UNA, undefined), null)
  assert.equal(armarRespuesta(UNA, {}), null)
  assert.equal(armarRespuesta(UNA, null), null)
  assert.equal(cuerpoRespuesta(PREGUNTA, {}), null)
})

test('la llamada se envía recién cuando todas sus preguntas tienen respuesta', () => {
  const borrador = { '¿Qué boceto?': { valor: 'Vitrina', libre: false } }
  assert.equal(cuerpoRespuesta(PREGUNTA, borrador), null)
  assert.equal(siguienteSinResponder(PREGUNTA, borrador), 1)
  const completo = { ...borrador, '¿Qué incluyo?': { valor: 'Mis propias pruebas', libre: true } }
  assert.equal(siguienteSinResponder(PREGUNTA, completo), -1)
  assert.deepEqual(cuerpoRespuesta(PREGUNTA, completo), {
    answers: { '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'Mis propias pruebas' },
    libres: ['¿Qué incluyo?'],
  })
  assert.equal(textoRespondido(PREGUNTA, completo), '«Vitrina» · «Mis propias pruebas»')
})

test('después de enviar: listo si la sesión la tomó; si no, se responde en Claude', () => {
  assert.equal(estadoEnvio({ archivo: 'consumida', sigue: false, ms: 800 }), 'listo')
  assert.equal(estadoEnvio({ archivo: 'consumida', sigue: true, ms: 800 }), 'listo')
  assert.equal(estadoEnvio({ archivo: 'pendiente', sigue: true, ms: 1000 }), 'esperando')
  assert.equal(estadoEnvio({ archivo: 'pendiente', sigue: true, ms: MS_CONFIRMACION }), 'enClaude')
  // El diálogo de Claude respondió antes de que la sesión leyera el archivo
  assert.equal(estadoEnvio({ archivo: 'pendiente', sigue: false, ms: 1000 }), 'yaRespondida')
  assert.equal(estadoEnvio({ archivo: 'ausente', sigue: true, ms: MS_CONFIRMACION }), 'enClaude')
})

test('en la ventana, la respuesta sale solo de un clic: un único envío, llamado desde el manejador de clics', async () => {
  const { readFile } = await import('node:fs/promises')
  const fuente = await readFile(new URL('../src/main.js', import.meta.url), 'utf8')
  // Un solo lugar escribe la respuesta, dentro de elegir()
  const envios = [...fuente.matchAll(/invocar\('responder'/g)]
  assert.equal(envios.length, 1)
  const defElegir = fuente.indexOf('async function elegir(')
  const finElegir = fuente.indexOf('\n}\n', defElegir)
  assert.ok(envios[0].index > defElegir && envios[0].index < finElegir, 'responder se invoca dentro de elegir()')
  // elegir() se llama solo desde el manejador de clics (las teclas 1–9 hacen clic en el botón)
  const inicioClics = fuente.indexOf("document.addEventListener('click'")
  const finClics = fuente.indexOf('\n})\n', inicioClics)
  const llamadas = [...fuente.matchAll(/\belegir\(/g)].map(m => m.index).filter(i => i !== defElegir + 'async function '.length)
  assert.ok(llamadas.length >= 3)
  for (const i of llamadas) assert.ok(i > inicioClics && i < finClics, `elegir() fuera del manejador de clics en ${i}`)
  // El destino de elegir() lo da el botón tocado (objetivo(b)), no la pestaña activa
  const cuerpoElegir = fuente.slice(defElegir, finElegir)
  assert.ok(!/preguntaActiva|st\.activa\]/.test(cuerpoElegir), 'elegir() no toma la pregunta de la pestaña activa')
  assert.ok(!fuente.includes('preguntaActiva('), 'nadie arma el destino desde la pestaña activa')
  for (const i of llamadas) assert.match(fuente.slice(i, i + 40), /^elegir\((q|objetivo\(b\)),/)
  // Ningún temporizador responde
  for (const m of fuente.matchAll(/set(Timeout|Interval)\(([\s\S]*?)\)\n/g)) assert.ok(!/elegir|responder/.test(m[2]))
})

// ---- correcciones de la verificación: el clic responde solo lo que se mostró
import { objetivoDelClic, registrarEleccion, MS_PAUSA_AVANCE } from '../src/responder.js'

const pend = (id, indice, extra = {}) => ({ pregunta: { id, items: [UNA, VARIAS] }, indice, item: [UNA, VARIAS][indice], responde: true, ...extra })

test('el clic responde la pregunta que tenía el botón, aunque la lista cambie mientras tanto', () => {
  const b = pend('toolu_B', 0)
  const boton = { pregunta: 'toolu_B', item: 0 }
  const mostrado = { pregunta: 'toolu_B', item: 0 }
  // Llega la pregunta de otra sesión y queda primera: el clic sigue apuntando a B
  assert.equal(objetivoDelClic([pend('toolu_A', 0), b], boton, mostrado), b)
  // La pregunta mostrada ya no está pendiente: el clic no hace nada
  assert.equal(objetivoDelClic([pend('toolu_A', 0)], boton, mostrado), null)
  // El botón no es del globo que se ve, o es de otro ítem: nada
  assert.equal(objetivoDelClic([b], boton, { pregunta: 'toolu_A', item: 0 }), null)
  assert.equal(objetivoDelClic([b], { pregunta: 'toolu_B', item: 1 }, mostrado), null)
  assert.equal(objetivoDelClic([b], boton, null), null)
  // Una sesión que no acepta respuestas tampoco
  assert.equal(objetivoDelClic([pend('toolu_B', 0, { responde: false })], boton, mostrado), null)
})

test('registrar una elección: avanza, envía al completar, y nunca envía dos veces', () => {
  const q0 = pend('toolu_1', 0), q1 = pend('toolu_1', 1)
  let estado = { borradores: {}, envios: {}, bloqueoHasta: 0 }
  const r1 = registrarEleccion(estado, q0, { opcion: 1 }, 1000)
  assert.equal(r1.accion, 'avanzar')
  assert.equal(r1.falta, 1)
  estado = r1.estado
  const r2 = registrarEleccion(estado, q1, { opciones: [0] }, 1000 + MS_PAUSA_AVANCE)
  assert.equal(r2.accion, 'enviar')
  assert.deepEqual(r2.cuerpo, { answers: { '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'Tests' }, libres: [] })
  const enviado = { ...r2.estado, envios: { toolu_1: { estado: 'enviando' } } }
  assert.equal(registrarEleccion(enviado, q1, { opciones: [1] }, 9999).accion, 'nada')
  assert.equal(registrarEleccion(estado, q1, undefined, 9999).accion, 'nada')
})

test('doble clic en una llamada de varias preguntas: el segundo clic no responde la siguiente', () => {
  const q0 = pend('toolu_1', 0), q1 = pend('toolu_1', 1)
  const r1 = registrarEleccion({ borradores: {}, envios: {}, bloqueoHasta: 0 }, q0, { opcion: 0 }, 5000)
  assert.equal(r1.accion, 'avanzar')
  const r2 = registrarEleccion(r1.estado, q1, { opciones: [2] }, 5000 + MS_PAUSA_AVANCE - 1)
  assert.equal(r2.accion, 'nada')
  assert.deepEqual(r2.estado, r1.estado)
})

test('doble clic: el segundo clic tampoco marca una opción de la pregunta siguiente', async () => {
  const { alternarSeleccion } = await import('../src/responder.js')
  const base = new Set()
  assert.equal(alternarSeleccion(base, 1, 1000, 1000 + MS_PAUSA_AVANCE), base, 'dentro de la pausa no cambia')
  assert.deepEqual([...alternarSeleccion(base, 1, 2000, 1300)], [1])
  assert.deepEqual([...alternarSeleccion(new Set([1, 2]), 1, 2000, 0)], [2])
})

// ---- diagnóstico: por qué se rechaza un clic, y qué se escribe en widget.log
import { motivoRechazo, lineaClic } from '../src/responder.js'

test('motivo de rechazo de un clic', () => {
  const b = pend('toolu_B', 0)
  const boton = { pregunta: 'toolu_B', item: 0 }
  assert.equal(motivoRechazo([b], boton, { pregunta: 'toolu_B', item: 0 }), null)
  assert.equal(motivoRechazo([b], null, { pregunta: 'toolu_B', item: 0 }), 'boton-sin-pregunta')
  assert.equal(motivoRechazo([b], boton, null), 'globo-sin-pregunta')
  assert.equal(motivoRechazo([b], boton, { pregunta: 'toolu_A', item: 0 }), 'otro-globo')
  assert.equal(motivoRechazo([], boton, { pregunta: 'toolu_B', item: 0 }), 'ya-no-pendiente')
  assert.equal(motivoRechazo([pend('toolu_B', 0, { responde: false })], boton, { pregunta: 'toolu_B', item: 0 }), 'sesion-no-acepta')
})

test('registrar una elección dice por qué no hizo nada', () => {
  const q0 = pend('toolu_1', 0)
  assert.equal(registrarEleccion({ borradores: {}, envios: {}, bloqueoHasta: 2000 }, q0, { opcion: 0 }, 1000).motivo, 'pausa-tras-avanzar')
  assert.equal(registrarEleccion({ borradores: {}, envios: { toolu_1: {} }, bloqueoHasta: 0 }, q0, { opcion: 0 }, 1000).motivo, 'ya-enviada')
  assert.equal(registrarEleccion({ borradores: {}, envios: {}, bloqueoHasta: 0 }, q0, { opcion: 9 }, 1000).motivo, 'eleccion-invalida')
  assert.equal(registrarEleccion({ borradores: {}, envios: {}, bloqueoHasta: 0 }, null, { opcion: 0 }, 1000).motivo, 'sin-pregunta')
})

test('línea del log de un clic: pregunta, ítem, decisión y etiqueta; el texto libre no se escribe', () => {
  assert.equal(lineaClic({ pregunta: 'toolu_1', item: 0, decision: 'enviar', etiqueta: 'Vitrina' }), 'clic pregunta=toolu_1 item=0 -> enviar etiqueta="Vitrina"')
  assert.equal(lineaClic({ pregunta: 'toolu_1', item: 1, decision: 'rechazado', motivo: 'otro-globo' }), 'clic pregunta=toolu_1 item=1 -> rechazado (otro-globo)')
  assert.equal(lineaClic({ pregunta: 'toolu_1', item: 0, decision: 'avanzar', libre: true, etiqueta: 'mi secreto' }), 'clic pregunta=toolu_1 item=0 -> avanzar etiqueta=(texto libre)')
  assert.equal(lineaClic({ pregunta: null, item: NaN, decision: 'rechazado', motivo: 'boton-sin-pregunta' }), 'clic pregunta=? item=? -> rechazado (boton-sin-pregunta)')
})
