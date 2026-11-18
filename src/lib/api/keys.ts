/**
 * Claves de acceso de la API v1: formato, huella y permisos. Sin dependencias de Next ni de la BD.
 * La clave completa es `cen_` + 32 bytes aleatorios en base64url; en la BD solo queda su SHA-256 y el prefijo.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export { API_SCOPES, SCOPE_LABEL, isApiScope, type ApiScope } from './scopes'

const KEY_PREFIX = 'cen_'
/** Caracteres visibles para reconocer la clave en Ajustes (`cen_` + 8). */
export const VISIBLE_PREFIX_LENGTH = KEY_PREFIX.length + 8
const KEY_PATTERN = /^cen_[A-Za-z0-9_-]{43}$/

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/** Clave nueva: se devuelve completa una sola vez; guarda solo `prefix` y `hash`. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  return { key, prefix: key.slice(0, VISIBLE_PREFIX_LENGTH), hash: hashApiKey(key) }
}

/** Lee `Authorization: Bearer <clave>`; null si falta o no tiene la forma de una clave de Central. */
export function bearerKey(req: Request): string | null {
  const raw = req.headers.get('authorization')
  const m = raw?.match(/^Bearer\s+(\S+)\s*$/i)
  return m && KEY_PATTERN.test(m[1]) ? m[1] : null
}

/** Compara dos huellas hex en tiempo constante. */
export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}
