// La charla con la mascota (docs/diseno/chat-avis-ux.md, opción C "Hoja aparte"): lógica pura. La
// geometría de la hoja (3.1), la máquina de estados (`transicionChat`, 3.3), los pasos de la espera,
// el Markdown seguro (5.6), los bloques progresivos (6.2), los textos de las herramientas y el
// historial, y los datos de Avis que viajan con cada turno (7.4). No toca el DOM ni Tauri: main.js lo
// cablea, chatVista.js lo dibuja y los tests lo revisan.
// Reglas de oro: un clic, nunca solo (solo `enviar`, `reintentar` y `volver-a-preguntar` mandan, y los
// dispara un clic o Enter); nunca se pierde lo escrito; el texto del modelo nunca es HTML.

import { escapar, textoActividad, tiempoRelativo, tiempoSubagente } from './logica.js'

// ------------------------------------------------------------------ geometría (3.1)

/** Ancho de la hoja y hueco con el tablero, en px CSS al 100 % (`--ancho-hoja`, `--hueco-hoja`). */
export const ANCHO_HOJA = 420
export const HUECO_HOJA = 14

/**
 * De qué lado del tablero va la hoja (px de pantalla, `z` el zoom). Flotando: a la derecha si entra,
 * si no a la izquierda, si no encima. Acoplada, lejos del borde: a la derecha de la muesca va a la
 * izquierda y viceversa; arriba y abajo, como flotando. Sin lugar, `'encima'` (D1).
 */
export function ladoHoja(tablero, area, modo, borde, z = 1) {
  const ancho = ANCHO_HOJA * z, hueco = HUECO_HOJA * z
  const derecha = tablero.x + tablero.ancho + hueco + ancho <= area.x + area.ancho
  const izquierda = tablero.x - hueco - ancho >= area.x
  if (modo === 'acoplada' && borde === 'derecha') return izquierda ? 'izquierda' : 'encima'
  if (modo === 'acoplada' && borde === 'izquierda') return derecha ? 'derecha' : 'encima'
  return derecha ? 'derecha' : izquierda ? 'izquierda' : 'encima'
}

/**
 * El rectángulo de la hoja (px de pantalla): 420·z de ancho, a 14·z del tablero, con su misma `y` y
 * su mismo alto. `'encima'` tapa la columna principal: desde la barra lateral (`barra`, su ancho en
 * px de pantalla) hasta el borde derecho del tablero.
 */
export function rectHoja(tablero, lado, z = 1, barra = 0) {
  const ancho = Math.round(ANCHO_HOJA * z), hueco = Math.round(HUECO_HOJA * z)
  const { y, alto } = tablero
  if (lado === 'izquierda') return { x: tablero.x - hueco - ancho, y, ancho, alto }
  if (lado === 'encima') return { x: tablero.x + barra, y, ancho: tablero.ancho - barra, alto }
  return { x: tablero.x + tablero.ancho + hueco, y, ancho, alto }
}

// ------------------------------------------------------------------ estado (3.3)

/** Una charla de las últimas 12 h se retoma al abrir la hoja (D11). */
export const RETOMAR_MS = 12 * 60 * 60 * 1000
/** Sin texto a los 45 s, la nota de "tardando"; sin ningún evento del turno a los 120 s, `tiempo` (D6). */
export const TARDA_MS = 45000
export const SIN_NOTICIAS_MS = 120000
/** Cuántas charlas recuerda el cajón (9.1). */
export const TOPE_CHARLAS = 100

/**
 * La forma de `st.chat`. `motor` y `carpeta`: los de la próxima charla nueva (preferencias.json);
 * `recientes`: las carpetas que devuelve Rust; `charlas`: las otras conversaciones de esta ejecución
 * (el historial en disco llega con la entrega 4); `frenado`: el turno frenado, cuyos eventos se
 * descartan; `soltando`: `{ nombre }` mientras se arrastra un archivo encima.
 */
export function chatInicial() {
  return {
    abierta: false, lado: null, conversacion: null, estado: 'vacio', paso: 0, desdeMs: null, ultimoMs: null, listoMs: null,
    borrador: '', adjuntos: [], menu: false, cajon: false, soltando: null, error: null, todos: false,
    proceso: 'apagado', engram: 'sin-saber', local: 'falta', progreso: null,
    motor: 'claude', carpeta: null, recientes: [], turno: 0, frenado: null, charlas: [], firmas: {},
  }
}

const OCUPADO = new Set(['esperando', 'escribiendo'])
/** ¿Hay un turno en curso? (D7: un turno por vez). */
export const ocupado = c => OCUPADO.has(c.estado)
const NADA = c => ({ chat: c, efectos: [] })

/** Una conversación vacía con un motor y una carpeta fijos (D8). */
function conversacionNueva(id, motor, carpeta, ahoraMs, nuevaEn = null) {
  return { id, titulo: null, motor, carpeta: motor === 'local' ? null : carpeta, sesionClaude: null, creada: ahoraMs, actualizada: ahoraMs, nuevaEn, mensajes: [] }
}

/** El efecto que precalienta (o conoce) la conversación en Rust (`chat_abrir`, D19). */
const efectoAbrir = conv => ({ tipo: 'abrir', conversacion: conv.id, motor: conv.motor, carpeta: conv.carpeta, sesionClaude: conv.sesionClaude ?? null })

/** Guarda la conversación de ahora en `charlas` si tiene mensajes (la más nueva primero, sin repetir). */
function guardarCharla(c) {
  const conv = c.conversacion
  if (!conv?.mensajes.length) return c.charlas
  return [conv, ...c.charlas.filter(x => x.id !== conv.id)].slice(0, TOPE_CHARLAS)
}

/** Las charlas del cajón: las guardadas y la de ahora (si tiene mensajes), de la más nueva a la más vieja. */
export function listaCharlas(c) {
  return guardarCharla(c).slice().sort((a, b) => b.actualizada - a.actualizada)
}

/** El estado que corresponde a una conversación que se retoma o se descarta un aviso. */
const estadoQuieto = conv => (conv?.mensajes.length ? 'listo' : 'vacio')

/** Pasa a otra conversación: la de ahora queda en `charlas`, el estado vuelve a quieto. */
function cambiarConversacion(c, conv) {
  return {
    ...c, charlas: guardarCharla(c).filter(x => x.id !== conv.id), conversacion: conv, estado: estadoQuieto(conv),
    paso: 0, desdeMs: null, ultimoMs: null, listoMs: null, error: null, frenado: null, menu: false, cajon: false, todos: false,
  }
}

/** Reemplaza el último mensaje de la mascota del turno de ahora. */
function conMascota(conv, turno, f) {
  const mensajes = conv.mensajes.slice()
  for (let k = mensajes.length - 1; k >= 0; k--) {
    if (mensajes[k].rol === 'mascota' && mensajes[k].turno === turno) { mensajes[k] = f(mensajes[k]); break }
  }
  return { ...conv, mensajes }
}

/** Reemplaza el mensaje del usuario del turno de ahora. */
function conUsuario(conv, turno, f) {
  return { ...conv, mensajes: conv.mensajes.map(m => (m.rol === 'usuario' && m.turno === turno ? f(m) : m)) }
}

/** La firma de los datos de Avis (como la de `bloque_avis` de Rust: viajan solo si cambiaron). */
export const firmaDatos = datos => JSON.stringify(datos ?? null)
const hayDatos = datos => (datos?.proyectos ?? []).length > 0

/**
 * Un turno nuevo: el mensaje del usuario (`no-enviado` hasta el eco) y el lugar de la respuesta. El
 * título sale del primer mensaje. `campo`: se mandó lo escrito, así el campo queda vacío.
 */
function mandar(c, texto, adjuntos, ctx, { campo = false } = {}) {
  const conv = c.conversacion
  const turno = c.turno + 1
  const ahora = ctx.ahoraMs
  const firma = firmaDatos(ctx.datos)
  const avis = hayDatos(ctx.datos) && c.firmas[conv.id] !== firma
  const mensajes = [
    ...conv.mensajes,
    { rol: 'usuario', texto, cuando: ahora, estado: 'no-enviado', adjuntos: adjuntos.map(({ nombre, tipo, bytes, paginas }) => ({ nombre, tipo, bytes, paginas })), turno, rutas: adjuntos },
    { rol: 'mascota', texto: '', cuando: ahora, estado: 'escribiendo', herramientas: [], turno, avis, ms: null },
  ]
  const titulo = conv.titulo ?? tituloConversacion(texto, adjuntos)
  return {
    chat: {
      ...c, turno, estado: 'esperando', paso: 0, desdeMs: ahora, ultimoMs: ahora, listoMs: null, error: null, frenado: null,
      borrador: campo ? '' : c.borrador, adjuntos: campo ? [] : c.adjuntos, menu: false,
      firmas: avis ? { ...c.firmas, [conv.id]: firma } : c.firmas,
      conversacion: { ...conv, titulo, actualizada: ahora, mensajes },
    },
    efectos: [
      { tipo: 'enviar', conversacion: conv.id, turno, texto, adjuntos: adjuntos.map(a => a.ruta) },
      { tipo: 'anunciar', texto: `${ctx.mascota} está pensando` },
    ],
  }
}

/** Cambia el motor o la carpeta: con mensajes, charla nueva (D8); sin mensajes, solo la cabecera. */
function cambiarCabecera(c, motor, carpeta, ctx) {
  const conv = c.conversacion
  const carpetaFinal = motor === 'local' ? null : carpeta
  if (conv && conv.motor === motor && conv.carpeta === carpetaFinal) return NADA(c.menu ? { ...c, menu: false } : c)
  const pref = { tipo: 'preferencias', motor, carpeta: motor === 'local' ? c.carpeta : carpeta }
  const base = { ...c, motor, carpeta: pref.carpeta, menu: false }
  if (!conv || !conv.mensajes.length) {
    const nueva = conv ? { ...conv, motor, carpeta: carpetaFinal } : conversacionNueva(ctx.id, motor, carpeta, ctx.ahoraMs)
    return { chat: { ...base, conversacion: nueva, estado: 'vacio', error: null }, efectos: [efectoAbrir(nueva), pref] }
  }
  const nueva = conversacionNueva(ctx.id, motor, carpetaFinal, ctx.ahoraMs, motor === 'local' ? 'Sesiones de Avis' : nombreCarpeta(carpetaFinal))
  return { chat: { ...cambiarConversacion(base, nueva), borrador: c.borrador, adjuntos: c.adjuntos }, efectos: [efectoAbrir(nueva), pref] }
}

/** El paso de la espera después de un evento del turno: nunca vuelve atrás (3.3). */
export function pasoEspera(paso, tipo) {
  if (tipo === 'listo') return Math.max(paso, 1)
  if (tipo === 'pidiendo' || tipo === 'pensando') return 2
  return paso
}

/** "m:ss". */
export function formatoReloj(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** El reloj de la espera (desde `enviar`), la nota de "tardando" (45 s) y el vencimiento (120 s sin eventos). */
export function relojEspera(desdeMs, ultimoMs, ahoraMs) {
  return { reloj: formatoReloj(ahoraMs - desdeMs), tarda: ahoraMs - desdeMs >= TARDA_MS, vencido: ahoraMs - (ultimoMs ?? desdeMs) >= SIN_NOTICIAS_MS }
}

/** Un evento de Rust (`oficina://chat`) del turno de ahora; los de otra conversación o de otro turno, nada. */
function delBackend(c, p, ctx) {
  const conv = c.conversacion
  if (!conv || !p || p.conversacion !== conv.id || p.turno !== c.turno || c.frenado === c.turno) return NADA(c)
  const ahora = ctx.ahoraMs
  const vivo = ocupado(c)
  const turno = c.turno
  switch (p.tipo) {
    case 'recibido':
      return NADA({ ...c, conversacion: conUsuario(conv, turno, m => ({ ...m, estado: m.estado === 'no-enviado' ? 'ok' : m.estado })) })
    case 'listo':
    case 'pidiendo':
    case 'pensando':
    case 'reintento': {
      if (!vivo) return NADA(c)
      const proceso = p.tipo === 'listo' ? 'listo' : c.proceso
      const sesionClaude = p.tipo === 'listo' && p.sesion ? p.sesion : conv.sesionClaude
      return NADA({ ...c, paso: pasoEspera(c.paso, p.tipo), ultimoMs: ahora, proceso, conversacion: { ...conv, sesionClaude } })
    }
    case 'texto': {
      if (!vivo || typeof p.texto !== 'string') return NADA(c)
      return NADA({ ...c, estado: 'escribiendo', paso: 2, ultimoMs: ahora, conversacion: conMascota(conv, turno, m => ({ ...m, texto: m.texto + p.texto })) })
    }
    case 'herramienta': {
      if (!vivo) return NADA(c)
      const h = { nombre: String(p.nombre ?? ''), detalle: String(p.detalle ?? '') }
      return NADA({ ...c, ultimoMs: ahora, conversacion: conMascota(conv, turno, m => ({ ...m, herramientas: [...m.herramientas, h] })) })
    }
    case 'fin': {
      if (!vivo) return NADA(c)
      const conv2 = conMascota({ ...conv, actualizada: ahora }, turno, m => ({ ...m, estado: 'ok', ms: Number(p.ms) || 0 }))
      const texto = textoPlano(conv2.mensajes.findLast(m => m.rol === 'mascota')?.texto ?? '')
      return {
        chat: { ...c, estado: 'listo', listoMs: ahora, conversacion: conv2 },
        efectos: [{ tipo: 'anunciar', texto: `${ctx.mascota} respondió: ${texto.slice(0, 140)}` }],
      }
    }
    case 'frenada':
      if (!vivo) return NADA(c)
      return NADA({ ...c, estado: 'frenada', conversacion: conMascota(conv, turno, m => ({ ...m, estado: 'frenada' })) })
    case 'error':
      if (!vivo) return NADA(c)
      return NADA(conError(c, String(p.motivo ?? 'otro'), p.detalle ?? null, ahora))
    default:
      return NADA(c)
  }
}

/**
 * El turno de ahora termina en error. Sin respuesta, el mensaje queda "No se envió", la mascota no
 * deja un mensaje vacío y el texto (con sus adjuntos) vuelve al campo, salvo que ya haya algo escrito
 * (regla 2). Con parte de la respuesta, esa parte queda marcada.
 */
function conError(c, motivo, detalle, ahora) {
  const conv = c.conversacion
  const turno = c.turno
  const m = conv.mensajes.findLast(x => x.rol === 'mascota' && x.turno === turno)
  const usuario = conv.mensajes.find(x => x.rol === 'usuario' && x.turno === turno)
  const sinRespuesta = !m?.texto
  let conv2 = { ...conv, actualizada: ahora }
  if (sinRespuesta) {
    conv2 = { ...conv2, mensajes: conv2.mensajes.filter(x => x !== m) }
    conv2 = conUsuario(conv2, turno, x => ({ ...x, estado: 'no-enviado' }))
  } else {
    conv2 = conMascota(conv2, turno, x => ({ ...x, estado: 'error' }))
  }
  const libre = !c.borrador.trim() && !c.adjuntos.length
  return {
    ...c, estado: 'error', error: { motivo, detalle }, conversacion: conv2,
    borrador: sinRespuesta && libre && usuario ? usuario.texto : c.borrador,
    adjuntos: sinRespuesta && libre && usuario ? usuario.rutas ?? [] : c.adjuntos,
  }
}

/** Vuelve a mandar el mensaje del usuario del último turno (Reintentar o "Volver a preguntar"). */
function repetir(c, ctx, { quitarFallido }) {
  const conv = c.conversacion
  const usuario = conv?.mensajes.findLast(m => m.rol === 'usuario')
  if (!usuario) return NADA(c)
  let base = c
  if (quitarFallido && usuario.estado === 'no-enviado') {
    base = { ...c, conversacion: { ...conv, mensajes: conv.mensajes.filter(m => m.turno !== usuario.turno) } }
  }
  const rutas = usuario.rutas ?? []
  const libera = c.borrador === usuario.texto
  const r = mandar({ ...base, borrador: libera ? '' : c.borrador, adjuntos: libera ? [] : c.adjuntos }, usuario.texto, rutas, ctx)
  return r
}

/**
 * La máquina de la charla (3.3): `{ chat, efectos }`. Pura, como `transicion` del resumen que
 * reemplaza. Efectos: `abrir`, `enviar`, `frenar` (comandos de Rust), `preferencias`, `elegir-carpeta`,
 * `adjuntar`, `primeros-pasos`, `descargar`, `foco` y `anunciar`. `ctx`: `{ ahoraMs, id }` (el id de
 * una conversación nueva), `mascota` (su nombre) y `datos` (`datosAvis`).
 */
export function transicionChat(c, ev, ctx = {}) {
  const conv = c.conversacion
  switch (ev?.tipo) {
    case 'abrir': {
      if (c.abierta) return NADA(c)
      // D11: la última charla de las últimas 12 h se retoma; si no, una vacía con el último motor y carpeta
      const sigue = conv && (!conv.mensajes.length || ctx.ahoraMs - conv.actualizada <= RETOMAR_MS)
      const base = { ...c, abierta: true, menu: false, cajon: false }
      const chat = sigue ? base : cambiarConversacion(base, conversacionNueva(ctx.id, c.motor, c.carpeta, ctx.ahoraMs))
      return { chat, efectos: [efectoAbrir(chat.conversacion), { tipo: 'foco', a: 'campo' }] }
    }
    case 'cerrar':
      // Cerrar nunca frena: la respuesta termina y queda en la charla (3.1)
      return c.abierta ? { chat: { ...c, abierta: false, menu: false, cajon: false, soltando: null }, efectos: [{ tipo: 'foco', a: 'marca' }] } : NADA(c)
    case 'alternar':
      return transicionChat(c, { tipo: c.abierta ? 'cerrar' : 'abrir' }, ctx)
    case 'abierta': {
      if (!conv || ev.conversacion !== conv.id) return NADA(c)
      const r = ev.resultado ?? {}
      return NADA({
        ...c, proceso: r.proceso ?? c.proceso, engram: r.engram ?? c.engram, local: r.local ?? c.local,
        conversacion: { ...conv, sesionClaude: conv.sesionClaude ?? r.sesion ?? null },
      })
    }
    case 'escribir':
      return NADA({ ...c, borrador: String(ev.texto ?? '') })
    case 'enviar': {
      if (!conv || ocupado(c)) return NADA(c)
      const texto = String(ev.texto ?? '').trim()
      const adjuntos = ev.campo ? c.adjuntos : []
      if (!texto && !adjuntos.length) return NADA(c)
      return mandar(c, texto, adjuntos, ctx, { campo: !!ev.campo })
    }
    case 'reintentar':
      return c.estado === 'error' ? repetir(c, ctx, { quitarFallido: true }) : NADA(c)
    case 'volver-a-preguntar':
      return c.estado === 'frenada' ? repetir(c, ctx, { quitarFallido: false }) : NADA(c)
    case 'frenar': {
      if (!ocupado(c)) return NADA(c)
      return {
        chat: { ...c, estado: 'frenada', frenado: c.turno, conversacion: conMascota(conv, c.turno, m => ({ ...m, estado: 'frenada' })) },
        efectos: [{ tipo: 'frenar', conversacion: conv.id, turno: c.turno }, { tipo: 'anunciar', texto: 'Respuesta frenada' }],
      }
    }
    case 'vencio': {
      if (!ocupado(c) || ev.turno !== c.turno) return NADA(c)
      return { chat: { ...conError(c, 'tiempo', null, ctx.ahoraMs), frenado: c.turno }, efectos: [{ tipo: 'frenar', conversacion: conv.id, turno: c.turno }] }
    }
    case 'backend':
      return delBackend(c, ev.payload, ctx)
    case 'descartar':
      return c.estado === 'error' ? NADA({ ...c, estado: estadoQuieto(conv), error: null }) : NADA(c)
    case 'motor':
      if (ev.motor !== 'claude' && ev.motor !== 'local') return NADA(c)
      return cambiarCabecera(c, ev.motor, ev.motor === 'local' ? null : c.carpeta, ctx)
    case 'carpeta':
      if (conv?.motor === 'local') return NADA(c)
      return cambiarCabecera(c, 'claude', ev.carpeta ?? null, ctx)
    case 'recientes':
      return NADA({ ...c, recientes: Array.isArray(ev.recientes) ? ev.recientes : c.recientes })
    case 'menu':
      if (conv?.motor === 'local') return NADA(c)
      return NADA({ ...c, menu: !c.menu })
    case 'elegir-otra':
      return { chat: { ...c, menu: false }, efectos: [{ tipo: 'elegir-carpeta' }] }
    case 'hist':
      return { chat: { ...c, cajon: !c.cajon, menu: false }, efectos: [{ tipo: 'foco', a: c.cajon ? 'hist' : 'buscar' }] }
    case 'nueva': {
      const nueva = conversacionNueva(ctx.id, conv?.motor ?? c.motor, conv?.carpeta ?? c.carpeta, ctx.ahoraMs)
      const chat = { ...cambiarConversacion(c, nueva), borrador: c.borrador, adjuntos: c.adjuntos }
      return { chat, efectos: [efectoAbrir(nueva), { tipo: 'foco', a: 'campo' }] }
    }
    case 'retomar': {
      const otra = c.charlas.find(x => x.id === ev.id) ?? (conv?.id === ev.id ? conv : null)
      if (!otra) return NADA(c)
      if (otra === conv) return { chat: { ...c, cajon: false }, efectos: [{ tipo: 'foco', a: 'campo' }] }
      const chat = { ...cambiarConversacion(c, otra), borrador: c.borrador, adjuntos: c.adjuntos }
      return { chat, efectos: [efectoAbrir(otra), { tipo: 'foco', a: 'campo' }] }
    }
    case 'todos':
      return NADA({ ...c, todos: true })
    case 'soltando':
      return NADA({ ...c, soltando: ev.nombre ? { nombre: String(ev.nombre) } : null })
    case 'modelo': {
      const local = { listo: 'instalado', bajando: 'bajando', roto: 'roto', falta: 'falta' }[ev.modelo] ?? c.local
      const progreso = ev.total != null ? { bajado: Number(ev.bajado) || 0, total: Number(ev.total) || 0 } : c.progreso
      return NADA({ ...c, local, progreso })
    }
    case 'esc':
      // 3.5: menú > cajón > frenar > cerrar; el foco vuelve al disparador de lo que se cerró
      if (c.menu) return { chat: { ...c, menu: false }, efectos: [{ tipo: 'foco', a: 'carpeta' }] }
      if (c.cajon) return { chat: { ...c, cajon: false }, efectos: [{ tipo: 'foco', a: 'hist' }] }
      if (ocupado(c)) return transicionChat(c, { tipo: 'frenar' }, ctx)
      return transicionChat(c, { tipo: 'cerrar' }, ctx)
    default:
      return NADA(c)
  }
}

/**
 * La pose de la mascota del escenario (3.3): `reciente` es el saludo de 1,2 s o el festejo de 1,6 s;
 * soltando un archivo, `baja`; con el cajón, `leyendo`.
 */
export function animoChat(estado, paso, hablando, { reciente = false, soltando = false, cajon = false } = {}) {
  if (soltando) return 'baja'
  if (cajon) return 'leyendo'
  switch (estado) {
    case 'vacio': return reciente ? 'saluda' : 'esperando'
    case 'esperando': return paso >= 2 ? 'pensando' : 'calienta'
    case 'escribiendo': return 'contando'
    case 'listo': return hablando ? 'contando' : reciente ? 'feliz' : 'esperando'
    case 'error': return 'error'
    default: return 'esperando'
  }
}

/** Lo que dura cada pose "de un rato": el saludo y el festejo (3.3). */
export const SALUDA_MS = 1200
export const FELIZ_MS = 1600

/** Con más de 200 mensajes se dibujan los últimos 60 y "Ver mensajes anteriores" (D32). */
export function mensajesVisibles(mensajes, todos) {
  if (todos || mensajes.length <= 200) return { mensajes, ocultos: 0 }
  return { mensajes: mensajes.slice(-60), ocultos: mensajes.length - 60 }
}

// ------------------------------------------------------------------ Markdown seguro (5.6)

/** El texto en línea: escapado, con código, negrita, itálica; los enlaces como "texto (url)" y sin imágenes. */
function enLinea(s) {
  return String(s).split(/(`[^`\n]+`)/).map((trozo, k) => {
    if (k % 2) return `<code>${escapar(trozo.slice(1, -1))}</code>`
    return escapar(trozo)
      .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, '')
      .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, '$1 ($2)')
      .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?![*\w])/g, '$1<i>$2</i>')
  }).join('')
}

const CERCA = /^\s*```\s*([\w+#.-]*)\s*$/
const ITEM = /^(\s*)(?:([-*])|(\d+)[.)])\s+(.*)$/

/** Una lista con un nivel anidado (los ítems con sangría van adentro del anterior). */
function lista(lineas) {
  const tipo = l => (ITEM.exec(l)[2] ? 'ul' : 'ol')
  const raiz = tipo(lineas[0])
  const items = []
  for (const l of lineas) {
    const [, sangria, , , texto] = ITEM.exec(l)
    if (sangria.length >= 2 && items.length) (items.at(-1).hijos ??= { tipo: tipo(l), items: [] }).items.push(texto)
    else items.push({ texto })
  }
  const li = it => `<li>${enLinea(it.texto)}${it.hijos ? `<${it.hijos.tipo}>${it.hijos.items.map(t => `<li>${enLinea(t)}</li>`).join('')}</${it.hijos.tipo}>` : ''}</li>`
  return `<${raiz}>${items.map(li).join('')}</${raiz}>`
}

/**
 * El HTML seguro del texto del modelo: todo escapado y solo este subconjunto (5.6): `#`…`###` → h4,
 * párrafos, listas, código cercado con su lenguaje y "Copiar código", código en línea, negrita,
 * itálica y tablas en mono. Los enlaces quedan como texto (D15); las imágenes se descartan. Nada de
 * HTML crudo, atributos (salvo las clases propias) ni `style`.
 */
export function markdownSeguro(texto) {
  const lineas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')
  const salida = []
  let parrafo = []
  const cerrarParrafo = () => {
    if (parrafo.length) salida.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`)
    parrafo = []
  }
  for (let k = 0; k < lineas.length;) {
    const l = lineas[k]
    const cerca = CERCA.exec(l)
    if (cerca) {
      cerrarParrafo()
      const codigo = []
      k++
      while (k < lineas.length && !/^\s*```\s*$/.test(lineas[k])) codigo.push(lineas[k++])
      k++
      const leng = cerca[1] ? `<span class="leng">${escapar(cerca[1])}</span>` : ''
      salida.push(`<pre>${leng}<button type="button" class="copiar" data-accion="ch-copiar-codigo" aria-label="Copiar código">Copiar</button><code>${escapar(codigo.join('\n'))}</code></pre>`)
      continue
    }
    const titulo = /^#{1,3}\s+(.*)$/.exec(l)
    if (titulo) { cerrarParrafo(); salida.push(`<h4>${enLinea(titulo[1])}</h4>`); k++; continue }
    if (ITEM.test(l) && !/^\s{2,}/.test(l)) {
      cerrarParrafo()
      const items = []
      while (k < lineas.length && ITEM.test(lineas[k])) items.push(lineas[k++])
      salida.push(lista(items))
      continue
    }
    if (/^\s*\|/.test(l)) {
      cerrarParrafo()
      const filas = []
      while (k < lineas.length && /^\s*\|/.test(lineas[k])) filas.push(lineas[k++])
      salida.push(`<pre class="tabla">${escapar(filas.join('\n'))}</pre>`)
      continue
    }
    if (!l.trim()) { cerrarParrafo(); k++; continue }
    parrafo.push(l)
    k++
  }
  cerrarParrafo()
  return salida.join('')
}

/** El Markdown como texto corrido, sin marcas (para el lector de pantalla): los enlaces, solo su texto. */
export function textoPlano(texto) {
  return String(texto ?? '')
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, '')
    .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, '$1')
    .replace(/^\s*(#{1,3}|[-*]|\d+[.)]|```[\w+#.-]*)\s*/gm, '')
    .replace(/\*\*|`|\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Los bloques del texto que va llegando (6.2): los cerrados (por una línea en blanco o una cerca que
 * cierra; una cerca que abre también cierra lo anterior) se dibujan con `markdownSeguro` y no cambian
 * con los tramos que siguen; el abierto va como texto escapado. Una línea sin terminar es del abierto.
 */
export function partirBloques(texto) {
  const lineas = String(texto ?? '').replace(/\r\n?/g, '\n').split('\n')
  const ultima = lineas.pop()
  const cerrados = []
  let actual = [], enCerca = false
  for (const l of lineas) {
    if (enCerca) {
      actual.push(l)
      if (/^\s*```\s*$/.test(l)) { cerrados.push(actual.join('\n')); actual = []; enCerca = false }
    } else if (/^\s*```/.test(l)) {
      if (actual.length) cerrados.push(actual.join('\n'))
      actual = [l]
      enCerca = true
    } else if (!l.trim()) {
      if (actual.length) cerrados.push(actual.join('\n'))
      actual = []
    } else {
      actual.push(l)
    }
  }
  return { cerrados, abierto: [...actual, ultima].join('\n') }
}

// ------------------------------------------------------------------ textos (4.1)

/** "catalogo" de `C:\…\catalogo`; sin carpeta, "Solo Avis" (D9). */
export function nombreCarpeta(ruta) {
  if (!ruta) return 'Solo Avis'
  return String(ruta).split(/[\\/]/).filter(Boolean).pop() ?? String(ruta)
}

const ultimoTramo = s => String(s ?? '').split(/[\\/]/).filter(Boolean).pop() ?? ''
const sinRepetir = lista => [...new Set(lista)]

/**
 * La línea `↳` de un turno (HTML, todo escapado): el contexto de Avis, lo que leyó (hasta 2
 * nombres), lo que buscó con Grep y lo que miró con Glob. Nunca una ruta completa: de Read, el
 * último tramo. Glob da el patrón, no cuántos archivos encontró (Rust no lee el resultado).
 */
export function textoHerramientas(herramientas, carpeta, { avis = false } = {}) {
  const de = n => (herramientas ?? []).filter(h => h.nombre === n).map(h => h.detalle)
  const partes = []
  if (avis) partes.push('Miró tus sesiones de Avis')
  const leidos = sinRepetir(de('Read').map(ultimoTramo).filter(Boolean))
  if (leidos.length === 1) partes.push(`Leyó <b>${escapar(leidos[0])}</b>`)
  else if (leidos.length > 1) partes.push(`Leyó <b>${leidos.length} archivos</b>: ${leidos.slice(0, 2).map(escapar).join(', ')}${leidos.length > 2 ? '…' : ''}`)
  const buscados = sinRepetir(de('Grep').filter(Boolean))
  if (buscados.length) partes.push(`Buscó ${buscados.map(b => `«${escapar(b)}»`).join(', ')} en ${escapar(carpeta)}`)
  const mirados = sinRepetir(de('Glob').filter(Boolean))
  if (mirados.length) partes.push(`Miró ${mirados.map(b => `«${escapar(b)}»`).join(', ')}`)
  return partes.join(' · ')
}

/** Hoy, Ayer, Esta semana (lunes a hoy) o Antes, con el día en hora local (9.1). */
export function grupoDeFecha(ms, ahoraMs) {
  const h = new Date(ahoraMs)
  const dia = (a, m, d) => new Date(a, m, d).getTime()
  const d = new Date(ms)
  const delDia = dia(d.getFullYear(), d.getMonth(), d.getDate())
  const hoy = dia(h.getFullYear(), h.getMonth(), h.getDate())
  if (delDia >= hoy) return 'Hoy'
  if (delDia === dia(h.getFullYear(), h.getMonth(), h.getDate() - 1)) return 'Ayer'
  if (delDia >= dia(h.getFullYear(), h.getMonth(), h.getDate() - ((h.getDay() + 6) % 7))) return 'Esta semana'
  return 'Antes'
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
/** La hora de una charla en el cajón: "14:32" hoy y ayer, el día de la semana esta semana, "d/m" antes. */
export function horaCharla(ms, ahoraMs) {
  const d = new Date(ms)
  const g = grupoDeFecha(ms, ahoraMs)
  if (g === 'Hoy' || g === 'Ayer') return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (g === 'Esta semana') return DIAS[d.getDay()]
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** El título de una charla: las primeras 6 palabras del primer mensaje, sin signos al final (4.1). */
export function tituloConversacion(texto, adjuntos = []) {
  const t = String(texto ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6).join(' ').replace(/[\s.,;:!?¡¿…]+$/u, '')
  if (t) return t
  return adjuntos?.[0]?.nombre ? `Charla sobre ${adjuntos[0].nombre}` : 'Charla'
}

/**
 * Las sugerencias de la charla vacía (4.1): con Claude Code y una carpeta, las de la carpeta; sin
 * carpeta, las de sesiones; con el motor local, solo las de sesiones. "Resumime un PDF" abre el
 * selector de archivos (`adjuntar`), no manda nada.
 */
export function sugerencias(motor, carpeta) {
  if (motor === 'local') return ['¿Quién me está esperando?', '¿Cuántos subagentes trabajan ahora?', '¿Qué pregunta tengo pendiente?'].map(texto => ({ texto }))
  const medio = carpeta
    ? [`¿Qué cambió hoy en ${carpeta}?`, `Armame la documentación de ${carpeta}`]
    : ['¿Quién me está esperando?', '¿Qué preguntas tengo pendientes?']
  return [{ texto: '¿En qué anda cada sesión?' }, ...medio.map(texto => ({ texto })), { texto: 'Resumime un PDF', adjuntar: true }]
}

/**
 * Los proyectos de la barra con carpeta conocida (`cwd` del archivo local de la sesión, entrega 7),
 * para el menú de carpeta: `{ nombre, cwd }`, sin repetir carpetas. Sin `cwd`, ninguno (17).
 */
export function carpetasDeProyectos(proyectos) {
  const vistas = new Set()
  const lista = []
  for (const p of proyectos ?? []) {
    for (const s of p.sesiones ?? []) {
      if (typeof s.cwd !== 'string' || !s.cwd || vistas.has(s.cwd)) continue
      vistas.add(s.cwd)
      lista.push({ nombre: p.nombre, cwd: s.cwd })
    }
  }
  return lista
}

// ------------------------------------------------------------------ adjuntos (10)

const MB = 1024 * 1024
/** Hasta 20 MB por archivo y 5 por mensaje (D27); texto y código hasta 200 KB. */
export const TOPE_ADJUNTO = 20 * MB
export const TOPE_TEXTO = 200 * 1024
export const MAX_ADJUNTOS = 5
const IMAGENES = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const TEXTOS = ['txt', 'md', 'json', 'csv', 'js', 'ts', 'tsx', 'rs', 'py', 'html', 'css', 'yml', 'toml', 'sql', 'log']

/** ¿Se puede adjuntar? `{ ok, tipo }` (pdf, imagen o texto) o `{ ok: false, motivo: 'adjunto' }`. */
export function validarAdjunto({ nombre, bytes }, { motor = 'claude', cuantos = 0 } = {}) {
  const no = { ok: false, motivo: 'adjunto' }
  if (motor === 'local' || cuantos >= MAX_ADJUNTOS) return no
  const m = /\.([^.\\/]+)$/.exec(String(nombre ?? ''))
  const ext = m ? m[1].toLowerCase() : ''
  const n = Number(bytes)
  if (!Number.isFinite(n) || n < 0) return no
  if (ext === 'pdf') return n <= TOPE_ADJUNTO ? { ok: true, tipo: 'pdf' } : no
  if (IMAGENES.includes(ext)) return n <= TOPE_ADJUNTO ? { ok: true, tipo: 'imagen' } : no
  if (TEXTOS.includes(ext)) return n <= TOPE_TEXTO ? { ok: true, tipo: 'texto' } : no
  return no
}

// ------------------------------------------------------------------ historial (9.1)

const normal = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** ¿La charla coincide con lo buscado? Sin tildes ni mayúsculas, contra el título y el texto. */
export function coincideBusqueda(conv, buscar) {
  const q = normal(buscar).trim()
  if (!q) return true
  return normal(conv?.titulo).includes(q) || (conv?.mensajes ?? []).some(m => normal(m.texto).includes(q))
}

// ------------------------------------------------------------------ datos de Avis (7.4, antes del resumen)

/** Topes de lo que viaja (8.3 del resumen, los mismos que `modelo.rs`). */
export const TOPES_DATOS = Object.freeze({ sesiones: 12, subagentes: 6, procesos: 4, texto: 200 })

/** Corta un texto al tope, con "…" si no entró. */
function recortar(t, tope = TOPES_DATOS.texto) {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim()
  return s.length > tope ? `${s.slice(0, tope - 1).trimEnd()}…` : s
}

/** Lo que se dice de una sesión quieta: sin pendientes (el tablero dice "esperando tu mensaje"). */
export const ACTIVIDAD_QUIETA = 'quieta: terminó lo que estaba haciendo, no hay nada pendiente'

/**
 * La actividad de una sesión: la del tablero, salvo una sesión que solo terminó su turno, que va
 * como quieta sin pendientes. Así no se inventa que algo espera una respuesta tuya.
 */
export function actividadParaAvis(s, ahoraMs) {
  const quieta = s?.actividad === 'esperándote' && !(s.preguntas ?? []).length
  return quieta ? ACTIVIDAD_QUIETA : textoActividad(s, ahoraMs)
}

/**
 * Los datos de Avis que viajan con un turno (el bloque `<avis>`, D21), a partir de `st.proyectos`:
 * por proyecto el nombre; por sesión la tarea, la rama, la actividad y cuánto lleva; sus
 * subagentes, procesos y preguntas (sin opciones). Nunca archivos, usuario, nombre, nota, repo
 * completo, equipo ni respuestas. Rust vuelve a quitar las `CLAVES_PROHIBIDAS`.
 */
export function datosAvis(proyectos, ahoraMs) {
  const T = TOPES_DATOS
  let quedan = T.sesiones
  const lista = []
  for (const p of proyectos ?? []) {
    if (quedan <= 0) break
    const sesiones = p.sesiones.slice(0, quedan).map(s => ({
      tarea: s.tarea ?? null,
      rama: s.rama ? recortar(s.rama) : null,
      actividad: recortar(actividadParaAvis(s, ahoraMs)),
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

// ------------------------------------------------------------------ cifras (antes del resumen)

const GB = 1024 ** 3
const numero = n => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Number(n) : 0)
const coma = n => n.toFixed(1).replace('.', ',')

/** "2,6 GB" (gigas como los cuenta Windows, 1024³), o solo la cifra ("1,1") con `unidad: false`. */
export function formatoGB(bytes, { unidad = true } = {}) {
  const t = coma(numero(bytes) / GB)
  return unidad ? `${t} GB` : t
}

/** Cifra, total y porcentaje de la descarga del modelo local. */
export function cifrasDescarga(progreso) {
  const { bajado = 0, total = 0 } = progreso ?? {}
  const p = total > 0 ? Math.min(1, numero(bajado) / total) : 0
  return { cifra: formatoGB(bajado, { unidad: false }), total: total > 0 ? formatoGB(total) : '…', porcentaje: Math.round(p * 100), fraccion: Number(p.toFixed(4)) }
}

/** Cuántas palabras tiene el texto (la boca de "contando"). */
export const contarPalabras = texto => String(texto ?? '').split(/\s+/).filter(Boolean).length

/** Lo que dura "contando" por un tramo de `n` palabras, topado en 1,8 s (5.3). */
export const duracionContando = n => Math.min(420 + n * 18, 1800)

// ------------------------------------------------------------------ movimiento (6)
// Las pistas y la geometría de los actos de la hoja, puras: chatMotion.js las corre con anime.js.
// `en` y `dura` en ms desde el comienzo del acto.

/** Abrir la hoja (6.1, unos 1100 ms): la marca se agacha, la hoja se despliega, la mascota vuela y aterriza. */
export const PISTAS_ABRIR = Object.freeze({
  agacha: { en: 0, dura: 120 },
  fantasma: { en: 0, dura: 400 },
  hoja: { en: 80, dura: 640 },
  vuelo: { en: 120, dura: 900 },
  // Las alas, colas y tentáculos (`g.inclina`) llegan 80 ms tarde
  inclina: { en: 200, dura: 900 },
  contenido: { en: 600, dura: 520, escalon: 45, sube: 10 },
  // El destello del piso, cuando la mascota toca el escenario
  aterriza: { en: 1020, dura: 300 },
  // Se quita el clon y aparece el Avi real del escenario; el foco va al campo
  llega: { en: 1020, dura: 0 },
})

/** Cerrar la hoja (6.1, unos 700 ms): el contenido se funde, la mascota vuelve y la hoja se pliega. */
export const PISTAS_CERRAR = Object.freeze({
  contenido: { en: 0, dura: 160 },
  vuelo: { en: 0, dura: 700 },
  hoja: { en: 160, dura: 420 },
  llega: { en: 700, dura: 0 },
})

/** Con movimiento reducido, la hoja y la mascota solo se funden (6.3). */
export const FUNDIDO_MS = 160
/** Si al soltar el tablero la hoja cambia de lado, se funde hacia el nuevo (D2). */
export const CAMBIA_LADO_MS = 180
/** La hoja empieza a plegarse con el panel 60 ms antes que el tablero (3.1). */
export const ADELANTO_PLIEGUE_MS = 60
/** La mascota de la marca (112) en la del escenario (96). */
export const ESCALA_VUELO = 96 / 112

/** Las curvas de 6 como `cubic-bezier`: entrar, cerrar, el vuelo y el rebote del clic. */
export const CURVAS = Object.freeze({ ease: [0.16, 1, 0.3, 1], cierra: [0.5, 0, 0.75, 0], vuelo: [0.45, 0, 0.2, 1], rebote: [0.34, 1.56, 0.64, 1] })

/**
 * El recorte de la hoja cerrada y abierta (6.1): se despliega desde el lado del tablero. A la derecha
 * (y encima, que tapa la columna desde la barra) crece hacia la derecha y entra desde -30 px; a la
 * izquierda, al revés. Los dos recortes tienen los mismos números, para interpolarlos.
 */
export function recorteHoja(lado) {
  return lado === 'izquierda'
    ? { cerrada: 'inset(0px 0px 0px 100% round 26px)', abierta: 'inset(0px 0px 0px 0% round 26px)', dx: 30 }
    : { cerrada: 'inset(0px 100% 0px 0px round 26px)', abierta: 'inset(0px 0% 0px 0px round 26px)', dx: -30 }
}

const r2 = n => +n.toFixed(2)
const r4 = n => +n.toFixed(4)

/**
 * El vuelo de la marca al escenario (6.1): `dx`, `dy` (px CSS) del lugar de la marca al del Avi del
 * escenario, con origen arriba a la izquierda. `cuerpo` mueve y escala el clon (`t` en %); `giro`, la
 * inclinación, que va en `g.inclina`: hacia la derecha -10 en el aire y +3 al llegar; hacia la
 * izquierda, al revés.
 */
export function pistaVuelo(dx, dy, k = ESCALA_VUELO) {
  const signo = dx < 0 ? -1 : 1
  return {
    cuerpo: [
      { t: 0, x: 0, y: 0, s: 1 },
      { t: 50, x: r2(dx * 0.45), y: r2(dy * 0.45 - 120), s: 1.08 },
      { t: 86, x: r2(dx), y: r2(dy), s: r4(k * 1.06) },
      { t: 100, x: r2(dx), y: r2(dy), s: r4(k) },
    ],
    giro: [{ t: 0, r: 0 }, { t: 50, r: -10 * signo }, { t: 86, r: 3 * signo }, { t: 100, r: 0 }].map(g => ({ ...g, r: g.r || 0 })),
  }
}

/** La vuelta (al cerrar): el mismo arco al revés, del escenario a la marca, con el giro del otro lado. */
export function pistaVuelta(dx, dy, k = ESCALA_VUELO) {
  const ida = pistaVuelo(dx, dy, k)
  return {
    cuerpo: ida.cuerpo.slice().reverse().map(c => ({ ...c, t: 100 - c.t })),
    giro: ida.giro.slice().reverse().map(g => ({ t: 100 - g.t, r: -g.r || 0 })),
  }
}

/**
 * Cuánto se mueve la hoja (6.3): `completo`; con movimiento reducido, `fundido` (sin vuelo, sin
 * recorte: fundidos de 160 ms); con "Pausar animaciones", `nada` (como el resto de Avis: al instante).
 */
export function modoMovimiento({ reducido, pausa }) {
  if (pausa) return 'nada'
  return reducido ? 'fundido' : 'completo'
}

/** Las piezas que entran de a una (`.w`, 6.2): cada palabra con sus espacios alrededor. */
export function piezasPalabras(texto) {
  return String(texto ?? '').match(/\s*\S+\s*|\s+/g) ?? []
}

const normalizar = t => String(t ?? '').replace(/\r\n?/g, '\n')

/**
 * Qué cambia en la respuesta que llega (6.2), de lo ya dibujado (`previo`) al texto de ahora:
 * `continua` si solo creció el bloque abierto (se agrega `nuevo` al final, sin tocar lo puesto); si
 * no, los bloques que se cerraron se dibujan quietos y el abierto se arma con `visto` (lo que ya
 * estaba a la vista, sin animar) y `nuevo`. `reinicia`: el texto no sigue al de antes y se dibuja
 * entero, sin animar.
 */
export function tramoVivo(previo, texto) {
  const p = normalizar(previo), t = normalizar(texto)
  const b = partirBloques(t)
  if (!t.startsWith(p)) return { reinicia: true, continua: false, cerrados: b.cerrados, abierto: b.abierto, visto: b.abierto, nuevo: '' }
  const a = partirBloques(p)
  const inicio = t.length - b.abierto.length
  const visto = b.abierto.slice(0, Math.max(0, p.length - inicio))
  return {
    reinicia: false,
    continua: b.cerrados.length === a.cerrados.length && b.abierto.startsWith(a.abierto),
    cerrados: b.cerrados, abierto: b.abierto, visto, nuevo: b.abierto.slice(visto.length),
  }
}
