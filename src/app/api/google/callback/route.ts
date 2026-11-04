import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession, signSession, isHttps } from '@/lib/auth'
import { callbackPath, completeOAuth, verifyState } from '@/lib/google'

/** Vuelta de Google: guarda la cuenta y vuelve a Ajustes con el resultado. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const back = (q: string) => Response.redirect(new URL(`/ajustes?${q}#google`, url), 303)
  if (url.searchParams.get('error')) return back('google=cancelado')
  if (!verifyState(url.searchParams.get('state'))) return back('google=caducado')
  const cStore = await cookies()
  if (!verifySession(cStore.get(SESSION_COOKIE)?.value)) {
    cStore.set(SESSION_COOKIE, signSession(), { httpOnly: true, sameSite: 'lax', secure: isHttps(req.headers), path: '/', maxAge: 30 * 86400 })
  }
  try {
    const c = await completeOAuth(url.searchParams.get('code') ?? '', `${url.origin}${callbackPath}`)
    return back(`google=ok&cuenta=${encodeURIComponent(c.account ?? '')}`)
  } catch (e) {
    return back(`google=error&motivo=${encodeURIComponent((e as Error).message.slice(0, 200))}`)
  }
}
