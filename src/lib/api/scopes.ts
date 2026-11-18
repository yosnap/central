/** Permisos de las claves de la API v1. Sin dependencias de Node: lo usa también el formulario de Ajustes. */
export const API_SCOPES = ['lectura', 'presupuestos', 'escritura'] as const
export type ApiScope = (typeof API_SCOPES)[number]

export const SCOPE_LABEL: Record<ApiScope, string> = {
  lectura: 'Lectura (clientes, proyectos, webs, servidores, alertas, agenda)',
  presupuestos: 'Presupuestos (ver, descargar y crear borradores)',
  escritura: 'Escritura (crear y cambiar clientes, proyectos, notas y fases de presupuestos; nunca borrar). Incluye lectura',
}

/** Permisos que se pueden conceder desde Ajustes. */
export const GRANTABLE_SCOPES = API_SCOPES

/**
 * Permisos de las rutas de escritura. `escritura` implica `lectura`: una escritura devuelve la entidad (y, en un
 * conflicto, la actual), así que sin lectura serviría para leer. El primero es el que se nombra en el 403.
 */
export const WRITE_SCOPES = ['escritura', 'lectura'] as const satisfies readonly ApiScope[]

/** Permisos que se guardan al crear una clave: con `escritura` va siempre `lectura`. */
export function withImpliedScopes<T extends ApiScope>(scopes: readonly T[]): ApiScope[] {
  const out: ApiScope[] = [...new Set(scopes)]
  if (out.includes('escritura') && !out.includes('lectura')) out.unshift('lectura')
  return out
}

export const isApiScope = (s: string): s is ApiScope => (API_SCOPES as readonly string[]).includes(s)
