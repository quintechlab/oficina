# Avis · resumen A "Te lo cuenta el Avi" — dirección

> Opción A del boceto `docs/diseno/bocetos/resumen-ia.html` (2026-11-21), elegida por el usuario: «A · Te lo cuenta».
> Quedan decididos los supuestos del boceto que el usuario no objetó: la pregunta pendiente va siempre antes que el resumen; el resumen no se rearma solo (si cambió algo lo avisa y ofrece "Volver a pedir"); el globo crema es la voz del Avi; "preparando" lleva una barra indeterminada; el Avi suma poses nuevas (pensando, baja, calienta, contando, feliz, error) dibujadas con los trazos de `avis.js`.
> Evoluciona `docs/diseno/estilo-avis-ux.md` (4.3 Columna principal, 6 Movimiento, 6.6 Ventana única, 8 Accesibilidad) y `docs/diseno/marca-avi-ux.md` (3, 7 y 10). Lo que no se nombra acá sigue como está allí.
> El boceto es la referencia visual y de movimiento, con las correcciones de la sección 15.

---

## 1. Brief

- **Qué:** tocar el Avi de la marca le pide a un modelo de lenguaje chico, que corre en la PC, un resumen en pocas frases de lo que Avis ya ve: sesiones, actividad, subagentes, procesos y preguntas. El Avi lo cuenta en un globo crema que nace de él, en la columna principal, entre el encabezado y los cuadros de conteo.
- **Para qué:** contestar "¿en qué anda Claude?" de un vistazo cuando hay varias sesiones y subagentes, sin leer tarjeta por tarjeta.
- **Acción principal:** tocar el Avi (clic sin arrastrar, Enter o Espacio). Con el modelo sin instalar, la acción principal del globo es "Descargar 2,6 GB" (la cifra la da el backend, ver 14).
- **Reglas de oro:**
  1. **Un clic, nunca solo.** La descarga y cada resumen arrancan solo con un clic. Nada se pide, se descarga ni se rearma por tiempo o por cambios.
  2. **El modelo solo resume.** Nunca decide, nunca responde ni sugiere respuestas a una pregunta, nunca toca `respuestas/`.
  3. **Nada sale a la red** salvo la descarga del modelo pedida con un clic.
  4. **Nunca tapa una pregunta:** la tarjeta de pregunta va siempre antes que el globo.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps en un equipo medio con zoom de 200 %. Nada corre cuando no se ve. Sin dependencias nuevas en el frontend.

## 2. Concepto

**La IA tiene cara y voz propias: las del Avi.** No hay un "asistente" nuevo, un ícono de chispas ni una ventana de chat. El mismo Avi que vive en la marca, que juega y te mira, es quien te cuenta. El globo crema ya es su voz (el "¡ey!" de "Te llama", marca-avi-ux.md 5.2); acá crece hasta tener párrafos. Cada estado del modelo es una actuación: mira cómo baja la descarga, calienta la antena mientras se prepara, piensa con puntitos, mueve el pico mientras salen las palabras y queda contento. Tres palabras: **propio, honesto, a pedido**. Lo que se recuerda: **las palabras le salen de la boca.** El pico se mueve al ritmo en que aparecen las palabras del globo, y cuando terminan, el Avi cierra los ojos contento.

## 3. Arquitectura

### 3.1 El disparador: el Avi de la marca es un botón

Hoy `.marca` es un `div` con `data-arrastre` cuyos hijos tienen `pointer-events: none`, y el Avi (`#marca-avi`) lleva `role="img"`. Pasa a:

```
.marca (columna centrada, sigue siendo zona de arrastre, data-arrastre)
├── button#marca-boton.avi-btn   112 × 112, pointer-events: auto
│   ├── span#marca-avi           el Avi (marcaMotion.js), aria-hidden="true"
│   └── span#marca-animo.oculto  "Claude, esperando" (el ánimo real, el texto de hoy)
├── .marca-n  "Avis"
└── .estado   "3 sesiones abiertas"
```

- **Nombre accesible:** `aria-label="¿En qué anda Claude?"`, `aria-describedby="marca-animo"`, `aria-expanded` (`true` con el globo abierto, en cualquier estado salvo cerrado) y `aria-controls="resumen"`. `title="¿En qué anda Claude?"`. El ánimo deja de ser el nombre del Avi y pasa a ser su descripción: el lector oye "¿En qué anda Claude?, botón, contraído. Claude, esperando".
- **Clic contra arrastre:** el `pointerdown` sobre el botón sigue encontrando `.marca` con `closest('[data-arrastre]')`, así que arrastrar desde el Avi sigue moviendo el tablero. Es clic si el puntero se movió **4 px o menos** (`UMBRAL_ARRASTRE`, el mismo de `main.js`). Después de un arrastre real, el `click` que sigue se descarta con `justoArrastro` (como la muesca, `main.js:1524`). Sin Tauri (vista de desarrollo) no hay arrastre y el clic va directo.
- **Teclado:** el botón es el primer elemento enfocable del tablero (ver 10). Enter o Espacio hacen lo mismo que el clic. El foco se ve con el contorno ámbar de 2 px, por dentro (`.lado :focus-visible { outline-offset: -2px }`), con radio 24.
- **Hover, foco y presión** (boceto): el Avi sube 3 px en 280 ms con `--ease`; `:active` lo baja a −1 px con escala .97 en `--d-presion`. Solo `transform`, en el `span#marca-avi`, que no es el grupo que mueve `marcaMotion.js`, así no se pisan.
- **Volver a tocar** el Avi con el globo abierto lo cierra (en cualquier estado; cerrar nunca cancela, ver 6).
- La flotante y la acoplada abierta tienen el mismo disparador. Acoplada y cerrada, la marca no se ve: no hay resumen desde la muesca (era la opción C, descartada).

### 3.2 Dónde va el globo

Orden de la columna principal (estilo-avis-ux.md 4.3), con el hueco nuevo:

1. Encabezado (`h1`, controles).
2. `#otro`: aviso de pregunta de otro proyecto o pregunta plegada.
3. `#w-globo`: tarjeta de pregunta.
4. **`#resumen`: el globo del Avi (nuevo).**
5. `#pp`: hoja de primeros pasos.
6. Cuadros de conteo.
7. Sesiones.

- **Con cola** cuando `#otro` y `#w-globo` están vacíos: el globo queda justo debajo del encabezado y la cola apunta a la boca del Avi de la marca (unos 98 px desde arriba del tablero).
- **Sin cola** cuando hay aviso o pregunta arriba: el globo baja y pierde la cola, porque ya no está a la altura del Avi. Función pura `colaResumen({ hayAviso, hayPregunta })`.
- El tablero sigue con su alto fijo de 640 (estilo-avis-ux.md 4.1): el globo empuja hacia abajo los cuadros y las sesiones, y la columna desplaza. **Al abrirse**, si el globo no se ve entero, la columna se desplaza lo justo para mostrarlo (`scrollIntoView({ block: 'nearest' })`, suave con movimiento, al instante sin él). Nunca se desplaza sola en una lectura de 1,5 s.
- La marca y el globo están en columnas distintas: el globo nunca tapa los proyectos ni la marca.

### 3.3 Qué guarda el estado

`st.resumen` en `main.js`: `{ estado, progreso: { bajado, total }, texto, hora, ms, aceleracion, firma, detalle, motivo, pedido, sinVer, hablando }`.

- `pedido`: número que crece en cada pedido; un resultado con un número viejo se descarta (como `n` en `oficina://puntero-zona`).
- `sinVer`: el resultado llegó con el globo cerrado o el panel plegado.
- `firma`: la de los datos con que se pidió (8.3), para el aviso "Cambió algo".

## 4. Contenido

Textos exactos del boceto, en la voz de Avis (rioplatense, segunda persona, frases cortas). Lo marcado **(propuesto)** no estaba en el boceto o es un número sin medir; lo marcado **(abierto)** depende de una pregunta al usuario (14).

### 4.1 Por estado

| Estado | Rótulo (`.rz-k`) | Título / cuerpo | Acciones (en este orden) | Pie |
|---|---|---|---|---|
| **Apagado** | "Resumen con IA · apagado" | Título: "¿En qué anda Claude? Te lo cuento en pocas frases." Cuerpo: "Un modelo chico, en tu PC, lee lo que Avis ya ve (sesiones, subagentes, procesos y preguntas) y lo resume. Sin internet: nada sale de tu máquina." | Primario "Descargar 2,6 GB" (abierto: la cifra sale de `total`), secundario "Ahora no" | "Qwen3-4B + motor llama.cpp · se puede borrar cuando quieras" (abierto) |
| **Descargando** | "Bajando el modelo" | Cifra "1,1" (`--t-cifra`) + "de 2,6 GB" + "42 %" a la derecha; barra de progreso | Secundario "Cancelar" | "Podés seguir usando Avis mientras baja" |
| **Preparando** | "Preparando · solo la primera vez" | Título: "Acomodando el modelo en tu placa de video". Barra indeterminada. Cuerpo: "Tarda 2 o 3 minutos. Después, cada resumen sale en unos 3 segundos." (abierto: tiempos sin medir) | Secundario "Cancelar" | — |
| **Pensando** | "Pensando · en tu PC" | Título: "Leyendo 3 sesiones, 2 subagentes y 1 proceso" con tres puntitos; esqueleto de tres líneas | Secundario "Cancelar" | En la fila de acciones: "~3 s con la placa de video" o "~11 s solo con CPU", según `aceleracion` (abierto: tiempos sin medir; se muestra solo la que corresponde) |
| **Listo** | "Resumen · 14:32 · 3,1 s en tu PC" | El texto del modelo (`.rz-texto`). Si cambió algo: "Cambió algo desde las 14:32. **Volver a pedir**" | Primario "Copiar" (pasa a "Copiado" 1,6 s), secundario "Volver a pedir" | — |
| **Cerrado** | — | Sin globo | — | — |
| **Sin modelo** | "Falta el modelo" | Título: "No encuentro el modelo en tu PC". Cuerpo: "Puede que se haya borrado o movido. Tus sesiones siguen igual: esto no las toca." | Primario "Descargar de nuevo · 2,6 GB" | — |
| **Falló** | "No salió el resumen" | Título según `motivo` (4.2). Cuerpo: "Tus sesiones siguen igual. Probá de nuevo en un rato." Detalle técnico en mono si el backend lo manda: "llama-server · código de salida 3221225477" | Primario "Probar de nuevo" | — |

- **"Leyendo …"** (`textoPensando`): cuenta lo que se le pasa al modelo y omite lo que vale cero: "Leyendo 1 sesión", "Leyendo 2 sesiones y 1 proceso", "Leyendo 3 sesiones, 2 subagentes y 1 proceso". Plurales con `plural()` de `logica.js`.
- **Hora:** la del reloj de la PC, `HH:MM` de 24 h. **Duración:** una cifra decimal con coma ("3,1 s").
- **Gigas:** `formatoGB(bytes)`, una cifra decimal con coma ("2,6 GB", "1,1").
- La cruz (× "Cerrar el resumen") está en apagado, listo, sin modelo y falló (como el boceto). En descargando, preparando y pensando la salida visible es "Cancelar"; Esc y volver a tocar el Avi cierran igual (6).

### 4.2 Títulos de "Falló" por motivo

| `motivo` | Título |
|---|---|
| `cerrado` | "El motor se cerró antes de terminar" (boceto) |
| `tiempo` | "El motor tardó más de un minuto" (propuesto) |
| `vacio` | "El modelo no devolvió texto" (propuesto) |
| `descarga` | "No se pudo bajar el modelo" (propuesto); el primario es "Probar de nuevo" y vuelve a descargar |
| otro | "No salió el resumen" sin título extra (propuesto) |

### 4.3 El texto del modelo

- Texto plano, nunca HTML: se escapa siempre. `limpiarTexto` recorta espacios, junta saltos repetidos y corta a 600 caracteres (propuesto) en el último fin de frase. Vacío después de limpiar → estado falló con `motivo: 'vacio'`.
- Los nombres de proyecto que aparezcan tal cual en el texto se marcan como etiqueta (`.pj-t`) con el color de su proyecto (`colorProyecto`). Función pura `partesTexto(texto, nombres)` → lista de trozos `{ t }` o `{ proyecto }`. Coincidencia exacta y entera; nunca se inventa una etiqueta.
- "Copiar" copia el texto plano limpio, sin etiquetas.

## 5. Sistema visual

Sin colores ni fuentes nuevos. El globo usa la variante crema del boceto (`.rz-globo`).

### 5.1 El globo

| Pieza | Medida |
|---|---|
| `#resumen` | ancho de la columna principal; con cola, `margin-left: 6px` (ver nota) |
| Fondo / texto | `--crema` / `--tinta` (`#14110C`) |
| Relleno | 14 / 16 / 12 |
| Radio | `--r-tarjeta` (18) |
| Sombra | `0 22px 40px -20px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.05)` |
| Cola | 12 × 20, `left: -11px`, `top: 24px`, `clip-path: polygon(100% 0, 0 50%, 100% 100%)`, `--crema` |
| Cruz | botón de 32 × 32, `top: 6px; right: 6px`, radio 11, ícono de 12 trazo 1,8 `--tinta2`; hover fondo `rgba(20,17,12,.07)` y trazo `--tinta` |
| Contenido | columna con 8 entre bloques; rótulo y título con relleno derecho de 34 y 24 para no chocar con la cruz |
| Texto del resumen | Manrope 500 13,5 / 1,6, `user-select: text`, `cursor: text`; selección `--ambar` con texto `--negro` |
| Alto del texto | `max-height: 152px` (7 líneas), `overflow-y: auto`, `overscroll-behavior: contain`; con desborde, máscara de 12 px abajo y `tabindex="0"` con `aria-label="Texto del resumen"` para desplazar con teclado |
| Aviso "Cambió algo" | píldora de 11 de radio, relleno 6 / 10, fondo `rgba(20,17,12,.07)`, Manrope 600 11,5; enlace 800 subrayado a 3 px, zona de 24 de alto como mínimo |
| Botón primario | 32 de alto, relleno 0 14, `--r-pildora`, `--tinta` con texto `--crema`, hover `#2C271E`; ícono de 13 |
| Botón secundario | igual, transparente, borde `rgba(20,17,12,.28)`, hover borde `--tinta2` |
| Barra | 6 de alto, radio 3, pista `rgba(20,17,12,.12)`, relleno `--tinta` con `transform: scaleX(p)` desde la izquierda y un brillo blanco de 40 px que la recorre |
| Barra indeterminada | tramo del 34 % que va y vuelve (`ida`) |
| Esqueleto (pensando) | tres barras de 9 de alto, radio 5, anchos 100 / 88 / 62 %, brillo que pasa |
| Detalle técnico | Martian Mono 75 400 10 / 1,4, `--tinta2`, fondo `rgba(20,17,12,.07)`, radio 8, seleccionable |
| Etiqueta de proyecto | Martian Mono 75 600 11,5, relleno 1 / 6, radio 6, fondo su color al 45 % sobre crema, texto `--tinta` |
| Foco adentro | contorno de 2 px `--tinta` (el ámbar no se ve sobre crema) |

**Nota de la cola:** `.principal` tiene `overflow-x: hidden` y solo 6 px de relleno a la izquierda (estilos.css 201). Una cola de 11 px que sale del globo quedaría cortada 5 px. Con cola, el globo se corre 6 px a la derecha y la cola entra entera en ese relleno. Sin cola, `margin-left: 0`.

### 5.2 Contraste (WCAG, medido sobre `--crema` #F3EBD8)

| Texto | Ratio |
|---|---|
| `--tinta` #14110C (texto, título, botones) | 15,8 : 1 |
| `--tinta2` #5E574A (cuerpo secundario, detalle) | 6,0 : 1 |
| `#6B6353` (rótulo y pie) | 5,0 : 1 |
| `--crema` sobre el primario `--tinta` | 15,8 : 1 |
| `--tinta` sobre la etiqueta violeta (la más oscura de las cinco) | 11,1 : 1 |
| Relleno de la barra `--tinta` contra la pista (no texto, mínimo 3 : 1) | 15,8 : 1 |

Prohibido bajar la opacidad del texto (estilo-avis-ux.md 3.1). El rojo de "Falló" va solo en el punto del rótulo: el título y el texto dicen el error.

### 5.3 Tokens nuevos

| Token | Valor | Uso |
|---|---|---|
| `--tinta` | `#14110C` | Texto sobre crema (hoy suelto en el globito "¡ey!") |
| `--tinta2` | `#5E574A` | Texto secundario sobre crema |
| `--d-nace` | 480ms | El globo nace de la cola |
| `--d-contenido` | 380ms | Bloques de adentro al cambiar de estado |
| `--d-escalon-c` | 45ms | Retraso entre bloques de adentro |
| `--d-palabra` | 18ms | Retraso entre palabras del resumen |
| `--d-voz` | 360ms | Cambio de pose del Avi |

## 6. Los 8 estados

### 6.1 Transiciones

Reductor puro `transicion(estado, evento)` en `resumen.js`. Las acciones del usuario son las únicas que empiezan trabajo: `descargar`, `pedir`, `cancelar`, `cerrar`, `abrir`. Los eventos del backend solo avanzan lo que ya se pidió.

| Desde | Acción o evento | Hacia | Llamada |
|---|---|---|---|
| cerrado | tocar el Avi, modelo `falta` | apagado | — |
| cerrado | tocar el Avi, modelo `roto` | sin modelo | — |
| cerrado | tocar el Avi, hay descarga, preparación o pedido en curso | ese estado | — |
| cerrado | tocar el Avi, hay un resultado `sinVer` | listo (con "Cambió algo" si cambió) | — |
| cerrado | tocar el Avi, modelo `listo` | pensando (o preparando, si el motor lo avisa) | `pedir_resumen` |
| apagado | "Descargar" | descargando | `descargar_modelo` |
| apagado | "Ahora no", ×, Esc, Avi | cerrado | — |
| descargando | progreso | descargando | — |
| descargando | descarga completa | preparando → pensando → listo | `pedir_resumen` (el clic en "Descargar" incluye el primer resumen) |
| descargando | "Cancelar" | apagado | `cancelar_resumen` |
| descargando | error | falló (`descarga`) | — |
| preparando | listo el motor | pensando | — |
| preparando / pensando | "Cancelar" | cerrado | `cancelar_resumen` |
| pensando | texto | listo | — |
| pensando | error o 60 s sin respuesta | falló (`cerrado`, `tiempo` o `vacio`) | `cancelar_resumen` si fue por tiempo |
| listo | "Volver a pedir" (botón o enlace) | pensando | `pedir_resumen` |
| listo / sin modelo / falló | ×, Esc, Avi | cerrado | — |
| sin modelo | "Descargar de nuevo" | descargando | `descargar_modelo` |
| falló | "Probar de nuevo" | pensando (o descargando si `motivo: 'descarga'`) | `pedir_resumen` o `descargar_modelo` |
| descargando / preparando / pensando | Esc, Avi | cerrado (el trabajo **sigue**) | — |

- **Cerrar nunca cancela.** Solo "Cancelar" cancela. Cerrado durante una descarga, la descarga sigue; al volver a tocar el Avi el globo reabre en el estado en que esté.
- **Sin rearmado:** con el globo en listo, los cambios de datos solo muestran "Cambió algo desde las HH:MM" (cuando `firmaResumen` de ahora difiere de la del pedido). Nunca se pide solo.
- **Sin sesiones:** el tablero pasa al vacío (no hay barra lateral ni globo). `st.resumen` se conserva; un pedido en curso sigue y su resultado queda `sinVer`.

### 6.2 Lo que hace el Avi en cada estado

El Avi del globo es el de la marca. Su pose de voz (`vozAvi`) reemplaza a la de ánimo **salvo** con una pregunta pendiente: entonces manda `teEspera`, como ya decide `animoMarca` (la pregunta va siempre antes). Con el globo cerrado, vuelve la pose de ánimo.

| Estado | Pose | Mirada (`mira`, no sigue al puntero salvo apagado) | Bucles (CSS, en `avis.css`) | Canales sostenidos (`marcaMotion.js`) |
|---|---|---|---|---|
| Apagado | `esperando` | sigue al puntero (como hoy) | respira, parpadea, halo | — |
| Descargando | `baja` | abajo a la derecha, al globo `{ x: .55, y: .6 }` | respira 3,4 s, parpadea 4,8 s, el bulbo titila 1,3 s | — |
| Preparando | `calienta` | al frente | halo `calor` 1,6 s, cuerpo `tiembla` 2,4 s | `par` .9 |
| Pensando | `pensando` (la de hoy, con sus tres puntos) | arriba a la derecha `{ x: .5, y: -.75 }` | cuerpo `piensa` ±2,5° 2,6 s, halo 1,1 s, puntos | — |
| Listo, mientras salen las palabras | `contando` | al globo `{ x: .6, y: .15 }` | respira 1,1 s, halo .9 s | `boca` oscila 0 ↔ .6 cada 170 ms |
| Listo, después | `feliz` | al globo | respira 3,4 s; ojos contentos (`.o-fe`, sin parpadeo) | — |
| Cerrado | ánimo real | como hoy | como hoy | vuelven al reposo en `--d-suelta` (280 ms) |
| Sin modelo / Falló | `error` | al frente | respira 3,4 s; sin halo | `ant` 18°, `luz` −1 (bulbo a .45), `par` .8; cejas visibles |

- `contando` dura lo que la cascada de palabras: `min(420 + n · 18, 1800)` ms; después, `feliz`. Sin movimiento, directo a `feliz`.
- El cambio de pose se marca con un rebote: el `svg` entra de escala .94 × 1,04 a 1 en `--d-voz` con `--rebote`, desde el piso.
- Las poses nuevas se dibujan con lo que `svgAvi` ya tiene en la marca: ojos contentos (`.e-fe`), párpado (`g.parpado`), antena, foco, bulbo y pico partido. Lo único nuevo es el trazo de las cejas, `M44 60.5L52.5 57.5M76 60.5L67.5 57.5` (clase `.trazo`), visible solo en `error`.

### 6.3 Juegos de reposo, "¡ey!" y la pregunta

- **Los juegos se suspenden** mientras el globo no esté cerrado: `marca.animo(animo, reposo && st.resumen.estado === 'cerrado')`. Al cerrarse, la cuenta de quietud vuelve a cero (ya lo hace `reiniciarQuietud` al pasar `reposo` a verdadero).
- **Si "Te llama" o cualquier juego corre** cuando el usuario toca el Avi, el `pointerdown` ya lo suelta (marca-avi-ux.md 7.4): canales al reposo en 280 ms, globito "¡ey!" fundido en 180 ms. El globo del resumen nace después del clic, así los dos globos nunca se ven juntos. Con teclado, el `keydown` hace lo mismo. Prioridad: el globo del resumen siempre gana; el "¡ey!" no puede salir con el globo abierto.
- **La siesta** se corta con el `pointerdown` como hoy (despierta, 1 s) y el globo nace a la vez.
- **Pregunta pendiente:** la tarjeta va arriba (3.2), el globo pierde la cola y el Avi muestra `teEspera`. El modelo puede mencionar la pregunta, nunca responderla (8.4).

### 6.4 Avisos para el lector de pantalla

Una región nueva `#anuncio-resumen` (`p.oculto`, `aria-live="polite"`, `aria-atomic="true"`) **fuera de `#marco`**, así se oye aunque el panel acoplado se pliegue (`#marco` pasa a `visibility: hidden`). Un aviso por estado, una sola vez al entrar en él:

| Estado | Aviso |
|---|---|
| Apagado | "Resumen apagado. Se puede descargar el modelo." |
| Descargando | "Bajando el modelo." (el porcentaje lo dice la barra, `role="progressbar"`, sin avisos por cada cambio) |
| Preparando | "Preparando el modelo. La primera vez tarda 2 o 3 minutos." (abierto, como su texto) |
| Pensando | "Pensando el resumen." |
| Listo | "Resumen listo. " + el texto plano. Con el globo cerrado: "Resumen listo." solo (propuesto) |
| Cerrado | "Resumen cerrado." |
| Sin modelo | "Falta el modelo." |
| Falló | "No salió el resumen." |

Además, "Resumen copiado." al copiar (confirmación de una acción, no de un estado). La región de preguntas `#anuncio` no se toca.

## 7. Convivencia con el resto de la ventana

| Situación | Comportamiento |
|---|---|
| Llega una pregunta con el globo abierto | La tarjeta aparece arriba (con su `sube` de 620 ms), el globo pierde la cola en el mismo cuadro y baja con el FLIP de 9.3. El foco no se mueve. |
| Cambio de proyecto (barra lateral) | El globo no se cierra ni cambia: resume todos los proyectos, no el activo. Entra con la columna (240 ms, estilo-avis-ux.md 6.2) sin volver a nacer. |
| Lectura de 1,5 s | Nunca redibuja el globo si no cambió su modelo (firma propia, como `firmaGlobo`): no se pierde la selección de texto ni el foco. El aviso "Cambió algo" aparece una vez, con `entraC`. |
| Panel acoplado que se pliega | El globo queda en su estado adentro de `#marco` (oculto); el trabajo sigue. Al abrir, está como quedó. El resumen no retiene el panel abierto. |
| Tira mini, bandeja, minimizada | Igual que plegada: nada se anima, el trabajo sigue. |
| Arrastre del tablero (6.6) | El globo viaja con el tablero; no se anima por dentro mientras dura `st.transicion`. |
| Primeros pasos (hoja `#pp`) | La hoja va debajo del globo. El escenario de primeros pasos reemplaza al tablero: no hay marca ni globo. |
| Zoom 100–200 % | Todo en px dentro de la columna: escala junto. La cola sigue apuntando al Avi porque las dos columnas escalan igual. |

## 8. Contrato con el backend (Tauri)

Para el implementador. Nombres en español, como `correr_paso` / `cancelar_paso` / `oficina://primeros-pasos`. Sin código acá.

### 8.1 Comandos

| Comando | Entrada | Devuelve | Red | Cuándo lo llama la UI |
|---|---|---|---|---|
| `estado_resumen` | — | `{ modelo: 'falta' \| 'bajando' \| 'listo' \| 'roto', bajado, total, motor: 'apagado' \| 'preparando' \| 'listo', primeraVez, aceleracion: 'gpu' \| 'cpu' \| null }` | **No.** Solo lee disco y procesos propios | Al arrancar y al tocar el Avi con el globo cerrado. Nunca en el ciclo de 1,5 s |
| `descargar_modelo` | — | `Ok` al empezar | **Sí, la única.** URL fija compilada en el binario | Solo con el clic en "Descargar" o "Descargar de nuevo" (o "Probar de nuevo" con `motivo: 'descarga'`) |
| `cancelar_resumen` | — | `Ok` | No | Solo con el clic en "Cancelar", o al vencer los 60 s de pensando |
| `pedir_resumen` | `{ pedido, datos }` (8.3) | `Ok` al aceptar | No | Solo con un clic (tocar el Avi, "Volver a pedir", "Probar de nuevo", o el clic en "Descargar" que incluye el primero) |

`borrar_modelo` queda reservado: el boceto promete "se puede borrar cuando quieras" pero no dice dónde ni cómo (pregunta abierta 14.2).

### 8.2 Evento `oficina://resumen`

Un solo evento con `tipo`:

| `tipo` | Datos | La UI |
|---|---|---|
| `progreso` | `{ bajado, total }` en bytes, a lo sumo cada 250 ms | Actualiza cifra, porcentaje y barra (`aria-valuenow`) sin redibujar el globo |
| `bajado` | `{ total }` | Pasa a preparando y llama a `pedir_resumen` |
| `preparando` | `{ pedido, primeraVez }` | Preparando (si `primeraVez` es falso, rótulo "Preparando" y título "Despertando el modelo", sin la frase de los minutos: propuesto) |
| `pensando` | `{ pedido }` | Pensando |
| `listo` | `{ pedido, texto, ms, aceleracion }` | Listo con `limpiarTexto(texto)`; descarta si `pedido` no es el último |
| `fallo` | `{ pedido?, motivo, detalle? }` | Falló o sin modelo (`motivo: 'falta'`) |
| `cancelado` | `{ pedido? }` | Nada nuevo: la UI ya cambió al hacer clic |

### 8.3 Qué datos se le pasan al modelo

Función pura `datosResumen(st.proyectos, ahoraMs)` en `resumen.js`, a partir de lo que ya está en `st.proyectos` (`main.js:496`, solo las sesiones propias de la máquina):

- **Por proyecto:** `nombre`.
- **Por sesión:** `tarea` (número), `rama`, `actividad` como la dice el tablero (`textoActividad`), `lleva` (`tiempoRelativo(inicio)`).
- **Subagentes:** `nombre`, `tarea`, `estado`, `desde` relativo.
- **Procesos:** `descripcion`, `desde` relativo.
- **Preguntas:** `encabezado` y el texto de la `pregunta`. **Sin las opciones**, así el modelo no tiene de qué elegir.
- **Nunca:** `archivos`, `usuario`, `nombre` de la persona, `nota`, `repo` completo, datos del equipo (`leer_equipo`), respuestas ni borradores.
- Topes: 12 sesiones, 6 subagentes y 4 procesos por sesión, 200 caracteres por texto (propuestos). `firmaResumen(datos)` se calcula sin los tiempos relativos, así el paso de los minutos no dispara "Cambió algo".

### 8.4 Reglas

1. **Solo resume.** La instrucción fija del modelo vive en Rust, no en la UI: resumir en 2 a 4 frases en castellano rioplatense, solo con hechos de los datos, sin recomendar, sin decidir y sin responder ni sugerir respuestas a una pregunta (puede decir que hay una). La UI no tiene un campo para escribirle al modelo.
2. **Nunca decide.** El módulo de resumen (UI y Rust) no importa `responder.js`, no escribe en `respuestas/` y no tiene acceso a `AskUserQuestion`. Su única salida es el texto del globo.
3. **Nada sale a la red** salvo `descargar_modelo`. La CSP de la ventana no cambia (`connect-src` sigue siendo solo `ipc:`): la descarga la hace Rust. El motor escucha solo en `127.0.0.1` y nunca descarga nada por su cuenta.
4. **Integridad:** el archivo bajado se verifica contra un hash fijo antes de usarlo; si no coincide, se borra y el estado es `roto` (sin modelo).
5. **Dónde vive:** fuera de OneDrive (en `%LOCALAPPDATA%`, como el `target` de cargo, CLAUDE.md "Instalador del widget"). Carpeta exacta: decisión del backend.
6. **Un pedido por vez:** un `pedir_resumen` nuevo cancela el anterior; gana el `pedido` más alto.
7. **Sin texto del modelo como HTML:** la UI escapa todo (4.3).

## 9. Movimiento

Sin dependencias nuevas: CSS para los bucles y Web Animations API para las secuencias, como `muescaMotion.js` y `marcaMotion.js` (marca-avi-ux.md 12: el widget no usa anime.js). Módulo nuevo `widget/src/resumenMotion.js`. **Solo `transform` y `opacity`.**

### 9.1 Tiempos

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Nace el globo | opacidad 0 → 1, escala .9 → 1 desde la cola (`transform-origin: 0 34px`; sin cola, `50% 0`) | `--d-nace` 480 ms, `--rebote` |
| Bloques de adentro | opacidad 0 → 1, `translateY` 5 → 0, en cascada | `--d-contenido` 380 ms, `--ease`, `índice × 45 ms` |
| Palabras del resumen | cada palabra `inline-block`: opacidad 0 → 1, `translateY` 4 → 0 | 420 ms, `--ease`, `índice × 18 ms`, retraso topado en 900 ms |
| Cambio de estado | el contenido viejo se reemplaza y entra en cascada; los hermanos de abajo (`#pp`, cuadros, sesiones) hacen FLIP: `translateY` desde la diferencia de alto hasta 0 | 340 ms, `--ease` |
| Se cierra | opacidad 1 → 0, escala 1 → .96 hacia la cola; después se quita y los hermanos suben con FLIP | 200 ms, `--ease-cierra`; FLIP 340 ms `--ease` |
| Barra | `scaleX` sigue al progreso | 120 ms lineal; brillo 1,6 s en bucle |
| Barra indeterminada | el tramo va de −110 % a 310 % | 1,5 s, `--ease`, en bucle |
| Puntitos y esqueleto | puntos 1,1 s escalonados a 140 ms; brillo del esqueleto 1,4 s lineal | bucle |
| "Copiar" → "Copiado" | cambio de texto, sin animación | 1,6 s y vuelve |
| Pose del Avi | rebote de cambio | `--d-voz` 360 ms, `--rebote` |
| Hover / foco / presión del Avi | sube 3 px; presión −1 px y .97 | 280 ms `--ease`; 140 ms |

- **La palabra no lleva `blur`** (el boceto usaba `filter: blur(2px)`): el filtro animado se rasteriza en cada cuadro.
- **El alto del globo no se anima** (el boceto animaba `height`): se mueve lo de abajo con FLIP. El globo mismo cambia de alto de un cuadro al otro, tapado por la cascada.
- Sin cascada de palabras en una lectura de 1,5 s ni al reabrir un resultado ya visto: entra entero con `entraC`.

### 9.2 Pausa

- **`prefers-reduced-motion: reduce` y `body.pausa`:** el globo aparece y se va al instante, el texto entero de una vez, sin FLIP, la barra salta al valor sin brillo, la indeterminada queda quieta (tramo del 34 % centrado), sin puntos ni esqueleto que se muevan, el Avi quieto en su pose (sin `contando`: directo a `feliz`). El estado se sigue leyendo en el texto.
- **Panel acoplado plegado, `body.fuera` y tira:** los bucles CSS ya se pausan con las reglas de `estilos.css` 476 y 710. `resumenMotion.js` termina al instante cualquier animación en curso (`finish()`) y `marcaMotion.js` corta los canales con `visible(false)`, como hoy.
- **Una animación por vez:** un estado nuevo termina la animación anterior (`finish()`) antes de empezar.
- Nada titila más de tres veces por segundo: el pico de `contando` cambia cada 170 ms, pero es movimiento, no destello; el destello más rápido sigue siendo el del foco de la marca (300 ms).

## 10. Accesibilidad

- **Encabezados:** el globo es `<section id="resumen" aria-labelledby="h-resumen">` con `<h2 class="oculto" id="h-resumen">¿En qué anda Claude?</h2>`. Un solo `h1` (el proyecto); sin saltos.
- **Orden del foco** (actualiza estilo-avis-ux.md 8): 1. el Avi de la marca; 2. proyectos; 3. compañeros; 4. controles de ventana; 5. aviso; 6. pregunta; 7. el globo (sus botones, el enlace y el texto si desborda).
- **Al abrir con clic o teclado** el foco va al primer `data-foco` del globo (el primario, o "Cancelar"): el usuario lo pidió. **Al cambiar de estado** con el foco adentro, el foco pasa al `data-foco` del estado nuevo (si no, se perdería con el redibujo). Con el foco afuera, nunca se mueve.
- **Esc:** con el foco adentro del globo o en el Avi y el globo abierto, cierra y devuelve el foco al Avi. Va **antes** que el Esc que pliega la pregunta y que el que cierra la muesca (`main.js:825-838`), y solo si el foco está en el globo o en el Avi: con el foco en la pregunta, Esc sigue plegando la pregunta.
- **×, "Ahora no":** cierran y devuelven el foco al Avi.
- **Barra:** `role="progressbar"`, `aria-label="Descarga del modelo"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow`. La indeterminada: `aria-label="Preparando el modelo"` sin `aria-valuenow`.
- **Puntitos y esqueleto:** `aria-hidden`.
- **Zonas de toque:** 32 × 32 como mínimo (estilo-avis-ux.md 8): botones de 32 de alto, cruz de 32, enlace de 24 de alto dentro de una píldora de 30 (supera 24 × 24 de WCAG 2.2). El Avi, 112 × 112.
- **Contraste:** 5.2. Foco `--tinta` sobre crema 15,8 : 1; ámbar sobre negro en el Avi, 11,5 : 1.
- **El color nunca va solo:** el error tiene título y texto, el progreso tiene cifra y porcentaje, las etiquetas de proyecto tienen el nombre.
- **Selección:** solo el texto del resumen y el detalle técnico son seleccionables; el resto del tablero sigue como está.

## 11. Mapeo a código

| Archivo | Qué cambia |
|---|---|
| `widget/src/resumen.js` (nuevo, puro, sin DOM) | `transicion`, `datosResumen`, `firmaResumen`, `textoPensando`, `formatoGB`, `limpiarTexto`, `partesTexto`, `contenidoResumen(modelo)` (HTML del globo por estado, con los textos de 4), `anuncioResumen`, `vozAvi(estado, hablando, animo)`, `colaResumen`, `MOTIVOS_FALLO`, `TOPES_RESUMEN` |
| `widget/src/resumenMotion.js` (nuevo) | `nace`, `cierra`, `cambia` (cascada y FLIP de hermanos), `palabras`, `terminar`; Web Animations; respeta movimiento reducido y `body.pausa` |
| `widget/src/main.js` | `st.resumen`; clic y teclado del Avi (con `justoArrastro` y el umbral); Esc antes de los otros; `invocar` de los cuatro comandos; `escuchar('oficina://resumen')`; poner `#resumen` con firma propia; foco; `scrollIntoView`; `marca.animo(…, reposo && cerrado)` y `marca.voz(…)` en `pintar()`; aviso en `#anuncio-resumen` |
| `widget/src/index.html` | `button#marca-boton.avi-btn` que envuelve `#marca-avi`, `#marca-animo`; `section#resumen` entre `#w-globo` y `#pp`; `#anuncio-resumen` junto a `#anuncio` |
| `widget/src/estilos.css` | `--tinta`, `--tinta2` y los tiempos de 5.3; `.marca .avi-btn { pointer-events: auto }`; sección `#resumen` (5.1); `#resumen:empty { display: none }` y `contain: inline-size` como `#w-globo`; ocultarlo en `#marco.vacio`, `.cargando` y `.escenario` |
| `widget/src/avis.js` | Poses `baja`, `calienta`, `contando`, `feliz`, `error` en `POSES` (solo las usa la marca; ningún ánimo de sesión las devuelve); trazo de cejas en la marca |
| `widget/src/avis.css` | Bucles de 6.2 (`titila`, `calor`, `tiembla`, `piensa`) dentro de `prefers-reduced-motion: no-preference` y `body:not(.pausa)`; cejas visibles solo en `error` |
| `widget/src/marca.js` | `VOCES`: por pose de voz, los canales sostenidos y la `mira` de 6.2, como datos (igual que `ACTOS`) |
| `widget/src/marcaMotion.js` | `voz(pose \| null, { hablando })`: con voz, cancela juego y siesta, no programa reposo, pone la pose (redibujo con rebote) y lleva los canales a `VOCES[pose]` en 360 ms; `contando` mueve `boca`; `null` vuelve al ánimo con la salida de 280 ms |
| `widget/src/tablero.js` | `figuraMarca` sin `alt` (aria-hidden); nueva `animoTexto(animo)` para `#marca-animo` ("Claude, esperando") |
| `widget/src/logica.js` | `UMBRAL_ARRASTRE` y `superaUmbral(dx, dy)` se mudan acá desde `main.js`, para usarlos y probarlos en un solo lugar |
| `widget/src-tauri/src/resumen.rs` (nuevo) | Los comandos de 8.1, el evento de 8.2, las reglas de 8.4; se registra en `lib.rs` |
| `widget/dev/falso.js`, `dev/vista.html` | Comandos y eventos falsos; `vista.html?resumen=<estado>` salta a cualquiera de los 8 y `&rapido=1` acorta la descarga |

## 12. Tests que fijan cada regla

`node --test "test/**/*.test.js"` en `widget/`, y `cargo test` para Rust.

| Regla | Test |
|---|---|
| Un clic, nunca solo: ningún evento del backend lleva de cerrado o apagado a descargando o pensando | `test/resumen.test.js`: `transicion` con cada evento (`progreso`, `bajado`, `listo`, `fallo`…) desde cerrado y apagado no devuelve `descargando` ni `pensando`; solo `descargar` y `pedir` lo hacen |
| Cerrar nunca cancela | `transicion(descargando \| preparando \| pensando, cerrar)` → cerrado y sin llamada `cancelar_resumen` en el plan devuelto |
| Cancelar en preparando no ofrece descargar | `transicion(preparando, cancelar)` → cerrado (no apagado) |
| Sin rearmado | Con estado listo, un cambio de `firmaResumen` devuelve listo con `cambio: true`, nunca pensando |
| Datos permitidos | `datosResumen` incluye sesiones, actividad, subagentes, procesos y el texto de las preguntas; no incluye `archivos`, `usuario`, `nombre`, `nota`, opciones ni respuestas; respeta los topes |
| La firma ignora el reloj | `firmaResumen` igual con `ahoraMs` + 10 min; distinta si cambia una actividad o llega un subagente |
| Textos exactos por estado | `contenidoResumen` de los 8 estados contiene los textos de 4.1; la cruz solo en apagado, listo, sin modelo y falló; un solo primario por estado; la barra con sus `aria-*` |
| "Leyendo…" | `textoPensando` omite los ceros y usa plurales |
| Texto del modelo seguro | `partesTexto` con `<img onerror>` lo devuelve como texto escapado; marca solo nombres exactos; `limpiarTexto` corta a 600 en fin de frase y devuelve `null` si queda vacío |
| Un aviso por estado | `anuncioResumen` de los 8 estados con los textos de 6.4 |
| La pregunta va antes | `colaResumen({ hayPregunta: true })` → sin cola; `vozAvi(…, 'teEspera')` → `teEspera` |
| El modelo no responde | `contenidoResumen` nunca contiene `data-accion="op"`, `data-pregunta` ni `data-globo`; `resumen.js` no importa `responder.js` (test que lee los `import` del módulo) |
| Juegos suspendidos | `test/marca.test.js`: con `voz` puesta, `jugable` es falso y `proximoReposo` no programa; cada pose de `VOCES` deja los canales dentro de la zona de juego y `null` los devuelve al reposo |
| Clic contra arrastre | `test/logica.test.js`: `superaUmbral(3, 2)` falso, `superaUmbral(4, 0)` falso, `superaUmbral(3, 3)` verdadero |
| Nombre del Avi | `test/tablero.test.js` (actualizar 319–320): `figuraMarca` es `aria-hidden`; `animoTexto('coordinando')` → "Claude, coordinando el equipo" |
| Nada sale a la red salvo la descarga | `resumen.rs`: la URL es una constante; `estado_resumen` y `pedir_resumen` no construyen cliente HTTP; el motor se lanza con `--host 127.0.0.1`; un archivo con hash distinto queda `roto` |
| Un pedido por vez | `resumen.rs` y `resumen.test.js`: un resultado con `pedido` viejo se descarta |
| El widget nunca decide por el usuario | `hooks/oficina.test.tsx` y `widget/test/responder.test.js` siguen sin cambios y en verde |

## 13. Responsive y zoom

El widget no tiene breakpoints: el tablero mide siempre 188 + 460 de ancho y 640 de alto, y crece con el zoom de `<html>` (100 a 200 %). La revisión visual se hace con Playwright en `dev/vista.html` al 100, 150 y 200 %, en los 8 estados, con y sin pregunta, con movimiento y sin él. Los anchos de 375, 768 y 1440 no aplican a esta ventana (igual que marca-avi-ux.md 9).

## 14. Preguntas abiertas para el usuario

1. **El modelo y la oferta:** ¿Qwen3-4B con llama.cpp, unos 2,6 GB? Los textos "Descargar 2,6 GB", "Qwen3-4B + motor llama.cpp", "~3 s con la placa de video · ~11 s solo con CPU" y "Tarda 2 o 3 minutos" quedan pendientes hasta elegirlo y medir en una PC real. La cifra de gigas sale de `total`; los tiempos, de una medición.
2. **Borrar el modelo:** el pie promete "se puede borrar cuando quieras". ¿Dónde: un ítem de la bandeja, un enlace en el globo apagado/listo, o nada por ahora (y se saca la promesa)?
3. **Cancelar la descarga:** ¿descarta lo bajado (simple; "Descargar" empieza de cero) o lo guarda para seguir ("Seguir descargando · faltan 1,5 GB")?

## 15. Correcciones al boceto

- **Cancelar en preparando** volvía a apagado y ofrecía "Descargar 2,6 GB" con el modelo ya bajado. Pasa a cerrado.
- **El alto animado** del contenido (`height` en 340 ms) se reemplaza por FLIP de lo de abajo (9.1).
- **`blur` en las palabras** se quita (9.1).
- **Cerrar durante la descarga** cancelaba en el boceto (era la simulación). Cerrar nunca cancela (6.1).
- **La cola** pasa a 6 px de margen por el recorte de `.principal` (5.1).

## 16. Handoff

Orden de construcción, cada paso con sus tests:

1. `logica.js`: `superaUmbral`. `resumen.js` entero con `test/resumen.test.js`.
2. `avis.js`, `avis.css`, `marca.js` (`VOCES`), `marcaMotion.js` (`voz`), con `marca.test.js` y `avis.test.js`.
3. `tablero.js` (`figuraMarca`, `animoTexto`), `index.html` (botón, `#resumen`, `#anuncio-resumen`), `estilos.css`; actualizar `tablero.test.js`.
4. `resumenMotion.js` y el cableado en `main.js` contra `dev/falso.js`; revisar en `vista.html` los 8 estados al 100 y 200 %.
5. `resumen.rs` y su registro en `lib.rs`, con `cargo test`. Probar en la ventana real: descarga, cancelar, preparando, pensando, listo, sin modelo (borrando el archivo) y falló (matando el motor).

**No improvisar:** los textos de 4 (lo marcado abierto espera al usuario), el orden de 3.2, las transiciones de 6.1 (sobre todo que cerrar no cancela y que nada arranca sin clic), la tabla de poses de 6.2, los datos permitidos y prohibidos de 8.3, las reglas de 8.4, los tiempos de 9 y solo `transform` y `opacity`. Cualquier estado, texto o acción nueva vuelve a diseño.
