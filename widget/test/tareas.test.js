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
  buscarTarea, editarTarea, agregarSubtarea, tildarSubtarea, editarSubtarea, borrarTarea, moverTarea, listaParaGuardar,
  nuevaMudanza, soltarMudanzas, olvidarMudanzas, opcionFecha, fechaDeOpcion, creadaEl, abrirDetalle, cerrarDetalle,
  diferirGuardado, ESPERA_GUARDAR_MS, rebasarLista, MAX_NOTAS, MAX_SUBTAREAS, textoSubtareas,
  AVISO_INICIAL, evaluarAviso, verAviso, soltarAviso, lugarAviso, textoGlobo, plano, horaGlobo, anuncioGlobo,
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

/// ------------------------------------------------------------------ 5 y 6. el aviso diario (8, 11.4 y 5.4)

test('5 · evaluarAviso: una sola vez, después del primer tareas_leer; el día de hoy y sin ver', () => {
  const c1 = { hoy: 1, vencidas: 0 }
  let a = evaluarAviso(AVISO_INICIAL, { avisado: '2026-11-23', hoy: HOY, cuentas: c1 })
  assert.deepEqual(a, { evaluado: true, pendiente: true, dia: HOY, visto: false })
  // Una segunda lectura (abrir la hoja, "Volver a leer") no lo vuelve a evaluar
  assert.equal(evaluarAviso(a, { avisado: '2026-11-23', hoy: HOY, cuentas: { hoy: 0, vencidas: 0 } }), a)
  // El mismo día ya avisado: no sale, y tampoco más tarde en esta ejecución
  a = evaluarAviso(AVISO_INICIAL, { avisado: HOY, hoy: HOY, cuentas: c1 })
  assert.equal(a.pendiente, false)
  assert.equal(evaluarAviso(a, { avisado: null, hoy: '2026-11-25', cuentas: c1 }), a)
  // Día nuevo sin nada de hoy ni vencido: no sale
  assert.equal(evaluarAviso(AVISO_INICIAL, { avisado: null, hoy: HOY, cuentas: { hoy: 0, vencidas: 0 } }).pendiente, false)
  assert.equal(evaluarAviso(AVISO_INICIAL, { avisado: null, hoy: HOY, cuentas: { hoy: 0, vencidas: 1 } }).pendiente, true)
})

test('5 · verAviso: la primera vez que se ve devuelve el día para tareas.avisado; después, nada', () => {
  const a = evaluarAviso(AVISO_INICIAL, { avisado: null, hoy: HOY, cuentas: { hoy: 2, vencidas: 0 } })
  const r1 = verAviso(a)
  assert.equal(r1.guardar, HOY)
  assert.equal(r1.aviso.visto, true)
  assert.equal(r1.aviso.pendiente, true)
  const r2 = verAviso(r1.aviso)
  assert.equal(r2.guardar, null)
  assert.equal(r2.aviso, r1.aviso)
  // Sin aviso pendiente no se guarda nada
  assert.equal(verAviso(AVISO_INICIAL).guardar, null)
  assert.equal(verAviso(soltarAviso(a)).guardar, null)
})

test('5 · soltarAviso: el clic, la × o abrir la hoja lo sacan; no vuelve en esta ejecución', () => {
  const a = verAviso(evaluarAviso(AVISO_INICIAL, { avisado: null, hoy: HOY, cuentas: { hoy: 1, vencidas: 1 } })).aviso
  const s = soltarAviso(a)
  assert.equal(s.pendiente, false)
  assert.equal(s.visto, true)
  assert.equal(soltarAviso(s), s)
  assert.equal(evaluarAviso(s, { avisado: null, hoy: HOY, cuentas: { hoy: 1, vencidas: 1 } }), s)
})

test('5 · lugarAviso (8.2): marca, dividida o muesca; espera en la tira, la bandeja y con la charla; nunca con la hoja', () => {
  const a = { evaluado: true, pendiente: true, dia: HOY, visto: false }
  const C = { hoy: 1, vencidas: 0 }
  const f = (extra = {}) => ({ cuentas: C, barra: true, ...extra })
  assert.equal(lugarAviso(a, f()), 'marca')
  assert.equal(lugarAviso(a, f({ acoplada: true, abierta: true })), 'marca')
  assert.equal(lugarAviso(a, f({ dividida: true })), 'dividida')
  assert.equal(lugarAviso(a, f({ acoplada: true, abierta: false })), 'muesca')
  // La pregunta pendiente tapa el globo en los tres lugares (vuelve cuando se va). Antes solo tapaba el
  // de la muesca; desde H2 tapa también el de la marca y el de la dividida: es la decisión D-m4 de
  // modulos-ux.md, cerrada con D-h5 de habitos-ux.md (pregunta › recordatorio › tareas › resumen)
  assert.equal(lugarAviso(a, f({ acoplada: true, abierta: false, pregunta: true })), null)
  assert.equal(lugarAviso(a, f({ pregunta: true })), null)
  assert.equal(lugarAviso(a, f({ acoplada: true, abierta: true, pregunta: true })), null)
  assert.equal(lugarAviso(a, f({ dividida: true, pregunta: true })), null)
  // Espera: tira, bandeja o escondida, la charla abierta, arrastrando, sin barra (vacío o primeros pasos)
  for (const espera of [{ mini: true }, { fuera: true }, { chat: true }, { arrastrando: true }, { barra: false }]) {
    assert.equal(lugarAviso(a, f(espera)), null, JSON.stringify(espera))
  }
  assert.equal(lugarAviso(a, f({ acoplada: true, abierta: false, barra: false })), 'muesca')
  // La hoja de Tareas abierta, sin aviso o sin nada que contar: nada
  assert.equal(lugarAviso(a, f({ hoja: true })), null)
  assert.equal(lugarAviso({ ...a, pendiente: false }, f()), null)
  assert.equal(lugarAviso(a, f({ cuentas: { hoy: 0, vencidas: 0 } })), null)
  assert.equal(lugarAviso(AVISO_INICIAL, f()), null)
})

test('6 · textoGlobo: los tres casos de 5.4 en el globo, la muesca y la fila', () => {
  const t = textoGlobo({ hoy: 2, vencidas: 2 }, '09:30')
  assert.equal(plano(t.globo), '¡Buen día! Tenés 2 tareas para hoy y 2 vencidas.')
  assert.equal(plano(t.muesca), '2 para hoy · 2 vencidas')
  assert.equal(plano(t.fila), '¡Buen día! 2 para hoy y 2 vencidas.')
  assert.equal(t.texto, '¡Buen día! Tenés 2 tareas para hoy y 2 vencidas.')
  // Los números del globo en negrita; las vencidas, en rojo (globo, muesca y fila)
  assert.deepEqual(t.globo.filter(s => s.fuerte).map(s => s.t), ['2 tareas para hoy', '2 vencidas'])
  for (const segs of [t.globo, t.muesca, t.fila]) assert.deepEqual(segs.filter(s => s.venc).map(s => s.t), ['2 vencidas'])
  const h = textoGlobo({ hoy: 3, vencidas: 0 }, '09:30')
  assert.equal(plano(h.globo), '¡Buen día! Tenés 3 tareas para hoy.')
  assert.equal(plano(h.muesca), '3 para hoy')
  assert.equal(plano(h.fila), '¡Buen día! 3 para hoy.')
  const v = textoGlobo({ hoy: 0, vencidas: 4 }, '09:30')
  assert.equal(plano(v.globo), '¡Buen día! Tenés 4 vencidas.')
  assert.equal(plano(v.muesca), '4 vencidas')
  assert.equal(plano(v.fila), '¡Buen día! 4 vencidas.')
  assert.equal(textoGlobo({ hoy: 0, vencidas: 0 }, '09:30'), null)
})

test('6 · textoGlobo: singulares «1 tarea» y «1 vencida»', () => {
  const t = textoGlobo({ hoy: 1, vencidas: 1 }, '09:30')
  assert.equal(plano(t.globo), '¡Buen día! Tenés 1 tarea para hoy y 1 vencida.')
  assert.equal(plano(t.muesca), '1 para hoy · 1 vencida')
  assert.equal(plano(t.fila), '¡Buen día! 1 para hoy y 1 vencida.')
  assert.equal(plano(textoGlobo({ hoy: 0, vencidas: 1 }, '09:30').globo), '¡Buen día! Tenés 1 vencida.')
})

test('6 · textoGlobo: el saludo con la hora de Argentina (D-n1): 12:59 día, 13:00 tarde, 20:00 noche', () => {
  const c = { hoy: 1, vencidas: 0 }
  assert.equal(textoGlobo(c, '12:59').saludo, '¡Buen día!')
  assert.equal(textoGlobo(c, '13:00').saludo, '¡Buenas tardes!')
  assert.equal(textoGlobo(c, '19:59').saludo, '¡Buenas tardes!')
  assert.equal(textoGlobo(c, '20:00').saludo, '¡Buenas noches!')
  assert.equal(textoGlobo(c, '00:10').saludo, '¡Buen día!')
  assert.equal(plano(textoGlobo(c, '20:00').fila), '¡Buenas noches! 1 para hoy.')
  // Desde un instante: la hora de Argentina, no la de la PC (12:59 en Argentina son las 15:59 UTC)
  const ms = Date.UTC(2026, 10, 24, 15, 59)
  assert.equal(horaGlobo(ms), '12:59')
  assert.equal(horaGlobo(ms + 60000), '13:00')
  assert.equal(textoGlobo(c, horaGlobo(Date.UTC(2026, 10, 24, 23, 0))).saludo, '¡Buenas noches!')
})

test('6 · anuncioGlobo: «{nombre de la mascota}: {texto del globo}»', () => {
  assert.equal(anuncioGlobo('Avi', textoGlobo({ hoy: 2, vencidas: 1 }, '15:00')), 'Avi: ¡Buenas tardes! Tenés 2 tareas para hoy y 1 vencida.')
})

test('9 · alEscTareas: con la hoja cerrada y el foco en el globo, Esc es la × (9.1)', () => {
  const t = tareasInicial()
  assert.deepEqual(alEscTareas(t, { globo: true }), { tareas: t, accion: 'globo-x' })
  // Fuera del globo, sigue sin ser de la hoja
  assert.equal(alEscTareas(t, null).accion, null)
  // Con la hoja abierta, el globo no se ve: las capas de siempre
  assert.equal(alEscTareas({ ...t, abierta: true }, { globo: true }).accion, 'cerrar')
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

// ------------------------------------------------------------------ entrega 2: la tarea abierta (4.7)

test('8 · validarTitulo: un salto de línea pegado queda como un espacio (el título es de una línea)', () => {
  assert.equal(validarTitulo('Pagar\nla luz'), 'Pagar la luz')
  assert.equal(validarTitulo(' \n ', 'Antes'), 'Antes')
})

test('buscarTarea: la lista y la tarea de un id, en cualquier lista; uno que no existe, null', () => {
  const listas = [L('l-a', 0, [t('t-1')]), L('l-b', 1, [t('t-2')])]
  const r = buscarTarea(listas, 't-2')
  assert.equal(r.lista.id, 'l-b')
  assert.equal(r.tarea.id, 't-2')
  assert.equal(buscarTarea(listas, 't-9'), null)
})

test('editarTarea: título (vacío mantiene el anterior, 201 recorta), notas (hasta 4000), fecha (solo AAAA-MM-DD o null) e importante; la de antes queda igual', () => {
  const lista = L('l-a', 0, [t('t-1', { titulo: 'Antes' }), t('t-2')])
  let r = editarTarea(lista, 't-1', { titulo: '  ' })
  assert.equal(r.tareas[0].titulo, 'Antes')
  r = editarTarea(lista, 't-1', { titulo: 'x'.repeat(201) })
  assert.equal(r.tareas[0].titulo, 'x'.repeat(200))
  r = editarTarea(lista, 't-1', { notas: 'n'.repeat(MAX_NOTAS + 5) })
  assert.equal(r.tareas[0].notas.length, MAX_NOTAS)
  r = editarTarea(lista, 't-1', { fecha: '2026-11-26', importante: true })
  assert.deepEqual([r.tareas[0].fecha, r.tareas[0].importante], ['2026-11-26', true])
  assert.equal(editarTarea(lista, 't-1', { fecha: '26/11' }).tareas[0].fecha, null)
  assert.equal(editarTarea(lista, 't-1', { fecha: null }).tareas[0].fecha, null)
  assert.equal(lista.tareas[0].titulo, 'Antes')
  assert.equal(r.tareas[1], lista.tareas[1])
})

test('subtareas: agregar (vacío no, hasta 50), tildar y editar; vaciar su texto la borra (D-n2)', () => {
  const lista = L('l-a', 0, [t('t-1')])
  assert.equal(agregarSubtarea(lista, 't-1', '   ', 's-1'), null)
  let r = agregarSubtarea(lista, 't-1', '  Probar con Haiku  ', 's-1')
  assert.deepEqual(r.tareas[0].subtareas, [{ id: 's-1', titulo: 'Probar con Haiku', hecha: false }])
  r = tildarSubtarea(r, 't-1', 's-1', true)
  assert.equal(r.tareas[0].subtareas[0].hecha, true)
  r = editarSubtarea(r, 't-1', 's-1', 'Probar con Sonnet')
  assert.deepEqual(r.tareas[0].subtareas[0], { id: 's-1', titulo: 'Probar con Sonnet', hecha: true })
  assert.deepEqual(editarSubtarea(r, 't-1', 's-1', '  ').tareas[0].subtareas, [])
  const llena = L('l-a', 0, [t('t-1', { subtareas: Array.from({ length: MAX_SUBTAREAS }, (_, i) => ({ id: `s-${i}`, titulo: 'x', hecha: false })) })])
  assert.equal(agregarSubtarea(llena, 't-1', 'una más', 's-z'), null)
  assert.deepEqual(lista.tareas[0].subtareas, [])
})

test('textoSubtareas: «Subtareas · {h} de {n}»; sin subtareas, solo «Subtareas»', () => {
  assert.equal(textoSubtareas([{ hecha: true }, { hecha: false }, { hecha: false }]), 'Subtareas · 1 de 3')
  assert.equal(textoSubtareas([]), 'Subtareas')
})

test('borrarTarea: la saca de su lista; las demás quedan', () => {
  const lista = L('l-a', 0, [t('t-1'), t('t-2')])
  assert.deepEqual(borrarTarea(lista, 't-1').tareas.map(x => x.id), ['t-2'])
  assert.equal(lista.tareas.length, 2)
})

test('moverTarea: deja una sola copia, al final de la lista de destino, igual que estaba; a la misma lista o a una que no existe, null', () => {
  const listas = [L('l-a', 0, [t('t-1', { notas: 'n', importante: true }), t('t-2')]), L('l-b', 1, [t('t-3')])]
  const r = moverTarea(listas, 't-1', 'l-b')
  assert.equal(r.origen, 'l-a')
  assert.equal(r.destino, 'l-b')
  const copias = r.listas.flatMap(l => l.tareas).filter(x => x.id === 't-1')
  assert.equal(copias.length, 1)
  assert.deepEqual(r.listas[1].tareas.map(x => x.id), ['t-3', 't-1'])
  assert.deepEqual(copias[0], listas[0].tareas[0])
  assert.equal(moverTarea(listas, 't-1', 'l-a'), null)
  assert.equal(moverTarea(listas, 't-1', 'l-x'), null)
  assert.equal(moverTarea(listas, 't-9', 'l-b'), null)
  assert.equal(listas[0].tareas.length, 2)
})

test('mover (11.3): la de origen se guarda con la tarea hasta que un guardado de destino posterior al cambio salió bien; nunca queda en ningún archivo', () => {
  const antes = [L('l-a', 0, [t('t-1'), t('t-2')]), L('l-b', 1, [])]
  const { listas, origen, destino } = moverTarea(antes, 't-1', 'l-b')
  // El destino iba por su guardado 3 cuando se movió
  let m = nuevaMudanza([], { tarea: 't-1', origen, destino, desde: 3 })
  // Mientras tanto, guardar el origen lleva la tarea (duplicada, nunca perdida)
  assert.deepEqual(listaParaGuardar(listas, 'l-a', m).tareas.map(x => x.id), ['t-2', 't-1'])
  // El destino se guarda como está en pantalla (ya la tiene)
  assert.deepEqual(listaParaGuardar(listas, 'l-b', m).tareas.map(x => x.id), ['t-1'])
  // El guardado 3 (empezó antes de mover) no la suelta; el 4 sí, y pide guardar el origen
  let r = soltarMudanzas(m, 'l-b', 3)
  assert.equal(r.mudanzas.length, 1)
  assert.deepEqual(r.origenes, [])
  r = soltarMudanzas(m, 'l-b', 4)
  assert.deepEqual(r.mudanzas, [])
  assert.deepEqual(r.origenes, ['l-a'])
  m = r.mudanzas
  assert.deepEqual(listaParaGuardar(listas, 'l-a', m).tareas.map(x => x.id), ['t-2'])
  // Un guardado de otra lista no suelta nada
  m = nuevaMudanza([], { tarea: 't-1', origen, destino, desde: 0 })
  assert.equal(soltarMudanzas(m, 'l-a', 9).mudanzas.length, 1)
})

test('mover y volver (A → B → A) no se traba ni duplica en pantalla: cada lista se guarda con lo que tiene', () => {
  const ida = moverTarea([L('l-a', 0, [t('t-1')]), L('l-b', 1, [])], 't-1', 'l-b')
  let m = nuevaMudanza([], { tarea: 't-1', origen: 'l-a', destino: 'l-b', desde: 0 })
  const vuelta = moverTarea(ida.listas, 't-1', 'l-a')
  m = nuevaMudanza(m, { tarea: 't-1', origen: 'l-b', destino: 'l-a', desde: 0 })
  assert.deepEqual(listaParaGuardar(vuelta.listas, 'l-a', m).tareas.map(x => x.id), ['t-1'])
  assert.deepEqual(listaParaGuardar(vuelta.listas, 'l-b', m).tareas.map(x => x.id), ['t-1'])
  m = soltarMudanzas(m, 'l-a', 1).mudanzas
  assert.deepEqual(listaParaGuardar(vuelta.listas, 'l-b', m).tareas.map(x => x.id), [])
})

test('olvidarMudanzas: borrar la tarea movida suelta sus mudanzas y pide guardar sus orígenes', () => {
  const m = nuevaMudanza(nuevaMudanza([], { tarea: 't-1', origen: 'l-a', destino: 'l-b', desde: 0 }), { tarea: 't-2', origen: 'l-c', destino: 'l-b', desde: 0 })
  const r = olvidarMudanzas(m, 't-1')
  assert.deepEqual(r.mudanzas.map(x => x.tarea), ['t-2'])
  assert.deepEqual(r.origenes, ['l-a'])
})

test('Vence (4.7): Hoy, Mañana y Sin fecha; otra fecha no elige ninguna', () => {
  assert.equal(opcionFecha(HOY, HOY), 'hoy')
  assert.equal(opcionFecha('2026-11-25', HOY), 'manana')
  assert.equal(opcionFecha(null, HOY), 'sin')
  assert.equal(opcionFecha('2026-11-30', HOY), null)
  assert.equal(fechaDeOpcion('hoy', HOY), HOY)
  assert.equal(fechaDeOpcion('manana', '2026-11-30'), '2026-12-01')
  assert.equal(fechaDeOpcion('sin', HOY), null)
})

test('creadaEl: «Creada el {d/m}» en el día de Argentina', () => {
  // 01:00 UTC del 25 es el 24 a las 22:00 en Argentina
  assert.equal(creadaEl(Date.parse('2026-11-25T01:00:00Z')), 'Creada el 24/11')
  assert.equal(creadaEl(Date.parse('2026-12-03T15:00:00Z')), 'Creada el 3/12')
})

test('abrir y cerrar la tarea: desarma y deja de editar una subtarea; la vista y "Hechas" quedan', () => {
  const s = { ...tareasInicial(), abierta: true, ver: 'l-a', hechas: true, armado: { id: 'lista:l-a', hasta: 1 } }
  const a = abrirDetalle(s, 't-1')
  assert.deepEqual([a.det, a.armado, a.ver, a.hechas], ['t-1', null, 'l-a', true])
  const c = cerrarDetalle({ ...a, editandoSub: 's-1', armado: { id: 'tarea:t-1', hasta: 1 } })
  assert.deepEqual([c.det, c.armado, c.editandoSub, c.ver, c.hechas], [null, null, null, 'l-a', true])
  // Cambiar de vista y cerrar la hoja también dejan de editar
  assert.equal(cambiarVista({ ...a, editandoSub: 's-1' }, 'hoy').editandoSub, null)
  assert.equal(cerrarTareas({ ...a, editandoSub: 's-1' }).editandoSub, null)
})

test('9 · alEscTareas: el texto de una subtarea que se edita se cancela (capa 2), antes del borrado armado y de cerrar la tarea', () => {
  const base = { ...tareasInicial(), abierta: true, det: 't-1', editandoSub: 's-1', armado: { id: 'tarea:t-1', hasta: 9 } }
  let r = alEscTareas(base, { campo: 'sub-ed', texto: 'algo' })
  assert.equal(r.accion, 'cancelar-sub')
  assert.equal(r.tareas.editandoSub, null)
  r = alEscTareas(r.tareas, null)
  assert.equal(r.accion, 'desarmar')
  r = alEscTareas(r.tareas, { campo: 'titulo', texto: 'Algo' })
  assert.equal(r.accion, 'cerrar-tarea')
  // La subtarea nueva con texto es la capa 1, como la tarea nueva
  assert.equal(alEscTareas(base, { campo: 'subtarea', texto: 'x' }).accion, 'vaciar')
})

test('12 · confirmar borrar una tarea: el mismo mecanismo que la lista (arma 3 s, el segundo clic ejecuta una vez)', () => {
  const s0 = { ...tareasInicial(), abierta: true, det: 't-1' }
  let r = clicBorrar(s0, 'tarea:t-1', 1000)
  assert.equal(r.ejecutar, false)
  assert.equal(armadoVigente(r.config, 'tarea:t-1', 1000 + MS_CONFIRMAR - 1), true)
  r = clicBorrar(r.config, 'tarea:t-1', 2000)
  assert.equal(r.ejecutar, true)
  assert.equal(desarmarVencido(clicBorrar(s0, 'tarea:t-1', 0).config, MS_CONFIRMAR + 1).armado, null)
})

test('diferirGuardado: título y notas se guardan 600 ms después de dejar de escribir (una vez) y al salir del campo, al instante', ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] })
  const guardadas = []
  const d = diferirGuardado(id => guardadas.push(id))
  assert.equal(ESPERA_GUARDAR_MS, 600)
  d.programar('l-a')
  ctx.mock.timers.tick(400)
  d.programar('l-a')
  ctx.mock.timers.tick(599)
  assert.deepEqual(guardadas, [])
  ctx.mock.timers.tick(1)
  assert.deepEqual(guardadas, ['l-a'])
  // Al salir del campo: al instante, y el pendiente no se repite
  d.programar('l-b')
  d.ya('l-b')
  assert.deepEqual(guardadas, ['l-a', 'l-b'])
  ctx.mock.timers.tick(1000)
  assert.deepEqual(guardadas, ['l-a', 'l-b'])
  // Sin nada pendiente, salir no guarda; `todos` guarda lo pendiente de cada lista
  d.ya('l-c')
  d.programar('l-c')
  d.programar('l-d')
  d.todos()
  assert.deepEqual(guardadas, ['l-a', 'l-b', 'l-c', 'l-d'])
})

test('guardar sin mudanzas (entrega 1 igual): se manda la lista de la pantalla tal cual; una que no existe, null', () => {
  const listas = [L('l-a', 0, [t('t-1')]), L('l-b', 1, [])]
  assert.equal(listaParaGuardar(listas, 'l-a', []), listas[0])
  assert.equal(listaParaGuardar(listas, 'l-x', []), null)
})

// ------------------------------------------------------------------ #43: dos escritores (chat-herramientas-ux.md 11.5)

const tareaR = (id, titulo, extra = {}) => ({ id, titulo, hecha: false, hechaEn: null, fecha: null, importante: false, notas: '', subtareas: [], creada: 1, ...extra })
const listaR = (tareas, extra = {}) => ({ v: 1, id: 'l-casa', nombre: 'Casa', color: 'verde', orden: 0, creada: 1, tareas, ...extra })

test('rebasarLista: sin cambios en la ventana, queda lo del disco (lo que hizo la charla)', () => {
  const base = listaR([tareaR('t-a', 'A')])
  const disco = listaR([tareaR('t-a', 'A'), tareaR('t-b', 'Pan')])
  assert.deepEqual(rebasarLista(base, base, disco), disco)
})

test('rebasarLista: vuelve a aplicar lo de la ventana sobre lo de la charla', () => {
  const base = listaR([tareaR('t-a', 'A'), tareaR('t-c', 'C')])
  // La ventana tildó A, sacó C y agregó D; la charla agregó B y cambió la fecha de C
  const pantalla = listaR([tareaR('t-a', 'A', { hecha: true, hechaEn: 5 }), tareaR('t-d', 'D')])
  const disco = listaR([tareaR('t-a', 'A'), tareaR('t-c', 'C', { fecha: '2026-11-26' }), tareaR('t-b', 'Pan')])
  const r = rebasarLista(base, pantalla, disco)
  assert.deepEqual(r.tareas.map(t => t.id), ['t-a', 't-b', 't-d'])
  assert.equal(r.tareas[0].hecha, true)
  // La misma tarea cambiada por las dos: gana la ventana (es lo que se estaba guardando)
  const ambas = rebasarLista(base, listaR([tareaR('t-a', 'A1'), tareaR('t-c', 'C')]), listaR([tareaR('t-a', 'A2'), tareaR('t-c', 'C')]))
  assert.equal(ambas.tareas[0].titulo, 'A1')
  // El nombre de la lista cambiado en la ventana queda; lo demás del disco también
  const renombrada = rebasarLista(base, { ...base, nombre: 'Hogar' }, disco)
  assert.equal(renombrada.nombre, 'Hogar')
  assert.equal(renombrada.tareas.length, 3)
})

test('rebasarLista: sin base o sin disco, lo de la pantalla (como antes)', () => {
  const pantalla = listaR([tareaR('t-a', 'A')])
  assert.equal(rebasarLista(null, pantalla, listaR([])), pantalla)
  assert.equal(rebasarLista(pantalla, pantalla, null), pantalla)
})

// Lo que devuelve Rust (serde_json sin `preserve_order`): las claves en orden alfabético, en todos los niveles
const comoRust = v => (Array.isArray(v) ? v.map(comoRust)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, comoRust(v[k])])) : v)

test('rebasarLista: una tarea creada en la ventana y tildada por la charla queda tildada (el orden de las claves no cuenta)', () => {
  // 1) La ventana agrega "Comprar pan" y se guarda: la base es lo que devolvió Rust
  const pantalla = agregarTarea(listaR([]), 'Comprar pan', { id: 't-pan', ahora: 100 })
  const base = comoRust(pantalla)
  // 2) La charla la tilda (tarea_tildar)
  const disco = comoRust({ ...base, tareas: base.tareas.map(t => ({ ...t, hecha: true, hechaEn: 200 })) })
  // 3) Llega oficina://tareas: lo que se ve y lo que se guardará después es lo de la charla
  const r = rebasarLista(base, pantalla, disco)
  assert.equal(r.tareas[0].hecha, true)
  assert.equal(r.tareas[0].hechaEn, 200)
})

test('rebasarLista: una subtarea agregada en la ventana no deshace lo que la charla editó en esa tarea', () => {
  const leida = comoRust(listaR([tareaR('t-a', 'A')]))
  // La ventana agrega una subtarea ({ id, titulo, hecha }) y se guarda: base = lo de Rust
  const pantalla = { ...leida, tareas: [{ ...leida.tareas[0], subtareas: [{ id: 's-1', titulo: 'Harina', hecha: false }] }] }
  const base = comoRust(pantalla)
  // La charla le cambia la fecha, el título y la marca de importante (tarea_editar)
  const disco = comoRust({ ...base, tareas: [{ ...base.tareas[0], fecha: '2026-11-26', titulo: 'A2', importante: true }] })
  const r = rebasarLista(base, pantalla, disco)
  assert.equal(r.tareas[0].fecha, '2026-11-26')
  assert.equal(r.tareas[0].titulo, 'A2')
  assert.equal(r.tareas[0].importante, true)
  assert.deepEqual(r.tareas[0].subtareas, [{ hecha: false, id: 's-1', titulo: 'Harina' }])
  // El nombre que cambió la charla también queda (la ventana no lo tocó)
  assert.equal(rebasarLista(base, pantalla, comoRust({ ...disco, nombre: 'Hogar' })).nombre, 'Hogar')
})

// ---------------------------------------------------------------- dos escritores: la base de lo leído (11.5)

test('leerTareas (main.js) no pone al día la base de una lista que no se pisa con lo leído (falló, se guarda o es origen de una mudanza)', async () => {
  const { readFileSync } = await import('node:fs')
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const leer = main.slice(main.indexOf('function leerTareas('), main.indexOf('function anotarBaseTareas('))
  // Si no, el reintento de 5 s de un guardado fallido saldría con la huella nueva y pisaría un cambio de la charla
  assert.match(leer, /const sinGuardar = listasSinGuardar\(\)/)
  assert.match(leer, /for \(const l of listas\) if \(!sinGuardar\.has\(l\.id\)\) anotarBaseTareas\(l, r\?\.huellas\?\.\[l\.id\]\)/)
  assert.match(leer, /mezclarLectura\(listas, st\.tareas\.listas, sinGuardar\)/)
})
