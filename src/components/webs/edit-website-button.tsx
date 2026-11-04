'use client'

import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { deleteWebsite, updateWebsite } from '@/lib/website-actions'
import { ActionForm, Button, Combobox, ConfirmAction, Field, Input, Modal, ModalClose, Select, SubmitButton, Switch, toOptions } from '@/components/ui'
import { WEB_KIND_LABEL } from '@/lib/format'

type Site = { id: string; url: string; label: string | null; kind: keyof typeof WEB_KIND_LABEL; monitored: boolean; clientName: string | null; projectId: string | null }

/** Editar o borrar una web suelta desde la lista de Webs. */
export function EditWebsiteButton({ site, clients, projects }: { site: Site; clients: string[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const f = (k: string) => `ew-${site.id}-${k}`
  return (
    <Modal open={open} onOpenChange={setOpen} title="Editar web" description="Nombre, dirección, tipo y a quién pertenece. Si dejas de vigilarla, sale de Uptime Kuma."
      trigger={<Button variant="ghost" size="sm" aria-label={`Editar ${site.label ?? site.url}`}><Pencil className="size-4" aria-hidden />Editar</Button>}>
      <ActionForm action={updateWebsite} success="Web guardada" onSuccess={() => setOpen(false)} className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="id" value={site.id} />
        <Field label="URL" htmlFor={f('url')} className="md:col-span-2"><Input id={f('url')} name="url" defaultValue={site.url} required /></Field>
        <Field label="Nombre" htmlFor={f('label')} hint="Vacío: se muestra la URL."><Input id={f('label')} name="label" defaultValue={site.label ?? ''} placeholder="Como quieres verla en la lista" /></Field>
        <Field label="Tipo" htmlFor={f('kind')}><Select id={f('kind')} name="kind" defaultValue={site.kind} options={toOptions(WEB_KIND_LABEL)} /></Field>
        <Field label="Cliente" htmlFor={f('client')}><Combobox id={f('client')} name="client" defaultValue={site.clientName ?? ''} allowCustom placeholder="Sin cliente" options={clients} /></Field>
        <Field label="Proyecto" htmlFor={f('project')}><Combobox id={f('project')} name="projectId" defaultValue={site.projectId ?? ''} placeholder="Sin proyecto" options={[{ value: '', label: 'Sin proyecto' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></Field>
        <Switch name="monitored" defaultChecked={site.monitored} label="Vigilar" description="Comprobación de uptime y monitor en Uptime Kuma." className="md:col-span-2" />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 md:col-span-2">
          <ConfirmAction action={deleteWebsite} fields={{ id: site.id }} title="¿Borrar esta web?" confirmLabel="Borrar" success="Web borrada"
            description={<>Se borran <strong>{site.label ?? site.url}</strong>, su historial de comprobaciones y sus notas, y se quita de Uptime Kuma. No se puede deshacer.</>}>
            Borrar web
          </ConfirmAction>
          <div className="flex gap-3">
            <ModalClose asChild><Button type="button" variant="ghost">Cancelar</Button></ModalClose>
            <SubmitButton pendingText="Guardando…">Guardar</SubmitButton>
          </div>
        </div>
      </ActionForm>
    </Modal>
  )
}
