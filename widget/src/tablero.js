// Tablero del estilo Avis (docs/diseno/estilo-avis-ux.md, opción A): barra de proyectos,
// encabezado, cuadros de conteo, tarjetas de sesión con sus fichas de subagente, equipo, vacío y
// tira mini. Arma texto HTML a partir de los datos reales; todo texto que viene de una sesión se escapa.

import { avi, CLAUDE } from './avis.js'
import {
  animoSesion, animoSubagente, personajeDeNombre, tiempoSubagente, textoActividad,
  preguntasPendientes, escapar, tiempoRelativo, nombreProyecto, FUERA_DE_REPO,
} from './logica.js'

/** Nombre accesible del estado de un Avi que está solo (la marca y el vacío): "Claude, durmiendo". */
export const ANIMO = { coordinando: 'coordinando el equipo', durmiendo: 'durmiendo', escribiendo: 'escribiendo en la notebook', pensando: 'pensando', leyendo: 'leyendo', comando: 'ejecutando un comando', editando: 'editando', comiendo: 'comiendo tokens', listo: 'listo', reposo: 'listo', fallo: 'falló', esperando: 'esperando', teEspera: 'esperándote', inactiva: 'sin actividad', saluda: 'saluda' }
/** Estado de un subagente en su ficha. */
const ESTADO = { coordinando: 'coordinando', escribiendo: 'escribiendo', comando: 'comando', leyendo: 'leyendo', editando: 'editando', comiendo: 'escribiendo', listo: 'listo', reposo: 'listo', teEspera: 'esperándote', esperando: 'esperando', pensando: 'pensando', inactiva: 'inactiva', fallo: 'falló' }

/** Subagentes con ficha en una tarjeta de sesión; los demás se cuentan como "+n". */
export const MAX_SUBAGENTES_VISIBLES = 4
/** Prioridad para elegir qué subagentes tienen ficha cuando no entran todos. */
const ORDEN_ANIMO = { teEspera: 0, comando: 1, leyendo: 1, escribiendo: 1, comiendo: 1, fallo: 2, listo: 3, durmiendo: 4 }
/** Avis por tarjeta de sesión (Claude y sus fichas), para el desfase de la respiración. */
const AVIS_POR_TARJETA = MAX_SUBAGENTES_VISIBLES + 1

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/** "Delfina, Ramiro e Inés": una lista de nombres en castellano ("e" antes del sonido i). */
function listaNombres(nombres) {
  if (nombres.length < 2) return nombres.join('')
  const ultimo = nombres[nombres.length - 1]
  const y = /^h?[ií]/i.test(ultimo) && !/^h?[ií][aeouáéó]/i.test(ultimo) ? 'e' : 'y'
  return `${nombres.slice(0, -1).join(', ')} ${y} ${ultimo}`
}

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
 * Subagentes con ficha (hasta MAX_SUBAGENTES_VISIBLES), los que quedan afuera y cuántos son
 * ("+n"). Se eligen por prioridad (pregunta, trabajo, falló, listo, durmiendo) y se muestran en
 * el orden en que se lanzaron, para que no salten de lugar.
 */
export function subagentesVisibles(sub) {
  const orden = [...sub].sort((a, b) => (ORDEN_ANIMO[a.animo] ?? 5) - (ORDEN_ANIMO[b.animo] ?? 5))
  const elegidos = new Set(orden.slice(0, MAX_SUBAGENTES_VISIBLES).map(a => a.id))
  const ocultos = sub.filter(a => !elegidos.has(a.id))
  return { visibles: sub.filter(a => elegidos.has(a.id)), ocultos, resto: ocultos.length }
}

/** Firma de lo que se ve de las sesiones: si no cambia, no se redibuja (y no se cortan las animaciones). */
export function firmaTablero(preparadas) {
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

/** El Avi de Claude de 38 de la marca (4.2): está solo, así que lleva nombre y estado. */
export function figuraMarca(animo) {
  return avi(CLAUDE, animo, 38, { alt: `Claude, ${ANIMO[animo] ?? animo}` })
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

/** Ficha de un subagente con su Avi de 40. Dormido se atenúa solo el Avi, nunca el texto. */
function ficha(a, ahoraMs, indice) {
  const tipo = a.inventado && a.tipo ? `<span>${escapar(a.tipo)}</span>` : ''
  return `<li class="sub${a.animo === 'durmiendo' ? ' dorm' : ''}" style="--c:${a.color};--ce:${colorEstado(estadoLista(a))}">${avi(a, a.animo, 40, { indice })}<b>${escapar(a.nombre)}${tipo}</b><small title="${escapar(a.tarea)}">${escapar(a.tarea)}</small><span class="est">${escapar(textoEstado(a))} · ${escapar(tiempoSubagente(a, ahoraMs))}</span></li>`
}

/**
 * Tarjeta de una sesión: el Avi de Claude de 56 en el estado de la sesión. El dato no trae el
 * título de la tarea: hasta que se decida (dirección 4.4) el título es la rama, y la línea mono
 * de la rama no se repite. `k`: posición de la tarjeta (desfase de los Avis).
 */
function tarjeta({ s, animo, sub }, ahoraMs, k) {
  const base = k * AVIS_POR_TARJETA
  const tag = s.tarea ? `<span class="tag">#${escapar(s.tarea)}</span>` : '<span class="tag sin">sin tarea</span>'
  const titulo = s.rama ? `<b${s.tarea ? '' : ' class="sin"'}>${escapar(s.rama)}</b>` : ''
  const lleva = s.inicio ? `<span class="lleva"><span class="oculto">lleva </span>${escapar(tiempoRelativo(s.inicio, ahoraMs))}</span>` : ''
  let h = `<article class="ses"><div class="ses-top">${avi(CLAUDE, animo, 56, { indice: base })}<div class="ses-t">`
  h += `<h3 class="ses-tit">${tag}${titulo}</h3>`
  h += `<p class="linea" style="--c:${colorEstado(animo)}" title="${escapar(s.actividad ?? '')}"><span class="pt" aria-hidden="true"></span>${escapar(textoActividad(s, ahoraMs))}</p>`
  h += `</div>${lleva}</div>`
  if (sub.length) {
    const { visibles, ocultos, resto } = subagentesVisibles(sub)
    const mas = resto ? `<li class="mas" title="${escapar(textoMas(ocultos))}" aria-label="${escapar(textoMas(ocultos))}">+${resto}</li>` : ''
    h += `<ul class="subs" aria-label="Subagentes">${visibles.map((a, j) => ficha(a, ahoraMs, base + 1 + j)).join('')}${mas}</ul>`
  }
  return h + '</article>'
}

/** Las tarjetas de sesión del proyecto, en el orden de `agruparPorProyecto`. */
export function sesiones(preparadas, ahoraMs) {
  return preparadas.map((p, k) => tarjeta(p, ahoraMs, k)).join('')
}

/** El Avi de Claude de 120 del vacío (`durmiendo`) o de la carga (`esperando`): está solo, lleva nombre. */
export function figuraVacio(animo) {
  return avi(CLAUDE, animo, 120, { alt: `Claude, ${ANIMO[animo] ?? animo}` })
}

/**
 * Cabecitas de Avi de 32 de la tira mini (4.6), apiladas. Son decorativas (5.6): el grupo lleva
 * los nombres.
 */
export function carasMini(caras) {
  if (!caras.length) return ''
  return `<span class="cabezas-g" role="img" aria-label="${escapar(listaNombres(caras.map(c => c.nombre)))}">${caras.map((c, k) => avi(c, c.animo, 32, { indice: k })).join('')}</span>`
}

// ------------------------------------------------------------------ equipo

/** Firma de la ficha de un compañero: si no cambia, no se redibuja. */
export function firmaCompanero(c, ahoraMs) {
  if (!c.principal) return `${c.usuario}|fuera`
  const proyecto = { repo: c.principal.repo, nombre: nombreProyecto(c.principal.repo), sesiones: [c.principal] }
  return `${c.usuario}|${c.sesiones.length}|${firmaTablero(prepararProyecto(proyecto, ahoraMs))}`
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
  let cabezas = ''
  if (visibles.length) {
    const nombres = listaNombres(visibles.map(a => a.nombre)) + (resto ? `, y ${resto} más` : '')
    const mas = resto ? `<span class="mas-c" title="${escapar(textoMas(ocultos))}">+${resto}</span>` : ''
    cabezas = `<span class="cabezas" role="img" aria-label="${escapar(nombres)}">${visibles.map((a, k) => avi(a, a.animo, 20, { indice: k + 1 })).join('')}${mas}</span>`
  }
  const fila = `<div class="fila">${avi(CLAUDE, animo, 26)}<div class="fila-t"><b>${s.tarea ? `#${escapar(s.tarea)} ` : ''}${escapar(s.rama ?? 'sin rama')}</b><p class="linea" style="--c:${colorEstado(animo)}" title="${escapar(s.actividad ?? '')}"><span class="pt" aria-hidden="true"></span>${escapar(textoActividad(s, ahoraMs))}</p></div>${cabezas}</div>`
  return `${abre}<summary>${ini}<span class="compa-t"><b>${escapar(c.nombre)}</b><small>${escapar(donde)}</small></span>${flecha}</summary>${fila}</details>`
}
