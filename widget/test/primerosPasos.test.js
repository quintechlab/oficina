// Tests del asistente "Primeros pasos" (#10, docs/diseno/bienvenida-ux.md): de la revisión y de lo
// que corre al estado de cada paso, el paso que toca, los botones con su tipo y su motivo, lo que
// falta, dónde vive, el aviso, la muesca, los anuncios y la regla firme (10). Funciones puras.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PASOS, modeloAsistente, formaAsistente, pendienteAviso, nombreMuesca, alEmpezar, alEvento, trasRevision,
  anuncioCambio, retieneAbierta, fijaAlSoltar, navegar, visibleInicial, deletrear, MS_CODIGO, pasoDeAccion,
} from '../src/primerosPasos.js'

const AHORA = Date.parse('2026-11-20T12:00:00Z')

/** Una revisión como la que devuelve `revisar_primeros_pasos` (primeros_pasos.rs). */
function revision({ claude = true, mod = 'activo', catalogo = true, gh = true, winget = true, cuenta = 'conectada', faltan = [], membresia = 'activa', login = 'nicoequintana' } = {}) {
  return {
    claude: { encontrado: claude, version: claude ? '2.1.329' : null },
    mod: { instalado: mod !== 'ausente', activo: mod === 'activo', version: mod === 'ausente' ? null : '0.6.0', catalogo, error: null },
    gh: { instalado: gh, version: gh ? '2.103.3' : null, winget },
    cuenta: { estado: gh ? cuenta : 'sin-gh', login: cuenta === 'sin-sesion' ? null : login, faltan, error: cuenta === 'sin-conexion' ? 'dial tcp: lookup api.github.com: no such host' : null, comando: 'gh auth status --hostname github.com --active --json hosts' },
    membresia: gh && cuenta === 'conectada' && !faltan.length ? { estado: membresia, error: membresia === 'sin-conexion' ? 'dial tcp: i/o timeout' : null, comando: 'gh api user/memberships/orgs/quintechlab' } : null,
  }
}
const SIN_EJEC = { claude: null, mod: null, gh: null }
const modelo = (r, extra = {}) => modeloAsistente({ revision: r, revisando: false, ejec: SIN_EJEC, ...extra })
const accion = (paso, texto) => paso.acciones.find(a => a.texto === texto)

// ------------------------------------------------------------------ los tres pasos (3.1)

test('los tres pasos, en orden, con su número y su nombre corto', () => {
  assert.deepEqual(PASOS.map(p => [p.id, p.n, p.nombre, p.corto]), [
    ['claude', 1, 'Claude Code', 'Claude'], ['mod', 2, 'Mod de Avis', 'Mod'], ['gh', 3, 'GitHub', 'GitHub'],
  ])
})

test('una máquina lista: los tres hechos, no falta nada y no hay paso que toque', () => {
  const m = modelo(revision())
  assert.deepEqual(m.orden.map(id => m.pasos[id].estado), ['hecho', 'hecho', 'hecho'])
  assert.equal(m.faltan, 0)
  assert.equal(m.actual, null)
  assert.equal(m.todoListo, true)
  assert.equal(m.listos, 3)
  assert.equal(m.pasos.claude.texto, 'Claude Code 2.1.329 en este equipo.')
  assert.equal(m.pasos.mod.texto, 'Ya estaba instalado · oficina 0.6.0.')
  assert.deepEqual(m.pasos.gh.extra, { tipo: 'cuenta', login: 'nicoequintana', miembro: true })
  for (const id of m.orden) assert.equal(m.pasos[id].pose, 'listo')
})

test('sin Claude Code: el paso 1 toca, saluda y ofrece la guía y volver a buscar; el mod espera el paso 1', () => {
  const m = modelo(revision({ claude: false, mod: 'ausente' }))
  const c = m.pasos.claude
  assert.equal(c.estado, 'noEncontrado')
  assert.equal(c.pose, 'saluda')
  assert.equal(c.chip, 'no encontrado')
  assert.equal(c.titulo, 'Primero, Claude Code')
  assert.equal(c.texto, 'No lo encontramos en este equipo. Avis no puede instalarlo por vos: seguí la guía oficial y volvé acá.')
  assert.deepEqual(c.acciones.map(a => [a.tipo, a.texto, a.accion, a.valor, !!a.externo]), [
    ['pri', 'Ver cómo instalarlo', 'abrir', 'guia-claude', true], ['sec', 'Volver a buscar', 'revisar', undefined, false],
  ])
  const mod = m.pasos.mod
  assert.equal(mod.estado, 'bloqueado')
  assert.equal(mod.pose, 'esperando')
  assert.equal(mod.chip, 'espera el paso 1')
  assert.deepEqual(mod.acciones, [{ tipo: 'sec', texto: 'Instalar en Claude Code', accion: 'correr', valor: 'mod', deshabilitada: true, motivo: 'Falta el paso 1: Claude Code.' }])
  assert.equal(m.actual, 'claude')
  assert.equal(m.faltan, 2)
})

test('el mod sin instalar: muestra los comandos que va a correr antes del clic', () => {
  const m = modelo(revision({ mod: 'ausente', catalogo: false }))
  const p = m.pasos.mod
  assert.equal(p.estado, 'pendiente')
  assert.equal(p.pose, 'saluda')
  assert.equal(p.chip, 'sin instalar')
  assert.equal(p.titulo, 'Sumá Avis a Claude Code')
  assert.deepEqual(p.extra, { tipo: 'comandos', lineas: ['claude plugin marketplace add quintechlab/oficina', 'claude plugin install oficina@quintech'] })
  assert.deepEqual(p.acciones.map(a => [a.tipo, a.texto, a.accion, a.valor]), [['pri', 'Instalar en Claude Code', 'correr', 'mod']])
  assert.equal(m.actual, 'mod')
  // Con el catálogo ya sumado solo corre la instalación
  assert.deepEqual(modelo(revision({ mod: 'ausente', catalogo: true })).pasos.mod.extra.lineas, ['claude plugin install oficina@quintech'])
})

test('el mod apagado: duerme y ofrece activarlo', () => {
  const p = modelo(revision({ mod: 'apagado' })).pasos.mod
  assert.equal(p.estado, 'apagado')
  assert.equal(p.pose, 'durmiendo')
  assert.equal(p.chip, 'apagado')
  assert.deepEqual(p.acciones.map(a => [a.tipo, a.texto, a.valor]), [['pri', 'Activar en Claude Code', 'activar']])
})

test('sin gh: instalarlo con la licencia a la vista y conectar deshabilitado con su motivo', () => {
  const p = modelo(revision({ gh: false })).pasos.gh
  assert.equal(p.estado, 'faltaGh')
  assert.equal(p.pose, 'saluda')
  assert.equal(p.chip, 'falta gh')
  assert.equal(p.nota, 'Al instalar aceptás la licencia de GitHub CLI y las condiciones de winget.')
  assert.deepEqual(p.acciones.map(a => [a.tipo, a.texto, !!a.deshabilitada, a.motivo ?? '']), [
    ['pri', 'Instalar GitHub CLI', false, ''], ['sec', 'Conectar con GitHub', true, 'Primero instalá GitHub CLI.'],
  ])
})

test('sin gh ni winget: abrir la página de GitHub CLI', () => {
  const p = modelo(revision({ gh: false, winget: false })).pasos.gh
  assert.equal(p.estado, 'faltaWinget')
  assert.equal(p.pose, 'esperando')
  assert.deepEqual(p.acciones.map(a => [a.tipo, a.texto, a.accion, a.valor]), [['pri', 'Abrir cli.github.com', 'abrir', 'gh-manual'], ['sec', 'Volver a buscar', 'revisar', undefined]])
})

test('gh sin sesión: conectar abre el navegador y dice los permisos que pide', () => {
  const p = modelo(revision({ cuenta: 'sin-sesion' })).pasos.gh
  assert.equal(p.estado, 'sinConectar')
  assert.equal(p.texto, 'GitHub CLI ya está. Se abre el navegador para que entres con tu cuenta y autorices el acceso.')
  assert.equal(p.nota, 'Pide permisos de repo, read:org y project.')
  assert.deepEqual(p.acciones.map(a => [a.tipo, a.texto, a.valor, a.externo]), [['pri', 'Conectar con GitHub', 'conectar', true]])
})

test('falta un permiso, no es miembro, invitación pendiente y sin conexión', () => {
  const permiso = modelo(revision({ faltan: ['project'] })).pasos.gh
  assert.equal(permiso.estado, 'faltaPermiso')
  assert.equal(permiso.texto, 'Tu cuenta @nicoequintana está conectada, pero sin el permiso project, que el tablero necesita.')
  assert.deepEqual(permiso.acciones.map(a => [a.texto, a.valor]), [['Sumar el permiso', 'permiso']])
  const dos = modelo(revision({ faltan: ['repo', 'project'] })).pasos.gh
  assert.equal(dos.texto, 'Tu cuenta @nicoequintana está conectada, pero sin los permisos repo y project, que el tablero necesita.')

  const no = modelo(revision({ membresia: 'no-miembro' })).pasos.gh
  assert.equal(no.estado, 'noMiembro')
  assert.equal(no.pose, 'fallo')
  assert.equal(no.glifo, '!')
  assert.equal(no.titulo, 'Tu cuenta no es parte de quintechlab')
  assert.equal(no.extra.tipo, 'arreglo')
  assert.equal(no.extra.pasos.length, 3)
  assert.deepEqual(no.acciones.map(a => [a.tipo, a.texto, a.accion]), [['pri', 'Volver a revisar', 'revisar'], ['sec', 'Copiar mi usuario', 'copiar']])
  assert.equal(accion(no, 'Copiar mi usuario').valor, 'nicoequintana')
  assert.deepEqual(no.enlaces.map(e => [e.texto, e.accion, e.valor]), [['Conectar otra cuenta', 'correr', 'conectar']])

  const inv = modelo(revision({ membresia: 'pendiente' })).pasos.gh
  assert.equal(inv.estado, 'invitacion')
  assert.deepEqual(inv.acciones.map(a => [a.texto, a.accion, a.valor]), [['Aceptar en GitHub', 'abrir', 'invitacion'], ['Volver a revisar', 'revisar', undefined]])

  const red = modelo(revision({ cuenta: 'sin-conexion' })).pasos.gh
  assert.equal(red.estado, 'sinConexion')
  assert.equal(red.chip, 'sin conexión')
  assert.deepEqual(red.extra, { tipo: 'error', comando: 'gh auth status --hostname github.com --active --json hosts', linea: 'dial tcp: lookup api.github.com: no such host' })
  assert.deepEqual(red.acciones.map(a => [a.tipo, a.texto, a.accion]), [['pri', 'Reintentar', 'revisar'], ['sec', 'Copiar detalle', 'copiar']])
  assert.equal(modelo(revision({ membresia: 'sin-conexion' })).pasos.gh.estado, 'sinConexion')
})

// ------------------------------------------------------------------ el paso que toca y los botones (3.1)

test('solo el paso que toca lleva el botón ámbar: el de otro paso baja a secundario', () => {
  const m = modelo(revision({ mod: 'ausente', gh: false }))
  assert.equal(m.actual, 'mod')
  assert.equal(accion(m.pasos.mod, 'Instalar en Claude Code').tipo, 'pri')
  assert.equal(accion(m.pasos.gh, 'Instalar GitHub CLI').tipo, 'sec')
  // En toda la pantalla hay a lo sumo un primario ámbar
  const primarios = m.orden.flatMap(id => m.pasos[id].acciones).filter(a => a.tipo === 'pri')
  assert.equal(primarios.length, 1)
})

test('mientras un paso corre, las acciones de los otros quedan deshabilitadas con su motivo', () => {
  const ejec = alEmpezar(SIN_EJEC, 'mod')
  const m = modelo(revision({ mod: 'ausente', gh: false }), { ejec })
  assert.equal(m.corriendo, 'mod')
  assert.equal(m.pasos.mod.estado, 'trabajando')
  assert.deepEqual(m.pasos.mod.acciones, [])
  for (const a of m.pasos.gh.acciones) {
    assert.equal(a.deshabilitada, true)
    assert.equal(a.motivo, 'Esperá a que termine el paso 2.')
  }
  // "Conectar otra cuenta" también actúa: se deshabilita; abrir el navegador no
  const r = revision({ membresia: 'no-miembro', mod: 'ausente' })
  const m2 = modelo(r, { ejec })
  assert.deepEqual(m2.pasos.gh.enlaces.map(e => !!e.deshabilitada), [true])
})

test('revisando: el paso muestra la revisión y sus acciones quedan deshabilitadas', () => {
  const primera = modeloAsistente({ revision: null, revisando: true, ejec: SIN_EJEC })
  assert.equal(primera.pasos.claude.estado, 'revisando')
  assert.equal(primera.pasos.claude.pose, 'leyendo')
  assert.equal(primera.pasos.claude.titulo, 'Revisando este equipo…')
  assert.equal(primera.pasos.claude.texto, 'Solo miramos qué hay instalado. No se instala nada.')
  assert.deepEqual(primera.pasos.claude.acciones, [])
  assert.equal(primera.faltan, null)
  // Otra vez ("Volver a buscar"): las acciones de antes, deshabilitadas con "Revisando…"
  const otra = modeloAsistente({ revision: revision({ claude: false }), revisando: true, ejec: SIN_EJEC })
  assert.equal(otra.pasos.claude.estado, 'revisando')
  assert.deepEqual(otra.pasos.claude.acciones.map(a => [a.texto, a.deshabilitada, a.motivo]), [
    ['Ver cómo instalarlo', true, 'Revisando…'], ['Volver a buscar', true, 'Revisando…'],
  ])
  assert.equal(otra.faltan, 2)
})

test('el paso que toca: el que corre, falla o espera el código; si no, el primero sin hacer', () => {
  const r = revision({ mod: 'ausente', cuenta: 'sin-sesion' })
  assert.equal(modelo(r).actual, 'mod')
  let ejec = alEmpezar(SIN_EJEC, 'conectar')
  ejec = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'codigo', codigo: '4F2A-91C7' }, AHORA)
  assert.equal(modelo(r, { ejec }).actual, 'gh')
  const conError = alEvento(alEmpezar(SIN_EJEC, 'gh'), { accion: 'gh', paso: 'gh', estado: 'error', comando: 'winget install --id GitHub.cli -e', linea: 'x', detalle: 'x', red: false, permiso: false }, AHORA)
  assert.equal(modelo(revision({ mod: 'ausente', gh: false }), { ejec: conError }).actual, 'gh')
})

test('glifos de las pestañas: número, ✓, «!» o punto ámbar; el color nunca va solo (chip con texto)', () => {
  const m = modelo(revision({ mod: 'ausente', membresia: 'no-miembro' }))
  assert.equal(m.pasos.claude.glifo, 'hecho')
  assert.equal(m.pasos.mod.glifo, 2)
  assert.equal(m.pasos.gh.glifo, '!')
  const corre = modelo(revision({ mod: 'ausente' }), { ejec: alEmpezar(SIN_EJEC, 'mod') })
  assert.equal(corre.pasos.mod.glifo, 'punto')
  for (const id of m.orden) assert.ok(m.pasos[id].chip)
  assert.equal(m.pasos.gh.etiqueta, 'Paso 3, GitHub: sin acceso')
})

// ------------------------------------------------------------------ lo que corre (9.5)

test('instalar el mod: registro de comandos, error con su línea y reintento', () => {
  let ejec = alEmpezar(SIN_EJEC, 'mod')
  ejec = alEvento(ejec, { accion: 'mod', paso: 'mod', estado: 'comando', comando: 'claude plugin marketplace add quintechlab/oficina' }, AHORA)
  ejec = alEvento(ejec, { accion: 'mod', paso: 'mod', estado: 'comando-hecho', comando: 'claude plugin marketplace add quintechlab/oficina' }, AHORA)
  ejec = alEvento(ejec, { accion: 'mod', paso: 'mod', estado: 'comando', comando: 'claude plugin install oficina@quintech' }, AHORA)
  const r = revision({ mod: 'ausente', catalogo: false })
  const trabajando = modelo(r, { ejec }).pasos.mod
  assert.equal(trabajando.pose, 'escribiendo')
  assert.equal(trabajando.chip, 'instalando')
  assert.deepEqual(trabajando.extra, { tipo: 'registro', lineas: [{ comando: 'claude plugin marketplace add quintechlab/oficina', hecho: true }, { comando: 'claude plugin install oficina@quintech', hecho: false }] })

  const red = alEvento(ejec, { accion: 'mod', paso: 'mod', estado: 'error', comando: 'claude plugin install oficina@quintech', linea: 'getaddrinfo ENOTFOUND github.com', detalle: 'getaddrinfo ENOTFOUND github.com\nmás', red: true, permiso: false }, AHORA)
  const error = modelo(r, { ejec: red }).pasos.mod
  assert.equal(error.estado, 'error')
  assert.equal(error.pose, 'fallo')
  assert.equal(error.titulo, 'No se pudo instalar el mod')
  assert.equal(error.texto, 'Revisá tu conexión y probá de nuevo.')
  assert.deepEqual(error.extra, { tipo: 'error', comando: 'claude plugin install oficina@quintech', linea: 'getaddrinfo ENOTFOUND github.com' })
  assert.deepEqual(error.acciones.map(a => [a.tipo, a.texto, a.accion, a.valor]), [
    ['pri', 'Reintentar', 'correr', 'mod'], ['sec', 'Copiar detalle', 'copiar', 'claude plugin install oficina@quintech\ngetaddrinfo ENOTFOUND github.com\nmás'],
  ])
  const otro = alEvento(ejec, { accion: 'mod', paso: 'mod', estado: 'error', comando: 'c', linea: 'x', detalle: 'x', red: false, permiso: false }, AHORA)
  assert.equal(modelo(r, { ejec: otro }).pasos.mod.texto, 'Claude Code devolvió un error.')
})

test('después de instalar, la verificación de solo lectura decide y el texto dice que quedó instalado', () => {
  let ejec = alEvento(alEmpezar(SIN_EJEC, 'mod'), { accion: 'mod', paso: 'mod', estado: 'listo' }, AHORA)
  assert.equal(ejec.mod.fase, 'verificando')
  // Mientras verifica sigue "instalando"
  assert.equal(modelo(revision({ mod: 'ausente' }), { ejec }).pasos.mod.estado, 'trabajando')
  ejec = trasRevision(ejec, revision())
  const p = modelo(revision(), { ejec }).pasos.mod
  assert.equal(p.estado, 'hecho')
  assert.equal(p.titulo, 'El mod quedó instalado')
  assert.equal(p.texto, 'oficina 0.6.0 · para tu usuario.')
})

test('después de prender el mod apagado, el texto dice que quedó prendido, no instalado', () => {
  let ejec = alEvento(alEmpezar(SIN_EJEC, 'activar'), { accion: 'activar', paso: 'mod', estado: 'listo' }, AHORA)
  ejec = trasRevision(ejec, revision())
  const p = modelo(revision(), { ejec }).pasos.mod
  assert.equal(p.estado, 'hecho')
  assert.equal(p.titulo, 'El mod quedó prendido')
  assert.equal(p.texto, 'oficina 0.6.0 · prendido en Claude Code.')
})

test('un error se queda hasta reintentar, salvo que la revisión muestre el paso hecho', () => {
  const ejec = alEvento(alEmpezar(SIN_EJEC, 'gh'), { accion: 'gh', paso: 'gh', estado: 'error', comando: 'winget install --id GitHub.cli -e', linea: 'Installer failed with exit code: 0x800704c7', detalle: '', red: false, permiso: true }, AHORA)
  const sigue = trasRevision(ejec, revision({ gh: false }))
  const p = modelo(revision({ gh: false }), { ejec: sigue }).pasos.gh
  assert.equal(p.estado, 'errorGh')
  assert.equal(p.texto, 'Windows no dio permiso para instalar.')
  assert.deepEqual(p.enlaces.map(e => [e.texto, e.valor, e.externo]), [['Instalarlo a mano', 'gh-manual', true]])
  // winget falló pero gh quedó instalado: manda gh --version
  const resuelto = trasRevision(ejec, revision({ cuenta: 'sin-sesion' }))
  assert.equal(resuelto.gh, null)
  assert.equal(modelo(revision({ cuenta: 'sin-sesion' }), { ejec: resuelto }).pasos.gh.estado, 'sinConectar')
})

test('conectar: pidiendo, código con su vencimiento, verificando, vencido y cancelado', () => {
  const r = revision({ cuenta: 'sin-sesion' })
  let ejec = alEmpezar(SIN_EJEC, 'conectar')
  const pidiendo = modelo(r, { ejec }).pasos.gh
  assert.equal(pidiendo.estado, 'pidiendo')
  assert.equal(pidiendo.titulo, 'Pidiendo un código a GitHub…')
  assert.deepEqual(pidiendo.acciones.map(a => [a.tipo, a.texto, a.accion]), [['sec', 'Cancelar', 'cancelar']])

  ejec = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'codigo', codigo: '4F2A-91C7' }, AHORA)
  const codigo = modelo(r, { ejec }).pasos.gh
  assert.equal(codigo.estado, 'codigo')
  assert.equal(codigo.pose, 'esperando')
  assert.equal(codigo.chip, 'esperándote')
  assert.equal(codigo.glifo, 'punto')
  assert.deepEqual(codigo.extra, { tipo: 'codigo', codigo: '4F2A-91C7', vence: AHORA + MS_CODIGO })
  assert.deepEqual(codigo.enlaces.map(e => [e.texto, e.accion, e.valor, e.externo]), [['¿No se abrió? Abrir github.com/login/device', 'abrir', 'dispositivo', true]])
  assert.deepEqual(codigo.acciones.map(a => a.texto), ['Cancelar'])

  const verificando = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'listo' }, AHORA)
  assert.equal(modelo(r, { ejec: verificando, revisando: true }).pasos.gh.estado, 'verificando')
  assert.equal(modelo(r, { ejec: verificando, revisando: true }).pasos.gh.pose, 'leyendo')

  const vencido = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'vencido' }, AHORA)
  const v = modelo(r, { ejec: vencido }).pasos.gh
  assert.equal(v.estado, 'vencido')
  assert.equal(v.pose, 'durmiendo')
  assert.deepEqual(v.acciones.map(a => [a.tipo, a.texto, a.valor]), [['pri', 'Pedir otro código', 'conectar']])

  const cancelado = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'cancelado' }, AHORA)
  assert.equal(cancelado.gh, null)
  assert.equal(modelo(r, { ejec: cancelado }).pasos.gh.estado, 'sinConectar')
})

test('sumar el permiso usa el mismo código; un error al conectar ofrece reintentar', () => {
  const r = revision({ faltan: ['project'] })
  let ejec = alEvento(alEmpezar(SIN_EJEC, 'permiso'), { accion: 'permiso', paso: 'gh', estado: 'codigo', codigo: 'ABCD-1234' }, AHORA)
  assert.equal(modelo(r, { ejec }).pasos.gh.estado, 'codigo')
  ejec = alEvento(ejec, { accion: 'permiso', paso: 'gh', estado: 'error', comando: 'gh auth refresh', linea: 'HTTP 500', detalle: 'HTTP 500', red: false, permiso: false }, AHORA)
  const p = modelo(r, { ejec }).pasos.gh
  assert.equal(p.estado, 'errorConectar')
  assert.equal(p.texto, 'GitHub CLI devolvió un error.')
  assert.deepEqual(p.acciones.map(a => [a.tipo, a.texto, a.valor]), [['pri', 'Reintentar', 'permiso'], ['sec', 'Copiar detalle', 'gh auth refresh\nHTTP 500']])
})

test('pasoDeAccion: cada acción es de su paso', () => {
  assert.deepEqual(['mod', 'activar', 'gh', 'conectar', 'permiso', 'otra'].map(pasoDeAccion), ['mod', 'mod', 'gh', 'gh', 'gh', null])
})

// ------------------------------------------------------------------ dónde vive (3.2)

test('sin tablero y con algo pendiente, el escenario reemplaza al vacío; cerrado, vuelve el vacío', () => {
  const base = { hayTablero: false, cargando: false, abierto: false, cerrado: false, faltan: 2 }
  assert.equal(formaAsistente(base), 'escenario')
  assert.equal(formaAsistente({ ...base, cerrado: true }), null)
  // Todo hecho: el vacío de siempre, salvo que se abra desde la bandeja
  assert.equal(formaAsistente({ ...base, faltan: 0 }), null)
  assert.equal(formaAsistente({ ...base, faltan: 0, abierto: true }), 'escenario')
  // Antes de la primera revisión o de la primera lectura no aparece solo
  assert.equal(formaAsistente({ ...base, faltan: null }), null)
  assert.equal(formaAsistente({ ...base, cargando: true }), null)
})

test('con tablero, la hoja solo se abre a pedido ("Ver →" o la bandeja)', () => {
  const base = { hayTablero: true, cargando: false, abierto: false, cerrado: false, faltan: 2 }
  assert.equal(formaAsistente(base), null)
  assert.equal(formaAsistente({ ...base, abierto: true }), 'hoja')
})

test('aviso del tablero según el primer paso pendiente', () => {
  assert.equal(pendienteAviso(modelo(revision({ claude: false, mod: 'ausente' }))), 'instalar Claude Code')
  assert.equal(pendienteAviso(modelo(revision({ mod: 'apagado' }))), 'instalar el mod')
  assert.equal(pendienteAviso(modelo(revision({ gh: false }))), 'conectar GitHub')
  assert.equal(pendienteAviso(modelo(revision({ cuenta: 'sin-sesion' }))), 'conectar GitHub')
  assert.equal(pendienteAviso(modelo(revision({ faltan: ['project'] }))), 'conectar GitHub')
  assert.equal(pendienteAviso(modelo(revision({ membresia: 'no-miembro' }))), 'entrar a quintechlab')
  assert.equal(pendienteAviso(modelo(revision({ membresia: 'pendiente' }))), 'entrar a quintechlab')
  assert.equal(pendienteAviso(modelo(revision())), null)
  assert.equal(pendienteAviso(modeloAsistente({ revision: null, revisando: true, ejec: SIN_EJEC })), null)
})

test('la muesca no golpea: solo su nombre suma lo que falta', () => {
  assert.equal(nombreMuesca('Avis: 4 sesiones abiertas. Abrir', 1), 'Avis: 4 sesiones abiertas. Falta 1 paso de configuración. Abrir')
  assert.equal(nombreMuesca('Avis: sin sesiones abiertas. Abrir', 3), 'Avis: sin sesiones abiertas. Faltan 3 pasos de configuración. Abrir')
  // Sin nada pendiente (o sin revisar) el nombre de siempre
  assert.equal(nombreMuesca('Avis: 4 sesiones abiertas. Abrir', 0), 'Avis: 4 sesiones abiertas. Abrir')
  assert.equal(nombreMuesca('Avis: 4 sesiones abiertas. Abrir', null), 'Avis: 4 sesiones abiertas. Abrir')
})

test('acoplada, el panel no se pliega solo mientras se pide el código, se muestra o se verifica', () => {
  const r = revision({ cuenta: 'sin-sesion' })
  let ejec = alEmpezar(SIN_EJEC, 'conectar')
  assert.equal(retieneAbierta(modelo(r, { ejec })), true)
  ejec = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'codigo', codigo: 'ABCD-1234' }, AHORA)
  assert.equal(retieneAbierta(modelo(r, { ejec })), true)
  assert.equal(retieneAbierta(modelo(r, { ejec: alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'listo' }, AHORA), revisando: true })), true)
  assert.equal(retieneAbierta(modelo(r)), false)
  assert.equal(retieneAbierta(modelo(revision({ mod: 'ausente' }), { ejec: alEmpezar(SIN_EJEC, 'mod') })), false)
})

test('al terminar la fase del código, "Mantener abierta" vuelve a como estaba solo si el usuario no la tocó', () => {
  // No la tocó: vuelve a la marca de antes (apagada), aunque la retención la haya prendido
  assert.equal(fijaAlSoltar({ antes: false, actual: true, tocada: false }), false)
  // La prendió a mano durante la fase (por ejemplo, la apagó y la volvió a prender): queda prendida
  assert.equal(fijaAlSoltar({ antes: false, actual: true, tocada: true }), true)
  // La apagó a mano (o cerró con Esc): queda apagada
  assert.equal(fijaAlSoltar({ antes: false, actual: false, tocada: true }), false)
})

test('un "listo" que llega aunque se haya tocado Cancelar se verifica como cualquier éxito', () => {
  const r = revision({ cuenta: 'sin-sesion' })
  let ejec = alEmpezar(SIN_EJEC, 'conectar')
  ejec = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'codigo', codigo: 'ABCD-1234' }, AHORA)
  // Cancelar no cambia la ventana: decide lo que le pasó al proceso (primeros_pasos.rs, `desenlace`)
  const listo = alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'listo' }, AHORA)
  assert.equal(listo.gh.fase, 'verificando')
  assert.equal(retieneAbierta(modelo(r, { ejec: listo, revisando: true })), true)
  // "cancelado" solo llega si Cancelar terminó el proceso: el paso vuelve a su estado
  assert.equal(alEvento(ejec, { accion: 'conectar', paso: 'gh', estado: 'cancelado' }, AHORA).gh, null)
})

// ------------------------------------------------------------------ navegación (3.4) y regla firme (10)

test('al abrir se ve el paso que toca; todo hecho, la escena final', () => {
  assert.equal(visibleInicial(modelo(revision({ mod: 'ausente' }))), 'mod')
  assert.equal(visibleInicial(modelo(revision())), 'listo')
  assert.equal(visibleInicial(modeloAsistente({ revision: null, revisando: true, ejec: SIN_EJEC })), 'claude')
  // Al reabrir se revisa otra vez: se ve lo que tocaba según la revisión anterior, no el paso 1
  assert.equal(visibleInicial(modeloAsistente({ revision: revision({ membresia: 'no-miembro' }), revisando: true, ejec: SIN_EJEC })), 'gh')
  assert.equal(visibleInicial(modeloAsistente({ revision: revision(), revisando: true, ejec: SIN_EJEC })), 'listo')
})

test('Anterior y Siguiente solo cambian la vista; Siguiente solo con el paso visible hecho', () => {
  const m = modelo(revision({ mod: 'ausente' }))
  assert.equal(navegar(m, 'claude', 1), 'mod')
  assert.equal(navegar(m, 'mod', 1), null)
  assert.equal(navegar(m, 'mod', -1), 'claude')
  assert.equal(navegar(m, 'claude', -1), null)
  const listo = modelo(revision())
  assert.equal(navegar(listo, 'gh', 1), 'listo')
  assert.equal(navegar(listo, 'listo', -1), 'gh')
  assert.equal(navegar(listo, 'listo', 1), null)
  // Con algo pendiente, del paso 3 hecho no se pasa a la escena final
  assert.equal(navegar(modelo(revision({ mod: 'ausente' })), 'gh', 1), null)
})

test('regla firme: ninguna acción se elige sola ni corre sin su clic (sin temporizador ni acción por defecto)', () => {
  // Ningún estado trae una acción marcada como por defecto o con tiempo
  const estados = [
    revision({ claude: false }), revision({ mod: 'ausente' }), revision({ mod: 'apagado' }), revision({ gh: false }),
    revision({ gh: false, winget: false }), revision({ cuenta: 'sin-sesion' }), revision({ faltan: ['project'] }),
    revision({ membresia: 'no-miembro' }), revision({ membresia: 'pendiente' }), revision({ cuenta: 'sin-conexion' }),
  ]
  for (const r of estados) {
    const m = modelo(r)
    for (const id of m.orden) {
      for (const a of [...m.pasos[id].acciones, ...m.pasos[id].enlaces]) {
        assert.deepEqual(Object.keys(a).filter(k => ['porDefecto', 'foco', 'autofocus', 'tiempo', 'automatica'].includes(k)), [])
      }
    }
  }
  // Revisar no corre nada: sin ejecuciones, la revisión nunca deja un paso trabajando
  for (const r of estados) {
    const m = modelo(r)
    assert.equal(m.corriendo, null)
  }
})

// ------------------------------------------------------------------ anuncios (7.2)

test('un anuncio por cambio de estado, con los textos de la dirección', () => {
  const sin = modelo(revision({ mod: 'ausente' }))
  const instalando = modelo(revision({ mod: 'ausente' }), { ejec: alEmpezar(SIN_EJEC, 'mod') })
  assert.equal(anuncioCambio(sin, instalando), 'Instalando el mod de Avis')
  assert.equal(anuncioCambio(instalando, instalando), '')
  const hecho = modelo(revision(), { ejec: trasRevision(alEvento(alEmpezar(SIN_EJEC, 'mod'), { accion: 'mod', paso: 'mod', estado: 'listo' }, AHORA), revision()) })
  assert.equal(anuncioCambio(instalando, hecho), 'Mod instalado')
  const falla = modelo(revision({ mod: 'ausente' }), { ejec: alEvento(alEmpezar(SIN_EJEC, 'mod'), { accion: 'mod', paso: 'mod', estado: 'error', comando: 'c', linea: 'sin red', detalle: '', red: true, permiso: false }, AHORA) })
  assert.equal(anuncioCambio(instalando, falla), 'No se pudo instalar el mod: Revisá tu conexión y probá de nuevo.')
  const revisando = modeloAsistente({ revision: revision({ mod: 'ausente' }), revisando: true, ejec: SIN_EJEC })
  assert.equal(anuncioCambio(sin, revisando), 'Revisando este equipo')
  const r = revision({ cuenta: 'sin-sesion' })
  const pidiendo = modelo(r, { ejec: alEmpezar(SIN_EJEC, 'conectar') })
  const codigo = modelo(r, { ejec: alEvento(alEmpezar(SIN_EJEC, 'conectar'), { accion: 'conectar', paso: 'gh', estado: 'codigo', codigo: '4F2A-91C7' }, AHORA) })
  assert.equal(anuncioCambio(pidiendo, codigo), 'Código de GitHub listo: 4 F 2 A guion 9 1 C 7. Pegalo en el navegador')
  assert.equal(anuncioCambio(codigo, modelo(r)), 'Conexión cancelada')
  assert.equal(anuncioCambio(codigo, modelo(revision())), 'GitHub conectado como nicoequintana')
  assert.equal(anuncioCambio(codigo, modelo(revision({ membresia: 'no-miembro' }))), 'Tu cuenta no es miembro de quintechlab')
  assert.equal(anuncioCambio(modeloAsistente({ revision: null, revisando: true, ejec: SIN_EJEC }), modelo(revision({ mod: 'ausente' }))), 'Claude Code encontrado')
  assert.equal(anuncioCambio(null, sin), '')
})

test('el código se deletrea para el lector de pantalla', () => {
  assert.equal(deletrear('4F2A-91C7'), '4 F 2 A guion 9 1 C 7')
})
