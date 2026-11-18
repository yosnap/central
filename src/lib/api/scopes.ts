/** Permisos de las claves de la API v1. Sin dependencias de Node: lo usa también el formulario de Ajustes. */
export const API_SCOPES = ['lectura', 'presupuestos', 'escritura'] as const
export type ApiScope = (typeof API_SCOPES)[number]

export const SCOPE_LABEL: Record<ApiScope, string> = {
  lectura: 'Lectura (clientes, proyectos, webs, servidores, alertas, agenda)',
  presupuestos: 'Presupuestos (ver, descargar y crear borradores)',
  escritura: 'Escritura (reservado: aún sin rutas)',
}

export const isApiScope = (s: string): s is ApiScope => (API_SCOPES as readonly string[]).includes(s)
