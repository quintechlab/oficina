// Ventana del widget: lee las sesiones locales cada 1,5 s y el equipo cada 60 s, y pinta el
// tablero (barra de proyectos, encabezado, cuadros, sesiones y equipo), la tarjeta de pregunta, la tira mini,
// la bandeja y los avisos. Cada parte se redibuja solo si cambió lo que muestra, para no cortar
// las animaciones.

import { agruparPorProyecto, preguntasPendientes, preguntasNuevas, resumenMini, escapar } from './logica.js'
import { companeros } from './equipo.js'
import { iconoBandeja, textoInsignia } from './bandeja.js'
import { zoomDe, direccionDeTecla, tamanoDeseado, debeAjustar, fueraDeLugar, posicionEnPantalla, tamanoMini, medidaVentana, PASO_POR_DEFECTO } from './tamano.js'
import { textoRespondido, estadoEnvio, objetivoDelClic, registrarEleccion, alternarSeleccion, motivoRechazo, lineaClic } from './responder.js'
import {
  prepararProyecto, firmaTablero, sesiones, carasMini, companero, firmaCompanero,
  barraProyectos, animoMarca, estadoMarca, figuraMarca, figuraVacio, conteos, cuadros, lineaEncabezado,
} from './tablero.js'
import { globo, avisoOtroProyecto, quienPregunta, anuncioPregunta } from './pregunta.js'
import { defsAvis } from './avis.js'
import { entrada, cambioProyecto } from './tableroMotion.js'
import {
  esHorizontal, bordeCercano, lugarDe, lugarAjustado, disposicionAcoplada, zonaInteractiva, recorte, cajaArrastre,
  posicionFlotante, dentroDe, estadoMuesca, contenidoMuesca, contenidoPildora, ESTADO_INICIAL, siguiente, tocaGolpe, PILDORA,
  eventoZona, planVentana,
} from './muesca.js'
import * as movimientoMuesca from './muescaMotion.js'

const INTERVALO_MS = 1500
const INTERVALO_EQUIPO_MS = 60000
const tauri = window.__TAURI__
const $ = s => document.querySelector(s)
const invocar = (comando, args) => tauri.core.invoke(comando, args)

/** Una línea en ~/.claude/oficina/widget.log (diagnóstico). Nunca rompe nada. */
function registrar(linea) {
  if (!tauri?.core) return
  invocar('registrar', { linea: String(linea) }).catch(() => {})
}

// Errores del frontend que de otro modo se pierden en silencio (los manejadores son async)
window.addEventListener('error', e => registrar(`error: ${e.message} @ ${String(e.filename).split('/').pop()}:${e.lineno}`))
window.addEventListener('unhandledrejection', e => registrar(`error: promesa rechazada: ${e.reason?.message ?? e.reason}`))

const st = {
  sesiones: [],
  proyectos: [],
  /** Proyecto elegido, por repositorio: si aparece uno nuevo, la selección no salta. */
  repo: undefined,
  /** Pestaña elegida de la tarjeta de pregunta. */
  activa: 0,
  /** Marcas del menú de la bandeja. */
  arriba: true,
  avisar: true,
  pausa: false,
  mini: false,
  /** La ventana está escondida en la bandeja o minimizada: los Avis se pausan (6.5). */
  fuera: false,
  /** Ya entró escalonado el tablero desde que se mostró la ventana (6.1). */
  revelado: false,
  /** Tamaño en porcentaje del original: 100, 125, 150, 175 o 200. */
  tamano: PASO_POR_DEFECTO,
  firmas: {},
  error: null,
  actualizado: null,
  /** Ids de preguntas ya vistas: cada una se avisa una sola vez. */
  avisadas: new Set(),
  primeraLectura: true,
  equipo: { lista: [], error: null, leido: false },
  /** Compañeros con la habitación desplegada, por usuario. */
  abiertos: new Set(),
  bandeja: null,
  // ---- globo que responde (#4). Solo lo que el usuario toca se envía; nada se elige solo.
  /** Respuestas ya elegidas de cada llamada (por id de pregunta), mientras faltan otras. */
  borradores: {},
  /** Opciones marcadas en la pregunta activa de selección múltiple. */
  seleccion: new Set(),
  /** Ítem (clave) en el que se marcó la selección múltiple. */
  seleccionDe: null,
  /** Tras pasar a la pregunta siguiente de una llamada, los clics se ignoran hasta acá (doble clic). */
  bloqueoHasta: 0,
  otra: false,
  textoOtra: '',
  plegado: false,
  /** Envíos en curso o que no se tomaron, por id de pregunta. */
  envios: {},
  /** Preguntas que la sesión ya tomó: no se vuelven a mostrar aunque la publicación tarde. */
  respondidas: new Set(),
  /** Mensaje de "Listo, le respondiste…" mientras el globo se achica. */
  hecho: null,
  saliendo: false,
  // ---- muesca acoplable (dirección, sección 7)
  /** Borde y lugar de la muesca acoplada (7.5); `null`: flota. */
  acople: null,
  /** Abrir y cerrar la muesca: estado de `siguiente` (muesca.js). */
  muesca: ESTADO_INICIAL,
  /** Lo que se ve: el panel abierto (true) o la muesca. Va detrás de `muesca.abierta` mientras anima. */
  vista: false,
  /** Abriendo o cerrando: el ajuste de la ventana al contenido espera (9.2). */
  animando: false,
  /** Arrastre propio en curso (9.3). */
  arrastre: null,
  /** Golpe de la pregunta: claves ya vistas y hora del último (6.4). */
  golpe: { vistas: new Set(), ultimo: null },
  /** Rectángulo de la ventana acoplada (px de pantalla) y última posición flotante. */
  ventana: null,
  ultimaFlotante: null,
  /** Última disposición acoplada (`disposicionAcoplada`): ventana fija, muesca y panel (9.6). */
  disp: null,
  /** Borde con el que se colocó esa disposición: otro borde cambia la forma de adentro (velo). */
  dispBorde: null,
  /** El puntero en la zona interactiva, según el sondeo de Rust (`oficina://puntero-zona`, 9.6). */
  dentroZona: false,
  /** Número del último aviso del sondeo: uno más viejo se descarta. */
  zonaN: -1,
  /** Última zona mandada a Rust, para no repetirla. */
  zonaEnviada: null,
  /** Foco que hay que dar cuando termine la animación: 'proyecto' o 'muesca'. */
  focoPendiente: null,
}

/** Pone el HTML solo si cambió su firma (por defecto, el propio HTML). */
function poner(sel, html, firma = html) {
  if (st.firmas[sel] === firma) return false
  st.firmas[sel] = firma
  $(sel).innerHTML = html
  return true
}

const insignia = n => n ? `<span class="pend" aria-label="${n} ${n === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}">${n} ?</span>` : ''

/** Pone un texto solo si cambió (así no se pisa una selección ni se relee el lector de pantalla). */
function texto(sel, valor) {
  const el = $(sel)
  if (el.textContent !== valor) el.textContent = valor
}

/** Vacío, cargando o tablero: el marco cambia de forma (dirección 4.6). */
function modoMarco(modo) {
  const marco = $('#marco')
  marco.classList.toggle('vacio', modo === 'vacio')
  marco.classList.toggle('cargando', modo === 'cargando')
  $('#vacio-avi').hidden = modo === 'tablero'
}

function pintarPie() {
  const pie = $('#pie')
  pie.classList.toggle('error', !!st.error)
  if (st.error) { pie.textContent = st.error; return }
  const hora = st.actualizado ? st.actualizado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
  pie.textContent = `actualizado ${hora} · cada 1,5 s`
}

/** Tira mini: caras, resumen y cuenta de preguntas. */
function pintarTira(ahora) {
  const r = resumenMini(st.proyectos, ahora)
  poner('#tira-caras', carasMini(r.caras), r.caras.map(c => `${c.nombre}:${c.animo}`).join(','))
  poner('#tira-resumen', `<b>${escapar(r.titulo)}</b><span class="dim">${escapar(r.detalle)}</span>`)
  poner('#tira-pend', insignia(r.pendientes))
}

/** Ícono y texto de la bandeja: se mandan a Tauri solo cuando cambia la cuenta. */
function pintarBandeja(pendientes) {
  const clave = textoInsignia(pendientes)
  if (st.bandeja === clave || !tauri?.core) return
  st.bandeja = clave
  const ic = iconoBandeja(pendientes)
  const texto = pendientes ? `Oficina · ${pendientes} ${pendientes === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}` : 'Oficina'
  invocar('poner_bandeja', { rgba: Array.from(ic.rgba), ancho: ic.ancho, alto: ic.alto, texto }).catch(() => { st.bandeja = null })
}

function pintarEquipo(ahora) {
  const { lista: gente, error } = st.equipo
  const minuto = Math.floor(ahora / 60000)
  const html = []
  const firmas = []
  for (const c of gente) {
    firmas.push(firmaCompanero(c, ahora))
  }
  const firma = `${firmas.join('/')}|${error}|${minuto}`
  if (st.firmas['#equipo'] === firma) return
  for (const c of gente) html.push(companero(c, ahora, st.abiertos.has(c.usuario)))
  // Un problema con gh queda en una línea tranquila; la ventana sigue funcionando
  if (error) html.push(`<p class="compa-aviso" title="${escapar(error)}">Equipo sin datos: ${escapar(error)}</p>`)
  poner('#equipo', html.join(''), firma)
}

/**
 * La muesca (7.1): el Avi que asoma, el punto y el chip, su nombre accesible y la luz de
 * pregunta. Acoplada, revisa si toca el golpe (6.4).
 */
function pintarMuesca(ahora) {
  const e = estadoMuesca(st.proyectos, ahora)
  const firma = `${e.animo}|${e.punto}|${e.chip}`
  poner('#muesca', contenidoMuesca(e), firma)
  poner('#pildora', contenidoPildora(e), firma)
  const boton = $('#muesca')
  if (boton.getAttribute('aria-label') !== e.nombre) boton.setAttribute('aria-label', e.nombre)
  document.body.classList.toggle('pregunta', e.pregunta)
  if (st.acople) revisarGolpe(ahora)
}

/**
 * Golpe al llegar una pregunta y cada 90 s mientras siga y la muesca esté cerrada. Solo llama la
 * atención: nunca abre la muesca, no mueve el foco ni responde (sección 11).
 */
function revisarGolpe(ahora) {
  if (st.arrastre || st.animando) return
  const claves = st.proyectos.flatMap(p => pendientesVisibles(p).map(q => q.clave))
  const nueva = claves.some(c => !st.golpe.vistas.has(c))
  st.golpe.vistas = new Set(claves)
  if (!claves.length) { st.golpe.ultimo = null; return }
  if (tocaGolpe({ pendientes: claves.length, nueva, abierta: st.muesca.abierta || st.vista, ultimo: st.golpe.ultimo, ahora })) {
    st.golpe.ultimo = ahora
    movimientoMuesca.golpe()
  }
}

function pintar() {
  const ahora = Date.now()
  const totalPend = st.proyectos.reduce((n, p) => n + preguntasPendientes(p).length, 0)
  const marca = animoMarca(st.proyectos, ahora)
  poner('#marca-avi', figuraMarca(marca), marca)
  texto('#marca-estado', estadoMarca(st.proyectos.reduce((n, p) => n + p.sesiones.length, 0)))
  pintarBandeja(totalPend)
  pintarTira(ahora)
  pintarPie()
  pintarEquipo(ahora)
  pintarMuesca(ahora)

  if (!st.proyectos.length) {
    // Antes de la primera lectura: "Buscando sesiones…"; después, el vacío
    const cargando = !st.actualizado && !st.error
    modoMarco(cargando ? 'cargando' : 'vacio')
    poner('#vacio-avi', figuraVacio(cargando ? 'esperando' : 'durmiendo'), cargando ? 'cargando' : 'vacio')
    texto('#titulo', cargando ? 'Buscando sesiones…' : 'No hay sesiones de Claude Code abiertas.')
    texto('#subtitulo', cargando ? '' : 'Cuando abras una, aparece acá con sus subagentes.')
    poner('#proyectos', ''); poner('#otro', ''); poner('#w-globo', ''); poner('#cuadros', ''); poner('#sesiones', '')
    return
  }
  modoMarco('tablero')

  let i = st.proyectos.findIndex(p => p.repo === st.repo)
  if (i < 0) { i = 0; st.repo = st.proyectos[0].repo }
  const proyecto = st.proyectos[i]
  const enfocado = document.activeElement?.closest?.('#proyectos [data-proy]')
  if (poner('#proyectos', barraProyectos(st.proyectos, i)) && enfocado) {
    // El redibujo no se lleva el foco: queda en el proyecto que lo tenía
    $(`#proyectos [data-proy="${enfocado.dataset.proy}"]`)?.focus()
  }
  poner('#otro', avisoOtroProyecto(st.proyectos, i))

  const preparadas = prepararProyecto(proyecto, ahora)
  const c = conteos(preparadas, ahora)
  texto('#titulo', proyecto.nombre)
  $('#titulo').title = proyecto.repo ?? proyecto.nombre
  texto('#subtitulo', lineaEncabezado(preparadas, c))
  poner('#cuadros', cuadros(c))
  poner('#sesiones', sesiones(preparadas, ahora), `${proyecto.repo}/${firmaTablero(preparadas)}|${Math.floor(ahora / 60000)}`)

  const pend = pendientesVisibles(proyecto)
  if (st.activa >= pend.length) st.activa = 0
  const ui = {
    borradores: st.borradores, seleccion: st.seleccion, seleccionDe: st.seleccionDe, otra: st.otra, textoOtra: st.textoOtra,
    envios: st.envios, plegado: st.plegado, hecho: st.hecho, saliendo: st.saliendo,
  }
  const firmaGlobo = JSON.stringify([
    proyecto.repo, st.activa, pend.map(q => [q.clave, q.quien, q.item, q.responde]), Math.floor(ahora / 60000),
    st.borradores, [...st.seleccion], st.otra, st.envios, st.plegado, st.hecho?.mensaje, st.saliendo,
  ])
  const claves = pend.map(q => q.clave).join(',')
  const nuevo = st.firmas.clavesGlobo !== claves
  const visible = pend[st.activa]
  const huellaGlobo = visible ? `${visible.clave}|${visible.responde}` : ''
  if (visible && st.ultimoGloboLog !== huellaGlobo) {
    st.ultimoGloboLog = huellaGlobo
    registrar(`globo pregunta=${visible.pregunta?.id} item=${visible.indice} modo=${visible.responde ? 'interactivo' : 'solo-lectura'} sesion=${visible.sesion} items=${visible.pregunta?.items?.length ?? 1}`)
  }
  const escribiendo = document.activeElement?.id === 'g-otra-in'
  if (poner('#w-globo', globo(pend, { activa: st.activa, nuevo, ahoraMs: ahora, ui }), firmaGlobo)) {
    st.firmas.clavesGlobo = claves
    if (escribiendo) enfocarOtra()
  }

  // La primera vez que se ve el tablero desde que se mostró la ventana, entra escalonado (6.1).
  // Acoplada y cerrada no se ve: entra al abrir la muesca
  if (!st.revelado && !st.fuera && !st.mini && !(st.acople && !st.vista)) {
    st.revelado = true
    entrada()
  }
}

/**
 * Va a otro proyecto: solo la columna principal entra desde el lado de `direccion` (6.2). El
 * tablero no cambia de tamaño (alto fijo, 9.2) y la columna vuelve arriba.
 */
function irAProyecto(repo, direccion) {
  if (repo === st.repo) return
  st.repo = repo
  st.activa = 0
  pintar()
  $('.principal').scrollTop = 0
  cambioProyecto(direccion)
}

/**
 * Escondida en la bandeja o minimizada, los bucles de los Avis se pausan (6.5). Al volver a
 * verse, el tablero entra escalonado otra vez.
 */
function ponerFuera(fuera) {
  if (st.fuera === fuera) return
  st.fuera = fuera
  document.body.classList.toggle('fuera', fuera)
  if (fuera) st.revelado = false
  else pintar()
}

/** ¿La ventana está escondida en la bandeja o minimizada? */
async function fueraDeVista() {
  if (document.hidden) return true
  try {
    const v = tauri.window.getCurrentWindow()
    return !(await v.isVisible()) || (await v.isMinimized())
  } catch {
    return false
  }
}

/**
 * Avisa con una notificación de Windows cada pregunta nueva, si la ventana no está a la vista
 * y "Avisarme con cada pregunta" está marcado. Las que ya estaban al abrir el widget no se avisan.
 * El lector de pantalla la oye una sola vez por la región en vivo (dirección 8); el foco no se mueve.
 */
async function avisarNuevas() {
  const nuevas = preguntasNuevas(st.sesiones, st.avisadas)
  for (const q of nuevas) st.avisadas.add(q.id)
  if (st.primeraLectura) { st.primeraLectura = false; return }
  if (nuevas.length) $('#anuncio').textContent = anuncioPregunta(nuevas, st.sesiones)
  if (!nuevas.length || !st.avisar || !(await fueraDeVista())) return
  for (const q of nuevas) {
    invocar('avisar', { titulo: `${q.quien} te pregunta`, cuerpo: q.pregunta }).catch(() => {})
  }
}

async function leer() {
  if (!tauri?.core) {
    st.error = 'Sin conexión con Tauri: el widget se abre con npm run dev dentro de widget/.'
    pintar()
    return
  }
  try {
    const sesiones = await invocar('leer_sesiones')
    st.sesiones = Array.isArray(sesiones) ? sesiones : []
    st.proyectos = agruparPorProyecto(st.sesiones)
    st.error = null
    st.actualizado = new Date()
    await avisarNuevas()
    await seguirEnvios()
  } catch (e) {
    st.error = `No se pudieron leer las sesiones: ${e}`
  }
  pintar()
}

// ------------------------------------------------------------------ responder desde el globo

/** Preguntas del proyecto que se muestran: sin las que la sesión ya tomó. */
function pendientesVisibles(proyecto) {
  return preguntasPendientes(proyecto).filter(q => !st.respondidas.has(q.pregunta.id))
}

function reiniciarInteraccion() {
  st.seleccion = new Set()
  st.seleccionDe = null
  st.otra = false
  st.textoOtra = ''
}

/** `{ pregunta, item }` de un elemento dibujado con `data-pregunta` y `data-item`. */
function destinoDe(el) {
  if (!el?.dataset?.pregunta || el.dataset.item === undefined) return null
  return { pregunta: el.dataset.pregunta, item: Number(el.dataset.item) }
}

/** La pregunta a la que apunta el botón tocado, solo si es la del globo que se ve y sigue pendiente. */
function objetivo(boton) {
  const proyecto = st.proyectos.find(p => p.repo === st.repo)
  const pend = proyecto ? pendientesVisibles(proyecto) : []
  const destino = destinoDe(boton), mostrado = destinoDe($('[data-globo]'))
  const motivo = motivoRechazo(pend, destino, mostrado)
  if (motivo) registrar(lineaClic({ pregunta: destino?.pregunta, item: destino?.item, decision: 'rechazado', motivo }))
  return objetivoDelClic(pend, destino, mostrado)
}

function enfocarOtra() {
  const campo = $('#g-otra-in')
  if (!campo) return
  campo.focus()
  campo.setSelectionRange(campo.value.length, campo.value.length)
}

/**
 * Lo que el usuario tocó en el globo. Si con eso la llamada tiene todas sus respuestas, se
 * envía; si no, pasa a la pregunta que falta. Una llamada ya enviada no se vuelve a enviar.
 */
async function elegir(q, eleccion) {
  if (!q) return
  const id = q.pregunta.id
  const r = registrarEleccion({ borradores: st.borradores, envios: st.envios, bloqueoHasta: st.bloqueoHasta }, q, eleccion, Date.now())
  if (r.accion === 'nada') {
    registrar(lineaClic({ pregunta: id, item: q.indice, decision: 'rechazado', motivo: r.motivo }))
    return
  }
  registrar(lineaClic({ pregunta: id, item: q.indice, decision: r.accion, etiqueta: r.respuesta.valor, libre: r.respuesta.libre }))
  st.borradores = r.estado.borradores
  st.bloqueoHasta = r.estado.bloqueoHasta ?? st.bloqueoHasta
  reiniciarInteraccion()
  if (r.accion === 'avanzar') {
    const k = pendientesVisibles(st.proyectos.find(p => p.repo === st.repo)).findIndex(x => x.pregunta.id === id && x.indice === r.falta)
    if (k >= 0) st.activa = k
    pintar()
    return
  }
  const { cuerpo, borrador } = r
  if (!cuerpo) return
  const quien = quienPregunta(q)
  st.envios[id] = {
    estado: 'enviando', desde: Date.now(), texto: textoRespondido(q.pregunta, borrador),
    quien: quien.nombre, pj: quien.pj, color: quien.color,
  }
  pintar()
  try {
    await invocar('responder', { id, answers: cuerpo.answers, libres: cuerpo.libres })
    registrar(`responder ${id} -> ok`)
  } catch (err) {
    registrar(`responder ${id} -> error: ${err}`)
    st.envios[id] = { ...st.envios[id], estado: 'enClaude' }
    pintar()
  }
}

/** El globo festeja, se achica y se va. Solo cambia lo que se ve: no responde nada. */
function mostrarHecho(hecho) {
  st.hecho = hecho
  st.saliendo = false
  pintar()
  setTimeout(() => { st.saliendo = true; pintar() }, 1600)
  setTimeout(() => { st.hecho = null; st.saliendo = false; pintar() }, 1950)
}

/**
 * Sigue cada respuesta enviada: listo cuando la sesión la tomó; si a los 5 s sigue sin tomarla
 * (ganó el diálogo o el mod no corre), se pide responder en Claude y se borra el archivo.
 */
async function seguirEnvios() {
  const vivas = new Set(st.sesiones.flatMap(s => (s.preguntas ?? []).map(p => p.id)))
  for (const id of st.respondidas) if (!vivas.has(id)) st.respondidas.delete(id)
  for (const [id, envio] of Object.entries(st.envios)) {
    if (envio.estado !== 'enviando') {
      if (!vivas.has(id)) delete st.envios[id]
      continue
    }
    const archivo = await invocar('estado_respuesta', { id }).catch(() => 'ausente')
    const estado = estadoEnvio({ archivo, sigue: vivas.has(id), ms: Date.now() - envio.desde })
    if (estado === 'esperando') continue
    registrar(`envio ${id} -> ${estado} (archivo=${archivo})`)
    invocar('borrar_respuesta', { id }).catch(() => {})
    delete st.borradores[id]
    if (estado === 'listo') {
      delete st.envios[id]
      st.respondidas.add(id)
      mostrarHecho({ ...envio, listo: true, mensaje: `Listo, le respondiste a ${envio.quien}: ${envio.texto}` })
    } else if (estado === 'yaRespondida') {
      delete st.envios[id]
      mostrarHecho({ ...envio, listo: false, mensaje: 'Ya se respondió en Claude.' })
    } else {
      st.envios[id] = { ...envio, estado }
    }
  }
}

async function leerEquipo() {
  if (!tauri?.core) return
  try {
    const r = await invocar('leer_equipo')
    st.equipo = { lista: companeros(r.comentarios ?? [], r.yo ?? null, Date.now()), error: r.error ?? null, leido: true }
  } catch (e) {
    st.equipo = { ...st.equipo, error: String(e), leido: true }
  }
  pintar()
}

async function ciclo() {
  await leer()
  ponerFuera(await fueraDeVista())
  // Acoplada, si el área de trabajo o el monitor cambiaron, la ventana fija se recoloca (9.6)
  if (st.acople) programarAjuste()
  setTimeout(ciclo, INTERVALO_MS)
}

async function cicloEquipo() {
  await leerEquipo()
  setTimeout(cicloEquipo, INTERVALO_EQUIPO_MS)
}

function moverProyecto(dir) {
  const n = st.proyectos.length
  if (n < 2) return
  const i = Math.max(0, st.proyectos.findIndex(p => p.repo === st.repo))
  irAProyecto(st.proyectos[(i + dir + n) % n].repo, dir)
}

function ponerArriba(valor) {
  st.arriba = valor
  pintarControles()
}

/**
 * Controles del encabezado según el modo: flotando, el alfiler es "Siempre arriba" y la × esconde
 * en la bandeja; acoplada, el alfiler es "Mantener abierta" y la × pliega a la muesca.
 */
function pintarControles() {
  const pin = $('#marco [data-accion="pin"]')
  const cerrar = $('#marco [data-accion="cerrar"]')
  const textoPin = st.acople ? (st.muesca.fija ? 'Soltar: se pliega sola' : 'Mantener abierta') : 'Siempre arriba'
  pin.setAttribute('aria-pressed', String(st.acople ? st.muesca.fija : st.arriba))
  pin.setAttribute('aria-label', textoPin)
  pin.title = textoPin
  const textoCerrar = st.acople ? 'Plegar a la muesca' : 'Cerrar a la bandeja'
  cerrar.setAttribute('aria-label', textoCerrar)
  cerrar.title = textoCerrar
  $('#muesca').setAttribute('aria-expanded', String(!!st.acople && st.muesca.abierta))
}

function ponerPausa(valor) {
  st.pausa = valor
  document.body.classList.toggle('pausa', valor)
}

async function ponerMini(mini) {
  // La tira mini es solo de la ventana flotante
  if (st.mini === mini || (mini && st.acople)) return
  try {
    if (mini) {
      st.mini = true
      document.body.classList.add('mini')
      $('#tira').hidden = false
      await invocar('modo_mini', { mini: true, ...tamanoMini(zoomDe(st.tamano)) })
    } else {
      await invocar('modo_mini', { mini: false })
      st.mini = false
      document.body.classList.remove('mini')
      $('#tira').hidden = true
      programarAjuste()
      // Al expandir desde la tira, el tablero entra escalonado (6.1)
      st.revelado = false
      pintar()
    }
  } catch (e) {
    st.error = `No se pudo cambiar el tamaño: ${e}`
    pintarPie()
  }
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-accion]')
  if (!b) return
  const a = b.dataset.accion
  if (a === 'ir') {
    // Un proyecto de la barra o el aviso de una pregunta en otro proyecto
    const p = st.proyectos[+b.dataset.proy]
    if (p) irAProyecto(p.repo, 1)
  } else if (a === 'tab') {
    st.activa = +b.dataset.i
    reiniciarInteraccion()
    pintar()
    $(`[data-accion="tab"][data-i="${st.activa}"]`)?.focus()
  } else if (a === 'op') {
    // El destino sale del botón tocado, nunca de la pestaña activa
    const q = objetivo(b)
    const k = +b.dataset.i
    if (!q) return
    if (q.item.multiple) {
      if (st.seleccionDe !== q.clave) { st.seleccion = new Set(); st.seleccionDe = q.clave }
      const antes = st.seleccion
      st.seleccion = alternarSeleccion(st.seleccion, k, Date.now(), st.bloqueoHasta)
      registrar(lineaClic({
        pregunta: q.pregunta.id, item: q.indice,
        decision: st.seleccion === antes ? 'rechazado' : st.seleccion.has(k) ? 'marcar' : 'desmarcar',
        motivo: st.seleccion === antes ? 'pausa-tras-avanzar' : undefined,
        etiqueta: st.seleccion === antes ? undefined : q.item.opciones?.[k]?.etiqueta,
      }))
      pintar()
      $(`[data-accion="op"][data-i="${k}"]`)?.focus()
    } else {
      await elegir(q, { opcion: k })
    }
  } else if (a === 'enviar-multi') {
    const q = objetivo(b)
    if (q && st.seleccionDe === q.clave) await elegir(q, { opciones: [...st.seleccion] })
  } else if (a === 'otra') {
    st.otra = true
    pintar()
    enfocarOtra()
  } else if (a === 'enviar-otra') {
    await elegir(objetivo(b), { texto: $('#g-otra-in')?.value ?? '' })
  } else if (a === 'tarde') {
    st.plegado = true
    pintar()
    $('[data-accion="ver"]')?.focus()
  } else if (a === 'ver') {
    st.plegado = false
    st.firmas.clavesGlobo = null
    pintar()
  } else if (a === 'pin' && st.acople) {
    // Acoplada, el alfiler mantiene abierto el panel
    evento({ tipo: 'fijar' })
  } else if (a === 'cerrar' && st.acople && b.closest('#marco')) {
    evento({ tipo: 'cerrar' })
  } else if (a === 'pin') {
    const nuevo = !st.arriba
    try {
      await invocar('fijar_arriba', { valor: nuevo })
      ponerArriba(nuevo)
    } catch (err) { st.error = `No se pudo fijar la ventana: ${err}`; pintarPie() }
  } else if (a === 'mini') {
    await ponerMini(true)
  } else if (a === 'expandir') {
    await ponerMini(false)
  } else if (a === 'cerrar') {
    // La × esconde en la bandeja; "Salir" del menú de la bandeja cierra la aplicación
    await invocar('esconder').catch(() => {})
  }
})

// Recordar qué habitaciones de compañeros quedaron desplegadas
document.addEventListener('toggle', e => {
  const d = e.target
  if (!(d instanceof HTMLDetailsElement) || !d.dataset.usuario) return
  if (d.open) st.abiertos.add(d.dataset.usuario)
  else st.abiertos.delete(d.dataset.usuario)
}, true)

// El texto de "Otra respuesta" se guarda mientras se escribe, así un redibujo no lo borra
document.addEventListener('input', e => {
  if (e.target.id === 'g-otra-in') st.textoOtra = e.target.value
})

document.addEventListener('keydown', e => {
  // Teclas del globo (boceto): 1–9 eligen con el foco en el globo, Enter envía el texto, Esc pliega
  if (e.target.id === 'g-otra-in' && e.key === 'Enter') { e.preventDefault(); $('[data-accion="enviar-otra"]')?.click(); return }
  if (e.target.closest?.('[data-globo]') && e.target.tagName !== 'INPUT') {
    const k = Number(e.key)
    if (Number.isInteger(k) && k >= 1) {
      const boton = $(`[data-accion="op"][data-i="${k - 1}"]`)
      if (boton) { e.preventDefault(); boton.click(); return }
    }
    if (e.key === 'Escape') { st.plegado = true; pintar(); $('[data-accion="ver"]')?.focus(); return }
  }
  // Fuera de la pregunta, Esc cierra la muesca aunque esté fijada y devuelve el foco a la muesca (7.2)
  if (e.key === 'Escape' && st.acople && st.muesca.abierta) { e.preventDefault(); evento({ tipo: 'esc' }); return }
  if (st.mini || e.target.closest?.('input, textarea, summary')) return
  // ↑ ↓ mueven el foco entre los proyectos de la barra (no cambian de proyecto)
  const fila = e.target.closest?.('#proyectos [data-proy]')
  if (fila && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const filas = [...document.querySelectorAll('#proyectos [data-proy]')]
    filas[(filas.indexOf(fila) + (e.key === 'ArrowDown' ? 1 : -1) + filas.length) % filas.length].focus()
    return
  }
  if (e.key === 'ArrowLeft') { e.preventDefault(); moverProyecto(-1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); moverProyecto(1) }
})

// ------------------------------------------------------------------ tamaño de la ventana

/**
 * Tamaño elegido (Ctrl + / Ctrl − o el submenú "Tamaño"): todo, dibujo y texto, crece con el
 * mismo zoom. Después la ventana se ajusta al contenido.
 */
async function aplicarTamano(porcentaje) {
  // Acoplada, otro zoom redimensiona la ventana fija: se vela ya, antes de que el contenido cambie
  // de tamaño adentro; colocarAcoplada lo levanta cuando la ventana quedó en su tamaño nuevo
  if (st.acople && !st.mini && zoomDe(porcentaje) !== zoomDe(st.tamano)) movimientoMuesca.velar()
  st.tamano = porcentaje
  document.documentElement.style.zoom = String(zoomDe(porcentaje))
  if (st.mini) await invocar('modo_mini', { mini: true, ...tamanoMini(zoomDe(porcentaje)) }).catch(() => {})
  programarAjuste()
}

// Ctrl + / Ctrl − / Ctrl 0 con la ventana enfocada: el paso lo decide y lo guarda la app
document.addEventListener('keydown', e => {
  const direccion = direccionDeTecla(e)
  if (direccion === null || !tauri?.core) return
  e.preventDefault()
  invocar('cambiar_tamano', { direccion }).catch(() => {})
})

/**
 * Tamaño del tablero en px de la ventana (ya con el zoom aplicado), con el margen transparente del
 * body para la sombra (dirección 9.5). El ancho es el de #contenido más el relleno del área que
 * desplaza, su barra y el borde de #marco. El alto del tablero es fijo (`--alto-tablero`, 9.2): no
 * cambia de un proyecto a otro. En el vacío y la carga el alto sigue al contenido.
 */
function medirContenido() {
  const marco = $('#marco'), cuerpo = $('#cuerpo'), contenido = $('#contenido')
  const rMarco = marco.getBoundingClientRect(), rContenido = contenido.getBoundingClientRect()
  // Relación entre px de la ventana y px del documento (el zoom), medida y no supuesta
  const f = marco.offsetWidth ? rMarco.width / marco.offsetWidth : 1
  const suma = (el, a, b) => { const cs = getComputedStyle(el); return parseFloat(cs[a]) + parseFloat(cs[b]) }
  const barra = cuerpo.offsetWidth - cuerpo.clientWidth
  const compacto = marco.classList.contains('vacio') || marco.classList.contains('cargando')
  const fijo = parseFloat(getComputedStyle(marco).getPropertyValue('--alto-tablero'))
  return medidaVentana({
    contenido: { ancho: rContenido.width, alto: rContenido.height },
    extras: {
      ancho: suma(cuerpo, 'paddingLeft', 'paddingRight') + barra + suma(marco, 'borderLeftWidth', 'borderRightWidth') + suma(document.body, 'paddingLeft', 'paddingRight'),
      alto: suma(cuerpo, 'paddingTop', 'paddingBottom') + suma(marco, 'borderTopWidth', 'borderBottomWidth') + suma(document.body, 'paddingTop', 'paddingBottom'),
    },
    f,
    altoTablero: compacto || !Number.isFinite(fijo) ? null : fijo,
    margen: suma(document.body, 'paddingTop', 'paddingBottom'),
  })
}

let esperaAjuste = null
/** Junta los cambios seguidos (100 ms) y ajusta una sola vez. */
function programarAjuste() {
  clearTimeout(esperaAjuste)
  esperaAjuste = setTimeout(ajustarVentana, 100)
}

async function ajustarVentana() {
  // Mientras la muesca abre, cierra o se arrastra, el tamaño ya está fijado (9.2)
  if (st.mini || !tauri?.core || st.animando || st.arrastre) return
  try {
    const g = await invocar('geometria')
    if (st.acople) { await colocarAcoplada(g); return }
    const deseado = tamanoDeseado(medirContenido(), g.area)
    if (!debeAjustar({ ancho: g.ancho, alto: g.alto }, deseado)) return
    const pos = posicionEnPantalla({ x: g.x, y: g.y }, deseado, g.area)
    await invocar('ajustar_ventana', { ...deseado, ...pos })
  } catch (e) {
    registrar(`tamaño: ${e}`)
  }
}

// Escondida o minimizada (si el WebView lo informa): pausa al instante, sin esperar la lectura
document.addEventListener('visibilitychange', () => ponerFuera(document.hidden))

// El contenido cambia (otro proyecto, globo, compañero desplegado, tamaño elegido): la ventana lo
// sigue. Acoplada, también el chip de la muesca ("4" o "1 ?")
const observador = new ResizeObserver(() => programarAjuste())
observador.observe($('#contenido'))
observador.observe($('#muesca'))

// ------------------------------------------------------------------ muesca acoplable (sección 7)

const zoom = () => zoomDe(st.tamano)
const MUESCA_DE_REFERENCIA = { largo: 120, grosor: 40 }

/** Tamaño de la muesca en px de pantalla: `largo` a lo largo del borde y `grosor` hacia el centro. */
function tamMuesca() {
  const m = $('#muesca')
  const ancho = m.offsetWidth * zoom(), alto = m.offsetHeight * zoom()
  if (!ancho || !alto) return MUESCA_DE_REFERENCIA
  return esHorizontal(st.acople.borde) ? { largo: ancho, grosor: alto } : { largo: alto, grosor: ancho }
}

/** Largo del área de trabajo a lo largo de un borde. */
const largoDe = (borde, area) => esHorizontal(borde) ? area.ancho : area.alto

/** Disposición acoplada con el área de trabajo `area`: ventana fija, muesca y panel (9.6). */
function disposicion(area, tablero = medirContenido()) {
  return disposicionAcoplada(st.acople, tamMuesca(), tablero, area, zoom())
}

/**
 * Ubica adentro de la ventana fija la muesca, su luz y el tablero (`d.local`, px CSS). Abierta o
 * cerrada es lo mismo: lo que cambia es el recorte y la clase `abierta`.
 */
function colocar(d) {
  const cuerpo = document.body.style
  const poner = (prefijo, c, conTamano = true) => {
    cuerpo.setProperty(`--${prefijo}x`, `${c.x}px`)
    cuerpo.setProperty(`--${prefijo}y`, `${c.y}px`)
    if (conTamano) { cuerpo.setProperty(`--${prefijo}w`, `${c.ancho}px`); cuerpo.setProperty(`--${prefijo}h`, `${c.alto}px`) }
  }
  poner('m', d.local.muesca, false)
  poner('l', d.local.luz)
  poner('t', d.local.tablero)
  st.disp = d
  st.dispBorde = st.acople.borde
  st.ventana = { ...d.ventana }
}

/**
 * Coloca la ventana acoplada (9.6): una sola vez al acoplar, al cambiar de borde, de lugar, de
 * tamaño elegido, de contenido o de área de trabajo. Abrir y cerrar no la tocan. Si cambia de
 * tamaño o de forma (`planVentana`), lo que se ve se vela antes y vuelve cuando WebView2 ya pintó.
 */
async function colocarAcoplada(g) {
  const d = disposicion(g.area)
  const plan = planVentana(g, d.ventana, { cambiaForma: st.dispBorde !== st.acople.borde })
  const turno = plan === 'velar' ? movimientoMuesca.velar() : undefined
  colocar(d)
  try {
    if (plan !== 'nada') await invocar('ajustar_ventana', { ...d.ventana })
  } finally {
    // También levanta el velo que puso otro antes (el del zoom o el del acople nuevo)
    if (movimientoMuesca.velada()) movimientoMuesca.revelar(turno)
  }
  await enviarZona()
}

/**
 * Le dice a Rust qué parte de la ventana fija toma el mouse (`zonaInteractiva`): fuera de ella los
 * clics pasan a lo que hay debajo. Devuelve si el puntero está adentro ahora (null sin respuesta).
 * Sin `forzar`, una zona igual a la última no se manda.
 */
async function enviarZona(forzar = false) {
  if (!st.acople || !st.disp || !tauri?.core) return null
  const zona = zonaInteractiva(st.disp, { abierta: st.vista, arrastrando: !!st.arrastre?.activo }, zoom())
  const clave = `${zona.x},${zona.y},${zona.ancho},${zona.alto},${zona.toda}`
  if (!forzar && clave === st.zonaEnviada) return null
  st.zonaEnviada = clave
  try {
    return await invocar('zona_interactiva', zona)
  } catch (e) {
    st.zonaEnviada = null
    registrar(`zona: ${e}`)
    return null
  }
}

/**
 * El puntero entró o salió de la zona interactiva (aviso del sondeo de Rust, o el DOM cuando lo ve
 * antes): el hover abre a los 180 ms y la salida cierra a los 650 ms, salvo fijada (7.2).
 */
function ponerDentro(dentro) {
  st.dentroZona = dentro
  // `st.ventana`: la muesca ya está en su borde (al arrancar, la ventana todavía está en otro lado)
  if (!st.acople || st.arrastre || !st.ventana) return
  // Decide lo que la muesca todavía no sabe: Rust repite el estado real con cada zona nueva
  const tipo = eventoZona(st.muesca, dentro)
  if (tipo) evento({ tipo })
}

/** Clases y estilos del modo: acoplada a un borde o flotante. Empieza cerrada. */
function aplicarModo() {
  const cuerpo = document.body
  cuerpo.classList.toggle('acoplada', !!st.acople)
  if (st.acople) cuerpo.dataset.borde = st.acople.borde
  else delete cuerpo.dataset.borde
  cuerpo.classList.remove('abierta', 'desplegada', 'abriendo', 'muesca-oculta', 'pildora')
  $('#marco').style.clipPath = ''
  for (const v of ['tx', 'ty', 'tw', 'th', 'mx', 'my', 'lx', 'ly', 'lw', 'lh']) cuerpo.style.removeProperty(`--${v}`)
  st.vista = false
  st.ventana = null
  st.disp = null
  st.dispBorde = null
  st.zonaEnviada = null
  pintarControles()
}

let relojMuesca = null

/**
 * Un evento de la muesca (`siguiente`, muesca.js): programa la espera que pida, anima si cambia
 * abierta o cerrada y deja el foco donde corresponde.
 */
function evento(ev) {
  const antes = st.muesca
  const e = siguiente(antes, ev)
  st.muesca = e
  if (e.espera !== antes.espera) {
    clearTimeout(relojMuesca)
    if (e.espera) {
      const { que, ms } = e.espera
      relojMuesca = setTimeout(() => evento({ tipo: 'tiempo', que }), ms)
    }
  }
  if (e.foco) st.focoPendiente = e.foco
  pintarControles()
  if (e.efecto) sincronizar()
  else aplicarFoco()
}

function aplicarFoco() {
  if (st.animando || !st.focoPendiente) return
  const foco = st.focoPendiente
  st.focoPendiente = null
  if (foco === 'muesca') $('#muesca').focus()
  else ($('#proyectos .pj.activo') ?? $('#proyectos [data-proy]') ?? $('#marco [data-accion="pin"]'))?.focus()
}

/** Lleva lo que se ve (`st.vista`) a lo pedido (`st.muesca.abierta`), una animación por vez. */
async function sincronizar() {
  if (st.animando || !st.acople) return
  st.animando = true
  try {
    while (st.acople && !st.arrastre && st.muesca.abierta !== st.vista) {
      if (st.muesca.abierta) await animarApertura()
      else await animarCierre()
    }
  } catch (e) {
    registrar(`muesca: ${e}`)
  } finally {
    st.animando = false
  }
  aplicarFoco()
  programarAjuste()
}

/** La disposición con el área de ahora y el recorte de la muesca al tablero. */
async function medidasAcople() {
  const g = await invocar('geometria')
  const d = disposicion(g.area)
  return { g, d, rc: recorte(d.m.caja, d.p.tablero, st.acople.borde, zoom()) }
}

/**
 * Abrir (6.4 y 9.6): la ventana ya tiene el tamaño del panel; solo crece el recorte desde la muesca.
 * Sin redimensionar, WebView2 no deja la ventana sin pintar y la isla se ve entera.
 */
async function animarApertura() {
  const { g, d, rc } = await medidasAcople()
  const marco = $('#marco')
  // Red de seguridad: si el área o el contenido cambiaron y nadie recolocó la ventana todavía
  // (el ciclo lo hace cada 1,5 s), se coloca una vez antes de animar
  if (fueraDeLugar(g, d.ventana)) {
    await colocarAcoplada(g)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  }
  marco.style.clipPath = rc.desde
  colocar(d)
  st.vista = true
  // Abierta, la zona que toma el mouse es el tablero entero
  enviarZona()
  document.body.classList.add('abierta', 'abriendo')
  // El movimiento de la apertura es el recorte que crece: el contenido ya está quieto adentro.
  // Una entrada escalonada acá seguía acomodando tarjetas con el panel ya abierto (parpadeos).
  st.revelado = true
  await movimientoMuesca.abrir(marco, rc, $('#contenido'))
  marco.style.clipPath = ''
  document.body.classList.add('desplegada')
  setTimeout(() => document.body.classList.remove('abriendo'), 1600)
}

/** Cerrar (6.4 y 9.6): el recorte vuelve a la muesca; la ventana no cambia. */
async function animarCierre() {
  const { d, rc } = await medidasAcople()
  document.body.classList.remove('desplegada', 'abriendo')
  const soltar = await movimientoMuesca.cerrar($('#marco'), $('#contenido'), rc)
  document.body.classList.remove('abierta')
  st.vista = false
  soltar()
  colocar(d)
  // Recién visto: el próximo golpe, dentro de 90 s si la pregunta sigue
  if (st.golpe.vistas.size) st.golpe.ultimo = Date.now()
  // La zona vuelve a ser la muesca: si el puntero no está en ella, el hover vuelve a abrir (7.2)
  const dentro = await enviarZona(true)
  const fuera = dentro === null ? !st.dentroZona : !dentro
  if (fuera && !st.muesca.abierta) st.muesca = siguiente(st.muesca, { tipo: 'sale' })
}

/**
 * Acopla a `borde` o deja flotando (`null`): desde la bandeja ("Acoplar a"), al soltar el tablero
 * junto a un borde o al soltar la muesca lejos de todos. Guarda el acople (7.5).
 */
async function acoplarA(borde, { lugar, puntero, plegar } = {}) {
  if (!tauri?.core || st.arrastre) return
  if (st.mini) await ponerMini(false)
  clearTimeout(relojMuesca)
  try {
    const g = await invocar('geometria')
    if (borde) {
      if (!st.acople) st.ultimaFlotante = { x: g.x, y: g.y }
      let soltar = () => {}
      if (plegar && !st.acople) soltar = await movimientoMuesca.plegar($('#marco'), pliegueHacia(borde))
      const centro = { x: g.x + g.ancho / 2, y: g.y + g.alto / 2 }
      const l = lugar ?? (st.acople ? st.acople.lugar : lugarDe(borde, centro, g.area))
      st.acople = { borde, lugar: l }
      st.muesca = { ...ESTADO_INICIAL, armado: false }
      // La ventana va a cambiar de forma y de tamaño: velada desde ya; colocarAcoplada la revela
      movimientoMuesca.velar()
      aplicarModo()
      soltar()
      pintar()
      st.acople.lugar = lugarAjustado(l, tamMuesca().largo, largoDe(borde, g.area), zoom())
      await invocar('guardar_acople', { borde, lugar: st.acople.lugar })
      await colocarAcoplada(await invocar('geometria'))
    } else {
      st.acople = null
      st.muesca = ESTADO_INICIAL
      // De la muesca (o la píldora) al tablero flotante: velado hasta que la ventana tenga su tamaño
      const turno = movimientoMuesca.velar()
      aplicarModo()
      await invocar('guardar_acople', { borde: null, lugar: null })
      const g2 = await invocar('geometria')
      const tam = tamanoDeseado(medirContenido(), g2.area)
      const pos = puntero ? posicionFlotante(puntero, tam, g2.area) : posicionEnPantalla(st.ultimaFlotante ?? { x: g2.x, y: g2.y }, tam, g2.area)
      await invocar('ajustar_ventana', { ...tam, ...pos })
      movimientoMuesca.revelar(turno)
      st.revelado = false
      pintar()
    }
  } catch (e) {
    st.error = `No se pudo acoplar: ${e}`
    pintarPie()
  }
}

/** Recorte final del tablero flotante al plegarse hacia `borde`: una muesca en el medio de ese lado. */
function pliegueHacia(borde) {
  const marco = $('#marco')
  const w = marco.offsetWidth, h = marco.offsetHeight
  const { largo, grosor } = MUESCA_DE_REFERENCIA
  const lados = esHorizontal(borde) ? (w - largo) / 2 : (h - largo) / 2
  const fondo = (esHorizontal(borde) ? h : w) - grosor
  const inset = {
    arriba: [0, lados, fondo, lados], abajo: [fondo, lados, 0, lados],
    derecha: [lados, 0, lados, fondo], izquierda: [lados, fondo, lados, 0],
  }[borde]
  return `inset(${inset.map(v => `${Math.max(0, v)}px`).join(' ')} round 22px)`
}

// ---- mouse y teclado sobre la muesca (7.2)

const muescaEl = $('#muesca')
let justoArrastro = false
// Quien manda es el sondeo de Rust (`oficina://puntero-zona`, 9.6): con los clics pasando de largo,
// el WebView no ve salir al puntero. El DOM solo adelanta lo que el sondeo va a decir: la muesca
// (cerrada) o el tablero (abierta) son parte de la zona, y salir de toda la ventana es salir de ella
muescaEl.addEventListener('pointerenter', e => {
  if (e.pointerType === 'mouse' && !st.muesca.abierta) ponerDentro(true)
})
$('#marco').addEventListener('pointerenter', e => {
  if (e.pointerType === 'mouse' && st.muesca.abierta) ponerDentro(true)
})
document.documentElement.addEventListener('pointerleave', e => {
  if (e.pointerType === 'mouse') ponerDentro(false)
})
// Clic, Enter o Espacio: abre y lleva el foco al proyecto activo
muescaEl.addEventListener('click', () => {
  if (justoArrastro || !st.acople) return
  evento({ tipo: 'clic' })
})

// ---- arrastre propio e imán (7.3 y 9.3)

const UMBRAL_ARRASTRE = 4

/**
 * Pide mover o redimensionar la ventana; si hay un pedido en vuelo, gana el último. `turno`: el del
 * velo puesto para este pedido (`velar`); un pedido que reemplaza a otro sin mandar hereda su velo,
 * así nunca queda uno sin revelar.
 */
let destinoVentana = null, enviandoVentana = null
function pedirVentana(r, turno = 0) {
  destinoVentana = { ...r, turno: Math.max(turno, destinoVentana?.turno ?? 0) }
  if (!enviandoVentana) enviandoVentana = enviarVentana()
}
async function enviarVentana() {
  while (destinoVentana) {
    const r = destinoVentana
    destinoVentana = null
    try {
      if (r.ancho) await invocar('ajustar_ventana', { ancho: r.ancho, alto: r.alto, x: r.x, y: r.y })
      else await invocar('mover_ventana', { x: r.x, y: r.y })
    } catch (e) { registrar(`arrastre: ${e}`) }
    // Ya redimensionada: lo velado vuelve cuando se pintó (si no se veló otra vez mientras tanto)
    if (r.turno) movimientoMuesca.revelar(r.turno)
  }
  enviandoVentana = null
}

/** Vela si el pedido que sigue a `st.ventana` la redimensiona o cambia su forma (9.6). Devuelve el turno o 0. */
function velarSiRedimensiona(rect, cambiaForma) {
  return planVentana(st.ventana, rect, { cambiaForma }) === 'velar' ? movimientoMuesca.velar() : 0
}

document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || st.mini || st.arrastre || !tauri?.core) return
  const asa = e.target.closest?.('#muesca, [data-arrastre]')
  if (!asa) return
  // Acoplada (cerrada o abierta) se arrastra la muesca; flotando, el tablero
  const a = { origen: st.acople ? 'muesca' : 'tablero', id: e.pointerId, x0: e.screenX, y0: e.screenY, dx: 0, dy: 0, agarre: { x: e.clientX, y: e.clientY }, activo: false }
  st.arrastre = a
  invocar('geometria', { puntero: true }).then(g => {
    a.inicio = { x: g.x, y: g.y, ancho: g.ancho, alto: g.alto }
    a.area = g.area
    a.libres = g.libres
  }).catch(() => { if (st.arrastre === a) st.arrastre = null })
})

document.addEventListener('pointermove', e => {
  const a = st.arrastre
  if (!a || e.pointerId !== a.id) return
  a.dx = e.screenX - a.x0
  a.dy = e.screenY - a.y0
  if (!a.activo) {
    if (Math.hypot(a.dx, a.dy) <= UMBRAL_ARRASTRE || !a.inicio) return
    empezarArrastre(a, e)
  }
  if (!a.cuadro) a.cuadro = requestAnimationFrame(() => { a.cuadro = 0; moverArrastre(a) })
})

function empezarArrastre(a, e) {
  a.activo = true
  document.body.setPointerCapture?.(e.pointerId)
  document.body.classList.add('arrastrando')
  clearTimeout(relojMuesca)
  if (a.origen === 'muesca') {
    // Abierta, se pliega al instante: lo que se arrastra es la muesca
    st.muesca = { ...ESTADO_INICIAL, armado: false }
    st.vista = false
    document.body.classList.remove('abierta', 'desplegada', 'abriendo', 'muesca-oculta')
    $('#marco').style.clipPath = ''
    pintarControles()
    a.tam = { ancho: PILDORA.ancho * zoom(), alto: PILDORA.alto * zoom() }
    // El tablero se mide una vez: a lo largo del borde la ventana fija solo se mueve (9.6)
    a.tablero = medirContenido()
    // Mientras se arrastra, toda la ventana toma el mouse: el puntero no se pierde a mitad de camino
    enviarZona(true)
  }
}

function moverArrastre(a) {
  const puntero = { x: a.inicio.x + a.agarre.x + a.dx, y: a.inicio.y + a.agarre.y + a.dy }
  a.puntero = puntero
  // Otro monitor bajo el puntero: su área y sus bordes (9.4)
  if (!dentroDe(puntero, a.area) && !a.pidiendo) {
    a.pidiendo = true
    invocar('geometria', { puntero: true }).then(g => { a.area = g.area; a.libres = g.libres }).catch(() => {}).finally(() => { a.pidiendo = false })
  }
  if (a.origen === 'muesca') {
    const caja = cajaArrastre(puntero, null, a.tam)
    a.borde = bordeCercano(caja, a.area, a.libres)
    if (a.borde) {
      // Otro borde o volver de la píldora cambia la forma de adentro (velo, 9.6)
      const cambiaForma = st.acople.borde !== a.borde || document.body.classList.contains('pildora')
      // Cerca de un borde: la muesca se pega a él y se desliza a lo largo
      if (st.acople.borde !== a.borde) {
        st.acople = { borde: a.borde, lugar: 0.5 }
        document.body.dataset.borde = a.borde
      }
      document.body.classList.remove('pildora')
      const tm = tamMuesca()
      const centro = { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto / 2 }
      st.acople.lugar = lugarAjustado(lugarDe(a.borde, centro, a.area), tm.largo, largoDe(a.borde, a.area), zoom())
      // La ventana fija acompaña a la muesca: a lo largo del mismo borde cambia de lugar, no de
      // tamaño (salvo cerca de una punta, donde el panel se ajusta al área: ahí se vela)
      const d = disposicion(a.area, a.tablero)
      // Todo en esta misma tarea: el velo y la forma nueva llegan juntos al próximo cuadro
      const turno = velarSiRedimensiona(d.ventana, cambiaForma)
      colocar(d)
      pedirVentana(d.ventana, turno)
    } else {
      // Lejos de todo borde: la píldora flotante sigue al puntero
      const entra = !document.body.classList.contains('pildora')
      const pildora = { x: Math.round(caja.x), y: Math.round(caja.y), ancho: Math.round(caja.ancho), alto: Math.round(caja.alto) }
      const turno = velarSiRedimensiona(pildora, entra)
      document.body.classList.add('pildora')
      st.ventana = pildora
      pedirVentana(st.ventana, turno)
    }
  } else {
    const caja = cajaArrastre(puntero, a.agarre, a.inicio)
    a.caja = caja
    a.borde = bordeCercano(caja, a.area, a.libres)
    if (a.borde) {
      document.body.dataset.iman = a.borde
      $('#aviso-iman').textContent = `Soltá para acoplar · ${a.borde}`
    } else {
      delete document.body.dataset.iman
    }
    pedirVentana({ x: Math.round(caja.x), y: Math.round(caja.y) })
  }
}

async function soltarArrastre(e) {
  const a = st.arrastre
  if (!a || e.pointerId !== a.id) return
  if (a.cuadro) { cancelAnimationFrame(a.cuadro); a.cuadro = 0; if (a.activo) moverArrastre(a) }
  st.arrastre = null
  document.body.classList.remove('arrastrando')
  if (!a.activo) return
  // El clic que sigue al soltar no abre la muesca
  justoArrastro = true
  setTimeout(() => { justoArrastro = false }, 0)
  await enviandoVentana
  if (a.origen === 'muesca') {
    document.body.classList.remove('pildora')
    if (a.borde) {
      await invocar('guardar_acople', { borde: st.acople.borde, lugar: st.acople.lugar }).catch(err => registrar(`acople: ${err}`))
      // La zona vuelve a ser la muesca: lo demás deja pasar los clics otra vez
      await enviarZona(true)
      programarAjuste()
    } else {
      await acoplarA(null, { puntero: a.puntero })
    }
  } else {
    delete document.body.dataset.iman
    if (a.borde) {
      const centro = { x: a.caja.x + a.caja.ancho / 2, y: a.caja.y + a.caja.alto / 2 }
      await acoplarA(a.borde, { lugar: lugarDe(a.borde, centro, a.area), plegar: true })
    } else {
      // Flotando: la posición la guarda window-state al salir, como siempre
      st.ultimaFlotante = { x: Math.round(a.caja.x), y: Math.round(a.caja.y) }
    }
  }
}
document.addEventListener('pointerup', soltarArrastre)
document.addEventListener('pointercancel', soltarArrastre)

async function iniciar() {
  // Las definiciones de los Avis (piel, luz de piso y desenfoque), una vez por documento (5.1)
  document.body.insertAdjacentHTML('afterbegin', defsAvis())
  if (tauri?.core) {
    try {
      const m = await invocar('estado_menu')
      if (typeof m.arriba === 'boolean') ponerArriba(m.arriba)
      if (typeof m.avisar === 'boolean') st.avisar = m.avisar
      if (typeof m.pausa === 'boolean') ponerPausa(m.pausa)
      // Acoplada al cerrar la última vez: vuelve como muesca, en el monitor de la última posición (7.5)
      if (typeof m.acople?.borde === 'string') {
        st.acople = { borde: m.acople.borde, lugar: Number(m.acople.lugar) }
        // La ventana todavía está donde la dejó window-state: velada hasta colocarla en su borde
        movimientoMuesca.velar()
        aplicarModo()
      }
      await aplicarTamano(typeof m.tamano === 'number' ? m.tamano : PASO_POR_DEFECTO)
    } catch { await aplicarTamano(PASO_POR_DEFECTO) }
    const escuchar = tauri.event.listen
    escuchar('oficina://arriba', ev => ponerArriba(!!ev.payload))
    escuchar('oficina://avisar', ev => { st.avisar = !!ev.payload })
    escuchar('oficina://pausa', ev => ponerPausa(!!ev.payload))
    escuchar('oficina://tamano', ev => aplicarTamano(Number(ev.payload)))
    // Se abrió Oficina otra vez estando en la tira mini: volver a la ventana completa
    escuchar('oficina://expandir', () => ponerMini(false))
    // "Acoplar a" de la bandeja (7.3): un borde o Flotante (null)
    escuchar('oficina://acoplar', ev => acoplarA(typeof ev.payload === 'string' ? ev.payload : null))
    // "Mostrar oficina", la notificación o abrir Oficina otra vez: acoplada, abre el panel
    escuchar('oficina://abrir', () => { if (st.acople) evento({ tipo: 'clic' }) })
    // El puntero entró o salió de la zona interactiva (9.6); un aviso más viejo que el último se descarta
    escuchar('oficina://puntero-zona', ev => {
      const n = ev.payload?.n
      if (typeof n !== 'number' || n <= st.zonaN) return
      st.zonaN = n
      ponerDentro(!!ev.payload.dentro)
    })
  } else {
    await aplicarTamano(PASO_POR_DEFECTO)
  }
  ciclo()
  cicloEquipo()
}

iniciar()
