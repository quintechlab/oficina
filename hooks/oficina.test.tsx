import { expect, test } from 'claude-code/testing'

import type { ComentarioPresencia, Miembro, Pregunta, Presencia } from '../types'
import {
  archivosDesdeStatus,
  archivosEnComun,
  choques,
  ciDesdeRollup,
  diferencias,
  elegirPrincipal,
  envolverComentario,
  estadoVisible,
  extraerComentario,
  formatoDuracion,
  actividadDesdeHerramienta,
  iniciales,
  mapaNombres,
  NOMBRES_INVENTADOS,
  nombreSubagente,
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
} from './logica'

const PANE = {
  plugin: 'oficina',
  component: 'Pane',
  requestId: 'oficina',
  props: {
    title: 'Oficina · Quintech Studio',
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
