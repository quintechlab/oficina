// Ventana del widget: lee las sesiones locales cada 1,5 s y el equipo cada 60 s, y pinta el
// tablero (barra de proyectos, encabezado, chips de conteo, escenas de las sesiones y equipo), la tarjeta de pregunta, la tira mini,
// la bandeja y los avisos. Cada parte se redibuja solo si cambió lo que muestra, para no cortar
// las animaciones.

import { agruparPorProyecto, preguntasPendientes, preguntasNuevas, resumenMini, escapar, reposoPermitido, superaUmbral, animoSesion } from './logica.js'
import { companeros } from './equipo.js'
import { iconoBandeja, textoInsignia } from './bandeja.js'
import {
  zoomDe, pasoQueEntra, direccionDeTecla, tamanoDeseado, fueraDeLugar, posicionEnPantalla, tamanoMini, medidaVentana, PASO_POR_DEFECTO,
  fraccionFlotante, posicionDeFraccion,
} from './tamano.js'
import { textoRespondido, estadoEnvio, objetivoDelClic, registrarEleccion, alternarSeleccion, motivoRechazo, lineaClic } from './responder.js'
import {
  prepararProyecto, firmaEscenas, sesiones, carasMini, companero, firmaCompanero,
  tiraRepos, encabezadoSesiones, animoMarca, estadoMarca, figuraMarca, figuraVacio, conteos, chips, colorProyecto, animoTexto,
} from './tablero.js'
import {
  vistaBarra, clicFrenar, validarTexto, teclaControl, lineaResultado, lineaError, pasoOrden,
  borradorTrasOrden, lineaAlEscribir, MS_CONFIRMAR_FRENAR, MS_SONDEO_ORDEN, MS_LINEA,
  clicCerrar, MS_CONFIRMAR_CERRAR, cerrandoSesion, destinoFocoCierre, anuncioCierre, MS_TOPE_CERRANDO, vencerCierre,
} from './control.js'
import { MS_RELEER as MS_RELEER_HISTORIAL } from './historial.js'
import { globo, avisoOtroProyecto, quienPregunta, anuncioPregunta } from './pregunta.js'
import { defsAvis, nombreClaude } from './avis.js'
import { especieValida, ESPECIE_POR_DEFECTO, datosEspecie } from './especies.js'
import { avanzarEvolucion, coordinaciones, debeActuar, ordenActos, actoPendiente, CLAVE_MARCA, TAMANO_MIN_ACTO } from './evolucion.js'
import * as movimientoEvolucion from './evolucionMotion.js'
import { entrada, cambioProyecto, hayMovimiento } from './tableroMotion.js'
import { entradaEscenas, idsDeEscena, novedades, marcarNuevos, vigilarEscenas, salirTarjetas } from './escenaMotion.js'
import { montarMarca } from './marcaMotion.js'
import { pesosMarca } from './marca.js'
import {
  esHorizontal, bordeCercano, lugarDe, lugarAjustado, disposicionAcoplada, zonaInteractiva, recorte, cajaArrastre,
  posicionFlotante, dentroDe, ventanaDeArea, mismoRect, relativo, estadoMuesca, contenidoMuesca, contenidoPildora, estiloMuesca, ESTADO_INICIAL, siguiente, tocaGolpe, PILDORA,
  planVentana, tamMuescaDe, figuraMuesca, disposicionFlotante, disposicionTira, plegadoHacia, anclaHacia, fueraDelBorde, centroDe,
  lugarGloboMuesca, absoluto,
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
  carpetasDeProyectos, ladoHoja, rectHoja, hojaBaja, anuncioAdjuntos, SALUDA_MS, FELIZ_MS, ADELANTO_PLIEGUE_MS, aArchivo, guardadosPendientes, GUARDAR_CADA_MS,
  sobreHoja, nombreArchivo, puedeVencer, modeloValido, nombreModelo,
} from './chat.js'
import { aviEscena, estadoEscena, cabecera, hilo as hiloVista, composer, menuCarpeta, menuModelo, cajon, listaHistorial, capaSoltar, htmlPalabras, clipAdjuntar } from './chatVista.js'
import * as movimientoChat from './chatMotion.js'
import {
  conversaciones, conversacionesNuevas, mensajesNuevos, convsVisibles, debeAbrirseSola, ladoIzquierdo, primeroDe, pausaVuelta, nombreLado, textoSub,
  geometriaDividida, cuentaVuelta, rastroConversa, anuncioEmpieza, anuncioTermina, esperaRespuesta, RECIEN_SOLA_MS, CONTESTO_MS, ESPERA_VUELTA_MS,
} from './dividida.js'
import { fichasConversan, riel, cabConversa, pestanas as pestanasConv, mitades, firmaMitades, puente, fichaUltimo } from './divididaVista.js'
import * as movimientoDividida from './divididaMotion.js'
import {
  configInicial, abrirConfiguracion, cerrarConfiguracion, alEsc, esAtajoConfiguracion, pestanaSiguiente, validarAjuste,
  valorInterruptor, INTERRUPTORES, ubicacionDe, bordeDeUbicacion, IDS_PESTANAS, elegirForma, anuncioEspecie, anuncioForma,
  textoMod, textoModelo, modeloDesdeChat, descargaDesdeConfig, puntoPestana, filasEnEstaPC, clicBorrar, armadoVigente, desarmarVencido, MS_CONFIRMAR,
  MOTORES, modeloDeValor, textoHistorial,
  PROVEEDORES, finalDe, formaClave, textoClave, clavesDesdeLectura, resultadoPrueba, anuncioPrueba, anuncioGuardada,
  ANUNCIO_CLAVE_BORRADA, empezarClave, retieneConfig, detalleErrorClave, marcoBajo,
} from './configuracion.js'
import {
  esqueletoConfiguracion, seccionConfiguracion, partesMascota, partesModelos, miniConfiguracion, nombrePestana,
} from './configuracionVista.js'
import * as movimientoConfig from './configuracionMotion.js'
import {
  tareasInicial, abrirTareas, cerrarTareas, cambiarVista, alEscTareas, esAtajoTareas, cuentas, nombreFilaTareas, subtituloTareas,
  validarNombreLista, textoErrorLista, validarTitulo, nuevaLista, nuevoId, renombrarLista, agregarTarea, tildarTarea, listaParaHoy,
  mezclarLectura, anuncioAgregada, anuncioBorradaLista, tiempoTilde, focoTrasTildar, hoyArgentina,
  buscarTarea, editarTarea, agregarSubtarea, tildarSubtarea, editarSubtarea, borrarTarea, moverTarea, listaParaGuardar,
  nuevaMudanza, soltarMudanzas, olvidarMudanzas, fechaDeOpcion, abrirDetalle, cerrarDetalle, diferirGuardado, nombreVista,
  MAX_SUBTAREAS, AVISO_INICIAL, evaluarAviso, verAviso, soltarAviso, textoGlobo, horaGlobo, anuncioGlobo, plano,
} from './tareas.js'
import { encolar, quitar, actual as globoActual, claveRec } from './globos.js'
import {
  ladoFilaTareas, esqueletoTareas, CARPETA, miniTareas, indiceTareas, cabeceraPanel, campoNueva, cuerpoLista,
  primerUso, errorGuardar, errorRota, errorCarpeta, atrasTarea, esqueletoDetalle, partesDetalle, globoMarca, globoMuesca, filaAviso,
} from './tareasVista.js'
import * as movimientoTareas from './tareasMotion.js'
import {
  habitosInicial, abrirHabitos, cerrarHabitos, verHabitos, empezarNuevo, abrirHabito, cerrarHabito, alEscHabitos, esAtajoHabitos,
  cuentasHoy, nombreFilaHabitos, subtituloHabitos, ordenarHabitos, esHabito, validarHabito, nuevoHabito, desdeSugerida, SUGERIDAS,
  toca as tocaHabito, hecho as hechoHabito, valor as valorHabito, racha as rachaHabito, marcar as marcarHabito, sumar as sumarHabito,
  corregir as corregirHabito, editar as editarHabito, conMejor, hitoNuevo, textoHito, AVISO_POR_DEFECTO,
  anuncioTilde, anuncioSuma, anuncioDiaCompleto, anuncioCorregido, anuncioCreado, anuncioBorrado,
  recordatoriosDebidos, recordar, recordatorioVigente, textosGlobo, textoHechoGlobo,
} from './habitos.js'
import {
  ladoFilaHabitos, esqueletoHabitos, CARPETA_HAB, partesHoja, primerUsoHabitos, errorCarpetaHab, fraseHtml, hitoHtml,
  globoHab, globoMuescaHab, filaAvisoHab,
} from './habitosVista.js'
import * as movimientoHabitos from './habitosMotion.js'
import { MODULOS, irModulo as planModulo, alEscModulo, cuentaModulo, nombreModulo, avisoPregunta, moduloAlExpandir, cuentasModulosMini, desplazarTira } from './modulos.js'
import { avisoPreguntaHtml, cuentasMiniHtml } from './modulosVista.js'
import * as movimientoModulos from './modulosMotion.js'

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
   * "Qué hizo" abierto (#25), uno por vez: { sesion, estado: 'cargando' | 'listo' | 'error', entradas,
   * error }, o null. Mientras está abierto se relee la transcripción cada 10 s.
   */
  historial: null,
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
  /** Los interruptores de la configuración (configuracion-ux.md 9.1), guardados en preferencias.json. */
  arriba: true,
  avisar: true,
  pausa: false,
  /** "Arrancar con Windows": la marca real del sistema (`leer_configuracion`, `poner_arranque`). */
  /**
   * El módulo a la vista (#42, modulos-ux.md 3.5): 'sesiones' | 'tareas' | 'habitos' | 'config'. Es la
   * única fuente de qué se ve y solo lo cambia `irModulo`; `config.abierta`, `tareas.abierta` y `habitos.abierta` son sus
   * derivados (los escribe `irModulo` al abrir o cerrar la hoja). Al arrancar, Sesiones (D-m8).
   */
  modulo: 'sesiones',
  /** Las preguntas pendientes de la última vez que se dibujó el menú: el chip de Sesiones late cuando suben (4.2). */
  preguntasMenu: null,
  arranque: false,
  /**
   * La configuración dentro del panel (#23, configuracion-ux.md 4.6): abierta, la pestaña (la última
   * de esta ejecución), la clave que se escribe, el borrado armado y el ajuste que no se pudo guardar.
   */
  config: configInicial(),
  /** Partes de la hoja ya dibujadas, para no redibujar lo que no cambió. */
  cfgFirmas: {},
  /**
   * La lectura del mod para la pestaña Instalación (`estado_mod`, configuracion-ux.md 9.2):
   * `{ claude, mod, revisado, fallo }`, o null hasta leerla (al abrir la configuración y cuando cambia el mod).
   */
  cfgMod: null,
  /** El último aviso del mod automático (`tomar_aviso_mod`) con la hora en que llegó: "Se actualizó solo…" (7.3). */
  ultimoAvisoMod: null,
  /** La versión de Avis (`leer_configuracion`), al pie de la pestaña Instalación. */
  version: null,
  /**
   * Las claves de API (configuracion-ux.md 7.1 y 9.4): `{ <proveedor>: { guardada, final } }` de
   * `claves_estado`, o null hasta leerlas. Solo el final de 4: la clave nunca vuelve a la ventana.
   */
  claves: null,
  /** La clave recién guardada: su fila se baña de verde una vez (8). */
  claveRecien: null,
  /**
   * El historial del chat de la pestaña Datos (7.4, entrega 5): `resumen` `{ charlas, bytes }` de
   * `chat_contar` (null hasta leerlo), si corre "Borrar todo" y cuántas no se pudieron borrar.
   */
  historialChat: { resumen: null, borrando: false, fallidas: 0 },
  /** Acoplada, el panel quedó fijado mientras se escribe una clave (4.1) y vuelve a su marca al terminar. */
  cfgRet: { retuvo: false, fijaAntes: false, fijaTocada: false },
  /**
   * Las listas de tareas y su hoja (#39, tareas-ux.md 3.5): abierta, la vista, lo leído de
   * `tareas_leer` (`listas`, `rotas`), el borrado armado, la lista que se renombra o se crea, "Hechas"
   * y los errores de 7.4 y 7.6. Los borradores viven en su `<input>`, nunca acá.
   */
  tareas: tareasInicial(),
  /** Partes de la hoja de Tareas ya dibujadas (y la fila de la barra), para no redibujar lo que no cambió. */
  tarFirmas: {},
  /**
   * Los hábitos y su hoja (#41, habitos-ux.md 3.5): abierta (la sigue `st.modulo`), la vista y a cuál
   * vuelve «‹», lo leído de `habitos_leer` (`lista`, `rotas`), el borrado armado, el borrador del
   * hábito nuevo y su error, y los errores de 7.4 y 5.2. Los textos que se escriben viven en su campo.
   */
  habitos: habitosInicial(),
  /** Partes de la hoja de Hábitos ya dibujadas (y la fila del menú). */
  habFirmas: {},
  /**
   * El aviso diario de tareas (tareas-ux.md 8 y 11.4): `avisoTar` (`evaluarAviso`, una vez por
   * ejecución) y `avisadoTar` (`tareas.avisado` de preferencias.json, leído al arrancar).
   */
  avisoTar: AVISO_INICIAL,
  avisadoTar: null,
  /**
   * Los globos (habitos-ux.md 8.1 y 8.2): la cola (`globos.js`; un globo por vez, pregunta ›
   * recordatorio › tareas › resumen), dónde se ve ahora el de arriba (`lugarGlobo`: marca, dividida,
   * muesca o null), cuál (`claveGlobo`), lo dibujado (`firmaGlobo`), el rectángulo del globo de la muesca
   * en px de pantalla, para la zona interactiva (`rectGloboMuesca`), los recordatorios ya anunciados
   * (`anunciados`) y el que confirma «Hecho» durante 1,8 s (`confirmaGlobo`: `{ clave, id }`).
   */
  globos: [],
  lugarGlobo: null,
  claveGlobo: null,
  firmaGlobo: null,
  rectGloboMuesca: null,
  anunciados: new Set(),
  confirmaGlobo: null,
  /** Los hábitos ya recordados hoy (`habitosRecordados` de preferencias.json, habitos-ux.md 8.3): `{ dia, ids }` o null. */
  habRecordados: null,
  mini: false,
  /** La ventana está escondida en la bandeja o minimizada: los Avis se pausan (6.5). */
  fuera: false,
  /** Ya entró escalonado el tablero desde que se mostró la ventana (6.1). */
  revelado: false,
  /**
   * La mascota elegida para Claude (docs/diseno/mascotas-avi-ux.md 9.1): `mascota` de preferencias.json,
   * leída al arrancar. Cambia en la pestaña Mascota de la configuración y con `oficina://mascota`
   * (configuracion-ux.md 9.3): toda la ventana se redibuja con la especie nueva, sin acto.
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
  /** El paso aplicado: `tamano`, o menos si con él el panel no entra en el área (`pasoQueEntra`). */
  paso: PASO_POR_DEFECTO,
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
  // Lo mismo con "Qué hizo" (#25): una sesión cerrada se va con su detalle
  if (st.historial && !preparadas.some(({ s }) => s.sesion === st.historial.sesion)) cerrarHistorial()
  const html = sesiones(preparadas, ahora, rastros, st.detalleSub, st.control, st.mascota, st.formas, st.historial)
  const firma = firmaEscenas(proyecto.repo, preparadas, rastros, st.detalleSub, st.historial, st.control)
  const ids = idsDeEscena(proyecto.repo, preparadas)
  const foco = focoEnBarra()
  // El foco en un "Qué hizo" vuelve a su botón si la tarjeta se redibuja (al terminar de leer)
  const focoHizo = document.activeElement?.matches?.('#sesiones .ses-hizo') ? document.activeElement.dataset.sesion : null
  // Mientras el IME compone una palabra en una barra no se redibuja: se cortaría la composición
  if (foco && st.componiendo) return
  if (st.firmas['#sesiones'] === firma && html !== st.htmlEscenas && !actualizarTiempos(raiz, html)) st.firmas['#sesiones'] = null
  if (poner('#sesiones', html, firma)) {
    marcarNuevos(raiz, novedades(st.idsEscena, ids))
    vigilarEscenas($('.principal'))
    // La barra se redibujó con el borrador guardado: el foco y el cursor vuelven a donde estaban
    devolverFoco(foco)
    if (focoHizo) botonHistorial(focoHizo)?.focus({ preventScroll: true })
    marcarDesbordes()
  }
  st.htmlEscenas = html
  st.idsEscena = ids
  refrescarBarras(ahora)
}

/**
 * "Qué hizo" con más turnos de los que entran (D-f): la lista se funde abajo mientras queda algo
 * por ver; al llegar al final, el último turno se ve entero.
 */
function marcarDesborde(lista) {
  lista.classList.toggle('desborda', lista.scrollHeight - lista.clientHeight - lista.scrollTop > 1)
}
function marcarDesbordes() {
  for (const lista of document.querySelectorAll('#sesiones .hist-turnos')) marcarDesborde(lista)
}
// El scroll no burbujea: se escucha en la captura
document.addEventListener('scroll', e => { if (e.target.matches?.('#sesiones .hist-turnos')) marcarDesborde(e.target) }, true)

/**
 * Las sesiones cerradas desde el widget que ya no vienen en la lectura (B1): sus tarjetas salen
 * (240 ms, escenaMotion.js) antes del redibujo. Si el foco estaba adentro, se calcula a dónde va.
 * Devuelve lo que hay que hacer después de pintar, o null.
 */
async function despedirCerradas(nuevas) {
  const quedan = new Set(nuevas.map(s => s.sesion))
  const cerradas = st.sesiones.filter(s => cerrandoSesion(st.control[s.sesion]) && !quedan.has(s.sesion))
  if (!cerradas.length) return null
  const ids = new Set(cerradas.map(s => s.sesion))
  const tarjetas = [...document.querySelectorAll('#sesiones > .ses')]
  const orden = tarjetas.map(t => t.querySelector('.ses-hizo')?.dataset.sesion)
  const saliendo = tarjetas.filter((t, k) => ids.has(orden[k]))
  const activo = document.activeElement
  const focoAdentro = saliendo.some(t => t.contains(activo))
  await salirTarjetas(saliendo)
  for (const id of ids) delete st.control[id]
  return { anuncio: anuncioCierre(cerradas), focoAdentro, destino: focoAdentro ? destinoFocoCierre(orden, ids, quedan) : null }
}

/**
 * Después del redibujo (B1): el aviso en la región viva, que no se va con la tarjeta, y el foco que
 * estaba en ella al "Qué hizo" de la siguiente o la anterior; si el proyecto se quedó sin sesiones,
 * al proyecto activo de la barra lateral. El foco solo se mueve si se iba con la tarjeta.
 */
function trasCierre(c) {
  anunciar(c.anuncio)
  if (!c.focoAdentro) return
  const destino = (c.destino && botonHistorial(c.destino)) || $('#repos [aria-current]')
  destino?.focus({ preventScroll: true })
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
  const campo = barra.querySelector('[data-rol="in"]')
  // Cerrándose el campo está apagado: el foco queda en "Cerrando…" (B2)
  const refugio = campo.disabled ? barra.querySelector('[data-rol="cerrar"]') : campo
  const destino = !el || el.hidden || el.disabled ? refugio : el
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
  // Cerrándose (B2), el campo queda apagado hasta que la tarjeta se va
  campo.disabled = v.cerrando
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
  // Cerrar (#25): lo mismo que Frenar, con su propia confirmación
  const ce = barra.querySelector('[data-rol="cerrar"]')
  ce.hidden = !v.cerrar.visible
  // Cerrándose no se deshabilita (conserva el foco): aria-disabled y el clic se ignora (B2)
  ce.disabled = v.cerrar.deshabilitado
  if (v.cerrar.cerrando) ce.setAttribute('aria-disabled', 'true')
  else ce.removeAttribute('aria-disabled')
  if (v.cerrar.confirma && !ce.classList.contains('confirma')) ce.style.removeProperty('--ya')
  ce.classList.toggle('confirma', v.cerrar.confirma)
  if (ce.textContent !== v.cerrar.etiqueta) ce.textContent = v.cerrar.etiqueta
  if (ce.getAttribute('aria-label') !== v.cerrar.nombre) ce.setAttribute('aria-label', v.cerrar.nombre)
  cola.hidden = !v.cola
  if (cola.textContent !== (v.cola ?? '')) cola.textContent = v.cola ?? ''
  const texto = v.linea?.texto ?? ''
  if (res.textContent !== texto) {
    res.textContent = texto
    res.dataset.tono = v.linea?.tono ?? ''
    if (texto) reanimar(res)
  }
  // Cerrándose el campo está apagado: el foco va a "Cerrando…", que no se deshabilita (B2)
  if ((enfocado === env || enfocado === fr || enfocado === ce) && (enfocado.disabled || enfocado.hidden)) (campo.disabled ? ce : campo).focus({ preventScroll: true })
}

function refrescarBarras(ahora = Date.now()) {
  for (const barra of document.querySelectorAll('#sesiones .ctl')) refrescarBarra(barra, ahora)
}

/** Un clic en Frenar: el primero pide confirmar por 3 s (vuelve solo); el segundo frena. */
function tocarFrenar(sesion) {
  const ui = ctl(sesion)
  if (ui.pendiente || cerrandoSesion(ui)) return
  const ahora = Date.now()
  const r = clicFrenar(ui, ahora)
  ui.confirmaHasta = r.confirmaHasta
  // Una confirmación por vez: tocar Frenar deja de pedir la de Cerrar
  ui.cierraHasta = null
  clearTimeout(ui.reloj)
  if (r.frenar) { ordenar(sesion, 'frenar'); return }
  refrescarBarras(ahora)
  ui.reloj = setTimeout(() => refrescarBarras(), MS_CONFIRMAR_FRENAR + 20)
}

/**
 * Un clic en "Cerrar sesión" (#25): el primero pide confirmar por 3 s (vuelve solo); el segundo deja
 * la orden `cerrar` y la sesión sale como con /exit. Nunca cierra por tiempo.
 */
function tocarCerrar(sesion) {
  const ui = ctl(sesion)
  // Ya se está cerrando: el botón dice "Cerrando…" con aria-disabled y el clic se ignora (B2)
  if (ui.pendiente || cerrandoSesion(ui)) return
  const ahora = Date.now()
  const r = clicCerrar(ui, ahora)
  ui.cierraHasta = r.cierraHasta
  ui.confirmaHasta = null
  clearTimeout(ui.reloj)
  if (r.cerrar) { ordenar(sesion, 'cerrar'); return }
  refrescarBarras(ahora)
  ui.reloj = setTimeout(() => refrescarBarras(), MS_CONFIRMAR_CERRAR + 20)
}

// ------------------------------------------------------------------ "Qué hizo" (#25)
// Lo último de la conversación de una sesión, leído en solo lectura de su transcripción
// (historial.rs); historial.js lo agrupa en turnos. Uno abierto por vez; Esc lo pliega.

const botonHistorial = sesion => document.querySelector(`#sesiones .ses-hizo[data-sesion="${CSS.escape(sesion)}"]`)

function cerrarHistorial() {
  clearTimeout(st.relojHistorial)
  st.historial = null
}

/** Lee la transcripción de la sesión abierta; si mientras tanto se cerró u otra se abrió, no hace nada. */
async function leerHistorial(sesion) {
  clearTimeout(st.relojHistorial)
  let nuevo
  try {
    const r = await invocar('leer_historial', { sesion })
    nuevo = { sesion, estado: 'listo', entradas: r?.entradas ?? [] }
  } catch (e) {
    registrar(`qué hizo ${sesion}: no se pudo leer (${e})`)
    nuevo = { sesion, estado: 'error', error: String(e) }
  }
  if (st.historial?.sesion !== sesion) return
  const primera = st.historial.estado === 'cargando'
  st.historial = nuevo
  pintar()
  // La primera lectura reemplaza al "Leyendo…": entran solo los turnos, el detalle no se repite (D-e)
  const det = primera && document.querySelector('.det-hist')
  if (det) {
    det.classList.add('turnos-llegan')
    setTimeout(() => det.classList.remove('turnos-llegan'), 900)
    // El detalle creció con los turnos: la barra vuelve a la vista si quedó abajo (M1)
    det.closest('.ses')?.querySelector('.ctl')?.scrollIntoView({ block: 'nearest' })
  }
  st.relojHistorial = setTimeout(() => { if (st.historial?.sesion === sesion) leerHistorial(sesion) }, MS_RELEER_HISTORIAL)
}

/** Abre "Qué hizo" de una sesión (pliega el que hubiera) o lo pliega si ya estaba abierto. */
function alternarHistorial(sesion) {
  const abrir = st.historial?.sesion !== sesion
  cerrarHistorial()
  if (abrir) st.historial = { sesion, estado: 'cargando' }
  pintar()
  botonHistorial(sesion)?.focus({ preventScroll: true })
  if (!abrir) return
  const det = document.querySelector('.det-hist')
  if (det) {
    // La entrada corre solo al abrir, como el detalle de un subagente
    det.classList.add('entra')
    setTimeout(() => det.classList.remove('entra'), 900)
    // Se lleva a la vista la barra (va debajo del detalle): así se ven los dos y "Cerrar sesión" (M1)
    const barra = det.closest('.ses')?.querySelector('.ctl') ?? det
    barra.scrollIntoView({ block: 'nearest' })
  }
  if (tauri?.core) leerHistorial(sesion)
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
  if (ui.pendiente || ui.cerrando || !tauri?.core) return
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
    // La sesión sale: la tarjeta queda "cerrando" hasta irse (B2); la línea de la tarjeta se redibuja
    if (tipo === 'cerrar' && resultado === 'cerrando') {
      ui.cerrando = true
      ui.cerrandoDesde = Date.now()
      pintar()
      // Tope (#25): si a los 30 s la tarjeta sigue, la sesión no salió; Cerrar vuelve a funcionar
      setTimeout(() => {
        const cambio = vencerCierre(st.control[sesion], Date.now())
        if (!cambio) return
        registrar(`orden cerrar ${id} a ${sesion} -> no se cerró en ${MS_TOPE_CERRANDO / 1000} s`)
        Object.assign(st.control[sesion], cambio)
        pintar()
      }, MS_TOPE_CERRANDO + 20)
      return
    }
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
  // Espacios duros: si no entra, "cada 1,5 s" baja entero a la línea siguiente
  pie.textContent = `actualizado ${hora} · cada 1,5 s`
}

/**
 * Tira mini: caras, resumen y cuenta de preguntas, que nunca se esconde; después, las cuentas chicas de
 * los módulos que entran sin dejar el resumen por debajo de 120 (modulos-ux.md 8, M2).
 */
function pintarTira(ahora) {
  const r = resumenMini(st.proyectos, ahora, st.mascota)
  poner('#tira-caras', carasMini(r.caras, st.mascota, st.formas), r.caras.map(c => `${c.nombre}:${c.animo}:${c.variante ?? ''}`).join(','))
  poner('#tira-resumen', `<b>${escapar(r.titulo)}</b><span class="dim">${escapar(r.detalle)}</span>`)
  poner('#tira-pend', insignia(r.pendientes))
  // Escondida no se mide: queda lo último (al mostrarse, el ciclo siguiente decide con la medida real)
  const libre = anchoLibreTira()
  if (libre == null) return
  const tareas = st.tareas.leido ? cuentas(st.tareas.listas, hoyTareas()) : null
  const habitos = st.habitos.leido ? cuentasHoy(st.habitos.lista, hoyHabitos()) : null
  poner('#tira-mods', cuentasMiniHtml(tareas, habitos, cuentasModulosMini(tareas, habitos, libre)))
}

/**
 * Lo que tendría `#tira-resumen` sin las cuentas de los módulos: el ancho de su caja (la que estira) menos
 * las caras y su separación, más lo que hoy ocupan las cuentas. null si la tira no se ve.
 */
function anchoLibreTira() {
  const arrastre = $('#tira .arrastre')
  if (!arrastre?.clientWidth) return null
  const mods = $('#tira-mods')
  const estilo = getComputedStyle(arrastre)
  const separacion = parseFloat(getComputedStyle($('#tira')).columnGap) || 0
  const conMods = mods.offsetWidth ? mods.offsetWidth + separacion : 0
  return arrastre.clientWidth - (parseFloat(estilo.paddingLeft) || 0) - $('#tira-caras').offsetWidth - (parseFloat(estilo.columnGap) || 0) + conMods
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
  // El globo de arriba de la cola (recordatorio, aviso de tareas) va donde esté la mascota a la vista (habitos-ux.md 8.1)
  pintarGlobos()
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
    // La vista previa de la configuración no es de ninguna clave: su forma la elige "Base · {evo}"
    if (svg.closest('#cfg')) continue
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
  // La fila "Tareas" de la barra, con su cuenta (tareas-ux.md 4.1), siempre
  pintarFilaTareas()
  // La fila «Hábitos» del menú, con lo de hoy (habitos-ux.md 4.1), siempre
  pintarFilaHabitos()
  // El menú de módulos (modulos-ux.md 4, #42): la fila abierta, las cuentas, la píldora y la pregunta
  // vista desde otro módulo (`#aviso-p`). `st.modulo` decide; `config.abierta` y `tareas.abierta` lo siguen
  pintarModulos(ahora, totalPend)
  // La configuración (configuracion-ux.md 4.2): la hoja de la columna principal, también sin sesiones
  $('#marco').classList.toggle('con-cfg', st.config.abierta)
  if (st.config.abierta) { pintarHojaConfiguracion(); return }
  pintarConfiguracion()
  // Tareas (tareas-ux.md 3.2): la otra hoja de la columna; una por vez (`irModulo` cierra la otra)
  $('#marco').classList.toggle('con-tar', st.tareas.abierta)
  if (st.tareas.abierta) { pintarHojaTareas(); return }
  pintarTareas()
  // Hábitos (habitos-ux.md 3.2): la hoja hermana de #tar y #cfg; una por vez (`irModulo` cierra la otra)
  $('#marco').classList.toggle('con-hab', st.habitos.abierta)
  if (st.habitos.abierta) { pintarHojaHabitos(); return }
  pintarHabitos()

  if (!st.proyectos.length && forma === 'escenario') {
    // Sin tablero y con algo pendiente: el escenario de primeros pasos en lugar del vacío (3.2)
    modoMarco('escenario')
    texto('#titulo', 'Primeros pasos')
    texto('#subtitulo', '')
    poner('#repos', ''); poner('#otro', ''); poner('#w-globo', ''); poner('#conteos', ''); poner('#sesiones', ''); st.idsEscena = null
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
    poner('#repos', ''); poner('#otro', ''); poner('#w-globo', ''); poner('#conteos', ''); poner('#sesiones', ''); st.idsEscena = null
    return
  }
  modoMarco('tablero')
  const hoja = forma === 'hoja'
  $('#marco').classList.toggle('con-hoja', hoja)

  let i = st.proyectos.findIndex(p => p.repo === st.repo)
  if (i < 0) { i = 0; st.repo = st.proyectos[0].repo }
  const proyecto = st.proyectos[i]
  // La tira de repos arriba de las sesiones (modulos-ux.md 4.4, M2)
  const enfocado = document.activeElement?.closest?.('#repos [data-proy]')
  if (poner('#repos', tiraRepos(st.proyectos, i)) && enfocado) {
    // El redibujo no se lleva el foco: queda en el proyecto que lo tenía (9.4)
    $(`#repos [data-proy="${enfocado.dataset.proy}"]`)?.focus()
  }
  // El aviso de primeros pasos va debajo del de pregunta; con la hoja abierta no hace falta (3.5)
  // En la dividida el aviso es de una pregunta en cualquier proyecto, también los dos que conversan (5.3)
  const enDividida = !!st.dividida.clave
  // La firma no lleva la forma de Claude: cambia en su lugar (6.7)
  const htmlOtro = avisoOtroProyecto(st.proyectos, enDividida ? -1 : i, st.mascota, st.formas) + (hoja || enDividida ? '' : avisoAsistente(pp, st.mascota) + avisoMod(st.pp.avisoMod, st.mascota))
  poner('#otro', htmlOtro, htmlOtro.replace(/ evol(?=[ "])/g, ''))

  const preparadas = prepararProyecto(proyecto, ahora, st.mascota)
  const c = conteos(preparadas, ahora)
  // El h1 es el del módulo, «Sesiones»; el proyecto va en la bajada (modulos-ux.md 5 y 11.1, M2)
  const cab = encabezadoSesiones(proyecto, preparadas, c)
  texto('#titulo', cab.titulo)
  $('#titulo').title = cab.title
  texto('#subtitulo', cab.subtitulo)
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
  verRepoElegido()
  cambioProyecto(direccion)
  entradaEscenas(document.querySelectorAll('#sesiones > .ses'))
}

/** Lo que tapa la máscara a la derecha de la tira de repos (el 12 % del ancho, `estilos.css`). */
const MASCARA_REPOS = 0.12

/**
 * El chip elegido de la tira de repos queda a la vista (modulos-ux.md 4.4): corre solo la tira, en
 * horizontal (`scrollIntoView` correría también la columna y el marco).
 */
function verRepoElegido() {
  const tira = $('#repos')
  const chip = tira?.querySelector('[aria-current]')
  if (!chip || !tira.clientWidth) return
  const x = desplazarTira({ izq: chip.offsetLeft, ancho: chip.offsetWidth }, { scroll: tira.scrollLeft, visible: tira.clientWidth }, tira.clientWidth * MASCARA_REPOS)
  if (x !== tira.scrollLeft) tira.scrollLeft = x
}

// ------------------------------------------------------------------ módulos (#42, docs/diseno/modulos-ux.md)

/** Las filas del menú, por módulo (Configuración está aparte, en `.lado-cfg`). */
const FILAS_MODULO = { sesiones: '#mod-sesiones', tareas: '#tar-fila', habitos: '#hab-fila', config: '#cfg-fila' }

/**
 * La única entrada a un módulo (3.2 y 11.3): las filas del menú, Ctrl T, Ctrl ,, Esc, la bandeja, el globo
 * de Tareas, `#aviso-p`, la tira, la muesca, primeros pasos y las fichas «Conversan» pasan por acá, y
 * solo acá cambia `st.modulo`. Cierra la hoja que se deja y abre la nueva con sus actos de siempre
 * (`abrirConfig`, `abrirTareasHoja`, `abrirHabitosHoja` y sus `cerrar…`); abrir una hoja sale antes de la
 * dividida y de la tira, así `st.modulo` y la hoja abierta cambian juntos. El mismo módulo solo cambia la
 * pestaña o el proyecto pedidos y lleva el foco al título (9.2).
 * Opciones: `repo` (Sesiones en ese proyecto), `tab` (la pestaña de Configuración), `ver` (la vista de
 * Tareas o de Hábitos) y `foco`: 'h1' (por defecto: el título del módulo, 9.4), 'fila' (la fila de Sesiones: volver
 * con Esc) o false (lo pone quien llama). Devuelve si el id existía.
 */
async function irModulo(id, { repo, tab, ver, foco = 'h1' } = {}) {
  const plan = planModulo({ modulo: st.modulo }, id, { repo })
  if (!plan) return false
  if (plan.foco) {
    if (id === 'config' && tab && tab !== st.config.tab) cambiarPestanaConfig(tab)
    if (plan.repo && plan.repo !== st.repo) irAProyecto(plan.repo, 1)
    if (foco === 'h1') $('#titulo').focus()
    else if (foco === 'fila') $(FILAS_MODULO[id])?.focus()
    return true
  }
  // Abrir una hoja sale de la dividida y de la tira (lo de siempre de las hojas, 11.1)
  if (plan.abrir) {
    if (st.dividida.clave) await cerrarConversacion({ descartar: true })
    if (st.mini) await ponerMini(false)
  }
  const nav = $('#mods')
  const desde = movimientoModulos.posicionPildora(nav)
  st.modulo = plan.modulo
  // Entre dos hojas no hay acto de vuelta al tablero: la nueva trae el suyo
  for (const h of plan.cerrar) {
    if (h === 'config') cerrarConfig({ acto: !plan.abrir })
    else if (h === 'tareas') cerrarTareasHoja({ acto: !plan.abrir })
    else if (h === 'habitos') cerrarHabitosHoja({ acto: !plan.abrir })
  }
  const enfocarTitulo = foco === 'h1'
  if (plan.abrir === 'config') abrirConfig({ tab, foco: enfocarTitulo })
  else if (plan.abrir === 'tareas') abrirTareasHoja({ ver, foco: enfocarTitulo })
  else if (plan.abrir === 'habitos') abrirHabitosHoja({ ver, foco: enfocarTitulo })
  else if (plan.repo && plan.repo !== st.repo) irAProyecto(plan.repo, 1)
  else pintar()
  movimientoModulos.viajarPildora(nav, desde)
  // El nombre del módulo, una vez (5); el foco, al título o a la fila
  anunciar(MODULOS.find(m => m.id === plan.modulo)?.nombre)
  if (!plan.abrir && enfocarTitulo) $('#titulo').focus()
  else if (foco === 'fila') $(FILAS_MODULO[plan.modulo])?.focus()
  return true
}

/**
 * El menú (4.1 a 4.5) en cada redibujo: la clase `mod-<id>` del marco, la fila abierta, la cuenta y el
 * nombre de Sesiones y de Configuración (la de Tareas la pone `pintarFilaTareas`), la píldora y
 * `#aviso-p`. El chip «1 ?» late cuando suben las preguntas; `#aviso-p` baja al aparecer.
 */
function pintarModulos(ahora, totalPend) {
  const marco = $('#marco')
  for (const m of MODULOS) marco.classList.toggle(`mod-${m.id}`, st.modulo === m.id)
  for (const [id, sel] of Object.entries(FILAS_MODULO)) {
    const fila = $(sel)
    if (st.modulo === id) { if (fila.getAttribute('aria-current') !== 'page') fila.setAttribute('aria-current', 'page') }
    else if (fila.hasAttribute('aria-current')) fila.removeAttribute('aria-current')
  }
  // Sesiones: el número de sesiones (… antes de la primera lectura) y las preguntas
  const cargando = !st.actualizado && !st.error
  const datosSes = { sesiones: cargando ? null : st.proyectos.reduce((n, p) => n + p.sesiones.length, 0), preguntas: totalPend }
  poner('#mod-sesiones-ct', cuentaModulo('sesiones', datosSes))
  ponerNombre('#mod-sesiones', nombreModulo('sesiones', datosSes))
  if (st.preguntasMenu != null && totalPend > st.preguntasMenu) movimientoModulos.latirPregunta($('#mod-sesiones .chip-preg'))
  st.preguntasMenu = cargando ? null : totalPend
  // Configuración: el punto de pestaña si hay algo que mirar (4.2)
  const datosCfg = { punto: puntoConfiguracion() }
  poner('#cfg-fila-ct', cuentaModulo('config', datosCfg))
  ponerNombre('#cfg-fila', nombreModulo('config', datosCfg))
  movimientoModulos.colocarPildora($('#mods'))
  // La pregunta vista desde otro módulo (4.5); en Sesiones la de otro proyecto sigue en #otro (M1)
  const aviso = st.modulo === 'sesiones' ? null : avisoPregunta(st.proyectos, st.modulo, st.repo, st.mascota, ahora)
  const html = avisoPreguntaHtml(aviso, st.formas)
  const habia = !!$('#aviso-p').firstChild
  const enfocado = document.activeElement?.closest?.('#aviso-p') != null
  // La firma no lleva la forma de Claude: cambia en su lugar (6.7)
  if (poner('#aviso-p', html, html.replace(/ evol(?=[ "])/g, ''))) {
    if (html && !habia) movimientoModulos.llegaAviso($('#aviso-p > .aviso-p'))
    if (enfocado) $('#aviso-p > .aviso-p')?.focus()
  }
}

/** Pone el nombre accesible de una fila solo si cambió. */
function ponerNombre(sel, nombre) {
  const el = $(sel)
  if (el.getAttribute('aria-label') !== nombre) el.setAttribute('aria-label', nombre)
}

/**
 * El punto de la fila de Configuración (4.2): el de la primera pestaña que pide mirarla (una clave
 * rechazada, el modelo bajando, el mod que necesita atención), o null. Lo leído hasta ahora: el mod sale
 * de primeros pasos hasta abrir la configuración.
 */
function puntoConfiguracion() {
  try {
    const datos = datosConfiguracion()
    const puntos = { modelo: datos.modelo.estado, mod: datos.mod.estado, claves: datos.claves }
    return IDS_PESTANAS.map(t => puntoPestana(puntos, t)).find(Boolean) ?? null
  } catch (e) {
    registrar(`módulos: punto de configuración: ${e}`)
    return null
  }
}

/**
 * Al expandir la tira o abrir la muesca (8): el módulo actual o, con una pregunta pendiente, Sesiones
 * en su proyecto. No toca el foco (lo pone quien abre el panel).
 */
async function abrirPanelAlModulo() {
  const preguntas = st.proyectos.filter(p => preguntasPendientes(p).length)
  const destino = moduloAlExpandir({ modulo: st.modulo, repo: st.repo, preguntas })
  await irModulo(destino.modulo, { repo: destino.repo ?? undefined, foco: false })
}

/** «Expandir» de la tira (8): el tablero vuelve en el módulo actual o, con una pregunta, en Sesiones en esa pregunta. */
async function expandir() {
  if (!st.mini) return
  await ponerMini(false)
  if (!st.mini) await abrirPanelAlModulo()
}

/**
 * `#aviso-p` (4.5): Sesiones en el proyecto de la pregunta, la pregunta desplegada (también si estaba
 * la hoja de primeros pasos) y el foco en el primer control de su globo.
 */
async function responderDesdeAviso(proy) {
  const p = st.proyectos[proy] ?? st.proyectos.find(x => preguntasPendientes(x).length)
  st.plegado = false
  st.pp.abierto = false
  st.firmas.clavesGlobo = null
  await irModulo('sesiones', { repo: p?.repo, foco: false })
  pintar()
  ;($('#w-globo button') ?? $('#otro .aviso') ?? $('#mod-sesiones'))?.focus()
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
  let cierre = null
  try {
    const sesiones = await invocar('leer_sesiones')
    const nuevas = Array.isArray(sesiones) ? sesiones : []
    // Las tarjetas que se cerraron desde el widget salen antes del redibujo (B1)
    cierre = await despedirCerradas(nuevas)
    st.sesiones = nuevas
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
  if (cierre) trasCierre(cierre)
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
    // La dividida es de Sesiones (modulos-ux.md 7): en otro módulo una conversación nueva solo late su ficha
    nueva: true, panelVisible: panelSeVe(), proyectoVisto: st.modulo === 'sesiones' ? st.repo : null, divididaAbierta: !!st.dividida.clave,
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
      if (focoAdentro) $('#repos [aria-current]')?.focus()
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
  // Los recordatorios de los hábitos se revisan acá, nunca con un temporizador por hábito (habitos-ux.md 8.3)
  revisarRecordatorios()
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
  pintarConfiguracion()
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
  pintarConfiguracion()
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
  if (a.startsWith('cfg-')) {
    // La configuración: un control en su punta (aria-disabled, 7) ignora el clic
    if (b.getAttribute('aria-disabled') !== 'true') await accionConfiguracion(a, b)
    return
  }
  if (a.startsWith('tar-')) {
    // Tareas (tareas-ux.md): cada botón hace solo lo suyo, y solo con el clic
    await accionTareas(a, b)
    return
  }
  if (a.startsWith('hab-')) {
    // Hábitos (habitos-ux.md): cada botón hace solo lo suyo, y solo con el clic
    await accionHabitos(a, b)
    return
  }
  if (a === 'mod') {
    // Una fila del menú de módulos (modulos-ux.md 4.1): su módulo, con el foco en su título
    await irModulo(b.dataset.mod)
    return
  }
  if (a === 'aviso-p') {
    // La pregunta vista desde otro módulo (4.5): Sesiones en su proyecto, desplegada, con el foco en su globo
    await responderDesdeAviso(+b.dataset.proy)
    return
  }
  if (a === 'conv') {
    // Una ficha "Conversan" de la barra o del riel abre la dividida en esa conversación (3.4); antes, Sesiones (11.1)
    await irModulo('sesiones', { foco: false })
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
  if (a === 'ctl-cerrar') { if (!b.disabled) tocarCerrar(b.dataset.sesion); return }
  // "Qué hizo" (#25): despliega lo último de la conversación debajo de la cabecera; otro clic lo pliega
  if (a === 'historial') { alternarHistorial(b.dataset.sesion); return }
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
    // Elegir un proyecto lleva a Sesiones en ese proyecto (modulos-ux.md 3.2 y 11.1): una sola rama para
    // Tareas y Configuración. El foco se queda en el proyecto
    if (p && st.modulo !== 'sesiones') {
      await irModulo('sesiones', { repo: p.repo, foco: false })
      $(`#repos [data-proy="${b.dataset.proy}"]`)?.focus()
      return
    }
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
    // "Siempre arriba" del encabezado: el mismo ajuste que el interruptor de la configuración (se guarda)
    if (!(await guardarAjusteConfig('arriba', !st.arriba))) { st.error = 'No se pudo fijar la ventana'; pintarPie() }
  } else if (a === 'mini') {
    await ponerMini(true)
  } else if (a === 'expandir') {
    await expandir()
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
// Al escribir de nuevo en el campo de la clave, su error o su aviso se van (el texto queda, 7.1)
document.addEventListener('input', e => {
  if (e.target.id !== 'cfg-clave-in' || !st.config.errorClave) return
  st.config = { ...st.config, errorClave: null }
  pintarConfiguracion()
})
// Al escribir de nuevo en el campo de una lista, el error de nombre repetido se va (el texto queda)
document.addEventListener('input', e => {
  if (!st.tareas.errorLista || !e.target.matches?.('#tar input[data-campo="lista"], #tar input[data-campo="ren"]')) return
  st.tareas = { ...st.tareas, errorLista: null }
  pintarTareas()
})
// El título y las notas de la tarea abierta: a `st` en cada tecla y se guardan 600 ms después (tareas-ux.md 11.3)
document.addEventListener('input', e => {
  if (e.target.matches?.('#tar textarea[data-campo="titulo"], #tar textarea[data-campo="notas"]')) escribirDetalleTareas(e.target)
})
// Al salir del título o las notas se guarda lo pendiente ya; al salir del texto de una subtarea, se
// confirma (salvo que el redibujo lo haya vuelto a enfocar: es el mismo campo)
document.addEventListener('focusout', e => {
  const campo = e.target
  if (campo.matches?.('#tar textarea[data-campo="titulo"], #tar textarea[data-campo="notas"]')) { salirCampoDetalle(campo); return }
  if (campo.matches?.('#tar input[data-campo="sub-ed"]')) {
    const { valor, k } = campo.dataset
    const texto = campo.value
    setTimeout(() => {
      if (document.activeElement?.dataset?.k !== k) confirmarSubEnHoja(valor, texto, { foco: false })
    }, 0)
  }
})
// La fecha del selector nativo y la lista (4.7): se guardan al elegir
document.addEventListener('change', e => {
  const c = e.target.closest?.('#tar [data-cambio]')
  if (!c) return
  if (c.dataset.cambio === 'tar-fecha-in') cambiarDetalleTareas({ fecha: c.value || null })
  else if (c.dataset.cambio === 'tar-lista') moverEnHoja(c.value)
})
// Hábitos (habitos-ux.md 4.11): lo que se escribe en el nombre o la unidad vive en su campo; la frase
// lo sigue al instante. El del hábito nuevo queda también en su borrador (sobrevive al cambiar el tipo)
document.addEventListener('input', e => {
  const c = e.target
  if (!c.matches?.('#hab [data-campo="nombre"], #hab [data-campo="unidad"]')) return
  const form = c.closest('[data-form]')
  if (form?.dataset.form === 'nuevo' && st.habitos.borrador) {
    st.habitos = { ...st.habitos, borrador: { ...st.habitos.borrador, [c.dataset.campo]: c.value } }
    // El error del formulario se va al escribir de nuevo (el texto queda)
    if (st.habitos.errForm) { st.habitos = { ...st.habitos, errForm: null }; pintarHabitos() }
  }
  refrescarFrase(form)
})
// El nombre y la unidad de un hábito que ya existe se guardan al salir del campo (3.5), salvo que el
// redibujo lo haya vuelto a enfocar (es el mismo campo). Después del clic que sacó el foco, así ese clic
// llega a su botón
document.addEventListener('focusout', e => {
  const c = e.target
  if (!c.matches?.('#hab .det [data-campo="nombre"], #hab .det [data-campo="unidad"]')) return
  const k = c.dataset.k
  setTimeout(() => { if (document.activeElement?.dataset?.k !== k) confirmarTextoHabito(c) }, 0)
})
// La hora del aviso (4.11): se guarda al elegirla; vacía, vuelve la de antes
document.addEventListener('change', e => {
  const c = e.target.closest?.('#hab [data-cambio="hab-hora"]')
  if (!c) return
  if (/^\d{2}:\d{2}$/.test(c.value)) editarFormulario('aviso', c.value)
  else c.value = formularioActual()?.h.aviso ?? ''
})
document.addEventListener('compositionstart', e => { if (e.target.matches?.('.ctl-in')) st.componiendo = true })
document.addEventListener('compositionend', () => { st.componiendo = false })

document.addEventListener('keydown', e => {
  // Las teclas de la hoja de la charla (chat-avis-ux.md 3.5): van antes que el Esc de la pregunta y el de la muesca
  if (teclaChat(e)) return
  // Esc con el foco en el globo de un recordatorio: es su × («Ahora no», habitos-ux.md 9.1)
  const globoHabEl = e.key === 'Escape' && e.target.closest?.('[data-globo-hab]')
  if (globoHabEl) {
    e.preventDefault()
    descartarRecordatorio(globoHabEl.dataset.valor)
    return
  }
  // Esc con el foco en el globo del aviso diario y la hoja de Tareas cerrada: es la × (tareas-ux.md 9.1)
  if (e.key === 'Escape' && e.target.closest?.('[data-globo-tar]') && alEscTareas(st.tareas, { globo: true }).accion === 'globo-x') {
    e.preventDefault()
    descartarAvisoTareas()
    return
  }
  // Ctrl , con el panel a la vista abre Configuración (modulos-ux.md 9.2); abierta, el foco va al título
  if (esAtajoConfiguracion(e)) {
    e.preventDefault()
    if (!st.mini && (!st.acople || st.vista)) irModulo('config')
    return
  }
  // Esc con la configuración abierta, una capa por vez (4.1 y modulos-ux.md 9.1): la clave que se escribe,
  // el "¿Borrar? Sí" y, sin capas, Sesiones con el foco en su fila. En Sesiones, el Esc de siempre
  if (e.key === 'Escape' && st.config.abierta) {
    e.preventDefault()
    const proveedor = st.config.editando
    const { config, accion } = alEsc(st.config)
    if (alEscModulo('config', accion) === 'sesiones') irModulo('sesiones', { foco: 'fila' })
    else {
      st.config = config
      pintarConfiguracion()
      // La clave cancelada: el texto se fue con el campo y el foco vuelve a "+ Agregar clave" o "Reemplazar"
      if (accion === 'cancelar-clave') enfocarClave(proveedor, 'r')
    }
    return
  }
  // Ctrl T con el panel a la vista abre Tareas (tareas-ux.md 9.2, modulos-ux.md 9.2), también mientras se
  // escribe en uno de sus campos; abierta, el foco va al título
  if (esAtajoTareas(e)) {
    e.preventDefault()
    if (!st.mini && (!st.acople || st.vista)) irModulo('tareas')
    return
  }
  // Esc con la hoja de Tareas abierta, una capa por vez (9.1)
  if (e.key === 'Escape' && st.tareas.abierta) {
    e.preventDefault()
    escTareas(e.target)
    return
  }
  // Ctrl H con el panel a la vista abre Hábitos (habitos-ux.md 9.2), también mientras se escribe en un
  // campo; abierta, el foco va al título. Falta medirlo en WebView2 (11.9): si Edge se lo queda, Ctrl Shift H
  if (esAtajoHabitos(e)) {
    e.preventDefault()
    if (!st.mini && (!st.acople || st.vista)) irModulo('habitos')
    return
  }
  // Esc con la hoja de Hábitos abierta, una capa por vez (9.1)
  if (e.key === 'Escape' && st.habitos.abierta) {
    e.preventDefault()
    escHabitos(e.target)
    return
  }
  // Enter en el nombre del hábito nuevo lo crea (4.11); en el nombre o la unidad de uno que ya existe, los
  // guarda y el foco queda (4.10)
  if (e.key === 'Enter' && !e.isComposing && e.target.matches?.('#hab [data-campo="nombre"], #hab [data-campo="unidad"]')) {
    e.preventDefault()
    if (e.target.closest('[data-form]')?.dataset.form !== 'nuevo') confirmarTextoHabito(e.target)
    else if (e.target.dataset.campo === 'nombre') crearHabitoEnHoja()
    return
  }
  // Tipo y Color (4.11): un solo tope, foco itinerante con las flechas (9.3)
  if (st.habitos.abierta && teclaRadios(e, '#hab')) return
  // Enter en el título de la tarea abierta no hace salto de línea: confirma (4.7) y el foco queda
  if (e.key === 'Enter' && e.target.matches?.('#tar textarea[data-campo="titulo"]')) {
    e.preventDefault()
    if (!e.isComposing) salirCampoDetalle(e.target)
    return
  }
  // Enter en un campo de la hoja de Tareas: agrega la tarea, crea o renombra la lista (4.4, 5.1), agrega
  // una subtarea o confirma el texto de una (4.7)
  if (e.key === 'Enter' && !e.isComposing && e.target.matches?.('#tar input[data-campo]')) {
    e.preventDefault()
    const campo = e.target.dataset.campo
    if (campo === 'nueva') agregarEnHoja(e.target)
    else if (campo === 'lista') crearListaEnHoja(e.target.value)
    else if (campo === 'ren') renombrarEnHoja(e.target.value)
    else if (campo === 'subtarea') agregarSubEnHoja(e.target)
    else if (campo === 'sub-ed') confirmarSubEnHoja(e.target.dataset.valor, e.target.value)
    return
  }
  // Vence y Prioridad (4.7): un solo tope, foco itinerante con las flechas (9.3), como en la configuración
  if (teclaTareas(e)) return
  // Enter en el campo de la clave la guarda (7.1); nada mientras compone el IME
  if (e.key === 'Enter' && e.target.id === 'cfg-clave-in' && !e.isComposing) {
    e.preventDefault()
    guardarClaveConfig(e.target.dataset.valor)
    return
  }
  if (teclaConfiguracion(e)) return
  // Barra de control (#19, D4): Enter envía, Shift+Enter hace línea nueva, nada mientras compone el IME.
  // Las demás teclas son del campo; Esc sigue de largo (pliega el detalle o la muesca, como en todo campo)
  if (e.target.matches?.('#sesiones .ctl-in')) {
    if (teclaControl(e) === 'enviar') { e.preventDefault(); ordenar(e.target.dataset.sesion, 'mensaje'); return }
    if (e.key !== 'Escape') return
  }
  // Esc en "¿Frenar? Sí" o "¿Cerrar? Sí" deja de pedir confirmación, sin frenar ni cerrar
  if (e.key === 'Escape' && e.target.matches?.('#sesiones .ctl-frenar.confirma, #sesiones .ctl-cerrar.confirma')) {
    e.preventDefault()
    const ui = ctl(e.target.dataset.sesion)
    ui.confirmaHasta = null
    ui.cierraHasta = null
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
  // Esc con el foco en la tarjeta de "Qué hizo" lo pliega y el foco vuelve a su botón (#25)
  if (e.key === 'Escape' && st.historial && e.target.closest?.('#sesiones .ses')?.querySelector(`.ses-hizo[data-sesion="${CSS.escape(st.historial.sesion)}"]`)) {
    e.preventDefault()
    alternarHistorial(st.historial.sesion)
    return
  }
  // Esc con el foco en una tarjeta pliega el detalle abierto del subagente y el foco vuelve a su Avi (#14)
  if (e.key === 'Escape' && st.detalleSub && e.target.closest?.('#sesiones')) {
    e.preventDefault()
    alternarDetalle(null, st.detalleSub)
    return
  }
  if (teclaDividida(e)) return
  // Fuera de la pregunta, Esc cierra la muesca aunque esté fijada y devuelve el foco a la muesca (7.2)
  if (e.key === 'Escape' && st.acople && st.muesca.abierta) { e.preventDefault(); evento({ tipo: 'esc' }); return }
  if (st.mini || e.target.closest?.('input, textarea, summary, #pp, #hoja, #cfg, #tar')) return
  // ↑ ↓ mueven el foco entre los repos de la tira (no cambian de proyecto), como en la barra de antes
  const fila = e.target.closest?.('#repos [data-proy]')
  if (fila && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault()
    const filas = [...document.querySelectorAll('#repos [data-proy]')]
    filas[(filas.indexOf(fila) + (e.key === 'ArrowDown' ? 1 : -1) + filas.length) % filas.length].focus()
    return
  }
  // Con la configuración o las tareas abiertas no hay proyecto a la vista: ← → no cambian ninguno por detrás
  if (st.modulo !== 'sesiones') return
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    // Con el foco en la tira de repos, el foco sigue al elegido (la tira se redibuja en el cambio)
    const enTira = !!fila
    moverProyecto(e.key === 'ArrowLeft' ? -1 : 1)
    if (enTira) $('#repos [aria-current]')?.focus()
  }
})

// ------------------------------------------------------------------ tamaño de la ventana

/**
 * Tamaño elegido (Ctrl + / Ctrl − o el submenú "Tamaño"): todo, dibujo y texto, crece con el
 * mismo zoom. La ventana no cambia (es el área): en la misma tarea se vuelve a ubicar lo de adentro,
 * así nada salta de lugar por un cuadro.
 */
async function aplicarTamano(porcentaje) {
  st.tamano = porcentaje
  ponerPaso(porcentaje)
  recolocar()
  programarAjuste()
  pintarConfiguracion()
}

/** Aplica el paso `p` en `<html>` (todo crece junto). */
function ponerPaso(p) {
  st.paso = p
  document.documentElement.style.zoom = String(zoomDe(p))
}

/**
 * El panel nunca más ancho que el área (`area`, px de pantalla): con el zoom elegido, o el paso más
 * grande que entra (`pasoQueEntra`). La preferencia guardada no cambia. El ancho del panel en px CSS
 * no depende del zoom (#contenido es `max-content`), así que medirlo de nuevo da el mismo paso. En
 * la tira mini el tablero no se ve: queda el paso de antes.
 */
function topearPaso(area) {
  if (!area || st.mini) return
  const marco = $('#marco')
  const f = marco.offsetWidth ? marco.getBoundingClientRect().width / marco.offsetWidth : zoomDe(st.paso)
  const p = pasoQueEntra(st.tamano, medirContenido().ancho / f, area.ancho)
  if (p !== st.paso) ponerPaso(p)
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

const zoom = () => zoomDe(st.paso)
/** Tamaño de la muesca en px de pantalla (`TAM_MUESCA` por el zoom), sin medir el DOM. */
const tamMuesca = () => tamMuescaDe(st.acople.borde, zoom())

/** Largo del área de trabajo a lo largo de un borde. */
const largoDe = (borde, area) => esHorizontal(borde) ? area.ancho : area.alto

/** Disposición acoplada con el área de trabajo `area`: ventana fija, muesca y panel (9.6). */
function disposicion(area, tablero) {
  topearPaso(area)
  tablero ??= medirContenido()
  return disposicionAcoplada(st.acople, tamMuesca(), tablero, area, zoom())
}

/**
 * La disposición de la forma de ahora en el área `area` (9.7): acoplada (muesca y panel), la tira
 * (abajo a la derecha o donde se soltó) o el tablero flotante (donde quedó, topado al área; la
 * primera vez, en la posición guardada). La ventana es siempre el área.
 */
function disposicionActual(area) {
  if (st.acople) return disposicion(area)
  topearPaso(area)
  const z = zoom()
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
  if (d.local.tablero) {
    poner('t', d.local.tablero)
    // Poco alto (200 % en una pantalla de 768): la hoja de la configuración compacta su encabezado (configuracion-ux.md 16, M4)
    $('#marco').classList.toggle('bajo', marcoBajo(d.local.tablero.alto))
  }
  if (d.local.tira) poner('q', d.local.tira)
  colocarHoja(d, poner)
  st.disp = d
  st.ventana = { ...d.ventana }
  if (st.lugarGlobo === 'muesca') ubicarGloboMuesca()
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
  // Poco alto (200 % en una pantalla de 768): el escenario compacto, así se lee la charla (18, B1)
  hojaEl.classList.toggle('baja', hojaBaja(d.local.hoja.alto))
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
  // El globo de la muesca (tareas o recordatorio) suma su rectángulo: si no, su clic pasaría a la app de abajo (tareas-ux.md 8.5)
  const globo = st.lugarGlobo === 'muesca' ? st.rectGloboMuesca : null
  const zona = zonaInteractiva(st.disp, { abierta: st.vista, arrastrando: !!st.arrastre?.activo, hoja: hojaSeVe() ? st.disp.hoja : null, globo }, zoom())
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
  if (st.cfgRet.retuvo && e.fija !== antes.fija) st.cfgRet.fijaTocada = true
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
  // La configuración: su título al abrir, o una pieza de la hoja (`cfg:<data-k>`)
  else if (foco === 'cfg' && st.config.abierta) $('#titulo').focus()
  else if (foco.startsWith('cfg:') && st.config.abierta) ($(`#cfg [data-k="${CSS.escape(foco.slice(4))}"]`) ?? $('#titulo')).focus()
  // Tareas: su título al abrir (tareas-ux.md 9.4)
  else if (foco === 'tar' && st.tareas.abierta) $('#titulo').focus()
  // Hábitos: su título al abrir (habitos-ux.md 9.4)
  else if (foco === 'hab' && st.habitos.abierta) $('#titulo').focus()
  else ($('#repos [aria-current]') ?? $('#repos [data-proy]') ?? $('#marco [data-accion="pin"]'))?.focus()
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
$('#muesca-globo').addEventListener('pointerenter', e => {
  if (e.pointerType === 'mouse' && !st.muesca.abierta) ponerDentro(true)
})
$('#hoja').addEventListener('pointerenter', e => {
  if (e.pointerType === 'mouse' && st.muesca.abierta) ponerDentro(true)
})
document.documentElement.addEventListener('pointerleave', e => {
  if (e.pointerType === 'mouse') ponerDentro(false)
})
// Clic, Enter o Espacio: abre y lleva el foco al proyecto activo; abierta, la cierra (#21)
muescaEl.addEventListener('click', async () => {
  if (justoArrastro || !st.acople) return
  // Cerrada, abre en el módulo actual o, con una pregunta pendiente, en Sesiones en esa pregunta (modulos-ux.md 8)
  if (!st.muesca.abierta) await abrirPanelAlModulo()
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
  // Primeros pasos va en la columna de Sesiones (modulos-ux.md 11.1): abrirlo vuelve a Sesiones
  await irModulo('sesiones', { foco: false })
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
    // El mod cambió (prendido o instalado): la pestaña Instalación lo vuelve a leer
    if (st.config.abierta && (payload.accion === 'mod' || payload.accion === 'activar')) leerEstadoMod()
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
    // La tarjeta del mod de la configuración dice "Se actualizó solo…" el mismo día (7.3)
    st.ultimoAvisoMod = { ...aviso, cuando: Date.now() }
    if (st.config.abierta) leerEstadoMod()
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

// ------------------------------------------------------------------ configuración (#23, docs/diseno/configuracion-ux.md)
// Reglas (3 y 13): todo se aplica en el clic y se guarda al instante (no hay "Guardar"); un ajuste
// que no se pudo guardar vuelve a su valor y lo dice debajo de su fila; lo que no existe todavía no
// se muestra. La hoja vive en #cfg, en la columna principal, como la de primeros pasos.

/**
 * Lo que muestran las pestañas. `local`: el estado del modelo local (por defecto el que guarda la
 * charla, `modeloDesdeChat(st.chat)`; la firma de la sección lo pasa sin el progreso de la descarga,
 * que se cambia en su lugar).
 */
function datosConfiguracion(local = modeloDesdeChat(st.chat), ahora = Date.now()) {
  const ejecMod = st.pp.ejec.mod
  const corriendo = ejecMod?.fase === 'corriendo' || ejecMod?.fase === 'verificando'
  // La lectura del mod: la de estado_mod; sin ella todavía, la de primeros pasos (sin la hora de revisión)
  const lectura = st.cfgMod ?? (st.pp.revision?.claude ? st.pp.revision : null)
  const armado = st.config.armado
  return {
    tamano: st.tamano, ubicacion: ubicacionDe(st.acople), arriba: st.arriba, avisar: st.avisar, pausa: st.pausa,
    arranque: st.arranque, error: st.config.error, mascota: st.mascota, forma: st.config.forma,
    modelo: textoModelo(local),
    mod: textoMod(lectura, st.cfgMod, st.ultimoAvisoMod, ahora, { instalando: corriendo && ejecMod.accion === 'mod', prendiendo: corriendo && ejecMod.accion === 'activar' }),
    enEstaPC: filasEnEstaPC(st.cfgMod, st.pp.revision),
    version: st.version,
    armado: armado && armadoVigente(st.config, armado.id, ahora) ? armado.id : null,
    transcurrido: armado ? Math.max(0, MS_CONFIRMAR - (armado.hasta - ahora)) : 0,
    claves: datosClaves(ahora),
    recien: st.claveRecien,
    // Entrega 5: el motor de las charlas nuevas y el historial del chat; #35: su modelo de Claude
    motor: st.chat.motor,
    modeloNuevas: st.chat.modelo,
    historial: textoHistorial(st.historialChat),
  }
}

/** La fila de cada clave (7.1): lo leído de Credenciales (solo el final), la última prueba y el campo abierto. */
function datosClaves(ahora) {
  const c = st.config
  return Object.fromEntries(PROVEEDORES.map(({ id }) => [id, textoClave(id, {
    lectura: st.claves ? (st.claves[id] ?? { guardada: false }) : null,
    prueba: c.pruebas?.[id] ?? null,
    editando: c.editando === id,
    ver: c.ver,
    error: c.errorClave,
    armado: armadoVigente(c, `clave:${id}`, ahora),
  })]))
}

/** Las mismas pestañas sin el progreso de la descarga: lo que decide si la sección se redibuja. */
function firmaConfiguracion(tab, ahora) {
  // El "¿Borrar? Sí" lleva cuánto lleva armado (para retomar la línea): no cuenta para la firma
  return seccionConfiguracion(tab, datosFirma(ahora))
}

/** El encabezado con la configuración abierta y la hoja abajo; la tira de repos es solo de Sesiones (modulos-ux.md 4.4). */
function pintarHojaConfiguracion() {
  modoMarco('tablero')
  $('#marco').classList.remove('con-hoja')
  texto('#titulo', 'Configuración')
  $('#titulo').title = ''
  texto('#subtitulo', 'Se guarda al instante')
  pintarConfiguracion()
}

/**
 * Dibuja la hoja en #cfg por partes (4.6): el esqueleto una vez, la línea de la pregunta, la pestaña
 * elegida y la sección solo si cambiaron. El foco vuelve a la misma pieza (`data-k`). Cerrada, vacía.
 * La luz de la mascota (`--cc`) va en #cfg, que no se redibuja: así cambia con su transición (8).
 */
function pintarConfiguracion() {
  const raiz = $('#cfg')
  const mini = $('#cfg-mini')
  if (!st.config.abierta) {
    if (raiz.firstChild) { raiz.innerHTML = ''; st.cfgFirmas = {} }
    if (mini.firstChild) mini.innerHTML = ''
    $('#marco').classList.remove('con-mini')
    retenerPorClave()
    return
  }
  if (!raiz.firstChild) { raiz.innerHTML = esqueletoConfiguracion(st.config.tab); st.cfgFirmas = {} }
  raiz.style.setProperty('--cc', datosEspecie(st.mascota).c)
  // El Avi de 40 junto al título, fuera de Mascota (6.1 `.mini`)
  const htmlMini = miniConfiguracion(st.mascota, st.config.tab)
  if (st.cfgFirmas.mini !== htmlMini) {
    mini.innerHTML = htmlMini
    $('#marco').classList.toggle('con-mini', !!htmlMini)
    st.cfgFirmas.mini = htmlMini
  }
  // La pregunta pendiente se ve en #aviso-p, arriba de la hoja (modulos-ux.md 4.5): #cfg-aviso queda vacío hasta M2
  const ahora = Date.now()
  const datos = datosConfiguracion(modeloDesdeChat(st.chat), ahora)
  // Las pestañas no se redibujan: cambia cuál está elegida, así el indicador viaja desde donde estaba.
  // El punto de estado (6.3) se reescribe solo si cambió; la pestaña elegida que cambia de ancho
  // vuelve a poner el indicador, sin viaje
  const puntos = { modelo: datos.modelo.estado, mod: datos.mod.estado, claves: datos.claves }
  let anchoCambio = false
  for (const b of document.querySelectorAll('#cfg [role="tab"]')) {
    const sel = b.dataset.valor === st.config.tab
    b.setAttribute('aria-selected', String(sel))
    b.tabIndex = sel ? 0 : -1
    const nombre = nombrePestana(b.dataset.valor, puntoPestana(puntos, b.dataset.valor))
    if (st.cfgFirmas[`tab-${b.dataset.valor}`] !== nombre) {
      b.innerHTML = nombre
      st.cfgFirmas[`tab-${b.dataset.valor}`] = nombre
      anchoCambio = true
    }
  }
  const lista = $('#cfg .pestanas')
  if (!$('#cfg .ind').style.width || anchoCambio) movimientoConfig.colocarIndicador(lista, false)
  const html = seccionConfiguracion(st.config.tab, datos)
  const firma = firmaConfiguracion(st.config.tab, ahora)
  // Lo único que cambia sin redibujar: el progreso de la descarga del modelo local (7.2)
  if (st.cfgFirmas.seccion === firma && st.config.tab === 'modelos') ponerProgresoConfig(datos.modelo)
  else if (st.cfgFirmas.seccion !== firma) {
    const cont = $('#cfg-cont')
    const k = cont.contains(document.activeElement) ? document.activeElement.closest('[data-k]')?.dataset.k : null
    // Mascota y Modelos ya dibujadas: cambia solo la parte que cambió. En Mascota la figura sigue si
    // cambia la forma y la luz del escenario hace su transición; en Modelos, el campo de la clave que
    // se escribe no se toca cuando cambia otra fila o el modelo local (4.6). La firma de cada parte
    // sale de los datos sin el progreso de la descarga (que se pone en su lugar)
    const tab = st.config.tab
    const partes = tab === 'mascota' ? partesMascota(datos) : tab === 'modelos' ? partesModelos(datos) : null
    const firmasPartes = tab === 'modelos' ? partesModelos(datosFirma(ahora)) : partes
    const armada = tab === 'mascota' ? cont.querySelector('.esc-m') : tab === 'modelos' ? cont.querySelector('[data-parte="local"]') : null
    if (partes && armada) {
      for (const [parte, h] of Object.entries(partes)) {
        const f = firmasPartes[parte]
        if (st.cfgFirmas[`m-${parte}`] === f) continue
        const el = cont.querySelector(`[data-parte="${parte}"]`)
        if (el) ponerParteConCampo(el, h)
        st.cfgFirmas[`m-${parte}`] = f
      }
      if (tab === 'modelos') ponerProgresoConfig(datos.modelo)
    } else {
      cont.innerHTML = html
      for (const [parte, f] of Object.entries(firmasPartes ?? {})) st.cfgFirmas[`m-${parte}`] = f
    }
    $('#cfg-p').setAttribute('aria-labelledby', `cfg-t-${tab}`)
    if (k && cont.contains(document.activeElement) === false) cont.querySelector(`[data-k="${CSS.escape(k)}"]`)?.focus({ preventScroll: true })
    st.cfgFirmas.seccion = firma
  }
  retenerPorClave()
}

/** Los datos de la hoja sin el progreso de la descarga ni lo que lleva armado un borrado: lo que decide si algo se redibuja. */
function datosFirma(ahora) {
  const r = modeloDesdeChat(st.chat)
  const datos = datosConfiguracion(r.trabajo === 'descargando' ? { ...r, progreso: { bajado: 0, total: r.progreso?.total ?? 0 } } : r, ahora)
  return { ...datos, transcurrido: 0 }
}

/**
 * Reemplaza una parte de la hoja. Si adentro está el campo que se escribe (`sel`: el de la clave, o los
 * de la hoja de Tareas), su texto, la selección y el foco pasan al campo nuevo (el mismo `id` o
 * `data-k`): el texto vive solo en el `<input>` (4.6), nunca en el HTML.
 */
function ponerParteConCampo(el, html, sel = '#cfg-clave-in') {
  const clave = c => c.id || c.dataset.k
  const guardados = [...el.querySelectorAll(sel)].map(c => ({ k: clave(c), valor: c.value, ini: c.selectionStart, fin: c.selectionEnd, foco: document.activeElement === c }))
  el.innerHTML = html
  for (const g of guardados) {
    const nuevo = [...el.querySelectorAll(sel)].find(c => clave(c) === g.k)
    if (!nuevo) continue
    nuevo.value = g.valor
    try { nuevo.setSelectionRange(g.ini, g.fin) } catch { /* el tipo no admite selección */ }
    if (g.foco) nuevo.focus({ preventScroll: true })
  }
}

/**
 * Acoplada, el panel no se pliega mientras el campo de una clave está abierto (4.1, el mismo
 * mecanismo que `retenerPanel` de primeros pasos): queda fijado y al guardar o cancelar vuelve a la
 * marca que tenía, salvo que el usuario la haya cambiado mientras tanto.
 */
function retenerPorClave() {
  const r = st.cfgRet
  const retener = !!st.acople && retieneConfig(st.config)
  if (retener && !r.retuvo && !st.muesca.fija) {
    r.retuvo = true
    r.fijaAntes = st.muesca.fija
    r.fijaTocada = false
    st.muesca = { ...st.muesca, fija: true }
    pintarControles()
  } else if (!retener && r.retuvo) {
    r.retuvo = false
    const fija = fijaAlSoltar({ antes: r.fijaAntes, actual: st.muesca.fija, tocada: r.fijaTocada })
    if (st.muesca.fija !== fija) st.muesca = { ...st.muesca, fija }
    pintarControles()
  }
}

/** El progreso de la descarga en la tarjeta del modelo local, en su lugar (la barra sigue su transición). */
function ponerProgresoConfig(m) {
  if (m.estado !== 'bajando') return
  const barra = $('#cfg [data-cfg-barra]')
  if (barra) {
    barra.style.setProperty('--p', String(m.fraccion))
    barra.setAttribute('aria-valuenow', String(m.porcentaje))
  }
  for (const [sel, valor] of [['#cfg [data-cfg-cifras]', m.linea], ['#cfg [data-cfg-pill] > span', m.pill]]) if ($(sel)) texto(sel, valor)
}

/**
 * Abre la hoja de Configuración (la fila del menú, Ctrl ,, la bandeja o una tarjeta con `tab`): la lee,
 * la dibuja y hace su acto de entrada; acoplada, abre también el panel. Solo la llama `irModulo`
 * (modulos-ux.md 11.1), que ya cerró la otra hoja, la dividida y la tira, y que con la hoja ya abierta
 * solo cambia la pestaña y lleva el foco al título. El foco va al `h1` (11).
 */
function abrirConfig({ tab, foco = true } = {}) {
  if (st.config.abierta) return
  st.config = { ...abrirConfiguracion(st.config, tab), error: null }
  // El mod, las claves y el modelo local se leen al abrir (solo lectura, sin red): los puntos de las
  // pestañas se ven desde cualquiera
  leerEstadoMod()
  leerClaves()
  leerModelo()
  leerHistorialConfig()
  pintar()
  movimientoConfig.abrirHoja($('#marco .cab'), $('#cfg-tabs'), $('#cfg-cont'))
  if (st.acople) {
    evento({ tipo: 'clic' })
    if (foco) { st.focoPendiente = 'cfg'; aplicarFoco() }
  } else if (foco) {
    $('#titulo').focus()
  }
}

/**
 * Cierra la hoja (solo desde `irModulo`: Esc, la fila de Sesiones, otro módulo, un proyecto o la
 * pregunta). De vuelta en Sesiones el tablero vuelve como estaba, con su acto (`acto`); hacia otra hoja,
 * sin él. El foco lo pone `irModulo`.
 */
function cerrarConfig({ acto = true } = {}) {
  if (!st.config.abierta) return
  st.config = cerrarConfiguracion(st.config)
  pintar()
  if (acto) movimientoConfig.cerrarHoja([$('#otro'), $('#w-globo'), $('#conteos'), ...document.querySelectorAll('#sesiones > .ses')])
}

/** Cambia de pestaña (clic o flechas): el indicador viaja y el contenido entra desde su lado. */
function cambiarPestanaConfig(tab, { foco = false } = {}) {
  if (!IDS_PESTANAS.includes(tab) || tab === st.config.tab) return
  const direccion = Math.sign(IDS_PESTANAS.indexOf(tab) - IDS_PESTANAS.indexOf(st.config.tab))
  const salioDeMascota = st.config.tab === 'mascota'
  // La vista previa vuelve a la base: la figura se redibuja al volver a Mascota
  st.config = { ...st.config, tab, editando: null, armado: null, error: null, forma: 'base', ver: false, errorClave: null }
  // Las charlas pueden haber cambiado con la configuración abierta: se cuentan de nuevo al entrar a Datos
  if (tab === 'datos') leerHistorialConfig()
  pintarConfiguracion()
  movimientoConfig.colocarIndicador($('#cfg .pestanas'), true)
  movimientoConfig.cambioPestana($('#cfg-cont'), direccion, { mini: salioDeMascota ? $('#cfg-mini > .avi') : null })
  $('#cfg-p').scrollTop = 0
  if (foco) $(`#cfg-t-${tab}`)?.focus()
}

/** Aplica un interruptor en la ventana (sin guardar): lo mismo que hace el evento de Rust. */
function aplicarInterruptor(clave, valor) {
  if (clave === 'arriba') ponerArriba(valor)
  else if (clave === 'avisar') st.avisar = valor
  else if (clave === 'pausa') ponerPausa(valor)
}

/**
 * Cambia un ajuste en el clic y lo guarda (`guardar_ajuste`): si no se pudo, vuelve a su valor de
 * antes y lo dice debajo de su fila (7.5). Devuelve si quedó guardado.
 */
async function guardarAjusteConfig(clave, valor) {
  if (!validarAjuste(clave, valor)) return false
  const antes = st[clave]
  aplicarInterruptor(clave, valor)
  st.config = { ...st.config, error: null }
  pintarConfiguracion()
  try {
    await invocar('guardar_ajuste', { clave, valor })
    return true
  } catch (err) {
    registrar(`configuración: no se pudo guardar ${clave}: ${err}`)
    aplicarInterruptor(clave, antes)
    st.config = { ...st.config, error: clave }
    pintarConfiguracion()
    return false
  }
}

/**
 * Un anuncio en la región `role=status` de la hoja: se vacía antes, así el mismo texto se vuelve a oír.
 * Dos que llegan casi juntos (probar dos claves a la vez) se dicen juntos: uno no pisa al otro (16, D-e).
 */
let anunciosConfig = []
let anuncioConfigEn = null
function decirConfig(mensaje) {
  const el = $('#cfg-vivo')
  if (!el || !mensaje) return
  anunciosConfig.push(mensaje)
  if (anuncioConfigEn) return
  el.textContent = ''
  anuncioConfigEn = setTimeout(() => {
    el.textContent = anunciosConfig.join('. ')
    anunciosConfig = []
    anuncioConfigEn = null
  }, 150)
}

/**
 * Cambia la mascota en toda la ventana (configuracion-ux.md 9.3): la marca, la muesca, la tira, las
 * tarjetas, los subagentes y el equipo se redibujan con la especie nueva, sin acto. Las firmas no
 * llevan la mascota, así que se olvidan; la forma evolucionada de cada clave sigue (st.formas). La
 * vista previa de la configuración vuelve a la base. Devuelve si cambió.
 */
function ponerMascota(especie) {
  if (!validarAjuste('mascota', especie) || especie === st.mascota) return false
  st.mascota = especie
  st.config = { ...st.config, forma: 'base' }
  for (const k of Object.keys(st.firmas)) if (k.startsWith('#')) st.firmas[k] = null
  marca.redibujar()
  muescaAvi.redibujar()
  pintar()
  return true
}

/**
 * Elige la especie en la pestaña Mascota: se ve en toda la ventana en el clic, con su acto en el
 * escenario (8), y se guarda (`guardar_ajuste`, que también avisa `oficina://mascota`). Si no se pudo
 * guardar, vuelve la de antes y lo dice debajo de las fichas (7.5).
 */
async function elegirEspecieConfig(especie) {
  if (!validarAjuste('mascota', especie) || especie === st.mascota) return
  const antes = st.mascota
  st.config = { ...st.config, error: null }
  ponerMascota(especie)
  movimientoConfig.elegirEspecie({
    figura: $('#cfg .esc-fig > .avi'), textos: [...document.querySelectorAll('#cfg .esc-t > *')], marca: $('#marca-avi > .avi'),
  })
  decirConfig(anuncioEspecie(especie))
  try {
    await invocar('guardar_ajuste', { clave: 'mascota', valor: especie })
  } catch (err) {
    registrar(`configuración: no se pudo guardar mascota: ${err}`)
    st.config = { ...st.config, error: 'mascota' }
    // Si mientras tanto se eligió otra, esa manda: solo se vuelve si sigue la que falló
    if (st.mascota !== especie || !ponerMascota(antes)) pintarConfiguracion()
  }
}

/** "Base · {evo}" (8): la forma de la vista previa, con el acto real de la especie o al instante. */
function cambiarFormaConfig(forma) {
  const config = elegirForma(st.config, forma)
  if (config.forma === st.config.forma) return
  st.config = config
  pintarConfiguracion()
  movimientoConfig.vistaPrevia($('#cfg .esc-fig svg'), st.mascota, forma, $('#cfg .esc-m'))
  decirConfig(anuncioForma(st.mascota, forma))
}

/** "Arrancar con Windows": solo con este clic cambia el inicio de Windows; la marca es la real. */
async function ponerArranqueConfig(valor) {
  const antes = st.arranque
  st.arranque = valor
  st.config = { ...st.config, error: null }
  pintarConfiguracion()
  try {
    st.arranque = (await invocar('poner_arranque', { valor })) === true
    if (st.arranque !== valor) st.config = { ...st.config, error: 'arranque' }
  } catch (err) {
    registrar(`configuración: arrancar con Windows: ${err}`)
    st.arranque = antes
    st.config = { ...st.config, error: 'arranque' }
  }
  pintarConfiguracion()
}

/** "Dónde vive": flotar o acoplar a un borde, como al soltar el tablero; acoplada, el panel queda abierto. */
async function ubicarConfig(ubicacion) {
  const borde = bordeDeUbicacion(ubicacion)
  if (borde === undefined || ubicacion === ubicacionDe(st.acople)) return
  // Mientras otra forma anima o se arrastra, no se cambia: la opción vuelve a la de ahora, sin error
  if (st.arrastre || st.transicion) { st.cfgFirmas.seccion = null; pintarConfiguracion(); return }
  st.config = { ...st.config, error: null }
  await acoplarA(borde)
  if (ubicacionDe(st.acople) !== ubicacion) {
    st.config = { ...st.config, error: 'ubicacion' }
    pintarConfiguracion()
    return
  }
  // Acoplada, la configuración sigue a la vista: el panel se abre con el foco en la opción elegida
  if (st.acople && st.config.abierta) {
    evento({ tipo: 'clic' })
    st.focoPendiente = `cfg:cfg-ubic-${ubicacion}`
    aplicarFoco()
  } else {
    $(`#cfg [data-k="cfg-ubic-${ubicacion}"]`)?.focus()
  }
}

/**
 * Lee el mod para la pestaña Instalación (`estado_mod`: solo comandos de lectura). Al abrir la
 * configuración y cuando el mod cambia con ella abierta; nunca en el ciclo de 1,5 s.
 */
async function leerEstadoMod() {
  if (!tauri?.core) return
  try {
    const e = await invocar('estado_mod')
    if (e && typeof e === 'object') st.cfgMod = e
  } catch (err) {
    registrar(`configuración: estado del mod: ${err}`)
  }
  if (st.config.abierta) pintarConfiguracion()
}

let relojArmado = null
/** El "¿Borrar? Sí" vuelve solo a los 3 s (D5). */
function vigilarArmado() {
  clearTimeout(relojArmado)
  const a = st.config.armado
  if (!a) return
  relojArmado = setTimeout(() => {
    const c = desarmarVencido(st.config, Date.now())
    if (c === st.config) return vigilarArmado()
    st.config = c
    pintarConfiguracion()
  }, Math.max(0, a.hasta - Date.now()) + 20)
}

/**
 * "Borrar" del modelo local (7.2): el primer clic arma "¿Borrar …? Sí" 3 s; el segundo borra una vez
 * (`borrar_modelo`, sin cuadro nativo). Rust avisa el estado nuevo y la tarjeta vuelve a "Sin
 * instalar"; el foco va a "Descargar". Si no se pudo, lo dice debajo de la tarjeta.
 */
async function clicBorrarModelo() {
  const { config, ejecutar } = clicBorrar(st.config, 'local', Date.now())
  st.config = { ...config, error: null }
  vigilarArmado()
  pintarConfiguracion()
  if (!ejecutar) return
  try {
    await invocar('borrar_modelo')
    decirConfig('Modelo local borrado')
    await leerModelo()
    if (st.config.abierta) $('#cfg [data-k="local-descargar"]')?.focus({ preventScroll: true })
  } catch (err) {
    registrar(`configuración: no se pudo borrar el modelo: ${err}`)
    st.config = { ...st.config, error: 'modelo' }
    await leerModelo()
    pintarConfiguracion()
  }
}

// ------------------------------------------------------------------ charla e historial (entrega 5: 4.4 y 7.4)

/**
 * "Quién responde" (D10): guarda el motor de las charlas nuevas (`guardar_chat`, con la carpeta de
 * siempre) y lo pone en la charla (`motor-nuevas`); la charla abierta sigue con el suyo. Si la
 * carpeta guardada ya no existe, se guarda sin ella. Si no se pudo, la opción vuelve y lo dice.
 */
async function elegirMotorConfig(motor) {
  if (!MOTORES.some(([m]) => m === motor) || motor === st.chat.motor) return
  st.config = { ...st.config, error: null }
  try {
    let r
    try {
      r = await invocar('guardar_chat', { motor, carpeta: st.chat.carpeta ?? null, modelo: st.chat.modelo ?? null })
    } catch (err) {
      if (!String(err).includes('la carpeta no existe')) throw err
      r = await invocar('guardar_chat', { motor, carpeta: null, modelo: st.chat.modelo ?? null })
    }
    despacharChat({ tipo: 'motor-nuevas', motor })
    if (r && Array.isArray(r.recientes)) despacharChat({ tipo: 'recientes', recientes: r.recientes })
    decirConfig(`Las charlas nuevas las responde ${MOTORES.find(([m]) => m === motor)[1]}`)
  } catch (err) {
    registrar(`configuración: motor: no se pudo guardar (${err})`)
    st.config = { ...st.config, error: 'motor' }
  }
  pintarConfiguracion()
  $(`#cfg [data-k="cfg-motor-${st.chat.motor}"]`)?.focus({ preventScroll: true })
}

/**
 * "Modelo" (#35, S2): guarda el modelo de Claude de las charlas nuevas (`guardar_chat` con el juego
 * completo: el motor y la carpeta de siempre) y lo pone en la charla (`modelo-nuevas`); la charla
 * abierta sigue con el suyo. Si la carpeta guardada ya no existe, se guarda sin ella. Si no se pudo,
 * la opción vuelve y lo dice.
 */
async function elegirModeloConfig(valor) {
  const modelo = modeloDeValor(valor)
  if (modelo === undefined || modelo === modeloValido(st.chat.modelo)) return
  st.config = { ...st.config, error: null }
  try {
    let r
    try {
      r = await invocar('guardar_chat', { motor: st.chat.motor, carpeta: st.chat.carpeta ?? null, modelo })
    } catch (err) {
      if (!String(err).includes('la carpeta no existe')) throw err
      r = await invocar('guardar_chat', { motor: st.chat.motor, carpeta: null, modelo })
    }
    despacharChat({ tipo: 'modelo-nuevas', modelo })
    if (r && Array.isArray(r.recientes)) despacharChat({ tipo: 'recientes', recientes: r.recientes })
    decirConfig(modelo ? `Las charlas nuevas usan ${nombreModelo(modelo)}` : 'Las charlas nuevas usan el modelo de Claude Code')
  } catch (err) {
    registrar(`configuración: modelo: no se pudo guardar (${err})`)
    st.config = { ...st.config, error: 'modelo-claude' }
  }
  pintarConfiguracion()
  $(`#cfg [data-k="cfg-modelo-${modeloValido(st.chat.modelo) ?? 'defecto'}"]`)?.focus({ preventScroll: true })
}

/** Cuenta las charlas guardadas (`chat_contar`, solo lectura): al abrir la configuración, al entrar a Datos y después de borrar. */
async function leerHistorialConfig() {
  if (!tauri?.core) return
  try {
    const r = await invocar('chat_contar')
    st.historialChat = { ...st.historialChat, resumen: { charlas: Number(r?.charlas) || 0, bytes: Number(r?.bytes) || 0 } }
  } catch (err) {
    registrar(`configuración: historial: no se pudo contar (${err})`)
  }
  if (st.config.abierta) pintarConfiguracion()
}

/**
 * "Borrar todo" del historial (7.4): el primer clic arma "¿Borrar {n} charlas? Sí" 3 s; el segundo
 * borra una vez (`chat_borrar_todo`: los archivos y sus copias de Engram). "Reintentar", después de un
 * error, borra sin volver a preguntar.
 */
async function clicHistorialConfig(valor) {
  if (st.historialChat.borrando) return
  if (valor === 'borrar') {
    const { config, ejecutar } = clicBorrar(st.config, 'historial', Date.now())
    st.config = { ...config, error: null }
    vigilarArmado()
    pintarConfiguracion()
    if (!ejecutar) return
  } else if (valor !== 'reintentar') return
  st.historialChat = { ...st.historialChat, borrando: true, fallidas: 0 }
  pintarConfiguracion()
  let fallidas = 0
  try {
    const r = await invocar('chat_borrar_todo')
    fallidas = Number(r?.fallidas) || 0
  } catch (err) {
    registrar(`configuración: historial: no se pudo borrar (${err})`)
    fallidas = st.historialChat.resumen?.charlas || 1
  }
  st.historialChat = { ...st.historialChat, borrando: false, fallidas }
  await leerHistorialConfig()
  // El cajón de la charla vuelve a leer la lista del disco
  invocar('chat_historial').then(lista => despacharChat({ tipo: 'historial', charlas: lista }))
    .catch(err => registrar(`chat historial: ${err}`))
  if (fallidas) {
    decirConfig(textoHistorial(st.historialChat).error)
    $('#cfg [data-k="hist-reintentar"]')?.focus({ preventScroll: true })
  } else {
    decirConfig('Historial del chat borrado')
    $('#cfg-t-datos')?.focus({ preventScroll: true })
  }
}

// ------------------------------------------------------------------ claves de API (entrega 4: 7.1 y 9.4)
// La clave cruza a Rust una sola vez (guardar_clave) y nunca vuelve: de Credenciales de Windows solo
// llegan si hay una y su final de 4. El texto que se escribe vive solo en el campo; ni `st`, ni
// widget.log, ni los errores lo llevan. Probar sale a la red solo con su clic.

/** Lee qué claves hay (`claves_estado`: solo el final). Al abrir la configuración; nunca en el ciclo. */
async function leerClaves() {
  if (!tauri?.core) return
  try {
    st.claves = clavesDesdeLectura(await invocar('claves_estado')) ?? st.claves
  } catch (err) {
    registrar(`configuración: claves: no se pudieron leer (${detalleErrorClave(err)})`)
  }
  if (st.config.abierta) pintarConfiguracion()
}

/** El foco en una pieza de la fila de un proveedor, o en la que quede en su lugar (11). */
function enfocarClave(proveedor, ...ks) {
  for (const k of ks) {
    const el = $(`#cfg [data-k="${k}-${proveedor}"]`) ?? $(`#cfg [data-k="${k}"]`)
    if (el) { el.focus({ preventScroll: true }); return }
  }
}

/** "+ Agregar clave" o "Reemplazar": abre el campo vacío (nunca precargado) con el foco adentro. */
function abrirCampoClave(proveedor) {
  st.config = empezarClave(st.config, proveedor)
  vigilarArmado()
  pintarConfiguracion()
  $('#cfg-clave-in')?.focus()
}

/** "Cancelar" o Esc: el texto escrito se descarta con el campo; el foco vuelve a "+ Agregar clave" o "Reemplazar". */
function cancelarClave() {
  const p = st.config.editando
  if (!p) return
  st.config = { ...st.config, editando: null, ver: false, errorClave: null }
  pintarConfiguracion()
  enfocarClave(p, 'r')
}

/**
 * "Guardar" (o Enter en el campo): lee lo escrito, revisa su forma (un error nunca borra lo escrito;
 * un prefijo raro pide "Guardar igual", D13) y lo manda a Credenciales de Windows una sola vez. Al
 * guardar: el campo se vacía y se va, la fila se baña de verde, se anuncia y el foco va a "Probar".
 */
async function guardarClaveConfig(proveedor) {
  const campo = $('#cfg-clave-in')
  if (!campo || st.config.editando !== proveedor || st.config.guardandoClave) return
  const forma = formaClave(proveedor, campo.value)
  const error = forma.estado !== 'ok' ? forma.estado : forma.aviso && st.config.errorClave !== 'prefijo' ? forma.aviso : null
  if (error) {
    st.config = { ...st.config, errorClave: error }
    pintarConfiguracion()
    $('#cfg-clave-in')?.focus()
    return
  }
  st.config = { ...st.config, guardandoClave: true }
  try {
    const r = await invocar('guardar_clave', { proveedor, clave: forma.clave })
    campo.value = ''
    const actual = $('#cfg-clave-in')
    if (actual) actual.value = ''
    st.claves = { ...(st.claves ?? {}), [proveedor]: { guardada: true, final: finalDe(r?.final) } }
    st.config = { ...st.config, editando: null, ver: false, errorClave: null, guardandoClave: false, pruebas: { ...st.config.pruebas, [proveedor]: null } }
    st.claveRecien = proveedor
    pintarConfiguracion()
    decirConfig(anuncioGuardada(proveedor))
    enfocarClave(proveedor, 'p', 'r')
    setTimeout(() => {
      if (st.claveRecien !== proveedor) return
      st.claveRecien = null
      if (st.config.abierta) pintarConfiguracion()
    }, 1300)
  } catch (err) {
    // El campo sigue abierto con su texto: el detalle es solo el código de Windows, nunca la clave
    const detalle = detalleErrorClave(err)
    registrar(`configuración: claves: no se pudo guardar ${proveedor} (${detalle})`)
    st.config = { ...st.config, errorClave: { windows: detalle }, guardandoClave: false }
    pintarConfiguracion()
    $('#cfg-clave-in')?.focus()
  }
}

/** "Probar" (solo con el clic, D7): un pedido de solo lectura al proveedor con la clave guardada. */
async function probarClaveConfig(proveedor) {
  if (st.config.pruebas?.[proveedor]?.estado === 'probando') return
  const poner = prueba => { st.config = { ...st.config, pruebas: { ...st.config.pruebas, [proveedor]: prueba } } }
  poner({ estado: 'probando' })
  pintarConfiguracion()
  let prueba
  try {
    prueba = resultadoPrueba(await invocar('probar_clave', { proveedor }))
  } catch (err) {
    registrar(`configuración: claves: no se pudo probar ${proveedor} (${detalleErrorClave(err)})`)
    prueba = { estado: 'otro', codigo: null }
  }
  poner(prueba)
  pintarConfiguracion()
  decirConfig(anuncioPrueba(proveedor, prueba))
  // "Probar" se va con válida o rechazada: el foco queda en "Reemplazar"
  if (!$('#cfg').contains(document.activeElement)) enfocarClave(proveedor, 'p', 'r')
}

/**
 * "Borrar" de una clave: el primer clic arma "¿Borrar la clave? Sí" 3 s (D5); el segundo la borra de
 * Credenciales una vez. Después, "Sin clave" y el foco en "+ Agregar clave". Si no se pudo, lo dice
 * debajo de su fila.
 */
async function clicBorrarClave(proveedor) {
  const { config, ejecutar } = clicBorrar(st.config, `clave:${proveedor}`, Date.now())
  st.config = { ...config, error: null }
  vigilarArmado()
  pintarConfiguracion()
  if (!ejecutar) return
  try {
    await invocar('borrar_clave', { proveedor })
    st.claves = { ...(st.claves ?? {}), [proveedor]: { guardada: false, final: '' } }
    st.config = { ...st.config, pruebas: { ...st.config.pruebas, [proveedor]: null } }
    pintarConfiguracion()
    decirConfig(ANUNCIO_CLAVE_BORRADA)
    enfocarClave(proveedor, 'r')
  } catch (err) {
    registrar(`configuración: claves: no se pudo borrar ${proveedor} (${detalleErrorClave(err)})`)
    st.config = { ...st.config, error: `clave:${proveedor}` }
    pintarConfiguracion()
    enfocarClave(proveedor, 'b')
  }
}

// ------------------------------------------------------------------ tareas (#39, docs/diseno/tareas-ux.md)
// Reglas (14, "no improvisar"): todo se guarda al instante (no hay "Guardar"); lo que borra confirma en
// el mismo botón; nada se abre solo; Hoy es el día de Argentina; un archivo roto nunca se toca (Rust
// tampoco lo deja). La hoja vive en #tar, en la columna principal, como la configuración. La ventana
// nunca arma rutas: manda la lista entera a `tareas_guardar` y el id a `tareas_borrar_lista`, y Rust
// valida el id antes de armar `<config>/tareas/<id>.json`.
// Entrega 1: la hoja, las listas y las tareas. Entrega 2: la tarea abierta (4.7), en el lugar de la
// lista, y mover entre listas (11.3). El aviso diario con su globo (8) es la entrega 3.

const hoyTareas = () => hoyArgentina(Date.now())

/** La fila "Tareas" de la barra (4.1): la pista "Ctrl T" o el chip, y su nombre accesible. El chip late al cambiar la cuenta. */
function pintarFilaTareas() {
  const c = st.tareas.leido ? cuentas(st.tareas.listas, hoyTareas()) : { hoy: 0, vencidas: 0 }
  const html = ladoFilaTareas(c)
  if (st.tarFirmas.fila !== html) {
    const cambio = st.tarFirmas.fila != null
    $('#tar-fila-ct').innerHTML = html
    st.tarFirmas.fila = html
    if (cambio) movimientoTareas.latirChip($('#tar-fila .chip'))
  }
  const nombre = nombreFilaTareas(c)
  if ($('#tar-fila').getAttribute('aria-label') !== nombre) $('#tar-fila').setAttribute('aria-label', nombre)
}

/** El encabezado con la hoja abierta: "Tareas" y su bajada (5.1); la tira de repos es solo de Sesiones (modulos-ux.md 4.4). */
function pintarHojaTareas() {
  modoMarco('tablero')
  $('#marco').classList.remove('con-hoja')
  const hoy = hoyTareas()
  texto('#titulo', 'Tareas')
  $('#titulo').title = ''
  texto('#subtitulo', subtituloTareas(cuentas(st.tareas.listas, hoy), hoy, st.tareas.listas.length > 0))
  pintarTareas()
}

/** Las filas que hacen su acto de tilde: mientras tanto, la lista no se redibuja (10). */
const tildando = new Set()

/** ¿La vista existe todavía? Una lista borrada o un archivo roto que se arregló vuelven a Hoy. */
function vistaValida(t) {
  if (t.ver === 'hoy' || t.ver === 'vencidas') return true
  if (String(t.ver).startsWith('rota:')) return t.rotas.some(r => `rota:${r.archivo}` === t.ver)
  return t.listas.some(l => l.id === t.ver)
}

/**
 * Dibuja la hoja en #tar por partes (3.5): el esqueleto una vez; la línea de la pregunta; el primer uso
 * o la carpeta; y en la carpeta el índice, el encabezado del panel, el error, el campo y la lista, cada
 * uno solo si cambió. Un campo que se escribe nunca se pisa (`ponerParteConCampo`) y el foco vuelve a la
 * misma pieza (`data-k`). Cerrada, vacía.
 */
function pintarTareas() {
  const raiz = $('#tar')
  const mini = $('#tar-mini')
  const f = st.tarFirmas
  if (!st.tareas.abierta) {
    if (raiz.firstChild) { raiz.innerHTML = ''; st.tarFirmas = { fila: f.fila } }
    if (mini.firstChild) mini.innerHTML = ''
    return
  }
  if (!raiz.firstChild) { raiz.innerHTML = esqueletoTareas(); st.tarFirmas = { fila: f.fila } }
  if (!vistaValida(st.tareas)) st.tareas = cambiarVista(st.tareas, 'hoy')
  // Una tarea abierta que ya no está (se borró su lista) se cierra
  if (st.tareas.det && !buscarTarea(st.tareas.listas, st.tareas.det)) st.tareas = cerrarDetalle(st.tareas)
  const t = st.tareas
  const firmas = st.tarFirmas
  const htmlMini = miniTareas(st.mascota, t.feliz)
  if (firmas.mini !== htmlMini) { mini.innerHTML = htmlMini; firmas.mini = htmlMini }
  // La pregunta pendiente se ve en #aviso-p, arriba de la hoja (modulos-ux.md 4.5): #tar-aviso queda vacío hasta M2

  const cuerpo = $('#tar-cuerpo')
  const k = raiz.contains(document.activeElement) ? document.activeElement.closest('[data-k]')?.dataset.k : null
  const modo = t.errorLeer && !t.listas.length ? 'error' : t.leido && !t.listas.length && !t.rotas.length ? 'primer' : 'carpeta'
  if (firmas.modo !== modo) {
    cuerpo.innerHTML = modo === 'carpeta' ? CARPETA : ''
    for (const p of ['cuerpo', 'idx', 'pane-h', 'err', 'nuevo', 'lista']) delete firmas[p]
    firmas.modo = modo
  }
  const ponerParte = (el, parte, html, firma = html) => {
    if (!el || firmas[parte] === firma) return
    ponerParteConCampo(el, html, 'input[data-campo], textarea[data-campo]')
    firmas[parte] = firma
  }
  // La tarea abierta (4.7): entra en el lugar de la lista, con "‹ {vista}" en el del encabezado del panel
  const det = modo === 'carpeta' && t.det ? buscarTarea(t.listas, t.det) : null
  if (modo !== 'carpeta') {
    ponerParte(cuerpo, 'cuerpo', modo === 'error' ? errorCarpeta(t.errorLeer) : primerUso(st.mascota, t.errorLista))
  } else if (det) {
    const parte = p => cuerpo.querySelector(`[data-parte="${p}"]`)
    ponerParte(parte('idx'), 'idx', indiceTareas({
      ver: t.ver, listas: t.listas, cuentas: t.leido ? cuentas(t.listas, hoyTareas()) : null, rotas: t.rotas,
      renombrando: t.renombrando, creando: t.creando, errorLista: t.errorLista,
    }))
    ponerParte(parte('pane-h'), 'pane-h', atrasTarea(nombreVista(t.listas, t.ver)))
    ponerParte(parte('err'), 'err', t.errorGuardar ? errorGuardar() : '')
    ponerParte(parte('nuevo'), 'nuevo', '')
    pintarDetalleTareas(parte('lista'), det)
  } else {
    const ahora = Date.now()
    const hoy = hoyTareas()
    const rota = String(t.ver).startsWith('rota:') ? t.ver.slice(5) : null
    const armado = t.armado && armadoVigente(t, t.armado.id, ahora) && t.armado.id === `lista:${t.ver}`
    const transcurrido = armado ? Math.max(0, MS_CONFIRMAR - (t.armado.hasta - ahora)) : 0
    const parte = p => cuerpo.querySelector(`[data-parte="${p}"]`)
    ponerParte(parte('idx'), 'idx', indiceTareas({
      ver: t.ver, listas: t.listas, cuentas: t.leido ? cuentas(t.listas, hoy) : null, rotas: t.rotas,
      renombrando: t.renombrando, creando: t.creando, errorLista: t.errorLista,
    }))
    // El "¿Borrar…? Sí" lleva cuánto lleva armado (para retomar la línea): no cuenta para la firma
    const cab = c => cabeceraPanel({ ver: t.ver, listas: t.listas, hoy, armado: !!armado, transcurrido: c })
    ponerParte(parte('pane-h'), 'pane-h', cab(transcurrido), cab(0))
    ponerParte(parte('err'), 'err', rota ? errorRota(rota) : t.errorGuardar ? errorGuardar() : '')
    ponerParte(parte('nuevo'), 'nuevo', rota || !t.leido ? '' : campoNueva(t.ver, t.listas))
    // La recién agregada lleva su destello una vez: no cuenta para la firma (un redibujo no lo repite)
    const lista = r => (rota ? '' : cuerpoLista({ ver: t.ver, listas: t.listas, hoy, hechas: t.hechas, recien: r, fantasmas: !t.leido && t.fantasmas, mascota: st.mascota }))
    if (!tildando.size) ponerParte(parte('lista'), 'lista', lista(t.recien), lista(null))
  }
  if (k && !raiz.contains(document.activeElement)) raiz.querySelector(`[data-k="${CSS.escape(k)}"]`)?.focus({ preventScroll: true })
}

/**
 * La tarea abierta en el lugar de la lista (4.7): el esqueleto una vez por tarea (el `h2` oculto sigue
 * al título) y cada parte solo si cambió. El título y las notas no cuentan para sus firmas: viven en su
 * campo mientras se escriben y nunca se pisan; la fecha y la lista sí (se cambian con un clic).
 */
function pintarDetalleTareas(el, { lista, tarea }) {
  const t = st.tareas
  const firmas = st.tarFirmas
  if (!el) return
  const firma = `det:${tarea.id}`
  if (firmas.lista !== firma) {
    el.innerHTML = esqueletoDetalle(tarea.titulo)
    for (const p of ['det-tit', 'det-g', 'det-sub', 'det-notas', 'det-pie']) delete firmas[p]
    firmas.lista = firma
  }
  const h2 = el.querySelector('#tar-pane-h')
  if (h2 && h2.textContent !== tarea.titulo) h2.textContent = tarea.titulo
  const ahora = Date.now()
  const armado = !!t.armado && armadoVigente(t, t.armado.id, ahora) && t.armado.id === `tarea:${tarea.id}`
  const transcurrido = armado ? Math.max(0, MS_CONFIRMAR - (t.armado.hasta - ahora)) : 0
  const partes = c => partesDetalle({ lista, tarea, listas: t.listas, hoy: hoyTareas(), editandoSub: t.editandoSub, armado, transcurrido: c })
  const p = partes(transcurrido)
  const poner = (parte, html, f = html) => {
    const sub = el.querySelector(`[data-parte="${parte}"]`)
    if (!sub || firmas[parte] === f) return
    ponerParteConCampo(sub, html, 'input[data-campo], textarea[data-campo]')
    firmas[parte] = f
  }
  poner('det-tit', p.tit, `${tarea.id}|${!!tarea.hecha}`)
  poner('det-g', p.datos)
  poner('det-sub', p.subs)
  poner('det-notas', p.notas, tarea.id)
  poner('det-pie', p.pie, partes(0).pie)
}

/**
 * Abre la hoja de Tareas (la fila del menú, Ctrl T o el globo del aviso diario): acoplada, abre también
 * el panel. Solo la llama `irModulo` (modulos-ux.md 11.1), que ya cerró la configuración, la dividida y
 * la tira, y que con la hoja ya abierta solo lleva el foco al título. Al abrir se vuelven a leer las
 * listas (solo lectura). El foco va al `h1` (9.4).
 */
function abrirTareasHoja({ ver, foco = true } = {}) {
  if (st.tareas.abierta) return
  // El aviso diario se va si la hoja se abre, por el globo o por cualquier otro camino (8.1)
  st.avisoTar = soltarAviso(st.avisoTar)
  st.tareas = abrirTareas(st.tareas, ver)
  leerTareas()
  pintar()
  movimientoTareas.abrirHoja($('#marco .cab'), $('#tar-cuerpo'))
  if (st.acople) {
    evento({ tipo: 'clic' })
    if (foco) { st.focoPendiente = 'tar'; aplicarFoco() }
  } else if (foco) {
    $('#titulo').focus()
  }
}

/**
 * Cierra la hoja (solo desde `irModulo`): lo diferido se guarda antes. De vuelta en Sesiones el tablero
 * vuelve como estaba, con su acto (`acto`); hacia otra hoja, sin él. El foco lo pone `irModulo`.
 */
function cerrarTareasHoja({ acto = true } = {}) {
  if (!st.tareas.abierta) return
  diferidoTareas.todos()
  st.tareas = cerrarTareas(st.tareas)
  pintar()
  if (acto) movimientoConfig.cerrarHoja([$('#otro'), $('#w-globo'), $('#conteos'), ...document.querySelectorAll('#sesiones > .ses')])
}

/** Cambia de vista (el índice): el panel entra desde la derecha y el foco queda en el botón del índice (9.4). */
function verTareas(ver) {
  if (ver === st.tareas.ver && !st.tareas.det) return
  diferidoTareas.todos()
  st.tareas = cambiarVista(st.tareas, ver)
  pintarTareas()
  movimientoTareas.cambioVista($('#tar .pane'))
  const lista = $('#tar .tar-desplaza')
  if (lista) lista.scrollTop = 0
}

/**
 * Esc con la hoja abierta (9.1): vacía el campo con algo escrito, cancela renombrar o crear (el foco
 * vuelve a la fila de esa lista o a "Nueva lista"), desarma el "¿Borrar…? Sí" (el foco queda en el
 * botón) o cierra la hoja (el foco va a la fila de la barra).
 */
function escTareas(objetivo) {
  const campo = objetivo?.closest?.('#tar input[data-campo], #tar textarea[data-campo]')
  const antes = st.tareas
  const { tareas, accion } = alEscTareas(antes, campo ? { campo: campo.dataset.campo, texto: campo.value } : null)
  if (accion === 'vaciar') { campo.value = ''; return }
  // Sin capas, Esc va a Sesiones con el foco en su fila (modulos-ux.md 9.1)
  if (alEscModulo('tareas', accion) === 'sesiones') { irModulo('sesiones', { foco: 'fila' }); return }
  // La tarea abierta (capa 4): título y notas se guardan antes de cerrar; el foco va al cuerpo de su fila
  if (accion === 'cerrar-tarea') { cerrarTareaHoja(); return }
  st.tareas = tareas
  pintarTareas()
  if (accion === 'cancelar-lista') {
    const k = antes.renombrando ? `ix-${antes.renombrando}` : $('#tar [data-k="crear"]') ? 'crear' : 'nueva'
    $(`#tar [data-k="${CSS.escape(k)}"]`)?.focus()
  } else if (accion === 'cancelar-sub') {
    // El texto escrito se descarta y vuelve el de antes; el foco, a ese texto
    $(`#tar [data-k="${CSS.escape(`st-${antes.editandoSub}`)}"]`)?.focus()
  } else if (accion === 'desarmar') {
    $(`#tar [data-k="${antes.armado?.id?.startsWith('tarea:') ? 'borrar-tarea' : 'borrar-lista'}"]`)?.focus()
  }
}

// ---- el aviso diario (8 y 11.4)

/**
 * Después del primer `tareas_leer` que sale bien: se decide una sola vez si la mascota avisa hoy
 * (`evaluarAviso`). Si la hoja ya está abierta, el aviso no hace falta (8.1).
 */
function evaluarAvisoTareas() {
  if (st.avisoTar.evaluado) return
  const hoy = hoyTareas()
  st.avisoTar = evaluarAviso(st.avisoTar, { avisado: st.avisadoTar, hoy, cuentas: cuentas(st.tareas.listas, hoy) })
  if (st.tareas.abierta) st.avisoTar = soltarAviso(st.avisoTar)
}

/**
 * La forma de la ventana para la cola de globos (habitos-ux.md 8.2): la de `lugarGlobo` (globos.js), la
 * pregunta pendiente (tapa todos los globos, D-h5 y D-m4) y el módulo a la vista (con su hoja abierta,
 * el aviso de Tareas no hace falta; el recordatorio se ve igual).
 */
function formaGlobos() {
  return {
    fuera: st.fuera, mini: st.mini, chat: st.chat.abierta || hojaCerrando,
    arrastrando: !!st.arrastre?.activo || document.body.classList.contains('pildora'), acoplada: !!st.acople, abierta: st.vista,
    dividida: !!st.dividida.clave, barra: st.proyectos.length > 0 || st.modulo !== 'sesiones',
    pregunta: st.proyectos.some(p => preguntasPendientes(p).length > 0), hojaAbierta: st.modulo,
  }
}

/**
 * Pone al día la cola antes de dibujar (8.1): el aviso de Tareas está mientras siga pendiente y haya
 * algo que contar (lo de siempre de `lugarAviso`); cada recordatorio se va si su hábito quedó hecho por
 * cualquier camino, si se borró o a la medianoche (`recordatorioVigente`), salvo el que confirma «Hecho».
 */
function ordenarCola() {
  const hoy = hoyArgentina(Date.now())
  const c = cuentas(st.tareas.listas, hoy)
  st.globos = st.avisoTar.pendiente && c.hoy + c.vencidas > 0 ? encolar(st.globos, { tipo: 'tareas', clave: 'tareas' }) : quitar(st.globos, 'tareas')
  for (const a of st.globos) {
    if (a.tipo !== 'rec' || a.clave === st.confirmaGlobo?.clave) continue
    if (!recordatorioVigente(a, st.habitos.lista.find(h => h.id === a.id), hoy)) st.globos = quitar(st.globos, a.clave)
  }
}

/**
 * Lo que dibuja cada tipo en cada lugar (8.2): el aviso de Tareas con sus vistas de siempre (`globoMarca`,
 * `filaAviso`, `globoMuesca`) y el recordatorio con las suyas (`globoHab`, `filaAvisoHab`,
 * `globoMuescaHab`), con la confirmación de «Hecho» si es el que confirma. `accion` y `valor` son los del
 * botón de la muesca (uno solo para los dos: `#muesca-globo`). Sin datos (un hábito que ya no está), null.
 */
function vistaGlobo(aviso) {
  if (aviso.tipo === 'tareas') {
    const t = textoGlobo(cuentas(st.tareas.listas, hoyTareas()), horaGlobo(Date.now()))
    return t && { firma: JSON.stringify(t), marca: globoMarca(t), fila: filaAviso(t), muesca: globoMuesca(t), accion: 'tar-globo', valor: null, texto: t }
  }
  const h = aviso.tipo === 'rec' && st.habitos.lista.find(x => x.id === aviso.id)
  if (!h) return null
  const t = textosGlobo(aviso, h)
  const confirma = st.confirmaGlobo?.clave === aviso.clave ? textoHechoGlobo(h, aviso.dia) : null
  return {
    firma: JSON.stringify([t.globo, t.fila, t.muesca, t.progreso, confirma, h.color]), accion: 'hab-globo-ver', valor: h.id, texto: t,
    marca: globoHab(t, { id: h.id, color: h.color, confirma }), fila: filaAvisoHab(t, { id: h.id, confirma }), muesca: globoMuescaHab(t),
  }
}

/**
 * Dibuja el globo de arriba de la cola donde esté la mascota a la vista (habitos-ux.md 8.1 y 8.2): el
 * globo de la marca, la fila de la dividida o el globo de la muesca; en la tira, la bandeja, con la charla
 * abierta o con una pregunta pendiente, espera. Uno por vez: si llega uno de más prioridad, el que estaba
 * se va sin acto (vuelve después) y el nuevo entra con el suyo. La primera vez que se ve cada uno, el
 * anuncio (5.4) y, el de Tareas, `tareas.avisado` (8.1). Nada de esto abre nada: solo dibuja. Lo llama
 * `verAvis` (cada pintada y cada cambio de forma).
 */
function pintarGlobos() {
  ordenarCola()
  const a = globoActual(st.globos, formaGlobos())
  const v = a && vistaGlobo(a.aviso)
  const lugar = v ? a.lugar : null
  const clave = v ? a.aviso.clave : null
  const firma = v ? `${lugar}|${clave}|${v.firma}` : null
  const antes = st.lugarGlobo
  if (firma === st.firmaGlobo) {
    if (lugar === 'muesca') ubicarGloboMuesca()
    return
  }
  // Otro globo, o el mismo en otro lugar: entra con su acto. El mismo que cambia de texto, sin acto
  const entra = lugar !== antes || clave !== st.claveGlobo
  st.firmaGlobo = firma
  st.lugarGlobo = lugar
  st.claveGlobo = clave
  const marcaG = $('.marca .globo-tar')
  const filaG = $('#aviso-tar')
  const muescaG = $('#muesca-globo')
  // Lo que deja de verse se va sin acto (la ×, «Ver» y el fin de «Hecho» hacen el suyo antes, `sacarGlobo`)
  if (lugar !== 'marca' || entra) marcaG?.remove()
  if ((lugar !== 'dividida' || entra) && filaG.firstChild) filaG.innerHTML = ''
  if (lugar !== 'muesca') { muescaG.hidden = true; muescaG.innerHTML = ''; st.rectGloboMuesca = null }
  if (lugar === 'marca') {
    const el = $('.marca .globo-tar')
    if (el) el.outerHTML = v.marca
    else $('.marca').insertAdjacentHTML('beforeend', v.marca)
    if (entra) movimientoTareas.entraGlobo($('.marca .globo-tar'))
  } else if (lugar === 'dividida') {
    filaG.innerHTML = v.fila
    if (entra) movimientoTareas.entraGlobo(filaG.firstElementChild)
  } else if (lugar === 'muesca') {
    const nuevo = muescaG.hidden || entra
    muescaG.innerHTML = v.muesca.html
    muescaG.setAttribute('aria-label', v.muesca.nombre)
    muescaG.dataset.accion = v.accion
    if (v.valor) muescaG.dataset.valor = v.valor
    else delete muescaG.dataset.valor
    muescaG.hidden = false
    ubicarGloboMuesca()
    if (nuevo) movimientoTareas.entraGlobo(muescaG, st.acople?.borde)
  }
  if (lugar) verGlobo(a.aviso, v)
  if (antes === 'marca' || lugar === 'marca') pintarMarca()
}

/**
 * Un globo se ve: la primera vez, el anuncio «{mascota}: {texto}» (5.4). El de Tareas, además, guarda
 * `tareas.avisado` = hoy (un reinicio el mismo día no lo repite, 8.1); el recordatorio ya quedó en
 * `habitosRecordados` al salir (8.3).
 */
function verGlobo(aviso, v) {
  const nombre = datosEspecie(st.mascota).nombre
  if (aviso.tipo === 'tareas') {
    const { aviso: a, guardar } = verAviso(st.avisoTar)
    st.avisoTar = a
    if (guardar) {
      st.avisadoTar = guardar
      anunciar(anuncioGlobo(nombre, v.texto))
      invocar('guardar_ajuste', { clave: 'tareasAvisado', valor: guardar }).catch(e => registrar(`tareas: no se guardó el aviso: ${e}`))
    }
  } else if (!st.anunciados.has(aviso.clave)) {
    st.anunciados.add(aviso.clave)
    anunciar(anuncioGlobo(nombre, v.texto))
  }
}

/**
 * Ubica `#muesca-globo` del lado de adentro de la muesca (`lugarGloboMuesca`) y guarda su rectángulo
 * en px de pantalla para la zona interactiva (tareas-ux.md 8.5): el tamaño se mide (depende del texto).
 */
function ubicarGloboMuesca() {
  const el = $('#muesca-globo')
  const d = st.disp
  if (el.hidden || !st.acople || d?.modo !== 'acoplada') { st.rectGloboMuesca = null; return }
  const z = zoom()
  const local = lugarGloboMuesca(st.acople.borde, d.local.muesca, { ancho: el.offsetWidth, alto: el.offsetHeight }, { ancho: d.ventana.ancho / z, alto: d.ventana.alto / z })
  el.style.left = `${local.x}px`
  el.style.top = `${local.y}px`
  el.style.setProperty('--cola', `${local.cola}px`)
  st.rectGloboMuesca = absoluto(local, d.ventana, z)
}

/**
 * La × del globo o de la fila, o Esc en el globo (8 y 9.1): el aviso se va hasta mañana
 * (`tareas.avisado` ya quedó guardado al verse), con su acto de salida, el anuncio de 5.3 y el foco en
 * la fila "Tareas" de la barra (9.4); en la dividida, sin barra, en el primer botón del riel.
 */
async function descartarAvisoTareas() {
  if (!st.avisoTar.pendiente) return
  const el = $('.marca [data-globo-tar]') ?? $('#aviso-tar [data-globo-tar]')
  const tenia = el?.contains(document.activeElement)
  st.avisoTar = soltarAviso(st.avisoTar)
  if (el) await movimientoTareas.saleGlobo(el)
  verAvis()
  anunciar('Te lo recuerdo mañana')
  if (tenia || !document.activeElement || document.activeElement === document.body) {
    const fila = $('#tar-fila')
    if (fila.offsetParent) fila.focus()
    else $('#riel button')?.focus()
  }
}

// ---- el recordatorio de un hábito (habitos-ux.md 8.3, entrega H2)

/** Lo que dura la confirmación de «+1» o «Hecho» en el globo antes de irse sola (8.3). */
const CONFIRMA_GLOBO_MS = 1800
let relojConfirmaGlobo = null

/**
 * El ciclo de 1,5 s revisa los recordatorios (8.3), nunca un temporizador por hábito: cada hábito con
 * aviso que toca, no está hecho y ya pasó su hora entra a la cola una sola vez por día
 * (`habitosRecordados` en preferencias.json, así un reinicio el mismo día no lo repite). A la vez sale la
 * notificación de Windows (`avisar`, textos de 5.5) si «Avisar» está prendido (D-h13) y no llegó más de
 * 60 min tarde (D-h12: entonces solo el globo). Nada se abre solo.
 */
function revisarRecordatorios(ahora = Date.now()) {
  if (!st.habitos.leido) return
  const debidos = recordatoriosDebidos(st.habitos.lista, ahora, st.habRecordados)
  if (!debidos.length) return
  st.habRecordados = recordar(st.habRecordados, debidos.map(d => d.id), debidos[0].dia)
  if (validarAjuste('habitosRecordados', st.habRecordados)) {
    invocar('guardar_ajuste', { clave: 'habitosRecordados', valor: st.habRecordados }).catch(e => registrar(`hábitos: no se guardaron los recordados: ${e}`))
  }
  for (const d of debidos) {
    const aviso = { tipo: 'rec', clave: claveRec(d.id, d.dia), id: d.id, dia: d.dia, hora: d.hora }
    st.globos = encolar(st.globos, aviso)
    const h = st.habitos.lista.find(x => x.id === d.id)
    if (st.avisar && !d.tarde && h) {
      const n = textosGlobo(aviso, h).notificacion
      invocar('avisar', { titulo: n.titulo, cuerpo: n.cuerpo }).catch(e => registrar(`hábitos: no salió la notificación: ${e}`))
    }
  }
  verAvis()
}

/**
 * «+1 {unidad}» o «Hecho» del globo o de la fila (8.3): marca hoy sin abrir nada, como la hoja
 * (`cambiarHabito`, que guarda). El globo confirma con el texto de 5.4 durante 1,8 s (la mascota feliz) y
 * se va solo, aunque el «+1» no llegue a la meta (ya respondiste). El foco va a la × del globo (9.4).
 */
function hacerDesdeGlobo(id) {
  const hoy = hoyHabitos()
  const aviso = st.globos.find(a => a.tipo === 'rec' && a.id === id && a.dia === hoy)
  const h = st.habitos.lista.find(x => x.id === id)
  if (!aviso || !h || st.confirmaGlobo) return
  const cantidad = h.tipo === 'cantidad'
  // Antes de marcar: el globo que confirma no se va aunque el hábito ya esté hecho (`ordenarCola`)
  st.confirmaGlobo = { clave: aviso.clave, id }
  const fx = st.habitos.abierta ? (cantidad ? { tipo: 'suma', d: 1, dia: hoy } : { tipo: 'tilde', dia: hoy }) : null
  const r = cambiarHabito(id, x => (cantidad ? sumarHabito(x, hoy, 1) : marcarHabito(x, hoy, true)), fx)
  if (!r) { st.confirmaGlobo = null; verAvis(); return }
  anunciar(plano(textoHechoGlobo(r.despues, hoy)))
  if (st.habitos.abierta) trasMarcarHoy(r, () => $(`#hab [data-k="${cantidad ? 'sum' : 'ck'}-${CSS.escape(id)}"]`))
  $('[data-globo-hab] [data-accion="hab-globo-x"]')?.focus()
  clearTimeout(relojConfirmaGlobo)
  relojConfirmaGlobo = setTimeout(() => { if (st.confirmaGlobo?.clave === aviso.clave) sacarGlobo(aviso.clave) }, CONFIRMA_GLOBO_MS)
}

/**
 * Saca un globo de la cola (la ×, el fin de «Hecho»), con su acto de salida si está a la vista en la
 * marca o en la dividida. Si el foco estaba en él (o en ningún lado), va al siguiente globo o, si no hay,
 * a la fila «Hábitos» del menú; en la dividida, sin barra, al primer botón del riel (9.4).
 */
async function sacarGlobo(clave) {
  const el = st.claveGlobo === clave ? ($('.marca [data-globo-hab]') ?? $('#aviso-tar [data-globo-hab]')) : null
  const tenia = !!el?.contains(document.activeElement)
  if (st.confirmaGlobo?.clave === clave) { st.confirmaGlobo = null; clearTimeout(relojConfirmaGlobo) }
  st.globos = quitar(st.globos, clave)
  if (el) await movimientoTareas.saleGlobo(el)
  verAvis()
  if (tenia || !document.activeElement || document.activeElement === document.body) {
    const siguiente = $('.marca .globo-tar button, #aviso-tar button')
    const fila = $('#hab-fila')
    if (siguiente) siguiente.focus()
    else if (fila?.offsetParent) fila.focus()
    else $('#riel button')?.focus()
  }
}

/** La × del recordatorio, o Esc en su globo (9.1): «Ahora no», no vuelve hasta mañana (ya está en `habitosRecordados`). */
function descartarRecordatorio(id) {
  const a = st.globos.find(x => x.tipo === 'rec' && x.id === id)
  if (a) sacarGlobo(a.clave)
}

/** «Ver hábitos →» (o el globo de la muesca): el recordatorio se va y solo el clic abre la hoja en Hoy (8.3). */
async function verDesdeGlobo(id) {
  const a = st.globos.find(x => x.tipo === 'rec' && x.id === id)
  if (a) {
    if (st.confirmaGlobo?.clave === a.clave) { st.confirmaGlobo = null; clearTimeout(relojConfirmaGlobo) }
    st.globos = quitar(st.globos, a.clave)
  }
  if (st.habitos.abierta && st.habitos.ver !== 'hoy') verHabitosEnHoja('hoy')
  await irModulo('habitos', { ver: 'hoy' })
  verAvis()
}

// ---- leer y guardar (11.3)

let leyendoTareas = null
/**
 * Lee las listas (`tareas_leer`, solo lectura): al arrancar (la cuenta de la barra), al abrir la hoja
 * y con "Volver a leer". Si tarda más de 150 ms, la primera vez, el panel muestra las filas fantasma
 * (7.1). Las listas que no se pudieron guardar siguen como están en pantalla (7.4).
 */
function leerTareas() {
  if (!tauri?.core) return null
  if (leyendoTareas) return leyendoTareas
  st.tareas = { ...st.tareas, cargando: true }
  const reloj = setTimeout(() => {
    if (!st.tareas.cargando || st.tareas.leido) return
    st.tareas = { ...st.tareas, fantasmas: true }
    pintarTareas()
  }, 150)
  leyendoTareas = (async () => {
    try {
      const r = await invocar('tareas_leer')
      const listas = Array.isArray(r?.listas) ? r.listas : []
      const rotas = Array.isArray(r?.rotas) ? r.rotas.filter(x => typeof x?.archivo === 'string') : []
      st.tareas = { ...st.tareas, listas: mezclarLectura(listas, st.tareas.listas, listasSinGuardar()), rotas, leido: true, errorLeer: null }
      evaluarAvisoTareas()
    } catch (err) {
      registrar(`tareas: no se pudieron leer: ${err}`)
      st.tareas = { ...st.tareas, errorLeer: String(err?.message ?? err).slice(0, 120) || 'sin detalle' }
    } finally {
      clearTimeout(reloj)
      st.tareas = { ...st.tareas, cargando: false, fantasmas: false }
      leyendoTareas = null
      pintar()
    }
  })()
  return leyendoTareas
}

/** Por lista: el guardado en curso (`promesa`) y si hay que guardarla otra vez al terminar. */
const guardadosTareas = new Map()
/** Las listas cuyo último guardado falló: se reintentan a los 5 s o con "Reintentar ahora" (7.4). */
const fallidasTareas = new Set()
let relojReintentoTareas = null

/**
 * Las tareas movidas cuyo destino todavía no confirmó (11.3, `nuevaMudanza` de tareas.js): mientras
 * tanto su lista de origen se guarda con ellas (duplicadas, nunca perdidas).
 */
let mudanzasTareas = []

/** Las listas que no se pueden pisar con lo leído: las que fallaron, las que se están guardando y los orígenes de una mudanza. */
function listasSinGuardar() {
  return new Set([
    ...fallidasTareas, ...[...guardadosTareas].filter(([, g]) => g.enCurso).map(([id]) => id), ...mudanzasTareas.map(m => m.origen),
  ])
}

/**
 * Guarda una lista entera (`tareas_guardar`), de a una por vez por lista y siempre con lo último que hay
 * en pantalla (más las tareas que salieron de ella y su destino no confirmó, `listaParaGuardar`). Si
 * falla, lo de la pantalla queda, el error de 7.4 aparece (y se anuncia), se anota en widget.log y se
 * reintenta solo a los 5 s; se va al primer guardado bueno. Cada guardado lleva su número (`n`): uno
 * bueno que empezó después de mover suelta la mudanza y guarda el origen sin la tarea.
 */
function guardarListaTareas(id) {
  let g = guardadosTareas.get(id)
  if (!g) { g = { enCurso: false, otraVez: false, promesa: null, n: 0 }; guardadosTareas.set(id, g) }
  if (g.enCurso) { g.otraVez = true; return g.promesa }
  g.enCurso = true
  g.promesa = (async () => {
    do {
      g.otraVez = false
      const lista = listaParaGuardar(st.tareas.listas, id, mudanzasTareas)
      if (!lista) { fallidasTareas.delete(id); break }
      const n = ++g.n
      let r
      try { r = await invocar('tareas_guardar', { lista }) } catch (err) { r = { ok: false, error: String(err?.message ?? err) } }
      if (r?.ok) {
        fallidasTareas.delete(id)
        const s = soltarMudanzas(mudanzasTareas, id, n)
        mudanzasTareas = s.mudanzas
        for (const origen of s.origenes) guardarListaTareas(origen)
      } else {
        fallidasTareas.add(id)
        registrar(`tareas: no se guardó ${id}: ${r?.error ?? 'sin detalle'}`)
      }
    } while (g.otraVez)
    g.enCurso = false
    ponerErrorGuardar()
  })()
  return g.promesa
}

/** El error de 7.4 según lo que quedó sin guardar; con algo pendiente, el reintento a los 5 s. */
function ponerErrorGuardar() {
  const error = fallidasTareas.size > 0
  if (error && !st.tareas.errorGuardar) decirTareas('No se guardó el último cambio')
  if (error !== st.tareas.errorGuardar) { st.tareas = { ...st.tareas, errorGuardar: error }; pintarTareas() }
  clearTimeout(relojReintentoTareas)
  if (error) relojReintentoTareas = setTimeout(reintentarTareas, 5000)
}

/** "Reintentar ahora" o el reintento solo (7.4): vuelve a guardar lo que falló. */
function reintentarTareas() {
  clearTimeout(relojReintentoTareas)
  for (const id of [...fallidasTareas]) guardarListaTareas(id)
}

/** Cambia una lista en pantalla (`f` devuelve la nueva, o null si no hay nada que hacer) y la guarda al instante. */
function cambiarListaTareas(id, f) {
  const lista = st.tareas.listas.find(l => l.id === id)
  const nueva = lista && f(lista)
  if (!nueva) return null
  st.tareas = { ...st.tareas, listas: st.tareas.listas.map(l => (l.id === id ? nueva : l)) }
  guardarListaTareas(id)
  return nueva
}

// ---- acciones

/** Un anuncio en la región `role=status` de la hoja (5.3), como `decirConfig`: vacía antes, así se vuelve a oír. */
let anuncioTareasEn = null
function decirTareas(mensaje) {
  const el = $('#tar-vivo')
  if (!el || !mensaje) return
  el.textContent = ''
  clearTimeout(anuncioTareasEn)
  anuncioTareasEn = setTimeout(() => { el.textContent = mensaje }, 150)
}

/** Enter en el campo de nueva tarea (4.4): vacío no hace nada; en Hoy va a la primera lista con fecha de hoy. */
function agregarEnHoja(campo) {
  const t = st.tareas
  const titulo = validarTitulo(campo.value)
  if (!titulo) return
  const paraHoy = t.ver === 'hoy'
  const destino = paraHoy ? listaParaHoy(t.listas) : t.listas.find(l => l.id === t.ver)
  if (!destino) return
  const ahora = Date.now()
  const id = nuevoId('t', ahora, Math.random, new Set(t.listas.flatMap(l => l.tareas.map(x => x.id))))
  if (!cambiarListaTareas(destino.id, l => agregarTarea(l, titulo, { id, ahora, fecha: paraHoy ? hoyTareas() : null }))) return
  campo.value = ''
  st.tareas = { ...st.tareas, recien: id }
  pintar()
  st.tareas = { ...st.tareas, recien: null }
  movimientoTareas.entraFila($(`#tar .fila[data-id="${CSS.escape(id)}"]`))
  decirTareas(anuncioAgregada(destino.nombre, paraHoy))
  // El foco queda en el campo, vacío (9.4)
  $('#tar [data-k="nueva"]')?.focus({ preventScroll: true })
}

/** La mascota de 40 festeja 1,5 s y salta (4.10). */
let relojFelizTareas = null
function festejarTareas() {
  st.tareas = { ...st.tareas, feliz: true }
  pintarTareas()
  movimientoTareas.salto($('#tar-mini > .avi'))
  clearTimeout(relojFelizTareas)
  relojFelizTareas = setTimeout(() => { st.tareas = { ...st.tareas, feliz: false }; pintarTareas() }, 1500)
}

const esperar = ms => new Promise(r => setTimeout(r, ms))

/**
 * El tilde de una fila (10): tildar se guarda al instante, el círculo rebota, el visto se dibuja, la
 * raya tacha, saltan chispas, la mascota festeja y, a los 700 ms, la fila se pliega hacia "Hechas" (sin
 * movimiento, 350 ms y sin pliegue). El foco va al tilde de la fila siguiente (9.4). Destildar vuelve a
 * pendientes al instante.
 */
async function tildarEnHoja(b) {
  const id = b.dataset.valor
  const listaId = b.dataset.lista
  const tarea = st.tareas.listas.find(l => l.id === listaId)?.tareas.find(x => x.id === id)
  if (!tarea || tildando.has(id)) return
  if (tarea.hecha) {
    cambiarListaTareas(listaId, l => tildarTarea(l, id, false, Date.now()))
    pintar()
    decirTareas(`«${tarea.titulo}» vuelve a pendientes`)
    $(`#tar [data-k="${CSS.escape(`ck-${id}`)}"]`)?.focus({ preventScroll: true })
    return
  }
  const fila = b.closest('.fila')
  const orden = [...document.querySelectorAll('#tar .filas:not(.hechas-l) > .fila')].map(li => li.dataset.id)
  const foco = focoTrasTildar(orden, id)
  tildando.add(id)
  b.setAttribute('aria-checked', 'true')
  fila?.classList.add('tildando')
  cambiarListaTareas(listaId, l => tildarTarea(l, id, true, Date.now()))
  movimientoTareas.chispas(fila)
  festejarTareas()
  decirTareas(`Hecha: ${tarea.titulo}`)
  const { espera, pliega } = tiempoTilde(movimientoTareas.modo())
  await esperar(espera)
  if (pliega) await movimientoTareas.plegarFila(fila)
  tildando.delete(id)
  pintar()
  const destino = $(`#tar [data-k="${CSS.escape(foco)}"]`) ?? $('#tar [data-k="nueva"]') ?? $('#titulo')
  destino?.focus({ preventScroll: true })
}

/** "Nueva lista": el campo en su lugar del índice, con el foco. */
function empezarListaTareas() {
  st.tareas = { ...st.tareas, creando: true, renombrando: null, errorLista: null }
  pintarTareas()
  $('#tar [data-k="lista-in"]')?.focus()
}

/**
 * Crea una lista (Enter en el campo, una sugerida del primer uso): nombre válido y sin repetir (D-n4),
 * el color siguiente, un id que no es de ninguna lista ni de un archivo roto. La abre con el foco en
 * "Agregar a {lista}…" (9.4).
 */
function crearListaEnHoja(nombre) {
  const t = st.tareas
  const r = validarNombreLista(nombre, t.listas)
  if (!r.ok) {
    const error = textoErrorLista(r)
    if (error !== t.errorLista) { st.tareas = { ...t, errorLista: error }; pintarTareas() }
    return
  }
  const ahora = Date.now()
  const usados = new Set([...t.listas.map(l => l.id), ...t.rotas.map(x => x.archivo.replace(/\.json$/, ''))])
  const lista = nuevaLista(t.listas, r.nombre, { id: nuevoId('l', ahora, Math.random, usados), ahora })
  st.tareas = cambiarVista({ ...t, listas: [...t.listas, lista] }, lista.id)
  guardarListaTareas(lista.id)
  pintar()
  movimientoTareas.cambioVista($('#tar .pane'))
  decirTareas(`Lista «${lista.nombre}» creada`)
  $('#tar [data-k="nueva"]')?.focus()
}

/** "Renombrar": el campo en la fila del índice (D-n5), con el nombre seleccionado. */
function empezarRenombrarTareas(id) {
  st.tareas = { ...st.tareas, renombrando: id, creando: false, errorLista: null, armado: null }
  pintarTareas()
  const campo = $('#tar [data-k="ren-in"]')
  campo?.focus()
  campo?.select()
}

/** Enter al renombrar: el mismo nombre solo cierra el campo; uno repetido lo dice; vacío no hace nada. El foco vuelve a la fila. */
function renombrarEnHoja(nombre) {
  const t = st.tareas
  const id = t.renombrando
  const lista = t.listas.find(l => l.id === id)
  if (!lista) return
  const r = validarNombreLista(nombre, t.listas, id)
  if (!r.ok) {
    const error = textoErrorLista(r)
    if (error !== t.errorLista) { st.tareas = { ...t, errorLista: error }; pintarTareas() }
    return
  }
  st.tareas = { ...t, renombrando: null, errorLista: null }
  if (r.nombre !== lista.nombre) {
    cambiarListaTareas(id, l => renombrarLista(l, r.nombre))
    decirTareas(`Ahora se llama «${r.nombre}»`)
  }
  pintar()
  $(`#tar [data-k="${CSS.escape(`ix-${id}`)}"]`)?.focus()
}

let relojArmadoTareas = null
/** El "¿Borrar…? Sí" vuelve solo a los 3 s (4.8), como `vigilarArmado` de la configuración. */
function vigilarArmadoTareas() {
  clearTimeout(relojArmadoTareas)
  const a = st.tareas.armado
  if (!a) return
  relojArmadoTareas = setTimeout(() => {
    const t = desarmarVencido(st.tareas, Date.now())
    if (t === st.tareas) return vigilarArmadoTareas()
    st.tareas = t
    pintarTareas()
  }, Math.max(0, a.hasta - Date.now()) + 20)
}

/**
 * "Borrar lista" (4.8): el primer clic arma "¿Borrar con 6 tareas? Sí" 3 s; el segundo borra el
 * archivo con todas sus tareas, una sola vez (después de su guardado en curso, así no vuelve a
 * aparecer). El foco va a "Hoy" del índice (9.4). Si Rust no pudo, la lista queda y se anuncia.
 */
async function clicBorrarListaTareas(id) {
  const { config, ejecutar } = clicBorrar(st.tareas, `lista:${id}`, Date.now())
  st.tareas = config
  vigilarArmadoTareas()
  pintarTareas()
  if (!ejecutar) return
  const lista = st.tareas.listas.find(l => l.id === id)
  if (!lista) return
  await guardadosTareas.get(id)?.promesa
  let r
  try { r = await invocar('tareas_borrar_lista', { id }) } catch (err) { r = { ok: false, error: String(err?.message ?? err) } }
  if (!r?.ok) {
    registrar(`tareas: no se borró ${id}: ${r?.error ?? 'sin detalle'}`)
    decirTareas('No se guardó el último cambio')
    return
  }
  fallidasTareas.delete(id)
  guardadosTareas.delete(id)
  st.tareas = cambiarVista({ ...st.tareas, listas: st.tareas.listas.filter(l => l.id !== id) }, 'hoy')
  // Sus mudanzas (11.3) se olvidan: las que iban a ella se borraron con la lista, así que sus orígenes
  // se guardan sin ellas; las que salieron de ella ya no tienen archivo de origen
  const sueltas = mudanzasTareas.filter(m => m.origen === id || m.destino === id)
  mudanzasTareas = mudanzasTareas.filter(m => !sueltas.includes(m))
  for (const origen of new Set(sueltas.filter(m => m.destino === id).map(m => m.origen))) guardarListaTareas(origen)
  ponerErrorGuardar()
  pintar()
  decirTareas(anuncioBorradaLista(lista.nombre, lista.tareas.length))
  ;($('#tar [data-k="ix-hoy"]') ?? $('#tar [data-k="primer-in"]') ?? $('#titulo'))?.focus()
}

/** "Hechas · n" (4.9): se despliega con sus filas bajando; el foco queda en el botón. */
function alternarHechasTareas() {
  st.tareas = { ...st.tareas, hechas: !st.tareas.hechas }
  pintarTareas()
  if (st.tareas.hechas) movimientoTareas.abrirHechas(document.querySelectorAll('#tar .hechas-l .fila'))
}

// ---- la tarea abierta (4.7, entrega 2)

/**
 * Título y notas se guardan 600 ms después de dejar de escribir y al salir del campo (11.3), con el
 * guardado de siempre (`guardarListaTareas`, con su reintento de 7.4): no hay otro camino a `tareas_guardar`.
 */
const diferidoTareas = diferirGuardado(id => guardarListaTareas(id))

/** La tarea abierta y su lista, o null. */
const detalleAbierto = () => (st.tareas.det ? buscarTarea(st.tareas.listas, st.tareas.det) : null)

/** Pone el foco en una pieza de la hoja (`data-k`), con el cursor al final si es un campo. */
function enfocarTareas(k, { alFinal = false } = {}) {
  const el = $(`#tar [data-k="${CSS.escape(k)}"]`)
  if (!el) return false
  el.focus({ preventScroll: false })
  if (alFinal && typeof el.value === 'string') { try { el.setSelectionRange(el.value.length, el.value.length) } catch { /* sin selección */ } }
  return true
}

/** El cuerpo de una fila abre su tarea en el lugar de la lista (B): los hijos del panel entran desde la derecha; el foco, a su título (9.4). */
function abrirTareaHoja(id) {
  if (!buscarTarea(st.tareas.listas, id)) return
  st.tareas = abrirDetalle(st.tareas, id)
  pintarTareas()
  const lista = $('#tar .tar-desplaza')
  if (lista) lista.scrollTop = 0
  movimientoTareas.abrirTarea($('#tar .pane'))
  enfocarTareas(`tit-${id}`, { alFinal: true })
}

/** "‹ {vista}" o Esc: guarda lo pendiente, la lista vuelve con el acto de cambiar de vista y el foco va al cuerpo de su fila (9.4). */
function cerrarTareaHoja() {
  const id = st.tareas.det
  if (!id) return
  diferidoTareas.todos()
  st.tareas = cerrarDetalle(st.tareas)
  pintarTareas()
  movimientoTareas.cambioVista($('#tar .pane'))
  if (!enfocarTareas(`ab-${id}`) && !enfocarTareas('nueva')) $('#titulo').focus()
}

/** Cambia la tarea abierta en pantalla y la guarda al instante (Vence, Prioridad: todo lo que no es título ni notas). */
function cambiarDetalleTareas(cambios) {
  const d = detalleAbierto()
  if (!d) return
  cambiarListaTareas(d.lista.id, l => editarTarea(l, d.tarea.id, cambios))
  pintar()
}

/**
 * Lo que se escribe en el título o las notas va a `st` en cada `input` (3.5) y se guarda 600 ms después
 * del último. El título vacío deja el anterior en `st` (al salir del campo vuelve, 4.7); el `h2` oculto lo sigue.
 */
function escribirDetalleTareas(campo) {
  const d = detalleAbierto()
  if (!d) return
  if (campo.dataset.campo === 'titulo' && /[\r\n]/.test(campo.value)) {
    const pos = campo.selectionStart
    campo.value = campo.value.replace(/[\r\n]+/g, ' ')
    try { campo.setSelectionRange(pos, pos) } catch { /* sin selección */ }
  }
  const cambios = campo.dataset.campo === 'titulo' ? { titulo: campo.value } : { notas: campo.value }
  st.tareas = { ...st.tareas, listas: st.tareas.listas.map(l => (l.id === d.lista.id ? editarTarea(l, d.tarea.id, cambios) : l)) }
  const h2 = $('#tar-pane-h')
  const titulo = buscarTarea(st.tareas.listas, d.tarea.id)?.tarea.titulo
  if (h2 && titulo && h2.textContent !== titulo) h2.textContent = titulo
  diferidoTareas.programar(d.lista.id)
}

/** Al salir del título o las notas (y Enter en el título): un título vacío vuelve al anterior y lo pendiente se guarda ya. */
function salirCampoDetalle(campo) {
  const d = detalleAbierto()
  if (!d) return
  if (campo.dataset.campo === 'titulo' && campo.value !== d.tarea.titulo && !campo.value.trim()) campo.value = d.tarea.titulo
  diferidoTareas.ya(d.lista.id)
}

/** El tilde de la tarea abierta: se guarda al instante; tildada, el círculo rebota, el título se tacha y la mascota festeja (sin pliegue). */
function tildarDetalleTareas() {
  const d = detalleAbierto()
  if (!d) return
  const hecha = !d.tarea.hecha
  cambiarListaTareas(d.lista.id, l => tildarTarea(l, d.tarea.id, hecha, Date.now()))
  pintar()
  if (hecha) {
    $('#tar .det-tit')?.classList.add('tildando')
    festejarTareas()
    decirTareas(`Hecha: ${d.tarea.titulo}`)
  } else {
    decirTareas(`«${d.tarea.titulo}» vuelve a pendientes`)
  }
}

/**
 * "Lista" (4.7): mueve la tarea abierta a otra lista. Guarda primero la de destino; la de origen, cuando
 * el destino confirmó (y mientras tanto, si se guarda, con la tarea): si algo falla queda duplicada,
 * nunca perdida, y lo muestra el error de 7.4 (11.3). En pantalla queda una sola copia.
 */
function moverEnHoja(destinoId) {
  const d = detalleAbierto()
  if (!d) return
  const r = moverTarea(st.tareas.listas, d.tarea.id, destinoId)
  if (!r) return
  mudanzasTareas = nuevaMudanza(mudanzasTareas, { tarea: d.tarea.id, origen: r.origen, destino: r.destino, desde: guardadosTareas.get(r.destino)?.n ?? 0 })
  st.tareas = { ...st.tareas, listas: r.listas }
  guardarListaTareas(r.destino)
  pintar()
  decirTareas(`Movida a ${r.listas.find(l => l.id === r.destino)?.nombre ?? ''}`)
}

/** "¿Borrar? Sí" (4.8): el primer clic arma 3 s; el segundo borra la tarea una vez y el foco va al campo de nueva tarea (9.4). */
function clicBorrarTareaHoja(id) {
  const { config, ejecutar } = clicBorrar(st.tareas, `tarea:${id}`, Date.now())
  st.tareas = config
  vigilarArmadoTareas()
  pintarTareas()
  if (!ejecutar) return
  const d = buscarTarea(st.tareas.listas, id)
  if (!d) return
  const o = olvidarMudanzas(mudanzasTareas, id)
  mudanzasTareas = o.mudanzas
  st.tareas = cerrarDetalle(st.tareas)
  cambiarListaTareas(d.lista.id, l => borrarTarea(l, id))
  for (const origen of o.origenes) guardarListaTareas(origen)
  pintar()
  movimientoTareas.cambioVista($('#tar .pane'))
  decirTareas(`Borraste «${d.tarea.titulo}»`)
  if (!enfocarTareas('nueva') && !enfocarTareas(`ix-${st.tareas.ver}`)) $('#titulo').focus()
}

/** Enter en "Agregar una subtarea": vacío o con 50 no hace nada; el foco queda en el campo, vacío. */
function agregarSubEnHoja(campo) {
  const d = detalleAbierto()
  if (!d || (d.tarea.subtareas ?? []).length >= MAX_SUBTAREAS) return
  const subId = nuevoId('s', Date.now(), Math.random, new Set((d.tarea.subtareas ?? []).map(s => s.id)))
  if (!cambiarListaTareas(d.lista.id, l => agregarSubtarea(l, d.tarea.id, campo.value, subId))) return
  campo.value = ''
  pintar()
}

/** El tilde de una subtarea: el cuadro rebota y la mascota festeja (sin chispas ni pliegue, 10). */
function tildarSubEnHoja(subId) {
  const d = detalleAbierto()
  const sub = d?.tarea.subtareas?.find(s => s.id === subId)
  if (!sub) return
  cambiarListaTareas(d.lista.id, l => tildarSubtarea(l, d.tarea.id, subId, !sub.hecha))
  pintar()
  if (!sub.hecha) {
    $(`#tar .subs li[data-id="${CSS.escape(subId)}"]`)?.classList.add('tildando')
    festejarTareas()
    decirTareas(`Hecha: ${sub.titulo}`)
  } else {
    decirTareas(`«${sub.titulo}» vuelve a pendientes`)
  }
}

/** El clic en el texto de una subtarea lo vuelve un campo (4.7), con el cursor al final. */
function empezarSubEnHoja(subId) {
  st.tareas = { ...st.tareas, editandoSub: subId }
  pintarTareas()
  enfocarTareas(`sub-ed-${subId}`, { alFinal: true })
}

/**
 * Enter o salir del campo de una subtarea: guarda el texto; vacío, la borra (D-n2). `foco`: con Enter,
 * el foco vuelve a su texto (o al campo de agregar, si se borró).
 */
function confirmarSubEnHoja(subId, texto, { foco = true } = {}) {
  const d = detalleAbierto()
  if (!d || st.tareas.editandoSub !== subId) return
  st.tareas = { ...st.tareas, editandoSub: null }
  const sub = d.tarea.subtareas?.find(s => s.id === subId)
  if (sub && validarTitulo(texto) !== sub.titulo) cambiarListaTareas(d.lista.id, l => editarSubtarea(l, d.tarea.id, subId, texto))
  pintar()
  if (foco && !enfocarTareas(`st-${subId}`)) enfocarTareas('sub-in')
}

/** Los botones de la hoja de Tareas (`data-accion="tar-…"`). Un clic en otra cosa desarma el "¿Borrar…? Sí" (4.8). */
async function accionTareas(a, b) {
  if (st.tareas.armado && a !== 'tar-borrar-lista' && a !== 'tar-borrar-tarea') {
    st.tareas = { ...st.tareas, armado: null }
    pintarTareas()
  }
  switch (a) {
    case 'tar-abrir': await irModulo('tareas'); break
    // El globo del aviso diario (8): solo el clic abre la hoja en Hoy; la × lo deja para mañana.
    // En la marca el globo es parte de lo que se arrastra: después de un arrastre real, el clic no cuenta
    case 'tar-globo': if (!justoArrastro) await irModulo('tareas', { ver: 'hoy' }); break
    case 'tar-globo-x': if (!justoArrastro) descartarAvisoTareas(); break
    // «‹ Tablero» se fue (modulos-ux.md 11.1): la acción queda como alias de ir a Sesiones
    case 'tar-cerrar': await irModulo('sesiones'); break
    case 'tar-ver': verTareas(b.dataset.valor); break
    case 'tar-crear': empezarListaTareas(); break
    case 'tar-sugerida': crearListaEnHoja(b.dataset.valor); break
    case 'tar-renombrar': empezarRenombrarTareas(b.dataset.valor); break
    case 'tar-borrar-lista': await clicBorrarListaTareas(b.dataset.valor); break
    case 'tar-tildar': await tildarEnHoja(b); break
    case 'tar-hechas': alternarHechasTareas(); break
    // La tarea abierta (4.7): todo lo que no es título ni notas se guarda en el clic
    case 'tar-abrir-tarea': abrirTareaHoja(b.dataset.valor); break
    case 'tar-cerrar-tarea': cerrarTareaHoja(); break
    case 'tar-tildar-det': tildarDetalleTareas(); break
    case 'tar-fecha': cambiarDetalleTareas({ fecha: fechaDeOpcion(b.dataset.valor, hoyTareas()) }); break
    case 'tar-prio': cambiarDetalleTareas({ importante: b.dataset.valor === 'imp' }); break
    case 'tar-tildar-sub': tildarSubEnHoja(b.dataset.valor); break
    case 'tar-editar-sub': empezarSubEnHoja(b.dataset.valor); break
    case 'tar-borrar-tarea': clicBorrarTareaHoja(b.dataset.valor); break
    case 'tar-reintentar': reintentarTareas(); break
    // "Abrir la carpeta" (7.6): Rust abre siempre `<config>/tareas/`, nunca una ruta de la ventana
    case 'tar-carpeta': invocar('tareas_abrir_carpeta').catch(err => registrar(`tareas: no se pudo abrir la carpeta: ${err}`)); break
    case 'tar-releer': await leerTareas(); break
    // La línea de la pregunta de la hoja ya no se dibuja (la reemplaza #aviso-p, modulos-ux.md 4.5): el alias hace lo mismo
    case 'tar-pregunta': await responderDesdeAviso(st.proyectos.findIndex(p => preguntasPendientes(p).length)); break
  }
}

/** Los botones de la hoja (`data-accion="cfg-…"`). Cada uno hace solo lo suyo, y solo con el clic. */
async function accionConfiguracion(a, b) {
  switch (a) {
    case 'cfg-abrir': await irModulo('config', { tab: b.dataset.tab }); break
    // «‹ Tablero» se fue (modulos-ux.md 11.1): la acción queda como alias de ir a Sesiones
    case 'cfg-cerrar': await irModulo('sesiones'); break
    case 'cfg-tab': cambiarPestanaConfig(b.dataset.valor); break
    case 'cfg-sw': {
      const clave = b.dataset.valor
      if (clave === 'arranque') await ponerArranqueConfig(!st.arranque)
      else await guardarAjusteConfig(clave, !st[clave])
      break
    }
    case 'cfg-tam':
      st.config = { ...st.config, error: null }
      try {
        await invocar('cambiar_tamano', { direccion: Number(b.dataset.valor) })
      } catch (err) {
        registrar(`configuración: tamaño: ${err}`)
        st.config = { ...st.config, error: 'tamano' }
        pintarConfiguracion()
      }
      break
    case 'cfg-ubic': await ubicarConfig(b.dataset.valor); break
    case 'cfg-esp': await elegirEspecieConfig(b.dataset.valor); break
    case 'cfg-forma': cambiarFormaConfig(b.dataset.valor); break
    case 'cfg-local':
      // El modelo local (7.2): bajarlo sin abrir la hoja de la charla ni mandarle nada al terminar, o
      // borrarlo con el segundo clic
      if (b.dataset.valor === 'descargar') {
        st.config = { ...st.config, error: null }
        if (descargaDesdeConfig(st.chat)) await descargarModelo('configuración')
      } else if (b.dataset.valor === 'borrar') await clicBorrarModelo()
      break
    case 'cfg-mod':
      // "Prender" corre el paso activar de primeros pasos (el mismo botón del asistente); sin Claude
      // Code o sin el mod, "Abrir primeros pasos"
      if (b.dataset.valor === 'activar') await correrPaso('activar')
      else if (b.dataset.valor === 'pp') abrirAsistente({ foco: true })
      break
    case 'cfg-pp': abrirAsistente({ foco: true }); break
    case 'cfg-motor': await elegirMotorConfig(b.dataset.valor); break
    case 'cfg-modelo': await elegirModeloConfig(b.dataset.valor); break
    case 'cfg-hist': await clicHistorialConfig(b.dataset.valor); break
    case 'cfg-clave-agregar': abrirCampoClave(b.dataset.valor); break
    case 'cfg-clave-cancelar': cancelarClave(); break
    case 'cfg-clave-ver':
      // "Mostrar"/"Ocultar": el campo se redibuja con su texto (ponerParteConCampo) y el foco sigue en el botón
      st.config = { ...st.config, ver: !st.config.ver }
      pintarConfiguracion()
      break
    case 'cfg-clave-guardar': await guardarClaveConfig(b.dataset.valor); break
    case 'cfg-clave-probar': await probarClaveConfig(b.dataset.valor); break
    case 'cfg-clave-borrar': await clicBorrarClave(b.dataset.valor); break
    // La línea de la pregunta de la hoja ya no se dibuja (la reemplaza #aviso-p, modulos-ux.md 4.5): el alias hace lo mismo
    case 'cfg-ver': await responderDesdeAviso(st.proyectos.findIndex(p => preguntasPendientes(p).length)); break
  }
}

/**
 * Teclado de la hoja (11): ← → Inicio Fin entre pestañas (activación automática); en los segmentos,
 * ←↑ la anterior y →↓ la siguiente, que se elige al moverse (como un radio nativo). Devuelve si la usó.
 */
function teclaConfiguracion(e) {
  if (!st.config.abierta) return false
  const tab = e.target.closest?.('#cfg [role="tab"]')
  if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    cambiarPestanaConfig(pestanaSiguiente(st.config.tab, e.key), { foco: true })
    return true
  }
  const radio = e.target.closest?.('#cfg [role="radio"]')
  const tecla = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' }[e.key] ?? e.key
  if (radio && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(tecla)) {
    e.preventDefault()
    const grupo = [...radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')]
    const sig = grupo.find(x => x.dataset.valor === pestanaSiguiente(radio.dataset.valor, tecla, grupo.map(x => x.dataset.valor)))
    if (sig && sig !== radio) {
      sig.focus()
      sig.click()
    }
    return true
  }
  return false
}

/** Flechas, Inicio y Fin en los segmentos de la tarea abierta (9.3): mueven el foco y eligen, como `teclaConfiguracion`. */
function teclaTareas(e) {
  if (!st.tareas.abierta) return false
  return teclaRadios(e, '#tar')
}

/**
 * Las flechas, Inicio y Fin en un `radiogroup` de una hoja (`raiz`: '#tar' o '#hab'): eligen la opción
 * siguiente (como las pestañas de la configuración) y el foco la sigue. Devuelve si la tecla era suya.
 */
function teclaRadios(e, raiz) {
  const radio = e.target.closest?.(`${raiz} [role="radio"]`)
  const tecla = { ArrowDown: 'ArrowRight', ArrowUp: 'ArrowLeft' }[e.key] ?? e.key
  if (!radio || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(tecla)) return false
  e.preventDefault()
  const grupo = [...radio.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]')]
  const sig = grupo.find(x => x.dataset.valor === pestanaSiguiente(radio.dataset.valor, tecla, grupo.map(x => x.dataset.valor)))
  if (sig && sig !== radio) {
    sig.focus()
    sig.click()
  }
  return true
}

// ------------------------------------------------------------------ hábitos (#41, docs/diseno/habitos-ux.md)
// Reglas (2): todo se guarda al instante (no hay "Guardar"); lo que borra confirma en el mismo botón;
// nada se abre solo; el día es el de Argentina (un día sin hacer no corta nada hasta la medianoche) y los
// días que no tocan nunca cuentan como falta; un archivo roto nunca se toca (Rust tampoco lo deja). La
// hoja vive en #hab, en la columna principal, como Tareas. La ventana nunca arma rutas: manda el hábito
// entero a `habitos_guardar` y el id a `habitos_borrar`, y Rust valida el id antes de armar
// `<config>/habitos/<id>.json`.
// Entrega H1: los datos y la hoja. El recordatorio con su globo y su notificación (H2) y el resumen
// semanal (H3) no están: la hora del aviso se guarda, pero todavía nada avisa.

const hoyHabitos = () => hoyArgentina(Date.now())

/** La fila «Hábitos» del menú (4.1): la pista, «—» o el anillo, y su nombre accesible. El anillo late al cambiar la cuenta. */
function pintarFilaHabitos() {
  const c = st.habitos.leido ? cuentasHoy(st.habitos.lista, hoyHabitos()) : { hechos: 0, total: 0, habitos: 0 }
  const html = ladoFilaHabitos(c)
  if (st.habFirmas.fila !== html) {
    const cambio = st.habFirmas.fila != null
    $('#hab-fila-ct').innerHTML = html
    st.habFirmas.fila = html
    if (cambio) movimientoHabitos.latirChip($('#hab-fila .anillo-c'))
  }
  ponerNombre('#hab-fila', nombreFilaHabitos(c))
}

/** El encabezado con la hoja abierta: «Hábitos» y su bajada (5.1); la tira de repos es solo de Sesiones. */
function pintarHojaHabitos() {
  modoMarco('tablero')
  $('#marco').classList.remove('con-hoja')
  const hoy = hoyHabitos()
  texto('#titulo', 'Hábitos')
  $('#titulo').title = ''
  texto('#subtitulo', subtituloHabitos(cuentasHoy(st.habitos.lista, hoy), hoy))
  pintarHabitos()
}

/** ¿La vista existe todavía? Un hábito borrado o un archivo roto que se arregló vuelven a Hoy. */
function vistaHabitosValida(t) {
  if (t.ver === 'hoy' || t.ver === 'semana' || t.ver === 'nuevo') return true
  if (String(t.ver).startsWith('rota:')) return t.rotas.some(r => `rota:${r.archivo}` === t.ver)
  return t.lista.some(h => h.id === t.ver)
}

/** El acto de un solo dibujo (el tilde, el vaso, la celda, 10): lo lleva el dibujo de ese cambio y no cuenta para la firma. */
let fxHabitos = null

/**
 * Dibuja la hoja en #hab por partes (3.5): el esqueleto una vez; el primer uso, el error de la carpeta o
 * la carpeta; y en la carpeta el índice, el encabezado del panel, el error y la vista, cada uno solo si
 * cambió. Un campo que se escribe nunca se pisa (`ponerParteConCampo`) y el foco vuelve a la misma
 * pieza (`data-k`; el «−1» que se fue deja el foco en su sumador). Cerrada, vacía.
 */
function pintarHabitos() {
  const raiz = $('#hab')
  const mini = $('#hab-mini')
  const f = st.habFirmas
  if (!st.habitos.abierta) {
    if (raiz.firstChild) { raiz.innerHTML = ''; st.habFirmas = { fila: f.fila } }
    if (mini.firstChild) mini.innerHTML = ''
    return
  }
  if (!raiz.firstChild) { raiz.innerHTML = esqueletoHabitos(); st.habFirmas = { fila: f.fila } }
  if (st.habitos.leido && !vistaHabitosValida(st.habitos)) st.habitos = verHabitos(st.habitos, 'hoy')
  const t = st.habitos
  const firmas = st.habFirmas
  const htmlMini = miniTareas(st.mascota, t.feliz)
  if (firmas.mini !== htmlMini) { mini.innerHTML = htmlMini; firmas.mini = htmlMini }

  const cuerpo = $('#hab-cuerpo')
  const k = raiz.contains(document.activeElement) ? document.activeElement.closest('[data-k]')?.dataset.k : null
  const modo = t.error && !t.lista.length ? 'error' : t.leido && !t.lista.length && !t.rotas.length && t.ver !== 'nuevo' ? 'primer' : 'carpeta'
  if (firmas.modo !== modo) {
    cuerpo.innerHTML = modo === 'carpeta' ? CARPETA_HAB : ''
    for (const p of ['todo', 'idx', 'pane-h', 'err', 'cuerpo']) delete firmas[p]
    firmas.modo = modo
  }
  const ponerParte = (el, parte, html, firma = html) => {
    if (!el || firmas[parte] === firma) return
    ponerParteConCampo(el, html, 'input[data-campo], textarea[data-campo]')
    firmas[parte] = firma
  }
  if (modo !== 'carpeta') {
    ponerParte(cuerpo, 'todo', modo === 'error' ? errorCarpetaHab(t.error) : primerUsoHabitos(st.mascota))
  } else {
    const ahora = Date.now()
    const armado = !!t.armado && armadoVigente(t, t.armado.id, ahora) && t.armado.id === `borrar:${t.ver}`
    const transcurrido = armado ? Math.max(0, MS_CONFIRMAR - (t.armado.hasta - ahora)) : 0
    const datos = { ...t, hoy: hoyHabitos(), avisar: st.avisar, mascota: st.mascota, armado }
    const p = partesHoja({ ...datos, fx: fxHabitos, recien: t.recien, transcurrido })
    // La firma no lleva el acto de un solo dibujo, la fila recién creada, cuánto lleva armado el borrado
    // ni lo que se escribe en el formulario nuevo (vive en su campo): un redibujo no repite nada
    const quieta = fxHabitos || t.recien || transcurrido || t.borrador
      ? partesHoja({ ...datos, borrador: t.borrador && { ...t.borrador, nombre: '', unidad: '' } })
      : p
    const parte = x => cuerpo.querySelector(`[data-parte="${x}"]`)
    ponerParte(parte('idx'), 'idx', p.idx, quieta.idx)
    ponerParte(parte('pane-h'), 'pane-h', p.paneH, quieta.paneH)
    ponerParte(parte('err'), 'err', p.err, quieta.err)
    ponerParte(parte('cuerpo'), 'cuerpo', p.cuerpo, quieta.cuerpo)
  }
  if (k && !raiz.contains(document.activeElement)) {
    const otro = k.startsWith('menos-') ? `sum-${k.slice(6)}` : null
    ;(raiz.querySelector(`[data-k="${CSS.escape(k)}"]`) ?? (otro && raiz.querySelector(`[data-k="${CSS.escape(otro)}"]`)))?.focus({ preventScroll: true })
  }
}

/**
 * Abre la hoja de Hábitos (la fila del menú o Ctrl H): acoplada, abre también el panel. Solo la llama
 * `irModulo` (modulos-ux.md 11.1), que ya cerró la otra hoja, la dividida y la tira. Al abrir se vuelven
 * a leer los hábitos (solo lectura). El foco va al `h1` (9.4).
 */
function abrirHabitosHoja({ ver, foco = true } = {}) {
  if (st.habitos.abierta) return
  st.habitos = abrirHabitos(st.habitos, ver)
  leerHabitos()
  pintar()
  movimientoHabitos.abrirHoja($('#marco .cab'), $('#hab-cuerpo'))
  if (st.acople) {
    evento({ tipo: 'clic' })
    if (foco) { st.focoPendiente = 'hab'; aplicarFoco() }
  } else if (foco) {
    $('#titulo').focus()
  }
}

/**
 * Cierra la hoja (solo desde `irModulo`): el nombre o la unidad que se escribían se guardan antes. De
 * vuelta en Sesiones el tablero vuelve como estaba, con su acto (`acto`); hacia otra hoja, sin él.
 */
function cerrarHabitosHoja({ acto = true } = {}) {
  if (!st.habitos.abierta) return
  confirmarCamposHabito()
  st.habitos = cerrarHabitos(st.habitos)
  pintar()
  if (acto) movimientoConfig.cerrarHoja([$('#otro'), $('#w-globo'), $('#conteos'), ...document.querySelectorAll('#sesiones > .ses')])
}

// ---- leer y guardar (11.1, 11.5)

let leyendoHabitos = null
/**
 * Lee los hábitos (`habitos_leer`, solo lectura): al arrancar (la cuenta de la fila del menú), al abrir
 * la hoja y con «Volver a leer». Si tarda más de 150 ms, la primera vez, el panel muestra las filas
 * fantasma (7.1). Los hábitos que no se pudieron guardar siguen como están en pantalla (7.4).
 */
function leerHabitos() {
  if (!tauri?.core) return null
  if (leyendoHabitos) return leyendoHabitos
  st.habitos = { ...st.habitos, cargando: true }
  const reloj = setTimeout(() => {
    if (!st.habitos.cargando || st.habitos.leido) return
    st.habitos = { ...st.habitos, fantasmas: true }
    pintarHabitos()
  }, 150)
  leyendoHabitos = (async () => {
    try {
      const r = await invocar('habitos_leer')
      const lista = Array.isArray(r?.habitos) ? r.habitos : []
      const rotas = Array.isArray(r?.rotas) ? r.rotas.filter(x => typeof x?.archivo === 'string') : []
      st.habitos = { ...st.habitos, lista: ordenarHabitos(mezclarLectura(lista, st.habitos.lista, habitosSinGuardar())), rotas, leido: true, error: null }
    } catch (err) {
      registrar(`hábitos: no se pudieron leer: ${err}`)
      st.habitos = { ...st.habitos, error: String(err?.message ?? err).slice(0, 120) || 'sin detalle' }
    } finally {
      clearTimeout(reloj)
      st.habitos = { ...st.habitos, cargando: false, fantasmas: false }
      leyendoHabitos = null
      pintar()
    }
  })()
  return leyendoHabitos
}

/** Por hábito: el guardado en curso (`promesa`) y si hay que guardarlo otra vez al terminar. */
const guardadosHabitos = new Map()
/** Los hábitos cuyo último guardado falló: se reintentan a los 5 s o con «Reintentar ahora» (7.4). */
const fallidosHabitos = new Set()
let relojReintentoHabitos = null

/** Los hábitos que no se pueden pisar con lo leído: los que fallaron y los que se están guardando. */
function habitosSinGuardar() {
  return new Set([...fallidosHabitos, ...[...guardadosHabitos].filter(([, g]) => g.enCurso).map(([id]) => id)])
}

/**
 * Guarda un hábito entero (`habitos_guardar`), de a uno por vez por hábito y siempre con lo último que
 * hay en pantalla, como `guardarListaTareas` (sin sus mudanzas: un hábito no se mueve de archivo). Si
 * falla, lo de la pantalla queda, el error de 7.4 aparece (y se anuncia), se anota en widget.log y se
 * reintenta solo a los 5 s; se va al primer guardado bueno.
 */
function guardarHabito(id) {
  let g = guardadosHabitos.get(id)
  if (!g) { g = { enCurso: false, otraVez: false, promesa: null }; guardadosHabitos.set(id, g) }
  if (g.enCurso) { g.otraVez = true; return g.promesa }
  g.enCurso = true
  g.promesa = (async () => {
    do {
      g.otraVez = false
      const habito = st.habitos.lista.find(h => h.id === id)
      if (!habito) { fallidosHabitos.delete(id); break }
      let r
      try { r = await invocar('habitos_guardar', { habito }) } catch (err) { r = { ok: false, error: String(err?.message ?? err) } }
      if (r?.ok) fallidosHabitos.delete(id)
      else {
        fallidosHabitos.add(id)
        registrar(`hábitos: no se guardó ${id}: ${r?.error ?? 'sin detalle'}`)
      }
    } while (g.otraVez)
    g.enCurso = false
    ponerErrorGuardarHabitos()
  })()
  return g.promesa
}

/** El error de 7.4 según lo que quedó sin guardar; con algo pendiente, el reintento a los 5 s. */
function ponerErrorGuardarHabitos() {
  const error = fallidosHabitos.size > 0
  if (error && !st.habitos.errorGuardar) decirHabitos('No se guardó el último cambio')
  if (error !== st.habitos.errorGuardar) { st.habitos = { ...st.habitos, errorGuardar: error }; pintarHabitos() }
  clearTimeout(relojReintentoHabitos)
  if (error) relojReintentoHabitos = setTimeout(reintentarHabitos, 5000)
}

/** «Reintentar ahora» o el reintento solo (7.4): vuelve a guardar lo que falló. */
function reintentarHabitos() {
  clearTimeout(relojReintentoHabitos)
  for (const id of [...fallidosHabitos]) guardarHabito(id)
}

// ---- acciones

/** Un anuncio en la región `role=status` de la hoja (5.3), como `decirTareas`: vacía antes, así se vuelve a oír. */
let anuncioHabitosEn = null
function decirHabitos(mensaje) {
  const el = $('#hab-vivo')
  if (!el || !mensaje) return
  el.textContent = ''
  clearTimeout(anuncioHabitosEn)
  anuncioHabitosEn = setTimeout(() => { el.textContent = mensaje }, 150)
}

/** Pone el foco en una pieza de la hoja (`data-k`), con el cursor al final si es un campo. */
function enfocarHabitos(k, { alFinal = false } = {}) {
  const el = $(`#hab [data-k="${CSS.escape(k)}"]`)
  if (!el) return false
  el.focus({ preventScroll: false })
  if (alFinal && typeof el.value === 'string') { try { el.setSelectionRange(el.value.length, el.value.length) } catch { /* sin selección */ } }
  return true
}

/** La mascota de 40 festeja 1,5 s y salta 6 px (4.13). */
let relojFelizHabitos = null
function festejarHabitos() {
  st.habitos = { ...st.habitos, feliz: true }
  pintarHabitos()
  movimientoHabitos.salto($('#hab-mini > .avi'))
  clearTimeout(relojFelizHabitos)
  relojFelizHabitos = setTimeout(() => { st.habitos = { ...st.habitos, feliz: false }; pintarHabitos() }, 1500)
}

/**
 * Cambia un hábito en pantalla (`f` devuelve el nuevo, o null si no hay nada que hacer), sube su mejor
 * racha si la superó (11.4) y lo guarda al instante. `fx`: el acto de un solo dibujo (10). Devuelve lo
 * que pasó (antes y después, para los anuncios, las chispas, el hito y el día completo), o null.
 */
function cambiarHabito(id, f, fx = null) {
  const hoy = hoyHabitos()
  const t = st.habitos
  const antes = t.lista.find(h => h.id === id)
  const nuevo = antes && f(antes)
  if (!nuevo || nuevo === antes) return null
  const despues = conMejor(nuevo, hoy)
  const cAntes = cuentasHoy(t.lista, hoy)
  st.habitos = { ...t, lista: t.lista.map(h => (h.id === id ? despues : h)) }
  guardarHabito(id)
  const cDespues = cuentasHoy(st.habitos.lista, hoy)
  const r = {
    antes, despues, rAntes: rachaHabito(antes, hoy), rDespues: rachaHabito(despues, hoy),
    llega: !hechoHabito(antes, hoy) && hechoHabito(despues, hoy), total: cDespues.total,
    completo: cDespues.total > 0 && cDespues.hechos >= cDespues.total && !(cAntes.total > 0 && cAntes.hechos >= cAntes.total),
  }
  fxHabitos = fx && { id, ...fx, sube: r.rDespues > r.rAntes, llega: r.llega }
  pintar()
  fxHabitos = null
  return r
}

/**
 * Después de marcar hoy (10): con el hábito recién hecho, las chispas y la mascota festeja; al llegar a
 * 7, 30 o 100, la píldora del hito (4.14, solo con una marca de hoy); con el día completo, la franja o la
 * barra se encienden. Los anuncios van después del de la marca (5.3).
 */
function trasMarcarHoy(r, control) {
  if (r.llega) {
    movimientoHabitos.chispas(control())
    festejarHabitos()
  }
  const hito = hitoNuevo(r.rAntes, r.rDespues)
  if (hito) {
    const txt = textoHito(r.despues, hito)
    movimientoHabitos.hito($('#hab'), hitoHtml(txt))
    setTimeout(() => decirHabitos(txt), 300)
  }
  if (r.completo) {
    movimientoHabitos.diaCompleto($('#hab'))
    if (!r.llega) festejarHabitos()
    setTimeout(() => decirHabitos(anuncioDiaCompleto(r.total)), 900)
  }
}

/** El tilde de hoy (4.5): sí/no, algunos días y por semana (con la semana cumplida cuenta igual). El foco queda en el control (9.4). */
function tildarHabitoEnHoja(id) {
  const hoy = hoyHabitos()
  const h = st.habitos.lista.find(x => x.id === id)
  if (!h || h.tipo === 'cantidad' || !tocaHabito(h, hoy)) return
  const on = valorHabito(h, hoy) < 1
  const r = cambiarHabito(id, x => marcarHabito(x, hoy, on), { tipo: 'tilde', dia: hoy })
  if (!r) return
  decirHabitos(anuncioTilde(h, on))
  trasMarcarHoy(r, () => $(`#hab [data-k="ck-${CSS.escape(id)}"]`) ?? $(`#hab .cel[data-valor="${CSS.escape(id)}"][data-dia="${hoy}"]`))
}

/** Sumar o restar un vaso hoy (4.6): la gota al sumar; puede pasar la meta (D-h16). El foco queda en el control. */
function sumarHabitoEnHoja(id, d) {
  const hoy = hoyHabitos()
  const h = st.habitos.lista.find(x => x.id === id)
  if (!h || h.tipo !== 'cantidad' || (d < 0 && valorHabito(h, hoy) <= 0)) return
  const r = cambiarHabito(id, x => sumarHabito(x, hoy, d), { tipo: 'suma', d, dia: hoy })
  if (!r) return
  decirHabitos(anuncioSuma(r.despues, valorHabito(r.despues, hoy), r.llega && d > 0))
  const control = () => $(`#hab [data-k="sum-${CSS.escape(id)}"]`)
  if (d > 0) movimientoHabitos.gota(control())
  trasMarcarHoy(r, control)
}

/** Corregir un día de esta semana en Semana (4.8, D-h4): hoy es el tilde; un día pasado alterna hecho y sin hacer. */
function corregirCeldaHabitos(id, dia) {
  const hoy = hoyHabitos()
  if (dia === hoy) { tildarHabitoEnHoja(id); return }
  const h = st.habitos.lista.find(x => x.id === id)
  const r = h && cambiarHabito(id, x => corregirHabito(x, dia, hoy), { tipo: 'celda', dia })
  if (!r) return
  decirHabitos(anuncioCorregido(h, dia, valorHabito(r.despues, dia) >= 1))
}

/** Cambia de vista desde el índice (3.4): el panel entra desde la derecha y el foco queda en el botón (9.4). */
function verHabitosEnHoja(ver) {
  if (ver === st.habitos.ver) return
  confirmarCamposHabito()
  st.habitos = verHabitos(st.habitos, ver)
  pintarHabitos()
  movimientoHabitos.cambioVista($('#hab .pane'))
  const d = $('#hab .hab-desplaza')
  if (d) d.scrollTop = 0
}

/** Abre un hábito en el lugar de la vista (4.10), con «‹ {Hoy|Semana}»; el foco va a su nombre (9.4). */
function abrirHabitoEnHoja(id) {
  if (!st.habitos.lista.some(h => h.id === id)) return
  confirmarCamposHabito()
  st.habitos = abrirHabito(st.habitos, id)
  pintarHabitos()
  movimientoHabitos.cambioVista($('#hab .pane'))
  const d = $('#hab .hab-desplaza')
  if (d) d.scrollTop = 0
  enfocarHabitos(`nom-in-${id}`, { alFinal: true })
}

/** «‹ {Hoy|Semana}» o Esc (9.1): lo escrito se guarda y el foco vuelve a su nombre en la lista (o a su fila en Semana). */
function cerrarHabitoEnHoja() {
  const id = st.habitos.ver
  const desde = st.habitos.desde
  confirmarCamposHabito()
  st.habitos = cerrarHabito(st.habitos)
  pintarHabitos()
  movimientoHabitos.cambioVista($('#hab .pane'))
  if (!enfocarHabitos(desde === 'semana' ? `mat-${id}` : `nom-${id}`)) enfocarHabitos(`ix-${desde}`)
}

/** «Nuevo hábito» (4.11): el formulario con su borrador; el foco, al nombre. */
function empezarNuevoHabito() {
  confirmarCamposHabito()
  st.habitos = empezarNuevo(st.habitos, st.habitos.lista)
  pintarHabitos()
  movimientoHabitos.cambioVista($('#hab .pane'))
  enfocarHabitos('nom-in-nuevo')
}

/** «Cancelar» o Esc (9.1): vuelve a la vista de origen con el foco en «Nuevo hábito» (o en el primer uso). */
function cancelarNuevoHabito() {
  st.habitos = cerrarHabito(st.habitos)
  pintarHabitos()
  movimientoHabitos.cambioVista($('#hab .pane'))
  if (!enfocarHabitos('nuevo-b') && !enfocarHabitos('primer-otro')) $('#titulo').focus()
}

/** Los ids que un hábito nuevo no puede repetir: los de la lista y los de los archivos rotos (11.1). */
const idsHabitos = () => new Set([...st.habitos.lista.map(h => h.id), ...st.habitos.rotas.map(r => r.archivo.replace(/\.json$/, ''))])

/**
 * Agrega un hábito ya armado (el formulario o una sugerida), lo guarda y abre Hoy con la fila
 * destellando (7.2); el foco va a su nombre (9.4).
 */
function agregarHabitoEnHoja(habito, sugerida) {
  const primero = !st.habitos.lista.length
  st.habitos = { ...st.habitos, lista: ordenarHabitos([...st.habitos.lista, habito]), ver: 'hoy', desde: 'hoy', borrador: null, errForm: null, recien: habito.id }
  guardarHabito(habito.id)
  pintar()
  st.habitos = { ...st.habitos, recien: null }
  if (primero) movimientoHabitos.abrirHoja(null, $('#hab-cuerpo'))
  else movimientoHabitos.cambioVista($('#hab .pane'))
  decirHabitos(anuncioCreado(habito.nombre, sugerida))
  enfocarHabitos(`nom-${habito.id}`)
}

/** «Crear hábito» o Enter en el nombre (4.11): valida (5.1) y, si está bien, lo crea; si no, el error y el foco en lo que falta. */
function crearHabitoEnHoja() {
  const t = st.habitos
  if (t.ver !== 'nuevo' || !t.borrador) return
  const leer = (k, v) => $(`#hab [data-k="${k}"]`)?.value ?? v
  const b = { ...t.borrador, nombre: leer('nom-in-nuevo', t.borrador.nombre), unidad: leer('unidad-nuevo', t.borrador.unidad) }
  const v = validarHabito(b, t.lista)
  if (!v.ok) {
    st.habitos = { ...t, borrador: b, errForm: v.error }
    pintarHabitos()
    enfocarHabitos(v.campo === 'dias' ? 'dia-0' : 'nom-in-nuevo')
    return
  }
  const ahora = Date.now()
  agregarHabitoEnHoja(nuevoHabito({ ...b, nombre: v.nombre }, { id: nuevoId('h', ahora, Math.random, idsHabitos()), ahora, hoy: hoyHabitos(), lista: t.lista }), false)
}

/** Una sugerida del primer uso (7.2): crea ese hábito con su tipo y su meta, sin aviso. */
function crearSugeridaEnHoja(sid) {
  const s = SUGERIDAS.find(x => x.id === sid)
  if (!s || !validarHabito({ nombre: s.nombre, tipo: s.tipo, dias: s.dias }, st.habitos.lista).ok) return
  const ahora = Date.now()
  agregarHabitoEnHoja(desdeSugerida(s, { id: nuevoId('h', ahora, Math.random, idsHabitos()), ahora, hoy: hoyHabitos(), lista: st.habitos.lista }), true)
}

/** El formulario a la vista (4.11): `{ id: 'nuevo', h: borrador }` o el hábito abierto; si no hay, null. */
function formularioActual() {
  const t = st.habitos
  if (t.ver === 'nuevo' && t.borrador) return { id: 'nuevo', h: t.borrador }
  const h = esHabito(t.ver) ? t.lista.find(x => x.id === t.ver) : null
  return h ? { id: h.id, h } : null
}

/**
 * Un campo del formulario (4.11): en el nuevo cambia el borrador; en un hábito abierto se guarda al
 * instante (11.1: cambiar el tipo reescribe el registro). Sacarle el último día dice «Tiene que quedar
 * al menos un día.» y no se guarda. El foco queda en el control (el redibujo lo devuelve por `data-k`).
 */
function editarFormulario(campo, v) {
  const fa = formularioActual()
  if (!fa) return
  const t = st.habitos
  if (fa.id === 'nuevo') {
    st.habitos = { ...t, borrador: editarHabito(t.borrador, campo, v), errForm: null }
    pintarHabitos()
    return
  }
  const nuevo = editarHabito(fa.h, campo, v)
  const valido = validarHabito(nuevo, t.lista)
  if (!valido.ok && valido.campo === 'dias') {
    st.habitos = { ...t, errForm: valido.error }
    pintarHabitos()
    return
  }
  if (t.errForm) st.habitos = { ...t, errForm: null }
  if (!cambiarHabito(fa.id, () => nuevo)) pintarHabitos()
}

/** − y + de la meta o de las veces (4.11). */
function pasoFormulario(valor) {
  const fa = formularioActual()
  const [campo, d] = String(valor).split(':')
  if (fa && (campo === 'meta' || campo === 'veces')) editarFormulario(campo, (fa.h[campo] ?? 1) + Number(d))
}

/** Un día de la semana del formulario (4.11): se suma o se saca. */
function diaFormulario(i) {
  const fa = formularioActual()
  if (!fa || !(i >= 0 && i <= 6)) return
  const dias = fa.h.dias ?? []
  editarFormulario('dias', dias.includes(i) ? dias.filter(d => d !== i) : [...dias, i])
}

/** La hora de cada aviso apagado, para volver a prenderlo con la misma (4.11); la primera vez, 09:00. */
const avisosApagados = new Map()
/** El interruptor del aviso (4.11). El recordatorio en sí es H2: acá solo se guarda la hora. */
function avisoFormulario() {
  const fa = formularioActual()
  if (!fa) return
  if (fa.h.aviso) {
    avisosApagados.set(fa.id, fa.h.aviso)
    editarFormulario('aviso', null)
  } else {
    editarFormulario('aviso', avisosApagados.get(fa.id) ?? AVISO_POR_DEFECTO)
  }
}

/** La frase del formulario (4.11) con lo que hay escrito ahora en el nombre y la unidad. */
function refrescarFrase(form) {
  const id = form?.dataset.form
  const base = id === 'nuevo' ? st.habitos.borrador : st.habitos.lista.find(h => h.id === id)
  const frase = form?.querySelector('[data-frase]')
  if (!base || !frase) return
  const nombre = form.querySelector('[data-campo="nombre"]')?.value ?? base.nombre
  const unidad = form.querySelector('[data-campo="unidad"]')?.value ?? base.unidad
  frase.innerHTML = fraseHtml({ ...base, nombre, unidad })
}

/**
 * Guarda el nombre o la unidad de un hábito que ya existe (3.5, 4.10): el nombre vacío vuelve al de
 * antes; repetido, el error de 5.1 y no se guarda; la unidad, recortada a 16.
 */
function confirmarTextoHabito(campo) {
  const form = campo.closest('[data-form]')
  const id = form?.dataset.form
  const h = id && id !== 'nuevo' ? st.habitos.lista.find(x => x.id === id) : null
  if (!h) return
  if (campo.dataset.campo === 'nombre') {
    const texto = campo.value.replace(/\s*[\r\n]+\s*/g, ' ')
    if (!texto.trim()) { campo.value = h.nombre; refrescarFrase(form); return }
    const v = validarHabito({ ...h, nombre: texto }, st.habitos.lista)
    if (!v.ok) { st.habitos = { ...st.habitos, errForm: v.error }; pintarHabitos(); return }
    if (st.habitos.errForm) st.habitos = { ...st.habitos, errForm: null }
    if (!cambiarHabito(id, x => ({ ...x, nombre: v.nombre }))) pintarHabitos()
  } else if (campo.dataset.campo === 'unidad') {
    const unidad = editarHabito(h, 'unidad', campo.value).unidad
    if (unidad !== h.unidad) cambiarHabito(id, x => ({ ...x, unidad }))
  }
}

/** Lo que se escribe en el hábito abierto se guarda antes de cambiar de vista o cerrar la hoja. */
function confirmarCamposHabito() {
  for (const c of document.querySelectorAll('#hab .det [data-campo="nombre"], #hab .det [data-campo="unidad"]')) confirmarTextoHabito(c)
}

let relojArmadoHabitos = null
/** El «¿Borrar…? Sí» vuelve solo a los 3 s (4.12), como el de Tareas. */
function vigilarArmadoHabitos() {
  clearTimeout(relojArmadoHabitos)
  const a = st.habitos.armado
  if (!a) return
  relojArmadoHabitos = setTimeout(() => {
    const t = desarmarVencido(st.habitos, Date.now())
    if (t === st.habitos) return vigilarArmadoHabitos()
    st.habitos = t
    pintarHabitos()
  }, Math.max(0, a.hasta - Date.now()) + 20)
}

/**
 * «Borrar hábito» (4.12): el primer clic arma «¿Borrar con su racha de {n} días? Sí» 3 s; el segundo
 * borra el archivo con todo su registro, una sola vez (después de su guardado en curso, así no vuelve a
 * aparecer). El foco va a «Hoy» del índice (9.4). Si Rust no pudo (un archivo roto no se borra), el
 * hábito queda y se anuncia.
 */
async function clicBorrarHabito(id) {
  const { config, ejecutar } = clicBorrar(st.habitos, `borrar:${id}`, Date.now())
  st.habitos = config
  vigilarArmadoHabitos()
  pintarHabitos()
  if (!ejecutar) return
  const h = st.habitos.lista.find(x => x.id === id)
  if (!h) return
  await guardadosHabitos.get(id)?.promesa
  let r
  try { r = await invocar('habitos_borrar', { id }) } catch (err) { r = { ok: false, error: String(err?.message ?? err) } }
  if (!r?.ok) {
    registrar(`hábitos: no se borró ${id}: ${r?.error ?? 'sin detalle'}`)
    decirHabitos('No se guardó el último cambio')
    return
  }
  fallidosHabitos.delete(id)
  guardadosHabitos.delete(id)
  avisosApagados.delete(id)
  st.habitos = verHabitos({ ...st.habitos, lista: st.habitos.lista.filter(x => x.id !== id) }, 'hoy')
  ponerErrorGuardarHabitos()
  pintar()
  decirHabitos(anuncioBorrado(h.nombre))
  ;($('#hab [data-k="ix-hoy"]') ?? $('#hab [data-k="primer-otro"]') ?? $('#titulo'))?.focus()
}

/**
 * Esc con la hoja abierta (9.1): vacía el nombre del hábito nuevo, desarma el «¿Borrar…? Sí» (el foco
 * queda en el botón), cancela el formulario nuevo, cierra el hábito abierto o, sin capas, va a Sesiones
 * con el foco en su fila (modulos-ux.md 9.1).
 */
function escHabitos(objetivo) {
  const campo = objetivo?.closest?.('#hab input[data-campo], #hab textarea[data-campo]')
  const { habitos, accion } = alEscHabitos(st.habitos, campo ? { campo: campo.dataset.campo, texto: campo.value } : null)
  if (accion === 'vaciar') {
    campo.value = ''
    st.habitos = { ...st.habitos, borrador: { ...st.habitos.borrador, nombre: '' } }
    refrescarFrase(campo.closest('[data-form]'))
    return
  }
  if (alEscModulo('habitos', accion) === 'sesiones') { irModulo('sesiones', { foco: 'fila' }); return }
  if (accion === 'cerrar-habito') { cerrarHabitoEnHoja(); return }
  if (accion === 'cancelar-nuevo') { cancelarNuevoHabito(); return }
  st.habitos = habitos
  pintarHabitos()
  if (accion === 'desarmar') enfocarHabitos('borrar')
}

/** Los botones de la hoja de Hábitos (`data-accion="hab-…"`). Un clic en otra cosa desarma el «¿Borrar…? Sí» (4.12). */
async function accionHabitos(a, b) {
  if (st.habitos.armado && a !== 'hab-borrar') {
    st.habitos = { ...st.habitos, armado: null }
    pintarHabitos()
  }
  switch (a) {
    // El globo del recordatorio (8.3): «+1»/«Hecho» marca sin abrir nada, «Ver hábitos →» (o el de la muesca)
    // abre la hoja en Hoy y la × lo deja para mañana. En la marca el globo es parte de lo que se arrastra:
    // después de un arrastre real, el clic no cuenta
    case 'hab-globo-hacer': if (!justoArrastro) hacerDesdeGlobo(b.dataset.valor); break
    case 'hab-globo-ver': if (!justoArrastro) await verDesdeGlobo(b.dataset.valor); break
    case 'hab-globo-x': if (!justoArrastro) descartarRecordatorio(b.dataset.valor); break
    case 'hab-ver': verHabitosEnHoja(b.dataset.valor); break
    case 'hab-nuevo': empezarNuevoHabito(); break
    case 'hab-cancelar': cancelarNuevoHabito(); break
    case 'hab-crear': crearHabitoEnHoja(); break
    case 'hab-sugerida': crearSugeridaEnHoja(b.dataset.valor); break
    case 'hab-abrir': abrirHabitoEnHoja(b.dataset.valor); break
    case 'hab-cerrar-habito': cerrarHabitoEnHoja(); break
    case 'hab-tildar': tildarHabitoEnHoja(b.dataset.valor); break
    case 'hab-sumar': sumarHabitoEnHoja(b.dataset.valor, 1); break
    case 'hab-restar': sumarHabitoEnHoja(b.dataset.valor, -1); break
    case 'hab-celda': corregirCeldaHabitos(b.dataset.valor, b.dataset.dia); break
    case 'hab-tipo': editarFormulario('tipo', b.dataset.valor); break
    case 'hab-paso': pasoFormulario(b.dataset.valor); break
    case 'hab-dia': diaFormulario(Number(b.dataset.valor)); break
    case 'hab-aviso': avisoFormulario(); break
    case 'hab-color': editarFormulario('color', b.dataset.valor); break
    case 'hab-borrar': await clicBorrarHabito(b.dataset.valor); break
    case 'hab-reintentar': reintentarHabitos(); break
    // «Abrir la carpeta» (7.6): Rust abre siempre `<config>/habitos/`, nunca una ruta de la ventana
    case 'hab-carpeta': invocar('habitos_abrir_carpeta').catch(err => registrar(`hábitos: no se pudo abrir la carpeta: ${err}`)); break
    case 'hab-releer': await leerHabitos(); break
    default: break
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

/**
 * Un aviso en `#anuncio-chat` (12): se vacía antes, así el mismo texto se vuelve a oír. Uno pendiente
 * se reemplaza (nunca se oyen dos seguidos del mismo cambio).
 */
let anuncioPendiente = null
function anunciarChat(mensaje, espera = 60) {
  const el = $('#anuncio-chat')
  if (!mensaje || !el) return
  clearTimeout(anuncioPendiente)
  el.textContent = ''
  anuncioPendiente = setTimeout(() => { el.textContent = mensaje }, espera)
}

/** Los archivos de una misma soltada llegan uno por uno: se juntan en un solo anuncio (18, M3). */
const JUNTAR_ADJUNTOS_MS = 300
let adjuntados = { nombres: [], hasta: 0 }
function anunciarAdjunto(nombre) {
  const ahora = Date.now()
  const nombres = ahora < adjuntados.hasta ? [...adjuntados.nombres, nombre] : [nombre]
  adjuntados = { nombres, hasta: ahora + JUNTAR_ADJUNTOS_MS }
  anunciarChat(anuncioAdjuntos(nombres), JUNTAR_ADJUNTOS_MS)
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
  // La tarjeta del modelo local de la configuración sigue la misma descarga (configuracion-ux.md 7.2)
  if (st.config.abierta && (chat.local !== antes.local || chat.progreso !== antes.progreso)) pintarConfiguracion()
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
      // Precalienta sin mandar nada (D19). Con el motor local, además, qué hay del modelo (solo lee).
      // Con otro modelo de Claude (#35), Rust la vuelve a abrir con él y la misma sesión
      abriendo = invocar('chat_abrir', { conversacion: e.conversacion, motor: e.motor, carpeta: e.carpeta, mascota: nombreMascota(), sesionClaude: e.sesionClaude, modelo: e.modelo })
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
      invocar('guardar_chat', { motor: e.motor, carpeta: e.carpeta, modelo: e.modelo })
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
      if (e.adjunto) anunciarAdjunto(e.adjunto)
      else anunciarChat(e.texto)
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
    campo: campoChat, carpeta: $('#chat-cab .carpeta'), modelo: $('#chat-cab .modelo'), hist: $('#hoja .arriba [data-accion="ch-hist"]'), buscar: $('#chat-buscar'),
    borrar: $('#chat-hist-lista .h-borrar'),
    charla: id ? [...$$('#chat-hist-lista [data-accion="ch-retomar"]')].find(x => x.dataset.id === id) : null,
  }[a]
  destino?.focus({ preventScroll: true })
}

/** `estado_modelo` (solo lee, sin red): si el modelo de esta PC está, falta o se está bajando. */
function leerModelo() {
  if (!tauri?.core) return Promise.resolve()
  return invocar('estado_modelo').then(e => despacharChat({ tipo: 'modelo', modelo: e?.modelo, bajado: e?.bajado, total: e?.total }))
    .catch(err => registrar(`chat modelo: ${err}`))
}

/** Un evento `oficina://modelo` (la descarga o el borrado desde la configuración). */
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
 * La única salida a la red del modelo local, solo con el clic en "Descargar" (de la hoja o de la
 * configuración, 7.2). Solo baja: no abre la hoja ni manda nada al terminar. `desde`: para el log.
 */
async function descargarModelo(desde) {
  try {
    await invocar('descargar_modelo')
    despacharChat({ tipo: 'modelo', modelo: 'bajando' })
  } catch (err) { registrar(`${desde} descargar: ${err}`) }
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
  // El lugar del menú es uno: el de carpeta o el del modelo (#35, alineado a su botón, a la derecha)
  const menu = $('#chat-menu')
  menu.hidden = !c.menu && !c.menuModelo
  menu.classList.toggle('de-modelo', !c.menu && !!c.menuModelo)
  if (c.menu) ponerConFoco('#chat-menu', menuCarpeta(m))
  else if (c.menuModelo) ponerConFoco('#chat-menu', menuModelo(m))
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
    // Abierto a mitad del vuelo de apertura: la mascota aterriza ya, así el clon no pasa por encima (18, D-c)
    if (actoHoja) movimientoChat.detener()
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
    case 'ch-modelo-menu':
      // Con un turno en curso queda en aria-disabled: el modelo cambia entre turnos (#35)
      if (b.getAttribute('aria-disabled') === 'true') return
      despacharChat({ tipo: 'menu-modelo' })
      if (st.chat.menuModelo) ($('#chat-menu [aria-checked="true"]') ?? $('#chat-menu [role^="menuitem"]'))?.focus()
      break
    case 'ch-modelo': despacharChat({ tipo: 'elegir-modelo', modelo: b.dataset.modelo || null }); enfocarEnHoja('modelo'); break
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
    case 'ch-descargar': await descargarModelo('chat'); break
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
  if ((c.menu || c.menuModelo) && e.target.closest('#chat-menu')) {
    const items = [...$$('#chat-menu [role^="menuitem"]')]
    const k = items.indexOf(e.target)
    const destino = { ArrowDown: k + 1, ArrowUp: k - 1, Home: 0, End: items.length - 1 }[e.key]
    if (destino != null) { e.preventDefault(); items[(destino + items.length) % items.length]?.focus(); return true }
    if (e.key === 'Tab') { despacharChat({ tipo: c.menu ? 'menu' : 'menu-modelo' }); return false }
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
  if (st.chat.menuModelo && !e.target.closest?.('#chat-menu, #chat-cab .modelo')) despacharChat({ tipo: 'menu-modelo' })
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
  // Con un globo a la vista (el aviso de tareas o un recordatorio), el Avi de la marca saluda y no juega;
  // mientras el globo confirma «Hecho», está feliz (habitos-ux.md 8.2)
  const conGlobo = st.lugarGlobo === 'marca'
  const feliz = conGlobo && st.confirmaGlobo?.clave === st.claveGlobo
  const animo = feliz ? 'feliz' : conGlobo ? 'saluda' : animoMarca(st.proyectos, ahora)
  marca.animo(animo, !conGlobo && reposoPermitido(st.proyectos, ahora))
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
    try {
      // Lo guardado en preferencias.json y la marca real del arranque (configuracion-ux.md 9.2)
      const m = await invocar('leer_configuracion')
      // La mascota, antes del primer dibujo: las firmas no la llevan (mascotas-avi-ux.md 9.1)
      st.mascota = especieValida(m.mascota)
      ponerArriba(valorInterruptor(m.arriba, INTERRUPTORES.arriba))
      st.avisar = valorInterruptor(m.avisar, INTERRUPTORES.avisar)
      ponerPausa(valorInterruptor(m.pausa, INTERRUPTORES.pausa))
      st.arranque = m.arranque === true
      st.version = typeof m.version === 'string' ? m.version : null
      // El día del último aviso diario de tareas (tareas-ux.md 11.4)
      st.avisadoTar = typeof m.tareasAvisado === 'string' ? m.tareasAvisado : null
      // Los hábitos ya recordados hoy (habitos-ux.md 8.3): un reinicio el mismo día no los repite
      st.habRecordados = validarAjuste('habitosRecordados', m.habitosRecordados) ? m.habitosRecordados : null
      // Dónde quedó el tablero flotante la última vez (fracciones del área, 9.7)
      if (m.flotante && typeof m.flotante === 'object') st.fraccion = { x: Number(m.flotante.x), y: Number(m.flotante.y) }
      // El motor, la carpeta y el modelo (#35) de la próxima charla, y las recientes (chat-avis-ux.md 3.4, D11)
      if (m.chat && typeof m.chat === 'object') {
        st.chat = {
          ...st.chat, motor: m.chat.motor === 'local' ? 'local' : 'claude', modelo: modeloValido(m.chat.modelo),
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
    } catch {
      st.mascota = ESPECIE_POR_DEFECTO
      await aplicarTamano(PASO_POR_DEFECTO)
    }
    const escuchar = tauri.event.listen
    // "Pausar animaciones" de la bandeja o de la configuración
    escuchar('oficina://pausa', ev => ponerPausa(!!ev.payload))
    escuchar('oficina://tamano', ev => aplicarTamano(Number(ev.payload)))
    // La mascota guardada (configuracion-ux.md 9.3): toda la ventana se redibuja con ella, sin acto;
    // si la eligió esta misma ventana, ya está puesta y no pasa nada
    escuchar('oficina://mascota', ev => ponerMascota(ev.payload?.mascota))
    // "Configuración…" de la bandeja (configuracion-ux.md 4.1): muestra el panel y abre la hoja
    escuchar('oficina://configuracion', ev => { if (ev.payload?.abrir) irModulo('config', { tab: ev.payload.tab }) })
    // Se abrió Avis otra vez estando en la tira mini: volver a la ventana completa
    escuchar('oficina://expandir', () => expandir())
    // Acoplar a un borde o flotar (null) desde afuera: la bandeja ya no lo manda (la configuración
    // llama a acoplarA directo); queda para la vista de desarrollo (`__bandeja`)
    escuchar('oficina://acoplar', ev => acoplarA(typeof ev.payload === 'string' ? ev.payload : null))
    // "Mostrar Avis", la notificación o abrir Avis otra vez: acoplada, abre el panel
    escuchar('oficina://abrir', async () => {
      // Abrir el panel (modulos-ux.md 8): el módulo actual o, con una pregunta pendiente, Sesiones en esa pregunta
      if (!st.acople) return
      if (!st.muesca.abierta) await abrirPanelAlModulo()
      evento({ tipo: 'clic' })
    })
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
    // Primeros pasos: cada paso que corre avisa (9.5). Se abre desde la pestaña Instalación de la
    // configuración (la bandeja ya no lo tiene, configuracion-ux.md 4.5) o desde el aviso del tablero
    escuchar('oficina://primeros-pasos', ev => alEventoPaso(ev.payload))
    // El mod automático (#17): la instalación sola que empieza y el aviso de una vez
    escuchar('oficina://mod-auto', ev => alEventoModAuto(ev.payload))
    tomarAvisoMod()
    // La charla (chat-avis-ux.md 7.5): cada evento lleva su conversación y su turno; transicionChat
    // descarta los de otra conversación o de un turno viejo
    escuchar('oficina://chat', ev => despacharChat({ tipo: 'backend', payload: ev.payload }))
    // El modelo de esta PC (3.6): la descarga y el borrado desde la configuración
    escuchar('oficina://modelo', ev => alEventoModelo(ev.payload))
    // Los archivos que se sueltan (10): Tauri los toma antes que el HTML (`dragDropEnabled`)
    tauri.webview?.getCurrentWebview?.()?.onDragDropEvent(ev => alArrastrarArchivo(ev.payload))
      ?.catch(err => registrar(`chat arrastrar: ${err}`))
    // El historial de la charla (9.1): la lista del disco y, si es de las últimas 12 h, la última (D11)
    efectoChat({ tipo: 'historial' })
    // Las listas de tareas (tareas-ux.md 11.3): la cuenta de la fila de la barra desde el arranque
    leerTareas()
    // Los hábitos (habitos-ux.md 11.5): lo de hoy en la fila del menú desde el arranque
    leerHabitos()
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
