// La hoja de la configuración (#23, docs/diseno/configuracion-ux.md 4.3 y 5): el esqueleto, las
// pestañas, la línea de la pregunta pendiente y el contenido de cada pestaña. Solo HTML, como
// primerosPasosVista.js: los datos llegan armados desde main.js y nada de acá toca el DOM.
// Entrega 1: la pestaña Panel; las demás muestran solo su rótulo hasta su entrega.

import { escapar } from './logica.js'
import { PESTANAS, UBICACIONES, limitesTamano } from './configuracion.js'

/** El texto debajo de una fila cuyo ajuste no se pudo guardar (7.5). */
export const TEXTO_ERROR_GUARDAR = 'No se pudo guardar. Probá de nuevo.'

/**
 * Lo que no cambia mientras la hoja está abierta: la línea de la pregunta (`#cfg-aviso`), las
 * pestañas (`#cfg-tabs`), el panel de pestaña (`#cfg-p`, desplaza adentro) y la región de anuncios.
 */
export function esqueletoConfiguracion(tab) {
  return `<div id="cfg-aviso"></div>`
    + `<div id="cfg-tabs">${pestanasConfiguracion(tab)}</div>`
    + `<div class="cfg-cuerpo" role="tabpanel" id="cfg-p" aria-labelledby="cfg-t-${escapar(tab)}" tabindex="0"><div class="cfg-in" id="cfg-cont"></div></div>`
    + `<p class="oculto" role="status" id="cfg-vivo"></p>`
}

/** Las cinco pestañas (`tablist`, activación automática): una sola en el orden de tabulación. */
export function pestanasConfiguracion(tab) {
  const tabs = PESTANAS.map(({ id, nombre }) => {
    const sel = id === tab
    return `<button type="button" class="pes" role="tab" id="cfg-t-${id}" aria-selected="${sel}" aria-controls="cfg-p" tabindex="${sel ? 0 : -1}" data-accion="cfg-tab" data-valor="${id}" data-k="tab-${id}">${nombre}</button>`
  }).join('')
  return `<div class="pestanas" role="tablist" aria-label="Configuración">${tabs}<span class="ind" aria-hidden="true"></span></div>`
}

/**
 * Con una pregunta pendiente y la configuración abierta (4.1): la línea ámbar que cierra la
 * configuración y muestra la pregunta. Sin preguntas, nada.
 */
export function avisoPreguntaConfiguracion(pendientes) {
  if (!pendientes) return ''
  return '<button type="button" class="aviso cfg-aviso" data-accion="cfg-ver"><span>Claude te hace una pregunta</span><span class="ir">Ver →</span></button>'
}

/** El contenido de una pestaña. Las que todavía no tienen el suyo muestran solo su rótulo. */
export function seccionConfiguracion(tab, datos) {
  if (tab === 'panel') return seccionPanel(datos)
  const p = PESTANAS.find(x => x.id === tab)
  return p ? `<h3 class="sub">${p.nombre}</h3>` : ''
}

// ------------------------------------------------------------------ piezas (6.1)

const errorDe = (datos, clave) => (datos.error === clave ? `<p class="aj-error">${TEXTO_ERROR_GUARDAR}</p>` : '')

/** Una fila: título, descripción y el control a la derecha (`apilada`: abajo, a todo el ancho). */
function fila(titulo, descripcion, control, { apilada = false, error = '' } = {}) {
  return `<div class="aj${apilada ? ' apilada' : ''}"><div><span class="aj-t">${titulo}</span><span class="aj-d">${descripcion}</span></div>`
    + `<div class="aj-ctl">${control}</div>${error}</div>`
}

/** Interruptor (`role=switch`): "Sí"/"No" a la izquierda solo a la vista; el estado lo da `aria-checked`. */
function interruptor(clave, etiqueta, valor) {
  return `<span class="sw-e" aria-hidden="true">${valor ? 'Sí' : 'No'}</span>`
    + `<button type="button" class="sw" role="switch" aria-checked="${!!valor}" aria-label="${etiqueta}" data-accion="cfg-sw" data-valor="${clave}" data-k="sw-${clave}"><i></i></button>`
}

/** Segmentos (`radiogroup` con foco itinerante): la opción elegida es la única en el orden de tabulación. */
function segmentos(accion, opciones, actual, etiqueta, clase = '') {
  const botones = opciones.map(([v, t]) => {
    const sel = v === actual
    return `<button type="button" role="radio" aria-checked="${sel}" tabindex="${sel ? 0 : -1}" data-accion="${accion}" data-valor="${v}" data-k="${accion}-${v}">${t}</button>`
  }).join('')
  return `<div class="seg${clase ? ` ${clase}` : ''}" role="radiogroup" aria-label="${etiqueta}">${botones}</div>`
}

/** Tamaño: − / % / +, con las puntas en `aria-disabled` (siguen enfocables). */
function pasoTamano(tamano) {
  const { achicar, agrandar } = limitesTamano(tamano)
  return '<div class="paso" role="group" aria-label="Tamaño del panel">'
    + `<button type="button" class="pb" aria-label="Achicar" aria-disabled="${!achicar}" data-accion="cfg-tam" data-valor="-1" data-k="tam-menos"${achicar ? '' : ' title="Ya está en el más chico"'}>−</button>`
    + `<output class="pv" aria-live="polite">${Number(tamano)} %</output>`
    + `<button type="button" class="pb" aria-label="Agrandar" aria-disabled="${!agrandar}" data-accion="cfg-tam" data-valor="1" data-k="tam-mas"${agrandar ? '' : ' title="Ya está en el más grande"'}>+</button>`
    + '</div>'
}

/**
 * Pestaña Panel (4.4): tamaño, dónde vive, siempre arriba, avisar, pausar y arrancar con Windows,
 * en ese orden. `datos`: { tamano, ubicacion, arriba, avisar, pausa, arranque, error } (`error`: la
 * clave del ajuste que no se pudo guardar, o null).
 */
export function seccionPanel(datos) {
  return fila('Tamaño', 'De 100 a 200 %, de a 25. También con Ctrl + y Ctrl −.', pasoTamano(datos.tamano), { error: errorDe(datos, 'tamano') })
    + fila('Dónde vive', 'Flotando, o acoplada a un borde de la pantalla.', segmentos('cfg-ubic', UBICACIONES, datos.ubicacion, 'Dónde vive', 'ancho'), { apilada: true, error: errorDe(datos, 'ubicacion') })
    + fila('Siempre arriba', 'Queda encima de las otras ventanas.', interruptor('arriba', 'Siempre arriba', datos.arriba), { error: errorDe(datos, 'arriba') })
    + fila('Avisarme con cada pregunta', 'Una notificación de Windows cuando Claude te pregunta algo.', interruptor('avisar', 'Avisarme con cada pregunta', datos.avisar), { error: errorDe(datos, 'avisar') })
    + fila('Pausar animaciones', 'Las mascotas quedan quietas en su pose.', interruptor('pausa', 'Pausar animaciones', datos.pausa), { error: errorDe(datos, 'pausa') })
    + fila('Arrancar con Windows', 'Apagado de fábrica: solo lo cambia tu clic.', interruptor('arranque', 'Arrancar con Windows', datos.arranque), { error: errorDe(datos, 'arranque') })
}
