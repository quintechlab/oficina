// Ventana del widget: lee las sesiones locales cada 1,5 s y el equipo cada 60 s, y pinta el
// tablero (barra de proyectos, encabezado, chips de conteo, escenas de las sesiones y equipo), la tarjeta de pregunta, la tira mini,
// la bandeja y los avisos. Cada parte se redibuja solo si cambió lo que muestra, para no cortar
// las animaciones.

import { agruparPorProyecto, preguntasPendientes, preguntasNuevas, resumenMini, escapar, reposoPermitido, superaUmbral } from './logica.js'
import { companeros } from './equipo.js'
import { iconoBandeja, textoInsignia } from './bandeja.js'
import {
  zoomDe, direccionDeTecla, tamanoDeseado, fueraDeLugar, posicionEnPantalla, tamanoMini, medidaVentana, PASO_POR_DEFECTO,
  fraccionFlotante, posicionDeFraccion,
} from './tamano.js'
import { textoRespondido, estadoEnvio, objetivoDelClic, registrarEleccion, alternarSeleccion, motivoRechazo, lineaClic } from './responder.js'
import {
  prepararProyecto, firmaEscenas, sesiones, carasMini, companero, firmaCompanero,
  barraProyectos, animoMarca, estadoMarca, figuraVacio, conteos, chips, lineaEncabezado, colorProyecto,
} from './tablero.js'
import { globo, avisoOtroProyecto, quienPregunta, anuncioPregunta } from './pregunta.js'
import { defsAvis } from './avis.js'
import { entrada, cambioProyecto, hayMovimiento } from './tableroMotion.js'
import { entradaEscenas, idsDeEscena, novedades, marcarNuevos, vigilarEscenas } from './escenaMotion.js'
import { montarMarca } from './marcaMotion.js'
import {
  esHorizontal, bordeCercano, lugarDe, lugarAjustado, disposicionAcoplada, zonaInteractiva, recorte, cajaArrastre,
  posicionFlotante, dentroDe, ventanaDeArea, mismoRect, relativo, estadoMuesca, contenidoMuesca, contenidoPildora, ESTADO_INICIAL, siguiente, tocaGolpe, PILDORA,
  eventoZona, planVentana, tamMuescaDe, figuraMuesca, disposicionFlotante, disposicionTira, plegadoHacia, anclaHacia, fueraDelBorde, centroDe,
} from './muesca.js'
import * as movimientoMuesca from './muescaMotion.js'
import {
  PASOS as PASOS_PP, modeloAsistente, formaAsistente, nombreMuesca, alEmpezar, alEvento, trasRevision, anuncioCambio,
  retieneAbierta, fijaAlSoltar, navegar, visibleInicial,
} from './primerosPasos.js'
import { esqueleto, rotulo, pestanas, indicePestana, escena as escenaPasos, pie as piePasos, avisoAsistente } from './primerosPasosVista.js'
import * as movimientoPasos from './primerosPasosMotion.js'
import {
  resumenInicial, transicion as transicionResumen, datosResumen, contenidoResumen, anuncioResumen, vozAvi, colaResumen, cifrasDescarga,
  duracionContando, contarPalabras, animoTexto, EVENTOS_BACKEND, ESPERA_PENSANDO_MS, lineaAbrir,
} from './resumen.js'
import * as movimientoResumen from './resumenMotion.js'

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
  /** El último HTML de las escenas (con los tiempos) y sus subagentes, para los cambios en vivo (panel-avis-ux.md 8.4). */
  htmlEscenas: null,
  idsEscena: null,
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
  /** Abriendo, cerrando o pasando de una forma a otra: el ajuste espera (9.2). */
  animando: false,
  /** Pasando de una forma a otra (`transicion`, 6.6): no empieza otro cambio de forma ni un arrastre. */
  transicion: false,
  /** Arrastre propio en curso (9.3). */
  arrastre: null,
  /** Golpe de la pregunta: claves ya vistas y hora del último (6.4). */
  golpe: { vistas: new Set(), ultimo: null },
  /** Rectángulo de la ventana (px de pantalla): siempre el área de trabajo de su monitor (9.7). */
  ventana: null,
  /** Esquina del tablero flotante (px de pantalla), adentro del área; null hasta ubicarlo. */
  flotante: null,
  /** La posición flotante guardada (fracciones, `fraccionFlotante`), para ubicarlo la primera vez. */
  fraccion: null,
  /** Dónde se soltó la tira (px de pantalla); null: abajo a la derecha (`esquinaTira`). */
  tira: null,
  /** La píldora mientras se arrastra la muesca lejos de los bordes (px CSS de la ventana). */
  pildora: null,
  /** Última disposición (`disposicionAcoplada`, `disposicionFlotante` o `disposicionTira`). */
  disp: null,
  /** El puntero en la zona interactiva, según el sondeo de Rust (`oficina://puntero-zona`, 9.6). */
  dentroZona: false,
  /** Número del último aviso del sondeo: uno más viejo se descarta. */
  zonaN: -1,
  /** Última zona mandada a Rust, para no repetirla. */
  zonaEnviada: null,
  /** Foco que hay que dar cuando termine la animación: 'proyecto', 'muesca' o 'pp' (primeros pasos). */
  focoPendiente: null,
  // ---- primeros pasos (docs/diseno/bienvenida-ux.md): cada paso corre solo con un clic
  pp: {
    /** Última revisión de la máquina (solo lectura, 3.3); null antes de la primera. */
    revision: null,
    /** Revisión a la vista ("Revisando este equipo…"): al arrancar, al abrir o con "Volver a buscar". */
    revisando: false,
    /** Hay una revisión en curso (a la vista o la verificación callada después de un paso). */
    leyendo: false,
    /** Se pidió otra revisión mientras corría una: se hace al terminar. */
    otraRevision: false,
    promesa: null,
    /** Lo que corre o corrió en cada paso (`alEmpezar` y `alEvento`, primerosPasos.js). */
    ejec: { claude: null, mod: null, gh: null },
    /** Abierto a pedido (bandeja, "Ver →" o porque el usuario ya tocó una acción). */
    abierto: false,
    /** Cerrado con la × en esta ejecución: solo en memoria (3.2). */
    cerrado: false,
    /** Lo que se ve: 'claude', 'mod', 'gh' o 'listo' (la escena final). Solo lo cambia un clic. */
    visible: null,
    /** 'escenario', 'hoja' o null: la forma montada en #pp. */
    forma: null,
    /** Partes ya dibujadas, para no redibujar lo que no cambió. */
    firmas: {},
    /** Último modelo: los anuncios comparan contra él (un mensaje por cambio de estado, 7.2). */
    modelo: null,
    /** Acoplada, el panel quedó fijado por el código de GitHub y vuelve a su marca al terminar (5.2). */
    retuvo: false,
    /** La marca "Mantener abierta" de antes de retener, y si el usuario la cambió mientras tanto. */
    fijaAntes: false,
    fijaTocada: false,
  },
  // ---- "¿En qué anda Claude?" (docs/diseno/resumen-ia-ux.md): cada descarga y cada resumen, solo con un clic
  /** El globo del resumen (3.3): lo maneja `transicion` (resumen.js). */
  resumen: resumenInicial(),
  /** El usuario abrió el globo: el foco va a su primer `data-foco` al dibujarse (10). */
  resumenFoco: false,
  /** El globo se está cerrando (200 ms): todavía se ve. */
  resumenSaliendo: false,
}

/** Pone el HTML solo si cambió su firma (por defecto, el propio HTML). */
function poner(sel, html, firma = html) {
  if (st.firmas[sel] === firma) return false
  st.firmas[sel] = firma
  $(sel).innerHTML = html
  return true
}

/**
 * Reescribe en su lugar lo que cambia con el tiempo, sin redibujar (panel-avis-ux.md 9.3): los
 * textos con `data-vivo` y los `title`. Los bucles de los Avis y los puntos de los hilos siguen.
 * Devuelve false si el HTML nuevo no tiene la misma forma (entonces hay que redibujar).
 */
function actualizarTiempos(raiz, html) {
  const nuevo = document.createElement('template')
  nuevo.innerHTML = html
  const pares = ['[data-vivo]', '[title]'].map(sel => [raiz.querySelectorAll(sel), nuevo.content.querySelectorAll(sel)])
  if (pares.some(([a, b]) => a.length !== b.length)) return false
  for (const [k, el] of pares[0][0].entries()) {
    const t = pares[0][1][k].textContent
    if (el.textContent !== t) el.textContent = t
  }
  for (const [k, el] of pares[1][0].entries()) {
    const t = pares[1][1][k].getAttribute('title')
    if (el.getAttribute('title') !== t) el.setAttribute('title', t)
  }
  return true
}

/**
 * Las tarjetas escenario. Se redibujan solo si cambió su firma (sin el minuto: lo que pasa con el
 * tiempo se reescribe en su lugar). Después de redibujar, los subagentes nuevos entran solos y las
 * tarjetas que no se ven se pausan.
 */
function pintarEscenas(proyecto, preparadas, ahora) {
  const raiz = $('#sesiones')
  const html = sesiones(preparadas, ahora)
  const firma = firmaEscenas(proyecto.repo, preparadas)
  const ids = idsDeEscena(proyecto.repo, preparadas)
  if (st.firmas['#sesiones'] === firma && html !== st.htmlEscenas && !actualizarTiempos(raiz, html)) st.firmas['#sesiones'] = null
  if (poner('#sesiones', html, firma)) {
    marcarNuevos(raiz, novedades(st.idsEscena, ids))
    vigilarEscenas($('.principal'))
  }
  st.htmlEscenas = html
  st.idsEscena = ids
}

const insignia = n => n ? `<span class="pend" aria-label="${n} ${n === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}">${n} ?</span>` : ''

/** Pone un texto solo si cambió (así no se pisa una selección ni se relee el lector de pantalla). */
function texto(sel, valor) {
  const el = $(sel)
  if (el.textContent !== valor) el.textContent = valor
}

/** Vacío, cargando, escenario de primeros pasos o tablero: el marco cambia de forma (4.6 y bienvenida-ux.md 3.2). */
function modoMarco(modo) {
  const marco = $('#marco')
  for (const m of ['vacio', 'cargando', 'escenario']) marco.classList.toggle(m, modo === m)
  if (modo !== 'tablero') marco.classList.remove('con-hoja')
  $('#vacio-avi').hidden = modo === 'tablero' || modo === 'escenario'
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
  const texto = pendientes ? `Avis · ${pendientes} ${pendientes === 1 ? 'pregunta pendiente' : 'preguntas pendientes'}` : 'Avis'
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
 * La muesca A "Asoma" (muesca-avi-ux.md 3 y 8): el ánimo del Avi que asoma (lo dibuja su motor), el
 * modo (`data-modo`), el chip de sesiones y el globo, su nombre accesible y la luz de pregunta. El
 * armazón se escribió una vez: acá solo cambian atributos y textos (un innerHTML borraría el SVG del
 * motor). Acoplada, revisa si toca el golpe (6.4).
 */
function pintarMuesca(ahora, faltan) {
  const e = estadoMuesca(st.proyectos, ahora)
  muescaAvi.animo(e.animo, reposoPermitido(st.proyectos, ahora), { ocupado: e.ocupado })
  const boton = $('#muesca')
  if (boton.dataset.modo !== e.modo) boton.dataset.modo = e.modo
  texto('#muesca .cuenta', e.sesiones ? String(e.sesiones) : '')
  texto('#muesca .excl', e.globo || '!')
  poner('#pildora', contenidoPildora(e), `${e.animo}|${e.pregunta}|${e.chip}`)
  // Primeros pasos: sin golpe ni luz; solo el nombre suma lo que falta (bienvenida-ux.md 3.5)
  const nombre = nombreMuesca(e.nombre, faltan)
  if (boton.getAttribute('aria-label') !== nombre) boton.setAttribute('aria-label', nombre)
  document.body.classList.toggle('pregunta', e.pregunta)
  if (st.acople) revisarGolpe(ahora)
  // Si el Avi empezó o dejó de trabajar (o de dormir), cambia si quiere el puntero (repetida, no sale)
  enviarZona()
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

// La marca "Escenario" (docs/diseno/marca-avi-ux.md): el Avi de Claude que mira y juega solo. La vista de
// desarrollo puede acortar los tiempos del reposo (window.__escalaReposo, ver dev/falso.js)
const marca = montarMarca($('#marca-avi'), { escala: Number(window.__escalaReposo) || 1 })

// La muesca A "Asoma" (docs/diseno/muesca-avi-ux.md): el armazón una sola vez y, adentro, el Avi de
// Claude que asoma, movido por el mismo motor que la marca (solo el cucú; el curioseo se repite)
$('#muesca').innerHTML = contenidoMuesca()
const muescaAvi = montarMarca($('#muesca-avi'), { escala: Number(window.__escalaReposo) || 1, figura: figuraMuesca, repertorio: 'cucu', sigueOcupado: true })

/**
 * Qué Avi se ve (marca-avi-ux.md 7.1 y muesca-avi-ux.md 7.1): la marca flotante, o acoplada con el
 * panel abierto; el de la muesca acoplada y cerrada, sin píldora ni arrastre. Ninguno escondido,
 * minimizado ni en la tira. Movimiento reducido y "Pausar animaciones" los revisa marcaMotion.js.
 * Si cambia cuál quiere el puntero, la zona se vuelve a mandar (`mirada`, 9).
 */
function verAvis() {
  marca.visible(!st.fuera && !st.mini && (!st.acople || st.vista), !!st.acople)
  // El globo del resumen no se anima mientras no se ve (resumen-ia-ux.md 9.2): lo que corría termina de una
  if (!resumenALaVista()) movimientoResumen.terminar()
  muescaAvi.visible(!!st.acople && !st.vista && !st.fuera && !st.mini && !document.body.classList.contains('pildora') && !st.arrastre?.activo, true)
  enviarZona()
}

function pintar() {
  const ahora = Date.now()
  const pp = modeloPasos()
  const forma = formaAsistente({
    hayTablero: st.proyectos.length > 0, cargando: !st.actualizado && !st.error,
    abierto: st.pp.abierto, cerrado: st.pp.cerrado, faltan: pp.faltan,
  })
  retenerPanel(pp, forma)
  const totalPend = st.proyectos.reduce((n, p) => n + preguntasPendientes(p).length, 0)
  pintarMarca(ahora)
  verAvis()
  texto('#marca-estado', estadoMarca(st.proyectos.reduce((n, p) => n + p.sesiones.length, 0)))
  pintarBandeja(totalPend)
  pintarTira(ahora)
  pintarPie()
  pintarEquipo(ahora)
  pintarMuesca(ahora, pp.faltan)

  if (!st.proyectos.length && forma === 'escenario') {
    // Sin tablero y con algo pendiente: el escenario de primeros pasos en lugar del vacío (3.2)
    modoMarco('escenario')
    texto('#titulo', 'Primeros pasos')
    texto('#subtitulo', '')
    poner('#proyectos', ''); poner('#otro', ''); poner('#w-globo', ''); poner('#conteos', ''); poner('#sesiones', ''); st.idsEscena = null
    pintarAsistente(pp, forma)
    return
  }
  if (!st.proyectos.length) {
    pintarAsistente(pp, null)
    // Antes de la primera lectura: "Buscando sesiones…"; después, el vacío
    const cargando = !st.actualizado && !st.error
    modoMarco(cargando ? 'cargando' : 'vacio')
    poner('#vacio-avi', figuraVacio(cargando ? 'esperando' : 'durmiendo'), cargando ? 'cargando' : 'vacio')
    texto('#titulo', cargando ? 'Buscando sesiones…' : 'No hay sesiones de Claude Code abiertas.')
    texto('#subtitulo', cargando ? '' : 'Cuando abras una, aparece acá con sus subagentes.')
    poner('#proyectos', ''); poner('#otro', ''); poner('#w-globo', ''); poner('#conteos', ''); poner('#sesiones', ''); st.idsEscena = null
    return
  }
  modoMarco('tablero')
  const hoja = forma === 'hoja'
  $('#marco').classList.toggle('con-hoja', hoja)

  let i = st.proyectos.findIndex(p => p.repo === st.repo)
  if (i < 0) { i = 0; st.repo = st.proyectos[0].repo }
  const proyecto = st.proyectos[i]
  const enfocado = document.activeElement?.closest?.('#proyectos [data-proy]')
  if (poner('#proyectos', barraProyectos(st.proyectos, i)) && enfocado) {
    // El redibujo no se lleva el foco: queda en el proyecto que lo tenía
    $(`#proyectos [data-proy="${enfocado.dataset.proy}"]`)?.focus()
  }
  // El aviso de primeros pasos va debajo del de pregunta; con la hoja abierta no hace falta (3.5)
  poner('#otro', avisoOtroProyecto(st.proyectos, i) + (hoja ? '' : avisoAsistente(pp)))

  const preparadas = prepararProyecto(proyecto, ahora)
  const c = conteos(preparadas, ahora)
  texto('#titulo', proyecto.nombre)
  $('#titulo').title = proyecto.repo ?? proyecto.nombre
  texto('#subtitulo', lineaEncabezado(preparadas, c))
  poner('#conteos', chips(c))
  pintarEscenas(proyecto, preparadas, ahora)

  const pend = pendientesVisibles(proyecto)
  if (st.activa >= pend.length) st.activa = 0
  // Con la hoja abierta, la pregunta tiene prioridad: su aviso queda arriba de la hoja (3.2)
  const plegado = st.plegado || hoja
  const ui = {
    borradores: st.borradores, seleccion: st.seleccion, seleccionDe: st.seleccionDe, otra: st.otra, textoOtra: st.textoOtra,
    envios: st.envios, plegado, hecho: st.hecho, saliendo: st.saliendo,
  }
  const firmaGlobo = JSON.stringify([
    proyecto.repo, st.activa, pend.map(q => [q.clave, q.quien, q.item, q.responde]), Math.floor(ahora / 60000),
    st.borradores, [...st.seleccion], st.otra, st.envios, plegado, st.hecho?.mensaje, st.saliendo,
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
  // El globo del resumen va debajo de la pregunta (resumen-ia-ux.md 3.2). Sin rearmado: si cambió
  // algo desde el pedido, solo lo avisa ("Cambió algo"); nunca pide solo
  st.resumen = transicionResumen(st.resumen, { tipo: 'datos' }, { ahoraMs: ahora, datos: datosResumen(st.proyectos, ahora) }).resumen
  pintarResumen()
  pintarAsistente(pp, forma)

  // La primera vez que se ve el tablero desde que se mostró la ventana, entra escalonado (6.1).
  // Acoplada y cerrada no se ve: entra al abrir la muesca
  if (!st.revelado && !st.fuera && !st.mini && !(st.acople && !st.vista)) {
    st.revelado = true
    entrada()
    entradaEscenas(document.querySelectorAll('#sesiones > .ses'))
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
  entradaEscenas(document.querySelectorAll('#sesiones > .ses'))
}

/**
 * Escondida en la bandeja o minimizada, los bucles de los Avis se pausan (6.5). Al volver a
 * verse, el tablero entra escalonado otra vez.
 */
function ponerFuera(fuera) {
  if (st.fuera === fuera) return
  st.fuera = fuera
  document.body.classList.toggle('fuera', fuera)
  verAvis()
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
  // Si el área de trabajo o el monitor cambiaron, la ventana vuelve a ser el área (9.7)
  programarAjuste()
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
  // Fijada por el código de GitHub (bienvenida-ux.md 5.2): se ve como "Mantener abierta" marcado
  pin.title = st.acople && st.pp.retuvo && st.muesca.fija ? 'Queda abierta hasta que GitHub confirme' : textoPin
  const textoCerrar = st.acople ? 'Plegar a la muesca' : 'Cerrar a la bandeja'
  cerrar.setAttribute('aria-label', textoCerrar)
  cerrar.title = textoCerrar
  $('#muesca').setAttribute('aria-expanded', String(!!st.acople && st.muesca.abierta))
}

function ponerPausa(valor) {
  st.pausa = valor
  document.body.classList.toggle('pausa', valor)
  verAvis()
}

/**
 * Minimizar a la tira o expandirla (6.6): la ventana no cambia. Minimizar pliega el tablero hasta la
 * tira, que viaja a su lugar abajo a la derecha; expandir lo despliega desde la tira hasta su lugar y
 * su tamaño de antes. La tira mini es solo de la forma flotante.
 */
async function ponerMini(mini) {
  if (st.mini === mini || (mini && st.acople) || st.animando || !st.ventana) return
  const tira = $('#tira'), marco = $('#marco')
  st.animando = true
  try {
    if (mini) {
      const desde = st.disp?.local.tablero
      st.mini = true
      st.tira = null
      verAvis()
      invocar('modo_mini', { mini: true }).catch(() => {})
      const d = disposicionActual(st.ventana)
      const soltar = desde ? await movimientoMuesca.plegar(marco, $('#contenido'), plegadoHacia(desde, d.local.tira, 28, { x: 1, y: 1 }), { viaje: true }) : () => {}
      colocar(d)
      document.body.classList.add('mini')
      tira.hidden = false
      soltar()
      movimientoMuesca.aparecerContenido(tira)
    } else {
      const desde = st.disp?.local.tira
      st.mini = false
      document.body.classList.remove('mini')
      const d = disposicionActual(st.ventana)
      colocar(d)
      // Arranca en esta tarea: el tablero ya tiene la forma de la tira cuando la tira se esconde
      const anim = desde ? movimientoMuesca.desplegar(marco, $('#contenido'), plegadoHacia(d.local.tablero, desde, 28, { x: 1, y: 1 })) : Promise.resolve()
      tira.hidden = true
      invocar('modo_mini', { mini: false }).catch(() => {})
      // Lo de adentro se funde con el despliegue (como la isla): sin entrada escalonada encima
      st.revelado = true
      verAvis()
      pintar()
      await anim
    }
  } catch (e) {
    registrar(`tira: ${e}`)
  } finally {
    st.animando = false
  }
  await enviarZona(true)
  programarAjuste()
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-accion]')
  if (!b) return
  const a = b.dataset.accion
  if (a.startsWith('rz-')) {
    // El globo del resumen: cada botón hace solo lo suyo (resumen-ia-ux.md 6.1)
    await accionResumen(a, b)
    return
  }
  if (a.startsWith('pp-')) {
    // Primeros pasos: un botón deshabilitado (aria-disabled, 5.3) ignora el clic
    if (b.getAttribute('aria-disabled') !== 'true') await accionPasos(a, b)
    return
  }
  if (a === 'ir') {
    // El aviso de una pregunta en otro proyecto cierra la hoja de primeros pasos (3.2)
    if (b.closest('#otro')) st.pp.abierto = false
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
    // "Ver →" de la pregunta cierra la hoja de primeros pasos y muestra la pregunta (3.2)
    st.pp.abierto = false
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
  // Esc con el foco en el globo del resumen o en el Avi y el globo abierto: lo cierra y el foco vuelve
  // al Avi (resumen-ia-ux.md 10). Va antes que el Esc de la pregunta y el de la muesca
  if (e.key === 'Escape' && st.resumen.estado !== 'cerrado' && e.target.closest?.('#resumen, #marca-boton')) {
    e.preventDefault()
    despacharResumen({ tipo: 'cerrar' })
    marcaBoton.focus()
    return
  }
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
  if (teclaPasos(e)) return
  // Fuera de la pregunta, Esc cierra la muesca aunque esté fijada y devuelve el foco a la muesca (7.2)
  if (e.key === 'Escape' && st.acople && st.muesca.abierta) { e.preventDefault(); evento({ tipo: 'esc' }); return }
  if (st.mini || e.target.closest?.('input, textarea, summary, #pp, #resumen')) return
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
 * mismo zoom. La ventana no cambia (es el área): en la misma tarea se vuelve a ubicar lo de adentro,
 * así nada salta de lugar por un cuadro.
 */
async function aplicarTamano(porcentaje) {
  st.tamano = porcentaje
  document.documentElement.style.zoom = String(zoomDe(porcentaje))
  recolocar()
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
 * Tamaño del tablero en px de pantalla (ya con el zoom aplicado). El ancho es el de #contenido más
 * el relleno del área que desplaza, su barra y el borde de #marco. El alto del tablero es fijo
 * (`--alto-tablero`, 9.2): no cambia de un proyecto a otro. En el vacío y la carga el alto sigue al
 * contenido. El body ya no tiene relleno (la ventana es el área: la sombra entra sobrada).
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
  // Mientras algo abre, cierra, se transforma o se arrastra, lo de adentro ya está ubicado (9.2)
  if (!tauri?.core || st.animando || st.arrastre) return
  try {
    await colocarEnArea(await invocar('geometria'))
  } catch (e) {
    registrar(`tamaño: ${e}`)
  }
}

// Escondida o minimizada (si el WebView lo informa): pausa al instante, sin esperar la lectura
document.addEventListener('visibilitychange', () => ponerFuera(document.hidden))

// El contenido cambia (otro proyecto, globo, compañero desplegado, tamaño elegido): el tablero lo
// sigue adentro de la ventana. La muesca tiene un tamaño fijo (TAM_MUESCA): no hace falta observarla
const observador = new ResizeObserver(() => programarAjuste())
observador.observe($('#contenido'))

// ------------------------------------------------------------------ muesca acoplable (sección 7)

const zoom = () => zoomDe(st.tamano)
/** Tamaño de la muesca en px de pantalla (`TAM_MUESCA` por el zoom), sin medir el DOM. */
const tamMuesca = () => tamMuescaDe(st.acople.borde, zoom())

/** Largo del área de trabajo a lo largo de un borde. */
const largoDe = (borde, area) => esHorizontal(borde) ? area.ancho : area.alto

/** Disposición acoplada con el área de trabajo `area`: ventana fija, muesca y panel (9.6). */
function disposicion(area, tablero = medirContenido()) {
  return disposicionAcoplada(st.acople, tamMuesca(), tablero, area, zoom())
}

/**
 * La disposición de la forma de ahora en el área `area` (9.7): acoplada (muesca y panel), la tira
 * (abajo a la derecha o donde se soltó) o el tablero flotante (donde quedó, topado al área; la
 * primera vez, en la posición guardada). La ventana es siempre el área.
 */
function disposicionActual(area) {
  const z = zoom()
  if (st.acople) return disposicion(area)
  if (st.mini) {
    const tam = tamanoMini(z)
    return disposicionTira(st.tira ? posicionEnPantalla(st.tira, tam, area) : null, tam, area, z)
  }
  const tam = tamanoDeseado(medirContenido(), area)
  st.flotante = posicionEnPantalla(st.flotante ?? posicionDeFraccion(st.fraccion, tam, area), tam, area)
  return disposicionFlotante(st.flotante, tam, area, z)
}

/**
 * Ubica adentro de la ventana lo que corresponda a `d` (`d.local`, px CSS): la muesca, su luz y el
 * tablero (acoplada; abierta o cerrada es lo mismo, cambian el recorte y la clase `abierta`), el
 * tablero flotante o la tira.
 */
function colocar(d) {
  const cuerpo = document.body.style
  const poner = (prefijo, c) => {
    cuerpo.setProperty(`--${prefijo}x`, `${c.x}px`)
    cuerpo.setProperty(`--${prefijo}y`, `${c.y}px`)
    cuerpo.setProperty(`--${prefijo}w`, `${c.ancho}px`)
    cuerpo.setProperty(`--${prefijo}h`, `${c.alto}px`)
  }
  if (d.local.muesca) { poner('m', d.local.muesca); poner('l', d.local.luz) }
  if (d.local.tablero) poner('t', d.local.tablero)
  if (d.local.tira) poner('q', d.local.tira)
  st.disp = d
  st.ventana = { ...d.ventana }
  // La primera vez: hasta acá el tablero no tenía lugar y no se veía; flotando, entra (6.1)
  if (!document.body.classList.contains('colocada')) {
    document.body.classList.add('colocada')
    if (d.modo === 'flotante') entradaMarco()
  }
}

/** La entrada del tablero flotante al mostrarse por primera vez (`aparece`, 620 ms). */
function entradaMarco() {
  const marco = $('#marco')
  marco.classList.add('entra')
  marco.addEventListener('animationend', () => marco.classList.remove('entra'), { once: true })
}

/** Vuelve a ubicar lo de adentro con el área de ahora (la ventana es el área), sin esperar a Rust. */
function recolocar() {
  if (st.ventana && !st.animando && !st.arrastre) colocar(disposicionActual(st.ventana))
}

/**
 * Lleva la ventana al área de trabajo `g.area` si no está (9.7): solo pasa al cambiar de monitor o
 * de área, y entonces lo que se ve se vela antes y vuelve cuando WebView2 ya pintó (`planVentana`).
 * Pasar de una forma a otra, abrir, cerrar o cambiar el zoom no la tocan. Después ubica lo de adentro.
 */
async function colocarEnArea(g) {
  const d = disposicionActual(g.area)
  const plan = planVentana(g, d.ventana)
  const turno = plan === 'velar' ? movimientoMuesca.velar() : undefined
  colocar(d)
  try {
    if (plan !== 'nada') await invocar('ajustar_ventana', { ...d.ventana })
  } finally {
    if (movimientoMuesca.velada()) movimientoMuesca.revelar(turno)
  }
  await enviarZona()
}

/**
 * Le dice a Rust qué parte de la ventana toma el mouse (`zonaInteractiva`): fuera de ella los
 * clics pasan a lo que hay debajo. Devuelve si el puntero está adentro ahora (null sin respuesta).
 * Sin `forzar`, una zona igual a la última no se manda.
 */
async function enviarZona(forzar = false) {
  if (!st.disp || !tauri?.core) return null
  const zona = zonaInteractiva(st.disp, { abierta: st.vista, arrastrando: !!st.arrastre?.activo }, zoom())
  // `mirada`: acoplada, el Avi a la vista (la marca abierta o el de la muesca cerrada) quiere el
  // puntero; entonces Rust manda su posición global (muesca-avi-ux.md 9). Flotando, la marca mira
  // con el puntero del DOM, como siempre
  zona.mirada = !zona.toda && !!st.acople && (st.vista ? marca.quiereCursor() : muescaAvi.quiereCursor())
  const clave = `${zona.x},${zona.y},${zona.ancho},${zona.alto},${zona.toda},${zona.mirada}`
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
  muescaAvi.zona(dentro)
  // Flotando, fuera del tablero los clics pasan y el WebView no ve salir al puntero: la marca lo
  // sabe por acá y mira hacia donde salió, como al salir de la ventana chica de antes
  if (!st.acople) marca.zona(dentro)
  // `st.ventana`: la muesca ya está en su borde (al arrancar, la ventana todavía está en otro lado)
  if (!st.acople || st.arrastre || !st.ventana) return
  // Decide lo que la muesca todavía no sabe: Rust repite el estado real con cada zona nueva
  const tipo = eventoZona(st.muesca, dentro)
  if (tipo) evento({ tipo })
}

/**
 * Clases del modo: acoplada a un borde o flotante. Empieza cerrada. La ventana y lo ya ubicado no se
 * tocan (la ventana es el área en todos los modos): quien llama coloca la forma nueva en esta misma
 * tarea, y la píldora la saca quien la reemplaza.
 */
function aplicarModo() {
  const cuerpo = document.body
  cuerpo.classList.toggle('acoplada', !!st.acople)
  if (st.acople) cuerpo.dataset.borde = st.acople.borde
  else delete cuerpo.dataset.borde
  cuerpo.classList.remove('abierta', 'desplegada', 'abriendo', 'muesca-oculta')
  $('#marco').style.clipPath = ''
  st.vista = false
  st.zonaEnviada = null
  pintarControles()
  verAvis()
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
  // Mientras el código de GitHub retiene el panel, un cambio de la marca es del usuario (alfiler o Esc)
  if (st.pp.retuvo && e.fija !== antes.fija) st.pp.fijaTocada = true
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
  else if (foco === 'pp' && $('#pp-h')) $('#pp-h').focus()
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
    await colocarEnArea(g)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
  }
  marco.style.clipPath = rc.desde
  colocar(d)
  st.vista = true
  verAvis()
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
  verAvis()
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
 * Un cambio de forma (6.6): mientras dura, nada se reubica, no empieza otro cambio ni un arrastre.
 * Al terminar, la muesca se pone al día con lo pedido (abrir o cerrar) y lo de adentro se reubica.
 */
async function transicion(fn) {
  st.animando = true
  st.transicion = true
  try {
    return await fn()
  } finally {
    st.animando = false
    st.transicion = false
    if (st.acople) sincronizar()
    programarAjuste()
  }
}

/**
 * Acopla a `borde` o deja flotando (`null`): desde la bandeja ("Acoplar a"), al soltar el tablero o
 * la tira junto a un borde, o al soltar la píldora lejos de todos. Guarda el acople (7.5). La
 * ventana no cambia (9.7): lo que se ve se transforma adentro, sin velo (6.6).
 */
async function acoplarA(borde, { lugar, puntero } = {}) {
  if (!tauri?.core || st.arrastre || st.transicion) return
  clearTimeout(relojMuesca)
  try {
    const g = await invocar('geometria')
    // Si la ventana todavía no es el área de su monitor, primero eso (una vez, velado)
    if (planVentana(g, ventanaDeArea(g.area)) === 'velar') await colocarEnArea(g)
    if (borde) await acoplarABorde(borde, lugar, g.area)
    else if (st.acople) await flotar(puntero, g.area)
    else if (st.mini) await ponerMini(false)
  } catch (e) {
    st.error = `No se pudo acoplar: ${e}`
    pintarPie()
  }
}

/** Cerrada al instante de la pregunta del usuario: la isla se cierra antes de cambiar de forma. */
async function cerrarAntes() {
  if (!st.vista) return
  st.muesca = { ...ESTADO_INICIAL, armado: false }
  pintarControles()
  await animarCierre()
}

/**
 * A un borde: el tablero flotante se pliega hacia ese lado y queda la muesca; la tira viaja hasta la
 * muesca; la muesca de otro borde sale por el suyo y entra por el nuevo. El `lugar` es la proyección
 * del centro de lo que se ve sobre el borde (7.3), salvo que venga dado.
 */
async function acoplarABorde(borde, lugar, area) {
  const z = zoom()
  const tam = tamMuescaDe(borde, z)
  const desde = st.acople ? 'muesca' : st.mini ? 'tira' : 'tablero'
  if (desde === 'muesca' && st.acople.borde === borde && lugar == null) return
  const caja = desde === 'muesca' ? st.disp.m.caja : desde === 'tira' ? st.disp.tira : st.disp.tablero
  const l = lugar ?? (desde === 'muesca' ? st.acople.lugar : lugarDe(borde, centroDe(caja), area))
  const acople = { borde, lugar: lugarAjustado(l, tam.largo, largoDe(borde, area), z) }
  // Dónde queda la muesca (para eso no hace falta medir el tablero)
  const destino = disposicionAcoplada(acople, tam, { ancho: 0, alto: 0 }, area, z).local.muesca
  await transicion(async () => {
    let soltar = () => {}
    if (desde === 'tablero') {
      soltar = await movimientoMuesca.plegar($('#marco'), $('#contenido'), plegadoHacia(st.disp.local.tablero, destino, 22, anclaHacia(borde)))
    } else if (desde === 'tira') {
      soltar = await movimientoMuesca.viajar($('#tira'), st.disp.local.tira, destino, { easing: movimientoMuesca.EASE_CIERRA, apagarContenido: true })
    } else {
      await cerrarAntes()
      soltar = await movimientoMuesca.viajar($('#muesca'), st.disp.local.muesca, fueraDelBorde(st.disp.local.muesca, st.acople.borde), { easing: movimientoMuesca.EASE_CIERRA, apagar: true })
    }
    if (st.mini) {
      st.mini = false
      document.body.classList.remove('mini')
      $('#tira').hidden = true
      invocar('modo_mini', { mini: false }).catch(() => {})
    }
    st.acople = acople
    st.muesca = { ...ESTADO_INICIAL, armado: false }
    aplicarModo()
    colocar(disposicion(area))
    soltar()
    pintar()
    const guardado = invocar('guardar_acople', { borde, lugar: acople.lugar })
    if (desde === 'muesca') await movimientoMuesca.viajar($('#muesca'), fueraDelBorde(st.disp.local.muesca, borde), st.disp.local.muesca, { llega: true, apagar: true })
    await guardado
  })
  // La zona vuelve a ser la muesca (guardar_acople olvidó la de antes)
  await enviarZona(true)
}

/** Dónde nace el tablero que sale de la píldora: arriba al medio (posicionFlotante lo pone ahí). */
const ANCLA_PILDORA = { x: 0.5, y: 0 }

/**
 * A flotar: el tablero crece desde la píldora soltada (donde se soltó, `posicionFlotante`) o, desde
 * la bandeja, desde la muesca hasta su lugar de antes, como la isla (6.6).
 */
async function flotar(puntero, area) {
  const conPildora = document.body.classList.contains('pildora') && st.pildora
  const bordeViejo = st.acople.borde
  await transicion(async () => {
    await cerrarAntes()
    const origen = conPildora ? { ...st.pildora, ancho: PILDORA.ancho, alto: PILDORA.alto } : st.disp.local.muesca
    st.acople = null
    st.muesca = ESTADO_INICIAL
    aplicarModo()
    const tam = tamanoDeseado(medirContenido(), area)
    st.flotante = puntero ? posicionFlotante(puntero, tam, area) : posicionEnPantalla(st.flotante ?? posicionDeFraccion(st.fraccion, tam, area), tam, area)
    const d = disposicionFlotante(st.flotante, tam, area, zoom())
    colocar(d)
    // Lo de adentro se funde con el despliegue: sin entrada escalonada encima (6.4)
    st.revelado = true
    pintar()
    const plegado = plegadoHacia(d.local.tablero, origen, conPildora ? PILDORA.alto / 2 : 22, conPildora ? ANCLA_PILDORA : anclaHacia(bordeViejo))
    const anim = movimientoMuesca.desplegar($('#marco'), $('#contenido'), plegado)
    // En esta misma tarea: el tablero ya tiene la forma de la píldora cuando ella se va
    document.body.classList.remove('pildora')
    st.pildora = null
    // Flotando: sin la zona de la muesca, y la del tablero apenas Rust olvidó la vieja
    const guardado = invocar('guardar_acople', { borde: null, lugar: null }).then(() => enviarZona(true))
    await anim
    await guardado
    guardarFlotante()
  })
  await enviarZona(true)
}

/** Guarda dónde quedó el tablero flotante (fracción del lugar libre del área, `fraccionFlotante`). */
function guardarFlotante() {
  if (!st.flotante || st.disp?.modo !== 'flotante' || !st.ventana || !tauri?.core) return
  st.fraccion = fraccionFlotante(st.flotante, st.disp.tablero, st.ventana)
  invocar('guardar_flotante', st.fraccion).catch(e => registrar(`flotante: ${e}`))
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

// ---- arrastre propio e imán (7.3 y 9.3). El umbral (UMBRAL_ARRASTRE, 4 px) vive en logica.js

/**
 * Pide llevar la ventana a otra área (al pasar a otro monitor arrastrando); si hay un pedido en
 * vuelo, gana el último. `turno`: el del velo puesto para este pedido (`velar`); un pedido que
 * reemplaza a otro sin mandar hereda su velo, así nunca queda uno sin revelar.
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
      await invocar('ajustar_ventana', { ancho: r.ancho, alto: r.alto, x: r.x, y: r.y })
    } catch (e) { registrar(`arrastre: ${e}`) }
    // Ya en su lugar: lo velado vuelve cuando se pintó (si no se veló otra vez mientras tanto)
    if (r.turno) movimientoMuesca.revelar(r.turno)
  }
  enviandoVentana = null
}

document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || st.arrastre || st.transicion || !tauri?.core) return
  const asa = e.target.closest?.('#muesca, [data-arrastre]')
  if (!asa) return
  // Acoplada (cerrada o abierta) se arrastra la muesca; flotando, el tablero o la tira mini (con el
  // mismo imán: soltada junto a un borde, se acopla). Todo se mueve adentro de la ventana del área
  const a = { origen: st.acople ? 'muesca' : (st.mini ? 'tira' : 'tablero'), id: e.pointerId, x0: e.screenX, y0: e.screenY, dx: 0, dy: 0, cliente: { x: e.clientX, y: e.clientY }, activo: false }
  st.arrastre = a
  invocar('geometria', { puntero: true }).then(g => {
    a.area = g.area
    a.libres = g.libres
    // El puntero al tocar, en px de pantalla (la ventana más el punto adentro de ella)
    a.p0 = { x: g.x + a.cliente.x, y: g.y + a.cliente.y }
    // El tablero o la tira, y de dónde se los tomó
    const caja = a.origen === 'tablero' ? st.disp?.tablero : a.origen === 'tira' ? st.disp?.tira : null
    if (caja) {
      a.caja0 = { ...caja }
      a.agarre = { x: a.p0.x - caja.x, y: a.p0.y - caja.y }
    }
    a.listo = a.origen === 'muesca' || !!caja
  }).catch(() => { if (st.arrastre === a) st.arrastre = null })
})

document.addEventListener('pointermove', e => {
  const a = st.arrastre
  if (!a || e.pointerId !== a.id) return
  a.dx = e.screenX - a.x0
  a.dy = e.screenY - a.y0
  if (!a.activo) {
    if (!superaUmbral(a.dx, a.dy) || !a.listo) return
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
  }
  // Mientras se arrastra, toda la ventana toma el mouse: el puntero no se pierde a mitad de camino
  enviarZona(true)
  verAvis()
}

/** Una caja de la píldora en px CSS de la ventana (184 × 48 en px CSS, con cualquier zoom). */
const cajaPildora = p => ({ x: p.x, y: p.y, ancho: PILDORA.ancho, alto: PILDORA.alto })

function moverArrastre(a) {
  const puntero = { x: a.p0.x + a.dx, y: a.p0.y + a.dy }
  a.puntero = puntero
  // Otro monitor bajo el puntero: su área y sus bordes (9.4)
  if (!dentroDe(puntero, a.area) && !a.pidiendo) {
    a.pidiendo = true
    invocar('geometria', { puntero: true }).then(g => { a.area = g.area; a.libres = g.libres }).catch(() => {}).finally(() => { a.pidiendo = false })
  }
  // La ventana es el área de trabajo entera (9.7): lo que se arrastra se mueve adentro y la ventana
  // queda quieta. Solo al pasar a otro monitor se mueve, una vez y velada
  const ventana = ventanaDeArea(a.area)
  const turno = mismoRect(st.ventana, ventana) ? 0 : movimientoMuesca.velar()
  if (a.origen === 'muesca') moverMuesca(a, puntero, ventana)
  else moverForma(a, puntero)
  if (turno) pedirVentana(ventana, turno)
}

/**
 * Arrastrando la muesca (7.3): cerca de un borde se pega a él y se desliza a lo largo; lejos de
 * todos es la píldora que sigue al puntero. Al pasar de una a otra, la forma viaja de una caja a la
 * otra (6.6), sin aparecer de golpe.
 */
function moverMuesca(a, puntero, ventana) {
  const caja = cajaArrastre(puntero, null, a.tam)
  a.borde = bordeCercano(caja, a.area, a.libres)
  const eraPildora = document.body.classList.contains('pildora')
  if (a.borde) {
    const antes = st.disp?.local.muesca
    const otroBorde = st.acople.borde !== a.borde
    if (otroBorde) {
      st.acople = { borde: a.borde, lugar: 0.5 }
      document.body.dataset.borde = a.borde
    }
    document.body.classList.remove('pildora')
    const tm = tamMuesca()
    st.acople.lugar = lugarAjustado(lugarDe(a.borde, centroDe(caja), a.area), tm.largo, largoDe(a.borde, a.area), zoom())
    colocar(disposicion(a.area, a.tablero))
    const ahora = st.disp.local.muesca
    if (eraPildora && st.pildora) movimientoMuesca.viajar(muescaEl, cajaPildora(st.pildora), ahora, { llega: true })
    else if (otroBorde && antes) movimientoMuesca.viajar(muescaEl, antes, ahora, { llega: true })
  } else {
    // Lejos de todo borde: la píldora flotante sigue al puntero, dentro de la misma ventana
    const p = relativo(caja, ventana, zoom())
    const cuerpo = document.body.style
    cuerpo.setProperty('--px', `${p.x}px`)
    cuerpo.setProperty('--py', `${p.y}px`)
    document.body.classList.add('pildora')
    st.pildora = { x: p.x, y: p.y }
    st.ventana = ventana
    if (!eraPildora && st.disp?.local.muesca) movimientoMuesca.viajar($('#pildora'), st.disp.local.muesca, cajaPildora(st.pildora), { llega: true })
  }
}

/** Arrastrando el tablero flotante o la tira: se mueven adentro de la ventana, con el aviso del imán. */
function moverForma(a, puntero) {
  const caja = cajaArrastre(puntero, a.agarre, a.caja0)
  a.caja = caja
  a.borde = bordeCercano(caja, a.area, a.libres)
  if (a.borde) {
    document.body.dataset.iman = a.borde
    $('#aviso-iman').textContent = `Soltá para acoplar · ${a.borde}`
  } else {
    delete document.body.dataset.iman
  }
  const pos = { x: caja.x, y: caja.y }
  if (a.origen === 'tablero') {
    st.flotante = pos
    colocar(disposicionFlotante(pos, a.caja0, a.area, zoom()))
  } else {
    st.tira = pos
    colocar(disposicionTira(pos, a.caja0, a.area, zoom()))
  }
}

/**
 * Soltado lejos de los bordes: el tablero (o la tira) queda donde se soltó, topado al área; si se
 * había salido, vuelve adentro con el mismo viaje (6.6). La posición del tablero se guarda.
 */
function soltarDentro(a) {
  const tablero = a.origen === 'tablero'
  const el = tablero ? $('#marco') : $('#tira')
  const antes = tablero ? st.disp.local.tablero : st.disp.local.tira
  const pos = posicionEnPantalla(a.caja, a.caja0, a.area)
  if (tablero) {
    st.flotante = pos
    colocar(disposicionFlotante(pos, a.caja0, a.area, zoom()))
  } else {
    st.tira = pos
    colocar(disposicionTira(pos, a.caja0, a.area, zoom()))
  }
  const ahora = tablero ? st.disp.local.tablero : st.disp.local.tira
  if (!mismoRect(antes, ahora)) movimientoMuesca.viajar(el, antes, ahora, { llega: true })
  if (tablero) guardarFlotante()
}

async function soltarArrastre(e) {
  const a = st.arrastre
  if (!a || e.pointerId !== a.id) return
  if (a.cuadro) { cancelAnimationFrame(a.cuadro); a.cuadro = 0; if (a.activo) moverArrastre(a) }
  st.arrastre = null
  document.body.classList.remove('arrastrando')
  if (!a.activo) return
  verAvis()
  // El clic que sigue al soltar no abre la muesca
  justoArrastro = true
  setTimeout(() => { justoArrastro = false }, 0)
  await enviandoVentana
  if (a.origen === 'muesca') {
    if (a.borde) {
      await invocar('guardar_acople', { borde: st.acople.borde, lugar: st.acople.lugar }).catch(err => registrar(`acople: ${err}`))
      // La zona vuelve a ser la muesca: lo demás deja pasar los clics otra vez
      await enviarZona(true)
      programarAjuste()
    } else {
      // La píldora sigue a la vista hasta que el tablero crece desde ella
      await acoplarA(null, { puntero: a.puntero })
    }
  } else {
    delete document.body.dataset.iman
    if (a.borde) {
      await acoplarA(a.borde, { lugar: lugarDe(a.borde, centroDe(a.caja), a.area) })
    } else {
      soltarDentro(a)
      // La zona vuelve a ser el tablero o la tira
      await enviarZona(true)
      programarAjuste()
    }
  }
}
document.addEventListener('pointerup', soltarArrastre)
document.addEventListener('pointercancel', soltarArrastre)

// ------------------------------------------------------------------ primeros pasos (docs/diseno/bienvenida-ux.md)
// Regla firme (10): cada paso corre solo con el clic del usuario. Abrir el asistente o tocar
// "Volver a buscar" solo revisa (lectura); no hay temporizador, ni foco puesto en una acción, ni un
// paso que encadene al siguiente.

function modeloPasos() {
  return modeloAsistente({ revision: st.pp.revision, revisando: st.pp.revisando, ejec: st.pp.ejec })
}

/** Una línea en la región viva (`#anuncio`, 7.2): nunca mueve el foco. */
function anunciar(mensaje) {
  if (mensaje) $('#anuncio').textContent = mensaje
}

const horaLocal = ms => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
/** Posición de lo visible para la dirección del cambio de paso: la escena final va después del paso 3. */
const indiceVisible = v => (v === 'listo' ? PASOS_PP.length : indicePestana(v))

/**
 * Dibuja el escenario o la hoja (`forma`) en #pp, por partes: el marco una vez por forma y después
 * el rótulo, las pestañas, la escena y el pie solo si cambiaron. Conserva el foco del elemento que lo
 * tenía (`data-foco`); si desapareció, va al título del paso, solo si el foco estaba adentro (7.2).
 */
function pintarAsistente(modelo, forma) {
  const pp = st.pp
  const raiz = $('#pp')
  if (forma) {
    const anuncio = anuncioCambio(pp.modelo, modelo)
    if (pp.forma) anunciar(anuncio)
  }
  if (!forma) {
    if (pp.forma) { raiz.innerHTML = ''; pp.forma = null; pp.firmas = {} }
    pp.modelo = modelo
    return
  }
  const activo = document.activeElement
  const clave = raiz.contains(activo) ? (activo.dataset?.foco ?? (activo.id === 'pp-h' ? 'encabezado' : 'titulo')) : null
  const nuevo = pp.forma !== forma
  if (nuevo) {
    raiz.innerHTML = esqueleto(forma)
    pp.forma = forma
    pp.firmas = {}
    pp.visible = null
  }
  // Lo que se ve: el paso que toca al abrir; la escena final solo existe con todo listo
  // Antes de la primera revisión se ve el paso 1 de forma provisoria: llegada la revisión, el que toca
  const provisorio = pp.provisorio && modelo.faltan !== null && !modelo.orden.some(id => modelo.pasos[id].estado === 'revisando')
  if (!pp.visible || provisorio || (pp.visible === 'listo' && !modelo.todoListo && !st.pp.revisando)) {
    pp.visible = visibleInicial(modelo)
    pp.provisorio = modelo.faltan === null
  }
  const r = rotulo(modelo)
  if (pp.firmas.rotulo !== r) { $('#pp-h').textContent = r; pp.firmas.rotulo = r }

  const tabs = pestanas(modelo, pp.visible)
  const pista = $('#pp-tabs')
  if (pp.firmas.tabs !== tabs) {
    pista.innerHTML = tabs
    // Un paso que acaba de quedar hecho: su glifo hace pop y el ✓ se traza (7.1)
    if (!nuevo && pp.modelo) {
      for (const id of modelo.orden) {
        if (modelo.pasos[id].estado === 'hecho' && pp.modelo.pasos[id].estado !== 'hecho') movimientoPasos.marcarHecha($(`#pp-tab-${id}`))
      }
    }
    pp.firmas.tabs = tabs
  }
  const k = indicePestana(pp.visible)
  pista.style.setProperty('--pp-i', String(Math.max(0, k)))
  pista.classList.toggle('sin-elegida', k < 0)

  const escenaEl = $('#pp-escena')
  const html = escenaPasos(modelo, pp.visible, forma, horaLocal)
  if (pp.firmas.escena !== html) {
    const mismoPaso = !nuevo && pp.firmas.visible === pp.visible
    escenaEl.innerHTML = html
    escenaEl.setAttribute('aria-labelledby', k < 0 ? 'pp-titulo' : `pp-tab-${pp.visible}`)
    const p = modelo.pasos[pp.visible]
    escenaEl.setAttribute('aria-busy', String(!!p && (p.categoria === 'corre' || p.estado === 'revisando')))
    if (mismoPaso) movimientoPasos.cambioEstado(escenaEl, { error: p?.categoria === 'falla' })
    pp.firmas.escena = html
    pp.firmas.visible = pp.visible
  }
  const piePp = piePasos(!!navegar(modelo, pp.visible, -1), !!navegar(modelo, pp.visible, 1))
  if (pp.firmas.pie !== piePp) { $('#pp-pie').innerHTML = piePp; pp.firmas.pie = piePp }

  if (clave && !raiz.contains(document.activeElement)) {
    const el = clave === 'encabezado' ? $('#pp-h') : clave === 'titulo' ? $('#pp-titulo') : raiz.querySelector(`[data-foco="${CSS.escape(clave)}"]`)
    ;(el ?? $('#pp-titulo'))?.focus()
  }
  // Aparece (escalonado y con el saludo) solo si se ve: acoplada y cerrada, o escondida, no
  if (nuevo && !st.fuera && !(st.acople && !st.vista)) movimientoPasos.aparecer(raiz.firstElementChild)
  pp.modelo = modelo
}

/** Cambia de paso con un clic (pestaña, Anterior o Siguiente): solo la vista, nunca corre nada. */
async function irAPaso(destino, { foco = 'titulo' } = {}) {
  const pp = st.pp
  if (!destino || destino === pp.visible) return
  pp.provisorio = false
  const direccion = Math.sign(indiceVisible(destino) - indiceVisible(pp.visible)) || 1
  pp.visible = destino
  await movimientoPasos.cambioPaso($('#pp-escena'), direccion, () => pintar())
  if (destino === 'listo') anunciar('Todo listo. Avis está conectado')
  // Anterior y Siguiente llevan el foco al título del paso nuevo (el botón tocado puede quedar deshabilitado)
  if (foco === 'titulo') $('#pp-titulo')?.focus()
  else if (foco === 'tab') $(`#pp-tab-${destino}`)?.focus()
}

/**
 * Abre el asistente a pedido (bandeja o "Ver →"): solo revisa, nunca corre un paso. Con `foco`, el
 * foco va al encabezado del asistente, no a una acción (7.2). Acoplada, abre también el panel.
 */
async function abrirAsistente({ foco = false } = {}) {
  st.pp.abierto = true
  st.pp.cerrado = false
  if (st.mini) await ponerMini(false)
  revisarPasos()
  pintar()
  if (st.acople) {
    evento({ tipo: 'clic' })
    if (foco) { st.focoPendiente = 'pp'; aplicarFoco() }
  } else if (foco) {
    $('#pp-h')?.focus()
  }
}

/** La × y "Ir a Avis": cierran sin hacer nada más; un paso que corre sigue corriendo (3.2). */
function cerrarAsistente() {
  const eraHoja = st.pp.forma === 'hoja'
  st.pp.abierto = false
  st.pp.cerrado = true
  pintar()
  if (eraHoja) $('#otro [data-accion="pp-ver"]')?.focus()
}

/**
 * Revisa la máquina con comandos de solo lectura (3.3): al arrancar, al abrir el asistente, con
 * "Volver a buscar" o "Reintentar" y después de cada paso. La de después de un paso es la
 * verificación (`aLaVista: false`): no pasa los otros pasos a "Revisando". Una revisión pedida
 * mientras corre otra se hace al terminar. Después, el texto del ítem de la bandeja.
 */
function revisarPasos({ aLaVista = true } = {}) {
  if (!tauri?.core) return Promise.resolve()
  if (aLaVista) st.pp.revisando = true
  if (st.pp.leyendo) { st.pp.otraRevision = true; pintar(); return st.pp.promesa }
  st.pp.leyendo = true
  pintar()
  st.pp.promesa = (async () => {
    try {
      do {
        st.pp.otraRevision = false
        const r = await invocar('revisar_primeros_pasos')
        st.pp.revision = r && typeof r === 'object' ? r : {}
        st.pp.ejec = trasRevision(st.pp.ejec, st.pp.revision)
      } while (st.pp.otraRevision)
    } catch (e) {
      registrar(`primeros pasos: ${e}`)
      st.pp.revision ??= {}
    }
    st.pp.revisando = false
    st.pp.leyendo = false
    invocar('menu_primeros_pasos', { faltan: modeloPasos().faltan }).catch(() => {})
    pintar()
  })()
  return st.pp.promesa
}

/** Corre un paso porque el usuario tocó su botón (9.5). Nunca se llama de otra forma. */
async function correrPaso(accion) {
  if (!tauri?.core || !accion) return
  // El usuario ya está adentro: el asistente queda abierto aunque aparezca una sesión
  st.pp.abierto = true
  st.pp.ejec = alEmpezar(st.pp.ejec, accion)
  pintar()
  try {
    await invocar('correr_paso', { paso: accion })
  } catch (e) {
    st.pp.ejec = alEvento(st.pp.ejec, { accion, estado: 'error', comando: accion, linea: String(e), detalle: String(e) }, Date.now())
    pintar()
  }
}

/**
 * Un aviso del paso que corre (`oficina://primeros-pasos`). Al terminar, la verificación de solo
 * lectura (3.3); después de conectar GitHub, el equipo se vuelve a leer con la cuenta nueva.
 */
function alEventoPaso(payload) {
  st.pp.ejec = alEvento(st.pp.ejec, payload, Date.now())
  if (payload?.estado === 'listo' || payload?.estado === 'error') {
    revisarPasos({ aLaVista: false }).then(() => {
      if (payload.estado === 'listo' && (payload.accion === 'conectar' || payload.accion === 'permiso')) leerEquipo()
    })
  }
  pintar()
}

/** "Copiar …": un clic copia; el botón dice "Copiado ✓" 1,6 s sin redibujar la escena (5.3). */
async function copiar(b) {
  try {
    await navigator.clipboard.writeText(b.dataset.valor ?? '')
  } catch (e) {
    registrar(`copiar: ${e}`)
    return
  }
  anunciar(b.dataset.copiado)
  const antes = b.innerHTML
  b.textContent = 'Copiado ✓'
  setTimeout(() => { if (b.isConnected) b.innerHTML = antes }, 1600)
}

/** Los botones del asistente (`data-accion="pp-…"`). Cada uno hace solo lo suyo. */
async function accionPasos(a, b) {
  switch (a) {
    case 'pp-tab': await irAPaso(b.dataset.paso, { foco: 'tab' }); break
    case 'pp-anterior': await irAPaso(navegar(modeloPasos(), st.pp.visible, -1)); break
    case 'pp-siguiente': await irAPaso(navegar(modeloPasos(), st.pp.visible, 1)); break
    case 'pp-cerrar': case 'pp-ir': cerrarAsistente(); break
    case 'pp-ver': await abrirAsistente({ foco: true }); break
    case 'pp-revisar': revisarPasos(); break
    case 'pp-correr': await correrPaso(b.dataset.valor); break
    case 'pp-cancelar': await invocar('cancelar_paso').catch(e => registrar(`cancelar: ${e}`)); break
    case 'pp-abrir': await invocar('abrir_enlace', { cual: b.dataset.valor }).catch(e => registrar(`enlace: ${e}`)); break
    case 'pp-copiar': await copiar(b); break
  }
}

/**
 * Teclado del asistente (7.2): ← → Inicio y Fin mueven el foco entre las pestañas (Enter o Espacio
 * muestran el paso: es el clic del botón); Esc cierra la hoja flotante. Devuelve si la usó.
 */
function teclaPasos(e) {
  const tab = e.target.closest?.('#pp-tabs .pp-tab')
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    const tabs = [...document.querySelectorAll('#pp-tabs .pp-tab')]
    const k = tabs.indexOf(tab)
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (k + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    tabs.forEach((t, i) => { t.tabIndex = i === j ? 0 : -1 })
    tabs[j].focus()
    return true
  }
  // En el escenario flotante Esc no hace nada (cerrar es la ×); acoplada, cierra el panel (7.2 del estilo)
  if (e.key === 'Escape' && st.pp.forma === 'hoja' && !st.acople) {
    e.preventDefault()
    cerrarAsistente()
    return true
  }
  return false
}

/**
 * Acoplada, el panel no se pliega solo mientras se pide el código de GitHub, se muestra o se
 * verifica (5.2): queda fijado y al terminar vuelve a la marca que tenía, salvo que el usuario la
 * haya cambiado mientras tanto (`fijaAlSoltar`). Esc lo cierra igual.
 */
function retenerPanel(modelo, forma) {
  const pp = st.pp
  if (!st.acople) { pp.retuvo = false; return }
  const retener = !!forma && retieneAbierta(modelo)
  if (retener && !pp.retuvo && !st.muesca.fija) {
    pp.retuvo = true
    pp.fijaAntes = st.muesca.fija
    pp.fijaTocada = false
    if (st.muesca.espera?.que === 'cerrar') clearTimeout(relojMuesca)
    st.muesca = { ...st.muesca, fija: true, espera: st.muesca.espera?.que === 'cerrar' ? null : st.muesca.espera }
    pintarControles()
  } else if (!retener && pp.retuvo) {
    pp.retuvo = false
    const fija = fijaAlSoltar({ antes: pp.fijaAntes, actual: st.muesca.fija, tocada: pp.fijaTocada })
    if (st.muesca.fija !== fija) st.muesca = { ...st.muesca, fija }
    pintarControles()
  }
}

// ------------------------------------------------------------------ "¿En qué anda Claude?" (docs/diseno/resumen-ia-ux.md)
// Reglas de oro (1): un clic, nunca solo (la descarga y cada resumen arrancan con un clic; nada se
// pide, se descarga ni se rearma por tiempo o por cambios); el modelo solo resume (este bloque no
// toca responder.js ni respuestas/); nunca tapa una pregunta (la tarjeta va antes que el globo).

const marcaBoton = $('#marca-boton')
/** Dónde se apretó el Avi (px de pantalla): si se movió más que el umbral, no es un clic (3.1). */
let toqueMarca = null
let relojPensando = null, pensandoDe = null, relojHabla = null, relojCopiado = null

/** ¿El globo se ve? Flotando, o acoplada con el panel abierto; ni escondida ni en la tira. */
function resumenALaVista() {
  return !st.fuera && !st.mini && (!st.acople || st.vista)
}

/** La voz y el ánimo del Avi de la marca (6.2 y 6.3): con el globo abierto, la voz manda y no juega. */
function pintarMarca(ahora = Date.now()) {
  const animo = animoMarca(st.proyectos, ahora)
  const r = st.resumen
  marca.voz(vozAvi(r.estado, r.hablando, animo), { hablando: r.hablando })
  marca.animo(animo, reposoPermitido(st.proyectos, ahora) && r.estado === 'cerrado')
  texto('#marca-animo', animoTexto(animo))
}

/** Un aviso en `#anuncio-resumen` (6.4): se vacía antes, así el mismo texto se vuelve a oír. */
function anunciarResumen(mensaje) {
  const el = $('#anuncio-resumen')
  if (!mensaje || !el) return
  el.textContent = ''
  setTimeout(() => { el.textContent = mensaje }, 60)
}

/** Lo de abajo del globo (#pp, conteos, sesiones): se acomoda con FLIP (9.1). */
function hermanosResumen() {
  const lista = []
  for (let el = $('#resumen').nextElementSibling; el; el = el.nextElementSibling) lista.push(el)
  return lista
}

/** Una llamada del plan de `transicion` al backend; si falla, el globo lo dice (nunca reintenta solo). */
function llamarResumen({ comando, args }) {
  if (!tauri?.core) return
  invocar(comando, args).catch(e => {
    registrar(`resumen ${comando}: ${e}`)
    if (comando === 'descargar_modelo') despacharResumen({ tipo: 'fallo', motivo: 'descarga', detalle: String(e) })
    else if (comando === 'pedir_resumen') despacharResumen({ tipo: 'fallo', pedido: args.pedido, motivo: 'otro', detalle: String(e) })
  })
}

/** 60 s pensando sin respuesta: falló por tiempo (6.1). Corre aunque el globo esté cerrado: es trabajo, no movimiento. */
function vigilarPensando() {
  const r = st.resumen
  const de = r.trabajo === 'pensando' ? r.pedido : null
  if (de === pensandoDe) return
  clearTimeout(relojPensando)
  pensandoDe = de
  if (de != null) relojPensando = setTimeout(() => despacharResumen({ tipo: 'vencio', pedido: de }), ESPERA_PENSANDO_MS)
}

/**
 * Pasa un evento por `transicion` (resumen.js), hace las llamadas del plan, avisa al lector de
 * pantalla y vuelve a dibujar el globo y la voz del Avi.
 */
function despacharResumen(evento) {
  const antes = st.resumen
  const { resumen, llamadas } = transicionResumen(antes, evento, { ahoraMs: Date.now(), datos: datosResumen(st.proyectos, Date.now()) })
  if (resumen === antes && !llamadas.length) return
  st.resumen = resumen
  if (resumen.hablando && !antes.hablando) {
    // "contando" dura la cascada de palabras; sin movimiento o sin verse, directo a "feliz"
    if (!hayMovimiento() || !resumenALaVista()) st.resumen = { ...st.resumen, hablando: false }
    else {
      clearTimeout(relojHabla)
      relojHabla = setTimeout(() => despacharResumen({ tipo: 'callado' }), duracionContando(contarPalabras(resumen.texto)))
    }
  }
  for (const l of llamadas) llamarResumen(l)
  vigilarPensando()
  const r = st.resumen
  if (r.estado !== antes.estado) anunciarResumen(anuncioResumen(r.estado, { texto: r.texto, primeraVez: r.primeraVez }))
  else if (r.estado === 'cerrado' && r.sinVer && r.resultado === 'listo' && !(antes.sinVer && antes.resultado === 'listo')) {
    anunciarResumen(anuncioResumen('listo', { abierto: false }))
  }
  pintarMarca()
  pintarResumen()
}

/** Un evento `oficina://resumen` del backend: solo los `tipo` del contrato (8.2); nunca una acción del usuario. */
function alEventoResumen(payload) {
  if (!payload || typeof payload !== 'object' || !EVENTOS_BACKEND.includes(payload.tipo)) return
  despacharResumen(payload)
}

/** `estado_resumen` (8.1): al arrancar y al tocar el Avi con el globo cerrado. Solo lee. */
async function leerEstadoResumen() {
  if (!tauri?.core) return
  try {
    const e = await invocar('estado_resumen')
    if (e && typeof e === 'object') despacharResumen({ ...e, tipo: 'estado' })
  } catch (err) { registrar(`resumen estado: ${err}`) }
}

/** Tocar el Avi (clic sin arrastrar, Enter o Espacio): abre el globo o, abierto, lo cierra (nunca cancela). */
async function tocarMarca() {
  if (st.resumen.estado !== 'cerrado') { despacharResumen({ tipo: 'cerrar' }); return }
  if (!st.resumen.trabajo) await leerEstadoResumen()
  st.resumenFoco = true
  const antes = st.resumen
  despacharResumen({ tipo: 'abrir' })
  // Diagnóstico: con la línea "resumen estado:" del motor, dice por qué ofreció descargar
  registrar(lineaAbrir(antes, st.resumen))
}

marcaBoton.addEventListener('pointerdown', e => { toqueMarca = { x: e.screenX, y: e.screenY } })
marcaBoton.addEventListener('click', e => {
  const toque = toqueMarca
  toqueMarca = null
  // Después de un arrastre real, el clic que sigue se descarta; con el mouse, es clic hasta 4 px (3.1)
  if (justoArrastro) return
  if (e.detail > 0 && toque && superaUmbral(e.screenX - toque.x, e.screenY - toque.y)) return
  tocarMarca()
})

/** Los botones del globo (`data-accion="rz-…"`). Cada uno hace solo lo suyo. */
async function accionResumen(a, b) {
  switch (a) {
    case 'rz-cerrar': case 'rz-ahora-no': despacharResumen({ tipo: 'cerrar' }); break
    case 'rz-descargar': despacharResumen({ tipo: 'descargar' }); break
    case 'rz-cancelar': despacharResumen({ tipo: 'cancelar' }); break
    case 'rz-pedir': despacharResumen({ tipo: 'pedir' }); break
    case 'rz-reintentar': despacharResumen({ tipo: 'reintentar' }); break
    case 'rz-copiar': await copiarResumen(b); break
  }
}

/** "Copiar": el texto plano limpio, sin etiquetas; el botón dice "Copiado" 1,6 s sin redibujar. */
async function copiarResumen(b) {
  try {
    await navigator.clipboard.writeText(st.resumen.texto ?? '')
  } catch (e) {
    registrar(`copiar resumen: ${e}`)
    return
  }
  anunciarResumen('Resumen copiado.')
  const rotuloCopiar = b.querySelector('[data-copiar]')
  if (!rotuloCopiar) return
  rotuloCopiar.textContent = 'Copiado'
  clearTimeout(relojCopiado)
  relojCopiado = setTimeout(() => { if (rotuloCopiar.isConnected) rotuloCopiar.textContent = 'Copiar' }, 1600)
}

/** Se cierra hacia la cola; después se quita y lo de abajo sube con FLIP. El foco, si estaba adentro, vuelve al Avi. */
async function cerrarGlobo(el) {
  st.resumenSaliendo = true
  const quieto = !!st.transicion || !!st.arrastre?.activo || !resumenALaVista()
  await movimientoResumen.cierra(el.querySelector('.rz-globo'), { quieto })
  st.resumenSaliendo = false
  // Se volvió a abrir mientras se cerraba: pintarResumen ya lo redibujó
  if (st.resumen.estado !== 'cerrado') return
  const devolver = el.contains(document.activeElement)
  const alto = el.offsetHeight
  el.innerHTML = ''
  st.firmas['#resumen'] = null
  movimientoResumen.flip(hermanosResumen(), alto, { quieto })
  if (devolver) marcaBoton.focus({ preventScroll: true })
}

/**
 * Dibuja el globo (3.2 y 7): se redibuja solo si cambió su contenido (la firma, sin el progreso, la
 * cola ni el aviso "Cambió algo", que se reescriben en su lugar), así una lectura de 1,5 s no se
 * lleva la selección ni el foco. Al abrirse, el foco va a su primer `data-foco` y la columna se
 * desplaza lo justo para mostrarlo; al cambiar de estado con el foco adentro, el foco lo sigue.
 */
function pintarResumen() {
  const r = st.resumen
  const el = $('#resumen')
  marcaBoton.setAttribute('aria-expanded', String(r.estado !== 'cerrado'))
  if (r.estado === 'cerrado') {
    st.resumenFoco = false
    if (el.childElementCount && !st.resumenSaliendo) cerrarGlobo(el)
    return
  }
  // Se volvió a abrir mientras se cerraba: el globo se redibuja entero
  if (st.resumenSaliendo) st.firmas['#resumen'] = null
  const cola = colaResumen({ hayAviso: $('#otro').childElementCount > 0, hayPregunta: $('#w-globo').childElementCount > 0 })
  const m = {
    ...r, cola,
    proyectos: st.proyectos.filter(p => p.repo).map(p => ({ nombre: p.nombre, color: colorProyecto(p.nombre) })),
  }
  const firma = contenidoResumen({ ...m, cola: true, cascada: false, cambio: false, progreso: r.estado === 'descargando' ? null : r.progreso })
  const quieto = !!st.transicion || !!st.arrastre?.activo || !resumenALaVista()
  if (st.firmas['#resumen'] !== firma) {
    const nuevo = !el.childElementCount || st.resumenSaliendo
    const enfocado = el.contains(document.activeElement)
    movimientoResumen.terminar()
    const altoAntes = nuevo ? 0 : el.offsetHeight
    const cascada = r.estado === 'listo' && r.hablando
    st.firmas['#resumen'] = firma
    el.innerHTML = contenidoResumen({ ...m, cascada })
    const globoEl = el.querySelector('.rz-globo')
    const delta = altoAntes - el.offsetHeight
    if (nuevo) {
      movimientoResumen.nace(globoEl, { quieto })
      movimientoResumen.flip(hermanosResumen(), delta, { quieto })
    } else {
      movimientoResumen.cambia(globoEl, hermanosResumen(), delta, { quieto })
    }
    if (cascada) movimientoResumen.palabras(globoEl, { quieto })
    // Con desborde, el texto se puede desplazar con el teclado y se funde abajo
    const t = el.querySelector('[data-texto]')
    if (t && t.scrollHeight > t.clientHeight + 1) {
      t.classList.add('desborda')
      t.tabIndex = 0
      t.setAttribute('aria-label', 'Texto del resumen')
    }
    if (st.resumenFoco || enfocado) {
      el.querySelector('[data-foco]')?.focus({ preventScroll: true })
      if (st.resumenFoco) el.scrollIntoView({ block: 'nearest', behavior: hayMovimiento() ? 'smooth' : 'auto' })
      st.resumenFoco = false
    }
  }
  // Lo que cambia sin redibujar: la cola, el progreso de la descarga y el aviso "Cambió algo"
  el.querySelector('.rz-globo')?.classList.toggle('cola', cola)
  if (r.estado === 'descargando') {
    const c = cifrasDescarga(r.progreso)
    const barra = el.querySelector('[data-barra]')
    texto('#resumen [data-gb]', c.cifra)
    texto('#resumen [data-pc]', `${c.porcentaje} %`)
    texto('#resumen .cifra small', `de ${c.total}`)
    if (barra) {
      barra.style.setProperty('--p', String(c.fraccion))
      barra.setAttribute('aria-valuenow', String(c.porcentaje))
    }
  }
  const aviso = el.querySelector('[data-cambio]')
  if (aviso && aviso.hidden === r.cambio) {
    aviso.hidden = !r.cambio
    if (r.cambio) movimientoResumen.entra(aviso, { quieto })
  }
}

async function iniciar() {
  // Las definiciones de los Avis (piel, luz de piso y desenfoque), una vez por documento (5.1)
  document.body.insertAdjacentHTML('afterbegin', defsAvis())
  if (tauri?.core) {
    try {
      const m = await invocar('estado_menu')
      if (typeof m.arriba === 'boolean') ponerArriba(m.arriba)
      if (typeof m.avisar === 'boolean') st.avisar = m.avisar
      if (typeof m.pausa === 'boolean') ponerPausa(m.pausa)
      // Dónde quedó el tablero flotante la última vez (fracciones del área, 9.7)
      if (m.flotante && typeof m.flotante === 'object') st.fraccion = { x: Number(m.flotante.x), y: Number(m.flotante.y) }
      // Acoplada al cerrar la última vez: vuelve como muesca. Rust ya puso la ventana en el área del
      // monitor de la última vez (9.7): la muesca va a su borde sin velo
      if (typeof m.acople?.borde === 'string') {
        st.acople = { borde: m.acople.borde, lugar: Number(m.acople.lugar) }
        aplicarModo()
      }
      await aplicarTamano(typeof m.tamano === 'number' ? m.tamano : PASO_POR_DEFECTO)
    } catch { await aplicarTamano(PASO_POR_DEFECTO) }
    const escuchar = tauri.event.listen
    escuchar('oficina://arriba', ev => ponerArriba(!!ev.payload))
    escuchar('oficina://avisar', ev => { st.avisar = !!ev.payload })
    escuchar('oficina://pausa', ev => ponerPausa(!!ev.payload))
    escuchar('oficina://tamano', ev => aplicarTamano(Number(ev.payload)))
    // Se abrió Avis otra vez estando en la tira mini: volver a la ventana completa
    escuchar('oficina://expandir', () => ponerMini(false))
    // "Acoplar a" de la bandeja (7.3): un borde o Flotante (null)
    escuchar('oficina://acoplar', ev => acoplarA(typeof ev.payload === 'string' ? ev.payload : null))
    // "Mostrar Avis", la notificación o abrir Avis otra vez: acoplada, abre el panel
    escuchar('oficina://abrir', () => { if (st.acople) evento({ tipo: 'clic' }) })
    // El puntero entró o salió de la zona interactiva (9.6); un aviso más viejo que el último se descarta
    // Acoplada: el puntero global (px lógicos de pantalla) para la mirada del Avi a la vista; cada motor
    // lo ignora si no se ve (marca-avi-ux.md 6 y muesca-avi-ux.md 9)
    escuchar('oficina://cursor', ev => {
      const p = ev.payload
      if (!st.acople || !st.ventana || typeof p?.x !== 'number' || typeof p?.y !== 'number') return
      marca.cursor(p.x - st.ventana.x, p.y - st.ventana.y)
      muescaAvi.cursor(p.x - st.ventana.x, p.y - st.ventana.y)
    })
    escuchar('oficina://puntero-zona', ev => {
      const n = ev.payload?.n
      if (typeof n !== 'number' || n <= st.zonaN) return
      st.zonaN = n
      ponerDentro(!!ev.payload.dentro)
    })
    // Primeros pasos: el ítem de la bandeja abre el asistente (3.5) y cada paso que corre avisa (9.5)
    escuchar('oficina://primeros-pasos-abrir', () => abrirAsistente({ foco: true }))
    escuchar('oficina://primeros-pasos', ev => alEventoPaso(ev.payload))
    // El resumen (resumen-ia-ux.md 8.2): un solo evento con `tipo`; solo avanza lo que ya se pidió
    escuchar('oficina://resumen', ev => alEventoResumen(ev.payload))
    // Al arrancar se lee qué hay del modelo (solo lectura, sin red); nunca en el ciclo de 1,5 s
    leerEstadoResumen()
  } else {
    // Sin Tauri (el HTML abierto solo): la ventana del navegador hace de área
    await aplicarTamano(PASO_POR_DEFECTO)
    colocar(disposicionActual({ x: 0, y: 0, ancho: innerWidth, alto: innerHeight }))
  }
  ciclo()
  cicloEquipo()
  // Al arrancar se revisa qué falta (solo lectura, 3.3); nunca en el ciclo de 1,5 s
  revisarPasos()
}

iniciar()
