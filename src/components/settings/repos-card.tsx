import { GitBranch, RefreshCw } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { addRepoToken, syncAllRepos } from '@/lib/repo-actions'
import { deleteConnection } from '@/lib/settings-actions'
import { ghSessionAvailable } from '@/lib/repo-sync'
import { ActionForm, Card, ConfirmAction, Field, Input, Notice, Pill, Select, SubmitButton, Table } from '@/components/ui'
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
        <Table head={['Nombre', 'Proveedor', 'Servidor', 'Cuenta u organización', 'Guardado', '']}>
          {tokens.map((t) => (
            <tr key={t.id}>
              <td className="font-medium">{t.label}</td>
              <td>{label(t.provider)}</td>
              <td className="font-mono text-sm">{t.baseUrl?.replace(/^https?:\/\//, '')}</td>
              <td className="font-mono text-sm">{t.account ?? <span className="font-sans text-muted">Todas (general)</span>}</td>
              <td className="text-muted">{fmtDateTime(t.updatedAt)}</td>
              <td className="text-right">
                <ConfirmAction action={deleteConnection} fields={{ id: t.id }} title="Quitar este token" description={`Central dejará de consultar ${t.label} con este token.`} confirmLabel="Quitar" success="Token quitado">Quitar</ConfirmAction>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <ActionForm action={addRepoToken} success="Token guardado y repositorios consultados" className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Proveedor" htmlFor="tok-provider"><Select id="tok-provider" name="provider" defaultValue="GITHUB" options={PROVIDERS} /></Field>
        <Field label="Servidor" htmlFor="tok-host" hint="Vacío: github.com o gitlab.com. Si es un GitLab o Gitea propio, su dominio (git.cliente.com).">
          <Input id="tok-host" name="host" placeholder="github.com" className="font-mono" />
        </Field>
        <Field label="Cuenta u organización" htmlFor="tok-account" hint="Vacío: token general de ese servidor. Con nombre, solo para sus repositorios (la asociación, una agencia, un cliente).">
          <Input id="tok-account" name="account" placeholder="humanitek" className="font-mono" autoComplete="off" />
        </Field>
        <Field label="Nombre" htmlFor="tok-label" hint="Para reconocerlo en la lista.">
          <Input id="tok-label" name="label" placeholder="Asociación Humanitek" autoComplete="off" />
        </Field>
        <Field label="Token" htmlFor="tok-token" hint="Basta con solo lectura. Se guarda cifrado." className="xl:col-span-2">
          <Input id="tok-token" name="token" type="password" placeholder="Token de acceso" required autoComplete="off" />
        </Field>
        <SubmitButton className="justify-self-start" pendingText="Guardando…">Añadir token</SubmitButton>
      </ActionForm>
    </Card>
  )
}
