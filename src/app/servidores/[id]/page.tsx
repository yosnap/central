import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { deleteServer, readServerNow, updateServerField } from '@/lib/server-actions'
import { visibleStatus } from '@/lib/servers/collect'
import { linkOptions } from '@/lib/servers/link'
import { ROOT_SCRIPT_VERSION } from '@/lib/servers/parse'
import type { Snapshot } from '@/lib/servers/snapshot'
import { ConnectionNotice } from '@/components/servers/connection-notice'
import { InstallButton } from '@/components/servers/install-button'
import { DeploymentsCard } from '@/components/deployments-card'
import { ContainersCard } from '@/components/servers/containers-card'
import { ProtectionCard } from '@/components/servers/protection-card'
import { ServerCards } from '@/components/servers/server-cards'
import { ServerDetails } from '@/components/servers/server-details'
import { ActionForm, ButtonLink, Card, ConfirmAction, InlineField, Notice, PageTitle, Pill, SubmitButton, TITLE, Table } from '@/components/ui'
import { LEVEL_LABEL, LEVEL_TONE, ago, fmtDateTime } from '@/lib/format'
import { Brand, BrandLogo } from '@/components/brand-logo'

export const dynamic = 'force-dynamic'

export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const s = await prisma.server.findUnique({
    where: { id },
    include: {
      checks: true,
      containers: { orderBy: [{ state: 'asc' }, { name: 'asc' }], include: { projectService: { select: { name: true, project: { select: { id: true, name: true } } } } } },
      attackIps: { orderBy: { attempts: 'desc' }, take: 10 },
      services: { include: { project: { select: { id: true, name: true } }, website: { select: { lastStatus: true, kumaStatus: true } }, containers: { select: { name: true, state: true } } }, orderBy: { project: { name: 'asc' } } },
    },
  })
  if (!s) notFound()
  const options = await linkOptions()
  const snap = s.snapshot as Snapshot | null
  const level = visibleStatus(s)
  return (
    <>
      <PageTitle
        back={{ href: '/servidores', label: 'Volver a servidores' }}
        title={<InlineField action={updateServerField} fields={{ id: s.id, field: 'name' }} label="Nombre del servidor" hideLabel value={s.name} display={<h1 className={TITLE}>{s.name}</h1>} success="Nombre cambiado" />}
        sub={<>
          <Pill tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Pill>
          <Brand name={s.provider} /><Brand name={s.panel} />
          <span>{s.host}{s.sshPort === 22 ? '' : `:${s.sshPort}`}</span>
          <span>· leído {ago(s.lastOkAt)}{snap?.version != null && ` · script v${snap.version}${snap.root ? '' : ', sin root'}`}</span>
        </>}
        action={<div className="flex flex-wrap gap-2">
          {s.panelUrl && <ButtonLink href={s.panelUrl} target="_blank" rel="noreferrer" variant="ghost">{s.panel ? <BrandLogo name={s.panel} /> : <ExternalLink className="size-5" aria-hidden />}Abrir panel</ButtonLink>}
          <ActionForm action={readServerNow} success="Servidor leído"><input type="hidden" name="id" value={s.id} /><SubmitButton variant="secondary" pendingText="Leyendo…"><RefreshCw className="size-5" aria-hidden />Leer ahora</SubmitButton></ActionForm>
          <ConfirmAction action={deleteServer} fields={{ id: s.id }} title={`Eliminar ${s.name}`} size="md" confirmLabel="Eliminar"
            description="Se borran de Central su historial y sus comprobaciones, y los servicios de proyecto quedan sin servidor. No se toca nada en el servidor: infobar sigue instalado y puedes volver a darlo de alta.">
            <Trash2 className="size-5" aria-hidden />Eliminar servidor
          </ConfirmAction>
        </div>}
      />
      <ConnectionNotice server={s} />
      {snap && !s.error && (snap.rootVersion ?? 0) < ROOT_SCRIPT_VERSION && (
        <Notice tone="info" title="Hay una versión nueva del script de lectura" className="mb-6" action={<InstallButton id={s.id} host={s.host} user={s.adminUser} label="Actualizar" variant="primary" />}>
          Con ella Central ve la imagen y los dominios de cada servicio Docker, y así reconoce mejor a qué proyecto pertenece.
        </Notice>
      )}
      {snap ? <ServerCards snap={snap} /> : <Card title="Sin lectura todavía"><p className="text-muted">Central aún no ha podido leer este servidor.</p></Card>}
      <div className="mt-6">
        <ContainersCard containers={s.containers} options={options} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Proyectos que aloja" note="Se asignan en la ficha de cada proyecto, o solos si el proxy del servidor sirve su dominio.">
          {s.services.length === 0 ? <p className="text-muted">Ningún servicio de proyecto asignado a este servidor.</p> : (
            <Table head={['Proyecto', 'Servicio', 'Contenedor', 'Web']}>
              {s.services.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/proyectos/${p.project.id}`} className="font-medium hover:underline">{p.project.name}</Link></td>
                  <td className="text-muted">{p.name} · {p.environment}</td>
                  <td>{p.containers.length ? p.containers.map((c) => <Pill key={c.name} tone={c.state === 'ok' ? 'ok' : c.state === 'down' ? 'bad' : 'warn'}>{c.name}</Pill>) : <span className="text-muted">—</span>}</td>
                  <td>{(p.website?.kumaStatus ?? p.website?.lastStatus) ? <Pill tone={(p.website?.kumaStatus ?? p.website?.lastStatus) === 'up' ? 'ok' : 'bad'}>{(p.website?.kumaStatus ?? p.website?.lastStatus) === 'up' ? 'En línea' : 'Caída'}</Pill> : '—'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <ProtectionCard checks={s.checks} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Dominios que sirve el proxy" note="Traefik de Easypanel, Dokploy o Coolify.">
          {snap?.domains?.length ? <p className="flex flex-wrap gap-2">{snap.domains.map((d) => <Pill key={d}>{d}</Pill>)}</p> : <p className="text-muted">Sin datos.</p>}
        </Card>
        <Card title="IPs con más intentos de acceso" note="Últimas 24 horas, solo si el origen es fiable.">
          {s.attackIps.length === 0 ? <p className="text-muted">Sin datos.</p> : (
            <Table head={['IP', 'Intentos', 'Última vez']}>
              {s.attackIps.map((x) => <tr key={x.id}><td className="num">{x.ip}</td><td className="num">{x.attempts}</td><td className="text-muted">{fmtDateTime(x.lastAt)}</td></tr>)}
            </Table>
          )}
        </Card>
      </div>
      <div className="mt-6">
        <DeploymentsCard serverId={s.id} className="mb-6" />
        <ServerDetails server={s} action={<InstallButton id={s.id} host={s.host} user={s.adminUser} />} />
      </div>
    </>
  )
}
