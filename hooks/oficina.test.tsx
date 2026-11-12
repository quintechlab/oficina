import { expect, test } from 'claude-code/testing'

import type { Miembro, Presencia } from '../types'
import {
  archivosEnComun,
  choques,
  ciDesdeRollup,
  diferencias,
  envolverPresencia,
  estadoVisible,
  extraerPresencia,
  formatoDuracion,
  iniciales,
  mapaNombres,
  repoDesdeRemoto,
  restante,
  talleDesdeCuerpo,
  tareaDesdeRama,
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

test('la presencia sobrevive el viaje de ida y vuelta por el comentario', async () => {
  const p = presencia({ nota: 'viendo el bug del login' })
  const leida = extraerPresencia(envolverPresencia(p))
  expect(leida).toEqual(p)
  expect(extraerPresencia('un comentario cualquiera')).toBe(null)
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
    miembro({ esYo: true, presencia: { usuario: 'nicoequintana', nombre: 'Quintana', rama: 'feat/60-cupones', tarea: 60, archivos: ['src/carrito.ts'] }, tarea: { numero: 60, titulo: 'Cupones', talle: 'S', abierta: true, url: '', horasRegistradas: null, estadoTablero: null } }),
    miembro({ prs: [{ numero: 10, titulo: 'Carrito', url: '', ci: 'ok', borrador: false }] }),
  ]
  on('clock.now', () => ({ value: Date.parse(AHORA) }))
  on('state.get', (_, e) =>
    e.key === 'miembros'
      ? { value: { value: { shape: 'miembros-1', value: lista }, version: 1 } }
      : { value: { value: { yo: 'nicoequintana', error: null, actualizado: AHORA, datos: 'quintechlab/oficina-datos' }, version: 1 } },
  )

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (surface === 'terminal') {
      // Sin SVG: la cabecera es texto
      expect((await ui.find({ type: 'Text', text: /Quintana/ }))?.text).toContain('Quintana')
    } else {
      // Con SVG: nombre y estado viven en la cabecera dibujada; su `alt` los repite
      expect(String((await ui.find({ type: 'Svg' }))?.props.alt)).toContain('Quintana (vos), trabajando')
    }
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
