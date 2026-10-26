import { renderToBuffer } from '@react-pdf/renderer'
import { loadQuoteDoc } from '@/lib/quote-doc-data'
import { QuotePdf } from '@/lib/quote-pdf'

/** PDF del presupuesto: se abre en el navegador, o se descarga con `?descargar=1`. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await loadQuoteDoc((await params).id)
  if ('error' in r) return r.error
  const pdf = await renderToBuffer(<QuotePdf q={r.q} brand={r.brand} art={r.art} />)
  return new Response(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': r.disposition('pdf', new URL(req.url).searchParams.has('descargar')), 'cache-control': 'private, no-store' },
  })
}
