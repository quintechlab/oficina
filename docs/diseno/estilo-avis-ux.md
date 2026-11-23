# Oficina · estilo Avis — dirección visual

Dirección aprobada para el nuevo estilo del widget de escritorio (`widget/src`). Reemplaza el pixel art.

- **Estilo:** opción **A · Tablero** de `docs/diseno/bocetos/estilo-avis.html`.
- **Acople:** opción **A · Muesca** de `docs/diseno/bocetos/acople.html`, en los cuatro bordes.
- **Pedido del usuario, textual:** "me gusta la muesca, que sea tipo un notch del celular. Pero quiero poder acoplar la muesca arriba, a los laterales o abajo".
- **La funcionalidad no cambia.** Todo lo que hace hoy el widget sigue estando, con otra forma. Lo único nuevo es el acople a un borde, que ya está aprobado.

Este documento es la fuente de verdad para implementar. Si algo no está acá ni en los bocetos, se consulta. No se inventa.

---

## 1. Brief

| | |
|---|---|
| **Propósito** | Ver de un vistazo qué hace cada sesión de Claude Code y su equipo de subagentes, y responder sus preguntas sin cambiar de ventana. |
| **Público** | Los integrantes de Quintech Studio, con el widget abierto todo el día al costado de su trabajo. |
| **Acción principal** | Responder la pregunta pendiente con un clic. Cuando no hay pregunta, solo mirar. |
| **Vara de calidad** | `webs portfolio/brasa-noble`: dirección intencional, tipografía con carácter, paleta dominante con acentos filosos, movimiento de autor, accesible y liviano. |
| **Anchos** | Solo escritorio (decisión aceptada). La revisión no se hace a 375, 768 y 1440: se hace con zoom al 100, 150 y 200 %, con el contenido mínimo y con el máximo. |

## 2. Concepto

**Una oficina nocturna vista desde el palco.** El widget es negro puro: no es una ventana gris más del escritorio, sino un recorte de noche donde la luz la dan los propios personajes. Los **Avis** (de *avis*, ave) son una familia de huevos color crema con volumen, ojos de punto, patitas y **pico ámbar**. Cada uno tiene su color, pero solo en las mejillas y en su accesorio. El ámbar es la única luz fuerte: marca lo que trabaja, lo que pregunta y lo que tiene el foco.

- **Palabras clave:** nocturno · táctil · vivo.
- **Lo que se recuerda:** el Avi de Claude que asoma desde la muesca negra en el borde de la pantalla, con solo la antena y los ojos a la vista, y que golpea cuando tiene una pregunta.

---

## 3. Tokens

Todos como propiedades CSS en `:root` de `estilos.css`. Los nombres van en español y sin tildes, como el resto del código.

### 3.1 Color

| Token | Valor | Rol |
|---|---|---|
| `--negro` | `#000000` | Fondo del contenedor de la ventana, la muesca y el panel acoplado. |
| `--s1` | `#0C0C0E` | Superficie 1: tarjetas de sesión, cuadros de conteo, tarjeta de pregunta y aviso. |
| `--s2` | `#141417` | Superficie 2: fichas de subagente, opciones, filas al pasar el mouse y pestañas. |
| `--s3` | `#1D1D21` | Superficie 3: chips, botón secundario, pestaña activa y ficha de subagente al pasar el mouse. |
| `--linea` | `#25252A` | Bordes y divisores. Es decorativa: nada depende solo de ella. |
| `--linea-hover` | `#36363C` | Borde de tarjeta al pasar el mouse. |
| `--crema` | `#F3EBD8` | Texto principal. Es el mismo crema del cuerpo de los Avis. |
| `--crema2` | `#BDB5A4` | Texto secundario. |
| `--tenue` | `#8A8478` | Micro rótulos, tiempos, rama y estados dormidos. |
| `--ambar` | `#F2B632` | **Acento único:** trabajo, pregunta, foco, proyecto activo y botón primario. |
| `--ambar-osc` | `#1D1707` | Fondo del proyecto activo, de la opción al pasar el mouse y de la opción marcada. |
| `--pico` | `#E9A13B` | Pico de los Avis (ámbar un tono más quemado, así se separa de la piel). |
| `--violeta` | `#A58BFF` | Secundario: número de opción, "Otra respuesta", equipo e Inés. |
| `--celeste` | `#7FB3FF` | Estado "leyendo", Ramiro y el estado "proceso" (5.5). |
| `--verde` | `#8FD694` | "Listo" y Lucas. |
| `--rosa` | `#E78FB3` | Camila. |
| `--rojo` | `#FF7A6B` | "Falló" y errores. |
| `--fondo-pagina` | `transparent` | `html` y `body` quedan transparentes (ver 9.5). |

**Contraste medido** (WCAG, texto sobre fondo):

| Texto | `--negro` | `--s1` | `--s2` | `--s3` | `--ambar-osc` |
|---|---|---|---|---|---|
| `--crema` | 17.69 | 16.46 | 15.48 | 14.15 | 15.02 |
| `--crema2` | 10.31 | 9.59 | 9.03 | 8.25 | 8.75 |
| `--tenue` | 5.65 | 5.26 | 4.95 | **4.52** | 4.80 |
| `--ambar` | 11.51 | 10.71 | 10.08 | 9.21 | 9.77 |
| `--violeta` | 7.74 | 7.20 | 6.77 | 6.19 | 6.57 |
| `--celeste` | 9.79 | 9.11 | 8.58 | 7.84 | 8.32 |
| `--verde` | 12.21 | 11.37 | 10.69 | 9.77 | 10.37 |
| `--rojo` | 8.25 | 7.68 | 7.22 | 6.60 | 7.00 |

- Negro sobre ámbar (botón primario y chip de pregunta): 11.51.
- Violeta sobre el fondo del número de opción (violeta al 18 % sobre `--s2`): 5.12.
- Ámbar sobre el chip del proyecto activo (ámbar al 22 % sobre `--ambar-osc`): 6.00.
- `--tenue` sobre `--s3` (4.52) está en el límite. **No se usa `--tenue` con opacidad ni sobre superficies más claras que `--s3`.**
- **Prohibido bajar la opacidad del texto.** Un subagente dormido se atenúa solo en su Avi (`.avi { opacity: .6 }`), nunca en la ficha entera. El boceto ya está corregido.

### 3.2 Tipografía

Las dos son OFL y van **empaquetadas** en `widget/src/fuentes/`, en woff2 variable con subconjunto latino que incluye á é í ó ú ñ ü ¿ ¡ « » · — →. La CSP ya permite `font-src 'self'`. Se suma el `OFL.txt` de cada una.

- **Manrope** (marca, ejes de peso 400 a 800): títulos con el tracking cerrado e interfaz.
- **Martian Mono** angosta (eje `wdth` 75, pesos 400 a 600): **solo** micro rótulos. Son estado, rama, tiempos, chips, números de opción y notas.
- El boceto fuerza `font-stretch: 75%` en todo. En producción, `font-stretch: 75%` va solo en `--m` (clase o regla de las piezas mono).
- Pila de respaldo: `"Manrope", "Segoe UI Variable", sans-serif` y `"Martian Mono", "Cascadia Mono", monospace`. El respaldo es solo para un fallo de carga.

| Token | Fuente | Tamaño / interlínea | Peso | Tracking | Uso |
|---|---|---|---|---|---|
| `--t-display` | Manrope | 21 / 1.1 | 800 | −0.035em | Nombre del proyecto (`h1` de la ventana). |
| `--t-cifra` | Manrope | 22 / 1 | 800 | −0.04em | Valor de los cuadros de conteo. |
| `--t-marca` | Manrope | 16 / 1.1 | 800 | −0.03em | "Oficina". |
| `--t-titulo` | Manrope | 14.5 / 1.3 | 800 | −0.02em | Título de la sesión y texto de la pregunta. |
| `--t-cuerpo-f` | Manrope | 13 / 1.3 | 700 | 0 | Nombre de proyecto en la barra y etiqueta de opción. |
| `--t-cuerpo` | Manrope | 12.5 / 1.45 | 500 a 700 | 0 | Subtítulos, aviso y línea de estado. |
| `--t-chico` | Manrope | 11.5 / 1.35 | 500 | 0 | Descripción de opción, tarea del subagente y rótulo del cuadro. |
| `--t-mono` | Martian Mono 75 | 10.5 / 1.5 | 400 a 600 | 0 | Chips, rama, "lleva", estado y etiquetas. |
| `--t-mono-s` | Martian Mono 75 | 10 / 1.3 | 500 | 0 | Estado del subagente, nota y modo de la pregunta. |
| `--t-rotulo` | Martian Mono 75 | 10 / 1 | 500 | 0.12em, en mayúsculas | Rótulos de sección ("EQUIPO"). |

**El piso es 10 px.** El boceto tenía 9.5 px en el tipo del subagente. Se sube a 10 px y el boceto ya está corregido.

> **Densidad (2026-11-20).** Todos los tamaños de esta sección y de las secciones 4 y 5 bajaron un escalón por pedido del usuario: «se ve todo un poco grande, como que entra poca informacion en el panel, me gustaria mas chica la tipografia». La referencia de densidad es la de Troko (solo la escala, no la marca). El panel conserva su huella: lo que se libera se usa para mostrar más.

### 3.3 Espaciado

Base 2, con los pasos que usa el boceto:

`--e-1: 2px` · `--e-2: 4px` · `--e-3: 6px` · `--e-4: 8px` · `--e-5: 10px` · `--e-6: 12px` · `--e-7: 14px` · `--e-8: 16px` · `--e-9: 18px` · `--e-10: 20px` · `--e-11: 28px`.

- **Ventana flotante:** relleno de 16 y separación de 16 entre la barra y la columna principal.
- **Tamaño del tablero:** `--ancho-lado: 188px`, `--ancho-principal: 460px` (con el canal de su barra) y `--alto-tablero: 640px` (el marco con su borde). Ancho y alto fijos, iguales en todos los proyectos; lo que no entra se ve con scroll adentro de cada columna (9.2). A 100 % la ventana mide 676 × 656 (los 16 de abajo son el margen de la sombra).
- **Barra lateral:** 14 entre bloques y 2 entre proyectos.
- **Columna principal:** 10 entre bloques y 8 entre cuadros de conteo.
- **Tarjeta de sesión:** relleno de 12 / 14 / 14 y separación de 6 entre fichas.

### 3.4 Radios

| Token | Valor | Pieza |
|---|---|---|
| `--r-ventana` | 26px | Contenedor flotante. |
| `--r-panel` | 26px | Panel abierto desde la muesca, en las esquinas que miran al centro. |
| `--r-muesca` | 22px | Esquinas de la muesca que miran al centro. |
| `--r-hombro` | 16px | Curva cóncava que funde la muesca con el borde. |
| `--r-tarjeta` | 18px | Sesión y pregunta. |
| `--r-cuadro` | 14px | Cuadro de conteo y fila compacta. |
| `--r-ficha` | 13px | Ficha de subagente y "+n". |
| `--r-fila` | 11px | Proyecto en la barra y opción. |
| `--r-campo` | 10px | Campo de texto. |
| `--r-icono` | 7px | Ícono de proyecto. El cuadrito del cuadro de conteo usa 6. |
| `--r-tag` | 6px | Tag "#12". |
| `--r-pildora` | 999px | Chips, aviso, botones y pestañas. |

### 3.5 Sombras y profundidad

La profundidad sale del **escalón de superficies** (`--negro`, `--s1`, `--s2` y `--s3`), no de las sombras. Las sombras se usan solo en tres lugares:

- `--sombra-ventana: 0 16px 32px -16px rgba(0,0,0,.8)`. Es más corta que la del boceto (`0 50px 100px -30px`), porque toda sombra exige margen transparente y ese margen tapa clics (ver 9.5).
- `--sombra-muesca: 0 12px 28px -14px rgba(0,0,0,.9)`.
- `--brillo-pregunta: 0 0 0 5px rgba(242,182,50,.05), 0 24px 48px -26px rgba(242,182,50,.35)`. Va solo en la tarjeta de pregunta.

El borde del contenedor flotante es `1px solid rgba(255,255,255,.07)`. No hay textura ni degradé en la interfaz. La única luz ambiental es la **luz de piso ámbar** bajo cada Avi (ver 5).

### 3.6 Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--ease` | `cubic-bezier(.16,1,.3,1)` | Entradas, aperturas y elevaciones (expo de salida). |
| `--ease-cierra` | `cubic-bezier(.5,0,.75,0)` | Cierre de la muesca (de entrada, rápido al final). |
| `--rebote` | `cubic-bezier(.34,1.56,.64,1)` | Festejo, golpe y ficha nueva. |
| `--d-presion` | 140ms | `:active` con escala de .97 a .985. |
| `--d-color` | 200ms | Fondo, borde y color al pasar el mouse. |
| `--d-elevar` | 350ms | Ficha de subagente que se eleva. |
| `--d-entrada` | 620ms | Entrada escalonada de cada bloque. |
| `--d-escalon` | 65ms | Retraso entre bloques de la entrada. |
| `--d-abre` | 560ms | Apertura de la muesca. |
| `--d-cierra` | 360ms | Cierre de la muesca. |
| `--d-golpe` | 1100ms | Golpe de la pregunta. |
| `--espera-abrir` | 180ms | Tiempo con el mouse encima antes de abrir. |
| `--espera-cerrar` | 650ms | Tiempo con el mouse afuera antes de cerrar. |
| `--cada-golpe` | 90s | Repetición del golpe mientras siga la pregunta. |

---

## 4. Arquitectura de la información

### 4.1 Ventana flotante: el Tablero

```
┌──────────────────────────────────────────────────────────────────────┐
│ ┌ barra lateral 188 ┐  ┌ columna principal 460, alto fijo 640 ────────┐│
│ │ [Avi] Oficina      │  │ oficina                     [📌][—][×]     ││
│ │  · 4 sesiones      │  │ 1 sesión · 3 subagentes trabajando         ││
│ │                    │  │ (aviso: Claude te pregunta en catalogo  →) ││
│ │ [o] oficina     1  │  │ (tarjeta de pregunta de este proyecto)     ││
│ │ [cn] central-…  2  │  │ [3 trabajando][2 terminados][42 min]       ││
│ │ [ca] catalogo 1 ?  │  │ ┌ sesión ──────────────────────────────┐   ││
│ │                    │  │ │ [Avi 56] #12 Estilo avis       42 min│   ││
│ │ ─────────────────  │  │ │ feat/12-estilo-avis                  │   ││
│ │ EQUIPO             │  │ │ · ahora · coordinando el equipo      │   ││
│ │ (NC) Campos  ▾     │  │ │ [Delfina][Ramiro][Lucas][Inés][+1]   │   ││
│ │ actualizado 12:04  │  │ └──────────────────────────────────────┘   ││
│ └────────────────────┘  └────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

**Alto fijo (2026-11-20).** El usuario pidió: «que siempre tenga un alto predeterminado, que no cambie el alto en funcion del proyecto, a lo sumo que tenga un scroll». El tablero mide siempre 640 de alto (`--alto-tablero`). La columna principal desplaza sola, con el encabezado (nombre y controles) fijo arriba y lo que pasa por debajo fundido en 8 px. La barra lateral también desplaza si los proyectos no entran. El scroll es fino, sin pista, y la barra se ve solo con el mouse encima.

**Orden del DOM, que es también el orden del foco:** barra lateral (marca, proyectos, equipo y pie), después la columna principal (encabezado y controles, aviso, pregunta, cuadros y sesiones). Lo que se lee primero en la columna principal es el nombre del proyecto. Si hay pregunta, lo que más se ve es la tarjeta ámbar.

### 4.2 Barra lateral (188 px, columna flex con separación de 14)

1. **Marca.** Avi de Claude de 38 px, "Oficina" en `--t-marca` y debajo el estado: un punto, "4 sesiones abiertas" en mono itálica 10.5, `--crema2`.
   - Estado del Avi de la marca: `teEspera` si hay alguna pregunta pendiente en cualquier proyecto; si no, `coordinando` si alguna sesión coordina; si no, `esperando`. Sin sesiones: `durmiendo`.
   - Hoy la marca usa `teEspera` o `saluda`. En el estilo Avis no existe la pose "saluda", así que se usa este orden.
   - Es zona de arrastre (ver 9.3).
2. **Proyectos** (`<nav aria-label="Proyectos">`). Reemplaza a ◀ ▶. Una fila por proyecto:
   - Es un `button` de alto mínimo 34 con relleno de 6 / 8.
   - Ícono de 22 × 22 con radio 7: iniciales en mono 10 sobre su color al 16 %.
   - Nombre **entero** en `--t-cuerpo-f`: si no entra en una línea sigue en una segunda (corta en los guiones) y recién después va la elipsis. Lleva `title` con el repositorio completo.
   - Chip con la cantidad de sesiones (mono 10, más chico que el de la muesca). Con preguntas, el chip pasa a ámbar: "1 ?", con `aria-label="1 pregunta pendiente"`.
   - El proyecto activo lleva `aria-current="true"`, fondo `--ambar-osc`, texto ámbar y el chip en ámbar al 22 %.
   - **Iniciales:** la primera letra de cada una de las dos primeras palabras (se separa por `-`, `_` o espacio). Con una sola palabra va una sola letra. "fuera de un repositorio" muestra "·".
   - **Color del ícono:** fijo por nombre, con `huella()` de `logica.js` sobre `[ambar, celeste, violeta, verde, rosa]`.
   - El orden es el de `agruparPorProyecto` (no cambia).
3. **Equipo** (pie de la barra, `margin-top: auto`, filete superior `--linea`). Lleva el rótulo "EQUIPO" (`--t-rotulo`) y un `<details>` por compañero, como hoy.
   - El `summary` tiene alto mínimo 36 y muestra un círculo de 24 con las iniciales en violeta, el nombre (12.5 / 700) y la línea "en catalogo · hace 4 min" (11, `--tenue`) o "fuera".
   - Al desplegarse muestra una **fila compacta** de su sesión principal: Avi de Claude de 26 en su estado, "#N rama", la línea de estado y cabecitas de 20 de sus subagentes (máximo 4 y "+n").
   - Si `gh` falla: "Equipo sin datos: …" en una línea `--tenue` con punto rojo y `title` con el error completo.
4. **Pie.** "actualizado 12:04 · cada 1,5 s" en mono 10, `--tenue`, con `role="status"`, como hoy. Un error de lectura reemplaza el texto en `--rojo`.

### 4.3 Columna principal (columna flex con separación de 10)

1. **Encabezado.**
   - `h1` con el nombre del proyecto (`--t-display`), que es el único `h1`.
   - Debajo, la línea "1 sesión · 3 subagentes trabajando" (12.5, `--crema2`). Si alguna sesión pregunta, dice "te hace una pregunta".
   - A la derecha van los **controles de ventana**: 3 botones fantasma de 32 × 32 con ícono de 15 en `--crema2`. Al pasar el mouse van sobre `--s2` en crema. El activo (`aria-pressed="true"`) va en ámbar.

   | Modo | Botón 1 (chinche) | Botón 2 | Botón 3 |
   |---|---|---|---|
   | Flotante | "Siempre arriba" (`fijar_arriba`, como hoy) | "Minimizar a la tira" | "Cerrar a la bandeja" |
   | Acoplado | "Mantener abierta" (no se pliega sola) | "Plegar a la muesca" (flecha hacia el borde) | "Cerrar a la bandeja" |

   - Acoplada, la ventana está siempre arriba. "Siempre arriba" queda marcado y deshabilitado en el menú de la bandeja.
   - El encabezado, sin contar los botones, es zona de arrastre.
2. **Aviso** (cuando la pregunta es de **otro** proyecto, igual que `avisoOtroProyecto`).
   - Es una píldora `button` de alto mínimo 38 sobre `--s1`, con borde ámbar al 45 %.
   - Contenido: Avi de 28 en `teEspera` y "**Claude** te pregunta algo en **catalogo**". A la derecha, "Ver →" en ámbar 800.
   - Al hacer clic va a ese proyecto (`data-accion="ir"`).
   - La misma pieza sirve para la **pregunta plegada** con "Más tarde" (`data-accion="ver"`): "**Claude** te pregunta algo · Ver →", o "3 preguntas esperan · Ver →".
3. **Tarjeta de pregunta** (reemplaza al globo). Ver 4.5.
4. **Cuadros de conteo** (grilla de 3 columnas con separación de 8). Cada cuadro es una tira de relleno 10 / 12: a la izquierda un cuadrito de color de 20 con radio 6 y a su derecha la cifra (`--t-cifra`) con el rótulo debajo (`--t-chico`, `--crema2`). Todo sale de datos que ya existen:

   | Cuadro | Color | Cifra | Rótulo |
   |---|---|---|---|
   | Trabajando | ámbar | Subagentes del proyecto con `estado === 'trabajando'` | "trabajando" |
   | Terminados | verde | Subagentes con `listo` o `fallo` (el mod los guarda 30 min) | "terminados". Si alguno falló, debajo va "1 con error" en `--rojo` mono 10 |
   | Tiempo | violeta | `tiempoRelativo` desde el `inicio` más antiguo de las sesiones del proyecto | "lleva la sesión" (1 sesión) o "la más larga" (varias) |

   La cifra es texto real, no un dibujo. El cuadro lleva `aria-label`, por ejemplo "3 subagentes trabajando".
5. **Tarjetas de sesión**, una por sesión, en el orden de `agruparPorProyecto`. Ver 4.4.

### 4.4 Tarjeta de sesión y ficha de subagente

**Sesión** (`article`, `--s1`, borde `--linea`, radio 18, relleno de 12 / 14 / 14):

- **Fila superior:**
  - Avi de Claude de 56 en el estado de la sesión.
  - Bloque de texto:
    - Título: tag "#12" (mono 10.5 / 600, negro sobre ámbar, radio 6) y el título en `--t-titulo`. Sin tarea, el tag es "sin tarea" sobre `--s3` y el título es la rama en `--crema2`.
    - Rama en mono 10.5, `--tenue`.
    - Línea de estado: un punto y "ahora · coordinando el equipo" en 12.5 / 700, con el color del estado (tabla 5.4). El texto sale de `textoActividad` y lleva `title` con `s.actividad` entera.
  - A la derecha, arriba: "lleva" en mono 10.5 (`tiempoRelativo(s.inicio)`).
- **Título de la tarea:** el dato de la sesión (`Presencia`) **no trae el título de la tarea**, solo el número, la rama y la nota. Propuesta: humanizar el slug de la rama cuando siga la convención `feat/N-slug` ("feat/12-estilo-avis" pasa a "Estilo avis"). Si no la sigue, se muestra la rama. *Pendiente de confirmar por el usuario* (ver Decisiones).
- **Fichas de subagente** (`ul`, fila con separación de 6 y `flex-wrap` si el ancho topa; las 4 fichas y el "+n" entran en una fila):
  - Hasta **4** fichas y una ficha "+n".
  - Se elige con la misma prioridad de hoy (`ORDEN_ANIMO`): pregunta, después trabajo, después falló, después listo y por último durmiendo.
  - Se muestran **en el orden en que se lanzaron**, para que no salten de lugar.
- **Al pasar el mouse** solo cambia el borde a `--linea-hover`. La tarjeta **no se eleva**: no es un control y elevarla haría pensar que se puede tocar.

**Ficha de subagente** (`li`, de 86 a 120 de ancho según el lugar, `--s2`, radio 13, relleno de 6 / 8 / 8):

- Avi de 40 centrado. Es `aria-hidden`, porque el texto ya dice quién es y qué hace.
- Nombre en 12 / 700 con el color de su personaje.
- Si el nombre es inventado, debajo va el tipo ("Explore") en mono 10, `--tenue`. Es la regla de hoy (`a.inventado`).
- Tarea en 11 / 1.3, `--crema2`, cortada a 2 líneas, con `title` completo.
- Estado y tiempo en mono 10, con el color del estado: "escribiendo · 4 min" o "listo · hace 3 min" (`tiempoSubagente`). Un subagente dormido conserva su estado en el texto ("listo" o "falló"), como `estadoLista`.
- Al pasar el mouse va a `--s3` con borde `--linea`, sube 3 px en 350 ms con `--ease` y el Avi pasa a opacidad 1.
- Dormido: el Avi va al 60 % de opacidad. **El texto no se atenúa.**
- **"+n":** 38 de ancho, `--s2`, borde punteado `#34343A`, mono 12 / 600. Lleva `aria-label` y `title`: "1 subagente más: Camila — copy del aviso (listo)".

### 4.5 Tarjeta de pregunta

Usa `--s1`, borde ámbar al 50 % sobre `--linea`, radio 18, relleno de 12 / 14 / 10 y `--brillo-pregunta`. Lleva `role="dialog"` y `aria-labelledby` apuntando al texto de la pregunta. Conserva **todos** los `data-accion`, `data-pregunta`, `data-item` y `data-globo` de hoy: la lógica de `responder.js` no se toca.

1. **Pestañas**, si hay más de una pendiente (`role="tablist"`). Son píldoras con una zona de toque de 36 (dibujo de 28 y `::before` con `inset: -4px 0`), en 11.5 / 700.
   - Cada una muestra el punto del color de quien pregunta, "Claude · Precios" y "!" o "✓" (ya contestada en el borrador).
   - La activa va en `--s3` con anillo interior `#3A3A40`.
2. **Cabecera:** Avi de 28 en `teEspera` y "**Claude** te pregunta · #48 · hace 2 min" en 11.5, `--crema2`.
3. **Pregunta:** `--t-titulo`, con 8 de margen arriba.
4. **Modo** (mono 10, violeta), cuando corresponde: "Se pueden elegir varias" y/o "Pregunta 1 de 2: se envían juntas".
5. **Opciones:** son `button`, con grilla de 26 + 1fr, alto mínimo 42, `--s2` y radio 11.
   - El número va en un cuadrito de 26 con radio 8, violeta sobre violeta al 18 %.
   - La etiqueta va en 13 / 700 y la descripción en 11.5, `--crema2`.
   - **Al pasar el mouse:** borde ámbar al 60 % y fondo `--ambar-osc`. **`:active`:** escala .985.
   - **Selección múltiple:** `aria-pressed`. Marcada lleva borde ámbar, el número en negro sobre ámbar y "✓" en lugar del número.
   - **"Recomendada"** es un rótulo mono 9.5 → **10**, ámbar con borde ámbar al 45 %. Sale de `etiquetaOpcion`.
   - **El rótulo no preselecciona nada:** la opción recomendada se ve igual que las demás hasta que se toca.
6. **Pie:**
   - A la izquierda, el enlace "Otra respuesta" (violeta 800, 12.5, alto 32).
   - A la derecha, "Más tarde" (botón secundario `--s3`) en la pregunta de una opción, o "Seguir (n)" / "Enviar (n)" en la múltiple. Este último va en ámbar y está deshabilitado (opacidad .38, `cursor: not-allowed`) mientras no haya nada marcado.
7. **Otra respuesta:** rótulo "Tu respuesta" (mono 10) y un campo de 32 de alto sobre `--negro`, con borde `--linea` que pasa a ámbar con el foco. Al lado, "Enviar" o "Seguir". Con Enter se envía. El texto **se conserva** en cada redibujo (`st.textoOtra`).
8. **Solo lectura** (la sesión no publica `puedeResponder`):
   - Las opciones son `li` sin hover, con el número en `--tenue`.
   - Abajo va la nota mono 10 con `role="status"`: "Responder en Claude: la sesión espera tu respuesta en su ventana."
9. **Envío:**
   - Mientras se envía, las opciones van en solo lectura y la nota dice "Enviando tu respuesta a Claude…".
   - Después, "Respondé en Claude: la sesión no tomó la respuesta del widget." o "Ya se respondió en Claude.". Son los textos de hoy.
10. **Hecho:** una píldora con borde verde al 50 %, el Avi de 26 en `listo` y "Listo, le respondiste a Claude." (13 / 800) (`role="status"`). Se ve 1,6 s y se achica en 350 ms, con los tiempos de hoy.

### 4.6 Estados de la ventana

| Estado | Qué se ve |
|---|---|
| **Cargando** (antes de la primera lectura, menos de 1,5 s) | El marco del vacío con el Avi de Claude en `esperando` y "Buscando sesiones…". Sin spinner. Como el vacío, es compacto: no usa el alto fijo. |
| **Vacío** (sin sesiones) | No hay barra lateral. Es una sola tarjeta de 330 con los controles arriba a la derecha, el Avi de Claude de 120 en `durmiendo`, "No hay sesiones de Claude Code abiertas." (18 / 800) y "Cuando abras una, aparece acá con sus subagentes." (13.5, `--crema2`). Debajo, separado por un filete, van **Equipo** y el pie. El boceto dibuja solo la tarjeta, pero el equipo y los controles se mantienen porque hoy existen. **Queda compacto** (sigue a su contenido, sin el alto fijo del tablero): un tablero de 640 vacío sería una losa negra. |
| **Error de lectura** | Se mantienen los últimos datos. El pie va en `--rojo` con el mensaje. |
| **Error del equipo** | La línea "Equipo sin datos: …" (4.2). |
| **Tira mini** (flotante, "Minimizar") | 400 × 56, `--negro`, radio 28. Lleva cabecitas de Avi de 32 apiladas (−10 px, borde de 2 `--s1`), el resumen de `resumenMini` (título 13.5 / 800 y detalle mono 11), el chip de preguntas y los botones "Expandir" y "Cerrar" de 44. |

---

## 5. Los Avis

### 5.1 Geometría

Es un solo SVG `viewBox="0 0 120 120"` que se escala por `--t` (tamaño en px). Es vectorial, así que se ve nítido en todos los pasos de zoom. Las definiciones se comparten una vez por documento (`<defs>` oculto): `gPiel`, `gSuelo` y `fBlur`. Las capas van de atrás hacia adelante:

| Capa | Forma | Relleno |
|---|---|---|
| Luz de piso | elipse 60,104 · rx 42 · ry 9 | radial con ámbar al 22 % que se apaga hacia el borde |
| Contacto | elipse 60,104 · rx 26 · ry 3.6 | `#000` al 55 % |
| `g.cuerpo` (origen 50 % 100 %) | — | — |
| · accesorio de atrás | ver 5.2 | color del personaje |
| · patas | elipses 47,101 y 73,101 · rx 8.5 · ry 4.4 | `#D6C8A6` |
| · piel (huevo) | `M60 34C84 34 97 52 97 74C97 92 81 102 60 102C39 102 23 92 23 74C23 52 36 34 60 34Z` | `gPiel`: radial en 36 % / 28 %, de `#FFFCF4` a `#F5EDDC` (42 %), `#E1D4B6` (80 %) y `#CBBB97` |
| · sombreado | `M25 80C30 95 90 95 95 80C92 99 28 99 25 80Z` | `#B9A780` al 34 % |
| · brillo | elipse 43,49 · rx 11 · ry 5.6 · rotada −30° | blanco al 72 % con desenfoque de 1.7 |
| · mejillas | elipses 37,81 y 83,81 · rx 6.8 · ry 3.5 | color del personaje al 36 % |
| · `g.mirada` › `g.ojos` | elipses 49,70 y 71,70 · rx 4.5 · ry 5.8 y luces r 1.5 en 50.7,67.6 y 72.7,67.6 | `#1B1712` y blanco |
| · pico | `M56 78.5Q60 85.5 64 78.5Q60 76.8 56 78.5Z` | `--pico` |
| · accesorio de adelante | solo Delfina (jopo) | color del personaje |
| Efectos del estado | ver 5.3 | — |

Otras variantes de ojos:

- **Cerrados:** dos arcos hacia abajo.
- **Felices:** dos arcos hacia arriba.
- **Falló:** dos "x".

Todos los trazos son `#1B1712`, de 2.8, con terminación redonda.

**Firma de la familia:** el cuerpo siempre es crema y el pico siempre es ámbar. El color de cada personaje vive **solo** en las mejillas y el accesorio. El **copete** (dos mechones en la coronilla) es el rasgo del **Avi base**, la marca de la familia, y va en ámbar como el pico. Los seis personajes no lo llevan, porque su accesorio ocupa la coronilla.

### 5.2 El elenco

Sale de `ELENCO` en `logica.js`. Los nombres que no están en el elenco reciben uno de los cinco subagentes con `huella()`, como hoy. La antena queda reservada para Claude.

| Personaje | Accesorio | Color | Cambio en el código |
|---|---|---|---|
| **Claude** | Antena con foco y halo | ámbar `#F2B632` | Hoy `COLOR.crema`; pasa a ámbar. |
| **Camila** | Orejas de gata con interior de color | rosa `#E78FB3` | — |
| **Ramiro** | Orejas de ratón redondas | celeste `#7FB3FF` | — |
| **Lucas** | Brote de dos hojas | verde `#8FD694` | — |
| **Delfina** | Orejas de mono a los costados y jopo adelante | ámbar `#F2B632` | — |
| **Inés** | Cuernitos | **violeta `#A58BFF`** | Hoy verde; pasa a violeta. Hay que ajustar `test/logica.test.js` en las líneas 79 a 81. |
| *Avi base* | Copete ámbar | ámbar | Solo la hoja de anatomía y la marca. |

Los trazados de cada accesorio son los de `ATRAS` y `FRENTE` en el `<script>` de `estilo-avis.html`. Se copian tal cual.

### 5.3 Estados animados

Por defecto, todos los Avis respiran (`respira` 3,4 s, escala 1 → 1.03 / .965) y parpadean (`parpadea` 4,8 s, `scaleY` .08 al 94 %). Cada Avi tiene un desfase propio: `--d: -((índice × 0.83) mod 3.3)s`, así no respiran todos juntos. Las animaciones son CSS y van en `avis.css`.

| Pose | Dibujo | Bucle |
|---|---|---|
| `esperando` | Base. | respira y parpadea |
| `escribiendo` | Notebook frente al cuerpo (35,80 · 50 × 21, `#1C1C21`) con el logo del color del personaje, manos crema y la mirada 2,5 px hacia abajo. | cuerpo `teclea` .34 s alternado; manos `tecla` .2 s alternadas (la segunda con 0,1 s de retraso); el logo `titila` 1,6 s |
| `escribiendo` + `comando` | Igual, pero el **logo es verde** (hoy la pantalla de comando también es verde). | igual |
| `leyendo` | Libro violeta abierto con las manos a los costados. | la mirada barre de un lado al otro (`mira` 3,2 s) |
| `pensando` | Tres burbujas crema que suben a la derecha. | `idea` 2,4 s, con 0,3 s entre una y otra |
| `coordinando` | Base y antena activa. | dos ondas desde el foco (`onda` 2,2 s, la segunda con 1,1 s de retraso); el foco y el halo laten (`pulso` 1,1 s alternado) |
| `teEspera` | Burbuja ámbar con "!" negro arriba a la derecha. | `salto` 2 s (aplasta, sube 9 px, rebota); la burbuja sigue con 0,08 s de retraso |
| `durmiendo` / `inactiva` | Ojos cerrados y tres "z" `--tenue`. | `duerme` 5,6 s (respira más hondo); las "z" suben y se apagan (3,6 s, cada 1,2 s); sin parpadeo |
| `listo` | Ojos felices y cuatro chispas (ámbar, verde, violeta y rosa). | `festeja` 1 s con `--rebote` y chispas cada 0,25 s. Dura 6 s (`MS_FESTEJO`) y después pasa a `durmiendo` |
| `fallo` | Ojos en "x" y una nubecita con "x" roja. | `tambalea` 3 s (−5° a 4°). Dura 6 s y después pasa a `durmiendo` |
| `proceso` | Anillo celeste girando a la derecha y la mirada que lo sigue. | `gira` 1,1 s lineal; la mirada `sigue` 4 s (ver 5.5) |

Los `@keyframes` son los del boceto, con los mismos nombres y valores: `respira`, `duerme`, `parpadea`, `teclea`, `tecla`, `titila`, `mira`, `idea`, `onda`, `pulso`, `salto`, `gira`, `sigue`, `zeta`, `festeja`, `chispa` y `tambalea`.

### 5.4 De los datos a la pose

Es una función pura nueva, `poseAvi(animo)` en `avis.js`, con tests. Reemplaza a `animoVisual` de `sala.js`.

| Ánimo (`animoSesion` / `animoSubagente`) | Pose | Texto (`textoActividad` / estado del subagente) | Color de la línea |
|---|---|---|---|
| `teEspera` | `teEspera` | "ahora · te hace una pregunta" | ámbar |
| `coordinando` | `coordinando` | "ahora · coordinando el equipo" | ámbar |
| `esperando` (incluye "esperándote", "lanzando…" y sin actividad) | `esperando` | "ahora · esperando tu mensaje" o la actividad tal cual | `--crema` |
| `editando` | `escribiendo` | "ahora · editando main.js" | ámbar |
| `comando` | `escribiendo` + `comando` | "ahora · corriendo …" | ámbar |
| `leyendo` | `leyendo` | "ahora · leyendo …" | celeste |
| `pensando` | `pensando` | "ahora · pensando" | `--crema` |
| `inactiva` (sin publicar hace más de 20 min) | `inactiva` | "sin actividad hace 25 min" | `--tenue` |
| subagente `escribiendo` | `escribiendo` | "escribiendo" | ámbar |
| subagente `leyendo` (Explore y Plan) | `leyendo` | "leyendo" | celeste |
| subagente `listo` (menos de 6 s) | `listo` | "listo" | verde |
| subagente `fallo` (menos de 6 s) | `fallo` | "falló" | rojo |
| subagente `durmiendo` (más de 6 s) | `durmiendo` | conserva "listo" o "falló" | verde o rojo |
| `comiendo`, `reposo` y `saluda` (heredados de `escena.js`) | `escribiendo`, `listo` y `esperando` | — | — |

La prioridad de la línea de Claude: 1) pregunta propia, 2) algún subagente trabajando, 3) procesos en segundo plano sin otra actividad (5.5), 4) "esperándote", 5) la actividad tal cual o dormido.

### 5.5 "esperando 1 proceso" (desde la v0.6)

Aprobado con el "arregla todo" del 2026-11-20. El mod publica `procesos: [{ id, descripcion, desde }]` en cada `Presencia`: los Bash (y PowerShell) de la sesión que siguen corriendo en segundo plano, hasta su aviso (`<task-notification>`), un `TaskStop` o 2 h. Al terminar el turno con procesos pendientes, la actividad dice "esperando 1 proceso" en vez de "esperándote".

- **Prioridad:** tercera, después de la pregunta propia y del equipo trabajando, y solo si Claude no está haciendo otra cosa (terminó su turno o no dice nada). Un servidor de desarrollo corriendo no tapa "editando main.js". Una sesión que espera un proceso no se duerme.
- **Pose `proceso`:** despierto, mira un anillo celeste que gira (indeterminado: no hay porcentaje). Con movimiento reducido o en pausa, el anillo queda quieto.
- **Línea** "ahora · esperando 1 proceso" (o "N procesos") en `--celeste`. Al pasar el mouse, su título lista cada proceso con hace cuánto arrancó.
- **Sin hacer todavía (falta decidir):** la fila `--s2` con el comando y la barra indeterminada bajo la tarjeta, y el punto celeste en la muesca.

### 5.6 Accesibilidad de los Avis

- El Avi es `aria-hidden` cuando el texto de al lado ya dice quién es y en qué estado está: fichas, tarjetas, aviso, pregunta y cabecitas.
- Va con `role="img"` y `aria-label="Claude, coordinando el equipo"` solo donde está solo: la marca y el vacío.
- En la muesca, el nombre lo lleva el botón.

---

## 6. Movimiento

Los bucles de los Avis, los estados de hover y foco y las entradas simples son CSS. Las secuencias que tienen que coordinarse con la ventana de Tauri usan **anime.js v4** (preaprobado). Como el widget no tiene empaquetador, se copia el build ESM en `widget/src/vendor/anime.esm.min.js`; la CSP `script-src 'self'` lo permite.

| Módulo | Qué anima |
|---|---|
| `tableroMotion.js` | Entrada escalonada y cambio de proyecto. |
| `muescaMotion.js` | Abrir, cerrar, golpe e imán. |

### 6.1 Entrada escalonada

- **Cuándo:** al mostrarse la ventana. Desde la ventana única (6.6), expandir desde la tira o la muesca, o soltar la píldora, ya no entra escalonado: el contenido se funde con el despliegue, como en la isla (6.4).
- **Qué:** cada bloque (marca, cada proyecto, el pie de la barra, el encabezado, el aviso, la pregunta, cada cuadro y cada sesión) entra con `sube`: opacidad 0 → 1, `translateY` 14 → 0 y escala .985 → 1.
- **Tiempos:** 620 ms con `--ease` y un retraso de `índice × 65 ms + 120 ms`.
- **No se repite** en cada lectura de 1,5 s. Las firmas de `poner()` ya evitan redibujar lo que no cambió, y eso se mantiene.

### 6.2 Cambios de contenido

- **Cambio de proyecto:** la ventana **no cambia de tamaño** (alto fijo, 9.2). Solo la columna principal entra, 240 ms con `--ease`: opacidad 0 → 1 y 14 px hacia el lado de `st.direccion`. Vuelve al principio del scroll. Las tarjetas entran escalonadas a 40 ms. Solo `transform` y `opacity`.
- **Subagente nuevo:** la ficha entra de escala .9 a 1 con opacidad 0 → 1, en 360 ms con `--rebote`.
- **Subagente que se va:** opacidad a 0 en 240 ms, antes de quitarla.
- **Pregunta nueva:** la tarjeta entra con `sube`, 620 ms.

### 6.3 Hover, foco y presión

- **Color, fondo y borde:** 200 ms.
- **`:active`:** botones a .97 y opciones a .985, en 140 ms.
- **Ficha de subagente:** sube 3 px en 350 ms con `--ease`.
- **Foco:** contorno de 2 px ámbar con separación de 2. En el botón primario ámbar, el contorno es crema.

### 6.4 Muesca

- **Abrir:**
  1. La ventana ya tiene el tamaño del panel desde que se acopló (ver 9.6): abrir no la redimensiona.
  2. Como la isla del iPhone, `clip-path: inset(...)` va en dos tramos encadenados, sin frenar en el medio, en 720 ms: de la muesca a todo lo largo del borde con el espesor de la muesca (`recorte().medio`, hasta el 38 %), y de ahí hacia el centro hasta el panel completo con un resorte críticamente amortiguado (`linear(...)` en `muescaMotion.js`, sin rebote). A los costados, primero crece a lo alto y después entra.
  3. Los bloques de adentro no entran escalonados: el contenido ya está quieto y solo se funde (220 ms) en el segundo tramo. Una entrada escalonada seguía acomodando tarjetas con el panel abierto y se veía como parpadeo.
  4. La muesca se funde en 90 ms desde el primer cuadro del recorte (que nace con su forma), así no se ven las dos superpuestas. Los hombros del panel (7.4) aparecen fundidos en 160 ms cuando termina.
- **Cerrar (480 ms):** los hombros se funden, el contenido se apaga en los primeros 120 ms, el recorte se repliega hacia el borde (hasta el 55 %) y después se angosta hasta la muesca. La muesca reaparece fundida desde el 85 %. La ventana no cambia: al terminar, solo la zona que toma el mouse vuelve a ser la muesca (9.6).
- **Sin redimensiones al abrir ni al cerrar (desde el 2026-11-20):** acoplada, la ventana tiene siempre el tamaño del panel abierto y es transparente salvo la muesca. Lo que se anima es `clip-path` y `opacity` adentro. Antes la ventana pasaba del tamaño de la muesca al del panel al abrir, y WebView2 dejaba la ventana transparente sin pintar unos 0,4 s: la muesca desaparecía, no se veía nada y el panel aparecía casi entero, sin la isla. Ver 9.6.
- **Imán (al arrastrar):** el lado que mira al borde se pinta con un ámbar interior de 3 px y se corre 4 px hacia el borde, en 140 ms. Al soltar y acoplar, el recorte se cierra a la muesca, 360 ms.
- **Golpe** (al llegar una pregunta y cada 90 s mientras siga sin respuesta y la muesca esté cerrada), 1100 ms en total:
  - La muesca se corre 6 px hacia el centro de la pantalla y vuelve con `--rebote` (520 ms).
  - El Avi que asoma hace un `salto` una vez.
  - La luz del borde sube de .75 a 1 y vuelve.
  - El chip "?" late una vez.
  - **Entre golpes nada titila:** la luz queda encendida fija, el Avi queda quieto en la pose `teEspera` con la burbuja "!" y el chip queda fijo. Es la regla de `acople.html`. El boceto de estilo ya está corregido.

### 6.5 Movimiento reducido y pausa

`@media (prefers-reduced-motion: reduce)` y la marca "Pausar animaciones" de la bandeja (`body.pausa`, que ya existe) hacen lo mismo:

- Los Avis quedan **quietos en su pose**. El dibujo del estado se ve igual (notebook, libro, burbuja "!", "z").
- No hay entrada escalonada ni golpe. La muesca abre y cierra al instante.
- La luz del borde queda fija.
- El estado se sigue leyendo por el color, el "?" y el texto.

### 6.6 Transiciones de la ventana única

Decidido con el usuario el 2026-11-21 ("Ventana única de pantalla"): la ventana es siempre el área de trabajo del monitor, invisible, acoplada, flotando y en la tira (9.7). La muesca, la píldora, el tablero y la tira son formas adentro, y pasar de una a otra es una animación, sin velo ni parpadeo, como la isla. Solo `transform`, `opacity` y `clip-path`, con la Web Animations API (`muescaMotion.js`), y con los tiempos y curvas de 6.4. La geometría sale de funciones puras de `muesca.js`: `plegadoHacia` (el recorte del tamaño de la forma nueva contra un lado del tablero, y el `transform` que lo lleva encima de ella), `transformEntre` y `fueraDelBorde`.

| Transición | Cómo | Tiempo y curva |
|---|---|---|
| Muesca → píldora (arrastrada lejos del borde) | La píldora nace con la caja de la muesca y viaja hasta el puntero (`viajar`, llega). | 360 ms, resorte de la isla. |
| Píldora → muesca (vuelve a un borde) | La muesca nace con la caja de la píldora y se asienta en el borde. Al saltar de borde arrastrando, viaja del borde viejo al nuevo. | 360 ms, resorte. |
| Píldora soltada lejos → tablero | El tablero nace con la forma de la píldora (recorte de 184 × 48, radio 24, arriba al medio), viaja a su lugar (`posicionFlotante`) y crece hasta entero (`desplegar`). El contenido se funde en el segundo tramo. | 720 ms: 38 % con `EASE_LARGO`, después el resorte. |
| Tablero soltado junto a un borde → muesca | El recorte se cierra al tamaño de la muesca contra el lado que mira al borde y, a la vez, viaja hasta donde queda la muesca (`plegar`). El contenido se apaga en 120 ms. Al terminar, la muesca está en ese mismo lugar. | 360 ms, `--ease-cierra`. |
| Minimizar → tira | El contenido se apaga en 120 ms; el tablero se recoge en su lugar contra su rincón de abajo a la derecha hasta el tamaño de la tira (45 %) y viaja a su lugar abajo a la derecha (`esquinaTira`, margen 8). Ahí aparece la tira y su contenido se funde. | 720 ms: recoge con la curva del cierre, viaja con el resorte; contenido 160 ms. |
| Expandir ← tira | Al revés: el tablero nace con la forma de la tira, viaja a su lugar y tamaño de antes y crece. | 720 ms, como abrir la isla. |
| Tira arrastrada a un borde → muesca | La tira viaja hasta la caja de la muesca mientras su contenido se apaga (120 ms). | 360 ms, `--ease-cierra`. |
| Bandeja: otro borde | La isla se cierra si estaba abierta; la muesca sale por su borde fundiéndose y entra por el nuevo. | 360 + 360 ms: sale con `--ease-cierra`, entra con el resorte. |
| Bandeja: Flotante | El tablero nace con la forma de la muesca, viaja a su lugar flotante guardado y crece. | 720 ms, como abrir la isla. |
| Tablero o tira soltados medio afuera sin imán (un borde que toca otro monitor) | Vuelven adentro del área con el mismo viaje. | 360 ms, resorte. |
| Cambio de tamaño (zoom) | Sin animación: en la misma tarea se reubica todo, así nada salta un cuadro. | — |

- **Una transición por vez:** mientras dura no empieza otra ni un arrastre (`st.transicion`), y al terminar la muesca se pone al día con lo pedido (abrir o cerrar).
- **Sin movimiento** (reducido o "Pausar animaciones"): todo cambia al instante, como en 6.5.
- **Velo:** solo al pasar la ventana a otro monitor o si cambia el área (9.6 y 9.7).

---

## 7. La muesca: comportamiento por borde

Se acopla un borde a la vez. Fuera del borde, la ventana flota.

### 7.1 Forma

La muesca es negra (`--negro`) y está pegada al borde del `workArea`. Las dos esquinas que miran al centro tienen radio de 22 px. Los **hombros** son cuadrados de 16 × 16 con un `radial-gradient` transparente hasta 15.5 px y negro desde 16 px, que la funden con el borde.

Adentro lleva:

1. El **Avi de Claude que asoma**: una caja de 40 × 34 con `overflow: hidden` y un Avi de 44 corrido −2 / −1. Se ven la antena, la cabeza y los ojos. **El Avi va siempre derecho**, en los cuatro bordes.
2. Un punto de estado de 7 px.
3. Un chip: la cantidad de sesiones, o "n ?" en ámbar si hay preguntas.

| Borde | Dirección | Radios (si, sd, id, ii) | Relleno | Hombros | Abre hacia |
|---|---|---|---|---|---|
| `arriba` | fila | 0 0 22 22 | 0 14 6 12 | izquierda y derecha, arriba | abajo |
| `abajo` | fila | 22 22 0 0 | 6 14 2 12 | izquierda y derecha, abajo | arriba |
| `derecha` | columna | 22 0 0 22 | 10 6 12 8 | arriba y abajo, a la derecha | la izquierda |
| `izquierda` | columna | 0 22 22 0 | 10 8 12 6 | arriba y abajo, a la izquierda | la derecha |

- **Medidas:** arriba y abajo, alrededor de 112 a 152 × 40, según el chip. A los costados, 52 × 112 a 152.
- **Estado del Avi y del punto:** el mismo orden que la marca (4.2). El punto va en ámbar si trabaja o pregunta, en `--crema` si espera y en `--tenue` si todo duerme.
- **Al pasar el mouse:** la muesca se corre 2 px hacia el centro en 350 ms con `--ease`.
- **Luz de pregunta:**
  - Es una franja ámbar de 3 px **sobre el borde de la pantalla**, a lo largo de la muesca y sus hombros (+12 px por lado).
  - Tiene desenfoque de 6, opacidad .75 fija y los extremos apagados con `mask`.
  - Nunca va sola: el chip dice "1 ?" y el nombre del botón lo dice en palabras.

### 7.2 Comportamiento

| Acción | Resultado |
|---|---|
| Mouse encima 180 ms | Abre **sin tomar el foco del teclado** (no interrumpe lo que se escribe en otra app). |
| Clic, Enter o Espacio sobre la muesca | Abre y lleva el foco al proyecto activo de la barra. |
| Mouse afuera 650 ms | Cierra, salvo que esté **"Mantener abierta"**. Si el mouse vuelve antes, se cancela. |
| Después de cerrar | No vuelve a abrir por hover hasta que el mouse salga de la muesca una vez (evita el aleteo). |
| Esc | Si el foco está en la pregunta: la pliega ("Más tarde", como hoy). Si no: cierra **aunque esté fijada**, la desfija y devuelve el foco a la muesca. |
| Arrastrar más de 4 px | Se mueve la muesca. Ver 7.3. |
| Pregunta nueva | Golpe (6.4). Avisa también por Windows si está marcado "Avisarme con cada pregunta" (no cambia). |

**Nombre de la muesca:** "Oficina: 4 sesiones abiertas. Abrir", "Oficina: 2 sesiones trabajando. Abrir" o "Oficina: Claude te hace una pregunta en catalogo. Abrir". Lleva `aria-expanded`.

### 7.3 Arrastre e imán

- **Imán:** si el puntero suelta a 20 px o menos de un borde exterior del monitor que tiene debajo, se acopla. Con varios monitores, solo cuentan los bordes que no tocan a otro monitor.
- **Arrastrando la muesca:**
  - Cerca de su borde, se desliza a lo largo de él y cambia el `lugar`.
  - Cerca de otro borde, salta a ese borde con su forma.
  - Lejos de todo borde, se dibuja como una **píldora flotante** con el estilo de la tira mini (Avi, título y chip), que sigue al puntero.
- **Al soltar lejos de un borde:** **flota**, es decir, se abre el Tablero flotante en esa posición, ajustada al `workArea`.
- **Arrastrando el Tablero flotante** desde la marca o el encabezado: a 20 px de un borde aparece el aviso del imán (6.4) y una píldora mono 11 junto a ese lado, "Soltá para acoplar · arriba". Al soltar, se pliega a la muesca en ese borde. El `lugar` es la proyección del centro de la ventana sobre el borde.
- **Sin mouse:** el menú de la bandeja suma "Acoplar a" con las opciones Arriba, Derecha, Abajo, Izquierda y Flotante. "Mostrar Oficina" abre el panel.

### 7.4 Panel abierto

- Abierto, el panel es **el Tablero completo** de la sección 4, igual que flotando: barra, pregunta, cuadros, sesiones y equipo. En el boceto el panel aparece abreviado solo para que entre en la maqueta.
- Va pegado al borde, centrado en el `lugar` de la muesca y ajustado al `workArea` con un margen de 8.
- Su lado contra el borde no tiene borde ni radio y lleva los hombros de 16. Las esquinas que miran al centro tienen radio 26.
- **Capas (obligatorio):** si el panel vive en el DOM recortado a la muesca mientras está cerrado (`clip-path` al rectángulo de la muesca), **el contenido de la muesca va por encima del panel**: `z-index: 1` en la muesca y el panel debajo. Si no, el panel negro recortado tapa al Avi, el punto y el chip, y la muesca se ve vacía. Es el error que se corrigió en `acople.html` (`.v-a .ficha { z-index: 1 }`). Durante la apertura, la muesca se oculta (`visibility: hidden`) recién cuando el recorte la superó, y vuelve a mostrarse antes de que termine el cierre.

### 7.5 Lo que se guarda

En `preferencias.json`, junto a `tamano`:

```json
"acople": { "borde": "arriba", "lugar": 0.42 }
```

- `borde` es `"arriba"`, `"derecha"`, `"abajo"` o `"izquierda"`.
- `lugar` va de 0 a 1 y es el centro de la muesca a lo largo del borde, ajustado para que la muesca y sus hombros entren en el `workArea`.
- Flotando es `"acople": null`. La posición del tablero flotante va en `"flotante": { "x", "y" }`: la fracción del lugar libre del área (0 arriba a la izquierda, 1 abajo a la derecha), así vuelve adentro aunque cambien el monitor, la barra de tareas o el tamaño (9.7). Reemplaza a `tauri-plugin-window-state`, que se sacó.
- El monitor de la última vez va en `"monitor": { "x", "y" }`: el centro de su área de trabajo en px físicos, guardado al acoplar y al soltar el tablero.
- Al arrancar, la ventana ocupa el área del monitor que contiene ese punto, acoplada o flotando. Si no hay o ya no está, el principal.

---

## 8. Accesibilidad

- **Encabezados:** un solo `h1` (el nombre del proyecto; en el vacío, el texto principal). Después van `h2` ocultos visualmente para "Proyectos", "Equipo" y "Sesiones", y `h3` para el título de cada sesión. No se salta ningún nivel.
- **Orden del foco:**
  1. Proyectos.
  2. Compañeros (`summary`).
  3. Controles de ventana.
  4. Aviso.
  5. Pestañas de la pregunta, después las opciones, "Otra respuesta" y "Más tarde" / "Seguir".
  6. La ventana no tiene más controles. Las tarjetas no reciben foco.
- **Acoplada y cerrada:** el único control es la muesca.
- **Teclado:**
  - Lo de hoy se mantiene: ← → cambia de proyecto (fuera de los campos), 1 a 9 elige una opción con el foco en la pregunta, Enter envía "Otra respuesta" y Esc pliega la pregunta. Ctrl + / Ctrl − / Ctrl 0 cambian el tamaño.
  - Lo nuevo: ↑ ↓ mueven el foco entre los proyectos, y Esc cierra la muesca (7.2).
  - **Nunca se mueve el foco solo** cuando llega una pregunta.
- **Nombres accesibles:**
  - Cada botón de ícono tiene `aria-label` y `title`.
  - Los chips de cantidad tienen `aria-label` en palabras.
  - Los proyectos llevan `aria-current`, los conmutadores `aria-pressed` y la muesca `aria-expanded`.
- **Avisos en vivo:** el pie es `role="status"`. Además hay una región `aria-live="polite"` oculta que anuncia **una vez** "Claude te pregunta algo en catalogo" cuando llega una pregunta. No se repite con cada golpe.
- **Zonas de toque:** 32 × 32 como mínimo en lo que se toca seguido (botones, enlaces, campo, controles de ventana; la opción mide 42 de alto); por encima del mínimo de 24 × 24 de WCAG 2.2 (2.5.8). Las pestañas tienen un dibujo de 28 con una zona de 36. Densidad del 2026-11-20: antes era 44 × 44.
- **Contraste:** todo texto pasa 4.5:1 (sección 3.1). El foco ámbar sobre negro tiene 11.5:1.
- **El color nunca va solo:** la pregunta tiene "?", "!" y texto, el error tiene "con error" y el estado siempre tiene su texto.
- **Movimiento:** 6.5. Los bucles de los Avis duran más de 5 s, y el usuario los puede pausar desde la bandeja (ya existe).

---

## 9. Notas de implementación en Tauri

### 9.1 Configuración

- `tauri.conf.json`: `transparent: true`, `decorations: false` (ya está), **`shadow: false`** (hoy `true`), `alwaysOnTop` (ya está) y `skipTaskbar: true`.
- Acoplada, la ventana se crea o se muestra **sin tomar el foco** (`focus: false` al mostrar por hover).
- Hay que sumar permisos en `src-tauri/capabilities/default.json` para lo que se llame desde JS, o mover y redimensionar con los comandos de Rust que ya existen (`ajustar_ventana` y `geometria`). Hoy solo están `start-dragging`, `is-visible` e `is-minimized`.

### 9.2 Tamaño de la ventana: fijo en el tablero, salvo la animación

**Desde el 2026-11-20 el tablero tiene ancho y alto fijos** (`--ancho-lado`, `--ancho-principal` y `--alto-tablero`, 3.3). `medidaVentana` (`tamano.js`) toma el alto del token, no del contenido, así cambiar de proyecto o que aparezca una pregunta no redimensiona la ventana: lo que no entra se ve con scroll adentro. El ancho sale de las dos columnas, que también son fijas. El tamaño crece con el zoom (100 a 200 %) y se topa al 90 % del área de trabajo, como antes; topado, las columnas desplazan.

El `ResizeObserver`, `tamano.js` y `ajustar_ventana` se mantienen solo donde todavía hace falta seguir al contenido: el vacío y la carga (compactos, 4.6), el cambio de zoom, la muesca y la tira mini. **Mientras la muesca abre o cierra, el observador se pausa** y se fija el tamaño final. Si no, la ventana se redimensiona en cada cuadro.

`ajustar_ventana` mueve y redimensiona en una sola llamada de Windows (`SetWindowPos`, `mover_y_redimensionar` en `lib.rs`): con `set_size` y después `set_position` se veía un cuadro con el tamaño nuevo en el lugar viejo.

**Acoplada, la muesca ya no redimensiona al abrir ni al cerrar (9.6).** Mientras abre o cierra, el observador igual se pausa (`st.animando`) y el ajuste espera al final de la animación.

### 9.3 Arrastre propio

Hoy el arrastre lo hace Windows (`data-tauri-drag-region`), y JS no ve el recorrido. El aviso del imán en vivo necesita **arrastre propio**:

1. `pointerdown` en la zona de arrastre (marca, encabezado o muesca), con `setPointerCapture`.
2. Un umbral de 4 px.
3. En cada `requestAnimationFrame`, mover la ventana a la posición del puntero en pantalla menos el desplazamiento inicial, con un comando `mover_ventana(x, y)` o `ajustar_ventana`.
4. Calcular la distancia a cada borde del `workArea` en cada cuadro.
5. Al soltar, acoplar o dejar flotando.

Se descartó la alternativa más barata, `startDragging()` nativo y decidir el imán al soltar con `onMoved`, porque no da aviso en vivo.

### 9.4 `Monitor.workArea`

**Ya está en uso:** el comando `geometria` de `src-tauri/src/lib.rs` (línea 228) llama a `monitor.work_area()`, con Tauri 2.12.7 según `Cargo.lock`. No hace falta `SPI_GETWORKAREA`.

- Para varios monitores, `geometria` tiene que devolver el monitor **bajo el puntero** (`monitor_from_point`) y los bordes que tocan a otro monitor.
- "Abajo" es el borde inferior del `workArea`, sobre la barra de tareas. Si la barra se oculta sola, el `workArea` llega al borde de la pantalla y la barra tapa la muesca cuando aparece. Es aceptado.

### 9.5 El fondo pasa de `body` a un contenedor

Hoy `body` pinta el fondo (`--ficha`), el borde y la animación `aparece`. Con la ventana transparente:

- `html` y `body` quedan **transparentes** y sin borde.
- `#marco` (nuevo, que envuelve todo) lleva `--negro`, el radio y el borde de cada modo, `--sombra-ventana` y la animación de entrada.
- **Cuidado: en WebView2 los píxeles transparentes de la ventana siguen recibiendo clics.** Flotando, el margen transparente tiene que ser el mínimo: alrededor de 16 px para la sombra. No hay que agrandarlo por estética. Acoplada, la ventana es grande y transparente a propósito, y lo que no es la zona interactiva deja pasar los clics (9.6).
- `medirContenido()` tiene que sumar ese margen y el borde del marco, no el de `body`.

### 9.6 Muesca acoplada: ventana fija y clics que pasan de largo

Decidido con el usuario el 2026-11-20 ("dale, probemos la opción 1"), después de filmar la ventana real: al pasar el mouse por la muesca, la ventana pasaba del tamaño de la muesca al del panel y WebView2 la dejaba sin pintar unos 0,4 s. La isla (6.4) no se veía nunca, y hacerla más lenta no servía porque el hueco venía antes de la animación.

- **La ventana tiene un solo tamaño acoplada.** Es la unión de la muesca cerrada (con hombros, luz y holgura) y del panel abierto (`disposicionAcoplada` en `muesca.js`). Se coloca una sola vez, con `ajustar_ventana`, al acoplar y al cambiar de borde, de lugar, de tamaño elegido (zoom), de contenido (vacío, carga o tablero) o de área de trabajo. El ciclo de 1,5 s la revisa (`colocarAcoplada`, que solo la mueve si `fueraDeLugar`).
- **Abrir y cerrar son solo el recorte adentro** (`desde` → `medio` → `hasta` y vuelta), sin `ajustar_ventana`. Única excepción, de seguridad: si al abrir la ventana quedó fuera de lugar (el área cambió y el ciclo todavía no la recolocó), se coloca una vez antes de animar.
- **Cerrada, se ve solo la muesca**, en su lugar adentro de la ventana grande (`--mx`, `--my`), con su luz (`--lx`…) y el golpe. Va por encima del panel recortado (`z-index`). `html`, `body` y todo lo demás no pintan: ni fondo ni sombra.
- **Zona interactiva** (`zonaInteractiva`, px lógicos de pantalla), que la ventana manda con el comando `zona_interactiva { x, y, ancho, alto, toda }`:
  - cerrada: la muesca más 8 px (`MARGEN_ZONA`, cubre el golpe de 6 y el hover de 2);
  - abierta: el tablero;
  - arrastrando la muesca: toda la ventana (`toda`), para no perder el puntero.
- **Clics que pasan de largo:** un solo hilo de Rust (`sondear_puntero`) mira el puntero cada 20 ms mientras la ventana se ve, en todas las formas desde la ventana única (`debe_sondear`, 9.7). Usa `GetCursorPos`, en px físicos, y pasa la zona a px físicos con la escala de la ventana (`dentro_de_zona`: el borde izquierdo y el de arriba cuentan, el derecho y el de abajo no). Solo cuando el puntero cruza el borde de la zona llama a `set_ignore_cursor_events` y emite `oficina://puntero-zona { dentro, n }`. Escondida en la bandeja o minimizada, la ventana vuelve a tomar todos los clics y el hilo duerme (despierta a los 250 ms o cuando un comando lo despierta). "Salir" lo termina.
- **Hover y salida los manda el sondeo:** con los clics pasando de largo, el WebView no ve salir al puntero. `oficina://puntero-zona` dispara `entra` (abre a los 180 ms) y `sale` (cierra a los 650 ms, salvo fijada). Un aviso con `n` más viejo se descarta. El DOM solo adelanta lo mismo: `pointerenter` en la muesca o en el tablero, y `pointerleave` de la ventana entera.
- **Teclado:** Enter o Espacio sobre la muesca, "Mostrar oficina" y Esc siguen igual. Desde el #21 el puntero ya no abre ni cierra: el panel se abre con un clic (o Enter/Espacio) y se cierra con un clic afuera (la ventana pierde el foco), Esc u otro clic en la muesca.
- **Arrastre:** la muesca, la píldora, el tablero y la tira se mueven adentro de la ventana del área; la ventana solo se mueve al pasar a otro monitor (9.7).
- **Primer aviso de cada zona:** el sondeo avisa el estado real en su primera vuelta al arrancar, con cada zona nueva y al volver a sondear, aunque no haya cambiado (`informado`). `guardar_acople` olvida la zona vieja (`olvidar_zona`). Desde el #21 los avisos de zona solo mueven la mirada del Avi (`muescaAvi.zona`); ya no abren la muesca.
- **Redimensionar sin parpadeo:** desde la ventana única (9.7) la ventana solo cambia al pasar a otro monitor o si cambia el área de trabajo. Entonces `planVentana` decide velar: `body.velada` esconde al instante la muesca, la luz, la píldora, el tablero y la tira, se llama a `ajustar_ventana`, se esperan dos cuadros y `ASIENTO_VELO_MS` (220 ms, ajustable) y todo vuelve en 160 ms (al instante sin movimiento). Cambiar de borde, pasar a la píldora, flotar, minimizar, el zoom, abrir y cerrar no velan: no tocan la ventana.
- **Vista de desarrollo:** `dev/falso.js` imita el sondeo con el puntero de `vista.html` y el paso de los clics con `pointer-events: none` en el iframe.
- **Solo se puede confirmar en la ventana real de Tauri:**
  - que `set_ignore_cursor_events` deje pasar los clics sin parpadeo (en Windows prende `WS_EX_TRANSPARENT | WS_EX_LAYERED`);
  - el costo del sondeo en CPU;
  - el comportamiento con monitores de distinta escala;
  - que el panel abra sin el hueco sin pintar.

### 9.7 Ventana única: la ventana es el área en todos los modos

Decidido con el usuario el 2026-11-21: arrastrar la muesca, pasar a la píldora, flotar, acoplar el tablero, minimizar y expandir "todavía funciona un poco raro". La causa era la misma de 9.6: cada cambio de forma redimensionaba una ventana transparente y WebView2 tardaba ~0,4 s en repintar (el velo lo tapaba). La solución elegida fue extender 9.6 a todo: "La ventana queda siempre del tamaño de la pantalla, invisible, también flotando y en la tira".

- **La ventana es `ventanaDeArea(area)` siempre.** Solo se mueve, una vez y velada, al pasar a otro monitor o si cambia el área (`colocarEnArea`, el ciclo de 1,5 s). `mover_ventana`, `aplicar_mini` y `esquina_tira` de Rust se sacaron.
- **Cada forma es un elemento adentro** (`disposicionAcoplada`, `disposicionFlotante`, `disposicionTira` en `muesca.js`, colocadas con `colocar` en `main.js`): el tablero flotante con `--tx`…`--th` (su tamaño sale de `tamanoDeseado`, topado al 90 % del área), la tira con `--qx`, `--qy` (abajo a la derecha, `esquinaTira`, `MARGEN_TIRA` 8, o donde se la soltó en esta ejecución), la muesca y la píldora como en 9.6. Arrastrar es mover el elemento.
- **Zona interactiva en todos los modos** (`zonaInteractiva`): acoplada como en 9.6; flotando, el tablero; en la tira, la tira; arrastrando cualquier forma, toda la ventana. Afuera, los clics pasan. La mirada (`oficina://cursor`) sigue siendo solo acoplada; flotando, la marca mira con el puntero del DOM, y al salir del tablero lo sabe por el aviso de la zona (`marca.zona`).
- **Al arrancar,** Rust pone la ventana en el área del monitor guardado (`colocar_al_arrancar`, en px físicos, con la ventana escondida hasta ubicarla: `visible: false` en `tauri.conf.json`). Nada se ve hasta la primera disposición (`body.colocada`); flotando, el tablero entra con `aparece`.
- **Lo que se guarda** está en 7.5 (`flotante` y `monitor` en `preferencias.json`). Se sacó `tauri-plugin-window-state`: guardaba la posición de una ventana que ahora es siempre el área, y dos lugares guardando lo mismo se pisaban.
- **"Siempre arriba"** sigue siendo del usuario flotando (acoplada, siempre arriba), y flotando la app sigue en la barra de tareas.
- **Transiciones:** 6.6.
- **Solo se puede confirmar en la ventana real de Tauri** (además de lo de 9.6): que una ventana transparente del tamaño del área no moleste en la barra de tareas ni en Alt+Tab; que al arrancar no haya un cuadro de la ventana en otro lugar; y el paso entre monitores de distinta escala (la ventana se coloca con px lógicos de su escala actual, como antes).

---

## 10. Qué se reemplaza y qué se mantiene

| Archivo | Destino |
|---|---|
| `mascotas.js` | **Se borra** cuando los Avis cubran todos sus usos (`sprite`, `cabeza`, `svgDoc` y `KF`). |
| `escena.js` | **Se divide y se reescribe:** `avis.js` (generador SVG puro y `poseAvi`, con tests), `tablero.js` (barra, encabezado, cuadros, sesiones, fichas, equipo, vacío y tira) y `pregunta.js` (tarjeta de pregunta). De `escena.js` se conservan, movidas: `prepararProyecto`, `firmaTerrario` (que pasa a llamarse `firmaTablero`), `subagentesVisibles` con `ORDEN_ANIMO`, `quienPregunta`, `lista` como base de las fichas, `avisoOtroProyecto`, `companero` y `firmaCompanero`. **El globo cambia de forma, no de contrato:** los mismos `data-*` y la misma lógica de envío. |
| `sala.js` y `test/sala.test.js` | **Se borran.** `MAX_SUBAGENTES_VISIBLES = 4` y el reparto entre visibles y "+n" pasan a `tablero.js`, con su test. `animoVisual` se reemplaza por `poseAvi`. `pantallaNotebook` y `desplazamiento` desaparecen. |
| `tamano.js` | Se mantiene. **`colaGlobo` se borra** (la tarjeta no tiene cola), junto con su test. `MINI` (400 × 56) se mantiene. |
| `logica.js` | Se mantiene. Solo cambian los colores de `ELENCO`: Claude a ámbar e Inés a violeta. |
| `responder.js` y `equipo.js` | **Sin cambios.** |
| `estilos.css` | Se reescribe con los tokens de la sección 3. Se suma `avis.css` con las poses y los `@keyframes`. |
| `index.html` | Nueva estructura: `#marco` con `aside.lado` y `main`. **La barra de título se va:** sus controles pasan al encabezado. |
| `bandeja.js` (ícono de la bandeja y de la app) | **Se mantiene como está.** Ver la nota abajo. |

**Nota sobre `bandeja.js`:** a 16 px, una grilla de píxeles es la técnica correcta, no un rastro del estilo viejo. La "Ficha ámbar" ya habla el idioma de los Avis (cabeza crema sobre ámbar), y sus tests la fijan. Redibujar la grilla como un Avi (huevo crema y pico) queda como fase opcional **a decidir por el usuario**. El foco rosa del ícono se mantiene porque sobre ficha ámbar un foco ámbar no se vería.

---

## 11. Regla firme: el widget nunca decide por el usuario

- **Solo un clic envía:** un clic en una opción de una sola elección, en "Seguir" / "Enviar" de la múltiple o en "Enviar" de "Otra respuesta".
- **No hay opción por defecto.** "Recomendada" es un rótulo: no marca, no resalta más que el rótulo, no recibe el foco primero y no responde a Enter si no tiene el foco.
- **No hay tiempo que elija:** no hay cuenta regresiva, ni envío al cerrar la muesca, ni respuesta por inactividad.
- **Cerrar la muesca, plegar la pregunta o cambiar de proyecto no responde nada.** El borrador y el texto de "Otra respuesta" se conservan.
- **Abrir por hover no lleva el foco a la pregunta**, así una tecla pensada para otra app no elige una opción.
- **El golpe y la luz solo llaman la atención.** Nunca abren la pregunta ni la responden.
- Los tests que lo fijan se mantienen: `hooks/oficina.test.tsx` y `widget/test/responder.test.js`.

---

## 12. Plan por fases

Cada fase es un corte revisable de unas 400 líneas. Todas las fases deben dejar el widget funcionando.

| Fase | Contenido | Verificación |
|---|---|---|
| **F1 · Tokens y marco** | Fuentes empaquetadas; tokens; ventana transparente con `#marco`; `shadow: false`; barra lateral, encabezado con controles, cuadros, tarjetas de sesión y fichas. Las cabezas pixel de hoy quedan **provisoriamente** en los lugares de los Avis. | Pruebas de `logica`, `tamano` y `responder`; mirar el widget al 100, 150 y 200 %. |
| **F2 · Pregunta y estados** | Tarjeta de pregunta (incluye solo lectura, envío y hecho), aviso, plegada, vacío, carga, errores, equipo y tira mini. | `responder.test.js` sin cambios y en verde; recorrer a mano una y varias preguntas, la múltiple, "Otra respuesta" y "Más tarde". |
| **F3 · Avis** | `avis.js` (generador y `poseAvi`) y `avis.css`; colores de `ELENCO`; se borran `mascotas.js` y `sala.js`; se divide `escena.js`; `tableroMotion.js` (entrada escalonada y cambio de proyecto). | Tests nuevos de `poseAvi` y del reparto entre visibles y "+n"; prueba de movimiento reducido y pausa. |
| **F4 · Muesca** | `acople` en `preferencias.rs` (leer, guardar y migrar); `geometria` con el monitor bajo el puntero; arrastre propio e imán; muesca por borde; abrir y cerrar con el observador pausado; golpe y luz; `muescaMotion.js`; menú "Acoplar a". Puede partirse en F4a (Rust y estado guardado) y F4b (interfaz y movimiento). | Tests de Rust de `preferencias`; tests puros del imán (distancia, borde y `lugar`); recorrer los cuatro bordes y la posición flotante. |
| **F5 · Opcional** | Redibujo del ícono de la bandeja como Avi. **Solo si el usuario lo pide.** | `bandeja.test.js`. |
| **v0.6** | "Esperando 1 proceso" (5.5): pose, línea y título. La fila de proceso y el punto celeste de la muesca siguen sin decidir. | — |

Al cerrar F2, F3 y F4, Delfina hace una revisión de diseño. Para eso hace falta ver la interfaz en un navegador con datos de prueba, porque Playwright no maneja la ventana de Tauri (ver los puntos abiertos en el informe).
