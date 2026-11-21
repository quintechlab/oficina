// Movimiento de la marca "Escenario" (docs/diseno/marca-avi-ux.md 6, 7 y 8): el Avi de Claude de la
// barra lateral sigue el puntero con la mirada y, cuando no pasa nada, juega solo (pelota, canta, te
// llama, se estira, siesta). La lógica (planificador, pistas, mirada) es pura y vive en marca.js; acá
// solo se dibuja. Sin dependencias: los juegos se interpolan con las pistas de marca.js en un
// requestAnimationFrame que vive solo mientras hay un juego o la mirada no llegó a su destino, y las
// notas son Web Animations de fuego y olvido. El planificador es un único setTimeout. Nada corre
// cuando la marca no se ve, con movimiento reducido o con "Pausar animaciones".
// El mismo motor mueve al Avi que asoma en la muesca cerrada (docs/diseno/muesca-avi-ux.md 7 y 9), con
// opciones: otra figura, el repertorio de un solo juego ("cucú", sin siesta ni notas: a los 8 min se
// aquieta) y `ocupado` (trabaja: no sigue al puntero y mira lo suyo).
// La voz del resumen (docs/diseno/resumen-ia-ux.md 6.2 y 6.3): con el globo abierto, la marca toma la
// pose del estado del globo (`voz`), sostiene sus canales y suspende los juegos.

import { figuraMarca } from './tablero.js'
import { poseAvi } from './avis.js'
import { hayMovimiento } from './tableroMotion.js'
import {
  ACTOS, REPOSO, PESOS_REPOSO, TIEMPOS_REPOSO, estadoActo, salida, proximoReposo, objetivoMirada,
  cambioMirada, direccionSalida, siguePuntero, sigueAhora, miraPropia, MIRA_OCUPADO,
  VOCES, VOZ_MS, canalesVoz, haciaVoz, puedeJugar,
} from './marca.js'

const NS = 'http://www.w3.org/2000/svg'
const AMBAR = '#F2B632'
const CREMA = '#F3EBD8'
/** Grupos del SVG de la marca que mueve este módulo (avis.js, svgMarca). */
const GRUPOS = ['actua', 'inclina', 'antena', 'foco', 'bulbo', 'mirada', 'parpado', 'c-pico', 'pico-s', 'pico-i', 'boca', 'c-mejillas', 'c-brillo', 'mn-i', 'mn-d', 'globo', 'bola', 'bola-r', 'b-sombra', 'contacto', 'notas']
/** Notas en SVG, sin glifos de fuente (5.2). */
const CORCHEA = '<ellipse rx="3.6" ry="2.7" transform="rotate(-20)"/><rect x="2.4" y="-15" width="1.6" height="14.5" rx=".8"/><path d="M3.2 -15q5.4 2 4.8 7.6q-1.4-3.6-4.8-3.8z"/>'
const DOBLE = '<ellipse rx="3.4" ry="2.6" transform="rotate(-20)"/><ellipse cx="9" cy="-2" rx="3.4" ry="2.6" transform="rotate(-20 9 -2)"/><rect x="2.3" y="-15" width="1.5" height="14" rx=".75"/><rect x="11.3" y="-17" width="1.5" height="14" rx=".75"/><path d="M2.3 -15L12.8 -17V-13.6L2.3 -11.6Z"/>'
/** Repertorios del reposo: el escenario de la marca y el cucú de la muesca. */
const REPERTORIOS = { escenario: PESOS_REPOSO, cucu: Object.freeze({ cucu: 1 }) }
/** El pico de "contando": 0 ↔ 0,6 cada 170 ms (6.2). */
const HABLA_MS = 170
/** El rebote del cambio de pose de la voz (`--rebote`). */
const REBOTE = 'cubic-bezier(.34,1.56,.64,1)'
/** Diferencia bajo la cual la mirada llegó a su destino y el cuadro se detiene (8). */
const CONVERGE = 0.002

const f = n => (+n).toFixed(2)

/** Tiempos del reposo divididos por `escala` (la vista de desarrollo los acorta para verlos). */
function tiemposCon(escala) {
  if (!(escala > 1)) return TIEMPOS_REPOSO
  const t = TIEMPOS_REPOSO
  return { primero: t.primero / escala, entre: t.entre.map(v => v / escala), siesta: t.siesta / escala, llama: t.llama / escala }
}

/**
 * Monta la marca en `el` (#marca-avi, o #muesca-avi con `figura: figuraMuesca` y `repertorio: 'cucu'`).
 * Devuelve los controles que usa main.js:
 * - `animo(animo, reposo, { ocupado })`: el ánimo (`animoMarca` o el de `estadoMuesca`), si puede
 *   jugar (`reposoPermitido`) y si trabaja (`.ocupado` en el SVG; no sigue al puntero y mira lo suyo);
 * - `visible(visto, acoplada)`: si la marca se ve (flotante, o acoplada con el panel abierto, sin
 *   esconder ni minimizar) y el modo; también revisa movimiento reducido y "Pausar animaciones";
 * - `actividad()`: el usuario hizo algo en la ventana (el módulo ya escucha puntero, rueda y teclas);
 * - `cursor(x, y | null)`: la posición global del puntero en px de la ventana (acoplada, la manda Rust);
 * - `zona(dentro)`: el aviso de Rust de que el puntero entró o salió de la zona interactiva (acoplada y
 *   cerrada el WebView no ve salir al puntero): al salir, el próximo movimiento vuelve a decir "te vio";
 * - `quiereCursor()`: se ve, se puede mover y la pose sigue al puntero (para `mirada` de la zona);
 * - `voz(pose | null, { hablando })`: la pose de voz del resumen (`vozAvi`); null vuelve al ánimo;
 * - `destruir()`.
 */
export function montarMarca(el, { escala = 1, reloj = () => performance.now(), azar = Math.random, figura = figuraMarca, repertorio = 'escenario', sigueOcupado = false } = {}) {
  const tiempos = tiemposCon(escala)
  const pesos = REPERTORIOS[repertorio] ?? PESOS_REPOSO
  const soloCucu = repertorio === 'cucu'
  const s = {
    animo: null, pose: 'esperando', reposo: false, ocupado: false, visto: false, acoplada: false, quieto: !hayMovimiento(),
    svg: null, avi: null, g: {}, ojos: -1, asoma: null, asir: false,
    acto: null, V: { ...REPOSO }, dormido: false,
    mirada: { x: 0, y: 0 },
    puntero: null, dentro: false, salio: -Infinity, dir: { x: 0, y: 0 }, ultimoMov: reloj(),
    plan: { quietoDesde: reloj(), ultimoFin: null, ultimo: null, ultimaLlamada: null, juegos: 0 },
    previsto: null, temporizador: null, temporizadorMirada: null, cuadro: null,
    voz: null, hablando: false,
  }

  const puede = () => s.visto && !s.quieto
  /**
   * ¿Sigue al puntero? Las poses que miran (esperando, te espera); trabajando, solo con `sigueOcupado`
   * (la muesca). Con voz, solo si la voz no mira a un lugar fijo (VOCES).
   */
  const sigue = () => (!s.voz || VOCES[s.voz].mira == null) && sigueAhora(s.pose, s.ocupado, sigueOcupado)
  /** Adónde mira por su cuenta: el lugar de la voz o, trabajando, lo suyo. */
  const mira = () => (s.voz && VOCES[s.voz].mira) || miraPropia(s.ocupado, sigueOcupado)
  const jugable = () => puedeJugar({ visto: s.visto, quieto: s.quieto, reposo: s.reposo, pose: s.pose, ocupado: s.ocupado, voz: s.voz })
  /** El reposo de los canales: el de la voz, si hay una (sus canales sostenidos). */
  const reposoCanales = () => (s.voz ? canalesVoz(s.voz) : { ...REPOSO })
  /** Hay un juego (o la siesta) en curso; el viaje a la voz no cuenta. */
  const enJuego = () => (!!s.acto && s.acto.def.id !== 'voz') || s.dormido

  // ---------------------------------------------------------------- dibujo

  function dibujar(animo) {
    el.innerHTML = figura(animo)
    s.avi = el.firstElementChild
    s.svg = el.querySelector('svg')
    s.g = Object.fromEntries(GRUPOS.map(k => [k, s.svg.querySelector('.' + k)]))
    s.ojos = -1
    s.svg.classList.toggle('ocupado', s.ocupado)
    s.svg.classList.toggle('voz', !!s.voz)
    // En la muesca, el canal "asir" agarra las manos del recorte padre (.asoma.agarra, CSS)
    s.asoma = el.closest('.asoma')
    s.avi.addEventListener('animationend', e => { if (e.animationName === 'doble') s.avi.classList.remove('te-vio') })
  }

  /** Los valores de los canales a los grupos del SVG (5.3): solo transform y opacity. */
  function aplicar(v) {
    const g = s.g
    if (!s.svg) return
    g.actua.setAttribute('transform', `translate(${f(v.x)} ${f(v.y)}) rotate(${f(v.r)} 60 104) translate(60 104) scale(${f(v.sx)} ${f(v.sy)}) translate(-60 -104)`)
    const alto = Math.min(Math.max(-v.y, 0), 24) / 24
    g.contacto.setAttribute('transform', `translate(60 104) scale(${f(1 - alto * 0.45)} 1) translate(-60 -104)`)
    g.contacto.setAttribute('opacity', f(0.55 * (1 - alto * 0.6)))
    g.antena.setAttribute('transform', `rotate(${f(v.ant)} 60 38)`)
    g.foco.setAttribute('transform', `translate(60 14) scale(${f(1 + Math.max(v.luz, 0) * 0.4)}) translate(-60 -14)`)
    g.bulbo.setAttribute('opacity', f(1 - Math.max(-v.luz, 0) * 0.55))
    g.parpado.setAttribute('transform', `translate(0 70) scale(1 ${f(v.par)}) translate(0 -70)`)
    const o = Math.round(v.ojos)
    if (o !== s.ojos) {
      s.svg.classList.toggle('o-fe', o === 1)
      s.svg.classList.toggle('o-ce', o === 2)
      s.ojos = o
    }
    g['pico-s'].setAttribute('transform', `translate(0 ${f(-v.boca * 1.6)})`)
    g['pico-i'].setAttribute('transform', `translate(0 ${f(v.boca * 3.2)})`)
    g.boca.setAttribute('transform', `translate(60 80.5) scale(1 ${f(v.boca)}) translate(-60 -80.5)`)
    g['mn-i'].setAttribute('transform', `translate(${f(19 + v.mIx)} ${f(82 + v.mIy)}) rotate(${f(v.mIr)}) scale(${f(0.4 + 0.6 * v.moI)})`)
    g['mn-i'].setAttribute('opacity', f(v.moI))
    g['mn-d'].setAttribute('transform', `translate(${f(101 + v.mDx)} ${f(82 + v.mDy)}) rotate(${f(v.mDr)}) scale(${f(0.4 + 0.6 * v.moD)})`)
    g['mn-d'].setAttribute('opacity', f(v.moD))
    g.globo.setAttribute('transform', `translate(104 10) translate(-15 14) scale(${f(v.globo)}) translate(15 -14)`)
    g.globo.setAttribute('opacity', f(Math.min(1, v.globo * 1.6)))
    g.bola.setAttribute('transform', `translate(${f(v.bx)} ${f(v.by + 7)}) scale(${f(2 - v.bs)} ${f(v.bs)}) translate(0 -7)`)
    g.bola.setAttribute('opacity', f(v.bo))
    g['bola-r'].setAttribute('transform', `rotate(${f(v.br)})`)
    const h = Math.min(Math.max(97 - v.by, 0), 80) / 80
    g['b-sombra'].setAttribute('cx', f(v.bx))
    g['b-sombra'].setAttribute('rx', f(6.5 * (1 - h * 0.6)))
    g['b-sombra'].setAttribute('opacity', f(v.bo * (0.5 - h * 0.38)))
    const asir = v.asir > 0.5
    if (s.asoma && asir !== s.asir) {
      s.asoma.classList.toggle('agarra', asir)
      s.asir = asir
    }
  }

  /** La mirada a los grupos: ojos, pico, mejillas y brillo con paralaje, y la inclinación hasta 3°. */
  function aplicarMirada() {
    if (!s.svg) return
    const { x, y } = s.mirada, g = s.g
    g.mirada.setAttribute('transform', `translate(${f(x * 4.5)} ${f(y * 3.2)})`)
    g['c-pico'].setAttribute('transform', `translate(${f(x * 2.7)} ${f(y * 1.9)})`)
    g['c-mejillas'].setAttribute('transform', `translate(${f(x * 1.6)} ${f(y * 1.1)})`)
    g['c-brillo'].setAttribute('transform', `translate(${f(-x * 1.5)} ${f(-y)})`)
    g.inclina.setAttribute('transform', `rotate(${f(x * 3)} 60 104)`)
  }

  function teVio() {
    if (!s.avi || s.quieto) return
    s.avi.classList.remove('te-vio')
    void s.avi.getBoundingClientRect()
    s.avi.classList.add('te-vio')
  }

  // ---------------------------------------------------------------- notas (fuego y olvido)

  function nota({ dir, doble, grande }) {
    if (!s.g.notas) return
    const g = document.createElementNS(NS, 'g')
    g.innerHTML = doble ? DOBLE : CORCHEA
    g.setAttribute('fill', grande || dir < 0 ? AMBAR : CREMA)
    s.g.notas.appendChild(g)
    const x0 = 60 + dir * 6, y0 = 76, e = grande ? 1.25 : 0.85, giro = dir * 12
    const a = g.animate([
      { transform: `translate(${x0}px,${y0}px) rotate(0deg) scale(${e * 0.4})`, opacity: 0 },
      { transform: `translate(${x0 + dir * 12}px,${y0 - 18}px) rotate(${-giro}deg) scale(${e})`, opacity: 1, offset: 0.25 },
      { transform: `translate(${x0 + dir * 20 + 4}px,${y0 - 36}px) rotate(${giro}deg) scale(${e})`, opacity: 0.9, offset: 0.6 },
      { transform: `translate(${x0 + dir * 30}px,${y0 - 60}px) rotate(${-giro}deg) scale(${e * 0.9})`, opacity: 0 },
    ], { duration: grande ? 2000 : 1700, easing: 'cubic-bezier(.2,.6,.3,1)' })
    a.onfinish = () => g.remove()
  }

  /** Apaga las notas en vuelo: en 200 ms al soltar el juego, o de una al cancelarlo. */
  function apagarNotas(deUna) {
    if (!s.g.notas) return
    for (const g of [...s.g.notas.children]) {
      if (deUna) { g.remove(); continue }
      const opacidad = getComputedStyle(g).opacity
      g.getAnimations().forEach(a => a.pause())
      g.animate([{ opacity: opacidad }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = () => g.remove()
    }
  }

  // ---------------------------------------------------------------- juegos

  function iniciar(def) {
    const t = reloj()
    if (def.id !== 'despierta') s.svg?.classList.remove('siesta')
    s.acto = { def, t0: t, ev: 0 }
    if (def.id in pesos) {
      s.plan.ultimo = def.id
      s.plan.juegos++
      if (def.id === 'llama') s.plan.ultimaLlamada = t
    }
    clearTimeout(s.temporizador)
    s.temporizador = null
    despertar()
  }

  /** Se cancela sin animación (otra pose, trabajo de Claude, ya no se ve): todo al reposo de una (o a la voz). */
  function cancelar() {
    s.acto = null
    s.dormido = false
    s.V = reposoCanales()
    apagarNotas(true)
    s.svg?.classList.remove('siesta')
    aplicar(s.V)
  }

  /** Lo interrumpiste (7.4): suelta el juego en 280 ms y te mira; de la siesta, despierta. */
  function interrumpir() {
    const id = s.acto?.def.id
    // La voz no es un juego: no se suelta
    if (id === 'salida' || id === 'despierta' || id === 'voz') return
    if (id === 'siesta' || s.dormido) {
      s.dormido = false
      s.svg?.classList.remove('siesta')
      iniciar(ACTOS.despierta())
      return
    }
    if (!s.acto) return
    apagarNotas(false)
    iniciar(salida(s.V))
    teVio()
  }

  function ejecutar([, que, datos]) {
    if (que === 'nota') nota(datos)
    else if (que === 'siesta') s.svg?.classList.add('siesta')
  }

  /** Avanza el juego en curso. Devuelve si sigue corriendo. */
  function pasoActo(ahora) {
    const { def, t0 } = s.acto
    const t = Math.min(ahora - t0, def.dur)
    s.V = estadoActo(def, t)
    const eventos = def.eventos ?? []
    while (s.acto.ev < eventos.length && eventos[s.acto.ev][0] <= t) ejecutar(eventos[s.acto.ev++])
    aplicar(s.V)
    if (ahora - t0 < def.dur) return true
    s.acto = null
    // La voz queda en su último cuadro hasta que cambie
    if (def.sostiene) return false
    if (def.lazo) {
      // La siesta queda en su último cuadro (la respiración lenta es CSS) hasta la próxima actividad
      s.dormido = true
      return false
    }
    if (def.id in pesos) s.plan.ultimoFin = ahora
    // Terminó un juego o el despertar con una voz puesta: los canales van a los de la voz
    if (s.voz) { iniciar(haciaVoz(s.V, s.voz)); return true }
    s.V = { ...REPOSO }
    aplicar(s.V)
    programar()
    return false
  }

  /** "contando": el pico se abre y se cierra mientras salen las palabras. Devuelve si sigue. */
  function pasoHabla(ahora) {
    if (s.voz !== 'contando' || !s.hablando || s.acto) return false
    s.V.boca = 0.3 - 0.3 * Math.cos((Math.PI * ahora) / HABLA_MS)
    aplicar(s.V)
    return true
  }

  // ---------------------------------------------------------------- mirada

  /** Un paso de la mirada hacia su destino. Devuelve si ya llegó. */
  function pasoMirada(ahora) {
    if (!s.svg || !s.avi) return true
    const r = s.avi.getBoundingClientRect()
    const o = objetivoMirada({
      sigue: sigue(), mira: mira(), quieto: s.quieto, puntero: s.puntero, dentro: s.dentro,
      modo: s.acoplada ? 'acoplada' : 'flotante', caja: { left: r.left, top: r.top, width: r.width, height: r.height },
      ahora, salio: s.salio, dir: s.dir, ultimoMov: s.ultimoMov, acto: s.acto || s.dormido ? s.V : null,
    })
    const m = s.mirada
    m.x += (o.x - m.x) * o.suave
    m.y += (o.y - m.y) * o.suave
    const llego = Math.abs(o.x - m.x) < CONVERGE && Math.abs(o.y - m.y) < CONVERGE
    if (llego) { m.x = o.x; m.y = o.y }
    aplicarMirada()
    return llego
  }

  function cuadro() {
    s.cuadro = null
    if (!puede()) return
    const ahora = reloj()
    const juega = s.acto ? pasoActo(ahora) : false
    const habla = pasoHabla(ahora)
    const llego = pasoMirada(ahora)
    if (juega || habla || !llego) { s.cuadro = requestAnimationFrame(cuadro); return }
    // Quieto: sin cuadros hasta el próximo cambio de la mirada por tiempo (curiosear) o un movimiento
    clearTimeout(s.temporizadorMirada)
    if (sigue() && !s.dormido) {
      s.temporizadorMirada = setTimeout(despertar, Math.max(16, cambioMirada({ ahora, salio: s.salio, ultimoMov: s.ultimoMov }) - ahora))
    }
  }

  /** Arranca los cuadros si no corren (un juego que empieza, el puntero que se mueve). */
  function despertar() {
    clearTimeout(s.temporizadorMirada)
    s.temporizadorMirada = null
    if (!puede() || s.cuadro) return
    s.cuadro = requestAnimationFrame(cuadro)
  }

  function detenerCuadros() {
    if (s.cuadro) cancelAnimationFrame(s.cuadro)
    s.cuadro = null
    clearTimeout(s.temporizadorMirada)
    s.temporizadorMirada = null
  }

  // ---------------------------------------------------------------- planificador (un solo setTimeout)

  function programar() {
    clearTimeout(s.temporizador)
    s.temporizador = null
    s.previsto = null
    if (!jugable() || s.acto || s.dormido) return
    const ev = proximoReposo({ ...s.plan, azar, pesos }, tiempos)
    // La muesca no duerme la siesta: a los 8 min de quietud se aquieta hasta la próxima actividad o
    // el próximo trabajo de Claude (muesca-avi-ux.md 7.2)
    if (soloCucu && ev.id === 'siesta') return
    s.previsto = { ...ev, quietoDesde: s.plan.quietoDesde }
    s.temporizador = setTimeout(disparar, Math.max(0, ev.en - reloj()))
  }

  function disparar() {
    s.temporizador = null
    if (!jugable() || s.acto || s.dormido || !s.previsto) return
    // Hubo actividad desde que se planeó: la cuenta empieza de nuevo
    if (s.previsto.quietoDesde !== s.plan.quietoDesde) { programar(); return }
    iniciar(ACTOS[s.previsto.id]())
  }

  function reiniciarQuietud() {
    s.plan.quietoDesde = reloj()
    s.plan.juegos = 0
  }

  // ---------------------------------------------------------------- entrada del usuario

  function actividad() {
    const t = reloj()
    s.plan.quietoDesde = t
    s.plan.juegos = 0
    if (!puede()) return
    if (s.acto || s.dormido) interrumpir()
    // Solo si el plan quedó más lejos que el primer juego de la racha nueva; si no, al disparar se corrige
    if (!s.temporizador || (s.previsto && s.previsto.en > t + tiempos.primero)) programar()
  }

  function alMover(e) {
    s.puntero = { x: e.clientX, y: e.clientY }
    s.ultimoMov = reloj()
    if (!s.dentro) {
      s.dentro = true
      if (!s.acto && !s.dormido && sigue()) teVio()
    }
    actividad()
    despertar()
  }

  function alSalir(e) {
    s.dentro = false
    s.salio = reloj()
    if (s.avi) {
      const r = s.avi.getBoundingClientRect()
      s.dir = direccionSalida(e.clientX, e.clientY, { left: r.left, top: r.top, width: r.width, height: r.height })
    }
    despertar()
  }

  const alTocar = () => actividad()
  const movimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const alCambiarMovimiento = () => api.visible(s.visto, s.acoplada)

  document.addEventListener('pointermove', alMover, { passive: true })
  document.addEventListener('pointerdown', alTocar, { passive: true })
  document.addEventListener('wheel', alTocar, { passive: true })
  document.addEventListener('keydown', alTocar)
  document.documentElement.addEventListener('pointerleave', alSalir)
  movimiento?.addEventListener?.('change', alCambiarMovimiento)

  const api = {
    animo(animo, reposo, { ocupado = false } = {}) {
      if (!!ocupado !== s.ocupado) {
        // Empieza o deja de trabajar: la mirada cambia de destino (lo suyo o el puntero)
        s.ocupado = !!ocupado
        if (s.ocupado && enJuego()) cancelar()
        s.svg?.classList.toggle('ocupado', s.ocupado)
      }
      if (animo !== s.animo) {
        s.animo = animo
        // Con una voz puesta manda la voz: el ánimo vuelve al cerrar el globo (voz(null))
        if (!s.voz) {
          // La pose de ánimo manda al instante: se cancela el juego y la siesta (el redibujo ya cambia la pose)
          cancelar()
          s.pose = poseAvi(animo).pose
          dibujar(animo)
          aplicarMirada()
        } else if (!s.svg) {
          dibujar(s.voz)
          aplicarMirada()
        }
      }
      const antes = s.reposo
      s.reposo = !!reposo
      if (antes && !s.reposo && enJuego()) cancelar()
      // La quietud se cuenta también desde el último trabajo de Claude (7.2)
      if (!antes && s.reposo) reiniciarQuietud()
      if (antes !== s.reposo || !s.temporizador) programar()
      despertar()
    },

    visible(visto, acoplada = false) {
      const antes = puede()
      s.visto = !!visto
      s.acoplada = !!acoplada
      s.quieto = !hayMovimiento()
      if (!puede()) {
        // Panel cerrado, escondida, minimizada, movimiento reducido o pausa: nada corre
        if (s.acto || s.dormido) cancelar()
        detenerCuadros()
        clearTimeout(s.temporizador)
        s.temporizador = null
        s.mirada = { x: 0, y: 0 }
        aplicarMirada()
        return
      }
      if (!antes) {
        // Al volver a verse, la cuenta de quietud empieza de cero
        reiniciarQuietud()
        programar()
      }
      despertar()
    },

    actividad,

    cursor(x, y) {
      s.puntero = x == null || y == null ? null : { x, y }
      s.ultimoMov = reloj()
      despertar()
    },

    zona(dentro) {
      if (dentro) return
      // Salió de la zona (lo sabe Rust): el próximo pointermove es una entrada y dice "te vio".
      // Flotando, mira hacia el último punto donde el DOM lo vio, como al salir de la ventana
      if (s.dentro && s.puntero && s.avi) {
        const r = s.avi.getBoundingClientRect()
        s.dir = direccionSalida(s.puntero.x, s.puntero.y, { left: r.left, top: r.top, width: r.width, height: r.height })
      }
      s.dentro = false
      s.salio = reloj()
      despertar()
    },

    quiereCursor: () => puede() && sigue(),

    /**
     * La voz del resumen (resumen-ia-ux.md 6.2): con una pose, cancela el juego y la siesta (salvo el
     * despertar, que termina y sigue a la voz), no programa reposo, redibuja la pose con un rebote y
     * lleva los canales a los de la voz en 360 ms; "contando" mueve el pico mientras `hablando`.
     * `null` vuelve al ánimo con la salida de 280 ms. Idempotente: main.js la llama en cada pintada.
     */
    voz(pose, { hablando = false } = {}) {
      const nueva = pose && VOCES[pose] ? pose : null
      s.hablando = !!hablando && nueva === 'contando'
      if (nueva === s.voz) { despertar(); return }
      const antes = s.voz
      s.voz = nueva
      clearTimeout(s.temporizador)
      s.temporizador = null
      const dibujo = nueva ?? s.animo
      const pose2 = nueva ?? poseAvi(s.animo).pose
      if (pose2 !== s.pose || !!antes !== !!nueva) {
        s.pose = pose2
        if (dibujo != null) {
          dibujar(dibujo)
          aplicarMirada()
          // El cambio de pose se marca con un rebote desde el piso (solo transform)
          if (!s.quieto && s.visto) {
            s.svg.animate([{ transform: 'scale(.94, 1.04)', transformOrigin: '50% 100%' }, { transform: 'none', transformOrigin: '50% 100%' }], { duration: VOZ_MS, easing: REBOTE })
          }
        }
      }
      if (!puede()) {
        // Sin movimiento o sin verse: los canales de la voz (o el reposo) quedan de una
        cancelar()
        programar()
        return
      }
      const id = s.acto?.def.id
      if (nueva) {
        // El despertar de la siesta termina y después va a la voz (pasoActo)
        if (id === 'despierta') { despertar(); return }
        apagarNotas(false)
        s.dormido = false
        s.svg?.classList.remove('siesta')
        iniciar(haciaVoz(s.V, nueva))
      } else {
        // Vuelve al ánimo: los canales al reposo en 280 ms y el reposo se programa al terminar
        iniciar(salida(s.V))
      }
    },

    destruir() {
      detenerCuadros()
      clearTimeout(s.temporizador)
      document.removeEventListener('pointermove', alMover)
      document.removeEventListener('pointerdown', alTocar)
      document.removeEventListener('wheel', alTocar)
      document.removeEventListener('keydown', alTocar)
      document.documentElement.removeEventListener('pointerleave', alSalir)
      movimiento?.removeEventListener?.('change', alCambiarMovimiento)
    },
  }
  return api
}
