'use client'

import { Copy, Download, Eye, EyeOff, FileUp, Pencil, Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { backupNow, deleteSecret, exportEnv, revealSecret } from '@/lib/secret-actions'
import { ENVIRONMENTS, envLabel } from '@/lib/environments'
import { ActionForm, Button, ConfirmAction, Empty, SubmitButton, Table, Tooltip, cn, toast } from '@/components/ui'
import { BackupsList } from './backups-list'
import { downloadText } from './download'
import { ImportModal } from './import-modal'
import { SecretFormModal } from './secret-form-modal'
import type { BackupRow, SecretRow } from './types'
import { UnlockProvider, UnlockStatus, useUnlock } from './unlock-provider'

type Props = { projectId: string; fileBase: string; secrets: SecretRow[]; backups: BackupRow[]; unlockedUntil: number | null }

export function SecretsPanel(props: Props) {
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  return (
    <UnlockProvider initialUntil={props.unlockedUntil} onLock={() => setRevealed({})}>
      <Panel {...props} revealed={revealed} setRevealed={setRevealed} />
    </UnlockProvider>
  )
}

function Panel({ projectId, fileBase, secrets, backups, revealed, setRevealed }: Props & { revealed: Record<string, string>; setRevealed: (r: Record<string, string>) => void }) {
  const { withUnlock } = useUnlock()
  const [env, setEnv] = useState('production')
  const [editing, setEditing] = useState<SecretRow | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const rows = secrets.filter((s) => s.environment === env)

  const reveal = async (s: SecretRow) => {
    if (s.id in revealed) {
      const { [s.id]: _, ...rest } = revealed
      return setRevealed(rest)
    }
    const r = await withUnlock(() => revealSecret(s.id))
    if (r) setRevealed({ ...revealed, [s.id]: r.value })
  }

  const copy = async (s: SecretRow) => {
    const r = s.id in revealed ? { value: revealed[s.id] } : await withUnlock(() => revealSecret(s.id))
    if (!r) return
    await navigator.clipboard.writeText(r.value)
    toast.success(`${s.key} copiado`)
  }

  const exportFile = async () => {
    const r = await withUnlock(() => exportEnv(projectId, env))
    if (r) downloadText(`${fileBase}.${env}.env`, r.content)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Entorno" className="inline-flex flex-wrap gap-1 rounded-2xl border border-line bg-ground p-1.5">
          {ENVIRONMENTS.map((e) => {
            const n = secrets.filter((s) => s.environment === e.value).length
            return (
              <button key={e.value} type="button" onClick={() => setEnv(e.value)} aria-pressed={env === e.value} className={cn('cursor-pointer rounded-xl px-5 py-2.5 text-base font-medium transition-colors', env === e.value ? 'bg-accent text-on-accent shadow-sm' : 'text-muted hover:bg-accent-soft hover:text-ink')}>
                {e.label} <span className="num opacity-75">· {n}</span>
              </button>
            )
          })}
        </nav>
        <UnlockStatus />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus className="size-5" aria-hidden />Añadir secreto</Button>
        <Button variant="secondary" onClick={() => setImportOpen(true)}><FileUp className="size-5" aria-hidden />Importar .env</Button>
        <Button variant="secondary" onClick={exportFile} disabled={!rows.length}><Download className="size-5" aria-hidden />Descargar .env</Button>
        <ActionForm action={backupNow} success="Copia guardada">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="environment" value={env} />
          <SubmitButton variant="secondary" disabled={!rows.length}><Save className="size-5" aria-hidden />Copia ahora</SubmitButton>
        </ActionForm>
      </div>

      {rows.length === 0 ? (
        <Empty title={`Sin secretos en ${envLabel(env).toLowerCase()}`}>Añádelos uno a uno o importa el fichero de variables de este entorno.</Empty>
      ) : (
        <Table head={['Variable', 'Valor', 'Notas', 'Actualizado', '']}>
          {rows.map((s) => (
            <tr key={s.id} className="align-top">
              <td className="font-mono text-sm font-semibold">{s.key}</td>
              <td className="max-w-xl">
                {s.id in revealed
                  ? <code className="block whitespace-pre-wrap break-all rounded-lg bg-ground px-3 py-1.5 font-mono text-sm">{revealed[s.id] || '(vacío)'}</code>
                  : <span className="select-none tracking-widest text-muted" aria-label="Valor oculto">••••••••••••</span>}
              </td>
              <td className="text-sm text-muted">{s.notes ?? ''}</td>
              <td className="whitespace-nowrap text-sm text-muted">{s.updated}</td>
              <td>
                <div className="flex justify-end gap-1">
                  <Tooltip content={s.id in revealed ? 'Ocultar' : 'Mostrar'}>
                    <Button variant="ghost" size="icon" onClick={() => reveal(s)} aria-label={s.id in revealed ? `Ocultar ${s.key}` : `Mostrar ${s.key}`}>
                      {s.id in revealed ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                    </Button>
                  </Tooltip>
                  <Tooltip content="Copiar valor">
                    <Button variant="ghost" size="icon" onClick={() => copy(s)} aria-label={`Copiar ${s.key}`}><Copy className="size-5" aria-hidden /></Button>
                  </Tooltip>
                  <Tooltip content="Editar">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setFormOpen(true) }} aria-label={`Editar ${s.key}`}><Pencil className="size-5" aria-hidden /></Button>
                  </Tooltip>
                  <ConfirmAction action={deleteSecret} fields={{ id: s.id, projectId }} title={`Quitar ${s.key}`} description="Se borra el valor de este entorno. Si hay una copia del fichero, ahí sigue." confirmLabel="Quitar" success="Secreto quitado">Quitar</ConfirmAction>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <section>
        <h3 className="mb-3 text-lg font-semibold">Copias del fichero · {envLabel(env)}</h3>
        <BackupsList backups={backups.filter((b) => b.environment === env)} fileBase={fileBase} />
      </section>

      <SecretFormModal projectId={projectId} environment={env} editing={editing} open={formOpen} onOpenChange={setFormOpen} />
      <ImportModal projectId={projectId} environment={env} open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}
