import { CircleAlert, CircleCheck, CircleDashed, ExternalLink, RefreshCw } from 'lucide-react'
import type { Project, RepoRemote } from '@/generated/prisma/client'
import { saveRepo } from '@/lib/project-actions'
import { refreshRepo } from '@/lib/repo-actions'
import { ActionForm, Card, Field, Input, Notice, Pill, SubmitButton, Table, Tooltip, cn } from '@/components/ui'
import { ago, fmtDateTime } from '@/lib/format'
import { isOwnRemote } from '@/lib/scanner'

type Branch = { name: string; upstream: string | null; ahead: number; behind: number; gone?: boolean; implicit?: boolean }
const PROVIDER = { GITHUB: 'GitHub', GITLAB: 'GitLab', GITEA: 'Gitea', OTHER: 'Otro' } as const
const webUrl = (r: RepoRemote) => (r.path && r.provider !== 'OTHER' ? `https://${r.host}/${r.path}` : r.url.replace(/\.git$/, ''))

function Ci({ r }: { r: RepoRemote }) {
  if (!r.ciStatus) return <span className="text-muted">—</span>
  const pill = r.ciStatus === 'success' ? <Pill tone="ok"><CircleCheck className="size-4" aria-hidden />Correcto</Pill>
    : r.ciStatus === 'failure' ? <Pill tone="bad"><CircleAlert className="size-4" aria-hidden />Falla</Pill>
    : <Pill tone="warn"><CircleDashed className="size-4" aria-hidden />En curso</Pill>
  return r.ciUrl ? <a href={r.ciUrl} target="_blank" rel="noreferrer">{pill}</a> : pill
}

function Chips({ title, items, tone }: { title: string; items: string[]; tone: 'warn' | 'muted' }) {
  if (!items.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted">{title}:</span>
      {items.slice(0, 12).map((b) => <Pill key={b} tone={tone}>{b}</Pill>)}
      {items.length > 12 && <span className="text-sm text-muted">y {items.length - 12} más</span>}
    </div>
  )
}

/** Repositorio: estado local frente a origin y lo que dice el proveedor. */
export function RepoCard({ p, remotes }: { p: Project; remotes: RepoRemote[] }) {
  const all = (p.branchStatus as Branch[] | null) ?? []
  const current = all.find((b) => b.name === p.defaultBranch)
  const branches = all
    .filter((b) => b.ahead || b.behind || b.name === p.defaultBranch)
    .sort((a, b) => b.ahead + b.behind - (a.ahead + a.behind))
  const stale = p.lastFetchAt && Date.now() - p.lastFetchAt.getTime() > 7 * 864e5
  const origin = remotes.find((r) => r.name === 'origin') ?? remotes[0]
  const thirdParty = origin ? !isOwnRemote(origin.path ? `${origin.host}/${origin.path}` : origin.url) : false
  return (
    <Card
      title="Repositorio"
      note="Lo que hay en el disco frente a lo que hay en el remoto, y lo que dice el proveedor."
      className="xl:col-span-2"
      action={remotes.length > 0 && (
        <ActionForm action={refreshRepo} success="Repositorio actualizado">
          <input type="hidden" name="id" value={p.id} />
          <SubmitButton variant="secondary" size="sm" pendingText="Actualizando…"><RefreshCw className="size-4" aria-hidden />Traer de origin y actualizar</SubmitButton>
        </ActionForm>
      )}
    >
      {remotes.length === 0 && (
        <Notice tone={p.status === 'ACTIVE' || p.status === 'MAINTENANCE' ? 'bad' : 'warn'} title="Sin copia fuera del disco" className="mb-5">
          Este proyecto no tiene remoto: si el disco falla, se pierde. Súbelo a GitHub, GitLab o Gitea.
        </Notice>
      )}
      {(p.rewrittenCommits ?? 0) > 0 && (
        <Notice tone="warn" title="La historia de la rama actual se ha reescrito" className="mb-5">
          {p.rewrittenCommits} cambios están en local y en origin con distinto identificador (rebase o force-push), así que no cuentan como «por bajar».
          {' '}Si la buena es la local, súbela con <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-sm">git push --force-with-lease</code>; si es la de origin, revisa antes de sustituir la local.
        </Notice>
      )}
      {p.fetchError && <Notice tone="warn" title={p.fetchError} className="mb-5">El último «traer de origin» falló; los números de abajo pueden estar desactualizados.</Notice>}

      <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-base">
        <dt className="text-muted">Rama actual</dt><dd>{p.defaultBranch ?? '—'}</dd>
        <dt className="text-muted">Último commit</dt><dd>{fmtDateTime(p.lastCommitAt)} · {p.lastCommitMsg ?? '—'}</dd>
        <dt className="text-muted">Commits</dt><dd className="num">{p.commitCount ?? '—'}</dd>
        <dt className="text-muted">Sin commit</dt><dd>
          <span className={cn('num', p.uncommitted ? 'text-warn' : '')}>{p.uncommitted ?? '—'} ficheros con cambios</span>
          {p.untracked ? <span className="text-muted"> · {p.untracked} nuevos sin versionar (git no los sigue)</span> : null}
        </dd>
        {remotes.length > 0 && <>
          <dt className="text-muted">Sin subir (en ningún remoto)</dt><dd>
            <span className={cn('num', p.aheadTotal ? 'font-semibold text-warn' : '')}>{p.aheadTotal ?? '—'} commits</span>
            {p.aheadTotal && current?.upstream && !current.ahead
              ? <span className="text-muted"> · en ramas que solo están en local{p.localOnlyBranches.length ? ` (${p.localOnlyBranches.join(', ')})` : ''}; la rama actual está subida</span>
              : null}
          </dd>
          <dt className="text-muted">Por bajar (rama actual)</dt>
          <dd>
            <span className={cn('num', p.behindTotal ? 'font-semibold text-accent-strong' : '')}>{p.behindTotal ?? '—'} commits</span>
            {p.behindTotal ? <span className="text-muted"> · de {p.behindAuthors.join(', ')}</span> : null}
            {p.behindTotal && thirdParty ? <div className="text-sm text-muted">Repositorio de terceros: son novedades del autor original, no trabajo tuyo pendiente.</div> : null}
          </dd>
          <dt className="text-muted">Último «traer de origin»</dt><dd className={stale ? 'text-warn' : ''}>{p.lastFetchAt ? <Tooltip content={fmtDateTime(p.lastFetchAt)}><span>{ago(p.lastFetchAt)}</span></Tooltip> : 'Nunca'}</dd>
        </>}
        <dt className="text-muted">Stash</dt><dd className={cn('num', p.stashCount ? 'text-warn' : '')}>{p.stashCount ?? '—'}</dd>
        <dt className="text-muted">Stack</dt><dd>{p.stack.join(', ') || '—'}</dd>
        <dt className="text-muted">CLAUDE.md</dt><dd>{p.hasClaudeMd ? 'Sí' : 'No'}</dd>
        <dt className="text-muted">Escaneado</dt><dd>{fmtDateTime(p.scannedAt)}</dd>
      </dl>

      {branches.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-semibold">Ramas frente a origin</h3>
          <Table head={['Rama', 'Sigue a', 'Sin subir', 'Por bajar']}>
            {branches.slice(0, 15).map((b) => (
              <tr key={b.name}>
                <td className="font-mono text-sm font-semibold">{b.name}</td>
                <td className="font-mono text-sm text-muted">{b.upstream ?? '—'}{b.implicit && <span className="ml-2 font-sans text-muted">(mismo nombre)</span>}{b.gone && <span className="ml-2"><Pill tone="warn">Borrada en origin</Pill></span>}</td>
                <td className={cn('num', b.ahead ? 'font-semibold text-warn' : 'text-muted')}>{b.ahead}</td>
                <td className={cn('num', b.behind ? 'font-semibold text-accent-strong' : 'text-muted')}>
                  {b.behind}
                  {/* otra rama que solo va por detrás: no hay trabajo perdido, solo está sin poner al día */}
                  {b.behind > 0 && !b.ahead && b.name !== p.defaultBranch && b.upstream && !b.gone && (
                    <div className="font-sans text-sm font-normal text-muted">Tu copia local de esta rama está desactualizada; no tienes nada pendiente en ella. Se pone al día con <code className="font-mono">git fetch {b.upstream.split('/')[0]} {b.upstream.slice(b.upstream.indexOf('/') + 1)}:{b.name}</code></div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      {remotes.length > 0 && (
        <div className="mt-5 flex flex-col gap-3">
          <Chips title="Ramas locales sin subir" items={p.localOnlyBranches} tone="warn" />
          <Chips title="Ramas remotas sin copia local" items={p.remoteOnlyBranches} tone="muted" />
        </div>
      )}

      {remotes.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-lg font-semibold">Remotos</h3>
          <Table head={['Remoto', 'Visibilidad', 'Último push', 'PRs', 'Issues', 'CI', 'Release']}>
            {remotes.map((r) => (
              <tr key={r.id}>
                <td>
                  <a href={webUrl(r)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent-strong hover:underline">{r.path ?? r.host}<ExternalLink className="size-4" aria-hidden /></a>
                  <div className="text-sm text-muted">{r.name} · {PROVIDER[r.provider]}{r.archived ? ' · archivado' : ''}</div>
                  {r.syncError && <div className="text-sm text-warn">{r.syncError}</div>}
                </td>
                <td>{r.visibility ? <Pill tone={r.visibility === 'public' ? 'accent' : 'muted'}>{r.visibility === 'public' ? 'Público' : r.visibility === 'internal' ? 'Interno' : 'Privado'}</Pill> : '—'}</td>
                <td className="whitespace-nowrap text-muted">{r.lastPushAt ? ago(r.lastPushAt) : '—'}</td>
                <td className="num">{r.openPrs ?? '—'}</td>
                <td className="num">{r.openIssues ?? '—'}</td>
                <td><Ci r={r} /></td>
                <td className="font-mono text-sm">{r.latestRelease ?? '—'}</td>
              </tr>
            ))}
          </Table>
          {remotes.some((r) => r.syncedAt) && <p className="mt-2 text-sm text-muted">Datos del proveedor de {ago(new Date(Math.max(...remotes.map((r) => r.syncedAt?.getTime() ?? 0))))}.</p>}
        </div>
      )}

      <ActionForm action={saveRepo} success="Repositorio guardado" className="mt-6 grid gap-3 border-t border-line pt-5 md:grid-cols-[1fr_auto]">
        <input type="hidden" name="id" value={p.id} />
        <Field label="Repositorio principal" htmlFor="repoUrl" hint={p.repoLocked ? 'Escrito a mano: el escáner no lo cambia. Déjalo vacío para que vuelva a leerlo de git.' : 'Lo lee el escáner del remoto de git. Si lo escribes, queda fijado.'}>
          <Input id="repoUrl" name="repoUrl" defaultValue={p.repoUrl ?? ''} placeholder="https://github.com/usuario/proyecto" />
        </Field>
        <SubmitButton variant="secondary" className="self-start md:mt-9">Guardar repositorio</SubmitButton>
      </ActionForm>
    </Card>
  )
}
