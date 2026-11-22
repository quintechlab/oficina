// Pantalla dividida (docs/diseno/dividida-ux.md): lógica pura. Qué conversaciones hay entre sesiones
// a partir de lo que publica cada una (`conversa`, mod v0.8) y cómo se unen sus dos lados (13.3),
// cuándo se abre sola (3.1), qué lado va a la izquierda, los textos, la geometría de cada mitad (6)
// y la cuenta de la vuelta (10). No toca el DOM: se prueba con node --test.
//
// Regla firme de privacidad: el contrato no trae el contenido de los mensajes y acá nunca se lo pide.

import { nombreProyecto, animoSesion, textoActividad } from './logica.js'
import { colorEstado } from './tablero.js'

const SEG = 1000
const MIN = 60 * SEG

/** Medidas de la mitad en px (6): la fuente única de las posiciones; el CSS solo da las cajas. */
export const DIVIDIDA = { mitad: 272, costura: 26, cabecera: 66, alto: 218, piso: 164, claude: 120, sub: 46, ranura: 62, borde: 6 }
/** Sin mensajes durante este tiempo, la conversación terminó (13.1: el mod no manda `hasta`). */
export const MINUTOS_CONVERSA_QUIETA = 5
/** Una ficha terminada queda este tiempo en la barra (5.9). */
export const MINUTOS_FICHA_FIN = 5
/** Lo que el mod guarda una conversación terminada (13.1): lo que dura el rastro de la tarjeta (5.10). */
export const MINUTOS_RASTRO = 30
/** La cuenta de la vuelta (10). */
export const ESPERA_VUELTA_MS = 60 * SEG
/** Cuánto dura el sub "Se abrió sola · …" (5.2.1). */
export const RECIEN_SOLA_MS = 10 * SEG
/** "api-pagos le contestó" dura esto (5.5, línea 3); también es el límite para cruzar al abrir (9.1). */
export const CONTESTO_MS = 10 * SEG
/** Ánimos en los que Claude solo coordina o espera: entonces la mitad dice que espera al otro (5.5, línea 2). */
const SOLO_ESPERA = new Set(['coordinando', 'esperando', 'pensando'])
const CELESTE = 'var(--celeste)'

const ms = valor => {
  const t = Date.parse(valor ?? '')
  return Number.isNaN(t) ? NaN : t
}
const iso = t => new Date(t).toISOString()
const otroDe = (c, id) => (id === c.a ? c.b : c.a)

/** La clave de una conversación (13.3): el par sin orden y el `desde` más antiguo. */
export function claveConversa(x, y, desde) {
  return `${[String(x), String(y)].sort().join('⇄')}@${desde}`
}

/** Las entradas `conversa` válidas de cada sesión, ya traducidas a ids (de "yo"/"otro" a quién). */
function entradas(sesiones, porId) {
  const lista = []
  for (const s of sesiones) {
    for (const e of Array.isArray(s.conversa) ? s.conversa : []) {
      if (!e || typeof e.con !== 'string' || !e.con || e.con === s.sesion) continue
      const desde = ms(e.desde), cuando = ms(e.ultimo?.cuando)
      if (Number.isNaN(desde) || Number.isNaN(cuando)) continue
      const yo = s.sesion, otro = e.con
      lista.push({
        par: [yo, otro].sort(), desde, cuando,
        emisor: e.ultimo.de === 'yo' ? yo : otro,
        empezo: e.empezo === 'yo' ? yo : otro,
        repos: { [yo]: s.repo ?? null, [otro]: porId.has(otro) ? (porId.get(otro).repo ?? null) : (e.conRepo ?? null) },
      })
    }
  }
  return lista
}

/**
 * Agrupa las entradas de un mismo par en conversaciones: dos lados son la misma si se tocan en el
 * tiempo (la que empieza después arranca antes de los 5 min de silencio de la otra).
 */
function agrupar(lista) {
  const porPar = new Map()
  for (const e of lista) {
    const k = e.par.join('|')
    if (!porPar.has(k)) porPar.set(k, [])
    porPar.get(k).push(e)
  }
  const grupos = []
  for (const es of porPar.values()) {
    es.sort((x, y) => x.desde - y.desde)
    let g = null
    for (const e of es) {
      if (g && e.desde <= g.cuando + MINUTOS_CONVERSA_QUIETA * MIN) {
        g.repos = { ...e.repos, ...g.repos }
        if (e.cuando > g.cuando) { g.cuando = e.cuando; g.emisor = e.emisor }
        continue
      }
      g = { ...e, repos: { ...e.repos } }
      grupos.push(g)
    }
  }
  return grupos
}

/** ¿El grupo de ahora y la conversación de la lectura anterior son la misma? */
const misma = (g, p) => p.par.join('|') === g.par.join('|')
  && g.desde <= ms(p.ultimo.cuando) + MINUTOS_CONVERSA_QUIETA * MIN
  && ms(p.desde) <= g.cuando + MINUTOS_CONVERSA_QUIETA * MIN

/**
 * Las conversaciones entre sesiones (13.3), por `desde`: `{ clave, par, a, b, desde, empezo,
 * ultimo: { emisor, cuando }, turno, hasta, motivo, cerradas, vistos, repos }`. Une los dos lados
 * (desde el mínimo, el último el más reciente), deduce el fin (5 min sin mensajes, motivo "quieta",
 * o una sesión que se veía y ya no está, motivo "cerro") y recuerda las de la lectura anterior
 * (`previas`), así la clave no salta y una conversación cuya sesión se fue sigue como terminada
 * hasta que vence su rastro (30 min). Una sesión que nunca se vio es "sin datos", no "se cerró".
 */
/**
 * Una sesión se da por ida cuando falta en estas lecturas seguidas (3 s): una sola lectura sin ella
 * puede ser su archivo a medio escribir, y cerrar ahí hacía volver la vista antes de tiempo.
 */
export const LECTURAS_PARA_CERRAR = 2

/** Cuántas lecturas seguidas falta cada sesión vista; vuelve a 0 cuando aparece. */
function contarFaltas(previas, vistos, presentes) {
  return Object.fromEntries(vistos.map(id => [id, presentes.has(id) ? 0 : (previas?.[id] ?? 0) + 1]))
}

const idasDe = faltan => Object.keys(faltan).filter(id => faltan[id] >= LECTURAS_PARA_CERRAR).sort()

export function conversaciones(sesiones, ahoraMs, previas = []) {
  const porId = new Map(sesiones.map(s => [s.sesion, s]))
  const presentes = new Set(porId.keys())
  const usadas = new Set()
  const salida = []

  for (const g of agrupar(entradas(sesiones, porId))) {
    const previa = previas.find(p => !usadas.has(p.clave) && misma(g, p))
    if (previa) usadas.add(previa.clave)
    const desdePrev = previa ? ms(previa.desde) : Infinity
    const desde = Math.min(g.desde, desdePrev)
    // El lado del desde más antiguo sabe quién empezó
    const empezo = previa && desdePrev <= g.desde ? previa.empezo : g.empezo
    let ultimo = { emisor: g.emisor, cuando: iso(g.cuando) }
    if (previa && ms(previa.ultimo.cuando) > g.cuando) ultimo = previa.ultimo
    const vistos = [...new Set([...(previa?.vistos ?? []), ...g.par.filter(id => presentes.has(id))])].sort()
    const repos = { ...(previa?.repos ?? {}), ...g.repos }
    for (const id of g.par) if (presentes.has(id)) repos[id] = porId.get(id).repo ?? null

    const faltan = contarFaltas(previa?.faltan, vistos, presentes)
    let hasta = null, motivo = null, cerradas = []
    if (previa?.hasta && !(ms(ultimo.cuando) > ms(previa.hasta))) {
      ({ hasta, motivo, cerradas } = previa)
    } else {
      const quieta = ms(ultimo.cuando) + MINUTOS_CONVERSA_QUIETA * MIN
      const idas = idasDe(faltan)
      if (ahoraMs >= quieta) { hasta = iso(quieta); motivo = 'quieta' }
      else if (idas.length) { hasta = iso(ahoraMs); motivo = 'cerro'; cerradas = idas }
    }
    salida.push({
      clave: previa?.clave ?? claveConversa(g.par[0], g.par[1], iso(desde)),
      par: g.par, a: g.par[0], b: g.par[1], desde: iso(desde), empezo, ultimo,
      turno: ultimo.emisor === g.par[0] ? g.par[1] : g.par[0], hasta, motivo, cerradas, vistos, repos, faltan,
    })
  }

  // Las de la lectura anterior que ya nadie publica (se fue la sesión que las anotaba)
  for (const p of previas) {
    if (usadas.has(p.clave)) continue
    if (p.hasta) { salida.push(p); continue }
    const faltan = contarFaltas(p.faltan, p.vistos, presentes)
    const idas = idasDe(faltan)
    const ausentes = p.vistos.filter(id => !presentes.has(id))
    // Falta alguna, pero todavía no las lecturas que hacen falta: sigue como estaba
    if (ausentes.length && !idas.length) { salida.push({ ...p, faltan }); continue }
    salida.push({ ...p, faltan, hasta: iso(ahoraMs), motivo: idas.length ? 'cerro' : 'quieta', cerradas: idas })
  }

  return salida
    .filter(c => !c.hasta || ahoraMs - ms(c.hasta) <= MINUTOS_RASTRO * MIN)
    .sort((x, y) => ms(x.desde) - ms(y.desde) || x.clave.localeCompare(y.clave))
}

/** Las conversaciones nuevas (3): claves que no estaban. La primera lectura (`conocidas` null) no tiene. */
export function conversacionesNuevas(conocidas, convs) {
  if (!conocidas) return []
  return convs.filter(c => !conocidas.has(c.clave))
}

/** Claves de conversaciones conocidas cuyo último mensaje cambió (`antes`: clave → ultimo.cuando). */
export function mensajesNuevos(antes, convs) {
  return convs.filter(c => antes.has(c.clave) && antes.get(c.clave) !== c.ultimo.cuando).map(c => c.clave)
}

/** Las que tienen ficha y pestaña (5.4 y 5.9): activas o terminadas hace menos de 5 min, sin las retiradas. */
export function convsVisibles(convs, ahoraMs, retiradas) {
  return convs.filter(c => !retiradas.has(c.clave) && (!c.hasta || ahoraMs - ms(c.hasta) < MINUTOS_FICHA_FIN * MIN))
}

/**
 * ¿Se abre sola? (3.1). `'abrir'`, `'esperar'` (hay una transición de ventana: se vuelve a evaluar
 * cuando termine; es la única espera) o `'no'` (solo late su ficha, 3.2).
 * `ctx`: { nueva, panelVisible, proyectoVisto, divididaAbierta, preguntaDesplegada, enviando,
 * focoEnCampo, arrastre, descartadas, transicion }.
 */
export function debeAbrirseSola(conv, ctx) {
  if (!ctx.nueva || conv.hasta) return 'no'
  if (ctx.transicion) return 'esperar'
  if (!ctx.panelVisible) return 'no'
  if (conv.repos[conv.a] !== ctx.proyectoVisto && conv.repos[conv.b] !== ctx.proyectoVisto) return 'no'
  if (ctx.divididaAbierta) return 'no'
  if (ctx.preguntaDesplegada || ctx.enviando) return 'no'
  if (ctx.focoEnCampo || ctx.arrastre) return 'no'
  if (ctx.descartadas.has(conv.clave)) return 'no'
  return 'abrir'
}

/**
 * Quién se nombra primero en las etiquetas (pestañas, riel, fichas, anuncios): el lado izquierdo
 * del título (`primero`, lo pone main.js con `ladoIzquierdo`), o quien empezó si no lo tiene.
 * Así todas dicen el par en el mismo orden que el h1 (revisión de Delfina, 22/11).
 */
export function primeroDe(conv) {
  return conv.primero ?? conv.empezo
}

/** La sesión de la mitad izquierda (13.3): la del proyecto de la vista anterior si es uno solo de los dos; si no, quien empezó. */
export function ladoIzquierdo(conv, proyectoVisto) {
  const enA = conv.repos[conv.a] === proyectoVisto, enB = conv.repos[conv.b] === proyectoVisto
  if (enA && !enB) return conv.a
  if (enB && !enA) return conv.b
  return conv.empezo
}

/** Cómo se nombra cada lado: su proyecto; con el mismo proyecto a los dos lados, su rama (5.2 y 5.7). */
export function nombreLado(conv, id, porId) {
  const repo = conv.repos[id] ?? null
  if (repo === (conv.repos[otroDe(conv, id)] ?? null)) return porId.get(id)?.rama ?? nombreProyecto(repo)
  return nombreProyecto(repo)
}

/** "3 s", "40 s", "2 min", "1 h 5 min". */
export function duracionCorta(dMs) {
  const s = Math.floor(Math.max(0, dMs) / SEG)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60), resto = m % 60
  return resto ? `${h} h ${resto} min` : `${h} h`
}

/** "hace 3 s", "hace 40 s", "hace 2 min". */
export function haceCorto(cuando, ahoraMs) {
  return `hace ${duracionCorta(ahoraMs - ms(cuando))}`
}

/** "10:24", en la hora local. */
export function horaCorta(cuando) {
  const d = new Date(ms(cuando))
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Línea y pose de Claude en su mitad (5.5), por prioridad: su pregunta; que mandó y espera (si solo
 * coordina, espera o piensa); que el otro le contestó hace menos de 10 s; si no, la de hoy.
 * `conversa`: la línea es de la conversación (marcador "⇄" en vez del punto). `nombre(id)`.
 */
export function lineaConversa(s, conv, ahoraMs, nombre) {
  const animo = animoSesion(s, ahoraMs)
  const hoy = { animo, texto: textoActividad(s, ahoraMs), color: colorEstado(animo), conversa: false }
  if (animo === 'teEspera' || conv.hasta) return hoy
  const otro = otroDe(conv, s.sesion)
  const hace = ahoraMs - ms(conv.ultimo.cuando)
  if (conv.ultimo.emisor === s.sesion && SOLO_ESPERA.has(animo)) {
    return { animo: 'pensando', texto: `esperando a ${nombre(otro)} · ${duracionCorta(hace)}`, color: CELESTE, conversa: true }
  }
  if (conv.ultimo.emisor === otro && hace < CONTESTO_MS) {
    // El mensaje que abre la conversación no es una respuesta
    const abre = conv.empezo === otro && ms(conv.ultimo.cuando) === ms(conv.desde)
    return { animo, texto: `${nombre(otro)} ${abre ? 'le escribió' : 'le contestó'}`, color: CELESTE, conversa: true }
  }
  return hoy
}

/**
 * ¿La sesión `s` espera la respuesta del otro? (5.5, línea 2): mandó el último mensaje de una
 * conversación activa y solo coordina, espera o piensa. Si al llegar la respuesta esperaba, festeja (9.3).
 */
export function esperaRespuesta(s, conv, ahoraMs) {
  if (!s || conv.hasta || conv.ultimo.emisor !== s.sesion) return false
  return SOLO_ESPERA.has(animoSesion(s, ahoraMs))
}

/** El chip de turno de la mitad de `id` (5.7): `{ clase: 'lleno' | 'espera' | 'fin', texto }`. */
export function textoTurno(conv, id, ahoraMs, nombre, { sinDatos = false } = {}) {
  if (sinDatos) return { clase: 'fin', texto: 'sin datos' }
  if (conv.hasta) return { clase: 'fin', texto: `terminó · ${haceCorto(conv.hasta, ahoraMs)}` }
  if (conv.turno === id) return { clase: 'lleno', texto: `le toca a ${nombre(id)}` }
  return { clase: 'espera', texto: `espera a ${nombre(otroDe(conv, id))} · ${duracionCorta(ahoraMs - ms(conv.ultimo.cuando))}` }
}

/** La píldora de la costura (5.6): la flecha del último mensaje vista desde la izquierda (`izq`). */
export function textoCostura(conv, izq, ahoraMs) {
  if (conv.hasta) return { texto: 'terminó', fin: true }
  return { texto: `${conv.ultimo.emisor === izq ? '→' : '←'} ${haceCorto(conv.ultimo.cuando, ahoraMs)}`, fin: false }
}

/** La ficha "Último" (4.2): "tienda-web → api-pagos · hace 40 s", o "terminó hace 20 s". */
export function textoUltimo(conv, ahoraMs, nombre) {
  if (conv.hasta) return `terminó ${haceCorto(conv.hasta, ahoraMs)}`
  return `${nombre(conv.ultimo.emisor)} → ${nombre(conv.turno)} · ${haceCorto(conv.ultimo.cuando, ahoraMs)}`
}

/**
 * El sub del encabezado (5.2.1). `ctx`: { ahoraMs, recienSola, vista (nombre de la vista anterior),
 * cuenta ({ restante, pausada } o null si no empezó), siguiente ("a ⇄ b" si queda otra activa), nombre }.
 * `pausada`: la vuelta espera porque el puntero o el foco están adentro (10.3).
 */
export function textoSub(conv, { ahoraMs, recienSola, vista, cuenta, siguiente, nombre }) {
  if (!conv.hasta) {
    if (recienSola) return `Se abrió sola · ‹ te lleva de vuelta a ${vista}`
    return `Conversan desde las ${horaCorta(conv.desde)} · ${duracionCorta(ahoraMs - ms(conv.desde))}`
  }
  const cabeza = conv.motivo === 'cerro' && conv.cerradas?.length === 1
    ? `${nombre(conv.cerradas[0])} se cerró`
    : `Terminó ${haceCorto(conv.hasta, ahoraMs)}`
  if (cuenta?.pausada) return `${cabeza} · la vuelta espera mientras estés acá`
  const s = Math.ceil((cuenta?.restante ?? ESPERA_VUELTA_MS) / SEG)
  if (siguiente) return `${cabeza} · sigue ${siguiente} en ${s} s`
  return `${cabeza} · vuelve a ${vista} en ${s} s`
}

/** Nombre accesible de una ficha de la barra (5.9). Primero el lado izquierdo (`primeroDe`). */
export function textoFicha(conv, ahoraMs, nombre, { nuevo = false } = {}) {
  const otro = otroDe(conv, primeroDe(conv))
  return `Conversación de ${nombre(primeroDe(conv))} con ${nombre(otro)}, desde las ${horaCorta(conv.desde)}, último mensaje ${haceCorto(conv.ultimo.cuando, ahoraMs)}${nuevo ? ', mensaje nuevo' : ''}. Abrir`
}

/** Aviso en vivo, una vez, cuando empieza (12). */
export function anuncioEmpieza(conv, nombre, sola) {
  return `${nombre(primeroDe(conv))} y ${nombre(otroDe(conv, primeroDe(conv)))} empezaron a conversar${sola ? ', se abrió la pantalla dividida' : ''}`
}

/** Aviso en vivo, una vez, cuando termina la que se mira (12). */
export function anuncioTermina(conv, nombre, vista) {
  return `Terminó la conversación entre ${nombre(primeroDe(conv))} y ${nombre(otroDe(conv, primeroDe(conv)))}. Vuelve a ${vista} en ${ESPERA_VUELTA_MS / SEG} segundos.`
}

/**
 * El rastro de la tarjeta de una sesión (5.10), sin el "⇄" (lo pone la vista): la conversación
 * activa más reciente; si no hay, la terminada más reciente. null si no conversa. `nombre(id, conversación)`.
 */
export function rastroConversa(s, convs, ahoraMs, nombre) {
  const suyas = convs.filter(c => c.a === s.sesion || c.b === s.sesion)
  if (!suyas.length) return null
  const activas = suyas.filter(c => !c.hasta).sort((x, y) => ms(y.ultimo.cuando) - ms(x.ultimo.cuando))
  const c = activas[0] ?? [...suyas].sort((x, y) => ms(y.hasta) - ms(x.hasta))[0]
  const otro = nombre(otroDe(c, s.sesion), c)
  if (!c.hasta) return { clave: c.clave, texto: `conversa con ${otro} · ${duracionCorta(ahoraMs - ms(c.desde))}`, fin: false }
  return { clave: c.clave, texto: `habló con ${otro} · ${duracionCorta(ms(c.hasta) - ms(c.desde))} · terminó ${haceCorto(c.hasta, ahoraMs)}`, fin: true }
}

/** De la caja de un Avi a sus pies y a su coronilla (las mismas proporciones que el escenario). */
const pie = t => Math.round(t * 0.867)
const coronilla = t => Math.round(t * 0.26)
/** Claude queda a 16 px de la costura. */
const MARGEN_CLAUDE = 16
/** El rótulo de un subagente: centrado en su Avi, pero nunca afuera de su mitad. */
const ANCHO_ROTULO = 64

/** Una mitad: Claude, su antena, las ranuras del elenco (de afuera hacia Claude) y la pila. */
function geometriaLado(izq, n) {
  const D = DIVIDIDA
  const claude = { t: D.claude, x: izq ? D.mitad - D.claude - MARGEN_CLAUDE : MARGEN_CLAUDE, y: D.piso - pie(D.claude) }
  const antena = { x: claude.x + D.claude / 2, y: claude.y + Math.round(D.claude * 14 / 120) }
  const afuera = izq ? D.borde : D.mitad - D.borde - D.sub
  const cerca = izq ? afuera + D.ranura : afuera - D.ranura
  const y = D.piso - pie(D.sub)
  const ranura = x => ({ x, y, t: D.sub, destino: { x: x + D.sub / 2, y: y + coronilla(D.sub) }, rotulo: { x: Math.min(Math.max(x - 9, 0), D.mitad - ANCHO_ROTULO), y: D.piso + 4, ancho: ANCHO_ROTULO } })
  const xs = n === 0 ? [] : n === 1 ? [afuera] : n === 2 ? [afuera, cerca] : [cerca]
  return { claude, antena, luz: antena.x, ranuras: xs.map(ranura), pila: n > 2 ? ranura(afuera) : null }
}

/**
 * Posiciones de las dos mitades y el cable entre antenas (6), en px de la mitad y de `.split`
 * (la derecha empieza en 272 + 26; el escenario, debajo de la cabecera de 66). `nIzq`, `nDer`:
 * subagentes de cada lado. Con 3 o más, la ranura de Claude lleva uno y la de afuera la pila "+n".
 */
export function geometriaDividida(nIzq, nDer) {
  const D = DIVIDIDA
  const izq = geometriaLado(true, nIzq), der = geometriaLado(false, nDer)
  const A = { x: izq.antena.x, y: D.cabecera + izq.antena.y }
  const B = { x: D.mitad + D.costura + der.antena.x, y: D.cabecera + der.antena.y }
  // Control a 20 px sobre la antena más alta (50 con más de 220 px de distancia, regla del boceto)
  const cx = (A.x + B.x) / 2, cy = Math.min(A.y, B.y) - (B.x - A.x > 220 ? 50 : 20)
  return {
    izq, der,
    cable: { d: `M${A.x} ${A.y} Q${cx} ${cy} ${B.x} ${B.y}`, dInverso: `M${B.x} ${B.y} Q${cx} ${cy} ${A.x} ${A.y}`, llegaA: A, llegaB: B },
  }
}

/**
 * ¿Se pausa la vuelta? (10.3) Con el puntero sobre la columna, o con el foco de teclado adentro de
 * la dividida y la ventana activa. El foco que quedó adentro por un clic, o porque la dividida se
 * abrió sola, no cuenta: la frenaba para siempre (prueba real del 22/11).
 */
export function pausaVuelta({ puntero, ventanaActiva, focoAdentro, focoTeclado }) {
  return puntero || (ventanaActiva && focoAdentro && focoTeclado)
}

/**
 * La cuenta de la vuelta (10), pura: `c` (la anterior, o null) y si tiene que correr ahora (`corre`:
 * el panel se ve y ni el puntero ni el foco están adentro). Devuelve { restante, desde, pausada,
 * terminada }; pausada no reinicia.
 */
export function cuentaVuelta(c, { corre, ahoraMs, totalMs = ESPERA_VUELTA_MS }) {
  const base = c ?? { restante: totalMs, desde: null }
  const restante = base.desde == null ? base.restante : Math.max(0, base.restante - (ahoraMs - base.desde))
  return { restante, desde: corre && restante > 0 ? ahoraMs : null, pausada: !corre, terminada: restante <= 0 }
}
