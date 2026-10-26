import Form from 'next/form'
import Link from 'next/link'
import { Search } from 'lucide-react'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { Button, ButtonLink, Card, Empty, Input, PageTitle, Select, Table } from '@/components/ui'
import { NewClientButton } from '@/components/clients/new-client-button'
import { ago } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { q?: string; filtro?: string; orden?: string }

const FILTERS = [
  { value: '', label: 'Todos los clientes' },
  { value: 'activos', label: 'Con proyectos activos' },
  { value: 'sin', label: 'Sin proyectos' },
  { value: 'presupuestos', label: 'Con presupuestos' },
  { value: 'incompletos', label: 'Sin correo ni teléfono' },
]
const ORDERS = [
  { value: '', label: 'Por nombre' },
  { value: 'actividad', label: 'Por última actividad' },
  { value: 'proyectos', label: 'Por número de proyectos' },
]

const live = { excluded: false, goneAt: null } satisfies Prisma.ProjectWhereInput

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const filter: Prisma.ClientWhereInput =
    sp.filtro === 'activos' ? { projects: { some: { ...live, status: { in: ['ACTIVE', 'MAINTENANCE'] } } } }
    : sp.filtro === 'sin' ? { projects: { none: live } }
    : sp.filtro === 'presupuestos' ? { quotes: { some: {} } }
    : sp.filtro === 'incompletos' ? { email: null, phone: null }
    : {}
  const where: Prisma.ClientWhereInput = {
    ...filter,
    ...(sp.q ? { OR: ['name', 'company', 'email', 'phone', 'taxId'].map((f) => ({ [f]: { contains: sp.q, mode: 'insensitive' } })) } : {}),
  }
  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { projects: { where: live }, websites: true, quotes: true } },
        projects: { where: live, orderBy: { lastActivityAt: { sort: 'desc', nulls: 'last' } }, take: 1, select: { lastActivityAt: true, name: true, id: true } },
      },
    }),
    prisma.client.count(),
  ])
  const last = (c: (typeof clients)[number]) => c.projects[0]?.lastActivityAt?.getTime() ?? 0
  if (sp.orden === 'actividad') clients.sort((a, b) => last(b) - last(a))
  if (sp.orden === 'proyectos') clients.sort((a, b) => b._count.projects - a._count.projects)
  const filtered = !!(sp.q || sp.filtro)

  return (
    <>
      <PageTitle title="Clientes" sub={filtered ? `${clients.length} de ${total} clientes` : `${total} clientes`} action={<NewClientButton />} />
      <Form action="/clientes" key={JSON.stringify(sp)} className="mb-6 grid gap-3 md:grid-cols-[minmax(18rem,2fr)_repeat(2,minmax(12rem,1fr))_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Buscar nombre, empresa, correo, teléfono o NIF" aria-label="Buscar" className="pl-12" />
        </div>
        <Select name="filtro" defaultValue={sp.filtro ?? ''} aria-label="Filtro" submitOnChange options={FILTERS} />
        <Select name="orden" defaultValue={sp.orden ?? ''} aria-label="Orden" submitOnChange options={ORDERS} />
        <div className="flex gap-2">
          <Button type="submit">Buscar</Button>
          {(filtered || sp.orden) && <ButtonLink href="/clientes" variant="ghost">Limpiar</ButtonLink>}
        </div>
      </Form>
      <Card>
        {clients.length === 0 ? <Empty title={filtered ? 'Ningún cliente con esos filtros' : 'Aún no hay clientes'} /> : (
          <Table head={['Cliente', 'Contacto', 'Proyectos', 'Webs', 'Presupuestos', 'Último proyecto tocado']}>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clientes/${c.id}`} className="font-semibold text-accent-strong hover:underline">{c.name}</Link>
                  {c.company && c.company !== c.name && <div className="text-sm text-muted">{c.company}</div>}
                </td>
                <td className="text-sm">{c.email || c.phone ? <>{c.email && <div>{c.email}</div>}{c.phone && <div className="text-muted">{c.phone}</div>}</> : <span className="text-muted">—</span>}</td>
                <td className="num">{c._count.projects}</td>
                <td className="num">{c._count.websites}</td>
                <td className="num">{c._count.quotes}</td>
                <td className="text-muted">{c.projects[0] ? <><Link href={`/proyectos/${c.projects[0].id}`} className="hover:underline">{c.projects[0].name}</Link> · {ago(c.projects[0].lastActivityAt)}</> : '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
