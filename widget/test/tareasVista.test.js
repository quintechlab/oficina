// Tests de tareasVista.js (#39, docs/diseno/tareas-ux.md 3.3, 4 y 5): el HTML de la fila de la barra,
// el índice, el encabezado del panel, el campo de nueva tarea, las filas, "Hechas", los vacíos, el
// primer uso y los errores. Solo HTML: los textos exactos de la sección 5 y lo accesible (12).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ladoFilaTareas, indiceTareas, cabeceraPanel, campoNueva, cuerpoLista, primerUso, errorGuardar, errorRota,
  errorCarpeta, avisoPreguntaTareas, esqueletoTareas, CARPETA, miniTareas, atrasTarea, esqueletoDetalle, partesDetalle,
  globoMarca, globoMuesca, filaAviso,
} from '../src/tareasVista.js'
import { textoGlobo } from '../src/tareas.js'

const HOY = '2026-11-24'
const t = (id, extra = {}) => ({ id, titulo: id, hecha: false, hechaEn: null, fecha: null, importante: false, notas: '', subtareas: [], creada: 1, ...extra })
const L = (id, nombre, color, tareas, orden = 0) => ({ v: 1, id, nombre, color, orden, creada: 1, tareas })
const LISTAS = [
  L('l-trabajo', 'Trabajo', 'celeste', [
    t('t-pr', { titulo: 'Revisar el PR #36', fecha: HOY, importante: true, notas: 'Ojo', subtareas: [{ id: 's-1', titulo: 'a', hecha: true }, { id: 's-2', titulo: 'b', hecha: false }, { id: 's-3', titulo: 'c', hecha: false }] }),
    t('t-venc', { titulo: 'Presupuesto <b>', fecha: '2026-11-23' }),
    t('t-hecha', { titulo: 'Deploy', hecha: true, hechaEn: 5, fecha: HOY }),
  ]),
  L('l-casa', 'Casa', 'verde', [t('t-luz', { titulo: 'Pagar la luz', fecha: HOY })], 1),
]

test('la fila de la barra: la pista "Ctrl T" sin nada; el chip ámbar con las de hoy; el rojo con el punto si hay vencidas', () => {
  assert.equal(ladoFilaTareas({ hoy: 0, vencidas: 0 }), '<kbd aria-hidden="true">Ctrl T</kbd>')
  const hoy = ladoFilaTareas({ hoy: 2, vencidas: 0 })
  assert.match(hoy, /class="chip chip-preg" aria-hidden="true">2</)
  const venc = ladoFilaTareas({ hoy: 2, vencidas: 2 })
  assert.match(venc, /class="chip chip-venc" aria-hidden="true"><i><\/i>4</)
  assert.doesNotMatch(venc, /kbd/)
})

test('el esqueleto: la línea de la pregunta, el cuerpo y la región de anuncios', () => {
  assert.match(esqueletoTareas(), /id="tar-aviso"/)
  assert.match(esqueletoTareas(), /class="oculto" role="status" id="tar-vivo"/)
  for (const parte of ['idx', 'pane-h', 'err', 'nuevo', 'lista']) assert.match(CARPETA, new RegExp(`data-parte="${parte}"`))
  assert.match(CARPETA, /<nav class="idx" aria-label="Vistas y listas"/)
  assert.match(CARPETA, /<section class="pane" aria-labelledby="tar-pane-h"/)
})

test('índice: Hoy y Vencidas con su cuenta (oculta para el lector), "Listas", cada lista con su punto y su cuenta, y "Nueva lista"', () => {
  const html = indiceTareas({ ver: 'l-casa', listas: LISTAS, cuentas: { hoy: 2, vencidas: 1 }, rotas: [] })
  assert.match(html, /data-valor="hoy"[^>]*>.*Hoy<\/span><span class="ct t-aviso" aria-hidden="true">2<\/span><span class="oculto">, 2 pendientes<\/span>/)
  assert.match(html, /data-valor="vencidas"[^>]*>.*Vencidas<\/span><span class="ct t-error" aria-hidden="true">1<\/span>/)
  assert.match(html, /<span class="rot-i" aria-hidden="true">Listas<\/span>/)
  assert.match(html, /data-valor="l-casa" data-k="ix-l-casa" aria-current="page" style="--c:var\(--verde\)" title="Casa"/)
  assert.match(html, /data-valor="l-trabajo"[^>]*>.*Trabajo<\/span><span class="ct" aria-hidden="true">2<\/span><span class="oculto">, 2 pendientes<\/span>/)
  assert.match(html, /class="ix-b ix-mas" data-accion="tar-crear"[^>]*>.*Nueva lista/)
  // Sin cuenta en 0, y sin leer todavía (7.1) Hoy y Vencidas van sin cuenta
  const cero = indiceTareas({ ver: 'hoy', listas: [], cuentas: null, rotas: [] })
  assert.doesNotMatch(cero, /class="ct/)
})

test('índice: renombrar y crear ponen el campo en su lugar, con el error de nombre repetido; los archivos rotos van al final', () => {
  const ren = indiceTareas({ ver: 'l-casa', listas: LISTAS, cuentas: { hoy: 0, vencidas: 0 }, rotas: [], renombrando: 'l-casa', errorLista: 'Ya hay una lista «Trabajo».' })
  assert.match(ren, /<input data-campo="ren" data-k="ren-in" maxlength="40" value="Casa" placeholder="Nombre de la lista" aria-label="Nuevo nombre de la lista"/)
  assert.match(ren, /role="alert">Ya hay una lista «Trabajo».</)
  assert.doesNotMatch(ren, /data-valor="l-casa"/)
  const crear = indiceTareas({ ver: 'hoy', listas: LISTAS, cuentas: null, rotas: [{ archivo: 'l-roto.json', motivo: 'no es JSON' }], creando: true })
  assert.match(crear, /data-campo="lista" data-k="lista-in" maxlength="40" value="" placeholder="Nombre de la lista"/)
  assert.doesNotMatch(crear, /Nueva lista<\/span>/)
  assert.match(crear, /class="ix-b rota" data-accion="tar-ver" data-valor="rota:l-roto.json"[^>]*title="l-roto.json: no es JSON"/)
})

test('encabezado del panel: Hoy con la fecha, el avance y su barra; Vencidas; una lista con Renombrar y Borrar lista', () => {
  const hoy = cabeceraPanel({ ver: 'hoy', listas: LISTAS, hoy: HOY })
  assert.match(hoy, /<h2 id="tar-pane-h">Hoy<\/h2>/)
  assert.match(hoy, /martes 24\/11 · 1 de 3/)
  assert.match(hoy, /role="progressbar" aria-label="Hechas hoy" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"><i style="--p:33.3%">/)
  assert.match(cabeceraPanel({ ver: 'vencidas', listas: LISTAS, hoy: HOY }), /la más vieja primero/)
  const lista = cabeceraPanel({ ver: 'l-trabajo', listas: LISTAS, hoy: HOY })
  assert.match(lista, /<h2 id="tar-pane-h"><i class="pt" style="--c:var\(--celeste\)" aria-hidden="true"><\/i>Trabajo<\/h2>/)
  assert.match(lista, /2 pendientes · 1 hecha/)
  assert.match(lista, /class="lnk" data-accion="tar-renombrar" data-valor="l-trabajo" data-k="renombrar">Renombrar/)
  assert.match(lista, /class="lnk peligro" data-accion="tar-borrar-lista" data-valor="l-trabajo" data-k="borrar-lista">Borrar lista/)
})

test('encabezado: "Borrar lista" armado pregunta con la cuenta de tareas, con el mismo data-k y la línea que retoma', () => {
  const html = cabeceraPanel({ ver: 'l-trabajo', listas: LISTAS, hoy: HOY, armado: true, transcurrido: 1200 })
  assert.match(html, /class="armado" data-accion="tar-borrar-lista" data-valor="l-trabajo" data-k="borrar-lista" aria-live="polite" style="--ya:-1200ms">¿Borrar con 3 tareas\? Sí</)
})

test('campo de nueva tarea: Hoy agrega a la primera lista; una lista, a ella; Vencidas no tiene campo', () => {
  assert.match(campoNueva('hoy', LISTAS), /<label class="campo nueva">.*<input data-campo="nueva" data-k="nueva" maxlength="200" placeholder="Agregar para hoy en Trabajo…" aria-label="Agregar para hoy en Trabajo"><kbd>Enter<\/kbd><\/label>/)
  assert.match(campoNueva('l-casa', LISTAS), /placeholder="Agregar a Casa…"/)
  assert.equal(campoNueva('vencidas', LISTAS), '<p class="pista">Las vencidas salen de sus listas: tildalas o cambiales la fecha.</p>')
})

test('filas: el tilde es un checkbox con "Hecha: {título}", la fecha corta con su texto largo oculto, la lista en Hoy, las subtareas y las notas', () => {
  const html = cuerpoLista({ ver: 'hoy', listas: LISTAS, hoy: HOY, hechas: false })
  assert.match(html, /<li class="fila imp" data-id="t-pr" style="--c:var\(--celeste\)">/)
  assert.match(html, /class="ck" role="checkbox" aria-checked="false" aria-label="Hecha: Revisar el PR #36" data-accion="tar-tildar" data-lista="l-trabajo" data-valor="t-pr" data-k="ck-t-pr"/)
  assert.match(html, /<span class="tag t-aviso"><span class="oculto">, Vence hoy<\/span><span aria-hidden="true">hoy<\/span><\/span>/)
  assert.match(html, /<span class="de-l" style="--c:var\(--celeste\)"><i class="pt" aria-hidden="true"><\/i>Trabajo<\/span>/)
  assert.match(html, /<span class="subc" style="--p:33.3%"><i aria-hidden="true"><\/i><span aria-hidden="true">1\/3<\/span><span class="oculto">, 1 de 3 subtareas hechas<\/span><\/span>/)
  // El cuerpo abre la tarea (4.5, entrega 2): un botón con el título y lo demás en su nombre
  assert.match(html, /<button type="button" class="f-cuerpo" data-accion="tar-abrir-tarea" data-valor="t-pr" data-k="ab-t-pr"><span class="tit">Revisar el PR #36<\/span><span class="oculto">, importante<\/span>/)
  assert.match(html, /<span class="oculto">, con notas<\/span>/)
  assert.match(html, /<span class="oculto">, importante<\/span>/)
  assert.match(html, /<span class="imp-b" aria-hidden="true">!<\/span>/)
  // Importantes primero: el PR antes que la luz
  assert.ok(html.indexOf('t-pr') < html.indexOf('t-luz'))
})

test('filas: el título se escapa; una lista no repite su nombre en cada fila', () => {
  const html = cuerpoLista({ ver: 'l-trabajo', listas: LISTAS, hoy: HOY, hechas: false })
  assert.match(html, /Presupuesto &lt;b&gt;/)
  assert.doesNotMatch(html, /class="de-l"/)
  assert.match(html, /<span class="tag t-error"><span class="oculto">, Venció ayer<\/span><span aria-hidden="true">ayer<\/span>/)
})

test('"Hechas · n": plegado por defecto (aria-expanded false, sin la lista); desplegado, tildadas y sin fecha; la recién agregada lleva su destello', () => {
  const plegado = cuerpoLista({ ver: 'l-trabajo', listas: LISTAS, hoy: HOY, hechas: false })
  assert.match(plegado, /<button type="button" class="pleg" aria-expanded="false" aria-controls="tar-hechas" data-accion="tar-hechas" data-k="pleg">.*Hechas · 1<\/button>/)
  assert.doesNotMatch(plegado, /t-hecha/)
  const abierto = cuerpoLista({ ver: 'l-trabajo', listas: LISTAS, hoy: HOY, hechas: true, recien: 't-venc' })
  assert.match(abierto, /<ul class="filas hechas-l" id="tar-hechas"><li class="fila hecha" data-id="t-hecha"/)
  assert.match(abierto, /aria-checked="true" aria-label="Hecha: Deploy"/)
  assert.doesNotMatch(abierto.slice(abierto.indexOf('hechas-l')), /class="tag/)
  assert.match(abierto, /<li class="fila recien" data-id="t-venc"/)
  // Vencidas no tiene "Hechas"
  assert.doesNotMatch(cuerpoLista({ ver: 'vencidas', listas: LISTAS, hoy: HOY, hechas: false }), /class="pleg"/)
})

test('vacíos (5.2) y las filas fantasma mientras se lee (7.1)', () => {
  const sinNada = [L('l-a', 'Ideas', 'rosa', [])]
  assert.match(cuerpoLista({ ver: 'l-a', listas: sinNada, hoy: HOY }), /<div class="vac">.*<b>«Ideas» está vacía.<\/b><p>Escribí arriba y Enter para sumar la primera.<\/p><\/div>/)
  assert.match(cuerpoLista({ ver: 'vencidas', listas: sinNada, hoy: HOY }), /<b>Nada vencido.<\/b><p>Estás al día.<\/p>/)
  assert.match(cuerpoLista({ ver: 'hoy', listas: sinNada, hoy: HOY }), /<b>Listo por hoy.<\/b><p>No queda nada con fecha de hoy.<\/p>/)
  assert.equal(cuerpoLista({ ver: 'hoy', listas: [], hoy: HOY, fantasmas: true }), '<ul class="filas fantasmas" aria-hidden="true"><li></li><li></li><li></li></ul>')
})

test('primer uso (5.2): el saludo, las tres sugeridas y el campo "Otro nombre…"', () => {
  const html = primerUso('avi')
  assert.match(html, /<div class="primer">/)
  assert.match(html, /<b>Armá tu primera lista<\/b><p>Las tareas quedan en esta PC. Cuando tengas algo para hoy, te aviso al prender.<\/p>/)
  for (const n of ['Trabajo', 'Casa', 'Compras']) assert.match(html, new RegExp(`data-accion="tar-sugerida" data-valor="${n}" data-k="sug-${n}">\\+ ${n}</button>`))
  assert.match(html, /data-campo="lista" data-k="primer-in" maxlength="40" placeholder="Otro nombre…" aria-label="Nombre de la lista nueva"/)
})

test('errores (5.2): no se guardó, archivo roto y carpeta ilegible, con sus botones', () => {
  assert.match(errorGuardar(), /<b>No se guardó el último cambio.<\/b>Sigue en pantalla. Reintento solo en 5 s.<\/div><div class="acc"><button type="button" class="lnk" data-accion="tar-reintentar" data-k="reintentar">Reintentar ahora<\/button>/)
  const rota = errorRota('l-<x>.json')
  assert.match(rota, /<b>Una lista no se pudo leer.<\/b>El archivo quedó como estaba \(l-&lt;x&gt;.json\). Las demás listas andan./)
  assert.match(rota, /data-accion="tar-carpeta" data-k="carpeta">Abrir la carpeta<\/button><button type="button" class="lnk" data-accion="tar-releer" data-k="releer">Volver a leer/)
  const carpeta = errorCarpeta('acceso denegado')
  assert.match(carpeta, /<b>No se pudo abrir la carpeta de tareas.<\/b>acceso denegado/)
  assert.match(carpeta, /data-accion="tar-releer"/)
})

test('la línea de la pregunta pendiente con la hoja abierta (3.1), y la mascota de 40 junto al título', () => {
  assert.equal(avisoPreguntaTareas(0), '')
  assert.match(avisoPreguntaTareas(1), /<button type="button" class="aviso cfg-aviso" data-accion="tar-pregunta"><span>Claude te hace una pregunta<\/span><span class="ir">Ver →<\/span><\/button>/)
  assert.match(miniTareas('avi', false), /class="avi"/)
  assert.notEqual(miniTareas('avi', true), miniTareas('avi', false))
})

// ------------------------------------------------------------------ entrega 2: la tarea abierta (4.7)

test('la tarea abierta: «‹ {vista}» para volver, el h2 oculto con el título y las partes del detalle', () => {
  assert.equal(atrasTarea('Hoy'), '<button type="button" class="lnk atras" data-accion="tar-cerrar-tarea" data-k="atras">‹ Hoy</button>')
  assert.match(atrasTarea('A <b>'), /‹ A &lt;b&gt;/)
  const esq = esqueletoDetalle('Pagar <luz>')
  assert.match(esq, /^<h2 class="oculto" id="tar-pane-h">Pagar &lt;luz&gt;<\/h2><div class="det">/)
  for (const parte of ['det-tit', 'det-g', 'det-sub', 'det-notas', 'det-pie']) assert.match(esq, new RegExp(`data-parte="${parte}"`))
})

test('detalle: el tilde «Hecha» y el título editable (textarea de una línea, hasta 200); tildada, tachado', () => {
  const [lista] = LISTAS
  const p = partesDetalle({ lista, tarea: lista.tareas[0], listas: LISTAS, hoy: HOY })
  assert.match(p.tit, /<button type="button" class="ck" role="checkbox" aria-checked="false" aria-label="Hecha" data-accion="tar-tildar-det" data-valor="t-pr" data-k="ckd-t-pr">/)
  assert.match(p.tit, /<textarea class="tit-in" rows="1" maxlength="200" aria-label="Título de la tarea" data-campo="titulo" data-k="tit-t-pr">Revisar el PR #36<\/textarea>/)
  const hecha = partesDetalle({ lista, tarea: lista.tareas[2], listas: LISTAS, hoy: HOY })
  assert.match(hecha.tit, /aria-checked="true"/)
  assert.match(hecha.tit, /class="tit-in hecha"/)
})

test('detalle: Vence (Hoy · Mañana · Sin fecha, el selector nativo y el rótulo largo), Prioridad y Lista', () => {
  const [lista] = LISTAS
  const p = partesDetalle({ lista, tarea: lista.tareas[0], listas: LISTAS, hoy: HOY })
  assert.match(p.datos, /<span class="det-l">Vence<\/span>/)
  assert.match(p.datos, /<div class="seg ch" role="radiogroup" aria-label="Vence">/)
  assert.match(p.datos, /role="radio" aria-checked="true" tabindex="0" data-accion="tar-fecha" data-valor="hoy" data-k="fecha-hoy">Hoy</)
  assert.match(p.datos, /role="radio" aria-checked="false" tabindex="-1" data-accion="tar-fecha" data-valor="manana" data-k="fecha-manana">Mañana</)
  assert.match(p.datos, />Sin fecha</)
  assert.match(p.datos, /<input type="date" class="fecha-in" value="2026-11-24" aria-label="Elegir otra fecha" data-cambio="tar-fecha-in" data-k="fecha-in">/)
  assert.match(p.datos, /<span class="vence t-aviso">Vence hoy<\/span>/)
  assert.match(p.datos, /<div class="seg prio" role="radiogroup" aria-label="Prioridad">/)
  assert.match(p.datos, /aria-checked="true" tabindex="0" data-accion="tar-prio" data-valor="imp" data-k="prio-imp">! Importante</)
  assert.match(p.datos, /aria-checked="false" tabindex="-1" data-accion="tar-prio" data-valor="normal" data-k="prio-normal">Normal</)
  assert.match(p.datos, /<select class="sel" aria-label="Lista" data-cambio="tar-lista" data-k="lista-sel"><option value="l-trabajo" selected>Trabajo<\/option><option value="l-casa">Casa<\/option><\/select>/)
  // Otra fecha: ninguna opción elegida y la primera queda en el orden de tabulación; sin fecha, sin rótulo
  const otra = partesDetalle({ lista, tarea: { ...lista.tareas[0], fecha: '2026-11-28' }, listas: LISTAS, hoy: HOY })
  assert.match(otra.datos, /aria-checked="false" tabindex="0" data-accion="tar-fecha" data-valor="hoy"/)
  assert.match(otra.datos, /<span class="vence t-nada">Vence el sáb 28\/11<\/span>/)
  const sin = partesDetalle({ lista, tarea: { ...lista.tareas[0], fecha: null }, listas: LISTAS, hoy: HOY })
  assert.match(sin.datos, /aria-checked="true" tabindex="0" data-accion="tar-fecha" data-valor="sin"/)
  assert.match(sin.datos, /value=""/)
  assert.doesNotMatch(sin.datos, /class="vence/)
})

test('detalle: subtareas con su cuenta, tilde cuadrado y texto que se edita con un clic; el campo «Agregar una subtarea»', () => {
  const [lista] = LISTAS
  const p = partesDetalle({ lista, tarea: lista.tareas[0], listas: LISTAS, hoy: HOY })
  assert.match(p.subs, /^<h3 class="sub">Subtareas · 1 de 3<\/h3><ul class="subs">/)
  assert.match(p.subs, /<li class="hecha" data-id="s-1"><button type="button" class="ck chico" role="checkbox" aria-checked="true" aria-label="Subtarea hecha: a" data-accion="tar-tildar-sub" data-valor="s-1" data-k="cks-s-1">/)
  assert.match(p.subs, /<button type="button" class="sub-t" data-accion="tar-editar-sub" data-valor="s-2" data-k="st-s-2" aria-label="Editar «b»">b<\/button>/)
  assert.match(p.subs, /<label class="campo chico">.*<input data-campo="subtarea" data-k="sub-in" maxlength="200" placeholder="Agregar una subtarea" aria-label="Agregar una subtarea"><kbd>Enter<\/kbd><\/label>$/)
  // La que se edita es un campo con su texto (vaciarlo la borra, D-n2)
  const ed = partesDetalle({ lista, tarea: lista.tareas[0], listas: LISTAS, hoy: HOY, editandoSub: 's-2' })
  assert.match(ed.subs, /<input class="sub-in" data-campo="sub-ed" data-valor="s-2" data-k="sub-ed-s-2" maxlength="200" value="b" aria-label="Texto de la subtarea \(vacío, se borra\)">/)
  assert.doesNotMatch(ed.subs, /data-k="st-s-2"/)
  // Sin subtareas: el rótulo solo y el campo
  const sin = partesDetalle({ lista, tarea: lista.tareas[1], listas: LISTAS, hoy: HOY })
  assert.match(sin.subs, /^<h3 class="sub">Subtareas<\/h3><label class="campo chico">/)
})

test('detalle: notas (3 líneas, hasta 4000) y el pie con «Creada el {d/m}» y «Borrar tarea», que confirma en el mismo botón', () => {
  const [lista] = LISTAS
  const tarea = { ...lista.tareas[0], notas: 'Ojo <con> esto', creada: Date.parse('2026-11-22T15:00:00Z') }
  const p = partesDetalle({ lista, tarea, listas: LISTAS, hoy: HOY })
  assert.equal(p.notas, '<h3 class="sub">Notas</h3><textarea class="notas" rows="3" maxlength="4000" placeholder="Algo para acordarte…" aria-label="Notas" data-campo="notas" data-k="notas">Ojo &lt;con&gt; esto</textarea>')
  assert.equal(p.pie, '<span class="cifras">Creada el 22/11</span><button type="button" class="lnk peligro" data-accion="tar-borrar-tarea" data-valor="t-pr" data-k="borrar-tarea">Borrar tarea</button>')
  const armado = partesDetalle({ lista, tarea, listas: LISTAS, hoy: HOY, armado: true, transcurrido: 500 })
  assert.match(armado.pie, /<button type="button" class="armado" data-accion="tar-borrar-tarea" data-valor="t-pr" data-k="borrar-tarea" aria-live="polite" style="--ya:-500ms">¿Borrar\? Sí<\/button>/)
})

test('el panel por partes sigue igual con la tarea abierta: el esqueleto de la carpeta no cambia y el detalle usa los mismos data-campo que el redibujo respeta', () => {
  for (const parte of ['idx', 'pane-h', 'err', 'nuevo', 'lista']) assert.match(CARPETA, new RegExp(`data-parte="${parte}"`))
  const [lista] = LISTAS
  const p = partesDetalle({ lista, tarea: lista.tareas[0], listas: LISTAS, hoy: HOY, editandoSub: 's-1' })
  // Los campos que se escriben llevan data-campo (no se pisan); la fecha y la lista no (se redibujan con su valor)
  for (const campo of ['titulo', 'notas', 'subtarea', 'sub-ed']) assert.match(Object.values(p).join(''), new RegExp(`data-campo="${campo}"`))
  assert.doesNotMatch(p.datos, /data-campo/)
})

// ------------------------------------------------------------------ el aviso diario (8.3, 8.4, 8.5 y 5.4)

test('globoMarca (8.3): dos botones hermanos, el texto de 5.4 con los números en negrita y las vencidas en rojo, «Ver tareas →» y la ×', () => {
  const html = globoMarca(textoGlobo({ hoy: 2, vencidas: 1 }, '09:00'))
  assert.match(html, /^<div class="globo-tar" data-globo-tar>/)
  assert.match(html, /<button type="button" class="globo-b" data-accion="tar-globo"><span class="globo-t">¡Buen día! Tenés <b>2 tareas para hoy<\/b> y <b class="r">1 vencida<\/b>\.<\/span><span class="globo-c">Ver tareas →<\/span><\/button>/)
  assert.match(html, /<button type="button" class="globo-x" data-accion="tar-globo-x" aria-label="Más tarde: avisame mañana" title="Más tarde">/)
  // Sin vencidas, sin rojo
  assert.doesNotMatch(globoMarca(textoGlobo({ hoy: 1, vencidas: 0 }, '14:00')), /class="r"/)
  assert.match(globoMarca(textoGlobo({ hoy: 1, vencidas: 0 }, '14:00')), /¡Buenas tardes! Tenés <b>1 tarea para hoy<\/b>\./)
})

test('globoMuesca (8.5): el contenido del botón #muesca-tareas, «Ver →» y el nombre con el texto entero', () => {
  const t = textoGlobo({ hoy: 2, vencidas: 2 }, '21:00')
  const g = globoMuesca(t)
  assert.equal(g.html, '<span class="mt-t">2 para hoy · <b class="r">2 vencidas</b></span><span class="mt-c">Ver <span aria-hidden="true">→</span></span>')
  assert.equal(g.nombre, '¡Buenas noches! Tenés 2 tareas para hoy y 2 vencidas. Ver tareas')
})

test('filaAviso (8.4): la píldora de la dividida con «Ver →» y la ×', () => {
  const html = filaAviso(textoGlobo({ hoy: 0, vencidas: 3 }, '13:00'))
  assert.match(html, /^<div class="aviso aviso-tar" data-globo-tar>/)
  assert.match(html, /<span class="at-t">¡Buenas tardes! <b class="r">3 vencidas<\/b>\.<\/span>/)
  assert.match(html, /<button type="button" class="lnk" data-accion="tar-globo">Ver →<\/button>/)
  assert.match(html, /<button type="button" class="tb" data-accion="tar-globo-x" aria-label="Más tarde: avisame mañana" title="Más tarde">/)
})
