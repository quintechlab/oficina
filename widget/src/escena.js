// Dibujo de la sala (boceto notebook.html, opción A), la lista de texto y el globo de pregunta.
// Arma texto HTML/SVG a partir de los datos reales; todo texto que viene de una sesión se escapa.

import { P, sprite, svgDoc, cabeza, nuevoId } from './mascotas.js'
import { colaGlobo } from './tamano.js'
import { animoVisual, pantallaNotebook, desplazamiento, distribucion } from './sala.js'
import {
  animoSesion, animoSubagente, personajeDeNombre, tiempoSubagente, textoActividad,
  preguntasPendientes, etiquetaOpcion, escapar, tiempoRelativo, nombreProyecto,
} from './logica.js'

export const ANIMO = { coordinando: 'coordinando el equipo', durmiendo: 'durmiendo', escribiendo: 'escribiendo en la notebook', pensando: 'pensando', leyendo: 'leyendo', comando: 'ejecutando un comando', editando: 'editando', comiendo: 'comiendo tokens', listo: 'listo', reposo: 'listo', fallo: 'falló', esperando: 'esperando', teEspera: 'esperándote', inactiva: 'sin actividad', saluda: 'saluda' }
const ESTADO = { coordinando: 'coordinando', escribiendo: 'escribiendo', comando: 'comando', leyendo: 'leyendo', editando: 'editando', comiendo: 'tokens', listo: 'listo', reposo: 'listo', teEspera: 'esperándote', esperando: 'esperando', pensando: 'pensando', inactiva: 'inactiva', fallo: 'falló' }
const EST_COL = { coordinando: '#F2B632', escribiendo: '#F2B632', comando: '#F2B632', leyendo: '#7FB3FF', editando: '#E78FB3', comiendo: '#F2B632', listo: '#8FD694', reposo: '#8FD694', teEspera: '#F2B632', esperando: '#9AA0AC', pensando: '#F3EBD8', inactiva: '#5C6270', fallo: '#FF6B6B' }
const CLAUDE = personajeDeNombre('Claude')
/** Ancho de la sala y alto de cada piso (una sesión por piso). */
const W = 364, FH = 128

/** Prioridad para elegir qué subagentes entran en el escritorio cuando no caben todos. */
const ORDEN_ANIMO = { teEspera: 0, comando: 1, leyendo: 1, escribiendo: 1, comiendo: 1, fallo: 2, listo: 3, durmiendo: 4 }

/** Sesiones de un proyecto con ánimos y personajes ya resueltos para dibujar. */
export function prepararProyecto(proyecto, ahoraMs) {
  return proyecto.sesiones.map(s => {
    const conPregunta = new Set((s.preguntas ?? []).map(p => p.agente).filter(Boolean))
    const sub = (s.agentes ?? []).map(a => ({
      ...a, ...personajeDeNombre(a.nombre), animo: animoSubagente(a, ahoraMs, conPregunta.has(a.id)),
    }))
    return { s, animo: animoSesion(s, ahoraMs), sub }
  })
}

/** Subagentes con escritorio en el piso (hasta 4) y cuántos quedan como "+n". */
function subagentesVisibles(sub) {
  const { subs, resto } = distribucion(sub.length)
  const orden = [...sub].sort((a, b) => (ORDEN_ANIMO[a.animo] ?? 5) - (ORDEN_ANIMO[b.animo] ?? 5))
  const visibles = new Set(orden.slice(0, subs.length).map(a => a.id))
  // Se dibujan en el orden en que fueron lanzados, para que no cambien de lugar
  return { visibles: sub.filter(a => visibles.has(a.id)), resto }
}

/** Firma de lo que se ve en el terrario: si no cambia, no se redibuja (y no se cortan las animaciones). */
export function firmaTerrario(preparadas) {
  return preparadas.map(({ s, animo, sub }) => [s.sesion, s.tarea, s.rama, animo, ...sub.map(a => `${a.id}:${a.nombre}:${a.animo}`)].join('|')).join('/')
}

/**
 * Un puesto (boceto notebook.html, opción A): silla, la mascota sentada, la mesa y la notebook de
 * costado, abierta a tres cuartos, con la pantalla que sigue al ánimo. `px,py`: origen del sprite
 * (escala 2); la mesa tapa el cuerpo desde la fila 22, así queda sentada.
 */
function puesto(ag, px, py, { orq = false, u }) {
  const animo = animoVisual(ag.animo), col = ag.color
  const izq = orq ? px - 10 : px + 6, der = px + 62
  let b = '', css = '', defs = ''
  // Silla: respaldo detrás del cuerpo, asiento y patas
  b += `<rect x="${px + 12}" y="${py + 34}" width="2" height="20" fill="#3A3047"/><rect x="${px + 34}" y="${py + 34}" width="2" height="20" fill="#3A3047"/><rect x="${px + 10}" y="${py + 48}" width="28" height="4" fill="#4A3D5C"/><rect x="${px + 10}" y="${py + 48}" width="28" height="1" fill="#5C4D70"/><rect x="${px + 12}" y="${py + 52}" width="2" height="6" fill="#2A2235"/><rect x="${px + 34}" y="${py + 52}" width="2" height="6" fill="#2A2235"/>`
  // La mascota: dormida se hunde en la silla, festejando se levanta
  const sp = sprite(animo, col, ag.pj, { x: px, y: py + desplazamiento(animo), s: 2 })
  css += sp.css
  b += sp.g
  // Mesa
  b += `<rect x="${izq}" y="${py + 44}" width="${der - izq}" height="3" fill="#4A5068"/><rect x="${izq}" y="${py + 44}" width="${der - izq}" height="1" fill="#5C6380"/><rect x="${izq}" y="${py + 47}" width="${der - izq}" height="2" fill="#2A2F40"/><rect x="${izq + 2}" y="${py + 49}" width="2" height="9" fill="#2A2F40"/><rect x="${der - 4}" y="${py + 49}" width="2" height="9" fill="#2A2F40"/>`
  // Taza humeante en el escritorio de Claude
  if (orq) b += `<rect x="${izq + 3}" y="${py + 38}" width="5" height="6" fill="#E9EAEE"/><rect x="${izq + 8}" y="${py + 40}" width="1" height="3" fill="#E9EAEE"/><rect class="fx" x="${izq + 5}" y="${py + 34}" width="1" height="2" fill="#9AA0AC" style="opacity:0;animation:codigo 2s ease-out infinite"/>`
  // Notebook: teclado, tapa a tres cuartos y pantalla
  const pantalla = pantallaNotebook(animo)
  b += `<rect x="${px + 40}" y="${py + 43}" width="20" height="2" fill="#2A2F40"/>`
  for (let x = px + 42; x < px + 58; x += 3) b += `<rect x="${x}" y="${py + 43}" width="2" height="1" fill="#4A5068"/>`
  for (let r = 13; r <= 21; r++) { const s = Math.floor((21 - r) / 3) * 2; b += `<rect x="${px + 50 + s}" y="${py + r * 2}" width="12" height="2" fill="#2A2F40"/>` }
  const pts = `${px + 52},${py + 42} ${px + 60},${py + 42} ${px + 64},${py + 28} ${px + 56},${py + 28}`
  b += `<polygon points="${pts}" fill="${pantalla === 'apagada' ? '#06080C' : '#0B1712'}"/>`
  defs += `<clipPath id="${u}"><polygon points="${pts}"/></clipPath>`
  if (pantalla === 'codigo' || pantalla === 'comando') {
    // Código que sube en el color del agente (verde si corre un comando) y le ilumina la cara
    let lineas = ''
    ;[5, 3, 6, 2, 4, 6, 3, 5, 2, 6, 4, 3].forEach((w, q) => { lineas += `<rect x="${px + 53 + (q % 3) + Math.floor((12 - q % 12) / 6) * 2}" y="${py + 29 + q * 2}" width="${w}" height="1" fill="${pantalla === 'comando' ? P.verde : col}" opacity=".9"/>` })
    b += `<g clip-path="url(#${u})"><g style="animation:subeCodigo ${pantalla === 'comando' ? '.9s' : '1.8s'} linear infinite">${lineas}</g></g>`
    b += `<polygon points="${px + 52},${py + 28} ${px + 52},${py + 42} ${px + 30},${py + 40} ${px + 30},${py + 26}" fill="${col}" style="opacity:.06;animation:luzPantalla 1.6s ease-in-out infinite"/>`
  } else if (pantalla === 'espera') {
    b += `<rect class="fx" x="${px + 58}" y="${py + 31}" width="2" height="6" fill="${P.amarillo}" style="animation:parpadeo 1s step-end infinite"/><rect class="fx" x="${px + 57}" y="${py + 38}" width="2" height="2" fill="${P.amarillo}" style="animation:parpadeo 1s step-end infinite"/>`
  } else if (pantalla === 'listo') {
    b += `<path d="M55 36h2v2h-2zM57 38h2v2h-2zM59 34h2v2h-2zM61 32h2v2h-2z" transform="translate(${px} ${py})" fill="${P.verde}"/>`
  } else if (pantalla === 'cursor') {
    b += `<rect class="fx" x="${px + 55}" y="${py + 38}" width="3" height="1" fill="${col}" style="animation:parpadeo 1s step-end infinite"/>`
  }
  return { b, css, defs }
}

/** Un piso por sesión: el escritorio de Claude y al lado los de sus subagentes. */
function piso({ s, animo, sub }, proyecto, u, { arriba, mini }) {
  const py = 50
  let b = '', css = '', defs = ''
  b += `<rect width="${W}" height="88" fill="url(#${u}l)"/><rect y="88" width="${W}" height="${FH - 88}" fill="#0A0C12"/><rect y="88" width="${W}" height="1" fill="#2A2F40"/><rect y="106" width="${W}" height="1" fill="#0E111A"/>`
  // Lámpara sobre el escritorio de Claude
  b += `<rect x="38" y="0" width="2" height="26" fill="#2A2F40"/><rect x="32" y="26" width="14" height="4" fill="#2A2F40"/><rect x="36" y="30" width="6" height="2" fill="${P.amarillo}"/><polygon points="33,32 45,32 92,112 -14,112" fill="${P.amarillo}" style="opacity:.05;animation:luz 5s ease-in-out infinite"/>`
  // Cartel del piso: proyecto · #tarea · rama
  const cartel = `${proyecto.nombre}${s.tarea ? ` · #${s.tarea}` : ''}${s.rama ? ` · ${s.rama}` : ''}`
  b += `<rect x="8" y="8" width="${Math.min(232, 14 + Math.round(cartel.length * 5.4))}" height="16" rx="2" fill="#0B0E15"/><text x="14" y="20" font-size="10" font-weight="700" fill="#E6E7EB">${escapar(proyecto.nombre)}${s.tarea ? `<tspan fill="${P.amarillo}"> · #${escapar(s.tarea)}</tspan>` : ''}${s.rama ? `<tspan fill="#8B909C" font-weight="400"> · ${escapar(s.rama)}</tspan>` : ''}</text>`
  if (arriba && !mini) {
    // Ventana con cielo nocturno y reloj de pared
    b += `<rect x="262" y="8" width="56" height="34" fill="#262B3A"/><rect x="265" y="11" width="50" height="28" fill="#0A1226"/><rect x="304" y="14" width="5" height="5" fill="#F2D58A"/><rect x="289" y="11" width="2" height="28" fill="#262B3A"/>`
    ;[[270, 16], [280, 30], [298, 33], [310, 28]].forEach(([x, y], i) => { b += `<rect x="${x}" y="${y}" width="1" height="1" fill="#fff" style="animation:titila 2.4s ease-in-out ${-i * 0.5}s infinite"/>` })
    b += `<rect x="330" y="10" width="16" height="16" fill="#262B3A"/><rect x="332" y="12" width="12" height="12" fill="#E9EAEE"/><rect x="337.5" y="13" width="1" height="5" fill="#0B0D12" style="transform-origin:338px 18px;animation:gira 12s steps(12) infinite"/>`
  } else {
    // Un cuadro en la pared de los otros pisos
    b += `<rect x="276" y="12" width="30" height="22" fill="#262B3A"/><rect x="279" y="15" width="24" height="16" fill="#16213A"/><rect x="282" y="24" width="8" height="7" fill="${P.verde}" opacity=".5"/><rect x="289" y="20" width="11" height="11" fill="${P.azul}" opacity=".45"/>`
  }
  const lugar = distribucion(sub.length)
  const { visibles, resto } = subagentesVisibles(sub)
  const pos = {}
  const o = puesto({ animo, color: CLAUDE.color, pj: CLAUDE.pj }, lugar.claude, py, { orq: true, u: u + 'o' })
  b += o.b; css += o.css; defs += o.defs
  b += `<text x="${lugar.claude + 24}" y="122" text-anchor="middle" font-size="10" font-weight="700" fill="${CLAUDE.color}">Claude</text>`
  pos['c-' + s.sesion] = { x: lugar.claude + 24 }
  visibles.forEach((a, i) => {
    const x = lugar.subs[i]
    const r = puesto(a, x, py, { u: u + 'a' + i })
    b += r.b; css += r.css; defs += r.defs
    b += `<text x="${x + 24}" y="122" text-anchor="middle" font-size="10" font-weight="700" fill="${a.color}">${escapar(a.nombre)}</text>`
    pos[a.id] = { x: x + 24 }
  })
  if (resto) b += `<text x="356" y="44" text-anchor="end" font-size="11" fill="#8B909C">+${resto}</text>`
  return { b, css, defs, pos }
}

/**
 * La sala de un proyecto: un piso por sesión. Devuelve el SVG y dónde quedó cada mascota.
 * `mini`: la de un compañero, con un cuadro en lugar de la ventana y el reloj.
 */
export function terrario(proyecto, preparadas, { mini = false } = {}) {
  const u = nuevoId('t')
  let b = '', css = '', defs = '', patrones = ''
  const pos = {}
  preparadas.forEach((prep, f) => {
    const uf = `${u}f${f}`
    const r = piso(prep, proyecto, uf, { arriba: f === 0, mini })
    css += r.css; defs += r.defs
    patrones += `<pattern id="${uf}l" width="16" height="8" patternUnits="userSpaceOnUse"><rect width="16" height="8" fill="#111522"/><rect y="7" width="16" height="1" fill="#151A2A"/><rect x="7" width="1" height="3" fill="#151A2A"/><rect x="15" y="3" width="1" height="4" fill="#151A2A"/></pattern>`
    for (const [id, p] of Object.entries(r.pos)) pos[id] = { x: p.x, piso: f }
    b += `<g transform="translate(0 ${f * FH})">${r.b}</g>`
    if (f > 0) b += `<rect y="${f * FH - 3}" width="${W}" height="5" fill="#1C2130"/><rect y="${f * FH + 2}" width="${W}" height="1" fill="#2A2F40"/>`
  })
  const H = preparadas.length * FH
  const body = `<defs><clipPath id="${u}c"><rect width="${W}" height="${H}" rx="6"/></clipPath>${patrones}${defs}</defs><g clip-path="url(#${u}c)">${b}</g>`
  const alt = `${proyecto.nombre}: ` + preparadas.map(({ s, animo, sub }) => `${s.tarea ? '#' + s.tarea : 'sin tarea'}, Claude ${ANIMO[animo]}${sub.map(a => `, ${a.nombre} ${ANIMO[a.animo]}`).join('')}`).join('; ')
  return { svg: svgDoc(W, H, body, css, escapar(alt)), pos }
}

/** Una línea de la lista; `titulo` (ya escapado) muestra el texto entero al pasar el mouse. */
const L = (h, cl = '', titulo = '') => `<div class="t ${cl}"${titulo ? ` title="${titulo}"` : ''}>${h}</div>`

/** En la lista, un subagente dormido conserva su estado: "listo" o "falló". */
const estadoLista = a => (a.animo === 'durmiendo' ? a.estado : a.animo)

/** La lista de texto debajo del terrario. */
export function lista(proyecto, preparadas, ahoraMs) {
  let h = ''
  preparadas.forEach(({ s, animo, sub }, i) => {
    if (i > 0) h += L('', 'sep')
    const titulo = `<b>${escapar(proyecto.nombre)}</b>` + (s.tarea
      ? `<span class="dim"> · </span><b style="color:${P.amarillo}">#${escapar(s.tarea)}</b><span class="dim"> · ${escapar(s.rama ?? '')}</span>`
      : `<span class="dim"> · ${s.rama ? escapar(s.rama) : 'sin tarea'}</span>`)
    h += L(`<span style="color:${P.crema}">●</span> ${titulo}`)
    h += L(`&nbsp;&nbsp;&nbsp;<b style="color:${P.crema}">Claude</b><span class="dim"> · </span><span style="color:${EST_COL[animo]}">${escapar(textoActividad(s, ahoraMs))}</span>${animo === 'teEspera' ? ` <b style="color:${P.amarillo}">!</b>` : ''}`, '', escapar(s.actividad ?? ''))
    sub.forEach(a => {
      const tipo = a.inventado && a.tipo ? `<span class="dim2"> ${escapar(a.tipo)}</span>` : ''
      h += L(`&nbsp;&nbsp;&nbsp;<span style="color:${a.color}">●</span> <b style="color:${a.color}">${escapar(a.nombre)}</b>${tipo}<span class="dim"> — </span>${escapar(a.tarea)}<span class="dim"> · </span><span style="color:${EST_COL[estadoLista(a)]}">${ESTADO[estadoLista(a)]}</span><span class="dim"> · ${escapar(tiempoSubagente(a, ahoraMs))}</span>`, a.animo === 'durmiendo' ? 'reposo' : '')
    })
  })
  return `<div class="lista">${h}</div>`
}

/** Datos de quien pregunta: nombre, personaje y en qué sesión. */
export function quienPregunta(q) {
  const pj = q.agente ? personajeDeNombre(q.quien) : CLAUDE
  return { ...pj, nombre: q.quien, ses: q.tarea ? `#${q.tarea}` : 'sin tarea' }
}

/**
 * Globo de pregunta (boceto aprobado). Interactivo si la sesión acepta respuestas del widget
 * (`q.responde`); si no, la variante de solo lectura. `ui`: estado de la interacción
 * (selección múltiple, "Otra respuesta", borrador de la llamada y envío en curso).
 * `pos`: dónde quedó cada mascota, para la cola.
 */
export function globo(pendientes, { activa = 0, pos = {}, nuevo = false, ahoraMs, ui = {} }) {
  if (ui.hecho) return globoHecho(ui.hecho, pos, ui.saliendo)
  if (!pendientes.length) return ''
  const i = Math.min(activa, pendientes.length - 1), q = pendientes[i], qn = quienPregunta(q)
  if (ui.plegado) {
    return `<button type="button" class="plegado" data-accion="ver"><b>!</b> ${pendientes.length === 1 ? `${escapar(qn.nombre)} te pregunta algo` : `${pendientes.length} preguntas esperan`} · ver</button>`
  }
  const idMascota = q.agente ?? 'c-' + q.sesion
  const cola = colaGlobo(pos[idMascota]?.x, W)
  const borrador = ui.borradores?.[q.pregunta?.id] ?? {}
  const envio = ui.envios?.[q.pregunta?.id]
  let h = `<div class="globo${nuevo ? ' entra' : ''}" style="--cola:${cola}px" role="dialog" aria-labelledby="g-p" data-globo${q.responde ? ` data-pregunta="${escapar(q.pregunta?.id ?? '')}" data-item="${q.indice}"` : ''}>`
  if (pendientes.length > 1) {
    h += `<div class="g-tabs" role="tablist" aria-label="Preguntas pendientes">${pendientes.map((x, k) => {
      const xq = quienPregunta(x)
      const hecha = !!ui.borradores?.[x.pregunta?.id]?.[x.item.pregunta]
      return `<button type="button" class="g-tab" role="tab" aria-selected="${k === i}" data-accion="tab" data-i="${k}"><span class="punto" style="background:${xq.color}"></span>${escapar(xq.nombre)}${x.item.encabezado ? ` · ${escapar(x.item.encabezado)}` : ''} <span aria-hidden="true">${hecha ? '✓' : '!'}</span></button>`
    }).join('')}</div>`
  }
  h += `<div class="g-cab">${cabeza('teEspera', qn.color, qn.pj, escapar(qn.nombre))}<span class="punto" style="background:${qn.color}"></span><span><b>${escapar(qn.nombre)}</b> te pregunta · ${escapar(qn.ses)} · hace ${escapar(tiempoRelativo(q.desde, ahoraMs))}</span></div>`
  h += `<p class="g-preg" id="g-p">${escapar(q.item.pregunta)}</p>`
  const total = q.pregunta?.items?.length ?? 1
  if (q.item.multiple) h += `<p class="g-modo">Se pueden elegir varias</p>`
  if (q.responde && total > 1 && !envio) h += `<p class="g-modo">Pregunta ${q.indice + 1} de ${total}: se envían juntas</p>`

  const lectura = !q.responde || (envio && envio.estado !== 'enviando')
  const enviando = envio?.estado === 'enviando'
  if (lectura || enviando) {
    h += `<ul class="g-ops">${(q.item.opciones ?? []).map((o, k) => {
      const e = etiquetaOpcion(o.etiqueta)
      return `<li class="op ro${e.recomendada ? ' rec' : ''}${q.item.multiple ? ' multi' : ''}"><span class="n">${k + 1}</span><b>${escapar(e.texto)}${e.recomendada ? '<span class="chip">Recomendada</span>' : ''}</b><small>${escapar(o.descripcion)}</small></li>`
    }).join('')}</ul>`
    let nota = 'Responder en Claude: la sesión espera tu respuesta en su ventana.'
    if (enviando) nota = `Enviando tu respuesta a ${qn.nombre}…`
    else if (envio?.estado === 'enClaude') nota = 'Respondé en Claude: la sesión no tomó la respuesta del widget.'
    else if (envio?.estado === 'yaRespondida') nota = 'Ya se respondió en Claude.'
    h += `<div class="g-pie"><span class="g-nota" role="status">${escapar(nota)}</span></div>`
    return h + `</div>`
  }

  // La selección vale solo para el ítem en el que se marcó
  const sel = ui.seleccionDe === q.clave ? (ui.seleccion ?? new Set()) : new Set()
  // Cada botón lleva su pregunta y su ítem tal como se dibujaron: el clic no depende de la pestaña activa
  const destino = ` data-pregunta="${escapar(q.pregunta?.id ?? '')}" data-item="${q.indice}"`
  const multi = q.item.multiple
  h += `<div class="g-ops">${(q.item.opciones ?? []).map((o, k) => {
    const e = etiquetaOpcion(o.etiqueta)
    const marcada = multi && sel.has(k)
    return `<button type="button" class="op${multi ? ' multi' : ''}${e.recomendada ? ' rec' : ''}" data-accion="op" data-i="${k}"${destino}${multi ? ` aria-pressed="${marcada}"` : ''}><span class="n">${marcada ? '✓' : k + 1}</span><b>${escapar(e.texto)}${e.recomendada ? '<span class="chip">Recomendada</span>' : ''}</b><small>${escapar(o.descripcion)}</small></button>`
  }).join('')}</div>`
  if (ui.otra) h += `<div class="g-otra"><label for="g-otra-in">Tu respuesta</label><input id="g-otra-in" type="text" autocomplete="off" value="${escapar(ui.textoOtra ?? '')}"><button type="button" class="g-btn" data-accion="enviar-otra"${destino}>${ultimo(q, borrador) ? 'Enviar' : 'Seguir'}</button></div>`
  const accion = multi
    ? `<button type="button" class="g-btn" data-accion="enviar-multi"${destino}${sel.size ? '' : ' disabled'}>${ultimo(q, borrador) ? 'Enviar' : 'Seguir'}${sel.size ? ` (${sel.size})` : ''}</button>`
    : `<button type="button" class="g-btn sec" data-accion="tarde">Más tarde</button>`
  h += `<div class="g-pie"><span><button type="button" class="g-link" data-accion="otra">Otra respuesta</button></span>${accion}</div>`
  return h + `</div>`
}

/** ¿Es el único ítem de la llamada que falta responder? Entonces el próximo clic envía. */
function ultimo(q, borrador) {
  const items = q.pregunta?.items ?? [q.item]
  return items.every(it => it.pregunta === q.item.pregunta || borrador[it.pregunta])
}

/** "Listo, le respondiste a …": el globo festeja y se achica. */
function globoHecho(hecho, pos, saliendo) {
  const cola = colaGlobo(pos[hecho.mascota]?.x, W)
  return `<div class="globo entra${saliendo ? ' sale' : ''}" style="--cola:${cola}px" role="status"><div class="g-env">${cabeza(hecho.listo ? 'saluda' : 'esperando', hecho.color, hecho.pj, '')} ${escapar(hecho.mensaje)}</div></div>`
}

/** Aviso plegado cuando la pregunta está en otro proyecto. */
export function avisoOtroProyecto(proyectos, indiceActual) {
  for (let k = 0; k < proyectos.length; k++) {
    if (k === indiceActual) continue
    const pend = preguntasPendientes(proyectos[k])
    if (pend.length) return `<button type="button" class="plegado" data-accion="ir" data-proy="${k}"><b>!</b> ${escapar(pend[0].quien)} te pregunta algo en ${escapar(proyectos[k].nombre)} · ir</button>`
  }
  return ''
}

/** Estado vacío: Claude dormido y un mensaje. */
export function vacio() {
  const sp = sprite('inactiva', CLAUDE.color, CLAUDE.pj, { x: 0, y: 0, s: 3 })
  return `<div class="vacio-w">${svgDoc(72, 84, sp.g, sp.css, 'Claude duerme', 96, 112)}<p class="vacio-t">No hay sesiones de Claude Code abiertas.</p><p class="vacio-s">Cuando abras una, aparece acá con su escritorio y sus subagentes.</p></div>`
}


/** Caras de la tira mini (cabezas recortadas, como en el boceto). */
export function carasMini(caras) {
  return caras.map(c => cabeza(c.animo, c.color, c.pj, escapar(c.nombre))).join('')
}

const nAg = n => `${n} ${n === 1 ? 'agente' : 'agentes'}`
const nSe = n => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`

/** Firma de la ficha de un compañero: si no cambia, no se redibuja. */
export function firmaCompanero(c, ahoraMs) {
  if (!c.principal) return `${c.usuario}|fuera`
  const proyecto = { repo: c.principal.repo, nombre: nombreProyecto(c.principal.repo), sesiones: [c.principal] }
  return `${c.usuario}|${c.sesiones.length}|${firmaTerrario(prepararProyecto(proyecto, ahoraMs))}`
}

/**
 * Habitación plegable de un compañero (boceto: "Campos"): su sesión principal en un terrario
 * chico y la lista de texto debajo. `abierto`: si el usuario la desplegó.
 */
export function companero(c, ahoraMs, abierto) {
  const flecha = '<span class="flecha" aria-hidden="true">▾</span>'
  if (!c.principal) {
    return `<details class="compa" data-usuario="${escapar(c.usuario)}"${abierto ? ' open' : ''}><summary>${cabeza('inactiva', CLAUDE.color, CLAUDE.pj, '')}<span><b>${escapar(c.nombre)}</b><span class="dim"> · fuera</span></span>${flecha}</summary><p class="t dim">Sin sesiones abiertas.</p></details>`
  }
  const s = c.principal
  const proyecto = { repo: s.repo, nombre: nombreProyecto(s.repo), sesiones: [s] }
  const preparadas = prepararProyecto(proyecto, ahoraMs)
  const t = terrario(proyecto, preparadas, { mini: true })
  const donde = `${escapar(proyecto.nombre)}${s.tarea ? ` #${escapar(s.tarea)}` : ''}`
  return `<details class="compa" data-usuario="${escapar(c.usuario)}"${abierto ? ' open' : ''}><summary>${cabeza(preparadas[0].animo, CLAUDE.color, CLAUDE.pj, '')}<span><b>${escapar(c.nombre)}</b><span class="dim"> · ${donde} · ${nSe(c.sesiones.length)} · ${nAg((s.agentes ?? []).length)}</span></span>${flecha}</summary>
    <div class="escena">${t.svg}</div>${lista(proyecto, preparadas, ahoraMs)}</details>`
}

export { cabeza, CLAUDE }
