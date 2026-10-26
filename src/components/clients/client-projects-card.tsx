import Link from 'next/link'
import { X } from 'lucide-react'
import type { ProjectStatus } from '@/generated/prisma/client'
import { assignProject, unassignProject } from '@/lib/client-actions'
import { Card, ConfirmAction, Empty, InlineField, Pill, Table, statusTone, type Option } from '@/components/ui'
import { STATUS_LABEL, ago } from '@/lib/format'

export type ClientProject = { id: string; name: string; status: ProjectStatus; version: string | null; framework: string | null; lastActivityAt: Date | null; _count: { websites: number } }

/** Proyectos del cliente, con asignar uno existente y quitarlo (el proyecto no se borra). */
export function ClientProjectsCard({ clientId, clientName, projects, candidates }: { clientId: string; clientName: string; projects: ClientProject[]; candidates: Option[] }) {
  return (
    <Card title="Proyectos" className="xl:col-span-2" note="Al asignar un proyecto pasa a ser trabajo de cliente, y sus webs sin cliente quedan también a su nombre.">
      <div className="mb-5 max-w-xl">
        <InlineField action={assignProject} fields={{ id: clientId }} label="Asignar un proyecto" kind="combobox" allowCustom={false} options={candidates} value=""
          display={<span className="text-muted">Busca un proyecto de tus carpetas…</span>} placeholder="Busca un proyecto…" success="Proyecto asignado" />
      </div>
      {projects.length === 0 ? <Empty title="Aún no tiene proyectos" /> : (
        <Table head={['Proyecto', 'Estado', 'Versión', 'Webs', 'Última actividad', '']}>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/proyectos/${p.id}`} className="font-semibold text-accent-strong hover:underline">{p.name}</Link>
                {p.framework && <div className="text-sm text-muted">{p.framework}</div>}
              </td>
              <td><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Pill></td>
              <td className="num">{p.version ? `v${p.version}` : '—'}</td>
              <td className="num">{p._count.websites}</td>
              <td className="whitespace-nowrap text-muted">{ago(p.lastActivityAt)}</td>
              <td className="text-right">
                <ConfirmAction action={unassignProject} fields={{ id: clientId, projectId: p.id }} variant="ghost" size="sm" title={`Quitar ${p.name} de ${clientName}`}
                  description="El proyecto queda sin cliente, igual que sus webs. No se borra nada." confirmLabel="Quitar" success="Proyecto quitado">
                  <X className="size-4" aria-hidden />Quitar
                </ConfirmAction>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
