/** Presupuestos y tarifas: consultas y alta de borradores comunes de la API v1 y el MCP. Importes en euros. */
import { z } from 'zod'
import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../prisma'
import { quotePhaseVersion } from './mutations/quote-phases'
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

/**
 * Presupuesto completo por id o número (P-2026-001): partidas, totales y fases con su importe.
 * Con `phaseIds` (API v1), cada fase lleva también su id y su versión para poder cambiarla; el MCP no los pide.
 */
export async function getQuote(id: string, { phaseIds = false }: { phaseIds?: boolean } = {}) {
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
    phases: q.phases.map((p, n) => ({ ...(phaseIds ? { id: p.id, version: quotePhaseVersion(p) } : {}), name: p.name, percent: p.percent == null ? null : decimal(p.percent), amount: p.percent == null ? null : euros(amounts[n]), dueDate: p.dueDate, status: p.status, completedAt: p.completedAt })),
  }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** Máximo de las columnas `Decimal(10, 2)` de importes y cantidades. */
export const MAX_AMOUNT = 99_999_999.99
const amount = () => z.number().min(0).max(MAX_AMOUNT)
const lines = (what: string) => z.array(z.string().max(1000)).max(50).optional().describe(what)

/**
 * Campos de un borrador nuevo (el MCP los usa como `inputSchema`; la API, como `z.object`). Con topes de importe,
 * de elementos y de longitud para que una entrada imposible sea un error de validación y no un fallo de la BD.
 */
export const createQuoteShape = {
  client: z.string().min(1).max(200).describe('Nombre exacto o id del cliente (debe existir)'),
  title: z.string().min(1).max(200),
  items: z.array(z.object({
    description: z.string().min(1).max(500).describe('Nombre de la fase o paquete'), details: z.string().max(3000).optional(),
    unitPrice: amount().describe('Precio, o mínimo si es variable'), priceMax: amount().optional().describe('Máximo si el precio es variable'),
    quantity: amount().default(1), unit: z.string().max(30).optional(),
  }).refine((i) => i.priceMax == null || i.priceMax >= i.unitPrice, { message: 'priceMax no puede ser menor que unitPrice', path: ['priceMax'] })).min(1).max(100),
  phases: z.array(z.object({ name: z.string().min(1).max(200), percent: z.number().min(0).max(100).optional(), dueDate: day.optional() })).max(50).optional().describe('Hitos de pago (forma de pago)'),
  scope: z.string().max(10000).optional().describe('Objeto y alcance'),
  includes: lines('Qué incluye'), excludes: lines('Qué no incluye'), assumptions: lines('Supuestos y condiciones'),
  thirdPartyCosts: z.string().max(5000).optional(),
  schedule: z.array(z.object({ when: z.string().max(200), what: z.string().max(1000) })).max(50).optional().describe('Cronograma'),
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
  const data = {
    title, clientId: c.id, notes, vat: vat ?? brand?.defaultVat ?? 21, validUntil: new Date(Date.now() + validDays * 864e5),
    scope, includes, excludes, assumptions, thirdPartyCosts, schedule,
    items: { create: items.map((i, position) => ({ ...i, position })) },
    phases: { create: phases.map((p, position) => ({ name: p.name, percent: p.percent, dueDate: p.dueDate ? new Date(`${p.dueDate}T12:00:00Z`) : undefined, position })) },
  }
  // El número sale de leer los del año. Las altas por la API se ponen en fila con un cerrojo de Postgres que dura lo que
  // la transacción; si aun así choca con un alta de la web o del MCP (que no lo toman), el índice único lo rechaza y
  // se repite con el siguiente número.
  for (let attempt = 1; ; attempt++) {
    try {
      const q = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${QUOTE_NUMBER_LOCK})`
        return tx.quote.create({ data: { ...data, number: await newQuoteNumber(tx) } })
      })
      return { ok: true, id: q.id, number: q.number } as const
    } catch (e) {
      if (attempt >= NUMBER_ATTEMPTS || !isNumberClash(e)) throw e
    }
  }
}

const NUMBER_ATTEMPTS = 5
/** Identificador del cerrojo de numeración de presupuestos (pg_advisory_xact_lock). */
const QUOTE_NUMBER_LOCK = 7_310_001

/** Choque del índice único de `Quote.number` (P2002). */
export function isNumberClash(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') return false
  const target = (e.meta as { target?: unknown } | undefined)?.target
  return Array.isArray(target) ? target.includes('number') : typeof target === 'string' ? target.includes('number') : true
}

/** Tarifas en uso, para rellenar un borrador. Precio sin IVA en euros. */
export async function listRates() {
  const rows = await prisma.rate.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
  return rows.map((r) => ({ id: r.id, name: r.name, unit: r.unit, price: decimal(r.price) }))
}
