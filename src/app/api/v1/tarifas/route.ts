import { listRates } from '@/lib/api/quotes'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Tarifas en uso (precio sin IVA en euros), para rellenar un borrador. */
export const GET = apiRoute('presupuestos', async () => json({ rates: await listRates() }))
