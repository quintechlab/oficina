// Tests de tareas.js (#39, docs/diseno/tareas-ux.md 11.5): el día en hora de Argentina, el rótulo de
// fecha, las vistas Hoy, Vencidas y cada lista, la cuenta de la fila de la barra, el aviso diario,
// los nombres de lista, Esc por capas, Ctrl T, el color de la lista nueva, confirmar en el mismo
// botón y los cambios de cada lista (puros: devuelven una lista nueva y nunca tocan la de antes).
// El formato es el v1 de tareas.rs: `creada` y `hechaEn` en ms.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  hoyArgentina, diasEntre, etiquetaFecha, vista, cuentas, debeAvisar, validarNombreLista, textoErrorLista, validarTitulo,
  alEscTareas, esAtajoTareas, colorSiguiente, COLORES, textoBorrarLista, nuevaLista, renombrarLista, agregarTarea,
  tildarTarea, listaParaHoy, nuevoId, tareasInicial, abrirTareas, cerrarTareas, cambiarVista, MAX_NOMBRE_LISTA, MAX_TITULO,
  fechaCorta, subtituloTareas, nombreFilaTareas, chipFilaTareas, cifrasLista, avanceHoy, textoCampoNueva, vacioVista,
  anuncioAgregada, anuncioBorradaLista, tiempoTilde, focoTrasTildar, mezclarLectura, colorDe,
} from '../src/tareas.js'
import { clicBorrar, armadoVigente, desarmarVencido, MS_CONFIRMAR } from '../src/configuracion.js'
import { diaArgentina, DESFASE_AR } from '../src/fechas.js'

const HOY = '2026-11-24'
const t = (id, extra = {}) => ({ id, titulo: id, hecha: false, hechaEn: null, fecha: null, importante: false, notas: '', subtareas: [], creada: 1000, ...extra })
const L = (id, orden, tareas, extra = {}) => ({ v: 1, id, nombre: id.slice(2), color: 'celeste', orden, creada: 1763600000000, tareas, ...extra })
const ids = items => items.map(x => x.tarea.id)

// ------------------------------------------------------------------ 1. el día de Argentina (11.2)

test('1 · hoyArgentina: 23:30 del 24/11 en Argentina sigue siendo el 24; 00:10 del 25 ya es el 25', () => {
  assert.equal(hoyArgentina(Date.parse('2026-11-25T02:30:00Z')), '2026-11-24')
  assert.equal(hoyArgentina(Date.parse('2026-11-25T03:10:00Z')), '2026-11-25')
  // Fin de mes y de año
  assert.equal(hoyArgentina(Date.parse('2027-01-01T02:59:00Z')), '2026-12-31')
})

test('1 · hoyArgentina sale de diaArgentina (fechas.js, el mismo de la configuración): no se duplica el cálculo', () => {
  const ms = Date.parse('2026-11-25T02:30:00Z')
  assert.equal(DESFASE_AR, 3 * 3600000)
  assert.equal(new Date(diaArgentina(ms) * 86400000).toISOString().slice(0, 10), hoyArgentina(ms))
})

test('1 · diasEntre: negativo es vencida, 0 hoy, 1 mañana; cruza meses', () => {
  assert.equal(diasEntre('2026-11-23', HOY), -1)
  assert.equal(diasEntre(HOY, HOY), 0)
  assert.equal(diasEntre('2026-12-01', '2026-11-30'), 1)
  assert.equal(diasEntre('2026-11-20', HOY), -4)
})

// ------------------------------------------------------------------ 2. rótulo de fecha (4.6)

test('2 · etiquetaFecha: una fila por caso de 4.6, y null sin fecha', () => {
  assert.deepEqual(etiquetaFecha('2026-11-23', HOY), { corto: 'ayer', largo: 'Venció ayer', tono: 'error' })
  assert.deepEqual(etiquetaFecha('2026-11-20', HOY), { corto: 'venció 20/11', largo: 'Venció el 20/11', tono: 'error' })
  assert.deepEqual(etiquetaFecha(HOY, HOY), { corto: 'hoy', largo: 'Vence hoy', tono: 'aviso' })
  assert.deepEqual(etiquetaFecha('2026-11-25', HOY), { corto: 'mañana', largo: 'Vence mañana', tono: 'nada' })
  assert.deepEqual(etiquetaFecha('2026-11-26', HOY), { corto: 'jue 26', largo: 'Vence el jue 26/11', tono: 'nada' })
  assert.deepEqual(etiquetaFecha('2026-11-29', HOY), { corto: 'dom 29', largo: 'Vence el dom 29/11', tono: 'nada' })
  assert.equal(etiquetaFecha(null, HOY), null)
})

// ------------------------------------------------------------------ 3. vistas (3.4)

const LISTAS = [
  L('l-trabajo', 0, [
    t('t-hoy-normal', { fecha: HOY, creada: 1 }),
    t('t-hoy-imp', { fecha: HOY, importante: true, creada: 5 }),
    t('t-hoy-hecha', { fecha: HOY, hecha: true, hechaEn: 50 }),
    t('t-venc-20', { fecha: '2026-11-20', creada: 3 }),
    t('t-venc-hecha', { fecha: '2026-11-21', hecha: true, hechaEn: 70 }),
    t('t-manana', { fecha: '2026-11-25', creada: 2 }),
    t('t-sin-fecha-imp', { importante: true, creada: 9 }),
    t('t-sin-fecha', { creada: 4 }),
  ]),
  L('l-casa', 1, [
    t('t-casa-venc-23', { fecha: '2026-11-23', creada: 1 }),
    t('t-casa-venc-20-imp', { fecha: '2026-11-20', importante: true, creada: 8 }),
    t('t-casa-hoy-hecha', { fecha: HOY, hecha: true, hechaEn: 90 }),
    t('t-casa-hoy', { fecha: HOY, creada: 0 }),
  ]),
]

test('3 · vista Hoy: junta todas las listas, importantes primero y después por creada; las tildadas van a hechas', () => {
  const v = vista(LISTAS, 'hoy', HOY)
  assert.deepEqual(ids(v.pendientes), ['t-hoy-imp', 't-casa-hoy', 't-hoy-normal'])
  assert.equal(v.pendientes[1].lista.id, 'l-casa')
  // hechas por hechaEn descendente
  assert.deepEqual(ids(v.hechas), ['t-casa-hoy-hecha', 't-hoy-hecha'])
})

test('3 · vista Vencidas: sin tildar y con fecha < hoy, la más vieja primero; a igual fecha, importantes primero; sin hechas', () => {
  const v = vista(LISTAS, 'vencidas', HOY)
  assert.deepEqual(ids(v.pendientes), ['t-casa-venc-20-imp', 't-venc-20', 't-casa-venc-23'])
  assert.deepEqual(v.hechas, [])
})

test('3 · vista de una lista: importantes, después fecha (sin fecha al final), después creada; hechas por hechaEn descendente', () => {
  const v = vista(LISTAS, 'l-trabajo', HOY)
  assert.deepEqual(ids(v.pendientes), ['t-hoy-imp', 't-sin-fecha-imp', 't-venc-20', 't-hoy-normal', 't-manana', 't-sin-fecha'])
  assert.deepEqual(ids(v.hechas), ['t-venc-hecha', 't-hoy-hecha'])
  assert.equal(vista(LISTAS, 'l-no-existe', HOY), null)
})

test('3 · vista no toca las listas de entrada', () => {
  const antes = JSON.stringify(LISTAS)
  vista(LISTAS, 'l-trabajo', HOY); vista(LISTAS, 'hoy', HOY); vista(LISTAS, 'vencidas', HOY)
  assert.equal(JSON.stringify(LISTAS), antes)
})

// ------------------------------------------------------------------ 4. cuentas (4.1)

test('4 · cuentas: sin tildar; una de ayer tildada no cuenta', () => {
  assert.deepEqual(cuentas(LISTAS, HOY), { hoy: 3, vencidas: 3 })
  assert.deepEqual(cuentas([L('l-a', 0, [t('t-1', { fecha: '2026-11-23', hecha: true, hechaEn: 1 })])], HOY), { hoy: 0, vencidas: 0 })
  assert.deepEqual(cuentas([], HOY), { hoy: 0, vencidas: 0 })
})

test('4 · la fila de la barra: chip ámbar solo con las de hoy, rojo con alguna vencida, la pista sin nada; el nombre sin las partes en 0', () => {
  assert.equal(chipFilaTareas({ hoy: 0, vencidas: 0 }), null)
  assert.deepEqual(chipFilaTareas({ hoy: 2, vencidas: 0 }), { tono: 'hoy', n: 2 })
  assert.deepEqual(chipFilaTareas({ hoy: 2, vencidas: 2 }), { tono: 'venc', n: 4 })
  assert.equal(nombreFilaTareas({ hoy: 2, vencidas: 2 }), 'Tareas, 2 para hoy, 2 vencidas')
  assert.equal(nombreFilaTareas({ hoy: 0, vencidas: 1 }), 'Tareas, 1 vencida')
  assert.equal(nombreFilaTareas({ hoy: 1, vencidas: 0 }), 'Tareas, 1 para hoy')
  assert.equal(nombreFilaTareas({ hoy: 0, vencidas: 0 }), 'Tareas')
})

// ------------------------------------------------------------------ 5. aviso diario (11.4; el globo es de la entrega 3)

test('5 · debeAvisar: mismo día no; día nuevo con 0 no; día nuevo con 1 de hoy o 1 vencida sí', () => {
  assert.equal(debeAvisar({ avisado: HOY, hoy: HOY, cuentas: { hoy: 3, vencidas: 1 } }), false)
  assert.equal(debeAvisar({ avisado: '2026-11-23', hoy: HOY, cuentas: { hoy: 0, vencidas: 0 } }), false)
  assert.equal(debeAvisar({ avisado: '2026-11-23', hoy: HOY, cuentas: { hoy: 1, vencidas: 0 } }), true)
  assert.equal(debeAvisar({ avisado: null, hoy: HOY, cuentas: { hoy: 0, vencidas: 1 } }), true)
})

// ------------------------------------------------------------------ 7. nombre de lista (D-n4)

test('7 · validarNombreLista: vacío, solo espacios y 41 caracteres se rechazan; sin distinguir mayúsculas ni tildes es duplicada; su propio nombre vale', () => {
  const listas = [L('l-casa', 0, [], { nombre: 'Casa' }), L('l-fac', 1, [], { nombre: 'Facturación' })]
  assert.deepEqual(validarNombreLista('', listas), { ok: false, motivo: 'vacio' })
  assert.deepEqual(validarNombreLista('   ', listas), { ok: false, motivo: 'vacio' })
  assert.deepEqual(validarNombreLista('x'.repeat(MAX_NOMBRE_LISTA + 1), listas), { ok: false, motivo: 'largo' })
  assert.deepEqual(validarNombreLista('x'.repeat(MAX_NOMBRE_LISTA), listas), { ok: true, nombre: 'x'.repeat(40) })
  assert.deepEqual(validarNombreLista('casa', listas), { ok: false, motivo: 'duplicada', existente: 'Casa' })
  assert.deepEqual(validarNombreLista(' FACTURACION ', listas), { ok: false, motivo: 'duplicada', existente: 'Facturación' })
  assert.deepEqual(validarNombreLista('Casa', listas, 'l-casa'), { ok: true, nombre: 'Casa' })
  assert.deepEqual(validarNombreLista('  Compras ', listas), { ok: true, nombre: 'Compras' })
  assert.equal(textoErrorLista({ ok: false, motivo: 'duplicada', existente: 'Casa' }), 'Ya hay una lista «Casa».')
  assert.equal(textoErrorLista({ ok: false, motivo: 'vacio' }), null)
})

// ------------------------------------------------------------------ 8. título (lo usa el campo de nueva tarea)

test('8 · validarTitulo: vacío mantiene el anterior (o nada); 201 recorta a 200; sin los espacios de los bordes', () => {
  assert.equal(validarTitulo('   ', 'Antes'), 'Antes')
  assert.equal(validarTitulo('', null), null)
  assert.equal(validarTitulo('x'.repeat(MAX_TITULO + 1)), 'x'.repeat(200))
  assert.equal(validarTitulo('  Pagar la luz  '), 'Pagar la luz')
})

// ------------------------------------------------------------------ 9. Esc por capas (9.1)

test('9 · alEscTareas: una capa por vez, en el orden de 9.1', () => {
  const base = { ...tareasInicial(), abierta: true, det: 't-1', armado: { id: 'lista:l-a', hasta: 9 }, renombrando: 'l-a' }
  // 1. un campo de una línea con algo escrito: lo vacía (nada más cambia)
  let r = alEscTareas(base, { campo: 'nueva', texto: 'algo' })
  assert.equal(r.accion, 'vaciar')
  assert.equal(r.tareas, base)
  // 2. renombrar o crear una lista: cancela
  r = alEscTareas(base, { campo: 'nueva', texto: '' })
  assert.equal(r.accion, 'cancelar-lista')
  assert.equal(r.tareas.renombrando, null)
  assert.equal(alEscTareas({ ...base, renombrando: null, creando: true }, null).tareas.creando, false)
  // 3. un "¿Borrar…? Sí" armado: lo desarma
  r = alEscTareas(r.tareas, null)
  assert.equal(r.accion, 'desarmar')
  assert.equal(r.tareas.armado, null)
  // 4. una tarea abierta: la cierra
  r = alEscTareas(r.tareas, null)
  assert.equal(r.accion, 'cerrar-tarea')
  assert.equal(r.tareas.det, null)
  // 5. la hoja: la cierra
  r = alEscTareas(r.tareas, null)
  assert.equal(r.accion, 'cerrar')
  assert.equal(r.tareas.abierta, false)
  // 6. cerrada, el Esc no es de la hoja (acoplada, pliega el panel)
  r = alEscTareas(r.tareas, null)
  assert.equal(r.accion, null)
})

test('9 · alEscTareas: el campo de renombrar con texto no es la capa 1 (la 2 lo cancela)', () => {
  const r = alEscTareas({ ...tareasInicial(), abierta: true, creando: true }, { campo: 'lista', texto: 'Casa' })
  assert.equal(r.accion, 'cancelar-lista')
})

// ------------------------------------------------------------------ 10. Ctrl T (9.2)

test('10 · esAtajoTareas: Ctrl T sí; Ctrl Shift T, Alt Ctrl T, T solo, Ctrl Y y Ctrl Windows T no', () => {
  assert.equal(esAtajoTareas({ key: 't', ctrlKey: true }), true)
  assert.equal(esAtajoTareas({ key: 'T', ctrlKey: true }), true)
  assert.equal(esAtajoTareas({ key: 'T', ctrlKey: true, shiftKey: true }), false)
  assert.equal(esAtajoTareas({ key: 't', ctrlKey: true, altKey: true }), false)
  assert.equal(esAtajoTareas({ key: 't' }), false)
  assert.equal(esAtajoTareas({ key: 'y', ctrlKey: true }), false)
  assert.equal(esAtajoTareas({ key: 't', ctrlKey: true, metaKey: true }), false)
})

// ------------------------------------------------------------------ 11. color de la lista nueva (6.1)

test('11 · colorSiguiente: rota por los seis, desde el color de la última lista del orden', () => {
  assert.deepEqual(COLORES, ['celeste', 'verde', 'rosa', 'violeta', 'ambar', 'rojo'])
  assert.equal(colorSiguiente([]), 'celeste')
  const vistos = []
  let listas = []
  for (let i = 0; i < 7; i++) {
    const c = colorSiguiente(listas)
    vistos.push(c)
    listas = [...listas, L(`l-${i}`, i, [], { color: c })]
  }
  assert.deepEqual(vistos, ['celeste', 'verde', 'rosa', 'violeta', 'ambar', 'rojo', 'celeste'])
  // Un color que no es de la paleta se lee como celeste (11.1)
  assert.equal(colorSiguiente([L('l-a', 0, [], { color: 'magenta' })]), 'verde')
  assert.equal(colorDe('magenta'), 'celeste')
})

// ------------------------------------------------------------------ 12. confirmar en el mismo botón (4.8), el de la configuración

test('12 · confirmar borrar una lista: arma 3 s, el segundo clic antes ejecuta una vez, a los 3 s se desarma, Esc desarma', () => {
  let st = { ...tareasInicial(), abierta: true }
  const id = 'lista:l-casa'
  let r = clicBorrar(st, id, 1000)
  assert.equal(r.ejecutar, false)
  st = r.config
  assert.equal(armadoVigente(st, id, 1000 + MS_CONFIRMAR - 1), true)
  // Pasados los 3 s, vuelve solo
  assert.equal(desarmarVencido(st, 1000 + MS_CONFIRMAR).armado, null)
  // El segundo clic dentro de la ventana ejecuta una sola vez
  r = clicBorrar(st, id, 2500)
  assert.equal(r.ejecutar, true)
  assert.equal(r.config.armado, null)
  assert.equal(clicBorrar(r.config, id, 2600).ejecutar, false)
  // Esc desarma (capa 3)
  assert.equal(alEscTareas({ ...st }, null).tareas.armado, null)
})

test('12 · textoBorrarLista: con la cuenta, en singular, y vacía', () => {
  assert.equal(textoBorrarLista(6), '¿Borrar con 6 tareas? Sí')
  assert.equal(textoBorrarLista(1), '¿Borrar con 1 tarea? Sí')
  assert.equal(textoBorrarLista(0), '¿Borrar? Sí')
})

// ------------------------------------------------------------------ cambios de cada lista

test('nuevaLista: sin los espacios de los bordes, al final del orden, con el color siguiente y creada en ms', () => {
  const n = nuevaLista(LISTAS, '  Compras ', { id: 'l-compras', ahora: 1764000000000 })
  assert.deepEqual(n, { v: 1, id: 'l-compras', nombre: 'Compras', color: 'verde', orden: 2, creada: 1764000000000, tareas: [] })
  assert.equal(nuevaLista([], 'Primera', { id: 'l-p', ahora: 1 }).orden, 0)
})

test('renombrarLista: otra lista, la de antes queda igual', () => {
  const r = renombrarLista(LISTAS[1], ' Hogar ')
  assert.equal(r.nombre, 'Hogar')
  assert.equal(LISTAS[1].nombre, 'casa')
})

test('agregarTarea: el formato v1 (ms), con la fecha de Hoy si se pide; un título vacío no agrega nada', () => {
  const l = agregarTarea(LISTAS[1], ' Llamar al plomero ', { id: 't-nueva', ahora: 1764000000000, fecha: HOY })
  assert.deepEqual(l.tareas.at(-1), { id: 't-nueva', titulo: 'Llamar al plomero', hecha: false, hechaEn: null, fecha: HOY, importante: false, notas: '', subtareas: [], creada: 1764000000000 })
  assert.equal(LISTAS[1].tareas.length, 4)
  assert.equal(agregarTarea(LISTAS[1], '  ', { id: 't-x', ahora: 1 }), null)
  assert.equal(agregarTarea(LISTAS[1], 'x'.repeat(250), { id: 't-x', ahora: 1 }).tareas.at(-1).titulo.length, 200)
})

test('tildarTarea: anota cuándo (ms); destildar lo borra', () => {
  const l = tildarTarea(LISTAS[1], 't-casa-hoy', true, 1764000000000)
  const x = l.tareas.find(z => z.id === 't-casa-hoy')
  assert.equal(x.hecha, true)
  assert.equal(x.hechaEn, 1764000000000)
  const y = tildarTarea(l, 't-casa-hoy', false, 5).tareas.find(z => z.id === 't-casa-hoy')
  assert.equal(y.hecha, false)
  assert.equal(y.hechaEn, null)
  assert.equal(LISTAS[1].tareas.find(z => z.id === 't-casa-hoy').hecha, false)
})

test('listaParaHoy: "Agregar" en Hoy va a la primera lista del orden; sin listas, ninguna', () => {
  assert.equal(listaParaHoy([LISTAS[1], LISTAS[0]]).id, 'l-trabajo')
  assert.equal(listaParaHoy([]), null)
})

test('nuevoId: el formato de tareas.rs (^[a-z0-9-]{1,40}$ con su prefijo) y nunca uno usado, ni el de un archivo roto', () => {
  const id = nuevoId('l', 1764000000000, () => 0.5)
  assert.match(id, /^l-[a-z0-9-]{1,38}$/)
  assert.ok(id.length <= 40)
  assert.match(nuevoId('t', 1764000000000, () => 0.25), /^t-[a-z0-9]+$/)
  // Si choca con uno usado, prueba con otro azar
  let n = 0
  const azar = () => [0.5, 0.5, 0.9][n++]
  const usado = nuevoId('l', 1764000000000, () => 0.5)
  assert.notEqual(nuevoId('l', 1764000000000, azar, new Set([usado])), usado)
})

// ------------------------------------------------------------------ estado de la hoja (3.5)

test('abrir, cambiar de vista y cerrar: la primera vez en Hoy, después la última vista; "Hechas" vuelve a plegarse', () => {
  let s = tareasInicial()
  assert.equal(s.abierta, false)
  assert.equal(s.ver, 'hoy')
  s = abrirTareas(s)
  assert.equal(s.abierta, true)
  s = { ...cambiarVista(s, 'l-casa'), hechas: true }
  s = cambiarVista(s, 'vencidas')
  assert.equal(s.hechas, false)
  s = cerrarTareas({ ...s, renombrando: 'l-a', creando: true, armado: { id: 'x', hasta: 1 }, det: 't-1' })
  assert.deepEqual([s.abierta, s.renombrando, s.creando, s.armado, s.det, s.ver], [false, null, false, null, null, 'vencidas'])
  assert.equal(abrirTareas(s).ver, 'vencidas')
  assert.equal(abrirTareas(s, 'hoy').ver, 'hoy')
})

test('mezclarLectura: lo leído reemplaza, salvo las listas que no se pudieron guardar (siguen como en pantalla)', () => {
  const enPantalla = [L('l-a', 0, [t('t-local')]), L('l-nueva', 1, [])]
  const leidas = [L('l-a', 0, [t('t-disco')]), L('l-b', 1, [])]
  assert.deepEqual(mezclarLectura(leidas, enPantalla, new Set()).map(l => l.id), ['l-a', 'l-b'])
  const m = mezclarLectura(leidas, enPantalla, new Set(['l-a', 'l-nueva']))
  assert.deepEqual(m.map(l => l.id), ['l-a', 'l-b', 'l-nueva'])
  assert.equal(m[0].tareas[0].id, 't-local')
})

// ------------------------------------------------------------------ textos (5)

test('textos de la hoja: fecha corta, bajada, avance de Hoy, cifras de una lista y el campo de nueva tarea', () => {
  assert.equal(fechaCorta(HOY), 'martes 24/11')
  assert.equal(subtituloTareas({ hoy: 2, vencidas: 2 }, HOY, true), 'martes 24/11 · 2 para hoy · 2 vencidas')
  assert.equal(subtituloTareas({ hoy: 0, vencidas: 1 }, HOY, true), 'martes 24/11 · 1 vencida')
  assert.equal(subtituloTareas({ hoy: 0, vencidas: 0 }, HOY, true), 'martes 24/11 · nada urgente')
  assert.equal(subtituloTareas({ hoy: 0, vencidas: 0 }, HOY, false), 'Se guardan en esta PC')
  assert.deepEqual(avanceHoy(LISTAS, HOY), { hechas: 2, total: 5 })
  assert.equal(cifrasLista(LISTAS[1]), '3 pendientes · 1 hecha')
  assert.equal(cifrasLista(L('l-x', 0, [t('t-1')])), '1 pendiente · 0 hechas')
  assert.equal(textoCampoNueva('hoy', LISTAS), 'Agregar para hoy en trabajo…')
  assert.equal(textoCampoNueva('l-casa', LISTAS), 'Agregar a casa…')
  assert.equal(textoCampoNueva('vencidas', LISTAS), null)
})

test('vacíos (5.2): Hoy con lo de mañana, Vencidas y una lista vacía', () => {
  assert.deepEqual(vacioVista('hoy', LISTAS, HOY), { pose: 'feliz', titulo: 'Listo por hoy.', linea: 'No queda nada con fecha de hoy. Mañana: 1 tarea.' })
  assert.deepEqual(vacioVista('hoy', [], HOY), { pose: 'feliz', titulo: 'Listo por hoy.', linea: 'No queda nada con fecha de hoy.' })
  assert.deepEqual(vacioVista('vencidas', LISTAS, HOY), { pose: 'feliz', titulo: 'Nada vencido.', linea: 'Estás al día.' })
  assert.deepEqual(vacioVista('l-casa', LISTAS, HOY), { pose: 'esperando', titulo: '«casa» está vacía.', linea: 'Escribí arriba y Enter para sumar la primera.' })
})

test('anuncios (5.3): agregada y lista borrada', () => {
  assert.equal(anuncioAgregada('Trabajo', false), 'Agregada a Trabajo')
  assert.equal(anuncioAgregada('Trabajo', true), 'Agregada a Trabajo, para hoy')
  assert.equal(anuncioBorradaLista('Casa', 6), 'Borraste «Casa» y sus 6 tareas')
  assert.equal(anuncioBorradaLista('Casa', 1), 'Borraste «Casa» y su tarea')
  assert.equal(anuncioBorradaLista('Casa', 0), 'Borraste «Casa»')
})

// ------------------------------------------------------------------ el acto del tilde (10)

test('tiempoTilde: 700 ms y pliegue con movimiento; 350 ms sin pliegue con movimiento reducido o pausa', () => {
  assert.deepEqual(tiempoTilde('completo'), { espera: 700, pliega: true })
  assert.deepEqual(tiempoTilde('fundido'), { espera: 350, pliega: false })
  assert.deepEqual(tiempoTilde('nada'), { espera: 350, pliega: false })
})

test('focoTrasTildar (9.4): el tilde de la fila siguiente; si no hay, la anterior; si no, el campo de nueva tarea', () => {
  assert.equal(focoTrasTildar(['a', 'b', 'c'], 'b'), 'ck-c')
  assert.equal(focoTrasTildar(['a', 'b', 'c'], 'c'), 'ck-b')
  assert.equal(focoTrasTildar(['a'], 'a'), 'nueva')
})
