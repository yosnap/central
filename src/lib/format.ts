const tz = 'Europe/Madrid'
export const fmtDate = (d?: Date | null) => (d ? new Intl.DateTimeFormat('es-ES', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric' }).format(d) : '—')
export const fmtDateTime = (d?: Date | null) => (d ? new Intl.DateTimeFormat('es-ES', { timeZone: tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d) : '—')
export const fmtTime = (d?: Date | null) => (d ? new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d) : '—')
/** «lunes, 27 de octubre», para agrupar la agenda por días. */
export const fmtDay = (d: Date) => new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(d)
/** AAAA-MM-DD del día en Madrid (clave para agrupar). */
export const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
export function ago(d?: Date | null) {
  if (!d) return '—'
  const days = Math.floor((Date.now() - d.getTime()) / 864e5)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  if (days < 365) { const m = Math.floor(days / 30); return m === 1 ? 'hace 1 mes' : `hace ${m} meses` }
  const y = Math.floor(days / 365)
  return y === 1 ? 'hace 1 año' : `hace ${y} años`
}
export const KIND_LABEL = { CLIENT: 'Cliente', OWN: 'Propio', TRAINING: 'Formación', EXPERIMENT: 'Experimento' } as const
export const STATUS_LABEL = { ACTIVE: 'Activo', MAINTENANCE: 'Mantenimiento', DORMANT: 'Parado', ARCHIVED: 'Archivo' } as const
export const WEB_KIND_LABEL = { CLIENT: 'Cliente', OWN: 'Propia', CENTRAL: 'Centralizada' } as const
export const TYPE_LABEL = {
  WEB_SITE: 'Web corporativa / landing', WEB_APP: 'Aplicación web / SaaS', ECOMMERCE: 'E-commerce', API: 'API / backend',
  ADDON: 'Addon / módulo de un sistema', PLUGIN: 'Plugin / tema de una plataforma', MOBILE_APP: 'App móvil', DESKTOP_APP: 'App de escritorio / utilidad (Mac, Windows)',
  BROWSER_EXTENSION: 'Extensión de navegador', LIBRARY: 'MCP / CLI / librería', SKILL: 'Skill de agente', AUTOMATION: 'Automatización', CONTENT: 'Contenido / formación',
} as const
export const PLATFORM_LABEL = {
  WORDPRESS: 'WordPress', WOOCOMMERCE: 'WooCommerce', PRESTASHOP: 'PrestaShop', SHOPIFY: 'Shopify', N8N: 'n8n', CHROME: 'Chrome', ELEMENTOR: 'Elementor', OTHER: 'Otra',
} as const
export const PURPOSE_LABEL = { DEMO: 'Demostración', SALES: 'Venta', MARKETING: 'Marketing', TUTORIAL: 'Tutorial' } as const
export const QUOTE_STATUS_LABEL = { DRAFT: 'Borrador', SENT: 'Enviado', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado', EXPIRED: 'Caducado' } as const
export const QUOTE_STATUS_TONE = { DRAFT: 'muted', SENT: 'accent', ACCEPTED: 'ok', REJECTED: 'bad', EXPIRED: 'warn' } as const
export const PHASE_STATUS_LABEL = { PENDING: 'Pendiente', IN_PROGRESS: 'En curso', DONE: 'Hecha', INVOICED: 'Facturada' } as const
export const PHASE_STATUS_TONE = { PENDING: 'muted', IN_PROGRESS: 'accent', DONE: 'ok', INVOICED: 'ok' } as const
export const KUMA_STATUS_LABEL: Record<string, string> = { up: 'En línea', down: 'Caída', pending: 'Pendiente', maintenance: 'Mantenimiento' }
export const LEVEL_LABEL: Record<string, string> = { green: 'Bien', amber: 'Mirar', red: 'Actuar', grey: 'Sin dato' }
export const LEVEL_TONE = { green: 'ok', amber: 'warn', red: 'bad', grey: 'muted' } as const
export function fmtBytes(n?: number | null) {
  if (n == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(i >= 3 ? 1 : 0)} ${u[i]}`
}
