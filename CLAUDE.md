# Contexto para el agente

Mod de Claude Code "oficina": panel de presencia del equipo Quintech Studio. Leer `README.md` primero; este archivo guarda lo que el código no dice.

## Qué es y dónde vive

- Código: este repositorio, público, `quintechlab/oficina`. Marketplace en `.claude-plugin/marketplace.json`; se instala con `/plugin install oficina --marketplace quintechlab/oficina`.
- Datos: Issue #1 "Presencia" del repositorio **privado** `quintechlab/oficina-datos`. Cada integrante tiene un comentario propio con un JSON (`<!-- oficina:presencia -->`), formato v2: `{ v: 2, usuario, nombre, ausente, actualizado, sesiones: Presencia[] }`, una entrada por sesión de Claude Code abierta, identificada por `$.session.id()`. El mod lo edita, nunca crea comentarios nuevos. No editar a mano. El formato v1 (un solo estado, versiones 0.1 y 0.2) se sigue leyendo como una sola sesión.
- Desde la v0.4 cada entrada de sesión puede traer `actividad` (qué hace ahora, según su última herramienta), `agentes` (subagentes en curso o terminados hace menos de 30 min) y `preguntas` (llamadas a `AskUserQuestion` pendientes). Son opcionales: la v0.3 los ignora y la v0.4 lee bien lo que publica la v0.3. Un subagente sin "Nombre — tarea" en su descripción recibe un nombre inventado estable a partir de su id (`NOMBRES_INVENTADOS`).
- Estado local en vivo para el widget de escritorio: cada sesión escribe `%USERPROFILE%/.claude/oficina/sesiones/<id de sesión>.json` (la misma `Presencia`, más `cerrada`). Al cerrarse la sesión queda `{ sesion, cerrada: true }`.
- Widget de escritorio: `widget/` (Tauri 2). `src-tauri/src/sesiones.rs` lee y filtra esos archivos (comando `leer_sesiones`); el frontend es HTML/CSS/JS sin framework en `widget/src` (`logica.js` puro con tests en `widget/test`, `mascotas.js` y `escena.js` con el dibujo del boceto aprobado, `main.js` la ventana). `equipo.rs` corre `gh` sin consola y `equipo.js` interpreta los comentarios igual que `extraerComentario` del mod; `bandeja.js` dibuja el ícono de la bandeja en RGBA. La CSP es estricta: `style-src` lleva `unsafe-inline` (los SVG traen su `<style>` y `style=`) y `dangerousDisableAssetCspModification: ["style-src"]`, porque si Tauri agrega un nonce a `style-src` el navegador ignora `unsafe-inline` y las mascotas quedan sin animación.
- Responder desde el widget (v0.5): el hook de `tool.call` de `AskUserQuestion` corre el diálogo de Claude (`next(e)`) contra el archivo `~/.claude/oficina/respuestas/<tool_use_id>.json` que escribe el widget (`carreraConDialogo` y `vigilarRespuesta` en `logica.ts`, lectura cada 500 ms). Gana el widget solo con un archivo válido (`validarRespuesta`): todas las preguntas de la llamada, etiquetas existentes o texto libre marcado en `libres`, tocado después de la pregunta. Entonces devuelve `{ result: { questions, answers } }` y deja el archivo como `{ consumida: true }` (el motor no tiene `fs` para borrar; lo borra el widget). La sesión publica `puedeResponder: true`; sin eso el globo es de solo lectura.
- Regla del usuario para responder: el widget nunca decide por él. Solo un clic envía; sin opción por defecto, sin tiempo que elija. Hay tests que lo fijan en `hooks/oficina.test.tsx` y `widget/test/responder.test.js`.
- Modelo de amenaza aceptado: cualquier proceso que corra con el mismo usuario de Windows puede responder una pregunta pendiente escribiendo un archivo válido en `respuestas/` (la misma confianza que la propia máquina).
- `$.tool.call` con `answers` lo rechaza el motor ("that is $.ui.ask"): no usarlo para responder.
- Instalador del widget (#5): `npm run tauri build` en `widget/` arma el `.msi` (WiX, en español) y el `.exe` (NSIS, por usuario) en `widget/src-tauri/target/release/bundle/`. "Arrancar con Windows" usa `tauri-plugin-autostart`, viene apagado y solo cambia con el clic del usuario en la bandeja; la marca sale de `is_enabled()` (`arranque.rs`).
- Tamaño del widget: la ventana sigue al contenido (`#contenido` con `width: max-content`, ResizeObserver, `tamano.js` calcula y `ajustar_ventana` aplica); `resizable: false` y el estado guardado es solo la posición. El tamaño es un zoom escalonado en `<html>` de 100 % a 200 % (pasos de 25): `preferencias.rs` decide el paso (`paso`), lo guarda en `preferencias.json` (migra "normal" → 100, "grande"/"muy grande" → 200) y arma el submenú; Ctrl +/−/0 llaman a `cambiar_tamano`. `tauri-plugin-single-instance` va primero en el builder: una sola Oficina por identificador (`studio.quintech.oficina`), así la versión instalada y la de desarrollo cuentan como la misma.
- Línea de Claude (`animoSesion`/`textoActividad`): 1) pregunta propia pendiente → "te hace una pregunta"; 2) algún subagente trabajando → "coordinando el equipo"; 3) `actividad` "esperándote" (el mod lo pone al terminar el turno) → "esperando tu mensaje", despierto; 4) la actividad tal cual. Un subagente listo o fallado se duerme después de 6 s (`durmiendo`).
- Ícono (boceto `iconos.html`, opción B "Ficha ámbar"): la grilla de 16 vive en `widget/src/bandeja.js` (bandeja a 32 px, con la cuenta en una pastilla oscura). Para regenerar los íconos de la app: `node scripts/icono.mjs <png>` y `npx tauri icon <png> -o src-tauri/icons` dentro de `widget/`, y borrar `android/`, `ios/`, `Square*` y `StoreLogo`.
- Sala del widget (boceto `notebook.html`, opción A): un piso por sesión, cada agente en su silla y escritorio con notebook; hasta 4 subagentes y el resto "+n". `sala.js` decide ánimo dibujado ("comiendo tokens" y "editando" se dibujan escribiendo), pantalla de la notebook y lugar de cada uno.
- Integrantes: Quintana = `nicoequintana`, Campos = `NCsolucionesdigitales` (ambos owners de la organización `quintechlab`).
- Archivos: `hooks/register.tsx` (hooks y panel), `hooks/logica.ts` (funciones puras), `hooks/oficina.test.tsx` (tests), `types/index.d.ts` (contrato de datos y estado).

## Decisiones tomadas con el usuario

- Diseño de la ficha: **opción A**, cabecera en SVG (avatar con iniciales, nombre, estado, desde cuándo) y secciones de texto con marcador `▍` (Proyecto, Tarea, PR, Último commit), separadas por líneas en blanco. Se eligió sobre una ficha entera en SVG para que el texto largo se parta y se pueda copiar.
- **No mostrar tiempo restante** calculado desde el talle. El talle (S: hasta medio día, M: hasta 2 días) es un tope del acuerdo de trabajo, no una estimación; restarlo daba números engañosos. `restante()` sigue en `logica.ts` por si algún día el tablero tiene un campo "Estimado".
- Los datos van en un repositorio privado aparte para que el repositorio público no exponga nombres de proyectos de clientes.
- **Una entrada por sesión** (v0.3.0). Con un solo estado por persona, cada sesión abierta pisaba a las otras: la del playbook (fuera de un repositorio) borraba la del CRM. Ahora cada sesión reemplaza solo su entrada, al cerrarse saca solo la suya, y el panel elige la principal con `elegirPrincipal` (activa, en repo, con tarea, más reciente). `/oficina fuera` es de la persona (`ausente`), no de una sesión.
- `$.store` es de la máquina y lo comparten todas las sesiones: lo propio de cada sesión (hora de inicio, tarea fijada) se guarda indexado por id de sesión.
- La cabecera SVG lleva solo lo que casi no cambia (avatar, nombre, estado). El tiempo ("desde, lleva") va en una línea de texto: si va adentro, el SVG se recarga cada minuto y mientras carga la superficie muestra el `alt`.
- El aviso de choque cuenta también archivos sin commitear (`git status --porcelain`).
- Tipografías: las de marca (Manrope, Barlow, Source Serif) no se instalan en las máquinas; el SVG usa Segoe UI con fallback.

## Lo que aprendimos de las superficies (no repetir errores)

- La superficie `vscode` **ignora** `margin`, `padding`, `gap`, `size` y `weight` de Box/Text y no respeta `flexDirection="row"`: apila. El aire se hace con líneas ` `, sangría con ` ` y un SVG que dibuja su propio fondo.
- En `terminal` la tabla de elementos expone `Svg` pero lo dibuja vacío: decidir por `e.surface !== 'terminal'`, nunca por `'Svg' in tabla`.
- La sesión que abre la app de escritorio llega al motor como SDK (`isInteractive: false`): no condicionar nada a `isInteractive`.
- `desktop` no tiene `Image`: los avatares son SVG con iniciales.
- Para probar un render en tests: responder `clock.now` con `on('clock.now', () => ({ value }))`, y en `desktop` buscar la cabecera por `ui.find({ type: 'Svg' })?.props.alt`.

## Cómo publicar un cambio

1. Editar, luego `claude plugin validate .` y `claude plugin test .` (11 tests). Tipos: `tsc` con el `tsconfig` que indica el encabezado de `.claude-plugin/types/claude-code/index.d.ts`, fuera de la carpeta.
2. Subir `version` en `.claude-plugin/plugin.json` (sin eso `claude plugin update` no ve el cambio).
3. Commit convencional en español, sin atribución de IA, y `git push origin main`.
4. En cada máquina: `claude plugin marketplace update quintech`, `claude plugin update oficina`, y `/reload-plugins` en la sesión.

## Pendientes

- Campos instala el mod y se prueba con los dos conectados.
- Probar desde un repositorio con rama `feat/N-slug` para ver tarea y talle reales.
- Auto-actualización diaria del mod (correr los dos comandos de update al arrancar, una vez por día, y avisar con toast): propuesta, sin decidir.
- Campo "Estimado" en el tablero si se quiere un "cuánto falta" de verdad.
- Sin verificar: qué hace el diálogo de Claude cuando el widget responde primero (no se intenta cerrarlo).
- El playbook del equipo todavía nombra la organización como `QuintechLabs`; la real es `quintechlab`.

## Reglas

- Español en código, comentarios, commits y documentación; identificadores sin tildes ni ñ.
- Nunca guardar credenciales: el mod usa el `gh` autenticado de cada máquina.
- Sin `Co-Authored-By` ni atribución de IA en commits.
