/**
 * Estado git de una carpeta frente a sus remotos: ramas por delante/detrás, ramas solo locales o
 * solo remotas, stash y último fetch. Sin red salvo `gitFetch`, que nunca pregunta credenciales.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export type RepoProvider = 'GITHUB' | 'GITLAB' | 'GITEA' | 'OTHER'
export type GitRemote = { name: string; url: string; provider: RepoProvider; host: string; path: string | null }
export type BranchInfo = { name: string; upstream: string | null; ahead: number; behind: number; gone?: boolean; implicit?: boolean }
export type BranchState = { branches: BranchInfo[]; localOnly: string[]; remoteOnly: string[]; stash: number; aheadTotal: number; behindTotal: number; behindAuthors: string[]; rewritten: number; lastFetchAt?: Date }

// Sin preguntas: ni usuario/contraseña ni passphrase de SSH. Si hace falta, falla y se anota.
const NO_PROMPT = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=10' }

function git(dir: string, args: string[], timeout = 10000): string {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout, env: NO_PROMPT, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const stripCredentials = (u: string) => u.replace(/\/\/[^@/]+@/, '//')

export function providerOf(host: string): RepoProvider {
  if (host === 'github.com') return 'GITHUB'
  if (/gitlab/i.test(host)) return 'GITLAB'
  if (/gitea|codeberg/i.test(host)) return 'GITEA'
  return 'OTHER'
}

/** host y titular/repo de una URL https o ssh (git@host:titular/repo.git). */
export function parseRemoteUrl(url: string): { host: string; path: string | null } {
  const ssh = url.match(/^[\w.-]+@([^:]+):(.+?)(\.git)?\/?$/)
  if (ssh) return { host: ssh[1].toLowerCase(), path: ssh[2] }
  try {
    const u = new URL(url)
    return { host: u.hostname.toLowerCase(), path: u.pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\/$/, '') || null }
  } catch {
    return { host: url, path: null }
  }
}

export function readRemotes(dir: string): GitRemote[] {
  const out = new Map<string, GitRemote>()
  for (const line of git(dir, ['remote', '-v']).split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/)
    if (!m) continue
    const url = stripCredentials(m[2])
    const { host, path: p } = parseRemoteUrl(url)
    out.set(m[1], { name: m[1], url, host, path: p, provider: providerOf(host) })
  }
  return [...out.values()]
}

export function readBranchState(dir: string): BranchState {
  const branches: BranchInfo[] = []
  for (const line of git(dir, ['for-each-ref', '--format=%(refname:short)|%(upstream:short)|%(upstream:track)', 'refs/heads']).split('\n')) {
    if (!line) continue
    const [name, upstream, track] = line.split('|')
    const ahead = Number(track.match(/ahead (\d+)/)?.[1] ?? 0)
    const behind = Number(track.match(/behind (\d+)/)?.[1] ?? 0)
    branches.push({ name, upstream: upstream || null, ahead, behind, gone: track.includes('gone') || undefined })
  }
  // rama sin «seguir a» configurado pero con una remota del mismo nombre (push sin -u): se compara con ella
  const remotes = new Set(git(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes']).split('\n').filter(Boolean))
  const remoteNames = git(dir, ['remote']).split('\n').filter(Boolean).sort((a, b) => (a === 'origin' ? -1 : b === 'origin' ? 1 : 0))
  for (const b of branches) {
    if (b.upstream) continue
    const same = remoteNames.map((n) => `${n}/${b.name}`).find((r) => remotes.has(r))
    if (!same) continue
    const [ahead, behind] = git(dir, ['rev-list', '--left-right', '--count', `${b.name}...${same}`]).split(/\s+/).map(Number)
    Object.assign(b, { upstream: same, ahead: ahead || 0, behind: behind || 0, implicit: true })
  }
  const tracked = new Set(branches.map((b) => b.upstream).filter(Boolean))
  const remoteOnly = [...remotes].filter((r) => !r.endsWith('/HEAD') && r.includes('/') && !tracked.has(r))
  const stash = git(dir, ['stash', 'list']).split('\n').filter(Boolean).length
  const behind = currentBehind(dir, branches)
  const fetchHead = git(dir, ['rev-parse', '--git-path', 'FETCH_HEAD'])
  let lastFetchAt: Date | undefined
  try {
    if (fetchHead) lastFetchAt = fs.statSync(path.resolve(dir, fetchHead)).mtime
  } catch { /* nunca se ha hecho fetch */ }
  return {
    branches,
    // ramas sin rama remota cuyos commits no están en ningún remoto (las ya subidas o fusionadas no cuentan)
    localOnly: branches
      .filter((b) => !b.upstream || b.gone)
      .slice(0, 200)
      .filter((b) => Number(git(dir, ['rev-list', '--count', b.name, '--not', '--remotes']) || 0) > 0)
      .map((b) => b.name),
    remoteOnly: remoteOnly.slice(0, 50),
    stash,
    // commits locales que no están en ningún remoto (cada uno una vez, aunque esté en varias ramas)
    aheadTotal: Number(git(dir, ['rev-list', '--count', '--branches', '--not', '--remotes']) || 0),
    // lo que le falta a la rama actual respecto a la que sigue
    behindTotal: behind.count,
    behindAuthors: behind.authors,
    rewritten: behind.rewritten,
    lastFetchAt,
  }
}

/**
 * Lo que le falta a la rama actual respecto a la que sigue, sin contar los cambios que ya están en local
 * con otro hash (rebase, force-push), y quién los hizo. `rewritten` = commits remotos equivalentes a locales.
 */
function currentBehind(dir: string, branches: BranchInfo[]): { count: number; authors: string[]; rewritten: number } {
  const head = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const b = branches.find((x) => x.name === head)
  if (!b?.upstream || !b.behind) return { count: 0, authors: [], rewritten: 0 }
  const names = git(dir, ['log', '--cherry-pick', '--right-only', '--no-merges', '--format=%an', `HEAD...${b.upstream}`]).split('\n').filter(Boolean)
  const count = Number(git(dir, ['rev-list', '--count', '--cherry-pick', '--right-only', `HEAD...${b.upstream}`]) || 0)
  const byAuthor = new Map<string, number>()
  for (const n of names) byAuthor.set(n, (byAuthor.get(n) ?? 0) + 1)
  const authors = [...byAuthor].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([n, c]) => `${n} (${c})`)
  return { count, authors, rewritten: Math.max(0, b.behind - count) }
}

/** Trae las referencias de todos los remotos. Solo actualiza ramas remotas: nunca toca ramas locales ni ficheros. */
export function gitFetch(dir: string, timeout = 45000): { ok: boolean; error?: string } {
  try {
    execFileSync('git', ['-C', dir, 'fetch', '--all', '--prune', '--quiet'], { encoding: 'utf8', timeout, env: NO_PROMPT, stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error && 'stderr' in e ? String((e as { stderr?: unknown }).stderr ?? '') : ''
    if (/Authentication|Permission denied|could not read Username|publickey/i.test(msg)) return { ok: false, error: 'Sin credenciales para el remoto' }
    if (/Could not resolve host|timed out|Connection/i.test(msg)) return { ok: false, error: 'No se ha podido conectar con el remoto' }
    return { ok: false, error: 'No se ha podido traer de origin' }
  }
}
