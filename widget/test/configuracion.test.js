// Tests de la configuración dentro del panel (#23, docs/diseno/configuracion-ux.md, opción B "Taller"):
// las pestañas y su teclado, la validación de cada ajuste, Esc en sus tres capas, el atajo Ctrl ,, la
// ubicación del panel y lo que dibuja la hoja (entrega 1: la hoja y la pestaña Panel; entrega 2: la
// pestaña Mascota, su vista previa y el Avi de 40 junto al título). Funciones puras
// de configuracion.js y configuracionVista.js; el DOM, el foco y Rust viven en main.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PESTANAS, IDS_PESTANAS, pestanaSiguiente, validarAjuste, UBICACIONES, ubicacionDe, bordeDeUbicacion,
  limitesTamano, configInicial, abrirConfiguracion, cerrarConfiguracion, alEsc, esAtajoConfiguracion,
  pestanaValida, valorInterruptor, FORMAS_VISTA, opcionesForma, elegirForma, rotuloEspecie, anuncioEspecie, anuncioForma,
  modoVistaPrevia, CLAVE_VISTA_PREVIA,
} from '../src/configuracion.js'
import {
  pestanasConfiguracion, seccionConfiguracion, avisoPreguntaConfiguracion, esqueletoConfiguracion, partesMascota, miniConfiguracion,
} from '../src/configuracionVista.js'
import { NOMBRES_ESPECIES } from '../src/especies.js'

// ------------------------------------------------------------------ pestañas (4.4 y caso 1 de la sección 10)

test('las cinco pestañas, en el orden fijo de la dirección', () => {
  assert.deepEqual(PESTANAS.map(p => [p.id, p.nombre]), [
    ['mascota', 'Mascota'], ['panel', 'Panel'], ['modelos', 'Modelos'], ['datos', 'Datos'], ['instalacion', 'Instalación'],
  ])
  assert.deepEqual(IDS_PESTANAS, ['mascota', 'panel', 'modelos', 'datos', 'instalacion'])
})

test('pestanaSiguiente: → la siguiente con vuelta, ← al revés, Inicio y Fin; otra tecla, la misma', () => {
  const l = IDS_PESTANAS
  assert.equal(pestanaSiguiente('mascota', 'ArrowRight', l), 'panel')
  assert.equal(pestanaSiguiente('instalacion', 'ArrowRight', l), 'mascota')
  assert.equal(pestanaSiguiente('panel', 'ArrowLeft', l), 'mascota')
  assert.equal(pestanaSiguiente('mascota', 'ArrowLeft', l), 'instalacion')
  assert.equal(pestanaSiguiente('datos', 'Home', l), 'mascota')
  assert.equal(pestanaSiguiente('panel', 'End', l), 'instalacion')
  assert.equal(pestanaSiguiente('datos', 'Enter', l), 'datos')
  assert.equal(pestanaSiguiente('datos', 'ArrowDown', l), 'datos')
  // Sirve igual para cualquier lista (los segmentos de "Dónde vive")
  const u = UBICACIONES.map(([v]) => v)
  assert.equal(pestanaSiguiente('izquierda', 'ArrowRight', u), 'flota')
  assert.equal(pestanaSiguiente('flota', 'ArrowLeft', u), 'izquierda')
})

test('una pestaña desconocida no se abre: queda la de antes', () => {
  assert.equal(pestanaValida('panel'), true)
  assert.equal(pestanaValida('Panel'), false)
  assert.equal(pestanaValida('privacidad'), false)
  assert.equal(pestanaValida(undefined), false)
})

// ------------------------------------------------------------------ validarAjuste (caso 2, sin `motor`)

test('validarAjuste: mascota acepta solo las siete especies', () => {
  for (const e of NOMBRES_ESPECIES) assert.equal(validarAjuste('mascota', e), true, e)
  assert.equal(validarAjuste('mascota', 'Ascua'), false)
  assert.equal(validarAjuste('mascota', ''), false)
  assert.equal(validarAjuste('mascota', null), false)
  assert.equal(validarAjuste('mascota', 'dragon'), false)
})

test('validarAjuste: arriba, avisar y pausa solo booleanos', () => {
  for (const clave of ['arriba', 'avisar', 'pausa']) {
    assert.equal(validarAjuste(clave, true), true, clave)
    assert.equal(validarAjuste(clave, false), true, clave)
    for (const malo of ['true', 1, 0, null, undefined, {}]) assert.equal(validarAjuste(clave, malo), false, `${clave} ${String(malo)}`)
  }
})

test('validarAjuste: una clave desconocida se rechaza', () => {
  assert.equal(validarAjuste('tamano', 125), false)
  assert.equal(validarAjuste('clave', 'sk-falsa'), false)
  assert.equal(validarAjuste('', true), false)
  assert.equal(validarAjuste(undefined, true), false)
})

test('valorInterruptor: lo que no es booleano vuelve al de fábrica', () => {
  assert.equal(valorInterruptor(false, true), false)
  assert.equal(valorInterruptor(true, false), true)
  assert.equal(valorInterruptor('no', true), true)
  assert.equal(valorInterruptor(undefined, false), false)
})

// ------------------------------------------------------------------ abrir, cerrar y Esc en tres capas (4.1)

test('abre en la última pestaña usada en esta ejecución; la primera vez, Mascota', () => {
  let c = configInicial()
  assert.deepEqual(c, { abierta: false, tab: 'mascota', editando: null, armado: null, error: null, forma: 'base' })
  c = abrirConfiguracion(c)
  assert.equal(c.abierta, true)
  assert.equal(c.tab, 'mascota')
  c = cerrarConfiguracion({ ...c, tab: 'panel' })
  assert.equal(c.abierta, false)
  assert.equal(abrirConfiguracion(c).tab, 'panel')
  // Una tarjeta "Abrir configuración" puede pedir una pestaña; una desconocida no cambia la de antes
  assert.equal(abrirConfiguracion(c, 'datos').tab, 'datos')
  assert.equal(abrirConfiguracion(c, 'nada').tab, 'panel')
})

test('cerrar descarta la clave que se escribía, desarma el borrado, saca el error y vuelve la vista previa a la base', () => {
  const c = cerrarConfiguracion({ abierta: true, tab: 'modelos', editando: 'anthropic', armado: 'clave:openai', error: { k: 'arriba' }, forma: 'evo' })
  assert.deepEqual(c, { abierta: false, tab: 'modelos', editando: null, armado: null, error: null, forma: 'base' })
})

test('Esc: primero cancela la clave, después desarma el "¿Borrar? Sí", después cierra', () => {
  const abierta = { abierta: true, tab: 'modelos', editando: 'anthropic', armado: 'clave:openai', error: null }
  const uno = alEsc(abierta)
  assert.equal(uno.accion, 'cancelar-clave')
  assert.equal(uno.config.editando, null)
  assert.equal(uno.config.armado, 'clave:openai')
  assert.equal(uno.config.abierta, true)
  const dos = alEsc(uno.config)
  assert.equal(dos.accion, 'desarmar')
  assert.equal(dos.config.armado, null)
  assert.equal(dos.config.abierta, true)
  const tres = alEsc(dos.config)
  assert.equal(tres.accion, 'cerrar')
  assert.equal(tres.config.abierta, false)
  assert.equal(tres.config.tab, 'modelos')
  // Cerrada, Esc no es de la configuración (lo usa el panel acoplado, que se pliega)
  const cuatro = alEsc(tres.config)
  assert.equal(cuatro.accion, null)
  assert.equal(cuatro.config, tres.config)
})

test('Ctrl , abre la configuración; con Alt, Shift o sin Ctrl, no', () => {
  assert.equal(esAtajoConfiguracion({ key: ',', ctrlKey: true }), true)
  assert.equal(esAtajoConfiguracion({ key: ',', ctrlKey: true, altKey: true }), false)
  assert.equal(esAtajoConfiguracion({ key: ',', ctrlKey: true, shiftKey: true }), false)
  assert.equal(esAtajoConfiguracion({ key: ',', ctrlKey: false }), false)
  assert.equal(esAtajoConfiguracion({ key: '.', ctrlKey: true }), false)
  assert.equal(esAtajoConfiguracion({ key: ',', metaKey: true }), false)
})

// ------------------------------------------------------------------ Panel: dónde vive y tamaño

test('ubicacionDe y bordeDeUbicacion: flotando es "flota"; acoplada, su borde', () => {
  assert.deepEqual(UBICACIONES, [['flota', 'Flota'], ['arriba', 'Arriba'], ['derecha', 'Derecha'], ['abajo', 'Abajo'], ['izquierda', 'Izquierda']])
  assert.equal(ubicacionDe(null), 'flota')
  assert.equal(ubicacionDe({ borde: 'derecha', lugar: 0.4 }), 'derecha')
  assert.equal(ubicacionDe({ borde: 'centro' }), 'flota')
  assert.equal(bordeDeUbicacion('flota'), null)
  assert.equal(bordeDeUbicacion('abajo'), 'abajo')
  assert.equal(bordeDeUbicacion('cualquiera'), undefined)
})

test('limitesTamano: − se apaga en 100 % y + en 200 %', () => {
  assert.deepEqual(limitesTamano(100), { achicar: false, agrandar: true })
  assert.deepEqual(limitesTamano(150), { achicar: true, agrandar: true })
  assert.deepEqual(limitesTamano(200), { achicar: true, agrandar: false })
})

// ------------------------------------------------------------------ lo que dibuja la hoja (4.3 y 5)

const PANEL = { tamano: 125, ubicacion: 'flota', arriba: true, avisar: false, pausa: false, arranque: false, error: null }

test('las pestañas: tablist con una sola en el orden de tabulación y el indicador', () => {
  const html = pestanasConfiguracion('panel')
  assert.match(html, /role="tablist" aria-label="Configuración"/)
  assert.equal((html.match(/role="tab"/g) ?? []).length, 5)
  assert.match(html, /id="cfg-t-panel" aria-selected="true" aria-controls="cfg-p" tabindex="0"/)
  assert.match(html, /id="cfg-t-mascota" aria-selected="false" aria-controls="cfg-p" tabindex="-1"/)
  assert.ok(html.indexOf('>Mascota<') < html.indexOf('>Panel<') && html.indexOf('>Datos<') < html.indexOf('>Instalación<'))
  assert.match(html, /<span class="ind" aria-hidden="true"><\/span>/)
})

test('el esqueleto: aviso, pestañas, panel de pestaña enfocable y la región de anuncios', () => {
  const html = esqueletoConfiguracion('panel')
  assert.match(html, /id="cfg-aviso"/)
  assert.match(html, /role="tabpanel" id="cfg-p" aria-labelledby="cfg-t-panel" tabindex="0"/)
  assert.match(html, /class="oculto" role="status" id="cfg-vivo"/)
})

test('Panel: las seis filas, en orden y con los textos de la dirección', () => {
  const html = seccionConfiguracion('panel', PANEL)
  const textos = [
    'Tamaño', 'De 100 a 200 %, de a 25. También con Ctrl + y Ctrl −.',
    'Dónde vive', 'Flotando, o acoplada a un borde de la pantalla.',
    'Siempre arriba', 'Queda encima de las otras ventanas.',
    'Avisarme con cada pregunta', 'Una notificación de Windows cuando Claude te pregunta algo.',
    'Pausar animaciones', 'Las mascotas quedan quietas en su pose.',
    'Arrancar con Windows', 'Apagado de fábrica: solo lo cambia tu clic.',
  ]
  let desde = 0
  for (const t of textos) {
    const i = html.indexOf(t, desde)
    assert.ok(i >= 0, `falta o fuera de orden: ${t}`)
    desde = i
  }
})

test('Panel: cada interruptor es un switch con su estado y "Sí"/"No" oculto al lector', () => {
  const html = seccionConfiguracion('panel', PANEL)
  assert.match(html, /<span class="sw-e" aria-hidden="true">Sí<\/span><button type="button" class="sw" role="switch" aria-checked="true" aria-label="Siempre arriba" data-accion="cfg-sw" data-valor="arriba" data-k="sw-arriba">/)
  assert.match(html, /aria-hidden="true">No<\/span><button type="button" class="sw" role="switch" aria-checked="false" aria-label="Avisarme con cada pregunta"/)
  assert.match(html, /aria-checked="false" aria-label="Pausar animaciones"/)
  assert.match(html, /aria-checked="false" aria-label="Arrancar con Windows" data-accion="cfg-sw" data-valor="arranque"/)
  const prendido = seccionConfiguracion('panel', { ...PANEL, arranque: true, pausa: true })
  assert.match(prendido, /aria-checked="true" aria-label="Arrancar con Windows"/)
  assert.match(prendido, /aria-checked="true" aria-label="Pausar animaciones"/)
})

test('Panel: el tamaño con − y + que se apagan en las puntas y el porcentaje', () => {
  const html = seccionConfiguracion('panel', PANEL)
  assert.match(html, /role="group" aria-label="Tamaño del panel"/)
  assert.match(html, /aria-label="Achicar" aria-disabled="false"/)
  assert.match(html, /<output class="pv"[^>]*>125 %<\/output>/)
  assert.match(seccionConfiguracion('panel', { ...PANEL, tamano: 100 }), /aria-label="Achicar" aria-disabled="true"/)
  assert.match(seccionConfiguracion('panel', { ...PANEL, tamano: 200 }), /aria-label="Agrandar" aria-disabled="true"/)
})

test('Panel: "Dónde vive" es un radiogroup con la ubicación actual elegida y enfocable', () => {
  const html = seccionConfiguracion('panel', { ...PANEL, ubicacion: 'derecha' })
  assert.match(html, /role="radiogroup" aria-label="Dónde vive"/)
  assert.match(html, /role="radio" aria-checked="true" tabindex="0" data-accion="cfg-ubic" data-valor="derecha"/)
  assert.match(html, /role="radio" aria-checked="false" tabindex="-1" data-accion="cfg-ubic" data-valor="flota"/)
  assert.equal((html.match(/role="radio"/g) ?? []).length, 5)
})

test('Panel: un error al guardar queda debajo de su fila, y solo en esa', () => {
  const html = seccionConfiguracion('panel', { ...PANEL, error: 'avisar' })
  assert.equal((html.match(/No se pudo guardar\. Probá de nuevo\./g) ?? []).length, 1)
  const fila = html.slice(html.indexOf('Avisarme con cada pregunta'), html.indexOf('Pausar animaciones'))
  assert.match(fila, /No se pudo guardar\. Probá de nuevo\./)
  assert.doesNotMatch(seccionConfiguracion('panel', PANEL), /No se pudo guardar/)
})

test('las pestañas que todavía no tienen contenido muestran solo su rótulo', () => {
  for (const { id, nombre } of PESTANAS.filter(p => p.id !== 'panel' && p.id !== 'mascota')) {
    assert.equal(seccionConfiguracion(id, PANEL), `<h3 class="sub">${nombre}</h3>`, id)
  }
})

test('con una pregunta pendiente, arriba de las pestañas: "Claude te hace una pregunta · Ver →"', () => {
  assert.equal(avisoPreguntaConfiguracion(0), '')
  const html = avisoPreguntaConfiguracion(2)
  assert.match(html, /data-accion="cfg-ver"/)
  assert.match(html, /Claude te hace una pregunta/)
  assert.match(html, /Ver →/)
})

// ------------------------------------------------------------------ Mascota (entrega 2: 4.4, 5, 6.1 y 8)

test('la vista previa tiene dos formas: "Base" y "{evoNombre} ✦" de la especie', () => {
  assert.deepEqual(FORMAS_VISTA, ['base', 'evo'])
  assert.deepEqual(opcionesForma('ascua'), [['base', 'Base'], ['evo', 'Pira ✦']])
  assert.deepEqual(opcionesForma('nodo'), [['base', 'Base'], ['evo', 'Nodo Ω ✦']])
  // Una especie desconocida es el Avi (como en todo el widget)
  assert.deepEqual(opcionesForma('dragon'), [['base', 'Base'], ['evo', 'Faro ✦']])
})

test('elegirForma: solo "base" o "evo"; otra cosa deja la que había', () => {
  const c = { ...configInicial(), abierta: true }
  assert.equal(elegirForma(c, 'evo').forma, 'evo')
  assert.equal(elegirForma({ ...c, forma: 'evo' }, 'base').forma, 'base')
  assert.equal(elegirForma(c, 'Pira'), c)
  assert.equal(elegirForma(c, undefined), c)
})

test('rotuloEspecie: "Especie {n} de 7 · {tipo}"', () => {
  assert.equal(rotuloEspecie('avi'), 'Especie 1 de 7 · Familia · el de siempre')
  assert.equal(rotuloEspecie('ascua'), 'Especie 2 de 7 · Dracónico · brasa')
  assert.equal(rotuloEspecie('lumen'), 'Especie 7 de 7 · Polilla · luz')
})

test('los anuncios de la mascota: la especie elegida y el cambio de forma', () => {
  assert.equal(anuncioEspecie('ascua'), 'Tu mascota ahora es Ascua')
  assert.equal(anuncioEspecie('morro'), 'Tu mascota ahora es Morro')
  assert.equal(anuncioForma('ascua', 'evo'), 'Ascua evoluciona a Pira')
  assert.equal(anuncioForma('ascua', 'base'), 'Pira vuelve a Ascua')
})

test('modoVistaPrevia: el acto real con movimiento; con movimiento reducido o pausa, al instante', () => {
  assert.equal(modoVistaPrevia('evo', { reducido: false, pausa: false }), 'evolucionar')
  assert.equal(modoVistaPrevia('base', { reducido: false, pausa: false }), 'devolver')
  for (const forma of ['evo', 'base']) {
    assert.equal(modoVistaPrevia(forma, { reducido: true, pausa: false }), 'al-instante', forma)
    assert.equal(modoVistaPrevia(forma, { reducido: false, pausa: true }), 'al-instante', forma)
  }
})

const MASCOTA = { ...PANEL, mascota: 'ascua', forma: 'base', error: null }

test('Mascota: el escenario con el Avi de 120 evolucionable, el rótulo, el nombre, el concepto y la nota', () => {
  const html = seccionConfiguracion('mascota', MASCOTA)
  assert.match(html, /class="esc-m"/)
  // El Avi de la vista previa: forma evolucionable con su propia clave (no la de ninguna sesión)
  assert.match(html, /class="esc-fig" data-parte="fig"><span class="avi" style="--t:120px/)
  assert.match(html, new RegExp(`data-evo="${CLAVE_VISTA_PREVIA}"`))
  assert.match(html, /class="[^"]*m-ascua/)
  assert.match(html, />Especie 2 de 7 · Dracónico · brasa</)
  assert.match(html, /<h3 class="esc-n">Ascua<\/h3>/)
  assert.match(html, />Un dragoncito que guarda una brasa en el pecho: cuanto más trabaja, más brilla.</)
  assert.match(html, />Evoluciona sola mientras Claude coordina un equipo</)
})

test('Mascota: "Base · {evo}" es un radiogroup con la forma elegida enfocable', () => {
  const base = seccionConfiguracion('mascota', MASCOTA)
  assert.match(base, /role="radiogroup" aria-label="Vista previa de la forma"/)
  assert.match(base, /role="radio" aria-checked="true" tabindex="0" data-accion="cfg-forma" data-valor="base"[^>]*>Base</)
  assert.match(base, /role="radio" aria-checked="false" tabindex="-1" data-accion="cfg-forma" data-valor="evo"[^>]*>Pira ✦</)
  const evo = seccionConfiguracion('mascota', { ...MASCOTA, forma: 'evo' })
  assert.match(evo, /aria-checked="true" tabindex="0" data-accion="cfg-forma" data-valor="evo"/)
})

test('Mascota: siete fichas en un radiogroup, la elegida con ✓ y la única en el orden de tabulación', () => {
  const html = seccionConfiguracion('mascota', MASCOTA)
  assert.match(html, /class="especies" role="radiogroup" aria-label="Mascota de Claude"/)
  const fichas = [...html.matchAll(/<button type="button" class="esp" role="radio" aria-checked="(true|false)" tabindex="(0|-1)" data-accion="cfg-esp" data-valor="([a-z]+)"[^>]*aria-label="([^"]+)"/g)]
  assert.deepEqual(fichas.map(f => f[3]), NOMBRES_ESPECIES)
  assert.deepEqual(fichas.filter(f => f[1] === 'true').map(f => [f[2], f[3]]), [['0', 'ascua']])
  assert.equal(fichas.filter(f => f[2] === '0').length, 1)
  assert.equal(fichas[1][4], 'Ascua, evoluciona a Pira')
  assert.equal(fichas[3][4], 'Nodo, evoluciona a Nodo Ω')
  assert.equal((html.match(/class="esp-ok"/g) ?? []).length, 1)
  // Nombre y forma a la vista; el Avi de 54, en la base
  assert.match(html, /<span class="esp-n">Bruma<\/span><span class="esp-e">› Regia<\/span>/)
  assert.equal((html.match(/class="avi" style="--t:54px/g) ?? []).length, 7)
  // La luz de cada ficha es el acento de su especie
  assert.match(html, /data-valor="escarcha"[^>]*style="--c:#7DF9FF"/)
  // Celda 8
  assert.match(html, /<p class="esp-nota">Se ve en la marca, la muesca y cada sesión. Sus subagentes son de su especie.<\/p>/)
})

test('Mascota: un error al guardar la especie queda debajo de las fichas', () => {
  assert.doesNotMatch(seccionConfiguracion('mascota', MASCOTA), /No se pudo guardar/)
  assert.match(seccionConfiguracion('mascota', { ...MASCOTA, error: 'mascota' }), /<p class="aj-error">No se pudo guardar. Probá de nuevo.<\/p>/)
  assert.doesNotMatch(seccionConfiguracion('mascota', { ...MASCOTA, error: 'arriba' }), /No se pudo guardar/)
})

test('Mascota por partes: cambiar la forma no toca la figura (así el acto no se corta)', () => {
  const base = partesMascota(MASCOTA)
  const evo = partesMascota({ ...MASCOTA, forma: 'evo' })
  assert.deepEqual(Object.keys(base), ['fig', 'texto', 'fichas', 'error'])
  assert.equal(evo.fig, base.fig)
  assert.equal(evo.fichas, base.fichas)
  assert.notEqual(evo.texto, base.texto)
  // Otra especie cambia la figura, el texto y las fichas
  const otra = partesMascota({ ...MASCOTA, mascota: 'lumen' })
  assert.notEqual(otra.fig, base.fig)
  assert.notEqual(otra.texto, base.texto)
  assert.notEqual(otra.fichas, base.fichas)
  // Cada parte va en su lugar dentro de la sección
  const html = seccionConfiguracion('mascota', MASCOTA)
  for (const [k, v] of Object.entries(base)) assert.ok(html.includes(`data-parte="${k}">${v}<`), k)
})

test('el Avi de 40 junto al título: fuera de Mascota, decorativo y sin las partes de la forma evolucionada', () => {
  assert.equal(miniConfiguracion('ascua', 'mascota'), '')
  const html = miniConfiguracion('ascua', 'panel')
  assert.match(html, /^<span class="avi" style="--t:40px/)
  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /m-ascua/)
  // La forma chica (mascotas 5.5): nunca evoluciona ni lleva el detalle de la otra forma
  assert.doesNotMatch(html, /data-evo|evo-p/)
})
