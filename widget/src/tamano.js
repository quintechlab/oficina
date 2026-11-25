// Tamaño de la ventana: ajuste del tablero al contenido, límites del área de trabajo y posición en
// pantalla. Lógica pura. El panel va siempre al 100 % (#47): sin zoom elegido ni atajos.

/** Ventana mínima y fracción máxima del área de trabajo del monitor (después, desplaza). */
export const MINIMO = { ancho: 320, alto: 120 }
export const FRACCION_MAXIMA = 0.9
/** Diferencia que se ignora, para no entrar en un bucle de redimensiones. */
const TOLERANCIA = 2
/** Tira mini del boceto. */
const MINI = { ancho: 400, alto: 56 }

/** Tamaño de la ventana para un contenido de `medida` (px), entre el mínimo y el 90 % del área. */
export function tamanoDeseado(medida, area) {
  const maxAncho = Math.floor(area.ancho * FRACCION_MAXIMA)
  const maxAlto = Math.floor(area.alto * FRACCION_MAXIMA)
  const limitar = (v, min, max) => Math.min(max, Math.max(min, Math.ceil(v)))
  return {
    ancho: limitar(medida.ancho, Math.min(MINIMO.ancho, maxAncho), maxAncho),
    alto: limitar(medida.alto, Math.min(MINIMO.alto, maxAlto), maxAlto),
  }
}

/**
 * Medida de la ventana en px de pantalla, antes de topar (`tamanoDeseado`). El tablero tiene un alto
 * fijo (`altoTablero`, px CSS del marco con su borde, más `margen`, el relleno vertical del body):
 * no cambia de un proyecto a otro y lo que no entra se ve con scroll adentro. El ancho, y en el vacío
 * y la carga (sin `altoTablero`) también el alto, salen del contenido: `contenido` medido en px de
 * pantalla y `extras` (rellenos, bordes y barra) en px CSS. `f`: px de pantalla por px CSS, medido (1 sin transformaciones).
 */
export function medidaVentana({ contenido, extras, f = 1, altoTablero = null, margen = 0 }) {
  return {
    ancho: contenido.ancho + extras.ancho * f,
    alto: altoTablero == null ? contenido.alto + extras.alto * f : (altoTablero + margen) * f,
  }
}

export function debeAjustar(actual, deseado) {
  return Math.abs(actual.ancho - deseado.ancho) > TOLERANCIA || Math.abs(actual.alto - deseado.alto) > TOLERANCIA
}

/**
 * Acoplada (9.6): ¿hay que volver a colocar la ventana? Si cambió de tamaño (más de 2 px, como
 * `debeAjustar`) o de lugar (más de 1 px). Si no, abrir y cerrar no la tocan.
 */
export function fueraDeLugar(actual, deseado) {
  return debeAjustar(actual, deseado) || Math.abs(actual.x - deseado.x) > 1 || Math.abs(actual.y - deseado.y) > 1
}

/**
 * Posición de la ventana con su tamaño nuevo: la esquina de arriba a la izquierda queda donde
 * estaba, salvo que la ventana se salga del área de trabajo; entonces se corre lo justo.
 */
export function posicionEnPantalla(pos, tamano, area) {
  const ajustar = (v, inicio, largo, propio) => Math.max(inicio, Math.min(v, inicio + largo - propio))
  return {
    x: ajustar(pos.x, area.x, area.ancho, tamano.ancho),
    y: ajustar(pos.y, area.y, area.alto, tamano.alto),
  }
}

/** Tamaño de la tira mini (px de pantalla). */
export function tamanoMini() {
  return { ...MINI }
}

/** Margen de la tira mini con el borde derecho y con la barra de tareas, en px de pantalla. */
export const MARGEN_TIRA = 8

/**
 * Dónde va la tira mini: abajo a la derecha del área de trabajo, apoyada sobre la barra de tareas
 * con `MARGEN_TIRA`. Si no entra, desde la punta izquierda o de arriba.
 */
export function esquinaTira(area, tam) {
  return {
    x: Math.round(Math.max(area.x, area.x + area.ancho - tam.ancho - MARGEN_TIRA)),
    y: Math.round(Math.max(area.y, area.y + area.alto - tam.alto - MARGEN_TIRA)),
  }
}

const fraccion = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)

/**
 * La posición del tablero flotante como se guarda (preferencias.rs): la fracción del lugar libre del
 * área (0 arriba a la izquierda, 1 abajo a la derecha). Así vuelve adentro aunque el área o el
 * tamaño cambien. Pasado el borde (arrastrado medio afuera), se topa.
 */
export function fraccionFlotante(pos, tam, area) {
  const libre = (largo, propio) => Math.max(0, largo - propio)
  const parte = (v, inicio, largo, propio) => (libre(largo, propio) ? fraccion((v - inicio) / libre(largo, propio)) : 0)
  return { x: parte(pos.x, area.x, area.ancho, tam.ancho), y: parte(pos.y, area.y, area.alto, tam.alto) }
}

/** La posición guardada (`fraccionFlotante`) en esta área, siempre adentro; sin dato, al medio. */
export function posicionDeFraccion(f, tam, area) {
  const lugar = (v, inicio, largo, propio) => Math.round(inicio + fraccion(v) * Math.max(0, largo - propio))
  return { x: lugar(f?.x, area.x, area.ancho, tam.ancho), y: lugar(f?.y, area.y, area.alto, tam.alto) }
}

