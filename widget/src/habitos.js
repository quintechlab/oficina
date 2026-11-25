// Hábitos (#41, docs/diseno/habitos-ux.md, opción B "Carpeta"): la lógica pura de la hoja. Los cuatro
// tipos (11.3), la racha (11.4), las celdas de la semana (4.8), el porcentaje de la semana, cambiar de
// tipo (11.1), el formulario (4.11 y 5.1), Esc por capas (9.1), Ctrl H (9.2), el estado de la hoja (3.5)
// y los textos de la sección 5. Cada cambio devuelve un hábito nuevo y nunca toca el de antes.
// El formato es el v1 de habitos.rs (11.1): `creado` en ms, `inicio` y las claves de `registro`
// "AAAA-MM-DD" (días de Argentina), lunes = 0 … domingo = 6 en `dias`. Sin DOM: lo dibuja habitosVista.js,
// lo mueve habitosMotion.js y lo conecta main.js (que guarda con `habitos_guardar`).
// Entrega H1: los datos y la hoja. Entrega H2: el recordatorio (cuándo se debe, cuándo se va y sus
// textos); la cola de globos es globos.js. El resumen semanal (H3) no está.

import { sumarDias, diaSemana, lunesDe, hoyArgentina, diaArgentina, MS_DIA, DESFASE_AR } from './fechas.js'
import { COLORES, colorDe, colorSiguiente, fechaCorta, claveNombre } from './tareas.js'

export const TIPOS = ['diario', 'cantidad', 'dias', 'semana']
/** Los días de la semana (5.1), de lunes a domingo. */
export const DIAS_CORTOS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
export const LETRAS_DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
/** Los rótulos del tipo en el formulario (4.11). */
export const NOMBRES_TIPO = [['diario', 'Todos los días'], ['cantidad', 'Cantidad'], ['dias', 'Algunos días'], ['semana', 'Por semana']]
/** Los colores (6.1): los de las listas, con el nombre para el lector. */
export { COLORES }
export const NOMBRES_COLOR = { celeste: 'Celeste', verde: 'Verde', rosa: 'Rosa', violeta: 'Violeta', ambar: 'Ámbar', rojo: 'Rojo' }

/** Los topes y rangos de 11.1, los mismos de habitos.rs: la ventana no deja pasarlos. */
export const MAX_NOMBRE = 40
export const MAX_UNIDAD = 16
export const MAX_CANTIDAD = 999
export const RANGO = { meta: [1, 99], veces: [1, 6] }
/** La hora del aviso al prenderlo (4.11). El recordatorio en sí es H2: acá solo se guarda. */
export const AVISO_POR_DEFECTO = '09:00'
/** Los hitos de la racha (4.14). */
export const HITOS = [7, 30, 100]

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const recortar = (s, max) => [...String(s ?? '').trim()].slice(0, max).join('')
const limitar = (n, [lo, hi]) => Math.max(lo, Math.min(hi, Math.round(Number(n) || lo)))
/** El día del mes y el mes de un "AAAA-MM-DD": "26/11". */
const diaMes = dia => `${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`
const inicioDe = (h, hoy) => (typeof h.inicio === 'string' ? h.inicio : hoy)

// ------------------------------------------------------------------ reglas de cada tipo (11.3)

/** Lo anotado un día (0 si nada). */
export const valor = (h, dia) => Number(h.registro?.[dia] ?? 0) || 0

/** ¿Toca ese día? Todos, salvo los de "algunos días", que tocan solo los suyos. */
export function toca(h, dia) {
  return h.tipo !== 'dias' || (h.dias ?? []).includes(diaSemana(dia))
}

/** ¿Hecho ese día? Cantidad, con la meta (la actual, D-h8); los demás, con 1. Antes de `inicio`, nunca. */
export function hecho(h, dia) {
  if (typeof h.inicio === 'string' && dia < h.inicio) return false
  return h.tipo === 'cantidad' ? valor(h, dia) >= (h.meta ?? 1) : valor(h, dia) >= 1
}

/** Las veces que se hizo en la semana del `lunes` (por semana), desde `inicio`. */
export function hechosSemana(h, lunes) {
  let n = 0
  for (let i = 0; i < 7; i++) if (hecho(h, sumarDias(lunes, i))) n++
  return n
}

/** ¿La semana de `dia` ya llegó a `veces`? (solo por semana) */
export const semanaCumplida = (h, dia) => h.tipo === 'semana' && hechosSemana(h, lunesDe(dia)) >= (h.veces ?? 1)

/** ¿Va en Hoy? Algunos días, si toca; por semana, si la semana no está cumplida o ya se marcó hoy. */
export function deHoy(h, hoy) {
  if (h.tipo === 'dias') return toca(h, hoy)
  if (h.tipo === 'semana') return !semanaCumplida(h, hoy) || hecho(h, hoy)
  return true
}

// ------------------------------------------------------------------ racha (11.4)

/** Lo calculado por hábito y día (los hábitos no cambian: cada cambio es un objeto nuevo). */
const memo = new WeakMap()
function calculado(h, hoy, clave, f) {
  let m = memo.get(h)
  if (!m || m.hoy !== hoy) { m = { hoy }; memo.set(h, m) }
  if (!(clave in m)) m[clave] = f()
  return m[clave]
}

function rachaDias(h, hoy) {
  const inicio = inicioDe(h, hoy)
  let n = 0
  for (let d = sumarDias(hoy, -1); d >= inicio; d = sumarDias(d, -1)) {
    if (!toca(h, d)) continue
    if (hecho(h, d)) n++
    else break
  }
  return n + (toca(h, hoy) && hecho(h, hoy) ? 1 : 0)
}

function rachaSemanas(h, hoy) {
  const veces = h.veces ?? 1
  const lunesHoy = lunesDe(hoy)
  const lunesIni = lunesDe(inicioDe(h, hoy))
  let n = 0
  // La semana de inicio cuenta si llegó; si no, no corta (es la primera: la cuenta termina ahí igual)
  for (let l = sumarDias(lunesHoy, -7); l >= lunesIni; l = sumarDias(l, -7)) {
    if (hechosSemana(h, l) >= veces) n++
    else break
  }
  return n + (hechosSemana(h, lunesHoy) >= veces ? 1 : 0)
}

/**
 * La racha (11.4): en días (diario, cantidad, algunos días) desde ayer hacia atrás, saltando los días
 * que no tocan y los anteriores a `inicio`, más 1 si hoy ya está hecho (hoy sin hacer no corta); en
 * semanas (por semana) desde la pasada, más 1 si esta ya llegó (esta sin llegar no corta).
 */
export function racha(h, hoy) {
  return calculado(h, hoy, 'racha', () => (h.tipo === 'semana' ? rachaSemanas(h, hoy) : rachaDias(h, hoy)))
}

/** La racha más larga del registro: días seguidos que tocaban (hoy sin hacer no corta) o semanas que llegaron. */
function masLarga(h, hoy) {
  const inicio = inicioDe(h, hoy)
  let mejor = 0, n = 0
  if (h.tipo === 'semana') {
    const lunesIni = lunesDe(inicio), lunesHoy = lunesDe(hoy)
    for (let l = lunesIni; l <= lunesHoy; l = sumarDias(l, 7)) {
      if (hechosSemana(h, l) >= (h.veces ?? 1)) mejor = Math.max(mejor, ++n)
      else if (l !== lunesIni && l !== lunesHoy) n = 0
    }
    return mejor
  }
  for (let d = inicio; d <= hoy; d = sumarDias(d, 1)) {
    if (!toca(h, d)) continue
    if (hecho(h, d)) mejor = Math.max(mejor, ++n)
    else if (d !== hoy) n = 0
  }
  return mejor
}

/** La mejor racha (11.4): el máximo entre el `mejor` guardado (sobrevive al recorte del registro), la más larga y la actual. */
export function mejorRacha(h, hoy) {
  return calculado(h, hoy, 'mejor', () => Math.max(h.mejor ?? 0, masLarga(h, hoy), racha(h, hoy)))
}

/** Si la racha actual supera el `mejor` guardado, el hábito con el nuevo; si no, el mismo objeto. */
export function conMejor(h, hoy) {
  const r = racha(h, hoy)
  return r > (h.mejor ?? 0) ? { ...h, mejor: r } : h
}

/** El hito que se acaba de alcanzar (7, 30 o 100) al pasar de `antes` a `despues`, o null. */
export function hitoNuevo(antes, despues) {
  return despues > antes && HITOS.includes(despues) ? despues : null
}

/** 0 sin racha; 1 de 1 a 6; 2 de 7 a 29; 3 de 30 en adelante (4.7). */
export const nivelRacha = n => (n >= 30 ? 3 : n >= 7 ? 2 : n >= 1 ? 1 : 0)

const unidadRacha = (h, n) => (h.tipo === 'semana' ? (n === 1 ? 'semana' : 'semanas') : (n === 1 ? 'día' : 'días'))

/** La racha en palabras (5.1): «{n} días», «{n} semanas», «sin racha»; corta (el índice), solo el número. */
export function textoRacha(h, n, { corta = false } = {}) {
  if (corta) return String(n)
  return n ? `${n} ${unidadRacha(h, n)}` : 'sin racha'
}

/** Al lado del número grande de la racha (4.10): «días seguidos», «semanas seguidas» (con 1, en singular) o «sin racha todavía». */
export function textoRachaGrande(h, n) {
  if (!n) return 'sin racha todavía'
  const s = n === 1 ? '' : 's'
  return h.tipo === 'semana' ? `${unidadRacha(h, n)} seguida${s}` : `${unidadRacha(h, n)} seguido${s}`
}

/** «desde el {d/m}» (4.10): el día de Argentina de un instante en ms. */
export const desdeEl = ms => diaMes(hoyArgentina(ms))

/** El texto del hito (5.1). */
export function textoHito(h, n) {
  if (h.tipo === 'semana') return `${h.nombre}: ¡${n} semanas seguidas!`
  return n === 7 ? `${h.nombre}: ¡una semana seguida!` : `${h.nombre}: ¡${n} días seguidos!`
}

// ------------------------------------------------------------------ celdas (4.8)

/**
 * El estado de una celda (4.8): `antes` (de crearlo), `futuro` (por venir), `libre` (no toca), `hecho`,
 * `parcial` (cantidad en parte), `pend` (hoy sin hacer), `falta` (no se hizo) o `nada` (por semana: sin salida).
 */
export function estadoCelda(h, dia, hoy) {
  if (dia < inicioDe(h, hoy)) return 'antes'
  if (dia > hoy) return toca(h, dia) ? 'futuro' : 'libre'
  if (!toca(h, dia)) return 'libre'
  if (h.tipo === 'semana') return valor(h, dia) >= 1 ? 'hecho' : dia === hoy ? 'pend' : 'nada'
  if (hecho(h, dia)) return 'hecho'
  if (h.tipo === 'cantidad' && valor(h, dia) > 0) return 'parcial'
  return dia === hoy ? 'pend' : 'falta'
}

/** El nombre de una celda (4.8): «jue 26 (hoy): falta», «lun 23: 8 de 8, cumplido»… */
export function textoCelda(h, dia, hoy) {
  const e = estadoCelda(h, dia, hoy)
  const v = valor(h, dia)
  const cantidad = h.tipo === 'cantidad'
  const t = {
    hecho: cantidad ? `${v} de ${h.meta}, cumplido` : 'hecho',
    parcial: `${v} de ${h.meta}`,
    falta: 'no se hizo',
    pend: cantidad && v ? `${v} de ${h.meta}` : 'falta',
    libre: 'no toca',
    nada: 'sin salida',
    futuro: 'por venir',
    antes: 'antes de crearlo',
  }[e]
  return `${DIAS_CORTOS[diaSemana(dia)]} ${Number(dia.slice(8, 10))}${dia === hoy ? ' (hoy)' : ''}: ${t}`
}

/** ¿Se puede corregir ese día en la Semana? (4.8, D-h4) Días de esta semana hasta hoy que tocan, desde `inicio`; nunca la cantidad. */
export function corregible(h, dia, hoy) {
  if (h.tipo === 'cantidad') return false
  return dia >= lunesDe(hoy) && dia <= hoy && dia >= inicioDe(h, hoy) && toca(h, dia)
}

/** Alterna hecho/no hecho un día que se puede corregir; si no, null. */
export function corregir(h, dia, hoy) {
  if (!corregible(h, dia, hoy)) return null
  return marcar(h, dia, valor(h, dia) < 1)
}

/** Las últimas 5 semanas (4.10), de lunes a domingo y terminando en esta: `{ filas: [[{ dia, estado }×7]×5], hechos }`. */
export function ultimasSemanas(h, hoy) {
  const primero = sumarDias(lunesDe(hoy), -28)
  const filas = []
  let hechos = 0
  for (let w = 0; w < 5; w++) {
    const fila = []
    for (let i = 0; i < 7; i++) {
      const dia = sumarDias(primero, w * 7 + i)
      const estado = estadoCelda(h, dia, hoy)
      if (estado === 'hecho') hechos++
      fila.push({ dia, estado, p: h.tipo === 'cantidad' ? Math.min(100, Math.round((valor(h, dia) / (h.meta || 1)) * 100)) : 0 })
    }
    filas.push(fila)
  }
  return { filas, hechos }
}

// ------------------------------------------------------------------ la semana y hoy (4.3, 11.4)

/**
 * Lo hecho sobre lo que tocaba en la semana del `lunes`, de lunes hasta hoy (11.4): hoy cuenta solo si
 * está hecho; por semana suma `min(hechos, veces)` sobre `veces`. En % redondeado; sin nada, 0.
 */
export function pctSemana(habitos, lunes, hoy) {
  let si = 0, total = 0
  const domingo = sumarDias(lunes, 6)
  for (const h of habitos) {
    if (h.tipo === 'semana') {
      if (inicioDe(h, hoy) > domingo) continue
      total += h.veces ?? 1
      si += Math.min(hechosSemana(h, lunes), h.veces ?? 1)
      continue
    }
    for (let d = lunes; d <= hoy && d <= domingo; d = sumarDias(d, 1)) {
      if (d < inicioDe(h, hoy) || !toca(h, d)) continue
      if (d < hoy || hecho(h, d)) {
        total++
        if (hecho(h, d)) si++
      }
    }
  }
  return total ? Math.round((si / total) * 100) : 0
}

/** «23/11 al 29/11» (4.3). */
export const rangoSemana = lunes => `${diaMes(lunes)} al ${diaMes(sumarDias(lunes, 6))}`

/** El encabezado de Semana (4.3): «{d}/{m} al {d}/{m} · {p} % de lo que tocaba». */
export const cabeceraSemana = (lunes, pct) => `${rangoSemana(lunes)} · ${pct} % de lo que tocaba`

/** Lo de hoy (4.1): `{ hechos, total, habitos }` (total: los que van en Hoy; habitos: todos). */
export function cuentasHoy(habitos, hoy) {
  const deHoyL = habitos.filter(h => deHoy(h, hoy))
  return { hechos: deHoyL.filter(h => hecho(h, hoy)).length, total: deHoyL.length, habitos: habitos.length }
}

/** El nombre accesible de la fila del menú (4.1). */
export function nombreFilaHabitos(c) {
  const t = c?.total ?? 0, h = c?.hechos ?? 0
  if (t) return h >= t ? `Hábitos, los ${t} de hoy hechos` : `Hábitos, ${h} de ${t} hechos hoy`
  return c?.habitos ? 'Hábitos, hoy no toca ninguno' : 'Hábitos'
}

/** La bajada del encabezado (5.1). */
export function subtituloHabitos(c, hoy) {
  if (!c?.habitos) return 'Se guardan en esta PC'
  const f = fechaCorta(hoy)
  if (!c.total) return `${f} · hoy no toca ninguno`
  return c.hechos >= c.total ? `${f} · día completo` : `${f} · ${c.hechos} de ${c.total} hechos hoy`
}

/** Debajo del `h2` de Hoy (4.3): el texto y si el día está completo (ámbar, con la barra llena). */
export function resumenHoy(c) {
  if (!c?.total) return { texto: 'hoy no toca ninguno', completo: false }
  if (c.hechos >= c.total) return { texto: '¡Día completo!', completo: true }
  return { texto: `hoy · ${c.hechos} de ${c.total} hechos`, completo: false }
}

/** «lun, mié y vie» (5.1). */
export function listaDias(dias) {
  const n = [...(dias ?? [])].sort((a, b) => a - b).map(i => DIAS_CORTOS[i])
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} y ${n.at(-1)}`
}

const listaNombres = ns => (ns.length <= 1 ? (ns[0] ?? '') : `${ns.slice(0, -1).join(', ')} y ${ns.at(-1)}`)

/** El próximo día que toca, después de hoy: «vie». */
function proximoDia(h, hoy) {
  for (let i = 1; i <= 7; i++) {
    const d = sumarDias(hoy, i)
    if (toca(h, d)) return DIAS_CORTOS[diaSemana(d)]
  }
  return ''
}

/** El rótulo del tipo en la fila de Hoy (5.1). */
export function rotuloTipo(h, hoy) {
  if (h.tipo === 'cantidad') return `${valor(h, hoy)} de ${h.meta} ${h.unidad ?? ''}`.trim()
  if (h.tipo === 'dias') return toca(h, hoy) ? listaDias(h.dias) : `hoy no toca · vuelve el ${proximoDia(h, hoy)}`
  if (h.tipo === 'semana') {
    const k = hechosSemana(h, lunesDe(hoy))
    return `${k >= (h.veces ?? 1) ? 'semana cumplida · ' : ''}${k} de ${h.veces} esta semana`
  }
  return 'todos los días'
}

/** Los que van mañana, para el vacío de Hoy (5.2): «Gimnasio y Natación». */
export function mananaHabitos(habitos, hoy) {
  const manana = sumarDias(hoy, 1)
  return listaNombres(habitos.filter(h => deHoy(h, manana)).map(h => h.nombre))
}

/** La unidad en singular (4.6): sin la «s» final; «veces» → «vez»; sin unidad, «vez». */
export function unidadSingular(u) {
  const s = String(u ?? '').trim()
  if (!s) return 'vez'
  if (/ces$/i.test(s)) return s.replace(/ces$/i, 'z')
  return s.replace(/s$/i, '')
}

/** El nombre del sumador (4.6). */
export function nombreSumador(h, hoy) {
  const v = valor(h, hoy)
  if (v >= h.meta) return `${h.nombre}: meta cumplida, ${v} de ${h.meta} ${h.unidad ?? ''}`.trim() + '. Sumar otro'
  return `Sumar 1 ${unidadSingular(h.unidad)} a ${h.nombre}. Van ${v} de ${h.meta}`
}

/** El «¿Borrar…? Sí» (4.12). */
export function textoBorrar(h, hoy) {
  const n = racha(h, hoy)
  return n ? `¿Borrar con su racha de ${n} ${unidadRacha(h, n)}? Sí` : '¿Borrar? Sí'
}

// ------------------------------------------------------------------ cambios de un hábito

/** Anota o borra un día (sí/no, algunos días, por semana): el registro guarda solo n > 0. */
export function marcar(h, dia, on) {
  const registro = { ...(h.registro ?? {}) }
  if (on) registro[dia] = 1
  else delete registro[dia]
  return { ...h, registro }
}

/** Suma `d` (±1) a un día de cantidad: no baja de 0 ni pasa de 999; puede pasar la meta (D-h16). */
export function sumar(h, dia, d) {
  const n = Math.max(0, Math.min(MAX_CANTIDAD, valor(h, dia) + d))
  const registro = { ...(h.registro ?? {}) }
  if (n) registro[dia] = n
  else delete registro[dia]
  return { ...h, registro }
}

/**
 * Cambia el tipo (11.1): a cantidad, cada día con 1 pasa a `meta`; de cantidad a otro, cada día con
 * `n ≥ meta` pasa a 1 y los demás se borran. Entre los demás tipos el registro queda.
 */
export function cambiarTipo(h, tipo) {
  if (!TIPOS.includes(tipo) || h.tipo === tipo) return h
  const meta = h.meta ?? 1
  let registro = h.registro
  if (registro && tipo === 'cantidad') {
    registro = Object.fromEntries(Object.entries(registro).map(([d, n]) => [d, n >= 1 ? meta : n]))
  } else if (registro && h.tipo === 'cantidad') {
    registro = Object.fromEntries(Object.entries(registro).filter(([, n]) => n >= meta).map(([d]) => [d, 1]))
  }
  return registro === undefined ? { ...h, tipo } : { ...h, tipo, registro }
}

/**
 * Un campo del formulario (4.11), para un hábito o el borrador: el tipo (`cambiarTipo`), la meta de 1 a
 * 99, las veces de 1 a 6, la unidad hasta 16, los días ordenados y sin repetir, el aviso y el color.
 */
export function editar(h, campo, v) {
  switch (campo) {
    case 'tipo': return cambiarTipo(h, v)
    case 'meta': case 'veces': return { ...h, [campo]: limitar(v, RANGO[campo]) }
    case 'unidad': return { ...h, unidad: recortar(v, MAX_UNIDAD) }
    case 'nombre': return { ...h, nombre: recortar(v, MAX_NOMBRE) }
    case 'dias': return { ...h, dias: [...new Set((v ?? []).map(Number))].filter(d => d >= 0 && d <= 6).sort((a, b) => a - b) }
    case 'aviso': return { ...h, aviso: v || null }
    case 'color': return { ...h, color: colorDe(v) }
    default: return h
  }
}

// ------------------------------------------------------------------ el formulario (4.11, 5.1)

/** El borrador de un hábito nuevo (4.11): «Todos los días», 8 «vasos», lun, mié y vie, 3 veces, sin aviso y el color siguiente. */
export function borradorNuevo(lista) {
  return { nombre: '', tipo: 'diario', meta: 8, unidad: 'vasos', dias: [0, 2, 4], veces: 3, aviso: null, color: colorSiguiente(lista) }
}

/**
 * Valida un hábito o el borrador (5.1): `{ ok: true, nombre }` sin espacios a los lados, o `{ ok: false,
 * error, campo }`. Repetido: el mismo nombre de otro, sin mayúsculas ni tildes (como las listas). Sin
 * días: «Elegí al menos un día.» al crear, «Tiene que quedar al menos un día.» al editar.
 */
export function validarHabito(b, habitos) {
  const nombre = String(b?.nombre ?? '').trim()
  if (!nombre) return { ok: false, error: 'Ponele un nombre.', campo: 'nombre' }
  const otro = habitos.find(x => x.id !== b.id && claveNombre(x.nombre) === claveNombre(nombre))
  if (otro) return { ok: false, error: `Ya hay un hábito «${otro.nombre}».`, campo: 'nombre' }
  if (b.tipo === 'dias' && !(b.dias ?? []).length) {
    const editando = b.id != null && habitos.some(x => x.id === b.id)
    return { ok: false, error: editando ? 'Tiene que quedar al menos un día.' : 'Elegí al menos un día.', campo: 'dias' }
  }
  return { ok: true, nombre: [...nombre].slice(0, MAX_NOMBRE).join('') }
}

/**
 * La frase del formulario (4.11, 5.1): `{ nombre, resto, texto }`; el nombre va en negrita en la vista.
 * Sin nombre, «Tu hábito». Cantidad sin unidad dice «veces», y algunos días sin días, «elegí los días»
 * (los dos del boceto aprobado).
 */
export function fraseFormulario(h) {
  const nombre = String(h.nombre ?? '').trim() || 'Tu hábito'
  const veces = h.veces ?? 1
  const tipo = {
    diario: 'todos los días',
    cantidad: `${h.meta} ${String(h.unidad ?? '').trim() || 'veces'} por día`,
    dias: listaDias(h.dias) || 'elegí los días',
    semana: `${veces} ${veces === 1 ? 'vez' : 'veces'} por semana, cualquier día`,
  }[h.tipo] ?? 'todos los días'
  const resto = ` · ${tipo} · ${h.aviso ? `te aviso a las ${h.aviso}` : 'sin aviso'}`
  return { nombre, resto, texto: nombre + resto }
}

/** Un hábito nuevo en el formato v1 (11.1), al final del orden, con `inicio` hoy y el registro vacío. */
export function nuevoHabito(b, { id, ahora, hoy, lista }) {
  const orden = lista.length ? Math.max(...lista.map(h => h.orden ?? 0)) + 1 : 0
  return {
    v: 1, id, nombre: recortar(b.nombre, MAX_NOMBRE), tipo: TIPOS.includes(b.tipo) ? b.tipo : 'diario',
    meta: limitar(b.meta ?? 8, RANGO.meta), unidad: recortar(b.unidad, MAX_UNIDAD), dias: editar(b, 'dias', b.dias ?? [0, 2, 4]).dias,
    veces: limitar(b.veces ?? 3, RANGO.veces), aviso: b.aviso || null, color: colorDe(b.color), orden, creado: ahora, inicio: hoy,
    mejor: 0, registro: {},
  }
}

/** Las sugeridas del primer uso (5.2, 7.2): crean el hábito con su tipo y su meta, sin aviso, con el color del boceto. */
export const SUGERIDAS = [
  { id: 'agua', nombre: 'Tomar agua', detalle: '8 vasos', tipo: 'cantidad', meta: 8, unidad: 'vasos', color: 'celeste' },
  { id: 'caminar', nombre: 'Caminar', detalle: 'todos los días', tipo: 'diario', color: 'verde' },
  { id: 'gimnasio', nombre: 'Gimnasio', detalle: 'lun, mié, vie', tipo: 'dias', dias: [0, 2, 4], color: 'rosa' },
  { id: 'correr', nombre: 'Correr', detalle: '3 por semana', tipo: 'semana', veces: 3, color: 'violeta' },
]

/** El hábito de una sugerida (7.2). */
export function desdeSugerida(s, ctx) {
  const b = { ...borradorNuevo(ctx.lista), nombre: s.nombre, tipo: s.tipo, color: s.color }
  for (const k of ['meta', 'unidad', 'dias', 'veces']) if (s[k] != null) b[k] = s[k]
  return nuevoHabito(b, ctx)
}

/** Por `orden`, después `creado` y después id (como `habitos.rs`). */
export function ordenarHabitos(lista) {
  return [...lista].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.creado ?? 0) - (b.creado ?? 0) || String(a.id).localeCompare(String(b.id)))
}

// ------------------------------------------------------------------ anuncios (5.3)

export const anuncioTilde = (h, on) => (on ? `Hecho hoy: ${h.nombre}` : `${h.nombre} vuelve a pendiente`)
export const anuncioSuma = (h, v, llego) => `${h.nombre}: ${`${v} de ${h.meta} ${h.unidad ?? ''}`.trim()}${llego ? '. Meta del día cumplida' : ''}`
export const anuncioDiaCompleto = t => `Día completo: hiciste los ${t} de hoy.`
export const anuncioCorregido = (h, dia, on) => `Corregido: ${h.nombre}, ${DIAS_LARGOS[diaSemana(dia)]} ${on ? 'hecho' : 'sin hacer'}`
export const anuncioCreado = (nombre, sugerida) => `Hábito «${nombre}» creado${sugerida ? '. Tocá su nombre para ponerle un aviso.' : ''}`
export const anuncioBorrado = nombre => `Borraste «${nombre}»`

// ------------------------------------------------------------------ el recordatorio (H2: 8.3, 5.4 y 5.5)

/** Un recordatorio que llega más de esto tarde sale solo como globo, sin notificación de Windows (D-h12). */
export const MIN_TARDE = 60
/** Cuántos ids guarda `habitosRecordados` como mucho (11.5, el mismo tope de preferencias.rs). */
export const MAX_RECORDADOS = 100

const esHora = hm => typeof hm === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hm)
/** El instante en ms de la hora de Argentina `hm` del día de Argentina de `ms`. */
const instanteDe = (ms, hm) => diaArgentina(ms) * MS_DIA + DESFASE_AR + (Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5))) * 60000

/** ¿Hace falta recordarlo hoy? Toca, no está hecho y, por semana, la semana no está cumplida (8.3). */
const falta = (h, hoy) => toca(h, hoy) && !hecho(h, hoy) && !semanaCumplida(h, hoy)

/**
 * Los recordatorios que se deben ahora (8.3, 11.6): el hábito tiene `aviso` ("HH:MM"), toca hoy, no
 * está hecho, la hora de Argentina ya la pasó y hoy todavía no se recordó (`recordados`: `{ dia, ids }`
 * de `preferencias.json`; de otro día no cuenta). Cada uno `{ id, hora, dia, tarde }`, del más temprano
 * al más tarde; `tarde` con más de 60 minutos de atraso (solo el globo). Lo revisa el ciclo de 1,5 s.
 */
export function recordatoriosDebidos(habitos, ahoraMs, recordados) {
  const hoy = hoyArgentina(ahoraMs)
  const ya = new Set(recordados?.dia === hoy && Array.isArray(recordados.ids) ? recordados.ids : [])
  return habitos
    .filter(h => esHora(h.aviso) && !ya.has(h.id) && instanteDe(ahoraMs, h.aviso) <= ahoraMs && falta(h, hoy))
    .map(h => ({ id: h.id, hora: h.aviso, dia: hoy, tarde: ahoraMs - instanteDe(ahoraMs, h.aviso) > MIN_TARDE * 60000 }))
    .sort((x, y) => (x.hora < y.hora ? -1 : x.hora > y.hora ? 1 : 0))
}

/** Suma `ids` a los recordados de `hoy` (de otro día, empieza de cero), sin repetir y hasta 100 (los últimos). */
export function recordar(recordados, ids, hoy) {
  const antes = recordados?.dia === hoy && Array.isArray(recordados.ids) ? recordados.ids : []
  return { dia: hoy, ids: [...new Set([...antes, ...ids])].slice(-MAX_RECORDADOS) }
}

/**
 * ¿El recordatorio sigue en la cola? Se va si el hábito queda hecho por cualquier camino (la hoja, el
 * globo), si ya no está (se borró) o a la medianoche (`aviso.dia` ya no es hoy, 7.7). No se va solo con
 * el tiempo. La × y «Ver hábitos →» lo sacan aparte.
 */
export function recordatorioVigente(aviso, h, hoy) {
  return !!h && aviso.dia === hoy && falta(h, hoy)
}

const cuentaCantidad = (h, v) => `${v} de ${h.meta}${String(h.unidad ?? '').trim() ? ` ${String(h.unidad).trim()}` : ''}`

/**
 * Los textos del recordatorio (5.4 y 5.5) en tramos `{ t, fuerte? }`, como `textoGlobo` de Tareas:
 * `globo` (la marca, con la hora y los números en negrita), `muesca` y `fila` (la de la dividida), `hacer`
 * y `hacerFila` (el botón que marca), `ver`, `progreso` (el anillo de 14 de la muesca, solo cantidad),
 * `x` (el nombre y el `title` de la ×), `notificacion` (la de Windows) y `texto` (el globo llano, para el
 * anuncio). `aviso`: `{ dia, hora }` de la cola.
 */
export function textosGlobo(aviso, h) {
  const hora = aviso.hora ?? h.aviso ?? ''
  const base = { ver: 'Ver hábitos →', x: { nombre: `Ahora no: no te recuerdo ${h.nombre} hasta mañana`, titulo: 'Ahora no' } }
  let r
  if (h.tipo === 'cantidad') {
    const v = valor(h, aviso.dia)
    const cuenta = cuentaCantidad(h, v)
    r = {
      globo: [{ t: hora, fuerte: true }, { t: ` · ${h.nombre}: van ` }, { t: cuenta, fuerte: true }, { t: '. ¿Uno más?' }],
      muesca: [{ t: `${hora} · ${h.nombre} ${v} de ${h.meta}` }],
      fila: [{ t: `${hora} · ${h.nombre}: ${v} de ${h.meta}.` }],
      hacer: `+1 ${unidadSingular(h.unidad)}`, hacerFila: '+1', progreso: { hechos: v, total: h.meta },
      notificacion: { titulo: `${h.nombre} · ${hora}`, cuerpo: `Van ${cuenta}. ¿Uno más?` },
    }
  } else {
    const semana = h.tipo === 'semana'
    const lleva = semana ? `${hechosSemana(h, lunesDe(aviso.dia))} de ${h.veces ?? 1} esta semana.` : ''
    r = {
      globo: [{ t: hora, fuerte: true }, { t: ' · Te toca ' }, { t: h.nombre, fuerte: true }, { t: semana ? `: llevás ${lleva}` : '.' }],
      muesca: [{ t: `${hora} · ${h.nombre}` }],
      fila: [{ t: `${hora} · Te toca ${h.nombre}.` }],
      hacer: 'Hecho', hacerFila: 'Hecho', progreso: null,
      notificacion: { titulo: `${h.nombre} · ${hora}`, cuerpo: semana ? `Llevás ${lleva}` : `Te toca ${h.nombre}.` },
    }
  }
  return { ...base, ...r, texto: r.globo.map(s => s.t).join('') }
}

/**
 * Lo que dice el globo durante 1,8 s después de «+1» o «Hecho» (5.4): cantidad «Listo: {v} de {meta}
 * {unidad}.» (con « ¡Meta del día!» si llegó); los demás «¡Hecho! {nombre}: {n} días seguidos.» (o
 * semanas seguidas), con la racha ya contando hoy.
 */
export function textoHechoGlobo(h, dia) {
  if (h.tipo === 'cantidad') {
    return [{ t: 'Listo: ' }, { t: cuentaCantidad(h, valor(h, dia)), fuerte: true }, { t: '.' }, hecho(h, dia) && { t: ' ¡Meta del día!' }].filter(Boolean)
  }
  const n = racha(h, dia)
  return [{ t: '¡Hecho! ' }, { t: h.nombre, fuerte: true }, { t: `: ${n} ${textoRachaGrande(h, n)}.` }]
}

// ------------------------------------------------------------------ la hoja (3.4, 3.5)

const VISTAS = ['hoy', 'semana']
const esVista = v => VISTAS.includes(v)
/** ¿`ver` es un hábito? (no Hoy, Semana, el formulario ni un archivo roto) */
export const esHabito = v => typeof v === 'string' && !esVista(v) && v !== 'nuevo' && !v.startsWith('rota:')

/**
 * El estado de la hoja en la ventana (3.5): abierta (la sigue `st.modulo`), la vista (`hoy`, `semana`,
 * `nuevo`, el id de un hábito o `rota:<archivo>`), la vista a la que vuelve «‹» (`desde`), el borrado
 * armado, el borrador del formulario nuevo y su error, la mascota festejando, lo leído (`lista`,
 * `rotas`), si se está leyendo y los errores de 7.4 y 5.2.
 */
export function habitosInicial() {
  return {
    abierta: false, ver: 'hoy', desde: 'hoy', armado: null, borrador: null, errForm: null, feliz: false,
    lista: [], rotas: [], leido: false, cargando: false, fantasmas: false, errorGuardar: false, error: null, recien: null,
  }
}

/** Abre en la última vista de esta ejecución (la primera vez, Hoy), o en `ver`. El formulario nuevo no vuelve. */
export function abrirHabitos(t, ver) {
  const v = ver ?? (t.ver === 'nuevo' ? t.desde : t.ver)
  return { ...t, abierta: true, ver: v, desde: esVista(v) ? v : t.desde, armado: null, errForm: null, borrador: null }
}

/** Cierra: desarma y descarta el formulario nuevo; la vista queda (salvo el formulario, que vuelve a su origen). */
export function cerrarHabitos(t) {
  return { ...t, abierta: false, ver: t.ver === 'nuevo' ? t.desde : t.ver, armado: null, errForm: null, borrador: null }
}

/** Cambia de vista desde el índice: Hoy y Semana quedan como `desde`; se desarma y se descarta el formulario. */
export function verHabitos(t, ver) {
  return { ...t, ver, desde: esVista(ver) ? ver : t.desde, armado: null, errForm: null, borrador: null }
}

/** El formulario de un hábito nuevo (4.11), con su borrador. */
export function empezarNuevo(t, lista) {
  return { ...t, ver: 'nuevo', desde: esVista(t.ver) ? t.ver : t.desde, armado: null, errForm: null, borrador: borradorNuevo(lista) }
}

/** Abre un hábito en el lugar de la vista (4.10): «‹ {Hoy|Semana}» vuelve a la de origen. */
export function abrirHabito(t, id) {
  return { ...t, ver: id, desde: esVista(t.ver) ? t.ver : t.desde, armado: null, errForm: null, borrador: null }
}

/** Cierra el hábito abierto (o el formulario nuevo): vuelve a la vista de la que vino. */
export function cerrarHabito(t) {
  return { ...t, ver: t.desde, armado: null, errForm: null, borrador: null }
}

/**
 * Esc con la hoja abierta (9.1), una capa por vez: 1) el nombre de un hábito nuevo con algo escrito
 * (`foco`: `{ campo, texto }`) se vacía; 2) un «¿Borrar…? Sí» se desarma; 3) el formulario nuevo se
 * cancela; 4) el hábito abierto vuelve a la vista de la que vino; 5) la hoja se cierra (modulos.js lo
 * vuelve ir a Sesiones). Cerrada, no es de la hoja (`accion` null).
 */
export function alEscHabitos(t, foco) {
  if (!t.abierta) return { habitos: t, accion: null }
  if (t.ver === 'nuevo' && foco?.campo === 'nombre' && foco.texto) return { habitos: t, accion: 'vaciar' }
  if (t.armado) return { habitos: { ...t, armado: null }, accion: 'desarmar' }
  if (t.ver === 'nuevo') return { habitos: cerrarHabito(t), accion: 'cancelar-nuevo' }
  if (esHabito(t.ver)) return { habitos: cerrarHabito(t), accion: 'cerrar-habito' }
  return { habitos: cerrarHabitos(t), accion: 'cerrar' }
}

/** Ctrl H (9.2): solo Ctrl, sin Alt, Shift ni Windows (como `esAtajoTareas`). Falta medirlo en WebView2 (11.9). */
export function esAtajoHabitos(e) {
  return String(e.key ?? '').toLowerCase() === 'h' && !!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey
}
