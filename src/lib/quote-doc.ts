/** Contenido del presupuesto ya calculado y en texto, el mismo para el PDF y para el Word. */
import type { BrandSettings, Client, Quote, QuoteItem, QuotePhase } from '@/generated/prisma/client'
import { fmtDate } from './format'
import { decimal, isVariable, itemCents, itemMaxCents, moneyRange, phaseAmounts, qty, quoteTotals, unitFor } from './quotes'

export type DocQuote = Quote & { client: Client; items: QuoteItem[]; phases: QuotePhase[] }

export function quoteDoc(q: DocQuote, brand: BrandSettings | null) {
  const t = quoteTotals(q.items, q.vat)
  const range = (min: number, max: number) => moneyRange(min, t.variable ? max : null)
  const pay = phaseAmounts(q.phases, t.total).amounts
  const payMax = phaseAmounts(q.phases, t.totalMax).amounts
  const name = brand?.businessName ?? 'iServisat'
  const join = (...xs: (string | null | undefined | false)[]) => xs.filter(Boolean) as string[]
  // la web sin protocolo; si es el propio nombre comercial (p. ej. «sn4p.dev»), una sola línea
  const site = brand?.website?.replace(/^https?:\/\//i, '').replace(/\/$/, '') || null
  const same = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase()
  return {
    number: q.number,
    title: q.title,
    issued: fmtDate(q.issuedAt),
    validUntil: q.validUntil ? fmtDate(q.validUntil) : null,
    brandName: name,
    // primero la marca y debajo el titular; la web solo si no es la propia marca
    from: { name, lines: join(brand?.ownerName, brand?.taxId && `NIF: ${brand.taxId}`, ...(brand?.address?.split('\n') ?? []), brand?.email, brand?.phone, !same(name, site) && site) },
    to: { name: q.client.company ?? q.client.name, lines: join(q.client.company && q.client.company !== q.client.name && q.client.name, q.client.taxId && `NIF/CIF: ${q.client.taxId}`, ...(q.client.address?.split('\n') ?? []), q.client.email, q.client.phone) },
    scope: q.scope,
    variable: t.variable,
    items: q.items.map((i, n) => ({
      n: n + 1,
      name: i.description,
      details: i.details,
      kind: isVariable(i) ? 'Variable' : 'Fijo',
      amount: moneyRange(itemCents(i), isVariable(i) ? itemMaxCents(i) : null),
      quantity: decimal(i.quantity) !== 1 ? `${qty(i.quantity)}${i.unit ? ` ${unitFor(i.unit, decimal(i.quantity))}` : ''}` : null,
    })),
    totals: { base: range(t.base, t.baseMax), vat: `IVA (${qty(q.vat)} %)`, tax: range(t.tax, t.taxMax), total: range(t.total, t.totalMax) },
    schedule: ((q.schedule as { when: string; what: string }[] | null) ?? []).filter((r) => r.what),
    payments: q.phases.map((p, n) => ({ name: p.name, percent: p.percent == null ? null : `${qty(p.percent)} %`, amount: p.percent == null ? null : moneyRange(pay[n], t.variable ? payMax[n] : null), due: p.dueDate ? fmtDate(p.dueDate) : null })),
    includes: q.includes,
    excludes: q.excludes,
    thirdPartyCosts: q.thirdPartyCosts,
    assumptions: q.assumptions,
    notes: q.notes,
    iban: brand?.iban ? brand.iban.replace(/(.{4})/g, '$1 ').trim() : null,
    footer: brand?.quoteFooter ?? null,
    legal: `${name}${brand?.taxId ? ` · NIF ${brand.taxId}` : ''}`,
  }
}
export type QuoteDoc = ReturnType<typeof quoteDoc>

/** Secciones numeradas en el orden del documento; solo las que tienen contenido. */
export function sections(d: QuoteDoc) {
  const list = [
    d.scope && 'scope', d.items.length && 'items', 'summary', d.schedule.length && 'schedule', d.payments.length && 'payments',
    d.includes.length && 'includes', d.excludes.length && 'excludes', d.thirdPartyCosts && 'third', d.assumptions.length && 'assumptions',
  ].filter(Boolean) as string[]
  const TITLES: Record<string, string> = {
    scope: 'Objeto y alcance', items: 'Desglose por fases', summary: 'Resumen económico', schedule: 'Cronograma', payments: 'Forma de pago',
    includes: 'Incluye', excludes: 'No incluye', third: 'Costes de terceros (a cargo del cliente)', assumptions: 'Supuestos y condiciones',
  }
  return Object.fromEntries(list.map((k, i) => [k, `${i + 1}. ${TITLES[k]}`])) as Record<string, string | undefined>
}
