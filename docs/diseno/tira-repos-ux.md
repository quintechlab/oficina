# Tira de repos con muchos proyectos — dirección (opción A · Dos renglones)

Boceto: `docs/diseno/bocetos/tira-repos.html` (opción A, elegida por Quintana el 27/11: «A · Dos renglones (Recomendado)»).
Evoluciona `docs/diseno/modulos-ux.md` 4.4 (la tira de M2) dentro del sistema de `estilo-avis-ux.md`: sin tipografías, colores ni sombras nuevas. Donde esta dirección y 4.4 no coinciden, manda esta.

## 1. Brief

- **Pedido (Quintana, 27/11):** «un tema estetico, cuando hay muchas sesiones, no se pueden ver bien todas. como podriamos mejorarlo?»
- **Problema medido en el boceto:** con 15 repos la tira de una fila muestra 3; el repo con una pregunta puede quedar debajo de la máscara; `scratch-2026-11-27-d5bfc1` ocupa media columna.
- **Acción principal de la tira:** elegir el repo cuyas sesiones querés ver.
- **Vara:** la de siempre (brasa-noble): estados completos, movimiento con sentido, accesible, sin saltos bajo el puntero.

## 2. Concepto: «Dos renglones»

La tira deja de correr de costado. Ocupa hasta **dos renglones**, ordenados por **urgencia**, y lo que no entra se guarda en un chip **«+n»** que muestra los puntos de color de lo que guarda y abre una lista agrupada. Lo urgente nunca queda escondido; lo dormido queda a un clic.
Palabras: legible, quieta, honesta.
Firma: los puntos de color del «+n» (los colores de proyecto de lo que guarda, en orden).
Movimiento: la tira no se mueve mientras la usás; cuando la soltás, los chips viajan a su lugar nuevo (FLIP de 300 ms).

## 3. Arquitectura

En la columna de Sesiones, en el mismo lugar que hoy (entre las hojas y `#otro`):

```
div.repos-caja                      (position: relative; nuevo envoltorio en index.html)
  nav.repos#repos[aria-label="Repos"]
    button.rch …                    (un chip por repo, en el orden de 4)
    button.rch.rch-mas              (solo si sobran repos)
  div#repos-mas[role=listbox][hidden]  (la lista del «+n»; hermana del nav, no adentro)
```

`#repos-mas` va fuera del `nav` a propósito: los selectores de hoy (`#repos [data-proy]`) siguen tocando solo chips.

## 4. Reglas comunes

### 4.1 Nombre corto (`nombreCorto`, modulos.js, pura)

- Si el nombre cumple `/^(.+)-\d{4}-\d{2}-\d{2}-([0-9a-z]{4,12})$/i` → `{ base: $1, sufijo: $2 }`. Se dibuja `scratch<small> · d5bfc1</small>`.
  - `scratch-2026-11-27-d5bfc1` → «scratch · d5bfc1». `notas-2026-01-05-ab12` → «notas · ab12».
  - `datos-migracion-2026` no cumple (no tiene fecha completa ni sufijo) → queda igual.
- Si no → `{ base: nombre, sufijo: null }`.
- En el chip, el nombre (base + sufijo) tiene **tope de 112 px** (`--ancho-nombre-repo`) con `text-overflow: ellipsis`. Medido en el boceto: «mis-gastos-app» (102) entra; «datos-migracion-2026» se corta.
- El nombre entero va siempre en `title` (hoy: `p.repo ?? p.nombre`) y en el nombre accesible (`p.nombre`). En la lista del «+n» va el nombre entero, sin la regla corta, con «…» solo si no entra en su columna.

### 4.2 Grupo y orden por urgencia (`grupoRepo`, `ordenTira`, modulos.js, puras)

`grupoRepo(proyecto, ahoraMs)`, en este orden de prueba:

| Grupo | Regla (funciones que ya existen) |
|---|---|
| `pregunta` | `preguntasPendientes(p).length > 0` (la misma cuenta del «1 ?» de hoy, incluye preguntas de subagentes) |
| `trabajando` | alguna sesión con `ANIMOS_DE_TRABAJO.has(animoSesion(s, ahoraMs))` (la misma lista que `prepararProyecto`) |
| `dormida` | todas sus sesiones con `dormida(s, ahoraMs)` |
| `espera` | el resto |

`ordenTira(proyectos, ahoraMs, anterior, congelada)` devuelve `{ orden: [repo…], pendiente: bool }`:
- **Suelta:** orden estable `pregunta › trabajando › espera › dormida`; adentro de cada grupo, el orden de `agruparPorProyecto` (alfabético, «fuera de repo» al final). El elegido **no** salta al frente: queda en su grupo.
- **Congelada** (4.3): devuelve `anterior` sin los repos que ya no están; los repos nuevos van al final en orden de urgencia; `pendiente: true` si el orden suelto sería distinto.

### 4.3 Nada se reordena bajo el puntero

- La tira está **congelada** mientras: el puntero está sobre `.repos-caja` (incluida la lista), el foco está adentro de `.repos-caja`, o la lista está abierta.
- Congelada, también se congela **qué repos se ven** (4.4). Los contenidos (cuentas, punto de trabajo, «1 ?») sí se actualizan en su lugar. Si un chip crece y ya no entra, la tira puede tomar un tercer renglón hasta soltarse.
- Dos excepciones, que no reordenan a nadie: (a) un repo oculto que recibe una pregunta pasa a ser el último chip visible (antes del «+n») y su «1 ?» late (`latirPregunta`); (b) un repo oculto que se elige (desde la lista o con ← → fuera de la tira) toma el último lugar visible y el que estaba ahí pasa a la lista.
- Al soltarse (puntero afuera **y** foco afuera **y** lista cerrada) se espera `ESPERA_REORDEN_MS = 400`; si sigue suelta y `pendiente`, se aplica el orden nuevo con el FLIP de 9.

## 5. Componentes y estados

### 5.1 Chip de repo `button.rch` (átomo; sigue siendo el de 4.4)

| Parte | Valor |
|---|---|
| Caja | alto mín. 32, relleno 0 8 0 6, separación 7, borde 1 `--linea`, radio `--r-pildora`, `700 13px/1 var(--f)`, `--crema2`. Sin cambios |
| Ícono | `.pj-ic` 20 × 20 redondo, como hoy |
| Nombre | `span.rch-n`, `max-width: var(--ancho-nombre-repo)` (112), `overflow: hidden; text-overflow: ellipsis`. El sufijo: `small`, `500 11px/1 var(--m)`, `font-stretch: 75%`, `--tenue` (5,65:1 sobre `--negro`) |
| Trabajando | `i.rch-trab` después del nombre: 6 × 6 redondo, `--ambar`, `box-shadow: 0 0 0 3px color-mix(in srgb, var(--ambar) 20%, transparent)`. (No `.w`: es la palabra del chat) |
| Cuenta | **regla nueva:** el `.chip` de sesiones sale solo con **2 o más** sesiones. Con una pregunta, el `.chip-preg` «n ?» como hoy, con cualquier cantidad de sesiones (reemplaza a la cuenta) |
| Dormida | clase `.rch.dormida`: borde `dashed` `--linea-hover`, texto `--tenue`, `.pj-ic` a opacidad .55. Hover: texto `--crema2` |
| Elegido | como hoy: `aria-current="true"`, fondo `--crema`, texto `--tinta` (15,86:1). El sufijo `rgba(20,17,12,.6)` (4,66:1). El punto de trabajo pasa a `--tinta` con anillo `rgba(20,17,12,.14)`. El elegido dormido no lleva borde punteado (lo tapa el crema) |
| Hover / activo / foco | como hoy: borde `--linea-hover` y texto `--crema`; `scale(.97)` en 140 ms; foco ámbar global, `--tinta` sobre el elegido |
| Atributos | los de hoy (`data-accion="ir"`, `data-proy="{k}"`, `title`) + **`data-repo="{repo}"`** (llave estable para el FLIP: `data-proy` es un índice y cambia cuando entra o sale un repo) |
| Nombre accesible | `{nombre}, {cuenta}[, trabajando][, dormida][, elegido]`. `{cuenta}` como hoy («1 sesión», «3 sesiones» o «1 pregunta pendiente»): **siempre**, aunque el chip no muestre el número |

### 5.2 Chip «+n» `button.rch.rch-mas` (molécula)

- **Cuándo:** solo si algún repo no entra (4.4). Siempre es el último hijo de `#repos`.
- **Caja:** la de `.rch`, con **ancho fijo de 72** (`--ancho-mas`), `justify-content: center`, separación 6, relleno 0 8. Ancho fijo: el reparto de 4.4 no depende de cuántos dígitos tenga n.
- **Puntos:** `span.rch-pts[aria-hidden]` con hasta 4 `i` de 8 × 8 redondos, `background: var(--c)` = `colorProyecto` de los **primeros 4 ocultos en orden**, `box-shadow: 0 0 0 2px var(--negro)`, cada uno `margin-left: -2px` salvo el primero.
- **Número:** `span.rch-mas-n[aria-hidden]` «+{n}», `500 11.5px/1 var(--m)`, `font-stretch: 75%`, `--crema2`.
- **Abierto** (`aria-expanded="true"`): fondo `--s2`, borde `--linea-hover`, texto `--crema`.
- **ARIA:** `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls="repos-mas"`, `aria-label="{n} repos más"`. Sin `data-proy`.

### 5.3 Lista del «+n» `div#repos-mas` (organismo)

- **Superficie:** la del menú que ya existe (`#hoja .menu`): `--s2`, radio 14, borde 1 `--linea-hover`, `box-shadow: 0 24px 48px -18px #000`, relleno 10. No es una sombra nueva: es la de los menús.
- **Lugar:** `position: absolute`, `left: 0; right: 0`, `top: calc(100% + 6px)` de `.repos-caja`, `z-index: 9` (el de `#chat-menu`). Tapa las tarjetas; no las empuja. `max-height: 360px; overflow-y: auto` (scroll fino como `.principal`).
- **Cabecera** `div.rm-cab[aria-hidden]`: «{n} repos más» a la izquierda y «`Esc` cierra» a la derecha, `var(--t-rotulo)`, `--crema2`, `kbd` como en el boceto.
- **Grupos** (solo los que tienen repos, en este orden): «Te pregunta» (en la práctica nunca, ver 4.4), «Trabajando», «Esperan tu mensaje», «Dormidas». Rótulo `p.grp[id]`: `500 10.5px/1 var(--m)`, `.12em`, mayúsculas, `--tenue` (4,95:1 sobre `--s2`), margen 10 6 4 (4 arriba el primero).
- **Filas** por grupo en una grilla de 2 columnas con `grid-auto-flow: column` y `grid-template-rows: repeat(ceil(n/2), auto)` (así el orden del DOM baja por la primera columna y sigue por la segunda), separación 2 6.
- **Opción** `button.rm-op[role=option]` con `data-accion="ir" data-proy="{k}" data-repo`, `aria-selected="false"`, `tabindex="-1"` (la activa `0`): alto mín. 34, relleno 0 8 0 7, separación 8, radio `--r-fila`, `700 13px/1.2 var(--f)`, `--crema` (15,48:1). Adentro: `.pj-ic`, el nombre entero (`.rm-n`, «…» si no entra), la cuenta con la regla de 5.1, y a la derecha `.rm-t` (`500 11px/1 var(--m)`, `--tenue`) con `tiempoCorto(tiempoRelativo(último turno))` («4 min», «2 h», «ayer»). Dormidas: texto `--crema2` e ícono a .55.
- **Hover:** fondo `--s3`. **Foco:** fondo `--s3` + contorno ámbar global con `outline-offset: -2px`.
- **ARIA:** `role="listbox"`, `aria-label="{n} repos más"`; cada grupo `div[role=group][aria-labelledby=<id del p.grp>]`; el `p.grp` con `role="presentation"` no hace falta (lo nombra el group).

### 5.4 Estados de la tira

| Repos | Qué se ve (medido en el boceto con los datos de ejemplo) |
|---|---|
| 0 | `#repos` vacío y escondido, como hoy (vacío, carga, primeros pasos, otro módulo, dividida) |
| 1 | un chip, sin «+n» |
| 3 | un renglón, sin «+n» |
| 8 | dos renglones: 5 chips + «+3» |
| 15 | dos renglones: 5 chips + «+10» |
| 30 | igual; la lista hace scroll pasados 360 px |

No hay estado de error ni de espera propio: la tira sale de `st.proyectos`, que ya resolvió `leer_sesiones`.

## 6. Reparto en renglones (`repartirTira`, modulos.js, pura)

`repartirTira({ anchos, ancho, separacion, filas, anchoMas, elegido, obligados, congelados })` → `{ visibles: [i…], ocultos: [i…], renglones }`, con `i` posiciones en el orden de 4.2.

1. Llenar renglones de izquierda a derecha con `anchos` (medidos) y `separacion` 6 sobre `ancho` (el `clientWidth` de `#repos` menos su relleno). Si todos entran en `filas` (2) renglones → todos visibles, sin «+n».
2. Si no: el prefijo más largo que entra en 2 renglones **dejando lugar a `anchoMas` (72) al final del último**.
3. **Obligados** (todos los del grupo `pregunta`): si alguno queda fuera del prefijo, se permite un renglón más hasta que entren todos (y el «+n»). Como el grupo `pregunta` va primero, esto solo pasa con más de 3 repos preguntando a la vez. Así **un repo con una pregunta nunca está en el «+n»**.
4. **Elegido:** si no está en los visibles, ocupa el último lugar visible que no sea obligado; el desplazado pasa a ocultos (si el elegido es más ancho y no entra, se oculta uno más).
5. **Congelada:** `congelados` (los visibles anteriores) se respetan; solo se suman las excepciones de 4.3.

La aplica `ajustarTira()` (main.js) justo después de poner el HTML, en el mismo cuadro (sin pintar en el medio, no hay parpadeo): mide `offsetWidth` de cada chip, llama a `repartirTira`, pone `hidden` a los chips ocultos y rellena el «+n» (puntos, número, `aria-label`) o lo saca. Los chips ocultos quedan en el DOM con `hidden`.

## 7. Usabilidad

| Tarea | Pasos |
|---|---|
| Ir al repo que te pregunta | 1 clic (siempre visible, primero) |
| Cambiar entre los repos que trabajan | 1 clic, o ← → con el foco en la tira |
| Ir a un repo dormido o que espera, con muchos repos | 2 clics («+n» y la fila) |

- **Prevención:** congelar el orden (4.3) evita el clic en el repo equivocado; el ancho fijo del «+n» evita que el reparto cambie por un dígito; el nombre corto evita que un nombre generado desplace a los demás.
- **Sin espera:** todo es local; no hay estado de carga.
- `#otro` y el «1 ?» de `#mod-sesiones` siguen como hoy.

## 8. Teclado

### 8.1 En la tira (foco en un chip o en el «+n»)

Los «ítems» son los chips **visibles** y el «+n», en orden visual.
- **← →:** como hoy, mueven al ítem anterior o siguiente, con vuelta. Si el ítem es un chip, **lo elige** (`irAProyecto`) y el foco lo sigue (hoy). Si es el «+n», **solo lo enfoca**, no elige nada. Desde el «+n», → elige el primer chip.
- **↑ ↓:** como hoy, mueven el foco entre ítems sin elegir. **Excepción:** en el «+n», ↓ abre la lista (botón de menú); ↑ va al chip anterior.
- **Enter / Espacio** en el «+n»: abre la lista. En un chip: lo de hoy (clic).
- **Fuera de la tira** (← → globales de Sesiones, `moverProyecto`): recorren **todos** los repos en el orden de la tira (`st.tira.orden`), ocultos incluidos; elegir uno oculto aplica 4.3 (b).

### 8.2 En la lista

- Al abrir, el foco va a la primera opción.
- **↓ / ↑:** opción siguiente / anterior en el orden del DOM (baja por la columna izquierda, sigue por la derecha, pasa al grupo siguiente), sin vuelta.
- **→ / ←:** a la opción de la otra columna en el mismo renglón del grupo, si existe; si no, nada.
- **Inicio / Fin:** primera / última opción.
- **Enter / Espacio / clic:** elige (`irAProyecto`), cierra la lista y el foco va al chip del elegido, que ya está visible (4.3 b).
- **Esc:** cierra y el foco vuelve al «+n». En `alEsc` de Sesiones, la lista abierta es la primera capa.
- **Tab / Mayús Tab:** cierra la lista y el foco sigue su camino natural (sale de `.repos-caja`).
- **Clic afuera** (`pointerdown` fuera de `.repos-caja`): cierra sin mover el foco. Cambiar de módulo, entrar a la dividida o vaciarse la tira también la cierran.
- Mientras la lista está abierta, ni la tira ni la lista se redibujan (4.3); al cerrar se aplica lo pendiente.

## 9. Movimiento

Tokens nuevos en `:root` (3.6 de `estilos.css`) y sus espejos en JS (`modulosMotion.js`):

| Token | Valor | Uso |
|---|---|---|
| `--d-tira-entra` | 260ms | entrada de cada chip: `opacity 0→1`, `translateY 4→0`, `--ease` |
| `--tira-escalon` | 30ms | entre chips; **tope 8 escalones** (con 15 repos, todo quieto a los 500 ms) |
| `--d-reorden` | 300ms | FLIP al reordenar: cada chip viaja con `translate` desde su lugar viejo, `--ease` |
| `--d-lista-abre` | 220ms | lista: `opacity 0→1`, `translateY -4→0`, `scaleY .96→1`, origen arriba, `--ease` |
| `--lista-escalon` | 20ms | filas de la lista, desde los 80 ms, `opacity`+`translateY 4→0` 200 ms; tope 10 |
| `--d-lista-cierra` | 140ms | lista: `opacity 1→0`, `translateY 0→-4`, `--ease-cierra`; después `hidden` |

- **Cuándo entra la tira:** al arrancar y al volver a Sesiones desde otro módulo (`irModulo`). **No** en cada `pintar` ni al cambiar de proyecto. Un repo nuevo entra solo (260 ms, sin escalón); uno que se va desaparece sin acto.
- **Pregunta nueva:** el «1 ?» del chip late dos veces con `latirPregunta` (`modLate`, ya existe).
- **Lo hace anime.js** desde `modulosMotion.js` (`entraTira(nav)`, `entraChip(chip)`, `reordenarTira(nav, antes)` con `antes = Map(data-repo → DOMRect)`, `abrirLista(panel)`, `cerrarLista(panel)` que devuelve una promesa), con `modo()`:
  - `completo`: lo de la tabla.
  - `fundido` (movimiento reducido): sin `transform` ni escalones; tira, chip nuevo y lista con `opacity` en 160 ms (`FUNDIDO_MS`); reordenar al instante; sin latido.
  - `nada` (`body.pausa`): todo al instante.
- Solo `transform` y `opacity`. Las transiciones de `.rch` ya se apagan con `prefers-reduced-motion` y `body.pausa` (`estilos.css` 244 y 246): `.rch-mas` y `.rm-op` se suman a esas dos reglas.

## 10. Tamaño y ancho

El panel tiene medidas fijas (barra 208, columna 500; sin zoom desde #47), así que no hay 375/768/1440 para esta pieza: la tira se diseña para 500 y se revisa en `dev/vista.html` a 1440. Alto: un renglón 36, dos renglones 74 (32 + 6 + 32 + 2 × 2 de relleno); el resto de la columna baja 38 px con dos renglones.

## 11. Accesibilidad

- Cada chip y cada opción con su nombre accesible completo (5.1); el número visible es `aria-hidden`.
- El estado nunca va solo por color: trabajando = punto + «, trabajando»; dormida = borde punteado + texto tenue + «, dormida»; pregunta = «n ?» + «pregunta pendiente».
- Contraste (medido): `--crema2`/`--negro` 10,31; `--tenue`/`--negro` 5,65; `--tinta`/`--crema` 15,86; sufijo en el elegido 4,66; `--crema`/`--s2` 15,48; `--tenue`/`--s2` 4,95; `--negro`/`--ambar` 11,51.
- Foco visible en todo (contorno ámbar global; `--tinta` sobre el crema); el foco nunca se pierde al redibujar (hoy) ni al cerrar la lista (vuelve al «+n» o al elegido).
- Objetivos: chips de 32 de alto y opciones de 34, como el resto del panel (widget de escritorio, con mouse); no se agrandan a 44.

## 12. Entrega: qué toca en el código

| Pieza | Hoy | Cambio |
|---|---|---|
| `index.html:125` | `nav.repos#repos` | envolver en `div.repos-caja` y sumar `div#repos-mas[role=listbox][hidden]` después del `nav` |
| `tablero.js:215` `tiraRepos(proyectos, i)` | chips en el orden de `st.proyectos` | `tiraRepos(proyectos, i, orden, ahoraMs)`: chips en `orden`, `data-repo`, nombre corto, regla de cuenta, punto de trabajo, `.dormida`, nombre accesible de 5.1, y el «+n» al final (lo completa `ajustarTira`) |
| `tablero.js` (nueva) | — | `listaRepos(proyectos, ocultos, ahoraMs)`: el HTML de 5.3 |
| `modulos.js:167` `desplazarTira` | corre la tira en horizontal | **se borra**, con su test (`test/modulos.test.js:288-297`) y su import en `main.js:116` |
| `modulos.js` (nuevas, puras, con test) | — | `nombreCorto`, `grupoRepo`, `ordenTira`, `repartirTira` y las teclas de 8 (`pasoTira`, `pasoLista`) |
| `main.js:1273-1278` (`pintar`) | `poner('#repos', tiraRepos(…))` y vuelve el foco | igual, con `orden` de `st.tira`, y después `ajustarTira()`; no redibuja si `st.tira` está congelada por la lista abierta. Actualizar el test `test/modulos.test.js:423`, que lee ese texto |
| `main.js:1354-1365` `MASCARA_REPOS`, `verRepoElegido` | máscara y scroll | **se borran**; la llamada de `irAProyecto` (`main.js:1348`) se va: el elegido queda visible por 6.4 |
| `main.js:2191` `moverProyecto` | recorre `st.proyectos` | recorre `st.tira.orden` (8.1, fuera de la tira) |
| `main.js:2736-2751` (teclado) | ↑ ↓ y ← → sobre `#repos [data-proy]` | ítems = `#repos .rch:not([hidden])` (chips y «+n»); reglas de 8.1; la lista con 8.2 |
| `main.js:2368` (`ir`) | elige el proyecto | si vino de `#repos-mas`, cerrar la lista y enfocar el chip elegido |
| `main.js` (nuevo estado) | — | `st.tira = { orden, visibles, congelada, pendiente, abierta }`; escuchas `pointerenter/leave` y `focusin/out` en `.repos-caja`; `ESPERA_REORDEN_MS = 400`; capa de Esc |
| `estilos.css:214-246` | `.repos` con `overflow-x`, máscara y relleno derecho 56 | `.repos`: `flex-wrap: wrap`, `gap: 6px`, relleno 2, **sin** `overflow-x`, `mask-image` ni `scrollbar-width`; borrar `.repos::-webkit-scrollbar`. Sumar `.rch-n`, `.rch-trab`, `.rch.dormida`, `.rch-mas`, `.rch-pts`, `.repos-caja`, `#repos-mas`, `.rm-*`; tokens `--ancho-nombre-repo: 112px`, `--ancho-mas: 72px` y los de 9 |
| `modulosMotion.js` | píldora y avisos | `entraTira`, `entraChip`, `reordenarTira`, `abrirLista`, `cerrarLista` (9) |
| `dev/falso.js:407` | `?repos=muchos` (9 repos) | sumar `?repos=15` con los estados del boceto (una pregunta, cuatro trabajando, cinco esperando, cinco dormidos) y un `scratch-AAAA-MM-DD-hash` |
| `CLAUDE.md` «Módulos, M2» | describe la tira de una fila | actualizar al cerrar |

**No improvisar:** el orden de los grupos, el tope de 112, el ancho fijo de 72 del «+n», la regla de cuenta (≥ 2), las dos excepciones de 4.3, la espera de 400 ms y los tiempos de 9. Si algo no está acá, vuelve a diseño.

## 13. Decisiones

- Sin filtro por texto en la lista del «+n» por ahora (decisión del orquestador del 27/11; revisar si más de 10 ocultos se vuelve común).
- Adentro de cada grupo, orden alfabético (el de `agruparPorProyecto`) y no de llegada como decía el boceto: no hay que guardar nada nuevo y no cambia entre arranques.
- El foco de una opción es fondo `--s3` + contorno; se quitó la barra ámbar del boceto (dos marcas para lo mismo).
