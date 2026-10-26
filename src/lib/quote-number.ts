/** Siguiente número de presupuesto del año en curso (lo usan la app y el MCP). */
import { prisma } from './prisma'
import { nextNumber } from './quotes'

export async function newQuoteNumber() {
  const year = new Date().getFullYear()
  const rows = await prisma.quote.findMany({ where: { number: { startsWith: `P-${year}-` } }, select: { number: true } })
  return nextNumber(year, rows.map((r) => r.number))
}
