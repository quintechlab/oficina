# Oficina · Quintech Studio

Panel para Claude Code que muestra, en vivo, en qué está cada integrante del equipo: proyecto, rama, número de tarea, desde cuándo, cuánto tiempo estimado le queda, PRs abiertos con el estado del CI y archivos que los dos tocan a la vez. Es la "oficina" de Quintana y Campos: cada uno lo instala en su máquina y entra con su propia cuenta de GitHub.

No tiene servidor propio. La fuente de verdad es GitHub: los Issues y el tablero que ya usa el equipo, más un Issue "Presencia" en un repositorio **privado** donde cada integrante actualiza un comentario propio con su estado. El mod nunca guarda contraseñas ni tokens: usa el `gh` ya autenticado de cada máquina.

## Qué muestra

Por integrante, con avatar y estado (● trabajando, ◐ sin señales hace más de 20 min, ○ fuera):

- Repositorio y rama en la que está.
- Tarea en curso (`#42 Título`), talle (S o M) y estado en el tablero.
- Desde qué hora trabaja y cuánto lleva; si la tarea viene de otro día, desde cuándo.
- Tiempo estimado que le queda: presupuesto del talle (S: 4 h, M: 16 h) menos las horas cargadas en el campo "Tiempo real" del tablero y la sesión actual. Si el Issue no tiene talle, no se inventa: dice "sin estimación".
- PRs abiertos con el CI en verde, rojo o pendiente.
- Nota libre ("viendo el bug del login").
- Aviso cuando el otro toca los mismos archivos que vos en el mismo repositorio.
- Último commit.

Además avisa con un mensaje breve cuando el otro arranca una tarea, abre un PR, le falla el CI, entra o se va, y deja un resumen en la barra de estado.

## Instalación

En una terminal con Claude Code:

```
/plugin install oficina --marketplace QuintechLabs/oficina
```

Responder `y` para agregar el marketplace y elegir el alcance de usuario. En la aplicación de escritorio: `+` junto al cuadro de texto → Plugins → Add marketplace con `QuintechLabs/oficina` → Add plugin.

Desde una shell: `claude plugin install oficina --marketplace QuintechLabs/oficina`.

Requisitos: `gh` instalado y autenticado (`gh auth login`) con los permisos `repo` y `project` (`gh auth refresh -s project` si falta). Para los datos del tablero hace falta ser miembro de la organización.

## Primera vez

1. Quien instala primero corre `/oficina init`: crea el repositorio privado de datos (`QuintechLabs/oficina-datos`) y el Issue "Presencia".
2. Invita al otro integrante como colaborador de ese repositorio (el comando lo imprime `init`).
3. Cada uno, en `/config`, completa la opción **Nombres visibles** con los dos usuarios: `nicoequintana=Quintana,<usuario>=Campos`.

A partir de ahí el panel se abre solo al iniciar cada sesión.

## Comandos

| Comando | Qué hace |
|---|---|
| `/oficina` | Abre el panel y actualiza |
| `/oficina tarea 42` | Fija la tarea actual (si la rama no sigue `tipo/42-slug`); `/oficina tarea auto` vuelve a detectarla |
| `/oficina nota texto` | Publica una nota corta para el otro; `/oficina nota -` la borra |
| `/oficina fuera` / `/oficina volver` | Marca que te vas o que volviste |
| `/oficina init` | Crea el repositorio de datos y el Issue "Presencia" |
| `/oficina ayuda` | Esta lista |

## Opciones (`/config`)

| Opción | Por defecto | Para qué |
|---|---|---|
| Repositorio de datos | `QuintechLabs/oficina-datos` | Dónde vive el Issue "Presencia" |
| Issue de presencia | `1` | Número de ese Issue |
| Intervalo | `60` | Segundos entre consultas a GitHub |
| Nombres visibles | `nicoequintana=Quintana` | Usuario de GitHub → nombre que se muestra |

## Cómo detecta la tarea

Por la rama, según la convención del equipo: `feat/12-login-google` → tarea `#12`. Si no hay número, `/oficina tarea N`. El talle se lee del cuerpo del Issue creado con el formulario (`### Talle`) o del campo "Talle" del tablero.

## Privacidad

El código es público; los datos no. La presencia (nombre del repositorio, rama, número de tarea, archivos cambiados) se escribe solo en el repositorio privado de datos, que leen únicamente sus colaboradores. Cada consulta a GitHub sale con la sesión `gh` de la máquina de cada uno.

## Desarrollo

```
claude plugin validate .
claude plugin test .
```

Para probarlo sin instalar: `claude --plugin-dir <carpeta>`. Los archivos: `hooks/register.tsx` (el mod), `hooks/logica.ts` (funciones puras, con tests en `hooks/oficina.test.tsx`), `types/index.d.ts` (contrato de datos).
