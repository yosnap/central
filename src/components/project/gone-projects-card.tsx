import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { deleteProjectAction, mergeProjectAction } from '@/lib/project-cleanup-actions'
import { Card, ConfirmAction, InlineField, Table } from '@/components/ui'
import { fmtDate } from '@/lib/format'

/** Proyectos cuyas carpetas ya no existen: eliminarlos de Central o unirlos al proyecto renombrado. */
export async function GoneProjectsCard() {
  const gone = await prisma.project.findMany({
    where: { goneAt: { not: null }, excluded: false },
    orderBy: { goneAt: 'desc' },
    select: {
      id: true, name: true, goneAt: true, client: { select: { name: true } },
      locations: { select: { path: true }, take: 1, orderBy: { kind: 'asc' } },
      _count: { select: { services: true, notes: true, secrets: true, quotes: true } },
    },
  })
  if (!gone.length) return null
  const projects = await prisma.project.findMany({ where: { excluded: false, goneAt: null }, select: { id: true, name: true, createdAt: true, locations: { select: { path: true }, take: 1, orderBy: { kind: 'asc' } } }, orderBy: { name: 'asc' } })
  return (
    <Card title="Sin carpeta en disco" className="mt-6" note="Proyectos cuyas carpetas ya no existen (borradas, movidas o renombradas). Si lo renombraste, únelo al nuevo y conservarás cliente, servicios, secretos y notas. Si lo borraste, elimínalo de Central.">
      <Table head={['Proyecto', 'Estaba en', 'Qué tiene', 'Es el mismo que…', '']}>
        {gone.map((p) => {
          // primero los proyectos que aparecieron cuando este desapareció: suelen ser el renombrado
          const since = (p.goneAt?.getTime() ?? 0) - 3 * 86_400_000
          const options = [...projects].sort((a, b) => Number(b.createdAt.getTime() >= since) - Number(a.createdAt.getTime() >= since))
            .map((x) => ({ value: x.id, label: x.name, hint: [x.createdAt.getTime() >= since ? 'nuevo' : '', x.locations[0]?.path.split('/').slice(-2).join('/')].filter(Boolean).join(' · ') }))
          const has = [p._count.services && `${p._count.services} servicios`, p._count.secrets && `${p._count.secrets} secretos`, p._count.notes && `${p._count.notes} notas`, p._count.quotes && `${p._count.quotes} presupuestos`, p.client?.name].filter(Boolean)
          return (
            <tr key={p.id} className="align-top">
              <td className="font-semibold"><Link href={`/proyectos/${p.id}`} className="text-accent-strong hover:underline">{p.name}</Link><div className="text-sm font-normal text-muted">sin carpeta desde {fmtDate(p.goneAt)}</div></td>
              <td className="max-w-64 break-all text-sm text-muted">{p.locations[0]?.path ?? '—'}</td>
              <td className="text-sm">{has.length ? has.join(' · ') : <span className="text-muted">Nada que conservar</span>}</td>
              <td className="min-w-64">
                <InlineField action={mergeProjectAction} fields={{ id: p.id }} name="into" label={`Proyecto nuevo de ${p.name}`} hideLabel kind="combobox" allowCustom={false}
                  options={options} value="" display={<span className="text-muted">Unir con…</span>} placeholder="Busca el proyecto nuevo…" success="Proyectos unidos" />
              </td>
              <td className="text-right">
                <ConfirmAction action={deleteProjectAction} fields={{ id: p.id }} title={`Eliminar ${p.name} de Central`} confirmLabel="Eliminar"
                  description={has.length ? `Se borra de Central con lo que tiene (${has.join(', ')}). En el disco no se toca nada. Si lo renombraste, mejor únelo al nuevo.` : 'Se borra de Central. En el disco no se toca nada.'}>
                  Eliminar de Central
                </ConfirmAction>
              </td>
            </tr>
          )
        })}
      </Table>
    </Card>
  )
}
