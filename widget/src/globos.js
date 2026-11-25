// La cola de globos (#41, docs/diseno/habitos-ux.md 8.1 y 8.2, entrega H2): un solo globo a la vista,
// el de más prioridad (D-h5, aprobada por Quintana: pregunta de Claude › recordatorio de un hábito ›
// aviso diario de Tareas › resumen semanal) y, a igual prioridad, el que llegó primero. El de abajo
// nunca se pierde: espera en la cola y aparece cuando el de arriba se va. Puro, sin DOM: main.js arma
// la cola (`encolar`, `quitar`) y dibuja `actual(...)` con la vista de cada tipo (`pintarGlobos`).
// El resumen semanal (H3) entra con `conResumen`: uno solo, el de la semana más nueva.

/** La prioridad de cada tipo (8.1): menos es antes. La pregunta de Claude no es un globo: tapa a todos. */
export const PRIORIDAD = Object.freeze({ rec: 1, tareas: 2, resumen: 3 })

/** El globo que no se ve con su hoja abierta (8.1, D-h14): el de Tareas con Tareas, el resumen con Hábitos. */
const OCULTO_CON = Object.freeze({ tareas: 'tareas', resumen: 'habitos' })

/** La clave de un recordatorio: uno por hábito y por día (el de mañana es otro). */
export const claveRec = (id, dia) => `rec:${id}:${dia}`

/** La clave de un resumen semanal: uno por semana (`lunes`, "AAAA-MM-DD"). */
export const claveResumen = lunes => `res:${lunes}`

const porPrioridad = (a, b) => a.prioridad - b.prioridad || a.orden - b.orden

/**
 * Agrega un aviso (`{ tipo: 'rec' | 'tareas' | 'resumen', clave, ...datos }`) si no está (por clave) y
 * deja la cola ordenada por prioridad y llegada. `prioridad` sale del tipo y `orden`, de la llegada,
 * salvo que el aviso los traiga. Sin clave o de un tipo desconocido, la misma cola. No cambia la de antes.
 */
export function encolar(cola, aviso) {
  if (!aviso?.clave || cola.some(a => a.clave === aviso.clave)) return cola
  const prioridad = aviso.prioridad ?? PRIORIDAD[aviso.tipo]
  if (!Number.isFinite(prioridad)) return cola
  const orden = aviso.orden ?? cola.reduce((m, a) => Math.max(m, a.orden + 1), 0)
  return [...cola, { ...aviso, prioridad, orden }].sort(porPrioridad)
}

/**
 * Encola un resumen semanal (`{ tipo: 'resumen', clave, lunes, ... }`, habitos-ux.md 8.4): hay uno solo
 * en la cola, el de la semana más nueva (nunca uno más viejo). Si ya está ese o uno más nuevo, la misma
 * cola; si había uno más viejo, sale. Es el último de la prioridad: espera a los demás (8.1).
 */
export function conResumen(cola, aviso) {
  const otros = cola.filter(a => a.tipo === 'resumen')
  if (otros.some(a => a.lunes >= aviso.lunes)) return cola
  return encolar(otros.reduce((c, a) => quitar(c, a.clave), cola), aviso)
}

/** Saca un aviso por su clave; si no está, la misma cola. */
export function quitar(cola, clave) {
  return cola.some(a => a.clave === clave) ? cola.filter(a => a.clave !== clave) : cola
}

/**
 * Dónde se ve un globo (8.2 de tareas-ux.md, la parte de «dónde» de `lugarAviso`): 'marca' (el panel
 * con la barra lateral), 'dividida' (el riel en lugar de la barra) o 'muesca' (acoplada y plegada).
 * Espera (null) en la tira, en la bandeja o escondida, con la charla abierta, a mitad de un arrastre y
 * sin barra (el vacío o primeros pasos). `f`: `{ fuera, mini, chat, arrastrando, acoplada, abierta,
 * dividida, barra }`. La pregunta pendiente y la hoja abierta las decide `actual`.
 */
export function lugarGlobo(f) {
  if (f.fuera || f.mini || f.chat || f.arrastrando) return null
  if (f.acoplada && !f.abierta) return 'muesca'
  if (f.dividida) return 'dividida'
  return f.barra ? 'marca' : null
}

/**
 * El globo a la vista y dónde (`{ aviso, lugar }`), o null. `forma`: la de `lugarGlobo` más `pregunta`
 * (hay una pregunta de Claude pendiente: ningún globo se ve en ningún lugar, D-h5 y D-m4 de
 * modulos-ux.md) y `hojaAbierta` (el módulo a la vista: con el suyo abierto, el de Tareas y el resumen
 * no hacen falta y pasa el siguiente; el recordatorio se ve igual, D-h14).
 */
export function actual(cola, forma) {
  if (forma.pregunta) return null
  const lugar = lugarGlobo(forma)
  if (!lugar) return null
  const aviso = cola.find(a => OCULTO_CON[a.tipo] !== forma.hojaAbierta)
  return aviso ? { aviso, lugar } : null
}
