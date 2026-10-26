import fs from 'node:fs/promises'
import path from 'node:path'
import { storageDir } from '@/lib/quote-ai'
import { workerAuthorized } from '@/lib/worker'

/** El trabajador baja los documentos que se subieron al asistente, para que Claude Code los lea en el Mac. */
export async function GET(req: Request, { params }: { params: Promise<{ quoteId: string; name: string }> }) {
  if (!workerAuthorized(req)) return new Response('No autorizado', { status: 401 })
  const { quoteId, name } = await params
  const dir = storageDir(quoteId)
  const file = path.join(dir, path.basename(decodeURIComponent(name)))
  if (!file.startsWith(dir + path.sep)) return new Response('No', { status: 400 })
  try { return new Response(new Uint8Array(await fs.readFile(file)), { headers: { 'content-type': 'application/octet-stream' } }) } catch { return new Response('No existe', { status: 404 }) }
}
