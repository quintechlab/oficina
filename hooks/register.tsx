// Oficina Quintech Studio: panel de presencia del equipo sobre GitHub.
//
// Cada integrante publica su presencia (repo, rama, tarea, desde cuándo) en un comentario
// propio de un Issue de un repositorio privado, con su propio `gh` autenticado. El mod lee
// los comentarios de todos cada `intervalo` segundos y dibuja la oficina.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ComentarioPresencia, Info, Miembro, Pr, Presencia, Tarea } from '../types'
import {
  ciDesdeRollup,
  choques,
  diferencias,
  estadoVisible,
  archivosDesdeStatus,
  elegirPrincipal,
  envolverComentario,
  extraerComentario,
  ponerSesion,
  quitarSesion,
  unirComentarios,
  fechaCorta,
  formatoDuracion,
  horaLocal,
  iniciales,
  mapaNombres,
  ordenar,
  repoDesdeRemoto,
  resumen,
  talleDesdeCuerpo,
  tareaDesdeRama,
  tareaVacia,
} from './logica'

const PANE = 'oficina'
const TITULO = 'Oficina · Quintech Studio'

// Paleta Quintech (docs/estilos/quintech.css)
const AMARILLO = '#F2B632'
const NEGRO = '#0B0D12'
const GRIS_CLARO = '#9AA0AC'
const ACENTOS = [AMARILLO, '#7FB3FF', '#8FD694', '#E78FB3']

// Cambiar el tag cuando cambie la forma de Miembro: descarta lo guardado por una versión anterior.
const miembros = atom({ plugin: 'oficina', key: 'miembros' } as const, [] as Miembro[], { shape: 'miembros-2' })
const info = atom({ plugin: 'oficina', key: 'info' } as const, {
  yo: null,
  error: null,
  actualizado: null,
  datos: '',
} as Info)

type Config = { datos: string; issue: number; intervalo: number; nombres: Record<string, string> }
type Yo = { login: string; nombre: string }
// $.store es de la máquina, compartido por todas las sesiones abiertas: lo propio de cada sesión va por su id.
type Ajustes = { tareas?: Record<string, number>; nota?: string }
type Inicio = { clave: string; inicio: string; en: number }

// Variables del módulo: arrancan de cero en cada recarga; lo durable va a $.store.
let config: Config
let yo: Yo | null = null
let ocupado = false
let ultimaPublicacion = ''
const cacheTareas = new Map<string, { en: number; tarea: Tarea }>()

// ------------------------------------------------------------------ gh
async function gh($: EngineInterface, args: readonly string[], cwd?: string): Promise<string> {
  const r = await $.process.run(['gh', ...args], { cwd, timeoutMs: 25000 })
  if (r.exitCode !== 0) throw new Error((r.stderr || r.stdout).trim().split('\n')[0]?.slice(0, 240) || `gh ${args[0]} falló`)
  return r.stdout
}

async function ghJson<T>($: EngineInterface, args: readonly string[], cwd?: string): Promise<T> {
  return JSON.parse(await gh($, args, cwd)) as T
}

async function git($: EngineInterface, args: readonly string[], cwd: string): Promise<string> {
  const r = await $.process.run(['git', ...args], { cwd, timeoutMs: 15000 })
  return r.exitCode === 0 ? r.stdout : ''
}

// ------------------------------------------------------------------ quién soy
async function obtenerYo($: EngineInterface): Promise<Yo> {
  if (yo) return yo
  const guardado = (await $.store.get('yo')) as Yo | undefined
  if (guardado?.login) {
    yo = { login: guardado.login, nombre: config.nombres[guardado.login.toLowerCase()] ?? guardado.nombre }
    return yo
  }
  const u = await ghJson<{ login: string; name: string | null }>($, ['api', 'user'])
  yo = { login: u.login, nombre: config.nombres[u.login.toLowerCase()] ?? u.name ?? u.login }
  await $.store.set('yo', yo)
  return yo
}

// ------------------------------------------------------------------ qué estoy haciendo
type Local = { repo: string | null; rama: string | null; archivos: string[] }

async function leerLocal($: EngineInterface): Promise<Local> {
  const cwd = await $.session.cwd()
  const sr = await $.session.repo()
  if (!sr) return { repo: null, rama: null, archivos: [] }
  const repo = repoDesdeRemoto(sr.remote)
  const rama = (await git($, ['branch', '--show-current'], cwd)).trim() || null
  let archivos: string[] = []
  for (const base of ['origin/main', 'main', 'origin/master', 'master']) {
    const salida = await git($, ['diff', '--name-only', `${base}...HEAD`], cwd)
    if (salida.trim()) {
      archivos = salida.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 40)
      break
    }
  }
  // Lo que todavía no se commiteó también cuenta para avisar un choque
  const pendientes = archivosDesdeStatus(await git($, ['status', '--porcelain'], cwd))
  archivos = [...new Set([...archivos, ...pendientes])].slice(0, 40)
  return { repo, rama, archivos }
}

type Mio = { id: number; comentario: ComentarioPresencia } | null

async function miComentario($: EngineInterface, login: string): Promise<Mio> {
  const lista = await ghJson<Array<{ id: number; body: string; user: { login: string } }>>($, [
    'api',
    `repos/${config.datos}/issues/${config.issue}/comments?per_page=100`,
  ])
  // Si una sesión vieja dejó un segundo comentario, se escribe en el de formato nuevo y se suma lo del otro
  const mios = lista
    .filter(c => c.user.login.toLowerCase() === login.toLowerCase())
    .map(c => ({ id: c.id, esV2: c.body.includes('"v": 2'), comentario: extraerComentario(c.body) }))
    .filter((c): c is { id: number; esV2: boolean; comentario: ComentarioPresencia } => c.comentario !== null)
    .sort((x, y) => Number(y.esV2) - Number(x.esV2) || x.id - y.id)
  const destino = mios[0]
  if (!destino) return null
  return { id: destino.id, comentario: mios.slice(1).reduce((acc, c) => unirComentarios(acc, c.comentario), destino.comentario) }
}

async function escribirComentario($: EngineInterface, mio: Mio, comentario: ComentarioPresencia): Promise<void> {
  const cuerpo = envolverComentario(comentario)
  if (mio) await gh($, ['api', '-X', 'PATCH', `repos/${config.datos}/issues/comments/${mio.id}`, '-f', `body=${cuerpo}`])
  else await gh($, ['api', '-X', 'POST', `repos/${config.datos}/issues/${config.issue}/comments`, '-f', `body=${cuerpo}`])
}

/**
 * Publica el estado de ESTA sesión dentro de mi comentario, sin tocar las entradas de mis otras
 * sesiones abiertas: cada una escribe la suya. `ausente` cambia el "me fui" de la persona.
 */
async function publicar($: EngineInterface, forzar = false, ausente?: boolean): Promise<void> {
  const quien = await obtenerYo($)
  const local = await leerLocal($)
  const sesion = await $.session.id()
  const ajustes = ((await $.store.get('ajustes')) as Ajustes | undefined) ?? {}
  const tarea = ajustes.tareas?.[sesion] ?? tareaDesdeRama(local.rama)
  const ahoraMs = await $.clock.now()
  const ahora = new Date(ahoraMs).toISOString()

  const clave = `${local.repo ?? '-'}#${tarea ?? '-'}`
  const inicios = ((await $.store.get('inicios')) as Record<string, Inicio> | undefined) ?? {}
  const previo = inicios[sesion]
  const inicio = previo && previo.clave === clave ? previo.inicio : ahora
  inicios[sesion] = { clave, inicio, en: ahoraMs }
  for (const [id, v] of Object.entries(inicios)) if (ahoraMs - v.en > 24 * 3600000) delete inicios[id]
  await $.store.set('inicios', inicios)
  const tareas = ((await $.store.get('tareas')) as Record<string, string> | undefined) ?? {}
  if (tarea && !tareas[clave]) {
    tareas[clave] = ahora
    await $.store.set('tareas', tareas)
  }

  const p: Presencia = {
    v: 1,
    sesion,
    usuario: quien.login,
    nombre: quien.nombre,
    estado: 'trabajando',
    repo: local.repo,
    rama: local.rama,
    tarea,
    nota: ajustes.nota ?? null,
    inicio,
    tareaDesde: tarea ? (tareas[clave] ?? null) : null,
    actualizado: ahora,
    archivos: local.archivos,
  }
  // Sin cambios de fondo desde la última vez: no gastar llamadas (el latido igual publica cada 5 min)
  const huella = JSON.stringify({ ...p, actualizado: '', ausente })
  if (!forzar && huella === ultimaPublicacion) return
  const mio = await miComentario($, quien.login)
  await escribirComentario($, mio, ponerSesion(mio?.comentario ?? null, p, ahoraMs, { ausente }))
  ultimaPublicacion = huella
}

/** Saca la entrada de una sesión al cerrarla; mis otras sesiones abiertas siguen publicando la suya. */
async function retirar($: EngineInterface, sesion: string): Promise<void> {
  const quien = await obtenerYo($)
  const mio = await miComentario($, quien.login)
  if (!mio) return
  const ahora = new Date(await $.clock.now()).toISOString()
  await escribirComentario($, mio, quitarSesion(mio.comentario, sesion, ahora))
}

// ------------------------------------------------------------------ qué hacen los demás
async function leerTarea($: EngineInterface, repo: string, numero: number, ahoraMs: number): Promise<Tarea | null> {
  const clave = `${repo}#${numero}`
  const c = cacheTareas.get(clave)
  if (c && ahoraMs - c.en < 5 * 60000) return c.tarea
  try {
    const i = await ghJson<{ title: string; body: string | null; state: string; html_url: string }>($, ['api', `repos/${repo}/issues/${numero}`])
    const tarea: Tarea = {
      ...tareaVacia(numero, i.html_url),
      titulo: i.title,
      talle: talleDesdeCuerpo(i.body),
      abierta: i.state === 'open',
    }
    await completarTablero($, repo, numero, tarea)
    cacheTareas.set(clave, { en: ahoraMs, tarea })
    return tarea
  } catch {
    return null
  }
}

/** Campos "Talle", "Tiempo real" y "Status" del tablero de Projects, si el Issue está en uno. */
async function completarTablero($: EngineInterface, repo: string, numero: number, tarea: Tarea): Promise<void> {
  const [owner, name] = repo.split('/')
  const consulta = `query($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){issue(number:$n){projectItems(first:5){nodes{fieldValues(first:20){nodes{__typename ... on ProjectV2ItemFieldNumberValue{number field{... on ProjectV2FieldCommon{name}}} ... on ProjectV2ItemFieldSingleSelectValue{name field{... on ProjectV2FieldCommon{name}}}}}}}}}}`
  try {
    const r = await ghJson<{
      data?: { repository?: { issue?: { projectItems?: { nodes?: Array<{ fieldValues?: { nodes?: Array<Record<string, unknown>> } }> } } } }
    }>($, ['api', 'graphql', '-f', `query=${consulta}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `n=${numero}`])
    const items = r.data?.repository?.issue?.projectItems?.nodes ?? []
    for (const item of items) {
      for (const v of item.fieldValues?.nodes ?? []) {
        const campo = String((v.field as { name?: string } | undefined)?.name ?? '').toLowerCase()
        if (campo === 'tiempo real' && typeof v.number === 'number') tarea.horasRegistradas = v.number
        if (campo === 'status' && typeof v.name === 'string') tarea.estadoTablero = v.name
        if (campo === 'talle' && typeof v.name === 'string' && (v.name === 'S' || v.name === 'M')) tarea.talle = v.name
      }
    }
  } catch {
    // Sin tablero o sin permiso "project": se muestra lo que hay.
  }
}

async function leerPrs($: EngineInterface, repo: string, login: string): Promise<Pr[]> {
  try {
    const lista = await ghJson<Array<{ number: number; title: string; url: string; isDraft: boolean; statusCheckRollup: unknown }>>($, [
      'pr', 'list', '--repo', repo, '--author', login, '--state', 'open', '--limit', '10',
      '--json', 'number,title,url,isDraft,statusCheckRollup',
    ])
    return lista.map(pr => ({ numero: pr.number, titulo: pr.title, url: pr.url, borrador: pr.isDraft, ci: ciDesdeRollup(pr.statusCheckRollup) }))
  } catch {
    return []
  }
}

async function leerUltimoCommit($: EngineInterface, repo: string, login: string): Promise<Miembro['ultimoCommit']> {
  try {
    const lista = await ghJson<Array<{ commit: { message: string; author: { date: string } } }>>($, [
      'api', `repos/${repo}/commits?author=${encodeURIComponent(login)}&per_page=1`,
    ])
    const c = lista[0]
    return c ? { fecha: c.commit.author.date, mensaje: (c.commit.message.split('\n')[0] ?? '').slice(0, 80) } : null
  } catch {
    return null
  }
}

async function refrescar($: EngineInterface): Promise<void> {
  if (ocupado) return
  ocupado = true
  try {
    const quien = yo ?? (await obtenerYo($).catch(() => null))
    const ahoraMs = await $.clock.now()
    const comentarios = await ghJson<Array<{ id: number; body: string }>>($, [
      'api', `repos/${config.datos}/issues/${config.issue}/comments?per_page=100`,
    ])
    // Una ficha por persona, aunque tenga más de un comentario (ver unirComentarios)
    const porPersona = new Map<string, ComentarioPresencia>()
    for (const c of comentarios) {
      const comentario = extraerComentario(c.body)
      if (!comentario) continue
      const clave = comentario.usuario.toLowerCase()
      porPersona.set(clave, unirComentarios(porPersona.get(clave), comentario))
    }
    const lista: Miembro[] = []
    for (const comentario of porPersona.values()) {
      const elegida = elegirPrincipal(comentario, ahoraMs)
      const nombre = config.nombres[comentario.usuario.toLowerCase()] ?? comentario.nombre
      const presencia: Presencia = { ...elegida.presencia, nombre }
      const otras = elegida.otras.map(o => ({ ...o, nombre }))
      const tarea = presencia.repo && presencia.tarea ? await leerTarea($, presencia.repo, presencia.tarea, ahoraMs) : null
      const prs = presencia.repo ? await leerPrs($, presencia.repo, presencia.usuario) : []
      const ultimoCommit = presencia.repo ? await leerUltimoCommit($, presencia.repo, presencia.usuario) : null
      lista.push({ presencia, otras, tarea, prs, ultimoCommit, esYo: !!quien && presencia.usuario.toLowerCase() === quien.login.toLowerCase() })
    }
    const ordenada = ordenar(lista)
    const antes = await read($, miembros)
    if (antes.length > 0) {
      for (const aviso of diferencias(antes, ordenada, quien?.login ?? null)) $.ui.toast(aviso, { timeoutMs: 7000 })
      const previos = new Set(choques(antes, quien?.login ?? null).map(c => `${c.con}:${c.archivos.join(',')}`))
      for (const ch of choques(ordenada, quien?.login ?? null)) {
        if (!previos.has(`${ch.con}:${ch.archivos.join(',')}`)) $.ui.toast(`Atención: ${ch.con} también toca ${ch.archivos.slice(0, 3).join(', ')}`, { timeoutMs: 9000 })
      }
    }
    await update($, miembros, () => ordenada)
    await update($, info, i => ({ ...i, yo: quien?.login ?? null, error: null, actualizado: new Date(ahoraMs).toISOString(), datos: config.datos }))
    $.ui.status(resumen(ordenada, quien?.login ?? null, ahoraMs))
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err)
    await update($, info, i => ({ ...i, error: mensaje, datos: config.datos }))
  } finally {
    ocupado = false
  }
}

// ------------------------------------------------------------------ arranque y comandos
async function arrancar($: EngineInterface): Promise<void> {
  await $.store.delete('sesion').catch(() => undefined) // clave de la v0.2, compartida entre sesiones
  try {
    await publicar($, true, false) // abrir una sesión es volver a la oficina
  } catch (err) {
    await update($, info, i => ({ ...i, error: err instanceof Error ? err.message : String(err), datos: config.datos }))
  }
  await refrescar($)
  $.clock.every(Math.max(20, config.intervalo) * 1000, () => {
    void refrescar($)
  })
  $.clock.every(5 * 60000, () => {
    void publicar($, true).catch(() => undefined)
  })
}

async function iniciar($: EngineInterface): Promise<string> {
  const pasos: string[] = []
  const existe = await $.process.run(['gh', 'repo', 'view', config.datos, '--json', 'name'], { timeoutMs: 20000 })
  if (existe.exitCode !== 0) {
    await gh($, ['repo', 'create', config.datos, '--private', '--description', 'Presencia de la oficina Quintech Studio (datos del mod oficina)'])
    pasos.push(`Repositorio privado ${config.datos} creado.`)
  } else {
    pasos.push(`Repositorio ${config.datos} ya existe.`)
  }
  const issues = await ghJson<Array<{ number: number; title: string }>>($, ['issue', 'list', '--repo', config.datos, '--state', 'all', '--json', 'number,title', '--limit', '50'])
  let presencia = issues.find(i => i.title.toLowerCase() === 'presencia')
  if (!presencia) {
    await gh($, [
      'issue', 'create', '--repo', config.datos, '--title', 'Presencia',
      '--body', 'Cada integrante tiene un comentario en este Issue que el mod "oficina" actualiza solo. No editar a mano.',
    ])
    const otra = await ghJson<Array<{ number: number; title: string }>>($, ['issue', 'list', '--repo', config.datos, '--state', 'all', '--json', 'number,title', '--limit', '50'])
    presencia = otra.find(i => i.title.toLowerCase() === 'presencia')
    pasos.push(`Issue "Presencia" creado (#${presencia?.number ?? '?'}).`)
  } else {
    pasos.push(`Issue "Presencia" ya existe (#${presencia.number}).`)
  }
  if (presencia && presencia.number !== config.issue) {
    pasos.push(`Atención: el Issue es el #${presencia.number}; poné ese número en la opción "issue" del mod (/config).`)
  }
  pasos.push('Invitá al otro integrante como colaborador del repositorio de datos: gh api -X PUT repos/' + config.datos + '/collaborators/<usuario> -f permission=push')
  return pasos.join('\n')
}

const AYUDA = [
  '/oficina            abre el panel',
  '/oficina tarea 42   fija la tarea actual (auto: volver a detectarla por la rama)',
  '/oficina nota texto deja una nota visible para el otro (nota - la borra)',
  '/oficina fuera      marca que te vas; /oficina volver te marca trabajando',
  '/oficina init       crea el repositorio privado de datos y el Issue "Presencia"',
].join('\n')

export const register: Register = (on, options) => {
  config = {
    datos: String(options.datos ?? 'quintechlab/oficina-datos'),
    issue: Number(options.issue ?? 1) || 1,
    intervalo: Number(options.intervalo ?? 60) || 60,
    nombres: mapaNombres(String(options.nombres ?? '')),
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'oficina', description: 'Oficina Quintech: quién trabaja en qué', argumentHint: '[tarea N | nota texto | fuera | volver | init]' })
    const resultado = await next(e)
    // Siempre, no solo si `isInteractive`: la sesión de la app de escritorio llega como SDK (false).
    void (async () => {
      const abierto = await $.ui.open({ id: PANE, title: TITULO }).catch(() => ({ isPlaced: false }))
      if (!abierto.isPlaced) $.ui.toast('Oficina: escribí /oficina para abrir el panel', { timeoutMs: 8000 })
    })()
    void arrancar($)
    return resultado
  })

  on('command.run', { command: 'oficina' }, async ($, e) => {
    const [verbo, ...resto] = e.args.trim().split(/\s+/)
    const argumento = resto.join(' ').trim()
    const ajustes = ((await $.store.get('ajustes')) as Ajustes | undefined) ?? {}
    switch ((verbo ?? '').toLowerCase()) {
      case '':
        await $.ui.open({ id: PANE, title: TITULO })
        void refrescar($)
        return { text: 'Oficina abierta.' }
      case 'ayuda':
      case 'help':
        return { text: AYUDA }
      case 'tarea': {
        if (!argumento || argumento === 'auto') {
          const sesion = await $.session.id()
          if (ajustes.tareas) delete ajustes.tareas[sesion]
          await $.store.set('ajustes', ajustes)
          await publicar($, true).catch(() => undefined)
          return { text: 'Tarea: se detecta por la rama.' }
        }
        const n = Number(argumento.replace('#', ''))
        if (!Number.isInteger(n) || n <= 0) return { text: 'Uso: /oficina tarea 42' }
        ajustes.tareas = { ...(ajustes.tareas ?? {}), [await $.session.id()]: n }
        await $.store.set('ajustes', ajustes)
        await publicar($, true).catch(() => undefined)
        return { text: `Tarea fijada en esta sesión: #${n}.` }
      }
      case 'nota': {
        if (!argumento || argumento === '-') delete ajustes.nota
        else ajustes.nota = argumento.slice(0, 140)
        await $.store.set('ajustes', ajustes)
        await publicar($, true).catch(() => undefined)
        return { text: ajustes.nota ? `Nota publicada: ${ajustes.nota}` : 'Nota borrada.' }
      }
      case 'fuera':
        await publicar($, true, true).catch(() => undefined)
        await refrescar($)
        return { text: 'Marcado como fuera, en todas tus sesiones, hasta /oficina volver.' }
      case 'volver':
        await publicar($, true, false).catch(() => undefined)
        await refrescar($)
        return { text: 'Marcado como trabajando.' }
      case 'init':
        try {
          return { text: await iniciar($) }
        } catch (err) {
          return { text: `No se pudo iniciar: ${err instanceof Error ? err.message : String(err)}` }
        }
      default:
        return { text: `No entiendo "${verbo}".\n${AYUDA}` }
    }
  })

  // Cambio de rama con git: la tarea puede haber cambiado.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const resultado = await next(e)
    if (e.tool === 'Bash' && /\bgit\s+(switch|checkout)\b/.test(e.command)) void publicar($).catch(() => undefined)
    return resultado
  }).catch((_$, e, next) => next(e)) // nunca bloquea un comando: si el mod falla, el comando sigue

  on('session.end', async ($, e, next) => {
    // Solo la entrada de esta sesión. Tras un /clear la sesión nueva vuelve a publicar en el próximo latido.
    await retirar($, e.sessionId).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const tabla = $.ui.resolve(e)
    const { Box, Text, Button } = tabla
    const Svg = e.surface !== 'terminal' && 'Svg' in tabla ? tabla.Svg : null // en terminal un Svg se dibuja vacío
    const lista = await read($, miembros)
    const datos = await read($, info)
    const ahoraMs = await $.clock.now()
    const yoLogin = datos.yo
    const misChoques = choques(lista, yoLogin)

    // ---- Opción A: cabecera en SVG (avatar, nombre, estado) y secciones de texto con marcador.
    // La superficie de VS Code ignora márgenes, paddings y tamaños de las cajas: el aire se hace
    // con líneas en blanco y sangría, y la cabecera con un SVG que dibuja su propio fondo.
    const SANGRIA = '   '
    const VACIA = ' '
    const escapar = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
    const recortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

    const cabecera = (m: Miembro, acento: string) => {
      const p = m.presencia
      const ev = estadoVisible(p, ahoraMs)
      const punto = ev === 'activo' ? '#3FB950' : ev === 'inactivo' ? AMARILLO : GRIS_CLARO
      // El SVG se vuelve a cargar cada vez que cambia su texto, y mientras carga la superficie muestra
      // el `alt`: por eso adentro va solo lo que casi no cambia, y el tiempo, que cambia cada minuto, va abajo.
      const estadoCorto = ev === 'activo' ? 'trabajando' : ev === 'inactivo' ? 'sin señales' : 'fuera'
      const desde = p.inicio ? `desde ${horaLocal(p.inicio)} · lleva ${formatoDuracion(ahoraMs - new Date(p.inicio).getTime())}` : ''
      const detalle =
        ev === 'activo' ? desde
          : ev === 'inactivo' ? `sin señales hace ${formatoDuracion(ahoraMs - new Date(p.actualizado).getTime())}${desde ? ` · ${desde}` : ''}`
            : `última señal ${fechaCorta(p.actualizado)} ${horaLocal(p.actualizado)}`
      const ini = iniciales(p.nombre)
      const alt = `${p.nombre}${m.esYo ? ' (vos)' : ''}, ${estadoCorto}`
      if (Svg) {
        const fuente =
          `<svg xmlns="http://www.w3.org/2000/svg" width="364" height="92" viewBox="0 0 364 92" font-family="Segoe UI, Manrope, Helvetica, Arial, sans-serif">` +
          `<rect x="0" y="0" width="364" height="92" rx="8" fill="#10131B"/>` +
          `<circle cx="44" cy="46" r="24" fill="${NEGRO}" stroke="${ev === 'fuera' ? GRIS_CLARO : acento}" stroke-width="3"/>` +
          `<text x="44" y="52" text-anchor="middle" font-size="17" font-weight="700" fill="#FFFFFF" letter-spacing="1">${escapar(ini)}</text>` +
          `<circle cx="62" cy="64" r="6.5" fill="${punto}" stroke="#10131B" stroke-width="2"/>` +
          `<text x="84" y="40" font-size="17" font-weight="700" fill="#F3F4F6">${escapar(recortar(p.nombre, 18))}` +
          (m.esYo ? `<tspan fill="#8B909C" font-weight="400" font-size="13"> (vos)</tspan>` : '') +
          `</text>` +
          `<text x="84" y="62" font-size="12.5" fill="${punto}">● ${escapar(estadoCorto)}</text>` +
          `<line x1="16" y1="84" x2="348" y2="84" stroke="#2A2D35" stroke-width="1"/>` +
          `</svg>`
        return (
          <Box flexDirection="column">
            <Svg source={fuente} alt={alt} width={364} height={92} />
            {detalle ? <Text dimColor>{SANGRIA}{detalle}</Text> : null}
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          <Text>{VACIA}</Text>
          <Text>
            {SANGRIA}<Text backgroundColor={acento} color={NEGRO} bold>{` ${ini} `}</Text>{'  '}
            <Text bold>{p.nombre}</Text>{m.esYo ? <Text dimColor> (vos)</Text> : null}
          </Text>
          <Text>
            {SANGRIA}<Text color={punto}>{ev === 'activo' ? '●' : ev === 'inactivo' ? '◐' : '○'}</Text>
            <Text color={punto}> {estadoCorto}</Text><Text dimColor>{detalle ? ` · ${detalle}` : ''}</Text>
          </Text>
          <Text dimColor>{SANGRIA}{'─'.repeat(34)}</Text>
        </Box>
      )
    }

    const Rotulo = (props: { acento: string; texto: string }) => (
      <Text>{SANGRIA}<Text color={props.acento}>▍</Text><Text dimColor> {props.texto.toUpperCase()}</Text></Text>
    )

    const tarjeta = (m: Miembro, i: number) => {
      const p = m.presencia
      const acento = ACENTOS[i % ACENTOS.length] ?? AMARILLO
      const ev = estadoVisible(p, ahoraMs)

      const choque = misChoques.find(c => c.con === p.nombre)
      const [duenio, nombreRepo] = p.repo ? p.repo.split('/') : [null, null]
      const ciColor = (pr: Pr) => (pr.ci === 'ok' ? 'success' : pr.ci === 'falla' ? 'error' : pr.ci === 'pendiente' ? 'warning' : 'inactive')
      const ciSigno = (pr: Pr) => (pr.ci === 'ok' ? '✓' : pr.ci === 'falla' ? '✗' : pr.ci === 'pendiente' ? '…' : '·')
      return (
        <Box key={p.usuario} flexDirection="column" borderStyle="round" borderColor={ev === 'fuera' ? 'inactive' : acento}>
          {cabecera(m, acento)}

          {ev !== 'fuera' ? (
            <Box flexDirection="column">
              <Text>{VACIA}</Text>
              <Rotulo acento={acento} texto="Proyecto" />
              {p.repo ? (
                <Text>{SANGRIA}<Text dimColor>{duenio}/</Text>{nombreRepo}{p.rama ? <Text dimColor> · {p.rama}</Text> : null}</Text>
              ) : (
                <Text dimColor>{SANGRIA}fuera de un repositorio</Text>
              )}
              {m.otras.length > 0 ? (
                <Text dimColor>
                  {SANGRIA}también en: {m.otras.map(o => `${o.repo?.split('/')[1] ?? o.repo}${o.tarea ? ` #${o.tarea}` : ''}`).join(', ')}
                </Text>
              ) : null}
            </Box>
          ) : null}

          {ev !== 'fuera' ? (
            <Box flexDirection="column">
              <Text>{VACIA}</Text>
              <Rotulo acento={acento} texto="Tarea" />
              {p.tarea ? (
                <Text>
                  {SANGRIA}<Text color={acento} bold>#{p.tarea}</Text>
                  {m.tarea?.titulo ? ` ${m.tarea.titulo}` : ' (sin acceso al Issue)'}
                  {m.tarea?.talle ? <Text backgroundColor={acento} color={NEGRO}>{` ${m.tarea.talle} `}</Text> : null}
                  {m.tarea && !m.tarea.abierta ? <Text color="merged"> cerrada</Text> : null}
                </Text>
              ) : (
                <Text dimColor>{SANGRIA}sin tarea · rama sin número, o /oficina tarea N</Text>
              )}
              {m.tarea?.estadoTablero ? <Text dimColor>{SANGRIA}tablero: {m.tarea.estadoTablero}</Text> : null}
              {p.tareaDesde && p.inicio && fechaCorta(p.tareaDesde) !== fechaCorta(p.inicio) ? <Text dimColor>{SANGRIA}en esta tarea desde el {fechaCorta(p.tareaDesde)}</Text> : null}
              {m.tarea?.horasRegistradas ? <Text dimColor>{SANGRIA}{m.tarea.horasRegistradas} h cargadas en el tablero</Text> : null}
              {p.nota ? <Text italic color={AMARILLO}>{SANGRIA}“{p.nota}”</Text> : null}
            </Box>
          ) : null}

          {m.prs.length > 0 ? (
            <Box flexDirection="column">
              <Text>{VACIA}</Text>
              <Rotulo acento={acento} texto={m.prs.length === 1 ? 'PR abierto' : 'PRs abiertos'} />
              {m.prs.map(pr => (
                <Text key={`pr-${p.usuario}-${pr.numero}`}>
                  {SANGRIA}<Text color={ciColor(pr)}>{ciSigno(pr)}</Text>
                  {` PR #${pr.numero} ${pr.titulo}`}{pr.borrador ? <Text dimColor> (borrador)</Text> : null}
                </Text>
              ))}
            </Box>
          ) : null}

          {choque ? (
            <Box flexDirection="column">
              <Text>{VACIA}</Text>
              <Text color="warning">{SANGRIA}⚠ toca lo mismo que vos: {choque.archivos.slice(0, 4).join(', ')}{choque.archivos.length > 4 ? ` y ${choque.archivos.length - 4} más` : ''}</Text>
            </Box>
          ) : null}

          {m.ultimoCommit ? (
            <Box flexDirection="column">
              <Text>{VACIA}</Text>
              <Rotulo acento={acento} texto="Último commit" />
              <Text>{SANGRIA}hace {formatoDuracion(ahoraMs - new Date(m.ultimoCommit.fecha).getTime())}<Text dimColor> · {m.ultimoCommit.mensaje}</Text></Text>
            </Box>
          ) : null}
          <Text>{VACIA}</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX="sm" paddingY="sm">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="md">
          <Text color={AMARILLO} weight="semibold">OFICINA</Text>
          <Button key="actualizar" label="Actualizar" onPress={() => { void refrescar($) }} />
        </Box>
        {datos.error ? <Box marginBottom="sm"><Text color="error">GitHub: {datos.error}</Text></Box> : null}
        {lista.length === 0 && !datos.error ? <Text dimColor>Leyendo la oficina…</Text> : null}
        {lista.length === 0 && datos.error ? <Text dimColor>¿Primera vez? Corré /oficina init (necesita gh autenticado) y revisá la opción "datos" en /config.</Text> : null}
        {lista.map((m, i) => (
          <Box key={`ficha-${m.presencia.usuario}`} flexDirection="column">
            {i > 0 ? <Text>{VACIA}</Text> : null}
            {tarjeta(m, i)}
          </Box>
        ))}
        <Text>{VACIA}</Text>
        {datos.actualizado ? <Text dimColor size="caption">actualizado {horaLocal(datos.actualizado)} · cada {config.intervalo} s</Text> : null}
      </Box>
    )
  })
}
