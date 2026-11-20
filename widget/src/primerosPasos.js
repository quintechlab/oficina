// Asistente "Primeros pasos" (#10, docs/diseno/bienvenida-ux.md): de la revisión de la máquina y
// de lo que corre al estado de cada paso, el paso que toca, los botones con su tipo y su motivo,
// los textos, lo que falta, dónde vive, el aviso del tablero, el nombre de la muesca y los anuncios.
// Lógica pura: la vista está en primerosPasosVista.js y lo que corre en
// src-tauri/src/primeros_pasos.rs. Regla firme (10): cada paso corre solo con un clic; nada de acá
// elige, corre ni avanza solo.

export const PASOS = [
  { id: 'claude', n: 1, nombre: 'Claude Code', corto: 'Claude' },
  { id: 'mod', n: 2, nombre: 'Mod de la Oficina', corto: 'Mod' },
  { id: 'gh', n: 3, nombre: 'GitHub', corto: 'GitHub' },
]
const ORDEN = PASOS.map(p => p.id)
export const ORGANIZACION = 'quintechlab'
/** El código de GitHub vence a los 15 minutos (supuesto, 9.5). */
export const MS_CODIGO = 15 * 60000

/** Las acciones que corren algo, y de qué paso son. */
const PASO_DE_ACCION = { mod: 'mod', activar: 'mod', gh: 'gh', conectar: 'gh', permiso: 'gh' }
export const pasoDeAccion = accion => PASO_DE_ACCION[accion] ?? null

/** Lo que se muestra en el registro mientras corre cada comando (9.2, sin los flags de máquina). */
const COMANDOS = {
  catalogo: 'claude plugin marketplace add quintechlab/oficina',
  instalar: 'claude plugin install oficina@quintech',
}

// ------------------------------------------------------------------ botones

/** Un botón: `pri` (ámbar), `sec` o deshabilitado con su motivo. Sin claves vacías. */
function boton(tipo, texto, accion, valor, { externo = false, deshabilitada = false, motivo } = {}) {
  const b = { tipo, texto, accion }
  if (valor !== undefined) b.valor = valor
  if (externo) b.externo = true
  if (deshabilitada) { b.deshabilitada = true; b.motivo = motivo }
  return b
}
const pri = (texto, accion, valor, o) => boton('pri', texto, accion, valor, o)
const sec = (texto, accion, valor, o) => boton('sec', texto, accion, valor, o)
const apagado = (texto, accion, valor, motivo) => boton('sec', texto, accion, valor, { deshabilitada: true, motivo })
const enlace = (texto, accion, valor, externo = false) => ({ texto, accion, valor, ...(externo ? { externo: true } : {}) })

// ------------------------------------------------------------------ estado de cada paso (4)

/** Estados que dibujan «!» en la pestaña, que corren (punto ámbar) y los que hacen que el paso toque. */
const GLIFO_ERROR = new Set(['error', 'errorGh', 'errorConectar', 'noMiembro'])
const CORRE = new Set(['trabajando', 'instalandoGh', 'pidiendo', 'verificando'])
const FALLA = new Set([...GLIFO_ERROR, 'sinConexion', 'vencido'])

/** El texto de un error, con el comando y su salida, para "Copiar detalle". */
const detalle = e => `${e.comando}\n${e.detalle || e.linea}`
const bloqueError = e => ({ tipo: 'error', comando: e.comando, linea: e.linea })

function estadoClaude(r) {
  if (r.claude?.encontrado) {
    return { estado: 'hecho', pose: 'listo', chip: 'listo', titulo: 'Claude Code está listo', texto: `Claude Code ${r.claude.version} en este equipo.` }
  }
  return {
    estado: 'noEncontrado', pose: 'saluda', chip: 'no encontrado', titulo: 'Primero, Claude Code',
    texto: 'No lo encontramos en este equipo. La Oficina no puede instalarlo por vos: seguí la guía oficial y volvé acá.',
    acciones: [pri('Ver cómo instalarlo', 'abrir', 'guia-claude', { externo: true }), sec('Volver a buscar', 'revisar')],
  }
}

function estadoMod(r, e) {
  if (!r.claude?.encontrado) {
    return {
      estado: 'bloqueado', pose: 'esperando', chip: 'espera el paso 1', titulo: 'Después, el mod de la Oficina',
      texto: 'Se instala adentro de Claude Code, así que primero hace falta el paso 1.',
      acciones: [apagado('Instalar en Claude Code', 'correr', 'mod', 'Falta el paso 1: Claude Code.')],
    }
  }
  if (e && (e.fase === 'corriendo' || e.fase === 'verificando')) {
    return {
      estado: 'trabajando', pose: 'escribiendo', chip: 'instalando', titulo: 'Instalando la Oficina en Claude Code',
      texto: 'Tarda unos segundos. Podés dejar la ventana abierta.', extra: { tipo: 'registro', lineas: e.lineas },
    }
  }
  if (e?.fase === 'error') {
    return {
      estado: 'error', pose: 'fallo', chip: 'falló', titulo: 'No se pudo instalar el mod',
      texto: e.error.red ? 'Revisá tu conexión y probá de nuevo.' : 'Claude Code devolvió un error.',
      extra: bloqueError(e.error), acciones: [pri('Reintentar', 'correr', e.accion), sec('Copiar detalle', 'copiar', detalle(e.error))],
    }
  }
  const m = r.mod ?? {}
  if (m.activo) {
    const ahora = e?.fase === 'hecho' && e.accion === 'mod'
    return {
      estado: 'hecho', pose: 'listo', chip: 'listo', titulo: 'El mod quedó instalado',
      texto: ahora ? `oficina ${m.version} · para tu usuario.` : `Ya estaba instalado · oficina ${m.version}.`,
    }
  }
  if (m.instalado) {
    return {
      estado: 'apagado', pose: 'durmiendo', chip: 'apagado', titulo: 'El mod está apagado',
      texto: 'Está instalado, pero desactivado en Claude Code.', acciones: [pri('Activar en Claude Code', 'correr', 'activar')],
    }
  }
  return {
    estado: 'pendiente', pose: 'saluda', chip: 'sin instalar', titulo: 'Sumá la Oficina a Claude Code',
    texto: 'Agrega el catálogo quintech y el mod oficina para tu usuario. Tarda unos segundos.',
    // Lo que se acepta se dice antes (10): los comandos que van a correr
    extra: { tipo: 'comandos', lineas: m.catalogo ? [COMANDOS.instalar] : [COMANDOS.catalogo, COMANDOS.instalar] },
    acciones: [pri('Instalar en Claude Code', 'correr', 'mod')],
  }
}

const lista = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`

function estadoGh(r, e) {
  const conecta = e && (e.accion === 'conectar' || e.accion === 'permiso')
  if ((e?.fase === 'corriendo' || e?.fase === 'verificando') && !conecta) {
    return {
      estado: 'instalandoGh', pose: 'escribiendo', chip: 'instalando', titulo: 'Instalando GitHub CLI',
      texto: 'Si Windows te pide permiso, aceptá en su ventana. Tarda menos de un minuto.', extra: { tipo: 'registro', lineas: e.lineas },
    }
  }
  if (e?.fase === 'corriendo') {
    return { estado: 'pidiendo', pose: 'escribiendo', chip: 'conectando', titulo: 'Pidiendo un código a GitHub…', texto: 'Un momento.', extra: { tipo: 'barra' }, acciones: [sec('Cancelar', 'cancelar')] }
  }
  if (e?.fase === 'codigo') {
    return {
      estado: 'codigo', pose: 'esperando', chip: 'esperándote', titulo: 'Pegá este código en GitHub',
      texto: 'Se abrió GitHub en tu navegador. Pegá este código y autorizá el acceso.',
      extra: { tipo: 'codigo', codigo: e.codigo, vence: e.vence },
      enlaces: [enlace('¿No se abrió? Abrir github.com/login/device', 'abrir', 'dispositivo', true)],
      acciones: [sec('Cancelar', 'cancelar')],
    }
  }
  if (e?.fase === 'verificando') {
    return { estado: 'verificando', pose: 'leyendo', chip: 'revisando', titulo: 'Revisando tu cuenta…', texto: `Confirmamos los permisos y que seas parte de ${ORGANIZACION}.`, extra: { tipo: 'barra' } }
  }
  if (e?.fase === 'error' && !conecta) {
    return {
      estado: 'errorGh', pose: 'fallo', chip: 'falló', titulo: 'No se pudo instalar GitHub CLI',
      texto: e.error.permiso ? 'Windows no dio permiso para instalar.' : 'winget devolvió un error.',
      extra: bloqueError(e.error), acciones: [pri('Reintentar', 'correr', 'gh'), sec('Copiar detalle', 'copiar', detalle(e.error))],
      enlaces: [enlace('Instalarlo a mano', 'abrir', 'gh-manual', true)],
    }
  }
  if (e?.fase === 'error') {
    // Supuesto: la dirección no trae un error al conectar que no sea de red ni el vencimiento
    return {
      estado: 'errorConectar', pose: 'fallo', chip: 'falló', titulo: 'No se pudo conectar con GitHub',
      texto: e.error.red ? 'Revisá tu conexión y probá de nuevo.' : 'GitHub CLI devolvió un error.',
      extra: bloqueError(e.error), acciones: [pri('Reintentar', 'correr', e.accion), sec('Copiar detalle', 'copiar', detalle(e.error))],
    }
  }
  if (e?.fase === 'vencido') {
    return {
      estado: 'vencido', pose: 'durmiendo', chip: 'venció', titulo: 'El código venció',
      texto: 'GitHub no recibió la autorización a tiempo. Pedí otro cuando quieras.', acciones: [pri('Pedir otro código', 'correr', e.accion)],
    }
  }
  const gh = r.gh ?? {}
  if (!gh.instalado) {
    if (gh.winget === false) {
      return {
        estado: 'faltaWinget', pose: 'esperando', chip: 'falta gh', titulo: 'Instalá GitHub CLI a mano',
        texto: 'Este Windows no tiene winget, el instalador de aplicaciones. Bajá GitHub CLI desde su página y volvé acá.',
        acciones: [pri('Abrir cli.github.com', 'abrir', 'gh-manual', { externo: true }), sec('Volver a buscar', 'revisar')],
      }
    }
    return {
      estado: 'faltaGh', pose: 'saluda', chip: 'falta gh', titulo: 'Conectá tu GitHub',
      texto: 'Para ver a tu equipo hace falta GitHub CLI. Se instala con winget y Windows puede pedirte permiso.',
      nota: 'Al instalar aceptás la licencia de GitHub CLI y las condiciones de winget.',
      acciones: [pri('Instalar GitHub CLI', 'correr', 'gh'), apagado('Conectar con GitHub', 'correr', 'conectar', 'Primero instalá GitHub CLI.')],
    }
  }
  const c = r.cuenta ?? {}
  const sinConexion = (comando, linea) => ({
    estado: 'sinConexion', pose: 'fallo', chip: 'sin conexión', titulo: 'No pudimos hablar con GitHub', texto: 'Revisá tu conexión y probá de nuevo.',
    extra: { tipo: 'error', comando, linea }, acciones: [pri('Reintentar', 'revisar'), sec('Copiar detalle', 'copiar', `${comando}\n${linea}`)],
  })
  if (c.estado === 'sin-conexion') return sinConexion(c.comando, c.error)
  if (c.estado !== 'conectada') {
    return {
      estado: 'sinConectar', pose: 'saluda', chip: 'sin conectar', titulo: 'Conectá tu GitHub',
      texto: 'GitHub CLI ya está. Se abre el navegador para que entres con tu cuenta y autorices el acceso.',
      nota: 'Pide permisos de repo, read:org y project.', acciones: [pri('Conectar con GitHub', 'correr', 'conectar', { externo: true })],
    }
  }
  if (c.faltan?.length) {
    return {
      estado: 'faltaPermiso', pose: 'esperando', chip: 'falta permiso', titulo: 'Falta un permiso',
      texto: `Tu cuenta @${c.login} está conectada, pero sin ${c.faltan.length > 1 ? 'los permisos' : 'el permiso'} ${lista(c.faltan)}, que el tablero necesita.`,
      acciones: [pri('Sumar el permiso', 'correr', 'permiso', { externo: true })],
    }
  }
  const mb = r.membresia ?? {}
  if (mb.estado === 'activa') {
    return { estado: 'hecho', pose: 'listo', chip: 'listo', titulo: 'GitHub está conectado', extra: { tipo: 'cuenta', login: c.login, miembro: true } }
  }
  if (mb.estado === 'pendiente') {
    return {
      estado: 'invitacion', pose: 'esperando', chip: 'invitación', titulo: 'Tenés una invitación sin aceptar',
      texto: `${ORGANIZACION} ya te invitó. Aceptala en GitHub y volvé acá.`,
      acciones: [pri('Aceptar en GitHub', 'abrir', 'invitacion', { externo: true }), sec('Volver a revisar', 'revisar')],
    }
  }
  if (mb.estado === 'no-miembro') {
    return {
      estado: 'noMiembro', pose: 'fallo', chip: 'sin acceso', titulo: `Tu cuenta no es parte de ${ORGANIZACION}`,
      texto: `Conectaste @${c.login}, pero la Oficina lee los datos del equipo desde la organización ${ORGANIZACION}.`,
      extra: {
        tipo: 'arreglo',
        pasos: [
          `Pedile a un owner de ${ORGANIZACION} que te invite (Personas → Invitar).`,
          `Aceptá la invitación desde tu correo o en github.com/orgs/${ORGANIZACION}/invitation.`,
          'Volvé acá y tocá «Volver a revisar».',
        ],
      },
      acciones: [pri('Volver a revisar', 'revisar'), sec('Copiar mi usuario', 'copiar', c.login)],
      enlaces: [enlace('Conectar otra cuenta', 'correr', 'conectar')],
    }
  }
  // Sin conexión o un error al leer la membresía (supuesto: se muestra como sin conexión, con su línea)
  return sinConexion(mb.comando ?? `gh api user/memberships/orgs/${ORGANIZACION}`, mb.error ?? 'sin detalle')
}

const REVISANDO = { estado: 'revisando', pose: 'leyendo', chip: 'revisando', titulo: 'Revisando este equipo…', texto: 'Solo miramos qué hay instalado. No se instala nada.' }

/** La ejecución de un paso sigue en curso (corre, muestra el código o verifica). */
const enCurso = e => !!e && ['corriendo', 'codigo', 'verificando'].includes(e.fase)

function categoria(estado) {
  if (estado === 'hecho') return 'hecho'
  if (estado === 'codigo' || CORRE.has(estado)) return 'corre'
  if (FALLA.has(estado)) return 'falla'
  return 'pendiente'
}

function glifo(estado, n) {
  if (estado === 'hecho') return 'hecho'
  if (GLIFO_ERROR.has(estado)) return '!'
  if (estado === 'codigo' || CORRE.has(estado)) return 'punto'
  return n
}

const BASE = { claude: estadoClaude, mod: estadoMod, gh: estadoGh }

/**
 * El modelo del asistente: el estado de cada paso con sus botones ya resueltos (3.1), el paso que
 * toca, el que corre, cuántos pasos faltan (null sin revisar) y si todo está listo.
 * `revision`: lo que devuelve `revisar_primeros_pasos` (null antes de la primera); `revisando`:
 * hay una revisión en curso; `ejec`: lo que corre o corrió en cada paso (`alEmpezar`, `alEvento`).
 */
export function modeloAsistente({ revision, revisando, ejec }) {
  const r = revision ?? {}
  const base = {}
  for (const p of PASOS) base[p.id] = { acciones: [], enlaces: [], extra: null, nota: null, texto: null, ...BASE[p.id](r, ejec?.[p.id]) }
  const faltan = revision ? ORDEN.filter(id => base[id].estado !== 'hecho').length : null
  const corriendo = ORDEN.find(id => enCurso(ejec?.[id])) ?? null

  const pasos = {}
  for (const p of PASOS) {
    let e = base[p.id]
    // Revisando: la escena lo dice y las acciones de antes quedan deshabilitadas (4.1)
    if ((revisando || !revision) && !enCurso(ejec?.[p.id])) {
      const previas = revision ? e.acciones.map(a => ({ ...a, deshabilitada: true, motivo: 'Revisando…' })) : []
      e = { ...e, ...REVISANDO, extra: null, nota: null, enlaces: [], acciones: previas }
    }
    pasos[p.id] = { ...p, ...e, categoria: categoria(e.estado), glifo: glifo(e.estado, p.n) }
  }

  const tocaEn = ps => ORDEN.find(id => ['corre', 'falla'].includes(categoria(ps[id].estado))) ?? ORDEN.find(id => ps[id].estado !== 'hecho') ?? null
  const actual = tocaEn(pasos)
  // El que tocaba según la última revisión: lo que se ve al abrir mientras se vuelve a revisar
  const tocaba = revision ? tocaEn(base) : null
  for (const id of ORDEN) {
    const p = pasos[id]
    const otro = corriendo && corriendo !== id ? PASOS.find(x => x.id === corriendo) : null
    p.acciones = p.acciones.map(a => {
      let b = { ...a }
      // Solo el paso que toca lleva el botón ámbar (3.1)
      if (b.tipo === 'pri' && id !== actual) b.tipo = 'sec'
      // Uno por vez: mientras otro paso corre, las acciones de este quedan deshabilitadas con su motivo
      if (otro) b = { ...b, deshabilitada: true, motivo: `Esperá a que termine el paso ${otro.n}.` }
      return b
    })
    p.enlaces = p.enlaces.map(l => (otro && l.accion === 'correr' ? { ...l, deshabilitada: true } : l))
    p.etiqueta = `Paso ${p.n}, ${p.nombre}: ${p.chip}`
  }
  const listos = ORDEN.filter(id => pasos[id].estado === 'hecho').length
  return { pasos, orden: ORDEN, actual, tocaba, corriendo, faltan, listos, todoListo: listos === ORDEN.length }
}

// ------------------------------------------------------------------ lo que corre (9.5)

/** Un clic en una acción que corre algo: el paso pasa a correr con el registro vacío. */
export function alEmpezar(ejec, accion) {
  const paso = pasoDeAccion(accion)
  if (!paso) return ejec
  return { ...ejec, [paso]: { accion, fase: 'corriendo', lineas: [] } }
}

/**
 * Un evento de `oficina://primeros-pasos` (primeros_pasos.rs): un comando que empieza o termina,
 * el código de GitHub, o el final (`listo` pasa a verificar, `error`, `vencido` o `cancelado`).
 */
export function alEvento(ejec, ev, ahoraMs) {
  const paso = ev?.paso ?? pasoDeAccion(ev?.accion)
  const e = ejec?.[paso]
  if (!paso || !e) return ejec
  let nuevo = e
  switch (ev.estado) {
    case 'comando': nuevo = { ...e, lineas: [...e.lineas, { comando: ev.comando, hecho: false }] }; break
    case 'comando-hecho': nuevo = { ...e, lineas: e.lineas.map(l => (l.comando === ev.comando ? { ...l, hecho: true } : l)) }; break
    case 'codigo': nuevo = { ...e, fase: 'codigo', codigo: ev.codigo, vence: ahoraMs + MS_CODIGO }; break
    case 'listo': nuevo = { ...e, fase: 'verificando' }; break
    case 'error': nuevo = { ...e, fase: 'error', error: { comando: ev.comando, linea: ev.linea, detalle: ev.detalle ?? '', red: !!ev.red, permiso: !!ev.permiso } }; break
    case 'vencido': nuevo = { ...e, fase: 'vencido' }; break
    case 'cancelado': nuevo = null; break
    default: return ejec
  }
  return { ...ejec, [paso]: nuevo }
}

/** ¿La revisión muestra cumplido lo que buscaba la acción? */
function metaCumplida(accion, r) {
  switch (accion) {
    case 'mod': return !!r.mod?.instalado
    case 'activar': return !!r.mod?.activo
    case 'gh': return !!r.gh?.instalado
    case 'conectar': return r.cuenta?.estado === 'conectada'
    case 'permiso': return r.cuenta?.estado === 'conectada' && !r.cuenta.faltan?.length
    default: return false
  }
}

/**
 * Después de cada revisión (la verificación de solo lectura de 3.3): lo que verificaba queda hecho
 * y un error o un código vencido se van solo si la revisión muestra cumplido lo que buscaban (por
 * ejemplo, winget falló pero `gh --version` responde).
 */
export function trasRevision(ejec, revision) {
  const r = revision ?? {}
  const nuevo = { ...ejec }
  for (const id of ORDEN) {
    const e = ejec?.[id]
    if (!e) continue
    if (e.fase === 'verificando') nuevo[id] = { ...e, fase: 'hecho' }
    else if ((e.fase === 'error' || e.fase === 'vencido') && metaCumplida(e.accion, r)) nuevo[id] = null
  }
  return nuevo
}

// ------------------------------------------------------------------ dónde vive (3.2)

/**
 * `escenario` (sin tablero, en lugar del vacío), `hoja` (con tablero, en la columna principal) o
 * null. Sin tablero aparece solo si falta algo y no se cerró en esta ejecución; con tablero, solo a
 * pedido ("Ver →" o la bandeja). Antes de la primera lectura o revisión no aparece solo.
 */
export function formaAsistente({ hayTablero, cargando, abierto, cerrado, faltan }) {
  if (hayTablero) return abierto ? 'hoja' : null
  if (abierto) return 'escenario'
  if (cargando || cerrado || !faltan) return null
  return 'escenario'
}

/** Lo que dice el aviso del tablero según el primer paso pendiente (3.5), o null si no falta nada. */
export function pendienteAviso(modelo) {
  if (!modelo.faltan) return null
  const id = modelo.orden.find(x => modelo.pasos[x].estado !== 'hecho')
  if (id === 'claude') return 'instalar Claude Code'
  if (id === 'mod') return 'instalar el mod'
  const e = modelo.pasos.gh.estado
  return e === 'noMiembro' || e === 'invitacion' ? `entrar a ${ORGANIZACION}` : 'conectar GitHub'
}

/** El nombre de la muesca suma lo que falta (3.5); la muesca no golpea por la configuración. */
export function nombreMuesca(nombre, faltan) {
  if (!faltan) return nombre
  const frase = faltan === 1 ? 'Falta 1 paso de configuración.' : `Faltan ${faltan} pasos de configuración.`
  return nombre.replace(/ Abrir$/, ` ${frase} Abrir`)
}

/** Acoplada, el panel no se pliega solo mientras se pide el código, se muestra o se verifica (5.2). */
export function retieneAbierta(modelo) {
  return ['pidiendo', 'codigo', 'verificando'].includes(modelo.pasos.gh.estado)
}

/**
 * "Mantener abierta" al terminar esa fase: vuelve a la marca de antes solo si el usuario no la tocó
 * mientras duraba (`tocada`); si la cambió a mano, queda su elección (`actual`).
 */
export function fijaAlSoltar({ antes, actual, tocada }) {
  return tocada ? !!actual : !!antes
}

// ------------------------------------------------------------------ navegación (3.4)

/** Lo que se ve al abrir: el paso que toca o, con todo hecho, la escena final. */
export function visibleInicial(modelo) {
  // Mientras se vuelve a revisar, lo que tocaba según la revisión anterior (o la escena final)
  const revisando = modelo.orden.some(id => modelo.pasos[id].estado === 'revisando')
  if (revisando && modelo.faltan !== null) return modelo.tocaba ?? 'listo'
  return modelo.actual ?? (modelo.todoListo ? 'listo' : ORDEN[0])
}

/**
 * "← Anterior" (−1) y "Siguiente →" (1): solo cambian la vista. Siguiente solo con el paso visible
 * hecho; del paso 3 se pasa a la escena final si todo está listo. null: no se puede.
 */
export function navegar(modelo, visible, dir) {
  if (visible === 'listo') return dir < 0 ? ORDEN.at(-1) : null
  const i = ORDEN.indexOf(visible)
  if (dir < 0) return i > 0 ? ORDEN[i - 1] : null
  if (modelo.pasos[visible]?.estado !== 'hecho') return null
  if (i < ORDEN.length - 1) return ORDEN[i + 1]
  return modelo.todoListo ? 'listo' : null
}

// ------------------------------------------------------------------ anuncios (7.2)

/** "4F2A-91C7" → "4 F 2 A guion 9 1 C 7", para el lector de pantalla. */
export function deletrear(codigo) {
  return [...String(codigo)].map(c => (c === '-' ? 'guion' : c)).join(' ')
}

/** El anuncio de un paso que cambió de `antes` a `p`. */
function anuncioPaso(antes, p) {
  const de = antes.estado, a = p.estado
  if (p.id === 'claude' && a === 'hecho') return 'Claude Code encontrado'
  if (p.id === 'mod') {
    if (a === 'trabajando') return 'Instalando el mod de la Oficina'
    if (a === 'hecho') return 'Mod instalado'
    if (a === 'error') return `No se pudo instalar el mod: ${p.texto}`
  }
  if (p.id === 'gh') {
    if (a === 'instalandoGh') return 'Instalando GitHub CLI'
    if (a === 'codigo') return `Código de GitHub listo: ${deletrear(p.extra.codigo)}. Pegalo en el navegador`
    if (a === 'hecho') return `GitHub conectado como ${p.extra.login}`
    if (a === 'noMiembro') return `Tu cuenta no es miembro de ${ORGANIZACION}`
    if (a === 'sinConectar' && (de === 'pidiendo' || de === 'codigo')) return 'Conexión cancelada'
  }
  return p.titulo.replace(/…$/, '')
}

/**
 * Un mensaje por cambio de estado para la región viva (7.2), nunca por la lectura de 1,5 s: la
 * revisión que empieza o el primer paso que cambió. Sin cambios, ''.
 */
export function anuncioCambio(antes, despues) {
  if (!antes || !despues) return ''
  const cambiados = ORDEN.filter(id => antes.pasos[id].estado !== despues.pasos[id].estado)
  if (!cambiados.length) return ''
  if (cambiados.some(id => despues.pasos[id].estado === 'revisando')) return 'Revisando este equipo'
  return anuncioPaso(antes.pasos[cambiados[0]], despues.pasos[cambiados[0]])
}
