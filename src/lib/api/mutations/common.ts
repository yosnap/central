/**
 * Piezas comunes de las escrituras: versión de una entidad (control de concurrencia optimista), cerrojo de la fila,
 * diferencias campo a campo y registro de lo que cambia una app por la API (`ApiChange`).
 */
import { createHash } from 'node:crypto'
import { Prisma } from '../../../generated/prisma/client'
import { MutationError } from './errors'

export type Tx = Prisma.TransactionClient
/** App que escribe por la API v1 (la clave). Sin ella (web, MCP) no se registra nada. */
export type ApiActor = { keyId: string; keyName: string }
export type MutationOptions = { actor?: ApiActor; expectedVersion?: string }

/** Valor comparable: fechas en ISO, decimales como número, ausente como null. */
function plain(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (Prisma.Decimal.isDecimal(v)) return Number(v.toString())
  return v ?? null
}

/**
 * Versión de una entidad: huella de sus campos editables. Cambia solo si alguien cambió alguno de ellos (no cuando
 * el escáner toca otras columnas) y no depende de la precisión de `updatedAt`.
 */
export function versionOf(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify(Object.keys(fields).sort().map((k) => [k, plain(fields[k])]))
  return createHash('sha256').update(canonical).digest('hex').slice(0, 20)
}

export const VERSION_PATTERN = /^[0-9a-f]{20}$/

/** Conflicto (409) si quien escribe vio otra versión. Sin versión esperada (web, MCP) no se comprueba. */
export function checkVersion(expected: string | undefined, current: string, view: () => unknown) {
  if (expected !== undefined && expected !== current) {
    throw new MutationError('conflict', 'Ha cambiado en Central desde que lo leíste: vuelve a leerlo y revisa el cambio', view())
  }
}

export type Changes = Record<string, { from: unknown; to: unknown }>

/** Campos del parche que de verdad cambian, con su valor anterior y el nuevo. */
export function changesOf(current: Record<string, unknown>, patch: Record<string, unknown>): Changes {
  const out: Changes = {}
  for (const [k, to] of Object.entries(patch)) {
    if (to === undefined) continue
    const from = current[k]
    if (JSON.stringify(plain(from)) !== JSON.stringify(plain(to))) out[k] = { from: plain(from), to: plain(to) }
  }
  return out
}

/** Solo los campos que cambian, listos para `update`. */
export function changedData<T extends Record<string, unknown>>(patch: T, changes: Changes): Partial<T> {
  return Object.fromEntries(Object.keys(changes).map((k) => [k, patch[k]])) as Partial<T>
}

const TABLES = { Client: Prisma.raw('"Client"'), Project: Prisma.raw('"Project"'), QuotePhase: Prisma.raw('"QuotePhase"') } as const

/** Bloquea la fila hasta el final de la transacción: lectura, comprobación de versión y escritura sin carreras. */
export async function lockRow(tx: Tx, table: keyof typeof TABLES, id: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM ${TABLES[table]} WHERE id = ${id} FOR UPDATE`
  return rows.length > 0
}

export type AuditEntity = 'client' | 'project' | 'note' | 'quotePhase'

/**
 * Apunta en el registro qué cambió una app: quién, cuándo, qué entidad y los NOMBRES de los campos. Nunca los
 * valores (ni antes ni después) ni el texto de una nota: el registro no guarda datos personales. Solo en la API.
 */
export async function audit(tx: Tx, actor: ApiActor | undefined, action: 'create' | 'update', entity: AuditEntity, entityId: string, changes: Changes) {
  if (!actor) return
  await tx.apiChange.create({ data: { keyId: actor.keyId, keyName: actor.keyName, action, entity, entityId, fields: Object.keys(changes).sort() } })
}

/** Choque de un índice único (P2002). */
export const isUniqueClash = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
