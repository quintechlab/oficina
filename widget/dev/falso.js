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
//   ?sincontrol   las sesiones no aceptan órdenes (mod anterior a la v0.10): sin barra de control (#19)
//   ?orden=muda|fallo|error  la orden de la barra: la sesión nunca la toma ("La sesión no respondió"
//                 a los 10 s), no pudo hacerla, o el comando ordenar falla. Sin ?orden la toma en 1,2 s
//                 (en cola si la sesión trabaja; frenar la deja esperándote)
//   ?procesos     central-nucleo espera dos procesos en segundo plano (pose "proceso", v0.6)
//   ?escena=dos   oficina con 2 subagentes (uno trabaja, uno terminó); ?escena=doble: oficina con dos
//                 sesiones de un subagente cada una (panel-avis-ux.md, casos A y C del boceto). Sin
//                 ?escena, oficina tiene 5 (caso B: 3 y la pila "+2") y central-nucleo ninguno
//   ?poses        recorre los Avis: "poses" tiene una sesión por estado de Claude (editando,
//                 comando, leyendo, pensando, esperándote, proceso, inactiva); "elenco" coordina a los cinco
//                 subagentes (escribiendo, leyendo, listo y falló recién, dormido; 4 fichas y "+1")
//   ?pausa        arranca con "Pausar animaciones" marcado, como desde la bandeja
//   ?mascota=ascua  la mascota de preferencias.json (avi, ascua, escarcha, nodo, bruma, morro o lumen;
//                 docs/diseno/mascotas-avi-ux.md 9.1), con su forma evolucionada, sus bucles y sus actos;
//                 los subagentes, sus variantes (7.3; con el Avi, el elenco por nombre)
//   ?equipo=n     oficina arranca con n subagentes trabajando (0: ninguno; su Claude empieza en la base)
//   ?evol=n       suma el proyecto avis-evol (el primero de la barra) con n sesiones que ya coordinan al abrir:
//                 sus actos salen escalonados 250 ms, después la marca (6.10)
//                 Desde la consola del iframe: window.__equipo(n, 'ses-oficina') pone n subagentes a
//                 trabajar (0: terminan todos) y la evolución sigue la regla de 6.4 en la lectura siguiente
//   &registro     anota los cambios de forma y los actos en window.__registroEvo (hora en ms y figura)
//   ?acople=arriba&lugar=0.5  arranca acoplada (arriba, derecha, abajo o izquierda), como si estuviera guardado
//   ?estado=reposo|trabajando  sin pregunta pendiente: todos esperan, o una sesión coordina (sin ?estado, catalogo pregunta)
//   ?sinderecha   el borde derecho toca a otro monitor: no acopla
//   ?reposo=7     la marca juega con los tiempos del reposo divididos por 7, como el boceto
//                 docs/diseno/bocetos/marca-avi.html (primer juego a los ~6 s, siesta a los ~69 s);
//                 con ?estado=reposo nadie trabaja y el Avi de la marca puede jugar
//   ?muesca=reposo|trabajando|pregunta|golpe|duerme  el estado de la muesca A "Asoma"
//                 (muesca-avi-ux.md 13.8; con &acople=arriba|derecha|abajo|izquierda): reposo y
//                 trabajando son ?estado=…, pregunta y golpe el caso de siempre (catalogo pregunta y
//                 golpea al llegar), duerme es ?vacio
// Mirada del Avi a la vista (marca-avi-ux.md 6 y muesca-avi-ux.md 9): acoplada y con mirada (la marca
// con el panel abierto o el Avi de la muesca cerrada, si sigue al puntero: zona_interactiva con
// mirada), el puntero del escritorio se avisa como oficina://cursor { x, y }, a lo sumo cada 50 ms y
// solo si cambió, como el sondeo de Rust.
// Ventana única (9.7): dev/vista.html es el escritorio (la ventana del navegador menos una barra de
// tareas de 40 px) y carga dev/ventana.html en un iframe que hace de ventana de Tauri. Como la real,
// la ventana es el área entera en todos los modos (acoplada, flotando y en la tira): la muesca, la
// píldora, el tablero y la tira se mueven adentro. ajustar_ventana movería y redimensionaría el
// iframe (pasar a otro monitor; acá hay uno solo). El menú de la bandeja se imita con
// window.__bandeja('oficina://acoplar', 'derecha') desde la consola del iframe. Lo guardado con
// guardar_acople queda en window.__acople y con guardar_flotante en window.__flotante.
//   ?flotante=0.2,0.7  la posición flotante guardada (fracciones del lugar libre del área)
// La ventana pedida por ajustar_ventana queda en window.__ventana y en la consola (info).
// Zona interactiva (9.6 y 9.7): en todos los modos zona_interactiva guarda la zona (window.__zona)
// y el puntero del escritorio se sigue en vista.html y en el iframe; al entrar o salir se emite
// oficina://puntero-zona { dentro, n }, como el sondeo de Rust. El paso de los clics se imita con
// pointer-events: none en el iframe (el escritorio de vista.html recibe el clic). window.__puntero
// dice el último punto visto y si estaba adentro.
// Hay una hoja con todos los Avis en todas las poses en dev/avis.html.
// Pantalla dividida (#13, docs/diseno/dividida-ux.md): tienda-web y api-pagos conversan; se ve api-pagos.
//   ?dividida=antes     las dos sesiones, sin conversación (caso 1)
//   ?dividida=aparece   a los 2,5 s tienda-web le escribe a api-pagos: se abre sola y cruza la pastilla (caso 2)
//   ?dividida=pregunta  tienda-web le escribió hace 40 s: se abre sola, api-pagos tiene el turno (caso 3)
//   ?dividida=responde  como pregunta, y a los 7 s api-pagos contesta: cruza de vuelta y tienda-web festeja (caso 4)
//   ?dividida=dos       como pregunta, y a los 6 s panel-admin habla con tienda-web: pestaña nueva con punto;
//                       a los 12 s otro mensaje en esa la hace latir (caso 5, ramas largas)
//   ?dividida=termina   se abre y a los ~6 s termina (5 min sin mensajes): cable cortado y cuenta de 60 s (caso 6)
//   ?dividida=vuelve    como termina, con la cuenta acortada a 6 s: vuelve a la vista anterior (caso 7)
//   ?dividida=otro      conversan tienda-web y panel-admin mientras mirás api-pagos: solo late la ficha (3.2)
//   ?dividida=sindatos  api-pagos habla con una sesión que no se ve desde esta máquina: mitad "sin datos" (8)
// Primeros pasos (#10, docs/diseno/bienvenida-ux.md): sin ?pp la máquina está lista (el widget de
// siempre). Con ?pp, lo que falta:
//   ?pp=nada       sin Claude Code ni GitHub CLI (winget sí)
//   ?pp=sinclaude  sin Claude Code (GitHub conectado)
//   ?pp=sinmod     sin el mod ni el catálogo        ?pp=apagado     el mod instalado pero apagado
//   ?pp=singh      sin GitHub CLI (winget sí)        ?pp=sinwinget   sin GitHub CLI ni winget
//   ?pp=sinsesion  gh sin sesión                     ?pp=sinpermiso  la cuenta sin el permiso project
//   ?pp=nomiembro  la cuenta no es de quintechlab    ?pp=invitacion  invitación sin aceptar
//   ?pp=sinred     GitHub no responde (sin conexión) ?pp=listo       todo hecho
//   &ppfalla=mod|gh|conectar  la primera vez ese paso falla (sin red, permiso de Windows o error de gh)
//   &ppvence       el código de GitHub vence a los 5 s; sin esto, "autorizás" en el navegador a los 6 s
//   &pplento       la revisión tarda 2 s (para ver "Revisando…")
//   &modauto=instalo|actualizo  Avis instaló o actualizó el mod solo (#17): el aviso de una vez
//   &modauto=solo  con ?pp=sinmod: a los 1,5 s Avis instala el mod solo (oficina://mod-auto) y avisa
// Cada paso que corre avisa como Rust (oficina://primeros-pasos) y, si termina bien, cambia la
// máquina falsa. El ítem de la bandeja se imita con window.__bandeja('oficina://primeros-pasos-abrir');
// su texto queda en window.__menuPasos.
// La charla con la mascota (#22, docs/diseno/chat-avis-ux.md): el backend falso de chat_abrir,
// chat_enviar, chat_frenar, chat_cerrar, guardar_chat, elegir_carpeta, estado_modelo, descargar_modelo
// y cancelar_modelo, con los eventos oficina://chat y oficina://modelo; el historial (chat_guardar,
// chat_historial, chat_leer, chat_borrar) vive en memoria, con una charla de ayer ya guardada. Se toca el Avi de la marca para
// abrir la hoja. Con ?chat=…, la hoja se abre sola y va a ese estado (por window.__chat, el mismo
// camino que el usuario); sin ?flotante, el tablero queda a la izquierda para que la hoja entre:
//   ?chat=vacio        la charla vacía, con la carpeta "catalogo" (&sinCarpeta: "Solo Avis")
//   ?chat=esperando    la espera: el proceso queda despierto y nunca responde (a los 120 s, "tiempo")
//   ?chat=escribiendo  la respuesta llega lenta y no termina (el cursor y los bloques que se cierran)
//   ?chat=listo        la respuesta entera (Markdown, código, tabla, un enlace y HTML escapado)
//   ?chat=frenada      se frena a los 2,6 s: el parcial y "■ frenaste acá"
//   ?chat=error-red    tres reintentos sin respuesta y el error `red` (D33), con el modelo local instalado
//   ?chat=historial    dos charlas rápidas y el cajón "Charlas" abierto
//   ?chat=soltar       la capa de soltar un archivo, quieta (el arrastre en curso sobre la hoja)
//   ?chat=adjuntos     se sueltan un PDF y unas notas sobre la hoja: los dos chips (el PDF con sus páginas)
//   ?chat=error-adjunto se suelta una planilla .xlsx: la tarjeta "No puedo leer planilla.xlsx"
//   &cancelaAdjunto    el clip se cancela (sin esto, elige presupuesto-2027.pdf de Descargas)
//   ?chat=encima       al 200 % (si no hay ?zoom): la hoja no entra al costado y tapa la columna (D1)
//   &motor=local       la próxima charla con el modelo local; &modelo=listo|bajando su estado (sin esto, falta).
//                      Con &modelo=listo, ?chat=esperando|escribiendo|listo|frenada responde el modelo falso
//                      (despierta en 1,2 s la primera vez, como "Despertando el modelo de esta PC")
//   &cancelaCarpeta    "Elegir otra carpeta…" se cancela (sin esto, elige quintech-crm del escritorio)
//   &engram            el pie del cajón dice "también en Engram" (sin esto, "Engram apagado")
// window.__arrastrar({ type: 'enter' | 'over' | 'drop' | 'leave', paths, position }) imita el arrastre
// de Tauri (onDragDropEvent, px físicos); window.__soltarEnHoja([ruta]) suelta en el medio de la hoja.
// Desde la consola del iframe: window.__chat.despachar({ tipo: 'soltando', nombre: 'a.pdf' }) manda
// cualquier evento a la hoja y window.__chat.estado() la lee; window.__borrarModelo() imita "Borrar el
// modelo de IA" de la bandeja.
;(() => {
  const url = new URLSearchParams(location.search)
  const chatEsc = url.get('chat')
  // Las mascotas (especies.css) van junto a avis.css, como en src/index.html
  if (!document.querySelector('link[href="especies.css"]')) document.write('<link rel="stylesheet" href="especies.css">')
  // ?muesca: atajos de los estados de la muesca A
  const muesca = url.get('muesca')
  if ((muesca === 'reposo' || muesca === 'trabajando') && !url.has('estado')) url.set('estado', muesca)
  if (muesca === 'duerme') url.set('vacio', '')
  if (Number(url.get('reposo')) > 1) window.__escalaReposo = Number(url.get('reposo'))
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
        // Con actividad y pasos (#14): al hacer clic en su Avi se despliega el detalle
        sub('a1', 'Delfina', 'bocetos del tablero', 'trabajando', {
          desde: hace(4), actividad: 'editando dividida-ux.md',
          pasos: [
            { texto: 'leyendo estilo-avis-ux.md', cuando: hace(4) }, { texto: 'buscando .esc', cuando: hace(3) },
            { texto: 'leyendo tablero.js', cuando: hace(2) }, { texto: 'corriendo npx http-server dev', cuando: hace(1) },
            { texto: 'editando dividida-ux.md', cuando: hace(0) },
          ],
        }),
        sub('a2', 'Ramiro', 'mapear el widget', 'trabajando', { tipo: 'Explore', desde: hace(2) }),
        sub('a3', 'Pixel', 'tests de la sala', 'trabajando', { inventado: true, tipo: 'general-purpose', desde: hace(1) }),
        sub('a4', 'Inés', 'revisar la CSP', 'fallo', { hasta: hace(3), actividad: null, pasos: [{ texto: 'leyendo tauri.conf.json', cuando: hace(5) }, { texto: 'corriendo cargo test', cuando: hace(3) }] }),
        sub('a5', 'Camila', 'copy del aviso', 'listo', { hasta: hace(5) }),
      ],
    },
    {
      v: 1, sesion: 'ses-nucleo', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando',
      repo: 'quintechlab/central-nucleo-main', rama: 'main', tarea: null, nota: null,
      inicio: hace(url.has('larga') ? 697 : 95), tareaDesde: null, actualizado: hace(1), archivos: [], actividad: 'esperándote',
      puedeResponder: true, agentes: [],
    },
    {
      v: 1, sesion: 'ses-catalogo', usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando',
      repo: 'quintechlab/catalogo', rama: 'feat/48-precios', tarea: 48, nota: null,
      // Desde la v0.11 el mod deja la carpeta en el archivo local: el menú de la charla la ofrece (entrega 7)
      cwd: 'C:\\Users\\quintana\\Desktop\\catalogo',
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
  // ?procesos: la sesión de central-nucleo terminó su turno y espera dos procesos en segundo plano (v0.6)
  if (url.has('procesos')) {
    const nucleo = SESIONES.find(s => s.sesion === 'ses-nucleo')
    nucleo.actividad = 'esperando 2 procesos'
    nucleo.procesos = [
      { id: 'bvista1', descripcion: 'Arma el instalador del widget', desde: hace(3) },
      { id: 'bvista2', descripcion: 'npm run dev', desde: hace(1) },
    ]
  }
  // ?escena: los casos del panel "Escenario + chips" (A: 1 sesión y 2 subagentes; C: 2 sesiones)
  if (url.get('escena') === 'dos' || url.get('escena') === 'doble') {
    const oficina = SESIONES.find(s => s.sesion === 'ses-oficina')
    oficina.agentes = [sub('a1', 'Delfina', 'dirección marca B', 'trabajando', { desde: hace(5) })]
    if (url.get('escena') === 'dos') oficina.agentes.push(sub('a2', 'Mateo', 'boceto Avi grande', 'listo', { hasta: hace(8) }))
    else {
      SESIONES.push({
        ...oficina, sesion: 'ses-oficina-2', rama: 'feat/12-tablero', tarea: 12, inicio: hace(41), tareaDesde: hace(41),
        actividad: 'editando tablero.js', agentes: [sub('a7', 'Ramiro', 'lee avis.css', 'trabajando', { tipo: 'Explore', desde: hace(2) })],
      })
    }
  }
  /** Preguntas que el falso da por tomadas (?envio=listo) o respondidas en Claude (?envio=ya). */
  const tomadas = new Set()
  const sinTomadas = () => SESIONES.map(s => ({ ...s, preguntas: (s.preguntas ?? []).filter(p => !tomadas.has(p.id)) }))

  // Barra de control (#19): las sesiones aceptan órdenes (mod v0.10). oficina trabaja (Frenar se ve),
  // central-nucleo espera tu mensaje y catalogo tiene un mensaje en cola ("en cola").
  if (!url.has('sincontrol')) {
    for (const s of SESIONES) Object.assign(s, { puedeControlar: true, enTurno: s.actividad !== 'esperándote' })
    SESIONES.find(s => s.sesion === 'ses-catalogo').enCola = 1
  }
  /** Órdenes del falso, por sesión: { id, tipo, consumida, resultado, motivo }. */
  const ordenesFalsas = new Map()
  /** Como el mod: un mensaje a una sesión que trabaja queda en cola; frenar la deja esperándote. */
  const tomarOrden = (sesion, orden) => {
    if (ordenesFalsas.get(sesion) !== orden) return
    const s = SESIONES.find(x => x.sesion === sesion)
    const trabaja = !!s && s.actividad !== 'esperándote'
    orden.consumida = true
    if (url.get('orden') === 'fallo') Object.assign(orden, { resultado: 'fallo', motivo: 'el motor no lo aceptó (falso)' })
    else if (orden.tipo === 'frenar') {
      orden.resultado = trabaja ? 'frenado' : 'sin-turno'
      if (trabaja) {
        s.actividad = 'esperándote'
        s.enTurno = false
        // enCola no vuelve a 0: el mod lo pone en 0 recién cuando arranca el turno siguiente
        s.agentes = (s.agentes ?? []).map(a => (a.estado === 'trabajando' ? { ...a, estado: 'listo', hasta: new Date().toISOString() } : a))
      }
    } else {
      orden.resultado = trabaja ? 'en-cola' : 'enviado'
      if (trabaja) s.enCola = (s.enCola ?? 0) + 1
      else Object.assign(s, { actividad: 'pensando', enTurno: true })
    }
  }

  /**
   * ?poses: una sesión por estado de Claude y un equipo con todo el elenco. "Listo" y "falló"
   * terminan siempre hace 1 s, así siguen festejando o tambaleándose (duran 6 s).
   */
  const sesionesPoses = () => {
    const recien = new Date(Date.now() - 1000).toISOString()
    const ses = (sesion, repo, actividad, extra = {}) => ({
      v: 1, sesion, usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando', repo, rama: 'main', tarea: null,
      inicio: hace(30), actualizado: hace(0), archivos: [], actividad, puedeResponder: true, agentes: [], ...extra,
    })
    return [
      ses('p-editando', 'quintechlab/poses', 'editando avis.js', { rama: 'feat/8-estilo-avis-avis', tarea: 8 }),
      ses('p-comando', 'quintechlab/poses', 'corriendo npm test'),
      ses('p-leyendo', 'quintechlab/poses', 'leyendo logica.js'),
      ses('p-pensando', 'quintechlab/poses', 'pensando'),
      ses('p-esperando', 'quintechlab/poses', 'esperándote'),
      ses('p-proceso', 'quintechlab/poses', 'esperando 1 proceso', { procesos: [{ id: 'bposes1', descripcion: 'Arma el instalador del widget', desde: hace(2) }] }),
      ses('p-inactiva', 'quintechlab/poses', 'editando main.js', { actualizado: hace(25) }),
      ses('e-equipo', 'quintechlab/elenco', 'lanzando Camila', {
        rama: 'feat/12-estilo-avis', tarea: 12,
        agentes: [
          sub('e1', 'Delfina', 'bocetos de los Avis', 'trabajando', { desde: hace(4) }),
          sub('e2', 'Ramiro', 'mapear el widget', 'trabajando', { tipo: 'Explore', desde: hace(2) }),
          sub('e3', 'Lucas', 'tests de poseAvi', 'listo', { hasta: recien }),
          sub('e4', 'Inés', 'revisar la CSP', 'fallo', { hasta: recien }),
          sub('e5', 'Camila', 'copy del aviso', 'listo', { hasta: hace(3) }),
        ],
      }),
      ses('e-dormidos', 'quintechlab/elenco', 'esperándote', {
        inicio: hace(50),
        agentes: [sub('e6', 'Camila', 'copy del vacío', 'listo', { hasta: hace(3) }), sub('e7', 'Pixel', 'revisar tamaños', 'fallo', { inventado: true, hasta: hace(8) })],
      }),
      ses('q-pregunta', 'quintechlab/pregunta', 'pensando', {
        preguntas: [{ id: 'toolu_poses', agente: null, desde: hace(1), items: [{ pregunta: '¿Probamos los Avis a 200 %?', encabezado: 'Zoom', multiple: false, opciones: [{ etiqueta: 'Sí (Recomendada)', descripcion: 'Se ven nítidos.' }, { etiqueta: 'No', descripcion: 'Alcanza con 100 %.' }] }] }],
      }),
    ]
  }

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

  // ?equipo y ?evol: la evolución de la mascota (docs/diseno/mascotas-avi-ux.md 6)
  const oficinaEquipo = SESIONES[0]
  const ponerEquipo = (s, n) => {
    const otros = s.agentes.filter(a => a.estado !== 'trabajando')
    const ya = s.agentes.filter(a => a.estado === 'trabajando')
    // Ids que no dependen de la hora: al recargar, cada subagente conserva su variante (7.3)
    const nuevos = Array.from({ length: Math.max(0, n - ya.length) }, (_, k) => sub(`eq-${s.sesion}-${s.agentes.length + k}`,['Bruno', 'Paula', 'Nahuel', 'Lola'][k % 4], 'tarea de prueba', 'trabajando', { desde: new Date().toISOString() }))
    const terminan = ya.slice(n).map(a => ({ ...a, estado: 'listo', hasta: new Date().toISOString() }))
    s.agentes = [...ya.slice(0, n), ...nuevos, ...terminan, ...otros]
    s.actividad = n ? 'lanzando subagentes' : 'esperándote'
  }
  if (url.has('equipo')) ponerEquipo(oficinaEquipo, Number(url.get('equipo')) || 0)
  for (let k = 0; k < (Number(url.get('evol')) || 0); k++) {
    SESIONES.push({
      ...oficinaEquipo, sesion: `ses-evol-${k + 1}`, repo: 'quintechlab/avis-evol', rama: `feat/${30 + k}-evol`, tarea: 30 + k, inicio: hace(40 - k), preguntas: [], conversa: [],
      agentes: [sub(`ev${k}`, ['Bruno', 'Paula', 'Nahuel'][k % 3], 'tarea en paralelo', 'trabajando', { desde: hace(2) })],
    })
  }
  // ?registro: anota en window.__registroEvo cada cambio de forma (`evol`) y cada acto que arranca (anime.js
  // escribe el estilo de `g.trans` o de `g.cambio`), con su hora y su figura, para medir la evolución
  if (url.has('registro')) {
    window.__registroEvo = []
    const figura = svg => `${svg.closest('#marca-avi') ? 'marca' : svg.closest('#muesca-avi') ? 'muesca' : svg.closest('#split-g') ? 'mitad' : svg.closest('#sesiones') ? 'tarjeta' : 'chica'}:${svg.dataset.evo}${svg.classList.contains('chica') ? ':chica' : ''}`
    addEventListener('DOMContentLoaded', () => new MutationObserver(cambios => {
      const t = Math.round(performance.now())
      for (const c of cambios) {
        const el = c.target
        if (c.attributeName === 'class' && el.matches?.('svg[data-evo]') && el.classList.contains('evol') !== c.oldValue?.split(' ').includes('evol')) {
          window.__registroEvo.push({ t, que: el.classList.contains('evol') ? 'evol+' : 'evol-', figura: figura(el) })
        }
        if (c.attributeName === 'style' && el.matches?.('g.trans, g.cambio') && !c.oldValue && el.getAttribute('style')) {
          window.__registroEvo.push({ t, que: el.matches('g.trans') ? 'acto' : 'vuelta', figura: figura(el.closest('svg')) })
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'style'] }))
  }

  /** Pone `n` subagentes a trabajar en una sesión (0: terminan todos). */
  window.__equipo = (n, sesion = 'ses-oficina') => {
    const s = SESIONES.find(x => x.sesion === sesion)
    if (s) ponerEquipo(s, n)
    return s?.agentes.filter(a => a.estado === 'trabajando').length
  }

  // ?estado: sin pregunta pendiente; en reposo, además, sin subagentes trabajando
  if (url.get('estado') === 'reposo' || url.get('estado') === 'trabajando') {
    for (const s of SESIONES) s.preguntas = []
    if (url.get('estado') === 'reposo') {
      for (const s of SESIONES) { s.agentes = s.agentes.filter(a => a.estado !== 'trabajando'); s.actividad = 'esperándote' }
    }
  }

  // ?dividida: dos sesiones que conversan (docs/diseno/dividida-ux.md 7). Se suman tienda-web y
  // api-pagos (y panel-admin en "dos" y "otro"); el primer proyecto a la vista es api-pagos (orden
  // alfabético). La conversación aparece en la segunda o tercera lectura (~2,5 s), así es "nueva".
  // Cada sesión anota solo los mensajes que recibe (de: 'otro'), como el mod v0.8.
  const dividida = url.get('dividida')
  if (dividida === 'vuelve') window.__esperaVuelta = 6000
  if (dividida) {
    const base = (sesion, repo, rama, tarea, extra = {}) => ({
      v: 1, sesion, usuario: 'nicoequintana', nombre: 'Quintana', estado: 'trabajando', repo, rama, tarea, nota: null,
      inicio: hace(70), tareaDesde: hace(70), actualizado: hace(0), archivos: [], actividad: 'esperándote', puedeResponder: true, agentes: [], ...extra,
    })
    SESIONES.push(
      base('ses-tienda', 'quintechlab/tienda-web', dividida === 'dos' ? 'feat/18-checkout-con-mercado-pago-y-cuotas' : 'feat/18-checkout', 18, {
        agentes: [sub('d1', 'Delfina', 'pantalla de pago', 'trabajando', { desde: hace(4) }), sub('d2', 'Lucas', 'tests del checkout', 'listo', { hasta: hace(6) })],
      }),
      base('ses-pagos', 'quintechlab/api-pagos', 'feat/7-webhooks', 7, {
        actividad: 'leyendo webhooks.ts',
        agentes: [
          sub('d3', 'Ramiro', 'mapear la API', 'trabajando', { tipo: 'Explore', desde: hace(3) }),
          sub('d4', 'Inés', 'revisar firmas', 'trabajando', { desde: hace(2) }),
          sub('d5', 'Camila', 'docs del webhook', 'listo', { hasta: hace(5) }),
        ],
      }),
    )
    if (dividida === 'dos' || dividida === 'otro') SESIONES.push(base('ses-admin', 'quintechlab/panel-admin', 'main', null, { actividad: 'editando roles.vue' }))
    if (dividida === 'sindatos') SESIONES.splice(SESIONES.findIndex(s => s.sesion === 'ses-tienda'), 1)
  }
  /** Momento `ms` después de abrir la vista (ISO). */
  const a = ms => new Date(ahora + ms).toISOString()
  const recibida = (con, conRepo, desde, cuando) => ({ con, conRepo, desde, empezo: 'otro', ultimo: { de: 'otro', cuando } })
  /** Las conversaciones de ?dividida según el tiempo que pasó desde que se abrió la vista. */
  const conDividida = lista => {
    if (!dividida || dividida === 'antes') return lista
    const t = Date.now() - ahora
    const ses = id => lista.find(s => s.sesion === id)
    const pone = (id, entrada) => { const s = ses(id); if (s) s.conversa = [...(s.conversa ?? []), entrada] }
    if (t < 2500) return lista
    const tienda = 'quintechlab/tienda-web', pagos = 'quintechlab/api-pagos', admin = 'quintechlab/panel-admin'
    if (dividida === 'aparece') pone('ses-pagos', recibida('ses-tienda', tienda, a(2500), a(2500)))
    if (dividida === 'pregunta' || dividida === 'responde' || dividida === 'dos') pone('ses-pagos', recibida('ses-tienda', tienda, hace(6), a(-40000)))
    if (dividida === 'responde' && t >= 7000) pone('ses-tienda', recibida('ses-pagos', pagos, a(7000), a(7000)))
    if (dividida === 'dos' && t >= 6000) pone('ses-admin', recibida('ses-tienda', tienda, a(6000), a(t >= 12000 ? 12000 : 6000)))
    // Termina a los ~6 s: el último mensaje fue hace casi 5 min
    if (dividida === 'termina' || dividida === 'vuelve') pone('ses-pagos', recibida('ses-tienda', tienda, hace(8), a(-5 * 60000 + 6000)))
    if (dividida === 'otro') pone('ses-admin', recibida('ses-tienda', tienda, a(2500), a(2500)))
    if (dividida === 'sindatos') pone('ses-pagos', recibida('ses-campos', tienda, hace(2), a(-15000)))
    return lista
  }

  let paso = PASOS.includes(Number(url.get('zoom'))) ? Number(url.get('zoom')) : chatEsc === 'encima' ? 200 : 100
  /** El iframe que hace de ventana (dev/vista.html); abierta sola, no hay. */
  const marco = window.frameElement
  if (marco) document.documentElement.classList.add('en-iframe')
  const BARRA = 40
  const area = () => marco
    ? { x: 0, y: 0, ancho: parent.innerWidth, alto: parent.innerHeight - BARRA }
    : { x: 0, y: 0, ancho: innerWidth, alto: innerHeight }
  // Como Rust al arrancar: la ventana ya es el área de trabajo del monitor
  const ventana = { ...area() }
  window.__ventana = { ...ventana }
  const [fx, fy] = (url.get('flotante') ?? '').split(',').map(Number)
  let flotante = Number.isFinite(fx) && Number.isFinite(fy) ? { x: fx, y: fy } : null
  // La hoja de la charla al costado: el tablero a la izquierda, salvo ?chat=encima
  if (chatEsc && !flotante && chatEsc !== 'encima') flotante = { x: 0.05, y: 0.4 }
  let mini = false
  const libres = { arriba: true, derecha: !url.has('sinderecha'), abajo: true, izquierda: true }
  /** Mueve y redimensiona el iframe como Tauri a la ventana. */
  const aplicar = () => {
    window.__ventana = { ...ventana }
    if (!marco) return
    Object.assign(marco.style, { left: `${ventana.x}px`, top: `${ventana.y}px`, width: `${ventana.ancho}px`, height: `${ventana.alto}px` })
  }
  aplicar()
  let acople = ['arriba', 'derecha', 'abajo', 'izquierda'].includes(url.get('acople'))
    ? { borde: url.get('acople'), lugar: url.has('lugar') ? Number(url.get('lugar')) : 0.5 }
    : null
  window.__acople = acople
  const oyentes = {}
  let lecturas = 0
  const emitir = (nombre, payload) => { for (const f of oyentes[nombre] ?? []) f({ payload }) }

  // ---- zona interactiva (9.6): imita el sondeo de Rust y el paso de los clics
  const zonaSt = { zona: null, toda: false, dentro: true, informado: false, n: 0, punto: null, desfase: null, mirada: false, cursor: null, cursorT: 0 }
  /** Como `debe_sondear`: en todas las formas mientras se ve (la vista no se esconde). */
  const sondea = () => true
  /** Como `evaluar`: sin zona o arrastrando cuenta como adentro; el borde derecho y el de abajo, afuera. */
  const adentro = p => {
    const z = zonaSt.zona
    if (zonaSt.toda || !z || !p) return true
    return p.x >= z.x && p.x < z.x + z.ancho && p.y >= z.y && p.y < z.y + z.alto
  }
  const evaluarZona = () => {
    if (!marco) return
    if (!sondea()) { zonaSt.informado = false; marco.style.pointerEvents = ''; return }
    if (!zonaSt.punto) return
    const d = adentro(zonaSt.punto)
    // Como Rust: con zona, avisa cada cambio y, una vez, el primer estado tras una zona nueva
    if (zonaSt.zona && (d !== zonaSt.dentro || !zonaSt.informado)) {
      zonaSt.n++
      zonaSt.informado = true
      emitir('oficina://puntero-zona', { dentro: d, n: zonaSt.n })
    }
    zonaSt.dentro = d
    // Fuera de la zona, el clic pasa al escritorio (vista.html)
    marco.style.pointerEvents = d ? '' : 'none'
    window.__puntero = { ...zonaSt.punto, dentro: d }
    // Como cursor_para_mirada: con mirada, la posición si cambió y a lo sumo cada 50 ms
    const p = zonaSt.punto, t = performance.now()
    if (zonaSt.mirada && (p.x !== zonaSt.cursor?.x || p.y !== zonaSt.cursor?.y) && t - zonaSt.cursorT >= 50) {
      zonaSt.cursor = { ...p }
      zonaSt.cursorT = t
      emitir('oficina://cursor', { x: p.x, y: p.y })
    }
  }
  if (marco) {
    // La "pantalla" son los px del escritorio (vista.html). screenX no cambia con el zoom del widget:
    // el desfase entre screenX y clientX del escritorio pasa los puntos del iframe a la pantalla
    parent.document.addEventListener('pointermove', e => {
      zonaSt.desfase = { x: e.screenX - e.clientX, y: e.screenY - e.clientY }
      zonaSt.punto = { x: e.clientX, y: e.clientY }
      evaluarZona()
    })
    document.addEventListener('pointermove', e => {
      zonaSt.punto = zonaSt.desfase
        ? { x: e.screenX - zonaSt.desfase.x, y: e.screenY - zonaSt.desfase.y }
        : { x: ventana.x + e.clientX, y: ventana.y + e.clientY }
      evaluarZona()
    })
  }

  // ---- primeros pasos: la máquina falsa y los pasos que corren
  const pp = url.get('pp')
  const maquina = {
    claude: !['nada', 'sinclaude'].includes(pp),
    catalogo: !['sinmod'].includes(pp),
    mod: pp === 'sinmod' || pp === 'nada' || pp === 'sinclaude' ? 'ausente' : pp === 'apagado' ? 'apagado' : 'activo',
    gh: !['nada', 'singh', 'sinwinget'].includes(pp),
    winget: pp !== 'sinwinget',
    cuenta: ['nada', 'singh', 'sinwinget', 'sinsesion'].includes(pp) ? 'sin-sesion' : pp === 'sinred' ? 'sin-conexion' : 'conectada',
    faltan: pp === 'sinpermiso' ? ['project'] : [],
    membresia: pp === 'nomiembro' ? 'no-miembro' : pp === 'invitacion' ? 'pendiente' : 'activa',
  }
  let fallaPendiente = url.get('ppfalla')
  const revisionFalsa = () => ({
    claude: { encontrado: maquina.claude, version: maquina.claude ? '2.1.329' : null },
    mod: maquina.claude
      ? { instalado: maquina.mod !== 'ausente', activo: maquina.mod === 'activo', version: maquina.mod === 'ausente' ? null : '0.6.0', catalogo: maquina.catalogo, error: null }
      : { instalado: false, activo: false, version: null, catalogo: false, error: null },
    gh: { instalado: maquina.gh, version: maquina.gh ? '2.103.3' : null, winget: !maquina.gh && maquina.winget },
    cuenta: maquina.gh
      ? { estado: maquina.cuenta, login: maquina.cuenta === 'sin-sesion' ? null : 'nicoequintana', faltan: maquina.faltan, error: maquina.cuenta === 'sin-conexion' ? 'error connecting to api.github.com (falso)' : null, comando: 'gh auth status --hostname github.com --active --json hosts' }
      : { estado: 'sin-gh', login: null, faltan: [], error: null, comando: 'gh auth status --hostname github.com --active --json hosts' },
    membresia: maquina.gh && maquina.cuenta === 'conectada' && !maquina.faltan.length
      ? { estado: maquina.membresia, error: null, comando: 'gh api user/memberships/orgs/quintechlab' }
      : null,
  })
  let relojesPaso = []
  let corriendo = null
  // El mod automático (#17): el aviso pendiente que la ventana toma una vez (tomar_aviso_mod)
  const modauto = url.get('modauto')
  let avisoModPendiente = modauto === 'instalo' ? { tipo: 'instalo', version: '0.9.1' }
    : modauto === 'actualizo' ? { tipo: 'actualizo', version: '0.9.1', desde: '0.9.0' } : null
  const despues = (ms, f) => relojesPaso.push(setTimeout(f, ms))
  const avisarPaso = (accion, cuerpo) => emitir('oficina://primeros-pasos', { accion, paso: ['mod', 'activar'].includes(accion) ? 'mod' : 'gh', ...cuerpo })
  const terminar = (accion, cuerpo) => { corriendo = null; relojesPaso = []; avisarPaso(accion, cuerpo) }
  /** Corre un paso falso: los comandos de 9.2, uno por vez, con sus avisos y su final. */
  const correrFalso = accion => {
    const falla = fallaPendiente === accion || (fallaPendiente === 'conectar' && accion === 'permiso')
    if (falla) fallaPendiente = null
    if (accion === 'mod' || accion === 'activar') {
      const lista = accion === 'activar' ? ['claude plugin enable oficina@quintech']
        : [...(maquina.catalogo ? [] : ['claude plugin marketplace add quintechlab/oficina']), 'claude plugin install oficina@quintech']
      lista.forEach((c, k) => {
        despues(k * 1100 + 100, () => avisarPaso(accion, { estado: 'comando', comando: c }))
        if (falla && k === lista.length - 1) {
          despues(k * 1100 + 1000, () => terminar(accion, { estado: 'error', comando: c, linea: 'Error: getaddrinfo ENOTFOUND github.com', detalle: 'Error: getaddrinfo ENOTFOUND github.com\n    at GetAddrInfoReqWrap.onlookup (falso)', red: true, permiso: false }))
        } else {
          despues(k * 1100 + 1000, () => avisarPaso(accion, { estado: 'comando-hecho', comando: c }))
        }
      })
      if (!falla) {
        despues(lista.length * 1100 + 100, () => {
          maquina.catalogo = true
          maquina.mod = 'activo'
          terminar(accion, { estado: 'listo' })
        })
      }
    } else if (accion === 'gh') {
      const c = 'winget install --id GitHub.cli -e'
      despues(100, () => avisarPaso(accion, { estado: 'comando', comando: c }))
      despues(2400, () => {
        if (falla) return terminar(accion, { estado: 'error', comando: c, linea: 'Installer failed with exit code: 0x800704c7 : The operation was canceled by the user.', detalle: 'Installer failed with exit code: 0x800704c7 : The operation was canceled by the user.', red: false, permiso: true })
        maquina.gh = true
        terminar(accion, { estado: 'listo' })
      })
    } else {
      const c = accion === 'permiso' ? 'gh auth refresh --hostname github.com --scopes repo,read:org,project' : 'gh auth login --hostname github.com --web --git-protocol https --skip-ssh-key --scopes repo,read:org,project'
      despues(100, () => avisarPaso(accion, { estado: 'comando', comando: c }))
      if (falla) return despues(900, () => terminar(accion, { estado: 'error', comando: c, linea: 'HTTP 502: Bad Gateway (https://github.com/login/device/code)', detalle: 'HTTP 502: Bad Gateway (falso)', red: false, permiso: false }))
      despues(900, () => {
        avisarPaso(accion, { estado: 'codigo', codigo: '4F2A-91C7' })
        console.info('[navegador] https://github.com/login/device (falso)')
      })
      if (url.has('ppvence')) despues(5000, () => terminar(accion, { estado: 'vencido' }))
      else {
        despues(6000, () => {
          maquina.cuenta = 'conectada'
          maquina.faltan = []
          terminar(accion, { estado: 'listo' })
        })
      }
    }
  }

  // ?pp=sinmod&modauto=solo: Avis instala el mod solo, como mod_auto.rs (el paso 2 corre sin clic)
  if (modauto === 'solo' && maquina.claude && maquina.mod === 'ausente') {
    setTimeout(() => {
      if (corriendo) return
      corriendo = 'mod'
      emitir('oficina://mod-auto', { estado: 'empieza', accion: 'mod' })
      correrFalso('mod')
      setTimeout(() => { avisoModPendiente = { tipo: 'instalo', version: '0.9.1' }; emitir('oficina://mod-auto', { estado: 'aviso' }) }, 4000)
    }, 1500)
  }

  // ---- la charla con la mascota (#22): el modelo de esta PC falso y el proceso de Claude Code falso
  const GB = 1024 ** 3
  const TOTAL_MODELO = Math.round(2.6 * GB)
  const modeloLocal = {
    modelo: url.get('modelo') === 'listo' || chatEsc === 'error-red' ? 'listo' : url.get('modelo') === 'bajando' ? 'bajando' : 'falta',
    bajado: url.get('modelo') === 'bajando' ? Math.round(0.4 * GB) : 0,
    total: TOTAL_MODELO, motor: 'apagado', primeraVez: true, aceleracion: 'gpu',
  }
  if (modeloLocal.modelo === 'listo') modeloLocal.bajado = TOTAL_MODELO
  let relojesModelo = []
  const emitirModelo = (tipo, datos = {}) => emitir('oficina://modelo', { tipo, ...datos })
  const bajarModelo = () => {
    const tic = () => {
      modeloLocal.bajado = Math.min(TOTAL_MODELO, modeloLocal.bajado + TOTAL_MODELO / 30)
      if (modeloLocal.bajado >= TOTAL_MODELO) { modeloLocal.modelo = 'listo'; return emitirModelo('bajado', { total: TOTAL_MODELO }) }
      emitirModelo('progreso', { bajado: Math.round(modeloLocal.bajado), total: TOTAL_MODELO })
      relojesModelo.push(setTimeout(tic, 250))
    }
    relojesModelo.push(setTimeout(tic, 250))
  }
  if (modeloLocal.modelo === 'bajando') bajarModelo()
  /** "Borrar el modelo" de la bandeja (lo hace el backend): avisa que no hay modelo. */
  window.__borrarModelo = () => {
    relojesModelo.forEach(clearTimeout)
    Object.assign(modeloLocal, { modelo: 'falta', bajado: 0 })
    emitirModelo('estado', { ...modeloLocal })
  }

  const ESCRITORIO = 'C:\\Users\\quintana\\Desktop'
  const DESCARGAS = 'C:\\Users\\quintana\\Downloads'
  /** Lo que diría chat_adjunto de un archivo (10): por el nombre, sin leer nada. */
  function adjuntoFalso(ruta) {
    const nombre = ruta.split(/[\\/]/).at(-1)
    const ext = (/\.([^.]+)$/.exec(nombre)?.[1] ?? '').toLowerCase()
    if (/grande/.test(nombre)) return { error: 'adjunto', nombre }
    if (ext === 'pdf') return { nombre, tipo: 'pdf', bytes: 1468006, paginas: 14 }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { nombre, tipo: 'imagen', bytes: 245760, paginas: null }
    if (['txt', 'md', 'json', 'csv', 'js', 'ts', 'rs', 'py', 'log'].includes(ext)) return { nombre, tipo: 'texto', bytes: 3200, paginas: null }
    return { error: 'adjunto', nombre }
  }
  let prefsChat = {
    motor: url.get('motor') === 'local' ? 'local' : 'claude',
    carpeta: url.has('sinCarpeta') ? null : `${ESCRITORIO}\\catalogo`,
    recientes: [`${ESCRITORIO}\\catalogo`, 'C:\\Users\\quintana\\Downloads'],
  }
  const conocidas = new Map()
  let enCurso = null
  /** El historial falso (9.1): los archivos de `<config>/chat/<id>.json`, en memoria. */
  const ayer = new Date(Date.now() - 26 * 3600 * 1000).toISOString()
  const archivos = new Map([['c-falsa-ayer', {
    v: 1, id: 'c-falsa-ayer', titulo: 'Qué cambió en catalogo', creada: ayer, actualizada: ayer, motor: 'claude', carpeta: `${ESCRITORIO}\\catalogo`, sesionClaude: null, engramId: null,
    mensajes: [
      { rol: 'usuario', texto: '¿Qué cambió ayer en catalogo?', cuando: ayer, estado: 'ok', adjuntos: [] },
      { rol: 'mascota', texto: 'Se sumó el **filtro por marca** y se arregló el pedido duplicado.', cuando: ayer, estado: 'ok', herramientas: [{ nombre: 'Grep', detalle: 'filtro' }], ms: 2400 },
    ],
  }]])
  const emitirChat = (c, turno, tipo, datos = {}) => emitir('oficina://chat', { conversacion: c, turno, tipo, ...datos })
  const RESPUESTA = [
    'Tenés **3 sesiones** abiertas. Esto es lo importante:', '',
    '## En qué anda cada una', '',
    '- **oficina**: Claude coordina a Delfina, Ramiro y Lucas (`feat/6-estilo-avis-marco`).',
    '- **catalogo**: te hace una pregunta sobre el *merge*.',
    '  - Espera tu respuesta desde hace 3 min.',
    '- **central-nucleo**: espera dos procesos en segundo plano.', '',
    'Para mirar la rama de oficina:', '',
    '```bash', 'git log --oneline -3 feat/6-estilo-avis-marco', '```', '',
    '| Sesión | Estado |', '|---|---|', '| oficina | trabajando |', '| catalogo | te espera |', '',
    'Más en [la guía](https://ejemplo.dev/guia). Nada de HTML: <img src=x onerror="alert(1)">.',
  ].join('\n')
  const trozos = t => t.match(/[\s\S]{1,14}/g) ?? []
  /** El turno falso: como Rust, `listo` (el init), `pidiendo`, herramientas, texto de a tramos y un final. */
  function turnoFalso(c, turno, texto) {
    const relojes = []
    enCurso = { c, turno, relojes }
    const luego = (ms, f) => relojes.push(setTimeout(f, ms))
    const terminar = () => { if (enCurso?.turno === turno && enCurso.c === c) enCurso = null }
    const rapido = chatEsc === 'historial'
    luego(80, () => emitirChat(c, turno, 'recibido'))
    luego(rapido ? 120 : 420, () => emitirChat(c, turno, 'listo', { sesion: conocidas.get(c).sesion }))
    luego(rapido ? 160 : 900, () => emitirChat(c, turno, 'pidiendo'))
    if (chatEsc === 'esperando') return
    if (chatEsc === 'error-red') {
      // D33: el tercer reintento sin respuesta es el error `red`
      for (const k of [1, 2, 3]) luego(900 + k * 900, () => emitirChat(c, turno, 'reintento', { intento: k, maximo: 10 }))
      luego(3700, () => { emitirChat(c, turno, 'error', { motivo: 'red' }); terminar() })
      return
    }
    const respuesta = rapido ? `Sobre «${texto}»: todo tranquilo por ahora.` : RESPUESTA
    let t = rapido ? 200 : 1300
    if (!rapido) {
      luego(1100, () => emitirChat(c, turno, 'herramienta', { nombre: 'Read', detalle: 'README.md' }))
      luego(1200, () => emitirChat(c, turno, 'herramienta', { nombre: 'Grep', detalle: 'merge' }))
    }
    const lento = chatEsc === 'escribiendo' ? 420 : rapido ? 15 : 70
    for (const p of trozos(respuesta)) luego((t += lento), () => emitirChat(c, turno, 'texto', { texto: p }))
    if (chatEsc === 'escribiendo') return
    luego(t + 120, () => { emitirChat(c, turno, 'fin', { ms: t + 120 }); terminar() })
  }
  /**
   * El turno del modelo de esta PC (8), como Rust: `listo` cuando despertó el motor (1,2 s la primera
   * vez), `recibido` con el pedido aceptado, `pensando` con el primer tramo y el texto de a tramos.
   * Con ?chat=esperando no responde; con ?chat=escribiendo no termina. Usa la historia que llega.
   */
  let motorDespierto = false
  function turnoLocalFalso(c, turno, texto, historia) {
    const relojes = []
    enCurso = { c, turno, relojes }
    const luego = (ms, f) => relojes.push(setTimeout(f, ms))
    const despierta = motorDespierto ? 60 : 1200
    luego(despierta, () => { motorDespierto = true; emitirChat(c, turno, 'listo', { sesion: '' }) })
    if (chatEsc === 'esperando') return
    luego(despierta + 30, () => emitirChat(c, turno, 'recibido'))
    luego(despierta + 600, () => emitirChat(c, turno, 'pensando'))
    const antes = (historia ?? []).filter(m => m.rol === 'usuario').length
    const respuesta = `Sobre «${texto}»: **oficina** está trabajando y **catalogo** te hace una pregunta.${antes ? ` (Me acuerdo de ${antes} ${antes === 1 ? 'pregunta' : 'preguntas'} de antes.)` : ''}`
    let t = despierta + 600
    const lento = chatEsc === 'escribiendo' ? 420 : 45
    for (const p of trozos(respuesta)) luego((t += lento), () => emitirChat(c, turno, 'texto', { texto: p }))
    if (chatEsc === 'escribiendo') return
    luego(t + 80, () => { emitirChat(c, turno, 'fin', { ms: t + 80 }); if (enCurso?.turno === turno && enCurso.c === c) enCurso = null })
  }
  const comandosChat = {
    estado_modelo: () => ({ ...modeloLocal, bajado: Math.round(modeloLocal.bajado) }),
    descargar_modelo: () => {
      if (modeloLocal.modelo === 'bajando') throw new Error('ya se está bajando (falso)')
      modeloLocal.modelo = 'bajando'
      bajarModelo()
    },
    cancelar_modelo: () => {
      relojesModelo.forEach(clearTimeout)
      if (modeloLocal.modelo === 'bajando') modeloLocal.modelo = 'falta'
      emitirModelo('cancelado', {})
    },
    chat_abrir: ({ conversacion, motor, sesionClaude }) => {
      const antes = conocidas.get(conversacion)
      const sesion = antes?.sesion ?? sesionClaude ?? crypto.randomUUID()
      conocidas.set(conversacion, { motor, sesion })
      console.info('[chat] abrir', conversacion, motor)
      const local = { listo: 'instalado', bajando: 'bajando', roto: 'roto' }[modeloLocal.modelo] ?? 'falta'
      return { proceso: motor === 'claude' ? 'arrancando' : 'apagado', sesion, engram: url.has('engram') ? 'si' : 'no', local }
    },
    chat_enviar: ({ conversacion, turno, texto, adjuntos = [], historia = null }) => {
      const c = conocidas.get(conversacion)
      if (!c) throw new Error('la charla no está abierta')
      if (enCurso?.c === conversacion) throw new Error('hay una respuesta en curso')
      console.info('[chat] enviar', conversacion, turno, texto, adjuntos, historia)
      if (c.motor === 'local') {
        if (adjuntos.length) throw new Error('el modelo de esta PC no lee archivos')
        if (modeloLocal.modelo !== 'listo') return setTimeout(() => emitirChat(conversacion, turno, 'error', { motivo: 'local', detalle: 'falta descargar el modelo de esta PC' }), 30)
        return turnoLocalFalso(conversacion, turno, texto, historia)
      }
      turnoFalso(conversacion, turno, texto)
    },
    chat_frenar: ({ conversacion, turno }) => {
      if (enCurso?.c !== conversacion || enCurso.turno !== turno) return
      enCurso.relojes.forEach(clearTimeout)
      enCurso = null
      setTimeout(() => emitirChat(conversacion, turno, 'frenada'), 10)
    },
    chat_cerrar: () => null,
    chat_guardar: ({ conversacion, engram }) => {
      const antes = archivos.get(conversacion.id)
      archivos.set(conversacion.id, { ...conversacion, engramId: antes?.engramId ?? (engram && url.has('engram') ? archivos.size + 1 : null) })
      console.info('[chat] guardar', conversacion.id, conversacion.mensajes.length, engram ? '+ engram' : '')
    },
    chat_historial: () => [...archivos.values()].sort((a, b) => Date.parse(b.actualizada) - Date.parse(a.actualizada))
      .map(({ mensajes, ...cab }) => ({ ...cab, texto: mensajes.map(m => m.texto).filter(Boolean).join('\n') })),
    chat_leer: ({ id }) => {
      const doc = archivos.get(id)
      if (!doc) throw new Error('no existe (falso)')
      return structuredClone(doc)
    },
    chat_borrar: ({ id }) => { archivos.delete(id); console.info('[chat] borrar', id) },
    guardar_chat: ({ motor, carpeta }) => {
      prefsChat = { motor, carpeta: carpeta ?? null, recientes: carpeta ? [carpeta, ...prefsChat.recientes.filter(r => r !== carpeta)].slice(0, 5) : prefsChat.recientes }
      console.info('[chat] preferencias', JSON.stringify(prefsChat))
      return prefsChat
    },
    elegir_carpeta: () => (url.has('cancelaCarpeta') ? null : `${ESCRITORIO}\\quintech-crm`),
    chat_adjunto: ({ ruta }) => adjuntoFalso(ruta),
    elegir_adjuntos: () => (url.has('cancelaAdjunto') ? [] : [`${DESCARGAS}\\presupuesto-2027.pdf`]),
  }
  /** Suelta archivos en el medio de la hoja, como Tauri: enter, over y drop en px físicos. */
  window.__soltarEnHoja = (rutas, { soltar = true } = {}) => {
    const r = document.querySelector('#hoja')?.getBoundingClientRect()
    if (!r || !window.__arrastrar) return
    const position = { x: (r.left + r.width / 2) * devicePixelRatio, y: (r.top + r.height / 2) * devicePixelRatio }
    window.__arrastrar({ type: 'enter', paths: rutas, position })
    window.__arrastrar({ type: 'over', position })
    if (soltar) setTimeout(() => window.__arrastrar({ type: 'drop', paths: rutas, position }), 700)
  }
  // ?chat=…: abre la hoja y la lleva a ese estado por el mismo camino que el usuario (window.__chat)
  window.__vistaDev = true
  if (chatEsc) {
    setTimeout(() => {
      const ch = window.__chat
      if (!ch) return
      // Acoplada, primero se abre el panel (la marca solo se ve con el panel abierto)
      if (acople) emitir('oficina://abrir')
      document.querySelector('#marca-boton')?.click()
      const preguntar = t => ch.despachar({ tipo: 'enviar', texto: t })
      const cuandoListo = f => { const r = setInterval(() => { if (ch.estado().estado === 'listo') { clearInterval(r); f() } }, 100) }
      switch (chatEsc) {
        case 'esperando': case 'escribiendo': case 'listo': case 'error-red':
          preguntar('¿En qué anda cada sesión?')
          break
        case 'frenada':
          preguntar('Armame la documentación de catalogo')
          setTimeout(() => ch.despachar({ tipo: 'frenar' }), 2600)
          break
        case 'historial':
          preguntar('¿Quién me está esperando?')
          cuandoListo(() => {
            ch.despachar({ tipo: 'nueva' })
            preguntar('¿Qué cambió hoy en catalogo?')
            cuandoListo(() => ch.despachar({ tipo: 'hist' }))
          })
          break
        case 'soltar':
          ch.despachar({ tipo: 'soltando', nombre: 'presupuesto-2027.pdf' })
          break
        // Después de la mudanza (6.1), como el usuario: arrastrar y soltar sobre la hoja
        case 'adjuntos':
          setTimeout(() => window.__soltarEnHoja([`${DESCARGAS}\\presupuesto-2027.pdf`, `${DESCARGAS}\\notas.md`]), 1300)
          break
        case 'error-adjunto':
          setTimeout(() => window.__soltarEnHoja([`${DESCARGAS}\\planilla.xlsx`]), 1300)
          break
      }
    }, 1500)
  }

  const comandos = {
    ...comandosChat,
    registrar: ({ linea }) => console.debug('[widget.log]', linea),
    revisar_primeros_pasos: () => new Promise(r => setTimeout(() => r(revisionFalsa()), url.has('pplento') ? 2000 : 600)),
    menu_primeros_pasos: ({ faltan }) => { window.__menuPasos = faltan == null || faltan === 0 ? 'Primeros pasos…' : faltan === 1 ? 'Primeros pasos (falta 1)…' : `Primeros pasos (faltan ${faltan})…`; console.info('[bandeja]', window.__menuPasos) },
    correr_paso: ({ paso }) => {
      if (corriendo) throw new Error('ya corre otro paso (falso)')
      if (!['mod', 'activar', 'gh', 'conectar', 'permiso'].includes(paso)) throw new Error('paso desconocido')
      corriendo = paso
      console.info('[paso]', paso)
      correrFalso(paso)
    },
    cancelar_paso: () => {
      if (corriendo !== 'conectar' && corriendo !== 'permiso') return false
      const accion = corriendo
      relojesPaso.forEach(clearTimeout)
      terminar(accion, { estado: 'cancelado' })
      return true
    },
    abrir_enlace: ({ cual }) => console.info('[navegador]', cual),
    tomar_aviso_mod: () => { const a = avisoModPendiente; avisoModPendiente = null; return a },
    poner_bandeja: ({ texto }) => { document.title = texto },
    estado_menu: () => ({ arriba: true, avisar: true, pausa: url.has('pausa'), tamano: paso, acople, flotante, chat: prefsChat }),
    // Como Rust (leer_mascota): lo que no es una especie es el Avi; la ventana lo valida otra vez
    mascota: () => (['avi', 'ascua', 'escarcha', 'nodo', 'bruma', 'morro', 'lumen'].includes(url.get('mascota')) ? url.get('mascota') : 'avi'),
    leer_sesiones: () => {
      lecturas++
      if (url.has('cargando')) return new Promise(() => {})
      if (url.has('error') && lecturas > 1) throw new Error('acceso denegado a sesiones (falso)')
      if (url.has('poses')) return sesionesPoses()
      return url.has('vacio') ? [] : conDividida(sinTomadas())
    },
    leer_equipo: () => url.has('sinequipo') ? { comentarios: [], yo: 'nicoequintana', error: 'gh: no autenticado (falso)' } : EQUIPO,
    geometria: () => ({ ...ventana, area: area(), libres }),
    ajustar_ventana: ({ ancho, alto, x, y }) => {
      Object.assign(ventana, { ancho, alto, x, y })
      aplicar()
      console.info(`[ventana] ${ancho} × ${alto} en ${x}, ${y}`)
    },
    guardar_flotante: ({ x, y }) => {
      flotante = { x, y }
      window.__flotante = flotante
      console.info('[flotante]', JSON.stringify(flotante))
    },
    guardar_acople: ({ borde, lugar }) => {
      acople = borde ? { borde, lugar } : null
      window.__acople = acople
      console.info('[acople]', JSON.stringify(acople))
      // Como olvidar_zona: la zona vieja no vale; flotando, la ventana vuelve a tomar todos los clics
      Object.assign(zonaSt, { zona: null, toda: false, informado: false, mirada: false })
      evaluarZona()
    },
    zona_interactiva: ({ x, y, ancho, alto, toda, mirada }) => {
      zonaSt.zona = { x, y, ancho, alto }
      zonaSt.toda = !!toda
      zonaSt.mirada = !!mirada
      if (!mirada) zonaSt.cursor = null
      zonaSt.informado = false
      window.__zona = { ...zonaSt.zona, toda: zonaSt.toda }
      // Como Rust: devuelve si el puntero está adentro ahora; el aviso lo da el "sondeo"
      const d = adentro(zonaSt.punto)
      setTimeout(evaluarZona, 0)
      return d
    },
    cambiar_tamano: ({ direccion }) => {
      const k = PASOS.indexOf(paso)
      paso = direccion === 0 ? 100 : PASOS[Math.max(0, Math.min(PASOS.length - 1, k + direccion))]
      for (const f of oyentes['oficina://tamano'] ?? []) f({ payload: paso })
    },
    fijar_arriba: () => null,
    // La tira es un elemento adentro de la ventana: Rust solo anota el modo (segundo arranque)
    modo_mini: args => {
      mini = !!args.mini
      window.__mini = mini
      console.info('[tira]', mini)
    },
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
    // Órdenes (#19): según ?orden, la sesión la toma en 1,2 s, nunca (muda), no pudo (fallo) o el comando falla (error)
    ordenar: ({ sesion, tipo, texto }) => {
      console.info('[ordenar]', JSON.stringify({ sesion, tipo, texto }))
      const previa = ordenesFalsas.get(sesion)
      if (url.get('orden') === 'error' || (previa && !previa.consumida)) throw 'todavía hay una orden pendiente'
      const id = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')
      const orden = { id, tipo, consumida: false }
      ordenesFalsas.set(sesion, orden)
      if (url.get('orden') !== 'muda') setTimeout(() => tomarOrden(sesion, orden), 1200)
      return id
    },
    estado_orden: ({ sesion, id }) => {
      const o = ordenesFalsas.get(sesion)
      if (!o || o.id !== id) return { estado: 'ausente' }
      return o.consumida ? { estado: 'consumida', resultado: o.resultado, motivo: o.motivo ?? null } : { estado: 'pendiente' }
    },
    borrar_orden: ({ sesion }) => { ordenesFalsas.delete(sesion) },
  }

  /** Imita un evento del menú de la bandeja, p. ej. __bandeja('oficina://acoplar', 'derecha'). */
  window.__bandeja = emitir

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
    // Los archivos que se arrastran (10): window.__arrastrar(payload) hace de Tauri
    webview: {
      getCurrentWebview: () => ({
        onDragDropEvent: async f => {
          window.__arrastrar = payload => f({ payload })
          return () => { window.__arrastrar = null }
        },
      }),
    },
  }
})()
