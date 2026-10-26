import { cookies } from 'next/headers'
import { UNLOCK_COOKIE, UNLOCK_MINUTES, checkPassword, signUnlock, verifyUnlock } from './auth'

/** Hasta cuándo están desbloqueados los secretos (ms), o null. */
export async function unlockedUntil(): Promise<number | null> {
  return verifyUnlock((await cookies()).get(UNLOCK_COOKIE)?.value)
}

export async function unlockWithPassword(password: string): Promise<boolean> {
  if (!checkPassword(password)) return false
  ;(await cookies()).set(UNLOCK_COOKIE, signUnlock(), {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: UNLOCK_MINUTES * 60,
  })
  return true
}

export async function lock() {
  ;(await cookies()).delete(UNLOCK_COOKIE)
}
