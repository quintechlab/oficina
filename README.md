# Oficina · Quintech Studio

Panel para Claude Code que muestra, en vivo, en qué está cada integrante del equipo: proyecto, rama, número de tarea, desde cuándo, horas cargadas, PRs abiertos con el estado del CI y archivos que los dos tocan a la vez. Es la "oficina" de Quintana y Campos: cada uno lo instala en su máquina y entra con su propia cuenta de GitHub.

No tiene servidor propio. La fuente de verdad es GitHub: los Issues y el tablero que ya usa el equipo, más un Issue "Presencia" en un repositorio **privado** donde cada integrante actualiza un comentario propio con su estado. El mod nunca guarda contraseñas ni tokens: usa el `gh` ya autenticado de cada máquina.

## Qué muestra

Por integrante, con avatar y estado (● trabajando, ◐ sin señales hace más de 20 min, ○ fuera):

- Repositorio y rama en la que está. Si tiene varias sesiones de Claude Code abiertas, se muestra la más relevante (activa, en un repositorio, con tarea) y las demás en una línea "también en".
- Tarea en curso (`#42 Título`), talle (S o M) y estado en el tablero.
- Desde qué hora trabaja y cuánto lleva; si la tarea viene de otro día, desde cuándo.
- Horas ya cargadas en el campo "Tiempo real" del tablero. No se muestra un "tiempo restante": el talle es un tope (S: medio día, M: dos días), no una estimación, y restarlo engaña.
- PRs abiertos con el CI en verde, rojo o pendiente.
- Nota libre ("viendo el bug del login").
- Aviso cuando el otro toca los mismos archivos que vos en el mismo repositorio, commiteados o no.
- Último commit.

Además avisa con un mensaje breve cuando el otro arranca una tarea, abre un PR, le falla el CI, entra o se va, y deja un resumen en la barra de estado.

## Instalación

En una terminal con Claude Code:

```
/plugin install oficina --marketplace quintechlab/oficina
```

Responder `y` para agregar el marketplace y elegir el alcance de usuario. En la aplicación de escritorio: `+` junto al cuadro de texto → Plugins → Add marketplace con `quintechlab/oficina` → Add plugin.

Desde una shell: `claude plugin install oficina --marketplace quintechlab/oficina`.

Requisitos: `gh` instalado y autenticado (`gh auth login`) con los permisos `repo` y `project` (`gh auth refresh -s project` si falta). Para los datos del tablero hace falta ser miembro de la organización.

## Primera vez

1. Quien instala primero corre `/oficina init`: crea el repositorio privado de datos (`quintechlab/oficina-datos`) y el Issue "Presencia".
2. Si el otro integrante no es owner de la organización, invitarlo como colaborador de ese repositorio (el comando lo imprime `init`).
3. Cada uno, en `/config`, completa la opción **Nombres visibles** con los dos usuarios: `nicoequintana=Quintana,NCsolucionesdigitales=Campos` (ya viene así por defecto).

A partir de ahí el panel se abre solo al iniciar cada sesión.

## Comandos

| Comando | Qué hace |
|---|---|
| `/oficina` | Abre el panel y actualiza |
| `/oficina tarea 42` | Fija la tarea actual (si la rama no sigue `tipo/42-slug`); `/oficina tarea auto` vuelve a detectarla |
| `/oficina nota texto` | Publica una nota corta para el otro; `/oficina nota -` la borra |
| `/oficina fuera` / `/oficina volver` | Marca que te vas o que volviste, en todas tus sesiones. Abrir una sesión nueva también te vuelve a marcar presente |
| `/oficina init` | Crea el repositorio de datos y el Issue "Presencia" |
| `/oficina ayuda` | Esta lista |

## Opciones (`/config`)

| Opción | Por defecto | Para qué |
|---|---|---|
| Repositorio de datos | `quintechlab/oficina-datos` | Dónde vive el Issue "Presencia" |
| Issue de presencia | `1` | Número de ese Issue |
| Intervalo | `60` | Segundos entre consultas a GitHub |
| Nombres visibles | `nicoequintana=Quintana,NCsolucionesdigitales=Campos` | Usuario de GitHub → nombre que se muestra |

## Cómo detecta la tarea

Por la rama, según la convención del equipo: `feat/12-login-google` → tarea `#12`. Si no hay número, `/oficina tarea N`. El talle se lee del cuerpo del Issue creado con el formulario (`### Talle`) o del campo "Talle" del tablero.

## Varias sesiones abiertas

Cada sesión de Claude Code escribe su propia entrada dentro de tu comentario y no toca las de tus otras sesiones. Cerrar una sesión borra solo su entrada: si cerrás la del playbook mientras trabajás en el CRM, seguís en la oficina. Una sesión que no publica hace 12 horas (máquina apagada, sesión cerrada a la fuerza) se descarta sola.

Después de actualizar el mod, recargá **todas** las sesiones abiertas (`/reload-plugins`): una sesión con la versión anterior escribe el formato viejo y pisa a las demás hasta que se recarga.

## Privacidad

El código es público; los datos no. La presencia (nombre del repositorio, rama, número de tarea, archivos cambiados) se escribe solo en el repositorio privado de datos, que leen únicamente sus colaboradores. Cada consulta a GitHub sale con la sesión `gh` de la máquina de cada uno.

## Widget de escritorio

Ventana flotante para Windows (Tauri 2, en `widget/`) que muestra tus sesiones de Claude Code abiertas en esta máquina como un terrario de mascotas pixel: un proyecto por vez (◀ ▶ o las flechas del teclado), un escritorio por sesión con su Claude y sus subagentes, una lista de texto debajo y un globo con las preguntas que esperan respuesta (por ahora de solo lectura: se contestan en Claude). Lee los archivos que cada sesión escribe en `%USERPROFILE%\.claude\oficina\sesiones` cada 1,5 s; descarta las sesiones cerradas y las que no publican hace más de 12 horas.

Vive en la bandeja de Windows: la × esconde la ventana y el ícono (la cabeza de Claude, con la cuenta de preguntas en ámbar) la muestra o la esconde con un clic. Su menú tiene «Mostrar oficina», «Siempre arriba», «Avisarme con cada pregunta» (una notificación de Windows por cada pregunta nueva mientras la ventana está escondida o minimizada), «Pausar animaciones» y «Salir». El botón de minimizar pliega la ventana a una tira de 400 × 56 con las caras y el resumen. Recuerda posición y tamaño entre usos.

Debajo, plegada, la habitación de cada compañero con su sesión principal, leída cada 60 s del Issue "Presencia" con el `gh` de la máquina (`gh api user` para saber quién sos). Sin `gh` o sin sesión, esa parte muestra un aviso de una línea y el resto sigue funcionando.

Desde la versión 0.5 del mod, el globo también responde: tocás una opción (o las teclas 1–4 con el foco en el globo), marcás varias y "Enviar (n)", o escribís en "Otra respuesta". Solo se envía lo que tocás: no hay opción por defecto ni tiempo que elija solo, y si no tocás nada la pregunta sigue esperando en Claude como siempre. El widget deja la respuesta en `%USERPROFILE%\.claude\oficina\respuestas\<id>.json`; la sesión la valida (preguntas y opciones que existen) y se la entrega al modelo. Si a los 5 s la sesión no la tomó (respondiste antes en Claude, o el mod no está actualizado), el globo pide responder en Claude. Con una sesión que todavía corre una versión anterior del mod, el globo queda de solo lectura.

### Instalar

1. Conseguir `Oficina_0.1.0_x64_es-ES.msi` (se arma con `npm run tauri build` dentro de `widget/`; queda en `widget/src-tauri/target/release/bundle/msi/`). También se arma un instalador `.exe` en `bundle/nsis/`, que instala solo para tu usuario.
2. Abrirlo con doble clic y seguir los pasos. Queda en el menú Inicio como **Oficina**.
3. Necesita el mod **oficina 0.5 o posterior** en Claude Code (`claude plugin update oficina` y `/reload-plugins` en cada sesión abierta): sin eso no hay estado en vivo que mostrar ni respuestas desde el globo.

El widget lee lo que escribe cada sesión en `%USERPROFILE%\.claude\oficina\sesiones`, deja las respuestas del globo en `%USERPROFILE%\.claude\oficina\respuestas` y anota un log de diagnóstico en `%USERPROFILE%\.claude\oficina\widget.log`. Posición y tamaño de la ventana se guardan en la carpeta de configuración de la app (`%APPDATA%\studio.quintech.oficina`).

"Arrancar con Windows", en el menú de la bandeja, viene apagado: solo se prende si lo marcás (agrega el widget al inicio de tu usuario en Windows) y la marca siempre muestra si de verdad está prendido.

### Desinstalar

Configuración de Windows → Aplicaciones → **Aplicaciones instaladas** → Oficina → Desinstalar. Si estaba prendido "Arrancar con Windows", apagalo antes desde el menú de la bandeja. Las carpetas de `%USERPROFILE%\.claude\oficina` son del mod y quedan.

### Desarrollo

Requisitos: Node, Rust (`rustup`, con MSVC) y WebView2 (viene con Windows 11).

```
cd widget
npm install
npm run dev
```

La primera compilación de Rust tarda varios minutos. Tests: `npm test` (lógica de la ventana) y `cargo test` dentro de `widget/src-tauri` (lectura de sesiones). Compilar sin instalador: `npm run tauri build -- --debug --no-bundle`.

## Desarrollo

```
claude plugin validate .
claude plugin test .
```

Para probarlo sin instalar: `claude --plugin-dir <carpeta>`. Los archivos: `hooks/register.tsx` (el mod), `hooks/logica.ts` (funciones puras, con tests en `hooks/oficina.test.tsx`), `types/index.d.ts` (contrato de datos).
