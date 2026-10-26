import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'
import { callbackPath, completeOAuth, verifyState } from '@/lib/google'

/** Vuelta de Google: guarda la cuenta y vuelve a Ajustes con el resultado. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const back = (q: string) => Response.redirect(new URL(`/ajustes?${q}#google`, url), 303)
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) return new Response('No autorizado', { status: 401 })
  if (url.searchParams.get('error')) return back('google=cancelado')
  if (!verifyState(url.searchParams.get('state'))) return back('google=caducado')
  try {
    const c = await completeOAuth(url.searchParams.get('code') ?? '', `${url.origin}${callbackPath}`)
    return back(`google=ok&cuenta=${encodeURIComponent(c.account ?? '')}`)
  } catch (e) {
    return back(`google=error&motivo=${encodeURIComponent((e as Error).message.slice(0, 200))}`)
  }
}
