// La barra como menú de módulos (#42, docs/diseno/modulos-ux.md, opción A "Menú"): lógica pura.
// Sesiones es la portada (abre ahí y Esc vuelve ahí); Tareas, Hábitos (#41), Proyectos (#44) y
// Configuración son hojas de la columna. `st.modulo` (main.js) es la única fuente de
// qué se ve, y `irModulo` (main.js), la única entrada: este archivo decide qué cerrar, qué abrir y a
// repo ir; main.js hace los actos, la lectura y el foco. Sin DOM: se prueba en node.
// Entrega M1: el menú, la píldora, `#aviso-p` y Esc → Sesiones. M2: la tira de repos (`desplazarTira`) y
// la tira mini.

import { escapar, plural, preguntasPendientes, tiempoRelativo } from './logica.js'
import { quienPregunta } from './pregunta.js'
import { ladoFilaTareas } from './tareasVista.js'
import { nombreFilaTareas } from './tareas.js'
import { ladoFilaHabitos } from './habitosVista.js'
import { nombreFilaHabitos } from './habitos.js'
import { ladoFilaProyectos } from './proyectosVista.js'
import { nombreFilaProyectos } from './proyectos.js'
import { duracionCorta, nombreFilaHoras } from './horas.js'

/** Los módulos, en el orden del menú (3.1). `pie`: va aparte, abajo (`.lado-cfg`). `tecla`: la pista visible. */
export const MODULOS = [
  { id: 'sesiones', nombre: 'Sesiones', atajo: 'Escape', tecla: 'Esc' },
  { id: 'tareas', nombre: 'Tareas', atajo: 'Control+T', tecla: 'Ctrl T' },
  { id: 'habitos', nombre: 'Hábitos', atajo: 'Control+H', tecla: 'Ctrl H' },
  // Ctrl P (proyectos-ux.md 9.2, D-p16): sujeto a la medición M-P4 (frenar el diálogo de imprimir de WebView2)
  { id: 'proyectos', nombre: 'Proyectos', atajo: 'Control+P', tecla: 'Ctrl P' },
  // Horas (odd/tasks/horas-trabajo.md, S4): sin atajo (Ctrl R recarga WebView2)
  { id: 'horas', nombre: 'Horas', atajo: null, tecla: null },
  { id: 'config', nombre: 'Configuración', atajo: 'Control+Comma', tecla: 'Ctrl ,', pie: true },
]

/** Los que se pueden abrir hoy. Hábitos se sumó con #41 (`habitos-ux.md` 14, H1) y Proyectos con #44 (`proyectos-ux.md` 14, P1). */
export const MODULOS_ACTIVOS = ['sesiones', 'tareas', 'habitos', 'proyectos', 'horas', 'config']

const modulo = id => MODULOS.find(m => m.id === id)

/** El `title` de una fila (5): «Sesiones (Esc)», «Tareas (Ctrl T)»… */
export function tituloModulo(id) {
  const m = modulo(id)
  if (!m) return ''
  return m.tecla ? `${m.nombre} (${m.tecla})` : m.nombre
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
  // Horas: lo trabajado hoy (`datos`, en ms), corto; null mientras no se leyó (sin pista: no tiene atajo)
  if (id === 'horas') return datos == null ? '' : `<span class="hor-ct${datos > 0 ? '' : ' nada'}" aria-hidden="true">${escapar(duracionCorta(datos))}</span>`
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
  if (id === 'horas') return nombreFilaHoras(datos)
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

/**
 * El chip elegido de la tira de repos queda a la vista (4.4): el `scrollLeft` nuevo de la tira. `chip`:
 * `{ izq, ancho }` dentro de la tira; `tira`: `{ scroll, visible }`; `margen`: lo que tapa la máscara de
 * la derecha. A la vista, no la mueve; si no, la corre lo justo (si el chip no entra, a su comienzo).
 */
export function desplazarTira(chip, tira, margen = 0) {
  const visible = Math.max(0, tira.visible - margen)
  if (chip.izq < tira.scroll || chip.ancho > visible) return chip.izq
  if (chip.izq + chip.ancho > tira.scroll + visible) return chip.izq + chip.ancho - visible
  return tira.scroll
}
