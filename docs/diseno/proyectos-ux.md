# Avis · Proyectos — dirección

> Issue #44. Boceto: `docs/diseno/bocetos/proyectos.html` (servirlo con http desde la raíz del repo: importa `avis.js` y anime.js reales). Tres opciones: A · Estante, **B · Carpeta** y C · Portada. **Quintana eligió B · Carpeta el 25/11** y aprobó las decisiones del boceto (sección 15). Esta dirección cubre solo B; de A y C no se toma nada.
> Se apoya en `modulos-ux.md` (el menú de módulos, `irModulo`, Esc por capas, `#aviso-p`), `tareas-ux.md` (el índice de 136, el panel, confirmar en el mismo botón, archivos atómicos con `rotas`), `chat-avis-ux.md` (la hoja `#hoja`, la cabecera, el cajón «Charlas», el historial 9.1) y `estilo-avis-ux.md` (tokens). Lo que no se nombra acá sigue como está allí.

---

## 1. Brief

- **Pedido (24/11):** crear «Proyectos» dentro de Avis para tratar ciertos temas.
- **Requisitos (#44):** S1 un módulo «Proyectos» en la barra (menú de módulos, #42), con su hoja · S2 cada proyecto: nombre, instrucciones propias, una carpeta y sus charlas · S3 la carpeta puede ser una que ya existe en la PC (se elige) o una que crea Avis donde se sueltan los archivos · S4 Claude Code lee la carpeta cuando hace falta (como hoy con la carpeta de la charla); los archivos no se mandan en cada mensaje. Con el modelo local van solo las instrucciones · S5 desde el proyecto se abre su charla, que lleva sus instrucciones.
- **Para quién:** Quintana, que usa la charla de Avis para temas que vuelven (presupuestos, lecturas, una mudanza) y hoy tiene que repetir el contexto en cada charla nueva.
- **Acción principal:** abrir una charla nueva en un proyecto. La segunda: retomar una charla del proyecto.
- **Vara:** `webs portfolio/brasa-noble`. Movimiento con sentido, accesible, 60 fps en un equipo medio con zoom de 200 %.

## 2. Concepto

**El cajón de un tema.** El mismo esqueleto que Tareas: un índice angosto con tus proyectos y, al lado, el elegido, que se lee de arriba abajo en el orden en que se usa: el botón para charlar, sus charlas, sus instrucciones y su carpeta. Tres palabras: **ordenado, propio, a mano**. Lo que se recuerda: **la luz del proyecto**. Cada proyecto tiene un color de la paleta; la píldora del índice lo toma al elegirlo y, al abrir su charla, la luz del escenario de la hoja cambia a ese color. Así se ve en qué proyecto estás sin leer nada.

Principios: la carpeta es de quien la eligió (Avis nunca mueve, renombra ni borra archivos); lo que viaja a cada motor se dice en la pantalla, no en un manual; borrar confirma en el mismo botón; nada se abre solo.

## 3. Arquitectura

### 3.1 Entrar y salir

- **Entrar:** la fila «Proyectos» del menú de módulos (`#pro-fila`, cuarta fila, después de Hábitos), su atajo (9.2) o el chip del proyecto en la cabecera de una charla del proyecto (8.2). Todo pasa por `irModulo('proyectos', { proyecto })` (`modulos.js`).
- **Al abrir:** el último proyecto elegido en esta ejecución; la primera vez, el primero del índice. Sin proyectos, el primer uso (7.2). El proyecto elegido **no** se guarda entre ejecuciones (como el módulo, D-m8).
- **Salir:** Esc por capas (9.1); la última capa lleva a Sesiones. Abrir una charla del proyecto **no** cierra el módulo: la hoja `#hoja` se abre al lado, como hoy.

### 3.2 Dónde se dibuja

En la columna principal (`.principal`), como Tareas: `div#pro` con el índice (`.idx`, 136) y el panel (`.pane`). Encabezado de la columna: `h1` «Proyectos» y el subtítulo de 5.1. `#aviso-p` arriba de la hoja cuando hay una pregunta (modulos-ux 4.5).

### 3.3 Árbol del DOM

```text
nav.mods#mods
├── … button.mod#hab-fila
└── button.mod#pro-fila[data-accion="mod"][data-mod="proyectos"]      (nuevo)
main.principal
├── header.cab (h1 #titulo «Proyectos», p #subtitulo)
├── div#aviso-p
└── div#pro.carp                                                       (nuevo; una hoja por vez)
    ├── nav.idx[aria-label="Proyectos"]
    │   ├── span.ind-ix (aria-hidden: la píldora que viaja, con el color del proyecto)
    │   ├── span.rot «Proyectos»
    │   ├── button.ix-b[data-accion="pro-ver"][data-id="p-…"] × n      (aria-current="page" el elegido)
    │   └── button.ix-b.mas[data-accion="pro-nuevo"] «+ Nuevo»
    └── section.pane#pro-pane[aria-labelledby="pro-h2"]
        ├── (proyecto) .ficha: .f-cab (h2#pro-h2) · button.cta · .chs · .bloque instrucciones · .bloque carpeta · .matriz · .borrar-z
        ├── (crear / editar) form.form#pro-form
        └── (vacío) .vacio
```

### 3.4 Vistas del panel

| Vista | Cuándo | Contenido |
|---|---|---|
| **Proyecto** | un proyecto elegido | 4.4 a 4.9, en ese orden |
| **Nuevo** | «+ Nuevo» o «Crear mi primer proyecto» | el formulario (4.10) con «Crear proyecto» |
| **Editar** | el lápiz del encabezado del proyecto, o «Editar» de Instrucciones | el mismo formulario con los datos y «Guardar cambios» |
| **Primer uso** | ningún proyecto | 7.2, sin índice (el índice vacío no se dibuja; el panel ocupa todo) |

### 3.5 Estado en la ventana

`st.modulo === 'proyectos'` (modulos-ux 3.5). Nuevo `st.proyectos`: `{ lista: Proyecto[], rotas, elegido: id|null, vista: 'proyecto'|'nuevo'|'editar', form: {…}|null, armado: id|null, cargando: bool, error: texto|null }`. `lista` sale de `proyectos_leer` (11.3) al abrir el módulo, al volver a la ventana (`focus`) y después de cada comando; nunca en el ciclo de 1,5 s (lee carpetas del disco). Las charlas de cada proyecto salen de la lista del historial que ya tiene la charla (`listaCharlas`, con el campo `proyecto` de 11.5).

## 4. Componentes

### 4.1 Fila del menú (`#pro-fila`, molécula `button.mod`)

La de modulos-ux 4.1: ícono de carpeta de 15 (el `IC.proyectos` del boceto), «Proyectos», la cuenta y `title` «Proyectos (Ctrl P)» (o «Proyectos» si el atajo no pasa la medición de 11.8). **Cuenta:** `.chip` con el número de proyectos; 0 → la pista del atajo (`kbd`); si algún proyecto tiene la carpeta perdida, a la derecha del chip un `.pt` rojo de 6 (`--c: var(--rojo)`). Nombre accesible: «Proyectos, 3» · «Proyectos, 3, 1 con la carpeta perdida» · «Proyectos».

### 4.2 Índice (`nav.idx`, organismo)

El de Tareas (tareas-ux 4.2), 136 de ancho, borde derecho `--linea`. Filas `button.ix-b` de 36 de alto, radio `--r-fila`, `700 12px/1.15`, `--crema2` (`--crema` al pasar y elegido): un `.pt` de 6 con el color del proyecto, el nombre (una línea, con «…») y a la derecha el número de charlas (`500 10px/1 var(--m)` `--tenue`) o, con la carpeta perdida, un punto rojo de 7 con halo (`role="img"`, `aria-label="carpeta perdida"`). La píldora `.ind-ix` (fondo `--s2`, `inset 3px 0 0` del color del proyecto) viaja a la fila elegida. Última fila: «+ Nuevo» en `--ambar`, con un cuadrado punteado de 22. Hasta 12 proyectos entran sin desplazar al 100 %; con más, el índice desplaza por su lado.

### 4.3 Encabezado del proyecto (`.f-cab`)

Ícono de 34 (radio 11, fondo `color-mix(color 18%)`, inicial en `600 13px/1 var(--m)` del color), `h2#pro-h2` `800 18px/1.15` (`letter-spacing: -.03em`, una línea con «…»), debajo la línea de 5.1 en `--t-mono-s` `--tenue` («carpeta perdida» en `--rojo` 600). A la derecha, el lápiz (`.tb` de 32, «Editar {nombre}»).

### 4.4 Botón de charla (`button.cta`, átomo)

Ancho completo, 48 de alto, radio 14, fondo `--ambar`, texto `--negro` `800 13px/1`, sombra `0 14px 30px -18px rgba(242,182,50,.8)`. A la izquierda, un círculo negro de 34 con el Avi de 30 (pose `saluda`, de la mascota elegida). Texto: «Nueva charla» (con charlas) o «Empezar la primera charla» (sin charlas). **Sin** la pista «Ctrl N» del boceto (11.8). Hover: `brightness(1.06)`; presión: `scale(.98)`.

### 4.5 Charlas (`.chs`)

Rótulo «Charlas» (`.rot`). Filas `button.chf` de 44 como mínimo: título (`--t-cuerpo-f`, una línea) arriba, «{n} mensajes» abajo en mono `--tenue`, la fecha relativa a la derecha (`tiempoRelativo`/`grupoDeFecha` del cajón). Las 5 más recientes; con más, una fila `.lnk` «Ver las {n} charlas» que abre el cajón «Charlas» de la hoja filtrado por el proyecto (8.3). La charla abierta en la hoja lleva `aria-current="true"` y fondo `--s2`. Sin charlas: el recuadro punteado de 7.3.

### 4.6 Instrucciones (`.bloque`)

Tarjeta `--s1`, borde `--linea`, radio 14, relleno 12. Rótulo «Instrucciones» con «Editar» a la derecha (abre Editar con el foco en el campo Instrucciones). El texto en `500 12px/1.5` `--crema`, cortado a 5 líneas (`line-clamp`), con una comilla de apertura del color del proyecto. Pie: «Van al empezar cada charla». Sin instrucciones: «Sin instrucciones: Avi charla como siempre.» en `--tenue` y «Escribirlas» en lugar de «Editar».

### 4.7 Carpeta (`.bloque`)

Rótulo «Carpeta». Ícono de carpeta de 22 (trazo del color del proyecto, relleno al 22 %), el nombre de la carpeta (la última parte de la ruta) y la ruta abreviada debajo (mono, una línea, `title` con la ruta entera). La etiqueta `.tag`: «La creó Avis · {n} archivos» o «De tu PC · {n} archivos».

- **Creada por Avis:** la zona de soltar (`button.soltar`, mín. 54 de alto, borde punteado dibujado con gradientes, radio 10): «Soltá archivos acá» y debajo «{n} adentro · Abrir en el Explorador» (o «vacía · o abrila en el Explorador»). Clic: abre la carpeta. Arrastrar archivos encima: las hormigas marchan y el fondo toma el color al 8 % (10). Mientras copia: «Copiando…» en lugar de «Soltá archivos acá», con `aria-busy` (decisión de Quintana del 25/11).
- **De tu PC:** «Abrir» y «Cambiar» (`.mini`, 28 de alto).
- **Perdida:** 7.4.

### 4.8 Qué ve cada motor (`.matriz`, molécula)

Tabla de tres columnas (`role="table"`, `aria-label="Qué ve cada motor"`): Motor · Instrucciones · Carpeta. Filas: **Claude Code** · ✓ «en cada charla» · ✓ «la lee» + «cuando hace falta» (mono `--tenue`); **Local** · ✓ «en cada charla» · — «no la ve». El ✓ en `--verde` y el — en `--tenue`, siempre con su texto (el color nunca solo). Va en el proyecto y en el formulario. Es la respuesta a S4: está en los dos lugares donde se decide algo.

### 4.9 Borrar (`.borrar-z`)

`button.borrar` de 32, texto `--rojo` 700 12px, sin borde; armado (4.11), fondo `--rojo` y texto `--negro`, con la barra de cuenta de 3 s al pie (`scaleX 1 → 0`, lineal). Debajo, mientras está armado, la línea de 5.1.

### 4.10 Formulario (`form.form#pro-form`)

`h2` «Nuevo proyecto» o «Editar proyecto». Campos, separados 14:

1. **Nombre** (`input.inp`, 38 de alto): 1–40 caracteres; no repetido (sin distinguir mayúsculas ni tildes, como las listas). El error va debajo, en `--rojo`, con `aria-describedby`.
2. **Instrucciones** (`textarea.inp`, mín. 86, crece hasta 220 y desplaza): hasta 4 000 caracteres; ayuda «Van al empezar cada charla del proyecto, con los dos motores.»; cerca del tope, «{n} de 4000» en mono.
3. **Carpeta** (`radiogroup` de dos tarjetas `.oc`, en Nuevo): «Que Avis cree una» (por defecto) con «Documentos › Avis › {nombre}. Soltás ahí los archivos.» (el nombre se actualiza mientras se escribe) y «Una de esta PC» con «Elegir carpeta… Claude Code la lee; Avis no la toca.». En Editar, en lugar del grupo, la carpeta actual con «Cambiar…» (abre el diálogo de Windows, 11.2).
4. La matriz de 4.8.
5. Botones: «Crear proyecto» / «Guardar cambios» (`.btn-pri`, ámbar) y «Cancelar» (`.btn-sec`).

**Guardar es explícito** (D-p3): las instrucciones son un texto largo y no tienen que llegar a medio escribir a una charla. Con «Una de esta PC», «Crear proyecto» abre primero el diálogo; si se cancela, no se crea nada y el foco vuelve al botón.

### 4.11 Confirmar en el mismo botón

El `.armado` de siempre (3 s, `aria-live=polite`; reusar el de Tareas). «Borrar proyecto» → **«¿Borrar con {n} charlas? Sí»** (con 1: «¿Borrar con 1 charla? Sí»; sin charlas: «¿Borrar? Sí»). Esc, 3 s sin clic o un clic en otra cosa lo desarman.

## 5. Contenido (textos exactos)

### 5.1 Hoja

| Lugar | Texto |
|---|---|
| `h1` | Proyectos |
| Subtítulo | «{n} proyectos · {m} charlas» · «1 proyecto · {m} charlas» · «Ninguno todavía» |
| Línea del encabezado del proyecto | «{n} charlas · {k} archivos» · «sin charlas todavía · {k} archivos» · «{n} charlas · carpeta perdida» |
| Índice | «Proyectos» · «+ Nuevo» |
| Botón de charla | «Nueva charla» · «Empezar la primera charla» |
| Charlas | «Charlas» · «{n} mensajes» · «Ver las {n} charlas» |
| Instrucciones | «Instrucciones» · «Editar» · «Van al empezar cada charla» · «Sin instrucciones: Avi charla como siempre.» · «Escribirlas» |
| Carpeta | «Carpeta» · «La creó Avis · {n} archivos» · «De tu PC · {n} archivos» · «Soltá archivos acá» · «Copiando…» · «{n} adentro · Abrir en el Explorador» · «vacía · o abrila en el Explorador» · «Abrir» · «Cambiar» |
| Matriz | «Motor» · «Instrucciones» · «Carpeta» · «Claude Code» · «Local» · «en cada charla» · «la lee» · «cuando hace falta» · «no la ve» |
| Borrar | «Borrar proyecto» · armado: 4.11 · debajo: «Se van el proyecto y sus {n} charlas. La carpeta y sus archivos quedan en tu PC. Esc cancela.» (sin charlas: «Se va el proyecto. La carpeta y sus archivos quedan en tu PC. Esc cancela.») |
| Formulario | «Nuevo proyecto» · «Editar proyecto» · «Nombre» · «Instrucciones» · placeholder «Qué tiene que saber Avi de este tema, cómo querés que responda…» · «Van al empezar cada charla del proyecto, con los dos motores.» · «Carpeta» · «Que Avis cree una» · «Una de esta PC» · «Crear proyecto» · «Guardar cambios» · «Cancelar» · «Cambiar…» |
| Esc con cambios sin guardar | «¿Descartar los cambios? Esc otra vez» (línea `--ambar` arriba de los botones) |

Los `{n}` usan `plural` de `logica.js` («1 charla», «2 charlas»; «1 archivo»; más de 999 archivos: «999+ archivos»).

### 5.2 Vacíos y errores

| Caso | Texto |
|---|---|
| Primer uso (`h2`) | «Tus proyectos van acá» |
| Primer uso (texto) | «Un proyecto junta lo que Avi tiene que saber de un tema: tus instrucciones, una carpeta con archivos y sus charlas.» |
| Primer uso (botón) | «Crear mi primer proyecto» |
| Recién creado, sin charlas | «**Listo, ya existe.** Soltá los archivos del tema en la carpeta y empezá a charlar: Avi ya conoce tus instrucciones.» (con una carpeta de la PC: «**Listo, ya existe.** Empezá a charlar: Avi ya conoce tus instrucciones.») |
| Nombre vacío | «Ponele un nombre.» |
| Nombre repetido | «Ya hay un proyecto con ese nombre.» |
| Nombre largo | «Hasta 40 letras.» |
| Instrucciones largas | «Hasta 4000 caracteres.» |
| Carpeta perdida (proyecto) | «**No encuentro {ruta}.** ¿La moviste o es de un disco que no está? Las charlas siguen, solo con las instrucciones.» · «Elegir otra» · «Crear una nueva» |
| Carpeta rechazada (11.2) | «Esa carpeta es muy grande para que Claude la lea: elegí una más adentro.» (raíz de un disco, Windows, Archivos de programa, la carpeta de Avis) · «Las carpetas de red todavía no se pueden usar.» (UNC) |
| No se pudo crear la carpeta | «No se pudo crear la carpeta en Documentos. Probá de nuevo o elegí una de esta PC.» |
| Error al guardar | «No se pudo guardar el proyecto. Probá de nuevo.» con «Reintentar» (el formulario queda con lo escrito) |
| No se pudo leer la carpeta de proyectos | «No se pudo abrir la carpeta de proyectos.» con «Reintentar» |
| Proyecto roto (7.6) | «{n} proyecto no se pudo leer. Sigue en la carpeta, sin tocar.» con «Abrir la carpeta» |
| Borrar con fallas | «No se pudieron borrar {k} charlas. Probá de nuevo.» con «Reintentar» (el proyecto queda hasta que se borren todas) |
| Soltar en una carpeta de la PC | (no hay zona de soltar: soltar archivos sobre el proyecto no hace nada) |
| Soltar con un archivo que ya existe | se copia como «{nombre} (2).{ext}»; anuncio «Copiado como {nombre} (2)» |
| Soltar falla | «No se pudo copiar {nombre}.» (el resto sigue) |

### 5.3 Anuncios (`role=status`)

«Proyecto creado» · «Cambios guardados» · «Carpeta cambiada» (al elegir otra carpeta en Editar, que se guarda en el acto; decisión de Quintana del 25/11) · «Proyecto borrado» · «{nombre}, {n} charlas» (al elegir) · «Copiados {n} archivos a {carpeta}» · los errores de 5.2.

## 6. Sistema visual

Tokens de `estilos.css` sin cambios. Nuevo:

- **Color de cada proyecto:** uno de `celeste | verde | rosa | violeta | ambar | rojo` (los de las listas, `tareas.rs` `COLORES`), elegido al crear rotando como `colorSiguiente`. En el formulario de Editar, una fila «Color» con los seis puntos (`radiogroup`, 32 × 32 cada uno). Se usa en: el punto del índice, la píldora, el ícono del encabezado, la comilla de Instrucciones, el ícono de carpeta, el chip de la cabecera de la charla y la luz del escenario (8.2).
- **`--luz`** (registrada con `@property --luz { syntax: '<color>'; inherits: true; initial-value: #F2B632 }`): la luz del escenario de `#hoja` en una charla de proyecto. **No** se reusa `--c`, que en `#hoja` es el color de la mascota (especies).
- El rojo de un proyecto (`--rojo`) se distingue de «carpeta perdida» porque el error siempre lleva texto e ícono, nunca solo el color.

Contraste (calculado con la fórmula WCAG sobre los tokens de `estilos.css`; sobre `--negro` / `--s1` / `--s2`): `--crema` 17,7 / 16,5 / 15,5; `--crema2` 10,3 / 9,6 / 9,0; `--tenue` 5,7 / 5,3 / 4,9; `--rojo` 8,2 / 7,7 / 7,2; `--ambar` 11,5 / 10,7 / 10,1; `--verde` 12,2 / 11,4 / 10,7; `--celeste` 9,8 / 9,1 / 8,6. `--negro` sobre `--ambar` 11,5 y sobre `--rojo` 8,2; `--ambar` sobre `--ambar-osc` 9,8. Todos ≥ 4,5:1 (el más justo: `--tenue` sobre `--s2`, 4,9).

## 7. Estados de la pantalla

### 7.1 Cargando
Índice con tres filas esqueleto (barras `--s2` de 36, sin brillo animado) y el panel vacío. Si tarda menos de 150 ms no se dibuja (sin parpadeo).

### 7.2 Primer uso
Sin índice. Centrado en el panel: el Avi de 96 (pose `saluda`) sobre una luz ámbar de piso, `h2` y texto de 5.2, tres píldoras («Instrucciones», «Carpeta», «Charlas», con un punto de color cada una) y «Crear mi primer proyecto» (`.btn-pri`). El botón abre Nuevo.

### 7.3 Recién creado
El proyecto con 0 charlas: el botón dice «Empezar la primera charla», en lugar de la lista va el recuadro punteado con el Avi de 36 (pose `feliz`) y el texto de 5.2, y la zona de soltar queda encendida (`.vivo`: hormigas y fondo del color) hasta el primer archivo o la primera charla.

### 7.4 Carpeta perdida
`proyectos_leer` informa `carpeta.estado: "perdida"` cuando la ruta no existe o no es una carpeta. El bloque Carpeta pasa a `.mal`: borde `rgba(255,122,107,.45)`, fondo con un velo rojo, el nombre tachado, el texto de 5.2 y «Elegir otra» (primario) y «Crear una nueva». El índice muestra el punto rojo y la fila del menú, su punto. **Las charlas siguen** (8.4).

### 7.5 Borrado armado
4.11. Mientras está armado, el resto del proyecto no cambia; el anuncio dice el texto armado.

### 7.6 Proyecto roto
Un archivo roto se saltea (11.1). Arriba del índice, la línea de 5.2 con «Abrir la carpeta» (`proyectos_abrir_carpeta`). Sus charlas siguen en el cajón «Charlas» de la hoja, sin proyecto a la vista (8.3).

### 7.7 Error al guardar o crear
Debajo de los botones del formulario, la línea de 5.2 en `--rojo` con «Reintentar»; lo escrito queda.

## 8. La charla del proyecto (`#hoja`)

### 8.1 Abrir
«Nueva charla» crea una charla nueva del proyecto y abre la hoja (la de `chat-avis-ux.md`) con el foco en el campo. Una fila de Charlas la retoma. El motor y el modelo de una charla nueva son los de la preferencia, como hoy; se pueden cambiar en la cabecera mientras la charla está vacía (D8 de la charla).

### 8.2 Lo que cambia en la hoja

- **Chip del proyecto** (`button.pj-chip#ch-proyecto`) en la fila de arriba del escenario (`.arriba`), entre «Historial» y «Cerrar»: 32 de alto, radio píldora, fondo `color-mix(color 14%, --s2)`, borde `color-mix(color 40%)`, el ícono de 22 con la inicial, el nombre (`800 12px/1`, hasta 220 de ancho con «…») y «proyecto» en mono `--crema2`. Clic: `irModulo('proyectos', { proyecto })` (la hoja queda abierta). Nombre accesible: «Proyecto {nombre}: ver el proyecto». Con `#hoja.baja` (escenario de 84), el chip se queda y el nombre se corta antes.
- **Luz:** `#hoja.de-proyecto .escenario` usa `--luz` (el color del proyecto) en el gradiente de piso y en la línea, con `transition: --luz .6s var(--ease)`.
- **Cabecera:** el botón de carpeta muestra la carpeta del proyecto y **no abre el menú de carpetas** (la carpeta es la del proyecto): clic, la abre en el Explorador; `title` con la ruta. Con el motor Local, como hoy, `aria-disabled` y tachada, con `title` «El modelo local no lee la carpeta».
- **Marcas de contexto** (`.ctx-p`, nueva fila de 26 debajo de la cabecera, solo en charlas de proyecto): «✓ Instrucciones» y, según el caso, «✓ Carpeta, cuando hace falta» (Claude Code), «— Carpeta: solo con Claude Code» (Local, punteada, `--tenue`) o «Carpeta perdida» (`--rojo`, punteada). `aria-label` del grupo: «Qué usa Avi en esta charla».
- **La línea de herramienta** de siempre (`.herr`, «↳ Leyó tarifas-2027.xlsx») es la prueba de que Claude abrió un archivo de la carpeta: no cambia.
- **Pie del campo** (`.pie-comp`, derecha): «instrucciones + carpeta» (Claude Code) o «solo instrucciones» (Local).
- **«Charla nueva»** de la hoja (el `+` del cajón) dentro de una charla de proyecto crea otra charla **del mismo proyecto**. Para charlar sin proyecto: elegir una charla sin proyecto en el cajón, o «Charlar con Avi» desde la marca (que abre la última charla sin proyecto o una nueva).

### 8.3 Cajón «Charlas»
Lista todas las charlas, como hoy. Cada charla de un proyecto suma en su línea de abajo un punto del color y el nombre del proyecto. Desde «Ver las {n} charlas» (4.5) el cajón abre filtrado: arriba, «{proyecto} · {n} charlas» con «Ver todas» (`.lnk`) que quita el filtro. Una charla cuyo proyecto no existe o está roto se muestra sin proyecto.

### 8.4 Carpeta perdida o cambiada
- **Perdida:** con Claude Code, la charla corre en la carpeta de trabajo vacía de Avis (`carpeta_trabajo`) con las instrucciones. El hilo muestra, una vez, arriba del primer mensaje nuevo: «No encuentro la carpeta del proyecto: sigo solo con las instrucciones.» (`p.nueva-en`).
- **Cambiada** (Editar › «Cambiar…» o «Elegir otra»): las charlas nuevas usan la carpeta nueva. Una charla vieja corre en la carpeta **actual** del proyecto; como Claude Code guarda cada sesión con su carpeta (11.8, M-P3), si no puede retomarla empieza una nueva (`sesion_perdida`, como hoy) y el hilo muestra: «La carpeta del proyecto cambió: Claude sigue sin lo que charlaron antes.»

### 8.5 Borrar el proyecto con su charla abierta
La hoja pasa a una charla nueva sin proyecto (vacía) y anuncia «La charla se cerró porque borraste su proyecto.»; el borrador del campo se conserva.

## 9. Teclado y foco

### 9.1 Esc, por capas (una por vez)
1. Borrado armado → se desarma.
2. Formulario con cambios sin guardar → muestra «¿Descartar los cambios? Esc otra vez»; el segundo Esc descarta y vuelve al proyecto.
3. Formulario sin cambios → vuelve al proyecto (o al primer uso).
4. (última) → Sesiones (`alEscModulo`, modulos-ux 9.1).

`alEscProyectos(estado)` (11.6) devuelve `'desarmar' | 'avisar-descartar' | 'descartar' | 'cerrar-form' | 'cerrar'`.

### 9.2 Atajos
**Ctrl P** abre Proyectos (solo Ctrl; `esAtajoProyectos`), con la medición de 11.8: WebView2 usa Ctrl P para imprimir y hay que frenarlo con `preventDefault`. Si no se puede, Proyectos queda sin atajo (la fila muestra la cuenta o nada). Dentro del formulario, Ctrl Enter guarda. Nada más.

### 9.3 Orden de tabulación
Menú → encabezado de la columna → `#aviso-p` → índice (proyectos, «+ Nuevo») → encabezado del proyecto (lápiz) → «Nueva charla» → charlas → Instrucciones «Editar» → carpeta (soltar / Abrir / Cambiar o Elegir otra / Crear una nueva) → «Borrar proyecto».

### 9.4 Dónde va el foco
- Entrar al módulo → `h1`. Elegir un proyecto en el índice → se queda en la fila (y se anuncia 5.3).
- «+ Nuevo» → campo Nombre. Crear → `h2` del proyecto nuevo. Guardar cambios → `h2`. Cancelar → el botón que abrió el formulario.
- Borrar → la fila del índice que ocupa su lugar (la siguiente, o la anterior, o «+ Nuevo»).
- «Nueva charla» o una charla → el campo de la hoja (el de siempre).
- Chip del proyecto en la hoja → `h2` del proyecto.
- Al redibujar, el foco se queda donde estaba (`data-k`, como en todo el panel).

## 10. Movimiento

Módulo **`proyectosMotion.js`** (anime.js v4 de `vendor/animejs`). Todo bajo `prefers-reduced-motion: no-preference` y `body:not(.pausa)`. Solo `transform` y `opacity`, salvo el color de `--luz` y el fondo de la zona de soltar.

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Entrar al módulo | El acto de modulos-ux 10 (contenido 10 px desde la derecha, escalonado 34 ms) | 320 ms `outQuart` |
| Elegir un proyecto | La píldora viaja (`translateY`) y su borde cambia al color del proyecto; las piezas del panel (`.f-cab`, `.cta`, `.chs`, los bloques, la matriz, borrar) entran 8 px desde abajo, escalonadas 40 ms | píldora 380 ms `outBack(1.3)`; panel 420 ms `outExpo` |
| Crear | La fila nueva del índice abre de 0 a 36 de alto y su punto late una vez (`scale 1 → 1.6 → 1`); el panel del proyecto entra como al elegir | 360 ms `outQuart`; latido 500 ms `--rebote` |
| Abrir su charla | La hoja entra como hoy (`chatMotion.js`); la luz `--luz` pasa al color del proyecto | 600 ms `--ease` (CSS) |
| Arrastrar archivos encima | Hormigas del borde (CSS `background-position`, 1 s lineal, en bucle mientras dura) y fondo del color al 8 % | 200 ms el fondo |
| Soltar | La zona hace `scale .97 → 1` y el número de archivos cuenta hasta el nuevo | 420 ms `outBack(1.6)` |
| Borrar | La fila del índice se pliega (alto a 0, opacidad a 0) y la píldora viaja a la siguiente | 320 ms `outQuart` |
| Armar borrar | Barra de cuenta (CSS) | 3 s lineal |

**Movimiento reducido:** la píldora salta; el panel y la fila nueva aparecen con un fundido de 160 ms; las hormigas no marchan (borde fijo, fondo igual); la luz cambia de color en 200 ms (es color, no desplazamiento). **Pausa:** todo al instante.

## 11. Contrato para el implementador

### 11.1 Archivos en disco
Carpeta `<config>/proyectos/` (la misma base que `tareas/` y `chat/`). **Un archivo por proyecto**: `<id>.json`. Escritura con **`atomico::escribir`** y un candado propio de `proyectos.rs` (como `tareas.rs`). **Las reglas de archivo roto son las de `tareas.rs`:** un archivo roto, de otra versión o con un `id` que no coincide con su nombre se saltea, se anota en `widget.log` («proyectos: {archivo}: {motivo}») y va en `rotas`; nunca se pisa ni se borra.

Formato v1:

```json
{
  "v": 1,
  "id": "p-k3f9a2",
  "nombre": "Presupuestos 2027",
  "color": "ambar",
  "orden": 0,
  "creado": 1764100000000,
  "instrucciones": "Armo presupuestos para clientes de Quintech…",
  "carpeta": { "tipo": "avis", "ruta": "C:\\Users\\…\\Documents\\Avis\\Presupuestos 2027" }
}
```

- `id`: `^p-[a-z0-9-]{1,38}$` (40 en total), generado en la ventana y **validado en Rust antes de armar la ruta** (el `id_con` de `tareas.rs`, con prefijo `p-`; extraerlo a un lugar común en lugar de copiarlo).
- `nombre` 1–40; `instrucciones` 0–4 000 (Rust recorta y anota); `color` ∈ los seis de `COLORES` (otro → `celeste`); `orden` entero; `creado` ms.
- `carpeta`: `{ tipo: "avis" | "pc", ruta }` o `null` (proyecto sin carpeta: no lo crea la ventana, pero se lee). **La ventana nunca escribe `carpeta`:** `proyectos_guardar` la ignora y conserva la del archivo; solo la escriben los comandos de 11.3 que la eligen o la crean en Rust.
- Campos desconocidos se conservan al reescribir (`conservar`, como `tareas.rs`).

### 11.2 La carpeta: elegir, crear, validar (todo en Rust)
**Ninguna ruta sale de texto de la ventana.** La ventana manda solo un `id` de proyecto y un modo; Rust abre el diálogo o arma la ruta.

- **Elegir** (`tipo: "pc"`): Rust abre el diálogo de carpeta (`tauri-plugin-dialog`, API de Rust, `blocking_pick_folder` en un hilo aparte) y valida lo elegido con `carpeta_valida(ruta) -> Result<PathBuf, Motivo>`:
  1. absoluta, existe y es carpeta (`is_dir`);
  2. `canonicalize` y se quita el prefijo `\\?\` para guardarla (sin `..`, sin enlaces sin resolver);
  3. **se rechaza:** la raíz de un disco (`C:\`), `%WINDIR%`, `%ProgramFiles%`, `%ProgramFiles(x86)%`, la carpeta de configuración de Avis y todo lo que esté adentro, y las rutas de red (UNC `\\servidor\…`). Motivos → textos de 5.2.
- **Crear** (`tipo: "avis"`): base = la carpeta Documentos del usuario (`app.path().document_dir()`; en esta PC está dentro de OneDrive, y está bien) + `Avis` + el nombre **saneado**: se quitan `< > : " / \ | ? *` y los caracteres de control, se recortan espacios y puntos del final, los nombres reservados de Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, sin distinguir mayúsculas) suman « proyecto», vacío → «Proyecto», hasta 60 caracteres. Si ya existe una carpeta con ese nombre, « (2)», « (3)»… Se crea con `create_dir_all` y se valida con `carpeta_valida`.
- **Renombrar el proyecto no renombra la carpeta.** Borrar el proyecto **no** toca la carpeta.
- **Abrir en el Explorador:** `proyecto_abrir_carpeta(id)`: Rust lee la ruta del archivo del proyecto, revalida (`is_dir`) y la abre; nunca una ruta de la ventana.
- **Contar archivos:** `read_dir` sin bajar a subcarpetas, solo archivos, con tope 1000 (se muestra «999+»). Solo en `proyectos_leer`.
- **Soltar** (entrega P3): `proyecto_soltar(id, rutas)` solo si `carpeta.tipo == "avis"`. Las rutas vienen del evento de soltar de Tauri (`onDragDropEvent`, rutas del sistema), y aun así Rust valida cada una: absoluta, existe, es archivo (no carpeta, no enlace), no está ya adentro de la carpeta destino; hasta 20 por vez y 200 MB cada una. **Copia, nunca mueve**; nunca pisa (« (2)»). Devuelve `{ copiados: [nombre], fallidos: [{ nombre, motivo }] }`.

### 11.3 Comandos de Rust (`proyectos.rs`, registrados en `lib.rs`)

| Comando | Entrada | Salida | Notas |
|---|---|---|---|
| `proyectos_leer()` | — | `{ proyectos: [Proyecto + { carpeta: { nombre, ruta, tipo, estado: "ok" \| "perdida" \| "sin", archivos } }], rotas }` | por `orden`, `creado`, id; solo lectura |
| `proyecto_crear(datos)` | `{ id, nombre, color, instrucciones, carpeta: "avis" \| "elegir" }` | el proyecto, `{ cancelado: true }` o `{ error }` | con `"elegir"`, el diálogo primero; si se cancela, nada se crea. Valida nombre repetido también en Rust |
| `proyectos_guardar(proyecto)` | el documento v1 (sin `carpeta`) | lo guardado o `{ error }` | nombre, color, orden, instrucciones |
| `proyecto_cambiar_carpeta(id, modo)` | `"elegir"` \| `"avis"` | el proyecto, `{ cancelado }` o `{ error, motivo }` | 11.2 |
| `proyecto_borrar(id)` | id | `{ charlas, fallidas }` | borra primero cada charla del proyecto (archivo del historial y su copia de Engram, con lo que ya usa `historial::borrar_todo`), después el archivo del proyecto, y solo si todas se borraron. **Nunca la carpeta.** Un archivo roto no se borra |
| `proyecto_abrir_carpeta(id)` | id | — | 11.2 |
| `proyectos_abrir_carpeta()` | — | — | abre `<config>/proyectos/` |
| `proyecto_soltar(id, rutas)` | P3 | 11.2 | |

### 11.4 La charla: cómo viajan las instrucciones y la carpeta
- **`chat_abrir`** suma `proyecto: Option<String>`. Con un proyecto, **el parámetro `carpeta` se ignora**: Rust lee el proyecto, toma su carpeta si `is_dir` (si no, `carpeta_trabajo`, 8.4) y sus instrucciones, y devuelve además `proyecto: { id, nombre, color, carpeta: { nombre, estado } }`. Un `proyecto` con id inválido o que no existe → error «el proyecto no existe».
- **`Conversacion`** (chat.rs) suma `proyecto: Option<String>` y `instrucciones: Option<String>` (con su firma). `sirve` compara también la firma de las instrucciones: si cambiaron (se editaron con la charla abierta), el proceso se relanza en el próximo `enviar` con `--resume`, como con el modelo (#35).
- **`INSTRUCCION_CHAT` sigue siendo una sola línea** (L9, 25/11: suma al final «Podés leer los archivos de la carpeta de trabajo con Read, Glob y Grep cuando la pregunta lo pida.»; ver 11.8). Las instrucciones del proyecto (varias líneas, hasta 4 000) **no** van en `--append-system-prompt`. Van por uno de dos caminos, según la medición M-P1 de 11.8 (**medido el 25/11: gana A**; sin instrucciones no se escribe el archivo y la charla es como siempre, en la carpeta del proyecto):
  - **A (si M-P1 pasa):** `--append-system-prompt-file <config>/chat/sistema/<conversacion>.txt`, junto al `--append-system-prompt` de siempre. Rust escribe el archivo (atómico) antes de lanzar y lo borra al cerrar la conversación. Contenido exacto:
    ```text
    <proyecto nombre="{nombre}">
    {instrucciones}
    </proyecto>
    Estás en el proyecto «{nombre}». Las instrucciones de arriba son del usuario para este proyecto. La carpeta de trabajo es la del proyecto: leé sus archivos solo cuando la pregunta lo necesite.
    ```
  - **B (si M-P1 no pasa):** un bloque `<proyecto …>…</proyecto>` en la línea de stdin del mensaje, con el mismo mecanismo de `bloque_avis` (firma; va en el primer turno de cada proceso y cuando cambia), antes del bloque `<avis>`.
  - En los dos: dentro de `{instrucciones}` se quitan las etiquetas `<proyecto` y `</proyecto>` (el texto del usuario no cierra el bloque) y `{nombre}` se escapa (`"` → `'`). `argumentos_chat` sigue siendo la lista fija y testeada; con A suma solo esos dos argumentos y solo cuando hay proyecto.
- **Motor local:** `sistema_local(mascota, avis, proyecto)` arma `INSTRUCCION_CHAT_LOCAL` + el bloque `<proyecto>` (mismo texto, **sin** la frase de la carpeta: «Estás en el proyecto «{nombre}». Las instrucciones de arriba son del usuario para este proyecto.») + `<avis>`. `recorte_local` (3000 tokens, D22) cuenta el bloque como parte del sistema y recorta la historia, nunca las instrucciones; si las instrucciones solas pasan de 1500 tokens (`costo`), se cortan ahí y se anota en el log.
- **Claude Code lee la carpeta** porque es el `cwd` del proceso y tiene `Read,Glob,Grep` (7.1 de la charla, sin cambios). Avis no manda archivos.

### 11.5 Historial (`historial.rs`)
- El formato v1 de la charla (9.1) suma **`proyecto`**: `"p-…"` o ausente. `normalizar` hoy **descarta todo lo que no conoce**: hay que sumarlo explícitamente (valida con la regla del id de 11.1; uno inválido se descarta, la charla queda sin proyecto). Sin `proyecto`, la charla es como las de antes.
- `carpeta` de una charla de proyecto = la ruta que usó en su último mensaje (para detectar el cambio de 8.4).
- `listar` devuelve también `proyecto` (para el cajón y las cuentas de 4.2 y 4.5). `contar` y `borrar_todo` (Configuración › Datos) no cambian: «Borrar todo» se lleva también las charlas de proyectos; los proyectos quedan con 0.
- Nuevo `borrar_de_proyecto(carpeta, id) -> BorradoTodo` para `proyecto_borrar`.

### 11.6 Lógica pura (`widget/src/proyectos.js`) y casos de prueba (`widget/test/proyectos.test.js`)
1. `validarNombreProyecto(nombre, proyectos, propioId)`: vacío y solo espacios → `vacio`; 41 → `largo`; «presupuestos 2027» con «Presupuestos 2027» → `repetido` (sin mayúsculas ni tildes); el propio nombre al editar → válido.
2. `validarInstrucciones(texto)`: 4 000 → válido; 4 001 → `largo`.
3. `colorSiguiente(proyectos)`: rota por los seis (reusar el de `tareas.js`, no copiarlo).
4. `charlasDe(charlas, id)`: solo las del proyecto, por `actualizada` descendente; `cuentaCharlas(charlas)` → `{ [id]: n }`.
5. `lineaProyecto(p, n)`: los tres casos de 5.1 y los plurales (1 charla, 1 archivo, 999+).
6. `textoBorrar(n)`: 0, 1 y 3 charlas (4.11 y 5.1).
7. `alEscProyectos(estado)`: un caso por capa de 9.1, en orden.
8. `esAtajoProyectos(e)`: Ctrl P sí; Ctrl Shift P, Alt Ctrl P, P solo → no.
9. `marcasContexto({ motor, carpeta })`: claude + ok, claude + perdida, local + ok → las de 8.2.
10. `nombreFilaProyectos(lista)`: los tres nombres de 4.1.
11. **Rust `proyectos_tests.rs`:** ida y vuelta del formato; un campo desconocido sobrevive a guardar; `proyectos_guardar` con `carpeta` en el documento no la cambia; archivo roto → `rotas` y mismo hash después de usar la hoja; id con `..`, `/`, `CON` o sin `p-` → rechazado; `carpeta_valida`: `C:\`, `C:\Windows`, la carpeta de config, una UNC → rechazadas; una carpeta normal → aceptada y sin `\\?\`; `nombre_carpeta("CON")`, `"a/b:c"`, `"  ."`, 80 letras → saneados; carpeta existente → « (2)»; `proyecto_borrar` no toca la carpeta del proyecto (archivo testigo adentro, mismo hash) ni las charlas de otro proyecto.
12. **Rust `chat_tests.rs`:** `argumentos_chat` sin proyecto → idéntico al de hoy (test existente); con proyecto (camino A) → la lista de hoy + exactamente `--append-system-prompt-file <ruta>`; el archivo tiene el texto de 11.4 con las etiquetas quitadas de las instrucciones; `sistema_local` con proyecto y el recorte que nunca corta las instrucciones.
13. **Rust `historial_tests.rs`:** `proyecto` válido sobrevive a `normalizar`; inválido se descarta sin rechazar la charla; una charla v1 sin `proyecto` se lee igual.

### 11.7 Archivos (sugeridos)

| Archivo | Qué |
|---|---|
| `widget/src/proyectos.js` (nuevo, puro) | 11.6 |
| `widget/src/proyectosVista.js` (nuevo) | índice, panel, formulario, primer uso (por partes, `data-parte`, para no pisar lo que se escribe) |
| `widget/src/proyectosMotion.js` (nuevo) | 10 |
| `widget/src/modulos.js` | `MODULOS` suma `{ id: 'proyectos', nombre: 'Proyectos', atajo: 'Control+P', tecla: 'Ctrl P' }` después de Hábitos; `MODULOS_ACTIVOS` lo suma; `cuentaModulo` y `nombreModulo` |
| `widget/src/chatVista.js`, `chat.js` | el chip, `.ctx-p`, la carpeta fija, la luz, el cajón con proyecto, las líneas de 8.4 |
| `widget/src/main.js`, `index.html`, `estilos.css` | `#pro-fila`, `#pro`, `st.proyectos`, Esc, Ctrl P, `@property --luz` |
| `widget/src-tauri/src/proyectos.rs` + `proyectos_tests.rs` (nuevos) | 11.1 a 11.3 |
| `widget/src-tauri/src/chat.rs`, `chat_local.rs`, `historial.rs`, `lib.rs` | 11.4 y 11.5 |
| `widget/dev/vista.html` | `?proyectos=vacio\|nuevo\|recien\|lista\|perdida\|borrar\|roto\|editar` y `&chat=proyecto\|proyecto-local\|proyecto-perdida` |

### 11.8 Medir antes de construir (con el `claude` real, en E0 de la entrega P2)
- **M-P1:** que esta versión de Claude Code acepte `--append-system-prompt-file` junto con `--append-system-prompt` en `-p` con `stream-json`, con un archivo de varias líneas y 4 000 caracteres con tildes, y que el `init` siga limpio. Si no: camino B de 11.4.
- **M-P2:** el costo en tokens del bloque (contexto de hoy, ~6 500).
- **M-P3:** `--resume` con un `cwd` distinto del de la sesión: ¿falla, empieza otra o la encuentra? Define el texto de 8.4.
- **M-P4:** Ctrl P en WebView2: si `preventDefault` en `keydown` evita el diálogo de imprimir.
- **M-P5:** el diálogo de carpeta de `tauri-plugin-dialog` desde Rust con la ventana acoplada y siempre arriba: que quede adelante.

**Medido el 25/11/2026 (E0 de P2)** con Claude Code 2.1.332 y `--model haiku`, desde una carpeta temporal fuera del repositorio, con los argumentos de `argumentos_chat` sin el servidor de Avis (`--restricted`, `--strict-mcp-config`, `--settings`, `--tools Read,Glob,Grep`…) y un mensaje por stdin en `stream-json`. Líneas reales en `widget/src-tauri/src/fixtures/chat/proyecto-*.jsonl`.

- **M-P1 pasa → camino A.** `--append-system-prompt-file <archivo>` junto con `--append-system-prompt` en `-p`: un archivo de 48 líneas y 4051 caracteres con tildes (el bloque de 11.4 con «La palabra clave del proyecto es MANDARINA»); el `init` sale limpio (herramientas `Glob, Grep, Read`, sin MCP) y la respuesta usa el archivo («La palabra clave del proyecto es **MANDARINA**»). Comparado con el camino B (el mismo bloque al principio del mensaje), con las instrucciones «Respondé en inglés.»: **A respondió en inglés y B en español** (gana `Respondés en español rioplatense` de `INSTRUCCION_CHAT`). Por eso A, también para la prueba de aceptación de 14/P2.
- **M-P2:** sin el bloque, el primer turno lee 6 125 tokens (sin el servidor de Avis; con él, ~7 550); con el bloque de 4051 caracteres, 7 828: **+1 703 tokens** (~2,4 caracteres por token por las tildes y el relleno). Va en la caché como el resto del sistema.
- **M-P3: `--resume` desde otra carpeta encuentra la sesión y sigue** (mismo `session_id`; el `init` trae la carpeta nueva y Glob y Read miran la nueva). No es una sesión perdida: el texto «La carpeta del proyecto cambió: Claude sigue sin lo que charlaron antes.» de 8.4 queda solo para cuando Claude Code de verdad no la tiene (`sesion_perdida`, raro).
- **Hallazgo: Claude Code guarda el sistema de la primera vez** (`--system-prompt-snapshot`, prendido por defecto: «every later request and resume sends the record as-is, even when a later launch passes different text»). Medido: una charla empezada con «Respondé en inglés.», retomada con `--resume` y el archivo cambiado a «Respondé en francés.», siguió en inglés. Consecuencia: **editar las instrucciones cambia las charlas nuevas y las del modelo local, pero no una charla de Claude Code que ya tiene mensajes** (Avis relanza igual el proceso con el archivo nuevo, como pide 11.4). Con `--system-prompt-snapshot off` la respuesta salió en español (Haiku, una sola vuelta: no concluye). Queda para decidir; pasa lo mismo con el nombre del usuario de #37.
- **M-P4 pasa** (26/11/2026, `.msi` 0.15.1): Ctrl P abre Proyectos y no aparece el diálogo de imprimir.
- **M-P5 pasa** (26/11/2026, `.msi` 0.16.0, acoplada arriba y «Siempre arriba»): «Una de esta PC» → «Crear proyecto» abre «Seleccionar carpeta» adelante del panel, y el panel no se pliega mientras se elige.
- **Aceptación de 14/P2 (25/11, `cargo test --lib real_proyecto -- --ignored`):** con Claude Code y Haiku, un proyecto con «Respondé en inglés.» responde en inglés y la línea `.herr` muestra `Read tarifas-2027.txt` solo en la pregunta que lo pide. **Dos hallazgos para decidir:** (1) después de un turno sin herramientas, Haiku contesta «solo tengo las herramientas de Avis» y no lee la carpeta; pasa igual en una charla **sin** proyecto con la `INSTRUCCION_CHAT` de #43 (medido con dos turnos en la terminal), así que no lo causa P2. (2) Con el modelo local (Qwen3-4B), las mismas instrucciones responden en español: gana «Respondés en español rioplatense» de `INSTRUCCION_CHAT_LOCAL`. Las dos piden cambiar un texto fijo (la instrucción o el bloque de 11.4), que vuelve a diseño.
- **Decisión de Quintana (25/11, L9) y nueva medición:** `INSTRUCCION_CHAT` suma al final, en la misma línea, «Podés leer los archivos de la carpeta de trabajo con Read, Glob y Grep cuando la pregunta lo pida.» e `INSTRUCCION_CHAT_LOCAL` suma «Si el bloque <proyecto> pide otro idioma o estilo, seguilo antes que lo de arriba.». Medido una vez con Haiku en la terminal, dos turnos (pregunta general y después «Fijate en los archivos de la carpeta»): **sin proyecto** el segundo turno usa Grep y Glob y responde «1500 pesos por hora»; **con proyecto** igual, en inglés. `real_proyecto` (pregunta general primero, la de la carpeta después): Claude Code en inglés, sin herramientas en la primera y `Glob **/*` + `Grep` en la segunda («You charge **1500 pesos per hour**… `tarifas-2027.txt`»); **el modelo local responde en inglés** («A budget is a financial plan…»).
- **El archivo de sistema no sobrevive a su uso (B1, verificador):** se borra cuando sale el proceso que lo leyó (si otro proceso de la misma charla no lo volvió a escribir), al borrar la charla (`historial::borrar`: «Borrar», «Borrar todo» y borrar el proyecto), al salir de Avis (`apagar`) y al arrancar (`limpiar_sistema`). Relanzar (`sirve_para` → `--resume`) lo vuelve a escribir.
- **Una charla con su proyecto borrado o roto (A2):** con historia (sesión de Claude Code o ya usada), `chat_abrir` la abre sin proyecto (su carpeta o la de trabajo) y no devuelve `proyecto`; la ventana la marca `sinProyecto` y la muestra como una charla común (8.3). «el proyecto no existe» queda para una charla nueva. La ventana tampoco pide el proyecto de una charla con mensajes que no está en su lista (`proyectoParaAbrir`) y nunca manda `carpeta` con un proyecto (A1).

## 12. Accesibilidad

- Un solo `h1` («Proyectos»); `h2` el nombre del proyecto o el título del formulario; `h3` (visualmente rótulos) para «Charlas», «Instrucciones», «Carpeta» y «Qué ve cada motor». Sin saltos.
- Índice: `nav` con `aria-label="Proyectos"`, botones con `aria-current="page"`; el número de charlas `aria-hidden` con su texto en `span.oculto` («, 3 charlas»); la carpeta perdida con su texto.
- Formulario: `label for`; errores con `aria-describedby` y `aria-invalid`; el grupo de carpeta es `radiogroup` con foco itinerante (flechas).
- La matriz es una tabla con encabezados; el ✓ y el — llevan texto.
- Áreas de clic: 32 de alto como mínimo (convención del widget, de puntero, aprobada para este módulo).
- Foco visible: 2 px `--ambar` desplazado 2 (sobre el botón ámbar, `--crema`).
- `role=status` con los textos de 5.3; los errores de 5.2 también se anuncian.
- Color nunca solo: el color del proyecto siempre va con su nombre; «carpeta perdida» siempre con texto.
- Movimiento reducido y pausa: 10.

## 13. Responsive y zoom

El panel no cambia por ancho (188 + 460, estilo-avis 9.2). Al 100 %, el índice muestra 12 proyectos; el panel desplaza adentro con el encabezado del proyecto fijo. Con zoom de 125 a 200 %, todo escala y cada columna desplaza por su lado. La hoja de la charla, como hoy. Revisar al 100, 150 y 200 %, flotando y acoplado. El boceto se revisó a 375, 768 y 1440; a 375 escala el marco entero, solo para mirarlo en el teléfono.

## 14. Entregas

| Entrega | Qué | Riesgo | Acepta |
|---|---|---|---|
| **P1 · Módulo y proyectos** | `proyectos.rs` (leer, crear, guardar, cambiar carpeta, borrar sin charlas todavía, abrir), la fila del menú, la hoja con índice, proyecto, formulario, primer uso, recién creado, carpeta perdida, roto, errores y el movimiento de 10 | Risk: item 1 (formato nuevo en disco) y item 2 (rutas: carpeta elegida o creada; el `id` arma una ruta) | tests 1–3, 5–8, 10, 11; un JSON roto puesto a mano sigue igual (hash); `carpeta_valida` rechaza `C:\` y la config de Avis; Playwright con `dev/vista.html?proyectos=…` al 100 y 200 % contra esta dirección |
| **P2 · La charla del proyecto** | E0 (11.8), `chat_abrir` con `proyecto`, instrucciones por el camino que gane, local, `historial.rs` con `proyecto`, chip, luz, `.ctx-p`, cajón con proyecto, 8.4 y 8.5, y `proyecto_borrar` con sus charlas | Risk: item 3 (`argumentos_chat` y el formato del historial son contratos fijados por tests) e item 1 (`proyecto` en el historial) | tests 4, 9, 12, 13; sin proyecto, `argumentos_chat` y el historial idénticos (diferencial contra `main`); una charla real con un proyecto cuyas instrucciones piden «respondé en inglés» responde en inglés con Claude Code y con Local; Claude lee un archivo de la carpeta solo cuando la pregunta lo pide (la línea `.herr` lo muestra) |
| **P3 · Soltar archivos** | `proyecto_soltar`, la zona viva, las hormigas, copiar sin pisar | Risk: item 1 (escribe archivos del usuario: copia, nunca mueve ni pisa) | soltar 3 archivos (uno repetido) deja 4 en la carpeta y los originales intactos (hash); una carpeta soltada se rechaza; 21 archivos → los 20 primeros y el aviso |

**No improvisar:** que la ventana nunca mande una ruta (11.2); que Avis nunca toque los archivos de la carpeta salvo copiar al soltar; las reglas de archivo roto; que `INSTRUCCION_CHAT` siga en una línea; el orden del proyecto (3.4); los textos de 5; la matriz en el proyecto y en el formulario. Cualquier otra pieza (proyectos compartidos con Campos, plantillas, mover charlas entre proyectos, archivos fijados que se mandan siempre) vuelve a diseño.

## 15. Decisiones

| Id | Decisión | Descartada | Quién |
|---|---|---|---|
| D-p1 | Opción B · Carpeta (índice + proyecto) | A · Estante, C · Portada | Quintana, 25/11 |
| D-p2 | Borrar el proyecto se lleva sus charlas; la carpeta y sus archivos quedan | borrar también la carpeta | Quintana, 25/11 |
| D-p3 | La carpeta de Avis en `Documentos › Avis › <nombre>` | `%LOCALAPPDATA%` | Quintana, 25/11 |
| D-p4 | Un color por proyecto; la luz de la charla lo toma | ámbar para todos | Quintana, 25/11 |
| D-p5 | Áreas de clic de 32 (convención del widget) | 44 solo en este módulo | Quintana, 25/11 |
| D-p6 | La tira de Sesiones (modulos-ux 4.4) se llama **Repos** | dos cosas llamadas «proyectos» | Quintana, 25/11 |
| D-p7 | Guardar explícito en el formulario («Crear proyecto», «Guardar cambios») | guardar al instante como Tareas | Delfina (las instrucciones no tienen que llegar a medio escribir a una charla) |
| D-p8 | El texto de borrar sigue el patrón de Tareas («¿Borrar con 3 charlas? Sí») | el del boceto («¿Borrar «Presupuestos 2027»? Sí») | Delfina (un solo patrón en Avis) |
| D-p9 | Sin atajo «Ctrl N» en «Nueva charla» | la pista del boceto | Delfina (Ctrl N es «ventana nueva» en WebView2) |
| D-p10 | La carpeta la eligen o la crean comandos de Rust; la ventana nunca manda rutas | que la ventana use `elegir_carpeta` y mande el texto | Delfina (pedido del brief) |
| D-p11 | Rechazar raíces de disco, Windows, Archivos de programa, la config de Avis y carpetas de red | aceptar cualquier carpeta | Delfina (Glob sobre `C:\` no termina; red: lenta y sin medir) |
| D-p12 | En una charla de proyecto la carpeta de la cabecera no abre el menú de carpetas | dejar cambiarla por charla | Delfina (la carpeta es del proyecto) |
| D-p13 | Las instrucciones van por archivo de sistema si M-P1 pasa; si no, como bloque del mensaje | partirlas en una línea en `--append-system-prompt` | Delfina (respeta la regla de una línea) |
| D-p14 | Con la carpeta perdida, la charla sigue en la carpeta de trabajo vacía | bloquear la charla | Delfina |
| D-p15 | Una charla vieja corre en la carpeta actual del proyecto | en la carpeta con la que empezó | Delfina (las instrucciones hablan de la carpeta actual) |
| D-p16 | Atajo Ctrl P, sujeto a M-P4 | sin atajo | Delfina, a confirmar con Quintana |
| D-p17 | Soltar copia (nunca mueve) y solo en carpetas creadas por Avis | soltar también en carpetas de la PC | Delfina |
| D-p18 | Topes: nombre 40, instrucciones 4 000, 20 archivos por soltar de hasta 200 MB | sin topes | Delfina |

## 16. Correcciones y contradicciones con el código

- **`historial::normalizar` descarta los campos que no conoce** (`historial.rs:113`): `proyecto` hay que sumarlo explícitamente (11.5); si no, se pierde al primer guardado.
- **`--c` en `#hoja` es el color de la mascota** (`#hoja .escenario` lo usa en el gradiente, `estilos.css:1054`): la luz del proyecto va en una variable nueva, `--luz` (6), no pisando `--c`.
- **Hoy `chat_abrir` recibe la carpeta como texto de la ventana** (`lib.rs:733`, `carpeta: Option<String>`) y solo comprueba `is_dir`. Para proyectos no se usa ese camino (11.4); el camino de hoy queda igual (no es parte de #44), pero conviene revisarlo con la misma regla de 11.2 en otra entrega.
- El escenario real de la hoja muestra a la mascota de 96 (`aviEscena`), no de 72–88 como el boceto; el chip va en `.arriba`, que existe en `index.html:131` con «Historial» y «Cerrar».
- `modulos-ux.md` 4.4 nombra la tira de Sesiones `nav[aria-label="Proyectos"]`; con D-p6 pasa a `aria-label="Repos"` y su rótulo visible, si lleva, «Repos». La tira es de M2 y todavía no está en el código (`modulos.js`: «La tira de proyectos es M2»).
- `modulos.js` dice en su encabezado que Hábitos «entra después»; Proyectos se suma a `MODULOS` después de Hábitos aunque Hábitos no esté activo todavía (el orden del menú no depende de qué está activo).
- El boceto muestra «Ctrl N» en el botón de charla y el texto de borrar con el nombre: los dos cambian (D-p8, D-p9).
- `tareas.rs` tiene `id_con` privado: extraerlo para `proyectos.rs` en lugar de copiarlo (11.1).
