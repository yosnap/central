import Link from 'next/link'
import { Card, Empty, Pill, Table, statusTone } from '@/components/ui'
import { envLabel } from '@/lib/environments'
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/format'
import type { ProjectStatus, ProjectType } from '@/generated/prisma/client'

type Service = { id: string; name: string; environment: string; url: string | null; website: { lastStatus: string | null } | null }

/** Un addon no tiene dominios propios: muestra los del sistema al que pertenece, solo lectura. */
export function InheritedServicesCard({ parent }: { parent: { id: string; name: string; services: Service[] } | null }) {
  return (
    <Card title="Dominios heredados" note="Un addon o módulo vive en los dominios del sistema al que pertenece. Se editan en la ficha del sistema." className="xl:col-span-3">
      {!parent ? (
        <Empty title="Sin sistema">Elige en «Clasificación» el sistema al que pertenece este addon.</Empty>
      ) : parent.services.length === 0 ? (
        <Empty title={`${parent.name} no tiene servicios`}>Añádelos en la <Link href={`/proyectos/${parent.id}`} className="text-accent-strong hover:underline">ficha de {parent.name}</Link>.</Empty>
      ) : (
        <>
          <p className="mb-3 text-base">De <Link href={`/proyectos/${parent.id}`} className="font-semibold text-accent-strong hover:underline">{parent.name}</Link></p>
          <Table head={['Servicio', 'Entorno', 'URL', 'Estado']}>
            {parent.services.map((s) => (
              <tr key={s.id}>
                <td className="font-semibold">{s.name}</td>
                <td className="text-muted">{envLabel(s.environment)}</td>
                <td className="break-all">{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">{s.url}</a> : '—'}</td>
                <td>{s.website?.lastStatus ? <Pill tone={s.website.lastStatus === 'up' ? 'ok' : 'bad'}>{s.website.lastStatus === 'up' ? 'En línea' : 'Caída'}</Pill> : '—'}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Card>
  )
}

type Part = { id: string; name: string; type: ProjectType | null; status: ProjectStatus; version: string | null }

/** Ficha de un sistema: sus addons y módulos. */
export function PartsCard({ parts }: { parts: Part[] }) {
  if (!parts.length) return null
  return (
    <Card title="Piezas de este sistema" note="Addons y módulos que pertenecen a este proyecto." className="xl:col-span-3">
      <Table head={['Pieza', 'Tipo', 'Estado', 'Versión']}>
        {parts.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/proyectos/${p.id}`} className="font-semibold text-accent-strong hover:underline">{p.name}</Link></td>
            <td className="text-muted">{p.type ? TYPE_LABEL[p.type] : '—'}</td>
            <td><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Pill></td>
            <td className="num">{p.version ?? '—'}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
