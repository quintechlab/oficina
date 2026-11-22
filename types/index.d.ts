// Contrato de datos del mod "oficina".

/** Lo que cada integrante publica en su comentario del Issue "Presencia". */
export type Presencia = {
  v: 1
  /** Id de la sesión de Claude Code que publicó esta entrada (una persona puede tener varias abiertas). */
  sesion: string
  /** Usuario de GitHub. */
  usuario: string
  /** Nombre visible (Quintana, Campos). */
  nombre: string
  estado: 'trabajando' | 'fuera'
  /** owner/repo en el que está, o null si no está en un repositorio. */
  repo: string | null
  rama: string | null
  /** Número del Issue en el que trabaja, detectado de la rama o fijado con /oficina tarea N. */
  tarea: number | null
  /** Texto libre fijado con /oficina nota. */
  nota: string | null
  /** Cuándo empezó la sesión actual sobre esta tarea (ISO). */
  inicio: string | null
  /** Primera vez que se lo vio sobre esta tarea (ISO). */
  tareaDesde: string | null
  /** Última publicación (ISO). */
  actualizado: string
  /** Archivos que su rama cambia respecto de main (hasta 40). */
  archivos: string[]
  /** Qué hace la sesión ahora, según su última herramienta ("editando register.tsx"). Desde la v0.4. */
  actividad?: string | null
  /** Subagentes en curso o terminados hace poco. Desde la v0.4. */
  agentes?: Subagente[]
  /** Preguntas de AskUserQuestion que esperan respuesta. Desde la v0.4. */
  preguntas?: Pregunta[]
  /** Esta sesión acepta respuestas del widget de escritorio (archivo en ~/.claude/oficina/respuestas). Desde la v0.5. */
  puedeResponder?: boolean
  /** Procesos en segundo plano de la sesión (Bash con run_in_background) que todavía no avisaron que terminaron. Desde la v0.6. */
  procesos?: Proceso[]
  /** Conversaciones con otras sesiones (SendMessage) que esta sesión recibió hace poco. Desde la v0.8. */
  conversa?: Conversa[]
}

/**
 * Una conversación con otra sesión, vista desde los mensajes que esta sesión recibió. Nunca lleva
 * el contenido. Cuándo terminó lo deduce el widget (5 min sin mensajes, o la otra sesión se fue).
 */
export type Conversa = {
  /** Id de la otra sesión ($.session.id() de la otra), sacado de la marca de su mensaje. */
  con: string
  /** El `repo` que publica la otra sesión, para nombrarla aunque su presencia no se vea. */
  conRepo: string | null
  /** Cuándo empezó (ISO). */
  desde: string
  /** Quién mandó el primer mensaje. */
  empezo: 'yo' | 'otro'
  /** El último mensaje: quién lo mandó y cuándo (ISO). */
  ultimo: { de: 'yo' | 'otro'; cuando: string }
}

/** Un proceso en segundo plano lanzado por la sesión. */
export type Proceso = {
  /** Id de la tarea que da el motor (`backgroundTaskId`, el `<task-id>` de su aviso). */
  id: string
  /** La descripción del comando, o el comando, recortada a 80 caracteres. */
  descripcion: string
  /** Cuándo arrancó (ISO). */
  desde: string
}

/** Un subagente lanzado por una sesión. */
export type Subagente = {
  /** Id del agente que da el motor (`agentId`). */
  id: string
  /** De la descripción "Nombre — tarea", o inventado a partir del id. */
  nombre: string
  inventado: boolean
  /** Tipo de agente (general-purpose, Explore, ...). */
  tipo: string
  tarea: string
  /** Cuándo arrancó (ISO). */
  desde: string
  estado: 'trabajando' | 'listo' | 'fallo'
  /** Cuándo terminó (ISO), o null mientras trabaja. */
  hasta: string | null
  /** Qué hace ahora, según su última herramienta ("editando tablero.js"); null al terminar. Desde la v0.9. */
  actividad?: string | null
  /** Sus últimos pasos (hasta 5), del más viejo al más nuevo. Desde la v0.9. */
  pasos?: Paso[]
}

/** Un paso de un subagente: la actividad de una herramienta y cuándo la usó. */
export type Paso = { texto: string; cuando: string }

export type OpcionPregunta = { etiqueta: string; descripcion: string }

export type ItemPregunta = {
  pregunta: string
  encabezado: string
  multiple: boolean
  opciones: OpcionPregunta[]
}

/**
 * Respuesta que deja el widget en ~/.claude/oficina/respuestas/<id de la pregunta>.json.
 * `answers` va por texto de pregunta: una etiqueta, varias separadas por ", " (selección múltiple)
 * o el texto libre de "Otra respuesta", que se marca en `libres`.
 */
export type RespuestaWidget = {
  v: 1
  origen: 'widget'
  /** Cuándo se tocó la opción (ISO). */
  tocadoEn: string
  answers: Record<string, string>
  /** Preguntas respondidas con texto libre. */
  libres?: string[]
}

/** Una llamada a AskUserQuestion pendiente (puede traer varias preguntas). */
export type Pregunta = {
  /** tool_use_id de la llamada. */
  id: string
  /** Id del subagente que pregunta, o null si pregunta la sesión. */
  agente: string | null
  desde: string
  items: ItemPregunta[]
}

/**
 * El comentario de una persona en el Issue "Presencia" (formato v2): una entrada por cada sesión
 * de Claude Code abierta, para que una sesión no pise lo que publica otra.
 */
export type ComentarioPresencia = {
  v: 2
  usuario: string
  nombre: string
  /** Marcado con /oficina fuera: la persona se fue aunque tenga sesiones abiertas. */
  ausente: boolean
  /** Última escritura del comentario (ISO). */
  actualizado: string
  sesiones: Presencia[]
}

export type Ci = 'ok' | 'falla' | 'pendiente' | 'sin'

export type Pr = {
  numero: number
  titulo: string
  url: string
  ci: Ci
  borrador: boolean
}

export type Tarea = {
  numero: number
  titulo: string
  talle: 'S' | 'M' | null
  abierta: boolean
  url: string
  /** Campo "Tiempo real" del tablero, en horas, si existe. */
  horasRegistradas: number | null
  /** Campo "Status" del tablero, si existe. */
  estadoTablero: string | null
}

export type Miembro = {
  /** La sesión que se muestra: la más relevante entre las abiertas (ver elegirPrincipal). */
  presencia: Presencia
  /** Otras sesiones activas en otros repositorios o tareas. */
  otras: Presencia[]
  /** Todas sus sesiones vivas, la principal primero. */
  sesiones: Presencia[]
  tarea: Tarea | null
  prs: Pr[]
  ultimoCommit: { fecha: string; mensaje: string } | null
  esYo: boolean
}

export type Info = {
  yo: string | null
  error: string | null
  /** Última lectura de GitHub (ISO). */
  actualizado: string | null
  datos: string
}

declare module 'claude-code' {
  interface PluginState {
    oficina: {
      miembros: Shaped<Miembro[]>
      info: Info
    }
  }
}
