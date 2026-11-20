// Ventana del widget: lee las sesiones locales cada 1,5 s y el equipo cada 60 s, y pinta terrario,
// lista, globo, tira mini, bandeja y avisos. Cada parte se redibuja solo si cambió lo que muestra,
// para no cortar las animaciones.

import { agruparPorProyecto, preguntasPendientes, preguntasNuevas, resumenMini, escapar } from './logica.js'
import { companeros } from './equipo.js'
import { iconoBandeja, textoInsignia } from './bandeja.js'
import {
  prepararProyecto, firmaTerrario, terrario, lista, globo, avisoOtroProyecto, vacio, cabeza, CLAUDE,
  carasMini, companero, firmaCompanero,
} from './escena.js'

const INTERVALO_MS = 1500
const INTERVALO_EQUIPO_MS = 60000
const tauri = window.__TAURI__
const $ = s => document.querySelector(s)
const invocar = (comando, args) => tauri.core.invoke(comando, args)

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

  const pend = preguntasPendientes(proyecto)
  if (st.activa >= pend.length) st.activa = 0
  const firmaGlobo = JSON.stringify([proyecto.repo, st.activa, pend.map(q => [q.clave, q.quien, q.item]), Math.floor(ahora / 60000)])
  const claves = pend.map(q => q.clave).join(',')
  const nuevo = st.firmas.clavesGlobo !== claves
  if (poner('#w-globo', globo(pend, { activa: st.activa, pos: st.pos, nuevo, ahoraMs: ahora }), firmaGlobo)) st.firmas.clavesGlobo = claves

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
  } catch (e) {
    st.error = `No se pudieron leer las sesiones: ${e}`
  }
  pintar()
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
      await invocar('modo_mini', { mini: true })
    } else {
      await invocar('modo_mini', { mini: false })
      st.mini = false
      document.body.classList.remove('mini')
      $('#tira').hidden = true
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
    pintar()
    $(`[data-accion="tab"][data-i="${st.activa}"]`)?.focus()
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

document.addEventListener('keydown', e => {
  if (st.mini || e.target.closest?.('input, textarea, summary')) return
  if (e.key === 'ArrowLeft') { e.preventDefault(); moverProyecto(-1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); moverProyecto(1) }
})

async function iniciar() {
  if (tauri?.core) {
    try {
      const m = await invocar('estado_menu')
      if (typeof m.arriba === 'boolean') ponerArriba(m.arriba)
      if (typeof m.avisar === 'boolean') st.avisar = m.avisar
      if (typeof m.pausa === 'boolean') ponerPausa(m.pausa)
    } catch { /* el menú todavía no existe: quedan los valores por defecto */ }
    const escuchar = tauri.event.listen
    escuchar('oficina://arriba', ev => ponerArriba(!!ev.payload))
    escuchar('oficina://avisar', ev => { st.avisar = !!ev.payload })
    escuchar('oficina://pausa', ev => ponerPausa(!!ev.payload))
  }
  ciclo()
  cicloEquipo()
}

iniciar()
