# Avis · chat con la mascota: la hoja aparte — dirección

> Boceto: `docs/diseno/bocetos/chat-avis.html`, **opción C "Hoja aparte"**. La eligió el orquestador el 23/11/2026, porque el usuario pidió avanzar sin preguntas («no me preguntes, no interrumpas, avanza»). Issue #22.
> **Todo lo que no estaba decidido en #22 se decidió sin el usuario.** Cada decisión lleva un número `Dn` y se junta en la sección 16 para que la revise. Si cambia una, se reabre solo la entrega que la usa.
> Esta dirección evoluciona `estilo-avis-ux.md` (ventana única 6.6 y 9.7, tokens), `marca-avi-ux.md` (la marca como botón), `mascotas-avi-ux.md` (especies y poses de la voz, entrega 5 ya mergeada) y **retira `resumen-ia-ux.md`**: el globo "¿En qué anda Claude?" se va del todo. Lo que no se nombra acá queda como está en esos documentos.
> Técnica medida: `docs/investigacion/chat-claude-code.md` (stream-json, permisos, interrupción, PDF), `engram-para-avis.md` (historial) y `modelo-local.md` (motor local).
> Del boceto se toman los textos, las medidas y los tokens de la opción C. Lo que está solo para mirarlo (el selector de especie, las pastillas de estado, "Ver cómo se abre", las opciones A y B, el fondo de escritorio falso) no va al widget.

---

## 1. Brief

- **Qué:** al hacer clic en la mascota de la marca (112 px, barra lateral) se abre una **hoja** al lado del tablero, con una charla. La mascota elegida pone la cara y la voz. Detrás responde **Claude Code** (una sesión real de `claude -p`, sin terminal, en una carpeta elegida) o el **modelo local** de esta PC (privado, sin internet).
- **Para qué:** preguntarle a Avis por las sesiones sin cambiar de ventana, pedirle documentación de un proyecto y pasarle un PDF, con el tablero a la vista mientras tanto.
- **Acción principal:** escribir y mandar un mensaje (Enter). La secundaria es Frenar (Esc) mientras responde.
- **Alcance:** solo responde, nunca actúa. Ese límite lo pone el proceso, no la interfaz (7.1). Más adelante: mails y búsqueda (fuera de esta dirección).
- **Reglas de oro:**
  1. **Un clic, nunca solo.** No se manda nada sin Enter o Enviar. Abrir la hoja no gasta tokens (7.3).
  2. **Nunca se pierde lo escrito**, ni en un error, ni al frenar, ni al plegar el panel.
  3. **La interfaz nunca miente sobre quién responde:** "vía Claude Code" o "modelo local", siempre a la vista.
  4. **El texto del modelo nunca es HTML:** se escapa y se dibuja un subconjunto de Markdown (5.6).
- **Vara:** `webs portfolio/brasa-noble`. 60 fps al 200 % de zoom en un equipo medio; nada se anima si no se ve.

## 2. Concepto

**La mascota se muda a su escenario para charlar.** Al abrir la hoja, la mascota salta de la barra lateral, describe un arco y aterriza en un escenario arriba de la hoja. En la barra queda su fantasma con la leyenda "en la charla →". Las respuestas no van en globos: son texto tipográfico con un **hilo de luz** del color de la especie (`--c`) a la izquierda, y una **chispa** baja por el hilo mientras escribe. Es el mismo lenguaje de los hilos con puntos de luz del escenario (`panel-avis-ux.md`).

Tres palabras: **propia, honesta, tranquila.** Lo que se recuerda: **la mudanza y la chispa que baja mientras habla.**

Principios: la espera se cuenta, nunca se esconde (la primera respuesta, que con la configuración del usuario tardaba ~18 s, son tres pasos con reloj; sin ella, unos 2 s, medido en E0); la mascota actúa cada estado con las poses de la voz que ya existen (`calienta`, `pensando`, `contando`, `feliz`, `error`, `baja`); el ámbar sigue siendo el acento del producto, y `--c` se usa solo en lo de la mascota.

## 3. Arquitectura

### 3.1 Dónde vive la hoja (ventana única)

- La ventana sigue siendo el área de trabajo del monitor (estilo-avis-ux.md 9.7). La hoja es **un elemento más adentro de la ventana, `#hoja`, hermano de `#marco`**, como la tira. No va dentro de `#contenido`: así el tamaño del tablero (`tamano.js`) no cambia y los dos se ven como dos tarjetas separadas.
- **Geometría (pura, `chat.js`):** `rectHoja(tablero, lado, z)` devuelve `{ x, y, ancho: 420·z, alto: tablero.alto }` con `HUECO_HOJA` = 14·z entre las dos tarjetas. El borde de arriba y el alto son los del tablero (640, o 600 con el escenario de primeros pasos).
- **Lado (`ladoHoja(tablero, area, modo, borde, z)`):** devuelve `'derecha' | 'izquierda' | 'encima'`.
  - Flotando: a la derecha si entra (`tablero.x + tablero.ancho + hueco + 420·z ≤ area.x + area.ancho`); si no, a la izquierda si entra; si no, `'encima'`.
  - Acoplada: lejos del borde. `derecha` → a la izquierda; `izquierda` → a la derecha; `arriba` y `abajo` → a la derecha y, si no entra, a la izquierda. Si no entra ninguno, `'encima'`.
  - `'encima'`: la hoja tapa la columna principal del tablero (desde `tablero.x + ancho de la barra` hasta su borde derecho) y la barra lateral sigue a la vista. Pasa al 200 % en pantallas de 1366 o menos. **(D1)**
- **Zona interactiva:** con la hoja abierta, `zonaInteractiva` devuelve la **unión** del tablero y la hoja (el hueco de 14 queda adentro). Rust sigue recibiendo un solo rectángulo. Con `'encima'`, la zona es el tablero.
- **Mover:** el escenario de la hoja es zona de arrastre (`data-arrastre`) y mueve todo, igual que la marca y el título. La hoja sigue al tablero en cada `colocar`. El lado se recalcula **al soltar**, nunca a mitad de un arrastre; si cambia, la hoja se funde en 180 ms hacia el lado nuevo. **(D2)**
- **Plegar a la muesca o a la tira (decidido por el orquestador):** la hoja se pliega con el panel (la misma `plegar` de `muescaMotion.js`, hacia el mismo destino, empezando 60 ms antes que el tablero) y la conversación queda en `st.chat`. Al desplegar, la hoja vuelve como estaba: mismo estado, borrador, adjuntos y scroll. La muesca y la tira **no** abren la charla ni avisan nada. **(D3: ni la muesca ni la tira avisan "respuesta nueva" mientras la hoja está plegada.)** El turno en curso sigue en Rust y la respuesta queda guardada.
- **Abrir y cerrar:** solo con el clic (o Enter/Espacio) en `#marca-boton` con el panel abierto. Otro clic en la marca, el fantasma, la × del escenario o Esc en reposo la cierran. Cerrar nunca frena un turno: la respuesta termina y queda en el historial.
- **Pantalla dividida y primeros pasos:** la hoja convive con las dos, porque se ubica contra el tablero que haya. Con el riel de la dividida la marca no se ve: la hoja no se puede abrir, y si estaba abierta queda abierta y su × la cierra. **(D4)**

### 3.2 Árbol del DOM

```
#hoja.hoja  (section, aria-label="Charla con <Mascota>", data-lado, data-estado, hidden cuando cerrada)
├── .escenario  (data-arrastre)
│   ├── .arriba: button.ic[data-accion=hist] "Historial" · button.ic[data-accion=cerrar-hoja] "Cerrar la charla"
│   ├── #chat-avi.voz  avi(claudeDe(especie), animo, 96), siempre en forma base (D5)
│   ├── b.esc-nom  <Mascota>
│   └── span.esc-est  "<ánimo> · vía Claude Code" | "· modelo local"
├── .ch-cab
│   ├── button.carpeta (aria-haspopup=menu, aria-expanded)  ícono · nombre · ▾
│   └── div.motor[role=radiogroup aria-label="Motor"]: Claude Code | Local
├── #chat-hilo.hilo[role=log aria-live=off tabindex=0 aria-label="Conversación"]
├── .comp
│   ├── .adjuntos (chips)
│   ├── .campo: button.ic "Adjuntar archivo" · textarea "Mensaje para <Mascota>" · Enviar | Frenar
│   └── .pie-comp  pista de teclado · "Claude Code · <carpeta>"
├── #chat-menu (menú de carpeta, cuando se abre)
├── .soltar (capa de arrastrar, cuando corresponde)
├── .velo + #chat-cajon[role=dialog] (historial, cuando se abre)
└── #anuncio-chat.oculto[aria-live=polite]  (y role=alert dentro de las tarjetas de error)
```

`#marca-boton` pasa a `aria-label="Charlar con <Mascota>"`, `aria-expanded` según la hoja, `aria-controls="hoja"` y `title` igual al label. Su ánimo (`#marca-animo`) sigue siendo la descripción. Con la hoja abierta, `.marca` lleva la clase `mudada`: su Avi queda al 14 % y en grises, con `span.mudada` "en la charla →", y el motor de la marca (`montarMarca`) se pausa: sin juegos ni mirada.

### 3.3 Estado y máquina de estados

`st.chat` en `main.js` (la forma la define `chatInicial()` en `chat.js`):

```
{ abierta, lado, conversacion: { id, titulo, motor, carpeta, sesionClaude, mensajes[] } | null,
  estado, paso, desdeMs, borrador, adjuntos[], menu, cajon, soltando, error: { motivo, detalle } | null,
  proceso: 'apagado' | 'arrancando' | 'listo',   // lo dice Rust
  engram: 'si' | 'no' | 'sin-saber', local: 'instalado' | 'falta' | 'bajando' | 'roto' }
```

`transicionChat(estado, evento, ctx) → { estado, efectos[] }` es pura, con el mismo patrón que `transicion` de `resumen.js` (que se borra). Los efectos son comandos para Rust y animaciones que corre `main.js`.

| Estado | Entra con | Pose (`animo`) | Composer | Sale con |
|---|---|---|---|---|
| `vacio` | conversación nueva | `saluda` 1,2 s, después `esperando` | Enviar (gris sin texto) | `enviar` |
| `esperando` | `enviar` | `calienta` (pasos 0 y 1), `pensando` (paso 2) | **Frenar** | primer `texto` → `escribiendo`; `error`; `frenar` |
| `escribiendo` | primer `texto` | `contando` mientras llegan partes (la boca al ritmo de `duracionContando`) | **Frenar** | `fin` → `listo`; `frenada`; `error` |
| `listo` | `fin` | `feliz` 1,6 s, después `esperando` | Enviar | `enviar` |
| `frenada` | `frenar` (al instante, sin esperar a Rust) | `esperando` | Enviar | `enviar` |
| `error` | `error` (7.7) | `error` | Enviar, con el borrador intacto | `reintentar`, `enviar`, `usar-local` |
| `historial` | `hist` (el cajón encima de cualquier otro estado) | `leyendo` | sin cambios debajo | `hist`, Esc, elegir una charla |

- `soltando` (arrastrando un archivo sobre la hoja) es una bandera, no un estado: pose `baja` mientras dura.
- **Pasos de la espera (`pasoEspera`):** paso 0 "Abriendo Claude Code en {carpeta}", hasta el `listo` del turno (el `init`, que llega siempre después de mandar, uno por turno: medido en E0; precalentado tarda menos de 1 s, 7.3); paso 1 "Mandando tu pregunta", hasta el primer `stream_event` del turno; paso 2 "Pensando la respuesta", hasta el primer `texto`. El reloj cuenta desde `enviar`, en `m:ss`. A los 45 s sin texto, la nota pasa a "Está tardando más de lo normal. Podés esperar o frenar". A los 120 s sin ningún evento del turno: `error` con motivo `tiempo`. **(D6)** Sin red no hace falta esperar tanto: el error `red` sale del tercer `reintento` sin respuesta (7.5, medido en E0). **(D33)** Con el motor local: "Despertando el modelo de esta PC" (hasta `listo`), "Leyendo tus sesiones de Avis" y "Pensando la respuesta".
- **Un turno por vez:** mientras responde, el textarea sigue editable pero Enter no manda; la pista dice "Esperá la respuesta o frená con Esc". Sin cola. **(D7)**

### 3.4 La conversación: carpeta y motor

- Cada conversación tiene **un motor y una carpeta fijos.** Si el usuario cambia el motor o la carpeta en una conversación que ya tiene mensajes, empieza una nueva; el hilo se limpia con la línea "Charla nueva en {carpeta}" y la anterior queda en el historial. En una conversación vacía, el cambio solo actualiza la cabecera. **(D8)**
- **Menú de carpeta** (`#chat-menu`, `role=menu`):
  - "Solo Avis", con la sub "Sin carpeta: sabe de tus sesiones". Es la carpeta por defecto la primera vez y corre en `<config>/chat/trabajo`, una carpeta vacía propia. **(D9)**
  - "Proyectos de la barra": uno por proyecto con sesión abierta cuya carpeta se conoce (`cwd`, entrega 7).
  - "Recientes": hasta 5 carpetas, sin repetir.
  - "＋ Elegir otra carpeta…": abre el selector nativo de carpetas. **(D10: suma `tauri-plugin-dialog`, llamado desde Rust.)**
  - La elegida queda en `preferencias.json` → `chat.carpeta`, y `chat.recientes` guarda las últimas cinco.
- **Motor Local:** la carpeta queda fija en "Sesiones de Avis" (`aria-disabled`, con `title` "El modelo local solo ve tus sesiones de Avis"), el botón Adjuntar se desactiva y las sugerencias cambian (4.1). Decidido por el orquestador.
- **Recuerda:** al abrir la hoja se retoma la última conversación si es de las últimas 12 h; si no, se abre una vacía con el último motor y la última carpeta. **(D11)**

### 3.5 Foco y teclado

- **Al abrir:** el foco va al textarea (después de la mudanza, o al instante con movimiento reducido). **Al cerrar:** el foco vuelve a `#marca-boton`.
- **Orden de Tab:** Historial → Cerrar → carpeta → motor (un solo tope; las flechas cambian la opción, como un radiogroup) → hilo (`tabindex=0`; las flechas y AvPág lo desplazan) → botones dentro del hilo (sugerencias, Reintentar, Copiar) → Adjuntar → textarea → Enviar o Frenar.
- **Teclas:**
  - Enter manda y Shift+Enter hace una línea nueva (como en `control.js`).
  - Esc, en este orden de prioridad: cierra el menú de carpeta → cierra el cajón del historial → frena el turno en curso → cierra la hoja. Siempre con el foco dentro de la hoja; el foco vuelve al disparador de lo que se cerró.
  - Ctrl+Enter también manda. **(D12)**
- **Menú de carpeta:** flechas arriba y abajo, Enter elige, Inicio y Fin; se cierra al elegir o con Esc o un clic afuera.
- **Cajón del historial:** `role=dialog aria-modal=true` con el foco atrapado; el foco arranca en el buscador.
- **Sugerencias y Reintentar** mandan su texto como si se hubiera escrito: es un clic explícito, así que cumple la regla 1.
- El Esc de la hoja va antes que el de la pregunta y el de la muesca (el orden de `main.js` donde hoy está el Esc del resumen).

### 3.6 Lo que se va (el resumen)

Se borran `resumen.js`, `resumenMotion.js`, `widget/test/resumen.test.js`, `#resumen`, `#anuncio-resumen`, `st.resumen`, las funciones `*Resumen` de `main.js` y su CSS, y el comando `pedir_resumen` con su `cuerpo_pedido`/`PREGUNTA`.

Quedan y se renombran:
- `estado_resumen` → `estado_modelo`. `descargar_modelo` sigue: la descarga se pide ahora desde la hoja, con el motor Local.
- `datosResumen` → `datosAvis`, en `chat.js`, sin cambios de forma.
- `duracionContando` y `contarPalabras` → `chat.js`. `vozAvi` se reemplaza por `animoChat`.
- El evento `oficina://resumen` → `oficina://modelo`, para el progreso de la descarga y los estados del motor.

## 4. Contenido

Español rioplatense neutro, de vos, sin signos de admiración en los errores. Los textos de la tabla son literales; `{}` es un valor.

### 4.1 Por estado

| Estado | Texto |
|---|---|
| Vacío, Claude Code | Rótulo "{MASCOTA}". "¡Hola! Estoy en **{carpeta}** con Claude Code. Preguntame por tus sesiones, pedime documentación o pasame un archivo." Con "Solo Avis": "¡Hola! Preguntame por tus sesiones de Avis o pasame un archivo." Pista: "⤓ Arrastrá un PDF o cualquier archivo acá" |
| Sugerencias, Claude Code | "¿En qué anda cada sesión?" · "¿Qué cambió hoy en {carpeta}?" · "Armame la documentación de {carpeta}" · "Resumime un PDF" (este abre el selector de archivos). Sin carpeta, la segunda y la tercera pasan a "¿Quién me está esperando?" y "¿Qué preguntas tengo pendientes?" |
| Vacío, Local | "¡Hola! Te respondo con el modelo de esta PC: privado y sin internet. Sé lo que pasa en tus sesiones de Avis." Sugerencias: "¿Quién me está esperando?" · "¿Cuántos subagentes trabajan ahora?" · "¿Qué pregunta tengo pendiente?" Pista: "El modelo local no lee carpetas ni archivos" |
| Local sin instalar | "Para charlar sin internet necesito bajar el modelo de esta PC (2,6 GB, una sola vez)." Botón primario "Descargar 2,6 GB" (la cifra la da el backend) y secundario "Usar Claude Code". Mientras baja: la barra y la cifra de `cifrasDescarga` (pasa de `resumen.js` a `chat.js`) |
| Esperando | Título "{Mascota} está despertando a Claude" (local: "a su modelo"), el reloj, la barra indeterminada, los tres pasos (3.3) y la nota "La primera respuesta tarda unos segundos. Las que siguen, menos." **(D13, medido en E0: la primera, 2 s con el proceso precalentado y hasta 7 s en frío; la segunda, 1,1 s.)** |
| Herramientas | Una línea `↳` por turno, que junta las herramientas: "↳ Leyó **README.md**" · "↳ Leyó **6 archivos**: README.md, docs/arquitectura.md…" (hasta 2 nombres) · "↳ Buscó «pedido» en catalogo" (Grep) · "↳ Miró «**/*.md»" (Glob: el patrón, porque Rust no lee cuántos archivos encontró; E2) · "↳ Miró tus sesiones de Avis" (cuando el turno llevó el contexto de Avis, 7.4) |
| Escribiendo | El texto que va llegando, más el cursor `--c` |
| Listo | Pie de la respuesta: "Copiar" · "{n} s · Claude Code" (o "· modelo local") |
| Frenada | El texto parcial y la marca "■ frenaste acá". Debajo, el botón "Volver a preguntar" (manda de nuevo el último mensaje) |
| Historial | Cajón "Charlas", buscador "Buscar en charlas", grupos "Hoy", "Ayer", "Esta semana", "Antes". Cada ítem: título · "{carpeta} · {hora}", con "local ·" cuando el motor es Local. Pie: "Guardado en esta PC · también en Engram" o "Guardado en esta PC · Engram apagado". Vacío: "Todavía no charlamos. Lo que hablemos queda acá." |
| Soltar | "Soltalo y {Mascota} lo lee" · "{nombre} · PDF, imágenes, texto o código" |
| Adjunto | Chip: nombre · "{n} páginas · {tamaño}" (PDF) o "{tamaño}" (el resto) · ×: "Quitar {nombre}" |

`{Mascota}` sale de `datosEspecie(especie).nombre` ("Avi", "Ascua"…). El placeholder es "Preguntale a {Mascota}…". El título de una conversación son las primeras 6 palabras del primer mensaje, sin signos al final (`tituloConversacion`).

### 4.2 Errores por motivo (`motivo` de 7.7)

| Motivo | Título | Cuerpo | Acciones |
|---|---|---|---|
| `red` | No llego a Claude Code | Parece que no hay conexión. Tu mensaje no se perdió: lo mando de nuevo cuando quieras. | **Reintentar** · Preguntarle al modelo local |
| `sin-claude` | No encuentro Claude Code | Avis no encontró `claude` en esta PC. Instalalo desde Primeros pasos. | **Abrir Primeros pasos** · Usar el modelo local |
| `sesion` | Claude Code no tiene tu sesión | Abrí `claude` en una terminal para iniciar sesión y volvé a probar. | **Reintentar** |
| `limite` | Llegaste al límite de uso | Tu suscripción pidió una pausa. Podés seguir con el modelo local. | **Preguntarle al modelo local** |
| `tope` | Esta charla llegó a su tope | Empezá una charla nueva para seguir. | **Charla nueva** |
| `tiempo` | Claude Code no respondió | Pasaron 2 minutos sin noticias. | **Reintentar** |
| `proceso` | Se cortó la sesión de Claude Code | Vuelvo a abrirla con lo que ya hablamos. | **Reintentar** (relanza con `--resume`) |
| `adjunto` | No puedo leer {nombre} | Puedo leer PDF, imágenes, texto y código, de hasta 20 MB. | (solo se cierra) |
| `local` | El modelo de esta PC no responde | {detalle, si hay}. | **Reintentar** · Usar Claude Code |

- Con `red`, arriba del hilo aparece además la línea de estado "Sin internet · el modelo local sigue andando", si `local === 'instalado'`.
- El mensaje que no salió queda marcado "No se envió" (rojo, mono 10) y su texto vuelve al textarea. Reintentar lo manda tal cual, con sus adjuntos.

### 4.3 Lo que se le pide a Claude (instrucciones de sistema)

`--append-system-prompt` (7.1), en `chat.rs`, como constante `INSTRUCCION_CHAT`:

> Sos {Mascota}, la mascota de Avis, el panel que muestra en qué anda Claude Code. Respondés en español rioplatense, de vos, breve y concreto. Solo respondés: no modificás archivos ni corrés comandos (no tenés esas herramientas). Si te piden algo que requiere actuar, explicá qué haría falta. Cuando el mensaje traiga un bloque `<avis>`, son los datos en vivo de las sesiones: usalos para responder sobre ellas. Usá Markdown simple (títulos, listas, código).

**(D14: el nombre de la mascota va en el texto, pero sin personaje ni muletillas; la voz es la de un buen producto.)**

## 5. Sistema visual

Sin fuentes nuevas (Manrope y Martian Mono) y sin colores nuevos. Los tokens nuevos van en `estilos.css`:

| Token | Valor | Uso |
|---|---|---|
| `--ancho-hoja` | 420px | Ancho de la hoja |
| `--hueco-hoja` | 14px | Separación con el tablero |
| `--alto-escena-chat` | 172px | Escenario de la hoja |
| `--d-mudanza` | 900ms | Viaje de la mascota |
| `--d-hoja` | 640ms | Apertura de la hoja |
| `--d-palabra-chat` | 360ms | Aparición de cada parte del texto |
| `--d-chispa` | 1300ms | Ciclo de la chispa del hilo |

### 5.1 La hoja

| Elemento | Especificación |
|---|---|
| `.hoja` | `--r-panel` (26), fondo `--negro`, `--sombra-ventana` + `0 40px 90px -40px rgba(0,0,0,.9)` + `inset 0 0 0 1px rgba(255,255,255,.05)`; columna flex |
| `.escenario` | alto 172; `radial-gradient(200px 90px at 50% 112px, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%)` sobre `linear-gradient(var(--s1), var(--negro))`; el piso es una línea de 180 × 1 en `top: 118px`, degradé de `--c` al 70 % hacia transparente; Avi de 96 centrado; nombre `800 16px/1.1 var(--f)`; estado `--t-mono-s` `--crema2` con un punto de 6 px de `--c` |
| `.ch-cab` | relleno 12/14 a los lados; carpeta 32 de alto, `--r-campo`, fondo `--s2`, borde `--linea` (hover `--linea-hover`), `--t-cuerpo-f`, ancho máximo 180 con elipsis; motor en una píldora `--s2` con botones de 26, `--t-mono-s`; el elegido en `--crema` sobre `--tinta` |
| `.hilo` | relleno 4/2/10, separación 12, scroll fino `--linea-hover` |
| `.m-u` (vos) | a la derecha, ancho máximo 84 %, fondo `--s3`, borde `--linea`, radio `14 14 4 14`, `--t-cuerpo` `--crema` |
| `.m-m` (la mascota) | sin globo; `500 13px/1.6 var(--f)` `--crema`, relleno izquierdo 16; `::before` es el hilo: 2 px, radio 2, `linear-gradient(var(--c), color-mix(in srgb, var(--c) 10%, transparent))` |
| `.quien` | rótulo `--t-rotulo` en mayúsculas con espaciado .12em, `--tenue`, y un punto de 6 px de `--c` |
| `.espera` | borde punteado `--linea-hover`, radio 14, relleno 12/14; pasos `--t-chico`: pendiente `--tenue`, actual `--crema` en 700 con el punto `--c` latiendo, hecho `--crema2` con el punto `--verde`; reloj `--t-mono` con cifras tabulares |
| `.err` | borde `rgba(255,122,107,.4)`, fondo `rgba(255,122,107,.07)`, radio 14; título `--t-cuerpo-f` `--rojo` con el ícono de nube con x |
| `.campo` | fondo `--s1`, borde `--linea`, radio 14; con foco: borde `--ambar` y anillo `0 0 0 3px rgba(242,182,50,.14)` |
| Enviar | círculo de 36, `--ambar` sobre `--negro`; deshabilitado `--s3`/`--tenue` |
| Frenar | píldora de 36, borde `rgba(255,122,107,.55)`, texto `--rojo`, cuadrado de 9 delante |
| Chip de adjunto | fondo `--s2`, radio 12; documento de 26 × 32 `--crema` con la extensión en `600 7px var(--m)` |
| `.soltar` | `inset: 40px 0 0` del área de la charla, borde punteado de 2 px `--c`, fondo `color-mix(in srgb, var(--c) 12%, rgba(8,8,10,.9))`, radio 18 |
| Cajón | 300 de ancho, fondo `--s1`, borde derecho `--linea-hover`; velo `rgba(0,0,0,.55)` sobre el resto de la hoja |
| `.marca.mudada` | el Avi al `opacity: .14` con `grayscale(1)`; "en la charla →" en `--t-mono-s` `--crema2`, con un punto `--c` y brillo de 8 px |

### 5.2 Contraste (WCAG, calculado sobre los valores de los tokens)

| Par | Relación | Uso |
|---|---|---|
| `--crema` sobre `--negro` | 17,69:1 | texto de las respuestas |
| `--crema2` sobre `--negro` | 10,31:1 | estado del escenario |
| `--crema2` sobre `--s2` | 9,03:1 | carpeta, sugerencias |
| `--tenue` sobre `--negro` / `--s1` / `--s2` | 5,65 / 5,26 / 4,95:1 | rótulos, pistas, metadatos |
| `--crema` sobre `--s3` | 14,15:1 | tus mensajes |
| `--rojo` sobre `--negro` / `--s1` | 8,25 / 7,68:1 | errores, Frenar |
| `--negro` sobre `--ambar` | 11,51:1 | Enviar, botón primario |
| `--crema` sobre `#08080A` | 16,85:1 | bloques de código |

`--c` nunca lleva texto: solo el hilo, los puntos, el cursor, el borde de soltar y el brillo del escenario. Algunas especies tienen poco contraste sobre negro, así que el estado nunca depende de `--c`.

### 5.3 La mascota en la charla

- El Avi del escenario mide 96 y siempre va en **forma base**, aunque Claude esté coordinando un equipo, porque la charla no es esa sesión. **(D5)**
- Sin mirada ni juegos: solo las poses de 3.3 y sus bucles CSS de reposo (`especies.css`).
- La boca habla con `duracionContando(palabrasDelTramo)`, por cada tramo que llega.
- El fantasma de la barra conserva la forma que tenga (base o evolucionada).

### 5.4 Iconos

Los del boceto, en SVG de 16, trazo de 1,4 a 1,9 y `currentColor`: carpeta, flecha, reloj, ×, clip, flecha arriba, nube con x. Van como constantes en `chatVista.js`.

### 5.5 Medidas con zoom

Todo en px CSS: el zoom de 100 a 200 % de `<html>` escala la hoja igual que el tablero. `rectHoja` multiplica por `z`.

### 5.6 Markdown seguro (`markdownSeguro(texto)` en `chat.js`)

- Escapa todo con `escapar` y después reconoce solo este subconjunto: `#`/`##`/`###` → `h4`; párrafos; `-`/`*` → `ul`; `1.` → `ol`; bloques de código cercados con su lenguaje → `pre > code` (con el rótulo del lenguaje y el botón "Copiar código"); código en línea → `code`; `**negrita**` → `b`; `*itálica*` → `i`; tablas → `pre` en mono.
- **Los enlaces quedan como texto** (`[texto](url)` → "texto (url)"), sin `href`. **(D15)**
- Las imágenes Markdown se descartan.
- Nada de HTML crudo, ni atributos, ni `style`.

## 6. Movimiento

anime.js v4 (`createTimeline`, `animate`, `stagger`) en **`chatMotion.js`**, con CSS para los bucles. Todo dentro de `prefers-reduced-motion: no-preference` y `body:not(.pausa)`. Curvas: `--ease` (`cubic-bezier(.16,1,.3,1)`) para entrar y `--rebote` para el clic.

### 6.1 Abrir la hoja (`abrirHoja`, el acto estrella, unos 1100 ms en total)

| t (ms) | Qué |
|---|---|
| 0 | El Avi de la marca se agacha (`scaleY .9`, 120 ms). Se clona en una capa fija (`.vuela`, 112 × 112, en la posición de la marca). El original pasa al 14 % y a grises en 400 ms |
| 80 | La hoja se despliega desde el lado del tablero: `clip-path: inset(0 100% 0 0 round 26px)` → `inset(0 round 26px)` (o desde la derecha si va a la izquierda) más `translateX(∓30px → 0)`, 640 ms, `--ease` |
| 120 | La mascota vuela, 900 ms, `cubic-bezier(.45,0,.2,1)`. Cuadros clave: `translate(0,0) scale(1)` → al 50 %, `translate(dx·.45, dy·.45 − 120) scale(1.08) rotate(∓10deg)` → al 86 %, `translate(dx,dy) scale(96/112·1.06) rotate(±3deg)` → `translate(dx,dy) scale(96/112)`. Las alas, colas y tentáculos llegan tarde (`g.inclina` con 80 ms de retraso). Al aterrizar: un rebote y un destello del piso del escenario (`opacity 0 → .7 → .5`, 300 ms) |
| 600 | El nombre y el estado del escenario, la cabecera, la bienvenida o el hilo y el composer suben 10 px y aparecen, escalonados 45 ms, 520 ms cada uno |
| 1020 | Se quita el clon y aparece el Avi real del escenario (mismo cuadro, sin salto). El foco va al textarea |

`dx` y `dy` salen de `getBoundingClientRect` del fantasma y del lugar del Avi en el escenario. Al cerrar (`cerrarHoja`, unos 700 ms) es al revés: el contenido se funde en 160 ms, la mascota vuela de vuelta con el arco invertido (700 ms), la hoja se pliega (420 ms, `--ease-cierra`) y el fantasma recupera el 100 % y el color.

### 6.2 Durante la charla

- **Texto en streaming:** cada tramo se agrega al final como nodos nuevos, nunca reescribiendo `innerHTML`, porque eso reinicia la animación de todo lo que ya estaba. Cada palabra nueva entra con `.w` (`opacity 0 → 1`, `blur(3px) → 0`, 360 ms, CSS). Los tramos se juntan por cuadro (`requestAnimationFrame`).
- **Markdown progresivo:** el texto se parte en bloques separados por línea en blanco o por cercas de código. Los bloques cerrados se dibujan con `markdownSeguro` y quedan quietos; el bloque abierto va como texto escapado con `.w`. Cuando un bloque se cierra, se reemplaza por su versión dibujada, en su lugar y sin animar. Al terminar el turno, los `.w` se aplanan (sin spans) para no cargar el DOM.
- **Cursor:** un bloque de 7 × 13, `--c`, que parpadea a 1 Hz (`steps(2)`).
- **Chispa del hilo:** `.m-m.vivo::after`, un punto de 8 px de `--c` con un brillo de 12 px que baja de arriba abajo del hilo cada 1300 ms, lineal, apareciendo y desapareciendo en el 15 % de cada punta. Corre solo en el turno en curso.
- **Espera:** el punto del paso actual late (`box-shadow` 0 → 7 px, 1,2 s), la barra indeterminada recorre de izquierda a derecha en 1,4 s y el Avi hace `calienta` y después `pensando`.
- **Respuesta lista:** el pie "Copiar · {n} s" aparece en 200 ms y el Avi se pone `feliz` durante 1,6 s.
- **Soltar:** la capa entra en 300 ms (`translateY(-6px) scale(.98) → none`) y el documento flota (`rotate(-8deg) → rotate(-3deg) translateY(-8px)`, 1,4 s, ida y vuelta). Al soltar, el chip nace desde el centro de la capa hacia su lugar en el composer (`scale .6 → 1`, 420 ms, `--rebote`) mientras la capa se funde.
- **Cajón y menú:** el cajón entra con `translateX(-100%) → 0` (420 ms, `--ease`) y el velo se funde en 300 ms. El menú cae 6 px y aparece en 260 ms.
- **Hover:** las sugerencias se corren 3 px a la derecha y su borde pasa a `--c` (200 ms). Los botones `.ic` toman fondo `--s3`. Enviar se achica a `scale(.9)` al presionarlo.

### 6.3 Movimiento reducido y pausa

- Sin vuelo: el fantasma y el Avi del escenario se funden (160 ms). La hoja aparece con un fundido de 160 ms, sin `clip-path`.
- Sin `.w`, sin chispa, sin cursor que parpadea, sin documento flotando, sin cajón deslizante (aparece).
- El texto llega igual, de a tramos, al ritmo de Rust.
- Con `body.pausa` o la hoja plegada: no corre ningún bucle y el texto que llega se agrega sin animar.

## 7. Contrato con Rust: Claude Code (`widget/src-tauri/src/chat.rs`)

### 7.1 Argumentos (fijos; un test lo exige, entrega 1)

```
claude -p --input-format stream-json --output-format stream-json --verbose
  --include-partial-messages --replay-user-messages
  --permission-mode manual
  --tools Read,Glob,Grep --allowedTools Read,Glob,Grep
  --permission-prompts none --safe-mode --strict-mcp-config
  --settings <config>/chat/ajustes.json
  --append-system-prompt <INSTRUCCION_CHAT con la mascota>
  --max-budget-usd 2
  ( --resume <sesionClaude> | --session-id <uuid nuevo> )
```

- **Obligatorio (medido):** el usuario tiene `defaultMode: bypassPermissions`. Por eso `--permission-mode manual` es explícito y `--tools Read,Glob,Grep` es la barrera real: sin Bash ni Write no hay comandos ni escrituras. `--allowedTools` solo no frena nada. La función pura `argumentos_chat(&Pedido) -> Vec<String>` arma la lista; los tests exigen las dos banderas con esos valores exactos y la ausencia de `bypassPermissions`, `--dangerously-skip-permissions`, `Bash`, `Write`, `Edit` y `WebFetch` en cualquier argumento.
- **`--strict-mcp-config`** deja afuera los MCP del usuario, incluido `mem_save` de Engram, que escribe.
- **`--session-id <uuid>`** en la primera vuelta, generado por Avis: así se conoce el id antes del `init` y se guarda enseguida en la conversación. Después se usa `--resume <id>`: repetir un `--session-id` falla sin escribir nada en stdout ("Session ID … is already in use" en stderr, medido en E0). La sesión cuenta como usada con su primer `init` o eco: un proceso precalentado que se cerró sin mensaje deja volver a usar el mismo `--session-id` (medido en E1). Si stderr dice "already in use", Rust la marca usada y el próximo intento retoma.
- **`--max-budget-usd 2`** por proceso es un tope de seguridad; si salta, el error es `tope`. No se muestra ningún costo (lo pidió #22: el costo medido es ambiguo). **(D16)**
- Sin `--model`: usa el modelo por defecto del usuario. **(D17)**
- **El ejecutable:** la búsqueda de `primeros_pasos::ruta(Programa::Claude, …)` (si encuentra el `claude.cmd` de npm, corre directo el `node_modules@anthropic-aiclaude-codeinclaude.exe` que tiene al lado, sin pasar por `cmd.exe`: `claude_directo`), sin consola (`CREATE_NO_WINDOW`), con el cwd de la conversación (o `<config>/chat/trabajo` con "Solo Avis") y metido en el Job Object de `modelo.rs`, para que muera con Avis.
- **`--safe-mode` (medido en E0):** funciona con la suscripción y baja el contexto de ~40 000 a ~6 500 tokens (sin CLAUDE.md, skills, hooks, plugins ni estilos del usuario). **Se suma, no reemplaza:** solo, el `init` sigue listando `oficina`, `engram` y el estilo del usuario aunque no corran; con `--settings` (7.2) y `--strict-mcp-config` el `init` queda limpio y se puede verificar. Los tests de `argumentos_chat` exigen las tres. **(D34)**
- **La mascota de una charla es la del primer mensaje (medido en E0):** al retomar con `--resume`, otro `--append-system-prompt` no cambia el nombre (`--system-prompt-snapshot`, prendido por defecto, reusa el primero, y la charla ya lo dijo). Una charla vieja sigue con su nombre aunque se cambie la especie; las nuevas usan la nueva.

### 7.2 `ajustes.json` del chat (lo escribe Rust al arrancar, siempre igual)

```json
{ "enabledPlugins": { "oficina@quintech": false, "engram@engram": false },
  "disableAllHooks": true,
  "outputStyle": "default" }
```

- `oficina@quintech: false` **(medido):** sin esto el chat aparece como una sesión más en Avis y en GitHub. Lo pidió el orquestador.
- `engram@engram: false` y `disableAllHooks` **(D18):** los hooks del usuario (caveman, Engram, `matar-huerfanos`) cambiarían la voz del chat, escribirían memorias en el proyecto de la carpeta y podrían barrer procesos. El historial lo guarda Avis por su cuenta (9.2).
- `outputStyle: "default"` **(D18):** el estilo del usuario no es la voz de Avis.
- **Medido en E0:** `--settings` le gana a `~/.claude/settings.json` en `disableAllHooks` (ninguna línea `system/hook_*`), `outputStyle` (`"default"` en el `init`) y `enabledPlugins` (ni `oficina` ni `engram`).

### 7.3 Ciclo de vida del proceso

- **Uno por conversación abierta, de larga vida:** stdin abierto, stdout leído línea a línea en un hilo, stderr solo al log (siempre trae un aviso de MCP bloqueados por la política, que no es un error).
- **Precalentar (D19):** al abrir la hoja (o cambiar a una conversación) con el motor Claude Code, Rust lanza el proceso **sin mandar nada**, para que el arranque pase mientras el usuario escribe. **Medido en E0:** sin mensaje, el proceso no escribe nada ni gasta tokens (el primer turno cuesta lo mismo que en frío); el `init` llega recién con el primer mensaje, así que el `listo` del proceso no se conoce antes. Ahorra de 1 a 5 s (con `--safe-mode`, el `init` llega a 0,3–0,9 s del envío precalentado y a 1,2–5,8 s en frío).
- **Inactividad:** sin turnos durante 10 min (`INACTIVIDAD`, el mismo valor que el motor local), Rust cierra stdin. Cerrar el proceso así no corta un turno: lo deja terminar. El próximo mensaje relanza con `--resume`.
- **Cerrar la hoja** no cierra el proceso (cuenta la inactividad). **Cambiar de conversación** cierra el stdin del proceso anterior. **Salir de Avis:** primero la interrupción si hay un turno, después cierra stdin, espera 2 s y por último el Job Object.
- **Uno por vez:** como mucho un proceso de chat vivo. **(D20)**

### 7.4 Entrada (stdin, una línea JSON por mensaje)

```json
{"type":"user","message":{"role":"user","content":[
  {"type":"text","text":"<avis>\n…datos_como_texto(datos)…\n</avis>"},
  {"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"…"}},
  {"type":"text","text":"Resumime este presupuesto en 5 puntos"}]}}
```

- **Contexto de Avis:** el bloque `<avis>` sale de `modelo::datos_como_texto` sobre `datosAvis(st.proyectos)`, con las `CLAVES_PROHIBIDAS` de siempre (sin archivos, notas, borradores, respuestas ni repo). Va solo si cambió desde el último turno de esa conversación (`firmaDatos`, guardada en Rust). **(D21: los datos de las sesiones viajan a Claude, la nube, porque responder sobre las sesiones lo requiere. Son los mismos que el mod ya publica, menos las claves prohibidas.)**
- **Adjuntos (10):** PDF → bloque `document`; imágenes → bloque `image` (medido en E0 con PNG); texto y código → bloque `text` con "Archivo: {nombre}" y el contenido en una cerca. Los bytes los lee Rust desde la ruta; la ventana nunca los toca.
- El eco de `--replay-user-messages` (`isReplay: true`) confirma que el mensaje entró. **Repite el contenido entero, base64 incluido** (medido en E0: una línea de 20 MB por stdout con un PDF de 15 MB): Rust lee líneas sin tope chico, no las guarda ni las anota en el log, y del eco solo usa el `type` y el `isReplay`. Si a los 15 s del envío no llegó el eco ni ningún evento del turno, el error es `proceso`.

### 7.5 Salida: de stream-json a eventos de la ventana

`evento_de_linea(&Value) -> Option<EventoChat>` es pura, con un test por fila sobre las líneas medidas en E0, guardadas en `widget/src-tauri/src/fixtures/chat/*.jsonl` (la lista está en `docs/investigacion/chat-claude-code.md` 7).

| Línea de Claude Code (medida) | `EventoChat` → `oficina://chat` |
|---|---|
| `system/init` | `{ tipo: "listo", sesion }` (el proceso queda `listo`; si había un frenar pendiente, se manda ahora) |
| `system/status` `requesting` | `{ tipo: "pidiendo" }` → paso 1 |
| `stream_event` `content_block_start` de tipo `thinking`, o `system/thinking_tokens` | `{ tipo: "pensando" }` → paso 2 |
| `stream_event` `content_block_delta` `text_delta` | `{ tipo: "texto", texto }` (Rust junta los deltas cada 50 ms) |
| `assistant` con `tool_use` (`Read`, `Glob`, `Grep`) | `{ tipo: "herramienta", nombre, detalle }`, donde el detalle es solo el nombre del archivo, el patrón o la búsqueda, nunca la ruta completa |
| `system/task_summary` | se ignora (las herramientas ya cubren eso) |
| `result` `success` con `is_error: false` | `{ tipo: "fin", ms: duration_ms }` |
| `result` con `is_error: true`, aunque diga `success` (medido en E0: así llegan sin red y sin sesión) | `{ tipo: "error", motivo: motivo_de_result(..) }` (7.7) |
| `system/api_retry` (medido en E0: uno por intento, hasta 10, durante 3 min) | `{ tipo: "reintento", intento, maximo }`. Con `error_status: null` (sin respuesta del servidor) y `intento ≥ 3`, Rust manda la interrupción (7.6) y emite `{ tipo: "error", motivo: "red" }` una sola vez **(D33)** |
| `result` `error_during_execution` con `terminal_reason: aborted_streaming` | `{ tipo: "frenada" }` |
| `result` de error con otro motivo | `{ tipo: "error", motivo: motivo_de_result(..) }` (7.7) |
| `rate_limit_event` con `rate_limit_info.status: "rejected"` (nunca `overageStatus`, que viene `rejected` con el uso permitido: medido en E0) | `{ tipo: "error", motivo: "limite" }` |
| `user` con `isReplay` | `{ tipo: "recibido" }` |
| `system/hook_*`, `system/ui_status`, `system/post_turn_summary`, `user` con `tool_result` | se ignoran |
| el proceso terminó sin un `result` en un turno en curso | `{ tipo: "error", motivo: "proceso" }` |

Cada evento lleva `{ conversacion, turno }`; la ventana descarta los de una conversación o un turno que ya no es el actual. **Costo:** `total_cost_usd` se ignora (es ambiguo, medido).

### 7.6 Frenar

- `chat_frenar` manda `{"type":"control_request","request_id":"int-<n>","request":{"subtype":"interrupt"}}` (medido: responde en menos de 10 ms, el texto parcial queda en un `assistant` y el proceso sigue vivo).
- **Solo después del `init` o de algún `stream_event` del turno** (medido: antes no hace nada y el mensaje se responde igual). Si llega antes, queda pendiente y sale con el primer evento del turno. La ventana pasa a `frenada` al instante y descarta lo que llegue después del clic.
- El parcial que se guarda es el que se vio en la ventana.

### 7.7 Motivos de error (`motivo_de_result`, puro)

`red` (medido en E0 con un proxy caído: `is_error: true`, `terminal_reason: "api_error"` y `result` "API Error: Connection refused … (ECONNREFUSED)" o, sin DNS, "API Error: Can't reach the API server — check your internet or DNS (ENOTFOUND)", a los 183 s; antes, los `api_retry` de 7.5), `sesion` (medido: `is_error: true`, `terminal_reason: "api_error"`, `result` "Not logged in · Please run /login"), `limite`, `tope` (medido: `subtype: "error_max_budget_usd"`, `terminal_reason: "budget_exhausted"`), `limite` (supuesto, no se pudo provocar: `api_error_status: 429` o un texto con "limit" y "usage" o "hit your"; además del `rate_limit_event` rechazado de 7.5), `tiempo` (3.3), `proceso` (el proceso murió o terminó sin `result`), `sin-claude` (`ruta` devolvió `None` o falló el spawn) y `otro` (cualquier otro; usa el texto de `proceso`, con el detalle en `title`).

### 7.8 Comandos y eventos de Tauri

| Comando | Qué hace |
|---|---|
| `chat_abrir({ conversacion, motor, carpeta, mascota, sesionClaude? })` | Precalienta (D19) y devuelve `{ proceso, sesion, motivo?, engram, local }`. `mascota` va a `--append-system-prompt`; `sesionClaude` es la de una charla que ya tuvo mensajes (se retoma con `--resume`); sin ella, Rust genera el UUID y lo devuelve en `sesion`. `proceso`: `arrancando` (precalentado), `listo` (ya tuvo un turno y sigue vivo) o `apagado` (motor local, o `motivo: "sin-claude"`). `engram` queda `sin-saber` hasta la entrega 4 |
| `chat_enviar({ conversacion, turno, texto, adjuntos: [ruta], datos })` | Manda un turno; con el motor local, va a 8. Con un turno en curso, o sin texto, devuelve error (D7). Sin `claude`, emite `error` con `sin-claude`. `adjuntos` llega con la entrega 5 |
| `chat_frenar({ conversacion, turno })` | 7.6 |
| `chat_cerrar({ conversacion })` | Cierra stdin |
| `chat_historial({ buscar? })` | Lista (9.1) |
| `chat_leer({ id })` | Conversación completa |
| `chat_borrar({ id })` | Archivo + Engram (9.2) |
| `chat_adjunto({ ruta })` | Valida y devuelve `{ nombre, tipo, bytes, paginas? }` o `{ error }` (10) |
| `elegir_carpeta()` | Selector nativo (D10); `null` si se canceló |
| `guardar_chat({ motor, carpeta })` | Guarda en `preferencias.json` → `chat` el motor y la carpeta de la próxima charla (D11) y suma la carpeta a las recientes (5, sin repetir; lo decide Rust, `con_reciente`). Devuelve `{ motor, carpeta, recientes }`, como `estado_menu().chat`, que al arrancar trae lo mismo con solo las carpetas que siguen existiendo (E2) |
| `estado_modelo()`, `descargar_modelo()` y `cancelar_modelo()` | 3.6 (`cancelar_modelo` es el `cancelar_resumen` de antes, sin el pedido: corta la descarga o el arranque del motor) |

Eventos: `oficina://chat` (7.5), `oficina://modelo` (descarga y motor local) y los de arrastrar de Tauri (10).

## 8. Motor local en la charla

- El de hoy: Qwen3-4B-Instruct-2507 Q4_K_M con `llama-server` (`modelo.rs`), sin cambiar el modelo ni el contexto (`-c 4096`). **Sin `--jinja`**, porque no hay herramientas. El usuario frenó la descarga de modelos nuevos.
- **Pedido:** `POST /v1/chat/completions` con `stream: true` (SSE, `data: {…choices[0].delta.content}`) y `cache_prompt: true`, en `chat_local.rs` (o una sección nueva de `modelo.rs`). Los tramos salen como `{ tipo: "texto" }` del mismo `oficina://chat`, así la ventana no distingue motores.
- **Mensajes:** sistema = `INSTRUCCION_CHAT_LOCAL` (la de 4.3, sin herramientas y con "si no sabés algo de las sesiones, decilo") + el bloque `<avis>`; después, la historia.
- **Presupuesto de contexto (`recorteLocal`, puro):** hasta 3000 tokens de entrada, estimados en 3,5 caracteres por token. El bloque `<avis>` (como mucho los 6000 caracteres de `TOPE_DATOS`) y el último mensaje siempre van; se suman turnos anteriores del más nuevo al más viejo mientras entren. `max_tokens: 700`. **(D22)**
- **Frenar:** cortar la conexión HTTP. llama-server deja de generar y el parcial queda.
- **Estados:** `falta` → la tarjeta de descarga (4.1); `bajando` → el progreso; `roto` → error `local`. Lo demás reusa `apagar_motor` y la inactividad de `modelo.rs`.
- **Sin adjuntos ni carpeta** (3.4). Las sugerencias del local hablan solo de las sesiones.

## 9. Historial

### 9.1 En la PC (la fuente de verdad)

- `<config de la app>/chat/<id>.json`, uno por conversación, con escritura atómica (`.tmp` + rename, como `ordenes.rs`):

```json
{ "v": 1, "id": "c-<uuid>", "titulo": "¿En qué anda cada sesión", "creada": "…", "actualizada": "…",
  "motor": "claude" | "local", "carpeta": "C:\\…" | null, "sesionClaude": "<uuid>" | null,
  "engramId": 123 | null,
  "mensajes": [ { "rol": "usuario" | "mascota", "texto": "…", "cuando": "…",
                  "estado": "ok" | "frenada" | "no-enviado" | "error",
                  "adjuntos": [ { "nombre": "presupuesto-2027.pdf", "tipo": "pdf", "bytes": 1468006, "paginas": 14 } ],
                  "herramientas": [ { "nombre": "Read", "detalle": "README.md" } ], "ms": 18000 } ] }
```

- **Los adjuntos no se guardan, solo su nombre y tamaño. (D23)** (La transcripción propia de Claude Code sí guarda los PDF en base64 en `~/.claude/projects`, medido; queda anotado en 11.)
- Se guarda al mandar un mensaje (`no-enviado` hasta el eco), en cada `fin`, `frenada` o `error`, y cada 2 s mientras llega texto.
- **Listar:** los 100 más recientes por fecha de modificación, leyendo solo la cabecera (todo menos `mensajes`). Buscar compara sin tildes ni mayúsculas contra el título y el texto (`coincideBusqueda`, pura). Un archivo roto se salta y se anota en `widget.log`; nunca se borra solo.
- **Borrar:** el ítem del cajón tiene "Borrar" en su menú contextual (clic derecho o la tecla Menú) y confirma en el mismo botón ("¿Borrar? Sí", 3 s, como Frenar en `control.js`). **(D24)**

### 9.2 Engram (copia buscable, si está; desde Rust, `engram.rs`)

Todo según `engram-para-avis.md` 5, con `ureq` desde Rust. Desde la ventana no se puede: la CSP bloquea 127.0.0.1:7437.

- **Detectar:** `GET http://127.0.0.1:{ENGRAM_PORT|7437}/health` con 1 s de espera, al abrir la hoja y como mucho cada 5 min. Cualquier error significa "no hay". **Nunca** se arranca ni se frena Engram, nunca se usa `GET /project/current` (escribe) y nunca `engram` por línea de comandos.
- **Sesión:** una por arranque del widget, `POST /sessions {id:"avis-<arranque>", project:"avis", ownership_mode:"project_owned", isolated:true}`; `isolated` solo si `/health` trae `capabilities.isolated_session_registration`. Se cierra con `POST /sessions/{id}/end` al salir.
- **Guardar (en cada `fin`):** `POST /observations {session_id, project:"avis", scope:"project", type:"conversation", topic_key:"avis/chat/<id>", title:"Chat de Avis · <fecha> · <titulo>", content, capture_prompt:false, operation_id:"avis-<id>-<n>"}`. El contenido son líneas "Vos: …" y "{Mascota}: …", del final hacia atrás hasta 8000 caracteres, sin el bloque `<avis>`. El `id` que devuelve va a `engramId`.
- **Reintentar:** con error de red o un `500`, `GET /observations/save-result?operation_id=…`; solo un `404` con `observation_save_result_not_found` autoriza reenviar. Nunca a ciegas.
- **Borrar:** `DELETE /observations/{engramId}?expected_project=avis`. Si existe `ENGRAM_HTTP_TOKEN` en el entorno, todos los pedidos llevan `Authorization: Bearer <token>`.
- **Solo lo de Avis:** nunca se edita ni se borra una observación sin `project: "avis"` y `topic_key` con prefijo `avis/`.
- **Leer:** en esta entrega el cajón lee solo los archivos locales. Engram es la copia para buscar después (memorias y mails quedan fuera). **(D25)**

## 10. Adjuntos y arrastrar

- **Tauri 2 intercepta los archivos que se sueltan** (`dragDropEnabled` viene prendido): no llegan los `drop` de HTML. Se usa `getCurrentWebview().onDragDropEvent`, con los tipos `enter`, `over`, `drop` y `leave`, `paths` y `position` en px físicos. La ventana nunca lee los bytes: manda las rutas a `chat_adjunto`.
- **Solo sobre la hoja:** `dentroDe(position / devicePixelRatio, rectDeLaHoja)` (la función de `muesca.js`). Fuera de la hoja, o con la hoja cerrada o plegada, soltar no hace nada. **(D26)** E0 lo verificó en el código de wry 0.57.3 y tao 0.37.3, sin el mouse (la Avis instalada estaba abierta y la instancia única no deja abrir otra): wry registra su `IDropTarget` en la ventana y da la posición en px físicos relativos a la ventana; fuera de la zona, `set_ignore_cursor_events` pone `WS_EX_TRANSPARENT | WS_EX_LAYERED` y Windows le pasa el archivo a lo que hay debajo. La prueba con el mouse queda en la aceptación de la entrega 5.
- **Tipos:** PDF (`document`); PNG, JPG, GIF y WebP (`image`; PNG medido en E0, el resto supuesto); texto y código (`.txt .md .json .csv .js .ts .tsx .rs .py .html .css .yml .toml .sql .log`, UTF-8 válido, hasta 200 KB, como `text`). Cualquier otro se rechaza con el error `adjunto`.
- **Tamaño:** hasta 20 MB por archivo y 5 archivos por mensaje. **(D27: un PDF de 15 MB entra, medido en E0; el techo real no se buscó y 20 MB queda como margen bajo los 32 MB de la API.)**
- `chat_adjunto` devuelve las páginas del PDF contando `/Type /Page` (estimado; si falla, sin cifra).
- **Adjuntar con el clip:** el selector nativo de archivos (`tauri-plugin-dialog`, D10), con los mismos filtros.
- **Motor local:** soltar muestra la capa con "El modelo local no lee archivos · Cambiá a Claude Code" y no adjunta nada.

## 11. Seguridad y privacidad

- **Solo responde, por construcción:** `--tools Read,Glob,Grep` y `--permission-mode manual` (7.1), sin MCP, sin hooks y sin plugins de terceros (7.2). Lo fijan los tests de `argumentos_chat`; cualquier cambio a esa lista vuelve a diseño.
- **Lectura amplia (medido):** Read puede leer fuera de la carpeta sin pedir permiso. Se acepta: la respuesta solo vuelve al mismo usuario y el chat no tiene red propia (sin WebFetch ni Bash). Un PDF con instrucciones escondidas podría pedirle leer otros archivos, pero el resultado solo se ve en la hoja. **(D28)**
- **El texto del modelo nunca es HTML** (5.6) y los enlaces no se abren.
- **Datos hacia la nube:** el bloque `<avis>` con las `CLAVES_PROHIBIDAS` de siempre (D21) y lo que el usuario escribe o adjunta. El motor local no sale de la PC (la única salida a la red sigue siendo la descarga con un clic).
- **Rastros:** la transcripción de Claude Code en `~/.claude/projects/<cwd>/<id>.jsonl` (con los PDF en base64) y el historial de Avis (sin adjuntos). Al borrar una charla en Avis no se borra esa transcripción. **(D29: se dice en el `title` de Borrar: "Borra la charla de Avis. Claude Code guarda su propia copia".)**
- **Modelo de amenaza:** el mismo que `respuestas/` y `ordenes/`. Cualquier proceso del usuario puede leer `<config>/chat/`.

## 12. Accesibilidad

- **Nombres:** marca "Charlar con {Mascota}"; hoja "Charla con {Mascota}"; textarea "Mensaje para {Mascota}"; "Adjuntar archivo", "Enviar", "Frenar la respuesta", "Historial", "Cerrar la charla", "Carpeta: {nombre}", radiogroup "Motor"; "Quitar {nombre}"; "Copiar respuesta"; "Copiar código".
- **Anuncios** (`#anuncio-chat`, polite), una vez por cambio: "{Mascota} está pensando" (al mandar), "{Mascota} respondió: {primeros 140 caracteres}" (en `fin`), "Respuesta frenada", "Adjuntaste {nombre}". Los errores van en `role=alert` dentro de su tarjeta. **El hilo no se anuncia mientras llega el texto** (`aria-live=off`): sería un tramo cada 50 ms. **(D30)**
- **Encabezados:** la hoja no agrega niveles. Los `h4` del Markdown quedan dentro de `role=log`, que no entra en el esquema del documento. El `h1` sigue siendo el título del tablero.
- **Foco:** visible en todo, con el anillo `--ambar` de 2 px y separación 2 (como hoy). El orden y las trampas están en 3.5.
- **Objetivos:** como mínimo 32 × 32 px CSS a 100 % (los `.ic`), 36 en Enviar y Frenar. Avis es de escritorio con mouse, igual que la barra de control. **(D31)**
- **Color:** el estado nunca depende solo del color (texto en cada paso, "■ frenaste acá", "No se envió", títulos de error). `--c` es decorativo.
- **Movimiento:** 6.3. Nada titila más de 3 veces por segundo: el cursor va a 1 Hz y la chispa a 0,77 Hz.

## 13. Rendimiento

- **Streaming:** Rust junta los deltas cada 50 ms; la ventana pinta como mucho una vez por cuadro; los nodos se agregan sin reescribir. Al terminar se aplanan los `.w`.
- Con más de 200 mensajes visibles, el hilo dibuja los últimos 60 y suma un botón "Ver mensajes anteriores". **(D32)**
- **Nada corre** con la hoja plegada, escondida, minimizada, en pausa o fuera de la vista. Rust sigue juntando y guardando el texto.
- **El vuelo** anima solo `transform` y `opacity` sobre el clon, y `clip-path` sobre la hoja: 60 fps al 200 %.
- El sondeo de 1,5 s de `main.js` no toca la hoja. La hoja se redibuja solo por sus eventos y por un cambio de especie o de lado.

## 14. Casos de prueba

### 14.1 Lógica pura (`widget/test/chat.test.js`)

1. `ladoHoja`:
   - flotando con lugar a la derecha → `derecha`; sin lugar a la derecha pero sí a la izquierda → `izquierda`; sin lugar → `encima`.
   - acoplada: `derecha` → `izquierda`; `izquierda` → `derecha`; `arriba` sin lugar a la derecha → `izquierda`.
   - al 200 % con un área de 1366 → `encima`.
2. `rectHoja`: ancho 420·z, hueco 14·z, misma `y` y mismo alto que el tablero; con `encima` cubre desde la barra lateral.
3. `zonaInteractiva` con la hoja: la unión exacta del tablero y la hoja; sin la hoja, la de hoy, sin cambios en ningún modo.
4. `transicionChat`:
   - `vacio` + `enviar` → `esperando` con el efecto `chat_enviar`.
   - `esperando` + `texto` → `escribiendo`; `escribiendo` + `fin` → `listo`; `listo` + `enviar` → `esperando`.
   - `escribiendo` + `frenar` → `frenada` al instante, con el efecto `chat_frenar`; un `texto` del mismo turno después de frenar se descarta.
   - un evento de otra conversación o de un turno viejo → sin cambios.
   - `error` conserva el borrador y los adjuntos; `reintentar` manda el mismo texto con los mismos adjuntos.
   - `enviar` con un turno en curso → sin cambios (D7); `enviar` con el texto vacío y sin adjuntos → sin cambios.
   - Esc en este orden: menú > cajón > frenar > cerrar (3.5).
   - cambiar el motor o la carpeta con mensajes → conversación nueva; sin mensajes → solo la cabecera.
5. `pasoEspera`: 0 hasta `listo` (el `init` del turno); 1 hasta `pidiendo` o el primer `stream_event`; 2 hasta el primer `texto`. A los 45 s, la nota de "tardando"; a los 120 s sin eventos, `error` con `tiempo`.
6. `markdownSeguro`:
   - `<script>`, `<img onerror>` y `javascript:` salen como texto.
   - los enlaces quedan "texto (url)" sin `href`.
   - código cercado → `pre > code` con el lenguaje; listas anidadas de un nivel; `**` sin cerrar queda literal.
7. **Bloques progresivos:** un bloque abierto va como texto; al cerrarse por línea en blanco o por la cerca, se dibuja; los bloques cerrados no cambian con los tramos que siguen.
8. `textoHerramientas`: 1 Read → "Leyó **README.md**"; 6 Read → "Leyó **6 archivos**: README.md, docs/arquitectura.md…"; Grep → "Buscó «x» en {carpeta}"; Glob → "Miró «patrón»" (E2); nunca una ruta completa.
9. `grupoDeFecha`: hoy, ayer, esta semana (lunes a hoy, hora local) y antes; el cambio de día cae a las 00:00 locales.
10. `tituloConversacion`: las primeras 6 palabras, sin signos al final; vacío o solo un adjunto → "Charla sobre {nombre}".
11. `sugerencias(motor, carpeta)`: los textos de 4.1, con la carpeta interpolada; sin carpeta, los de sesiones.
12. `validarAdjunto({ nombre, bytes, tipo })`:
    - PDF de 20 MB entra; de 20 MB + 1 sale con `adjunto`.
    - `.xlsx` sale; `.ts` de 200 KB entra y de 200 KB + 1 sale.
    - un sexto archivo sale; con el motor local, todo sale.
13. `recorteLocal`: el bloque `<avis>` y el último mensaje siempre van; los turnos viejos se caen primero; nunca pasa de 3000 tokens estimados.
14. `coincideBusqueda`: sin tildes ni mayúsculas, contra el título y el texto.
15. `animoChat(estado, paso, hablando)`: la tabla de 3.3.

### 14.2 Rust (`chat_tests.rs`, `engram_tests.rs`, `historial_tests.rs`)

1. `argumentos_chat`:
   - contiene `--permission-mode manual` y `--tools Read,Glob,Grep`.
   - no contiene `bypassPermissions`, `skip-permissions`, `Bash`, `Write`, `Edit` ni `WebFetch`.
   - lleva `--session-id` la primera vez y `--resume` después, nunca los dos.
   - lleva `--safe-mode`, `--strict-mcp-config` y `--settings` con la ruta del chat (E0).
2. `ajustes.json`: exactamente 7.2.
3. `evento_de_linea`: una prueba por fila de 7.5, sobre las líneas de los fixtures de E0 (`src/fixtures/chat/`); una línea desconocida → `None`; un JSON roto → `None`, sin pánico. Las filas `system/hook_*` y `system/ui_status` no tienen fixture: con `--safe-mode` y `--settings` no aparecen (medido); se prueban como líneas desconocidas.
4. **Frenar** antes del `init` → pendiente, y sale con el primer evento; después del `init` → sale al instante.
5. `motivo_de_result`: cada motivo con su fixture.
6. **Proceso falso** (un ejecutable de prueba que reproduce un `.jsonl`):
   - un turno completo da `listo`, `pidiendo`, `texto`… y `fin`.
   - cortar el stdout a mitad → `proceso`.
   - stderr con el aviso de MCP → sin error.
7. **Historial:**
   - escribir y leer de nuevo; un archivo roto se salta.
   - listar en orden y con tope 100; borrar.
   - guardar dos veces a la vez no rompe el archivo.
8. **Engram** contra un servidor falso:
   - `/health` caído → "no", sin reintentos.
   - `isolated` solo con la capacidad.
   - el mismo `operation_id` no duplica; con `500`, primero consulta `save-result`.
   - Bearer solo si existe `ENGRAM_HTTP_TOKEN`.
   - nunca se borra algo sin `project: "avis"`.
9. **Local:** el cuerpo del pedido con `stream: true` y el recorte; el parseo de SSE con `data: [DONE]`.

## 15. Entregas

Son chicas y cada una se puede revisar sola. Las de código siguen el test primero (RED → GREEN) con `node --test` y `cargo test`.

0. **Medir (sin código de producto).** Se suma a `docs/investigacion/chat-claude-code.md`, con medido o supuesto en cada punto:
   - `--safe-mode` con la suscripción;
   - `--settings` con `disableAllHooks` y `outputStyle` contra la configuración del usuario;
   - lanzar el proceso sin mensaje: costo y tiempo hasta estar listo (D19);
   - el `result` sin red;
   - el bloque `image`;
   - `--append-system-prompt`;
   - el eco con `--session-id`;
   - un PDF de 15 MB;
   - los eventos de arrastrar con la ventana transparente y la zona activa.

   Las líneas reales quedan en `widget/src-tauri/src/fixtures/chat/*.jsonl` (al lado de los `*_tests.rs`, que ya viven en `src/`). **Hecha el 23/11:** resultados en `docs/investigacion/chat-claude-code.md` 7; corrigió 3.3, 4.1 (D13), 7.1 a 7.5, 7.7, 10 y 14. **Acepta:** cada supuesto de esta dirección que dice "E0" tiene su resultado, y si alguno cambia una decisión, la dirección se corrige antes de E1.
1. **El proceso de Claude Code en Rust** (`chat.rs`, `chat_tests.rs`): `argumentos_chat`, `ajustes.json`, spawn con `ruta` y el Job Object, `evento_de_linea`, frenar, inactividad y cierre, y los comandos `chat_abrir`, `chat_enviar`, `chat_frenar` y `chat_cerrar`. **Acepta:** los tests de 14.2 (1 a 6) en verde; con el `claude` real, un mensaje desde la consola de desarrollo llega a `oficina://chat` como texto en streaming; frenar a mitad deja el parcial y el proceso vivo; el `init` lista solo `Read`, `Glob` y `Grep` y no lista `oficina`.
   **Hecha el 23/11** (`chat.rs`, `chat_tests.rs` y los cuatro comandos en `lib.rs`): 55 tests de 14.2 (1 a 6), con procesos falsos de `cmd.exe` que leen una línea y escriben un fixture. Con el `claude` real (`cargo test real_ -- --ignored`, Haiku por `ANTHROPIC_MODEL`): el `init` trae `tools: ["Glob","Grep","Read"]`, `mcp_servers: []`, solo los plugins `cc-plugin-*` y `output_style: "default"`; el texto llega en `oficina://chat` antes del final; frenar con el primer texto da `frenada`, el proceso sigue vivo y el turno siguiente, en el mismo proceso, responde "Ascua". No se probó desde la consola de la ventana: la Avis instalada ocupa la instancia única (como en E0); el test real usa el mismo `Chat` que los comandos.
2. **La hoja y la conversación** (`chat.js`, `chatVista.js`, `main.js`, `index.html`, `estilos.css`), sin el vuelo, y **se retira el resumen** (3.6). Incluye los estados, el menú de carpeta con "Solo Avis", las recientes y "Elegir otra carpeta" (D10), el foco y el teclado, `markdownSeguro`, la geometría y la zona interactiva. **Acepta:**
   - los tests de 14.1 (1 a 12, 14 y 15) en verde;
   - `dev/vista.html?chat=vacio|esperando|escribiendo|listo|frenada|error-red|historial|soltar|encima` muestra cada estado;
   - Playwright al 100 y al 200 %: flotando con la hoja a la derecha, a la izquierda y encima, y acoplada en los cuatro bordes, sin solaparse con el tablero;
   - plegar a la muesca y a la tira y volver deja todo igual (borrador y scroll incluidos);
   - no queda rastro del resumen (ni `#resumen`, ni `pedir_resumen`, ni `resumen.js`);
   - la marca abre y cierra la hoja; Tab y Esc como en 3.5.

   **Hecha el 23/11** (`chat.js`, `chatVista.js`, la sección de la charla de `main.js`, `#hoja` en `index.html` y su CSS bajo `#hoja`): 49 tests en `widget/test/chat.test.js` (14.1 del 1 al 12, 14 y 15, más los textos de 4) y `zonaInteractiva` con la hoja en `muesca.js`. Se fue el resumen: `resumen.js`, `resumenMotion.js`, su test, `#resumen`, `#anuncio-resumen`, `pedir_resumen`, `cuerpo_pedido`, `PREGUNTA`; `estado_resumen` → `estado_modelo`, `cancelar_resumen` → `cancelar_modelo` y `oficina://resumen` → `oficina://modelo`; `datosResumen` → `datosAvis`, `duracionContando`, `contarPalabras` y `cifrasDescarga` a `chat.js`, y `animoTexto` (la descripción de la marca) a `tablero.js`. En Rust: `tauri-plugin-dialog` (D10) con `elegir_carpeta`, `guardar_chat` y `chat` en `estado_menu` (preferencias.rs, 3 tests), y una charla del motor local que nunca lanza `claude` (`chat_tests.rs`). La vista `dev/vista.html?chat=…` muestra cada estado (falso.js la lleva por `window.__chat`, el mismo camino que el usuario). No se miró con Playwright (lo usaba otro trabajo): la geometría y cada estado se revisaron en el DOM con Edge sin ventana, al 100 y al 200 %, flotando y acoplada en los cuatro bordes, sin errores en la consola. Queda la revisión visual a 375/768/1440 de la dirección, ahora sin el vuelo.
3. **Movimiento** (`chatMotion.js` y CSS): la mudanza, la apertura y el cierre, las palabras, la chispa, la espera, soltar, el cajón y el menú. **Acepta:**
   - las pistas de 6.1 dentro de ±30 ms;
   - 60 fps al 200 % en el panel de rendimiento;
   - con movimiento reducido, solo fundidos (6.3);
   - con pausa o plegada, ningún bucle;
   - las palabras ya puestas no se vuelven a animar (que la opacidad computada de la primera `.w` siga en 1 mientras llega el texto).
4. **El historial y Engram** (`historial.rs`, `engram.rs` y el cajón). **Acepta:**
   - los tests de 14.2 (7 y 8) en verde;
   - el historial sobrevive a cerrar y abrir Avis (lo pide #22);
   - con Engram apagado, "Engram apagado" en el pie y nada se rompe;
   - con Engram prendido, la charla aparece en `GET /search?q=…&project=avis&type=conversation` y no en el contexto de `oficina`;
   - borrar quita el archivo y la observación;
   - retomar una charla de Claude Code usa `--resume` y recuerda lo hablado.
5. **Adjuntos y arrastrar** (`chat_adjunto`, `onDragDropEvent`, la capa, los chips y el clip). **Acepta:**
   - los tests de 14.1 (12) en verde;
   - arrastrar un PDF real funciona y Claude lo lee (lo pide #22);
   - el `.xlsx` y el archivo de más de 20 MB muestran el error `adjunto`;
   - soltar fuera de la hoja no hace nada;
   - con el motor local se rechaza con su texto.
6. **El motor local en la charla** (`chat_local`, SSE y `recorteLocal`). **Acepta:**
   - los tests de 14.1 (13) y 14.2 (9) en verde;
   - una pregunta por las sesiones responde en streaming sin internet;
   - frenar corta la respuesta;
   - sin el modelo, la tarjeta de descarga y su progreso.
7. **Carpeta de los proyectos de la barra** (el mod publica `cwd`): `cwd` opcional en la `Presencia` **solo en el archivo local** (`~/.claude/oficina/sesiones/<id>.json`), nunca en el comentario de GitHub; el menú lista los proyectos con `cwd` conocido. Hay que subir la versión del mod (`plugin.json`) y publicarlo. **Acepta:** el test del mod que exige que `cwd` no salga en el comentario; la v0.x anterior sigue leyendo el archivo; el menú muestra "catalogo" con su carpeta cuando hay una sesión abierta ahí.

**No improvisar:** los argumentos y el `ajustes.json` de 7.1 y 7.2 (cualquier herramienta nueva vuelve a diseño); que el texto del modelo nunca sea HTML; los textos de 4; las pistas de 6.1; que nunca se mande nada sin un clic o Enter; que Engram solo se toque con `project: "avis"`.

## 16. Decisiones tomadas sin el usuario (para revisar)

Las tomaron el orquestador o la diseñadora, porque el usuario pidió avanzar sin preguntas.

- **Del orquestador, el 23/11:** la opción C; la charla se abre solo con el panel abierto y se pliega con él; las poses de la voz en todas las especies; Frenar sin confirmar y con Esc; con el motor local, la carpeta fija y sin adjuntos; "No se envió" con Reintentar y "Preguntarle al modelo local"; el historial por Hoy, Ayer y Esta semana; el placeholder "Preguntale a {Mascota}…"; el ámbar como acento y `--c` solo en lo de la mascota; las banderas de seguridad de 7.1 y excluir el mod; Qwen3-4B como motor local, sin modelos nuevos.
- **De la diseñadora:**
  - D1 la hoja encima de la columna cuando no entra al costado, en vez de correr el tablero;
  - D2 el lado se recalcula al soltar, no mientras se arrastra;
  - D3 la muesca y la tira no avisan "respuesta nueva";
  - D4 con la pantalla dividida no se abre la charla;
  - D5 la mascota del escenario siempre en forma base;
  - D6 la nota de "tardando" a los 45 s y el error a los 120 s;
  - D7 sin cola de mensajes;
  - D8 cambiar el motor o la carpeta con mensajes empieza una charla nueva;
  - D9 "Solo Avis" en una carpeta vacía propia como opción por defecto;
  - D10 se suma `tauri-plugin-dialog` (dependencia nueva);
  - D11 se retoma la última charla si es de las últimas 12 h;
  - D12 Ctrl+Enter también manda;
  - D13 la frase "las que siguen, menos";
  - D14 el nombre de la mascota sin personaje en el texto;
  - D15 los enlaces no se abren;
  - D16 `--max-budget-usd 2` por proceso;
  - D17 el modelo por defecto del usuario;
  - D18 sin hooks, sin el plugin de Engram y con el estilo por defecto dentro del chat;
  - D19 precalentar al abrir la hoja;
  - D20 un proceso de chat por vez;
  - D21 los datos de Avis viajan a Claude, sin las claves prohibidas;
  - D22 el presupuesto de 3000 tokens del local;
  - D23 no se guardan los adjuntos;
  - D24 borrar con confirmación en el mismo botón;
  - D25 el cajón lee solo los archivos locales;
  - D26 soltar solo sobre la hoja;
  - D27 el tope de 20 MB y 5 archivos;
  - D28 se acepta que Read lea fuera de la carpeta;
  - D29 avisar que Claude Code guarda su propia copia;
  - D30 el hilo no se anuncia mientras llega el texto;
  - D31 objetivos de 32 px para mouse;
  - D32 dibujar 60 mensajes cuando hay más de 200.
- **De E0 (23/11, por lo medido):** D33 sin red, el error `red` sale al tercer `api_retry` sin respuesta (unos 4 s, Rust interrumpe el turno) en vez de esperar los 3 min de reintentos de Claude Code; D34 `--safe-mode` se suma a `--settings` y `--strict-mcp-config`.

## 17. Contradicciones y pendientes

- **#22 dice "uno de los proyectos de la barra", pero la presencia no trae carpeta:** `Presencia` solo tiene `repo` (owner/repo), así que Avis no sabe en qué carpeta está cada proyecto. Lo resuelve la entrega 7, con un `cwd` solo local. Hasta entonces, el menú ofrece "Solo Avis", las recientes y "Elegir otra carpeta".
- **El texto del boceto "Cargando tus ajustes y memorias" cambia a "Mandando tu pregunta":** con los hooks apagados (7.2) no se carga memoria, y el paso real es el pedido a la API.
- **El costo** no se muestra (#22); queda `--max-budget-usd` como red de seguridad (D16).
- **E0 hecha (23/11):** quedan como supuestos JPG, GIF y WebP en el bloque `image`, el techo de tamaño del PDF, un `rate_limit_event` rechazado (no se pudo provocar), el corte real de la red (se midió con un proxy caído) y el arrastre con el mouse (leído en el código; lo prueba la entrega 5).
- **E2 (23/11), lo que el código no deja hacer tal cual:**
  - **Glob no dice cuántos archivos miró:** Rust solo manda el patrón (`detalle_herramienta`; el resultado de la herramienta se ignora), así que "Miró 12 archivos" (4.1) pasa a "Miró «patrón»".
  - **El historial todavía no se guarda en disco (entrega 4):** el cajón lista las charlas de esta ejecución; no muestra "Guardado en esta PC" hasta que sea cierto (con `engram` en `sin-saber`, sin pie).
  - **Los adjuntos llegan con la entrega 5:** hasta entonces no se ven ni el clip ni "Resumime un PDF" (un botón que no hace nada sería peor). La capa de soltar ya existe (`?chat=soltar`).
  - **El motor local llega con la entrega 6:** se puede elegir y la tarjeta de descarga funciona, pero `chat_enviar` de una charla local devuelve un error (Rust nunca la manda a `claude`, regla 3) y se ve el error `local`. Con eso, el arranque del motor en `modelo.rs` queda sin usar: `#[allow(dead_code)]` en `mod modelo` hasta la entrega 6.
  - **`chat.motor` en `preferencias.json`:** 3.4 nombra `chat.carpeta` y `chat.recientes`; D11 ("el último motor") necesita también el motor.
  - **Plegar la hoja con el panel (3.1) es movimiento:** en esta entrega la hoja se esconde sin animar cuando el panel se pliega (`visibility`, así conserva el borrador y el scroll) y vuelve igual; la animación con `plegar` queda para la entrega 3, con el resto del movimiento.
  - **El anuncio de "respondió"** lleva el texto sin las marcas del Markdown (`textoPlano`), para que el lector no lea asteriscos.
- **E1 (23/11):** 7.8 no decía cómo llegan a Rust la mascota (`--append-system-prompt`) ni la sesión de una charla vieja (`--resume`): `chat_abrir` suma `mascota` y `sesionClaude` y devuelve `sesion`. El turno emite `pidiendo` y `pensando` una sola vez (los `thinking_tokens` llegan muchos por turno) y un solo final (`fin`, `error` o `frenada`); después de un `error` de red (D33), el `result` del corte no se emite. Cambiar de conversación cierra el stdin del proceso anterior y lo deja terminar su turno: durante esos segundos puede haber dos procesos vivos (D20 dice uno). Desde la consola de la ventana no se probó (la Avis instalada ocupa la instancia única); el test `real_` usa el mismo `Chat` que los comandos.
