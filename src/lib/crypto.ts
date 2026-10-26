import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Cifra/descifra secretos de integraciones con AES-256-GCM. Clave: CENTRAL_ENCRYPTION_KEY (32 bytes en base64). */
function key(): Buffer {
  const k = Buffer.from(process.env.CENTRAL_ENCRYPTION_KEY ?? '', 'base64')
  if (k.length !== 32) throw new Error('CENTRAL_ENCRYPTION_KEY debe ser 32 bytes en base64 (openssl rand -base64 32)')
  return k
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()])
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.')
}

export function decryptJson<T = Record<string, string>>(payload?: string | null): T | null {
  if (!payload) return null
  const [iv, tag, data] = payload.split('.').map((s) => Buffer.from(s, 'base64'))
  const d = createDecipheriv('aes-256-gcm', key(), iv)
  d.setAuthTag(tag)
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8')) as T
}
