// Presencia del equipo: interpreta los comentarios del Issue "Presencia" igual que el mod
// (extraerComentario, unirComentarios y elegirPrincipal de hooks/logica.ts) y arma un
// compañero por persona, sin el comentario propio.

const MARCA = '<!-- oficina:presencia -->'
/** Igual que el mod: sin publicar hace más, la sesión quedó colgada. */
const HORAS_SESION_VIEJA = 12
const MINUTOS_INACTIVO = 20

const esTexto = v => typeof v === 'string'

function esSubagente(a) {
  return !!a && esTexto(a.id) && esTexto(a.nombre) && esTexto(a.tarea) && esTexto(a.desde)
}

function esPregunta(q) {
  return !!q && esTexto(q.id) && esTexto(q.desde) && Array.isArray(q.items)
}

function normalizar(d, sesionPorDefecto) {
  if (!esTexto(d.usuario) || !esTexto(d.actualizado)) return null
  return {
    v: 1,
    sesion: esTexto(d.sesion) && d.sesion ? d.sesion : sesionPorDefecto,
    usuario: d.usuario,
    nombre: esTexto(d.nombre) && d.nombre ? d.nombre : d.usuario,
    estado: d.estado === 'fuera' ? 'fuera' : 'trabajando',
    repo: esTexto(d.repo) ? d.repo : null,
    rama: esTexto(d.rama) ? d.rama : null,
    tarea: typeof d.tarea === 'number' ? d.tarea : null,
    nota: esTexto(d.nota) && d.nota ? d.nota : null,
    inicio: esTexto(d.inicio) ? d.inicio : null,
    tareaDesde: esTexto(d.tareaDesde) ? d.tareaDesde : null,
    actualizado: d.actualizado,
    archivos: Array.isArray(d.archivos) ? d.archivos.filter(esTexto).slice(0, 40) : [],
    ...(esTexto(d.actividad) ? { actividad: d.actividad } : {}),
    ...(Array.isArray(d.agentes) ? { agentes: d.agentes.filter(esSubagente) } : {}),
    ...(Array.isArray(d.preguntas) ? { preguntas: d.preguntas.filter(esPregunta) } : {}),
  }
}

/** El comentario de una persona (formato v2), o null si no es un comentario del mod. */
export function extraerComentario(cuerpo) {
  if (!cuerpo || !cuerpo.includes(MARCA)) return null
  const json = /```json\s*\r?\n([\s\S]*?)\r?\n\s*```/.exec(cuerpo)?.[1]
  if (!json) return null
  let d
  try {
    d = JSON.parse(json)
  } catch {
    return null
  }
  if (!d || typeof d !== 'object') return null
  if (d.v === 2 && esTexto(d.usuario) && Array.isArray(d.sesiones)) {
    const sesiones = d.sesiones.map((s, i) => normalizar(s ?? {}, `s${i}`)).filter(s => s !== null)
    const masReciente = sesiones.map(s => s.actualizado).sort().at(-1)
    return {
      v: 2,
      usuario: d.usuario,
      nombre: esTexto(d.nombre) && d.nombre ? d.nombre : d.usuario,
      ausente: d.ausente === true,
      actualizado: esTexto(d.actualizado) ? d.actualizado : (masReciente ?? new Date(0).toISOString()),
      sesiones,
    }
  }
  if (d.v === 1) {
    const p = normalizar(d, 'v1')
    if (!p) return null
    return { v: 2, usuario: p.usuario, nombre: p.nombre, ausente: p.estado === 'fuera', actualizado: p.actualizado, sesiones: p.estado === 'fuera' ? [] : [p] }
  }
  return null
}

/** Une dos comentarios de la misma persona; por sesión queda la entrada más reciente. */
function unirComentarios(a, b) {
  if (!a) return b
  const reciente = Date.parse(b.actualizado) >= Date.parse(a.actualizado) ? b : a
  const porSesion = new Map()
  for (const s of [...a.sesiones, ...b.sesiones]) {
    const previa = porSesion.get(s.sesion)
    if (!previa || Date.parse(s.actualizado) > Date.parse(previa.actualizado)) porSesion.set(s.sesion, s)
  }
  return { ...reciente, sesiones: [...porSesion.values()] }
}

const activa = (s, ahoraMs) => s.estado !== 'fuera' && ahoraMs - Date.parse(s.actualizado) <= MINUTOS_INACTIVO * 60000

/** Sesión que representa a la persona: activa, en un repositorio, con tarea, la más reciente. */
function elegirPrincipal(c, ahoraMs) {
  const vivas = c.sesiones.filter(s => s.estado !== 'fuera' && ahoraMs - Date.parse(s.actualizado) <= HORAS_SESION_VIEJA * 3600000)
  const puntaje = s => (activa(s, ahoraMs) ? 4 : 0) + (s.repo ? 2 : 0) + (s.tarea ? 1 : 0)
  const orden = [...vivas].sort((a, b) => puntaje(b) - puntaje(a) || Date.parse(b.actualizado) - Date.parse(a.actualizado))
  if (c.ausente || !orden[0]) return { principal: null, sesiones: [] }
  return { principal: orden[0], sesiones: orden }
}

/**
 * Los compañeros a partir de los comentarios `{ usuario, cuerpo }`: uno por persona (aunque
 * tenga dos comentarios), sin el propio (`yo`, sin distinguir mayúsculas), ordenados por nombre.
 */
export function companeros(comentarios, yo, ahoraMs) {
  const porPersona = new Map()
  for (const { cuerpo } of comentarios) {
    const c = extraerComentario(cuerpo)
    if (!c) continue
    const clave = c.usuario.toLowerCase()
    porPersona.set(clave, unirComentarios(porPersona.get(clave), c))
  }
  const propio = yo ? yo.toLowerCase() : null
  return [...porPersona.entries()]
    .filter(([clave]) => clave !== propio)
    .map(([, c]) => ({ usuario: c.usuario, nombre: c.nombre, ausente: c.ausente, actualizado: c.actualizado, ...elegirPrincipal(c, ahoraMs) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
