# Avis · Configuración dentro del panel — dirección

> Issue #23. Boceto: `docs/diseno/bocetos/configuracion.html` (servirlo con http desde la raíz del repo: importa `avis.js`, `especies.js`, `evolucionMotion.js` y anime.js reales). Dos opciones: **A · Ficha** y **B · Taller**. **Recomendada y dirigida acá: B · Taller.** La eligió Delfina sin el usuario, por su pedido del 23/11 («no me preguntes, no interrumpas, avanza»): cada decisión que no viene del brief está en la sección 15 para que la revise.
> Evoluciona `estilo-avis-ux.md` (tokens, barra lateral, columna principal), `bienvenida-ux.md` (la hoja en la columna principal y su Esc), `mascotas-avi-ux.md` 9.1 (`mascota` y `oficina://mascota`), `resumen-ia-ux.md` (modelo local y su borrado) y `control-sesion-ux.md` (confirmar en el mismo botón). Del chat (`C:/tmp/oficina-22/docs/diseno/chat-avis-ux.md`, otra rama) toma el historial (9.1 y 9.2) y el motor de la charla (3.4). Lo que no se nombra acá sigue como está allí.

---

## 1. Brief

- **Pedido (23/11):** «quiero un modulo de configuracion, donde pueda, entre otas cosas, tener las opciones disponibles de configuracion como tiene troko.»
- **Decidido con el usuario (#23):** pantalla dentro del panel, con un engranaje en la barra lateral, en la columna principal como Primeros pasos; Esc vuelve al tablero. Mueve ahí lo que hoy está en la bandeja (tamaño, arrancar con Windows, borrar la IA local, primeros pasos) y suma mascota, modelos y claves de API (al Administrador de credenciales de Windows, nunca a un archivo ni a git; nunca se muestra la clave entera después de guardarla), modelo local e historial del chat, y el estado y la versión del mod automático (#17).
- **Para quién:** quien usa Avis en su PC (Quintana, Campos). Se entra pocas veces; tiene que encontrarse todo sin pensar y no romper nada por un clic de más.
- **Acción principal por pantalla:** elegir la mascota (pestaña Mascota). En las demás no hay una acción principal: cada control se aplica en el clic.
- **Hecho cuando (#23):** cada opción cambia en el clic y persiste en `preferencias.json` (las claves, en Credenciales de Windows); tests de la lógica pura de cada opción.
- **Vara:** `webs portfolio/brasa-noble`. Movimiento con sentido, accesible, 60 fps en un equipo medio con zoom de 200 %.

## 2. Troko (qué se encontró)

Busqué en la web (Bing, DuckDuckGo, GitHub) "Troko" junto a Claude Code, mascota y muesca: **ninguna fuente fiable**. Bing devolvió páginas ajenas, GitHub cero repositorios, DuckDuckGo pidió un captcha. Las dos capturas del repo (`docs/diseno/referencias/marca-troko.png`, `muesca-troko.png`, en la copia principal) muestran solo la marca ("Troko · Listo" y un menú "Inicio") y la muesca: **nada de su configuración**. Por eso la lista de opciones sale de lo que Avis ya tiene (bandeja, `preferencias.rs`) y de lo pedido en #23. Cuando el usuario pase capturas de la configuración de Troko, se comparan contra 4.4 y lo que falte vuelve a diseño.

## 3. Concepto

**El taller de tu mascota.** La configuración no es una planilla: es el lugar donde vive la mascota cuando no trabaja. Tres palabras: **directa, a la vista, reversible**. Lo que se recuerda: **elegir una especie y verla evolucionar ahí mismo**, con el acto real, sobre la luz de su color, que tiñe el escenario y la marca de la barra en el mismo instante. En las otras pestañas la mascota baja a un tamaño chico junto al título: te acompaña sin ocupar lugar.

Principios: todo se aplica en el clic (no hay "Guardar" salvo para escribir una clave); lo que borra pide confirmación en el mismo botón; ningún dato sensible vuelve a la pantalla; lo que todavía no existe no se muestra como si existiera (15, D6).

**Por qué B y no A.** A ("Ficha", una hoja con índice fijo) muestra todo bajando, pero a 640 px son unos 2 080 px de contenido (medido en el boceto: cuatro pantallas) y deja las claves y el borrado al lado de lo cotidiano. B entra en una pantalla en cuatro de las cinco pestañas (medido: Mascota, Panel, Datos e Instalación sin scroll al 100 %; Modelos desplaza unos 50 px sin las notas del boceto), separa lo sensible y le da a la mascota el escenario que pide #24.

## 4. Arquitectura

### 4.1 Entrar y salir

| Desde | Cómo | Notas |
|---|---|---|
| Barra lateral | Fila **"Configuración"** al pie, encima de "Equipo" (`.pj.engr`, mismo molde que una fila de proyecto, ícono engranaje de 15 en un cuadro de 22) | Con la configuración abierta: `aria-current="page"`, colores de `.pj.activo` y el engranaje girado 90°. Otro clic con la configuración abierta lleva el foco al `h1`; no la cierra (cerrar es "‹ Tablero" o Esc). |
| Teclado | **Ctrl + ,** con el panel a la vista | `aria-keyshortcuts="Control+Comma"` en la fila; la pista "Ctrl ," a la derecha en `--t-mono-s` `--tenue`. |
| Bandeja | Ítem **"Configuración…"** debajo de "Mostrar Avis" | Muestra el panel (como "Mostrar Avis") y abre la configuración. |
| Cualquier tarjeta "Abrir configuración" futura | `data-accion="cfg" data-tab="<pestaña>"` | Abre en esa pestaña. |

**Salir:** el botón **"‹ Tablero"** (`.volver`, el de la dividida) a la izquierda de los controles de ventana, con `title` "Volver al tablero (Esc)", o **Esc**. Esc, en este orden (una capa por vez): cancela la clave que se está escribiendo (el texto se descarta) → desarma un "¿Borrar? Sí" → cierra la configuración. El foco vuelve a la fila "Configuración". Acoplada, el Esc siguiente pliega el panel (7.2 del estilo). Elegir un proyecto en la barra también cierra la configuración y muestra ese proyecto.

**Acoplada:** mientras el foco está en un campo de clave o hay texto escrito en él, el panel no se pliega al salir el mouse (mismo mecanismo que `st.pp.retuvo` de bienvenida-ux.md 5.2). Al guardar o cancelar vuelve a la marca que tenía.

**Una pregunta pendiente no se esconde:** con la configuración abierta, si llega una pregunta, arriba de las pestañas aparece la línea del aviso de otro proyecto (`avisoOtroProyecto`, ámbar) "Claude te hace una pregunta · Ver →", que cierra la configuración y muestra la pregunta. La muesca y el chip de la barra siguen como siempre.

### 4.2 Dónde se dibuja

Es una **hoja de la columna principal**, como la de Primeros pasos (bienvenida-ux.md 4.1): el encabezado de la columna queda arriba con `h1` "Configuración" y la bajada "Se guarda al instante"; la hoja reemplaza lo de abajo (avisos, pregunta, chips, sesiones) hasta que se cierra. La barra lateral no cambia salvo la fila "Configuración". En la pantalla dividida, abrir la configuración sale de la dividida (vuelve a la vista anterior) y abre la hoja. Sin sesiones (escenario de primeros pasos o vacío), la configuración igual se abre en la columna.

### 4.3 Árbol del DOM

```
main.principal
├── header.cab
│   ├── .cab-t > [span.mini (Avi de 40, solo fuera de Mascota)] h1#cfg-h1[tabindex=-1] "Configuración" · p "Se guarda al instante"
│   └── .controles > button.volver "‹ Tablero" · pin · mini · cerrar
├── #cfg-aviso (la línea de pregunta pendiente, 4.1; vacío casi siempre)
├── div.pestanas[role=tablist aria-label="Configuración"]
│   ├── button.pes[role=tab aria-selected aria-controls=cfg-p] × 5 (+ i.pt y span.oculto con el estado, 6.3)
│   └── span.ind (indicador, aria-hidden)
├── div.cfg-cuerpo#cfg-p[role=tabpanel aria-labelledby tabindex=0]   (desplaza solo si no entra)
│   └── div[data-cont=<pestaña>] … la sección
└── p.oculto[role=status]   (anuncios: "Clave guardada…", "Tu mascota ahora es Ascua")
```

### 4.4 Pestañas y contenido

Orden fijo: **Mascota · Panel · Modelos · Datos · Instalación.** Abre siempre en la última pestaña usada en esta ejecución (no se guarda); la primera vez, Mascota.

| Pestaña | Ítem | Control | Fuente de verdad | Se guarda en | Hoy |
|---|---|---|---|---|---|
| Mascota | Especie | 7 fichas, `radiogroup` | `preferencias.json` | `mascota` | existe la clave (mascotas 9.1); falta escribirla |
| Mascota | Vista previa "Base · <evo>" | `radiogroup` de 2 | estado de la pantalla | nada | — |
| Panel | Tamaño | paso − / % / + | `preferencias.json` | `tamano` | existe (`cambiar_tamano`) |
| Panel | Dónde vive | 5 segmentos: Flota, Arriba, Derecha, Abajo, Izquierda | `preferencias.json` | `acople` | existe (submenú de la bandeja, `guardar_acople`) |
| Panel | Siempre arriba | interruptor | `preferencias.json` | **`arriba`** (nueva) | existe sin guardarse (bandeja y pin del encabezado) |
| Panel | Avisarme con cada pregunta | interruptor | `preferencias.json` | **`avisar`** (nueva) | existe sin guardarse (bandeja) |
| Panel | Pausar animaciones | interruptor | `preferencias.json` | **`pausa`** (nueva) | existe sin guardarse (bandeja, `oficina://pausa`) |
| Panel | Arrancar con Windows | interruptor | **el sistema** (`arranque.rs`, `marca_real`) | nada | existe |
| Modelos | Quién responde (charlas nuevas) | 2 segmentos: Claude Code, Local | `preferencias.json` | **`motor`** (nueva) | **se conecta cuando llegue el chat** |
| Modelos | Claves de API: Claude (Anthropic), OpenAI, Gemini (Google) | fila de clave (6.6) | Credenciales de Windows | nada en el archivo | nuevo |
| Modelos | Modelo local (Qwen3-4B) | tarjeta: estado, Descargar, Borrar | `modelo.rs` (`estado_resumen` → `estado_modelo` con el chat) | nada | existe (bandeja y globo del resumen) |
| Datos | Historial del chat | "N charlas · X MB", Borrar todo | carpeta `chat/` de Avis + Engram | nada | **se conecta cuando llegue el chat** |
| Datos | Dónde queda cada cosa | lista de solo lectura | — | — | nuevo |
| Instalación | Mod de Claude Code | tarjeta: estado, versión, última revisión | `mod_auto.rs` + `revisar_claude` | `mod` (ya existe) | existe |
| Instalación | Claude Code, GitHub | filas de solo lectura | `revisar_primeros_pasos` | — | existe |
| Instalación | Primeros pasos | botón "Abrir →" | — | — | existe (bandeja, aviso) |
| Instalación | Versión de Avis | línea mono | `app.package_info().version` | — | nuevo |

**Lo que todavía no existe no se muestra (D6):** "Quién responde" y el bloque del historial aparecen cuando el chat esté en `main`. Las claves sí se muestran desde la entrega 4, con la línea "Las usa la charla por API cuando llegue" (se pueden guardar y probar antes). En el boceto esas piezas llevan la nota violeta "se conecta cuando llegue…".

### 4.5 La bandeja después

`ORDEN_BANDEJA` pasa a: **Mostrar Avis · Configuración… · Pausar animaciones · separador · Salir.** Salen "Primeros pasos", "Siempre arriba", "Avisarme con cada pregunta", "Acoplar", "Tamaño", "Arrancar con Windows" y "Borrar el modelo de IA" (D4). Pausar se queda porque se necesita rápido y sin abrir el panel. Ctrl +/−/0 siguen andando con la ventana enfocada.

### 4.6 Estado en la ventana

`st.config = { abierta: false, tab: 'mascota', editando: null, ver: false, error: null, aviso: null, armado: null, forma: 'base', claves: { anthropic, openai, gemini }, local, historial, mod }`. El borrador de una clave **no** vive en `st`: vive solo en el `<input>` y se lee al guardar (6.6). Como el borrador de `control.js`, la hoja sobrevive al redibujo de 1,5 s: `pintarConfiguracion` redibuja solo la sección que cambió y devuelve el foco a la misma pieza (`data-k`), nunca toca el campo de la clave mientras se escribe.

## 5. Contenido (textos exactos)

| Lugar | Texto |
|---|---|
| Fila de la barra | "Configuración" · pista "Ctrl ," |
| Encabezado | `h1` "Configuración" · bajada "Se guarda al instante" · botón "‹ Tablero" (title "Volver al tablero (Esc)") |
| Mascota · escenario | rótulo "Especie {n} de 7 · {tipo}"; nombre; concepto; segmentos "Base" y "{evoNombre} ✦"; nota "Evoluciona sola mientras Claude coordina un equipo" |
| Mascota · ficha | "{nombre}" y "› {evoNombre}"; nombre accesible "{nombre}, evoluciona a {evoNombre}" |
| Mascota · celda 8 | "Se ve en la marca, la muesca y cada sesión. Sus subagentes son de su especie." |
| Panel | "Tamaño" — "De 100 a 200 %, de a 25. También con Ctrl + y Ctrl −." · "Dónde vive" — "Flotando, o acoplada a un borde de la pantalla." · "Siempre arriba" — "Queda encima de las otras ventanas." · "Avisarme con cada pregunta" — "Una notificación de Windows cuando Claude te pregunta algo." · "Pausar animaciones" — "Las mascotas quedan quietas en su pose." · "Arrancar con Windows" — "Apagado de fábrica: solo lo cambia tu clic." |
| Interruptor | "Sí" / "No" a la izquierda (`aria-hidden`; el estado lo da `aria-checked`) |
| Modelos · charla | rótulo "Charla"; "Quién responde" — "En las charlas nuevas. Cada una puede cambiarlo."; segmentos "Claude Code" y "Local" |
| Modelos · claves | rótulo "Claves de API"; candado + "Se guardan en el Administrador de credenciales de Windows, nunca en un archivo. Avis solo vuelve a mostrar los últimos 4 caracteres." |
| Fila de clave | ver 6.6 |
| Modelo local | "Qwen3-4B" · "en esta PC, sin internet"; estados en 7.2 |
| Datos | rótulos "Historial del chat" y "Dónde queda cada cosa"; "{n} charlas · {mb} MB" — "En esta PC y, si Engram está prendido, una copia buscable en el proyecto avis. Se borran las dos."; vacío "No hay charlas guardadas."; lista: Preferencias → "preferencias.json, en la carpeta de Avis" · Claves → "Administrador de credenciales de Windows · Avis/api/…" · Modelo local → "%LOCALAPPDATA%\avis-ia" · Charlas → "carpeta de Avis\chat" |
| Instalación | rótulos "Mod" y "En esta PC"; "Mod de Claude Code" (7.3); "Claude Code" — "Versión {v}"; "GitHub" — "Para ver al equipo."; "Primeros pasos" — "Revisa y arregla la instalación, paso por paso." · "Abrir →"; pie "Avis {versión} · widget" |
| Anuncios (`role=status`) | "Tu mascota ahora es {nombre}" · "{nombre} evoluciona a {evo}" · "Clave de {proveedor} guardada en Credenciales de Windows" · "La clave es válida" · "{proveedor} rechazó la clave" · "Clave borrada de Credenciales de Windows" · "Modelo local borrado" · "Historial borrado" |

Los tipos y conceptos de especie son los del boceto de mascotas (`M`): especies.js no los trae y los suma (9.4).

## 6. Sistema visual

Sin fuentes ni colores nuevos: Manrope y Martian Mono, tokens de `estilos.css`. Tokens nuevos:

| Token | Valor | Uso |
|---|---|---|
| `--alto-escena-cfg` | 176px | escenario de la mascota |
| `--d-pestana` | 320ms | indicador y cambio de pestaña |
| `--d-confirma` | 3s | ventana del "¿Borrar? Sí" (la de `control.js`) |
| `@property --cc` | `<color>`, inicial `#F2B632` | luz del escenario; se registra para que cambie con transición |

### 6.1 Piezas

| Pieza | Especificación |
|---|---|
| `.pj.engr` | la fila `.pj` de la barra; cuadro `.pj-ic` fondo `--s2`, ícono engranaje 15 (trazo 1,3, `currentColor`); hover: el engranaje gira 45° con `--rebote` .6 s; abierta: `aria-current`, colores de `.pj.activo`, ícono a 90° y cuadro `color-mix(--ambar 18%)` |
| `.pestanas` | fila de 36 de alto, separación 2, filete inferior `--linea`; `.pes` `700 12px/1 var(--f)`, relleno 0/10, `--crema2` (hover `--crema` y fondo `--s1`), elegida `--crema` |
| `.ind` | 2 × (ancho de la pestaña − 16), `--ambar`, radio 2, brillo `0 0 10px rgba(242,182,50,.6)`; se mueve con `translateX` y `width` |
| `.esc-m` (escenario) | alto 176, radio `--r-tarjeta`, borde `--linea`; columnas 150 / 1fr; fondo: `radial-gradient(160px 70px at 80px 140px, color-mix(--cc 30%), transparent 72%)`, `radial-gradient(260px 160px at 80px 120px, color-mix(--cc 10%), transparent 70%)`, `linear-gradient(--s1, --negro)`; piso: línea de 120 × 1 en `top: 142px` con degradé de `--cc` al 70 %; Avi de **120** (forma evolucionable: `claveEvo`); nombre `800 26px/1 var(--f)` −.04em; rótulo `--t-rotulo` mayúsculas; concepto `--t-chico` `--crema2` (34ch); nota `--t-mono-s` 75 % `--tenue`; `transition: --cc .5s ease` |
| `.especies` | grilla de 4, separación 8; `.esp` alto mínimo 96, radio `--r-ficha`, fondo `--s1`, borde `--linea`; Avi de **54** (base, `esperando`); nombre `--t-cuerpo-f`; evo `--t-mono-s` 75 % `--tenue`. Hover: fondo `--s2` y el Avi sube 3 px (`--rebote` .35 s). Elegida: borde y anillo interior de 1 px en `--c` de la especie, fondo `color-mix(--c 9%, --s1)`, insignia ✓ de 18 (fondo `--c`, ✓ `--negro`). Celda 8: borde punteado `--linea-hover`, `--t-chico` `--tenue` |
| `.mini` | Avi de 40 a la izquierda del `h1` (forma chica, 5.5 de mascotas), solo fuera de Mascota |
| `.aj` (fila) | grilla 1fr / auto, separación 4/16, relleno 11/0, filete superior `--linea`; título `--t-cuerpo-f`; descripción `--t-chico` `--tenue`. `.apilada`: el control va abajo a todo el ancho |
| `.sub` (rótulo de grupo) | `--t-rotulo` mayúsculas, .12em, `--tenue`, 16 arriba |
| `.sw` (interruptor, `role=switch`) | 40 × 24, radio píldora; apagado: fondo `--s3`, borde `--linea-hover`, perilla 16 `--tenue`; prendido: fondo y borde `--ambar`, perilla `--negro` a 16 px (`transform .32s --rebote`); área de clic 44 × 44 (`::before` con `inset: -10px -4px`); a la izquierda "Sí"/"No" `--t-mono-s` `--tenue` |
| `.seg` (`radiogroup`) | píldora `--s2` con borde `--linea`, relleno 3; opciones de 30, `700 11.5px/1 var(--f)` `--crema2`; elegida fondo `--crema`, texto `--tinta` (como el motor del chat) |
| `.paso` | botones redondos de 32 `--s3` (hover `#27272C`, presión .92), valor `600 12px/1 var(--m)` cifras tabulares, 58 de ancho; en la punta, `aria-disabled` y opacidad .38 |
| `.btn`, `.btn.sec` | los de `estilos.css` (32 de alto); el primario ámbar con texto `--negro` |
| `.lnk` | texto `700 12px/1 var(--f)` `--crema2`, 32 de alto, subrayado al pasar; `.peligro` en `--rojo` |
| `.armado` (confirmar) | píldora `--rojo` con texto `--negro` `800 12px`; una línea de 2 px `--negro` al 45 % que se vacía en `--d-confirma` (`drena`, eco del `.drena` de la dividida) |
| `.pill` (estado) | píldora `--s2`, `--t-mono-s` `--crema2`, punto de 6 con el color del tono: `t-ok` `--verde`, `t-aviso` `--ambar`, `t-proc` `--celeste` (late 1,2 s), `t-error` `--rojo`, `t-nada` `--tenue`. Siempre con texto |
| `.tarj` (modelo local, mod) | relleno 12/14, radio `--r-cuadro`, fondo `--s1`, borde `--linea`; título `--t-cuerpo-f`, línea `--t-chico` `--crema2`; barra de 6 con degradé `--celeste` → `#B5D3FF` |
| `.cand` | candado de 14 en `--ambar` + `--t-chico` `--crema2` |
| `.datos` | `dl` de dos columnas, `dt` `--tenue`, `dd` `--t-mono-s` `--crema2` |

### 6.2 Contraste (sobre los tokens; mismos pares que chat-avis-ux.md 5.2)

| Par | Relación | Uso |
|---|---|---|
| `--crema` / `--negro` | 17,69:1 | títulos, valores |
| `--crema2` / `--negro` y `--s2` | 10,31 / 9,03:1 | pestañas, descripciones fuertes, píldoras |
| `--tenue` / `--negro`, `--s1`, `--s2` | 5,65 / 5,26 / 4,95:1 | descripciones, rótulos, notas |
| `--tinta` / `--crema` | ≈ 16:1 | segmento elegido |
| `--negro` / `--ambar` | 11,51:1 | botón primario, perilla prendida |
| `--negro` / `--rojo` | ≈ 8,2:1 | "¿Borrar? Sí" |
| `--rojo` / `--negro` | 8,25:1 | Borrar, rechazada |
| `--verde` / `--negro` | ≈ 12:1 | válida |

`--c` de la especie nunca lleva texto: solo luz, borde y la insignia ✓ (que dice lo mismo con forma). El estado de una pestaña (6.3) nunca depende solo del color.

### 6.3 Puntos de estado en las pestañas

Un punto de 6 después del nombre, con su texto en `span.oculto`: **Modelos** — `t-error` ", una clave rechazada" o `t-proc` ", bajando el modelo"; **Instalación** — `t-aviso` ", el mod necesita atención" (mod apagado o sin Claude Code). Sin estado, sin punto.

## 7. Componentes y estados

Todos los controles: hover (fondo un escalón más claro o texto `--crema`), foco visible (`2px --ambar`, desplazado 2; sobre ámbar, `--crema`), presión (escala .97, .92 los redondos), deshabilitado con `aria-disabled` (opacidad .38, sin presión; sigue enfocable y tiene `title` con el motivo).

### 7.1 Fila de clave (`filaClave`, 6.6 del boceto)

Cuadro de 30 con la inicial del proveedor (`A`, `O`, `G`, `600 12px var(--m)`; **sin logos**), nombre `--t-cuerpo-f` y empresa `--t-chico` `--tenue` a la derecha. Debajo, el estado; debajo, las acciones como `.lnk`.

| Estado | Línea | Acciones |
|---|---|---|
| `sin` | "Sin clave" | "+ Agregar clave" |
| `editando` | campo (abajo) | Guardar (primario) · Cancelar (secundario) |
| `guardada` | "Guardada" + `••••a1B2` (`--t-mono` en píldora `--s2`, `aria-label` "termina en a1B2") | Probar · Reemplazar · Borrar |
| `probando` | píldora `t-proc` "Probando con {empresa}…" + máscara | Probar deshabilitado · Reemplazar · Borrar |
| `valida` | `--verde` "✓ Válida · probada recién" + máscara | Reemplazar · Borrar |
| `rechazada` | `--rojo` "× {empresa} la rechazó" + máscara | Reemplazar · Borrar |
| `sin-red` | `--ambar` "No se pudo probar: sin conexión" + máscara | Probar · Reemplazar · Borrar |
| armado | — | "¿Borrar la clave? Sí" (3 s) en lugar de Borrar |

**Campo:** `label` oculto "Clave de API de {nombre}"; `input type=password`, `autocomplete=off`, `spellcheck=false`, `placeholder` "{prefijo}…", `--t-mono`; borde `--linea`, foco `--ambar` con anillo `0 0 0 3px rgba(242,182,50,.14)`; botón "Mostrar"/"Ocultar" (`aria-pressed`) solo mientras se escribe. Ayuda debajo (`aria-describedby`): por defecto "Va al Administrador de credenciales de Windows. Después solo vas a ver el final."; con error, en `--rojo` y `aria-invalid=true`: vacía "Pegá la clave para guardarla.", con espacios "Tiene espacios en el medio: revisá que esté entera.", corta "Es muy corta para ser una clave."; con prefijo raro, en `--ambar`, "No parece una clave de {empresa} (suelen empezar con {prefijo}). Guardala igual si estás seguro." y el botón pasa a "Guardar igual". **Un error nunca borra lo escrito.** Enter guarda; Esc cancela.

Al guardar: el campo se vacía y desaparece, la fila parpadea en verde (1,2 s), el foco va a "Probar" y se anuncia. Reemplazar abre el campo vacío (nunca precargado).

### 7.2 Modelo local

| Estado (`estado_modelo`) | Píldora | Línea | Acciones |
|---|---|---|---|
| `listo` | `t-ok` "Listo" | "Se apaga solo a los 10 min sin uso." | "Borrar 2,6 GB" → "¿Borrar 2,6 GB? Sí" |
| `falta` | `t-nada` "Sin instalar" | "Hace falta para charlar sin internet. Se baja una sola vez." | "Descargar 2,6 GB" (primario) |
| `bajando` | `t-proc` "Bajando {n} %" | barra (`role=progressbar`, `aria-valuenow`) y "{x} de 2,6 GB · si se corta, sigue donde quedó" | — |
| `roto` | `t-error` "Roto" | "Faltan piezas o no coinciden. Bajalo de nuevo." | "Bajar de nuevo" · Borrar |

La cifra (2,6 GB) la da el backend (`cifrasDescarga`), nunca fija en el código. El borrado ya no usa el diálogo nativo con "No" por defecto: la confirmación es la del botón (D5).

### 7.3 Mod de Claude Code

| Estado | Píldora | Línea | Acción |
|---|---|---|---|
| al día | `t-ok` "Prendido · {v}" | "Al día. Se actualiza solo, una vez por día. Revisado hoy {hh:mm}." | — |
| recién actualizado (aviso de `tomar_aviso_mod`) | `t-ok` "Prendido · {v}" | "Se actualizó solo de {desde} a {v} hoy a las {hh:mm}." | — |
| apagado | `t-aviso` "Apagado · {v}" | "Claude Code no lo carga: sin el mod, Avis no ve tus sesiones." | "Prender" (`pp-correr activar`) |
| instalando (`mod-auto` `empieza`) | `t-proc` "Instalando…" | "Faltaba el mod: Avis lo instala solo, no hace falta que hagas nada." | — |
| no pudo revisar (`fallo`) | `t-aviso` "Prendido · {v}" | "Hoy no se pudo revisar si hay versión nueva. Vuelve a probar mañana." | — |
| sin Claude Code | `t-error` "Sin Claude Code" | "Avis no encontró Claude Code en esta PC." | "Abrir primeros pasos" |

**No hay botón "Buscar actualización":** la ventana no puede pedir `Accion::Actualizar` (decisión de #17, `Accion::desde` no la conoce). Las horas, en hora de Argentina.

### 7.4 Historial del chat

Con charlas: "{n} charlas · {mb} MB" y "Borrar todo" → "¿Borrar {n} charlas? Sí". Vacío: "No hay charlas guardadas." con píldora `t-nada` "Vacío". Borrando: píldora `t-proc` "Borrando…". Error: `--rojo` "No se pudieron borrar {k} charlas. Probá de nuevo." con "Reintentar".

### 7.5 Estados de la pantalla

- **Cargando:** la hoja se dibuja con lo que ya está en `st` (mascota, tamaño, interruptores); lo que llega de Rust (claves, modelo, mod, historial) muestra su fila con la píldora `t-nada` "Revisando…" del mismo alto, sin saltos de diseño. Nunca un spinner a pantalla completa.
- **Error al guardar una preferencia:** el control vuelve a su valor anterior y debajo de la fila aparece `--rojo` `--t-chico` "No se pudo guardar. Probá de nuevo." (se va al siguiente cambio). Se anota en `widget.log`.
- **Error de Credenciales de Windows:** en la fila de la clave, `--rojo` "Windows no dejó guardar la clave ({detalle corto})." y el campo sigue abierto con el texto.
- **Vacío:** no aplica (todas las pestañas tienen contenido).

## 8. Movimiento

anime.js v4 (ya instalado, `vendor/animejs`). Módulo **`configuracionMotion.js`**; CSS para hover, interruptores y la luz. Todo dentro de `prefers-reduced-motion: no-preference` y `body:not(.pausa)`.

| Momento | Qué | Tiempo y curva |
|---|---|---|
| Abrir (acto de la pantalla) | encabezado y pestañas suben 8 px y aparecen, escalonados 55 ms; las filas de la pestaña, 10 px, escalonadas 35 ms desde 120; las fichas de especie, `scale(.9 → 1)` escalonadas 30 ms desde 220; el Avi del escenario sube 18 px desde 160 | 420–620 ms, `outQuart`; fichas y Avi `outBack(1.4–1.6)` |
| Cambiar de pestaña | el indicador viaja (`translateX` y `width`); el contenido entra 14 px desde el lado de la pestaña nueva, escalonado 28 ms; al salir de Mascota, el Avi de 40 aparece junto al título (`scale .3 → 1`); al volver, el del escenario sube 16 px | 320 / 260 / 480 ms; `outQuart`, `outBack(1.8)` |
| Elegir especie | la luz del escenario y la de la marca cambian de color (`--cc`, CSS .5 s); el Avi nuevo nace `scale(.55 → 1)` y sube 14 px; los textos entran 10 px escalonados 40 ms; la marca de la barra rebota `scale(.7 → 1)` | 560 / 300 / 520 ms, `outBack(1.7)` |
| Ver la forma evolucionada | **el acto real** (`evolucionar`/`devolver` de `evolucionMotion.js`, mascotas 8.2 y 8.3), con el escenario como contenedor del temblor de Morro | los de cada especie |
| Interruptor | la perilla salta | `.32s --rebote` (CSS) |
| Guardar clave | la fila se baña de verde 12 % y se apaga | 1,2 s `--ease` (CSS) |
| Confirmar | la línea del botón se vacía | 3 s lineal (CSS) |
| Engranaje | gira 45° al pasar y queda a 90° abierta | .6 s `--rebote` (CSS) |

**Reducido o pausa:** sin desplazamientos ni escalas; la hoja y las pestañas cambian con un fundido de opacidad de 150 ms; la forma evolucionada cambia al instante (`formaAlInstante`); la luz cambia sin transición. 60 fps: solo `transform` y `opacity` (el ancho del indicador es la única excepción: un elemento de 2 px).

## 9. Contrato con Rust y `preferencias.json`

### 9.1 `preferencias.json`

Claves nuevas: **`arriba`** (bool, por defecto `true`), **`avisar`** (bool, `true`), **`pausa`** (bool, `false`), **`motor`** (`"claude" | "local"`, `"claude"`; se escribe desde la entrega del chat). Siguen `tamano`, `acople`, `flotante`, `monitor`, `mod`, `mascota`. Nunca claves de API ni nada derivado de ellas.

**La trampa de `escribir`:** `preferencias.rs` reescribe el archivo entero con claves fijas, así que una clave que no está en `struct Preferencias` se borra al guardar el tamaño o el acople. Cada clave nueva va en la struct, en `leer_todo` y en `escribir`, con su test "guardar el tamaño no borra X". **Propuesta (D9):** que `escribir` parta del objeto leído y pise solo sus claves, así una clave que agregue otra entrega (o una versión más nueva de Avis) sobrevive; test "una clave desconocida sobrevive a guardar el tamaño". Lo decide el orquestador.

Lectura: valor ausente, de otro tipo o desconocido → el valor por defecto (como `leer_mascota`). Al arrancar, Rust aplica `arriba` a la ventana, `pausa` al menú y a la ventana (`oficina://pausa`) y `avisar` a su bandera.

### 9.2 Comandos

| Comando | Entrada | Salida | Notas |
|---|---|---|---|
| `leer_configuracion()` | — | `{ mascota, tamano, acople, arriba, avisar, pausa, arranque, motor, version }` | `arranque` sale del sistema (`marca_real`), no del archivo |
| `guardar_ajuste({ clave, valor })` | `clave` ∈ `mascota, arriba, avisar, pausa, motor` | `{ ok, valor }` (el que quedó) | valida con `ajuste_valido` (puro, Rust) además de `validarAjuste` (JS); aplica el efecto (ver 9.3) y sincroniza la marca del menú si queda |
| `cambiar_tamano`, `guardar_acople` | los de hoy | los de hoy | se reusan |
| `poner_arranque(bool)` | — | `bool` real | `arranque::aplicar` |
| `claves_estado()` | — | `[{ proveedor, guardada, final }]` | lee de Credenciales y devuelve **solo los últimos 4**; nunca la clave |
| `guardar_clave({ proveedor, clave })` | la clave, una vez | `{ guardada: true, final }` | `proveedor` ∈ lista fija; vuelve a validar la forma; escribe y suelta la memoria |
| `borrar_clave(proveedor)` | — | `{ guardada: false }` | no falla si no había |
| `probar_clave(proveedor)` | — | `{ resultado: 'valida' \| 'rechazada' \| 'sin-red' \| 'otro', estado? }` | 9.4 |
| `estado_modelo()`, `descargar_modelo()`, `borrar_modelo()` | — | los de `modelo.rs` | `borrar_modelo` sin diálogo nativo (la confirmación es de la ventana) |
| `estado_mod()` | — | `{ instalado, activo, version, revisado, fallo, aviso? }` | junta `revisar_claude` (sin correr comandos que escriben) y `leer_revision_mod` |
| `historial_estado()`, `borrar_historial()` | — | `{ charlas, bytes }` / `{ borradas, fallidas }` | entrega del chat; Engram con las reglas de chat-avis-ux.md 9.2 (solo `project: "avis"`, `topic_key` con prefijo `avis/`) |

### 9.3 Eventos

- `oficina://mascota` (`{ mascota }`), ya previsto en mascotas 9.1: la ventana redibuja todo con la especie nueva, **sin acto** (salvo la vista previa del escenario).
- `oficina://pausa` (el de hoy), también cuando cambia desde la configuración.
- `oficina://configuracion` (`{ abrir: true, tab? }`): lo emite el ítem de la bandeja y `Ctrl ,` global si se suma.
- `oficina://modelo` y `oficina://mod-auto`: los de hoy, para refrescar sus tarjetas en vivo.

### 9.4 Claves de API en Credenciales de Windows

- **Dónde:** credencial genérica (`CRED_TYPE_GENERIC`), `TargetName` **`Avis/api/<proveedor>`** (`anthropic`, `openai`, `gemini`), `UserName` "avis", el blob en UTF-8, `CRED_PERSIST_LOCAL_MACHINE` (queda en el perfil del usuario de Windows). Tope del blob: 2 560 bytes (`CRED_MAX_CREDENTIAL_BLOB_SIZE`), de sobra.
- **Con qué:** el crate `keyring` (backend nativo de Windows) o `windows-sys` con `Win32_Security_Credentials` (`CredWriteW`, `CredReadW`, `CredDeleteW`). Es una dependencia nueva: la elige y la mide el orquestador en la entrega 4 (versión y features **no verificadas** acá).
- **Reglas que no se negocian:** la clave cruza a Rust una sola vez (al guardar) y **nunca vuelve a la ventana**; ni el archivo de preferencias, ni `widget.log`, ni los errores la contienen (el log dice "claves: guardada anthropic"); la ventana no guarda el borrador en `st`; el campo se vacía al guardar o cancelar; ningún test usa una clave real.
- **Probar (un clic, la única salida a la red de esta pantalla además de la descarga):** pedido de solo lectura que lista modelos.
  - Anthropic: `GET https://api.anthropic.com/v1/models` con `x-api-key` y `anthropic-version` (la Models API existe y sirve para esto).
  - OpenAI: `GET https://api.openai.com/v1/models` con `Authorization: Bearer`.
  - Gemini: `GET https://generativelanguage.googleapis.com/v1beta/models` con `x-goog-api-key`.
  - 200 → `valida`; 401 o 403 → `rechazada`; sin conexión o tiempo (10 s) → `sin-red`; otro → `otro` con el código en `title`. **Medir cada proveedor una vez contra el real antes de escribir su falso** (regla del perfil); los endpoints y encabezados de OpenAI y Gemini son de memoria, no medidos.
- **CLAUDE.md:** la regla "Nunca guardar credenciales" pasa a "Nunca guardar credenciales en texto plano: las claves de API van al Administrador de credenciales de Windows" (decidido en #23).

### 9.5 Archivos (sugeridos, no escritos)

| Archivo | Qué |
|---|---|
| `widget/src/configuracion.js` (nuevo, puro) | `PESTANAS`, `pestanaSiguiente`, `validarAjuste`, `formaClave`, `textoClave`, `puntoPestana`, `textoMod`, `cifrasHistorial`, `ajusteDesdeMenu` |
| `widget/src/configuracionVista.js` (nuevo) | HTML de la hoja y de cada sección (como `primerosPasosVista.js`) |
| `widget/src/configuracionMotion.js` (nuevo) | 8 |
| `widget/src/especies.js` | `tipo` y `concepto` por especie (los de `M` del boceto de mascotas) |
| `widget/src/main.js`, `index.html`, `estilos.css` | fila de la barra, `st.config`, Esc, foco, tokens y piezas de 6 |
| `widget/src-tauri/src/preferencias.rs` | 9.1 |
| `widget/src-tauri/src/claves.rs` (nuevo) | 9.4, con la parte pura (`proveedor_valido`, `final_de`, `resultado_de_estado`) testeada sin tocar Windows |
| `widget/src-tauri/src/lib.rs` | comandos, eventos y la bandeja de 4.5 |
| `widget/dev/vista.html` | `?cfg=<pestaña>`, `?clave=<estado>`, `?modelo=<estado>`, `?mod=<estado>` |

## 10. Lógica pura y casos de prueba

`widget/test/configuracion.test.js`:

1. `pestanaSiguiente(actual, tecla, lista)`: → la siguiente y da la vuelta de la última a la primera; ← al revés; Inicio la primera; Fin la última; otra tecla, la misma.
2. `validarAjuste(clave, valor)`: `mascota` acepta las 7 de `NOMBRES_ESPECIES` y rechaza `"Ascua"`, `""` y `null`; `arriba`/`avisar`/`pausa` solo booleanos; `motor` solo `"claude"`/`"local"`; una clave desconocida, rechazada.
3. `formaClave(proveedor, texto)`: vacía o solo espacios → `vacia`; con un espacio adentro → `espacios`; menos de 20 caracteres → `corta`; recorta los espacios de las puntas; `final` son los últimos 4; prefijo distinto del típico → `ok` con `aviso: 'prefijo'` (no bloquea); proveedor desconocido → sin aviso.
4. `textoClave(estado)`: un caso por fila de 7.1; **nunca** incluye más que `final` (test: con una clave de 40 caracteres en la entrada, el texto no contiene los primeros 36).
5. `puntoPestana(datos, pestana)`: las tres reglas de 6.3 y `null` en el resto.
6. `textoMod(lectura, revision, aviso, ahora)`: un caso por fila de 7.3, con la hora en Argentina.
7. `cifrasHistorial(charlas, bytes)`: "1 charla", "24 charlas", "1,2 MB" con coma decimal.
8. Confirmar: armar, a los 3 s se desarma solo; un segundo clic antes ejecuta una vez; Esc desarma (con temporizador falso, en `control.test.js` o un test propio si la lógica se comparte).
9. Rust `preferencias.rs`: guardar el tamaño, el acople o la revisión del mod no borra `mascota`, `arriba`, `avisar`, `pausa` ni `motor`; valores basura → los por defecto; (si se acepta D9) una clave desconocida sobrevive.
10. Rust `claves.rs`: `proveedor_valido` solo los tres; `final_de` da los últimos 4 por caracteres, no por bytes; `resultado_de_estado` 200/401/403/500/red.

## 11. Accesibilidad

- Un solo `h1` ("Configuración"); los rótulos de grupo son `h3` dentro del panel de pestaña (el `h2` es la pestaña, por `aria-labelledby`). Sin saltos.
- Pestañas: `tablist`/`tab`/`tabpanel`, activación automática, ← → Inicio Fin; una sola pestaña en el orden de tabulación. El panel tiene `tabindex=0` para leer con el teclado cuando desplaza.
- Especies y segmentos: `radiogroup` con foco itinerante y flechas (←↑ anterior, →↓ siguiente). La especie se elige al moverse (como un radio nativo).
- Interruptores: `role=switch` con `aria-checked` y nombre; área de 44 × 44.
- Todos los controles miden al menos 32 de alto (la convención del widget, de puntero); interruptores y fichas, 44 o más.
- Foco: al abrir va al `h1`; al cerrar, a la fila "Configuración"; tras borrar, al control que queda en su lugar ("+ Agregar clave", "Descargar"); tras guardar una clave, a "Probar".
- `role=status` anuncia cada cambio de 5. Errores de clave con `aria-invalid` y `aria-describedby`.
- Color nunca solo: píldoras con texto, ✓ en la especie elegida, "Sí/No" junto al interruptor, puntos de pestaña con texto oculto.
- Movimiento reducido y pausa: 8.

## 12. Responsive y zoom

El panel no cambia por ancho (ancho fijo de 188 + 460, estilo-avis 9.2). Al 100 % Mascota, Panel, Datos e Instalación entran sin scroll (medido en el boceto: 536 px útiles); Modelos desplaza adentro de `.cfg-cuerpo`. Con zoom de 125 a 200 % todo escala y cada pestaña desplaza adentro; el encabezado y las pestañas quedan fijos. Revisar la entrega 1 al 100, 150 y 200 % y con la ventana acoplada en los cuatro bordes. El boceto se revisó a 375, 768 y 1440 (a 375 oculta la barra y escala la columna: es solo para mirarlo en el teléfono).

## 13. Entregas

1. **La hoja y Panel.** Fila "Configuración", Ctrl ,, la hoja con las 5 pestañas (las vacías muestran solo su rótulo), Esc y foco; pestaña Panel completa; `arriba`/`avisar`/`pausa` en la struct y aplicados al arrancar; bandeja de 4.5 con "Configuración…". **Acepta:** tests 1, 2 (sin `motor`) y 9; cada interruptor persiste tras reiniciar Avis; el pin del encabezado y la configuración muestran lo mismo; Esc en sus tres capas; Playwright con `dev/vista.html?cfg=panel` al 100 y 200 %, flotando y acoplada.
2. **Mascota.** Escenario con la vista previa real y el acto, fichas, `guardar_ajuste mascota`, `oficina://mascota` y redibujo de toda la ventana sin acto; `tipo` y `concepto` en especies.js. **Acepta:** elegir una especie cambia la marca, la muesca, las tarjetas y los subagentes al instante y persiste; "Base · {evo}" corre `evolucionar`/`devolver`; flechas en las fichas; con movimiento reducido, el cambio de forma es instantáneo.
3. **Instalación y modelo local.** Tarjetas de 7.2 y 7.3, `estado_mod`, borrar sin diálogo nativo. **Acepta:** test 6; cada estado de 7.2 y 7.3 en `dev/vista.html?mod=…&modelo=…`; borrar el modelo desde la configuración libera `%LOCALAPPDATA%\avis-ia`; el punto de Instalación aparece con el mod apagado.
4. **Claves de API.** `claves.rs`, la dependencia de 9.4, la fila de 7.1, Probar; CLAUDE.md con la regla nueva. **Riesgo:** ítems 2 (credenciales) y 5 (dependencia): verificador independiente. **Acepta:** tests 3, 4, 10; la clave aparece en el Administrador de credenciales como `Avis/api/<proveedor>` y en ningún archivo de Avis ni en `widget.log` (buscarla con `rg` en la carpeta de Avis después de guardar); la ventana nunca recibe más que `final` (revisar los mensajes IPC); Probar medido una vez por proveedor con una clave real y otra falsa.
5. **Charla e historial** (cuando el chat esté en `main`). "Quién responde" con `motor`, el bloque del historial y su borrado con Engram. **Acepta:** tests 7 y 8; borrar el historial borra los archivos de `chat/` y solo las observaciones `project: "avis"` con prefijo `avis/`; una charla nueva arranca con el motor elegido.

No improvisar: el orden de las pestañas y de las filas; que todo se aplique en el clic; que la clave nunca vuelva a la ventana; la confirmación en el mismo botón (nunca un diálogo); que lo que no existe no se muestre; los textos de 5. Cualquier opción nueva (por ejemplo, las que salgan de comparar con Troko) vuelve a diseño.

## 14. Correcciones y contradicciones con el código

- `preferencias.rs` borraría cualquier clave nueva que no esté en la struct (9.1). Ya pasó con `mascota` y se resolvió en #24; la propuesta D9 evita repetirlo.
- "Siempre arriba", "Avisarme" y "Pausar" hoy no se guardan: vuelven a su valor de fábrica en cada arranque. Pasar a guardarlos cambia ese comportamiento (#23 pide que persistan).
- "Borrar el modelo de IA" hoy confirma con un diálogo nativo con "No" por defecto (`dialogo::preguntar`). En la configuración la confirmación es del botón (D5); el diálogo queda solo si el borrado se dispara desde otro lugar.
- El chat renombra `estado_resumen` a `estado_modelo` (chat-avis-ux.md 3.6): la entrega 3 usa el nombre que haya en `main` en ese momento.
- **Entrega 1 (lo que se ajustó al código):** la bandeja de 4.5 conserva "Primeros pasos" y "Borrar el modelo de IA…" hasta la entrega 3 (sin sus pestañas, sacarlos dejaba sin camino al asistente desde la bandeja y sin forma de borrar el modelo); el `h1` de la hoja es el `#titulo` de siempre con `tabindex=-1` (no un `#cfg-h1` aparte); el Avi de 40 junto al título (`.mini`) llega con la entrega 2, junto a la mascota; `leer_configuracion` reemplaza a `estado_menu` y `mascota`, y el alfiler del encabezado guarda `arriba` con `guardar_ajuste` (antes `fijar_arriba`, sin guardar). El submenú "Acoplar a" ya no existe: `oficina://acoplar` queda solo para la vista de desarrollo.
- **Entrega 2 (lo que se ajustó al código):** el Rust de la mascota ya estaba desde la entrega 1 (`guardar_ajuste` valida y guarda `mascota` y emite `oficina://mascota`). El concepto del Avi es el de `M` del boceto de mascotas, como pide 5 ("…de hoy, sin cambios: …"); el boceto de esta dirección lo acortaba. El anuncio de volver a la base, que 5 no nombra, es el del boceto: "{evo} vuelve a {nombre}". La figura del escenario usa la clave de evolución `cfg`, que el controlador de formas de main.js salta (si no, le sacaba `evol` en la pintada siguiente). La pestaña Mascota se actualiza por partes (`data-parte`: figura, texto, fichas, error) en lugar de "la sección que cambió": cambiar la forma no toca la figura y el escenario no se reemplaza, así la luz (`--cc`, puesta en `#cfg`) hace su transición. La marca y la muesca no se redibujaban con otra mascota: `montarMarca` suma `redibujar()`. El Avi de 40 junto al título no lleva la clase `chica`: sin clave de evolución no tiene partes de la otra forma que esconder.

## 15. Decisiones tomadas sin el usuario (para revisar)

- **D1** Opción B "Taller" (pestañas con escenario) — rechazada: A "Ficha" (una hoja con índice). Dueño: usuario.
- **D2** La fila "Configuración" va al pie de la barra, encima de "Equipo", con nombre visible y "Ctrl ," — rechazado: solo un ícono de engranaje junto a la marca. Dueño: usuario.
- **D3** Pestañas Mascota · Panel · Modelos · Datos · Instalación — rechazado: Privacidad en vez de Datos, y el modelo local en Datos. Dueño: usuario.
- **D4** La bandeja queda con Mostrar, Configuración…, Pausar animaciones y Salir — rechazado: dejar todos los ítems duplicados. Dueño: usuario.
- **D5** Borrar (clave, modelo, historial) confirma en el mismo botón 3 s — rechazado: el diálogo nativo con "No" por defecto. Dueño: usuario.
- **D6** Lo que todavía no existe (motor de la charla, historial) no se muestra hasta que llegue; las claves sí — rechazado: mostrar todo deshabilitado con "próximamente". Dueño: usuario.
- **D7** "Probar" la clave con un pedido de solo lectura a la API del proveedor, con un clic — rechazado: no probar nunca (la pantalla diría "guardada" sin saber si sirve). Dueño: usuario.
- **D8** "Dónde vive" (flotar o acoplar) y "Siempre arriba", "Avisarme", "Pausar" también entran a la configuración aunque #23 no los nombra — rechazado: mover solo tamaño, arranque, IA local y primeros pasos. Dueño: usuario.
- **D9** `escribir` conserva las claves que no conoce — rechazado: solo sumar cada clave a la struct. Dueño: orquestador.
- **D10** "Quién responde" guarda un `motor` por defecto para las charlas nuevas — rechazado: que el motor se elija solo dentro de la charla. Dueño: usuario.
- **D11** Proveedores con una inicial en mono, sin logos — rechazado: logos de marca (marcas registradas). Dueño: diseño.
- **D12** Sin botón "Buscar actualización del mod" (respeta #17) — rechazado: un botón que fuerce la actualización. Dueño: usuario.
- **D13** Prefijo raro de una clave avisa y deja guardar ("Guardar igual") — rechazado: bloquear. Dueño: usuario.
