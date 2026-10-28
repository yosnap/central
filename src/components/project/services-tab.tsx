import Link from 'next/link'
import { Box, Plus, Sparkles, Trash2 } from 'lucide-react'
import { addFromContainerAction, addServiceAction, deleteServiceAction, reorderServicesAction, updateServiceField } from '@/lib/service-actions'
import { ROLE_LABEL, roleOf } from '@/lib/servers/role'
import { PLATFORMS, frameworkOf, techOf } from '@/lib/brands'
import { BrandLogo } from '@/components/brand-logo'
import { SortableList } from './sortable-list'
import { ActionForm, ConfirmAction, Field, InlineField, Input, Pill, SubmitButton, type Option } from '@/components/ui'
import { MonitorToggle } from './monitor-toggle'

export type TabService = {
  id: string; name: string; url: string | null; monitor: boolean; versionPath: string | null; hosting: string | null; notes: string | null; liveVersion: string | null
  website: { lastStatus: string | null; kumaStatus: string | null; lastMs: number | null; sslDaysLeft: number | null } | null
  server: { id: string; name: string } | null
  containers: { name: string; state: string; image: string | null; role: string | null }[]
}
export type Loose = { id: string; name: string; image: string | null; role: string | null; domains: string[]; server: { name: string } }

const SERVICE_NAMES = ['web', 'api', 'admin', 'tienda', 'n8n', 'base de datos', 'caché', 'almacenamiento', 'correo'].map((v) => ({ value: v, label: v }))

/** Pestaña de Pruebas o Producción: los servicios del entorno, editables uno a uno, y cómo añadir más. */
export function ServicesTab({ projectId, environment, framework, services, servers, containerOptions, suggested }: {
  projectId: string; environment: 'staging' | 'production'; framework: (string | null)[]; services: TabService[]; servers: Option[]; containerOptions: Option[]; suggested: Loose[]
}) {
  // la aplicación (o un servicio sin contenedor) lleva el framework del proyecto si su imagen no dice nada
  const appBrand = frameworkOf(...framework)
  const edit = (id: string, field: string) => ({ action: updateServiceField, fields: { id, field } })
  return (
    <div className="flex flex-col gap-6">
      {services.length === 0 && <p className="text-muted">Aún no hay servicios en este entorno. Añádelos desde tus servidores (abajo) o a mano.</p>}
      <SortableList onReorder={reorderServicesAction} items={services.map((s) => {
        const status = s.website?.kumaStatus ?? s.website?.lastStatus
        const c = s.containers[0]
        const role = c ? ROLE_LABEL[c.role ?? roleOf(c.image, c.name)] : null
        const isApp = !c || ['app', 'other'].includes(c.role ?? roleOf(c.image, c.name))
        const tech = (c ? techOf(c.image, c.name) : null) ?? (isApp ? appBrand : null)
        return { id: s.id, label: s.name, node: (
          <article className="rounded-2xl border border-line p-5">
            <header className="mb-3 flex flex-wrap items-center gap-3">
              {tech ? <BrandLogo brand={tech} className="size-6" /> : <Box className="size-6 shrink-0 text-muted" aria-hidden />}
              <InlineField {...edit(s.id, 'name')} label="Nombre del servicio" hideLabel kind="combobox" options={SERVICE_NAMES} value={s.name} display={<span className="text-lg font-semibold">{s.name}</span>} />
              {(role || tech) && <Pill tone="accent">{[role, tech?.label].filter(Boolean).join(' · ')}</Pill>}
              {status && <Pill tone={status === 'up' ? 'ok' : 'bad'}>{status === 'up' ? 'En línea' : 'Caída'}{s.website?.lastMs != null ? ` · ${s.website.lastMs} ms` : ''}</Pill>}
              {s.liveVersion && <Pill>v{s.liveVersion.replace(/^v/, '')}</Pill>}
              <div className="ml-auto flex items-center gap-4">
                <MonitorToggle id={s.id} checked={s.monitor} />
                <ConfirmAction action={deleteServiceAction} fields={{ id: s.id }} title={`Quitar ${s.name}`} confirmLabel="Quitar"
                  description="Se quita del proyecto. Su web deja de estar ligada y el contenedor queda sin proyecto; en el servidor no se toca nada.">
                  <Trash2 className="size-4" aria-hidden />Quitar
                </ConfirmAction>
              </div>
            </header>
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              <InlineField {...edit(s.id, 'url')} label="Dominio" value={s.url ?? ''} placeholder="dominio.com"
                display={s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="break-all text-accent-strong hover:underline">{s.url.replace(/^https?:\/\//, '')}</a> : undefined}
                hint={s.website?.sslDaysLeft != null ? `SSL: ${s.website.sslDaysLeft} días` : undefined} />
              <InlineField {...edit(s.id, 'serverId')} label="Servidor" kind="select" options={servers} value={s.server?.id ?? ''} placeholder="Sin servidor"
                display={s.server ? <Link href={`/servidores/${s.server.id}`} className="text-accent-strong hover:underline">{s.server.name}</Link> : undefined}
                hint={s.containers.length ? `Contenedor: ${s.containers.map((x) => x.name).join(', ')}` : s.server ? 'Sin contenedor reconocido: enlázalo desde la ficha del servidor' : undefined} />
              <InlineField {...edit(s.id, 'hosting')} label="Hosting (si no es un servidor tuyo)" kind="combobox" options={PLATFORMS.map((x) => ({ value: x.label, label: x.label }))} value={s.hosting ?? ''} placeholder="El del proyecto" />
              <InlineField {...edit(s.id, 'versionPath')} label="Ruta de versión" value={s.versionPath ?? ''} placeholder="Se busca sola" />
              <InlineField {...edit(s.id, 'notes')} label="Notas" value={s.notes ?? ''} placeholder="—" className="xl:col-span-2" />
            </div>
          </article>
        ) }
      })} />

      {suggested.length > 0 && (
        <section className="rounded-2xl border border-accent/30 bg-accent-soft p-5">
          <h3 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5" aria-hidden />Sugeridos de tus servidores</h3>
          <p className="mb-3 text-sm text-muted">Servicios Docker que se llaman como el proyecto o sirven uno de sus dominios, y que aún no están en ningún proyecto.</p>
          <ul className="flex flex-col gap-2">
            {suggested.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3">
                <BrandLogo brand={techOf(c.image, c.name)} />
                <span className="font-medium">{c.name}</span>
                <Pill>{[ROLE_LABEL[c.role ?? roleOf(c.image, c.name)], techOf(c.image, c.name)?.label].filter(Boolean).join(' · ')}</Pill>
                <span className="text-sm text-muted">{[c.domains[0], c.server.name].filter(Boolean).join(' · ')}</span>
                <ActionForm action={addFromContainerAction} success={`${c.name} añadido`}>
                  <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="containerId" value={c.id} /><input type="hidden" name="environment" value={environment} />
                  <SubmitButton size="sm" variant="secondary" pendingText="Añadiendo…"><Plus className="size-4" aria-hidden />Añadir</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="mb-2 font-semibold">Añadir desde un servidor</h3>
          <InlineField action={addFromContainerAction} fields={{ projectId, environment }} name="containerId" label="Servicio Docker" hideLabel kind="combobox" allowCustom={false}
            options={containerOptions} value="" display={<span className="text-muted">Buscar la web, su base de datos, su almacenamiento…</span>} placeholder="Busca un servicio Docker…" success="Servicio añadido" />
        </section>
        <section>
          <h3 className="mb-2 font-semibold">Añadir a mano</h3>
          <ActionForm action={addServiceAction} success="Servicio añadido" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="environment" value={environment} />
            <Field label="Nombre" htmlFor={`new-name-${environment}`} className="w-36"><Input id={`new-name-${environment}`} name="name" placeholder="web" required /></Field>
            <Field label="Dominio" htmlFor={`new-url-${environment}`} className="min-w-48 flex-1"><Input id={`new-url-${environment}`} name="url" placeholder="dominio.com" /></Field>
            <SubmitButton variant="secondary"><Plus className="size-4" aria-hidden />Añadir</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  )
}
