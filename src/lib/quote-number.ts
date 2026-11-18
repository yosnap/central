/** Siguiente número de presupuesto del año en curso (lo usan la app y el MCP). */
import type { Prisma } from '../generated/prisma/client'
import { prisma } from './prisma'
import { nextNumber } from './quotes'

/** Con `db`, la lectura va dentro de esa transacción (la API la hace con un cerrojo para no repetir número). */
export async function newQuoteNumber(db: Prisma.TransactionClient = prisma) {
  const year = new Date().getFullYear()
  const rows = await db.quote.findMany({ where: { number: { startsWith: `P-${year}-` } }, select: { number: true } })
  return nextNumber(year, rows.map((r) => r.number))
}
