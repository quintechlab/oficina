// Configuración dentro del panel (#23, docs/diseno/configuracion-ux.md, opción B "Taller"): la lógica
// pura de la hoja. Las pestañas y su teclado, qué valor sirve para cada ajuste (lo mismo que
// `ajuste_valido` de preferencias.rs), abrir y cerrar, Esc en sus tres capas (4.1), el atajo Ctrl , y
// la ubicación del panel y la vista previa de la mascota. Sin DOM: lo dibuja configuracionVista.js y
// lo conecta main.js.

import { NOMBRES_ESPECIES, datosEspecie, especieValida } from './especies.js'
import { cifrasDescarga, formatoGB, MODELOS } from './chat.js'
import { DESFASE_AR, diaArgentina, fechaValida } from './fechas.js'
import { resumenGuardadoValido, fraseGuardadaValida } from './habitos.js'

/** Orden fijo de las pestañas (4.4). */
export const PESTANAS = [
  { id: 'mascota', nombre: 'Mascota' },
  { id: 'panel', nombre: 'Panel' },
  { id: 'modelos', nombre: 'Modelos' },
  { id: 'datos', nombre: 'Datos' },
  { id: 'instalacion', nombre: 'Instalación' },
]
export const IDS_PESTANAS = PESTANAS.map(p => p.id)

/** ¿Es una de las cinco pestañas? */
export function pestanaValida(id) {
  return IDS_PESTANAS.includes(id)
}

/**
 * Lo que va después de `actual` con el teclado (11): → la siguiente (de la última a la primera), ←
 * la anterior, Inicio la primera, Fin la última; otra tecla, la misma. Sirve para las pestañas y
 * para los segmentos.
 */
export function pestanaSiguiente(actual, tecla, lista = IDS_PESTANAS) {
  const n = lista.length
  const i = Math.max(0, lista.indexOf(actual))
  if (tecla === 'ArrowRight') return lista[(i + 1) % n]
  if (tecla === 'ArrowLeft') return lista[(i - 1 + n) % n]
  if (tecla === 'Home') return lista[0]
  if (tecla === 'End') return lista[n - 1]
  return actual
}

/** Los interruptores que se guardan en preferencias.json (9.1) y su valor de fábrica. */
export const INTERRUPTORES = { arriba: true, avisar: true, pausa: false }

/** Los nombres de la pestaña Mascota (#37) y su largo máximo (el mismo de `nombre_valido` de Rust). */
export const NOMBRES = ['nombreMascota', 'nombreUsuario']
export const MAX_NOMBRE = 40

/** ¿Sirve como nombre? Hasta 40 caracteres sin los espacios de los bordes y sin caracteres de control; vacío sirve ("el de siempre"). */
export function nombreValido(n) {
  // eslint-disable-next-line no-control-regex
  return typeof n === 'string' && [...n.trim()].length <= MAX_NOMBRE && !/[\u0000-\u001f\u007f-\u009f]/.test(n)
}

/**
 * Lo que guarda "Guardar" de la pestaña Mascota (#37): los nombres que cambiaron respecto de lo
 * guardado, sin espacios de los bordes, en el orden de `NOMBRES`. `null` si alguno no sirve.
 */
export function cambiosNombres(guardados, escritos) {
  const cambios = []
  for (const clave of NOMBRES) {
    const valor = String(escritos?.[clave] ?? '').trim()
    if (!nombreValido(valor)) return null
    if (valor !== (guardados?.[clave] ?? '')) cambios.push({ clave, valor })
  }
  return cambios
}

/** El título bajo la marca (#37): el nombre que le puso el usuario a la mascota; sin nombre, "Avis". */
export const nombreMarca = nombre => nombre || 'Avis'

/** El subtítulo de la configuración: todo se guarda al instante, salvo los nombres de Mascota (#37, con "Guardar"). */
export const subtituloConfiguracion = tab => (tab === 'mascota' ? 'Se guarda al instante · los nombres, con Guardar' : 'Se guarda al instante')

/**
 * ¿`valor` sirve para `clave`? `mascota`, una de las ocho especies (texto exacto); `arriba`,
 * `avisar` y `pausa`, solo booleanos; `tareasAvisado` (el día del aviso diario de tareas,
 * tareas-ux.md 11.4), un día que existe `AAAA-MM-DD` o vacío; `habitosRecordados` (los hábitos ya
 * recordados hoy, habitos-ux.md 8.3 y 11.5), `{ dia, ids }` con solo esas dos claves, un día que existe
 * y hasta 100 ids de hábito; `habitosResumen` (8.4), un lunes que existe o vacío; `habitosFrase` (8.4),
 * `{ lunes, frase }` (`fraseGuardadaValida` de habitos.js); los nombres (#37), `nombreValido`; cualquier otra clave, no. Las mismas reglas que `ajuste_valido` de
 * preferencias.rs. `motor` llega con el chat (D6).
 */
export function validarAjuste(clave, valor) {
  if (clave === 'mascota') return NOMBRES_ESPECIES.includes(valor)
  if (Object.hasOwn(INTERRUPTORES, clave ?? '')) return typeof valor === 'boolean'
  if (clave === 'tareasAvisado') return valor === '' || fechaValida(valor)
  if (clave === 'habitosRecordados') return recordadosValidos(valor)
  // El resumen semanal de Hábitos (habitos-ux.md 8.4): el lunes visto y la frase de esa semana
  if (clave === 'habitosResumen') return resumenGuardadoValido(valor)
  if (clave === 'habitosFrase') return fraseGuardadaValida(valor)
  if (NOMBRES.includes(clave)) return nombreValido(valor)
  return false
}

/** Un id de hábito (`id_valido` de habitos.rs): `h-` y de 1 a 38 minúsculas, dígitos o guiones. */
const ID_HABITO = /^h-[a-z0-9-]{1,38}$/

/** `{ dia, ids }` de los hábitos recordados (11.5), sin otras claves, con hasta 100 ids (`MAX_RECORDADOS`). */
function recordadosValidos(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).length !== 2) return false
  return fechaValida(v.dia) && Array.isArray(v.ids) && v.ids.length <= 100 && v.ids.every(id => typeof id === 'string' && ID_HABITO.test(id))
}

/** Un interruptor leído: lo que no es booleano vuelve al de fábrica. */
export function valorInterruptor(valor, defecto) {
  return typeof valor === 'boolean' ? valor : defecto
}

/** "Dónde vive" (4.4): flotando o acoplada a uno de los cuatro bordes. */
export const UBICACIONES = [['flota', 'Flota'], ['arriba', 'Arriba'], ['derecha', 'Derecha'], ['abajo', 'Abajo'], ['izquierda', 'Izquierda']]

/** La ubicación de un acople (`{ borde, lugar }` o null): flotando, o un borde desconocido, "flota". */
export function ubicacionDe(acople) {
  const b = acople?.borde
  return UBICACIONES.some(([v]) => v === b && v !== 'flota') ? b : 'flota'
}

/** El borde de una ubicación: "flota" es null (flotar); una desconocida, undefined (nada que hacer). */
export function bordeDeUbicacion(ubicacion) {
  if (ubicacion === 'flota') return null
  return UBICACIONES.some(([v]) => v === ubicacion) ? ubicacion : undefined
}

/**
 * Estado de la hoja en la ventana (4.6): abierta, la pestaña (la última usada en esta ejecución, no
 * se guarda), la clave que se escribe (`editando`, nunca el texto), el borrado armado, el ajuste
 * que no se pudo guardar y la forma de la vista previa de la mascota (no se guarda: es de la pantalla).
 */
export function configInicial() {
  // Entrega 4: `ver` ("Mostrar" la clave que se escribe), `errorClave` (su error o aviso) y `pruebas`
  // (lo último que dijo "Probar", por proveedor; solo en memoria)
  return { abierta: false, tab: 'mascota', editando: null, armado: null, error: null, forma: 'base', ver: false, errorClave: null, pruebas: {} }
}

/** Abre en la última pestaña usada, o en `tab` si es una de las cinco. */
export function abrirConfiguracion(config, tab) {
  return { ...config, abierta: true, tab: pestanaValida(tab) ? tab : config.tab }
}

/**
 * Cierra: descarta la clave que se escribía, desarma el borrado, saca el error y la vista previa
 * vuelve a la base (la figura se redibuja al abrir); la pestaña queda.
 */
export function cerrarConfiguracion(config) {
  return { ...config, abierta: false, editando: null, armado: null, error: null, forma: 'base', ver: false, errorClave: null }
}

/**
 * Esc con la configuración abierta (4.1), una capa por vez: cancela la clave que se escribe (el
 * texto se descarta), desarma un "¿Borrar? Sí" o cierra. Cerrada, no es de la configuración
 * (`accion` null): el Esc siguiente es del panel acoplado, que se pliega.
 */
export function alEsc(config) {
  if (!config.abierta) return { config, accion: null }
  if (config.editando) return { config: { ...config, editando: null, error: null, ver: false, errorClave: null }, accion: 'cancelar-clave' }
  if (config.armado) return { config: { ...config, armado: null }, accion: 'desarmar' }
  return { config: cerrarConfiguracion(config), accion: 'cerrar' }
}

/** Ctrl , (4.1): solo Ctrl, sin Alt, Shift ni Windows. */
export function esAtajoConfiguracion(e) {
  return e.key === ',' && !!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey
}

// ------------------------------------------------------------------ Mascota (4.4, 5 y 8)

/** La clave de evolución de la figura del escenario: no es la de ninguna sesión ni la de la marca. */
export const CLAVE_VISTA_PREVIA = 'cfg'

/** Las dos formas de la vista previa: la base y la evolucionada. */
export const FORMAS_VISTA = ['base', 'evo']

/** Los segmentos de la vista previa (5): "Base" y "{evoNombre} ✦". */
export function opcionesForma(especie) {
  return [['base', 'Base'], ['evo', `${datosEspecie(especie).evoNombre} ✦`]]
}

/** Elige la forma de la vista previa; una que no es "base" ni "evo" deja la que había. */
export function elegirForma(config, forma) {
  return FORMAS_VISTA.includes(forma) ? { ...config, forma } : config
}

/** El rótulo del escenario (5): "Especie {n} de 7 · {tipo}". */
export function rotuloEspecie(especie) {
  const e = especieValida(especie)
  return `Especie ${NOMBRES_ESPECIES.indexOf(e) + 1} de ${NOMBRES_ESPECIES.length} · ${datosEspecie(e).tipo}`
}

/** El anuncio al elegir una especie (5, `role=status`). */
export function anuncioEspecie(especie) {
  return `Tu mascota ahora es ${datosEspecie(especie).nombre}`
}

/** El anuncio al cambiar la forma de la vista previa: "{nombre} evoluciona a {evo}" o la vuelta. */
export function anuncioForma(especie, forma) {
  const { nombre, evoNombre } = datosEspecie(especie)
  return forma === 'evo' ? `${nombre} evoluciona a ${evoNombre}` : `${evoNombre} vuelve a ${nombre}`
}

/**
 * Cómo cambia la forma de la vista previa (8): con movimiento, el acto real (`evolucionar` o
 * `devolver` de evolucionMotion.js); con movimiento reducido o "Pausar animaciones", al instante.
 */
export function modoVistaPrevia(forma, { reducido, pausa }) {
  if (reducido || pausa) return 'al-instante'
  return forma === 'evo' ? 'evolucionar' : 'devolver'
}

// ------------------------------------------------------------------ confirmar en el mismo botón (D5)

/** "¿Borrar …? Sí" espera el segundo clic este tiempo y vuelve solo (el de "¿Frenar? Sí" de control.js). */
export const MS_CONFIRMAR = 3000

/** ¿El botón `id` está pidiendo el segundo clic? */
export function armadoVigente(config, id, ahoraMs) {
  return config.armado?.id === id && ahoraMs < config.armado.hasta
}

/**
 * Un clic en un botón que borra (7.1, 7.2, 7.4): el primero, o uno pasados los 3 s, arma
 * "¿Borrar …? Sí"; el segundo dentro de la ventana borra una sola vez (`ejecutar`) y desarma.
 */
export function clicBorrar(config, id, ahoraMs) {
  if (armadoVigente(config, id, ahoraMs)) return { config: { ...config, armado: null }, ejecutar: true }
  return { config: { ...config, armado: { id, hasta: ahoraMs + MS_CONFIRMAR } }, ejecutar: false }
}

/** Pasados los 3 s sin el segundo clic, el botón vuelve solo; antes, nada cambia (el mismo objeto). */
export function desarmarVencido(config, ahoraMs) {
  return config.armado?.hasta != null && ahoraMs >= config.armado.hasta ? { ...config, armado: null } : config
}

// ------------------------------------------------------------------ charla e historial (entrega 5: 4.4, 5 y 7.4)

/** "Quién responde" en las charlas nuevas (D10): el `motor` que guarda `guardar_chat`. */
export const MOTORES = [['claude', 'Claude Code'], ['local', 'Local']]

/** "Modelo" de las charlas nuevas (#35, S2): los segmentos de `MODELOS`; "Por defecto" viaja como `defecto`. */
export const OPCIONES_MODELO = MODELOS.map(({ id, nombre }) => [id ?? 'defecto', nombre])

/** El `data-valor` de un segmento → el modelo (`null` es "Por defecto"); `undefined` si no es una opción. */
export function modeloDeValor(v) {
  if (v === 'defecto') return null
  return MODELOS.some(m => m.id !== null && m.id === v) ? v : undefined
}

const MB = 1024 * 1024

/**
 * Test 7: "1 charla" / "24 charlas" y el tamaño en MB con coma decimal ("1,2 MB"; de 10 MB para
 * arriba sin decimal). Algo que pesa menos de 0,1 MB dice "0,1 MB", nunca "0 MB".
 */
export function cifrasHistorial(charlas, bytes) {
  const n = Number(charlas) || 0
  const b = Math.max(0, Number(bytes) || 0)
  let tam = '0 MB'
  if (b > 0) {
    const mb = b / MB
    tam = mb >= 10 ? `${Math.round(mb)} MB` : `${Math.max(0.1, Math.round(mb * 10) / 10).toFixed(1).replace('.', ',')} MB`
  }
  return { charlas: n === 1 ? '1 charla' : `${n} charlas`, tam }
}

const DESC_HISTORIAL = 'En esta PC y, si Engram está prendido, una copia buscable en el proyecto avis. Se borran las dos.'

/**
 * El bloque "Historial del chat" de la pestaña Datos (7.4). `resumen`: `{ charlas, bytes }` de
 * `chat_contar`, o null sin leer todavía ("Revisando…", 7.5); `borrando`: corre "Borrar todo";
 * `fallidas`: cuántas no se pudieron borrar la última vez. Devuelve `{ estado, tono, pill, titulo,
 * linea, accion, error }`; `accion.armado` es la pregunta del segundo clic (D5).
 */
export function textoHistorial({ resumen = null, borrando = false, fallidas = 0 } = {}) {
  const t = (estado, tono, pill, titulo, linea = '', accion = null, error = null) => ({ estado, tono, pill, titulo, linea, accion, error })
  if (!resumen) return t('revisando', 'nada', 'Revisando…', 'Historial')
  const n = Number(resumen.charlas) || 0
  if (n <= 0 && !borrando) return t('vacio', 'nada', 'Vacío', 'No hay charlas guardadas.')
  const c = cifrasHistorial(n, resumen.bytes)
  const titulo = `${c.charlas} · ${c.tam}`
  if (borrando) return t('borrando', 'proc', 'Borrando…', titulo, DESC_HISTORIAL)
  if (fallidas > 0) {
    const error = fallidas === 1 ? 'No se pudo borrar 1 charla. Probá de nuevo.' : `No se pudieron borrar ${fallidas} charlas. Probá de nuevo.`
    return t('error', null, null, titulo, DESC_HISTORIAL, { id: 'reintentar', texto: 'Reintentar' }, error)
  }
  return t('con', null, null, titulo, DESC_HISTORIAL, { id: 'borrar', texto: 'Borrar todo', armado: `¿Borrar ${c.charlas}? Sí` })
}

// ------------------------------------------------------------------ Instalación y modelo local (7.2 y 7.3)

// El día y el desfase de Argentina (UTC−3 todo el año) viven en fechas.js: las tareas cuentan el día igual (tareas-ux.md 11.2)
const dos = n => String(n).padStart(2, '0')

/** "10:33": la hora de Argentina, en 24 h (la regla del perfil: nunca UTC). */
export function horaArgentina(ms) {
  const d = new Date(ms - DESFASE_AR)
  return `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`
}

const versionDe = v => (typeof v === 'string' && v ? v : null)
const conVersion = (texto, v) => (v ? `${texto} · ${v}` : texto)
const ABRIR_PP = { id: 'pp', texto: 'Abrir primeros pasos', ocupado: false }

/**
 * La tarjeta "Mod de Claude Code" (7.3). `lectura`: la de `estado_mod` (o la de primeros pasos),
 * `{ claude: { encontrado, version }, mod: { instalado, activo, version, error } }`, o null si
 * todavía no se leyó; `revision`: `{ revisado, fallo }` de preferencias.json; `aviso`: el último de
 * `tomar_aviso_mod` con la hora en que se tomó (`cuando`); `instalando`: el mod automático lo está
 * instalando; `prendiendo`: corre el paso "activar". Devuelve `{ estado, tono, pill, linea, accion }`.
 * Fuera de la tabla de 7.3 (sección 14): sin lectura, "Revisando…" (7.5); sin el mod y sin
 * instalación en curso, "Sin instalar".
 */
export function textoMod(lectura, revision, aviso, ahora, { instalando = false, prendiendo = false } = {}) {
  const t = (estado, tono, pill, linea, accion = null) => ({ estado, tono, pill, linea, accion })
  if (instalando) return t('instalando', 'proc', 'Instalando…', 'Faltaba el mod: Avis lo instala solo, no hace falta que hagas nada.')
  if (!lectura) return t('revisando', 'nada', 'Revisando…', '')
  if (lectura.claude?.encontrado !== true) return t('sin-claude', 'error', 'Sin Claude Code', 'Avis no encontró Claude Code en esta PC.', ABRIR_PP)
  const m = lectura.mod ?? {}
  const v = versionDe(m.version)
  if (!m.instalado) {
    const linea = revision?.fallo ? 'Hoy no se pudo instalar. Vuelve a probar mañana.' : 'Avis lo instala solo en la próxima revisión.'
    return t('sin-instalar', 'aviso', 'Sin instalar', linea, ABRIR_PP)
  }
  if (!m.activo) {
    return t('apagado', 'aviso', conVersion('Apagado', v), 'Claude Code no lo carga: sin el mod, Avis no ve tus sesiones.', { id: 'activar', texto: 'Prender', ocupado: !!prendiendo })
  }
  const prendido = conVersion('Prendido', v)
  const hoy = diaArgentina(ahora)
  if (aviso?.tipo === 'actualizo' && aviso.version === v && Number.isFinite(aviso.cuando) && diaArgentina(aviso.cuando) === hoy) {
    return t('actualizado', 'ok', prendido, `Se actualizó solo de ${aviso.desde ?? '…'} a ${v} hoy a las ${horaArgentina(aviso.cuando)}.`)
  }
  if (revision?.fallo) return t('fallo', 'aviso', prendido, 'Hoy no se pudo revisar si hay versión nueva. Vuelve a probar mañana.')
  const r = Number.isFinite(revision?.revisado) ? revision.revisado : null
  const cuando = r == null ? '' : diaArgentina(r) === hoy ? 'hoy' : diaArgentina(r) === hoy - 1 ? 'ayer' : ''
  return t('al-dia', 'ok', prendido, `Al día. Se actualiza solo, una vez por día.${cuando ? ` Revisado ${cuando} ${horaArgentina(r)}.` : ''}`)
}

/**
 * El modelo local como lo lee la tarjeta (`{ modelo, trabajo, progreso }`), a partir del estado que
 * guarda la charla (`st.chat`: `local` y `progreso`, chat.js): la descarga es una sola, la de la hoja
 * y la de la configuración. `bajando` es una descarga en curso (Rust solo lo dice con el hilo andando);
 * "sin-saber" todavía no se leyó (`modelo: null`, "Revisando…").
 */
export function modeloDesdeChat({ local = 'sin-saber', progreso = null } = {}) {
  const modelo = { instalado: 'listo', bajando: 'bajando', roto: 'roto', falta: 'falta' }[local] ?? null
  return { modelo, trabajo: local === 'bajando' ? 'descargando' : null, progreso }
}

/**
 * ¿"Descargar" de la configuración baja el modelo? Solo si falta o está roto: con una descarga en
 * curso, con el modelo listo o sin saber todavía, no hace nada (7.2). Bajar desde acá no abre la hoja
 * de la charla ni manda nada al terminar (un clic, nunca solo).
 */
export function descargaDesdeConfig({ local = 'sin-saber' } = {}) {
  return local === 'falta' || local === 'roto'
}

/**
 * La tarjeta del modelo local (7.2), a partir de `modeloDesdeChat(st.chat)` (`modelo`, `trabajo`,
 * `progreso`): la descarga que corre por detrás es la misma de la charla. La cifra la da el backend (`progreso.total`),
 * nunca fija. Devuelve `{ estado, tono, pill, linea, acciones: [{ id, texto, armado? }] }` y, bajando,
 * `porcentaje` y `fraccion` de la barra. Sin saber todavía del modelo, "Revisando…" (7.5).
 */
export function textoModelo({ modelo = null, trabajo = null, progreso = null } = {}) {
  const total = progreso?.total > 0 ? formatoGB(progreso.total) : null
  const t = (estado, tono, pill, linea, acciones = []) => ({ estado, tono, pill, linea, acciones })
  if (trabajo === 'descargando') {
    const c = cifrasDescarga(progreso)
    return { ...t('bajando', 'proc', `Bajando ${c.porcentaje} %`, `${c.cifra} de ${c.total} · si se corta, sigue donde quedó`), porcentaje: c.porcentaje, fraccion: c.fraccion }
  }
  const borrar = total ? { id: 'borrar', texto: `Borrar ${total}`, armado: `¿Borrar ${total}? Sí` } : { id: 'borrar', texto: 'Borrar', armado: '¿Borrar? Sí' }
  switch (modelo) {
    case 'listo': return t('listo', 'ok', 'Listo', 'Se apaga solo a los 10 min sin uso.', [borrar])
    case 'roto': return t('roto', 'error', 'Roto', 'Faltan piezas o no coinciden. Bajalo de nuevo.', [{ id: 'descargar', texto: 'Bajar de nuevo' }, { id: 'borrar', texto: 'Borrar', armado: '¿Borrar? Sí' }])
    // Una descarga cortada sin nada que la siga es lo mismo que nada: se ofrece descargar
    case 'falta': case 'bajando':
      return t('falta', 'nada', 'Sin instalar', 'Hace falta para charlar sin internet. Se baja una sola vez.', [{ id: 'descargar', texto: total ? `Descargar ${total}` : 'Descargar' }])
    default: return t('revisando', 'nada', 'Revisando…', '')
  }
}

/**
 * El punto de estado de una pestaña (6.3), o null: Modelos, una clave rechazada (entrega 4) o el
 * modelo bajando; Instalación, el mod que necesita atención (apagado, sin Claude Code o sin instalar).
 * `datos`: `{ claves?, modelo, mod }` con los `estado` de `textoModelo` y `textoMod`.
 */
export function puntoPestana(datos, pestana) {
  if (pestana === 'modelos') {
    if (Object.values(datos?.claves ?? {}).some(c => c?.estado === 'rechazada')) return { tono: 'error', texto: ', una clave rechazada' }
    if (datos?.modelo === 'bajando') return { tono: 'proc', texto: ', bajando el modelo' }
  }
  if (pestana === 'instalacion' && ['apagado', 'sin-claude', 'sin-instalar'].includes(datos?.mod)) return { tono: 'aviso', texto: ', el mod necesita atención' }
  return null
}

/**
 * Las filas de solo lectura de "En esta PC" (5): Claude Code ("Versión {v}") y GitHub ("Para ver al
 * equipo."), cada una con su píldora. Claude sale de la lectura del mod o, sin ella, de la revisión de
 * primeros pasos; GitHub, de esa revisión. Sin datos, "Revisando…".
 */
export function filasEnEstaPC(lectura, revisionPasos) {
  const revisando = { tono: 'nada', pill: 'Revisando…' }
  const c = lectura?.claude ?? revisionPasos?.claude
  const claude = !c ? { descripcion: '', ...revisando }
    : c.encontrado === true ? { descripcion: c.version ? `Versión ${c.version}` : '', tono: 'ok', pill: 'Encontrado' }
      : { descripcion: 'Avis no encontró Claude Code en esta PC.', tono: 'error', pill: 'Sin instalar' }
  const r = revisionPasos
  const github = !r?.gh ? revisando
    : r.gh.instalado !== true ? { tono: 'aviso', pill: 'Sin instalar' }
      : r.cuenta?.estado === 'conectada' ? { tono: 'ok', pill: 'Conectado' } : { tono: 'aviso', pill: 'Sin conectar' }
  return { claude, github }
}

// ------------------------------------------------------------------ Claves de API (entrega 4: 7.1 y 9.4)
// La clave entera nunca vive en `st` ni vuelve de Rust: lo único que se lee de ella es su final de 4
// caracteres. El texto que se escribe vive solo en el campo y se lee al guardar.

/**
 * Los tres proveedores (4.4), en este orden, con la inicial del cuadro (sin logos, D11), lo que va a
 * la derecha del nombre (`de`, el del boceto), la empresa de las frases ("Probando con…", "la
 * rechazó") y el prefijo típico de sus claves (solo avisa, D13).
 */
export const PROVEEDORES = [
  { id: 'anthropic', nombre: 'Claude', de: 'Anthropic', empresa: 'Anthropic', inicial: 'A', prefijo: 'sk-ant-' },
  { id: 'openai', nombre: 'OpenAI', de: 'GPT', empresa: 'OpenAI', inicial: 'O', prefijo: 'sk-' },
  { id: 'gemini', nombre: 'Gemini', de: 'Google', empresa: 'Google', inicial: 'G', prefijo: 'AIza' },
]
export const IDS_PROVEEDORES = PROVEEDORES.map(p => p.id)

/** El proveedor `id`, o null si no es uno de los tres. */
export function proveedorDe(id) {
  return PROVEEDORES.find(p => p.id === id) ?? null
}

/** Una clave más corta no es una clave (lo mismo que `forma_valida` de claves.rs). */
export const LARGO_MINIMO_CLAVE = 20

/** Los últimos 4 caracteres (no unidades de UTF-16, como `final_de` de claves.rs). */
export function finalDe(texto) {
  return [...String(texto ?? '')].slice(-4).join('')
}

/**
 * La forma de lo escrito antes de guardarlo (7.1): `vacia` (nada o solo espacios), `espacios` (en el
 * medio), `corta` (menos de 20) o `ok` con la clave sin los espacios de las puntas, su final y
 * `aviso: 'prefijo'` si no empieza como suelen las de ese proveedor (avisa, no bloquea: D13).
 */
export function formaClave(proveedor, texto) {
  const t = String(texto ?? '').trim()
  if (!t) return { estado: 'vacia' }
  if (/\s/.test(t)) return { estado: 'espacios' }
  if ([...t].length < LARGO_MINIMO_CLAVE) return { estado: 'corta' }
  const p = proveedorDe(proveedor)
  return { estado: 'ok', clave: t, final: finalDe(t), aviso: p && !t.startsWith(p.prefijo) ? 'prefijo' : null }
}

const AYUDA_CLAVE = 'Va al Administrador de credenciales de Windows. Después solo vas a ver el final.'
const TEXTOS_FORMA = {
  vacia: 'Pegá la clave para guardarla.',
  espacios: 'Tiene espacios en el medio: revisá que esté entera.',
  corta: 'Es muy corta para ser una clave.',
}

/**
 * La ayuda debajo del campo (7.1 y 7.5) según `error`: null (la de siempre), `vacia`/`espacios`/
 * `corta` (rojo, el campo inválido), `prefijo` (ámbar y el botón "Guardar igual") o `{ windows }`
 * (rojo: Windows no dejó guardar). Un error nunca borra lo escrito: eso lo cuida main.js.
 */
export function ayudaClave(proveedor, error) {
  const a = (texto, tono = '', invalida = false, boton = 'Guardar') => ({ texto, tono, invalida, boton })
  if (typeof error === 'string' && Object.hasOwn(TEXTOS_FORMA, error)) return a(TEXTOS_FORMA[error], 'mal', true)
  if (error === 'prefijo') {
    const p = proveedorDe(proveedor)
    return a(`No parece una clave de ${p?.empresa ?? 'ese proveedor'} (suelen empezar con ${p?.prefijo ?? '…'}). Guardala igual si estás seguro.`, 'aviso', false, 'Guardar igual')
  }
  if (error?.windows) return a(`Windows no dejó guardar la clave (${error.windows}).`, 'mal')
  return a(AYUDA_CLAVE)
}

/**
 * El detalle corto de un error de guardar_clave para la pantalla y widget.log: solo el código de
 * Windows ("windows:1312" → "error 1312"). Cualquier otro texto se descarta: podría traer algo de la clave.
 */
export function detalleErrorClave(err) {
  const m = /^windows:(\d{1,10})$/.exec(String(err?.message ?? err ?? ''))
  return m ? `error ${m[1]}` : 'sin detalle'
}

/**
 * La lectura de `claves_estado` (`[{ proveedor, guardada, final }]`) por proveedor, con el final
 * recortado a 4 aunque Rust mandara más. Lo que no es una lista es null ("Revisando…").
 */
export function clavesDesdeLectura(lista) {
  if (!Array.isArray(lista)) return null
  const claves = {}
  for (const c of lista) {
    if (!proveedorDe(c?.proveedor)) continue
    claves[c.proveedor] = { guardada: c.guardada === true, final: c.guardada === true ? finalDe(c.final) : '' }
  }
  return claves
}

/** Lo que devuelve `probar_clave` (`{ resultado, estado? }`) para la fila: valida, rechazada, sin-red u otro. */
export function resultadoPrueba(r) {
  const estado = ['valida', 'rechazada', 'sin-red'].includes(r?.resultado) ? r.resultado : 'otro'
  return { estado, codigo: estado === 'otro' && Number.isInteger(r?.estado) ? r.estado : null }
}

/** El anuncio (`role=status`, 5) de una prueba. */
export function anuncioPrueba(proveedor, prueba) {
  const empresa = proveedorDe(proveedor)?.empresa ?? ''
  switch (prueba?.estado) {
    case 'valida': return `La clave de ${proveedorDe(proveedor)?.nombre ?? ''} es válida`
    case 'rechazada': return `${empresa} rechazó la clave`
    case 'sin-red': return 'No se pudo probar: sin conexión'
    default: return prueba?.codigo ? `No se pudo probar: ${empresa} respondió ${prueba.codigo}` : 'No se pudo probar'
  }
}

/** El anuncio al guardar (5). */
export function anuncioGuardada(proveedor) {
  return `Clave de ${proveedorDe(proveedor)?.nombre ?? ''} guardada en Credenciales de Windows`
}
export const ANUNCIO_CLAVE_BORRADA = 'Clave borrada de Credenciales de Windows'

/**
 * La fila de una clave (7.1). `lectura`: `{ guardada, final }` de `clavesDesdeLectura`, o nada
 * todavía ("Revisando…", 7.5); `prueba`: lo último de "Probar" (`{ estado, codigo }`); `editando`: el
 * campo abierto, con `ver` y `error` (los de `ayudaClave`); `armado`: "¿Borrar la clave? Sí". Devuelve
 * `{ estado, tono, linea, titulo?, mascara, acciones }`; la máscara son 4 puntos y el final de 4, nunca más.
 */
export function textoClave(proveedor, { lectura = null, prueba = null, editando = false, armado = false, ver = false, error = null } = {}) {
  const p = proveedorDe(proveedor)
  const empresa = p?.empresa ?? ''
  const t = (estado, tono, linea, mascara, acciones, extra = {}) => ({ estado, tono, linea, ...extra, mascara, acciones })
  if (editando) {
    const ayuda = ayudaClave(proveedor, error)
    return { ...t('editando', '', '', null, [{ id: 'guardar', texto: ayuda.boton }, { id: 'cancelar', texto: 'Cancelar' }]), ver: !!ver, ayuda }
  }
  if (!lectura) return t('revisando', 'nada', 'Revisando…', null, [])
  if (!lectura.guardada) return t('sin', '', 'Sin clave', null, [{ id: 'agregar', texto: '+ Agregar clave' }])
  const fin = finalDe(lectura.final)
  const mascara = { texto: `••••${fin}`, oculto: `termina en ${fin}` }
  const probar = { id: 'probar', texto: 'Probar' }
  const reemplazar = { id: 'reemplazar', texto: 'Reemplazar' }
  const borrar = { id: 'borrar', texto: 'Borrar', pregunta: '¿Borrar la clave? Sí', armado: !!armado }
  switch (prueba?.estado) {
    case 'probando': return t('probando', 'proc', `Probando con ${empresa}…`, mascara, [{ ...probar, deshabilitado: true }, reemplazar, borrar])
    case 'valida': return t('valida', 'ok', '✓ Válida · probada recién', mascara, [reemplazar, borrar])
    case 'rechazada': return t('rechazada', 'mal', `× ${empresa} la rechazó`, mascara, [reemplazar, borrar])
    case 'sin-red': return t('sin-red', 'aviso', 'No se pudo probar: sin conexión', mascara, [probar, reemplazar, borrar])
    case 'otro': {
      const titulo = prueba.codigo ? `${empresa} respondió ${prueba.codigo}` : `${empresa} no respondió como se esperaba`
      return t('otro', 'aviso', prueba.codigo ? `No se pudo probar · respondió ${prueba.codigo}` : 'No se pudo probar', mascara, [probar, reemplazar, borrar], { titulo })
    }
    default: return t('guardada', '', 'Guardada', mascara, [probar, reemplazar, borrar])
  }
}

/** Abre el campo de la clave de `proveedor` (vacío, nunca precargado): sin "Mostrar", sin error y desarmado. */
export function empezarClave(config, proveedor) {
  if (!proveedorDe(proveedor)) return config
  return { ...config, editando: proveedor, ver: false, errorClave: null, armado: null, error: null }
}

/** Acoplada, el panel no se pliega mientras el campo de una clave está abierto (4.1). */
export function retieneConfig(config) {
  return !!(config?.abierta && config.editando)
}

/** Con el tablero más bajo que esto (px CSS), la hoja compacta su encabezado (16, M4). */
export const ALTO_MARCO_BAJO = 520

/** ¿El tablero es bajo? `alto` en px CSS (sin escala), el de `d.local.tablero`. */
export const marcoBajo = alto => Number(alto) < ALTO_MARCO_BAJO
