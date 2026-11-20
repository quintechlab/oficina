# Fuentes del widget

Las dos fuentes del estilo Avis van empaquetadas acá; el widget no las pide a la red. Las dos son
SIL Open Font License 1.1: el texto completo está en `OFL-manrope.txt` y `OFL-martian-mono.txt`,
con el aviso de copyright de cada una (sacado de la tabla `name` de la fuente).

| Archivo | Fuente | Qué trae | Origen |
|---|---|---|---|
| `manrope-latin.woff2` | Manrope 4.505 | Variable, peso 400 a 800, subconjunto latino de Google Fonts (á é í ó ú ñ ü ¿ ¡ « » · —) | `fonts.googleapis.com/css2?family=Manrope:wght@400..800` → `fonts.gstatic.com/s/manrope/v23/` |
| `manrope-simbolos.woff2` | Manrope 4.505 | Solo → ✓ ▾, que el subconjunto latino no trae | La misma familia con `&text=→✓▾` |
| `martian-mono-latin.woff2` | Martian Mono 1.000 | Ancho 75 (angosta), peso 400 a 600, subconjunto latino | `fonts.googleapis.com/css2?family=Martian+Mono:wdth,wght@75,400..600` → `fonts.gstatic.com/s/martianmono/v6/` |

- Copyright 2019 The Manrope Project Authors (https://github.com/googlefonts/manrope).
- Copyright 2020 The Martian Mono Project Authors (https://github.com/evilmartians/mono).

Descargadas el 20/11/2026. Los `@font-face` están al principio de `estilos.css`, con el mismo
`unicode-range` que publica Google Fonts.
