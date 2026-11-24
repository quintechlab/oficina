// La regla de evolución (docs/diseno/mascotas-avi-ux.md 6): la mascota de Claude toma su forma
// evolucionada mientras coordina un equipo y vuelve a la base 20 s después de quedarse sin equipo.
// Funciones puras: el controlador de tres estados por clave (`base`, `evo`, `cuenta`), quién
// coordina, cuándo una figura hace su acto, el escalonado de los actos y el acto pendiente de la
// apertura. main.js guarda el estado y evolucionMotion.js dibuja los actos.

import { coordinaEquipo } from './logica.js'

/** Lo que espera una forma evolucionada sin equipo antes de volver a la base (6.4). */
export const ESPERA_EVOLUCION_MS = 20000

/** Varios actos que arrancan en la misma vuelta de sondeo salen cada 250 ms (6.10). */
export const ESCALON_ACTOS_MS = 250

/** El acto es de las figuras de 66 px en adelante; las caras chicas cambian sin acto (5.5). */
export const TAMANO_MIN_ACTO = 66

/** La clave global de la marca, la muesca, el riel de la dividida y la píldora (6.2). */
export const CLAVE_MARCA = 'marca'

/**
 * Un paso del controlador de una clave (tabla 6.4). `previo`: `{ estado, hasta }` o nada (la
 * primera vez que se ve la clave); `coordina`: si esa clave coordina ahora. Devuelve el estado
 * nuevo, el `hasta` de la cuenta (o null) y el acto (`'evoluciona'`, `'vuelve'` o null).
 */
export function pasoEvolucion(previo, coordina, ahoraMs) {
  const estado = previo?.estado
  if (estado === 'evo') {
    return coordina ? { estado: 'evo', hasta: null, acto: null } : { estado: 'cuenta', hasta: ahoraMs + ESPERA_EVOLUCION_MS, acto: null }
  }
  if (estado === 'cuenta') {
    // Reencender durante la cuenta no anima ni parpadea: la forma nunca dejó de estar
    if (coordina) return { estado: 'evo', hasta: null, acto: null }
    if (ahoraMs < previo.hasta) return { estado: 'cuenta', hasta: previo.hasta, acto: null }
    return { estado: 'base', hasta: null, acto: 'vuelve' }
  }
  // Sin estado previo o en la base: coordinar evoluciona, con acto (también al abrir, S4)
  return coordina ? { estado: 'evo', hasta: null, acto: 'evoluciona' } : { estado: 'base', hasta: null, acto: null }
}

/** ¿Coordina alguna sesión de cualquier proyecto? La regla de la clave `'marca'` (6.2). */
export function algunaCoordina(proyectos) {
  return proyectos.some(p => p.sesiones.some(coordinaEquipo))
}

/**
 * Qué coordina cada clave (6.2): una por sesión (las propias de `proyectos` y las del equipo en
 * `otras`, por las filas compactas de los compañeros) y la global `'marca'`, solo con las propias.
 */
export function coordinaciones(proyectos, otras = []) {
  const m = new Map()
  for (const s of [...proyectos.flatMap(p => p.sesiones), ...otras]) if (s?.sesion != null) m.set(s.sesion, coordinaEquipo(s))
  m.set(CLAVE_MARCA, algunaCoordina(proyectos))
  return m
}

/**
 * Una vuelta del controlador sobre todas las claves (6.5). `mapa`: clave → `{ estado, hasta }` de la
 * vuelta anterior; `coordina`: clave → boolean (`coordinaciones`). Las claves que ya no están se
 * olvidan. Devuelve el mapa nuevo, los actos (`{ clave, acto, apertura }`: la apertura es el acto de
 * una clave en el primer paso, con el mapa vacío, el único que puede quedar pendiente, 6.8), las claves con la forma
 * evolucionada (`evo` y `cuenta`, 6.6) y el `hasta` más próximo (o null) para el temporizador.
 */
export function avanzarEvolucion(mapa, coordina, ahoraMs) {
  const nuevo = new Map()
  const actos = []
  const formas = new Set()
  let proximo = null
  // El arranque es el primer paso (el mapa vacío): solo sus claves tienen apertura (6.8)
  const arranque = mapa.size === 0
  for (const [clave, c] of coordina) {
    const previo = mapa.get(clave)
    const { estado, hasta, acto } = pasoEvolucion(previo, c, ahoraMs)
    nuevo.set(clave, { estado, hasta })
    if (acto) actos.push({ clave, acto, apertura: arranque })
    if (estado !== 'base') formas.add(clave)
    if (hasta != null && (proximo == null || hasta < proximo)) proximo = hasta
  }
  return { mapa: nuevo, actos, formas, proximo }
}

/**
 * ¿Hace su acto esta figura? (6.8): solo si se ve, sin movimiento reducido ni pausa y, si se da el
 * `tamano`, desde 66 px (las caras chicas cambian sin acto, 5.5).
 */
export function debeActuar({ visible, reducido, pausa, tamano }) {
  if (tamano != null && tamano < TAMANO_MIN_ACTO) return false
  return !!visible && !reducido && !pausa
}

const ORDEN_LUGAR = { tarjeta: 0, mitad: 0, marca: 1, muesca: 2 }

/**
 * Los actos de una misma vuelta, escalonados cada 250 ms (6.10, S5): las tarjetas visibles de
 * arriba hacia abajo (y las mitades de la dividida, por su altura), después la marca y la muesca.
 * Cada acto `{ lugar, arriba, … }` vuelve con su `retraso` en ms.
 */
export function ordenActos(actos) {
  return [...actos]
    .sort((x, y) => (ORDEN_LUGAR[x.lugar] ?? 0) - (ORDEN_LUGAR[y.lugar] ?? 0) || (x.arriba ?? 0) - (y.arriba ?? 0))
    .map((a, i) => ({ ...a, retraso: i * ESCALON_ACTOS_MS }))
}

/**
 * El acto pendiente de la apertura (6.8, S4): una figura que no se veía al abrir hace su acto la
 * primera vez que se ve, si sigue evolucionada, una sola vez. Si volvió a la base, se olvida.
 */
export function actoPendiente(pendiente, { visible, evolucionada }) {
  if (!pendiente || !evolucionada) return { actua: false, pendiente: false }
  return visible ? { actua: true, pendiente: false } : { actua: false, pendiente: true }
}
