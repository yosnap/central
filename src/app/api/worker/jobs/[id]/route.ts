import { z } from 'zod'
import { finishJob, workerAuthorized } from '@/lib/worker'

/** El trabajador devuelve el resultado (o el error) de un trabajo. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerAuthorized(req)) return new Response('No autorizado', { status: 401 })
  const body = z.object({ result: z.unknown().optional(), error: z.string().max(2000).optional() }).parse(await req.json())
  await finishJob((await params).id, body)
  return Response.json({ ok: true })
}
