import { createHmac, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'central_session'

function secret() {
  const s = process.env.CENTRAL_SESSION_SECRET
  if (!s || s.length < 16) throw new Error('Define CENTRAL_SESSION_SECRET (16+ caracteres) en .env')
  return s
}

export function signSession(days = 30): string {
  const exp = Date.now() + days * 864e5
  const sig = createHmac('sha256', secret()).update(String(exp)).digest('hex')
  return `${exp}.${sig}`
}

export function verifySession(token?: string): boolean {
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const good = createHmac('sha256', secret()).update(exp).digest('hex')
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good))
}

export function checkPassword(pw: string): boolean {
  const real = process.env.CENTRAL_PASSWORD ?? ''
  return !!real && pw.length === real.length && timingSafeEqual(Buffer.from(pw), Buffer.from(real))
}

/** Primer valor de x-forwarded-proto (puede venir "https,http" con varios proxies encadenados), normalizado. */
export function forwardedProto(h: Headers): string {
  return h.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase() ?? ''
}

/**
 * Si la petición llegó por HTTPS. Solo se considera HTTP (y se quita `Secure` de la cookie) cuando
 * la cabecera lo dice explícitamente; sin cabecera o con cualquier otro valor se asume HTTPS, para
 * no perder `Secure` sin aviso si algún día hay más de un proxy delante.
 */
export function isHttps(h: Headers): boolean {
  return forwardedProto(h) !== 'http'
}

// Desbloqueo temporal de secretos: token distinto del de sesión (prefijo propio en la firma).
export const UNLOCK_COOKIE = 'central_unlock'
export const UNLOCK_MINUTES = 15

export function signUnlock(): string {
  const exp = Date.now() + UNLOCK_MINUTES * 60e3
  const sig = createHmac('sha256', secret()).update(`unlock:${exp}`).digest('hex')
  return `${exp}.${sig}`
}

/** Hasta cuándo dura el desbloqueo (ms), o null si el token no es válido. */
export function verifyUnlock(token?: string): number | null {
  if (!token) return null
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return null
  const good = createHmac('sha256', secret()).update(`unlock:${exp}`).digest('hex')
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good)) ? Number(exp) : null
}
