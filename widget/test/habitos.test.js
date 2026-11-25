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
} from '../src/habitos.js'

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
