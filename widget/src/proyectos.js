// Proyectos (#44, docs/diseno/proyectos-ux.md, opción B "Carpeta"): lógica pura de la hoja. Sin DOM: se
// prueba en node. Los textos son los de la sección 5; el HTML está en proyectosVista.js y los actos en
// proyectosMotion.js. Reglas (2): la carpeta es de quien la eligió (Avis nunca la mueve, renombra ni
// borra; la ventana nunca manda una ruta, 11.2); lo que viaja a cada motor se dice en la pantalla; borrar
// confirma en el mismo botón; nada se abre solo. Guardar es explícito (D-p7): el formulario no se guarda
// mientras se escribe.
// Entrega P1: los proyectos, su hoja y su carpeta. Entrega P2: las charlas de cada proyecto (`charlasDe`,
// `cuentaCharlas`), las marcas de contexto y los textos de la charla del proyecto (8).

import { plural } from './logica.js'
import { claveNombre, colorDe, nuevoId } from './tareas.js'

// El color del proyecto nuevo es el de las listas (6): el mismo `colorSiguiente`, nunca una copia
export { colorSiguiente } from './tareas.js'
import { colorSiguiente } from './tareas.js'

/** Topes de 11.1 (D-p18). */
export const MAX_NOMBRE_PROYECTO = 40
export const MAX_INSTRUCCIONES = 4000
/** Desde cuántos caracteres las instrucciones muestran «{n} de 4000» (4.10: «cerca del tope»). */
export const AVISO_INSTRUCCIONES = 3600

// ------------------------------------------------------------------ validar (4.10, 5.2)

/**
 * El nombre de un proyecto (4.10): `{ ok: true, nombre }` sin los espacios de los bordes, o `{ ok: false,
 * motivo }` con `vacio`, `largo` (más de 40) o `repetido` (sin mayúsculas ni tildes, como las listas).
 * `propioId`: el proyecto que se edita, que puede quedarse con su nombre.
 */
export function validarNombreProyecto(nombre, proyectos, propioId = null) {
  const n = String(nombre ?? '').trim()
  if (!n) return { ok: false, motivo: 'vacio' }
  if ([...n].length > MAX_NOMBRE_PROYECTO) return { ok: false, motivo: 'largo' }
  if ((proyectos ?? []).some(p => p.id !== propioId && claveNombre(p.nombre) === claveNombre(n))) return { ok: false, motivo: 'repetido' }
  return { ok: true, nombre: n }
}

/** Las instrucciones (4.10): hasta 4000 caracteres. `{ ok: true, texto }` o `{ ok: false, motivo: 'largo' }`. */
export function validarInstrucciones(texto) {
  const t = String(texto ?? '')
  if ([...t].length > MAX_INSTRUCCIONES) return { ok: false, motivo: 'largo' }
  return { ok: true, texto: t }
}

/** «{n} de 4000» cerca del tope (4.10), o null. */
export function cuentaInstrucciones(texto) {
  const n = [...String(texto ?? '')].length
  return n >= AVISO_INSTRUCCIONES ? `${n} de ${MAX_INSTRUCCIONES}` : null
}

/** Los errores de 5.2 debajo de cada campo, o null. */
export function textoErrorNombre(motivo) {
  return { vacio: 'Ponele un nombre.', repetido: 'Ya hay un proyecto con ese nombre.', largo: 'Hasta 40 letras.' }[motivo] ?? null
}
export function textoErrorInstrucciones(motivo) {
  return motivo === 'largo' ? 'Hasta 4000 caracteres.' : null
}

/** El error de guardar o crear (5.2). */
export const ERROR_GUARDAR = 'No se pudo guardar el proyecto. Probá de nuevo.'

/** Una carpeta rechazada o que no se pudo crear (5.2, 11.2), por el `motivo` que devuelve Rust. */
export function textoMotivoCarpeta(motivo) {
  if (motivo === 'grande') return 'Esa carpeta es muy grande para que Claude la lea: elegí una más adentro.'
  if (motivo === 'red') return 'Las carpetas de red todavía no se pueden usar.'
  if (motivo === 'crear') return 'No se pudo crear la carpeta en Documentos. Probá de nuevo o elegí una de esta PC.'
  return ERROR_GUARDAR
}

/** Un id nuevo `p-…` (11.1, `nuevoId` de tareas.js): la hora en base 36 y azar; nunca uno de `usados`. */
export function nuevoIdProyecto(ahora, azar = Math.random, usados = new Set()) {
  return nuevoId('p', ahora, azar, usados)
}

// ------------------------------------------------------------------ textos de la hoja (5.1)

/** «1 archivo», «3 archivos», «999+ archivos» (más de 999). */
export function textoArchivos(k) {
  const n = Number(k) || 0
  return n > 999 ? '999+ archivos' : plural(n, 'archivo', 'archivos')
}

/**
 * La línea debajo del nombre del proyecto (5.1): «{n} charlas · {k} archivos», «sin charlas todavía ·
 * {k} archivos» o «{n} charlas · carpeta perdida». Sin carpeta, solo las charlas.
 */
export function lineaProyecto(p, n) {
  const charlas = n ? plural(n, 'charla', 'charlas') : 'sin charlas todavía'
  const c = p?.carpeta
  if (c?.estado === 'perdida') return `${charlas} · carpeta perdida`
  if (!c || c.estado === 'sin') return charlas
  return `${charlas} · ${textoArchivos(c.archivos)}`
}

/** El subtítulo de la columna (5.1): «{n} proyectos · {m} charlas», «1 proyecto · {m} charlas» o «Ninguno todavía». */
export function subtituloProyectos(lista, charlas) {
  const n = (lista ?? []).length
  if (!n) return 'Ninguno todavía'
  return `${plural(n, 'proyecto', 'proyectos')} · ${plural(Number(charlas) || 0, 'charla', 'charlas')}`
}

/** La etiqueta de la carpeta (4.7): «La creó Avis · {n} archivos» o «De tu PC · {n} archivos». */
export function etiquetaCarpeta(c) {
  return `${c?.tipo === 'avis' ? 'La creó Avis' : 'De tu PC'} · ${textoArchivos(c?.archivos)}`
}

/** Debajo de «Soltá archivos acá» (4.7). */
export function pieSoltar(k) {
  return k ? `${k > 999 ? '999+' : k} adentro · Abrir en el Explorador` : 'vacía · o abrila en el Explorador'
}

/** «Que Avis cree una» (4.10): dónde va a quedar, con el nombre que se escribe (vacío: el de Rust, «Proyecto»). */
export function previaCarpetaAvis(nombre) {
  return `Documentos › Avis › ${String(nombre ?? '').trim() || 'Proyecto'}. Soltás ahí los archivos.`
}

/**
 * La ruta abreviada debajo del nombre de la carpeta (4.7; el `title` lleva la entera): la unidad, «…» y
 * las dos últimas partes cuando hay más de tres.
 */
export function abreviarRuta(ruta) {
  const partes = String(ruta ?? '').split('\\').filter(Boolean)
  if (partes.length <= 3) return String(ruta ?? '')
  return [partes[0], '…', ...partes.slice(-2)].join('\\')
}

/** «¿Borrar con 3 charlas? Sí» (4.11, D-p8): en singular con una; sin charlas, «¿Borrar? Sí». */
export function textoBorrar(n) {
  return n ? `¿Borrar con ${plural(n, 'charla', 'charlas')}? Sí` : '¿Borrar? Sí'
}

/**
 * La línea debajo del borrado armado (5.1). Con una sola charla, «su charla» (decisión de P2: 5.1 solo
 * trae «sus {n} charlas», que con 1 diría «sus 1 charla»).
 */
export function lineaBorrar(n) {
  if (!n) return 'Se va el proyecto. La carpeta y sus archivos quedan en tu PC. Esc cancela.'
  const charlas = n === 1 ? 'su charla' : `sus ${n} charlas`
  return `Se van el proyecto y ${charlas}. La carpeta y sus archivos quedan en tu PC. Esc cancela.`
}

/** Borrar con fallas (5.2): «No se pudieron borrar {k} charlas. Probá de nuevo.» (con 1, en singular). */
export function textoBorradoFallido(k) {
  return k === 1 ? 'No se pudo borrar 1 charla. Probá de nuevo.' : `No se pudieron borrar ${k} charlas. Probá de nuevo.`
}

// ------------------------------------------------------------------ las charlas del proyecto (4.5, 8; entrega P2)

/** Cuántas charlas muestra la ficha (4.5): las más recientes; con más, «Ver las {n} charlas». */
export const TOPE_CHARLAS_FICHA = 5

/** Las charlas de un proyecto (`listaCharlas` de chat.js, con `proyecto`), de la más nueva a la más vieja (11.6 caso 4). */
export function charlasDe(charlas, id) {
  return (charlas ?? []).filter(x => x.proyecto === id).sort((a, b) => b.actualizada - a.actualizada)
}

/** Cuántas charlas tiene cada proyecto: `{ [id]: n }` (el índice, la línea y el subtítulo de 5.1). */
export function cuentaCharlas(charlas) {
  const n = {}
  for (const x of charlas ?? []) if (x.proyecto) n[x.proyecto] = (n[x.proyecto] ?? 0) + 1
  return n
}

/** «{n} mensajes» de cada charla de la ficha (4.5). */
export const textoMensajes = n => plural(Number(n) || 0, 'mensaje', 'mensajes')

/** La fila que abre el cajón filtrado (4.5). Solo se ve con más de 5 charlas. */
export const verLasCharlas = n => `Ver las ${n} charlas`

/** Arriba del cajón filtrado por un proyecto (8.3): «{proyecto} · {n} charlas». */
export const filtroCharlas = (nombre, n) => `${nombre} · ${plural(n, 'charla', 'charlas')}`

/** El nombre accesible del chip del proyecto en la hoja (8.2). */
export const nombreChipProyecto = nombre => `Proyecto ${nombre}: ver el proyecto`

/**
 * El proyecto que pide la ventana al abrir una charla (`chat_abrir`, A2 de P2): el de la charla, salvo que
 * tenga mensajes y su proyecto ya no esté en la lista leída (borrado o roto): entonces ninguno, y la charla
 * sigue sin proyecto (8.3). Una charla nueva o la lista sin leer mandan el id y Rust decide.
 */
export function proyectoParaAbrir(id, { lista, leido }, conMensajes) {
  if (!id) return null
  if (conMensajes && leido && !(lista ?? []).some(p => p.id === id)) return null
  return id
}

/** Las líneas del hilo de 8.4 y el anuncio de 8.5. */
export const AVISO_CARPETA_PERDIDA = 'No encuentro la carpeta del proyecto: sigo solo con las instrucciones.'
export const AVISO_CARPETA_CAMBIO = 'La carpeta del proyecto cambió: Claude sigue sin lo que charlaron antes.'
export const AVISO_PROYECTO_BORRADO = 'La charla se cerró porque borraste su proyecto.'

/**
 * Las marcas de contexto de la charla del proyecto (`.ctx-p`, 8.2; 11.6 caso 9): `{ tipo, texto }` con
 * `si` (✓), `no` (—, punteada) o `mal` (la carpeta perdida, en rojo). `carpeta`: el `estado` de la carpeta.
 */
export function marcasContexto({ motor, carpeta }) {
  const marcas = [{ tipo: 'si', texto: 'Instrucciones' }]
  if (motor === 'local') marcas.push({ tipo: 'no', texto: 'Carpeta: solo con Claude Code' })
  else if (carpeta === 'ok') marcas.push({ tipo: 'si', texto: 'Carpeta, cuando hace falta' })
  else if (carpeta === 'perdida') marcas.push({ tipo: 'mal', texto: 'Carpeta perdida' })
  return marcas
}

/**
 * El pie del campo en una charla del proyecto (8.2): «instrucciones + carpeta» con Claude Code y la
 * carpeta a mano; si no (Local, o la carpeta perdida: decisión de P2), «solo instrucciones».
 */
export function pieContexto({ motor, carpeta }) {
  return motor !== 'local' && carpeta === 'ok' ? 'instrucciones + carpeta' : 'solo instrucciones'
}

/** Proyectos rotos (5.2, 7.6), arriba del índice. */
export function textoRotos(n) {
  return n === 1
    ? '1 proyecto no se pudo leer. Sigue en la carpeta, sin tocar.'
    : `${n} proyectos no se pudieron leer. Siguen en la carpeta, sin tocar.`
}

/** El anuncio al elegir un proyecto (5.3): «{nombre}, {n} charlas». */
export function anuncioElegido(p, n) {
  return `${p.nombre}, ${plural(Number(n) || 0, 'charla', 'charlas')}`
}

// ------------------------------------------------------------------ la fila del menú (4.1)

/** Cuántos proyectos tienen la carpeta perdida (7.4). */
export function conPerdida(lista) {
  return (lista ?? []).filter(p => p.carpeta?.estado === 'perdida').length
}

/** El nombre accesible de la fila (4.1): «Proyectos» · «Proyectos, 3» · «Proyectos, 3, 1 con la carpeta perdida». */
export function nombreFilaProyectos(lista) {
  const n = (lista ?? []).length
  if (!n) return 'Proyectos'
  const k = conPerdida(lista)
  return k ? `Proyectos, ${n}, ${k} con la carpeta perdida` : `Proyectos, ${n}`
}

// ------------------------------------------------------------------ teclado (9)

/**
 * Esc con la hoja abierta (9.1), una capa por vez: 1) el borrado armado se desarma; 2) un formulario con
 * cambios avisa «¿Descartar los cambios? Esc otra vez» y el segundo Esc descarta; 3) un formulario sin
 * cambios vuelve al proyecto (o al primer uso); 4) la última, Sesiones (`alEscModulo`).
 */
export function alEscProyectos(t) {
  if (t?.armado) return 'desarmar'
  if (t?.vista === 'nuevo' || t?.vista === 'editar') {
    if (hayCambios(t.form)) return t.form.aviso ? 'descartar' : 'avisar-descartar'
    return 'cerrar-form'
  }
  return 'cerrar'
}

/**
 * Ctrl P (9.2, D-p16): solo Ctrl, sin Alt, Shift ni Windows. WebView2 lo usa para imprimir: quien lo
 * maneja hace `preventDefault` en el `keydown` (sin medir todavía, M-P4 de 11.8).
 */
export function esAtajoProyectos(e) {
  return String(e?.key ?? '').toLowerCase() === 'p' && !!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey
}

/** Al borrar (9.4): el foco va a la fila siguiente, o a la anterior; sin ninguna, null («+ Nuevo»). */
export function focoTrasBorrar(lista, id) {
  const i = lista.findIndex(p => p.id === id)
  const otra = lista[i + 1] ?? lista[i - 1]
  return otra && otra.id !== id ? otra.id : null
}

// ------------------------------------------------------------------ el estado de la hoja (3.5)

/**
 * `st.pro` de main.js (3.5; `st.proyectos` ya son los repos de Sesiones): abierta (la sigue `st.modulo`),
 * lo leído de `proyectos_leer` (`lista`, `rotas`), el elegido (no se guarda entre ejecuciones), la vista
 * (`proyecto`, `nuevo`, `editar`), el formulario, el borrado armado, el proyecto recién creado (su fila
 * entra con su acto), lo que hace Rust (`trabajando`: crear, guardar, la carpeta) y los errores.
 */
export function proyectosInicial() {
  return {
    abierta: false, lista: [], rotas: [], elegido: null, vista: 'proyecto', form: null, armado: null,
    leido: false, cargando: false, fantasmas: false, error: null, errorForm: null, errorCarpeta: null, trabajando: false, recien: null,
  }
}

/** Abre la hoja (3.1): el proyecto pedido o el último elegido; desarma y sin formulario. */
export function abrirProyectos(t, proyecto) {
  return { ...t, abierta: true, elegido: proyecto ?? t.elegido, vista: 'proyecto', form: null, armado: null, errorForm: null, errorCarpeta: null }
}

/** Cierra: descarta el formulario y desarma; el elegido queda para la próxima vez en esta ejecución. */
export function cerrarProyectos(t) {
  return { ...t, abierta: false, vista: 'proyecto', form: null, armado: null, errorForm: null, errorCarpeta: null }
}

/** El elegido existe todavía; si no (borrado, roto), el primero del índice; sin proyectos, ninguno. */
export function elegidoValido(t) {
  if (t.lista.some(p => p.id === t.elegido)) return t
  return { ...t, elegido: t.lista[0]?.id ?? null }
}

/** Elegir un proyecto en el índice: el proyecto, sin formulario y desarmado. */
export function elegirProyecto(t, id) {
  return { ...t, elegido: id, vista: 'proyecto', form: null, armado: null, errorForm: null, errorCarpeta: null }
}

/** Lo que el formulario compara para saber si hay cambios. */
const CAMPOS = ['nombre', 'instrucciones', 'color', 'carpeta']

function formulario(datos, extra = {}) {
  return { ...datos, original: { ...datos }, errores: {}, aviso: false, ...extra }
}

/** «+ Nuevo» o «Crear mi primer proyecto» (4.10): el color siguiente y «Que Avis cree una». */
export function empezarNuevo(t) {
  const datos = { nombre: '', instrucciones: '', color: colorSiguiente(t.lista), carpeta: 'avis' }
  return { ...t, vista: 'nuevo', armado: null, errorForm: null, errorCarpeta: null, form: formulario(datos, { id: null }) }
}

/** El lápiz o «Editar» de Instrucciones (3.4): el formulario con los datos del proyecto. */
export function empezarEditar(t, id) {
  const p = t.lista.find(x => x.id === id)
  if (!p) return t
  const datos = { nombre: p.nombre, instrucciones: p.instrucciones ?? '', color: colorDe(p.color), carpeta: p.carpeta?.tipo ?? null }
  return { ...t, elegido: id, vista: 'editar', armado: null, errorForm: null, errorCarpeta: null, form: formulario(datos, { id }) }
}

/** Un campo del formulario (lo que se escribe, el color, la carpeta). Saca el aviso de descartar. */
export function editarForm(t, campo, valor) {
  if (!t.form) return t
  return { ...t, form: { ...t.form, [campo]: valor, aviso: false } }
}

/** ¿El formulario cambió algo? */
export function hayCambios(form) {
  if (!form?.original) return false
  return CAMPOS.some(c => (form[c] ?? '') !== (form.original[c] ?? ''))
}

/** Cancelar, Esc o guardar: de vuelta al proyecto (o al primer uso). */
export function cerrarFormulario(t) {
  return { ...t, vista: 'proyecto', form: null, errorForm: null }
}

/**
 * Antes de «Crear proyecto» o «Guardar cambios»: `{ ok, errores: { nombre?, instrucciones? }, nombre,
 * instrucciones }` con los motivos de `validarNombreProyecto` y `validarInstrucciones`.
 */
export function revisarFormulario(form, lista) {
  const n = validarNombreProyecto(form.nombre, lista, form.id)
  const i = validarInstrucciones(form.instrucciones)
  const errores = {}
  if (!n.ok) errores.nombre = n.motivo
  if (!i.ok) errores.instrucciones = i.motivo
  if (!n.ok || !i.ok) return { ok: false, errores }
  return { ok: true, errores, nombre: n.nombre, instrucciones: i.texto }
}
