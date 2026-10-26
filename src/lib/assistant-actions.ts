'use server'

/** Chat del asistente de presupuestos: enviar mensajes con documentos, aplicar la propuesta y empezar de nuevo. */
import fs from 'node:fs/promises'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from './prisma'
import { askAssistant, parseProposal, prepareAssistant, saveFiles, storageDir } from './quote-ai'
import { enqueue, isRemote } from './worker'
import { requireSession } from './session'

const refresh = (quoteId: string) => {
  revalidatePath(`/presupuestos/${quoteId}`)
  revalidatePath('/presupuestos')
}

export async function sendToAssistant(form: FormData) {
  await requireSession()
  const quoteId = z.string().min(1).parse(form.get('quoteId'))
  const text = z.string().trim().max(20000).parse(form.get('text') ?? '')
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!text && !files.length) return { error: 'Escribe algo o adjunta un documento' }
  let saved
  try { saved = await saveFiles(quoteId, files) } catch (e) { return { error: (e as Error).message } }
  await prisma.quoteMessage.create({ data: { quoteId, role: 'user', content: text, attachments: saved.map((f) => f.name) } })
  if (isRemote()) {
    // en producción lo hace el Mac: se encola y la ficha se actualiza sola cuando llega la respuesta
    await enqueue('assistant', { quoteId, run: await prepareAssistant(quoteId, text, saved), files: saved.map((f) => f.readAs) })
    refresh(quoteId)
    return
  }
  try {
    await askAssistant(quoteId, text, saved)
  } catch (e) {
    await prisma.quoteMessage.create({ data: { quoteId, role: 'assistant', content: (e as Error).message, error: true } })
  }
  refresh(quoteId)
}

/** Sustituye el desglose, las secciones y, si ninguna está empezada, la forma de pago por los de la propuesta. */
export async function applyProposal(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const m = await prisma.quoteMessage.findUniqueOrThrow({ where: { id }, include: { quote: { include: { phases: { select: { status: true } } } } } })
  const r = parseProposal(m.proposal)
  if (!r.success) return { error: 'Esta propuesta no se puede aplicar' }
  const p = r.data
  const started = m.quote.phases.some((ph) => ph.status !== 'PENDING')
  await prisma.$transaction([
    prisma.quoteItem.deleteMany({ where: { quoteId: m.quoteId } }),
    prisma.quoteItem.createMany({
      data: p.items.map((i, position) => ({
        quoteId: m.quoteId, position, description: i.name, details: i.details || null, unitPrice: i.price,
        priceMax: i.priceMax != null && i.priceMax > i.price ? i.priceMax : null, quantity: i.quantity ?? 1, unit: i.quantity != null && i.quantity !== 1 ? i.unit ?? null : null,
      })),
    }),
    ...(started || !p.payments.length ? [] : [
      prisma.quotePhase.deleteMany({ where: { quoteId: m.quoteId } }),
      prisma.quotePhase.createMany({ data: p.payments.map((ph, position) => ({ quoteId: m.quoteId, position, name: ph.name, percent: ph.percent })) }),
    ]),
    prisma.quote.update({
      where: { id: m.quoteId },
      data: {
        title: p.title, scope: p.scope || null, includes: p.includes, excludes: p.excludes, assumptions: p.assumptions,
        thirdPartyCosts: p.thirdPartyCosts || null, notes: p.notes || null, schedule: p.schedule,
      },
    }),
    prisma.quoteMessage.update({ where: { id }, data: { appliedAt: new Date() } }),
  ])
  refresh(m.quoteId)
  if (started) return { error: 'Aplicada, salvo la forma de pago: ya hay fases empezadas o facturadas y no se han tocado' }
}

/** Borra la conversación y la sesión de Claude Code; los documentos subidos también. */
export async function clearConversation(form: FormData) {
  await requireSession()
  const quoteId = z.string().min(1).parse(form.get('quoteId'))
  await prisma.$transaction([
    prisma.quoteMessage.deleteMany({ where: { quoteId } }),
    prisma.quote.update({ where: { id: quoteId }, data: { aiSessionId: null } }),
  ])
  await fs.rm(storageDir(quoteId), { recursive: true, force: true })
  refresh(quoteId)
}
