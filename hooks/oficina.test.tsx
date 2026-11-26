import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { ComentarioPresencia, Miembro, Pregunta, Presencia } from '../types'
import {
  leerMarca,
  marcarMensaje,
  MINUTOS_CONVERSA_QUIETA,
  podarConversas,
  registrarMensaje,
  archivosDesdeStatus,
  archivosEnComun,
  choques,
  ciDesdeRollup,
  diferencias,
  elegirPrincipal,
  envolverComentario,
  esRepoLocal,
  proyectoDesdeRepo,
  proyectoDesdeCarpeta,
  estadoVisible,
  extraerComentario,
  formatoDuracion,
  actividadDesdeHerramienta,
  iniciales,
  latidoLocal,
  presenciaLocal,
  puedeEscribirLocal,
  mapaNombres,
  NOMBRES_INVENTADOS,
  nombreSubagente,
  subagentesEnCurso,
  anotarPaso,
  MAX_PASOS,
  podarSubagentes,
  ponerSesion,
  preguntaDesdeEntrada,
  quitarSesion,
  unirComentarios,
  repoDesdeRemoto,
  restante,
  talleDesdeCuerpo,
  tareaDesdeRama,
  validarRespuesta,
  vigilarRespuesta,
  carreraConDialogo,
  resultadoDelWidget,
  idProcesoDesdeResultado,
  procesoDesdeEntrada,
  avisosDeTareas,
  tareaTerminada,
  podarProcesos,
  actividadEnEspera,
  esActividadEnEspera,
  HORAS_PROCESO,
  validarOrden,
  MAX_EDAD_ORDEN_MS,
  MS_ENTRE_ORDENES,
} from './logica'

const PANE = {
  plugin: 'oficina',
  component: 'Pane',
  requestId: 'oficina',
  props: {
    title: 'Avis · Quintech Studio',
    isFocused: false,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const AHORA = '2026-11-12T17:00:00.000Z'

function presencia(extra: Partial<Presencia>): Presencia {
  return {
    v: 1,
    sesion: 'sesion-1',
    usuario: 'campos',
    nombre: 'Campos',
    estado: 'trabajando',
    repo: 'quintechlab/catalogo',
    rama: 'feat/51-carrito',
    tarea: 51,
    nota: null,
    inicio: '2026-11-12T15:40:00.000Z',
    tareaDesde: '2026-11-12T15:40:00.000Z',
    actualizado: AHORA,
    archivos: ['src/carrito.ts'],
    ...extra,
  }
}

function miembro(extra: Omit<Partial<Miembro>, 'presencia'> & { presencia?: Partial<Presencia> }): Miembro {
  const { presencia: parcial, ...resto } = extra
  return {
    presencia: presencia(parcial ?? {}),
    otras: [],
    sesiones: [presencia(parcial ?? {})],
    tarea: { numero: 51, titulo: 'Carrito de compras', talle: 'M', abierta: true, url: '', horasRegistradas: 3, estadoTablero: 'En progreso' },
    prs: [],
    ultimoCommit: null,
    esYo: false,
    ...resto,
  }
}

test('la tarea se detecta de la rama tipo/<n>-slug', async () => {
  expect(tareaDesdeRama('feat/12-login-google')).toBe(12)
  expect(tareaDesdeRama('fix/7-typo')).toBe(7)
  expect(tareaDesdeRama('42-sin-tipo')).toBe(42)
  expect(tareaDesdeRama('main')).toBe(null)
  expect(tareaDesdeRama(null)).toBe(null)
})

test('un repo sin remoto de GitHub se reconoce por el nombre de su carpeta', async () => {
  expect(proyectoDesdeRepo('C:\\Users\\Nico\\Desktop\\catalogo', 'git@github.com:quintechlab/catalogo.git')).toBe('quintechlab/catalogo')
  expect(proyectoDesdeRepo('C:\\Users\\Nico\\OneDrive\\Desktop\\Proyecto Inmobiliaria', null)).toBe('local/Proyecto Inmobiliaria')
  expect(proyectoDesdeRepo('/home/nico/mis-gastos/', 'https://gitlab.com/nico/mis-gastos.git')).toBe('local/mis-gastos')
  expect(proyectoDesdeRepo('', null)).toBe(null)
  expect(esRepoLocal('local/Proyecto Inmobiliaria')).toBe(true)
  expect(esRepoLocal('quintechlab/catalogo')).toBe(false)
  expect(esRepoLocal(null)).toBe(false)
})

test('el talle se lee del cuerpo del Issue del formulario', async () => {
  expect(talleDesdeCuerpo('### Áreas que toca\n\napi\n\n### Talle\n\nM\n\n### Notas')).toBe('M')
  expect(talleDesdeCuerpo('### Talle\r\n\r\nS\r\n')).toBe('S')
  expect(talleDesdeCuerpo('sin talle')).toBe(null)
})

test('el repositorio se deduce del remoto ssh o https', async () => {
  expect(repoDesdeRemoto('git@github.com:quintechlab/catalogo.git')).toBe('quintechlab/catalogo')
  expect(repoDesdeRemoto('https://github.com/quintechlab/catalogo')).toBe('quintechlab/catalogo')
  expect(repoDesdeRemoto('https://gitlab.com/x/y.git')).toBe(null)
})

test('el comentario sobrevive ida y vuelta, y el formato v1 se lee como una sola sesión', async () => {
  const ahora = Date.parse(AHORA)
  const c = ponerSesion(null, presencia({ nota: 'viendo el bug del login' }), ahora)
  expect(extraerComentario(envolverComentario(c))).toEqual(c)
  expect(extraerComentario('un comentario cualquiera')).toBe(null)

  // Lo que publicaban las versiones 0.1 y 0.2: un solo estado, sin id de sesión
  const v1: Record<string, unknown> = { ...presencia({}) }
  delete v1.sesion
  const cuerpo = (d: Record<string, unknown>) => `<!-- oficina:presencia -->\n\`\`\`json\n${JSON.stringify(d)}\n\`\`\``
  const leido = extraerComentario(cuerpo(v1))
  expect(leido?.sesiones.map(s => s.sesion)).toEqual(['v1'])
  expect(leido?.ausente).toBe(false)
  expect(elegirPrincipal(leido as ComentarioPresencia, ahora).presencia.tarea).toBe(51)
  const fuera = extraerComentario(cuerpo({ ...v1, estado: 'fuera' }))
  expect(fuera?.sesiones).toEqual([])
  expect(fuera?.ausente).toBe(true)
  // La primera publicación con el formato nuevo descarta la entrada heredada
  const crm = presencia({ sesion: 'crm' })
  expect(ponerSesion(leido, crm, ahora).sesiones.map(s => s.sesion)).toEqual(['crm'])
})

test('cada sesión escribe su entrada sin pisar las otras', async () => {
  const ahora = Date.parse(AHORA)
  const quintana = { usuario: 'nicoequintana', nombre: 'Quintana' }
  const crm = presencia({ ...quintana, sesion: 'crm', repo: 'nicoequintana/quintech-crm', rama: 'feat/34-bandeja', tarea: 34 })
  // Esta sesión publicó después, pero no está en un repositorio
  const playbook = presencia({ ...quintana, sesion: 'playbook', repo: null, rama: null, tarea: null, archivos: [], actualizado: '2026-11-12T17:00:30.000Z' })
  let c = ponerSesion(null, crm, ahora)
  c = ponerSesion(c, playbook, ahora)
  expect(c.sesiones.map(s => s.sesion)).toEqual(['crm', 'playbook'])
  // Se muestra la sesión del CRM: está en un repo y con tarea. La del playbook no se lista aparte.
  expect(elegirPrincipal(c, ahora).presencia.sesion).toBe('crm')
  expect(elegirPrincipal(c, ahora).otras).toEqual([])
  // Volver a publicar la misma sesión reemplaza su entrada, no agrega otra
  c = ponerSesion(c, { ...crm, rama: 'feat/35-filtros', tarea: 35 }, ahora)
  expect(c.sesiones.filter(s => s.sesion === 'crm').map(s => s.tarea)).toEqual([35])
  // Cerrar el playbook no saca a la persona de la oficina
  c = quitarSesion(c, 'playbook', AHORA)
  expect(elegirPrincipal(c, ahora).presencia.estado).toBe('trabajando')
  expect(elegirPrincipal(c, ahora).presencia.tarea).toBe(35)
  // Cerrar la última sí
  c = quitarSesion(c, 'crm', AHORA)
  expect(elegirPrincipal(c, ahora).presencia.estado).toBe('fuera')
})

test('otra sesión activa en otro repositorio se lista aparte', async () => {
  const ahora = Date.parse(AHORA)
  const crm = presencia({ sesion: 'crm', repo: 'nicoequintana/quintech-crm', tarea: 34 })
  const web = presencia({ sesion: 'web', repo: 'quintechlab/web', tarea: 8, actualizado: '2026-11-12T16:59:00.000Z' })
  const elegida = elegirPrincipal(ponerSesion(ponerSesion(null, crm, ahora), web, ahora), ahora)
  expect(elegida.presencia.sesion).toBe('crm')
  expect(elegida.otras.map(o => o.sesion)).toEqual(['web'])
})

test('todas las sesiones vivas se listan, la principal primero, aunque compartan repositorio', async () => {
  const ahora = Date.parse(AHORA)
  const header = presencia({ sesion: 'header', repo: 'quintechlab/catalogo', tarea: 51 })
  const tests = presencia({ sesion: 'tests', repo: 'quintechlab/catalogo', tarea: 51, actualizado: '2026-11-12T16:58:00.000Z' })
  const vieja = presencia({ sesion: 'vieja', actualizado: '2026-11-11T01:00:00.000Z' })
  const c = ponerSesion(ponerSesion(ponerSesion(null, vieja, Date.parse('2026-11-11T01:00:00.000Z')), tests, ahora), header, ahora)
  const elegida = elegirPrincipal(c, ahora)
  expect(elegida.todas.map(s => s.sesion)).toEqual(['header', 'tests'])
  // "otras" sigue siendo solo lo que está en otro repositorio o tarea
  expect(elegida.otras).toEqual([])
  expect(elegirPrincipal(ponerSesion(c, header, ahora, { ausente: true }), ahora).todas).toEqual([])
})

test('los subagentes de una sesión viajan en su entrada, y una entrada sin subagentes se sigue leyendo', async () => {
  const ahora = Date.parse(AHORA)
  const agentes = [{ id: 'a1', nombre: 'Camila', inventado: false, tipo: 'general-purpose', tarea: 'rediseño del header', desde: '2026-11-12T16:57:00.000Z', estado: 'trabajando' as const, hasta: null }]
  const c = ponerSesion(null, presencia({ agentes }), ahora)
  expect(extraerComentario(envolverComentario(c))?.sesiones[0]?.agentes).toEqual(agentes)
  // Lo que publica la v0.3.1 no trae el campo
  expect(extraerComentario(envolverComentario(ponerSesion(null, presencia({}), ahora)))?.sesiones[0]?.agentes).toBe(undefined)
})

// ------------------------------------------------------------------ procesos en segundo plano (v0.6)

test('los procesos de una sesión viajan en su entrada, y una entrada sin procesos se sigue leyendo', async () => {
  const ahora = Date.parse(AHORA)
  const procesos = [{ id: 'b9fejzkst', descripcion: 'Arma el instalador', desde: '2026-11-12T16:58:00.000Z' }]
  const c = ponerSesion(null, presencia({ procesos, agentes: [], actividad: 'esperando 1 proceso' }), ahora)
  const leida = extraerComentario(envolverComentario(c))?.sesiones[0]
  expect(leida?.procesos).toEqual(procesos)
  // Los demás campos siguen igual
  expect(leida?.actividad).toBe('esperando 1 proceso')
  expect(leida?.agentes).toEqual([])
  // Lo que publica la v0.5 no trae el campo; uno mal formado se descarta entero
  expect(extraerComentario(envolverComentario(ponerSesion(null, presencia({}), ahora)))?.sesiones[0]?.procesos).toBe(undefined)
  const roto = { ...presencia({}), procesos: [{ id: 3 }, { id: 'ok', descripcion: 'x', desde: AHORA }, null] }
  const cuerpo = `<!-- oficina:presencia -->\n\`\`\`json\n${JSON.stringify({ v: 2, usuario: 'campos', nombre: 'Campos', ausente: false, actualizado: AHORA, sesiones: [roto] })}\n\`\`\``
  expect(extraerComentario(cuerpo)?.sesiones[0]?.procesos).toEqual([{ id: 'ok', descripcion: 'x', desde: AHORA }])
})

test('el id del proceso en segundo plano sale del resultado de Bash, o de su texto', async () => {
  // El registro de Bash trae backgroundTaskId (también si el usuario lo mandó atrás con Ctrl+B)
  expect(idProcesoDesdeResultado({ result: { stdout: '', stderr: '', interrupted: false, backgroundTaskId: 'b9fejzkst' }, text: '' })).toBe('b9fejzkst')
  // Sin registro, del texto que lee el modelo
  expect(idProcesoDesdeResultado({ text: 'Command running in background with ID: b9fejzkst. Output is being written to: C:\\tmp\\b9fejzkst.output' })).toBe('b9fejzkst')
  // Un comando en primer plano, un rechazo o algo raro: nada
  expect(idProcesoDesdeResultado({ result: { stdout: 'ok', stderr: '', interrupted: false }, text: 'ok' })).toBe(null)
  expect(idProcesoDesdeResultado({ deny: 'no' })).toBe(null)
  expect(idProcesoDesdeResultado(null)).toBe(null)
  expect(idProcesoDesdeResultado({ result: { backgroundTaskId: '../../etc' }, text: '' })).toBe(null)
  expect(idProcesoDesdeResultado({ text: 'background with ID: ' })).toBe(null)
})

test('el proceso guarda su descripción (o el comando), recortada, y desde cuándo', async () => {
  expect(procesoDesdeEntrada('b1', { command: 'npm run build', description: 'Arma el instalador' }, AHORA)).toEqual({ id: 'b1', descripcion: 'Arma el instalador', desde: AHORA })
  expect(procesoDesdeEntrada('b2', { command: 'npm   run dev\n# otra línea' }, AHORA).descripcion).toBe('npm run dev')
  expect(procesoDesdeEntrada('b3', { command: 'x'.repeat(200) }, AHORA).descripcion.length).toBeLessThanOrEqual(80)
  expect(procesoDesdeEntrada('b4', {}, AHORA).descripcion).toBe('proceso en segundo plano')
})

test('el aviso de una tarea terminada trae su id y su estado', async () => {
  const aviso = '<task-notification>\n<task-id>b9fejzkst</task-id>\n<tool-use-id>toolu_1</tool-use-id>\n<status>completed</status>\n<summary>Background command "Arma" completed (exit code 0)</summary>\n</task-notification>'
  expect(avisosDeTareas(aviso)).toEqual([{ id: 'b9fejzkst', estado: 'completed' }])
  // Varios avisos juntos, uno sin estado
  const dos = `${aviso}\n<task-notification><task-id>otro_1</task-id></task-notification>`
  expect(avisosDeTareas(dos)).toEqual([{ id: 'b9fejzkst', estado: 'completed' }, { id: 'otro_1', estado: null }])
  expect(avisosDeTareas('hola, sin aviso')).toEqual([])
  // Terminó: completed, failed, killed o sin estado; sigue: running o pending
  expect(['completed', 'failed', 'killed', null].map(tareaTerminada)).toEqual([true, true, true, true])
  expect(['running', 'pending'].map(tareaTerminada)).toEqual([false, false])
})

test('un proceso sin aviso se olvida a las 2 h', async () => {
  const ahora = Date.parse(AHORA)
  const hace = (min: number) => new Date(ahora - min * 60000).toISOString()
  const lista = [
    { id: 'nuevo', descripcion: 'a', desde: hace(5) },
    { id: 'viejo', descripcion: 'b', desde: hace(HORAS_PROCESO * 60 + 1) },
    { id: 'roto', descripcion: 'c', desde: 'no es fecha' },
  ]
  expect(podarProcesos(lista, ahora).map(p => p.id)).toEqual(['nuevo'])
})

test('sin nada más que hacer, la sesión espera sus procesos o tu mensaje', async () => {
  expect(actividadEnEspera(0)).toBe('esperándote')
  expect(actividadEnEspera(1)).toBe('esperando 1 proceso')
  expect(actividadEnEspera(3)).toBe('esperando 3 procesos')
  // Solo se recalcula si la sesión estaba esperando: una actividad en curso no se pisa
  expect(['esperándote', 'esperando 1 proceso', 'esperando 2 procesos'].every(esActividadEnEspera)).toBe(true)
  expect([null, 'pensando', 'corriendo npm run dev', 'editando a.ts'].some(esActividadEnEspera)).toBe(false)
})

test('el nombre del subagente sale de su descripción "Nombre — tarea"', async () => {
  expect(nombreSubagente('Camila — rediseño del header', 'a1')).toEqual({ nombre: 'Camila', tarea: 'rediseño del header', inventado: false })
  expect(nombreSubagente('Lucas 2 - fix tests', 'a2')).toEqual({ nombre: 'Lucas 2', tarea: 'fix tests', inventado: false })
  expect(nombreSubagente('Tomás – mapa de hooks', 'a3')).toEqual({ nombre: 'Tomás', tarea: 'mapa de hooks', inventado: false })
})

test('un subagente sin nombre recibe uno inventado, siempre el mismo para el mismo agente', async () => {
  const sinNombre = nombreSubagente('Find dead code', 'agente-7f3a')
  expect(sinNombre.inventado).toBe(true)
  expect(sinNombre.tarea).toBe('Find dead code')
  expect(NOMBRES_INVENTADOS).toContain(sinNombre.nombre)
  expect(nombreSubagente('otra descripción', 'agente-7f3a').nombre).toBe(sinNombre.nombre)
  // Varios agentes sin nombre no se llaman todos igual
  const nombres = new Set(['x1', 'x2', 'x3', 'x4', 'x5', 'x6'].map(id => nombreSubagente('', id).nombre))
  expect(nombres.size).toBeGreaterThan(1)
})

test('lo que hace la sesión ahora sale de la última herramienta', async () => {
  expect(actividadDesdeHerramienta('Edit', { file_path: 'C:\\repo\\hooks\\register.tsx' })).toBe('editando register.tsx')
  expect(actividadDesdeHerramienta('Write', { file_path: '/repo/docs/a.md' })).toBe('editando a.md')
  expect(actividadDesdeHerramienta('Read', { file_path: '/repo/src/carrito.ts' })).toBe('leyendo carrito.ts')
  expect(actividadDesdeHerramienta('Bash', { command: 'npm test -- pricing\nmás' })).toBe('corriendo npm test -- pricing')
  expect(actividadDesdeHerramienta('Grep', { pattern: 'TODO' })).toBe('buscando TODO')
  expect(actividadDesdeHerramienta('Agent', { description: 'Camila — header' })).toBe('lanzando a Camila')
  expect(actividadDesdeHerramienta('AskUserQuestion', {})).toBe('esperándote')
  expect(actividadDesdeHerramienta('TodoWrite', {})).toBe('usando TodoWrite')
  expect(actividadDesdeHerramienta('Bash', { command: 'x'.repeat(200) }).length).toBeLessThanOrEqual(60)
})

test('una pregunta de AskUserQuestion se guarda con sus opciones', async () => {
  const entrada = {
    questions: [
      { question: '¿Qué opción elegís?', header: 'Opción', multiSelect: false, options: [{ label: 'Terrario', description: 'Una escena por proyecto' }, { label: 'Vitrina' }] },
    ],
  }
  expect(preguntaDesdeEntrada(entrada, 'toolu_1', null, AHORA)).toEqual({
    id: 'toolu_1',
    agente: null,
    desde: AHORA,
    items: [{ pregunta: '¿Qué opción elegís?', encabezado: 'Opción', multiple: false, opciones: [{ etiqueta: 'Terrario', descripcion: 'Una escena por proyecto' }, { etiqueta: 'Vitrina', descripcion: '' }] }],
  })
  // Una entrada rara no rompe nada: no hay pregunta que mostrar
  expect(preguntaDesdeEntrada({ questions: 'x' }, 'toolu_2', null, AHORA)).toBe(null)
})

test('los subagentes terminados quedan un rato y después se van; los que corren, siempre', async () => {
  const ahora = Date.parse(AHORA)
  const base = { tipo: 'general-purpose', tarea: 't', inventado: false }
  const lista = [
    { ...base, id: 'corre', nombre: 'Camila', desde: '2026-11-12T10:00:00.000Z', estado: 'trabajando' as const, hasta: null },
    { ...base, id: 'reciente', nombre: 'Lucas', desde: '2026-11-12T16:00:00.000Z', estado: 'listo' as const, hasta: '2026-11-12T16:50:00.000Z' },
    { ...base, id: 'viejo', nombre: 'Inés', desde: '2026-11-12T15:00:00.000Z', estado: 'listo' as const, hasta: '2026-11-12T16:00:00.000Z' },
  ]
  expect(podarSubagentes(lista, ahora).map(s => s.id)).toEqual(['corre', 'reciente'])
})

test('/oficina fuera vale para la persona aunque tenga sesiones abiertas', async () => {
  const ahora = Date.parse(AHORA)
  const crm = presencia({ sesion: 'crm' })
  let c = ponerSesion(null, crm, ahora, { ausente: true })
  expect(elegirPrincipal(c, ahora).presencia.estado).toBe('fuera')
  // El latido de otra sesión no la devuelve a la oficina
  c = ponerSesion(c, crm, ahora)
  expect(elegirPrincipal(c, ahora).presencia.estado).toBe('fuera')
  // /oficina volver, o abrir una sesión nueva, sí
  c = ponerSesion(c, crm, ahora, { ausente: false })
  expect(elegirPrincipal(c, ahora).presencia.estado).toBe('trabajando')
})

test('dos comentarios de la misma persona se ven como una sola ficha', async () => {
  const ahora = Date.parse(AHORA)
  const nuevo = ponerSesion(null, presencia({ sesion: 'crm', repo: 'nicoequintana/quintech-crm', tarea: 34 }), ahora)
  // El comentario que dejó una sesión con la versión anterior: formato v1, fuera de un repositorio
  const v1: Record<string, unknown> = { ...presencia({ repo: null, rama: null, tarea: null, actualizado: '2026-11-12T16:59:00.000Z' }) }
  delete v1.sesion
  const viejo = extraerComentario(`<!-- oficina:presencia -->\n\`\`\`json\n${JSON.stringify(v1)}\n\`\`\``) as ComentarioPresencia
  const unido = unirComentarios(unirComentarios(undefined, nuevo), viejo)
  expect(unido.sesiones.map(s => s.sesion).sort()).toEqual(['crm', 'v1'])
  expect(elegirPrincipal(unido, ahora).presencia.tarea).toBe(34)
  // Misma sesión en los dos: queda la entrada más reciente
  const otraVez = ponerSesion(null, presencia({ sesion: 'crm', tarea: 35, actualizado: '2026-11-12T17:01:00.000Z' }), ahora)
  expect(unirComentarios(nuevo, otraVez).sesiones.map(s => s.tarea)).toEqual([35])
})

test('una sesión colgada hace más de 12 h se descarta', async () => {
  const ahora = Date.parse(AHORA)
  const colgada = presencia({ sesion: 'colgada', actualizado: '2026-11-12T04:00:00.000Z' })
  const c: ComentarioPresencia = { v: 2, usuario: 'campos', nombre: 'Campos', ausente: false, actualizado: colgada.actualizado, sesiones: [colgada] }
  expect(elegirPrincipal(c, ahora).presencia.estado).toBe('fuera')
  expect(ponerSesion(c, presencia({ sesion: 'nueva' }), ahora).sesiones.map(s => s.sesion)).toEqual(['nueva'])
})

test('la carpeta de la sesión va solo en el archivo local, nunca en el comentario de GitHub', async () => {
  const p = presencia({ sesion: 'con-carpeta' })
  const local = presenciaLocal(p, 'C:/Users/x/Desktop/catalogo')
  expect(local.cwd).toBe('C:/Users/x/Desktop/catalogo')
  expect({ ...local, cwd: undefined }).toEqual({ ...p, cwd: undefined })
  // Sin carpeta conocida no se agrega la clave
  expect('cwd' in presenciaLocal(p, '  ')).toBe(false)
  // Aunque llegue con carpeta, el comentario la saca (de esta sesión y de cualquier otra)
  const vieja = { ...presencia({ sesion: 'otra' }), cwd: 'C:/otra' }
  const c = ponerSesion({ v: 2, usuario: 'campos', nombre: 'Campos', ausente: false, actualizado: AHORA, sesiones: [vieja] }, local, Date.parse(AHORA))
  expect(c.sesiones.map(s => s.sesion)).toEqual(['otra', 'con-carpeta'])
  expect(c.sesiones.some(s => 'cwd' in s)).toBe(false)
  expect(envolverComentario(c).includes('cwd')).toBe(false)
  expect(envolverComentario(c).includes('catalogo')).toBe(true) // el repo sigue viajando
})

test('el latido local solo renueva la hora de lo último escrito', async () => {
  const ultima = presencia({ sesion: 'viva', actividad: 'editando a.ts' })
  expect(latidoLocal(ultima, '2026-11-12T17:00:30.000Z')).toEqual({ ...ultima, actualizado: '2026-11-12T17:00:30.000Z' })
  // Sin nada escrito todavía (o con la sesión ya cerrada) no hay latido que dar
  expect(latidoLocal(null, '2026-11-12T17:00:30.000Z')).toBe(null)
})

test('los archivos sin commitear salen de git status', async () => {
  expect(archivosDesdeStatus(' M src/a.ts\n?? src/nuevo.ts\nR  viejo.ts -> src/renombrado.ts\r\n\n')).toEqual([
    'src/a.ts',
    'src/nuevo.ts',
    'src/renombrado.ts',
  ])
})

test('duración, iniciales, nombres y CI', async () => {
  expect(formatoDuracion(80 * 60000)).toBe('1 h 20 min')
  expect(formatoDuracion(35 * 60000)).toBe('35 min')
  expect(formatoDuracion(10000)).toBe('menos de 1 min')
  expect(iniciales('Quintana')).toBe('QU')
  expect(iniciales('Juan Campos')).toBe('JC')
  expect(mapaNombres('nicoequintana=Quintana, campos=Campos')).toEqual({ nicoequintana: 'Quintana', campos: 'Campos' })
  expect(ciDesdeRollup([{ conclusion: 'SUCCESS' }])).toBe('ok')
  expect(ciDesdeRollup([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }])).toBe('falla')
  expect(ciDesdeRollup([{ status: 'IN_PROGRESS', conclusion: null }])).toBe('pendiente')
  expect(ciDesdeRollup([])).toBe('sin')
})

test('lo que queda sale del talle menos lo cargado y la sesión actual', async () => {
  const ahora = new Date(AHORA).getTime()
  // M = 16 h; 3 h cargadas + 1 h 20 de sesión → quedan 11 h 40
  const r = restante('M', 3, '2026-11-12T15:40:00.000Z', ahora)
  expect(r?.quedanMs).toBe((16 - 3) * 3600000 - 80 * 60000)
  expect(r?.excedido).toBe(false)
  expect(restante('S', 5, null, ahora)?.excedido).toBe(true)
  expect(restante(null, 3, AHORA, ahora)).toBe(null)
})

test('estado visible: trabajando, inactivo tras 20 min sin señales, fuera', async () => {
  const ahora = new Date(AHORA).getTime()
  expect(estadoVisible(presencia({}), ahora)).toBe('activo')
  expect(estadoVisible(presencia({ actualizado: '2026-11-12T16:30:00.000Z' }), ahora)).toBe('inactivo')
  expect(estadoVisible(presencia({ estado: 'fuera' }), ahora)).toBe('fuera')
})

test('avisos: tarea nueva, PR nuevo, CI en rojo, entrada y salida', async () => {
  const antes = [miembro({ prs: [{ numero: 9, titulo: 'x', url: '', ci: 'ok', borrador: false }] })]
  const ahora = [
    miembro({
      presencia: { tarea: 52 },
      tarea: { numero: 52, titulo: 'Checkout', talle: 'S', abierta: true, url: '', horasRegistradas: null, estadoTablero: null },
      prs: [
        { numero: 9, titulo: 'x', url: '', ci: 'falla', borrador: false },
        { numero: 10, titulo: 'Checkout', url: '', ci: 'pendiente', borrador: true },
      ],
    }),
  ]
  const avisos = diferencias(antes, ahora, 'nicoequintana')
  expect(avisos).toEqual(['Campos arrancó #52 · Checkout', 'Campos abrió el PR #10: Checkout', 'CI en rojo en el PR #9 de Campos'])
  expect(diferencias([miembro({})], [miembro({ presencia: { estado: 'fuera' } })], 'nicoequintana')).toEqual(['Campos cerró la sesión'])
  // Lo mío no genera avisos
  expect(diferencias([miembro({})], [miembro({ presencia: { tarea: 60 } })], 'campos')).toEqual([])
})

test('choques: archivos en común en el mismo repositorio', async () => {
  const yo = miembro({ esYo: true, presencia: { usuario: 'nicoequintana', nombre: 'Quintana', rama: 'feat/60-cupones', tarea: 60, archivos: ['src/carrito.ts', 'src/cupones.ts'] } })
  const otro = miembro({})
  expect(choques([yo, otro], 'nicoequintana')).toEqual([{ con: 'Campos', archivos: ['src/carrito.ts'] }])
  expect(archivosEnComun(['a', 'b'], ['b', 'c'])).toEqual(['b'])
  const otroRepo = miembro({ presencia: { repo: 'quintechlab/web' } })
  expect(choques([yo, otroRepo], 'nicoequintana')).toEqual([])
})

test('el panel dibuja a cada integrante con su tarea, en cada superficie', async ($, on) => {
  const lista = [
    miembro({ esYo: true, otras: [presencia({ sesion: 'web', usuario: 'nicoequintana', nombre: 'Quintana', repo: 'quintechlab/web', tarea: 8 })], presencia: { usuario: 'nicoequintana', nombre: 'Quintana', rama: 'feat/60-cupones', tarea: 60, archivos: ['src/carrito.ts'] }, tarea: { numero: 60, titulo: 'Cupones', talle: 'S', abierta: true, url: '', horasRegistradas: null, estadoTablero: null } }),
    miembro({ prs: [{ numero: 10, titulo: 'Carrito', url: '', ci: 'ok', borrador: false }] }),
  ]
  on('clock.now', () => ({ value: Date.parse(AHORA) }))
  on('state.get', (_, e) =>
    e.key === 'miembros'
      ? { value: { value: { shape: 'miembros-3', value: lista }, version: 1 } }
      : { value: { value: { yo: 'nicoequintana', error: null, actualizado: AHORA, datos: 'quintechlab/oficina-datos' }, version: 1 } },
  )

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      // Sin SVG: la cabecera es texto
      expect((await ui.find({ type: 'Text', text: /Quintana/ }))?.text).toContain('Quintana')
    } else {
      // Con SVG: nombre y estado viven en la cabecera dibujada; su `alt` los repite, sin el tiempo
      expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toBe('Quintana (vos), trabajando')
    }
    // El tiempo va en texto, fuera del SVG, para que el dibujo no se recargue cada minuto
    expect((await ui.find({ type: 'Text', text: /lleva/ }))?.text).toContain('lleva 1 h 20 min')
    expect((await ui.find({ type: 'Text', text: /también en/ }))?.text).toContain('web #8')
    expect((await ui.find({ type: 'Text', text: /Carrito de compras/ }))?.text).toContain('#51')
    expect((await ui.find({ type: 'Text', text: /PR #10/ }))?.text).toContain('Carrito')
    expect((await ui.find({ type: 'Text', text: /toca lo mismo/ }))?.text).toContain('src/carrito.ts')
    // El talle es un tope, no una estimación: no se muestra tiempo restante. Sí las horas cargadas.
    expect(await ui.find({ type: 'Text', text: /quedan/ })).toBe(undefined)
    expect((await ui.find({ type: 'Text', text: /cargadas/ }))?.text).toContain('3 h cargadas en el tablero')
    await ui.unmount()
  }
})

test('con un valor guardado por otra versión el panel no rompe', async ($, on) => {
  on('clock.now', () => ({ value: Date.parse(AHORA) }))
  on('state.get', (_, e) =>
    e.key === 'miembros'
      ? { value: { value: [{ usuario: 'viejo' }], version: 1 } }
      : { value: { value: { yo: null, error: 'sin gh', actualizado: null, datos: 'x' }, version: 1 } },
  )
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /GitHub:/ }))?.text).toContain('sin gh')
  await ui.unmount()
})

// ------------------------------------------------------------------ responder desde el widget (v0.5)

const PREGUNTA: Pregunta = {
  id: 'toolu_1',
  agente: null,
  desde: '2026-11-12T16:59:00.000Z',
  items: [
    { pregunta: '¿Qué boceto?', encabezado: 'Boceto', multiple: false, opciones: [{ etiqueta: 'Terrario (Recomendada)', descripcion: '' }, { etiqueta: 'Vitrina', descripcion: '' }] },
    { pregunta: '¿Qué incluyo?', encabezado: 'Alcance', multiple: true, opciones: [{ etiqueta: 'Tests, con fixtures', descripcion: '' }, { etiqueta: 'Docs', descripcion: '' }, { etiqueta: 'CI', descripcion: '' }] },
  ],
}
const archivo = (extra: Record<string, unknown>) => ({ v: 1, origen: 'widget', tocadoEn: AHORA, ...extra })

test('respuesta del widget: una opción y varias (aunque una etiqueta lleve coma) se aceptan', async () => {
  const r = validarRespuesta(archivo({ answers: { '¿Qué boceto?': 'Terrario (Recomendada)', '¿Qué incluyo?': 'Tests, con fixtures, CI' } }), PREGUNTA)
  expect(r).toEqual({ answers: { '¿Qué boceto?': 'Terrario (Recomendada)', '¿Qué incluyo?': 'Tests, con fixtures, CI' } })
})

test('respuesta del widget: una etiqueta o una pregunta desconocidas se rechazan', async () => {
  const otra = validarRespuesta(archivo({ answers: { '¿Qué boceto?': 'Vitrina grande', '¿Qué incluyo?': 'CI' } }), PREGUNTA)
  expect('error' in otra).toBe(true)
  const ajena = validarRespuesta(archivo({ answers: { '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'CI', '¿Borro todo?': 'Sí' } }), PREGUNTA)
  expect('error' in ajena).toBe(true)
  // Repetir una opción en la selección múltiple tampoco vale
  expect('error' in validarRespuesta(archivo({ answers: { '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'CI, CI' } }), PREGUNTA)).toBe(true)
})

test('respuesta del widget: el texto libre vale solo si viene marcado y no está vacío', async () => {
  const libre = { '¿Qué boceto?': 'Uno mezclado', '¿Qué incluyo?': 'Docs' }
  expect(validarRespuesta(archivo({ answers: libre, libres: ['¿Qué boceto?'] }), PREGUNTA)).toEqual({ answers: libre })
  expect('error' in validarRespuesta(archivo({ answers: libre }), PREGUNTA)).toBe(true)
  expect('error' in validarRespuesta(archivo({ answers: { ...libre, '¿Qué boceto?': '   ' }, libres: ['¿Qué boceto?'] }), PREGUNTA)).toBe(true)
})

test('respuesta del widget: incompleta, vieja, mal formada o vacía no se acepta', async () => {
  expect('error' in validarRespuesta(archivo({ answers: { '¿Qué boceto?': 'Vitrina' } }), PREGUNTA)).toBe(true)
  expect('error' in validarRespuesta(archivo({ tocadoEn: '2026-11-12T16:58:00.000Z', answers: { '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'CI' } }), PREGUNTA)).toBe(true)
  expect('error' in validarRespuesta(archivo({ answers: {} }), PREGUNTA)).toBe(true)
  expect('error' in validarRespuesta({ v: 1, consumida: true }, PREGUNTA)).toBe(true)
  expect('error' in validarRespuesta(null, PREGUNTA)).toBe(true)
  expect('error' in validarRespuesta('texto', PREGUNTA)).toBe(true)
})

/** Un reloj de mentira: cada espera resuelve enseguida, o al abortar. */
const esperaInmediata = (_ms: number, senal: AbortSignal) => (senal.aborted ? Promise.resolve() : Promise.resolve())

test('vigilar: sin archivo sigue esperando hasta que el diálogo responde; nunca elige solo', async () => {
  const corte = new AbortController()
  let lecturas = 0
  const vigilancia = vigilarRespuesta(PREGUNTA, {
    leer: async () => {
      lecturas++
      if (lecturas === 50) corte.abort() // el diálogo de Claude respondió
      return null
    },
    esperar: esperaInmediata,
    senal: corte.signal,
  })
  expect(await vigilancia).toBe(null)
  expect(lecturas).toBe(50)
})

test('vigilar: un archivo inválido se ignora una vez y se sigue esperando; uno válido gana', async () => {
  const corte = new AbortController()
  const ignorados: string[] = []
  const contenidos = ['{roto', JSON.stringify(archivo({ answers: { '¿Qué boceto?': 'Otra cosa', '¿Qué incluyo?': 'CI' } })), JSON.stringify(archivo({ answers: { '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'Docs, CI' } }))]
  let i = 0
  const r = await vigilarRespuesta(PREGUNTA, {
    leer: async () => contenidos[Math.min(Math.floor(i++ / 3), 2)] ?? null,
    esperar: esperaInmediata,
    senal: corte.signal,
    ignorado: motivo => ignorados.push(motivo),
  })
  expect(r).toEqual({ '¿Qué boceto?': 'Vitrina', '¿Qué incluyo?': 'Docs, CI' })
  // Cada contenido inválido se registra una sola vez aunque se lea varias
  expect(ignorados.length).toBe(2)
})

test('carrera: si el diálogo responde primero, gana el diálogo y la vigilancia se corta', async () => {
  let cortada = false
  const r = await carreraConDialogo(Promise.resolve('respuesta del diálogo'), senal =>
    new Promise(resolver => senal.addEventListener('abort', () => { cortada = true; resolver(null) })))
  expect(r).toEqual({ de: 'dialogo', resultado: 'respuesta del diálogo' })
  expect(cortada).toBe(true)
})

test('carrera: si el widget trae una respuesta válida primero, gana el widget', async () => {
  const dialogo = new Promise<string>(() => undefined) // el diálogo sigue abierto
  const r = await carreraConDialogo(dialogo, async () => ({ '¿Qué boceto?': 'Vitrina' }))
  expect(r).toEqual({ de: 'widget', answers: { '¿Qué boceto?': 'Vitrina' } })
})

test('carrera: si la vigilancia falla, se espera al diálogo como siempre', async () => {
  const r = await carreraConDialogo(Promise.resolve('del diálogo'), async () => { throw new Error('mod roto') })
  expect(r).toEqual({ de: 'dialogo', resultado: 'del diálogo' })
})

test('si algo falla después de que ganó el widget, igual se entrega su respuesta (no se abre otro diálogo)', async () => {
  const r = await resultadoDelWidget(['q'], { '¿Qué boceto?': 'Vitrina' }, async () => { throw new Error('reloj roto') })
  expect(r).toEqual({ result: { questions: ['q'], answers: { '¿Qué boceto?': 'Vitrina' } } })
})

test('/avis y /oficina (el nombre anterior) responden lo mismo', async ($, on) => {
  on('store.get', () => ({ value: undefined }))
  const avis = await $.command.run({ command: 'avis', args: 'ayuda' } as never) as { text?: string }
  const oficina = await $.command.run({ command: 'oficina', args: 'ayuda' } as never) as { text?: string }
  expect(avis.text).toContain('/avis tarea 42')
  expect(avis.text).toContain('/oficina')
  expect(oficina.text).toBe(avis.text)
})

test('tras un /clear, cerrar la sesión vieja no bloquea el archivo local de la nueva', async () => {
  const cerradas = new Set(['vieja'])
  // La sesión cerrada no revive (ningún latido ni publicación en vuelo)
  expect(puedeEscribirLocal(cerradas, 'vieja')).toBe(false)
  // La sesión nueva que nace del /clear sí escribe: el widget la ve
  expect(puedeEscribirLocal(cerradas, 'nueva')).toBe(true)
  expect(puedeEscribirLocal(new Set(), 'nueva')).toBe(true)
})

test('sin git, el proyecto es siempre el nombre de la carpeta abierta: nada queda "fuera de un repositorio"', async () => {
  const casa = String.raw`C:\Users\Nico`
  expect(proyectoDesdeCarpeta(String.raw`C:\Users\Nico\OneDrive\Desktop\mi-sitio`, casa)).toBe('local/mi-sitio')
  expect(proyectoDesdeCarpeta('C:/Users/Nico/OneDrive/Desktop/mi-sitio/', casa)).toBe('local/mi-sitio')
  // También la carpeta del usuario y los borradores de la app de escritorio: cada uno su solapa
  expect(proyectoDesdeCarpeta(String.raw`C:\Users\Nico`, casa)).toBe('local/Nico')
  expect(proyectoDesdeCarpeta(String.raw`C:\Users\Nico\AppData\Roaming\Claude\scratch-workspaces\a\b\scratch-2026-11-20-b87f12`, casa)).toBe('local/scratch-2026-11-20-b87f12')
  // Solo sin carpeta no hay proyecto
  expect(proyectoDesdeCarpeta('', casa)).toBe(null)
  // Lo de antes sigue igual: con git manda el repo (o su carpeta si no tiene remoto)
  expect(proyectoDesdeRepo('C:/x/central-nucleo-main', null)).toBe('local/central-nucleo-main')
})

// ------------------------------------------------------------------ conversaciones entre sesiones (v0.8)

const OTRA = '0b7c1e2a-9d3f-4a51-8c6e-2f4d5a6b7c8d'

test('la marca de un mensaje entre sesiones va y vuelve, y el texto queda como estaba', async () => {
  const marcado = marcarMensaje('¿Ya está el endpoint de pagos?', { sesion: OTRA, repo: 'quintechlab/api-pagos' })
  expect(leerMarca(marcado)).toEqual({ texto: '¿Ya está el endpoint de pagos?', sesion: OTRA, repo: 'quintechlab/api-pagos' })
  // Sin repositorio, o con una carpeta con espacios, también vuelve igual
  expect(leerMarca(marcarMensaje('hola', { sesion: OTRA, repo: null }))).toEqual({ texto: 'hola', sesion: OTRA, repo: null })
  expect(leerMarca(marcarMensaje('hola', { sesion: OTRA, repo: 'mis cosas/año' }))?.repo).toBe('mis cosas/año')
})

test('un mensaje sin marca, o con la marca en el medio, no es de una sesión con Avis', async () => {
  expect(leerMarca('hola, sin marca')).toBe(null)
  expect(leerMarca(`antes [avis:${OTRA}|-] después`)).toBe(null)
  expect(leerMarca('[avis:no es un id|-]')).toBe(null)
})

test('el primer mensaje de otra sesión abre la conversación; los siguientes solo mueven el último', async () => {
  const t1 = '2026-11-22T13:00:00.000Z'
  const t2 = '2026-11-22T13:01:30.000Z'
  const una = registrarMensaje([], { con: OTRA, conRepo: 'quintechlab/api-pagos', de: 'otro', cuando: t1 })
  expect(una).toEqual([{ con: OTRA, conRepo: 'quintechlab/api-pagos', desde: t1, empezo: 'otro', ultimo: { de: 'otro', cuando: t1 } }])
  const dos = registrarMensaje(una, { con: OTRA, conRepo: 'quintechlab/api-pagos', de: 'otro', cuando: t2 })
  expect(dos).toEqual([{ con: OTRA, conRepo: 'quintechlab/api-pagos', desde: t1, empezo: 'otro', ultimo: { de: 'otro', cuando: t2 } }])
})

test('pasados 5 minutos sin mensajes, el siguiente empieza otra conversación con la misma sesión', async () => {
  const t1 = Date.parse('2026-11-22T13:00:00.000Z')
  const t2 = new Date(t1 + (MINUTOS_CONVERSA_QUIETA * 60000 + 1000)).toISOString()
  const una = registrarMensaje([], { con: OTRA, conRepo: null, de: 'yo', cuando: new Date(t1).toISOString() })
  const otra = registrarMensaje(una, { con: OTRA, conRepo: null, de: 'otro', cuando: t2 })
  expect(otra).toEqual([{ con: OTRA, conRepo: null, desde: t2, empezo: 'otro', ultimo: { de: 'otro', cuando: t2 } }])
})

test('hasta 4 conversaciones: con una quinta se olvida la de último mensaje más viejo', async () => {
  let lista = [] as ReturnType<typeof registrarMensaje>
  for (let i = 0; i < 5; i++) lista = registrarMensaje(lista, { con: `s${i}`, conRepo: null, de: 'otro', cuando: `2026-11-22T13:0${i}:00.000Z` })
  expect(lista.map(c => c.con)).toEqual(['s1', 's2', 's3', 's4'])
})

test('una conversación se olvida 30 minutos después de quedar quieta', async () => {
  const lista = [
    { con: 'vieja', conRepo: null, desde: '2026-11-22T12:00:00.000Z', empezo: 'otro' as const, ultimo: { de: 'otro' as const, cuando: '2026-11-22T12:20:00.000Z' } },
    { con: 'nueva', conRepo: null, desde: '2026-11-22T12:50:00.000Z', empezo: 'yo' as const, ultimo: { de: 'otro' as const, cuando: '2026-11-22T12:59:00.000Z' } },
  ]
  // 13:00: la vieja quedó quieta a las 12:25 y pasaron más de 30 min; la nueva sigue
  expect(podarConversas(lista, Date.parse('2026-11-22T13:00:00.000Z')).map(c => c.con)).toEqual(['nueva'])
})

test('las conversaciones viajan en la entrada de la sesión, y una entrada sin ellas se sigue leyendo', async () => {
  const ahora = Date.parse(AHORA)
  const conversa = [{ con: OTRA, conRepo: 'quintechlab/api-pagos', desde: AHORA, empezo: 'otro' as const, ultimo: { de: 'otro' as const, cuando: AHORA } }]
  expect(extraerComentario(envolverComentario(ponerSesion(null, presencia({ conversa }), ahora)))?.sesiones[0]?.conversa).toEqual(conversa)
  // Lo que publica la v0.7 no trae el campo; una mal formada se descarta
  expect(extraerComentario(envolverComentario(ponerSesion(null, presencia({}), ahora)))?.sesiones[0]?.conversa).toBe(undefined)
  const roto = { ...presencia({}), conversa: [{ con: 3 }, conversa[0], null] }
  const cuerpo = `<!-- oficina:presencia -->\n\`\`\`json\n${JSON.stringify({ v: 2, usuario: 'campos', nombre: 'Campos', ausente: false, actualizado: AHORA, sesiones: [roto] })}\n\`\`\``
  expect(extraerComentario(cuerpo)?.sesiones[0]?.conversa).toEqual(conversa)
})

test('la marca se encuentra dentro del sobre con que llega el mensaje de otra sesión, y se borra solo su línea', async () => {
  // Medido el 22/11: así le llega a la otra sesión un mensaje de SendMessage
  const sobre = (cuerpo: string) =>
    `Another Claude session sent a message:\n<cross-session-message from="uds:x" from-name="quintech-crm-20" from-mode="bypass">\n${cuerpo}\n</cross-session-message>\n\nThis came from another Claude session.`
  const marcado = marcarMensaje('Hola, soy la sesión de quintech-crm.', { sesion: OTRA, repo: 'nicoequintana/quintech-crm' })
  expect(leerMarca(sobre(marcado))).toEqual({ texto: sobre('Hola, soy la sesión de quintech-crm.'), sesion: OTRA, repo: 'nicoequintana/quintech-crm' })
  // Una marca citada en el medio de una línea sigue sin contar
  expect(leerMarca(sobre(`mirá esto: [avis:${OTRA}|-] raro`))).toBe(null)
})

// ------------------------------------------------------------------ detalle del subagente (v0.9)

const SUB = { id: 'a1', nombre: 'Camila', inventado: false, tipo: 'general-purpose', tarea: 'rediseño del header', desde: '2026-11-12T16:57:00.000Z', estado: 'trabajando' as const, hasta: null }

test('cada herramienta de un subagente es lo que hace ahora y suma un paso', async () => {
  const uno = anotarPaso(SUB, 'leyendo main.js', '2026-11-12T16:58:00.000Z')
  expect(uno.actividad).toBe('leyendo main.js')
  expect(uno.pasos).toEqual([{ texto: 'leyendo main.js', cuando: '2026-11-12T16:58:00.000Z' }])
  const dos = anotarPaso(uno, 'editando tablero.js', '2026-11-12T16:59:00.000Z')
  expect(dos.actividad).toBe('editando tablero.js')
  expect(dos.pasos?.map(p => p.texto)).toEqual(['leyendo main.js', 'editando tablero.js'])
  // Lo demás del subagente no cambia
  expect({ ...dos, actividad: undefined, pasos: undefined }).toEqual({ ...SUB, actividad: undefined, pasos: undefined })
})

test('se guardan solo los últimos 5 pasos', async () => {
  let s = SUB as ReturnType<typeof anotarPaso>
  for (let i = 1; i <= MAX_PASOS + 2; i++) s = anotarPaso(s, `corriendo paso ${i}`, `2026-11-12T17:0${i}:00.000Z`)
  expect(s.pasos?.map(p => p.texto)).toEqual(['corriendo paso 3', 'corriendo paso 4', 'corriendo paso 5', 'corriendo paso 6', 'corriendo paso 7'])
})

test('la misma herramienta dos veces seguidas es un solo paso, con la hora de la última', async () => {
  const uno = anotarPaso(SUB, 'leyendo main.js', '2026-11-12T16:58:00.000Z')
  const dos = anotarPaso(uno, 'leyendo main.js', '2026-11-12T16:58:30.000Z')
  expect(dos.pasos).toEqual([{ texto: 'leyendo main.js', cuando: '2026-11-12T16:58:30.000Z' }])
})

test('la actividad y los pasos de un subagente viajan en la entrada, y un subagente sin ellos se sigue leyendo', async () => {
  const ahora = Date.parse(AHORA)
  const conDetalle = { ...SUB, actividad: 'editando tablero.js', pasos: [{ texto: 'editando tablero.js', cuando: '2026-11-12T16:59:00.000Z' }] }
  const leida = extraerComentario(envolverComentario(ponerSesion(null, presencia({ agentes: [conDetalle, SUB] }), ahora)))?.sesiones[0]
  expect(leida?.agentes).toEqual([conDetalle, SUB])
  // Un paso mal formado se descarta; los demás quedan
  const roto = { ...presencia({}), agentes: [{ ...SUB, pasos: [{ texto: 3 }, { texto: 'ok', cuando: AHORA }, null] }] }
  const cuerpo = `<!-- oficina:presencia -->\n\`\`\`json\n${JSON.stringify({ v: 2, usuario: 'campos', nombre: 'Campos', ausente: false, actualizado: AHORA, sesiones: [roto] })}\n\`\`\``
  expect(extraerComentario(cuerpo)?.sesiones[0]?.agentes?.[0]?.pasos).toEqual([{ texto: 'ok', cuando: AHORA }])
})

// ------------------------------------------------------------------ órdenes del widget (v0.10)

const ARRANQUE = Date.parse('2026-11-22T13:00:00.000Z')
const enIso = (ms: number) => new Date(ms).toISOString()
const orden = (extra: Record<string, unknown>) => ({ v: 1, origen: 'widget', id: 'k3j9x0a1b2c3d4e5', tipo: 'mensaje', texto: 'Seguí con los tests', creada: enIso(ARRANQUE + 5000), ...extra })
const tiempos = { arranqueMs: ARRANQUE, ahoraMs: ARRANQUE + 10000 }
const errorDe = (r: ReturnType<typeof validarOrden>) => ('error' in r ? r.error : null)

test('orden del widget: un mensaje y un frenar válidos se aceptan', async () => {
  expect(validarOrden(orden({}), tiempos)).toEqual({ orden: orden({}) })
  const frenar = { v: 1, origen: 'widget', id: 'abc123', tipo: 'frenar', creada: enIso(ARRANQUE + 5000) }
  expect(validarOrden(frenar, tiempos)).toEqual({ orden: frenar })
  // Desde la v0.11: cerrar la sesión, también sin texto
  const cerrar = { v: 1, origen: 'widget', id: 'abc124', tipo: 'cerrar', creada: enIso(ARRANQUE + 5000) }
  expect(validarOrden(cerrar, tiempos)).toEqual({ orden: cerrar })
  // Justo en el límite de edad todavía vale
  const tarde = { arranqueMs: ARRANQUE, ahoraMs: ARRANQUE + 200000 }
  expect(errorDe(validarOrden(orden({ creada: enIso(tarde.ahoraMs - MAX_EDAD_ORDEN_MS) }), tarde))).toBe(null)
})

test('orden del widget: un formato desconocido se descarta', async () => {
  expect(errorDe(validarOrden(null, tiempos))).not.toBe(null)
  expect(errorDe(validarOrden('texto', tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ v: 2 }), tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ origen: 'otro' }), tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ creada: 'no es fecha' }), tiempos))).not.toBe(null)
})

test('orden del widget: un id fuera de [a-z0-9]{1,64} se descarta', async () => {
  for (const id of ['', 'ABC', '../x', 'a'.repeat(65), 7, undefined]) expect(errorDe(validarOrden(orden({ id }), tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ id: 'a'.repeat(64) }), tiempos))).toBe(null)
})

test('orden del widget: un tipo desconocido se descarta', async () => {
  expect(errorDe(validarOrden(orden({ tipo: 'borrar' }), tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ tipo: undefined }), tiempos))).not.toBe(null)
})

test('orden del widget: un mensaje vacío, en blanco, largo o sin texto se descarta', async () => {
  for (const texto of ['', '   \n ', 'x'.repeat(10001), 3, undefined]) expect(errorDe(validarOrden(orden({ texto }), tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ texto: 'x'.repeat(10000) }), tiempos))).toBe(null)
})

test('orden del widget: una orden anterior al arranque de la sesión se descarta', async () => {
  expect(errorDe(validarOrden(orden({ creada: enIso(ARRANQUE - 1000) }), tiempos))).not.toBe(null)
})

test('orden del widget: una orden de más de 120 s se descarta', async () => {
  const ahoraMs = ARRANQUE + 200000
  expect(errorDe(validarOrden(orden({ creada: enIso(ahoraMs - MAX_EDAD_ORDEN_MS - 1) }), { arranqueMs: ARRANQUE, ahoraMs }))).not.toBe(null)
})

test('orden del widget: una orden de más de 60 s en el futuro se descarta', async () => {
  expect(errorDe(validarOrden(orden({ creada: enIso(tiempos.ahoraMs + 61000) }), tiempos))).not.toBe(null)
  expect(errorDe(validarOrden(orden({ creada: enIso(tiempos.ahoraMs + 59000) }), tiempos))).toBe(null)
})

const CASA = String.raw`C:\Users\prueba`
const SESION = 'ses-prueba-1'
const RUTA_ORDEN = `C:/Users/prueba/.claude/oficina/ordenes/${SESION}.json`
const RUTA_LOCAL = `C:/Users/prueba/.claude/oficina/sesiones/${SESION}.json`

/**
 * Una sesión abierta con el mod: reloj, archivos y motor de mentira. Sin `gh` (cada consulta a
 * GitHub falla), así lo único que se publica es el archivo local, que es lo que lee el widget.
 */
async function abrirSesion($: Engine, on: On, opciones: { abortarFalla?: boolean; conGh?: boolean; entrada?: string; salirFalla?: boolean } = {}) {
  const reloj = mock.clock(on, { now: ARRANQUE })
  // Por omisión, una sesión de terminal (lo que Claude Code pone en CLAUDE_CODE_ENTRYPOINT)
  mock.env(on, { USERPROFILE: CASA, CLAUDE_CODE_ENTRYPOINT: opciones.entrada ?? 'cli' })
  mock.store(on, { yo: { login: 'nicoequintana', nombre: 'Quintana' } })
  const archivos = new Map<string, string>()
  const escrituras: string[] = []
  const enviados: string[] = []
  const abortados: string[] = []
  const comoUsuario: boolean[] = []
  /** Lo que pasa, en orden: abortos de turno y comandos corridos (así se ve que frena antes de salir). */
  const hechos: string[] = []
  let idActual = SESION
  on('session.id', () => ({ value: idActual }))
  on('session.cwd', () => ({ value: 'C:/proyectos/demo' }))
  on('session.repo', () => ({ value: null }))
  const comentarios: string[] = []
  on('process.run', (_, e) => {
    if (!opciones.conGh) return { value: { exitCode: 1, stdout: '', stderr: 'sin gh en la prueba' } } as never
    // Con gh: el Issue no tiene comentarios y cada POST o PATCH guarda el cuerpo publicado
    const cuerpo = e.argv.find(a => a.startsWith('body='))
    if (cuerpo) comentarios.push(cuerpo.slice('body='.length))
    return { value: { exitCode: 0, stdout: cuerpo ? '{}' : '[]', stderr: '' } } as never
  })
  on('command.register', (_, e) => ({ value: { command: e.name } }) as never)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // El motor entrega las rutas con la barra de la plataforma: se comparan siempre con "/"
  const barras = (ruta: string) => ruta.replace(/\\/g, '/')
  on('fs.read', (_, e) => {
    const texto = archivos.get(barras(e.path))
    if (texto === undefined) throw new Error('no existe')
    return { value: texto }
  })
  on('fs.write', (_, e) => {
    archivos.set(barras(e.path), e.text)
    escrituras.push(barras(e.path))
    return { value: undefined }
  })
  on('prompt.submit', (_, e) => {
    enviados.push(e.text)
    comoUsuario.push(e.origin.kind === 'plugin' && e.origin.asUser === true)
    return { text: e.text }
  })
  on('turn.abort', (_, e) => {
    if (opciones.abortarFalla) return { deny: `${e.turnId} no es el turno en curso` } as never
    abortados.push(e.turnId)
    hechos.push(`abort:${e.turnId}`)
    return { value: undefined }
  })
  // Medido el 23/11 contra Claude Code 2.1.331: `$.command.run({ command: 'exit' })` resuelve `{}` y
  // la sesión termina con session.end `prompt_input_exit` unos 2 s después
  on('command.run', (_, e) => {
    if (opciones.salirFalla) throw new Error('no se puede salir ahora')
    hechos.push(`comando:${e.command}`)
    return { text: '' } as never
  })
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  await $.session.start({ cwd: 'C:/proyectos/demo', surface: 'desktop', isInteractive: true })
  await reloj.settle()
  const leer = (ruta: string) => JSON.parse(archivos.get(ruta) ?? 'null') as Record<string, unknown> | null
  return {
    reloj,
    archivos,
    comentarios,
    escrituras,
    enviados,
    comoUsuario,
    abortados,
    hechos,
    /** El widget deja una orden y pasa una vuelta de la vigilancia. */
    ordenar: async (extra: Record<string, unknown>) => {
      archivos.set(RUTA_ORDEN, JSON.stringify(orden({ creada: enIso(reloj.now()), ...extra })))
      await reloj.advance(MS_ENTRE_ORDENES)
    },
    resultado: () => leer(RUTA_ORDEN),
    presencia: () => leer(RUTA_LOCAL),
    empezarTurno: (turnId: string, agentId?: string) => $.turn.start({ text: '', turnId, ...(agentId ? { agentId } : {}) }),
    terminarTurno: (turnId: string) =>
      $.turn.complete({ answer: 'listo', durationMs: 10, isAborted: false, turnId, reason: 'answer', index: 0, toolUses: 0 } as never),
    /** Termina la sesión con `reason`; tras /clear o /resume el proceso sigue con el id `nuevo`. */
    terminarSesion: async (reason: string, nuevo: string) => {
      await $.session.end({ reason, sessionId: idActual } as never)
      idActual = nuevo
      await reloj.settle()
    },
  }
}

for (const reason of ['clear', 'resume']) {
  test(`tras /${reason} el proceso sigue con otro id y las órdenes a ese id se toman`, async ($, on) => {
    const s = await abrirSesion($, on)
    await s.terminarSesion(reason, 'ses-prueba-2')
    const ruta = RUTA_ORDEN.replace(SESION, 'ses-prueba-2')
    s.archivos.set(ruta, JSON.stringify(orden({ creada: enIso(s.reloj.now()) })))
    await s.reloj.advance(MS_ENTRE_ORDENES)
    expect(s.enviados).toEqual(['Seguí con los tests'])
    expect((JSON.parse(s.archivos.get(ruta) ?? 'null') as Record<string, unknown>)?.resultado).toBe('enviado')
  })
}

test('cualquier otro fin de sesión deja de tomar órdenes', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.terminarSesion('logout', SESION)
  await s.ordenar({})
  expect(s.enviados).toEqual([])
})

test('el archivo local lleva la carpeta de la sesión y el comentario de GitHub no', async ($, on) => {
  const s = await abrirSesion($, on, { conGh: true })
  expect(s.presencia()?.cwd).toBe('C:/proyectos/demo')
  expect(s.comentarios.length > 0).toBe(true)
  for (const cuerpo of s.comentarios) {
    expect(cuerpo.includes(SESION)).toBe(true) // la sesión se sigue publicando
    expect(cuerpo.includes('cwd')).toBe(false)
    expect(cuerpo.includes('C:/proyectos/demo')).toBe(false)
  }
  // Escribir el turno al instante y el latido conservan la carpeta en el archivo local
  await s.empezarTurno('t-1')
  await s.reloj.advance(30000)
  expect(s.presencia()?.enTurno).toBe(true)
  expect(s.presencia()?.cwd).toBe('C:/proyectos/demo')
})

test('la presencia de la sesión dice que acepta órdenes del widget, sin nada en cola', async ($, on) => {
  const s = await abrirSesion($, on)
  expect(s.presencia()?.puedeControlar).toBe(true)
  expect(s.presencia()?.enCola).toBe(0)
})

test('el archivo local dice al instante si hay un turno del hilo principal que frenar', async ($, on) => {
  const s = await abrirSesion($, on)
  expect(s.presencia()?.enTurno).toBe(false)
  // Sin esperar al debounce de 15 s: el botón Frenar del widget depende de esto
  await s.empezarTurno('t1')
  expect(s.presencia()?.enTurno).toBe(true)
  expect(s.presencia()?.actividad).toBe('pensando')
  await s.terminarTurno('t1')
  expect(s.presencia()?.enTurno).toBe(false)
  expect(s.presencia()?.actividad).toBe('esperándote')
  // El turno de un subagente no es el que se frena
  await s.empezarTurno('ts', 'agente-1')
  expect(s.presencia()?.enTurno).toBe(false)
})

test('el archivo local dice cuándo fue el último turno del hilo principal, y el latido no lo cambia', async ($, on) => {
  const s = await abrirSesion($, on)
  // Sin turnos todavía: cuenta desde que arrancó la sesión
  const arranque = s.presencia()?.ultimoTurno
  expect(typeof arranque).toBe('string')
  await s.reloj.advance(60000)
  expect(s.presencia()?.ultimoTurno).toBe(arranque)
  await s.empezarTurno('t1')
  const empezo = enIso(s.reloj.now())
  expect(s.presencia()?.ultimoTurno).toBe(empezo)
  await s.reloj.advance(45000)
  await s.terminarTurno('t1')
  const termino = enIso(s.reloj.now())
  expect(s.presencia()?.ultimoTurno).toBe(termino)
  // El turno de un subagente no cuenta
  await s.reloj.advance(45000)
  await s.empezarTurno('ts', 'agente-1')
  expect(s.presencia()?.ultimoTurno).toBe(termino)
})

test('un mensaje con la sesión libre se envía con el texto exacto', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.ordenar({ texto: '  Seguí con los tests\nporfa  ' })
  expect(s.enviados).toEqual(['  Seguí con los tests\nporfa  '])
  // Decisión del usuario (22/11): "Sí, como mío": Claude lo lee como palabras del usuario, sin el marco del mod
  expect(s.comoUsuario).toEqual([true])
  expect(s.resultado()).toEqual({ v: 1, id: 'k3j9x0a1b2c3d4e5', consumida: true, resultado: 'enviado', cuando: enIso(s.reloj.now()) })
})

test('un mensaje con un turno en curso entra en cola, y la cola vuelve a 0 con el siguiente turno', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.empezarTurno('t1')
  await s.ordenar({})
  expect(s.enviados).toEqual(['Seguí con los tests'])
  expect(s.resultado()?.resultado).toBe('en-cola')
  expect(s.presencia()?.enCola).toBe(1)
  // Termina el turno y arranca el del mensaje encolado
  await s.terminarTurno('t1')
  await s.empezarTurno('t2')
  await s.reloj.settle()
  expect(s.presencia()?.enCola).toBe(0)
})

test('frenar con un turno en curso lo corta con su id, y la sesión queda esperándote', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.empezarTurno('t7')
  await s.ordenar({ tipo: 'frenar', texto: undefined })
  expect(s.abortados).toEqual(['t7'])
  expect(s.resultado()?.resultado).toBe('frenado')
  expect(s.presencia()?.actividad).toBe('esperándote')
  // Ya no hay turno: otro frenar no corta nada
  await s.ordenar({ id: 'otra1', tipo: 'frenar', texto: undefined })
  expect(s.abortados).toEqual(['t7'])
  expect(s.resultado()?.resultado).toBe('sin-turno')
})

test('frenar sin turno en curso no corta nada (el turno de un subagente no cuenta)', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.empezarTurno('ts', 'agente-1')
  await s.ordenar({ tipo: 'frenar', texto: undefined })
  expect(s.abortados).toEqual([])
  expect(s.resultado()?.resultado).toBe('sin-turno')
})

test('si el motor rechaza el frenar, la orden queda como fallo con su motivo', async ($, on) => {
  const s = await abrirSesion($, on, { abortarFalla: true })
  await s.empezarTurno('t1')
  await s.ordenar({ tipo: 'frenar', texto: undefined })
  expect(s.resultado()?.resultado).toBe('fallo')
  expect(String(s.resultado()?.motivo)).toContain('t1')
})

test('una orden inválida se descarta una sola vez con su motivo, y sin id válido va con id null', async ($, on) => {
  const s = await abrirSesion($, on)
  const invalida = JSON.stringify(orden({ id: 'NO VALE', texto: '', creada: enIso(ARRANQUE) }))
  s.archivos.set(RUTA_ORDEN, invalida)
  await s.reloj.advance(MS_ENTRE_ORDENES)
  expect(s.enviados).toEqual([])
  const r = s.resultado()
  expect(r?.resultado).toBe('descartada')
  expect(r?.id).toBe(null)
  expect(typeof r?.motivo).toBe('string')
  // Si el mismo archivo inválido vuelve a aparecer, no se reescribe en cada vuelta
  s.archivos.set(RUTA_ORDEN, invalida)
  const antes = s.escrituras.filter(p => p === RUTA_ORDEN).length
  await s.reloj.advance(MS_ENTRE_ORDENES * 3)
  expect(s.escrituras.filter(p => p === RUTA_ORDEN).length).toBe(antes)
  // Una vieja (de antes de que arrancara la sesión) trae id: se descarta con su id
  await s.ordenar({ id: 'vieja1', creada: enIso(ARRANQUE - 1000) })
  expect(s.resultado()?.resultado).toBe('descartada')
  expect(s.resultado()?.id).toBe('vieja1')
})

test('una orden consumida o con un id ya procesado no se ejecuta dos veces', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.ordenar({})
  expect(s.enviados.length).toBe(1)
  // El mismo id otra vez, sin consumir: no se manda de nuevo ni se toca el archivo
  await s.ordenar({})
  expect(s.enviados.length).toBe(1)
  expect(s.resultado()?.consumida).toBe(undefined)
  // Un archivo ya consumido tampoco
  s.archivos.set(RUTA_ORDEN, JSON.stringify({ v: 1, id: 'nueva1', consumida: true, resultado: 'enviado', cuando: enIso(s.reloj.now()) }))
  await s.reloj.advance(MS_ENTRE_ORDENES * 2)
  expect(s.enviados.length).toBe(1)
})

// ------------------------------------------------------------------ cerrar la sesión (v0.11, #25)

test('la presencia dice que se puede cerrar en una sesión de terminal', async ($, on) => {
  const s = await abrirSesion($, on)
  expect(s.presencia()?.puedeCerrar).toBe(true)
})

for (const entrada of ['claude-desktop', 'claude-vscode']) {
  test(`una sesión de ${entrada} no se ofrece para cerrar y descarta la orden`, async ($, on) => {
    const s = await abrirSesion($, on, { entrada })
    expect(s.presencia()?.puedeCerrar).toBe(false)
    await s.ordenar({ tipo: 'cerrar', texto: undefined })
    expect(s.hechos).toEqual([])
    expect(s.resultado()?.resultado).toBe('descartada')
    expect(String(s.resultado()?.motivo)).toContain('terminal')
  })
}

test('cerrar sale de la sesión con /exit y deja el resultado', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.ordenar({ tipo: 'cerrar', texto: undefined })
  expect(s.hechos).toEqual(['comando:exit'])
  expect(s.resultado()).toEqual({ v: 1, id: 'k3j9x0a1b2c3d4e5', consumida: true, resultado: 'cerrando', cuando: enIso(s.reloj.now()) })
  expect(s.enviados).toEqual([])
})

test('cerrar con un turno en curso primero lo corta y después sale', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.empezarTurno('t9')
  await s.ordenar({ tipo: 'cerrar', texto: undefined })
  expect(s.hechos).toEqual(['abort:t9', 'comando:exit'])
  expect(s.resultado()?.resultado).toBe('cerrando')
})

test('si el motor no deja salir, la orden queda como fallo con su motivo', async ($, on) => {
  const s = await abrirSesion($, on, { salirFalla: true })
  await s.ordenar({ tipo: 'cerrar', texto: undefined })
  expect(s.resultado()?.resultado).toBe('fallo')
  expect(String(s.resultado()?.motivo ?? '')).not.toBe('')
})

test('lo de antes sigue: al terminar el turno la sesión publica que te espera', async ($, on) => {
  const s = await abrirSesion($, on)
  await s.empezarTurno('t1')
  await s.terminarTurno('t1')
  // La publicación de la actividad espera su tanda de 15 s, como siempre
  await s.reloj.advance(15000)
  expect(s.presencia()?.actividad).toBe('esperándote')
  expect(s.presencia()?.puedeResponder).toBe(true)
})

// ------------------------------------------------------------------ v0.12.1: subagentes tras /reload-plugins
test('los subagentes que siguen corriendo se recuperan de la lista del motor, sin repetir los conocidos', () => {
  const lista = [
    { id: 'a1', description: 'Panel — T2.2b composición', type: 'general-purpose', status: 'running', kind: 'local_agent' },
    { id: 'a2', description: 'revisar', type: 'Explore', status: 'pending', kind: 'local_agent' },
    { id: 'a3', description: 'Edad — T2.1', type: 'general-purpose', status: 'waiting', kind: 'local_agent' },
    { id: 'a4', description: 'Costos — listo', type: 'general-purpose', status: 'completed', kind: 'local_agent' },
    { id: 'a5', description: 'Equipo — x', type: 'teammate', status: 'running', kind: 'in_process_teammate' },
    { id: 'a6', description: 'Ya conocido — y', type: 'general-purpose', status: 'running', kind: 'local_agent' },
  ]
  const r = subagentesEnCurso(lista, new Set(['a6']), '2026-11-26T18:00:00.000Z')
  expect(r.map(s => s.id)).toEqual(['a1', 'a2', 'a3'])
  expect(r[0]).toEqual({ id: 'a1', nombre: 'Panel', inventado: false, tipo: 'general-purpose', tarea: 'T2.2b composición', desde: '2026-11-26T18:00:00.000Z', estado: 'trabajando', hasta: null })
  expect(r[1]?.inventado).toBe(true)
})

test('al arrancar (también tras /reload-plugins) la presencia trae los subagentes que siguen corriendo', async ($, on) => {
  on('agent.list', () => ({ value: [{ id: 'ag-1', description: 'Panel — composición', type: 'general-purpose', status: 'running', kind: 'local_agent', taskStatus: 'running' }] }) as never)
  const s = await abrirSesion($, on)
  const agentes = s.presencia()?.agentes as Array<Record<string, unknown>>
  expect(agentes.map(a => [a.id, a.nombre, a.estado])).toEqual([['ag-1', 'Panel', 'trabajando']])
})

test('al arrancar sin turno en curso (sesión nueva o /reload-plugins) la presencia dice que te espera (v0.12.2)', async ($, on) => {
  const s = await abrirSesion($, on)
  expect(s.presencia()?.actividad).toBe('esperándote')
  expect(s.presencia()?.enTurno).toBe(false)
  // Con un turno, lo de siempre
  await s.empezarTurno('t1')
  expect(s.presencia()?.actividad).toBe('pensando')
})
