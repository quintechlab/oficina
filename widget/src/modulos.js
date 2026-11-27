// La barra como menú de módulos (#42, docs/diseno/modulos-ux.md, opción A "Menú"): lógica pura.
// Sesiones es la portada (abre ahí y Esc vuelve ahí); Tareas, Hábitos (#41), Proyectos (#44) y
// Configuración son hojas de la columna. `st.modulo` (main.js) es la única fuente de
// qué se ve, y `irModulo` (main.js), la única entrada: este archivo decide qué cerrar, qué abrir y a
// repo ir; main.js hace los actos, la lectura y el foco. Sin DOM: se prueba en node.
// Entrega M1: el menú, la píldora, `#aviso-p` y Esc → Sesiones. M2: la tira de repos y
// la tira mini; la tira con muchos repos (tira-repos-ux.md): orden, reparto en renglones y teclas.

import { escapar, plural, preguntasPendientes, tiempoRelativo, animoSesion, dormida, ANIMOS_DE_TRABAJO } from './logica.js'
import { quienPregunta } from './pregunta.js'
import { ladoFilaTareas } from './tareasVista.js'
import { nombreFilaTareas } from './tareas.js'
import { ladoFilaHabitos } from './habitosVista.js'
import { nombreFilaHabitos } from './habitos.js'
import { ladoFilaProyectos } from './proyectosVista.js'
import { nombreFilaProyectos } from './proyectos.js'

/** Los módulos, en el orden del menú (3.1). `pie`: va aparte, abajo (`.lado-cfg`). `tecla`: la pista visible. */
export const MODULOS = [
  { id: 'sesiones', nombre: 'Sesiones', atajo: 'Escape', tecla: 'Esc' },
  { id: 'tareas', nombre: 'Tareas', atajo: 'Control+T', tecla: 'Ctrl T' },
  { id: 'habitos', nombre: 'Hábitos', atajo: 'Control+H', tecla: 'Ctrl H' },
  // Ctrl P (proyectos-ux.md 9.2, D-p16): sujeto a la medición M-P4 (frenar el diálogo de imprimir de WebView2)
  { id: 'proyectos', nombre: 'Proyectos', atajo: 'Control+P', tecla: 'Ctrl P' },
  { id: 'config', nombre: 'Configuración', atajo: 'Control+Comma', tecla: 'Ctrl ,', pie: true },
]

/** Los que se pueden abrir hoy. Hábitos se sumó con #41 (`habitos-ux.md` 14, H1) y Proyectos con #44 (`proyectos-ux.md` 14, P1). */
export const MODULOS_ACTIVOS = ['sesiones', 'tareas', 'habitos', 'proyectos', 'config']

const modulo = id => MODULOS.find(m => m.id === id)

/** El `title` de una fila (5): «Sesiones (Esc)», «Tareas (Ctrl T)»… */
export function tituloModulo(id) {
  const m = modulo(id)
  return m ? `${m.nombre} (${m.tecla})` : ''
}

/**
 * Ir a un módulo (3.2, 11.3): `{ modulo, cerrar, abrir, repo }` con las hojas que se cierran (la del
 * módulo que se deja, si es una hoja), la que se abre (null si es Sesiones) y el proyecto al que ir (solo
 * en Sesiones). El mismo módulo no cierra ni abre nada: suma `foco: 'h1'` (9.2). Un id que no existe, o
 * que todavía no se puede abrir (`estado.activos`, por defecto `MODULOS_ACTIVOS`), devuelve null.
 */
export function irModulo(estado, id, { repo } = {}) {
  const activos = estado?.activos ?? MODULOS_ACTIVOS
  if (!activos.includes(id)) return null
  const actual = estado?.modulo ?? 'sesiones'
  const destino = id === 'sesiones' ? (repo ?? null) : null
  if (id === actual) return { modulo: id, cerrar: [], abrir: null, repo: destino, foco: 'h1' }
  return { modulo: id, cerrar: actual === 'sesiones' ? [] : [actual], abrir: id === 'sesiones' ? null : id, repo: destino }
}

/**
 * Esc por capas (9.1): `accionDelModulo` es lo que haría el Esc propio del módulo (`alEsc`,
 * `alEscTareas`). Su última capa, «cerrar la hoja» (o ninguna), pasa a ser ir a Sesiones; las demás son
 * del módulo. En Sesiones, 'nada': sigue el Esc de siempre (la charla, la pregunta, plegar el panel).
 */
export function alEscModulo(id, accionDelModulo) {
  if (id === 'sesiones') return 'nada'
  return accionDelModulo == null || accionDelModulo === 'cerrar' ? 'sesiones' : 'capa'
}

/** La pista del atajo, cuando un módulo no tiene nada que contar (4.2). */
const pista = id => `<kbd aria-hidden="true">${escapar(modulo(id)?.tecla ?? '')}</kbd>`

/**
 * La cuenta de una fila (4.2), `aria-hidden` (el texto va en el nombre de la fila). Sesiones: el número
 * de sesiones (0 también; null = cargando, «…») y, con preguntas, el chip ámbar «1 ?». Tareas: la de hoy
 * (`ladoFilaTareas`, tareas-ux.md 4.1). Hábitos: la pista, «—» o el anillo (`ladoFilaHabitos`, habitos-ux.md 4.1). Proyectos:
 * la pista o el número de proyectos con el punto de la carpeta perdida (`ladoFilaProyectos`, proyectos-ux.md 4.1; `datos`
 * es la lista). Configuración: el punto de pestaña (`puntoPestana`) si hay algo que mirar, o la pista.
 */
export function cuentaModulo(id, datos) {
  if (id === 'sesiones') {
    const n = datos?.sesiones
    const preg = datos?.preguntas ? `<span class="chip chip-preg">${datos.preguntas} ?</span>` : ''
    return `<span class="cuentas" aria-hidden="true"><span class="chip">${n == null ? '…' : n}</span>${preg}</span>`
  }
  if (id === 'tareas') return ladoFilaTareas(datos ?? { hoy: 0, vencidas: 0 })
  if (id === 'habitos') return ladoFilaHabitos(datos)
  if (id === 'proyectos') return ladoFilaProyectos(datos)
  if (id === 'config') return datos?.punto ? `<i class="pt t-${escapar(datos.punto.tono)}" aria-hidden="true"></i>` : pista('config')
  return ''
}

/**
 * El nombre accesible de una fila (4.1): «Sesiones, 3 abiertas, 1 te hace una pregunta» · «Tareas, 2
 * para hoy, 2 vencidas» · «Hábitos, 2 de 5 hechos hoy» · «Proyectos, 3, 1 con la carpeta perdida» · «Configuración», sin
 * la parte que vale 0.
 */
export function nombreModulo(id, datos) {
  if (id === 'sesiones') {
    if (datos?.sesiones == null) return 'Sesiones, buscando'
    const partes = ['Sesiones']
    if (datos.sesiones) partes.push(plural(datos.sesiones, 'abierta', 'abiertas'))
    if (datos.preguntas) partes.push(plural(datos.preguntas, 'te hace una pregunta', 'te hacen una pregunta'))
    return partes.join(', ')
  }
  if (id === 'tareas') return nombreFilaTareas(datos ?? { hoy: 0, vencidas: 0 })
  if (id === 'habitos') return nombreFilaHabitos(datos)
  if (id === 'proyectos') return nombreFilaProyectos(datos)
  if (id === 'config') return `Configuración${datos?.punto?.texto ?? ''}`
  return ''
}

/**
 * La pregunta vista desde otro lugar (4.5): `{ proy, repo, quien, proyecto, hace }` o null. En Sesiones,
 * la de otro proyecto (la del proyecto a la vista ya se ve en su globo); en los demás módulos, la del
 * proyecto a la vista si la tiene, o la primera. `quien` es el de `quienPregunta` (nombre y cara).
 */
export function avisoPregunta(proyectos, modulo, repoActual, mascota = 'avi', ahoraMs = Date.now()) {
  const con = (proyectos ?? []).map((p, k) => ({ p, k, pend: preguntasPendientes(p) })).filter(x => x.pend.length)
  const elegido = modulo === 'sesiones'
    ? con.find(x => x.p.repo !== repoActual)
    : con.find(x => x.p.repo === repoActual) ?? con[0]
  if (!elegido) return null
  const q = elegido.pend[0]
  return { proy: elegido.k, repo: elegido.p.repo, quien: quienPregunta(q, mascota), proyecto: elegido.p.nombre, hace: tiempoRelativo(q.desde, ahoraMs) }
}

/**
 * A dónde abre el panel al expandir la tira o abrir la muesca (8): con una pregunta pendiente, Sesiones
 * en su proyecto (el que está a la vista si ya tiene una); sin pregunta, el módulo actual.
 * `preguntas`: los proyectos con preguntas pendientes (`{ repo }`).
 */
export function moduloAlExpandir({ modulo, repo, preguntas } = {}) {
  const con = preguntas ?? []
  if (!con.length) return { modulo: modulo ?? 'sesiones', repo: null }
  return { modulo: 'sesiones', repo: (con.find(p => p.repo === repo) ?? con[0]).repo ?? null }
}

/** La tira mini (8, M2): el resumen nunca queda más angosto que esto por las cuentas de los módulos. */
export const RESUMEN_MINIMO_MINI = 120
/** Lo que ocupa cada cuenta chica en la tira con su separación, medida con Playwright y tomando el de dos cifras: Tareas (27 a 33 px el chip, 4 de separación) y Hábitos (#41: el anillo con «1/4», 37 px; con «10/12», 49; más 4). */
export const ANCHO_CUENTA_MINI = { tareas: 36, habitos: 53 }

/**
 * Qué cuentas de módulos entran en la tira mini (8): `{ tareas, habitos }`. `anchoLibre` es lo que tendría
 * `#tira-resumen` sin ninguna de ellas. Cada una cuesta su ancho (`anchos`); si el resumen quedaría por
 * debajo de `RESUMEN_MINIMO_MINI`, se va primero Hábitos y después Tareas. Un módulo sin nada que contar
 * no ocupa lugar (en la tira no va la pista del atajo). La insignia de preguntas no pasa por acá: nunca
 * se esconde.
 */
export function cuentasModulosMini(tareas, habitos, anchoLibre, anchos = ANCHO_CUENTA_MINI) {
  const hayTareas = (tareas?.hoy ?? 0) + (tareas?.vencidas ?? 0) > 0
  const hayHabitos = (habitos?.total ?? 0) > 0
  const costoTareas = hayTareas ? anchos.tareas : 0
  const costoHabitos = hayHabitos ? anchos.habitos : 0
  if (anchoLibre - costoTareas - costoHabitos >= RESUMEN_MINIMO_MINI) return { tareas: hayTareas, habitos: hayHabitos }
  if (anchoLibre - costoTareas >= RESUMEN_MINIMO_MINI) return { tareas: hayTareas, habitos: false }
  return { tareas: false, habitos: false }
}

// ------------------------------------------------------------------ la tira de repos con muchos proyectos
// (docs/diseno/tira-repos-ux.md, opción A «Dos renglones»): hasta dos renglones en orden de urgencia y un
// «+n» con lo que no entra. Lo puro vive acá; main.js mide, congela y anima.

/** Lo que espera la tira, ya suelta (sin puntero, sin foco y sin la lista), antes de reordenarse (4.3). */
export const ESPERA_REORDEN_MS = 400
/** Renglones de la tira (6). */
export const FILAS_TIRA = 2
/** Separación entre chips, en los dos sentidos (6, `gap` de `.repos`). */
export const SEPARACION_TIRA = 6
/** El ancho fijo del «+n» (5.2, `--ancho-mas`): el reparto no depende de cuántos dígitos tenga n. */
export const ANCHO_MAS = 72
/** Los grupos de urgencia, en el orden de la tira (4.2). */
export const GRUPOS_TIRA = ['pregunta', 'trabajando', 'espera', 'dormida']

/** Un nombre generado: `scratch-2026-11-27-d5bfc1` (4.1). */
const NOMBRE_GENERADO = /^(.+)-\d{4}-\d{2}-\d{2}-([0-9a-z]{4,12})$/i

/** El nombre corto del chip (4.1): `{ base, sufijo }`; sin fecha y sufijo, el nombre tal cual y `sufijo: null`. */
export function nombreCorto(nombre) {
  const texto = String(nombre ?? '')
  const m = NOMBRE_GENERADO.exec(texto)
  return m ? { base: m[1], sufijo: m[2] } : { base: texto, sufijo: null }
}

/**
 * El grupo de urgencia de un repo (4.2), con las reglas que ya usa el tablero: una pregunta pendiente
 * (`preguntasPendientes`, la cuenta del «1 ?»), alguna sesión trabajando (`ANIMOS_DE_TRABAJO` sobre
 * `animoSesion`, como `prepararProyecto`), todas dormidas (`dormida`), o el resto, que espera tu mensaje.
 */
export function grupoRepo(proyecto, ahoraMs) {
  if (preguntasPendientes(proyecto).length) return 'pregunta'
  const sesiones = proyecto.sesiones ?? []
  if (sesiones.some(s => ANIMOS_DE_TRABAJO.has(animoSesion(s, ahoraMs)))) return 'trabajando'
  if (sesiones.length && sesiones.every(s => dormida(s, ahoraMs))) return 'dormida'
  return 'espera'
}

/**
 * El orden de la tira (4.2): `{ orden, pendiente }`, con los `repo` de cada proyecto. Suelta: por grupo de
 * urgencia y, adentro, el orden de `proyectos` (el de `agruparPorProyecto`); el elegido no salta. Congelada
 * (4.3): `anterior` sin los que se fueron y los nuevos al final, por urgencia; `pendiente` si el suelto sería otro.
 */
export function ordenTira(proyectos, ahoraMs, anterior = [], congelada = false) {
  const grupos = new Map(proyectos.map(p => [p, grupoRepo(p, ahoraMs)]))
  const suelto = GRUPOS_TIRA.flatMap(g => proyectos.filter(p => grupos.get(p) === g)).map(p => p.repo)
  if (!congelada || !anterior?.length) return { orden: suelto, pendiente: false }
  const hay = new Set(suelto)
  const quedan = anterior.filter(r => hay.has(r))
  const ya = new Set(quedan)
  const orden = [...quedan, ...suelto.filter(r => !ya.has(r))]
  return { orden, pendiente: orden.some((r, k) => r !== suelto[k]) }
}

/** Cuántos renglones ocupan `anchos`, en orden, sobre `ancho` con `separacion` entre chips (6.1). */
export function renglonesTira(anchos, ancho, separacion = SEPARACION_TIRA) {
  let renglones = 0
  let ocupado = 0
  for (const w of anchos) {
    if (renglones && ocupado + separacion + w <= ancho) ocupado += separacion + w
    else { renglones++; ocupado = w }
  }
  return renglones
}

const unir = (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y)

/**
 * El reparto en renglones (6): `{ visibles, ocultos, renglones }`, posiciones en el orden de la tira.
 * Si todos entran en `filas`, todos; si no, el prefijo más largo que entra dejando lugar al «+n» al final.
 * `obligados` (los que preguntan) siempre se ven, aunque haga falta otro renglón. El `elegido` oculto toma el
 * último lugar visible que no sea obligado (y si no entra, se oculta uno más). `congelados`: los visibles de
 * antes, que se respetan (4.3); solo se suman los obligados y el elegido.
 */
export function repartirTira({ anchos, ancho, separacion = SEPARACION_TIRA, filas = FILAS_TIRA, anchoMas = ANCHO_MAS, elegido = -1, obligados = [], congelados = null }) {
  const n = anchos.length
  const todos = [...Array(n).keys()]
  const obligado = new Set(obligados.filter(i => i >= 0 && i < n))
  const renglonesDe = (vis, conMas) => renglonesTira([...vis.map(i => anchos[i]), ...(conMas ? [anchoMas] : [])], ancho, separacion)
  let vis
  let tope = filas
  if (congelados) {
    vis = unir(congelados.filter(i => i >= 0 && i < n), obligado)
    tope = Math.max(filas, renglonesDe(vis, vis.length < n))
  } else {
    if (renglonesDe(todos, false) <= filas) return { visibles: todos, ocultos: [], renglones: renglonesDe(todos, false) }
    let k = 0
    while (k < n && renglonesDe(todos.slice(0, k + 1), true) <= filas) k++
    vis = todos.slice(0, k)
    if ([...obligado].some(i => !vis.includes(i))) {
      vis = unir(vis, obligado)
      tope = Math.max(filas, renglonesDe(vis, vis.length < n))
    }
  }
  if (elegido >= 0 && elegido < n && !vis.includes(elegido)) {
    const libres = vis.filter(i => !obligado.has(i))
    if (libres.length) vis = vis.filter(i => i !== libres[libres.length - 1])
    vis = unir(vis, [elegido])
    while (renglonesDe(vis, vis.length < n) > tope) {
      const otros = vis.filter(i => !obligado.has(i) && i !== elegido)
      if (!otros.length) break
      vis = vis.filter(i => i !== otros[otros.length - 1])
    }
  }
  const ocultos = todos.filter(i => !vis.includes(i))
  return { visibles: vis, ocultos, renglones: renglonesDe(vis, ocultos.length > 0) }
}

const vuelta = (i, d, n) => (i + d + n) % n

/**
 * Una tecla en la tira (8.1): `{ foco, elegir, abrir }` o null (la tecla no es de la tira). `items`: los
 * chips visibles y el «+n» (`{ mas }`), en orden visual. ← → mueven con vuelta y eligen si caen en un chip
 * (el «+n» solo se enfoca); ↑ ↓ mueven el foco sin elegir, salvo ↓ en el «+n», que abre la lista; Enter o
 * Espacio en el «+n» abren. Enter en un chip es su clic de siempre.
 */
export function pasoTira(items, actual, tecla) {
  const n = items.length
  if (!n || actual < 0 || actual >= n) return null
  const enMas = !!items[actual].mas
  if (tecla === 'ArrowLeft' || tecla === 'ArrowRight') {
    const j = vuelta(actual, tecla === 'ArrowRight' ? 1 : -1, n)
    return { foco: j, elegir: !items[j].mas, abrir: false }
  }
  if (enMas && (tecla === 'ArrowDown' || tecla === 'Enter' || tecla === ' ')) return { foco: actual, elegir: false, abrir: true }
  if (tecla === 'ArrowUp' || tecla === 'ArrowDown') return { foco: vuelta(actual, tecla === 'ArrowDown' ? 1 : -1, n), elegir: false, abrir: false }
  return null
}

/**
 * Una tecla en la lista del «+n» (8.2): la posición nueva o null. `tamanos`: cuántas opciones tiene cada
 * grupo, en orden; cada grupo es una grilla de 2 columnas que baja por la primera. ↓ ↑ siguen el orden del
 * DOM sin vuelta; → ← van a la otra columna del mismo renglón del grupo, si existe; Inicio y Fin, a los extremos.
 */
export function pasoLista(tamanos, actual, tecla) {
  const total = tamanos.reduce((a, b) => a + b, 0)
  if (!total) return null
  if (tecla === 'Home') return 0
  if (tecla === 'End') return total - 1
  if (tecla === 'ArrowDown') return actual < total - 1 ? actual + 1 : null
  if (tecla === 'ArrowUp') return actual > 0 ? actual - 1 : null
  if (tecla !== 'ArrowLeft' && tecla !== 'ArrowRight') return null
  let base = 0
  for (const t of tamanos) {
    if (actual < base + t) {
      const renglones = Math.ceil(t / 2)
      const j = actual - base + (tecla === 'ArrowRight' ? renglones : -renglones)
      return j >= 0 && j < t ? base + j : null
    }
    base += t
  }
  return null
}

/**
 * ← → fuera de la tira (8.1): `{ repo }` del vecino en `orden` (todos los repos, ocultos incluidos), con
 * vuelta, o null con menos de 2. Un `actual` que no está cuenta como el primero.
 */
export function repoVecino(orden, actual, dir) {
  const n = orden.length
  if (n < 2) return null
  const i = Math.max(0, orden.indexOf(actual))
  return { repo: orden[vuelta(i, dir, n)] }
}
