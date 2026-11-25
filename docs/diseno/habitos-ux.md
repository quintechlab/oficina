# Avis · Hábitos — dirección

> Issue #41, rama `feat/41-habitos`, construida **sobre `feat/42-modulos` M1** (`modulos-ux.md`): Hábitos es un módulo más del menú. Boceto: `docs/diseno/bocetos/habitos.html` (servirlo con http desde la raíz del repo). Tres opciones: A · Renglón, **B · Carpeta** y C · Fichas. **Quintana eligió B · Carpeta el 24/11** y aprobó las decisiones del boceto (sección 15). De A se toma la franja ámbar de la columna de hoy en la vista Semana; de C, nada.
> Evoluciona `tareas-ux.md` (la hoja, el índice, la fila, el tilde, confirmar en el mismo botón, el globo diario, `atomico.rs`, archivos rotos) y `modulos-ux.md` (el menú, `irModulo`, `#aviso-p`). Lo que no se nombra acá sigue como está allí.

---

## 1. Brief

- **Pedido (24/11):** «que me ayude con mis habitos». Plan aprobado: hábitos locales, en la PC. Manejarlos hablando con la mascota va en otra entrega.
- **Requisitos (#41):** S1, hoja propia con su fila en la barra (un módulo, `modulos-ux.md`). S2, cuatro tipos: sí/no diario («Caminar»), con cantidad por día («Agua: 3 de 8 vasos»), solo ciertos días («Gimnasio lun, mié y vie»; los demás no cortan la racha) y veces por semana («Correr 3 veces por semana»). S3, tildar o sumar cada día, con la racha y la vista de la semana. S4, recordatorio opcional a una hora por hábito: globo de la mascota y notificación de Windows; nada se abre solo. S5, resumen semanal con el modelo local: un globo el domingo o el primer arranque de la semana («Esta semana caminaste 5 de 7 días»); el clic abre una charla para ajustar. S6, se guardan en la PC con el mismo cuidado que Tareas (escritura atómica; un archivo roto nunca se pisa ni se borra).
- **Para quién:** Quintana, que tiene Avis abierto todo el día y entra muchas veces por poco tiempo.
- **Acción principal:** marcar lo de hoy (tildar o sumar un vaso) sin perder tiempo. La segunda: ver cómo viene la semana y la racha.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps en un equipo medio con zoom de 200 %.

## 2. Concepto

**De a un día.** Un índice angosto con Hoy, Semana y tus hábitos (cada uno con su racha); a la derecha, lo que elegiste. Tres palabras: **constante, a mano, cálido**. Lo que se recuerda: **la racha es una brasa** que se enciende con cada día cumplido, y **el anillo del agua** que se llena de a un vaso. Un hábito hecho no se tacha: se enciende en ámbar.

Principios: todo se guarda al instante; lo que borra confirma en el mismo botón; nada se abre solo; un día sin hacer no corta nada hasta que termina (medianoche de Argentina); los días que no tocan nunca cuentan como falta.

## 3. Arquitectura

### 3.1 Entrar y salir

| Desde | Cómo |
|---|---|
| Menú de módulos | Fila **«Hábitos»** (`#hab-fila`, `.mod`), entre Tareas y Configuración (`modulos-ux.md` 3.1). Con el módulo abierto, otro clic lleva el foco al `h1` |
| Teclado | **Ctrl H** (`aria-keyshortcuts="Control+H"`). Medir antes de construir (11.9) |
| Globo de recordatorio | «Ver hábitos →» abre Hábitos › Hoy (8.3) |
| Notificación de Windows | Su clic muestra Avis en Hábitos › Hoy, si el plugin lo permite (11.9) |
| Salir | Esc por capas (9.1); la última capa va a Sesiones. No hay «‹ Tablero» |

Se entra siempre en **Hoy** la primera vez en la ejecución; después, en la última vista usada (no se guarda entre ejecuciones).

### 3.2 Dónde se dibuja

La hoja `#hab`, hermana de `#tar` y `#cfg` en la columna. `#marco.con-hab` (y `.mod-habitos`) esconde lo mismo que `.con-tar`. Encabezado: la mascota de 40 (`#hab-mini`), el `h1` «Hábitos» y la bajada (5.1). Arriba de todo, `#aviso-p` si hay una pregunta (`modulos-ux.md` 4.5).

### 3.3 Árbol del DOM

```text
main.principal
├── header.cab > .cab-t > span.hab-mini (Avi de 40, aria-hidden) · h1#titulo[tabindex=-1] "Hábitos" · p#subtitulo
├── div#aviso-p
├── div#hab
│   └── div.carpeta
│       ├── nav.idx[aria-label="Vistas y hábitos"]
│       │   ├── button.ix-b[data-ver=hoy] · button.ix-b[data-ver=semana]
│       │   ├── span.rot-i[aria-hidden] "Hábitos"
│       │   ├── button.ix-b[data-ver=<id>] × n     (punto de color, nombre, racha corta)
│       │   ├── button.ix-b.rota × k               (archivos que no se pudieron leer, 7.6)
│       │   └── button.ix-b.ix-mas "Nuevo hábito"
│       └── section.pane
│           ├── hoy:     header.pane-h > h2 "Hoy" · div.pane-s  │ .err? │ div.desplaza > ul.filas · p.rot-p "Hoy no toca" · ul.filas.fuera-l
│           ├── semana:  header.pane-h > h2 "Semana" · div.pane-s │ div.desplaza > div.mat · div.leyenda · p.pista
│           ├── hábito:  button.lnk.atras "‹ {Hoy|Semana}" · div.desplaza > div.det.frm (4.10)
│           └── nuevo:   header.pane-h > h2 "Nuevo hábito" · div.desplaza > div.frm (4.11)
└── p.oculto[role=status]#hab-vivo
```

### 3.4 Vistas

| Vista | Qué muestra | Orden |
|---|---|---|
| **Hoy** | Los hábitos que tocan hoy (`deHoy`, 11.4). Abajo, «Hoy no toca»: los de algunos días que hoy no tocan y los de veces por semana con la semana ya cumplida y sin marcar hoy | El orden del usuario (`orden`, después `creado`). **No se reordena al marcar:** un hábito hecho se queda en su lugar y se enciende |
| **Semana** | Una grilla: cada hábito con sus 7 días de lunes a domingo; una franja ámbar marca la columna de hoy | El mismo orden |
| **Un hábito** | Su nombre, la racha grande, las últimas 5 semanas y su configuración (4.10) | — |
| **Nuevo** | El formulario (4.11) | — |

### 3.5 Estado en la ventana

`st.habitos = { abierta, ver, armado, creando, borrador, errForm, feliz, lista, rotas, cargando, errorGuardar, error }`. `abierta` se deriva de `st.modulo === 'habitos'` (`modulos-ux.md` 3.5). `ver` es `'hoy' | 'semana' | 'nuevo' | <id>`; `desde` (`'hoy' | 'semana'`) es la vista a la que vuelve «‹». Los borradores de texto (nombre, unidad) viven en su `<input>`; el nombre de un hábito que ya existe se guarda al salir del campo (como el título de una tarea). La hoja redibuja por partes (`data-parte`: `idx`, `pane`) con el patrón de `ponerParteConCampo`.

## 4. Componentes

### 4.1 Fila del menú (`#hab-fila`)

La `.mod` de `modulos-ux.md` 4.1, con el ícono de la flecha circular con punto (`<path d="M13.2 8.6A5.2 5.2 0 1 1 11.6 4.2"/><path d="M12.2 1.8v2.8H9.4"/>` y un punto de r 1,5; el arco lleva `class="arco"`). Hover: el arco se vuelve a dibujar (`stroke-dashoffset` 30 → 0, 700 ms `--ease`). A la derecha:

| Caso | Cuenta |
|---|---|
| Sin hábitos | `kbd` «Ctrl H» |
| Ninguno toca hoy | «—» en `--tenue` |
| Con hábitos de hoy | `.anillo`: un anillo de 14 (r 5, trazo 2,6, fondo `--linea-hover`, relleno `--ambar` con `stroke-dasharray` proporcional; con 0 hechos no se dibuja el relleno) + «{h}/{t}» `500 10px/1 var(--m)` `--crema2` |
| Todos hechos | lo mismo, con el texto en `--ambar` |

Nombre: «Hábitos» · «Hábitos, hoy no toca ninguno» · «Hábitos, {h} de {t} hechos hoy» · «Hábitos, los {t} de hoy hechos». Al cambiar la cuenta, el anillo late (`scale 1 → 1.25 → 1`, 500 ms `--rebote`).

### 4.2 Índice (`.idx`)

El de Tareas (`tareas-ux.md` 4.2: ancho `--ancho-indice`, `.ix-b` de 34, elegido con `--ambar-osc`). **Hoy**: ícono de un círculo con punto, `--c` = `--ambar`, cuenta «{h}/{t}» en `--ambar`. **Semana**: ícono de grilla, `--c` = `--crema2`, sin cuenta. Rótulo «Hábitos». Cada hábito: punto de 7 de su color, nombre cortado con `…` y `title` entero, y a la derecha su racha corta (4.7, solo número y brasa); su nombre accesible suma «, racha de {n} {unidad}». «Nuevo hábito», con el cuadro punteado.

### 4.3 Encabezado del panel (`.pane-h`)

`h2` `800 19px/1.15 var(--f)`. Debajo, `.pane-s` de 32, `--t-mono-s` `--tenue`:

- **Hoy:** «hoy · {h} de {t} hechos» + la barra `.prog` de 90 × 4 (`role=progressbar`). Completo: «¡Día completo!» en `--ambar` 600, con la barra llena. Ninguno toca: «hoy no toca ninguno».
- **Semana:** «{d}/{m} al {d}/{m} · {p} % de lo que tocaba» (11.4, `pctSemana`).

### 4.4 Fila de hábito (`li.fila`, en Hoy)

La fila de Tareas (`tareas-ux.md` 4.5): grilla `36px / 1fr / auto`, filete superior, hover `--s1`, `align-items: center`.

- **Control** (columna 1): el tilde (4.5) o el sumador (4.6). Si hoy no toca, un «–» en `--linea-hover` (`aria-hidden`, `title` «Hoy no toca»).
- **Cuerpo:** botón `.nom` con el nombre (`--t-cuerpo-f` `--crema`, corta con `…`) que abre el hábito (4.10). Debajo, `.meta` (`--t-mono-s`, condensada al 75 %): el rótulo del tipo (5.1), el «−1» si es de cantidad y hoy hay algo (4.6) y el aviso (campana de 10 + «HH:MM»).
- **Racha** (columna 3): 4.7, larga.
- **Hecho:** el control en ámbar; el nombre **no** se tacha ni cambia de color.
- **Recién creado:** destello `color-mix(--ambar 14%)` de 1,2 s.
- En «Hoy no toca», las filas al 70 % de opacidad.

### 4.5 Tilde (sí/no, algunos días, veces por semana)

El `.ck` de Tareas (círculo de 18 en un área de 36 × 38; hover con el color del hábito; hecho: fondo y borde `--ambar`, visto `--negro` de trazo 2,4). `role="checkbox"`, nombre «Hecho hoy: {nombre}». Para veces por semana, tildar hoy suma uno a la semana; se puede tildar aunque la semana ya esté cumplida (cuenta igual).

### 4.6 Sumador (cantidad)

`button.sum`, 36 × 38: un anillo de 30 (r 15, trazo 3) partido en `meta` tramos con 2,6 de separación (con más de 12, un arco continuo). Tramos hechos `--ambar`; los que faltan, `--s3` (al pasar el mouse, `color-mix(--c 45%, --s3)`). Adentro, el número de hoy (`800 11px/1 var(--f)`, cifras tabulares); con la meta cumplida, un visto ámbar. Abajo a la derecha, un «+» de 13 en un círculo `--ambar` con texto `--negro` (con la meta cumplida pasa a `--s3`/`--crema2`). Cada clic suma uno; se puede pasar de la meta («9 de 8 vasos»).

- **Nombre:** «Sumar 1 {unidad en singular} a {nombre}. Van {v} de {meta}» · con la meta cumplida: «{nombre}: meta cumplida, {v} de {meta} {unidad}. Sumar otro».
- **Restar:** `button.menos` «−1» en la `.meta` (alto 22, borde `--linea`, píldora, `500 10px var(--m)`), solo si hoy hay más de 0. Nombre «Restar 1 {unidad en singular} a {nombre}», `title` «Restar uno».
- La unidad en singular: se le saca la «s» final («vasos» → «vaso», «páginas» → «página»; «veces» → «vez»).

### 4.7 Racha (`.racha`)

Una brasa (`<path d="M6.2.8c.5 2.4 4.3 3.9 4.3 7.6A4.5 4.5 0 0 1 1.5 8.6c0-1.9 1-3.1 2-3.9.1 1.4.8 2.3 1.6 2.5C4.8 4.9 5.2 2.6 6.2.8z"/>` en un `viewBox` de 12 × 14, de 9 × 11) y el número, `--t-mono-s` condensada, número en 600 y cifras tabulares. Larga: «{n} {días|semanas}»; corta (índice): solo el número. `title` «Racha: {n} {unidad} · la mejor: {m}».

| Racha | Color | Brasa |
|---|---|---|
| 0 | `--tenue` | «sin racha» (corta: «0») |
| 1–6 | `--pico` | quieta |
| 7–29 | `--ambar` | brillo `drop-shadow(0 0 3px rgba(242,182,50,.55))` |
| 30 o más | `--ambar` | de 11 × 13, brillo de 5 px, titila (`scale(1.06, .9)` a mitad de 2,4 s, en bucle; se frena con pausa o movimiento reducido) |

### 4.8 Celdas de la semana (`.sem` > `.cel`)

Siete celdas de `--cel` (16 en Hoy no se usan; 20 en Semana, 14 en el calendario del hábito), radio `--cel × .32`, separación según la vista. Estados:

| Estado | Dibujo | Nombre (`aria-label` y `title`) |
|---|---|---|
| hecho | fondo `--ambar` | «{día} {d}: hecho» (cantidad: «{v} de {meta}, cumplido») |
| en parte (cantidad) | se llena **desde abajo** como un vaso: `linear-gradient(to top, var(--ambar) {p}%, var(--s3) 0)` | «{día} {d}: {v} de {meta}» |
| no se hizo | anillo interior de 1,5 `--linea-hover` | «{día} {d}: no se hizo» |
| falta hoy | anillo interior de 1,5 `--crema2` | «… (hoy): falta» |
| no toca | un guion de 6 × 1,5 `--linea-hover` | «{día} {d}: no toca» |
| sin salida (veces por semana) | un punto de 3 `--linea-hover` | «{día} {d}: sin salida» |
| por venir | anillo interior de 1 `--linea` | «{día} {d}: por venir» |
| antes de crearlo | un punto de 2 `--linea` | «{día} {d}: antes de crearlo» |

Hoy lleva además un anillo exterior de 3 (`--crema2`; hecho o en parte: `--ambar`) separado por 1,5 del fondo. **Corregir:** en la vista Semana, las celdas de los días de esta semana que ya pasaron (y la de hoy) son `button` con `aria-pressed`, para los tipos sí/no, algunos días y veces por semana. Un clic alterna hecho/no hecho. La cantidad de un día pasado **no** se corrige (D-h4). Hover: anillo y fondo del color del hábito al 16 %; presión `scale(.86)`.

### 4.9 Vista Semana (`.mat`)

Una fila por hábito: `button.mat-n` (punto de 6, nombre `700 12px`, abre el hábito con «‹ Semana») y sus 7 celdas de 20 con separación 6. Arriba, la fila de rótulos: «HÁBITO» y «L M M J V S D» con el número del día debajo (`500 9px/1 var(--m)`; hoy en `--ambar` 600). Una franja `--brasa` (`rgba(242,182,50,.055)`, token nuevo) de 26 de ancho recorre toda la columna de hoy, de los rótulos a la última fila. Debajo, la leyenda (celdas de 12: hecho, en parte, no se hizo, no toca, por venir) y la pista «Tocá un día que ya pasó para corregirlo.».

### 4.10 El hábito abierto (`.det.frm`)

Entra en el lugar de la vista. «‹ Hoy» o «‹ Semana» (`.lnk.atras`). Después:

1. **Nombre:** punto de 8 de su color + `textarea.tit-in` de una línea (el de Tareas: `800 16px/1.25`, Enter confirma, vacío vuelve al nombre anterior).
2. **Racha grande** (`.racha-g`): caja de borde `--linea`, radio `--r-cuadro`, fondo `--s1` con una luz ámbar al 15 % detrás de la brasa. La brasa de 22 × 27 (con el color y el brillo de 4.7), el número `800 34px/1`, −.05em, y al lado «{días|semanas} seguidos» (`700 12px` `--crema2`) con «la mejor: {m} · desde el {d/m}» (`--t-mono-s` `--tenue`) debajo. Sin racha: «sin racha todavía».
3. **Últimas 5 semanas** (`h3.sub`): 5 filas de 7 celdas de 14 con separación 5, con los rótulos L…D arriba. `role="img"` con el nombre «Últimas 5 semanas de {nombre}: {k} días hechos».
4. **Configuración:** los campos de 4.11 (sin el nombre, que va arriba). Cada cambio se guarda al instante.
5. **Pie:** «Creado el {d/m}» (`.cifras`) y «Borrar hábito» (`.lnk.peligro` → 4.12).

### 4.11 Formulario (crear y editar)

`div.frm` con `data-form="nuevo" | <id>`, separación 10. Crear lleva arriba el `.campo` del nombre (placeholder «Caminar, tomar agua, leer…», `kbd` «Enter» con foco). Después, `.det-g` (grilla `62px / 1fr`, filetes arriba y abajo):

| Rótulo | Control |
|---|---|
| **Tipo** | `role="radiogroup"` de `.fc` (de 30, píldora; elegido crema con texto `--tinta`): «Todos los días» · «Cantidad» · «Algunos días» · «Por semana» |
| **Meta** (cantidad) | `.paso` (− número +; de 1 a 99, cifras tabulares, `aria-live="polite"`) + `.campo.mini` de 92 con la unidad (placeholder «vasos», hasta 16 caracteres) + «por día» |
| **Días** (algunos días) | siete botones de 30 × 30, radio 9, «L M M J V S D», `aria-pressed`, nombre con el día entero («lunes»). Elegidos: crema con texto `--tinta` |
| **Veces** (por semana) | `.paso` de 1 a 6 + «por semana» |
| **Aviso** | `button.sw[role=switch]` de 36 × 22 (prendido: `--ambar` con la perilla `--negro`) + `input type=time` (`.fecha-in`, `aria-label` «Hora del aviso») + «globo + Windows» (`.cifras`). Con los avisos de Windows apagados en Configuración: «solo globo · Windows apagado en Configuración». Apagado: «sin aviso» |
| **Color** | `role="radiogroup"` de seis círculos de 28 con un punto de 14 (`celeste`, `verde`, `rosa`, `violeta`, `ambar`, `rojo`); elegido: anillo interior de 1,5 de su color |

Debajo, `p.frase` (fondo `--s2`, radio `--r-campo`, `--t-mono-s`): «**{nombre}** · {tipo en palabras} · {aviso}», que se actualiza al escribir (5.1). Después, el error si hay (`p.e-form[role=alert]`, punto y texto `--rojo`, `--t-chico`). Crear termina con «Crear hábito» (`.btn`) y «Cancelar» (`.lnk`). Enter en el nombre crea.

El primer hábito nuevo toma el siguiente color de la rueda (`colorSiguiente`, como las listas). Un hábito nuevo viene en «Todos los días», meta 8 «vasos», días lun, mié y vie, 3 veces por semana y sin aviso (al prender el aviso: 09:00).

### 4.12 Confirmar en el mismo botón

El `.armado` de siempre (3 s, `aria-live=polite`). «Borrar hábito» → **«¿Borrar con su racha de {n} {días|semanas}? Sí»**; sin racha, «¿Borrar? Sí». Borrar se lleva el archivo con todo su registro. Esc, 3 s sin clic o un clic en otra cosa lo desarman.

### 4.13 Mascota junto al título (`.hab-mini`)

Avi de 40 de la mascota elegida, pose `esperando`. Al marcar algo pasa a `feliz` 1,5 s y salta 6 px.

### 4.14 Píldora de hito (`.hito`)

Al llegar a 7, 30 o 100: una píldora ámbar (`800 12px/1`, texto `--negro`, brasa de 11 × 13, sombra `0 12px 30px -8px rgba(242,182,50,.6)`) aparece centrada arriba de la columna, 2,2 s, y se va. Es `aria-hidden`; el texto va al anuncio.

## 5. Contenido (textos exactos)

### 5.1 Hoja

| Lugar | Texto |
|---|---|
| Encabezado | `h1` «Hábitos» · bajada «{día} {d}/{m} · {h} de {t} hechos hoy»; completo: «{día} {d}/{m} · día completo»; ninguno toca: «{día} {d}/{m} · hoy no toca ninguno»; sin hábitos: «Se guardan en esta PC» |
| Índice | «Hoy» · «Semana» · rótulo «Hábitos» · «Nuevo hábito» |
| Rótulo del tipo (fila) | «todos los días» · «{v} de {meta} {unidad}» · «{lun, mié y vie}» · hoy no toca: «hoy no toca · vuelve el {día}» · «{k} de {veces} esta semana» · cumplida: «semana cumplida · {k} de {veces} esta semana» |
| Racha | «{n} día» / «{n} días» · «{n} semana» / «{n} semanas» · «sin racha» |
| Hoy | «Hoy no toca» (rótulo) |
| Semana | «Hábito» (rótulo) · «Tocá un día que ya pasó para corregirlo.» · leyenda «hecho» · «en parte» · «no se hizo» · «no toca» · «por venir» |
| Hábito abierto | «‹ Hoy» / «‹ Semana» · «{días\|semanas} seguidos» (semanas: «seguidas») · «sin racha todavía» · «la mejor: {m} · desde el {d/m}» · «Últimas 5 semanas» · «Creado el {d/m}» · «Borrar hábito» |
| Formulario | «Nuevo hábito» (h2) · «Caminar, tomar agua, leer…» · rótulos «Tipo», «Meta», «Días», «Veces», «Aviso», «Color» · «Todos los días», «Cantidad», «Algunos días», «Por semana» · «por día» · «por semana» · «globo + Windows» · «sin aviso» · «solo globo · Windows apagado en Configuración» · «Crear hábito» · «Cancelar» |
| Frase del formulario | «**{nombre}** · todos los días · te aviso a las 16:00» · «… · {meta} {unidad} por día · …» · «… · lun, mié y vie · …» · «… · {n} veces por semana, cualquier día · …» · sin aviso: «… · sin aviso». Sin nombre: «Tu hábito» |
| Errores del formulario | «Ponele un nombre.» · «Ya hay un hábito «{nombre}».» · «Elegí al menos un día.» (crear) · «Tiene que quedar al menos un día.» (editar) |
| Hito | 7 días: «{nombre}: ¡una semana seguida!» · los demás: «{nombre}: ¡{n} días seguidos!» · semanas: «{nombre}: ¡{n} semanas seguidas!» |

Días de la semana: «lun mar mié jue vie sáb dom»; letras «L M M J V S D»; enteros «lunes martes miércoles jueves viernes sábado domingo».

### 5.2 Vacíos y errores

| Estado | Texto |
|---|---|
| Primer uso (sin hábitos) | Avi de 96 `saluda` · «Armá tu primer hábito» · «Algo chico que quieras hacer seguido. Queda en esta PC y, si querés, te aviso a la hora que elijas.» · sugeridas «Tomar agua · 8 vasos», «Caminar · todos los días», «Gimnasio · lun, mié, vie», «Correr · 3 por semana» · «+ Otro hábito…» |
| Hoy no toca nada | Avi de 66 `esperando` · «Hoy no toca nada.» · «Mañana: {nombres}.» |
| Archivo roto (S6) | «Un hábito no se pudo leer.» · «El archivo quedó como estaba, en la carpeta de hábitos. Los demás andan.» · «Abrir la carpeta» · «Volver a leer» |
| Error al guardar | «No se guardó el último cambio.» · «Sigue en pantalla. Reintento solo en 5 s.» · «Reintentar ahora» |
| Carpeta ilegible | «No se pudo abrir la carpeta de hábitos.» · «{detalle corto}» · «Volver a leer» |

### 5.3 Anuncios (`role=status`)

«Hecho hoy: {nombre}» · «{nombre} vuelve a pendiente» · «{nombre}: {v} de {meta} {unidad}» (+ «. Meta del día cumplida» al llegar) · «Día completo: hiciste los {t} de hoy.» · el texto del hito · «Corregido: {nombre}, {día entero} hecho|sin hacer» · «Hábito «{nombre}» creado» (desde una sugerida: «Hábito «{nombre}» creado. Tocá su nombre para ponerle un aviso.») · «Borraste «{nombre}»» · «No se guardó el último cambio».

### 5.4 Globos

| Globo | Marca | Muesca | Fila de la dividida |
|---|---|---|---|
| Recordatorio, cantidad | «**16:00** · {nombre}: van **{v} de {meta} {unidad}**. ¿Uno más?» · «+1 {unidad en singular}» · «Ver hábitos →» | «16:00 · {nombre} {v} de {meta}» + anillo de 14 · «Ver →» | «16:00 · {nombre}: {v} de {meta}.» · «+1» · «Ver →» |
| Recordatorio, sí/no o algunos días | «**19:00** · Te toca **{nombre}**.» · «Hecho» · «Ver hábitos →» | «19:00 · {nombre}» · «Ver →» | «19:00 · Te toca {nombre}.» · «Hecho» · «Ver →» |
| Recordatorio, por semana | «**18:00** · Te toca **{nombre}**: llevás {k} de {veces} esta semana.» · «Hecho» · «Ver hábitos →» | igual que sí/no | igual que sí/no |
| Hecho desde el globo | cantidad: «Listo: **{v} de {meta} {unidad}**.» (+ « ¡Meta del día!»); sí/no: «¡Hecho! **{nombre}**: {n} {días\|semanas} {seguidos\|seguidas}.» | — | — |
| Resumen semanal | kicker «TU SEMANA · {d/m} AL {d/m}» · la frase (8.4) · las 7 barras · «Charlemos la semana →» | «Tu semana: {frase corta}» · «Ver →» | «Tu semana: {frase corta}» · «Charlemos →» |
| × | recordatorio: `aria-label` «Ahora no: no te recuerdo {nombre} hasta mañana», `title` «Ahora no» · resumen: «Más tarde: lo dejo para la semana que viene», `title` «Más tarde» | — | — |

«{frase corta}»: la primera parte de la frase, hasta 34 caracteres sin cortar palabras. Si no entra, la del hábito con mejor cumplimiento: «{nombre} {k} de {t}».

Anuncio al aparecer: «{nombre de la mascota}: {texto del globo}».

### 5.5 Notificación de Windows

Título «{nombre} · {HH:MM}». Cuerpo: cantidad «Van {v} de {meta} {unidad}. ¿Uno más?»; sí/no y algunos días «Te toca {nombre}.»; por semana «Llevás {k} de {veces} esta semana.». Sin botones.

## 6. Sistema visual

Sin fuentes ni colores nuevos: Manrope y Martian Mono, y los tokens de `estilos.css`. Tokens nuevos, de medida o de mezcla:

| Token | Valor | Uso |
|---|---|---|
| `--cel` | `16px` (cada vista lo pisa) | lado de una celda |
| `--brasa` | `rgba(242,182,50,.055)` | franja de la columna de hoy |

Se reusan: `.ck`, `.fila`, `.idx`, `.ix-b`, `.pane-h`, `.pane-s`, `.prog`, `.fc`, `.campo`, `.lnk`, `.btn`, `.armado`, `.err`, `.vac`, `.primer`, `.tit-in`, `.fecha-in`, `.globo-tar` (base del globo de la marca, 8.5), `--pico`, `--ambar`, `--ambar-osc`. Todo el CSS nuevo va bajo `#hab` (o `.mod#hab-fila`, `.globo-hab`). `.sub`, `.chip`, `.err` y `.racha` pueden existir en otros lugares: no se pisan.

### 6.1 Colores de hábito

Como las listas (`tareas-ux.md` 6.1): se guarda el **nombre** del token (`celeste`, `verde`, `rosa`, `violeta`, `ambar`, `rojo`). El color del hábito solo pinta su punto, el borde del control al pasar, las chispas y la gota; nunca lleva texto. **Hecho siempre es `--ambar`**, sea cual sea el color del hábito.

### 6.2 Contraste (sobre los tokens)

| Par | Relación | Uso |
|---|---|---|
| `--crema` / `--negro` y `--s1` | 17,7 / 16,5:1 | nombres |
| `--tenue` / `--negro`, `--s1` | 5,65 / 5,26:1 | meta, rótulos, racha 0 |
| `--pico` / `--negro` | ≈ 9,6:1 | racha 1–6 |
| `--ambar` / `--negro` y `--ambar-osc` | 11,5 / 9,8:1 | racha 7+, «¡Día completo!», índice elegido |
| `--negro` / `--ambar` | 11,5:1 | «+» del sumador, visto, `.hito` |
| `--ambar` sobre `--negro` como gráfico (celda hecha, tramo del anillo) | 11,5:1 | ≥ 3:1 que piden los gráficos |
| `--linea-hover` sobre `--negro` (anillo de celda que no se hizo) | ≈ 1,8:1 | **no alcanza 3:1 solo:** el estado también va en el nombre de la celda y en la vista en palabras de la fila (D-h11) |
| `--tinta` / `--crema` | ≈ 16:1 | texto de los globos |
| `#5c554a` / `--crema` | ≈ 6,2:1 | kicker del resumen, letras de las barras, × |
| `--ambar-tinta` / `--crema` | 5,3:1 | «Ver hábitos →», «Charlemos la semana →» |
| `--tinta` (barras) / `--crema` | ≈ 16:1 | barras del resumen |

Color nunca solo: hecho lleva el visto y su nombre accesible; la racha lleva el número; «no toca» lleva el guion y su nombre.

## 7. Estados de la pantalla

### 7.1 Cargando
El encabezado y el índice (Hoy y Semana, sin cuenta) al instante. Si leer tarda más de 150 ms, tres filas fantasma de 44 (fondo `--s1`, sin brillo animado). Nunca un spinner.

### 7.2 Primer uso (sin hábitos)
En lugar de `.carpeta`, la tarjeta `.primer` de 5.2. Una sugerida crea ese hábito (con su tipo y su meta, sin aviso) y abre Hoy con la fila destellando. «+ Otro hábito…» abre el formulario.

### 7.3 Vacíos
«Hoy no toca nada» (5.2) en el panel de Hoy. La Semana sin hábitos no existe (sin hábitos se ve el primer uso).

### 7.4 Error al guardar
El de Tareas (`tareas-ux.md` 7.4): arriba del panel, lo hecho no se deshace, reintenta solo a los 5 s; `widget.log` «hábitos: no se guardó {id}: {error}».

### 7.5 Borrado armado
4.12.

### 7.6 Archivo roto (S6)
Como Tareas (`tareas-ux.md` 7.6): se saltea, nunca se pisa ni se borra, se anota; fila `.ix-b.rota` con el nombre del archivo; su clic muestra el `.err` de 5.2. No cuenta para Hoy, ni para la fila del menú, ni para los avisos.

### 7.7 Cambio de día (medianoche de Argentina)
En la primera pintada con otro `hoyArgentina`: Hoy se recalcula, los recordatorios del día anterior que quedaron se van (8.3), la racha se recalcula (un día que tocaba y no se hizo ahora sí la corta) y, si es lunes, la semana empieza vacía.

## 8. Globos, recordatorios y resumen

### 8.1 Uno por vez (la cola)

Hay **un solo globo a la vista**. Los avisos pendientes forman una cola, ordenada por prioridad y, a igual prioridad, por llegada:

1. **Pregunta de Claude** (no es un globo: tiene sus caminos, `modulos-ux.md` 4.6). **Mientras haya una pregunta pendiente, ningún globo se ve** (en la marca, la dividida ni la muesca). Esperan y vuelven después.
2. **Recordatorio de un hábito** (8.3). Si hay dos a la vez, el de hora más temprana primero.
3. **Aviso diario de Tareas** (el de hoy: `evaluarAviso`, `verAviso`, `soltarAviso`).
4. **Resumen semanal** (8.4).

El de abajo nunca se pierde: aparece cuando el de arriba se va (clic, ×, hecho por otro camino). Si llega uno de más prioridad con otro a la vista, el que estaba se va sin acto y vuelve después, y el nuevo entra con el suyo.

**Dónde:** el mismo lugar que hoy decide `lugarAviso` (`tareas.js:171`) para todos: la marca (panel con barra), la fila de la dividida, el globo de la muesca (plegada); espera en la tira, la bandeja, con la charla abierta o a mitad de un arrastre. La regla «con la hoja propia abierta no hace falta» queda por tipo: el de Tareas no se ve con Tareas abierto (como hoy); el recordatorio sí se ve con Hábitos abierto (es de una hora puntual, y desde el globo se puede marcar); el resumen tampoco se ve con Hábitos abierto.

### 8.2 Contrato de la cola (`widget/src/globos.js`, puro)

```js
// Un aviso: { tipo: 'rec' | 'tareas' | 'resumen', clave, prioridad, orden, ...datos }
encolar(cola, aviso)           // agrega si no está (por clave), ordena por prioridad y orden
quitar(cola, clave)            // saca uno
actual(cola, forma)            // { aviso, lugar } | null — forma: la de lugarAviso más { pregunta, hojaAbierta: modulo }
```

`lugarAviso` de `tareas.js` se divide: la parte de «dónde» pasa a `lugarGlobo(forma)` en `globos.js` (sin `cuentas` ni `hoja`, que deciden si el aviso está en la cola); `lugarAviso` queda como envoltura y sus tests siguen pasando. `pintarAvisoTareas` (`main.js:4256`) pasa a `pintarGlobos`, que dibuja `actual(...)` con su vista:

| Tipo | Marca | Dividida | Muesca |
|---|---|---|---|
| `tareas` | `.globo-tar` de hoy (`globoMarca`) | `filaAviso` | `globoMuesca` en `#muesca-tareas` |
| `rec`, `resumen` | `.globo-hab` (nuevo; la base de `.globo-tar`) | la fila de 8.4 de `tareas-ux.md` con su acción | el mismo `#muesca-tareas` (se renombra `#muesca-globo`, con su `aria-label`) |

`verAviso` (guardar `tareasAvisado` la primera vez que se ve) sigue siendo solo de Tareas. Recordatorio y resumen guardan lo suyo (8.3, 8.4). El Avi de la marca: `saluda` con un recordatorio o con Tareas; `contando` con el resumen; `feliz` mientras confirma «Hecho».

### 8.3 Recordatorio (S4)

- **Cuándo se debe:** el hábito tiene `aviso: "HH:MM"`, **toca hoy**, no está hecho hoy (por semana: la semana no está cumplida y hoy no se marcó) y la hora de Argentina ya pasó `aviso`. Se revisa en el ciclo de 1,5 s (`recordatoriosDebidos(habitos, ahoraMs, recordados)`, 11.6), nunca con un temporizador por hábito.
- **Una vez por día:** `recordados` = `{ dia, ids }`, guardado en `preferencias.json` como `habitosRecordados` (`guardar_ajuste`, con su validación). Un reinicio el mismo día no lo repite.
- **Tarde:** si Avis arranca (o se despierta) después de la hora, el recordatorio sale igual, una sola vez. Si pasaron **más de 60 minutos**, sale **solo el globo**, sin notificación de Windows (para no llenar el centro de notificaciones al prender).
- **Se va:** si el hábito queda hecho por cualquier camino (la hoja, el globo); con la × («Ahora no»: por hoy); con «Ver hábitos →»; a la medianoche (7.7). No se va solo con el tiempo.
- **Desde el globo:** «+1 {unidad}» o «Hecho» marcan sin abrir nada. El globo confirma con el texto de 5.4 durante **1,8 s** y se va solo. Si ese «+1» no llega a la meta, igual se va (ya respondiste).
- **Notificación de Windows:** a la vez que el globo, con el comando `avisar` que ya existe (`lib.rs:1336`) y los textos de 5.5. Respeta el interruptor **«Avisar»** de Configuración (`st.avisar`): apagado, solo globo. No depende de que la ventana esté a la vista (a diferencia de las preguntas, que solo notifican fuera de la vista). Su clic: hoy `on_action` muestra la ventana (`lib.rs:1759`); se le suma ir a Hábitos › Hoy. Ver 11.9.
- **Nada se abre solo:** ni el panel, ni la hoja, ni la ventana.

### 8.4 Resumen semanal (S5)

- **Cuándo:** el **domingo desde las 18:00** de Argentina, la primera vez que la mascota está a la vista, con el resumen de **esa** semana (lunes a domingo). Si ese domingo Avis no estuvo, el **primer arranque de la semana siguiente** (cualquier día) muestra el de la semana anterior. Nunca uno más viejo. Se guarda en `preferencias.json` como `habitosResumen: "AAAA-MM-DD"` (el lunes de la semana resumida) **cuando se ve por primera vez**; no se repite.
- **Si hay de qué hablar:** al menos un hábito que existía antes del domingo de esa semana y que tocaba algún día de ella. Si no, no hay resumen.
- **Los números salen de los datos** (`resumenSemana(habitos, lunes)`, 11.6): por hábito, `{ nombre, tipo, hechos, tocaban }` (cantidad: días con la meta; por semana: veces sobre `veces`); por día, la fracción de lo que tocaba que se hizo (las 7 barras). Las barras van en `--tinta` sobre el crema del globo, alto `26 × fracción` (mínimo 3), con la letra del día debajo.
- **La frase la escribe el modelo local** (Qwen3-4B de `modelo.rs`), con el comando nuevo `habitos_frase` (11.7):
  - **Solo si el modelo está instalado** (`estado_modelo` = listo). Nunca lo descarga: la única salida a la red sigue siendo la descarga con un clic.
  - Una vez por semana, como mucho; tope de 60 tokens y **45 s**. Si el motor estaba apagado, se prende como para una charla (`motor_charla`) y se apaga solo a los 10 min, como siempre.
  - La instrucción (fija, en Rust): «Escribí una o dos oraciones en español rioplatense, de hasta 160 caracteres, que resuman esta semana de hábitos. Usá solo estos datos. No inventes números ni des consejos médicos. Empezá por lo que salió mejor.» + una línea por hábito con sus números.
  - **Se valida:** una sola línea, de 1 a 160 caracteres, y **todo número de la frase tiene que estar en los datos**. Si no, se usa la plantilla.
  - **Plantilla** (sin modelo, si tarda o si no pasa la validación): «Esta semana: {nombre} {hechos} de {tocaban} días · …», con hasta 3 hábitos ordenados por cumplimiento. Cantidad: «{nombre} {k} de {t} días con la meta». Por semana: «{nombre} {k} de {veces} veces».
  - Mientras se escribe la frase, el globo espera (es el último de la cola): no hay un estado «escribiendo» a la vista.
- **El clic** («Charlemos la semana →») abre la **hoja de la charla** (`#hoja`) con una **charla nueva del motor local**, sea cual sea la preferencia (decisión de Quintana del 24/11; la preferencia no cambia). La charla empieza con un mensaje de la mascota (`rol: "mascota"`): la frase y una lista con los números de cada hábito. Título «Tu semana · {d/m} al {d/m}». Si el modelo no está instalado, la charla muestra el aviso que ya existe para el motor local sin modelo (`sinModelo` de `chat.js`), con su «Descargar» que solo baja con el clic. La charla no cambia hábitos (otra entrega).
- **La ×** («Más tarde»): no vuelve hasta la semana siguiente.

### 8.5 El globo de la marca para Hábitos (`.globo-hab`)

La base de `.globo-tar` (`tareas-ux.md` 8.3: ancho de la barra, crema, cola de 12 hacia el Avi, sombra y halo ámbar), con dos filas: arriba el texto (`600 12px/1.35`, números en 800) y la × de 28 × 28 (`#5c554a`, al pasar `--tinta` sobre `rgba(20,17,12,.06)`); abajo las acciones: `button.g-hacer` (alto 28, píldora `--tinta` con texto `--crema` `800 11.5px/1`, el punto de 6 del color del hábito delante) y `button.g-ver` (`600 10px/1 var(--m)` `--ambar-tinta`, subrayado al pasar). El resumen: kicker `600 9px/1 var(--m)`, .12em, mayúsculas `#5c554a`; el cuerpo es un solo `button.globo-res` (frase, barras y «Charlemos la semana →»). Foco: contorno `--tinta`. Hecho: un visto ámbar en un círculo `--tinta` de 16 delante del texto.

## 9. Teclado y foco

### 9.1 Esc, por capas (una por vez)

1. Un campo de texto con algo escrito y sin guardar (el nombre de un hábito nuevo): lo vacía.
2. Un «¿Borrar…? Sí» armado: lo desarma; el foco queda en el botón.
3. El formulario de un hábito nuevo: lo cancela; el foco va a «Nuevo hábito».
4. Un hábito abierto: vuelve a la vista de la que vino; el foco va a su nombre en la lista (o a su fila en Semana).
5. El módulo: va a Sesiones (`modulos-ux.md` 9.1).

Con el foco en un globo de recordatorio o de resumen, Esc es su ×. Lógica pura: `alEscHabitos(estado, foco)`.

### 9.2 Atajos

**Ctrl H**, solo Ctrl (`esAtajoHabitos`): abre el módulo; si ya está abierto, el foco va al `h1`. Anda también mientras se escribe en un campo.

### 9.3 Orden de tabulación

Encabezado → `#aviso-p` → índice (Hoy, Semana, cada hábito, filas rotas, Nuevo hábito) → panel. En Hoy: por fila, control, «−1» (si hay), nombre. En Semana: por fila, nombre y las celdas que se pueden tocar. En el hábito: «‹», nombre, Tipo (un solo tope, foco itinerante con flechas), Meta/Días/Veces, Aviso y hora, Color (foco itinerante), Borrar hábito.

### 9.4 Dónde va el foco

- Abrir el módulo → `h1`. Cambiar de vista → se queda en el botón del índice.
- Tildar o sumar → se queda en el mismo control (las filas no se mueven).
- Abrir un hábito → su nombre. Volver → su nombre en la lista.
- Crear → el nombre del hábito nuevo en Hoy. Borrar → «Hoy» en el índice.
- Clic en «+1» o «Hecho» del globo → la × del globo; cuando el globo se va, el siguiente globo o, si no hay, `#hab-fila`.

## 10. Movimiento

anime.js v4, módulo **`habitosMotion.js`**; CSS para el tilde, las celdas y los hover. Todo bajo `prefers-reduced-motion: no-preference` y `body:not(.pausa)`. Solo `transform` y `opacity`, salvo el ancho de la barra de avance.

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Abrir el módulo | El de Tareas: encabezado y carpeta suben 8 px, escalonados 55 ms; índice y filas 10 px, escalonados 32 ms desde 140 | 420 / 460 ms `outQuart` |
| Cambiar de vista, abrir un hábito | Entran 10 px desde la derecha, escalonados 28 ms | 300 ms `outQuart` |
| **Tildar** | (CSS) el círculo baja a .72 y rebota mientras se llena de ámbar; el visto se dibuja desde 80 ms; la celda de hoy en Semana salta de .35 a 1. (anime) ocho chispas a 17 y 24 px, alternando el color del hábito y `--ambar`, `scale 1.2 → .3`; la mascota feliz salta 6 px | círculo 420 ms `--rebote`; visto 260 ms `--ease`; celda 550 ms `--rebote`; chispas 600 ms `outQuart`; salto 420 ms `outQuad` |
| **Sumar un vaso** | (anime) una gota del color del hábito cae desde 22 px arriba (34 en las grandes) al centro del anillo, `scaleY 1.3 → .7`, y deja una onda que se abre de .35 a 1.4; (CSS) el tramo nuevo entra con `stroke-width 0 → 6 → 3` y el número rueda 7 px hacia arriba | gota 340 ms `inQuad`; onda 520 ms `outQuart` desde 300 ms; tramo 500 ms `--rebote`; número 360 ms `--ease` |
| **Llegar a la meta** | Además: una onda ámbar sale del anillo (`box-shadow` 0 → 14 px) y saltan las chispas | 900 ms `--ease` |
| **La racha crece** | El número rueda; la brasa salta a 1.55 y vuelve | 420 ms / 620 ms `--rebote` |
| **Hito** (7, 30, 100) | La píldora `.hito` entra 12 px desde arriba con `scale .8 → 1`, queda 2,2 s y se va 6 px hacia arriba | entra 560 ms `outBack(1.8)`; sale 300 ms `inQuad` |
| **Día completo** | En Semana, la franja de hoy se enciende al 34 % y se apaga, fila por fila, escalonada 70 ms; la barra de Hoy destella; la mascota festeja | 1,1 s `--ease`; destello 1 s |
| Corregir un día | La celda salta de .35 a 1 | 550 ms `--rebote` |
| Globo (entra) | `translateY(-8px) scale(.82)` → en su lugar, con rebote desde la cola | 560 ms `--rebote` |
| Globo (sale) | `scale .9` y se apaga | 200 ms `inQuad` |
| Barras del resumen | Crecen desde abajo (`scaleY 0 → 1`), escalonadas 45 ms desde 260 | 600 ms `--ease` |
| Fila del menú | El arco se vuelve a dibujar al pasar; el anillo late al cambiar | 700 ms `--ease`; 500 ms `--rebote` |
| Confirmar | La línea del botón se vacía | 3 s lineal (CSS) |

**Movimiento reducido:** sin desplazamientos, escalas, chispas, gotas ni ondas; la hoja, el cambio de vista, el hábito abierto, los globos y la píldora de hito aparecen con un fundido de opacidad de 160 ms; el tilde, el tramo del anillo, el número y las celdas cambian al instante; la brasa de 30+ no titila; las barras del resumen aparecen enteras. **Pausa:** como reducido, sin fundidos.

## 11. Contrato para el implementador

### 11.1 Archivos en disco (S6)

**Un archivo por hábito** en `<config>/habitos/<id>.json` (la carpeta de configuración de la app, junto a `tareas/`). Por qué uno por hábito y no uno solo: (1) un archivo roto se lleva un hábito, no todos (S6); (2) cada tilde reescribe un archivo chico, no el registro de todos; (3) es el mismo modelo que las listas, así `habitos.rs` copia `tareas.rs` casi línea por línea (validar, conservar lo desconocido, `atomico::escribir`, candado, `rotas`).

**Formato v1:**

```json
{
  "v": 1,
  "id": "h-…",                       // ^h-[a-z0-9-]{1,38}$ (id_con("h-", …))
  "nombre": "Agua",                  // 1–40 caracteres, sin espacios a los lados
  "tipo": "diario" | "cantidad" | "dias" | "semana",
  "meta": 8,                         // 1–99; solo se usa en cantidad (se guarda siempre)
  "unidad": "vasos",                 // 0–16 caracteres; solo cantidad
  "dias": [0, 2, 4],                 // lunes = 0 … domingo = 6, sin repetir, ordenados; solo dias (al menos 1)
  "veces": 3,                        // 1–6; solo semana
  "aviso": "16:00" | null,           // HH:MM de 00:00 a 23:59
  "color": "celeste",                // uno de los 6 tokens; otro valor se lee como el primero
  "orden": 0,
  "creado": 1764100000000,           // ms
  "inicio": "2026-11-02",            // día de Argentina de la creación; los días anteriores no cuentan
  "mejor": 21,                       // la mejor racha vista (sobrevive al recorte del registro)
  "registro": { "2026-11-23": 8, "2026-11-24": 6 }  // día de Argentina → n (sí/no: 1); solo n > 0
}
```

- **Rust guarda solo el formato** (`normalizar`): las claves que no son del formato y manda la ventana no se escriben; las que ya estaban en el archivo (de una versión futura) se conservan (`conservar`, como `tareas.rs`).
- **Topes:** nombre 40 y unidad 16 (recortan y se anota); `registro` hasta 2000 días (se recortan los más viejos y se anota; `mejor` no baja); `n` hasta 999; más de 2000 entradas o una fecha inválida: el documento no sirve y se rechaza sin tocar el archivo.
- **Escritura atómica** con `crate::atomico::escribir`, de a una por vez (candado propio del módulo, como `tareas::ESCRITURA`).
- **Archivo roto:** se informa en `rotas` (`{ archivo, motivo }`), se anota en `widget.log` («hábitos: {archivo}: {motivo}») y **nunca se pisa ni se borra** (`guardar` y `borrar` lo leen antes y se niegan).
- **Cambiar el tipo** (la ventana, al guardar): a cantidad, cada día con 1 pasa a `meta`; de cantidad a otro tipo, cada día con `n ≥ meta` pasa a 1 y los demás se borran. **Cambiar la meta no reescribe el registro:** los días pasados se juzgan con la meta actual (D-h8).

### 11.2 Día y semana de Argentina

`widget/src/fechas.js` (`hoyArgentina`, `diasEntre`, `sumarDias`, `diaArgentina`). Se suman, puras y con tests:

- `diaSemana(dia)` → 0 (lunes) … 6 (domingo). Con el número de día de `fechas.js`: `(n + 3) % 7` (el 1/1/1970 fue jueves).
- `lunesDe(dia)` → `sumarDias(dia, -diaSemana(dia))`.
- `horaArgentina(ms)` → `"HH:MM"` (hoy existe como `horaGlobo` en `tareas.js`: se mueve a `fechas.js` y `tareas.js` la reexporta).

### 11.3 Reglas de cada tipo

| Función | diario | cantidad | dias | semana |
|---|---|---|---|---|
| `toca(h, dia)` | sí | sí | `diaSemana(dia) ∈ dias` | sí |
| `hecho(h, dia)` | `registro[dia] ≥ 1` | `registro[dia] ≥ meta` | `registro[dia] ≥ 1` | `registro[dia] ≥ 1` (cuenta para la semana) |
| `deHoy(h)` (va en Hoy) | sí | sí | si toca hoy | si la semana no está cumplida, o si ya se marcó hoy |

Un día anterior a `inicio` no cuenta nunca: ni hecho ni falta.

### 11.4 Racha

- **diario, cantidad, dias** (en días): desde **ayer** hacia atrás, saltando los días que no tocan y los anteriores a `inicio`: se cuentan los hechos seguidos hasta el primero que tocaba y no se hizo. Al resultado se le suma 1 si **hoy** toca y ya está hecho. Hoy sin hacer **no corta** (el día no terminó).
- **semana** (en semanas): semanas de lunes a domingo. Desde la semana pasada hacia atrás, se cuentan las semanas seguidas con `hechos ≥ veces`, hasta la primera que no llegó. La semana de `inicio` cuenta si llegó y **no corta** si no llegó (empezó a mitad). Se le suma 1 si **esta** semana ya llegó. Esta semana sin llegar no corta.
- **`mejor`** = el máximo entre el guardado y la racha más larga que se calcula sobre el registro. Si la racha actual lo supera, la ventana guarda el nuevo `mejor`.
- **Hitos:** cuando la racha pasa a 7, 30 o 100 con una marca de hoy (no al leer).
- `pctSemana(habitos, lunes, hoy)`: lo hecho sobre lo que tocaba, de lunes hasta hoy (hoy cuenta solo si está hecho); por semana suma `min(hechos, veces)` sobre `veces`.

### 11.5 Comandos de Rust (`habitos.rs`, registrados en `lib.rs` junto a los de Tareas)

| Comando | Qué hace |
|---|---|
| `habitos_leer()` | `{ habitos: [...], rotas: [...] }`, ordenados por `orden`, `creado` e id. Si la carpeta no se puede listar: error («No se pudo abrir la carpeta de hábitos.»), como `tareas_leer` |
| `habitos_guardar(habito)` | Normaliza, conserva lo desconocido, escribe atómico, devuelve lo guardado. Archivo roto: error, no se pisa |
| `habitos_borrar(id)` | Borra el archivo (lo que no existe no es error; un archivo roto no se borra) |
| `habitos_abrir_carpeta()` | Abre `<config>/habitos/` en el Explorador |
| `habitos_frase(datos)` | 8.4: `{ frase }` o error (la ventana usa la plantilla). Si el modelo no está instalado, error sin prender nada |
| `guardar_ajuste` | Suma dos claves a `AJUSTES` (`preferencias.rs:128`): `habitosRecordados` (`{ dia, ids: [id…] }`, `dia` válido, ids de hábito válidos, hasta 100) y `habitosResumen` (un día válido que sea lunes, o vacío). `escribir` conserva lo demás de `preferencias.json` |
| `avisar` | Ya existe: título y cuerpo de 5.5 |

### 11.6 Lógica pura y casos de prueba

**`widget/src/habitos.js`** (con `widget/test/habitos.test.js`), un test por regla, todos por la interfaz pública:

| Función | Casos que tiene que cubrir |
|---|---|
| `toca`, `hecho`, `deHoy` | los cuatro tipos; un día de `dias` que no toca; por semana cumplida y sin marcar hoy → no va en Hoy; marcada hoy → va |
| `racha(h, hoy)` | diario: 6 seguidos + hoy hecho = 7; hoy sin hacer no corta; ayer sin hacer corta. cantidad: un día con 6 de 8 corta. dias: un martes que no toca no corta. semana: 4 semanas + esta cumplida = 5; esta sin cumplir no corta; la semana de `inicio` sin cumplir no corta. Días antes de `inicio` no cortan |
| `mejorRacha(h, hoy)` | nunca menor que `mejor` guardado |
| `estadoCelda(h, dia, hoy)` | los ocho estados de 4.8 |
| `pctSemana` | hoy sin hacer no cuenta; por semana con tope en `veces` |
| `cambiarTipo(h, tipo)` | 1 → `meta`; `n ≥ meta` → 1; menos de la meta se borra |
| `validarHabito(borrador, habitos)` | los cuatro errores de 5.1; el mismo nombre con otras mayúsculas es repetido |
| `fraseFormulario(h)` | las cuatro formas de 5.1, con y sin aviso, sin nombre |
| `recordatoriosDebidos(habitos, ahoraMs, recordados)` | antes de la hora → nada; a la hora → el hábito; ya hecho → nada; ya recordado hoy → nada; otro día en `recordados` → vuelve; algunos días que hoy no toca → nada; por semana cumplida → nada; dos debidos → ordenados por hora; `tarde: true` con más de 60 min |
| `resumenDebido({ hoy, horaAr, guardado, habitos })` | domingo 17:59 → no; domingo 18:00 → el lunes de esta semana; lunes sin resumen del domingo → el de la semana pasada; ya guardado → no; nunca dos semanas atrás; sin hábitos que tocaran → no |
| `resumenSemana(habitos, lunes)` | números por hábito y las 7 fracciones; un hábito creado el jueves cuenta desde el jueves |
| `plantillaResumen(resumen)` | hasta 3 hábitos por cumplimiento; las formas de cantidad y por semana |
| `fraseValida(frase, resumen)` | una línea; ≤ 160; un número que no está en los datos → no |
| `textosGlobo(aviso, h)` | los textos de 5.4 y 5.5 |
| `alEscHabitos(estado, foco)` | las cinco capas de 9.1 |
| `esAtajoHabitos(e)` | Ctrl H sí; con Shift, Alt o Meta no |

**`widget/src/globos.js`** (con `widget/test/globos.test.js`): `encolar` sin repetir y en orden de prioridad; con una pregunta, `actual` → null en los tres lugares; con Tareas abierto, el de tareas no se ve y el recordatorio sí; con Hábitos abierto, el resumen no se ve; el que estaba vuelve cuando se va el de más prioridad; `lugarAviso` de `tareas.js` sigue pasando sus tests.

**`habitos_tests.rs`** (como `tareas_tests.rs`): ida y vuelta del formato; topes que recortan; registro de más de 2000 recortado sin bajar `mejor`; fecha inválida → se rechaza sin tocar el archivo; claves desconocidas del archivo se conservan y las de la ventana no se escriben; archivo roto no se pisa ni se borra y va en `rotas`; ids con `..`, barras o sin prefijo → rechazados. `habitos_frase` con un motor falso: tiempo agotado → error; sin modelo → error sin prender nada.

### 11.7 La frase (Rust)

`habitos_frase` arma la instrucción de 8.4 y pide **una** respuesta a `llama-server` por el mismo camino de `chat_local.rs` (127.0.0.1, sin proxy, sin modo de pensar), con tope de 60 tokens y 45 s. No guarda nada en el historial del chat ni en Engram. La validación de 8.4 es de la ventana (`fraseValida`), así se prueba sin modelo.

### 11.8 Archivos (sugeridos)

`widget/src/habitos.js` (puro), `widget/src/habitosVista.js`, `widget/src/habitosMotion.js`, `widget/src/globos.js` (puro), `widget/src-tauri/src/habitos.rs` + `habitos_tests.rs`, `widget/test/habitos.test.js`, `widget/test/globos.test.js`. Cambios en `index.html` (`#hab-fila` en `nav.mods`, `#hab`, `#hab-mini`), `main.js` (`irModulo('habitos')`, `pintarGlobos`, el ciclo de recordatorios y del resumen), `fechas.js` (11.2), `tareas.js` (`lugarAviso` como envoltura), `preferencias.rs`, `lib.rs`, `estilos.css` y `dev/vista.html` (`?habitos=hoy|semana|nuevo|vacio|<id>`, `&rec=agua`, `&resumen=1`, `&modelo=falta`).

### 11.9 Medir antes de construir

1. **Ctrl H en WebView2:** que llegue al `keydown` (Edge lo usa para el historial). Si no llega, vuelve a Quintana con la alternativa Ctrl Shift H.
2. **`tauri-plugin-notification` en Windows**, medido contra la app empaquetada (el `.msi`, no `tauri dev`, porque el AppUserModelID cambia): (a) que `on_action` llegue al hacer clic en la notificación de escritorio (hoy se usa en `lib.rs:1759`, sin medición registrada); (b) si se puede saber **qué** notificación se tocó (un id o un dato extra), para abrir Hábitos en lugar de solo mostrar la ventana; (c) si acepta una imagen (la cara del Avi del boceto) y botones en escritorio. Lo que no ande, no se hace: sin clic, la notificación solo avisa y el globo hace el resto; sin imagen, el ícono de la app.
3. **El modelo local para la frase:** cuánto tarda la primera frase con el motor apagado (CPU y CUDA), y que con la instrucción de 8.4 respete el tope y los números. Si tarda más de 45 s en la máquina de Quintana, queda la plantilla y se revisa el tope.
4. **Una charla que empieza con un mensaje de la mascota:** que `historial.rs` (formato v1, roles `usuario` y `mascota`) la guarde y que `historiaLocal` la mande bien al modelo local.

## 12. Accesibilidad

- Un solo `h1` (el `#titulo` del módulo). Las vistas usan `h2`; el hábito abierto lleva su `h2` oculto con el nombre. Sin saltos de nivel (`h3.sub` dentro del hábito).
- Cada control con nombre (4.5, 4.6, 4.8, 4.11). El tilde es `role=checkbox`; las celdas que se tocan, `aria-pressed`; el aviso, `role=switch`; tipo y color, `radiogroup` con foco itinerante.
- Áreas de clic: tilde 36 × 38, sumador 36 × 38, celdas de Semana 20 × 20 con 6 de separación, días del formulario 30 × 30, «−1» de 22 de alto. Es un widget de escritorio con mouse, con las medidas de Tareas.
- Foco visible: el contorno ámbar; en los globos, `--tinta`.
- Contraste: 6.2. El estado de cada celda va en su nombre, no solo en el dibujo.
- Anuncios de 5.3 en `#hab-vivo`; nunca mueven el foco.

## 13. Responsive y zoom

Es una ventana de escritorio: el marco no se reacomoda por ancho. Con zoom de 100 a 200 % todo escala junto. La vista Semana usa el ancho del panel (310 con el índice): nombre de 128 como mínimo y 7 celdas de 20; nombres largos con `…` y `title`.

## 14. Entregas

| Entrega | Qué | Riesgo | Aceptación |
|---|---|---|---|
| **H1 · Datos y hoja** | `habitos.rs`, `habitos.js` (tipos, racha, celdas), la fila del menú, la hoja con Hoy, Semana, el hábito abierto, el formulario, borrar, primer uso, vacíos y errores, y el movimiento de 10 | Risk: item 1 (formato nuevo en disco: tiene que nacer bien, porque después hay que migrarlo) | Los casos de 11.6 y `habitos_tests.rs`; un archivo roto no se toca; Playwright a 375, 768 y 1440 de `dev/vista.html?habitos=…` contra esta dirección |
| **H2 · Globos y recordatorio** | `globos.js` y `pintarGlobos` (la cola, con el de Tareas adentro), el recordatorio (globo y notificación), `habitosRecordados` | Risk: item 3 (cambia el camino del globo de Tareas, que ya está en uso; con una pregunta, el globo de Tareas pasa a esperar también en la marca) | Los tests de `lugarAviso` de Tareas siguen pasando; los de `globos.js`; probado en la app empaquetada con las mediciones de 11.9 |
| **H3 · Resumen semanal** | `resumenDebido`, `resumenSemana`, la plantilla, `habitos_frase`, la charla que abre el clic | Risk: item 5 (prende el modelo local una vez por semana, sin que lo pida un clic) | Con el modelo: la frase pasa `fraseValida`; sin modelo: la plantilla y la charla con su «Descargar»; nunca se descarga nada solo |

## 15. Decisiones

| Id | Decisión | Descartada | Quién |
|---|---|---|---|
| D-h1 | Opción B · Carpeta, como módulo sobre `modulos-ux.md` A | A · Renglón, C · Fichas | Quintana, 24/11 |
| D-h2 | Hecho es ámbar y no se tacha; el color del hábito solo pinta punto, borde y chispas | hecho del color del hábito | Quintana, 24/11 (aprobó el boceto) |
| D-h3 | Semana de lunes a domingo | los últimos 7 días | Quintana, 24/11 |
| D-h4 | Se corrigen los días pasados de esta semana (sí/no, algunos días, por semana); la cantidad de un día pasado no | corregir todo, o nada | Quintana, 24/11 |
| D-h5 | Un globo por vez: pregunta › recordatorio › tareas › resumen | globos en paralelo | Quintana, 24/11 |
| D-h6 | Recordatorio: globo y notificación sin botones; se va hecho, con × o a la medianoche | posponer 30 min | Quintana, 24/11 |
| D-h7 | Resumen: domingo desde las 18 o el primer arranque de la semana siguiente; números de los datos, frase del modelo; **la charla siempre con el modelo local** | números del modelo; la charla con el motor de la preferencia | Quintana, 24/11 |
| D-h8 | Rachas por tipo (días, días que tocan, semanas); hitos 7, 30 y 100; los días pasados se juzgan con la meta actual | una sola racha en días; guardar la meta de cada día | Quintana aprobó las rachas por tipo el 24/11; la meta actual es de Delfina |
| D-h9 | Ctrl H | Ctrl 1–4 | Quintana, 24/11 (medir: 11.9) |
| D-h10 | Un archivo por hábito con su registro | un solo archivo con todos | Delfina (11.1) |
| D-h11 | El anillo de «no se hizo» queda en `--linea-hover` (menos de 3:1) y su estado va en el nombre de la celda y en la fila | un borde más claro que compite con «hecho» | Delfina (revisable en la revisión de diseño) |
| D-h12 | Un recordatorio que llega más de 60 min tarde sale solo como globo | notificar igual | Delfina |
| D-h13 | La notificación respeta el interruptor «Avisar» de Configuración y no depende de que la ventana esté a la vista | notificar solo fuera de la vista, como las preguntas | Delfina |
| D-h14 | El recordatorio se ve con Hábitos abierto; el resumen y el aviso de Tareas no se ven con su hoja abierta | esconder todos con su hoja abierta | Delfina |
| D-h15 | La frase: una vez por semana, 60 tokens, 45 s, validada contra los números; si no, la plantilla | sin validación | Delfina |
| D-h16 | La cantidad sumada puede pasar de la meta («9 de 8») | tope en la meta | Delfina (lo mostraba el boceto aprobado) |

## 16. Correcciones y contradicciones con el código

- **El boceto de hábitos dibuja el marco de antes de los módulos** (proyectos en la barra y «‹ Tablero» en la hoja). Manda `modulos-ux.md`: Hábitos es una fila del menú, sin «‹ Tablero», y Esc va a Sesiones. El boceto no se corrige: su contenido (la hoja) es el que vale.
- **El globo de la marca de Tareas se llama `.globo-tar`** en el código, no `.globo` (`tareas-ux.md` 8.3).
- **`tauri-plugin-notification` ya está** en `Cargo.toml`, con el comando `avisar` y `on_action` (`lib.rs:1336` y `1759`). La consigna lo pedía «aprobar»: no hace falta sumar la dependencia, solo medir lo de 11.9.
- **`lugarAviso` no esconde el globo de Tareas en la marca cuando hay una pregunta** (solo en la muesca). Con D-h5 sí lo esconde: es un cambio a propósito (H2), con su test.
- **`horaGlobo` vive en `tareas.js`**; pasa a `fechas.js` como `horaArgentina` (11.2), con una reexportación para no romper nada.
