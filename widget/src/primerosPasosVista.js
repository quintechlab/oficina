// Vista del asistente "Primeros pasos" (docs/diseno/bienvenida-ux.md 5 y 7.2, opción B): el
// escenario (sin tablero, en lugar del vacío) y la hoja (con tablero, en la columna principal),
// y el aviso del tablero. Solo arma HTML a partir del modelo de primerosPasos.js; los clics van
// por `data-accion` (main.js). Regla firme (10): ningún botón trae foco, ni `autofocus`, ni tiempo.

import { avi, PERSONAJE_BASE } from './avis.js'
import { escapar } from './logica.js'
import { iniciales } from './tablero.js'
import { PASOS, ORGANIZACION, pendienteAviso, deletrear, modApagado, textoAvisoMod } from './primerosPasos.js'

const X = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
const VISTO = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path class="visto" d="M3.5 8.5l3 3 6-7"/></svg>'

/** El tamaño del Avi base: 104 en el escenario y 88 en la hoja (5.1 y 5.2). */
const TAMANO_AVI = { escenario: 104, hoja: 88 }

/** El marco del asistente, que se arma una vez por forma; lo de adentro se redibuja por partes. */
export function esqueleto(forma) {
  const h = forma === 'hoja' ? 'h2' : 'h1'
  const cerrar = forma === 'hoja'
    ? 'aria-label="Cerrar primeros pasos y volver al tablero" title="Volver al tablero"'
    : 'aria-label="Cerrar primeros pasos" title="Cerrar primeros pasos"'
  return `<section class="pp ${forma}" aria-labelledby="pp-h">`
    + `<header class="pp-cab pp-bloque"><${h} class="pp-rot" id="pp-h" tabindex="-1"${forma === 'escenario' ? ' data-arrastre' : ''}></${h}>`
    + `<button type="button" class="tb" data-accion="pp-cerrar" ${cerrar}>${X}</button></header>`
    + `<div class="pp-tabs pp-bloque" id="pp-tabs" role="tablist" aria-label="Pasos"></div>`
    + `<div class="pp-escena" id="pp-escena" role="tabpanel"></div>`
    + `<nav class="pp-pie pp-bloque" id="pp-pie" aria-label="Pasos de la configuración"></nav>`
    + `</section>`
}

/** "Primeros pasos · 2 de 3": cuántos pasos están hechos (el boceto aprobado). En mayúsculas por CSS. */
export function rotulo(modelo) {
  return `Primeros pasos · ${modelo.listos} de ${PASOS.length}`
}

/** Índice de la pestaña elegida, para el indicador que se desliza; -1 en la escena final. */
export function indicePestana(visible) {
  return PASOS.findIndex(p => p.id === visible)
}

function glifoPestana(p) {
  if (p.glifo === 'hecho') return `<span class="pp-g ok" aria-hidden="true">${VISTO}</span>`
  if (p.glifo === '!') return '<span class="pp-g error" aria-hidden="true">!</span>'
  if (p.glifo === 'punto') return '<span class="pp-g punto" aria-hidden="true"></span>'
  return `<span class="pp-g" aria-hidden="true">${p.glifo}</span>`
}

/** Las pestañas (`role="tab"`, una sola parada de foco: la elegida o, en la escena final, la primera). */
export function pestanas(modelo, visible) {
  const parada = indicePestana(visible) < 0 ? PASOS[0].id : visible
  return modelo.orden.map(id => {
    const p = modelo.pasos[id]
    const elegida = id === visible
    return `<button type="button" class="pp-tab" role="tab" id="pp-tab-${id}" aria-selected="${elegida}" aria-controls="pp-escena"`
      + ` tabindex="${id === parada ? 0 : -1}" aria-label="${escapar(p.etiqueta)}" data-accion="pp-tab" data-paso="${id}" data-foco="tab:${id}">`
      + `${glifoPestana(p)}${escapar(p.corto)}</button>`
  }).join('')
}

/** Un botón del asistente. Deshabilitado con `aria-disabled` (sigue en el orden del foco y se lee su motivo, 5.3). */
function boton(a, motivoId) {
  const datos = a.valor !== undefined ? ` data-valor="${escapar(a.valor)}"` : ''
  const nombre = a.externo ? ` aria-label="${escapar(a.texto)} (abre el navegador)"` : ''
  const off = a.deshabilitada ? ` aria-disabled="true" aria-describedby="${motivoId}"` : ''
  const ext = a.externo ? '<span class="pp-ext" aria-hidden="true">↗</span>' : ''
  return `<button type="button" class="pp-btn ${a.tipo}" data-accion="pp-${a.accion}"${datos} data-foco="${escapar(`${a.accion}:${a.texto}`)}"${nombre}${off}>${escapar(a.texto)}${ext}</button>`
}

/** Botones y, debajo, cada motivo distinto una sola vez. */
function acciones(lista) {
  if (!lista.length) return ''
  const motivos = [...new Set(lista.filter(a => a.deshabilitada).map(a => a.motivo))]
  const idDe = m => `pp-motivo-${motivos.indexOf(m)}`
  return `<div class="pp-acc">${lista.map(a => boton(a, idDe(a.motivo))).join('')}`
    + motivos.map((m, k) => `<span class="pp-motivo" id="pp-motivo-${k}">${escapar(m)}</span>`).join('') + '</div>'
}

function enlaces(lista) {
  if (!lista.length) return ''
  return `<p class="pp-enlaces">${lista.map(l => {
    const datos = l.valor !== undefined ? ` data-valor="${escapar(l.valor)}"` : ''
    const nombre = l.externo ? ` aria-label="${escapar(l.texto)} (abre el navegador)"` : ''
    const off = l.deshabilitada ? ' aria-disabled="true"' : ''
    const ext = l.externo ? ' <span class="pp-ext" aria-hidden="true">↗</span>' : ''
    return `<button type="button" class="pp-enlace" data-accion="pp-${l.accion}"${datos} data-foco="${escapar(`${l.accion}:${l.texto}`)}"${nombre}${off}>${escapar(l.texto)}${ext}</button>`
  }).join('')}</p>`
}

/** La línea de la cuenta: iniciales en violeta y "Conectado como login · miembro de quintechlab". */
function cuenta(login, centrada = false) {
  return `<p class="pp-cuenta${centrada ? ' centrada' : ''}"><span class="pp-ini" aria-hidden="true">${escapar(iniciales(login).toUpperCase())}</span>`
    + `<span>Conectado como <b>${escapar(login)}</b> · miembro de ${ORGANIZACION}</span></p>`
}

/** Los dominios del "Cómo se arregla" van en mono 10 (5.3). */
const conDominios = t => escapar(t).replace(/(github\.com\S*?)(?=\.?$|\s)/g, '<code class="pp-dom">$1</code>')

/** Lo que va entre el texto y las acciones: registro, barra, error, código, cuenta, arreglo o comandos. */
function extra(e, hora) {
  if (!e) return ''
  switch (e.tipo) {
    case 'registro': return `<div class="pp-registro" role="group" aria-label="Progreso de la instalación">`
      + e.lineas.map(l => `<p class="${l.hecho ? 'ok' : 'va'}">${escapar(l.comando)}</p>`).join('')
      + '<div class="pp-barra" aria-hidden="true"></div></div>'
    case 'barra': return '<div class="pp-barra sola" aria-hidden="true"></div>'
    case 'error': return `<div class="pp-err"><p class="m">✕ ${escapar(e.comando)}</p><p>${escapar(e.linea)}</p></div>`
    case 'comandos': return `<details class="pp-cmds" data-foco="detalles"><summary>Ver los comandos</summary><div class="pp-registro">`
      + e.lineas.map(l => `<p>${escapar(l)}</p>`).join('') + '</div></details>'
    case 'cuenta': return cuenta(e.login)
    case 'arreglo': return `<div class="pp-err pp-arreglo"><p class="pp-arreglo-t">Cómo se arregla</p><ol>`
      + e.pasos.map(p => `<li>${conDominios(p)}</li>`).join('') + '</ol></div>'
    case 'codigo': {
      const letras = [...e.codigo].map((c, k) => `<i style="--k:${k}"${c === '-' ? ' class="g"' : ''}>${escapar(c)}</i>`).join('')
      return `<div class="pp-caja-cod"><span class="pp-cod" role="img" aria-label="Código: ${escapar(deletrear(e.codigo))}">${letras}</span>`
        + `<button type="button" class="pp-btn sec" data-accion="pp-copiar" data-valor="${escapar(e.codigo)}" data-copiado="Código copiado" data-foco="copiar:codigo" aria-label="Copiar el código">Copiar</button></div>`
        + '<p class="pp-espera"><i class="pp-pt" aria-hidden="true"></i>esperando que autorices en el navegador…</p>'
        + `<p class="pp-vence">vence a las ${escapar(hora(e.vence))}</p>`
    }
    default: return ''
  }
}

/** El Avi base, el rótulo, el título y el texto: centrados (escenario) o en dos columnas (hoja). */
function cabezaEscena(forma, pose, rot, titulo, textoHtml) {
  const h = forma === 'hoja' ? 'h3' : 'h2'
  const figura = `<div class="pp-avi pp-pieza">${avi(PERSONAJE_BASE, pose, TAMANO_AVI[forma])}</div>`
  const textos = `<p class="pp-n pp-pieza">${escapar(rot)}</p><${h} class="pp-h pp-pieza" id="pp-titulo" tabindex="-1">${escapar(titulo)}</${h}>`
    + (textoHtml ? `<p class="pp-txt pp-pieza">${textoHtml}</p>` : '')
  return forma === 'hoja' ? `<div class="pp-fila">${figura}<div class="pp-textos">${textos}</div></div>` : figura + textos
}

/**
 * La escena visible: un paso (con su estado) o la escena final ('listo', 4.5). `hora(ms)`: la hora
 * local "12:19" para el vencimiento del código.
 */
export function escena(modelo, visible, forma, hora) {
  if (visible === 'listo') {
    const login = modelo.pasos.gh.extra?.login
    return cabezaEscena(forma, 'listo', `Listo · ${PASOS.length} de ${PASOS.length}`, 'Avis está listo',
      'Para que las sesiones de Claude Code que ya están abiertas carguen el mod, reinicialas o escribí <code class="pp-code">/reload-plugins</code> en cada una.')
      + `<div class="pp-extra pp-pieza">${login ? cuenta(login, true) : ''}</div>`
      + `<div class="pp-pieza"><div class="pp-acc"><button type="button" class="pp-btn pri" data-accion="pp-ir" data-foco="ir">Ir a Avis</button>`
      + `<button type="button" class="pp-btn sec" data-accion="pp-copiar" data-valor="/reload-plugins" data-foco="copiar:reload">Copiar <code class="pp-code">/reload-plugins</code></button></div></div>`
  }
  const p = modelo.pasos[visible]
  // La cuenta conectada va en el lugar del texto (4.4, Hecho)
  const texto = p.texto ? escapar(p.texto) : ''
  return cabezaEscena(forma, p.pose, `Paso ${p.n} de ${PASOS.length} · ${p.nombre}`, p.titulo, texto)
    + `<div class="pp-extra pp-pieza${p.extra?.tipo === 'error' || p.extra?.tipo === 'arreglo' ? ' con-error' : ''}">${extra(p.extra, hora)}${p.nota ? `<p class="pp-nota">${escapar(p.nota)}</p>` : ''}</div>`
    + `<div class="pp-pieza">${acciones(p.acciones)}${enlaces(p.enlaces)}</div>`
}

/** "← Anterior" y "Siguiente →": solo cambian la vista; deshabilitados al .38 (5.1). */
export function pie(anterior, siguiente) {
  const off = v => (v ? '' : ' aria-disabled="true"')
  return `<button type="button" class="pp-nav" data-accion="pp-anterior" data-foco="anterior"${off(anterior)}>← Anterior</button>`
    + `<button type="button" class="pp-nav sig" data-accion="pp-siguiente" data-foco="siguiente"${off(siguiente)}>Siguiente →</button>`
}

/**
 * El aviso del tablero (3.5): la píldora del aviso de pregunta con borde neutro, el Avi base quieto
 * en "saluda" y lo primero que falta. Vacío si no falta nada.
 */
export function avisoAsistente(modelo) {
  // El mod apagado no se prende solo (#17): "Prender" corre activar con el clic
  if (modApagado(modelo)) {
    return `<button type="button" class="aviso pp-aviso" data-accion="pp-correr" data-valor="activar" aria-label="El mod está apagado. Prender">`
      + `${avi(PERSONAJE_BASE, 'durmiendo', 28)}<span>El mod está <b>apagado</b></span><span class="ir">Prender</span></button>`
  }
  const falta = pendienteAviso(modelo)
  if (!falta) return ''
  return `<button type="button" class="aviso pp-aviso" data-accion="pp-ver" aria-label="Primeros pasos: falta ${escapar(falta)}. Ver">`
    + `${avi(PERSONAJE_BASE, 'saluda', 28)}<span>Falta <b>${escapar(falta)}</b></span><span class="ir">Ver →</span></button>`
}

/**
 * El aviso de una vez después de que Avis instaló o actualizó el mod solo (#17): la misma píldora
 * del tablero; su clic lo cierra ("Entendido"). Sin aviso, ''.
 */
export function avisoMod(aviso) {
  const texto = textoAvisoMod(aviso)
  if (!texto) return ''
  const v = escapar(aviso.version)
  const visible = escapar(texto).replace(v, `<b>${v}</b>`)
  return `<button type="button" class="aviso pp-aviso" data-accion="pp-mod-visto" aria-label="${escapar(texto)}. Entendido">`
    + `${avi(PERSONAJE_BASE, 'listo', 28)}<span>${visible}</span><span class="ir">Entendido</span></button>`
}
