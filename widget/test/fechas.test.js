// Tests de fechas.js (docs/diseno/tareas-ux.md 11.2 y habitos-ux.md 11.2): el día y la hora de
// Argentina, compartidos por la configuración, las tareas y los hábitos. Puros: se prueban en node.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hoyArgentina, diaArgentina, sumarDias, diasEntre, diaSemana, lunesDe, horaArgentina } from '../src/fechas.js'
import { horaGlobo } from '../src/tareas.js'

test('diaSemana: lunes = 0 … domingo = 6 (el 1/1/1970 fue jueves)', () => {
  assert.equal(diaSemana('1970-01-01'), 3)
  assert.equal(diaSemana('2026-11-23'), 0)
  assert.equal(diaSemana('2026-11-26'), 3)
  assert.equal(diaSemana('2026-11-29'), 6)
  assert.equal(diaSemana('2026-11-30'), 0)
  // Antes de 1970 también (el número de día es negativo)
  assert.equal(diaSemana('1969-12-31'), 2)
})

test('lunesDe: el lunes de la semana de un día (la semana va de lunes a domingo, D-h3)', () => {
  assert.equal(lunesDe('2026-11-26'), '2026-11-23')
  assert.equal(lunesDe('2026-11-23'), '2026-11-23')
  assert.equal(lunesDe('2026-11-29'), '2026-11-23')
  assert.equal(lunesDe('2026-11-30'), '2026-11-30')
  // Cruza el mes y el año
  assert.equal(lunesDe('2027-01-01'), '2026-12-28')
})

test('horaArgentina: "HH:MM" en UTC−3, sin depender de la zona de la PC', () => {
  assert.equal(horaArgentina(Date.UTC(2026, 10, 24, 15, 59)), '12:59')
  assert.equal(horaArgentina(Date.UTC(2026, 10, 25, 2, 5)), '23:05')
  assert.equal(horaArgentina(Date.UTC(2026, 10, 25, 3, 0)), '00:00')
})

test('horaGlobo de tareas.js sigue igual: es horaArgentina, reexportada (11.2)', () => {
  assert.equal(horaGlobo, horaArgentina)
  assert.equal(horaGlobo(Date.UTC(2026, 10, 24, 15, 59)), '12:59')
})

test('lo de antes sigue igual: hoyArgentina, diaArgentina, sumarDias y diasEntre', () => {
  const ms = Date.UTC(2026, 10, 25, 2, 59)
  assert.equal(hoyArgentina(ms), '2026-11-24')
  assert.equal(hoyArgentina(ms + 60000), '2026-11-25')
  assert.equal(diaArgentina(Date.UTC(1970, 0, 1, 3)), 0)
  assert.equal(sumarDias('2026-11-30', 1), '2026-12-01')
  assert.equal(sumarDias('2026-11-01', -1), '2026-10-31')
  assert.equal(diasEntre('2026-11-23', '2026-11-26'), -3)
})
