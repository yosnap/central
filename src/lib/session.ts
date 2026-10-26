import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySession } from './auth'

export async function requireSession() {
  const c = await cookies()
  if (!verifySession(c.get(SESSION_COOKIE)?.value)) redirect('/login')
}
