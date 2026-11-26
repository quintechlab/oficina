// Tests de proyectos.js (#44, docs/diseno/proyectos-ux.md 11.6, entrega P1): validar el nombre y las
// instrucciones, el color del proyecto nuevo (el de tareas.js), las líneas de 5.1, el texto de borrar,
// Esc por capas (9.1), Ctrl P (9.2), el nombre de la fila del menú (4.1) y el estado de la hoja (3.5).
// Los casos 4 y 9 (charlas y marcas de contexto) son de la entrega P2.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as tareas from '../src/tareas.js'
import {
  MAX_NOMBRE_PROYECTO, MAX_INSTRUCCIONES, validarNombreProyecto, validarInstrucciones, colorSiguiente, textoArchivos,
  lineaProyecto, textoBorrar, lineaBorrar, alEscProyectos, esAtajoProyectos, nombreFilaProyectos, subtituloProyectos,
  textoErrorNombre, textoErrorInstrucciones, textoMotivoCarpeta, etiquetaCarpeta, pieSoltar, previaCarpetaAvis, abreviarRuta,
  anuncioElegido, focoTrasBorrar, textoRotos, cuentaInstrucciones, nuevoIdProyecto, proyectosInicial, abrirProyectos,
  cerrarProyectos, elegirProyecto, empezarNuevo, empezarEditar, editarForm, hayCambios, cerrarFormulario, elegidoValido,
  revisarFormulario, conPerdida,
} from '../src/proyectos.js'

const pro = (id, nombre, extra = {}) => ({
  v: 1, id, nombre, color: 'ambar', orden: 0, creado: 1764100000000, instrucciones: '',
  carpeta: { nombre: nombre, ruta: `C:\\Users\\q\\Documents\\Avis\\${nombre}`, tipo: 'avis', estado: 'ok', archivos: 0 }, ...extra,
})
const PRESU = pro('p-presu', 'Presupuestos 2027', { carpeta: { nombre: 'Presupuestos 2027', ruta: 'C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027', tipo: 'avis', estado: 'ok', archivos: 3 } })
const LECT = pro('p-lect', 'Lecturas', { orden: 1, color: 'celeste' })
const MUD = pro('p-mud', 'Mudanza', { orden: 2, color: 'verde', carpeta: { nombre: 'Mudanza', ruta: 'D:\\Mudanza', tipo: 'pc', estado: 'perdida', archivos: 0 } })

// ------------------------------------------------------------------ 1. validarNombreProyecto

test('validarNombreProyecto: vacío y solo espacios, 41 letras, repetido sin mayúsculas ni tildes, y el propio al editar (caso 1)', () => {
  assert.equal(MAX_NOMBRE_PROYECTO, 40)
  assert.deepEqual(validarNombreProyecto('', [PRESU]), { ok: false, motivo: 'vacio' })
  assert.deepEqual(validarNombreProyecto('    ', [PRESU]), { ok: false, motivo: 'vacio' })
  assert.deepEqual(validarNombreProyecto('a'.repeat(41), [PRESU]), { ok: false, motivo: 'largo' })
  assert.deepEqual(validarNombreProyecto('a'.repeat(40), [PRESU]), { ok: true, nombre: 'a'.repeat(40) })
  assert.deepEqual(validarNombreProyecto('presupuestos 2027', [PRESU, LECT]), { ok: false, motivo: 'repetido' })
  assert.deepEqual(validarNombreProyecto('  PRESUPUÉSTOS 2027 ', [PRESU]), { ok: false, motivo: 'repetido' })
  assert.deepEqual(validarNombreProyecto('presupuestos 2027', [PRESU], 'p-presu'), { ok: true, nombre: 'presupuestos 2027' })
  assert.deepEqual(validarNombreProyecto('  Mudanza 2 ', [PRESU]), { ok: true, nombre: 'Mudanza 2' })
})

test('los errores del nombre y de las instrucciones son los de 5.2', () => {
  assert.equal(textoErrorNombre('vacio'), 'Ponele un nombre.')
  assert.equal(textoErrorNombre('repetido'), 'Ya hay un proyecto con ese nombre.')
  assert.equal(textoErrorNombre('largo'), 'Hasta 40 letras.')
  assert.equal(textoErrorNombre(undefined), null)
  assert.equal(textoErrorInstrucciones('largo'), 'Hasta 4000 caracteres.')
  assert.equal(textoErrorInstrucciones(undefined), null)
})

// ------------------------------------------------------------------ 2. validarInstrucciones

test('validarInstrucciones: 4000 sirve, 4001 es largo (caso 2)', () => {
  assert.equal(MAX_INSTRUCCIONES, 4000)
  assert.deepEqual(validarInstrucciones('é'.repeat(4000)), { ok: true, texto: 'é'.repeat(4000) })
  assert.deepEqual(validarInstrucciones('x'.repeat(4001)), { ok: false, motivo: 'largo' })
  assert.deepEqual(validarInstrucciones(''), { ok: true, texto: '' })
  assert.deepEqual(validarInstrucciones(null), { ok: true, texto: '' })
})

test('cuentaInstrucciones: «{n} de 4000» solo cerca del tope (4.10)', () => {
  assert.equal(cuentaInstrucciones('x'.repeat(100)), null)
  assert.equal(cuentaInstrucciones('x'.repeat(3600)), '3600 de 4000')
  assert.equal(cuentaInstrucciones('x'.repeat(4001)), '4001 de 4000')
})

// ------------------------------------------------------------------ 3. colorSiguiente

test('colorSiguiente: el de tareas.js, rota por los seis colores (caso 3)', () => {
  assert.equal(colorSiguiente, tareas.colorSiguiente)
  assert.equal(colorSiguiente([]), 'celeste')
  const seis = ['celeste', 'verde', 'rosa', 'violeta', 'ambar', 'rojo']
  for (let i = 0; i < 6; i++) assert.equal(colorSiguiente([pro('p-a', 'A', { color: seis[i], orden: i })]), seis[(i + 1) % 6])
})

test('nuevoIdProyecto: un id p-… que Rust acepta y que no repite uno usado', () => {
  const id = nuevoIdProyecto(1764100000000, () => 0.5)
  assert.match(id, /^p-[a-z0-9-]{1,38}$/)
  const otro = nuevoIdProyecto(1764100000000, (() => { let k = 0; return () => (k++ < 1 ? 0.5 : 0.25) })(), new Set([id]))
  assert.notEqual(otro, id)
})

// ------------------------------------------------------------------ 5. lineaProyecto

test('lineaProyecto: los tres casos de 5.1 y los plurales (caso 5)', () => {
  assert.equal(lineaProyecto(PRESU, 3), '3 charlas · 3 archivos')
  assert.equal(lineaProyecto(PRESU, 1), '1 charla · 3 archivos')
  assert.equal(lineaProyecto(PRESU, 0), 'sin charlas todavía · 3 archivos')
  assert.equal(lineaProyecto({ ...PRESU, carpeta: { ...PRESU.carpeta, archivos: 1 } }, 2), '2 charlas · 1 archivo')
  assert.equal(lineaProyecto({ ...PRESU, carpeta: { ...PRESU.carpeta, archivos: 1000 } }, 2), '2 charlas · 999+ archivos')
  assert.equal(lineaProyecto(MUD, 4), '4 charlas · carpeta perdida')
  assert.equal(textoArchivos(0), '0 archivos')
  assert.equal(textoArchivos(999), '999 archivos')
  assert.equal(textoArchivos(1000), '999+ archivos')
})

test('subtituloProyectos: «{n} proyectos · {m} charlas», «1 proyecto · …» o «Ninguno todavía» (5.1)', () => {
  assert.equal(subtituloProyectos([], 0), 'Ninguno todavía')
  assert.equal(subtituloProyectos([PRESU], 0), '1 proyecto · 0 charlas')
  assert.equal(subtituloProyectos([PRESU, LECT, MUD], 7), '3 proyectos · 7 charlas')
  assert.equal(subtituloProyectos([PRESU, LECT], 1), '2 proyectos · 1 charla')
})

test('la carpeta del proyecto: su etiqueta, el pie de la zona de soltar y la ruta abreviada (4.7, 5.1)', () => {
  assert.equal(etiquetaCarpeta(PRESU.carpeta), 'La creó Avis · 3 archivos')
  assert.equal(etiquetaCarpeta({ ...MUD.carpeta, estado: 'ok', archivos: 1 }), 'De tu PC · 1 archivo')
  assert.equal(pieSoltar(3), '3 adentro · Abrir en el Explorador')
  assert.equal(pieSoltar(0), 'vacía · o abrila en el Explorador')
  assert.equal(abreviarRuta('C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027'), 'C:\\…\\Avis\\Presupuestos 2027')
  assert.equal(abreviarRuta('D:\\Mudanza'), 'D:\\Mudanza')
  assert.equal(abreviarRuta('D:\\Casa\\Mudanza'), 'D:\\Casa\\Mudanza')
  assert.equal(abreviarRuta(''), '')
})

test('previaCarpetaAvis: «Documentos › Avis › {nombre}. Soltás ahí los archivos.» mientras se escribe (4.10)', () => {
  assert.equal(previaCarpetaAvis('Presupuestos 2027'), 'Documentos › Avis › Presupuestos 2027. Soltás ahí los archivos.')
  assert.equal(previaCarpetaAvis('  '), 'Documentos › Avis › Proyecto. Soltás ahí los archivos.')
})

test('textoMotivoCarpeta: la carpeta rechazada o que no se pudo crear (5.2)', () => {
  assert.equal(textoMotivoCarpeta('grande'), 'Esa carpeta es muy grande para que Claude la lea: elegí una más adentro.')
  assert.equal(textoMotivoCarpeta('red'), 'Las carpetas de red todavía no se pueden usar.')
  assert.equal(textoMotivoCarpeta('crear'), 'No se pudo crear la carpeta en Documentos. Probá de nuevo o elegí una de esta PC.')
  assert.equal(textoMotivoCarpeta('no-existe'), 'No se pudo guardar el proyecto. Probá de nuevo.')
  assert.equal(textoMotivoCarpeta(undefined), 'No se pudo guardar el proyecto. Probá de nuevo.')
})

test('textoRotos y anuncioElegido (5.2, 5.3)', () => {
  assert.equal(textoRotos(1), '1 proyecto no se pudo leer. Sigue en la carpeta, sin tocar.')
  assert.equal(textoRotos(2), '2 proyectos no se pudieron leer. Siguen en la carpeta, sin tocar.')
  assert.equal(anuncioElegido(PRESU, 3), 'Presupuestos 2027, 3 charlas')
  assert.equal(anuncioElegido(PRESU, 1), 'Presupuestos 2027, 1 charla')
})

// ------------------------------------------------------------------ 6. textoBorrar

test('textoBorrar: 0, 1 y 3 charlas (caso 6, 4.11) y la línea de debajo (5.1)', () => {
  assert.equal(textoBorrar(0), '¿Borrar? Sí')
  assert.equal(textoBorrar(1), '¿Borrar con 1 charla? Sí')
  assert.equal(textoBorrar(3), '¿Borrar con 3 charlas? Sí')
  assert.equal(lineaBorrar(0), 'Se va el proyecto. La carpeta y sus archivos quedan en tu PC. Esc cancela.')
  assert.equal(lineaBorrar(3), 'Se van el proyecto y sus 3 charlas. La carpeta y sus archivos quedan en tu PC. Esc cancela.')
})

// ------------------------------------------------------------------ 7. alEscProyectos

test('alEscProyectos: una capa por vez, en el orden de 9.1 (caso 7)', () => {
  const base = elegirProyecto(abrirProyectos({ ...proyectosInicial(), lista: [PRESU, LECT] }), 'p-presu')
  // 1) borrado armado: se desarma, aunque haya un formulario abierto
  assert.equal(alEscProyectos({ ...base, armado: { id: 'borrar:p-presu', hasta: 1 } }), 'desarmar')
  // 2) formulario con cambios: avisa; el segundo Esc descarta
  const nuevo = editarForm(empezarNuevo(base), 'nombre', 'Mudanza')
  assert.equal(alEscProyectos(nuevo), 'avisar-descartar')
  assert.equal(alEscProyectos({ ...nuevo, form: { ...nuevo.form, aviso: true } }), 'descartar')
  // 3) formulario sin cambios: vuelve al proyecto
  assert.equal(alEscProyectos(empezarNuevo(base)), 'cerrar-form')
  assert.equal(alEscProyectos(empezarEditar(base, 'p-presu')), 'cerrar-form')
  // 4) la última: Sesiones
  assert.equal(alEscProyectos(base), 'cerrar')
})

test('hayCambios: lo que se escribió, el color o la carpeta del formulario contra lo que tenía', () => {
  const t = elegirProyecto(abrirProyectos({ ...proyectosInicial(), lista: [PRESU] }), 'p-presu')
  const ed = empezarEditar(t, 'p-presu')
  assert.equal(hayCambios(ed.form), false)
  assert.equal(hayCambios(editarForm(ed, 'instrucciones', 'Otras').form), true)
  assert.equal(hayCambios(editarForm(ed, 'color', 'verde').form), true)
  assert.equal(hayCambios(editarForm(editarForm(ed, 'nombre', 'X'), 'nombre', PRESU.nombre).form), false)
  const nu = empezarNuevo(t)
  assert.equal(hayCambios(editarForm(nu, 'carpeta', 'elegir').form), true)
  assert.equal(hayCambios(null), false)
})

// ------------------------------------------------------------------ 8. esAtajoProyectos

test('esAtajoProyectos: Ctrl P sí; Ctrl Shift P, Alt Ctrl P y P solo, no (caso 8)', () => {
  assert.equal(esAtajoProyectos({ key: 'p', ctrlKey: true }), true)
  assert.equal(esAtajoProyectos({ key: 'P', ctrlKey: true }), true)
  assert.equal(esAtajoProyectos({ key: 'P', ctrlKey: true, shiftKey: true }), false)
  assert.equal(esAtajoProyectos({ key: 'p', ctrlKey: true, altKey: true }), false)
  assert.equal(esAtajoProyectos({ key: 'p', ctrlKey: true, metaKey: true }), false)
  assert.equal(esAtajoProyectos({ key: 'p' }), false)
})

// ------------------------------------------------------------------ 10. nombreFilaProyectos

test('nombreFilaProyectos: los tres nombres de 4.1 (caso 10)', () => {
  assert.equal(nombreFilaProyectos([]), 'Proyectos')
  assert.equal(nombreFilaProyectos(null), 'Proyectos')
  assert.equal(nombreFilaProyectos([PRESU, LECT, { ...LECT, id: 'p-otro' }]), 'Proyectos, 3')
  assert.equal(nombreFilaProyectos([PRESU, LECT, MUD]), 'Proyectos, 3, 1 con la carpeta perdida')
  assert.equal(conPerdida([PRESU, MUD, { ...MUD, id: 'p-2' }]), 2)
})

// ------------------------------------------------------------------ estado de la hoja (3.1, 3.5, 9.4)

test('abrir la hoja: el último elegido de esta ejecución, la primera vez el primero; un pedido gana', () => {
  const t = { ...proyectosInicial(), lista: [PRESU, LECT] }
  assert.equal(proyectosInicial().abierta, false)
  assert.equal(elegidoValido(abrirProyectos(t)).elegido, 'p-presu')
  assert.equal(elegidoValido(abrirProyectos({ ...t, elegido: 'p-lect' })).elegido, 'p-lect')
  assert.equal(elegidoValido(abrirProyectos(t, 'p-lect')).elegido, 'p-lect')
  // Uno que ya no existe (borrado, o un archivo que se rompió) pasa al primero; sin proyectos, ninguno
  assert.equal(elegidoValido({ ...t, elegido: 'p-borrado' }).elegido, 'p-presu')
  assert.equal(elegidoValido({ ...proyectosInicial(), elegido: 'p-x' }).elegido, null)
  // Cerrar descarta el formulario y desarma; el elegido queda para la próxima vez
  const c = cerrarProyectos({ ...empezarNuevo(abrirProyectos(t, 'p-lect')), armado: { id: 'x', hasta: 1 } })
  assert.deepEqual([c.abierta, c.vista, c.form, c.armado, c.elegido], [false, 'proyecto', null, null, 'p-lect'])
})

test('el formulario: Nuevo con el color siguiente y «Que Avis cree una»; Editar con los datos; cerrar vuelve al proyecto', () => {
  const t = elegirProyecto(abrirProyectos({ ...proyectosInicial(), lista: [PRESU, LECT] }), 'p-lect')
  const nu = empezarNuevo(t)
  assert.equal(nu.vista, 'nuevo')
  assert.deepEqual({ nombre: nu.form.nombre, instrucciones: nu.form.instrucciones, carpeta: nu.form.carpeta, color: nu.form.color, aviso: nu.form.aviso }, { nombre: '', instrucciones: '', carpeta: 'avis', color: 'verde', aviso: false })
  const ed = empezarEditar(t, 'p-presu')
  assert.equal(ed.vista, 'editar')
  assert.equal(ed.form.id, 'p-presu')
  assert.equal(ed.form.nombre, 'Presupuestos 2027')
  assert.equal(ed.form.color, 'ambar')
  const vuelta = cerrarFormulario(ed)
  assert.deepEqual([vuelta.vista, vuelta.form], ['proyecto', null])
  // Escribir algo después del aviso de descartar lo saca (el próximo Esc vuelve a avisar)
  assert.equal(editarForm({ ...nu, form: { ...nu.form, aviso: true } }, 'nombre', 'M').form.aviso, false)
})

test('revisarFormulario: los errores de cada campo o los datos para Rust (sin carpeta en Editar)', () => {
  const t = elegirProyecto(abrirProyectos({ ...proyectosInicial(), lista: [PRESU, LECT] }), 'p-presu')
  assert.deepEqual(revisarFormulario(empezarNuevo(t).form, t.lista).errores, { nombre: 'vacio' })
  const largo = editarForm(editarForm(empezarNuevo(t), 'nombre', 'Lecturas'), 'instrucciones', 'x'.repeat(4001))
  assert.deepEqual(revisarFormulario(largo.form, t.lista).errores, { nombre: 'repetido', instrucciones: 'largo' })
  const bien = editarForm(editarForm(empezarNuevo(t), 'nombre', '  Mudanza '), 'instrucciones', 'Cajas')
  assert.deepEqual(revisarFormulario(bien.form, t.lista), { ok: true, errores: {}, nombre: 'Mudanza', instrucciones: 'Cajas' })
  // Editar: el propio nombre sirve
  assert.equal(revisarFormulario(empezarEditar(t, 'p-presu').form, t.lista).ok, true)
})

test('focoTrasBorrar: la fila siguiente, o la anterior, o «+ Nuevo» (9.4)', () => {
  const lista = [PRESU, LECT, MUD]
  assert.equal(focoTrasBorrar(lista, 'p-presu'), 'p-lect')
  assert.equal(focoTrasBorrar(lista, 'p-mud'), 'p-lect')
  assert.equal(focoTrasBorrar([PRESU], 'p-presu'), null)
})
