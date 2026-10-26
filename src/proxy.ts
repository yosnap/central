import { NextResponse, type NextRequest } from 'next/server'

// Comprobación ligera: la firma se valida en el servidor (layout). Aquí solo redirigimos sin cookie.
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/login') || pathname.startsWith('/api/cron') || pathname === '/api/version' || pathname === '/api/servidores' || pathname.startsWith('/api/worker/') || pathname.startsWith('/_next')) return NextResponse.next()
  if (!req.cookies.get('central_session')) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
