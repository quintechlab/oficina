// La barra como menú de módulos (#42, docs/diseno/modulos-ux.md): el HTML de `#aviso-p`, la pregunta
// vista desde otro módulo (4.5). Solo HTML, como tareasVista.js: los datos llegan armados de
// `avisoPregunta` (modulos.js) y nada de acá toca el DOM. Las filas del menú están en index.html (las
// cuentas, `cuentaModulo`); la tira de repos está en tablero.js (`tiraRepos`).

import { avi } from './avis.js'
import { escapar } from './logica.js'
import { ladoFilaTareas } from './tareasVista.js'
import { nombreFilaTareas } from './tareas.js'
import { cuentaMiniHabitos } from './habitosVista.js'

/**
 * `#aviso-p` (4.5, 5): la cara de quien pregunta (Avi de 30 en pose de pregunta, con la forma de su
 * sesión si es Claude, `formas`), «{quien} te hace una pregunta», la línea «{proyecto} · hace {tiempo}»
 * y la píldora «Responder →». El texto visible es el nombre del botón. Sin aviso, nada.
 */
export function avisoPreguntaHtml(aviso, formas = new Set()) {
  if (!aviso) return ''
  const pj = aviso.quien
  const cara = avi(pj, 'teEspera', 30, pj.claveEvo != null ? { claveEvo: pj.claveEvo, evolucionada: formas.has(pj.claveEvo) } : {})
  return `<button type="button" class="aviso-p" data-accion="aviso-p" data-proy="${aviso.proy}" data-k="aviso-p"><span class="cara" aria-hidden="true">${cara}</span><span class="t">${escapar(pj.nombre)} te hace una pregunta<small>${escapar(aviso.proyecto)} · hace ${escapar(aviso.hace)}</small></span><span class="ir">Responder →</span></button>`
}

/**
 * Las cuentas chicas de los módulos en la tira mini (8, M2), después de la insignia de preguntas: la de
 * Tareas es la misma pieza de su fila (`ladoFilaTareas`: `.chip-venc` con punto o `.chip-preg`), sin la
 * pista del atajo, con su nombre para el lector (`nombreFilaTareas`). `entran`: lo que decidió
 * `cuentasModulosMini`. Después, la de Hábitos (#41): su anillo con «{h}/{t}» (`cuentaMiniHabitos`).
 */
export function cuentasMiniHtml(tareas, habitos, entran) {
  const n = (tareas?.hoy ?? 0) + (tareas?.vencidas ?? 0)
  const t = entran?.tareas && n ? `${ladoFilaTareas(tareas)}<span class="oculto">${escapar(nombreFilaTareas(tareas))}</span>` : ''
  return t + (entran?.habitos ? cuentaMiniHabitos(habitos) : '')
}
