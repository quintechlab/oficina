// Tablero del estilo Avis (docs/diseno/estilo-avis-ux.md, opción A): barra de proyectos,
// cuadros de conteo, tarjetas de sesión con sus fichas de subagente, equipo y globo de pregunta.
// Arma texto HTML/SVG a partir de los datos reales; todo texto que viene de una sesión se escapa.
// F1: las mascotas pixel de hoy ocupan, provisoriamente, el lugar de los Avis (llegan en F3).

import { sprite, svgDoc, cabeza } from './mascotas.js'
import { colaGlobo } from './tamano.js'
import { animoVisual, distribucion } from './sala.js'
import {
  animoSesion, animoSubagente, personajeDeNombre, tiempoSubagente, textoActividad,
  preguntasPendientes, etiquetaOpcion, escapar, tiempoRelativo, nombreProyecto, FUERA_DE_REPO,
} from './logica.js'

export const ANIMO = { coordinando: 'coordinando el equipo', durmiendo: 'durmiendo', escribiendo: 'escribiendo en la notebook', pensando: 'pensando', leyendo: 'leyendo', comando: 'ejecutando un comando', editando: 'editando', comiendo: 'comiendo tokens', listo: 'listo', reposo: 'listo', fallo: 'falló', esperando: 'esperando', teEspera: 'esperándote', inactiva: 'sin actividad', saluda: 'saluda' }
/** Estado de un subagente en su ficha. */
const ESTADO = { coordinando: 'coordinando', escribiendo: 'escribiendo', comando: 'comando', leyendo: 'leyendo', editando: 'editando', comiendo: 'escribiendo', listo: 'listo', reposo: 'listo', teEspera: 'esperándote', esperando: 'esperando', pensando: 'pensando', inactiva: 'inactiva', fallo: 'falló' }
const CLAUDE = personajeDeNombre('Claude')
/** Ancho de referencia del globo, para la cola (el globo cambia de forma en F2). */
const W = 364

/** Prioridad para elegir qué subagentes tienen ficha cuando no entran todos. */
const ORDEN_ANIMO = { teEspera: 0, comando: 1, leyendo: 1, escribiendo: 1, comiendo: 1, fallo: 2, listo: 3, durmiendo: 4 }

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

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

/**
 * Subagentes con ficha (hasta 4), los que quedan afuera y cuántos son ("+n"). Se eligen por
 * prioridad (pregunta, trabajo, falló, listo, durmiendo) y se muestran en el orden en que se
 * lanzaron, para que no salten de lugar.
 */
export function subagentesVisibles(sub) {
  const { subs } = distribucion(sub.length)
  const orden = [...sub].sort((a, b) => (ORDEN_ANIMO[a.animo] ?? 5) - (ORDEN_ANIMO[b.animo] ?? 5))
  const elegidos = new Set(orden.slice(0, subs.length).map(a => a.id))
  const ocultos = sub.filter(a => !elegidos.has(a.id))
  return { visibles: sub.filter(a => elegidos.has(a.id)), ocultos, resto: ocultos.length }
}

/** Firma de lo que se ve de las sesiones: si no cambia, no se redibuja (y no se cortan las animaciones). */
export function firmaTerrario(preparadas) {
  return preparadas.map(({ s, animo, sub }) => [s.sesion, s.tarea, s.rama, animo, ...sub.map(a => `${a.id}:${a.nombre}:${a.animo}`)].join('|')).join('/')
}

/** Color de la línea de estado y del estado de un subagente (dirección, tabla 5.4). */
export function colorEstado(animo) {
  switch (animo) {
    case 'teEspera': case 'coordinando': case 'editando': case 'comando': case 'escribiendo': case 'comiendo': return 'var(--ambar)'
    case 'leyendo': return 'var(--celeste)'
    case 'inactiva': case 'durmiendo': return 'var(--tenue)'
    case 'listo': case 'reposo': return 'var(--verde)'
    case 'fallo': return 'var(--rojo)'
    default: return 'var(--crema)'
  }
}

/**
 * Provisorio hasta los Avis (F3): la mascota pixel de hoy en el lugar del Avi, de `alto` px.
 * De 48 px para arriba va el cuerpo entero; más chica, la cabeza recortada.
 */
function mascota(animo, { color, pj }, alto, alt = '') {
  const a = animoVisual(animo)
  if (alto < 48) return cabeza(a, color, pj, alt)
  const sp = sprite(a, color, pj, { s: 1 })
  return svgDoc(24, 28, sp.g, sp.css, alt, Math.round(alto * 24 / 28), alto)
}

/** Lugar del Avi: decorativo (`aria-hidden`) salvo que se pase `alt` (la marca y el vacío). */
function avi(animo, pj, alto, alt = '') {
  return `<span class="avi" style="--t:${alto}px"${alt ? '' : ' aria-hidden="true"'}>${mascota(animo, pj, alto, escapar(alt))}</span>`
}

// ------------------------------------------------------------------ barra lateral

/** Iniciales del ícono: la primera letra de cada una de las dos primeras palabras. */
export function iniciales(nombre) {
  if (nombre === FUERA_DE_REPO) return '·'
  return String(nombre ?? '').split(/[-_\s]+/).filter(Boolean).slice(0, 2).map(p => [...p][0]).join('')
}

/** Paleta de los íconos de proyecto, en el orden de la dirección. */
export const COLORES_PROYECTO = ['var(--ambar)', 'var(--celeste)', 'var(--violeta)', 'var(--verde)', 'var(--rosa)']
/** Personajes de los nombres fuera del elenco, en el orden de `SUBAGENTES` de logica.js. */
const PJ_POR_HUELLA = ['gata', 'raton', 'brote', 'mono', 'cuernos']

/**
 * Color fijo del ícono de un proyecto. `huella()` no se exporta de logica.js: se reutiliza a
 * través de `personajeDeNombre`, cuyo personaje (fuera del elenco) es `huella(nombre) % 5`.
 */
export function colorProyecto(nombre) {
  const k = PJ_POR_HUELLA.indexOf(personajeDeNombre(nombre).pj)
  return COLORES_PROYECTO[Math.max(0, k)]
}

/** Estado de la marca: pregunta en cualquier proyecto, si no coordinando, si no esperando. */
export function animoMarca(proyectos, ahoraMs) {
  const ses = proyectos.flatMap(p => p.sesiones)
  if (!ses.length) return 'durmiendo'
  if (proyectos.some(p => preguntasPendientes(p).length)) return 'teEspera'
  if (ses.some(s => animoSesion(s, ahoraMs) === 'coordinando')) return 'coordinando'
  return 'esperando'
}

/** "4 sesiones abiertas" debajo de "Oficina". */
export function estadoMarca(n) {
  return plural(n, 'sesión abierta', 'sesiones abiertas')
}

/** El Avi de la marca: está solo, así que lleva nombre y estado. */
export function figuraMarca(animo) {
  return avi(animo, CLAUDE, 56, `Claude, ${ANIMO[animo] ?? animo}`)
}

/** Una fila por proyecto (reemplaza a ◀ ▶). `i`: el proyecto activo. */
export function barraProyectos(proyectos, i) {
  return proyectos.map((p, k) => {
    const pend = preguntasPendientes(p).length
    const chip = pend
      ? `<span class="chip chip-preg" aria-label="${plural(pend, 'pregunta pendiente', 'preguntas pendientes')}">${pend} ?</span>`
      : `<span class="chip" aria-label="${plural(p.sesiones.length, 'sesión', 'sesiones')}">${p.sesiones.length}</span>`
    const activo = k === i
    return `<button type="button" class="pj${activo ? ' activo' : ''}"${activo ? ' aria-current="true"' : ''} data-accion="ir" data-proy="${k}" title="${escapar(p.repo ?? p.nombre)}"><span class="pj-ic" style="--c:${colorProyecto(p.nombre)}" aria-hidden="true">${escapar(iniciales(p.nombre))}</span><span class="pj-n">${escapar(p.nombre)}</span>${chip}</button>`
  }).join('')
}

// ------------------------------------------------------------------ columna principal

/** Los números de los cuadros de conteo, de datos que ya existen. */
export function conteos(preparadas, ahoraMs) {
  const subs = preparadas.flatMap(p => p.sub)
  const masVieja = preparadas.map(p => p.s.inicio).filter(i => i && !Number.isNaN(Date.parse(i)))
    .reduce((a, b) => (a === null || Date.parse(b) < Date.parse(a) ? b : a), null)
  return {
    trabajando: subs.filter(a => a.estado === 'trabajando').length,
    terminados: subs.filter(a => a.estado === 'listo' || a.estado === 'fallo').length,
    fallidos: subs.filter(a => a.estado === 'fallo').length,
    tiempo: masVieja ? tiempoRelativo(masVieja, ahoraMs) : '—',
    rotuloTiempo: preparadas.length === 1 ? 'lleva la sesión' : 'la más larga',
  }
}

/** "1 sesión · 3 subagentes trabajando", o "… · te hace una pregunta" si alguna sesión pregunta. */
export function lineaEncabezado(preparadas, c) {
  const n = plural(preparadas.length, 'sesión', 'sesiones')
  if (preparadas.some(p => (p.s.preguntas ?? []).length)) return `${n} · te hace una pregunta`
  if (c.trabajando) return `${n} · ${plural(c.trabajando, 'subagente trabajando', 'subagentes trabajando')}`
  return n
}

/** Los tres cuadros de conteo: trabajando, terminados y tiempo. La cifra es texto real. */
export function cuadros(c) {
  const cuadro = (color, cifra, rotulo, aria, extra = '') =>
    `<div class="stat" role="group" aria-label="${escapar(aria)}"><i class="ico" style="--c:${color}" aria-hidden="true"></i><b aria-hidden="true">${escapar(cifra)}</b><small aria-hidden="true">${escapar(rotulo)}</small>${extra}</div>`
  const error = c.fallidos ? `<span class="stat-error" aria-hidden="true">${c.fallidos} con error</span>` : ''
  return cuadro('var(--ambar)', String(c.trabajando), 'trabajando', plural(c.trabajando, 'subagente trabajando', 'subagentes trabajando'))
    + cuadro('var(--verde)', String(c.terminados), 'terminados', plural(c.terminados, 'subagente terminado', 'subagentes terminados') + (c.fallidos ? `, ${c.fallidos} con error` : ''), error)
    + cuadro('var(--violeta)', c.tiempo, c.rotuloTiempo, `${c.rotuloTiempo === 'lleva la sesión' ? 'La sesión lleva' : 'La sesión más larga lleva'} ${c.tiempo}`)
}

/** Un subagente dormido conserva su estado: "listo" o "falló". */
const estadoLista = a => (a.animo === 'durmiendo' ? a.estado : a.animo)
const textoEstado = a => ESTADO[estadoLista(a)] ?? estadoLista(a)

/** Título y nombre accesible del "+n": quiénes quedan afuera, con su tarea y su estado. */
export function textoMas(ocultos) {
  return `${plural(ocultos.length, 'subagente más', 'subagentes más')}: ` + ocultos.map(a => `${a.nombre} — ${a.tarea} (${textoEstado(a)})`).join('; ')
}

/** Ficha de un subagente. Dormido se atenúa solo la mascota, nunca el texto. */
function ficha(a, ahoraMs) {
  const tipo = a.inventado && a.tipo ? `<span>${escapar(a.tipo)}</span>` : ''
  return `<li class="sub${a.animo === 'durmiendo' ? ' dorm' : ''}" style="--c:${a.color};--ce:${colorEstado(estadoLista(a))}">${avi(a.animo, a, 56)}<b>${escapar(a.nombre)}${tipo}</b><small title="${escapar(a.tarea)}">${escapar(a.tarea)}</small><span class="est">${escapar(textoEstado(a))} · ${escapar(tiempoSubagente(a, ahoraMs))}</span></li>`
}

/**
 * Tarjeta de una sesión. El dato no trae el título de la tarea: hasta que se decida (dirección
 * 4.4) el título es la rama, y la línea mono de la rama no se repite.
 */
function tarjeta({ s, animo, sub }, ahoraMs) {
  const tag = s.tarea ? `<span class="tag">#${escapar(s.tarea)}</span>` : '<span class="tag sin">sin tarea</span>'
  const titulo = s.rama ? `<b${s.tarea ? '' : ' class="sin"'}>${escapar(s.rama)}</b>` : ''
  const lleva = s.inicio ? `<span class="lleva"><span class="oculto">lleva </span>${escapar(tiempoRelativo(s.inicio, ahoraMs))}</span>` : ''
  let h = `<article class="ses"><div class="ses-top">${avi(animo, CLAUDE, 84)}<div class="ses-t">`
  h += `<h3 class="ses-tit">${tag}${titulo}</h3>`
  h += `<p class="linea" style="--c:${colorEstado(animo)}" title="${escapar(s.actividad ?? '')}"><span class="pt" aria-hidden="true"></span>${escapar(textoActividad(s, ahoraMs))}</p>`
  h += `</div>${lleva}</div>`
  if (sub.length) {
    const { visibles, ocultos, resto } = subagentesVisibles(sub)
    const mas = resto ? `<li class="mas" title="${escapar(textoMas(ocultos))}" aria-label="${escapar(textoMas(ocultos))}">+${resto}</li>` : ''
    h += `<ul class="subs" aria-label="Subagentes">${visibles.map(a => ficha(a, ahoraMs)).join('')}${mas}</ul>`
  }
  return h + '</article>'
}

/** Las tarjetas de sesión del proyecto, en el orden de `agruparPorProyecto`. */
export function sesiones(preparadas, ahoraMs) {
  return preparadas.map(p => tarjeta(p, ahoraMs)).join('')
}

/** El Avi del vacío (`durmiendo`) o de la carga (`esperando`): está solo, lleva nombre. */
export function figuraVacio(animo) {
  return avi(animo, CLAUDE, 112, `Claude, ${ANIMO[animo] ?? animo}`)
}

/** Caras de la tira mini (cabezas recortadas, como en el boceto). */
export function carasMini(caras) {
  return caras.map(c => cabeza(c.animo, c.color, c.pj, escapar(c.nombre))).join('')
}

// ------------------------------------------------------------------ equipo

/** Firma de la ficha de un compañero: si no cambia, no se redibuja. */
export function firmaCompanero(c, ahoraMs) {
  if (!c.principal) return `${c.usuario}|fuera`
  const proyecto = { repo: c.principal.repo, nombre: nombreProyecto(c.principal.repo), sesiones: [c.principal] }
  return `${c.usuario}|${c.sesiones.length}|${firmaTerrario(prepararProyecto(proyecto, ahoraMs))}`
}

/**
 * Un compañero en el pie de la barra: sus iniciales, el nombre y dónde está. Desplegado muestra
 * una fila compacta de su sesión principal. `abierto`: si el usuario lo desplegó.
 */
export function companero(c, ahoraMs, abierto) {
  const ini = `<span class="ini" aria-hidden="true">${escapar(iniciales(c.nombre))}</span>`
  const flecha = '<span class="flecha" aria-hidden="true">▾</span>'
  const abre = `<details class="compa" data-usuario="${escapar(c.usuario)}"${abierto ? ' open' : ''}>`
  if (!c.principal) {
    return `${abre}<summary>${ini}<span class="compa-t"><b>${escapar(c.nombre)}</b><small>fuera</small></span>${flecha}</summary><p class="compa-nada">Sin sesiones abiertas.</p></details>`
  }
  const s = c.principal
  const proyecto = { repo: s.repo, nombre: nombreProyecto(s.repo), sesiones: [s] }
  const [{ animo, sub }] = prepararProyecto(proyecto, ahoraMs)
  const donde = `en ${proyecto.nombre} · hace ${tiempoRelativo(s.actualizado ?? c.actualizado, ahoraMs)}`
  const { visibles, ocultos, resto } = subagentesVisibles(sub)
  const cabezas = visibles.map(a => avi(a.animo, a, 24)).join('') + (resto ? `<span class="mas-c" title="${escapar(textoMas(ocultos))}">+${resto}</span>` : '')
  const fila = `<div class="fila">${avi(animo, CLAUDE, 32)}<div class="fila-t"><b>${s.tarea ? `#${escapar(s.tarea)} ` : ''}${escapar(s.rama ?? 'sin rama')}</b><p class="linea" style="--c:${colorEstado(animo)}" title="${escapar(s.actividad ?? '')}"><span class="pt" aria-hidden="true"></span>${escapar(textoActividad(s, ahoraMs))}</p></div>${cabezas ? `<span class="cabezas">${cabezas}</span>` : ''}</div>`
  return `${abre}<summary>${ini}<span class="compa-t"><b>${escapar(c.nombre)}</b><small>${escapar(donde)}</small></span>${flecha}</summary>${fila}</details>`
}

// ------------------------------------------------------------------ globo de pregunta (F2 cambia su forma)

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

export { cabeza, CLAUDE }
