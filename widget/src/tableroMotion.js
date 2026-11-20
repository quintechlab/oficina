// Movimiento del tablero (docs/diseno/estilo-avis-ux.md, 6.1 y 6.2): la entrada escalonada al
// mostrarse la ventana y el cambio de proyecto. Alcanza con CSS (estilos.css: `.rv`, `.cambia` y
// `.rv-ses`); este módulo solo pone las clases y los índices, y las saca al terminar, así un
// redibujo de las lecturas de 1,5 s no repite la entrada. Con movimiento reducido o "Pausar
// animaciones" no hace nada: el contenido aparece al instante.

/** Bloques que entran escalonados, en el orden del DOM (6.1). */
const BLOQUES = ['.marca', '#proyectos > .pj', '.lado-pie', '.cab', '#otro > *', '#w-globo > *', '#cuadros > .stat', '#sesiones > .ses'].join(', ')

const ENTRADA_MS = 620
const ESCALON_MS = 65
const RETRASO_MS = 120
const CAMBIO_MS = 240
const ESCALON_TARJETAS_MS = 40

/** ¿Hay que animar? No con movimiento reducido ni con "Pausar animaciones" de la bandeja (6.5). */
export function hayMovimiento() {
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('pausa')
}

/** Cuánto tarda en terminar una entrada escalonada de `n` piezas. */
export function duracionEscalonada(n, escalon, retraso, duracion) {
  return Math.max(0, n - 1) * escalon + retraso + duracion
}

const vueltas = new WeakMap()

/** Pone `clase` (con su índice en `--i`) a las piezas y la saca cuando termina la última. */
function animar(piezas, clase, totalMs) {
  const vuelta = {}
  for (const [k, el] of piezas.entries()) {
    el.classList.remove(clase)
    el.style.setProperty('--i', k)
    vueltas.set(el, vuelta)
  }
  // Fuerza el reinicio si la clase ya estaba (cambios de proyecto seguidos)
  void document.body.offsetWidth
  for (const el of piezas) el.classList.add(clase)
  setTimeout(() => {
    for (const el of piezas) {
      if (vueltas.get(el) !== vuelta) continue
      el.classList.remove(clase)
      el.style.removeProperty('--i')
    }
  }, totalMs + 50)
}

/** Entrada escalonada (6.1): al mostrarse la ventana y al expandir desde la tira. */
export function entrada() {
  if (!hayMovimiento()) return
  const piezas = [...document.querySelectorAll(BLOQUES)]
  animar(piezas, 'rv', duracionEscalonada(piezas.length, ESCALON_MS, RETRASO_MS, ENTRADA_MS))
}

/**
 * Cambio de proyecto (6.2): solo la columna principal entra en 240 ms, 14 px desde el lado de `direccion`
 * (−1 o 1), y las tarjetas de sesión entran escalonadas cada 40 ms. Se llama después de dibujar
 * el proyecto nuevo.
 */
export function cambioProyecto(direccion) {
  if (!hayMovimiento()) return
  const principal = document.querySelector('.principal')
  if (!principal) return
  principal.style.setProperty('--desde', `${(direccion < 0 ? -1 : 1) * 14}px`)
  animar([principal], 'cambia', CAMBIO_MS)
  const tarjetas = [...document.querySelectorAll('#sesiones > .ses')]
  animar(tarjetas, 'rv-ses', duracionEscalonada(tarjetas.length, ESCALON_TARJETAS_MS, 0, ENTRADA_MS))
}
