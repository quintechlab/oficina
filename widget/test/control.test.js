// Tests de la barra de control de cada tarjeta de sesión (#19): mandarle un mensaje a Claude y
// frenar el turno. Funciones puras de control.js; el DOM (foco, borrador y sondeo) vive en main.js.
// Regla de siempre: el widget nunca decide por el usuario. Solo un clic o un Enter envía o frena.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  puedeControlar, trabajando, MS_CONFIRMAR_FRENAR, clicFrenar, confirmando, MAX_TEXTO, validarTexto,
  teclaControl, lineaResultado, lineaError, textoCola, MS_SONDEO_ORDEN, MS_ESPERA_ORDEN, pasoOrden,
  MS_LINEA, vistaBarra, barraControl, borradorTrasOrden, lineaAlEscribir, puedeCerrar, clicCerrar, MS_CONFIRMAR_CERRAR,
} from '../src/control.js'
import { ANIMOS_DE_TRABAJO, animoSesion } from '../src/logica.js'
import { sesiones, prepararProyecto, firmaEscenas } from '../src/tablero.js'
import { agruparPorProyecto } from '../src/logica.js'

const AHORA = Date.parse('2026-11-22T15:00:00Z')
const hace = min => new Date(AHORA - min * 60000).toISOString()
const ses = extra => ({ sesion: 'ses-1', repo: 'q/oficina', rama: 'main', inicio: hace(30), actualizado: hace(0), puedeControlar: true, agentes: [], ...extra })

test('la barra solo aparece si la sesión publica puedeControlar: true', () => {
  assert.equal(puedeControlar(ses()), true)
  assert.equal(puedeControlar(ses({ puedeControlar: undefined })), false)
  assert.equal(puedeControlar(ses({ puedeControlar: 'true' })), false)
  assert.equal(barraControl(ses({ puedeControlar: false }), {}, AHORA), '')
  assert.equal(vistaBarra(ses({ puedeControlar: undefined }), {}, AHORA).visible, false)
  assert.match(barraControl(ses(), {}, AHORA), /class="ctl"/)
})

test('Frenar se ve solo con un turno del hilo principal en curso (enTurno) y la sesión trabajando', () => {
  const sub = { id: 'a1', nombre: 'Mateo', estado: 'trabajando', desde: hace(1), hasta: null }
  const casos = [
    [ses({ enTurno: true, actividad: 'editando main.js' }), true],
    [ses({ enTurno: true, actividad: 'corriendo npm test' }), true],
    [ses({ enTurno: true, actividad: 'pensando' }), true],
    // Coordinando subagentes con el turno todavía abierto: se puede frenar
    [ses({ enTurno: true, actividad: 'pensando', agentes: [sub] }), true],
    [ses({ enTurno: false, actividad: 'esperándote' }), false],
    [ses({ enTurno: true, actividad: 'pensando', actualizado: hace(60) }), false],
    // Subagentes o procesos en segundo plano con el turno ya terminado: no hay nada que frenar
    [ses({ enTurno: false, actividad: 'esperándote', agentes: [sub] }), false],
    [ses({ enTurno: false, actividad: 'esperándote', procesos: [{ id: 'p1', descripcion: 'npm run dev', desde: hace(2) }] }), false],
    // Sin el dato (no debería pasar con puedeControlar), no se ofrece
    [ses({ actividad: 'pensando' }), false],
  ]
  for (const [s, esperado] of casos) {
    assert.equal(trabajando(s, AHORA), esperado, JSON.stringify(s))
    assert.equal(vistaBarra(s, {}, AHORA).frenar.visible, esperado, s.actividad)
    if (esperado) assert.ok(ANIMOS_DE_TRABAJO.has(animoSesion(s, AHORA)))
  }
  assert.match(barraControl(ses({ enTurno: false, actividad: 'esperándote' }), {}, AHORA), /class="btn sec ctl-frenar"[^>]* hidden/)
  assert.doesNotMatch(barraControl(ses({ enTurno: true, actividad: 'pensando' }), {}, AHORA), /ctl-frenar"[^>]* hidden/)
})

test('Frenar confirma en el botón: el primer clic pide "¿Frenar? Sí" por 3 s y solo el segundo frena', () => {
  assert.equal(MS_CONFIRMAR_FRENAR, 3000)
  const s = ses({ actividad: 'pensando' })
  const primero = clicFrenar({}, AHORA)
  assert.deepEqual(primero, { confirmaHasta: AHORA + 3000, frenar: false })
  assert.equal(confirmando(primero, AHORA + 2999), true)
  assert.equal(vistaBarra(s, primero, AHORA + 1000).frenar.etiqueta, '¿Frenar? Sí')
  // El segundo clic dentro de la ventana frena y vuelve al estado de reposo
  assert.deepEqual(clicFrenar(primero, AHORA + 2500), { confirmaHasta: null, frenar: true })
})

test('sin segundo clic vuelve solo a "Frenar" y nunca frena por tiempo', () => {
  const s = ses({ actividad: 'pensando' })
  const primero = clicFrenar({}, AHORA)
  assert.equal(confirmando(primero, AHORA + 3000), false)
  assert.equal(vistaBarra(s, primero, AHORA + 3000).frenar.etiqueta, 'Frenar')
  assert.equal(vistaBarra(s, {}, AHORA).frenar.etiqueta, 'Frenar')
  // Un clic después de la ventana es otra vez el primero: pide confirmar, no frena
  assert.deepEqual(clicFrenar(primero, AHORA + 3001), { confirmaHasta: AHORA + 6001, frenar: false })
})

test('el texto se recorta y va de 1 a 10000 caracteres', () => {
  assert.equal(MAX_TEXTO, 10000)
  assert.deepEqual(validarTexto('  probá de nuevo \n'), { texto: 'probá de nuevo' })
  assert.ok(validarTexto('').error)
  assert.ok(validarTexto(' \n\t ').error)
  assert.ok(validarTexto(undefined).error)
  assert.deepEqual(validarTexto('a'.repeat(10000)), { texto: 'a'.repeat(10000) })
  assert.ok(validarTexto('a'.repeat(10001)).error)
  // Los espacios de los bordes no cuentan
  assert.deepEqual(validarTexto(` ${'a'.repeat(10000)} `), { texto: 'a'.repeat(10000) })
})

test('Enter envía, Shift+Enter hace línea nueva y nada envía mientras se compone con el IME', () => {
  assert.equal(teclaControl({ key: 'Enter' }), 'enviar')
  assert.equal(teclaControl({ key: 'Enter', shiftKey: true }), null)
  assert.equal(teclaControl({ key: 'Enter', isComposing: true }), null)
  assert.equal(teclaControl({ key: 'Enter', keyCode: 229 }), null)
  assert.equal(teclaControl({ key: 'a' }), null)
})

test('cada resultado del mod es una línea corta en castellano', () => {
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'enviado' }), { texto: 'Enviado', tono: 'ok' })
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'en-cola' }), { texto: 'Enviado · Claude lo lee al terminar el turno', tono: 'ok' })
  assert.deepEqual(lineaResultado({ tipo: 'frenar', resultado: 'frenado' }), { texto: 'Frenado', tono: 'ok' })
  assert.deepEqual(lineaResultado({ tipo: 'frenar', resultado: 'sin-turno' }), { texto: 'No estaba trabajando', tono: 'info' })
  assert.deepEqual(lineaResultado({ tipo: 'frenar', resultado: 'fallo', motivo: 'turno ajeno' }), { texto: 'No se pudo frenar · turno ajeno', tono: 'error' })
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'fallo' }), { texto: 'No se pudo enviar', tono: 'error' })
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'descartada', motivo: 'orden vieja' }), { texto: 'No se pudo enviar · orden vieja', tono: 'error' })
  assert.deepEqual(lineaResultado({ tipo: 'frenar', resultado: 'timeout' }), { texto: 'La sesión no respondió', tono: 'error' })
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'perdida' }), { texto: 'No se pudo confirmar', tono: 'error' })
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'otra-cosa' }), { texto: 'No se pudo enviar', tono: 'error' })
  assert.deepEqual(lineaError('mensaje', new Error('todavía hay una orden pendiente')), { texto: 'No se pudo enviar · todavía hay una orden pendiente', tono: 'error' })
  assert.deepEqual(lineaError('frenar', 'id de sesión inválido'), { texto: 'No se pudo frenar · id de sesión inválido', tono: 'error' })
})

test('"en cola" sale de enCola > 0 de la presencia', () => {
  assert.equal(textoCola(ses({ enCola: 1 })), 'en cola')
  assert.equal(textoCola(ses({ enCola: 3 })), '3 en cola')
  assert.equal(textoCola(ses({ enCola: 0 })), null)
  assert.equal(textoCola(ses()), null)
  assert.equal(vistaBarra(ses({ enCola: 1 }), {}, AHORA).cola, 'en cola')
  assert.match(barraControl(ses({ enCola: 1 }), {}, AHORA), /<span class="ctl-cola">en cola<\/span>/)
  assert.match(barraControl(ses(), {}, AHORA), /<span class="ctl-cola" hidden><\/span>/)
})

test('el sondeo de una orden: cada 500 ms hasta 10 s; consumida es listo, sin archivo es perdida', () => {
  assert.equal(MS_SONDEO_ORDEN, 500)
  assert.equal(MS_ESPERA_ORDEN, 10000)
  assert.equal(pasoOrden({ estado: 'pendiente' }, 9999), 'esperar')
  assert.equal(pasoOrden({ estado: 'pendiente' }, 10000), 'timeout')
  assert.equal(pasoOrden({ estado: 'consumida', resultado: 'enviado' }, 600), 'listo')
  assert.equal(pasoOrden({ estado: 'ausente' }, 600), 'perdida')
  assert.equal(pasoOrden(undefined, 600), 'perdida')
})

test('con una orden pendiente no se puede enviar ni frenar en esa sesión', () => {
  const s = ses({ actividad: 'pensando' })
  const libre = vistaBarra(s, { borrador: 'hola' }, AHORA)
  assert.equal(libre.puedeEnviar, true)
  assert.equal(libre.ocupada, false)
  const pendiente = vistaBarra(s, { borrador: 'hola', pendiente: { tipo: 'mensaje', desde: AHORA } }, AHORA)
  assert.equal(pendiente.puedeEnviar, false)
  assert.equal(pendiente.ocupada, true)
  assert.deepEqual(pendiente.linea, { texto: 'Enviando…', tono: 'info' })
  assert.deepEqual(vistaBarra(s, { pendiente: { tipo: 'frenar', desde: AHORA } }, AHORA).linea, { texto: 'Frenando…', tono: 'info' })
  const h = barraControl(s, { borrador: 'hola', pendiente: { tipo: 'mensaje', desde: AHORA } }, AHORA)
  assert.match(h, /data-accion="ctl-enviar"[^>]* disabled/)
  assert.match(h, /data-accion="ctl-frenar"[^>]* disabled/)
  // Vacío tampoco se envía
  assert.equal(vistaBarra(s, { borrador: '  ' }, AHORA).puedeEnviar, false)
})

test('la línea del resultado se ve un rato y se va; un error queda hasta que el usuario escribe o manda', () => {
  const s = ses()
  for (const tono of ['ok', 'info']) {
    const ui = { linea: { texto: 'Enviado', tono, desde: AHORA } }
    assert.deepEqual(vistaBarra(s, ui, AHORA + MS_LINEA - 1).linea, { texto: 'Enviado', tono })
    assert.equal(vistaBarra(s, ui, AHORA + MS_LINEA).linea, null)
  }
  const error = { texto: 'La sesión no respondió', tono: 'error', desde: AHORA }
  assert.deepEqual(vistaBarra(s, { linea: error }, AHORA + 10 * MS_LINEA).linea, { texto: 'La sesión no respondió', tono: 'error' })
  // Escribir saca el error; lo bueno sigue su tiempo
  assert.equal(lineaAlEscribir(error), null)
  const ok = { texto: 'Enviado', tono: 'ok', desde: AHORA }
  assert.equal(lineaAlEscribir(ok), ok)
  assert.equal(lineaAlEscribir(null), null)
})

test('mientras Frenar confirma, la línea dice que espera el segundo clic y cómo cancelar', () => {
  const s = ses({ enTurno: true, actividad: 'pensando' })
  const ui = { ...clicFrenar({}, AHORA), linea: { texto: 'Enviado', tono: 'ok', desde: AHORA } }
  assert.deepEqual(vistaBarra(s, ui, AHORA + 1000).linea, { texto: 'Tocá otra vez para frenar · Esc cancela', tono: 'info' })
  // A los 3 s vuelve lo de antes, nunca frena solo
  assert.deepEqual(vistaBarra(s, ui, AHORA + MS_CONFIRMAR_FRENAR).linea, { texto: 'Enviado', tono: 'ok' })
  assert.match(barraControl(s, ui, AHORA + 1000), /data-tono="info">Tocá otra vez para frenar · Esc cancela</)
  // Un redibujo a mitad de la confirmación sigue la barrita desde donde iba
  assert.equal(vistaBarra(s, ui, AHORA + 1000).frenar.transcurrido, 1000)
  assert.match(barraControl(s, ui, AHORA + 1000), /ctl-frenar confirma"[^>]* style="--ya:-1000ms"/)
  assert.doesNotMatch(barraControl(s, {}, AHORA), /--ya/)
})

test('el mensaje nunca se pierde: el campo se vacía solo si la orden se envió o quedó en cola', () => {
  for (const resultado of ['enviado', 'en-cola']) {
    assert.equal(borradorTrasOrden({ resultado, enviado: 'hola', actual: 'hola' }), '', resultado)
    // Si se siguió escribiendo mientras se mandaba, lo nuevo queda
    assert.equal(borradorTrasOrden({ resultado, enviado: 'hola', actual: 'hola y algo más' }), 'hola y algo más', resultado)
  }
  for (const resultado of ['timeout', 'perdida', 'fallo', 'descartada', 'error', 'otra-cosa']) {
    assert.equal(borradorTrasOrden({ resultado, enviado: 'hola', actual: 'hola' }), 'hola', resultado)
    // Lo que el usuario escribió entretanto no se pisa
    assert.equal(borradorTrasOrden({ resultado, enviado: 'hola', actual: 'otra cosa' }), 'otra cosa', resultado)
    // Si el campo quedó vacío, vuelve lo que no se pudo mandar
    assert.equal(borradorTrasOrden({ resultado, enviado: 'hola', actual: '' }), 'hola', resultado)
    assert.equal(borradorTrasOrden({ resultado, enviado: 'hola', actual: undefined }), 'hola', resultado)
  }
})

test('cada barra se llama con su rama, así varias sesiones no se confunden', () => {
  assert.match(barraControl(ses({ rama: 'feat/6-estilo-avis-marco' }), {}, AHORA), /role="group" aria-label="Escribirle a Claude en feat\/6-estilo-avis-marco"/)
  assert.match(barraControl(ses({ rama: null }), {}, AHORA), /aria-label="Escribirle a Claude en q\/oficina"/)
  assert.match(barraControl(ses({ rama: null, repo: null }), {}, AHORA), /aria-label="Escribirle a Claude en esta sesión"/)
  assert.match(barraControl(ses({ rama: 'a"b<c' }), {}, AHORA), /aria-label="Escribirle a Claude en a&quot;b&lt;c"/)
})

test('la barra vuelve a dibujar el borrador guardado, escapado y con su primera línea en blanco', () => {
  const h = barraControl(ses(), { borrador: '\n<b>hola</b> & "chau"' }, AHORA)
  // El parser de HTML se come un salto de línea al empezar un textarea: se pone uno de más
  assert.match(h, /<textarea [^>]*>\n\n&lt;b&gt;hola&lt;\/b&gt; &amp; &quot;chau&quot;<\/textarea>/)
  assert.match(h, /aria-label="Mensaje para Claude"/)
  assert.match(h, /placeholder="Escribile a Claude…"/)
  assert.match(h, /maxlength="10000"/)
  assert.match(h, /class="ctl-res" role="status" aria-live="polite"/)
})

test('la tarjeta lleva la barra abajo, después del escenario, solo con puedeControlar', () => {
  const [p] = agruparPorProyecto([ses()])
  const prep = prepararProyecto(p, AHORA)
  const h = sesiones(prep, AHORA, new Map(), null, { 'ses-1': { borrador: 'hola' } })
  assert.match(h, /<div class="esc[^"]*">[\s\S]*<\/div><div class="ctl"[^>]*data-sesion="ses-1"[\s\S]*<\/article>$/)
  assert.match(h, />\nhola<\/textarea>/)
  const [sinControl] = agruparPorProyecto([ses({ puedeControlar: undefined })])
  assert.doesNotMatch(sesiones(prepararProyecto(sinControl, AHORA), AHORA), /class="ctl"/)
})

test('la firma de las escenas cambia si la sesión empieza a aceptar control, no con el borrador', () => {
  const [p] = agruparPorProyecto([ses()])
  const [q] = agruparPorProyecto([ses({ puedeControlar: undefined })])
  const conControl = firmaEscenas(p.repo, prepararProyecto(p, AHORA))
  assert.notEqual(conControl, firmaEscenas(q.repo, prepararProyecto(q, AHORA)))
  // Sin control, la firma de siempre (la prueba de tablero.test.js no cambia)
  assert.doesNotMatch(firmaEscenas(q.repo, prepararProyecto(q, AHORA)), /~/)
})

// ------------------------------------------------------------------ cerrar la sesión (#25, mod v0.11)

test('Cerrar sesión se ve solo si la sesión publica puedeCerrar: true (las de terminal)', () => {
  assert.equal(puedeCerrar(ses({ puedeCerrar: true })), true)
  for (const v of [undefined, false, 'true']) assert.equal(puedeCerrar(ses({ puedeCerrar: v })), false)
  assert.equal(vistaBarra(ses({ puedeCerrar: true }), {}, AHORA).cerrar.visible, true)
  assert.equal(vistaBarra(ses(), {}, AHORA).cerrar.visible, false)
  assert.match(barraControl(ses({ puedeCerrar: true }), {}, AHORA), /<button type="button" class="btn sec ctl-cerrar" data-accion="ctl-cerrar" data-rol="cerrar" data-sesion="ses-1" aria-label="Cerrar esta sesión de Claude">Cerrar sesión<\/button>/)
  // La de la app de escritorio o de VS Code lleva el botón escondido: refrescarBarra no lo muestra nunca
  assert.match(barraControl(ses(), {}, AHORA), /data-accion="ctl-cerrar"[^>]* hidden/)
})

test('Cerrar confirma en el botón: el primer clic pide "¿Cerrar? Sí" por 3 s y solo el segundo cierra', () => {
  assert.equal(MS_CONFIRMAR_CERRAR, 3000)
  const s = ses({ puedeCerrar: true })
  const primero = clicCerrar({}, AHORA)
  assert.deepEqual(primero, { cierraHasta: AHORA + 3000, cerrar: false })
  const v = vistaBarra(s, primero, AHORA + 1000)
  assert.equal(v.cerrar.confirma, true)
  assert.equal(v.cerrar.etiqueta, '¿Cerrar? Sí')
  assert.equal(v.cerrar.nombre, 'Confirmar: cerrar esta sesión de Claude')
  assert.deepEqual(v.linea, { texto: 'Tocá otra vez para cerrar la sesión · Esc cancela', tono: 'info' })
  assert.match(barraControl(s, primero, AHORA + 1000), /ctl-cerrar confirma"[^>]* style="--ya:-1000ms"/)
  assert.deepEqual(clicCerrar(primero, AHORA + 2999), { cierraHasta: null, cerrar: true })
})

test('sin segundo clic vuelve solo a "Cerrar sesión" y nunca cierra por tiempo', () => {
  const s = ses({ puedeCerrar: true })
  const primero = clicCerrar({}, AHORA)
  assert.equal(vistaBarra(s, primero, AHORA + 3000).cerrar.etiqueta, 'Cerrar sesión')
  assert.equal(vistaBarra(s, primero, AHORA + 3000).linea, null)
  assert.deepEqual(clicCerrar(primero, AHORA + 3001), { cierraHasta: AHORA + 6001, cerrar: false })
})

test('mientras se cierra, nada más se manda; el resultado es una línea corta', () => {
  const s = ses({ puedeCerrar: true, enTurno: true, actividad: 'pensando' })
  const v = vistaBarra(s, { borrador: 'hola', pendiente: { tipo: 'cerrar', desde: AHORA } }, AHORA)
  assert.deepEqual(v.linea, { texto: 'Cerrando…', tono: 'info' })
  assert.equal(v.puedeEnviar, false)
  assert.match(barraControl(s, { pendiente: { tipo: 'cerrar', desde: AHORA } }, AHORA), /data-accion="ctl-cerrar"[^>]* disabled/)
  assert.deepEqual(lineaResultado({ tipo: 'cerrar', resultado: 'cerrando' }), { texto: 'Cerrando la sesión…', tono: 'ok' })
  assert.deepEqual(lineaResultado({ tipo: 'cerrar', resultado: 'descartada', motivo: 'solo se cierran las sesiones de terminal' }), { texto: 'No se pudo cerrar · solo se cierran las sesiones de terminal', tono: 'error' })
  assert.deepEqual(lineaResultado({ tipo: 'cerrar', resultado: 'timeout' }), { texto: 'La sesión no respondió', tono: 'error' })
})

test('lo de antes sigue: Frenar y Enviar no cambian con Cerrar en la barra', () => {
  const s = ses({ puedeCerrar: true, enTurno: true, actividad: 'pensando' })
  // Frenar confirma con su propio texto aunque Cerrar esté a la vista
  const f = vistaBarra(s, clicFrenar({}, AHORA), AHORA + 1000)
  assert.equal(f.frenar.etiqueta, '¿Frenar? Sí')
  assert.equal(f.cerrar.etiqueta, 'Cerrar sesión')
  assert.deepEqual(f.linea, { texto: 'Tocá otra vez para frenar · Esc cancela', tono: 'info' })
  // Y Cerrar confirmando no toca a Frenar
  assert.equal(vistaBarra(s, clicCerrar({}, AHORA), AHORA + 1000).frenar.etiqueta, 'Frenar')
  // Enviar: igual que siempre
  assert.equal(vistaBarra(s, { borrador: 'hola' }, AHORA).puedeEnviar, true)
  assert.deepEqual(vistaBarra(s, { pendiente: { tipo: 'mensaje', desde: AHORA } }, AHORA).linea, { texto: 'Enviando…', tono: 'info' })
  assert.deepEqual(lineaResultado({ tipo: 'mensaje', resultado: 'enviado' }), { texto: 'Enviado', tono: 'ok' })
  assert.deepEqual(lineaResultado({ tipo: 'frenar', resultado: 'frenado' }), { texto: 'Frenado', tono: 'ok' })
})
