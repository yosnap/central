import { loadQuoteDoc } from '@/lib/quote-doc-data'
import { quoteDocx } from '@/lib/quote-docx'

/** Word (.docx) editable del presupuesto. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await loadQuoteDoc((await params).id)
  if ('error' in r) return r.error
  const file = await quoteDocx(r.q, r.brand, r.art)
  return new Response(new Uint8Array(file), {
    headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'content-disposition': r.disposition('docx', true), 'cache-control': 'private, no-store' },
  })
}
