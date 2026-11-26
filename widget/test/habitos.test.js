// Tests de habitos.js (#41, docs/diseno/habitos-ux.md 11.3, 11.4 y 11.6, entrega H1): los cuatro tipos,
// la racha, las celdas de la semana, el porcentaje, cambiar de tipo, el formulario, Esc por capas, Ctrl H
// y los textos de la sección 5. Puros: se prueban en node, por la interfaz pública.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toca, hecho, deHoy, racha, mejorRacha, estadoCelda, textoCelda, pctSemana, cambiarTipo, validarHabito, fraseFormulario,
  alEscHabitos, esAtajoHabitos, cuentasHoy, nombreFilaHabitos, subtituloHabitos, resumenHoy, rotuloTipo, textoRacha, nivelRacha,
  unidadSingular, listaDias, nombreSumador, marcar, sumar, corregible, corregir, conMejor, hitoNuevo, textoHito, nuevoHabito,
  borradorNuevo, desdeSugerida, SUGERIDAS, textoBorrar, mananaHabitos, ultimasSemanas, rangoSemana, cabeceraSemana, editar,
  habitosInicial, abrirHabitos, cerrarHabitos, verHabitos, empezarNuevo, abrirHabito, cerrarHabito, ordenarHabitos,
  anuncioTilde, anuncioSuma, anuncioDiaCompleto, anuncioCorregido, anuncioCreado, anuncioBorrado, textoRachaGrande, desdeEl,
  recordatoriosDebidos, recordar, recordatorioVigente, textosGlobo, textoHechoGlobo,
  resumenDebido, resumenSemana, altoBarra, plantillaResumen, fraseValida, fraseCorta, textosResumen, tituloSemana, mensajeSemana,
  datosFrase, resumenGuardadoValido, fraseGuardadaValida, fraseGuardada,
} from '../src/habitos.js'
import { plano } from '../src/tareas.js'

// Hoy: jueves 26/11/2026; la semana va del lunes 23 al domingo 29
const HOY = '2026-11-26'
const dia = n => { const d = new Date(Date.UTC(2026, 10, 26 + n)); return d.toISOString().slice(0, 10) }
const hab = (extra = {}) => ({
  v: 1, id: 'h-x', nombre: 'Caminar', tipo: 'diario', meta: 8, unidad: 'vasos', dias: [0, 2, 4], veces: 3, aviso: null,
  color: 'celeste', orden: 0, creado: 0, inicio: '2026-10-01', mejor: 0, registro: {}, ...extra,
})
/** Un registro con 1 en cada día relativo a hoy (-1 = ayer). */
const reg = (...ns) => Object.fromEntries(ns.map(n => [dia(n), 1]))

// ------------------------------------------------------------------ toca, hecho, deHoy (11.3)

test('toca: diario, cantidad y por semana todos los días; algunos días solo los suyos', () => {
  for (const tipo of ['diario', 'cantidad', 'semana']) assert.equal(toca(hab({ tipo }), HOY), true, tipo)
  const gym = hab({ tipo: 'dias', dias: [0, 2, 4] })
  assert.equal(toca(gym, '2026-11-23'), true)
  assert.equal(toca(gym, '2026-11-24'), false)
  assert.equal(toca(gym, '2026-11-25'), true)
  assert.equal(toca(gym, HOY), false)
})

test('hecho: sí/no, algunos días y por semana con 1; cantidad con la meta; antes de inicio, nunca', () => {
  assert.equal(hecho(hab({ registro: reg(0) }), HOY), true)
  assert.equal(hecho(hab(), HOY), false)
  assert.equal(hecho(hab({ tipo: 'dias', dias: [3], registro: reg(0) }), HOY), true)
  assert.equal(hecho(hab({ tipo: 'semana', registro: reg(0) }), HOY), true)
  assert.equal(hecho(hab({ tipo: 'cantidad', meta: 8, registro: { [HOY]: 7 } }), HOY), false)
  assert.equal(hecho(hab({ tipo: 'cantidad', meta: 8, registro: { [HOY]: 8 } }), HOY), true)
  assert.equal(hecho(hab({ tipo: 'cantidad', meta: 8, registro: { [HOY]: 9 } }), HOY), true)
  assert.equal(hecho(hab({ inicio: HOY, registro: reg(-1) }), dia(-1)), false)
})

test('deHoy: los cuatro tipos; algunos días que hoy no toca no va; por semana cumplida y sin marcar hoy no va, marcada hoy sí', () => {
  assert.equal(deHoy(hab(), HOY), true)
  assert.equal(deHoy(hab({ tipo: 'cantidad' }), HOY), true)
  assert.equal(deHoy(hab({ tipo: 'dias', dias: [3] }), HOY), true)
  assert.equal(deHoy(hab({ tipo: 'dias', dias: [0, 2, 4] }), HOY), false)
  assert.equal(deHoy(hab({ tipo: 'semana', veces: 3, registro: reg(-3, -2) }), HOY), true)
  assert.equal(deHoy(hab({ tipo: 'semana', veces: 3, registro: reg(-3, -2, -1) }), HOY), false)
  assert.equal(deHoy(hab({ tipo: 'semana', veces: 3, registro: reg(-3, -2, -1, 0) }), HOY), true)
})

// ------------------------------------------------------------------ racha (11.4)

test('racha diario: 6 seguidos + hoy hecho = 7; hoy sin hacer no corta; ayer sin hacer corta', () => {
  assert.equal(racha(hab({ registro: reg(-6, -5, -4, -3, -2, -1, 0) }), HOY), 7)
  assert.equal(racha(hab({ registro: reg(-6, -5, -4, -3, -2, -1) }), HOY), 6)
  assert.equal(racha(hab({ registro: reg(-6, -5, -4, -3, -2) }), HOY), 0)
  assert.equal(racha(hab({ registro: reg(-6, -5, -4, -3, -2, 0) }), HOY), 1)
})

test('racha cantidad: un día con 6 de 8 corta', () => {
  const r = { [dia(-3)]: 8, [dia(-2)]: 6, [dia(-1)]: 9, [HOY]: 8 }
  assert.equal(racha(hab({ tipo: 'cantidad', meta: 8, registro: r }), HOY), 2)
})

test('racha algunos días: un día que no toca no corta (en días que tocan)', () => {
  // lun, mié y vie; hoy jueves. Lunes 23 y miércoles 25 hechos, viernes 20 y miércoles 18 también
  const gym = hab({ tipo: 'dias', dias: [0, 2, 4], registro: reg(-3, -1, -6, -8) })
  assert.equal(racha(gym, HOY), 4)
  // El lunes 23 sin hacer corta
  assert.equal(racha(hab({ tipo: 'dias', dias: [0, 2, 4], registro: reg(-1, -6, -8) }), HOY), 1)
})

test('racha por semana: 4 semanas + esta cumplida = 5; esta sin cumplir no corta; la semana de inicio sin cumplir no corta', () => {
  const semanas = []
  for (let w = 1; w <= 4; w++) semanas.push(-3 - 7 * w, -2 - 7 * w, -1 - 7 * w)
  assert.equal(racha(hab({ tipo: 'semana', veces: 3, inicio: '2026-10-01', registro: reg(...semanas, -3, -2, -1) }), HOY), 5)
  assert.equal(racha(hab({ tipo: 'semana', veces: 3, inicio: '2026-10-01', registro: reg(...semanas, -3) }), HOY), 4)
  // Creado el jueves de hace dos semanas (una vez esa semana), la pasada cumplida y esta también: 2
  const ini = dia(-14)
  assert.equal(racha(hab({ tipo: 'semana', veces: 3, inicio: ini, registro: reg(-14, -10, -9, -8, -3, -2, -1) }), HOY), 2)
  // Una semana sin llegar antes corta
  assert.equal(racha(hab({ tipo: 'semana', veces: 3, inicio: '2026-10-01', registro: reg(-17, -16, -15, -10, -3, -2, -1) }), HOY), 1)
})

test('racha: los días antes de inicio no cortan', () => {
  assert.equal(racha(hab({ inicio: dia(-2), registro: reg(-2, -1) }), HOY), 2)
  assert.equal(racha(hab({ inicio: HOY, registro: reg(0) }), HOY), 1)
  assert.equal(racha(hab({ inicio: HOY }), HOY), 0)
})

test('mejorRacha: nunca menor que el mejor guardado; la más larga del registro o la actual', () => {
  assert.equal(mejorRacha(hab({ mejor: 21, registro: reg(-1, 0) }), HOY), 21)
  // Diez seguidos hace un mes, cortados; ahora 2
  const viejos = Array.from({ length: 10 }, (_, i) => -30 - i)
  assert.equal(mejorRacha(hab({ mejor: 3, registro: reg(...viejos, -1, 0) }), HOY), 10)
  assert.equal(mejorRacha(hab({ mejor: 0, registro: reg(-2, -1, 0) }), HOY), 3)
})

test('conMejor: si la racha actual supera el mejor guardado, lo sube; si no, el mismo objeto', () => {
  const h = hab({ mejor: 2, registro: reg(-2, -1, 0) })
  assert.equal(conMejor(h, HOY).mejor, 3)
  const igual = hab({ mejor: 9, registro: reg(0) })
  assert.equal(conMejor(igual, HOY), igual)
})

// ------------------------------------------------------------------ celdas (4.8)

test('estadoCelda: los ocho estados de 4.8', () => {
  const agua = hab({ tipo: 'cantidad', meta: 8, inicio: dia(-2), registro: { [dia(-2)]: 8, [dia(-1)]: 3 } })
  assert.equal(estadoCelda(agua, dia(-3), HOY), 'antes')
  assert.equal(estadoCelda(agua, dia(-2), HOY), 'hecho')
  assert.equal(estadoCelda(agua, dia(-1), HOY), 'parcial')
  assert.equal(estadoCelda(agua, HOY, HOY), 'pend')
  assert.equal(estadoCelda(agua, dia(1), HOY), 'futuro')
  const caminar = hab({ registro: reg(-2) })
  assert.equal(estadoCelda(caminar, dia(-1), HOY), 'falta')
  const gym = hab({ tipo: 'dias', dias: [0, 2, 4] })
  assert.equal(estadoCelda(gym, dia(-2), HOY), 'libre')
  assert.equal(estadoCelda(gym, dia(2), HOY), 'libre')
  const correr = hab({ tipo: 'semana', registro: reg(-2) })
  assert.equal(estadoCelda(correr, dia(-2), HOY), 'hecho')
  assert.equal(estadoCelda(correr, dia(-1), HOY), 'nada')
  assert.equal(estadoCelda(correr, HOY, HOY), 'pend')
})

test('textoCelda: el nombre de cada celda (4.8), con «(hoy)» y la cantidad', () => {
  const agua = hab({ tipo: 'cantidad', meta: 8, registro: { [dia(-3)]: 8, [dia(-1)]: 3, [HOY]: 2 } })
  assert.equal(textoCelda(agua, dia(-3), HOY), 'lun 23: 8 de 8, cumplido')
  assert.equal(textoCelda(agua, dia(-1), HOY), 'mié 25: 3 de 8')
  assert.equal(textoCelda(agua, HOY, HOY), 'jue 26 (hoy): 2 de 8')
  assert.equal(textoCelda(agua, dia(-2), HOY), 'mar 24: no se hizo')
  assert.equal(textoCelda(hab(), HOY, HOY), 'jue 26 (hoy): falta')
  assert.equal(textoCelda(hab({ registro: reg(-1) }), dia(-1), HOY), 'mié 25: hecho')
  assert.equal(textoCelda(hab({ tipo: 'dias', dias: [0] }), dia(-2), HOY), 'mar 24: no toca')
  assert.equal(textoCelda(hab({ tipo: 'semana' }), dia(-1), HOY), 'mié 25: sin salida')
  assert.equal(textoCelda(hab(), dia(1), HOY), 'vie 27: por venir')
  assert.equal(textoCelda(hab({ inicio: HOY }), dia(-1), HOY), 'mié 25: antes de crearlo')
})

test('corregible y corregir: días pasados de esta semana (y hoy), sí/no, algunos días y por semana; la cantidad no (D-h4)', () => {
  const caminar = hab({ registro: reg(-1) })
  assert.equal(corregible(caminar, dia(-3), HOY), true)
  assert.equal(corregible(caminar, HOY, HOY), true)
  assert.equal(corregible(caminar, dia(-4), HOY), false)
  assert.equal(corregible(caminar, dia(1), HOY), false)
  assert.equal(corregible(hab({ tipo: 'cantidad' }), dia(-1), HOY), false)
  assert.equal(corregible(hab({ tipo: 'dias', dias: [0, 2, 4] }), dia(-2), HOY), false)
  assert.equal(corregible(hab({ tipo: 'semana' }), dia(-2), HOY), true)
  assert.equal(corregible(hab({ inicio: HOY }), dia(-1), HOY), false)
  assert.deepEqual(corregir(caminar, dia(-1), HOY).registro, {})
  assert.deepEqual(corregir(caminar, dia(-2), HOY).registro, reg(-2, -1))
  assert.equal(corregir(hab({ tipo: 'cantidad' }), dia(-1), HOY), null)
})

// ------------------------------------------------------------------ pctSemana (11.4)

test('pctSemana: hoy sin hacer no cuenta; hecho sí; por semana con tope en veces', () => {
  const lunes = '2026-11-23'
  // Caminar: lun, mar y mié hechos de 3 que pasaron (hoy sin hacer no cuenta) = 3/3
  assert.equal(pctSemana([hab({ registro: reg(-3, -2, -1) })], lunes, HOY), 100)
  // Con hoy hecho: 4/4; con uno sin hacer: 2/3
  assert.equal(pctSemana([hab({ registro: reg(-3, -2, -1, 0) })], lunes, HOY), 100)
  assert.equal(pctSemana([hab({ registro: reg(-3, -1) })], lunes, HOY), 67)
  // Correr 3 por semana con 4 salidas: 3/3, no 4/3
  assert.equal(pctSemana([hab({ tipo: 'semana', veces: 3, registro: reg(-3, -2, -1, 0) })], lunes, HOY), 100)
  // Los dos: 2/3 de caminar + 1/3 de correr = 3/6
  assert.equal(pctSemana([hab({ registro: reg(-3, -1) }), hab({ id: 'h-y', tipo: 'semana', veces: 3, registro: reg(-2) })], lunes, HOY), 50)
  assert.equal(pctSemana([], lunes, HOY), 0)
})

// ------------------------------------------------------------------ cambiarTipo (11.1)

test('cambiarTipo: a cantidad, 1 → meta; de cantidad, n ≥ meta → 1 y menos de la meta se borra', () => {
  const caminar = hab({ registro: reg(-2, -1) })
  assert.deepEqual(cambiarTipo(caminar, 'cantidad').registro, { [dia(-2)]: 8, [dia(-1)]: 8 })
  assert.equal(cambiarTipo(caminar, 'cantidad').tipo, 'cantidad')
  const agua = hab({ tipo: 'cantidad', meta: 8, registro: { [dia(-2)]: 9, [dia(-1)]: 8, [HOY]: 3 } })
  assert.deepEqual(cambiarTipo(agua, 'diario').registro, { [dia(-2)]: 1, [dia(-1)]: 1 })
  // Entre sí/no, algunos días y por semana el registro queda
  assert.deepEqual(cambiarTipo(caminar, 'semana').registro, caminar.registro)
  // El mismo tipo: el mismo objeto
  assert.equal(cambiarTipo(caminar, 'diario'), caminar)
})

// ------------------------------------------------------------------ formulario (4.11 y 5.1)

test('validarHabito: los cuatro errores de 5.1; el mismo nombre con otras mayúsculas es repetido', () => {
  const lista = [hab({ id: 'h-a', nombre: 'Caminar' }), hab({ id: 'h-b', nombre: 'Agua', tipo: 'dias', dias: [1] })]
  assert.deepEqual(validarHabito({ nombre: '   ', tipo: 'diario' }, lista), { ok: false, error: 'Ponele un nombre.', campo: 'nombre' })
  assert.deepEqual(validarHabito({ nombre: 'caminar', tipo: 'diario' }, lista), { ok: false, error: 'Ya hay un hábito «Caminar».', campo: 'nombre' })
  assert.deepEqual(validarHabito({ nombre: 'Gimnasio', tipo: 'dias', dias: [] }, lista), { ok: false, error: 'Elegí al menos un día.', campo: 'dias' })
  assert.deepEqual(validarHabito({ id: 'h-b', nombre: 'Agua', tipo: 'dias', dias: [] }, lista), { ok: false, error: 'Tiene que quedar al menos un día.', campo: 'dias' })
  // El propio nombre no es repetido; sin tildes ni espacios a los lados
  assert.deepEqual(validarHabito({ id: 'h-a', nombre: ' Caminar ', tipo: 'diario' }, lista), { ok: true, nombre: 'Caminar' })
  assert.deepEqual(validarHabito({ nombre: 'Leer', tipo: 'dias', dias: [2] }, lista), { ok: true, nombre: 'Leer' })
})

test('fraseFormulario: las cuatro formas de 5.1, con y sin aviso, y sin nombre', () => {
  const t = h => fraseFormulario(h).texto
  assert.equal(t(hab({ aviso: '16:00' })), 'Caminar · todos los días · te aviso a las 16:00')
  assert.equal(t(hab({ nombre: 'Agua', tipo: 'cantidad', meta: 8, unidad: 'vasos', aviso: '16:00' })), 'Agua · 8 vasos por día · te aviso a las 16:00')
  assert.equal(t(hab({ nombre: 'Gimnasio', tipo: 'dias', dias: [0, 2, 4] })), 'Gimnasio · lun, mié y vie · sin aviso')
  assert.equal(t(hab({ nombre: 'Correr', tipo: 'semana', veces: 3 })), 'Correr · 3 veces por semana, cualquier día · sin aviso')
  assert.equal(t(hab({ nombre: 'Correr', tipo: 'semana', veces: 1 })), 'Correr · 1 vez por semana, cualquier día · sin aviso')
  assert.equal(t(hab({ nombre: '  ' })), 'Tu hábito · todos los días · sin aviso')
  // El nombre va aparte (en negrita en la vista)
  assert.deepEqual(fraseFormulario(hab({ nombre: 'Leer' })), { nombre: 'Leer', resto: ' · todos los días · sin aviso', texto: 'Leer · todos los días · sin aviso' })
})

test('borradorNuevo: «Todos los días», meta 8 «vasos», lun, mié y vie, 3 veces y sin aviso, con el color siguiente', () => {
  assert.deepEqual(borradorNuevo([]), { nombre: '', tipo: 'diario', meta: 8, unidad: 'vasos', dias: [0, 2, 4], veces: 3, aviso: null, color: 'celeste' })
  assert.equal(borradorNuevo([hab({ color: 'verde', orden: 3 })]).color, 'rosa')
})

test('nuevoHabito: el formato v1 de habitos.rs, al final del orden, con inicio hoy y el registro vacío', () => {
  const b = { ...borradorNuevo([]), nombre: ' Leer ', tipo: 'semana', veces: 2 }
  assert.deepEqual(nuevoHabito(b, { id: 'h-1', ahora: 1764100000000, hoy: HOY, lista: [hab({ orden: 4 })] }), {
    v: 1, id: 'h-1', nombre: 'Leer', tipo: 'semana', meta: 8, unidad: 'vasos', dias: [0, 2, 4], veces: 2, aviso: null,
    color: 'celeste', orden: 5, creado: 1764100000000, inicio: HOY, mejor: 0, registro: {},
  })
  assert.equal(nuevoHabito(b, { id: 'h-2', ahora: 1, hoy: HOY, lista: [] }).orden, 0)
})

test('SUGERIDAS y desdeSugerida: las cuatro de 5.2, con su tipo y su meta, sin aviso', () => {
  assert.deepEqual(SUGERIDAS.map(s => `${s.nombre} · ${s.detalle}`), ['Tomar agua · 8 vasos', 'Caminar · todos los días', 'Gimnasio · lun, mié, vie', 'Correr · 3 por semana'])
  const agua = desdeSugerida(SUGERIDAS[0], { id: 'h-a', ahora: 5, hoy: HOY, lista: [] })
  assert.equal(agua.nombre, 'Tomar agua')
  assert.equal(agua.tipo, 'cantidad')
  assert.equal(agua.meta, 8)
  assert.equal(agua.unidad, 'vasos')
  assert.equal(agua.aviso, null)
  assert.deepEqual(desdeSugerida(SUGERIDAS[2], { id: 'h-g', ahora: 5, hoy: HOY, lista: [] }).dias, [0, 2, 4])
  assert.equal(desdeSugerida(SUGERIDAS[3], { id: 'h-c', ahora: 5, hoy: HOY, lista: [] }).veces, 3)
})

test('editar: tipo con cambiarTipo, meta de 1 a 99, veces de 1 a 6, unidad hasta 16, días ordenados, color de la paleta', () => {
  const h = hab()
  assert.equal(editar(h, 'meta', 0).meta, 1)
  assert.equal(editar(h, 'meta', 120).meta, 99)
  assert.equal(editar(h, 'veces', 9).veces, 6)
  assert.equal(editar(h, 'unidad', '  páginas del libro de hoy  ').unidad, 'páginas del libr')
  assert.deepEqual(editar(h, 'dias', [4, 0, 4, 2]).dias, [0, 2, 4])
  assert.equal(editar(h, 'color', 'dorado').color, 'celeste')
  assert.equal(editar(h, 'aviso', '07:30').aviso, '07:30')
  assert.equal(editar(hab({ registro: reg(-1) }), 'tipo', 'cantidad').registro[dia(-1)], 8)
})

// ------------------------------------------------------------------ marcar y sumar

test('marcar y sumar: el registro sin ceros; la cantidad puede pasar la meta (D-h16) y no baja de 0', () => {
  assert.deepEqual(marcar(hab(), HOY, true).registro, { [HOY]: 1 })
  assert.deepEqual(marcar(hab({ registro: reg(0) }), HOY, false).registro, {})
  const agua = hab({ tipo: 'cantidad', registro: { [HOY]: 8 } })
  assert.equal(sumar(agua, HOY, 1).registro[HOY], 9)
  assert.deepEqual(sumar(hab({ tipo: 'cantidad', registro: { [HOY]: 1 } }), HOY, -1).registro, {})
  assert.deepEqual(sumar(hab({ tipo: 'cantidad' }), HOY, -1).registro, {})
  assert.equal(sumar(hab({ tipo: 'cantidad', registro: { [HOY]: 999 } }), HOY, 1).registro[HOY], 999)
})

test('hitoNuevo y textoHito: 7, 30 y 100 al subir; los textos de 5.1', () => {
  assert.equal(hitoNuevo(6, 7), 7)
  assert.equal(hitoNuevo(29, 30), 30)
  assert.equal(hitoNuevo(99, 100), 100)
  assert.equal(hitoNuevo(7, 7), null)
  assert.equal(hitoNuevo(8, 7), null)
  assert.equal(hitoNuevo(7, 8), null)
  assert.equal(textoHito(hab(), 7), 'Caminar: ¡una semana seguida!')
  assert.equal(textoHito(hab(), 30), 'Caminar: ¡30 días seguidos!')
  assert.equal(textoHito(hab({ nombre: 'Correr', tipo: 'semana' }), 7), 'Correr: ¡7 semanas seguidas!')
})

// ------------------------------------------------------------------ textos (4 y 5)

test('cuentasHoy y nombreFilaHabitos: «Hábitos» · «hoy no toca ninguno» · «{h} de {t} hechos hoy» · «los {t} de hoy hechos»', () => {
  const lista = [hab({ registro: reg(0) }), hab({ id: 'h-b', tipo: 'dias', dias: [0] }), hab({ id: 'h-c', tipo: 'cantidad' })]
  assert.deepEqual(cuentasHoy(lista, HOY), { hechos: 1, total: 2, habitos: 3 })
  assert.equal(nombreFilaHabitos({ hechos: 0, total: 0, habitos: 0 }), 'Hábitos')
  assert.equal(nombreFilaHabitos(null), 'Hábitos')
  assert.equal(nombreFilaHabitos({ hechos: 0, total: 0, habitos: 2 }), 'Hábitos, hoy no toca ninguno')
  assert.equal(nombreFilaHabitos({ hechos: 2, total: 5, habitos: 5 }), 'Hábitos, 2 de 5 hechos hoy')
  assert.equal(nombreFilaHabitos({ hechos: 3, total: 3, habitos: 4 }), 'Hábitos, los 3 de hoy hechos')
})

test('subtituloHabitos y resumenHoy: la bajada (5.1) y el encabezado de Hoy (4.3)', () => {
  assert.equal(subtituloHabitos({ hechos: 0, total: 0, habitos: 0 }, HOY), 'Se guardan en esta PC')
  assert.equal(subtituloHabitos({ hechos: 2, total: 5, habitos: 5 }, HOY), 'jueves 26/11 · 2 de 5 hechos hoy')
  assert.equal(subtituloHabitos({ hechos: 5, total: 5, habitos: 5 }, HOY), 'jueves 26/11 · día completo')
  assert.equal(subtituloHabitos({ hechos: 0, total: 0, habitos: 2 }, HOY), 'jueves 26/11 · hoy no toca ninguno')
  assert.deepEqual(resumenHoy({ hechos: 2, total: 5 }), { texto: 'hoy · 2 de 5 hechos', completo: false })
  assert.deepEqual(resumenHoy({ hechos: 5, total: 5 }), { texto: '¡Día completo!', completo: true })
  assert.deepEqual(resumenHoy({ hechos: 0, total: 0 }), { texto: 'hoy no toca ninguno', completo: false })
})

test('rotuloTipo: el rótulo de cada fila (5.1), con «hoy no toca · vuelve el {día}» y la semana cumplida', () => {
  assert.equal(rotuloTipo(hab(), HOY), 'todos los días')
  assert.equal(rotuloTipo(hab({ tipo: 'cantidad', registro: { [HOY]: 3 } }), HOY), '3 de 8 vasos')
  assert.equal(rotuloTipo(hab({ tipo: 'dias', dias: [3, 5] }), HOY), 'jue y sáb')
  assert.equal(rotuloTipo(hab({ tipo: 'dias', dias: [0, 2, 4] }), HOY), 'hoy no toca · vuelve el vie')
  assert.equal(rotuloTipo(hab({ tipo: 'dias', dias: [2] }), HOY), 'hoy no toca · vuelve el mié')
  assert.equal(rotuloTipo(hab({ tipo: 'semana', veces: 3, registro: reg(-2) }), HOY), '1 de 3 esta semana')
  assert.equal(rotuloTipo(hab({ tipo: 'semana', veces: 3, registro: reg(-3, -2, -1) }), HOY), 'semana cumplida · 3 de 3 esta semana')
})

test('textoRacha y nivelRacha: «{n} día(s)», «{n} semana(s)», «sin racha» (corta «0»); 0, 1–6, 7–29, 30+', () => {
  assert.equal(textoRacha(hab(), 0), 'sin racha')
  assert.equal(textoRacha(hab(), 0, { corta: true }), '0')
  assert.equal(textoRacha(hab(), 1), '1 día')
  assert.equal(textoRacha(hab(), 7), '7 días')
  assert.equal(textoRacha(hab({ tipo: 'semana' }), 1), '1 semana')
  assert.equal(textoRacha(hab({ tipo: 'semana' }), 4), '4 semanas')
  assert.equal(textoRacha(hab(), 12, { corta: true }), '12')
  assert.deepEqual([0, 1, 6, 7, 29, 30, 120].map(nivelRacha), [0, 1, 1, 2, 2, 3, 3])
  assert.equal(textoRachaGrande(hab(), 3), 'días seguidos')
  assert.equal(textoRachaGrande(hab({ tipo: 'semana' }), 3), 'semanas seguidas')
  assert.equal(textoRachaGrande(hab(), 0), 'sin racha todavía')
  // Con 1, en singular
  assert.equal(textoRachaGrande(hab(), 1), 'día seguido')
  assert.equal(textoRachaGrande(hab({ tipo: 'semana' }), 1), 'semana seguida')
  assert.equal(desdeEl(Date.UTC(2026, 10, 2, 15)), '2/11')
})

test('unidadSingular, listaDias y nombreSumador (4.6)', () => {
  assert.equal(unidadSingular('vasos'), 'vaso')
  assert.equal(unidadSingular('páginas'), 'página')
  assert.equal(unidadSingular('veces'), 'vez')
  assert.equal(unidadSingular(''), 'vez')
  assert.equal(listaDias([0, 2, 4]), 'lun, mié y vie')
  assert.equal(listaDias([6]), 'dom')
  assert.equal(listaDias([]), '')
  const agua = hab({ nombre: 'Agua', tipo: 'cantidad', meta: 8, unidad: 'vasos', registro: { [HOY]: 3 } })
  assert.equal(nombreSumador(agua, HOY), 'Sumar 1 vaso a Agua. Van 3 de 8')
  assert.equal(nombreSumador({ ...agua, registro: { [HOY]: 9 } }, HOY), 'Agua: meta cumplida, 9 de 8 vasos. Sumar otro')
})

test('textoBorrar: «¿Borrar con su racha de {n} {días|semanas}? Sí»; sin racha, «¿Borrar? Sí» (4.12)', () => {
  assert.equal(textoBorrar(hab({ registro: reg(-1, 0) }), HOY), '¿Borrar con su racha de 2 días? Sí')
  assert.equal(textoBorrar(hab({ registro: reg(0) }), HOY), '¿Borrar con su racha de 1 día? Sí')
  assert.equal(textoBorrar(hab({ tipo: 'semana', veces: 1, registro: reg(-7, 0) }), HOY), '¿Borrar con su racha de 2 semanas? Sí')
  assert.equal(textoBorrar(hab(), HOY), '¿Borrar? Sí')
})

test('mananaHabitos: los que van mañana, para «Mañana: {nombres}.» (5.2)', () => {
  const lista = [hab({ nombre: 'Gimnasio', tipo: 'dias', dias: [0, 2, 4] }), hab({ id: 'h-b', nombre: 'Yoga', tipo: 'dias', dias: [1] }), hab({ id: 'h-c', nombre: 'Natación', tipo: 'dias', dias: [4] })]
  assert.equal(mananaHabitos(lista, HOY), 'Gimnasio y Natación')
  assert.equal(mananaHabitos([lista[1]], HOY), '')
})

test('ultimasSemanas: 5 filas de 7 de lunes a domingo, terminando esta semana, y los días hechos', () => {
  const u = ultimasSemanas(hab({ registro: reg(-1, -2, -9) }), HOY)
  assert.equal(u.filas.length, 5)
  assert.ok(u.filas.every(f => f.length === 7))
  assert.equal(u.filas[4][3].dia, HOY)
  assert.equal(u.filas[4][2].estado, 'hecho')
  assert.equal(u.filas[0][0].dia, '2026-10-26')
  assert.equal(u.hechos, 3)
})

test('rangoSemana y cabeceraSemana: «{d}/{m} al {d}/{m} · {p} % de lo que tocaba» (4.3)', () => {
  assert.equal(rangoSemana('2026-11-30'), '30/11 al 6/12')
  assert.equal(cabeceraSemana('2026-11-23', 60), '23/11 al 29/11 · 60 % de lo que tocaba')
})

test('anuncios de 5.3', () => {
  const agua = hab({ nombre: 'Agua', tipo: 'cantidad', meta: 8, unidad: 'vasos' })
  assert.equal(anuncioTilde(hab(), true), 'Hecho hoy: Caminar')
  assert.equal(anuncioTilde(hab(), false), 'Caminar vuelve a pendiente')
  assert.equal(anuncioSuma(agua, 3, false), 'Agua: 3 de 8 vasos')
  assert.equal(anuncioSuma(agua, 8, true), 'Agua: 8 de 8 vasos. Meta del día cumplida')
  assert.equal(anuncioDiaCompleto(4), 'Día completo: hiciste los 4 de hoy.')
  assert.equal(anuncioCorregido(hab(), '2026-11-24', true), 'Corregido: Caminar, martes hecho')
  assert.equal(anuncioCorregido(hab(), '2026-11-24', false), 'Corregido: Caminar, martes sin hacer')
  assert.equal(anuncioCreado('Leer', false), 'Hábito «Leer» creado')
  assert.equal(anuncioCreado('Tomar agua', true), 'Hábito «Tomar agua» creado. Tocá su nombre para ponerle un aviso.')
  assert.equal(anuncioBorrado('Leer'), 'Borraste «Leer»')
})

// ------------------------------------------------------------------ la hoja (3.4, 3.5)

test('estado de la hoja: entra en Hoy la primera vez; después en la última vista; «‹» vuelve a la de origen', () => {
  let t = habitosInicial()
  assert.equal(t.abierta, false)
  t = abrirHabitos(t)
  assert.equal(t.ver, 'hoy')
  t = verHabitos(t, 'semana')
  assert.equal(t.desde, 'semana')
  t = abrirHabito(t, 'h-x')
  assert.deepEqual([t.ver, t.desde], ['h-x', 'semana'])
  t = cerrarHabito(t)
  assert.equal(t.ver, 'semana')
  t = cerrarHabitos(abrirHabito(t, 'h-x'))
  assert.equal(abrirHabitos(t).ver, 'h-x')
  // El formulario de un hábito nuevo no sobrevive a cerrar la hoja: vuelve a la vista de origen
  t = cerrarHabitos(empezarNuevo(verHabitos(abrirHabitos(t), 'hoy'), []))
  assert.equal(t.borrador, null)
  assert.equal(abrirHabitos(t).ver, 'hoy')
  // Abrir con una vista pedida
  assert.equal(abrirHabitos(habitosInicial(), 'semana').ver, 'semana')
})

test('empezarNuevo: el formulario con el borrador; cambiar de vista lo descarta y desarma', () => {
  const t = empezarNuevo({ ...abrirHabitos(habitosInicial()), armado: { id: 'x', hasta: 9 } }, [])
  assert.equal(t.ver, 'nuevo')
  assert.equal(t.desde, 'hoy')
  assert.deepEqual(t.borrador, borradorNuevo([]))
  assert.equal(t.armado, null)
  const v = verHabitos({ ...t, errForm: 'x' }, 'semana')
  assert.deepEqual([v.borrador, v.errForm, v.armado], [null, null, null])
})

test('ordenarHabitos: por orden, después creado y después id (como habitos.rs)', () => {
  const l = [hab({ id: 'h-c', orden: 1, creado: 1 }), hab({ id: 'h-b', orden: 0, creado: 5 }), hab({ id: 'h-a', orden: 0, creado: 5 })]
  assert.deepEqual(ordenarHabitos(l).map(h => h.id), ['h-a', 'h-b', 'h-c'])
})

// ------------------------------------------------------------------ teclado (9.1 y 9.2)

test('alEscHabitos: las cinco capas de 9.1, una por vez', () => {
  const abierta = abrirHabitos(habitosInicial())
  const nuevo = empezarNuevo(abierta, [])
  // 1. el nombre de un hábito nuevo con algo escrito: se vacía
  assert.equal(alEscHabitos(nuevo, { campo: 'nombre', texto: 'Le' }).accion, 'vaciar')
  // 2. el «¿Borrar…? Sí» armado: se desarma
  const conHabito = abrirHabito(abierta, 'h-x')
  const armado = { ...conHabito, armado: { id: 'borrar:h-x', hasta: 9 } }
  assert.deepEqual(alEscHabitos(armado, null), { habitos: { ...conHabito, armado: null }, accion: 'desarmar' })
  // 3. el formulario de un hábito nuevo (vacío): se cancela
  const r3 = alEscHabitos(nuevo, { campo: 'nombre', texto: '' })
  assert.equal(r3.accion, 'cancelar-nuevo')
  assert.deepEqual([r3.habitos.ver, r3.habitos.borrador], ['hoy', null])
  // 4. un hábito abierto: vuelve a la vista de la que vino
  const r4 = alEscHabitos(conHabito, null)
  assert.deepEqual([r4.accion, r4.habitos.ver], ['cerrar-habito', 'hoy'])
  // 5. el módulo: cerrar (modulos.js lo convierte en ir a Sesiones)
  assert.equal(alEscHabitos(abierta, null).accion, 'cerrar')
  assert.equal(alEscHabitos(verHabitos(abierta, 'semana'), null).accion, 'cerrar')
  // Cerrada, no es de la hoja
  assert.equal(alEscHabitos(habitosInicial(), null).accion, null)
})

test('esAtajoHabitos: Ctrl H sí; con Shift, Alt o Meta no', () => {
  assert.equal(esAtajoHabitos({ key: 'h', ctrlKey: true }), true)
  assert.equal(esAtajoHabitos({ key: 'H', ctrlKey: true }), true)
  assert.equal(esAtajoHabitos({ key: 'h', ctrlKey: true, shiftKey: true }), false)
  assert.equal(esAtajoHabitos({ key: 'h', ctrlKey: true, altKey: true }), false)
  assert.equal(esAtajoHabitos({ key: 'h', ctrlKey: true, metaKey: true }), false)
  assert.equal(esAtajoHabitos({ key: 'h' }), false)
  assert.equal(esAtajoHabitos({ key: 't', ctrlKey: true }), false)
})

// ------------------------------------------------------------------ el recordatorio (H2: 8.3, 5.4, 5.5 y 11.6)

/** Un instante en ms a la hora de Argentina `hm` ("HH:MM") del día `d` (UTC−3 todo el año). */
const a = (hm, d = HOY) => Date.parse(`${d}T${hm}:00-03:00`)
const ids = debidos => debidos.map(r => r.id)

test('recordatoriosDebidos: antes de la hora nada; a la hora, el hábito (con su hora y el día)', () => {
  const agua = hab({ id: 'h-agua', tipo: 'cantidad', aviso: '16:00', registro: { [HOY]: 3 } })
  assert.deepEqual(recordatoriosDebidos([agua], a('15:59'), null), [])
  assert.deepEqual(recordatoriosDebidos([agua], a('16:00'), null), [{ id: 'h-agua', hora: '16:00', dia: HOY, tarde: false }])
  // Sin aviso, o con un aviso que no es una hora, nunca
  assert.deepEqual(recordatoriosDebidos([hab({ aviso: null })], a('23:59'), null), [])
  assert.deepEqual(recordatoriosDebidos([hab({ aviso: '25:00' })], a('23:59'), null), [])
})

test('recordatoriosDebidos: ya hecho hoy, nada (cantidad con la meta; sí/no con 1)', () => {
  assert.deepEqual(recordatoriosDebidos([hab({ aviso: '09:00', registro: reg(0) })], a('10:00'), null), [])
  assert.deepEqual(recordatoriosDebidos([hab({ tipo: 'cantidad', meta: 8, aviso: '09:00', registro: { [HOY]: 8 } })], a('10:00'), null), [])
  // Cantidad sin llegar a la meta: se debe
  assert.equal(recordatoriosDebidos([hab({ tipo: 'cantidad', meta: 8, aviso: '09:00', registro: { [HOY]: 7 } })], a('10:00'), null).length, 1)
})

test('recordatoriosDebidos: ya recordado hoy, nada; otro día en recordados, vuelve', () => {
  const h = hab({ aviso: '09:00' })
  assert.deepEqual(recordatoriosDebidos([h], a('10:00'), { dia: HOY, ids: ['h-x'] }), [])
  assert.deepEqual(ids(recordatoriosDebidos([h], a('10:00'), { dia: dia(-1), ids: ['h-x'] })), ['h-x'])
  // Recordado hoy otro hábito: este sale igual
  assert.deepEqual(ids(recordatoriosDebidos([h], a('10:00'), { dia: HOY, ids: ['h-otro'] })), ['h-x'])
})

test('recordatoriosDebidos: algunos días que hoy no toca, nada; por semana cumplida, nada', () => {
  // HOY es jueves (3): lun, mié y vie no lo incluyen
  assert.deepEqual(recordatoriosDebidos([hab({ tipo: 'dias', dias: [0, 2, 4], aviso: '07:30' })], a('09:00'), null), [])
  assert.equal(recordatoriosDebidos([hab({ tipo: 'dias', dias: [3], aviso: '07:30' })], a('09:00'), null).length, 1)
  // Por semana: 3 de 3 esta semana (lunes 23, martes 24 y miércoles 25) y hoy sin marcar: no hace falta
  const correr = hab({ tipo: 'semana', veces: 3, aviso: '18:00', registro: reg(-3, -2, -1) })
  assert.deepEqual(recordatoriosDebidos([correr], a('19:00'), null), [])
  // 1 de 3 y hoy sin marcar: se debe
  assert.equal(recordatoriosDebidos([hab({ tipo: 'semana', veces: 3, aviso: '18:00', registro: reg(-1) })], a('19:00'), null).length, 1)
})

test('recordatoriosDebidos: dos debidos, ordenados por hora (el más temprano primero)', () => {
  const tarde = hab({ id: 'h-caminar', aviso: '19:00' })
  const temprano = hab({ id: 'h-agua', aviso: '16:00' })
  assert.deepEqual(ids(recordatoriosDebidos([tarde, temprano], a('19:30'), null)), ['h-agua', 'h-caminar'])
})

test('recordatoriosDebidos: más de 60 min después de la hora sale con tarde: true (solo globo, D-h12)', () => {
  const h = hab({ aviso: '16:00' })
  assert.equal(recordatoriosDebidos([h], a('17:00'), null)[0].tarde, false)
  assert.equal(recordatoriosDebidos([h], a('17:01'), null)[0].tarde, true)
  // Arrancar a la noche: sale igual, una sola vez, tarde
  assert.deepEqual(recordatoriosDebidos([h], a('23:30'), null), [{ id: 'h-x', hora: '16:00', dia: HOY, tarde: true }])
})

test('recordatoriosDebidos: el día es el de Argentina (23:30 del 26 en Argentina ya es el 27 en UTC)', () => {
  const h = hab({ aviso: '23:00' })
  const r = recordatoriosDebidos([h], Date.parse('2026-11-27T02:30:00Z'), { dia: '2026-11-27', ids: ['h-x'] })
  assert.deepEqual(r, [{ id: 'h-x', hora: '23:00', dia: HOY, tarde: false }])
})

test('recordar: suma los ids del día; otro día empieza de cero; sin repetir y hasta 100', () => {
  assert.deepEqual(recordar(null, ['h-a'], HOY), { dia: HOY, ids: ['h-a'] })
  assert.deepEqual(recordar({ dia: HOY, ids: ['h-a'] }, ['h-b', 'h-a'], HOY), { dia: HOY, ids: ['h-a', 'h-b'] })
  assert.deepEqual(recordar({ dia: dia(-1), ids: ['h-a'] }, ['h-b'], HOY), { dia: HOY, ids: ['h-b'] })
  const muchos = Array.from({ length: 105 }, (_, i) => `h-${i}`)
  const r = recordar(null, muchos, HOY)
  assert.equal(r.ids.length, 100)
  assert.deepEqual(r.ids.slice(-1), ['h-104'])
})

test('recordatorioVigente: se va al cumplir el hábito, si el hábito ya no está o a la medianoche', () => {
  const h = hab({ tipo: 'cantidad', meta: 8, aviso: '16:00', registro: { [HOY]: 3 } })
  const aviso = { tipo: 'rec', id: 'h-x', dia: HOY, hora: '16:00' }
  assert.equal(recordatorioVigente(aviso, h, HOY), true)
  // Un +1 que no llega a la meta: sigue
  assert.equal(recordatorioVigente(aviso, sumar(h, HOY, 1), HOY), true)
  // Hecho por cualquier camino (la hoja, el globo): se va
  assert.equal(recordatorioVigente(aviso, { ...h, registro: { [HOY]: 8 } }, HOY), false)
  // El hábito se borró
  assert.equal(recordatorioVigente(aviso, undefined, HOY), false)
  // Medianoche: el de ayer se va
  assert.equal(recordatorioVigente(aviso, h, dia(1)), false)
  // Por semana: la semana quedó cumplida
  const correr = hab({ tipo: 'semana', veces: 2, registro: reg(-1) })
  assert.equal(recordatorioVigente(aviso, correr, HOY), true)
  assert.equal(recordatorioVigente(aviso, marcar(correr, HOY, true), HOY), false)
})

test('textosGlobo: cantidad (5.4 y 5.5): marca, muesca, fila, acciones y notificación', () => {
  const agua = hab({ nombre: 'Agua', tipo: 'cantidad', meta: 8, unidad: 'vasos', aviso: '16:00', registro: { [HOY]: 3 } })
  const t = textosGlobo({ tipo: 'rec', id: 'h-x', dia: HOY, hora: '16:00' }, agua)
  assert.equal(plano(t.globo), '16:00 · Agua: van 3 de 8 vasos. ¿Uno más?')
  // En negrita, la hora y los números
  assert.deepEqual(t.globo.filter(s => s.fuerte).map(s => s.t), ['16:00', '3 de 8 vasos'])
  assert.equal(t.texto, '16:00 · Agua: van 3 de 8 vasos. ¿Uno más?')
  assert.equal(t.hacer, '+1 vaso')
  assert.equal(t.ver, 'Ver hábitos →')
  assert.equal(plano(t.muesca), '16:00 · Agua 3 de 8')
  assert.deepEqual(t.progreso, { hechos: 3, total: 8 })
  assert.equal(plano(t.fila), '16:00 · Agua: 3 de 8.')
  assert.equal(t.hacerFila, '+1')
  assert.deepEqual(t.notificacion, { titulo: 'Agua · 16:00', cuerpo: 'Van 3 de 8 vasos. ¿Uno más?' })
  assert.deepEqual(t.x, { nombre: 'Ahora no: no te recuerdo Agua hasta mañana', titulo: 'Ahora no' })
  // Sin unidad: sin el espacio de más
  assert.equal(plano(textosGlobo({ dia: HOY, hora: '16:00' }, { ...agua, unidad: '' }).globo), '16:00 · Agua: van 3 de 8. ¿Uno más?')
})

test('textosGlobo: sí/no y algunos días (5.4 y 5.5)', () => {
  for (const extra of [{}, { tipo: 'dias', dias: [3] }]) {
    const t = textosGlobo({ dia: HOY, hora: '19:00' }, hab({ nombre: 'Caminar', aviso: '19:00', ...extra }))
    assert.equal(plano(t.globo), '19:00 · Te toca Caminar.')
    assert.deepEqual(t.globo.filter(s => s.fuerte).map(s => s.t), ['19:00', 'Caminar'])
    assert.equal(t.hacer, 'Hecho')
    assert.equal(plano(t.muesca), '19:00 · Caminar')
    assert.equal(t.progreso, null)
    assert.equal(plano(t.fila), '19:00 · Te toca Caminar.')
    assert.equal(t.hacerFila, 'Hecho')
    assert.deepEqual(t.notificacion, { titulo: 'Caminar · 19:00', cuerpo: 'Te toca Caminar.' })
  }
})

test('textosGlobo: por semana (5.4 y 5.5): lo que lleva esta semana', () => {
  const correr = hab({ nombre: 'Correr', tipo: 'semana', veces: 3, aviso: '18:00', registro: reg(-2) })
  const t = textosGlobo({ dia: HOY, hora: '18:00' }, correr)
  assert.equal(plano(t.globo), '18:00 · Te toca Correr: llevás 1 de 3 esta semana.')
  assert.equal(t.hacer, 'Hecho')
  assert.equal(plano(t.muesca), '18:00 · Correr')
  assert.equal(plano(t.fila), '18:00 · Te toca Correr.')
  assert.deepEqual(t.notificacion, { titulo: 'Correr · 18:00', cuerpo: 'Llevás 1 de 3 esta semana.' })
})

test('textoHechoGlobo: cantidad «Listo: {v} de {meta} {unidad}.» (+ « ¡Meta del día!»); sí/no con la racha', () => {
  const agua = hab({ nombre: 'Agua', tipo: 'cantidad', meta: 8, unidad: 'vasos', registro: { [HOY]: 4 } })
  assert.equal(plano(textoHechoGlobo(agua, HOY)), 'Listo: 4 de 8 vasos.')
  assert.deepEqual(textoHechoGlobo(agua, HOY).filter(s => s.fuerte).map(s => s.t), ['4 de 8 vasos'])
  assert.equal(plano(textoHechoGlobo({ ...agua, registro: { [HOY]: 8 } }, HOY)), 'Listo: 8 de 8 vasos. ¡Meta del día!')
  // Sí/no: 6 seguidos + hoy = 7
  const caminar = hab({ nombre: 'Caminar', registro: reg(-6, -5, -4, -3, -2, -1, 0) })
  assert.equal(plano(textoHechoGlobo(caminar, HOY)), '¡Hecho! Caminar: 7 días seguidos.')
  assert.deepEqual(textoHechoGlobo(caminar, HOY).filter(s => s.fuerte).map(s => s.t), ['Caminar'])
  assert.equal(plano(textoHechoGlobo(hab({ nombre: 'Leer', registro: reg(0) }), HOY)), '¡Hecho! Leer: 1 día seguido.')
  // Por semana: en semanas
  const correr = hab({ nombre: 'Correr', tipo: 'semana', veces: 1, registro: reg(0) })
  assert.equal(plano(textoHechoGlobo(correr, HOY)), '¡Hecho! Correr: 1 semana seguida.')
})

// ------------------------------------------------------------------ el resumen semanal (H3: 8.4, 5.4 y 11.6)

// La semana resumida: del lunes 16/11 al domingo 22/11 (la anterior a la de HOY)
const L16 = '2026-11-16'
const d16 = n => new Date(Date.UTC(2026, 10, 16 + n)).toISOString().slice(0, 10)
/** Un registro de la semana del 16 con `v` (1 por defecto) en cada día pedido (0 = lunes 16). */
const reg16 = (ns, v = 1) => Object.fromEntries(ns.map(n => [d16(n), v]))
const CAMINAR = hab({ id: 'h-caminar', nombre: 'Caminar', tipo: 'diario', registro: reg16([0, 1, 2, 4, 5]) })
const AGUA16 = hab({ id: 'h-agua', nombre: 'Agua', tipo: 'cantidad', meta: 8, registro: { [d16(0)]: 8, [d16(1)]: 6, [d16(2)]: 8, [d16(3)]: 9 } })
const GYM16 = hab({ id: 'h-gym', nombre: 'Gimnasio', tipo: 'dias', dias: [0, 2, 4], registro: reg16([0, 2]) })
const CORRER = hab({ id: 'h-correr', nombre: 'Correr', tipo: 'semana', veces: 3, registro: reg16([1, 3, 5, 6]) })

test('resumenDebido: domingo 17:59 no; domingo 18:00, el lunes de esta semana', () => {
  const habitos = [CAMINAR]
  assert.equal(resumenDebido({ hoy: '2026-11-29', horaAr: '17:59', guardado: '2026-11-16', habitos }), null)
  assert.equal(resumenDebido({ hoy: '2026-11-29', horaAr: '18:00', guardado: '2026-11-16', habitos }), '2026-11-23')
  assert.equal(resumenDebido({ hoy: '2026-11-29', horaAr: '23:59', guardado: '2026-11-16', habitos }), '2026-11-23')
})

test('resumenDebido: sin el resumen del domingo, el primer arranque de la semana siguiente (cualquier día) da el de la semana pasada', () => {
  const habitos = [CAMINAR]
  assert.equal(resumenDebido({ hoy: '2026-11-23', horaAr: '09:00', guardado: '2026-11-09', habitos }), L16)
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '12:00', guardado: null, habitos }), L16)
  assert.equal(resumenDebido({ hoy: '2026-11-28', horaAr: '22:00', guardado: '', habitos }), L16)
})

test('resumenDebido: ya guardado, no se repite; nunca uno de dos semanas atrás', () => {
  const habitos = [CAMINAR]
  assert.equal(resumenDebido({ hoy: '2026-11-23', horaAr: '09:00', guardado: L16, habitos }), null)
  // El del domingo 22 (visto el domingo a las 19) no vuelve el martes
  assert.equal(resumenDebido({ hoy: '2026-11-24', horaAr: '09:00', guardado: L16, habitos }), null)
  // Un miércoles de dos semanas después, el de la semana pasada (16/11 ya no: es de dos semanas atrás)
  assert.equal(resumenDebido({ hoy: '2026-12-02', horaAr: '09:00', guardado: '2026-11-09', habitos }), '2026-11-23')
  // Lo guardado que no es un lunes válido se toma como nada guardado
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '09:00', guardado: 'ayer', habitos }), L16)
})

test('resumenDebido: sin hábitos que tocaran esa semana, no hay resumen', () => {
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '09:00', guardado: null, habitos: [] }), null)
  // Creado el domingo de esa semana: no existía antes del domingo
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '09:00', guardado: null, habitos: [hab({ inicio: '2026-11-22' })] }), null)
  // Creado después: tampoco
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '09:00', guardado: null, habitos: [hab({ inicio: '2026-11-24' })] }), null)
  // Algunos días (lunes) creado el viernes: no le tocó ningún día de esa semana
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '09:00', guardado: null, habitos: [hab({ tipo: 'dias', dias: [0], inicio: '2026-11-20' })] }), null)
  // Creado el sábado, sí (le tocaron el sábado y el domingo)
  assert.equal(resumenDebido({ hoy: '2026-11-26', horaAr: '09:00', guardado: null, habitos: [hab({ inicio: '2026-11-21' })] }), L16)
})

test('resumenSemana: los números por hábito (cantidad: días con la meta; por semana: veces sobre veces)', () => {
  const r = resumenSemana([CAMINAR, AGUA16, GYM16, CORRER], L16)
  assert.equal(r.lunes, L16)
  assert.deepEqual(r.habitos.map(({ id, nombre, tipo, hechos, tocaban }) => ({ id, nombre, tipo, hechos, tocaban })), [
    { id: 'h-caminar', nombre: 'Caminar', tipo: 'diario', hechos: 5, tocaban: 7 },
    { id: 'h-agua', nombre: 'Agua', tipo: 'cantidad', hechos: 3, tocaban: 7 },
    { id: 'h-gym', nombre: 'Gimnasio', tipo: 'dias', hechos: 2, tocaban: 3 },
    // 4 veces sobre 3: con el tope de `veces`, como pctSemana
    { id: 'h-correr', nombre: 'Correr', tipo: 'semana', hechos: 3, tocaban: 3 },
  ])
})

test('resumenSemana: un hábito creado el jueves cuenta desde el jueves; los que no tocaron no van', () => {
  const nuevo = hab({ id: 'h-leer', nombre: 'Leer', inicio: '2026-11-19', registro: reg16([3, 4]) })
  const despues = hab({ id: 'h-tarde', nombre: 'Tarde', inicio: '2026-11-25' })
  const r = resumenSemana([nuevo, despues], L16)
  assert.deepEqual(r.habitos.map(h => [h.id, h.hechos, h.tocaban]), [['h-leer', 2, 4]])
})

test('resumenSemana: las 7 fracciones de lo que tocaba que se hizo, de lunes a domingo', () => {
  // Lunes: los dos hechos (2/2); martes: a (1/1); miércoles: g tocaba y a no (0/2); jueves a domingo: 0/1.
  // Por semana suma solo el día que se hizo (1/1)
  const a = hab({ id: 'h-a', registro: reg16([0, 1]) })
  const g = hab({ id: 'h-g', tipo: 'dias', dias: [0, 2], registro: reg16([0]) })
  assert.deepEqual(resumenSemana([a, g], L16).dias, [1, 1, 0, 0, 0, 0, 0])
  const s = hab({ id: 'h-s', tipo: 'semana', veces: 2, registro: reg16([1]) })
  assert.deepEqual(resumenSemana([s], L16).dias, [0, 1, 0, 0, 0, 0, 0])
  assert.deepEqual(resumenSemana([a, s], L16).dias, [1, 1, 0, 0, 0, 0, 0])
  // Cantidad: con la meta
  assert.deepEqual(resumenSemana([AGUA16], L16).dias, [1, 0, 1, 1, 0, 0, 0])
  // Mitad: un día con uno de dos
  assert.deepEqual(resumenSemana([a, hab({ id: 'h-b', registro: {} })], L16).dias, [0.5, 0.5, 0, 0, 0, 0, 0])
  // Las barras: alto 26 × fracción, mínimo 3
  assert.equal(altoBarra(1), 26)
  assert.equal(altoBarra(0.5), 13)
  assert.equal(altoBarra(0), 3)
  assert.equal(altoBarra(0.05), 3)
})

test('plantillaResumen: hasta 3 hábitos ordenados por cumplimiento, con las formas de cantidad y por semana', () => {
  const r = resumenSemana([CAMINAR, AGUA16, GYM16, CORRER], L16)
  // Correr 3/3 (1), Caminar 5/7 (.71), Gimnasio 2/3 (.67); Agua 3/7 (.43) queda afuera
  assert.equal(plantillaResumen(r), 'Esta semana: Correr 3 de 3 veces · Caminar 5 de 7 días · Gimnasio 2 de 3 días')
  assert.equal(plantillaResumen(resumenSemana([AGUA16], L16)), 'Esta semana: Agua 3 de 7 días con la meta')
})

test('fraseValida: una línea, de 1 a 160 caracteres, y cada número tiene que estar en los datos', () => {
  const r = resumenSemana([CAMINAR, AGUA16, GYM16, CORRER], L16)
  assert.equal(fraseValida('Caminaste 5 de 7 días y el gimnasio salió completo.', r), true)
  assert.equal(fraseValida('  Correr: 3 de 3 veces. Muy bien.  ', r), true)
  assert.equal(fraseValida('Sin números también vale.', r), true)
  // Un número que no está en los datos
  assert.equal(fraseValida('Cumpliste el 80 % de lo que tocaba.', r), false)
  assert.equal(fraseValida('Caminaste 6 de 7 días.', r), false)
  // Más de una línea, vacía o larga
  assert.equal(fraseValida('Caminaste 5 de 7 días.\nBien.', r), false)
  assert.equal(fraseValida('   ', r), false)
  assert.equal(fraseValida('a'.repeat(160), r), true)
  assert.equal(fraseValida('a'.repeat(161), r), false)
  assert.equal(fraseValida(null, r), false)
  assert.equal(fraseValida(42, r), false)
})

test('fraseValida: los números de los nombres de los hábitos también son datos («Tomar 8 vasos»)', () => {
  const tomar = hab({ id: 'h-t', nombre: 'Tomar 8 vasos', tipo: 'cantidad', meta: 8, registro: { [d16(0)]: 8, [d16(1)]: 8 } })
  const r = resumenSemana([tomar], L16)
  assert.equal(fraseValida('Tomar 8 vasos salió 2 de 7 días.', r), true)
  assert.equal(fraseValida('Tomar 9 vasos salió 2 de 7 días.', r), false)
})

test('fraseCorta (5.4): la primera parte hasta 34 caracteres; si no entra, «{nombre} {k} de {t}» del mejor', () => {
  const r = resumenSemana([CAMINAR, AGUA16, GYM16, CORRER], L16)
  assert.equal(fraseCorta('Caminaste 5 de 7 días. El agua quedó corta.', r), 'Caminaste 5 de 7 días')
  assert.equal(fraseCorta('Caminaste 5 de 7 días, y el gimnasio salió completo.', r), 'Caminaste 5 de 7 días')
  assert.equal(fraseCorta('Esta semana salió redonda en casi todo lo que te propusiste.', r), 'Correr 3 de 3')
  // La plantilla: siempre la del mejor (su primera parte repite «semana»)
  assert.equal(fraseCorta(plantillaResumen(r), r, { plantilla: true }), 'Correr 3 de 3')
})

test('textosResumen (5.4): el kicker, la frase con los números en negrita, la muesca, la fila y la ×', () => {
  const r = resumenSemana([CAMINAR, AGUA16, GYM16, CORRER], L16)
  const t = textosResumen(r, 'Caminaste 5 de 7 días. El agua quedó corta.')
  assert.equal(t.kicker, 'Tu semana · 16/11 al 22/11')
  assert.equal(plano(t.globo), 'Caminaste 5 de 7 días. El agua quedó corta.')
  assert.deepEqual(t.globo.filter(s => s.fuerte).map(s => s.t), ['5 de 7'])
  assert.equal(plano(t.muesca), 'Tu semana: Caminaste 5 de 7 días')
  assert.equal(plano(t.fila), 'Tu semana: Caminaste 5 de 7 días')
  assert.equal(t.ver, 'Ver →')
  assert.equal(t.charlemos, 'Charlemos la semana →')
  assert.equal(t.charlemosFila, 'Charlemos →')
  assert.deepEqual(t.x, { nombre: 'Más tarde: lo dejo para la semana que viene', titulo: 'Más tarde' })
  assert.equal(t.texto, 'Tu semana · 16/11 al 22/11. Caminaste 5 de 7 días. El agua quedó corta.')
  assert.deepEqual(t.barras.map(b => b.letra), ['L', 'M', 'M', 'J', 'V', 'S', 'D'])
  assert.deepEqual(t.barras.map(b => b.alto), r.dias.map(altoBarra))
})

test('la charla del resumen (8.4): título «Tu semana · {d/m} al {d/m}», la frase y la lista con los números', () => {
  const r = resumenSemana([CAMINAR, AGUA16, CORRER], L16)
  assert.equal(tituloSemana(L16), 'Tu semana · 16/11 al 22/11')
  assert.equal(mensajeSemana(r, 'Caminaste 5 de 7 días.'),
    'Caminaste 5 de 7 días.\n\n- Caminar: 5 de 7 días\n- Agua: 3 de 7 días con la meta\n- Correr: 3 de 3 veces')
  // Lo que viaja a habitos_frase: solo nombre, tipo y números
  assert.deepEqual(datosFrase(r), { habitos: [
    { nombre: 'Caminar', tipo: 'diario', hechos: 5, tocaban: 7 },
    { nombre: 'Agua', tipo: 'cantidad', hechos: 3, tocaban: 7 },
    { nombre: 'Correr', tipo: 'semana', hechos: 3, tocaban: 3 },
  ] })
})

test('resumenGuardadoValido (habitosResumen, 11.5): un día que existe y es lunes, o vacío; como preferencias.rs', () => {
  for (const bueno of ['2026-11-23', '2024-01-01', '']) assert.equal(resumenGuardadoValido(bueno), true, bueno)
  for (const malo of ['2026-11-24', '2026-11-29', '2026-02-30', '23/11/2026', '2026-11-23T00:00', null, 20261123, {}, true]) {
    assert.equal(resumenGuardadoValido(malo), false, String(malo))
  }
})

test('fraseGuardadaValida (habitosFrase, 8.4): { lunes, frase } con un lunes que existe y una frase de una línea de 0 a 160; como preferencias.rs', () => {
  for (const bueno of [{ lunes: '2026-11-23', frase: 'Bien.' }, { lunes: '2026-11-23', frase: '' }, { lunes: '2024-01-01', frase: 'a'.repeat(160) }]) {
    assert.equal(fraseGuardadaValida(bueno), true, JSON.stringify(bueno))
  }
  for (const malo of [
    { lunes: '2026-11-24', frase: 'Bien.' }, { lunes: '', frase: 'Bien.' }, { lunes: '2026-02-30', frase: '' }, { lunes: '2026-11-23', frase: 'a\nb' },
    { lunes: '2026-11-23', frase: 'a\rb' }, { lunes: '2026-11-23', frase: 'a'.repeat(161) }, { lunes: '2026-11-23', frase: 5 }, { lunes: '2026-11-23' },
    { frase: '' }, { lunes: '2026-11-23', frase: '', otra: 1 }, '2026-11-23', null, true, [],
  ]) {
    assert.equal(fraseGuardadaValida(malo), false, JSON.stringify(malo))
  }
})

test('fraseGuardada (8.4, una vez por semana entre arranques): la frase guardada de ese lunes, sin volver a pedirla; otra semana, null', () => {
  // Reinicio con el globo sin ver: la misma frase, cero pedidos al motor
  assert.equal(fraseGuardada({ lunes: L16, frase: 'Caminaste 5 de 7 días.' }, L16), 'Caminaste 5 de 7 días.')
  // El pedido había fallado: "" (va la plantilla), y tampoco se vuelve a pedir
  assert.equal(fraseGuardada({ lunes: L16, frase: '' }, L16), '')
  // Semana nueva: se pide de nuevo
  assert.equal(fraseGuardada({ lunes: L16, frase: 'Bien.' }, '2026-11-23'), null)
  assert.equal(fraseGuardada(null, L16), null)
  assert.equal(fraseGuardada({ lunes: L16, frase: 'a\nb' }, L16), null)
})

// ---------------------------------------------------------------- #43 C3: dos escritores (chat-herramientas-ux.md 11.5)

import { rebasarHabito } from '../src/habitos.js'
import { readFileSync } from 'node:fs'

test('rebasarHabito: sin cambios en la ventana, queda lo del disco (lo que marcó la charla)', () => {
  const base = hab({ tipo: 'cantidad', registro: { [HOY]: 2 } })
  const disco = hab({ tipo: 'cantidad', registro: { [HOY]: 3 } })
  assert.deepEqual(rebasarHabito(base, structuredClone(base), disco), disco)
})

test('rebasarHabito: la ventana cambió el nombre y la charla marcó hoy: quedan los dos', () => {
  const base = hab({ tipo: 'cantidad', registro: { [dia(-1)]: 8, [HOY]: 2 } })
  const pantalla = { ...base, nombre: 'Tomar agua' }
  const disco = { ...base, registro: { [dia(-1)]: 8, [HOY]: 3 } }
  assert.deepEqual(rebasarHabito(base, pantalla, disco), { ...base, nombre: 'Tomar agua', registro: { [dia(-1)]: 8, [HOY]: 3 } })
})

test('rebasarHabito: si los dos cambiaron el mismo día, gana la ventana (es el último clic del usuario); los otros días, el disco', () => {
  const base = hab({ tipo: 'cantidad', registro: { [dia(-2)]: 5, [dia(-1)]: 4, [HOY]: 2 } })
  // La ventana: +1 hoy y corrigió anteayer a sin hacer (sin la clave); la charla: +1 hoy (3)
  const pantalla = { ...base, registro: { [dia(-1)]: 4, [HOY]: 3 } }
  const disco = { ...base, registro: { [dia(-2)]: 5, [dia(-1)]: 4, [HOY]: 3 } }
  assert.deepEqual(rebasarHabito(base, pantalla, disco).registro, { [dia(-1)]: 4, [HOY]: 3 })
  // La ventana desmarcó hoy y la charla lo había puesto en 3: queda desmarcado
  assert.deepEqual(rebasarHabito(base, { ...base, registro: { [dia(-2)]: 5, [dia(-1)]: 4 } }, disco).registro, { [dia(-2)]: 5, [dia(-1)]: 4 })
  // Un día que solo cambió la charla queda como lo dejó (también si lo sacó)
  const sinAyer = { ...base, registro: { [dia(-2)]: 5, [HOY]: 2 } }
  assert.deepEqual(rebasarHabito(base, { ...base, nombre: 'Agua' }, sinAyer).registro, { [dia(-2)]: 5, [HOY]: 2 })
})

test('rebasarHabito: los campos desconocidos sobreviven (los del disco y los que cambió la ventana)', () => {
  const base = hab({ icono: 'gota', extra: { a: 1, b: 2 } })
  const disco = { ...base, icono: 'vaso', registro: { [HOY]: 1 } }
  // Otro orden de claves no es un cambio de la ventana
  const r = rebasarHabito(base, { ...base, extra: { b: 2, a: 1 } }, disco)
  assert.equal(r.icono, 'vaso')
  assert.deepEqual(r.extra, { a: 1, b: 2 })
  assert.deepEqual(r.registro, { [HOY]: 1 })
  assert.equal(rebasarHabito(base, { ...base, icono: 'taza' }, disco).icono, 'taza')
})

test('rebasarHabito: sin base o sin disco, lo de la pantalla (como antes)', () => {
  const pantalla = hab({ nombre: 'Agua' })
  assert.equal(rebasarHabito(null, pantalla, hab()), pantalla)
  assert.equal(rebasarHabito(hab(), pantalla, null), pantalla)
})

test('guardarHabito (main.js) guarda con la huella de su base y, con «cambio», relee, vuelve a aplicar una vez y guarda', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const cuerpo = main.slice(main.indexOf('function guardarHabito('), main.indexOf('function ponerErrorGuardarHabitos('))
  assert.match(cuerpo, /invocar\('habitos_guardar', \{ habito, huella: basesHabitos\.get\(id\)\?\.huella \?\? null \}\)/)
  assert.match(cuerpo, /r\?\.error === 'cambio' && !rebasado/)
  assert.match(cuerpo, /await rebasarHabitoEnPantalla\(id\)/)
  assert.match(cuerpo, /anotarBaseHabito\(r\.habito, r\.huella\)/)
  // Lo leído pone la base al día (salvo lo que no se pisa con lo leído) y el rebase usa la función pura
  assert.match(main, /rebasarHabito\(basesHabitos\.get\(id\)\?\.habito, pantalla, disco\)/)
  const leer = main.slice(main.indexOf('function leerHabitos('), main.indexOf('function alCambiarHabitosFuera('))
  assert.match(leer, /anotarBaseHabito\(/)
})
