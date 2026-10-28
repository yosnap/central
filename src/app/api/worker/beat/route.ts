import { z } from 'zod'
import { beatAndClaim, workerAuthorized } from '@/lib/worker'

/** El trabajador del Mac avisa de que está vivo y recoge los trabajos pendientes. */
export async function POST(req: Request) {
  if (!workerAuthorized(req)) return new Response('No autorizado', { status: 401 })
  const info = z.object({ hostname: z.string().max(120).optional(), version: z.string().max(40).optional(), roots: z.array(z.string().max(500)).max(20).optional(), adminKey: z.string().regex(/^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( [^\n]{0,100})?$/).optional() }).parse(await req.json().catch(() => ({})))
  return Response.json({ jobs: await beatAndClaim(info) })
}
