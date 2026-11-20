// Movimiento del asistente "Primeros pasos" (docs/diseno/bienvenida-ux.md 7.1): la entrada
// escalonada, el saludo del Avi base, el cambio de paso, el cambio de estado y la sacudida del
// error. CSS y la API de animaciones del navegador, como tableroMotion.js; solo `transform` y
// `opacity`, y la ventana nunca cambia de tamaño. Con movimiento reducido o "Pausar animaciones"
// (6.5 del estilo) todo es instantáneo; el indicador de la pestaña, los bucles y las letras del
// código son CSS (estilos.css y avis.css).

import { hayMovimiento, duracionEscalonada } from './tableroMotion.js'

const ENTRADA_MS = 620
const ESCALON_MS = 65
const RETRASO_MS = 120
/** El saludo empieza a los 500 ms y dura 3 vaivenes: a los 3,6 s se saca `.entra` (6.4). */
export const SALUDO_MS = 3600
const SALE_MS = 140
const ENTRA_MS = 280
const ESCALON_PASO_MS = 40
const FUNDIDO_MS = 200
const APRETON_MS = 240
const SACUDE_MS = 420

const EASE = 'cubic-bezier(.16, 1, .3, 1)'
const EASE_CIERRA = 'cubic-bezier(.5, 0, .75, 0)'
const REBOTE = 'cubic-bezier(.34, 1.56, .64, 1)'

/**
 * El Avi base saluda (tres vaivenes) cuando aparece en `saluda`: pone `.entra` en su `svg` y la
 * saca a los 3,6 s, así un redibujo no repite el saludo. Sin movimiento, el CSS la ignora.
 */
export function saludar(raiz) {
  const svg = raiz?.querySelector('.pp-avi svg.e-saluda')
  if (!svg) return
  svg.classList.add('entra')
  setTimeout(() => svg.classList.remove('entra'), SALUDO_MS)
}

/**
 * Aparición del escenario o la hoja (7.1): encabezado, pestañas, Avi, rótulo y título, texto,
 * extra, acciones y pie entran escalonados con `sube`; el saludo empieza a los 500 ms.
 */
export function aparecer(raiz) {
  if (!raiz) return
  saludar(raiz)
  if (!hayMovimiento()) return
  const piezas = [...raiz.querySelectorAll('.pp-bloque, .pp-escena .pp-pieza')]
  const pie = raiz.querySelector('.pp-pie')
  // El pie va último, después de la escena (el orden de la dirección)
  const orden = [...piezas.filter(p => p !== pie), pie].filter(Boolean)
  orden.forEach((el, k) => {
    el.animate(
      [{ opacity: 0, transform: 'translateY(14px) scale(.985)' }, { opacity: 1, transform: 'none' }],
      { duration: ENTRADA_MS, easing: EASE, delay: k * ESCALON_MS + RETRASO_MS, fill: 'backwards' },
    )
  })
  return duracionEscalonada(orden.length, ESCALON_MS, RETRASO_MS, ENTRADA_MS)
}

/**
 * Cambio de paso (pestaña, Anterior o Siguiente): sale la escena 14 px hacia el lado contrario al
 * avance (140 ms) y entra la nueva desde el lado del avance (280 ms), con sus bloques escalonados a
 * 40 ms. `dibujar` pone la escena nueva. El encabezado, las pestañas y el pie no se mueven.
 */
export async function cambioPaso(escenaEl, direccion, dibujar) {
  if (!escenaEl || !hayMovimiento()) { dibujar(); return }
  const lado = direccion < 0 ? -1 : 1
  try {
    await escenaEl.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-14 * lado}px)` }],
      { duration: SALE_MS, easing: EASE_CIERRA, fill: 'forwards' },
    ).finished
  } catch { /* cancelada: se dibuja igual */ }
  dibujar()
  escenaEl.getAnimations().forEach(a => a.cancel())
  escenaEl.animate([{ opacity: 0, transform: `translateX(${14 * lado}px)` }, { opacity: 1, transform: 'none' }], { duration: ENTRA_MS, easing: EASE })
  ;[...escenaEl.querySelectorAll('.pp-pieza')].forEach((el, k) => {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTRA_MS, easing: EASE, delay: k * ESCALON_PASO_MS, fill: 'backwards' })
  })
}

/**
 * Cambio de estado dentro del paso (7.1): el bloque extra y las acciones se funden (200 ms) y el
 * Avi cambia de pose con un apretón (1.04 / .96 → 1, 240 ms). Un error sacude su bloque una vez.
 */
export function cambioEstado(escenaEl, { error = false } = {}) {
  if (!escenaEl || !hayMovimiento()) return
  for (const el of escenaEl.querySelectorAll('.pp-extra, .pp-acc, .pp-enlaces')) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FUNDIDO_MS, easing: 'ease-out' })
  }
  escenaEl.querySelector('.pp-avi')?.animate([{ transform: 'scale(1.04, .96)' }, { transform: 'none' }], { duration: APRETON_MS, easing: REBOTE })
  if (error) {
    escenaEl.querySelector('.pp-err')?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(1px)' }, { transform: 'translateX(0)' }],
      { duration: SACUDE_MS, easing: 'ease-in-out' },
    )
  }
}

/** Una pestaña que acaba de quedar hecha: el glifo hace `pop` y el ✓ se traza (CSS, `.nuevo`). */
export function marcarHecha(tab) {
  const g = tab?.querySelector('.pp-g.ok')
  if (!g || !hayMovimiento()) return
  g.classList.add('nuevo')
  setTimeout(() => g.classList.remove('nuevo'), 900)
}
