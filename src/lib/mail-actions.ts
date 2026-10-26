'use server'

/** Correo: guardar mensajes importantes de Gmail ligados a un cliente o proyecto (Central nunca envía correo). */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getMail } from './google'
import { resolveTarget as target } from './link-targets'
import { prisma } from './prisma'
import { requireSession } from './session'

const refresh = () => {
  revalidatePath('/correo')
  revalidatePath('/clientes', 'layout')
  revalidatePath('/proyectos', 'layout')
}

/** Guarda el mensaje completo (texto incluido) para que siga en Central aunque se borre en Gmail. */
export async function saveMessage(form: FormData) {
  await requireSession()
  const d = z.object({ connectionId: z.string().min(1), messageId: z.string().min(1), value: z.string().default('') }).parse(Object.fromEntries(form))
  const account = await prisma.mailAccount.findFirst({ where: { connectionId: d.connectionId } })
  let m
  try { m = await getMail(d.connectionId, d.messageId) } catch (e) { return { error: (e as Error).message } }
  const data = {
    fromAddress: m.from, toAddress: m.to || null, subject: m.subject, snippet: m.snippet || null, body: m.body.slice(0, 100_000) || null,
    threadId: m.threadId, receivedAt: m.date, important: true, ...(await target(d.value)),
  }
  if (account) await prisma.savedMessage.upsert({ where: { accountId_externalId: { accountId: account.id, externalId: m.id } }, update: data, create: { accountId: account.id, externalId: m.id, ...data } })
  else await prisma.savedMessage.create({ data: { externalId: m.id, ...data } })
  refresh()
}

export async function linkSavedMessage(form: FormData) {
  await requireSession()
  const d = z.object({ id: z.string().min(1), value: z.string().default('') }).parse(Object.fromEntries(form))
  await prisma.savedMessage.update({ where: { id: d.id }, data: await target(d.value) })
  refresh()
}

export async function deleteSavedMessage(form: FormData) {
  await requireSession()
  await prisma.savedMessage.delete({ where: { id: z.string().min(1).parse(form.get('id')) } })
  refresh()
}
