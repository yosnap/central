import { loadQuoteDocData } from '@/lib/quote-doc-data'
import { quoteDocx } from '@/lib/quote-docx'
import { apiRoute, notFound } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Word (.docx) editable del presupuesto. */
export const GET = apiRoute<{ id: string }>('presupuestos', async (_req, { params }) => {
  const r = await loadQuoteDocData(params.id)
  if ('error' in r) return notFound()
  const file = await quoteDocx(r.q, r.brand, r.art)
  return new Response(new Uint8Array(file), {
    headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': r.disposition('docx', true), 'cache-control': 'private, no-store' },
  })
})
