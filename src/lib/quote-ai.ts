/**
 * Asistente de presupuestos: conversa con Claude Code del Mac (`claude -p`, con tu suscripción) sobre los documentos
 * y tareas que le pasas, y devuelve una propuesta completa por fases o paquetes, validada con Zod.
 * Claude Code solo puede leer la carpeta del presupuesto (`storage/quotes/<id>`): sin Bash, sin red, sin MCP.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { runAssistant, type AssistantRun, type CliResult } from './claude-cli'
import { prisma } from './prisma'
import { decimal, moneyRange, quoteTotals, type Num } from './quotes'

export const DEFAULT_PRICING_GUIDE = `Precios por fases, hitos o paquetes cerrados; nunca por horas.
Si hay incertidumbre (estado del código, APIs de terceros, alcance por definir), precio variable con rango y el motivo.

Referencias de 2026:
- App móvil Android e iOS (React Native con Expo) sobre una API ya existente, sin scraping (Torbellino Sports): 5.200 € de base en 9 fases: arranque 400 €, conexión con la plataforma 700 €, pantallas y navegación 1.400 €, publicidad por ubicación 800 €, usuarios 500 €, notificaciones push 300 €, pruebas 600 €, publicación en tiendas 300 €, gestión y entrega 200 €.
- Plataforma SaaS heredada (Auditia, Artilabs): auditoría técnica y toma de control 700 €; estabilización y migración a Next.js, Prisma y PostgreSQL 4.200 €; RGPD y anonimización 500–1.200 €; base de conocimiento normativo y panel de administración 1.200–2.100 €; idiomas ES/EN 400 €; asistente de IA contextualizado 1.000–1.800 €; facturación con Stripe y Verifactu 600 €. Total 8.600–11.000 €.

Forma de pago habitual: 50 % al aceptar y 50 % a la entrega; en proyectos largos, al cerrar cada fase.
Costes de terceros (infraestructura, APIs de IA, cuentas de tiendas, dominio, comisiones) a cargo del cliente y fuera del presupuesto.`

const ALLOWED = /\.(pdf|docx|txt|md|markdown|csv|json|ya?ml|html?)$/i

export const storageDir = (quoteId: string) => path.join(process.cwd(), 'storage', 'quotes', quoteId.replace(/[^\w-]/g, ''))

// ───────── Propuesta ─────────

const Proposal = z.object({
  title: z.string().min(1).max(200),
  scope: z.string().max(6000),
  items: z.array(z.object({
    name: z.string().min(1).max(300),
    details: z.string().max(3000).default(''),
    price: z.number().min(0).max(1e7),
    priceMax: z.number().min(0).max(1e7).nullish(),
    quantity: z.number().min(0).max(1e5).nullish(),
    unit: z.string().max(30).nullish(),
  })).min(1).max(60),
  payments: z.array(z.object({ name: z.string().min(1).max(200), percent: z.number().min(0).max(100) })).max(20).default([]),
  schedule: z.array(z.object({ when: z.string().max(120), what: z.string().max(600) })).max(40).default([]),
  includes: z.array(z.string().max(500)).max(40).default([]),
  excludes: z.array(z.string().max(500)).max(40).default([]),
  assumptions: z.array(z.string().max(500)).max(40).default([]),
  thirdPartyCosts: z.string().max(3000).nullish(),
  notes: z.string().max(3000).nullish(),
})
export type Proposal = z.infer<typeof Proposal>
export const parseProposal = (v: unknown) => Proposal.safeParse(v)

// ───────── Contexto ─────────

function instructions(guide: string) {
  return `Eres el asistente de presupuestos de Central, el CRM de Paulo (iServisat), desarrollador web y de apps en España.
Preparas presupuestos de desarrollo de software a partir de los documentos y listados de tareas que te pasa.

Reglas:
- Escribe siempre en español de España, claro y profesional, sin emoticonos.
- Los precios NUNCA se calculan ni se muestran por horas ni con tarifa por hora: se cobran por fases, hitos, tramos o paquetes cerrados. No menciones horas en la propuesta.
- Precio fijo cuando el alcance está claro; variable (price y priceMax) cuando depende de algo incierto, y explica de qué en los detalles de esa fase.
- Importes en euros, sin IVA, redondeados (múltiplos de 50 o 100).
- Usa los criterios de precio y los presupuestos anteriores como referencia del nivel de precios de Paulo.
- Cada vez que tengas información suficiente devuelve la propuesta COMPLETA (no solo lo que cambia). Si falta algo importante, propón igualmente con supuestos explícitos y pregunta en el mensaje.
- Si Paulo pide un cambio (subir una fase, quitar algo, cambiar la forma de pago), aplícalo y devuelve la propuesta completa actualizada.
- No inventes datos del cliente. Los documentos están en la carpeta de trabajo: léelos con la herramienta Read.
- En el mensaje: resumen de lo que has entendido, cómo has llegado al precio, riesgos y las dudas para afinarlo. Breve.

Criterios de precio de Paulo:
${guide}`
}

async function context(quoteId: string) {
  const q = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { client: true, project: { select: { name: true, description: true, framework: true, stack: true, version: true } }, items: { orderBy: { position: 'asc' } }, phases: { orderBy: { position: 'asc' } } },
  })
  const [others, rates] = await Promise.all([
    prisma.quote.findMany({
      where: { id: { not: quoteId }, items: { some: {} } }, orderBy: { issuedAt: 'desc' }, take: 8,
      include: { client: { select: { name: true } }, items: { orderBy: { position: 'asc' } } },
    }),
    prisma.rate.findMany({ where: { active: true } }),
  ])
  const eur = (v: Num) => Math.round(decimal(v) * 100)
  const item = (i: { description: string; unitPrice: Num; priceMax: Num | null; quantity: Num }) =>
    `  - ${i.description}: ${moneyRange(eur(i.unitPrice), i.priceMax == null ? null : eur(i.priceMax))}${decimal(i.quantity) !== 1 ? ` × ${decimal(i.quantity)}` : ''}`
  const past = others.map((o) => {
    const t = quoteTotals(o.items, o.vat)
    return `- ${o.number} «${o.title}» (${o.client.name}, ${o.status}): ${moneyRange(t.base, t.variable ? t.baseMax : null)} sin IVA\n${o.items.map(item).join('\n')}`
  }).join('\n')
  const c = q.client
  return [
    `Cliente: ${c.name}${c.company ? ` (${c.company})` : ''}.`,
    q.project && `Proyecto en Central: ${q.project.name}${q.project.framework ? `, ${q.project.framework}` : ''}${q.project.stack.length ? `, stack ${q.project.stack.join(', ')}` : ''}${q.project.description ? `. ${q.project.description}` : ''}.`,
    `Presupuesto ${q.number}: «${q.title}», IVA ${decimal(q.vat)} %.`,
    q.items.length ? `Desglose actual del presupuesto (puede haberlo retocado Paulo a mano):\n${q.items.map(item).join('\n')}` : 'El presupuesto aún no tiene desglose.',
    past && `Presupuestos anteriores de Paulo (referencia de precios):\n${past}`,
    rates.length && `Paquetes y tarifas guardados:\n${rates.map((r) => `- ${r.name}: ${moneyRange(eur(r.price))} / ${r.unit}`).join('\n')}`,
  ].filter(Boolean).join('\n\n')
}

// ───────── Ficheros ─────────

/** Guarda los ficheros en la carpeta del presupuesto. Word se convierte a texto aquí; PDF y texto los lee Claude. */
export async function saveFiles(quoteId: string, files: File[]) {
  const dir = storageDir(quoteId)
  await fs.mkdir(dir, { recursive: true })
  const saved: { name: string; readAs: string }[] = []
  for (const f of files) {
    if (!f.size) continue
    if (!ALLOWED.test(f.name)) throw new Error(`«${f.name}»: solo PDF, Word (.docx) o texto (md, txt, csv…)`)
    if (f.size > 20 * 1024 * 1024) throw new Error(`«${f.name}» pesa más de 20 MB`)
    const name = path.basename(f.name).replace(/[^\p{L}\p{N} ._-]+/gu, '_')
    const file = path.join(dir, name)
    const buf = Buffer.from(await f.arrayBuffer())
    await fs.writeFile(file, buf)
    if (/\.docx$/i.test(name)) {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ buffer: buf })
      await fs.writeFile(`${file}.txt`, value)
      saved.push({ name, readAs: `${name}.txt` })
    } else saved.push({ name, readAs: name })
  }
  return saved
}

// ───────── Llamada a Claude Code ─────────

/** Argumentos de `claude -p` para esta vuelta: con la sesión anterior y, por si falla, desde cero. */
export async function prepareAssistant(quoteId: string, text: string, files: { name: string; readAs: string }[]): Promise<AssistantRun> {
  const q = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, select: { aiSessionId: true } })
  const brand = await prisma.brandSettings.findUnique({ where: { id: 'default' }, select: { pricingGuide: true } })
  const attached = files.length ? `\n\nDocumentos nuevos en la carpeta de trabajo (léelos con Read): ${files.map((f) => `«${f.readAs}»`).join(', ')}.` : ''
  const ask = text || 'Analiza los documentos y propón el presupuesto.'
  const ctx = await context(quoteId)
  return {
    system: instructions(brand?.pricingGuide?.trim() || DEFAULT_PRICING_GUIDE),
    fresh: `${ctx}\n\n---\n\n${ask}${attached}`,
    // se le recuerda el estado actual por si Paulo ha tocado el presupuesto a mano entre mensajes
    resume: q.aiSessionId ? { sessionId: q.aiSessionId, prompt: `${ask}${attached}\n\n(Estado actual del presupuesto)\n${ctx}` } : undefined,
  }
}

/** Guarda la respuesta del asistente (venga del Mac directamente o del trabajador). */
export async function finishAssistant(quoteId: string, r: CliResult) {
  if (r.is_error || !r.structured_output?.message) throw new Error(r.result?.slice(0, 300) || 'El asistente no ha devuelto una respuesta')
  const parsed = r.structured_output.proposal ? Proposal.safeParse(r.structured_output.proposal) : null
  await prisma.$transaction([
    ...(r.session_id ? [prisma.quote.update({ where: { id: quoteId }, data: { aiSessionId: r.session_id } })] : []),
    prisma.quoteMessage.create({
      data: {
        quoteId, role: 'assistant',
        content: r.structured_output.message + (parsed && !parsed.success ? '\n\n_(La propuesta que ha devuelto no es válida; pídele que la repita.)_' : ''),
        proposal: parsed?.success ? parsed.data : undefined,
      },
    }),
  ])
}

/** Modo local (Central en el Mac): ejecuta Claude Code aquí mismo y guarda la respuesta. */
export async function askAssistant(quoteId: string, text: string, files: { name: string; readAs: string }[]) {
  const dir = storageDir(quoteId)
  await fs.mkdir(dir, { recursive: true })
  await finishAssistant(quoteId, await runAssistant(await prepareAssistant(quoteId, text, files), dir))
}
