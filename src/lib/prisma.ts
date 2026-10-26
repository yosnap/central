import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// En desarrollo el cliente se reutiliza entre recargas; si `prisma generate` cambia el cliente (campo o modelo
// nuevo), la clase es otra y se crea uno nuevo en lugar de seguir con el viejo.
const g = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: typeof PrismaClient }

function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

if (g.prisma && g.prismaClass !== PrismaClient) {
  void g.prisma.$disconnect().catch(() => {})
  g.prisma = undefined
}

export const prisma = g.prisma ?? create()
if (process.env.NODE_ENV !== 'production') {
  g.prisma = prisma
  g.prismaClass = PrismaClient
}
