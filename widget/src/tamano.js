// Tamaño de la ventana: escala elegida en la bandeja (Normal, Grande, Muy grande), ajuste de la
// ventana al contenido, límites del área de trabajo y posición en pantalla. Lógica pura.

/**
 * Pasos del tamaño en porcentaje del original (100 %, el de la versión 0.1, es el más chico; 200 %
 * el más grande). Todo crece junto, dibujo y texto. 100, 150 y 200 % dan 2, 3 y 4 px por pixel
 * del dibujo y quedan nítidos; 125 y 175 % pueden suavizarse un poco. La lista de pasos y el paso
 * siguiente los decide preferencias.rs (lo guarda y arma el menú); acá solo se aplica.
 */
const PASOS = [100, 125, 150, 175, 200]
export const PASO_POR_DEFECTO = 100

/** Ventana mínima y fracción máxima del área de trabajo del monitor (después, desplaza). */
export const MINIMO = { ancho: 320, alto: 120 }
export const FRACCION_MAXIMA = 0.9
/** Diferencia que se ignora, para no entrar en un bucle de redimensiones. */
const TOLERANCIA = 2
/** Tira mini del boceto, en tamaño Normal. */
const MINI = { ancho: 400, alto: 56 }

/** El zoom de un porcentaje (1 a 2); fuera de los pasos, el tamaño original. */
export function zoomDe(porcentaje) {
  return PASOS.includes(porcentaje) ? porcentaje / 100 : 1
}

/** Ctrl + agranda (1), Ctrl − achica (-1), Ctrl 0 vuelve a 100 % (0); cualquier otra tecla, null. */
export function direccionDeTecla(e) {
  if (!e.ctrlKey) return null
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') return 1
  if (e.key === '-' || e.code === 'NumpadSubtract') return -1
  if (e.key === '0' || e.code === 'Numpad0') return 0
  return null
}

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

export function debeAjustar(actual, deseado) {
  return Math.abs(actual.ancho - deseado.ancho) > TOLERANCIA || Math.abs(actual.alto - deseado.alto) > TOLERANCIA
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

/** Tamaño de la tira mini para un zoom. */
export function tamanoMini(zoom) {
  return { ancho: Math.round(MINI.ancho * zoom), alto: Math.round(MINI.alto * zoom) }
}

