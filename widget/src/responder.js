// Lógica pura del globo que responde. Regla del usuario: el widget no decide por él. Solo se
// arma una respuesta a partir de lo que el usuario tocó; no hay opción por defecto ni tiempo
// que elija solo. Si nadie toca nada, la pregunta sigue esperando en Claude.

/** Cuánto se espera a que la sesión tome la respuesta antes de pedir que se responda en Claude. */
export const MS_CONFIRMACION = 5000

/** La sesión publica que acepta respuestas del widget (mod v0.5 o posterior). */
export function puedeResponder(sesion) {
  return sesion?.puedeResponder === true
}

/**
 * Respuesta a un ítem a partir de lo que el usuario eligió: `{ opcion: k }`, `{ opciones: [k…] }`
 * (selección múltiple) o `{ texto }` (Otra respuesta). Devuelve `{ valor, libre }` o null si la
 * elección no alcanza; nunca completa nada por su cuenta.
 */
export function armarRespuesta(item, eleccion) {
  if (!eleccion || typeof eleccion !== 'object') return null
  const etiquetas = (item.opciones ?? []).map(o => o.etiqueta)
  if (typeof eleccion.texto === 'string') {
    const texto = eleccion.texto.trim()
    return texto ? { valor: texto, libre: true } : null
  }
  if (Number.isInteger(eleccion.opcion) && !item.multiple) {
    const valor = etiquetas[eleccion.opcion]
    return valor === undefined ? null : { valor, libre: false }
  }
  if (Array.isArray(eleccion.opciones) && item.multiple) {
    const indices = [...new Set(eleccion.opciones)].filter(k => etiquetas[k] !== undefined).sort((a, b) => a - b)
    return indices.length ? { valor: indices.map(k => etiquetas[k]).join(', '), libre: false } : null
  }
  return null
}

/** Primer ítem de la llamada que todavía no tiene respuesta, o -1. */
export function siguienteSinResponder(pregunta, borrador) {
  return pregunta.items.findIndex(item => !borrador[item.pregunta])
}

/**
 * Lo que se le manda al comando `responder`: todas las preguntas de la llamada, por texto.
 * Null mientras falte alguna.
 */
export function cuerpoRespuesta(pregunta, borrador) {
  if (!pregunta.items.length || siguienteSinResponder(pregunta, borrador) !== -1) return null
  const answers = {}
  const libres = []
  for (const item of pregunta.items) {
    const r = borrador[item.pregunta]
    answers[item.pregunta] = r.valor
    if (r.libre) libres.push(item.pregunta)
  }
  return { answers, libres }
}

/** "«Vitrina» · «Tests, CI»": lo que se respondió, para el mensaje de listo. */
export function textoRespondido(pregunta, borrador) {
  return pregunta.items.map(item => `«${borrador[item.pregunta]?.valor ?? ''}»`).join(' · ')
}

/**
 * Qué mostrar después de enviar. `archivo`: pendiente, consumida o ausente; `sigue`: la pregunta
 * sigue publicada como pendiente; `ms`: desde el envío.
 */
export function estadoEnvio({ archivo, sigue, ms }) {
  if (archivo === 'consumida') return 'listo'
  if (!sigue) return 'yaRespondida'
  return ms >= MS_CONFIRMACION ? 'enClaude' : 'esperando'
}


/** Tras pasar a la pregunta siguiente de la llamada, los clics se ignoran este tiempo (doble clic). */
export const MS_PAUSA_AVANCE = 300

/**
 * La pregunta a la que apunta un clic. El destino sale del botón tal como se dibujó
 * (`{ pregunta, item }`) y tiene que coincidir con el globo que se ve y con una pregunta que
 * sigue pendiente; nunca de la pestaña activa, que puede cambiar mientras se lee la carpeta.
 */
export function objetivoDelClic(pendientes, boton, mostrado) {
  if (motivoRechazo(pendientes, boton, mostrado)) return null
  return pendientes.find(x => x.pregunta?.id === boton.pregunta && x.indice === boton.item)
}

/** Por qué un clic no apunta a una pregunta que se pueda responder, o null si apunta bien. */
export function motivoRechazo(pendientes, boton, mostrado) {
  if (!boton) return 'boton-sin-pregunta'
  if (!mostrado) return 'globo-sin-pregunta'
  if (boton.pregunta !== mostrado.pregunta || boton.item !== mostrado.item) return 'otro-globo'
  const q = pendientes.find(x => x.pregunta?.id === boton.pregunta && x.indice === boton.item)
  if (!q) return 'ya-no-pendiente'
  if (!q.responde) return 'sesion-no-acepta'
  return null
}

/**
 * Línea del log de un clic. Lleva la etiqueta elegida; el texto de "Otra respuesta" nunca se
 * escribe (queda "(texto libre)").
 */
export function lineaClic({ pregunta, item, decision, motivo, etiqueta, libre }) {
  const donde = `clic pregunta=${pregunta || '?'} item=${Number.isInteger(item) ? item : '?'}`
  if (motivo) return `${donde} -> ${decision} (${motivo})`
  if (etiqueta === undefined) return `${donde} -> ${decision}`
  return `${donde} -> ${decision} etiqueta=${libre ? '(texto libre)' : JSON.stringify(etiqueta)}`
}

/**
 * Registra lo que el usuario eligió para `q`. Devuelve el estado nuevo y qué hacer:
 * `nada` (sin elección válida, ya enviada, o un clic dentro de la pausa tras avanzar),
 * `avanzar` (faltan preguntas de la llamada; `falta` es el índice) o `enviar` (con `cuerpo`).
 * `estado`: `{ borradores, envios, bloqueoHasta }`.
 */
export function registrarEleccion(estado, q, eleccion, ahoraMs) {
  const nada = motivo => ({ estado, accion: 'nada', motivo })
  if (!q) return nada('sin-pregunta')
  if (ahoraMs < (estado.bloqueoHasta ?? 0)) return nada('pausa-tras-avanzar')
  const id = q.pregunta.id
  if (estado.envios?.[id]) return nada('ya-enviada')
  const r = armarRespuesta(q.item, eleccion)
  if (!r) return nada('eleccion-invalida')
  const borrador = { ...(estado.borradores?.[id] ?? {}), [q.item.pregunta]: r }
  const borradores = { ...estado.borradores, [id]: borrador }
  const falta = siguienteSinResponder(q.pregunta, borrador)
  if (falta !== -1) return { estado: { ...estado, borradores, bloqueoHasta: ahoraMs + MS_PAUSA_AVANCE }, accion: 'avanzar', falta, respuesta: r }
  return { estado: { ...estado, borradores }, accion: 'enviar', cuerpo: cuerpoRespuesta(q.pregunta, borrador), borrador, respuesta: r }
}

/** Marca o desmarca una opción de selección múltiple; dentro de la pausa tras avanzar, no cambia nada. */
export function alternarSeleccion(seleccion, k, ahoraMs, bloqueoHasta) {
  if (ahoraMs < (bloqueoHasta ?? 0)) return seleccion
  const nueva = new Set(seleccion)
  if (nueva.has(k)) nueva.delete(k)
  else nueva.add(k)
  return nueva
}
