// El día y la hora en Argentina, compartidos (docs/diseno/tareas-ux.md 11.2): la configuración
// ("Revisado hoy 10:33") y las tareas (Hoy y Vencidas) cuentan el día igual. Argentina es UTC−3 todo
// el año (sin horario de verano desde 2009): nada depende de la zona de la PC. Puro, sin DOM.

export const MS_HORA = 3600000
export const MS_DIA = 24 * MS_HORA
/** Lo que hay que restarle a un instante UTC para tener la hora de Argentina. */
export const DESFASE_AR = 3 * MS_HORA

/** El número de día (días desde 1970) en hora de Argentina de un instante en ms. */
export const diaArgentina = ms => Math.floor((ms - DESFASE_AR) / MS_DIA)

const desdeNumero = n => new Date(n * MS_DIA).toISOString().slice(0, 10)
const aNumero = dia => Date.parse(`${dia}T00:00:00Z`) / MS_DIA

/** Hoy en Argentina como día de calendario `AAAA-MM-DD` (el de `fecha` de una tarea). */
export function hoyArgentina(ms) {
  return desdeNumero(diaArgentina(ms))
}

/** ¿`AAAA-MM-DD` de un día que existe? */
export function fechaValida(f) {
  return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && Number.isFinite(aNumero(f)) && desdeNumero(aNumero(f)) === f
}

/** Días de `hoy` a `fecha` (los dos `AAAA-MM-DD`): negativo es antes (vencida), 0 hoy, 1 mañana. */
export function diasEntre(fecha, hoy) {
  return Math.round(aNumero(fecha) - aNumero(hoy))
}

/** `dia` más `n` días (puede ser negativo). */
export function sumarDias(dia, n) {
  return desdeNumero(aNumero(dia) + n)
}

/** Lunes = 0 … domingo = 6 (habitos-ux.md 11.2): el 1/1/1970 (día 0) fue jueves. */
export function diaSemana(dia) {
  return (((aNumero(dia) + 3) % 7) + 7) % 7
}

/** El lunes de la semana de `dia` (la semana va de lunes a domingo, D-h3). */
export function lunesDe(dia) {
  return sumarDias(dia, -diaSemana(dia))
}

/** "HH:MM" en Argentina de un instante en ms (antes `horaGlobo` de tareas.js, que la reexporta). */
export function horaArgentina(ms) {
  const d = new Date(ms - DESFASE_AR)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
