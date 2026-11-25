// Tests de los recibos de la charla con herramientas (#43, C2; docs/diseno/chat-herramientas-ux.md 4,
// 5 y 11.10): los encabezados, los verbos, las etiquetas de cada fila, cuándo sale el recibo de
// lectura, los cambios que no llegaron, la línea «Puede tocar», los anuncios, qué recibos lleva un
// mensaje y la diferencia que deja a pintarHilo agregar sin reescribir. Funciones puras (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  verboCambio, encabezadoRecibo, encabezadoError, metaCambio, debeMostrarLectura, faltantes, lineaPuede, anuncioRecibo,
  armarRecibos, diferenciaRecibos, tituloLectura, pieDeshacer, anuncioDeshacer,
} from '../src/recibos.js'
import { colorDe } from '../src/tareas.js'
import { recibosHtml, lineaPuedeHtml, globoPuedeHtml, pieCambiosHtml } from '../src/recibosVista.js'

// Hoy es miércoles 25/11/2026 (Argentina)
const HOY = '2026-11-25'
const LISTAS = [
  { id: 'l-casa', nombre: 'Casa', color: 'verde', orden: 0, tareas: [{ id: 't-gim', titulo: 'Ir al gimnasio', hecha: false }] },
  { id: 'l-compras', nombre: 'Compras', color: 'rosa', orden: 1, tareas: [] },
]

/** Un cambio como lo emite Rust (11.8). */
const cambio = (herramienta, extra = {}) => ({
  id: `c-${herramienta}`, herramienta, estado: 'hecho', lista: 'l-compras', tarea: 't-pan', titulo: 'Comprar pan',
  antes: null, despues: null, motivo: null, reintentable: false, args: null, ...extra,
})
const CREAR = cambio('tarea_crear', { despues: { titulo: 'Comprar pan', fecha: '2026-11-26', hecha: false, importante: false, lista: 'l-compras' } })
const TILDAR = cambio('tarea_tildar', { id: 'c-tilde', antes: { hecha: false, hechaEn: null, lista: 'l-compras' }, despues: { hecha: true, hechaEn: 1, lista: 'l-compras' } })
const DESTILDAR = cambio('tarea_tildar', { id: 'c-destilde', antes: { hecha: true, hechaEn: 1, lista: 'l-compras' }, despues: { hecha: false, hechaEn: null, lista: 'l-compras' } })
const editar = (antes, despues, extra = {}) => cambio('tarea_editar', { id: 'c-edit', antes: { lista: 'l-compras', ...antes }, despues: { lista: 'l-compras', ...despues }, ...extra })
const MOVER = editar({ lista: 'l-casa' }, { lista: 'l-compras' })
const FECHA = editar({ fecha: HOY }, { fecha: '2026-11-27' })
const ERROR = cambio('tarea_crear', { id: 'c-err', estado: 'error', tarea: null, lista: null, titulo: 'Turno con el dentista', motivo: 'No existe la lista «Salud».', reintentable: false, args: { titulo: 'Turno con el dentista', lista: 'Salud' } })
const LECTURA = (vista = 'hoy') => ({
  id: `c-lee-${vista}`, herramienta: 'tareas_ver', estado: 'lectura', lista: null, tarea: null, titulo: null, antes: null, despues: null, motivo: null, reintentable: false, args: null,
  resumen: { vista, nombre: null, hoy: HOY, hechas: 1, total: 3, mas: 0, filas: [{ tarea: 't-1', lista: 'l-casa', titulo: 'Pagar la luz', fecha: '2026-11-24', hecha: false, importante: false }] },
})
const MOSTRAR = cambio('tarea_mostrar', { id: 'c-mos', estado: 'mostrar', lista: 'l-casa', tarea: 't-gim', titulo: 'Ir al gimnasio', resumen: { para: 'borrar' } })
const herr = (...nombres) => nombres.map(n => ({ nombre: `mcp__avis__${n}`, detalle: '' }))
const msg = (extra = {}) => ({ rol: 'mascota', texto: 'Listo.', estado: 'ok', herramientas: [], turno: 1, ...extra })

// ------------------------------------------------------------------ 1. encabezadoRecibo

test('encabezadoRecibo: un caso por herramienta de 5.2 y varios → «{n} cambios»', () => {
  assert.equal(encabezadoRecibo([CREAR]), 'Anoté en Tareas')
  assert.equal(encabezadoRecibo([TILDAR]), 'Tildé en Tareas')
  assert.equal(encabezadoRecibo([DESTILDAR]), 'Destildé en Tareas')
  assert.equal(encabezadoRecibo([MOVER]), 'Moví en Tareas')
  assert.equal(encabezadoRecibo([FECHA]), 'Cambié en Tareas')
  assert.equal(encabezadoRecibo([CREAR, TILDAR]), '2 cambios')
  assert.equal(encabezadoRecibo([CREAR, TILDAR, MOVER]), '3 cambios')
})

test('encabezadoError: «No se anotó», «No se tildó», «No se cambió»', () => {
  assert.equal(encabezadoError(ERROR), 'No se anotó')
  assert.equal(encabezadoError({ ...ERROR, herramienta: 'tarea_tildar' }), 'No se tildó')
  assert.equal(encabezadoError({ ...ERROR, herramienta: 'tarea_editar' }), 'No se cambió')
})

// ------------------------------------------------------------------ 2. verboCambio

test('verboCambio: un caso por verbo de 5.2', () => {
  assert.equal(verboCambio(CREAR), 'anotada')
  assert.equal(verboCambio(TILDAR), 'tildada')
  assert.equal(verboCambio(DESTILDAR), 'destildada')
  assert.equal(verboCambio(FECHA), 'nueva fecha')
  assert.equal(verboCambio(editar({ fecha: HOY }, { fecha: null })), 'sin fecha')
  assert.equal(verboCambio(MOVER), 'movida')
  assert.equal(verboCambio(editar({ titulo: 'Pan' }, { titulo: 'Comprar pan' })), 'renombrada')
  assert.equal(verboCambio(editar({ importante: false }, { importante: true })), 'importante')
  assert.equal(verboCambio(editar({ importante: true }, { importante: false })), 'ya no importante')
  assert.equal(verboCambio(editar({ notas: '' }, { notas: 'Integral' })), 'notas')
  assert.equal(verboCambio(editar({ titulo: 'Pan', fecha: null }, { titulo: 'Comprar pan', fecha: HOY })), 'editada')
  // Mover y cambiar otro campo a la vez también es «editada»
  assert.equal(verboCambio(editar({ lista: 'l-casa', fecha: null }, { fecha: HOY })), 'editada')
})

// ------------------------------------------------------------------ 3. metaCambio

test('metaCambio: la lista que armó la charla (sin listas) lleva «· nueva», también antes de releer las listas', () => {
  const nueva = cambio('tarea_crear', {
    lista: 'l-tareas',
    despues: { titulo: 'Pan', fecha: null, hecha: false, importante: false, lista: 'l-tareas' },
    listaNueva: { nombre: 'Tareas', color: 'celeste' },
  })
  // Todavía sin leer: el nombre y el color vienen en el cambio
  assert.deepEqual(metaCambio(nueva, [], HOY), [{ tipo: 'lista', texto: 'Tareas · nueva', color: colorDe('celeste') }])
  // Ya leída: el de la pantalla (si el usuario la renombró, ese)
  const leidas = [{ id: 'l-tareas', nombre: 'Súper', color: 'verde', tareas: [] }]
  assert.deepEqual(metaCambio(nueva, leidas, HOY), [{ tipo: 'lista', texto: 'Súper · nueva', color: colorDe('verde') }])
  // Lo de antes: sin listaNueva, el chip de siempre
  assert.deepEqual(metaCambio(CREAR, LISTAS, HOY)[1], { tipo: 'lista', texto: 'Compras', color: 'rosa' })
})

test('metaCambio: la fecha con etiquetaFecha (ámbar hoy y mañana) y la lista con su color', () => {
  assert.deepEqual(metaCambio(CREAR, LISTAS, HOY), [
    { tipo: 'fecha', texto: 'mañana', tono: 'cerca' },
    { tipo: 'lista', texto: 'Compras', color: 'rosa' },
  ])
  const hoy = { ...CREAR, despues: { ...CREAR.despues, fecha: HOY } }
  assert.deepEqual(metaCambio(hoy, LISTAS, HOY)[0], { tipo: 'fecha', texto: 'hoy', tono: 'cerca' })
  const vencida = { ...CREAR, despues: { ...CREAR.despues, fecha: '2026-11-20' } }
  assert.deepEqual(metaCambio(vencida, LISTAS, HOY)[0], { tipo: 'fecha', texto: 'venció 20/11', tono: 'vencida' })
  const lejos = { ...CREAR, despues: { ...CREAR.despues, fecha: '2026-11-30' } }
  assert.deepEqual(metaCambio(lejos, LISTAS, HOY)[0], { tipo: 'fecha', texto: 'lun 30', tono: 'nada' })
})

test('metaCambio: «hoy → vie 27/11», «Casa → Compras» y una lista que ya no existe → sin chip', () => {
  assert.deepEqual(metaCambio(FECHA, LISTAS, HOY), [
    { tipo: 'fecha', texto: 'hoy → vie 27/11', tono: 'nada' },
    { tipo: 'lista', texto: 'Compras', color: 'rosa' },
  ])
  assert.deepEqual(metaCambio(MOVER, LISTAS, HOY), [{ tipo: 'lista', texto: 'Casa → Compras', color: 'rosa' }])
  assert.deepEqual(metaCambio({ ...CREAR, despues: { ...CREAR.despues, lista: 'l-borrada' } }, LISTAS, HOY), [{ tipo: 'fecha', texto: 'mañana', tono: 'cerca' }])
  assert.deepEqual(metaCambio(editar({ lista: 'l-borrada' }, { lista: 'l-compras' }), LISTAS, HOY), [])
  // Sin listas leídas todavía: solo la fecha
  assert.deepEqual(metaCambio(CREAR, [], HOY), [{ tipo: 'fecha', texto: 'mañana', tono: 'cerca' }])
})

// ------------------------------------------------------------------ 4. debeMostrarLectura

test('debeMostrarLectura: solo tareas_ver hoy → sí; tareas_ver y después tarea_crear → no; vista todas → no', () => {
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver'), cambios: [LECTURA('hoy')] })), true)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver'), cambios: [LECTURA('vencidas')] })), true)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver'), cambios: [LECTURA('lista')] })), true)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver', 'tarea_crear'), cambios: [LECTURA('hoy'), CREAR] })), false)
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver'), cambios: [LECTURA('todas')] })), false)
  // Mientras el turno corre, todavía no; sin lectura, no
  assert.equal(debeMostrarLectura(msg({ estado: 'escribiendo', herramientas: herr('tareas_ver'), cambios: [LECTURA('hoy')] })), false)
  assert.equal(debeMostrarLectura(msg()), false)
  // Un cambio que falló también es un cambio: no hay recibo de lectura
  assert.equal(debeMostrarLectura(msg({ herramientas: herr('tareas_ver', 'tarea_crear'), cambios: [LECTURA('hoy'), ERROR] })), false)
})

// ------------------------------------------------------------------ 5. faltantes

test('faltantes: 3 tool_use de cambio y 2 cambios registrados → 1; los tareas_ver no cuentan', () => {
  const m = msg({ herramientas: herr('tareas_ver', 'tarea_crear', 'tarea_tildar', 'tarea_editar', 'tareas_ver'), cambios: [LECTURA(), CREAR, TILDAR] })
  assert.equal(faltantes(m), 1)
  assert.equal(faltantes(msg({ herramientas: herr('tarea_crear'), cambios: [ERROR] })), 0)
  assert.equal(faltantes(msg({ herramientas: [{ nombre: 'Read', detalle: 'x' }] })), 0)
  assert.equal(faltantes(msg()), 0)
})

// ------------------------------------------------------------------ 7. lineaPuede (5.1)

test('lineaPuede: Claude, Local y Claude con C3', () => {
  const claude = lineaPuede({ motor: 'claude' })
  assert.equal(claude.local, false)
  assert.equal(`${claude.texto}${claude.fuerte}`, 'Puede tocar tus tareas')
  assert.equal(claude.pista, 'borrar, no ›')
  assert.equal(claude.etiqueta, 'Puede tocar tus tareas. Ver qué puede y qué no')
  assert.equal(claude.globo.map(s => s.t).join(''), 'Puede ver tus tareas, anotar, cambiar fecha, lista, notas o si es importante, y tildar. No puede borrar: eso lo hacés vos con un clic. Cada cambio queda acá con «Deshacer».')
  assert.deepEqual(claude.globo.filter(s => s.b).map(s => s.t), ['No puede borrar'])
  assert.equal(claude.nueva, null)
  const local = lineaPuede({ motor: 'local' })
  assert.equal(local.local, true)
  assert.equal(`${local.texto}${local.fuerte}`, 'Tareas y hábitos: todavía no con Local')
  assert.equal(local.pista, '?')
  assert.equal(local.etiqueta, 'Tareas y hábitos: todavía no con el modelo local. Ver más')
  assert.equal(local.globo.map(s => s.t).join(''), 'Con el modelo local, Avi todavía no toca tus tareas ni tus hábitos: solo charla. Para que los maneje, charlá con Claude Code.')
  assert.equal(local.nueva, 'Charla nueva con Claude Code')
  const c3 = lineaPuede({ motor: 'claude', habitos: true })
  assert.equal(c3.fuerte, 'tus tareas y hábitos')
  assert.match(c3.globo.map(s => s.t).join(''), /«Deshacer»\. Y ver y marcar tus hábitos de hoy\.$/)
})

test('lineaPuedeHtml y globoPuedeHtml: el botón con aria-expanded y su globo role=dialog; con Local, punteado', () => {
  const html = lineaPuedeHtml({ motor: 'claude', abierto: false })
  assert.match(html, /^<button type="button" class="puede" id="ch-puede" data-accion="ch-puede" aria-expanded="false" aria-label="Puede tocar tus tareas\. Ver qué puede y qué no">/)
  assert.match(html, /Puede tocar <b>tus tareas<\/b>/)
  assert.match(html, /<span class="mas" aria-hidden="true">borrar, no ›<\/span>/)
  assert.match(lineaPuedeHtml({ motor: 'local', abierto: true }), /class="puede no"[^>]*aria-expanded="true"/)
  assert.equal(globoPuedeHtml({ motor: 'claude', abierto: false }), '')
  const g = globoPuedeHtml({ motor: 'local', abierto: true })
  assert.match(g, /class="puede-globo" role="dialog" aria-label="Qué puede tocar"/)
  assert.match(g, /data-accion="ch-puede-nueva">Charla nueva con Claude Code<\/button>/)
  assert.match(g, /data-accion="ch-puede" aria-label="Cerrar"/)
  assert.doesNotMatch(globoPuedeHtml({ motor: 'claude', abierto: true }), /ch-puede-nueva/)
})

// ------------------------------------------------------------------ 8. anuncioRecibo (5.3)

test('anuncioRecibo: uno, varios y error', () => {
  assert.equal(anuncioRecibo([CREAR], HOY), 'Anotada: Comprar pan, mañana')
  assert.equal(anuncioRecibo([{ ...CREAR, despues: { ...CREAR.despues, fecha: null } }], HOY), 'Anotada: Comprar pan')
  assert.equal(anuncioRecibo([TILDAR], HOY), 'Tildada: Comprar pan')
  assert.equal(anuncioRecibo([CREAR, MOVER], HOY), '2 cambios: anotada Comprar pan; movida Comprar pan')
  assert.equal(anuncioRecibo([ERROR], HOY), 'No se anotó: Turno con el dentista. No existe la lista «Salud».')
  assert.equal(anuncioRecibo([], HOY), '')
})

// ------------------------------------------------------------------ qué recibos lleva un mensaje (3.2, 4.5 a 4.8)

test('armarRecibos: un recibo de cambios, los de error y para borrar en el orden en que llegan; lectura y no llegó al terminar', () => {
  const m = msg({ herramientas: herr('tarea_crear', 'tarea_crear', 'tarea_mostrar', 'tarea_tildar'), cambios: [CREAR, ERROR, MOSTRAR, TILDAR] })
  assert.deepEqual(armarRecibos(m).map(r => r.tipo), ['cambios', 'error', 'mostrar'])
  assert.deepEqual(armarRecibos(m)[0].cambios.map(c => c.id), [CREAR.id, TILDAR.id])
  const lee = msg({ herramientas: herr('tareas_ver'), cambios: [LECTURA('hoy')] })
  assert.deepEqual(armarRecibos(lee).map(r => r.tipo), ['lectura'])
  // Una lectura para buscar un id antes de cambiar algo no deja recibo
  assert.deepEqual(armarRecibos(msg({ herramientas: herr('tareas_ver', 'tarea_crear'), cambios: [LECTURA('hoy'), CREAR] })).map(r => r.tipo), ['cambios'])
  const falta = msg({ herramientas: herr('tarea_crear', 'tarea_crear'), cambios: [CREAR] })
  assert.deepEqual(armarRecibos(falta).map(r => r.tipo), ['cambios', 'nollego'])
  assert.deepEqual(armarRecibos({ ...falta, estado: 'escribiendo' }).map(r => r.tipo), ['cambios'])
  assert.deepEqual(armarRecibos(msg()), [])
})

test('tituloLectura: «Hoy · miércoles 25/11», «Vencidas» o el nombre de la lista', () => {
  assert.equal(tituloLectura(LECTURA('hoy').resumen), 'Hoy · miércoles 25/11')
  assert.equal(tituloLectura(LECTURA('vencidas').resumen), 'Vencidas')
  assert.equal(tituloLectura({ ...LECTURA('lista').resumen, nombre: 'Compras' }), 'Compras')
})

test('pieDeshacer: «Deshacer los {n}» con 2 o más por deshacer; «Deshechos {k} de {n}» cuando no queda ninguno', () => {
  assert.deepEqual(pieDeshacer([CREAR, TILDAR]), { boton: 'Deshacer los 2', estado: null })
  assert.deepEqual(pieDeshacer([CREAR]), { boton: null, estado: null })
  assert.deepEqual(pieDeshacer([{ ...CREAR, estado: 'deshecho' }, { ...TILDAR, estado: 'cambio-despues' }]), { boton: null, estado: 'Deshechos 1 de 2' })
  assert.deepEqual(pieDeshacer([{ ...CREAR, estado: 'deshecho' }, TILDAR]), { boton: null, estado: null })
})

// ------------------------------------------------------------------ 11.11: pintarHilo agrega sin reescribir

test('diferenciaRecibos: solo cambios nuevos al final → cuáles; otro estado o menos → null', () => {
  const a = msg({ estado: 'escribiendo', cambios: [CREAR] })
  assert.deepEqual(diferenciaRecibos(a, { ...a, texto: 'Listo, para mañana', cambios: [CREAR, TILDAR] }), { nuevos: [TILDAR] })
  assert.deepEqual(diferenciaRecibos(msg({ estado: 'escribiendo' }), { ...a }), { nuevos: [CREAR] })
  assert.deepEqual(diferenciaRecibos(a, a), { nuevos: [] })
  assert.equal(diferenciaRecibos(a, { ...a, cambios: [{ ...CREAR, estado: 'deshecho' }] }), null)
  assert.equal(diferenciaRecibos({ ...a, cambios: [CREAR, TILDAR] }, a), null)
  assert.equal(diferenciaRecibos(a, { ...a, cambios: [TILDAR, CREAR] }), null)
})

// ------------------------------------------------------------------ la vista de los recibos (4.2 a 4.8, 12)

const VISTA = { listas: LISTAS, hoy: HOY, ui: new Map(), mascota: 'Avi' }

test('recibosHtml: sin recibos, nada (una charla sin tareas se dibuja como antes)', () => {
  assert.equal(recibosHtml(msg(), 3, VISTA), '')
})

test('recibosHtml: un cambio → section.rec con su aria-label, «Ver en Tareas →» y la fila con «Deshacer» que la nombra', () => {
  const html = recibosHtml(msg({ cambios: [CREAR] }), 3, VISTA)
  assert.match(html, /^<div class="recibos" data-i="3">/)
  assert.match(html, /<section class="rec" data-rec="cambios" aria-label="Anoté en Tareas">/)
  assert.match(html, /<span class="rec-t">Anoté en Tareas<\/span><button type="button" class="lnk" data-accion="ch-ver-tareas" data-lista="l-compras" data-tarea="t-pan">Ver en Tareas →<\/button>/)
  assert.match(html, /<div class="rf" data-cambio="c-tarea_crear" role="group" aria-label="anotada: Comprar pan">/)
  assert.match(html, /<span class="vb">anotada ·<\/span><span class="tg h">mañana<\/span><span class="tg" style="--c:var\(--rosa\)"><i aria-hidden="true"><\/i>Compras<\/span>/)
  assert.match(html, /<button type="button" class="deshacer" data-accion="ch-deshacer" data-cambio="c-tarea_crear" aria-label="Deshacer: anotada Comprar pan">/)
  assert.match(html, />Deshacer<\/button>/)
  assert.doesNotMatch(html, /rec-pie/)
  // Mientras el turno corre, la región se anuncia; terminado, no
  assert.match(recibosHtml(msg({ estado: 'escribiendo', cambios: [CREAR] }), 3, { ...VISTA, enCurso: true }), /^<div class="recibos" data-i="3" aria-live="polite">/)
})

test('recibosHtml: dos cambios → filas con solo el ícono (con su aria-label) y el pie «Deshacer los 2»', () => {
  const html = recibosHtml(msg({ cambios: [CREAR, TILDAR] }), 1, VISTA)
  assert.match(html, /aria-label="2 cambios"/)
  assert.equal((html.match(/class="deshacer solo"/g) ?? []).length, 2)
  assert.match(html, /<div class="rec-pie" tabindex="-1" data-pie="1"><span>tareas<\/span><button type="button" class="deshacer" data-accion="ch-deshacer-todos" data-i="1">[\s\S]*Deshacer los 2<\/button><\/div>/)
  // La tildada lleva el círculo lleno con el visto (decorativo)
  assert.match(html, /data-cambio="c-tilde"[^>]*><span class="cir on" aria-hidden="true">/)
})

test('recibosHtml: los estados de Deshacer (4.4): en curso, deshecho, cambió después y falló', () => {
  const curso = recibosHtml(msg({ cambios: [CREAR] }), 0, { ...VISTA, ui: new Map([[CREAR.id, 'curso']]) })
  assert.match(curso, /class="deshacer gira"[^>]*aria-busy="true" aria-disabled="true"/)
  const hecho = recibosHtml(msg({ cambios: [{ ...CREAR, estado: 'deshecho' }] }), 0, VISTA)
  assert.match(hecho, /<div class="rf deshecho"/)
  assert.match(hecho, /<span class="estado-d" tabindex="-1" data-estado="c-tarea_crear">Deshecho<\/span>/)
  assert.doesNotMatch(hecho, /data-accion="ch-deshacer"/)
  const despues = recibosHtml(msg({ cambios: [{ ...CREAR, estado: 'cambio-despues' }] }), 0, VISTA)
  assert.match(despues, /<span class="estado-d" tabindex="-1" data-estado="c-tarea_crear" title="La tarea cambió en Tareas después de esto: cambiala a mano\.">Cambió después<\/span>/)
  const fallo = recibosHtml(msg({ cambios: [CREAR] }), 0, { ...VISTA, ui: new Map([[CREAR.id, 'fallo']]) })
  assert.match(fallo, /data-accion="ch-deshacer"/)
  assert.match(fallo, /<p class="rf-err" role="alert">No se pudo deshacer\. Probá de nuevo\.<\/p>/)
})

test('recibosHtml: error (4.7) con su motivo, «Reintentar» solo si es reintentable, y «Abrir Tareas»', () => {
  const html = recibosHtml(msg({ cambios: [ERROR] }), 0, VISTA)
  assert.match(html, /<section class="rec mal" data-rec="error" data-cambio="c-err" aria-label="No se anotó">/)
  assert.match(html, /<p class="motivo">No existe la lista «Salud»\.<\/p>/)
  assert.doesNotMatch(html, /Reintentar/)
  assert.match(html, /<button type="button" class="mini sutil" data-accion="ch-abrir-tareas">Abrir Tareas<\/button>/)
  const otra = recibosHtml(msg({ cambios: [{ ...ERROR, reintentable: true, motivo: 'No se pudo guardar. No cambió nada.' }] }), 0, VISTA)
  assert.match(otra, /<button type="button" class="mini pri" data-accion="ch-reintentar-cambio" data-cambio="c-err">Reintentar<\/button>/)
})

test('recibosHtml: para borrar (4.6) con «Ir a la tarea →»; si ya no está, «Ya no está» apagado', () => {
  const html = recibosHtml(msg({ cambios: [MOSTRAR] }), 0, VISTA)
  assert.match(html, /<section class="rec neutro" data-rec="mostrar" data-cambio="c-mos" aria-label="Para borrar">/)
  assert.match(html, /<button type="button" class="mini pri" data-accion="ch-ir-tarea" data-lista="l-casa" data-tarea="t-gim">Ir a la tarea →<\/button>/)
  const ido = recibosHtml(msg({ cambios: [MOSTRAR] }), 0, { ...VISTA, listas: [{ ...LISTAS[0], tareas: [] }, LISTAS[1]] })
  assert.match(ido, /data-accion="ch-ir-tarea"[^>]*aria-disabled="true">Ya no está<\/button>/)
})

test('recibosHtml: lectura (4.5) con su avance, sus filas sin «Deshacer» y «Abrir Tareas →»; no llegó (4.8)', () => {
  const lee = recibosHtml(msg({ herramientas: herr('tareas_ver'), cambios: [LECTURA('hoy')] }), 0, VISTA)
  assert.match(lee, /<section class="rec lee" data-rec="lectura" data-cambio="c-lee-hoy" aria-label="Hoy · miércoles 25\/11">/)
  assert.match(lee, /<span class="prog" aria-hidden="true" style="--p:33\.3%"><i><\/i><\/span><span class="cuenta">1 de 3<\/span>/)
  assert.match(lee, /Pagar la luz/)
  assert.match(lee, /<span class="tg v">ayer<\/span>/)
  assert.doesNotMatch(lee, /ch-deshacer/)
  assert.match(lee, /<span>solo lectura · no cambió nada<\/span><button type="button" class="mini pri" data-accion="ch-abrir-tareas">Abrir Tareas →<\/button>/)
  const mas = recibosHtml(msg({ herramientas: herr('tareas_ver'), cambios: [{ ...LECTURA('hoy'), resumen: { ...LECTURA('hoy').resumen, mas: 4 } }] }), 0, VISTA)
  assert.match(mas, /y 4 más/)
  const falta = recibosHtml(msg({ herramientas: herr('tarea_crear') }), 0, VISTA)
  assert.match(falta, /<section class="rec mal" data-rec="nollego" aria-label="Un cambio no llegó a Avis">/)
  assert.match(falta, /Avi intentó cambiar algo y Avis no lo recibió\. No cambió nada; revisá en Tareas\./)
})

test('recibosHtml: todo lo que viene del modelo va escapado', () => {
  const malo = { ...CREAR, titulo: '<img src=x onerror=alert(1)>' }
  const html = recibosHtml(msg({ cambios: [malo] }), 0, VISTA)
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

// ------------------------------------------------------------------ corrección de C2 (verificador)

test('el pie del recibo siempre puede tomar el foco (9.3: «Deshacer los {n}» deja el foco en el pie), aunque no quede nada por deshacer', () => {
  const todos = [{ ...CREAR, estado: 'deshecho' }, { ...TILDAR, estado: 'deshecho' }]
  assert.equal(pieCambiosHtml(todos, 2), '<div class="rec-pie" tabindex="-1" data-pie="2"><span>tareas</span></div>')
  assert.match(pieCambiosHtml([CREAR, TILDAR], 2), /^<div class="rec-pie" tabindex="-1" data-pie="2">/)
})

test('anuncioDeshacer: los textos de 5.3; los que 5.3 no define, con el formato del anuncio de fin', () => {
  assert.equal(anuncioDeshacer([[CREAR, 'deshecho']]), 'Deshecho: Comprar pan')
  assert.equal(anuncioDeshacer([[CREAR, 'error']]), 'No se pudo deshacer Comprar pan')
  assert.equal(anuncioDeshacer([[CREAR, 'cambio-despues']]), 'Cambió después: Comprar pan')
  assert.equal(anuncioDeshacer([[TILDAR, 'deshecho'], [CREAR, 'cambio-despues']]), '2 cambios: deshecho Comprar pan; cambió después Comprar pan')
  assert.equal(anuncioDeshacer([]), '')
})

test('Reintentar anuncia el cambio nuevo como el anuncio de fin (5.3): «Anotada: {título}, {fecha}»', () => {
  assert.equal(anuncioRecibo([CREAR], HOY), 'Anotada: Comprar pan, mañana')
})
