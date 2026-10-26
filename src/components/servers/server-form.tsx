import { ActionForm, Combobox, Field, Input, SubmitButton } from '@/components/ui'
import { PANELS, PROVIDERS, brandOptions } from '@/lib/brands'

/** Alta de un servidor: lo mínimo para conectar. El resto se edita después en su ficha. */
export function ServerForm({ action }: { action: (form: FormData) => unknown }) {
  return (
    <ActionForm action={action} success="Servidor dado de alta" className="grid gap-3 md:grid-cols-[1.5fr_2fr_0.7fr_1.2fr_1fr_auto]">
      <Field label="Nombre" htmlFor="srv-name"><Input id="srv-name" name="name" placeholder="Easypanel iServisat" required /></Field>
      <Field label="Host" htmlFor="srv-host"><Input id="srv-host" name="host" placeholder="203.0.113.10 o servidor.dominio.com" required /></Field>
      <Field label="Puerto SSH" htmlFor="srv-port"><Input id="srv-port" name="sshPort" type="number" min={1} max={65535} defaultValue={22} /></Field>
      <Field label="Proveedor"><Combobox name="provider" aria-label="Proveedor" placeholder="Elige o escribe…" allowCustom options={PROVIDERS.map((p) => p.label)} /></Field>
      <Field label="Panel"><Combobox name="panel" aria-label="Panel" placeholder="Sin panel" allowCustom options={brandOptions(PANELS)} /></Field>
      <SubmitButton className="self-end" pendingText="Leyendo…">Dar de alta</SubmitButton>
    </ActionForm>
  )
}
