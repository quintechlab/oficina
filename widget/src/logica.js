// Lógica pura del widget: agrupar sesiones, ánimos, personajes, tiempos y preguntas.
// No toca el DOM ni Tauri, así se prueba con node --test.

const MIN = 60000
/** Igual que el mod (MINUTOS_INACTIVO en hooks/logica.ts): sin publicar hace más, la sesión duerme. */
export const MINUTOS_INACTIVO = 20
/** Cuánto festeja un subagente al terminar antes de quedarse quieto. */
export const MS_FESTEJO = 6000
export const FUERA_DE_REPO = 'fuera de un repositorio'

const COLOR = { amarillo: '#F2B632', azul: '#7FB3FF', verde: '#8FD694', rosa: '#E78FB3', crema: '#F3EBD8' }

/** El elenco del boceto aprobado: cada nombre con su personaje. */
const ELENCO = {
  claude: { pj: 'antena', color: COLOR.crema },
  camila: { pj: 'gata', color: COLOR.rosa },
  ramiro: { pj: 'raton', color: COLOR.azul },
  lucas: { pj: 'brote', color: COLOR.verde },
  delfina: { pj: 'mono', color: COLOR.amarillo },
  ines: { pj: 'cuernos', color: COLOR.verde },
}
/** Personajes para nombres fuera del elenco (la antena queda reservada para Claude). */
const SUBAGENTES = ['camila', 'ramiro', 'lucas', 'delfina', 'ines'].map(n => ELENCO[n])

export function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function nombreProyecto(repo) {
  if (!repo) return FUERA_DE_REPO
  return repo.split('/').pop() || repo
}

const ms = iso => {
  const t = Date.parse(iso ?? '')
  return Number.isNaN(t) ? 0 : t
}

/**
 * Proyectos con sus sesiones. Orden estable para que ◀ ▶ y los escritorios no salten
 * con cada lectura: proyectos por nombre (fuera de un repositorio al final), sesiones por inicio.
 */
export function agruparPorProyecto(sesiones) {
  const grupos = new Map()
  for (const s of sesiones) {
    const repo = s.repo ?? null
    if (!grupos.has(repo)) grupos.set(repo, { repo, nombre: nombreProyecto(repo), sesiones: [] })
    grupos.get(repo).sesiones.push(s)
  }
  const lista = [...grupos.values()]
  for (const g of lista) {
    g.sesiones.sort((a, b) => ms(a.inicio ?? a.actualizado) - ms(b.inicio ?? b.actualizado) || String(a.sesion).localeCompare(String(b.sesion)))
  }
  return lista.sort((a, b) => (a.repo === null) - (b.repo === null) || a.nombre.localeCompare(b.nombre, 'es') || String(a.repo).localeCompare(String(b.repo)))
}

const preguntaDeLaSesion = s => (s.preguntas ?? []).some(p => p.agente == null)
const inactiva = (s, ahoraMs) => ahoraMs - ms(s.actualizado) > MINUTOS_INACTIVO * MIN

/** Ánimo de la mascota de Claude de una sesión. */
export function animoSesion(s, ahoraMs) {
  if (preguntaDeLaSesion(s) || s.actividad === 'esperándote') return 'teEspera'
  if (inactiva(s, ahoraMs)) return 'inactiva'
  const a = s.actividad
  if (!a) return 'esperando'
  if (a === 'pensando') return 'pensando'
  if (/^(leyendo|buscando|investigando)\b/.test(a)) return 'leyendo'
  if (/^corriendo\b/.test(a)) return 'comando'
  if (/^editando\b/.test(a)) return 'editando'
  if (/^lanzando\b/.test(a)) return 'esperando'
  return 'pensando'
}

/** Ánimo de un subagente. `conPregunta`: tiene una pregunta pendiente para vos. */
export function animoSubagente(a, ahoraMs, conPregunta = false) {
  if (conPregunta) return 'teEspera'
  if (a.estado === 'fallo') return 'fallo'
  if (a.estado === 'listo') return ahoraMs - ms(a.hasta) <= MS_FESTEJO ? 'listo' : 'reposo'
  return /^(explore|plan)$/i.test(a.tipo ?? '') ? 'leyendo' : 'comiendo'
}

const normalizar = n => String(n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Número estable a partir de un texto (FNV-1a de 32 bits, como huellaTexto del mod). */
function huella(texto) {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** Personaje de un nombre: el del elenco, o uno elegido siempre igual a partir del nombre. */
export function personajeDeNombre(nombre) {
  const n = normalizar(nombre)
  const propio = ELENCO[n]
  if (propio) return { ...propio }
  return { ...SUBAGENTES[huella(n) % SUBAGENTES.length] }
}

/** "menos de 1 min", "12 min", "2 h 5 min". */
export function tiempoRelativo(iso, ahoraMs) {
  const min = Math.floor(Math.max(0, ahoraMs - ms(iso)) / MIN)
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), resto = min % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

/** Cuánto lleva un subagente trabajando, o hace cuánto terminó. */
export function tiempoSubagente(a, ahoraMs) {
  if (a.estado === 'trabajando' || !a.hasta) return tiempoRelativo(a.desde, ahoraMs)
  return `hace ${tiempoRelativo(a.hasta, ahoraMs)}`
}

/** La línea "ahora · …" de una sesión en la lista. */
export function textoActividad(s, ahoraMs) {
  if (animoSesion(s, ahoraMs) === 'teEspera') return 'ahora · te hace una pregunta'
  if (inactiva(s, ahoraMs)) return `sin actividad hace ${tiempoRelativo(s.actualizado, ahoraMs)}`
  return `ahora · ${s.actividad || 'sin actividad'}`
}

/**
 * Las preguntas pendientes de un proyecto, una por ítem (una llamada a AskUserQuestion
 * puede traer varias), con el nombre de quien pregunta.
 */
export function preguntasPendientes(proyecto) {
  const pend = []
  for (const s of proyecto.sesiones) {
    for (const p of s.preguntas ?? []) {
      const ag = p.agente ? (s.agentes ?? []).find(a => a.id === p.agente) : null
      const quien = p.agente ? (ag?.nombre ?? 'Un subagente') : 'Claude'
      ;(p.items ?? []).forEach((item, i) => pend.push({ clave: `${p.id}#${i}`, sesion: s.sesion, tarea: s.tarea, agente: p.agente ?? null, quien, desde: p.desde, item }))
    }
  }
  return pend
}

/** Separa la marca "(Recomendada)" o "(Recommended)" de la etiqueta de una opción. */
export function etiquetaOpcion(etiqueta) {
  const re = /\s*\((recomendad[ao]|recommended)\)\s*/i
  const recomendada = re.test(etiqueta ?? '')
  return { texto: String(etiqueta ?? '').replace(re, ' ').trim(), recomendada }
}
