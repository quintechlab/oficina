# Avis · Listas de tareas — dirección

> Issue #39, rama `feat/39-tareas`. Boceto: `docs/diseno/bocetos/tareas.html` (servirlo con http desde la raíz del repo: importa `avis.js` y anime.js reales). Tres opciones: A · Libreta, **B · Carpeta** y C · Día. **Quintana eligió B · Carpeta el 24/11** y aprobó las decisiones del boceto (sección 15). Esta dirección cubre solo B; de C no se toma nada (el escenario de la mascota **no** va arriba de Hoy).
> Evoluciona `configuracion-ux.md` (la hoja en la columna principal, la fila de la barra, Esc por capas, confirmar en el mismo botón, `.seg`, `.lnk`, `.campo`), `estilo-avis-ux.md` (tokens, barra, columna), `muesca-avi-ux.md` (la muesca acoplada) y `dividida-ux.md` (el riel). Lo que no se nombra acá sigue como está allí.

---

## 1. Brief

- **Pedido (24/11):** «que pueda tener listas de tareas en avis». Plan aprobado: tareas solo locales, sin sincronizar. Manejarlas desde el chat va en otra entrega.
- **Requisitos (#39):** S1 hoja propia abierta desde la barra lateral, en la columna principal · S2 varias listas: crear, renombrar, borrar (borrar confirma en el mismo botón) · S3 cada tarea: título, fecha límite opcional, prioridad importante/normal, notas, subtareas; se tilda · S4 vistas Hoy y Vencidas además de cada lista · S5 primer arranque del día con tareas de hoy o vencidas: la mascota avisa con un globo, el clic abre la hoja, nada se abre solo · S6 se guardan en `<config>/tareas/`, JSON atómico como el historial del chat; un archivo roto no se borra.
- **Para quién:** un dev freelance (Quintana) que tiene Avis abierto todo el día. Entra muchas veces y por poco tiempo: mirar qué vence, tildar, anotar algo al pasar.
- **Acción principal:** tildar lo de hoy. La segunda: anotar una tarea sin salir de lo que estaba haciendo (campo arriba, Enter).
- **Vara:** `webs portfolio/brasa-noble`. Movimiento con sentido, accesible, 60 fps en un equipo medio con zoom de 200 %.

## 2. Concepto

**La carpeta del día.** Un índice angosto, a la izquierda de la hoja, con Hoy, Vencidas y tus listas, cada una con su cuenta; a la derecha, lo que elegiste. Tres palabras: **a mano, al día, satisfactorio**. Lo que se recuerda: **el tilde**. El círculo se hunde y rebota en ámbar, el visto se dibuja, una raya tacha el título, saltan chispas del color de la lista, la mascota festeja junto al título y la fila se pliega hacia «Hechas». Y una vez por día, la mascota te saluda con un globo crema que te dice qué te espera.

Principios: todo se guarda al instante (no hay «Guardar»); lo que borra confirma en el mismo botón; nada se abre solo; Hoy es el punto de entrada y el lugar por defecto.

## 3. Arquitectura

### 3.1 Entrar y salir

| Desde | Cómo | Notas |
|---|---|---|
| Barra lateral | Fila **«Tareas»** (`#tar-fila`, `.pj.tar`) dentro de `.lado-cfg`, **arriba** de «Configuración» | Mismo molde que `.pj.engr`. Abierta: `aria-current="page"` y colores de `.pj.activo`. Otro clic con la hoja abierta lleva el foco al `h1`; no la cierra. |
| Teclado | **Ctrl T** con el panel a la vista | `aria-keyshortcuts="Control+T"` en la fila. Sin cuenta, la pista «Ctrl T» a la derecha (`--t-mono-s`, `--tenue`); con cuenta, el chip ocupa ese lugar. |
| Globo diario | Clic en el globo de la marca, la muesca o la fila de aviso (8) | Abre la hoja en **Hoy**. |
| Bandeja | No cambia (sin ítem nuevo) | — |

**Abrir** cierra la configuración si estaba abierta, y viceversa: la columna muestra una hoja por vez. En la pantalla dividida, abrir Tareas sale de la dividida (como Configuración, 4.2 de su dirección). La primera vez en la ejecución abre en Hoy; después, en la última vista usada (no se guarda entre ejecuciones).

**Salir:** «‹ Tablero» (`#tar-volver`, `.volver`, `title` «Volver al tablero (Esc)») o Esc por capas (9.1). El foco vuelve a `#tar-fila`. Elegir un proyecto en la barra también cierra la hoja.

**Una pregunta pendiente no se esconde:** con la hoja abierta, arriba del índice aparece la línea de aviso de siempre (`avisoOtroProyecto`): «Claude te hace una pregunta · Ver →». Igual que en Configuración (4.1).

### 3.2 Dónde se dibuja

Una **hoja de la columna principal**, `#tar`, hermana de `#cfg`. Con la hoja abierta, `#marco.con-tar` esconde lo mismo que `.con-cfg` (avisos de sesión, pregunta, chips, sesiones, `#w-globo`, `#pp`). El encabezado de la columna queda: `h1` «Tareas», la bajada y los controles. La barra lateral no cambia, salvo la fila «Tareas».

### 3.3 Árbol del DOM

```
main.principal
├── header.cab
│   ├── .cab-t > span.tar-mini (Avi de 40, aria-hidden) · h1#tar-h1[tabindex=-1] "Tareas" · p#tar-sub
│   └── .controles > button.volver#tar-volver "‹ Tablero" · pin · mini · cerrar
├── #tar-aviso (línea de pregunta pendiente; vacío casi siempre)
├── div.carpeta
│   ├── nav.idx[aria-label="Vistas y listas"]
│   │   ├── button.ix-b[data-ver=hoy] · button.ix-b[data-ver=vencidas]
│   │   ├── span.rot-i[aria-hidden] "Listas"
│   │   ├── button.ix-b[data-ver=<id>] × n   (o el .campo de renombrar en su lugar)
│   │   ├── button.ix-b.rota × k             (archivos que no se pudieron leer, 7.6)
│   │   └── button.ix-b.ix-mas "Nueva lista" (o el .campo de crear)
│   └── section.pane[aria-labelledby=tar-pane-h]
│       ├── vista:  header.pane-h > h2#tar-pane-h · div.pane-s
│       │           .err (si corresponde, 7.6) · label.campo.nueva · div.desplaza > ul.filas · button.pleg · ul.filas.hechas-l
│       └── tarea:  button.lnk.atras "‹ {vista}" · div.desplaza > h2.oculto#tar-pane-h "{título}" · div.det
└── p.oculto[role=status]   (anuncios de 5.3)
```

El índice desplaza solo (sin barra visible) si no entra; el panel desplaza en `.desplaza`. El encabezado y el `pane-h` quedan fijos.

### 3.4 Vistas

| Vista | Qué muestra | Orden | Pie |
|---|---|---|---|
| **Hoy** | tareas sin tildar con `fecha` = hoy (día de Argentina, 11.2), de todas las listas, con el nombre de su lista | importantes primero; después por `creada` | «Hechas · n»: las de hoy tildadas |
| **Vencidas** | tareas sin tildar con `fecha` < hoy, de todas las listas | **la más vieja primero**; a igual fecha, importantes primero | sin pie: una vencida tildada deja de ser vencida |
| **Una lista** | sus tareas sin tildar | importantes primero; después por fecha (sin fecha al final); después por `creada` | «Hechas · n»: las tildadas de la lista, la más reciente primero |

«Hechas» empieza plegado en cada vista y se pliega de nuevo al cambiar de vista. Las tareas tildadas no se borran solas.

### 3.5 Estado en la ventana

`st.tareas = { abierta, ver, det, armado, renombrando, creando, hechas, feliz, listas, rotas, cargando, errorGuardar, aviso }`. `ver` es `'hoy' | 'vencidas' | <id de lista>`; `det` es el id de la tarea abierta o `null`; `aviso = { pendiente, lugar }` (8). Los borradores de texto (nueva tarea, nueva subtarea, nombre de lista) **no** viven en `st`: viven en su `<input>`, como el campo de la clave. El título y las notas sí van a `st` en cada `input`, porque se guardan al vuelo (11.3).

La hoja sobrevive al redibujo de 1,5 s: `pintarTareas` redibuja por partes (`data-parte`: `idx`, `pane-h`, `lista`, `det`), devuelve el foco a la misma pieza (`data-k`) y nunca reescribe un campo mientras se escribe en él (el patrón de `ponerParteConCampo`).

## 4. Componentes

### 4.1 Fila de la barra (`.pj.tar`)

Ícono: un cuadro de 11 × 11 con radio 3,2 y un visto adentro (trazo 1,5, `currentColor`), en el cuadro de 22 de `.pj-ic` (fondo `--s2`). Hover: el visto se redibuja (`stroke-dashoffset` 9 → 0, .6 s `--ease`). Cuenta = tareas de hoy + vencidas, sin tildar:

| Caso | A la derecha |
|---|---|
| sin nada | pista «Ctrl T» |
| solo de hoy | `.chip.chip-preg` (ámbar, texto `--negro`) con el número |
| con alguna vencida | `.chip.chip-venc` (nuevo): fondo `color-mix(in srgb, var(--rojo) 22%, var(--s2))`, texto `--rojo` 600, un punto de 5 `--rojo` delante del número |

El chip es `aria-hidden`; el nombre accesible lleva el texto: «Tareas, 2 para hoy, 2 vencidas». Al cambiar la cuenta, el chip late (`scale 1 → 1.25 → 1`, 500 ms `--rebote`).

### 4.2 Índice (`.idx`)

Ancho `--ancho-indice` (136), filete derecho `--linea`, relleno derecho 10. Cada `.ix-b`: 34 de alto, radio `--r-fila`, `700 12px/1.1 var(--f)` `--crema2`, cuadro de 20 a la izquierda (radio 6, fondo `color-mix(--c 15%)`): Hoy con el ícono de calendario (`--c` = `--ambar`), Vencidas con el reloj y el «!» (`--c` = `--rojo`), cada lista con un punto de 7 de su color. El nombre se corta con `…` y lleva `title` con el nombre entero. Cuenta a la derecha, `500 10px/1 var(--m)`: Hoy en `--ambar`, Vencidas en `--rojo`, listas en `--tenue` (las pendientes de cada una); en 0, sin cuenta. Hover `--s2` y `--crema`; presión .97; elegida: `aria-current="page"`, fondo `--ambar-osc`, texto `--ambar`. «Nueva lista»: cuadro con borde punteado `--linea-hover` y un «+», texto `--tenue`. El rótulo «Listas» va en `--t-rotulo`, mayúsculas, .12em, `--tenue`, con 12 arriba y 4 abajo.

### 4.3 Encabezado del panel (`.pane-h`)

`h2` `800 19px/1.15 var(--f)`, −.03em; en una lista, un punto de 8 de su color delante. Debajo, `.pane-s` de 32 de alto, `--t-mono-s` `--tenue`:

- **Hoy:** «martes 24/11 · {h} de {n}» y una barra de avance de 90 × 4 (`.prog`: fondo `--s3`, relleno `--ambar`, `role=progressbar` con `aria-valuenow`/`aria-valuemax`; el ancho anima .5 s `--ease`).
- **Vencidas:** «la más vieja primero».
- **Lista:** «{p} pendientes · {h} hechas» y a la derecha «Renombrar» (`.lnk`) y «Borrar lista» (`.lnk.peligro` → `.armado`, 4.8).

### 4.4 Campo de nueva tarea (`.campo.nueva`)

El `.campo` de estilos.css (38 de alto, `--s1`, borde `--linea`, foco `--ambar` con anillo de 3 px al 14 %), con un «+» de 14 en `--tenue` (`--ambar` con foco) y la pista «Enter» en un `kbd` que aparece solo con foco. Enter agrega; vacío o solo espacios no hace nada. En Vencidas no hay campo: va la pista de 5.1.

### 4.5 Fila de tarea (`li.fila`)

Grilla `36px / 1fr / auto`, radio `--r-fila`, filete superior `--linea` de 38 px a la derecha hasta 8 del borde (se esconde junto a la fila con hover y la primera).

- **Tilde (`.ck`, `role=checkbox`):** área de 36 × 38; círculo de 18 con borde de 1,5 en `--linea-hover`; importante: el borde en `color-mix(--ambar 75%)`. Hover: borde `--c` de la lista y fondo `color-mix(--c 14%)`. Tildada: fondo y borde `--ambar`, visto `--negro` de trazo 2,4. Nombre: «Hecha: {título}».
- **Cuerpo (`.f-cuerpo`, botón):** título `--t-cuerpo-f` `--crema`; debajo, `.meta` en `--t-mono-s` al 75 % de ancho: la fecha (4.6), en Hoy y Vencidas el nombre de la lista con su punto de 5, las subtareas «1/3» con una barrita de 20 × 3, y tres líneas de 12 si tiene notas. Nombre accesible: el título, «, importante» si va, la fecha larga, «, 1 de 3 subtareas hechas», «, con notas». Abre la tarea (4.7).
- **Importante:** insignia de 20 × 20, radio 6, fondo `--ambar-osc`, «!» `600 11px var(--m)` `--ambar`, `aria-hidden` (el texto va en el nombre del cuerpo).
- **Hover** de la fila: fondo `--s1`. **Tildada:** título tachado (raya de 1,5 en `--crema2` al 58 % del alto) y en `--tenue`; la insignia al 40 %.
- **Recién agregada:** destello `color-mix(--ambar 14%)` que se apaga en 1,2 s.

### 4.6 Rótulo de fecha

| `fecha` contra hoy | Corto (`.tag`) | Largo (accesible y detalle) | Color |
|---|---|---|---|
| ayer | «ayer» | «Venció ayer» | `--rojo` con un punto de 5 delante |
| antes | «venció 20/11» | «Venció el 20/11» | `--rojo` con un punto de 5 delante |
| hoy | «hoy» | «Vence hoy» | `--ambar` |
| mañana | «mañana» | «Vence mañana» | `--tenue` |
| después | «jue 26» | «Vence el jue 26/11» | `--tenue` |
| sin fecha | — | — | — |

Días de la semana: «dom lun mar mié jue vie sáb». Una tarea tildada no muestra fecha en la fila.

### 4.7 Tarea abierta (`.det`)

Entra en el lugar de la lista (3.3). Arriba, «‹ {vista}» (`.lnk`, por ejemplo «‹ Hoy»). Después:

1. **Título:** tilde de 36 (`.ck`, nombre «Hecha») + `textarea.tit-in` de una línea que crece (`field-sizing: content`, sin redimensionar), `800 16px/1.25 var(--f)`; hover `--s2`; foco: fondo `--s2` y anillo interior de 1,5 `--ambar` (sin el contorno de 2). Enter no hace salto de línea: confirma. Si queda vacío al salir, vuelve al título anterior. Tildada: `--tenue` y tachado.
2. **Datos** (`.det-g`, grilla `70px / 1fr`, filetes arriba y abajo):
   - «Vence»: `.seg.ch` (opciones de 28, `700 11px`) **Hoy · Mañana · Sin fecha** + `input type=date` (`.fecha-in`: 30 de alto, `--t-mono-s`, `color-scheme: dark`, `aria-label` «Elegir otra fecha») + el rótulo largo de 4.6 en su color.
   - «Prioridad»: `.seg.prio` **Normal · ! Importante**; Importante elegida: fondo `--ambar`, texto `--negro`.
   - «Lista»: `select.sel` con las listas (mover cambia el archivo, 11.3).
3. **Subtareas** (`h3.sub` «Subtareas · {h} de {n}»): cada una con un tilde cuadrado de 15 (radio 5) en un área de 32 × 30 y su texto `--t-cuerpo`; tildada, tachada en `--tenue`. Debajo, `.campo.chico` (32 de alto, sangría 32) «Agregar una subtarea», Enter agrega. Para borrar una subtarea: vaciar su texto (D-n2 en 15).
4. **Notas** (`h3.sub` «Notas»): `textarea.notas`, 3 líneas, se redimensiona en vertical, placeholder «Algo para acordarte…».
5. **Pie:** «Creada el {d/m}» (`.cifras`) y «Borrar tarea» (`.lnk.peligro` → «¿Borrar? Sí»).

Las subtareas se editan haciendo clic en su texto, que pasa a ser un campo; con eso alcanza para esta entrega.

### 4.8 Confirmar en el mismo botón

El `.armado` de siempre (`--d-confirma` 3 s, la línea de 2 px que se vacía, `aria-live=polite`). Textos: «Borrar lista» → **«¿Borrar con {n} tareas? Sí»** («¿Borrar con 1 tarea? Sí»; vacía: «¿Borrar? Sí»). «Borrar tarea» → «¿Borrar? Sí». Borrar una lista borra su archivo y todas sus tareas (decidido 24/11). Esc o 3 s sin clic lo desarman; un clic en otra cosa también.

### 4.9 Plegado «Hechas» (`.pleg`)

Botón a todo el ancho, 32 de alto, `--t-rotulo` mayúsculas `--tenue`, flecha de 10 que gira 90° abierta, filete a la derecha. `aria-expanded`. Texto «Hechas · {n}».

### 4.10 Mascota junto al título (`.tar-mini`)

Avi de 40 de la mascota elegida (forma chica), en pose `esperando`. Al tildar una tarea o una subtarea pasa a `feliz` durante 1,5 s y da un salto (8). Es decorativa.

## 5. Contenido (textos exactos)

### 5.1 Hoja

| Lugar | Texto |
|---|---|
| Fila de la barra | «Tareas» · pista «Ctrl T» · nombre «Tareas, {h} para hoy, {v} vencidas» (sin la parte que vale 0) |
| Encabezado | `h1` «Tareas» · bajada «{día} {d}/{m} · {h} para hoy · {v} vencidas» (sin la parte en 0; sin ninguna: «{día} {d}/{m} · nada urgente»; sin listas: «Se guardan en esta PC») · «‹ Tablero» |
| Índice | «Hoy» · «Vencidas» · rótulo «Listas» · «Nueva lista» |
| Campo nueva tarea | Hoy: «Agregar para hoy en {primera lista}…» · lista: «Agregar a {lista}…» · pista «Enter» |
| Vencidas, en lugar del campo | «Las vencidas salen de sus listas: tildalas o cambiales la fecha.» |
| Campo de lista | placeholder «Nombre de la lista» · pista «Enter» · error «Ya hay una lista «{nombre}».» |
| Tarea abierta | «‹ {vista}» · rótulos «Vence», «Prioridad», «Lista», «Subtareas · {h} de {n}», «Notas» · «Hoy», «Mañana», «Sin fecha» · «Normal», «! Importante» · «Agregar una subtarea» · «Algo para acordarte…» · «Creada el {d/m}» · «Borrar tarea» |

### 5.2 Vacíos y errores

| Estado | Texto |
|---|---|
| Primer uso (sin listas) | Avi de 96 en pose `saluda` · «Armá tu primera lista» · «Las tareas quedan en esta PC. Cuando tengas algo para hoy, te aviso al prender.» · botones «+ Trabajo», «+ Casa», «+ Compras» · campo «Otro nombre…» |
| Hoy sin pendientes | Avi de 66 `feliz` · «Listo por hoy.» · «No queda nada con fecha de hoy.» + « Mañana: {n} tareas.» si hay |
| Vencidas vacía | Avi de 66 `feliz` · «Nada vencido.» · «Estás al día.» |
| Lista vacía | Avi de 66 `esperando` · «{lista}» está vacía. · «Escribí arriba y Enter para sumar la primera.» |
| Archivo roto (S6) | «Una lista no se pudo leer.» · «El archivo quedó como estaba ({archivo}). Las demás listas andan.» · «Abrir la carpeta» · «Volver a leer» |
| Error al guardar | «No se guardó el último cambio.» · «Sigue en pantalla. Reintento solo en 5 s.» · «Reintentar ahora» |
| Carpeta ilegible (no se pudo listar) | «No se pudo abrir la carpeta de tareas.» · «{detalle corto}» · «Volver a leer» |

### 5.3 Anuncios (`role=status`)

«Hecha: {título}» · «{título}» vuelve a pendientes · «Agregada a {lista}» / «Agregada a {lista}, para hoy» · «Lista «{nombre}» creada» · «Ahora se llama «{nombre}»» · «Borraste «{lista}» y sus {n} tareas» (vacía: «Borraste «{lista}»») · «Borraste «{título}»» · «Movida a {lista}» · «Te lo recuerdo mañana» · «No se guardó el último cambio».

### 5.4 Globo diario (8)

Saludo según la hora de Argentina: antes de las 13, «¡Buen día!»; de 13 a 19:59, «¡Buenas tardes!»; después, «¡Buenas noches!».

| Caso | Globo de la marca | Muesca | Fila de aviso |
|---|---|---|---|
| hoy y vencidas | «{saludo} Tenés **{h} tareas para hoy** y **{v} vencidas**.» | «{h} para hoy · {v} vencidas» | «{saludo} {h} para hoy y {v} vencidas.» |
| solo hoy | «{saludo} Tenés **{h} tareas para hoy**.» | «{h} para hoy» | «{saludo} {h} para hoy.» |
| solo vencidas | «{saludo} Tenés **{v} vencidas**.» | «{v} vencidas» | «{saludo} {v} vencidas.» |

Singulares: «1 tarea», «1 vencida». Llamado: «Ver tareas →» (globo), «Ver →» (muesca y fila). Cerrar: × con `aria-label` «Más tarde: avisame mañana» y `title` «Más tarde». Anuncio al aparecer: «{nombre de la mascota}: {texto del globo}».

## 6. Sistema visual

Sin fuentes nuevas: Manrope y Martian Mono. Los tokens de `estilos.css` sin cambios. Tokens nuevos:

| Token | Valor | Uso |
|---|---|---|
| `--ancho-indice` | `136px` | ancho del índice |
| `--d-tilde` | `700ms` | espera entre el tilde y el pliegue de la fila |
| `--rojo-tinta` | `#B3321F` | número de vencidas sobre el globo crema |
| `--ambar-tinta` | `#7A5A0E` | «Ver tareas →» sobre el globo crema |

Se reusan: `.pj`, `.chip`, `.chip-preg`, `.lnk`, `.seg`, `.campo`, `.armado` y `@keyframes drena`, `.btn`, `.volver`, `.tb`, `--d-confirma`, `--ease`, `--rebote`. Pieza nueva de CSS: `.chip-venc` (4.1). Todo el CSS nuevo va bajo `#tar` (o `.pj.tar`), porque `.sub`, `.ind`, `.chip` y `.err` ya existen en otros lugares.

### 6.1 Colores de lista

Cada lista guarda el **nombre** de un token, nunca un color: `celeste`, `verde`, `rosa`, `violeta`, `ambar`, `rojo` (en ese orden, rotando, para la siguiente lista nueva). El color de lista solo pinta el punto, el borde del tilde al pasar y las chispas; nunca lleva texto.

### 6.2 Contraste (medido sobre los tokens)

| Par | Relación | Uso |
|---|---|---|
| `--crema` / `--negro` y `--s1` | 17,7 / 16,5:1 | títulos de tarea |
| `--crema2` / `--negro` | 10,3:1 | índice, rótulos fuertes |
| `--tenue` / `--negro`, `--s1` | 5,65 / 5,26:1 | meta, cuentas, pistas |
| `--ambar` / `--negro` y `--ambar-osc` | 11,5 / 9,8:1 | «hoy», índice elegido, insignia «!» |
| `--rojo` / `--negro` | 8,25:1 | vencida, «Borrar» |
| `--rojo` / fondo de `.chip-venc` | ≈ 5,0:1 | cuenta con vencidas |
| `--negro` / `--ambar` | 11,5:1 | `.chip-preg`, Importante elegida, visto |
| `--tinta` / `--crema` | ≈ 16:1 | texto del globo |
| `--rojo-tinta` / `--crema` | 5,2:1 | vencidas en el globo |
| `--ambar-tinta` / `--crema` | 5,3:1 | «Ver tareas →» |

Color nunca solo: vencida lleva el punto y la palabra; importante lleva el «!» y el texto oculto; tildada lleva el visto y el tachado.

## 7. Estados de la pantalla

### 7.1 Cargando
La hoja abre con el encabezado y el índice (Hoy, Vencidas sin cuenta) al instante. Si leer los archivos tarda más de 150 ms, el panel muestra tres filas fantasma de 38 (fondo `--s1`, sin animación de brillo). Nunca un spinner a pantalla completa.

### 7.2 Primer uso (sin listas)
En lugar de `.carpeta`: tarjeta `.primer` (borde punteado `--linea-hover`, radio `--r-tarjeta`, luz ámbar al 16 % debajo del Avi) con los textos de 5.2. Una sugerida crea esa lista y la abre con el foco en «Agregar a {lista}…».

### 7.3 Vacíos
Los de 5.2, centrados en el panel (`.vac`: relleno 26/16/18, título `--t-titulo`, línea `--t-chico` `--crema2` de 32ch).

### 7.4 Error al guardar
Arriba del campo de nueva tarea, `.err` (borde `rgba(255,122,107,.35)`, fondo `color-mix(--rojo 6%, --s1)`, radio `--r-cuadro`, punto `t-error` y texto de 5.2). Lo que está en pantalla no se deshace; reintenta solo a los 5 s y con «Reintentar ahora». Se va al primer guardado bueno. Se anota en `widget.log` («tareas: no se guardó {id}: {error}»).

### 7.5 Borrado armado
4.8.

### 7.6 Archivo roto (S6)
Un archivo que no se puede leer o no es v1 se saltea (nunca se borra ni se reescribe) y se anota. En el índice, debajo de las listas, una fila `.ix-b.rota` con el punto `--rojo` y el nombre del archivo (`--t-mono-s`, cortado). Su clic muestra en el panel el `.err` con «Abrir la carpeta» (abre `<config>/tareas/` en el Explorador) y «Volver a leer». No cuenta para Hoy ni para Vencidas.

## 8. Globo diario (S5)

### 8.1 Cuándo
Al arrancar Avis, si es el **primer arranque del día de Argentina** (el día guardado en `preferencias.json` → `tareas.avisado` es distinto de hoy) y hay al menos una tarea de hoy o vencida sin tildar, el aviso queda **pendiente**. Se guarda `tareas.avisado = hoy` en el momento en que el aviso se ve por primera vez; si Avis se reinicia el mismo día, no vuelve. El aviso pendiente se va con el clic en el globo (abre la hoja en Hoy), con la × («Te lo recuerdo mañana»), o si la hoja de Tareas se abre por cualquier otro camino. No se va solo con el tiempo. **Nada se abre solo.**

### 8.2 Dónde
Un solo aviso, dibujado donde esté la mascota a la vista:

| Forma del panel | Lugar |
|---|---|
| Abierto, con la barra lateral | **Globo de la marca**, debajo de la píldora de estado (8.3). El Avi de la marca pasa a pose `saluda` mientras el globo se ve. |
| Abierto en la pantalla dividida (riel en lugar de la barra) | **Fila de aviso** arriba de la columna (8.4). |
| Acoplado y plegado (muesca) | **Globo de la muesca** (8.5). |
| Tira o escondido en la bandeja | Espera pendiente; aparece en la forma siguiente que se vea. |
| La hoja de chat está abierta (la mascota «mudada») | Espera; aparece al cerrar la charla. |

### 8.3 Globo de la marca
`div.globo` dentro de `.marca`, ancho de la barra (172), 12 debajo de la píldora; fondo `--crema`, texto `--tinta` `600 12px/1.35`, números en 800; radio 14; cola de 12 (cuadrado girado 45°) arriba al centro, hacia el Avi; sombra `0 14px 30px -14px rgba(242,182,50,.5)` y halo `0 0 0 4px rgba(242,182,50,.07)`. Adentro, dos botones: `.globo-b` (todo el texto y «Ver tareas →» en `600 10px/1 var(--m)` `--ambar-tinta`; subrayado al pasar) y `.globo-x` de 30 de ancho (× de 12, `#5c554a`, `--tinta` al pasar). Foco: contorno `--tinta`. **No** es parte del botón «Charlar con Avi»: es un hermano. Empuja los proyectos hacia abajo mientras está.

### 8.4 Fila de aviso (dividida)
La forma de `avisoOtroProyecto`: píldora de 40 de alto, borde `color-mix(--ambar 55%)`, fondo `--ambar-osc`, texto `600 12px/1.3`, las vencidas en `--rojo`; a la derecha «Ver →» (`.lnk` en `--ambar`) y × (`.tb`). Va arriba de las sesiones. El boceto la muestra en su modo «angosto», que en el widget no existe: es solo para verlo en el teléfono.

### 8.5 Globo de la muesca
Un botón **hermano** de `#muesca` (`#muesca-tareas`), no un hijo: `#muesca` ya es un botón. Píldora crema (`--crema`, `--tinta` `700 11.5px/1`, relleno 8/12, radio 12, cola de 10 hacia la muesca), con «Ver →» en `600 10px var(--m)` `--ambar-tinta`. Cuelga 8 px del lado de adentro de la pantalla: debajo con la muesca arriba, arriba con la muesca abajo, a la derecha o a la izquierda con la muesca a un costado. Su clic despliega el panel y abre la hoja en Hoy. **`zonaInteractiva` tiene que sumar su rectángulo mientras está** (si no, el clic pasa a la app de abajo). Una pregunta pendiente tiene prioridad: mientras la muesca está en `data-modo="pregunta"`, el globo de tareas se esconde y vuelve después.

## 9. Teclado y foco

### 9.1 Esc, por capas (una por vez)
1. Un campo de texto de una línea con algo escrito y sin guardar (nueva tarea, nueva subtarea): lo vacía.
2. Renombrar o crear una lista: cancela (el texto se descarta) y el foco vuelve a la fila de esa lista o a «Nueva lista».
3. Un «¿Borrar…? Sí» armado: lo desarma, con el foco en el mismo botón.
4. Una tarea abierta: la cierra y el foco va al cuerpo de su fila.
5. La hoja: la cierra y el foco va a `#tar-fila`.
6. Acoplada, el Esc siguiente pliega el panel (lo de siempre).

Con el globo de la marca a la vista y la hoja cerrada, Esc con el foco en el globo es la ×. Lógica pura: `alEscTareas(estado, foco)` (11.5), como `alEsc` de configuracion.js.

### 9.2 Atajos
**Ctrl T** (solo Ctrl, sin Alt, Shift ni Windows; `esAtajoTareas`, como `esAtajoConfiguracion`): abre la hoja; si ya está abierta, lleva el foco al `h1`. Mientras se escribe en un campo de la hoja, Ctrl T también funciona (no escribe nada). **Sin verificar:** que WebView2 no se quede con Ctrl T; si se lo queda, vuelve a diseño.

### 9.3 Orden de tabulación
Controles del encabezado → índice (Hoy, Vencidas, listas, filas rotas, Nueva lista) → panel: Renombrar, Borrar lista → campo nueva tarea → por cada fila: tilde, cuerpo → «Hechas». En la tarea abierta: «‹ vista», tilde, título, Hoy/Mañana/Sin fecha (un solo tope: foco itinerante con flechas), fecha, Normal/Importante (ídem), Lista, cada subtarea, campo de subtarea, notas, Borrar tarea.

### 9.4 Dónde va el foco
- Abrir la hoja → `h1`. Cerrarla → `#tar-fila`.
- Cambiar de vista → se queda en el botón del índice.
- Abrir una tarea → su título. Cerrarla → el cuerpo de su fila.
- Tildar en la lista → el tilde de la fila siguiente; si no hay, la anterior; si no, el campo de nueva tarea.
- Agregar → queda en el campo de nueva tarea (vacío).
- Crear lista → «Agregar a {lista}…» de la lista nueva. Renombrar (Enter) → la fila de esa lista.
- Borrar una tarea → el campo de nueva tarea. Borrar una lista → «Hoy» en el índice.
- Clic en el globo → `h1` de la hoja en Hoy. × → `#tar-fila`.

## 10. Movimiento

anime.js v4 (`vendor/animejs`), módulo **`tareasMotion.js`**; CSS para el tilde, el tachado, el hover y la confirmación. Todo bajo `prefers-reduced-motion: no-preference` y `body:not(.pausa)`. Solo `transform` y `opacity`, salvo el pliegue de la fila (alto de una sola fila) y el ancho de la barra de avance.

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Abrir la hoja | encabezado y `.carpeta` suben 8 px y aparecen, escalonados 55 ms; los botones del índice y las filas, 10 px, escalonados 30 ms desde 140 | 420 / 460 ms, `outQuart` |
| Cambiar de vista | `pane-h`, campo y filas entran 8 px desde la derecha, escalonados 26 ms | 280 ms, `outQuart` |
| Abrir una tarea | los hijos del panel entran 18 px desde la derecha, escalonados 40 ms | 320 ms, `outQuart` |
| Cerrar una tarea | la lista vuelve con el acto de «cambiar de vista» | 280 ms |
| **Tildar** | (CSS) el círculo baja a .72 y rebota a 1 mientras se llena de ámbar; el visto se dibuja (`stroke-dashoffset` 14 → 0) desde 80 ms; la raya tacha de izquierda a derecha y el título pasa a `--tenue` desde 120 ms. (anime) seis chispas salen del centro del tilde a 16 y 22 px, alternando el color de la lista y `--ambar`, `scale 1.2 → .3` y se apagan; la mascota de 40 pasa a `feliz` y salta 6 px. A los `--d-tilde` (700 ms) la fila baja su alto a 0 y se apaga, y la vista se redibuja; el chip de la barra late | círculo 420 ms `--rebote`; visto 260 ms `--ease`; raya 340 ms `--ease`; chispas 560 ms `outQuart`; salto 420 ms `outQuad`; pliegue 300 ms `inOutQuad`; chip 500 ms `--rebote` |
| Destildar | vuelve a pendientes al instante, sin pliegue | — |
| Tildar una subtarea | el cuadro rebota como el círculo; la mascota festeja; sin chispas ni pliegue | 420 ms |
| Agregar | la fila nueva baja 6 px y aparece; destello ámbar de 1,2 s (CSS) | 360 ms `outBack(1.4)` |
| Abrir «Hechas» | sus filas bajan 4 px hasta opacidad .85, escalonadas 30 ms | 260 ms |
| Globo (marca y muesca) | `translateY(-8px) scale(.82)` → en su lugar, con rebote desde la cola; la marca pasa a `saluda` | 560 ms `--rebote` |
| Cerrar el globo | `scale .9` y se apaga | 200 ms `inQuad` |
| Confirmar | la línea del botón se vacía | 3 s lineal (CSS) |
| Ícono de la fila | el visto se redibuja al pasar | 600 ms `--ease` |

**Movimiento reducido:** sin desplazamientos, escalas ni chispas; la hoja, el cambio de vista y la tarea abierta aparecen con un fundido de opacidad de 160 ms; el tilde y el tachado son instantáneos; la fila tildada espera 350 ms y pasa a «Hechas» sin pliegue animado; el globo aparece con un fundido de 160 ms. **Pausa:** como reducido, pero sin fundidos (todo al instante); la espera de 350 ms queda, para que se vea el visto.

## 11. Contrato para el implementador

### 11.1 Archivos en disco (S6)
Carpeta `<config>/tareas/` (la misma base que `<config>/chat/`). **Un archivo por lista**: `<id>.json`. Escritura atómica con un temporal propio y `rename`, de a una por vez en el proceso: **reusar el mecanismo de `historial.rs`** (extraerlo a una función común), no reescribirlo. Un archivo roto, de otra versión o con un `id` que no coincide con su nombre se saltea, se anota en `widget.log` y se informa en `rotas`; nunca se borra ni se pisa (guardar en una lista nueva nunca usa el nombre de un archivo roto).

Formato v1:

```json
{
  "v": 1,
  "id": "l-k3f9a2",
  "nombre": "Trabajo",
  "color": "celeste",
  "orden": 0,
  "creada": 1764000000000,
  "tareas": [
    {
      "id": "t-9x2b7q",
      "titulo": "Revisar el PR #36 del modelo del chat",
      "hecha": false,
      "hechaEn": null,
      "fecha": "2026-11-24",
      "importante": true,
      "notas": "Ojo con el relanzar…",
      "subtareas": [ { "id": "s-1", "titulo": "Probar con Haiku y con Sonnet", "hecha": true } ],
      "creada": 1763800000000
    }
  ]
}
```

- `id` de lista y de tarea: `^[a-z0-9-]{1,40}$`, generados en la ventana y **validados en Rust antes de armar la ruta** (nunca `..`, barras ni nombres de Windows reservados).
- `fecha`: día de calendario `"AAAA-MM-DD"` o `null`, **sin hora**. Hoy se calcula siempre en hora de Argentina (11.2), nunca con la zona de la PC.
- `color` ∈ `celeste | verde | rosa | violeta | ambar | rojo`; otro valor se lee como `celeste`.
- `hechaEn`: ms o `null`; ordena «Hechas».
- Topes: `nombre` 1–40 caracteres; `titulo` 1–200; `notas` hasta 4 000; hasta 50 subtareas de 1–200. Rust recorta y avisa; la ventana no deja pasarlos.
- Campos desconocidos se conservan al reescribir (la ventana manda el documento entero; Rust parte de lo leído, como `escribir` de preferencias.rs, D9).

### 11.2 Día de Argentina
Argentina es UTC−3 todo el año. `configuracion.js` ya tiene `diaArgentina` y `DESFASE_AR` sin exportar: **moverlos a un lugar común y exportarlos** (no duplicarlos). Nuevo, puro: `hoyArgentina(ahoraMs) → "AAAA-MM-DD"` y `diasEntre(fecha, hoy) → entero` (negativo = vencida). Hoy y Vencidas se recalculan al abrir la hoja, al guardar y cuando cambia el día (el ciclo de 1,5 s compara `hoyArgentina`; a las 0:00 de Argentina, Hoy pasa a ser el día nuevo sin recargar).

### 11.3 Comandos de Rust (`tareas.rs`)

| Comando | Entrada | Salida | Notas |
|---|---|---|---|
| `tareas_leer()` | — | `{ listas: Lista[], rotas: [{ archivo, motivo }] }` | `listas` por `orden`; solo lectura |
| `tareas_guardar(lista)` | el documento v1 entero de **una** lista | `{ ok: true }` o `{ ok: false, error }` | valida `id`, topes y forma; atómico |
| `tareas_borrar_lista(id)` | id | `{ ok }` | borra solo `<id>.json` válido; nunca un archivo de `rotas` |
| `tareas_abrir_carpeta()` | — | — | abre `<config>/tareas/` en el Explorador |

Mover una tarea de lista guarda las **dos** listas: primero la de destino, después la de origen (si la segunda falla, la tarea queda duplicada, nunca perdida; el error de 7.4 lo muestra). Título y notas se guardan 600 ms después de dejar de escribir y al salir del campo; todo lo demás, en el clic.

### 11.4 Aviso diario
`preferencias.json` → `"tareas": { "avisado": "AAAA-MM-DD" }` (escrito con `guardar_ajuste`; `escribir` conserva las claves que no conoce). La decisión es pura en la ventana: `debeAvisar({ avisado, hoy, cuentas }) → bool` (primer arranque del día y `cuentas.hoy + cuentas.vencidas > 0`). Se evalúa una vez, después del primer `tareas_leer` del arranque.

### 11.5 Lógica pura (`widget/src/tareas.js`) y casos de prueba (`widget/test/tareas.test.js`)

1. `hoyArgentina(ms)`: 23:30 de Argentina del 24/11 (02:30 UTC del 25) da `"2026-11-24"`; 00:10 de Argentina del 25 da `"2026-11-25"`.
2. `etiquetaFecha(fecha, hoy)`: un caso por fila de 4.6, `null` sin fecha.
3. `vista(listas, ver, hoy)`: Hoy junta todas las listas y deja afuera las tildadas (que van a `hechas`); Vencidas solo sin tildar y con `fecha < hoy`, la más vieja primero; una lista ordena importantes, fecha, `creada`; `hechas` por `hechaEn` descendente.
4. `cuentas(listas, hoy) → { hoy, vencidas }`: sin tildar; una tarea de ayer tildada no cuenta.
5. `debeAvisar`: mismo día → no; día nuevo con 0 → no; día nuevo con 1 de hoy o 1 vencida → sí.
6. `textoGlobo(cuentas, horaAr)`: los tres casos de 5.4, los singulares y los tres saludos (12:59, 13:00, 20:00).
7. `validarNombreLista(nombre, listas, propioId)`: vacío y solo espacios → rechazado; 41 caracteres → rechazado; «casa» con «Casa» existente → `duplicada` (sin distinguir mayúsculas ni tildes); renombrar con su propio nombre → válido.
8. `validarTitulo`: vacío → mantiene el anterior; 201 → recorta a 200.
9. `alEscTareas(estado, foco)`: un caso por capa de 9.1, en orden.
10. `esAtajoTareas(e)`: Ctrl T sí; Ctrl Shift T, Alt Ctrl T, T solo, Ctrl Y → no.
11. `colorSiguiente(listas)`: rota por los seis.
12. Confirmar: armar, a los 3 s se desarma; un segundo clic antes ejecuta una vez; Esc desarma (temporizador falso; reusar el de configuración si es el mismo código).
13. Rust `tareas.rs`: escribe atómico; un archivo roto se informa en `rotas` y queda igual (mismo hash); `id` con `..`, `/` o `CON` se rechaza; borrar no toca un archivo de `rotas`; un campo desconocido sobrevive a guardar.

### 11.6 Archivos (sugeridos)

| Archivo | Qué |
|---|---|
| `widget/src/tareas.js` (nuevo, puro) | 11.2 y 11.5 |
| `widget/src/tareasVista.js` (nuevo) | HTML de la hoja por partes, la fila y el detalle |
| `widget/src/tareasMotion.js` (nuevo) | 10 |
| `widget/src/main.js`, `index.html`, `estilos.css` | `#tar-fila`, `#tar`, `st.tareas`, Esc, Ctrl T, el globo de la marca y la fila de aviso, `.chip-venc`, tokens de 6 |
| `widget/src/muesca.js` y su zona | `#muesca-tareas`, su lugar por borde y su rectángulo en `zonaInteractiva` |
| `widget/src-tauri/src/tareas.rs` (nuevo) | 11.1 y 11.3 |
| `widget/src-tauri/src/historial.rs` | extraer la escritura atómica común |
| `widget/dev/vista.html` | `?tareas=hoy\|vencidas\|lista\|tarea\|primer\|vacia\|roto\|guardarfalla` y `&globo=marca\|muesca\|dividida` |

### 11.7 Cuando el chat maneje tareas (otra entrega)
Ya queda previsto: los `id` son estables y la hoja se redibuja por partes, así una tarea que llega del chat entra con el destello de «recién agregada» sin pisar lo que se está escribiendo. Para entonces Rust emitirá `oficina://tareas` (`{ lista }`) y la ventana releerá esa lista. No se diseña acá.

## 12. Accesibilidad

- Un solo `h1` («Tareas»); `h2` el título del panel (la vista, o el título de la tarea oculto); `h3` «Subtareas» y «Notas». Sin saltos.
- Índice: `nav` con `aria-label`, botones con `aria-current="page"`; cuentas `aria-hidden` con su texto en `span.oculto` («, 2 pendientes»).
- Tilde: `role=checkbox` + `aria-checked` + nombre con el título. Segmentos: `radiogroup` con foco itinerante. Plegado: `aria-expanded`.
- Áreas de clic: 32 de alto como mínimo (la convención del widget, de puntero); el tilde, 36 × 38.
- Foco visible: 2 px `--ambar` desplazado 2 (sobre crema, `--tinta`; sobre ámbar, `--crema`); el título editable usa su anillo interior (4.7).
- `role=status` con los textos de 5.3; los errores de 7.4 y 7.6 también se anuncian.
- Color nunca solo (6.2).
- Movimiento reducido y pausa: 10.

## 13. Responsive y zoom

El panel no cambia por ancho (188 + 460 de estilo-avis 9.2). Al 100 %, el índice entra con hasta 9 listas sin desplazar; el panel desplaza adentro. Con zoom de 125 a 200 %, todo escala; el índice y el panel desplazan cada uno por su lado; el encabezado y `pane-h` quedan fijos. Revisar al 100, 150 y 200 %, flotando y acoplado en los cuatro bordes (el globo de la muesca en cada borde). El boceto se revisó a 375, 768 y 1440; a 375 esconde la barra y escala la columna, solo para mirarlo en el teléfono.

## 14. Entregas

1. **La hoja, listas y tareas.** `#tar-fila` con su cuenta, Ctrl T, la hoja con índice, Hoy, Vencidas y cada lista, campo de nueva tarea, tildar con su acto, «Hechas», crear, renombrar y borrar listas, primer uso, vacíos, `tareas.rs` con `tareas_leer`/`tareas_guardar`/`tareas_borrar_lista`, archivo roto y error al guardar. **Riesgo:** ítem 1 (formato persistido nuevo) y la ruta armada con un `id` de la ventana. **Acepta:** tests 1–4, 7, 9–13; Playwright con `dev/vista.html?tareas=…` al 100 y 200 %; un JSON roto puesto a mano en la carpeta sigue igual (hash) después de usar la hoja.
2. **La tarea abierta.** 4.7 completo: título, Vence, Prioridad, Lista (mover entre archivos), subtareas, notas, borrar. **Acepta:** test 8; mover una tarea deja una sola copia; título y notas sobreviven a cerrar Avis a los 600 ms de escribir.
3. **El aviso diario.** Globo de la marca, fila de la dividida, globo de la muesca con su zona, `tareas.avisado`. **Acepta:** tests 5 y 6; el globo sale una vez por día; con la muesca, el clic en el globo abre el panel (no pasa a la app de abajo) en los cuatro bordes; una pregunta pendiente lo tapa y vuelve.

**No improvisar:** el orden y el contenido de las vistas (3.4); que todo se guarde al instante; la confirmación en el mismo botón (nunca un diálogo); que nada se abra solo; los textos de 5; que un archivo roto nunca se toque; el día de Argentina. Cualquier otra pieza (recordatorios con hora, repetir tareas, arrastrar para ordenar, etiquetas) vuelve a diseño.

## 15. Decisiones

**Del boceto, aprobadas por Quintana el 24/11:** opción B · Carpeta; la fila «Tareas» arriba de Configuración en `.lado-cfg`; la cuenta suma hoy y vencidas (ámbar, o rojo con punto); Ctrl T; el globo debajo del Avi, con la × que lo deja para mañana; el mismo aviso en la muesca y como fila sin barra; importante = anillo ámbar + «!»; «Hechas · n» plegado; en Hoy se agrega a la primera lista con fecha de hoy y Vencidas no tiene campo; borrar una lista borra sus tareas («¿Borrar con 6 tareas? Sí»); fecha con Hoy/Mañana/Sin fecha + el selector nativo; las tintas `#B3321F` y `#7A5A0E` sobre el crema; colores de lista de la paleta, rotando. El escenario de C **no** va arriba de Hoy.

**Tomadas en esta dirección (para revisar):**
- D-n1: el saludo del globo cambia con la hora (día, tarde, noche), porque el primer arranque puede ser a la tarde — rechazado: siempre «¡Buen día!».
- D-n2: una subtarea se borra vaciando su texto — rechazado: un botón × por subtarea.
- D-n3: Vencidas se ordena de la más vieja a la más nueva y no tiene «Hechas» — rechazado: el orden de las listas.
- D-n4: no se permiten dos listas con el mismo nombre (sin distinguir mayúsculas ni tildes) — rechazado: permitirlas.
- D-n5: renombrar se hace en la fila del índice, como en el boceto — rechazado: en el título del panel.
- D-n6: un archivo por lista y `tareas.avisado` en `preferencias.json` — rechazado: un solo archivo con todo (un archivo roto se llevaría todas las listas).
- D-n7: en la pantalla dividida el aviso es la fila de aviso (el «angosto» del boceto no existe en el widget) — rechazado: no avisar en la dividida.
- D-n8: las tareas tildadas se guardan para siempre en «Hechas» — rechazado: borrarlas solas a los N días.
- D-n9: topes de 11.1 (40, 200, 4 000, 50) — rechazado: sin topes.

## 16. Correcciones y contradicciones con el código

- El boceto dibuja un modo «angosto» (sin barra lateral) que el widget **no tiene**; su equivalente real es el riel de la dividida (8.2, D-n7).
- El `.chip` real mide `500 11px/1` con relleno 5/8 (el boceto usó 10 px): usar el `.chip` y el `.chip-preg` de estilos.css tal cual; solo `.chip-venc` es nuevo.
- La muesca es un único `<button>` con su contenido decorativo: el globo de tareas no puede ir adentro (botón dentro de botón) y, afuera de la caja de 150 × 54, el clic pasa a la app de abajo salvo que `zonaInteractiva` lo sume (8.5).
- `diaArgentina` está en configuracion.js sin exportar: compartirlo (11.2).
- `.pj.engr` lleva `margin-bottom: var(--e-4)` dentro de `.lado-cfg`: la fila «Tareas» va antes y con el mismo margen.
- `docs/diseno/bocetos/index.html` no es un índice de bocetos (es un boceto viejo), así que el de tareas no se sumó ahí.
- Sin verificar: que WebView2 deje pasar Ctrl T (9.2).
