import { timingSafeEqual } from 'node:crypto'
import { importData } from '@/lib/data-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Datos trabajados en el Mac (bun run produccion:subir). Solo con CENTRAL_API_TOKEN; nunca borra. */
export async function POST(req: Request) {
  const expected = process.env.CENTRAL_API_TOKEN ?? ''
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (expected.length < 32 || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Se esperaba un objeto con las tablas' }, { status: 400 })
  return Response.json(await importData(body))
}
