/** Datos para generar el PDF o el Word de un presupuesto: presupuesto completo, marca, colores y logo preparado. */
import { cookies } from 'next/headers'
import { SESSION_COOKIE, verifySession } from './auth'
import { DEFAULT_COLORS, logoColors, logoForDoc, watermark } from './brand-image'
import { prisma } from './prisma'

export type DocArt = {
  colors: { primary: string; secondary: string }
  /** Logo reducido a PNG, con su tamaño en píxeles. */
  logo: { data: Buffer; width: number; height: number } | null
  /** El logo casi transparente para el fondo de cada página. */
  watermark: { data: Buffer; width: number; height: number } | null
}

export async function loadQuoteDoc(id: string) {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) return { error: new Response('No autorizado', { status: 401 }) } as const
  const [q, brand] = await Promise.all([
    prisma.quote.findUnique({ where: { id }, include: { client: true, items: { orderBy: [{ position: 'asc' }, { id: 'asc' }] }, phases: { orderBy: [{ position: 'asc' }, { id: 'asc' }] } } }),
    prisma.brandSettings.findUnique({ where: { id: 'default' } }),
  ])
  if (!q) return { error: new Response('No existe', { status: 404 }) } as const
  const raw = brand?.logoData ? Buffer.from(brand.logoData) : null
  let colors = { primary: brand?.primaryColor ?? '', secondary: brand?.secondaryColor ?? '' }
  // sin colores guardados, se sacan del logo una vez y se guardan para poder retocarlos en Ajustes
  if ((!colors.primary || !colors.secondary) && raw) {
    const found = await logoColors(raw).catch(() => null)
    if (found) {
      colors = { primary: colors.primary || found.primary, secondary: colors.secondary || found.secondary }
      await prisma.brandSettings.update({ where: { id: 'default' }, data: { primaryColor: colors.primary, secondaryColor: colors.secondary } })
    }
  }
  const art: DocArt = {
    colors: { primary: colors.primary || DEFAULT_COLORS.primary, secondary: colors.secondary || DEFAULT_COLORS.secondary },
    logo: raw ? await logoForDoc(raw).catch(() => null) : null,
    watermark: raw ? await watermark(raw).catch(() => null) : null,
  }
  // nombre de fichero ASCII para la cabecera; la versión con tildes va en filename*
  const base = `${q.number} ${q.client.name}`
  const disposition = (ext: string, download: boolean) =>
    `${download ? 'attachment' : 'inline'}; filename="${base.normalize('NFD').replace(/[^\w .-]+/g, '')}.${ext}"; filename*=UTF-8''${encodeURIComponent(`${base}.${ext}`)}`
  return { q, brand, art, disposition } as const
}
