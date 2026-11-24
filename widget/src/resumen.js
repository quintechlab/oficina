// "¿En qué anda Claude?" (docs/diseno/resumen-ia-ux.md, opción A "Te lo cuenta el Avi"): lógica pura
// del globo del resumen. La máquina de estados (`transicion`), los datos que se le pasan al modelo con
// sus topes (`datosResumen`), los textos por estado (`contenidoResumen`), los avisos para el lector de
// pantalla y la voz del Avi. No toca el DOM ni Tauri: main.js lo cablea y los tests lo revisan.
// Reglas de oro (1): un clic, nunca solo; el modelo solo resume (este módulo no importa responder.js y
// nunca dibuja opciones de una pregunta); nada sale a la red salvo la descarga pedida con un clic.

import { escapar, plural, textoActividad, tiempoRelativo, tiempoSubagente } from './logica.js'
import { ANIMO } from './tablero.js'

/** Los 8 estados del globo (6). "cerrado": sin globo (el trabajo puede seguir por detrás). */
export const ESTADOS_RESUMEN = ['cerrado', 'apagado', 'descargando', 'preparando', 'pensando', 'listo', 'sinModelo', 'fallo']

/** Topes de lo que se le pasa al modelo (8.3) y del texto que vuelve (4.3), en caracteres. */
export const TOPES_RESUMEN = Object.freeze({ sesiones: 12, subagentes: 6, procesos: 4, texto: 200, resumen: 600 })

/** Pensando sin respuesta más de esto: falló por tiempo y se cancela (6.1). */
export const ESPERA_PENSANDO_MS = 60000

/** Título de "Falló" por motivo (4.2). Otro motivo: sin título extra. */
export const MOTIVOS_FALLO = Object.freeze({
  cerrado: 'El motor se cerró antes de terminar',
  tiempo: 'El motor tardó más de un minuto',
  vacio: 'El modelo no devolvió texto',
  descarga: 'No se pudo bajar el modelo',
})

/** Los `tipo` del evento `oficina://resumen` (8.2), más `estado` (la forma de `estado_resumen`). */
export const EVENTOS_BACKEND = ['estado', 'progreso', 'bajado', 'preparando', 'pensando', 'listo', 'fallo', 'cancelado']

const EN_CURSO = ['descargando', 'preparando', 'pensando']
const MODELOS = ['falta', 'bajando', 'listo', 'roto']

/**
 * El estado inicial de `st.resumen` (3.3). `estado`: lo que se ve; `trabajo`: lo que corre por detrás
 * (sigue con el globo cerrado); `modelo`: lo último que dijo el backend (null: todavía no se sabe);
 * `resultado`: 'listo' o 'fallo' del último pedido; `pedido`: crece en cada pedido; `leyendo`:
 * "Leyendo …" de lo que se le pasó en ese pedido.
 */
export function resumenInicial() {
  return {
    estado: 'cerrado', trabajo: null, modelo: null, motor: 'apagado', primeraVez: true,
    progreso: { bajado: 0, total: 0 },
    resultado: null, texto: null, hora: null, ms: null, aceleracion: null, detalle: null, motivo: null,
    firma: null, leyendo: null, cambio: false, pedido: 0, sinVer: false, hablando: false, soloBajar: false,
  }
}

const abierto = r => r.estado !== 'cerrado'
const numero = n => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Number(n) : 0)
const NADA = r => ({ resumen: r, llamadas: [] })

/** Un pedido nuevo: el número crece, se guarda la firma de los datos y se llama a `pedir_resumen`. */
function pedir(r, ctx, trabajo = 'pensando') {
  const pedido = r.pedido + 1
  const datos = ctx.datos ?? null
  return {
    resumen: {
      ...r, pedido, trabajo, estado: abierto(r) ? trabajo : 'cerrado', resultado: null, texto: null, motivo: null, detalle: null,
      cambio: false, sinVer: false, hablando: false, firma: datos ? firmaResumen(datos) : null,
      // "Leyendo …" cuenta lo que se le pasó al modelo en este pedido
      leyendo: datos ? textoPensando(datos) : null,
    },
    llamadas: [{ comando: 'pedir_resumen', args: { pedido, datos } }],
  }
}

/**
 * Empieza a bajar el modelo. Desde el globo (`solo` falso), al terminar prepara y pide el primer
 * resumen (el clic lo incluía). Desde la configuración (`solo`, configuracion-ux.md 7.2) baja y nada
 * más: el globo no se abre y bajar no pide un resumen (un clic, nunca solo).
 */
function descargar(r, { solo = false } = {}) {
  return {
    resumen: {
      ...r, trabajo: 'descargando', estado: solo && !abierto(r) ? 'cerrado' : 'descargando', modelo: 'bajando', soloBajar: solo,
      resultado: null, motivo: null, detalle: null, sinVer: false, hablando: false,
    },
    llamadas: [{ comando: 'descargar_modelo', args: {} }],
  }
}

/** Termina el trabajo con un fallo (o sin modelo si el motivo es `falta`). */
function fallar(r, motivo, detalle) {
  if (motivo === 'falta') {
    return { ...r, trabajo: null, modelo: 'roto', resultado: null, estado: abierto(r) ? 'sinModelo' : 'cerrado', hablando: false }
  }
  const m = motivo in MOTIVOS_FALLO ? motivo : 'otro'
  const d = detalle == null || detalle === '' ? null : recortar(String(detalle), TOPES_RESUMEN.texto)
  return { ...r, trabajo: null, resultado: 'fallo', motivo: m, detalle: d, texto: null, estado: abierto(r) ? 'fallo' : 'cerrado', sinVer: !abierto(r), hablando: false }
}

/** ¿El evento es del pedido vigente, con un pedido en curso? */
const vigente = (r, ev) => ev.pedido === r.pedido && (r.trabajo === 'preparando' || r.trabajo === 'pensando')

/**
 * El reductor del globo (6.1): de `r` (st.resumen) y un evento al resumen nuevo y las llamadas al
 * backend que hay que hacer, `{ resumen, llamadas: [{ comando, args }] }`. Si nada cambia devuelve
 * el mismo objeto. Solo las acciones del usuario empiezan trabajo (`abrir` con el modelo listo,
 * `descargar`, `pedir`, `reintentar`); `cerrar` nunca cancela. Los eventos del backend solo avanzan
 * lo que ya se pidió. `ctx`: `{ ahoraMs, datos }` (los de `datosResumen`, para pedir y para "Cambió algo").
 */
export function transicion(r, ev, ctx = {}) {
  switch (ev?.tipo) {
    // ---------------------------------------------------------------- acciones del usuario
    case 'abrir': {
      if (abierto(r)) return NADA(r)
      if (r.trabajo) return NADA({ ...r, estado: r.trabajo })
      if (r.sinVer && r.resultado) {
        const cambio = r.resultado === 'listo' && !!ctx.datos && !!r.firma && firmaResumen(ctx.datos) !== r.firma
        return NADA({ ...r, estado: r.resultado, sinVer: false, cambio })
      }
      if (r.modelo === 'roto') return NADA({ ...r, estado: 'sinModelo' })
      if (r.modelo === 'listo') return pedir({ ...r, estado: 'pensando' }, ctx)
      return NADA({ ...r, estado: 'apagado' })
    }
    case 'cerrar':
      return abierto(r) ? NADA({ ...r, estado: 'cerrado', sinVer: false, hablando: false }) : NADA(r)
    case 'descargar':
      // Desde la configuración: con el modelo que falta o roto y nada en curso, esté o no el globo abierto
      if (ev.desde === 'config') return !r.trabajo && ['falta', 'roto', 'bajando'].includes(r.modelo) ? descargar(r, { solo: true }) : NADA(r)
      return r.estado === 'apagado' || r.estado === 'sinModelo' || (r.estado === 'fallo' && r.motivo === 'descarga') ? descargar(r) : NADA(r)
    case 'pedir':
      return r.estado === 'listo' || (r.estado === 'fallo' && r.motivo !== 'descarga') ? pedir(r, ctx) : NADA(r)
    case 'reintentar':
      if (r.estado !== 'fallo') return NADA(r)
      return r.motivo === 'descarga' ? descargar(r) : pedir(r, ctx)
    case 'cancelar': {
      if (!abierto(r) || r.estado !== r.trabajo) return NADA(r)
      const llamadas = [{ comando: 'cancelar_resumen', args: {} }]
      // La descarga cancelada vuelve a apagado y lo bajado queda para seguir; preparando y pensando, a cerrado
      if (r.trabajo === 'descargando') return { resumen: { ...r, trabajo: null, modelo: 'falta', estado: 'apagado' }, llamadas }
      return { resumen: { ...r, trabajo: null, estado: 'cerrado', hablando: false }, llamadas }
    }
    case 'datos': {
      // Sin rearmado: con el resumen listo, los cambios solo avisan
      if (r.estado !== 'listo' || !ctx.datos || !r.firma) return NADA(r)
      const cambio = firmaResumen(ctx.datos) !== r.firma
      return cambio === r.cambio ? NADA(r) : NADA({ ...r, cambio })
    }
    case 'callado':
      return r.hablando ? NADA({ ...r, hablando: false }) : NADA(r)
    case 'vencio':
      if (r.trabajo !== 'pensando' || ev.pedido !== r.pedido) return NADA(r)
      return { resumen: fallar(r, 'tiempo'), llamadas: [{ comando: 'cancelar_resumen', args: {} }] }

    // ---------------------------------------------------------------- eventos del backend
    case 'estado': {
      const modelo = MODELOS.includes(ev.modelo) ? ev.modelo : r.modelo
      let s = {
        ...r, modelo, motor: ev.motor ?? r.motor, primeraVez: ev.primeraVez ?? r.primeraVez,
        aceleracion: ev.aceleracion === undefined ? r.aceleracion : ev.aceleracion,
        progreso: { bajado: numero(ev.bajado), total: numero(ev.total) || r.progreso.total },
      }
      // Al arrancar (todavía no se sabía del modelo), Rust puede estar bajándolo de un clic anterior
      if (modelo === 'bajando' && r.modelo == null && !r.trabajo) s.trabajo = 'descargando'
      // La descarga terminó o se cortó por fuera (el modelo no está): nada en curso
      if (r.trabajo === 'descargando' && (modelo === 'falta' || modelo === 'roto')) {
        s = { ...s, trabajo: null, estado: abierto(r) ? (modelo === 'falta' ? 'apagado' : 'sinModelo') : 'cerrado' }
      }
      // El modelo que estaba se borró (desde la bandeja) o se rompió: el globo vuelve a apagado
      if (r.modelo === 'listo' && (modelo === 'falta' || modelo === 'roto')) {
        s = {
          ...s, trabajo: null, resultado: null, texto: null, sinVer: false, cambio: false, hablando: false,
          estado: abierto(r) ? (modelo === 'falta' ? 'apagado' : 'sinModelo') : 'cerrado',
        }
      }
      return NADA(s)
    }
    case 'progreso':
      if (r.trabajo !== 'descargando') return NADA(r)
      return NADA({ ...r, progreso: { bajado: numero(ev.bajado), total: numero(ev.total) || r.progreso.total } })
    case 'bajado': {
      if (r.trabajo !== 'descargando') return NADA(r)
      const total = numero(ev.total) || r.progreso.total
      // Bajado desde la configuración: queda listo, sin pedir nada (si el globo estaba abierto, se cierra)
      if (r.soloBajar) return NADA({ ...r, trabajo: null, modelo: 'listo', soloBajar: false, progreso: { bajado: total, total }, estado: 'cerrado', hablando: false })
      // El clic en "Descargar" incluye el primer resumen
      return pedir({ ...r, modelo: 'listo', progreso: { bajado: total, total } }, ctx, 'preparando')
    }
    case 'preparando':
      if (!vigente(r, ev)) return NADA(r)
      return NADA({ ...r, trabajo: 'preparando', primeraVez: ev.primeraVez !== false, estado: abierto(r) ? 'preparando' : 'cerrado' })
    case 'pensando':
      if (!vigente(r, ev)) return NADA(r)
      return NADA({ ...r, trabajo: 'pensando', estado: abierto(r) ? 'pensando' : 'cerrado' })
    case 'listo': {
      if (!vigente(r, ev)) return NADA(r)
      const texto = limpiarTexto(ev.texto)
      if (texto == null) return NADA(fallar(r, 'vacio'))
      const ms = Number.isFinite(Number(ev.ms)) && ev.ms != null ? Number(ev.ms) : null
      return NADA({
        ...r, trabajo: null, resultado: 'listo', texto, ms, hora: ctx.ahoraMs ?? Date.now(),
        aceleracion: ev.aceleracion ?? r.aceleracion, motivo: null, detalle: null, cambio: false,
        estado: abierto(r) ? 'listo' : 'cerrado', sinVer: !abierto(r), hablando: abierto(r),
      })
    }
    case 'fallo': {
      const aplica = ev.pedido == null ? EN_CURSO.includes(r.trabajo) : vigente(r, ev)
      if (!aplica) return NADA(r)
      const motivo = r.trabajo === 'descargando' && ev.motivo !== 'falta' ? 'descarga' : ev.motivo
      return NADA(fallar(r, motivo, ev.detalle))
    }
    case 'cancelado':
    default:
      return NADA(r)
  }
}

// ------------------------------------------------------------------ datos para el modelo (8.3)

/** Corta un texto al tope, con "…" si no entró. */
function recortar(t, tope = TOPES_RESUMEN.texto) {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim()
  return s.length > tope ? `${s.slice(0, tope - 1).trimEnd()}…` : s
}

/**
 * Lo que se le pasa al modelo, a partir de `st.proyectos` (solo las sesiones de esta máquina). Por
 * proyecto el nombre; por sesión la tarea, la rama, la actividad como la dice el tablero y cuánto
 * lleva; sus subagentes, procesos y preguntas (encabezado y texto, sin las opciones: el modelo no
 * tiene de qué elegir). Nunca archivos, usuario, nombre de la persona, nota, repo completo, equipo
 * ni respuestas. Topes: 12 sesiones, 6 subagentes y 4 procesos por sesión, 200 caracteres por texto.
 */
/**
 * Línea de diagnóstico al tocar el Avi (`widget.log`): lo que la UI creía antes (modelo, trabajo,
 * estado) y lo que muestra después. Junto con la línea `resumen estado:` del motor dice por qué el
 * globo ofreció descargar.
 */
export function lineaAbrir(antes, despues) {
  const v = x => (x == null ? '?' : x)
  return `resumen abrir: antes modelo=${v(antes?.modelo)} trabajo=${antes?.trabajo ?? '-'} estado=${v(antes?.estado)}; `
    + `ahora estado=${v(despues?.estado)} trabajo=${despues?.trabajo ?? '-'}`
}

/** Lo que se le dice al modelo de una sesión quieta: sin pendientes (el tablero dice "esperando tu mensaje"). */
export const ACTIVIDAD_QUIETA = 'quieta: terminó lo que estaba haciendo, no hay nada pendiente'

/**
 * La actividad de una sesión para el modelo: la del tablero, salvo una sesión que solo terminó su
 * turno ("esperando tu mensaje"), que va como quieta sin pendientes. Así el resumen no inventa que
 * algo espera una respuesta tuya; lo único pendiente son las preguntas, que van aparte.
 */
export function actividadParaResumen(s, ahoraMs) {
  const quieta = s?.actividad === 'esperándote' && !(s.preguntas ?? []).length
  return quieta ? ACTIVIDAD_QUIETA : textoActividad(s, ahoraMs)
}

export function datosResumen(proyectos, ahoraMs) {
  const T = TOPES_RESUMEN
  let quedan = T.sesiones
  const lista = []
  for (const p of proyectos ?? []) {
    if (quedan <= 0) break
    const sesiones = p.sesiones.slice(0, quedan).map(s => ({
      tarea: s.tarea ?? null,
      rama: s.rama ? recortar(s.rama) : null,
      actividad: recortar(actividadParaResumen(s, ahoraMs)),
      // Cuánto hace que se abrió la sesión (no cuánto hace que espera algo)
      abierta_hace: tiempoRelativo(s.inicio ?? s.actualizado, ahoraMs),
      subagentes: (s.agentes ?? []).slice(0, T.subagentes).map(a => ({
        nombre: recortar(a.nombre), tarea: recortar(a.tarea), estado: a.estado, desde: tiempoSubagente(a, ahoraMs),
      })),
      procesos: (Array.isArray(s.procesos) ? s.procesos : []).slice(0, T.procesos).map(x => ({
        descripcion: recortar(x.descripcion), desde: tiempoRelativo(x.desde, ahoraMs),
      })),
      preguntas: (s.preguntas ?? []).flatMap(q => (q.items ?? []).map(i => ({ encabezado: recortar(i.encabezado), pregunta: recortar(i.pregunta) }))),
    }))
    quedan -= sesiones.length
    lista.push({ nombre: recortar(p.nombre), sesiones })
  }
  return { proyectos: lista }
}

/** Firma de los datos sin los tiempos relativos: el paso de los minutos no dispara "Cambió algo". */
export function firmaResumen(datos) {
  return JSON.stringify(datos, (k, v) => (k === 'abierta_hace' || k === 'desde' ? undefined : v))
}

/** "Leyendo 3 sesiones, 2 subagentes y 1 proceso": cuenta lo que se le pasa y omite los ceros. */
export function textoPensando(datos) {
  const ses = (datos?.proyectos ?? []).flatMap(p => p.sesiones)
  const sub = ses.reduce((n, s) => n + (s.subagentes?.length ?? 0), 0)
  const pro = ses.reduce((n, s) => n + (s.procesos?.length ?? 0), 0)
  const partes = [
    ses.length && plural(ses.length, 'sesión', 'sesiones'), sub && plural(sub, 'subagente', 'subagentes'), pro && plural(pro, 'proceso', 'procesos'),
  ].filter(Boolean)
  if (!partes.length) return 'Leyendo'
  const ultimo = partes.pop()
  return `Leyendo ${partes.length ? `${partes.join(', ')} y ${ultimo}` : ultimo}`
}

// ------------------------------------------------------------------ cifras (4.1)

const GB = 1024 ** 3
const coma = n => n.toFixed(1).replace('.', ',')

/** "2,6 GB" (gigas como los cuenta Windows, 1024³), o solo la cifra ("1,1") con `unidad: false`. */
export function formatoGB(bytes, { unidad = true } = {}) {
  const t = coma(numero(bytes) / GB)
  return unidad ? `${t} GB` : t
}

/** "3,1 s". */
export const formatoSegundos = ms => `${coma(numero(ms) / 1000)} s`

/** "14:32", del reloj de la PC, 24 h. */
export function formatoHora(ms) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ------------------------------------------------------------------ el texto del modelo (4.3)

/**
 * Texto plano limpio: recorta espacios, junta los saltos repetidos y corta a 600 caracteres en el
 * último fin de frase (si no hay, en la última palabra con "…"). Vacío → null (falló, `vacio`).
 */
export function limpiarTexto(texto) {
  if (texto == null) return null
  let t = String(texto).replace(/\r/g, '').split('\n').map(l => l.replace(/[ \t\f\v]+/g, ' ').trim()).filter(Boolean).join('\n')
  if (!t) return null
  const tope = TOPES_RESUMEN.resumen
  if (t.length > tope) {
    const corte = t.slice(0, tope)
    const fin = Math.max(...['.', '!', '?', '…'].map(c => corte.lastIndexOf(c)))
    t = fin > 0 ? corte.slice(0, fin + 1) : `${corte.slice(0, corte.lastIndexOf(' ') > 0 ? corte.lastIndexOf(' ') : tope - 1).trimEnd()}…`
  }
  return t
}

const LETRA = /[\p{L}\p{N}_-]/u

/**
 * El texto en trozos `{ t }` o `{ proyecto }`: los nombres de proyecto que aparecen tal cual, enteros
 * (sin una letra, número, "-" o "_" pegado), se marcan como etiqueta. Nunca se inventa una etiqueta.
 * Los trozos son texto plano: `htmlTexto` los escapa.
 */
export function partesTexto(texto, nombres = []) {
  const s = String(texto ?? '')
  const lista = [...new Set(nombres.filter(Boolean))].sort((a, b) => b.length - a.length)
  const partes = []
  let resto = '', i = 0
  while (i < s.length) {
    const n = lista.find(nom => s.startsWith(nom, i) && !LETRA.test(s[i - 1] ?? '') && !LETRA.test(s[i + nom.length] ?? ''))
    if (n) {
      if (resto) partes.push({ t: resto })
      partes.push({ proyecto: n })
      resto = ''
      i += n.length
    } else {
      resto += s[i++]
    }
  }
  if (resto) partes.push({ t: resto })
  return partes
}

/** Cuántas palabras tiene el texto (la cascada de 9.1 y la duración de "contando"). */
export const contarPalabras = texto => String(texto ?? '').split(/\s+/).filter(Boolean).length

/**
 * El HTML del texto, siempre escapado. `colores`: nombre de proyecto → color (`colorProyecto`).
 * `palabras`: cada palabra en su `span.w` con su índice, para la cascada de resumenMotion.js.
 */
export function htmlTexto(partes, { colores = {}, palabras = false } = {}) {
  let i = 0
  const w = t => (palabras ? `<span class="w" style="--i:${i++}">${t}</span>` : t)
  return partes.map(p => {
    if (p.proyecto != null) {
      const c = colores[p.proyecto] ? ` style="--c:${escapar(colores[p.proyecto])}"` : ''
      const etiqueta = `<span class="pj-t"${c}>${escapar(p.proyecto)}</span>`
      return palabras ? `<span class="w" style="--i:${i++}">${etiqueta}</span>` : etiqueta
    }
    return String(p.t).split(/(\s+)/).map(t => (!t || /^\s+$/.test(t) ? t : w(escapar(t)))).join('')
  }).join('')
}

// ------------------------------------------------------------------ el globo por estado (4.1)

const ICONO = {
  x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8"/></svg>',
  copiar: '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="4.5" y="4.5" width="8" height="8" rx="2"/><path d="M9.5 2.5v-.2A1.3 1.3 0 0 0 8.2 1H2.3A1.3 1.3 0 0 0 1 2.3v5.9a1.3 1.3 0 0 0 1.3 1.3h.2"/></svg>',
  otra: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M12 7a5 5 0 1 1-1.5-3.6M12 1.5v3h-3"/></svg>',
  baja: '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5v8M3.5 6.5L7 10l3.5-3.5M2 12.5h10"/></svg>',
}
const CON_CRUZ = ['apagado', 'listo', 'sinModelo', 'fallo']

const rotulo = t => `<p class="rz-k"><i class="pt"></i>${t}</p>`
const titulo = t => `<p class="rz-t">${t}</p>`
const cuerpo = t => `<p class="rz-p">${t}</p>`
const meta = t => `<p class="rz-meta">${t}</p>`
const acciones = (...b) => `<div class="rz-acc">${b.join('')}</div>`
const primario = (accion, texto, icono = '') => `<button type="button" class="bt-p" data-accion="${accion}" data-foco>${icono}${texto}</button>`
const secundario = (accion, texto, { foco = false, icono = '' } = {}) => `<button type="button" class="bt-s" data-accion="${accion}"${foco ? ' data-foco' : ''}>${icono}${texto}</button>`
const conTotal = (texto, total) => (total > 0 ? `${texto} · ${formatoGB(total)}` : texto)

/** Cifra, total y porcentaje de la descarga (la UI los reescribe en su lugar con cada progreso). */
export function cifrasDescarga(progreso) {
  const { bajado = 0, total = 0 } = progreso ?? {}
  const p = total > 0 ? Math.min(1, numero(bajado) / total) : 0
  return { cifra: formatoGB(bajado, { unidad: false }), total: total > 0 ? formatoGB(total) : '…', porcentaje: Math.round(p * 100), fraccion: Number(p.toFixed(4)) }
}

/** ¿Hay una descarga cortada para seguir? (decisión del usuario: "Se retoma después"). */
const parcial = p => p != null && p.bajado > 0 && p.total > 0 && p.bajado < p.total

function bloques(m) {
  const total = m.progreso?.total ?? 0
  switch (m.estado) {
    case 'apagado': {
      const boton = parcial(m.progreso)
        ? primario('rz-descargar', `Seguir descargando · ${formatoGB(m.progreso.bajado, { unidad: false })} de ${formatoGB(total)}`, ICONO.baja)
        : primario('rz-descargar', total > 0 ? `Descargar ${formatoGB(total)}` : 'Descargar', ICONO.baja)
      return rotulo('Resumen con IA · apagado')
        + titulo('¿En qué anda Claude? Te lo cuento en pocas frases.')
        + cuerpo('Un modelo chico, en tu PC, lee lo que Avis ya ve (sesiones, subagentes, procesos y preguntas) y lo resume. Sin internet: nada sale de tu máquina.')
        + acciones(boton, secundario('rz-ahora-no', 'Ahora no'))
        + meta('Qwen3-4B + motor llama.cpp · se puede borrar desde la bandeja')
    }
    case 'descargando': {
      const c = cifrasDescarga(m.progreso)
      return rotulo('Bajando el modelo')
        + `<div class="cifra"><b data-gb>${c.cifra}</b><small>de ${c.total}</small><span data-pc>${c.porcentaje} %</span></div>`
        + `<div class="barra" role="progressbar" aria-label="Descarga del modelo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.porcentaje}" data-barra style="--p:${c.fraccion}"><i></i></div>`
        + meta('Podés seguir usando Avis mientras baja')
        + acciones(secundario('rz-cancelar', 'Cancelar', { foco: true }))
    }
    case 'preparando':
      return (m.primeraVez !== false
        ? rotulo('Preparando · solo la primera vez') + titulo('Acomodando el modelo en tu placa de video')
        : rotulo('Preparando') + titulo('Despertando el modelo'))
        + '<div class="barra ind" role="progressbar" aria-label="Preparando el modelo"><i></i></div>'
        + (m.primeraVez !== false ? cuerpo('Tarda 2 o 3 minutos. Después, cada resumen sale en unos 3 segundos.') : '')
        + acciones(secundario('rz-cancelar', 'Cancelar', { foco: true }))
    case 'pensando': {
      const espera = m.aceleracion === 'gpu' ? '~3 s con la placa de video' : m.aceleracion === 'cpu' ? '~11 s solo con CPU' : ''
      return rotulo('Pensando · en tu PC')
        + `<p class="rz-t">${escapar(m.leyendo ?? 'Leyendo')}<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span></p>`
        + '<div class="esq" aria-hidden="true"><i></i><i></i><i></i></div>'
        + acciones(secundario('rz-cancelar', 'Cancelar', { foco: true }), espera ? `<span class="rz-meta">${espera}</span>` : '')
    }
    case 'listo': {
      const hora = m.hora != null ? formatoHora(m.hora) : ''
      const colores = Object.fromEntries((m.proyectos ?? []).map(p => [p.nombre, p.color]))
      const texto = htmlTexto(partesTexto(m.texto, (m.proyectos ?? []).map(p => p.nombre)), { colores, palabras: !!m.cascada })
      return rotulo(['Resumen', hora, m.ms != null ? `${formatoSegundos(m.ms)} en tu PC` : ''].filter(Boolean).join(' · '))
        + `<p class="rz-texto${m.cascada ? ' cascada' : ''}" data-texto>${texto}</p>`
        + `<p class="rz-viejo" data-cambio${m.cambio ? '' : ' hidden'}>Cambió algo desde las ${hora}. <button type="button" class="bt-l" data-accion="rz-pedir">Volver a pedir</button></p>`
        + acciones(
          `<button type="button" class="bt-p" data-accion="rz-copiar" data-foco>${ICONO.copiar}<span data-copiar>Copiar</span></button>`,
          secundario('rz-pedir', 'Volver a pedir', { icono: ICONO.otra }),
        )
    }
    case 'sinModelo':
      return rotulo('Falta el modelo')
        + titulo('No encuentro el modelo en tu PC')
        + cuerpo('Puede que se haya borrado o movido. Tus sesiones siguen igual: esto no las toca.')
        + acciones(primario('rz-descargar', conTotal('Descargar de nuevo', total), ICONO.baja))
    case 'fallo':
      return rotulo('No salió el resumen')
        + (MOTIVOS_FALLO[m.motivo] ? titulo(MOTIVOS_FALLO[m.motivo]) : '')
        + cuerpo('Tus sesiones siguen igual. Probá de nuevo en un rato.')
        + (m.detalle ? `<p class="rz-det">${escapar(m.detalle)}</p>` : '')
        + acciones(primario('rz-reintentar', 'Probar de nuevo', ICONO.otra))
    default:
      return ''
  }
}

/**
 * El HTML de `#resumen` en un estado (los textos de 4.1); cerrado, vacío. `m`: el resumen más
 * `leyendo` (`textoPensando`), `proyectos` (`[{ nombre, color }]`, para las etiquetas), `cola`
 * (`colaResumen`) y `cascada` (cada palabra en su span). Nunca lleva opciones de una pregunta.
 */
export function contenidoResumen(m) {
  if (!m || !ESTADOS_RESUMEN.includes(m.estado) || m.estado === 'cerrado') return ''
  const clase = `rz-globo${m.cola ? ' cola' : ''}${m.estado === 'fallo' || m.estado === 'sinModelo' ? ' err' : ''}`
  const cruz = CON_CRUZ.includes(m.estado)
    ? `<div class="rz-x"><button type="button" class="bt-x" data-accion="rz-cerrar" aria-label="Cerrar el resumen">${ICONO.x}</button></div>`
    : ''
  return '<h2 class="oculto" id="h-resumen">¿En qué anda Claude?</h2>'
    + `<div class="${clase}" data-estado="${m.estado}"><div class="rz-c">${bloques(m)}</div>${cruz}</div>`
}

/** La cola apunta a la boca del Avi solo si el globo queda justo debajo del encabezado (3.2). */
export function colaResumen({ hayAviso = false, hayPregunta = false } = {}) {
  return !hayAviso && !hayPregunta
}

// ------------------------------------------------------------------ lector de pantalla (6.4)

/** Un aviso cortés por estado, una vez al entrar en él. `abierto` falso: el resultado llegó con el globo cerrado. */
export function anuncioResumen(estado, { texto = '', abierto: visto = true, primeraVez = true } = {}) {
  switch (estado) {
    case 'apagado': return 'Resumen apagado. Se puede descargar el modelo.'
    case 'descargando': return 'Bajando el modelo.'
    case 'preparando': return primeraVez ? 'Preparando el modelo. La primera vez tarda 2 o 3 minutos.' : 'Preparando el modelo.'
    case 'pensando': return 'Pensando el resumen.'
    case 'listo': return visto && texto ? `Resumen listo. ${texto}` : 'Resumen listo.'
    case 'cerrado': return 'Resumen cerrado.'
    case 'sinModelo': return 'Falta el modelo.'
    case 'fallo': return 'No salió el resumen.'
    default: return ''
  }
}

// ------------------------------------------------------------------ la voz del Avi (6.2)

const VOZ_DE_ESTADO = { apagado: 'esperando', descargando: 'baja', preparando: 'calienta', pensando: 'pensando', sinModelo: 'error', fallo: 'error' }

/**
 * La pose de voz del Avi de la marca: la del estado del globo (listo: "contando" mientras salen las
 * palabras, después "feliz"). Con una pregunta pendiente manda "te espera" (la pregunta va antes);
 * cerrado, `null`: vuelve la pose de ánimo.
 */
export function vozAvi(estado, hablando, animo) {
  if (estado === 'cerrado' || !ESTADOS_RESUMEN.includes(estado)) return null
  if (animo === 'teEspera') return 'teEspera'
  if (estado === 'listo') return hablando ? 'contando' : 'feliz'
  return VOZ_DE_ESTADO[estado]
}

/** Lo que dura "contando": la cascada de `n` palabras, topada en 1,8 s. */
export const duracionContando = n => Math.min(420 + n * 18, 1800)

/** La descripción del Avi-botón: el ánimo real ("Claude, esperando"), nunca el juego ni la voz. */
export function animoTexto(animo) {
  return `Claude, ${ANIMO[animo] ?? animo}`
}
