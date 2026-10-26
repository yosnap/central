import { NextResponse } from 'next/server'
import { getServerPublic, listServersPublic } from '@/lib/servers/public'

export const dynamic = 'force-dynamic'

// Para CostGuard y otras apps: lista y estado de los servidores, sin credenciales.
//   curl -fsS -H "Authorization: Bearer $CENTRAL_API_TOKEN" "http://localhost:3099/api/servidores[?id=<id>]"
export async function GET(req: Request) {
  const expected = process.env.CENTRAL_API_TOKEN
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || token !== expected) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = new URL(req.url).searchParams.get('id')
  if (id) {
    const s = await getServerPublic(id)
    return s ? NextResponse.json(s) : NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ servers: await listServersPublic() })
}
