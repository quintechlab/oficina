# Engram para el historial del chat de Avis (#22)

Investigación del 23/11/2026 contra Engram v3.7.2 (el instalado en la máquina de Quintana). Fuentes: `engram --help`, el `README.md` instalado junto al binario y `DOCS.md` + `docs/HTTP-AGENT-WORKFLOWS.md` del repositorio público `Gentleman-Programming/engram` en el tag `v3.7.2`. Cada punto dice si es **medido** (probado en esta máquina) o **documentado** (leído, sin probar).

Las escrituras se probaron solo contra un Engram aparte: `ENGRAM_DATA_DIR` en un directorio temporal propio, puerto 7499, y un segundo con `serve --session-owned`. Contra el Engram real del usuario (127.0.0.1:7437) solo se hizo `GET /health`.

## 1. Detectar si Engram está y corre

- **`GET http://127.0.0.1:7437/health`** es la señal confiable (medido). Responde `200` con `{"status":"ok","service":"engram","version":"3.7.2","instance_id":"…","capabilities":{"isolated_session_registration":true,"root_session_resume":true,"runtime_session_resolution":true}}`. Si la base falla, `500` con `{"error":"health check failed"}` (documentado).
- El puerto sale de `ENGRAM_PORT` (por defecto 7437). Usar un tiempo de espera corto (≈1 s) y tratar cualquier error como "no hay Engram".
- **`engram ps` no sirve para esto** (medido): solo reconoce el daemon de `engram run -d` (con pidfile). En esta máquina el servidor lo lanzó otra cosa y `ps` dice "unmanaged Engram listener on port 7437 (observed owning pid …)" y sale con error. Además corre un proceso y cuesta más que un GET.
- Comprobar que el binario existe (está en `%LOCALAPPDATA%\engram\bin\engram.exe` en esta máquina) solo sirve para decir "Engram instalado pero apagado"; Avis no debería arrancarlo por su cuenta (ver sección 6).

## 2. Endpoints útiles (servidor local `engram serve`)

| Para qué | Método y ruta | Cuerpo / consulta |
|---|---|---|
| Salud | `GET /health` | — |
| Abrir sesión (necesaria antes de guardar) | `POST /sessions` | `{id, project, ownership_mode?, isolated?, resume?, directory?}` → `201 {id, status:"created"}` |
| Guardar observación | `POST /observations` | `{session_id, type, title, content, project?, scope?, topic_key?, operation_id?, capture_prompt?}` → `{id, status:"saved"}` |
| Releer una escritura dudosa | `GET /observations/save-result?operation_id=…` | `404` tipado = nunca se guardó |
| Leer una | `GET /observations/{id}` | `?include_history=true` trae versiones anteriores |
| Últimas | `GET /observations/recent` | `?project=X&scope=…&limit=N` |
| Buscar (FTS5) | `GET /search` | `?q=…&project=X&type=T&scope=S&limit=N&response_format=compact` |
| Editar | `PATCH /observations/{id}?expected_project=X` | `{title?, content?, …}` |
| Borrar | `DELETE /observations/{id}?expected_project=X` | `&hard=true` borra de verdad; si hay `ENGRAM_HTTP_TOKEN`, pide Bearer |
| Cerrar sesión | `POST /sessions/{id}/end` | `{summary}` |

Medido en el Engram aparte:

- `POST /observations` con un `session_id` que no existe → `{"error":"session not found"}`. Hay que registrar la sesión primero.
- `POST /sessions` con `{"id":"avis-chat","project":"avis-prueba","ownership_mode":"project_owned","isolated":true}` → `{"id":"avis-chat","status":"created"}`.
- **`type` es libre**: `"conversation"` y hasta `"cualquiera_x"` se guardaron sin error. La lista de MCP (`decision`, `architecture`, `bugfix`, `pattern`, `config`, `discovery`, `learning`, `preference`) es una guía, no una validación del HTTP.
- **`topic_key` hace upsert**: dos `POST` con el mismo `project + scope + topic_key` devolvieron el mismo `id` y la observación quedó con `revision_count: 2` y el contenido nuevo.
- **`operation_id` es idempotente**: repetir el mismo POST con el mismo `operation_id` devolvió el mismo `id` sin duplicar (documentado: con otro contenido y el mismo id → `409`).
- `GET /search?…&response_format=compact` devuelve `{"result":"Found N memories.","results":[{id, title, type, scope, project, topic_key, preview, truncated, …}]}`; sin `compact`, un arreglo con el `content` completo. Sin resultados: `[]`, nunca `null` (documentado).
- **Lo que se guarda en un proyecto aparece en el contexto de ese proyecto**: `GET /context?project=avis-prueba` listó la conversación en "Recent Observations". Es lo que verán los agentes que trabajen en ese proyecto.
- **`scope: "personal"` cruza proyectos**: `GET /search?q=chau&scope=personal&type=conversation` (sin `project`) encontró la conversación. La documentación lo confirma: personal sin proyecto busca en todos los proyectos.

## 3. Autenticación

- **Servidor común (`engram serve`, el que corre en 7437)**: sin token por defecto (documentado y coherente con lo medido: `/health` respondió sin credenciales). Si el usuario define `ENGRAM_HTTP_TOKEN`, ese token solo protege `DELETE /sessions|observations|prompts/{id}`, `GET /export`, `POST /import` y `POST /projects/rescue-ownership`; **`POST /observations`, `GET /search` y `PATCH` siguen abiertos** (documentado). Avis debería leer `ENGRAM_HTTP_TOKEN` del entorno y, si existe, mandar `Authorization: Bearer <token>` siempre; no cuesta nada y cubre el borrado.
- **`engram serve --session-owned`** (medido): exige `ENGRAM_TOKEN` de 256 bits en hexadecimal (64 caracteres; con otro valor sale con "session-owned serve requires a private 256-bit hex ENGRAM_TOKEN"). Escucha en un puerto al azar y la primera línea de su salida es `{"protocol":"engram-session-owned-v1","endpoint":"http://127.0.0.1:53696","pid":…,"instance_id":…}`. **Todas** las rutas, `/health` incluida, devuelven `401` sin `Authorization: Bearer <token>`. Se apaga solo cuando se cierra su stdin (medido: el puerto quedó libre al cerrarlo).
- El dueño (`expected_project`) en PATCH/DELETE es una comprobación de coherencia, no una autorización (documentado). Cualquier proceso del mismo usuario puede escribir en Engram: el mismo modelo de amenaza que ya acepta Avis con `respuestas/` y `ordenes/`.

## 4. Elegir el proyecto

- Precedencia documentada: `project` explícito en el pedido → `ENGRAM_PROJECT` del proceso servidor → `.engram/config.json` → detección por cwd del servidor. **Avis debe mandar siempre `project` explícito**: el cwd del servidor no es el de Avis y la detección podría caer en cualquier repositorio.
- **No usar `GET /project/current`**: aunque es un GET, en un repositorio git sin enlazar crea un enlace privado en la metadata de git (documentado: "Engram creates a private versioned binding in the repository's shared Git metadata"). Es una escritura.
- Una sesión `project_owned` no puede reusarse con otro proyecto (`409 session_project_conflict`, documentado), así que el id de sesión debe ser propio de Avis.

## 5. Recomendación para Avis

Objetivo: guardar el chat sin que aparezca en `mem_context`/`mem_search` de los proyectos de trabajo.

- **Proyecto dedicado `avis`** para todo lo de Avis. Nunca el proyecto del repositorio donde corre la sesión. Así `mem_context` de `oficina`, `catalogo`, etc. no lo ve (las lecturas sin proyecto se resuelven al proyecto actual; solo `all_projects=true` cruza).
- **`scope: "project"`, nunca `personal`** (medido: personal se mezcla en búsquedas de cualquier proyecto). Tampoco `global`.
- **Sesión**: una por arranque del widget, `POST /sessions {id:"avis-<id de arranque>", project:"avis", ownership_mode:"project_owned", isolated:true}`. Enviar `isolated` solo si `/health` trae `capabilities.isolated_session_registration: true` (documentado: servidores viejos lo ignoran). Cerrarla con `POST /sessions/{id}/end` al salir; si no llega a cerrarse no pasa nada grave.
- **Conversación**: una observación por conversación, actualizada con upsert.
  - `type: "conversation"` (propio de Avis; ningún agente lo filtra ni lo pide).
  - `topic_key: "avis/chat/<id de la conversación>"` y `title: "Chat de Avis · <fecha> · <primeras palabras>"`.
  - `content`: la conversación en texto (`Usuario: …` / `Avi: …`), o un resumen si es larga. Engram recorta el contenido al límite configurado (documentado; el valor por defecto no se midió), así que **el archivo en la PC es la fuente de verdad** y Engram es la copia buscable.
  - `capture_prompt: false` (para que no guarde además un prompt suelto) y un `operation_id` nuevo por cada guardado (`avis-<conversacion>-<n>`), para que un reintento no duplique.
  - No usar `POST /prompts`: los prompts son "lo que pidió el humano a un agente" y se cuelan en el contexto.
- **Memoria** (algo que el usuario le pidió a Avis recordar): `type: "preference"` (o `"learning"` si es un dato), `project: "avis"`, `scope: "project"`, `topic_key: "avis/memoria/<slug>"` para que corregirla la actualice en lugar de duplicarla.
- **Leer**: `GET /search?q=…&project=avis&type=conversation&response_format=compact&limit=10` para listar, y `GET /observations/{id}` para traer una completa. Para "lo último": `GET /observations/recent?project=avis&limit=N`.
- **Dónde va el código**: en Rust (`ureq` ya está en `Cargo.toml`), no en la ventana: la CSP tiene `connect-src: ipc: http://ipc.localhost` y un `fetch` a 127.0.0.1:7437 desde el webview sería bloqueado.
- **Reintentos**: si un POST falla por red o da `500`, no repetirlo a ciegas: consultar `GET /observations/save-result?operation_id=…`; solo un `404` con `code:"observation_save_result_not_found"` autoriza reenviarlo igual (documentado).

## 6. Lo que Avis no debería hacer

- Arrancar, frenar o reiniciar el Engram del usuario (`engram run/stop/restart`). Si `/health` no responde, guardar solo en la PC y mostrarlo así.
- Usar `engram save` por línea de comandos: abre la base directamente y depende del cwd/`ENGRAM_PROJECT`; el HTTP es más predecible y no corre procesos.
- Levantar su propio `serve --session-owned` sobre la base real del usuario: escribiría en `~/.engram` en paralelo con el servidor existente. Si hiciera falta, solo con un `ENGRAM_DATA_DIR` propio, y entonces ya no es "la Engram del usuario".
- Borrar o editar observaciones que no creó Avis (todas las de Avis llevan `project: "avis"` y `topic_key` con prefijo `avis/`).

## Pendiente de verificar

- El límite de tamaño de `content` por defecto y qué devuelve el HTTP cuando recorta (MCP avisa `truncated`; el HTTP no se probó con textos largos).
- Si un proyecto `avis` nuevo aparece en las listas de proyectos que usan los agentes (`mem_current_project` con `available_projects`) y molesta en alguna pregunta de ambigüedad.
- Qué pasa si el servidor real tiene `ENGRAM_HTTP_TOKEN` y Avis no lo tiene en su entorno (lo lanza Windows al iniciar, no la terminal del usuario).
