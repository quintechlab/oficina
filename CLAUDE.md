# Contexto para el agente

Mod de Claude Code "oficina": panel de presencia del equipo Quintech Studio. Leer `README.md` primero; este archivo guarda lo que el código no dice.

## Qué es y dónde vive

- Código: este repositorio, público, `quintechlab/oficina`. Marketplace en `.claude-plugin/marketplace.json`; se instala con `/plugin install oficina --marketplace quintechlab/oficina`.
- Datos: Issue #1 "Presencia" del repositorio **privado** `quintechlab/oficina-datos`. Cada integrante tiene un comentario propio con un JSON (`<!-- oficina:presencia -->`), formato v2: `{ v: 2, usuario, nombre, ausente, actualizado, sesiones: Presencia[] }`, una entrada por sesión de Claude Code abierta, identificada por `$.session.id()`. El mod lo edita, nunca crea comentarios nuevos. No editar a mano. El formato v1 (un solo estado, versiones 0.1 y 0.2) se sigue leyendo como una sola sesión.
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
- El playbook del equipo todavía nombra la organización como `QuintechLabs`; la real es `quintechlab`.

## Reglas

- Español en código, comentarios, commits y documentación; identificadores sin tildes ni ñ.
- Nunca guardar credenciales: el mod usa el `gh` autenticado de cada máquina.
- Sin `Co-Authored-By` ni atribución de IA en commits.
