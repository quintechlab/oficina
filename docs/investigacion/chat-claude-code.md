# Chat de Avis con una sesión real de Claude Code, sin terminal (#22)

Investigación del 23/11/2026 contra Claude Code 2.1.330 en la máquina de Quintana (Windows 11). Fuentes: `claude --help` completo y dos procesos reales con `--model haiku` (5 turnos en total, unos USD 0,09). Cada punto dice si es **medido** (visto en esta máquina) o **supuesto** (leído en la ayuda o deducido, sin probar).

Las pruebas corrieron en un directorio temporal fuera del repo (`C:\Users\Nico\AppData\Local\Temp\tmp.PJQDlpKTQF`), con un driver en Node que lanza `claude`, escribe una línea JSON por mensaje en stdin y anota cada línea de stdout con su tiempo (`driver.mjs`, registros `e1.log` y `e2.log`).

- **E1**: sesión nueva, 3 turnos en el mismo proceso, `--allowedTools Read,Glob,Grep` sin `--permission-mode`, interrupción enviada antes de que el turno arrancara.
- **E2**: `--resume` de la sesión de E1, `--permission-mode manual --tools Read,Glob,Grep`, un PDF adjunto como bloque `document`, otro PDF fuera del cwd leído con Read, interrupción con el texto ya saliendo, y el mod "oficina" apagado con `--settings`.

## 1. Protocolo stream-json

Comando base (medido):

```
claude -p --input-format stream-json --output-format stream-json --verbose \
  --include-partial-messages --replay-user-messages --model <modelo> …
```

`--verbose` es obligatorio con `stream-json` de salida (supuesto: así lo documenta Claude Code; no se probó sin él).

### Entrada: una línea JSON por mensaje de usuario (medido)

```json
{"type":"user","message":{"role":"user","content":"Respondé solo la palabra OK."}}
```

`content` acepta también un arreglo de bloques de la API (ver sección 4 para el PDF):

```json
{"type":"user","message":{"role":"user","content":[{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"JVBERi0…"}},{"type":"text","text":"¿Qué dice el PDF?"}]}}
```

### Varios turnos en el mismo proceso (medido)

Sí. El proceso queda vivo mientras stdin siga abierto: se manda un mensaje, se espera su `result` y se manda el siguiente. En E1 fueron 3 turnos en el mismo proceso, con el mismo `session_id` y el contexto compartido. Cada turno vuelve a emitir un `system/init`. Al cerrar stdin el proceso termina solo, 2 a 6 s después.

Un mensaje enviado mientras hay un turno en curso queda en cola (la respuesta de la interrupción trae `still_queued: []`). En E1 el tercer mensaje tardó unos 10 s en arrancar (del envío al `init`) después de un `result`: el proceso todavía estaba cerrando el turno anterior (post_turn_summary, hooks).

### Salida: orden de un turno (medido, recortado)

1. Al arrancar el proceso, `system/hook_started` y `system/hook_response` de cada hook `SessionStart` del usuario (caveman, Engram y otros), con su `output`.
2. `system/init`, una vez por turno:

```json
{"type":"system","subtype":"init","cwd":"C:\\…\\trabajo","session_id":"d7e77911-7651-4158-880a-2b8f555368da","model":"claude-haiku-5-5","permissionMode":"bypassPermissions","apiKeySource":"none","claude_code_version":"2.1.330","output_style":"Gentleman","tools":["Bash","Glob","Grep","Read","Write","mcp__engram__…"],"mcp_servers":[{"name":"engram","status":"connected","source":"user"}],"plugins":[{"name":"engram","source":"engram@engram","version":"0.1.14"},{"name":"oficina","source":"oficina@quintech","version":"0.9.0"}],"startup_timing":{"entrypoint":"claude-desktop", …}}
```

3. `system/status` `{"status":"requesting"}`.
4. Con `--replay-user-messages`, el eco del mensaje: `{"type":"user","message":{…},"session_id":"…","uuid":"…","timestamp":"…","isReplay":true}`. Sirve para confirmar que el mensaje entró.
5. Con `--include-partial-messages`, los eventos crudos de la API envueltos en `stream_event`:

```json
{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"OK"}},"session_id":"…","parent_tool_use_id":null,"uuid":"…","api_message_id":"msg_011Ch…"}
```

   También `message_start`, `content_block_start` (`text` o `thinking`), `content_block_stop`, `message_delta` y `message_stop`. El pensamiento llega vacío (`"thinking":""` con firma) y además como `system/thinking_tokens` con `estimated_tokens`: se puede mostrar "pensando…" pero no el texto.
6. `assistant` con el mensaje completo de cada bloque (un `assistant` por bloque: thinking, text o tool_use):

```json
{"type":"assistant","message":{"model":"claude-haiku-5-5","id":"msg_011ChLYpLG…","role":"assistant","content":[{"type":"tool_use","id":"toolu_019wD4…","name":"Read","input":{"file_path":"C:\\…\\nota.txt"}}],"usage":{…}},"parent_tool_use_id":null,"session_id":"…"}
```

7. El resultado de la herramienta vuelve como `user` con `tool_result` y un `tool_use_result` estructurado:

```json
{"type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_019wD4…","type":"tool_result","content":"1\tLa clave secreta es MANZANA-42.\n2\t"}]},"parent_tool_use_id":null,"tool_use_result":{"type":"text","file":{"filePath":"C:\\…\\nota.txt","numLines":2}}}
```

8. Extras que aparecieron: `system/task_summary` (`"detail":"Reading nota.txt"`, una línea legible de lo que hace), `system/post_turn_summary` (`status_category`, `status_detail`, `needs_action`), `rate_limit_event` (uso de la ventana de 5 h y de 7 días), `system/ui_status` con `"plugin":"oficina"` (la UI del mod se filtra al stream).
9. `result`, el cierre del turno:

```json
{"type":"result","subtype":"success","is_error":false,"result":"La clave es **MANZANA-42**. …","session_id":"d7e77911-…","num_turns":4,"duration_ms":11585,"duration_api_ms":17424,"total_cost_usd":0.0164,"stop_reason":"end_turn","terminal_reason":"completed","permission_denials":[],"usage":{"input_tokens":6,"output_tokens":841,"cache_read_input_tokens":181906,"cache_creation_input_tokens":14770},"modelUsage":{"claude-haiku-5-5":{"costUSD":0.0164,"contextWindow":1000000, …}}}
```

Tiempos medidos: `init` a los 7 a 8 s de lanzar el proceso (hooks, MCP, plugins) y primera respuesta a unos 18 s. Un "OK" costó USD 0,011 porque el contexto inicial del usuario (CLAUDE.md global, estilo, hooks, herramientas MCP) suma unos 56 000 tokens.

## 2. Continuar una conversación

- **`--resume <session_id>`** (medido): E2 retomó la sesión de E1 en un proceso nuevo, con el **mismo** `session_id`, y recordó la clave leída en E1. Es la vía para el chat de Avis: guardar el `session_id` del `init` o del `result` y lanzar con `--resume`.
- **`--fork-session`** con `--resume` crea un id nuevo a partir de la conversación (supuesto, según la ayuda).
- **`--continue`** retoma "la conversación más reciente del directorio actual" (supuesto, según la ayuda). No conviene: depende del cwd y puede tomar una sesión que el usuario abrió en la terminal.
- **`--session-id <uuid>`** fija el id desde el arranque (supuesto, según la ayuda). Permite que Avis conozca el id antes del `init`.
- **`--no-session-persistence`** no guarda nada y no se puede retomar (supuesto, según la ayuda).
- **Transcripción** (medido): `%USERPROFILE%\.claude\projects\<cwd con \ : . y _ cambiados por ->\<session_id>.jsonl`. Ejemplo: `C--Users-Nico-AppData-Local-Temp-tmp-PJQDlpKTQF-trabajo\d7e77911-….jsonl` (157 líneas, 613 KB tras 5 turnos; incluye los PDF en base64). Arranca con `{"type":"session-owner",…}`. Al estar en el mismo lugar que las sesiones de la terminal, aparece en `claude --resume` (supuesto).

## 3. Permisos en modo headless

### Riesgo medido: la configuración del usuario manda si no se fija el modo

`~/.claude/settings.json` de Quintana tiene `"defaultMode": "bypassPermissions"`. En E1, sin `--permission-mode`, el `init` dijo `"permissionMode":"bypassPermissions"` y **`--allowedTools Read,Glob,Grep` no frenó nada**: el modelo creó `salida.txt` con Write y corrió `echo hola` con Bash. `--allowedTools` solo agrega permisos; no restringe.

### Lo que sí restringe (medido en E2)

`--tools Read,Glob,Grep` saca las demás herramientas del modelo. El `init` listó solo `["Glob","Grep","Read"]` (más las MCP) y el intento de Write volvió como error de herramienta:

```json
{"type":"tool_result","content":"<tool_use_error>Error: No such tool available: Write. Write is disabled for this session, in subagents as well as here.</tool_use_error>","is_error":true}
```

`--permission-mode manual` se reporta en el `init` como `"permissionMode":"default"`. Con `--allowedTools Read`, la lectura de un PDF **fuera del cwd** pasó sin pedir permiso: no llegó ningún `control_request` `can_use_tool` (medido).

### Combinación recomendada para "solo responde"

```
--permission-mode manual --tools Read,Glob,Grep --allowedTools Read,Glob,Grep \
--permission-prompts none --strict-mcp-config
```

- `--tools` es la barrera real (medido). Sin Bash ni Write no hay comandos ni escrituras.
- `--permission-mode` explícito pisa el `bypassPermissions` del usuario (medido: `manual` → `default`).
- `--permission-prompts none` deniega solo cualquier cosa que pediría permiso, sin host que conteste (supuesto, según la ayuda). Alternativa: `--permission-prompt-tool stdio` y contestar los `control_request` `can_use_tool` desde Avis; ese camino **no se vio** en las pruebas.
- `--strict-mcp-config` sin `--mcp-config` deja afuera los MCP del usuario (supuesto, según la ayuda). En las pruebas las herramientas de Engram y Context7 estaban disponibles y algunas escriben (por ejemplo `mem_save`).
- `--restricted` (supuesto, según la ayuda) saca las herramientas que corren código, limita las de archivos a los directorios de trabajo e ignora los settings del usuario. Encaja con "solo responde", pero no se probó. Limitar a los directorios de trabajo dejaría afuera un PDF de Descargas: habría que sumar su carpeta con `--add-dir`.

## 4. Adjuntar un PDF

Las dos vías funcionaron con un PDF de una página generado en el scratch (medido en E2):

- **Bloque `document` en stream-json**: `{"type":"document","source":{"type":"base64","media_type":"application/pdf","data":"…"}}` dentro de `content`. El modelo leyó "GIRASOL" sin usar herramientas. No depende de permisos ni de rutas.
- **Ruta en el texto + Read**: el modelo llamó a `Read` con la ruta absoluta (fuera del cwd) y leyó "TORNADO". El resultado vuelve como `tool_result` con `{"type":"text","text":"PDF file read: … (597 bytes)"}` más un bloque `document` en base64.

Recomendado: el bloque `document`, porque no requiere Read ni acceso a la carpeta, y Avis controla el tamaño. Ojo: el PDF queda en base64 dentro de la transcripción. Límite de tamaño y de páginas: sin medir (los de la API son 32 MB y 100 páginas por pedido, supuesto).

## 5. Plugins y el mod "oficina"

- **`-p` carga los plugins del usuario** (medido). El `init` de E1 listó `engram` y `oficina@quintech 0.9.0`. El mod escribió `~/.claude/oficina/sesiones/<session_id>.json` con `"repo":"local/trabajo"`, `"actividad":"esperándote"` y `"puedeResponder":true`, y al cerrar stdin lo dejó en `{"cerrada":true}`. Es decir, la sesión del chat aparece en Avis como una sesión más. Además, como el mod publica la presencia en GitHub, es probable que también salga en el comentario del equipo (supuesto, no se revisó el Issue).
- También corren los hooks del usuario (caveman, Engram, `matar-huerfanos`) y llega el CLAUDE.md global (medido: los `hook_response` y el costo del contexto).
- **Excluir el mod** (medido en E2): `--settings <archivo>` con `{"enabledPlugins":{"oficina@quintech":false}}`. El `init` ya no listó `oficina` y no se tocó su archivo local. Engram siguió cargado.
- **Excluir todo**: `--safe-mode` apaga CLAUDE.md, skills, plugins, hooks, MCP y estilos, con la autenticación normal (supuesto, según la ayuda). `--bare` no sirve con la suscripción: su autenticación es solo `ANTHROPIC_API_KEY` o `apiKeyHelper` (según la ayuda).
- **Marcar en vez de excluir** (supuesto): el mod podría reconocer la sesión del chat si Avis le pasa una señal propia: una variable de entorno de Avis (si el motor la deja leer), `--name avis-chat`, o un id conocido de antemano con `--session-id`. Un dato a tener en cuenta: el `init` dijo `"entrypoint":"claude-desktop"` porque la variable se heredó del proceso padre. Desde el widget no sería así, pero no conviene depender de eso.

## 6. Cancelar un turno desde afuera

- **Mensaje de control por stdin** (medido en E2), con el texto ya saliendo:

```json
→ {"type":"control_request","request_id":"int-1","request":{"subtype":"interrupt"}}
← {"type":"control_response","response":{"subtype":"success","request_id":"int-1","response":{"still_queued":[]}}}
← {"type":"assistant", … "content":[{"type":"text","text":"uno\ndos\ntres\nc"}]}
← {"type":"user","message":{"role":"user","content":[{"type":"text","text":"[Request interrupted by user]"}]}}
← {"type":"result","subtype":"error_during_execution","is_error":true,"terminal_reason":"aborted_streaming","stop_reason":null}
```

  La respuesta llega en menos de 10 ms. El texto parcial queda en un `assistant` y el proceso sigue vivo para el turno siguiente.
- **Interrumpir sin turno en curso** (medido en E1): contesta `success` y no hace nada. El mensaje que estaba en cola se respondió completo igual. Para frenar un turno, mandar la interrupción **después** del `system/init` o de algún `stream_event` de ese turno.
- **Cerrar stdin** (medido): termina el proceso al final del turno, sin cortarlo. El código de salida fue 0 cuando el último turno salió bien y 1 cuando el último `result` era la interrupción.
- **Matar el proceso** (supuesto): en Windows `kill` es TerminateProcess, sin `session.end`. El archivo local del mod quedaría sin `cerrada` hasta que el widget lo descarte por falta de latido (2 min). Usarlo solo como último recurso; mejor primero la interrupción y después cerrar stdin.

## 7. Mediciones de E0 (23/11/2026, Claude Code 2.1.331)

Entrega 0 de `docs/diseno/chat-avis-ux.md`. Mismo método: un driver en Node (`driver.mjs`) en un directorio de `mktemp -d` fuera del repo, que lanza `claude.exe`, escribe una línea JSON por mensaje y anota cada línea de stdout y stderr con su tiempo desde el lanzamiento. Salvo donde se dice, con los argumentos de 7.1 de la dirección y `--model haiku`. 15 procesos, menos de USD 0,15 en total. Las líneas reales quedan en `widget/src-tauri/src/fixtures/chat/*.jsonl` (rutas cambiadas a `usuario`, listas de skills del `init` reemplazadas por las incorporadas, base64 de los adjuntos recortado, sin `startup_timing` y con los fragmentos de `input_json_delta` de cada bloque unidos en el primero, porque partían las rutas a mitad de palabra).

| Fixture | Corrida |
|---|---|
| `turno-texto.jsonl` | configuración final (7.1 con `--safe-mode`), modelo por defecto (Opus), precalentado 15 s, "Respondé solo OK." |
| `turno-imagen.jsonl` | bloque `image` (PNG con la palabra FAROL), precalentado 20 s |
| `turno-herramientas.jsonl` | pensamiento, `Glob`, `Grep` y `Read`, `task_summary`, `tool_result` |
| `frenada.jsonl` | `control_request` `interrupt` 300 ms después del primer `text_delta` |
| `sin-red.jsonl` | `HTTPS_PROXY` a un puerto cerrado (127.0.0.1:9) |
| `sin-red-dns.jsonl` | `HTTPS_PROXY` a un host que no existe (`.invalid`) |
| `tope.jsonl` | `--max-budget-usd 0.0001` |
| `sin-sesion.jsonl` | `CLAUDE_CONFIG_DIR` apuntando a una carpeta vacía |
| `pdf-15mb.jsonl` | bloque `document` de 15 MB |

### 7.1 `--safe-mode` con la suscripción (medido)

- **Funciona con la suscripción:** respondió con `apiKeySource: "none"` (OAuth), con Haiku y con el modelo por defecto (Opus).
- **Achica el contexto 6 veces:** el primer turno escribió 3 314 tokens de caché (más 3 232 leídos) contra 34 752 (más 5 919) con solo `--settings`. Costo de un "FAROL" con Haiku: USD 0,0003 contra 0,0070. Las skills del usuario no se cargan (24 en el `init`, las incorporadas, contra 51).
- **Pero el `init` miente:** con `--safe-mode` solo, el `init` lista los plugins `engram` y `oficina` y `output_style: "Gentleman"`. No corren: el mod no escribió `~/.claude/oficina/sesiones/<id>.json` y el contexto no tiene el estilo (por el tamaño). Con `--safe-mode` **más** `--settings` (7.2) y `--strict-mcp-config`, el `init` queda limpio: `tools: ["Glob","Grep","Read"]`, `mcp_servers: []`, `plugins` solo los incorporados (`cc-plugin-*`), `output_style: "default"`, `permissionMode: "default"`, con el mismo contexto chico.
- **Conclusión:** se usan las tres banderas juntas. `--safe-mode` baja el contexto y el costo; `--settings` y `--strict-mcp-config` dejan el `init` verificable (lo exige la entrega 1: "el `init` … no lista `oficina`"). Corrige 7.1 de la dirección: `--safe-mode` se **suma**, no reemplaza.

### 7.2 `--settings` contra la configuración del usuario (medido)

El `~/.claude/settings.json` del usuario tiene `outputStyle: "Gentleman"`, hooks en `SessionStart` (3), `UserPromptSubmit`, `PreToolUse`, `Stop`, `SubagentStop` y `SessionEnd`, y `engram@engram` y `oficina@quintech` prendidos. Con `--settings` del chat (7.2), sin `--safe-mode`: ninguna línea `system/hook_*` en tres turnos, `output_style: "default"`, sin `engram` ni `oficina` en `plugins` y sin archivo del mod en `sesiones/`. **`--settings` le gana** en `disableAllHooks`, `outputStyle` y `enabledPlugins`.

### 7.3 Lanzar el proceso sin mensaje (D19, medido)

- **No escribe nada ni gasta:** en 15 y 20 s de espera no salió ninguna línea por stdout ni stderr (ni `init`, ni `rate_limit_event`). El primer turno costó lo mismo que en frío (USD 0,0075 precalentado contra 0,0070 en frío, misma pregunta; la diferencia es de caché).
- **El `init` llega recién con el mensaje**, uno por turno, siempre después de mandarlo. Así que Avis no puede saber que el proceso "está listo" antes del primer mensaje: el `listo` es el `init` de cada turno.
- **Tiempos (del envío):**

| | `init` | primer `text_delta` |
|---|---|---|
| Precalentado, Haiku | 0,5 s | 1,6 s |
| Precalentado, Opus (modelo por defecto), primer turno | 0,9 s | 2,0 s |
| Precalentado, Opus, segundo turno | 0,3 s | 1,1 s |
| En frío, `--settings` | 1,4 s | 2,1 s |
| En frío, `--safe-mode` (con y sin `--settings`) | 1,2 a 5,8 s | 1,8 a 6,6 s |

  Los "7 a 8 s" y los "~18 s" de la sección 1 eran con los hooks, los MCP y los plugins del usuario; sin ellos el arranque baja a 1 a 6 s y la primera respuesta llega en unos 2 s. Precalentar sigue ahorrando el arranque (de 1 a 5 s) sin costo.

### 7.4 El `result` sin red (medido con un proxy; no se desconectó la red de la máquina)

- Se simuló con `HTTPS_PROXY` hacia un puerto cerrado y hacia un host inexistente, para no cortar la red de la máquina, que usaban otros procesos.
- **Claude Code reintenta 10 veces antes de rendirse**, con una línea por intento:

```json
{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"retry_delay_ms":611,"error_status":null,"error":"unknown","session_id":"…","uuid":"…"}
```

  El primer intento llega a ~1 s del envío; las esperas crecen (0,6 · 1 · 2 · 4,8 · 8,4 · 19 · 39 · 35 · 35 · 36 s). El `result` llega a los **183 s**. Como entre intentos nunca pasan 120 s, el error `tiempo` de la dirección no salta nunca: sin red, la ventana esperaría 3 minutos.
- **El `result` sin red es `success` con `is_error: true`:**

```json
{"type":"result","subtype":"success","is_error":true,"terminal_reason":"api_error","stop_reason":"stop_sequence","result":"API Error: Connection refused — a firewall or proxy may be blocking it (ECONNREFUSED)","total_cost_usd":0, …}
```

  Antes llega un `assistant` con `"model":"<synthetic>"` y el mismo texto. Con el host inexistente, lo mismo con `result: "API Error: Can't reach the API server — check your internet or DNS (ENOTFOUND)"`, también a los 183 s. stderr vacío en los dos casos. Al cerrar stdin el proceso sale con código 1.
- **Sin sesión de Claude Code** (`CLAUDE_CONFIG_DIR` vacío): también `subtype: "success"`, `is_error: true`, `terminal_reason: "api_error"` y `result: "Not logged in · Please run /login"`, a 1 s y sin `stream_event`.
- **Tope de gasto:** `subtype: "error_max_budget_usd"`, `terminal_reason: "budget_exhausted"`, `errors: ["Reached maximum budget ($0.0001)"]`. La respuesta del turno salió entera antes (el tope se mira al terminar el turno).
- **Frenada:** `subtype: "error_during_execution"`, `terminal_reason: "aborted_streaming"`, `errors: ["[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null"]`; la `control_response` llegó a los 53 ms del envío del `interrupt`.
- **Consecuencia para `evento_de_linea`:** `subtype: "success"` no alcanza para decir `fin`; hay que mirar `is_error`. Y `rate_limit_event` trae `rate_limit_info.status: "allowed"` junto a `overageStatus: "rejected"` (la cuenta no tiene excedente): el límite se lee de `rate_limit_info.status`, nunca de `overageStatus`. Un `rate_limit_event` rechazado no se pudo provocar (supuesto).

### 7.5 El bloque `image` (medido)

`{"type":"image","source":{"type":"base64","media_type":"image/png","data":"…"}}` dentro de `content`, junto a un bloque `text`: el modelo leyó "FAROL" de un PNG de 320 × 120, sin herramientas. JPG, GIF y WebP no se probaron (supuesto: son los mismos tipos de la API).

### 7.6 `--append-system-prompt` (medido)

- Funciona con y sin `--safe-mode`: "¿Cómo te llamás?" → "Me llamo Ascua, la mascota de Avis…", en español rioplatense.
- **Al retomar, el nombre no cambia:** `--resume` de esa charla con el texto de otra mascota ("Brote") respondió "Ascua", también con `--system-prompt-snapshot off`. Con `snapshot` prendido (el valor por defecto) la ayuda dice que el texto del primer pedido se reusa tal cual; y aunque se apague, la charla ya dice "Me llamo Ascua". Apagarlo además pierde la caché (38 541 tokens de caché escritos contra 260). Es decir: **la mascota de una charla es la del primer mensaje**.

### 7.7 El eco con `--session-id` (medido)

- `--session-id <uuid>` fija el id: el `init` y el eco traen ese mismo `session_id` desde el primer turno.
- El eco (`"isReplay": true`) llega después del `init` y del `status`, a 0,6 a 1,1 s del envío, antes del primer `text_delta`. **Repite el contenido entero, base64 incluido:** con el PDF de 15 MB, el eco es una línea de 20 MB por stdout.
- **Repetir un `--session-id` ya usado** falla sin escribir nada en stdout; en stderr: `Error: Session ID <uuid> is already in use.` Por eso, después del primer turno, siempre `--resume`.

### 7.8 Un PDF de 15 MB (medido)

Un PDF de una página con la palabra CEREZO y una imagen al azar sin comprimir, de 15 013 335 bytes (20 017 998 en la línea JSON): respondió "CEREZO", `success`, en 7,8 s, con el mismo costo que uno de 100 KB (USD 0,0073; cuenta las páginas, no los bytes). El eco llegó a los 6,8 s del envío. El techo real no se buscó: 20 MB (D27) queda como margen, sin medir.

### 7.9 Arrastrar archivos con la ventana transparente (leído en el código, sin probar con el mouse)

- **Por qué no se midió:** la Avis instalada estaba abierta (`oficina-widget.exe`) y `tauri-plugin-single-instance` le pasa cualquier segunda instancia (la de desarrollo con un escucha de prueba) a la que corre. Arrastrar desde el Explorador además requiere manejar el escritorio. La prueba con el mouse queda dentro de la aceptación de la entrega 5 ("arrastrar un PDF real funciona", "soltar fuera de la hoja no hace nada").
- **Lo que dice el código** (versiones del `Cargo.lock`: wry 0.57.3, tao 0.37.3):
  - wry registra su propio `IDropTarget` (`RegisterDragDrop`) en la ventana del webview y en sus hijas, y apaga el de WebView2 (`SetAllowExternalDrop(false)`): por eso no llegan los `drop` de HTML. La posición sale con `ScreenToClient`, en px físicos relativos a la ventana (`webview2/drag_drop.rs`).
  - `set_ignore_cursor_events(true)` pone `WS_EX_TRANSPARENT | WS_EX_LAYERED` (`window_state.rs`). Windows salta esas ventanas al buscar el destino de un arrastre: fuera de la zona, el archivo cae en lo que haya debajo y Avis no recibe nada; dentro de la zona (Rust ya apagó el ignorar), llegan `enter`, `over`, `drop` y `leave`.
  - `dragDropEnabled` no está en `tauri.conf.json`, así que queda prendido (el valor por defecto).
- **Supuesto que queda:** que el sondeo de Rust siga cambiando la zona mientras el mouse arrastra (Windows mantiene el arrastre en un bucle modal del proceso que arrastra, no del widget, así que el sondeo debería seguir).

### 7.10 `--session-id` de un proceso precalentado (medido en E1, 23/11)

Un proceso lanzado con `--session-id <uuid>` y cerrado sin mandarle nada (stdin cerrado a los 3 s, salió con código 0) no reserva el id: un segundo proceso con el mismo `--session-id` respondió el turno (`init` a 1,4 s, `result` `success`, Haiku). Así que una sesión cuenta como usada recién con su primer `init` o eco, y hasta entonces se relanza con `--session-id`, no con `--resume`.

Con `chat.rs` y el `claude` real (`cargo test real_ -- --ignored`, Haiku): precalentado 3 s, el primer `texto` llegó a 4,0 s del envío (con pensamiento); frenar con ese texto dio `frenada` y el turno siguiente, en el mismo proceso, respondió "Ascua" (la mascota del primer mensaje).

### 7.11 Retomar después de cerrar Avis, y Engram (medido en E4, 24/11)

- **Retomar recuerda lo hablado (medido, Haiku):** un `Chat` mandó "Mi color favorito es el turquesa", se apagó, y otro `Chat` nuevo (como otro arranque de Avis), con la sesión leída del archivo del historial, abrió con `--resume <sesión>` y a "¿Cuál es mi color favorito?" respondió "Turquesa." El `init` del turno retomado trae la misma `session_id`. Test: `real_retomar_despues_de_cerrar_avis_recuerda_lo_hablado`.
- **`--resume` de una sesión que Claude Code ya no tiene (medido):** sale enseguida con código 1, stderr "No conversation found with session ID: …" y una sola línea en stdout: `result` `error_during_execution`, `is_error: true`, sin `terminal_reason`, con el texto en `errors` (no en `result`). Costo 0. Fixture `sin-conversacion.jsonl`. Rust la marca (`sesion_perdida`) y la próxima vez empieza una sesión nueva: lo hablado sigue en el historial de Avis, pero Claude Code ya no lo recuerda.
- **Engram 3.7.2, contra un `engram serve 7499` aparte** (`ENGRAM_DATA_DIR` propio en un temporal; contra el del usuario, solo `GET /health`). Las respuestas que usa el falso de `engram_tests.rs`:
  - `POST /sessions` → `201 {"id","status":"created"}`; repetirlo con el mismo id también da `201`. `POST /sessions/{id}/end` con `{}` → `200 {"status":"completed"}`, y una sesión terminada sigue aceptando observaciones.
  - `POST /observations` → `201 {"id":N,"status":"saved"}`; con una sesión que no existe, `404 {"error":"session not found"}`; la misma `operation_id` con otro contenido, `409 {"error":"observation operation id conflicts with a different payload"}`. El mismo `topic_key` actualiza la misma observación (`revision_count` sube).
  - `GET /observations/save-result?operation_id=…` → `200 {"id":N,"status":"committed"}`, o `404 {"code":"observation_save_result_not_found",…}`.
  - `GET /search?q=…&project=avis&type=conversation&response_format=compact` → `{"result":"Found 1 memories.","results":[{id,title,topic_key,preview,…}]}`; sin nada, `"results":[]`.
  - `GET /context?project=oficina` con una observación de `oficina` y la charla en `avis`: lista solo la de `oficina` (test `real_engram_guardar_buscar_sin_tocar_otro_proyecto_y_borrar`). Con un proyecto que no existe: `404 {"code":"unknown_project","available_projects":[…]}`.
  - `DELETE /observations/{id}?expected_project=oficina` sobre una de `avis` → `409 {"error":"expected_project does not match observation owner"}`; con `avis` → `200 {"hard_delete":false,"status":"deleted"}`. Borrada (sin `hard`), deja de aparecer en `/search` y `GET /observations/{id}` da `404`. Guardar después el mismo `topic_key` crea otra observación (otro id).

### 7.12 Adjuntos por la vía de la ventana (medido en E5, 24/11)

- **Un PDF real por `chat_enviar` (medido, Haiku):** un `Chat` recibió la ruta de un PDF de una página con la palabra CEREZO, armado en el test con su tabla xref (`adjuntos::pdf_minimo`). Rust lo leyó y lo mandó como bloque `document` en base64, sin herramientas. Respondió "CEREZO" en 3,7 s, con `listo`, `pidiendo`, `recibido`, `texto` y `fin`. Test: `real_un_pdf_adjunto_se_lee`.
- **Un `.md` sin nada escrito (medido, Haiku):** en el mismo proceso, un segundo turno solo con el archivo (sin bloque de texto vacío, que la API no acepta) llegó como "Archivo: clave.md" y el contenido en una cerca. La respuesta citó "ALMENDRO", la palabra del archivo.
- **La línea de stdin con dos archivos** (proceso falso de PowerShell que la guarda): el `document` con el base64 exacto del PDF y el `text` "Archivo: notas.md\n```md\n# Notas\n```", sin un tercer bloque de texto.
- **Arrastrar con el mouse: sin medir.** La Avis instalada sigue ocupando la instancia única y arrastrar desde el Explorador requiere manejar el escritorio. El camino de la ventana (`onDragDropEvent` → `sobreHoja` → `chat_adjunto`) se probó en Edge sin ventana con el arrastre de Tauri imitado (`dev/falso.js`, `window.__arrastrar`); el resto es lo leído en 7.9.
- **Supuestos que quedan:** JPG, GIF y WebP (el tipo sale de los primeros bytes, no del nombre) y el techo real del PDF (20 MB, D27).

## Flags recomendados para Avis

Actualizado con las mediciones de E0 (7.1):

```
claude -p --input-format stream-json --output-format stream-json --verbose
  --include-partial-messages --replay-user-messages
  --permission-mode manual --tools Read,Glob,Grep --allowedTools Read,Glob,Grep
  --permission-prompts none --safe-mode --strict-mcp-config
  --settings <config>/chat/ajustes.json
  --append-system-prompt <instrucción con la mascota>
  --max-budget-usd 2
  ( --resume <session_id> | --session-id <uuid nuevo> )
```

Lanzar con `Command::new` y la búsqueda de `claude.exe`/`claude.cmd` que ya tiene `primeros_pasos::ruta`, sin consola, con el cwd de la conversación. Leer stdout línea a línea y mantener stdin abierto mientras el chat esté abierto.

## Riesgos

1. **`bypassPermissions` del usuario** (medido): si se olvida `--permission-mode` o `--tools`, el chat puede escribir y correr comandos.
2. **MCP con escritura**: sin `--strict-mcp-config`, el modelo tiene `mem_save` y otras herramientas MCP del usuario.
3. **Costo y latencia de arranque**: unos 56 000 tokens de contexto y 7 a 8 s hasta el `init` con la configuración completa. Con `--safe-mode` baja a ~6 500 tokens y a 1–6 s (medido en E0, 7.1 y 7.3).
4. **Doble presencia**: sin excluir el mod, el chat aparece como una sesión más en Avis y probablemente en GitHub.
5. **`total_cost_usd` ambiguo** (medido, sin explicar): en E1 parece del turno (0,0112 → 0,0164 → 0,0194) y en E2 parece acumulado (0,0356 → 0,0367 con 5 tokens de salida). No usarlo para mostrar gastos sin medir más.
6. **Transcripción con adjuntos**: los PDF quedan en base64 dentro del `.jsonl` de `~/.claude/projects`.
7. **Ruido en stderr**: siempre salió `Warning: claude.ai MCP servers blocked by enterprise policy: …`. No es un error; no tratar stderr como fallo.

## Preguntas abiertas

- ~~¿El chat debe aparecer en Avis como sesión o quedar afuera?~~ Afuera (dirección 7.2).
- ~~¿`--safe-mode` deja la suscripción funcionando?~~ Sí (7.1 de E0). `--restricted` no se probó.
- ¿`--permission-prompts none` deniega de verdad en `manual`? Con solo `Read`, `Glob` y `Grep` no apareció ningún pedido de permiso en E0, así que sigue sin verse. Cómo es el `control_request` `can_use_tool` con `--permission-prompt-tool stdio`: no se vio.
- ¿Qué tamaño máximo de PDF acepta el bloque `document` por stdin? 15 MB entra (7.8 de E0); el techo no se buscó.
- ~~¿El cwd del chat es un repo o una carpeta propia?~~ Las dos (dirección 3.4).
- ¿Cómo es un `rate_limit_event` rechazado? No se pudo provocar.
