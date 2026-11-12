// Oficina Quintech Studio: panel de presencia del equipo sobre GitHub.
//
// Cada integrante publica su presencia (repo, rama, tarea, desde cuándo) en un comentario
// propio de un Issue de un repositorio privado, con su propio `gh` autenticado. El mod lee
// los comentarios de todos cada `intervalo` segundos y dibuja la oficina.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Info, Miembro, Pr, Presencia, Tarea } from '../types'
import {
  ciDesdeRollup,
  choques,
  diferencias,
  estadoVisible,
  extraerPresencia,
  envolverPresencia,
  fechaCorta,
  formatoDuracion,
  horaLocal,
  iniciales,
  mapaNombres,
  ordenar,
  repoDesdeRemoto,
  restante,
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
const miembros = atom({ plugin: 'oficina', key: 'miembros' } as const, [] as Miembro[], { shape: 'miembros-1' })
const info = atom({ plugin: 'oficina', key: 'info' } as const, {
  yo: null,
  error: null,
  actualizado: null,
  datos: '',
} as Info)

type Config = { datos: string; issue: number; intervalo: number; nombres: Record<string, string> }
type Yo = { login: string; nombre: string }
type Ajustes = { tarea?: number; nota?: string }
type Sesion = { clave: string; inicio: string }

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
  return { repo, rama, archivos }
}

async function miComentario($: EngineInterface, login: string): Promise<number | null> {
  const lista = await ghJson<Array<{ id: number; body: string; user: { login: string } }>>($, [
    'api',
    `repos/${config.datos}/issues/${config.issue}/comments?per_page=100`,
  ])
  const mio = lista.find(c => c.user.login.toLowerCase() === login.toLowerCase() && extraerPresencia(c.body))
  return mio ? mio.id : null
}

/** Publica mi presencia en mi comentario del Issue (lo crea la primera vez). */
async function publicar($: EngineInterface, estado: Presencia['estado'], forzar = false): Promise<void> {
  const quien = await obtenerYo($)
  const local = await leerLocal($)
  const ajustes = ((await $.store.get('ajustes')) as Ajustes | undefined) ?? {}
  const tarea = ajustes.tarea ?? tareaDesdeRama(local.rama)
  const ahoraMs = await $.clock.now()
  const ahora = new Date(ahoraMs).toISOString()

  const clave = `${local.repo ?? '-'}#${tarea ?? '-'}`
  let sesion = (await $.store.get('sesion')) as Sesion | undefined
  if (!sesion || sesion.clave !== clave) {
    sesion = { clave, inicio: ahora }
    await $.store.set('sesion', sesion)
  }
  const tareas = ((await $.store.get('tareas')) as Record<string, string> | undefined) ?? {}
  if (tarea && !tareas[clave]) {
    tareas[clave] = ahora
    await $.store.set('tareas', tareas)
  }

  const p: Presencia = {
    v: 1,
    usuario: quien.login,
    nombre: quien.nombre,
    estado,
    repo: local.repo,
    rama: local.rama,
    tarea,
    nota: ajustes.nota ?? null,
    inicio: estado === 'fuera' ? null : sesion.inicio,
    tareaDesde: tarea ? (tareas[clave] ?? null) : null,
    actualizado: ahora,
    archivos: local.archivos,
  }
  // Sin cambios de fondo desde la última vez: no gastar llamadas (el latido igual publica cada 5 min)
  const huella = JSON.stringify({ ...p, actualizado: '' })
  if (!forzar && huella === ultimaPublicacion) return
  const cuerpo = envolverPresencia(p)
  const id = await miComentario($, quien.login)
  if (id) await gh($, ['api', '-X', 'PATCH', `repos/${config.datos}/issues/comments/${id}`, '-f', `body=${cuerpo}`])
  else await gh($, ['api', '-X', 'POST', `repos/${config.datos}/issues/${config.issue}/comments`, '-f', `body=${cuerpo}`])
  ultimaPublicacion = huella
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
    const lista: Miembro[] = []
    for (const c of comentarios) {
      const p = extraerPresencia(c.body)
      if (!p) continue
      const nombre = config.nombres[p.usuario.toLowerCase()] ?? p.nombre
      const presencia: Presencia = { ...p, nombre }
      const tarea = presencia.repo && presencia.tarea ? await leerTarea($, presencia.repo, presencia.tarea, ahoraMs) : null
      const prs = presencia.repo ? await leerPrs($, presencia.repo, presencia.usuario) : []
      const ultimoCommit = presencia.repo ? await leerUltimoCommit($, presencia.repo, presencia.usuario) : null
      lista.push({ presencia, tarea, prs, ultimoCommit, esYo: !!quien && presencia.usuario.toLowerCase() === quien.login.toLowerCase() })
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
  await $.store.set('sesion', undefined as unknown as Sesion).catch(() => undefined)
  await $.store.delete('sesion').catch(() => undefined)
  try {
    await publicar($, 'trabajando', true)
  } catch (err) {
    await update($, info, i => ({ ...i, error: err instanceof Error ? err.message : String(err), datos: config.datos }))
  }
  await refrescar($)
  $.clock.every(Math.max(20, config.intervalo) * 1000, () => {
    void refrescar($)
  })
  $.clock.every(5 * 60000, () => {
    void publicar($, 'trabajando', true).catch(() => undefined)
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
    if (e.isInteractive) {
      void $.ui.open({ id: PANE, title: TITULO })
      void arrancar($)
    }
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
          delete ajustes.tarea
          await $.store.set('ajustes', ajustes)
          await publicar($, 'trabajando', true).catch(() => undefined)
          return { text: 'Tarea: se detecta por la rama.' }
        }
        const n = Number(argumento.replace('#', ''))
        if (!Number.isInteger(n) || n <= 0) return { text: 'Uso: /oficina tarea 42' }
        ajustes.tarea = n
        await $.store.set('ajustes', ajustes)
        await publicar($, 'trabajando', true).catch(() => undefined)
        return { text: `Tarea fijada: #${n}.` }
      }
      case 'nota': {
        if (!argumento || argumento === '-') delete ajustes.nota
        else ajustes.nota = argumento.slice(0, 140)
        await $.store.set('ajustes', ajustes)
        await publicar($, 'trabajando', true).catch(() => undefined)
        return { text: ajustes.nota ? `Nota publicada: ${ajustes.nota}` : 'Nota borrada.' }
      }
      case 'fuera':
        await publicar($, 'fuera', true).catch(() => undefined)
        await refrescar($)
        return { text: 'Marcado como fuera.' }
      case 'volver':
        await publicar($, 'trabajando', true).catch(() => undefined)
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
    if (e.tool === 'Bash' && /\bgit\s+(switch|checkout)\b/.test(e.command)) void publicar($, 'trabajando').catch(() => undefined)
    return resultado
  }).catch((_$, e, next) => next(e)) // nunca bloquea un comando: si el mod falla, el comando sigue

  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear') await publicar($, 'fuera', true).catch(() => undefined)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const tabla = $.ui.resolve(e)
    const { Box, Text, Button } = tabla
    const Svg = 'Svg' in tabla ? tabla.Svg : null
    const lista = await read($, miembros)
    const datos = await read($, info)
    const ahoraMs = await $.clock.now()
    const yoLogin = datos.yo
    const misChoques = choques(lista, yoLogin)

    const avatar = (m: Miembro, acento: string) => {
      const ev = estadoVisible(m.presencia, ahoraMs)
      const punto = ev === 'activo' ? '#3FB950' : ev === 'inactivo' ? AMARILLO : GRIS_CLARO
      const ini = iniciales(m.presencia.nombre)
      if (Svg) {
        const fuente = `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="23" fill="${NEGRO}" stroke="${acento}" stroke-width="3"/><text x="26" y="32" text-anchor="middle" font-family="Segoe UI, Manrope, Helvetica, Arial, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF" letter-spacing="1">${ini}</text><circle cx="43" cy="43" r="6.5" fill="${punto}" stroke="${NEGRO}" stroke-width="2"/></svg>`
        return <Svg source={fuente} alt={`Avatar de ${m.presencia.nombre}, ${ev}`} width={52} height={52} />
      }
      return (
        <Box flexDirection="column" alignItems="center">
          <Text backgroundColor={acento} color={NEGRO} bold>{` ${ini} `}</Text>
          <Text color={punto}>{ev === 'activo' ? '●' : ev === 'inactivo' ? '◐' : '○'}</Text>
        </Box>
      )
    }

    const tarjeta = (m: Miembro, i: number) => {
      const p = m.presencia
      const acento = ACENTOS[i % ACENTOS.length] ?? AMARILLO
      const ev = estadoVisible(p, ahoraMs)
      const estadoTexto = ev === 'activo' ? 'trabajando' : ev === 'inactivo' ? `sin señales hace ${formatoDuracion(ahoraMs - new Date(p.actualizado).getTime())}` : 'fuera'
      const estadoColor = ev === 'activo' ? 'success' : ev === 'inactivo' ? 'warning' : 'inactive'
      const rest = restante(m.tarea?.talle ?? null, m.tarea?.horasRegistradas ?? null, p.inicio, ahoraMs)
      const choque = misChoques.find(c => c.con === p.nombre)
      return (
        <Box key={p.usuario} flexDirection="row" gap="md" padding="sm" marginBottom="sm" borderStyle="round" borderColor={ev === 'fuera' ? 'inactive' : acento}>
          {avatar(m, acento)}
          <Box flexDirection="column" flexGrow={1} gap={0}>
            <Box flexDirection="row" justifyContent="space-between" gap="md">
              <Text weight="bold" size="heading">{p.nombre}{m.esYo ? <Text dimColor> (vos)</Text> : null}</Text>
              <Text color={estadoColor}>{estadoTexto}</Text>
            </Box>
            {p.repo ? (
              <Text dimColor>{p.repo}{p.rama ? ` · ${p.rama}` : ''}</Text>
            ) : (
              <Text dimColor>{ev === 'fuera' ? '' : 'fuera de un repositorio'}</Text>
            )}
            {p.tarea ? (
              <Text>
                <Text color={acento} weight="bold">#{p.tarea}</Text>
                {m.tarea?.titulo ? ` ${m.tarea.titulo}` : ' (sin acceso al Issue)'}
                {m.tarea?.talle ? <Text backgroundColor={acento} color={NEGRO}>{` ${m.tarea.talle} `}</Text> : null}
                {m.tarea && !m.tarea.abierta ? <Text color="merged"> cerrada</Text> : null}
                {m.tarea?.estadoTablero ? <Text dimColor> · {m.tarea.estadoTablero}</Text> : null}
              </Text>
            ) : ev !== 'fuera' ? (
              <Text dimColor>sin tarea asignada (rama sin número o /oficina tarea N)</Text>
            ) : null}
            {ev !== 'fuera' && p.inicio ? (
              <Text>
                <Text dimColor>desde </Text>{horaLocal(p.inicio)}
                <Text dimColor> · lleva {formatoDuracion(ahoraMs - new Date(p.inicio).getTime())}</Text>
                {p.tareaDesde && fechaCorta(p.tareaDesde) !== fechaCorta(p.inicio) ? <Text dimColor> · en esta tarea desde el {fechaCorta(p.tareaDesde)}</Text> : null}
              </Text>
            ) : null}
            {ev !== 'fuera' && rest ? (
              rest.excedido ? (
                <Text color="error">talle {m.tarea?.talle}: excedido en {formatoDuracion(-rest.quedanMs)} (de {formatoDuracion(rest.totalMs)})</Text>
              ) : (
                <Text color={rest.quedanMs < rest.totalMs * 0.25 ? 'warning' : 'text'}>
                  quedan ~{formatoDuracion(rest.quedanMs)} <Text dimColor>de {formatoDuracion(rest.totalMs)} (talle {m.tarea?.talle}{m.tarea?.horasRegistradas ? `, ${m.tarea.horasRegistradas} h ya cargadas` : ''})</Text>
                </Text>
              )
            ) : null}
            {ev !== 'fuera' && p.tarea && m.tarea && !rest ? <Text dimColor>sin talle en el Issue: sin estimación</Text> : null}
            {p.nota ? <Text italic color={AMARILLO}>“{p.nota}”</Text> : null}
            {m.prs.map(pr => (
              <Text key={`pr-${p.usuario}-${pr.numero}`}>
                <Text color={pr.ci === 'ok' ? 'success' : pr.ci === 'falla' ? 'error' : pr.ci === 'pendiente' ? 'warning' : 'inactive'}>
                  {pr.ci === 'ok' ? '✓' : pr.ci === 'falla' ? '✗' : pr.ci === 'pendiente' ? '…' : '·'}
                </Text>
                {` PR #${pr.numero} ${pr.titulo}`}{pr.borrador ? <Text dimColor> (borrador)</Text> : null}
              </Text>
            ))}
            {choque ? <Text color="warning">⚠ toca lo mismo que vos: {choque.archivos.slice(0, 4).join(', ')}{choque.archivos.length > 4 ? ` y ${choque.archivos.length - 4} más` : ''}</Text> : null}
            {m.ultimoCommit ? <Text dimColor>último commit hace {formatoDuracion(ahoraMs - new Date(m.ultimoCommit.fecha).getTime())}: {m.ultimoCommit.mensaje}</Text> : null}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" padding="sm">
        <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginBottom="sm">
          <Text color={AMARILLO} weight="semibold">OFICINA · QUINTECH STUDIO</Text>
          <Button key="actualizar" label="Actualizar" onPress={() => { void refrescar($) }} />
        </Box>
        {datos.error ? <Text color="error">GitHub: {datos.error}</Text> : null}
        {lista.length === 0 && !datos.error ? <Text dimColor>Leyendo la oficina…</Text> : null}
        {lista.length === 0 && datos.error ? <Text dimColor>¿Primera vez? Corré /oficina init (necesita gh autenticado) y revisá la opción "datos" en /config.</Text> : null}
        {lista.map(tarjeta)}
        {datos.actualizado ? <Text dimColor size="caption">actualizado {horaLocal(datos.actualizado)} · cada {config.intervalo} s · datos en {datos.datos}</Text> : null}
      </Box>
    )
  })
}
