// Tarjeta de pregunta del estilo Avis (docs/diseno/estilo-avis-ux.md, 4.5) y sus avisos.
// Reemplaza al globo: cambia la forma, no el contrato. Los mismos data-accion, data-pregunta,
// data-item y data-globo; la lógica de envío sigue en main.js y responder.js. Regla firme (11):
// ninguna opción viene marcada ni recibe el foco, y "Recomendada" es solo un rótulo.

import { avi, CLAUDE } from './avis.js'
import { personajeDeNombre, preguntasPendientes, etiquetaOpcion, escapar, tiempoRelativo, nombreProyecto } from './logica.js'

/** Datos de quien pregunta: nombre, personaje y en qué sesión. */
export function quienPregunta(q) {
  const pj = q.agente ? personajeDeNombre(q.quien) : CLAUDE
  return { ...pj, nombre: q.quien, ses: q.tarea ? `#${q.tarea}` : 'sin tarea' }
}

/**
 * Píldora de aviso (4.3.2): la pregunta de otro proyecto (`data-accion="ir"`) o la propia
 * plegada con "Más tarde" (`data-accion="ver"`). Solo muestra: nunca responde.
 */
function aviso(atributos, pj, textoHtml) {
  return `<button type="button" class="aviso" ${atributos}>${avi(pj, 'teEspera', 36)}<span>${textoHtml}</span><span class="ir">Ver →</span></button>`
}

/** Una opción con su número, su etiqueta, el rótulo "Recomendada" si lo trae y la descripción. */
function cuerpoOpcion(o, k, marcada) {
  const e = etiquetaOpcion(o.etiqueta)
  const recom = e.recomendada ? '<span class="recom">Recomendada</span>' : ''
  return `<span class="n" aria-hidden="true">${marcada ? '✓' : k + 1}</span><b>${escapar(e.texto)}${recom}</b><small>${escapar(o.descripcion)}</small>`
}

/**
 * Tarjeta de pregunta (dirección 4.5). Interactiva si la sesión acepta respuestas del widget
 * (`q.responde`); si no, la variante de solo lectura. `ui`: estado de la interacción
 * (selección múltiple, "Otra respuesta", borrador de la llamada, envío en curso, plegada y hecho).
 */
export function globo(pendientes, { activa = 0, nuevo = false, ahoraMs, ui = {} }) {
  if (ui.hecho) return tarjetaHecho(ui.hecho, ui.saliendo)
  if (!pendientes.length) return ''
  const i = Math.min(activa, pendientes.length - 1), q = pendientes[i], qn = quienPregunta(q)
  if (ui.plegado) {
    const texto = pendientes.length === 1 ? `<b>${escapar(qn.nombre)}</b> te pregunta algo` : `${pendientes.length} preguntas esperan`
    return aviso('data-accion="ver"', qn, texto)
  }
  const borrador = ui.borradores?.[q.pregunta?.id] ?? {}
  const envio = ui.envios?.[q.pregunta?.id]
  let h = `<div class="preg${nuevo ? ' entra' : ''}" role="dialog" aria-labelledby="g-p" data-globo${q.responde ? ` data-pregunta="${escapar(q.pregunta?.id ?? '')}" data-item="${q.indice}"` : ''}>`
  if (pendientes.length > 1) {
    h += `<div class="preg-tabs" role="tablist" aria-label="Preguntas pendientes">${pendientes.map((x, k) => {
      const xq = quienPregunta(x)
      const hecha = !!ui.borradores?.[x.pregunta?.id]?.[x.item.pregunta]
      return `<button type="button" class="preg-tab" role="tab" aria-selected="${k === i}" data-accion="tab" data-i="${k}"><span class="pt" style="--c:${xq.color}" aria-hidden="true"></span>${escapar(xq.nombre)}${x.item.encabezado ? ` · ${escapar(x.item.encabezado)}` : ''} <span aria-hidden="true">${hecha ? '✓' : '!'}</span></button>`
    }).join('')}</div>`
  }
  h += `<div class="preg-cab">${avi(qn, 'teEspera', 38)}<span><b>${escapar(qn.nombre)}</b> te pregunta · ${escapar(qn.ses)} · hace ${escapar(tiempoRelativo(q.desde, ahoraMs))}</span></div>`
  h += `<p class="preg-txt" id="g-p">${escapar(q.item.pregunta)}</p>`
  const total = q.pregunta?.items?.length ?? 1
  const modos = []
  if (q.item.multiple) modos.push('Se pueden elegir varias')
  if (q.responde && total > 1 && !envio) modos.push(`pregunta ${q.indice + 1} de ${total}: se envían juntas`)
  if (modos.length) h += `<p class="preg-modo">${escapar(modos.join(' · ').replace(/^p/, 'P'))}</p>`

  const lectura = !q.responde || (envio && envio.estado !== 'enviando')
  const enviando = envio?.estado === 'enviando'
  if (lectura || enviando) {
    h += `<ul class="preg-ops">${(q.item.opciones ?? []).map((o, k) => `<li class="op ro">${cuerpoOpcion(o, k, false)}</li>`).join('')}</ul>`
    let nota = 'Responder en Claude: la sesión espera tu respuesta en su ventana.'
    if (enviando) nota = `Enviando tu respuesta a ${qn.nombre}…`
    else if (envio?.estado === 'enClaude') nota = 'Respondé en Claude: la sesión no tomó la respuesta del widget.'
    else if (envio?.estado === 'yaRespondida') nota = 'Ya se respondió en Claude.'
    return h + `<p class="preg-nota" role="status">${escapar(nota)}</p></div>`
  }

  // La selección vale solo para el ítem en el que se marcó
  const sel = ui.seleccionDe === q.clave ? (ui.seleccion ?? new Set()) : new Set()
  // Cada botón lleva su pregunta y su ítem tal como se dibujaron: el clic no depende de la pestaña activa
  const destino = ` data-pregunta="${escapar(q.pregunta?.id ?? '')}" data-item="${q.indice}"`
  const multi = q.item.multiple
  const verbo = ultimo(q, borrador) ? 'Enviar' : 'Seguir'
  h += `<div class="preg-ops">${(q.item.opciones ?? []).map((o, k) => {
    const marcada = multi && sel.has(k)
    return `<button type="button" class="op" data-accion="op" data-i="${k}"${destino}${multi ? ` aria-pressed="${marcada}"` : ''}>${cuerpoOpcion(o, k, marcada)}</button>`
  }).join('')}</div>`
  if (ui.otra) h += `<div class="preg-otra"><label for="g-otra-in">Tu respuesta</label><input id="g-otra-in" type="text" autocomplete="off" value="${escapar(ui.textoOtra ?? '')}"><button type="button" class="btn" data-accion="enviar-otra"${destino}>${verbo}</button></div>`
  const accion = multi
    ? `<button type="button" class="btn" data-accion="enviar-multi"${destino}${sel.size ? '' : ' disabled'}>${verbo}${sel.size ? ` (${sel.size})` : ''}</button>`
    : `<button type="button" class="btn sec" data-accion="tarde">Más tarde</button>`
  h += `<div class="preg-pie"><button type="button" class="preg-link" data-accion="otra">Otra respuesta</button>${accion}</div>`
  return h + `</div>`
}

/** ¿Es el único ítem de la llamada que falta responder? Entonces el próximo clic envía. */
function ultimo(q, borrador) {
  const items = q.pregunta?.items ?? [q.item]
  return items.every(it => it.pregunta === q.item.pregunta || borrador[it.pregunta])
}

/** "Listo, le respondiste a …" (4.5.10): una píldora con borde verde y el Avi de 34 que festeja. */
function tarjetaHecho(hecho, saliendo) {
  const pj = { color: hecho.color, pj: hecho.pj }
  return `<div class="hecho${saliendo ? ' sale' : ''}" role="status">${avi(pj, hecho.listo ? 'listo' : 'esperando', 34)}${escapar(hecho.mensaje)}</div>`
}

/** Aviso cuando la pregunta está en otro proyecto: al tocarlo, va a ese proyecto. */
export function avisoOtroProyecto(proyectos, indiceActual) {
  for (let k = 0; k < proyectos.length; k++) {
    if (k === indiceActual) continue
    const pend = preguntasPendientes(proyectos[k])
    if (pend.length) {
      const qn = quienPregunta(pend[0])
      return aviso(`data-accion="ir" data-proy="${k}"`, qn, `<b>${escapar(qn.nombre)}</b> te pregunta algo en <b>${escapar(proyectos[k].nombre)}</b>`)
    }
  }
  return ''
}

/**
 * Lo que anuncia una sola vez la región en vivo (8) cuando llegan preguntas nuevas:
 * "Claude te pregunta algo en catalogo". `nuevas`: las de `preguntasNuevas`.
 */
export function anuncioPregunta(nuevas, sesionesLeidas) {
  if (!nuevas.length) return ''
  const q = nuevas[0]
  const s = sesionesLeidas.find(x => (x.preguntas ?? []).some(p => p.id === q.id))
  return `${q.quien} te pregunta algo${s ? ` en ${nombreProyecto(s.repo)}` : ''}`
}
