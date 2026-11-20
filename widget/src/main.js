// Ventana del widget: lee las sesiones locales cada 1,5 s y pinta terrario, lista y globo.
// Cada parte se redibuja solo si cambió lo que muestra, para no cortar las animaciones.

import { agruparPorProyecto, preguntasPendientes, escapar } from './logica.js'
import { prepararProyecto, firmaTerrario, terrario, lista, globo, avisoOtroProyecto, vacio, cabeza, CLAUDE } from './escena.js'

const INTERVALO_MS = 1500
const tauri = window.__TAURI__
const $ = s => document.querySelector(s)

const st = {
  proyectos: [],
  /** Proyecto elegido, por repositorio: si aparece uno nuevo, la selección no salta. */
  repo: undefined,
  /** Pestaña elegida del globo. */
  activa: 0,
  pos: {},
  pin: true,
  /** -1 o 1 mientras se navega con ◀ ▶, para animar la entrada de la escena. */
  direccion: 0,
  firmas: {},
  error: null,
  actualizado: null,
}

/** Pone el HTML solo si cambió su firma (por defecto, el propio HTML). */
function poner(sel, html, firma = html) {
  if (st.firmas[sel] === firma) return false
  st.firmas[sel] = firma
  $(sel).innerHTML = html
  return true
}

const nSes = n => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`

function navegador(i) {
  const p = st.proyectos[i], conPreg = k => preguntasPendientes(st.proyectos[k]).length > 0
  const uno = st.proyectos.length < 2
  return `<div class="nav" role="group" aria-label="Tus proyectos con sesiones abiertas">
   <button type="button" class="nav-b" data-accion="nav" data-dir="-1" aria-label="Proyecto anterior"${uno ? ' disabled' : ''}>◀</button>
   <div class="nav-t" aria-live="polite" title="${escapar(p.repo ?? p.nombre)}"><b>${escapar(p.nombre)}</b>${conPreg(i) ? ` <b style="color:var(--amarillo)">!</b>` : ''}<span class="dim"> · ${i + 1}/${st.proyectos.length} · ${nSes(p.sesiones.length)}</span>
     <span class="nav-p" aria-hidden="true">${st.proyectos.map((_, k) => `<i class="${k === i ? 'ya' : conPreg(k) ? 'pr' : ''}"></i>`).join('')}</span></div>
   <button type="button" class="nav-b" data-accion="nav" data-dir="1" aria-label="Proyecto siguiente"${uno ? ' disabled' : ''}>▶</button></div>`
}

function pintarTitulo(totalPend) {
  poner('#t-mascota', cabeza(totalPend ? 'teEspera' : 'saluda', CLAUDE.color, CLAUDE.pj, ''), `m${totalPend > 0}`)
  poner('#t-pend', totalPend ? `<span class="pend" aria-label="${totalPend} ${totalPend === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}">${totalPend} ?</span>` : '')
}

function pintarPie() {
  const pie = $('#pie')
  pie.classList.toggle('error', !!st.error)
  if (st.error) { pie.textContent = st.error; return }
  const hora = st.actualizado ? st.actualizado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'
  pie.textContent = `actualizado ${hora} · cada 1,5 s`
}

function pintar() {
  const ahora = Date.now()
  const totalPend = st.proyectos.reduce((n, p) => n + preguntasPendientes(p).length, 0)
  pintarTitulo(totalPend)
  pintarPie()

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

async function leer() {
  if (!tauri?.core) {
    st.error = 'Sin conexión con Tauri: el widget se abre con npm run dev dentro de widget/.'
    pintar()
    return
  }
  try {
    const sesiones = await tauri.core.invoke('leer_sesiones')
    st.proyectos = agruparPorProyecto(Array.isArray(sesiones) ? sesiones : [])
    st.error = null
    st.actualizado = new Date()
  } catch (e) {
    st.error = `No se pudieron leer las sesiones: ${e}`
  }
  pintar()
}

async function ciclo() {
  await leer()
  setTimeout(ciclo, INTERVALO_MS)
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

const ventana = () => tauri?.window?.getCurrentWindow()

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
    const nuevo = !st.pin
    try {
      await ventana()?.setAlwaysOnTop(nuevo)
      st.pin = nuevo
      b.setAttribute('aria-pressed', String(nuevo))
    } catch (err) { st.error = `No se pudo fijar la ventana: ${err}`; pintarPie() }
  } else if (a === 'min') {
    // TODO(mini): minimizar a la tira mini de 400 × 56 en vez de a la barra de tareas.
    await ventana()?.minimize()
  } else if (a === 'cerrar') {
    // TODO(bandeja): ocultar a la bandeja; por ahora cerrar sale de la aplicación.
    await ventana()?.close()
  }
})

document.addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea')) return
  if (e.key === 'ArrowLeft') { e.preventDefault(); moverProyecto(-1) }
  if (e.key === 'ArrowRight') { e.preventDefault(); moverProyecto(1) }
})

ciclo()
