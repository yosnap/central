'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'

const kumaInBackground = () => import('./kuma').then((k) => k.syncKuma()).catch(() => {})

const toUrl = (raw: string) => (/^https?:\/\//.test(raw) ? raw : `https://${raw}`)

const Edit = z.object({
  id: z.string().min(1),
  url: z.string().trim().min(3, 'Falta la URL').transform(toUrl).pipe(z.url('URL no válida')),
  label: z.string().trim().max(120).transform((v) => v || null),
  kind: z.enum(['CLIENT', 'OWN', 'CENTRAL']),
  client: z.string().trim().max(120),
  projectId: z.string().trim(),
  monitored: z.boolean(),
})

/** Edita una web suelta. Las webs de un servicio se editan en la ficha de su proyecto. */
export async function updateWebsite(form: FormData) {
  await requireSession()
  const parsed = Edit.safeParse({
    id: form.get('id'), url: String(form.get('url') ?? ''), label: String(form.get('label') ?? ''), kind: form.get('kind'),
    client: String(form.get('client') ?? ''), projectId: String(form.get('projectId') ?? ''), monitored: form.get('monitored') === 'true',
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos' }
  const d = parsed.data
  const site = await prisma.website.findUniqueOrThrow({ where: { id: d.id }, select: { url: true, service: { select: { id: true } } } })
  if (site.service) return { error: 'Esta web es de un servicio: se edita en la ficha de su proyecto' }
  const clash = await prisma.website.findFirst({ where: { url: d.url, id: { not: d.id } }, select: { id: true } })
  if (clash) return { error: 'Ya hay otra web con esa URL' }
  const client = d.client ? await prisma.client.upsert({ where: { name: d.client }, update: {}, create: { name: d.client } }) : null
  const changedUrl = site.url !== d.url
  await prisma.website.update({
    where: { id: d.id },
    data: {
      url: d.url, label: d.label, kind: d.kind, monitored: d.monitored, clientId: client?.id ?? null, projectId: d.projectId || null,
      // con otra URL, el último estado ya no vale
      ...(changedUrl ? { lastStatus: null, lastCode: null, lastMs: null, lastCheckedAt: null, kumaStatus: null, kumaMs: null, sslDaysLeft: null } : {}),
    },
  })
  revalidatePath('/webs')
  void kumaInBackground()
}

/** Borra una web suelta con sus comprobaciones y notas; su monitor de Uptime Kuma se quita en la siguiente sincronización. */
export async function deleteWebsite(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const site = await prisma.website.findUniqueOrThrow({ where: { id }, select: { service: { select: { id: true } } } })
  if (site.service) return { error: 'Esta web es de un servicio: se quita en la ficha de su proyecto' }
  await prisma.website.delete({ where: { id } })
  revalidatePath('/webs')
  void kumaInBackground()
}
