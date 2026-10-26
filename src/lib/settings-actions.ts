'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireSession } from './session'
import { encryptJson } from './crypto'
import { sn4pTest } from './sn4p'
import { syncAllChannels, syncChannel } from './videos'

const done = () => revalidatePath('/ajustes')

export async function saveSn4p(form: FormData) {
  await requireSession()
  const d = z.object({ baseUrl: z.string().url(), username: z.string().min(1), password: z.string().optional() }).parse(Object.fromEntries(form))
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: 'SN4P' } })
  const data = { label: 'sn4p.dev', baseUrl: d.baseUrl.replace(/\/$/, ''), account: d.username, ...(d.password ? { secret: encryptJson({ password: d.password }) } : {}) }
  if (existing) await prisma.integrationConnection.update({ where: { id: existing.id }, data })
  else await prisma.integrationConnection.create({ data: { provider: 'SN4P', ...data } })
  done()
}

export async function testSn4p() {
  await requireSession()
  await sn4pTest()
  done()
}

export async function addApiConnection(form: FormData) {
  await requireSession()
  const d = z.object({ provider: z.enum(['YOUTUBE', 'BUNNY']), label: z.string().min(1).max(80), account: z.string().max(120).optional(), apiKey: z.string().min(8) }).parse(Object.fromEntries(form))
  await prisma.integrationConnection.create({ data: { provider: d.provider, label: d.label, account: d.account || null, secret: encryptJson({ apiKey: d.apiKey }) } })
  done()
}

export async function deleteConnection(form: FormData) {
  await requireSession()
  await prisma.integrationConnection.delete({ where: { id: String(form.get('id')) } })
  done()
}

export async function addChannel(form: FormData) {
  await requireSession()
  const d = z.object({ provider: z.enum(['YOUTUBE', 'BUNNY']), name: z.string().min(1).max(80), externalId: z.string().min(1).max(120), connectionId: z.string().optional() }).parse(Object.fromEntries(form))
  await prisma.videoChannel.upsert({
    where: { provider_externalId: { provider: d.provider, externalId: d.externalId.trim() } },
    update: { name: d.name, connectionId: d.connectionId || null },
    create: { provider: d.provider, name: d.name, externalId: d.externalId.trim(), connectionId: d.connectionId || null },
  })
  done()
}

export async function deleteChannel(form: FormData) {
  await requireSession()
  await prisma.videoChannel.delete({ where: { id: String(form.get('id')) } })
  done()
}

export async function linkChannel(form: FormData) {
  await requireSession()
  const d = z.object({ channelId: z.string(), projectId: z.string().min(1), match: z.string().max(120).optional(), purpose: z.enum(['DEMO', 'SALES', 'MARKETING', 'TUTORIAL']) }).parse(Object.fromEntries(form))
  await prisma.videoChannelLink.upsert({
    where: { channelId_projectId: { channelId: d.channelId, projectId: d.projectId } },
    update: { match: d.match?.trim() || null, purpose: d.purpose },
    create: { channelId: d.channelId, projectId: d.projectId, match: d.match?.trim() || null, purpose: d.purpose },
  })
  done()
}

export async function unlinkChannel(form: FormData) {
  await requireSession()
  await prisma.videoChannelLink.delete({ where: { id: String(form.get('id')) } })
  done()
}

export async function syncOne(form: FormData) {
  await requireSession()
  await syncChannel(String(form.get('id')))
  done()
}

export async function syncAll() {
  await requireSession()
  await syncAllChannels()
  done()
}

/** Escanea ahora las carpetas raíz guardadas (solo funciona en el equipo que tiene esas carpetas). */
export async function scanNow() {
  await requireSession()
  const { enqueueScan, isRemote } = await import('./worker')
  // en producción las carpetas están en el Mac: se le pide el escaneo
  if (isRemote()) { await enqueueScan('active'); revalidatePath('/', 'layout'); return }
  const { scanAndImport } = await import('./scan-import')
  await scanAndImport()
  revalidatePath('/', 'layout')
}

const RootForm = z.object({ path: z.string().trim().min(2).max(500).regex(/^\//) })

/** Añade una carpeta raíz y la escanea en el momento. Tiene que existir en este equipo. */
export async function addScanRoot(form: FormData) {
  await requireSession()
  if ((await import('./worker')).isRemote()) return { error: 'En producción, las carpetas que se escanean se eligen en el Mac (CENTRAL_WORKER_ROOTS del trabajador)' }
  const fs = await import('node:fs')
  const path = await import('node:path')
  const dir = path.resolve(RootForm.parse(Object.fromEntries(form)).path)
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error('La carpeta no existe en este equipo')
  const { scanAndImport } = await import('./scan-import')
  await scanAndImport([dir])
  revalidatePath('/', 'layout')
}

/** Deja de escanear una carpeta raíz. Sus proyectos ya importados se quedan; se pueden excluir. */
export async function removeScanRoot(form: FormData) {
  await requireSession()
  await prisma.scanRoot.delete({ where: { id: String(form.get('id')) } })
  done()
}
