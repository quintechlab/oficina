// Lógica pura del widget: agrupar sesiones, ánimos, personajes, tiempos y preguntas.
// No toca el DOM ni Tauri, así se prueba con node --test.

import { especieValida, datosVariante } from './especies.js'

const MIN = 60000
/** Igual que el mod (MINUTOS_INACTIVO en hooks/logica.ts): sin publicar hace más, la sesión duerme. */
export const MINUTOS_INACTIVO = 20
/** Cuánto festeja un subagente al terminar antes de quedarse quieto. */
export const MS_FESTEJO = 6000
export const FUERA_DE_REPO = 'fuera de un repositorio'

const COLOR = { ambar: '#F2B632', azul: '#7FB3FF', verde: '#8FD694', rosa: '#E78FB3', violeta: '#A58BFF' }

/** El elenco de los Avis (dirección 5.2): cada nombre con su accesorio y su color (mejillas y accesorio). */
const ELENCO = {
  claude: { pj: 'antena', color: COLOR.ambar },
  camila: { pj: 'gata', color: COLOR.rosa },
  ramiro: { pj: 'raton', color: COLOR.azul },
  lucas: { pj: 'brote', color: COLOR.verde },
  delfina: { pj: 'mono', color: COLOR.ambar },
  ines: { pj: 'cuernos', color: COLOR.violeta },
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

/**
 * ¿Coordina un equipo? Algún subagente con `estado === 'trabajando'` (mascotas-avi-ux.md 6.1). No sale de
 * `animoSesion`: con una pregunta propia y subagentes trabajando, la sesión dice `teEspera` y sigue coordinando.
 */
export const coordinaEquipo = s => (s.agentes ?? []).some(a => a.estado === 'trabajando')
/** El mod pone "esperándote" cuando termina el turno y Claude espera tu próximo mensaje. */
const esperaMensaje = s => s.actividad === 'esperándote'

/** Lo que publica el mod (v0.6) cuando terminó el turno y quedan procesos en segundo plano. */
const LINEA_PROCESOS = /^esperando (\d+) procesos?$/
/**
 * Cuántos procesos en segundo plano espera la sesión, solo si no está haciendo otra cosa (terminó
 * su turno o no dice nada): un servidor de desarrollo corriendo no tapa lo que Claude hace ahora.
 * La lista (`procesos`, v0.6) manda; sin ella (un compañero leído de GitHub) alcanza la línea.
 */
function procesosEnEspera(s) {
  const a = s.actividad
  const lista = Array.isArray(s.procesos) ? s.procesos.length : 0
  const deLinea = Number(LINEA_PROCESOS.exec(a ?? '')?.[1] ?? 0)
  if (!a || a === 'esperándote') return lista
  return deLinea ? (lista || deLinea) : 0
}

/**
 * ¿La sesión quedó dormida? Sin turno del hilo principal hace más de 20 min (`ultimoTurno`, mod v0.12)
 * y sin nada en curso: ni turno, ni pregunta (suya o de un subagente), ni subagente trabajando, ni
 * procesos. Su tarjeta se pliega y va al fondo (odd/tasks/sesiones-dormidas.md, S1). Sin
 * `ultimoTurno` (mod anterior), nunca: el latido renueva `actualizado` y no dice nada del último turno.
 */
export function dormida(s, ahoraMs) {
  const t = Date.parse(s.ultimoTurno ?? '')
  if (Number.isNaN(t) || s.enTurno === true) return false
  if ((s.preguntas ?? []).length || coordinaEquipo(s) || procesosEnEspera(s)) return false
  return ahoraMs - t > MINUTOS_INACTIVO * MIN
}

/** "1 sesión", "3 sesiones": la cifra y la palabra en singular o plural. */
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

/**
 * Ánimo del Avi de Claude de una sesión, por orden de prioridad:
 * 1. una pregunta suya pendiente → te espera ("!");
 * 2. subagentes trabajando → coordina el equipo (aunque el turno haya terminado);
 * 3. procesos en segundo plano y nada más que hacer → mira el anillo que gira (5.5);
 * 3b. sin turnos hace más de 20 min (`dormida`) → duerme, aunque diga "esperándote";
 * 4. "esperándote" → espera tu mensaje, tranquilo y despierto;
 * 5. si no, lo que diga su actividad (dormida si no publica hace rato).
 */
export function animoSesion(s, ahoraMs) {
  if (preguntaDeLaSesion(s)) return 'teEspera'
  if (coordinaEquipo(s)) return 'coordinando'
  if (procesosEnEspera(s)) return 'proceso'
  if (dormida(s, ahoraMs)) return 'inactiva'
  if (esperaMensaje(s)) return 'esperando'
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

/**
 * Ánimo de un subagente. `conPregunta`: tiene una pregunta pendiente para vos. Al terminar festeja
 * (o pone cara de x_x si falló) unos segundos y después se duerme en su escritorio.
 */
export function animoSubagente(a, ahoraMs, conPregunta = false) {
  if (conPregunta) return 'teEspera'
  if (a.estado === 'listo' || a.estado === 'fallo') {
    if (ahoraMs - ms(a.hasta) > MS_FESTEJO) return 'durmiendo'
    return a.estado
  }
  return /^(explore|plan)$/i.test(a.tipo ?? '') ? 'leyendo' : 'escribiendo'
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

/** Variantes de subagente por especie (mascotas-avi-ux.md 7.1). */
const VARIANTES_POR_ESPECIE = 4

/**
 * La variante (0..3) de cada subagente de una sesión, para las especies que no son el Avi
 * (mascotas-avi-ux.md 7.3, corregida en 16.2): sobre la lista completa (también los terminados), en
 * orden de lanzamiento (`desde` y, a igualdad, `id`), cada uno toma `huella(id) % 4`; si ya la tiene
 * uno anterior que seguía trabajando cuando él arrancó (`hasta == null || hasta > desde`) y queda
 * alguna libre, la siguiente libre. Con 4 o menos a la vez nunca se repiten; del quinto en adelante,
 * su huella. Devuelve `Map<id, variante>`.
 */
export function variantesEquipo(agentes) {
  const orden = [...(agentes ?? [])].sort((a, b) => ((Date.parse(a.desde) || 0) - (Date.parse(b.desde) || 0))
    || (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0))
  const anteriores = []
  const variantes = new Map()
  for (const a of orden) {
    const desde = Date.parse(a.desde) || 0
    // Choca solo con los anteriores que seguían trabajando cuando arrancó (16.2)
    const usadas = new Set(anteriores.filter(p => p.hasta == null || p.hasta > desde).map(p => p.v))
    let v = huella(String(a.id)) % VARIANTES_POR_ESPECIE
    if (usadas.size < VARIANTES_POR_ESPECIE) while (usadas.has(v)) v = (v + 1) % VARIANTES_POR_ESPECIE
    const hasta = a.hasta == null ? null : Date.parse(a.hasta)
    anteriores.push({ hasta: Number.isNaN(hasta) ? null : hasta, v })
    variantes.set(a.id, v)
  }
  return variantes
}

/** Personaje de un nombre: el del elenco, o uno elegido siempre igual a partir del nombre. */
export function personajeDeNombre(nombre) {
  const n = normalizar(nombre)
  const propio = ELENCO[n]
  if (propio) return { ...propio }
  return { ...SUBAGENTES[huella(n) % SUBAGENTES.length] }
}

/**
 * El dibujo de un subagente con la `especie` de la mascota (mascotas-avi-ux.md 7.3): con el Avi, el
 * personaje de su nombre, como siempre (decisión P1); con otra especie, su variante de `variantes`
 * (`variantesEquipo` de su sesión) y el acento de esa variante (`color`, el `--c` de su ficha).
 */
export function personajeSubagente(a, especie, variantes) {
  const e = especieValida(especie)
  if (e === 'avi') return { ...personajeDeNombre(a.nombre), especie: e }
  const variante = variantes.get(a.id) ?? 0
  return { especie: e, variante, color: datosVariante(e, variante).c }
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
  const animo = animoSesion(s, ahoraMs)
  if (animo === 'teEspera') return 'ahora · te hace una pregunta'
  if (animo === 'coordinando') return 'ahora · coordinando el equipo'
  if (animo === 'proceso') return `ahora · esperando ${plural(procesosEnEspera(s), 'proceso', 'procesos')}`
  if (dormida(s, ahoraMs)) return `dormida · sin turnos hace ${tiempoRelativo(s.ultimoTurno, ahoraMs)}`
  if (esperaMensaje(s)) return 'ahora · esperando tu mensaje'
  if (inactiva(s, ahoraMs)) return `sin actividad hace ${tiempoRelativo(s.actualizado, ahoraMs)}`
  return `ahora · ${s.actividad || 'sin actividad'}`
}

/**
 * El título (al pasar el mouse) de la línea de una sesión: sus procesos en segundo plano, uno por
 * renglón con hace cuánto arrancó, o si no tiene, la actividad tal cual.
 */
export function tituloActividad(s, ahoraMs) {
  const procesos = Array.isArray(s.procesos) ? s.procesos : []
  if (procesos.length) return procesos.map(p => `${p.descripcion} · hace ${tiempoRelativo(p.desde, ahoraMs)}`).join('\n')
  return s.actividad ?? ''
}

/**
 * Las preguntas pendientes de un proyecto, una por ítem (una llamada a AskUserQuestion
 * puede traer varias), con el nombre de quien pregunta y `equipo`, la lista completa de subagentes
 * de su sesión (para la variante de un subagente que pregunta, mascotas-avi-ux.md 7.3).
 */
export function preguntasPendientes(proyecto) {
  const pend = []
  for (const s of proyecto.sesiones) {
    for (const p of s.preguntas ?? []) {
      const ag = p.agente ? (s.agentes ?? []).find(a => a.id === p.agente) : null
      const quien = p.agente ? (ag?.nombre ?? 'Un subagente') : 'Claude'
      ;(p.items ?? []).forEach((item, i) => pend.push({ clave: `${p.id}#${i}`, sesion: s.sesion, tarea: s.tarea, agente: p.agente ?? null, quien, desde: p.desde, item, indice: i, pregunta: p, responde: s.puedeResponder === true, equipo: s.agentes ?? [] }))
    }
  }
  return pend
}

/**
 * Ánimos de sesión que se dibujan como trabajo (escribe, lee, piensa, coordina o espera procesos).
 * Una sola lista: la usan el reposo de la marca y el modo "trabajando" de la muesca (muesca-avi-ux.md 8).
 */
export const ANIMOS_DE_TRABAJO = new Set(['editando', 'comando', 'escribiendo', 'leyendo', 'pensando', 'coordinando', 'proceso'])

/**
 * ¿El Avi de la marca puede jugar solo? (docs/diseno/marca-avi-ux.md 7.1, regla 2): hay sesiones
 * (si no, la marca duerme), ninguna pregunta pendiente y ninguna sesión trabajando. Una sesión que
 * espera tu mensaje o que no publica hace rato no cuenta como trabajo. Lo demás (que se vea, que
 * no estés en la ventana, que se pueda mover) lo decide marcaMotion.js.
 */
export function reposoPermitido(proyectos, ahoraMs) {
  const sesiones = proyectos.flatMap(p => p.sesiones)
  if (!sesiones.length) return false
  if (proyectos.some(p => preguntasPendientes(p).length)) return false
  return !sesiones.some(s => ANIMOS_DE_TRABAJO.has(animoSesion(s, ahoraMs)))
}

/** Separa la marca "(Recomendada)" o "(Recommended)" de la etiqueta de una opción. */
export function etiquetaOpcion(etiqueta) {
  const re = /\s*\((recomendad[ao]|recommended)\)\s*/i
  const recomendada = re.test(etiqueta ?? '')
  return { texto: String(etiqueta ?? '').replace(re, ' ').trim(), recomendada }
}

const quienPregunta = (s, p) => p.agente ? ((s.agentes ?? []).find(a => a.id === p.agente)?.nombre ?? 'Un subagente') : 'Claude'

/**
 * Preguntas (una por llamada a AskUserQuestion) que todavía no se avisaron, con su primera
 * pregunta. `avisadas`: ids ya vistos.
 */
export function preguntasNuevas(sesiones, avisadas) {
  const nuevas = []
  for (const s of sesiones) {
    for (const p of s.preguntas ?? []) {
      if (avisadas.has(p.id)) continue
      nuevas.push({ id: p.id, quien: quienPregunta(s, p), pregunta: p.items?.[0]?.pregunta ?? '' })
    }
  }
  return nuevas
}

/**
 * Lo que se mueve el puntero antes de que un toque sea un arrastre (px): hasta acá es un clic. Lo usan
 * el arrastre propio de la ventana (main.js) y el Avi de la marca, que además es un botón
 * (docs/diseno/resumen-ia-ux.md 3.1).
 */
export const UMBRAL_ARRASTRE = 4

/** ¿El puntero se movió más que el umbral? Entonces es un arrastre, no un clic. */
export function superaUmbral(dx, dy) {
  return Math.hypot(dx, dy) > UMBRAL_ARRASTRE
}

const MAX_CARAS = 4

/**
 * Lo que muestra la tira mini (boceto): caras (quien pregunta primero, después los subagentes),
 * un título y la cuenta de sesiones, agentes y proyectos. `especie`: la de la mascota; las caras de
 * los subagentes son sus variantes (mascotas-avi-ux.md 3.1 y 7.3).
 */
export function resumenMini(proyectos, ahoraMs, especie = 'avi') {
  const sesiones = proyectos.flatMap(p => p.sesiones)
  const pendientes = proyectos.reduce((n, p) => n + preguntasPendientes(p).length, 0)
  const agentes = sesiones.reduce((n, s) => n + (s.agentes ?? []).length, 0)
  const caras = []
  const otras = []
  for (const s of sesiones) {
    const conPregunta = new Set((s.preguntas ?? []).map(p => p.agente).filter(Boolean))
    const animo = animoSesion(s, ahoraMs)
    // La cara de Claude lleva su sesión: sigue la forma de esa sesión (mascotas-avi-ux.md 6.2)
    if (animo === 'teEspera') caras.push({ nombre: 'Claude', ...personajeDeNombre('Claude'), animo, sesion: s.sesion })
    const variantes = variantesEquipo(s.agentes)
    for (const a of s.agentes ?? []) {
      const cara = { nombre: a.nombre, ...personajeSubagente(a, especie, variantes), animo: animoSubagente(a, ahoraMs, conPregunta.has(a.id)) }
      if (cara.animo === 'teEspera') caras.push(cara)
      else if (a.estado === 'trabajando') otras.push(cara)
    }
  }
  const lista = [...caras, ...otras].slice(0, MAX_CARAS)
  if (!lista.length && sesiones[0]) lista.push({ nombre: 'Claude', ...personajeDeNombre('Claude'), animo: animoSesion(sesiones[0], ahoraMs), sesion: sesiones[0].sesion })
  return {
    caras: lista,
    pendientes,
    titulo: pendientes ? `${plural(pendientes, 'pregunta', 'preguntas')} para vos` : sesiones.length ? 'Todo en marcha' : 'Sin sesiones abiertas',
    detalle: `${plural(sesiones.length, 'sesión', 'sesiones')} · ${plural(agentes, 'agente', 'agentes')} · ${plural(proyectos.length, 'proyecto', 'proyectos')}`,
  }
}
