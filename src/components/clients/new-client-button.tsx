'use client'

import { Plus } from 'lucide-react'
import { createClient } from '@/lib/client-actions'
import { ActionForm, Button, Field, Input, Modal, ModalClose, SubmitButton } from '@/components/ui'

/** Alta de un cliente con lo mínimo; el resto se completa en su ficha, que se abre al crearlo. */
export function NewClientButton() {
  return (
    <Modal title="Nuevo cliente" description="Lo básico para tenerlo localizado. El NIF, la dirección y los proyectos se añaden en su ficha."
      trigger={<Button><Plus className="size-5" aria-hidden />Nuevo cliente</Button>}>
      <ActionForm action={createClient} success="Cliente creado" className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" htmlFor="nc-name" className="md:col-span-2"><Input id="nc-name" name="name" placeholder="Nombre o marca del cliente" required autoFocus /></Field>
        <Field label="Empresa" htmlFor="nc-company"><Input id="nc-company" name="company" placeholder="Razón social" /></Field>
        <Field label="Correo" htmlFor="nc-email"><Input id="nc-email" name="email" type="email" placeholder="correo@cliente.com" /></Field>
        <Field label="Teléfono" htmlFor="nc-phone"><Input id="nc-phone" name="phone" type="tel" placeholder="+34 600 000 000" /></Field>
        <div className="flex items-end justify-end gap-3">
          <ModalClose asChild><Button type="button" variant="ghost">Cancelar</Button></ModalClose>
          <SubmitButton pendingText="Creando…">Crear cliente</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  )
}
