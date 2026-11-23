# Barra de control de la sesión: revisión de diseño (#19)

Revisión del 22/11/2026 de la barra al pie de cada tarjeta de sesión (D1–D5 del contrato de órdenes). Dirección de referencia: `estilo-avis-ux.md` (tokens, 6.3 foco, 9.x accesibilidad) y `panel-avis-ux.md` (tarjeta escenario). D5: estilo actual del tablero, sin lenguaje visual nuevo.

**Veredicto: aprobada con cambios.** La barra usa las piezas de siempre (campo de "Otra respuesta", `.btn` y `.btn.sec`, tokens de color, tipografía y radios) y respeta D1–D4. Hay que corregir una pérdida del mensaje en los errores, el reposo del botón Enviar y el aire de la barra.

## Cómo se midió

- `dev/ventana.html` y `dev/vista.html` servidos por http, Playwright a 1440, 768 y 375 px, más zoom de 200 % (la dirección revisa por zoom, 2.x). Datos de `dev/falso.js`; `?orden=fallo` y `?orden=error`.
- Medido con `getComputedStyle` y `getBoundingClientRect`: campo 256 × 32,9 (padding 7/10, borde `--linea`, radio `--r-campo`, Manrope 600 13/16,9); Enviar 62,6 × 32; Frenar 77,4 × 32 en reposo y 92,1 × 32 al confirmar; línea de estado reservada de 15 px (Martian Mono 500 10/13 condensada).
- A 768 y 1440 la barra mide 408 (`--ancho-escena`), alineada con el escenario, 15 px adentro de cada borde de la tarjeta. A 375 el panel fijo de 460 queda cortado, igual que sin la barra: la barra no agrega nada que corregir.
- Flujos: escribir, Shift+Enter (línea nueva, el campo crece y los botones quedan abajo), Enter → "Enviando…" → resultado; Frenar → "¿Frenar? Sí" → vuelve solo a los 3 s; segundo clic → "Frenando…" → "Frenado" y Frenar se esconde. El foco queda en el campo. Sin errores de consola.

## Para corregir antes de cerrar

1. **El mensaje se pierde si la orden falla** (`main.js`, `ordenar`). El borrador se vacía al escribir la orden; con `timeout`, `perdida`, `fallo` o `descartada`, el texto ya no está (medido con `?orden=fallo`: el campo queda vacío). Guardar `texto` y, si el resultado no es `enviado` ni `en-cola` y el campo sigue vacío, devolverlo (`ui.borrador = texto` y `campo.value`). Mejor: vaciar el campo solo con esos dos resultados.
2. **Enviar en reposo apaga el ámbar** (`estilos.css`, `.ctl-env:disabled`). Con el campo vacío, que es lo normal, cada tarjeta muestra una píldora ámbar al 38 % (marrón turbio con texto negro). El ámbar es la única luz fuerte del tablero (2.x de la dirección); repetido en cada tarjeta compite con la pregunta. Cambio: `.ctl-env:disabled { opacity: 1; background: var(--s3); color: var(--tenue) }` (4,6:1). Al escribir, la transición de 200 ms que ya tiene `.ctl .btn` lo enciende a ámbar: queda como el único momento de luz de la barra.
3. **La barra queda pegada arriba y con aire de más abajo** (`.ctl`, `.ctl-est`). Medido: 6 px entre el escenario y el campo, y unos 31 px entre los botones y el borde de la tarjeta (15 de línea reservada, 4 + 8 de márgenes y 4 de padding). Cambio: `.ctl { margin: var(--e-6) 0 0 }` y `.ctl-est { min-height: 13px; margin-top: var(--e-2) }`: 12 px arriba y 21 abajo, con la línea todavía reservada (el resultado no empuja la tarjeta).
4. **"En cola" dice lo mismo dos veces** (`control.js`, `lineaResultado`, caso `en-cola`). Se ve la etiqueta `en cola` y al lado "En cola · entra cuando termine el turno". La etiqueta es el estado y la línea, lo que pasó: `{ texto: 'Enviado · Claude lo lee al terminar el turno', tono: 'ok' }`.
5. **Frenar cambia de ancho al confirmar** (`.ctl-frenar`). Pasa de 77 a 92 px: corre Enviar y achica el campo 15 px en el momento del primer clic. Cambio: `.ctl-frenar { min-width: 96px; justify-content: center }`.
6. **La confirmación no dice que espera ni cuánto** (`vistaBarra` y `.ctl-frenar.confirma`). El `aria-label` cambia sobre un botón con foco, y eso casi nunca se vuelve a leer. Mientras confirma, poner en la línea de estado `{ texto: 'Tocá otra vez para frenar · Esc cancela', tono: 'info' }` (la anuncia `role="status"`). Para la vista, una barrita que se vacía en los 3 s: `.ctl-frenar { position: relative }`, `.ctl-frenar.confirma::after { content: ""; position: absolute; left: var(--e-6); right: var(--e-6); bottom: 5px; height: 2px; border-radius: 1px; background: color-mix(in srgb, var(--negro) 45%, transparent); transform-origin: left; animation: drena 3000ms linear both }`, `@keyframes drena { to { transform: scaleX(0) } }`. Solo con `prefers-reduced-motion: no-preference` y `body:not(.pausa)`; con movimiento reducido, sin barrita (alcanza el texto).
7. **Los errores se van solos a los 8 s** (`vistaBarra`, `MS_LINEA`). Un error no se tiene que ir con el tiempo: la línea `tono: 'error'` queda hasta que el usuario escribe o manda otra orden. Lo bueno (`ok`, `info`) sigue yéndose a los 8 s.

## Mejoras opcionales

8. **Frenar aparece de golpe** cuando la sesión empieza a trabajar. Que entre con `asoma` 240 ms (la misma `.nueva` de la línea), dentro de las reglas de movimiento reducido y pausa.
9. **Foco del campo de 1 px** (`.ctl-in:focus`). La dirección pide 2 px (6.3). `.ctl-in:focus-visible { box-shadow: 0 0 0 1px var(--ambar) }` suma el segundo píxel sin mover nada. "Otra respuesta" tiene lo mismo: conviene cambiar las dos juntas.
10. **El campo mide 32,9 y los botones 32** (`.ctl-in`). `line-height: 16px` lo deja en 32 exactos y los bordes de arriba quedan alineados.
11. **Todos los grupos se llaman igual** (`barraControl`, `aria-label` del `.ctl`). Con varias sesiones, sumar la rama: "Escribirle a Claude en feat/6-estilo-avis-marco".

## Preguntas abiertas (para el orquestador)

- Un mensaje mandado mientras Claude espera una respuesta (catalogo en los datos falsos): ¿entra recién cuando se responde? Si es así, la línea debería decir "entra cuando respondas la pregunta", no "al terminar el turno".
- Al frenar, el falso pone `enCola = 0`. ¿`$.turn.abort` descarta los mensajes en cola? Si los descarta, el botón tendría que avisarlo antes ("¿Frenar? Se pierde 1 en cola"); si no, la etiqueta `en cola` no debería irse.
