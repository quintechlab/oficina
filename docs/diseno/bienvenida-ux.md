# Oficina · Primeros pasos — dirección

Dirección aprobada para el asistente de primera vez del widget (Issue quintechlab/oficina#10).

- **Opción elegida:** **B · «Un paso a la vez»** de `docs/diseno/bocetos/bienvenida.html`. Pedido del usuario, textual: «me gusto la opcion B».
- **Los 6 puntos de la propuesta, aprobados con «Sí, todo»:** membresía en `quintechlab` con su error; permiso `project` al conectar; pose nueva «saluda»; la × cierra sin hacer nada; reapertura desde la bandeja y desde un aviso del tablero; versión de B para el panel acoplado.
- **Hereda todo de `docs/diseno/estilo-avis-ux.md`:** tokens, Avis, movimiento, accesibilidad y la regla firme de la sección 11. Lo que no está acá ni allá se consulta. No se inventa.
- **Regla firme de este asistente:** cada paso ocurre solo con un clic del usuario. Nada corre solo y nada elige por él (sección 10).

---

## 1. Brief

| | |
|---|---|
| **Propósito** | Dejar lista la Oficina en una máquina nueva sin escribir comandos: Claude Code presente, el mod instalado y GitHub conectado con acceso a `quintechlab`. |
| **Público** | Un integrante nuevo de Quintech Studio (o uno que cambió de máquina) que abre el widget por primera vez. |
| **Acción principal** | La acción del paso que toca: un solo botón ámbar por pantalla. |
| **Vara de calidad** | `webs portfolio/brasa-noble`, con la densidad y el estilo Avis del widget. |
| **Revisión** | Solo escritorio: zoom al 100, 150 y 200 %, flotante y acoplada en los cuatro bordes (igual que `estilo-avis-ux.md` 1). |

## 2. Concepto

**El Avi base te recibe en la puerta.** Antes de que haya sesiones, quien habla no es Claude sino el Avi base de la familia (copete ámbar). Levanta la mano, saluda tres veces y espera. Cada paso es una escena: el Avi actúa lo que pasa (escribe mientras instala, tambalea si algo falla, festeja al final) y el texto dice exactamente qué se va a hacer antes de hacerlo.

- **Palabras clave:** cálido · transparente · a tu ritmo.
- **Lo que se recuerda:** la mano crema que saluda la primera vez que se abre la Oficina, y el código de GitHub en mono grande, letra por letra.

---

## 3. Arquitectura de la información

### 3.1 Los tres pasos

| # | Pestaña | Nombre | Depende de | Hecho cuando |
|---|---|---|---|---|
| 1 | Claude | Claude Code | — | `claude --version` responde. |
| 2 | Mod | Mod de la Oficina | paso 1 | `oficina@quintech` figura instalado y activo. |
| 3 | GitHub | GitHub | — (no depende de 1 ni de 2) | `gh` instalado, sesión activa con los permisos `repo`, `read:org` y `project`, y membresía `active` en `quintechlab`. |

- **Paso que toca** (`pasoActual`): el que corre, falla o espera el código; si no hay ninguno, el primero sin hacer.
- **Uno por vez:** mientras un paso corre, las acciones de los otros pasos quedan deshabilitadas con su motivo escrito.
- **Solo el paso que toca lleva el botón ámbar.** Si el usuario mira otro paso desde las pestañas, la acción principal de ese paso va como secundaria (`--s3`).

### 3.2 Dónde vive

| Situación | Forma | Detalle |
|---|---|---|
| Sin tablero (sin sesiones), falta algo y no se cerró en esta ejecución | **Escenario** de 340 × 600 **en lugar del vacío** | Flotando o en el panel acoplado compacto. La primera vez (sin `acople` guardado) la Oficina arranca flotando, como hoy. El equipo y el pie del vacío no se muestran mientras está el escenario. |
| Con tablero (hay sesiones), al tocar «Ver →» del aviso o el ítem de la bandeja | **Hoja** en la columna principal, 460 × el alto disponible | Flotando o acoplada. El encabezado de la columna (`h1` del proyecto y controles de ventana) queda arriba; la hoja reemplaza lo de abajo (aviso, pregunta, cuadros y sesiones) hasta que se cierra. |
| Sin tablero, después de cerrar con × | El vacío de siempre | Se reabre desde la bandeja. |
| Acoplada y cerrada | La muesca de siempre | **No golpea ni enciende la luz.** Solo su nombre accesible suma lo que falta (3.5). |

- **La × cierra sin hacer nada:** no cancela un paso que corre, no instala, no revisa. Un paso que corre sigue corriendo; al reabrir se ve en su estado. «Cerrado en esta ejecución» vive solo en memoria: al volver a arrancar la Oficina, si todavía falta algo, el escenario vuelve en lugar del vacío.
- **Con una pregunta pendiente**, la tarjeta de pregunta tiene prioridad: si la hoja está abierta, el aviso de pregunta (4.3 del estilo) aparece arriba de la hoja y «Ver →» cierra la hoja y muestra la pregunta.

### 3.3 Revisar: solo lectura, solo al abrir

- Se revisa (comandos de solo lectura, 9.2) **al arrancar la Oficina**, **al abrir el asistente** y **al tocar «Volver a buscar» o «Volver a revisar»**. Nunca en el ciclo de 1,5 s.
- Una acción tocada corre su comando y después su verificación de solo lectura (por ejemplo, instalar `gh` y luego `gh --version`). **Nunca encadena la acción del paso siguiente.**
- El resultado de la última revisión alimenta el ítem de la bandeja, el aviso del tablero y el nombre de la muesca.

### 3.4 Navegación del escenario y de la hoja

1. **Encabezado:** rótulo «PRIMEROS PASOS · n DE 3» y la × («Cerrar primeros pasos»).
2. **Pestañas** de los 3 pasos (`role="tablist"`): cambiar de pestaña solo cambia la vista.
3. **Escena del paso:** Avi, rótulo «PASO n DE 3 · NOMBRE», título, texto, bloque extra (registro, error, código, cuenta) y acciones.
4. **Pie:** «← Anterior» y «Siguiente →». «Siguiente →» se habilita solo si el paso visible está hecho. Ninguno de los dos ejecuta nada.
5. **Todo listo:** la escena final reemplaza a la del paso (4.5). Las pestañas siguen, todas con ✓.

### 3.5 Bandeja, aviso y muesca

**Ítem de la bandeja** (menú nativo, `MenuItem` con id `primeros-pasos`), justo debajo de «Mostrar oficina»:

| Estado | Texto |
|---|---|
| Falta 1 paso | `Primeros pasos (falta 1)…` |
| Faltan 2 o 3 | `Primeros pasos (faltan 2)…` |
| Todo hecho | `Primeros pasos…` (sigue, para revisar o conectar otra cuenta) |

Al tocarlo: muestra la ventana (o abre el panel acoplado, como «Mostrar oficina»), abre el escenario o la hoja según 3.2 y lleva el foco al encabezado del asistente (no a una acción). El texto se actualiza con `set_text` después de cada revisión.

**Aviso del tablero** (con tablero y algo pendiente; va en `#otro`, debajo del aviso de pregunta si lo hay):

- La misma píldora del aviso (4.3 del estilo): `button`, alto mínimo 38, `--s1`, **borde `--linea-hover`** (no ámbar: es neutro), al pasar el mouse `#4A4A52`.
- Contenido: Avi base de 28 en `saluda` **quieto** (sin los vaivenes), el texto y «Ver →» en ámbar 800.
- Texto según el primer paso pendiente: «Falta **instalar Claude Code**», «Falta **instalar el mod**», «Falta **conectar GitHub**» (incluye `gh` ausente, sin sesión o sin permiso) o «Falta **entrar a quintechlab**» (no miembro o invitación pendiente).
- `aria-label`: «Primeros pasos: falta conectar GitHub. Ver».
- Se muestra mientras falte algo, aunque se haya cerrado el asistente con la ×: es la manera de volver.

**Muesca:** sin golpe, sin luz, sin cambio de dibujo. Su nombre accesible suma una frase: «Oficina: 4 sesiones abiertas. Falta 1 paso de configuración. Abrir».

---

## 4. Estados y textos

Formato de cada estado: **pose del Avi** · chip de la pestaña · rótulo · título · texto · bloque extra · acciones (★ = primaria ámbar si es el paso que toca; ○ = secundaria; ⊘ = deshabilitada con su motivo). Los textos de la interfaz usan el voseo del widget («Pegá», «Conectá»), como el resto de la Oficina.

Valores de ejemplo marcados *(propuesto)*: el código `4F2A-91C7`, la cuenta `nicoequintana`, las versiones y los mensajes de error de red.

### 4.1 Comunes

| Estado | Pose | Chip | Título | Texto | Acciones |
|---|---|---|---|---|---|
| **Revisando** (al abrir o con «Volver a buscar») | `leyendo` | `revisando` | «Revisando este equipo…» | «Solo miramos qué hay instalado. No se instala nada.» | ninguna; las del paso quedan ⊘ «Revisando…» |
| **Sin conexión** (una lectura de GitHub falla por red) | `fallo` | `sin conexión` | «No pudimos hablar con GitHub» | «Revisá tu conexión y probá de nuevo.» Bloque de error con la primera línea del comando (9.5). | ★ «Reintentar» · ○ «Copiar detalle» |

### 4.2 Paso 1 · Claude Code

| Estado | Pose | Chip | Título | Texto | Extra | Acciones |
|---|---|---|---|---|---|---|
| **No encontrado** | `saluda` | `no encontrado` | «Primero, Claude Code» | «No lo encontramos en este equipo. La Oficina no puede instalarlo por vos: seguí la guía oficial y volvé acá.» | — | ★ «Ver cómo instalarlo ↗» (abre la guía, 9.4) · ○ «Volver a buscar» |
| **Hecho** | `listo` (quieto, 6.4) | `listo` | «Claude Code está listo» | «Claude Code 2.1.329 en este equipo.» *(versión propuesta)* | — | «Siguiente →» habilitado |

### 4.3 Paso 2 · Mod de la Oficina

| Estado | Pose | Chip | Título | Texto | Extra | Acciones |
|---|---|---|---|---|---|---|
| **Bloqueado** | `esperando` | `espera el paso 1` | «Después, el mod de la Oficina» | «Se instala adentro de Claude Code, así que primero hace falta el paso 1.» | — | ⊘ «Instalar en Claude Code» · motivo «Falta el paso 1: Claude Code.» |
| **Pendiente** | `saluda` | `sin instalar` | «Sumá la Oficina a Claude Code» | «Agrega el catálogo quintech y el mod oficina para tu usuario. Tarda unos segundos.» | `details` «Ver los comandos» con las dos líneas mono | ★ «Instalar en Claude Code» |
| **Apagado** (instalado, `enabled: false`) | `durmiendo` | `apagado` | «El mod está apagado» | «Está instalado, pero desactivado en Claude Code.» | — | ★ «Activar en Claude Code» |
| **Trabajando** | `escribiendo` | `instalando` (punto ámbar) | «Instalando la Oficina en Claude Code» | «Tarda unos segundos. Podés dejar la ventana abierta.» | Registro: `✓ claude plugin marketplace add quintechlab/oficina` · `› claude plugin install oficina@quintech` y la barra indeterminada | ninguna (no se cancela a mitad: dejaría el catálogo a medias) |
| **Error** | `fallo` | `falló` («!») | «No se pudo instalar el mod» | Red: «Revisá tu conexión y probá de nuevo.» Otro: «Claude Code devolvió un error.» | Bloque de error: `✕ <comando>` y la primera línea de su salida de error | ★ «Reintentar» · ○ «Copiar detalle» |
| **Hecho** | `listo` | `listo` | «El mod quedó instalado» | «oficina 0.6.0 · para tu usuario.» Si ya estaba: «Ya estaba instalado · oficina 0.6.0.» | — | «Siguiente →» |

### 4.4 Paso 3 · GitHub

| Estado | Pose | Chip | Título | Texto | Extra | Acciones |
|---|---|---|---|---|---|---|
| **Falta `gh`** | `saluda` | `falta gh` | «Conectá tu GitHub» | «Para ver a tu equipo hace falta GitHub CLI. Se instala con winget y Windows puede pedirte permiso.» | Nota mono: «Al instalar aceptás la licencia de GitHub CLI y las condiciones de winget.» | ★ «Instalar GitHub CLI» · ⊘ «Conectar con GitHub» · motivo «Primero instalá GitHub CLI.» |
| **Falta winget** | `esperando` | `falta gh` | «Instalá GitHub CLI a mano» | «Este Windows no tiene winget, el instalador de aplicaciones. Bajá GitHub CLI desde su página y volvé acá.» | — | ★ «Abrir cli.github.com ↗» · ○ «Volver a buscar» |
| **Instalando `gh`** | `escribiendo` | `instalando` | «Instalando GitHub CLI» | «Si Windows te pide permiso, aceptá en su ventana. Tarda menos de un minuto.» | Registro: `› winget install --id GitHub.cli -e` y la barra | ninguna |
| **Error al instalar `gh`** | `fallo` | `falló` | «No se pudo instalar GitHub CLI» | Permiso negado: «Windows no dio permiso para instalar.» Otro: «winget devolvió un error.» | Bloque de error | ★ «Reintentar» · ○ «Copiar detalle» · enlace «Instalarlo a mano ↗» |
| **Sin conectar** | `saluda` | `sin conectar` | «Conectá tu GitHub» | «GitHub CLI ya está. Se abre el navegador para que entres con tu cuenta y autorices el acceso.» | Nota mono: «Pide permisos de repo, read:org y project.» | ★ «Conectar con GitHub ↗» |
| **Pidiendo el código** (hasta que `gh` imprime el código, menos de 2 s) | `escribiendo` | `conectando` | «Pidiendo un código a GitHub…» | «Un momento.» | barra | ○ «Cancelar» |
| **Código** | `esperando` | `esperándote` (punto ámbar) | «Pegá este código en GitHub» | «Se abrió GitHub en tu navegador. Pegá este código y autorizá el acceso.» | Caja del código (5.3) con ○ «Copiar»; línea «esperando que autorices en el navegador…» con punto ámbar; mono `--tenue` «vence a las 12:19» *(propuesto)*; enlace «¿No se abrió? Abrir github.com/login/device ↗» | ○ «Cancelar» |
| **Código vencido** | `durmiendo` | `venció` | «El código venció» | «GitHub no recibió la autorización a tiempo. Pedí otro cuando quieras.» | — | ★ «Pedir otro código» |
| **Cancelado** | vuelve a **Sin conectar** | — | — | Anuncio «Conexión cancelada.» | — | — |
| **Verificando** | `leyendo` | `revisando` | «Revisando tu cuenta…» | «Confirmamos los permisos y que seas parte de quintechlab.» | barra | ninguna |
| **Falta un permiso** | `esperando` | `falta permiso` | «Falta un permiso» | «Tu cuenta @nicoequintana está conectada, pero sin el permiso project, que el tablero necesita.» | — | ★ «Sumar el permiso ↗» (lleva al estado Código) |
| **No es miembro** | `fallo` | `sin acceso` («!») | «Tu cuenta no es parte de quintechlab» | «Conectaste @nicoequintana, pero la Oficina lee los datos del equipo desde la organización quintechlab.» | Bloque «Cómo se arregla» (borde rojo): 1. «Pedile a un owner de quintechlab que te invite (Personas → Invitar).» 2. «Aceptá la invitación desde tu correo o en github.com/orgs/quintechlab/invitation.» 3. «Volvé acá y tocá «Volver a revisar».» | ★ «Volver a revisar» · ○ «Copiar mi usuario» · enlace «Conectar otra cuenta» (lleva a Pidiendo el código) |
| **Invitación pendiente** | `esperando` | `invitación` | «Tenés una invitación sin aceptar» | «quintechlab ya te invitó. Aceptala en GitHub y volvé acá.» | — | ★ «Aceptar en GitHub ↗» · ○ «Volver a revisar» |
| **Hecho** | `listo` | `listo` | «GitHub está conectado» | Cuenta: círculo de 22 con iniciales en violeta y «Conectado como **nicoequintana** · miembro de quintechlab» | — | — |

### 4.5 Todo listo

- Avi base de 104 en `listo` (festeja 3 veces y queda con ojos felices, 6.4).
- Rótulo «LISTO · 3 DE 3», título «Tu Oficina está lista».
- Texto: «Para que las sesiones de Claude Code que ya están abiertas carguen el mod, reinicialas o escribí `/reload-plugins` en cada una.» (`/reload-plugins` en `--t-mono`, `--crema`).
- La línea de la cuenta (como en 4.4 Hecho), centrada.
- Acciones: ★ «Ir a la Oficina» (cierra el asistente: se ve el vacío o el tablero) · ○ «Copiar `/reload-plugins`».
- Anuncio: «Todo listo. Tu Oficina está conectada.»

---

## 5. Sistema visual

Todo sale de `estilo-avis-ux.md` 3. Sin colores nuevos. Se suman dos tokens de tipo y uno de tamaño:

| Token | Valor | Uso |
|---|---|---|
| `--t-paso` | `800 19px/1.15 Manrope`, tracking −0.035em | Título del paso. Entre `--t-display` (21) y `--t-titulo` (14.5), porque es el texto principal de una escena angosta. |
| `--t-codigo` | `600 22px/1 Martian Mono` (`font-stretch: 75%`), tracking 0.1em | **Solo** el código de GitHub: se copia y se compara letra por letra. Es la única pieza mono por encima de 10.5. |
| `--alto-escenario` | `600px` | Alto fijo del escenario (5.1). |

Contrastes (medidos en `estilo-avis-ux.md` 3.1): título y texto `--crema`/`--crema2` sobre `--negro` 17.69 / 10.31; rótulos y motivos `--tenue` sobre `--negro` 5.65; chip de error `--rojo` sobre `--negro` 8.25; enlace violeta sobre `--negro` 7.74; negro sobre el botón ámbar 11.51. **Ningún texto con opacidad baja:** el `.38` va solo en el botón deshabilitado (exento de contraste por WCAG), y su motivo va al lado en `--tenue` al 100 %.

### 5.1 Escenario (sin tablero: flotando o en el panel compacto)

```
┌──────────── 340 × 600, --negro, radio 26 (en el panel acoplado: 7.4 del estilo) ┐
│ PRIMEROS PASOS · 1 DE 3                                              [×]      │
│ ( 1 Claude │ 2 Mod │ 3 GitHub )      ← pista --s1, indicador --s3 que se desliza│
│                                                                                │
│                         [ Avi base 104 ]                                       │
│                 PASO 1 DE 3 · CLAUDE CODE                                      │
│                    Primero, Claude Code                                        │
│        No lo encontramos en este equipo. La Oficina…                           │
│        (bloque extra: registro / error / código / cuenta)                      │
│        [ ★ Ver cómo instalarlo ↗                       ]  alto 38, ancho 100 % │
│        [ ○ Volver a buscar                             ]                       │
│        motivo mono --tenue                                                     │
│ ───────────────────────────────────────────────────────────────────────────── │
│ ← Anterior                                                     Siguiente →     │
└────────────────────────────────────────────────────────────────────────────────┘
```

- **Marco:** relleno 14 / 16 / 10, columna flex con separación 12. Flotando: borde `1px solid rgba(255,255,255,.07)` y `--sombra-ventana`.
- **Alto fijo de 600** (`--alto-escenario`): cambiar de estado o de paso **no redimensiona la ventana** (acoplada, cada cambio de tamaño vela el panel, 9.6 del estilo). La escena desplaza adentro si no entra (zoom alto o «No es miembro»), con el pie fijo abajo y el borde de la escena fundido 8 px, como la columna del tablero.
- **Encabezado:** el rótulo es el `h1` del asistente con el aspecto de `--t-rotulo` en `--tenue`. Es zona de arrastre flotando (como la marca). La × es un control de ventana de 32 × 32 (4.3 del estilo).
- **Pestañas:** pista `--s1` con relleno 3 y separación 3, radio 999. Cada pestaña mide 32 de alto (zona de toque de 36 con `::before`, como las de la pregunta), texto 11.5 / 700 `--crema2`; la seleccionada va en `--crema` sobre el **indicador** `--s3` con anillo interior `#3A3A40`. Glifo antes del nombre: número (mono 10 `--tenue`), ✓ verde, «!» rojo (Manrope 800, 12) o punto ámbar de 6 (trabajando o código).
- **Escena:** centrada. Avi de 104; rótulo `--t-rotulo` `--tenue` a 2 de margen; título `--t-paso`, ancho máximo 22ch, 8 arriba; texto `--t-cuerpo` `--crema2`, ancho máximo 32ch, 6 arriba. El bloque extra va a ancho completo y alineado a la izquierda.
- **Acciones:** columna con separación 6, a 14 de la escena; botones a ancho completo, alto 38. El motivo de un deshabilitado va debajo, mono 10 `--tenue`.
- **Pie:** filete superior `--linea`, relleno arriba 4. Enlaces de 32 de alto, 12 / 800: «← Anterior» `--crema2`, «Siguiente →» ámbar. Deshabilitados al `.38`.

### 5.2 Hoja (con tablero: flotando o acoplada)

```
┌ columna principal 460 ─────────────────────────────────────────┐
│ oficina                                      [📌][—][×]        │  ← encabezado de siempre
│ ┌ hoja --s1, borde --linea, radio 18, relleno 12/14/14 ───────┐│
│ │ PRIMEROS PASOS · 2 DE 3                       [× Volver]    ││
│ │ ( ✓ Claude │ ✓ Mod │ 3 GitHub )                             ││
│ │ ┌ Avi 88 ┐  PASO 3 DE 3 · GITHUB                            ││
│ │ │        │  Pegá este código en GitHub                      ││
│ │ └────────┘  Se abrió GitHub en tu navegador…                ││
│ │ [ 4F2A-91C7                                      ○ Copiar ] ││
│ │ • esperando que autorices en el navegador…                  ││
│ │ ¿No se abrió? Abrir github.com/login/device ↗               ││
│ │ [ ★ acción ]  [ ○ acción ]          (fila, alto 38)         ││
│ │ ─────────────────────────────────────────────────────────── ││
│ │ ← Anterior                                     Siguiente →  ││
│ └─────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

- La hoja ocupa el alto que queda debajo del encabezado (con el tablero de 640: unos 546 al 100 %) y **no cambia el tamaño de la ventana**. Desplaza adentro igual que la columna.
- **Escena en dos columnas:** Avi de 88 a la izquierda (columna de 96, alineado arriba) y a la derecha rótulo, título (`--t-paso`) y texto, alineados a la izquierda. El bloque extra y las acciones van debajo, a ancho completo.
- **Acciones en fila** (separación 6, alto 38, ancho según el texto); el motivo debajo.
- **El encabezado de la hoja** es un `h2` («Primeros pasos», con el aspecto del rótulo); el título del paso es `h3`. El `h1` sigue siendo el proyecto.
- La × de la hoja dice «Volver al tablero» en su `title` y `aria-label` («Cerrar primeros pasos y volver al tablero»).
- **Acoplada y con el código en pantalla:** el panel **no se pliega solo** al salir el mouse mientras el paso 3 está en Pidiendo el código, Código o Verificando, porque el usuario tiene que leer el código mientras va al navegador. Se ve como «Mantener abierta» marcado, con `title` «Queda abierta hasta que GitHub confirme». Al terminar ese tramo vuelve a la marca que tenía, salvo que el usuario la haya cambiado mientras tanto: entonces queda su elección. Esc lo cierra igual (7.2 del estilo); el paso sigue corriendo y su estado se ve al reabrir.

### 5.3 Piezas

| Pieza | Átomo / molécula | Medidas y estados |
|---|---|---|
| Botón primario ★ | átomo | `--ambar`, texto negro 800 12; hover `#FFC64A`; `:active` escala .97 en 140 ms; foco contorno `--crema` 2 px a 2; deshabilitado `.38` y `cursor: not-allowed`. |
| Botón secundario ○ | átomo | `--s3`, `--crema`; hover `#27272C`; foco contorno ámbar. |
| Acción que abre el navegador | átomo | Sufijo «↗» (600, al 80 %, `aria-hidden`) y `aria-label` «… (abre el navegador)». |
| Deshabilitado ⊘ | átomo | `aria-disabled="true"` (no el atributo `disabled`: así sigue en el orden del foco y se lee su motivo), `aria-describedby` al motivo, clic ignorado. |
| Pestaña | átomo | 5.1. `role="tab"`, `aria-selected`, `aria-controls`, `aria-label` «Paso 3, GitHub: esperándote». |
| Registro | molécula | `--negro`, borde `--linea`, radio 10, relleno 8 / 10, mono 10 `--crema2`; hecho «✓ » verde; en curso «› » ámbar y texto `--crema`; barra indeterminada de 3 (`--s3` con 38 % ámbar). `aria-label` «Progreso de la instalación». |
| Bloque de error | molécula | borde `--rojo` al 40 %, fondo `--rojo` al 6 %, radio 10, relleno 8 / 10; primera línea mono 10 `--rojo` «✕ comando»; debajo el motivo en 11.5 `--crema`. **Sin `role="alert"`** (lo anuncia la región viva, 7.2). |
| Caja del código | molécula | `--negro`, borde ámbar al 45 %, radio 12, relleno 6 / 6 / 6 / 14; código en `--t-codigo` `--crema` con el guion en `--tenue`, `user-select: all`, `aria-label` deletreado («Código: 4 F 2 A guion 9 1 C 7»); ○ «Copiar» a la derecha (`aria-label` «Copiar el código»), que pasa a «Copiado ✓» 1,6 s. |
| Línea de espera | átomo | punto ámbar de 6 y mono 10 ámbar. |
| Línea de cuenta | molécula | círculo de 22 con iniciales mono 10 violeta sobre violeta al 18 %; 11.5 `--crema2` con la cuenta en `--crema` 700. |
| «Cómo se arregla» | molécula | Bloque de error con `ol` de 3 ítems en 11.5 `--crema`, números mono `--rojo`. Los dominios van en mono 10. |
| `details` «Ver los comandos» | molécula | `summary` mono 10 `--tenue` con «▸» que gira 90° en 200 ms; adentro el registro sin marcas. |

---

## 6. Los Avis del asistente

### 6.1 Personaje

El **Avi base** (`PERSONAJE_BASE` de `avis.js`: copete ámbar). No es Claude: todavía no hay sesión. Va `aria-hidden` (el título del paso ya dice qué pasa).

### 6.2 Pose por estado

| Estado | Pose | Bucle en el asistente |
|---|---|---|
| Pendiente, falta `gh`, sin conectar | `saluda` (nueva) | tres vaivenes al aparecer y después quieto con la mano en alto (6.3) |
| Revisando, verificando | `leyendo` | `mira` (existente) |
| Trabajando, instalando, pidiendo el código | `escribiendo` | existentes |
| Código, bloqueado, falta permiso, invitación, falta winget | `esperando` | respira y parpadea |
| Error, sin conexión, no es miembro | `fallo` | `tambalea` (existente, ya tiene pausa en el 60 % del ciclo) |
| Apagado, código vencido | `durmiendo` | existentes |
| Hecho, todo listo | `listo` | **`festeja` 3 veces** (no infinito) y queda quieto con ojos felices; las chispas también 3 veces |

En el asistente `listo` y `fallo` no pasan a `durmiendo` a los 6 s: esa regla es de los subagentes (`MS_FESTEJO`), no de esta pantalla.

### 6.3 Pose «saluda»: geometría

Se suma a `efectos()` de `avis.js`, delante del cuerpo, en el `viewBox` 0 0 120 120. Los trazados son los del boceto:

```js
case 'saluda': return `<g class="saludo">`
  + `<ellipse cx="103" cy="61" rx="6.6" ry="8" fill="#EFE6D2"/>`                                  // palma
  + `<ellipse cx="97.6" cy="65.5" rx="2.6" ry="3.6" fill="#EFE6D2" transform="rotate(-35 97.6 65.5)"/>` // pulgar, une la mano al cuerpo
  + `<path d="M100 55.5q3-1.6 6 0" stroke="#D9CCAD" stroke-width="1.4" fill="none" stroke-linecap="round"/>` // pliegue
  + `</g>`
  + `<path class="vaiven" d="M112 50q4 5 2.5 11M116.5 45.5q6.5 7 3.5 17" stroke="#8A8478" stroke-width="2" fill="none" stroke-linecap="round"/>`
```

- La mano es del mismo crema que las manos de `escribiendo` (`#EFE6D2`). Ojos base, mejillas del personaje.
- `POSES` suma `'saluda'` y `POSE_DE_ANIMO` cambia `saluda: 'esperando'` (heredado de `escena.js`) por `saluda: 'saluda'`. **Esto cambia `widget/test/avis.test.js` línea 18**, que fija el mapeo viejo.

### 6.4 «saluda» y «listo»: CSS (en `avis.css`, con los nombres del boceto)

```css
.avi .saludo { transform-box: fill-box; transform-origin: 30% 100%; transform: rotate(-8deg) }
.avi .e-saluda .vaiven { opacity: 0 }

@media (prefers-reduced-motion: no-preference) {
  /* Solo al aparecer (clase puesta por primerosPasosMotion.js): 6 medios ciclos = 3 vaivenes, termina en -8° */
  body:not(.pausa) .avi .e-saluda.entra .saludo { animation: saluda .5s ease-in-out .5s 6 alternate both }
  body:not(.pausa) .avi .e-saluda.entra .vaiven { animation: vaiven 3s ease-out .5s both }
  /* En el asistente, el festejo es de 3 vueltas */
  body:not(.pausa) .pp .avi .e-listo .cuerpo,
  body:not(.pausa) .pp .avi .e-listo .chispa { animation-iteration-count: 3 }
}
/* Movimiento reducido o pausa: mano en alto y los trazos de vaivén dibujados, quietos (como las "z") */
@media (prefers-reduced-motion: reduce) { .avi .e-saluda .vaiven { opacity: 1 } }
body.pausa .avi .e-saluda .vaiven { opacity: 1 }

@keyframes saluda { from { transform: rotate(-8deg) } to { transform: rotate(20deg) } }
@keyframes vaiven { 0% { opacity: 0 } 15%, 80% { opacity: 1 } 100% { opacity: 0 } }
```

- **Cuándo saluda:** cuando el escenario o la hoja se montan con el paso visible en un estado de `saluda`. `primerosPasosMotion.js` pone `.entra` en el `svg` y la saca a los 3,6 s, así un redibujo no repite el saludo. El aviso del tablero usa `saluda` **sin** `.entra`: quieto.
- La mano queda fuera de `g.cuerpo`: no respira con el cuerpo. Es intencional (se lee como gesto, no como parte del huevo).

---

## 7. Movimiento y accesibilidad

### 7.1 Movimiento

CSS y la API de animaciones del navegador (`element.animate`), como `tableroMotion.js` y `muescaMotion.js`. Un módulo nuevo, **`primerosPasosMotion.js`**, que reusa `hayMovimiento()` de `tableroMotion.js`. No se suma anime.js: el widget no lo tiene empaquetado y estas secuencias no lo necesitan.

| Momento | Qué se mueve | Tiempo |
|---|---|---|
| **Aparición** del escenario o la hoja | Entrada escalonada `sube` (6.1 del estilo): encabezado, pestañas, Avi, rótulo y título, texto, extra, acciones, pie | 620 ms `--ease`, `índice × 65 + 120` ms; el saludo empieza a los 500 ms |
| **Cambio de paso** (pestaña, Anterior, Siguiente) | Sale la escena: opacidad 1 → 0 y 14 px hacia el lado contrario al avance, 140 ms `--ease-cierra`. Entra la nueva: opacidad 0 → 1 desde 14 px del lado del avance, 280 ms `--ease`, con sus bloques escalonados a 40 ms. El encabezado, las pestañas y el pie no se mueven | 420 ms en total |
| **Indicador de pestaña** | Una sola píldora `--s3` (`::before` de la pista) se desliza a la pestaña nueva con `translateX` | 320 ms `--ease` |
| **Cambio de estado** dentro del paso | El bloque extra y las acciones se funden (opacidad, 200 ms). El Avi cambia de pose con un apretón: escala 1.04 / .96 → 1, 240 ms `--rebote` | — |
| **Hecho** | Glifo de la pestaña: `pop` .36 s `--rebote` y el ✓ se traza (`traza` .5 s `--ease`) | — |
| **Error** | El bloque de error `sacude` una vez (.42 s) | — |
| **Trabajando** | Barra indeterminada `indet` 1,5 s `--ease`; punto de la pestaña `pulsoPt` 1,8 s | bucle mientras corre |
| **Código** | Cada letra entra (`letra` .42 s `--ease`), 45 ms entre letras, desde los 420 ms | — |
| **Todo listo** | El Avi festeja 3 veces con chispas | 3 s |

Solo `transform` y `opacity`. La ventana no cambia de tamaño en ningún momento del asistente.

**Movimiento reducido y «Pausar animaciones»** (6.5 del estilo): sin entrada, sin deslizamiento, sin apretón, sin sacudida; las letras del código aparecen juntas; las barras indeterminadas quedan quietas al 38 % (el texto «instalando» dice el estado); el Avi queda en su pose (la mano en alto con los trazos de vaivén). Los cambios son instantáneos.

### 7.2 Accesibilidad

- **Encabezados:** escenario: `h1` «Primeros pasos» (rótulo) y `h2` el título del paso. Hoja: `h2` y `h3` (el `h1` es el proyecto). Sin saltos.
- **Orden del foco:** × → pestañas (una sola parada, flechas ← → entre ellas, Inicio y Fin; tabindex móvil) → contenido de la escena (enlaces del texto, «Copiar», «Ver los comandos», acciones en orden) → «← Anterior» → «Siguiente →». En la hoja, antes van los controles del encabezado del tablero, como siempre.
- **Nunca se pone el foco en un botón de acción**, ni al abrir ni al cambiar de estado:
  - Primera vez (el escenario aparece solo): no se mueve el foco.
  - Abierto por el usuario (bandeja o «Ver →»): foco en el encabezado del asistente (`tabindex="-1"`).
  - Anterior / Siguiente: foco en el título del paso nuevo (`tabindex="-1"`), porque el botón tocado puede quedar deshabilitado.
  - Si el elemento con foco desaparece al cambiar de estado (por ejemplo «Instalar» cuando empieza a instalar), el foco va al título del paso. Solo si el foco estaba adentro del asistente.
- **Enter o Espacio** sobre una pestaña solo muestra el paso. Ninguna tecla ejecuta una acción si esa acción no tiene el foco.
- **Esc:** en el escenario flotante no hace nada (cerrar es la ×). En la hoja, cierra la hoja y vuelve al tablero. Acoplada, cierra el panel (7.2 del estilo).
- **Región viva:** se reusa `#anuncio` (`aria-live="polite"`). **Un** mensaje por cambio de estado, nunca por la revisión de 1,5 s: «Revisando este equipo», «Claude Code encontrado», «Instalando el mod de la Oficina», «Mod instalado», «No se pudo instalar el mod: <motivo>», «Instalando GitHub CLI», «Código de GitHub listo: 4 F 2 A guion 9 1 C 7. Pegalo en el navegador», «Código copiado», «GitHub conectado como nicoequintana», «Tu cuenta no es miembro de quintechlab», «Conexión cancelada», «Todo listo. Tu Oficina está conectada».
- **Panel de pestaña:** `role="tabpanel"`, `aria-labelledby` a su pestaña, `aria-busy="true"` mientras un paso corre.
- **Zonas de toque:** 32 como mínimo (densidad del estilo, 8); botones del asistente de 38; pestañas de 36 de zona.
- **El color nunca va solo:** cada estado tiene glifo (número, ✓, «!», punto) **y** chip con texto; el error tiene «✕» y texto.
- **Enlaces externos** con «↗» y «(abre el navegador)» en su nombre.

---

## 8. Ancho y zoom

Solo escritorio (como el estilo). Lo que cambia con el zoom de 100 a 200 %:

- El escenario escala con `<html>` (340 × 600 al 100 %, 680 × 1200 al 200 %). Topado al 90 % del área de trabajo (9.2 del estilo), la escena desplaza adentro y el pie queda fijo.
- La hoja vive dentro de la columna fija: con zoom alto desplaza adentro.
- Nada se esconde con el zoom.

---

## 9. Notas de implementación

### 9.1 Dónde va cada cosa

| Archivo | Qué |
|---|---|
| `widget/src-tauri/src/primeros_pasos.rs` (nuevo) | Funciones puras con tests (leer la salida de cada comando) y los comandos `revisar_primeros_pasos`, `correr_paso`, `cancelar_paso`. Todo proceso con `CREATE_NO_WINDOW` (`0x0800_0000`), como `correr_gh` de `equipo.rs`. |
| `widget/src-tauri/src/lib.rs` | Ítem de la bandeja `primeros-pasos` debajo de `mostrar_item` (línea ~760: `&[&mostrar_item, &primeros_pasos_item, &arriba, …]`); registrar los comandos; olvidar `estado.login` al conectar una cuenta (hoy `leer_equipo` lo guarda para siempre). |
| `widget/src/primerosPasos.js` (nuevo) | Lógica pura con tests en `widget/test/primerosPasos.test.js`: de la revisión al estado de cada paso, `pasoActual`, botones con su tipo y motivo, textos, cantidad pendiente, texto del aviso. |
| `widget/src/primerosPasosVista.js` (nuevo) | Escenario y hoja (HTML), mismos `data-accion` que el resto del widget. |
| `widget/src/primerosPasosMotion.js` (nuevo) | 7.1. |
| `widget/src/avis.js`, `avis.css`, `test/avis.test.js` | Pose `saluda` (6.3 y 6.4). |
| `widget/src/estilos.css` | Tokens `--t-paso`, `--t-codigo`, `--alto-escenario` y las piezas de 5.3. |
| `dev/falso.js` | Estados falsos de los tres pasos, para revisar en el navegador (Playwright no maneja la ventana de Tauri). |

### 9.2 Comandos

Todos con argumentos fijos: nunca se interpola texto del usuario. «Verificado» = corrido en la máquina del usuario el 2026-11-20 (solo los de lectura); lo demás es **supuesto** hasta la prueba del paso 9.6.

| Para qué | Comando | Estado |
|---|---|---|
| ¿Está Claude Code? | `claude --version` → `2.1.329 (Claude Code)` | Verificado |
| ¿Está el catálogo? | `claude plugin marketplace list --json` → lista con `name: "quintech"`, `repo: "quintechlab/oficina"` | Verificado |
| ¿Está el mod? | `claude plugin list --json` → elemento con `id: "oficina@quintech"`, `enabled`, `version`, `scope` | Verificado |
| Sumar el catálogo | `claude plugin marketplace add quintechlab/oficina` (solo si no está) | Supuesto (la ayuda confirma `add <source>` con repo de GitHub) |
| Instalar el mod | `claude plugin install oficina@quintech --scope user --json` | Supuesto (la ayuda confirma `--scope` y `--json`; `-y` no hace falta porque el catálogo no declara comandos) |
| Activar el mod | `claude plugin enable oficina@quintech` | Supuesto |
| ¿Está `gh`? | `gh --version` → `gh version 2.103.3 (2026-10-26)` | Verificado |
| ¿Está winget? | `winget --version` → `v1.30.310` | Verificado |
| Instalar `gh` | `winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity` | Supuesto (flags confirmados en la ayuda). Los dos `--accept-*` evitan que winget espere una respuesta sin consola; el clic en «Instalar GitHub CLI», con la nota de la licencia a la vista, es la aceptación del usuario. |
| Sesión y permisos | `gh auth status --hostname github.com --active --json hosts` → `hosts["github.com"][0]`: `state: "success"`, `login`, `scopes: "…, project, read:org, repo, …"` | Verificado (con sesión). Sin sesión: supuesto que sale con código ≠ 0 o sin `hosts`. |
| Conectar | `gh auth login --hostname github.com --web --git-protocol https --skip-ssh-key --scopes repo,read:org,project` | Supuesto en no interactivo (flags confirmados en la ayuda). `-s` suma a los permisos por defecto; se piden los tres que necesitan el README (`repo`, `project`) y la membresía (`read:org`). **No** se usa `--clipboard`: copiar es un clic del usuario. |
| Sumar el permiso | `gh auth refresh --hostname github.com --scopes project` | Supuesto (flags confirmados). También imprime un código: mismo estado Código. |
| Membresía | `gh api user/memberships/orgs/quintechlab` → `{"role":"admin","state":"active"}` | Verificado para un miembro. No miembro: supuesto `HTTP 404`. Invitación: supuesto `state: "pending"`. |

### 9.3 Cómo se detecta cada estado

| Estado | Señal |
|---|---|
| Claude no encontrado | No se encuentra el ejecutable (9.4) o `--version` sale con error. |
| Mod bloqueado / pendiente / apagado / hecho | Paso 1 sin hacer / sin `oficina@quintech` en la lista / `enabled: false` / `enabled: true` (cualquier `scope`). |
| Falta `gh` | `gh` no se encuentra (9.4). Si además falta winget: Falta winget. |
| Sin conectar | `gh auth status` sin cuenta activa o `state` ≠ `success`. |
| Falta un permiso | Cuenta activa, pero en `scopes` falta `repo`, `read:org` o `project`. |
| No es miembro / invitación | Membresía `404` / `state: "pending"`. |
| Hecho (GitHub) | `state: "active"`. |
| Sin conexión | Cualquier lectura de GitHub falla con un error de red (no de permisos). |

### 9.4 Encontrar los ejecutables (contradicciones con el código actual)

- **`claude` instalado con npm es `claude.cmd`.** En esta máquina está en `%APPDATA%\npm\claude.cmd`. `std::process::Command::new("claude")` en Windows solo agrega `.exe` al buscar en `PATH`, así que no lo encuentra. Buscar en este orden: `claude.exe` en `PATH`, `%USERPROFILE%\.local\bin\claude.exe` (instalador nativo, supuesto), y `claude.cmd` en `PATH` (Rust lo corre a través de `cmd.exe`; con argumentos fijos no hay riesgo de inyección). Todo con `CREATE_NO_WINDOW`.
- **El `PATH` del widget queda viejo después de instalar.** El proceso hereda el `PATH` del momento en que arrancó: después de `winget install` (o de que el usuario instale Claude Code), `gh` y `claude` no aparecen. Antes de cada búsqueda, releer `Path` de `HKCU\Environment` y de `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment` y pasarlo al proceso hijo. Respaldo para `gh`: `C:\Program Files\GitHub CLI\gh.exe` (donde está en esta máquina).
- `correr_gh` de `equipo.rs` hoy llama a `gh` por nombre: tiene el mismo problema después de instalarlo desde el asistente. Debe usar la ruta que resuelva el asistente.
- `leer_equipo` guarda el `login` la primera vez y no lo olvida: si el usuario conecta otra cuenta, el tablero sigue con la vieja. Olvidarlo al terminar el paso 3.
- Guía de Claude Code para «Ver cómo instalarlo ↗»: `https://code.claude.com/docs/en/setup` (**supuesto**: confirmar la dirección vigente antes de publicar).

### 9.5 Correr los pasos y mostrar el código

- `correr_paso { paso }` lanza el proceso hijo en un hilo (`spawn_blocking`), lee `stdout` y `stderr` **línea por línea** (no `output()`, que espera al final) y emite `oficina://primeros-pasos { paso, estado, linea?, codigo?, error? }`. Un paso por vez: si ya corre otro, el comando lo rechaza (la interfaz ya lo deshabilitó).
- `cancelar_paso` mata el proceso hijo (solo se ofrece en Pidiendo el código y Código). Decide lo que pasó (`desenlace`): si `gh` ya había salido bien cuando llegó Cancelar, es un éxito (se verifica y se olvida el login); «cancelado» solo si la orden de matarlo lo terminó.
- Cada proceso de un paso va en un trabajo de Windows con `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` (si no se puede, se mata solo el proceso): al salir de la Oficina, al cerrarse el trabajo o si la aplicación se cae, Windows lo mata con sus hijos (un instalador ya elevado puede quedar: se anota en el log). El turno se suelta siempre: el paso termina cuando su proceso terminó, sin esperar más de 2 s la salida de un hijo que haya quedado.
- **El código:** `gh auth login --web` imprime en `stderr` una línea como `! First copy your one-time code: 4F2A-91C7`. Tomar el primer `\b[A-Z0-9]{4}-[A-Z0-9]{4}\b` de `stderr`. **Supuesto a verificar:** el texto exacto, y si sin terminal `gh` abre el navegador solo o imprime «Open this URL to continue in your web browser». Si no lo abre, el widget abre `https://github.com/login/device` con el abridor del sistema **en el mismo clic** (no es una acción nueva).
- **Sin terminal:** lanzar con `stdin` nulo y `GH_PROMPT_DISABLED=1`, y pasar siempre `--git-protocol https` y `--skip-ssh-key` para que no pregunte. **Supuesto a verificar:** que no quede esperando la pregunta «Authenticate Git with your GitHub credentials?» y qué responde por defecto. Si `gh` configura el ayudante de credenciales de git, eso cambia la configuración de git del usuario: el texto de «Sin conectar» tiene que decirlo o hay que evitarlo (punto abierto).
- **Vencimiento:** el código de GitHub vence a los 15 minutos (supuesto: `expires_in` del flujo de dispositivo); `gh` sale con error. Ese error → Código vencido.
- **Errores:** la línea que se muestra es la primera no vacía de `stderr`, recortada a 140 caracteres (como `correr_gh`). «Copiar detalle» copia el comando y la salida de error completa. Nunca se muestra ni se copia un token (no usar `--show-token`; `--json hosts` no lo trae).
- **Permiso negado de Windows (UAC):** supuesto que winget sale con un código propio; si el código no se puede distinguir, el texto es el genérico «winget devolvió un error.» y la verdad la dice `gh --version` después.
- **Reglas que no se negocian:** ninguna acción corre sin su clic; no hay reintento automático, ni temporizador que avance, ni paso siguiente encadenado; revisar es solo lectura; nada se escribe en `preferencias.json` por el asistente (el «cerrado» es solo de esta ejecución).

### 9.5.1 P0: lo que se probó (2026-11-20, solo lectura)

Corrido en la máquina del usuario, sin instalar ni conectar nada:

- `claude plugin list --json` también lista entradas `scope: "project"` de otros proyectos, con `projectPath` y `enabled: false`: el mod cuenta como activo si **alguna** entrada de `oficina@quintech` tiene `enabled: true`.
- `gh auth status --hostname github.com --active --json hosts` **sin sesión** (con un `GH_CONFIG_DIR` vacío) sale con código 0 y `{"hosts":{}}`; el aviso «You are not logged into any GitHub hosts» va a `stderr`.
- **Sin red**, el mismo comando sale con código 0 y la cuenta en `state: "error"` con `error: "Get \"https://api.github.com/\": … dial tcp …"`: se muestra como Sin conexión, no como Sin conectar.
- `gh api user/memberships/orgs/<org>` de una organización ajena: código 1, `stdout` `{"message":"Not Found",…,"status":"404"}` y `stderr` `gh: Not Found (HTTP 404)`: No es miembro.
- `gh auth login --help`: el flujo web guarda el token en el almacén de credenciales; `--git-protocol` se guarda en la configuración de `gh` («take effect for all users on the host»). Configurar git como ayudante de credenciales es un comando aparte (`gh auth setup-git`) o la pregunta interactiva «Authenticate Git with your GitHub credentials?», que sin terminal (stdin nulo y `GH_PROMPT_DISABLED=1`) no se hace. Por eso el texto de «Sin conectar» no avisa un cambio en git. **Sin verificar con una cuenta real** (necesita el clic del usuario): que no quede esperando esa pregunta, el texto exacto del código y que sin terminal imprima «Open this URL…» en vez de abrir el navegador (el widget abre github.com/login/device igual al ver el código).
- Sumar el permiso corre `gh auth refresh --hostname github.com --scopes repo,read:org,project` (los tres, no solo `project`): refresh suma los que falten y deja los que hay, y así cubre una cuenta sin `repo` o `read:org`.
- Sin verificar (necesitan instalar o conectar): `claude plugin install … --json` en una máquina sin el mod, `winget` con el permiso de Windows cancelado (se reconoce `0x800704c7`, «canceled by the user» o «Access is denied»), el texto de `gh` al vencer el código («timed out» o «expired») y el código de salida al cancelar.

### 9.6 Plan por fases

Cada fase deja el widget funcionando y es un corte revisable de unas 400 líneas.

| Fase | Contenido | Verificación |
|---|---|---|
| **P0 · Prueba de `gh` sin terminal** (descartable, fuera del repo) | Correr `gh auth login --web …` como proceso hijo sin consola y con `stdin` nulo en una cuenta de prueba: texto del código, si abre el navegador, si pregunta por git, código de salida al vencer y al cancelar; `winget` con UAC cancelado; `claude plugin install --json` en una máquina sin el mod; membresía de una cuenta que no es miembro. Actualiza 9.2 y 9.5. | Notas en este documento. |
| **P1 · Revisar** | `primeros_pasos.rs` con los lectores puros (versiones, `plugin list`, `marketplace list`, `auth status`, membresía, línea del código, `PATH` del registro) y `revisar_primeros_pasos`; ítem de la bandeja con la cantidad. | Tests de Rust de cada lector con las salidas reales de 9.2. |
| **P2 · Escenario** | `primerosPasos.js` (lógica pura) y su vista; pose `saluda`; tokens y piezas; reemplazo del vacío; `primerosPasosMotion.js`. Los botones todavía sin acción. | `primerosPasos.test.js`, `avis.test.js` actualizado; estados en `dev/falso.js` al 100, 150 y 200 %. |
| **P3 · Mod y `gh`** | `correr_paso` para el mod (catálogo, instalación, activar) y para winget, con eventos y errores. | Tests de los lectores de errores; recorrido a mano en una cuenta de Windows limpia. |
| **P4 · GitHub** | Conectar, código, cancelar, vencido, permisos y membresía. | Tests del lector del código y de los estados; recorrido con una cuenta miembro y otra que no lo es. |
| **P5 · Hoja y avisos** | Hoja en la columna principal, aviso del tablero, nombre de la muesca, panel que no se pliega durante el código, olvido del `login`. | Revisión de diseño de Delfina con `dev/vista.html` y la ventana real. |

---

## 10. Regla firme: el asistente nunca decide por el usuario

- **Solo un clic actúa:** instalar, activar, conectar, sumar el permiso, reintentar y cancelar son botones. Abrir el asistente solo revisa (lectura).
- **Sin botón por defecto:** Enter no ejecuta nada que no tenga el foco, y el foco nunca se pone en una acción.
- **Sin tiempo que elija:** no hay cuenta regresiva, no se avanza de paso solo, no se reintenta solo.
- **La × no hace nada más que cerrar.** Cerrar el panel acoplado tampoco cancela ni avanza.
- **Lo que se acepta se dice antes:** la licencia de GitHub CLI y winget junto al botón que instala; los permisos de GitHub junto al botón que conecta.
- **La muesca no golpea por la configuración:** el golpe y la luz siguen siendo solo para preguntas.
