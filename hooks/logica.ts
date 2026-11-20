// Funciones puras del mod "oficina": sin acceso al motor, fáciles de probar.

import type { Ci, ComentarioPresencia, ItemPregunta, Miembro, Pregunta, Presencia, RespuestaWidget, Subagente, Tarea } from '../types'

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

/** Pasadas estas horas sin publicar, una sesión se descarta: quedó colgada (máquina apagada, sesión cerrada a la fuerza). */
export const HORAS_SESION_VIEJA = 12

function normalizar(d: Partial<Presencia>, sesionPorDefecto: string): Presencia | null {
  if (typeof d.usuario !== 'string' || typeof d.actualizado !== 'string') return null
  return {
    v: 1,
    sesion: typeof d.sesion === 'string' && d.sesion ? d.sesion : sesionPorDefecto,
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
    // Campos de la v0.4: una entrada publicada por una versión anterior no los trae
    ...(typeof d.actividad === 'string' ? { actividad: d.actividad } : {}),
    ...(Array.isArray(d.agentes) ? { agentes: d.agentes.filter(esSubagente) } : {}),
    ...(Array.isArray(d.preguntas) ? { preguntas: d.preguntas.filter(esPregunta) } : {}),
  }
}

function esSubagente(s: unknown): s is Subagente {
  const a = s as Partial<Subagente> | null
  return !!a && typeof a.id === 'string' && typeof a.nombre === 'string' && typeof a.tarea === 'string' && typeof a.desde === 'string'
}

function esPregunta(p: unknown): p is Pregunta {
  const q = p as Partial<Pregunta> | null
  return !!q && typeof q.id === 'string' && typeof q.desde === 'string' && Array.isArray(q.items)
}

export function envolverComentario(c: ComentarioPresencia): string {
  return `${MARCA}\n\`\`\`json\n${JSON.stringify(c, null, 2)}\n\`\`\``
}

/**
 * El comentario de una persona; null si no es un comentario del mod. Un comentario v1 (un solo
 * estado, versiones 0.1 y 0.2) se lee como una única sesión, así nadie desaparece al actualizar.
 */
export function extraerComentario(cuerpo: string | null | undefined): ComentarioPresencia | null {
  if (!cuerpo || !cuerpo.includes(MARCA)) return null
  const json = /```json\s*\r?\n([\s\S]*?)\r?\n\s*```/.exec(cuerpo)?.[1]
  if (!json) return null
  let d: Record<string, unknown>
  try {
    d = JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
  if (d.v === 2 && typeof d.usuario === 'string' && Array.isArray(d.sesiones)) {
    const sesiones = (d.sesiones as Array<Partial<Presencia>>)
      .map((s, i) => normalizar(s ?? {}, `s${i}`))
      .filter((s): s is Presencia => s !== null)
    const masReciente = sesiones.map(s => s.actualizado).sort().at(-1)
    return {
      v: 2,
      usuario: d.usuario,
      nombre: typeof d.nombre === 'string' && d.nombre ? d.nombre : d.usuario,
      ausente: d.ausente === true,
      actualizado: typeof d.actualizado === 'string' ? d.actualizado : (masReciente ?? new Date(0).toISOString()),
      sesiones,
    }
  }
  if (d.v === 1) {
    const p = normalizar(d as Partial<Presencia>, 'v1')
    if (!p) return null
    return { v: 2, usuario: p.usuario, nombre: p.nombre, ausente: p.estado === 'fuera', actualizado: p.actualizado, sesiones: p.estado === 'fuera' ? [] : [p] }
  }
  return null
}

/**
 * Pone (o reemplaza) la entrada de una sesión sin tocar las de las otras sesiones de la persona.
 * De paso descarta las sesiones colgadas y la entrada heredada del formato v1.
 */
export function ponerSesion(
  c: ComentarioPresencia | null,
  p: Presencia,
  ahoraMs: number,
  opciones: { ausente?: boolean } = {},
): ComentarioPresencia {
  const limite = ahoraMs - HORAS_SESION_VIEJA * 3600000
  const otras = (c?.sesiones ?? []).filter(s => s.sesion !== p.sesion && s.sesion !== 'v1' && Date.parse(s.actualizado) >= limite)
  return {
    v: 2,
    usuario: p.usuario,
    nombre: p.nombre,
    ausente: opciones.ausente ?? c?.ausente ?? false,
    actualizado: p.actualizado,
    sesiones: [...otras, p],
  }
}

/**
 * Une dos comentarios de la misma persona. Pasa cuando una sesión con una versión anterior del mod
 * no reconoce el formato nuevo y crea un comentario aparte: la persona sigue siendo una sola ficha.
 * Si dos entradas tienen el mismo id de sesión, queda la más reciente.
 */
export function unirComentarios(a: ComentarioPresencia | undefined, b: ComentarioPresencia): ComentarioPresencia {
  if (!a) return b
  const reciente = Date.parse(b.actualizado) >= Date.parse(a.actualizado) ? b : a
  const porSesion = new Map<string, Presencia>()
  for (const s of [...a.sesiones, ...b.sesiones]) {
    const previa = porSesion.get(s.sesion)
    if (!previa || Date.parse(s.actualizado) > Date.parse(previa.actualizado)) porSesion.set(s.sesion, s)
  }
  return { ...reciente, sesiones: [...porSesion.values()] }
}

/** Saca la entrada de una sesión (al cerrarla); las demás quedan como estaban. */
export function quitarSesion(c: ComentarioPresencia, sesion: string, ahoraIso: string): ComentarioPresencia {
  return { ...c, actualizado: ahoraIso, sesiones: c.sesiones.filter(s => s.sesion !== sesion) }
}

/**
 * Qué sesión representa a la persona en el panel: primero las activas, después las que están en
 * un repositorio, después las que tienen tarea, y entre iguales la que publicó más recién.
 * `otras` son las demás sesiones activas que están en otro repositorio o en otra tarea.
 */
export function elegirPrincipal(c: ComentarioPresencia, ahoraMs: number): { presencia: Presencia; otras: Presencia[]; todas: Presencia[] } {
  const vivas = c.sesiones.filter(s => s.estado !== 'fuera' && ahoraMs - Date.parse(s.actualizado) <= HORAS_SESION_VIEJA * 3600000)
  const puntaje = (s: Presencia) => (estadoVisible(s, ahoraMs) === 'activo' ? 4 : 0) + (s.repo ? 2 : 0) + (s.tarea ? 1 : 0)
  const orden = [...vivas].sort((a, b) => puntaje(b) - puntaje(a) || Date.parse(b.actualizado) - Date.parse(a.actualizado))
  const principal = orden[0]
  if (c.ausente || !principal) {
    return {
      presencia: {
        v: 1, sesion: '', usuario: c.usuario, nombre: c.nombre, estado: 'fuera', repo: null, rama: null, tarea: null,
        nota: null, inicio: null, tareaDesde: null, actualizado: c.actualizado, archivos: [],
      },
      otras: [],
      todas: [],
    }
  }
  const otras = orden
    .slice(1)
    .filter(s => s.repo && estadoVisible(s, ahoraMs) === 'activo' && !(s.repo === principal.repo && s.tarea === principal.tarea))
  return { presencia: principal, otras, todas: orden }
}

// ------------------------------------------------------------------ agentes en paralelo

/** Nombres para los subagentes que no traen uno en su descripción. */
export const NOMBRES_INVENTADOS = [
  'Bruno', 'Inés', 'Paula', 'Ramiro', 'Sofía', 'Nahuel', 'Agustín', 'Julieta',
  'Martina', 'Joaquín', 'Lola', 'Tobías', 'Abril', 'Mateo', 'Renata', 'Felipe',
] as const

/** Un número estable a partir de un texto (FNV-1a de 32 bits). */
function huellaTexto(texto: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * Nombre y tarea de un subagente. La convención del equipo es despacharlos como
 * "Nombre — tarea"; si la descripción no lo sigue, el nombre se inventa a partir del id
 * del agente, así el mismo agente se llama igual en cada publicación.
 */
export function nombreSubagente(descripcion: string, id: string): { nombre: string; tarea: string; inventado: boolean } {
  const m = /^(\p{L}[\p{L}\p{N}]*(?: \d+)?)\s+[—–-]\s+(.+)$/u.exec(descripcion.trim())
  if (m?.[1] && m[2]) return { nombre: m[1], tarea: m[2].trim(), inventado: false }
  const nombre = NOMBRES_INVENTADOS[huellaTexto(id) % NOMBRES_INVENTADOS.length] ?? 'Bruno'
  return { nombre, tarea: descripcion.trim(), inventado: true }
}

const LARGO_ACTIVIDAD = 60

function recortarActividad(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length > LARGO_ACTIVIDAD ? `${limpio.slice(0, LARGO_ACTIVIDAD - 1)}…` : limpio
}

function nombreArchivo(ruta: unknown): string {
  return typeof ruta === 'string' ? (ruta.split(/[\\/]/).pop() ?? ruta) : ''
}

/** Qué está haciendo una sesión, dicho en una frase corta, a partir de la herramienta que usa. */
export function actividadDesdeHerramienta(herramienta: string, entrada: Readonly<Record<string, unknown>>): string {
  switch (herramienta) {
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return recortarActividad(`editando ${nombreArchivo(entrada.file_path ?? entrada.notebook_path)}`)
    case 'Read':
      return recortarActividad(`leyendo ${nombreArchivo(entrada.file_path)}`)
    case 'Bash':
    case 'PowerShell':
      return recortarActividad(`corriendo ${String(entrada.command ?? '').split('\n')[0] ?? ''}`)
    case 'Grep':
    case 'Glob':
      return recortarActividad(`buscando ${String(entrada.pattern ?? '')}`)
    case 'WebFetch':
    case 'WebSearch':
      return 'investigando en la web'
    case 'Agent': {
      // Antes de lanzarlo no hay id: un agente sin nombre todavía no tiene el suyo inventado
      const quien = nombreSubagente(String(entrada.description ?? ''), '')
      return quien.inventado ? 'lanzando un subagente' : recortarActividad(`lanzando a ${quien.nombre}`)
    }
    case 'AskUserQuestion':
      return 'esperándote'
    default:
      return recortarActividad(`usando ${herramienta}`)
  }
}

/** La pregunta de una llamada a AskUserQuestion, o null si la entrada no tiene la forma esperada. */
export function preguntaDesdeEntrada(entrada: unknown, id: string, agente: string | null, desde: string): Pregunta | null {
  const preguntas = (entrada as { questions?: unknown } | null)?.questions
  if (!Array.isArray(preguntas)) return null
  const items: ItemPregunta[] = []
  for (const q of preguntas) {
    if (!q || typeof q !== 'object') continue
    const p = q as { question?: unknown; header?: unknown; multiSelect?: unknown; options?: unknown }
    if (typeof p.question !== 'string') continue
    const opciones = Array.isArray(p.options)
      ? p.options
          .filter((o): o is { label: string; description?: unknown } => !!o && typeof (o as { label?: unknown }).label === 'string')
          .map(o => ({ etiqueta: o.label, descripcion: typeof o.description === 'string' ? o.description : '' }))
      : []
    items.push({ pregunta: p.question, encabezado: typeof p.header === 'string' ? p.header : '', multiple: p.multiSelect === true, opciones })
  }
  return items.length > 0 ? { id, agente, desde, items } : null
}

/** Cuánto sigue a la vista un subagente que terminó. */
export const MINUTOS_SUBAGENTE_TERMINADO = 30
const MAX_SUBAGENTES = 8

/** Los que trabajan siempre quedan; los terminados, durante un rato. Como mucho 8. */
export function podarSubagentes(lista: readonly Subagente[], ahoraMs: number): Subagente[] {
  const limite = ahoraMs - MINUTOS_SUBAGENTE_TERMINADO * 60000
  const vivos = lista.filter(s => s.estado === 'trabajando' || (s.hasta !== null && Date.parse(s.hasta) >= limite))
  const trabajando = vivos.filter(s => s.estado === 'trabajando')
  const terminados = vivos.filter(s => s.estado !== 'trabajando')
  return [...trabajando, ...terminados].slice(0, MAX_SUBAGENTES)
}

/** Rutas de `git status --porcelain` (cambios sin commitear y archivos nuevos). */
export function archivosDesdeStatus(texto: string): string[] {
  return texto
    .split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.length > 3)
    .map(l => {
      const ruta = l.slice(3)
      const flecha = ruta.indexOf(' -> ')
      return (flecha >= 0 ? ruta.slice(flecha + 4) : ruta).replace(/^"|"$/g, '')
    })
    .filter(Boolean)
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

// ------------------------------------------------------------------ responder desde el widget (v0.5)

/**
 * ¿`valor` son etiquetas de `etiquetas` unidas por ", ", sin repetir? Una etiqueta puede llevar
 * coma ("Tests, con fixtures"), así que se prueba partir el texto de todas las formas posibles.
 */
function sonEtiquetas(valor: string, etiquetas: readonly string[], usadas: ReadonlySet<string> = new Set()): boolean {
  for (const e of etiquetas) {
    if (usadas.has(e) || !valor.startsWith(e)) continue
    const resto = valor.slice(e.length)
    if (resto === '') return true
    if (resto.startsWith(', ') && sonEtiquetas(resto.slice(2), etiquetas, new Set([...usadas, e]))) return true
  }
  return false
}

/**
 * Valida el archivo que dejó el widget antes de entregarle algo al modelo. Solo vale si responde
 * todas las preguntas de esta llamada, con opciones que existen (o texto libre marcado en
 * `libres`), y si se tocó después de que se hizo la pregunta. Cualquier otra cosa se ignora.
 */
export function validarRespuesta(datos: unknown, pregunta: Pregunta): { answers: Record<string, string> } | { error: string } {
  if (!datos || typeof datos !== 'object') return { error: 'no es un objeto' }
  const d = datos as Partial<RespuestaWidget>
  if (d.v !== 1 || d.origen !== 'widget') return { error: 'formato desconocido' }
  if (typeof d.tocadoEn !== 'string' || !(Date.parse(d.tocadoEn) >= Date.parse(pregunta.desde))) return { error: 'anterior a la pregunta' }
  if (!d.answers || typeof d.answers !== 'object') return { error: 'sin respuestas' }
  const libres = new Set(Array.isArray(d.libres) ? d.libres.filter(l => typeof l === 'string') : [])
  const textos = new Set(pregunta.items.map(i => i.pregunta))
  for (const clave of Object.keys(d.answers)) {
    if (!textos.has(clave)) return { error: `pregunta desconocida: ${clave}` }
  }
  const answers: Record<string, string> = {}
  for (const item of pregunta.items) {
    const valor = (d.answers as Record<string, unknown>)[item.pregunta]
    if (typeof valor !== 'string') return { error: `falta responder: ${item.pregunta}` }
    const etiquetas = item.opciones.map(o => o.etiqueta)
    const valido = libres.has(item.pregunta)
      ? valor.trim() !== ''
      : item.multiple ? sonEtiquetas(valor, etiquetas) : etiquetas.includes(valor)
    if (!valido) return { error: `opción desconocida para: ${item.pregunta}` }
    answers[item.pregunta] = valor
  }
  return { answers }
}

/** Lo que necesita la vigilancia del archivo de respuesta; el motor lo da en register.tsx. */
export type Vigilancia = {
  /** Texto del archivo, o null si no existe. */
  leer: () => Promise<string | null>
  /** Espera entre lecturas; termina antes si se aborta. */
  esperar: (ms: number, senal: AbortSignal) => Promise<void>
  /** Se aborta cuando el diálogo de Claude respondió. */
  senal: AbortSignal
  /** Un archivo inválido se ignora y se avisa una sola vez por contenido. */
  ignorado?: (motivo: string) => void
}

export const MS_ENTRE_LECTURAS = 500

/**
 * Lee el archivo de respuesta del widget cada medio segundo hasta encontrar uno válido o hasta
 * que el diálogo responda. Sin archivo válido devuelve null: nunca elige una opción por su cuenta.
 */
export async function vigilarRespuesta(pregunta: Pregunta, v: Vigilancia): Promise<Record<string, string> | null> {
  let visto: string | null = null
  while (!v.senal.aborted) {
    const texto = await v.leer().catch(() => null)
    if (v.senal.aborted) return null
    if (texto !== null && texto !== visto) {
      visto = texto
      let datos: unknown = null
      try {
        datos = JSON.parse(texto)
      } catch {
        datos = null
      }
      const r = validarRespuesta(datos, pregunta)
      if ('answers' in r) return r.answers
      v.ignorado?.(r.error)
    }
    await v.esperar(MS_ENTRE_LECTURAS, v.senal)
  }
  return null
}

/**
 * Corre el diálogo de Claude contra la respuesta del widget. Gana el widget solo si trae una
 * respuesta válida antes; si no, o si la vigilancia falla, se espera al diálogo como siempre.
 */
export async function carreraConDialogo<T>(
  dialogo: Promise<T>,
  vigilar: (senal: AbortSignal) => Promise<Record<string, string> | null>,
): Promise<{ de: 'dialogo'; resultado: T } | { de: 'widget'; answers: Record<string, string> }> {
  const corte = new AbortController()
  const terminado = dialogo.then(
    () => corte.abort(),
    () => corte.abort(),
  )
  const answers = await Promise.race([terminado.then(() => null), vigilar(corte.signal).catch(() => null)])
  if (answers) return { de: 'widget', answers }
  corte.abort()
  return { de: 'dialogo', resultado: await dialogo }
}


/**
 * Lo que devuelve el hook cuando ganó el widget. Marcar el archivo como usado no puede fallar
 * hacia afuera: si algo tira ahí, el `.catch` del hook abriría un segundo diálogo.
 */
export async function resultadoDelWidget(
  questions: unknown,
  answers: Record<string, string>,
  marcar: () => Promise<void>,
): Promise<{ result: { questions: unknown; answers: Record<string, string> } }> {
  try {
    await marcar()
  } catch {
    // El widget ve el archivo sin marcar y lo borra; la respuesta igual llega al modelo
  }
  return { result: { questions, answers } }
}
