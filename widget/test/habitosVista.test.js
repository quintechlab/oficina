// Tests de habitosVista.js (#41, docs/diseno/habitos-ux.md 3.3, 4 y 5, entrega H1): el HTML de la fila
// del menú, el índice, Hoy, Semana, el hábito abierto, el formulario, el primer uso, los vacíos y los
// errores, con los textos exactos de la sección 5 y los nombres accesibles de 4 y 12.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ladoFilaHabitos, cuentaMiniHabitos, indiceHabitos, filaHabito, sumador, celdas, rachaHtml, formulario, partesHoja,
  primerUsoHabitos, errorGuardarHab, errorRotaHab, errorCarpetaHab, hitoHtml, esqueletoHabitos, CARPETA_HAB,
} from '../src/habitosVista.js'
import { borradorNuevo } from '../src/habitos.js'

const HOY = '2026-11-26'
const dia = n => new Date(Date.UTC(2026, 10, 26 + n)).toISOString().slice(0, 10)
const hab = (extra = {}) => ({
  v: 1, id: 'h-x', nombre: 'Caminar', tipo: 'diario', meta: 8, unidad: 'vasos', dias: [0, 2, 4], veces: 3, aviso: null,
  color: 'verde', orden: 0, creado: Date.UTC(2026, 9, 28, 15), inicio: '2026-10-28', mejor: 21, registro: {}, ...extra,
})
const reg = (...ns) => Object.fromEntries(ns.map(n => [dia(n), 1]))
const AGUA = hab({ id: 'h-agua', nombre: 'Agua', tipo: 'cantidad', meta: 8, unidad: 'vasos', color: 'celeste', aviso: '16:00', registro: { [HOY]: 3 } })
const GYM = hab({ id: 'h-gym', nombre: 'Gimnasio', tipo: 'dias', dias: [0, 2, 4], color: 'rosa' })

// ------------------------------------------------------------------ fila del menú (4.1) y tira mini

test('ladoFilaHabitos: «Ctrl H» sin hábitos; «—» si ninguno toca; el anillo y «{h}/{t}»; completo en ámbar', () => {
  assert.equal(ladoFilaHabitos({ hechos: 0, total: 0, habitos: 0 }), '<kbd aria-hidden="true">Ctrl H</kbd>')
  assert.equal(ladoFilaHabitos(null), '<kbd aria-hidden="true">Ctrl H</kbd>')
  assert.equal(ladoFilaHabitos({ hechos: 0, total: 0, habitos: 2 }), '<span class="anillo-c nada" aria-hidden="true">—</span>')
  const parcial = ladoFilaHabitos({ hechos: 2, total: 5, habitos: 5 })
  assert.match(parcial, /^<span class="anillo-c" aria-hidden="true"><svg viewBox="0 0 14 14"/)
  assert.match(parcial, /class="a-l"/)
  assert.match(parcial, /2\/5<\/span>$/)
  // Con 0 hechos no se dibuja el relleno
  assert.doesNotMatch(ladoFilaHabitos({ hechos: 0, total: 3, habitos: 3 }), /a-l/)
  assert.match(ladoFilaHabitos({ hechos: 3, total: 3, habitos: 3 }), /^<span class="anillo-c completo"/)
})

test('cuentaMiniHabitos: el anillo y «{h}/{t}» con su nombre para el lector; sin nada que contar, nada', () => {
  assert.equal(cuentaMiniHabitos({ hechos: 0, total: 0, habitos: 2 }), '')
  const m = cuentaMiniHabitos({ hechos: 2, total: 5, habitos: 5 })
  assert.match(m, /anillo-c/)
  assert.match(m, /<span class="oculto">Hábitos, 2 de 5 hechos hoy<\/span>$/)
})

// ------------------------------------------------------------------ índice (4.2)

test('indiceHabitos: Hoy con «{h}/{t}», Semana, el rótulo, cada hábito con su racha corta, los rotos y «Nuevo hábito»', () => {
  const caminar = hab({ registro: reg(-2, -1, 0) })
  const html = indiceHabitos({ ver: 'hoy', lista: [caminar, AGUA], rotas: [{ archivo: 'h-roto.json', motivo: 'no es JSON' }], cuentas: { hechos: 1, total: 2, habitos: 2 }, hoy: HOY })
  assert.match(html, /data-accion="hab-ver" data-valor="hoy" data-k="ix-hoy" aria-current="page"/)
  assert.match(html, /<span class="ct t-aviso" aria-hidden="true">1\/2<\/span><span class="oculto">, 1 de 2 hechos<\/span>/)
  assert.match(html, /data-valor="semana" data-k="ix-semana"/)
  assert.match(html, /<span class="rot-i" aria-hidden="true">Hábitos<\/span>/)
  assert.match(html, /data-valor="h-x" data-k="ix-h-x" style="--c:var\(--verde\)" title="Caminar">/)
  assert.match(html, /<span class="racha r1" aria-hidden="true"[^>]*>.*<b>3<\/b><\/span><span class="oculto">, racha de 3 días<\/span>/)
  assert.match(html, /class="ix-b rota" data-accion="hab-ver" data-valor="rota:h-roto\.json"/)
  assert.match(html, /<button type="button" class="ix-b ix-mas" data-accion="hab-nuevo" data-k="nuevo-b"><span class="ix-ic">.*<\/span><span class="n">Nuevo hábito<\/span><\/button>$/)
  // Leyendo: Hoy sin cuenta (7.1)
  assert.doesNotMatch(indiceHabitos({ ver: 'hoy', lista: [], rotas: [], cuentas: null, hoy: HOY }), /class="ct/)
})

// ------------------------------------------------------------------ Hoy (4.4 a 4.7)

test('filaHabito: el tilde «Hecho hoy: {nombre}», el nombre que abre el hábito, el rótulo del tipo y la racha larga', () => {
  const f = filaHabito(hab({ registro: reg(-1, 0) }), { hoy: HOY })
  assert.match(f, /^<li class="fila hecha" data-id="h-x" style="--c:var\(--verde\)">/)
  assert.match(f, /<button type="button" class="ck" role="checkbox" aria-checked="true" aria-label="Hecho hoy: Caminar" data-accion="hab-tildar" data-valor="h-x" data-k="ck-h-x">/)
  assert.match(f, /<button type="button" class="nom" data-accion="hab-abrir" data-valor="h-x" data-k="nom-h-x">Caminar<\/button>/)
  assert.match(f, /<span class="tag">todos los días<\/span>/)
  assert.match(f, /<span class="racha r1" title="Racha: 2 días · la mejor: 21">.*<b>2<\/b><span>días<\/span><\/span><\/li>$/)
  // Sin racha
  assert.match(filaHabito(hab(), { hoy: HOY }), /<span>sin racha<\/span>/)
})

test('filaHabito: hoy no toca, un «–» (Hoy no toca) y «hoy no toca · vuelve el {día}»; el aviso con la campana', () => {
  const f = filaHabito(GYM, { hoy: HOY })
  assert.match(f, /<span class="libre-c" title="Hoy no toca" aria-hidden="true">–<\/span>/)
  assert.match(f, /hoy no toca · vuelve el vie/)
  assert.match(filaHabito(AGUA, { hoy: HOY }), /<span class="tag" title="Aviso a las 16:00"><svg[^>]*>.*<\/svg>16:00<\/span>/)
})

test('sumador: un tramo por vaso, el número de hoy, el «+» y su nombre; «−1» solo con algo hoy', () => {
  const s = sumador(AGUA, HOY)
  assert.match(s, /^<button type="button" class="sum" data-accion="hab-sumar" data-valor="h-agua" data-k="sum-h-agua" aria-label="Sumar 1 vaso a Agua\. Van 3 de 8">/)
  assert.equal((s.match(/class="sg/g) ?? []).length, 8)
  assert.equal((s.match(/class="sg on/g) ?? []).length, 3)
  assert.match(s, /<b class="num" aria-hidden="true">3<\/b><i class="mas" aria-hidden="true">\+<\/i><\/button>$/)
  const lleno = sumador({ ...AGUA, registro: { [HOY]: 9 } }, HOY)
  assert.match(lleno, /class="sum lleno"/)
  assert.match(lleno, /aria-label="Agua: meta cumplida, 9 de 8 vasos\. Sumar otro"/)
  // Con más de 12, un arco continuo
  assert.equal((sumador({ ...AGUA, meta: 20 }, HOY).match(/class="sg/g) ?? []).length, 2)
  const f = filaHabito(AGUA, { hoy: HOY })
  assert.match(f, /<button type="button" class="menos" data-accion="hab-restar" data-valor="h-agua" data-k="menos-h-agua" aria-label="Restar 1 vaso a Agua" title="Restar uno">−1<\/button>/)
  assert.doesNotMatch(filaHabito({ ...AGUA, registro: {} }, { hoy: HOY }), /class="menos"/)
})

test('rachaHtml: los cuatro niveles de 4.7 con su clase', () => {
  assert.match(rachaHtml(hab(), HOY), /class="racha r0"/)
  assert.match(rachaHtml(hab({ registro: reg(-6, -5, -4, -3, -2, -1, 0) }), HOY), /class="racha r2"/)
  const treinta = Array.from({ length: 30 }, (_, i) => -i)
  assert.match(rachaHtml(hab({ registro: reg(...treinta) }), HOY), /class="racha r3"/)
})

// ------------------------------------------------------------------ Semana (4.8, 4.9)

test('celdas: los días pasados de esta semana y hoy son botones con aria-pressed; la cantidad y lo que no toca, no', () => {
  const c = celdas(hab({ registro: reg(-2) }), HOY, { clic: true })
  assert.match(c, /^<div class="sem" role="group" aria-label="Semana de Caminar">/)
  assert.equal((c.match(/<button type="button" class="cel/g) ?? []).length, 4)
  assert.match(c, /<button type="button" class="cel s-hecho" data-accion="hab-celda" data-valor="h-x" data-dia="2026-11-24" data-k="cel-h-x-1" aria-pressed="true" aria-label="mar 24: hecho" title="mar 24: hecho"><\/button>/)
  assert.match(c, /class="cel s-pend hoy"[^>]*aria-pressed="false" aria-label="jue 26 \(hoy\): falta"/)
  assert.match(c, /<span class="cel s-futuro" role="img" aria-label="vie 27: por venir" title="vie 27: por venir"><\/span>/)
  assert.equal((celdas(AGUA, HOY, { clic: true }).match(/<button/g) ?? []).length, 0)
  assert.match(celdas({ ...AGUA, registro: { [dia(-1)]: 4 } }, HOY, { clic: true }), /class="cel s-parcial" style="--p:50%"/)
})

test('partesHoja Semana: «Semana», el encabezado con el %, la fila de rótulos, una fila por hábito, la leyenda y la pista', () => {
  const p = partesHoja({ ver: 'semana', desde: 'semana', lista: [hab({ registro: reg(-3, -2, -1) }), AGUA], rotas: [], leido: true, hoy: HOY })
  assert.match(p.paneH, /<h2 id="hab-pane-h">Semana<\/h2><div class="pane-s"><span>23\/11 al 29\/11 · \d+ % de lo que tocaba<\/span><\/div>/)
  assert.match(p.cuerpo, /<div class="mat" style="--hoy:3">/)
  assert.match(p.cuerpo, /<span class="rot-m">Hábito<\/span>/)
  assert.match(p.cuerpo, /<span class="hoy">J<small>26<\/small><\/span>/)
  assert.match(p.cuerpo, /<button type="button" class="mat-n" data-accion="hab-abrir" data-valor="h-agua" data-k="mat-h-agua">/)
  for (const t of ['hecho', 'en parte', 'no se hizo', 'no toca', 'por venir']) assert.ok(p.cuerpo.includes(`</i>${t}</span>`), t)
  assert.match(p.cuerpo, /<p class="pista">Tocá un día que ya pasó para corregirlo\.<\/p>$/)
})

// ------------------------------------------------------------------ Hoy (3.3, 4.3, 5.2)

test('partesHoja Hoy: «Hoy», el avance y su barra; las filas de hoy y «Hoy no toca» abajo, al 70 %', () => {
  const p = partesHoja({ ver: 'hoy', desde: 'hoy', lista: [hab({ registro: reg(0) }), AGUA, GYM], rotas: [], leido: true, hoy: HOY })
  assert.match(p.paneH, /<h2 id="hab-pane-h">Hoy<\/h2>/)
  assert.match(p.paneH, /<span>hoy · 1 de 2 hechos<\/span><span class="prog" role="progressbar" aria-label="Hechos hoy" aria-valuemin="0" aria-valuemax="2" aria-valuenow="1"><i style="--p:50%"><\/i><\/span>/)
  assert.match(p.cuerpo, /^<ul class="filas">/)
  assert.match(p.cuerpo, /<p class="rot-p">Hoy no toca<\/p><ul class="filas fuera-l"><li class="fila" data-id="h-gym"/)
  const completo = partesHoja({ ver: 'hoy', desde: 'hoy', lista: [hab({ registro: reg(0) })], rotas: [], leido: true, hoy: HOY })
  assert.match(completo.paneH, /<span class="completo-t">¡Día completo!<\/span>/)
})

test('partesHoja Hoy: sin nada que toque, «Hoy no toca nada.» y «Mañana: {nombres}.»; leyendo, tres filas fantasma', () => {
  const p = partesHoja({ ver: 'hoy', desde: 'hoy', lista: [GYM], rotas: [], leido: true, hoy: HOY })
  assert.match(p.paneH, /<span>hoy no toca ninguno<\/span>/)
  assert.match(p.cuerpo, /<div class="vac">.*<b>Hoy no toca nada\.<\/b><p>Mañana: Gimnasio\.<\/p><\/div>/)
  const f = partesHoja({ ver: 'hoy', desde: 'hoy', lista: [], rotas: [], leido: false, fantasmas: true, hoy: HOY })
  assert.equal(f.cuerpo, '<ul class="filas fantasmas" aria-hidden="true"><li></li><li></li><li></li></ul>')
})

test('partesHoja: el error al guardar arriba del panel (7.4); un archivo roto muestra su error (7.6)', () => {
  const p = partesHoja({ ver: 'hoy', desde: 'hoy', lista: [hab()], rotas: [], leido: true, hoy: HOY, errorGuardar: true })
  assert.equal(p.err, errorGuardarHab())
  const r = partesHoja({ ver: 'rota:h-roto.json', desde: 'hoy', lista: [hab()], rotas: [{ archivo: 'h-roto.json', motivo: 'x' }], leido: true, hoy: HOY })
  assert.equal(r.err, errorRotaHab())
  assert.match(r.paneH, /<h2 id="hab-pane-h">h-roto\.json<\/h2>/)
  assert.equal(r.cuerpo, '')
})

// ------------------------------------------------------------------ el hábito abierto (4.10)

test('partesHoja de un hábito: «‹ Semana», el h2 oculto, el nombre, la racha grande, las últimas 5 semanas, los campos y el pie', () => {
  const h = hab({ registro: reg(-2, -1, 0) })
  const p = partesHoja({ ver: 'h-x', desde: 'semana', lista: [h], rotas: [], leido: true, hoy: HOY })
  assert.equal(p.paneH, '<button type="button" class="lnk atras" data-accion="hab-cerrar-habito" data-k="atras">‹ Semana</button><h2 class="oculto" id="hab-pane-h">Caminar</h2>')
  assert.match(p.cuerpo, /^<div class="det frm" data-form="h-x">/)
  assert.match(p.cuerpo, /<textarea class="tit-in" rows="1" maxlength="40" aria-label="Nombre del hábito" data-campo="nombre" data-k="nom-in-h-x">Caminar<\/textarea>/)
  assert.match(p.cuerpo, /<div class="racha-g r1">.*<b>3<\/b><span>días seguidos<small>la mejor: 21 · desde el 28\/10<\/small><\/span><\/div>/)
  assert.match(p.cuerpo, /<h3 class="sub">Últimas 5 semanas<\/h3><div class="cal-g" role="img" aria-label="Últimas 5 semanas de Caminar: 3 días hechos">/)
  assert.match(p.cuerpo, /<span class="cifras">Creado el 28\/10<\/span><button type="button" class="lnk peligro" data-accion="hab-borrar" data-valor="h-x" data-k="borrar">Borrar hábito<\/button>/)
  const armado = partesHoja({ ver: 'h-x', desde: 'hoy', lista: [h], rotas: [], leido: true, hoy: HOY, armado: true })
  assert.match(armado.cuerpo, /<button type="button" class="armado" data-accion="hab-borrar" data-valor="h-x" data-k="borrar" aria-live="polite" style="--ya:-0ms">¿Borrar con su racha de 3 días\? Sí<\/button>/)
  assert.match(armado.paneH, /‹ Hoy/)
  assert.match(partesHoja({ ver: 'h-x', desde: 'hoy', lista: [hab()], rotas: [], leido: true, hoy: HOY }).cuerpo, /<b>0<\/b><span>sin racha todavía/)
})

// ------------------------------------------------------------------ formulario (4.11, 5.1)

test('formulario nuevo: el campo del nombre, Tipo, Aviso, Color, la frase y «Crear hábito» · «Cancelar»', () => {
  const f = formulario({ ...borradorNuevo([]), id: undefined }, { modo: 'nuevo', avisar: true })
  assert.match(f, /^<div class="frm" data-form="nuevo"><label class="campo"><input data-campo="nombre" data-k="nom-in-nuevo" maxlength="40" value="" placeholder="Caminar, tomar agua, leer…" aria-label="Nombre del hábito"><kbd>Enter<\/kbd><\/label>/)
  assert.match(f, /<span class="det-l">Tipo<\/span><div class="det-f" role="radiogroup" aria-label="Tipo">/)
  for (const t of ['Todos los días', 'Cantidad', 'Algunos días', 'Por semana']) assert.ok(f.includes(`>${t}</button>`), t)
  assert.match(f, /role="radio" aria-checked="true" tabindex="0" data-accion="hab-tipo" data-valor="diario"/)
  assert.match(f, /role="radio" aria-checked="false" tabindex="-1" data-accion="hab-tipo" data-valor="cantidad"/)
  assert.doesNotMatch(f, />Meta<|>Días<|>Veces</)
  assert.match(f, /<button type="button" class="sw" role="switch" aria-checked="false" aria-label="Aviso" data-accion="hab-aviso" data-k="sw-aviso"><\/button><span class="cifras">sin aviso<\/span>/)
  assert.match(f, /<span class="det-l">Color<\/span><div class="det-f colores" role="radiogroup" aria-label="Color">/)
  assert.match(f, /class="col" role="radio" aria-checked="true" tabindex="0" style="--c:var\(--celeste\)" aria-label="Celeste" data-accion="hab-color" data-valor="celeste"/)
  assert.match(f, /<p class="frase" data-frase><b>Tu hábito<\/b> · todos los días · sin aviso<\/p>/)
  assert.match(f, /<button type="button" class="btn" data-accion="hab-crear" data-k="crear">Crear hábito<\/button><button type="button" class="lnk" data-accion="hab-cancelar" data-k="cancelar">Cancelar<\/button>/)
})

test('formulario: Meta (cantidad), Días (algunos días) y Veces (por semana); el aviso prendido con su hora', () => {
  const cant = formulario({ ...borradorNuevo([]), tipo: 'cantidad' }, { modo: 'nuevo', avisar: true })
  assert.match(cant, /<span class="det-l">Meta<\/span><div class="det-f"><div class="paso" role="group" aria-label="Meta por día"><button type="button" data-accion="hab-paso" data-valor="meta:-1" data-k="p-meta-m" aria-label="Uno menos">−<\/button><b aria-live="polite">8<\/b>/)
  assert.match(cant, /<label class="campo mini"><input data-campo="unidad" data-k="unidad-nuevo" maxlength="16" value="vasos" placeholder="vasos" aria-label="Unidad"><\/label><span class="cifras">por día<\/span>/)
  const dias = formulario({ ...borradorNuevo([]), tipo: 'dias' }, { modo: 'nuevo', avisar: true })
  assert.match(dias, /<div class="det-f dsem" role="group" aria-label="Días">/)
  assert.match(dias, /<button type="button" aria-pressed="true" aria-label="lunes" title="lunes" data-accion="hab-dia" data-valor="0" data-k="dia-0">L<\/button>/)
  assert.match(dias, /aria-pressed="false" aria-label="martes"/)
  const sem = formulario({ ...borradorNuevo([]), tipo: 'semana' }, { modo: 'nuevo', avisar: true })
  assert.match(sem, /aria-label="Veces por semana">.*<b aria-live="polite">3<\/b>.*<span class="cifras">por semana<\/span>/)
  const aviso = formulario({ ...borradorNuevo([]), aviso: '16:00' }, { modo: 'nuevo', avisar: true })
  assert.match(aviso, /aria-checked="true" aria-label="Aviso"[^>]*><\/button><input type="time" class="fecha-in" value="16:00" aria-label="Hora del aviso" data-campo="hora" data-cambio="hab-hora" data-k="hora-nuevo"><span class="cifras">globo \+ Windows<\/span>/)
  assert.match(formulario({ ...borradorNuevo([]), aviso: '16:00' }, { modo: 'nuevo', avisar: false }), /<span class="cifras">solo globo · Windows apagado en Configuración<\/span>/)
  assert.match(aviso, /te aviso a las 16:00/)
})

test('formulario: el error (role=alert) debajo de la frase', () => {
  const f = formulario(borradorNuevo([]), { modo: 'nuevo', avisar: true, errForm: 'Ponele un nombre.' })
  assert.match(f, /<\/p><p class="e-form" role="alert">Ponele un nombre\.<\/p><div class="acc-c">/)
})

// ------------------------------------------------------------------ primer uso, errores y hito (5.2, 4.14)

test('primerUsoHabitos: el Avi saluda, «Armá tu primer hábito», la línea, las cuatro sugeridas y «+ Otro hábito…»', () => {
  const p = primerUsoHabitos('avi')
  assert.match(p, /^<div class="primer">/)
  assert.match(p, /<b>Armá tu primer hábito<\/b><p>Algo chico que quieras hacer seguido\. Queda en esta PC y, si querés, te aviso a la hora que elijas\.<\/p>/)
  assert.match(p, /<div class="sug" role="group" aria-label="Sugeridas">/)
  assert.match(p, /data-accion="hab-sugerida" data-valor="agua" data-k="sug-agua" aria-label="Tomar agua · 8 vasos">/)
  for (const t of ['Caminar · todos los días', 'Gimnasio · lun, mié, vie', 'Correr · 3 por semana']) assert.ok(p.includes(`aria-label="${t}"`), t)
  assert.match(p, /<button type="button" class="lnk" data-accion="hab-nuevo" data-k="primer-otro">\+ Otro hábito…<\/button><\/div>$/)
})

test('errores de 5.2: archivo roto, error al guardar y carpeta ilegible, con sus botones', () => {
  assert.match(errorRotaHab(), /<b>Un hábito no se pudo leer\.<\/b>El archivo quedó como estaba, en la carpeta de hábitos\. Los demás andan\./)
  assert.match(errorRotaHab(), /data-accion="hab-carpeta" data-k="carpeta">Abrir la carpeta<\/button><button type="button" class="lnk" data-accion="hab-releer" data-k="releer">Volver a leer/)
  assert.match(errorGuardarHab(), /<b>No se guardó el último cambio\.<\/b>Sigue en pantalla\. Reintento solo en 5 s\./)
  assert.match(errorGuardarHab(), /data-accion="hab-reintentar" data-k="reintentar">Reintentar ahora/)
  assert.match(errorCarpetaHab('acceso denegado'), /<b>No se pudo abrir la carpeta de hábitos\.<\/b>acceso denegado/)
  // El mensaje de Rust ya es el título: no se repite
  assert.match(errorCarpetaHab('No se pudo abrir la carpeta de hábitos.'), /<b>No se pudo abrir la carpeta de hábitos\.<\/b><\/div>/)
})

test('hitoHtml, esqueleto y carpeta: la píldora aria-hidden con la brasa; la región de anuncios; las partes', () => {
  assert.match(hitoHtml('Caminar: ¡una semana seguida!'), /^<div class="hito" aria-hidden="true"><svg viewBox="0 0 12 14"[^>]*>.*<\/svg>Caminar: ¡una semana seguida!<\/div>$/)
  assert.equal(esqueletoHabitos(), '<div id="hab-cuerpo"></div><p class="oculto" role="status" id="hab-vivo"></p>')
  for (const p of ['idx', 'pane-h', 'err', 'cuerpo']) assert.ok(CARPETA_HAB.includes(`data-parte="${p}"`), p)
  assert.match(CARPETA_HAB, /<nav class="idx" aria-label="Vistas y hábitos"/)
})
