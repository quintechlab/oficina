# Modelo local para el chat de Avis (Issue #22)

Investigación de escritorio hecha el 23/11/2026. No se descargó ni se corrió nada. Cada número indica si es **dato de ficha**, **calculado** (a partir de la configuración publicada) o **estimado** (cuenta propia, sin medir).

## 1. Punto de partida

- Hardware medido: NVIDIA GTX 1650 Ti 4 GB (Turing, sin núcleos tensor), 16 GB de RAM, Ryzen 7 4800H.
- Ancho de banda de la GPU: 192 GB/s (GDDR6, 128 bits). Es el valor nominal; depende del límite de potencia de la notebook. Fuentes: [NVIDIA, comparativa serie 16](https://nvidia.com/en-au/geforce/gaming-laptops/compare-16-series), [howmanyfps](https://howmanyfps.com/graphics-cards/geforce-gtx-1650-ti-mobile).
- Hoy (`widget/src-tauri/src/modelo.rs`): `Qwen3-4B-Instruct-2507-Q4_K_M.gguf` de unsloth (commit fijo), llama.cpp b12606 CUDA 12.4, y `llama-server` con `-c 4096 -np 1 -ngl 99`, **sin `--jinja`**, sin `-fa` y con la caché KV en f16.

### Contradicciones con el pedido (avisadas, no corregidas)

1. El pedido supone un contexto de 8k; el código usa **4096** (`argumentos`, línea ~352). Pasar a 8k con el modelo actual y la caché KV en f16 llega a unos 4,0 GB (ver tabla): no entra entero en 4 GB.
2. Para usar herramientas, `llama-server` necesita `--jinja` ([docs de llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)). Hoy no se pasa ese argumento.
3. La misma página advierte que cuantizar mucho la caché KV (por ejemplo `-ctk q4_0`) puede degradar bastante las llamadas a herramientas. Con `q8_0` el riesgo es menor, pero no está medido.

## 2. Candidatos

La caché KV a 8k se calcula así: capas con atención completa × cabezas KV × dimensión de cabeza × 2 (K y V) × 2 bytes (f16) × 8192.
La VRAM total estimada suma los pesos, la caché KV y unos 0,4 GB de búferes de cómputo y del contexto CUDA. El margen de 0,4 GB también es una estimación.

| Modelo (GGUF Q4_K_M) | Disco Q4_K_M / Q5_K_M / Q8_0 | KV 8k f16 (calculado) | VRAM 8k (estimado) | tok/s generación (estimado) | Español (dato de ficha) | Herramientas | Licencia |
|---|---|---|---|---|---|---|---|
| **Qwen3-4B-Instruct-2507** (línea base) | 2,5 / 2,89 / 4,28 GB | 1,21 GB (36 capas × 8 × 128) | ~4,1 GB: no entra; ~3,5 con KV q8_0 o con 4k | 35–50 | MMLU-ProX 61,6 · INCLUDE 60,1 · MultiIF 69,0 | BFCL-v3 61,9 · formato Hermes (nativo en llama.cpp) | Apache-2.0 |
| **Qwen3.5-4B** | 2,74 / 3,14 / 4,48 GB | 0,27 GB (8 de 32 capas con atención completa × 4 × 256) + ~0,05 GB de estado DeltaNet | ~3,4 GB | 30–45 (kernels DeltaNet en Turing: sin datos) | MMMLU 76,1 · 201 idiomas | BFCL-V4 50,3 (escala distinta de v3) · formato `qwen3_coder` (XML) | Apache-2.0 |
| **Gemma 4 E4B-it** | 4,98 / 5,48 / 8,19 GB | ~0,25 GB (7 capas globales; las de ventana deslizante guardan 512 tokens; 18 capas comparten KV) | no se sabe: el archivo pesa más que la VRAM; depende de si llama.cpp deja la tabla de embeddings por capa en RAM | 25–40 si entra; 8–15 con descarga parcial | MMMLU 76,6 · 35+ idiomas | Nativo según la ficha · tau2 42,2 · sin BFCL publicado | Apache-2.0 |
| **Phi-4-mini-instruct** (3,8B) | 2,49 / 2,85 / 4,08 GB | 1,07 GB (32 × 8 × 128) | ~4,0 GB: no entra; ~3,4 con KV q8_0 | 35–50 | MMLU multilingüe 49,3 (el más bajo) · español en la lista | Tokens `<\|tool\|>` · llama.cpp usa el formato "Generic" · la ficha advierte que inventa nombres de funciones | MIT |
| **Granite 4.1 3B** (abril 2026) | 2,1 / 2,44 / 3,62 GB | 0,67 GB (40 × 8 × 64) | ~3,2 GB | 40–60 | MMMLU 57,6 · español en la lista | BFCL-v3 60,8 · esquema OpenAI · ejemplo nativo en las docs de llama.cpp | Apache-2.0 |
| Qwen3.5-2B (de reserva) | 1,28 / — / 2,01 GB | ~0,13 GB | ~1,9 GB | 60–90 | MMMLU 56,9 sin razonamiento | BFCL-V4 43,6 | Apache-2.0 |

Fuentes de la tabla (fichas oficiales y GGUF de unsloth):
- Qwen3-4B-2507: [unsloth/Qwen3-4B-Instruct-2507-GGUF](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF)
- Qwen3.5-4B: [unsloth/Qwen3.5-4B-GGUF](https://huggingface.co/unsloth/Qwen3.5-4B-GGUF) y [config.json](https://huggingface.co/Qwen/Qwen3.5-4B/raw/main/config.json)
- Gemma 4 E4B: [unsloth/gemma-4-E4B-it-GGUF](https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF) y [config.json](https://huggingface.co/google/gemma-4-E4B-it/raw/main/config.json)
- Phi-4-mini: [unsloth/Phi-4-mini-instruct-GGUF](https://huggingface.co/unsloth/Phi-4-mini-instruct-GGUF) y [config.json](https://huggingface.co/microsoft/Phi-4-mini-instruct/raw/main/config.json)
- Granite 4.1 3B: [unsloth/granite-4.1-3b-GGUF](https://huggingface.co/unsloth/granite-4.1-3b-GGUF) y [config.json](https://huggingface.co/ibm-granite/granite-4.1-3b/raw/main/config.json)
- Qwen3.5-2B: [unsloth/Qwen3.5-2B-GGUF](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF)
- Soporte de herramientas en llama.cpp: [docs/function-calling.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md)

### Cómo leer la tabla

- **Generación (tok/s), estimado.** La cuenta es 192 GB/s ÷ tamaño de los pesos × una eficiencia del 60–75 %. No hay una medición publicada con esta GPU y estos modelos. Como referencia externa, también estimada, [llmrun.dev](https://llmrun.dev/gpu/gtx-1650) da 25,5 tok/s para Qwen3.5-4B Q4_K_M en la GTX 1650 de escritorio (128 GB/s). Escalado a 192 GB/s, eso da unos 38 tok/s.
- **Prefill.** Turing no tiene núcleos tensor, así que procesar un prompt de 3–4k tokens puede llevar varios segundos. No hay datos; hay que medirlo.
- **Benchmarks.** Los publica cada fabricante con su propia configuración. BFCL-v3 y BFCL-V4 no se pueden comparar entre sí. Las cifras de Qwen3.5 son, en principio, con razonamiento activado. Para el chat lo usaríamos sin razonamiento (`enable_thinking: false`), y la ficha no da cifras de 4B en ese modo.
- **Soporte de arquitecturas.** b12606 es muy posterior a la salida de Qwen3.5 (feb–mar 2026) y de Gemma 4 (abril 2026), así que deberían estar soportados. No lo verifiqué contra las notas de esa versión: se confirma con `/props` y con una llamada real.
- **Qwen3.5-4B y visión.** Trae un codificador de visión, pero va en un archivo `mmproj` aparte que no hace falta bajar.

## 3. Recomendación

1. **Qwen3.5-4B Q4_K_M, sin razonamiento: el primero a medir.** Es el sucesor directo del actual y tiene mejor señal multilingüe (MMMLU 76,1). Su caché KV es unas cuatro veces más chica (por la atención híbrida), así que **8k entra holgado en 4 GB sin cuantizar la caché**. Ocupa casi lo mismo en disco (+0,24 GB). Riesgos: que los kernels de Gated DeltaNet sean lentos en Turing, y que el formato de herramientas `qwen3_coder` (XML) se interprete bien en b12606.
2. **Granite 4.1 3B Q4_K_M: el segundo, como opción liviana para herramientas.** Tiene BFCL-v3 60,8, casi igual que la línea base. Es el más chico y rápido de los que mencionan explícitamente el español. Usa el esquema OpenAI y llama.cpp lo documenta como nativo. Lo flojo: MMMLU 57,6 y la calidad conversacional en español sin datos.
3. **Descartados por ahora:**
   - Phi-4-mini: el multilingüe más bajo, la caché KV grande y el formato "Generic".
   - Gemma 4 E4B: el archivo pesa 4,98 GB. Vale la pena solo si una prueba de VRAM muestra que entra; queda como tercer candidato condicional.

## 4. Plan de medición chico

Para todo lo que sigue hay que **descargar primero**, y eso necesita el permiso explícito del usuario. Son tres archivos:
- `Qwen3.5-4B-Q4_K_M.gguf` (2,74 GB)
- `granite-4.1-3b-Q4_K_M.gguf` (2,1 GB)
- la línea base, que ya está instalada

Todo se baja desde las fichas citadas, con el commit fijado y el SHA-256, igual que hoy.

### Muestra: 100 prompts, iguales para los tres modelos

| Bloque | Cantidad | Contenido |
|---|---|---|
| Resumir | 40 | Fotos reales de `~/.claude/oficina/sesiones/*.json` (anonimizadas), de 1 a 6 sesiones, con subagentes, preguntas y procesos. La pregunta es `PREGUNTA` de `modelo.rs`. |
| Conversar | 30 | Preguntas de seguimiento en rioplatense y en neutro ("¿y la del CRM qué está haciendo?", "¿cuál me necesita?"), con la misma foto como contexto. |
| Herramientas | 30 | 3 herramientas de prueba: `listar_sesiones`, `detalle_sesion(id)` y `frenar_sesion(id)`. Incluye 10 casos donde lo correcto es **no** llamar a ninguna o pedir confirmación antes de frenar. |

Es la muestra mínima. Si un modelo empata con la línea base dentro del ruido, se extrapola y no se agranda la muestra.

### Cómo medir

- **Velocidad.** `llama-bench -m <gguf> -ngl 99 -fa 1 -p 3072 -n 256` sobre el binario b12606 ya instalado. Una corrida con la caché KV en f16 y otra con `-ctk q8_0 -ctv q8_0` solo para el modelo actual.
- **VRAM.** El pico, con `nvidia-smi --query-gpu=memory.used --format=csv -lms 200` mientras corre `llama-server -c 8192 --jinja`.
- **Latencia.** Tiempo al primer token y tok/s de cada respuesta, tomados de `timings` en la respuesta de `/v1/chat/completions`.
- **Herramientas.** Un script que manda el bloque Herramientas con `tools` y `--jinja` y verifica tres cosas:
  1. que `tool_calls` sea JSON válido;
  2. que la herramienta y los argumentos sean los correctos;
  3. que no haya llamadas cuando no correspondía.
- **Hechos.** Comparar automáticamente cada resumen con la foto: sesiones, proyectos o subagentes inventados o que faltan. A eso se suma un chequeo de caracteres fuera del español (CJK, frases en inglés).
- **Español.** Nico puntúa a ciegas de 1 a 5 (naturalidad y tono del Avi) un subconjunto de 20 respuestas por modelo, mezcladas.

El scratch de la medición va fuera del repositorio (`mktemp -d`).

### Criterios de aceptación para reemplazar la línea base

| Criterio | Umbral |
|---|---|
| VRAM pico con `-c 8192` | ≤ 3,6 GB, para que no haya descarga a RAM |
| Generación | ≥ 20 tok/s |
| Primer token con un prompt de ~3k | ≤ 5 s |
| Resúmenes sin hechos inventados | ≥ 95 % (≥ 38/40) y no peor que la línea base |
| Herramientas: JSON válido | ≥ 95 % |
| Herramientas: herramienta y argumentos correctos | ≥ 85 % |
| Herramientas: `frenar_sesion` sin pedir confirmación | 0 casos |
| Español a ciegas | promedio ≥ al de la línea base y ninguna respuesta < 2 |
| Fuga de idioma (CJK o párrafos en inglés) | 0 casos |

Si ninguno de los dos supera a la línea base, se queda Qwen3-4B-2507. En ese caso se mide igual con 8k y la caché KV en `q8_0`, para saber si la línea base aguanta el chat largo.
