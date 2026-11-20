// Tauri falso para ver el widget en un navegador (solo desarrollo; no entra en la app porque
// frontendDist apunta a ../src). Script clásico: corre antes que los módulos, así main.js ya
// encuentra window.__TAURI__ al cargarse.
//
// Parámetros de la URL de vista.html:
//   ?vacio        sin sesiones (estado vacío)
//   ?cargando     la primera lectura no termina nunca ("Buscando sesiones…")
//   ?zoom=150     tamaño inicial (100, 125, 150, 175 o 200), como el de la bandeja
//   ?sinequipo    gh falla: "Equipo sin datos: …"
//   ?error        leer_sesiones falla después de la primera lectura
//   ?preguntas=varias  catalogo pregunta dos cosas en una llamada (varias + una) y Camila pregunta otra
//   ?sololectura  la sesión de catalogo no acepta respuestas del widget (versión vieja del mod)
//   ?envio=listo  la sesión toma la respuesta: "Listo, le respondiste…"
//   ?envio=ya     la pregunta desaparece sin tomar el archivo: "Ya se respondió en Claude."
//   ?envio=error  el comando responder falla: "Respondé en Claude…" al instante
//   (sin ?envio, el archivo queda pendiente y a los 5 s pide responder en Claude)
// La ventana pedida por ajustar_ventana queda en window.__ventana y en la consola (info).
;(() => {
  const url = new URLSearchParams(location.search)
  const ahora = Date.now()
  const hace = min => new Date(ahora - min * 60000).toISOString()
  const PASOS = [100, 125, 150, 175, 200]

  const sub = (id, nombre, tarea, estado, extra = {}) => ({
    id, nombre, inventado: false, tipo: 'general-purpose', tarea, desde: hace(9), estado,
    hasta: estado === 'trabajando' ? null : hace(3), ...extra,
  })

  /** 3 proyectos: una sesión con 3 subagentes trabajando, una quieta y una con pregunta pendiente. */
  const SESIONES = [
    {
      v: 1, sesion: 'ses-oficina', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando',
      repo: 'quintechlab/oficina', rama: 'feat/6-estilo-avis-marco', tarea: 6, nota: null,
      inicio: hace(42), tareaDesde: hace(42), actualizado: hace(0), archivos: [], actividad: 'lanzando Delfina',
      puedeResponder: true,
      agentes: [
        sub('a1', 'Delfina', 'bocetos del tablero', 'trabajando', { desde: hace(4) }),
        sub('a2', 'Ramiro', 'mapear el widget', 'trabajando', { tipo: 'Explore', desde: hace(2) }),
        sub('a3', 'Pixel', 'tests de la sala', 'trabajando', { inventado: true, tipo: 'general-purpose', desde: hace(1) }),
        sub('a4', 'Inés', 'revisar la CSP', 'fallo', { hasta: hace(3) }),
        sub('a5', 'Camila', 'copy del aviso', 'listo', { hasta: hace(5) }),
      ],
    },
    {
      v: 1, sesion: 'ses-nucleo', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando',
      repo: 'quintechlab/central-nucleo-main', rama: 'main', tarea: null, nota: null,
      inicio: hace(95), tareaDesde: null, actualizado: hace(1), archivos: [], actividad: 'esperándote',
      puedeResponder: true, agentes: [],
    },
    {
      v: 1, sesion: 'ses-catalogo', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando',
      repo: 'quintechlab/catalogo', rama: 'feat/48-precios', tarea: 48, nota: null,
      inicio: hace(18), tareaDesde: hace(18), actualizado: hace(0), archivos: [], actividad: 'pensando',
      puedeResponder: !url.has('sololectura'),
      agentes: url.get('preguntas') === 'varias' ? [sub('c9', 'Camila', 'copy del aviso de precios', 'trabajando', { desde: hace(3) })] : [],
      preguntas: [{
        id: 'toolu_vista_1', agente: null, desde: hace(2),
        items: [{
          pregunta: '¿Cómo mostramos los precios con descuento?', encabezado: 'Precios', multiple: false,
          opciones: [
            { etiqueta: 'Precio tachado y el nuevo al lado (Recomendada)', descripcion: 'Se ve el ahorro de un vistazo.' },
            { etiqueta: 'Solo el precio nuevo', descripcion: 'Más limpio, sin comparación.' },
          ],
        }],
      }],
    },
  ]
  if (url.get('preguntas') === 'varias') {
    const catalogo = SESIONES.find(s => s.sesion === 'ses-catalogo')
    catalogo.preguntas[0].items.unshift({
      pregunta: '¿Qué tamaños de foto exportamos?', encabezado: 'Fotos', multiple: true,
      opciones: [
        { etiqueta: 'Miniatura 320 px', descripcion: 'Para el listado.' },
        { etiqueta: 'Ficha 960 px (Recomendada)', descripcion: 'La foto principal.' },
        { etiqueta: 'Zoom 2000 px', descripcion: 'Solo si el producto lo pide.' },
      ],
    })
    catalogo.preguntas.push({
      id: 'toolu_vista_2', agente: 'c9', desde: hace(1),
      items: [{
        pregunta: '¿El aviso de descuento lleva el porcentaje?', encabezado: 'Copy', multiple: false,
        opciones: [
          { etiqueta: 'Sí, «−20 %» (Recomendada)', descripcion: 'El número vende solo.' },
          { etiqueta: 'No, solo «Oferta»', descripcion: 'Más corto.' },
        ],
      }],
    })
  }
  /** Preguntas que el falso da por tomadas (?envio=listo) o respondidas en Claude (?envio=ya). */
  const tomadas = new Set()
  const sinTomadas = () => SESIONES.map(s => ({ ...s, preguntas: (s.preguntas ?? []).filter(p => !tomadas.has(p.id)) }))

  const comentario = d => `<!-- oficina:presencia -->\n\`\`\`json\n${JSON.stringify(d)}\n\`\`\``
  const EQUIPO = {
    yo: 'nicoequintana',
    comentarios: [{
      usuario: 'NCsolucionesdigitales',
      cuerpo: comentario({
        v: 2, usuario: 'NCsolucionesdigitales', nombre: 'Nicolás Campos', ausente: false, actualizado: hace(4),
        sesiones: [{
          sesion: 'ses-campos', usuario: 'NCsolucionesdigitales', nombre: 'Nicolás Campos', estado: 'trabajando',
          repo: 'quintechlab/catalogo', rama: 'feat/51-carrito', tarea: 51, inicio: hace(30), actualizado: hace(4),
          actividad: 'editando carrito.ts',
          agentes: [{ id: 'c1', nombre: 'Lucas', inventado: false, tipo: 'general-purpose', tarea: 'tests del carrito', desde: hace(6), estado: 'trabajando', hasta: null }],
        }],
      }),
    }],
  }

  let paso = PASOS.includes(Number(url.get('zoom'))) ? Number(url.get('zoom')) : 100
  const ventana = { x: 40, y: 40, ancho: 400, alto: 620 }
  window.__ventana = { ...ventana }
  const oyentes = {}
  let lecturas = 0

  const comandos = {
    registrar: ({ linea }) => console.debug('[widget.log]', linea),
    poner_bandeja: ({ texto }) => { document.title = texto },
    estado_menu: () => ({ arriba: true, avisar: true, pausa: false, tamano: paso }),
    leer_sesiones: () => {
      lecturas++
      if (url.has('cargando')) return new Promise(() => {})
      if (url.has('error') && lecturas > 1) throw new Error('acceso denegado a sesiones (falso)')
      return url.has('vacio') ? [] : sinTomadas()
    },
    leer_equipo: () => url.has('sinequipo') ? { comentarios: [], yo: 'nicoequintana', error: 'gh: no autenticado (falso)' } : EQUIPO,
    geometria: () => ({ ...ventana, area: { x: 0, y: 0, ancho: 1920, alto: 1040 } }),
    ajustar_ventana: ({ ancho, alto, x, y }) => {
      Object.assign(ventana, { ancho, alto, x, y })
      window.__ventana = { ...ventana }
      console.info(`[ventana] ${ancho} × ${alto}`)
    },
    cambiar_tamano: ({ direccion }) => {
      const k = PASOS.indexOf(paso)
      paso = direccion === 0 ? 100 : PASOS[Math.max(0, Math.min(PASOS.length - 1, k + direccion))]
      for (const f of oyentes['oficina://tamano'] ?? []) f({ payload: paso })
    },
    fijar_arriba: () => null,
    modo_mini: ({ mini, ancho, alto }) => { if (mini) console.info(`[ventana] tira ${ancho} × ${alto}`) },
    esconder: () => console.info('[ventana] escondida en la bandeja'),
    avisar: () => null,
    // Responder: según ?envio, la sesión toma la respuesta, la pregunta se va sola o el comando falla
    responder: args => {
      console.info('[responder]', JSON.stringify(args))
      const envio = url.get('envio')
      if (envio === 'error') throw new Error('no se pudo escribir la respuesta (falso)')
      if (envio === 'listo' || envio === 'ya') setTimeout(() => tomadas.add(args.id), 1200)
    },
    estado_respuesta: ({ id }) => (url.get('envio') === 'listo' && tomadas.has(id) ? 'consumida' : 'pendiente'),
    borrar_respuesta: () => null,
  }

  window.__TAURI__ = {
    core: {
      invoke: async (comando, args = {}) => {
        const f = comandos[comando]
        if (!f) throw new Error(`comando desconocido en el Tauri falso: ${comando}`)
        return f(args)
      },
    },
    event: {
      listen: async (nombre, f) => {
        ;(oyentes[nombre] ??= []).push(f)
        return () => { oyentes[nombre] = oyentes[nombre].filter(g => g !== f) }
      },
    },
    window: {
      getCurrentWindow: () => ({ isVisible: async () => true, isMinimized: async () => false }),
    },
  }
})()
