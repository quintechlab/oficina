// La hoja de Tareas (#39, docs/diseno/tareas-ux.md 3.3, 4 y 5, opción B "Carpeta"): la fila de la
// barra, el esqueleto, el índice, el encabezado del panel, el campo de nueva tarea, las filas,
// "Hechas", los vacíos, el primer uso y los errores. Solo HTML, como configuracionVista.js: los datos
// llegan armados desde main.js y nada de acá toca el DOM. main.js redibuja por partes (`data-parte`)
// y nunca pisa un campo mientras se escribe en él.
// Entrega 2: el cuerpo de la fila abre la tarea, que entra en el lugar de la lista (4.7, `partesDetalle`).

import { escapar } from './logica.js'
import { avi, claudeDe } from './avis.js'
import { especieValida } from './especies.js'
import {
  vista, colorDe, pendientesDe, etiquetaFecha, fechaCorta, avanceHoy, cifrasLista, textoBorrarLista, textoCampoNueva,
  vacioVista, nombreVista, opcionFecha, textoSubtareas, creadaEl,
} from './tareas.js'

/** Los íconos de la hoja; Hábitos reusa los comunes (`mas`, `visto`). */
export const ICONO = {
  hoy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2.5"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none"/></svg>',
  venc: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8.5" r="5.5"/><path d="M8 5.5v3.2M8 11v.1"/></svg>',
  mas: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>',
  visto: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6-6.3"/></svg>',
  nota: '<svg class="ic-nota" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 3h8M2 6h8M2 9h5"/></svg>',
  flecha: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M3.5 2l3 3-3 3"/></svg>',
}

const color = c => `var(--${colorDe(c)})`
const pct = (h, n) => `${n ? Math.round((h / n) * 1000) / 10 : 0}%`
const mascotaDe = especie => claudeDe(especieValida(especie))

/** A la derecha de la fila "Tareas" (4.1): la pista "Ctrl T", o el chip (ámbar, o rojo con su punto). */
export function ladoFilaTareas(c) {
  const n = (c?.hoy ?? 0) + (c?.vencidas ?? 0)
  if (!n) return '<kbd aria-hidden="true">Ctrl T</kbd>'
  return c.vencidas ? `<span class="chip chip-venc" aria-hidden="true"><i></i>${n}</span>` : `<span class="chip chip-preg" aria-hidden="true">${n}</span>`
}

/** Lo que no cambia mientras la hoja está abierta: la línea de la pregunta, el cuerpo y los anuncios (5.3). */
export function esqueletoTareas() {
  return '<div id="tar-aviso"></div><div id="tar-cuerpo"></div><p class="oculto" role="status" id="tar-vivo"></p>'
}

/** La carpeta (3.3): el índice y el panel, cada uno por partes. */
export const CARPETA = '<div class="carpeta"><nav class="idx" aria-label="Vistas y listas" data-parte="idx"></nav>'
  + '<section class="pane" aria-labelledby="tar-pane-h"><div data-parte="pane-h"></div><div data-parte="err"></div>'
  + '<div data-parte="nuevo"></div><div class="tar-desplaza" data-parte="lista"></div></section></div>'

/** Con una pregunta pendiente y la hoja abierta (3.1): la línea ámbar de siempre, que cierra la hoja y la muestra. */
export function avisoPreguntaTareas(pendientes) {
  if (!pendientes) return ''
  return '<button type="button" class="aviso cfg-aviso" data-accion="tar-pregunta"><span>Claude te hace una pregunta</span><span class="ir">Ver →</span></button>'
}

/** La mascota de 40 junto al título (4.10): esperando, o feliz 1,5 s después de un tilde. */
export function miniTareas(especie, feliz) {
  return avi(mascotaDe(especie), feliz ? 'feliz' : 'esperando', 40)
}

// ------------------------------------------------------------------ índice (4.2)

/** Una cuenta del índice: el número a la vista y su texto para el lector (12). En 0, nada. */
const cuenta = (n, tono = '') => (n ? `<span class="ct${tono ? ` ${tono}` : ''}" aria-hidden="true">${n}</span><span class="oculto">, ${n} ${n === 1 ? 'pendiente' : 'pendientes'}</span>` : '')

/** Un botón del índice (4.2); `accion`: la de su hoja (Hábitos reusa el mismo botón con `hab-ver`). */
export function botonIndice({ valor, k, actual, icono, nombre, c, ct = '', clase = '', titulo = null, accion = 'tar-ver' }) {
  const cur = actual ? ' aria-current="page"' : ''
  const t = titulo ? ` title="${escapar(titulo)}"` : ''
  return `<button type="button" class="ix-b${clase}" data-accion="${accion}" data-valor="${escapar(valor)}" data-k="${escapar(k)}"${cur} style="--c:${c}"${t}>`
    + `<span class="ix-ic${icono ? '' : ' punto'}">${icono}</span><span class="n">${escapar(nombre)}</span>${ct}</button>`
}

/** El campo de una lista en el índice: crear (con "+") o renombrar (con el nombre de antes). */
function campoLista({ campo, k, valor = '', etiqueta, mas, error }) {
  return `<label class="campo ix-campo">${mas ? ICONO.mas : ''}<input data-campo="${campo}" data-k="${k}" maxlength="40" value="${escapar(valor)}" placeholder="Nombre de la lista" aria-label="${etiqueta}"><kbd>Enter</kbd></label>`
    + (error ? `<p class="ix-err" role="alert">${escapar(error)}</p>` : '')
}

/**
 * El índice (4.2): Hoy y Vencidas con sus cuentas (`cuentas` null mientras se lee: sin cuenta, 7.1),
 * el rótulo "Listas", cada lista con su punto y sus pendientes (o el campo de renombrar en su lugar),
 * los archivos rotos (7.6) y "Nueva lista" (o el campo de crear).
 */
export function indiceTareas({ ver, listas, cuentas: c, rotas = [], renombrando = null, creando = false, errorLista = null }) {
  const filas = [
    botonIndice({ valor: 'hoy', k: 'ix-hoy', actual: ver === 'hoy', icono: ICONO.hoy, nombre: 'Hoy', c: 'var(--ambar)', ct: cuenta(c?.hoy, 't-aviso') }),
    botonIndice({ valor: 'vencidas', k: 'ix-vencidas', actual: ver === 'vencidas', icono: ICONO.venc, nombre: 'Vencidas', c: 'var(--rojo)', ct: cuenta(c?.vencidas, 't-error') }),
    '<span class="rot-i" aria-hidden="true">Listas</span>',
  ]
  for (const l of listas) {
    if (l.id === renombrando) filas.push(campoLista({ campo: 'ren', k: 'ren-in', valor: l.nombre, etiqueta: 'Nuevo nombre de la lista', error: errorLista }))
    else filas.push(botonIndice({ valor: l.id, k: `ix-${l.id}`, actual: ver === l.id, icono: '', nombre: l.nombre, c: color(l.color), ct: cuenta(pendientesDe(l)), titulo: l.nombre }))
  }
  for (const r of rotas) {
    filas.push(botonIndice({ valor: `rota:${r.archivo}`, k: `ix-rota:${r.archivo}`, actual: ver === `rota:${r.archivo}`, icono: '', nombre: r.archivo, c: 'var(--rojo)', clase: ' rota', titulo: `${r.archivo}: ${r.motivo ?? ''}` }))
  }
  filas.push(creando
    ? campoLista({ campo: 'lista', k: 'lista-in', etiqueta: 'Nombre de la lista nueva', mas: true, error: errorLista })
    : `<button type="button" class="ix-b ix-mas" data-accion="tar-crear" data-k="crear"><span class="ix-ic">${ICONO.mas}</span><span class="n">Nueva lista</span></button>`)
  return filas.join('')
}

// ------------------------------------------------------------------ panel (4.3 a 4.9)

/**
 * Un botón que borra y confirma en el mismo lugar (4.8, el patrón `confirmable` de la configuración):
 * "Borrar …" (`.lnk.peligro`) y, armado, la pregunta (`.armado`) con la línea que se vacía en 3 s;
 * `transcurrido` (ms) la retoma donde iba si se redibuja. El mismo `data-k`: el foco sigue en el botón.
 */
export function confirmable(accion, valor, k, texto, pregunta, armado, transcurrido = 0) {
  if (armado) {
    return `<button type="button" class="armado" data-accion="${accion}" data-valor="${escapar(valor)}" data-k="${k}" aria-live="polite" style="--ya:-${Math.max(0, Math.round(transcurrido))}ms">${escapar(pregunta)}</button>`
  }
  return `<button type="button" class="lnk peligro" data-accion="${accion}" data-valor="${escapar(valor)}" data-k="${k}">${escapar(texto)}</button>`
}

/**
 * El encabezado del panel (4.3): el `h2` (en una lista, con su punto) y debajo, en Hoy, la fecha, el
 * avance y su barra; en Vencidas, el orden; en una lista, sus cifras, "Renombrar" y "Borrar lista".
 */
export function cabeceraPanel({ ver, listas, hoy, armado = false, transcurrido = 0 }) {
  const lista = listas.find(l => l.id === ver)
  const punto = lista ? `<i class="pt" style="--c:${color(lista.color)}" aria-hidden="true"></i>` : ''
  let s
  if (lista) {
    s = `<span>${escapar(cifrasLista(lista))}</span><span class="acc">`
      + `<button type="button" class="lnk" data-accion="tar-renombrar" data-valor="${escapar(lista.id)}" data-k="renombrar">Renombrar</button>`
      + confirmable('tar-borrar-lista', lista.id, 'borrar-lista', 'Borrar lista', textoBorrarLista(lista.tareas.length), armado, transcurrido)
      + '</span>'
  } else if (ver === 'hoy') {
    const { hechas, total } = avanceHoy(listas, hoy)
    s = `<span>${fechaCorta(hoy)} · ${hechas} de ${total}</span>`
      + `<span class="prog" role="progressbar" aria-label="Hechas hoy" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${hechas}"><i style="--p:${pct(hechas, total)}"></i></span>`
  } else if (ver === 'vencidas') {
    s = '<span>la más vieja primero</span>'
  } else {
    s = ''
  }
  return `<header class="pane-h"><h2 id="tar-pane-h">${punto}${escapar(nombreVista(listas, ver))}</h2><div class="pane-s">${s}</div></header>`
}

/** El campo de nueva tarea (4.4): Enter agrega; en Vencidas, la pista en su lugar (5.1). */
export function campoNueva(ver, listas) {
  if (ver === 'vencidas') return '<p class="pista">Las vencidas salen de sus listas: tildalas o cambiales la fecha.</p>'
  const texto = textoCampoNueva(ver, listas)
  if (!texto) return ''
  return `<label class="campo nueva">${ICONO.mas}<input data-campo="nueva" data-k="nueva" maxlength="200" placeholder="${escapar(texto)}" aria-label="${escapar(texto.replace(/…$/, ''))}"><kbd>Enter</kbd></label>`
}

/**
 * Una fila (4.5). `conLista`: en Hoy y Vencidas, el nombre de su lista con su punto. Tildada, sin
 * fecha. El tilde es un checkbox con "Hecha: {título}"; el texto de la fecha y de lo que el color o
 * el ícono dicen solos va oculto para el lector (6.2).
 */
export function filaTarea({ lista, tarea }, { conLista = false, hoy, recien = null } = {}) {
  const f = tarea.hecha ? null : etiquetaFecha(tarea.fecha, hoy)
  const subs = tarea.subtareas ?? []
  const h = subs.filter(s => s.hecha).length
  const meta = [
    f ? `<span class="tag t-${f.tono}"><span class="oculto">, ${escapar(f.largo)}</span><span aria-hidden="true">${escapar(f.corto)}</span></span>` : '',
    conLista ? `<span class="de-l" style="--c:${color(lista.color)}"><i class="pt" aria-hidden="true"></i>${escapar(lista.nombre)}</span>` : '',
    subs.length ? `<span class="subc" style="--p:${pct(h, subs.length)}"><i aria-hidden="true"></i><span aria-hidden="true">${h}/${subs.length}</span><span class="oculto">, ${h} de ${subs.length} subtareas hechas</span></span>` : '',
    tarea.notas ? `${ICONO.nota}<span class="oculto">, con notas</span>` : '',
  ].join('')
  const clases = ['fila', tarea.hecha ? 'hecha' : '', tarea.importante ? 'imp' : '', recien === tarea.id ? 'recien' : ''].filter(Boolean).join(' ')
  const id = escapar(tarea.id)
  return `<li class="${clases}" data-id="${id}" style="--c:${color(lista.color)}">`
    + `<button type="button" class="ck" role="checkbox" aria-checked="${!!tarea.hecha}" aria-label="Hecha: ${escapar(tarea.titulo)}" data-accion="tar-tildar" data-lista="${escapar(lista.id)}" data-valor="${id}" data-k="ck-${id}">${ICONO.visto}</button>`
    + `<button type="button" class="f-cuerpo" data-accion="tar-abrir-tarea" data-valor="${id}" data-k="ab-${id}"><span class="tit">${escapar(tarea.titulo)}</span>${tarea.importante ? '<span class="oculto">, importante</span>' : ''}${meta ? `<span class="meta">${meta}</span>` : ''}</button>`
    + `${tarea.importante ? '<span class="imp-b" aria-hidden="true">!</span>' : '<span></span>'}</li>`
}

/**
 * Lo de abajo del campo (3.3): las filas pendientes (o el vacío de 5.2), y "Hechas · n" plegado (4.9),
 * salvo en Vencidas. `fantasmas`: tres filas vacías mientras se lee (7.1).
 */
export function cuerpoLista({ ver, listas, hoy, hechas = false, recien = null, fantasmas = false, mascota = 'avi' }) {
  if (fantasmas) return '<ul class="filas fantasmas" aria-hidden="true"><li></li><li></li><li></li></ul>'
  const v = vista(listas, ver, hoy)
  if (!v) return ''
  const conLista = ver === 'hoy' || ver === 'vencidas'
  const opts = { conLista, hoy, recien }
  let html
  if (v.pendientes.length) html = `<ul class="filas">${v.pendientes.map(x => filaTarea(x, opts)).join('')}</ul>`
  else {
    const vac = vacioVista(ver, listas, hoy)
    html = `<div class="vac">${avi(mascotaDe(mascota), vac.pose, 66)}<b>${escapar(vac.titulo)}</b><p>${escapar(vac.linea)}</p></div>`
  }
  if (v.hechas.length) {
    html += `<button type="button" class="pleg" aria-expanded="${hechas}" aria-controls="tar-hechas" data-accion="tar-hechas" data-k="pleg">${ICONO.flecha}Hechas · ${v.hechas.length}</button>`
    if (hechas) html += `<ul class="filas hechas-l" id="tar-hechas">${v.hechas.map(x => filaTarea(x, opts)).join('')}</ul>`
  }
  return html
}

/** Primer uso, sin listas (7.2): la mascota saluda, tres sugeridas y "Otro nombre…". */
export function primerUso(especie, errorLista = null) {
  const sug = ['Trabajo', 'Casa', 'Compras'].map(n => `<button type="button" class="fc" data-accion="tar-sugerida" data-valor="${n}" data-k="sug-${n}">+ ${n}</button>`).join('')
  return `<div class="primer">${avi(mascotaDe(especie), 'saluda', 96)}<b>Armá tu primera lista</b><p>Las tareas quedan en esta PC. Cuando tengas algo para hoy, te aviso al prender.</p>`
    + `<div class="sug" role="group" aria-label="Sugeridas">${sug}</div>`
    + `<label class="campo">${ICONO.mas}<input data-campo="lista" data-k="primer-in" maxlength="40" placeholder="Otro nombre…" aria-label="Nombre de la lista nueva"><kbd>Enter</kbd></label>`
    + (errorLista ? `<p class="ix-err" role="alert">${escapar(errorLista)}</p>` : '')
    + '</div>'
}

// ------------------------------------------------------------------ la tarea abierta (4.7, entrega 2)

/** «‹ {vista}» (4.7): vuelve a la lista; ocupa el lugar del encabezado del panel. */
export function atrasTarea(nombre) {
  return `<button type="button" class="lnk atras" data-accion="tar-cerrar-tarea" data-k="atras">‹ ${escapar(nombre)}</button>`
}

/**
 * Lo fijo de la tarea abierta (3.3): el `h2` oculto con el título (main.js lo sigue mientras se escribe)
 * y el detalle por partes, cada una redibujada solo si cambió (título y notas nunca se pisan).
 */
export function esqueletoDetalle(titulo) {
  return `<h2 class="oculto" id="tar-pane-h">${escapar(titulo)}</h2><div class="det">`
    + '<div class="det-tit" data-parte="det-tit"></div><div class="det-g" data-parte="det-g"></div>'
    + '<div class="det-subs" data-parte="det-sub"></div><div class="det-notas" data-parte="det-notas"></div>'
    + '<div class="det-pie" data-parte="det-pie"></div></div>'
}

/**
 * Segmentos (`radiogroup` con foco itinerante, como los de la configuración): la elegida es la única
 * en el orden de tabulación; sin ninguna elegida (otra fecha), la primera.
 */
function segmentos(accion, opciones, actual, etiqueta, clase) {
  const alguna = opciones.some(([v]) => v === actual)
  const botones = opciones.map(([v, t], i) => {
    const sel = v === actual
    return `<button type="button" role="radio" aria-checked="${sel}" tabindex="${sel || (!alguna && i === 0) ? 0 : -1}" data-accion="${accion}" data-valor="${v}" data-k="${accion.slice(4)}-${v}">${t}</button>`
  }).join('')
  return `<div class="seg ${clase}" role="radiogroup" aria-label="${etiqueta}">${botones}</div>`
}

/**
 * Las partes de la tarea abierta (4.7): `tit` (el tilde «Hecha» y el título editable), `datos` (Vence,
 * Prioridad y Lista), `subs` (las subtareas: la que se edita es un campo, `editandoSub`), `notas` y
 * `pie` («Creada el {d/m}» y «Borrar tarea», que confirma en el mismo botón: `armado`, `transcurrido`).
 * Los campos llevan `data-campo` (main.js no los pisa al redibujar); la fecha y la lista, `data-cambio`.
 */
export function partesDetalle({ lista, tarea, listas, hoy, editandoSub = null, armado = false, transcurrido = 0 }) {
  const id = escapar(tarea.id)
  const f = etiquetaFecha(tarea.fecha, hoy)
  const tit = `<button type="button" class="ck" role="checkbox" aria-checked="${!!tarea.hecha}" aria-label="Hecha" data-accion="tar-tildar-det" data-valor="${id}" data-k="ckd-${id}">${ICONO.visto}</button>`
    + `<textarea class="tit-in${tarea.hecha ? ' hecha' : ''}" rows="1" maxlength="200" aria-label="Título de la tarea" data-campo="titulo" data-k="tit-${id}">${escapar(tarea.titulo)}</textarea>`
  const opcionesLista = [...listas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(l => `<option value="${escapar(l.id)}"${l.id === lista.id ? ' selected' : ''}>${escapar(l.nombre)}</option>`).join('')
  const datos = '<span class="det-l">Vence</span><div class="det-f">'
    + segmentos('tar-fecha', [['hoy', 'Hoy'], ['manana', 'Mañana'], ['sin', 'Sin fecha']], opcionFecha(tarea.fecha, hoy), 'Vence', 'ch')
    + `<input type="date" class="fecha-in" value="${escapar(tarea.fecha ?? '')}" aria-label="Elegir otra fecha" data-cambio="tar-fecha-in" data-k="fecha-in">`
    + (f ? `<span class="vence t-${f.tono}">${escapar(f.largo)}</span>` : '')
    + '</div><span class="det-l">Prioridad</span><div class="det-f">'
    + segmentos('tar-prio', [['normal', 'Normal'], ['imp', '! Importante']], tarea.importante ? 'imp' : 'normal', 'Prioridad', 'prio')
    + `</div><span class="det-l">Lista</span><div class="det-f"><select class="sel" aria-label="Lista" data-cambio="tar-lista" data-k="lista-sel">${opcionesLista}</select></div>`
  const items = (tarea.subtareas ?? []).map(s => {
    const sid = escapar(s.id)
    const texto = s.id === editandoSub
      ? `<input class="sub-in" data-campo="sub-ed" data-valor="${sid}" data-k="sub-ed-${sid}" maxlength="200" value="${escapar(s.titulo)}" aria-label="Texto de la subtarea (vacío, se borra)">`
      : `<button type="button" class="sub-t" data-accion="tar-editar-sub" data-valor="${sid}" data-k="st-${sid}" aria-label="Editar «${escapar(s.titulo)}»">${escapar(s.titulo)}</button>`
    return `<li${s.hecha ? ' class="hecha"' : ''} data-id="${sid}"><button type="button" class="ck chico" role="checkbox" aria-checked="${!!s.hecha}" aria-label="Subtarea hecha: ${escapar(s.titulo)}" data-accion="tar-tildar-sub" data-valor="${sid}" data-k="cks-${sid}">${ICONO.visto}</button>${texto}</li>`
  }).join('')
  const subs = `<h3 class="sub">${escapar(textoSubtareas(tarea.subtareas))}</h3>${items ? `<ul class="subs">${items}</ul>` : ''}`
    + `<label class="campo chico">${ICONO.mas}<input data-campo="subtarea" data-k="sub-in" maxlength="200" placeholder="Agregar una subtarea" aria-label="Agregar una subtarea"><kbd>Enter</kbd></label>`
  const notas = `<h3 class="sub">Notas</h3><textarea class="notas" rows="3" maxlength="4000" placeholder="Algo para acordarte…" aria-label="Notas" data-campo="notas" data-k="notas">${escapar(tarea.notas ?? '')}</textarea>`
  const pie = `<span class="cifras">${escapar(creadaEl(tarea.creada ?? 0))}</span>`
    + confirmable('tar-borrar-tarea', tarea.id, 'borrar-tarea', 'Borrar tarea', '¿Borrar? Sí', armado, transcurrido)
  return { tit, datos, subs, notas, pie }
}

// ------------------------------------------------------------------ errores (7.4 y 7.6)

/** La tarjeta de error de 7.4 y 7.6 (también la de Hábitos): el título, la línea y sus botones. */
export const err = (titulo, linea, botones) => `<div class="err" role="alert"><i class="pt t-error" aria-hidden="true"></i><div><b>${titulo}</b>${linea}</div><div class="acc">${botones}</div></div>`
export const boton = (accion, k, texto) => `<button type="button" class="lnk" data-accion="${accion}" data-k="${k}">${texto}</button>`

/** No se guardó el último cambio (7.4): lo de la pantalla queda y reintenta solo. */
export function errorGuardar() {
  return err('No se guardó el último cambio.', 'Sigue en pantalla. Reintento solo en 5 s.', boton('tar-reintentar', 'reintentar', 'Reintentar ahora'))
}

/** Un archivo que no se pudo leer (7.6): nunca se toca. */
export function errorRota(archivo) {
  return err('Una lista no se pudo leer.', `El archivo quedó como estaba (${escapar(archivo)}). Las demás listas andan.`,
    boton('tar-carpeta', 'carpeta', 'Abrir la carpeta') + boton('tar-releer', 'releer', 'Volver a leer'))
}

/** La carpeta no se pudo abrir (5.2). */
export function errorCarpeta(detalle) {
  return err('No se pudo abrir la carpeta de tareas.', escapar(detalle ?? ''), boton('tar-releer', 'releer', 'Volver a leer'))
}

// ------------------------------------------------------------------ el aviso diario (8 y 5.4)

const X = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>'
const MAS_TARDE = 'aria-label="Más tarde: avisame mañana" title="Más tarde"'

/** Los tramos de `textoGlobo` en HTML: lo fuerte en `<b>`, las vencidas con la clase `r` (en rojo). */
const tramos = segs => segs.map(s => (s.fuerte || s.venc ? `<b${s.venc ? ' class="r"' : ''}>${escapar(s.t)}</b>` : escapar(s.t))).join('')

/**
 * El globo de la marca (8.3; `.globo-tar`, porque `.globo` ya es el del SVG del Avi): hermano del
 * botón "Charlar con Avi", con dos botones: todo el texto y "Ver tareas →" (abre la hoja en Hoy) y
 * la × (lo deja para mañana). `t`: lo de `textoGlobo`.
 */
export function globoMarca(t) {
  return `<div class="globo-tar" data-globo-tar><button type="button" class="globo-b" data-accion="tar-globo"><span class="globo-t">${tramos(t.globo)}</span>`
    + `<span class="globo-c">Ver tareas →</span></button><button type="button" class="globo-x" data-accion="tar-globo-x" ${MAS_TARDE}>${X}</button></div>`
}

/**
 * Lo de adentro de `#muesca-tareas` (8.5), un botón hermano de `#muesca`: "{h} para hoy · {v} vencidas"
 * y "Ver →"; `nombre`, el del botón (el texto entero del globo, que la muesca abrevia).
 */
export function globoMuesca(t) {
  return { html: `<span class="mt-t">${tramos(t.muesca)}</span><span class="mt-c">Ver <span aria-hidden="true">→</span></span>`, nombre: `${t.texto} Ver tareas` }
}

/** La fila de aviso de la pantalla dividida (8.4, D-n7): la píldora de `avisoOtroProyecto` con "Ver →" y la ×. */
export function filaAviso(t) {
  return `<div class="aviso aviso-tar" data-globo-tar><span class="at-t">${tramos(t.fila)}</span>`
    + `<button type="button" class="lnk" data-accion="tar-globo">Ver →</button><button type="button" class="tb" data-accion="tar-globo-x" ${MAS_TARDE}>${X}</button></div>`
}
