import { ActionForm, Card, ConfirmAction, Notice, Pill, SubmitButton, Table, Tooltip } from '@/components/ui'
import { pruneWorktreesAction, removeWorktreeAction } from '@/lib/worktree-actions'
import { ago, fmtDate } from '@/lib/format'

type Location = {
  id: string
  path: string
  kind: 'MAIN' | 'WORKTREE' | 'COPY' | 'BACKUP'
  branch: string | null
  version: string | null
  modifiedAt: Date | null
  uncommitted: number | null
  untracked: number | null
  lastCommitAt: Date | null
  merged: boolean | null
  missing: boolean
}

const KIND = { MAIN: 'Principal', WORKTREE: 'Worktree', COPY: 'Copia', BACKUP: 'Backup' } as const

function State({ l }: { l: Location }) {
  if (l.missing) return <Pill tone="warn">Huérfano</Pill>
  if (l.uncommitted) return <Pill tone="warn">{l.uncommitted} sin commit</Pill>
  if (l.untracked) return <Pill tone="muted">{l.untracked} nuevos sin versionar</Pill>
  if (l.merged) return <Pill tone="ok">Fusionada</Pill>
  return <span className="text-muted">—</span>
}

/** Carpeta principal, worktrees (estén donde estén) y copias, con su estado git. */
export function LocationsCard({ projectId, locations }: { projectId: string; locations: Location[] }) {
  const main = locations.find((l) => l.kind === 'MAIN')
  const orphans = locations.filter((l) => l.missing)
  const removable = locations.filter((l) => l.kind === 'WORKTREE' && !l.missing && l.merged && !l.uncommitted && !l.untracked)
  return (
    <Card title="Ubicaciones en disco" note="Carpeta principal, worktrees (también los de fuera de la carpeta de proyectos, como Orca) y copias del mismo repositorio." className="xl:col-span-3">
      {(orphans.length > 0 || removable.length > 0) && (
        <div className="mb-5 flex flex-col gap-3">
          {orphans.length > 0 && (
            <Notice tone="warn" title={`${orphans.length} ${orphans.length === 1 ? 'worktree huérfano' : 'worktrees huérfanos'}`}
              action={main && <ActionForm action={pruneWorktreesAction} success="Huérfanos limpiados (o pedido al Mac)"><input type="hidden" name="projectId" value={projectId} /><SubmitButton variant="secondary" pendingText="Limpiando…">Limpiar</SubmitButton></ActionForm>}>
              Git los sigue apuntando pero la carpeta ya no existe. «Limpiar» quita esas referencias (<code className="rounded bg-panel px-1.5 py-0.5 font-mono text-sm">git worktree prune</code>); no toca ramas ni código.
            </Notice>
          )}
          {removable.length > 0 && (
            <Notice tone="info" title={`${removable.length} ${removable.length === 1 ? 'worktree se puede borrar' : 'worktrees se pueden borrar'}`}>
              Su rama ya está fusionada en la del principal y no tienen cambios sin commit. Bórralos con «Borrar» en su fila cuando no los necesites: la rama se queda.
            </Notice>
          )}
        </div>
      )}
      <Table head={['Tipo', 'Ruta', 'Rama', 'Versión', 'Último commit', 'Estado', 'Modificada', '']}>
        {locations.map((l) => (
          <tr key={l.id} className={l.missing ? 'opacity-60' : undefined}>
            <td><Pill tone={l.kind === 'MAIN' ? 'accent' : 'muted'}>{KIND[l.kind]}</Pill></td>
            <td className="break-all font-mono text-sm">{l.path}</td>
            <td className="text-muted">{l.branch ?? '—'}</td>
            <td className="num">{l.version ?? '—'}</td>
            <td className="whitespace-nowrap text-muted">{l.lastCommitAt ? <Tooltip content={fmtDate(l.lastCommitAt)}><span>{ago(l.lastCommitAt)}</span></Tooltip> : '—'}</td>
            <td className="whitespace-nowrap"><State l={l} /></td>
            <td className="whitespace-nowrap text-muted">{fmtDate(l.modifiedAt)}</td>
            <td className="text-right">{removable.includes(l) && (
              <ConfirmAction action={removeWorktreeAction} fields={{ id: l.id }} title="Borrar este worktree" confirmLabel="Borrar" success="Worktree borrado (o pedido al Mac)"
                description={<>Se borra la carpeta <code className="break-all">{l.path}</code> con <code>git worktree remove</code>. La rama {l.branch ? <strong>{l.branch}</strong> : null} se queda en el repositorio. Si tuviera cambios, git no la borra.</>}>
                Borrar
              </ConfirmAction>
            )}</td>
          </tr>
        ))}
      </Table>
    </Card>
  )
}
