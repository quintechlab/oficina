// Sala del terrario (boceto docs/diseno/bocetos/notebook.html, opción A "pantalla a la vista"):
// cada agente sentado en su silla, en su escritorio, con su notebook. Un piso por sesión: el
// escritorio de Claude (más ancho, con lámpara y taza) y al lado los de sus subagentes.
// Lógica pura de la sala: qué ánimo se dibuja, qué muestra la pantalla y dónde va cada uno.

/** Subagentes con escritorio propio en un piso; los demás se cuentan como "+n". */
export const MAX_SUBAGENTES_VISIBLES = 4

/** Origen de los escritorios (unidades del SVG): Claude a la izquierda, subagentes cada 68. */
const X_CLAUDE = 14
const X_PRIMER_SUB = 86
const PASO_SUB = 68

/**
 * Escribir en la notebook reemplaza a "comiendo tokens" y al lápiz de editar; un subagente que
 * terminó se dibuja dormido en su escritorio.
 */
export function animoVisual(animo) {
  if (animo === 'comiendo' || animo === 'editando') return 'escribiendo'
  if (animo === 'durmiendo') return 'inactiva'
  return animo
}

/** Qué muestra la pantalla de la notebook: código, verde de comando, "!", tilde, apagada o cursor. */
export function pantallaNotebook(animo) {
  switch (animo) {
    case 'escribiendo':
    case 'coordinando': return 'codigo'
    case 'comando': return 'comando'
    case 'teEspera': return 'espera'
    case 'listo':
    case 'reposo': return 'listo'
    case 'inactiva': return 'apagada'
    default: return 'cursor'
  }
}

/**
 * Corrimiento vertical de la mascota en su silla (unidades del SVG; el sprite va a escala 2).
 * Dormida se hunde 2 pixeles del dibujo; festejando se levanta por encima del escritorio.
 */
export function desplazamiento(animo) {
  if (animo === 'inactiva') return 4
  if (animo === 'listo') return -10
  return 0
}

/** Dónde va el escritorio de Claude y los de sus subagentes, y cuántos quedan como "+n". */
export function distribucion(nSub) {
  const visibles = Math.min(nSub, MAX_SUBAGENTES_VISIBLES)
  return {
    claude: X_CLAUDE,
    subs: Array.from({ length: visibles }, (_, i) => X_PRIMER_SUB + i * PASO_SUB),
    resto: Math.max(0, nSub - MAX_SUBAGENTES_VISIBLES),
  }
}
