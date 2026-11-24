// Tests de las claves de API de la configuración (#23, entrega 4, docs/diseno/configuracion-ux.md 7.1 y
// 9.4, casos 3 y 4 de la sección 10): la forma de una clave, su ayuda, la fila de cada estado, lo que
// vuelve de Rust y el campo que se escribe. Funciones puras de configuracion.js y configuracionVista.js.
// Ningún test usa una clave real: todas dicen FALSA.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PROVEEDORES, IDS_PROVEEDORES, proveedorDe, formaClave, finalDe, ayudaClave, detalleErrorClave, textoClave,
  clavesDesdeLectura, resultadoPrueba, anuncioPrueba, anuncioGuardada, ANUNCIO_CLAVE_BORRADA, empezarClave, retieneConfig,
  configInicial, alEsc, puntoPestana, textoModelo,
} from '../src/configuracion.js'
import { seccionConfiguracion, partesModelos } from '../src/configuracionVista.js'

const CLAVE40 = `sk-ant-FALSA-${'x'.repeat(23)}a1B2`
const LEIDA = { guardada: true, final: 'a1B2' }
const GB = 1024 ** 3
const DATOS = {
  modelo: textoModelo({ modelo: 'listo', trabajo: null, progreso: { bajado: Math.round(2.6 * GB), total: Math.round(2.6 * GB) } }),
  armado: null, error: null, transcurrido: 0,
}

// ------------------------------------------------------------------ lógica (casos 3 y 4)

test('los tres proveedores, en orden, con su inicial (sin logos, D11) y su prefijo típico', () => {
  assert.deepEqual(PROVEEDORES.map(p => [p.id, p.nombre, p.de, p.empresa, p.inicial, p.prefijo]), [
    ['anthropic', 'Claude', 'Anthropic', 'Anthropic', 'A', 'sk-ant-'],
    ['openai', 'OpenAI', 'GPT', 'OpenAI', 'O', 'sk-'],
    ['gemini', 'Gemini', 'Google', 'Google', 'G', 'AIza'],
  ])
  assert.deepEqual(IDS_PROVEEDORES, ['anthropic', 'openai', 'gemini'])
  assert.equal(proveedorDe('openai').nombre, 'OpenAI')
  assert.equal(proveedorDe('google'), null)
})

test('formaClave: vacía, con espacios, corta; recorta las puntas; el final; el prefijo avisa sin bloquear', () => {
  assert.deepEqual(formaClave('anthropic', ''), { estado: 'vacia' })
  assert.deepEqual(formaClave('anthropic', '   \n'), { estado: 'vacia' })
  assert.deepEqual(formaClave('anthropic', null), { estado: 'vacia' })
  assert.deepEqual(formaClave('anthropic', 'sk-ant-FALSA de-prueba-000000000'), { estado: 'espacios' })
  assert.deepEqual(formaClave('anthropic', 'sk-ant-FALSA\tde-prueba-000000000'), { estado: 'espacios' })
  assert.deepEqual(formaClave('anthropic', 'sk-ant-FALSA-1234'), { estado: 'corta' })
  assert.deepEqual(formaClave('anthropic', `  ${CLAVE40}\n`), { estado: 'ok', clave: CLAVE40, final: 'a1B2', aviso: null })
  // 20 caracteres justos alcanzan
  assert.equal(formaClave('openai', 'sk-FALSA-0123456789a').estado, 'ok')
  assert.equal(formaClave('openai', 'sk-FALSA-0123456789').estado, 'corta')
  // Prefijo distinto del típico: se puede guardar igual (D13)
  assert.deepEqual(formaClave('gemini', 'xk-FALSA-0123456789abcdef'), { estado: 'ok', clave: 'xk-FALSA-0123456789abcdef', final: 'cdef', aviso: 'prefijo' })
  assert.equal(formaClave('gemini', 'AIzaFALSA-0123456789abcdef').aviso, null)
  // Proveedor desconocido: sin aviso
  assert.equal(formaClave('otro', 'xk-FALSA-0123456789abcdef').aviso, null)
})

test('finalDe: los últimos 4 caracteres, no unidades de UTF-16', () => {
  assert.equal(finalDe(CLAVE40), 'a1B2')
  assert.equal(finalDe('FALSA-🔑🔑🔑🔑'), '🔑🔑🔑🔑')
  assert.equal(finalDe('abc'), 'abc')
  assert.equal(finalDe(null), '')
})

test('ayudaClave: la de siempre, los tres errores en rojo, el prefijo en ámbar con "Guardar igual" y Windows', () => {
  assert.deepEqual(ayudaClave('anthropic', null), { texto: 'Va al Administrador de credenciales de Windows. Después solo vas a ver el final.', tono: '', invalida: false, boton: 'Guardar' })
  assert.deepEqual(ayudaClave('anthropic', 'vacia'), { texto: 'Pegá la clave para guardarla.', tono: 'mal', invalida: true, boton: 'Guardar' })
  assert.deepEqual(ayudaClave('anthropic', 'espacios'), { texto: 'Tiene espacios en el medio: revisá que esté entera.', tono: 'mal', invalida: true, boton: 'Guardar' })
  assert.deepEqual(ayudaClave('anthropic', 'corta'), { texto: 'Es muy corta para ser una clave.', tono: 'mal', invalida: true, boton: 'Guardar' })
  assert.deepEqual(ayudaClave('gemini', 'prefijo'), { texto: 'No parece una clave de Google (suelen empezar con AIza). Guardala igual si estás seguro.', tono: 'aviso', invalida: false, boton: 'Guardar igual' })
  assert.deepEqual(ayudaClave('openai', { windows: 'error 1312' }), { texto: 'Windows no dejó guardar la clave (error 1312).', tono: 'mal', invalida: false, boton: 'Guardar' })
})

test('detalleErrorClave: solo el código de Windows; cualquier otro texto no pasa (podría traer algo de la clave)', () => {
  assert.equal(detalleErrorClave('windows:1312'), 'error 1312')
  assert.equal(detalleErrorClave(new Error('windows:5')), 'error 5')
  assert.equal(detalleErrorClave(`invalid args: ${CLAVE40}`), 'sin detalle')
  assert.equal(detalleErrorClave(undefined), 'sin detalle')
})

test('textoClave: revisando, sin clave y editando', () => {
  assert.deepEqual(textoClave('anthropic', {}), { estado: 'revisando', tono: 'nada', linea: 'Revisando…', mascara: null, acciones: [] })
  assert.deepEqual(textoClave('anthropic', { lectura: { guardada: false } }), {
    estado: 'sin', tono: '', linea: 'Sin clave', mascara: null, acciones: [{ id: 'agregar', texto: '+ Agregar clave' }],
  })
  const ed = textoClave('anthropic', { lectura: LEIDA, editando: true })
  assert.equal(ed.estado, 'editando')
  assert.equal(ed.ver, false)
  assert.equal(ed.ayuda.boton, 'Guardar')
  assert.deepEqual(ed.acciones, [{ id: 'guardar', texto: 'Guardar' }, { id: 'cancelar', texto: 'Cancelar' }])
  assert.equal(ed.mascara, null)
  const igual = textoClave('gemini', { lectura: { guardada: false }, editando: true, error: 'prefijo', ver: true })
  assert.equal(igual.ver, true)
  assert.deepEqual(igual.acciones[0], { id: 'guardar', texto: 'Guardar igual' })
})

test('textoClave: guardada, probando, válida, rechazada, sin red y otra respuesta (una fila por estado de 7.1)', () => {
  const mascara = { texto: '••••a1B2', oculto: 'termina en a1B2' }
  const probar = { id: 'probar', texto: 'Probar' }
  const reemplazar = { id: 'reemplazar', texto: 'Reemplazar' }
  const borrar = { id: 'borrar', texto: 'Borrar', pregunta: '¿Borrar la clave? Sí', armado: false }
  assert.deepEqual(textoClave('anthropic', { lectura: LEIDA }), { estado: 'guardada', tono: '', linea: 'Guardada', mascara, acciones: [probar, reemplazar, borrar] })
  assert.deepEqual(textoClave('anthropic', { lectura: LEIDA, prueba: { estado: 'probando' } }), {
    estado: 'probando', tono: 'proc', linea: 'Probando con Anthropic…', mascara, acciones: [{ ...probar, deshabilitado: true }, reemplazar, borrar],
  })
  assert.deepEqual(textoClave('anthropic', { lectura: LEIDA, prueba: { estado: 'valida' } }), { estado: 'valida', tono: 'ok', linea: '✓ Válida · probada recién', mascara, acciones: [reemplazar, borrar] })
  assert.deepEqual(textoClave('gemini', { lectura: LEIDA, prueba: { estado: 'rechazada' } }), { estado: 'rechazada', tono: 'mal', linea: '× Google la rechazó', mascara, acciones: [reemplazar, borrar] })
  assert.deepEqual(textoClave('openai', { lectura: LEIDA, prueba: { estado: 'sin-red' } }), { estado: 'sin-red', tono: 'aviso', linea: 'No se pudo probar: sin conexión', mascara, acciones: [probar, reemplazar, borrar] })
  assert.deepEqual(textoClave('openai', { lectura: LEIDA, prueba: { estado: 'otro', codigo: 500 } }), {
    estado: 'otro', tono: 'aviso', linea: 'No se pudo probar', titulo: 'OpenAI respondió 500', mascara, acciones: [probar, reemplazar, borrar],
  })
  // Armado: "Borrar" pide confirmar en el mismo botón (D5)
  assert.deepEqual(textoClave('anthropic', { lectura: LEIDA, armado: true }).acciones[2], { ...borrar, armado: true })
})

test('textoClave nunca muestra más que el final: con una clave de 40 caracteres en la entrada, no están los primeros 36', () => {
  assert.equal(CLAVE40.length, 40)
  const inicio = CLAVE40.slice(0, 36)
  for (const prueba of [null, { estado: 'probando' }, { estado: 'valida' }, { estado: 'rechazada' }, { estado: 'sin-red' }, { estado: 'otro', codigo: 418 }]) {
    const t = textoClave('anthropic', { lectura: { guardada: true, final: CLAVE40 }, prueba })
    assert.equal(t.mascara.texto, '••••a1B2')
    assert.ok(!JSON.stringify(t).includes(inicio), JSON.stringify(prueba))
    const html = seccionConfiguracion('modelos', { ...DATOS, claves: { anthropic: t } })
    assert.ok(!html.includes(inicio))
    assert.ok(!html.includes(CLAVE40.slice(-5)))
  }
})

test('clavesDesdeLectura: la lectura de claves_estado por proveedor, solo con los últimos 4', () => {
  assert.deepEqual(clavesDesdeLectura([
    { proveedor: 'anthropic', guardada: true, final: 'a1B2' },
    { proveedor: 'openai', guardada: false },
    { proveedor: 'gemini', guardada: true, final: CLAVE40 },
    { proveedor: 'otro', guardada: true, final: 'zzzz' },
  ]), { anthropic: { guardada: true, final: 'a1B2' }, openai: { guardada: false, final: '' }, gemini: { guardada: true, final: 'a1B2' } })
  assert.equal(clavesDesdeLectura(null), null)
  assert.equal(clavesDesdeLectura({}), null)
})

test('resultadoPrueba y los anuncios: lo que devuelve probar_clave, en la fila y en voz alta', () => {
  assert.deepEqual(resultadoPrueba({ resultado: 'valida' }), { estado: 'valida', codigo: null })
  assert.deepEqual(resultadoPrueba({ resultado: 'rechazada' }), { estado: 'rechazada', codigo: null })
  assert.deepEqual(resultadoPrueba({ resultado: 'sin-red' }), { estado: 'sin-red', codigo: null })
  assert.deepEqual(resultadoPrueba({ resultado: 'otro', estado: 500 }), { estado: 'otro', codigo: 500 })
  assert.deepEqual(resultadoPrueba({ resultado: 'raro' }), { estado: 'otro', codigo: null })
  assert.deepEqual(resultadoPrueba(null), { estado: 'otro', codigo: null })
  assert.equal(anuncioPrueba('anthropic', { estado: 'valida' }), 'La clave es válida')
  assert.equal(anuncioPrueba('gemini', { estado: 'rechazada' }), 'Google rechazó la clave')
  assert.equal(anuncioPrueba('openai', { estado: 'sin-red' }), 'No se pudo probar: sin conexión')
  assert.equal(anuncioPrueba('openai', { estado: 'otro', codigo: 500 }), 'No se pudo probar: OpenAI respondió 500')
  assert.equal(anuncioGuardada('anthropic'), 'Clave de Claude guardada en Credenciales de Windows')
  assert.equal(ANUNCIO_CLAVE_BORRADA, 'Clave borrada de Credenciales de Windows')
})

test('la clave que se escribe: abrir el campo; Esc lo cancela con su "Mostrar" y su error; la hoja empieza sin nada', () => {
  const c0 = configInicial()
  assert.equal(c0.ver, false)
  assert.equal(c0.errorClave, null)
  assert.deepEqual(c0.pruebas, {})
  const c = empezarClave({ ...c0, abierta: true, tab: 'modelos', armado: { id: 'clave:openai', hasta: 1 }, ver: true, errorClave: 'corta' }, 'anthropic')
  assert.equal(c.editando, 'anthropic')
  assert.equal(c.ver, false)
  assert.equal(c.errorClave, null)
  assert.equal(c.armado, null)
  // Un proveedor desconocido no abre nada
  assert.equal(empezarClave(c0, 'google'), c0)
  const esc = alEsc({ ...c, ver: true, errorClave: 'prefijo' })
  assert.equal(esc.accion, 'cancelar-clave')
  assert.equal(esc.config.editando, null)
  assert.equal(esc.config.ver, false)
  assert.equal(esc.config.errorClave, null)
})

test('acoplada, el panel queda abierto mientras se escribe una clave (4.1)', () => {
  assert.equal(retieneConfig({ abierta: true, editando: 'openai' }), true)
  assert.equal(retieneConfig({ abierta: true, editando: null }), false)
  assert.equal(retieneConfig({ abierta: false, editando: 'openai' }), false)
})

test('puntoPestana: una clave rechazada pone el punto rojo de Modelos (con los estados de textoClave)', () => {
  const claves = { gemini: textoClave('gemini', { lectura: LEIDA, prueba: { estado: 'rechazada' } }) }
  assert.deepEqual(puntoPestana({ modelo: 'listo', claves }, 'modelos'), { tono: 'error', texto: ', una clave rechazada' })
  assert.equal(puntoPestana({ modelo: 'listo', claves: { gemini: textoClave('gemini', { lectura: LEIDA }) } }, 'modelos'), null)
})

// ------------------------------------------------------------------ lo que dibuja la hoja

const CLAVES = { anthropic: textoClave('anthropic', { lectura: LEIDA }), openai: textoClave('openai', { lectura: { guardada: false } }), gemini: textoClave('gemini', {}) }

test('Modelos: "Claves de API" va antes del modelo local, con el candado, las tres filas y la línea del chat', () => {
  const html = seccionConfiguracion('modelos', { ...DATOS, claves: CLAVES })
  assert.ok(html.indexOf('Claves de API') < html.indexOf('Modelo local'))
  assert.match(html, /<h3 class="sub">Claves de API<\/h3><p class="cand"><svg[^>]*aria-hidden="true"/)
  assert.match(html, /Se guardan en el Administrador de credenciales de Windows, nunca en un archivo\. Avis solo vuelve a mostrar los últimos 4 caracteres\./)
  for (const [id, inicial, nombre, de] of [['anthropic', 'A', 'Claude', 'Anthropic'], ['openai', 'O', 'OpenAI', 'GPT'], ['gemini', 'G', 'Gemini', 'Google']]) {
    assert.match(html, new RegExp(`data-parte="clave-${id}"><div class="cl"><span class="prov" aria-hidden="true">${inicial}</span><div><div class="cl-t"><b>${nombre}</b><span class="cl-de">${de}</span>`))
  }
  assert.match(html, /Las usa la charla por API cuando llegue/)
  assert.match(html, /data-parte="local"/)
  // "Quién responde" sigue sin mostrarse hasta que llegue el chat (D6)
  assert.doesNotMatch(html, /Quién responde/)
})

test('Modelos por partes: cada clave y el modelo local se cambian solos (así el campo que se escribe no se toca)', () => {
  const p = partesModelos({ ...DATOS, claves: CLAVES })
  assert.deepEqual(Object.keys(p), ['clave-anthropic', 'clave-openai', 'clave-gemini', 'local'])
  assert.match(p['clave-anthropic'], /Guardada/)
  assert.match(p['clave-openai'], /data-accion="cfg-clave-agregar" data-valor="openai" data-k="r-openai">\+ Agregar clave</)
  assert.match(p['clave-gemini'], /class="pill t-nada"><i class="pt" aria-hidden="true"><\/i><span>Revisando…/)
  assert.match(p.local, /Qwen3-4B/)
  // Sin la lectura todavía, las tres filas dicen "Revisando…"
  assert.equal((seccionConfiguracion('modelos', DATOS).match(/Revisando…/g) ?? []).length, 3)
})

test('Clave guardada: la máscara con su nombre accesible, Probar, Reemplazar y Borrar', () => {
  const p = partesModelos({ ...DATOS, claves: CLAVES })['clave-anthropic']
  assert.match(p, /<span class="est">Guardada <span class="mask"><span aria-hidden="true">••••a1B2<\/span><span class="oculto">termina en a1B2<\/span><\/span><\/span>/)
  assert.match(p, /class="lnk" data-accion="cfg-clave-probar" data-valor="anthropic" data-k="p-anthropic">Probar</)
  assert.match(p, /class="lnk" data-accion="cfg-clave-agregar" data-valor="anthropic" data-k="r-anthropic">Reemplazar</)
  assert.match(p, /class="lnk peligro" data-accion="cfg-clave-borrar" data-valor="anthropic" data-k="b-anthropic">Borrar</)
})

test('Clave: probando apaga Probar, rechazada en rojo, otra respuesta con su código en el title; armado confirma', () => {
  const fila = (t, extra = {}) => partesModelos({ ...DATOS, ...extra, claves: { ...CLAVES, anthropic: t } })['clave-anthropic']
  const probando = fila(textoClave('anthropic', { lectura: LEIDA, prueba: { estado: 'probando' } }))
  assert.match(probando, /class="pill t-proc"><i class="pt" aria-hidden="true"><\/i><span>Probando con Anthropic…/)
  assert.match(probando, /data-accion="cfg-clave-probar"[^>]*aria-disabled="true" title="Probando…">Probar/)
  assert.match(fila(textoClave('anthropic', { lectura: LEIDA, prueba: { estado: 'rechazada' } })), /<span class="est mal">× Anthropic la rechazó /)
  assert.match(fila(textoClave('anthropic', { lectura: LEIDA, prueba: { estado: 'valida' } })), /<span class="est ok">✓ Válida · probada recién /)
  assert.match(fila(textoClave('anthropic', { lectura: LEIDA, prueba: { estado: 'otro', codigo: 500 } })), /<span class="est aviso" title="Anthropic respondió 500">No se pudo probar /)
  const armado = fila(textoClave('anthropic', { lectura: LEIDA, armado: true }), { transcurrido: 900 })
  assert.match(armado, /class="armado" data-accion="cfg-clave-borrar" data-valor="anthropic" data-k="b-anthropic"[^>]*--ya:-900ms[^>]*>¿Borrar la clave\? Sí</)
  // Un borrado que falló lo dice debajo de su fila
  assert.match(fila(textoClave('anthropic', { lectura: LEIDA }), { error: 'clave:anthropic' }), /No se pudo borrar\. Probá de nuevo\./)
  assert.doesNotMatch(fila(textoClave('anthropic', { lectura: LEIDA }), { error: 'clave:openai' }), /No se pudo borrar/)
  // Recién guardada, la fila se baña de verde una vez
  assert.match(fila(textoClave('anthropic', { lectura: LEIDA }), { recien: 'anthropic' }), /<div class="cl recien">/)
})

test('Clave editando: campo de contraseña sin valor, label oculto, ayuda descrita y "Mostrar"', () => {
  const p = partesModelos({ ...DATOS, claves: { ...CLAVES, anthropic: textoClave('anthropic', { lectura: LEIDA, editando: true }) } })['clave-anthropic']
  assert.match(p, /<label class="oculto" for="cfg-clave-in">Clave de API de Claude<\/label>/)
  assert.match(p, /<input id="cfg-clave-in" type="password" autocomplete="off" spellcheck="false" autocapitalize="off" placeholder="sk-ant-…" data-k="clave-in" data-valor="anthropic" aria-invalid="false" aria-describedby="cfg-clave-ayuda">/)
  // Nunca un value: el texto vive solo en el campo (4.6)
  assert.doesNotMatch(p, /value=/)
  assert.match(p, /data-accion="cfg-clave-ver" data-valor="anthropic" aria-pressed="false" data-k="clave-ver">Mostrar</)
  assert.match(p, /<p class="cl-ayuda" id="cfg-clave-ayuda">Va al Administrador de credenciales de Windows\. Después solo vas a ver el final\.<\/p>/)
  assert.match(p, /class="btn" data-accion="cfg-clave-guardar" data-valor="anthropic" data-k="clave-guardar">Guardar</)
  assert.match(p, /class="btn sec" data-accion="cfg-clave-cancelar" data-valor="anthropic" data-k="clave-cancelar">Cancelar</)
  assert.doesNotMatch(p, /class="mask"/)
})

test('Clave editando: con error, rojo e inválida; con prefijo raro, ámbar y "Guardar igual"; "Ocultar" a la vista', () => {
  const ed = extra => partesModelos({ ...DATOS, claves: { ...CLAVES, gemini: textoClave('gemini', { lectura: { guardada: false }, editando: true, ...extra }) } })['clave-gemini']
  const corta = ed({ error: 'corta' })
  assert.match(corta, /<div class="campo mal">/)
  assert.match(corta, /aria-invalid="true"/)
  assert.match(corta, /<p class="cl-ayuda mal" id="cfg-clave-ayuda">Es muy corta para ser una clave\.<\/p>/)
  const prefijo = ed({ error: 'prefijo' })
  assert.match(prefijo, /<p class="cl-ayuda aviso" id="cfg-clave-ayuda">No parece una clave de Google \(suelen empezar con AIza\)\. Guardala igual si estás seguro\.<\/p>/)
  assert.match(prefijo, />Guardar igual</)
  assert.match(prefijo, /aria-invalid="false"/)
  const ver = ed({ ver: true })
  assert.match(ver, /<input id="cfg-clave-in" type="text"/)
  assert.match(ver, /aria-pressed="true" data-k="clave-ver">Ocultar</)
})
