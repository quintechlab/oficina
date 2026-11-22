// Tests del mod automático en la ventana (#17): el aviso "El mod está apagado" con "Prender", que
// corre solo con el clic; el aviso de una vez después de instalar o actualizar; y la instalación
// sola, que el asistente muestra como si se hubiera tocado su botón. El aviso de siempre ("Falta …
// · Ver →") no cambia para los demás pasos. Funciones puras.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modeloAsistente, modApagado, textoAvisoMod, alModAuto, alEmpezar } from '../src/primerosPasos.js'
import { avisoAsistente, avisoMod } from '../src/primerosPasosVista.js'

/** Una revisión como la que devuelve `revisar_primeros_pasos` (primeros_pasos.rs). */
function revision({ claude = true, mod = 'activo', gh = true } = {}) {
  return {
    claude: { encontrado: claude, version: claude ? '2.1.329' : null },
    mod: { instalado: mod !== 'ausente', activo: mod === 'activo', version: mod === 'ausente' ? null : '0.9.0', catalogo: true, error: null },
    gh: { instalado: gh, version: gh ? '2.103.3' : null, winget: true },
    cuenta: { estado: gh ? 'conectada' : 'sin-gh', login: 'nicoequintana', faltan: [], error: null, comando: 'gh auth status --hostname github.com --active --json hosts' },
    membresia: gh ? { estado: 'activa', error: null, comando: 'gh api user/memberships/orgs/quintechlab' } : null,
  }
}
const SIN_EJEC = { claude: null, mod: null, gh: null }
const modelo = r => modeloAsistente({ revision: r, revisando: false, ejec: SIN_EJEC })

// ------------------------------------------------------------------ apagado: "Prender" con un clic

test('el mod apagado: el tablero dice "El mod está apagado" con "Prender", que corre activar con el clic', () => {
  const m = modelo(revision({ mod: 'apagado' }))
  assert.equal(modApagado(m), true)
  const html = avisoAsistente(m)
  assert.match(html, /El mod está apagado/)
  assert.match(html, /<span class="ir">Prender<\/span>/)
  assert.match(html, /data-accion="pp-correr" data-valor="activar"/)
  assert.match(html, /aria-label="El mod está apagado\. Prender"/)
  // Mismo estilo y lugar que el aviso de siempre: la píldora del tablero
  assert.match(html, /^<button type="button" class="aviso pp-aviso"/)
  // Nunca se prende solo: sin foco, sin tiempo, sin acción por defecto
  assert.doesNotMatch(html, /autofocus|data-tiempo|data-defecto/)
})

test('apagado no gana a un paso anterior: sin Claude Code el aviso sigue siendo el de siempre', () => {
  const m = modelo(revision({ claude: false, mod: 'apagado' }))
  assert.equal(modApagado(m), false)
  assert.match(avisoAsistente(m), /data-accion="pp-ver"/)
})

test('el aviso de siempre no cambia: "Falta … · Ver →" para lo que falta, nada si está todo', () => {
  for (const [r, falta] of [
    [revision({ mod: 'ausente' }), 'instalar el mod'],
    [revision({ claude: false, mod: 'ausente' }), 'instalar Claude Code'],
    [revision({ gh: false }), 'conectar GitHub'],
  ]) {
    const m = modelo(r)
    assert.equal(modApagado(m), false)
    assert.equal(avisoAsistente(m).includes('data-accion="pp-ver"'), true)
    assert.equal(avisoAsistente(m).includes(`Falta <b>${falta}</b>`), true, falta)
    assert.equal(avisoAsistente(m).includes('<span class="ir">Ver →</span>'), true)
  }
  assert.equal(avisoAsistente(modelo(revision())), '')
  assert.equal(modApagado(modelo(revision())), false)
  // Antes de la primera revisión, ninguno
  assert.equal(avisoAsistente(modeloAsistente({ revision: null, revisando: true, ejec: SIN_EJEC })), '')
})

// ------------------------------------------------------------------ el aviso de una vez

test('después de instalar o actualizar, el texto dice la versión y cómo la toman las sesiones abiertas', () => {
  assert.equal(
    textoAvisoMod({ tipo: 'actualizo', version: '0.9.1', desde: '0.9.0' }),
    'Avis actualizó el mod a la 0.9.1: las sesiones abiertas la toman al reiniciarse o con /reload-plugins',
  )
  assert.equal(
    textoAvisoMod({ tipo: 'instalo', version: '0.9.1' }),
    'Avis instaló el mod 0.9.1: las sesiones abiertas lo toman al reiniciarse o con /reload-plugins',
  )
  // Lo que no se entiende no se muestra
  for (const malo of [null, undefined, {}, { tipo: 'otro', version: '1' }, { tipo: 'instalo' }, { tipo: 'instalo', version: 3 }]) {
    assert.equal(textoAvisoMod(malo), null)
  }
})

test('el aviso de una vez es la píldora del tablero y se cierra con su clic', () => {
  const html = avisoMod({ tipo: 'actualizo', version: '0.9.1', desde: '0.9.0' })
  assert.match(html, /^<button type="button" class="aviso pp-aviso" data-accion="pp-mod-visto"/)
  assert.match(html, /Avis actualizó el mod a la <b>0\.9\.1<\/b>: las sesiones abiertas la toman al reiniciarse o con \/reload-plugins/)
  assert.match(html, /aria-label="Avis actualizó el mod a la 0\.9\.1: las sesiones abiertas la toman al reiniciarse o con \/reload-plugins\. Entendido"/)
  assert.match(html, /<span class="ir">Entendido<\/span>/)
  assert.doesNotMatch(html, /autofocus/)
  // La versión se escapa
  assert.doesNotMatch(avisoMod({ tipo: 'instalo', version: '<b>x' }), /<b>x/)
  assert.equal(avisoMod(null), '')
  assert.equal(avisoMod({ tipo: 'raro', version: '1' }), '')
})

// ------------------------------------------------------------------ la instalación sola

test('la instalación sola aparece en el asistente como si se hubiera tocado "Instalar en Claude Code"', () => {
  const ejec = alModAuto(SIN_EJEC, { estado: 'empieza', accion: 'mod' })
  assert.deepEqual(ejec, alEmpezar(SIN_EJEC, 'mod'))
  assert.equal(modeloAsistente({ revision: revision({ mod: 'ausente' }), revisando: false, ejec }).pasos.mod.estado, 'trabajando')
  // Solo la instalación: actualizar no toca el asistente, ni un aviso, ni lo que no se entiende
  assert.equal(alModAuto(SIN_EJEC, { estado: 'empieza', accion: 'actualizar' }), SIN_EJEC)
  assert.equal(alModAuto(SIN_EJEC, { estado: 'empieza', accion: 'activar' }), SIN_EJEC)
  assert.equal(alModAuto(SIN_EJEC, { estado: 'aviso' }), SIN_EJEC)
  assert.equal(alModAuto(SIN_EJEC, null), SIN_EJEC)
})
