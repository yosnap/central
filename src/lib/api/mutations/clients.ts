/**
 * Alta y cambio de clientes: lo usan la ficha de la web (Server Actions) y la API v1 (`POST /clientes`,
 * `PATCH /clientes/{id}`). Misma validación, misma regla de nombre único y, desde la API, versión y registro.
 */
import { z } from 'zod'
import { prisma } from '../../prisma'
import { MutationError } from './errors'
import { VERSION_PATTERN, audit, changedData, changesOf, checkVersion, isUniqueClash, lockRow, versionOf, type MutationOptions, type Tx } from './common'

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null)

/** Campos editables de un cliente, como texto (vacío = sin dato). */
export const CLIENT_FIELDS = {
  name: z.string().trim().min(1, 'El nombre no puede quedar vacío').max(120),
  company: opt(160),
  email: z.string().trim().max(200).refine((v) => !v || z.email().safeParse(v).success, 'El correo no es válido').transform((v) => v || null),
  phone: opt(40),
  taxId: opt(30),
  address: opt(500),
} as const

export type ClientField = keyof typeof CLIENT_FIELDS
export type ClientData = { name: string; company: string | null; email: string | null; phone: string | null; taxId: string | null; address: string | null }
const EDITABLE = Object.keys(CLIENT_FIELDS) as ClientField[]

/** En JSON, `null` vale como vacío. */
const orNull = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === null ? '' : v), s)

export const clientCreateSchema = z.strictObject({
  name: CLIENT_FIELDS.name,
  company: orNull(CLIENT_FIELDS.company).optional(),
  email: orNull(CLIENT_FIELDS.email).optional(),
  phone: orNull(CLIENT_FIELDS.phone).optional(),
  taxId: orNull(CLIENT_FIELDS.taxId).optional(),
  address: orNull(CLIENT_FIELDS.address).optional(),
})
export type ClientCreate = z.infer<typeof clientCreateSchema>

export const clientPatchSchema = z.strictObject({
  version: z.string().regex(VERSION_PATTERN, 'Versión no válida: usa la de la última lectura'),
  name: CLIENT_FIELDS.name.optional(),
  company: orNull(CLIENT_FIELDS.company).optional(),
  email: orNull(CLIENT_FIELDS.email).optional(),
  phone: orNull(CLIENT_FIELDS.phone).optional(),
  taxId: orNull(CLIENT_FIELDS.taxId).optional(),
  address: orNull(CLIENT_FIELDS.address).optional(),
}).refine((d) => EDITABLE.some((k) => d[k] !== undefined), 'Indica al menos un campo que cambiar')

type ClientRow = ClientData & { id: string; createdAt: Date; updatedAt: Date }

export const clientVersion = (c: ClientData) => versionOf({ name: c.name, company: c.company, email: c.email, phone: c.phone, taxId: c.taxId, address: c.address })

/** El cliente tal como se devuelve fuera: sus datos, fechas y versión. */
export function publicClient(c: ClientRow) {
  return { id: c.id, name: c.name, company: c.company, email: c.email, phone: c.phone, taxId: c.taxId, address: c.address, createdAt: c.createdAt, updatedAt: c.updatedAt, version: clientVersion(c) }
}

/** Cerrojo de las altas y renombrados: dos a la vez no pueden dejar dos clientes con el mismo nombre. */
const CLIENT_NAME_LOCK = 7_310_002

async function assertNameFree(tx: Tx, name: string, id?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLIENT_NAME_LOCK})`
  const other = await tx.client.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } })
  if (other && other.id !== id) throw new MutationError('duplicate', `Ya hay un cliente llamado «${name}»`)
}

const duplicateOnClash = (name: string) => (e: unknown): never => {
  if (isUniqueClash(e)) throw new MutationError('duplicate', `Ya hay un cliente llamado «${name}»`)
  throw e
}

export async function createClient(input: ClientCreate, opts: MutationOptions = {}) {
  const data: ClientData = { name: input.name, company: input.company ?? null, email: input.email ?? null, phone: input.phone ?? null, taxId: input.taxId ?? null, address: input.address ?? null }
  return prisma.$transaction(async (tx) => {
    await assertNameFree(tx, data.name)
    const c = await tx.client.create({ data })
    await audit(tx, opts.actor, 'create', 'client', c.id, changesOf({}, data))
    return publicClient(c)
  }).catch(duplicateOnClash(data.name))
}

/** Cambia los campos indicados (`undefined` = no se toca). Con `expectedVersion`, 409 si otro lo cambió antes. */
export async function updateClient(id: string, patch: Partial<ClientData>, opts: MutationOptions = {}) {
  return prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, 'Client', id))) throw new MutationError('not_found', 'Ese cliente ya no existe')
    const cur = await tx.client.findUniqueOrThrow({ where: { id } })
    checkVersion(opts.expectedVersion, clientVersion(cur), () => publicClient(cur))
    const changes = changesOf(cur, patch)
    if (Object.keys(changes).length === 0) return publicClient(cur)
    if (changes.name && patch.name) await assertNameFree(tx, patch.name, id)
    const updated = await tx.client.update({ where: { id }, data: changedData(patch, changes) })
    await audit(tx, opts.actor, 'update', 'client', id, changes)
    return publicClient(updated)
  }).catch(duplicateOnClash(patch.name ?? ''))
}
