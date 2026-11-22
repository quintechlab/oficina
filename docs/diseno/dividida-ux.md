# Avis · pantalla dividida: cuando dos proyectos conversan — dirección

> Opción **A "Partida"** del boceto `docs/diseno/bocetos/dividida.html` (2026-11-22), elegida por el usuario. Los siete casos del boceto (`OPCIONES[0].ley`) son la referencia de comportamiento; las medidas se corrigieron contra el código real (ver 16).
> Decisión del usuario del 22/11 sobre "Interrumpe": **se abre sola solo si estabas mirando uno de los dos proyectos que conversan. Si mirabas otro proyecto, solo late la ficha ⇄ y la abrís con un clic.**
> Evoluciona `docs/diseno/estilo-avis-ux.md` (tokens, barra, ventana única, muesca, accesibilidad) y `docs/diseno/panel-avis-ux.md` (tarjeta escenario, hilos, `escenaMotion.js`). Lo que no se nombra acá sigue como está allí. Si algo no está acá ni en el boceto, se consulta: no se inventa.

---

## 1. Brief

- **Qué:** cuando dos sesiones de Claude Code se hablan para una tarea, el tablero se parte en dos. La barra lateral se pliega a un **riel de 56** y la columna queda dividida en **dos mitades de 272** con los dos Claude de 120 cara a cara sobre una **costura**. Un cable celeste une sus antenas y cada mensaje viaja por él.
- **Para qué:** ver de un vistazo con quién habla cada sesión, desde cuándo, quién mandó el último mensaje y hace cuánto, y a quién le toca.
- **Regla firme de privacidad:** Avis **nunca** muestra el contenido de los mensajes. El contrato de datos no tiene campo para el contenido (13).
- **Color:** lo que pasa **entre proyectos** va en `--celeste`; los hilos a subagentes siguen en `--ambar`.
- **Acción principal:** ninguna obligatoria: se mira. La única acción es **volver** a lo que mirabas.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps con el zoom al 200 %, nada que corra cuando no se ve, el tablero no cambia de tamaño.

## 2. Concepto

**Dos escenarios que se miran a través de una costura.** El panel, que siempre fue la vista de un proyecto, se abre como una puerta doble: cada mitad es el escenario de una sesión, con su Claude grande parado en su piso y su elenco detrás, y los dos Claude quedan de frente, separados solo por una línea celeste cosida de arriba abajo. Sobre sus cabezas cuelga el cable: cuando uno escribe, una pastilla de luz cruza al otro lado y deja un anillo en la antena que la recibe. Tres palabras: **frente a frente, discreto, reversible**. Lo que se recuerda: **la pastilla celeste que cruza la costura de una antena a la otra.**

---

## 3. Cuándo se abre: la regla

Una conversación es **nueva** cuando su clave (13.3) no estaba en la lectura anterior. La primera lectura al arrancar nunca tiene nuevas (como `novedades`).

### 3.1 Se abre sola

Se abre sola **solo si se cumplen todas** (función pura `debeAbrirseSola`, 14):

1. La conversación es nueva y está activa (sin `hasta`).
2. El panel se ve: tablero flotante visible, o acoplada con el panel **abierto**.
3. El proyecto que mostrás (`st.proyecto`) es **uno de los dos** que conversan.
4. La pantalla dividida no está abierta ya (si lo está, la nueva entra como pestaña, 5.4).
5. El proyecto que mostrás no tiene una tarjeta de pregunta desplegada ni una respuesta enviándose (la pregunta es la acción principal del widget y no se tapa).
6. El foco no está en un campo de texto ("Otra respuesta") y no hay un arrastre en curso.
7. No la cerraste antes (la clave no está en `descartadas`).
8. Si hay una transición de ventana en curso (`st.transicion`), se espera a que termine y se vuelve a evaluar. Es la única espera: ningún otro bloqueo deja una apertura pendiente para después.

Si falla 3, 5, 6 o 7, la conversación **no se abre**: solo late su ficha ⇄ (3.2).

### 3.2 Solo late la ficha

- En la barra lateral aparece la sección **"Conversan"** con una ficha por conversación (5.9). La ficha nueva entra con rebote y su punto celeste late **3 veces** (4,2 s) y queda encendido fijo hasta que la abrís. Cada mensaje nuevo mientras no la abriste lo hace latir **una** vez. Entre latidos nada titila (la regla de la muesca, estilo-avis 6.4).
- Lo que mirabas no se mueve: ni el proyecto, ni el scroll, ni el foco.
- La tarjeta escenario de la sesión que conversa muestra el **rastro activo** "⇄ conversa con api-pagos · 6 min" (5.10).
- Ir después al proyecto que conversa **no** abre la dividida: es tu propia navegación. La abrís desde la ficha.

### 3.3 Por forma de la ventana

| Forma | Qué pasa cuando empieza una conversación |
|---|---|
| **Flotante, tablero visible** | La regla 3.1. |
| **Acoplada, panel abierto** | La regla 3.1. Si el panel se pliega solo (mouse afuera 650 ms), la dividida queda puesta: al volver a abrirlo se ve igual. |
| **Acoplada, muesca cerrada** | **No abre el panel** ni lo prepara: con la muesca cerrada no estás mirando ningún proyecto. La muesca no cambia (sin golpe ni luz: son de la pregunta). Al abrir el panel, la ficha ⇄ está en la barra y late 3 veces. |
| **Tira mini** | No se expande. La tira no cambia. Al expandir, la ficha late 3 veces. |
| **Escondida (bandeja) o minimizada** | Igual que la tira. |
| **Hoja de primeros pasos abierta** | No se abre (la hoja esconde las sesiones). La ficha late al cerrar la hoja. |
| **Vacío o cargando** | No aplica: una conversación necesita dos sesiones. |

- **La dividida es un estado de la vista, no de la forma:** plegar a la muesca, minimizar a la tira o esconder la ventana la conservan. Al volver se ve igual, con la cuenta de la vuelta (10) donde estaba.
- Lo que la muesca y la tira podrían mostrar queda como pregunta para el usuario (17.1). Mientras no se decida, no cambian.

### 3.4 Abrirla con un clic

La ficha ⇄ de la barra (o del riel) abre la dividida en esa conversación desde cualquier proyecto, activa o terminada hace poco. La vista anterior es el proyecto que mirabas, sea cual sea.

---

## 4. Arquitectura

### 4.1 Ancho: el tablero no cambia de tamaño

El tablero sigue a su contenido (`#contenido` con `width: max-content` y `tamano.js`). Hoy el contenido mide 188 + 16 + 460 = **664**. La dividida reparte lo mismo:

| Pieza | Normal | Dividida |
|---|---|---|
| Barra / riel | 188 (`--ancho-lado`) | **56** (`--ancho-riel`) |
| Separación de `#contenido` | 16 | 16 |
| Columna principal | 460 (`--ancho-principal`) | **592** (`--ancho-principal-d`) |
| Interior de la columna (sin relleno ni canal de scroll, 22 medidos: 460 → tarjeta de 438) | 438 | **570** |
| Mitades y costura | — | **272 + 26 + 272 = 570** |

El cambio de ancho **no se anima** (cambiar anchos mueve el layout y `tamano.js` vería un tamaño intermedio): se cambia en un solo cuadro con todo invisible y el movimiento sale de `transform`, `opacity` y `clip-path` (9.1).

### 4.2 Orden del DOM (también el del foco)

```
#marco.dividida
└── #contenido
    ├── aside.riel                         56, columna, centrada, separación 8
    │   ├── .riel-marca                    Claude de 34, zona de arrastre
    │   ├── ul.riel-conv[aria-label="Conversaciones"]   button.tok.tok-cv × n
    │   ├── hr
    │   ├── nav.riel-proy[aria-label="Proyectos"]       button.tok × n (scroll propio)
    │   └── .riel-pie[role=status]         punto de 8 y texto oculto
    └── main.principal                     592, columna flex, separación 10
        ├── header.cab.cab-c               sticky: kick, h1, sub · ‹ volver · controles · .drena
        ├── #otro                          aviso de pregunta (si hay alguna, en cualquier proyecto)
        ├── div.pestanas[role=tablist]     solo con 2 o más conversaciones
        ├── section.split[role=tabpanel]   h2 oculto "Las dos sesiones"
        │   ├── section.mitad.izq          h3 proyecto · escenario · turno
        │   ├── div.costura[aria-hidden]   línea y píldora
        │   ├── section.mitad.der
        │   └── svg.puente[aria-hidden] + i.msj + i.llega
        └── div.ficha-u                    "Último: …", margin-top auto
```

### 4.3 Jerarquía del primer vistazo

Los dos Claude de 120 de frente → el cable y la pastilla que cruza → los chips de turno ("le toca a api-pagos") → el título "tienda-web ⇄ api-pagos" → la ficha "Último".

### 4.4 Presupuesto de alto

La columna muestra 628 px (medido, panel-avis 3).

| Pieza | Alto |
|---|---|
| Encabezado `.cab-c` | 56 + 6 de relleno = **62** |
| Aviso de pregunta (si hay) | 38 + 10 |
| Pestañas (si hay 2 o más) | 34 + 10 |
| Split: cabecera de mitad 66 + escenario 218 + turno 28 | **312** |
| Ficha "Último" | **62** + 10 |
| **Peor caso** (aviso + pestañas) | 62 + 10 + 48 + 44 + 312 + 72 = **548**: entra sin scroll |

---

## 5. Piezas

### 5.1 Riel (56)

| Pieza | Medida y estilo |
|---|---|
| `aside.riel` | ancho 56, `display: flex; flex-direction: column; align-items: center; gap: 8px`, relleno superior 6 (el de `.desplaza` ya da 16), scroll propio fino como `.lado` |
| `.riel-marca` | caja 44 × 44 con el **Avi de Claude de 34** en el ánimo de `animoMarca` (el mismo de la marca), `role="img"` y `aria-label` "Claude, coordinando el equipo". Es zona de arrastre (`cursor: grab`), como la marca. **Sin juegos:** el motor de la marca (`montarMarca`) se desmonta en la dividida y vuelve al volver |
| `button.tok` (proyecto) | **44 × 44**, radio 12, fondo transparente; adentro el ícono del proyecto de 28 (radio 8, iniciales mono 10 sobre su color al 14 %, `colorProyecto`). Al pasar el mouse, `--s2` en 200 ms. `aria-label` "tienda-web, 2 sesiones" y `title` con el repositorio |
| `button.tok.origen` | El proyecto al que vuelve "‹": anillo interior de 1 px ámbar al 28 % (`box-shadow: inset 0 0 0 1px rgba(242,182,50,.28)`). Lleva `aria-description` "vista anterior" |
| Pregunta pendiente en un proyecto | Insignia de 16 × 16 arriba a la derecha del `tok` (−3 / −3), círculo `--ambar`, "?" mono 600 10 en `--negro` (11,5:1), borde 2 `--negro`. El `aria-label` del botón suma ", 1 pregunta pendiente" |
| `button.tok.tok-cv` (conversación) | 44 × 44, radio 12, fondo `--celeste-osc`, borde 1 `--celeste-borde-s` (.30), "⇄" Manrope 700 15 `--celeste` (8,5:1). **Activa** (la que muestra el split): fondo `--celeste-velo-f` (.18), borde `--celeste`, `aria-current="true"`. **Terminada:** fondo transparente, borde `--linea`, "⇄" en `--crema2` (sin opacidad). Punto nuevo: 9 × 9 `--celeste`, borde 2 `--negro`, arriba a la derecha (−2 / −2) |
| `hr` | 24 de ancho, filete 1 `--linea`, margen 4 / 0 |
| `.riel-pie` | `margin-top: auto`; punto de 8 `--crema2` (`--rojo` con error de lectura) con `title` "actualizado 10:31 · cada 1,5 s" y el mismo texto en un `span.oculto` con `role="status"`. Es el equivalente del pie de la barra |

- **Lo que el riel no muestra:** la sección Equipo y el pie con texto. Su equivalente es volver ("‹" o cualquier proyecto del riel): la dividida dura lo que dura la conversación.
- **Clic en un proyecto del riel:** sale de la dividida hacia ese proyecto (la vuelta de 9.5, sin cuenta) y cancela la vuelta pendiente.
- **Clic en una conversación del riel:** muestra esa conversación (como su pestaña).

### 5.2 Encabezado `.cab-c`

Ocupa el lugar del `.cab` de hoy (sticky, fondo `--negro`). Fila: `[.cab-t] [‹ volver] [controles]`.

| Pieza | Estilo |
|---|---|
| Kick | "CONVERSACIÓN", `--t-rotulo` (mono 500 10 / 1, .12em, mayúsculas), `--celeste` |
| `h1` | Manrope 800 **19 / 1,2**, −0,02em, `--crema`, `margin-top: 5px`, una línea. Cada nombre de proyecto es un `span.n` con elipsis propia (`max-width: 50%` del título) y `title` con el repositorio. Entre los dos, "⇄" en `--celeste` con margen 0 / 6, `aria-hidden`, y un `span.oculto` " conversa con ". El lector oye "tienda-web conversa con api-pagos" |
| Mismo proyecto a los dos lados | El `h1` dice "tienda-web · 2 sesiones conversan" y las mitades se distinguen por la rama |
| Sub | Manrope 500 11,5 / 1,35, `--crema2`, `margin-top: 2px`, una línea con elipsis. Textos en 5.2.1 |
| `button.volver` | Píldora de **34** de alto dibujado con zona de toque de **44** (`::before` en `inset: -5px 0`), relleno 0 / 12 / 0 / 10, radio píldora, borde 1 `--linea`, fondo `--s1`, Manrope 700 12,5 `--crema`, "‹ " + nombre de la vista anterior (máx. 140 con elipsis). Al pasar el mouse: borde `--linea-hover`, fondo `--s2`. `aria-label` "Volver a tienda-web" |
| `button.volver.ahora` (conversación terminada) | La misma pieza cambia a **"Volver ahora"**: borde `--celeste`, fondo `--celeste-osc`, texto `--celeste` (8,5:1). Al pasar el mouse, fondo `--celeste-velo-f`. `aria-label` "Volver ahora a tienda-web" |
| Controles de ventana | Los 3 botones de 32 de hoy, **sin cambios** y en el mismo lugar (4.3 de estilo-avis): chinche, minimizar o plegar, cerrar a la bandeja |
| `.drena` | Solo con la conversación terminada: barra de 2 px pegada al borde inferior del encabezado (`position: absolute; left: 0; right: 0; bottom: 0`), pista `--celeste` al 15 %, relleno `--celeste` con `transform-origin: 0 50%`. Se vacía en 60 s (9.4). `aria-hidden` |

El encabezado, salvo los botones, sigue siendo zona de arrastre.

#### 5.2.1 Textos del sub

| Estado | Texto |
|---|---|
| Recién abierta sola (10 s) | "Se abrió sola · ‹ te lleva de vuelta a tienda-web" |
| Activa | "Conversan desde las 10:24 · 6 min" |
| Terminada, cuenta corriendo | "Terminó hace 20 s · vuelve a tienda-web en 40 s" |
| Terminada, cuenta en pausa (10) | "Terminó hace 20 s · la vuelta espera mientras estés acá" |
| La otra sesión se cerró | "api-pagos se cerró · vuelve a tienda-web en 40 s" |
| Terminada y queda otra conversación | "Terminó hace 20 s · sigue tienda-web ⇄ panel-admin en 40 s" |

Los segundos se reescriben en su lugar en cada lectura (`actualizarTiempos`, panel-avis 13), sin redibujar.

### 5.3 Aviso de pregunta

Si llega una pregunta en **cualquier** proyecto (incluidos los dos que conversan) con la dividida abierta, aparece arriba la píldora de `#otro` de hoy ("**Claude** te pregunta algo en **api-pagos** · Ver →", alto 38). Clic: sale de la dividida (vuelta de 9.5) al proyecto de la pregunta, con su tarjeta. La dividida **nunca se cierra sola por una pregunta** y el foco no se mueve.

### 5.4 Pestañas (2 o más conversaciones)

| Pieza | Estilo |
|---|---|
| `div.pestanas[role=tablist]` | `flex`, separación 6, una fila; si no entran, scroll horizontal fino (nunca dos filas) |
| `button.pest[role=tab]` | 34 dibujado y 44 de zona (`::before`), relleno 0 / 12, radio píldora, borde 1 `--linea`, `--s1`, Manrope 700 11,5 `--crema2`. Texto "tienda-web ⇄ api-pagos" con "⇄" `--celeste` y cada nombre con elipsis (mín. 140 por pestaña) |
| Activa | `aria-selected="true"`, borde `--celeste`, fondo `--celeste-osc`, texto `--crema` (15,4:1) |
| Al pasar el mouse | borde `--linea-hover`, 200 ms |
| Mensaje nuevo en otra | punto 7 `--celeste` con halo de 3 al 20 %; late una vez por mensaje; `aria-label` del tab suma ", mensaje nuevo" |
| Terminada | "terminó" en mono 10 `--crema2` después del nombre |

- Orden: por `desde`. Una conversación nueva con la dividida abierta entra como pestaña al final, con su punto: **no cambia la que estás mirando**.
- Teclado: ← → entre pestañas con foco móvil (`tabindex` itinerante), Enter o Espacio la activa.

### 5.5 Mitad

`section.mitad.izq` / `.der`, 272 de ancho. La derecha es espejo de la izquierda (texto alineado a la derecha, ícono después del nombre).

| Pieza | Estilo |
|---|---|
| `header.mh` | alto fijo **66**, relleno 0 / 2 |
| `h3.mh-p` | ícono del proyecto de 24 (radio 7) + nombre en Manrope 800 17 / 1,1, −0,02em, una línea con elipsis y `title` |
| `.mh-r` | `margin-top: 6px`: tag (`.tag` de hoy) + rama en Manrope 800 12,5 / 1 `--crema2`, una línea con elipsis y `title` |
| `.linea` | `margin-top: 5px`, Manrope 700 12,5 / 1,3, una línea con elipsis, `title` completo. Marcador: el **punto** de hoy para la actividad propia; **"⇄"** en `--celeste` para las líneas de la conversación (así el celeste de "leyendo" o "proceso" no se confunde con el de la conversación: 12) |
| `.esc-d` | 272 × **218**, `position: relative`; geometría en 6 |
| `.pie-m` | alto 28, el chip de turno (5.7); a la izquierda en `.izq`, a la derecha en `.der` |

**Línea y pose de Claude en la mitad** (`lineaConversa`, 14), por prioridad:

| # | Condición | Pose | Línea | Color |
|---|---|---|---|---|
| 1 | Pregunta propia pendiente | `teEspera` | "ahora · te hace una pregunta" | ámbar |
| 2 | Le escribió al otro y el otro no contestó, y Claude no hace otra cosa que coordinar o esperar (`animoSesion` es `coordinando`, `esperando` o `pensando`) | `pensando` | "⇄ esperando a api-pagos · 40 s" | celeste |
| 3 | El otro le contestó hace menos de 10 s | la de `animoSesion` | "⇄ api-pagos le contestó" | celeste |
| 4 | Si no | la de `animoSesion` | `textoActividad` de hoy | `colorEstado` de hoy |

- La 2 le gana a "coordinando el equipo" **solo dentro de la mitad**: el tema de la dividida es la conversación, y los hilos ámbar siguen mostrando que su equipo trabaja. Una actividad concreta (editando, corriendo, leyendo, procesos) le gana a la 2.
- Fuera de la dividida, la línea de la tarjeta no cambia: la conversación va en el rastro (5.10).

### 5.6 Costura

| Pieza | Estilo |
|---|---|
| `div.costura` | columna de 26, `position: relative` |
| Línea (`::before`) | 1 px centrado (`left: 12.5px`), de `top: 4px` a `bottom: 4px`, `linear-gradient(transparent, rgba(127,179,255,.5) 25%, rgba(127,179,255,.5) 75%, transparent)`. Decorativa |
| `span.pild` | `position: absolute; left: 50%; top: 250px; transform: translateX(-50%)`, mono 500 10 / 1 `--celeste` (9,8:1 sobre `--negro`), fondo `--negro`, borde 1 `--celeste-borde-f` (.45), radio píldora, relleno 6 / 9, sin cortes de línea, `z-index: 2`. Texto: flecha del último mensaje y hace cuánto: **"→ hace 40 s"** (de izquierda a derecha) o **"← hace 2 s"**. Terminada: **"terminó"** en `--crema2` con borde `--linea-hover`. `aria-hidden` (lo dice la ficha "Último") |

### 5.7 Chip de turno

`span.turno`: `inline-flex`, separación 6, alto 28, relleno 0 / 11, radio píldora, mono 500 10,5 / 1 (`font-stretch: 75%`).

| Quién | Texto | Estilo |
|---|---|---|
| Le toca (recibió el último mensaje) | "le toca a api-pagos" | **lleno**: fondo `--celeste-velo` (.14 sobre negro), sin borde, texto `--crema` (14,9:1) |
| Mandó el último | reloj de arena de 10 × 11 (trazo 1,3 `currentColor`) + "espera a tienda-web · 15 s" | borde 1 `--celeste-borde` (.40), texto `--celeste` (9,8:1) |
| Terminada | "terminó · hace 20 s" | borde 1 `--linea`, texto `--crema2` |
| Sin datos de la otra sesión | "sin datos" | como terminada |

Con proyectos iguales a los dos lados, el chip nombra la rama ("le toca a feat/18-checkout").

### 5.8 Puente, mensaje y anillo

| Pieza | Estilo |
|---|---|
| `svg.puente` | `position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; z-index: 3` dentro de `.split` |
| `path.halo-p` | sin relleno, trazo `--celeste` 7, opacidad .10, `stroke-linecap: round` |
| `path.cable` | sin relleno, trazo `--celeste` 1,6, `stroke-dasharray: 2 5`, punta redonda, opacidad .8 |
| `path.cortado` (terminada) | el mismo trazado, trazo `--tenue` 1,4, opacidad .45, `pathLength="100"` y `stroke-dasharray: 38 24 38` (un corte en el medio) |
| `i.msj` | 22 × 13, radio 7, `--celeste`, tres puntos `#06101F` (`radial-gradient(circle, #06101F 1.3px, transparent 1.6px)`, `background-size: 6px 13px`, `background-position: 2px 0`), `box-shadow: 0 0 0 3px rgba(127,179,255,.18), 0 0 14px rgba(127,179,255,.55)`, `offset-path: path('<el trazado en el sentido del mensaje>')`, `offset-rotate: 0deg`, opacidad 0 en reposo, `z-index: 4` |
| `i.llega` | 26 × 26 (margen −13), círculo con borde 2 `--celeste`, opacidad 0, en la antena de quien recibe, `z-index: 4` |

El cable no se mueve: el movimiento es la pastilla, **una vez por mensaje nuevo** (9.3), nunca en bucle.

### 5.9 Fichas "Conversan" en la barra (vista normal)

Sección nueva en la barra lateral, **entre la marca y Proyectos**, solo si hay conversaciones.

| Pieza | Estilo |
|---|---|
| Rótulo | "CONVERSAN", `--t-rotulo` `--celeste`, relleno 8 / 6 / 4 |
| `ul.conversan` | columna, separación 3 |
| `button.conv` | alto mínimo **48**, relleno 6 / 8, radio 12, grilla `34px 1fr auto`, separación 8, fondo `--celeste-osc`, borde 1 `--celeste-borde-t` (.22) |
| Caras | dos Avis de Claude de 26 superpuestos (el segundo corrido 10 / 2), en su pose, **quietos** (sin bucles, como las cabecitas de la pila) |
| Texto | `b` primer proyecto, Manrope 700 12 / 1,2 `--crema`; `span` "⇄ api-pagos", Manrope 500 11 / 1,2 `--celeste` (8,5:1); los dos con elipsis y `title` |
| Duración | `em` mono 500 **10** (no 9,5: el piso es 10), `--crema2`: "6 min" o "terminó" |
| Punto nuevo | 7 × 7 `--celeste`, halo de 3 al 20 %, arriba a la derecha (6 / 6) |
| Al pasar el mouse | borde `--celeste-borde-f` (.45), 200 ms; `:active` escala .97 en 140 ms |
| Terminada | fondo transparente, borde `--linea`, `span` en `--crema2`. **Sin opacidad** (el texto nunca se atenúa) |
| Nombre accesible | "Conversación de tienda-web con api-pagos, desde las 10:24, último mensaje hace 40 s. Abrir" (", mensaje nuevo" si tiene el punto) |

- Una ficha terminada que nunca abriste queda **5 min** después de `hasta` y se va (*propuesto*). Si estabas en la dividida cuando terminó, se va con la vuelta.
- Con muchas conversaciones, la sección comparte el scroll de la barra como Proyectos.

### 5.10 Rastro en la tarjeta escenario

`p.rastro` debajo de `.linea` de la tarjeta de la sesión que conversa (`margin-top: 4px`, mono 500 10 / 1,3, una línea con elipsis y `title`). La tarjeta crece 17 px (205 → 222).

| Estado | Texto | Color |
|---|---|---|
| Activa | "⇄ conversa con api-pagos · 6 min" | todo `--celeste` |
| Terminada | "⇄ habló con api-pagos · 8 min · terminó hace 1 min" | "⇄" `--celeste`, texto `--crema2` (sin opacidad) |

Queda mientras el mod guarde la conversación terminada (30 min, 13.1). No es un control.

---

## 6. Geometría de la mitad

Todo en px de la mitad (el zoom de `<html>` escala junto). Fuente única: la función pura `geometriaDividida(nIzq, nDer)` (14), con las constantes `DIVIDIDA = { mitad: 272, costura: 26, cabecera: 66, alto: 218, piso: 164, claude: 120, sub: 46, ranura: 62, borde: 6 }`. El CSS solo da el tamaño de las cajas.

| Pieza | Izquierda | Derecha |
|---|---|---|
| Piso (`.piso-d`) | `top: 164px`, alto 14, línea de 1 px a 6 px de su borde superior (el degradado `#1E1E23` de `.piso`), luz `radial-gradient(90px 9px at 196px 6px, rgba(242,182,50,.2), transparent 70%)` | luz en x 76 |
| Claude (t 120) | x **136**, y = 164 − round(120 × 0,867) = **60** | x **16**, y 60 |
| Antena (origen del hilo y del cable) | (196, 74) | (76, 74) |
| Ranuras del elenco (t 46, y = 164 − 40 = **124**) | x 6 y 68 (de afuera hacia Claude) | x 158 y 220 |
| Con 1 subagente | x 6 | x 220 (siempre la ranura de afuera) |
| Con 3 o más | ranura de Claude: el de mayor prioridad (`ORDEN_ANIMO`); ranura de afuera: la pila "+n" | espejo |
| Rótulo del subagente | x de la ranura − 9, y 168, ancho 64, centrado: nombre Manrope 800 12 / 1,25 en su color, estado corto (`estadoCorto`) mono 10 en `colorEstado`; tarea completa en `title` y `span.oculto` | igual |
| Pila "+n" | caja 46 × 46 en su ranura, borde 1 punteado `--linea-hover`, radio 13, "+2" Manrope 800 15 `--crema` centrado; rótulo "más" o "terminados" (regla de panel-avis 5.4) | igual |
| Hilo ámbar | `trazoHilo` de hoy, de la antena a la coronilla (x del Avi + 23, 124 + 12 = **136**) | igual |
| Dormido | Avi al 60 % (regla de hoy) | igual |

**Cable entre antenas** (coordenadas de `.split`, la mitad derecha empieza en x 298 y el escenario en y 66):

- A = (196, 140), B = (298 + 76, 140) = (374, 140).
- Trazado `M 196 140 Q 285 120 374 140` (control a 20 px sobre la antena más alta: con más de 220 px de distancia serían 50, regla del boceto). El sentido derecha → izquierda es el mismo trazado invertido.
- El anillo `.llega` se centra en la antena de quien recibe.

El contenido nunca sale de la mitad: las ondas y la burbuja "!" de Claude de 120 quedan dentro de x 136…272 (izquierda), y el elenco entra en 0…114.

---

## 7. Los siete casos

Los del boceto, con lo que pide el código real.

| Caso | Qué se ve |
|---|---|
| **1 · Antes** | Panel normal. Nada cambia hasta que dos sesiones empiezan a hablar. |
| **2 · Empiezan a hablar** | Si mirabas uno de los dos (3.1): se abre sola con la secuencia de 9.1 y el sub "Se abrió sola · ‹ te lleva de vuelta a tienda-web". Si mirabas otro: entra la ficha en "Conversan" y late (3.2). |
| **3 · tienda-web pregunta** | La pastilla cruza de izquierda a derecha y deja un anillo en api-pagos. tienda-web piensa ("⇄ esperando a api-pagos · 40 s", chip "espera a api-pagos · 40 s"); api-pagos tiene el chip lleno "le toca a api-pagos". La píldora dice "→ hace 40 s". |
| **4 · api-pagos responde** | La pastilla vuelve de derecha a izquierda. tienda-web, que esperaba, festeja una vez al recibirla (9.3) y el turno pasa a ella. |
| **5 · Dos a la vez** | Dos pestañas arriba y dos fichas ⇄ en el riel; la otra late cuando le llega un mensaje. Se mira una por vez. |
| **6 · Termina** | El cable se corta, la costura dice "terminó", los chips pasan a "terminó · hace 20 s". El botón pasa a "Volver ahora" y la barra de 2 px se vacía en 60 s. |
| **7 · Vuelta** | Riel y mitades se juntan y vuelve la vista anterior (9.5), con el scroll de antes; la tarjeta guarda el rastro "⇄ habló con api-pagos · 8 min · terminó hace 1 min". |

---

## 8. Estados

| Estado | Qué se ve |
|---|---|
| **Cargando** | No aplica: la dividida se abre con datos de una lectura. Si la otra sesión todavía no apareció en la lectura (llega en la siguiente), su mitad muestra el estado "sin datos" hasta 2 lecturas (3 s) y después pasa al normal sin animación de entrada. |
| **Sin datos de la otra sesión** (en otra máquina, o su archivo no late) | Su mitad usa `conRepo` para el nombre y el ícono; rama "—"; Claude de 120 en `esperando` al 60 % (solo el Avi); línea "no se ve desde esta máquina" en `--tenue` (5,65:1 sobre `--negro`); sin elenco ni hilos; chip "sin datos". El cable y los mensajes se dibujan igual con lo que publica la sesión que sí se ve. |
| **La otra sesión se cerró** | Se trata como terminada (6), con el sub "api-pagos se cerró · …" y `hasta` = la lectura en que desapareció. |
| **Error de lectura** | Quedan los últimos datos y las animaciones; el punto del riel pasa a `--rojo` con el error en `title` y en el texto de estado. Los tiempos siguen corriendo desde los ISO. |
| **Vacío** | Imposible (dos sesiones). Si ambas se cierran a la vez: vuelta inmediata sin cuenta. |
| **Pregunta en cualquier proyecto** | 5.3. |
| **Termina con otra conversación abierta** | A los 60 s se va la pestaña terminada y el split muestra la que sigue (cambio de pestaña, 9.6); no vuelve a la vista anterior hasta que no quede ninguna. |
| **Conversación nueva durante la cuenta** | Entra como pestaña con su punto; la cuenta sigue. |

---

## 9. Movimiento

Patrón del widget: bucles y estados simples en CSS (`avis.css`, `estilos.css`); las secuencias que cambian el layout se encadenan con la **Web Animations API** en un módulo nuevo, `widget/src/divididaMotion.js`, como `muescaMotion.js` (necesitan `finished` para hacer el cambio de layout en el cuadro justo). No hace falta anime.js (sigue preaprobado; no hay build en `vendor/`). Solo `transform`, `opacity` y `clip-path`. Todo pasa por `hayMovimiento()`.

### 9.1 Se abre (`abrirDividida`)

Tiempos desde el disparo. Una vez por apertura (sola o con clic), nunca en un redibujo.

| t (ms) | Qué | Duración y curva |
|---|---|---|
| 0 | Barra y columna normales: opacidad 1 → 0 y `translateX(-8px)` | 120, `--ease-cierra` |
| 120 | **Cambio de layout** en un cuadro (`#marco.dividida`), todo lo nuevo en opacidad 0 | — |
| 120 | Riel: `translateX(-24px)` → 0 y opacidad; sus piezas escalonadas a 40 ms | 450, `--ease` |
| 160 | Encabezado y pestañas: `translateY(14px)` → 0 y opacidad | 480, `--ease` |
| 200 | Mitad izquierda: `translateX(-40px)` → 0 y opacidad | 620, `--ease` |
| 265 | Mitad derecha: `translateX(40px)` → 0 y opacidad | 620, `--ease` |
| 320 | Costura: `scaleY` 0 → 1 con origen arriba ("se cose de arriba abajo") y la píldora con opacidad al final | 500, `--ease` |
| 330 | Ficha "Último": `translateY(40px)` → 0 y opacidad | 620, `--ease` |
| 700 | Elenco de cada mitad: escala .9 → 1 desde abajo, escalonado a 50 ms; los hilos ámbar 120 ms después del último (`retrasoHilos` de `escenaMotion.js`) | 360, `--rebote` |
| 820 | Puente: `clip-path: inset(0 100% 0 0)` → `inset(0)` desde la antena de quien empezó (al revés si empezó la derecha); el cable punteado entra con opacidad a los +180 | 420, `--ease`; cable 240 |
| ~1240 | Si el último mensaje tiene menos de 10 s, la pastilla cruza (9.3) | 9.3 |

Los Avis de 120 respiran desde que aparecen (bucles de hoy). El cambio de proyecto de hoy (240 ms) no se usa acá.

### 9.2 Late la ficha (`latirFicha`)

- Entrada de la ficha nueva: `translateX(-16px) scale(.94)` → 0, opacidad, 700 ms `--rebote` (`llegaConv` del boceto).
- Punto: `titila` (opacidad 1 → .45 → 1, 1,4 s) **3 veces**, después fijo. Un mensaje nuevo sin abrir: 1 vez. Lo mismo en el `tok-cv` del riel y en el punto de la pestaña.

### 9.3 Un mensaje cruza (`cruzarMensaje`)

Cuando cambia `ultimo.cuando` y la dividida se ve. Total 2800 ms (los tiempos de `cruza` y `anillo` del boceto, una sola vez):

| t (ms) | Qué |
|---|---|
| 0 → 224 | La pastilla aparece en la antena de quien manda: escala .5 → 1, opacidad 0 → 1 |
| 0 → 1680 | Recorre el cable: `offset-distance` 0 → 100 %, `cubic-bezier(.45, 0, .2, 1)` |
| 1680 → 1904 | Se apaga en la antena de quien recibe: escala → .6, opacidad → 0 |
| 1570 → 2800 | Anillo `.llega`: escala .4 → .7 con opacidad .95, después → 2,3 y se apaga, `ease-out` |
| 1570 | La píldora de la costura, los chips de turno y las líneas cambian (fundido de 200 ms) |
| 1570 | Si quien recibe **esperaba** (línea 2 de 5.5): festeja una vez (`.recibe`: `festeja` × 1 en `.cuerpo`, 1000 ms `--rebote`, después vuelve su bucle). Si estaba ocupado, solo el anillo |

- Con un mensaje nuevo en medio de un cruce, el actual termina y el siguiente sale enseguida (cola de 1; los de más se juntan en el último).
- `offset-distance` se resuelve como transformación, como los puntos de los hilos (panel-avis 8.2): la pausa CSS los alcanza.
- Con el panel escondido o la muesca cerrada no cruza nada: solo se actualizan los textos.

### 9.4 Termina (`terminar`)

- Cable y halo: opacidad → 0; el trazado cortado: 0 → .45. Fundido cruzado de 360 ms `--ease-cierra`.
- Píldora "terminó", chips y botón "Volver ahora": fundido de 200 ms.
- `.drena`: aparece (200 ms) y su relleno hace `scaleX` 1 → 0 en **60 s lineales**. Es una animación WAAPI y es **la cuenta misma**: su `finished` dispara la vuelta, y pausarla pausa la cuenta (10).
- Los Avis no cambian de pose por terminar.

### 9.5 Vuelve (`cerrarDividida`)

Al terminar la cuenta, con "Volver ahora", con "‹", con Esc o con un proyecto del riel.

| t (ms) | Qué | Duración y curva |
|---|---|---|
| 0 | Mitades: `translateX(±12px)` hacia la costura, escala → .97, opacidad → 0 ("se juntan") | 240, `--ease-cierra` |
| 0 | Costura: `scaleY` → 0 con origen abajo; puente opacidad → 0 | 240, `--ease-cierra` |
| 0 | Encabezado, pestañas y ficha: opacidad → 0 | 160 |
| 0 | Riel: `translateX(-24px)`, opacidad → 0 | 200, `--ease-cierra` |
| 260 | **Cambio de layout** a la vista anterior (proyecto y scroll guardados) | — |
| 260 | Piezas de la barra: `translateX(-12px)` → 0 y opacidad, escalonadas a 30 ms | 360, `--ease` |
| 260 | Columna: escala .97 → 1 y opacidad (`vuelve` del boceto) | 550, `--ease` |
| 600 | El rastro de la tarjeta: `translateY(4px)` → 0 y opacidad, una vez | 360, `--ease` |

### 9.6 Cambio de pestaña

El split sale y entra como el cambio de proyecto (estilo-avis 6.2): 240 ms `--ease`, opacidad y 14 px hacia el lado de la pestaña elegida. El puente se dibuja sin la animación de 9.1.

### 9.7 Hover, foco y presión

Los de estilo-avis 6.3: color, fondo y borde en 200 ms; `:active` a .97 en 140 ms; foco con contorno ámbar de 2 px y separación 2 en todo (también sobre las piezas celestes; en el riel, `outline-offset: -2px` como en `.lado`). Los Avis de la mitad: sin elevación al pasar el mouse (no son controles).

### 9.8 Movimiento reducido y pausa

Con `prefers-reduced-motion: reduce` o "Pausar animaciones" (`body.pausa`):

- Abrir, volver y cambiar de pestaña son **instantáneos**.
- La pastilla **no se dibuja** (ni quieta: una pastilla fija a mitad del cable diría "en camino" para siempre); la dirección la dicen la flecha de la píldora y la ficha "Último". Sin anillo ni festejo.
- La barra `.drena` no se ve; la cuenta **sigue** (es comportamiento, no movimiento) y la dice el sub.
- Los puntos nuevos quedan fijos. Avis quietos en su pose (regla de hoy).

### 9.9 Presupuesto

- Carga máxima visible: 2 Claude de 120 + 4 Avis de 46 (2 por mitad) + 4 puntos de hilo + 1 pastilla. Menos que el máximo de hoy (10 Avis y 8 puntos).
- La vista normal queda `display: none` en la dividida: sus bucles no corren. El motor de la marca se desmonta (5.1).
- Brillo con gradiente y `contain: layout` en los Avis de la mitad, como `.esc .avi` (panel-avis 8.5).
- Pausa con el panel cerrado, escondido o minimizado: las reglas de hoy (`body.acoplada:not(.abierta) #marco *`, `body.fuera *`). Las animaciones WAAPI de la cuenta se pausan también (10).
- **Verificar:** panel de rendimiento de WebView2 con la apertura, un cruce y la vuelta al 200 %: 60 fps, sin cuadros largos en el cambio de layout.

---

## 10. La vuelta y la vista anterior

1. **Vista anterior** = `{ proyecto, scroll }` en memoria al abrir (sola o con clic). No se guarda en disco: al reiniciar la app se abre la vista normal.
2. **Cuenta de 60 s** desde que termina la conversación que se está mirando, **solo mientras el panel se ve** (si la muesca está cerrada o la ventana escondida, la cuenta arranca al volver a verse: así siempre se ve el "terminó").
3. **Pausa de la cuenta:** con el puntero sobre la columna principal o el foco adentro de la dividida. Retoma al salir, sin reiniciar.
4. **Cerrar antes de que termine** ("‹", Esc o un proyecto del riel): vuelve y la clave entra en `descartadas` (no se reabre sola; la ficha queda en la barra).
5. Con otra conversación todavía en pestañas, la vuelta muestra esa (8).

---

## 11. Zoom 100–200 %

No hay anchos de 375/768/1440: el widget es de escritorio y su tamaño es fijo en px CSS con un zoom escalonado en `<html>` (100 a 200, pasos de 25).

- Todo escala junto: nada se mide del DOM para la geometría (`geometriaDividida` es pura), así no hay redondeos que separen el cable de las antenas a 125 o 175 %.
- El tablero mide lo mismo en normal y en dividida (4.1) en todos los pasos: la ventana no se mueve al abrir ni al volver.
- Si el área del monitor es más baja que el tablero al 200 %, la columna desplaza como hoy: el encabezado queda fijo, el split y su puente desplazan juntos (el SVG vive dentro de `.split`), la ficha "Último" queda al final.
- Piso tipográfico: 10 px al 100 % (20 al 200 %).
- **Revisión** en `widget/dev/vista.html` y en la ventana real al **100, 150 y 200 %**, con el contenido mínimo (1 conversación, sin subagentes, nombres cortos) y el máximo (2 conversaciones, 2 + pila por mitad, aviso de pregunta, nombres y ramas largos). Mirar en especial que la pastilla siga el cable a 150 % (el `offset-path` en px con el zoom, igual que los puntos de los hilos).

---

## 12. Accesibilidad

- **Encabezados:** en la dividida, el único `h1` es "tienda-web conversa con api-pagos" (5.2); `h2` oculto "Las dos sesiones"; un `h3` por mitad (el proyecto). Sin saltos.
- **Orden del foco:** riel (conversaciones, proyectos) → "‹ volver" / "Volver ahora" → controles de ventana → aviso de pregunta → pestañas → nada más (las mitades no tienen controles).
- **El foco nunca se mueve solo:** al abrirse sola, si el foco estaba en la barra, pasa al equivalente del riel (mismo proyecto, por `data-proy`); si estaba en otro lado de la columna, al botón "‹". Es conservar el foco, no moverlo: sin eso quedaría en `body`. Al volver, al botón del proyecto de la vista anterior en la barra. Al abrir con un clic en la ficha, el foco va a la `tok-cv` activa del riel.
- **Teclado:** Esc vuelve (una capa por vez: si está acoplada, un segundo Esc cierra la muesca; con el foco en la pregunta, Esc sigue plegándola). Las ← → globales de cambio de proyecto **no actúan** en la dividida (cambiarían de vista sin aviso); dentro de las pestañas, ← → mueven entre pestañas.
- **Zonas de toque:** 44 × 44 en todo lo nuevo (riel, "‹", "Volver ahora", pestañas por su zona de 44, fichas de 48). Por encima del mínimo de 32 del sistema.
- **Nombres:** cada `tok` y `conv` con `aria-label` completo (5.1, 5.9); las pestañas con `aria-selected` y `aria-controls`; la conversación activa del riel con `aria-current`; `.drena`, costura, puente, pastilla y anillo `aria-hidden`.
- **Avisos en vivo:** la región `aria-live="polite"` de hoy anuncia **una vez** "tienda-web y api-pagos empezaron a conversar" (y ", se abrió la pantalla dividida" si se abrió sola) y una vez "Terminó la conversación entre tienda-web y api-pagos. Vuelve a tienda-web en 60 segundos." Los mensajes no se anuncian uno por uno: lo dicen los chips y la ficha "Último".
- **Tiempo (WCAG 2.2.1):** la vuelta automática se pausa con el puntero o el foco adentro (10.3) y se puede adelantar con "Volver ahora".
- **Contraste** (calculado, WCAG): sobre `--negro`: `--celeste` 9,79, `--crema2` 10,31, `--tenue` 5,65; sobre `--celeste-osc`: `--crema` 15,42, `--celeste` 8,54, `--crema2` 8,99, `--tenue` 4,93; sobre `--celeste-velo` (.14): `--crema` 14,86, `--celeste` 8,23; sobre `--celeste-velo-f` (.18): `--celeste` 7,64, **`--tenue` 4,41 (prohibido)**; negro sobre ámbar (insignia "?") 11,51. Todo el texto pasa 4,5:1.
- **El color nunca va solo:** la conversación lleva "⇄" y texto; el celeste de "leyendo" y "proceso" usa el punto y el de la conversación usa "⇄"; el turno lo dicen las palabras "le toca" y "espera"; la dirección, la flecha; la pregunta, "?".
- **Nada titila más de 3 veces por segundo** y los latidos se apagan (9.2).

---

## 13. Contrato de datos

### 13.1 Lo que publica el mod (v0.8)

En cada `Presencia` (también en `~/.claude/oficina/sesiones/<id>.json`):

```ts
/** Conversaciones de esta sesión con otras sesiones. Desde la v0.8. Opcional: la v0.7 lo ignora. */
conversa?: Conversa[]

/** Una conversación con otra sesión. Nunca lleva el contenido de los mensajes. */
export type Conversa = {
  /** Id de la otra sesión ($.session.id() de la otra). Único en la lista. */
  con: string
  /** owner/repo de la otra sesión, o null fuera de un repositorio: para dibujarla aunque su presencia no se vea. */
  conRepo: string | null
  /** Cuándo empezó (ISO). */
  desde: string
  /** Quién mandó el primer mensaje. */
  empezo: 'yo' | 'otro'
  /** El último mensaje: quién lo mandó y cuándo (ISO). */
  ultimo: { de: 'yo' | 'otro'; cuando: string }
  /** Cuándo terminó (ISO). El mod la guarda 30 min después, como a los subagentes, para el rastro. */
  hasta?: string | null
}
```

- **Lista, no objeto:** una sesión puede hablar con dos a la vez (la que coordina a dos proyectos). Una unión "objeto o lista" obligaría a cada lector a normalizar; una lista vacía o ausente es "ninguna". Una entrada por cada otra sesión (`con` único); una conversación nueva con la misma sesión reemplaza a la terminada. Hasta 4 entradas (el archivo queda acotado).
- **`cuando` (ISO) en lugar de `hace`:** todos los tiempos del contrato son ISO (`desde`, `inicio`, `actualizado`, `procesos[].desde`) y el widget calcula lo relativo en cada lectura. Un `hace` quedaría viejo entre publicaciones (el mod publica por eventos; el widget lee cada 1,5 s).
- **`conRepo`:** sin él, una conversación con una sesión de otra máquina, o cuyo archivo dejó de latir, no tendría nombre.
- **`empezo`:** da el lado estable cuando la abrís desde otro proyecto (14).
- **`hasta`:** sin él no hay "terminó hace 20 s" ni rastro.

### 13.2 Compatibilidad

- Widget v0.8 con mod v0.7: sin `conversa`, no hay conversaciones (la función no existe para esa sesión).
- Widget v0.7 con mod v0.8: ignora el campo.

### 13.3 Lo que deduce el widget (puro, con tests)

- **Clave:** el par sin orden `{sesion, con}` + el `desde` más antiguo de los dos lados.
- **Unión de los dos lados:** si las dos sesiones publican la conversación, `desde` es el mínimo; `ultimo` es el de `cuando` más reciente, traducido a ids (`de: 'yo'` → quien publica; `'otro'` → `con`); `hasta` es el primero que no sea nulo. Si publica una sola, se usa esa.
- **Turno:** le toca a la sesión que **no** mandó el último mensaje.
- **Termina** también si una de las dos sesiones desaparece de la lectura (cerrada o sin latido): `hasta` = esa lectura, motivo "se cerró".
- **Lado izquierdo:** el proyecto de la vista anterior si es uno de los dos; si no, la sesión que empezó (`empezo`). No cambia durante la conversación.

---

## 14. Mapeo a código

| Archivo | Cambio |
|---|---|
| `types/index.d.ts` | `Conversa` y `Presencia.conversa?` (13.1). El mod que lo publica es trabajo aparte (17.2). |
| `widget/src/dividida.js` (nuevo, puro, con tests en `widget/test/dividida.test.js`) | `DIVIDIDA`; `conversaciones(sesiones, ahoraMs)` → `[{ clave, a, b, desde, ultimo: { emisor, cuando }, turno, hasta, motivo }]`; `claveConversa`; `debeAbrirseSola(conv, ctx)` (3.1, una prueba por condición); `ladoIzquierdo(conv, proyectoVisto)`; `lineaConversa(s, conv, ahoraMs)` (5.5); `textoTurno`, `textoCostura`, `textoUltimo`, `textoSub` (5.2.1); `haceCorto` ("hace 3 s", "hace 40 s", "hace 2 min"); `rastroConversa` (5.10); `geometriaDividida(nIzq, nDer)` → `{ izq, der, cable: { d, dInverso, llegaA, llegaB } }`; `cuentaVuelta` (estado puro de 10). |
| `widget/src/divididaVista.js` (nuevo) | HTML: `riel()`, `cabConversa()`, `pestanas()`, `mitad()`, `split()`, `fichaUltimo()`, `fichasConversan()` para la barra. Reusa `avi`, `trazoHilo`, `estadoCorto`, `colorProyecto`, `iniciales`, `escapar`. |
| `widget/src/tablero.js` | La tarjeta suma `p.rastro` (5.10). `barraProyectos` sin cambios. |
| `widget/src/divididaMotion.js` (nuevo) | `abrirDividida`, `cerrarDividida`, `cruzarMensaje`, `terminar`, `latirFicha`, `cambiarPestana` (9). Importa `hayMovimiento` de `tableroMotion.js` y `retrasoHilos` de `escenaMotion.js`. |
| `widget/src/main.js` | `st.dividida = { clave, vista: { proyecto, scroll }, origen: 'sola' \| 'clic', descartadas: Set, conocidas: Set }`; evaluar `debeAbrirseSola` después de cada lectura; conservar el foco (12); Esc y ← → (12); pausa de la cuenta (10); firmas sin el minuto ni los segundos (`actualizarTiempos`). |
| `widget/src/marcaMotion.js` | Desmontar al entrar en la dividida y montar al volver (5.1). |
| `widget/src/estilos.css` | Tokens de 15; `#marco.dividida`; `.riel`, `.tok`, `.tok-cv`, `.cab-c`, `.volver`, `.drena`, `.pestanas`, `.pest`, `.split`, `.mitad`, `.mh*`, `.esc-d`, `.piso-d`, `.turno`, `.costura`, `.pild`, `.puente`, `.msj`, `.llega`, `.ficha-u`, `.conversan`, `.conv`, `.rastro`; sumar las piezas mono a la lista de `font-stretch: 75%` y las de una línea a `contain: inline-size`. Nombres verificados sin choques (`.rot`, `.chip`, `.barra` y `.rotulo` ya existen y no se usan acá). |
| `widget/src/avis.css` | `.recibe .cuerpo { animation: festeja 1s var(--rebote) 1 }`; las caras de `.conv` quietas como `.mas .avi`. |
| `widget/dev/falso.js` | Parámetro `?dividida=antes\|aparece\|pregunta\|responde\|dos\|termina\|vuelve\|otro\|sindatos` para reproducir los siete casos, "mirabas otro proyecto" y "sin datos". |

---

## 15. Tokens

Sin colores nuevos de marca: todos salen de `--celeste` y `--negro`.

| Token | Valor | Uso |
|---|---|---|
| `--celeste-osc` | `#0B1524` | Fondo de fichas, `tok-cv`, pestaña activa y "Volver ahora" (ya estaba en el boceto; nuevo en `estilos.css`) |
| `--celeste-velo` | `rgba(127,179,255,.14)` | Chip de turno lleno |
| `--celeste-velo-f` | `rgba(127,179,255,.18)` | `tok-cv` activa y "Volver ahora" al pasar el mouse. **Sin `--tenue` encima** |
| `--celeste-borde-t` | `rgba(127,179,255,.22)` | Borde de la ficha de la barra |
| `--celeste-borde-s` | `rgba(127,179,255,.30)` | Borde del `tok-cv` |
| `--celeste-borde` | `rgba(127,179,255,.40)` | Chip "espera a …" |
| `--celeste-borde-f` | `rgba(127,179,255,.45)` | Píldora de la costura y ficha al pasar el mouse |
| `--ancho-riel` | 56px | Riel |
| `--ancho-principal-d` | 592px | Columna en la dividida |
| `--mitad` | 272px | Cada mitad |
| `--costura` | 26px | Columna de la costura |
| `--alto-esc-d` | 218px | Escenario de la mitad |
| `--d-cruza` | 1680ms | Recorrido de la pastilla |
| `--d-anillo` | 1230ms | Anillo de llegada |
| `--d-cose` | 500ms | Costura |
| `--d-riel` | 450ms | Entrada del riel |
| `--espera-vuelta` | 60s | Cuenta de la vuelta |

Las posiciones salen de `DIVIDIDA` en `dividida.js`, no del CSS.

---

## 16. Correcciones al boceto (2026-11-22)

- **Medidas reales:** el boceto toma el panel como 188 + 460 sin la separación de 16 ni el relleno de la columna. Con el código real, la columna dividida tiene 570 de interior: mitades de 272 y costura de **26** (el boceto: 16). Claude queda en x 136 / 16 igual que en el boceto.
- **Controles de ventana:** el boceto los omitía en la dividida. Quedan, sin cambios y en su lugar (cerrar a la bandeja, minimizar o plegar, chinche).
- **Salida "‹ tienda-web" en lugar del ✕ de 44:** con los controles en la misma fila, el ✕ de la conversación quedaba al lado del × de "Cerrar a la bandeja". La salida es una píldora que nombra adónde vuelve y que, al terminar, pasa a ser "Volver ahora" (un solo control, siempre en el mismo lugar). Pregunta para el usuario en 17.3.
- **Marca del riel:** el boceto usaba el Avi base de 34; la marca real es el Avi de Claude ("Escenario"), así que el riel lleva a Claude de 34 en el ánimo de la marca, sin juegos.
- **Texto sin opacidad:** el rastro (`.rastro`, .75) y la ficha terminada (`.conv.fin`, .62) atenuaban el texto, prohibido en estilo-avis 3.1. Pasan a `--crema2`.
- **Piso de 10 px:** `em` de la ficha (9,5) sube a 10.
- **Claude no tiene pose `listo`:** el boceto ponía a tienda-web en `listo` al recibir la respuesta. Pasa a un festejo de una vez (`.recibe`) sobre su pose real, solo si esperaba.
- **Chip del que mandó:** el boceto alternaba "contestó · hace 2 s" y "espera a … · 15 s". Queda una sola regla: "espera a … · t".
- **Zonas de toque:** riel de 40 → 44; pestañas y "Volver ahora" de 34 dibujados con zona de 44.
- **La pastilla no va en bucle:** cruza una vez por mensaje (el boceto la repetía para la demo).

---

## 17. Decisiones del usuario (2026-11-22)

El usuario aceptó todas las recomendaciones de esta dirección:

1. **Muesca y tira:** no muestran nada cuando empieza una conversación; la ficha late al volver a ver el panel.
2. **Salida "‹ <vista anterior>"** en lugar del ✕; al terminar pasa a "Volver ahora".
3. **Bloqueos de la apertura sola:** una pregunta desplegada, el foco en un campo o un arrastre la frenan.
4. **La cuenta de 60 s** corre solo con el panel visible y se pausa con el puntero o el foco adentro.
5. **Navegación:** si la dividida estaba cerrada, ir al proyecto no la reabre; Esc vuelve una capa.
6. **Sesiones de otra persona** (Campos): se dibujan como mitad "sin datos" si su presencia no se ve desde esta máquina.
7. **Ficha terminada** 5 min en la barra; el rastro, 30 min.

Queda para el mod (no es de diseño): cómo detecta el inicio, cada mensaje y el fin de una conversación entre sesiones, y cómo sabe el `con` de la otra.
