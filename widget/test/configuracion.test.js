// Tests de la configuración dentro del panel (#23, docs/diseno/configuracion-ux.md, opción B "Taller"):
// las pestañas y su teclado, la validación de cada ajuste, Esc en sus tres capas, el atajo Ctrl ,, la
// ubicación del panel y lo que dibuja la hoja (entrega 1: la hoja y la pestaña Panel; entrega 2: la
// pestaña Mascota, su vista previa y el Avi de 40 junto al título; entrega 3: Instalación, el modelo
// local, los puntos de las pestañas y el borrado que confirma en el mismo botón). Funciones puras
// de configuracion.js y configuracionVista.js; el DOM, el foco y Rust viven en main.js.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PESTANAS, IDS_PESTANAS, pestanaSiguiente, validarAjuste, cambiosNombres, nombreMarca, subtituloConfiguracion, UBICACIONES, ubicacionDe, bordeDeUbicacion,
  limitesTamano, configInicial, abrirConfiguracion, cerrarConfiguracion, alEsc, esAtajoConfiguracion,
  pestanaValida, valorInterruptor, FORMAS_VISTA, opcionesForma, elegirForma, rotuloEspecie, anuncioEspecie, anuncioForma,
  modoVistaPrevia, CLAVE_VISTA_PREVIA, horaArgentina, textoMod, textoModelo, puntoPestana, clicBorrar, armadoVigente,
  desarmarVencido, MS_CONFIRMAR, filasEnEstaPC, marcoBajo, modeloDesdeChat, descargaDesdeConfig,
  cifrasHistorial, textoHistorial, MOTORES,
} from '../src/configuracion.js'
import { chatInicial, transicionChat } from '../src/chat.js'
import {
  pestanasConfiguracion, seccionConfiguracion, avisoPreguntaConfiguracion, esqueletoConfiguracion, partesMascota, miniConfiguracion,
  nombrePestana, partesModelos, seccionMascota,
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

test('validarAjuste: los nombres, texto de hasta 40 caracteres sin controles; vacío sirve (#37 S4)', () => {
  for (const clave of ['nombreMascota', 'nombreUsuario']) {
    for (const bueno of ['Pancho', '', 'María José', 'x'.repeat(40), '  Nico  ']) assert.equal(validarAjuste(clave, bueno), true, `${clave} ${bueno}`)
    for (const malo of ['x'.repeat(41), 'a\nb', 'a\tb', 3, null, undefined, true, ['Nico']]) assert.equal(validarAjuste(clave, malo), false, `${clave} ${String(malo)}`)
  }
})

test('partesMascota: los campos de nombre con lo guardado, la especie de pista y su error (#37 S1)', () => {
  const campo = (h, id) => h.match(new RegExp(`<input id="${id}"[^>]*>`))?.[0] ?? ''
  const p = partesMascota({ mascota: 'ascua', forma: 'base', nombreMascota: 'Pancho', nombreUsuario: '' })
  const m = campo(p.nombres, 'cfg-nom-mascota')
  assert.match(m, /value="Pancho"/)
  assert.match(m, /placeholder="Ascua"/)
  assert.match(m, /maxlength="40"/)
  assert.match(p.nombres, /<label class="aj-t" for="cfg-nom-mascota">Su nombre<\/label>/)
  const u = campo(p.nombres, 'cfg-nom-usuario')
  assert.match(u, /value=""/)
  assert.match(p.nombres, /<label class="aj-t" for="cfg-nom-usuario">Tu nombre<\/label>/)
  // Lo escrito a mano no rompe el HTML
  assert.match(campo(partesMascota({ mascota: 'avi', nombreUsuario: 'Ni"<co' }).nombres, 'cfg-nom-usuario'), /value="Ni&quot;&lt;co"/)
  // Sin nombres guardados, la pista es la especie elegida
  assert.match(campo(partesMascota({ mascota: 'lumen' }).nombres, 'cfg-nom-mascota'), /placeholder="Lumen"[^>]*value=""/)
  // Un solo "Guardar" para los dos, apagado hasta que se escribe algo distinto (main.js lo prende)
  assert.match(p.nombres, /<button type="button" class="btn" id="cfg-nom-guardar" data-accion="cfg-nom-guardar" data-k="nom-guardar" aria-disabled="true">Guardar<\/button>/)
  assert.doesNotMatch(p.nombres, /aj-error|Guardado/)
  assert.match(partesMascota({ mascota: 'avi', error: 'nombres' }).nombres, /<p class="aj-error" role="alert">No se pudo guardar/)
  assert.match(partesMascota({ mascota: 'avi', nombresOk: true }).nombres, /<span class="nom-ok" role="status">Guardado<\/span>/)
  // La sección entera lleva la parte
  assert.match(seccionMascota({ mascota: 'avi' }), /data-parte="nombres"/)
})

test('cambiosNombres: solo lo que cambió, sin espacios de los bordes; null si alguno no sirve (#37)', () => {
  const guardados = { nombreMascota: 'Pancho', nombreUsuario: '' }
  assert.deepEqual(cambiosNombres(guardados, { nombreMascota: 'Pancho', nombreUsuario: '' }), [])
  assert.deepEqual(cambiosNombres(guardados, { nombreMascota: ' Pancho ', nombreUsuario: ' Nico ' }), [{ clave: 'nombreUsuario', valor: 'Nico' }])
  assert.deepEqual(cambiosNombres(guardados, { nombreMascota: '', nombreUsuario: 'Nico' }),
    [{ clave: 'nombreMascota', valor: '' }, { clave: 'nombreUsuario', valor: 'Nico' }])
  assert.equal(cambiosNombres(guardados, { nombreMascota: 'x'.repeat(41), nombreUsuario: 'Nico' }), null)
  assert.equal(cambiosNombres(guardados, { nombreMascota: 'Pancho', nombreUsuario: 'a\nb' }), null)
})

test('subtituloConfiguracion: en Mascota avisa que los nombres van con Guardar (#37)', () => {
  assert.equal(subtituloConfiguracion('mascota'), 'Se guarda al instante · los nombres, con Guardar')
  for (const tab of ['panel', 'modelos', 'datos', 'instalacion']) assert.equal(subtituloConfiguracion(tab), 'Se guarda al instante', tab)
})

test('nombreMarca: el nombre de la mascota bajo la marca; sin nombre, Avis (#37)', () => {
  assert.equal(nombreMarca('Pancho'), 'Pancho')
  assert.equal(nombreMarca(''), 'Avis')
  assert.equal(nombreMarca(undefined), 'Avis')
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
  assert.deepEqual(c, { abierta: false, tab: 'mascota', editando: null, armado: null, error: null, forma: 'base', ver: false, errorClave: null, pruebas: {} })
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
  // Entrega 4: también se ocultan el "Mostrar" de la clave y su error (el texto vive solo en el campo)
  assert.deepEqual(c, { abierta: false, tab: 'modelos', editando: null, armado: null, error: null, forma: 'base', ver: false, errorClave: null })
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
  assert.match(html, /<span class="sw-e" aria-hidden="true">Sí<\/span><button type="button" class="sw" id="cfg-sw-arriba" role="switch" aria-checked="true" aria-label="Siempre arriba" aria-describedby="cfg-sw-arriba-d" data-accion="cfg-sw" data-valor="arriba" data-k="sw-arriba">/)
  assert.match(html, /aria-hidden="true">No<\/span><button type="button" class="sw" id="cfg-sw-avisar" role="switch" aria-checked="false" aria-label="Avisarme con cada pregunta"/)
  assert.match(html, /aria-checked="false" aria-label="Pausar animaciones"/)
  assert.match(html, /aria-checked="false" aria-label="Arrancar con Windows" aria-describedby="cfg-sw-arranque-d" data-accion="cfg-sw" data-valor="arranque"/)
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

test('Datos: "Dónde queda cada cosa" con las cuatro filas de 5, charlas incluidas (E5)', () => {
  const html = seccionConfiguracion('datos', PANEL)
  assert.match(html, /<h3 class="sub">Dónde queda cada cosa<\/h3><dl class="datos">/)
  const filas = [...html.matchAll(/<dt>([^<]+)<\/dt><dd>([^<]+)<\/dd>/g)].map(m => [m[1], m[2]])
  assert.deepEqual(filas, [
    ['Preferencias', 'preferencias.json, en la carpeta de Avis'],
    ['Claves', 'Administrador de credenciales de Windows · Avis/api/…'],
    ['Modelo local', '%LOCALAPPDATA%\\avis-ia'],
    ['Charlas', 'carpeta de Avis\\chat'],
  ])
  // El historial va primero, con su rótulo
  assert.ok(html.indexOf('Historial del chat') < html.indexOf('Dónde queda cada cosa'))
})

// ------------------------------------------------------------------ entrega 5: charla e historial (4.4, 5 y 7.4)

test('test 7: cifrasHistorial dice "1 charla", "24 charlas" y los MB con coma decimal', () => {
  assert.deepEqual(cifrasHistorial(1, 2048), { charlas: '1 charla', tam: '0,1 MB' })
  assert.deepEqual(cifrasHistorial(24, 1.2 * 1024 ** 2), { charlas: '24 charlas', tam: '1,2 MB' })
  assert.deepEqual(cifrasHistorial(3, 15 * 1024 ** 2), { charlas: '3 charlas', tam: '15 MB' })
  assert.deepEqual(cifrasHistorial(0, 0), { charlas: '0 charlas', tam: '0 MB' })
})

test('7.4: el historial sin leer, vacío, con charlas, borrando y con error', () => {
  assert.deepEqual(textoHistorial(), { estado: 'revisando', tono: 'nada', pill: 'Revisando…', titulo: 'Historial', linea: '', accion: null, error: null })
  assert.deepEqual(textoHistorial({ resumen: { charlas: 0, bytes: 0 } }), { estado: 'vacio', tono: 'nada', pill: 'Vacío', titulo: 'No hay charlas guardadas.', linea: '', accion: null, error: null })
  const DESC = 'En esta PC y, si Engram está prendido, una copia buscable en el proyecto avis. Se borran las dos.'
  assert.deepEqual(textoHistorial({ resumen: { charlas: 24, bytes: 1.2 * 1024 ** 2 } }), {
    estado: 'con', tono: null, pill: null, titulo: '24 charlas · 1,2 MB', linea: DESC,
    accion: { id: 'borrar', texto: 'Borrar todo', armado: '¿Borrar 24 charlas? Sí' }, error: null,
  })
  assert.equal(textoHistorial({ resumen: { charlas: 1, bytes: 10 } }).accion.armado, '¿Borrar 1 charla? Sí')
  assert.deepEqual(textoHistorial({ resumen: { charlas: 24, bytes: 1.2 * 1024 ** 2 }, borrando: true }), {
    estado: 'borrando', tono: 'proc', pill: 'Borrando…', titulo: '24 charlas · 1,2 MB', linea: DESC, accion: null, error: null,
  })
  assert.deepEqual(textoHistorial({ resumen: { charlas: 3, bytes: 3000 }, fallidas: 3 }), {
    estado: 'error', tono: null, pill: null, titulo: '3 charlas · 0,1 MB', linea: DESC,
    accion: { id: 'reintentar', texto: 'Reintentar' }, error: 'No se pudieron borrar 3 charlas. Probá de nuevo.',
  })
  assert.equal(textoHistorial({ resumen: { charlas: 1, bytes: 30 }, fallidas: 1 }).error, 'No se pudo borrar 1 charla. Probá de nuevo.')
})

test('test 8: "Borrar todo" arma 3 s, el segundo clic borra una vez y Esc o el tiempo lo desarman', () => {
  const c0 = { ...configInicial(), abierta: true, tab: 'datos' }
  const a = clicBorrar(c0, 'historial', 1000)
  assert.equal(a.ejecutar, false)
  assert.equal(armadoVigente(a.config, 'historial', 1000 + MS_CONFIRMAR - 1), true)
  const b = clicBorrar(a.config, 'historial', 2000)
  assert.equal(b.ejecutar, true)
  assert.equal(b.config.armado, null)
  // Pasados los 3 s vuelve solo; un clic después vuelve a armar, no borra
  assert.equal(desarmarVencido(a.config, 1000 + MS_CONFIRMAR).armado, null)
  assert.equal(clicBorrar(a.config, 'historial', 1000 + MS_CONFIRMAR).ejecutar, false)
  // Esc desarma (la primera capa de alEsc)
  assert.equal(alEsc(a.config).config.armado, null)
})

test('Datos: la tarjeta del historial en cada estado, con el borrado que confirma en el mismo botón', () => {
  const con = textoHistorial({ resumen: { charlas: 24, bytes: 1.2 * 1024 ** 2 } })
  let html = seccionConfiguracion('datos', { ...PANEL, historial: con })
  assert.match(html, /<h3 class="sub">Historial del chat<\/h3>/)
  assert.match(html, /<b>24 charlas · 1,2 MB<\/b>/)
  assert.match(html, /Se borran las dos\./)
  assert.match(html, /class="lnk peligro" data-accion="cfg-hist" data-valor="borrar" data-k="hist-borrar">Borrar todo</)
  html = seccionConfiguracion('datos', { ...PANEL, historial: con, armado: 'historial', transcurrido: 900 })
  assert.match(html, /class="armado" data-accion="cfg-hist" data-valor="borrar" data-k="hist-borrar"[^>]*--ya:-900ms[^>]*>¿Borrar 24 charlas\? Sí</)
  html = seccionConfiguracion('datos', { ...PANEL, historial: textoHistorial({ resumen: { charlas: 0, bytes: 0 } }) })
  assert.match(html, /<b>No hay charlas guardadas\.<\/b>/)
  assert.match(html, /class="pill t-nada"[^>]*><i class="pt" aria-hidden="true"><\/i><span>Vacío</)
  assert.doesNotMatch(html, /data-accion="cfg-hist"/)
  html = seccionConfiguracion('datos', { ...PANEL, historial: textoHistorial({ resumen: { charlas: 24, bytes: 10 }, borrando: true }) })
  assert.match(html, /class="pill t-proc"[^>]*><i class="pt" aria-hidden="true"><\/i><span>Borrando…</)
  assert.doesNotMatch(html, /data-accion="cfg-hist"/)
  html = seccionConfiguracion('datos', { ...PANEL, historial: textoHistorial({ resumen: { charlas: 3, bytes: 10 }, fallidas: 3 }) })
  assert.match(html, /<p class="aj-error" role="alert">No se pudieron borrar 3 charlas\. Probá de nuevo\.<\/p>/)
  assert.match(html, /<button type="button" class="btn" data-accion="cfg-hist" data-valor="reintentar" data-k="hist-reintentar">Reintentar</)
  // Sin leer todavía: "Revisando…", sin saltos de diseño (7.5)
  assert.match(seccionConfiguracion('datos', PANEL), /<span>Revisando…<\/span>/)
})

test('Modelos: "Quién responde" va primero, bajo "Charla", con los dos segmentos y el elegido', () => {
  assert.deepEqual(MOTORES, [['claude', 'Claude Code'], ['local', 'Local']])
  const html = seccionConfiguracion('modelos', { ...DATOS3, motor: 'local' })
  assert.match(html, /^<h2 class="oculto">Modelos<\/h2><h3 class="sub">Charla<\/h3>/)
  assert.match(html, /Quién responde/)
  assert.match(html, /En las charlas nuevas\. Cada una puede cambiarlo\./)
  assert.match(html, /role="radiogroup" aria-label="Quién responde"/)
  assert.match(html, /aria-checked="false" tabindex="-1" data-accion="cfg-motor" data-valor="claude" data-k="cfg-motor-claude">Claude Code</)
  assert.match(html, /aria-checked="true" tabindex="0" data-accion="cfg-motor" data-valor="local" data-k="cfg-motor-local">Local</)
  // Sin motor guardado, Claude Code
  assert.match(seccionConfiguracion('modelos', DATOS3), /aria-checked="true" tabindex="0" data-accion="cfg-motor" data-valor="claude"/)
  // El error al guardar, debajo de su fila
  assert.match(seccionConfiguracion('modelos', { ...DATOS3, error: 'motor' }), /No se pudo guardar\. Probá de nuevo\./)
  // Es una parte propia: cambiarla no redibuja el campo de una clave
  assert.ok(partesModelos({ ...DATOS3, motor: 'local' }).charla.includes('data-valor="local"'))
})

test('el motor de las charlas nuevas: cambia la preferencia y no la charla abierta; la nueva arranca con él', () => {
  const ctx = { ahoraMs: 1000, id: 'c-1' }
  let c = transicionChat(chatInicial(), { tipo: 'nueva' }, ctx).chat
  c = { ...c, conversacion: { ...c.conversacion, mensajes: [{ rol: 'usuario', texto: 'hola' }] } }
  assert.equal(c.conversacion.motor, 'claude')
  const r = transicionChat(c, { tipo: 'motor-nuevas', motor: 'local' }, ctx)
  assert.deepEqual(r.efectos, [])
  assert.equal(r.chat.motor, 'local')
  assert.equal(r.chat.conversacion, c.conversacion)
  // Un motor que no existe: nada
  assert.equal(transicionChat(c, { tipo: 'motor-nuevas', motor: 'gpt' }, ctx).chat, c)
  // La próxima charla nueva arranca con el motor elegido, sin carpeta si es local
  const n = transicionChat(r.chat, { tipo: 'nueva' }, { ...ctx, id: 'c-2' })
  assert.equal(n.chat.conversacion.id, 'c-2')
  assert.equal(n.chat.conversacion.motor, 'local')
  assert.equal(n.chat.conversacion.carpeta, null)
  assert.deepEqual(n.efectos[0], { tipo: 'abrir', conversacion: 'c-2', motor: 'local', carpeta: null, sesionClaude: null, modelo: null })
})

test('cada panel empieza con su h2 oculto: no hay salto de h1 a h3 (16, D-f)', () => {
  for (const { id, nombre } of PESTANAS.filter(p => ['panel', 'datos', 'mascota'].includes(p.id))) {
    assert.ok(seccionConfiguracion(id, { ...PANEL, mascota: 'avi', forma: 'base' }).startsWith(`<h2 class="oculto">${nombre}</h2>`), id)
  }
})

test('los errores de guardar se anuncian: role=alert (16, M3)', () => {
  assert.match(seccionConfiguracion('panel', { ...PANEL, error: 'arriba' }), /<p class="aj-error" role="alert">No se pudo guardar\. Probá de nuevo\.<\/p>/)
})

test('cada interruptor: el título es su label y la descripción lo describe (16, D-b)', () => {
  const html = seccionConfiguracion('panel', PANEL)
  assert.match(html, /<label class="aj-t" for="cfg-sw-arriba">Siempre arriba<\/label><span class="aj-d" id="cfg-sw-arriba-d">Queda encima de las otras ventanas\.<\/span>/)
  assert.match(html, /<button type="button" class="sw" id="cfg-sw-arriba" role="switch"[^>]* aria-describedby="cfg-sw-arriba-d"/)
})

test('la estrella de la forma evolucionada no se lee (16, D-c)', () => {
  assert.match(partesMascota({ mascota: 'avi', forma: 'base' }).texto, />Faro <span aria-hidden="true">✦<\/span><\/button>/)
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
  assert.match(base, /role="radio" aria-checked="false" tabindex="-1" data-accion="cfg-forma" data-valor="evo"[^>]*>Pira <span aria-hidden="true">✦<\/span></)
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
  assert.match(seccionConfiguracion('mascota', { ...MASCOTA, error: 'mascota' }), /<p class="aj-error" role="alert">No se pudo guardar. Probá de nuevo.<\/p>/)
  assert.doesNotMatch(seccionConfiguracion('mascota', { ...MASCOTA, error: 'arriba' }), /No se pudo guardar/)
})

test('Mascota por partes: cambiar la forma no toca la figura (así el acto no se corta)', () => {
  const base = partesMascota(MASCOTA)
  const evo = partesMascota({ ...MASCOTA, forma: 'evo' })
  assert.deepEqual(Object.keys(base), ['fig', 'texto', 'fichas', 'error', 'nombres'])
  assert.equal(evo.fig, base.fig)
  // Los campos de nombre tampoco (#37): se escribe en ellos sin que se redibujen
  assert.equal(evo.nombres, base.nombres)
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

// ------------------------------------------------------------------ entrega 3: Instalación y modelo local (7.2, 7.3, 6.3 y caso 6 de la sección 10)

const AHORA_AR = Date.parse('2026-11-23T13:33:00Z') // 10:33 en Argentina
const V = '0.9.0'
const lectura = (mod = {}, claude = { encontrado: true, version: '2.1.329' }) => ({
  claude, mod: { instalado: true, activo: true, version: V, error: null, ...mod },
})

test('horaArgentina: la hora en Argentina (UTC−3), en 24 h', () => {
  assert.equal(horaArgentina(AHORA_AR), '10:33')
  assert.equal(horaArgentina(Date.parse('2026-11-23T02:05:00Z')), '23:05')
})

test('textoMod: al día, con la última revisión de hoy en hora de Argentina', () => {
  const t = textoMod(lectura(), { revisado: AHORA_AR - 60000, fallo: false }, null, AHORA_AR)
  assert.equal(t.estado, 'al-dia')
  assert.equal(t.tono, 'ok')
  assert.equal(t.pill, `Prendido · ${V}`)
  assert.equal(t.linea, 'Al día. Se actualiza solo, una vez por día. Revisado hoy 10:32.')
  assert.equal(t.accion, null)
})

test('textoMod: "hoy" es el día de Argentina, no el de UTC; ayer dice "ayer"; antes, sin hora', () => {
  const ahora = Date.parse('2026-11-23T02:00:00Z') // 22/11 23:00 en Argentina
  assert.match(textoMod(lectura(), { revisado: Date.parse('2026-11-22T12:00:00Z'), fallo: false }, null, ahora).linea, /Revisado hoy 09:00\.$/)
  assert.match(textoMod(lectura(), { revisado: AHORA_AR - 20 * 3600000, fallo: false }, null, AHORA_AR).linea, /Revisado ayer 14:33\.$/)
  assert.equal(textoMod(lectura(), { revisado: AHORA_AR - 3 * 86400000, fallo: false }, null, AHORA_AR).linea, 'Al día. Se actualiza solo, una vez por día.')
  assert.equal(textoMod(lectura(), null, null, AHORA_AR).linea, 'Al día. Se actualiza solo, una vez por día.')
})

test('textoMod: recién actualizado (el aviso de tomar_aviso_mod de hoy)', () => {
  const aviso = { tipo: 'actualizo', version: V, desde: '0.8.2', cuando: AHORA_AR - 5 * 60000 }
  const t = textoMod(lectura(), { revisado: AHORA_AR - 5 * 60000, fallo: false }, aviso, AHORA_AR)
  assert.equal(t.estado, 'actualizado')
  assert.equal(t.tono, 'ok')
  assert.equal(t.pill, `Prendido · ${V}`)
  assert.equal(t.linea, `Se actualizó solo de 0.8.2 a ${V} hoy a las 10:28.`)
  // Un aviso de otro día, de otra versión o de una instalación no cuenta como "recién actualizado"
  assert.equal(textoMod(lectura(), null, { ...aviso, cuando: AHORA_AR - 2 * 86400000 }, AHORA_AR).estado, 'al-dia')
  assert.equal(textoMod(lectura(), null, { ...aviso, version: '0.8.9' }, AHORA_AR).estado, 'al-dia')
  assert.equal(textoMod(lectura(), null, { tipo: 'instalo', version: V, cuando: AHORA_AR }, AHORA_AR).estado, 'al-dia')
})

test('textoMod: apagado, con "Prender"', () => {
  const t = textoMod(lectura({ activo: false }), null, null, AHORA_AR)
  assert.equal(t.estado, 'apagado')
  assert.equal(t.tono, 'aviso')
  assert.equal(t.pill, `Apagado · ${V}`)
  assert.equal(t.linea, 'Claude Code no lo carga: sin el mod, Avis no ve tus sesiones.')
  assert.deepEqual(t.accion, { id: 'activar', texto: 'Prender', ocupado: false })
  // Mientras se prende, el botón sigue a la vista pero no corre otra vez
  assert.equal(textoMod(lectura({ activo: false }), null, null, AHORA_AR, { prendiendo: true }).accion.ocupado, true)
})

test('textoMod: instalando (mod-auto "empieza")', () => {
  const t = textoMod(lectura({ instalado: false, activo: false, version: null }), null, null, AHORA_AR, { instalando: true })
  assert.equal(t.estado, 'instalando')
  assert.equal(t.tono, 'proc')
  assert.equal(t.pill, 'Instalando…')
  assert.equal(t.linea, 'Faltaba el mod: Avis lo instala solo, no hace falta que hagas nada.')
  assert.equal(t.accion, null)
  // Antes de la primera lectura también se ve
  assert.equal(textoMod(null, null, null, AHORA_AR, { instalando: true }).estado, 'instalando')
})

test('textoMod: no pudo revisar hoy (fallo)', () => {
  const t = textoMod(lectura(), { revisado: AHORA_AR - 60000, fallo: true }, null, AHORA_AR)
  assert.equal(t.estado, 'fallo')
  assert.equal(t.tono, 'aviso')
  assert.equal(t.pill, `Prendido · ${V}`)
  assert.equal(t.linea, 'Hoy no se pudo revisar si hay versión nueva. Vuelve a probar mañana.')
})

test('textoMod: sin Claude Code, con "Abrir primeros pasos"', () => {
  const t = textoMod(lectura({ instalado: false, activo: false, version: null }, { encontrado: false, version: null }), null, null, AHORA_AR)
  assert.equal(t.estado, 'sin-claude')
  assert.equal(t.tono, 'error')
  assert.equal(t.pill, 'Sin Claude Code')
  assert.equal(t.linea, 'Avis no encontró Claude Code en esta PC.')
  assert.deepEqual(t.accion, { id: 'pp', texto: 'Abrir primeros pasos', ocupado: false })
})

test('textoMod: sin el mod y sin instalación en curso, "Sin instalar" (14: fuera de la tabla de 7.3)', () => {
  const sin = lectura({ instalado: false, activo: false, version: null })
  const t = textoMod(sin, null, null, AHORA_AR)
  assert.equal(t.estado, 'sin-instalar')
  assert.equal(t.tono, 'aviso')
  assert.equal(t.pill, 'Sin instalar')
  assert.equal(t.linea, 'Avis lo instala solo en la próxima revisión.')
  assert.deepEqual(t.accion, { id: 'pp', texto: 'Abrir primeros pasos', ocupado: false })
  assert.equal(textoMod(sin, { revisado: AHORA_AR, fallo: true }, null, AHORA_AR).linea, 'Hoy no se pudo instalar. Vuelve a probar mañana.')
})

test('textoMod: sin lectura todavía, "Revisando…" (7.5)', () => {
  const t = textoMod(null, null, null, AHORA_AR)
  assert.equal(t.estado, 'revisando')
  assert.equal(t.tono, 'nada')
  assert.equal(t.pill, 'Revisando…')
  assert.equal(t.accion, null)
})

const PROG = (bajado, total = 2.6 * 1024 ** 3) => ({ bajado: Math.round(bajado), total: Math.round(total) })

test('textoModelo: listo, con "Borrar {cifra}" que pide confirmar en el mismo botón', () => {
  const t = textoModelo({ modelo: 'listo', trabajo: null, progreso: PROG(2.6 * 1024 ** 3) })
  assert.equal(t.estado, 'listo')
  assert.equal(t.tono, 'ok')
  assert.equal(t.pill, 'Listo')
  assert.equal(t.linea, 'Se apaga solo a los 10 min sin uso.')
  assert.deepEqual(t.acciones, [{ id: 'borrar', texto: 'Borrar 2,6 GB', armado: '¿Borrar 2,6 GB? Sí' }])
})

test('textoModelo: la cifra la da el backend, nunca fija', () => {
  const t = textoModelo({ modelo: 'falta', trabajo: null, progreso: PROG(0, 3.1 * 1024 ** 3) })
  assert.deepEqual(t.acciones, [{ id: 'descargar', texto: 'Descargar 3,1 GB' }])
  const sinTotal = textoModelo({ modelo: 'falta', trabajo: null, progreso: { bajado: 0, total: 0 } })
  assert.deepEqual(sinTotal.acciones, [{ id: 'descargar', texto: 'Descargar' }])
})

test('textoModelo: falta, con "Descargar"', () => {
  const t = textoModelo({ modelo: 'falta', trabajo: null, progreso: PROG(0) })
  assert.equal(t.estado, 'falta')
  assert.equal(t.tono, 'nada')
  assert.equal(t.pill, 'Sin instalar')
  assert.equal(t.linea, 'Hace falta para charlar sin internet. Se baja una sola vez.')
  assert.deepEqual(t.acciones, [{ id: 'descargar', texto: 'Descargar 2,6 GB' }])
  // Una descarga que se cortó (sin nada que la siga) vuelve a ofrecer descargar
  assert.equal(textoModelo({ modelo: 'bajando', trabajo: null, progreso: PROG(1024 ** 3) }).estado, 'falta')
})

test('textoModelo: bajando, con el porcentaje, la barra y las cifras', () => {
  const t = textoModelo({ modelo: 'bajando', trabajo: 'descargando', progreso: PROG(1.1 * 1024 ** 3) })
  assert.equal(t.estado, 'bajando')
  assert.equal(t.tono, 'proc')
  assert.equal(t.pill, 'Bajando 42 %')
  assert.equal(t.porcentaje, 42)
  assert.equal(t.linea, '1,1 de 2,6 GB · si se corta, sigue donde quedó')
  assert.deepEqual(t.acciones, [])
})

test('textoModelo: roto, con "Bajar de nuevo" y "Borrar"', () => {
  const t = textoModelo({ modelo: 'roto', trabajo: null, progreso: PROG(0) })
  assert.equal(t.estado, 'roto')
  assert.equal(t.tono, 'error')
  assert.equal(t.pill, 'Roto')
  assert.equal(t.linea, 'Faltan piezas o no coinciden. Bajalo de nuevo.')
  assert.deepEqual(t.acciones, [{ id: 'descargar', texto: 'Bajar de nuevo' }, { id: 'borrar', texto: 'Borrar', armado: '¿Borrar? Sí' }])
})

test('textoModelo: sin saber todavía del modelo, "Revisando…"', () => {
  const t = textoModelo({ modelo: null, trabajo: null, progreso: { bajado: 0, total: 0 } })
  assert.equal(t.estado, 'revisando')
  assert.equal(t.pill, 'Revisando…')
  assert.deepEqual(t.acciones, [])
})

test('modeloDesdeChat: la tarjeta lee el modelo que guarda la charla (st.chat), la misma descarga', () => {
  const prog = PROG(1.1 * 1024 ** 3)
  assert.deepEqual(modeloDesdeChat(chatInicial()), { modelo: null, trabajo: null, progreso: null })
  assert.deepEqual(modeloDesdeChat({ ...chatInicial(), local: 'instalado', progreso: prog }), { modelo: 'listo', trabajo: null, progreso: prog })
  assert.deepEqual(modeloDesdeChat({ ...chatInicial(), local: 'bajando', progreso: prog }), { modelo: 'bajando', trabajo: 'descargando', progreso: prog })
  assert.deepEqual(modeloDesdeChat({ ...chatInicial(), local: 'roto' }), { modelo: 'roto', trabajo: null, progreso: null })
  assert.deepEqual(modeloDesdeChat({ ...chatInicial(), local: 'falta', progreso: prog }), { modelo: 'falta', trabajo: null, progreso: prog })
  // De punta a punta con la máquina de la charla: el progreso de oficina://modelo llega a la tarjeta
  const bajando = transicionChat(chatInicial(), { tipo: 'modelo', modelo: 'bajando', bajado: prog.bajado, total: prog.total }).chat
  const t = textoModelo(modeloDesdeChat(bajando))
  assert.equal(t.estado, 'bajando')
  assert.equal(t.porcentaje, 42)
  assert.equal(textoModelo(modeloDesdeChat(chatInicial())).estado, 'revisando')
})

test('descarga desde la configuración (7.2): baja solo si falta o está roto; en curso, listo o sin saber, nada', () => {
  assert.equal(descargaDesdeConfig({ ...chatInicial(), local: 'falta' }), true)
  assert.equal(descargaDesdeConfig({ ...chatInicial(), local: 'roto' }), true)
  assert.equal(descargaDesdeConfig({ ...chatInicial(), local: 'bajando' }), false)
  assert.equal(descargaDesdeConfig({ ...chatInicial(), local: 'instalado' }), false)
  assert.equal(descargaDesdeConfig(chatInicial()), false)
})

test('descarga desde la configuración: bajar el modelo no abre la hoja ni manda nada al terminar (un clic, nunca solo)', () => {
  const TOTAL = Math.round(2.6 * 1024 ** 3)
  const conBorrador = { ...chatInicial(), local: 'falta', borrador: 'hola', progreso: { bajado: 0, total: TOTAL } }
  const empieza = transicionChat(conBorrador, { tipo: 'modelo', modelo: 'bajando' })
  assert.deepEqual(empieza.efectos, [])
  assert.equal(empieza.chat.abierta, false, 'la hoja no se abre')
  const avanza = transicionChat(empieza.chat, { tipo: 'modelo', modelo: 'bajando', bajado: TOTAL / 2, total: TOTAL })
  assert.deepEqual(avanza.efectos, [])
  const fin = transicionChat(avanza.chat, { tipo: 'modelo', modelo: 'listo', bajado: TOTAL, total: TOTAL })
  assert.deepEqual(fin.efectos, [], 'al terminar no se manda nada')
  assert.equal(fin.chat.abierta, false)
  assert.equal(fin.chat.estado, 'vacio')
  assert.equal(fin.chat.borrador, 'hola', 'lo escrito queda')
  assert.equal(fin.chat.local, 'instalado')
  assert.deepEqual(fin.chat.progreso, { bajado: TOTAL, total: TOTAL })
  assert.equal(textoModelo(modeloDesdeChat(fin.chat)).estado, 'listo')
})

test('puntoPestana: las tres reglas de 6.3 y nada en el resto', () => {
  assert.deepEqual(puntoPestana({ modelo: 'bajando' }, 'modelos'), { tono: 'proc', texto: ', bajando el modelo' })
  assert.deepEqual(puntoPestana({ modelo: 'listo', claves: { openai: { estado: 'rechazada' } } }, 'modelos'), { tono: 'error', texto: ', una clave rechazada' })
  for (const mod of ['apagado', 'sin-claude', 'sin-instalar']) {
    assert.deepEqual(puntoPestana({ mod }, 'instalacion'), { tono: 'aviso', texto: ', el mod necesita atención' }, mod)
  }
  for (const mod of ['al-dia', 'actualizado', 'instalando', 'fallo', 'revisando']) assert.equal(puntoPestana({ mod }, 'instalacion'), null, mod)
  assert.equal(puntoPestana({ modelo: 'listo' }, 'modelos'), null)
  for (const p of ['mascota', 'panel', 'datos']) assert.equal(puntoPestana({ modelo: 'bajando', mod: 'apagado' }, p), null, p)
})

test('confirmar en el mismo botón: arma, a los 3 s se desarma solo y el segundo clic antes ejecuta una vez', () => {
  const c0 = configInicial()
  const uno = clicBorrar(c0, 'local', 1000)
  assert.equal(uno.ejecutar, false)
  assert.deepEqual(uno.config.armado, { id: 'local', hasta: 1000 + MS_CONFIRMAR })
  assert.equal(armadoVigente(uno.config, 'local', 2000), true)
  const dos = clicBorrar(uno.config, 'local', 3999)
  assert.equal(dos.ejecutar, true)
  assert.equal(dos.config.armado, null)
  // Un tercer clic vuelve a armar: no ejecuta dos veces
  assert.equal(clicBorrar(dos.config, 'local', 4000).ejecutar, false)
  // Pasados los 3 s, el clic vuelve a armar en lugar de borrar
  assert.equal(clicBorrar(uno.config, 'local', 4000).ejecutar, false)
  assert.equal(armadoVigente(uno.config, 'local', 4000), false)
  assert.equal(desarmarVencido(uno.config, 3999), uno.config)
  assert.equal(desarmarVencido(uno.config, 4000).armado, null)
  // Otro botón armado no confirma este
  assert.equal(clicBorrar({ ...c0, armado: { id: 'otro', hasta: 9999 } }, 'local', 1000).ejecutar, false)
  // Esc lo desarma (alEsc, la capa del medio)
  assert.equal(alEsc({ ...uno.config, abierta: true }).accion, 'desarmar')
  assert.equal(MS_CONFIRMAR, 3000)
})

test('filasEnEstaPC: Claude Code con su versión y GitHub conectado; sin leer, "Revisando…"', () => {
  const r = { claude: { encontrado: true, version: '2.1.329' }, gh: { instalado: true }, cuenta: { estado: 'conectada' } }
  const f = filasEnEstaPC(lectura(), r)
  assert.deepEqual(f.claude, { descripcion: 'Versión 2.1.329', tono: 'ok', pill: 'Encontrado' })
  assert.deepEqual(f.github, { tono: 'ok', pill: 'Conectado' })
  const sin = filasEnEstaPC(null, null)
  assert.equal(sin.claude.pill, 'Revisando…')
  assert.equal(sin.github.pill, 'Revisando…')
  // Sin la lectura del mod, Claude Code sale de la revisión de primeros pasos
  assert.equal(filasEnEstaPC(null, r).claude.descripcion, 'Versión 2.1.329')
  const nada = filasEnEstaPC(lectura({}, { encontrado: false, version: null }), { gh: { instalado: false }, cuenta: { estado: 'sin-gh' } })
  assert.deepEqual(nada.claude, { descripcion: 'Avis no encontró Claude Code en esta PC.', tono: 'error', pill: 'Sin instalar' })
  assert.deepEqual(nada.github, { tono: 'aviso', pill: 'Sin instalar' })
  assert.deepEqual(filasEnEstaPC(null, { gh: { instalado: true }, cuenta: { estado: 'sin-sesion' } }).github, { tono: 'aviso', pill: 'Sin conectar' })
})

const DATOS3 = {
  ...PANEL,
  modelo: textoModelo({ modelo: 'listo', trabajo: null, progreso: PROG(2.6 * 1024 ** 3) }),
  mod: textoMod(lectura(), { revisado: AHORA_AR - 60000, fallo: false }, null, AHORA_AR),
  enEstaPC: filasEnEstaPC(lectura(), { gh: { instalado: true }, cuenta: { estado: 'conectada' } }),
  version: '0.10.0', armado: null,
}

test('Modelos: la tarjeta del modelo local con su píldora, su línea y sus acciones', () => {
  const html = seccionConfiguracion('modelos', DATOS3)
  assert.match(html, /<h3 class="sub">Modelo local<\/h3>/)
  assert.match(html, /<b>Qwen3-4B<\/b>/)
  assert.match(html, /en esta PC, sin internet/)
  assert.match(html, /class="pill t-ok"/)
  assert.match(html, /Se apaga solo a los 10 min sin uso\./)
  assert.match(html, /data-accion="cfg-local" data-valor="borrar"[^>]*>Borrar 2,6 GB</)
  // Con el chat en main, "Quién responde" se muestra (E5, D6)
  assert.match(html, /Quién responde/)
})

test('Modelos: armado, el botón dice "¿Borrar 2,6 GB? Sí" con la línea que se vacía en 3 s', () => {
  const html = seccionConfiguracion('modelos', { ...DATOS3, armado: 'local', transcurrido: 1200 })
  assert.match(html, /class="armado"[^>]*data-accion="cfg-local" data-valor="borrar"[^>]*>¿Borrar 2,6 GB\? Sí</)
  assert.match(html, /--ya:-1200ms/)
  // El mismo data-k en los dos estados: el foco sigue en el botón
  assert.match(seccionConfiguracion('modelos', DATOS3), /data-k="local-borrar"/)
  assert.match(html, /data-k="local-borrar"/)
})

test('Modelos: bajando, la barra es un progressbar con su valor y no hay acciones', () => {
  const html = seccionConfiguracion('modelos', { ...DATOS3, modelo: textoModelo({ modelo: 'bajando', trabajo: 'descargando', progreso: PROG(1.1 * 1024 ** 3) }) })
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="42"/)
  assert.match(html, /aria-label="Descarga del modelo local"/)
  assert.match(html, /1,1 de 2,6 GB · si se corta, sigue donde quedó/)
  assert.match(html, /class="pill t-proc"/)
  assert.doesNotMatch(html, /data-accion="cfg-local"/)
})

test('Modelos: falta, "Descargar" es el botón primario; un error al borrar queda debajo de la tarjeta', () => {
  const html = seccionConfiguracion('modelos', { ...DATOS3, modelo: textoModelo({ modelo: 'falta', trabajo: null, progreso: PROG(0) }), error: 'modelo' })
  assert.match(html, /class="btn" data-accion="cfg-local" data-valor="descargar" data-k="local-descargar">Descargar 2,6 GB</)
  assert.match(html, /No se pudo borrar\. Probá de nuevo\./)
})

test('Instalación: la tarjeta del mod, "En esta PC", Primeros pasos y la versión de Avis', () => {
  const html = seccionConfiguracion('instalacion', DATOS3)
  const orden = ['>Mod<', 'Mod de Claude Code', `Prendido · ${V}`, 'Al día.', '>En esta PC<', 'Claude Code', 'Versión 2.1.329', 'Encontrado', 'GitHub', 'Para ver al equipo.', 'Conectado', 'Primeros pasos', 'Revisa y arregla la instalación, paso por paso.', 'Abrir →', 'Avis 0.10.0 · widget']
  let desde = 0
  for (const t of orden) {
    const i = html.indexOf(t, desde)
    assert.ok(i >= 0, `falta o fuera de orden: ${t}`)
    desde = i
  }
  assert.match(html, /data-accion="cfg-pp"/)
})

test('Instalación: apagado, "Prender" corre el paso activar; sin Claude Code, "Abrir primeros pasos"', () => {
  const apagado = seccionConfiguracion('instalacion', { ...DATOS3, mod: textoMod(lectura({ activo: false }), null, null, AHORA_AR) })
  assert.match(apagado, /class="btn" data-accion="cfg-mod" data-valor="activar" data-k="mod-activar">Prender</)
  const prendiendo = seccionConfiguracion('instalacion', { ...DATOS3, mod: textoMod(lectura({ activo: false }), null, null, AHORA_AR, { prendiendo: true }) })
  assert.match(prendiendo, /data-valor="activar"[^>]*aria-disabled="true"/)
  const sinClaude = seccionConfiguracion('instalacion', { ...DATOS3, mod: textoMod(lectura({}, { encontrado: false, version: null }), null, null, AHORA_AR) })
  assert.match(sinClaude, /data-accion="cfg-mod" data-valor="pp"[^>]*>Abrir primeros pasos</)
})

test('Instalación: las versiones se escapan', () => {
  const html = seccionConfiguracion('instalacion', { ...DATOS3, version: '<b>1</b>', mod: textoMod(lectura({ version: '<i>x</i>' }), null, null, AHORA_AR) })
  assert.doesNotMatch(html, /<b>1<\/b>|<i>x<\/i>/)
})

test('pestanasConfiguracion: el punto de estado con su texto oculto; sin estado, sin punto', () => {
  const html = pestanasConfiguracion('mascota', { instalacion: { tono: 'aviso', texto: ', el mod necesita atención' } })
  assert.match(html, /id="cfg-t-instalacion"[^>]*>Instalación<i class="pt t-aviso" aria-hidden="true"><\/i><span class="oculto">, el mod necesita atención<\/span><\/button>/)
  assert.match(html, /id="cfg-t-modelos"[^>]*>Modelos<\/button>/)
  assert.equal(nombrePestana('modelos', null), 'Modelos')
})

test('marcoBajo: menos de 520 px CSS de tablero compacta el encabezado de la hoja (16, M4)', () => {
  assert.equal(marcoBajo(327), true)
  assert.equal(marcoBajo(519), true)
  assert.equal(marcoBajo(520), false)
  assert.equal(marcoBajo(640), false)
})
