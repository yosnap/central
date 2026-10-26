import Link from 'next/link'
import { linkContainerAction } from '@/lib/server-actions'
import { ROLE_LABEL, roleOf } from '@/lib/servers/role'
import { InlineField, Pill, Table, type Option } from '@/components/ui'

export type ContainerRow = {
  id: string; name: string; kind: string; state: string; detail: string | null; desired: number | null; running: number | null
  image: string | null; version?: string | null; role: string | null; domains: string[]; projectServiceId: string | null; matchManual: boolean
  projectService?: { name: string; project: { id: string; name: string } } | null
  server?: { id: string; name: string }
}

const STATE = { down: ['bad', 'Caído'], stopped: ['warn', 'Parado'], ok: ['ok', 'En marcha'] } as const
const ORDER = ['down', 'stopped', 'ok']

/** Tabla de servicios Docker con qué es cada uno, qué dominios sirve y a qué proyecto pertenece (editable). */
export function ContainersTable({ containers, options, showServer }: { containers: ContainerRow[]; options: Option[]; showServer?: boolean }) {
  const sorted = [...containers].sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.name.localeCompare(b.name))
  return (
    <Table head={[...(showServer ? ['Servidor'] : []), 'Servicio', 'Tipo', 'Dominios', 'Estado', 'Proyecto']}>
      {sorted.map((c) => {
        const [tone, text] = STATE[c.state as keyof typeof STATE] ?? ['muted', c.state]
        const role = c.role ?? roleOf(c.image, c.name)
        const linked = c.projectService
        return (
          <tr key={c.id} className="align-top">
            {showServer && c.server && <td><Link href={`/servidores/${c.server.id}`} className="font-medium text-accent-strong hover:underline">{c.server.name}</Link></td>}
            <td>
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-muted">{c.image ?? (c.kind === 'swarm' ? 'Swarm' : 'contenedor')}{c.version && <span className="ml-2 font-medium text-ink">v{c.version.replace(/^v/, '')}</span>}</div>
            </td>
            <td><Pill tone={role === 'app' ? 'accent' : 'muted'}>{ROLE_LABEL[role] ?? role}</Pill></td>
            <td className="max-w-72">
              {c.domains.length ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {c.domains.map((d) => <li key={d}><a href={`https://${d}`} target="_blank" rel="noreferrer" className="break-all text-accent-strong hover:underline">{d}</a></li>)}
                </ul>
              ) : <span className="text-sm text-muted">—</span>}
            </td>
            <td className="whitespace-nowrap"><Pill tone={tone}>{text}</Pill><div className="num mt-1 text-sm text-muted">{c.kind === 'swarm' ? c.detail : c.desired != null ? `${c.running}/${c.desired}` : ''}</div></td>
            <td className="min-w-72">
              <InlineField action={linkContainerAction} fields={{ id: c.id }} name="target" label={`Proyecto de ${c.name}`} hideLabel kind="combobox" allowCustom={false} options={options}
                value={c.matchManual && c.projectServiceId ? `svc:${c.projectServiceId}` : ''}
                display={linked
                  ? <><Link href={`/proyectos/${linked.project.id}`} className="font-medium text-accent-strong hover:underline">{linked.project.name}</Link><span className="text-muted"> · {linked.name}</span>{!c.matchManual && <span className="ml-2 text-sm text-muted">reconocido</span>}</>
                  : <span className="text-muted">Sin proyecto</span>}
                placeholder="Busca un proyecto…" success="Enlazado" />
            </td>
          </tr>
        )
      })}
    </Table>
  )
}
