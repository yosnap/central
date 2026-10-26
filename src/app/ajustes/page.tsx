import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { addApiConnection, addChannel, deleteChannel, deleteConnection, linkChannel, removeScanRoot, saveSn4p, scanNow, syncAll, syncOne, testSn4p, unlinkChannel } from '@/lib/settings-actions'
import { MAC_TASKS, macTaskInstalled } from '@/lib/mac-tasks'
import { AddRootForm } from '@/components/settings/add-root-form'
import { ReposCard } from '@/components/settings/repos-card'
import { KumaCard } from '@/components/settings/kuma-card'
import { BrandCard } from '@/components/settings/brand-card'
import { GoogleCard } from '@/components/settings/google-card'
import { WorkerCard } from '@/components/settings/worker-card'
import { isRemote } from '@/lib/worker'
import { RatesCard } from '@/components/settings/rates-card'
import fs from 'node:fs'
import { FolderSearch, RefreshCw } from 'lucide-react'
import { ActionForm, Card, Combobox, ConfirmAction, Empty, Field, Input, Notice, PageTitle, Pill, Select, SubmitButton, Table, toOptions } from '@/components/ui'
import { PURPOSE_LABEL, fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { google?: string; cuenta?: string; motivo?: string }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3099'}`
  const keyOk = Buffer.from(process.env.CENTRAL_ENCRYPTION_KEY ?? '', 'base64').length === 32
  const [roots, lastUptime, sn4p, connections, channels, projects] = await Promise.all([
    prisma.scanRoot.findMany({ orderBy: { path: 'asc' } }),
    prisma.website.aggregate({ _max: { lastCheckedAt: true } }),
    prisma.integrationConnection.findFirst({ where: { provider: 'SN4P' } }),
    prisma.integrationConnection.findMany({ where: { provider: { in: ['YOUTUBE', 'BUNNY'] } }, orderBy: { label: 'asc' } }),
    prisma.videoChannel.findMany({ orderBy: { name: 'asc' }, include: { connection: true, links: { include: { project: { select: { name: true } } } }, _count: { select: { videos: true } } } }),
    prisma.project.findMany({ where: { excluded: false, kind: { in: ['CLIENT', 'OWN'] }, status: { not: 'ARCHIVED' } }, select: { id: true, name: true, client: { select: { name: true } } }, orderBy: { name: 'asc' } }),
  ])
  const PROVIDERS = [{ value: 'YOUTUBE', label: 'YouTube' }, { value: 'BUNNY', label: 'Bunny Stream' }]
  const providerLabel = (p: string) => (p === 'YOUTUBE' ? 'YouTube' : 'Bunny Stream')
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name, hint: p.client?.name }))
  return (
    <>
      <PageTitle title="Ajustes" sub="Conexiones con otros servicios y canales de vídeo." />
      {!keyOk && (
        <Notice tone="bad" title="Falta la clave de cifrado" className="mb-6">
          Define <code className="font-mono">CENTRAL_ENCRYPTION_KEY</code> en <code className="font-mono">.env</code> (genera una con <code className="font-mono">openssl rand -base64 32</code>). Sin ella no se pueden guardar contraseñas ni claves.
        </Notice>
      )}
      <div className="flex flex-col gap-6">
        <Card
          title="Escaneo y tareas automáticas"
          note="El escaneo lee las carpetas de este Mac; por eso se lanza desde aquí o con una tarea del Mac, no desde el servidor."
          action={roots.some((r) => fs.existsSync(r.path)) && <ActionForm action={scanNow} success="Escaneo terminado"><SubmitButton pendingText="Escaneando… (unos 30 s)"><FolderSearch className="size-5" aria-hidden />Escanear ahora</SubmitButton></ActionForm>}
        >
          {roots.length === 0 ? <Empty title="Sin carpetas raíz">Escanea una carpeta con <code className="font-mono">bun run scan /ruta</code> y quedará guardada aquí.</Empty> : (
            <Table head={['Carpeta raíz', 'Proyectos', 'Último escaneo', '']}>
              {roots.map((r) => (
                <tr key={r.id}>
                  <td className="break-all font-mono text-sm">{r.path}{!isRemote() && !fs.existsSync(r.path) && <span className="ml-2"><Pill tone="warn">No está en este equipo</Pill></span>}</td>
                  <td className="num">{r.found ?? '—'}</td>
                  <td className="whitespace-nowrap text-muted">{fmtDateTime(r.lastScanAt)}</td>
                  <td className="text-right">
                    <ConfirmAction action={removeScanRoot} fields={{ id: r.id }} title="Dejar de escanear esta carpeta" description="Los proyectos ya importados se quedan en Central; si no los quieres, exclúyelos desde su ficha." confirmLabel="Quitar carpeta" success="Carpeta quitada">Quitar</ConfirmAction>
                  </td>
                </tr>
              ))}
            </Table>
          )}
          {isRemote() ? <p className="mt-4 text-sm text-muted">En producción las carpetas las elige el Mac (ver «Trabajador del Mac»).</p> : <AddRootForm />}
          {/* las tareas programadas del Mac solo existen con Central en el Mac; en producción corren en el servidor */}
          {!isRemote() && <>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {MAC_TASKS.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line px-5 py-4">
                <div>
                  <p className="font-semibold">{t.label}</p>
                  <p className="text-sm text-muted">Tarea del Mac, {t.every}{t.id.endsWith('uptime') && lastUptime._max.lastCheckedAt ? ` · última ${fmtDateTime(lastUptime._max.lastCheckedAt)}` : ''}</p>
                </div>
                {macTaskInstalled(t.id) ? <Pill tone="ok">Instalada</Pill> : <Pill tone="warn">Sin instalar</Pill>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Instálalas o quítalas con <code className="font-mono">bun run tareas:instalar</code> y <code className="font-mono">bun run tareas:quitar</code>. El registro queda en <code className="font-mono">~/Library/Logs/Central/</code>.</p>
          </>}
        </Card>

        {isRemote() && <WorkerCard />}

        <GoogleCard result={sp.google} account={sp.cuenta} reason={sp.motivo} origin={origin} />

        <BrandCard />

        <RatesCard />

        <KumaCard />

        <ReposCard />

        <Card title="Portfolio · sn4p.dev" note="Usuario administrador con el que Central publica proyectos en el portfolio. La contraseña se guarda cifrada.">
          <ActionForm action={saveSn4p} success="Conexión con sn4p.dev guardada" className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <Input name="baseUrl" aria-label="URL de sn4p.dev" defaultValue={sn4p?.baseUrl ?? 'https://sn4p.dev'} required />
            <Input name="username" aria-label="Usuario" placeholder="Usuario" defaultValue={sn4p?.account ?? ''} required />
            <Input name="password" type="password" aria-label="Contraseña" placeholder={sn4p?.secret ? 'Guardada (dejar vacío)' : 'Contraseña'} />
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
          {sn4p && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ActionForm action={testSn4p} success="Prueba terminada"><SubmitButton variant="secondary" pendingText="Probando…">Probar conexión</SubmitButton></ActionForm>
              {sn4p.lastError ? <Pill tone="bad">{sn4p.lastError}</Pill> : sn4p.lastOkAt ? <Pill tone="ok">Conectado · {fmtDateTime(sn4p.lastOkAt)}</Pill> : <Pill>Sin probar</Pill>}
            </div>
          )}
        </Card>

        <Card title="Claves de API de vídeo" note="Una clave de YouTube Data API (Google Cloud) o de Bunny Stream. Varios canales pueden usar la misma.">
          <ActionForm action={addApiConnection} success="Clave añadida" className="mb-5 grid gap-3 md:grid-cols-[minmax(11rem,1fr)_1.5fr_1.5fr_2fr_auto]">
            <Select name="provider" aria-label="Servicio" defaultValue="YOUTUBE" options={PROVIDERS} />
            <Input name="label" aria-label="Nombre" placeholder="Nombre (p. ej. YouTube CodeIA)" required />
            <Input name="account" aria-label="Cuenta" placeholder="Cuenta (opcional)" />
            <Input name="apiKey" type="password" aria-label="Clave de API" placeholder="Clave de API" required />
            <SubmitButton>Añadir</SubmitButton>
          </ActionForm>
          {connections.length > 0 && (
            <Table head={['Servicio', 'Nombre', 'Cuenta', '']}>
              {connections.map((c) => (
                <tr key={c.id}>
                  <td>{providerLabel(c.provider)}</td>
                  <td className="font-semibold">{c.label}</td>
                  <td className="text-muted">{c.account ?? '—'}</td>
                  <td className="text-right">
                    <ConfirmAction action={deleteConnection} fields={{ id: c.id }} title="Quitar esta clave de API" description={`Se borrará «${c.label}». Los canales que la usan dejarán de sincronizar.`} confirmLabel="Quitar clave" success="Clave quitada">Quitar</ConfirmAction>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card
          title="Canales de vídeo"
          note="Cada canal se conecta a uno o varios proyectos. Al sincronizar, sus vídeos aparecen en la ficha de esos proyectos. Con un filtro, solo los vídeos cuyo título lo contenga."
          action={channels.length > 0 && <ActionForm action={syncAll} success="Canales sincronizados"><SubmitButton variant="secondary" pendingText="Sincronizando…"><RefreshCw className="size-5" aria-hidden />Sincronizar todos</SubmitButton></ActionForm>}
        >
          <ActionForm action={addChannel} success="Canal añadido" className="mb-6 grid gap-3 md:grid-cols-[minmax(11rem,1fr)_1.5fr_1.5fr_1.5fr_auto]">
            <Select name="provider" aria-label="Servicio" defaultValue="YOUTUBE" options={PROVIDERS} />
            <Input name="name" aria-label="Nombre del canal" placeholder="Nombre (p. ej. CodeIA)" required />
            <Input name="externalId" aria-label="Id del canal o biblioteca" placeholder="Id del canal (UC…) o de la biblioteca" required />
            <Select name="connectionId" aria-label="Clave de API" placeholder="Clave de API…" options={connections.map((c) => ({ value: c.id, label: c.label, hint: providerLabel(c.provider) }))} />
            <SubmitButton>Añadir canal</SubmitButton>
          </ActionForm>
          {channels.length === 0 && <Empty title="Sin canales todavía">Añade un canal de YouTube o una biblioteca de Bunny Stream con el formulario de arriba.</Empty>}
          <div className="flex flex-col gap-5">
            {channels.map((ch) => (
              <section key={ch.id} className="rounded-2xl border border-line p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">{ch.name} <span className="text-base font-normal text-muted">· {providerLabel(ch.provider)} · {ch.externalId}</span></h3>
                    <p className="mt-1 text-base text-muted">{ch._count.videos} vídeos asignados · {ch.lastSyncAt ? `sincronizado ${fmtDateTime(ch.lastSyncAt)}` : 'sin sincronizar'} {ch.connection ? `· clave ${ch.connection.label}` : '· sin clave de API'}</p>
                    {ch.lastError && <p className="mt-1 text-base text-bad">{ch.lastError}</p>}
                  </div>
                  <div className="flex gap-2">
                    <ActionForm action={syncOne} success={`${ch.name} sincronizado`}><input type="hidden" name="id" value={ch.id} /><SubmitButton variant="secondary" size="sm" pendingText="Sincronizando…">Sincronizar</SubmitButton></ActionForm>
                    <ConfirmAction action={deleteChannel} fields={{ id: ch.id }} title="Quitar este canal" description={`Se borrará el canal «${ch.name}» y sus conexiones con proyectos.`} confirmLabel="Quitar canal" success="Canal quitado">Quitar canal</ConfirmAction>
                  </div>
                </div>
                {ch.links.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2">
                    {ch.links.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-ground px-4 py-2">
                        <span className="font-semibold">{l.project.name}</span>
                        <Pill>{PURPOSE_LABEL[l.purpose]}</Pill>
                        <span className="flex-1 text-base text-muted">{l.match ? `título contiene «${l.match}»` : 'todos los vídeos'}</span>
                        <ConfirmAction action={unlinkChannel} fields={{ id: l.id }} title="Desconectar el proyecto" description={`«${l.project.name}» dejará de recibir vídeos de ${ch.name}.`} confirmLabel="Desconectar" success="Proyecto desconectado">Desconectar</ConfirmAction>
                      </li>
                    ))}
                  </ul>
                )}
                <ActionForm action={linkChannel} success="Proyecto conectado" className="mt-4 grid gap-3 md:grid-cols-[2fr_1.5fr_minmax(11rem,1fr)_auto]">
                  <input type="hidden" name="channelId" value={ch.id} />
                  <Combobox name="projectId" aria-label="Proyecto" required placeholder="Conectar a un proyecto…" searchPlaceholder="Buscar proyecto…" options={projectOptions} />
                  <Input name="match" aria-label="Filtro por título" placeholder="Filtro en el título (opcional)" />
                  <Select name="purpose" aria-label="Propósito" defaultValue={Object.keys(PURPOSE_LABEL)[0]} options={toOptions(PURPOSE_LABEL)} />
                  <SubmitButton variant="secondary">Conectar</SubmitButton>
                </ActionForm>
              </section>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
