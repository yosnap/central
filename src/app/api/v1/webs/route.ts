import { z } from 'zod'
import { listWebsites } from '@/lib/api/websites'
import { apiRoute, json, query } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

const Query = z.object({ tipo: z.enum(['CLIENT', 'OWN', 'CENTRAL']).optional(), caidas: z.enum(['0', '1']).optional() })

/** Webs monitorizadas con su último estado; `caidas=1` deja solo las caídas. */
export const GET = apiRoute('lectura', async (req) => {
  const p = query(req, Query)
  return json({ websites: await listWebsites({ kind: p.tipo, onlyDown: p.caidas === '1' }) })
})
