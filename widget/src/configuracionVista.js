// La hoja de la configuración (#23, docs/diseno/configuracion-ux.md 4.3 y 5): el esqueleto, las
// pestañas, la línea de la pregunta pendiente y el contenido de cada pestaña. Solo HTML, como
// primerosPasosVista.js: los datos llegan armados desde main.js y nada de acá toca el DOM.
// Entrega 1: la pestaña Panel. Entrega 2: Mascota (el escenario con la vista previa y las fichas) y el
// Avi de 40 junto al título. Entrega 3: Instalación y el modelo local. Entrega 4: las claves de API.
// Entrega 5: "Quién responde" en Modelos y el historial del chat en Datos.

import { escapar } from './logica.js'
import { PESTANAS, UBICACIONES, limitesTamano, CLAVE_VISTA_PREVIA, opcionesForma, rotuloEspecie, PROVEEDORES, textoClave, MOTORES, textoHistorial } from './configuracion.js'
import { NOMBRES_ESPECIES, datosEspecie, especieValida } from './especies.js'
import { avi, claudeDe } from './avis.js'

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

/**
 * Lo de adentro de una pestaña: su nombre y, con estado (6.3), un punto de 6 con su texto oculto
 * (el color nunca solo). `punto`: `{ tono, texto }` de `puntoPestana`, o null.
 */
export function nombrePestana(id, punto) {
  const nombre = PESTANAS.find(p => p.id === id)?.nombre ?? ''
  if (!punto) return nombre
  return `${nombre}<i class="pt t-${escapar(punto.tono)}" aria-hidden="true"></i><span class="oculto">${escapar(punto.texto)}</span>`
}

/** Las cinco pestañas (`tablist`, activación automática): una sola en el orden de tabulación. */
export function pestanasConfiguracion(tab, puntos = {}) {
  const tabs = PESTANAS.map(({ id }) => {
    const sel = id === tab
    return `<button type="button" class="pes" role="tab" id="cfg-t-${id}" aria-selected="${sel}" aria-controls="cfg-p" tabindex="${sel ? 0 : -1}" data-accion="cfg-tab" data-valor="${id}" data-k="tab-${id}">${nombrePestana(id, puntos[id])}</button>`
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

/**
 * El contenido de una pestaña, con su `h2` oculto al principio: el `aria-labelledby` del panel no crea
 * un encabezado, y sin él se saltaba del `h1` a los `h3` (16, D-f).
 */
export function seccionConfiguracion(tab, datos) {
  const p = PESTANAS.find(x => x.id === tab)
  if (!p) return ''
  const cuerpo = tab === 'panel' ? seccionPanel(datos)
    : tab === 'mascota' ? seccionMascota(datos)
      : tab === 'modelos' ? seccionModelos(datos)
        : tab === 'instalacion' ? seccionInstalacion(datos)
          : seccionDatos(datos)
  return `<h2 class="oculto">${p.nombre}</h2>${cuerpo}`
}

/** Dónde queda cada cosa (4.4 y 5), de solo lectura. */
export const UBICACIONES_DATOS = [
  ['Preferencias', 'preferencias.json, en la carpeta de Avis'],
  ['Claves', 'Administrador de credenciales de Windows · Avis/api/…'],
  ['Modelo local', '%LOCALAPPDATA%\\avis-ia'],
  ['Charlas', 'carpeta de Avis\\chat'],
]

/**
 * La tarjeta "Historial del chat" (7.4). `h`: lo de `textoHistorial`. "Borrar todo" confirma en el
 * mismo botón (D5); con error, el texto en rojo y "Reintentar".
 */
function tarjetaHistorial(h, { armado = false, transcurrido = 0 } = {}) {
  const a = h.accion
  const boton = !a ? ''
    : a.id === 'borrar' ? confirmable('cfg-hist', 'borrar', 'hist-borrar', a.texto, a.armado, armado, transcurrido)
      : `<button type="button" class="btn" data-accion="cfg-hist" data-valor="${a.id}" data-k="hist-${a.id}">${escapar(a.texto)}</button>`
  return `<div class="tarj"><div class="tarj-t"><b>${escapar(h.titulo)}</b>${h.pill ? pill(h.tono, h.pill) : ''}</div>`
    + (h.linea ? `<p>${escapar(h.linea)}</p>` : '')
    + (boton ? `<div class="acc">${boton}</div>` : '')
    + (h.error ? `<p class="aj-error" role="alert">${escapar(h.error)}</p>` : '')
    + '</div>'
}

/** Pestaña Datos (4.4): el historial del chat y dónde queda cada cosa. `datos`: { historial, armado, transcurrido }. */
function seccionDatos(datos = {}) {
  const filas = UBICACIONES_DATOS.map(([t, d]) => `<dt>${escapar(t)}</dt><dd>${escapar(d)}</dd>`).join('')
  const h = datos.historial ?? textoHistorial()
  return `<h3 class="sub">Historial del chat</h3>${tarjetaHistorial(h, { armado: datos.armado === 'historial', transcurrido: datos.transcurrido })}`
    + `<h3 class="sub">Dónde queda cada cosa</h3><dl class="datos">${filas}</dl>`
}

// ------------------------------------------------------------------ piezas (6.1)

// role=alert: el interruptor vuelve solo, y sin el anuncio el lector no sabe por qué (16, M3)
const errorDe = (datos, clave) => (datos.error === clave ? `<p class="aj-error" role="alert">${TEXTO_ERROR_GUARDAR}</p>` : '')

/**
 * Una fila: título, descripción y el control a la derecha (`apilada`: abajo, a todo el ancho). `para`:
 * el id del control; el título pasa a ser su `label` (clic en el título = clic en el control) y la
 * descripción lleva `<para>-d`, para su `aria-describedby` (16, D-b).
 */
function fila(titulo, descripcion, control, { apilada = false, error = '', para = null } = {}) {
  const t = para ? `<label class="aj-t" for="${para}">${titulo}</label>` : `<span class="aj-t">${titulo}</span>`
  const d = `<span class="aj-d"${para ? ` id="${para}-d"` : ''}>${descripcion}</span>`
  return `<div class="aj${apilada ? ' apilada' : ''}"><div>${t}${d}</div>`
    + `<div class="aj-ctl">${control}</div>${error}</div>`
}

/** El id del interruptor de un ajuste. */
const idInterruptor = clave => `cfg-sw-${clave}`

/** Interruptor (`role=switch`): "Sí"/"No" a la izquierda solo a la vista; el estado lo da `aria-checked`. */
function interruptor(clave, etiqueta, valor) {
  const id = idInterruptor(clave)
  return `<span class="sw-e" aria-hidden="true">${valor ? 'Sí' : 'No'}</span>`
    + `<button type="button" class="sw" id="${id}" role="switch" aria-checked="${!!valor}" aria-label="${etiqueta}" aria-describedby="${id}-d" data-accion="cfg-sw" data-valor="${clave}" data-k="sw-${clave}"><i></i></button>`
}

/** Fila con interruptor: el título es su label y la descripción, su descripción. */
function filaInterruptor(clave, titulo, descripcion, valor, datos) {
  return fila(titulo, descripcion, interruptor(clave, titulo, valor), { error: errorDe(datos, clave), para: idInterruptor(clave) })
}

/** El texto de un segmento: la "✦" de la forma evolucionada se ve, pero no se lee (16, D-c). */
const textoSegmento = t => escapar(t).replace(/ ✦$/, ' <span aria-hidden="true">✦</span>')

/** Segmentos (`radiogroup` con foco itinerante): la opción elegida es la única en el orden de tabulación. */
function segmentos(accion, opciones, actual, etiqueta, clase = '') {
  const botones = opciones.map(([v, t]) => {
    const sel = v === actual
    return `<button type="button" role="radio" aria-checked="${sel}" tabindex="${sel ? 0 : -1}" data-accion="${accion}" data-valor="${v}" data-k="${accion}-${v}">${textoSegmento(t)}</button>`
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
    + filaInterruptor('arriba', 'Siempre arriba', 'Queda encima de las otras ventanas.', datos.arriba, datos)
    + filaInterruptor('avisar', 'Avisarme con cada pregunta', 'Una notificación de Windows cuando Claude te pregunta algo.', datos.avisar, datos)
    + filaInterruptor('pausa', 'Pausar animaciones', 'Las mascotas quedan quietas en su pose.', datos.pausa, datos)
    + filaInterruptor('arranque', 'Arrancar con Windows', 'Apagado de fábrica: solo lo cambia tu clic.', datos.arranque, datos)
}

// ------------------------------------------------------------------ Mascota (4.4, 5 y 6.1)

/**
 * La pestaña Mascota por partes, para que main.js cambie solo la que cambió (4.6): `fig` (el Avi de
 * 120 del escenario, con su clave de evolución: depende solo de la especie, así cambiar la forma no
 * corta el acto), `texto` (rótulo, nombre, concepto, "Base · {evo}" y la nota), `fichas` (las siete
 * y la celda 8) y `error`. `datos`: { mascota, forma, error }.
 */
export function partesMascota(datos) {
  const especie = especieValida(datos.mascota)
  const d = datosEspecie(especie)
  return {
    fig: avi(claudeDe(especie), 'esperando', 120, { claveEvo: CLAVE_VISTA_PREVIA }),
    texto: `<span class="kick">${escapar(rotuloEspecie(especie))}</span><h3 class="esc-n">${escapar(d.nombre)}</h3>`
      + `<p class="esc-c">${escapar(d.concepto)}</p>`
      + segmentos('cfg-forma', opcionesForma(especie), datos.forma === 'evo' ? 'evo' : 'base', 'Vista previa de la forma')
      + '<span class="esc-q">Evoluciona sola mientras Claude coordina un equipo</span>',
    fichas: NOMBRES_ESPECIES.map((e, i) => fichaEspecie(e, e === especie, i)).join('')
      + '<p class="esp-nota">Se ve en la marca, la muesca y cada sesión. Sus subagentes son de su especie.</p>',
    error: errorDe(datos, 'mascota'),
  }
}

/** Una ficha de especie (`radio`): el Avi de 54 en la base, nombre y forma; la elegida con ✓. */
function fichaEspecie(especie, elegida, indice) {
  const { nombre, evoNombre, c } = datosEspecie(especie)
  return `<button type="button" class="esp" role="radio" aria-checked="${elegida}" tabindex="${elegida ? 0 : -1}" data-accion="cfg-esp" data-valor="${especie}" data-k="esp-${especie}"`
    + ` style="--c:${c}" aria-label="${escapar(`${nombre}, evoluciona a ${evoNombre}`)}" title="${escapar(`${nombre} › ${evoNombre}`)}">`
    + `${avi(claudeDe(especie), 'esperando', 54, { indice })}<span class="esp-n">${escapar(nombre)}</span><span class="esp-e">› ${escapar(evoNombre)}</span>`
    + `${elegida ? '<i class="esp-ok" aria-hidden="true">✓</i>' : ''}</button>`
}

/**
 * Pestaña Mascota (4.4): el escenario (la luz es `--cc`, que main.js pone en #cfg para que cambie con
 * transición) y las fichas en un `radiogroup`; el error de guardar, debajo de las fichas.
 */
export function seccionMascota(datos) {
  const p = partesMascota(datos)
  return `<div class="esc-m"><div class="esc-fig" data-parte="fig">${p.fig}</div><div class="esc-t" data-parte="texto">${p.texto}</div></div>`
    + `<div class="especies" role="radiogroup" aria-label="Mascota de Claude" data-parte="fichas">${p.fichas}</div>`
    + `<div class="esp-error" data-parte="error">${p.error}</div>`
}

// ------------------------------------------------------------------ Modelos e Instalación (entrega 3: 7.2 y 7.3)

/** El texto debajo de la tarjeta del modelo local cuando no se pudo borrar (sección 14). */
export const TEXTO_ERROR_BORRAR = 'No se pudo borrar. Probá de nuevo.'

/** Píldora de estado (6.1): el punto con el color del tono y siempre su texto. */
function pill(tono, texto, extra = '') {
  return `<span class="pill t-${escapar(tono)}"${extra}><i class="pt" aria-hidden="true"></i><span>${escapar(texto)}</span></span>`
}

/**
 * Un botón que borra y confirma en el mismo lugar (D5): "Borrar …" (`.lnk.peligro`) y, armado,
 * "¿Borrar …? Sí" (`.armado`) con la línea que se vacía en 3 s; `transcurrido` (ms) la retoma donde
 * iba si la sección se redibuja. El mismo `data-k` en los dos estados: el foco sigue en el botón.
 */
function confirmable(accion, valor, k, texto, pregunta, armado, transcurrido = 0) {
  if (armado) {
    return `<button type="button" class="armado" data-accion="${accion}" data-valor="${valor}" data-k="${k}" aria-live="polite" style="--ya:-${Math.max(0, Math.round(transcurrido))}ms">${escapar(pregunta)}</button>`
  }
  return `<button type="button" class="lnk peligro" data-accion="${accion}" data-valor="${valor}" data-k="${k}">${escapar(texto)}</button>`
}

/**
 * La tarjeta del modelo local (7.2). `m`: lo de `textoModelo`. Bajando, la barra (`role=progressbar`)
 * y las cifras llevan `data-cfg-…` para que main.js las cambie en su lugar con cada progreso.
 */
function tarjetaLocal(m, { armado = false, transcurrido = 0, error = false } = {}) {
  const bajando = m.estado === 'bajando'
  const acciones = m.acciones.map(a => (a.id === 'borrar'
    ? confirmable('cfg-local', 'borrar', 'local-borrar', a.texto, a.armado, armado, transcurrido)
    : `<button type="button" class="btn" data-accion="cfg-local" data-valor="${a.id}" data-k="local-${a.id}">${escapar(a.texto)}</button>`)).join('')
  const barra = bajando
    ? `<div class="barra" role="progressbar" aria-label="Descarga del modelo local" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${m.porcentaje}" style="--p:${m.fraccion}" data-cfg-barra><i></i></div>`
      + `<span class="cifras" data-cfg-cifras>${escapar(m.linea)}</span>`
    : (m.linea ? `<p>${escapar(m.linea)}</p>` : '')
  return `<div class="tarj"><div class="tarj-t"><div><b>Qwen3-4B</b> <span class="tarj-de">en esta PC, sin internet</span></div>${pill(m.tono, m.pill, bajando ? ' data-cfg-pill' : '')}</div>`
    + barra
    + (acciones ? `<div class="acc">${acciones}</div>` : '')
    + (error ? `<p class="aj-error" role="alert">${TEXTO_ERROR_BORRAR}</p>` : '')
    + '</div>'
}

/** El candado de "Claves de API" (6.1 `.cand`), decorativo. */
const CANDADO = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2M8 10v1.4"/></svg>'

/** La máscara de una clave guardada (7.1): los puntos y el final a la vista; "termina en …" para el lector. */
function mascaraClave(m) {
  return m ? ` <span class="mask"><span aria-hidden="true">${escapar(m.texto)}</span><span class="oculto">${escapar(m.oculto)}</span></span>` : ''
}

/**
 * El campo de la clave que se escribe (7.1): contraseña sin valor (el texto vive solo en el `<input>`,
 * 4.6), con su label oculto, la ayuda descrita por `aria-describedby`, "Mostrar"/"Ocultar", Guardar y
 * Cancelar. Un solo campo abierto por vez: el id es fijo.
 */
function campoClave(p, t) {
  const { ayuda, ver } = t
  const [guardar, cancelar] = t.acciones
  return '<div class="cl-form">'
    + `<label class="oculto" for="cfg-clave-in">Clave de API de ${escapar(p.nombre)}</label>`
    + `<div class="campo${ayuda.invalida ? ' mal' : ''}"><input id="cfg-clave-in" type="${ver ? 'text' : 'password'}" autocomplete="off" spellcheck="false" autocapitalize="off"`
    + ` placeholder="${escapar(p.prefijo)}…" data-k="clave-in" data-valor="${p.id}" aria-invalid="${ayuda.invalida}" aria-describedby="cfg-clave-ayuda">`
    + `<button type="button" class="lnk" data-accion="cfg-clave-ver" data-valor="${p.id}" aria-pressed="${!!ver}" data-k="clave-ver">${ver ? 'Ocultar' : 'Mostrar'}</button></div>`
    + `<p class="cl-ayuda${ayuda.tono ? ` ${ayuda.tono}` : ''}" id="cfg-clave-ayuda">${escapar(ayuda.texto)}</p>`
    + `<div class="acc"><button type="button" class="btn" data-accion="cfg-clave-guardar" data-valor="${p.id}" data-k="clave-guardar">${escapar(guardar.texto)}</button>`
    + `<button type="button" class="btn sec" data-accion="cfg-clave-cancelar" data-valor="${p.id}" data-k="clave-cancelar">${escapar(cancelar.texto)}</button></div>`
    + '</div>'
}

/** Una acción de la fila (7.1) como `.lnk`; "Borrar" confirma en el mismo botón (D5). */
function accionClave(p, a, transcurrido) {
  if (a.id === 'borrar') return confirmable('cfg-clave-borrar', p.id, `b-${p.id}`, a.texto, a.pregunta, a.armado, transcurrido)
  const accion = a.id === 'probar' ? 'cfg-clave-probar' : 'cfg-clave-agregar'
  const k = a.id === 'probar' ? `p-${p.id}` : `r-${p.id}`
  const apagado = a.deshabilitado ? ' aria-disabled="true" title="Probando…"' : ''
  return `<button type="button" class="lnk" data-accion="${accion}" data-valor="${p.id}" data-k="${k}"${apagado}>${escapar(a.texto)}</button>`
}

/**
 * La fila de una clave (7.1): la inicial (sin logos, D11), el nombre y lo de la derecha, el estado
 * con la máscara y las acciones; editando, el campo. `t`: lo de `textoClave`. `recien`: se baña de
 * verde una vez al guardar; `errorBorrar`: "No se pudo borrar" debajo.
 */
export function filaClave(p, t, { recien = false, errorBorrar = false, transcurrido = 0 } = {}) {
  // Cada fila es un grupo con el nombre del proveedor: "Probar", "Reemplazar" y "Borrar" se repiten (16, M1)
  const nombre = `cfg-cl-${escapar(p.id)}`
  const grupo = ` role="group" aria-labelledby="${nombre}"`
  const cab = `<div class="cl-t"><b id="${nombre}">${escapar(p.nombre)}</b><span class="cl-de">${escapar(p.de)}</span></div>`
  const prov = `<span class="prov" aria-hidden="true">${escapar(p.inicial)}</span>`
  if (t.estado === 'editando') return `<div class="cl"${grupo}>${prov}${cab}${campoClave(p, t)}</div>`
  const enPildora = t.estado === 'revisando' || t.estado === 'probando'
  const linea = enPildora ? pill(t.tono, t.linea) : escapar(t.linea)
  const tono = ['ok', 'mal', 'aviso'].includes(t.tono) ? ` ${t.tono}` : ''
  const est = `<span class="est${tono}"${t.titulo ? ` title="${escapar(t.titulo)}"` : ''}>${linea}${mascaraClave(t.mascara)}</span>`
  const acciones = t.acciones.map(a => accionClave(p, a, transcurrido)).join('')
  return `<div class="cl${recien ? ' recien' : ''}"${grupo}>${prov}<div>${cab}${est}</div>`
    + (acciones ? `<div class="acc">${acciones}</div>` : '')
    + (errorBorrar ? `<p class="aj-error" role="alert">${TEXTO_ERROR_BORRAR}</p>` : '')
    + '</div>'
}

/**
 * La pestaña Modelos por partes (4.6), para que main.js cambie solo la que cambió: una por clave
 * (`clave-<proveedor>`: así el campo que se escribe no se toca cuando cambia otra cosa) y `local`.
 * `datos`: { claves: { <proveedor>: textoClave }, recien, modelo, armado, transcurrido, error }.
 */
export function partesModelos(datos) {
  const partes = {}
  // "Quién responde" (4.4, D10): el motor de las charlas nuevas; sin guardar, Claude Code
  const motor = datos.motor === 'local' ? 'local' : 'claude'
  partes.charla = fila('Quién responde', 'En las charlas nuevas. Cada una puede cambiarlo.', segmentos('cfg-motor', MOTORES, motor, 'Quién responde'), { error: errorDe(datos, 'motor') })
  for (const p of PROVEEDORES) {
    const t = datos.claves?.[p.id] ?? textoClave(p.id, {})
    partes[`clave-${p.id}`] = filaClave(p, t, { recien: datos.recien === p.id, errorBorrar: datos.error === `clave:${p.id}`, transcurrido: datos.transcurrido })
  }
  partes.local = tarjetaLocal(datos.modelo, { armado: datos.armado === 'local', transcurrido: datos.transcurrido, error: datos.error === 'modelo' })
  return partes
}

/**
 * Pestaña Modelos (4.4): "Quién responde" (entrega 5), las claves de API (entrega 4) y el modelo
 * local. Las claves llevan la línea que dice que las usará la charla por API.
 */
export function seccionModelos(datos) {
  const p = partesModelos(datos)
  return `<h3 class="sub">Charla</h3><div data-parte="charla">${p.charla}</div>`
    + '<h3 class="sub">Claves de API</h3>'
    + `<p class="cand">${CANDADO}<span>Se guardan en el Administrador de credenciales de Windows, nunca en un archivo. Avis solo vuelve a mostrar los últimos 4 caracteres.</span></p>`
    + PROVEEDORES.map(x => `<div data-parte="clave-${x.id}">${p[`clave-${x.id}`]}</div>`).join('')
    + '<p class="cl-nota">Las usa la charla por API cuando llegue</p>'
    + `<h3 class="sub">Modelo local</h3><div data-parte="local">${p.local}</div>`
}

/** La tarjeta "Mod de Claude Code" (7.3). `m`: lo de `textoMod`. Sin botón para buscar actualizaciones (D12). */
function tarjetaMod(m) {
  const a = m.accion
  const boton = a
    ? `<div class="acc"><button type="button" class="btn" data-accion="cfg-mod" data-valor="${a.id}" data-k="mod-${a.id}"${a.ocupado ? ' aria-disabled="true" title="Prendiendo…"' : ''}>${escapar(a.texto)}</button></div>`
    : ''
  return `<div class="tarj"><div class="tarj-t"><b>Mod de Claude Code</b>${pill(m.tono, m.pill)}</div>${m.linea ? `<p>${escapar(m.linea)}</p>` : ''}${boton}</div>`
}

/**
 * Pestaña Instalación (4.4 y 5): la tarjeta del mod, "En esta PC" (Claude Code y GitHub, de solo
 * lectura), "Primeros pasos" con "Abrir →" y la versión de Avis al pie. `datos`: { mod, enEstaPC, version }.
 */
export function seccionInstalacion(datos) {
  const { claude, github } = datos.enEstaPC
  return `<h3 class="sub">Mod</h3>${tarjetaMod(datos.mod)}`
    + '<h3 class="sub">En esta PC</h3>'
    + fila('Claude Code', escapar(claude.descripcion), pill(claude.tono, claude.pill))
    + fila('GitHub', 'Para ver al equipo.', pill(github.tono, github.pill))
    + fila('Primeros pasos', 'Revisa y arregla la instalación, paso por paso.', '<button type="button" class="btn sec" data-accion="cfg-pp" data-k="pp">Abrir →</button>')
    + `<p class="ver-avis">Avis${datos.version ? ` ${escapar(datos.version)}` : ''} · widget</p>`
}

/** El Avi de 40 junto al título (6.1 `.mini`): solo fuera de Mascota, en la forma chica y decorativo. */
export function miniConfiguracion(especie, tab) {
  if (tab === 'mascota') return ''
  return avi(claudeDe(especieValida(especie)), 'esperando', 40)
}
