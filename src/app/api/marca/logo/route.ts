import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'

/** Logo de la marca guardado en la BD (Ajustes › Marca para presupuestos). */
export async function GET() {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) return new Response('No autorizado', { status: 401 })
  const b = await prisma.brandSettings.findUnique({ where: { id: 'default' }, select: { logoData: true, logoType: true } })
  if (!b?.logoData || !b.logoType) return new Response('Sin logo', { status: 404 })
  return new Response(new Uint8Array(b.logoData), { headers: { 'content-type': b.logoType, 'cache-control': 'private, max-age=60' } })
}
