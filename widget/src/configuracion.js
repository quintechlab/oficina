// Configuración dentro del panel (#23, docs/diseno/configuracion-ux.md, opción B "Taller"): la lógica
// pura de la hoja. Las pestañas y su teclado, qué valor sirve para cada ajuste (lo mismo que
// `ajuste_valido` de preferencias.rs), abrir y cerrar, Esc en sus tres capas (4.1), el atajo Ctrl , y
// la ubicación del panel. Sin DOM: lo dibuja configuracionVista.js y lo conecta main.js.

import { NOMBRES_ESPECIES } from './especies.js'

/** Orden fijo de las pestañas (4.4). */
export const PESTANAS = [
  { id: 'mascota', nombre: 'Mascota' },
  { id: 'panel', nombre: 'Panel' },
  { id: 'modelos', nombre: 'Modelos' },
  { id: 'datos', nombre: 'Datos' },
  { id: 'instalacion', nombre: 'Instalación' },
]
export const IDS_PESTANAS = PESTANAS.map(p => p.id)

/** ¿Es una de las cinco pestañas? */
export function pestanaValida(id) {
  return IDS_PESTANAS.includes(id)
}

/**
 * Lo que va después de `actual` con el teclado (11): → la siguiente (de la última a la primera), ←
 * la anterior, Inicio la primera, Fin la última; otra tecla, la misma. Sirve para las pestañas y
 * para los segmentos.
 */
export function pestanaSiguiente(actual, tecla, lista = IDS_PESTANAS) {
  const n = lista.length
  const i = Math.max(0, lista.indexOf(actual))
  if (tecla === 'ArrowRight') return lista[(i + 1) % n]
  if (tecla === 'ArrowLeft') return lista[(i - 1 + n) % n]
  if (tecla === 'Home') return lista[0]
  if (tecla === 'End') return lista[n - 1]
  return actual
}

/** Los interruptores que se guardan en preferencias.json (9.1) y su valor de fábrica. */
export const INTERRUPTORES = { arriba: true, avisar: true, pausa: false }

/**
 * ¿`valor` sirve para `clave`? `mascota`, una de las siete especies (texto exacto); `arriba`,
 * `avisar` y `pausa`, solo booleanos; cualquier otra clave, no. `motor` llega con el chat (D6).
 */
export function validarAjuste(clave, valor) {
  if (clave === 'mascota') return NOMBRES_ESPECIES.includes(valor)
  if (Object.hasOwn(INTERRUPTORES, clave ?? '')) return typeof valor === 'boolean'
  return false
}

/** Un interruptor leído: lo que no es booleano vuelve al de fábrica. */
export function valorInterruptor(valor, defecto) {
  return typeof valor === 'boolean' ? valor : defecto
}

/** "Dónde vive" (4.4): flotando o acoplada a uno de los cuatro bordes. */
export const UBICACIONES = [['flota', 'Flota'], ['arriba', 'Arriba'], ['derecha', 'Derecha'], ['abajo', 'Abajo'], ['izquierda', 'Izquierda']]

/** La ubicación de un acople (`{ borde, lugar }` o null): flotando, o un borde desconocido, "flota". */
export function ubicacionDe(acople) {
  const b = acople?.borde
  return UBICACIONES.some(([v]) => v === b && v !== 'flota') ? b : 'flota'
}

/** El borde de una ubicación: "flota" es null (flotar); una desconocida, undefined (nada que hacer). */
export function bordeDeUbicacion(ubicacion) {
  if (ubicacion === 'flota') return null
  return UBICACIONES.some(([v]) => v === ubicacion) ? ubicacion : undefined
}

/** Los botones − y + del tamaño: se apagan en las puntas (100 y 200 %, los de preferencias.rs). */
export function limitesTamano(tamano) {
  return { achicar: tamano > 100, agrandar: tamano < 200 }
}

/**
 * Estado de la hoja en la ventana (4.6): abierta, la pestaña (la última usada en esta ejecución, no
 * se guarda), la clave que se escribe (`editando`, nunca el texto), el borrado armado y el ajuste
 * que no se pudo guardar.
 */
export function configInicial() {
  return { abierta: false, tab: 'mascota', editando: null, armado: null, error: null }
}

/** Abre en la última pestaña usada, o en `tab` si es una de las cinco. */
export function abrirConfiguracion(config, tab) {
  return { ...config, abierta: true, tab: pestanaValida(tab) ? tab : config.tab }
}

/** Cierra: descarta la clave que se escribía, desarma el borrado y saca el error; la pestaña queda. */
export function cerrarConfiguracion(config) {
  return { ...config, abierta: false, editando: null, armado: null, error: null }
}

/**
 * Esc con la configuración abierta (4.1), una capa por vez: cancela la clave que se escribe (el
 * texto se descarta), desarma un "¿Borrar? Sí" o cierra. Cerrada, no es de la configuración
 * (`accion` null): el Esc siguiente es del panel acoplado, que se pliega.
 */
export function alEsc(config) {
  if (!config.abierta) return { config, accion: null }
  if (config.editando) return { config: { ...config, editando: null, error: null }, accion: 'cancelar-clave' }
  if (config.armado) return { config: { ...config, armado: null }, accion: 'desarmar' }
  return { config: cerrarConfiguracion(config), accion: 'cerrar' }
}

/** Ctrl , (4.1): solo Ctrl, sin Alt, Shift ni Windows. */
export function esAtajoConfiguracion(e) {
  return e.key === ',' && !!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey
}
