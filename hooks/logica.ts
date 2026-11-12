// Funciones puras del mod "oficina": sin acceso al motor, fáciles de probar.

import type { Ci, Miembro, Presencia, Tarea } from '../types'

/** Horas máximas por talle, según el acuerdo (S: hasta medio día; M: hasta 2 días). */
export const HORAS_POR_TALLE: Record<'S' | 'M', number> = { S: 4, M: 16 }

/** Pasados estos minutos sin publicar, un integrante "trabajando" se muestra como inactivo. */
export const MINUTOS_INACTIVO = 20

const MARCA = '<!-- oficina:presencia -->'

/** Número de tarea a partir de una rama `tipo/<n>-slug` (también acepta `<n>-slug`). */
export function tareaDesdeRama(rama: string | null): number | null {
  if (!rama) return null
  const numero = /^(?:[a-z]+\/)?(\d{1,6})-/i.exec(rama)?.[1]
  return numero ? Number(numero) : null
}

/** Talle S o M leído del cuerpo de un Issue creado con el formulario (`### Talle`). */
export function talleDesdeCuerpo(cuerpo: string | null | undefined): 'S' | 'M' | null {
  if (!cuerpo) return null
  const talle = /###\s*Talle\s*\r?\n+\s*(S|M)\b/i.exec(cuerpo)?.[1]
  return talle ? (talle.toUpperCase() as 'S' | 'M') : null
}

/** `owner/repo` a partir de la URL del remoto (ssh o https); null si no es de GitHub. */
export function repoDesdeRemoto(url: string | null): string | null {
  if (!url) return null
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(url)
  return m ? `${m[1]}/${m[2]}` : null
}

export function envolverPresencia(p: Presencia): string {
  return `${MARCA}\n\`\`\`json\n${JSON.stringify(p, null, 2)}\n\`\`\``
}

/** Presencia contenida en el cuerpo de un comentario; null si no es un comentario del mod. */
export function extraerPresencia(cuerpo: string | null | undefined): Presencia | null {
  if (!cuerpo || !cuerpo.includes(MARCA)) return null
  const m = /```json\s*\r?\n([\s\S]*?)\r?\n\s*```/.exec(cuerpo)
  if (!m?.[1]) return null
  try {
    const d = JSON.parse(m[1]) as Partial<Presencia>
    if (d.v !== 1 || typeof d.usuario !== 'string' || typeof d.actualizado !== 'string') return null
    return {
      v: 1,
      usuario: d.usuario,
      nombre: typeof d.nombre === 'string' && d.nombre ? d.nombre : d.usuario,
      estado: d.estado === 'fuera' ? 'fuera' : 'trabajando',
      repo: typeof d.repo === 'string' ? d.repo : null,
      rama: typeof d.rama === 'string' ? d.rama : null,
      tarea: typeof d.tarea === 'number' ? d.tarea : null,
      nota: typeof d.nota === 'string' && d.nota ? d.nota : null,
      inicio: typeof d.inicio === 'string' ? d.inicio : null,
      tareaDesde: typeof d.tareaDesde === 'string' ? d.tareaDesde : null,
      actualizado: d.actualizado,
      archivos: Array.isArray(d.archivos) ? d.archivos.filter(a => typeof a === 'string').slice(0, 40) : [],
    }
  } catch {
    return null
  }
}

/** "1 h 20 min", "35 min", "menos de 1 min". */
export function formatoDuracion(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return 'menos de 1 min'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m} min`
}

/** "14:30" en la zona horaria de la máquina. */
export function horaLocal(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '?'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** "12/11" en la zona horaria de la máquina. */
export function fechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '?'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export type Restante = { totalMs: number; usadoMs: number; quedanMs: number; excedido: boolean }

/**
 * Tiempo estimado que queda: presupuesto del talle menos lo registrado en el tablero
 * y lo que lleva la sesión actual. Null cuando no hay talle: entonces no se muestra.
 */
export function restante(
  talle: 'S' | 'M' | null,
  horasRegistradas: number | null,
  inicio: string | null,
  ahoraMs: number,
): Restante | null {
  if (!talle) return null
  const totalMs = HORAS_POR_TALLE[talle] * 3600000
  const registradoMs = Math.max(0, horasRegistradas ?? 0) * 3600000
  const sesionMs = inicio ? Math.max(0, ahoraMs - new Date(inicio).getTime()) : 0
  const usadoMs = registradoMs + sesionMs
  return { totalMs, usadoMs, quedanMs: totalMs - usadoMs, excedido: usadoMs > totalMs }
}

export function archivosEnComun(a: readonly string[], b: readonly string[]): string[] {
  const set = new Set(b)
  return a.filter(x => set.has(x))
}

/** Dos letras para el avatar: "Quintana" → "QU", "Juan Campos" → "JC". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  const primera = partes[0]
  const ultima = partes[partes.length - 1]
  if (!primera || !ultima) return '??'
  if (partes.length === 1) return primera.slice(0, 2).toUpperCase()
  return `${primera[0] ?? ''}${ultima[0] ?? ''}`.toUpperCase()
}

export type EstadoVisible = 'activo' | 'inactivo' | 'fuera'

export function estadoVisible(p: Presencia, ahoraMs: number): EstadoVisible {
  if (p.estado === 'fuera') return 'fuera'
  const hace = ahoraMs - new Date(p.actualizado).getTime()
  return hace > MINUTOS_INACTIVO * 60000 ? 'inactivo' : 'activo'
}

/** Mapa usuario→nombre a partir de la opción `nombres` ("usuario=Nombre,otro=Nombre"). */
export function mapaNombres(texto: string): Record<string, string> {
  const mapa: Record<string, string> = {}
  for (const par of texto.split(',')) {
    const [u, n] = par.split('=').map(s => s.trim())
    if (u && n) mapa[u.toLowerCase()] = n
  }
  return mapa
}

/** Resultado de CI a partir del `statusCheckRollup` que devuelve `gh pr list`. */
export function ciDesdeRollup(rollup: unknown): Ci {
  if (!Array.isArray(rollup) || rollup.length === 0) return 'sin'
  let pendiente = false
  for (const c of rollup as Array<Record<string, unknown>>) {
    const conclusion = String(c.conclusion ?? c.state ?? '').toUpperCase()
    const estado = String(c.status ?? '').toUpperCase()
    if (['FAILURE', 'ERROR', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'].includes(conclusion)) return 'falla'
    if (!conclusion || ['PENDING', 'EXPECTED'].includes(conclusion) || (estado && estado !== 'COMPLETED')) pendiente = true
  }
  return pendiente ? 'pendiente' : 'ok'
}

/** Orden de la oficina: primero uno mismo, después por nombre. */
export function ordenar(lista: Miembro[]): Miembro[] {
  return [...lista].sort((a, b) => Number(b.esYo) - Number(a.esYo) || a.presencia.nombre.localeCompare(b.presencia.nombre, 'es'))
}

/** Avisos (toasts) por lo que cambió en los demás entre dos lecturas. */
export function diferencias(antes: Miembro[], ahora: Miembro[], yo: string | null): string[] {
  const avisos: string[] = []
  const previo = new Map(antes.map(m => [m.presencia.usuario, m]))
  for (const m of ahora) {
    if (m.presencia.usuario === yo) continue
    const p = previo.get(m.presencia.usuario)
    const n = m.presencia.nombre
    if (!p) continue
    if (p.presencia.estado !== 'fuera' && m.presencia.estado === 'fuera') avisos.push(`${n} cerró la sesión`)
    if (p.presencia.estado === 'fuera' && m.presencia.estado === 'trabajando') avisos.push(`${n} entró a la oficina`)
    if (m.presencia.tarea && m.presencia.tarea !== p.presencia.tarea) {
      const titulo = m.tarea?.titulo ? ` · ${m.tarea.titulo}` : ''
      avisos.push(`${n} arrancó #${m.presencia.tarea}${titulo}`)
    }
    const prsPrevios = new Set(p.prs.map(x => x.numero))
    for (const pr of m.prs) if (!prsPrevios.has(pr.numero)) avisos.push(`${n} abrió el PR #${pr.numero}: ${pr.titulo}`)
    for (const pr of m.prs) {
      const antesPr = p.prs.find(x => x.numero === pr.numero)
      if (antesPr && antesPr.ci !== 'falla' && pr.ci === 'falla') avisos.push(`CI en rojo en el PR #${pr.numero} de ${n}`)
    }
  }
  return avisos
}

/** Archivos que dos integrantes tocan a la vez en el mismo repositorio. */
export function choques(lista: Miembro[], yo: string | null): Array<{ con: string; archivos: string[] }> {
  const mio = lista.find(m => m.presencia.usuario === yo)
  if (!mio || !mio.presencia.repo) return []
  const resultado: Array<{ con: string; archivos: string[] }> = []
  for (const otro of lista) {
    if (otro === mio || otro.presencia.repo !== mio.presencia.repo || otro.presencia.estado === 'fuera') continue
    const comunes = archivosEnComun(mio.presencia.archivos, otro.presencia.archivos)
    if (comunes.length > 0) resultado.push({ con: otro.presencia.nombre, archivos: comunes })
  }
  return resultado
}

/** Línea corta para la barra de estado: los demás, en una línea. */
export function resumen(lista: Miembro[], yo: string | null, ahoraMs: number): string | undefined {
  const otros = lista.filter(m => m.presencia.usuario !== yo)
  if (otros.length === 0) return undefined
  return otros
    .map(m => {
      const p = m.presencia
      const ev = estadoVisible(p, ahoraMs)
      if (ev === 'fuera') return `${p.nombre}: fuera`
      const repo = p.repo ? p.repo.split('/')[1] : 'sin repo'
      const tarea = p.tarea ? ` #${p.tarea}` : ''
      const desde = p.inicio ? ` · ${formatoDuracion(ahoraMs - new Date(p.inicio).getTime())}` : ''
      return `${p.nombre}: ${repo}${tarea}${desde}${ev === 'inactivo' ? ' (inactivo)' : ''}`
    })
    .join('  |  ')
}

export function tareaVacia(numero: number, url: string): Tarea {
  return { numero, titulo: '', talle: null, abierta: true, url, horasRegistradas: null, estadoTablero: null }
}
