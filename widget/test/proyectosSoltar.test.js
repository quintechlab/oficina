// Tests de soltar archivos en la carpeta de un proyecto (#44, docs/diseno/proyectos-ux.md 4.7, 5.2, 5.3,
// 10 y 11.2, entrega P3): solo en una carpeta creada por Avis y que está; los textos de 5.2 y 5.3 a partir
// de lo que devuelve `proyecto_soltar`; el estado de la zona (encima, copiando, el error) y su HTML. Lo de
// antes (la zona sin soltar, la carpeta de la PC) sigue igual.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TOPE_SOLTAR, puedeSoltar, textoCopiados, textoCopiadoComo, textoNoCopiado, textoTopeSoltar, textosSoltado, soltarFallido,
  zonaEncima, empezarSoltar, terminarSoltar, soltarDe, proyectosInicial, abrirProyectos, elegirProyecto,
} from '../src/proyectos.js'
import { fichaProyecto } from '../src/proyectosVista.js'

const car = (tipo, ruta, archivos = 0, estado = 'ok') => ({ nombre: ruta.split('\\').pop(), ruta, tipo, estado, archivos })
const pro = (id, nombre, carpeta) => ({ v: 1, id, nombre, color: 'ambar', orden: 0, creado: 1, instrucciones: '', carpeta })
const PRESU = pro('p-presu', 'Presupuestos 2027', car('avis', 'C:\\Users\\q\\Documents\\Avis\\Presupuestos 2027', 3))
const LECT = pro('p-lect', 'Lecturas', car('pc', 'D:\\Libros\\Lecturas', 12))
const MUD = pro('p-mud', 'Mudanza', car('avis', 'C:\\Users\\q\\Documents\\Avis\\Mudanza', 0, 'perdida'))

test('puedeSoltar: solo una carpeta creada por Avis que está (S6, D-p17); la de la PC, perdida o sin carpeta, no', () => {
  assert.equal(TOPE_SOLTAR, 20)
  assert.equal(puedeSoltar(PRESU), true)
  assert.equal(puedeSoltar(LECT), false)
  assert.equal(puedeSoltar(MUD), false)
  assert.equal(puedeSoltar(pro('p-sin', 'Sin', null)), false)
  assert.equal(puedeSoltar(null), false)
})

test('los textos de 5.2 y 5.3: «Copiados {n} archivos a {carpeta}», «Copiado como {nombre} (2)», «No se pudo copiar {nombre}.»', () => {
  assert.equal(textoCopiados(3, 'Presupuestos 2027'), 'Copiados 3 archivos a Presupuestos 2027')
  assert.equal(textoCopiados(1, 'Presupuestos 2027'), 'Copiado 1 archivo a Presupuestos 2027')
  assert.equal(textoCopiadoComo('informe (2).pdf'), 'Copiado como informe (2)')
  assert.equal(textoCopiadoComo('LEEME (2)'), 'Copiado como LEEME (2)')
  assert.equal(textoCopiadoComo('.env (2)'), 'Copiado como .env (2)')
  assert.equal(textoNoCopiado('Fotos'), 'No se pudo copiar Fotos.')
  assert.equal(textoTopeSoltar(1), 'Van hasta 20 archivos por vez: 1 quedó sin copiar.')
  assert.equal(textoTopeSoltar(3), 'Van hasta 20 archivos por vez: 3 quedaron sin copiar.')
})

test('textosSoltado: tres con uno repetido se anuncian juntos y sin error a la vista', () => {
  const r = { copiados: ['tarifas.xlsx', 'informe (2).pdf', 'notas.md'], renombrados: [{ nombre: 'informe.pdf', como: 'informe (2).pdf' }], fallidos: [] }
  assert.deepEqual(textosSoltado(r, 'Presupuestos 2027'), {
    anuncio: 'Copiados 3 archivos a Presupuestos 2027. Copiado como informe (2).',
    error: null,
  })
})

test('textosSoltado: una carpeta soltada no se copia («No se pudo copiar {nombre}.», el resto sigue)', () => {
  const r = { copiados: ['a.txt'], renombrados: [], fallidos: [{ nombre: 'Fotos', motivo: 'carpeta' }, { nombre: 'pesado.iso', motivo: 'grande' }] }
  assert.deepEqual(textosSoltado(r, 'Presupuestos 2027'), {
    anuncio: 'Copiado 1 archivo a Presupuestos 2027. No se pudo copiar Fotos. No se pudo copiar pesado.iso.',
    error: 'No se pudo copiar Fotos. No se pudo copiar pesado.iso.',
  })
  const solo = textosSoltado({ copiados: [], renombrados: [], fallidos: [{ nombre: 'Fotos', motivo: 'carpeta' }] }, 'X')
  assert.deepEqual(solo, { anuncio: 'No se pudo copiar Fotos.', error: 'No se pudo copiar Fotos.' })
})

test('textosSoltado: 21 archivos → los 20 primeros y el aviso del tope (no un «No se pudo copiar» por cada uno)', () => {
  const copiados = Array.from({ length: 20 }, (_, i) => `f${i + 1}.txt`)
  const r = { copiados, renombrados: [], fallidos: [{ nombre: 'f21.txt', motivo: 'tope' }] }
  assert.deepEqual(textosSoltado(r, 'Presupuestos 2027'), {
    anuncio: 'Copiados 20 archivos a Presupuestos 2027. Van hasta 20 archivos por vez: 1 quedó sin copiar.',
    error: 'Van hasta 20 archivos por vez: 1 quedó sin copiar.',
  })
})

test('textosSoltado: una respuesta rara no rompe; soltarFallido (Rust no copió nada): un texto por archivo', () => {
  assert.deepEqual(textosSoltado(null, 'X'), { anuncio: '', error: null })
  assert.deepEqual(soltarFallido(['C:\\Descargas\\a.pdf', 'C:\\Descargas\\b.txt']), {
    anuncio: 'No se pudo copiar a.pdf. No se pudo copiar b.txt.',
    error: 'No se pudo copiar a.pdf. No se pudo copiar b.txt.',
  })
})

test('el estado de la zona: encima sin redibujar de más, copiando, el error, y elegir otro proyecto lo olvida', () => {
  const t = elegirProyecto(abrirProyectos({ ...proyectosInicial(), lista: [PRESU, LECT] }), 'p-presu')
  assert.equal(t.soltar, null)
  assert.equal(soltarDe(t, 'p-presu'), null)
  const encima = zonaEncima(t, 'p-presu', true)
  assert.deepEqual(soltarDe(encima, 'p-presu'), { id: 'p-presu', encima: true, copiando: false, error: null })
  assert.equal(zonaEncima(encima, 'p-presu', true), encima)
  assert.equal(zonaEncima(t, 'p-presu', false), t)
  assert.equal(soltarDe(zonaEncima(encima, 'p-presu', false), 'p-presu').encima, false)
  const copiando = empezarSoltar(encima, 'p-presu')
  assert.deepEqual(copiando.soltar, { id: 'p-presu', encima: false, copiando: true, error: null })
  const listo = terminarSoltar(copiando, 'p-presu', 'No se pudo copiar Fotos.')
  assert.deepEqual(listo.soltar, { id: 'p-presu', encima: false, copiando: false, error: 'No se pudo copiar Fotos.' })
  assert.equal(soltarDe(listo, 'p-lect'), null)
  assert.equal(elegirProyecto(listo, 'p-lect').soltar, null)
  // Mientras copia, elegir otro no pierde la copia en curso
  assert.equal(elegirProyecto(copiando, 'p-lect').soltar, copiando.soltar)
})

test('fichaProyecto con la zona: encima (hormigas), copiando (aria-busy) y el error debajo; sin soltar, el HTML de antes', () => {
  const antes = fichaProyecto({ p: PRESU })
  assert.equal(fichaProyecto({ p: PRESU, soltar: null }), antes)
  assert.match(antes, /<button type="button" class="soltar" data-accion="pro-abrir-carpeta" data-k="soltar">Soltá archivos acá<small>3 adentro · Abrir en el Explorador<\/small><\/button>/)
  const encima = fichaProyecto({ p: PRESU, soltar: { id: 'p-presu', encima: true, copiando: false, error: null } })
  assert.match(encima, /<button type="button" class="soltar encima" data-accion="pro-abrir-carpeta" data-k="soltar">Soltá archivos acá/)
  const copiando = fichaProyecto({ p: PRESU, soltar: { id: 'p-presu', encima: false, copiando: true, error: null } })
  assert.match(copiando, /class="soltar encima" aria-busy="true" data-accion="pro-abrir-carpeta"/)
  const error = fichaProyecto({ p: PRESU, soltar: { id: 'p-presu', encima: false, copiando: false, error: 'No se pudo copiar Fotos.' } })
  assert.match(error, /class="soltar" data-accion/)
  assert.ok(error.indexOf('No se pudo copiar Fotos.') > error.indexOf('Soltá archivos acá'))
  // Recién creado (7.3): sigue encendida, y encima suma la clase
  const recien = fichaProyecto({ p: { ...PRESU, carpeta: { ...PRESU.carpeta, archivos: 0 } }, soltar: { id: 'p-presu', encima: true, copiando: false, error: null } })
  assert.match(recien, /class="soltar vivo encima"/)
  // De la PC: nunca hay zona, aunque llegue un estado de soltar
  const pc = fichaProyecto({ p: LECT, soltar: { id: 'p-lect', encima: true, copiando: false, error: null } })
  assert.doesNotMatch(pc, /class="soltar/)
})

// ------------------------------------------------------------------ cableado en main.js (11.2 y la hoja de la charla)
import { readFileSync } from 'node:fs'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
/** El cuerpo de una función de main.js (de `function nombre(` hasta la llave que la cierra en la columna 0). */
function cuerpo(nombre) {
  const desde = main.search(new RegExp(`^(async )?function ${nombre}[(]`, 'm'))
  assert.notEqual(desde, -1, `main.js ya no declara ${nombre}`)
  return main.slice(desde, main.indexOf('\n}\n', desde) + 2)
}

test('la ventana nunca manda el destino: proyecto_soltar recibe solo el id del proyecto y las rutas que dio Tauri (11.2)', () => {
  const llamadas = main.match(/invocar\('proyecto_soltar'[^)]*\)/g) ?? []
  assert.deepEqual(llamadas, ["invocar('proyecto_soltar', { id, rutas })"])
})

test('soltar sobre la hoja de la charla sigue como antes (E5): la hoja manda y la zona del proyecto no cuenta encima de ella', () => {
  const f = cuerpo('alArrastrarArchivo')
  assert.match(f, /const zona = p\.type !== 'leave' && !sobre \? zonaSoltarBajo\(p\.position\) : null/)
  assert.match(f, /if \(p\.type === 'drop' && sobre\) \{\n {4}const rutas = rutasArrastre\n {4}rutasArrastre = \[\]\n {4}centroSoltar = movimientoChat\.fundirCapa\(\$\('#chat-soltar \.soltar'\)\)\n {4}despacharChat\(\{ tipo: 'soltado', rutas \}\)\n {4}return\n {2}\}/)
  assert.match(f, /const nombre = sobre && p\.type !== 'drop' \? nombreArchivo\(rutasArrastre\[0\]\) \|\| 'archivo' : null/)
  // La zona solo con la hoja de Proyectos a la vista y una carpeta creada por Avis
  assert.match(cuerpo('zonaSoltarBajo'), /puedeSoltar\(/)
  assert.match(cuerpo('soltarEnProyecto'), /puedeSoltar\(/)
})

test('copiando, la zona dice «Copiando…» en lugar de «Soltá archivos acá» (L14 de odd/tasks/proyectos.md)', () => {
  const copiando = fichaProyecto({ p: PRESU, soltar: { id: 'p-presu', encima: false, copiando: true, error: null } })
  assert.match(copiando, /aria-busy="true" data-accion="pro-abrir-carpeta" data-k="soltar">Copiando…<small>/)
  assert.doesNotMatch(copiando, /Soltá archivos acá/)
  const encima = fichaProyecto({ p: PRESU, soltar: { id: 'p-presu', encima: true, copiando: false, error: null } })
  assert.match(encima, /data-k="soltar">Soltá archivos acá<small>/)
})
