'use client'

import { useState } from 'react'
import { removeWorktreeAction } from '@/lib/worktree-actions'
import { ActionForm, Button, Checkbox, Modal, SubmitButton } from '@/components/ui'

/** Borra un worktree fusionado y, si se marca, también su rama local y la de GitHub (nunca forzando). */
export function RemoveWorktreeButton({ id, path, branch }: { id: string; path: string; branch: string | null }) {
  const [open, setOpen] = useState(false)
  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      title="Borrar este worktree"
      description={<>Se borra la carpeta <code className="break-all">{path}</code> de este Mac con <code>git worktree remove</code>. Si tuviera cambios, git no la borra.</>}
      trigger={<Button variant="danger-ghost" size="sm">Borrar</Button>}
    >
      <ActionForm action={removeWorktreeAction} success="Worktree borrado (o pedido al Mac)" onSuccess={() => setOpen(false)} className="grid gap-4 text-left">
        <input type="hidden" name="id" value={id} />
        {branch && <>
          <Checkbox name="local_branch" defaultChecked label={<>Borrar también la rama local <strong>{branch}</strong></>}
            description="Con git branch -d: si no estuviera fusionada, git la deja." />
          <Checkbox name="remote_branch" label={<>Borrar también la rama <strong>{branch}</strong> en GitHub</>}
            description="Solo si está fusionada también en origin; si no, se queda. Si tenía un pull request, GitHub permite restaurarla desde él." />
        </>}
        <SubmitButton variant="danger" className="justify-self-start" pendingText="Borrando…">Borrar</SubmitButton>
      </ActionForm>
    </Modal>
  )
}
