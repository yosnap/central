/** Presupuestos y tarifas: consultas y alta de borradores comunes de la API v1 y el MCP. Importes en euros. */
import { z } from 'zod'
import { prisma } from '../prisma'
import { newQuoteNumber } from '../quote-number'
import { decimal, phaseAmounts, quoteTotals, visibleStatus } from '../quotes'

export const QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const
export type QuoteStatusFilter = (typeof QUOTE_STATUSES)[number]

const euros = (c: number) => c / 100

/** Presupuestos del más reciente al más antiguo; un enviado fuera de plazo sale EXPIRED. */
export async function listQuotes({ client, status }: { client?: string; status?: QuoteStatusFilter } = {}) {
  const rows = await prisma.quote.findMany({
    where: client ? { client: { name: { contains: client, mode: 'insensitive' } } } : {},
    orderBy: { issuedAt: 'desc' }, include: { client: { select: { name: true } }, items: { select: { quantity: true, unitPrice: true, priceMax: true } } },
  })
  return rows.map((q) => { const t = quoteTotals(q.items, q.vat); return { id: q.id, number: q.number, title: q.title, client: q.client.name, status: visibleStatus(q), issuedAt: q.issuedAt, validUntil: q.validUntil, total: euros(t.total), ...(t.variable ? { totalMax: euros(t.totalMax) } : {}) } })
    .filter((q) => !status || q.status === status)
}

/** Presupuesto completo por id o número (P-2026-001): partidas, totales y fases con su importe. */
export async function getQuote(id: string) {
  const q = await prisma.quote.findFirst({
    where: { OR: [{ id }, { number: id }] },
    include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } }, items: { orderBy: { position: 'asc' } }, phases: { orderBy: { position: 'asc' } } },
  })
  if (!q) return null
  const t = quoteTotals(q.items, q.vat)
  const { amounts } = phaseAmounts(q.phases, t.total)
  return {
    id: q.id, number: q.number, title: q.title, status: visibleStatus(q), client: q.client, project: q.project, issuedAt: q.issuedAt, validUntil: q.validUntil, vat: decimal(q.vat), notes: q.notes,
    scope: q.scope, includes: q.includes, excludes: q.excludes, assumptions: q.assumptions, thirdPartyCosts: q.thirdPartyCosts, schedule: q.schedule,
    items: q.items.map((i) => ({ description: i.description, details: i.details, quantity: decimal(i.quantity), unit: i.unit, unitPrice: decimal(i.unitPrice), priceMax: i.priceMax == null ? null : decimal(i.priceMax) })),
    base: euros(t.base), tax: euros(t.tax), total: euros(t.total), ...(t.variable ? { baseMax: euros(t.baseMax), totalMax: euros(t.totalMax) } : {}),
    phases: q.phases.map((p, n) => ({ name: p.name, percent: p.percent == null ? null : decimal(p.percent), amount: p.percent == null ? null : euros(amounts[n]), dueDate: p.dueDate, status: p.status, completedAt: p.completedAt })),
  }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Campos de un borrador nuevo (el MCP los usa como `inputSchema`; la API, como `z.object`). */
export const createQuoteShape = {
  client: z.string().describe('Nombre exacto o id del cliente (debe existir)'),
  title: z.string().min(1).max(200),
  items: z.array(z.object({
    description: z.string().min(1).max(500).describe('Nombre de la fase o paquete'), details: z.string().max(3000).optional(),
    unitPrice: z.number().describe('Precio, o mínimo si es variable'), priceMax: z.number().optional().describe('Máximo si el precio es variable'),
    quantity: z.number().min(0).default(1), unit: z.string().max(30).optional(),
  })).min(1),
  phases: z.array(z.object({ name: z.string().min(1).max(200), percent: z.number().min(0).max(100).optional(), dueDate: day.optional() })).optional().describe('Hitos de pago (forma de pago)'),
  scope: z.string().max(10000).optional().describe('Objeto y alcance'),
  includes: z.array(z.string()).optional(), excludes: z.array(z.string()).optional(), assumptions: z.array(z.string()).optional(),
  thirdPartyCosts: z.string().max(5000).optional(),
  schedule: z.array(z.object({ when: z.string(), what: z.string() })).optional().describe('Cronograma'),
  vat: z.number().min(0).max(100).optional().describe('IVA en %; por defecto el de Ajustes'),
  notes: z.string().max(5000).optional(),
  validDays: z.number().int().min(1).max(365).default(30),
}

export const createQuoteSchema = z.object(createQuoteShape)
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>

/** Crea siempre un borrador con el siguiente número del año. El cliente debe existir (id o nombre exacto). */
export async function createQuote({ client, title, items, phases = [], vat, notes, validDays, scope, includes = [], excludes = [], assumptions = [], thirdPartyCosts, schedule = [] }: CreateQuoteInput) {
  const c = await prisma.client.findFirst({ where: { OR: [{ id: client }, { name: { equals: client, mode: 'insensitive' } }] } })
  if (!c) return { ok: false, error: 'client_not_found' } as const
  const brand = await prisma.brandSettings.findUnique({ where: { id: 'default' }, select: { defaultVat: true } })
  const q = await prisma.quote.create({
    data: {
      number: await newQuoteNumber(), title, clientId: c.id, notes, vat: vat ?? brand?.defaultVat ?? 21, validUntil: new Date(Date.now() + validDays * 864e5),
      scope, includes, excludes, assumptions, thirdPartyCosts, schedule,
      items: { create: items.map((i, position) => ({ ...i, position })) },
      phases: { create: phases.map((p, position) => ({ name: p.name, percent: p.percent, dueDate: p.dueDate ? new Date(`${p.dueDate}T12:00:00Z`) : undefined, position })) },
    },
  })
  return { ok: true, id: q.id, number: q.number } as const
}

/** Tarifas en uso, para rellenar un borrador. Precio sin IVA en euros. */
export async function listRates() {
  const rows = await prisma.rate.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, price: decimal(r.price) }))
}
