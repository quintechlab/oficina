// Barra de control de cada tarjeta de sesión (#19): un campo "Escribile a Claude…" con Enviar,
// "Frenar" mientras la sesión trabaja y, desde el #25, "Cerrar sesión" en las de terminal. Lógica pura
// y el HTML de la barra; el foco, el borrador y el sondeo de la orden viven en main.js, el archivo en
// ordenes.rs.
// Regla de siempre: el widget nunca decide por el usuario. Solo un clic o un Enter envía, frena o
// cierra; nada se manda solo ni por tiempo. Frenar y Cerrar piden un segundo clic (D2).

import { ANIMOS_DE_TRABAJO, animoSesion, escapar } from './logica.js'

/** El primer clic en Frenar pide confirmar por este tiempo; sin segundo clic vuelve solo (D2). */
export const MS_CONFIRMAR_FRENAR = 3000
/** Largo máximo del mensaje, como `length` en el mod (unidades UTF-16). */
export const MAX_TEXTO = 10000
/** Cada cuánto se mira si la sesión tomó la orden, y hasta cuándo (después se borra). */
export const MS_SONDEO_ORDEN = 500
export const MS_ESPERA_ORDEN = 10000
/** Lo que se ve la línea del resultado ("Enviado", "Frenado"…). */
export const MS_LINEA = 8000

/** La sesión acepta órdenes del widget (mod v0.10 o más nuevo). */
export const puedeControlar = s => s?.puedeControlar === true

/**
 * ¿Hay algo que frenar? Un turno del hilo principal en curso (`enTurno`, que el mod escribe al
 * instante) y la sesión trabajando con los ánimos de siempre. Subagentes o procesos en segundo plano
 * con el turno ya terminado no cuentan: `$.turn.abort` no tendría turno que cortar.
 */
export const trabajando = (s, ahoraMs) => s?.enTurno === true && ANIMOS_DE_TRABAJO.has(animoSesion(s, ahoraMs))

/** ¿El botón Frenar está pidiendo confirmación? `ui.confirmaHasta`: hasta cuándo. */
export const confirmando = (ui, ahoraMs) => ui?.confirmaHasta != null && ahoraMs < ui.confirmaHasta

/**
 * Un clic en Frenar (D2). El primero, o uno después de los 3 s, pide confirmar; el segundo dentro de
 * la ventana frena. Devuelve el nuevo `confirmaHasta` y si hay que frenar.
 */
export function clicFrenar(ui, ahoraMs) {
  if (confirmando(ui, ahoraMs)) return { confirmaHasta: null, frenar: true }
  return { confirmaHasta: ahoraMs + MS_CONFIRMAR_FRENAR, frenar: false }
}

/** El primer clic en "Cerrar sesión" pide confirmar por este tiempo, como Frenar (#25). */
export const MS_CONFIRMAR_CERRAR = 3000

/**
 * La sesión se puede cerrar desde el widget (mod v0.11): solo las de terminal. En la app de
 * escritorio o en VS Code, salir cerraría su ventana o su panel; ahí el botón no aparece.
 */
export const puedeCerrar = s => s?.puedeCerrar === true

/** ¿"Cerrar sesión" está pidiendo confirmación? `ui.cierraHasta`: hasta cuándo. */
export const confirmandoCierre = (ui, ahoraMs) => ui?.cierraHasta != null && ahoraMs < ui.cierraHasta

/**
 * Un clic en "Cerrar sesión" (#25), igual que Frenar: el primero, o uno después de los 3 s, pide
 * confirmar; el segundo dentro de la ventana cierra. Nunca cierra por tiempo.
 */
export function clicCerrar(ui, ahoraMs) {
  if (confirmandoCierre(ui, ahoraMs)) return { cierraHasta: null, cerrar: true }
  return { cierraHasta: ahoraMs + MS_CONFIRMAR_CERRAR, cerrar: false }
}

/** El texto sin los espacios de los bordes, de 1 a 10000 caracteres; si no, el error. */
export function validarTexto(texto) {
  const t = String(texto ?? '').trim()
  if (!t) return { error: 'Escribí un mensaje' }
  if (t.length > MAX_TEXTO) return { error: `El mensaje pasa de ${MAX_TEXTO} caracteres` }
  return { texto: t }
}

/**
 * Qué hace una tecla en el campo (D4): Enter envía; Shift+Enter hace línea nueva (lo de siempre del
 * campo). Mientras el IME compone una palabra, Enter es del IME y no envía.
 */
export function teclaControl(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return null
  return 'enviar'
}

const VERBO = { mensaje: 'enviar', frenar: 'frenar', cerrar: 'cerrar' }
const noSePudo = (tipo, motivo) => ({ texto: `No se pudo ${VERBO[tipo] ?? 'enviar'}${motivo ? ` · ${motivo}` : ''}`, tono: 'error' })

/**
 * La línea corta de lo que pasó con una orden: los resultados del mod, más `timeout` (la sesión no la
 * tomó en 10 s) y `perdida` (el archivo ya no estaba o era de otra orden).
 */
export function lineaResultado({ tipo, resultado, motivo }) {
  switch (resultado) {
    case 'enviado': return { texto: 'Enviado', tono: 'ok' }
    // La etiqueta "en cola" ya dice el estado; la línea dice lo que pasó
    case 'en-cola': return { texto: 'Enviado · Claude lo lee al terminar el turno', tono: 'ok' }
    case 'frenado': return { texto: 'Frenado', tono: 'ok' }
    case 'sin-turno': return { texto: 'No estaba trabajando', tono: 'info' }
    // La sesión sale como con /exit; la tarjeta se va sola cuando marca su archivo como cerrado
    case 'cerrando': return { texto: 'Cerrando la sesión…', tono: 'ok' }
    case 'timeout': return { texto: 'La sesión no respondió', tono: 'error' }
    case 'perdida': return { texto: 'No se pudo confirmar', tono: 'error' }
    default: return noSePudo(tipo, motivo)
  }
}

/** La línea cuando ni siquiera se pudo escribir la orden (p. ej. "todavía hay una orden pendiente"). */
export const lineaError = (tipo, error) => noSePudo(tipo, String(error?.message ?? error ?? ''))

/** Lo que el mod confirma como mandado: solo entonces el campo se vacía. */
const MANDADO = new Set(['enviado', 'en-cola'])

/**
 * El borrador cuando termina una orden `mensaje` (el campo no se vacía al escribirla). `enviado`: el
 * borrador que se mandó; `actual`: lo que hay ahora en el campo. Mandado y sin tocar → vacío. Si no se
 * pudo (cualquier otro resultado, o el error al escribirla), el mensaje no se pierde: queda lo que hay,
 * y si el campo quedó vacío vuelve lo que no se pudo mandar. Lo escrito entretanto nunca se pisa.
 */
export function borradorTrasOrden({ resultado, enviado, actual }) {
  const ahora = actual ?? ''
  if (MANDADO.has(resultado)) return ahora === enviado ? '' : ahora
  return ahora === '' ? enviado ?? '' : ahora
}

/** Escribir en el campo saca la línea de error (que no se va con el tiempo); lo demás sigue su tiempo. */
export const lineaAlEscribir = linea => (linea?.tono === 'error' ? null : linea)

const LINEA_CONFIRMA = { texto: 'Tocá otra vez para frenar · Esc cancela', tono: 'info' }
const LINEA_CONFIRMA_CIERRE = { texto: 'Tocá otra vez para cerrar la sesión · Esc cancela', tono: 'info' }
const LINEA_PENDIENTE = { mensaje: 'Enviando…', frenar: 'Frenando…', cerrar: 'Cerrando…' }

/** "en cola" mientras la sesión tiene mensajes del widget esperando que termine el turno (D3). */
export function textoCola(s) {
  const n = Number(s?.enCola) || 0
  if (n <= 0) return null
  return n === 1 ? 'en cola' : `${n} en cola`
}

/**
 * Qué hacer en cada vuelta del sondeo: esperar, `listo` (la sesión la tomó), `timeout` (10 s sin
 * tomarla: se borra para que no se ejecute tarde) o `perdida` (no hay archivo de esta orden).
 */
export function pasoOrden(estado, transcurridoMs) {
  if (estado?.estado === 'consumida') return 'listo'
  if (estado?.estado === 'pendiente') return transcurridoMs >= MS_ESPERA_ORDEN ? 'timeout' : 'esperar'
  return 'perdida'
}

/**
 * Lo que muestra la barra de una sesión. `ui`: su estado en la ventana (`borrador`, `confirmaHasta`,
 * `cierraHasta`, `pendiente` { tipo, desde } mientras se espera la orden, `linea` { texto, tono, desde }).
 * La línea: lo que se está mandando, si no Frenar o Cerrar pidiendo el segundo clic, si no el
 * resultado. Un resultado `ok` o `info` se va a los 8 s; un `error` queda hasta que el usuario
 * escribe o manda otra.
 */
export function vistaBarra(s, ui = {}, ahoraMs) {
  const ocupada = !!ui.pendiente
  const confirma = !ocupada && confirmando(ui, ahoraMs)
  const cierra = !ocupada && confirmandoCierre(ui, ahoraMs)
  const puedeFrenar = trabajando(s, ahoraMs)
  const cerrable = puedeCerrar(s)
  let linea = null
  if (ocupada) linea = { texto: LINEA_PENDIENTE[ui.pendiente.tipo] ?? 'Enviando…', tono: 'info' }
  else if (confirma && puedeFrenar) linea = { ...LINEA_CONFIRMA }
  else if (cierra && cerrable) linea = { ...LINEA_CONFIRMA_CIERRE }
  else if (ui.linea && (ui.linea.tono === 'error' || ahoraMs - ui.linea.desde < MS_LINEA)) linea = { texto: ui.linea.texto, tono: ui.linea.tono }
  return {
    visible: puedeControlar(s),
    ocupada,
    puedeEnviar: !ocupada && !validarTexto(ui.borrador).error,
    frenar: {
      visible: puedeFrenar,
      confirma,
      // Cuánto de los 3 s ya pasó: un redibujo sigue la barrita desde ahí, no la vuelve a llenar
      transcurrido: confirma ? Math.max(0, MS_CONFIRMAR_FRENAR - (ui.confirmaHasta - ahoraMs)) : 0,
      etiqueta: confirma ? '¿Frenar? Sí' : 'Frenar',
      nombre: confirma ? 'Confirmar: frenar el turno de Claude' : 'Frenar el turno de Claude',
    },
    cerrar: {
      visible: cerrable,
      confirma: cierra,
      transcurrido: cierra ? Math.max(0, MS_CONFIRMAR_CERRAR - (ui.cierraHasta - ahoraMs)) : 0,
      etiqueta: cierra ? '¿Cerrar? Sí' : 'Cerrar sesión',
      nombre: cierra ? 'Confirmar: cerrar esta sesión de Claude' : 'Cerrar esta sesión de Claude',
    },
    linea,
    cola: textoCola(s),
  }
}

const si = (cond, attr) => (cond ? ` ${attr}` : '')

/**
 * La barra al pie de la tarjeta (D1). El textarea lleva el borrador guardado (así un redibujo no
 * pierde lo escrito) con un salto de línea de más al principio: el parser de HTML se come uno.
 * main.js actualiza en su lugar los botones, la cola y la línea (`data-rol`), sin redibujar.
 */
export function barraControl(s, ui = {}, ahoraMs) {
  const v = vistaBarra(s, ui, ahoraMs)
  if (!v.visible) return ''
  const ses = escapar(s.sesion)
  // Cada grupo con su nombre (la rama, si no el repo): con varias sesiones no se llaman todos igual
  const donde = escapar(s.rama || s.repo || 'esta sesión')
  return `<div class="ctl" role="group" aria-label="Escribirle a Claude en ${donde}" data-sesion="${ses}">`
    + '<div class="ctl-fila">'
    + `<textarea class="ctl-in" data-rol="in" data-sesion="${ses}" rows="1" maxlength="${MAX_TEXTO}" placeholder="Escribile a Claude…" aria-label="Mensaje para Claude" aria-describedby="ctl-ayuda-${ses}">\n${escapar(ui.borrador ?? '')}</textarea>`
    + `<button type="button" class="btn ctl-env" data-accion="ctl-enviar" data-rol="env" data-sesion="${ses}"${si(!v.puedeEnviar, 'disabled')}>Enviar</button>`
    + `<button type="button" class="btn sec ctl-frenar${v.frenar.confirma ? ' confirma' : ''}" data-accion="ctl-frenar" data-rol="frenar" data-sesion="${ses}" aria-label="${v.frenar.nombre}"${si(v.frenar.confirma, `style="--ya:-${v.frenar.transcurrido}ms"`)}${si(v.ocupada, 'disabled')}${si(!v.frenar.visible, 'hidden')}>${v.frenar.etiqueta}</button>`
    + `<span class="oculto" id="ctl-ayuda-${ses}">Enter envía; Shift+Enter, línea nueva</span>`
    + '</div>'
    + `<p class="ctl-est"><span class="ctl-cola"${si(!v.cola, 'hidden')}>${escapar(v.cola ?? '')}</span>`
    + `<span class="ctl-res" role="status" aria-live="polite" data-rol="res" data-tono="${v.linea?.tono ?? ''}">${escapar(v.linea?.texto ?? '')}</span>`
    // Cerrar (#25): al costado de la línea, lejos de Enviar; escondido si la sesión no es de terminal
    + `<button type="button" class="btn sec ctl-cerrar${v.cerrar.confirma ? ' confirma' : ''}" data-accion="ctl-cerrar" data-rol="cerrar" data-sesion="${ses}" aria-label="${v.cerrar.nombre}"${si(v.cerrar.confirma, `style="--ya:-${v.cerrar.transcurrido}ms"`)}${si(v.ocupada, 'disabled')}${si(!v.cerrar.visible, 'hidden')}>${v.cerrar.etiqueta}</button></p>`
    + '</div>'
}
