# Avis · La charla con herramientas (tareas y hábitos) — dirección

> Issue #43. Boceto: `docs/diseno/bocetos/chat-herramientas.html` (servirlo con http desde la raíz del repo). Tres opciones: **A · Recibo**, B · Ficha viva y C · Sello. **Quintana eligió A · Recibo el 25/11** y aprobó las decisiones del boceto (sección 15). Esta dirección cubre solo A; de B y C no se toma nada (sin chispa al escenario, sin contador en el escenario, sin libro de cambios arriba del hilo).
> Evoluciona `chat-avis-ux.md` (la hoja `#hoja`, el hilo, 7.1 «la lista fija de argumentos», 9.1 el historial) y se apoya en `tareas-ux.md` (la fila de tarea, `etiquetaFecha`, los archivos de 11.1 y el aviso de 11.7) y `habitos-ux.md` (11.1 y 11.3, para la entrega posterior). Lo que no se nombra acá sigue como está allí.

---

## 1. Brief

- **Pedido (24/11):** manejar tareas y hábitos hablando con la mascota («anotame comprar pan para mañana»).
- **Requisitos (#43, límites aprobados):** S1 el chat de Avis recibe solo herramientas propias de Avis: ver, crear, editar y tildar tareas; ver y marcar hábitos · S2 borrar solo con clic, nunca por chat; nada de archivos, comandos, internet ni mails desde estas herramientas · S3 cada cambio aparece en la charla como una tarjeta con «Deshacer» · S4 servidor local (127.0.0.1) que solo ve el chat de Avis, nunca las sesiones de Claude Code del usuario · S5 primero con Claude Code; el modelo local se suma después, solo si al medirlo se equivoca poco.
- **Notas del issue:** cambia la regla «nunca agregar herramientas» del chat (`argumentos_chat`): **revisión de seguridad propia**. Depende de Tareas (#39) y Hábitos (#41).
- **Para quién:** Quintana, con la charla abierta mientras trabaja: anota al pasar sin cambiar de módulo.
- **Acción principal:** pedir un cambio y ver, sin dudas, qué cambió. La segunda: deshacerlo con un clic.
- **Vara:** `webs portfolio/brasa-noble`. Movimiento con sentido, accesible, 60 fps en un equipo medio.

## 2. Concepto

**El recibo.** La mascota contesta corto («Listo, para mañana en Compras.») y debajo deja un recibo: la misma fila de Tareas en chico, con lo que hizo, y «Deshacer» al lado. Varios cambios, un recibo con una fila cada uno. Tres palabras: **claro, reversible, sin sorpresas**. Lo que se recuerda: **el sello**. Cuando llega el cambio, una luz ámbar barre el borde del recibo y el tilde se dibuja; al deshacer, una raya tacha la fila. Lo que la mascota puede tocar se dice siempre, en una línea arriba del hilo.

Principios: la mascota nunca borra; todo cambio se ve y se deshace; el recibo dice la verdad de Avis (lo arma Avis con lo que escribió en el disco, no el texto del modelo); con el modelo local no hay herramientas y la pantalla lo dice.

## 3. Arquitectura

### 3.1 Qué cambia en la charla

- **Claude Code:** el proceso `claude -p` de la charla suma el servidor MCP de Avis (11.1) y sus herramientas de tareas (11.4). Hábitos se suma en la entrega C3 (14), después de que exista Hábitos (#41).
- **Local:** sin cambios en lo que hace; solo su instrucción suma una frase (11.3) y la pantalla dice «todavía no» (4.1).
- **El recibo** lo dibuja la ventana con los eventos que emite Rust cuando el servidor escribió algo (11.6). El texto del modelo no crea recibos.

### 3.2 Dónde se dibuja

Dentro de la hoja `#hoja`:

1. **La línea «Puede tocar»** (`button.puede#ch-puede`, 4.1): fija, entre la cabecera (carpeta, motor, modelo) y el hilo. Con Claude Code y con Local.
2. **El recibo** (`.rec`, 4.2): dentro del mensaje de la mascota del turno que hizo el cambio, **después de su texto**, en un contenedor `div.recibos`. Un mensaje tiene como mucho un recibo de cambios, más los de lectura, borrar o error (4.5 a 4.8), en el orden en que llegan.

### 3.3 Árbol del DOM (un mensaje de la mascota)

```text
div.msg.de-mascota
├── .quien
├── div.herr          («↳ …», sin las herramientas de Avis: 16)
├── div.m-m           (el texto; mientras llega, .m-m.vivo > .txt > p.abierto)
└── div.recibos       (nuevo; aria-live="polite" solo mientras el turno corre)
    ├── section.rec[data-rec="cambios"][aria-label="{encabezado}"]
    │   ├── div.rec-h  (rótulo + «Ver en Tareas →»)
    │   ├── div.rf[data-cambio="c-…"] × n     (role="group", aria-label «{verbo}: {título}»)
    │   └── div.rec-pie («Deshacer los {n}», desde 2)
    ├── section.rec.lee      (lectura, 4.5)
    ├── section.rec.neutro   (para borrar, 4.6)
    └── section.rec.mal      (error, 4.7)
```

### 3.4 Estado en la ventana

Cada mensaje de la mascota suma **`cambios: Cambio[]`** (11.8), que llega por el evento `tipo: "cambio"` (11.6) y se guarda con la charla. `vivo.sellados: Set<id>`: los recibos ya animados (10); un recibo sellado se vuelve a dibujar quieto.

## 4. Componentes

### 4.1 Línea «Puede tocar» (`button.puede`, molécula)

Ancho completo, 30 de alto, radio 10, fondo `--s1`, borde 1 `--linea`, texto `--t-mono-s` `--crema2`. A la izquierda, un cuadrado de 18 (radio 6, fondo `color-mix(--ambar 18%)`) con el ícono de tilde de Tareas en `--ambar`; a la derecha, la pista en `--tenue`. Textos en 5.1.

- **Claude Code:** «Puede tocar **tus tareas**» (con C3: «**tus tareas y hábitos**») · pista «borrar, no ›».
- **Local:** borde punteado, ícono en `--s3`/`--tenue`: «Tareas y hábitos: **todavía no con Local**» · pista «?».
- **Clic:** abre debajo un globo (`div.puede-globo`, `role="dialog"`, fondo `--s2`, borde `--linea-hover`, radio 12, relleno 12, ancho de la hoja menos 28) con el texto de 5.1. Con Local, además, «Charla nueva con Claude Code» (`.mini.pri`): crea una charla nueva con el motor Claude Code (el motor de una charla con mensajes no cambia, D8 de la charla). Se cierra con Esc, con la × o con un clic afuera. `aria-expanded` en la línea.
- Estados: hover, borde `--linea-hover`; foco, el anillo de siempre; presión, `scale(.99)`.

### 4.2 Recibo de cambios (`section.rec`, organismo)

Radio 14, fondo `--s1`, borde 1 `--linea`, `overflow: hidden`. Un borde superior de luz (`::before`, 2 px, `linear-gradient(90deg, transparent, var(--ambar), transparent)`) que barre una vez (10).

- **Encabezado** (`.rec-h`): relleno 9/12/0, `--t-rotulo` en mayúsculas con `letter-spacing .12em`, `--ambar`. Texto de 5.2 según el cambio. A la derecha, `.lnk` «Ver en Tareas →» (`--t-mono-s` `--crema2`, 32 de alto de área): `irModulo('tareas', { lista, tarea })` del último cambio.
- **Filas** (`.rf`, 4.3), separadas por `--linea`.
- **Pie** (`.rec-pie`, desde 2 cambios): a la izquierda «tareas» (o «tareas y hábitos») en mono `--tenue`; a la derecha «Deshacer los {n}» (4.4).

### 4.3 Fila de cambio (`.rf`)

Grilla `18px · 1fr · auto`, mín. 52 de alto, relleno 8/8/8/12.

- **Marca:** el círculo de Tareas (18, borde 1,5 `--linea-hover`); tildada, relleno `--ambar` con el visto `--negro` que se dibuja (10). Hábito (C3): el anillo de 18 con su avance.
- **Texto:** el título en `--t-cuerpo-f` (una línea, «…»); debajo, el verbo en mono `--tenue` («anotada ·») y las etiquetas de Tareas: la de fecha (`etiquetaFecha` de `tareas.js`, en `--ambar` si es hoy o mañana, `--rojo` si vencida) y la de lista (`.tg` con su punto de color). Para «movida»: «Casa → Compras»; para «nueva fecha»: «hoy → vie 27/11».
- **Acción:** «Deshacer» (4.4). Con 2 o más filas, la de cada fila es solo el ícono (32 × 32), con `aria-label`.

### 4.4 Deshacer (`button.deshacer`, átomo)

32 de alto, radio píldora, borde 1 `--linea-hover`, `700 11.5px/1` `--crema2`, ícono de flecha que vuelve (12). Estados:

| Estado | Se ve |
|---|---|
| Normal | «Deshacer» (o solo el ícono) |
| Hover / foco | fondo `--s3`, texto `--crema` / anillo `--ambar` |
| Presión | `scale(.96)` |
| En curso | `aria-busy="true"`, `aria-disabled="true"`, el ícono gira una vez (300 ms) |
| Hecho | el botón se va; queda «Deshecho» (`--t-mono-s` `--tenue`) y la fila tachada al 45 % |
| Cambió después | el botón se va; queda «Cambió después» con `title` de 5.2 |
| Falló | el botón queda; debajo de la fila, «No se pudo deshacer. Probá de nuevo.» en `--rojo` |

«Deshacer los {n}» deshace de la última a la primera, cada una con su regla (11.7); el pie cambia a «Deshechos {k} de {n}» si alguna no se pudo.

### 4.5 Recibo de lectura (`.rec.lee`)

Sin barrido. Encabezado en `--crema2`: «Hoy · {día} {d/m}» (o «Vencidas», o el nombre de la lista), con la barra de avance de Tareas (70 × 4) y «{hechas} de {total}». Hasta 6 filas (las de `vista()` de `tareas.js`, en su orden: vencidas en rojo, después hoy, las tildadas al final tachadas), sin «Deshacer». Con más: «y {k} más». Pie: «solo lectura · no cambió nada» y «Abrir Tareas →» (`.mini.pri`). Con C3, una fila de hábitos de hoy (píldoras con anillo).

**Cuándo sale:** solo si el turno terminó, **no hizo ningún cambio** y su última llamada fue `tareas_ver` con vista `hoy`, `vencidas` o `lista` (una lectura que el modelo hace para buscar un `id` antes de cambiar algo no deja recibo).

### 4.6 Para borrar (`.rec.neutro`)

Sin barrido, encabezado «Para borrar» en `--crema2`. Una fila con la tarea (sin verbo) y «Ir a la tarea →» (`.mini.pri`): `irModulo('tareas', { lista, tarea, abrir: true })`, que abre la tarea (tareas-ux 4.7) con el foco en su «Borrar tarea». Si la tarea ya no existe, el botón queda `aria-disabled` con «Ya no está».

### 4.7 Recibo de error (`.rec.mal`)

Borde `rgba(255,122,107,.45)`, fondo con velo rojo, barrido rojo. Encabezado en `--rojo` («No se anotó», «No se cambió», «No se tildó»). La fila con lo que se pidió (círculo al 40 %, sin verbo), el motivo debajo (5.2) y los botones: «Reintentar» (`.mini.pri`, solo si el error es `reintentable`, 11.9) y «Abrir Tareas» (`.mini.sutil`).

### 4.8 Cambio que no llegó (`.rec.mal`)

Al terminar el turno, si el modelo pidió más cambios (`tool_use` de `tarea_crear`, `tarea_editar` o `tarea_tildar`) que los que Avis registró (hechos o con error), se suma un recibo de error sin fila: «Un cambio no llegó a Avis» y «Avi intentó cambiar algo y Avis no lo recibió. No cambió nada; revisá en Tareas.» con «Abrir Tareas».

## 5. Contenido (textos exactos)

### 5.1 La línea y su globo

| Lugar | Texto |
|---|---|
| Línea, Claude Code | «Puede tocar **tus tareas**» · pista «borrar, no ›» (C3: «**tus tareas y hábitos**») |
| Línea, Local | «Tareas y hábitos: **todavía no con Local**» · pista «?» |
| Globo, Claude Code | «Puede ver tus tareas, anotar, cambiar fecha, lista, notas o si es importante, y tildar. **No puede borrar**: eso lo hacés vos con un clic. Cada cambio queda acá con «Deshacer».» (C3 suma: «Y ver y marcar tus hábitos de hoy.») |
| Globo, Local | «Con el modelo local, Avi todavía no toca tus tareas ni tus hábitos: solo charla. Para que los maneje, charlá con Claude Code.» · «Charla nueva con Claude Code» |
| `aria-label` de la línea | «Puede tocar tus tareas. Ver qué puede y qué no» · «Tareas y hábitos: todavía no con el modelo local. Ver más» |

### 5.2 Recibos

| Lugar | Texto |
|---|---|
| Encabezado, un cambio | `tarea_crear` «Anoté en Tareas» · `tarea_tildar` «Tildé en Tareas» / «Destildé en Tareas» · `tarea_editar` «Moví en Tareas» (solo lista) / «Cambié en Tareas» (lo demás) · C3 `habito_marcar` «Marqué en Hábitos» |
| Encabezado, varios | «{n} cambios» |
| Vínculo | «Ver en Tareas →» · «Ver en Hábitos →» (si todos son de hábitos) |
| Verbo de la fila | «anotada» · «tildada» · «destildada» · «movida» · «nueva fecha» · «sin fecha» · «renombrada» · «importante» · «ya no importante» · «notas» · «editada» (más de un campo) · C3 «marcado» |
| Pie | «tareas» · «tareas y hábitos» · «Deshacer los {n}» · «Deshechos {k} de {n}» |
| Deshacer | «Deshacer» · `aria-label` «Deshacer: {verbo} {título}» · «Deshecho» · «Cambió después» · `title` «La tarea cambió en Tareas después de esto: cambiala a mano.» · «No se pudo deshacer. Probá de nuevo.» |
| Lectura | «Hoy · {miércoles} {25/11}» · «Vencidas» · «{lista}» · «{k} de {n}» · «y {k} más» · «solo lectura · no cambió nada» · «Abrir Tareas →» |
| Para borrar | «Para borrar» · «Ir a la tarea →» · «Ya no está» |
| Error, encabezado | «No se anotó» · «No se cambió» · «No se tildó» |
| Error, motivos (los arma Rust, 11.4) | «No existe la lista «{nombre}».» · «No hay listas todavía: creá una en Tareas.» (solo si ya hay nueve archivos `l-tareas…`) · «Esa tarea ya no está.» · «El archivo de la lista está roto: no lo toco.» · «No se pudo guardar. No cambió nada.» · «Demasiados cambios en un mensaje: hacé de a 20.» |
| Error, botones | «Reintentar» · «Abrir Tareas» |
| No llegó | «Un cambio no llegó a Avis» · «Avi intentó cambiar algo y Avis no lo recibió. No cambió nada; revisá en Tareas.» |

### 5.3 Anuncios (`role=status`)

«Anotada: {título}, {fecha}» · «{n} cambios: {verbo} {título}; …» · «Deshecho: {título}» · «No se pudo deshacer {título}» · «No se anotó: {título}. {motivo}». Uno por recibo, cuando el turno termina (no fila por fila mientras llega).

### 5.4 La bienvenida de una charla nueva con Claude Code

Suma una sugerencia a las de hoy (`sugerencias` de `chat.js`): «Anotame comprar pan para mañana» y «¿Qué tengo hoy?» (C3: «Marcá que tomé agua»). Con Local, no.

## 6. Sistema visual

Tokens de `estilos.css` sin cambios; los recibos reusan las piezas de Tareas (el círculo, `.tg`, `etiquetaFecha`, la barra de avance) y de la charla (`.mini`, `.lnk`). Nuevo solo: `.puede`, `.rec` (y `.lee`, `.neutro`, `.mal`), `.rf`, `.deshacer`, `.recibos`.

Contraste (calculado con la fórmula WCAG sobre los tokens; fondo `--s1` de la tarjeta): `--crema` 16,5:1; `--crema2` 9,6:1; `--tenue` 5,3:1; `--ambar` 10,7:1; `--rojo` 7,7:1. Sobre `--s2` (el globo): `--tenue` 4,9:1, el más justo, ≥ 4,5. `--negro` sobre `--ambar` (el visto del tilde) 11,5:1; `--tinta` sobre `--crema` (`.mini.pri`) 15,9:1.

## 7. Estados

| Estado | Qué se ve |
|---|---|
| **Charla nueva, Claude Code** | la línea «Puede tocar», la bienvenida con las sugerencias de 5.4 |
| **Cambio en curso** | el texto de la mascota llega como hoy; el recibo aparece y se sella apenas llega el evento, aunque el texto siga |
| **Varios cambios** | un recibo; cada fila entra al llegar; el encabezado pasa de «Anoté en Tareas» a «2 cambios» cambiando solo su texto; el pie aparece con la segunda fila |
| **Deshacer en curso / hecho / cambió después / falló** | 4.4 |
| **Lectura** | 4.5, al terminar el turno |
| **Pedir borrar** | el texto de la mascota (11.3) y 4.6 |
| **Error de una herramienta** | 4.7 en el lugar de la fila que hubiera ido |
| **No llegó** | 4.8 al terminar el turno |
| **Frenada** | lo que se escribió antes de frenar queda con su recibo; el servidor rechaza todo cambio después de frenar (11.1) |
| **Charla retomada** (del cajón, o tras reabrir Avis) | los recibos se dibujan quietos desde el historial, con su estado («Deshecho», «Cambió después»); «Deshacer» sigue andando (11.7) |
| **Local** | la línea punteada; sin recibos; si se le pide un cambio, la mascota contesta en texto (11.3) |
| **Error de la charla** (red, límite, proceso) | los de hoy (`textoError`); los recibos ya puestos quedan |

## 8. La hoja de Tareas cuando cambia algo por charla

Con Tareas abierta (en la columna, al lado de la hoja), un cambio de la charla entra como si lo hubiera hecho el usuario: Rust emite `oficina://tareas` (11.6), la ventana relee esa lista y redibuja **por partes** (sin pisar un campo con foco ni su cursor, el patrón `ponerParteConCampo`). La fila nueva o cambiada lleva el destello de «recién agregada» de tareas-ux 10. Deshacer, igual. Si la tarea abierta en el detalle (tareas-ux 4.7) cambió por charla, sus campos sin foco se ponen al día y el que tiene foco conserva lo que se está escribiendo (al guardarlo, 11.5 resuelve el choque).

## 9. Teclado y foco

### 9.1 Esc, por capas
Las de la charla de hoy, más una nueva al principio: el globo de «Puede tocar» abierto → se cierra (foco a la línea).

### 9.2 Orden de tabulación
Cabecera (carpeta, motor, modelo) → línea «Puede tocar» → hilo (los controles de los recibos en orden: «Ver en Tareas →», cada «Deshacer», «Deshacer los {n}», «Reintentar», «Abrir Tareas», «Ir a la tarea →») → campo → enviar.

### 9.3 Dónde va el foco
- Mientras llega un recibo, el foco **no se mueve** (se queda en el campo).
- Deshacer una fila → el foco queda en «Deshecho» (el `span` lleva `tabindex="-1"`) y se anuncia.
- «Deshacer los {n}» → queda en el pie.
- «Ver en Tareas →», «Abrir Tareas», «Ir a la tarea →» → el `h1` de Tareas (o el botón «Borrar tarea» del detalle, en 4.6).
- «Reintentar» → la fila nueva que lo reemplaza.

### 9.4 Atajos
Ninguno nuevo.

## 10. Movimiento

Módulo **`recibosMotion.js`** (anime.js v4 de `vendor/animejs`), llamado desde `pintarHilo` solo para recibos que no están en `vivo.sellados`. Todo bajo `prefers-reduced-motion: no-preference` y `body:not(.pausa)`.

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Llega un recibo | Entra 10 px desde abajo con `scale .96 → 1` | 600 ms `outBack(1.6)` |
| El sello | La luz del borde barre de izquierda a derecha (`translateX -100% → 100%`), una vez | 900 ms `--ease`, empieza a los 100 ms |
| Tildada | El visto se dibuja (`stroke-dashoffset 14 → 0`) | 500 ms `--ease`, empieza a los 250 ms |
| Fila que se suma a un recibo | Entra 8 px desde abajo; las del mismo evento escalonadas 70 ms | 420 ms `outExpo` |
| Deshacer | La raya crece de 0 a 100 % sobre el título; la fila baja a 45 % de opacidad; «Deshecho» entra con fundido | 400 ms `--ease` / 300 ms |
| Error | Entra como un recibo, sin rebote (`scale` no), barrido rojo | 420 ms `outExpo` |
| Lectura | Las filas entran escalonadas 50 ms, sin barrido | 360 ms `outQuart` |
| Globo «Puede tocar» | Baja 6 px y aparece | 220 ms `outQuart` |

**Una vez por recibo:** el acto corre solo la primera vez que se ve un `id` de cambio en esta ejecución (`vivo.sellados`). Rehacer el hilo entero (cambio de charla, redibujo con firma nueva) lo pone quieto.
**Movimiento reducido:** recibos, filas y «Deshecho» aparecen con un fundido de 160 ms; sin barrido, sin rebote; el visto ya dibujado; la raya aparece entera. **Pausa:** todo al instante.

## 11. Contrato para el implementador

### 11.1 El servidor MCP de Avis (`mcp_avis.rs`, nuevo)

- **Dónde escucha:** `127.0.0.1` y un puerto que elige el sistema (`bind("127.0.0.1:0")`). Nunca `0.0.0.0`, nunca `localhost` resuelto. Arranca con el primer `chat_abrir` con motor `claude` y vive hasta que Avis sale.
- **Transporte:** MCP «Streamable HTTP»: `POST /mcp` con JSON-RPC 2.0 (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`, `ping`), respuesta `application/json`. Lo que pida Claude Code además (SSE, `GET /mcp`, `Mcp-Session-Id`, versión de protocolo) sale de la medición M-H5 (11.12). Otra ruta o método → 404/405.
- **Token por arranque del proceso:** cada vez que `lanzar` arranca un `claude -p`, Rust genera un token de 32 bytes con un generador criptográfico del sistema (**no** `semilla()` de chat.rs, que no lo es) y lo ata a `{ conversacion }`. El proceso lo manda en `Authorization: Bearer …`. Un token que no existe o de un proceso que ya salió → 401 sin detalle. El token nunca se escribe en `widget.log`.
- **Rechazos antes de leer el cuerpo:** `Host` distinto de `127.0.0.1:{puerto}` → 403 (rebinding de DNS); cualquier cabecera `Origin` → 403 (un navegador no tiene nada que hacer acá); cuerpo de más de 64 KB → 413. Tiempo máximo por pedido: 10 s.
- **Solo durante un turno:** `tools/call` de una conversación sin turno en curso (antes del primer mensaje, después de `Fin`, después de frenar) → error de herramienta «No hay un mensaje en curso.» Así un proceso que sigue vivo no puede cambiar nada fuera de un pedido del usuario.
- **Tope:** 20 cambios por turno (el 21 → error de 5.2).
- **Qué ve:** solo `<config>/tareas/` (y en C3 `<config>/habitos/`), con las funciones de `tareas.rs`. Nunca `~/.claude`, las sesiones, la carpeta de la charla, la red ni comandos. No hay herramientas de borrar.
- **Las sesiones de Claude Code del usuario no lo ven:** el servidor solo se nombra en los argumentos del proceso de la charla (11.2), que usa `--strict-mcp-config`. Nada lo escribe en `~/.claude.json`, en `.mcp.json` ni en el mod `oficina`.
- **Dependencia:** HTTP/1.1 mínimo escrito sobre `std::net` (un cliente, pedidos chicos) **o** una biblioteca; sumar una biblioteca es Risk item 5 y lo decide el orquestador. No se reusa `ureq` (es cliente).

### 11.2 `argumentos_chat`: qué cambia y qué no

| Argumento | Hoy | Con #43 |
|---|---|---|
| `-p`, `--input-format stream-json`, `--output-format stream-json`, `--verbose`, `--include-partial-messages`, `--replay-user-messages` | sí | **igual** |
| `--permission-mode manual`, `--permission-prompts none` | sí | **igual** (lo que no está en `--allowedTools` se niega solo) |
| `--tools Read,Glob,Grep` | sí | **igual**, salvo que M-H3 muestre que `--tools` también filtra las herramientas MCP; entonces suma los cinco nombres de abajo y nada más |
| `--allowedTools Read,Glob,Grep` | sí | **`Read,Glob,Grep,mcp__avis__tareas_ver,mcp__avis__tarea_crear,mcp__avis__tarea_editar,mcp__avis__tarea_tildar,mcp__avis__tarea_mostrar`**: la lista exacta, **sin comodín** (`mcp__avis__*` dejaría pasar cualquier herramienta que el servidor sume mañana sin test). C3 suma `mcp__avis__habitos_ver,mcp__avis__habito_marcar` |
| `--safe-mode` | sí | **se reemplaza por `--restricted`** (decisión de Quintana del 25/11). M-H2 midió que `--safe-mode` apaga `--mcp-config` en Claude Code 2.1.332 (`init` con `mcp_servers: []`, el servidor recibe 0 pedidos). Con `--restricted` + `--strict-mcp-config` + `--mcp-config` + `--settings` se conecta solo `avis`, sin el CLAUDE.md, las skills, los hooks ni los settings del usuario o del proyecto (`--settings` sí se aplica), con ~7 550 tokens de entrada en el primer turno (~960 son las cinco herramientas de Avis). Read, Glob y Grep quedan encerrados en la carpeta de trabajo (lo de afuera da `permission_denied`; con `--safe-mode` se podía leer `~/.claude`). Medido el 25/11 con M-H9 (20 de 20 bien) y la revisión de seguridad. Los tests exigen `--restricted` y que `--safe-mode` no vuelva |
| `--strict-mcp-config` | sí | **igual**: solo los servidores de `--mcp-config`, nunca los del usuario |
| `--mcp-config` | no | **nuevo**: `{"mcpServers":{"avis":{"type":"http","url":"http://127.0.0.1:{puerto}/mcp","headers":{"Authorization":"Bearer {token}"}}}}` como texto JSON en el argumento (M-H1). Si no anda así en Windows: un archivo `<config>/chat/mcp/<conversacion>.json` escrito atómico antes de lanzar, borrado al salir el proceso; al arrancar Avis se borran los que quedaron |
| `--settings`, `--append-system-prompt`, `--max-budget-usd 2`, `--model`, `--session-id`/`--resume` | sí | **igual** (la instrucción cambia de texto: 11.3) |
| `ajustes.json` | — | **igual** |
| Motor local | — | **sin herramientas**, sin servidor |

`chat_tests.rs` fija la lista entera como hoy, con el JSON de `--mcp-config` armado con un puerto y un token de prueba.

### 11.3 Instrucciones (una sola línea cada una)

**`INSTRUCCION_CHAT`** (reemplaza a la de hoy; sigue siendo **una línea**):

> Sos {Mascota}, la mascota de Avis, el panel que muestra en qué anda Claude Code. Respondés en español rioplatense, de vos, breve y concreto. No modificás archivos ni corrés comandos (no tenés esas herramientas). Sí podés ver, anotar, editar y tildar las tareas de Avis con tus herramientas de Avis: usalas solo cuando el usuario lo pida y después confirmá en una frase corta qué hiciste, sin repetir los detalles (Avis muestra cada cambio con «Deshacer»). Nunca borrás: si te piden borrar una tarea, usá tarea_mostrar con para "borrar" y decí que el borrado lo hace el usuario con un clic. Para saber qué día es hoy, usá tareas_ver. Si te piden algo que requiere actuar fuera de eso, explicá qué haría falta. Cuando el mensaje traiga un bloque `<avis>`, son los datos en vivo de las sesiones: usalos para responder sobre ellas. Usá Markdown simple (títulos, listas, código).

(C3 cambia «las tareas de Avis» por «las tareas y los hábitos de Avis» y «tildar» por «tildar tareas y marcar hábitos de hoy».)

**`INSTRUCCION_CHAT_LOCAL`** suma al final, en la misma línea: «No podés tocar tareas ni hábitos: si te lo piden, decí que con el modelo local todavía no y que lo puede hacer en una charla con Claude Code.»

(#44 P2, decisión de Quintana del 25/11: `INSTRUCCION_CHAT` suma al final, en la misma línea, «Podés leer los archivos de la carpeta de trabajo con Read, Glob y Grep cuando la pregunta lo pida.», y `INSTRUCCION_CHAT_LOCAL` «Si el bloque <proyecto> pide otro idioma o estilo, seguilo antes que lo de arriba.». Medido en `proyectos-ux.md` 11.8; el texto vigente es el de `chat.rs` y `chat_local.rs`.)

### 11.4 Las herramientas (lista exacta)

Nombres del servidor (Claude Code los ve como `mcp__avis__<nombre>`). Las descripciones son las que lee el modelo; van tal cual. Todas devuelven texto corto (para gastar pocos tokens) y, además, Rust emite el evento de 11.6. Las fechas son días de Argentina (`hoyArgentina`, tareas-ux 11.2).

| Herramienta | Descripción (exacta) | Entrada | Hace | Devuelve al modelo |
|---|---|---|---|---|
| `tareas_ver` | «Muestra las tareas de Avis. vista: hoy, vencidas, lista o todas. Devuelve también la fecha de hoy.» | `{ vista: "hoy"\|"vencidas"\|"lista"\|"todas", lista?: string (nombre o id, con vista "lista"), hechas?: bool = false }` | solo lee | JSON compacto: `{ hoy, diaSemana, listas: [{ id, nombre }], tareas: [{ id, lista, titulo, fecha, importante, hecha }] }`, hasta 100 tareas |
| `tarea_crear` | «Anota una tarea nueva. Sin lista va a la primera. fecha: AAAA-MM-DD, "hoy", "mañana" o "pasado mañana".» | `{ titulo: 1–200, lista?: string, fecha?: string\|null, importante?: bool, notas?: ≤ 4000 }` | crea la tarea (id `t-…` de Rust, `creada` = ahora). **Sin ninguna lista y sin `lista` pedida** (decisión de Quintana del 25/11): arma la lista «Tareas» (`l-tareas`, o `l-tareas-2`… si ya hay un archivo con ese id, aunque esté roto: nunca se pisa) con la tarea adentro, y el cambio lleva `listaNueva: { nombre, color }` (el chip del recibo dice «Tareas · nueva»; el historial lo guarda) | «Anotada «{título}» en {lista}{, para el AAAA-MM-DD}.» · con lista nueva: «… en Tareas (lista nueva)…» |
| `tarea_editar` | «Cambia una tarea: título, fecha (null la quita), importante, notas o lista (la mueve). Pasá solo lo que cambia.» | `{ id: "t-…", titulo?, fecha?, importante?, notas?, lista? }` (al menos uno) | cambia esos campos; mover = la regla de dos listas de tareas-ux 11.3 (destino primero) | «Listo: {lo que cambió}.» |
| `tarea_tildar` | «Tilda o destilda una tarea.» | `{ id, hecha: bool }` | `hecha` y `hechaEn` | «Tildada «{título}».» / «Destildada…» |
| `tarea_mostrar` | «No cambia nada: le muestra al usuario una tarea con un botón para abrirla. Usala cuando pida borrar una tarea (el borrado lo hace él).» | `{ id, para: "borrar"\|"ver" }` | nada en disco | «Le mostré «{título}».» |
| C3 `habitos_ver` | «Muestra los hábitos de hoy con lo que lleva cada uno. Devuelve también la fecha de hoy.» | `{}` | solo lee | `{ hoy, habitos: [{ id, nombre, tipo, meta, unidad, hoy, toca, hecho }] }` |
| C3 `habito_marcar` | «Marca un hábito de hoy. valor: lo que lleva hoy (0 lo desmarca); o sumar: cuánto agregar.» | `{ id: "h-…", valor?: 0–999, sumar?: -999–999 }` (uno de los dos) | `registro[hoy]` con las reglas de habitos-ux 11.1 y 11.3; solo hoy | «Marcado «{nombre}»: {n}{ de meta}.» |

- **Nunca existen:** borrar tareas, crear, renombrar o borrar listas, subtareas, crear, editar o borrar hábitos, marcar otros días. `tools/list` devuelve exactamente las de la tabla (test).
- **Escritura:** una función nueva `tareas::modificar(carpeta, id_lista, |doc| …)` que lee, cambia y escribe **con el candado de `tareas.rs` tomado**, con `normalizar`, `conservar` y `atomico::escribir`. Reusa los topes y las reglas de archivo roto (un archivo roto da el error de 5.2 y queda igual). Nunca `tareas_guardar` con un documento armado aparte.
- **Errores** (validación, lista que no existe, tarea que no existe, archivo roto, disco): la herramienta devuelve `isError: true` con el motivo de 5.2, y Rust emite el cambio con `estado: "error"`, `motivo` y `reintentable` (true solo para fallas de disco o candado).

### 11.5 Dos escritores sobre las listas (la ventana y el servidor)

Hoy la ventana guarda **la lista entera** que tiene en memoria (`tareas_guardar`). Con la charla escribiendo, una copia vieja de la ventana pisaría un cambio de la charla. Regla:

- `tareas_leer` devuelve, por lista, **`huella`** (hash de los bytes del archivo).
- `tareas_guardar(lista, huella)`: si el archivo cambió desde esa huella, no escribe y devuelve `{ ok: false, error: "cambio" }`. La ventana relee esa lista, vuelve a aplicar **la acción** que estaba guardando (tildar, el título, mover…) una vez y guarda de nuevo; si choca otra vez, el error de tareas-ux 7.4. Sin `huella` (compatibilidad), guarda como hoy.
- Al recibir `oficina://tareas`, la ventana relee la lista enseguida (8).
- Es Risk item 4 (dos escritores) e item 3 (cambia `tareas_guardar`, que comparte toda la hoja de Tareas): su test de lo de antes (guardar sin cambios ajenos funciona igual) va con la entrega.

### 11.6 Eventos a la ventana

- **`oficina://chat`** suma `tipo: "cambio"`: `{ conversacion, turno, tipo: "cambio", cambio: Cambio }` (11.8), emitido por el servidor después de escribir (o al fallar), y `tipo: "lectura"` y `tipo: "mostrar"` con los datos de 4.5 y 4.6. `transicionChat` (chat.js, puro) los suma a `cambios` del mensaje de la mascota del turno; un evento de otra conversación o de un turno que ya no está se descarta.
- **`oficina://tareas`**: `{ lista: "l-…", tarea: "t-…", origen: "chat" }` después de cada escritura (también al deshacer). Lo anunciaba tareas-ux 11.7.
- `EventoChat::Herramienta` (la línea `.herr`) sigue llegando para todas las herramientas, pero `textoHerramientas` **no** muestra las `mcp__avis__…` (tienen recibo).

### 11.7 Deshacer

Comando **`chat_deshacer(conversacion, cambio)`** → `{ estado: "deshecho" | "cambio-despues" | "error", motivo? }`. Rust valida la forma del cambio y, con el candado de tareas:

| Herramienta | Deshacer | «Cambió después» cuando |
|---|---|---|
| `tarea_crear` | saca la tarea de su lista | la tarea ya no es igual a `despues` (se tildó, se editó o se movió) — si ya no existe: «Deshecho» sin tocar nada |
| `tarea_editar` | vuelve **solo los campos que cambió** a `antes`; si la movió, la vuelve a su lista (destino primero) | alguno de esos campos ya no es igual a `despues`, o la tarea ya no está |
| `tarea_tildar` | `hecha` y `hechaEn` a `antes` | `hecha` ya no es igual a `despues` |
| C3 `habito_marcar` | `registro[dia]` a `antes` | `registro[dia]` ya no es igual a `despues`, o ya no es el mismo día |

- Deshacer **no manda mensaje** a la mascota (D aprobada). La próxima vez que el usuario escriba, la línea de stdin suma, antes del texto, una línea `<avis-deshecho>Deshecho: {verbo} «{título}».</avis-deshecho>` por cada cambio deshecho desde el último turno, así el modelo no cree que la tarea sigue ahí.
- Sacar una tarea creada por la charla **es** borrarla, pero lo pide un clic del usuario en «Deshacer» de un cambio que hizo la charla: no es un borrado por charla (S2).
- **Sin «Rehacer»** (aprobado).
- Anda después de reabrir Avis: el cambio está guardado con su `antes` y `despues` (11.8). La regla de «Cambió después» protege lo que se tocó mientras tanto.
- «Deshacer los {n}»: de la última a la primera, un `chat_deshacer` por vez.

### 11.8 Historial (`historial.rs`, formato v1 de la charla)

El mensaje de la mascota suma **`cambios`** (opcional; hasta 20):

```json
{
  "id": "c-7k2m9q",
  "herramienta": "tarea_crear",
  "estado": "hecho",
  "lista": "l-k3f9a2",
  "tarea": "t-9x2b7q",
  "titulo": "Comprar pan",
  "antes": null,
  "despues": { "titulo": "Comprar pan", "fecha": "2026-11-26", "hecha": false, "importante": false, "lista": "l-k3f9a2" },
  "motivo": null,
  "reintentable": false,
  "args": null
}
```

- `estado` ∈ `hecho | deshecho | cambio-despues | error | lectura | mostrar`. `antes`/`despues`: solo los campos que toca la herramienta (más `lista`). `args`: lo que pidió el modelo, solo con `error` (para «Reintentar»). Lectura y mostrar guardan su resumen (`filas`, hasta 6) en lugar de `antes`/`despues`.
- `historial::normalizar` **descarta hoy lo que no conoce**: hay que sumar `cambios` con su validación (ids con su prefijo, `estado` de la lista, textos con tope). Uno inválido se descarta sin rechazar la charla.
- La ventana guarda el estado nuevo al deshacer (`guardadosPendientes` de siempre).
- La copia de Engram (`engram.rs`) lleva el texto de la charla como hoy; los cambios no van (no son conversación).

### 11.9 Reintentar

`chat_reintentar(conversacion, cambio)`: solo con `estado: "error"` y `reintentable: true`. Rust repite **esa** operación con `args` (sin el modelo, sin turno en curso: es un clic del usuario) y devuelve el cambio nuevo, que reemplaza a la fila de error en el mismo recibo.

### 11.10 Lógica pura (`widget/src/recibos.js`) y casos de prueba (`widget/test/recibos.test.js`)

1. `encabezadoRecibo(cambios)`: un caso por herramienta de 5.2 (crear, tildar, destildar, mover, editar) y varios → «{n} cambios».
2. `verboCambio(cambio)`: un caso por verbo de 5.2 («nueva fecha», «sin fecha», «movida», «renombrada», «importante», «ya no importante», «notas», «editada»).
3. `metaCambio(cambio, listas, hoy)`: la etiqueta de fecha con `etiquetaFecha`; «hoy → vie 27/11»; «Casa → Compras»; una lista que ya no existe → sin chip.
4. `debeMostrarLectura(turno)`: solo `tareas_ver` hoy → sí; `tareas_ver` y después `tarea_crear` → no; `tareas_ver` con vista `todas` → no.
5. `faltantes(turno)`: 3 `tool_use` de cambio y 2 cambios registrados → 1; los `tareas_ver` no cuentan.
6. `transicionChat` con `tipo: "cambio"`: se suma al mensaje del turno; de otro turno u otra conversación → se descarta; dos con el mismo id → uno.
7. `lineaPuede({ motor, habitos })`: Claude, Local, Claude con C3.
8. `anuncioRecibo(cambios)`: uno, varios, error.
9. `lineasDeshechos(cambios)`: los `<avis-deshecho>` de 11.7, solo los deshechos desde el último turno.
10. `textoHerramientas` sin las `mcp__avis__…` (y con las demás como hoy: test de lo de antes).
11. **Rust `mcp_avis_tests.rs`** (con un cliente HTTP de prueba, sin `claude`): token que falta o equivocado → 401; `Host` ajeno → 403; con `Origin` → 403; 65 KB → 413; `tools/list` = exactamente las cinco; `tools/call` de `tarea_borrar` → error de método; sin turno en curso → error; 21 cambios → el 21 da error; `tarea_crear` sin lista → la primera por `orden`; con una lista que no existe → error y nada escrito; lista rota → error y mismo hash; un campo desconocido de la lista sobrevive; `tarea_editar` con `lista` deja una sola copia; fechas «mañana» a las 23:30 de Argentina → el día siguiente de Argentina.
12. **Rust deshacer:** crear → deshacer la saca; crear, tildar en la ventana, deshacer → `cambio-despues` y nada tocado; editar fecha y título, cambiar el título a mano, deshacer → `cambio-despues`; mover y deshacer → vuelve a su lista, una sola copia; deshacer dos veces → la segunda es «Deshecho» sin tocar nada.
13. **Rust `tareas_guardar` con `huella`:** igual → guarda; distinta → `cambio` y el archivo igual; sin `huella` → como hoy (test de lo de antes).
14. **Rust `chat_tests.rs`:** `argumentos_chat` con la lista nueva exacta (11.2); motor local sin `--mcp-config` ni herramientas; `INSTRUCCION_CHAT` en una línea (sin `\n`).
15. **Rust `historial_tests.rs`:** `cambios` válidos sobreviven a `normalizar`; uno con `estado` desconocido se descarta; una charla vieja sin `cambios` se lee igual.

### 11.11 Archivos (sugeridos)

| Archivo | Qué |
|---|---|
| `widget/src-tauri/src/mcp_avis.rs` + `mcp_avis_tests.rs` (nuevos) | 11.1, 11.4, 11.7, 11.9 |
| `widget/src-tauri/src/tareas.rs` | `modificar`, `huella` (11.4, 11.5) |
| `widget/src-tauri/src/chat.rs`, `chat_local.rs` | 11.2, 11.3, el token por lanzamiento, los `<avis-deshecho>`, todos los `tool_use` de un mensaje (16) |
| `widget/src-tauri/src/historial.rs`, `lib.rs` | 11.8; `chat_deshacer`, `chat_reintentar` |
| `widget/src/recibos.js` (nuevo, puro), `recibosVista.js` (nuevo), `recibosMotion.js` (nuevo) | 4, 5, 10, 11.10 |
| `widget/src/chat.js`, `chatVista.js`, `main.js` (`pintarHilo`), `tareas.js`/`main.js` de Tareas, `estilos.css` | 3, 8, 11.5, 11.6 |
| `widget/dev/vista.html` | `?chat=recibo\|recibos\|deshecho\|despues\|lectura\|borrar\|error\|nollego\|local-herr` |

**`pintarHilo` nunca reescribe lo puesto:** con un cambio nuevo en el mensaje en curso, la firma sin texto cambia; en lugar de rehacer el hilo, se agrega: si el mensaje no tiene `.recibos`, se inserta después de `.m-m`; si ya tiene el recibo, se agrega la fila `.rf` con `insertAdjacentHTML('beforeend')` y se cambian solo el texto del encabezado y el pie. Una función pura `diferenciaRecibos(antes, ahora)` dice si lo único nuevo son cambios (test).

### 11.12 Medir antes de construir (E0 de C1, con el `claude` real; guardar las líneas reales en `widget/src-tauri/src/fixtures/chat/`)

- **M-H1:** `--mcp-config` con el JSON como texto de un argumento en Windows (comillas): ¿lo lee? Si no, el archivo de 11.2.
- **M-H2:** `--safe-mode` y `--strict-mcp-config` con `--mcp-config`: que se conecte **solo** `avis` (el `init` trae `mcp_servers` con su estado) y que los MCP del usuario sigan afuera.
- **M-H3:** `--tools Read,Glob,Grep`: ¿esconde las herramientas MCP? Define 11.2.
- **M-H4:** `--allowedTools` con los nombres exactos y `--permission-mode manual --permission-prompts none`: corren sin preguntar; una herramienta MCP que no está en la lista se niega.
- **M-H5:** qué pide el cliente HTTP de MCP de Claude Code (versión de protocolo, SSE, `Mcp-Session-Id`, `GET`), con un servidor de prueba que anota cada pedido.
- **M-H6:** cuánto suma la conexión al precalentado (`chat_abrir`) y que lanzar sin escribir siga sin gastar.
- **M-H7:** `--resume` con un token y un puerto nuevos (otra ejecución de Avis) sigue la sesión.
- **M-H8:** cómo nombra `stream-json` las llamadas (`mcp__avis__tarea_crear`) y si un mensaje trae varios `tool_use` (16).
- **M-H9:** con 20 pedidos de prueba («anotame…», «pasá lo del contador al viernes», «tildá…», «borrá…», «¿qué tengo hoy?»): cuántas veces lee antes de escribir, si acierta la fecha, si nunca intenta borrar y si confirma corto. Es también la medición de S5 para el modelo local, cuando se haga.
- **M-H10:** el costo en tokens de las cinco definiciones (contexto de hoy, ~6 500).

## 12. Accesibilidad

- El recibo es una `section` con `aria-label` igual a su encabezado; cada fila, `role="group"` con «{verbo}: {título}»; el tilde del recibo es decorativo (`aria-hidden`): el verbo lo dice.
- «Deshacer» siempre con `aria-label` que nombra lo que deshace; el ícono solo nunca va sin ese nombre.
- `div.recibos` con `aria-live="polite"` solo mientras corre el turno; el anuncio es uno por recibo, al terminar (5.3), para no hablar por encima del texto.
- Áreas de clic: 32 de alto (convención del widget, aprobada).
- Foco visible: 2 px `--ambar` desplazado 2.
- Color nunca solo: fecha vencida con su texto, error con su encabezado, deshecho con «Deshecho».
- Movimiento reducido y pausa: 10.

## 13. Responsive y zoom

La hoja tiene su tamaño de siempre (420 × 640, y la forma `.baja`). El recibo ocupa el ancho del hilo; la fila corta el título con «…» y las etiquetas bajan de línea si no entran. Revisar al 100, 150 y 200 %, y con `#hoja.baja`. El boceto se revisó a 375, 768 y 1440.

## 14. Entregas

| Entrega | Qué | Riesgo | Acepta |
|---|---|---|---|
| **C1 · Servidor y herramientas de tareas** | E0 (11.12), `mcp_avis.rs`, `argumentos_chat`, `INSTRUCCION_CHAT` y la local, `tareas::modificar`, la `huella` de `tareas_guardar` y su uso en la ventana, los eventos de 11.6, `chat_deshacer`, `chat_reintentar`, `cambios` en el historial, todos los `tool_use` | Risk: item 2 (abre herramientas que escriben y un servidor local con token: **revisión de seguridad propia** y verificador independiente), item 3 (`argumentos_chat`, `INSTRUCCION_CHAT`, `tareas_guardar` y el historial son contratos fijados por tests), item 4 (dos escritores sobre las listas) | tests 11–15; diferencial contra `main`: una charla sin pedidos de tareas responde igual y `tareas_guardar` sin cambios ajenos guarda igual; con el `claude` real, los 20 pedidos de M-H9 sin un solo borrado y sin cambios fuera de un turno; ningún MCP del usuario aparece en el `init` |
| **C2 · Recibos** | la línea «Puede tocar» y su globo, los recibos de 4.2 a 4.8, Deshacer y sus estados, la hoja de Tareas que se pone al día (8), `pintarHilo` sin reescribir, el movimiento de 10 | Risk: item 6 (lo visual del hilo no lo cubre un test de Rust) | tests 1–10; Playwright con `dev/vista.html?chat=…` al 100 y 200 % contra esta dirección; con Tareas abierta, «anotame…» hace entrar la fila con su destello sin perder lo que se escribe en otro campo |
| **C3 · Hábitos** (después de H1 de #41) | `habitos_ver`, `habito_marcar`, su fila con anillo, su deshacer, las líneas de C3 | Risk: item 2 e item 3 (suma herramientas a la lista fija) | los casos de hábitos de 11.10 (sumar, valor, desmarcar, otro día → error, deshacer, cambió después); M-H9 con pedidos de hábitos |

**Modelo local con herramientas (S5):** fuera de estas entregas; se mide con M-H9 sobre `llama-server` y vuelve a diseño con el resultado.

**No improvisar:** la lista exacta de herramientas y la de `--allowedTools`; que no haya borrar; el token por lanzamiento, `127.0.0.1` y los rechazos de 11.1; que solo se cambie durante un turno; que el recibo salga de lo que escribió Rust; las reglas de Deshacer; los textos de 5. Cualquier otra herramienta (listas, subtareas, recordatorios, borrar) vuelve a diseño y a la revisión de seguridad.

## 15. Decisiones

| Id | Decisión | Descartada | Quién |
|---|---|---|---|
| D-c1 | Opción A · Recibo | B · Ficha viva, C · Sello | Quintana, 25/11 |
| D-c2 | Deshacer sin mandar mensaje; si la tarea cambió después, «Cambió después» y el botón se apaga | deshacer siempre, o deshacer por mensaje | Quintana, 25/11 |
| D-c3 | Sin «Rehacer» | un botón Rehacer | Quintana, 25/11 |
| D-c4 | Áreas de clic de 32 | 44 en estos controles | Quintana, 25/11 |
| D-c5 | `--allowedTools` con los nombres exactos, sin comodín | `mcp__avis__*` (lo sugería el brief) | Delfina (cada herramienta nueva pasa por un test y una revisión) |
| D-c6 | Servidor HTTP dentro de Avis, en `127.0.0.1` | un servidor por stdio (sería otro proceso de Avis, choca con la instancia única) | Delfina |
| D-c7 | Token por lanzamiento del proceso, atado a la conversación, y cambios solo durante un turno | un token por ejecución de Avis | Delfina (un proceso viejo o frenado no puede cambiar nada) |
| D-c8 | El recibo lo arma Rust con lo que escribió, por evento | leer los `tool_result` del `stream-json` | Delfina (fuente única; el texto del modelo no es la verdad) |
| D-c9 | `tarea_mostrar` para «borrar»: una herramienta que no cambia nada y deja el botón | que el modelo escriba el id en el texto | Delfina |
| D-c10 | El recibo de lectura sale solo si el turno no cambió nada y la última lectura fue de hoy, vencidas o una lista | un recibo por cada `tareas_ver` | Delfina (el modelo lee antes de escribir) |
| D-c11 | `huella` en `tareas_guardar` para dos escritores | que la ventana nunca guarde mientras la charla escribe | Delfina |
| D-c12 | Los cambios (con `antes`/`despues`) se guardan en el historial: Deshacer anda después de reabrir Avis | deshacer solo en esta ejecución | Delfina |
| D-c13 | Al deshacer, el próximo mensaje lleva `<avis-deshecho>` | no avisarle al modelo | Delfina (si no, la mascota cree que la tarea sigue) |
| D-c14 | Sin herramientas de listas ni subtareas | sumarlas | Delfina (no las pide S1) |
| D-c15 | Fechas relativas («hoy», «mañana», «pasado mañana») las resuelve Rust en hora de Argentina | que el modelo calcule siempre la fecha | Delfina (M-H9 lo confirma) |
| D-c16 | Topes: 20 cambios por turno, 100 tareas por lectura, 64 KB por pedido | sin topes | Delfina |
| D-c17 | Con Local, «Charla nueva con Claude Code» en el globo (el motor de una charla con mensajes no cambia) | «Cambiar a Claude Code» en la misma charla, como el boceto | Delfina (D8 de la charla) |

## 16. Correcciones y contradicciones con el código

- **El encabezado de `chat.rs` dice «Cualquier herramienta nueva vuelve a diseño»** y `INSTRUCCION_CHAT` dice «no tenés esas herramientas»: esta dirección es esa vuelta a diseño; los dos textos cambian (11.3) y el comentario debe nombrar a #43 y a esta dirección.
- **`evento_de_linea` toma solo el primer `tool_use` de cada mensaje** (`chat.rs:229`, `.find(…)`): con varias herramientas en un mensaje, la línea `.herr` y el conteo de 4.8 perderían las demás. Hay que recorrerlas todas (y M-H8 confirma la forma).
- **`historial::normalizar` descarta lo que no conoce** (`historial.rs:113`): `cambios` hay que sumarlo explícitamente (11.8).
- **`tareas_guardar` recibe la lista entera de la ventana** (`tareas.rs:209`): con un segundo escritor hace falta la `huella` (11.5). Es un cambio en un contrato que usa toda la hoja de Tareas.
- **`semilla()` de chat.rs no es criptográfico** (sirve para ids, no para el token): el token usa el generador del sistema (`windows-sys` ya está en 0.61; o `getrandom`, que ya está en `Cargo.lock`).
- **El boceto ofrece «Cambiar a Claude Code» dentro de una charla con mensajes**; la charla no deja cambiar el motor con mensajes (`chat.rs:741`, D8): el botón crea una charla nueva (D-c17).
- **El boceto muestra el escenario de 72 px**; el real es de 96 (`aviEscena`). La línea «Puede tocar» resta 36 de alto al hilo; revisar con `#hoja.baja`.
- **El boceto ilustra hábitos** en «Varios cambios» y en la lectura: van recién en C3.
- `tareas-ux.md` 11.7 preveía `oficina://tareas` con `{ lista }`; se suma `tarea` y `origen` (compatible).
