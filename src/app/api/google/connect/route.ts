import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'
import { authUrl, callbackPath, googleApp } from '@/lib/google'

/** Empieza la conexión de una cuenta de Google: lleva a la pantalla de permisos de Google. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) {
    return Response.redirect(new URL('/login', url), 303)
  }
  const app = await googleApp()
  if (!app) return Response.redirect(new URL('/ajustes?google=sin-cliente#google', url), 303)
  return Response.redirect(authUrl(app, `${url.origin}${callbackPath}`, url.searchParams.get('cuenta') ?? undefined), 303)
}
