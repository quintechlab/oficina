// La muesca acoplable (docs/diseno/estilo-avis-ux.md, sección 7): imán, lugar a lo largo del borde,
// rectángulos de la ventana cerrada (la muesca) y abierta (el tablero entero pegado al borde),
// recorte de la apertura, estado y nombre de la muesca, abrir y cerrar con el mouse y el teclado, y
// cuándo golpea una pregunta. Lógica pura: medidas en px lógicos de la pantalla (los de Tauri).

import { animoMarca } from './tablero.js'
import { avi, CLAUDE } from './avis.js'
import { animoSesion, preguntasPendientes, escapar } from './logica.js'
import { fueraDeLugar } from './tamano.js'

/** Un borde a la vez (7). El orden desempata el imán en una esquina. */
export const BORDES = ['arriba', 'derecha', 'abajo', 'izquierda']
/** Distancia del imán (7.3). */
export const IMAN = 20
/** Hombros cóncavos de 16 × 16 que funden la muesca con el borde (7.1). */
export const HOMBRO = 16
/** La luz de pregunta pasa 12 px más allá de cada hombro (7.1). */
export const LUZ = 12
/** Lugar para que la muesca se corra 6 px en el golpe y 2 px con el mouse encima (6.4 y 7.1). */
export const HOLGURA = 8
/** Margen del panel abierto contra las puntas del área de trabajo (7.4). */
export const MARGEN_PANEL = 8
/** Fracción máxima del área que ocupa el panel abierto hacia el centro (la misma que el tablero flotante). */
const FRACCION_MAXIMA = 0.9
export const ESPERA_ABRIR = 180
export const ESPERA_CERRAR = 650
export const CADA_GOLPE = 90000
/** Píldora flotante al arrastrar la muesca lejos de los bordes (7.3), en tamaño 100 %. */
export const PILDORA = { ancho: 184, alto: 48 }

const RADIO_MUESCA = 22
const RADIO_PANEL = 26

export const esHorizontal = borde => borde === 'arriba' || borde === 'abajo'

const limitar = (v, min, max) => Math.min(max, Math.max(min, v))
const redondear = r => ({ x: Math.round(r.x), y: Math.round(r.y), ancho: Math.round(r.ancho), alto: Math.round(r.alto) })

// ------------------------------------------------------------------ imán (7.3)

/**
 * El borde al que se acopla `caja` (un rectángulo; un punto es una caja de 0 × 0): el lado de la
 * caja que mira a cada borde está a `iman` px o menos (pasado el borde también cuenta). Gana el más
 * cercano; empatados, el primero de `BORDES`. `libres`: bordes que no tocan a otro monitor (sin
 * datos, todos). Lejos de todo borde, `null`: flota.
 */
export function bordeCercano(caja, area, libres = null, iman = IMAN) {
  const distancia = {
    arriba: caja.y - area.y,
    derecha: area.x + area.ancho - (caja.x + caja.ancho),
    abajo: area.y + area.alto - (caja.y + caja.alto),
    izquierda: caja.x - area.x,
  }
  let elegido = null
  for (const b of BORDES) {
    if (libres && libres[b] === false) continue
    if (distancia[b] <= iman && (elegido === null || distancia[b] < distancia[elegido])) elegido = b
  }
  return elegido
}

/** Proyección de `punto` sobre el borde, de 0 (izquierda o arriba) a 1. */
export function lugarDe(borde, punto, area) {
  const l = esHorizontal(borde) ? (punto.x - area.x) / area.ancho : (punto.y - area.y) / area.alto
  return limitar(l, 0, 1)
}

/**
 * `lugar` ajustado para que la muesca de `largo` px y sus hombros entren en un borde de
 * `largoArea` px. Un lugar que no es número va al medio, y también si no entra.
 */
export function lugarAjustado(lugar, largo, largoArea, z = 1) {
  const mitad = largo / 2 + HOMBRO * z
  const min = mitad / largoArea
  const max = 1 - min
  if (min > max) return 0.5
  if (!Number.isFinite(lugar)) return 0.5
  return limitar(lugar, min, max)
}

/** Centro de la muesca a lo largo de su borde, en px de pantalla. */
function centroEnBorde({ borde, lugar }, largo, area, z) {
  const inicio = esHorizontal(borde) ? area.x : area.y
  const largoArea = esHorizontal(borde) ? area.ancho : area.alto
  return inicio + lugarAjustado(lugar, largo, largoArea, z) * largoArea
}

/**
 * Rectángulo de una caja de `largo` × `grosor` pegada a `borde` y centrada en `centro`.
 * A los costados el largo va en vertical.
 */
function pegada(borde, centro, largo, grosor, area) {
  if (esHorizontal(borde)) {
    return { x: centro - largo / 2, y: borde === 'arriba' ? area.y : area.y + area.alto - grosor, ancho: largo, alto: grosor }
  }
  return { x: borde === 'izquierda' ? area.x : area.x + area.ancho - grosor, y: centro - largo / 2, ancho: grosor, alto: largo }
}

// ------------------------------------------------------------------ rectángulos de la ventana (7.1 y 7.4)

/**
 * Ventana de la muesca cerrada: la muesca (`tam`: `largo` a lo largo del borde y `grosor`), sus
 * hombros, la luz y la holgura del golpe; nada más, porque los píxeles transparentes toman clics
 * (9.5). `caja`: la muesca negra, en px de pantalla. `z`: el zoom del tamaño elegido.
 */
export function rectMuesca(acople, tam, area, z = 1) {
  const centro = centroEnBorde(acople, tam.largo, area, z)
  const caja = pegada(acople.borde, centro, tam.largo, tam.grosor, area)
  const ventana = pegada(acople.borde, centro, tam.largo + 2 * (HOMBRO + LUZ) * z, tam.grosor + HOLGURA * z, area)
  return { ...redondear(ventana), caja: redondear(caja) }
}

/**
 * Ventana del panel abierto: el tablero entero (`tablero`: su tamaño natural) pegado al borde,
 * centrado en la muesca y ajustado al área con un margen de 8 (7.4), con los hombros de 16 a los
 * lados del borde. Si no entra, se achica (y el tablero desplaza). `tablero`: el rectángulo del
 * tablero en px de pantalla.
 */
export function rectPanel(acople, tablero, tamMuesca, area, z = 1) {
  const { borde } = acople
  const m = MARGEN_PANEL * z
  const h = HOMBRO * z
  const centro = centroEnBorde(acople, tamMuesca.largo, area, z)
  const horizontal = esHorizontal(borde)
  const ancho = Math.min(tablero.ancho, horizontal ? area.ancho - 2 * m : Math.floor(area.ancho * FRACCION_MAXIMA))
  const alto = Math.min(tablero.alto, horizontal ? Math.floor(area.alto * FRACCION_MAXIMA) : area.alto - 2 * m)
  let t
  if (horizontal) {
    const x = limitar(centro - ancho / 2, area.x + m, area.x + area.ancho - m - ancho)
    t = { x, y: borde === 'arriba' ? area.y : area.y + area.alto - alto, ancho, alto }
    return { ...redondear({ x: t.x - h, y: t.y, ancho: ancho + 2 * h, alto }), tablero: redondear(t) }
  }
  const y = limitar(centro - alto / 2, area.y + m, area.y + area.alto - m - alto)
  t = { x: borde === 'izquierda' ? area.x : area.x + area.ancho - ancho, y, ancho, alto }
  return { ...redondear({ x: t.x, y: t.y - h, ancho, alto: alto + 2 * h }), tablero: redondear(t) }
}

/** Radios (sup. izq., sup. der., inf. der., inf. izq.) de las esquinas que miran al centro. */
function radios(borde, r) {
  const rs = { arriba: [0, 0, r, r], abajo: [r, r, 0, 0], derecha: [r, 0, 0, r], izquierda: [0, r, r, 0] }[borde]
  return rs.map(v => `${v}px`).join(' ')
}

/**
 * Recorte de la apertura (6.4): `desde` es la muesca dentro del tablero y `hasta` el tablero entero,
 * como `clip-path: inset(...)` en px CSS del tablero (los de pantalla divididos por el zoom).
 */
export function recorte(caja, tablero, borde, z = 1) {
  const px = v => Math.max(0, Math.round(v / z * 100) / 100)
  const inset = {
    arriba: px(caja.y - tablero.y),
    derecha: px(tablero.x + tablero.ancho - (caja.x + caja.ancho)),
    abajo: px(tablero.y + tablero.alto - (caja.y + caja.alto)),
    izquierda: px(caja.x - tablero.x),
  }
  // Medio (isla): estirada a todo lo largo del borde, todavía con el espesor de la muesca
  const medio = esHorizontal(borde)
    ? { arriba: inset.arriba, derecha: 0, abajo: inset.abajo, izquierda: 0 }
    : { arriba: 0, derecha: inset.derecha, abajo: 0, izquierda: inset.izquierda }
  const forma = (i, r) => `inset(${i.arriba}px ${i.derecha}px ${i.abajo}px ${i.izquierda}px round ${radios(borde, r)})`
  return {
    inset,
    desde: forma(inset, RADIO_MUESCA),
    medio: forma(medio, RADIO_MUESCA),
    hasta: `inset(0px 0px 0px 0px round ${radios(borde, RADIO_PANEL)})`,
  }
}

/**
 * Luz de pregunta (7.1): franja de 3 px sobre el borde de la pantalla, a lo largo de la muesca, sus
 * hombros y 12 px más por lado (el largo entero de la ventana cerrada `m`).
 */
export function rectLuz(m, borde, z = 1) {
  const g = 3 * z
  const { caja } = m
  if (borde === 'arriba') return { x: m.x, y: caja.y, ancho: m.ancho, alto: g }
  if (borde === 'abajo') return { x: m.x, y: caja.y + caja.alto - g, ancho: m.ancho, alto: g }
  if (borde === 'derecha') return { x: caja.x + caja.ancho - g, y: m.y, ancho: g, alto: m.alto }
  return { x: caja.x, y: m.y, ancho: g, alto: m.alto }
}

/** Un rectángulo relativo a la ventana, en px CSS (para ubicar la muesca y el tablero adentro). */
export function relativo(r, ventana, z = 1) {
  return { x: (r.x - ventana.x) / z, y: (r.y - ventana.y) / z, ancho: r.ancho / z, alto: r.alto / z }
}

// ------------------------------------------------------------------ ventana fija y zona interactiva (9.6)

/** Margen del puntero alrededor de la muesca cerrada: cubre el golpe (6 px) y el hover (2 px). */
export const MARGEN_ZONA = 8

const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y)
  return { x, y, ancho: Math.max(a.x + a.ancho, b.x + b.ancho) - x, alto: Math.max(a.y + a.alto, b.y + b.alto) - y }
}

/**
 * Acoplada, la ventana no cambia de tamaño al abrir ni al cerrar (9.6): es siempre la unión de la
 * muesca cerrada (`m`, con hombros, luz y holgura) y del panel abierto (`p`), y abrir es solo el
 * recorte adentro. `local`: la muesca, su luz y el tablero en px CSS de esa ventana (para colocarlos
 * con --mx, --lx, --tx…). `tam`: la muesca; `tablero`: el tamaño natural del tablero, ambos en px de
 * pantalla (ya con el zoom `z`).
 */
export function disposicionAcoplada(acople, tam, tablero, area, z = 1) {
  const m = rectMuesca(acople, tam, area, z)
  const p = rectPanel(acople, tablero, tam, area, z)
  const ventana = union(m, p)
  return {
    ventana, m, p,
    local: { muesca: relativo(m.caja, ventana, z), luz: relativo(rectLuz(m, acople.borde, z), ventana, z), tablero: relativo(p.tablero, ventana, z) },
  }
}

/**
 * Lo que toma el mouse en la ventana fija (9.6), en px de pantalla; el resto deja pasar los clics a
 * lo que hay debajo. Cerrada: la muesca más `MARGEN_ZONA`. Abierta: el tablero. Arrastrando (la
 * muesca o la píldora), toda la ventana (`toda`), para no perder el puntero a mitad de camino.
 */
export function zonaInteractiva(d, { abierta, arrastrando = false }, z = 1) {
  if (arrastrando) return { ...d.ventana, toda: true }
  if (abierta) return { ...d.p.tablero, toda: false }
  const c = d.m.caja, g = MARGEN_ZONA * z
  return { x: c.x - g, y: c.y - g, ancho: c.ancho + 2 * g, alto: c.alto + 2 * g, toda: false }
}

/**
 * La caja que se arrastra, para el imán: sin `agarre`, la píldora centrada en el puntero (al
 * arrastrar la muesca); con `agarre` (dónde se tomó, dentro de la ventana), el tablero flotante.
 */
export function cajaArrastre(puntero, agarre, tam) {
  if (!agarre) return { x: puntero.x - tam.ancho / 2, y: puntero.y - tam.alto / 2, ancho: tam.ancho, alto: tam.alto }
  return { x: puntero.x - agarre.x, y: puntero.y - agarre.y, ancho: tam.ancho, alto: tam.alto }
}

/** Al soltar lejos de un borde, el tablero flotante se abre donde se soltó, dentro del área (7.3). */
export function posicionFlotante(puntero, tam, area) {
  return {
    x: Math.round(limitar(puntero.x - tam.ancho / 2, area.x, area.x + area.ancho - tam.ancho)),
    y: Math.round(limitar(puntero.y - 20, area.y, area.y + area.alto - tam.alto)),
  }
}

/** ¿El punto está dentro del rectángulo? (el borde derecho y el de abajo quedan afuera). */
export function dentroDe(p, r) {
  return !!p && p.x >= r.x && p.x < r.x + r.ancho && p.y >= r.y && p.y < r.y + r.alto
}

// ------------------------------------------------------------------ estado y nombre (7.1 y 7.2)

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
/** Ánimos de una sesión que cuentan como "trabajando". */
const TRABAJA = new Set(['coordinando', 'pensando', 'leyendo', 'comando', 'editando'])

/**
 * Lo que muestra la muesca: el ánimo del Avi que asoma (el mismo orden que la marca, 4.2), el
 * color del punto (ámbar si trabaja o pregunta, crema si espera, tenue si todo duerme), el chip
 * (la cantidad de sesiones o "n ?") y el nombre accesible del botón.
 */
export function estadoMuesca(proyectos, ahoraMs) {
  const sesiones = proyectos.flatMap(p => p.sesiones)
  const pend = proyectos.flatMap(p => preguntasPendientes(p).map(q => ({ ...q, proyecto: p.nombre })))
  const animos = sesiones.map(s => animoSesion(s, ahoraMs))
  const trabajando = animos.filter(a => TRABAJA.has(a)).length
  const despiertas = animos.filter(a => a !== 'inactiva').length
  const punto = pend.length || trabajando ? 'ambar' : despiertas ? 'crema' : 'tenue'
  let nombre
  if (pend.length === 1) nombre = `${pend[0].quien} te hace una pregunta en ${pend[0].proyecto}`
  else if (pend.length) nombre = plural(pend.length, 'pregunta pendiente', 'preguntas pendientes')
  else if (trabajando) nombre = plural(trabajando, 'sesión trabajando', 'sesiones trabajando')
  else if (sesiones.length) nombre = plural(sesiones.length, 'sesión abierta', 'sesiones abiertas')
  else nombre = 'sin sesiones abiertas'
  return {
    animo: animoMarca(proyectos, ahoraMs),
    punto,
    pregunta: pend.length > 0,
    pendientes: pend.length,
    chip: pend.length ? `${pend.length} ?` : String(sesiones.length),
    chipNombre: pend.length ? plural(pend.length, 'pregunta pendiente', 'preguntas pendientes') : plural(sesiones.length, 'sesión abierta', 'sesiones abiertas'),
    nombre: `Oficina: ${nombre}. Abrir`,
  }
}

/**
 * Adentro de la muesca (7.1): el Avi de Claude que asoma, el punto de estado y el chip. Todo es
 * decorativo: el botón lleva el nombre entero (`estadoMuesca().nombre`).
 */
export function contenidoMuesca(e) {
  return `<span class="asoma">${avi(CLAUDE, e.animo, 44)}</span>`
    + `<span class="pt pt-${e.punto}" aria-hidden="true"></span>`
    + `<span class="chip${e.pregunta ? ' chip-preg' : ''}" aria-hidden="true">${escapar(e.chip)}</span>`
}

/** La píldora flotante al arrastrar la muesca (7.3): el Avi, el título y el chip, como la tira mini. */
export function contenidoPildora(e) {
  return `<span class="asoma">${avi(CLAUDE, e.animo, 44)}</span><b>Oficina</b>`
    + `<span class="chip${e.pregunta ? ' chip-preg' : ''}">${escapar(e.chip)}</span>`
}

// ------------------------------------------------------------------ abrir y cerrar (7.2)

/**
 * Estado de la muesca acoplada: abierta, fijada ("Mantener abierta"), si el hover puede abrir
 * (`armado`: después de cerrar, hasta que el mouse salga una vez), si el mouse está encima y qué
 * espera hay programada. `efecto` y `foco` son lo que la ventana tiene que hacer después del evento.
 */
export const ESTADO_INICIAL = Object.freeze({ abierta: false, fija: false, armado: true, dentro: false, espera: null, efecto: null, foco: null })

/**
 * Un evento de la muesca: `entra` y `sale` (mouse), `tiempo` (venció la espera `que`), `clic`
 * (clic, Enter o Espacio sobre la muesca, o "Mostrar oficina"), `esc` o `cerrar` (cierra aunque
 * esté fijada) y `fijar`. Cualquier otro evento (el golpe, la luz) no cambia nada: llamar la
 * atención nunca abre ni responde.
 */
export function siguiente(estado, evento) {
  const e = { ...estado, efecto: null, foco: null }
  switch (evento.tipo) {
    case 'entra':
      e.dentro = true
      if (e.abierta) { if (e.espera?.que === 'cerrar') e.espera = null }
      else if (e.armado && !e.espera) e.espera = { que: 'abrir', ms: ESPERA_ABRIR }
      return e
    case 'sale':
      e.dentro = false
      e.armado = true
      if (e.espera?.que === 'abrir') e.espera = null
      if (e.abierta && !e.fija) e.espera = { que: 'cerrar', ms: ESPERA_CERRAR }
      return e
    case 'tiempo':
      if (evento.que !== e.espera?.que) return e
      e.espera = null
      if (evento.que === 'abrir' && !e.abierta) { e.abierta = true; e.efecto = 'abrir' }
      if (evento.que === 'cerrar' && e.abierta && !e.fija) { e.abierta = false; e.armado = false; e.efecto = 'cerrar' }
      return e
    case 'clic':
      e.espera = null
      if (!e.abierta) { e.abierta = true; e.efecto = 'abrir' }
      e.foco = 'proyecto'
      return e
    case 'esc':
    case 'cerrar':
      if (!e.abierta) return e
      return { ...e, abierta: false, fija: false, armado: false, espera: null, efecto: 'cerrar', foco: 'muesca' }
    case 'fijar':
      e.fija = !e.fija
      if (e.fija) {
        e.espera = null
        if (!e.abierta) { e.abierta = true; e.efecto = 'abrir' }
      } else if (e.abierta && !e.dentro) {
        e.espera = { que: 'cerrar', ms: ESPERA_CERRAR }
      }
      return e
    default:
      return e
  }
}

/**
 * El evento de la muesca para un aviso de la zona (`dentro`, del sondeo de Rust o del DOM), o null
 * si la muesca ya lo sabe. Rust avisa el estado real con cada zona nueva aunque no haya cambiado:
 * "adentro" entra solo si la muesca no lo sabía (al arrancar con el puntero encima, el hover abre);
 * "afuera" sale si no lo sabía o si la muesca está sin armar, así un reacople con el puntero lejos
 * deja el hover listo para la primera entrada.
 */
export function eventoZona(estado, dentro) {
  if (dentro) return estado.dentro ? null : 'entra'
  return !estado.dentro && estado.armado ? null : 'sale'
}

// ------------------------------------------------------------------ redimensionar sin parpadeo (9.6)

/**
 * Después de redimensionar, WebView2 deja la ventana transparente sin pintar hasta ~0,4 s: lo que
 * se ve se esconde antes y vuelve recién cuando el nuevo tamaño ya se pintó (dos cuadros y este
 * asiento, ajustable).
 */
export const ASIENTO_VELO_MS = 220
/** Lo que tarda en volver a verse la muesca (o el tablero) después del velo. */
export const REAPARECE_MS = 160

/**
 * Qué hacer con la ventana para llevarla de `actual` a `deseado` (px de pantalla): 'nada' si está
 * en su lugar (abrir y cerrar no la tocan), 'mover' si solo cambia el lugar (no deja de pintarse) y
 * 'velar' si cambia el tamaño, la forma de adentro (`cambiaForma`: otro borde, la píldora, el
 * acople nuevo) o no se sabe cómo está: hay que esconder lo que se ve mientras se redimensiona.
 */
export function planVentana(actual, deseado, { cambiaForma = false } = {}) {
  if (!actual) return 'velar'
  if (!cambiaForma && !fueraDeLugar(actual, deseado)) return 'nada'
  const mismoTamano = Math.round(actual.ancho) === Math.round(deseado.ancho) && Math.round(actual.alto) === Math.round(deseado.alto)
  return mismoTamano && !cambiaForma ? 'mover' : 'velar'
}

/**
 * Los pasos de un redimensionado velado: esconder al instante (sin transición), redimensionar,
 * esperar dos cuadros y el asiento, y reaparecer en 160 ms. Sin movimiento (reducido o "Pausar
 * animaciones") también se esconde y espera, pero reaparece al instante.
 */
export function secuenciaVelo(movimiento) {
  return [
    { paso: 'ocultar', ms: 0 },
    { paso: 'ajustar' },
    { paso: 'esperar', cuadros: 2, ms: ASIENTO_VELO_MS },
    { paso: 'mostrar', ms: movimiento ? REAPARECE_MS : 0 },
  ]
}

// ------------------------------------------------------------------ golpe (6.4)

/**
 * ¿Golpea ahora? Solo con preguntas y la muesca cerrada: al llegar una pregunta nueva y cada 90 s
 * mientras siga sin respuesta. Entre golpes nada titila.
 */
export function tocaGolpe({ pendientes, nueva, abierta, ultimo, ahora }) {
  if (!pendientes || abierta) return false
  if (nueva || ultimo == null) return true
  return ahora - ultimo >= CADA_GOLPE
}
