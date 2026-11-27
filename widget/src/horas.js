// Horas de trabajo (odd/tasks/horas-trabajo.md, S1 y S4): lógica pura del módulo «Horas» y del reloj
// de la tarjeta de sesión. El mod mide (S2, S3) y escribe `~/.claude/oficina/horas/<id>.json` con los
// tramos en que algún agente trabajó; Rust los lee tal cual (`leer_horas`) y acá se cuentan: el tramo
// abierto, los días de Argentina (un tramo que cruza la medianoche se parte), las features (repo +
// rama), los períodos Hoy, Semana y Todo, y los textos. Sin DOM: se prueba en node.

import { nombreProyecto, plural } from './logica.js'
import { DESFASE_AR, MS_DIA, diaArgentina, hoyArgentina, lunesDe, diasEntre, diaSemana } from './fechas.js'
import { DIAS_CORTOS } from './habitos.js'

const MIN = 60000

/** Un archivo de horas que no late hace más que esto: su tramo abierto cuenta hasta su `actualizado` (contrato). */
export const MS_SIN_LATIDO = 2 * MIN
/** Cada cuánto se vuelven a leer las horas con la hoja abierta (nunca en el ciclo de 1,5 s). */
export const MS_RELEER_HORAS = 10000
/** La feature de lo trabajado fuera de un repo (S1: «fuera de un repo»). */
export const FUERA_DE_UN_REPO = 'fuera de un repo'
/** La rama que no se conoce. */
export const SIN_RAMA = 'sin rama'
/** Los períodos de la hoja, en el orden del selector. */
export const PERIODOS = [['hoy', 'Hoy'], ['semana', 'Semana'], ['todo', 'Todo']]
const NOMBRE_PERIODO = { hoy: 'Hoy', semana: 'Esta semana', todo: 'Todo' }

const msDe = iso => (typeof iso === 'string' ? Date.parse(iso) : NaN)

/**
 * Los tramos de todas las sesiones en ms: `{ sesion, desde, hasta, repo, rama, vivo }`. Un tramo
 * abierto (`hasta: null`) cuenta hasta ahora si el archivo late (`actualizado` de hace 2 min o menos;
 * `vivo`), o hasta su `actualizado` si no (la sesión se cortó sin cerrarlo). Nada pasa de ahora. Un
 * tramo con fechas que no se entienden o que no dura nada se saltea.
 */
export function tramosNormalizados(sesiones, ahoraMs) {
  const salida = []
  for (const s of sesiones ?? []) {
    if (!s || typeof s.sesion !== 'string' || !Array.isArray(s.tramos)) continue
    const act = msDe(s.actualizado)
    const late = Number.isFinite(act) && ahoraMs - act <= MS_SIN_LATIDO
    for (const t of s.tramos) {
      const desde = msDe(t?.desde)
      if (!Number.isFinite(desde)) continue
      const abierto = t.hasta == null
      let hasta = abierto ? (late ? ahoraMs : act) : msDe(t.hasta)
      if (!Number.isFinite(hasta)) continue
      hasta = Math.min(hasta, ahoraMs)
      if (hasta <= desde) continue
      const texto = v => (typeof v === 'string' && v ? v : null)
      salida.push({ sesion: s.sesion, desde, hasta, repo: texto(t.repo), rama: texto(t.rama), vivo: abierto && late })
    }
  }
  return salida
}

/** El instante de las 00:00 de Argentina del día número `n` (días desde 1970). */
const medianoche = n => n * MS_DIA + DESFASE_AR

/** Un intervalo partido en los días de Argentina que toca: `[{ dia: 'AAAA-MM-DD', ms }]`, del más viejo al más nuevo. */
export function partirPorDia(desde, hasta) {
  const partes = []
  let a = desde
  while (a < hasta) {
    const n = diaArgentina(a)
    const fin = Math.min(hasta, medianoche(n + 1))
    partes.push({ dia: hoyArgentina(a), ms: fin - a })
    a = fin
  }
  return partes
}

/**
 * La feature de un tramo (S1): repo + rama. `main` es la feature `main` de ese repo; sin rama,
 * «sin rama»; fuera de un repo, una sola feature «fuera de un repo» (sin rama: no hay git).
 * `nombre` es el del repo (la última parte) y `rotulo`, la rama.
 */
export function featureDe(repo, rama) {
  if (!repo) return { clave: 'fuera', repo: null, rama: null, nombre: FUERA_DE_UN_REPO, rotulo: '' }
  return { clave: `${repo}\u0000${rama ?? ''}`, repo, rama: rama ?? null, nombre: nombreProyecto(repo), rotulo: rama || SIN_RAMA }
}

/** ¿El día cae en el período? Semana: del lunes de Argentina a hoy. */
function enPeriodo(dia, periodo, hoy) {
  if (periodo === 'hoy') return dia === hoy
  if (periodo === 'semana') return dia >= lunesDe(hoy) && dia <= hoy
  return true
}

/** Los pedazos de cada tramo dentro del período: `[{ tramo, dia, ms }]`. */
function pedazos(sesiones, ahoraMs, periodo) {
  const hoy = hoyArgentina(ahoraMs)
  const salida = []
  for (const t of tramosNormalizados(sesiones, ahoraMs)) {
    for (const p of partirPorDia(t.desde, t.hasta)) if (enPeriodo(p.dia, periodo, hoy)) salida.push({ tramo: t, ...p })
  }
  return salida
}

/**
 * Las features del período (S4): `{ total, max, features: [{ clave, repo, rama, nombre, rotulo, ms,
 * ultimo, activa, sesiones }] }`, la de actividad más reciente primero. `max` es el de la feature más
 * larga (la barra proporcional), `activa` si un agente trabaja ahí ahora y `sesiones` cuántas sumaron.
 */
export function resumenHoras(sesiones, ahoraMs, periodo = 'hoy') {
  const por = new Map()
  for (const { tramo: t, ms } of pedazos(sesiones, ahoraMs, periodo)) {
    const f = featureDe(t.repo, t.rama)
    if (!por.has(f.clave)) por.set(f.clave, { ...f, ms: 0, ultimo: 0, activa: false, ids: new Set() })
    const g = por.get(f.clave)
    g.ms += ms
    g.ultimo = Math.max(g.ultimo, t.hasta)
    g.activa ||= t.vivo
    g.ids.add(t.sesion)
  }
  const features = [...por.values()]
    .map(({ ids, ...g }) => ({ ...g, sesiones: ids.size }))
    .sort((a, b) => b.ultimo - a.ultimo || b.ms - a.ms || a.clave.localeCompare(b.clave))
  return {
    total: features.reduce((n, f) => n + f.ms, 0),
    max: features.reduce((n, f) => Math.max(n, f.ms), 0),
    features,
  }
}

/** Lo trabajado hoy en Argentina, entre todas las features (la cuenta de la fila del menú). */
export function totalHoy(sesiones, ahoraMs) {
  return resumenHoras(sesiones, ahoraMs, 'hoy').total
}

/**
 * Una feature abierta (S4): `{ ...feature, ms, dias: [{ dia, ms }], sesiones: [{ sesion, ms, desde,
 * hasta, activa }] }` dentro del período. Los días, el más nuevo arriba; las sesiones, la de actividad
 * más reciente primero. null si la feature no tiene nada en el período.
 */
export function detalleFeature(sesiones, ahoraMs, clave, periodo = 'hoy') {
  const dias = new Map()
  const ses = new Map()
  let f = null
  for (const { tramo: t, dia, ms } of pedazos(sesiones, ahoraMs, periodo)) {
    const g = featureDe(t.repo, t.rama)
    if (g.clave !== clave) continue
    f ??= g
    dias.set(dia, (dias.get(dia) ?? 0) + ms)
    if (!ses.has(t.sesion)) ses.set(t.sesion, { sesion: t.sesion, ms: 0, desde: t.desde, hasta: t.hasta, activa: false })
    const x = ses.get(t.sesion)
    x.ms += ms
    x.desde = Math.min(x.desde, t.desde)
    x.hasta = Math.max(x.hasta, t.hasta)
    x.activa ||= t.vivo
  }
  if (!f) return null
  const listaDias = [...dias].map(([dia, ms]) => ({ dia, ms })).sort((a, b) => (a.dia < b.dia ? 1 : -1))
  const listaSes = [...ses.values()].sort((a, b) => b.hasta - a.hasta || a.sesion.localeCompare(b.sesion))
  return { ...f, ms: listaDias.reduce((n, d) => n + d.ms, 0), dias: listaDias, sesiones: listaSes }
}

// ------------------------------------------------------------------ textos

/** «menos de 1 min», «12 min», «1 h 5 min», «2 h», «26 h 10 min» (como `tiempoRelativo` de logica.js). */
export function duracion(ms) {
  const min = Math.floor(Math.max(0, ms) / MIN)
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), resto = min % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

/** La cuenta de la fila del menú, que entra en su lugar: «—», «<1m», «12m», «3h20», «2h». */
export function duracionCorta(ms) {
  if (!(ms > 0)) return '—'
  const min = Math.floor(ms / MIN)
  if (min < 1) return '<1m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60), resto = min % 60
  return resto ? `${h}h${String(resto).padStart(2, '0')}` : `${h}h`
}

/** El día de una fila del detalle: «hoy», «ayer» o «lun 23/11». */
export function etiquetaDia(dia, hoy) {
  const n = diasEntre(dia, hoy)
  if (n === 0) return 'hoy'
  if (n === -1) return 'ayer'
  return `${DIAS_CORTOS[diaSemana(dia)]} ${Number(dia.slice(8, 10))}/${Number(dia.slice(5, 7))}`
}

/** El nombre accesible de la fila del menú: «Horas, 1 h 5 min hoy» · «Horas, nada trabajado hoy» · «Horas» (sin leer). */
export function nombreFilaHoras(msHoy) {
  if (msHoy == null) return 'Horas'
  return msHoy > 0 ? `Horas, ${duracion(msHoy)} hoy` : 'Horas, nada trabajado hoy'
}

/** La bajada de la hoja: «Hoy · 2 h · 3 features» · «Esta semana · nada todavía». */
export function subtituloHoras({ periodo, total, features }) {
  const p = NOMBRE_PERIODO[periodo] ?? 'Hoy'
  if (!features) return `${p} · nada todavía`
  return `${p} · ${duracion(total)} · ${plural(features, 'feature', 'features')}`
}

// ------------------------------------------------------------------ el reloj de la tarjeta (S4)

/**
 * Lo trabajado por una sesión según su presencia local (`trabajado: { ms, desde }`): los tramos cerrados
 * más el abierto hasta ahora. null sin `trabajado` (un mod anterior) o si no se entiende.
 */
export function trabajadoMs(s, ahoraMs) {
  const t = s?.trabajado
  if (!t || typeof t !== 'object' || !Number.isFinite(t.ms) || t.ms < 0) return null
  const desde = msDe(t.desde)
  return t.ms + (Number.isFinite(desde) ? Math.max(0, ahoraMs - desde) : 0)
}

/** Lo que muestra el reloj de la tarjeta: `{ cifra, corre, lector, title }`, o null sin reloj. */
export function textoTrabajado(s, ahoraMs) {
  const ms = trabajadoMs(s, ahoraMs)
  if (ms == null) return null
  const cifra = duracion(ms)
  const corre = Number.isFinite(msDe(s.trabajado.desde))
  return {
    cifra, corre,
    lector: `trabajado ${cifra}, ${corre ? 'el reloj corre' : 'frenado'}`,
    title: `Trabajado: ${cifra} · ${corre ? 'corre mientras algún agente trabaja' : 'frenado: ningún agente trabaja'}`,
  }
}

// ------------------------------------------------------------------ el estado de la hoja

/** La hoja cerrada, en Hoy, sin leer. */
export function horasInicial() {
  return { abierta: false, periodo: 'hoy', feature: null, sesiones: [], leido: false, cargando: false, fantasmas: false, error: null }
}

export const abrirHoras = h => ({ ...h, abierta: true, feature: null })
/** Al cerrar se olvida la feature abierta; el período queda (mientras la ventana sigue abierta). */
export const cerrarHoras = h => ({ ...h, abierta: false, feature: null })
export const elegirPeriodo = (h, periodo) => (PERIODOS.some(([v]) => v === periodo) ? { ...h, periodo } : h)
export const abrirFeature = (h, clave) => ({ ...h, feature: clave })
export const cerrarFeature = h => ({ ...h, feature: null })

/** Esc (modulos-ux.md 9.1): con una feature abierta, vuelve a la lista; si no, la última capa ('cerrar' → Sesiones). */
export function alEscHoras(h) {
  return h?.feature ? 'cerrar-feature' : 'cerrar'
}
