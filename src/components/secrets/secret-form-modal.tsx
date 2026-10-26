'use client'

import { saveSecret } from '@/lib/secret-actions'
import { ActionForm, Field, Input, Modal, SubmitButton, Textarea } from '@/components/ui'
import type { SecretRow } from './types'

/** Alta o edición de un secreto. Al editar, el valor vacío no lo cambia (nunca se precarga el actual). */
export function SecretFormModal({ projectId, environment, editing, open, onOpenChange }: {
  projectId: string
  environment: string
  editing: SecretRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={editing ? `Editar ${editing.key}` : 'Añadir secreto'} description="El valor se guarda cifrado.">
      <ActionForm key={editing?.id ?? 'nuevo'} action={saveSecret} success={editing ? 'Secreto actualizado' : 'Secreto guardado'} onSuccess={() => onOpenChange(false)} className="flex flex-col gap-5 pb-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="environment" value={editing?.environment ?? environment} />
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <Field label="Nombre de la variable" htmlFor="secret-key" hint="Letras, números y guion bajo, p. ej. DATABASE_URL.">
          <Input id="secret-key" name="key" defaultValue={editing?.key ?? ''} required pattern="[A-Za-z_][A-Za-z0-9_.\-]*" autoComplete="off" spellCheck={false} className="font-mono" />
        </Field>
        <Field label="Valor" htmlFor="secret-value" hint={editing ? 'Déjalo vacío para mantener el valor actual.' : 'Admite varias líneas (claves privadas, certificados).'}>
          <Textarea id="secret-value" name="value" rows={3} required={!editing} autoComplete="off" spellCheck={false} className="font-mono" />
        </Field>
        <Field label="Notas" htmlFor="secret-notes">
          <Input id="secret-notes" name="notes" defaultValue={editing?.notes ?? ''} placeholder="Para qué sirve, dónde se renueva…" />
        </Field>
        <SubmitButton className="self-start" pendingText="Guardando…">Guardar</SubmitButton>
      </ActionForm>
    </Modal>
  )
}
