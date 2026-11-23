# Avis · muesca A "Asoma": el Avi que se asoma por el alféizar — dirección

> Opción A del boceto `docs/diseno/bocetos/muesca-avi.html` (2026-11-21), elegida por el usuario: «me gusta la muesca de ASOMA, la A».
> Aclaración del usuario: «ojo, la idea es mantener la estetica de Avis, no copiar exactamente lo de troko. se entiende?». Troko (`docs/diseno/referencias/muesca-troko.png`) es **solo referencia de comportamiento**: una mascota que asoma, mira y reacciona. La forma, el personaje, la paleta, los radios, los hombros y el lenguaje visual son los de Avis.
> Evoluciona `docs/diseno/estilo-avis-ux.md` (6.4 Muesca, 7.1 Forma) y reusa el motor de `docs/diseno/marca-avi-ux.md`. Lo que no se nombra acá sigue como está allí.
> Supuestos del boceto que el usuario no objetó y quedan decididos: sin punto de estado; la cantidad de sesiones es un chip que aparece solo con el mouse encima; si el Avi trabaja no sigue al puntero; la muesca crece a 150 × 54 (62 × 140 a los costados); juega solo a "cucú".

---

## 1. Brief

- **Qué:** la muesca acoplada cerrada pasa a ser la ventana de una oficina chiquita. El Avi de Claude, de 66 px, se asoma por el borde interior como por un alféizar: antena, cara y mejillas. Todo el estado lo dice él.
- **Para qué:** que la muesca tenga cara y se lea a un metro: si te mira, está libre; si mira para abajo con la cara iluminada, trabaja; si se agarra del borde con un "!", te pregunta.
- **Acción principal:** abrir el panel con un clic, Enter o Espacio (#21, 23/11: el hover ya no abre y sacar el mouse ya no cierra; cierran el clic afuera, Esc u otro clic en la muesca, salvo "Mantener abierta" para el clic afuera). El hover solo hace reaccionar al Avi. Nada nuevo toma clics.
- **Regla de oro:** la mascota nunca compite con el trabajo ni con la pregunta. En el borde de la pantalla está siempre a la vista: se mueve poco, en ráfagas cortas, y se aquieta solo.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps en un equipo medio con zoom de 200 %, nada que corra cuando no se ve.

## 2. Concepto

**La ventanita de la oficina.** La muesca es negra como la noche del widget (estilo Avis, 2); adentro vive el Avi de Claude, detrás del alféizar, y solo se le ve de las mejillas para arriba. Tres palabras: **curioso, atento, discreto**. Lo que se recuerda: **el cucú**. Cada tanto se esconde detrás del alféizar (le queda afuera la punta ámbar de la antena, así sabés que sigue ahí) y vuelve a asomar de golpe, contento, agarrado del borde con las dos manos.

Qué es de Avis y no de la referencia: la muesca con hombros cóncavos de 16 y esquinas de 22 (7.1), el Avi crema con antena ámbar de la marca B, la luz ámbar sobre el borde, el recorte en isla al abrir, la tipografía Martian Mono del chip. De la referencia solo se toma el comportamiento: una mascota que asoma, mira y reacciona.

## 3. Arquitectura de la muesca

```
button#muesca (aria-label = estadoMuesca().nombre, aria-expanded)        data-modo = reposo | trabajando | pregunta | duerme
├── span.cuenta   aria-hidden   "3"     chip de sesiones, solo en hover y foco
├── span.alfeizar aria-hidden           línea del alféizar, solo a los costados
├── span.asoma    aria-hidden           recorte 52 × 54, overflow hidden (corta solo abajo)
│   ├── span.alza#muesca-avi            sube y baja con el hover, la pregunta, el golpe, la apertura y el cierre (CSS)
│   │   └── .avi 66 × 66 (svgMarca)     lo dibuja y lo mueve el motor (mirada y cucú, JS)
│   ├── i.asir.i                        mano izquierda agarrada del alféizar
│   └── i.asir.d                        mano derecha
└── span.excl     aria-hidden   "!"     globo de pregunta
```

- **Jerarquía:** el Avi (siempre) → el "!" (solo con pregunta) → el chip (solo si lo buscás).
- **Una sola fuente del estado:** `body.pregunta` y `body.golpe` (ya existen) y `#muesca[data-modo]` (nuevo). Nada de clases por estado dentro del contenido.
- **El Avi va siempre derecho** en los cuatro bordes (como hoy). Se esconde siempre hacia abajo: arriba, detrás del alféizar; abajo, detrás del borde de la pantalla; a los costados, detrás de la línea del alféizar.
- **La píldora de arrastre no cambia** (`contenidoPildora`: Avi de 44, "Avis" y chip).

## 4. Contenido

- Sin textos visibles nuevos salvo el chip (`3`) y el globo (`!`, o el número de preguntas: ver 8).
- El nombre accesible cambia solo para no perder lo que decía el chip (8).

## 5. Sistema visual

### 5.1 Medidas por borde (px CSS, al 100 %)

| Pieza | Arriba | Abajo | Derecha / izquierda |
|---|---|---|---|
| Muesca (`--mw` × `--mh`) | 150 × 54 | 150 × 54 | 62 × 140 |
| Radios (si, sd, id, ii) | 0 0 22 22 | 22 22 0 0 | der.: 22 0 0 22 · izq.: 0 22 22 0 |
| Hombros 16 × 16 | izq. y der., arriba | izq. y der., abajo | arriba y abajo, contra su borde |
| `.asoma` 52 × 54 | centrada, `bottom: 0` (el alféizar es el borde interior) | centrada, `bottom: 0` (el borde de la pantalla) | centrada, `top: 40px` (alféizar en y = 94) |
| `.alfeizar` | — | — | 38 × 1,5, `top: 94px`, centrada, radio 1, `rgba(243,235,216,.16)` |
| `.excl` 17 × 17 | `left: calc(50% + 24px); top: 8px` | ídem, `top: 9px` | centrada, `top: 14px` |
| `.cuenta` | `right: calc(50% + 33px); bottom: 15px` | ídem, `bottom: 11px` | centrada, `bottom: 12px` |
| Padding | ninguno: todo va posicionado; la caja es fija | | |

- **Avi:** `avi(CLAUDE, animo, 66, { marca: true })` dentro de `.alza` (`position: absolute; left: -7px; top: 4px; width: 66px; height: 66px`). Escala 66 / 120 = 0,55 px por unidad. En reposo se ve de y = 0 a y ≈ 91 unidades (la antena, la cabeza, los ojos y las mejillas); las patas y la panza quedan detrás del alféizar.
- **El recorte corta solo abajo:** la caja mide 54 y el Avi arranca a 4 px de su borde de arriba, así la antena no se corta cuando sube 6 px (hover). En el sobrepique del cucú (−8 px) el foco roza el borde un instante: es el techo.
- **Manos (`.asir`):** 12 × 10, `border-radius: 50%`, `background: #F1E8D4` (crema de mano), `box-shadow: inset 0 -2.5px 0 #D6C8A6`, `bottom: -4px` (el alféizar les corta 4 px: se ven agarradas), `left: 3px` y `right: 3px`.
- **Excl:** círculo `--ambar`, texto `--negro` Manrope 800 11,5/1, anillo `0 0 0 2px #000`. Contraste 11,5:1.
- **Chip (`.cuenta`):** `padding: 3px 7px`, `--r-pildora`, `--s3`, texto `--crema` en `500 10px/1 var(--m)` con `font-stretch: 75%`. Contraste 14,1:1. Vacío (sin sesiones) no se dibuja.
- **Sombra:** `--sombra-muesca`, sin cambios.

### 5.2 Capas del SVG

El Avi de la muesca es el de la marca (`svgMarca`), sin grupos nuevos. El motor escribe sus transformaciones (5.3 de marca-avi-ux.md); acá solo se apagan las piezas que no entran:

```
.alza (HTML, CSS: translateY del estado)
└── svg.es-marca 0 0 120 120
    ├── .suelo, .contacto, .b-sombra      quedan detrás del alféizar (y = 104)
    ├── g.actua                           CUCÚ: translate(0, y) del canal y (unidades)
    │   └── g.inclina > g.cuerpo          mirada (inclina hasta 3°) · respira (CSS)
    │       ├── g.antena > g.foco > .halo TRABAJANDO: `late` 1,6 s (CSS)
    │       │              g.bulbo        DUERME: opacidad .45 (CSS)
    │       ├── g.mirada > g.parpado      TRABAJANDO: scaleY(.74) en y = 70 (CSS) · ojos ∩ en el cucú (canal ojos)
    │       └── g.c-pico, mejillas, brillo
    ├── g.efectos                         NUEVO ENVOLTORIO de efectos(e): en la muesca, display: none
    └── notas, globo, bola                opacidad 0 (el cucú no los usa)
```

- **`g.efectos`:** `svgMarca` envuelve `efectos(e, c, comando)` en `<g class="efectos">` (en la marca no cambia nada). En `#muesca` se esconde entero: la burbuja de `teEspera` la reemplaza el `.excl` HTML (la del SVG queda fuera del recorte de 52) y las "z", ondas y notebook no entran.
- **Luz de cara (trabajando):** `.asoma::after`, abajo, 100 % × 70 %, `radial-gradient(60% 100% at 50% 100%, rgba(242,182,50,.38), transparent 72%)`, `mix-blend-mode: screen`, opacidad 0 → `resplandor` (.55 ↔ 1, 2,6 s, `ease-in-out`).
- **Luz de pregunta (`#luz`):** sin cambios: franja de 3 px sobre el borde, largo `rectLuz` (muesca, hombros y 12 px por lado), .75 fija.

### 5.3 Zoom 100–200 %

Todo está en px CSS dentro de `#muesca` y escala con el zoom de `<html>`. `muesca.js` es la única fuente del tamaño (`TAM_MUESCA`, 10): main.js lo multiplica por el zoom para Rust y lo pasa a CSS como `--mw`/`--mh` (px CSS, ya divididos). Verificar al 100 y al 200 % en los cuatro bordes.

## 6. Estados

Prioridad (la misma que el nombre, 8): **pregunta > trabajando > reposo > duerme**. El hover y el foco se suman a cualquiera.

| Estado | `.alza` | Avi (motor) | Extras |
|---|---|---|---|
| **Reposo** (hay sesiones, nadie trabaja, sin pregunta) | `translateY(0)` | pose `esperando`; respira y parpadea (CSS); **te sigue con la mirada** (9); puede jugar al cucú (7) | — |
| **Trabajando** (alguna sesión con ánimo de trabajo, 8) | `translateY(0)` | pose `esperando` con `ocupado`: **no te sigue**, mira hacia abajo y a la derecha (`{ x: .3, y: .7 }`), párpados a .74 | luz de cara (`resplandor`), halo de la antena `late` |
| **Pregunta** | `translateY(-3px)` | pose `teEspera` (sin respirar, como hoy); te sigue con la mirada | manos agarradas, `.excl` con `pop` (360 ms `--rebote`), `#luz` fija .75 |
| **Golpe** (al llegar una pregunta y cada 90 s, `tocaGolpe` sin cambios) | `saltoA` 480 ms `--ease`: −3 → −11 (30 %) → −1 (60 %) → −3 | igual que pregunta | muesca `golpe` 480 ms `--ease`: escala 1 → 1,1 (28 %) → ,97 (55 %) → 1,025 (78 %) → 1, desde el borde; `.excl` `pop` 420 ms; `#luz` `golpe-luz` (sin cambios); `body.golpe` dura 1100 ms |
| **Duerme** (sin sesiones) | `translateY(8px)` | pose `durmiendo` (ojos cerrados, respiración lenta); no sigue | bulbo a .45; sin "z" |
| **Hover** (muesca cerrada y puntero en la zona) y **foco** (`:focus-visible`) | `translateY(-6px)`, 280 ms `--ease` | doble parpadeo al entrar ("te vio", si la pose sigue) | muesca `scale(1.05)` desde el borde (`--d-elevar` 350 ms `--ease`); manos (260 ms `--rebote`, opacidad 160 ms); `.cuenta` sale de atrás del Avi: opacidad 160 ms y `translateX(10px) scale(.8)` → nada (a los costados `translateY(-8px) scale(.8)`), 280 ms `--rebote`; foco: además el contorno ámbar de 2 px hacia adentro (como hoy) |
| **Apertura** (6.4 de estilo-avis-ux.md, sin cambios en el recorte) | `hunde` 200 ms `cubic-bezier(.5,0,.75,0)`: a `translateY(60%)` y opacidad .2 | `visible(false)`: se cancela el cucú y se detiene todo | el recorte nace de la muesca con sus hombros (`hombros()`), la muesca se funde en 90 ms desde el segundo cuadro |
| **Cierre** | `vuelve` 320 ms `--rebote` desde `translateY(60%)` y opacidad .2 hasta lo de su estado, al reaparecer la muesca (85 % de 480) | `visible(true)`: la quietud empieza de cero | — |

- **El golpe crece desde el borde y nunca se despega:** usa el `transform-origin` del borde que ya tiene `#muesca` (estilos.css). Se reemplaza el `@keyframes golpe` de hoy (1,12 con `--rebote`) por el del boceto.
- **Las manos se ven** en hover, foco, pregunta, golpe y el final del cucú (`.asoma.agarra`).
- **Entre golpes nada titila:** en pregunta el Avi no respira; solo los ojos te siguen (lo mueve tu mouse, no un reloj).
- Sin hover en el panel abierto (como hoy: `body.acoplada:not(.abierta) #muesca:hover`).

## 7. Cucú

### 7.1 Cuándo puede correr (todo a la vez)

1. **Se ve:** acoplada, muesca cerrada, sin píldora, sin arrastre, ventana a la vista y no minimizada (`!st.fuera && !st.mini`).
2. **Nadie trabaja:** `reposoPermitido(proyectos, ahora)` y modo `reposo`.
3. **No estás encima:** la quietud se cuenta desde el último `pointermove`, `pointerdown`, rueda o tecla dentro de la ventana (acoplada y cerrada eso es solo la zona de la muesca) o desde que Claude dejó de trabajar. El puntero global **no** cuenta como actividad (la misma regla de la marca, 7.1.3).
4. **Se puede mover:** sin movimiento reducido y sin `body.pausa`.

### 7.2 Cada cuánto

El reloj de la marca, con un repertorio de un solo juego: el primero a los 40 s de quietud (`REPOSO_PRIMERO_MS`), después uno cada 60 a 150 s al azar desde que terminó el anterior (`REPOSO_ENTRE_MS`). **A los 8 min de quietud (`REPOSO_SIESTA_MS`) se aquieta:** no hay siesta en la muesca; deja de jugar hasta la próxima actividad o el próximo trabajo de Claude. Una racha son de 4 a 7 cucús de 2,6 s.

### 7.3 La pista (datos, como `ACTOS`)

`ACTOS.cucu`, 2600 ms, unidades del viewBox (1 u = 0,55 px), curva `o` en todos los tramos (la `--ease` del boceto, aproximada como en la marca):

| Canal | Pista | Lectura |
|---|---|---|
| `y` | `[0, 0]`, `[304, 62, 'o']`, `[988, 62]`, `[1254, -14.5, 'o']`, `[1520, -3.6, 'o']`, `[1900, 0, 'o']` | se esconde 34 px (queda la punta ámbar de la antena), espera 0,7 s y vuelve con sobrepique de 8 px |
| `ojos` | `[0, 0]`, `[1150, 1, 's']`, `[2600, 0, 's']` | vuelve contento (∩) |
| `asir` (nuevo, 0/1) | `[0, 0]`, `[1150, 1, 's']`, `[2600, 0, 's']` | se agarra del alféizar con las dos manos |

La mirada sigue al puntero durante todo el cucú (sin `gw`): al volver, te encuentra.

### 7.4 Qué lo interrumpe

| Evento | Respuesta |
|---|---|
| El puntero entra en la zona, clic, tecla | `salida` de la marca: todo al reposo en 280 ms (`SUELTA_MS`) y doble parpadeo; el hover sube el Avi. La quietud vuelve a cero. |
| Llega una pregunta, alguien empieza a trabajar o se cierran todas las sesiones | Se cancela sin animación (cambia la pose). |
| Abrir el panel, arrastrar, píldora, esconder o minimizar | Se cancela sin animación y no queda ningún cuadro corriendo. |
| Movimiento reducido o "Pausar animaciones" | Se cancela sin animación; el Avi queda en su pose, al frente. |

## 8. Nombre accesible y aviso de pregunta

Sin punto y sin chip fijo, todo lo que decían queda en el nombre del botón y en el cuerpo del Avi. `estadoMuesca(proyectos, ahora).nombre`:

| Modo | Nombre |
|---|---|
| Pregunta, una | `Avis: Claude te hace una pregunta en oficina. Abrir` (como hoy) |
| Pregunta, varias | `Avis: 2 preguntas pendientes. Abrir` (como hoy) |
| Trabajando | `Avis: 2 de 3 sesiones trabajando. Abrir`; si trabajan todas, `Avis: 3 sesiones trabajando. Abrir` |
| Reposo | `Avis: 3 sesiones abiertas. Abrir` |
| Duerme | `Avis: sin sesiones abiertas. Abrir` |

- `nombreMuesca(e.nombre, faltan)` de primeros pasos sigue igual.
- **Cuántas preguntas:** el chip "2 ?" se va; el globo dice **"!" con una pregunta y el número con varias** ("2" … "9", "9+"), en el mismo círculo ámbar. Es pregunta en los dos casos (ámbar con texto negro) y nunca depende solo del color: el glifo, las manos agarradas, el nombre y la luz.
- **Qué es "trabajando":** el mismo conjunto que usa `reposoPermitido` (`ANIMOS_DE_TRABAJO` de `logica.js`: editando, comando, escribiendo, leyendo, pensando, coordinando, proceso). Así la muesca nunca dice "libre" mientras el cucú está prohibido, ni al revés.
- Antes (punto → ahora): ámbar trabaja → mira abajo con la cara iluminada; ámbar pregunta → "!", manos, luz; crema espera → te mira; tenue duerme → hundido con los ojos cerrados.

## 9. La mirada

Reusa `mirarPuntero`, `curiosear`, `siguePuntero`, `objetivoMirada` y `cambioMirada` de `marca.js` con el mismo motor (10). Diferencias con la marca, todas como parámetros:

| Situación | Muesca cerrada |
|---|---|
| Sigue | Solo si `siguePuntero(pose)` (esperando, teEspera) **y no** `ocupado`. Satura con `d / (|d| + 170)` y `d / (|d| + 140)`: a 900 px de distancia mira a .84, se lee desde cualquier punto del escritorio. |
| De dónde sale el puntero | Acoplada, el puntero global de Rust (`oficina://cursor`) en modo `'acoplada'`, como la marca. |
| Trabajando | Mira fijo `{ x: .3, y: .7 }` (lo suyo, abajo). |
| Puntero quieto 5 s | ~~Curiosea una vuelta y queda al frente.~~ **Sigue curioseando** (7 s por vuelta: izquierda, derecha, arriba, centro) mientras el puntero siga quieto: decisión del usuario, ver 15. |
| Reducido o pausa | Al frente, sin seguir, sin respirar. |

**Cursor global con la muesca cerrada (Rust):** hoy `zona_interactiva` recibe `abierta` y el sondeo solo avisa con el panel abierto. Pasa a recibir **`mirada`**: "el Avi que está a la vista quiere el puntero". La ventana la calcula así: `!zona.toda && (st.vista ? marca.quiereCursor() : muesca.quiereCursor())`, donde `quiereCursor()` = se ve, se puede mover y la pose sigue (`siguePuntero && !ocupado`).

- **Cada cuánto:** igual que hoy: el sondeo mira cada 20 ms y avisa solo si el puntero cambió, como mucho uno cada 50 ms (`PASO_CURSOR`). Puntero quieto: ningún aviso.
- **Cuándo no:** ventana escondida o minimizada, o en la tira (el sondeo ni corre: `debe_sondear`); arrastrando o en píldora (`toda`); movimiento reducido o "Pausar animaciones", Avi trabajando o durmiendo (`mirada: false`). Con `mirada: false` olvida lo avisado, así al volver avisa otra vez (como hoy con `abierta`).
- main.js vuelve a mandar la zona cuando cambia `quiereCursor()` (al final de `pintar()` y en `visible`); `enviarZona` ya descarta las repetidas por su clave.

## 10. Mapeo a código

### 10.1 `widget/src/muesca.js`

- **Nuevo** `TAM_MUESCA = { horizontal: { largo: 150, grosor: 54 }, vertical: { largo: 140, grosor: 62 } }` y `tamMuescaDe(borde, z = 1)` (px de pantalla).
- **`MARGEN_ZONA` 8 → 4.** `zonaInteractiva` no cambia de forma: la caja de la muesca, **sin hombros**, más 4 px por lado, medida en reposo (la caja sale de `TAM_MUESCA`, nunca del DOM transformado). Cubre el hover: 150 × 1,05 crece 3,75 px por lado y 54 × 1,05 crece 2,7 hacia el centro (a los costados 3,5 y 3,1). El golpe (1,1, 7,5 px por lado) puede salirse 3,5 px durante 480 ms: no abre ni toma clics, así que no importa.
- **`estadoMuesca`** devuelve `{ animo, modo, ocupado, pregunta, pendientes, sesiones, globo, chip, nombre }`. `animo`: `teEspera` con pregunta, `durmiendo` sin sesiones, si no `esperando` (ya no `coordinando`: trabajando es `esperando` + `ocupado: true`). Se van `punto` y `chipNombre`. `chip` queda solo para la píldora. Se borra `TRABAJA` y usa `ANIMOS_DE_TRABAJO` (exportado de `logica.js`).
- **`contenidoMuesca()`** devuelve el armazón del 3 (sin el Avi, que lo dibuja el motor en `#muesca-avi`), todo `aria-hidden`. Se escribe **una vez** al arrancar: `pintarMuesca` ya no reescribe el `innerHTML` (borraría el SVG del motor); actualiza `data-modo`, el texto de `.cuenta` y de `.excl`, y el `aria-label`.
- **Nueva** `figuraMuesca(animo)` = `avi(CLAUDE, animo, 66, { marca: true })`.
- `rectMuesca`, `rectLuz`, `HOLGURA`, `LUZ`, `recorte` y `tocaGolpe`: sin cambios.

### 10.2 `widget/src/marca.js` (se reusa, no se duplica)

- `proximoReposo` acepta `pesos` (por defecto `PESOS_REPOSO`). Con un solo candidato no aplica "nunca dos veces seguidas". `azar()` se sigue pidiendo dos veces y en el mismo orden. La muesca lo llama con `{ cucu: 1 }` y trata `siesta` como "se aquieta".
- `ACTOS.cucu` (7.3) y el canal `asir: 0` en `REPOSO` (la marca lo ignora; `salida` lo devuelve a 0 como a todos).
- `objetivoMirada` y `cambioMirada` aceptan `mira` (dónde mira si no sigue; por defecto `{ x: 0, y: 0 }`) y `ciclos` de curioseo (por defecto `Infinity`; la muesca, 1; después de la última vuelta, `cambioMirada` no programa más).

### 10.3 `widget/src/marcaMotion.js`

`montarMarca(el, { figura = figuraMarca, repertorio = 'escenario' | 'cucu', ciclos = Infinity, … })`. Con `'cucu'`: sorteo con `{ cucu: 1 }`, sin siesta ni notas, y el canal `asir` prende `.agarra` en el `.asoma` padre. Las referencias internas a `PESOS_REPOSO` pasan a ser las del repertorio. La API suma `animo(animo, reposo, { ocupado })` (`ocupado` pone `.ocupado` en el SVG y la mirada fija), `zona(dentro)` (el aviso de Rust: al salir, el próximo `pointermove` vuelve a decir "te vio") y `quiereCursor()`.

### 10.4 `widget/src/main.js`

- `const muescaAvi = montarMarca($('#muesca-avi'), { figura: figuraMuesca, repertorio: 'cucu', ciclos: 1 })`.
- `verMarca()` pasa a `verAvis()`: además `muescaAvi.visible(!!st.acople && !st.vista && !st.fuera && !st.mini && !document.body.classList.contains('pildora') && !st.arrastre?.activo, true)`.
- `pintarMuesca`: `muescaAvi.animo(e.animo, reposoPermitido(...), { ocupado: e.ocupado })`, `data-modo`, textos y nombre.
- `oficina://cursor` va a los dos motores (cada uno lo ignora si no se ve). `ponerDentro(d)` llama `muescaAvi.zona(d)`.
- **`MUESCA_DE_REFERENCIA` se va:** `tamMuesca()` = `tamMuescaDe(st.acople.borde, zoom())`, sin medir el DOM, y `pliegueHacia(borde)` usa `tamMuescaDe(borde)`. Se quita `observador.observe($('#muesca'))` (el tamaño ya no depende del chip). `colocar` pasa el tamaño de la muesca (`poner('m', d.local.muesca)` con tamaño: `--mw`, `--mh`).
- `enviarZona`: `zona.mirada` en lugar de `zona.abierta` (9).

### 10.5 `widget/src/muescaMotion.js`

- `cerrar`: al sacar `muesca-oculta` pone `body.muesca-vuelve` 320 ms (la entrada `vuelve` del Avi). Sin movimiento, nada.
- `golpe()` sin cambios (la clase); el comentario pasa a "escala desde el borde, salto del Avi, globo y luz".
- La apertura no cambia: el `hunde` cuelga de `body.abriendo`, que main.js ya pone antes de `abrir()`.

### 10.6 `widget/src/estilos.css` (sección muesca)

- `#muesca`: `display: block; width: var(--mw); height: var(--mh); padding: 0`; fuera `gap`, `flex-direction` y los rellenos por borde de 7.1. Quedan radios, hombros, `transform-origin` por borde, sombra y transiciones.
- Hover `scale(1.05)` (ya está) y lo mismo con `:focus-visible`.
- Todo lo de 5.1 y 6 bajo `#muesca` (para no tocar `.asoma` de la píldora). Fuera `.pt-*` de la muesca, `#muesca .chip` vertical y la regla de `chip-preg` en el golpe.
- `@keyframes golpe`, `saltoA`, `pop`, `resplandor`, `late`, `hunde`, `vuelve` (`hunde` y `vuelve` solo con `to` / `from`, así llegan a lo que diga el estado). Todos dentro de `prefers-reduced-motion: no-preference` y `:not(.pausa)`.
- `#muesca .efectos { display: none }`; `#muesca[data-modo="trabajando"] .parpado { transform-origin: 60px 70px; transform: scaleY(.74) }`; `#muesca[data-modo="duerme"] .bulbo { opacity: .45 }`.

### 10.7 `widget/src/avis.js`

`svgMarca` envuelve `efectos(...)` en `<g class="efectos">`. Nada más.

### 10.8 Rust (`widget/src-tauri/src/lib.rs`)

`Puntero.abierta` → `mirada`; `zona_interactiva(…, mirada: Option<bool>)`; `cursor_para_mirada` mira `p.mirada`; `olvidar_zona` la apaga. Comentarios de `EVENTO_CURSOR` y `Puntero` al día. Sin cambios en el sondeo ni en `PASO_CURSOR`.

### 10.9 Tests que fijan cada regla

| Regla | Test |
|---|---|
| 150 × 54 y 62 × 140, con el zoom | `muesca.test.js`: `tamMuescaDe` en los cuatro bordes al 100 y al 200 % |
| Zona = caja + 4, sin hombros, contiene el hover 1,05 | `muesca.test.js`: reemplaza "cubre la muesca corrida por el golpe (6 px)" |
| Modo, ánimo y `ocupado` por caso; trabajando = `ANIMOS_DE_TRABAJO` (una sesión en `proceso` o `escribiendo` cuenta) | `muesca.test.js`: reemplaza "trabajando: Avi coordinando, punto ámbar" |
| Nombres del 8 y globo "!" / "2" / "9+" | `muesca.test.js` |
| Armazón decorativo, sin punto ni chip fijo, con `#muesca-avi`, dos manos y globo | `muesca.test.js`: reemplaza "adentro de la muesca: el Avi, el punto y el chip" |
| Cucú: 2600 ms, se esconde 62 u y nunca más (queda la antena), termina en el reposo, ojos ∩ y manos de 1150 a 2600 | `marca.test.js` |
| `proximoReposo` con `{ cucu: 1 }`: siempre cucú, 40 s / 60–150 s, `siesta` a los 8 min, `azar` dos veces | `marca.test.js` |
| `mira` y `ciclos: 1`: no sigue y mira fijo; una vuelta de curioseo y al frente; `cambioMirada` no programa más | `marca.test.js` |
| Cursor con la muesca cerrada solo con `mirada` | `lib.rs`: los tests de `cursor_para_mirada` con `mirada` |

Sin dependencias nuevas.

## 11. Responsive y zoom

Sin breakpoints: la muesca vive en el borde del área de trabajo. Lo que cambia es el borde (5.1) y el zoom de 100 a 200 % (5.3). En una punta del borde, `lugarAjustado` ya hace entrar la muesca más grande y sus hombros.

## 12. Accesibilidad

- El botón conserva el nombre completo (8), `aria-expanded` y el foco visible; el contenido entero es `aria-hidden`.
- Hover y foco muestran lo mismo (el chip incluido): nada solo con el mouse.
- La zona interactiva (150 × 54 + 4 por lado) supera de sobra 44 × 44.
- Nada titila más de tres veces por segundo; la pregunta entre golpes queda quieta.
- Movimiento reducido y "Pausar animaciones": sin cucú, sin mirada, sin respiración, sin golpe; hover, foco y pregunta muestran sus piezas al instante (sin transición); la luz de cara queda fija en .8.
- El color nunca va solo: la pregunta también es glifo ("!" o número), manos y nombre.

## 13. Handoff

Orden: 1) `logica.js` exporta `ANIMOS_DE_TRABAJO`; `marca.js` (pesos, `cucu`, `asir`, `mira`, `ciclos`) con tests. 2) `muesca.js` (`TAM_MUESCA`, `MARGEN_ZONA`, `estadoMuesca`, `contenidoMuesca`, `figuraMuesca`) con tests. 3) `avis.js` (`g.efectos`). 4) `marcaMotion.js` (opciones y API). 5) `estilos.css` e `index.html`. 6) `main.js` y `muescaMotion.js`. 7) Rust (`mirada`). 8) `dev/vista.html?muesca=reposo|trabajando|pregunta|golpe|duerme` para revisar con Playwright, cuatro bordes, 100 y 200 %.

No improvisar: las medidas de 5.1, los tiempos y curvas de 6 y 7.3, que el recorte corte solo abajo, que el Avi no siga al puntero cuando trabaja, que el curioseo dé una sola vuelta, que se aquiete a los 8 min, la zona de +4 sin hombros y que nada corra cuando la muesca no se ve. Cualquier juego nuevo vuelve a diseño. Nada de la forma ni del personaje de la referencia.

## 14. Correcciones al boceto (2026-11-21)

- **Recorte:** `.asoma` de 52 × 48 a 52 × 54 con el Avi a `top: 4px` (antes −2) y a los costados `top: 40px` (antes 46): con 48 el hover cortaba 3 px de la antena. Se ve lo mismo en reposo.
- **Hover:** escala 1,06 → 1,05 (la de estilos.css): con 1,06 crecía 4,5 px por lado y se salía de la zona de +4.
- **Luz:** pasaba 64 px más allá de la muesca; ahora 28 (hombro de 16 + 12), lo que dibuja `rectLuz`.
- **Referencia:** los textos del boceto nombran a Troko solo como referencia de comportamiento.

## 15. Ajustes del usuario y de la implementación (2026-11-21)

- **El curioseo sigue (decisión del usuario).** Pregunta: «Cuando dejás el mouse quieto, el Avi de la muesca mira alrededor. ¿Una vuelta o sigue curioseando?». Respuesta: «Sigue curioseando». Reemplaza la fila "Puntero quieto 5 s" de la sección 9 y el "una vuelta" de 10.2, 10.3, 10.4, 10.9 y 13: en la muesca el curioseo se repite (7 s por vuelta: izquierda, derecha, arriba, centro) mientras el puntero siga quieto, con las mismas reglas de pausa de siempre (ventana escondida o minimizada, "Pausar animaciones", movimiento reducido, Avi trabajando o durmiendo → quieto). Por eso no existe la opción `ciclos`: la muesca usa el curioseo de la marca tal cual. Test: "el curioseo se repite mientras el puntero siga quieto" (`marca.test.js`).
- **Confirmados tal cual por el usuario:** el globo con número ("!" con una pregunta, "2"…"9+" con varias) y el cucú hasta los 8 min de quietud, sin siesta.
- **`zona(dentro)` solo usa la salida.** La entrada la avisa el primer `pointermove` (que ya interrumpe el cucú, pone la quietud a cero y dice "te vio"); `zona(false)` marca que el puntero salió, así la próxima entrada vuelve a decir "te vio".
- **Globo:** `min-width` 17 y relleno de 3 px a los lados, para que "9+" entre en la píldora ámbar; a los costados se centra con márgenes (no con `transform`, que lo usa el `pop`). El `pop` del golpe tiene su propio nombre (`popGolpe`): cambiar solo la duración no reinicia una animación.
- **Vista de desarrollo:** `?muesca=reposo|trabajando|pregunta|golpe|duerme` (con `&acople=…`) son atajos de `?estado=…` y `?vacio`; pregunta y golpe son el caso de siempre (la pregunta de catalogo golpea al llegar).
