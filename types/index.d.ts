// Contrato de datos del mod "oficina".

/** Lo que cada integrante publica en su comentario del Issue "Presencia". */
export type Presencia = {
  v: 1
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
  presencia: Presencia
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
