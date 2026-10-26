'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { decryptJson, encryptJson } from './crypto'
import { kumaConnection } from './kuma-connection'
import { syncKuma, testKumaConnection } from './kuma'
import { prisma } from './prisma'
import { requireSession } from './session'

const KumaForm = z.object({
  url: z.string().trim().url(),
  username: z.string().trim().min(1).max(100),
  password: z.string().max(200).optional(),
  apiKey: z.string().trim().max(200).optional(),
})

/** Guarda la conexión con Uptime Kuma; contraseña y clave de API cifradas. Vacías = no cambiar. */
export async function saveKuma(form: FormData) {
  await requireSession()
  const d = KumaForm.parse(Object.fromEntries(form))
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: 'UPTIME_KUMA' } })
  const old = decryptJson<{ password?: string; apiKey?: string }>(existing?.secret) ?? {}
  const secret = { password: d.password || old.password, apiKey: d.apiKey || old.apiKey }
  if (!secret.password) throw new Error('Falta la contraseña')
  const data = { provider: 'UPTIME_KUMA' as const, label: 'Uptime Kuma', baseUrl: d.url.replace(/\/$/, ''), account: d.username, secret: encryptJson(secret), lastError: null }
  if (existing) await prisma.integrationConnection.update({ where: { id: existing.id }, data })
  else await prisma.integrationConnection.create({ data })
  revalidatePath('/ajustes')
}

async function mark(ok: boolean, error?: string) {
  const conn = await kumaConnection()
  if (conn) await prisma.integrationConnection.update({ where: { id: conn.id }, data: ok ? { lastOkAt: new Date(), lastError: null } : { lastError: error ?? 'Error' } })
}

export async function testKuma() {
  await requireSession()
  const conn = await kumaConnection()
  if (!conn) throw new Error('Falta la conexión')
  try {
    await testKumaConnection(conn)
    await mark(true)
  } catch (e) {
    await mark(false, e instanceof Error ? e.message : undefined)
  }
  revalidatePath('/ajustes')
}

export async function syncKumaNow() {
  await requireSession()
  try {
    await syncKuma()
    await mark(true)
  } catch (e) {
    await mark(false, e instanceof Error ? e.message : undefined)
    throw e
  }
  revalidatePath('/', 'layout')
}
