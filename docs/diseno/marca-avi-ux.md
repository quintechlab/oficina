# Oficina · marca B "Escenario": el Avi que juega — dirección

> Opción B del boceto `docs/diseno/bocetos/marca-avi.html` (2026-11-21), elegida por el usuario: «vamos con la opcion B. Agrega animaciones tambien para cuando no esta haciendo nada. Puede ser que juege con una pelota, o cante, o me llame, debe parecer realmente una mascota».
> Evoluciona `docs/diseno/estilo-avis-ux.md` (4.2 Marca, 5 Los Avis, 6 Movimiento). Todo lo que no se nombra acá sigue como está allí.
> El boceto es la referencia de movimiento: sus tiempos, curvas y pistas son los de esta dirección. Allí todos los tiempos de espera van divididos por 7 para verlos.

---

## 1. Brief

- **Qué:** la cabecera de la barra lateral del tablero (188 px) pasa a ser un escenario: el Avi de Claude, de 112 px, sobre su luz ámbar, con "Oficina" y el estado en píldora debajo.
- **Para qué:** que la Oficina tenga cara. El Avi respira, parpadea, te sigue con la mirada y, cuando no pasa nada, juega solo como una mascota.
- **Acción principal:** ninguna nueva. La marca sigue siendo la zona de arrastre de la ventana y el resumen del estado ("2 sesiones abiertas").
- **Regla de oro:** la mascota nunca compite con el trabajo. Si Claude pregunta o trabaja, manda la pose de ánimo; si vos tocás la ventana, deja de jugar y te mira.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps en un equipo medio, sin sonido, nada que corra cuando no se ve.

## 2. Concepto

**Un actor en su escenario.** El widget es una oficina nocturna (estilo Avis, 2); la marca es el único rincón con luz propia, y el Avi de Claude es quien vive ahí. Cuando hay trabajo, actúa el trabajo (las poses de 5.3). Cuando no hay, improvisa: patea una pelota, canta, te llama, se estira, se duerme. Tres palabras: **vivo, discreto, con peso**. Lo que se recuerda: **el cabezazo**. La pelota cae, él la sigue con los ojos, se agacha, salta, la cabecea y la antena queda vibrando como un resorte.

Principios de animación que lo hacen "mascota" y no "gif":

1. **Anticipación:** antes de cada salto se agacha (squash 1,08 × 0,88).
2. **Peso:** cae más rápido de lo que sube (`in` al bajar, `out` al subir) y aplasta al tocar el piso (1,07 × 0,9), con rebote al volver (`back`).
3. **Lo que sigue llega tarde:** la antena se mueve después del cuerpo y oscila amortiguada.
4. **La mirada guía:** antes de actuar mira lo que va a hacer (la pelota, el frente, arriba).
5. **Sin sorpresas:** frecuencia baja, nunca dos juegos iguales seguidos, nunca sonido.

## 3. Arquitectura de la marca

Orden del DOM sin cambios (estilo-avis-ux.md 4.1): marca, proyectos, equipo, pie.

```
.marca (columna centrada, zona de arrastre)
├── .avi  112 × 112, role="img", aria-label="Claude, <ánimo>"
├── .marca-n  "Oficina"
└── .estado (píldora)  punto + "2 sesiones abiertas"
```

- **Jerarquía:** Avi (el primero que se ve) → "Oficina" → estado. Los proyectos bajan unos 140 px respecto de hoy; con el alto fijo de 640 hacen scroll antes (`.lado > .proyectos` ya tiene `min-height: 76px` y scroll propio).
- **Estado del Avi:** el mismo orden de 4.2 (`teEspera` > `coordinando` > `esperando`; sin sesiones `durmiendo`), más la regla de reposo de 7.1.
- **Avi de la marca:** el de Claude con antena (`CLAUDE` en `avis.js`), como ya hace `tablero.js:111`. *Contradicción a resolver en la dirección vieja:* estilo-avis-ux.md 5.2 dice que el Avi base (copete) va en la marca; el código usa el de Claude y esta dirección lo confirma.

## 4. Contenido

- "Oficina" y el estado no cambian de texto con los juegos. El `aria-label` del Avi sigue diciendo el ánimo real ("Claude, esperando"), nunca "jugando".
- Globito de "Te llama": **"¡ey!"** (propuesto). Variantes posibles, a decidir por el usuario: "¡hola!", "¿jugamos?". Una sola por llamada.
- Sin otros textos nuevos.

## 5. Sistema visual

### 5.1 Medidas de la marca

| Pieza | Medida |
|---|---|
| `.marca` | columna, `align-items: center`, `padding: 6px 4px 4px`, alto total ≈ 182 px |
| `.avi` | 112 × 112 (`--t: 112px`), `contain: layout` |
| Luz (`.marca::before`) | 150 × 120, centrada, `top: 8px`, `radial-gradient(50% 50% at 50% 62%, rgba(242,182,50,.13), transparent 70%)` |
| `.marca-n` | `--t-display` (800 21/1.1), −0.03em, `margin-top: 6px` |
| `.estado` | `margin-top: 7px`, `padding: 4px 10px 4px 8px`, `--s2`, `--r-pildora`, `--t-mono` itálica `--crema2` |
| Escala viewBox → px | 112 / 120 = 0,933 px por unidad |
| Zona de juego | dentro de la marca: x de −40 a 160 unidades (≈ 0 a 186 px del borde de `.lado`), y ≥ −6 unidades. Medido en el boceto: de 11 a 167 px en horizontal y siempre ≥ 90 px por encima de los proyectos |

`.lado` tiene `overflow: hidden/auto`: lo que salga de la marca hacia arriba se corta en seco. Solo la pelota entra desde ahí (−6 unidades, con opacidad 0 → 1 en 120 ms) y parece que cae desde arriba del recorte.

### 5.2 Tokens

Sin colores nuevos en la paleta. Los juegos usan:

| Uso | Valor |
|---|---|
| Pelota | `radialGradient` `#FFD873` → `--ambar` → `#C98A12`, costura `--ambar-osc` al 45 %, brillo blanco .7. Radio 7 u. |
| Sombra de la pelota | elipse negra en el piso (y = 104), rx 6,5 → 2,6 y opacidad .5 → .12 según la altura |
| Notas | corchea y doble corchea en SVG (sin glifos de fuente), `--ambar` y `--crema` alternadas |
| Globito | `--crema` con texto negro Manrope 800 12; nunca ámbar (el ámbar con "!" es la pregunta de Claude) |
| Boca | `#3A1C10` |
| Manos | `#EFE6D2` (`CREMA_MANO`), la geometría de la mano de `saluda` |

Tokens de movimiento nuevos (además de 3.6):

| Token | Valor | Uso |
|---|---|---|
| `--d-suelta` | 280ms | Salida de un juego interrumpido |
| `REPOSO_PRIMERO_MS` | 40000 | Quietud antes del primer juego |
| `REPOSO_ENTRE_MS` | [60000, 150000] | Intervalo al azar entre juegos |
| `REPOSO_SIESTA_MS` | 480000 | Quietud antes de la siesta |
| `REPOSO_LLAMA_MS` | 900000 | Separación mínima entre dos "Te llama" |
| `PESOS_REPOSO` | pelota 4 · canta 3 · estira 2 · llama 1 | Sorteo |

### 5.3 Capas del SVG

El Avi de la marca usa el mismo generador (`svgAvi`), con grupos extra solo cuando `marca: true`. Cada transformación vive en su propio grupo para que no se pisen el CSS (respirar, parpadear) y el JS (mirada, juego):

```
svg viewBox 0 0 120 120 (overflow visible)
├── .suelo, .contacto            sombra del piso; .contacto se achica al saltar (escala X 1 → .55, opacidad .55 → .22)
├── .b-sombra                    sombra de la pelota
├── g.actua                      JUEGO: translate + rotate + scale con origen en (60,104), el piso
│   └── g.inclina                MIRADA: rotate(x · 3°) con origen (60,104)
│       ├── g.cuerpo             CSS: respira / duerme
│       │   ├── g.antena         JUEGO: rotate(ant) en (60,38)
│       │   │   ├── g.foco > .halo     JUEGO: escala 1 + luz · .4 (el CSS del halo sigue adentro)
│       │   │   └── g.bulbo            JUEGO: opacidad 1 − (luz<0) · .55
│       │   ├── patas, piel, sombreado
│       │   ├── g.c-brillo        MIRADA: paralaje −1,5
│       │   ├── g.c-mejillas      MIRADA: paralaje 1,6
│       │   ├── g.mirada          MIRADA: translate(x · 4,5, y · 3,2)
│       │   │   └── g.parpado     JUEGO: scaleY(par) en y = 70 (párpados pesados, ojos grandes)
│       │   │       └── g.ojos    CSS: parpadea
│       │   │           ├── .e-ab abiertos (los de hoy)
│       │   │           ├── .e-fe contentos ∩ (canta, festeja)
│       │   │           └── .e-ce cerrados ∪ (se estira, siesta)
│       │   └── g.c-pico          MIRADA: paralaje 2,7
│       │       ├── .boca         JUEGO: scaleY(boca) en y = 80,5
│       │       ├── .pico-i       JUEGO: translateY(boca · 3,2)
│       │       └── .pico-s       JUEGO: translateY(−boca · 1,6)
│       ├── g.mano.m-i / .m-d     JUEGO: fuera de .cuerpo (no respiran), reposo en (19,82) y (101,82)
│       └── g.zs                  siesta: dos "z" con la animación `zeta`
├── efectos de la pose (burbuja "!", notebook, "z" de durmiendo)
├── g.notas                       notas en vuelo
├── g.globo                       "¡ey!", escala desde la cola (−15,14) relativa a (104,10)
└── g.bola > g.bola-r             pelota: translate + squash desde el punto de contacto; rotación aparte
```

- El pico se parte en dos trazados que juntos son el pico de hoy: `M56 78.5Q60 76.8 64 78.5Q60 80.8 56 78.5Z` (superior) y `M56.4 79.2Q60 81.2 63.6 79.2Q60 85.5 56.4 79.2Z` (inferior, `#DD9433`).
- El ojo contento: `M44.5 72Q49 65.5 53.5 72M66.5 72Q71 65.5 75.5 72`; cerrado: `M44.5 70Q49 74.5 53.5 70M66.5 70Q71 74.5 75.5 70` (clase `.trazo`).
- Con `.o-fe` u `.o-ce` en el `svg`, el parpadeo CSS se apaga.
- **Brillo sin filtro en la marca:** hoy `.brillo` usa `filter: url(#fBlur)`. En la marca el brillo se mueve cada cuadro (paralaje) y el filtro se vuelve a rasterizar. Se reemplaza por un `radialGradient` blanco (.8 → .45 → 0), como en el boceto: misma lectura y sin filtro animado.

## 6. La mirada

| Situación | Comportamiento |
|---|---|
| Puntero dentro de la ventana | Sigue al puntero con suavizado: cada cuadro recorre el 10 % de lo que falta. Satura con `d / (|d| + 170)` en x y `d / (|d| + 140)` en y: nunca bizquea ni sale de la cara. Se inclina hasta 3° hacia vos. |
| Entra el puntero | Doble parpadeo, "te vio" (`doble`, 500 ms). Si estaba jugando: primero suelta el juego (7.4). |
| Fuera · acoplada | Sigue la posición global. Rust ya sondea el cursor cada 20 ms: alcanza con emitir la posición hacia el WebView cuando cambia, a lo sumo cada 50 ms, **solo con el panel abierto**. |
| Fuera · flotante | Mira 1,5 s hacia el borde por donde saliste (vector normalizado × 0,9) y vuelve al centro despacio (6 % por cuadro). Sin sondeo global. |
| Puntero quieto 5 s | Curiosea: izquierda 1,4 s, derecha 1,4 s, arriba 1,2 s, centro; ciclo de 7 s, suavizado 5 %. |
| Durante un juego | El juego manda la mirada (`gw` = 1): mira la pelota (suavizado 24 % para seguirla), al frente al llamarte, arriba al cantar y al estirarse. |
| Ánimos que no siguen | En escribiendo mira la notebook, en leyendo el libro, en proceso el anillo; durmiendo, listo y falló tienen los ojos cerrados o dibujados. Sigue en esperando y te espera. |
| Movimiento reducido o `body.pausa` | Quieto, mirando al frente. Sin seguimiento, sin respiración, sin inclinación, sin juegos. |

## 7. Repertorio de reposo

### 7.1 Cuándo puede jugar (todo a la vez)

1. **Se ve:** flotante, o acoplada con el panel abierto (`body.acoplada.abierta`, incluido "Mantener abierta"). `document.hidden` falso y la ventana no minimizada.
2. **Nadie trabaja:** el Avi de la marca está en `esperando`, y además ninguna sesión tiene pose de trabajo (`escribiendo`, `leyendo`, `pensando`, `coordinando`, `proceso`) ni pregunta pendiente. Función pura nueva en `logica.js`: `reposoPermitido(proyectos) → boolean`, con tests.
3. **Vos no estás en la ventana:** `REPOSO_PRIMERO_MS` (40 s) sin `pointermove`, `pointerdown`, `wheel` ni teclas dentro de la ventana. El puntero global fuera de la ventana **no** cuenta como actividad.
4. **Se puede mover:** sin `prefers-reduced-motion: reduce` y sin `body.pausa`.

### 7.2 Cada cuánto y cuál

- Primer juego a los 40 s de quietud; después, uno cada 60 a 150 s al azar (desde que terminó el anterior).
- Sorteo por pesos: pelota 4, canta 3, se estira 2, te llama 1. Nunca el mismo dos veces seguidas.
- "Te llama" nunca es el primero de una racha y sale a lo sumo una vez cada 15 min.
- A los 8 min de quietud (contados desde la última actividad tuya en la ventana o el último trabajo de Claude), en lugar de un juego, siesta.
- Una hora de quietud son unos 30 juegos de 4 a 7 s: menos del 5 % del tiempo en movimiento extra.

### 7.3 Los juegos

Pistas exactas (tiempo, valor, curva) en el objeto `ACTOS` del boceto. Curvas: `o` = cúbica de salida, `i` = cúbica de entrada, `io` = cúbica de entrada y salida, `b` = back de salida (1,70158), `s` = escalón.

| # | Juego | Dura | Compás |
|---|---|---|---|
| 1 | **Pelota** | 6,6 s | 0 cae desde arriba a la izquierda (`i`) y aplasta al tocar el piso (.68) · 780–1000 se agacha · 1000–1180 salta (−14 u.) y **cabecea** a los 1180: la pelota sale en arco hacia la derecha y la antena oscila (−22°, 16°, −10°, 6°, −3°, 0) · 1380 aterriza con squash · 2080 la pelota rebota contra el borde (2 botes más chicos) · 3000–3700 vuelve rodando hasta su pata derecha · 4300 festeja: ojos contentos, pico abierto, dos saltitos de 6 u. con las manos arriba · 5600–6300 la pelota se va rodando a la derecha y se funde · la mirada vuelve al centro. Los ojos siguen a la pelota todo el tiempo. |
| 2 | **Canta** | 6,2 s | 0–300 toma aire (se estira 1,04 y sube 2 u.) · ojos contentos · 8 compases de 520 ms (115 bpm): se balancea ±6°, aplasta .95 en cada tiempo, abre el pico, el foco late y sale una nota (corchea o doble, alternando lado y color) · 4560 nota final: se estira 1,08, manos arriba, nota grande ámbar · 5440 abre los ojos y parpadea. Cada nota sube 60 u. en 1,7 s con vaivén de ±12° y se apaga. |
| 3 | **Te llama** | 4,6 s | 0–220 se agacha · dos saltos (−16 y −11 u.) con aterrizaje aplastado · mira de frente · 560 globito "¡ey!" con `back` · el foco destella dos veces · 1200–2550 saluda tres veces con la mano derecha (±28°, 200 ms por medio vaivén) · 2950 ladea la cabeza 8° como esperando respuesta · 3500–3800 el globito se va. |
| 4 | **Se estira** | 4,4 s | 0–900 se estira hacia arriba (1,14 × 0,9) con las manos sobre la cabeza y los ojos cerrados · 900–1900 bostezo largo (pico abierto entero) con un temblor de ±1,5° · 2100–2350 suelta de golpe (0,9 × 1,08, `i`) y rebota · 2900–3650 se sacude (±5° amortiguado) y la antena llega tarde · 3700 parpadea. |
| 5 | **Siesta** | 3,4 s y queda | Le pesan los párpados: cabecea dos veces (párpado .45 y .35, la cabeza baja 2 y 3 u.) · 2700 cierra los ojos · se inclina 7°, el foco baja a .45 de opacidad · 3200 dos "z" chicas y la respiración lenta de `duerme`. Queda dormido hasta la próxima actividad. |
| 5b | **Despierta** | 1 s | Respingo: ojos abiertos y grandes (párpado 1,28), salto de 10 u., aterrizaje aplastado, el foco destella, la antena rebota; después parpadeo doble y mirada al puntero. |

La siesta no es el ánimo `durmiendo` (sin sesiones): la píldora sigue diciendo las sesiones abiertas, el `aria-label` sigue en "esperando" y solo hay dos "z" chicas, no las tres de la pose.

### 7.4 Qué lo interrumpe

| Evento | Respuesta |
|---|---|
| Puntero que entra o se mueve en la ventana, clic, rueda, tecla | El juego se suelta: todos los canales vuelven al reposo en `--d-suelta` (280 ms, `o`), la pelota y el globito se funden en 180 ms y las notas en vuelo en 200 ms. Después, doble parpadeo y te sigue con la mirada. La cuenta de quietud vuelve a cero. |
| Arrastre desde la marca | Igual que arriba, antes del primer movimiento de la ventana. |
| Durante la siesta | En vez de soltar, **Despierta** (1 s). |
| Llega una pregunta o una sesión empieza a trabajar | La pose de ánimo manda al instante: se cancela el juego (sin salida de 280 ms; el cambio de pose ya redibuja), se apagan las notas y se borra la siesta. |
| El panel acoplado se cierra, la ventana se esconde o se minimiza | Se cancela sin animación, se apaga el planificador y no queda ningún cuadro corriendo. Al volver a verse, la cuenta de quietud empieza de cero. |
| Se activa movimiento reducido o "Pausar animaciones" | Se cancela sin animación y el Avi queda quieto en su pose, mirando al frente. |

### 7.5 Nunca

- Sonido de ningún tipo.
- Cambiar el texto del estado, el `aria-label` o el título de la ventana.
- Avisar por Windows, la bandeja o la muesca. La muesca cerrada no muestra juegos.
- Salir de la marca o tapar los proyectos.
- Elegir nada por el usuario ni mover el foco del teclado.

## 8. Movimiento e implementación

- **Módulo:** `widget/src/marcaMotion.js`. Exporta `montarMarca(el)`, que devuelve `{ animo(pose), visible(bool), actividad(), cursor(x, y | null), destruir() }`. Lo llama `main.js` donde hoy pone `#marca-avi`.
- **Juegos:** un timeline de anime.js v4 por juego (`createTimeline`), uno por pista o grupo del 5.3, con los mismos tiempos y curvas del boceto (`outCubic`, `inCubic`, `inOutCubic`, `outBack(1.70158)`). Las notas, con `animate()` de fuego y olvido. La salida de 280 ms: `animate()` de los grupos al reposo desde su valor actual. Los juegos se definen como datos (las pistas), así los tests pueden revisar sin DOM que todos terminan en el reposo y que nada sale de la zona de juego.
- **Planificador:** un único `setTimeout` hacia el próximo evento (primer juego, siguiente juego o siesta). Nada de `setInterval` ni de un `requestAnimationFrame` permanente.
- **Mirada:** un `requestAnimationFrame` que vive solo mientras la mirada no convergió (diferencia > 0,002) o hay un juego; si no, se detiene y lo despierta el próximo `cursor()`.
- **Pausa real:** `visible(false)` cuando `body.acoplada:not(.abierta)`, `document.hidden` o la ventana minimizada (evento de Tauri). La regla CSS que ya pausa las animaciones con el panel cerrado no detiene a JS: el módulo tiene que escucharla.
- **Presupuesto:** solo `transform` y `opacity`, en atributos del SVG o en CSS. Nada de `d`, filtros, `blur` ni tamaño de caja animados. El área que se repinta es la del Avi (112 px más la zona de juego), aislada con `contain: layout` en `.avi`. Objetivo: 60 fps en un equipo medio con zoom de 200 %. Verificar con el panel de rendimiento de WebView2 durante "Pelota" (lo más cargado: cuerpo, antena, pelota, sombra y mirada a la vez).
- **Entrada:** la marca entra con `sube` (6.1) como hoy; el Avi además con `entra` (escala .8 → 1, `--rebote`, 620 ms).

## 9. Responsive y zoom

El widget no tiene breakpoints: la barra mide siempre 188 px y el tamaño cambia con el zoom escalonado de `<html>` (100 a 200 %). Todo está en unidades del viewBox o en px dentro de la marca, así que escala junto. Verificado en el boceto al 100 y al 200 %, y la página del boceto a 1440 y a 375 sin desborde horizontal.

## 10. Accesibilidad

- El Avi conserva `role="img"` y `aria-label="Claude, <ánimo>"`. Los juegos son decorativos: no cambian el nombre accesible ni anuncian nada.
- `prefers-reduced-motion: reduce` y `body.pausa`: sin juegos, sin mirada, sin respiración; el Avi queda en su pose.
- Los bucles de más de 5 s (siesta) se pueden pausar desde la bandeja ("Pausar animaciones", ya existe).
- Nada titila más de tres veces por segundo: el destello más rápido del foco es de 300 ms.
- La marca sigue siendo la zona de arrastre (hijos con `pointer-events: none`); el módulo escucha el puntero en el documento, no en el Avi.
- El color nunca es el único portador de significado: el globito de "Te llama" es crema y dura 3 s; la pregunta real sigue siendo la tarjeta ámbar, el "?" y el texto.

## 11. Handoff

Orden de construcción:

1. `logica.js`: `reposoPermitido(proyectos)` y el planificador puro (`proximoReposo({ ahora, quietoDesde, ultimoFin, ultimo, ultimaLlamada, juegos, azar })` → `{ id, en }`), con tests: primer juego a los 40 s, intervalo 60 a 150 s, sin repetir, "Te llama" ni primero ni antes de 15 min, siesta a los 8 min.
2. `avis.js`: grupos extra de la marca (5.3), pico en dos partes, ojos contentos y cerrados, manos, globito, pelota, capa de notas y brillo con gradiente. El resto de los Avis no cambia.
3. `avis.css`: `.o-fe`, `.o-ce`, `.siesta`, `.zs`, `contain: layout`.
4. `marcaMotion.js`: mirada, juegos, salida, despertar y pausa (8).
5. `estilos.css` e `index.html`: `.marca` en columna (5.1).
6. Rust: emitir la posición global del cursor solo con el panel acoplado abierto (6).

No improvisar: los tiempos y curvas de 7.3 (salen del boceto), las reglas de 7.1 y 7.4, los colores de 5.2, que el globito no sea ámbar, que nada corra cuando no se ve, y que ningún juego cambie texto o nombre accesible. Cualquier juego nuevo vuelve a diseño.

## 12. Cómo quedó implementado (2026-11-21)

Diferencias con el texto de arriba, decididas al implementar:

- **Nombre:** la app se llama "Avis": la marca dice "Avis", no "Oficina".
- **Sin anime.js:** el widget no tiene dependencias de animación. Los juegos son datos (`ACTOS` en `widget/src/marca.js`, las pistas del boceto tal cual) y `marcaMotion.js` los interpola con `valorPista` en un `requestAnimationFrame` que vive solo mientras hay un juego o la mirada no llegó a su destino. Las notas son Web Animations de fuego y olvido. Mismos tiempos y curvas que el boceto.
- **Curioseo sin cuadro permanente:** con el puntero quieto, un `setTimeout` (`cambioMirada`) despierta la mirada en cada tramo del curioseo; entre tramos no corre nada.
- **API:** `montarMarca(el)` devuelve `{ animo(animo, reposo), visible(visto, acoplada), actividad(), cursor(x, y | null), destruir() }`. `reposo` es `reposoPermitido(proyectos, ahoraMs)` (lleva `ahoraMs` porque el ánimo de cada sesión depende de la hora). `visible` también relee movimiento reducido y "Pausar animaciones".
- **Rust:** `zona_interactiva` recibe `abierta`; con el panel acoplado abierto, el hilo del sondeo emite `oficina://cursor` `{ x, y }` en px lógicos de pantalla (`cursor_para_mirada`: solo si cambió desde el último aviso y a lo sumo cada 50 ms). La ventana resta su posición (`st.ventana`).
- **Minimizada:** se detecta con el sondeo de 1,5 s (`fueraDeVista`) y `visibilitychange`, como el resto del widget; no hay evento de Tauri nuevo.
- **Fin de los juegos:** los canales de la mirada (`gx`, `gy`, `gw`, `gb`) pueden no terminar en el reposo (canta deja `gw` en 1): los suaviza la mirada. Los demás canales visibles sí terminan en el reposo (lo fija `widget/test/marca.test.js`).
- **Recorte arriba:** en los saltos más altos (te llama, −16 u.) el halo del foco puede cortarse unos px contra el borde superior de `.lado`, como prevé 5.1.
- **Vista de desarrollo:** `dev/vista.html?estado=reposo&reposo=7` acorta los tiempos ÷ 7, como el boceto.
