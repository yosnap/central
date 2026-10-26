import Form from 'next/form'
import Link from 'next/link'
import type { Prisma, ProjectType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { ArrowLeft, EyeOff, Search } from 'lucide-react'
import { includeProject } from '@/lib/project-actions'
import { ActionForm, Button, ButtonLink, Card, Empty, SubmitButton, Input, PageTitle, Pill, Select, Table, statusTone, toOptions } from '@/components/ui'
import { KIND_LABEL, PLATFORM_LABEL, STATUS_LABEL, TYPE_LABEL, ago } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { q?: string; tipo?: string; que?: string; estado?: string; cliente?: string; excluidos?: string }

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const showExcluded = sp.excluidos === '1'
  const where: Prisma.ProjectWhereInput = {
    excluded: showExcluded,
    // los que ya no tienen carpeta se resuelven en Pendientes
    ...(showExcluded ? {} : { goneAt: null }),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: 'insensitive' } }, { stack: { has: sp.q } }, { client: { name: { contains: sp.q, mode: 'insensitive' } } }] } : {}),
    ...(sp.tipo ? { kind: sp.tipo as Prisma.EnumProjectKindFilter['equals'] } : showExcluded ? {} : { kind: { in: ['CLIENT', 'OWN'] } }),
    // por tipo confirmado o, si aún no lo tiene, por el propuesto
    ...(sp.que ? { AND: [sp.que === 'sin' ? { type: null } : { OR: [{ type: sp.que as ProjectType }, { type: null, suggestedType: sp.que as ProjectType }] }] } : {}),
    ...(sp.estado ? { status: sp.estado as Prisma.EnumProjectStatusFilter['equals'] } : {}),
    ...(sp.cliente ? { clientId: sp.cliente } : {}),
  }
  const [projects, clients, counts, excludedCount] = await Promise.all([
    prisma.project.findMany({ where, orderBy: { lastActivityAt: 'desc' }, include: { client: true, _count: { select: { locations: true } } } }),
    prisma.client.findMany({ orderBy: { name: 'asc' } }),
    prisma.project.groupBy({ by: ['kind'], where: { excluded: false }, _count: true }),
    prisma.project.count({ where: { excluded: true } }),
  ])
  const countOf = (k: string) => counts.find((c) => c.kind === k)?._count ?? 0
  return (
    <>
      <PageTitle
        title={showExcluded ? 'Proyectos excluidos' : 'Proyectos'}
        sub={showExcluded ? `${projects.length} fuera de Central: no cuentan en listados, avisos ni en el MCP` : `${projects.length} en esta vista · ${countOf('CLIENT')} de clientes, ${countOf('OWN')} propios, ${countOf('TRAINING')} de formación, ${countOf('EXPERIMENT')} experimentos`}
        action={showExcluded
          ? <ButtonLink href="/proyectos" variant="ghost"><ArrowLeft className="size-5" aria-hidden />Volver a proyectos</ButtonLink>
          : excludedCount > 0 && <ButtonLink href="/proyectos?excluidos=1" variant="secondary"><EyeOff className="size-5" aria-hidden />Excluidos ({excludedCount})</ButtonLink>}
      />
      <Form action="/proyectos" key={JSON.stringify(sp)} className="mb-6 grid gap-3 md:grid-cols-[minmax(18rem,2fr)_repeat(4,minmax(11rem,1fr))_auto]">
        {showExcluded && <input type="hidden" name="excluidos" value="1" />}
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Buscar nombre, cliente o stack (p. ej. Next.js)" aria-label="Buscar" className="pl-12" />
        </div>
        <Select name="tipo" defaultValue={sp.tipo ?? ''} aria-label="Tipo" submitOnChange options={[{ value: '', label: showExcluded ? 'Cualquier tipo' : 'Clientes y propios' }, ...toOptions(KIND_LABEL)]} />
        <Select name="que" defaultValue={sp.que ?? ''} aria-label="Qué es" submitOnChange options={[{ value: '', label: 'Cualquier cosa' }, { value: 'sin', label: 'Sin tipo' }, ...toOptions(TYPE_LABEL)]} />
        <Select name="estado" defaultValue={sp.estado ?? ''} aria-label="Estado" submitOnChange options={[{ value: '', label: 'Cualquier estado' }, ...toOptions(STATUS_LABEL)]} />
        <Select name="cliente" defaultValue={sp.cliente ?? ''} aria-label="Cliente" submitOnChange options={[{ value: '', label: 'Todos los clientes' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        <div className="flex gap-2">
          <Button type="submit">Buscar</Button>
          {(sp.q || sp.tipo || sp.que || sp.estado || sp.cliente) && <ButtonLink href={showExcluded ? '/proyectos?excluidos=1' : '/proyectos'} variant="ghost">Limpiar</ButtonLink>}
        </div>
      </Form>
      <Card>
        {projects.length === 0 ? (showExcluded && !(sp.q || sp.tipo || sp.que || sp.estado || sp.cliente)
          ? <Empty title="No hay proyectos excluidos">Excluye un proyecto desde su ficha para sacarlo de Central sin borrarlo.</Empty>
          : <Empty title="No hay proyectos con estos filtros">Prueba con otra búsqueda o limpia los filtros.</Empty>) : (
        <Table head={['Proyecto', 'Qué es', 'Cliente', 'Estado', 'Versión', 'Stack', 'Último cambio', 'Sin commit', 'Ubic.', ...(showExcluded ? [''] : [])]}>
          {projects.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/proyectos/${p.id}`} className="font-semibold text-accent-strong hover:underline">{p.name}</Link>{p.phase && <div className="text-sm text-muted">{p.phase}</div>}</td>
              <td className="text-sm text-muted">{p.type ? `${TYPE_LABEL[p.type]}${p.platform ? ` · ${PLATFORM_LABEL[p.platform]}` : ''}` : <span className="italic">{p.suggestedType ? `¿${TYPE_LABEL[p.suggestedType]}?` : '—'}</span>}</td>
              <td className="text-muted">{p.client?.name ?? KIND_LABEL[p.kind]}</td>
              <td><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Pill></td>
              <td className="num whitespace-nowrap">{p.version ?? '—'}</td>
              <td className="max-w-sm text-sm text-muted">{p.framework ?? p.stack.slice(0, 4).join(', ')}</td>
              <td className="whitespace-nowrap text-muted">{ago(p.lastActivityAt)}</td>
              <td className={`num ${p.uncommitted ? 'text-warn' : 'text-muted'}`}>{p.uncommitted ?? '—'}</td>
              <td className="num text-muted">{p._count.locations}</td>
              {showExcluded && (
                <td className="text-right">
                  <ActionForm action={includeProject} success={`${p.name} vuelve a Central`}><input type="hidden" name="id" value={p.id} /><SubmitButton variant="secondary" size="sm">Volver a incluir</SubmitButton></ActionForm>
                </td>
              )}
            </tr>
          ))}
        </Table>
        )}
      </Card>
    </>
  )
}
