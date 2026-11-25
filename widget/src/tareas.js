// Tareas (#39, docs/diseno/tareas-ux.md, opción B "Carpeta"): la lógica pura de la hoja. El día en
// hora de Argentina (fechas.js, el mismo de la configuración), el rótulo de cada fecha, las vistas Hoy,
// Vencidas y cada lista (3.4), las cuentas de la fila de la barra, el aviso diario (11.4), los nombres
// de lista (D-n4), Esc por capas (9.1), Ctrl T, el color de la lista nueva (6.1), los textos de la
// sección 5 y los cambios de cada lista. Cada cambio devuelve una lista nueva y nunca toca la de antes.
// El formato es el v1 de tareas.rs (11.1): `creada` y `hechaEn` en ms, `fecha` "AAAA-MM-DD" o null.
// Sin DOM: lo dibuja tareasVista.js, lo mueve tareasMotion.js y lo conecta main.js (que guarda con
// `tareas_guardar`). Confirmar en el mismo botón es `clicBorrar` de configuracion.js, sobre `armado`.

import { hoyArgentina, diasEntre, sumarDias } from './fechas.js'

export { hoyArgentina, diasEntre }

/** Los topes de 11.1 (D-n9), los mismos de tareas.rs: la ventana no deja pasarlos. */
export const MAX_NOMBRE_LISTA = 40
export const MAX_TITULO = 200
export const MAX_NOTAS = 4000
export const MAX_SUBTAREAS = 50

/** Los colores de lista (6.1), en el orden en que rotan. Se guarda el nombre del token, nunca un color. */
export const COLORES = ['celeste', 'verde', 'rosa', 'violeta', 'ambar', 'rojo']

/** El color de una lista: uno de la paleta, o celeste (11.1). */
export const colorDe = c => (COLORES.includes(c) ? c : COLORES[0])

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const SEMANA_LARGA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const partes = f => {
  const d = new Date(`${f}T12:00:00Z`)
  return { semana: d.getUTCDay(), dia: d.getUTCDate(), mes: d.getUTCMonth() + 1 }
}

/** "martes 24/11": el día de la bajada y de Hoy (5.1 y 4.3). */
export function fechaCorta(dia) {
  const p = partes(dia)
  return `${SEMANA_LARGA[p.semana]} ${p.dia}/${p.mes}`
}

/**
 * El rótulo de una fecha límite contra hoy (4.6): `{ corto, largo, tono }`, con tono `error`
 * (vencida), `aviso` (hoy) o `nada`; sin fecha, null.
 */
export function etiquetaFecha(fecha, hoy) {
  if (!fecha) return null
  const n = diasEntre(fecha, hoy)
  const p = partes(fecha)
  const dm = `${p.dia}/${p.mes}`
  if (n === -1) return { corto: 'ayer', largo: 'Venció ayer', tono: 'error' }
  if (n < 0) return { corto: `venció ${dm}`, largo: `Venció el ${dm}`, tono: 'error' }
  if (n === 0) return { corto: 'hoy', largo: 'Vence hoy', tono: 'aviso' }
  if (n === 1) return { corto: 'mañana', largo: 'Vence mañana', tono: 'nada' }
  return { corto: `${SEMANA[p.semana]} ${p.dia}`, largo: `Vence el ${SEMANA[p.semana]} ${dm}`, tono: 'nada' }
}

// ------------------------------------------------------------------ vistas (3.4)

const conLista = listas => listas.flatMap(lista => lista.tareas.map(tarea => ({ lista, tarea })))
const porImportante = (a, b) => Number(!!b.tarea.importante) - Number(!!a.tarea.importante)
const porCreada = (a, b) => (a.tarea.creada ?? 0) - (b.tarea.creada ?? 0)
// Sin fecha, al final
const porFecha = (a, b) => (a.tarea.fecha ?? '9999') < (b.tarea.fecha ?? '9999') ? -1 : (a.tarea.fecha ?? '9999') > (b.tarea.fecha ?? '9999') ? 1 : 0
const porHechaEn = (a, b) => (b.tarea.hechaEn ?? -1) - (a.tarea.hechaEn ?? -1)
const ordenar = (items, ...criterios) => [...items].sort((a, b) => {
  for (const c of criterios) {
    const r = c(a, b)
    if (r) return r
  }
  return 0
})

/**
 * Lo que muestra una vista (3.4): `{ pendientes, hechas }`, cada una `[{ lista, tarea }]`. Hoy junta
 * las de hoy de todas las listas (importantes primero, después por `creada`); Vencidas, las sin tildar
 * con fecha anterior a hoy, la más vieja primero (a igual fecha, importantes primero) y sin "Hechas";
 * una lista ordena importantes, fecha (sin fecha al final) y `creada`. "Hechas", por `hechaEn`
 * descendente. Una lista que no existe es null.
 */
export function vista(listas, ver, hoy) {
  if (ver === 'hoy') {
    const deHoy = conLista(listas).filter(x => x.tarea.fecha === hoy)
    return {
      pendientes: ordenar(deHoy.filter(x => !x.tarea.hecha), porImportante, porCreada),
      hechas: ordenar(deHoy.filter(x => x.tarea.hecha), porHechaEn),
    }
  }
  if (ver === 'vencidas') {
    const v = conLista(listas).filter(x => !x.tarea.hecha && x.tarea.fecha && x.tarea.fecha < hoy)
    return { pendientes: ordenar(v, porFecha, porImportante, porCreada), hechas: [] }
  }
  const lista = listas.find(l => l.id === ver)
  if (!lista) return null
  const todas = conLista([lista])
  return {
    pendientes: ordenar(todas.filter(x => !x.tarea.hecha), porImportante, porFecha, porCreada),
    hechas: ordenar(todas.filter(x => x.tarea.hecha), porHechaEn),
  }
}

/** Las cuentas de la fila de la barra y del índice (4.1): de hoy y vencidas, sin tildar. */
export function cuentas(listas, hoy) {
  let deHoy = 0
  let vencidas = 0
  for (const { tarea } of conLista(listas)) {
    if (tarea.hecha || !tarea.fecha) continue
    if (tarea.fecha === hoy) deHoy++
    else if (tarea.fecha < hoy) vencidas++
  }
  return { hoy: deHoy, vencidas }
}

/** Las pendientes de una lista (la cuenta del índice). */
export const pendientesDe = lista => lista.tareas.filter(t => !t.hecha).length

/** El avance de Hoy (4.3): las de hoy tildadas de todas las de hoy. */
export function avanceHoy(listas, hoy) {
  const deHoy = conLista(listas).filter(x => x.tarea.fecha === hoy)
  return { hechas: deHoy.filter(x => x.tarea.hecha).length, total: deHoy.length }
}

/** "3 pendientes · 1 hecha" (4.3). */
export function cifrasLista(lista) {
  const p = pendientesDe(lista)
  return `${plural(p, 'pendiente', 'pendientes')} · ${plural(lista.tareas.length - p, 'hecha', 'hechas')}`
}

/**
 * ¿La mascota avisa al arrancar (S5, 11.4)? El primer arranque del día de Argentina (`avisado` es el
 * día del último aviso) y con algo de hoy o vencido. El globo es de la entrega 3.
 */
export function debeAvisar({ avisado, hoy, cuentas: c }) {
  return avisado !== hoy && (c?.hoy ?? 0) + (c?.vencidas ?? 0) > 0
}

// ------------------------------------------------------------------ la fila de la barra y el encabezado (4.1 y 5.1)

const partesCuenta = c => [c.hoy ? `${c.hoy} para hoy` : '', c.vencidas ? plural(c.vencidas, 'vencida', 'vencidas') : ''].filter(Boolean)

/** A la derecha de la fila "Tareas": null (la pista "Ctrl T"), ámbar con las de hoy o rojo con alguna vencida. */
export function chipFilaTareas(c) {
  const n = (c?.hoy ?? 0) + (c?.vencidas ?? 0)
  if (!n) return null
  return { tono: c.vencidas ? 'venc' : 'hoy', n }
}

/** El nombre accesible de la fila: "Tareas, 2 para hoy, 2 vencidas", sin la parte que vale 0. */
export function nombreFilaTareas(c) {
  return ['Tareas', ...partesCuenta(c)].join(', ')
}

/** La bajada del encabezado (5.1). */
export function subtituloTareas(c, hoy, hayListas) {
  if (!hayListas) return 'Se guardan en esta PC'
  const p = partesCuenta(c)
  return [fechaCorta(hoy), ...(p.length ? p : ['nada urgente'])].join(' · ')
}

// ------------------------------------------------------------------ nombres y títulos (D-n4, 11.1)

/** Para comparar nombres: sin espacios en los bordes, sin mayúsculas ni tildes. */
const clave = s => String(s ?? '').trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/**
 * Un nombre de lista (7): `{ ok: true, nombre }` sin los espacios de los bordes, o `{ ok: false,
 * motivo }` con `vacio`, `largo` (más de 40) o `duplicada` (con el nombre de la `existente`).
 * `propioId`: la lista que se renombra, que puede quedarse con su nombre.
 */
export function validarNombreLista(nombre, listas, propioId = null) {
  const n = String(nombre ?? '').trim()
  if (!n) return { ok: false, motivo: 'vacio' }
  if ([...n].length > MAX_NOMBRE_LISTA) return { ok: false, motivo: 'largo' }
  const otra = listas.find(l => l.id !== propioId && clave(l.nombre) === clave(n))
  if (otra) return { ok: false, motivo: 'duplicada', existente: otra.nombre }
  return { ok: true, nombre: n }
}

/** El error debajo del campo de lista (5.1); vacío no dice nada (Enter no hace nada) y el largo no pasa del campo. */
export function textoErrorLista(r) {
  return r?.motivo === 'duplicada' ? `Ya hay una lista «${r.existente}».` : null
}

/** Un título (8): sin los espacios de los bordes y recortado a 200; vacío, el `anterior` (o null). */
export function validarTitulo(texto, anterior = null) {
  const t = String(texto ?? '').trim()
  if (!t) return anterior
  return [...t].slice(0, MAX_TITULO).join('')
}

// ------------------------------------------------------------------ cambios de cada lista

/**
 * Un id nuevo del formato de tareas.rs (`^[a-z0-9-]{1,40}$` con su prefijo `l`, `t` o `s`): la hora en
 * base 36 y seis caracteres de azar. `usados`: ids que no puede repetir (las listas y los archivos
 * rotos: una lista nueva nunca usa el nombre de un archivo roto, 11.1).
 */
export function nuevoId(prefijo, ahora, azar = Math.random, usados = new Set()) {
  for (;;) {
    const id = `${prefijo}-${Math.floor(ahora).toString(36)}${Math.floor(azar() * 36 ** 6).toString(36).padStart(6, '0')}`
    if (!usados.has(id)) return id
  }
}

/** El color de la lista nueva (6.1): el siguiente al de la última del orden; sin listas, celeste. */
export function colorSiguiente(listas) {
  if (!listas.length) return COLORES[0]
  const ultima = listas.reduce((a, b) => ((b.orden ?? 0) >= (a.orden ?? 0) ? b : a))
  return COLORES[(COLORES.indexOf(colorDe(ultima.color)) + 1) % COLORES.length]
}

/** Una lista nueva al final del orden (el nombre ya validado con `validarNombreLista`). */
export function nuevaLista(listas, nombre, { id, ahora }) {
  const orden = listas.reduce((m, l) => Math.max(m, (l.orden ?? 0) + 1), 0)
  return { v: 1, id, nombre: String(nombre).trim(), color: colorSiguiente(listas), orden, creada: ahora, tareas: [] }
}

export function renombrarLista(lista, nombre) {
  return { ...lista, nombre: String(nombre).trim() }
}

/** "Agregar" en Hoy (15): la primera lista del orden, con fecha de hoy. */
export function listaParaHoy(listas) {
  return [...listas].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0] ?? null
}

/** Una tarea nueva al final de la lista (las vistas ordenan), o null si el título queda vacío. */
export function agregarTarea(lista, titulo, { id, ahora, fecha = null }) {
  const t = validarTitulo(titulo)
  if (!t) return null
  const tarea = { id, titulo: t, hecha: false, hechaEn: null, fecha, importante: false, notas: '', subtareas: [], creada: ahora }
  return { ...lista, tareas: [...lista.tareas, tarea] }
}

/** Tilda (anota cuándo, para ordenar "Hechas") o destilda. */
export function tildarTarea(lista, id, hecha, ahora) {
  return { ...lista, tareas: lista.tareas.map(x => (x.id === id ? { ...x, hecha: !!hecha, hechaEn: hecha ? ahora : null } : x)) }
}

/**
 * Lo leído de `tareas_leer` en lugar de lo que hay en pantalla, salvo las listas que no se pudieron
 * guardar (`sinGuardar`): esas siguen como están en pantalla (7.4: lo que está en pantalla no se deshace).
 */
export function mezclarLectura(leidas, enPantalla, sinGuardar) {
  const propias = new Map(enPantalla.filter(l => sinGuardar.has(l.id)).map(l => [l.id, l]))
  const r = leidas.map(l => propias.get(l.id) ?? l)
  for (const [id, l] of propias) if (!leidas.some(x => x.id === id)) r.push(l)
  return r
}

// ------------------------------------------------------------------ la hoja (3.5)

/**
 * El estado de la hoja en la ventana (3.5): abierta, la vista (`hoy`, `vencidas`, el id de una lista
 * o `rota:<archivo>`), la tarea abierta (entrega 2), el borrado armado, la lista que se renombra o la
 * que se crea (los borradores viven en su `<input>`, nunca acá) y su error, "Hechas" desplegado, la
 * mascota festejando, lo leído (`listas`, `rotas`), si se está leyendo y los errores de 7.4 y 7.6.
 */
export function tareasInicial() {
  return {
    abierta: false, ver: 'hoy', det: null, armado: null, renombrando: null, creando: false, errorLista: null,
    hechas: false, feliz: false, listas: [], rotas: [], leido: false, cargando: false, fantasmas: false,
    errorGuardar: false, errorLeer: null,
  }
}

/** Abre en la última vista de esta ejecución (la primera vez, Hoy), o en `ver` (el globo abre en Hoy). */
export function abrirTareas(t, ver) {
  return { ...t, abierta: true, ver: ver ?? t.ver, det: null, armado: null, hechas: false }
}

/** Cierra: descarta lo que se escribía en el índice, desarma y cierra la tarea; la vista queda. */
export function cerrarTareas(t) {
  return { ...t, abierta: false, det: null, armado: null, renombrando: null, creando: false, errorLista: null, hechas: false }
}

/** Cambia de vista: "Hechas" vuelve a plegarse (3.4), se desarma y se cierra lo abierto. */
export function cambiarVista(t, ver) {
  return { ...t, ver, det: null, armado: null, renombrando: null, creando: false, errorLista: null, hechas: false }
}

/**
 * Esc con la hoja abierta (9.1), una capa por vez: 1) un campo de una línea con algo escrito (nueva
 * tarea, nueva subtarea; `foco`: `{ campo, texto }`) se vacía; 2) renombrar o crear una lista se
 * cancela; 3) un "¿Borrar…? Sí" se desarma; 4) la tarea abierta se cierra; 5) la hoja se cierra.
 * Cerrada, no es de la hoja (`accion` null): el Esc siguiente es del panel acoplado.
 */
export function alEscTareas(t, foco) {
  if (!t.abierta) return { tareas: t, accion: null }
  if ((foco?.campo === 'nueva' || foco?.campo === 'subtarea') && foco.texto) return { tareas: t, accion: 'vaciar' }
  if (t.renombrando || t.creando) return { tareas: { ...t, renombrando: null, creando: false, errorLista: null }, accion: 'cancelar-lista' }
  if (t.armado) return { tareas: { ...t, armado: null }, accion: 'desarmar' }
  if (t.det) return { tareas: { ...t, det: null }, accion: 'cerrar-tarea' }
  return { tareas: cerrarTareas(t), accion: 'cerrar' }
}

/** Ctrl T (9.2): solo Ctrl, sin Alt, Shift ni Windows (como `esAtajoConfiguracion`). */
export function esAtajoTareas(e) {
  return String(e.key ?? '').toLowerCase() === 't' && !!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey
}

/** "¿Borrar con 6 tareas? Sí" (4.8): en singular con una, sin cuenta si está vacía. */
export function textoBorrarLista(n) {
  return n ? `¿Borrar con ${plural(n, 'tarea', 'tareas')}? Sí` : '¿Borrar? Sí'
}

// ------------------------------------------------------------------ textos de la vista (5)

/** El nombre de una vista para el `h2` del panel. */
export function nombreVista(listas, ver) {
  if (ver === 'hoy') return 'Hoy'
  if (ver === 'vencidas') return 'Vencidas'
  if (String(ver).startsWith('rota:')) return String(ver).slice(5)
  return listas.find(l => l.id === ver)?.nombre ?? ''
}

/** El placeholder del campo de nueva tarea (5.1); en Vencidas no hay campo (null). */
export function textoCampoNueva(ver, listas) {
  if (ver === 'vencidas') return null
  if (ver === 'hoy') {
    const l = listaParaHoy(listas)
    return l ? `Agregar para hoy en ${l.nombre}…` : null
  }
  const l = listas.find(x => x.id === ver)
  return l ? `Agregar a ${l.nombre}…` : null
}

/** El vacío de una vista sin pendientes (5.2): la pose de la mascota, el título y la línea. */
export function vacioVista(ver, listas, hoy) {
  if (ver === 'hoy') {
    const manana = sumarDias(hoy, 1)
    const n = conLista(listas).filter(x => !x.tarea.hecha && x.tarea.fecha === manana).length
    return { pose: 'feliz', titulo: 'Listo por hoy.', linea: `No queda nada con fecha de hoy.${n ? ` Mañana: ${plural(n, 'tarea', 'tareas')}.` : ''}` }
  }
  if (ver === 'vencidas') return { pose: 'feliz', titulo: 'Nada vencido.', linea: 'Estás al día.' }
  return { pose: 'esperando', titulo: `«${nombreVista(listas, ver)}» está vacía.`, linea: 'Escribí arriba y Enter para sumar la primera.' }
}

/** Los anuncios de 5.3 que llevan cuentas. */
export function anuncioAgregada(lista, paraHoy) {
  return `Agregada a ${lista}${paraHoy ? ', para hoy' : ''}`
}
export function anuncioBorradaLista(lista, n) {
  if (!n) return `Borraste «${lista}»`
  return n === 1 ? `Borraste «${lista}» y su tarea` : `Borraste «${lista}» y sus ${n} tareas`
}

// ------------------------------------------------------------------ el acto del tilde (10)

/** Lo que espera la fila tildada antes de pasar a "Hechas" (`--d-tilde`); sin movimiento, 350 ms y sin pliegue. */
export const ESPERA_TILDE_MS = 700
export const ESPERA_TILDE_QUIETA_MS = 350

/** `modo`: el de `modoMovimiento` de chat.js (`completo`, `fundido` con movimiento reducido, `nada` en pausa). */
export function tiempoTilde(modo) {
  return modo === 'completo' ? { espera: ESPERA_TILDE_MS, pliega: true } : { espera: ESPERA_TILDE_QUIETA_MS, pliega: false }
}

/**
 * Dónde va el foco al tildar en una lista (9.4): el tilde de la fila siguiente; si no hay, el de la
 * anterior; si no, el campo de nueva tarea. `orden`: los ids de las filas pendientes, en pantalla.
 */
export function focoTrasTildar(orden, id) {
  const i = orden.indexOf(id)
  const otro = orden[i + 1] ?? orden[i - 1]
  return otro && otro !== id ? `ck-${otro}` : 'nueva'
}
