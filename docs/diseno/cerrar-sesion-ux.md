# Cerrar sesión y "Qué hizo": revisión visual (#25)

Revisión del 24/11/2026 de "Cerrar sesión" y "Qué hizo" en la tarjeta de sesión, hechos dentro del look de Avis sin dirección propia. Fuentes: el issue #25, `estilo-avis-ux.md` y `control-sesion-ux.md`.

## Cómo se midió

Delfina, sobre `widget/dev/vista.html` (rama `feat/25-cerrar-sesion`, sin commit nuevo), con Playwright (Chromium) a 1440 × 900, 768 × 1024 y 375 × 812, más 1366 × 768 al 200 % (`&zoom=200`). Se midió con `getComputedStyle` y `getBoundingClientRect` dentro del iframe `#ventana`. Se usaron `?estado=reposo`, `?sincerrar`, `?historial=lento|vacio|error` y `?pausa`. Las capturas se borraron al terminar. No hubo errores ni advertencias en la consola en ningún estado.

**Resultado: 2 bloquean · 5 mejoras · 8 detalles.**

## 1. Bloquean

| # | Estado y ancho | Qué se ve | Qué dice la fuente | Severidad | Dónde, probable |
|---|---|---|---|---|---|
| B1 | Sin parámetros, catalogo, 1440. Segundo clic en "¿Cerrar? Sí". | Unos 4,5 s después del segundo clic, la tarjeta **desaparece de golpe**. El foco estaba en el campo de esa tarjeta y **cae en `body`**. "Cerrando la sesión…" se va con la tarjeta y **nada anuncia** que la sesión se cerró. Catalogo tenía una sola sesión, así que el proyecto también desaparece: la vista **salta a central-nucleo-main** (el `h1` cambia) sin aviso. | estilo-avis 8: el foco nunca se mueve solo y los avisos en vivo dicen lo que pasa. 6.2: lo que se va se funde ("subagente que se va: opacidad a 0 en 240 ms"). Issue: "desaparece de Avis en segundos" se cumple, pero **nadie diseñó la salida**. Propuesta: (1) la tarjeta sale en 240 ms con `--ease-cierra`, con opacidad de 1 a 0 y el alto plegado a 0, y con movimiento reducido o pausa se va sin animación; (2) la región viva oculta que ya anuncia las preguntas dice "Se cerró la sesión feat/48-precios", que no se borra con la tarjeta; (3) el foco va al "Qué hizo" de la tarjeta siguiente, o de la anterior si no hay siguiente; si el proyecto se queda sin sesiones, va al proyecto que queda activo en la barra lateral. | Bloquea | `main.js:304-320` (`pintarEscenas`) y `:346-348` (`devolverFoco` sale sin destino cuando la barra ya no está). La salida va en `escenaMotion.js`. |
| B2 | Sin parámetros, catalogo, 1440. Entre el segundo clic y la desaparición (unos 4,5 s). | Durante "Cerrando…" el foco pasa al **campo "Escribile a Claude…"** de la sesión que se está cerrando. Cuando llega el resultado `cerrando`, "Cerrar sesión" **se vuelve a habilitar** con su etiqueta de reposo y el campo sigue activo. La línea de la tarjeta sigue diciendo "esperando tu mensaje". Se puede escribir o pedir otro cierre a una sesión que ya está saliendo. | **Estado sin diseñar**. Issue: "Cerrar solo con un clic confirmado; nunca solo". control-sesion 6: la confirmación y la espera tienen que verse. Propuesta: con `resultado: 'cerrando'`, la tarjeta pasa a `cerrando` hasta irse. Campo, Enviar y Frenar quedan `disabled`. El botón Cerrar dice "Cerrando…", lleva `aria-disabled="true"` y no `disabled` (así **conserva el foco**), y el clic se ignora. La línea de la tarjeta dice "cerrando la sesión" en `--tenue`, con el punto sin color. El texto no pierde opacidad (3.1). | Bloquea | `control.js:152` (`ocupada` solo mira `pendiente`), `main.js:392` y `:405` (lleva el foco al campo). |

## 2. Mejoras

| # | Estado y ancho | Qué se ve | Qué dice la fuente | Severidad | Dónde, probable |
|---|---|---|---|---|---|
| M1 | Sin parámetros, catalogo, con "Qué hizo" abierto, en 1440, 768 y 200 %. | El detalle va **entre la línea de estado y el escenario** y mide 342 px. La barra de control baja de y = 473 a y = 760, y la columna termina en 750: **"Cerrar sesión" queda fuera de la vista**. A 768 baja a 822 con la columna en 811. Al 200 % queda unos 700 px CSS más abajo. Con `?historial=lento` el detalle pasa de 55 a 342 px cuando llegan los datos: la barra salta 287 px. | Issue: el detalle sirve "para decidir si se puede cerrar", así que la acción tiene que quedar a la vista. panel-avis y el #14: el detalle de un subagente va **debajo del escenario**. Propuesta: (1) el detalle va entre el escenario y la barra; (2) `.hist-turnos { max-height: 196px }`, unos 3 turnos; (3) mientras carga, el detalle reserva `min-height: 120px`, así no salta; (4) al abrir, se lleva a la vista la `.ctl` en vez del detalle (`scrollIntoView({ block: 'nearest' })`), y así se ven los dos. | Mejora | `tablero.js:426` (orden del detalle), `estilos.css:1330`, `main.js:483-497` |
| M2 | Todos los anchos. | "Qué hizo" mide **66 × 24** y "Cerrar sesión" **93 × 24**. | estilo-avis 8: botones de 32 × 32 como mínimo. En chat-avis 18.6 M2 se resolvió el mismo caso: se conserva el dibujo y el área de clic es de 32. Propuesta: `::after { content: ""; position: absolute; inset: -4px 0 }` en los dos (`.ses-hizo` necesita `position: relative`). | Mejora | `estilos.css:1300` y `:1317` |
| M3 | Catalogo, 1440. Primer clic en "Cerrar sesión". | El botón pasa de **93 a 80 px**. Como va alineado a la derecha, su borde izquierdo se corre 13 px y un segundo clic en esa franja cae afuera. | control-sesion 5: el mismo caso con Frenar se corrigió con un ancho mínimo. Propuesta: `.ctl .ctl-cerrar { min-width: 96px; justify-content: center }`. | Mejora | `estilos.css:1300` |
| M4 | Todos los anchos. | "Qué hizo" usa el **radio 6 de `--r-tag`** y Martian Mono, al lado de "18 min". En la cabecera se lee como una segunda etiqueta y no como un botón. Tampoco tiene la presión de `:active`. | estilo-avis 3.4: los botones llevan `--r-pildora` y `--r-tag` es del tag "#12". 6.3: `:active` a .97 en 140 ms. Propuesta: `border-radius: var(--r-pildora)`, `.ses-hizo:active { transform: scale(.97) }` y sumar `transform var(--d-presion)` a su `transition`. | Mejora | `estilos.css:1316-1321` |
| M5 | Todos los anchos, con varias tarjetas. | "Cerrar sesión" se nombra "Cerrar esta sesión de Claude": **el texto visible no está dentro del nombre**, y un control por voz ("clic en Cerrar sesión") puede fallar. "Qué hizo" y "Cerrar" se llaman igual en todas las tarjetas. | estilo-avis 8: cada control tiene su nombre. control-sesion 11 ya pidió sumar la rama a la barra. Propuesta: "Cerrar sesión feat/48-precios", "¿Cerrar? Sí: cerrar sesión feat/48-precios" y "Qué hizo en feat/48-precios" (en `aria-label`, con la rama o el repo como en `detalleHistorial`). | Mejora | `control.js:179`, `tablero.js:395-397` |

## 3. Detalles

| # | Estado y ancho | Qué se ve | Qué dice la fuente | Severidad | Dónde, probable |
|---|---|---|---|---|---|
| D-a | Catalogo, con "en cola", 1440, al confirmar. | "Tocá otra vez para cerrar la sesión · Esc cancela" se parte en dos líneas entre "en cola" y el botón. La tarjeta crece unos 13 px justo en el primer clic. | control-sesion 3: la línea reserva su alto para que el resultado no empuje la tarjeta. Propuesta: "Otra vez para cerrar · Esc cancela". | Detalle | `control.js:124` (`LINEA_CONFIRMA_CIERRE`) |
| D-b | Sesiones de terminal, todos los anchos. | "Cerrar sesión" queda a **4,8 px** del borde inferior de la tarjeta. Con el botón, `.ctl-est` pasa de 16,6 a 24 px. Al confirmar, el anillo de foco casi toca el borde. | control-sesion 3: deja 21 px de aire abajo. Propuesta: `.ctl-est:has(.ctl-cerrar:not([hidden])) { margin-bottom: var(--e-3) }`. | Detalle | `estilos.css:1299` |
| D-c | Todos los anchos. | "Cerrar sesión" usa `700 11px/1`, un tamaño que no está en la escala. | estilo-avis 3.2. Propuesta: 11,5 px, el tamaño de `--t-chico`, con peso 700. | Detalle | `estilos.css:1300` |
| D-d | `?historial=error`. | "No se pudo leer la conversación", en `--rojo`, sin motivo ni paso siguiente. Se reintenta cada 10 s sin avisar, y el error no se anuncia porque el párrafo no tiene rol. | estilo-avis 8 (avisos en vivo). Propuesta: "No se pudo leer la conversación · vuelvo a probar en 10 s", con `role="status"` en `.det-vacio`. | Detalle | `historial.js` (`TEXTO.error`), `tablero.js:412` |
| D-e | `?historial=lento`, todos los anchos. | El detalle entra con `despliega` al abrir y **vuelve a entrar entero** cuando llegan los datos: `.entra` se aplica otra vez a `.det-sub`. | estilo-avis 6.1: "no se repite". Propuesta: en la primera lectura, una clase `.llega` que anima solo los `li` con `sube`. | Detalle | `main.js:474-478` |
| D-f | Catalogo, 1440. | La lista se corta a 300 px a mitad de una línea ("CLAUDE Terminé de revisar…" queda cortado por la mitad) y nada indica que sigue. | Propuesta: `mask-image: linear-gradient(#000 calc(100% - 16px), transparent)` cuando hay scroll. | Detalle | `estilos.css:1330` |
| D-g | Todos los anchos. | El rótulo dice "últimos pedidos", pero la lista también muestra las respuestas de Claude. | Propuesta: "lo último". | Detalle | `tablero.js:414` |
| D-h | 1366 × 768 al 200 %. | El borde derecho de la columna recorta "Qué hizo" y su anillo de foco. Viene de antes: el tablero mide 1352 px CSS y no entra, y ya se perdía la × de la ventana. Ahora "Qué hizo" es lo último de la cabecera. | No es del #25. Se anota para cuando se diseñe el 200 % en pantallas chicas. | Detalle (preexistente) | — |

## 4. Lo que cumple (medido)

- **Cerrar, con dos clics y sin decidir solo (issue, estilo-avis 11):**
  - El primer clic muestra "¿Cerrar? Sí" y "Tocá otra vez para cerrar la sesión · Esc cancela" en el `role="status"`. A los 3 s vuelve solo a "Cerrar sesión". El segundo clic dentro de la ventana manda la orden.
  - Con el teclado: Enter confirma, Esc cancela y el foco se queda en el botón.
  - La confirmación de Frenar y la de Cerrar se excluyen.
  - La sesión de la app de escritorio (oficina) no tiene el botón, y con `?sincerrar` ninguna sesión lo tiene.
  - La tarjeta se va unos 4,5 s después del segundo clic.
- **Contraste:**

  | Texto | Medido | Pide |
  |---|---|---|
  | "Cerrar sesión" en reposo (`--crema2` sobre `--s1`) | 9,59 | 4,5 |
  | "¿Cerrar? Sí" (negro sobre `--rojo`) | 8,25 | 4,5 |
  | "Qué hizo" (`--crema2` sobre `--s1`) | 9,59 | 4,5 |
  | "Qué hizo" abierto (`--ambar` sobre `--ambar-osc`) | 9,77 | 4,5 |
  | "Vos" (`--ambar` sobre `--s2`) | 10,08 | 4,5 |
  | Respuestas (`--crema2` sobre `--s2`) | 9,03 | 4,5 |
  | Tiempos y "todavía sin respuesta" (`--tenue` sobre `--s2`) | 4,95 | 4,5 |
  | Error (`--rojo` sobre `--s2`) | 7,22 | 4,5 |

- **"Qué hizo":**
  - **Piezas del detalle de subagente:** `--s2`, borde `--linea-hover`, radio 14, 408 de ancho y el rótulo en mono.
  - **Teclado y lector de pantalla:** foco ámbar de 2 px con separación de 2. Lleva `aria-expanded` y `aria-controls`, y la región se nombra con la rama ("Qué hizo feat/48-precios"). Tiene `aria-busy` mientras lee. Esc lo pliega y el foco vuelve al botón. El foco sobrevive al redibujo cuando llegan los datos.
  - **Contenido:** "Vos" en ámbar y "Claude" en `--crema2` (el color no va solo). Va del más nuevo al más viejo, con el primer turno marcado en ámbar. Los avisos del sistema (`task-notification`, `system-reminder`) no se ven. El pedido se corta a 2 líneas y la respuesta a 3.
  - **Estados:** cargando ("Leyendo la conversación…"), vacío ("Todavía no hay conversación"), error y listo.
- **Movimiento:**
  - El detalle entra con `despliega` y los turnos en escalera de 45 ms.
  - La barrita `drena` de 3 s solo corre con `prefers-reduced-motion: no-preference` y sin `body.pausa`.
  - Con movimiento reducido no hay transiciones en `.ses-hizo` ni en la barra.

## 5. Sin verificar

- **Movimiento reducido emulado:** esta sesión de Playwright no tiene `emulate_media`. Se revisó el código: las reglas nuevas de animación están dentro de `no-preference` y de `body:not(.pausa)` (`estilos.css:1304`, `:1344`), y `?pausa` arranca con `body.pausa`.
- **Cerrar con otra sesión en el mismo proyecto:** en los datos falsos, las sesiones que se pueden cerrar están solas en su proyecto. Por el código, el foco se pierde igual (`devolverFoco` sale si la barra ya no existe), y B1 lo cubre.
- **La app real (Tauri):**
  - la lectura real de la transcripción (`historial.rs`);
  - la salida real de la sesión y el tiempo hasta que se marca `cerrada`;
  - el scroll de la lista con el teclado en WebView2;
  - lo que dice de verdad un lector de pantalla (acá se revisaron solo los roles y las regiones del DOM).
- **375 px:** el tablero fijo de 676 queda cortado, igual que antes del #25 (control-sesion, "Cómo se midió"). Los botones nuevos no agregan nada a corregir ahí.

## 6. Correcciones (24/11/2026)

Todas en la rama, con las propuestas de 1 a 3 aprobadas por el usuario. Medido con Playwright sobre `widget/dev/vista.html` a 1440 × 900 y 768 × 1024, igual en los dos anchos salvo donde se dice.

- **B1:** las tarjetas cerradas desde el widget salen en 240 ms con `--ease-cierra`, opacidad a 0 y el alto plegado a 0 (`salirTarjetas` en `escenaMotion.js`, `.ses.sale`); con movimiento reducido o pausa se van sin animación. `despedirCerradas` (main.js) anima antes del redibujo y `trasCierre` anuncia "Se cerró la sesión feat/48-precios" en `#anuncio` (`anuncioCierre`). El foco, si estaba en la tarjeta, va al "Qué hizo" de la siguiente, si no de la anterior (`destinoFocoCierre`), si no al proyecto activo de la barra. Medido: `.sale` aplicado; el foco termina en `.pj.activo` (central-nucleo-main), nunca en `body`; con `reducedMotion: reduce`, sin `.sale` y el mismo foco y anuncio. Sin medir en el navegador: dos sesiones en un mismo proyecto (los datos falsos no lo tienen); lo cubre el test de `destinoFocoCierre`.
- **B2:** desde el segundo clic hasta que la tarjeta se va, la sesión está "cerrando" (`cerrandoSesion`, `ui.cerrando` con el resultado `cerrando`). Campo, Enviar y Frenar `disabled`; el botón dice "Cerrando…" con `aria-disabled="true"` y sin `disabled`, y el clic se ignora (`clicCerrar`, `tocarCerrar`, `ordenar`). La línea de la tarjeta dice "cerrando la sesión" en `--tenue` con el punto hueco (`.linea.cerrando`); la de la barra queda "Cerrando la sesión…" hasta irse. Medido: el foco se queda en el botón todo el tiempo; un tercer clic no cambia nada; "Cerrando…" en `--tenue` sobre `--s1`, 5,27:1.
- **M1:** el detalle va entre el escenario (y el detalle de un subagente) y la barra; `.hist-turnos` con `max-height: 196px`; leyendo reserva 120 px; al abrir y al llegar los turnos se lleva a la vista la `.ctl` (`scrollIntoView({ block: 'nearest' })`, con `scroll-margin-bottom: 12px` en `.ctl` para que entren el anillo de foco y el borde). Medido: el detalle mide 120 leyendo y 238 listo; "Cerrar sesión" a la vista con 12 px de aire hasta el borde de la columna, y el detalle entero a la vista. Con `?historial=lento` la barra no se mueve en pantalla al llegar los datos (la columna se desplaza los 118 px que crece el detalle).
- **M2:** "Qué hizo" (`::after`) y "Cerrar sesión" (`::before`, porque su `::after` ya es la barrita de la confirmación) conservan el dibujo de 24 y el área de clic es de 32 (`inset: -4px 0`, como `.preg-tab`). Medido: el punto 3 px por encima y por debajo de cada botón cae en el botón.
- **M3:** `.ctl .ctl-cerrar { min-width: 96px; justify-content: center }`. Medido: 96,5 en reposo y 96 con "¿Cerrar? Sí"; el borde izquierdo se mueve 0,45 px.
- **M4:** "Qué hizo" con `--r-pildora` (999px) y `:active` a .97 con `--d-presion`, dentro de `no-preference` y `body:not(.pausa)`.
- **M5:** "Cerrar sesión feat/48-precios", "¿Cerrar? Sí: cerrar sesión feat/48-precios", "Cerrando sesión feat/48-precios" y "Qué hizo en feat/48-precios" (la rama, si no el repo). Medido en el DOM.
- **D-a:** "Otra vez para cerrar · Esc cancela". Medido: con "en cola" la línea de estado mide 24 (el alto del botón), en una línea.
- **D-b:** `.ctl-est` con el botón lleva `margin-bottom: var(--e-3)`. Medido: 10,8 px del botón al borde inferior de la tarjeta (antes 4,8).
- **D-c:** "Cerrar sesión" en `700 11.5px/1`. Medido.
- **D-d:** "No se pudo leer la conversación · vuelvo a probar en 10 s" (los 10 s salen de `MS_RELEER` de `historial.js`, el mismo intervalo con el que main.js relee) y `role="status"` en `.det-vacio`. Medido con `?historial=error`. Sin verificar con un lector de pantalla: el párrafo se crea con el texto ya puesto.
- **D-e:** en la primera lectura el detalle lleva `.turnos-llegan` (no `.llega`, que ya es el anillo de la dividida y lo achicaba a 26 px): solo los `li` entran con `sube`. Medido con `?historial=lento`: el detalle sin animación, los turnos con `sube`.
- **D-f:** `.hist-turnos.desborda` con `mask-image` (16 px) mientras queda algo por ver abajo (`marcarDesborde`, también al desplazar la lista); al llegar al final se ve entero. Medido: 196 de 325 px, `desborda` puesto.
- **D-g:** el rótulo dice "lo último".
- **D-h:** no se tocó (viene de antes; lo resuelve otra rama).
- La consola no mostró errores ni advertencias en ningún estado.
