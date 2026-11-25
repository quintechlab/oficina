# Avis · La barra como menú de módulos — dirección

> Issue #42, rama `feat/42-modulos` (sale de `feat/39-tareas`). Boceto: `docs/diseno/bocetos/modulos.html` (servirlo con http desde la raíz del repo). Tres opciones: **A · Menú**, B · Árbol y C · Riel. **Quintana eligió A · Menú el 24/11** y aprobó las decisiones del boceto (sección 15). Esta dirección cubre solo A; de B se toma únicamente el paso intermedio de la entrega M1 (14), y de C nada.
> Evoluciona `estilo-avis-ux.md` (tokens, barra, columna), `tareas-ux.md` (la hoja en la columna, la fila de la barra, Esc por capas), `configuracion-ux.md` (la hoja, `#cfg-aviso`), `dividida-ux.md` (el riel, las fichas «Conversan»), `muesca-avi-ux.md` y `bienvenida-ux.md`. Lo que no se nombra acá sigue como está allí. Hábitos (#41) entra como un módulo más con su propia dirección: `habitos-ux.md`.

---

## 1. Brief

- **Pedido (24/11, palabras de Quintana):** «las sesiones metelas en la hoja de Sesiones» y «así quedarían los módulos, por ejemplo, sesiones, hábitos, tareas, configuración, etc». Pidió bocetos y eligió A.
- **Qué cambia:** lo que hoy es el tablero (proyectos en la barra y tarjetas de sesión en la columna) pasa a ser el módulo **Sesiones**, par de **Tareas**, **Hábitos** y **Configuración**. La barra queda como menú y admite más módulos a futuro (por ejemplo, Proyectos).
- **Para quién:** Quintana, que tiene Avis abierto todo el día y entra muchas veces por poco tiempo.
- **Acción principal:** que una pregunta de Claude se responda rápido estés en el módulo que estés. Después: saltar entre módulos con un clic o un atajo.
- **Vara:** `webs portfolio/brasa-noble`. Sin fuentes ni colores nuevos. 60 fps en un equipo medio con zoom de 200 %. Nada se rompe: la dividida, la muesca, la tira, primeros pasos y la charla siguen andando igual.

## 2. Concepto

**El menú y la portada.** La barra deja de ser «la lista de proyectos» y pasa a ser el lugar fijo desde donde se elige qué mirar. Tres palabras: **fijo, contado, a mano**. Lo que se recuerda: **la píldora ámbar que viaja** de un módulo al otro, y una pregunta de Claude que no se puede perder: se ve en tres lugares a la vez, desde cualquier módulo.

Principios: Sesiones es la portada (abre ahí y Esc vuelve ahí); cada módulo lleva su cuenta; el menú siempre está a la vista, así que no hace falta un «‹ Tablero»; una pregunta pendiente siempre se ve.

## 3. Arquitectura

### 3.1 Módulos

| Orden | Módulo | Fila | Atajo | Contenido de la columna |
|---|---|---|---|---|
| 1 | **Sesiones** | `#mod-sesiones` | **Esc** desde cualquier otro módulo | Tira de proyectos (4.4), avisos (`#otro`), pregunta (`#w-globo`), conteos, tarjetas. Vacío, cargando y primeros pasos, como hoy |
| 2 | **Tareas** | `#tar-fila` (se conserva el id) | **Ctrl T** (existe) | La hoja `#tar` de `tareas-ux.md`, sin «‹ Tablero» |
| 3 | **Hábitos** | `#hab-fila` | **Ctrl H** (medir antes de construir, 11.7) | La hoja `#hab` de `habitos-ux.md` (entra con #41) |
| — | **Configuración** | `#cfg-fila` (se conserva el id), separada al pie | **Ctrl ,** (existe) | La hoja `#cfg` de `configuracion-ux.md`, sin «‹ Tablero» |

Un módulo nuevo (por ejemplo, Proyectos) es una fila más en el grupo de arriba, con su ícono de 15, su cuenta y su atajo. Configuración queda siempre abajo y aparte.

### 3.2 Entrar y salir

- **Al arrancar:** Sesiones. El último módulo **no** se guarda entre ejecuciones.
- **Cambiar de módulo:** clic en su fila, su atajo, o los caminos que hoy abren cada hoja (Configuración desde la bandeja y desde el asistente; Tareas desde su globo diario). Todos pasan por una sola función, `irModulo(id, opciones)` (11.3).
- **Salir de un módulo:** Esc por capas (9.1). Cuando un módulo ya no tiene capas, el Esc siguiente lleva a Sesiones. En Sesiones, Esc hace lo de siempre (acoplada, pliega el panel).
- **Se van** `#cfg-volver` y `#tar-volver` («‹ Tablero»). **Se queda** `#volver`, que es la salida de la pantalla dividida («‹ vista anterior», `dividida-ux.md` 5.2).
- **Elegir un proyecto** (la tira de 4.4, el aviso de una pregunta, el riel de la dividida) lleva a Sesiones en ese proyecto.

### 3.3 Dónde se dibuja

Mismo marco que hoy: la barra (188) y la columna (`.principal`). La barra pasa a tener, de arriba abajo:

1. **Marca** (`.marca`, sin cambios: Avi de 112, «Avis», píldora de estado y el globo que toque).
2. **Fichas «Conversan»** (`#conversan`, sin cambios: `dividida-ux.md` 5.9). Se ven en cualquier módulo, porque son un evento en vivo.
3. **Menú de módulos** (`nav.mods#mods`, nuevo): Sesiones, Tareas, Hábitos.
4. **`.lado-cfg`**: solo Configuración (Tareas sube al menú).
5. **Equipo** (`.lado-pie`, sin cambios).

En la entrega M1 (14), los proyectos (`#proyectos`) siguen en la barra, colgados de Sesiones y visibles solo con Sesiones abierto. En M2 se mudan a la tira de la columna (4.4) y `#proyectos` sale de la barra.

### 3.4 Árbol del DOM (al terminar M2)

```text
aside.lado
├── .marca (sin cambios)
├── section#conversan (sin cambios)
├── nav.mods#mods[aria-label="Módulos"]
│   ├── span.ind-mod (aria-hidden: la píldora que viaja)
│   ├── button.mod#mod-sesiones[data-accion="mod"][data-mod="sesiones"]
│   ├── button.mod#tar-fila[data-accion="mod"][data-mod="tareas"]
│   └── button.mod#hab-fila[data-accion="mod"][data-mod="habitos"]   (con #41)
├── .lado-cfg > button.mod#cfg-fila[data-accion="mod"][data-mod="config"]
└── section.lado-pie (Equipo, sin cambios)
main.principal
├── header.cab (h1 #titulo, p #subtitulo; sin #cfg-volver ni #tar-volver)
├── div#aviso-p           (nuevo: la pregunta vista desde otro módulo, 4.5)
├── div#cfg · div#tar · div#hab   (las hojas; una por vez)
├── nav#proys             (nuevo en M2: la tira de proyectos, solo en Sesiones)
├── div#otro · div#aviso-tar · #pestanas · .split · .ficha-u · #w-globo · #pp · .conteos · .sesiones  (sin cambios)
```

### 3.5 Estado en la ventana

`st.modulo`: `'sesiones' | 'tareas' | 'habitos' | 'config'`. Es la **única fuente** de qué se ve. `st.config.abierta` y `st.tareas.abierta` dejan de escribirse a mano: se derivan (`st.config.abierta === (st.modulo === 'config')`). En M1 se conservan como campos que escribe `irModulo`, así el resto del código y sus tests no cambian (11.2). `#marco` lleva la clase `mod-<id>` además de `con-cfg` y `con-tar`, que se conservan.

## 4. Componentes

### 4.1 Fila de módulo (`button.mod`, molécula)

- **Medidas:** alto `--alto-modulo` (40, nuevo), relleno 0/8, radio `--r-fila`, separación 10, `var(--t-cuerpo-f)`, color `--crema2`. Ícono en una caja de 24 × 24 (radio `--r-icono`, fondo `--s2`, trazo 1,45 `currentColor`, 15 × 15). Nombre con `flex: 1`. Cuenta a la derecha (4.2).
- **Estados:** hover, fondo `--s2` y texto `--crema` (200 ms). Presión, `scale(.97)` (`--d-presion`). Foco, el contorno ámbar de siempre (2 px, separación 2). **Abierta:** `aria-current="page"`, texto `--ambar` y caja del ícono con `color-mix(in srgb, var(--ambar) 18%, transparent)` y ícono `--ambar`. En el grupo de arriba, el fondo lo pone la píldora (4.3), no la fila. Configuración (en `.lado-cfg`) lleva su propio fondo `--ambar-osc` porque la píldora no baja hasta ahí. Deshabilitada: no existe; un módulo siempre se puede abrir.
- **Íconos:** Sesiones, una pantalla con dos ojos (`<rect x=2 y=3 w=12 h=9 rx=2.6/>`, pie y dos puntos, el del boceto). Tareas, el de hoy. Hábitos, la flecha circular con punto (el del boceto de hábitos). Configuración, el engranaje de hoy.
- **Nombre accesible** (`aria-label`): «Sesiones, 3 abiertas, 1 te hace una pregunta» · «Tareas, 2 para hoy, 2 vencidas» (el `nombreFilaTareas` de hoy) · «Hábitos, 2 de 5 hechos hoy» · «Configuración». Lleva además `aria-keyshortcuts` (`Escape`, `Control+T`, `Control+H`, `Control+Comma`) y `title` «{Módulo} ({atajo})».

### 4.2 Cuenta de cada módulo

| Módulo | Sin nada que contar | Con algo | Con pregunta |
|---|---|---|---|
| Sesiones | `.chip` con el número de sesiones (0 se ve «0») | `.chip` «3» | `.chip` «3» + `.chip.chip-preg` «1 ?» (con dos: «2 ?»), separación 4 |
| Tareas | `kbd` «Ctrl T» | la de hoy (`chipFilaTareas`: ámbar o `.chip-venc` con punto) | — |
| Hábitos | `kbd` «Ctrl H» | el anillo «2/5» (`habitos-ux.md` 4.1) | — |
| Configuración | `kbd` «Ctrl ,» | el punto de pestaña de hoy (`puntoPestana`), si hay algo que mirar | — |

Las cuentas son `aria-hidden`: el texto va en el nombre de la fila (4.1). **Al llegar una pregunta,** el `chip-preg` de Sesiones late dos veces (`scale 1 → 1.28 → 1`, 500 ms `--rebote`, dos iteraciones). Después queda quieto: nada parpadea para siempre.

### 4.3 Píldora que viaja (`.ind-mod`)

`position: absolute` dentro de `nav.mods`, alto `--alto-modulo`, ancho completo, radio `--r-fila`, fondo `--ambar-osc`, `box-shadow: inset 3px 0 0 var(--ambar)` (la marca a la izquierda). Se ubica con `translateY` sobre la fila abierta (`offsetTop`). Con Configuración abierta, o con Sesiones y los proyectos desplegados debajo en M1, la píldora se apaga (`opacity: 0`) y la fila abierta pone su fondo. Movimiento en 10.

### 4.4 Tira de proyectos (`nav#proys`, M2)

Reemplaza a `barraProyectos` en la barra. Va solo en Sesiones, arriba de `#otro`.

- **Contenedor:** `nav[aria-label="Proyectos"]`, `display: flex`, separación 6, una sola fila con scroll horizontal sin barra (`scrollbar-width: none`) y máscara a la derecha (`linear-gradient(90deg, #000 88%, transparent)`). Margen inferior 10.
- **Chip `button.pch`** (con los mismos `data-accion="ir"` y `data-proy="{k}"` de hoy): alto 32, relleno 0/8/0/6, radio píldora, borde 1 `--linea`, `700 12px/1 var(--f)` `--crema2`. Lleva el ícono del proyecto (20 × 20 redondo, `colorProyecto`, iniciales mono), el nombre y la cuenta de hoy (`.chip` de sesiones o `.chip-preg` «1 ?»). `title` con el repositorio. Hover: borde `--linea-hover` y texto `--crema`.
- **Elegido:** `aria-current="true"`, fondo `--crema`, texto `--tinta`, borde `--crema`. Su `.chip` de sesiones pasa a `rgba(20,17,12,.12)` con texto `--tinta`; el `chip-preg` no cambia.
- **Al elegir:** el chip queda a la vista (`scrollIntoView({ inline: 'nearest' })`) y el foco se queda en él.
- **Nombre accesible:** el de hoy, más «, elegido».
- **Por qué una tira y no un índice lateral:** un índice de 136 dejaría 310 px a la tarjeta y el escenario (Claude de 96 y el elenco de 58) no entra. Lo midió el boceto.

### 4.5 La pregunta vista desde otro módulo (`#aviso-p`, `button.aviso-p`)

Evoluciona `avisoOtroProyecto` (Sesiones), `#tar-aviso` (Tareas) y `#cfg-aviso` (Configuración), que hoy son tres piezas distintas. Pasan a ser **una sola**, `avisoPregunta()` (11.3).

- **Cuándo:** hay una pregunta pendiente y el usuario está en otro módulo, o está en Sesiones pero en otro proyecto (este último caso ya existe hoy). En la dividida rige `dividida-ux.md` 5.3.
- **Forma:** botón a todo el ancho, alto mínimo 46, relleno 0/6, radio píldora, borde 1 `color-mix(in srgb, var(--ambar) 60%, transparent)`, fondo `linear-gradient(90deg, rgba(242,182,50,.14), var(--ambar-osc) 60%)`, sombra `0 10px 26px -16px rgba(242,182,50,.7)`, margen inferior 10. Adentro: la cara de quien pregunta (`quienPregunta`, Avi de 30 en pose de pregunta) en un círculo `--negro` de 34; el texto (`600 12px/1.3`, `--crema`) con una línea chica debajo (`--t-mono-s`, `--crema2`); y a la derecha la píldora «Responder →» (`--ambar`, texto `--negro`, `800 11.5px/1`, relleno 8/12).
- **Clic:** `irModulo('sesiones', { repo })` del proyecto de la pregunta, despliega la pregunta (`st.plegado = false`) y lleva el foco al globo de la pregunta (`#w-globo`, su primer control).
- **Accesibilidad:** el texto visible es el nombre. El anuncio, cuando llega una pregunta, ya existe (`#anuncio`): no se repite.

### 4.6 Los tres caminos de una pregunta (regla)

Estés donde estés, una pregunta pendiente se ve **a la vez** en: (1) el `chip-preg` de Sesiones, que late al llegar (4.2); (2) `#aviso-p` arriba de la columna (4.5); (3) el Avi de la marca en su pose de pregunta («!», ya existe). Acoplada y plegada, en la muesca (`data-modo="pregunta"`, ya existe). Minimizada, en el chip de la tira (ya existe). Ningún globo (tareas, recordatorio, resumen) se muestra mientras haya una pregunta pendiente (`habitos-ux.md` 8.1).

## 5. Contenido (textos exactos)

| Lugar | Texto |
|---|---|
| Filas | «Sesiones» · «Tareas» · «Hábitos» · «Configuración» |
| Pistas sin cuenta | «Esc» no se muestra (Sesiones siempre tiene cuenta) · «Ctrl T» · «Ctrl H» · «Ctrl ,» |
| Encabezado de Sesiones (M2) | `h1` «Sesiones» · bajada «{proyecto} · {lineaEncabezado}», por ejemplo «catalogo · 1 sesión · te hace una pregunta». Con la dividida, el encabezado de la conversación de siempre. Vacío, cargando y primeros pasos: los títulos de hoy («Buscando sesiones…», «No hay sesiones de Claude Code abiertas.», «Primeros pasos») |
| `#aviso-p` | «{quien} te hace una pregunta» · línea chica «{proyecto} · hace {tiempo}» · «Responder →». `{quien}` es «Claude» o el nombre del subagente (`quienPregunta`) |
| Anuncio (`role=status`) al cambiar de módulo | «{Módulo}» (solo el nombre; el `h1` recibe el foco) |
| `title` de cada fila | «Sesiones (Esc)» · «Tareas (Ctrl T)» · «Hábitos (Ctrl H)» · «Configuración (Ctrl ,)» |

En M1 el encabezado de Sesiones sigue como hoy (`h1` con el nombre del proyecto). Cambia en M2, junto con la tira.

## 6. Sistema visual

Sin fuentes ni colores nuevos: Manrope y Martian Mono, y los tokens de `estilos.css`. Tokens nuevos, solo de medida:

| Token | Valor | Uso |
|---|---|---|
| `--alto-modulo` | `40px` | alto de `.mod` y de la píldora |

Se reusan: `.chip`, `.chip-preg`, `.chip-venc`, `.pj-ic`, `colorProyecto`, `--ambar-osc`, `--ease`, `--rebote`, `--d-presion`, `--d-color`. CSS nuevo bajo `.mods`, `.mod`, `.pch`, `#proys` y `.aviso-p` (`.aviso` y `.cfg-aviso` ya existen: no se pisan).

### 6.1 Contraste (sobre los tokens)

| Par | Relación | Uso |
|---|---|---|
| `--crema2` / `--negro` | 10,3:1 | fila de módulo en reposo |
| `--ambar` / `--ambar-osc` | 9,8:1 | fila abierta |
| `--negro` / `--ambar` | 11,5:1 | `chip-preg`, «Responder →» |
| `--crema` / `--ambar-osc` | ≈ 15:1 | texto de `#aviso-p` |
| `--crema2` / `--ambar-osc` | ≈ 8,7:1 | línea chica de `#aviso-p` |
| `--tinta` / `--crema` | ≈ 16:1 | chip de proyecto elegido |

El color nunca va solo: la pregunta lleva «?» y su texto; la fila abierta lleva `aria-current` y la marca de 3 px.

## 7. Estados

| Estado | Qué se ve |
|---|---|
| Cargando (antes de la primera lectura) | El menú completo. Sesiones con `.chip` «…» (`aria-label` «buscando»), y la columna con «Buscando sesiones…» como hoy |
| Sin sesiones | Sesiones con «0». La columna con el vacío de hoy. Tareas, Hábitos y Configuración andan igual |
| Primeros pasos, forma escenario | **Como hoy:** el escenario esconde la barra entera (`#marco.escenario .lado`). Los atajos (Ctrl T, Ctrl H, Ctrl ,) siguen andando; Esc vuelve al escenario. No se cambia en esta entrega (15, D-m6) |
| Primeros pasos, forma hoja | La hoja de hoy en la columna de Sesiones |
| Dividida abierta | El riel reemplaza a la barra, menú incluido (como hoy). Abrir otro módulo con su atajo sale de la dividida (lo que hoy hacen Tareas y Configuración) |
| Error de lectura de sesiones | La línea de error de hoy, en Sesiones |
| Pregunta pendiente | 4.6 |
| Más módulos de los que entran (zoom 200 % en 1366) | La barra desplaza como hoy; `.lado-cfg` sigue pegada al pie (`position: sticky`) |

## 8. Formas del panel (qué muestran ahora)

| Forma | Cambio |
|---|---|
| **Muesca acoplada** | **Ninguno en el dibujo** (pregunta › trabajando › reposo › duerme). Abrirla abre el panel en el módulo actual. Si hay una pregunta pendiente, abre en Sesiones, en el proyecto de la pregunta. El globo que cuelga de la muesca sigue la cola de `habitos-ux.md` 8 |
| **Tira mini** (400 × 56) | Lo de hoy (caras, resumen de sesiones, `#tira-pend` con las preguntas) y, después de la insignia de preguntas, las cuentas chicas de Tareas (`.chip-venc` o `.chip-preg` sin texto extra) y Hábitos (el anillo de 14 con «2/5»). Si `#tira-resumen` queda por debajo de 120 px, se esconden primero las de Hábitos y después las de Tareas. **La insignia de preguntas nunca se esconde.** «Expandir» abre el módulo actual; con una pregunta, Sesiones en esa pregunta |
| **Bandeja** | Sin cambios (ícono con la cuenta de preguntas; Mostrar · Configuración… · Pausar · Salir). «Configuración…» pasa por `irModulo('config')` |
| **Hoja de la charla** (`#hoja`) | Sin cambios. Es hermana de `#marco`: no depende del módulo |
| **Flotante y acoplada abierta** | El marco de siempre, con el menú |

## 9. Teclado y foco

### 9.1 Esc, por capas (una por vez)

1. Las capas propias del módulo abierto (Tareas: `alEscTareas`; Configuración: `alEsc`; Hábitos: `alEscHabitos`), sin cambios, **menos la última** («cerrar la hoja»). Esa pasa a ser «ir a Sesiones».
2. Con un módulo sin capas: va a Sesiones y el foco va a `#mod-sesiones`.
3. En Sesiones: lo de hoy (la charla y la pregunta tienen sus propios Esc antes; acoplada, pliega el panel).

`alEscModulo(modulo, capaDelModulo)` (11.3) decide entre «la capa del módulo» y «ir a Sesiones».

### 9.2 Atajos

**Ctrl T**, **Ctrl H** y **Ctrl ,**, solo Ctrl, sin Alt, Shift ni Windows (`esAtajoTareas`, `esAtajoHabitos`, `esAtajoConfiguracion`), con el panel a la vista: abren su módulo; si ya está abierto, llevan el foco al `h1`. Mientras se escribe en un campo, también andan (no escriben nada). Sesiones no tiene atajo propio: Esc vuelve a Sesiones.

### 9.3 Orden de tabulación

Marca (botón de la charla) → fichas «Conversan» → Sesiones → Tareas → Hábitos → Configuración → Equipo → encabezado de la columna → `#aviso-p` → contenido del módulo (en Sesiones: la tira de proyectos, `#otro`, la pregunta, las tarjetas).

### 9.4 Dónde va el foco

- Clic en una fila o su atajo → el `h1` del módulo. Volver a Sesiones con Esc → `#mod-sesiones`.
- Clic en un proyecto de la tira → se queda en ese chip.
- Clic en `#aviso-p` → el primer control del globo de la pregunta.
- Al dibujar de nuevo (cada 1,5 s), el foco se queda donde estaba (el patrón de hoy con `data-proy` y `data-k`).

## 10. Movimiento

Módulo **`modulosMotion.js`** (anime.js v4 de `vendor/animejs`). Todo bajo `prefers-reduced-motion: no-preference` y `body:not(.pausa)`. Solo `transform` y `opacity`.

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Cambiar de módulo | La píldora viaja a la fila nueva (`translateY`). El encabezado y el contenido de la columna entran 10 px desde la derecha, escalonados 34 ms. Las hojas que ya tienen su acto (`movimientoTareas.abrirHoja`, `movimientoConfig`) lo usan en lugar de este | píldora 380 ms `outBack(1.3)`; contenido 320 ms `outQuart` |
| Volver a Sesiones | Píldora igual; las tarjetas con el acto de hoy (`movimientoConfig.cerrarHoja`) | 380 / 320 ms |
| Llega una pregunta | `#aviso-p` baja 12 px desde arriba, `scale .96 → 1`; el `chip-preg` late dos veces | 460 ms `outBack(1.5)`; 2 × 500 ms `--rebote` |
| Elegir un proyecto (M2) | Las tarjetas cambian con el fundido de hoy; el chip elegido pasa a crema (CSS, `--d-color`) | 200 ms |
| Hover y presión de fila | CSS | 200 ms / 140 ms |

**Movimiento reducido:** la píldora salta a su lugar; el contenido y `#aviso-p` aparecen con un fundido de opacidad de 160 ms; el `chip-preg` no late. **Pausa:** todo al instante, sin fundidos.

## 11. Contrato para el implementador

### 11.1 Lo que hoy depende de la barra de proyectos y del tablero, y cómo migra

| Hoy | Dónde | Migración |
|---|---|---|
| `barraProyectos(proyectos, i)` → `#proyectos` | `tablero.js:179`, `main.js:1053`, `3369`, `4033` | **M1:** sin cambios, pero `#proyectos` se ve solo con `st.modulo === 'sesiones'` (CSS `#marco:not(.mod-sesiones) .proyectos { display: none }`). **M2:** nueva `tiraProyectos(proyectos, i)` (misma firma, marcado de 4.4) en `#proys`. Se borra `nav.proyectos` de la barra y los tres `poner('#proyectos', …)` pasan a `#proys`. Los `data-accion="ir" data-proy` no cambian, así el manejador de `main.js:1936–1960` sigue igual |
| Elegir proyecto con Tareas o Configuración abiertas (`main.js:1949–1960`) | `cerrarConfig`/`cerrarTareasHoja` + `irAProyecto` | Pasa a `irModulo('sesiones', { repo: p.repo })`. Una rama en vez de dos |
| `avisoOtroProyecto` (`#otro`) | `pregunta.js:122` | Sigue en Sesiones (otro proyecto). En los demás módulos lo reemplaza `#aviso-p` (`avisoPregunta`, 11.3), que también reemplaza a `#tar-aviso` (`tareasVista.js:49`) y `#cfg-aviso` (`configuracionVista.js:53`). Esos dos `div` quedan vacíos en M1 y se borran en M2 |
| `#cfg-volver`, `#tar-volver` («‹ Tablero») | `index.html:75,78`, `estilos.css:1613,1890` | Se borran en M1, con sus reglas CSS. Sus `data-accion` (`cfg-cerrar`, `tar-cerrar`) quedan como alias de `irModulo('sesiones')` para los tests y la vista de desarrollo |
| `abrirConfig`, `cerrarConfig`, `abrirTareasHoja`, `cerrarTareasHoja` | `main.js` | Siguen existiendo y hacen lo de hoy (leer, actos de entrada, foco), pero las llama `irModulo` y solo `irModulo` cambia `st.modulo`. Cerrar una hoja equivale a `irModulo('sesiones')` |
| `#marco.con-cfg`, `.con-tar` | `estilos.css:1613–1625`, `1869+` | Se conservan (todo lo que esconden sigue igual). Se suma `.mod-<id>` |
| `.lado-cfg` con Tareas y Configuración | `index.html:41–52` | Tareas (`#tar-fila`) sube a `nav.mods` con el mismo id y la clase `.mod`. `pintarFilaTareas` sigue escribiendo su cuenta en `#tar-fila-ct` |
| Dividida (`#riel` en lugar de la barra; `cerrarConversacion` al abrir una hoja) | `main.js:4176`, `dividida-ux.md` | Sin cambios: el riel reemplaza a la barra **con** el menú. `irModulo(x ≠ 'sesiones')` hace lo que hoy hacen las hojas: `cerrarConversacion({ descartar: true })` |
| Fichas «Conversan» (`#conversan`) | `index.html:34` | Sin cambios, arriba del menú, en cualquier módulo. Su clic abre la dividida y, antes, `irModulo('sesiones')` |
| `lugarAviso(..., { barra })` del aviso de Tareas | `main.js:4262` | `barra: st.proyectos.length > 0 \|\| st.config.abierta` pasa a `barra: !#marco.escenario` (la barra se ve). Con el menú, la barra existe aunque no haya sesiones |
| Tira mini (`resumenMini`, `#tira-pend`) | `main.js:741` | Se suma `cuentasModulosMini(...)` después de la insignia de preguntas (8). «Expandir» llama a `irModulo(moduloAlExpandir(st))` |
| Muesca (`estadoMuesca`, `alternar`) | `muesca.js`, `main.js:780` | Dibujo sin cambios. Al abrir el panel desde la muesca con una pregunta pendiente: `irModulo('sesiones', { repo })` |
| Primeros pasos (`formaAsistente`, `#pp`, escenario) | `main.js:993–1033` | Sin cambios, dentro de Sesiones. «Instalación › Abrir →» de Configuración llama a `irModulo('sesiones')` y después abre la hoja de pasos, como hoy |
| Bandeja «Configuración…» (`oficina://configuracion`) | `main.js` | `irModulo('config')` |
| Globo diario de Tareas (`tar-globo`) | `main.js` | `irModulo('tareas', { ver: 'hoy' })` |
| Hoja de la charla (`#hoja`) y la marca «mudada» | `index.html:123` | Sin cambios |
| `#titulo` y `#subtitulo` con el nombre del proyecto | `main.js:1066–1068` | **M2:** `#titulo` = «Sesiones», `title` = el repositorio; `#subtitulo` = «{proyecto} · {lineaEncabezado}». Los tests que miran el `h1` del tablero cambian en M2, no antes |

### 11.2 Estado

```js
st.modulo = 'sesiones'                      // nuevo
// derivados que escribe solo irModulo (M1): st.config.abierta, st.tareas.abierta (y st.habitos.abierta con #41)
```

### 11.3 Lógica pura (`widget/src/modulos.js`) y casos de prueba (`widget/test/modulos.test.js`)

| Función | Qué hace | Casos |
|---|---|---|
| `MODULOS` | `[{ id:'sesiones', nombre:'Sesiones', atajo:'Escape' }, { id:'tareas', …, atajo:'Control+T' }, { id:'habitos', …, atajo:'Control+H' }, { id:'config', …, atajo:'Control+Comma', pie:true }]` | el orden; Configuración con `pie` |
| `irModulo(estado, id, { repo })` | `{ modulo, cerrar: [ids], repo }`: qué hojas cerrar, qué abrir y a qué proyecto ir | de Tareas a Configuración cierra Tareas; a Sesiones con `repo` lo devuelve; un id desconocido no cambia nada; el mismo módulo devuelve `{ foco: 'h1' }` |
| `alEscModulo(modulo, accionDelModulo)` | `'capa' \| 'sesiones' \| 'nada'` | Tareas con una capa → `capa`; Tareas sin capas → `sesiones`; Sesiones → `nada` (sigue el Esc de siempre) |
| `cuentaModulo(id, datos)` | el HTML de 4.2 | Sesiones con 0, con 3 y con «1 ?»; Tareas sin nada → kbd; Hábitos sin hábitos → kbd |
| `nombreModulo(id, datos)` | los nombres de 4.1 | singular y plural; sin la parte que vale 0 |
| `avisoPregunta(proyectos, modulo, repoActual, mascota)` | `null` o `{ proy, quien, proyecto, hace }` | en Sesiones y el mismo proyecto → null; en Sesiones y otro proyecto → el de ese; en Tareas y el mismo proyecto → el de ese; sin preguntas → null |
| `tiraProyectos(proyectos, i)` (M2) | el HTML de 4.4 | elegido con `aria-current`; chip con «1 ?»; nombres escapados |
| `moduloAlExpandir({ modulo, preguntas })` | `{ modulo, repo }` | con pregunta → Sesiones y su repo; sin pregunta → el actual |
| `cuentasModulosMini(tareas, habitos, anchoLibre)` | qué cuentas entran en la tira | 200 px → las dos; 130 → solo Tareas; 110 → ninguna; la de preguntas no se toca |
| `esAtajoHabitos(e)` | como `esAtajoTareas` con `h` | Ctrl H sí; Ctrl Shift H, Alt, Meta no |

Pruebas de regresión que **tienen que seguir pasando sin cambios en M1:** las de `tareas.test.js`, `configuracion.test.js` y `dividida*.test.js`, y la apertura y el cierre de cada hoja por sus caminos de hoy (fila, atajo, bandeja, globo).

### 11.4 Archivos (sugeridos)

`widget/src/modulos.js` (puro), `widget/src/modulosVista.js` (filas, tira, aviso), `widget/src/modulosMotion.js`, `widget/test/modulos.test.js`. Cambios en `index.html` (3.4), `main.js` (11.1), `estilos.css` (`.mods`, `.mod`, `.ind-mod`, `.pch`, `#proys`, `.aviso-p`; se borran las de `#cfg-volver` y `#tar-volver`), `tablero.js` (`tiraProyectos`) y `dev/vista.html` (`?modulo=tareas|config|habitos`, `?pregunta=otro-modulo`).

### 11.5 Medir antes de construir

- **Ctrl H en WebView2:** que llegue al `keydown` y no lo tome el navegador (historial). Ctrl T ya anda (#39). Si no llega, vuelve a diseño con la alternativa (15, D-m5).

## 12. Accesibilidad

- `nav#mods[aria-label="Módulos"]` y `nav#proys[aria-label="Proyectos"]`. Cada fila es un `button` con `aria-current="page"` si está abierta.
- Un solo `h1` (el `#titulo` de siempre). Los módulos no agregan otro.
- Áreas de clic: filas de 40 de alto y todo el ancho; chips de la tira de 32 de alto (como `.fc` y los controles de Tareas; es un widget de escritorio con mouse); `#aviso-p` de 46.
- Foco visible: el contorno ámbar de siempre. En `.pch` elegido (fondo crema), el contorno es `--tinta`.
- Color nunca solo: 6.1.
- Cada cambio de módulo anuncia su nombre (5) y lleva el foco al `h1`.

## 13. Responsive y zoom

Es una ventana de escritorio: el marco no se reacomoda por ancho. Con zoom de 100 a 200 % todo escala junto (`tamano.js`). La barra desplaza si no entra (la `.lado-cfg` sigue pegada al pie). La tira de proyectos desplaza en horizontal; nunca dos filas.

## 14. Entregas

| Entrega | Qué | Riesgo | Aceptación |
|---|---|---|---|
| **M1 · Menú** | `st.modulo` e `irModulo`; `nav.mods` con Sesiones y Tareas (Configuración abajo); la píldora; `#aviso-p` en Tareas y Configuración; Esc → Sesiones; se van los «‹ Tablero». **Los proyectos siguen en la barra**, debajo de Sesiones, visibles solo en Sesiones | Risk: item 3 (los caminos que hoy abren y cierran Configuración y Tareas los comparte todo `main.js`; un camino que no pase por `irModulo` deja dos hojas o ninguna) | Cada camino de 11.1 abre lo que debe; una pregunta se ve por los tres caminos de 4.6 desde Tareas y Configuración; Esc por capas; la dividida, la muesca y la tira como hoy; Playwright a 375, 768 y 1440 de `dev/vista.html` sin diferencias en Sesiones |
| **M2 · Sesiones** | La tira de proyectos en la columna (`tiraProyectos`); se borra `#proyectos` de la barra; `h1` «Sesiones»; las cuentas de la tira mini; `#tar-aviso` y `#cfg-aviso` se borran | Risk: item 6 (el `h1` y el lugar de los proyectos cambian a la vista; los tests de hoy miran el `h1` del tablero) | Elegir un proyecto desde la tira, desde `#aviso-p` y desde el riel de la dividida; el escenario de las tarjetas no se achica; la insignia de preguntas de la tira nunca se esconde |

Hábitos (#41) suma su fila y su hoja sobre M1 (`habitos-ux.md` 14).

## 15. Decisiones

| Id | Decisión | Descartada | Quién |
|---|---|---|---|
| D-m1 | Opción A · Menú | B · Árbol, C · Riel | Quintana, 24/11 |
| D-m2 | Proyectos en una tira arriba de las sesiones | índice lateral (escenario de 310 px) | Quintana, 24/11 (aprobó el boceto) |
| D-m3 | Esc vuelve a Sesiones; se van los «‹ Tablero» | conservar «‹ Tablero» | Quintana, 24/11 |
| D-m4 | Una pregunta se ve por tres caminos; ningún globo con una pregunta pendiente | solo el chip | Quintana, 24/11 |
| D-m5 | Atajos: Esc (Sesiones), Ctrl T, Ctrl H, Ctrl , | Ctrl 1–4 | Quintana, 24/11. Si Ctrl H no llega en WebView2, la alternativa propuesta es **Ctrl Shift H**, a confirmar con Quintana |
| D-m6 | El escenario de primeros pasos sigue escondiendo la barra | mostrar el menú en el escenario | Delfina (mínimo riesgo; revisable) |
| D-m7 | Las fichas «Conversan» quedan en la barra, arriba del menú, en cualquier módulo | moverlas a Sesiones | Delfina (es un evento en vivo; no se mueve lo que anda) |
| D-m8 | Al arrancar abre Sesiones; el último módulo no se guarda | recordar el último módulo | Delfina |
| D-m9 | Dos entregas: M1 con los proyectos todavía en la barra, M2 con la tira | una sola entrega | Delfina (entregas chicas que no rompen) |
| D-m10 | Equipo queda al pie de la barra | moverlo a Sesiones | Quintana, 24/11 (aprobó el boceto) |

## 16. Correcciones y contradicciones con el código

- `tareas-ux.md` 8.3 nombra al globo de la marca `.globo`; el código lo llama **`.globo-tar`** (`estilos.css:2153`), porque `.globo` ya es el globo de voz del SVG del Avi. Esta dirección y `habitos-ux.md` usan los nombres del código.
- Hoy cada hoja tiene su propia línea de pregunta (`#tar-aviso`, `#cfg-aviso`) con el texto «Claude te hace una pregunta · Ver →»; la de Sesiones (`avisoOtroProyecto`) dice «**Claude** te pregunta algo en **catalogo** · Ver →». Las tres pasan a ser `#aviso-p` (4.5) con el texto de 5.
- Con el aviso diario de Tareas en la marca, hoy una pregunta pendiente **no** lo esconde (`lugarAviso` solo lo esconde en la muesca). Con D-m4 lo esconde también en la marca y en la dividida. Es un cambio de comportamiento a propósito: va con su test.
