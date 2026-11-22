// Detalle de un subagente (#14): lo que se despliega al hacer clic en su ficha. Lógica pura: los
// datos los publica el mod desde la v0.9 (`actividad` y los últimos 5 `pasos` de cada subagente).
import { tiempoRelativo, tiempoSubagente } from './logica.js'

const ESTADO = { trabajando: 'trabajando', listo: 'listo', fallo: 'falló' }

/**
 * Qué mostrar del subagente `a`: nombre, tipo, tarea completa, estado, tiempo (lo que lleva, o hace
 * cuánto terminó), qué hace ahora (solo mientras trabaja) y sus pasos del más nuevo al más viejo.
 * `vacio` explica una lista de pasos vacía: todavía no usó herramientas, o su mod no los manda.
 */
export function detalleSubagente(a, ahoraMs) {
  const trabajando = a.estado === 'trabajando'
  const pasos = (a.pasos ?? []).slice().reverse().map(p => ({ texto: p.texto, hace: `hace ${tiempoRelativo(p.cuando, ahoraMs)}` }))
  let vacio = null
  if (!pasos.length) vacio = Array.isArray(a.pasos) ? 'todavía no usó herramientas' : 'el mod de esta sesión no manda los pasos: actualizalo'
  return {
    nombre: a.nombre,
    tipo: a.tipo,
    tarea: a.tarea,
    estado: ESTADO[a.estado] ?? a.estado,
    tiempo: tiempoSubagente(a, ahoraMs),
    ahora: trabajando && a.actividad ? a.actividad : null,
    pasos,
    vacio,
  }
}
