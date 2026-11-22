// Tests de "¿En qué anda Claude?" (docs/diseno/resumen-ia-ux.md): la máquina de estados del globo,
// los datos que se le pasan al modelo con sus topes, los textos por estado, los avisos para el lector
// de pantalla y la voz del Avi. Funciones puras de resumen.js (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ESTADOS_RESUMEN, TOPES_RESUMEN, MOTIVOS_FALLO, EVENTOS_BACKEND, ESPERA_PENSANDO_MS, resumenInicial, transicion,
  datosResumen, firmaResumen, textoPensando, formatoGB, formatoSegundos, formatoHora, limpiarTexto, partesTexto,
  htmlTexto, contenidoResumen, anuncioResumen, vozAvi, colaResumen, duracionContando, contarPalabras, animoTexto, lineaAbrir,
  actividadParaResumen, ACTIVIDAD_QUIETA,
} from '../src/resumen.js'
import { agruparPorProyecto } from '../src/logica.js'

const AHORA = Date.parse('2026-11-21T17:32:00Z')
const MIN = 60000
const hace = ms => new Date(AHORA - ms).toISOString()
const GB = 1024 ** 3
const TOTAL = Math.round(2.6 * GB)

const sesion = (extra = {}) => ({
  v: 1, sesion: 's1', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando', repo: 'quintechlab/oficina',
  rama: 'feat/11-resumen-ia', tarea: 11, nota: 'nota privada', inicio: hace(42 * MIN), actualizado: hace(5000),
  archivos: ['widget/src/main.js'], actividad: 'editando main.js', agentes: [], preguntas: [], procesos: [], ...extra,
})
const sub = (id, nombre, estado = 'trabajando', extra = {}) => ({ id, nombre, tipo: 'general-purpose', tarea: `tarea de ${nombre}`, desde: hace(4 * MIN), estado, hasta: estado === 'trabajando' ? null : hace(MIN), ...extra })
const proyectos = (...ses) => agruparPorProyecto(ses)

/** El resumen en un estado abierto o con trabajo en curso, para probar las transiciones. */
const en = (estado, extra = {}) => ({ ...resumenInicial(), modelo: 'listo', estado, ...extra })
const ctx = { ahoraMs: AHORA, datos: { proyectos: [] } }
const paso = (r, evento) => transicion(r, evento, ctx)
const comandos = res => res.llamadas.map(l => l.comando)

// ------------------------------------------------------------------ 6.1 transiciones

test('los 8 estados del globo', () => {
  assert.deepEqual(ESTADOS_RESUMEN, ['cerrado', 'apagado', 'descargando', 'preparando', 'pensando', 'listo', 'sinModelo', 'fallo'])
  assert.equal(resumenInicial().estado, 'cerrado')
  assert.equal(ESPERA_PENSANDO_MS, 60000)
})

test('un clic, nunca solo: ningún evento del backend lleva de cerrado o apagado a descargando o pensando', () => {
  const ejemplos = {
    estado: [{ modelo: 'listo', bajado: TOTAL, total: TOTAL, motor: 'listo' }, { modelo: 'falta', bajado: 0, total: TOTAL }, { modelo: 'roto' }],
    progreso: [{ bajado: 10, total: TOTAL }], bajado: [{ total: TOTAL }], preparando: [{ pedido: 0, primeraVez: true }, { pedido: 1 }],
    pensando: [{ pedido: 0 }, { pedido: 1 }], listo: [{ pedido: 0, texto: 'Hola.', ms: 3000 }, { pedido: 1, texto: 'Hola.' }],
    fallo: [{ motivo: 'cerrado' }, { pedido: 0, motivo: 'tiempo' }, { motivo: 'falta' }], cancelado: [{}, { pedido: 0 }],
  }
  assert.deepEqual(Object.keys(ejemplos).sort(), [...EVENTOS_BACKEND].sort())
  const desde = [resumenInicial(), { ...resumenInicial(), modelo: 'falta' }, en('apagado', { modelo: 'falta' }), en('cerrado'), en('listo', { resultado: 'listo', texto: 'x' })]
  for (const r of desde) {
    for (const [tipo, lista] of Object.entries(ejemplos)) {
      for (const datos of lista) {
        const res = paso(r, { tipo, ...datos })
        assert.ok(!['descargando', 'pensando', 'preparando'].includes(res.resumen.estado), `${tipo} desde ${r.estado}`)
        assert.ok(!res.resumen.trabajo, `${tipo} no arranca trabajo desde ${r.estado}`)
        assert.deepEqual(res.llamadas, [], `${tipo} no llama a nada`)
      }
    }
  }
  // Solo las acciones del usuario empiezan trabajo
  assert.deepEqual(comandos(paso(en('apagado', { modelo: 'falta' }), { tipo: 'descargar' })), ['descargar_modelo'])
  assert.deepEqual(comandos(paso(en('listo', { resultado: 'listo' }), { tipo: 'pedir' })), ['pedir_resumen'])
})

test('tocar el Avi con el globo cerrado: apagado, sin modelo, lo que está en curso, el resultado sin ver o un pedido', () => {
  assert.equal(paso({ ...resumenInicial(), modelo: 'falta' }, { tipo: 'abrir' }).resumen.estado, 'apagado')
  assert.equal(paso(resumenInicial(), { tipo: 'abrir' }).resumen.estado, 'apagado', 'sin saber del modelo, apagado')
  assert.equal(paso({ ...resumenInicial(), modelo: 'roto' }, { tipo: 'abrir' }).resumen.estado, 'sinModelo')
  for (const trabajo of ['descargando', 'preparando', 'pensando']) {
    const res = paso(en('cerrado', { trabajo }), { tipo: 'abrir' })
    assert.equal(res.resumen.estado, trabajo)
    assert.deepEqual(res.llamadas, [])
  }
  const sinVer = paso(en('cerrado', { resultado: 'listo', texto: 'Hola.', sinVer: true }), { tipo: 'abrir' })
  assert.equal(sinVer.resumen.estado, 'listo')
  assert.equal(sinVer.resumen.sinVer, false)
  assert.deepEqual(sinVer.llamadas, [])
  const pide = paso(en('cerrado', { pedido: 4 }), { tipo: 'abrir' })
  assert.equal(pide.resumen.estado, 'pensando')
  assert.deepEqual(pide.llamadas, [{ comando: 'pedir_resumen', args: { pedido: 5, datos: ctx.datos } }])
})

test('cerrar nunca cancela: con descarga, preparación o pedido en curso, el trabajo sigue', () => {
  for (const estado of ['descargando', 'preparando', 'pensando']) {
    const res = paso(en(estado, { trabajo: estado }), { tipo: 'cerrar' })
    assert.equal(res.resumen.estado, 'cerrado')
    assert.equal(res.resumen.trabajo, estado)
    assert.ok(!comandos(res).includes('cancelar_resumen'))
  }
  for (const estado of ['apagado', 'listo', 'sinModelo', 'fallo']) assert.equal(paso(en(estado), { tipo: 'cerrar' }).resumen.estado, 'cerrado')
})

test('cancelar: la descarga vuelve a apagado; preparando y pensando, a cerrado (no ofrece descargar)', () => {
  const baja = paso(en('descargando', { trabajo: 'descargando', modelo: 'bajando', progreso: { bajado: GB, total: TOTAL } }), { tipo: 'cancelar' })
  assert.equal(baja.resumen.estado, 'apagado')
  assert.equal(baja.resumen.trabajo, null)
  assert.deepEqual(baja.resumen.progreso, { bajado: GB, total: TOTAL }, 'lo bajado queda para seguir después')
  assert.deepEqual(comandos(baja), ['cancelar_resumen'])
  for (const estado of ['preparando', 'pensando']) {
    const res = paso(en(estado, { trabajo: estado }), { tipo: 'cancelar' })
    assert.equal(res.resumen.estado, 'cerrado')
    assert.deepEqual(comandos(res), ['cancelar_resumen'])
  }
})

test('descarga: el progreso no redibuja el estado; completa, prepara y pide el primer resumen (el clic lo incluía)', () => {
  let r = paso(en('apagado', { modelo: 'falta' }), { tipo: 'descargar' }).resumen
  assert.equal(r.estado, 'descargando')
  r = paso(r, { tipo: 'progreso', bajado: GB, total: TOTAL }).resumen
  assert.equal(r.estado, 'descargando')
  assert.deepEqual(r.progreso, { bajado: GB, total: TOTAL })
  const fin = paso(r, { tipo: 'bajado', total: TOTAL })
  assert.equal(fin.resumen.estado, 'preparando')
  assert.equal(fin.resumen.modelo, 'listo')
  assert.deepEqual(fin.llamadas, [{ comando: 'pedir_resumen', args: { pedido: r.pedido + 1, datos: ctx.datos } }])
  // Con el globo cerrado sigue igual, sin abrirse
  const cerrado = paso({ ...r, estado: 'cerrado' }, { tipo: 'bajado', total: TOTAL })
  assert.equal(cerrado.resumen.estado, 'cerrado')
  assert.equal(cerrado.resumen.trabajo, 'preparando')
  const falla = paso(r, { tipo: 'fallo', motivo: 'descarga', detalle: 'HTTP 503' })
  assert.equal(falla.resumen.estado, 'fallo')
  assert.equal(falla.resumen.motivo, 'descarga')
})

test('preparando → pensando → listo con el pedido vigente; un resultado con un pedido viejo se descarta', () => {
  let r = en('preparando', { trabajo: 'preparando', pedido: 3 })
  r = paso(r, { tipo: 'pensando', pedido: 3 }).resumen
  assert.equal(r.estado, 'pensando')
  const viejo = paso(r, { tipo: 'listo', pedido: 2, texto: 'Viejo.' })
  assert.equal(viejo.resumen, r, 'el pedido 2 ya no vale')
  const listo = transicion(r, { tipo: 'listo', pedido: 3, texto: '  Tenés 3 sesiones.  ', ms: 3100, aceleracion: 'gpu' }, { ...ctx, ahoraMs: AHORA })
  assert.equal(listo.resumen.estado, 'listo')
  assert.equal(listo.resumen.texto, 'Tenés 3 sesiones.')
  assert.equal(listo.resumen.ms, 3100)
  assert.equal(listo.resumen.hora, AHORA)
  assert.equal(listo.resumen.sinVer, false)
  // Llega con el globo cerrado: queda sin ver
  const cerrado = paso({ ...r, estado: 'cerrado' }, { tipo: 'listo', pedido: 3, texto: 'Hola.' }).resumen
  assert.equal(cerrado.estado, 'cerrado')
  assert.equal(cerrado.sinVer, true)
  // Después de cancelar, el resultado que llega tarde no se muestra
  const cancelado = paso(r, { tipo: 'cancelar' }).resumen
  assert.equal(paso(cancelado, { tipo: 'listo', pedido: 3, texto: 'Tarde.' }).resumen.resultado, null)
})

test('falló: el texto vacío, el motor que se cierra, 60 s sin respuesta (cancela) y la falta del modelo', () => {
  const r = en('pensando', { trabajo: 'pensando', pedido: 2 })
  const vacio = paso(r, { tipo: 'listo', pedido: 2, texto: '   \n  ' }).resumen
  assert.equal(vacio.estado, 'fallo')
  assert.equal(vacio.motivo, 'vacio')
  const cerrado = paso(r, { tipo: 'fallo', pedido: 2, motivo: 'cerrado', detalle: 'llama-server · código de salida 3221225477' }).resumen
  assert.equal(cerrado.motivo, 'cerrado')
  assert.equal(cerrado.detalle, 'llama-server · código de salida 3221225477')
  const tiempo = paso(r, { tipo: 'vencio', pedido: 2 })
  assert.equal(tiempo.resumen.motivo, 'tiempo')
  assert.deepEqual(comandos(tiempo), ['cancelar_resumen'])
  assert.equal(paso(r, { tipo: 'vencio', pedido: 1 }).resumen, r, 'vence solo el pedido vigente')
  const falta = paso(r, { tipo: 'fallo', pedido: 2, motivo: 'falta' }).resumen
  assert.equal(falta.estado, 'sinModelo')
  assert.equal(paso(r, { tipo: 'fallo', pedido: 2, motivo: 'raro' }).resumen.motivo, 'otro')
})

test('volver a pedir y probar de nuevo: pensando, o descargando si falló la descarga', () => {
  const listo = paso(en('listo', { resultado: 'listo', texto: 'x', pedido: 1 }), { tipo: 'pedir' })
  assert.equal(listo.resumen.estado, 'pensando')
  assert.equal(listo.resumen.pedido, 2)
  const otra = paso(en('fallo', { resultado: 'fallo', motivo: 'cerrado', pedido: 1 }), { tipo: 'reintentar' })
  assert.equal(otra.resumen.estado, 'pensando')
  assert.deepEqual(comandos(otra), ['pedir_resumen'])
  const baja = paso(en('fallo', { resultado: 'fallo', motivo: 'descarga', modelo: 'falta' }), { tipo: 'reintentar' })
  assert.equal(baja.resumen.estado, 'descargando')
  assert.deepEqual(comandos(baja), ['descargar_modelo'])
  const sinModelo = paso(en('sinModelo', { modelo: 'roto' }), { tipo: 'descargar' })
  assert.equal(sinModelo.resumen.estado, 'descargando')
  // Pedir desde un estado que no lo ofrece no hace nada
  assert.deepEqual(paso(en('apagado', { modelo: 'falta' }), { tipo: 'pedir' }).llamadas, [])
})

test('sin rearmado: con el resumen listo, un cambio en los datos solo avisa (cambio: true), nunca pide', () => {
  const datos = datosResumen(proyectos(sesion()), AHORA)
  const r = transicion(en('pensando', { trabajo: 'pensando', pedido: 1 }), { tipo: 'listo', pedido: 1, texto: 'Hola.' }, { ahoraMs: AHORA, datos }).resumen
  const pidio = transicion(en('listo', { resultado: 'listo', texto: 'x' }), { tipo: 'pedir' }, { ahoraMs: AHORA, datos }).resumen
  assert.equal(pidio.firma, firmaResumen(datos), 'la firma es la de los datos con que se pidió')
  const igual = transicion(pidio, { tipo: 'datos' }, { ahoraMs: AHORA + 10 * MIN, datos: datosResumen(proyectos(sesion()), AHORA + 10 * MIN) })
  assert.equal(igual.resumen, pidio)
  const listo = { ...pidio, estado: 'listo', trabajo: null, resultado: 'listo', texto: 'Hola.' }
  const otros = datosResumen(proyectos(sesion({ actividad: 'corriendo npm test' })), AHORA)
  const cambio = transicion(listo, { tipo: 'datos' }, { ahoraMs: AHORA, datos: otros })
  assert.equal(cambio.resumen.estado, 'listo')
  assert.equal(cambio.resumen.cambio, true)
  assert.deepEqual(cambio.llamadas, [])
  assert.ok(r)
})

test('el modelo que se borra (desde la bandeja): el globo vuelve a apagado', () => {
  const r = en('listo', { resultado: 'listo', texto: 'Hola.' })
  const borrado = paso(r, { tipo: 'estado', modelo: 'falta', bajado: 0, total: TOTAL }).resumen
  assert.equal(borrado.estado, 'apagado')
  assert.equal(borrado.resultado, null)
  const cerrado = paso(en('cerrado', { resultado: 'listo', texto: 'x', sinVer: true }), { tipo: 'estado', modelo: 'falta', bajado: 0, total: TOTAL }).resumen
  assert.equal(paso(cerrado, { tipo: 'abrir' }).resumen.estado, 'apagado')
})

test('al arrancar, si Rust ya está bajando el modelo (se recargó la ventana), el globo lo muestra; nunca desde apagado', () => {
  const r = paso(resumenInicial(), { tipo: 'estado', modelo: 'bajando', bajado: GB, total: TOTAL }).resumen
  assert.equal(r.trabajo, 'descargando')
  assert.equal(r.estado, 'cerrado')
  const apagado = paso(en('apagado', { modelo: 'falta' }), { tipo: 'estado', modelo: 'bajando', bajado: GB, total: TOTAL }).resumen
  assert.equal(apagado.trabajo, null)
  assert.equal(apagado.estado, 'apagado')
})

// ------------------------------------------------------------------ 8.3 datos del modelo

test('datos permitidos: sesiones, actividad, subagentes, procesos y el texto de las preguntas', () => {
  const s = sesion({
    agentes: [sub('a1', 'Delfina'), sub('a2', 'Ramiro', 'listo')],
    procesos: [{ id: 'b1', descripcion: 'npm run dev', desde: hace(3 * MIN) }],
    preguntas: [{ id: 'q1', agente: null, desde: hace(MIN), items: [{ pregunta: '¿Mergeo en main?', encabezado: 'Merge', multiple: false, opciones: [{ etiqueta: 'Sí (Recomendada)', descripcion: 'Rápido.' }, { etiqueta: 'No', descripcion: 'PR.' }] }] }],
  })
  const d = datosResumen(proyectos(s), AHORA)
  assert.equal(d.proyectos.length, 1)
  assert.equal(d.proyectos[0].nombre, 'oficina')
  const [ses] = d.proyectos[0].sesiones
  assert.equal(ses.tarea, 11)
  assert.equal(ses.rama, 'feat/11-resumen-ia')
  assert.equal(ses.actividad, 'ahora · te hace una pregunta')
  assert.equal(ses.abierta_hace, '42 min')
  assert.deepEqual(ses.subagentes.map(a => [a.nombre, a.tarea, a.estado]), [['Delfina', 'tarea de Delfina', 'trabajando'], ['Ramiro', 'tarea de Ramiro', 'listo']])
  assert.equal(ses.subagentes[0].desde, '4 min')
  assert.deepEqual(ses.procesos, [{ descripcion: 'npm run dev', desde: '3 min' }])
  assert.deepEqual(ses.preguntas, [{ encabezado: 'Merge', pregunta: '¿Mergeo en main?' }])
  // Nunca: archivos, usuario, nombre de la persona, nota, repo completo, opciones ni respuestas
  const json = JSON.stringify(d)
  for (const prohibido of ['widget/src/main.js', 'nicoequintana', 'Quintana', 'nota privada', 'quintechlab/oficina', 'Recomendada', 'Rápido', 'opciones', 'respuesta']) {
    assert.ok(!json.includes(prohibido), `no pasa "${prohibido}"`)
  }
})

test('datos: topes de 12 sesiones, 6 subagentes y 4 procesos por sesión, 200 caracteres por texto', () => {
  assert.deepEqual(TOPES_RESUMEN, { sesiones: 12, subagentes: 6, procesos: 4, texto: 200, resumen: 600 })
  const muchas = Array.from({ length: 15 }, (_, k) => sesion({
    sesion: `s${k}`, repo: `quintechlab/p${String(k).padStart(2, '0')}`, actividad: 'x'.repeat(300),
    agentes: Array.from({ length: 9 }, (_, j) => sub(`a${j}`, `Ag${j}`, 'listo')),
    procesos: Array.from({ length: 7 }, (_, j) => ({ id: `b${j}`, descripcion: `proceso ${j}`, desde: hace(MIN) })),
  }))
  const d = datosResumen(proyectos(...muchas), AHORA)
  const ses = d.proyectos.flatMap(p => p.sesiones)
  assert.equal(ses.length, 12)
  assert.ok(ses.every(s => s.subagentes.length === 6 && s.procesos.length === 4))
  assert.ok(ses.every(s => s.actividad.length <= 200))
  assert.ok(ses[0].actividad.endsWith('…'))
})

test('la firma de los datos ignora el reloj; cambia con una actividad o un subagente nuevo', () => {
  const p = proyectos(sesion({ agentes: [sub('a1', 'Delfina')] }))
  const f = firmaResumen(datosResumen(p, AHORA))
  assert.equal(firmaResumen(datosResumen(p, AHORA + 10 * MIN)), f)
  const quieta = firmaResumen(datosResumen(proyectos(sesion()), AHORA))
  assert.notEqual(firmaResumen(datosResumen(proyectos(sesion({ actividad: 'leyendo logica.js' })), AHORA)), quieta)
  assert.notEqual(firmaResumen(datosResumen(proyectos(sesion({ agentes: [sub('a1', 'Delfina'), sub('a2', 'Lucas')] })), AHORA)), f)
})

test('"Leyendo…": omite los ceros y usa plurales', () => {
  const d = (ses, ag, pr) => ({ proyectos: [{ nombre: 'p', sesiones: Array.from({ length: ses }, (_, k) => ({ subagentes: k ? [] : Array(ag).fill({}), procesos: k ? [] : Array(pr).fill({}), preguntas: [] })) }] })
  assert.equal(textoPensando(d(1, 0, 0)), 'Leyendo 1 sesión')
  assert.equal(textoPensando(d(2, 0, 1)), 'Leyendo 2 sesiones y 1 proceso')
  assert.equal(textoPensando(d(3, 2, 1)), 'Leyendo 3 sesiones, 2 subagentes y 1 proceso')
  assert.equal(textoPensando(d(1, 1, 2)), 'Leyendo 1 sesión, 1 subagente y 2 procesos')
})

// ------------------------------------------------------------------ 4 contenido

test('cifras: gigas y segundos con una decimal y coma; la hora en HH:MM de 24 h', () => {
  assert.equal(formatoGB(TOTAL), '2,6 GB')
  assert.equal(formatoGB(1.1 * GB, { unidad: false }), '1,1')
  assert.equal(formatoSegundos(3100), '3,1 s')
  assert.equal(formatoHora(new Date(2026, 10, 21, 14, 32).getTime()), '14:32')
  assert.equal(formatoHora(new Date(2026, 10, 21, 9, 5).getTime()), '09:05')
})

test('el texto del modelo: recorta, junta saltos, corta a 600 en un fin de frase y vacío es null', () => {
  assert.equal(limpiarTexto('  Hola.  \n\n\n  Chau.  '), 'Hola.\nChau.')
  assert.equal(limpiarTexto('Hola   que   tal.'), 'Hola que tal.')
  assert.equal(limpiarTexto('  \n '), null)
  assert.equal(limpiarTexto(null), null)
  const largo = 'Una frase corta. '.repeat(50)
  const corto = limpiarTexto(largo)
  assert.ok(corto.length <= 600)
  assert.ok(corto.endsWith('.'))
})

test('texto seguro: el HTML del modelo sale escapado y solo se marcan nombres de proyecto exactos y enteros', () => {
  const html = htmlTexto(partesTexto('<img src=x onerror=alert(1)> en oficina', ['oficina']), { colores: { oficina: 'var(--verde)' } })
  assert.ok(!html.includes('<img'))
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  assert.deepEqual(partesTexto('En oficina y oficinas, central-nucleo.', ['oficina', 'central-nucleo']), [
    { t: 'En ' }, { proyecto: 'oficina' }, { t: ' y oficinas, ' }, { proyecto: 'central-nucleo' }, { t: '.' },
  ])
  assert.deepEqual(partesTexto('Nada que marcar.', ['catalogo']), [{ t: 'Nada que marcar.' }])
  const etiqueta = htmlTexto([{ proyecto: 'oficina' }], { colores: { oficina: 'var(--verde)' } })
  assert.match(etiqueta, /<span class="pj-t" style="--c:var\(--verde\)">oficina<\/span>/)
  // En cascada cada palabra es un span con su índice
  assert.match(htmlTexto([{ t: 'Hola che' }], { palabras: true }), /<span class="w" style="--i:0">Hola<\/span> <span class="w" style="--i:1">che<\/span>/)
  assert.equal(contarPalabras('Tenés 3 sesiones abiertas.'), 4)
})

const base = { progreso: { bajado: 0, total: TOTAL }, texto: null, hora: null, ms: null, aceleracion: null, detalle: null, motivo: null, primeraVez: true, cambio: false, leyendo: 'Leyendo 3 sesiones, 2 subagentes y 1 proceso', proyectos: [], cola: true }
const html = (estado, extra = {}) => contenidoResumen({ ...base, estado, ...extra })
const hora1432 = new Date(2026, 10, 21, 14, 32).getTime()

test('textos exactos por estado (4.1)', () => {
  const a = html('apagado')
  for (const t of ['Resumen con IA · apagado', '¿En qué anda Claude? Te lo cuento en pocas frases.', 'Un modelo chico, en tu PC, lee lo que Avis ya ve (sesiones, subagentes, procesos y preguntas) y lo resume. Sin internet: nada sale de tu máquina.', 'Descargar 2,6 GB', 'Ahora no', 'Qwen3-4B + motor llama.cpp']) assert.ok(a.includes(t), t)
  const d = html('descargando', { progreso: { bajado: 1.1 * GB, total: TOTAL } })
  for (const t of ['Bajando el modelo', '<b data-gb>1,1</b>', 'de 2,6 GB', '42 %', 'Podés seguir usando Avis mientras baja', 'Cancelar']) assert.ok(d.includes(t), t)
  const p = html('preparando')
  for (const t of ['Preparando · solo la primera vez', 'Acomodando el modelo en tu placa de video', 'Tarda 2 o 3 minutos. Después, cada resumen sale en unos 3 segundos.', 'Cancelar']) assert.ok(p.includes(t), t)
  const p2 = html('preparando', { primeraVez: false })
  assert.ok(p2.includes('Despertando el modelo') && !p2.includes('Tarda 2 o 3 minutos'))
  const pe = html('pensando', { aceleracion: 'gpu' })
  for (const t of ['Pensando · en tu PC', 'Leyendo 3 sesiones, 2 subagentes y 1 proceso', '~3 s con la placa de video', 'Cancelar']) assert.ok(pe.includes(t), t)
  assert.ok(!pe.includes('solo con CPU'), 'solo la que corresponde')
  assert.ok(html('pensando', { aceleracion: 'cpu' }).includes('~11 s solo con CPU'))
  const l = html('listo', { texto: 'Tenés 3 sesiones.', hora: hora1432, ms: 3100, cambio: true })
  for (const t of ['Resumen · 14:32 · 3,1 s en tu PC', 'Tenés', 'Cambió algo desde las 14:32.', 'Volver a pedir', 'Copiar']) assert.ok(l.includes(t), t)
  assert.match(html('listo', { texto: 'x', hora: hora1432 }), /data-cambio hidden/, 'sin cambio, el aviso queda escondido')
  const s = html('sinModelo')
  for (const t of ['Falta el modelo', 'No encuentro el modelo en tu PC', 'Puede que se haya borrado o movido. Tus sesiones siguen igual: esto no las toca.', 'Descargar de nuevo · 2,6 GB']) assert.ok(s.includes(t), t)
  const f = html('fallo', { motivo: 'cerrado', detalle: 'llama-server · código de salida 3221225477' })
  for (const t of ['No salió el resumen', 'El motor se cerró antes de terminar', 'Tus sesiones siguen igual. Probá de nuevo en un rato.', 'llama-server · código de salida 3221225477', 'Probar de nuevo']) assert.ok(f.includes(t), t)
  assert.equal(html('cerrado'), '')
})

test('falló: el título según el motivo (4.2); otro motivo, sin título extra', () => {
  assert.deepEqual(MOTIVOS_FALLO, { cerrado: 'El motor se cerró antes de terminar', tiempo: 'El motor tardó más de un minuto', vacio: 'El modelo no devolvió texto', descarga: 'No se pudo bajar el modelo' })
  for (const [motivo, titulo] of Object.entries(MOTIVOS_FALLO)) assert.ok(html('fallo', { motivo }).includes(titulo))
  assert.ok(!html('fallo', { motivo: 'otro' }).includes('class="rz-t"'))
})

test('descarga cancelada: apagado ofrece "Seguir descargando · N de M" en vez de "Descargar"', () => {
  const a = html('apagado', { progreso: { bajado: 1.1 * GB, total: TOTAL } })
  assert.ok(a.includes('Seguir descargando · 1,1 de 2,6 GB'))
  assert.ok(!a.includes('Descargar 2,6 GB'))
})

test('ningún texto promete borrar el modelo desde el globo (se borra desde la bandeja)', () => {
  for (const estado of ESTADOS_RESUMEN) {
    const h = html(estado, { texto: 'x', hora: hora1432 })
    assert.ok(!/borrar cuando quieras/.test(h), estado)
    assert.ok(!/data-accion="rz-borrar"/.test(h), estado)
  }
  assert.ok(html('apagado').includes('se puede borrar desde la bandeja'))
})

test('la cruz solo en apagado, listo, sin modelo y falló; un solo primario; un data-foco; la barra con sus aria-*', () => {
  const cruz = /data-accion="rz-cerrar" aria-label="Cerrar el resumen"/
  for (const estado of ESTADOS_RESUMEN.slice(1)) {
    const h = html(estado, { texto: 'Hola.', hora: hora1432, motivo: 'cerrado' })
    assert.equal(cruz.test(h), ['apagado', 'listo', 'sinModelo', 'fallo'].includes(estado), `cruz en ${estado}`)
    assert.ok((h.match(/class="bt-p"/g) ?? []).length <= 1, `un primario en ${estado}`)
    assert.equal((h.match(/data-foco/g) ?? []).length, 1, `un data-foco en ${estado}`)
    assert.match(h, /<h2 class="oculto" id="h-resumen">¿En qué anda Claude\?<\/h2>/)
  }
  const d = html('descargando', { progreso: { bajado: 1.1 * GB, total: TOTAL } })
  assert.match(d, /role="progressbar" aria-label="Descarga del modelo" aria-valuemin="0" aria-valuemax="100" aria-valuenow="42"/)
  assert.match(html('preparando'), /class="barra ind" role="progressbar" aria-label="Preparando el modelo">/)
  assert.ok(!/aria-valuenow/.test(html('preparando')))
  assert.match(html('pensando'), /class="dots" aria-hidden="true"/)
  assert.match(html('pensando'), /class="esq" aria-hidden="true"/)
})

test('la cola: con cola debajo del encabezado; sin cola si hay aviso o pregunta arriba', () => {
  assert.equal(colaResumen({ hayAviso: false, hayPregunta: false }), true)
  assert.equal(colaResumen({ hayAviso: true, hayPregunta: false }), false)
  assert.equal(colaResumen({ hayAviso: false, hayPregunta: true }), false)
  assert.match(html('apagado'), /class="rz-globo cola"/)
  assert.match(html('apagado', { cola: false }), /class="rz-globo"/)
  assert.match(html('fallo', { motivo: 'cerrado' }), /class="rz-globo cola err"/)
})

test('el modelo no responde: el globo no tiene opciones de pregunta y resumen.js no importa responder.js', () => {
  for (const estado of ESTADOS_RESUMEN) {
    const h = html(estado, { texto: 'Te espera una pregunta: si mergea en main.', hora: hora1432 })
    for (const prohibido of ['data-accion="op"', 'data-pregunta', 'data-globo', 'data-accion="enviar']) assert.ok(!h.includes(prohibido), `${estado}: ${prohibido}`)
  }
  const fuente = readFileSync(new URL('../src/resumen.js', import.meta.url), 'utf8')
  const imports = [...fuente.matchAll(/^import .* from '(.+)'/gm)].map(m => m[1])
  assert.ok(imports.length > 0)
  assert.ok(!imports.some(i => /responder/.test(i)), imports.join(', '))
  assert.ok(!/respuestas\//.test(fuente))
})

// ------------------------------------------------------------------ 6.4 avisos y 6.2 voz

test('un aviso por estado para el lector de pantalla (6.4)', () => {
  assert.equal(anuncioResumen('apagado'), 'Resumen apagado. Se puede descargar el modelo.')
  assert.equal(anuncioResumen('descargando'), 'Bajando el modelo.')
  assert.equal(anuncioResumen('preparando'), 'Preparando el modelo. La primera vez tarda 2 o 3 minutos.')
  assert.equal(anuncioResumen('preparando', { primeraVez: false }), 'Preparando el modelo.')
  assert.equal(anuncioResumen('pensando'), 'Pensando el resumen.')
  assert.equal(anuncioResumen('listo', { texto: 'Tenés 3 sesiones.' }), 'Resumen listo. Tenés 3 sesiones.')
  assert.equal(anuncioResumen('listo', { texto: 'Tenés 3 sesiones.', abierto: false }), 'Resumen listo.')
  assert.equal(anuncioResumen('cerrado'), 'Resumen cerrado.')
  assert.equal(anuncioResumen('sinModelo'), 'Falta el modelo.')
  assert.equal(anuncioResumen('fallo'), 'No salió el resumen.')
})

test('la voz del Avi por estado; con una pregunta pendiente manda "te espera"; cerrado vuelve al ánimo', () => {
  assert.equal(vozAvi('cerrado', false, 'coordinando'), null)
  assert.equal(vozAvi('apagado', false, 'esperando'), 'esperando')
  assert.equal(vozAvi('descargando', false, 'esperando'), 'baja')
  assert.equal(vozAvi('preparando', false, 'esperando'), 'calienta')
  assert.equal(vozAvi('pensando', false, 'coordinando'), 'pensando')
  assert.equal(vozAvi('listo', true, 'esperando'), 'contando')
  assert.equal(vozAvi('listo', false, 'esperando'), 'feliz')
  assert.equal(vozAvi('sinModelo', false, 'esperando'), 'error')
  assert.equal(vozAvi('fallo', false, 'esperando'), 'error')
  for (const estado of ESTADOS_RESUMEN.slice(1)) assert.equal(vozAvi(estado, true, 'teEspera'), 'teEspera')
  // "contando" dura la cascada de palabras, topada en 1,8 s
  assert.equal(duracionContando(10), 600)
  assert.equal(duracionContando(200), 1800)
})

test('el ánimo real describe al Avi-botón ("Claude, esperando")', () => {
  assert.equal(animoTexto('esperando'), 'Claude, esperando')
  assert.equal(animoTexto('coordinando'), 'Claude, coordinando el equipo')
  assert.equal(animoTexto('teEspera'), 'Claude, esperándote')
})

test('"Leyendo…" queda fijo con lo que se le pasó al modelo en el pedido', () => {
  const datos = datosResumen(proyectos(sesion({ agentes: [sub('a1', 'Delfina'), sub('a2', 'Lucas')] })), AHORA)
  const r = transicion(en('listo', { resultado: 'listo', texto: 'x' }), { tipo: 'pedir' }, { ahoraMs: AHORA, datos }).resumen
  assert.equal(r.leyendo, 'Leyendo 1 sesión y 2 subagentes')
})

test('descargando sin progreso conocido (la firma lo pasa en null) no rompe', () => {
  assert.ok(contenidoResumen({ ...base, estado: 'descargando', progreso: null }).includes('Bajando el modelo'))
})

test('diagnóstico al abrir el globo: lo que creía la UI antes y lo que muestra después', () => {
  const antes = { ...resumenInicial(), modelo: 'listo', trabajo: null, estado: 'cerrado' }
  const despues = { ...antes, estado: 'pensando', trabajo: 'pensando' }
  assert.equal(lineaAbrir(antes, despues), 'resumen abrir: antes modelo=listo trabajo=- estado=cerrado; ahora estado=pensando trabajo=pensando')
  // Sin estado leído todavía (modelo null) se ve como "?"
  const sinLeer = { ...resumenInicial(), modelo: null, estado: 'cerrado' }
  assert.match(lineaAbrir(sinLeer, { ...sinLeer, estado: 'apagado' }), /antes modelo=\? .* ahora estado=apagado/)
})

test('una sesión que solo terminó su turno va al modelo como quieta, sin pendientes', () => {
  const quieta = { actividad: 'esperándote', preguntas: [], actualizado: '2026-11-21T10:00:00Z' }
  assert.equal(actividadParaResumen(quieta, Date.parse('2026-11-22T03:00:00Z')), ACTIVIDAD_QUIETA)
  assert.doesNotMatch(ACTIVIDAD_QUIETA, /esperando tu mensaje/)
  // Con una pregunta, manda lo del tablero (la pregunta es lo único pendiente)
  const conPregunta = { ...quieta, preguntas: [{ id: 'q', items: [{ pregunta: '¿Sí?' }] }] }
  assert.notEqual(actividadParaResumen(conPregunta, Date.now()), ACTIVIDAD_QUIETA)
  // Una sesión trabajando sigue diciendo lo que hace, como el tablero
  assert.match(actividadParaResumen({ actividad: 'editando main.js', actualizado: new Date().toISOString() }, Date.now()), /editando main\.js/)
})
