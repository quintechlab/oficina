// La hoja de Hábitos (#41, docs/diseno/habitos-ux.md 3.3, 4 y 5, opción B "Carpeta"): la cuenta de la
// fila del menú, el esqueleto, el índice, Hoy, Semana, el hábito abierto, el formulario, el primer uso,
// los vacíos y los errores. Solo HTML, como tareasVista.js (de donde reusa el botón del índice, el
// confirmar en el mismo botón, la tarjeta de error y los íconos comunes): los datos llegan armados
// desde main.js y nada de acá toca el DOM. main.js redibuja por partes (`data-parte`) y nunca pisa un
// campo mientras se escribe en él (`ponerParteConCampo`).
// Entrega H1, y en H2 el globo del recordatorio (la marca, la muesca y la fila de la dividida). El del
// resumen (H3) no está.

import { escapar } from './logica.js'
import { avi, claudeDe } from './avis.js'
import { especieValida } from './especies.js'
import { colorDe } from './tareas.js'
import { ICONO as ICONO_TAREAS, botonIndice, confirmable, err, boton, tramos, X } from './tareasVista.js'
import { lunesDe, sumarDias, diaSemana } from './fechas.js'
import {
  toca, hecho, deHoy, valor, racha, mejorRacha, nivelRacha, textoRachaGrande, estadoCelda, textoCelda, corregible,
  rotuloTipo, nombreSumador, unidadSingular, semanaCumplida, cuentasHoy, resumenHoy, pctSemana, cabeceraSemana, mananaHabitos,
  ultimasSemanas, fraseFormulario, textoBorrar, desdeEl, nombreFilaHabitos, SUGERIDAS, NOMBRES_TIPO, COLORES, NOMBRES_COLOR,
  LETRAS_DIAS, DIAS_LARGOS, esHabito,
} from './habitos.js'

const ICONO = {
  hoy: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.3"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/></svg>',
  semana: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="9" rx="2.5"/><path d="M2.5 8h11M6.2 3.5v9M9.8 3.5v9"/></svg>',
  brasa: '<svg viewBox="0 0 12 14" aria-hidden="true"><path d="M6.2.8c.5 2.4 4.3 3.9 4.3 7.6A4.5 4.5 0 0 1 1.5 8.6c0-1.9 1-3.1 2-3.9.1 1.4.8 2.3 1.6 2.5C4.8 4.9 5.2 2.6 6.2.8z"/></svg>',
  campana: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 8.3V5.6a3 3 0 0 1 6 0v2.7l1 1.1H2zM5 10.6h2"/></svg>',
  mas: ICONO_TAREAS.mas,
  visto: ICONO_TAREAS.visto,
}

const color = c => `var(--${colorDe(c)})`
const pct = (h, n) => `${n ? Math.round((h / n) * 1000) / 10 : 0}%`
const mascotaDe = especie => claudeDe(especieValida(especie))
/** «día» o «días», «semana» o «semanas» (4.7). */
const unidad = (h, n) => (h.tipo === 'semana' ? (n === 1 ? 'semana' : 'semanas') : (n === 1 ? 'día' : 'días'))

// ------------------------------------------------------------------ fila del menú (4.1) y tira mini

/** El anillo de 14 (r 5, trazo 2,6): el relleno ámbar proporcional; con 0 hechos, sin relleno. */
function anilloMini(h, t) {
  const C = 2 * Math.PI * 5
  const p = t ? Math.min(1, h / t) : 0
  const lleno = p ? `<circle cx="7" cy="7" r="5" class="a-l" stroke-dasharray="${(C * p).toFixed(2)} ${C.toFixed(2)}"/>` : ''
  return `<svg viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" class="a-f"/>${lleno}</svg>`
}

/** A la derecha de la fila «Hábitos» (4.1): la pista «Ctrl H», «—» si ninguno toca hoy, o el anillo y «{h}/{t}». */
export function ladoFilaHabitos(c) {
  if (!c?.habitos && !c?.total) return '<kbd aria-hidden="true">Ctrl H</kbd>'
  if (!c.total) return '<span class="anillo-c nada" aria-hidden="true">—</span>'
  const completo = c.hechos >= c.total ? ' completo' : ''
  return `<span class="anillo-c${completo}" aria-hidden="true">${anilloMini(c.hechos, c.total)}${c.hechos}/${c.total}</span>`
}

/** La cuenta chica de Hábitos en la tira mini (modulos-ux.md 8): el anillo con su nombre para el lector; sin nada de hoy, nada. */
export function cuentaMiniHabitos(c) {
  if (!c?.total) return ''
  return `${ladoFilaHabitos(c)}<span class="oculto">${escapar(nombreFilaHabitos(c))}</span>`
}

// ------------------------------------------------------------------ esqueleto (3.3)

/** Lo que no cambia mientras la hoja está abierta: el cuerpo y los anuncios (5.3). */
export function esqueletoHabitos() {
  return '<div id="hab-cuerpo"></div><p class="oculto" role="status" id="hab-vivo"></p>'
}

/** La carpeta (3.3): el índice y el panel, cada uno por partes. */
export const CARPETA_HAB = '<div class="carpeta"><nav class="idx" aria-label="Vistas y hábitos" data-parte="idx"></nav>'
  + '<section class="pane" aria-labelledby="hab-pane-h"><div data-parte="pane-h"></div><div data-parte="err"></div>'
  + '<div class="hab-desplaza" data-parte="cuerpo"></div></section></div>'

// ------------------------------------------------------------------ la racha (4.7)

/**
 * La brasa y el número (4.7): larga, «{n} días» o «sin racha»; corta (el índice), solo el número. El
 * `title` dice la racha y la mejor. `sube`: la racha acaba de crecer (el número rueda y la brasa salta).
 */
export function rachaHtml(h, hoy, { larga = true, sube = false, oculta = false } = {}) {
  const n = racha(h, hoy)
  const m = mejorRacha(h, hoy)
  const titulo = `Racha: ${n} ${unidad(h, n)} · la mejor: ${m}`
  const cuerpo = n ? `<b>${n}</b>${larga ? `<span>${unidad(h, n)}</span>` : ''}` : `<span>${larga ? 'sin racha' : '0'}</span>`
  return `<span class="racha r${nivelRacha(n)}${sube ? ' sube' : ''}"${oculta ? ' aria-hidden="true"' : ''} title="${escapar(titulo)}">${ICONO.brasa}${cuerpo}</span>`
}

// ------------------------------------------------------------------ índice (4.2)

/**
 * El índice (4.2): Hoy con «{h}/{t}» (`cuentas` null mientras se lee: sin cuenta, 7.1), Semana, el
 * rótulo «Hábitos», cada hábito con su punto, su nombre y su racha corta, los archivos rotos (7.6) y
 * «Nuevo hábito».
 */
export function indiceHabitos({ ver, lista, rotas = [], cuentas: c, hoy }) {
  const ctHoy = c?.total ? `<span class="ct t-aviso" aria-hidden="true">${c.hechos}/${c.total}</span><span class="oculto">, ${c.hechos} de ${c.total} hechos</span>` : ''
  const filas = [
    botonIndice({ valor: 'hoy', k: 'ix-hoy', actual: ver === 'hoy', icono: ICONO.hoy, nombre: 'Hoy', c: 'var(--ambar)', ct: ctHoy, accion: 'hab-ver' }),
    botonIndice({ valor: 'semana', k: 'ix-semana', actual: ver === 'semana', icono: ICONO.semana, nombre: 'Semana', c: 'var(--crema2)', accion: 'hab-ver' }),
    '<span class="rot-i" aria-hidden="true">Hábitos</span>',
  ]
  for (const h of lista) {
    const n = racha(h, hoy)
    const ct = rachaHtml(h, hoy, { larga: false, oculta: true }) + `<span class="oculto">, racha de ${n} ${unidad(h, n)}</span>`
    filas.push(botonIndice({ valor: h.id, k: `ix-${h.id}`, actual: ver === h.id, icono: '', nombre: h.nombre, c: color(h.color), ct, titulo: h.nombre, accion: 'hab-ver' }))
  }
  for (const r of rotas) {
    filas.push(botonIndice({ valor: `rota:${r.archivo}`, k: `ix-rota:${r.archivo}`, actual: ver === `rota:${r.archivo}`, icono: '', nombre: r.archivo, c: 'var(--rojo)', clase: ' rota', titulo: `${r.archivo}: ${r.motivo ?? ''}`, accion: 'hab-ver' }))
  }
  filas.push(`<button type="button" class="ix-b ix-mas" data-accion="hab-nuevo" data-k="nuevo-b"${ver === 'nuevo' ? ' aria-current="page"' : ''}><span class="ix-ic">${ICONO.mas}</span><span class="n">Nuevo hábito</span></button>`)
  return filas.join('')
}

// ------------------------------------------------------------------ Hoy (4.4 a 4.6)

/**
 * El sumador (4.6): un anillo de `meta` tramos (con más de 12, un arco continuo), el número de hoy (o
 * el visto con la meta cumplida) y el «+». `fx`: el tramo nuevo entra y el número rueda (`d > 0`), y
 * con la meta recién cumplida la onda (`llega`), solo en el dibujo de ese cambio.
 */
export function sumador(h, hoy, fx = null) {
  const v = valor(h, hoy), n = h.meta || 1, lleno = v >= n
  const nuevo = fx?.id === h.id && fx.tipo === 'suma'
  const C = 2 * Math.PI * 15
  let arcos = ''
  if (n <= 12) {
    const paso = C / n, gap = n > 1 ? 2.6 : 0, largo = paso - gap
    for (let i = 0; i < n; i++) {
      const cls = `sg${i < v ? ' on' : ''}${nuevo && fx.d > 0 && i === v - 1 ? ' nv' : ''}`
      arcos += `<circle cx="18" cy="18" r="15" class="${cls}" stroke-dasharray="${largo.toFixed(2)} ${(C - largo).toFixed(2)}" stroke-dashoffset="${(-i * paso - gap / 2).toFixed(2)}"/>`
    }
  } else {
    arcos = `<circle cx="18" cy="18" r="15" class="sg"/><circle cx="18" cy="18" r="15" class="sg on" stroke-linecap="round" stroke-dasharray="${((C * Math.min(v, n)) / n).toFixed(2)} ${C.toFixed(2)}"/>`
  }
  const clases = `sum${lleno ? ' lleno' : ''}${nuevo && fx.llega ? ' llega' : ''}`
  return `<button type="button" class="${clases}" data-accion="hab-sumar" data-valor="${escapar(h.id)}" data-k="sum-${escapar(h.id)}" aria-label="${escapar(nombreSumador(h, hoy))}">`
    + `<svg viewBox="0 0 36 36" aria-hidden="true">${arcos}</svg><b class="num${nuevo && fx.d ? ' rueda' : ''}" aria-hidden="true">${lleno ? ICONO.visto : v}</b><i class="mas" aria-hidden="true">+</i></button>`
}

/** El control de la fila (4.4): el tilde, el sumador o, si hoy no toca, el «–». */
function control(h, hoy, fx) {
  if (!toca(h, hoy)) return '<span class="libre-c" title="Hoy no toca" aria-hidden="true">–</span>'
  if (h.tipo === 'cantidad') return sumador(h, hoy, fx)
  const on = hecho(h, hoy)
  const tildando = fx?.id === h.id && fx.tipo === 'tilde' && on ? ' tildando' : ''
  return `<button type="button" class="ck${tildando}" role="checkbox" aria-checked="${on}" aria-label="Hecho hoy: ${escapar(h.nombre)}" data-accion="hab-tildar" data-valor="${escapar(h.id)}" data-k="ck-${escapar(h.id)}">${ICONO.visto}</button>`
}

/** Debajo del nombre (4.4): el rótulo del tipo, el «−1» (cantidad con algo hoy) y el aviso. */
function meta(h, hoy) {
  const v = valor(h, hoy)
  const cumplida = (h.tipo === 'cantidad' && v >= h.meta) || semanaCumplida(h, hoy)
  let html = `<span class="tag${cumplida && toca(h, hoy) ? ' t-aviso' : ''}">${escapar(rotuloTipo(h, hoy))}</span>`
  if (h.tipo === 'cantidad' && v > 0) {
    html += `<button type="button" class="menos" data-accion="hab-restar" data-valor="${escapar(h.id)}" data-k="menos-${escapar(h.id)}" aria-label="Restar 1 ${escapar(unidadSingular(h.unidad))} a ${escapar(h.nombre)}" title="Restar uno">−1</button>`
  }
  if (h.aviso) html += `<span class="tag" title="Aviso a las ${escapar(h.aviso)}">${ICONO.campana}${escapar(h.aviso)}</span>`
  return html
}

/** Una fila de Hoy (4.4): el control, el nombre que abre el hábito, su meta y la racha larga. Hecho no se tacha: se enciende. */
export function filaHabito(h, { hoy, fx = null, recien = null }) {
  const clases = ['fila', toca(h, hoy) && hecho(h, hoy) ? 'hecha' : '', recien === h.id ? 'recien' : ''].filter(Boolean).join(' ')
  const sube = fx?.id === h.id && fx.sube
  return `<li class="${clases}" data-id="${escapar(h.id)}" style="--c:${color(h.color)}">${control(h, hoy, fx)}`
    + `<div class="cuerpo"><button type="button" class="nom" data-accion="hab-abrir" data-valor="${escapar(h.id)}" data-k="nom-${escapar(h.id)}">${escapar(h.nombre)}</button>`
    + `<div class="meta">${meta(h, hoy)}</div></div>${rachaHtml(h, hoy, { sube })}</li>`
}

const fantasmas = '<ul class="filas fantasmas" aria-hidden="true"><li></li><li></li><li></li></ul>'

/** El panel de Hoy (3.4): las filas de hoy en el orden del usuario y, abajo, «Hoy no toca»; o el vacío de 5.2. */
function cuerpoHoy({ lista, hoy, fx, recien, mascota }) {
  const dentro = lista.filter(h => deHoy(h, hoy))
  const fuera = lista.filter(h => !dentro.includes(h))
  const opts = { hoy, fx, recien }
  let html
  if (dentro.length) html = `<ul class="filas">${dentro.map(h => filaHabito(h, opts)).join('')}</ul>`
  else {
    const m = mananaHabitos(lista, hoy)
    html = `<div class="vac">${avi(mascotaDe(mascota), 'esperando', 66)}<b>Hoy no toca nada.</b>${m ? `<p>Mañana: ${escapar(m)}.</p>` : ''}</div>`
  }
  if (fuera.length) html += `<p class="rot-p">Hoy no toca</p><ul class="filas fuera-l">${fuera.map(h => filaHabito(h, opts)).join('')}</ul>`
  return html
}

function cabeceraHoy(c) {
  const r = resumenHoy(c)
  const barra = c?.total
    ? `<span class="prog" role="progressbar" aria-label="Hechos hoy" aria-valuemin="0" aria-valuemax="${c.total}" aria-valuenow="${c.hechos}"><i style="--p:${pct(c.hechos, c.total)}"></i></span>`
    : ''
  return `<header class="pane-h"><h2 id="hab-pane-h">Hoy</h2><div class="pane-s"><span${r.completo ? ' class="completo-t"' : ''}>${escapar(r.texto)}</span>${barra}</div></header>`
}

// ------------------------------------------------------------------ Semana (4.8, 4.9)

/**
 * Las siete celdas de lunes a domingo (4.8). `clic`: las que se pueden corregir son botones con
 * `aria-pressed` (días de esta semana hasta hoy; nunca la cantidad, D-h4); las demás, una imagen con su
 * nombre. `fx`: la celda recién marcada salta (`enciende`).
 */
export function celdas(h, hoy, { clic = false, fx = null } = {}) {
  const lunes = lunesDe(hoy)
  let html = ''
  for (let i = 0; i < 7; i++) {
    const dia = sumarDias(lunes, i)
    const e = estadoCelda(h, dia, hoy)
    const enciende = fx?.id === h.id && fx.dia === dia && hecho(h, dia) ? ' enciende' : ''
    const cls = `cel s-${e}${dia === hoy ? ' hoy' : ''}${enciende}`
    const p = e === 'parcial' ? ` style="--p:${Math.min(100, Math.round((valor(h, dia) / (h.meta || 1)) * 100))}%"` : ''
    const lbl = escapar(textoCelda(h, dia, hoy))
    html += clic && corregible(h, dia, hoy)
      ? `<button type="button" class="${cls}"${p} data-accion="hab-celda" data-valor="${escapar(h.id)}" data-dia="${dia}" data-k="cel-${escapar(h.id)}-${i}" aria-pressed="${hecho(h, dia)}" aria-label="${lbl}" title="${lbl}"></button>`
      : `<span class="${cls}"${p} role="img" aria-label="${lbl}" title="${lbl}"></span>`
  }
  return `<div class="sem" role="group" aria-label="Semana de ${escapar(h.nombre)}">${html}</div>`
}

/** «L M M J V S D», con el número del día debajo (Semana); hoy en ámbar. */
function letras(hoy, conFechas) {
  const lunes = lunesDe(hoy)
  return LETRAS_DIAS.map((l, i) => {
    const dia = sumarDias(lunes, i)
    return `<span${dia === hoy ? ' class="hoy"' : ''}>${l}${conFechas ? `<small>${Number(dia.slice(8, 10))}</small>` : ''}</span>`
  }).join('')
}

const LEYENDA = '<div class="leyenda" aria-hidden="true">'
  + [['hecho', 'hecho'], ['parcial', 'en parte', ' style="--p:50%"'], ['falta', 'no se hizo'], ['libre', 'no toca'], ['futuro', 'por venir']]
    .map(([e, t, s = '']) => `<span><i class="cel s-${e}"${s}></i>${t}</span>`).join('')
  + '</div>'

/** La vista Semana (4.9): la fila de rótulos, una fila por hábito con sus celdas, la leyenda y la pista. */
function cuerpoSemana({ lista, hoy, fx }) {
  const filas = lista.map((h, k) => `<div class="mat-r" style="--c:${color(h.color)};--i:${k}">`
    + `<button type="button" class="mat-n" data-accion="hab-abrir" data-valor="${escapar(h.id)}" data-k="mat-${escapar(h.id)}"><i class="pt" aria-hidden="true"></i><span>${escapar(h.nombre)}</span></button>`
    + `${celdas(h, hoy, { clic: true, fx })}</div>`).join('')
  return `<div class="mat" style="--hoy:${diaSemana(hoy)}"><div class="mat-r mat-cab"><span class="rot-m">Hábito</span><div class="letras" aria-hidden="true">${letras(hoy, true)}</div></div>${filas}</div>`
    + `${LEYENDA}<p class="pista">Tocá un día que ya pasó para corregirlo.</p>`
}

// ------------------------------------------------------------------ formulario (4.11)

/** Segmentos con foco itinerante (`radiogroup`): el elegido es el único en el orden de tabulación. */
function radios(accion, opciones, actual, etiqueta, clase, contenido) {
  const alguno = opciones.some(([v]) => v === actual)
  return `<div class="det-f${clase}" role="radiogroup" aria-label="${etiqueta}">${opciones.map(([v, t], i) => {
    const sel = v === actual
    return contenido(v, t, `role="radio" aria-checked="${sel}" tabindex="${sel || (!alguno && i === 0) ? 0 : -1}"`)
  }).join('')}</div>`
}

/** − número + (4.11): la meta de 1 a 99 o las veces de 1 a 6. */
const paso = (campo, v, etiqueta) => `<div class="paso" role="group" aria-label="${etiqueta}">`
  + `<button type="button" data-accion="hab-paso" data-valor="${campo}:-1" data-k="p-${campo}-m" aria-label="Uno menos">−</button>`
  + `<b aria-live="polite">${v}</b>`
  + `<button type="button" data-accion="hab-paso" data-valor="${campo}:1" data-k="p-${campo}-p" aria-label="Uno más">+</button></div>`

/** La frase del formulario (4.11): el nombre en negrita; main.js la reescribe al escribir (`data-frase`). */
export function fraseHtml(h) {
  const f = fraseFormulario(h)
  return `<b>${escapar(f.nombre)}</b>${escapar(f.resto)}`
}

/**
 * Los campos del formulario (4.11) y su frase, para crear (`modo: 'nuevo'`, con el nombre arriba y
 * «Crear hábito» · «Cancelar») o editar (el hábito abierto: cada cambio se guarda al instante). Los
 * textos (nombre, unidad, hora) llevan `data-campo` (main.js no los pisa al redibujar). `avisar`: el
 * interruptor «Avisar» de la configuración (sin él, «solo globo · Windows apagado en Configuración»).
 */
export function formulario(h, { modo = 'nuevo', errForm = null, avisar = true } = {}) {
  const nuevo = modo === 'nuevo'
  const fid = nuevo ? 'nuevo' : escapar(h.id)
  const tipos = radios('hab-tipo', NOMBRES_TIPO, h.tipo, 'Tipo', '', (v, t, a) => `<button type="button" class="fc" ${a} data-accion="hab-tipo" data-valor="${v}" data-k="tipo-${v}">${t}</button>`)
  let extra = ''
  if (h.tipo === 'cantidad') {
    extra = `<span class="det-l">Meta</span><div class="det-f">${paso('meta', h.meta, 'Meta por día')}`
      + `<label class="campo mini"><input data-campo="unidad" data-k="unidad-${fid}" maxlength="16" value="${escapar(h.unidad ?? '')}" placeholder="vasos" aria-label="Unidad"></label><span class="cifras">por día</span></div>`
  } else if (h.tipo === 'dias') {
    extra = '<span class="det-l">Días</span><div class="det-f dsem" role="group" aria-label="Días">'
      + LETRAS_DIAS.map((l, i) => `<button type="button" aria-pressed="${(h.dias ?? []).includes(i)}" aria-label="${DIAS_LARGOS[i]}" title="${DIAS_LARGOS[i]}" data-accion="hab-dia" data-valor="${i}" data-k="dia-${i}">${l}</button>`).join('')
      + '</div>'
  } else if (h.tipo === 'semana') {
    extra = `<span class="det-l">Veces</span><div class="det-f">${paso('veces', h.veces, 'Veces por semana')}<span class="cifras">por semana</span></div>`
  }
  const nota = avisar ? 'globo + Windows' : 'solo globo · Windows apagado en Configuración'
  const aviso = `<button type="button" class="sw" role="switch" aria-checked="${!!h.aviso}" aria-label="Aviso" data-accion="hab-aviso" data-k="sw-aviso"></button>`
    + (h.aviso
      ? `<input type="time" class="fecha-in" value="${escapar(h.aviso)}" aria-label="Hora del aviso" data-campo="hora" data-cambio="hab-hora" data-k="hora-${fid}"><span class="cifras">${nota}</span>`
      : '<span class="cifras">sin aviso</span>')
  const colores = radios('hab-color', COLORES.map(c => [c, NOMBRES_COLOR[c]]), colorDe(h.color), 'Color', ' colores',
    (v, t, a) => `<button type="button" class="col" ${a} style="--c:var(--${v})" aria-label="${t}" data-accion="hab-color" data-valor="${v}" data-k="col-${v}"></button>`)
  const campos = `<div class="det-g"><span class="det-l">Tipo</span>${tipos}${extra}<span class="det-l">Aviso</span><div class="det-f">${aviso}</div>`
    + `<span class="det-l">Color</span>${colores}</div>`
    + `<p class="frase" data-frase>${fraseHtml(h)}</p>`
    + (errForm ? `<p class="e-form" role="alert">${escapar(errForm)}</p>` : '')
  if (!nuevo) return campos
  return `<div class="frm" data-form="nuevo"><label class="campo"><input data-campo="nombre" data-k="nom-in-nuevo" maxlength="40" value="${escapar(h.nombre ?? '')}" placeholder="Caminar, tomar agua, leer…" aria-label="Nombre del hábito"><kbd>Enter</kbd></label>`
    + campos
    + '<div class="acc-c"><button type="button" class="btn" data-accion="hab-crear" data-k="crear">Crear hábito</button><button type="button" class="lnk" data-accion="hab-cancelar" data-k="cancelar">Cancelar</button></div></div>'
}

// ------------------------------------------------------------------ el hábito abierto (4.10)

/** Las últimas 5 semanas (4.10): 5 filas de 7 celdas de 14 con los rótulos arriba, como una sola imagen con su nombre. */
function calendario(h, hoy) {
  const u = ultimasSemanas(h, hoy)
  const filas = u.filas.map(f => `<div class="sem">${f.map(c => `<span class="cel s-${c.estado}${c.dia === hoy ? ' hoy' : ''}"${c.estado === 'parcial' ? ` style="--p:${c.p}%"` : ''}></span>`).join('')}</div>`).join('')
  return `<div class="cal"><h3 class="sub">Últimas 5 semanas</h3><div class="cal-g" role="img" aria-label="Últimas 5 semanas de ${escapar(h.nombre)}: ${u.hechos} días hechos">`
    + `<div class="letras" aria-hidden="true">${letras(hoy, false)}</div>${filas}</div></div>`
}

/** El hábito abierto (4.10): el nombre editable, la racha grande, las últimas 5 semanas, la configuración y el pie. */
function detalle(h, { hoy, armado, transcurrido, errForm, avisar, fx }) {
  const n = racha(h, hoy)
  const sube = fx?.id === h.id && fx.sube ? ' sube' : ''
  return `<div class="det frm" data-form="${escapar(h.id)}">`
    + `<div class="hb-tit" style="--c:${color(h.color)}"><i class="pt" aria-hidden="true"></i><textarea class="tit-in" rows="1" maxlength="40" aria-label="Nombre del hábito" data-campo="nombre" data-k="nom-in-${escapar(h.id)}">${escapar(h.nombre)}</textarea></div>`
    + `<div class="racha-g r${nivelRacha(n)}${sube}">${ICONO.brasa}<b>${n}</b><span>${escapar(textoRachaGrande(h, n))}<small>la mejor: ${mejorRacha(h, hoy)} · desde el ${desdeEl(h.creado ?? 0)}</small></span></div>`
    + calendario(h, hoy)
    + formulario(h, { modo: 'editar', errForm, avisar })
    + `<div class="det-pie"><span class="cifras">Creado el ${desdeEl(h.creado ?? 0)}</span>${confirmable('hab-borrar', h.id, 'borrar', 'Borrar hábito', textoBorrar(h, hoy), armado, transcurrido)}</div>`
    + '</div>'
}

// ------------------------------------------------------------------ el panel por partes (3.3, 3.4)

/**
 * Las partes de la carpeta (3.5): `idx` (el índice), `paneH` (el encabezado o «‹ {Hoy|Semana}»),
 * `err` (7.4 o 7.6) y `cuerpo` (la vista). `fx` y `recien` son de un solo dibujo (el tilde, el vaso, la
 * celda, la fila nueva): main.js no los cuenta en la firma, así un redibujo no repite el acto.
 */
export function partesHoja({
  ver, desde = 'hoy', lista, rotas = [], leido = true, fantasmas: fant = false, hoy, errorGuardar = false, armado = false,
  transcurrido = 0, borrador = null, errForm = null, avisar = true, mascota = 'avi', fx = null, recien = null,
}) {
  const c = leido ? cuentasHoy(lista, hoy) : null
  const idx = indiceHabitos({ ver, lista, rotas, cuentas: c, hoy })
  const errG = errorGuardar ? errorGuardarHab() : ''
  if (String(ver).startsWith('rota:')) {
    return { idx, paneH: `<header class="pane-h"><h2 id="hab-pane-h">${escapar(ver.slice(5))}</h2></header>`, err: errorRotaHab(), cuerpo: '' }
  }
  if (ver === 'nuevo') {
    return { idx, paneH: '<header class="pane-h"><h2 id="hab-pane-h">Nuevo hábito</h2></header>', err: errG, cuerpo: formulario(borrador ?? {}, { modo: 'nuevo', errForm, avisar }) }
  }
  if (esHabito(ver)) {
    const h = lista.find(x => x.id === ver)
    if (h) {
      const paneH = `<button type="button" class="lnk atras" data-accion="hab-cerrar-habito" data-k="atras">‹ ${desde === 'semana' ? 'Semana' : 'Hoy'}</button><h2 class="oculto" id="hab-pane-h">${escapar(h.nombre)}</h2>`
      return { idx, paneH, err: errG, cuerpo: detalle(h, { hoy, armado, transcurrido, errForm, avisar, fx }) }
    }
  }
  if (ver === 'semana') {
    const lunes = lunesDe(hoy)
    const paneH = `<header class="pane-h"><h2 id="hab-pane-h">Semana</h2><div class="pane-s"><span>${escapar(cabeceraSemana(lunes, pctSemana(lista, lunes, hoy)))}</span></div></header>`
    return { idx, paneH, err: errG, cuerpo: !leido && fant ? fantasmas : cuerpoSemana({ lista, hoy, fx }) }
  }
  return { idx, paneH: cabeceraHoy(c), err: errG, cuerpo: !leido ? (fant ? fantasmas : '') : cuerpoHoy({ lista, hoy, fx, recien, mascota }) }
}

// ------------------------------------------------------------------ primer uso y errores (5.2, 7.2 a 7.6)

/** Primer uso, sin hábitos (7.2): la mascota saluda, las cuatro sugeridas y «+ Otro hábito…». */
export function primerUsoHabitos(especie) {
  const sug = SUGERIDAS.map(s => `<button type="button" class="fc" data-accion="hab-sugerida" data-valor="${s.id}" data-k="sug-${s.id}" aria-label="${escapar(`${s.nombre} · ${s.detalle}`)}">`
    + `<i class="pt" style="--c:var(--${s.color})" aria-hidden="true"></i>${escapar(s.nombre)}<span class="ct" aria-hidden="true">${escapar(s.detalle)}</span></button>`).join('')
  return `<div class="primer">${avi(mascotaDe(especie), 'saluda', 96)}<b>Armá tu primer hábito</b>`
    + '<p>Algo chico que quieras hacer seguido. Queda en esta PC y, si querés, te aviso a la hora que elijas.</p>'
    + `<div class="sug" role="group" aria-label="Sugeridas">${sug}</div>`
    + '<button type="button" class="lnk" data-accion="hab-nuevo" data-k="primer-otro">+ Otro hábito…</button></div>'
}

/** No se guardó el último cambio (7.4): lo de la pantalla queda y reintenta solo. */
export function errorGuardarHab() {
  return err('No se guardó el último cambio.', 'Sigue en pantalla. Reintento solo en 5 s.', boton('hab-reintentar', 'reintentar', 'Reintentar ahora'))
}

/** Un archivo que no se pudo leer (7.6): nunca se toca. */
export function errorRotaHab() {
  return err('Un hábito no se pudo leer.', 'El archivo quedó como estaba, en la carpeta de hábitos. Los demás andan.',
    boton('hab-carpeta', 'carpeta', 'Abrir la carpeta') + boton('hab-releer', 'releer', 'Volver a leer'))
}

const TITULO_CARPETA = 'No se pudo abrir la carpeta de hábitos.'

/** La carpeta no se pudo abrir (5.2): el detalle corto, si dice algo más que el título. */
export function errorCarpetaHab(detalle) {
  const d = String(detalle ?? '').trim()
  return err(TITULO_CARPETA, d && d !== TITULO_CARPETA ? escapar(d) : '', boton('hab-releer', 'releer', 'Volver a leer'))
}

/** La píldora del hito (4.14): `aria-hidden`; el texto va al anuncio. */
export function hitoHtml(texto) {
  return `<div class="hito" aria-hidden="true">${ICONO.brasa}${escapar(texto)}</div>`
}

// ------------------------------------------------------------------ el globo del recordatorio (H2: 8.2, 8.5 y 5.4)

const atrX = (t, id) => `data-valor="${escapar(id)}" aria-label="${escapar(t.x.nombre)}" title="${escapar(t.x.titulo)}"`
/** El visto ámbar en un círculo `--tinta` de 16 delante del texto de «Hecho» (8.5). */
const OK = `<span class="gh-ok" aria-hidden="true">${ICONO.visto}</span>`

/**
 * El globo de la marca para Hábitos (8.5, `.globo-hab` sobre la base de `.globo-tar`): arriba el texto
 * de 5.4 y la × («Ahora no»); abajo «+1 {unidad}» o «Hecho» (la píldora con el punto del color del
 * hábito) y «Ver hábitos →». `t`: lo de `textosGlobo`. Con `confirma` (los tramos de `textoHechoGlobo`)
 * es la confirmación de 1,8 s: el visto y ese texto, sin las acciones; la × sigue (ahí queda el foco).
 */
export function globoHab(t, { id, color: tono, confirma = null }) {
  const v = `data-valor="${escapar(id)}"`
  const texto = confirma ? `${OK}${tramos(confirma)}` : tramos(t.globo)
  const acciones = confirma ? '' : `<div class="gh-acc"><button type="button" class="g-hacer" data-accion="hab-globo-hacer" ${v}>`
    + `<span class="pt" style="--hc: ${color(tono)}" aria-hidden="true"></span>${escapar(t.hacer)}</button>`
    + `<button type="button" class="g-ver" data-accion="hab-globo-ver" ${v}>${escapar(t.ver)}</button></div>`
  return `<div class="globo-tar globo-hab${confirma ? ' confirma' : ''}" data-globo-hab ${v}><div class="gh-arriba"><p class="globo-t">${texto}</p>`
    + `<button type="button" class="globo-x" data-accion="hab-globo-x" ${atrX(t, id)}>${X}</button></div>${acciones}</div>`
}

/**
 * Lo de adentro del globo de la muesca (`#muesca-globo`, 5.4) para un recordatorio: «16:00 · {nombre}
 * {v} de {meta}» con el anillo de 14 (cantidad) o «19:00 · {nombre}», y «Ver →»; `nombre`, el del botón.
 */
export function globoMuescaHab(t) {
  const anillo = t.progreso ? `<span class="mt-a" aria-hidden="true">${anilloMini(t.progreso.hechos, t.progreso.total)}</span>` : ''
  return { html: `<span class="mt-t">${tramos(t.muesca)}</span>${anillo}<span class="mt-c">Ver <span aria-hidden="true">→</span></span>`, nombre: `${t.texto} Ver hábitos` }
}

/**
 * La fila de la dividida para un recordatorio (5.4; la de `filaAviso` de Tareas): el texto corto, «+1» o
 * «Hecho», «Ver →» y la ×. Con `confirma`, el texto de «Hecho» y solo la ×.
 */
export function filaAvisoHab(t, { id, confirma = null }) {
  const v = `data-valor="${escapar(id)}"`
  const acciones = confirma ? '' : `<button type="button" class="lnk" data-accion="hab-globo-hacer" ${v}>${escapar(t.hacerFila)}</button>`
    + `<button type="button" class="lnk" data-accion="hab-globo-ver" ${v}>Ver →</button>`
  return `<div class="aviso aviso-tar aviso-hab" data-globo-hab ${v}><span class="at-t">${tramos(confirma ?? t.fila)}</span>${acciones}`
    + `<button type="button" class="tb" data-accion="hab-globo-x" ${atrX(t, id)}>${X}</button></div>`
}
