// Tauri falso para ver el widget en un navegador (solo desarrollo; no entra en la app porque
// frontendDist apunta a ../src). Script clásico: corre antes que los módulos, así main.js ya
// encuentra window.__TAURI__ al cargarse.
//
// Parámetros de la URL de vista.html:
//   ?vacio        sin sesiones (estado vacío)
//   ?cargando     la primera lectura no termina nunca ("Buscando sesiones…")
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
//   ?sincerrar    ninguna sesión se puede cerrar (mod anterior a la v0.11). Sin él, central-nucleo y
//                 catalogo son de terminal ("Cerrar sesión"; al confirmar, la tarjeta se va a los 2 s) y
//                 oficina es de la app de escritorio (sin el botón) (#25)
//   ?historial=lento|vacio|error  "Qué hizo" (#25): la lectura tarda 2 s, no hay conversación, o falla.
//                 Sin él, catalogo y oficina muestran una conversación y central-nucleo está vacía
//   ?procesos     central-nucleo espera dos procesos en segundo plano (pose "proceso", v0.6)
//   ?escena=dos   oficina con 2 subagentes (uno trabaja, uno terminó); ?escena=doble: oficina con dos
//                 sesiones de un subagente cada una (panel-avis-ux.md, casos A y C del boceto). Sin
//                 ?escena, oficina tiene 5 (caso B: 3 y la pila "+2") y central-nucleo ninguno
//   ?poses        recorre los Avis: "poses" tiene una sesión por estado de Claude (editando,
//                 comando, leyendo, pensando, esperándote, proceso, inactiva); "elenco" coordina a los cinco
//                 subagentes (escribiendo, leyendo, listo y falló recién, dormido; 4 fichas y "+1")
//   ?pausa        arranca con "Pausar animaciones" marcado, como desde la bandeja
// Configuración (#23, docs/diseno/configuracion-ux.md): la fila "Configuración" de la barra, Ctrl , o
//   ?cfg=panel    abre la configuración al arrancar en esa pestaña (mascota, panel, modelos, datos,
//                 instalacion), como "Configuración…" de la bandeja (window.__bandeja('oficina://configuracion', { abrir: true }))
//   &arranque     "Arrancar con Windows" ya prendido   &arranquefalla  el sistema no deja cambiarlo
//   &cfgfalla     guardar_ajuste falla: el interruptor (o la especie) vuelve y dice "No se pudo guardar. Probá de nuevo."
//   ?cfg=mascota  la pestaña Mascota: elegir una especie cambia toda la ventana; "Base · {evo}" corre el acto
//                 (con ?pausa o movimiento reducido, al instante)
//   ?cfg=instalacion&mod=al-dia|actualizado|apagado|instalando|fallo|sin-claude|sin-instalar  la tarjeta
//                 "Mod de Claude Code" (7.3): estado_mod falso, con la última revisión y el aviso de una vez;
//                 instalando no termina nunca (para mirarlo). "Prender" corre el paso activar falso
//   ?cfg=modelos&modelo=falta|bajando|listo|roto  la tarjeta del modelo local (7.2), el mismo modelo falso
//                 del chat (bajando avanza solo). &borrarfalla: borrar_modelo falla
//   ?cfg=modelos&clave=sin|guardada  las claves de API (7.1): ninguna o las tres (sin ?clave, Claude y
//                 Gemini). Probar responde válida (Gemini, rechazada) o lo de &probar=valida|rechazada|sin-red|otro;
//                 &clavelenta tarda 4 s; &clavefalla: Windows no deja guardar (windows:1312); &borrarfalla, borrar
//   ?cfg=datos&historial=muchas  el historial del chat (7.4) con 24 charlas falsas más las del chat falso;
//                 "Borrar todo" tarda 0,9 s; &borrarfalla deja 3 sin borrar ("Reintentar")
//   Lo guardado queda en window.__ajustes.
// Módulos (#42, docs/diseno/modulos-ux.md, entrega M1): el menú de la barra (Sesiones, Tareas, Configuración).
//   ?modulo=tareas|config  abre ese módulo a los 0,9 s con el clic en su fila (como el usuario). La pregunta
//                 de catalogo sigue pendiente: se ve en el «1 ?» de Sesiones, en #aviso-p y en la marca
//   ?pregunta=llega  la pregunta de catalogo llega a los 4 s y se queda (el «1 ?» late y #aviso-p baja);
//                 con ?modulo=…, se ve llegar desde ese módulo
// Tareas (#39, docs/diseno/tareas-ux.md): la fila "Tareas" de la barra, Ctrl T o ?tareas=… abren la hoja.
//   Sin ?tareas, las cuatro listas del boceto (Trabajo, Casa, Compras y Facturación, con fechas contadas
//   desde hoy en Argentina) y la hoja cerrada: la fila muestra la cuenta. Con ?tareas, la hoja se abre
//   sola a los 0,9 s por el mismo clic del usuario y va a la vista del caso:
//   ?tareas=hoy        Hoy (de todas las listas, importantes primero) y su avance
//   ?tareas=vencidas   Vencidas, la más vieja primero
//   ?tareas=lista      la lista Trabajo, con "Renombrar", "Borrar lista" y "Hechas · 1"
//   ?tareas=primer     sin listas: el primer uso ("Armá tu primera lista")
//   ?tareas=vacia      Ideas (vacía) y Casa con una tarea para mañana: "Listo por hoy." · "Mañana: 1 tarea."
//   ?tareas=roto       un archivo que no se pudo leer (7.6): su fila en el índice y su error con "Abrir la carpeta"
//   ?tareas=guardarfalla  tareas_guardar falla siempre: el primer cambio muestra "No se guardó el último cambio." (7.4)
//   ?tareas=tarea      la tarea abierta (4.7): "Revisar el PR #36" de Trabajo, con fecha de hoy, importante,
//                      tres subtareas (una hecha) y notas; "‹ Hoy" vuelve
//   ?tareas=moverfalla la misma tarea abierta, pero guardar Casa falla siempre: moverla a Casa muestra el error
//                      de 7.4 y Trabajo no se guarda (la tarea sigue en su archivo: duplicada, nunca perdida)
//   &tareaslento       tareas_leer tarda 1,2 s (las filas fantasma de 7.1)
//   Lo guardado queda en window.__tareas (un Map por id de lista). Cada guardado se anota en
//   window.__guardadasTareas ([id, n.º de tareas], en orden): mover guarda primero el destino y después el origen.
// Aviso diario de tareas (entrega 3, tareas-ux.md 8 y 11.6): sin &globo, preferencias.json ya dice que hoy
//   se avisó (tareas.avisado = hoy) y no sale nada. Con &globo es el primer arranque del día (avisado = ayer)
//   y el aviso sale donde esté la mascota; guardarlo (guardar_ajuste tareasAvisado) queda en window.__ajustes:
//   &globo=marca     el globo debajo del Avi de la marca (el panel con la barra lateral)
//   &globo=muesca    el globo que cuelga de la muesca plegada; sin ?acople, arriba, y sin ?estado ni ?muesca, en
//                    reposo (sin la pregunta de catalogo, que lo taparía). Con ?muesca=pregunta, la pregunta lo tapa
//   &globo=dividida  la fila de aviso arriba de las mitades; sin ?dividida, ?dividida=pregunta
//   &tapa            la pregunta de catalogo llega a los 4 s y se va a los 10 s: tapa el globo (desde H2, en los tres
//                    lugares: la marca, la dividida y la muesca) y vuelve
//   Desde H2 (habitos-ux.md 8.1, D-m4) una pregunta pendiente tapa todos los globos: con &globo o &rec, catalogo no
//   pregunta (?estado=reposo) salvo que el caso lo pida (?estado, ?muesca, &tapa o ?pregunta).
// Recordatorio de un hábito (#41, entrega H2, habitos-ux.md 8.3): la cola de globos (globos.js), uno por vez.
//   Sin &rec, preferencias.json ya dice que hoy se recordaron todos (habitosRecordados) y no sale ninguno.
//   &rec=agua        el aviso de Agua pasa a 10 min antes de ahora (Argentina): sale su globo (cantidad: «+1 vaso»)
//                    y la notificación de Windows (falsa: window.__notificaciones y la consola). Varios con comas:
//                    &rec=agua,caminar (el de hora más temprana primero). caminar y leer son sí/no, correr es por
//                    semana; gimnasio hoy no toca (no sale nada). Lo guardado queda en window.__ajustes.habitosRecordados
//   &tarde           con &rec, 2 h antes: el globo sale igual, sin notificación (más de 60 min tarde, D-h12)
//   &recordado       con &rec, ya se recordó hoy (un reinicio el mismo día): no sale nada
//   &globo=marca&rec=agua  los dos en la cola: primero el recordatorio; al irse, el aviso de tareas
//   Con ?acople=arriba|derecha|abajo|izquierda (sin ?estado), el globo cuelga de la muesca; con ?dividida, en la fila
// Hábitos (#41, docs/diseno/habitos-ux.md, entrega H1): la fila «Hábitos» del menú, Ctrl H o ?habitos=… abren la hoja.
//   Sin ?habitos, los cinco hábitos del boceto (Agua, Caminar, Gimnasio, Correr y Leer 20 minutos, con el registro
//   contado desde hoy en Argentina; Gimnasio va los días que hoy no toca, así se ve «Hoy no toca») y la hoja cerrada:
//   la fila muestra el anillo de hoy. Con ?habitos, la hoja se abre sola a los 0,9 s por el clic en su fila y va a:
//   ?habitos=hoy           Hoy: las filas de hoy, «Hoy no toca» abajo y el avance
//   ?habitos=semana        Semana: la grilla de lunes a domingo con la franja de hoy, la leyenda y la pista
//   ?habitos=nuevo         el formulario de un hábito nuevo (4.11)
//   ?habitos=vacio         sin hábitos: el primer uso («Armá tu primer hábito» y las cuatro sugeridas)
//   ?habitos=roto          un archivo que no se pudo leer (7.6): su fila en el índice y su error con «Abrir la carpeta»
//   ?habitos=guardarfalla  habitos_guardar falla siempre: la primera marca muestra «No se guardó el último cambio.» (7.4)
//   ?habitos=carpeta       habitos_leer falla: «No se pudo abrir la carpeta de hábitos.» con «Volver a leer» (5.2)
//   ?habitos=agua|caminar|gimnasio|correr|leer  ese hábito abierto (4.10), desde Hoy
//   &habitoslento          habitos_leer tarda 1,2 s (las filas fantasma de 7.1)
// Resumen semanal de Hábitos (#41, entrega H3, habitos-ux.md 8.4): sin ?resumen, preferencias.json ya dice que se
//   vio el de esta semana (habitosResumen) y no sale. Con ?resumen, nunca se vio: sale el de la semana pasada
//   (o el de esta, un domingo desde las 18 de Argentina), con los cinco hábitos falsos. Sin la pregunta de catalogo.
//   ?resumen=frase      habitos_frase responde en 1,2 s una frase que pasa fraseValida (y la charla, con &modelo=listo
//                       puesto solo, responde con el modelo falso)
//   ?resumen=plantilla  habitos_frase se pasa de los 45 s (falso, 0,3 s): la plantilla «Esta semana: …»
//   ?resumen=sinmodelo  sin el modelo de esta PC: la plantilla, y «Charlemos la semana →» abre la charla con su «Descargar»
//   ?resumen=invalida   la frase trae un número que no está en los datos: la plantilla
//   ?resumen=guardada   la frase de la semana pasada ya se pidió en un arranque anterior (habitosFrase): sale esa,
//                       sin pedirle nada al modelo (window.__frases queda vacío)
//   Lo pedido se guarda en habitosFrase ({ lunes, frase }; "" si falló): window.__ajustes.habitosFrase
//   Con ?acople=arriba|… el globo cuelga de la muesca («Tu semana: …» · «Ver →»); con ?dividida=pregunta, en la fila.
//   Lo guardado queda en window.__ajustes.habitosResumen; cada pedido de frase, en window.__frases
//   Lo guardado queda en window.__habitos (un Map por id); cada guardado se anota en window.__guardadosHabitos.
//   Las cuentas son las de las listas falsas (2 para hoy y 2 vencidas, con ?tareas=… las de cada caso)
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
// máquina falsa. El asistente se abre desde la pestaña Instalación de la configuración o desde el
// aviso del tablero (la bandeja ya no lo tiene, configuracion-ux.md 4.5).
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
//   ?chat=encima       el tablero al medio: en una vista angosta la hoja no entra al costado y tapa la columna (D1)
//   &motor=local       la próxima charla con el modelo local; &modelo=listo|bajando su estado (sin esto, falta).
//                      Con &modelo=listo, ?chat=esperando|escribiendo|listo|frenada responde el modelo falso
//                      (despierta en 1,2 s la primera vez, como "Despertando el modelo de esta PC")
//   &modeloChat=opus   el modelo de Claude de las charlas nuevas (#35): fable|opus|sonnet|haiku (sin esto, Por defecto)
//   &cancelaCarpeta    "Elegir otra carpeta…" se cancela (sin esto, elige quintech-crm del escritorio)
//   &engram            el pie del cajón dice "también en Engram" (sin esto, "Engram apagado")
// La charla con herramientas (#43, C2; chat-herramientas-ux.md 11.11): las herramientas falsas escriben
// en las listas falsas de Tareas (window.__tareas) y avisan por oficina://tareas, como mcp_avis.rs:
//   ?chat=recibo       «anotame comprar pan para mañana»: el recibo «Anoté en Tareas» con su sello
//   ?chat=recibos      tres cambios (tildar, nueva fecha y mover): «3 cambios», filas escalonadas y «Deshacer los 3»
//   ?chat=deshecho     el recibo y, al terminar, el clic en «Deshacer»: la raya y «Deshecho»
//   ?chat=despues      el recibo, la tarea tildada en Tareas y el clic en «Deshacer»: «Cambió después»
//   ?chat=lectura      «¿Qué tengo hoy?»: el recibo de lectura con su avance
//   ?chat=borrar       «borrá la del DNI»: el recibo «Para borrar» con «Ir a la tarea →»
//   ?chat=error        un error reintentable («No se pudo guardar…») con «Reintentar» y «Abrir Tareas»
//   ?chat=nollego      dos tarea_crear y un solo cambio: «Un cambio no llegó a Avis»
//   ?chat=local-herr   con Local: la línea punteada, la respuesta en texto y su globo abierto
//   Con &tareas=hoy, la hoja de Tareas abierta al lado: la fila que entra con su destello (8)
// window.__arrastrar({ type: 'enter' | 'over' | 'drop' | 'leave', paths, position }) imita el arrastre
// de Tauri (onDragDropEvent, px físicos); window.__soltarEnHoja([ruta]) suelta en el medio de la hoja.
// Desde la consola del iframe: window.__chat.despachar({ tipo: 'soltando', nombre: 'a.pdf' }) manda
// cualquier evento a la hoja y window.__chat.estado() la lee; window.__borrarModelo() imita "Borrar" del
// modelo local en la configuración.
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
  // &globo (tareas-ux.md 11.6): cada forma con lo que necesita para verse
  const globoTar = url.get('globo')
  // Desde H2 (habitos-ux.md 8.1, D-m4) una pregunta pendiente tapa el globo en la marca, la dividida y la
  // muesca: con &globo o &rec, sin pregunta de catalogo salvo que el caso la pida (?estado, ?muesca, &tapa, ?pregunta)
  if ((globoTar || url.has('rec') || url.has('resumen')) && !url.has('estado') && !url.has('muesca') && !url.has('tapa') && !url.has('pregunta')) url.set('estado', 'reposo')
  // ?resumen=frase: el modelo de esta PC está, así la charla que abre el resumen responde con el modelo falso
  if (['frase', 'plantilla', 'invalida'].includes(url.get('resumen')) && !url.has('modelo')) url.set('modelo', 'listo')
  if (globoTar === 'muesca' && !url.has('acople')) url.set('acople', 'arriba')
  if (globoTar === 'dividida' && !url.has('dividida')) url.set('dividida', 'pregunta')
  const ahora = Date.now()
  const hace = min => new Date(ahora - min * 60000).toISOString()

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
  // ?repos=1|muchos: la tira de repos de Sesiones (modulos-ux.md 4.4, #42 M2) con un solo proyecto (oficina)
  // o con 9 (los 3 de siempre y 6 quietos más, para ver el scroll horizontal y la máscara)
  if (url.get('repos') === '1') SESIONES.splice(0, SESIONES.length, SESIONES.find(s => s.sesion === 'ses-oficina'))
  if (url.get('repos') === 'muchos') {
    const nucleo = SESIONES.find(s => s.sesion === 'ses-nucleo')
    for (const [k, nombre] of ['quintech-crm', 'webs-portfolio', 'brasa-noble', 'temple-barberia', 'mis-gastos-app', 'playbook'].entries()) {
      SESIONES.push({ ...nucleo, sesion: `ses-extra-${k}`, repo: `quintechlab/${nombre}`, rama: 'main', inicio: hace(20 + k * 7), actividad: 'esperándote', agentes: [] })
    }
  }
  /** Preguntas que el falso da por tomadas (?envio=listo) o respondidas en Claude (?envio=ya). */
  const tomadas = new Set()
  // &tapa: las preguntas solo entre los 4 y los 10 s (tapan el globo de tareas de la muesca y se van)
  const tapada = () => url.get('pregunta') === 'llega' ? Date.now() - ahora >= 4000 : !url.has('tapa') || (Date.now() - ahora >= 4000 && Date.now() - ahora < 10000)
  const sinTomadas = () => SESIONES.map(s => ({ ...s, preguntas: tapada() ? (s.preguntas ?? []).filter(p => !tomadas.has(p.id)) : [] }))

  // Barra de control (#19): las sesiones aceptan órdenes (mod v0.10). oficina trabaja (Frenar se ve),
  // central-nucleo espera tu mensaje y catalogo tiene un mensaje en cola ("en cola").
  if (!url.has('sincontrol')) {
    for (const s of SESIONES) Object.assign(s, { puedeControlar: true, enTurno: s.actividad !== 'esperándote' })
    const catalogo = SESIONES.find(s => s.sesion === 'ses-catalogo')
    // Con ?repos=1 no está
    if (catalogo) catalogo.enCola = 1
    // Cerrar (#25, mod v0.11): central-nucleo y catalogo son de terminal ("Cerrar sesión" se ve);
    // oficina es de la app de escritorio (sin el botón). ?sincerrar: mod v0.10, ninguna se cierra
    if (!url.has('sincerrar')) for (const s of SESIONES) s.puedeCerrar = s.sesion === 'ses-nucleo' || s.sesion === 'ses-catalogo'
  }
  /** La conversación de "Qué hizo" (#25), como la devuelve historial.rs: avisos del sistema incluidos. */
  const HISTORIAL = [
    { rol: 'claude', texto: 'Terminé de revisar los precios del catálogo viejo.', cuando: hace(52) },
    { rol: 'usuario', texto: 'armá la tabla de precios con descuento para la home', cuando: hace(48) },
    { rol: 'claude', texto: 'Voy a leer el componente de precios.', cuando: hace(47) },
    { rol: 'claude', texto: '**Listo.** Armé `TablaPrecios` con el precio tachado y el descuento en un chip; los tests de precios pasan (12).', cuando: hace(40) },
    { rol: 'usuario', texto: '<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n</task-notification>', cuando: hace(39) },
    { rol: 'usuario', texto: 'en mobile el chip tapa el precio, fijate', cuando: hace(30) },
    { rol: 'claude', texto: 'Tenías razón: a 375 px el chip se montaba sobre el precio. Lo pasé abajo del precio en mobile y quedó igual en escritorio.', cuando: hace(26) },
    { rol: 'usuario', texto: 'perfecto, ahora sumá el precio por mayor\n\n<system-reminder>contexto del IDE</system-reminder>', cuando: hace(12) },
    { rol: 'claude', texto: 'Sumé la columna "por mayor" con el mínimo de unidades; falta que me digas desde cuántas unidades aplica para cada categoría, así lo dejo configurable en vez de fijo en el código.', cuando: hace(8) },
    { rol: 'usuario', texto: 'desde 10 en todas', cuando: hace(2) },
  ]
  /** Órdenes del falso, por sesión: { id, tipo, consumida, resultado, motivo }. */
  const ordenesFalsas = new Map()
  /** Como el mod: un mensaje a una sesión que trabaja queda en cola; frenar la deja esperándote. */
  const tomarOrden = (sesion, orden) => {
    if (ordenesFalsas.get(sesion) !== orden) return
    const s = SESIONES.find(x => x.sesion === sesion)
    const trabaja = !!s && s.actividad !== 'esperándote'
    orden.consumida = true
    if (url.get('orden') === 'fallo') Object.assign(orden, { resultado: 'fallo', motivo: 'el motor no lo aceptó (falso)' })
    else if (orden.tipo === 'cerrar') {
      // Como el mod: solo una de terminal; sale como con /exit y unos 2 s después su archivo queda cerrado
      if (!s?.puedeCerrar) Object.assign(orden, { resultado: 'descartada', motivo: 'solo se cierran las sesiones de terminal' })
      else {
        orden.resultado = 'cerrando'
        setTimeout(() => { const i = SESIONES.indexOf(s); if (i >= 0) SESIONES.splice(i, 1) }, 2000)
      }
    } else if (orden.tipo === 'frenar') {
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
  /** preferencias.json falso (configuracion-ux.md 9.1): los interruptores; guardar_ajuste los cambia. */
  const ESPECIES = ['avi', 'ascua', 'escarcha', 'nodo', 'bruma', 'morro', 'lumen']
  const ajustes = { arriba: true, avisar: true, pausa: url.has('pausa'), mascota: ESPECIES.includes(url.get('mascota')) ? url.get('mascota') : 'avi' }
  // tareas.avisado (11.4): con &globo, ayer (el primer arranque del día); sin él, hoy (ya se avisó)
  const diaArFalso = n => new Date(Date.now() - 3 * 3600000 + n * 86400000).toISOString().slice(0, 10)
  let avisadoTar = url.has('globo') ? diaArFalso(-1) : diaArFalso(0)
  // Las claves de API falsas (entrega 4): solo el final de 4, como lo que devuelve Rust. ?clave=sin
  // ninguna, ?clave=guardada las tres; sin ?clave, Claude y Gemini (las del boceto)
  const PROVEEDORES_FALSOS = ['anthropic', 'openai', 'gemini']
  const clavesFalsas = url.get('clave') === 'sin' ? {}
    : url.get('clave') === 'guardada' ? { anthropic: 'a1B2', openai: 'Q7xK', gemini: '9fLw' } : { anthropic: 'a1B2', gemini: '9fLw' }
  let arranqueFalso = url.has('arranque')
  const oyentes = {}
  let lecturas = 0
  const emitir = (nombre, payload) => { for (const f of oyentes[nombre] ?? []) f({ payload }) }
  // ?cfg=<pestaña>: como "Configuración…" de la bandeja, abre la configuración en esa pestaña
  if (url.has('cfg')) setTimeout(() => emitir('oficina://configuracion', { abrir: true, tab: url.get('cfg') || undefined }), 900)

  // ---- Tareas (#39, docs/diseno/tareas-ux.md 11.3): las listas del boceto, en memoria, con las fechas
  // contadas desde hoy en Argentina (UTC−3), como tareas.rs las guarda (`creada` y `hechaEn` en ms)
  const modoTareas = url.get('tareas')
  const diaAr = n => new Date(Date.now() - 3 * 3600000 + n * 86400000).toISOString().slice(0, 10)
  let nTarea = 0
  const tareaF = (titulo, extra = {}) => ({
    id: `t-falsa${++nTarea}`, titulo, hecha: false, hechaEn: null, fecha: null, importante: false, notas: '', subtareas: [], creada: ahora - (40 - nTarea) * 3600000, ...extra,
  })
  const listaF = (id, nombre, color, orden, tareas) => ({ v: 1, id, nombre, color, orden, creada: ahora - 9 * 86400000 + orden, tareas })
  const LISTAS_FALSAS = [
    listaF('l-trabajo', 'Trabajo', 'celeste', 0, [
      tareaF('Revisar el PR #36 del modelo del chat', {
        fecha: diaAr(0), importante: true, notas: 'Ojo con el relanzar cuando hay un turno en curso: probar Haiku → Sonnet a mitad de una respuesta.',
        subtareas: [{ id: 's-1', titulo: 'Probar con Haiku y con Sonnet', hecha: true }, { id: 's-2', titulo: 'Leer los tests de abrir_con', hecha: false }, { id: 's-3', titulo: 'Dejar los comentarios', hecha: false }],
      }),
      tareaF('Presupuesto de la landing para Café Molienda', { fecha: diaAr(-1), importante: true, notas: 'Tres secciones y un formulario de reservas.' }),
      tareaF('Subir la versión del widget a 0.13', { fecha: diaAr(2) }),
      tareaF('Renovar el certificado para firmar el MSI', { fecha: diaAr(3), notas: 'Vence en diciembre.' }),
      tareaF('Contestarle a Nahuel por el hosting'),
      tareaF('Deploy del catálogo a producción', { hecha: true, hechaEn: ahora - 3600000 }),
    ]),
    listaF('l-casa', 'Casa', 'verde', 1, [
      tareaF('Pagar la boleta de la luz', { fecha: diaAr(0), importante: true, notas: 'Con el código de pago electrónico.' }),
      tareaF('Llamar al técnico del aire', { fecha: diaAr(4) }),
      tareaF('Sacar turno para renovar el DNI'),
      tareaF('Regar las plantas', { fecha: diaAr(0), hecha: true, hechaEn: ahora - 7200000 }),
    ]),
    listaF('l-compras', 'Compras', 'rosa', 2, [
      tareaF('Pasta térmica para la notebook', { importante: true, notas: 'Una que no se seque rápido.' }),
      tareaF('Cable USB-C de 2 m'),
      tareaF('Yerba (2 kg)'),
      tareaF('Café en grano', { hecha: true, hechaEn: ahora - 86400000 }),
    ]),
    listaF('l-facturacion', 'Facturación', 'violeta', 3, [
      tareaF('Pagar el monotributo', { fecha: diaAr(-4), importante: true, notas: 'Este mes no pasó el débito automático.' }),
      tareaF('Factura C de noviembre a Café Molienda', { fecha: diaAr(6) }),
    ]),
  ]
  const listasTareas = new Map(
    (modoTareas === 'primer' ? []
      : modoTareas === 'vacia' ? [listaF('l-ideas', 'Ideas', 'celeste', 0, []), listaF('l-casa', 'Casa', 'verde', 1, [tareaF('Llamar al técnico del aire', { fecha: diaAr(1) })])]
        : LISTAS_FALSAS).map(l => [l.id, l]),
  )
  const rotasTareas = modoTareas === 'roto' ? [{ archivo: 'l-mf3k2a9x1b.json', motivo: 'no es JSON: EOF while parsing a value at line 14 column 0' }] : []
  window.__tareas = listasTareas
  /** La huella de una lista (11.5): un hash corto de su JSON (en Rust, el SHA-256 de los bytes del archivo). */
  const huellaFalsa = l => {
    let h = 0
    for (const ch of JSON.stringify(l)) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
    return `h${(h >>> 0).toString(16)}`
  }
  window.__guardadasTareas = []
  const comandosTareas = {
    // Como tareas.rs: las listas por orden y los archivos rotos (&tareaslento tarda 1,2 s: las filas fantasma)
    // Con la huella de cada lista (#43, 11.5): un hash de su contenido, como el SHA-256 de tareas.rs
    tareas_leer: () => new Promise(r => setTimeout(() => r({
      listas: [...listasTareas.values()].sort((a, b) => a.orden - b.orden).map(l => structuredClone(l)), rotas: rotasTareas,
      huellas: Object.fromEntries([...listasTareas.values()].map(l => [l.id, huellaFalsa(l)])),
    }), url.has('tareaslento') ? 1200 : 120)),
    // ?tareas=guardarfalla: Rust no pudo escribir (7.4); lo de la pantalla queda y reintenta a los 5 s
    tareas_guardar: ({ lista, huella = null }) => {
      if (!/^l-[a-z0-9-]{1,38}$/.test(lista?.id ?? '')) return { ok: false, error: 'id de lista inválido' }
      // La charla la cambió desde que la ventana la leyó: no se pisa (11.5)
      if (huella && listasTareas.has(lista.id) && huella !== huellaFalsa(listasTareas.get(lista.id))) return { ok: false, error: 'cambio' }
      if (modoTareas === 'guardarfalla') return { ok: false, error: 'acceso denegado (falso)' }
      if (modoTareas === 'moverfalla' && lista.id === 'l-casa') return { ok: false, error: 'acceso denegado (falso)' }
      window.__guardadasTareas.push([lista.id, lista.tareas.length])
      listasTareas.set(lista.id, structuredClone(lista))
      console.info('[tareas] guardada', lista.id, lista.tareas.length)
      return { ok: true, lista, huella: huellaFalsa(lista) }
    },
    tareas_borrar_lista: ({ id }) => {
      if (!/^l-[a-z0-9-]{1,38}$/.test(id ?? '')) return { ok: false, error: 'id de lista inválido' }
      listasTareas.delete(id)
      console.info('[tareas] borrada', id)
      return { ok: true }
    },
    tareas_abrir_carpeta: () => console.info('[explorador] <config>\tareas'),
  }
  // ---- Hábitos (#41, docs/diseno/habitos-ux.md 11.1): los del boceto, en memoria, con el registro contado
  // desde hoy en Argentina (`diaAr`), como habitos.rs los guarda
  const modoHabitos = url.get('habitos')
  /** El día de la semana de Argentina de hace `n` días (lunes = 0). */
  const semanaAr = n => (new Date(`${diaAr(n)}T12:00:00Z`).getUTCDay() + 6) % 7
  const hoySem = semanaAr(0)
  const habF = (id, nombre, extra) => ({
    v: 1, id, nombre, tipo: 'diario', meta: 8, unidad: 'vasos', dias: [0, 2, 4], veces: 3, aviso: null, color: 'celeste', orden: 0,
    creado: ahora - 60 * 86400000, inicio: diaAr(-60), mejor: 0, registro: {}, ...extra,
  })
  /** Un registro con `f(n)` en cada día de hace `n` (de `desde` a `hasta`, los dos hace n días); 0 no se guarda. */
  const regF = (desde, hasta, f) => {
    const r = {}
    for (let n = desde; n >= hasta; n--) { const v = f(n); if (v > 0) r[diaAr(-n)] = v }
    return r
  }
  // Gimnasio va tres días que hoy no toca (con el boceto, jueves: lun, mié y vie)
  const diasGym = [1, 3, 5].map(d => (hoySem + d) % 7).sort((a, b) => a - b)
  const AGUA_SEM = [8, 6, 8, 3, 8, 8, 5, 8, 8, 7, 8, 8, 9]
  const HABITOS_FALSOS = [
    habF('h-agua', 'Agua', { tipo: 'cantidad', meta: 8, unidad: 'vasos', color: 'celeste', aviso: '16:00', orden: 0, mejor: 9,
      registro: { ...regF(13, 1, n => AGUA_SEM[n - 1]), [diaAr(0)]: 3 } }),
    habF('h-caminar', 'Caminar', { color: 'verde', aviso: '19:00', orden: 1, mejor: 21, registro: regF(30, 1, n => (n === 7 ? 0 : 1)) }),
    habF('h-gimnasio', 'Gimnasio', { tipo: 'dias', dias: diasGym, color: 'rosa', aviso: '07:30', orden: 2, mejor: 9,
      registro: regF(26, 1, n => (diasGym.includes(semanaAr(-n)) ? 1 : 0)) }),
    habF('h-correr', 'Correr', { tipo: 'semana', veces: 3, color: 'violeta', orden: 3, mejor: 6,
      // Las cuatro semanas pasadas, tres salidas cada una (lunes, miércoles y viernes); esta, una (ayer, si es de esta semana)
      registro: regF(hoySem + 28, 1, n => { const d = semanaAr(-n); return n > hoySem ? ([0, 2, 4].includes(d) ? 1 : 0) : (n === 1 ? 1 : 0) }) }),
    habF('h-leer', 'Leer 20 minutos', { color: 'ambar', aviso: '23:00', orden: 4, mejor: 14, creado: ahora - 16 * 86400000, inicio: diaAr(-16),
      registro: regF(16, 1, n => (n === 2 || n === 4 ? 0 : 1)) }),
  ]
  // &rec=agua (o agua,caminar…): el aviso de ese hábito pasa a 10 min antes de ahora en Argentina (con
  // &tarde, 2 h antes: solo el globo). Los demás ya se recordaron hoy (habitosRecordados), así la vista no
  // cambia con la hora real; sin &rec, todos (o, con &recordado, también los de &rec: un reinicio el mismo día)
  const recFalsos = (url.get('rec') ?? '').split(',').filter(Boolean).map(n => `h-${n}`)
  const horaArF = ms => new Date(ms - 3 * 3600000).toISOString().slice(11, 16)
  const minDelDia = Number(horaArF(ahora).slice(0, 2)) * 60 + Number(horaArF(ahora).slice(3, 5))
  const atraso = url.has('tarde') ? 120 : 10
  for (const h of HABITOS_FALSOS) if (recFalsos.includes(h.id)) h.aviso = minDelDia >= atraso ? horaArF(ahora - atraso * 60000) : '00:00'
  let recordadosHab = { dia: diaAr(0), ids: HABITOS_FALSOS.map(h => h.id).filter(id => url.has('recordado') || !recFalsos.includes(id)) }
  window.__notificaciones = []
  // El resumen semanal (H3): sin ?resumen ya se vio el de esta semana (el lunes de hoy en Argentina)
  let resumenVisto = url.has('resumen') ? null : diaAr(-hoySem)
  // La frase ya pedida (habitosFrase, 8.4): con ?resumen=guardada, la de la semana pasada
  let fraseSemana = url.get('resumen') === 'guardada'
    ? { lunes: diaAr(-hoySem - 7), frase: 'Leer 20 minutos salió bien: lo mejor de la semana.' }
    : null
  window.__frases = []
  const habitosFalsos = new Map((modoHabitos === 'vacio' ? [] : HABITOS_FALSOS).map(h => [h.id, h]))
  const rotasHabitos = modoHabitos === 'roto' ? [{ archivo: 'h-mf3k2a9x1b.json', motivo: 'no es JSON: EOF while parsing a value at line 9 column 0' }] : []
  window.__habitos = habitosFalsos
  window.__guardadosHabitos = []
  const idHabito = id => /^h-[a-z0-9-]{1,38}$/.test(id ?? '')
  const comandosHabitos = {
    // Como habitos.rs: los hábitos por orden y los archivos rotos (&habitoslento tarda 1,2 s: las filas fantasma)
    habitos_leer: () => new Promise((r, no) => setTimeout(() => {
      if (modoHabitos === 'carpeta') { no('No se pudo abrir la carpeta de hábitos.'); return }
      r({ habitos: [...habitosFalsos.values()].sort((a, b) => a.orden - b.orden || a.creado - b.creado).map(h => structuredClone(h)), rotas: rotasHabitos })
    }, url.has('habitoslento') ? 1200 : 120)),
    // ?habitos=guardarfalla: Rust no pudo escribir (7.4); lo de la pantalla queda y reintenta a los 5 s
    habitos_guardar: ({ habito }) => {
      if (!idHabito(habito?.id)) return { ok: false, error: 'id de hábito inválido' }
      if (modoHabitos === 'guardarfalla') return { ok: false, error: 'acceso denegado (falso)' }
      window.__guardadosHabitos.push([habito.id, Object.keys(habito.registro ?? {}).length])
      habitosFalsos.set(habito.id, structuredClone(habito))
      console.info('[hábitos] guardado', habito.id, habito.registro)
      return { ok: true, habito }
    },
    habitos_borrar: ({ id }) => {
      if (!idHabito(id)) return { ok: false, error: 'id de hábito inválido' }
      habitosFalsos.delete(id)
      console.info('[hábitos] borrado', id)
      return { ok: true }
    },
    habitos_abrir_carpeta: () => console.info('[explorador] <config>\\habitos'),
    // Como habitos.rs (11.7): la frase del modelo local, o un error (la ventana usa la plantilla)
    habitos_frase: ({ datos }) => new Promise((r, no) => {
      const modo = url.get('resumen')
      window.__frases.push(datos)
      if (modo === 'sinmodelo') { no('falta descargar el modelo de esta PC'); return }
      if (modo === 'plantilla') { setTimeout(() => no('la frase tardó más de 45 s (falso)'), 300); return }
      const lista = datos?.habitos ?? []
      const m = lista.reduce((a, h) => (!a || h.hechos / h.tocaban > a.hechos / a.tocaban ? h : a), null)
      if (!m) { no('no hay hábitos para resumir'); return }
      const frase = modo === 'invalida'
        ? 'Cumpliste el 87 % de lo que tocaba: una semana redonda.'
        : `${m.nombre}: ${m.hechos} de ${m.tocaban}, lo mejor de la semana. Lo demás quedó un poco atrás.`
      setTimeout(() => r({ frase }), 1200)
    }),
  }
  // ?habitos=…: abre la hoja como el usuario (el clic en la fila «Hábitos») y va a la vista de cada caso
  if (modoHabitos !== null) {
    setTimeout(() => {
      document.querySelector('#hab-fila')?.click()
      const ver = { semana: 'ix-semana', nuevo: 'nuevo-b', roto: 'ix-rota:h-mf3k2a9x1b.json' }[modoHabitos]
        ?? (habitosFalsos.has(`h-${modoHabitos}`) ? `nom-h-${modoHabitos}` : null)
      if (ver) setTimeout(() => document.querySelector(`#hab [data-k="${CSS.escape(ver)}"]`)?.click(), 400)
    }, 900)
  }

  // ?modulo=…: abre el módulo como el usuario, con el clic en su fila del menú (modulos-ux.md 4.1)
  const modulo = url.get('modulo')
  if (modulo && modulo !== 'sesiones') setTimeout(() => document.querySelector(`.mod[data-mod="${CSS.escape(modulo)}"]`)?.click(), 900)
  // ?tareas=…: abre la hoja como el usuario (el clic en la fila "Tareas") y va a la vista de cada caso
  if (modoTareas !== null) {
    setTimeout(() => {
      document.querySelector('#tar-fila')?.click()
      const ver = { vencidas: 'ix-vencidas', lista: 'ix-l-trabajo', roto: 'ix-rota:l-mf3k2a9x1b.json' }[modoTareas]
      if (ver) setTimeout(() => document.querySelector(`#tar [data-k="${ver}"]`)?.click(), 400)
      // La tarea abierta: el clic en el cuerpo de su fila, en Hoy
      if (modoTareas === 'tarea' || modoTareas === 'moverfalla') setTimeout(() => document.querySelector('#tar [data-k="ab-t-falsa1"]')?.click(), 400)
    }, 900)
  }

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
    // La "pantalla" son los px del escritorio (vista.html):
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
  // ?mod=…: el estado de la tarjeta del mod de la configuración (7.3)
  const modCfg = url.get('mod')
  const maquina = {
    claude: !['nada', 'sinclaude'].includes(pp) && modCfg !== 'sin-claude',
    catalogo: !['sinmod'].includes(pp),
    mod: pp === 'sinmod' || pp === 'nada' || pp === 'sinclaude' || ['instalando', 'sin-instalar'].includes(modCfg) ? 'ausente'
      : pp === 'apagado' || modCfg === 'apagado' ? 'apagado' : 'activo',
    gh: !['nada', 'singh', 'sinwinget'].includes(pp),
    winget: pp !== 'sinwinget',
    cuenta: ['nada', 'singh', 'sinwinget', 'sinsesion'].includes(pp) ? 'sin-sesion' : pp === 'sinred' ? 'sin-conexion' : 'conectada',
    faltan: pp === 'sinpermiso' ? ['project'] : [],
    membresia: pp === 'nomiembro' ? 'no-miembro' : pp === 'invitacion' ? 'pendiente' : 'activa',
  }
  let fallaPendiente = url.get('ppfalla')
  const versionMod = modCfg ? '0.9.1' : '0.6.0'
  // La última revisión automática guardada (preferencias.json, `mod`): hace 40 min; ?mod=fallo, falló
  const revisionMod = modCfg ? { revisado: Date.now() - 40 * 60000, fallo: modCfg === 'fallo' } : null
  const revisionFalsa = () => ({
    claude: { encontrado: maquina.claude, version: maquina.claude ? '2.1.329' : null },
    mod: maquina.claude
      ? { instalado: maquina.mod !== 'ausente', activo: maquina.mod === 'activo', version: maquina.mod === 'ausente' ? null : versionMod, catalogo: maquina.catalogo, error: null }
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
    : modauto === 'actualizo' || modCfg === 'actualizado' ? { tipo: 'actualizo', version: '0.9.1', desde: '0.9.0' } : null
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

  // ?mod=instalando: Avis instala el mod solo y no termina nunca (para mirar "Instalando…")
  if (modCfg === 'instalando') {
    setTimeout(() => {
      corriendo = 'mod'
      emitir('oficina://mod-auto', { estado: 'empieza', accion: 'mod' })
      avisarPaso('mod', { estado: 'comando', comando: 'claude plugin install oficina@quintech' })
    }, 1500)
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
    modelo: url.get('modelo') === 'listo' || chatEsc === 'error-red' || chatEsc === 'local-herr' ? 'listo' : ['bajando', 'roto'].includes(url.get('modelo')) ? url.get('modelo') : 'falta',
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
  /** "Borrar" del modelo local en la configuración (lo hace el backend): avisa que no hay modelo. */
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
    // El modelo de Claude de las charlas nuevas (#35): ?modeloChat=opus; si no, "Por defecto"
    modelo: ['fable', 'opus', 'sonnet', 'haiku'].includes(url.get('modeloChat')) ? url.get('modeloChat') : null,
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
    if (ESCENAS_HERR.has(chatEsc)) { turnoConHerramientas(c, turno, luego, terminar); return }
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
  // ---- La charla con herramientas (#43, C2; chat-herramientas-ux.md 11.4 a 11.9): como mcp_avis.rs, cada
  // herramienta escribe en las listas falsas (window.__tareas), emite su cambio por oficina://chat y la
  // lista tocada por oficina://tareas; chat_deshacer y chat_reintentar siguen sus reglas.
  const ESCENAS_HERR = new Set(['recibo', 'recibos', 'deshecho', 'despues', 'lectura', 'borrar', 'error', 'nollego'])
  let nCambio = 0
  const idCambio = () => `c-falso${++nCambio}`
  const listaDeTarea = id => [...listasTareas.values()].find(l => l.tareas.some(t => t.id === id)) ?? null
  const avisarTareas = (lista, tarea) => emitir('oficina://tareas', { lista, tarea, origen: 'chat' })
  const cambioBase = (herramienta, estado, lista, tarea, titulo) => ({ id: idCambio(), herramienta, estado, lista, tarea, titulo, antes: null, despues: null, motivo: null, reintentable: false, args: null })
  const herr = {
    crear: ({ titulo, lista = 'l-compras', fecha = null }) => {
      const l = listasTareas.get(lista)
      const t = tareaF(titulo, { fecha, creada: Date.now() })
      l.tareas.push(t)
      avisarTareas(lista, t.id)
      return { ...cambioBase('tarea_crear', 'hecho', lista, t.id, titulo), despues: { titulo, fecha, hecha: false, importante: false, lista } }
    },
    tildar: ({ id, hecha = true }) => {
      const l = listaDeTarea(id)
      const t = l.tareas.find(x => x.id === id)
      const antes = { hecha: t.hecha, hechaEn: t.hechaEn, lista: l.id }
      Object.assign(t, { hecha, hechaEn: hecha ? Date.now() : null })
      avisarTareas(l.id, id)
      return { ...cambioBase('tarea_tildar', 'hecho', l.id, id, t.titulo), antes, despues: { hecha, hechaEn: t.hechaEn, lista: l.id } }
    },
    editar: ({ id, lista, ...campos }) => {
      const origen = listaDeTarea(id)
      const t = origen.tareas.find(x => x.id === id)
      const antes = { lista: origen.id }
      const despues = { lista: lista ?? origen.id }
      for (const [k, v] of Object.entries(campos)) { antes[k] = t[k]; despues[k] = v; t[k] = v }
      if (lista && lista !== origen.id) {
        listasTareas.get(lista).tareas.push(t)
        origen.tareas = origen.tareas.filter(x => x.id !== id)
        avisarTareas(lista, id)
      }
      avisarTareas(origen.id, id)
      return { ...cambioBase('tarea_editar', 'hecho', despues.lista, id, t.titulo), antes, despues }
    },
    ver: vista => {
      const hoy = diaAr(0)
      const todas = [...listasTareas.values()].flatMap(l => l.tareas.map(t => ({ l, t })))
      const de = todas.filter(({ t }) => (vista === 'vencidas' ? !t.hecha && t.fecha && t.fecha < hoy : t.fecha === hoy))
      const orden = [...de].sort((a, b) => Number(!!a.t.hecha) - Number(!!b.t.hecha) || Number(!!b.t.importante) - Number(!!a.t.importante))
      const filas = orden.slice(0, 6).map(({ l, t }) => ({ tarea: t.id, lista: l.id, titulo: t.titulo, fecha: t.fecha, hecha: t.hecha, importante: t.importante }))
      return { ...cambioBase('tareas_ver', 'lectura', null, null, null), resumen: { vista, nombre: null, hoy, hechas: de.filter(x => x.t.hecha).length, total: de.length, mas: de.length - filas.length, filas } }
    },
    mostrar: id => {
      const l = listaDeTarea(id)
      return { ...cambioBase('tarea_mostrar', 'mostrar', l.id, id, l.tareas.find(x => x.id === id).titulo), resumen: { para: 'borrar' } }
    },
  }
  const RESPUESTAS_HERR = {
    recibo: 'Listo, para mañana en Compras.', deshecho: 'Listo, para mañana en Compras.', despues: 'Listo, para mañana en Compras.',
    recibos: 'Hecho, tres cambios.', lectura: 'Tenés tres para hoy y una ya tildada. Arrancaría por el PR.',
    borrar: 'Borrar lo hacés vos, con un clic: así nada se va por un malentendido. Te la dejo a mano:',
    error: 'No pude anotarla: el archivo no se guardó.', nollego: 'Anoté el pan y la yerba.',
  }
  /** El turno falso con las herramientas de Avis: las llamadas (`↳`, que no se ven), los cambios y el texto. */
  function turnoConHerramientas(c, turno, luego, terminar) {
    const pasos = {
      recibo: [['tarea_crear', () => herr.crear({ titulo: 'Comprar pan', fecha: diaAr(1) })]],
      deshecho: [['tarea_crear', () => herr.crear({ titulo: 'Comprar pan', fecha: diaAr(1) })]],
      despues: [['tarea_crear', () => herr.crear({ titulo: 'Comprar pan', fecha: diaAr(1) })]],
      recibos: [
        ['tarea_tildar', () => herr.tildar({ id: 't-falsa7' })],
        ['tarea_editar', () => herr.editar({ id: 't-falsa1', fecha: diaAr(2) })],
        ['tarea_editar', () => herr.editar({ id: 't-falsa12', lista: 'l-trabajo' })],
      ],
      lectura: [['tareas_ver', () => herr.ver('hoy')]],
      borrar: [['tareas_ver', null], ['tarea_mostrar', () => herr.mostrar('t-falsa9')]],
      error: [['tarea_crear', () => ({ ...cambioBase('tarea_crear', 'error', null, null, 'Turno con el dentista'), motivo: 'No se pudo guardar. No cambió nada.', reintentable: true, args: { titulo: 'Turno con el dentista', lista: 'l-casa', fecha: diaAr(5) } })]],
      nollego: [['tarea_crear', () => herr.crear({ titulo: 'Comprar pan', fecha: diaAr(1) })], ['tarea_crear', null]],
    }[chatEsc]
    // Con &tareas, el cambio llega después de que la mascota aterrizó: da tiempo a escribir en Tareas
    let t = url.has('tareas') ? 2200 : 700
    for (const [nombre, hacer] of pasos) {
      luego((t += 500), () => {
        emitirChat(c, turno, 'herramienta', { nombre: `mcp__avis__${nombre}`, detalle: '' })
        const cambio = hacer?.()
        if (cambio) emitirChat(c, turno, cambio.estado === 'lectura' ? 'lectura' : cambio.estado === 'mostrar' ? 'mostrar' : 'cambio', { cambio })
      })
    }
    for (const p of trozos(RESPUESTAS_HERR[chatEsc])) luego((t += 60), () => emitirChat(c, turno, 'texto', { texto: p }))
    luego(t + 120, () => { emitirChat(c, turno, 'fin', { ms: t + 120 }); terminar() })
  }
  /** Como `mcp_avis::deshacer`: vuelve a `antes` si la tarea sigue como `despues`; si no, «cambió después». */
  function deshacerFalso(cambio) {
    const l = listaDeTarea(cambio.tarea)
    const t = l?.tareas.find(x => x.id === cambio.tarea)
    const coincide = (campos, lid) => Object.entries(campos ?? {}).every(([k, v]) => (k === 'lista' ? v === lid : t[k] === v))
    if (cambio.herramienta === 'tarea_crear') {
      if (!t) return { estado: 'deshecho' }
      if (!coincide(cambio.despues, l.id)) return { estado: 'cambio-despues' }
      l.tareas = l.tareas.filter(x => x.id !== t.id)
      avisarTareas(l.id, t.id)
      return { estado: 'deshecho' }
    }
    if (!t) return { estado: 'cambio-despues' }
    if (!coincide(cambio.despues, l.id)) return { estado: coincide(cambio.antes, l.id) ? 'deshecho' : 'cambio-despues' }
    for (const [k, v] of Object.entries(cambio.antes)) if (k !== 'lista') t[k] = v
    if (cambio.antes.lista !== l.id) {
      l.tareas = l.tareas.filter(x => x.id !== t.id)
      listasTareas.get(cambio.antes.lista).tareas.push(t)
      avisarTareas(cambio.antes.lista, t.id)
    }
    avisarTareas(l.id, t.id)
    return { estado: 'deshecho' }
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
    // ?chat=local-herr: lo que dice la instrucción local de 11.3 cuando le piden tocar tareas
    if (chatEsc === 'local-herr') {
      const no = 'Con el modelo local todavía no puedo tocar tus tareas ni tus hábitos. Lo puedo hacer en una charla con Claude Code.'
      let t2 = despierta + 600
      for (const p of trozos(no)) luego((t2 += 45), () => emitirChat(c, turno, 'texto', { texto: p }))
      luego(t2 + 80, () => { emitirChat(c, turno, 'fin', { ms: t2 + 80 }); if (enCurso?.turno === turno && enCurso.c === c) enCurso = null })
      return
    }
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
    chat_abrir: ({ conversacion, motor, sesionClaude, modelo = null }) => {
      const antes = conocidas.get(conversacion)
      const sesion = antes?.sesion ?? sesionClaude ?? crypto.randomUUID()
      conocidas.set(conversacion, { motor, sesion, modelo })
      // Como Rust: con otro modelo (#35), la misma sesión con --model <alias>; "Por defecto", sin --model
      console.info('[chat] abrir', conversacion, motor, modelo ?? 'por defecto')
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
    // Configuración, pestaña Datos (E5): ?historial=muchas suma 24 charlas falsas; &borrarfalla deja 3 sin borrar
    chat_contar: () => {
      const extra = url.get('historial') === 'muchas' ? 24 : 0
      const bytes = [...archivos.values()].reduce((n, d) => n + JSON.stringify(d).length, 0) + extra * 52000
      return { charlas: archivos.size + extra, bytes }
    },
    chat_borrar_todo: () => new Promise(r => setTimeout(() => {
      const falla = url.has('borrarfalla') ? Math.min(3, archivos.size) : 0
      const ids = [...archivos.keys()].slice(falla)
      for (const id of ids) archivos.delete(id)
      if (url.get('historial') === 'muchas' && !falla) url.delete('historial')
      console.info('[chat] borrar todo', ids.length, 'borradas', falla, 'sin borrar')
      r({ borradas: ids.length, fallidas: falla })
    }, 900)),
    guardar_chat: ({ motor, carpeta, modelo = null }) => {
      prefsChat = { motor, carpeta: carpeta ?? null, modelo: ['fable', 'opus', 'sonnet', 'haiku'].includes(modelo) ? modelo : null, recientes: carpeta ? [carpeta, ...prefsChat.recientes.filter(r => r !== carpeta)].slice(0, 5) : prefsChat.recientes }
      console.info('[chat] preferencias', JSON.stringify(prefsChat))
      return prefsChat
    },
    elegir_carpeta: () => (url.has('cancelaCarpeta') ? null : `${ESCRITORIO}\\quintech-crm`),
    // #43: Deshacer y Reintentar de un recibo, solo con el clic (chat-herramientas-ux.md 11.7 y 11.9)
    chat_deshacer: ({ cambio }) => new Promise(r => setTimeout(() => {
      const d = deshacerFalso(cambio)
      console.info('[chat] deshacer', cambio.id, d.estado)
      r({ ...d, motivo: null })
    }, 350)),
    chat_reintentar: ({ cambio }) => new Promise(r => setTimeout(() => {
      const a = cambio.args ?? {}
      r(herr.crear({ titulo: a.titulo, lista: listasTareas.has(a.lista) ? a.lista : 'l-casa', fecha: a.fecha ?? null }))
    }, 300)),
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
        // #43, C2: los recibos (chat-herramientas-ux.md 11.11), por el mismo camino que el usuario
        case 'recibo': case 'error': case 'nollego':
          preguntar({ error: 'anotame el turno con el dentista el martes', nollego: 'anotame pan y yerba' }[chatEsc] ?? 'anotame comprar pan para mañana')
          break
        case 'recibos':
          preguntar('tildá lo de la luz, pasá lo del PR al viernes y mové el cable a Trabajo')
          break
        case 'lectura':
          preguntar('¿Qué tengo hoy?')
          break
        case 'borrar':
          preguntar('borrá la del DNI')
          break
        case 'deshecho':
          preguntar('anotame comprar pan para mañana')
          cuandoListo(() => setTimeout(() => document.querySelector('#chat-hilo [data-accion="ch-deshacer"]')?.click(), 900))
          break
        case 'despues':
          // La tarea se tilda en Tareas después de anotarla: Deshacer dice «Cambió después»
          preguntar('anotame comprar pan para mañana')
          cuandoListo(() => setTimeout(() => {
            const l = listasTareas.get('l-compras')
            const t = l.tareas.at(-1)
            Object.assign(t, { hecha: true, hechaEn: Date.now() })
            avisarTareas(l.id, t.id)
            setTimeout(() => document.querySelector('#chat-hilo [data-accion="ch-deshacer"]')?.click(), 500)
          }, 900))
          break
        case 'local-herr':
          // Con Local: la línea punteada y, al pedir un cambio, la respuesta en texto (11.3); después, su globo
          ch.despachar({ tipo: 'motor', motor: 'local' })
          preguntar('anotame comprar pan para mañana')
          cuandoListo(() => setTimeout(() => document.querySelector('#ch-puede')?.click(), 600))
          break
      }
    }, 1500)
  }
  // Como Rust (borrar_modelo): sin cuadro nativo (la confirmación es de la ventana); &borrarfalla falla
  comandosChat.borrar_modelo = () => {
    if (url.has('borrarfalla')) throw new Error('no se pudo borrar %LOCALAPPDATA%\\avis-ia (falso)')
    window.__borrarModelo()
    console.info('[modelo] borrar_modelo')
    return TOTAL_MODELO
  }

  const comandos = {
    ...comandosChat,
    ...comandosTareas,
    ...comandosHabitos,
    registrar: ({ linea }) => console.debug('[widget.log]', linea),
    revisar_primeros_pasos: () => new Promise(r => setTimeout(() => r(revisionFalsa()), url.has('pplento') ? 2000 : 600)),
    // Como Rust (estado_mod): la lectura del mod y la última revisión guardada, solo lectura
    estado_mod: () => new Promise(r => setTimeout(() => {
      const rev = revisionFalsa()
      r({ claude: rev.claude, mod: rev.mod, revisado: revisionMod?.revisado ?? null, fallo: !!revisionMod?.fallo })
    }, url.has('pplento') ? 2000 : 400)),
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
    // Como Rust (leer_configuracion): la mascota que no es una especie es el Avi (la ventana la valida
    // otra vez); los interruptores, lo guardado con guardar_ajuste; el arranque, el "sistema" falso
    leer_configuracion: () => ({
      acople, flotante, ...ajustes, arranque: arranqueFalso, version: '0.10.0', chat: prefsChat, tareasAvisado: avisadoTar,
      habitosRecordados: recordadosHab, habitosResumen: resumenVisto, habitosFrase: fraseSemana,
    }),
    // Como `ajuste_valido` de preferencias.rs; ?cfgfalla hace fallar el guardado (la fila vuelve y lo dice)
    guardar_ajuste: ({ clave, valor }) => {
      // tareasAvisado: un día "AAAA-MM-DD" que existe, o vacío (11.4); Rust lo guarda en "tareas": { "avisado" }
      const dia = v => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v)
      // habitosRecordados (habitos-ux.md 11.5): { dia, ids } con solo esas claves, hasta 100 ids de hábito
      const recordadosOk = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2 && typeof v.dia === 'string' && dia(v.dia) && v.dia !== ''
        && Array.isArray(v.ids) && v.ids.length <= 100 && v.ids.every(id => idHabito(id))
      const lunesOk = (v, vacio) => typeof v === 'string' && (v === '' ? vacio : dia(v) && new Date(`${v}T12:00:00Z`).getUTCDay() === 1)
      const valido = clave === 'mascota' ? ESPECIES.includes(valor)
        : clave === 'tareasAvisado' ? typeof valor === 'string' && dia(valor)
          : clave === 'habitosRecordados' ? recordadosOk(valor)
            // habitosResumen (8.4): un lunes que existe, o vacío (como preferencias.rs)
            : clave === 'habitosResumen' ? lunesOk(valor, true)
              // habitosFrase (8.4): { lunes, frase } con un lunes y una frase de una línea de 0 a 160
              : clave === 'habitosFrase' ? !!valor && typeof valor === 'object' && !Array.isArray(valor) && Object.keys(valor).length === 2
                && lunesOk(valor.lunes, false) && typeof valor.frase === 'string' && !/[\r\n]/.test(valor.frase) && [...valor.frase].length <= 160
            : ['arriba', 'avisar', 'pausa'].includes(clave) && typeof valor === 'boolean'
      if (!valido) throw new Error(`ajuste inválido: ${clave}`)
      if (url.has('cfgfalla')) throw new Error('no se pudo escribir preferencias.json (falso)')
      if (clave === 'habitosFrase') {
        fraseSemana = structuredClone(valor)
        window.__ajustes = { ...ajustes, habitosFrase: fraseSemana }
        console.info('[preferencias] habitosFrase', JSON.stringify(valor))
        return { ok: true, valor }
      }
      if (clave === 'habitosResumen') {
        resumenVisto = valor || null
        window.__ajustes = { ...ajustes, habitosResumen: resumenVisto }
        console.info('[preferencias] habitosResumen', valor)
        return { ok: true, valor }
      }
      if (clave === 'habitosRecordados') {
        recordadosHab = structuredClone(valor)
        window.__ajustes = { ...ajustes, habitosRecordados: recordadosHab }
        console.info('[preferencias] habitosRecordados', JSON.stringify(valor))
        return { ok: true, valor }
      }
      if (clave === 'tareasAvisado') {
        avisadoTar = valor || null
        window.__ajustes = { ...ajustes, tareas: { avisado: valor } }
        console.info('[preferencias] tareas.avisado', valor)
        return { ok: true, valor }
      }
      ajustes[clave] = valor
      window.__ajustes = { ...ajustes }
      console.info('[preferencias]', JSON.stringify(ajustes))
      if (clave === 'pausa') emitir('oficina://pausa', valor)
      // Como Rust: la mascota guardada avisa a la ventana, que redibuja todo con ella (sin acto)
      if (clave === 'mascota') emitir('oficina://mascota', { mascota: valor })
      return { ok: true, valor }
    },
    // Claves de API (entrega 4, 9.4), como claves.rs: lista fija de proveedores, la forma se valida de
    // nuevo y solo se guarda el final (ni el falso conserva la clave). Probar tarda 1,4 s (&clavelenta, 4 s)
    claves_estado: () => new Promise(r => setTimeout(() => r(PROVEEDORES_FALSOS.map(p => clavesFalsas[p]
      ? { proveedor: p, guardada: true, final: clavesFalsas[p] } : { proveedor: p, guardada: false })), 300)),
    guardar_clave: ({ proveedor, clave }) => {
      if (!PROVEEDORES_FALSOS.includes(proveedor)) throw new Error('proveedor desconocido')
      const t = String(clave ?? '').trim()
      if ([...t].length < 20 || /\s/.test(t)) throw new Error('forma')
      if (url.has('clavefalla')) throw new Error('windows:1312')
      clavesFalsas[proveedor] = [...t].slice(-4).join('')
      console.info('[credenciales] guardada', proveedor)
      return { guardada: true, final: clavesFalsas[proveedor] }
    },
    borrar_clave: ({ proveedor }) => {
      if (!PROVEEDORES_FALSOS.includes(proveedor)) throw new Error('proveedor desconocido')
      if (url.has('borrarfalla')) throw new Error('windows:5')
      delete clavesFalsas[proveedor]
      console.info('[credenciales] borrada', proveedor)
      return { guardada: false }
    },
    probar_clave: ({ proveedor }) => new Promise((r, no) => setTimeout(() => {
      if (!clavesFalsas[proveedor]) return no(new Error('sin clave'))
      const resultado = url.get('probar') ?? (proveedor === 'gemini' ? 'rechazada' : 'valida')
      r(resultado === 'otro' ? { resultado, estado: 500 } : { resultado })
    }, url.has('clavelenta') ? 4000 : 1400)),
    // "Arrancar con Windows": ?arranquefalla imita un sistema que no deja prenderlo (vuelve la marca real)
    poner_arranque: ({ valor }) => {
      if (!url.has('arranquefalla')) arranqueFalso = !!valor
      console.info('[arranque]', arranqueFalso)
      return arranqueFalso
    },
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
    // La tira es un elemento adentro de la ventana: Rust solo anota el modo (segundo arranque)
    modo_mini: args => {
      mini = !!args.mini
      window.__mini = mini
      console.info('[tira]', mini)
    },
    esconder: () => console.info('[ventana] escondida en la bandeja'),
    // La notificación de Windows (preguntas y recordatorios, habitos-ux.md 5.5): queda en window.__notificaciones
    avisar: ({ titulo, cuerpo }) => { window.__notificaciones.push({ titulo, cuerpo }); console.info('[notificación]', titulo, '·', cuerpo); return null },
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
    // "Qué hizo" (#25): según ?historial, la conversación tarda (lento: 2 s), no hay, o no se puede leer
    leer_historial: async ({ sesion }) => {
      const modo = url.get('historial')
      if (modo === 'error') throw new Error('acceso denegado a la transcripción (falso)')
      await new Promise(r => setTimeout(r, modo === 'lento' ? 2000 : 250))
      if (modo === 'vacio' || sesion === 'ses-nucleo') return { entradas: [] }
      return { entradas: HISTORIAL }
    },
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
