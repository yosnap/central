import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { acceptSuggestion, addNote, addVideo, excludeProject, includeProject, markReviewed, removeVideo, saveClassification, saveDeployment, saveRepo } from '@/lib/project-actions'
import { SecretsSection } from '@/components/secrets/secrets-section'
import { LocationsCard } from '@/components/project/locations-card'
import { RepoCard } from '@/components/project/repo-card'
import { SuggestedDomains } from '@/components/project/suggested-domains'
import { InheritedServicesCard, PartsCard } from '@/components/project/system-cards'
import { InstallationsCard } from '@/components/project/installations-card'
import { DEPLOY_LABEL, projectIssues } from '@/lib/completeness'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { DeploymentsCard } from '@/components/deployments-card'
import { VersionsStrip } from '@/components/project/versions-strip'
import { EnvironmentsCard } from '@/components/project/environments-card'
import { PLATFORMS, brandOf } from '@/lib/brands'
import { ActionForm, ButtonLink, Card, Combobox, ConfirmAction, Empty, Field, Input, Notice, PageTitle, Pill, Select, SubmitButton, Switch, Textarea, statusTone, toOptions } from '@/components/ui'
import { KIND_LABEL, PLATFORM_LABEL, PURPOSE_LABEL, STATUS_LABEL, TYPE_LABEL, ago, fmtDate, fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

const PHASES = ['Propuesta', 'Desarrollo', 'Entrega', 'Soporte', 'Pausado']

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const clientsP = prisma.client.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
  const systemsP = prisma.project.findMany({ where: { excluded: false, id: { not: id }, type: { notIn: ['ADDON', 'PLUGIN'] } }, select: { id: true, name: true, client: { select: { name: true } } }, orderBy: { name: 'asc' } })
  const serversP = prisma.server.findMany({ select: { id: true, name: true, provider: true, panel: true }, orderBy: { name: 'asc' } })
  const websitesP = prisma.website.findMany({ select: { id: true, url: true, label: true }, orderBy: { url: 'asc' } })
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true, locations: { orderBy: [{ kind: 'asc' }, { missing: 'asc' }, { path: 'asc' }] }, notes: { orderBy: { createdAt: 'desc' } },
      services: { orderBy: [{ environment: 'asc' }, { position: 'asc' }], include: { website: true, containers: { select: { name: true, state: true, detail: true } } } },
      videos: { orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], include: { channel: { select: { name: true, provider: true } } } },
      videoChannels: { include: { channel: { select: { name: true, provider: true } } } },
      _count: { select: { services: true } },
      parent: { select: { id: true, name: true, services: { orderBy: [{ environment: 'asc' }, { position: 'asc' }], select: { id: true, name: true, environment: true, url: true, website: { select: { lastStatus: true } } } } } },
      parts: { where: { excluded: false }, select: { id: true, name: true, type: true, status: true, version: true }, orderBy: { name: 'asc' } },
      remotes: { orderBy: { name: 'asc' } },
      installations: { include: { website: { select: { id: true, url: true, label: true, lastStatus: true } } }, orderBy: { installedAt: 'desc' } },
    },
  })
  if (!p) notFound()
  const issues = projectIssues(p)
  const [clients, systems, websites, servers] = await Promise.all([clientsP, systemsP, websitesP, serversP])
  // tus servidores primero; después las plataformas; y cualquier otro se escribe a mano
  const hostingOptions = [
    ...servers.map((x) => ({ value: x.name, label: x.name, hint: ['tu servidor', brandOf(x.panel)?.label, brandOf(x.provider)?.label].filter(Boolean).join(' · ') })),
    ...PLATFORMS.map((x) => ({ value: x.label, label: x.label })),
  ]
  const hostingServer = servers.find((x) => x.name === p.hosting)
  // código: la rama de integración (develop, si no main); aparte, lo que tiene sacado la carpeta
  const branches = Object.entries((p.branchVersions ?? {}) as Record<string, string>).filter(([b]) => !b.startsWith('origin/'))
  const mainBranch = branches.find(([b]) => b === 'develop') ?? branches[0]
  const codeVersionHint = 'Se rellena sola con la versión que publica la web de producción (o su contenedor); escríbela solo si no la publica.'
  return (
    <>
      <PageTitle
        title={p.name}
        sub={<><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status]}</Pill><Pill tone={p.deployStatus === 'PRODUCTION' ? 'ok' : p.deployStatus === 'UNKNOWN' ? 'warn' : 'muted'}>{DEPLOY_LABEL[p.deployStatus]}</Pill>{p.type && <Pill tone="accent">{TYPE_LABEL[p.type]}{p.platform ? ` · ${PLATFORM_LABEL[p.platform]}` : ''}</Pill>}{p.client && <Link href={`/clientes/${p.client.id}`} className="ml-1 font-semibold text-accent-strong hover:underline">{p.client.name}</Link>}<span className="ml-1">{[p.client ? null : KIND_LABEL[p.kind], p.version && `v${p.version}`, p.framework ?? (p.stack.join(', ') || null)].filter(Boolean).join(' · ')}</span>{p.parent && <span>· de <Link href={`/proyectos/${p.parent.id}`} className="font-semibold text-accent-strong hover:underline">{p.parent.name}</Link></span>}</>}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {!p.excluded && (
              <ConfirmAction action={excludeProject} fields={{ id: p.id }} variant="ghost" size="md" title="Excluir de Central" description="Deja de contar en listados, resumen, pendientes, clientes y en el MCP. El escáner lo seguirá viendo pero no lo volverá a meter. Puedes recuperarlo desde Proyectos › Excluidos." confirmLabel="Excluir" success="Proyecto excluido">Excluir de Central</ConfirmAction>
            )}
            <ButtonLink href="/proyectos" variant="ghost"><ArrowLeft className="size-5" aria-hidden />Proyectos</ButtonLink>
          </div>
        }
      />

      {p.goneAt && (
        <Notice tone="warn" title="Este proyecto ya no tiene carpeta en el disco" className="mb-6" action={<ButtonLink href="/pendientes" variant="secondary">Resolver en Pendientes</ButtonLink>}>
          Desde el {fmtDate(p.goneAt)} el escáner no encuentra ninguna de sus carpetas. Si lo renombraste, únelo al proyecto nuevo; si lo borraste, elimínalo de Central.
        </Notice>
      )}
      {p.excluded && (
        <Notice
          tone="info"
          title="Proyecto excluido de Central"
          className="mb-6"
          action={<ActionForm action={includeProject} success="Proyecto incluido de nuevo"><input type="hidden" name="id" value={p.id} /><SubmitButton variant="secondary">Volver a incluir</SubmitButton></ActionForm>}
        >
          No cuenta en listados, resumen, pendientes ni en el MCP{p.excludedAt ? ` desde el ${fmtDate(p.excludedAt)}` : ''}.
        </Notice>
      )}

      {!p.type && p.suggestedType && (
        <Notice
          tone="info"
          title={`El escáner propone: ${TYPE_LABEL[p.suggestedType]}${p.suggestedPlatform ? ` · ${PLATFORM_LABEL[p.suggestedPlatform]}` : ''}`}
          className="mb-6"
          action={<ActionForm action={acceptSuggestion} success="Tipo aceptado"><input type="hidden" name="id" value={p.id} /><SubmitButton>Aceptar</SubmitButton></ActionForm>}
        >
          Si no es correcto, elige el tipo en «Clasificación».
        </Notice>
      )}

      {!p.excluded && issues.length > 0 && (
        <Notice
          tone="warn"
          title="Falta información en este proyecto"
          className="mb-6"
          action={!p.reviewedAt && <ActionForm action={markReviewed} success="Marcado como revisado"><input type="hidden" name="id" value={p.id} /><SubmitButton variant="secondary">Marcar como revisado</SubmitButton></ActionForm>}
        >
          <ul id="pendiente" className="list-disc pl-5">{issues.map((i) => <li key={i.key}>{i.label}</li>)}</ul>
        </Notice>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {p.type === 'ADDON' ? (
          <InheritedServicesCard parent={p.parent} />
        ) : p.type === 'PLUGIN' ? (
          <InstallationsCard projectId={p.id} version={p.version} installations={p.installations} websites={websites} />
        ) : (
        <Card title="Despliegue" note="Estado, hosting y versión en producción. La versión se rellena sola desde el servicio de producción." className="xl:col-span-3">
          {/* Fuera del formulario de despliegue: cada dominio es su propio formulario */}
          <div className="mb-6 empty:hidden"><SuggestedDomains projectId={p.id} domains={p.suggestedDomains} existingUrls={p.services.map((s) => s.url ?? '')} /></div>
          <ActionForm action={saveDeployment} success="Despliegue guardado" className="flex flex-col gap-6">
            <input type="hidden" name="id" value={p.id} />
            <div className="grid gap-5 md:grid-cols-3">
              <Field label="Estado de despliegue" htmlFor="deployStatus">
                <Select id="deployStatus" name="deployStatus" defaultValue={p.deployStatus} options={toOptions(DEPLOY_LABEL)} />
              </Field>
              <Field label={<span className="inline-flex items-center gap-2">Hosting {p.hosting && <BrandLogo name={hostingServer ? hostingServer.panel ?? hostingServer.provider : p.hosting} />}</span>} htmlFor="hosting"
                hint={hostingServer ? <>En tu servidor <Link href={`/servidores/${hostingServer.id}`} className="text-accent-strong hover:underline">{hostingServer.name}</Link>.</> : 'Uno de tus servidores, una plataforma o escribe otro.'}>
                <Combobox id="hosting" name="hosting" defaultValue={p.hosting ?? ''} placeholder="Elige o escribe…" allowCustom options={hostingOptions} />
              </Field>
              <Field label="Versión en producción" htmlFor="deployedVersion" hint={codeVersionHint}>
                <Input id="deployedVersion" name="deployedVersion" defaultValue={p.deployedVersion ?? ''} placeholder={p.version ?? '1.0.0'} />
              </Field>
            </div>
            <VersionsStrip
              local={{ version: p.localVersion ?? p.version, branch: p.defaultBranch }}
              code={{ version: p.version, branch: mainBranch?.[0] ?? null }}
              staging={p.services.find((x) => x.environment === 'staging' && x.liveVersion)?.liveVersion ?? null}
              production={p.deployedVersion} />

            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-base text-muted">Los servicios de cada entorno (web, base de datos, almacenamiento…) están en «Entornos», justo debajo.</p>
              <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
            </div>
          </ActionForm>
        </Card>
        )}

        <EnvironmentsCard projectId={p.id} />

        <DeploymentsCard projectId={p.id} className="xl:col-span-3" />

        <PartsCard parts={p.parts} />

        <RepoCard p={p} remotes={p.remotes} />

        <Card title="Clasificación" note="Si fijas el estado, el escáner no lo cambiará.">
          <ActionForm action={saveClassification} success="Clasificación guardada" className="flex flex-col gap-5">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Qué es" htmlFor="type"><Select id="type" name="type" defaultValue={p.type ?? ''} placeholder="Sin indicar" options={[{ value: '', label: 'Sin indicar' }, ...toOptions(TYPE_LABEL)]} /></Field>
            <Field label="Plataforma" htmlFor="platform" hint="Para plugins, temas y extensiones."><Select id="platform" name="platform" defaultValue={p.platform ?? ''} options={[{ value: '', label: 'Ninguna' }, ...toOptions(PLATFORM_LABEL)]} /></Field>
            <Field label="Sistema al que pertenece" htmlFor="parentId" hint="Para addons y módulos de otro proyecto."><Combobox id="parentId" name="parentId" defaultValue={p.parentId ?? ''} placeholder="Ninguno" searchPlaceholder="Buscar proyecto…" options={systems.map((x) => ({ value: x.id, label: x.name, hint: x.client?.name }))} /></Field>
            <Field label="Para quién" htmlFor="kind"><Select id="kind" name="kind" defaultValue={p.kind} options={toOptions(KIND_LABEL)} /></Field>
            <Field label="Estado de actividad" htmlFor="status"><Select id="status" name="status" defaultValue={p.status} options={toOptions(STATUS_LABEL)} /></Field>
            <Switch name="statusLocked" defaultChecked={p.statusLocked} label="Fijar estado" description="El escáner respetará el estado elegido." />
            <Field label="Fase" htmlFor="phase"><Combobox id="phase" name="phase" defaultValue={p.phase ?? ''} placeholder="Desarrollo, Entrega, Soporte…" allowCustom options={PHASES} /></Field>
            <Field label="Cliente" htmlFor="client"><Combobox id="client" name="client" defaultValue={p.client?.name ?? ''} placeholder="Sin cliente" allowCustom options={clients.map((c) => c.name)} /></Field>
            <Field label="Descripción" htmlFor="description"><Textarea id="description" name="description" defaultValue={p.description ?? ''} /></Field>
            <SubmitButton className="self-start" pendingText="Guardando…">Guardar</SubmitButton>
          </ActionForm>
        </Card>

        <SecretsSection projectId={p.id} slug={p.slug} />

        <Card title="Vídeos" note="Demostración, venta, marketing y tutoriales. Los canales se gestionan en Ajustes; aquí también puedes añadir un enlace suelto." className="xl:col-span-3">
          {p.videoChannels.length > 0 && (
            <p className="mb-4 text-base text-muted">Canales conectados: {p.videoChannels.map((l) => `${l.channel.name} (${l.channel.provider === 'YOUTUBE' ? 'YouTube' : 'Bunny'}${l.match ? `, «${l.match}»` : ''})`).join(' · ')} · <Link href="/ajustes" className="text-accent-strong hover:underline">gestionar</Link></p>
          )}
          {p.videos.length === 0 ? (
            <Empty title="Sin vídeos todavía">Conecta un canal en <Link href="/ajustes" className="text-accent-strong hover:underline">Ajustes</Link> o añade un enlace abajo.</Empty>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {p.videos.map((v) => (
                <article key={v.id} className="min-w-0 overflow-hidden rounded-2xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="aspect-video w-full object-cover" />}
                  <div className="flex flex-col gap-2 p-4">
                    <a href={v.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-base font-semibold hover:underline">{v.title}</a>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted"><Pill>{PURPOSE_LABEL[v.purpose]}</Pill>{v.channel ? v.channel.name : 'Enlace'}{v.publishedAt ? ` · ${fmtDate(v.publishedAt)}` : ''}</p>
                    <div><ConfirmAction action={removeVideo} fields={{ videoId: v.id }} title="Quitar este vídeo" description={`«${v.title}» dejará de aparecer en el proyecto.`} confirmLabel="Quitar vídeo" success="Vídeo quitado">Quitar</ConfirmAction></div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <ActionForm action={addVideo} success="Vídeo añadido" className="mt-6 grid gap-3 md:grid-cols-[2fr_2fr_minmax(11rem,1fr)_auto]">
            <input type="hidden" name="id" value={p.id} />
            <Input name="title" aria-label="Título del vídeo" placeholder="Título" required />
            <Input name="url" type="url" aria-label="URL del vídeo" placeholder="https://…" required />
            <Select name="purpose" aria-label="Propósito" defaultValue={Object.keys(PURPOSE_LABEL)[0]} options={toOptions(PURPOSE_LABEL)} />
            <SubmitButton variant="secondary">Añadir vídeo</SubmitButton>
          </ActionForm>
        </Card>

        <LocationsCard locations={p.locations} />

        <Card title="Notas" className="xl:col-span-3">
          <ActionForm action={addNote} success="Nota añadida" className="mb-5 flex flex-col gap-3">
            <input type="hidden" name="id" value={p.id} />
            <Textarea name="body" rows={3} aria-label="Nueva nota" placeholder="Nota sobre el proyecto…" required />
            <SubmitButton variant="secondary" className="self-start">Añadir nota</SubmitButton>
          </ActionForm>
          <ul className="flex flex-col gap-3 text-base">
            {p.notes.map((n) => <li key={n.id} className="border-t border-line pt-3"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-sm text-muted">{ago(n.createdAt)} · {n.source}</p></li>)}
          </ul>
        </Card>
      </div>
    </>
  )
}
