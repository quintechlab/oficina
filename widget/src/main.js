// Ventana del widget: lee las sesiones locales cada 1,5 s y el equipo cada 60 s, y pinta terrario,
// lista, globo, tira mini, bandeja y avisos. Cada parte se redibuja solo si cambió lo que muestra,
// para no cortar las animaciones.

import { agruparPorProyecto, preguntasPendientes, preguntasNuevas, resumenMini, escapar } from './logica.js'
import { companeros } from './equipo.js'
import { iconoBandeja, textoInsignia } from './bandeja.js'
import { zoomDe, direccionDeTecla, tamanoDeseado, debeAjustar, posicionEnPantalla, tamanoMini, PASO_POR_DEFECTO } from './tamano.js'
import { textoRespondido, estadoEnvio, objetivoDelClic, registrarEleccion, alternarSeleccion, motivoRechazo, lineaClic } from './responder.js'
import {
  prepararProyecto, firmaTerrario, terrario, lista, globo, avisoOtroProyecto, vacio, cabeza, CLAUDE,
  carasMini, companero, firmaCompanero, quienPregunta,
} from './escena.js'

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
  /** Pestaña elegida del globo. */
  activa: 0,
  pos: {},
  /** Marcas del menú de la bandeja. */
  arriba: true,
  avisar: true,
  pausa: false,
  mini: false,
  /** Tamaño en porcentaje del original: 100, 125, 150, 175 o 200. */
  tamano: PASO_POR_DEFECTO,
  /** -1 o 1 mientras se navega con ◀ ▶, para animar la entrada de la escena. */
  direccion: 0,
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
}

/** Pone el HTML solo si cambió su firma (por defecto, el propio HTML). */
function poner(sel, html, firma = html) {
  if (st.firmas[sel] === firma) return false
  st.firmas[sel] = firma
  $(sel).innerHTML = html
  return true
}

const nSes = n => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`
const insignia = n => n ? `<span class="pend" aria-label="${n} ${n === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}">${n} ?</span>` : ''

function navegador(i) {
  const p = st.proyectos[i], conPreg = k => preguntasPendientes(st.proyectos[k]).length > 0
  const uno = st.proyectos.length < 2
  return `<div class="nav" role="group" aria-label="Tus proyectos con sesiones abiertas">
   <button type="button" class="nav-b" data-accion="nav" data-dir="-1" aria-label="Proyecto anterior"${uno ? ' disabled' : ''}>◀</button>
   <div class="nav-t" aria-live="polite" title="${escapar(p.repo ?? p.nombre)}"><b>${escapar(p.nombre)}</b>${conPreg(i) ? ` <b style="color:var(--amarillo)">!</b>` : ''}<span class="dim"> · ${i + 1}/${st.proyectos.length} · ${nSes(p.sesiones.length)}</span>
     <span class="nav-p" aria-hidden="true">${st.proyectos.map((_, k) => `<i class="${k === i ? 'ya' : conPreg(k) ? 'pr' : ''}"></i>`).join('')}</span></div>
   <button type="button" class="nav-b" data-accion="nav" data-dir="1" aria-label="Proyecto siguiente"${uno ? ' disabled' : ''}>▶</button></div>`
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

function pintar() {
  const ahora = Date.now()
  const totalPend = st.proyectos.reduce((n, p) => n + preguntasPendientes(p).length, 0)
  poner('#t-mascota', cabeza(totalPend ? 'teEspera' : 'saluda', CLAUDE.color, CLAUDE.pj, ''), `m${totalPend > 0}`)
  poner('#t-pend', insignia(totalPend))
  pintarBandeja(totalPend)
  pintarTira(ahora)
  pintarPie()
  pintarEquipo(ahora)

  if (!st.proyectos.length) {
    $('#total').textContent = ''
    poner('#nav', ''); poner('#otro', ''); poner('#w-globo', ''); poner('#lista', '')
    poner('#escena', vacio(), 'vacio')
    return
  }

  let i = st.proyectos.findIndex(p => p.repo === st.repo)
  if (i < 0) { i = 0; st.repo = st.proyectos[0].repo }
  const proyecto = st.proyectos[i]
  const total = st.proyectos.reduce((n, p) => n + p.sesiones.length, 0)
  $('#total').textContent = ` · ${nSes(total)}`
  poner('#nav', navegador(i))
  poner('#otro', avisoOtroProyecto(st.proyectos, i))

  const preparadas = prepararProyecto(proyecto, ahora)
  const firma = `${proyecto.repo}/${firmaTerrario(preparadas)}`
  if (st.firmas['#escena'] !== firma) {
    const t = terrario(proyecto, preparadas)
    st.pos = t.pos
    poner('#escena', t.svg, firma)
    const escena = $('#escena')
    escena.classList.toggle('cambia', st.direccion !== 0)
    escena.style.setProperty('--desde', `${st.direccion * 14}px`)
    st.direccion = 0
  }

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
  if (poner('#w-globo', globo(pend, { activa: st.activa, pos: st.pos, nuevo, ahoraMs: ahora, ui }), firmaGlobo)) {
    st.firmas.clavesGlobo = claves
    if (escribiendo) enfocarOtra()
  }

  poner('#lista', lista(proyecto, preparadas, ahora))
}

/** ¿La ventana está escondida en la bandeja o minimizada? */
async function fueraDeVista() {
  const v = tauri.window.getCurrentWindow()
  try {
    return !(await v.isVisible()) || (await v.isMinimized())
  } catch {
    return false
  }
}

/**
 * Avisa con una notificación de Windows cada pregunta nueva, si la ventana no está a la vista
 * y "Avisarme con cada pregunta" está marcado. Las que ya estaban al abrir el widget no se avisan.
 */
async function avisarNuevas() {
  const nuevas = preguntasNuevas(st.sesiones, st.avisadas)
  for (const q of nuevas) st.avisadas.add(q.id)
  if (st.primeraLectura) { st.primeraLectura = false; return }
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
    quien: quien.nombre, pj: quien.pj, color: quien.color, mascota: q.agente ?? 'c-' + q.sesion,
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
  st.repo = st.proyectos[(i + dir + n) % n].repo
  st.activa = 0
  st.direccion = dir
  pintar()
}

function ponerArriba(valor) {
  st.arriba = valor
  $('[data-accion="pin"]').setAttribute('aria-pressed', String(valor))
}

function ponerPausa(valor) {
  st.pausa = valor
  document.body.classList.toggle('pausa', valor)
}

async function ponerMini(mini) {
  if (st.mini === mini) return
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
  if (a === 'nav') {
    moverProyecto(+b.dataset.dir)
    $(`[data-accion="nav"][data-dir="${b.dataset.dir}"]`)?.focus()
  } else if (a === 'ir') {
    const p = st.proyectos[+b.dataset.proy]
    if (p) { st.repo = p.repo; st.activa = 0; st.direccion = 1; pintar() }
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
  if (st.mini || e.target.closest?.('input, textarea, summary')) return
  if (e.key === 'ArrowLeft') { e.preventDefault(); moverProyecto(-1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); moverProyecto(1) }
})

// ------------------------------------------------------------------ tamaño de la ventana

/**
 * Tamaño elegido (Ctrl + / Ctrl − o el submenú "Tamaño"): todo, dibujo y texto, crece con el
 * mismo zoom. Después la ventana se ajusta al contenido.
 */
async function aplicarTamano(porcentaje) {
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

/** Tamaño natural del contenido, en px de la ventana (ya con el zoom aplicado). */
function medirContenido() {
  const titulo = $('#titulo'), cuerpo = $('#cuerpo'), contenido = $('#contenido')
  const rTitulo = titulo.getBoundingClientRect(), rContenido = contenido.getBoundingClientRect()
  // Relación entre px de la ventana y px del documento (el zoom), medida y no supuesta
  const f = titulo.offsetHeight ? rTitulo.height / titulo.offsetHeight : 1
  const cs = getComputedStyle(cuerpo)
  const relleno = (a, b) => parseFloat(cs[a]) + parseFloat(cs[b])
  const barra = cuerpo.offsetWidth - cuerpo.clientWidth
  const borde = 2
  return {
    ancho: rContenido.width + (relleno('paddingLeft', 'paddingRight') + barra + borde) * f,
    alto: rTitulo.height + rContenido.height + (relleno('paddingTop', 'paddingBottom') + borde) * f,
  }
}

let esperaAjuste = null
/** Junta los cambios seguidos (100 ms) y ajusta una sola vez. */
function programarAjuste() {
  clearTimeout(esperaAjuste)
  esperaAjuste = setTimeout(ajustarVentana, 100)
}

async function ajustarVentana() {
  if (st.mini || !tauri?.core) return
  try {
    const g = await invocar('geometria')
    const deseado = tamanoDeseado(medirContenido(), g.area)
    if (!debeAjustar({ ancho: g.ancho, alto: g.alto }, deseado)) return
    const pos = posicionEnPantalla({ x: g.x, y: g.y }, deseado, g.area)
    await invocar('ajustar_ventana', { ...deseado, ...pos })
  } catch (e) {
    registrar(`tamaño: ${e}`)
  }
}

// El contenido cambia (otro proyecto, globo, compañero desplegado, tamaño elegido): la ventana lo sigue
new ResizeObserver(() => programarAjuste()).observe($('#contenido'))
new ResizeObserver(() => programarAjuste()).observe($('#titulo'))

async function iniciar() {
  if (tauri?.core) {
    try {
      const m = await invocar('estado_menu')
      if (typeof m.arriba === 'boolean') ponerArriba(m.arriba)
      if (typeof m.avisar === 'boolean') st.avisar = m.avisar
      if (typeof m.pausa === 'boolean') ponerPausa(m.pausa)
      await aplicarTamano(typeof m.tamano === 'number' ? m.tamano : PASO_POR_DEFECTO)
    } catch { await aplicarTamano(PASO_POR_DEFECTO) }
    const escuchar = tauri.event.listen
    escuchar('oficina://arriba', ev => ponerArriba(!!ev.payload))
    escuchar('oficina://avisar', ev => { st.avisar = !!ev.payload })
    escuchar('oficina://pausa', ev => ponerPausa(!!ev.payload))
    escuchar('oficina://tamano', ev => aplicarTamano(Number(ev.payload)))
    // Se abrió Oficina otra vez estando en la tira mini: volver a la ventana completa
    escuchar('oficina://expandir', () => ponerMini(false))
  } else {
    await aplicarTamano(PASO_POR_DEFECTO)
  }
  ciclo()
  cicloEquipo()
}

iniciar()
