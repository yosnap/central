/**
 * Datos del proveedor de cada remoto (GitHub, GitLab, Gitea): visibilidad, último push, PRs/MRs,
 * issues, CI y último release. Tokens de Ajustes (cifrados) o, para GitHub, el de `gh` del Mac.
 * Nunca registra ni devuelve tokens.
 */
import { execFileSync } from 'node:child_process'
import type { RepoRemote } from '@/generated/prisma/client'
import { decryptJson } from './crypto'
import { prisma } from './prisma'

type Sync = Partial<Pick<RepoRemote, 'provider' | 'visibility' | 'defaultBranch' | 'lastPushAt' | 'openPrs' | 'openIssues' | 'ciStatus' | 'ciUrl' | 'latestRelease' | 'archived'>>
type Token = { token: string; source: 'ajustes' | 'gh' }

class SyncError extends Error {}

// --- Tokens ---

let ghToken: string | null | undefined
function ghCliToken(): string | null {
  if (ghToken !== undefined) return ghToken
  try {
    ghToken = execFileSync('gh', ['auth', 'token', '--hostname', 'github.com'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch {
    ghToken = null
  }
  return ghToken
}

async function tokenFor(host: string, provider: RepoRemote['provider']): Promise<Token | null> {
  const conns = await prisma.integrationConnection.findMany({ where: { provider: { in: ['GITHUB', 'GITLAB', 'GITEA'] } } })
  const conn = conns.find((c) => {
    try { return new URL(c.baseUrl ?? '').hostname === host } catch { return false }
  })
  const saved = conn ? decryptJson<{ token: string }>(conn.secret)?.token : null
  if (saved) return { token: saved, source: 'ajustes' }
  if (provider === 'GITHUB') {
    const gh = ghCliToken()
    if (gh) return { token: gh, source: 'gh' }
  }
  return null
}

/** Proveedor guardado en Ajustes para un host propio (p. ej. un Gitea o GitLab autoalojado). */
async function savedProviderFor(host: string): Promise<RepoRemote['provider'] | null> {
  const conns = await prisma.integrationConnection.findMany({ where: { provider: { in: ['GITHUB', 'GITLAB', 'GITEA'] } } })
  const c = conns.find((x) => { try { return new URL(x.baseUrl ?? '').hostname === host } catch { return false } })
  return (c?.provider as RepoRemote['provider']) ?? null
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<{ status: number; data: T | null }> {
  const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Central-repos/0.1', ...headers }, signal: AbortSignal.timeout(15000) })
  if (res.status === 404) return { status: 404, data: null }
  if (res.status === 401 || res.status === 403) throw new SyncError('El token no tiene acceso a este repositorio')
  if (!res.ok) throw new SyncError(`El proveedor respondió ${res.status}`)
  return { status: res.status, data: (await res.json()) as T }
}

// --- GitHub ---

async function github(path: string, token: Token | null): Promise<Sync> {
  const h: Record<string, string> = { 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token.token}` } : {}) }
  const api = `https://api.github.com/repos/${path}`
  const { data: repo } = await getJson<{ private: boolean; visibility?: string; default_branch: string; pushed_at: string; archived: boolean; open_issues_count: number }>(api, h)
  if (!repo) throw new SyncError(token ? 'Repositorio no encontrado o sin acceso' : 'Repositorio privado: falta token de GitHub')
  const [pulls, checks, release, tags] = await Promise.all([
    getJson<unknown[]>(`${api}/pulls?state=open&per_page=100`, h),
    getJson<{ check_runs: { status: string; conclusion: string | null }[] }>(`${api}/commits/${encodeURIComponent(repo.default_branch)}/check-runs?per_page=50`, h).catch(() => ({ data: null })),
    getJson<{ tag_name: string }>(`${api}/releases/latest`, h),
    getJson<{ name: string }[]>(`${api}/tags?per_page=1`, h),
  ])
  const openPrs = pulls.data?.length ?? 0
  const runs = checks.data?.check_runs ?? []
  const ciStatus = !runs.length ? null
    : runs.some((r) => r.conclusion === 'failure' || r.conclusion === 'timed_out' || r.conclusion === 'cancelled') ? 'failure'
    : runs.some((r) => r.status !== 'completed') ? 'pending' : 'success'
  return {
    provider: 'GITHUB',
    visibility: repo.visibility ?? (repo.private ? 'private' : 'public'),
    defaultBranch: repo.default_branch,
    lastPushAt: new Date(repo.pushed_at),
    archived: repo.archived,
    openPrs,
    openIssues: Math.max(0, repo.open_issues_count - openPrs),
    ciStatus,
    ciUrl: runs.length ? `https://github.com/${path}/actions` : null,
    latestRelease: release.data?.tag_name ?? tags.data?.[0]?.name ?? null,
  }
}

// --- GitLab ---

async function gitlab(host: string, path: string, token: Token | null): Promise<Sync> {
  if (!token) throw new SyncError(`Falta token de GitLab para ${host}`)
  const h = { 'private-token': token.token }
  const api = `https://${host}/api/v4/projects/${encodeURIComponent(path)}`
  const { data: p } = await getJson<{ visibility: string; default_branch: string; last_activity_at: string; archived: boolean; open_issues_count?: number }>(api, h)
  if (!p) throw new SyncError('Repositorio no encontrado o sin acceso')
  const [mrs, pipes, rel] = await Promise.all([
    getJson<unknown[]>(`${api}/merge_requests?state=opened&per_page=100`, h),
    getJson<{ status: string; web_url: string }[]>(`${api}/pipelines?ref=${encodeURIComponent(p.default_branch)}&per_page=1`, h).catch(() => ({ data: null })),
    getJson<{ tag_name: string }[]>(`${api}/releases?per_page=1`, h).catch(() => ({ data: null })),
  ])
  const pipe = pipes.data?.[0]
  const ciStatus = !pipe ? null : pipe.status === 'success' ? 'success' : ['failed', 'canceled'].includes(pipe.status) ? 'failure' : 'pending'
  return {
    provider: 'GITLAB', visibility: p.visibility, defaultBranch: p.default_branch, lastPushAt: new Date(p.last_activity_at), archived: p.archived,
    openPrs: mrs.data?.length ?? 0, openIssues: p.open_issues_count ?? null, ciStatus, ciUrl: pipe?.web_url ?? null, latestRelease: rel.data?.[0]?.tag_name ?? null,
  }
}

// --- Gitea ---

async function gitea(host: string, path: string, token: Token | null): Promise<Sync> {
  const h: Record<string, string> = token ? { authorization: `token ${token.token}` } : {}
  const api = `https://${host}/api/v1/repos/${path}`
  const { data: r } = await getJson<{ private: boolean; internal?: boolean; default_branch: string; updated_at: string; archived: boolean; open_issues_count: number; open_pr_counter: number }>(api, h)
  if (!r) throw new SyncError(token ? 'Repositorio no encontrado o sin acceso' : `Repositorio privado: falta token de Gitea para ${host}`)
  const [rel, status] = await Promise.all([
    getJson<{ tag_name: string }[]>(`${api}/releases?limit=1`, h).catch(() => ({ data: null })),
    getJson<{ state: string; total_count: number }>(`${api}/commits/${encodeURIComponent(r.default_branch)}/status`, h).catch(() => ({ data: null })),
  ])
  const st = status.data
  const ciStatus = !st || !st.total_count ? null : st.state === 'success' ? 'success' : ['failure', 'error'].includes(st.state) ? 'failure' : 'pending'
  return {
    provider: 'GITEA', visibility: r.private ? 'private' : r.internal ? 'internal' : 'public', defaultBranch: r.default_branch, lastPushAt: new Date(r.updated_at),
    archived: r.archived, openPrs: r.open_pr_counter, openIssues: r.open_issues_count, ciStatus, ciUrl: null, latestRelease: rel.data?.[0]?.tag_name ?? null,
  }
}

/** Para un host desconocido, prueba si responde como Gitea (sin token) y si no, como GitLab. */
async function detectProvider(host: string): Promise<RepoRemote['provider']> {
  const saved = await savedProviderFor(host)
  if (saved) return saved
  for (const [provider, url] of [['GITEA', `https://${host}/api/v1/version`], ['GITLAB', `https://${host}/api/v4/version`]] as const) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (res.ok || (provider === 'GITLAB' && res.status === 401)) return provider
    } catch { /* no responde */ }
  }
  return 'OTHER'
}

export async function syncRemote(r: RepoRemote): Promise<RepoRemote> {
  let provider = r.provider
  try {
    if (!r.path) throw new SyncError('No se reconoce el repositorio en la URL')
    if (provider === 'OTHER') provider = await detectProvider(r.host)
    if (provider === 'OTHER') throw new SyncError('Proveedor sin API conocida')
    const token = await tokenFor(r.host, provider)
    const data = provider === 'GITHUB' ? await github(r.path, token) : provider === 'GITLAB' ? await gitlab(r.host, r.path, token) : await gitea(r.host, r.path, token)
    return prisma.repoRemote.update({ where: { id: r.id }, data: { ...data, syncError: null, syncedAt: new Date() } })
  } catch (e) {
    const msg = e instanceof SyncError ? e.message : 'No se ha podido consultar el proveedor'
    // el proveedor detectado se guarda aunque falte el token, para saber qué token pedir
    return prisma.repoRemote.update({ where: { id: r.id }, data: { provider, syncError: msg, syncedAt: new Date() } })
  }
}

/** Sincroniza los remotos de unos proyectos (o de los activos y en mantenimiento), de 4 en 4. */
export async function syncRepos(opts: { projectIds?: string[]; activeOnly?: boolean } = {}) {
  const remotes = await prisma.repoRemote.findMany({
    where: {
      project: {
        excluded: false,
        ...(opts.projectIds ? { id: { in: opts.projectIds } } : {}),
        ...(opts.activeOnly ? { status: { in: ['ACTIVE', 'MAINTENANCE'] } } : {}),
      },
    },
  })
  let ok = 0
  for (let i = 0; i < remotes.length; i += 4) {
    const done = await Promise.all(remotes.slice(i, i + 4).map(syncRemote))
    ok += done.filter((d) => !d.syncError).length
  }
  return { total: remotes.length, ok }
}

/** Si hay sesión de `gh` en este equipo (se usa para GitHub cuando no hay token en Ajustes). */
export function ghSessionAvailable() {
  return ghCliToken() !== null
}
