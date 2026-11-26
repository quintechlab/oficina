// Tests de los recibos de hábitos de la charla (#43, C3; docs/diseno/chat-herramientas-ux.md 4.3, 4.5,
// 5 y 11.10): el verbo y el encabezado de `habito_marcar`, la fila con el anillo de 18 y su etiqueta, el
// vínculo «Ver en Hábitos →», el pie «tareas y hábitos», la lectura con la fila de hábitos de hoy
// (píldoras con anillo) y los cambios de hábitos que no llegaron. Funciones puras (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  verboCambio, encabezadoRecibo, encabezadoError, metaCambio, debeMostrarLectura, faltantes, armarRecibos, anuncioRecibo,
  vinculoRecibo, etiquetaPie, tituloLectura, ESCRIBEN,
} from '../src/recibos.js'
import { recibosHtml, pieCambiosHtml, anilloHtml, lineaPuedeHtml, globoPuedeHtml } from '../src/recibosVista.js'

const HOY = '2026-11-25'
const LISTAS = [{ id: 'l-compras', nombre: 'Compras', color: 'rosa', orden: 1, tareas: [] }]
const VISTA = { listas: LISTAS, hoy: HOY, ui: new Map(), enCurso: false }

/** Un `habito_marcar` como lo emite Rust (11.8 y C3). */
const marcar = (extra = {}) => ({
  id: 'c-agua', herramienta: 'habito_marcar', estado: 'hecho', lista: null, tarea: null, habito: 'h-agua', titulo: 'Agua',
  antes: { dia: HOY, valor: 2 }, despues: { dia: HOY, valor: 3 },
  marca: { tipo: 'cantidad', meta: 8, unidad: 'vasos', color: 'celeste' },
  motivo: null, reintentable: false, args: null, ...extra,
})
const AGUA = marcar()
const CAMINAR = marcar({ id: 'c-caminar', habito: 'h-caminar', titulo: 'Caminar', antes: { dia: HOY, valor: 0 }, despues: { dia: HOY, valor: 1 }, marca: { tipo: 'diario', meta: 1, unidad: '', color: 'verde' } })
const DESMARCAR = marcar({ id: 'c-des', habito: 'h-caminar', titulo: 'Caminar', antes: { dia: HOY, valor: 1 }, despues: { dia: HOY, valor: 0 }, marca: { tipo: 'diario', meta: 1, unidad: '', color: 'verde' } })
const CREAR = {
  id: 'c-crear', herramienta: 'tarea_crear', estado: 'hecho', lista: 'l-compras', tarea: 't-pan', titulo: 'Comprar pan',
  antes: null, despues: { titulo: 'Comprar pan', fecha: '2026-11-26', hecha: false, importante: false, lista: 'l-compras' },
  motivo: null, reintentable: false, args: null,
}
const ERROR = marcar({ id: 'c-herr', estado: 'error', antes: null, despues: null, marca: undefined, motivo: 'Hoy no toca «Yoga».', titulo: 'Yoga', habito: 'h-yoga', args: { id: 'h-yoga', valor: 1, dia: HOY } })
const LEE_HAB = {
  id: 'c-lee-hab', herramienta: 'habitos_ver', estado: 'lectura', lista: null, tarea: null, titulo: null, antes: null, despues: null, motivo: null, reintentable: false, args: null,
  resumen: {
    vista: 'habitos', hoy: HOY, hechas: 1, total: 3, mas: 0,
    habitos: [
      { habito: 'h-agua', nombre: 'Agua', tipo: 'cantidad', meta: 8, valor: 3, hecho: false, color: 'celeste' },
      { habito: 'h-caminar', nombre: 'Caminar', tipo: 'diario', meta: 1, valor: 1, hecho: true, color: 'verde' },
      { habito: 'h-leer', nombre: 'Leer 20 min', tipo: 'diario', meta: 1, valor: 0, hecho: false, color: 'rosa' },
    ],
  },
}
const LEE_TAR = {
  id: 'c-lee-hoy', herramienta: 'tareas_ver', estado: 'lectura', lista: null, tarea: null, titulo: null, antes: null, despues: null, motivo: null, reintentable: false, args: null,
  resumen: { vista: 'hoy', nombre: null, hoy: HOY, hechas: 0, total: 1, mas: 0, filas: [{ tarea: 't-1', lista: 'l-compras', titulo: 'Pagar la luz', fecha: HOY, hecha: false, importante: false }] },
}
const herr = (...nombres) => nombres.map(n => ({ nombre: `mcp__avis__${n}`, detalle: '' }))
const msg = (extra = {}) => ({ rol: 'mascota', texto: 'Listo.', estado: 'ok', herramientas: [], turno: 1, ...extra })

test('habito_marcar escribe: va al recibo de cambios con «Deshacer» y cuenta para «no llegó»', () => {
  assert.ok(ESCRIBEN.includes('habito_marcar'))
  assert.deepEqual(armarRecibos(msg({ herramientas: herr('habito_marcar'), cambios: [AGUA] })).map(r => r.tipo), ['cambios'])
  assert.equal(faltantes(msg({ herramientas: herr('habito_marcar', 'habito_marcar'), cambios: [AGUA] })), 1)
  // Leer los hábitos no cuenta
  assert.equal(faltantes(msg({ herramientas: herr('habitos_ver', 'habito_marcar'), cambios: [LEE_HAB, AGUA] })), 0)
})

test('verboCambio y encabezadoRecibo de un hábito (5.2): «marcado» y «Marqué en Hábitos»; un error, «No se marcó»', () => {
  assert.equal(verboCambio(AGUA), 'marcado')
  assert.equal(verboCambio(DESMARCAR), 'marcado')
  assert.equal(encabezadoRecibo([AGUA]), 'Marqué en Hábitos')
  assert.equal(encabezadoRecibo([CREAR, AGUA]), '2 cambios')
  assert.equal(encabezadoError(ERROR), 'No se marcó')
  // Lo de antes: los de tareas siguen igual
  assert.equal(encabezadoRecibo([CREAR]), 'Anoté en Tareas')
  assert.equal(encabezadoError(CREAR), 'No se anotó')
})

test('metaCambio de un hábito: «{n} de {meta} {unidad} hoy» en cantidad; «hecho hoy» o «sin marcar hoy» en los demás', () => {
  assert.deepEqual(metaCambio(AGUA, LISTAS, HOY), [{ tipo: 'habito', texto: '3 de 8 vasos hoy' }])
  assert.deepEqual(metaCambio(marcar({ marca: { tipo: 'cantidad', meta: 5, unidad: '', color: 'celeste' } }), LISTAS, HOY), [{ tipo: 'habito', texto: '3 de 5 hoy' }])
  assert.deepEqual(metaCambio(CAMINAR, LISTAS, HOY), [{ tipo: 'habito', texto: 'hecho hoy' }])
  assert.deepEqual(metaCambio(DESMARCAR, LISTAS, HOY), [{ tipo: 'habito', texto: 'sin marcar hoy' }])
  // Un error de hábito no lleva etiquetas de tareas
  assert.deepEqual(metaCambio(ERROR, LISTAS, HOY), [])
})

test('vinculoRecibo (5.2): «Ver en Hábitos →» si todos son de hábitos; si no, «Ver en Tareas →» de la última tarea', () => {
  assert.deepEqual(vinculoRecibo([AGUA, CAMINAR]), { texto: 'Ver en Hábitos →', accion: 'ch-ver-habitos', lista: '', tarea: '' })
  assert.deepEqual(vinculoRecibo([CREAR, AGUA]), { texto: 'Ver en Tareas →', accion: 'ch-ver-tareas', lista: 'l-compras', tarea: 't-pan' })
  assert.deepEqual(vinculoRecibo([CREAR]), { texto: 'Ver en Tareas →', accion: 'ch-ver-tareas', lista: 'l-compras', tarea: 't-pan' })
})

test('etiquetaPie (5.2): «tareas», «tareas y hábitos» o «hábitos»', () => {
  assert.equal(etiquetaPie([CREAR, CREAR]), 'tareas')
  assert.equal(etiquetaPie([CREAR, AGUA]), 'tareas y hábitos')
  assert.equal(etiquetaPie([AGUA, CAMINAR]), 'hábitos')
})

test('debeMostrarLectura con hábitos: habitos_ver al final sí; con un cambio después, no; tareas_ver «todas», como antes, no', () => {
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('habitos_ver'), cambios: [LEE_HAB] })), true)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('habitos_ver', 'habito_marcar'), cambios: [LEE_HAB, AGUA] })), false)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('habitos_ver', 'habito_marcar'), cambios: [LEE_HAB] })), false)
  const todas = { ...LEE_TAR, id: 'c-todas', resumen: { ...LEE_TAR.resumen, vista: 'todas' } }
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver'), cambios: [todas] })), false)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver'), cambios: [LEE_TAR] })), true)
})

test('armarRecibos: «¿qué tengo hoy?» con tareas y hábitos es un solo recibo de lectura con la fila de hábitos', () => {
  const ambos = armarRecibos(msg({ herramientas: herr('tareas_ver', 'habitos_ver'), cambios: [LEE_TAR, LEE_HAB] }))
  assert.equal(ambos.length, 1)
  assert.equal(ambos[0].cambio.id, 'c-lee-hoy')
  assert.equal(ambos[0].habitos.id, 'c-lee-hab')
  const alReves = armarRecibos(msg({ herramientas: herr('habitos_ver', 'tareas_ver'), cambios: [LEE_HAB, LEE_TAR] }))
  assert.equal(alReves[0].cambio.id, 'c-lee-hoy')
  assert.equal(alReves[0].habitos.id, 'c-lee-hab')
  const solo = armarRecibos(msg({ herramientas: herr('habitos_ver'), cambios: [LEE_HAB] }))
  assert.equal(solo[0].cambio.id, 'c-lee-hab')
  assert.equal(solo[0].habitos, undefined)
  // Lo de antes: solo tareas, sin `habitos`
  assert.equal(armarRecibos(msg({ herramientas: herr('tareas_ver'), cambios: [LEE_TAR] }))[0].habitos, undefined)
})

test('tituloLectura de los hábitos: «Hoy · {día} {d/m}»', () => {
  assert.equal(tituloLectura(LEE_HAB.resumen), 'Hoy · miércoles 25/11')
})

test('anuncioRecibo de un hábito (5.3): «Marcado: Agua»; un error, «No se marcó: Yoga. {motivo}»', () => {
  assert.equal(anuncioRecibo([AGUA], HOY), 'Marcado: Agua')
  assert.equal(anuncioRecibo([ERROR], HOY), 'No se marcó: Yoga. Hoy no toca «Yoga».')
  assert.equal(anuncioRecibo([CREAR, AGUA], HOY), '2 cambios: anotada Comprar pan; marcado Agua')
})

test('anilloHtml: el anillo de 18 con su avance (decorativo), lleno con la meta y vacío en 0', () => {
  const C = 2 * Math.PI * 7
  assert.match(anilloHtml(3, 8, 'celeste'), /^<svg class="anillo" viewBox="0 0 18 18" aria-hidden="true">/)
  assert.match(anilloHtml(3, 8, 'celeste'), new RegExp(`stroke-dasharray="${(C * 3 / 8).toFixed(2)} ${C.toFixed(2)}"`))
  assert.match(anilloHtml(3, 8, 'celeste'), /style="stroke:var\(--celeste\)"/)
  assert.match(anilloHtml(12, 8, 'verde'), new RegExp(`stroke-dasharray="${C.toFixed(2)} ${C.toFixed(2)}"`))
  assert.match(anilloHtml(0, 1, 'rosa'), /stroke-dasharray="0\.00 /)
  // Un color que no es de la paleta cae al primero
  assert.match(anilloHtml(1, 1, 'fucsia"><script>'), /style="stroke:var\(--celeste\)"/)
})

test('recibosHtml: la fila de un hábito con el anillo de 18, «marcado ·», su etiqueta y «Deshacer»', () => {
  const html = recibosHtml(msg({ herramientas: herr('habito_marcar'), cambios: [AGUA] }), 0, VISTA)
  assert.match(html, /<section class="rec" data-rec="cambios" aria-label="Marqué en Hábitos">/)
  assert.match(html, /<div class="rf" data-cambio="c-agua" role="group" aria-label="marcado: Agua"><svg class="anillo"/)
  assert.match(html, /<span class="vb">marcado ·<\/span><span class="tg">3 de 8 vasos hoy<\/span>/)
  assert.match(html, /data-accion="ch-deshacer" data-cambio="c-agua" aria-label="Deshacer: marcado Agua">/)
  assert.match(html, /<button type="button" class="lnk" data-accion="ch-ver-habitos" data-lista="" data-tarea="">Ver en Hábitos →<\/button>/)
  assert.doesNotMatch(html, /class="cir/)
})

test('recibosHtml: con tareas y hábitos, el pie dice «tareas y hábitos» y el vínculo va a la última tarea', () => {
  const html = recibosHtml(msg({ herramientas: herr('tarea_crear', 'habito_marcar'), cambios: [CREAR, AGUA] }), 0, VISTA)
  assert.match(html, /<span>tareas y hábitos<\/span>/)
  assert.match(html, /data-accion="ch-ver-tareas" data-lista="l-compras" data-tarea="t-pan">Ver en Tareas →/)
  assert.equal(pieCambiosHtml([AGUA, CAMINAR], 1).includes('<span>hábitos</span>'), true)
  // Lo de antes: solo tareas, «tareas»
  assert.equal(pieCambiosHtml([CREAR, { ...CREAR, id: 'c-2' }], 1).includes('<span>tareas</span>'), true)
})

test('recibosHtml: el error de un hábito dice «No se marcó», su motivo y «Abrir Hábitos»', () => {
  const html = recibosHtml(msg({ herramientas: herr('habito_marcar'), cambios: [ERROR] }), 0, VISTA)
  assert.match(html, /<section class="rec mal" data-rec="error" data-cambio="c-herr" aria-label="No se marcó">/)
  assert.match(html, /<p class="motivo">Hoy no toca «Yoga»\.<\/p>/)
  assert.match(html, /<button type="button" class="mini sutil" data-accion="ch-abrir-habitos">Abrir Hábitos<\/button>/)
  assert.doesNotMatch(html, /ch-abrir-tareas/)
})

test('recibosHtml: la lectura con tareas lleva la fila de hábitos de hoy (píldoras con anillo) y «Hábitos →»', () => {
  const html = recibosHtml(msg({ herramientas: herr('tareas_ver', 'habitos_ver'), cambios: [LEE_TAR, LEE_HAB] }), 0, VISTA)
  assert.match(html, /aria-label="Hoy · miércoles 25\/11"/)
  assert.match(html, /Pagar la luz/)
  assert.match(html, /<div class="hab" aria-label="Hábitos de hoy">/)
  assert.match(html, /<span class="pil"><svg class="anillo"[^]*?<\/svg>Agua 3\/8<\/span>/)
  assert.match(html, /<span class="pil hecho"><svg class="anillo"[^]*?<\/svg>Caminar<\/span>/)
  assert.match(html, /<span class="pil"><svg class="anillo"[^]*?<\/svg>Leer 20 min<\/span>/)
  assert.match(html, /<button type="button" class="mini sutil" data-accion="ch-abrir-habitos">Hábitos →<\/button><button type="button" class="mini pri" data-accion="ch-abrir-tareas">Abrir Tareas →<\/button>/)
})

test('recibosHtml: la lectura solo de hábitos: su avance, las píldoras y «Abrir Hábitos →», sin filas de tareas', () => {
  const html = recibosHtml(msg({ herramientas: herr('habitos_ver'), cambios: [LEE_HAB] }), 0, VISTA)
  assert.match(html, /<section class="rec lee" data-rec="lectura" data-cambio="c-lee-hab" aria-label="Hoy · miércoles 25\/11">/)
  assert.match(html, /<span class="cuenta">1 de 3<\/span>/)
  assert.match(html, /<div class="hab" aria-label="Hábitos de hoy">/)
  assert.doesNotMatch(html, /class="rf/)
  assert.match(html, /<span>solo lectura · no cambió nada<\/span><button type="button" class="mini pri" data-accion="ch-abrir-habitos">Abrir Hábitos →<\/button>/)
  const mas = recibosHtml(msg({ herramientas: herr('habitos_ver'), cambios: [{ ...LEE_HAB, resumen: { ...LEE_HAB.resumen, mas: 2 } }] }), 0, VISTA)
  assert.match(mas, /y 2 más/)
})

test('recibosHtml: lo que viene del disco en un hábito va escapado', () => {
  const malo = marcar({ titulo: '<b>x</b>', marca: { tipo: 'cantidad', meta: 8, unidad: '<i>', color: 'celeste' } })
  const html = recibosHtml(msg({ cambios: [malo] }), 0, VISTA)
  assert.doesNotMatch(html, /<b>x<\/b>|<i>/)
  const pil = { ...LEE_HAB, resumen: { ...LEE_HAB.resumen, habitos: [{ ...LEE_HAB.resumen.habitos[0], nombre: '<img src=x>' }] } }
  assert.doesNotMatch(recibosHtml(msg({ herramientas: herr('habitos_ver'), cambios: [pil] }), 0, VISTA), /<img/)
})

test('la línea «Puede tocar» con C3: «tus tareas y hábitos» y el globo suma los hábitos de hoy', () => {
  const linea = lineaPuedeHtml({ motor: 'claude', habitos: true })
  assert.match(linea, /aria-label="Puede tocar tus tareas y hábitos\. Ver qué puede y qué no"/)
  assert.match(linea, /Puede tocar <b>tus tareas y hábitos<\/b>/)
  assert.match(globoPuedeHtml({ motor: 'claude', abierto: true, habitos: true }), /Y ver y marcar tus hábitos de hoy\./)
})
