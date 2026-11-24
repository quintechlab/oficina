# Avis · mascotas: siete especies que evolucionan — dirección

> Boceto aprobado por el usuario tal cual (`docs/diseno/bocetos/mascotas-avi.html`, rondas 1 a 3, 2026-11-23): «Sí, quedan así». Issue #24.
> Evoluciona `docs/diseno/estilo-avis-ux.md` (5 Los Avis), `docs/diseno/marca-avi-ux.md` (motor de la marca) y `docs/diseno/muesca-avi-ux.md` (asomo y cucú). Lo que no se nombra acá sigue como está allí.
> El boceto es la referencia de dibujo y movimiento: **los trazados, degradés y pistas de tiempo se copian tal cual** de su `<script>` (`M`, `VARIANTES`, `ESTRELLAS`, `VUELTA`, piezas) y de su `<style>`. Lo que el boceto tiene solo para mirarlo (tamaño "Vitrina", muesca ampliada, rótulo de la estrella, botones de simulación, mirada con inclinación del cuerpo) no va al widget.

---

## 1. Brief

- **Qué:** la mascota de Claude deja de ser una sola. Hay siete especies (el Avi de hoy y seis nuevas); el usuario elige una en Configuración (#23). Cada especie tiene una **forma evolucionada** que aparece mientras Claude coordina un equipo, y **cuatro variantes** para sus subagentes.
- **Para qué:** que el panel tenga una mascota propia de quien lo usa, y que se lea de un vistazo quién manda: Claude, evolucionado; su equipo, de la misma especie y en forma base.
- **Acción principal:** ninguna nueva en el panel. La elección vive en Configuración (#23); hasta que exista, la mascota es `avi`.
- **Regla de oro:** la mascota cambia el cuerpo, **nunca el idioma de los estados**. "!" ámbar es pregunta, anillo celeste es proceso, chispas es listo, nube con x es falló, "z" es sueño, en todas las especies y en las dos formas.
- **Vara:** `webs portfolio/brasa-noble`. 60 fps en un equipo medio con zoom de 200 %; nada corre si no se ve.

## 2. Concepto

**Una familia de criaturas digitales.** Cada especie es un personaje propio (originales: del pedido se tomó solo el género, criaturas digitales con aire de "evolución" y dragones). Tres palabras: **vivas, distintas, legibles**. Lo que se recuerda: **la evolución**. Cuando Claude lanza su equipo, su mascota hace su acto (una llamarada, un copo que estalla, una falla de señal…) y queda transformada mientras el equipo trabaja; 20 s después de que el equipo termina, vuelve a su forma con una animación propia.

Principios (los de la marca, 2): anticipación antes de cada acto, peso al caer, lo que sigue (alas, colas, tentáculos, antenas) llega tarde, la mirada guía, sin sorpresas.

## 3. Arquitectura

### 3.1 Dónde se ve cada forma

| Lugar | Quién | Especie | Forma |
|---|---|---|---|
| Escenario de la tarjeta de sesión (96, `tablero.js` `.esc-claude`) | Claude | la elegida | evolucionada si **esa** sesión coordina (6) |
| Marca de la barra (112, `figuraMarca`) | Claude | la elegida | evolucionada si **alguna** sesión coordina |
| Muesca acoplada (66, `figuraMuesca`) | Claude | la elegida | ídem marca |
| Pantalla dividida (`divididaVista.js`, Claude de cada mitad) | Claude | la elegida | como su tarjeta: cada mitad con la regla de su sesión (decisión S3) |
| Caras chicas de Claude (≤ 44: fila compacta 26, aviso de pregunta 28, hecho 26, cabezas 32, caras de "Conversan" 26, riel 34, píldora 44) | Claude | la elegida | **también evolucionan** (decisión S2), en la forma chica de 5.5: la de su sesión; riel y píldora, la de la marca |
| Fichas y escenario de subagentes (58), pila "+n" (20), cabezas de subagentes | subagente | la elegida | **siempre base**, su variante (7) |
| Primeros pasos (`primerosPasosVista.js`) | la mascota | **la elegida** (decisión S1) | base. Con `avi`, el Avi base de hoy (`PERSONAJE_BASE`, copete ámbar); con otra especie, esa especie en forma base |

### 3.2 Capas del SVG (las de hoy más tres envolturas)

```
svg (viewBox 0 0 120 120, class "m-<especie> e-<pose> [comando] [evol] [es-marca …]", style --c --mano --oy)
├── ellipse.suelo · ellipse.sello (anillo de suelo, solo evolucionada) · ellipse.contacto
└── g.alza                         cucú de la muesca (motor de la marca)
    └── g.vuela                    flotar (Bruma) — bucle CSS
        └── g.trans                el acto (transformación y vuelta) — anime.js, nadie más la toca
            └── g.talla            forma evolucionada: scale(1.06) con transición (CSS)
                └── g.actua > g.inclina   (solo marca y muesca: canales de marcaMotion.js)
                    └── g.cambio   rebote al cambiar de pose (anime.js, 440 ms)
                        └── g.cuerpo   bucle de la pose (avis.css)
                            ├── evoAtras   partes .evo-p de la forma evolucionada, detrás
                            ├── atras      piezas de la especie (pares -e ev › -s › bucle)
                            ├── cuerpo     cuerpo, marcas, mejillas
                            ├── g.mirada > g.ojos-pose > g.ojos   (o-ab, o-ce, o-fe, o-x)
                            ├── boca
                            └── evoFrente  partes .evo-p, delante
        ├── extra (órbitas que no respiran)
        ├── g.efectos              los de avis.js, iguales para todas (la muesca los esconde)
        └── g.fx                   partículas del acto y de la vuelta
```

- **Un dueño por capa:** CSS mueve `cuerpo`, `ojos`, los bucles propios y las transiciones de `talla`, `.ev` y `.evo-p`; anime.js mueve `trans`, `cambio`, las envolturas `-s` y las partículas de `fx`; marcaMotion.js mueve `actua`, `inclina`, `mirada`, `alza`. Una animación de anime.js escribe estilo en línea y un bucle CSS lo pisa: por eso nunca comparten elemento.
- **Pares laterales** (alas, orejas, puños, antenas): `g.<x>-e.ev.ai|ad` (crece en la forma evolucionada) › `g.<x>-s` (el acto) › `g.<x>` (bucle propio). El derecho es el izquierdo espejado (`matrix(-1 0 0 1 120 0)` en el grupo de adentro). `--s: 1 | -1` da el sentido de los giros.
- `transform-box: view-box` en todos los grupos, con `transform-origin` en unidades del viewBox (tabla de orígenes: el `<style>` del boceto, bloque "propias de cada mascota").

## 4. Contenido

- Nombres de especie y de forma evolucionada: **Avi › Faro, Ascua › Pira, Escarcha › Glaciar, Nodo › Nodo Ω, Bruma › Regia, Morro › Monolito, Lumen › Aurora.** Solo los ve Configuración (#23) y el nombre accesible (12).
- Nombres de variante (7): **no se muestran** en el panel. La ficha sigue mostrando el nombre del subagente (el de su descripción o el inventado por `NOMBRES_INVENTADOS`); la variante es solo dibujo.
- Sin textos nuevos en el panel.

## 5. Sistema visual

### 5.1 Tokens por especie

Cada SVG lleva `--c` (acento: logo de la notebook, ondas de "coordinando", anillo de suelo, luz de piso), `--mano` (manos de las poses) y `--oy` (centro de los ojos, origen del parpadeo). Los degradés van una vez por documento en `defsAvis()` con los ids del boceto. Los efectos de estado conservan sus colores de hoy (`--ambar`, `--celeste`, `--verde`, `--violeta`, `--rosa`, `--rojo`, `--tenue`).

| Especie | `--c` | `--mano` | trazo (ojos ∪ ∩ x) | ojos (x1, x2, y, r) | emisor (ondas) | Paleta |
|---|---|---|---|---|---|---|
| Avi | `#F2B632` | `#EFE6D2` | `#1B1712` | 49, 71, 70, 4,5 | 60, 14 | piel `#F5EDDC` · sombra `#CBBB97` · ámbar `#F2B632` · pico `#E9A13B` · ojo `#1B1712` |
| Ascua | `#FF7A2E` | `#E27A52` | `#2A0F08` | 46, 74, 59, 4,6 | 60, 20 | carbón `#5E2116` · escama `#C9502F` · brasa `#FF7A2E` · ojo `#FFD166` · cuerno `#F3D7A8` |
| Escarcha | `#7DF9FF` | `#BFE6FA` | `#0B1E4A` | 50, 70, 66, 4,4 | 61, 4 | escarcha `#F2FBFF` · hielo `#A9D8F5` · grieta `#4A7FD0` · destello `#7DF9FF` · ojo `#0B1E4A` |
| Nodo | `#C6FF3D` | `#56635B` | `#C6FF3D` | 48, 72, 61, 4,2 | 60, 22 | carcasa `#1B201D` · placa `#56635B` · pantalla `#0F1712` · señal `#C6FF3D` · dato `#5CFFB0` |
| Bruma | `#FF5FD2` | `#B88CFF` | `#170A33` | 49, 71, 53, 4,6 | 60, 28 | abismo `#2E1170` · campana `#8A4DFF` · velo `#D2B4FF` · bioluz `#FF5FD2` · ojo `#170A33` |
| Morro | `#FFC24A` | `#726E82` | `#FFC24A` | 47, 73, 60, 4 | 60, 40 | basalto `#2F2D38` · roca `#726E82` · canto `#A9A5B8` · runa `#FFC24A` · musgo `#6E9E5A` |
| Lumen | `#FFB37A` | `#F0C08F` | `#1E1220` | 48, 72, 63, 5 | 60, 24 | pelusa `#FFE3C2` · ala `#FF7E6B` · ciruela `#5E2350` · ocelo `#5CE1E6` · ojo `#1E1220` |

Bruma flota: `.vuela` en `translateY(-5px)` y el contacto con `rx` 20 (no 26).

### 5.2 Las siete especies

| Especie | Tipo | Concepto | Rasgo firma (solo Claude) |
|---|---|---|---|
| **Avi** | familia | El Avi de Claude de hoy, sin cambios: huevo crema, pico y antena ámbar. | la antena con foco |
| **Ascua** | dracónico · brasa | Un dragoncito que guarda una brasa en el pecho: cuanto más trabaja, más brilla. | escamas naranja, cuernos hueso curvos y cresta |
| **Escarcha** | dracónico · cristal | Un dragón tallado en hielo, todo facetas. | las tres púas y el celeste hielo |
| **Nodo** | digital · datos | Nació en la memoria caché: cara de pantalla y orejas de antena. | orejas de antena y pantalla lima |
| **Bruma** | abisal · bioluz | Viene del fondo del mar de datos: no camina, flota. | campana violeta con bioluz magenta |
| **Morro** | gólem · runas | Un gólem petiso de basalto con runas que se encienden. | basalto con runas ámbar y musgo |
| **Lumen** | polilla · luz | Una polilla mullida que junta la luz de las pantallas. | alas coral con ocelos turquesa |

El rasgo firma no lo lleva ninguna variante de subagente (7). Las piezas de cada especie son `M.<especie>.atras / cuerpo / ojos / boca / extra` del boceto.

### 5.3 Formas evolucionadas

La forma evolucionada **suma** a la base: partes `.evo-p` que aparecen, envolturas `.ev` que crecen, `g.talla` a 1,06 y el anillo de suelo (`ellipse.sello`, `rx` 40, `ry` 8, trazo `--c` de 1,2, opacidad .5 con el bucle `sello`). El esqueleto, las 13 poses, la mirada y la muesca no cambian.

| Forma | Partes que aparecen (`.evo-p`, orden de aparición `--k`) | Envolturas que crecen (`.evol .x-e`) | Bucles solo evolucionada |
|---|---|---|---|
| **Faro** (Avi) | alas crema de punta ámbar (k 0), copete de plumas (1), cola de plumas (2), marcas de mejilla (2), faro: aro punteado y dos haces `gRayo` (3) | `tallo-e` `scaleY(1.35)` (origen 60 38); `foco-e` `translateY(-6.6px) scale(1.2)` (60 14) | alas `aleteo` 2,4 s; aro `gira` 8 s; haces `faro` 3,6 s (±14°); halo `haloEvo` 1,8 s |
| **Pira** (Ascua) | melena de tres llamas (0), vetas de lava a los costados (2) | `ala-e` `scale(1.32)`; `cuernos-e` `scale(1.3)` (60 38); `punta-e` `scale(1.7)` (101 76); brasa del pecho a .7 | llamas `flama` .4 s alterno; brasa `brasaEvo` 1,4 s; vetas `titila` 1,8 s |
| **Glaciar** (Escarcha) | hexágono de escarcha detrás (0), esquirlas en los hombros (1), gema en la frente (2), dos esquirlas en órbita (3) | `puas-e` `scale(1.08, 1.45)` (60 36); `ala-e` `scale(1.3)` | hexágono `gira` 24 s; órbita `gira` 10 s |
| **Nodo Ω** | aletas de datos y aura punteada `r` 52 (0), corona de tres bits (2) | `oreja-e` `scale(1, 1.3)` | aura `gira` 12 s; corona `titila` 1,2 s `steps(2)` |
| **Regia** (Bruma) | corona de volantes (0), dos hilos celestes largos (1), cinco luces en órbita `r` 46 (2), bandas de bioluz (1) | `tents-e` `scale(1.05, 1.28)` (60 72) | órbita `gira` 14 s; hilos `ondea` 2,6 s; bandas `titila` 2,4 s |
| **Monolito** (Morro) | cristales ámbar en hombros y coronilla (0), runas en todo el cuerpo (1), tres piedras en órbita (2) | `puno-e` `scale(1.28)`; ojos encendidos (`.flare` a .75); runas a 1 | runas `runaEvo` 1,8 s; brillo `brasaEvo` 1,8 s; órbita `gira` 16 s |
| **Aurora** (Lumen) | dos cintas de aurora detrás (0), colas de golondrina con ocelo (1), tiara de luz (2) | `ala-e` `scale(1.22)`; `ant-e` `scale(1.2)` | cintas `aurora` 4 s (la segunda −2 s); tiara `titila` 1,6 s |

Transiciones (CSS, sin JS): al evolucionar, `.evo-p` de `opacity 0; scale(.3)` a `1; none` con `opacity .3s ease-out` y `transform .75s cubic-bezier(.34,1.56,.64,1)`, demora `k × 70 ms`; `.ev` y `.talla` con `transform .75s` y el mismo rebote. Al volver, `.evo-p` con `opacity .25s ease-in` y `transform .4s cubic-bezier(.5,0,.75,0)`; `.ev` y `.talla` con `transform .4s` y esa curva.

### 5.4 Muesca y tamaños

- La forma evolucionada se lee a 96, 112 y en la muesca (66 dentro de 52 × 54). En la muesca las partes de arriba (corona, púas, haces) pueden cortarse contra el borde de la pantalla: está bien, es el borde.
- La muesca sigue escondiendo `g.efectos` (muesca-avi-ux.md 5.2); las partes `.evo-p` se ven.
- A 58 px (subagentes) nunca hay forma evolucionada.

### 5.5 Forma evolucionada chica (≤ 44 px)

Las caras chicas de Claude también evolucionan (S2). A ese tamaño una unidad del viewBox mide menos de 0,37 px: se queda lo que cambia la **silueta** y se omite el **detalle fino**. El SVG lleva la clase `chica` cuando `tamano ≤ 44`; las partes de detalle llevan `evo-fino` y `.chica .evo-fino { display: none }`. Con `chica` tampoco hay anillo de suelo ni bucles de la forma evolucionada; `talla` 1,06 se mantiene.

| Forma | Se queda (silueta) | Se omite (`evo-fino`) |
|---|---|---|
| Faro | alas, copete y cola de plumas, antena alta con el foco grande | haces, aro punteado, marcas de mejilla |
| Pira | melena de llamas, cuernos y alas grandes, punta de la cola encendida | vetas de lava |
| Glaciar | púas largas, alas grandes, esquirlas de los hombros | hexágono, gema de la frente, esquirlas en órbita |
| Nodo Ω | orejas largas, aletas de datos, corona de bits | aura punteada |
| Regia | corona de volantes, tentáculos largos | hilos celestes, luces en órbita, bandas de bioluz |
| Monolito | cristales ámbar, puños grandes, ojos encendidos | runas extra, piedras en órbita |
| Aurora | alas y antenas grandes, colas de golondrina | cintas de aurora, tiara |

En las caras chicas el cambio de forma es la transición de 5.3 (las partes aparecen o se van), **sin acto ni partículas**: el acto es de las figuras de 66 px en adelante.

## 6. Regla de evolución

Decisiones del usuario del 23/11 (17). Exacta:

1. **Quién coordina:** una sesión coordina un equipo si tiene algún subagente con `estado === 'trabajando'`. Es la función privada `coordinando(s)` de `logica.js`, que pasa a exportarse como **`coordinaEquipo(s)`**. **No** se usa `animoSesion`: una sesión con pregunta propia y subagentes trabajando dice `teEspera` y sigue coordinando, así que sigue evolucionada.
2. **Claves:** una por sesión (`sesion` id) para su tarjeta, su mitad de la pantalla dividida y sus caras chicas (fila compacta, cabezas, aviso de pregunta, hecho, caras de "Conversan"); una global `'marca'` para la marca, la muesca, el riel de la dividida y la píldora, con `coordina = algunaCoordina(proyectos)` (alguna sesión de cualquier proyecto).
3. **Subagentes:** nunca. Su figura no acepta `evolucionada`.
4. **Controlador de tres estados** por clave: `base`, `evo`, `cuenta`. Función pura `pasoEvolucion(previo, coordina, ahoraMs) → { estado, hasta, acto }` (`acto`: `'evoluciona' | 'vuelve' | null`), constante `ESPERA_EVOLUCION_MS = 20000`:

| Previo | `coordina` | Resultado | `acto` |
|---|---|---|---|
| (ninguno: primera vez que se ve la clave, al abrir Avis o al aparecer una sesión que ya coordina) | sí | `evo` | `'evoluciona'` (decisión S4: hace el acto al abrir, escalonado según el punto 10) |
| (ninguno) | no | `base` | `null` |
| `base` | sí | `evo` | `'evoluciona'` |
| `base` | no | `base` | `null` |
| `evo` | sí | `evo` | `null` |
| `evo` | no | `cuenta`, `hasta = ahora + 20000` | `null` |
| `cuenta` | sí | `evo` (se olvida `hasta`) | `null` — **reencender durante la cuenta no anima ni parpadea** |
| `cuenta` | no, `ahora < hasta` | `cuenta` (mismo `hasta`) | `null` |
| `cuenta` | no, `ahora ≥ hasta` | `base` | `'vuelve'` |

5. **Cuándo se calcula:** en cada vuelta de sondeo (1,5 s) y además un `setTimeout` al `hasta` más próximo, así la vuelta sale a los 20 s y no hasta 1,5 s tarde. El estado vive en `st.evolucion` (`Map` clave → `{ estado, hasta }`); una sesión que se cierra o deja de verse se olvida.
6. **Forma = estado:** la clase `evol` está puesta en `evo` y en `cuenta`; no está en `base`. El acto es solo decoración del cambio.
7. **Cambio en su lugar, nunca por redibujo:** `firmaTablero` **no** incluye la forma; `pintarEscenas` (y su par de la marca, la muesca y la dividida) ponen o sacan `evol` en el SVG que ya está, como hoy reescribe `data-vivo`. Así el acto no se corta. Un redibujo por otra causa dibuja la forma que diga `st.evolucion`, sin acto.
8. **Cuándo hay acto:** solo si `acto` no es `null`, la figura mide 66 px o más (5.5) **y** se ve (`debeActuar({ visible, reducido, pausa })` = `visible && !reducido && !pausa`). Visible: tarjeta sin `.quieta` (IntersectionObserver de `escenaMotion.js`), marca con el panel a la vista, muesca cerrada a la vista, ventana no minimizada ni escondida. Si no hay acto, la clase cambia directo (con su transición CSS, o fundido si el movimiento es reducido). **Excepción del arranque (S4):** el acto de apertura de cada figura no se pierde si Avis arranca escondido o la figura está fuera de la vista; queda pendiente (`actoPendiente`, una sola vez por figura) y se hace la primera vez que la figura se ve, si para entonces sigue evolucionada. Los demás actos que no se ven se pierden.
9. **Un acto por figura:** si llega `'vuelve'` mientras la transformación corre, la vuelta espera a que termine. Si llega `'evoluciona'` mientras corre la vuelta, la vuelta se corta en su punto y se pone `evol` sin acto.
10. **Varios a la vez:** si en una misma vuelta de sondeo arrancan varios actos (por ejemplo, tarjeta y marca, o todas al abrir Avis), se escalonan 250 ms en orden: tarjetas visibles de arriba hacia abajo, marca, muesca (S5).

### 6.1 Casos de prueba (`widget/test/evolucion.test.js`)

1. Cada fila de la tabla del punto 4 es un test (nueve); la primera fija que **sin estado previo y coordinando hay acto** (`'evoluciona'`), tanto al abrir como al aparecer una sesión que ya coordina.
2. `cuenta` con `ahora = hasta − 1` sigue en `cuenta`; con `ahora = hasta`, vuelve a `base` con `'vuelve'`.
3. Secuencia completa: `base` → coordina (evoluciona) → deja de coordinar en t (cuenta, `hasta = t + 20000`) → coordina en t + 5000 (evo, sin acto) → deja en t + 9000 (cuenta, `hasta = t + 29000`, se reinicia) → t + 29000 (base, vuelve).
4. `coordinaEquipo`: `true` con algún subagente `trabajando`; `false` con todos `listo`/`fallo` o sin agentes; `true` con una pregunta propia pendiente y un subagente trabajando.
5. `algunaCoordina`: `true` si coordina cualquier sesión de cualquier proyecto; `false` sin sesiones.
6. `debeActuar`: `false` si no se ve, con movimiento reducido o con pausa; `true` solo con las tres condiciones a favor.
7. La figura de subagente nunca lleva `evol` aunque su sesión coordine (`avis.test.js`).
8. `firmaTablero` no cambia cuando solo cambia la forma (`tablero.test.js`).
9. Arranque: tres sesiones que ya coordinan al abrir dan tres actos escalonados a 0, 250 y 500 ms, después la marca (750) y la muesca (1000) (`ordenActos`, puro).
10. `actoPendiente`: una figura evolucionada que no se veía al abrir hace su acto la primera vez que se ve, una sola vez; si volvió a la base antes de verse, no hace nada.
11. Caras chicas: con `tamano ≤ 44` el SVG lleva `chica`, sigue la clave de su sesión (o `'marca'` el riel y la píldora) y nunca hay acto (`debeActuar` con tamaño, o `avis.test.js`).

## 7. Variantes de subagente

### 7.1 Las 24 variantes nuevas y el elenco del Avi (nombres propuestos, solo internos)

Las piezas, reemplazos de color y marcas de cada una son las de `VARIANTES` del boceto: una variante es la especie con piezas cambiadas (`campos`), colores reemplazados en todo el dibujo (`reemplazos`, en orden), marcas debajo de los ojos (`mas`) y, a veces, otra talla. Nunca lleva `evoAtras`, `evoFrente` ni partículas.

| Especie | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Avi (decisión P1: el elenco de hoy, **5 personajes por nombre**, ver 7.3) | gata · `#E78FB3` | ratón · `#7FB3FF` | brote · `#8FD694` | cuernos · `#A58BFF` (y el quinto, mono · `#F2B632`) |
| Ascua | Tizón · carbón con grietas de lava, cuernos cortos · `#FF9A3D` | Chispa · chica (.9), sin alas, abanico de cuello · `#FFC15A` | Ceniza · gris, cuernos largos hacia atrás, brasas sueltas · `#FF8A5C` | Fogata · carmesí, dos cuernos rectos · `#FF5A6E` |
| Escarcha | Copo · bola de nieve redonda, sin alas · `#A9D8F5` | Cuarzo · lila, un solo cuerno · `#E0A6FF` | Témpano · alto y afilado, barba de carámbanos · `#5CC8FF` | Granizo · chico (.88), erizado de púas · `#9EE7D8` |
| Nodo | Bit · chico (.88), una antena, pantalla cian · `#5CF2FF` | Caché · orejas caídas, pantalla ámbar · `#FFC24A` | Búfer · ancho, orejas de triángulo, magenta · `#FF6FD8` | Ping · redondo y claro, auriculares · `#5CFFB0` |
| Bruma | Perla · nácar, tres tentáculos gruesos, perla · `#FFB3D9` | Tinta · oscura, ojos de luz, siete hilos · `#7CF7FF` | Coral · chica (.9), falda de volantes · `#FF8A5C` | Sifón · capucha alta, dos brazos largos · `#5CE8B8` |
| Morro | Guijarro · canto rodado, sin brazos, runas cian · `#7DF9FF` | Pizarra · losa alta con un brote, runas verdes · `#8FD694` | Ladrillo · arcilla con almenas y juntas · `#FF8A6B` | Musgoso · cubierto de musgo con una flor · `#9AD67A` |
| Lumen | Pavesa · de carbón, ocelos naranja · `#FF9A3D` | Seda · blanca, antenas de pluma · `#C9A6FF` | Luna · verde pálido, colas largas · `#B8F07A` | Lucero · luciérnaga (.9), panza que brilla · `#FFE08A` |

Se distinguen a 58 px por silueta o rasgo, no solo por tono (revisado en el boceto, las 28 en las seis poses de subagente). Claude destaca por tres cosas a la vez: rasgo firma, forma evolucionada mientras coordina y tamaño (96 frente a 58).

### 7.2 Poses

Las de `animoSubagente`: `escribiendo`, `leyendo`, `listo`, `fallo`, `durmiendo`, `teEspera`. Las 13 funcionan (mismo esqueleto). Lucero tiene un bucle propio: `.bulbo-l` `titila` 1,4 s.

### 7.3 Asignación

**Especie Avi (decisión P1, «Mantener el elenco por nombre»):** sin cambios. `personajeDeNombre` sigue eligiendo por nombre: el elenco (Camila, Ramiro, Lucas, Delfina, Inés) y, si no, `huella(nombre) % 5` sobre gata, ratón, brote, mono y cuernos. Lo que sigue vale **solo para las otras seis especies**.

Función pura nueva en `logica.js` (junto a `huella`, que es privada): **`variantesEquipo(agentes) → Map<id, 0..3>`**.

1. Ordena **la lista completa de la sesión** (`s.agentes`, que incluye los terminados hace menos de 30 min) por `desde` y, a igualdad, por `id`. Nunca solo los visibles.
2. Recorre en ese orden: `v = huella(id) % 4`; si `v` ya lo tiene uno anterior **que seguía trabajando cuando él arrancó** (`hasta == null || hasta > desde`) **y** todavía hay alguna libre entre esos, prueba `(v + 1) % 4` hasta dar con una libre. Con las cuatro usadas, toma su `v` (se repite).
3. Con 4 o menos a la vez nunca se repiten. Con 5 o más el escenario muestra 3 y la pila "+n" (`subagentesVisibles`), así que una repetición rara vez queda a la vista.

> **Corregida el 23/11 tras la revisión (16.2).** La regla original chocaba con todos los anteriores, también los ya terminados, y con una segunda tanda repetía variantes a la vista. Ahora un subagente choca solo con los anteriores que seguían trabajando cuando él arrancó. Sigue siendo estable: el intervalo de un anterior frente al `desde` de uno posterior no cambia después. En el caso medido (`?mascota=lumen&equipo=4`: a4 y a5 terminados, a1, a2, a3 y uno nuevo trabajando) da **3, 2, 1, 0** (16.2 decía 1, 2, 3, 0; con las huellas reales, a1 conserva su 3 porque a5 terminó antes de que arrancara). Los ids de la tabla de abajo no tienen `hasta` y dan lo mismo que antes.
4. **Límite conocido:** si sale de la lista un subagente anterior (pasaron 30 min), uno posterior que había chocado con él puede cambiar de variante. Se acepta.
5. `prepararProyecto` agrega `especie` a cada subagente y, si la especie no es Avi, `variante` (`...a, especie, variante, animo`); con Avi, el personaje de `personajeDeNombre` como hoy.

Casos de prueba (`widget/test/logica.test.js`), con los ids del boceto (FNV-1a de 32 bits, % 4 medido):

| Ids (en orden de `desde`) | `huella % 4` | Variantes |
|---|---|---|
| `toolu_01Hq8c`, `toolu_01Zr3m`, `toolu_01Ab7x`, `toolu_01Kp2v` | 2, 0, 0, 3 | 2, 0, **1**, 3 (el tercero choca con el segundo y toma la siguiente libre) |
| los cuatro de arriba + `toolu_01Wn9d`, `toolu_01Ty4s` | … 0, 2 | 2, 0, 1, 3, **0**, **2** (del quinto en adelante, su huella) |

1. Las dos filas de arriba.
2. Con 4 o menos ids, ninguna variante repetida (100 conjuntos al azar con semilla fija).
3. Agregar un subagente posterior no cambia a los anteriores.
4. El resultado no depende del orden del arreglo de entrada (ordena por `desde`).
5. Sacar uno posterior no cambia a los anteriores.
6. El límite del punto 4 queda fijado: sin el segundo de la primera fila, el tercero vuelve a 0.
7. `NOMBRES_INVENTADOS` no cambia: el nombre de la ficha sigue saliendo de `huellaTexto(id) % 16` en el mod.
8. Con la especie Avi, `prepararProyecto` da el mismo personaje que hoy para cada nombre (Delfina → mono) y no agrega `variante`.

## 8. Movimiento

anime.js v4 en producción (pre-aprobado; se instala en la entrega 2 y es la primera dependencia de animación del widget): `createTimeline`, `animate`, `stagger`. Un módulo por sección: **`evolucionMotion.js`** (actos de transformación y vuelta), los bucles en CSS (`especies.css`). Todo dentro de `prefers-reduced-motion: no-preference` y `body:not(.pausa)`.

### 8.1 Reposo por especie (CSS, siempre)

Respiran y parpadean como los Avis (`respira` 3,4 s, `parpadea` 4,8 s, desfase `--d`), y además:

| Especie | Bucles |
|---|---|
| Avi | ninguno más (como hoy) |
| Ascua | alas `aleteo` 2,8 s (−9° por lado); cola `colea` 3,4 s; punta de la cola `flama` .45 s alterno; brasa `brasa` 2,6 s. Dormido: alas caídas 12°, quietas |
| Escarcha | alas `aleteo` 3,8 s; brillo que barre `barre` 5 s; destello en la púa `brilla` 3,6 s. Dormido: sin brillo |
| Nodo | orejas `oreja` 5,2 s (la derecha −2,1 s); línea de pantalla `scan` 2,8 s; LEDs `led` 1,2 s cada .4 s; bits en órbita `gira` 9 s. Dormido: LEDs a .15, sin línea, órbita 30 s |
| Bruma | flota `flota` 3,2 s (−3 a −8 px) con la sombra `sombra`; tentáculos `ondea` 2,6 s escalonados .5 s; manchas `titila` 2,2 s. Dormida: flota 6 s |
| Morro | runas `runa` 4,2 s escalonadas .3 s; brillo `brasa` 4,2 s; musgo `musgo` 3,8 s; puños `puno` 3,4 s. Dormido: runas a .2. Escribiendo y leyendo esconden los puños (y saluda el derecho) |
| Lumen | alas `batir` 1,8 s (`scaleX` .84); antenas `antena` 3 s; motas `mota` 4 s. Dormida: alas plegadas a `scaleX(.62)` |

Keyframes y valores: los del `<style>` del boceto, con los mismos nombres.

### 8.2 Transformación (el acto estrella, sobre `g.trans` y las envolturas `-s`)

`revela` es el instante en que se pone `evol` (tapado por el destello). Tiempos en ms; curvas: `ease-in-out` salvo indicación.

| Especie | Duración | `revela` | Pista |
|---|---|---|---|
| Avi › Faro | 2300 | 820 | se agacha (`scale(1.08,.9)` a 18 %), sube 7 px estirado (42 %); el halo crece a 2,6 y .85 (38 %); a 720 un estallido de 8 haces (1000 ms, gira 40°) y a 760 un aro que crece de .2 a 3,4 (900 ms, `ease-out`); a 820 caen 6 plumas (1500 ms, 40 ms entre una y otra) |
| Ascua › Pira | 2400 | 1320 | se agacha (16 %), estira y gira −5° (40 %), echa la cabeza +6° (52 %); alas abiertas ±30°; la brasa del pecho de .2 a 1; llamarada de costado desde la boca (66, 78) que nace a 46 % y se apaga al final; 9 brasas desde 1250 (70 ms entre una y otra); anillo de calor a 1350 (800 ms) |
| Escarcha › Glaciar | 2300 | 960 | se congela (`scale(1.05,.94)` 15 %), sube 4 px (40 %); alas a ±22°; copo de seis brazos de .1 a 1,3 y 40° (55 %) y a 2 y 75°; 10 esquirlas radiales desde 900 (900 ms); barrido de brillo a 820 (700 ms) |
| Nodo › Nodo Ω | 1900 | 1000 | falla de señal (sacudidas de ±3 px hasta 320, pantalla que destella dos veces); colapsa a una línea `scale(1.25,.04)` (600) y se queda (820); se rearma `scale(.05,1.3)` (1000) → `scale(1.1,1.06)` (1180) → reposo (1380); línea de luz de 520 a 960; 7 rayos de datos desde 660 (35 ms entre uno y otro). Origen del acto: 60 68 |
| Bruma › Regia | 2600 | 700 | se contrae `scale(1.12,.84)` (14 %), se impulsa a −20 px (34 %) y −24 (50 %), baja; tentáculos se estiran a la inversa; la sombra se achica a .5; 3 anillos de bioluz desde 380 (220 ms entre uno y otro, a 2,8); 10 motas de plancton suben desde 500 |
| Morro › Monolito | 2700 | 1352 | las runas se encienden una a una (6 % entre una y otra); levanta los puños (−18 a −21 px, ±25 a 32°) y golpea a 1352 (`scale(1.1,.88)`); **el escenario tiembla** 380 ms (±4 px); dos nubes de polvo; 5 piedras saltan y caen |
| Lumen › Aurora | 2600 | 950 | alas a toda velocidad (16 medios golpes de 105 ms a `scaleX(.42)` desde 250); sube 16 a 20 px; halo cálido de .4 a 1,1 y 1,3; ocelos destellan dos veces; espiral de 12 motas (gira 420°, 2000 ms desde 500) |

El temblor de Morro mueve el contenedor de la figura (la tarjeta en el escenario; en la marca, `.marca .avi`), nunca la ventana.

### 8.3 Vuelta (1300 ms, común + toque propio)

- `g.cambio`: tiembla ±1,5 px (0 a 24 %), se aplasta `scale(1.07,.9)` (42 %) y rebota `scale(.97,1.04)` (62 %), `ease-out`.
- A 320 ms se saca `evol` (las partes se van con su transición de 5.3).
- 8 chispas del color `--c` que salen y caen (1100 ms desde 260).
- Toque propio: Avi, caen las plumas; Ascua, caen las brasas; Escarcha, caen las esquirlas; Nodo, un último fallo de pantalla y la línea de luz (500 ms); Bruma, suben burbujas; Morro, nube de polvo a 420; Lumen, las motas caen despacio.

### 8.4 Movimiento reducido y pausa

Sin bucles, sin actos, sin mirada. La forma cambia con un **fundido de opacidad de .3 s** (las partes no crecen ni se mueven; `.ev` y `.talla` cambian sin transición). Con "Pausar animaciones", igual.

### 8.5 Rendimiento

- Solo `transform` y `opacity`; ningún filtro animado (los brillos son degradados, como hoy en el escenario).
- Los bucles propios de la forma evolucionada están bajo `.evol` (no corren con la forma base, aunque sus partes estén en el DOM con opacidad 0).
- Nada corre fuera de la vista: tarjetas con `.quieta`, marca y muesca con su `visible()` de hoy; un acto que no se ve no se dispara (6.8).
- Hasta 12 partículas por acto; actos escalonados 250 ms (6.10).
- Presupuesto: 60 fps en un equipo medio con zoom de 200 %, con 3 tarjetas visibles, la marca y la muesca, y un acto a la vez. Se mide con el panel de rendimiento antes de cerrar la entrega 3.

## 9. Contrato de datos y API

### 9.1 La elección

- **`preferencias.json` → `"mascota": "avi" | "ascua" | "escarcha" | "nodo" | "bruma" | "morro" | "lumen"`.** La escribe Configuración (#23). Sin la clave, con basura o con un valor desconocido: `"avi"`.
- **Contradicción con el código, a resolver en la entrega 1:** `preferencias.rs` reescribe el archivo entero con un conjunto fijo de claves (`escribir`: `tamano`, `acople`, `flotante`, `monitor`, `mod`). Una clave `mascota` escrita por otro lado se **borraría** en el próximo guardado del tamaño o del acople. `Preferencias` suma `mascota` y `escribir` la conserva, con un test ("guardar el tamaño no borra la mascota").
- Rust: `leer_mascota(ruta) -> String` (valida contra la lista) y un comando `mascota` que la devuelve al arrancar. Cuando #23 la cambie, avisa con el evento `oficina://mascota` y la ventana redibuja todo con la especie nueva (sin acto). `dev/vista.html?mascota=<especie>` la fuerza.

### 9.2 Dibujar

- **`avis.js`:** `svgAvi(personaje, pose, comando, { marca, evolucionada })`. `personaje` suma `especie` (por defecto `'avi'`) y `variante` (`0..3` o `null`). Con `especie === 'avi'` y sin `evolucionada` el resultado es **idéntico al de hoy, carácter por carácter**; con `evolucionada`, el mismo dibujo más las partes de Faro. Con otra especie delega en `svgEspecie`. `avi(personaje, animo, tamano, opciones)` pasa `evolucionada`. `poseAvi` no cambia (la pose no depende de la especie).
- **`claudeDe(especie)`** reemplaza a la constante `CLAUDE` en todos los lugares de 3.1 (`tablero.js`, `muesca.js`, `divididaVista.js`, `pregunta.js`). `avi(...)` agrega la clase `chica` con `tamano ≤ 44` (5.5).
- **Primeros pasos (S1):** `mascotaPrimerosPasos(especie)` = `PERSONAJE_BASE` con `avi` y `{ especie }` con las otras; siempre forma base. La pose `saluda` existe en todas las especies.
- **Subagentes:** `{ especie, variante }` en `prepararProyecto`; con la especie Avi, el personaje por nombre de hoy (P1).
- **`svgMarca`** (la marca y la muesca) suma las tres envolturas de 3.2 y, para las especies nuevas, las capas que necesita marcaMotion.js (`g.actua`, `g.inclina`, `g.parpado`, `g.efectos`, `g.zs`, `g.globo`, `g.bola`, manitos). Ver P3 para los canales que no tienen equivalente.

### 9.3 Archivos (sugeridos, no escritos)

| Archivo | Qué |
|---|---|
| `widget/src/especies.js` (nuevo) | Datos puros: `ESPECIES` (piezas, tokens, ojos, emisor, partes evolucionadas, firma), `VARIANTES`, `datosEspecie(especie, variante)`, `svgEspecie(...)`, degradés para `defsAvis()`. Copia de `M` y `VARIANTES` del boceto |
| `widget/src/evolucion.js` (nuevo) | Puro: `ESPERA_EVOLUCION_MS`, `pasoEvolucion`, `algunaCoordina`, `debeActuar` |
| `widget/src/evolucionMotion.js` (nuevo) | anime.js: `evolucionar(svg, especie, { contenedor })`, `devolver(svg, especie)`, cola de 250 ms, un acto por figura |
| `widget/src/especies.css` (nuevo) | Orígenes, bucles por especie, forma evolucionada y transiciones; se carga junto a `avis.css` |
| `widget/src/logica.js` | Exporta `coordinaEquipo`; `variantesEquipo` |
| `widget/src/avis.js` | `svgAvi`/`avi` con `especie`, `variante`, `evolucionada`; `claudeDe`; Faro en el Avi |
| `widget/src/tablero.js`, `muesca.js`, `divididaVista.js`, `pregunta.js` | `claudeDe(st.mascota)`; subagentes con su variante |
| `widget/src/main.js` | `st.mascota`, `st.evolucion`, temporizador al `hasta`, cambio de forma en su lugar (6.7) |
| `widget/src-tauri/src/preferencias.rs`, `lib.rs` | `mascota` (9.1) |
| `widget/dev/vista.html` | `?mascota=`, `?evol=1`, `?equipo=n` |

## 10. La voz del resumen y los juegos de la marca en las especies nuevas

Decididas por el usuario el 23/11 («Acepto sus propuestas»): se implementan tal como siguen, en la **entrega 5**, después de las variantes. Hasta esa entrega, rige el "hasta la entrega 5" de cada punto.

- **P2. La voz del resumen** (`baja`, `calienta`, `contando`, `feliz`, `error`; hoy solo en el Avi de la marca, resumen-ia-ux.md 6.2). Mismo mapeo en todas las especies, con su "luz propia" en lugar del foco: `baja` mira abajo a la derecha y la luz titila; `calienta` la luz late fuerte y el cuerpo tiembla; `contando` respira rápido; `feliz` ojos ∩; `error` cejas preocupadas (dos trazos sobre los ojos de cada especie, en el color de su trazo). Luz propia: Ascua la brasa, Escarcha el destello de la púa, Nodo los LEDs, Bruma las manchas, Morro las runas, Lumen los ocelos. Hasta la entrega 5, las especies nuevas usan `esperando` con el globo del resumen.
- **P3. Los juegos de la marca** (pelota, canta, estira, te llama, siesta). Las mismas pistas (`ACTOS`) con un mapeo de canales por especie: `ant` → el apéndice que sigue (alas, orejas, tentáculos, antenas); `luz` → la luz propia de P2; `boca` → la boca de la especie. Las piezas comunes (pelota, globo, manitos con `--mano`, "z", notas) no cambian. Hasta la entrega 5, las especies nuevas solo hacen la siesta y el cucú de la muesca; los otros cuatro juegos son del Avi.
- **Supuestos, cerrados por el usuario el 23/11:** S1, primeros pasos muestra la mascota elegida (3.1, 9.2); S2, las caras de Claude de 44 px o menos también evolucionan, en la forma chica (5.5); S3, la pantalla dividida sigue la regla de su sesión (3.1); S4, al abrir Avis las mascotas de sesiones que ya coordinan hacen la transformación (6.4, 6.8); S5, los actos simultáneos se escalonan 250 ms (6.10), como se propuso.

## 11. Responsive y zoom

Sin cambios de diseño por ancho: el panel tiene ancho fijo (estilo-avis-ux.md 9.2). El zoom de 100 a 200 % escala los SVG (vectoriales). La muesca mantiene 150 × 54 y 62 × 140 (muesca-avi-ux.md 5.1).

## 12. Accesibilidad

- Las figuras siguen `aria-hidden` donde el texto de al lado ya dice quién es y qué hace (estilo-avis-ux.md 5.6).
- Nombre de la marca: "Claude, coordinando el equipo" pasa a "Claude (Pira), coordinando el equipo" con la forma evolucionada, y "Claude (Ascua), …" en base con una especie que no es Avi. Con Avi base, como hoy.
- El estado nunca depende de la especie ni de la forma: los efectos de estado y la línea de texto son los de siempre.
- Movimiento reducido y pausa: 8.4. El temblor de Morro no corre con movimiento reducido.
- Nada titila más de tres veces por segundo (la corona de Nodo Ω: 1,2 s por ciclo).

## 13. Entregas

1. **Motor de especies, Avi sin cambios visibles.** `especies.js` con la especie Avi; `svgAvi`/`avi` con `especie`/`variante`/`evolucionada`; `claudeDe`; `preferencias.rs` con `mascota` (y que no se borre). **Acepta:** el SVG de cada personaje del Avi en las 17 poses es idéntico al de hoy (test de igualdad de texto); `mascota` ausente, basura o desconocida → `"avi"`; guardar el tamaño o el acople no borra `mascota`; capturas de `dev/vista.html` iguales antes y después.
2. **Evolución con el Avi (Faro).** `evolucion.js` con los tests de 6.1; `coordinaEquipo`; `evolucionMotion.js` (se instala anime.js v4); `especies.css` con Faro; `main.js` con `st.evolucion` y el cambio en su lugar. **Acepta:** tests de 6.1 en verde; en Playwright, coordinar dispara un solo acto en la tarjeta, la marca y la muesca; al abrir Avis con sesiones que ya coordinan, sus actos salen escalonados 250 ms; sin equipo, la vuelta sale a los 20 s ±0,3 s; reencender durante la cuenta no anima; una tarjeta fuera de la vista cambia sin acto (salvo el acto pendiente de la apertura); las caras chicas cambian a la forma chica sin acto; la dividida sigue a cada sesión; primeros pasos muestra la mascota elegida; con movimiento reducido, solo el fundido; los subagentes nunca evolucionan.
3. **Especies nuevas** (3a: Ascua, Escarcha, Nodo; 3b: Bruma, Morro, Lumen), forma base y evolucionada, bucles y actos. **Acepta:** con `?mascota=<especie>` las 13 poses en las dos formas a 96, 112 y en la muesca en los cuatro bordes, al 100 y al 200 %; los actos y vueltas con las pistas de 8.2 y 8.3; 60 fps según 8.5; se elige editando `preferencias.json` hasta que exista #23.
4. **Variantes de subagente.** `variantesEquipo` con los tests de 7.3; las 24 variantes de las seis especies nuevas; el Avi sigue con el elenco por nombre (P1); `prepararProyecto` con `especie` y `variante`. **Acepta:** tests en verde; con 4 subagentes, 4 variantes distintas; con 6, 3 y la pila; el mismo subagente conserva su variante entre redibujos y reinicios del widget; con la especie Avi, los personajes de hoy.
5. **Voz del resumen y juegos de la marca en las especies nuevas** (10, P2 y P3). **Acepta:** con `?mascota=<especie>` las cinco poses de la voz y los cinco juegos con las pistas de `marca.js`, la luz propia y el apéndice de cada especie; la boca de cada especie en "canta"; movimiento reducido y pausa como hoy.

No improvisar: los trazados, colores y pistas del boceto; la tabla de 6.4; que la forma cambie en su lugar y nunca por redibujo; que los subagentes no evolucionen; que el acto no corra fuera de la vista; un dueño por capa (3.2). Cualquier pose o juego nuevo para las especies vuelve a diseño (10).

## 14. Correcciones al boceto

- Ninguna en el dibujo. Dos contradicciones con el código, resueltas acá: la clave `mascota` se perdería con `escribir` de `preferencias.rs` (9.1), y "coordina" debe salir de los subagentes trabajando y no de `animoSesion` (6.1), que con una pregunta propia dice `teEspera`.
- El boceto inclina el cuerpo hacia el puntero usando `g.trans`; en el widget la mirada es la de marcaMotion.js (`objetivoMirada`) y `g.trans` queda solo para los actos.

## 15. Decisiones del usuario (2026-11-23)

- Pedido: «quiero que delfina me haga 6 nuevos diseños de la mascota avi. Quiero que se inspire en cosas como "digimon", "dragones". Con animaciones espectaculares, super profesionales.» y «quiero primero los 6 diseños de delfina de los avis, diferentes tipo de mascotas, inspirate en lo que ya te pase».
- Las seis no reemplazan al Avi: se suman y el usuario elige su mascota en una futura pantalla de Configuración (decisión transmitida por el orquestador, sin cita textual).
- Evolución: «me encantan los nuevos avis, quisiera que todos evoluciones. La logica seria que mientras haya alguno coordinando equipo, se mantiene evolucionado».
- Cerradas en la ronda 2 (transmitidas por el orquestador): evoluciona la tarjeta de la sesión que coordina, y la marca y la muesca mientras alguna sesión coordine; los subagentes no evolucionan; vuelve a la forma base 20 s después de quedarse sin equipo, con su propia animación, y sin parpadeo si se relanza un subagente antes; el acto estrella es la evolución (Nodo Ω como vara); el Avi de hoy también evoluciona; efectos de estado iguales en todas y manos del color de cada mascota.
- Subagentes: «misma especie, pero otros diseños similares a la especie, como quedarian?».
- Aprobación del boceto: «Sí, quedan así».
- Respuestas a los pendientes de esta dirección:
  - P1, subagentes de la especie Avi: «Mantener el elenco por nombre».
  - P2 y P3, voz del resumen y juegos de la marca: «Acepto sus propuestas» (entrega 5, después de las variantes).
  - S1, primeros pasos: «La elegida».
  - S2, caras de Claude de 44 px o menos: «Sí, también».
  - S3, pantalla dividida: «Sí, cada una con su regla».
  - S4, sesiones que ya coordinan al abrir: «Hace el acto al abrir».
  - S5, escalonado de 250 ms: queda como se propuso.

## 16. Revisión de la implementación (2026-11-23)

Revisión de diseño de las entregas 1 a 5 (rama `feat/24-mascotas`, sin commitear) contra esta dirección y el boceto. **Veredicto: aprobado con cambios** (los cinco must-fix antes de cerrar).

**Cómo se midió.** `dev/vista.html` servido en local, Playwright a 1440, 768 y 375 (zoom 100, 125 y 200). Hoja de las 7 especies × 13 poses a 96 en las dos formas, armada con `avi()` del propio `src/`; muesca arriba (Glaciar) e izquierda (Aurora) a 200 %, y arriba con Nodo a 375 (medida la caja: 150 × 54, centrada); tiempos con `&registro`; pausa con `?pausa`; primeros pasos con `?vacio&pp=sinmod`; nombres accesibles, clases `chica`/`evo-fino`/`sello` y animaciones con `getComputedStyle`. Consola sin errores.

**Lo que está bien (medido).** Las 14 formas siguen al boceto en dibujo, paleta y luz de piso; los subagentes nunca llevan `evol`. `revela` cae donde dice 8.2 (Ascua 1320, Escarcha 963, Morro 1353 ms desde el acto). La vuelta sale a los 20,0 s de que el sondeo ve el equipo vacío, con el escalonado de 243 ms entre tarjeta y marca, y `evol` se va a los 318 ms (8.3: 320). El acto pendiente de la apertura sale la primera vez que la tarjeta se ve, una sola vez. Las caras chicas cambian sin acto, esconden `evo-fino` y el sello, y no corren los bucles de la forma evolucionada. Con pausa no hay actos, `.evo-p` funde en .3 s, `.ev` y `.talla` cambian sin transición y no corre ninguna animación. El temblor de Morro mueve `.esc` (el escenario entero). Primeros pasos muestra la mascota elegida.

### 16.1 Must-fix

1. **El pulgar del saludo flota debajo de la figura** en las seis especies nuevas (pose `saluda`: primeros pasos, la marca, la hoja). Medido: en primeros pasos (104 px) el pulgar queda en y = 107, fuera del SVG; a 300 px, 30 px por debajo de los pies. Causa: `.avi .mano { transform-box: fill-box }` (avis.css:21) cambia el centro del `transform="rotate(-35 97.6 65.5)"` del pulgar. El boceto tiene el mismo error (su regla `.m .mano`); esta revisión lo corrige. **Archivo:** `widget/src/avis.js`, `efectosEspecie`, caso `saluda`: el pulgar (`cx="97.6"`) deja la clase `mano` (queda solo con `fill`), o lleva `style="transform-box:view-box"`. Test en `avis.test.js`: el pulgar del saludo no lleva la clase `mano`.
2. **Nombre accesible viejo después del acto.** Con Ascua y la marca evolucionada se lee "Claude (Ascua), esperándote" en lugar de "Claude (Pira), …" (12). `aplicarFormas` saltea con `continue` las figuras ocupadas por un acto, y el acto pone `evol` sin llamar a `nombrarFigura`. **Archivo:** `widget/src/main.js`, `aplicarFormas`: llamar `nombrarFigura(svg, st.formas.has(svg.dataset.evo))` antes del `if (movimientoEvolucion.ocupada(svg)) continue` (el nombre sigue al estado, no al dibujo).
3. **La muesca corta los costados de las formas anchas.** Glaciar, Pira y Aurora (alas y cintas) quedan cortadas en línea recta por el recorte `.asoma` de 52 px, a los dos lados. muesca-avi-ux.md dice "overflow hidden (corta solo abajo)", y en el boceto la figura se corta solo contra la caja de la muesca. **Archivo:** `widget/src/estilos.css:541`: en `#muesca .asoma`, cambiar `overflow: hidden` por `clip-path: inset(-40px -48px 0 -48px)`, así corta solo en el alféizar; a los costados manda la caja de la muesca (150 o 62). Revisar en los cuatro bordes al 100 y al 200 %.
4. **Las manos del alféizar siguen crema en todas las especies.** Contradice la decisión del 15 («manos del color de cada mascota»). **Archivos:** `widget/src/estilos.css:550`, `#muesca .asir`: `background: var(--mano-muesca, #F1E8D4)` y la sombra con `color-mix(in srgb, var(--mano-muesca, #F1E8D4) 80%, #000)`. `widget/src/muesca.js` (o `main.js`, donde se monta la muesca): poner `--mano-muesca` en `#muesca` con `datosEspecie(st.mascota)` y su `mano`.
5. **La cara del subagente que pregunta no usa su variante.** `quienPregunta` (`widget/src/pregunta.js:14`) usa `personajeDeNombre` aunque la mascota sea otra especie, y 3.1 pide la elegida con su variante. **Archivo:** `pregunta.js`: con una especie que no es el Avi, la cara sale de `personajeSubagente(agente, mascota, variantesEquipo(sesion.agentes))`. Con el Avi queda igual (P1). Además, cambiar el test que fija el comportamiento de hoy (`especies.test.js:177`).

### 16.2 Corrección a esta dirección (7.3, la tomo como propia)

6. **Con una segunda tanda de subagentes, la regla de 7.3 repite variantes a la vista.** Caso medido (`?mascota=lumen&equipo=4`): 4 trabajando y 2 terminados hace menos de 30 min. Los terminados, más antiguos, toman las variantes 0 y 3, y **tres de los cuatro que trabajan salen como Seda** (Delfina, Pixel y Bruno: 1, 1, 1). Es el caso común (lanzar otra tanda), no uno raro como suponía 7.3.3. **Regla corregida, pura y estable:** al recorrer por `desde`, un subagente choca solo con los anteriores que **seguían trabajando cuando él arrancó** (`hasta == null || hasta > desde`). El intervalo de un anterior frente al `desde` de uno posterior no cambia después, así que nadie cambia de variante. En el caso medido da 1, 2, 3, 0. Los ids de la tabla de 7.3 no tienen `hasta` y dan lo mismo; los tests 1 a 6 siguen valiendo. Test nuevo: dos terminados antes y cuatro trabajando dan cuatro variantes distintas. **Archivo:** `widget/src/logica.js`, `variantesEquipo`. Cambia una regla escrita: el orquestador confirma antes de implementarla.

### 16.3 Nice-to-have

1. La luz de cara de la muesca trabajando (`#muesca .asoma::after`, `estilos.css:560`) es ámbar del Avi en todas las especies. Con `--c` de la especie (`color-mix(in srgb, var(--c-muesca) 38%, transparent)`) Nodo y Bruma se ven más propios.
2. La fila de 4 subagentes a 768 con zoom 125 se sale del panel (el panel no cabe en el área). Pasa también sin mascotas, no es de esta tarea: queda para estilo-avis.

### 16.4 Sin verificar (no lo cierra esta revisión)

- 60 fps de 8.5 (aceptación de la entrega 3): medir con el panel de rendimiento en la app Tauri con zoom 200, 3 tarjetas, la marca, la muesca y un acto.
- `npm run tauri dev` con anime.js desde `vendor/`, y elegir la mascota editando `preferencias.json`.
- `prefers-reduced-motion` real: lo revisé por código (`especies.css` y `aplicarFormas` usan la misma condición que la pausa) y con `?pausa`; Playwright no emuló la preferencia.
