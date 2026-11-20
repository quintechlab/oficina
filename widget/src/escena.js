// Dibujo del terrario, la lista de texto y el globo de pregunta (boceto aprobado, opción C).
// Arma texto HTML/SVG a partir de los datos reales; todo texto que viene de una sesión se escapa.

import { P, sprite, svgDoc, cabeza, nuevoId } from './mascotas.js'
import {
  animoSesion, animoSubagente, personajeDeNombre, tiempoSubagente, textoActividad,
  preguntasPendientes, etiquetaOpcion, escapar, tiempoRelativo,
} from './logica.js'

export const ANIMO = { pensando: 'pensando', leyendo: 'leyendo', comando: 'ejecutando un comando', editando: 'editando', comiendo: 'comiendo tokens', listo: 'listo', reposo: 'listo', fallo: 'falló', esperando: 'esperando', teEspera: 'esperándote', inactiva: 'sin actividad', saluda: 'saluda' }
const ESTADO = { comando: 'comando', leyendo: 'leyendo', editando: 'editando', comiendo: 'tokens', listo: 'listo', reposo: 'listo', teEspera: 'esperándote', esperando: 'esperando', pensando: 'pensando', inactiva: 'inactiva', fallo: 'falló' }
const EST_COL = { comando: '#F2B632', leyendo: '#7FB3FF', editando: '#E78FB3', comiendo: '#F2B632', listo: '#8FD694', reposo: '#8FD694', teEspera: '#F2B632', esperando: '#9AA0AC', pensando: '#F3EBD8', inactiva: '#5C6270', fallo: '#FF6B6B' }
const CLAUDE = personajeDeNombre('Claude')
const MONO = 'Cascadia Mono, Consolas, monospace'
const W = 364, FH = 182

/** Prioridad para elegir qué subagentes entran en el escritorio cuando no caben todos. */
const ORDEN_ANIMO = { teEspera: 0, comando: 1, leyendo: 1, comiendo: 1, fallo: 2, listo: 3, reposo: 4 }

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

/** Subagentes que se dibujan en un escritorio de ancho `zw`, y cuántos quedan afuera. */
function subagentesVisibles(sub, zw) {
  const cupo = Math.max(0, Math.floor((zw - 60) / 50))
  const orden = [...sub].sort((a, b) => (ORDEN_ANIMO[a.animo] ?? 5) - (ORDEN_ANIMO[b.animo] ?? 5))
  const visibles = new Set(orden.slice(0, cupo).map(a => a.id))
  // Se dibujan en el orden en que fueron lanzados, para que no cambien de lugar
  return { visibles: sub.filter(a => visibles.has(a.id)), resto: Math.max(0, sub.length - cupo) }
}

/** Firma de lo que se ve en el terrario: si no cambia, no se redibuja (y no se cortan las animaciones). */
export function firmaTerrario(preparadas) {
  return preparadas.map(({ s, animo, sub }) => [s.sesion, s.tarea, s.rama, animo, ...sub.map(a => `${a.id}:${a.nombre}:${a.animo}`)].join('|')).join('/')
}

function piso(sesiones, u, f, arriba) {
  const n = sesiones.length, z = W / n
  let css = '', b = '', defs = ''
  const pos = {}
  b += `<rect width="${W}" height="128" fill="url(#${u}l)"/>`
  if (arriba) {
    // Ventana con cielo nocturno y reloj de pared
    b += `<rect x="246" y="14" width="64" height="40" fill="#262B3A"/><rect x="249" y="17" width="58" height="34" fill="#0A1226"/><rect x="294" y="21" width="6" height="4" fill="#F2D58A"/><rect x="295" y="20" width="4" height="6" fill="#F2D58A"/><rect x="277" y="17" width="2" height="34" fill="#262B3A"/><rect x="249" y="33" width="58" height="2" fill="#262B3A"/>`
    ;[[254, 22], [264, 28], [258, 43], [286, 44], [302, 41], [270, 21]].forEach(([x, y], i) => { b += `<rect x="${x}" y="${y}" width="1" height="1" fill="#FFFFFF" style="animation:titila 2.4s ease-in-out ${-i * 0.4}s infinite"/>` })
    b += `<rect x="324" y="14" width="18" height="18" fill="#262B3A"/><rect x="326" y="16" width="14" height="14" fill="#E9EAEE"/><rect x="332" y="22" width="2" height="2" fill="#0B0D12"/><rect x="332.5" y="17" width="1" height="6" fill="#0B0D12" style="transform-origin:333px 23px;animation:gira 12s steps(12) infinite"/>`
  }
  const lx = Math.round(z * 0.42)
  b += `<rect x="${lx + 6}" y="0" width="2" height="8" fill="#2A2F40"/><rect x="${lx}" y="8" width="14" height="4" fill="#2A2F40"/><rect x="${lx + 4}" y="12" width="6" height="2" fill="${P.amarillo}"/>`
  b += `<polygon points="${lx + 1},14 ${lx + 13},14 ${lx + 80},156 ${lx - 66},156" fill="${P.amarillo}" opacity=".06" style="animation:luz 5s ease-in-out infinite"/>`
  ;[[10, 60], [30, 90], [-6, 108], [40, 40]].forEach(([x, y], i) => { b += `<rect x="${lx + x}" y="${y}" width="1" height="1" fill="${P.amarillo}" style="animation:mota 6s ease-in-out ${-i * 1.5}s infinite"/>` })
  for (let k = 1; k < n; k++) b += `<rect x="${Math.round(k * z) - 2}" y="0" width="5" height="128" fill="#0C0F18"/>`
  b += `<rect y="128" width="${W}" height="${FH - 128}" fill="#0A0C12"/><rect y="128" width="${W}" height="1" fill="#2A2F40"/><rect y="146" width="${W}" height="1" fill="#0E111A"/><rect y="164" width="${W}" height="1" fill="#0E111A"/>`
  const pets = []
  sesiones.forEach(({ s, animo, sub }, k) => {
    const ox = Math.round(k * z), zw = Math.round(z), dx0 = ox + 50, dw = zw - 58
    const { visibles, resto } = subagentesVisibles(sub, zw)
    b += `<rect x="${ox + 8}" y="136" width="${zw - 16}" height="20" fill="${k % 2 ? P.azul : P.amarillo}" opacity=".05"/>`
    // Biblioteca detrás de cada subagente que lee
    visibles.forEach((a, i) => {
      if (a.animo !== 'leyendo') return
      const bx = ox + 56 + i * 50
      b += `<rect x="${bx + 4}" y="58" width="40" height="80" fill="#262B3A"/><rect x="${bx + 7}" y="61" width="34" height="74" fill="#141826"/>`
      ;[82, 106, 130].forEach((y, j) => {
        b += `<rect x="${bx + 7}" y="${y}" width="34" height="3" fill="#262B3A"/>`
        let x = bx + 9
        ;[[P.rosa, 4, 16], [P.azul, 3, 14], [P.verde, 5, 18], [P.amarillo, 3, 15], [P.crema, 4, 17], ['#6B7180', 3, 13]].forEach(([c, w, h], q) => {
          if (!(j === 1 && q === 2)) b += `<rect x="${x}" y="${y - h + ((q + j) % 3)}" width="${w}" height="${h - ((q + j) % 3)}" fill="${c}" opacity=".85"/>`
          x += w + 1
        })
      })
    })
    // Escritorio y monitor con la tarea y el tipo de rama
    b += `<rect x="${dx0}" y="112" width="${dw}" height="4" fill="#3A3F52"/><rect x="${dx0}" y="116" width="${dw}" height="2" fill="#262B3A"/><rect x="${dx0 + 4}" y="118" width="3" height="20" fill="#262B3A"/><rect x="${dx0 + dw - 7}" y="118" width="3" height="20" fill="#262B3A"/>`
    const mx = dx0 + Math.round(dw / 2) - 27
    b += `<rect x="${mx + 24}" y="104" width="8" height="8" fill="#262B3A"/><rect x="${mx}" y="72" width="54" height="32" fill="#1E2333"/><rect x="${mx + 2}" y="74" width="50" height="28" fill="#0A1510"/>`
    const tipoRama = s.rama ? escapar(s.rama.split('/')[0]).slice(0, 8) : ''
    b += `<text x="${mx + 5}" y="84" font-family="${MONO}" font-size="7.5" fill="${P.verde}">${s.tarea ? '#' + escapar(s.tarea) : '~'}</text><text x="${mx + 5}" y="95" font-family="${MONO}" font-size="6.5" fill="${P.amarillo}">${tipoRama}</text>`
    const pregunta = animo === 'teEspera' || sub.some(a => a.animo === 'teEspera')
    const activo = !pregunta && (animo === 'editando' || animo === 'comando' || sub.some(a => ['comando', 'comiendo', 'leyendo'].includes(a.animo)))
    if (activo) {
      defs += `<clipPath id="${u}p${f}_${k}"><rect x="${mx + 28}" y="76" width="22" height="24"/></clipPath>`
      let bar = ''
      ;[14, 9, 18, 6, 12, 16, 14, 9, 18, 6, 12, 16].forEach((w, q) => { bar += `<rect x="${mx + 29}" y="${78 + q * 3}" width="${w}" height="1" fill="${P.verde}" opacity=".7"/>` })
      b += `<g clip-path="url(#${u}p${f}_${k})"><g style="animation:sube 1.8s linear infinite">${bar}</g></g>`
    }
    if (!activo && !pregunta && sub.some(a => a.estado === 'listo')) [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [5, 1], [6, 0]].forEach(([q, j]) => { b += `<rect x="${mx + 30 + q * 2}" y="${80 + j * 2}" width="2" height="2" fill="${P.verde}"/>` })
    if (pregunta) b += `<rect class="fx" x="${mx + 38}" y="78" width="3" height="12" fill="${P.amarillo}" style="animation:parpadeo 1s step-end infinite"/><rect class="fx" x="${mx + 38}" y="93" width="3" height="3" fill="${P.amarillo}" style="animation:parpadeo 1s step-end infinite"/>`
    if (animo === 'inactiva') b += `<text x="${mx + 34}" y="92" font-family="${MONO}" font-size="9" fill="#5C6270">z z</text>`
    // Taza humeante en el primer escritorio de la planta baja
    if (k === 0 && arriba) b += `<rect x="${dx0 + dw - 22}" y="105" width="6" height="7" fill="#E9EAEE"/><rect x="${dx0 + dw - 16}" y="107" width="2" height="3" fill="#E9EAEE"/><rect class="fx" x="${dx0 + dw - 20}" y="101" width="1" height="2" fill="#9AA0AC" style="opacity:0;animation:humo 2s ease-out infinite"/><rect class="fx" x="${dx0 + dw - 18}" y="100" width="1" height="2" fill="#9AA0AC" style="opacity:0;animation:humo 2s ease-out -1s infinite"/>`
    if (resto) b += `<text x="${ox + zw - 10}" y="150" text-anchor="end" font-family="${MONO}" font-size="9" fill="#8B909C">+${resto}</text>`
    pets.push(['c-' + s.sesion, animo, CLAUDE.color, CLAUDE.pj, ox + 4, 92, 'Claude'])
    visibles.forEach((a, i) => pets.push([a.id, a.animo, a.color, a.pj, ox + 56 + i * 50, 98, a.nombre]))
  })
  pets.forEach(([id, a, c, pj, x, y, nm]) => {
    const sp = sprite(a, c, pj, { x, y, s: 2 })
    css += sp.css
    b += sp.g
    b += `<text x="${x + 24}" y="174" text-anchor="middle" font-size="10" font-weight="700" fill="${c}"${a === 'reposo' ? ' opacity=".55"' : ''}>${escapar(nm)}</text>`
    pos[id] = { x: x + 24 }
  })
  return { b, css, defs, pos }
}

/** El terrario de un proyecto: un piso cada 2 sesiones. Devuelve el SVG y dónde quedó cada mascota. */
export function terrario(proyecto, preparadas) {
  const u = nuevoId('t'), pisos = []
  for (let i = 0; i < preparadas.length; i += 2) pisos.push(preparadas.slice(i, i + 2))
  let b = '', css = '', defs = ''
  const pos = {}
  pisos.forEach((ses, f) => {
    const r = piso(ses, u, f, f === 0)
    css += r.css; defs += r.defs
    for (const [id, p] of Object.entries(r.pos)) pos[id] = { x: p.x, piso: f }
    b += `<g transform="translate(0 ${f * FH})">${r.b}</g>`
    if (f > 0) b += `<rect y="${f * FH - 3}" width="${W}" height="5" fill="#1C2130"/><rect y="${f * FH + 2}" width="${W}" height="1" fill="#2A2F40"/>`
  })
  const H = pisos.length * FH
  const body = `<defs><clipPath id="${u}c"><rect width="${W}" height="${H}" rx="8"/></clipPath><pattern id="${u}l" width="16" height="8" patternUnits="userSpaceOnUse"><rect width="16" height="8" fill="#111522"/><rect y="7" width="16" height="1" fill="#151A2A"/><rect x="7" width="1" height="3" fill="#151A2A"/><rect x="15" y="3" width="1" height="4" fill="#151A2A"/></pattern>${defs}</defs><g clip-path="url(#${u}c)">${b}</g>`
  const alt = `${proyecto.nombre}: ` + preparadas.map(({ s, animo, sub }) => `${s.tarea ? '#' + s.tarea : 'sin tarea'}, Claude ${ANIMO[animo]}${sub.map(a => `, ${a.nombre} ${ANIMO[a.animo]}`).join('')}`).join('; ')
  return { svg: svgDoc(W, H, body, css, escapar(alt)), pos }
}

/** Una línea de la lista; `titulo` (ya escapado) muestra el texto entero al pasar el mouse. */
const L = (h, cl = '', titulo = '') => `<div class="t ${cl}"${titulo ? ` title="${titulo}"` : ''}>${h}</div>`

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
      h += L(`&nbsp;&nbsp;&nbsp;<span style="color:${a.color}">●</span> <b style="color:${a.color}">${escapar(a.nombre)}</b>${tipo}<span class="dim"> — </span>${escapar(a.tarea)}<span class="dim"> · </span><span style="color:${EST_COL[a.animo]}">${ESTADO[a.animo]}</span><span class="dim"> · ${escapar(tiempoSubagente(a, ahoraMs))}</span>`, a.animo === 'reposo' ? 'reposo' : '')
    })
  })
  return `<div class="lista">${h}</div>`
}

/** Datos de quien pregunta: nombre, personaje y en qué sesión. */
function quienPregunta(q) {
  const pj = q.agente ? personajeDeNombre(q.quien) : CLAUDE
  return { ...pj, nombre: q.quien, ses: q.tarea ? `#${q.tarea}` : 'sin tarea' }
}

/**
 * Globo de pregunta, variante de solo lectura (responder desde el widget es la tarea #4).
 * `activa`: índice de la pestaña elegida; `pos`: dónde quedó cada mascota, para la cola.
 */
export function globo(pendientes, { activa = 0, pos = {}, nuevo = false, ahoraMs }) {
  if (!pendientes.length) return ''
  const i = Math.min(activa, pendientes.length - 1), q = pendientes[i], qn = quienPregunta(q)
  const idMascota = q.agente ?? 'c-' + q.sesion
  const cola = Math.max(14, Math.min(330, (pos[idMascota]?.x ?? 40) - 6))
  let h = `<div class="globo${nuevo ? ' entra' : ''}" style="--cola:${cola}px" role="dialog" aria-labelledby="g-p">`
  if (pendientes.length > 1) {
    h += `<div class="g-tabs" role="tablist" aria-label="Preguntas pendientes">${pendientes.map((x, k) => {
      const xq = quienPregunta(x)
      return `<button type="button" class="g-tab" role="tab" aria-selected="${k === i}" data-accion="tab" data-i="${k}"><span class="punto" style="background:${xq.color}"></span>${escapar(xq.nombre)}${x.item.encabezado ? ` · ${escapar(x.item.encabezado)}` : ''} <span aria-hidden="true">!</span></button>`
    }).join('')}</div>`
  }
  h += `<div class="g-cab">${cabeza('teEspera', qn.color, qn.pj, escapar(qn.nombre))}<span class="punto" style="background:${qn.color}"></span><span><b>${escapar(qn.nombre)}</b> te pregunta · ${escapar(qn.ses)} · hace ${escapar(tiempoRelativo(q.desde, ahoraMs))}</span></div>`
  h += `<p class="g-preg" id="g-p">${escapar(q.item.pregunta)}</p>`
  if (q.item.multiple) h += `<p class="g-modo">Se pueden elegir varias</p>`
  h += `<ul class="g-ops">${(q.item.opciones ?? []).map((o, k) => {
    const e = etiquetaOpcion(o.etiqueta)
    return `<li class="op ro${e.recomendada ? ' rec' : ''}${q.item.multiple ? ' multi' : ''}"><span class="n">${k + 1}</span><b>${escapar(e.texto)}${e.recomendada ? '<span class="chip">Recomendada</span>' : ''}</b><small>${escapar(o.descripcion)}</small></li>`
  }).join('')}</ul>`
  // TODO(#4): responder desde el globo (opciones como botones, "Otra respuesta", "Más tarde").
  h += `<div class="g-pie"><span class="g-nota">Responder en Claude: la sesión espera tu respuesta en su ventana.</span></div>`
  return h + `</div>`
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

export { cabeza, CLAUDE }
