import { renderToBuffer } from '@react-pdf/renderer'
import { loadQuoteDocData } from '@/lib/quote-doc-data'
import { QuotePdf } from '@/lib/quote-pdf'
import { apiRoute, notFound } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** PDF del presupuesto; con `?descargar=1`, como adjunto. */
export const GET = apiRoute<{ id: string }>('presupuestos', async (req, { params }) => {
  const r = await loadQuoteDocData(params.id)
  if ('error' in r) return notFound()
  const pdf = await renderToBuffer(<QuotePdf q={r.q} brand={r.brand} art={r.art} />)
  return new Response(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': r.disposition('pdf', new URL(req.url).searchParams.has('descargar')), 'cache-control': 'private, no-store' },
  })
})
