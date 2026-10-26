'use client'

import { Plus } from 'lucide-react'
import { createQuote } from '@/lib/quote-actions'
import { ActionForm, Button, Combobox, Field, Input, Modal, ModalClose, SubmitButton, type ButtonVariant, type Option } from '@/components/ui'

/** Alta de un presupuesto: cliente y título. Número, IVA y validez (30 días) se ponen solos; las partidas, en su ficha. */
export function NewQuoteButton({ clients, projects, clientId, variant = 'primary' }: { clients: Option[]; projects: Option[]; clientId?: string; variant?: ButtonVariant }) {
  return (
    <Modal title="Nuevo presupuesto" description="Se crea en borrador con el siguiente número del año. Las partidas y las fases se añaden en su ficha."
      trigger={<Button variant={variant}><Plus className="size-5" aria-hidden />Nuevo presupuesto</Button>}>
      <ActionForm action={createQuote} success="Presupuesto creado" className="grid gap-4">
        <Field label="Cliente"><Combobox name="clientId" aria-label="Cliente" defaultValue={clientId ?? ''} allowCustom={false} required placeholder="Elige el cliente…" searchPlaceholder="Buscar cliente…" options={clients} /></Field>
        <Field label="Título" htmlFor="nq-title"><Input id="nq-title" name="title" placeholder="Web corporativa con tienda" required /></Field>
        <Field label="Proyecto (opcional)" hint="Si ya existe el proyecto en Central."><Combobox name="projectId" aria-label="Proyecto" allowCustom={false} placeholder="Sin proyecto" searchPlaceholder="Buscar proyecto…" options={projects} /></Field>
        <div className="flex justify-end gap-3">
          <ModalClose asChild><Button type="button" variant="ghost">Cancelar</Button></ModalClose>
          <SubmitButton pendingText="Creando…">Crear presupuesto</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  )
}
