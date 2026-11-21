# Avis · panel "Escenario + chips": la columna principal — dirección

> Opción 01 del boceto `docs/diseno/bocetos/panel-avis.html` (2026-11-21), elegida por el usuario: «la opcion de escenario + chips».
> Evoluciona `docs/diseno/estilo-avis-ux.md` (4.3 Columna principal, 4.4 Tarjeta de sesión y ficha, 6 Movimiento). Todo lo que no se nombra acá sigue como está allí. La cabecera de la barra lateral es de `docs/diseno/marca-avi-ux.md` y no cambia con esta dirección.
> El boceto es la referencia de medidas y movimiento (caso A: 1 sesión y 2 subagentes; B: 1 sesión y 5; C: 2 sesiones). Se corrigió al especificar: ver 12.

---

## 1. Brief

- **Qué:** la columna principal del tablero (460 × 640, `--ancho-principal` × `--alto-tablero`) cambia en dos piezas. Los tres cuadros de conteo pasan a ser **una fila de chips** de 26 px. Cada tarjeta de sesión pasa a ser **un escenario**: el Avi de Claude de 96 px parado en un piso, su equipo de Avis de cuerpo entero (58 px) en el mismo piso y **hilos de coordinación** desde su antena hacia los que trabajan.
- **Para qué:** los Avis son los protagonistas. Con una mirada se sabe quién trabaja, quién terminó y para quién trabajan, sin leer.
- **Acción principal:** ninguna nueva. La columna se mira: los únicos controles siguen siendo los del encabezado, los avisos y la tarjeta de pregunta.
- **Regla de oro:** el texto nunca se pierde. Lo que el escenario abrevia o corta va completo en `title` y en el nombre accesible.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps en un equipo medio con el zoom de 200 %, nada que corra cuando no se ve.

## 2. Concepto

**Un ensayo con el director en escena.** Cada sesión es un escenario chico: un piso con una línea de luz, Claude grande a la izquierda (el director, con su antena) y su elenco en fila, cada uno haciendo lo suyo. Los hilos punteados ámbar que salen de la antena son las órdenes que viajan: un punto de luz recorre cada hilo hacia quien está trabajando. Cuando alguien termina, festeja, se duerme y su hilo se corta. Tres palabras: **legible, vivo, en escala**. Lo que se recuerda: **los puntos de luz que viajan de la antena a cada Avi que trabaja.**

## 3. Arquitectura de la columna

Orden del DOM (sin cambios salvo los conteos):

```
main.principal (columna flex, separación 10, scroll propio)
├── header.cab        sticky: h1 del proyecto, línea "1 sesión · 3 subagentes trabajando", controles
├── #otro             aviso de pregunta en otro proyecto / aviso del asistente
├── #w-globo          tarjeta de pregunta, su aviso plegado o "Listo, le respondiste…"
├── #pp               hoja de primeros pasos
├── #conteos.conteos  ← NUEVO: fila de chips (reemplaza a #cuadros.stats)
└── section.sesiones  h2 oculto "Sesiones" + #sesiones: una tarjeta escenario por sesión
```

- **Jerarquía del primer vistazo:** Claude de 96 (el Avi más grande de la ventana después de la marca) → el elenco y los hilos → la línea "ahora · …" → los chips.
- **Presupuesto de alto** (medido en `widget/dev/ventana.html`: la columna muestra 628 px, el encabezado mide 55, la separación es 10, la tarjeta de pregunta de una opción mide 230):

| Caso | Alto usado | Resultado |
|---|---|---|
| 1 sesión | 55 + 10 + 26 + 10 + 205 = **306** | aire de sobra |
| 2 sesiones | 306 + 10 + 205 = **521** | entran sin scroll |
| 3 o más sesiones | 736 o más | scroll dentro de la columna; el encabezado queda fijo y lo que pasa debajo se funde en 8 px (ya existe) |
| Pregunta + 1 sesión | 55 + 10 + 230 + 10 + 26 + 10 + 205 = **546** | entra |
| Pregunta + 2 sesiones | 761 | scroll; la pregunta queda primera |

## 4. Fila de chips

Reemplaza a los tres cuadros de `cuadros()`. Los números salen de `conteos()` sin cambios.

```
div#conteos.conteos   flex, wrap, separación 6
├── .conteo  ● 3 trabajando
├── .conteo  ● 2 terminados · 1 con error     (la parte roja solo si hay fallidos)
└── .conteo  ◷ 18 h 43 m lleva                (o "la más larga" con varias sesiones)
```

| Pieza | Medida |
|---|---|
| `.conteo` | `inline-flex`, `align-items: center`, separación 7, alto 26, relleno 0 / 11, `--r-pildora`, `--s1`, borde 1 `--linea` |
| Rótulo | `--t-rotulo` (mono 500 10), `--crema2`, `font-stretch: 75%` |
| Punto | 7 × 7, círculo, `--ambar` (trabajando) o `--verde` (terminados) |
| Reloj | SVG de 11 del boceto (círculo r 4,8 y agujas), trazo `--violeta` 1,5 |
| Cifra (`b`) | Manrope 800 12,5 / 1, `--crema`, `letter-spacing: -.02em` |
| Unidades de la cifra (`.u`, de `cifraConUnidades`) | Manrope 700 **10 px** (no `.58em`: a 12,5 daría 7 px), `--crema2` |
| Error | `<span class="conteo-err">· <b>1</b> con error</span>`, mono 10 `--rojo` (7,7:1 sobre `--s1`), cifra en Manrope 800 `--rojo` |

- **Tiempo:** `cifraConUnidades(tiempoCorto(c.tiempo))`. Rótulo `"lleva"` si `c.rotuloTiempo === 'lleva la sesión'`, si no `"la más larga"`. Sin `inicio`: "—".
- **Plural:** "1 terminado" / "2 terminados"; "trabajando" no cambia.
- **Accesibilidad:** cada chip es `role="group"` con el mismo `aria-label` de hoy ("3 subagentes trabajando", "2 subagentes terminados, 1 con error", "La sesión lleva 18 h 43 min"); su contenido va `aria-hidden`.
- **Ancho:** los tres chips más el error suman unos 370 px de 438 con `font-stretch: 75%`. Si no entran (zoom raro, cifra larga), bajan a una segunda fila; nunca se cortan.
- **Nombre de clase:** `.conteo`, **no** `.chip`: `.chip` ya es el contador de la barra de proyectos y de la muesca (`estilos.css:144`).

## 5. Tarjeta escenario

### 5.1 Estructura

```
article.ses                         --s1, borde 1 --linea, radio 18, relleno 12 / 14 / 4
├── .ses-cab                        flex, align center, separación 8, alto 20
│   ├── h3.ses-tit                  tag "#12" (o "sin tarea") + rama
│   └── span.lleva                  "2 h 10 min", margin-left auto
├── p.linea                         punto + "ahora · coordinando el equipo"
└── div.esc                         el escenario, 408 × 146, position relative
    ├── .piso
    ├── .avi (Claude, 96)
    ├── ul.elenco[aria-label="Subagentes"]
    │   ├── li.sub × hasta 4        Avi de 58 + rótulo
    │   └── li.mas                  pila "+n" (solo con 5 o más)
    ├── svg.hilos                   trazos punteados, aria-hidden
    └── i.hilo-pt × n               puntos que viajan, aria-hidden
```

- **Cabecera:** tag como hoy (`.tag`: mono 10,5 / 600, negro sobre ámbar; "sin tarea" sobre `--s3` en `--crema2`). La rama en `--t-titulo` (800 14,5), **una línea** con elipsis y `title` con la rama entera (hoy se parte en varias líneas). "lleva" en `--t-mono`, `--tenue` (5,3:1), con "lleva " oculto para lectores como hoy.
- **Línea:** `margin-top: 5px`, 700 12,5 / 1,3, color de `colorEstado(animo)`, punto `.pt` existente, texto de `textoActividad` y `title` de `tituloActividad`. Una línea con elipsis.
- **Alto de la tarjeta:** 1 + 12 + 20 + 5 + 16 + 146 + 4 + 1 = **205** (medido en el boceto). Sin subagentes, 177 (5.5).
- **Al pasar el mouse:** solo el borde a `--linea-hover` (sin elevarse), como hoy.

### 5.2 Geometría del escenario

Todo en px del escenario (el zoom de `<html>` escala junto). La fuente única es la función pura `geometriaEscena(k)` de 9.1; el CSS solo da el tamaño de la caja.

| Pieza | Valor |
|---|---|
| Caja `.esc` | 408 × 146 (`--ancho-escena`, `--alto-esc`). 408 = interior medido de la tarjeta (438 − 2 − 28) |
| Pies de un Avi | a `round(t × 0,867)` de su borde superior (y 104 de 120) |
| Piso (`F`) | y = 98 |
| Claude | t 96, x 2, y = 98 − 83 = **15** |
| Foco de la antena (origen de los hilos) | (x + 48, y + round(96 × 14 / 120)) = **(50, 26)** |
| Zona del elenco | x0 = 110, ancho 298 |
| Ranuras | `k` = visibles + (pila ? 1 : 0); ancho `SW = min(112, floor(298 / k))`: 1 o 2 → 112, 3 → 99, 4 → 74. Alineadas a la izquierda, en orden |
| Ranura `j` | x = 110 + j × SW |
| Avi del elenco | t 58, x = ranura + (SW − 58) / 2, y = 98 − 50 = **48** |
| Destino del hilo | (x del Avi + 29, 48 + round(58 × 0,26)) = (centro, **63**): la coronilla |
| Rótulo | x de la ranura, y 101, ancho SW, centrado |
| Pila "+n" | caja de la ranura: x, y 52, ancho SW, alto 52 |
| Cabecitas de la pila | t 36, hasta 3; x = 4 + i × paso, `paso = min(24, floor((SW − 44) / (m − 1)))`; y alterna 2 / 8 |

El contenido nunca sale de la caja: el Avi de Claude con ondas, burbujas o "!" llega a x ≈ 91 (antes de 110) y a y ≥ 5; la burbuja "!" de un Avi de 58 queda dentro de su ranura de 74.

### 5.3 Piezas nuevas

| Pieza | Dibujo |
|---|---|
| **Piso** (`.piso`, CSS, sin SVG) | `position: absolute; left: -12px; right: -12px; top: 92px; height: 18px`. Dos fondos: `radial-gradient(120px 10px at 64px 6px, rgba(242,182,50,.20), transparent 70%)` (la luz bajo Claude) y la línea `linear-gradient(90deg, transparent, #1E1E23 12%, #1E1E23 88%, transparent)` de 1 px a 6 px de su borde superior (y 98). `#1E1E23` es decorativo, sin requisito de contraste. |
| **Objetos según la actividad** | Son los de la pose de `avis.js`, sin muebles nuevos: notebook (`escribiendo`, logo verde con `comando`), libro (`leyendo`), anillo celeste (`proceso`), burbuja "!" (`teEspera`), ondas desde el foco (`coordinando`), burbujas de idea (`pensando`), "z" (`inactiva`, `durmiendo`), chispas (`listo`), nube con "x" (`fallo`). A 96 px se leen sin texto. |
| **Hilo** (`svg.hilos`, `position: absolute; inset: 0; overflow: visible; pointer-events: none`) | Un `path` por hilo: `M bx by Q (bx+tx)/2 min(by,ty)−24 tx ty` (control en y = 2). Trazo `--ambar` 1,4, `stroke-dasharray: 2 5`, `stroke-linecap: round`, opacidad .55, sin relleno. |
| **Punto del hilo** (`i.hilo-pt`, HTML) | 5 × 5, círculo `--ambar`, `position: absolute; left: 0; top: 0; offset-path: path('<el mismo d>'); offset-rotate: 0deg; opacity: 0`. Anima en 8.2. |
| **Pila "+n"** (`li.mas`) | Caja con `::before` en `inset: -6px -2px -44px`, borde 1 punteado `--linea-hover`, radio 13, fondo `rgba(255,255,255,.015)` (cubre cabecitas y rótulo). Cabecitas de 36 en `durmiendo`, **quietas** (sin respiración ni "z"). |

### 5.4 El elenco

**Quiénes y en qué orden** (decidido):

- Hasta **4** subagentes: van todos, una ranura cada uno.
- **5 o más:** 3 ranuras + la pila "+n" con los demás. Las 3 se eligen con la prioridad de hoy (`ORDEN_ANIMO`: pregunta, trabajo, falló, listo, durmiendo): los que trabajan quedan afuera de la pila y los terminados se apilan dormidos.
- Las ranuras muestran a los elegidos **en el orden en que se lanzaron** (regla de hoy, 4.4): un Avi que termina se duerme en su lugar, no salta al final.

**Rótulo de cada Avi** (`li.sub`):

| Línea | Estilo | Contenido |
|---|---|---|
| Nombre (`b`) | Manrope 800 12 / 1,25, color de su personaje (`--c` = `a.color`; todos ≥ 7:1 sobre `--s1`) | `a.nombre` |
| Tarea (`span`) | 500 11 / 1,25, `--crema2` (9,6:1), **una línea** con elipsis, relleno 0 / 3 | `a.tarea` entera en el DOM (la elipsis es solo visual) |
| Estado (`em`, `aria-hidden`) | `--t-mono-s` (mono 500 10 / 1,3), `font-stretch: 75%`, color de `colorEstado(estadoLista(a))` | abreviado: "escribe 5m" |
| Estado completo (`span.oculto`) | oculto | "escribiendo · 5 min" (`textoEstado` · `tiempoSubagente`) |

- **Estado abreviado** (`estadoCorto(a, ahoraMs)`, decidido): verbo corto + tiempo mínimo.

  | Estado | Corto | Estado | Corto |
  |---|---|---|---|
  | escribiendo, comando | "escribe" | listo (y dormido listo) | "listo" |
  | leyendo | "lee" | falló (y dormido falló) | "falló" |
  | teEspera | "pregunta" | esperando / inactiva | "espera" / "inactiva" |

  Tiempo (`tiempoMini`, de `tiempoSubagente` sin "hace "): "menos de 1 min" → "<1m", "5 min" → "5m", "2 h 5 min" → "2h5m", "2 h" → "2h". Ejemplos: "escribe 5m", "listo 8m", "pregunta <1m". Lo más largo ("escribe 12h59m", 14 caracteres) entra en 74 px.
- **`title` del `li`:** `Delfina — dirección marca B (escribiendo · 5 min)`, el mismo formato de `textoMas`. Si el nombre es inventado, el tipo va después del nombre: `Bruno (Explore) — …`, y también en el texto oculto. El tipo **deja de verse** en el escenario (hoy va debajo del nombre en la ficha).
- **Dormido:** el Avi al 60 % de opacidad (regla de hoy); el texto nunca se atenúa.
- **Pila "+n":** rótulo `b` "+2" (Manrope 800 15, `--crema`) y `span` "terminados" si todos los de la pila terminaron, si no "más". Lleva `title` y un `span.oculto` con `textoMas(ocultos)` ("2 subagentes más: Bruno — tests de muesca (listo); …"); lo visible va `aria-hidden`. No es un control: sin hover, sin foco.

### 5.5 Hilos: cuándo hay

- Un hilo por ranura cuyo subagente tiene `estado === 'trabajando'` (incluye al que te pregunta). Uno hacia la pila si alguno de la pila trabaja.
- No dependen del ánimo de Claude: también se ven si Claude te hace una pregunta mientras su equipo trabaja.
- Un subagente que termina pierde su hilo en el redibujo (sin salida animada: el festejo de su Avi es el momento).

### 5.6 Variantes de la tarjeta

| Caso | Qué cambia |
|---|---|
| **Sin subagentes** | `.esc.solo`: alto 118 (sin la franja de rótulos), Claude en el mismo lugar. En la zona del elenco, a x 110 e y 80, "sin subagentes" en mono 10 `--tenue` (5,3:1) (*propuesto*). Al llegar el primero, la tarjeta crece 28 px y el Avi entra (8.3). |
| **Claude te pregunta** | Pose `teEspera` (burbuja "!" ámbar) y la línea "ahora · te hace una pregunta" en ámbar. La tarjeta de pregunta está arriba, en `#w-globo`. |
| **Un subagente te pregunta** | Su Avi en `teEspera`, estado "pregunta 2m" en ámbar. Por prioridad nunca queda en la pila. Conserva su hilo. |
| **Procesos en segundo plano** | Pose `proceso` (anillo celeste) y la línea en `--celeste` con los procesos en el `title` (5.5 de estilo-avis). |
| **Inactiva** | Pose `inactiva` (ojos cerrados y "z"), línea "sin actividad hace 25 min" en `--tenue`. |

## 6. Estados de la columna

| Estado | Qué se ve |
|---|---|
| **Cargando / vacío** | Sin cambios (4.6 de estilo-avis): marco compacto con el Avi de 120. Los selectores que hoy esconden `.stats` pasan a `.conteos`. |
| **Error de lectura** | Sin cambios: quedan los últimos datos, el escenario sigue animado y el pie va en `--rojo`. |
| **Pregunta en este proyecto** | Orden: `#otro` (si además hay una de otro proyecto) → tarjeta de pregunta → chips → escenarios. El encabezado dice "… · te hace una pregunta". La tarjeta de pregunta no se mueve ni se achica por el escenario; con 2 sesiones la columna hace scroll (3). |
| **Pregunta plegada ("Más tarde")** | El aviso de 38 en `#w-globo`; el escenario sigue mostrando al que pregunta en `teEspera`. |
| **Pregunta en otro proyecto** | El aviso de `#otro` arriba de todo, como hoy. |
| **Hoja de primeros pasos abierta** | Esconde chips y escenarios (`#marco.con-hoja .conteos, … .sesiones`). |
| **3 o más sesiones** | Mismo escenario, scroll dentro de la columna. Las tarjetas fuera de la vista pausan sus animaciones (8.5). |

## 7. Tokens

Sin colores nuevos. Nuevos:

| Token | Valor | Uso |
|---|---|---|
| `--ancho-escena` | 408px | Caja `.esc` |
| `--alto-esc` | 146px | Escenario con elenco |
| `--alto-esc-solo` | 118px | Escenario sin subagentes |
| `--alto-conteo` | 26px | Chips |
| `--d-viaje` | 1800ms | Recorrido de un punto por su hilo |
| `--cada-hilo` | 600ms | Desfase entre los puntos de una tarjeta |

**No** usar `--alto-escenario`: ya existe (600 px, primeros pasos). Las posiciones salen de `ESCENA` en `tablero.js` (`{ ancho: 408, piso: 98, claude: { t: 96, x: 2 }, x0: 110, zona: 298, ranuraMax: 112, sub: 58, pila: 36 }`), no del CSS.

## 8. Movimiento

Todo CSS con las clases que pone el módulo de movimiento, como el resto del tablero. No hace falta anime.js aquí: no hay secuencias que coordinar con la ventana de Tauri (anime.js sigue preaprobado si algún día hace falta). Solo `transform` y `opacity`.

### 8.1 Los Avis

Los bucles de `avis.css` sin cambios (respira, parpadea y el de cada pose), con el desfase `desfase(indice)`: índice `k × 5` para Claude y `k × 5 + 1 + j` para el elenco (`AVIS_POR_TARJETA` sigue en 5). Las cabecitas de la pila no se animan.

### 8.2 Hilos: CSS, no SMIL

`@keyframes viaja { 0% { offset-distance: 0%; opacity: 0 } 12%, 85% { opacity: 1 } 100% { offset-distance: 100%; opacity: 0 } }` en 1800 ms, `cubic-bezier(.45, 0, .55, 1)`, infinito, con `animation-delay: calc(var(--k) * 600ms)` (`--k` = orden del hilo en la tarjeta). El trazo punteado no se anima.

**Por qué CSS:** las reglas de pausa que ya existen son de CSS (`animation-play-state` con el panel cerrado y con `body.fuera`, `body:not(.pausa)`, la media de movimiento reducido) y alcanzan al punto sin una línea de JS. SMIL (`animateMotion`, como estaba en el boceto) las ignora: haría falta llamar `pauseAnimations()` en cada camino de pausa y revisar el movimiento reducido en JS. `offset-distance` se resuelve como transformación: no hay layout ni repintado fuera del punto de 5 px. El boceto ya usa esta versión y se verificó que los puntos siguen el trazo y que "Pausar" los apaga.

### 8.3 Entrada del escenario

Se encadena a la entrada escalonada (6.1) y al cambio de proyecto (6.2), nunca a un redibujo. Dentro de cada tarjeta, con la tarjeta ya entrando con `sube`:

| Paso | Qué | Desde la tarjeta | Duración y curva |
|---|---|---|---|
| 1 | Piso: `scaleX` 0 → 1 con origen en x 64 (bajo Claude) | +80 ms | 420 ms `--ease` |
| 2 | Claude (`.avi` envolvente): `translateY(-8px)` → 0 y opacidad 0 → 1 | +120 ms | 360 ms `--rebote` |
| 3 | Cada `li.sub` y la pila: escala .9 → 1 desde abajo al centro, opacidad 0 → 1 | +200 ms + j × 50 ms | 360 ms `--rebote` |
| 4 | `svg.hilos`: opacidad 0 → 1 | después del último Avi + 120 ms | 240 ms `ease` |
| 5 | Los puntos arrancan (mientras la clase de entrada está puesta, `animation: none`) | al terminar 4 | 8.2 |

Una tarjeta con 4 Avis termina en unos 900 ms. Las clases (`.esc.entra` con `--j` por pieza) se sacan al terminar, con el mismo `animar()` de `tableroMotion.js`.

### 8.4 Cambios en vivo

| Evento | Respuesta |
|---|---|
| **Subagente nuevo** (id que no estaba en la lectura anterior) | Su `li` entra con el paso 3 (escala .9 → 1, 360 ms `--rebote`) y su hilo con el paso 4. Es la regla 6.2 de estilo-avis, que hoy no está hecha. |
| **Termina** | Cambia la pose (`listo` festeja 6 s y se duerme, `fallo` tambalea): ya existe. El hilo desaparece en el redibujo. |
| **Hover sobre un Avi del elenco** | El Avi sube 3 px en 350 ms `--ease`; dormido, su opacidad pasa a 1 en 200 ms. El rótulo no se mueve. |
| **Pasa el minuto** | Nada se mueve: los tiempos se actualizan en su lugar (9.3). |

### 8.5 Pausa y presupuesto

- **Panel acoplado cerrado, ventana escondida o minimizada, "Pausar animaciones", movimiento reducido:** cubiertos por las reglas que ya existen (`body.acoplada:not(.abierta) #marco *`, `body.fuera *`, selectores `body:not(.pausa)` y `@media (prefers-reduced-motion: no-preference)`). Con pausa o movimiento reducido: sin entrada (aparece todo al instante), Avis quietos en su pose y **sin puntos**; el trazo punteado queda fijo y dice lo mismo.
- **Tarjetas fuera de la vista** (3 o más sesiones): un `IntersectionObserver` con raíz `.principal` pone `.quieta` a cada `.ses` que no se ve; `.ses.quieta * { animation-play-state: paused !important }`.
- **Carga máxima visible:** 2 tarjetas × (Claude + 4) = 10 Avis y 8 puntos. Cada Avi repinta solo su caja (`contain: layout` en `.esc .avi`; sin `contain: paint`, que cortaría ondas y burbujas).
- **Brillo sin filtro:** `.brillo` usa `filter: url(#fBlur)` dentro del cuerpo que respira, y el filtro se vuelve a rasterizar en cada cuadro. En los Avis del escenario (96 y 58) se usa el brillo con `radialGradient` de marca-avi-ux.md 5.3.
- **Verificar:** panel de rendimiento de WebView2 con el caso B y el C al zoom de 200 %: 60 fps sin cuadros largos.

## 9. Mapeo a código

### 9.1 `widget/src/tablero.js`

| Función | Cambio |
|---|---|
| `cuadros(c)` | **Se reemplaza** por `chips(c)` (4). `conteos`, `lineaEncabezado`, `cifraConUnidades` y `tiempoCorto` siguen iguales. |
| `subagentesVisibles(sub)` | Recibe una opción: `subagentesVisibles(sub, { conMas = MAX_SUBAGENTES_VISIBLES })`. Con `sub.length <= 4` van todos; con más, `conMas` visibles. El escenario la llama con `conMas: 3`; `companero()` (cabecitas del pie del equipo) la sigue llamando sin opción y **no cambia** (hoy: 4 y "+n"). |
| `textoMas(ocultos)` | Sin cambios: `title` y texto oculto de la pila. |
| `ficha()` | **Se reemplaza** por `figuraSub(a, ahoraMs, indice, ranura)`: `li.sub` con el Avi de 58 y el rótulo (5.4). |
| `tarjeta()` | **Se reescribe** como escenario (5.1). Sigue privada. |
| `sesiones(preparadas, ahoraMs)` | Misma firma; arma las tarjetas escenario. |
| Nuevas, puras y exportadas (con tests) | `geometriaEscena(k)` → `{ claude, foco, ranuras: [{ x, ancho, avi: { x, y }, destino }], pila }`; `trazoHilo(desde, hasta)` → `d`; `estadoCorto(a, ahoraMs)`; `tiempoMini(texto)`; `ESTADO_CORTO`; `ESCENA`. |
| `colorEstado`, `ESTADO`, `estadoLista`, `textoEstado`, `firmaTablero`, `prepararProyecto` | Se reusan tal cual. |

### 9.2 `widget/src/avis.js` y `avis.css`

- **Poses que se reusan, sin poses nuevas:** Claude con `animoSesion` (`coordinando`, `teEspera`, `escribiendo`, `leyendo`, `pensando`, `proceso`, `inactiva`, `esperando`); el elenco con `animoSubagente` (`escribiendo`, `leyendo`, `teEspera`, `listo`, `fallo`, `durmiendo`); la pila, `durmiendo`.
- `avi(personaje, animo, tamano, { indice })` con 96, 58 y 36, siempre `aria-hidden` (el texto de al lado dice quién es).
- `avis.css`: `.mas .avi *, .mas .avi { animation: none !important }` y `.mas .avi .z { display: none }`; el brillo con gradiente de la marca para `.esc .avi` (8.5).

### 9.3 `widget/src/main.js` e `index.html`

- `index.html`: `<div class="stats" id="cuadros">` → `<div class="conteos" id="conteos">`.
- `main.js:312`: `poner('#conteos', chips(c))`.
- `main.js:313`: la firma de `#sesiones` **deja de llevar el minuto** (`Math.floor(ahora / 60000)`): hoy cada minuto redibuja todas las tarjetas y reinicia todos los bucles y los puntos. Los textos de tiempo ("lleva", el estado completo y el corto, los `title`) llevan `data-desde` (y `data-hasta` si terminó) y una función `actualizarTiempos(raiz, ahora)` los reescribe en su lugar en cada lectura cuando cambia el minuto.

### 9.4 Movimiento: `widget/src/escenaMotion.js` (nuevo)

Importa `hayMovimiento` y `duracionEscalonada` de `tableroMotion.js`. Exporta:

- `entradaEscenas(tarjetas)`: pone `.entra` y `--j` (8.3); la llaman `entrada()` y `cambioProyecto()`.
- `novedades(antes, despues)`: pura, ids de subagentes nuevos entre dos firmas (con test); `main.js` marca sus `li` con `.nuevo` después de `poner('#sesiones')`.
- `vigilarEscenas(principal)`: el `IntersectionObserver` de 8.5; se vuelve a llamar después de cada redibujo de `#sesiones`.

En `tableroMotion.js`, `BLOQUES` cambia `#cuadros > .stat` por `#conteos > .conteo`.

### 9.5 `widget/src/estilos.css`

- Nuevo: `.conteos`, `.conteo`, `.conteo-err`, `.ses-cab`, `.esc`, `.esc.solo`, `.piso`, `.elenco`, `li.sub` del escenario, `.rot`, `.mas`, `.hilos`, `.hilo-pt`, `.ses.quieta`, las claves `viaja` y las de entrada.
- Sale: `.stats`, `.stat*`, `.subs` y la ficha `.sub` de hoy (relleno, fondo `--s2`, `line-clamp`).
- Renombrar `.stats` → `.conteos` en `#marco.vacio`, `#marco.cargando`, `#marco.escenario`, `#marco.con-hoja` y en la lista de `contain: inline-size` (`estilos.css:397`). Sumar `.conteo` a la lista de `font-stretch: 75%` (`estilos.css:774`).

### 9.6 Tests que cambian

`widget/test/tablero.test.js`: los de `cuadros` pasan a `chips`; "el reparto: hasta MAX_SUBAGENTES_VISIBLES (4) con ficha y el resto como +n" pasa a 4 o 3 + "+n" con `conMas: 3`, y se suma uno que fija que `companero()` sigue mostrando 4 cabecitas y "+n"; la tarjeta: Claude de 96, elenco de 58, hilos solo hacia los que trabajan, texto completo en `title` y en el texto oculto.

## 10. Accesibilidad

- Un solo `h1` (el proyecto), `h2` oculto "Sesiones", un `h3` por tarjeta: sin saltos.
- Todos los Avis del escenario, el piso, los hilos y los puntos son `aria-hidden`. La línea dice el estado de Claude; cada `li` dice nombre, tarea completa y estado completo.
- Contraste sobre `--s1` (calculado): `--crema` 16,5:1, `--crema2` 9,6, `--tenue` 5,3, `--ambar` 10,7, `--verde` 11,4, `--celeste` 9,1, `--violeta` 7,2, `--rosa` 8,4, `--rojo` 7,7. Todo el texto del escenario pasa 4,5:1.
- El color nunca va solo: el estado lleva verbo ("escribe", "listo", "falló"), el error lleva "con error" y la pregunta, "pregunta" y la burbuja "!".
- Sin controles nuevos: no suma paradas de Tab ni objetivos de toque. La pila "+n" no es un botón.
- Nada titila más de 3 veces por segundo: un punto por hilo cada 1,8 s.
- `prefers-reduced-motion` y "Pausar animaciones": 8.5.

## 11. Handoff

Orden de construcción:

1. `tablero.js` puro: `ESCENA`, `geometriaEscena`, `trazoHilo`, `estadoCorto`, `tiempoMini`, `subagentesVisibles(sub, { conMas })`, con tests (incluido que `companero()` no cambia).
2. `tablero.js` HTML: `chips(c)`, `figuraSub`, la tarjeta escenario y la pila.
3. `index.html` y `main.js`: `#conteos`, la firma sin minuto y `actualizarTiempos`.
4. `estilos.css` y `avis.css`: 9.5 y 9.2.
5. `escenaMotion.js` y `BLOQUES` de `tableroMotion.js`.
6. Revisión visual con Playwright a 375, 768 y 1440 (la vista de desarrollo) y en la ventana real al 100 y al 200 %, contra el boceto.

No improvisar: la geometría de 5.2 (sale del boceto corregido), la regla 4 o 3 + "+n" y el orden de lanzamiento, que el texto completo quede en `title` y en el texto oculto, los hilos solo hacia los que trabajan, los puntos en CSS y apagados con pausa, los tiempos de 8.3, y que `companero()` no cambie. Cualquier objeto o mueble nuevo en el escenario vuelve a diseño.

## 12. Correcciones al boceto (2026-11-21)

- Los puntos de los hilos pasan de SMIL a CSS `offset-path` (8.2); "Pausar" ya no llama a `pauseAnimations()`.
- El marco reproduce el ancho real: tarjeta de 438 e interior de 408 (antes 394); la zona del elenco mide 298 (antes 286).
- La pila "+n" pierde "ver todos": no es un control.
- Lía estaba `pensando`, una pose que un subagente no puede tener (`animoSubagente`); pasa a `escribiendo`.
- Notas de la opción 01: la tarjeta mide 205 (no 214), libera 37 px frente a los cuadros reales de 63 (no 52), y el texto completo va "en title y en el nombre accesible" (no "en el enfoque").

## 13. Ajustes al implementar (2026-11-21)

- **Rótulo del elenco:** la clase es `.rotulo` (dentro de `.esc`), no `.rot`: `.rot` ya es el rótulo "Equipo" de la barra lateral (mayúsculas, espaciado y `font-stretch` propios).
- **Tiempos en su lugar (9.3):** en vez de `data-desde` y una fórmula por texto, `main.js` arma el HTML de cada lectura y, si la firma (sin el minuto) no cambió, copia a la tarjeta viva el texto de los `data-vivo` y los `title` (`actualizarTiempos`). Así cada tiempo sale de la misma función que lo dibujó (`tiempoRelativo`, `tiempoSubagente`, `estadoCorto`, `textoActividad`, `tituloActividad`) y no hay una segunda forma de calcularlo. Si la forma no coincide, se redibuja.
- **`entradaEscenas`:** la llama `main.js` justo después de `entrada()` y de `cambioProyecto()` (no las funciones de `tableroMotion.js`, para no importar en círculo). Toma el retraso real de la tarjeta (`animation-delay` calculado de `.rv` o `.rv-ses`) como `--base`.
- **Paso 4 de la entrada:** los hilos aparecen 120 ms después de que *termina* de entrar el último Avi (200 + (n − 1) × 50 + 360 + 120): con 4 Avis, a los 830 ms, y la entrada completa termina en unos 1070 ms (la tabla decía "unos 900").
- **`novedades`:** compara listas de ids por proyecto (`idsDeEscena(repo, preparadas)`), no firmas de texto; sin lectura anterior o con otro proyecto no hay nuevos. El hilo del nuevo aparece a los 480 ms y su punto arranca 720 ms después.
- **Hilo hacia la pila:** su destino es el centro de la caja de la pila a la altura de las coronillas (y 63).
