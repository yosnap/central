import { cookies, headers } from 'next/headers'
import { UNLOCK_COOKIE, UNLOCK_MINUTES, checkPassword, isHttps, signUnlock, verifyUnlock } from './auth'

/** Hasta cuándo están desbloqueados los secretos (ms), o null. */
export async function unlockedUntil(): Promise<number | null> {
  return verifyUnlock((await cookies()).get(UNLOCK_COOKIE)?.value)
}

export async function unlockWithPassword(password: string): Promise<boolean> {
  if (!checkPassword(password)) return false
  const [c, h] = await Promise.all([cookies(), headers()])
  c.set(UNLOCK_COOKIE, signUnlock(), {
    httpOnly: true, sameSite: 'strict', secure: isHttps(h), path: '/', maxAge: UNLOCK_MINUTES * 60,
  })
  return true
}

export async function lock() {
  ;(await cookies()).delete(UNLOCK_COOKIE)
}
