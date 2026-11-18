/**
 * Autenticación de la API v1 con claves de Ajustes → «Apps conectadas».
 * 401 genérico sin clave, con una clave desconocida o revocada; 403 si le falta el permiso; 429 pasado el límite.
 * Nunca registra la cabecera `Authorization` ni la clave.
 */
import { VISIBLE_PREFIX_LENGTH, bearerKey, hashApiKey, sameHash, type ApiScope } from './keys'

export type StoredKey = { id: string; hash: string; scopes: string[]; revokedAt: Date | null; lastUsedAt: Date | null }

export type KeyStore = {
  findByPrefix(prefix: string): Promise<StoredKey[]>
  /** Apunta el último uso. Puede fallar sin cortar la petición. */
  touch(id: string, at: Date): Promise<void>
}

export type ApiCaller = { id: string; scopes: string[] }
export type AuthResult = { ok: true; caller: ApiCaller } | { ok: false; response: Response }

export const RATE_LIMIT = 120
const WINDOW_MS = 60_000
/** El último uso se guarda como mucho una vez por minuto y clave. */
const TOUCH_EVERY_MS = 60_000

const NO_STORE = { 'cache-control': 'no-store' }

export function apiError(status: number, error: string, extra: Record<string, string> = {}, headers: Record<string, string> = {}): Response {
  return Response.json({ error, ...extra }, { status, headers: { ...NO_STORE, ...headers } })
}

const unauthorized = () => apiError(401, 'unauthorized', {}, { 'www-authenticate': 'Bearer' })

/** Crea el comprobador con su almacén y su propio límite en memoria (uno por proceso). */
export function createApiAuth(store: KeyStore, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>()

  function overLimit(id: string): number | null {
    const t = now()
    const w = windows.get(id)
    if (!w || t - w.start >= WINDOW_MS) {
      windows.set(id, { start: t, count: 1 })
      return null
    }
    w.count += 1
    return w.count > RATE_LIMIT ? Math.max(1, Math.ceil((w.start + WINDOW_MS - t) / 1000)) : null
  }

  return async function requireApiKey(req: Request, scope: ApiScope | null): Promise<AuthResult> {
    const key = bearerKey(req)
    if (!key) return { ok: false, response: unauthorized() }
    const hash = hashApiKey(key)
    const rows = await store.findByPrefix(key.slice(0, VISIBLE_PREFIX_LENGTH))
    const row = rows.find((r) => sameHash(r.hash, hash))
    if (!row || row.revokedAt) return { ok: false, response: unauthorized() }
    const retry = overLimit(row.id)
    if (retry !== null) return { ok: false, response: apiError(429, 'rate_limited', {}, { 'retry-after': String(retry) }) }
    if (scope && !row.scopes.includes(scope)) return { ok: false, response: apiError(403, 'forbidden', { scope }) }
    const at = new Date(now())
    if (!row.lastUsedAt || at.getTime() - row.lastUsedAt.getTime() >= TOUCH_EVERY_MS) {
      store.touch(row.id, at).catch(() => console.error('[api] no se ha podido apuntar el último uso de una clave'))
    }
    return { ok: true, caller: { id: row.id, scopes: row.scopes } }
  }
}

const prismaStore: KeyStore = {
  async findByPrefix(prefix) {
    const { prisma } = await import('../prisma')
    return prisma.apiKey.findMany({ where: { prefix }, select: { id: true, hash: true, scopes: true, revokedAt: true, lastUsedAt: true } })
  },
  async touch(id, at) {
    const { prisma } = await import('../prisma')
    await prisma.apiKey.update({ where: { id }, data: { lastUsedAt: at } })
  },
}

/** Comprobador de la app, con las claves de la BD. */
export const requireApiKey = createApiAuth(prismaStore)
