import { listPending } from '@/lib/api/pending'
import { apiRoute, json } from '@/lib/api/route'

export const dynamic = 'force-dynamic'

/** Proyectos activos o en mantenimiento a los que les falta información, con lo que les falta. */
export const GET = apiRoute('lectura', async () => json({ pending: await listPending() }))
