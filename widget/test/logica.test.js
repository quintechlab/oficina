// Tests de la lógica pura del widget: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparPorProyecto, nombreProyecto, animoSesion, animoSubagente, personajeDeNombre,
  tiempoRelativo, tiempoSubagente, textoActividad, preguntasPendientes, etiquetaOpcion, escapar,
  preguntasNuevas, resumenMini, reposoPermitido, ANIMOS_DE_TRABAJO, UMBRAL_ARRASTRE, superaUmbral, plural,
  variantesEquipo,
} from '../src/logica.js'

const AHORA = Date.parse('2026-11-19T23:50:00Z')
const hace = ms => new Date(AHORA - ms).toISOString()
const MIN = 60000

const sesion = (extra = {}) => ({
  v: 1, sesion: 's1', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando',
  repo: 'quintechlab/oficina', rama: 'feat/3-widget', tarea: 3, nota: null,
  inicio: hace(30 * MIN), tareaDesde: hace(30 * MIN), actualizado: hace(10000), archivos: [],
  actividad: null, agentes: [], preguntas: [], cerrada: false, ...extra,
})

test('agrupa por proyecto, en orden alfabético y con "fuera de un repositorio" al final', () => {
  const grupos = agruparPorProyecto([
    sesion({ sesion: 'a', repo: null, rama: null, tarea: null }),
    sesion({ sesion: 'b', repo: 'quintechlab/oficina' }),
    sesion({ sesion: 'c', repo: 'nicoequintana/catalogo' }),
    sesion({ sesion: 'd', repo: 'quintechlab/oficina', inicio: hace(60 * MIN) }),
  ])
  assert.deepEqual(grupos.map(g => g.nombre), ['catalogo', 'oficina', 'fuera de un repositorio'])
  assert.deepEqual(grupos.map(g => g.repo), ['nicoequintana/catalogo', 'quintechlab/oficina', null])
  // Dentro del proyecto, las sesiones por orden de inicio: el escritorio de cada una no salta
  assert.deepEqual(grupos[1].sesiones.map(s => s.sesion), ['d', 'b'])
})

test('sin sesiones no hay proyectos', () => {
  assert.deepEqual(agruparPorProyecto([]), [])
})

test('nombre del proyecto: el repositorio sin el dueño', () => {
  assert.equal(nombreProyecto('quintechlab/oficina'), 'oficina')
  assert.equal(nombreProyecto(null), 'fuera de un repositorio')
})

test('ánimo de la sesión según su actividad', () => {
  const a = actividad => animoSesion(sesion({ actividad }), AHORA)
  assert.equal(a('pensando'), 'pensando')
  assert.equal(a('leyendo register.tsx'), 'leyendo')
  assert.equal(a('buscando NOMBRES'), 'leyendo')
  assert.equal(a('corriendo npm test'), 'comando')
  assert.equal(a('editando logica.ts'), 'editando')
  // "esperándote" sin preguntas es esperar tu mensaje, no una pregunta
  assert.equal(a('esperándote'), 'esperando')
  assert.equal(a(null), 'esperando')
})

test('la sesión que pregunta te espera aunque su actividad diga otra cosa', () => {
  const s = sesion({ actividad: 'pensando', preguntas: [{ id: 'q1', agente: null, desde: hace(MIN), items: [] }] })
  assert.equal(animoSesion(s, AHORA), 'teEspera')
})

test('una sesión que no publica hace más de 20 minutos está inactiva', () => {
  assert.equal(animoSesion(sesion({ actividad: 'pensando', actualizado: hace(21 * MIN) }), AHORA), 'inactiva')
})

test('ánimo del subagente: festeja 6 s al terminar y después descansa', () => {
  const ag = extra => ({ id: 'a1', nombre: 'Tomás', inventado: false, tipo: 'Explore', tarea: 'mapa', desde: hace(5 * MIN), estado: 'trabajando', hasta: null, ...extra })
  assert.equal(animoSubagente(ag({ estado: 'listo', hasta: hace(3000) }), AHORA), 'listo')
  assert.equal(animoSubagente(ag({ estado: 'listo', hasta: hace(7000) }), AHORA), 'durmiendo')
  assert.equal(animoSubagente(ag({ estado: 'fallo', hasta: hace(3000) }), AHORA), 'fallo')
  assert.equal(animoSubagente(ag({ estado: 'fallo', hasta: hace(MIN) }), AHORA), 'durmiendo')
  assert.equal(animoSubagente(ag({ tipo: 'Explore' }), AHORA), 'leyendo')
  assert.equal(animoSubagente(ag({ tipo: 'general-purpose' }), AHORA), 'escribiendo')
  assert.equal(animoSubagente(ag({}), AHORA, true), 'teEspera')
})

test('cada nombre del elenco tiene su personaje', () => {
  assert.deepEqual(personajeDeNombre('Claude'), { pj: 'antena', color: '#F2B632' })
  assert.deepEqual(personajeDeNombre('Camila'), { pj: 'gata', color: '#E78FB3' })
  assert.deepEqual(personajeDeNombre('Ramiro'), { pj: 'raton', color: '#7FB3FF' })
  assert.deepEqual(personajeDeNombre('Lucas'), { pj: 'brote', color: '#8FD694' })
  assert.deepEqual(personajeDeNombre('Delfina'), { pj: 'mono', color: '#F2B632' })
  assert.deepEqual(personajeDeNombre('Inés'), { pj: 'cuernos', color: '#A58BFF' })
  assert.deepEqual(personajeDeNombre('ines'), personajeDeNombre('Inés'))
})

test('un nombre fuera del elenco recibe siempre el mismo personaje, nunca el de Claude', () => {
  for (const n of ['Tomás', 'Martina', 'Bruno', 'Paula', 'Nahuel', 'Sofía', 'Agente 7']) {
    const p = personajeDeNombre(n)
    assert.deepEqual(personajeDeNombre(n), p)
    assert.notEqual(p.pj, 'antena')
    assert.ok(['gata', 'raton', 'brote', 'mono', 'cuernos'].includes(p.pj), `${n}: ${p.pj}`)
  }
  const distintos = new Set(['Tomás', 'Martina', 'Bruno', 'Paula', 'Nahuel', 'Sofía', 'Joaquín', 'Lola'].map(n => personajeDeNombre(n).pj))
  assert.ok(distintos.size >= 3, 'los nombres se reparten entre varios personajes')
})

test('tiempo relativo en texto', () => {
  assert.equal(tiempoRelativo(hace(20000), AHORA), 'menos de 1 min')
  assert.equal(tiempoRelativo(hace(3 * MIN + 5000), AHORA), '3 min')
  assert.equal(tiempoRelativo(hace(60 * MIN), AHORA), '1 h')
  assert.equal(tiempoRelativo(hace(125 * MIN), AHORA), '2 h 5 min')
  assert.equal(tiempoRelativo(new Date(AHORA + 5000).toISOString(), AHORA), 'menos de 1 min')
})

test('tiempo del subagente: cuánto lleva o hace cuánto terminó', () => {
  const ag = { desde: hace(12 * MIN), hasta: null, estado: 'trabajando' }
  assert.equal(tiempoSubagente(ag, AHORA), '12 min')
  assert.equal(tiempoSubagente({ ...ag, estado: 'listo', hasta: hace(2 * MIN) }, AHORA), 'hace 2 min')
})

test('texto de actividad de la sesión para la lista', () => {
  assert.equal(textoActividad(sesion({ actividad: 'editando logica.ts' }), AHORA), 'ahora · editando logica.ts')
  assert.equal(textoActividad(sesion({ actividad: null }), AHORA), 'ahora · sin actividad')
  assert.equal(textoActividad(sesion({ actividad: 'pensando', preguntas: [{ id: 'q', agente: null, desde: hace(MIN), items: [] }] }), AHORA), 'ahora · te hace una pregunta')
  assert.equal(textoActividad(sesion({ actividad: 'pensando', actualizado: hace(25 * MIN) }), AHORA), 'sin actividad hace 25 min')
})

test('preguntas pendientes del proyecto, una por ítem, con quién pregunta', () => {
  const item = (pregunta) => ({ pregunta, encabezado: 'Diseño', multiple: false, opciones: [{ etiqueta: 'A', descripcion: '' }] })
  const s1 = sesion({
    sesion: 's1',
    agentes: [{ id: 'a1', nombre: 'Camila', inventado: false, tipo: 'general-purpose', tarea: 'cupones', desde: hace(MIN), estado: 'trabajando', hasta: null }],
    preguntas: [{ id: 'q1', agente: 'a1', desde: hace(MIN), items: [item('¿Terrario?'), item('¿Colores?')] }],
  })
  const s2 = sesion({ sesion: 's2', preguntas: [{ id: 'q2', agente: null, desde: hace(2 * MIN), items: [item('¿Stock?')] }] })
  const [g] = agruparPorProyecto([s1, s2])
  const pend = preguntasPendientes(g)
  assert.deepEqual(pend.map(p => [p.clave, p.quien, p.agente, p.item.pregunta]), [
    ['q1#0', 'Camila', 'a1', '¿Terrario?'],
    ['q1#1', 'Camila', 'a1', '¿Colores?'],
    ['q2#0', 'Claude', null, '¿Stock?'],
  ])
  assert.equal(pend[2].sesion, 's2')
})

test('opción recomendada: la marca del texto se vuelve un chip', () => {
  assert.deepEqual(etiquetaOpcion('Terrario (Recomendada)'), { texto: 'Terrario', recomendada: true })
  assert.deepEqual(etiquetaOpcion('Terrario (Recommended)'), { texto: 'Terrario', recomendada: true })
  assert.deepEqual(etiquetaOpcion('Vitrina'), { texto: 'Vitrina', recomendada: false })
})

test('escapa el texto antes de meterlo en HTML o SVG', () => {
  assert.equal(escapar('corriendo a && b <x> "y" \'z\''), 'corriendo a &amp;&amp; b &lt;x&gt; &quot;y&quot; &#39;z&#39;')
  assert.equal(escapar(null), '')
})

const conPreguntas = () => {
  const item = pregunta => ({ pregunta, encabezado: 'X', multiple: false, opciones: [] })
  return [
    sesion({
      sesion: 's1',
      agentes: [
        { id: 'a1', nombre: 'Camila', inventado: false, tipo: 'general-purpose', tarea: 'cupones', desde: hace(MIN), estado: 'trabajando', hasta: null },
        { id: 'a2', nombre: 'Ramiro', inventado: false, tipo: 'Explore', tarea: 'mapa', desde: hace(MIN), estado: 'trabajando', hasta: null },
      ],
      preguntas: [{ id: 'q1', agente: 'a1', desde: hace(MIN), items: [item('¿Terrario?'), item('¿Colores?')] }],
    }),
    sesion({ sesion: 's2', repo: null, preguntas: [{ id: 'q2', agente: null, desde: hace(MIN), items: [item('¿Stock?')] }] }),
  ]
}

test('preguntas nuevas: una por llamada, solo las que todavía no se avisaron', () => {
  const sesiones = conPreguntas()
  assert.deepEqual(preguntasNuevas(sesiones, new Set()), [
    { id: 'q1', quien: 'Camila', pregunta: '¿Terrario?' },
    { id: 'q2', quien: 'Claude', pregunta: '¿Stock?' },
  ])
  assert.deepEqual(preguntasNuevas(sesiones, new Set(['q1'])).map(q => q.id), ['q2'])
  assert.deepEqual(preguntasNuevas(sesiones, new Set(['q1', 'q2'])), [])
})

test('resumen de la tira mini con preguntas: quien pregunta primero', () => {
  const r = resumenMini(agruparPorProyecto(conPreguntas()), AHORA)
  // Cuenta cada pregunta (ítem), igual que la insignia de la barra de título
  assert.equal(r.titulo, '3 preguntas para vos')
  assert.equal(r.detalle, '2 sesiones · 2 agentes · 2 proyectos')
  assert.equal(r.pendientes, 3)
  assert.deepEqual(r.caras.map(c => [c.nombre, c.animo]), [['Camila', 'teEspera'], ['Claude', 'teEspera'], ['Ramiro', 'leyendo']])
})

test('resumen de la tira mini sin preguntas', () => {
  const r = resumenMini(agruparPorProyecto([sesion({ actividad: 'editando a.ts' })]), AHORA)
  assert.equal(r.titulo, 'Todo en marcha')
  assert.equal(r.detalle, '1 sesión · 0 agentes · 1 proyecto')
  assert.equal(r.pendientes, 0)
  // Sin subagentes, la tira muestra a Claude con el ánimo de la sesión
  assert.deepEqual(r.caras.map(c => [c.nombre, c.animo]), [['Claude', 'editando']])
  assert.equal(resumenMini([], AHORA).titulo, 'Sin sesiones abiertas')
})

// ---- línea de Claude de cada sesión, por orden de prioridad
const trabajando = { id: 'a1', nombre: 'Camila', inventado: false, tipo: 'general-purpose', tarea: 't', desde: hace(MIN), estado: 'trabajando', hasta: null }
const terminado = { ...trabajando, id: 'a2', estado: 'listo', hasta: hace(5 * MIN) }
const propia = { id: 'q1', agente: null, desde: hace(MIN), items: [] }

test('regla 1: con una pregunta pendiente, te hace una pregunta (aunque haya subagentes trabajando)', () => {
  const s = sesion({ actividad: 'esperándote', preguntas: [propia], agentes: [trabajando] })
  assert.equal(animoSesion(s, AHORA), 'teEspera')
  assert.equal(textoActividad(s, AHORA), 'ahora · te hace una pregunta')
})

test('regla 2: sin preguntas y con subagentes trabajando, coordina el equipo (aunque diga "esperándote")', () => {
  const s = sesion({ actividad: 'esperándote', preguntas: [], agentes: [trabajando, terminado] })
  assert.equal(animoSesion(s, AHORA), 'coordinando')
  assert.equal(textoActividad(s, AHORA), 'ahora · coordinando el equipo')
})

test('regla 3: "esperándote" sin preguntas ni subagentes trabajando es esperar tu mensaje, tranquilo', () => {
  const s = sesion({ actividad: 'esperándote', preguntas: [], agentes: [terminado] })
  assert.equal(animoSesion(s, AHORA), 'esperando')
  assert.equal(textoActividad(s, AHORA), 'ahora · esperando tu mensaje')
  // Aunque haga rato que no publica: Claude queda despierto, no se duerme
  assert.equal(animoSesion({ ...s, actualizado: hace(40 * MIN) }, AHORA), 'esperando')
})

test('regla 4: si no, la actividad tal cual', () => {
  const s = sesion({ actividad: 'corriendo npm test', preguntas: [], agentes: [terminado] })
  assert.equal(animoSesion(s, AHORA), 'comando')
  assert.equal(textoActividad(s, AHORA), 'ahora · corriendo npm test')
})

// Marca "Escenario" (docs/diseno/marca-avi-ux.md 7.1, regla 2): el Avi de la marca solo juega si nadie trabaja
test('reposoPermitido: con sesiones que esperan tu mensaje o no dicen nada, puede jugar', () => {
  assert.equal(reposoPermitido(agruparPorProyecto([sesion({ actividad: 'esperándote' }), sesion({ sesion: 's2', repo: null })]), AHORA), true)
})

test('reposoPermitido: sin sesiones no juega (la marca duerme)', () => {
  assert.equal(reposoPermitido([], AHORA), false)
})

test('reposoPermitido: una pregunta pendiente (de Claude o de un subagente) no lo deja jugar', () => {
  const pregunta = { id: 'p', agente: null, items: [{ pregunta: '¿?' }] }
  assert.equal(reposoPermitido(agruparPorProyecto([sesion({ actividad: 'esperándote', preguntas: [pregunta] })]), AHORA), false)
  const deSub = { id: 'q', agente: 'a1', items: [{ pregunta: '¿?' }] }
  const s = sesion({ actividad: 'esperándote', agentes: [{ id: 'a1', nombre: 'Lucas', estado: 'listo', desde: hace(MIN), hasta: hace(MIN) }], preguntas: [deSub] })
  assert.equal(reposoPermitido(agruparPorProyecto([s]), AHORA), false)
})

test('reposoPermitido: cualquier sesión trabajando (escribe, lee, piensa, coordina o espera procesos) no lo deja jugar', () => {
  const trabajos = [
    { actividad: 'editando logica.js' }, { actividad: 'corriendo npm test' }, { actividad: 'leyendo main.js' },
    { actividad: 'pensando' }, { actividad: 'esperándote', agentes: [{ id: 'a', nombre: 'Lucas', estado: 'trabajando', desde: hace(MIN) }] },
    { actividad: 'esperándote', procesos: [{ id: 'b1', descripcion: 'npm run dev', desde: hace(MIN) }] },
  ]
  for (const t of trabajos) {
    const lista = agruparPorProyecto([sesion({ actividad: 'esperándote' }), sesion({ sesion: 's2', ...t })])
    assert.equal(reposoPermitido(lista, AHORA), false, JSON.stringify(t))
  }
})

test('ANIMOS_DE_TRABAJO: una sola lista de lo que cuenta como trabajo, la que usan la marca y la muesca', () => {
  assert.deepEqual([...ANIMOS_DE_TRABAJO].sort(), ['comando', 'coordinando', 'editando', 'escribiendo', 'leyendo', 'pensando', 'proceso'])
})

test('reposoPermitido: una sesión inactiva (sin publicar hace rato) no cuenta como trabajo', () => {
  assert.equal(reposoPermitido(agruparPorProyecto([sesion({ actividad: 'editando x', actualizado: hace(30 * MIN) })]), AHORA), true)
})

test('clic contra arrastre: hasta 4 px es clic; más, arrastre (resumen-ia-ux.md 3.1, el umbral de main.js)', () => {
  assert.equal(UMBRAL_ARRASTRE, 4)
  assert.equal(superaUmbral(3, 2), false)
  assert.equal(superaUmbral(4, 0), false)
  assert.equal(superaUmbral(0, -4), false)
  assert.equal(superaUmbral(3, 3), true)
  assert.equal(superaUmbral(-5, 0), true)
})

test('plural: uno o varios con la cifra adelante', () => {
  assert.equal(plural(1, 'sesión', 'sesiones'), '1 sesión')
  assert.equal(plural(3, 'sesión', 'sesiones'), '3 sesiones')
})

// ------------------------------------------------------------------ variantes de subagente (mascotas-avi-ux.md 7.3)

/** Subagentes con los ids dados, lanzados uno por minuto en ese orden. */
const equipo = ids => ids.map((id, k) => ({ id, nombre: `n${k}`, estado: 'trabajando', desde: new Date(AHORA - (60 - k) * MIN).toISOString() }))
const comoObjeto = mapa => Object.fromEntries(mapa)
const IDS_BOCETO = ['toolu_01Hq8c', 'toolu_01Zr3m', 'toolu_01Ab7x', 'toolu_01Kp2v']

test('variantesEquipo: los cuatro ids del boceto dan 2, 0, 1, 3 (el tercero choca con el segundo y toma la siguiente libre)', () => {
  const v = variantesEquipo(equipo(IDS_BOCETO))
  assert.ok(v instanceof Map)
  assert.deepEqual(IDS_BOCETO.map(id => v.get(id)), [2, 0, 1, 3])
})

test('variantesEquipo: del quinto en adelante, su huella (2, 0, 1, 3, 0, 2)', () => {
  const ids = [...IDS_BOCETO, 'toolu_01Wn9d', 'toolu_01Ty4s']
  const v = variantesEquipo(equipo(ids))
  assert.deepEqual(ids.map(id => v.get(id)), [2, 0, 1, 3, 0, 2])
})

test('variantesEquipo: con 4 o menos, ninguna variante repetida (100 conjuntos al azar, semilla fija)', () => {
  let semilla = 24
  const azar = () => (semilla = (Math.imul(semilla, 1103515245) + 12345) >>> 0)
  for (let k = 0; k < 100; k++) {
    const n = 1 + (azar() % 4)
    const ids = Array.from({ length: n }, (_, i) => `toolu_${azar().toString(36)}_${i}`)
    const v = [...variantesEquipo(equipo(ids)).values()]
    assert.equal(new Set(v).size, n, ids.join(','))
    assert.ok(v.every(x => Number.isInteger(x) && x >= 0 && x <= 3))
  }
})

test('variantesEquipo: agregar un subagente posterior no cambia a los anteriores', () => {
  for (let n = 1; n < 6; n++) {
    const ids = [...IDS_BOCETO, 'toolu_01Wn9d', 'toolu_01Ty4s']
    const antes = comoObjeto(variantesEquipo(equipo(ids.slice(0, n))))
    const despues = comoObjeto(variantesEquipo(equipo(ids.slice(0, n + 1))))
    for (const id of ids.slice(0, n)) assert.equal(despues[id], antes[id], `${n}: ${id}`)
  }
})

test('variantesEquipo: no depende del orden del arreglo (ordena por desde y, a igualdad, por id)', () => {
  const lista = equipo([...IDS_BOCETO, 'toolu_01Wn9d'])
  const base = comoObjeto(variantesEquipo(lista))
  assert.deepEqual(comoObjeto(variantesEquipo([...lista].reverse())), base)
  assert.deepEqual(comoObjeto(variantesEquipo([lista[2], lista[0], lista[4], lista[1], lista[3]])), base)
  // A igualdad de desde, por id: el mismo resultado en cualquier orden
  const juntos = IDS_BOCETO.map(id => ({ id, nombre: id, estado: 'trabajando', desde: hace(MIN) }))
  assert.deepEqual(comoObjeto(variantesEquipo([...juntos].reverse())), comoObjeto(variantesEquipo(juntos)))
})

test('variantesEquipo: sacar uno posterior no cambia a los anteriores', () => {
  const ids = [...IDS_BOCETO, 'toolu_01Wn9d']
  const todos = comoObjeto(variantesEquipo(equipo(ids)))
  const sinUltimo = comoObjeto(variantesEquipo(equipo(ids.slice(0, 3))))
  for (const id of ids.slice(0, 3)) assert.equal(sinUltimo[id], todos[id])
})

test('variantesEquipo, límite conocido (7.3.4): sin el segundo, el tercero vuelve a su huella (0)', () => {
  const v = variantesEquipo(equipo(IDS_BOCETO).filter(a => a.id !== 'toolu_01Zr3m'))
  assert.deepEqual([...v.entries()], [['toolu_01Hq8c', 2], ['toolu_01Ab7x', 0], ['toolu_01Kp2v', 3]])
})

test('variantesEquipo, segunda tanda (16.2): dos terminados antes y cuatro trabajando dan cuatro variantes distintas (3, 2, 1, 0)', () => {
  // El caso medido con ?mascota=lumen&equipo=4: a4 y a5 terminaron; a1, a2, a3 y el nuevo trabajan.
  // Huellas % 4: a1 3, a2 2, a3 1, nuevo 1. a5 terminó antes de que arrancara a1, así que a1 conserva
  // su 3 (con la regla vieja chocaba con a5 y salían 1, 2, 1, 1)
  const en = min => new Date(AHORA - min * MIN).toISOString()
  const lista = [
    { id: 'a1', estado: 'trabajando', desde: en(4), hasta: null },
    { id: 'a2', estado: 'trabajando', desde: en(2), hasta: null },
    { id: 'a3', estado: 'trabajando', desde: en(1), hasta: null },
    { id: 'a4', estado: 'fallo', desde: en(9), hasta: en(3) },
    { id: 'a5', estado: 'listo', desde: en(9), hasta: en(5) },
    { id: 'eq-ses-oficina-5', estado: 'trabajando', desde: en(0), hasta: null },
  ]
  const v = variantesEquipo(lista)
  assert.deepEqual(['a1', 'a2', 'a3', 'eq-ses-oficina-5'].map(id => v.get(id)), [3, 2, 1, 0])
  // Estable: los terminados no cambian y el resultado no depende del orden del arreglo
  assert.deepEqual(comoObjeto(variantesEquipo([...lista].reverse())), comoObjeto(v))
})

test('variantesEquipo: sin subagentes, un mapa vacío', () => {
  assert.equal(variantesEquipo([]).size, 0)
  assert.equal(variantesEquipo(undefined).size, 0)
})

test('NOMBRES_INVENTADOS del mod no cambia: el nombre de la ficha sigue saliendo de huellaTexto(id) % 16', async () => {
  const { readFile } = await import('node:fs/promises')
  const ts = await readFile(new URL('../../hooks/logica.ts', import.meta.url), 'utf8')
  const lista = ts.match(/export const NOMBRES_INVENTADOS = \[([^\]]*)\]/)[1].match(/'[^']*'/g).map(t => t.slice(1, -1))
  assert.deepEqual(lista, ['Bruno', 'Inés', 'Paula', 'Ramiro', 'Sofía', 'Nahuel', 'Agustín', 'Julieta', 'Martina', 'Joaquín', 'Lola', 'Tobías', 'Abril', 'Mateo', 'Renata', 'Felipe'])
  assert.match(ts, /NOMBRES_INVENTADOS\[huellaTexto\(id\) % NOMBRES_INVENTADOS\.length\]/)
})
