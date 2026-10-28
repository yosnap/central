import { prisma } from '@/lib/prisma'
import { setProjectEnvironments } from '@/lib/project-cleanup-actions'
import type { ComposeService, EnvFile } from '@/lib/local-env'
import { ActionForm, Card, Checkbox, SubmitButton, Tabs } from '@/components/ui'
import { LocalEnvTab } from './local-env-tab'
import { ServicesTab } from './services-tab'
import { envFromDomain } from '@/lib/servers/link'
import { ROLE_LABEL, roleOf } from '@/lib/servers/role'

const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')

const ENVS = [
  { value: 'development', label: 'Local' },
  { value: 'staging', label: 'Pruebas' },
  { value: 'production', label: 'Producción' },
] as const

/** Cómo se lanza el proyecto en cada entorno: Local (este Mac), Pruebas y Producción. */
export async function EnvironmentsCard({ projectId }: { projectId: string }) {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      name: true, slug: true, framework: true, stack: true, suggestedDomains: true, environments: true, envFiles: true, localCompose: true, composeProject: true, localUrl: true,
      locations: { where: { kind: 'MAIN', missing: false }, select: { path: true }, take: 1 },
      services: {
        orderBy: { position: 'asc' },
        select: {
          id: true, name: true, environment: true, url: true, liveVersion: true, monitor: true, versionPath: true, hosting: true, notes: true,
          website: { select: { lastStatus: true, kumaStatus: true, lastMs: true, sslDaysLeft: true } },
          server: { select: { id: true, name: true } },
          containers: { select: { name: true, state: true, image: true, role: true } },
        },
      },
    },
  })
  const secrets = await prisma.projectSecret.groupBy({ by: ['environment'], where: { projectId }, _count: true })
  const secretsByEnv = Object.fromEntries(secrets.map((s) => [s.environment, s._count]))
  const compose = (p.localCompose ?? []) as ComposeService[]
  const envFiles = (p.envFiles ?? []) as EnvFile[]
  // sin casillas marcadas, se deduce de lo que hay
  const inferred = ENVS.map((e) => e.value).filter((e) => e === 'development' ? p.locations.length > 0 : p.services.some((s) => s.environment === e))
  const active = p.environments.length ? p.environments : inferred

  // servicios Docker de tus servidores: los que no están en ningún proyecto primero; sugeridos, los que se llaman como este
  const [containers, servers] = await Promise.all([
    prisma.serverContainer.findMany({ select: { id: true, name: true, image: true, role: true, domains: true, projectServiceId: true, server: { select: { name: true } } }, orderBy: [{ server: { name: 'asc' } }, { name: 'asc' }] }),
    prisma.server.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const free = containers.filter((c) => !c.projectServiceId)
  const containerOptions = [...free, ...containers.filter((c) => c.projectServiceId)].map((c) => ({
    value: c.id, label: `${c.name} · ${c.server.name}`,
    hint: [ROLE_LABEL[c.role ?? roleOf(c.image, c.name)], c.domains[0], c.projectServiceId ? 'ya en otro proyecto' : ''].filter(Boolean).join(' · '),
  }))
  const keys = [norm(p.name), norm(p.slug.split('/').pop() ?? '')].filter((k) => k.length >= 4)
  // por el nombre o porque sirve un dominio que aparece en la configuración del proyecto
  const domains = new Set(p.suggestedDomains.map((d) => d.toLowerCase()))
  const suggested = free.filter((c) => keys.some((k) => norm(c.name).includes(k)) || c.domains.some((d) => domains.has(d)))
  const serverOptions = [{ value: '', label: 'Sin servidor' }, ...servers.map((x) => ({ value: x.id, label: x.name }))]

  const tabs = ENVS.map((e) => ({
    value: e.value,
    label: <>{e.label}{active.includes(e.value) && <span className="size-2 rounded-full bg-ok" aria-label="se lanza aquí" />}</>,
    content: (
      <div className="flex flex-col gap-4">
        {e.value === 'development'
          ? <LocalEnvTab projectId={projectId} path={p.locations[0]?.path ?? null} localUrl={p.localUrl} composeProject={p.composeProject} compose={compose} envFiles={envFiles} secretsByEnv={secretsByEnv} />
          : <ServicesTab projectId={projectId} environment={e.value} framework={[p.framework, ...p.stack]} services={p.services.filter((x) => x.environment === e.value)} servers={serverOptions} containerOptions={containerOptions}
              suggested={suggested.filter((c) => envFromDomain(c.domains[0]) === e.value)} />}
        {e.value !== 'development' && secretsByEnv[e.value] ? <p className="text-sm text-muted">{secretsByEnv[e.value]} variables guardadas para {e.label.toLowerCase()} (en «Secretos»).</p> : null}
      </div>
    ),
  }))

  return (
    <Card title="Entornos" className="xl:col-span-3" note="Dónde se lanza el proyecto: en este Mac, en pruebas y en producción. Marca los entornos que usa; si no marcas ninguno, se deducen de sus carpetas y servicios.">
      <ActionForm action={setProjectEnvironments} success="Entornos guardados" className="mb-5 flex flex-wrap items-center gap-5">
        <input type="hidden" name="id" value={projectId} />
        {ENVS.map((e) => <Checkbox key={e.value} name="environments" value={e.value} defaultChecked={active.includes(e.value)} label={e.label} />)}
        <SubmitButton variant="secondary" size="sm">Guardar</SubmitButton>
      </ActionForm>
      <Tabs tabs={tabs} defaultValue={active.includes('production') ? 'production' : active[0]} />
    </Card>
  )
}
