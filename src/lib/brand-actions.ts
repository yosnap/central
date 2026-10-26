'use server'

/** Ajustes de presupuestos: datos de marca con su logo y tarifas. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { logoColors } from './brand-image'
import { prisma } from './prisma'
import { requireSession } from './session'

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null)
const price = z.string().trim().transform((v, ctx) => {
  const s = v.replace(/\s|€/g, '')
  const x = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  if (!s || !Number.isFinite(x) || x < 0 || x > 1e8) { ctx.addIssue({ code: 'custom', message: 'El precio no es válido' }); return z.NEVER }
  return x
})
const errors = (e: z.ZodError) => ({ error: e.issues.map((i) => i.message).join('. ') })

function refresh() {
  revalidatePath('/ajustes')
  revalidatePath('/presupuestos', 'layout')
}

const Brand = z.object({
  businessName: z.string().trim().min(1, 'El nombre comercial no puede quedar vacío').max(160),
  ownerName: text(160),
  taxId: text(30),
  address: text(500),
  email: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, 'El correo no es válido').transform((v) => v || null),
  phone: text(40),
  website: text(200),
  iban: z.string().trim().max(42).transform((v) => v.replace(/\s/g, '').toUpperCase() || null),
  defaultVat: price.refine((v) => v <= 100, 'El IVA va de 0 a 100'),
  quoteFooter: text(2000),
  pricingGuide: text(20000),
  primaryColor: z.string().trim().regex(/^$|^#[0-9a-f]{6}$/i, 'Color no válido').transform((v) => v.toLowerCase() || null),
  secondaryColor: z.string().trim().regex(/^$|^#[0-9a-f]{6}$/i, 'Color no válido').transform((v) => v.toLowerCase() || null),
})

export async function saveBrand(form: FormData) {
  await requireSession()
  const r = Brand.safeParse({ primaryColor: '', secondaryColor: '', ...Object.fromEntries([...form.entries()].filter(([k]) => k !== 'logo')) })
  if (!r.success) return errors(r.error)
  const file = form.get('logo')
  let logo = {}
  if (file instanceof File && file.size > 0) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) return { error: 'El logo tiene que ser PNG o JPG (el PDF no admite otros formatos)' }
    if (file.size > 1024 * 1024) return { error: 'El logo pesa más de 1 MB' }
    const data = new Uint8Array(await file.arrayBuffer())
    // logo nuevo: sus colores pasan a ser los corporativos (se pueden retocar después)
    const colors = await logoColors(Buffer.from(data)).catch(() => null)
    logo = { logoData: data, logoType: file.type, ...(colors ? { primaryColor: colors.primary, secondaryColor: colors.secondary } : {}) }
  }
  await prisma.brandSettings.upsert({ where: { id: 'default' }, update: { ...r.data, ...logo }, create: { id: 'default', ...r.data, ...logo } })
  refresh()
}

export async function removeLogo() {
  await requireSession()
  await prisma.brandSettings.updateMany({ where: { id: 'default' }, data: { logoData: null, logoType: null } })
  refresh()
}

const NewRate = z.object({ name: z.string().trim().min(1, 'Ponle nombre a la tarifa').max(200), unit: z.string().trim().min(1).max(30), price })

export async function addRate(form: FormData) {
  await requireSession()
  const r = NewRate.safeParse(Object.fromEntries(form))
  if (!r.success) return errors(r.error)
  await prisma.rate.create({ data: r.data })
  refresh()
}

const RATE_FIELDS = { name: NewRate.shape.name, unit: NewRate.shape.unit, price } as const

export async function updateRateField(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const field = z.enum(Object.keys(RATE_FIELDS) as [keyof typeof RATE_FIELDS]).parse(form.get('field'))
  const r = RATE_FIELDS[field].safeParse(String(form.get('value') ?? ''))
  if (!r.success) return errors(r.error)
  await prisma.rate.update({ where: { id }, data: { [field]: r.data } })
  refresh()
}

export async function setRateActive(id: string, active: boolean) {
  await requireSession()
  await prisma.rate.update({ where: { id: z.string().min(1).parse(id) }, data: { active } })
  refresh()
}

/** Las partidas ya creadas guardan su propia copia, así que borrar la tarifa no cambia ningún presupuesto. */
export async function deleteRate(form: FormData) {
  await requireSession()
  await prisma.rate.delete({ where: { id: z.string().min(1).parse(form.get('id')) } })
  refresh()
}
