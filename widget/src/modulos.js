// La barra como menú de módulos (#42, docs/diseno/modulos-ux.md, opción A "Menú"): lógica pura.
// Sesiones es la portada (abre ahí y Esc vuelve ahí); Tareas y Configuración son hojas de la columna;
// Hábitos (#41) tiene su lugar previsto y entra después. `st.modulo` (main.js) es la única fuente de
// qué se ve, y `irModulo` (main.js), la única entrada: este archivo decide qué cerrar, qué abrir y a
// qué proyecto ir; main.js hace los actos, la lectura y el foco. Sin DOM: se prueba en node.
// Entrega M1: el menú, la píldora, `#aviso-p` y Esc → Sesiones. La tira de proyectos es M2.

import { escapar, plural, preguntasPendientes, tiempoRelativo } from './logica.js'
import { quienPregunta } from './pregunta.js'
import { ladoFilaTareas } from './tareasVista.js'
import { nombreFilaTareas } from './tareas.js'

/** Los módulos, en el orden del menú (3.1). `pie`: va aparte, abajo (`.lado-cfg`). `tecla`: la pista visible. */
export const MODULOS = [
  { id: 'sesiones', nombre: 'Sesiones', atajo: 'Escape', tecla: 'Esc' },
  { id: 'tareas', nombre: 'Tareas', atajo: 'Control+T', tecla: 'Ctrl T' },
  { id: 'habitos', nombre: 'Hábitos', atajo: 'Control+H', tecla: 'Ctrl H' },
  { id: 'config', nombre: 'Configuración', atajo: 'Control+Comma', tecla: 'Ctrl ,', pie: true },
]

/** Los que se pueden abrir hoy. Hábitos se suma con #41 (`habitos-ux.md` 14). */
export const MODULOS_ACTIVOS = ['sesiones', 'tareas', 'config']

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
 * (`ladoFilaTareas`, tareas-ux.md 4.1). Hábitos: la pista hasta #41. Configuración: el punto de
 * pestaña (`puntoPestana`) si hay algo que mirar, o la pista.
 */
export function cuentaModulo(id, datos) {
  if (id === 'sesiones') {
    const n = datos?.sesiones
    const preg = datos?.preguntas ? `<span class="chip chip-preg">${datos.preguntas} ?</span>` : ''
    return `<span class="cuentas" aria-hidden="true"><span class="chip">${n == null ? '…' : n}</span>${preg}</span>`
  }
  if (id === 'tareas') return ladoFilaTareas(datos ?? { hoy: 0, vencidas: 0 })
  if (id === 'habitos') return pista('habitos')
  if (id === 'config') return datos?.punto ? `<i class="pt t-${escapar(datos.punto.tono)}" aria-hidden="true"></i>` : pista('config')
  return ''
}

/**
 * El nombre accesible de una fila (4.1): «Sesiones, 3 abiertas, 1 te hace una pregunta» · «Tareas, 2
 * para hoy, 2 vencidas» · «Hábitos, 2 de 5 hechos hoy» · «Configuración», sin la parte que vale 0.
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
  if (id === 'habitos') return datos?.total ? `Hábitos, ${datos.hechos ?? 0} de ${datos.total} hechos hoy` : 'Hábitos'
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
