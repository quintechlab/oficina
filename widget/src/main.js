// Ventana del widget: lee las sesiones locales cada 1,5 s y el equipo cada 60 s, y pinta el
// tablero (barra de proyectos, encabezado, chips de conteo, escenas de las sesiones y equipo), la tarjeta de pregunta, la tira mini,
// la bandeja y los avisos. Cada parte se redibuja solo si cambió lo que muestra, para no cortar
// las animaciones.

import { agruparPorProyecto, preguntasPendientes, preguntasNuevas, resumenMini, escapar, reposoPermitido, superaUmbral, animoSesion } from './logica.js'
import { companeros } from './equipo.js'
import { iconoBandeja, textoInsignia } from './bandeja.js'
import {
  zoomDe, direccionDeTecla, tamanoDeseado, fueraDeLugar, posicionEnPantalla, tamanoMini, medidaVentana, PASO_POR_DEFECTO,
  fraccionFlotante, posicionDeFraccion,
} from './tamano.js'
import { textoRespondido, estadoEnvio, objetivoDelClic, registrarEleccion, alternarSeleccion, motivoRechazo, lineaClic } from './responder.js'
import {
  prepararProyecto, firmaEscenas, sesiones, carasMini, companero, firmaCompanero,
  barraProyectos, animoMarca, estadoMarca, figuraMarca, figuraVacio, conteos, chips, lineaEncabezado, colorProyecto, animoTexto,
} from './tablero.js'
import {
  vistaBarra, clicFrenar, validarTexto, teclaControl, lineaResultado, lineaError, pasoOrden,
  borradorTrasOrden, lineaAlEscribir, MS_CONFIRMAR_FRENAR, MS_SONDEO_ORDEN, MS_LINEA,
} from './control.js'
import { globo, avisoOtroProyecto, quienPregunta, anuncioPregunta } from './pregunta.js'
import { defsAvis, nombreClaude } from './avis.js'
import { especieValida, ESPECIE_POR_DEFECTO, datosEspecie } from './especies.js'
import { avanzarEvolucion, coordinaciones, debeActuar, ordenActos, actoPendiente, CLAVE_MARCA, TAMANO_MIN_ACTO } from './evolucion.js'
import * as movimientoEvolucion from './evolucionMotion.js'
import { entrada, cambioProyecto, hayMovimiento } from './tableroMotion.js'
import { entradaEscenas, idsDeEscena, novedades, marcarNuevos, vigilarEscenas } from './escenaMotion.js'
import { montarMarca } from './marcaMotion.js'
import { pesosMarca } from './marca.js'
import {
  esHorizontal, bordeCercano, lugarDe, lugarAjustado, disposicionAcoplada, zonaInteractiva, recorte, cajaArrastre,
  posicionFlotante, dentroDe, ventanaDeArea, mismoRect, relativo, estadoMuesca, contenidoMuesca, contenidoPildora, estiloMuesca, ESTADO_INICIAL, siguiente, tocaGolpe, PILDORA,
  planVentana, tamMuescaDe, figuraMuesca, disposicionFlotante, disposicionTira, plegadoHacia, anclaHacia, fueraDelBorde, centroDe,
} from './muesca.js'
import * as movimientoMuesca from './muescaMotion.js'
import {
  PASOS as PASOS_PP, modeloAsistente, formaAsistente, nombreMuesca, alEmpezar, alEvento, trasRevision, anuncioCambio,
  retieneAbierta, fijaAlSoltar, navegar, visibleInicial, alModAuto, textoAvisoMod,
} from './primerosPasos.js'
import { esqueleto, rotulo, pestanas, indicePestana, escena as escenaPasos, pie as piePasos, avisoAsistente, avisoMod } from './primerosPasosVista.js'
import * as movimientoPasos from './primerosPasosMotion.js'
import {
  chatInicial, transicionChat, ocupado, datosAvis, relojEspera, tramoVivo, markdownSeguro, sugerencias, nombreCarpeta,
  carpetasDeProyectos, ladoHoja, rectHoja, SALUDA_MS, FELIZ_MS, ADELANTO_PLIEGUE_MS, aArchivo, guardadosPendientes, GUARDAR_CADA_MS,
  sobreHoja, nombreArchivo, puedeVencer,
} from './chat.js'
import { aviEscena, estadoEscena, cabecera, hilo as hiloVista, composer, menuCarpeta, cajon, listaHistorial, capaSoltar, htmlPalabras, clipAdjuntar } from './chatVista.js'
import * as movimientoChat from './chatMotion.js'
import {
  conversaciones, conversacionesNuevas, mensajesNuevos, convsVisibles, debeAbrirseSola, ladoIzquierdo, primeroDe, pausaVuelta, nombreLado, textoSub,
  geometriaDividida, cuentaVuelta, rastroConversa, anuncioEmpieza, anuncioTermina, esperaRespuesta, RECIEN_SOLA_MS, CONTESTO_MS, ESPERA_VUELTA_MS,
} from './dividida.js'
import { fichasConversan, riel, cabConversa, pestanas as pestanasConv, mitades, firmaMitades, puente, fichaUltimo } from './divididaVista.js'
import * as movimientoDividida from './divididaMotion.js'

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
  /** El subagente con el detalle desplegado en su tarjeta (#14): { sesion, id }, o null. Uno por vez. */
  detalleSub: null,
  /**
   * Barra de control de cada sesión (#19), por id de sesión: `borrador` (lo escrito, así un redibujo
   * no lo pierde), `confirmaHasta` (Frenar pidiendo el segundo clic), `pendiente` { tipo, desde }
   * mientras la sesión no toma la orden y `linea` { texto, tono, desde } con lo que pasó.
   */
  control: {},
  /** El IME está componiendo una palabra en una barra: las escenas no se redibujan hasta que termine. */
  componiendo: false,
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
  /**
   * La mascota elegida para Claude (docs/diseno/mascotas-avi-ux.md 9.1): `mascota` de preferencias.json,
   * leída al arrancar. Hasta Configuración (#23) no cambia con la ventana abierta.
   */
  mascota: ESPECIE_POR_DEFECTO,
  /**
   * La evolución (docs/diseno/mascotas-avi-ux.md 6): el estado de cada clave (una por sesión y
   * `'marca'`) → { estado: 'base' | 'evo' | 'cuenta', hasta }, las claves con la forma evolucionada
   * (lo que dibujan las figuras de Claude), los actos de la última vuelta (se hacen después de
   * pintar), las figuras con el acto de la apertura pendiente (S4) y el temporizador al `hasta`.
   */
  evolucion: new Map(),
  formas: new Set(),
  actosEvo: [],
  pendientesEvo: new Set(),
  temporizadorEvo: null,
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
    /** El aviso de una vez del mod automático (#17, `tomar_aviso_mod`): se va con su clic. */
    avisoMod: null,
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
  /** El último HTML de lo que se pinta con `ponerVivo` (para reescribir en su lugar lo que cambia con el tiempo). */
  htmlVivo: {},
  /**
   * Pantalla dividida (docs/diseno/dividida-ux.md 14): la conversación del split (`clave`, null en la
   * vista normal), el lado izquierdo fijado por conversación, la vista anterior ({ repo, scroll,
   * nombre }), si se abrió sola o con un clic, las que cerraste (no se reabren solas), las conocidas
   * (null antes de la primera lectura), las de la última lectura, los puntos y latidos pendientes, las
   * retiradas (su ficha se fue con la vuelta), las que esperan una transición, la cuenta de la vuelta.
   */
  dividida: {
    clave: null, izq: new Map(), vista: null, origen: null, abiertaEn: 0,
    descartadas: new Set(), conocidas: null, convs: [], ultimos: new Map(),
    nuevas: new Set(), latir: new Map(), retiradas: new Set(), pendientes: new Set(), terminadas: new Set(),
    cruces: [], congelaHasta: 0, cuenta: null, relojCuenta: null, dentro: false, animando: false,
    // La vista de desarrollo puede acortar la cuenta (window.__esperaVuelta, ver dev/falso.js)
    esperaVuelta: Number(window.__esperaVuelta) || ESPERA_VUELTA_MS,
  },
  // ---- la charla con la mascota (docs/diseno/chat-avis-ux.md): solo se manda con un clic o Enter
  /** La hoja y su conversación (3.3): la maneja `transicionChat` (chat.js). */
  chat: chatInicial(),
  /** Cuándo apareció la charla vacía de ahora: la mascota saluda 1,2 s (3.3). */
  chatSaludo: null,
  /** La hoja se veía en la última vuelta (se redibuja al volver a verse, no en cada lectura). */
  hojaVista: false,
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
/**
 * Abre (`nuevo`) o pliega (null) el detalle de un subagente y redibuja; el foco queda en el botón
 * del Avi `foco` (el de la tarjeta redibujada).
 */
function alternarDetalle(nuevo, foco) {
  st.detalleSub = nuevo
  pintar()
  const sel = `.sub-boton[data-sesion="${CSS.escape(foco.sesion)}"][data-id="${CSS.escape(foco.id)}"]`
  document.querySelector(sel)?.focus({ preventScroll: true })
  const det = document.querySelector('.det-sub')
  if (!nuevo || !det) return
  // La entrada corre solo al abrir; los redibujos por un paso nuevo no la repiten
  det.classList.add('entra')
  // Se saca cuando terminó todo: el detalle (560 ms) y el último paso de la escalera (180 + 620 ms)
  setTimeout(() => det.classList.remove('entra'), 900)
  det.scrollIntoView({ block: 'nearest' })
}

function pintarEscenas(proyecto, preparadas, ahora, rastros) {
  const raiz = $('#sesiones')
  // Un detalle abierto de una sesión que ya no está en este proyecto se olvida
  if (st.detalleSub && !preparadas.some(({ s }) => s.sesion === st.detalleSub.sesion)) st.detalleSub = null
  const html = sesiones(preparadas, ahora, rastros, st.detalleSub, st.control, st.mascota, st.formas)
  const firma = firmaEscenas(proyecto.repo, preparadas, rastros, st.detalleSub)
  const ids = idsDeEscena(proyecto.repo, preparadas)
  const foco = focoEnBarra()
  // Mientras el IME compone una palabra en una barra no se redibuja: se cortaría la composición
  if (foco && st.componiendo) return
  if (st.firmas['#sesiones'] === firma && html !== st.htmlEscenas && !actualizarTiempos(raiz, html)) st.firmas['#sesiones'] = null
  if (poner('#sesiones', html, firma)) {
    marcarNuevos(raiz, novedades(st.idsEscena, ids))
    vigilarEscenas($('.principal'))
    // La barra se redibujó con el borrador guardado: el foco y el cursor vuelven a donde estaban
    devolverFoco(foco)
  }
  st.htmlEscenas = html
  st.idsEscena = ids
  refrescarBarras(ahora)
}

// ------------------------------------------------------------------ barra de control (#19)
// Mandarle un mensaje a Claude o frenar el turno desde la tarjeta. Solo un clic o un Enter del
// usuario escribe una orden; nada se manda solo ni por tiempo. Frenar pide un segundo clic (D2).

/** Estado de la barra de una sesión (se crea vacío). */
const ctl = sesion => (st.control[sesion] ??= {})

const barraDe = sesion => document.querySelector(`#sesiones .ctl[data-sesion="${CSS.escape(sesion)}"]`)

/** Dónde está el foco, si está en una barra: su sesión, el control y, en el campo, el cursor. */
function focoEnBarra() {
  const el = document.activeElement
  const barra = el?.closest?.('#sesiones .ctl')
  if (!barra || !el.dataset.rol) return null
  const f = { sesion: barra.dataset.sesion, rol: el.dataset.rol }
  if (el.tagName === 'TEXTAREA') Object.assign(f, { ini: el.selectionStart, fin: el.selectionEnd, dir: el.selectionDirection, scroll: el.scrollTop })
  return f
}

/** Devuelve el foco tras un redibujo; si su botón ya no se puede usar, el foco va al campo. */
function devolverFoco(f) {
  const barra = f && barraDe(f.sesion)
  if (!barra) return
  const el = barra.querySelector(`[data-rol="${f.rol}"]`)
  const destino = !el || el.hidden || el.disabled ? barra.querySelector('[data-rol="in"]') : el
  destino.focus({ preventScroll: true })
  if (destino === el && f.ini != null) {
    el.setSelectionRange(f.ini, f.fin, f.dir)
    el.scrollTop = f.scroll
  }
}

/** Reinicia la entrada suave de un elemento (la línea del resultado que cambia). */
function reanimar(el) {
  el.classList.remove('nueva')
  void el.offsetWidth
  el.classList.add('nueva')
}

/**
 * Pone en su lugar lo que cambia de una barra (botones, cola y línea) sin tocar el campo: lo escrito,
 * el cursor y el foco quedan. Si el foco estaba en un botón que se deshabilita o se esconde, pasa al campo.
 */
function refrescarBarra(barra, ahora = Date.now()) {
  const sesion = barra.dataset.sesion
  const s = st.sesiones.find(x => x.sesion === sesion)
  if (!s) return
  const v = vistaBarra(s, st.control[sesion], ahora)
  const [campo, env, fr, res] = ['in', 'env', 'frenar', 'res'].map(r => barra.querySelector(`[data-rol="${r}"]`))
  const cola = barra.querySelector('.ctl-cola')
  const enfocado = document.activeElement
  const ui = ctl(sesion)
  env.disabled = !v.puedeEnviar
  fr.hidden = !v.frenar.visible
  // Frenar entra suave cuando la sesión empieza a trabajar (también si la tarjeta se redibujó)
  if (v.frenar.visible && ui.frenarVisible === false) reanimar(fr)
  ui.frenarVisible = v.frenar.visible
  fr.disabled = v.ocupada
  // La barrita de la confirmación arranca llena cuando el botón pasa a confirmar
  if (v.frenar.confirma && !fr.classList.contains('confirma')) fr.style.removeProperty('--ya')
  fr.classList.toggle('confirma', v.frenar.confirma)
  if (fr.textContent !== v.frenar.etiqueta) fr.textContent = v.frenar.etiqueta
  if (fr.getAttribute('aria-label') !== v.frenar.nombre) fr.setAttribute('aria-label', v.frenar.nombre)
  cola.hidden = !v.cola
  if (cola.textContent !== (v.cola ?? '')) cola.textContent = v.cola ?? ''
  const texto = v.linea?.texto ?? ''
  if (res.textContent !== texto) {
    res.textContent = texto
    res.dataset.tono = v.linea?.tono ?? ''
    if (texto) reanimar(res)
  }
  if ((enfocado === env || enfocado === fr) && (enfocado.disabled || enfocado.hidden)) campo.focus({ preventScroll: true })
}

function refrescarBarras(ahora = Date.now()) {
  for (const barra of document.querySelectorAll('#sesiones .ctl')) refrescarBarra(barra, ahora)
}

/** Un clic en Frenar: el primero pide confirmar por 3 s (vuelve solo); el segundo frena. */
function tocarFrenar(sesion) {
  const ui = ctl(sesion)
  if (ui.pendiente) return
  const ahora = Date.now()
  const r = clicFrenar(ui, ahora)
  ui.confirmaHasta = r.confirmaHasta
  clearTimeout(ui.reloj)
  if (r.frenar) { ordenar(sesion, 'frenar'); return }
  refrescarBarras(ahora)
  ui.reloj = setTimeout(() => refrescarBarras(), MS_CONFIRMAR_FRENAR + 20)
}

/** Pone el borrador de una sesión y su campo, solo si cambió (así no se mueve el cursor de lo escrito). */
function ponerBorrador(sesion, valor) {
  const ui = ctl(sesion)
  if (ui.borrador === valor) return
  ui.borrador = valor
  const campo = barraDe(sesion)?.querySelector('[data-rol="in"]')
  if (campo && campo.value !== valor) campo.value = valor
}

/**
 * Escribe la orden (`mensaje` con el borrador, o `frenar`) y la sigue cada 500 ms: la sesión la toma
 * y la reescribe con su resultado; a los 10 s sin tomarla se borra para que no se ejecute tarde. El
 * mensaje nunca se pierde: el campo se vacía solo si el mod confirma `enviado` o `en-cola`
 * (`borradorTrasOrden`); con cualquier otro final lo escrito queda.
 */
async function ordenar(sesion, tipo) {
  const ui = ctl(sesion)
  if (ui.pendiente || !tauri?.core) return
  const borrador = ui.borrador
  let texto = null
  if (tipo === 'mensaje') {
    const v = validarTexto(borrador)
    if (v.error) return
    texto = v.texto
  }
  ui.pendiente = { tipo, desde: Date.now() }
  ui.linea = null
  refrescarBarras()
  let id
  try {
    id = await invocar('ordenar', { sesion, tipo, texto })
  } catch (e) {
    registrar(`orden ${tipo} a ${sesion}: no se escribió (${e})`)
    ui.pendiente = null
    ui.linea = { ...lineaError(tipo, e), desde: Date.now() }
    if (tipo === 'mensaje') ponerBorrador(sesion, borradorTrasOrden({ resultado: 'error', enviado: borrador, actual: ui.borrador }))
    refrescarBarras()
    return
  }
  registrar(`orden ${tipo} ${id} a ${sesion}`)
  const desde = Date.now()
  for (;;) {
    await new Promise(r => setTimeout(r, MS_SONDEO_ORDEN))
    const estado = await invocar('estado_orden', { sesion, id }).catch(() => ({ estado: 'pendiente' }))
    const paso = pasoOrden(estado, Date.now() - desde)
    if (paso === 'esperar') continue
    // Leída (la sesión no la borra) o sin tomar a los 10 s: se borra; si no está, no se toca nada
    if (paso !== 'perdida') await invocar('borrar_orden', { sesion }).catch(() => {})
    const resultado = paso === 'listo' ? estado.resultado : paso
    registrar(`orden ${tipo} ${id} a ${sesion} -> ${resultado}${estado?.motivo ? ` (${estado.motivo})` : ''}`)
    ui.pendiente = null
    ui.linea = { ...lineaResultado({ tipo, resultado, motivo: estado?.motivo }), desde: Date.now() }
    if (tipo === 'mensaje') ponerBorrador(sesion, borradorTrasOrden({ resultado, enviado: borrador, actual: ui.borrador }))
    refrescarBarras()
    // La línea se va sola; el ciclo de 1,5 s la saca, esto la saca a tiempo si la ventana está quieta
    setTimeout(() => refrescarBarras(), MS_LINEA + 20)
    return
  }
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
  const r = resumenMini(st.proyectos, ahora, st.mascota)
  poner('#tira-caras', carasMini(r.caras, st.mascota, st.formas), r.caras.map(c => `${c.nombre}:${c.animo}:${c.variante ?? ''}`).join(','))
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
  for (const c of gente) html.push(companero(c, ahora, st.abiertos.has(c.usuario), st.mascota, st.formas))
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
  // Manos del alféizar y luz de cara del color de la mascota (mascotas-avi-ux.md 16.1.4)
  for (const [k, v] of Object.entries(estiloMuesca(st.mascota))) {
    if (boton.style.getPropertyValue(k) === v) continue
    if (v) boton.style.setProperty(k, v)
    else boton.style.removeProperty(k)
  }
  texto('#muesca .cuenta', e.sesiones ? String(e.sesiones) : '')
  texto('#muesca .excl', e.globo || '!')
  poner('#pildora', contenidoPildora(e, st.mascota, st.formas), `${e.animo}|${e.pregunta}|${e.chip}`)
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
// Todas las especies juegan el mismo repertorio, con sus propios canales (mascotas-avi-ux.md 10, P3; pesosMarca)
const marca = montarMarca($('#marca-avi'), { escala: Number(window.__escalaReposo) || 1, figura: animo => figuraMarca(animo, st.mascota, st.formas), pesosDe: () => pesosMarca(st.mascota) })

// La muesca A "Asoma" (docs/diseno/muesca-avi-ux.md): el armazón una sola vez y, adentro, el Avi de
// Claude que asoma, movido por el mismo motor que la marca (solo el cucú; el curioseo se repite)
$('#muesca').innerHTML = contenidoMuesca()
const muescaAvi = montarMarca($('#muesca-avi'), { escala: Number(window.__escalaReposo) || 1, figura: animo => figuraMuesca(animo, st.mascota, st.formas), repertorio: 'cucu', sigueOcupado: true })

/**
 * Qué Avi se ve (marca-avi-ux.md 7.1 y muesca-avi-ux.md 7.1): la marca flotante, o acoplada con el
 * panel abierto; el de la muesca acoplada y cerrada, sin píldora ni arrastre. Ninguno escondido,
 * minimizado ni en la tira. Movimiento reducido y "Pausar animaciones" los revisa marcaMotion.js.
 * Si cambia cuál quiere el puntero, la zona se vuelve a mandar (`mirada`, 9).
 */
function verAvis() {
  // En la pantalla dividida el riel lleva a Claude de 34 sin juegos: el motor de la marca no corre (5.1).
  // Con la hoja de la charla abierta, la mascota se mudó a su escenario: la marca queda quieta (chat-avis-ux.md 3.2)
  marca.visible(!st.fuera && !st.mini && (!st.acople || st.vista) && !st.dividida.clave && !st.chat.abierta && !hojaCerrando, !!st.acople)
  // Lo de la dividida que corre con WAAPI (un cruce, un latido) termina si el panel deja de verse, y
  // la cuenta de la vuelta se pausa (10.2)
  if (st.dividida.clave) {
    if (!panelSeVe()) movimientoDividida.detener()
    revisarCuenta(Date.now())
  }
  // La hoja de la charla, plegada o escondida, no se dibuja; al volver a verse se pone al día. El
  // sondeo de 1,5 s no la toca (13): solo cuando empieza a verse
  const hojaVe = hojaSeVe()
  if (hojaVe && !st.hojaVista) programarHoja()
  st.hojaVista = hojaVe
  muescaAvi.visible(!!st.acople && !st.vista && !st.fuera && !st.mini && !document.body.classList.contains('pildora') && !st.arrastre?.activo, true)
  enviarZona()
  // Una figura que empieza a verse puede tener su acto de la apertura pendiente (mascotas-avi-ux.md 6.8)
  programarFormas()
}

// ------------------------------------------------------------------ evolución (docs/diseno/mascotas-avi-ux.md 6)
// La mascota de Claude evoluciona mientras coordina un equipo. El estado es de main.js (st.evolucion);
// las figuras se dibujan con la forma de su clave (st.formas) y, después de cada pintada, la clase
// `evol` se pone o se saca en su lugar, nunca redibujando (6.7). Los actos los dibuja evolucionMotion.js.

/** Las figuras de 66 px o más de una clave (las que pueden hacer un acto): marca y muesca, o tarjeta y mitad. */
const figurasDeClave = clave => (clave === CLAVE_MARCA ? ['marca', 'muesca'] : [`tarjeta:${clave}`, `mitad:${clave}`])
const claveDeFigura = id => (id === 'marca' || id === 'muesca' ? CLAVE_MARCA : id.slice(id.indexOf(':') + 1))

/** La figura de un SVG con clave (o null para las caras chicas, que nunca actúan). */
function idFigura(svg) {
  if (svg.classList.contains('chica')) return null
  if (svg.closest('#marca-avi')) return 'marca'
  if (svg.closest('#muesca-avi')) return 'muesca'
  if (svg.closest('#sesiones')) return `tarjeta:${svg.dataset.evo}`
  if (svg.closest('#split-g')) return `mitad:${svg.dataset.evo}`
  return null
}

/**
 * ¿Se ve la figura? (6.8): la marca con el panel a la vista, la muesca cerrada a la vista, la tarjeta
 * sin `.quieta` y dentro de la columna, la mitad con la dividida abierta; nunca escondida ni minimizada.
 */
function figuraSeVe(lugar, svg) {
  if (st.fuera || st.mini) return false
  if (lugar === 'marca') return (!st.acople || st.vista) && !st.dividida.clave
  if (lugar === 'muesca') return !!st.acople && !st.vista && !document.body.classList.contains('pildora') && !st.arrastre?.activo
  if (!panelSeVe()) return false
  if (lugar === 'mitad') return !!st.dividida.clave
  if (st.dividida.clave || svg.closest('.quieta')) return false
  const r = svg.getBoundingClientRect()
  const c = $('.principal')?.getBoundingClientRect()
  return r.width > 0 && (!c || (r.bottom > c.top && r.top < c.bottom))
}

/**
 * Una vuelta del controlador (6.4 y 6.5): en cada lectura y al `hasta` más próximo (así la vuelta sale
 * a los 20 s justos). Los actos de la apertura quedan pendientes por figura (S4); los demás, para
 * después de pintar. Las sesiones del equipo cuentan para sus filas compactas.
 */
function actualizarEvolucion(ahora = Date.now()) {
  const otras = st.equipo.lista.map(c => c.principal).filter(Boolean)
  const r = avanzarEvolucion(st.evolucion, coordinaciones(st.proyectos, otras), ahora)
  st.evolucion = r.mapa
  st.formas = r.formas
  for (const a of r.actos) {
    if (a.acto === 'evoluciona' && a.apertura) for (const id of figurasDeClave(a.clave)) st.pendientesEvo.add(id)
    else st.actosEvo.push(a)
  }
  for (const id of st.pendientesEvo) if (!st.evolucion.has(claveDeFigura(id))) st.pendientesEvo.delete(id)
  clearTimeout(st.temporizadorEvo)
  st.temporizadorEvo = r.proximo == null ? null : setTimeout(() => { actualizarEvolucion(); pintar() }, Math.max(0, r.proximo - ahora))
}

/** El nombre accesible de una figura con nombre (la marca, el riel): "Claude (Faro), …" (12). */
function nombrarFigura(svg, evol) {
  const span = svg.parentElement
  if (span?.getAttribute('role') !== 'img') return
  const nombre = span.getAttribute('aria-label') ?? ''
  const nuevo = nombre.replace(/^Claude( \([^)]*\))?/, nombreClaude(st.mascota, evol))
  if (nuevo !== nombre) span.setAttribute('aria-label', nuevo)
}

const vistasEvo = new WeakSet()
let formasProgramadas = false

/** Después de la pintada en curso (en la misma tarea, antes de dibujar el cuadro): `aplicarFormas`. */
function programarFormas() {
  if (formasProgramadas) return
  formasProgramadas = true
  queueMicrotask(() => { formasProgramadas = false; aplicarFormas() })
}

/**
 * Los actos y la forma en su lugar (6.7 a 6.10): los actos de esta vuelta en las figuras que se ven
 * (los otros se pierden), los pendientes de la apertura que ahora se ven, todos escalonados 250 ms; y
 * en cada figura sin acto, `evol` según su clave. Una figura recién dibujada cambia sin transición; una
 * con el acto de la apertura pendiente espera en la base.
 */
function aplicarFormas() {
  const reducido = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const pausa = document.body.classList.contains('pausa')
  const figs = new Map()
  for (const svg of document.querySelectorAll('svg[data-evo]')) {
    const id = idFigura(svg)
    if (!id || figs.has(id)) continue
    const lugar = id.split(':')[0]
    figs.set(id, { svg, lugar, visible: figuraSeVe(lugar, svg), arriba: svg.getBoundingClientRect().top })
  }
  const lista = []
  for (const { clave, acto } of st.actosEvo) {
    for (const id of figurasDeClave(clave)) {
      const f = figs.get(id)
      if (f && debeActuar({ visible: f.visible, reducido, pausa, tamano: TAMANO_MIN_ACTO })) lista.push({ ...f, acto })
    }
  }
  st.actosEvo = []
  for (const id of [...st.pendientesEvo]) {
    // Sin movimiento no hay acto: la forma es el estado, con su fundido (8.4)
    if (reducido || pausa) { st.pendientesEvo.delete(id); continue }
    const f = figs.get(id)
    const r = actoPendiente(true, { visible: !!f?.visible, evolucionada: st.formas.has(claveDeFigura(id)) })
    if (!r.pendiente) st.pendientesEvo.delete(id)
    if (r.actua) lista.push({ ...f, acto: 'evoluciona' })
  }
  for (const a of ordenActos(lista)) {
    if (a.acto === 'evoluciona') movimientoEvolucion.evolucionar(a.svg, st.mascota, { retraso: a.retraso })
    else movimientoEvolucion.devolver(a.svg, st.mascota, { retraso: a.retraso })
  }
  for (const svg of document.querySelectorAll('svg[data-evo]')) {
    const nueva = !vistasEvo.has(svg)
    vistasEvo.add(svg)
    // Con un acto en curso, la forma es de evolucionMotion.js
    if (!movimientoEvolucion.ocupada(svg)) {
      const id = idFigura(svg)
      const evol = st.formas.has(svg.dataset.evo) && !(id && st.pendientesEvo.has(id))
      if (svg.classList.contains('evol') !== evol) {
        if (nueva) movimientoEvolucion.formaAlInstante(svg, evol)
        else svg.classList.toggle('evol', evol)
      }
    }
    // El nombre sigue a la forma visible, también en las figuras con un acto o un acto pendiente (12)
    nombrarFigura(svg, svg.classList.contains('evol'))
  }
}

// Los cambios de forma de un acto (evolucionMotion.js avisa con `formaevo`): el nombre, en el momento
document.addEventListener('formaevo', e => nombrarFigura(e.target, e.detail.evol))

function pintar() {
  const ahora = Date.now()
  // Después de pintar, la forma de cada figura de Claude en su lugar y los actos (6.7)
  programarFormas()
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
  // Sin sesiones no hay conversación que mirar: la dividida se suelta sin animación (8, vacío)
  if (!st.proyectos.length && st.dividida.clave) soltarDividida()

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
    poner('#vacio-avi', figuraVacio(cargando ? 'esperando' : 'durmiendo', st.mascota), cargando ? 'cargando' : 'vacio')
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
  // En la dividida el aviso es de una pregunta en cualquier proyecto, también los dos que conversan (5.3)
  const enDividida = !!st.dividida.clave
  // La firma no lleva la forma de Claude: cambia en su lugar (6.7)
  const htmlOtro = avisoOtroProyecto(st.proyectos, enDividida ? -1 : i, st.mascota, st.formas) + (hoja || enDividida ? '' : avisoAsistente(pp, st.mascota) + avisoMod(st.pp.avisoMod, st.mascota))
  poner('#otro', htmlOtro, htmlOtro.replace(/ evol(?=[ "])/g, ''))

  const preparadas = prepararProyecto(proyecto, ahora, st.mascota)
  const c = conteos(preparadas, ahora)
  texto('#titulo', proyecto.nombre)
  $('#titulo').title = proyecto.repo ?? proyecto.nombre
  texto('#subtitulo', lineaEncabezado(preparadas, c))
  poner('#conteos', chips(c))
  // El rastro de las sesiones que conversan con otra (dividida-ux.md 5.10)
  const pid = sesionesPorId()
  const rastros = new Map(preparadas.map(({ s }) => [s.sesion, rastroConversa(s, st.dividida.convs, ahora, (id, c) => nombreLado(c, id, pid))]).filter(([, r]) => r))
  pintarEscenas(proyecto, preparadas, ahora, rastros)

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
  if (poner('#w-globo', globo(pend, { activa: st.activa, nuevo, ahoraMs: ahora, ui, mascota: st.mascota, formas: st.formas }), firmaGlobo)) {
    st.firmas.clavesGlobo = claves
    if (escribiendo) enfocarOtra()
  }
  pintarAsistente(pp, forma)

  // La primera vez que se ve el tablero desde que se mostró la ventana, entra escalonado (6.1).
  // Acoplada y cerrada no se ve: entra al abrir la muesca
  if (!st.revelado && !st.fuera && !st.mini && !(st.acople && !st.vista)) {
    st.revelado = true
    entrada()
    entradaEscenas(document.querySelectorAll('#sesiones > .ses'))
  }
  pintarDividida(ahora)
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
  // Error de lectura: quedan los últimos datos y los tiempos siguen corriendo desde los ISO (8)
  const abrir = actualizarConversaciones(Date.now())
  actualizarEvolucion(Date.now())
  pintar()
  for (const clave of abrir) abrirConversacion(clave, 'sola')
}

// ------------------------------------------------------------------ pantalla dividida (docs/diseno/dividida-ux.md)

/** Las sesiones de la última lectura, por id. */
const sesionesPorId = () => new Map(st.sesiones.map(s => [s.sesion, s]))
const $$ = s => [...document.querySelectorAll(s)]

/**
 * ¿Se está mirando el panel? (3.1, regla 2, y 3.3): flotante y visible, o acoplada con el panel
 * abierto; ni en la tira, ni escondida, ni con la hoja de primeros pasos (esconde las sesiones).
 */
function panelSeVe() {
  return !st.fuera && !st.mini && (!st.acople || st.vista) && st.pp.forma !== 'hoja' && st.proyectos.length > 0
}

/** La conversación que muestra el split, o null en la vista normal. */
function convActual() {
  const d = st.dividida
  return d.clave ? d.convs.find(c => c.clave === d.clave) ?? null : null
}

/** Pone el HTML si cambió su firma; si no, reescribe en su lugar los textos vivos y los `title`. */
function ponerVivo(sel, html, firma) {
  if (st.firmas[sel] === firma && st.htmlVivo[sel] !== html && !actualizarTiempos($(sel), html)) st.firmas[sel] = null
  st.htmlVivo[sel] = html
  return poner(sel, html, firma)
}

/** ¿Se abre sola esta conversación nueva? (3.1) */
function aperturaSola(conv) {
  const proyecto = st.proyectos.find(p => p.repo === st.repo)
  const pend = proyecto ? pendientesVisibles(proyecto) : []
  return debeAbrirseSola(conv, {
    nueva: true, panelVisible: panelSeVe(), proyectoVisto: st.repo, divididaAbierta: !!st.dividida.clave,
    preguntaDesplegada: pend.length > 0 && !st.plegado,
    enviando: Object.values(st.envios).some(e => e.estado === 'enviando'),
    focoEnCampo: !!document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]'),
    arrastre: !!st.arrastre, descartadas: st.dividida.descartadas, transicion: st.transicion,
  })
}

/** Una conversación que no se abrió sola: su ficha entra y su punto late 3 veces (3.2), y se anuncia una vez. */
function soloLate(conv, pid) {
  const d = st.dividida
  d.nuevas.add(conv.clave)
  d.latir.set(conv.clave, { veces: 3, entra: true })
  anunciar(anuncioEmpieza(conv, id => nombreLado(conv, id, pid), false))
}

/**
 * Después de cada lectura (3): las conversaciones con sus dos lados unidos; las nuevas (se abren
 * solas, esperan una transición o solo late su ficha); los mensajes nuevos (cruzan si se ve el split;
 * si no, la ficha late una vez); las que esperaban a que terminara una transición. Devuelve las
 * claves que hay que abrir solas (a lo sumo una).
 */
function actualizarConversaciones(ahora) {
  const d = st.dividida
  const antes = new Map(d.convs.map(c => [c.clave, c]))
  const convs = conversaciones(st.sesiones, ahora, d.convs)
  const nuevas = conversacionesNuevas(d.conocidas, convs)
  const mensajes = mensajesNuevos(d.ultimos, convs)
  d.convs = convs
  // Las etiquetas nombran el par en el orden del título: el lado izquierdo con el proyecto visto
  for (const c of convs) c.primero = d.izq.get(c.clave) ?? ladoIzquierdo(c, d.clave ? d.vista?.repo : st.repo)
  d.conocidas = new Set(convs.map(c => c.clave))
  d.ultimos = new Map(convs.map(c => [c.clave, c.ultimo.cuando]))
  const pid = sesionesPorId()
  const abrir = []
  for (const c of nuevas) {
    const r = aperturaSola(c)
    if (r === 'abrir' && !abrir.length) {
      abrir.push(c.clave)
      anunciar(anuncioEmpieza(c, id => nombreLado(c, id, pid), true))
    } else if (r === 'esperar') d.pendientes.add(c.clave)
    else soloLate(c, pid)
  }
  for (const k of [...d.pendientes]) {
    if (nuevas.some(c => c.clave === k)) continue
    const c = convs.find(x => x.clave === k)
    const r = c ? aperturaSola(c) : 'no'
    if (r === 'esperar') continue
    d.pendientes.delete(k)
    if (r === 'abrir' && !abrir.length) {
      abrir.push(k)
      anunciar(anuncioEmpieza(c, id => nombreLado(c, id, pid), true))
    } else if (c) soloLate(c, pid)
  }
  for (const k of mensajes) {
    if (k === d.clave) {
      // El split se ve: la pastilla cruza y los textos esperan a que llegue (9.3)
      if (panelSeVe() && hayMovimiento()) {
        d.cruces.push({ clave: k, antes: antes.get(k) })
        d.congelaHasta = Infinity
      }
    } else if (!abrir.includes(k)) {
      d.nuevas.add(k)
      if (!d.latir.has(k)) d.latir.set(k, { veces: 1 })
    }
  }
  return abrir
}

/** Al terminar una transición de ventana se vuelven a evaluar las que esperaban (3.1, regla 8). */
function revisarPendientesDividida() {
  if (!st.dividida.pendientes.size) return
  const abrir = actualizarConversaciones(Date.now())
  pintar()
  for (const clave of abrir) abrirConversacion(clave, 'sola')
}

/**
 * Abre la dividida en `clave` (9.1): sola (3.1) o con un clic en una ficha (3.4). Guarda la vista
 * anterior, fija el lado izquierdo y conserva el foco (12): si estaba en la barra, al mismo proyecto
 * del riel; si estaba en la columna, al botón "‹"; con un clic, a la conversación activa del riel.
 * Con la dividida ya abierta, solo cambia de pestaña.
 */
async function abrirConversacion(clave, origen) {
  const d = st.dividida
  const conv = d.convs.find(c => c.clave === clave)
  if (!conv || d.animando || st.animando) return
  if (d.clave) { mostrarPestana(clave); return }
  const proyecto = st.proyectos.find(p => p.repo === st.repo)
  d.vista = { repo: st.repo, scroll: $('.principal').scrollTop, nombre: proyecto?.nombre ?? '' }
  d.origen = origen
  d.abiertaEn = Date.now()
  if (!d.izq.has(clave)) d.izq.set(clave, ladoIzquierdo(conv, st.repo))
  const enfocado = document.activeElement
  const focoBarra = enfocado?.closest?.('.lado')
  const focoProyecto = enfocado?.closest?.('.lado [data-proy]')?.dataset.proy
  const focoColumna = enfocado?.closest?.('.principal')
  d.nuevas.delete(clave)
  d.latir.delete(clave)
  d.retiradas.delete(clave)
  d.cuenta = null
  d.cruces = []
  d.congelaHasta = 0
  d.animando = true
  const izq = d.izq.get(clave)
  try {
    await movimientoDividida.abrirDividida($('#marco'), () => {
      d.clave = clave
      $('#marco').classList.add('dividida')
      for (const sel of ['#riel', '#cab-conv', '#pestanas', '#split-g', '#puente', '#ficha-u']) st.firmas[sel] = null
      pintar()
      $('.principal').scrollTop = 0
      if (origen === 'clic') $('#riel .tok-cv.activa')?.focus()
      else if (focoProyecto != null) ($(`#riel [data-proy="${focoProyecto}"]`) ?? $('#riel .tok.origen'))?.focus()
      else if (focoBarra) $('#riel .tok.origen')?.focus()
      else if (focoColumna) $('#volver').focus()
    }, { desdeDerecha: conv.empezo !== izq })
  } catch (e) {
    registrar(`dividida: ${e}`)
  } finally {
    d.animando = false
  }
  verAvis()
  programarAjuste()
  // Si el último mensaje es de hace menos de 10 s, la pastilla cruza al terminar de abrir (9.1)
  const ahora = convActual()
  if (ahora && !ahora.hasta && Date.now() - Date.parse(ahora.ultimo.cuando) < CONTESTO_MS && panelSeVe()) cruzarAhora(ahora, null)
}

/**
 * Suelta la dividida sin animación (sin sesiones, o la conversación se olvidó): el estado vuelve a
 * la vista normal. No pinta: lo hace quien llama.
 */
function soltarDividida() {
  const d = st.dividida
  clearTimeout(d.relojCuenta)
  movimientoDividida.detener()
  movimientoDividida.quitarDrena($('#drena'))
  if (d.vista && st.proyectos.some(p => p.repo === d.vista.repo)) st.repo = d.vista.repo
  Object.assign(d, { clave: null, vista: null, origen: null, cuenta: null, cruces: [], congelaHasta: 0 })
  $('#marco').classList.remove('dividida')
  verAvis()
}

/**
 * Vuelve a la vista anterior (9.5): al terminar la cuenta, con "Volver ahora", con "‹", con Esc o
 * con un proyecto del riel (`repo`). Cerrarla antes de que termine la descarta (no se reabre sola,
 * 10.4); una terminada se va con la vuelta (5.9). El foco, si estaba en la dividida, va al proyecto
 * de la vista anterior en la barra (12).
 */
async function cerrarConversacion({ descartar = false, repo } = {}) {
  const d = st.dividida
  if (!d.clave || d.animando || st.animando) return
  const conv = convActual()
  if (descartar && conv && !conv.hasta) d.descartadas.add(d.clave)
  if (conv?.hasta) d.retiradas.add(d.clave)
  const vista = d.vista
  const destino = repo !== undefined ? repo : vista?.repo
  const focoAdentro = !!document.activeElement?.closest?.('.riel, .principal')
  clearTimeout(d.relojCuenta)
  movimientoDividida.detener()
  d.animando = true
  try {
    await movimientoDividida.cerrarDividida($('#marco'), () => {
      movimientoDividida.quitarDrena($('#drena'))
      Object.assign(d, { clave: null, vista: null, origen: null, cuenta: null, cruces: [], congelaHasta: 0 })
      $('#marco').classList.remove('dividida')
      if (destino !== undefined && st.proyectos.some(p => p.repo === destino)) st.repo = destino
      st.activa = 0
      pintar()
      $('.principal').scrollTop = repo === undefined ? (vista?.scroll ?? 0) : 0
      if (focoAdentro) $('#proyectos .pj.activo')?.focus()
    })
  } catch (e) {
    registrar(`dividida: ${e}`)
  } finally {
    d.animando = false
  }
  verAvis()
  programarAjuste()
}

/** Muestra otra conversación en el split, como su pestaña (5.4 y 9.6). */
function mostrarPestana(clave) {
  const d = st.dividida
  if (!d.clave || clave === d.clave) return
  const conv = d.convs.find(c => c.clave === clave)
  if (!conv) return
  const orden = convsVisibles(d.convs, Date.now(), d.retiradas).map(c => c.clave)
  const direccion = Math.sign(orden.indexOf(clave) - orden.indexOf(d.clave)) || 1
  if (!d.izq.has(clave)) d.izq.set(clave, ladoIzquierdo(conv, d.vista?.repo))
  clearTimeout(d.relojCuenta)
  movimientoDividida.detener()
  movimientoDividida.quitarDrena($('#drena'))
  Object.assign(d, { clave, cuenta: null, cruces: [], congelaHasta: 0 })
  d.nuevas.delete(clave)
  d.latir.delete(clave)
  for (const sel of ['#cab-conv', '#split-g', '#puente', '#ficha-u']) st.firmas[sel] = null
  pintar()
  movimientoDividida.cambiarPestana($('#split'), direccion)
}

/**
 * Un mensaje nuevo en la conversación que se ve (9.3): la pastilla cruza desde quien manda y, al
 * llegar, cambian los textos (fundido) y quien esperaba festeja una vez. `antes`: la conversación de
 * la lectura anterior (para saber si quien recibe esperaba).
 */
function cruzarAhora(conv, antes) {
  const d = st.dividida
  const izq = d.izq.get(conv.clave)
  const { cable } = geometriaDividida(0, 0)
  const desdeIzq = conv.ultimo.emisor === izq
  const recibe = conv.turno
  const esperaba = antes ? esperaRespuesta(sesionesPorId().get(recibe), antes, Date.now()) : false
  movimientoDividida.cruzarMensaje($('#split'), {
    d: desdeIzq ? cable.d : cable.dInverso,
    llega: desdeIzq ? cable.llegaB : cable.llegaA,
    alCambiar: () => {
      d.congelaHasta = 0
      pintar()
      movimientoDividida.fundido($$('#split-g .turno, #split-g .pild, #split-g .mh .linea, #ficha-u .u-t'))
      if (!esperaba) return
      const el = $(`#split-g [data-claude="${CSS.escape(recibe)}"]`)
      el?.classList.add('recibe')
      setTimeout(() => el?.classList.remove('recibe'), 1000)
    },
  })
}

/**
 * La cuenta de la vuelta (10): 60 s desde que termina la conversación que se mira, solo con el panel
 * a la vista; en pausa con el puntero sobre la columna o el foco adentro. Si se cerraron las dos
 * sesiones, la vuelta es inmediata (8). La barra de 2 px la sigue.
 */
function revisarCuenta(ahora, actual = convActual()) {
  const d = st.dividida
  clearTimeout(d.relojCuenta)
  if (!actual?.hasta) {
    d.cuenta = null
    movimientoDividida.quitarDrena($('#drena'))
    return
  }
  if (actual.motivo === 'cerro' && actual.cerradas.length >= 2) { setTimeout(vueltaAutomatica, 0); return }
  revisarDentro()
  const corre = panelSeVe() && !d.dentro && !d.animando
  d.cuenta = cuentaVuelta(d.cuenta, { corre, ahoraMs: ahora, totalMs: d.esperaVuelta })
  if (d.cuenta.terminada) { setTimeout(vueltaAutomatica, 0); return }
  movimientoDividida.drena($('#drena'), { restante: d.cuenta.restante, total: d.esperaVuelta, corre })
  if (corre) d.relojCuenta = setTimeout(pintar, d.cuenta.restante + 30)
}

/**
 * Terminó la cuenta: si queda otra conversación activa, el split pasa a esa (8); si no, vuelve a la
 * vista anterior.
 */
async function vueltaAutomatica() {
  const d = st.dividida
  const actual = convActual()
  if (!actual || d.animando || st.animando) return
  const sigue = convsVisibles(d.convs, Date.now(), d.retiradas).find(c => c.clave !== actual.clave && !c.hasta)
  d.retiradas.add(actual.clave)
  if (sigue) mostrarPestana(sigue.clave)
  else await cerrarConversacion()
}

/** El puntero sobre la columna o el foco adentro de la dividida pausan la cuenta (10.3). */
const dentroDividida = { puntero: false }
function revisarDentro() {
  const d = st.dividida
  const el = document.activeElement
  const dentro = pausaVuelta({
    puntero: dentroDividida.puntero,
    ventanaActiva: document.hasFocus(),
    focoAdentro: !!el?.closest?.('#marco.dividida .riel, #marco.dividida .principal'),
    focoTeclado: !!el?.matches?.(':focus-visible'),
  })
  if (dentro === d.dentro) return
  d.dentro = dentro
  if (d.clave) pintar()
}

/** Late lo que esperaba a verse (9.2): las fichas nuevas, los mensajes sin abrir y las pestañas. */
function latirPendientes() {
  const d = st.dividida
  if (!d.latir.size || !panelSeVe()) return
  const lugares = d.clave ? ['#riel', '#pestanas'] : ['#conversan']
  for (const [clave, { veces, entra }] of d.latir) {
    for (const lugar of lugares) {
      const b = $(`${lugar} [data-clave="${CSS.escape(clave)}"]`)
      if (b) movimientoDividida.latirFicha(b.querySelector('.pt-n'), veces, { entra: entra && lugar === '#conversan' ? b.closest('li') : null })
    }
  }
  d.latir.clear()
}

/**
 * La parte de la dividida de cada `pintar()`: las fichas "Conversan" de la barra y, con la dividida
 * abierta, el riel, el encabezado, las pestañas, las mitades, el puente y la ficha "Último". Cada
 * parte se redibuja solo si cambió su firma (sin el tiempo); lo que pasa con el tiempo se reescribe
 * en su lugar. Mientras cruza un mensaje, las mitades esperan a que llegue (9.3).
 */
function pintarDividida(ahora) {
  const d = st.dividida
  const pid = sesionesPorId()
  const nombre = (id, c) => nombreLado(c, id, pid)
  const actual = convActual()
  if (d.clave && !actual) { soltarDividida(); pintar(); return }
  let visibles = convsVisibles(d.convs, ahora, d.retiradas)
  if (actual && !visibles.includes(actual)) visibles = [...visibles, actual].sort((x, y) => Date.parse(x.desde) - Date.parse(y.desde))
  const animoDe = id => (pid.has(id) ? animoSesion(pid.get(id), ahora) : '-')

  // Fichas "Conversan" de la barra (5.9)
  const htmlF = fichasConversan(visibles, { ahoraMs: ahora, porId: pid, nombre, nuevas: d.nuevas, mascota: st.mascota, formas: st.formas })
  $('#conversan').hidden = !htmlF
  const focoF = document.activeElement?.closest?.('#conversan [data-clave]')?.dataset.clave
  const firmaF = visibles.map(c => [c.clave, !!c.hasta, d.nuevas.has(c.clave), animoDe(c.a), animoDe(c.b)].join(':')).join('/')
  if (ponerVivo('#conversan', htmlF, firmaF) && focoF) $(`#conversan [data-clave="${CSS.escape(focoF)}"]`)?.focus()

  if (!actual) { latirPendientes(); return }
  const izq = d.izq.get(actual.clave)
  const n = id => nombreLado(actual, id, pid)
  const vistaN = d.vista?.nombre ?? ''

  // Riel (5.1)
  const textoPie = st.error ?? `actualizado ${st.actualizado ? horaLocal(st.actualizado.getTime()) : '—'} · cada 1,5 s`
  const focoR = document.activeElement?.closest?.('#riel [data-clave], #riel [data-proy]')
  const firmaR = [
    st.proyectos.map(p => `${p.repo}:${p.sesiones.length}:${preguntasPendientes(p).length}`).join(','),
    visibles.map(c => `${c.clave}:${!!c.hasta}:${d.nuevas.has(c.clave)}`).join(','), d.clave, d.vista?.repo, animoMarca(st.proyectos, ahora), !!st.error,
  ].join('/')
  const htmlR = riel(st.proyectos, visibles, { ahoraMs: ahora, nombre, activa: d.clave, nuevas: d.nuevas, origen: d.vista?.repo, animoMarca: animoMarca(st.proyectos, ahora), estado: { error: !!st.error, texto: textoPie }, mascota: st.mascota, formas: st.formas })
  if (ponerVivo('#riel', htmlR, firmaR) && focoR) {
    const sel = focoR.dataset.clave != null ? `[data-clave="${CSS.escape(focoR.dataset.clave)}"]` : `[data-proy="${focoR.dataset.proy}"]`
    $(`#riel ${sel}`)?.focus()
  }

  // Encabezado (5.2): el título por conversación; el sub y la salida, en su lugar
  const restante = d.cuenta ? (d.cuenta.desde == null ? d.cuenta.restante : Math.max(0, d.cuenta.restante - (ahora - d.cuenta.desde))) : null
  const sigue = visibles.find(c => c.clave !== actual.clave && !c.hasta)
  const sub = textoSub(actual, {
    ahoraMs: ahora, recienSola: d.origen === 'sola' && ahora - d.abiertaEn < RECIEN_SOLA_MS, vista: vistaN,
    cuenta: d.cuenta && { restante, pausada: d.dentro }, nombre: n,
    siguiente: sigue ? `${nombreLado(sigue, primeroDe(sigue), pid)} ⇄ ${nombreLado(sigue, primeroDe(sigue) === sigue.a ? sigue.b : sigue.a, pid)}` : null,
  })
  poner('#cab-conv', cabConversa(actual, izq, { nombre: n, sub }), `${actual.clave}|${izq}|${n(actual.a)}|${n(actual.b)}`)
  texto('#sub-c', sub)
  const volver = $('#volver')
  const fin = !!actual.hasta
  if (volver.dataset.firma !== `${fin}|${vistaN}`) {
    volver.dataset.firma = `${fin}|${vistaN}`
    volver.innerHTML = fin ? 'Volver ahora' : `‹ <span class="n">${escapar(vistaN)}</span>`
    volver.classList.toggle('ahora', fin)
    volver.setAttribute('aria-label', `${fin ? 'Volver ahora a' : 'Volver a'} ${vistaN}`)
  }

  // Pestañas (5.4), solo con 2 o más
  const focoP = document.activeElement?.closest?.('#pestanas [data-clave]')?.dataset.clave
  const firmaP = visibles.map(c => `${c.clave}:${!!c.hasta}:${d.nuevas.has(c.clave)}`).join(',') + `|${d.clave}`
  if (ponerVivo('#pestanas', pestanasConv(visibles, { activa: d.clave, nuevas: d.nuevas, nombre }), firmaP) && focoP) {
    $(`#pestanas [data-clave="${CSS.escape(focoP)}"]`)?.focus()
  }
  const split = $('#split')
  if (visibles.length > 1) split.setAttribute('role', 'tabpanel')
  else split.removeAttribute('role')

  // Las mitades, la costura, el puente y la ficha "Último" (5.5 a 5.8)
  const der = actual.a === izq ? actual.b : actual.a
  const nSub = id => (pid.get(id)?.agentes ?? []).length
  const geo = geometriaDividida(nSub(izq), nSub(der))
  const ctx = { ahoraMs: ahora, porId: pid, nombre: n, mascota: st.mascota, formas: st.formas }
  if (ahora >= d.congelaHasta) {
    ponerVivo('#split-g', mitades(actual, izq, ctx, geo), firmaMitades(actual, izq, ctx))
    ponerVivo('#ficha-u', fichaUltimo(actual, ctx), `${actual.clave}|${fin}`)
  }
  const puenteNuevo = poner('#puente', puente(geo, fin && d.terminadas.has(actual.clave)), `${actual.clave}|${izq}`)
  if (fin && !d.terminadas.has(actual.clave)) {
    // Termina (9.4): el cable se corta una vez; si se abrió ya terminada, sin animación
    d.terminadas.add(actual.clave)
    if (puenteNuevo) $('#puente .puente')?.classList.add('fin')
    else movimientoDividida.terminar(split)
    anunciar(anuncioTermina(actual, n, vistaN))
  }

  // Los cruces que esperaban a que se pintara el split (9.3)
  const cruces = d.cruces
  d.cruces = []
  for (const { clave, antes } of cruces) if (clave === actual.clave && panelSeVe()) cruzarAhora(actual, antes)
  if (!cruces.length && d.congelaHasta === Infinity) d.congelaHasta = 0

  revisarCuenta(ahora, actual)
  latirPendientes()
}

/**
 * Teclado en la dividida (12): Esc vuelve (una capa por vez: acoplada, el Esc siguiente cierra la
 * muesca); dentro de las pestañas, ← → mueven el foco (itinerante) entre ellas; las ← → globales de
 * cambio de proyecto no actúan. Devuelve true si la tecla fue suya.
 */
function teclaDividida(e) {
  const d = st.dividida
  if (!d.clave) return false
  if (e.key === 'Escape') {
    e.preventDefault()
    cerrarConversacion({ descartar: true })
    return true
  }
  const pest = e.target.closest?.('#pestanas [role="tab"]')
  if (pest && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    const tabs = $$('#pestanas [role="tab"]')
    const sig = tabs[(tabs.indexOf(pest) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
    for (const t of tabs) t.tabIndex = t === sig ? 0 : -1
    sig.focus()
    return true
  }
  return e.key === 'ArrowLeft' || e.key === 'ArrowRight'
}

$('.principal').addEventListener('pointerenter', () => { dentroDividida.puntero = true; revisarDentro() })
$('.principal').addEventListener('pointerleave', () => { dentroDividida.puntero = false; revisarDentro() })
document.addEventListener('focusin', revisarDentro)
document.addEventListener('focusout', () => setTimeout(revisarDentro, 0))
// Si el puntero sale de la ventana entera de golpe, puede no pasar por el borde de la columna
document.documentElement.addEventListener('pointerleave', () => { dentroDividida.puntero = false; revisarDentro() })
window.addEventListener('focus', revisarDentro)
window.addEventListener('blur', revisarDentro)

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
  const quien = quienPregunta(q, st.mascota)
  st.envios[id] = {
    estado: 'enviando', desde: Date.now(), texto: textoRespondido(q.pregunta, borrador),
    quien: quien.nombre, pj: quien.pj, color: quien.color, especie: quien.especie, variante: quien.variante, claveEvo: quien.claveEvo,
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
  const textoPin = st.acople ? (st.muesca.fija ? 'Soltar: se pliega con un clic afuera' : 'Mantener abierta') : 'Siempre arriba'
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
      const conHoja = hojaSeVe()
      st.mini = true
      st.tira = null
      verAvis()
      invocar('modo_mini', { mini: true }).catch(() => {})
      const d = disposicionActual(st.ventana)
      // La hoja de la charla se pliega a la tira con el tablero, 60 ms antes (chat-avis-ux.md 3.1)
      const soltarHoja = desde ? await plegarHojaCon(conHoja, d.local.tira, 28, { x: 1, y: 1 }, { viaje: true }) : async () => {}
      const soltar = desde ? await movimientoMuesca.plegar(marco, $('#contenido'), plegadoHacia(desde, d.local.tira, 28, { x: 1, y: 1 }), { viaje: true }) : () => {}
      colocar(d)
      document.body.classList.add('mini')
      tira.hidden = false
      soltar()
      await soltarHoja()
      movimientoMuesca.aparecerContenido(tira)
    } else {
      const desde = st.disp?.local.tira
      st.mini = false
      document.body.classList.remove('mini')
      const d = disposicionActual(st.ventana)
      colocar(d)
      // Arranca en esta tarea: el tablero ya tiene la forma de la tira cuando la tira se esconde
      const anim = desde ? movimientoMuesca.desplegar(marco, $('#contenido'), plegadoHacia(d.local.tablero, desde, 28, { x: 1, y: 1 })) : Promise.resolve()
      // La hoja de la charla vuelve con el tablero, como estaba (chat-avis-ux.md 3.1)
      const animHoja = desplegarHojaDesde(desde, 28, { x: 1, y: 1 })
      tira.hidden = true
      invocar('modo_mini', { mini: false }).catch(() => {})
      // Lo de adentro se funde con el despliegue (como la isla): sin entrada escalonada encima
      st.revelado = true
      verAvis()
      pintar()
      await anim
      await animHoja
      document.body.classList.remove('hoja-mueve')
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
  if (a.startsWith('ch-')) {
    // La hoja de la charla: cada botón hace solo lo suyo (chat-avis-ux.md 3.5)
    await accionChat(a, b)
    return
  }
  if (a.startsWith('pp-')) {
    // Primeros pasos: un botón deshabilitado (aria-disabled, 5.3) ignora el clic
    if (b.getAttribute('aria-disabled') !== 'true') await accionPasos(a, b)
    return
  }
  if (a === 'conv') {
    // Una ficha "Conversan" de la barra o del riel abre la dividida en esa conversación (3.4)
    abrirConversacion(b.dataset.clave, 'clic')
    return
  }
  if (a === 'pest') { mostrarPestana(b.dataset.clave); return }
  if (a === 'sub') {
    // El Avi de un subagente despliega su detalle debajo del escenario; otro clic lo pliega (#14)
    const { sesion, id } = b.dataset
    alternarDetalle(st.detalleSub?.sesion === sesion && st.detalleSub?.id === id ? null : { sesion, id }, { sesion, id })
    return
  }
  // La barra de control (#19): cada botón hace solo lo suyo, y solo con el clic
  if (a === 'ctl-enviar') { if (!b.disabled) ordenar(b.dataset.sesion, 'mensaje'); return }
  if (a === 'ctl-frenar') { if (!b.disabled) tocarFrenar(b.dataset.sesion); return }
  if (a === 'volver') {
    // "‹ vista anterior" o "Volver ahora" (5.2); antes de que termine, la descarta (10.4)
    cerrarConversacion({ descartar: true })
    return
  }
  if (a === 'ir' && st.dividida.clave) {
    // Un proyecto del riel, o el aviso de una pregunta (5.3): sale de la dividida hacia ese proyecto
    const p = st.proyectos[+b.dataset.proy]
    if (b.closest('#otro')) { st.plegado = false; st.firmas.clavesGlobo = null }
    if (p) cerrarConversacion({ descartar: true, repo: p.repo })
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
  // Lo escrito en una barra de control se guarda por sesión: el redibujo lo vuelve a poner (#19)
  if (e.target.matches?.('#sesiones .ctl-in')) {
    const ui = ctl(e.target.dataset.sesion)
    ui.borrador = e.target.value
    // Un error queda hasta que el usuario escribe o manda otra orden
    ui.linea = lineaAlEscribir(ui.linea)
    refrescarBarra(e.target.closest('.ctl'))
  }
})
document.addEventListener('compositionstart', e => { if (e.target.matches?.('.ctl-in')) st.componiendo = true })
document.addEventListener('compositionend', () => { st.componiendo = false })

document.addEventListener('keydown', e => {
  // Las teclas de la hoja de la charla (chat-avis-ux.md 3.5): van antes que el Esc de la pregunta y el de la muesca
  if (teclaChat(e)) return
  // Barra de control (#19, D4): Enter envía, Shift+Enter hace línea nueva, nada mientras compone el IME.
  // Las demás teclas son del campo; Esc sigue de largo (pliega el detalle o la muesca, como en todo campo)
  if (e.target.matches?.('#sesiones .ctl-in')) {
    if (teclaControl(e) === 'enviar') { e.preventDefault(); ordenar(e.target.dataset.sesion, 'mensaje'); return }
    if (e.key !== 'Escape') return
  }
  // Esc en "¿Frenar? Sí" deja de pedir confirmación, sin frenar
  if (e.key === 'Escape' && e.target.matches?.('#sesiones .ctl-frenar.confirma')) {
    e.preventDefault()
    const ui = ctl(e.target.dataset.sesion)
    ui.confirmaHasta = null
    clearTimeout(ui.reloj)
    refrescarBarras()
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
  // Esc con el foco en una tarjeta pliega el detalle abierto del subagente y el foco vuelve a su Avi (#14)
  if (e.key === 'Escape' && st.detalleSub && e.target.closest?.('#sesiones')) {
    e.preventDefault()
    alternarDetalle(null, st.detalleSub)
    return
  }
  if (teclaDividida(e)) return
  // Fuera de la pregunta, Esc cierra la muesca aunque esté fijada y devuelve el foco a la muesca (7.2)
  if (e.key === 'Escape' && st.acople && st.muesca.abierta) { e.preventDefault(); evento({ tipo: 'esc' }); return }
  if (st.mini || e.target.closest?.('input, textarea, summary, #pp, #hoja')) return
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
  colocarHoja(d, poner)
  st.disp = d
  st.ventana = { ...d.ventana }
  // La primera vez: hasta acá el tablero no tenía lugar y no se veía; flotando, entra (6.1)
  if (!document.body.classList.contains('colocada')) {
    document.body.classList.add('colocada')
    if (d.modo === 'flotante') entradaMarco()
  }
}

/**
 * La hoja de la charla al lado del tablero que se ve (chat-avis-ux.md 3.1): flotando o acoplada y
 * abierta. El lado se recalcula siempre salvo a mitad de un arrastre (D2: al soltar). `d.hoja` es su
 * rectángulo para la zona interactiva (encima, la zona es el tablero).
 */
function colocarHoja(d, poner) {
  const tablero = d.modo === 'flotante' ? d.tablero : d.modo === 'acoplada' ? d.p.tablero : null
  d.hoja = null
  if (!st.chat.abierta || !tablero) return
  const z = zoom()
  if (!st.arrastre?.activo || !st.chat.lado) st.chat = { ...st.chat, lado: ladoHoja(tablero, d.ventana, d.modo, st.acople?.borde, z) }
  const r = rectHoja(tablero, st.chat.lado, z, anchoBarra() * z)
  // `d.local.hoja` (px CSS de la ventana): desde dónde se pliega con el panel (3.1)
  d.local.hoja = relativo(r, d.ventana, z)
  poner('h', d.local.hoja)
  hojaEl.dataset.lado = st.chat.lado
  if (st.chat.lado !== 'encima') d.hoja = r
  // Si al soltar cambió de lado, la hoja se funde en el nuevo (D2); nunca en medio de un acto
  if (ladoVisto && ladoVisto !== st.chat.lado && st.hojaVista) movimientoChat.cambiarLado(hojaEl)
  ladoVisto = st.chat.lado
}

/** Ancho de la barra lateral (o del riel de la dividida) en px CSS, medido: lo que la hoja "encima" deja a la vista. */
function anchoBarra() {
  const marco = $('#marco')
  const lado = [$('.lado'), $('#riel')].find(x => x && x.offsetWidth > 0)
  if (!lado || !marco.offsetWidth) return 0
  const rm = marco.getBoundingClientRect()
  return Math.max(0, (lado.getBoundingClientRect().right - rm.left) * (marco.offsetWidth / rm.width))
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
  const zona = zonaInteractiva(st.disp, { abierta: st.vista, arrastrando: !!st.arrastre?.activo, hoja: hojaSeVe() ? st.disp.hoja : null }, zoom())
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
 * antes). Solo lo usan los Avis para mirar y reaccionar: el hover no abre la muesca ni la salida la
 * cierra (#21); abre el clic y cierran el clic afuera, Esc o la ×.
 */
function ponerDentro(dentro) {
  st.dentroZona = dentro
  muescaAvi.zona(dentro)
  // Flotando, fuera del tablero los clics pasan y el WebView no ve salir al puntero: la marca lo
  // sabe por acá y mira hacia donde salió, como al salir de la ventana chica de antes
  if (!st.acople) marca.zona(dentro)
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

/**
 * Un evento de la muesca (`siguiente`, muesca.js): anima si cambia abierta o cerrada y deja el foco
 * donde corresponde.
 */
function evento(ev) {
  const antes = st.muesca
  const e = siguiente(antes, ev)
  st.muesca = e
  // Mientras el código de GitHub retiene el panel, un cambio de la marca es del usuario (alfiler o Esc)
  if (st.pp.retuvo && e.fija !== antes.fija) st.pp.fijaTocada = true
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
  // La hoja de la charla crece desde la muesca con el panel (chat-avis-ux.md 3.1)
  const animHoja = desplegarHojaDesde(d.local.muesca, 22, anclaHacia(st.acople.borde))
  await movimientoMuesca.abrir(marco, rc, $('#contenido'))
  marco.style.clipPath = ''
  document.body.classList.add('desplegada')
  await animHoja
  document.body.classList.remove('hoja-mueve')
  setTimeout(() => document.body.classList.remove('abriendo'), 1600)
}

/** Cerrar (6.4 y 9.6): el recorte vuelve a la muesca; la ventana no cambia. */
async function animarCierre() {
  const { d, rc } = await medidasAcople()
  // La hoja de la charla se pliega a la muesca 60 ms antes que el panel (chat-avis-ux.md 3.1)
  const soltarHoja = await plegarHojaCon(hojaSeVe(), d.local.muesca, 22, anclaHacia(st.acople.borde))
  document.body.classList.remove('desplegada', 'abriendo')
  const soltar = await movimientoMuesca.cerrar($('#marco'), $('#contenido'), rc)
  document.body.classList.remove('abierta')
  st.vista = false
  verAvis()
  soltar()
  await soltarHoja()
  colocar(d)
  // Recién visto: el próximo golpe, dentro de 90 s si la pregunta sigue
  if (st.golpe.vistas.size) st.golpe.ultimo = Date.now()
  // La zona vuelve a ser la muesca
  await enviarZona(true)
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
    // Las conversaciones que esperaban a que terminara la transición se vuelven a evaluar (3.1, regla 8)
    revisarPendientesDividida()
  }
}

/**
 * Acopla a `borde` o deja flotando (`null`): desde la bandeja ("Acoplar a"), al soltar el tablero o
 * la tira junto a un borde, o al soltar la píldora lejos de todos. Guarda el acople (7.5). La
 * ventana no cambia (9.7): lo que se ve se transforma adentro, sin velo (6.6).
 */
async function acoplarA(borde, { lugar, puntero } = {}) {
  if (!tauri?.core || st.arrastre || st.transicion) return
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
  st.muesca = { ...ESTADO_INICIAL }
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
    let soltarHoja = async () => {}
    if (desde === 'tablero') {
      // La hoja de la charla se pliega a la muesca con el tablero, 60 ms antes (chat-avis-ux.md 3.1)
      soltarHoja = await plegarHojaCon(hojaSeVe(), destino, 22, anclaHacia(borde))
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
    st.muesca = { ...ESTADO_INICIAL }
    aplicarModo()
    colocar(disposicion(area))
    soltar()
    await soltarHoja()
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
    // La hoja de la charla sale con el tablero, desde el mismo lugar (chat-avis-ux.md 3.1)
    const animHoja = desplegarHojaDesde(origen, conPildora ? PILDORA.alto / 2 : 22, conPildora ? ANCLA_PILDORA : anclaHacia(bordeViejo))
    // En esta misma tarea: el tablero ya tiene la forma de la píldora cuando ella se va
    document.body.classList.remove('pildora')
    st.pildora = null
    // Flotando: sin la zona de la muesca, y la del tablero apenas Rust olvidó la vieja
    const guardado = invocar('guardar_acople', { borde: null, lugar: null }).then(() => enviarZona(true))
    await anim
    await animHoja
    document.body.classList.remove('hoja-mueve')
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
$('#hoja').addEventListener('pointerenter', e => {
  if (e.pointerType === 'mouse' && st.muesca.abierta) ponerDentro(true)
})
document.documentElement.addEventListener('pointerleave', e => {
  if (e.pointerType === 'mouse') ponerDentro(false)
})
// Clic, Enter o Espacio: abre y lleva el foco al proyecto activo; abierta, la cierra (#21)
muescaEl.addEventListener('click', () => {
  if (justoArrastro || !st.acople) return
  evento({ tipo: 'alternar' })
})
// Clic afuera (#21): acoplada, fuera del tablero los clics pasan de largo a la app de abajo y el
// WebView no los ve, pero esa app toma el foco y la ventana lo pierde (`blur`). Un clic que sí cae
// en la ventana fuera del panel (antes de que el sondeo apague la zona, o en dev/vista.html) cierra
// igual. Fijada ("Mantener abierta") no cierra.
window.addEventListener('blur', () => {
  if (st.acople && st.muesca.abierta && !st.arrastre) evento({ tipo: 'afuera' })
})
document.addEventListener('pointerdown', e => {
  // La hoja de la charla es parte del panel: un clic en ella no lo cierra (chat-avis-ux.md 3.1)
  if (!st.acople || !st.muesca.abierta || st.arrastre || e.target.closest?.('#marco, #muesca, #hoja')) return
  evento({ tipo: 'afuera' })
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
  if (a.origen === 'muesca') {
    // Abierta, se pliega al instante: lo que se arrastra es la muesca
    st.muesca = { ...ESTADO_INICIAL }
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
  const html = escenaPasos(modelo, pp.visible, forma, horaLocal, st.mascota)
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

/**
 * Un evento del mod automático (`oficina://mod-auto`, #17): una instalación sola que empieza se ve
 * en el paso 2 como si se hubiera tocado su botón; un aviso nuevo se toma una vez de Rust.
 */
function alEventoModAuto(payload) {
  st.pp.ejec = alModAuto(st.pp.ejec, payload)
  if (payload?.estado === 'aviso') tomarAvisoMod()
  pintar()
}

/** Toma el aviso pendiente del mod automático (al arrancar y con cada evento "aviso"). */
async function tomarAvisoMod() {
  try {
    const aviso = await invocar('tomar_aviso_mod')
    const texto = textoAvisoMod(aviso)
    if (!texto) return
    st.pp.avisoMod = aviso
    anunciar(texto)
    // La versión nueva ya está: el asistente la lee sin pasar los pasos a "Revisando"
    revisarPasos({ aLaVista: false })
    pintar()
  } catch (e) {
    registrar(`mod automático: ${e}`)
  }
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
    case 'pp-mod-visto': {
      // El aviso de una vez se va; el foco pasa al aviso que quede, si hay
      st.pp.avisoMod = null
      pintar()
      $('#otro .aviso')?.focus()
      break
    }
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
    st.muesca = { ...st.muesca, fija: true }
    pintarControles()
  } else if (!retener && pp.retuvo) {
    pp.retuvo = false
    const fija = fijaAlSoltar({ antes: pp.fijaAntes, actual: st.muesca.fija, tocada: pp.fijaTocada })
    if (st.muesca.fija !== fija) st.muesca = { ...st.muesca, fija }
    pintarControles()
  }
}

// ------------------------------------------------------------------ la charla con la mascota (docs/diseno/chat-avis-ux.md)
// Reglas de oro: un clic, nunca solo (abrir la hoja no manda nada; solo Enter, Enviar, una
// sugerencia, Reintentar o "Volver a preguntar" mandan); nunca se pierde lo escrito (el borrador
// vive en st.chat y el campo no se redibuja); quién responde, siempre a la vista; el texto del modelo
// nunca es HTML (chatVista.js lo escapa o lo pasa por markdownSeguro). La lógica es de chat.js.

const marcaBoton = $('#marca-boton')
const hojaEl = $('#hoja')
const campoChat = $('#chat-campo')
/** Dónde se apretó el Avi (px de pantalla): si se movió más que el umbral, no es un clic (3.1). */
let toqueMarca = null
/** El reloj de la espera (1 s, solo con un turno en curso) y el de las poses de un rato. */
let temporizadorEspera = null, temporizadorPose = null
/** El último `chat_abrir` pedido: `chat_enviar` espera a que Rust conozca la conversación. */
let abriendo = Promise.resolve()
let cuadroHoja = 0
/** Lo buscado en el cajón del historial (se pierde al cerrarlo). */
let buscarChat = ''
/** El guardado de la respuesta que llega (cada 2 s, 9.1), la cola de guardados y el "¿Borrar? Sí" de 3 s (D24). */
let guardadoLuego = null, temporizadorBorrar = null
let colaGuardar = Promise.resolve()
/**
 * La respuesta en curso ya dibujada (6.2): de qué turno y qué texto. Lo que llega después entra con
 * `.w`; lo ya puesto no se toca. `quieto`: lo próximo se agrega sin animar (la hoja vuelve a verse).
 */
const vivo = { turno: null, texto: '', quieto: false }
/** El acto de abrir (su promesa: el foco va al campo cuando la mascota aterriza) y si se está cerrando. */
let actoHoja = null
let hojaCerrando = false
/** El lado con el que se vio la hoja por última vez: si cambia al soltar el tablero, se funde (D2). */
let ladoVisto = null

/** El nombre de la mascota ("Avi", "Ascua"…): la cara y la voz de la charla. */
const nombreMascota = () => datosEspecie(st.mascota).nombre

/** Un id nuevo de conversación (`c-<uuid>`, como pide `conversacion_valida` de Rust). */
const idConversacion = () => `c-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`}`

/** ¿Se ve la hoja? Abierta y con el tablero a la vista: flotando, o acoplada y abierta; ni en la tira ni escondida. */
function hojaSeVe() {
  return st.chat.abierta && !st.fuera && !st.mini && (!st.acople || st.vista)
}

/** Lo que dibuja chatVista.js (con los adjuntos de la entrega 5: el clip y "Resumime un PDF"). */
function modeloVista(ahora = Date.now()) {
  const c = st.chat
  const reciente = (c.estado === 'listo' && c.listoMs != null && ahora - c.listoMs < FELIZ_MS)
    || (c.estado === 'vacio' && st.chatSaludo != null && ahora - st.chatSaludo < SALUDA_MS)
  return { chat: c, especie: st.mascota, ahoraMs: ahora, reciente, hablando: false, puedeAdjuntar: true, proyectos: carpetasDeProyectos(st.proyectos) }
}

/** El centro de la capa de soltar del último archivo soltado (px de la ventana): de ahí nacen sus chips (6.2). */
let centroSoltar = null
/** Las rutas del arrastre en curso: solo `enter` y `drop` las traen (`over` trae la posición). */
let rutasArrastre = []

/**
 * Los archivos que se arrastran sobre la ventana (10, `onDragDropEvent` de Tauri: px físicos y
 * rutas). Solo sobre la hoja a la vista (D26): la capa con el nombre mientras está encima; al
 * soltar, Rust revisa cada ruta. Fuera de la hoja, cerrada o plegada, nada.
 */
function alArrastrarArchivo(p) {
  if (!p?.type) return
  if (p.type === 'enter' || p.type === 'drop') rutasArrastre = Array.isArray(p.paths) ? p.paths.filter(r => typeof r === 'string') : rutasArrastre
  const sobre = p.type !== 'leave' && hojaSeVe() && sobreHoja(p.position, window.devicePixelRatio || 1, st.disp?.local?.hoja, zoom())
  if (p.type === 'drop' && sobre) {
    const rutas = rutasArrastre
    rutasArrastre = []
    centroSoltar = movimientoChat.fundirCapa($('#chat-soltar .soltar'))
    despacharChat({ tipo: 'soltado', rutas })
    return
  }
  if (p.type === 'drop' || p.type === 'leave') rutasArrastre = []
  const nombre = sobre && p.type !== 'drop' ? nombreArchivo(rutasArrastre[0]) || 'archivo' : null
  if ((st.chat.soltando?.nombre ?? null) !== nombre) despacharChat({ tipo: 'soltando', nombre })
}

/**
 * Rust revisa cada archivo (`chat_adjunto`: el tipo, el tamaño, las páginas), de a uno y en orden,
 * así la cuenta de 5 por mensaje es la de verdad. La ventana nunca lee los bytes (10).
 */
async function revisarAdjuntos(rutas, desdeCapa) {
  for (const ruta of rutas) {
    let resultado
    try {
      resultado = await invocar('chat_adjunto', { ruta })
    } catch (err) {
      registrar(`chat adjunto: ${err}`)
      resultado = { error: 'adjunto', nombre: nombreArchivo(ruta) }
    }
    despacharChat({ tipo: 'adjunto', ruta, resultado, desdeCapa })
  }
}

/** Un aviso en `#anuncio-chat` (12): se vacía antes, así el mismo texto se vuelve a oír. */
function anunciarChat(mensaje) {
  const el = $('#anuncio-chat')
  if (!mensaje || !el) return
  el.textContent = ''
  setTimeout(() => { el.textContent = mensaje }, 60)
}

/**
 * Pasa un evento por `transicionChat` (chat.js), hace sus efectos y redibuja la hoja. Es el único
 * camino para cambiar `st.chat` (salvo el borrador, que se guarda tecla a tecla en `input`).
 */
function despacharChat(ev) {
  const antes = st.chat
  const ahora = Date.now()
  const { chat, efectos } = transicionChat(antes, ev, { ahoraMs: ahora, id: idConversacion(), mascota: nombreMascota(), datos: datosAvis(st.proyectos, ahora) })
  if (chat === antes && !efectos.length) return
  const seVeia = hojaSeVe()
  st.chat = chat
  // El historial en la PC (9.1): al mandar, en cada final y cada 2 s mientras llega el texto
  guardarCharlas(guardadosPendientes(antes, chat))
  // "¿Borrar? Sí" vuelve solo a los 3 s sin el segundo clic (D24, como Frenar)
  if (chat.menuCharla?.confirmar && !antes.menuCharla?.confirmar) {
    clearTimeout(temporizadorBorrar)
    temporizadorBorrar = setTimeout(() => despacharChat({ tipo: 'no-borrar' }), MS_CONFIRMAR_FRENAR)
  }
  const abre = chat.abierta && !antes.abierta, cierra = !chat.abierta && antes.abierta
  // Al cerrar, la hoja y el fantasma siguen a la vista mientras la mascota vuelve (6.1)
  if (abre) hojaCerrando = false
  if (cierra) { hojaCerrando = seVeia; ladoVisto = null }
  // La mascota saluda 1,2 s en una charla vacía que aparece y festeja 1,6 s al terminar (3.3)
  if (chat.abierta && chat.estado === 'vacio' && (!antes.abierta || chat.conversacion?.id !== antes.conversacion?.id)) poseDeUnRato('chatSaludo', SALUDA_MS)
  if (chat.estado === 'listo' && antes.estado !== 'listo') poseDeUnRato(null, FELIZ_MS)
  if (chat.borrador !== campoChat.value) { campoChat.value = chat.borrador; ajustarCampo() }
  for (const e of efectos) efectoChat(e)
  vigilarEspera()
  if (chat.abierta !== antes.abierta) {
    // La marca se muda (3.2): su motor se pausa y la zona suma o saca la hoja
    verAvis()
    recolocar()
    enviarZona()
  }
  pintarHoja()
  if (abre && hojaSeVe()) abrirConMudanza()
  if (cierra && hojaCerrando) cerrarConMudanza()
  if (chat.estado === 'listo' && antes.estado !== 'listo' && hojaSeVe()) movimientoChat.aparecerPie([...$$('#chat-hilo .pie-m')].at(-1))
  // El chip de un archivo soltado nace desde el centro de la capa (6.2); el del clip aparece quieto
  for (const e of efectos) {
    if (e.tipo !== 'chip' || !e.desdeCapa || !hojaSeVe()) continue
    movimientoChat.nacerChip([...$$('#chat-adjuntos .chip-adj')].find(x => x.dataset.ruta === e.ruta), centroSoltar)
  }
  for (const e of efectos) {
    if (e.tipo !== 'foco') continue
    // Al abrir, el foco va al campo cuando la mascota aterrizó (3.5)
    if (actoHoja && e.a === 'campo') actoHoja.then(() => enfocarEnHoja('campo'))
    else enfocarEnHoja(e.a, e.id)
  }
}

/** Lo que mueven los actos de la hoja (chatMotion.js). */
function refsHoja(piezas) {
  return { hoja: hojaEl, marcaAvi: $('#marca-avi'), chatAvi: $('#chat-avi'), destello: $('#hoja .destello'), piezas, lado: st.chat.lado, especie: st.mascota }
}

/**
 * La mudanza al abrir (6.1): la hoja ya está dibujada; la mascota vuela de la marca al escenario y lo
 * de la hoja sube escalonado (el nombre, el estado, la cabecera, la bienvenida o el hilo, el composer).
 */
function abrirConMudanza() {
  const bienvenida = $('#chat-hilo .bienvenida')
  const piezas = [$('#chat-nom'), $('#chat-est'), $('#chat-cab'), ...(bienvenida ? bienvenida.children : [$('#chat-hilo')]), $('#hoja .comp')].filter(Boolean)
  const acto = movimientoChat.abrirHoja(refsHoja(piezas))
  actoHoja = acto
  acto.then(() => { if (actoHoja === acto) actoHoja = null })
}

/**
 * La mudanza al cerrar (6.1): la mascota vuelve a la marca y la hoja se pliega. Al terminar, la hoja se
 * esconde y la marca vuelve al 100 % en el mismo cuadro en que se va el clon (sin la transición de 400 ms).
 */
function cerrarConMudanza() {
  const piezas = [$('#chat-nom'), $('#chat-est'), $('#hoja .escenario .arriba'), $('#hoja .charla')].filter(Boolean)
  movimientoChat.cerrarHoja(refsHoja(piezas)).then(() => {
    // Se volvió a abrir en el medio: el acto nuevo ya cortó a este
    if (st.chat.abierta || !hojaCerrando) return
    hojaCerrando = false
    const aviMarca = $('#marca-avi')
    aviMarca.style.transition = 'none'
    pintarHoja()
    verAvis()
    void aviMarca.offsetWidth
    aviMarca.style.removeProperty('transition')
  })
}

/**
 * La hoja se pliega con el panel (3.1) hacia `destino` (px CSS de la ventana: la muesca o la tira),
 * con la misma forma que el tablero y 60 ms antes que él. `conHoja`: se veía antes del cambio (quien
 * llama lo mira antes de tocar el estado). Vuelve después de los 60 ms con qué soltarla: se llama
 * cuando la clase que la esconde ya está puesta (body.mini o la muesca cerrada).
 */
async function plegarHojaCon(conHoja, destino, radio, ancla, opciones) {
  const desde = st.disp?.local?.hoja
  if (!conHoja || !desde || !hayMovimiento()) return async () => {}
  document.body.classList.add('hoja-mueve')
  const listo = movimientoChat.plegarHoja(hojaEl, plegadoHacia(desde, destino, radio, ancla), opciones)
  await new Promise(r => setTimeout(r, ADELANTO_PLIEGUE_MS))
  return async () => {
    const soltar = await listo
    document.body.classList.remove('hoja-mueve')
    soltar()
  }
}

/**
 * Al revés: la hoja nace con la forma de donde viene el panel (`origen`) y crece hasta su lugar, junto
 * con el tablero. Devuelve la promesa; quien llama saca `hoja-mueve` cuando la hoja ya se ve sola.
 */
function desplegarHojaDesde(origen, radio, ancla) {
  if (!hojaSeVe() || !st.disp?.local?.hoja || !origen || !hayMovimiento()) return Promise.resolve()
  document.body.classList.add('hoja-mueve')
  return movimientoChat.desplegarHoja(hojaEl, plegadoHacia(st.disp.local.hoja, origen, radio, ancla))
}

/** Redibuja cuando termina la pose de un rato (`clave`: dónde se anota su comienzo, si hace falta). */
function poseDeUnRato(clave, ms) {
  if (clave) st[clave] = Date.now()
  clearTimeout(temporizadorPose)
  temporizadorPose = setTimeout(programarHoja, ms + 20)
}

/**
 * Guarda en la PC lo que pide `guardadosPendientes` (9.1): `ya`, enseguida (y cancela el guardado
 * pendiente de esa charla); `luego`, una vez cada 2 s con lo último que haya. De a uno por vez, en
 * orden: un guardado viejo nunca llega después de uno nuevo.
 */
function guardarCharlas(pendientes) {
  for (const g of pendientes) {
    if (g.cuando === 'luego') {
      if (!guardadoLuego) {
        guardadoLuego = setTimeout(() => {
          guardadoLuego = null
          const conv = st.chat.conversacion
          if (conv?.id === g.conversacion.id) guardarCharla(conv, false)
        }, GUARDAR_CADA_MS)
      }
      continue
    }
    if (guardadoLuego && st.chat.conversacion?.id === g.conversacion.id) { clearTimeout(guardadoLuego); guardadoLuego = null }
    guardarCharla(g.conversacion, g.engram)
  }
}

/** `chat_guardar`: el archivo de la charla y, en un `fin`, la copia en Engram (9.2). */
function guardarCharla(conv, engram) {
  if (!tauri?.core) return
  const pedido = { conversacion: aArchivo(conv), mascota: nombreMascota(), engram }
  colaGuardar = colaGuardar.then(() => invocar('chat_guardar', pedido)).catch(err => registrar(`chat guardar: ${err}`))
}

/** Los efectos de una transición: comandos de Rust, el selector de carpetas y los anuncios. */
function efectoChat(e) {
  if (!tauri?.core && e.tipo !== 'anunciar' && e.tipo !== 'foco') return
  switch (e.tipo) {
    case 'abrir': {
      // Precalienta sin mandar nada (D19). Con el motor local, además, qué hay del modelo (solo lee)
      abriendo = invocar('chat_abrir', { conversacion: e.conversacion, motor: e.motor, carpeta: e.carpeta, mascota: nombreMascota(), sesionClaude: e.sesionClaude })
        .then(resultado => despacharChat({ tipo: 'abierta', conversacion: e.conversacion, resultado }))
        .catch(err => registrar(`chat abrir: ${err}`))
      if (e.motor === 'local') leerModelo()
      break
    }
    case 'enviar': {
      const { conversacion, turno, texto, adjuntos, historia } = e
      // Los adjuntos van como rutas: los bytes los lee Rust (10). La historia, solo con el motor local (8)
      abriendo.then(() => invocar('chat_enviar', { conversacion, turno, texto, adjuntos, datos: datosAvis(st.proyectos, Date.now()), historia: historia ?? null }))
        .catch(err => {
          registrar(`chat enviar: ${err}`)
          const motivo = st.chat.conversacion?.motor === 'local' ? 'local' : 'otro'
          despacharChat({ tipo: 'backend', payload: { conversacion, turno, tipo: 'error', motivo, detalle: String(err) } })
        })
      break
    }
    case 'frenar':
      invocar('chat_frenar', { conversacion: e.conversacion, turno: e.turno }).catch(err => registrar(`chat frenar: ${err}`))
      break
    case 'preferencias':
      invocar('guardar_chat', { motor: e.motor, carpeta: e.carpeta })
        .then(r => despacharChat({ tipo: 'recientes', recientes: r?.recientes }))
        .catch(err => registrar(`chat preferencias: ${err}`))
      break
    case 'elegir-adjuntos':
      // El selector nativo de archivos (D10), solo con el clic en el clip o en "Resumime un PDF"
      invocar('elegir_adjuntos')
        .then(rutas => despacharChat({ tipo: 'elegidos', rutas }))
        .catch(err => registrar(`chat elegir adjuntos: ${err}`))
      break
    case 'revisar-adjuntos':
      revisarAdjuntos(e.rutas, e.desdeCapa)
      break
    case 'elegir-carpeta':
      // El selector nativo de carpetas (D10), solo con el clic en "Elegir otra carpeta…"
      invocar('elegir_carpeta')
        .then(ruta => { if (ruta) despacharChat({ tipo: 'carpeta', carpeta: ruta }) })
        .catch(err => registrar(`chat elegir carpeta: ${err}`))
      break
    case 'anunciar':
      anunciarChat(e.texto)
      break
    case 'historial':
      // La lista del disco (9.1): al arrancar y al abrir el cajón
      invocar('chat_historial').then(lista => despacharChat({ tipo: 'historial', charlas: lista }))
        .catch(err => registrar(`chat historial: ${err}`))
      break
    case 'leer':
      // Una charla del disco: para retomarla desde el cajón, o la última al arrancar (D11)
      invocar('chat_leer', { id: e.id })
        .then(doc => despacharChat(e.para === 'recordar' ? { tipo: 'recordar', conversacion: doc } : { tipo: 'retomar', id: e.id, conversacion: doc }))
        .catch(err => registrar(`chat leer: ${err}`))
      break
    case 'borrar':
      // El archivo y su copia en Engram (solo la de avis); la de Claude Code queda (D29)
      colaGuardar = colaGuardar.then(() => invocar('chat_borrar', { id: e.id })).catch(err => registrar(`chat borrar: ${err}`))
      break
  }
}

/** Lleva el foco adonde dice la transición (3.5), cuando la hoja ya está dibujada. `id`: la charla del cajón. */
function enfocarEnHoja(a, id = null) {
  if (a === 'marca') { marcaBoton.focus({ preventScroll: true }); return }
  if (!hojaSeVe()) return
  const destino = {
    campo: campoChat, carpeta: $('#chat-cab .carpeta'), hist: $('#hoja .arriba [data-accion="ch-hist"]'), buscar: $('#chat-buscar'),
    borrar: $('#chat-hist-lista .h-borrar'),
    charla: id ? [...$$('#chat-hist-lista [data-accion="ch-retomar"]')].find(x => x.dataset.id === id) : null,
  }[a]
  destino?.focus({ preventScroll: true })
}

/** `estado_modelo` (solo lee, sin red): si el modelo de esta PC está, falta o se está bajando. */
function leerModelo() {
  if (!tauri?.core) return
  invocar('estado_modelo').then(e => despacharChat({ tipo: 'modelo', modelo: e?.modelo, bajado: e?.bajado, total: e?.total }))
    .catch(err => registrar(`chat modelo: ${err}`))
}

/** Un evento `oficina://modelo` (la descarga o el borrado desde la bandeja). */
function alEventoModelo(p) {
  switch (p?.tipo) {
    case 'estado': despacharChat({ tipo: 'modelo', modelo: p.modelo, bajado: p.bajado, total: p.total }); break
    case 'progreso': despacharChat({ tipo: 'modelo', modelo: 'bajando', bajado: p.bajado, total: p.total }); break
    case 'bajado': despacharChat({ tipo: 'modelo', modelo: 'listo', bajado: p.total, total: p.total }); break
    case 'fallo': registrar(`chat modelo: ${p.motivo} ${p.detalle ?? ''}`); leerModelo(); break
    case 'cancelado': leerModelo(); break
  }
}

/**
 * El reloj de la espera: cada segundo, mientras hay un turno, reescribe el reloj en su lugar (y la
 * nota de los 45 s); a los 120 s sin ningún evento del turno, `vencio` (D6). Corre aunque la hoja
 * no se vea: el turno sigue en Rust.
 */
function vigilarEspera() {
  if (!ocupado(st.chat)) { clearInterval(temporizadorEspera); temporizadorEspera = null; return }
  if (temporizadorEspera) return
  temporizadorEspera = setInterval(() => {
    const c = st.chat
    if (!ocupado(c)) { clearInterval(temporizadorEspera); temporizadorEspera = null; return }
    // Con el motor local despertando (paso 0) no vence: el reloj sigue y Rust avisa si no arranca
    if (relojEspera(c.desdeMs, c.ultimoMs, Date.now()).vencido && puedeVencer(c)) { despacharChat({ tipo: 'vencio', turno: c.turno }); return }
    programarHoja()
  }, 1000)
}

/** Un redibujo de la hoja por cuadro como mucho (13): el texto llega cada 50 ms. */
function programarHoja() {
  if (!cuadroHoja) cuadroHoja = requestAnimationFrame(() => { cuadroHoja = 0; pintarHoja() })
}

/**
 * Pone el HTML si cambió su firma, y si el foco estaba adentro lo devuelve al mismo control (por su
 * `data-accion` y `data-motor`): la carpeta, el motor o un botón del hilo.
 */
function ponerConFoco(sel, html) {
  const el = $(sel)
  const activo = el.contains(document.activeElement) ? document.activeElement : null
  const clave = activo && ['accion', 'motor', 'i', 'id'].map(k => activo.dataset[k] ?? '').join('|')
  if (!poner(sel, html)) return
  if (!clave) return
  const igual = [...el.querySelectorAll('[data-accion]')].find(x => ['accion', 'motor', 'i', 'id'].map(k => x.dataset[k] ?? '').join('|') === clave)
  igual?.focus({ preventScroll: true })
}

/** ¿El hilo está abajo del todo (con 40 px de margen)? Entonces sigue al texto que llega. */
const alFondo = el => el.scrollHeight - el.scrollTop - el.clientHeight < 40

/**
 * El hilo (6.2): se redibuja entero solo si cambió algo más que el texto que llega. Mientras llega,
 * los bloques que se cierran se agregan como nodos nuevos y el abierto se reescribe en su lugar
 * (nunca un innerHTML de todo, que cortaría lo que ya está); el reloj de la espera, en su lugar.
 */
function pintarHilo(m) {
  const el = $('#chat-hilo')
  const c = m.chat
  const seguir = alFondo(el)
  // Las palabras nuevas entran con `.w` (6.2), salvo sin movimiento o con la hoja que vuelve a verse
  // después de plegada: lo que llegó mientras tanto se agrega quieto (6.3)
  const animar = hayMovimiento() && !vivo.quieto
  vivo.quieto = false
  let html, firma
  if (c.estado === 'escribiendo') {
    // La firma sin el texto que llega (un espacio en su lugar): cambia solo si cambia lo demás, y
    // solo entonces se arma el hilo entero, con lo ya visto quieto
    const conv = c.conversacion
    const mensajes = conv.mensajes.map((x, k) => (k === conv.mensajes.length - 1 ? { ...x, texto: ' ' } : x))
    firma = hiloVista({ ...m, mostrado: null, chat: { ...c, conversacion: { ...conv, mensajes } } })
    html = st.firmas['#chat-hilo'] === firma ? '' : hiloVista({ ...m, mostrado: vivo.turno === c.turno ? vivo.texto : '', animar })
  } else {
    html = hiloVista(m)
    firma = html.replace(/data-reloj>[^<]*</, 'data-reloj><')
  }
  const llega = c.estado === 'escribiendo' ? c.conversacion.mensajes.at(-1).texto : ''
  if (poner('#chat-hilo', html, firma)) {
    vivo.turno = c.turno
    vivo.texto = llega
    if (seguir) el.scrollTop = el.scrollHeight
    return
  }
  if (c.estado === 'escribiendo') {
    const txt = el.querySelector('.m-m.vivo .txt')
    const abiertoEl = txt?.querySelector('.abierto')
    if (!abiertoEl) return
    const t = tramoVivo(vivo.turno === c.turno ? vivo.texto : '', llega)
    if (t.reinicia) {
      // El texto no sigue al de antes: entero de nuevo, quieto
      st.firmas['#chat-hilo'] = null
      vivo.texto = llega
      poner('#chat-hilo', hiloVista(m), firma)
    } else if (t.continua) {
      // Lo común: solo crece el bloque abierto; las palabras nuevas se agregan al final, sin tocar las puestas
      if (t.nuevo) abiertoEl.insertAdjacentHTML('beforeend', htmlPalabras(t.nuevo, animar))
    } else {
      // Se cerraron bloques: se dibujan en su lugar, quietos, y el abierto empieza de nuevo con lo que falta
      const n = Number(txt.dataset.bloques) || 0
      abiertoEl.insertAdjacentHTML('beforebegin', t.cerrados.slice(n).map(markdownSeguro).join(''))
      txt.dataset.bloques = String(t.cerrados.length)
      abiertoEl.innerHTML = escapar(t.visto) + htmlPalabras(t.nuevo, animar)
    }
    vivo.turno = c.turno
    vivo.texto = llega
  } else {
    const reloj = /data-reloj>([^<]*)</.exec(html)?.[1]
    const relojEl = el.querySelector('[data-reloj]')
    if (reloj != null && relojEl && relojEl.textContent !== reloj) relojEl.textContent = reloj
  }
  if (seguir) el.scrollTop = el.scrollHeight
}

/**
 * La hoja (3.2): abierta o cerrada, la marca mudada, el escenario, la cabecera, el hilo, el composer,
 * el menú, el cajón y la capa de soltar. Plegada (la tira, la muesca cerrada) o escondida no se
 * dibuja: queda como estaba (borrador, adjuntos y scroll) y se pone al día al volver a verse.
 */
function pintarHoja() {
  const c = st.chat
  const nombre = nombreMascota()
  const etiqueta = `Charlar con ${nombre}`
  if (marcaBoton.getAttribute('aria-label') !== etiqueta) {
    marcaBoton.setAttribute('aria-label', etiqueta)
    marcaBoton.setAttribute('title', etiqueta)
  }
  marcaBoton.setAttribute('aria-expanded', String(c.abierta))
  const marcaEl = $('.marca')
  // Mientras la mascota vuelve (cerrando, 6.1), la hoja y el fantasma quedan como estaban
  marcaEl.classList.toggle('mudada', c.abierta || hojaCerrando)
  // El punto del fantasma ("en la charla →") es del color de la mascota
  marcaEl.style.setProperty('--c-mascota', datosEspecie(st.mascota).c)
  hojaEl.hidden = !c.abierta && !hojaCerrando
  document.body.classList.toggle('con-charla', c.abierta)
  if (!c.abierta || !hojaSeVe()) {
    // Cerrada, plegada o escondida: lo que llegue mientras tanto se agrega quieto cuando vuelva a verse (6.3)
    vivo.quieto = true
    return
  }
  const m = modeloVista()
  hojaEl.dataset.estado = c.estado
  hojaEl.dataset.motor = c.conversacion?.motor ?? c.motor
  hojaEl.style.setProperty('--c', datosEspecie(st.mascota).c)
  hojaEl.setAttribute('aria-label', `Charla con ${nombre}`)
  campoChat.setAttribute('aria-label', `Mensaje para ${nombre}`)
  campoChat.setAttribute('placeholder', `Preguntale a ${nombre}…`)
  // El clip: con el motor local se apaga y dice por qué (3.4)
  const clip = clipAdjuntar(m)
  const clipEl = $('#chat-clip')
  clipEl.disabled = clip.deshabilitado
  clipEl.title = clip.titulo
  const hist = $('#hoja .arriba [data-accion="ch-hist"]')
  hist.setAttribute('aria-expanded', String(c.cajon))
  poner('#chat-avi', aviEscena(m))
  texto('#chat-nom', nombre)
  poner('#chat-est', estadoEscena(m))
  ponerConFoco('#chat-cab', cabecera(m))
  pintarHilo(m)
  const comp = composer(m)
  poner('#chat-adjuntos', comp.adjuntos)
  ponerConFoco('#chat-boton', comp.boton)
  texto('#chat-pista', comp.pista)
  texto('#chat-pie', comp.pie)
  const menu = $('#chat-menu')
  menu.hidden = !c.menu
  if (c.menu) ponerConFoco('#chat-menu', menuCarpeta(m))
  else st.firmas['#chat-menu'] = null
  pintarCajon(m)
  poner('#chat-soltar', capaSoltar(m))
}

/** El cajón: su armazón al abrirlo (el buscador no se redibuja mientras se escribe) y la lista. */
function pintarCajon(m) {
  const lugar = $('#chat-cajon-lugar')
  if (!m.chat.cajon) {
    if (lugar.childElementCount) { lugar.innerHTML = ''; buscarChat = '' }
    return
  }
  if (!lugar.childElementCount) {
    lugar.innerHTML = cajon(m, buscarChat)
    st.firmas['#chat-hist-lista'] = listaHistorial(m, buscarChat)
  } else {
    // Con el foco en "Borrar", sigue ahí cuando pasa a "¿Borrar? Sí"
    ponerConFoco('#chat-hist-lista', listaHistorial(m, buscarChat))
  }
}

/** Manda lo escrito (Enter, Ctrl+Enter o Enviar): con un turno en curso o vacío, nada (D7). */
function mandarCampo() {
  despacharChat({ tipo: 'enviar', texto: campoChat.value, campo: true })
}

/** El campo crece con lo escrito, hasta 5 líneas. */
function ajustarCampo() {
  campoChat.style.height = 'auto'
  campoChat.style.height = `${Math.min(campoChat.scrollHeight, 120)}px`
}

/** Los botones de la hoja (`data-accion="ch-…"`). Cada uno hace solo lo suyo. */
async function accionChat(a, b) {
  const c = st.chat
  switch (a) {
    case 'ch-cerrar': despacharChat({ tipo: 'cerrar' }); break
    case 'ch-hist': despacharChat({ tipo: 'hist' }); break
    case 'ch-menu':
      if (b.getAttribute('aria-disabled') === 'true') return
      despacharChat({ tipo: 'menu' })
      if (st.chat.menu) ($('#chat-menu [aria-checked="true"]') ?? $('#chat-menu [role^="menuitem"]'))?.focus()
      break
    case 'ch-carpeta': despacharChat({ tipo: 'carpeta', carpeta: b.dataset.carpeta || null }); enfocarEnHoja('carpeta'); break
    case 'ch-otra-carpeta': despacharChat({ tipo: 'elegir-otra' }); enfocarEnHoja('carpeta'); break
    case 'ch-motor': elegirMotor(b.dataset.motor); break
    case 'ch-enviar': if (!b.disabled) mandarCampo(); break
    case 'ch-frenar': despacharChat({ tipo: 'frenar' }); campoChat.focus(); break
    case 'ch-sugerencia': {
      // Una sugerencia es un clic explícito: manda su texto como si se hubiera escrito (3.5)
      const conv = c.conversacion
      const s = sugerencias(conv?.motor ?? c.motor, conv?.carpeta ? nombreCarpeta(conv.carpeta) : null)[Number(b.dataset.i)]
      // "Resumime un PDF" abre el selector de archivos: no manda nada (4.1)
      if (s) despacharChat(s.adjuntar ? { tipo: 'adjuntar' } : { tipo: 'enviar', texto: s.texto })
      break
    }
    case 'ch-adjuntar': if (!b.disabled) despacharChat({ tipo: 'adjuntar' }); break
    case 'ch-quitar': despacharChat({ tipo: 'quitar', ruta: b.dataset.ruta }); break
    case 'ch-descartar-adjunto': despacharChat({ tipo: 'descartar-adjunto' }); campoChat.focus(); break
    case 'ch-reintentar': despacharChat({ tipo: 'reintentar' }); break
    case 'ch-volver-a-preguntar': despacharChat({ tipo: 'volver-a-preguntar' }); break
    case 'ch-nueva': despacharChat({ tipo: 'nueva' }); break
    case 'ch-descartar': despacharChat({ tipo: 'descartar' }); campoChat.focus(); break
    case 'ch-todos': despacharChat({ tipo: 'todos' }); break
    case 'ch-usar-local': elegirMotor('local'); break
    case 'ch-usar-claude': elegirMotor('claude'); break
    case 'ch-primeros-pasos': await abrirAsistente({ foco: true }); break
    case 'ch-descargar':
      // La única salida a la red del modelo local, solo con este clic
      try {
        await invocar('descargar_modelo')
        despacharChat({ tipo: 'modelo', modelo: 'bajando' })
      } catch (err) { registrar(`chat descargar: ${err}`) }
      break
    case 'ch-retomar': despacharChat({ tipo: 'retomar', id: b.dataset.id }); break
    case 'ch-borrar': despacharChat({ tipo: 'borrar-charla' }); break
    case 'ch-copiar': await copiarDeHoja(b, c.conversacion?.mensajes[Number(b.dataset.i)]?.texto ?? ''); break
    case 'ch-copiar-codigo': await copiarDeHoja(b, b.closest('pre')?.querySelector('code')?.textContent ?? ''); break
  }
}

/** Cambia el motor (el radiogroup, "Preguntarle al modelo local" o "Usar Claude Code"); el foco queda en la opción. */
function elegirMotor(motor) {
  despacharChat({ tipo: 'motor', motor })
  if ($('#chat-cab').contains(document.activeElement) || document.activeElement === document.body) $(`#chat-cab [data-motor="${motor}"]`)?.focus()
}

/** "Copiar": el texto tal cual; el botón dice "Copiado" 1,6 s sin redibujar. */
async function copiarDeHoja(b, textoACopiar) {
  try {
    await navigator.clipboard.writeText(textoACopiar)
  } catch (e) {
    registrar(`chat copiar: ${e}`)
    return
  }
  const antes = b.textContent
  b.textContent = 'Copiado'
  setTimeout(() => { if (b.isConnected) b.textContent = antes }, 1600)
}

/** Los elementos con foco de un contenedor, en orden. */
const enfocables = raiz => [...raiz.querySelectorAll('button:not([disabled]), input, textarea, [tabindex="0"]')].filter(x => !x.closest('[hidden]'))

/**
 * Las teclas de la hoja (3.5), antes que las de la pregunta y la muesca. Enter (y Ctrl+Enter) manda
 * y Shift+Enter hace una línea nueva; Esc cierra el menú, el cajón, frena o cierra la hoja, en ese
 * orden; el menú y el motor se mueven con las flechas; el cajón atrapa el foco.
 */
function teclaChat(e) {
  if (!st.chat.abierta || !e.target.closest?.('#hoja')) return false
  const c = st.chat
  if (e.target === campoChat && teclaControl(e) === 'enviar') { e.preventDefault(); mandarCampo(); return true }
  if (e.key === 'Escape') { e.preventDefault(); despacharChat({ tipo: 'esc' }); return true }
  // El menú de una charla del cajón con la tecla Menú o Shift+F10 (D24)
  const charla = e.target.closest?.('#chat-hist-lista [data-accion="ch-retomar"]')
  if (charla && (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); despacharChat({ tipo: 'menu-charla', id: charla.dataset.id }); return true }
  if (c.menu && e.target.closest('#chat-menu')) {
    const items = [...$$('#chat-menu [role^="menuitem"]')]
    const k = items.indexOf(e.target)
    const destino = { ArrowDown: k + 1, ArrowUp: k - 1, Home: 0, End: items.length - 1 }[e.key]
    if (destino != null) { e.preventDefault(); items[(destino + items.length) % items.length]?.focus(); return true }
    if (e.key === 'Tab') { despacharChat({ tipo: 'menu' }); return false }
  }
  const radio = e.target.closest?.('[data-motor]')
  if (radio && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    elegirMotor(radio.dataset.motor === 'claude' ? 'local' : 'claude')
    return true
  }
  if (c.cajon && e.key === 'Tab') {
    const lista = enfocables($('#chat-cajon'))
    if (!lista.length) return false
    const k = lista.indexOf(e.target)
    if (e.shiftKey && k <= 0) { e.preventDefault(); lista.at(-1).focus(); return true }
    if (!e.shiftKey && (k === -1 || k === lista.length - 1)) { e.preventDefault(); lista[0].focus(); return true }
  }
  return false
}

// Lo escrito queda en st.chat tecla a tecla (regla 2); el campo no se redibuja y Enviar se prende solo
campoChat.addEventListener('input', () => {
  st.chat = { ...st.chat, borrador: campoChat.value }
  ajustarCampo()
  const enviar = $('#chat-boton [data-accion="ch-enviar"]')
  if (enviar) enviar.disabled = !campoChat.value.trim() && !st.chat.adjuntos.length
})
document.addEventListener('input', e => {
  if (e.target.id !== 'chat-buscar') return
  buscarChat = e.target.value
  poner('#chat-hist-lista', listaHistorial(modeloVista(), buscarChat))
})
// Un clic afuera del menú de carpeta lo cierra (3.5); lo mismo el menú de una charla del cajón
document.addEventListener('pointerdown', e => {
  if (st.chat.menu && !e.target.closest?.('#chat-menu, #chat-cab .carpeta')) despacharChat({ tipo: 'menu' })
  if (st.chat.menuCharla && !e.target.closest?.('#chat-hist-lista .h-menu')) despacharChat({ tipo: 'menu-charla', id: st.chat.menuCharla.id })
})
// Clic derecho en una charla del cajón: su menú, con "Borrar" (D24)
document.addEventListener('contextmenu', e => {
  const charla = e.target.closest?.('#chat-hist-lista [data-accion="ch-retomar"]')
  if (!charla) return
  e.preventDefault()
  despacharChat({ tipo: 'menu-charla', id: charla.dataset.id })
})

/** Pinta la marca: su ánimo real y la descripción del Avi-botón. Con la hoja abierta, su motor está quieto (3.2). */
function pintarMarca(ahora = Date.now()) {
  const animo = animoMarca(st.proyectos, ahora)
  marca.animo(animo, reposoPermitido(st.proyectos, ahora))
  texto('#marca-animo', animoTexto(animo))
}

marcaBoton.addEventListener('pointerdown', e => { toqueMarca = { x: e.screenX, y: e.screenY } })
marcaBoton.addEventListener('click', e => {
  const toque = toqueMarca
  toqueMarca = null
  // Después de un arrastre real, el clic que sigue se descarta; con el mouse, es clic hasta 4 px (3.1)
  if (justoArrastro) return
  if (e.detail > 0 && toque && superaUmbral(e.screenX - toque.x, e.screenY - toque.y)) return
  // Con la pantalla dividida la marca no se ve: la charla no se abre desde ahí (D4)
  if (st.dividida.clave) return
  despacharChat({ tipo: 'alternar' })
})

// La vista de desarrollo (dev/falso.js) maneja la hoja por acá para mostrar cada estado
if (window.__vistaDev) window.__chat = { despachar: despacharChat, estado: () => st.chat }

async function iniciar() {
  // Las definiciones de los Avis (piel, luz de piso y desenfoque), una vez por documento (5.1)
  document.body.insertAdjacentHTML('afterbegin', defsAvis())
  if (tauri?.core) {
    // La mascota, antes del primer dibujo: las firmas no la llevan (mascotas-avi-ux.md 9.1)
    try { st.mascota = especieValida(await invocar('mascota')) } catch { st.mascota = ESPECIE_POR_DEFECTO }
    try {
      const m = await invocar('estado_menu')
      if (typeof m.arriba === 'boolean') ponerArriba(m.arriba)
      if (typeof m.avisar === 'boolean') st.avisar = m.avisar
      if (typeof m.pausa === 'boolean') ponerPausa(m.pausa)
      // Dónde quedó el tablero flotante la última vez (fracciones del área, 9.7)
      if (m.flotante && typeof m.flotante === 'object') st.fraccion = { x: Number(m.flotante.x), y: Number(m.flotante.y) }
      // El motor y la carpeta de la próxima charla, y las recientes (chat-avis-ux.md 3.4, D11)
      if (m.chat && typeof m.chat === 'object') {
        st.chat = {
          ...st.chat, motor: m.chat.motor === 'local' ? 'local' : 'claude',
          carpeta: typeof m.chat.carpeta === 'string' ? m.chat.carpeta : null, recientes: Array.isArray(m.chat.recientes) ? m.chat.recientes : [],
        }
      }
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
    // El mod automático (#17): la instalación sola que empieza y el aviso de una vez
    escuchar('oficina://mod-auto', ev => alEventoModAuto(ev.payload))
    tomarAvisoMod()
    // La charla (chat-avis-ux.md 7.5): cada evento lleva su conversación y su turno; transicionChat
    // descarta los de otra conversación o de un turno viejo
    escuchar('oficina://chat', ev => despacharChat({ tipo: 'backend', payload: ev.payload }))
    // El modelo de esta PC (3.6): la descarga y el borrado desde la bandeja
    escuchar('oficina://modelo', ev => alEventoModelo(ev.payload))
    // Los archivos que se sueltan (10): Tauri los toma antes que el HTML (`dragDropEnabled`)
    tauri.webview?.getCurrentWebview?.()?.onDragDropEvent(ev => alArrastrarArchivo(ev.payload))
      ?.catch(err => registrar(`chat arrastrar: ${err}`))
    // El historial de la charla (9.1): la lista del disco y, si es de las últimas 12 h, la última (D11)
    efectoChat({ tipo: 'historial' })
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
