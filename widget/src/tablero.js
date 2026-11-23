// Tablero del estilo Avis (docs/diseno/estilo-avis-ux.md, opción A): barra de proyectos,
// encabezado, chips de conteo y tarjetas escenario con su elenco (docs/diseno/panel-avis-ux.md,
// "Escenario + chips"), equipo, vacío y tira mini. Arma texto HTML a partir de los datos reales;
// todo texto que viene de una sesión se escapa.

import { avi, CLAUDE } from './avis.js'
import { detalleSubagente } from './detalleSub.js'
import { barraControl, puedeControlar } from './control.js'
import {
  animoSesion, animoSubagente, personajeDeNombre, tiempoSubagente, textoActividad, tituloActividad,
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
 * Subagentes que se ven, los que quedan afuera y cuántos son ("+n"). Hasta
 * MAX_SUBAGENTES_VISIBLES van todos; con más, se ven `conMas` (el escenario usa 3 y la pila; el
 * pie del equipo, 4). Se eligen por prioridad (pregunta, trabajo, falló, listo, durmiendo) y se
 * muestran en el orden en que se lanzaron, para que no salten de lugar. `max`: hasta cuántos van
 * todos (la mitad de la pantalla dividida usa 2 y `conMas: 1`, dividida-ux.md 6).
 */
export function subagentesVisibles(sub, { conMas = MAX_SUBAGENTES_VISIBLES, max = MAX_SUBAGENTES_VISIBLES } = {}) {
  const cupo = sub.length <= max ? sub.length : conMas
  const orden = [...sub].sort((a, b) => (ORDEN_ANIMO[a.animo] ?? 5) - (ORDEN_ANIMO[b.animo] ?? 5))
  const elegidos = new Set(orden.slice(0, cupo).map(a => a.id))
  const ocultos = sub.filter(a => !elegidos.has(a.id))
  return { visibles: sub.filter(a => elegidos.has(a.id)), ocultos, resto: ocultos.length }
}

/** Firma de lo que se ve de las sesiones: si no cambia, no se redibuja (y no se cortan las animaciones). */
export function firmaTablero(preparadas) {
  return preparadas.map(({ s, animo, sub }) => [s.sesion, s.tarea, s.rama, animo, (s.procesos ?? []).map(p => p.id).join(','), ...sub.map(a => `${a.id}:${a.nombre}:${a.animo}`)].join('|')).join('/')
}

/**
 * Firma de las tarjetas escenario de un proyecto. No lleva el minuto: el tiempo que pasa se
 * reescribe en su lugar (los `data-vivo`), sin redibujar ni reiniciar los bucles ni los hilos.
 * `rastros` (sesión → rastro, dividida-ux.md 5.10): cuenta si hay rastro y si terminó, no su texto.
 */
export function firmaEscenas(repo, preparadas, rastros = new Map(), abierto = null) {
  const r = preparadas.map(({ s }) => rastros.get(s.sesion)).filter(Boolean).map(x => `${x.clave}:${x.fin ? 'fin' : 'activa'}`)
  // Las sesiones con la barra de control (#19); su borrador, botones y línea se actualizan en su lugar
  const c = preparadas.filter(({ s }) => puedeControlar(s)).map(({ s }) => s.sesion)
  return `${repo}/${firmaTablero(preparadas)}${r.length ? `#${r.join(',')}` : ''}${c.length ? `~${c.join(',')}` : ''}${firmaDetalle(preparadas, abierto)}`
}

/**
 * El detalle abierto (#14) cuenta en la firma con lo que hace y los textos de sus pasos, no con sus
 * horas: el "hace 2 min" de cada paso se reescribe en su lugar.
 */
function firmaDetalle(preparadas, abierto) {
  const a = subAbierto(preparadas, abierto)
  if (!a) return ''
  return `@${abierto.sesion}|${a.id}|${a.estado}|${a.actividad ?? ''}|${(a.pasos ?? []).map(p => p.texto).join('>')}|${Array.isArray(a.pasos)}`
}

/** El subagente abierto, solo si tiene ficha en el escenario de su sesión (la pila "+n" no es un control). */
function subAbierto(preparadas, abierto) {
  if (!abierto) return null
  const p = preparadas.find(({ s }) => s.sesion === abierto.sesion)
  if (!p) return null
  return subagentesVisibles(p.sub, { conMas: CON_PILA }).visibles.find(a => a.id === abierto.id) ?? null
}

/** Color de la línea de estado y del estado de un subagente (dirección, tabla 5.4). */
export function colorEstado(animo) {
  switch (animo) {
    case 'teEspera': case 'coordinando': case 'editando': case 'comando': case 'escribiendo': case 'comiendo': return 'var(--ambar)'
    case 'leyendo': case 'proceso': return 'var(--celeste)'
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

/** "4 sesiones abiertas" debajo de "Avis". */
export function estadoMarca(n) {
  return plural(n, 'sesión abierta', 'sesiones abiertas')
}

/**
 * El Avi de Claude de 112 de la marca "Escenario" (marca-avi-ux.md 3), con las capas que mueve
 * marcaMotion.js. Está solo, así que lleva nombre y estado: el ánimo real, nunca el juego.
 */
export function figuraMarca(animo) {
  return avi(CLAUDE, animo, 112, { alt: `Claude, ${ANIMO[animo] ?? animo}`, marca: true })
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

/** Los números de los chips de conteo, de datos que ya existen. */
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

/**
 * La cifra de un chip, escapada, con las palabras ("h", "min") más chicas que los números, para
 * que "11 h 37 min" se lea como cifra sin desbordar.
 */
export function cifraConUnidades(cifra) {
  // Se parte el texto crudo y se escapa cada trozo: marcar después de escapar tocaría las entidades
  return String(cifra).split(/([a-záéíóúñ]+)/i)
    .map((t, k) => (k % 2 ? `<span class="u">${escapar(t)}</span>` : escapar(t))).join('')
}

/** En el chip, con horas los minutos van como "m": "18 h 43 m" (el nombre accesible dice "min"). */
export const tiempoCorto = t => String(t).replace(/^(\d+ h \d+) min$/, '$1 m')

/** El reloj de 11 del chip del tiempo (trazo violeta en estilos.css). */
const RELOJ = '<svg class="reloj" width="11" height="11" viewBox="0 0 12 12" focusable="false" aria-hidden="true"><circle cx="6" cy="6" r="4.8"/><path d="M6 3.4V6l1.8 1.2"/></svg>'

/**
 * La fila de chips de conteo (panel-avis-ux.md 4): trabajando, terminados (con "· N con error") y
 * el tiempo. Cada chip es un grupo con el nombre accesible de siempre; lo visible va aria-hidden.
 */
export function chips(c) {
  const chip = (aria, contenido) => `<div class="conteo" role="group" aria-label="${escapar(aria)}">${contenido}</div>`
  const punto = color => `<i class="conteo-pt" style="--c:${color}" aria-hidden="true"></i>`
  const cifra = t => `<b aria-hidden="true">${cifraConUnidades(t)}</b>`
  const rotulo = t => `<span aria-hidden="true">${escapar(t)}</span>`
  const error = c.fallidos ? `<span class="conteo-err" aria-hidden="true">· <b>${c.fallidos}</b> con error</span>` : ''
  const lleva = c.rotuloTiempo === 'lleva la sesión'
  return chip(plural(c.trabajando, 'subagente trabajando', 'subagentes trabajando'), punto('var(--ambar)') + cifra(String(c.trabajando)) + rotulo('trabajando'))
    + chip(plural(c.terminados, 'subagente terminado', 'subagentes terminados') + (c.fallidos ? `, ${c.fallidos} con error` : ''),
      punto('var(--verde)') + cifra(String(c.terminados)) + rotulo(c.terminados === 1 ? 'terminado' : 'terminados') + error)
    + chip(`${lleva ? 'La sesión lleva' : 'La sesión más larga lleva'} ${c.tiempo}`, RELOJ + cifra(tiempoCorto(c.tiempo)) + rotulo(lleva ? 'lleva' : 'la más larga'))
}

/** Un subagente dormido conserva su estado: "listo" o "falló". */
const estadoLista = a => (a.animo === 'durmiendo' ? a.estado : a.animo)
const textoEstado = a => ESTADO[estadoLista(a)] ?? estadoLista(a)

/** Título y nombre accesible del "+n": quiénes quedan afuera, con su tarea y su estado. */
export function textoMas(ocultos) {
  return `${plural(ocultos.length, 'subagente más', 'subagentes más')}: ` + ocultos.map(a => `${a.nombre} — ${a.tarea} (${textoEstado(a)})`).join('; ')
}

// ------------------------------------------------------------------ escenario (panel-avis-ux.md 5)

/** Medidas del escenario en px (5.2): la fuente única de las posiciones; el CSS solo da la caja. */
export const ESCENA = { ancho: 408, piso: 98, claude: { t: 96, x: 2 }, x0: 110, zona: 298, ranuraMax: 112, sub: 58, pila: 36 }
/** Subagentes visibles cuando no entran todos: el cuarto lugar es la pila "+n" (5.4). */
const CON_PILA = 3
/** Cabecitas de la pila, como mucho. */
const MAX_CABEZAS = 3
/** De la caja de un Avi a sus pies (y 104 de 120) y a su coronilla (destino del hilo). */
const pie = t => Math.round(t * 0.867)
const coronilla = t => Math.round(t * 0.26)

/**
 * Posiciones del escenario con `k` lugares en el elenco (los visibles, más la pila si hay).
 * `pila`: cuántos quedan en la pila; entonces el último lugar es la pila y no una ranura.
 */
export function geometriaEscena(k, { pila = 0 } = {}) {
  const E = ESCENA
  const claude = { t: E.claude.t, x: E.claude.x, y: E.piso - pie(E.claude.t) }
  const foco = { x: claude.x + claude.t / 2, y: claude.y + Math.round(claude.t * 14 / 120) }
  const ancho = k ? Math.min(E.ranuraMax, Math.floor(E.zona / k)) : 0
  const yAvi = E.piso - pie(E.sub)
  const destinoY = yAvi + coronilla(E.sub)
  const n = pila ? k - 1 : k
  const ranuras = Array.from({ length: n }, (_, j) => {
    const x = E.x0 + j * ancho
    const avi = { x: x + (ancho - E.sub) / 2, y: yAvi }
    return { x, ancho, avi, destino: { x: avi.x + E.sub / 2, y: destinoY } }
  })
  if (!pila) return { claude, foco, ranuras, pila: null }
  const x = E.x0 + n * ancho
  const m = Math.min(pila, MAX_CABEZAS)
  const paso = m > 1 ? Math.min(24, Math.floor((ancho - 44) / (m - 1))) : 0
  const cabezas = Array.from({ length: m }, (_, i) => ({ x: 4 + i * paso, y: i % 2 ? 8 : 2 }))
  // La caja de la pila arranca 46 px arriba del piso y mide 52 (cubre las cabecitas)
  return { claude, foco, ranuras, pila: { x, y: E.piso - 46, ancho, alto: 52, cabezas, destino: { x: x + ancho / 2, y: destinoY } } }
}

/** El trazo de un hilo: de la antena a la coronilla, con el control 24 px arriba del más alto. */
export function trazoHilo(desde, hasta) {
  return `M${desde.x} ${desde.y} Q${(desde.x + hasta.x) / 2} ${Math.min(desde.y, hasta.y) - 24} ${hasta.x} ${hasta.y}`
}

/** Verbo corto del estado en el rótulo del elenco (5.4). */
export const ESTADO_CORTO = { escribiendo: 'escribe', comando: 'escribe', comiendo: 'escribe', editando: 'escribe', leyendo: 'lee', teEspera: 'pregunta', listo: 'listo', reposo: 'listo', fallo: 'falló', esperando: 'espera', inactiva: 'inactiva' }

/** El tiempo de `tiempoSubagente` en mínimo: "5m", "2h5m", "2h", "<1m" (sin "hace"). */
export function tiempoMini(texto) {
  const t = String(texto).replace(/^hace /, '')
  if (t === 'menos de 1 min') return '<1m'
  return t.replace(/\s*h\s*/, 'h').replace(/\s*min$/, 'm')
}

/** "escribe 5m", "listo 8m", "pregunta <1m": lo que entra debajo de un Avi de 58. */
export function estadoCorto(a, ahoraMs) {
  return `${ESTADO_CORTO[estadoLista(a)] ?? textoEstado(a)} ${tiempoMini(tiempoSubagente(a, ahoraMs))}`
}

/**
 * Un subagente en su ranura: el Avi de 58 parado en el piso y el rótulo de 3 líneas (nombre, tarea
 * y estado corto). El estado completo y el tipo de un nombre inventado van en el `title` y en texto
 * oculto. Dormido se atenúa solo el Avi (estilos.css), nunca el texto. `j`: orden en la entrada.
 */
function figuraSub(a, ahoraMs, indice, ranura, j, sesion, abierto) {
  const estado = `${textoEstado(a)} · ${tiempoSubagente(a, ahoraMs)}`
  const tipo = a.inventado && a.tipo ? ` (${a.tipo})` : ''
  const titulo = `${a.nombre}${tipo} — ${a.tarea} (${estado})`
  return `<li class="sub${a.animo === 'durmiendo' ? ' dorm' : ''}" style="left:${ranura.x}px;width:${ranura.ancho}px;--c:${a.color};--ce:${colorEstado(estadoLista(a))};--j:${j}" title="${escapar(titulo)}" data-id="${escapar(a.id)}">`
    // El Avi y su rótulo son un botón que despliega el detalle debajo del escenario (#14)
    + `<button type="button" class="sub-boton" data-accion="sub" data-sesion="${escapar(sesion)}" data-id="${escapar(a.id)}" aria-expanded="${abierto}"${abierto ? ` aria-controls="${idDetalle(sesion, a.id)}"` : ''}>`
    + `<span class="fig" style="left:${ranura.avi.x - ranura.x}px">${avi(a, a.animo, ESCENA.sub, { indice })}</span>`
    + `<span class="rotulo"><b>${escapar(a.nombre)}${tipo ? `<span class="oculto">${escapar(tipo)}</span>` : ''}</b>`
    + `<span class="tarea">${escapar(a.tarea)}</span>`
    + `<em aria-hidden="true" data-vivo>${escapar(estadoCorto(a, ahoraMs))}</em><span class="oculto" data-vivo>${escapar(estado)}</span></span></button></li>`
}

const idDetalle = (sesion, id) => escapar(`det-${sesion}-${id}`)

/**
 * El detalle de un subagente (#14), debajo del escenario de su tarjeta: nombre, tipo, estado y
 * tiempo; la tarea completa; qué hace ahora (solo trabajando) y sus últimos pasos, del más nuevo al
 * más viejo. La flecha de arriba apunta a su Avi (`--flecha`, desde el borde del escenario).
 */
function detalle(a, ahoraMs, sesion, flecha) {
  const d = detalleSubagente(a, ahoraMs)
  const ahora = d.ahora ? `<p class="det-ahora"><span class="det-rot">ahora</span> <span>${escapar(d.ahora)}</span></p>` : ''
  const pasos = d.pasos.length
    ? `<ol class="det-pasos">${d.pasos.map(p => `<li><span>${escapar(p.texto)}</span><time data-vivo>${escapar(p.hace)}</time></li>`).join('')}</ol>`
    : `<p class="det-vacio">${escapar(d.vacio)}</p>`
  return `<div class="det-sub" id="${idDetalle(sesion, a.id)}" role="region" aria-label="${escapar(`Qué hace ${d.nombre}`)}" style="--c:${a.color};--ce:${colorEstado(estadoLista(a))};--flecha:${flecha}px">`
    + `<p class="det-cab"><b>${escapar(d.nombre)}</b><span class="det-tipo">${escapar(d.tipo ?? '')}</span><span class="det-estado">${escapar(d.estado)} · <span data-vivo>${escapar(d.tiempo)}</span></span></p>`
    + `<p class="det-tarea">${escapar(d.tarea)}</p>${ahora}`
    + `<p class="det-rot">últimos pasos</p>${pasos}</div>`
}

/**
 * La pila "+n" (5.4): cabecitas de 36 dormidas y quietas, "+2 terminados" o "+2 más". No es un
 * control: quiénes son va en el `title` y en texto oculto.
 */
function pilaMas(ocultos, pila, j) {
  const texto = textoMas(ocultos)
  const terminados = ocultos.every(a => a.estado === 'listo' || a.estado === 'fallo')
  const cabezas = ocultos.slice(0, pila.cabezas.length)
    .map((a, i) => `<span class="cab-p" style="left:${pila.cabezas[i].x}px;top:${pila.cabezas[i].y}px">${avi(a, 'durmiendo', ESCENA.pila)}</span>`).join('')
  return `<li class="mas" style="left:${pila.x}px;width:${pila.ancho}px;--j:${j}" title="${escapar(texto)}">`
    + `<span class="pila" aria-hidden="true">${cabezas}</span>`
    + `<span class="rotulo" aria-hidden="true"><b>+${ocultos.length}</b><span>${terminados ? 'terminados' : 'más'}</span></span>`
    + `<span class="oculto">${escapar(texto)}</span></li>`
}

/**
 * El escenario de una sesión (5.1): el piso, Claude de 96 con su antena, el elenco y los hilos de
 * coordinación hacia los que trabajan (5.5). Sin subagentes, más bajo y "sin subagentes".
 */
function escena(animo, sub, ahoraMs, base, sesion = '', abiertoId = null) {
  const { visibles, ocultos, resto } = subagentesVisibles(sub, { conMas: CON_PILA })
  const g = geometriaEscena(visibles.length + (resto ? 1 : 0), { pila: resto })
  const piso = '<div class="piso" aria-hidden="true"></div>'
  const claude = `<div class="esc-claude" style="left:${g.claude.x}px;top:${g.claude.y}px">${avi(CLAUDE, animo, g.claude.t, { indice: base })}</div>`
  if (!sub.length) return `<div class="esc solo">${piso}${claude}<p class="esc-nada">sin subagentes</p></div>`
  const hilos = visibles.map((a, j) => a.estado === 'trabajando' && { d: trazoHilo(g.foco, g.ranuras[j].destino), id: a.id }).filter(Boolean)
  if (resto && ocultos.some(a => a.estado === 'trabajando')) hilos.push({ d: trazoHilo(g.foco, g.pila.destino), id: 'pila' })
  const elenco = visibles.map((a, j) => figuraSub(a, ahoraMs, base + 1 + j, g.ranuras[j], j, sesion, a.id === abiertoId)).join('') + (resto ? pilaMas(ocultos, g.pila, visibles.length) : '')
  const trazos = hilos.length ? `<svg class="hilos" aria-hidden="true">${hilos.map(h => `<path d="${h.d}" data-id="${escapar(h.id)}"/>`).join('')}</svg>` : ''
  const puntos = hilos.map((h, k) => `<i class="hilo-pt" style="offset-path:path('${h.d}');--k:${k}" data-id="${escapar(h.id)}" aria-hidden="true"></i>`).join('')
  return `<div class="esc">${piso}${claude}<ul class="elenco" aria-label="Subagentes">${elenco}</ul>${trazos}${puntos}</div>`
}

/**
 * Tarjeta escenario de una sesión (5.1). El dato no trae el título de la tarea: el título es la
 * rama, en una línea con el `title` entero. Los textos que cambian con el tiempo llevan `data-vivo`
 * (main.js los reescribe en su lugar). `k`: posición de la tarjeta (desfase de los Avis).
 */
/**
 * El rastro de la conversación con otra sesión (dividida-ux.md 5.10): "⇄ conversa con api-pagos ·
 * 6 min" en celeste, o terminada con el texto en crema2 (sin opacidad). No es un control.
 */
function rastro(r) {
  if (!r) return ''
  return `<p class="rastro${r.fin ? ' fin' : ''}" title="${escapar(`⇄ ${r.texto}`)}"><span class="rastro-m" aria-hidden="true">⇄</span> <span data-vivo>${escapar(r.texto)}</span></p>`
}

function tarjeta({ s, animo, sub }, ahoraMs, k, r, abierto, control) {
  const base = k * AVIS_POR_TARJETA
  const tag = s.tarea ? `<span class="tag">#${escapar(s.tarea)}</span>` : '<span class="tag sin">sin tarea</span>'
  const titulo = s.rama ? `<b${s.tarea ? '' : ' class="sin"'} title="${escapar(s.rama)}">${escapar(s.rama)}</b>` : ''
  const lleva = s.inicio ? `<span class="lleva"><span class="oculto">lleva </span><span data-vivo>${escapar(tiempoRelativo(s.inicio, ahoraMs))}</span></span>` : ''
  return `<article class="ses"><div class="ses-cab"><h3 class="ses-tit">${tag}${titulo}</h3>${lleva}</div>`
    + `<p class="linea" style="--c:${colorEstado(animo)}" title="${escapar(tituloActividad(s, ahoraMs))}"><span class="pt" aria-hidden="true"></span><span data-vivo>${escapar(textoActividad(s, ahoraMs))}</span></p>`
    + rastro(r)
    + escena(animo, sub, ahoraMs, base, s.sesion, abierto?.sesion === s.sesion ? abierto.id : null)
    + detalleAbierto({ s, sub }, ahoraMs, abierto)
    + barraControl(s, control?.[s.sesion], ahoraMs)
    + '</article>'
}

/**
 * Las tarjetas de sesión del proyecto, en el orden de `agruparPorProyecto`. `rastros`: sesión →
 * rastro de su conversación con otra sesión (`rastroConversa` de dividida.js), si tiene.
 * `control`: sesión → estado de su barra de control (#19: borrador, confirmación, orden pendiente).
 */
export function sesiones(preparadas, ahoraMs, rastros = new Map(), abierto = null, control = {}) {
  return preparadas.map((p, k) => tarjeta(p, ahoraMs, k, rastros.get(p.s.sesion), abierto, control)).join('')
}

/** El detalle de la tarjeta, si su subagente abierto tiene ficha; la flecha va al centro de su Avi. */
function detalleAbierto(p, ahoraMs, abierto) {
  const a = subAbierto([p], abierto)
  if (!a) return ''
  const { visibles, resto } = subagentesVisibles(p.sub, { conMas: CON_PILA })
  const g = geometriaEscena(visibles.length + (resto ? 1 : 0), { pila: resto })
  const ranura = g.ranuras[visibles.indexOf(a)]
  return detalle(a, ahoraMs, p.s.sesion, ranura.avi.x + ESCENA.sub / 2)
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
  const fila = `<div class="fila">${avi(CLAUDE, animo, 26)}<div class="fila-t"><b>${s.tarea ? `#${escapar(s.tarea)} ` : ''}${escapar(s.rama ?? 'sin rama')}</b><p class="linea" style="--c:${colorEstado(animo)}" title="${escapar(tituloActividad(s, ahoraMs))}"><span class="pt" aria-hidden="true"></span>${escapar(textoActividad(s, ahoraMs))}</p></div>${cabezas}</div>`
  return `${abre}<summary>${ini}<span class="compa-t"><b>${escapar(c.nombre)}</b><small>${escapar(donde)}</small></span>${flecha}</summary>${fila}</details>`
}
