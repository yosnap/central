import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { Prisma } from '../../generated/prisma/client'

const clash = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'prueba', meta: { target: ['number'] } })
let failures = 0
let created: { number: string }[] = []
let numbers = 0

const fakePrisma = {
  $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(fakePrisma),
  $executeRaw: async () => 1,
  client: { findFirst: async () => ({ id: 'c1', name: 'Cliente' }) },
  brandSettings: { findUnique: async () => ({ defaultVat: 21 }) },
  quote: {
    create: async ({ data }: { data: { number: string } }) => {
      if (failures > 0) { failures--; throw clash() }
      created.push(data)
      return { id: `q${created.length}`, number: data.number }
    },
  },
}
mock.module('../prisma', () => ({ prisma: fakePrisma }))
mock.module('../quote-number', () => ({ newQuoteNumber: async () => `P-2026-${String(++numbers).padStart(3, '0')}` }))

const { MAX_AMOUNT, createQuote, createQuoteSchema, isNumberClash } = await import('./quotes')

const valid = { client: 'Cliente', title: 'Web', items: [{ description: 'Diseño', unitPrice: 1800 }] }
const issues = (input: unknown) => {
  const r = createQuoteSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

beforeEach(() => { failures = 0; created = []; numbers = 0 })

describe('esquema de un borrador', () => {
  test('acepta un borrador normal', () => expect(issues(valid)).toEqual([]))

  test('rechaza importes negativos o fuera de Decimal(10,2)', () => {
    expect(issues({ ...valid, items: [{ description: 'a', unitPrice: -1 }] })).toEqual(['items.0.unitPrice'])
    expect(issues({ ...valid, items: [{ description: 'a', unitPrice: MAX_AMOUNT + 1 }] })).toEqual(['items.0.unitPrice'])
    expect(issues({ ...valid, items: [{ description: 'a', unitPrice: 1, quantity: 1e9 }] })).toEqual(['items.0.quantity'])
    expect(issues({ ...valid, items: [{ description: 'a', unitPrice: 500, priceMax: 100 }] })).toEqual(['items.0.priceMax'])
  })

  test('topes de listas y textos', () => {
    expect(issues({ ...valid, items: Array.from({ length: 101 }, () => valid.items[0]) })).toEqual(['items'])
    expect(issues({ ...valid, includes: Array.from({ length: 51 }, () => 'x') })).toEqual(['includes'])
    expect(issues({ ...valid, includes: ['x'.repeat(1001)] })).toEqual(['includes.0'])
    expect(issues({ ...valid, schedule: [{ when: 'x'.repeat(201), what: 'y' }] })).toEqual(['schedule.0.when'])
  })
})

describe('número de presupuesto', () => {
  test('reintenta si otra alta se lleva el mismo número', async () => {
    failures = 2
    const r = await createQuote(createQuoteSchema.parse(valid))
    expect(r).toEqual({ ok: true, id: 'q1', number: 'P-2026-003' })
    expect(created).toHaveLength(1)
  })

  test('se rinde tras varios choques con el error del índice', async () => {
    failures = 99
    const e = await createQuote(createQuoteSchema.parse(valid)).catch((x: unknown) => x)
    expect(isNumberClash(e)).toBe(true)
  })

  test('otros errores no se tratan como choque', () => {
    expect(isNumberClash(new Error('otra cosa'))).toBe(false)
    expect(isNumberClash(new Prisma.PrismaClientKnownRequestError('x', { code: 'P2003', clientVersion: 'prueba' }))).toBe(false)
  })
})
