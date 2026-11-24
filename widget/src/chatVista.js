// La hoja de la charla (docs/diseno/chat-avis-ux.md 3.2, 4 y 5): el HTML de cada parte, a partir de
// `st.chat`. Puro: main.js lo pone en el DOM y chat.test.js lo revisa. Todo lo que viene del modelo,
// del usuario o de una ruta pasa por `escapar` o por `markdownSeguro` (regla 4).
//
// `m` (el modelo de la vista): `{ chat, especie, ahoraMs, reciente, hablando, puedeAdjuntar, proyectos,
// mostrado, animar }`. `mostrado`: el texto de la respuesta en curso que ya está a la vista (lo demás
// entra con `.w`); `animar` falso: sin `.w` (movimiento reducido, pausa o la hoja que vuelve a verse).
// `reciente`: el saludo o el festejo de la mascota; `puedeAdjuntar`: los adjuntos ya funcionan (la
// entrega 5), si no, ni el clip ni "Resumime un PDF" aparecen; `proyectos`: `carpetasDeProyectos`.

import { escapar } from './logica.js'
import { avi, claudeDe } from './avis.js'
import { datosEspecie } from './especies.js'
import {
  animoChat, ocupado, markdownSeguro, tramoVivo, piezasPalabras, textoHerramientas, sugerencias, nombreCarpeta, relojEspera,
  mensajesVisibles, listaCharlas, coincideBusqueda, grupoDeFecha, horaCharla, cifrasDescarga, formatoGB, detalleAdjunto,
  MODELOS, modeloValido, nombreModelo,
} from './chat.js'

/** Los iconos de 5.4: SVG de 16, trazo de 1,4 a 1,9 y `currentColor`. */
export const ICONOS = Object.freeze({
  carpeta: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 4.5a1 1 0 0 1 1-1h3.6l1.4 1.6h6a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
  flecha: '<svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  reloj: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.8V8l2.2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  cerrar: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  clip: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 4.5 5.6 9.4a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5 5a4.2 4.2 0 0 0 6 6l4.4-4.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  enviar: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3.5M3.8 7.6 8 3.4l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  nube: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 12.5h7a3 3 0 0 0 .4-6 4 4 0 0 0-7.7.9 2.6 2.6 0 0 0 .3 5.1z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="m6.6 8.2 2.8 2.8m0-2.8-2.8 2.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  lupa: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m10.5 10.5 3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
})

const nombreDe = m => datosEspecie(m.especie).nombre
const motorDe = m => m.chat.conversacion?.motor ?? m.chat.motor
const carpetaDe = m => m.chat.conversacion?.carpeta ?? null
const modeloDe = m => modeloValido(m.chat.conversacion ? m.chat.conversacion.modelo : m.chat.modelo)
/** El código en línea de los textos fijos (`claude`), escapado. */
const conCodigo = t => escapar(t).replace(/`([^`]+)`/g, '<code>$1</code>')
const boton = (accion, texto, { primario = false, extra = '' } = {}) => `<button type="button" class="btn${primario ? ' pri' : ''}" data-accion="${accion}"${extra}>${texto}</button>`

// ------------------------------------------------------------------ escenario (3.2 y 5.3)

/** Qué hace la mascota, en el escenario ("te escucha · vía Claude Code"; textos del boceto). */
export function animoEscena(m) {
  const c = m.chat
  if (c.soltando) return 'mira el archivo'
  if (c.cajon) return 'recordando'
  switch (c.estado) {
    case 'esperando': return c.paso >= 2 ? 'pensando' : 'despertando…'
    case 'escribiendo': return 'contando'
    case 'listo': return 'listo'
    case 'frenada': return 'frenada'
    case 'error': return c.error?.motivo === 'red' ? 'sin conexión' : 'falló'
    default: return 'te escucha'
  }
}

/** La mascota del escenario: 96 px, siempre en forma base (D5), con la pose de 3.3. */
export function aviEscena(m) {
  const c = m.chat
  const animo = animoChat(c.estado, c.paso, !!m.hablando, { reciente: !!m.reciente, soltando: !!c.soltando, cajon: c.cajon })
  return avi(claudeDe(m.especie), animo, 96)
}

/** El estado del escenario: el ánimo y quién responde, siempre a la vista (regla 3). */
export const estadoEscena = m => `<i aria-hidden="true"></i>${escapar(animoEscena(m))} · ${motorDe(m) === 'local' ? 'modelo local' : 'vía Claude Code'}`

/** El escenario entero (los botones de arriba van fijos en index.html). */
export function escena(m) {
  return `<div id="chat-avi" class="voz">${aviEscena(m)}</div><b class="esc-nom">${escapar(nombreDe(m))}</b><span class="esc-est">${estadoEscena(m)}</span>`
}

// ------------------------------------------------------------------ cabecera: carpeta, motor y modelo (3.4, #35)

/**
 * El botón del modelo (#35, S1), después del motor. Con el motor local no hay (S4); con un turno en
 * curso queda en `aria-disabled` (sigue enfocable y dice por qué): el cambio va entre turnos.
 */
function botonModelo(m) {
  if (motorDe(m) === 'local') return ''
  const nombre = escapar(nombreModelo(modeloDe(m)))
  const estado = ocupado(m.chat)
    ? ' aria-disabled="true" title="Cambialo cuando termine la respuesta"'
    : ' title="El modelo de Claude de esta charla"'
  return `<button type="button" class="modelo" data-accion="ch-modelo-menu" aria-haspopup="menu" aria-controls="chat-menu" aria-expanded="${!!m.chat.menuModelo}" aria-label="Modelo: ${nombre}"${estado}><span>${nombre}</span>${ICONOS.flecha}</button>`
}

export function cabecera(m) {
  const local = motorDe(m) === 'local'
  const nombre = local ? 'Sesiones de Avis' : nombreCarpeta(carpetaDe(m))
  const carpeta = local
    ? `<button type="button" class="carpeta" data-accion="ch-menu" aria-haspopup="menu" aria-expanded="false" aria-disabled="true" title="El modelo local solo ve tus sesiones de Avis" aria-label="Carpeta: ${escapar(nombre)}">${ICONOS.carpeta}<span class="ruta">${escapar(nombre)}</span></button>`
    : `<button type="button" class="carpeta" data-accion="ch-menu" aria-haspopup="menu" aria-controls="chat-menu" aria-expanded="${m.chat.menu}" aria-label="Carpeta: ${escapar(nombre)}" title="${escapar(carpetaDe(m) ?? nombre)}">${ICONOS.carpeta}<span class="ruta">${escapar(nombre)}</span>${ICONOS.flecha}</button>`
  const radio = (motor, texto, titulo) => {
    const si = motorDe(m) === motor
    return `<button type="button" role="radio" data-accion="ch-motor" data-motor="${motor}" aria-checked="${si}" tabindex="${si ? 0 : -1}" title="${titulo}">${texto}</button>`
  }
  return `${carpeta}<div class="motor" role="radiogroup" aria-label="Motor">${radio('claude', 'Claude Code', 'Tu suscripción · lee archivos y PDFs')}${radio('local', 'Local', 'En esta PC · privado, sin internet')}</div>${botonModelo(m)}`
}

/** El menú del modelo (#35): las cinco opciones de `MODELOS`, con la de la charla marcada. */
export function menuModelo(m) {
  const actual = modeloDe(m)
  const items = MODELOS.map(({ id, nombre, pista }) => `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${id === actual}" data-accion="ch-modelo" data-modelo="${id ?? ''}"><span><b>${escapar(nombre)}</b><small>${escapar(pista)}</small></span></button>`)
  return `<div class="menu" role="menu" aria-label="Elegir modelo">${items.join('')}</div>`
}

/** El menú de carpeta (3.4): Solo Avis, los proyectos de la barra, las recientes y "Elegir otra carpeta…". */
export function menuCarpeta(m) {
  const actual = carpetaDe(m)
  const item = (ruta, nombre, sub) => `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${(ruta || null) === actual}" data-accion="ch-carpeta" data-carpeta="${escapar(ruta ?? '')}">${ICONOS.carpeta}<span><b>${escapar(nombre)}</b><small>${escapar(sub)}</small></span></button>`
  const partes = [item(null, 'Solo Avis', 'Sin carpeta: sabe de tus sesiones')]
  const proyectos = m.proyectos ?? []
  if (proyectos.length) {
    partes.push('<hr role="separator"><span class="rot" role="presentation">Proyectos de la barra</span>')
    for (const p of proyectos) partes.push(item(p.cwd, p.nombre, p.cwd))
  }
  const enBarra = new Set(proyectos.map(p => p.cwd))
  const recientes = (m.chat.recientes ?? []).filter(r => !enBarra.has(r)).slice(0, 5)
  if (recientes.length) {
    partes.push('<hr role="separator"><span class="rot" role="presentation">Recientes</span>')
    for (const r of recientes) partes.push(item(r, nombreCarpeta(r), r))
  }
  partes.push('<hr role="separator"><button type="button" role="menuitem" tabindex="-1" class="otra" data-accion="ch-otra-carpeta">＋ Elegir otra carpeta…</button>')
  return `<div class="menu" role="menu" aria-label="Elegir carpeta">${partes.join('')}</div>`
}

// ------------------------------------------------------------------ el hilo (4.1 y 4.2)

/** Los textos de cada error (4.2): título, cuerpo y acciones `[accion, texto]` (la primera, primaria). */
export function textoError(motivo, detalle = null) {
  const reintentar = ['ch-reintentar', 'Reintentar']
  switch (motivo) {
    case 'red': return { titulo: 'No llego a Claude Code', cuerpo: 'Parece que no hay conexión. Tu mensaje no se perdió: lo mando de nuevo cuando quieras.', acciones: [reintentar, ['ch-usar-local', 'Preguntarle al modelo local']] }
    case 'sin-claude': return { titulo: 'No encuentro Claude Code', cuerpo: 'Avis no encontró `claude` en esta PC. Instalalo desde Primeros pasos.', acciones: [['ch-primeros-pasos', 'Abrir Primeros pasos'], ['ch-usar-local', 'Usar el modelo local']] }
    case 'sesion': return { titulo: 'Claude Code no tiene tu sesión', cuerpo: 'Abrí `claude` en una terminal para iniciar sesión y volvé a probar.', acciones: [reintentar] }
    case 'limite': return { titulo: 'Llegaste al límite de uso', cuerpo: 'Tu suscripción pidió una pausa. Podés seguir con el modelo local.', acciones: [['ch-usar-local', 'Preguntarle al modelo local']] }
    case 'tope': return { titulo: 'Esta charla llegó a su tope', cuerpo: 'Empezá una charla nueva para seguir.', acciones: [['ch-nueva', 'Charla nueva']] }
    case 'tiempo': return { titulo: 'Claude Code no respondió', cuerpo: 'Pasaron 2 minutos sin noticias.', acciones: [reintentar] }
    case 'adjunto': return { titulo: `No puedo leer ${detalle ?? 'el archivo'}`, cuerpo: 'Puedo leer PDF, imágenes, texto y código, de hasta 20 MB.', acciones: [] }
    case 'local': return { titulo: 'El modelo de esta PC no responde', cuerpo: detalle ? `${detalle}.` : '', acciones: [reintentar, ['ch-usar-claude', 'Usar Claude Code']] }
    default: return { titulo: 'Se cortó la sesión de Claude Code', cuerpo: 'Vuelvo a abrirla con lo que ya hablamos.', acciones: [reintentar] }
  }
}

/** La tarjeta de un error (4.2). `cerrar`: la acción de "Cerrar" cuando el error no tiene otras. */
function tarjetaError(e = { motivo: 'otro' }, cerrar = 'ch-descartar') {
  const t = textoError(e.motivo, e.detalle)
  const titulo = e.motivo === 'otro' && e.detalle ? ` title="${escapar(e.detalle)}"` : ''
  const acciones = t.acciones.map(([a, texto], k) => boton(a, escapar(texto), { primario: k === 0 }))
  if (!t.acciones.length) acciones.push(boton(cerrar, 'Cerrar el aviso'))
  return `<div class="err" role="alert"${titulo}><b>${ICONOS.nube}${escapar(t.titulo)}</b>${t.cuerpo ? `<p>${conCodigo(t.cuerpo)}</p>` : ''}<div class="acc">${acciones.join('')}</div></div>`
}

const quien = m => `<div class="quien"><i aria-hidden="true"></i>${escapar(nombreDe(m))}</div>`

/** La bienvenida de una charla vacía (4.1), o la tarjeta de descarga del modelo local. */
function bienvenida(m) {
  const motor = motorDe(m)
  const carpeta = carpetaDe(m)
  // Sin saber todavía (antes de chat_abrir), la bienvenida: mandar igual llega a Rust, que dice si falta
  if (motor === 'local' && ['falta', 'bajando', 'roto'].includes(m.chat.local)) return descargaLocal(m)
  const saludo = motor === 'local'
    ? '¡Hola! Te respondo con el modelo de esta PC: privado y sin internet. Sé lo que pasa en tus sesiones de Avis.'
    : carpeta
      ? `¡Hola! Estoy en <b>${escapar(nombreCarpeta(carpeta))}</b> con Claude Code. Preguntame por tus sesiones, pedime documentación o pasame un archivo.`
      : '¡Hola! Preguntame por tus sesiones de Avis o pasame un archivo.'
  const sug = sugerencias(motor, carpeta ? nombreCarpeta(carpeta) : null)
    .map((s, i) => ({ ...s, i }))
    .filter(s => !s.adjuntar || m.puedeAdjuntar)
    .map(s => `<button type="button" data-accion="ch-sugerencia" data-i="${s.i}">${escapar(s.texto)}</button>`)
  const pista = motor === 'local' ? 'El modelo local no lee carpetas ni archivos' : m.puedeAdjuntar ? '⤓ Arrastrá un PDF o cualquier archivo acá' : ''
  return `<div class="bienvenida">${quien(m)}<div class="m-m"><div class="txt"><p>${saludo}</p></div></div><div class="sug">${sug.join('')}</div>${pista ? `<p class="pista">${pista}</p>` : ''}</div>`
}

/** "Local sin instalar" (4.1): bajar el modelo con un clic, o volver a Claude Code; mientras baja, el progreso. */
function descargaLocal(m) {
  const p = m.chat.progreso ?? { bajado: 0, total: 0 }
  const total = p.total > 0 ? formatoGB(p.total) : null
  if (m.chat.local === 'bajando') {
    const c = cifrasDescarga(p)
    return `<div class="descarga">${quien(m)}<div class="cifra"><b data-gb>${c.cifra}</b><small>de ${c.total}</small><span data-pc>${c.porcentaje} %</span></div>`
      + `<div class="barra" role="progressbar" aria-label="Descarga del modelo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${c.porcentaje}" style="--p:${c.fraccion}"><i></i></div>`
      + `<div class="acc">${boton('ch-usar-claude', 'Usar Claude Code')}</div></div>`
  }
  return `<div class="descarga">${quien(m)}<div class="m-m"><div class="txt"><p>Para charlar sin internet necesito bajar el modelo de esta PC (${total ?? '2,6 GB'}, una sola vez).</p></div></div>`
    + `<div class="acc">${boton('ch-descargar', `Descargar ${total ?? '2,6 GB'}`, { primario: true })}${boton('ch-usar-claude', 'Usar Claude Code')}</div></div>`
}

/** La espera (3.3): título, reloj, barra, los tres pasos y la nota. */
function espera(m) {
  const c = m.chat
  const local = motorDe(m) === 'local'
  const pasos = local
    ? ['Despertando el modelo de esta PC', 'Leyendo tus sesiones de Avis', 'Pensando la respuesta']
    : [`Abriendo Claude Code en ${nombreCarpeta(carpetaDe(m))}`, 'Mandando tu pregunta', 'Pensando la respuesta']
  const r = relojEspera(c.desdeMs ?? m.ahoraMs, c.ultimoMs, m.ahoraMs)
  const paso = (t, i) => `<div class="paso${i < c.paso ? ' listo' :i === c.paso ? ' ahora' : ''}"><i aria-hidden="true"></i>${escapar(t)}</div>`
  const nota = r.tarda ? 'Está tardando más de lo normal. Podés esperar o frenar' : 'La primera respuesta tarda unos segundos. Las que siguen, menos.'
  return `<div class="espera"><div class="arr"><b>${escapar(nombreDe(m))} está despertando a ${local ? 'su modelo' : 'Claude'}</b><span class="reloj" data-reloj>${r.reloj}</span></div>`
    + `<div class="barra-ind" aria-hidden="true"></div>${pasos.map(paso).join('')}<small>${nota}</small></div>`
}

/**
 * Las palabras nuevas del bloque abierto (6.2): cada una en un `.w`, que entra sola con su animación de
 * CSS; sin movimiento (`animar` falso), el texto escapado, sin spans. Siempre escapado (regla 4).
 */
export function htmlPalabras(texto, animar = true) {
  if (!animar) return escapar(texto ?? '')
  return piezasPalabras(texto).map(p => `<span class="w">${escapar(p)}</span>`).join('')
}

/**
 * El texto de una respuesta en curso: los bloques cerrados dibujados y el abierto como texto (6.2).
 * `mostrado`: lo que ya estaba a la vista (por defecto, todo): solo lo que sigue entra con `.w`, así
 * redibujar el hilo no vuelve a animar lo que ya se leyó. `animar` falso: sin `.w` (6.3).
 */
export function textoVivo(texto, mostrado = texto, animar = true) {
  const { cerrados, visto, nuevo } = tramoVivo(mostrado, texto)
  return `<div class="txt" data-bloques="${cerrados.length}">${cerrados.map(markdownSeguro).join('')}<p class="abierto">${escapar(visto)}${htmlPalabras(nuevo, animar)}</p><span class="caret" aria-hidden="true"></span></div>`
}

/** Tu mensaje. `fallido`: no salió (el error del último turno), con "No se envió" (4.2). */
function usuario(msg, fallido) {
  const adj = (msg.adjuntos ?? []).map(a => `<span class="adj-min">${ICONOS.clip}${escapar(a.nombre)}</span>`).join('')
  return `<div class="m-u${fallido ? ' fallido' : ''}">${adj}<span class="t">${escapar(msg.texto)}</span>${fallido ? '<span class="tag-no">No se envió</span>' : ''}</div>`
}

function mascota(m, msg, k, ultimo) {
  const c = m.chat
  const carpeta = nombreCarpeta(carpetaDe(m))
  const herr = textoHerramientas(msg.herramientas, carpeta, { avis: !!msg.avis })
  const partes = [quien(m)]
  if (herr) partes.push(`<div class="herr">↳ ${herr}</div>`)
  const enCurso = ultimo && msg.turno === c.turno && (c.estado === 'esperando' || c.estado === 'escribiendo')
  if (enCurso && !msg.texto) {
    partes.push(espera(m))
    return partes.join('')
  }
  if (enCurso) {
    partes.push(`<div class="m-m vivo">${textoVivo(msg.texto, m.mostrado ?? msg.texto, m.animar !== false)}</div>`)
    return partes.join('')
  }
  const cortado = msg.estado === 'frenada' ? '<span class="cortado">■ frenaste acá</span>' : ''
  const txt = msg.texto ? markdownSeguro(msg.texto) : ''
  let pie = ''
  if (msg.estado === 'ok') {
    const quienResponde = motorDe(m) === 'local' ? 'modelo local' : 'Claude Code'
    pie = `<div class="pie-m"><button type="button" data-accion="ch-copiar" data-i="${k}" aria-label="Copiar respuesta">Copiar</button><span>${Math.round((msg.ms ?? 0) / 1000)} s · ${quienResponde}</span></div>`
  }
  partes.push(`<div class="m-m"><div class="txt">${txt}${cortado}</div>${pie}</div>`)
  if (msg.estado === 'frenada' && ultimo && c.estado === 'frenada') partes.push(`<div class="acc">${boton('ch-volver-a-preguntar', 'Volver a preguntar')}</div>`)
  return partes.join('')
}

/**
 * El hilo entero (`#chat-hilo`): la línea "Charla nueva en …", la bienvenida o los mensajes (los
 * últimos 60 con más de 200, D32), la espera, el texto que llega y la tarjeta de error. El reloj de
 * la espera va en `[data-reloj]` (main.js lo reescribe en su lugar cada segundo).
 */
export function hilo(m) {
  const c = m.chat
  const conv = c.conversacion
  const partes = []
  if (c.estado === 'error' && c.error?.motivo === 'red' && c.local === 'instalado') partes.push('<div class="offline" role="status"><i aria-hidden="true"></i>Sin internet · el modelo local sigue andando</div>')
  if (conv?.nuevaEn) partes.push(`<p class="nueva-en">Charla nueva en ${escapar(conv.nuevaEn)}</p>`)
  const todos = conv?.mensajes ?? []
  if (!todos.length) {
    partes.push(bienvenida(m))
  } else {
    const { mensajes, ocultos } = mensajesVisibles(todos, c.todos)
    if (ocultos) partes.push(`<button type="button" class="btn ver-antes" data-accion="ch-todos">Ver mensajes anteriores</button>`)
    const base = todos.length - mensajes.length
    mensajes.forEach((msg, j) => {
      const k = base + j
      if (msg.rol === 'usuario') {
        partes.push(usuario(msg, msg.estado === 'no-enviado' && c.estado === 'error' && msg.turno === c.turno))
      } else {
        partes.push(mascota(m, msg, k, k === todos.length - 1))
      }
    })
    // Sin el modelo (se borró desde la configuración o se está bajando), la descarga al final: sin ella no se manda (8)
    if (motorDe(m) === 'local' && (c.local === 'falta' || c.local === 'bajando')) partes.push(descargaLocal(m))
  }
  if (c.estado === 'error') partes.push(tarjetaError(c.error ?? undefined))
  // Un archivo que no entró (10): su tarjeta, aparte del turno, que solo se cierra
  if (c.errorAdjunto) partes.push(tarjetaError({ motivo: 'adjunto', detalle: c.errorAdjunto.nombre }, 'ch-descartar-adjunto'))
  return partes.join('')
}

// ------------------------------------------------------------------ composer (3.2)

/** Las partes del composer que cambian: los chips, Enviar o Frenar, la pista y el pie. */
export function composer(m) {
  const c = m.chat
  const corre = ocupado(c)
  const vacio = !c.borrador.trim() && !c.adjuntos.length
  const boton = corre
    ? '<button type="button" class="frenar" data-accion="ch-frenar" aria-label="Frenar la respuesta">Frenar</button>'
    : `<button type="button" class="enviar" data-accion="ch-enviar" aria-label="Enviar"${vacio ? ' disabled' : ''}>${ICONOS.enviar}</button>`
  const adjuntos = c.adjuntos.map(a => `<span class="chip-adj" data-ruta="${escapar(a.ruta)}"><span class="doc" aria-hidden="true">${escapar((/\.([^.]+)$/.exec(a.nombre)?.[1] ?? '').toUpperCase().slice(0, 4))}</span><span><b>${escapar(a.nombre)}</b><small>${escapar(detalleAdjunto(a))}</small></span><button type="button" class="ic" data-accion="ch-quitar" data-ruta="${escapar(a.ruta)}" aria-label="Quitar ${escapar(a.nombre)}">${ICONOS.cerrar}</button></span>`).join('')
  const pista = corre ? 'Esperá la respuesta o frená con Esc' : 'Enter envía · Shift+Enter, línea nueva'
  const pie = motorDe(m) === 'local' ? 'Local · sin internet' : `Claude Code · ${escapar(nombreCarpeta(carpetaDe(m)))}`
  return { adjuntos, boton, pista, pie }
}

/** El clip (3.4 y 10): con el motor local se apaga y dice por qué. */
export function clipAdjuntar(m) {
  return motorDe(m) === 'local'
    ? { deshabilitado: true, titulo: 'El modelo local no lee archivos' }
    : { deshabilitado: false, titulo: 'Adjuntar archivo' }
}

// ------------------------------------------------------------------ cajón del historial (4.1 y 9.1)

/** La lista del cajón: por grupo (Hoy, Ayer, Esta semana, Antes), con lo buscado. */
export function listaHistorial(m, buscar = '') {
  const charlas = listaCharlas(m.chat).filter(x => coincideBusqueda(x, buscar))
  if (!charlas.length) return `<p class="hist-vacio">${buscar.trim() ? 'Nada coincide con lo que buscás.' : 'Todavía no charlamos. Lo que hablemos queda acá.'}</p>`
  const actual = m.chat.conversacion?.id
  const grupos = new Map()
  for (const x of charlas) {
    const g = grupoDeFecha(x.actualizada, m.ahoraMs)
    if (!grupos.has(g)) grupos.set(g, [])
    grupos.get(g).push(x)
  }
  const mc = m.chat.menuCharla
  // El menú de la charla (clic derecho o la tecla Menú): "Borrar", que confirma en el mismo botón (D24, D29)
  const menu = x => (mc?.id !== x.id ? '' : `<div class="h-menu" role="menu" aria-label="${escapar(x.titulo ?? 'Charla')}"><button type="button" role="menuitem" class="h-borrar${mc.confirmar ? ' confirma' : ''}" data-accion="ch-borrar" data-id="${escapar(x.id)}" title="Borra la charla de Avis. Claude Code guarda su propia copia">${mc.confirmar ? '¿Borrar? Sí' : 'Borrar'}</button></div>`)
  const item = x => `<button type="button" class="h-it${x.id === actual ? ' on' : ''}" data-accion="ch-retomar" data-id="${escapar(x.id)}"${x.id === actual ? ' aria-current="true"' : ''}><b>${escapar(x.titulo ?? 'Charla')}</b><span><em>${escapar(x.motor === 'local' ? 'Sesiones de Avis' : nombreCarpeta(x.carpeta))}</em> · ${x.motor === 'local' ? 'local · ' : ''}${horaCharla(x.actualizada, m.ahoraMs)}</span></button>${menu(x)}`
  return [...grupos].map(([g, xs]) => `<span class="dia">${g}</span>${xs.map(item).join('')}`).join('')
}

/** El pie del cajón: dónde quedó guardado (9.1 y 9.2). Hasta que `chat_abrir` diga si hay Engram, nada. */
function guardado(m) {
  if (m.chat.engram === 'si') return '<div class="guardado"><i aria-hidden="true"></i>Guardado en esta PC · también en Engram</div>'
  if (m.chat.engram === 'no') return '<div class="guardado"><i aria-hidden="true"></i>Guardado en esta PC · Engram apagado</div>'
  return ''
}

/** El cajón "Charlas" (`role=dialog`, el foco arranca en el buscador). */
export function cajon(m, buscar = '') {
  return '<div class="velo" data-accion="ch-hist" aria-hidden="true"></div>'
    + `<div id="chat-cajon" class="cajon" role="dialog" aria-modal="true" aria-label="Charlas"><div class="tit"><b>Charlas</b><button type="button" class="ic" data-accion="ch-hist" aria-label="Cerrar el historial">${ICONOS.cerrar}</button></div>`
    + `<label class="buscar">${ICONOS.lupa}<input type="search" id="chat-buscar" placeholder="Buscar en charlas" aria-label="Buscar en charlas" value="${escapar(buscar)}"></label>`
    + `<div class="hist" id="chat-hist-lista">${listaHistorial(m, buscar)}</div>${guardado(m)}</div>`
}

// ------------------------------------------------------------------ soltar (10)

/** La capa de soltar un archivo sobre la hoja. Con el motor local, el aviso de que no lee archivos. */
export function capaSoltar(m) {
  const s = m.chat.soltando
  if (!s) return ''
  const ext = escapar((/\.([^.]+)$/.exec(s.nombre)?.[1] ?? 'archivo').toUpperCase().slice(0, 4))
  if (motorDe(m) === 'local') return `<div class="soltar" role="status"><span class="hoja-doc" aria-hidden="true">${ext}</span><b>El modelo local no lee archivos</b><span>Cambiá a Claude Code</span></div>`
  return `<div class="soltar" role="status"><span class="hoja-doc" aria-hidden="true">${ext}</span><b>Soltalo y ${escapar(nombreDe(m))} lo lee</b><span>${escapar(s.nombre)} · PDF, imágenes, texto o código</span></div>`
}
