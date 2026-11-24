// Los actos de la evolución (docs/diseno/mascotas-avi-ux.md 8.2 y 8.3): la transformación de la
// mascota de Claude cuando empieza a coordinar y la vuelta a la base cuando se queda sin equipo.
// anime.js v4 (src/vendor/animejs, versión fijada en package.json) mueve solo lo suyo: `g.trans` (el
// cuerpo entero), `g.cambio` (el rebote de la vuelta) y las partículas de `g.fx` (3.2, un dueño por
// capa); la forma (`evol`) la pone este módulo en el instante de `revela`, y su crecimiento es la
// transición CSS de especies.css. Las pistas (tiempos, curvas y valores) son las de ESTRELLAS y
// VUELTA del boceto aprobado (docs/diseno/bocetos/mascotas-avi.html).
// Quién decide si hay acto (se ve, sin movimiento reducido ni pausa, 66 px o más) es main.js, con
// `debeActuar` de evolucion.js; acá solo se respeta un acto por figura (6.9).

import { createTimeline, cubicBezier } from './vendor/animejs/anime.esm.min.js'

/** Las curvas CSS del boceto, para `playbackEase` (la curva de toda la pista, como en WAAPI). */
const CURVA = {
  inOut: cubicBezier(0.42, 0, 0.58, 1),
  out: cubicBezier(0, 0, 0.58, 1),
  in: cubicBezier(0.42, 0, 1, 1),
  suave: cubicBezier(0.16, 1, 0.3, 1),
}

/** Lo que dura la vuelta (8.3) y cuándo se saca `evol` (las partes se van con su transición). */
const VUELTA_MS = 1300
const SACA_EVOL_MS = 320

const q = (s, sel) => s.querySelector(sel)
const qa = (s, sel) => [...s.querySelectorAll(sel)]
const f = n => +n.toFixed(2)

/** Un transform del boceto en propiedades de anime.js. */
const tr = (x = 0, y = 0, sx = 1, sy = sx, r = 0) => ({ translateX: x, translateY: y, scaleX: sx, scaleY: sy, rotate: r })

/**
 * Una pista con fotogramas en porcentajes (`{ 0: {...}, 18: {...}, 100: {...} }`), tramos lineales y la
 * curva sobre toda la pista (`playbackEase`), como `el.animate(kf, { easing })` del boceto.
 */
function pista(tl, el, { d, en = 0, curva = CURVA.suave, kf }) {
  if (!el) return
  const keyframes = Object.fromEntries(Object.entries(kf).map(([p, v]) => [`${p}%`, v]))
  tl.add(el, { keyframes, duration: d, ease: 'linear', playbackEase: curva }, en)
}

/** Los actos de cada especie (8.2 y 8.3): el Avi (Faro) acá; las seis especies nuevas, en ACTOS_NUEVOS. */
const ACTOS = {
  avi: {
    dur: 2300,
    revela: 820,
    transformacion(tl, s) {
      // Se agacha, sube estirado y vuelve
      pista(tl, q(s, '.trans'), { d: 2000, curva: CURVA.inOut, kf: { 0: tr(), 18: tr(0, 1, 1.08, 0.9), 42: tr(0, -7, 0.94, 1.08), 60: tr(0, -5, 1.02, 0.98), 100: tr() } })
      // El halo crece (el brillo del acto, sobre el halo de la pose, que mueve el CSS)
      pista(tl, q(s, '.halo-f'), { d: 2000, kf: { 0: { scale: 1, opacity: 0 }, 38: { scale: 2.6, opacity: 0.85 }, 100: { scale: 1, opacity: 0 } } })
      // El aro que crece y los ocho haces del estallido
      pista(tl, q(s, '.anillo-f'), { d: 900, en: 760, curva: CURVA.out, kf: { 0: { opacity: 0.9, scale: 0.2 }, 100: { opacity: 0, scale: 3.4 } } })
      pista(tl, q(s, '.rayos-f'), { d: 1000, en: 720, curva: CURVA.out, kf: { 0: { opacity: 0, scale: 0.3, rotate: 0 }, 35: { opacity: 1, scale: 1.2, rotate: 20 }, 100: { opacity: 0, scale: 1.6, rotate: 40 } } })
      // Caen seis plumas, 40 ms entre una y otra
      qa(s, '.pluma').forEach((p, i) => {
        const dx = (i - 2.5) * 14
        pista(tl, p, {
          d: 1500, en: 820 + i * 40, curva: CURVA.out,
          kf: { 0: { opacity: 0, ...tr() }, 25: { opacity: 1, ...tr(dx * 0.6, -14, 1, 1, dx * 3) }, 100: { opacity: 0, ...tr(dx, 44 + i * 4, 1, 1, dx * 8) } },
        })
      })
    },
    vuelta(tl, s) {
      // Toque propio: caen las últimas plumas
      qa(s, '.pluma').forEach((p, i) => {
        const x = (i - 2.5) * 10, y = 50 + i * 3, r = (i - 2.5) * 60
        pista(tl, p, { d: 1300, en: 200 + i * 50, curva: CURVA.in, kf: { 0: { opacity: 0, ...tr() }, 20: { opacity: 1, ...tr(f(x * 0.2), f(y * 0.2), 1, 1, f(r * 0.2)) }, 100: { opacity: 0, ...tr(x, y, 1, 1, r) } } })
      })
    },
  },
}

// ------------------------------------------------------------------ las especies nuevas (8.2 y 8.3)
// Sus pistas pasan tal cual del boceto, con la forma de la API de animación del navegador que usa
// (`A(el, fotogramas, { d, dl, e, it, dir })`): `animar` las traduce a anime.js.

/** Las curvas de CSS por nombre, como las acepta `easing`. */
const CURVA_CSS = { 'ease-in-out': CURVA.inOut, 'ease-out': CURVA.out, 'ease-in': CURVA.in, ease: cubicBezier(0.25, 0.1, 0.25, 1), linear: t => t }
/** La curva de un `easing` del boceto (por defecto, la suave de `A`). */
function curvaDe(e = 'cubic-bezier(.16,1,.3,1)') {
  const m = e.match(/^cubic-bezier\(([^)]*)\)$/)
  return m ? cubicBezier(...m[1].split(',').map(Number)) : CURVA_CSS[e]
}

/** Un `transform` de CSS del boceto (translate, scale, rotate y sus ejes) en propiedades de anime.js. */
function transformDe(t) {
  const p = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotate: 0 }
  for (const [, fn, args] of t.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = args.split(/[\s,]+/).filter(Boolean).map(parseFloat)
    if (fn === 'translate') { p.translateX = v[0]; p.translateY = v[1] ?? 0 }
    else if (fn === 'translateX') p.translateX = v[0]
    else if (fn === 'translateY') p.translateY = v[0]
    else if (fn === 'scale') { p.scaleX = v[0]; p.scaleY = v[1] ?? v[0] }
    else if (fn === 'scaleX') p.scaleX = v[0]
    else if (fn === 'scaleY') p.scaleY = v[0]
    else if (fn === 'rotate') p.rotate = v[0]
  }
  return p
}

/**
 * Los fotogramas del navegador (`[{ transform, opacity, offset? }, …]`) en fotogramas por porcentaje
 * de anime.js: los `offset` que faltan se reparten parejos entre los que están (como el navegador) y
 * una propiedad que falta en un fotograma se interpola entre los que la tienen.
 */
function fotogramas(kf) {
  const n = kf.length
  const off = kf.map((k, i) => k.offset ?? (i === 0 ? 0 : i === n - 1 ? 1 : null))
  for (let i = 1; i < n; i++) {
    if (off[i] != null) continue
    let j = i
    while (off[j] == null) j++
    for (let k = i; k < j; k++) off[k] = off[i - 1] + (off[j] - off[i - 1]) * (k - i + 1) / (j - i + 1)
  }
  const valores = kf.map(({ transform, offset, ...resto }) => ({ ...(transform != null ? transformDe(transform) : {}), ...resto }))
  const props = [...new Set(valores.flatMap(Object.keys))]
  for (const prop of props) {
    const con = valores.map((v, i) => (prop in v ? i : -1)).filter(i => i >= 0)
    valores.forEach((v, i) => {
      if (prop in v) return
      const a = con.filter(k => k < i).at(-1), b = con.find(k => k > i)
      v[prop] = a == null ? valores[b][prop] : b == null ? valores[a][prop]
        : f(valores[a][prop] + (valores[b][prop] - valores[a][prop]) * (off[i] - off[a]) / (off[b] - off[a]))
    })
  }
  return Object.fromEntries(valores.map((v, i) => [`${+(off[i] * 100).toFixed(3)}%`, v]))
}

/**
 * Una pista del boceto (`A`) en la línea de tiempo: `d` duración, `dl` demora, `e` curva, `it`
 * repeticiones con `dir: 'alternate'` (las alas de Lumen: cada medio golpe con su curva).
 */
function animar(tl, el, kf, { d = 600, dl = 0, e, it = 1, dir } = {}) {
  if (!el) return
  const curva = curvaDe(e)
  if (it > 1 && dir === 'alternate') {
    // Ida y vuelta de dos fotogramas, desplegadas: cada tramo con la curva entera
    const ida = fotogramas(kf), desde = ida['0%'], hasta = ida['100%']
    const keyframes = Object.fromEntries(Array.from({ length: it + 1 }, (_, k) => [`${+(k / it * 100).toFixed(3)}%`, k % 2 ? hasta : desde]))
    tl.add(el, { keyframes, duration: d * it, ease: curva }, dl)
    return
  }
  tl.add(el, { keyframes: fotogramas(kf), duration: d, ease: 'linear', playbackEase: curva }, dl)
}

/** Los actos de las especies nuevas: ESTRELLAS (transformación) y VUELTA (su toque propio) del boceto. */
const ACTOS_NUEVOS = {
  ascua: {
    dur: 2400,
    revela: 1320,
    transformacion(tl, s) {
      animar(tl, q(s, '.trans'), [{ transform: 'none' }, { transform: 'translate(0px,2px) scale(1.07,.9)', offset: .16 }, { transform: 'translate(-2px,-3px) scale(.95,1.08) rotate(-5deg)', offset: .4 }, { transform: 'translate(-3px,0px) scale(1.03,.97) rotate(6deg)', offset: .52 }, { transform: 'translate(-3px,0px) rotate(5deg)', offset: .8 }, { transform: 'none' }], { d: 2400, e: 'ease-in-out' })
      for (const [sel, a] of [['.ala-s.ai', -30], ['.ala-s.ad', 30]]) animar(tl, q(s, sel), [{ transform: 'none' }, { transform: `rotate(${a}deg)`, offset: .38 }, { transform: `rotate(${a * .8}deg)`, offset: .8 }, { transform: 'none' }], { d: 2400, e: 'ease-in-out' })
      animar(tl, q(s, '.brasa'), [{ opacity: .2 }, { opacity: 1, offset: .4 }, { opacity: .9, offset: .8 }, { opacity: .7 }], { d: 2400 })
      animar(tl, q(s, '.llama'), [{ opacity: 0, transform: 'scale(0,.3)' }, { opacity: 0, transform: 'scale(0,.3)', offset: .46 }, { opacity: 1, transform: 'scale(1.08,1)', offset: .56 }, { opacity: 1, transform: 'scale(.94,1.06)', offset: .66 }, { opacity: 1, transform: 'scale(1.04,.95)', offset: .76 }, { opacity: 0, transform: 'scale(1.15,.5)' }], { d: 2400, e: 'linear' })
      qa(s, '.em').forEach((e, i) => { const dx = 26 + (i * 37) % 34, dy = -30 + (i * 23) % 40; animar(tl, e, [{ opacity: 0, transform: 'translate(0,0) scale(.5)' }, { opacity: 1, offset: .15 }, { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(1.1)` }], { d: 900 + (i % 3) * 200, dl: 1250 + i * 70, e: 'cubic-bezier(.2,.7,.3,1)' }) })
      animar(tl, q(s, '.anillo'), [{ opacity: .9, transform: 'scale(.2)' }, { opacity: 0, transform: 'scale(2.2)' }], { d: 800, dl: 1350, e: 'ease-out' })
    },
    vuelta: (tl, s) => qa(s, '.em').forEach((e, i) => animar(tl, e, [{ opacity: 0, transform: 'translate(0,-22px)' }, { opacity: 1, offset: .2 }, { opacity: 0, transform: `translate(${(i % 3 - 1) * 9}px,${10 + i * 2}px)` }], { d: 1000, dl: 150 + i * 50, e: 'ease-in' })),
  },
  escarcha: {
    dur: 2300,
    revela: 960,
    transformacion(tl, s) {
      animar(tl, q(s, '.trans'), [{ transform: 'none' }, { transform: 'scale(1.05,.94)', offset: .15 }, { transform: 'translateY(-4px) scale(.97,1.06)', offset: .4 }, { transform: 'translateY(-4px) scale(.98,1.04)', offset: .78 }, { transform: 'none' }], { d: 2300, e: 'ease-in-out' })
      for (const [sel, a] of [['.ala-s.ai', -22], ['.ala-s.ad', 22]]) animar(tl, q(s, sel), [{ transform: 'none' }, { transform: `rotate(${-a * .2}deg)`, offset: .15 }, { transform: `rotate(${a}deg)`, offset: .4 }, { transform: `rotate(${a * .9}deg)`, offset: .78 }, { transform: 'none' }], { d: 2300, e: 'ease-in-out' })
      animar(tl, q(s, '.copo'), [{ opacity: 0, transform: 'scale(.1) rotate(0deg)' }, { opacity: 0, transform: 'scale(.1) rotate(0deg)', offset: .3 }, { opacity: 1, transform: 'scale(1.3) rotate(40deg)', offset: .55 }, { opacity: 0, transform: 'scale(2) rotate(75deg)' }], { d: 2300, e: 'ease-out' })
      qa(s, '.esq').forEach((e, i) => { const a = i / 10 * Math.PI * 2, r = 40 + (i % 3) * 8; animar(tl, e, [{ opacity: 0, transform: 'translate(0,0) rotate(0deg)' }, { opacity: 1, offset: .1 }, { opacity: 0, transform: `translate(${f(Math.cos(a) * r)}px,${f(Math.sin(a) * r)}px) rotate(${180 + i * 30}deg)` }], { d: 900, dl: 900 + i * 18, e: 'cubic-bezier(.2,.7,.3,1)' }) })
      animar(tl, q(s, '.barrido'), [{ transform: 'translateX(0)' }, { transform: 'translateX(118px)' }], { d: 700, dl: 820, e: 'ease-in-out' })
    },
    vuelta: (tl, s) => qa(s, '.esq').forEach((e, i) => { const dx = (i - 4.5) * 7; animar(tl, e, [{ opacity: 0, transform: 'translate(0,0)' }, { opacity: 1, transform: `translate(${dx}px,-12px)`, offset: .3 }, { opacity: 0, transform: `translate(${dx * 1.3}px,40px)` }], { d: 1100, dl: 200 + i * 20, e: 'ease-in' }) }),
  },
  nodo: {
    dur: 1900,
    revela: 1000,
    transformacion(tl, s) {
      const t = q(s, '.trans'), D = 1900, at = ms => ms / D
      // El acto gira desde la pantalla (60 68); `soltar` saca el origen al terminar
      if (t) t.style.transformOrigin = '60px 68px'
      animar(tl, t, [{ transform: 'none' }, { transform: 'translate(-3px,0)', offset: at(80) }, { transform: 'translate(3px,1px)', offset: at(160) }, { transform: 'translate(-2px,0)', offset: at(240) }, { transform: 'none', offset: at(320) }, { transform: 'scale(1.25,.04)', offset: at(600) }, { transform: 'scale(1.25,.04)', offset: at(820) }, { transform: 'scale(.05,1.3)', offset: at(1000) }, { transform: 'scale(1.1,1.06)', offset: at(1180) }, { transform: 'scale(.97,1.02)', offset: at(1380) }, { transform: 'none' }], { d: D, e: 'ease-in-out' })
      animar(tl, q(s, '.flash-pant'), [{ opacity: 0 }, { opacity: .85, offset: .05 }, { opacity: 0, offset: .1 }, { opacity: .7, offset: .13 }, { opacity: 0, offset: .18 }, { opacity: 0 }], { d: D, e: 'linear' })
      animar(tl, q(s, '.linea'), [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 0, transform: 'scaleX(0)', offset: at(520) }, { opacity: 1, transform: 'scaleX(1)', offset: at(640) }, { opacity: 1, transform: 'scaleX(1)', offset: at(820) }, { opacity: 0, transform: 'scaleX(.2)', offset: at(960) }, { opacity: 0, transform: 'scaleX(.2)' }], { d: D, e: 'linear' })
      qa(s, '.rayo').forEach((r, i) => animar(tl, r, [{ opacity: 0, transform: 'translateY(0)' }, { opacity: 1, offset: .2 }, { opacity: 0, transform: `translateY(-${50 + (i % 3) * 12}px)` }], { d: 600, dl: 660 + i * 35, e: 'ease-out' }))
    },
    vuelta(tl, s) {
      animar(tl, q(s, '.flash-pant'), [{ opacity: 0 }, { opacity: .7, offset: .2 }, { opacity: 0, offset: .4 }, { opacity: .5, offset: .6 }, { opacity: 0 }], { d: 500, e: 'linear' })
      animar(tl, q(s, '.linea'), [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: .9, transform: 'scaleX(1)', offset: .4 }, { opacity: 0, transform: 'scaleX(.1)' }], { d: 500, dl: 150 })
    },
  },
  bruma: {
    dur: 2600,
    revela: 700,
    transformacion(tl, s) {
      animar(tl, q(s, '.trans'), [{ transform: 'none' }, { transform: 'translateY(2px) scale(1.12,.84)', offset: .14 }, { transform: 'translateY(-20px) scale(.9,1.12)', offset: .34 }, { transform: 'translateY(-24px) scale(1.03,.97)', offset: .5 }, { transform: 'translateY(-18px)', offset: .72 }, { transform: 'none' }], { d: 2600, e: 'ease-in-out' })
      animar(tl, q(s, '.tents'), [{ transform: 'none' }, { transform: 'scale(1.25,.7)', offset: .14 }, { transform: 'scale(.8,1.3)', offset: .34 }, { transform: 'scale(1.05,.95)', offset: .55 }, { transform: 'none' }], { d: 2600, e: 'ease-in-out' })
      animar(tl, q(s, '.contacto'), [{ transform: 'scale(1)', opacity: .5 }, { transform: 'scale(.5)', opacity: .15, offset: .4 }, { transform: 'scale(.55)', opacity: .2, offset: .72 }, { transform: 'scale(1)', opacity: .5 }], { d: 2600 })
      qa(s, '.anb').forEach((r, i) => animar(tl, r, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: .95, transform: 'scale(.6)', offset: .15 }, { opacity: 0, transform: 'scale(2.8)' }], { d: 1200, dl: 380 + i * 220, e: 'cubic-bezier(.2,.7,.3,1)' }))
      qa(s, '.pl').forEach((p, i) => animar(tl, p, [{ opacity: 0, transform: 'translate(0,0)' }, { opacity: 1, offset: .3 }, { opacity: 0, transform: `translate(${(i % 2 ? 1 : -1) * (3 + i % 4)}px,-${36 + (i * 7) % 20}px)` }], { d: 1500, dl: 500 + i * 70, e: 'ease-out' }))
    },
    vuelta: (tl, s) => qa(s, '.pl').forEach((p, i) => animar(tl, p, [{ opacity: 0, transform: 'translate(0,0)' }, { opacity: 1, offset: .3 }, { opacity: 0, transform: `translate(0,-${24 + i * 2}px)` }], { d: 1100, dl: 150 + i * 40, e: 'ease-out' })),
  },
  morro: {
    dur: 2700,
    revela: 1352,
    /** `k`: el contenedor que tiembla con el golpe (la tarjeta en el escenario; en la marca, su `.avi`). */
    transformacion(tl, s, k) {
      const t = q(s, '.trans')
      qa(s, '.ru').forEach((r, i) => animar(tl, r, [{ opacity: .3 }, { opacity: .3, offset: .04 + i * .06 }, { opacity: 1, offset: .1 + i * .06 }, { opacity: 1 }], { d: 2600, e: 'linear' }))
      animar(tl, q(s, '.ruglow'), [{ opacity: .1, transform: 'scale(.6)' }, { opacity: .95, transform: 'scale(1.8)', offset: .4 }, { opacity: .7, transform: 'scale(1.4)', offset: .8 }, { opacity: .7, transform: 'scale(1)' }], { d: 2600 })
      for (const [sel, sx] of [['.puno-s.ai', 1], ['.puno-s.ad', -1]]) animar(tl, q(s, sel), [{ transform: 'none' }, { transform: `translate(${-2 * sx}px,-18px) rotate(${-25 * sx}deg)`, offset: .38 }, { transform: `translate(${-3 * sx}px,-21px) rotate(${-32 * sx}deg)`, offset: .47 }, { transform: `translate(${2 * sx}px,6px) rotate(${8 * sx}deg)`, offset: .52 }, { transform: 'none', offset: .75 }, { transform: 'none' }], { d: 2600, e: 'ease-in-out' })
      animar(tl, t, [{ transform: 'none' }, { transform: 'translateY(-5px) scale(.97,1.05)', offset: .4 }, { transform: 'translateY(-6px) scale(.97,1.05)', offset: .47 }, { transform: 'translateY(2px) scale(1.1,.88)', offset: .52 }, { transform: 'scale(.98,1.02)', offset: .62 }, { transform: 'none' }], { d: 2600, e: 'ease-in-out' })
      animar(tl, k, [{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,1px)' }, { transform: 'translate(4px,-1px)' }, { transform: 'translate(-3px,0)' }, { transform: 'translate(2px,1px)' }, { transform: 'translate(0,0)' }], { d: 380, dl: 1352, e: 'linear' })
      qa(s, '.polvo').forEach(p => animar(tl, p, [{ opacity: .8, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(2)' }], { d: 700, dl: 1352, e: 'ease-out' }))
      qa(s, '.roca').forEach((r, i) => { const dx = [-10, -6, 0, 6, 10][i], g = i % 2 ? 1 : -1; animar(tl, r, [{ opacity: 0, transform: 'translate(0,0) rotate(0deg)' }, { opacity: 1, transform: `translate(${dx * .5}px,-${30 + i * 6}px) rotate(${90 * g}deg)`, offset: .4 }, { opacity: 1, transform: `translate(${dx * .8}px,-${34 + i * 5}px) rotate(${150 * g}deg)`, offset: .52 }, { opacity: 1, transform: `translate(${dx}px,0) rotate(${220 * g}deg)`, offset: .88 }, { opacity: 0, transform: `translate(${dx}px,0) rotate(${220 * g}deg)` }], { d: 1300, dl: 1352 + i * 40, e: 'ease-in-out' }) })
    },
    vuelta: (tl, s) => qa(s, '.polvo').forEach(p => animar(tl, p, [{ opacity: .7, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.6)' }], { d: 700, dl: 420, e: 'ease-out' })),
  },
  lumen: {
    dur: 2600,
    revela: 950,
    transformacion(tl, s) {
      for (const sel of ['.ala-s.ai', '.ala-s.ad']) animar(tl, q(s, sel), [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.42)' }], { d: 105, it: 16, dir: 'alternate', dl: 250, e: 'ease-in-out' })
      animar(tl, q(s, '.trans'), [{ transform: 'none' }, { transform: 'translateY(2px) scale(1.06,.94)', offset: .08 }, { transform: 'translateY(-16px)', offset: .3 }, { transform: 'translateY(-20px)', offset: .55 }, { transform: 'translateY(-14px)', offset: .75 }, { transform: 'none' }], { d: 2600, e: 'ease-in-out' })
      animar(tl, q(s, '.halo-l'), [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.1)', offset: .4 }, { opacity: .6, transform: 'scale(1.3)', offset: .75 }, { opacity: 0, transform: 'scale(1.5)' }], { d: 2600 })
      qa(s, '.ocelo-f').forEach(e => animar(tl, e, [{ opacity: 0 }, { opacity: .9, offset: .3 }, { opacity: 0, offset: .45 }, { opacity: .9, offset: .6 }, { opacity: 0 }], { d: 2000, dl: 300 }))
      animar(tl, q(s, '.espiral'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(420deg)' }], { d: 2000, dl: 500, e: 'cubic-bezier(.3,.6,.4,1)' })
      qa(s, '.mo').forEach((m, i) => { const a = i * 30 * Math.PI / 180, R = 16 + i * 3; animar(tl, m, [{ opacity: 0, transform: 'translate(0,0) scale(.4)' }, { opacity: 1, offset: .25 }, { opacity: 0, transform: `translate(${f(Math.cos(a) * R)}px,${f(Math.sin(a) * R)}px) scale(1)` }], { d: 1500, dl: 500 + i * 60, e: 'ease-out' }) })
    },
    vuelta: (tl, s) => qa(s, '.mo').forEach((m, i) => { const a = i * 30 * Math.PI / 180, R = 20 + i * 2, x = f(Math.cos(a) * R), y = f(Math.sin(a) * R); animar(tl, m, [{ opacity: 0, transform: `translate(${x}px,${y}px)` }, { opacity: 1, offset: .2 }, { opacity: 0, transform: `translate(${x}px,${y + 34}px)` }], { d: 1400, dl: 150 + i * 40, e: 'ease-in' }) }),
  },
}
Object.assign(ACTOS, ACTOS_NUEVOS)

/** Los actos de las siete especies (para los tests: las pistas sobre un SVG y una línea de tiempo). */
export const ACTOS_EVOLUCION = ACTOS
/** Duración y `revela` de cada transformación (8.2). */
export const DURACION_ACTOS = Object.fromEntries(Object.entries(ACTOS).map(([id, { dur, revela }]) => [id, { dur, revela }]))

/** La parte común de la vuelta (8.3): tiembla, se aplasta, rebota y salen 8 chispas del color `--c`. */
function vueltaComun(tl, s) {
  pista(tl, q(s, '.cambio'), {
    d: VUELTA_MS, curva: CURVA.out,
    kf: { 0: tr(), 6: tr(-1.5), 12: tr(1.5), 18: tr(-1), 24: tr(), 42: tr(0, 0, 1.07, 0.9), 62: tr(0, 0, 0.97, 1.04), 100: tr() },
  })
  qa(s, '.vu').forEach((p, i) => {
    const a = i / 8 * Math.PI * 2, R = 30 + (i % 3) * 8
    pista(tl, p, {
      d: 1100, en: 260, curva: CURVA.out,
      kf: { 0: { opacity: 0, ...tr() }, 35: { opacity: 1, ...tr(f(Math.cos(a) * R), f(Math.sin(a) * R - 10)) }, 100: { opacity: 0, ...tr(f(Math.cos(a) * R * 1.1), f(Math.sin(a) * R + 18)) } },
    })
  })
}

/** Cada figura con su acto en curso o en espera: svg → { fase, tl, relojes, vueltaPendiente }. */
const actos = new WeakMap()
/**
 * Las líneas de tiempo de actos ya terminados que siguen andando: las partículas del boceto caen un
 * poco después del final del acto (svg → línea). Se revierten solas al completarse, o antes si la
 * figura empieza otro acto o se corta.
 */
const restos = new WeakMap()

/**
 * La línea de tiempo de un acto nuevo de la figura: suelta la del anterior que siga andando y marca
 * la figura `actuando` (especies.css apaga, mientras dura, los bucles CSS de las piezas que el acto
 * también mueve, así cada capa tiene un solo dueño a la vez, 3.2).
 */
function nuevaLinea(svg) {
  soltar(svg)
  svg.classList.add('actuando')
  return createTimeline({ autoplay: true, onComplete: t => { if (restos.get(svg) === t) soltar(svg) } })
}

/** Revierte la línea que siga andando (los grupos quedan como los dibuja el CSS) y, sin acto, la marca. */
function soltar(svg) {
  const t = restos.get(svg)
  restos.delete(svg)
  t?.revert()
  // El origen del acto de Nodo (60 68) es del acto, no de la figura
  svg.querySelector('.trans')?.style.removeProperty('transform-origin')
  if (!actos.has(svg)) svg.classList.remove('actuando')
}

/** El contenedor que tiembla con el golpe de Morro (8.2): la tarjeta del escenario o, si no, el `.avi`. */
const contenedorDe = svg => svg.closest('.esc, .esc-d') ?? svg.closest('.avi')

/**
 * Pone o saca la forma (`evol`) y, si cambió, avisa con `formaevo` (burbujea, `detail.evol`): así el
 * nombre accesible de la figura sigue a la forma visible también durante un acto (mascotas-avi-ux.md 12).
 */
function ponerForma(svg, evol) {
  if (svg.classList.contains('evol') === evol) return
  svg.classList.toggle('evol', evol)
  svg.dispatchEvent(new CustomEvent('formaevo', { bubbles: true, detail: { evol } }))
}

/**
 * Pone o saca la forma sin transición (una figura recién dibujada, o la que empieza su acto desde la
 * base): `evo-ya` apaga las transiciones de especies.css durante un cálculo de estilo.
 */
export function formaAlInstante(svg, evol) {
  svg.classList.add('evo-ya')
  ponerForma(svg, evol)
  svg.getBoundingClientRect()
  svg.classList.remove('evo-ya')
}

/** ¿La figura tiene un acto en curso o esperando su turno? Entonces su forma es de este módulo. */
export function ocupada(svg) {
  return actos.has(svg)
}

/**
 * Termina el acto de la figura. `deUna`: se revierte ya (se corta); si no (el final del acto), la
 * línea sigue hasta que caigan sus partículas y se revierte sola. Revertir deja los grupos como los
 * dibuja el CSS (sin estilos en línea), como `fill: none` del boceto.
 */
function terminar(svg, { deUna = true } = {}) {
  const a = actos.get(svg)
  if (!a) return
  a.relojes.forEach(clearTimeout)
  actos.delete(svg)
  if (a.tl) restos.set(svg, a.tl)
  if (deUna || !a.tl || a.tl.completed) soltar(svg)
}

/** Corta el acto de una figura (por ejemplo, si deja de verse); la forma queda como esté. */
export function cancelar(svg) {
  terminar(svg)
}

/**
 * La transformación (8.2) de la figura `svg` de la `especie`, que arranca a los `retraso` ms (el
 * escalonado de 6.10). La forma se pone en `revela`, tapada por el estallido. Si corre la vuelta, se
 * corta en su punto y queda la forma sin acto (6.9). Sin pista para la especie, la forma cambia directo.
 * `contenedor`: el que tiembla con el golpe de Morro (por defecto, la tarjeta del escenario o el `.avi`).
 */
export function evolucionar(svg, especie, { retraso = 0, contenedor = null } = {}) {
  const a = actos.get(svg)
  if (a?.fase === 'evoluciona') { a.vueltaPendiente = false; return }
  if (a?.fase === 'vuelve') { terminar(svg); ponerForma(svg, true); return }
  const acto = ACTOS[especie]
  if (!acto) { ponerForma(svg, true); return }
  // Hasta su turno, la figura espera en la base
  if (svg.classList.contains('evol')) formaAlInstante(svg, false)
  const r = { fase: 'evoluciona', tl: null, relojes: [], vueltaPendiente: false }
  actos.set(svg, r)
  r.relojes.push(setTimeout(() => {
    if (!svg.isConnected) { actos.delete(svg); return }
    r.tl = nuevaLinea(svg)
    acto.transformacion(r.tl, svg, contenedor ?? contenedorDe(svg))
    r.relojes.push(setTimeout(() => ponerForma(svg, true), acto.revela))
    r.relojes.push(setTimeout(() => {
      const vuelve = r.vueltaPendiente
      terminar(svg, { deUna: false })
      // La vuelta que llegó durante la transformación espera a que termine (6.9)
      if (vuelve && svg.isConnected) devolver(svg, especie)
    }, acto.dur))
  }, retraso))
}

/**
 * La vuelta a la base (8.3), común más el toque de la especie, a los `retraso` ms. A los 320 ms se
 * saca `evol` (las partes se van con su transición). Si corre la transformación, la vuelta espera a
 * que termine (6.9).
 */
export function devolver(svg, especie, { retraso = 0 } = {}) {
  const a = actos.get(svg)
  if (a?.fase === 'evoluciona') { a.vueltaPendiente = true; return }
  if (a?.fase === 'vuelve') return
  const acto = ACTOS[especie]
  if (!acto || !svg.classList.contains('evol')) { ponerForma(svg, false); return }
  const r = { fase: 'vuelve', tl: null, relojes: [], vueltaPendiente: false }
  actos.set(svg, r)
  r.relojes.push(setTimeout(() => {
    if (!svg.isConnected) { actos.delete(svg); return }
    r.tl = nuevaLinea(svg)
    vueltaComun(r.tl, svg)
    acto.vuelta(r.tl, svg)
    r.relojes.push(setTimeout(() => ponerForma(svg, false), SACA_EVOL_MS))
    r.relojes.push(setTimeout(() => terminar(svg, { deUna: false }), VUELTA_MS))
  }, retraso))
}
