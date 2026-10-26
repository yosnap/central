/** Cálculos de presupuestos (sin dependencias de Next): importes en céntimos, numeración y estado visible. */
import type { QuoteStatus } from '@/generated/prisma/client'

export type Num = number | string | { toString(): string }
const n = (v: Num | null | undefined) => (v == null ? 0 : Number(v.toString()))
const cents = (v: number) => Math.round(v * 100)

/** Fase o paquete del desglose: precio fijo, o variable entre `unitPrice` (desde) y `priceMax` (hasta). */
export type ItemLike = { quantity: Num; unitPrice: Num; priceMax?: Num | null }
export type PhaseLike = { percent: Num | null }

export const itemCents = (i: ItemLike) => cents(n(i.quantity) * n(i.unitPrice))
export const itemMaxCents = (i: ItemLike) => cents(n(i.quantity) * n(i.priceMax ?? i.unitPrice))
export const isVariable = (i: ItemLike) => i.priceMax != null && n(i.priceMax) > n(i.unitPrice)

/** Base, IVA y total en céntimos; con fases variables, también el máximo (`…Max`). */
export function quoteTotals(items: ItemLike[], vat: Num) {
  const tot = (base: number) => { const tax = Math.round((base * n(vat)) / 100); return { base, tax, total: base + tax } }
  const min = tot(items.reduce((s, i) => s + itemCents(i), 0))
  const max = tot(items.reduce((s, i) => s + itemMaxCents(i), 0))
  return { ...min, baseMax: max.base, taxMax: max.tax, totalMax: max.total, variable: max.total > min.total }
}

/** Importe de cada fase sobre el total; la última se ajusta para que la suma cuadre al céntimo. */
export function phaseAmounts(phases: PhaseLike[], total: number) {
  const out = phases.map((p) => Math.round((total * n(p.percent)) / 100))
  const percentSum = phases.reduce((s, p) => s + n(p.percent), 0)
  if (out.length && Math.abs(percentSum - 100) < 0.001) out[out.length - 1] += total - out.reduce((s, x) => s + x, 0)
  return { amounts: out, percentSum }
}

const eur = (digits: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: digits, maximumFractionDigits: 2 })
const EUR = eur(2)
const EUR0 = eur(0)
/** Importe en céntimos: «700 €» si es redondo, «212,63 €» si no. */
export const money = (c: number) => (c % 100 === 0 ? EUR0 : EUR).format(c / 100)
/** «1.200 €» o, si es un rango, «1.200 – 2.100 €». */
export const moneyRange = (min: number, max?: number | null) => (max != null && max > min ? `${money(min).replace(/\s?€$/, '')} – ${money(max)}` : money(min))
export const qty = (v: Num) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n(v))
export const decimal = n

/** Siguiente número del año: P-2026-001, P-2026-002… */
export function nextNumber(year: number, existing: string[]) {
  const prefix = `P-${year}-`
  const max = existing.filter((x) => x.startsWith(prefix)).reduce((m, x) => Math.max(m, Number(x.slice(prefix.length)) || 0), 0)
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** Un enviado cuya validez ya pasó se muestra como caducado. */
export function visibleStatus(q: { status: QuoteStatus; validUntil: Date | null }, now = new Date()): QuoteStatus {
  if (q.status === 'SENT' && q.validUntil && q.validUntil.getTime() < now.getTime() - 864e5) return 'EXPIRED'
  return q.status
}

/** «1 hora», «12,5 horas», «3 meses»: plural de la unidad cuando la cantidad no es 1. */
export const unitFor = (unit: string, quantity: number) => (quantity === 1 || /s$/.test(unit) ? unit : /[aeiouáéíóú]$/i.test(unit) ? `${unit}s` : `${unit}es`)

export const UNITS = ['hora', 'día', 'mes', 'año', 'proyecto', 'unidad', 'página'] as const
