'use client'

import { Copy, Download, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { adminPublicKeyAction, installServerAction } from '@/lib/server-actions'
import { ActionForm, Button, Field, Input, Modal, SubmitButton, Textarea, toast } from '@/components/ui'

/** Instala o actualiza infobar en el servidor: solo pide usuario y contraseña (la contraseña no se guarda). */
/** `remote`: Central en producción; instala el trabajador del Mac con sus claves, sin contraseñas. */
export function InstallButton({ id, host, user, remote = false, label = 'Instalar o actualizar infobar', variant = 'secondary' }: { id: string; host: string; user: string | null; remote?: boolean; label?: string; variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false)
  const [pub, setPub] = useState<string | null>(null)
  const showKey = async () => { try { setPub(await adminPublicKeyAction()) } catch { toast.error('No se ha podido crear la clave') } }
  const copy = async () => { if (pub) { await navigator.clipboard.writeText(pub); toast.success('Clave copiada') } }
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Instalar o actualizar infobar"
      description={remote
        ? <>Se lo pide al Mac: el trabajador entra en <strong>{host}</strong> con las claves del Mac (o la contraseña guardada en su Llavero), instala <code>infobar</code> y Central vuelve a leer el servidor. Las contraseñas no pasan por producción.</>
        : <>Central entra una vez en <strong>{host}</strong>, instala el usuario de solo lectura <code>infobar</code> con los scripts al día y vuelve a leer el servidor. La contraseña se usa solo para esta conexión: no se guarda.</>}
      trigger={<Button variant={variant}><Download className="size-5" aria-hidden />{label}</Button>}
    >
      <ActionForm action={installServerAction} success={remote ? 'Pedido al Mac: la ficha se actualiza al terminar' : 'infobar instalado y servidor leído'} onSuccess={() => setOpen(false)} className="grid gap-4">
        <input type="hidden" name="id" value={id} />
        <Field label="Usuario" htmlFor={`inst-user-${id}`} hint="El de administrador del servidor: root, o uno con sudo.">
          <Input id={`inst-user-${id}`} name="ssh_user" defaultValue={user ?? 'root'} autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore spellCheck={false} required />
        </Field>
        {!remote && <>
        <Field label="Contraseña" htmlFor={`inst-pass-${id}`} hint="La del servidor o la frase de paso de tu clave SSH. Déjala vacía si tu clave no tiene frase o su frase está en el Llavero de macOS.">
          <Input id={`inst-pass-${id}`} name="password" type="password" autoComplete="current-password" autoFocus />
        </Field>
        <Field label="Clave privada (opcional)" htmlFor={`inst-key-${id}`} hint="Si el servidor solo acepta claves: pega aquí una que entre, por ejemplo la que enseña Dokploy en Ajustes › Claves SSH › «Mostrar». No se guarda.">
          <Textarea id={`inst-key-${id}`} name="private_key" rows={4} autoComplete="off" spellCheck={false} className="font-mono text-sm" placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
        </Field>
        </>}
        <SubmitButton className="justify-self-start" pendingText={remote ? 'Pidiendo…' : 'Instalando…'}>{remote ? 'Pedir al Mac' : 'Instalar'}</SubmitButton>
      </ActionForm>
      <section className="mt-6 rounded-2xl border border-line bg-ground p-4">
        <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="size-5" aria-hidden />¿El servidor solo acepta claves?</h3>
        <p className="mt-1 text-sm text-muted">Añade esta clave de Central{remote ? ' (la del Mac)' : ''} en el panel de tu proveedor (en su lista de claves SSH), espera unos segundos y pulsa «{remote ? 'Pedir al Mac' : 'Instalar'}»{remote ? '' : ' sin contraseña'}. Al terminar puedes quitarla del panel: Central lee el servidor con infobar.</p>
        {pub ? (
          <div className="mt-3 flex items-start gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-panel px-3 py-2 text-sm">{pub}</code>
            <Button variant="secondary" size="sm" onClick={copy}><Copy className="size-4" aria-hidden />Copiar</Button>
          </div>
        ) : <Button variant="secondary" size="sm" className="mt-3" onClick={showKey}>Mostrar la clave de Central</Button>}
      </section>
    </Modal>
  )
}
