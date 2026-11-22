// Pantalla dividida (docs/diseno/dividida-ux.md): el HTML del riel, el encabezado de la
// conversación, las pestañas, las dos mitades con la costura, el puente, la ficha "Último" y las
// fichas "Conversan" de la barra. Arma texto a partir de los datos y de dividida.js; todo texto que
// viene de una sesión se escapa. Los textos que cambian con el tiempo llevan `data-vivo` (main.js
// los reescribe en su lugar, sin redibujar). Nunca muestra el contenido de los mensajes: no lo tiene.

import { avi, CLAUDE } from './avis.js'
import { escapar, nombreProyecto, preguntasPendientes, tiempoSubagente, tituloActividad, plural } from './logica.js'
import { ANIMO, colorProyecto, iniciales, estadoCorto, colorEstado, trazoHilo, subagentesVisibles, textoMas, prepararProyecto } from './tablero.js'
import { DIVIDIDA, lineaConversa, textoTurno, textoCostura, textoUltimo, textoFicha, horaCorta, duracionCorta } from './dividida.js'

/** El reloj de arena de 10 × 11 del chip "espera a …" (5.7). */
const ARENA = '<svg class="arena" width="10" height="11" viewBox="0 0 10 12" focusable="false" aria-hidden="true"><path d="M1.5 1h7M1.5 11h7M2.5 1c0 3 5 3 5 5s-5 2-5 5M7.5 1c0 3-5 3-5 5"/></svg>'
/** El punto de mensaje nuevo (5.1, 5.4 y 5.9): lo hace latir divididaMotion.js. */
const PUNTO = '<i class="pt-n" aria-hidden="true"></i>'

const otroDe = (c, id) => (id === c.a ? c.b : c.a)
const ms = valor => Date.parse(valor ?? '')

/** La sesión de un lado ya preparada para dibujar (ánimo y subagentes), o null si no se ve. */
function prepararLado(porId, id, ahoraMs) {
  const s = porId.get(id)
  if (!s) return null
  return prepararProyecto({ sesiones: [s] }, ahoraMs)[0]
}

// ------------------------------------------------------------------ barra: fichas "Conversan" (5.9)

/**
 * La sección "Conversan" de la barra lateral: una ficha por conversación, con las dos caras de
 * Claude quietas, quién con quién, la duración y el punto si tiene un mensaje nuevo sin abrir.
 * `ctx`: { ahoraMs, porId, nombre, nuevas }.
 */
export function fichasConversan(convs, { ahoraMs, porId, nombre, nuevas }) {
  if (!convs.length) return ''
  const fichas = convs.map(c => {
    const primero = c.empezo, otro = otroDe(c, primero)
    const pose = id => prepararLado(porId, id, ahoraMs)?.animo ?? 'esperando'
    const nuevo = nuevas.has(c.clave)
    const dura = c.hasta ? 'terminó' : duracionCorta(ahoraMs - ms(c.desde))
    return `<li><button type="button" class="conv${c.hasta ? ' fin' : ''}" data-accion="conv" data-clave="${escapar(c.clave)}">`
      + `<span class="caras-c" aria-hidden="true">${avi(CLAUDE, pose(primero), 26)}${avi(CLAUDE, pose(otro), 26, { indice: 1 })}</span>`
      + `<span class="conv-t" aria-hidden="true"><b title="${escapar(c.repos[primero] ?? nombre(primero))}">${escapar(nombre(primero))}</b>`
      + `<span title="${escapar(c.repos[otro] ?? nombre(otro))}">⇄ ${escapar(nombre(otro))}</span></span>`
      + `<em aria-hidden="true" data-vivo>${escapar(dura)}</em>${nuevo ? PUNTO : ''}`
      + `<span class="oculto" data-vivo>${escapar(textoFicha(c, ahoraMs, nombre, { nuevo }))}</span></button></li>`
  }).join('')
  return `<h2 class="rot-c" id="h-conversan">Conversan</h2><ul class="conversan">${fichas}</ul>`
}

// ------------------------------------------------------------------ riel (5.1)

/**
 * El riel de 56: Claude de 34 (zona de arrastre, sin juegos), las conversaciones, los proyectos y el
 * punto de estado. `ctx`: { ahoraMs, nombre, activa (clave del split), nuevas, origen (repo de la
 * vista anterior), animoMarca, estado ({ error, texto }) }.
 */
export function riel(proyectos, convs, { ahoraMs, nombre, activa, nuevas, origen, animoMarca, estado }) {
  const marca = `<div class="riel-marca" data-arrastre title="Arrastrá para mover o acoplar a un borde">${avi(CLAUDE, animoMarca, 34, { alt: `Claude, ${ANIMO[animoMarca] ?? animoMarca}` })}</div>`
  const conv = convs.map(c => {
    const es = c.clave === activa
    return `<li><button type="button" class="tok tok-cv${es ? ' activa' : ''}${c.hasta ? ' fin' : ''}" data-accion="conv" data-clave="${escapar(c.clave)}"${es ? ' aria-current="true"' : ''} title="${escapar(`${nombre(c.empezo)} ⇄ ${nombre(otroDe(c, c.empezo))}`)}">`
      + `<span aria-hidden="true">⇄</span>${nuevas.has(c.clave) ? PUNTO : ''}<span class="oculto" data-vivo>${escapar(textoFicha(c, ahoraMs, nombre, { nuevo: nuevas.has(c.clave) }).replace(/\. Abrir$/, ''))}</span></button></li>`
  }).join('')
  const proy = proyectos.map((p, k) => {
    const pend = preguntasPendientes(p).length
    const es = p.repo === origen
    const etiqueta = `${p.nombre}, ${plural(p.sesiones.length, 'sesión', 'sesiones')}${pend ? `, ${plural(pend, 'pregunta pendiente', 'preguntas pendientes')}` : ''}`
    return `<button type="button" class="tok${es ? ' origen' : ''}" data-accion="ir" data-proy="${k}" aria-label="${escapar(etiqueta)}"${es ? ' aria-description="vista anterior"' : ''} title="${escapar(p.repo ?? p.nombre)}">`
      + `<span class="tok-ic" style="--c:${colorProyecto(p.nombre)}" aria-hidden="true">${escapar(iniciales(p.nombre))}</span>${pend ? '<span class="insig" aria-hidden="true">?</span>' : ''}</button>`
  }).join('')
  const pie = `<div class="riel-pie"><i class="pt-r${estado.error ? ' error' : ''}" title="${escapar(estado.texto)}" aria-hidden="true"></i><span class="oculto" role="status">${escapar(estado.texto)}</span></div>`
  return `${marca}<ul class="riel-conv" aria-label="Conversaciones">${conv}</ul><hr><nav class="riel-proy" aria-label="Proyectos">${proy}</nav>${pie}`
}

// ------------------------------------------------------------------ encabezado (5.2)

/**
 * Kick, título y sub del encabezado. El único h1 de la dividida: "tienda-web conversa con
 * api-pagos" para el lector ("⇄" a la vista). Con el mismo proyecto a los dos lados, "tienda-web ·
 * 2 sesiones conversan". `sub`: de `textoSub`.
 */
export function cabConversa(conv, izq, { nombre, sub }) {
  const der = otroDe(conv, izq)
  const repo = id => conv.repos[id] ?? null
  const n = id => `<span class="n" title="${escapar(repo(id) ?? nombre(id))}">${escapar(nombre(id))}</span>`
  const titulo = repo(izq) === repo(der)
    ? `<span class="n" title="${escapar(repo(izq) ?? '')}">${escapar(nombreProyecto(repo(izq)))}</span> · 2 sesiones conversan`
    : `${n(izq)}<span class="flecha-c" aria-hidden="true">⇄</span><span class="oculto"> conversa con </span>${n(der)}`
  return `<p class="kick">Conversación</p><h1 class="h1-c">${titulo}</h1><p class="sub-c" id="sub-c">${escapar(sub)}</p>`
}

// ------------------------------------------------------------------ pestañas (5.4)

/** Las pestañas con 2 o más conversaciones (si no, vacío). Foco itinerante: solo la activa con tabindex 0. */
export function pestanas(convs, { activa, nuevas, nombre }) {
  if (convs.length < 2) return ''
  return `<div class="pestanas" role="tablist" aria-label="Conversaciones">${convs.map(c => {
    const es = c.clave === activa, nuevo = nuevas.has(c.clave)
    const otro = otroDe(c, c.empezo)
    return `<button type="button" class="pest" role="tab" aria-selected="${es}" aria-controls="split" tabindex="${es ? 0 : -1}" data-accion="pest" data-clave="${escapar(c.clave)}">`
      + `<span class="n">${escapar(nombre(c.empezo))}</span><i aria-hidden="true">⇄</i><span class="oculto"> conversa con </span><span class="n">${escapar(nombre(otro))}</span>`
      + `${c.hasta ? '<em>terminó</em>' : ''}${nuevo ? `${PUNTO}<span class="oculto">, mensaje nuevo</span>` : ''}</button>`
  }).join('')}</div>`
}

// ------------------------------------------------------------------ mitades (5.5 y 6)

/** Un subagente en su ranura de la mitad: Avi de 46 y rótulo de dos líneas (nombre y estado corto). */
function subMitad(a, r, ahoraMs, indice, j) {
  const estado = estadoCorto(a, ahoraMs)
  const titulo = `${a.nombre} — ${a.tarea} (${tiempoSubagente(a, ahoraMs)})`
  const ce = colorEstado(a.animo === 'durmiendo' ? a.estado : a.animo)
  return `<li class="sub-d${a.animo === 'durmiendo' ? ' dorm' : ''}" style="left:${r.x}px;top:${r.y}px;--c:${a.color};--ce:${ce};--j:${j}" title="${escapar(titulo)}" data-id="${escapar(a.id)}">`
    + `<span class="fig">${avi(a, a.animo, DIVIDIDA.sub, { indice })}</span>`
    + `<span class="rotulo-d" style="left:${r.rotulo.x - r.x}px;top:${r.rotulo.y - r.y}px;width:${r.rotulo.ancho}px"><b>${escapar(a.nombre)}</b>`
    + `<em aria-hidden="true" data-vivo>${escapar(estado)}</em><span class="oculto" data-vivo>${escapar(`${a.tarea} · ${estado}`)}</span></span></li>`
}

/** La pila "+n" de la mitad (6): no es un control; quiénes son, en el title y en texto oculto. */
function pilaMitad(ocultos, r, j) {
  const texto = textoMas(ocultos)
  const terminados = ocultos.every(a => a.estado === 'listo' || a.estado === 'fallo')
  return `<li class="mas-d" style="left:${r.x}px;top:${r.y}px;--j:${j}" title="${escapar(texto)}">`
    + `<span class="pila-d" aria-hidden="true">+${ocultos.length}</span>`
    + `<span class="rotulo-d" aria-hidden="true" style="left:${r.rotulo.x - r.x}px;top:${r.rotulo.y - r.y}px;width:${r.rotulo.ancho}px"><span>${terminados ? 'terminados' : 'más'}</span></span>`
    + `<span class="oculto">${escapar(texto)}</span></li>`
}

/**
 * Una mitad (5.5): cabecera (proyecto, tag y rama, línea), escenario con Claude de 120 en su piso,
 * su elenco y sus hilos ámbar, y el chip de turno. Sin la sesión a la vista: "sin datos" (8).
 * `ctx`: { ahoraMs, porId, nombre, geo (de geometriaDividida: izq o der), lado ('izq' | 'der'), base }.
 */
export function mitad(conv, id, { ahoraMs, porId, nombre, geo, lado, base = 0 }) {
  const p = prepararLado(porId, id, ahoraMs)
  const repo = conv.repos[id] ?? null
  const proy = nombreProyecto(repo)
  const icono = `<span class="mh-ic" style="--c:${colorProyecto(proy)}" aria-hidden="true">${escapar(iniciales(proy))}</span>`
  const h3 = `<h3 class="mh-p" id="mh-${lado}" title="${escapar(repo ?? proy)}">${icono}<span class="mh-n">${escapar(proy)}</span></h3>`
  const piso = `<div class="piso-d" style="--lx:${geo.luz}px" aria-hidden="true"></div>`
  const claudeEn = (animo, extra = '') => `<div class="esc-claude${extra}" data-claude="${escapar(id)}" style="left:${geo.claude.x}px;top:${geo.claude.y}px">${avi(CLAUDE, animo, geo.claude.t, { indice: base })}</div>`

  if (!p) {
    const t = textoTurno(conv, id, ahoraMs, nombre, { sinDatos: true })
    return `<section class="mitad ${lado} sin" aria-labelledby="mh-${lado}"><header class="mh">${h3}`
      + '<p class="mh-r"><b>—</b></p>'
      + '<p class="linea" style="--c:var(--tenue)" title="no se ve desde esta máquina"><span class="pt" aria-hidden="true"></span><span data-vivo>no se ve desde esta máquina</span></p></header>'
      + `<div class="esc-d">${piso}${claudeEn('esperando', ' dorm-c')}</div>`
      + `<div class="pie-m"><span class="turno ${t.clase}"><span data-vivo>${escapar(t.texto)}</span></span></div></section>`
  }

  const { s, sub } = p
  const l = lineaConversa(s, conv, ahoraMs, nombre)
  const tag = s.tarea ? `<span class="tag">#${escapar(s.tarea)}</span>` : '<span class="tag sin">sin tarea</span>'
  const rama = `<b title="${escapar(s.rama ?? '—')}">${escapar(s.rama ?? '—')}</b>`
  const marcador = l.conversa ? '<span class="cv-m" aria-hidden="true">⇄</span>' : '<span class="pt" aria-hidden="true"></span>'
  const titulo = l.conversa ? `⇄ ${l.texto}` : tituloActividad(s, ahoraMs) || l.texto
  const linea = `<p class="linea${l.conversa ? ' cv' : ''}" style="--c:${l.color}" title="${escapar(titulo)}">${marcador}<span data-vivo>${escapar(l.texto)}</span></p>`

  const { visibles, ocultos, resto } = subagentesVisibles(sub, { max: 2, conMas: 1 })
  const elenco = visibles.map((a, j) => subMitad(a, geo.ranuras[j], ahoraMs, base + 1 + j, j)).join('') + (resto ? pilaMitad(ocultos, geo.pila, visibles.length) : '')
  const hilos = visibles.map((a, j) => a.estado === 'trabajando' && { d: trazoHilo(geo.antena, geo.ranuras[j].destino), id: a.id }).filter(Boolean)
  if (resto && ocultos.some(a => a.estado === 'trabajando')) hilos.push({ d: trazoHilo(geo.antena, geo.pila.destino), id: 'pila' })
  const trazos = hilos.length ? `<svg class="hilos" aria-hidden="true">${hilos.map(h => `<path d="${h.d}" data-id="${escapar(h.id)}"/>`).join('')}</svg>` : ''
  const puntos = hilos.map((h, k) => `<i class="hilo-pt" style="offset-path:path('${h.d}');--k:${k}" data-id="${escapar(h.id)}" aria-hidden="true"></i>`).join('')

  const t = textoTurno(conv, id, ahoraMs, nombre)
  return `<section class="mitad ${lado}" aria-labelledby="mh-${lado}"><header class="mh">${h3}<p class="mh-r">${tag}${rama}</p>${linea}</header>`
    + `<div class="esc-d">${piso}${claudeEn(l.animo)}${sub.length ? `<ul class="elenco" aria-label="Subagentes">${elenco}</ul>` : ''}${trazos}${puntos}</div>`
    + `<div class="pie-m"><span class="turno ${t.clase}">${t.clase === 'espera' ? ARENA : ''}<span data-vivo>${escapar(t.texto)}</span></span></div></section>`
}

/**
 * Firma de lo que se ve de las mitades sin el tiempo: si no cambia, los textos se reescriben en su
 * lugar y no se cortan los bucles. Cambia con la pose, la clase de la línea y del chip, los subagentes.
 */
export function firmaMitades(conv, izq, { ahoraMs, porId, nombre }) {
  const lado = id => {
    const p = prepararLado(porId, id, ahoraMs)
    if (!p) return `${id}:sin`
    const l = lineaConversa(p.s, conv, ahoraMs, nombre)
    return [id, p.s.tarea, p.s.rama, l.animo, l.color, l.conversa, textoTurno(conv, id, ahoraMs, nombre).clase, ...p.sub.map(a => `${a.id}:${a.nombre}:${a.animo}`)].join('|')
  }
  return `${conv.clave}/${izq}/${!!conv.hasta}/${lado(izq)}/${lado(otroDe(conv, izq))}`
}

/** La costura (5.6): la línea y la píldora con la flecha del último mensaje. Decorativa. */
export function costura(conv, izq, ahoraMs) {
  const c = textoCostura(conv, izq, ahoraMs)
  return `<div class="costura" aria-hidden="true"><span class="pild${c.fin ? ' fin' : ''}" data-vivo>${escapar(c.texto)}</span></div>`
}

/** Las dos mitades y la costura (lo que va en `.split-g`). */
export function mitades(conv, izq, ctx, geo) {
  const der = otroDe(conv, izq)
  return mitad(conv, izq, { ...ctx, geo: geo.izq, lado: 'izq', base: 0 })
    + costura(conv, izq, ctx.ahoraMs)
    + mitad(conv, der, { ...ctx, geo: geo.der, lado: 'der', base: 4 })
}

/** El puente (5.8): halo, cable punteado y el trazado cortado (se ve con `.fin`), en coordenadas de `.split`. */
export function puente(geo, fin) {
  const d = geo.cable.d
  return `<svg class="puente${fin ? ' fin' : ''}" aria-hidden="true"><path class="halo-p" d="${d}"/><path class="cable" d="${d}"/><path class="cortado" d="${d}" pathLength="100"/></svg>`
    + '<i class="msj" aria-hidden="true"></i><i class="llega" aria-hidden="true"></i>'
}

/** La ficha "Último" (4.2): quién → a quién y hace cuánto, desde cuándo, y que Avis nunca ve qué se dicen. */
export function fichaUltimo(conv, { ahoraMs, nombre }) {
  return `<p class="u-t">Último: <b data-vivo>${escapar(textoUltimo(conv, ahoraMs, nombre))}</b></p>`
    + `<span class="u-d">desde ${escapar(horaCorta(conv.desde))}</span>`
    + '<small>Avis ve quién habla y cuándo, nunca qué se dicen.</small>'
}
