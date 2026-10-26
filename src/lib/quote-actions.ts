'use server'

/** Presupuestos: alta, datos, partidas y fases, editados uno a uno desde su ficha. */
import fs from 'node:fs/promises'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from './prisma'
import { storageDir } from './quote-ai'
import { newQuoteNumber } from './quote-number'
import { requireSession } from './session'

const STATUS = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'])
const PHASE_STATUS = z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'INVOICED'])

/** Número escrito a la española o a la inglesa: «1.234,56», «12,5», «12.5». */
const num = (min: number, max: number, msg = 'Escribe un número') =>
  z.string().trim().transform((v, ctx) => {
    const s = v.replace(/\s|€|%/g, '')
    const x = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
    if (!s || !Number.isFinite(x) || x < min || x > max) { ctx.addIssue({ code: 'custom', message: msg }); return z.NEVER }
    return x
  })
/** Fecha de un campo `date` (AAAA-MM-DD), a mediodía UTC para que no cambie de día al mostrarla en Madrid. */
const date = z.string().trim().refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Fecha no válida').transform((v) => (v ? new Date(`${v}T12:00:00Z`) : null))
/** Porcentaje opcional de 0 a 100 («30», «30 %», «12,5»). */
const percent = z.string().trim().transform((v) => v.replace(/\s|%/g, '').replace(',', '.')).pipe(z.string().refine((v) => !v || (Number(v) >= 0 && Number(v) <= 100), 'El porcentaje va de 0 a 100')).transform((v) => (v ? Number(v) : null))
/** Una línea por elemento (se quitan viñetas y líneas vacías). */
const lines = z.string().max(20000).transform((v) => v.split('\n').map((l) => l.replace(/^\s*[-•*·]\s*/, '').trim()).filter(Boolean))
/** Cronograma: una línea por fila, «cuándo: qué». */
const schedule = lines.transform((rows) => rows.map((r) => { const i = r.indexOf(':'); return i > 0 ? { when: r.slice(0, i).trim(), what: r.slice(i + 1).trim() } : { when: '', what: r } }))
const text = (max: number) => z.string().trim().max(max).transform((v) => v || null)
const errors = (e: z.ZodError) => ({ error: e.issues.map((i) => i.message).join('. ') })

function refresh(id: string) {
  revalidatePath('/presupuestos')
  revalidatePath(`/presupuestos/${id}`)
  revalidatePath('/clientes', 'layout')
}

const New = z.object({
  clientId: z.string().min(1, 'Elige el cliente'),
  title: z.string().trim().min(1, 'Ponle un título').max(200),
  projectId: z.string().optional().transform((v) => v || null),
})

export async function createQuote(form: FormData) {
  await requireSession()
  const r = New.safeParse(Object.fromEntries(form))
  if (!r.success) return errors(r.error)
  const brand = await prisma.brandSettings.findUnique({ where: { id: 'default' } })
  const q = await prisma.quote.create({
    data: { ...r.data, number: await newQuoteNumber(), vat: brand?.defaultVat ?? 21, validUntil: new Date(Date.now() + 30 * 864e5) },
  })
  refresh(q.id)
  redirect(`/presupuestos/${q.id}`)
}

const QUOTE_FIELDS = {
  title: z.string().trim().min(1, 'El título no puede quedar vacío').max(200),
  status: STATUS,
  clientId: z.string().min(1, 'Elige el cliente'),
  projectId: z.string().transform((v) => v || null),
  issuedAt: date.refine((v) => v !== null, 'La fecha no puede quedar vacía'),
  validUntil: date,
  vat: num(0, 100, 'El IVA va de 0 a 100'),
  notes: text(5000),
  scope: text(10000),
  thirdPartyCosts: text(5000),
  includes: lines,
  excludes: lines,
  assumptions: lines,
  schedule,
} as const

export async function updateQuoteField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(QUOTE_FIELDS) as [keyof typeof QUOTE_FIELDS]).parse(form.get('field'))
  const r = QUOTE_FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return errors(r.error)
  // al cambiar de cliente, el proyecto de otro cliente deja de tener sentido
  const extra = field === 'clientId' ? { projectId: null } : {}
  await prisma.quote.update({ where: { id }, data: { [field]: r.data, ...extra } })
  refresh(id)
}

export async function deleteQuote(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  await prisma.quote.delete({ where: { id } })
  await fs.rm(storageDir(id), { recursive: true, force: true }) // documentos que se subieron al asistente
  revalidatePath('/presupuestos')
  revalidatePath('/clientes', 'layout')
  redirect('/presupuestos')
}

/** Copia con número nuevo, en borrador y con las fases sin empezar. */
export async function duplicateQuote(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const q = await prisma.quote.findUniqueOrThrow({ where: { id }, include: { items: true, phases: true } })
  const copy = await prisma.quote.create({
    data: {
      number: await newQuoteNumber(), title: `${q.title} (copia)`, vat: q.vat, notes: q.notes, clientId: q.clientId, projectId: q.projectId,
      validUntil: new Date(Date.now() + 30 * 864e5),
      items: { create: q.items.map(({ description, quantity, unitPrice, unit, position }) => ({ description, quantity, unitPrice, unit, position })) },
      phases: { create: q.phases.map(({ name, description, percent, position }) => ({ name, description, percent, position })) },
    },
  })
  refresh(copy.id)
  redirect(`/presupuestos/${copy.id}`)
}

// ───────── Partidas ─────────

const quoteOfItem = async (id: string) => (await prisma.quoteItem.findUniqueOrThrow({ where: { id }, select: { quoteId: true } })).quoteId
const quoteOfPhase = async (id: string) => (await prisma.quotePhase.findUniqueOrThrow({ where: { id }, select: { quoteId: true } })).quoteId
const nextPos = async (model: 'item' | 'phase', quoteId: string) => {
  const agg = model === 'item'
    ? await prisma.quoteItem.aggregate({ where: { quoteId }, _max: { position: true } })
    : await prisma.quotePhase.aggregate({ where: { quoteId }, _max: { position: true } })
  return (agg._max.position ?? -1) + 1
}

/** Precio «hasta» opcional: vacío, sin rango. */
const priceMax = z.string().trim().transform((v) => v.replace(/\s|€/g, '')).pipe(z.union([z.literal('').transform(() => null), num(0, 1e8, 'El precio máximo no es válido')]))

const NewItem = z.object({
  quoteId: z.string().min(1),
  description: z.string().trim().min(1, 'Ponle nombre a la fase').max(500),
  quantity: num(0, 1e6, 'La cantidad no es válida'),
  unitPrice: num(-1e8, 1e8, 'El precio no es válido'),
  priceMax,
  unit: text(30),
})

export async function addItem(form: FormData) {
  await requireSession()
  const r = NewItem.safeParse({ unit: '', quantity: '1', priceMax: '', ...Object.fromEntries(form) })
  if (!r.success) return errors(r.error)
  await prisma.quoteItem.create({ data: { ...r.data, position: await nextPos('item', r.data.quoteId) } })
  refresh(r.data.quoteId)
}

/** Partida a partir de una tarifa: su nombre, precio y unidad, cantidad 1. */
export async function addItemFromRate(form: FormData) {
  await requireSession()
  const quoteId = z.string().min(1).parse(form.get('quoteId'))
  const rate = await prisma.rate.findUnique({ where: { id: String(form.get('value') ?? '') } })
  if (!rate) return { error: 'Elige una tarifa' }
  await prisma.quoteItem.create({ data: { quoteId, description: rate.name, unitPrice: rate.price, unit: rate.unit === 'proyecto' ? null : rate.unit, quantity: 1, position: await nextPos('item', quoteId) } })
  refresh(quoteId)
}

const ITEM_FIELDS = {
  description: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(500),
  details: text(3000),
  priceMax,
  quantity: num(0, 1e6, 'La cantidad no es válida'),
  unitPrice: num(-1e8, 1e8, 'El precio no es válido'),
  unit: text(30),
} as const

export async function updateItemField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(ITEM_FIELDS) as [keyof typeof ITEM_FIELDS]).parse(form.get('field'))
  const r = ITEM_FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return errors(r.error)
  await prisma.quoteItem.update({ where: { id }, data: { [field]: r.data } })
  refresh(await quoteOfItem(id))
}

export async function deleteItem(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const quoteId = await quoteOfItem(id)
  await prisma.quoteItem.delete({ where: { id } })
  refresh(quoteId)
}

/** Sube o baja una partida o una fase intercambiando su posición con la vecina. */
export async function moveRow(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const kind = z.enum(['item', 'phase']).parse(form.get('kind'))
  const dir = z.enum(['up', 'down']).parse(form.get('dir'))
  const quoteId = kind === 'item' ? await quoteOfItem(id) : await quoteOfPhase(id)
  const rows = kind === 'item'
    ? await prisma.quoteItem.findMany({ where: { quoteId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } })
    : await prisma.quotePhase.findMany({ where: { quoteId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true } })
  const ids = rows.map((r) => r.id)
  const i = ids.indexOf(id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await prisma.$transaction(ids.map((rowId, position) => kind === 'item'
    ? prisma.quoteItem.update({ where: { id: rowId }, data: { position } })
    : prisma.quotePhase.update({ where: { id: rowId }, data: { position } })))
  refresh(quoteId)
}

// ───────── Fases ─────────

const NewPhase = z.object({
  quoteId: z.string().min(1),
  name: z.string().trim().min(1, 'Ponle nombre a la fase').max(200),
  percent,
})

export async function addPhase(form: FormData) {
  await requireSession()
  const r = NewPhase.safeParse({ percent: '', ...Object.fromEntries(form) })
  if (!r.success) return errors(r.error)
  await prisma.quotePhase.create({ data: { ...r.data, position: await nextPos('phase', r.data.quoteId) } })
  refresh(r.data.quoteId)
}

const PHASE_FIELDS = {
  name: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(200),
  description: text(2000),
  percent,
  dueDate: date,
  status: PHASE_STATUS,
} as const

export async function updatePhaseField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(PHASE_FIELDS) as [keyof typeof PHASE_FIELDS]).parse(form.get('field'))
  const r = PHASE_FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return errors(r.error)
  // hecha o facturada: se apunta cuándo (de hecha a facturada se conserva la fecha); si vuelve atrás, se borra
  const prev = field === 'status' ? await prisma.quotePhase.findUnique({ where: { id }, select: { completedAt: true } }) : null
  const extra = field === 'status' ? { completedAt: r.data === 'DONE' || r.data === 'INVOICED' ? (prev?.completedAt ?? new Date()) : null } : {}
  await prisma.quotePhase.update({ where: { id }, data: { [field]: r.data, ...extra } })
  refresh(await quoteOfPhase(id))
}

export async function deletePhase(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const quoteId = await quoteOfPhase(id)
  await prisma.quotePhase.delete({ where: { id } })
  refresh(quoteId)
}
