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

## Desarrollo

```
claude plugin validate .
claude plugin test .
```

Para probarlo sin instalar: `claude --plugin-dir <carpeta>`. Los archivos: `hooks/register.tsx` (el mod), `hooks/logica.ts` (funciones puras, con tests en `hooks/oficina.test.tsx`), `types/index.d.ts` (contrato de datos).
