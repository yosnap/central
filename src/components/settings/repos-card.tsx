import { GitBranch, RefreshCw } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { addRepoToken, syncAllRepos } from '@/lib/repo-actions'
import { deleteConnection } from '@/lib/settings-actions'
import { ghSessionAvailable } from '@/lib/repo-sync'
import { ActionForm, Card, ConfirmAction, Input, Notice, Pill, Select, SubmitButton, Table } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

const PROVIDERS = [{ value: 'GITHUB', label: 'GitHub' }, { value: 'GITLAB', label: 'GitLab' }, { value: 'GITEA', label: 'Gitea' }]
const label = (p: string) => PROVIDERS.find((x) => x.value === p)?.label ?? p

/** Acceso a las APIs de GitHub, GitLab y Gitea para los datos de los repositorios. */
export async function ReposCard() {
  const [tokens, missing, last] = await Promise.all([
    prisma.integrationConnection.findMany({ where: { provider: { in: ['GITHUB', 'GITLAB', 'GITEA'] } }, orderBy: { label: 'asc' } }),
    prisma.repoRemote.groupBy({ by: ['host', 'provider'], where: { syncError: { contains: 'falta token', mode: 'insensitive' }, project: { excluded: false } }, _count: true }),
    prisma.repoRemote.aggregate({ _max: { syncedAt: true } }),
  ])
  const gh = ghSessionAvailable()
  return (
    <Card
      title="Repositorios"
      note="Central consulta a GitHub, GitLab o Gitea el último push, las PRs, las issues, el CI y los releases. Los tokens se guardan cifrados."
      action={
        <ActionForm action={syncAllRepos} success="Repositorios sincronizados">
          <SubmitButton variant="secondary" pendingText="Sincronizando…"><RefreshCw className="size-5" aria-hidden />Sincronizar repositorios</SubmitButton>
        </ActionForm>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <GitBranch className="size-5 text-muted" aria-hidden />
        <span>GitHub:</span>
        {tokens.some((t) => t.provider === 'GITHUB') ? <Pill tone="ok">Token guardado</Pill> : gh ? <Pill tone="ok">Se usa tu sesión de gh de este Mac</Pill> : <Pill tone="warn">Sin acceso: añade un token o inicia sesión con gh</Pill>}
        {last._max.syncedAt && <span className="text-sm text-muted">Última sincronización: {fmtDateTime(last._max.syncedAt)}</span>}
      </div>

      {missing.length > 0 && (
        <Notice tone="warn" title="Faltan tokens" className="mb-5">
          {missing.map((m) => `${m.host} (${label(m.provider)}, ${m._count} ${m._count === 1 ? 'repositorio' : 'repositorios'})`).join(' · ')}
        </Notice>
      )}

      {tokens.length > 0 && (
        <Table head={['Proveedor', 'Servidor', 'Guardado', '']}>
          {tokens.map((t) => (
            <tr key={t.id}>
              <td>{label(t.provider)}</td>
              <td className="font-mono text-sm">{t.label}</td>
              <td className="text-muted">{fmtDateTime(t.updatedAt)}</td>
              <td className="text-right">
                <ConfirmAction action={deleteConnection} fields={{ id: t.id }} title="Quitar este token" description={`Central dejará de consultar ${t.label} con este token.`} confirmLabel="Quitar" success="Token quitado">Quitar</ConfirmAction>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <ActionForm action={addRepoToken} success="Token guardado y repositorios consultados" className="mt-5 grid gap-3 md:grid-cols-[minmax(10rem,1fr)_2fr_2fr_auto]">
        <Select name="provider" aria-label="Proveedor" defaultValue="GITLAB" options={PROVIDERS} />
        <Input name="host" aria-label="Servidor" placeholder="gitlab.com, git.miempresa.com…" required className="font-mono" />
        <Input name="token" type="password" aria-label="Token" placeholder="Token de acceso (solo lectura basta)" required autoComplete="off" />
        <SubmitButton pendingText="Guardando…">Añadir token</SubmitButton>
      </ActionForm>
    </Card>
  )
}
