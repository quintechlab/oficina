// La muesca acoplable (docs/diseno/estilo-avis-ux.md, sección 7): imán, lugar a lo largo del borde,
// rectángulos de la ventana cerrada (la muesca) y abierta (el tablero entero pegado al borde),
// recorte de la apertura, estado y nombre de la muesca, abrir y cerrar con el clic y el teclado, y
// cuándo golpea una pregunta. Lógica pura: medidas en px lógicos de la pantalla (los de Tauri).

import { avi, claudeDe } from './avis.js'
import { CLAVE_MARCA } from './evolucion.js'
import { especieValida, datosEspecie } from './especies.js'
import { animoSesion, preguntasPendientes, escapar, ANIMOS_DE_TRABAJO } from './logica.js'
import { fueraDeLugar, esquinaTira } from './tamano.js'

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
export const CADA_GOLPE = 90000
/** Píldora flotante al arrastrar la muesca lejos de los bordes (7.3), en tamaño 100 %. */
export const PILDORA = { ancho: 184, alto: 48 }

const RADIO_MUESCA = 22
const RADIO_PANEL = 26

export const esHorizontal = borde => borde === 'arriba' || borde === 'abajo'

/**
 * La muesca A "Asoma" (docs/diseno/muesca-avi-ux.md 5.1), en px CSS al 100 %: `largo` a lo largo del
 * borde y `grosor` hacia el centro. Es la única fuente del tamaño: main.js no mide el DOM.
 */
export const TAM_MUESCA = Object.freeze({ horizontal: Object.freeze({ largo: 150, grosor: 54 }), vertical: Object.freeze({ largo: 140, grosor: 62 }) })

/** Tamaño de la muesca en `borde`, en px de pantalla con el zoom `z`. */
export function tamMuescaDe(borde, z = 1) {
  const t = esHorizontal(borde) ? TAM_MUESCA.horizontal : TAM_MUESCA.vertical
  return { largo: t.largo * z, grosor: t.grosor * z }
}

const limitar = (v, min, max) => Math.min(max, Math.max(min, v))
const redondear = r => ({ x: Math.round(r.x), y: Math.round(r.y), ancho: Math.round(r.ancho), alto: Math.round(r.alto) })

/** La ventana acoplada de un área de trabajo (9.6): el área entera, en px enteros. */
export const ventanaDeArea = area => redondear(area)

/** ¿Dos rectángulos son el mismo, en px enteros? */
export const mismoRect = (a, b) => !!a && !!b && ['x', 'y', 'ancho', 'alto'].every(k => Math.round(a[k]) === Math.round(b[k]))

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

/**
 * Margen del puntero alrededor de la muesca cerrada (sin hombros), medido en reposo: cubre el hover
 * (escala 1,05 desde el borde: 3,75 px por lado y 2,7 hacia el centro; a los costados 3,5 y 3,1). El
 * golpe (1,1) puede salirse 3,5 px durante 480 ms: no abre ni toma clics (muesca-avi-ux.md 10.1).
 */
export const MARGEN_ZONA = 4

/**
 * Acoplada, la ventana es el área de trabajo entera (9.6), transparente y sin tomar clics fuera de
 * la zona interactiva: abrir, cerrar, correr la muesca a lo largo del borde, pasarla a otro borde o
 * volverla píldora al arrastrar no mueven ni redimensionan la ventana (WebView2 tarda en repintar
 * después de un redimensionado: eso era el parpadeo). Solo cambia de monitor. `local`: la muesca, su
 * luz y el tablero en px CSS de esa ventana (para colocarlos con --mx, --lx, --tx…). `tam`: la
 * muesca; `tablero`: el tamaño natural del tablero, ambos en px de pantalla (ya con el zoom `z`).
 */
export function disposicionAcoplada(acople, tam, tablero, area, z = 1) {
  const m = rectMuesca(acople, tam, area, z)
  const p = rectPanel(acople, tablero, tam, area, z)
  const ventana = ventanaDeArea(area)
  return {
    modo: 'acoplada', ventana, m, p,
    local: { muesca: relativo(m.caja, ventana, z), luz: relativo(rectLuz(m, acople.borde, z), ventana, z), tablero: relativo(p.tablero, ventana, z) },
  }
}

/**
 * Ventana única (estilo-avis-ux.md 9.7): flotando, la ventana también es el área de trabajo entera y
 * el tablero es un elemento adentro, en `pos` (px de pantalla; quien llama lo topa al área si hace
 * falta) y de tamaño `tam` (px de pantalla, ya con el zoom `z`). Moverlo es mover el elemento.
 */
export function disposicionFlotante(pos, tam, area, z = 1) {
  const ventana = ventanaDeArea(area)
  const tablero = redondear({ x: pos.x, y: pos.y, ancho: tam.ancho, alto: tam.alto })
  return { modo: 'flotante', ventana, tablero, local: { tablero: relativo(tablero, ventana, z) } }
}

/**
 * La tira mini adentro de la ventana del área: abajo a la derecha (`esquinaTira`) o en `pos`, donde
 * se la soltó. `tam`: `tamanoMini` del zoom `z`.
 */
export function disposicionTira(pos, tam, area, z = 1) {
  const ventana = ventanaDeArea(area)
  const lugar = pos ?? esquinaTira(area, tam)
  const tira = redondear({ x: lugar.x, y: lugar.y, ancho: tam.ancho, alto: tam.alto })
  return { modo: 'tira', ventana, tira, local: { tira: relativo(tira, ventana, z) } }
}

/**
 * Lo que toma el mouse en la ventana del área (9.6 y 9.7), en px de pantalla; el resto deja pasar
 * los clics a lo que hay debajo. Acoplada y cerrada: la muesca más `MARGEN_ZONA`; abierta: el
 * tablero. Flotando, el tablero; en la tira, la tira. Arrastrando (la muesca, la píldora, el tablero
 * o la tira), toda la ventana (`toda`), para no perder el puntero a mitad de camino.
 */
export function zonaInteractiva(d, { abierta, arrastrando = false }, z = 1) {
  if (arrastrando) return { ...d.ventana, toda: true }
  if (d.modo === 'tira') return { ...d.tira, toda: false }
  if (d.modo === 'flotante') return { ...d.tablero, toda: false }
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

/**
 * Lo que dice la muesca A "Asoma" (muesca-avi-ux.md 6 y 8), sin punto ni chip fijo: todo lo dice el
 * Avi. `modo` (pregunta > trabajando > reposo > duerme) va a `#muesca[data-modo]`; `animo` es la pose
 * del Avi (te espera con pregunta, durmiendo sin sesiones, si no esperando) y `ocupado` que trabaja
 * (no sigue al puntero y mira lo suyo). Trabajar es `ANIMOS_DE_TRABAJO`, la misma lista que el reposo
 * de la marca. `sesiones`: el chip del hover; `globo`: "!" con una pregunta, el número con varias
 * ("2"…"9", "9+"), vacío sin preguntas; `chip`: el de la píldora de arrastre; `nombre`: el del botón.
 */
export function estadoMuesca(proyectos, ahoraMs) {
  const sesiones = proyectos.flatMap(p => p.sesiones)
  const pend = proyectos.flatMap(p => preguntasPendientes(p).map(q => ({ ...q, proyecto: p.nombre })))
  const trabajando = sesiones.filter(s => ANIMOS_DE_TRABAJO.has(animoSesion(s, ahoraMs))).length
  const n = sesiones.length
  const modo = pend.length ? 'pregunta' : trabajando ? 'trabajando' : n ? 'reposo' : 'duerme'
  let nombre
  if (pend.length === 1) nombre = `${pend[0].quien} te hace una pregunta en ${pend[0].proyecto}`
  else if (pend.length) nombre = plural(pend.length, 'pregunta pendiente', 'preguntas pendientes')
  else if (trabajando) nombre = trabajando === n ? plural(n, 'sesión trabajando', 'sesiones trabajando') : `${trabajando} de ${n} sesiones trabajando`
  else if (n) nombre = plural(n, 'sesión abierta', 'sesiones abiertas')
  else nombre = 'sin sesiones abiertas'
  return {
    animo: modo === 'pregunta' ? 'teEspera' : modo === 'duerme' ? 'durmiendo' : 'esperando',
    modo,
    ocupado: modo === 'trabajando',
    pregunta: pend.length > 0,
    pendientes: pend.length,
    sesiones: n,
    globo: pend.length === 1 ? '!' : pend.length > 9 ? '9+' : pend.length ? String(pend.length) : '',
    chip: pend.length ? `${pend.length} ?` : String(n),
    nombre: `Avis: ${nombre}. Abrir`,
  }
}

/**
 * El armazón de la muesca (muesca-avi-ux.md 3), todo decorativo (el botón lleva el nombre entero): el
 * chip de sesiones (solo en hover y foco), la línea del alféizar (a los costados), el recorte donde
 * asoma el Avi (`#muesca-avi`, lo dibuja y lo mueve marcaMotion.js) con sus dos manos, y el globo de
 * pregunta. Se escribe una vez: después main.js cambia solo `data-modo`, los textos y el nombre.
 */
export function contenidoMuesca() {
  return '<span class="cuenta" aria-hidden="true"></span><span class="alfeizar" aria-hidden="true"></span>'
    + '<span class="asoma" aria-hidden="true"><span class="alza" id="muesca-avi"></span><i class="asir i"></i><i class="asir d"></i></span>'
    + '<span class="excl" aria-hidden="true">!</span>'
}

/** El Avi que asoma: el de Claude de la marca, de 66 px (muesca-avi-ux.md 5.1), con la `mascota` elegida. */
export function figuraMuesca(animo, mascota = 'avi', formas = new Set()) {
  // Sigue la clave de la marca (mascotas-avi-ux.md 6.2): evolucionada si alguna sesión coordina
  return avi(claudeDe(mascota), animo, 66, { marca: true, claveEvo: CLAVE_MARCA, evolucionada: formas.has(CLAVE_MARCA) })
}

/**
 * Las variables de `#muesca` para la `mascota` (mascotas-avi-ux.md 15 y 16): `--mano-muesca`, las
 * manos del alféizar del color de la especie, y `--c-muesca`, su acento para la luz de cara cuando
 * trabaja. Con el Avi, vacías (se sacan): quedan el crema y el ámbar de estilos.css.
 */
export function estiloMuesca(mascota = 'avi') {
  const e = especieValida(mascota)
  if (e === 'avi') return { '--mano-muesca': '', '--c-muesca': '' }
  const d = datosEspecie(e)
  return { '--mano-muesca': d.mano, '--c-muesca': d.c }
}

/** La píldora flotante al arrastrar la muesca (7.3): el Avi, el título y el chip, como la tira mini. */
export function contenidoPildora(e, mascota = 'avi', formas = new Set()) {
  return `<span class="asoma">${avi(claudeDe(mascota), e.animo, 44, { claveEvo: CLAVE_MARCA, evolucionada: formas.has(CLAVE_MARCA) })}</span><b>Avis</b>`
    + `<span class="chip${e.pregunta ? ' chip-preg' : ''}">${escapar(e.chip)}</span>`
}

// ------------------------------------------------------------------ abrir y cerrar (7.2)

/**
 * Estado de la muesca acoplada: abierta y fijada ("Mantener abierta"). `efecto` y `foco` son lo que
 * la ventana tiene que hacer después del evento. El mouse encima no abre ni cierra (#21): solo el
 * Avi de la muesca lo mira y reacciona, y eso no pasa por acá.
 */
export const ESTADO_INICIAL = Object.freeze({ abierta: false, fija: false, efecto: null, foco: null })

const cerrada = (e, foco) => ({ ...e, abierta: false, fija: false, efecto: 'cerrar', foco })

/**
 * Un evento de la muesca (#21: abre solo con un clic):
 * - `clic`: abre y lleva el foco al proyecto activo; abierta, solo el foco ("Mostrar Avis", el
 *   asistente o la notificación nunca la cierran).
 * - `alternar`: clic, Enter o Espacio sobre la muesca; cerrada abre como `clic`, abierta cierra.
 * - `afuera`: clic fuera del panel o la ventana pierde el foco; cierra salvo fijada, sin mover el foco.
 * - `esc` o `cerrar` (la ×): cierran aunque esté fijada, la desfijan y el foco vuelve a la muesca.
 * - `fijar`: alterna "Mantener abierta"; fijar con la muesca cerrada la abre, soltar no la cierra.
 * Cualquier otro evento (el mouse que entra o sale, el golpe, la luz) no cambia nada: llamar la
 * atención nunca abre ni responde.
 */
export function siguiente(estado, evento) {
  const e = { ...estado, efecto: null, foco: null }
  switch (evento.tipo) {
    case 'clic':
      if (!e.abierta) { e.abierta = true; e.efecto = 'abrir' }
      e.foco = 'proyecto'
      return e
    case 'alternar':
      return e.abierta ? cerrada(e, 'muesca') : siguiente(estado, { tipo: 'clic' })
    case 'afuera':
      return e.abierta && !e.fija ? cerrada(e, null) : e
    case 'esc':
    case 'cerrar':
      return e.abierta ? cerrada(e, 'muesca') : e
    case 'fijar':
      e.fija = !e.fija
      if (e.fija && !e.abierta) { e.abierta = true; e.efecto = 'abrir' }
      return e
    default:
      return e
  }
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
 * Qué hacer con la ventana para llevarla de `actual` a `deseado` (px de pantalla; `deseado` es
 * siempre un área de trabajo, `ventanaDeArea`): 'nada' si ya está (pasar de la muesca a la píldora,
 * al tablero o a la tira no la toca: todo eso pasa adentro) y 'velar' si cambia, que es pasar a otro
 * monitor o que cambie el área (o no se sabe dónde está): lo que se ve se esconde mientras se mueve.
 */
export function planVentana(actual, deseado) {
  if (!actual) return 'velar'
  return fueraDeLugar(actual, deseado) ? 'velar' : 'nada'
}

// ------------------------------------------------------------------ transformaciones adentro de la ventana (9.7)

const pxTexto = v => `${Math.round(v * 100) / 100 || 0}px`

/** El centro de un rectángulo. */
export const centroDe = r => ({ x: r.x + r.ancho / 2, y: r.y + r.alto / 2 })

/**
 * El `transform` (origen arriba a la izquierda) que lleva la caja `desde` encima de `hasta`: para
 * que una forma viaje de un lugar a otro sin redimensionar nada (px CSS de la ventana).
 */
export function transformEntre(desde, hasta) {
  return `translate(${pxTexto(hasta.x - desde.x)}, ${pxTexto(hasta.y - desde.y)}) scale(${hasta.ancho / desde.ancho}, ${hasta.alto / desde.alto})`
}

/** Hacia qué lado del tablero se pliega para quedar como muesca en `borde` (fracciones del tablero). */
export function anclaHacia(borde) {
  return { arriba: { x: 0.5, y: 0 }, abajo: { x: 0.5, y: 1 }, derecha: { x: 1, y: 0.5 }, izquierda: { x: 0, y: 0.5 } }[borde]
}

/** La caja corrida su grosor más allá de `borde` (por donde sale y entra la muesca al cambiar de borde). */
export function fueraDelBorde(c, borde) {
  const d = { arriba: [0, -c.alto], abajo: [0, c.alto], derecha: [c.ancho, 0], izquierda: [-c.ancho, 0] }[borde]
  return { ...c, x: c.x + d[0], y: c.y + d[1] }
}

/**
 * Cómo se pliega el tablero `t` hasta otra forma `c` (la tira, la muesca o la píldora), en px CSS de
 * la ventana: `clip` es un recorte del tamaño de `c` (topado al tablero) contra el lado `ancla` del
 * tablero, con radio `radio`; `transform` (origen arriba a la izquierda) lleva ese recorte encima de
 * `c`, y escala lo que el tablero no alcanza (el escenario de 340 a la tira de 400).
 */
export function plegadoHacia(t, c, radio, ancla) {
  const cw = Math.min(c.ancho, t.ancho), ch = Math.min(c.alto, t.alto)
  const cx = (t.ancho - cw) * ancla.x, cy = (t.alto - ch) * ancla.y
  const sx = c.ancho / cw, sy = c.alto / ch
  const inset = [cy, t.ancho - cx - cw, t.alto - cy - ch, cx].map(pxTexto).join(' ')
  return {
    clip: `inset(${inset} round ${radio}px)`,
    transform: `translate(${pxTexto(c.x - t.x - cx * sx)}, ${pxTexto(c.y - t.y - cy * sy)}) scale(${sx}, ${sy})`,
  }
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
