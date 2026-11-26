// Tests de proyectosVista.js (#44, docs/diseno/proyectos-ux.md 3.3, 4, 5, 7 y 12, entrega P1): la cuenta de
// la fila del menú, el índice, el proyecto (con la carpeta creada por Avis, de la PC o perdida), la matriz,
// borrar armado, el formulario (Nuevo y Editar), el primer uso y los errores, con los textos exactos de la
// sección 5 y los nombres accesibles de 4 y 12.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ladoFilaProyectos, esqueletoProyectos, carpetaPro, indiceProyectos, indiceCargando, MATRIZ, fichaProyecto, formularioProyecto,
  primerUsoProyectos, errorLecturaProyectos, lineaRotos,
} from '../src/proyectosVista.js'
import { proyectosInicial, abrirProyectos, empezarNuevo, empezarEditar, editarForm } from '../src/proyectos.js'

const car = (tipo, ruta, archivos = 0, estado = 'ok') => ({ nombre: ruta.split('\\').pop(), ruta, tipo, estado, archivos })
const pro = (id, nombre, extra = {}) => ({ v: 1, id, nombre, color: 'ambar', orden: 0, creado: 1, instrucciones: '', carpeta: car('avis', `C:\\Users\\q\\Documents\\Avis\\${nombre}`), ...extra })
const PRESU = pro('p-presu', 'Presupuestos 2027', { instrucciones: 'Respondé en pesos.\nCon el IVA aparte.', carpeta: car('avis', 'C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027', 3) })
const LECT = pro('p-lect', 'Lecturas', { color: 'celeste', carpeta: car('pc', 'D:\\Libros\\Lecturas', 12) })
const MUD = pro('p-mud', 'Mudanza', { color: 'verde', carpeta: car('pc', 'E:\\Mudanza', 0, 'perdida') })
const sinEtiquetas = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '')

test('ladoFilaProyectos: la pista sin proyectos; el chip con el número y el punto rojo de la carpeta perdida (4.1)', () => {
  assert.equal(ladoFilaProyectos([]), '<kbd aria-hidden="true">Ctrl P</kbd>')
  assert.equal(ladoFilaProyectos(null), '<kbd aria-hidden="true">Ctrl P</kbd>')
  assert.equal(ladoFilaProyectos([PRESU, LECT]), '<span class="cuentas" aria-hidden="true"><span class="chip">2</span></span>')
  assert.equal(ladoFilaProyectos([PRESU, MUD]), '<span class="cuentas" aria-hidden="true"><span class="chip">2</span><i class="pt pro-mal"></i></span>')
})

test('el esqueleto y la carpeta (3.3): la región de anuncios, el índice con su píldora y el panel; sin proyectos, sin índice', () => {
  assert.match(esqueletoProyectos(), /<p class="oculto" role="status" id="pro-vivo"><\/p>/)
  const c = carpetaPro()
  assert.match(c, /<nav class="idx" aria-label="Proyectos"><span class="ind-ix" aria-hidden="true"><\/span><div class="ix-filas" data-parte="idx"><\/div><\/nav>/)
  assert.match(c, /<section class="pane" id="pro-pane" aria-labelledby="pro-h2" data-parte="pane"><\/section>/)
  assert.doesNotMatch(carpetaPro(true), /class="idx"/)
})

test('indiceProyectos: el rótulo, una fila por proyecto con su color y sus charlas, la carpeta perdida con su texto y «+ Nuevo» (4.2, 12)', () => {
  const html = indiceProyectos({ lista: [PRESU, MUD], elegido: 'p-presu', vista: 'proyecto' })
  assert.match(html, /^<span class="rot">Proyectos<\/span>/)
  assert.match(html, /data-accion="pro-ver" data-id="p-presu" data-k="ix-p-presu" aria-current="page" style="--c:var\(--ambar\)"/)
  assert.match(html, /<span class="ct" aria-hidden="true">0<\/span><span class="oculto">, 0 charlas<\/span>/)
  assert.match(html, /data-id="p-mud" data-k="ix-p-mud" style="--c:var\(--verde\)"[^>]*>.*<span class="mal-p" role="img" aria-label="carpeta perdida"><\/span>/)
  assert.match(html, /<button type="button" class="ix-b mas" data-accion="pro-nuevo" data-k="ix-nuevo"><i aria-hidden="true">\+<\/i><span class="n">Nuevo<\/span><\/button>$/)
  // Con el formulario nuevo, «+ Nuevo» es el elegido
  const nuevo = indiceProyectos({ lista: [PRESU], elegido: 'p-presu', vista: 'nuevo' })
  assert.equal((nuevo.match(/aria-current/g) ?? []).length, 1)
  assert.match(nuevo, /class="ix-b mas" data-accion="pro-nuevo" data-k="ix-nuevo" aria-current="page"/)
  // Un nombre con HTML se escapa
  assert.match(indiceProyectos({ lista: [pro('p-x', '<b>x</b>')], elegido: null, vista: 'proyecto' }), /&lt;b&gt;x&lt;\/b&gt;/)
  assert.equal((indiceCargando().match(/ix-fantasma/g) ?? []).length, 3)
})

test('fichaProyecto, creado por Avis: encabezado con lápiz, el botón de charla apagado (P2), instrucciones, carpeta, matriz y borrar (3.4, 4.3 a 4.9)', () => {
  const html = fichaProyecto({ p: PRESU })
  const orden = ['class="f-cab"', 'class="cta"', 'class="vacio-ch"', 'class="bloque ins"', 'class="bloque car"', 'class="matriz"', 'class="borrar-z"']
  const pos = orden.map(x => html.indexOf(x))
  assert.ok(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), `orden: ${pos}`)
  assert.match(html, /<h2 id="pro-h2" tabindex="-1">Presupuestos 2027<\/h2><small>sin charlas todavía · 3 archivos<\/small>/)
  assert.match(html, /aria-label="Editar Presupuestos 2027" title="Editar"/)
  assert.match(html, /class="cta" data-accion="pro-charla" data-k="cta" aria-disabled="true"/)
  assert.match(sinEtiquetas(html), /Empezar la primera charla/)
  assert.match(sinEtiquetas(html), /Listo, ya existe\. Soltá los archivos del tema en la carpeta y empezá a charlar: Avi ya conoce tus instrucciones\./)
  assert.match(html, /<p class="instr">Respondé en pesos\.\nCon el IVA aparte\.<\/p><small class="pie">Van al empezar cada charla<\/small>/)
  assert.match(html, /aria-label="Editar las instrucciones">Editar<\/button>/)
  assert.match(html, /<span class="tag">La creó Avis · 3 archivos<\/span>/)
  assert.match(html, /<button type="button" class="soltar" data-accion="pro-abrir-carpeta" data-k="soltar">Soltá archivos acá<small>3 adentro · Abrir en el Explorador<\/small><\/button>/)
  assert.match(html, /title="C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027">C:\\…\\Avis\\Presupuestos 2027<\/small>/)
  assert.match(html, /data-accion="pro-borrar" data-valor="p-presu" data-k="borrar">Borrar proyecto<\/button>/)
  assert.ok(html.includes(MATRIZ))
})

test('fichaProyecto recién creado (7.3): sin archivos, la zona de soltar encendida; de la PC, «Abrir» y «Cambiar» y otro texto', () => {
  const recien = fichaProyecto({ p: { ...PRESU, carpeta: { ...PRESU.carpeta, archivos: 0 } } })
  assert.match(recien, /class="soltar vivo"/)
  assert.match(recien, /<small>vacía · o abrila en el Explorador<\/small>/)
  const pc = fichaProyecto({ p: LECT })
  assert.match(pc, /<span class="tag">De tu PC · 12 archivos<\/span>/)
  assert.match(pc, /data-accion="pro-abrir-carpeta" data-k="car-abrir">Abrir<\/button><button type="button" class="mini" data-accion="pro-carpeta-elegir" data-k="car-cambiar">Cambiar<\/button>/)
  assert.doesNotMatch(pc, /class="soltar/)
  assert.match(sinEtiquetas(pc), /Listo, ya existe\. Empezá a charlar: Avi ya conoce tus instrucciones\./)
  // Sin instrucciones (4.6)
  assert.match(pc, /<p class="instr-no">Sin instrucciones: Avi charla como siempre\.<\/p>/)
  assert.match(pc, /data-k="editar-ins">Escribirlas<\/button>/)
})

test('fichaProyecto con la carpeta perdida (7.4): el texto de 5.2, «Elegir otra» y «Crear una nueva», y la línea en rojo', () => {
  const html = fichaProyecto({ p: MUD })
  assert.match(html, /<section class="bloque car mal">/)
  assert.match(html, /<p><b>No encuentro E:\\Mudanza\.<\/b> ¿La moviste o es de un disco que no está\? Las charlas siguen, solo con las instrucciones\.<\/p>/)
  assert.match(html, /class="mini pri" data-accion="pro-carpeta-elegir" data-k="car-elegir">Elegir otra<\/button>/)
  assert.match(html, /data-accion="pro-carpeta-crear" data-k="car-crear">Crear una nueva<\/button>/)
  assert.match(html, /<small>sin charlas todavía · <span class="rojo">carpeta perdida<\/span><\/small>/)
  // La carpeta rechazada (5.2) va en el bloque
  assert.match(fichaProyecto({ p: MUD, errorCarpeta: 'Las carpetas de red todavía no se pueden usar.' }), /<p class="pro-err" role="alert"><span>Las carpetas de red todavía no se pueden usar\.<\/span><\/p><\/section>/)
})

test('borrar armado (4.11, 5.1): «¿Borrar? Sí» en el mismo botón y debajo qué se va y qué queda', () => {
  const html = fichaProyecto({ p: PRESU, armado: true, transcurrido: 1200 })
  assert.match(html, /<button type="button" class="armado" data-accion="pro-borrar" data-valor="p-presu" data-k="borrar" aria-live="polite" style="--ya:-1200ms">¿Borrar\? Sí<\/button>/)
  assert.match(html, /<small>Se va el proyecto\. La carpeta y sus archivos quedan en tu PC\. Esc cancela\.<\/small>/)
})

test('MATRIZ: qué ve cada motor (4.8), una tabla con encabezados y el ✓ y el — siempre con su texto', () => {
  assert.match(MATRIZ, /role="table" aria-label="Qué ve cada motor"/)
  assert.deepEqual((MATRIZ.match(/role="columnheader">([^<]+)</g) ?? []).map(x => x.replace(/.*>/, '').replace('<', '')), ['Motor', 'Instrucciones', 'Carpeta'])
  assert.equal(sinEtiquetas(MATRIZ), 'MotorInstruccionesCarpetaClaude Codeen cada charlala lee cuando hace faltaLocalen cada charlano la ve')
})

test('formularioProyecto Nuevo (4.10): los campos con sus etiquetas, «Que Avis cree una» con la carpeta que se va a crear, la matriz y los botones', () => {
  const t = empezarNuevo(abrirProyectos({ ...proyectosInicial(), lista: [PRESU] }))
  const html = formularioProyecto({ form: editarForm(t, 'nombre', 'Mudanza').form })
  assert.match(html, /<form class="form" id="pro-form" aria-labelledby="pro-h2" novalidate/)
  assert.match(html, /<h2 id="pro-h2" tabindex="-1">Nuevo proyecto<\/h2>/)
  assert.match(html, /<label for="pro-nombre">Nombre<\/label><input id="pro-nombre" class="inp" data-campo="nombre" data-k="f-nombre" autocomplete="off" value="Mudanza">/)
  assert.match(html, /placeholder="Qué tiene que saber Avi de este tema, cómo querés que responda…" aria-describedby="pro-ins-ayuda"/)
  assert.match(html, /<small id="pro-ins-ayuda">Van al empezar cada charla del proyecto, con los dos motores\.<\/small>/)
  assert.match(html, /role="radiogroup" aria-labelledby="pro-car-l"/)
  assert.match(html, /aria-checked="true" tabindex="0" data-accion="pro-car-modo" data-valor="avis" data-k="oc-avis"><b>Que Avis cree una<\/b><span data-previa>Documentos › Avis › Mudanza\. Soltás ahí los archivos\.<\/span>/)
  assert.match(html, /data-valor="elegir" data-k="oc-elegir"><b>Una de esta PC<\/b><span>Elegir carpeta… Claude Code la lee; Avis no la toca\.<\/span>/)
  assert.ok(html.includes(MATRIZ))
  assert.match(html, />Crear proyecto<\/button><button type="button" class="btn-sec" data-accion="pro-cancelar" data-k="f-cancelar">Cancelar<\/button>/)
  assert.doesNotMatch(html, /Color|Cambiar…/)
})

test('formularioProyecto Editar (4.10, 6): el Color con los seis puntos, la carpeta actual con «Cambiar…» y «Guardar cambios»', () => {
  const t = empezarEditar(abrirProyectos({ ...proyectosInicial(), lista: [PRESU] }), 'p-presu')
  const html = formularioProyecto({ form: t.form, proyecto: PRESU })
  assert.match(html, /<h2 id="pro-h2" tabindex="-1">Editar proyecto<\/h2>/)
  assert.match(html, /<span class="lbl" id="pro-color-l">Color<\/span><div class="colores" role="radiogroup" aria-labelledby="pro-color-l">/)
  assert.equal((html.match(/class="col" role="radio"/g) ?? []).length, 6)
  assert.match(html, /aria-checked="true" tabindex="0" aria-label="Ámbar"/)
  assert.match(html, /data-accion="pro-carpeta-elegir" data-k="f-cambiar">Cambiar…<\/button>/)
  assert.match(html, />Guardar cambios<\/button>/)
  assert.doesNotMatch(html, /Que Avis cree una/)
  assert.match(html, /Respondé en pesos\.\nCon el IVA aparte\.<\/textarea>/)
})

test('formularioProyecto con errores (5.2, 12): debajo de su campo con aria-invalid y aria-describedby; descartar y guardar', () => {
  const t = empezarNuevo(abrirProyectos({ ...proyectosInicial(), lista: [PRESU] }))
  const form = { ...t.form, errores: { nombre: 'repetido', instrucciones: 'largo' }, aviso: true }
  const html = formularioProyecto({ form, errorForm: { texto: 'No se pudo guardar el proyecto. Probá de nuevo.', reintentar: true } })
  assert.match(html, /aria-invalid="true" aria-describedby="pro-nombre-err"><p class="f-err" id="pro-nombre-err">Ya hay un proyecto con ese nombre\.<\/p>/)
  assert.match(html, /aria-describedby="pro-ins-ayuda pro-ins-err" aria-invalid="true"/)
  assert.match(html, /<p class="f-err" id="pro-ins-err">Hasta 4000 caracteres\.<\/p>/)
  assert.match(html, /<p class="f-aviso" role="status">¿Descartar los cambios\? Esc otra vez<\/p><div class="form-acc">/)
  assert.match(html, /<\/div><p class="pro-err" role="alert"><span>No se pudo guardar el proyecto\. Probá de nuevo\.<\/span><button type="button" class="lnk" data-accion="pro-guardar" data-k="f-reintentar">Reintentar<\/button><\/p><\/form>$/)
  // Cerca del tope, la cuenta
  assert.match(formularioProyecto({ form: { ...t.form, instrucciones: 'x'.repeat(3700) } }), /<small class="f-cuenta" data-cuenta>3700 de 4000<\/small>/)
})

test('el primer uso, la lectura que falló y los rotos (7.2, 5.2, 7.6)', () => {
  const p = primerUsoProyectos('avi')
  assert.match(p, /<h2 id="pro-h2" tabindex="-1">Tus proyectos van acá<\/h2>/)
  assert.match(p, /<p>Un proyecto junta lo que Avi tiene que saber de un tema: tus instrucciones, una carpeta con archivos y sus charlas\.<\/p>/)
  assert.equal(sinEtiquetas(p.slice(p.indexOf('<div class="tres">'))), 'InstruccionesCarpetaCharlasCrear mi primer proyecto')
  assert.match(p, /data-accion="pro-nuevo" data-k="primer">Crear mi primer proyecto<\/button>/)
  assert.equal(errorLecturaProyectos(), '<p class="pro-err" role="alert"><span>No se pudo abrir la carpeta de proyectos.</span><button type="button" class="lnk" data-accion="pro-releer" data-k="releer">Reintentar</button></p>')
  assert.equal(lineaRotos(0), '')
  assert.match(lineaRotos(1), /<span>1 proyecto no se pudo leer\. Sigue en la carpeta, sin tocar\.<\/span><button type="button" class="lnk" data-accion="pro-carpeta-cfg" data-k="rotos">Abrir la carpeta<\/button>/)
})

test('los textos de Proyectos usan el nombre de la mascota, escapado (L5 de odd/tasks/proyectos.md)', () => {
  const n = 'Pancho <b>&'
  const e = 'Pancho &lt;b&gt;&amp;'
  const ficha = fichaProyecto({ p: PRESU, mascota: n })
  assert.ok(ficha.includes(`empezá a charlar: ${e} ya conoce tus instrucciones.`))
  assert.ok(fichaProyecto({ p: LECT, mascota: n }).includes(`Empezá a charlar: ${e} ya conoce tus instrucciones.`))
  assert.ok(fichaProyecto({ p: LECT, mascota: n }).includes(`<p class="instr-no">Sin instrucciones: ${e} charla como siempre.</p>`))
  const t = empezarNuevo(abrirProyectos({ ...proyectosInicial(), lista: [PRESU] }))
  assert.ok(formularioProyecto({ form: t.form, mascota: n }).includes(`placeholder="Qué tiene que saber ${e} de este tema, cómo querés que responda…"`))
  assert.ok(primerUsoProyectos('avi', n).includes(`<p>Un proyecto junta lo que ${e} tiene que saber de un tema:`))
  assert.doesNotMatch(sinEtiquetas(ficha), /\bAvi\b/)
})
