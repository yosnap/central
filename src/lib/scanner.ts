/**
 * Escáner de carpetas de proyectos.
 * Recorre una o varias carpetas raíz, detecta proyectos (git, package.json, composer, python, go, WordPress…),
 * extrae versión, stack, framework y estado git, y los agrupa: worktrees y copias del mismo repo
 * quedan como ubicaciones de un único proyecto.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { gitFetch, readBranchState, readRemotes, type BranchState, type GitRemote } from './git-state'
import { detectDomains, detectFromSubprojects, detectType, subDirs, type Platform, type ProjectType } from './project-type'
import { localInfo, type LocalInfo } from './local-env'
import { compareVersions } from './version'

export type Kind = 'CLIENT' | 'OWN' | 'TRAINING' | 'EXPERIMENT'
export type Status = 'ACTIVE' | 'MAINTENANCE' | 'DORMANT' | 'ARCHIVED'
export type LocKind = 'MAIN' | 'WORKTREE' | 'COPY' | 'BACKUP'
/** git fetch antes de leer el estado: nunca, solo con actividad en los últimos 6 meses, o siempre. */
export type FetchMode = 'none' | 'active' | 'all'

export interface FoundDir {
  absPath: string      // ruta real tal como se guardará (ya mapeada)
  fsPath: string       // ruta en el sistema donde corre el escáner
  rel: string          // relativa a la raíz
  root: string
  name: string
  stack: string[]
  framework?: string
  version?: string
  description?: string
  hasClaudeMd: boolean
  isGit: boolean
  isWorktree: boolean
  worktreeOf?: string  // ruta (mapeada) del repo principal
  branch?: string
  lastCommitAt?: Date
  lastCommitMsg?: string
  commitCount?: number
  uncommitted?: number
  untracked?: number
  remote?: string
  modifiedAt?: Date
  suggestedType?: ProjectType
  suggestedPlatform?: Platform
  domains: string[]    // dominios leídos de la configuración (nunca de .env)
  remotes: GitRemote[]
  git?: BranchState    // ramas frente a origin, solo en la carpeta principal (no en worktrees)
  fetched?: boolean    // se intentó git fetch en este escaneo
  fetchError?: string
  merged?: boolean     // worktree cuya rama ya está fusionada en la del principal
  missing?: boolean    // worktree que git apunta pero ya no existe
  local?: LocalInfo    // compose, URL de desarrollo y nombres de ficheros de variables (no se abren)
  versionFile?: string // package.json del que sale la versión (raíz o subproyecto: apps/web/package.json…)
  branchVersions?: Record<string, string> // versión en cada rama de integración, leída de git sin cambiar de rama
  codeVersion?: string // la de la rama de integración (develop, si no main/master); si no hay, la de la carpeta
}

export interface ScannedProject {
  slug: string
  name: string
  kind: Kind
  status: Status
  clientName?: string
  main: FoundDir
  locations: { dir: FoundDir; kind: LocKind }[]
  lastActivityAt?: Date
  /** El grupo solo tiene worktrees (su repositorio principal está en otra raíz): no aporta datos del proyecto. */
  onlyWorktrees: boolean
}

const MARKERS = ['package.json', 'composer.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'wp-config.php', 'Cargo.toml', 'pubspec.yaml', 'angular.json', 'SKILL.md']
const SKIP = new Set(['node_modules', 'vendor', '.next', 'dist', 'build', '.git', '.venv', 'venv', '__pycache__', '.nuxt', '.astro', '.turbo', 'wp-content', 'wp-includes', 'wp-admin', '.cache', 'coverage', 'out', 'target', '.svelte-kit', 'storage', 'public'])
// Carpetas que nunca se abren (credenciales)
const SECRET = /(claves|api ?keys|secret|secrets|proxies|credentials|\.ssh)/i
const GENERIC = new Set(['wordpress', 'public_html', 'web', 'scripts', 'ts', 'api', 'src', 'app', 'files', 'origen'])
const MY_OWNERS = ['yosnap', 'codeia-academy', 'equipocaptaru', 'crmdev-tech', 'coetools', 'imagina-formacion', 'artilabs-ai', 'git.rcassociats.com', 'gitlab.blocknovas.com']

const FRAMEWORKS: [string, string][] = [['next', 'Next.js'], ['@angular/core', 'Angular'], ['astro', 'Astro'], ['nuxt', 'Nuxt'], ['svelte', 'Svelte'], ['vue', 'Vue'], ['react', 'React']]
const STACK: [string, string][] = [
  ['next', 'Next.js'], ['@angular/core', 'Angular'], ['astro', 'Astro'], ['nuxt', 'Nuxt'], ['vue', 'Vue'], ['react', 'React'], ['svelte', 'Svelte'],
  ['@nestjs/core', 'NestJS'], ['express', 'Express'], ['hono', 'Hono'], ['fastify', 'Fastify'],
  ['prisma', 'Prisma'], ['@prisma/client', 'Prisma'], ['drizzle-orm', 'Drizzle'], ['mongoose', 'MongoDB'], ['@supabase/supabase-js', 'Supabase'],
  ['payload', 'Payload'], ['tailwindcss', 'Tailwind'], ['electron', 'Electron'], ['@tauri-apps/api', 'Tauri'], ['expo', 'Expo'], ['react-native', 'React Native'],
  ['@modelcontextprotocol/sdk', 'MCP'], ['langchain', 'LangChain'], ['@langchain/core', 'LangChain'], ['ai', 'Vercel AI SDK'], ['stripe', 'Stripe'], ['vite', 'Vite'], ['typescript', 'TypeScript'],
]

// la rama que se despliega o se integra, por orden: la local manda sobre la remota si está al día de ella
const INTEGRATION = ['develop', 'origin/develop', 'main', 'origin/main', 'master', 'origin/master']

/** Versión del package.json en cada rama de integración, sin cambiar de rama (git show rama:fichero). */
function branchVersions(dir: string, file: string) {
  const out: Record<string, string> = {}
  for (const ref of INTEGRATION) {
    const text = git(dir, 'show', `${ref}:${file}`)
    if (!text) continue
    try { const v = JSON.parse(text).version; if (typeof v === 'string' && v && v !== '0.0.0') out[ref] = v } catch { /* no es JSON */ }
  }
  // si la remota va por delante de la local (sin hacer pull), cuenta la remota
  for (const b of ['develop', 'main', 'master']) {
    const local = out[b], remote = out[`origin/${b}`]
    if (local && remote && (compareVersions(remote, local) ?? 0) > 0) out[b] = remote
  }
  return out
}

function git(dir: string, ...args: string[]): string {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

/** Si un remoto (url o titular/repo) es de una cuenta u organización propia. */
export function isOwnRemote(r: string): boolean {
  const key = remoteKey(r)
  return MY_OWNERS.some((o) => key.includes(o))
}

function cleanRemote(r: string): string {
  return r.replace(/\/\/[^@/]+@/, '//')
}

/** github.com/owner/repo en minúsculas, sin .git, para agrupar. */
export function remoteKey(r: string): string {
  return r.toLowerCase().replace(/^git@([^:]+):/, '$1/').replace(/^https?:\/\//, '').replace(/\/\/[^@/]+@/, '').replace(/\.git$/, '').replace(/\/$/, '')
}

type PkgInfo = { dir: string; pkg: Parameters<typeof detectType>[2]; version?: string; description?: string; stack: string[]; framework?: string }

/** Versión, descripción, stack y framework de un package.json. */
function pkgInfo(dir: string): PkgInfo | null {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    const deps: Record<string, string> = { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) }
    const stack: string[] = []
    for (const [k, v] of STACK) if (deps[k] && !stack.includes(v)) stack.push(v)
    const fw = FRAMEWORKS.find(([k]) => deps[k])
    return {
      dir, pkg: p, stack,
      version: typeof p.version === 'string' && p.version !== '0.0.0' ? p.version : undefined,
      description: typeof p.description === 'string' ? p.description : undefined,
      framework: fw ? `${fw[1]} ${String(deps[fw[0]]).replace(/^[\^~]/, '')}` : undefined,
    }
  } catch {
    return null
  }
}

const SEMVER = /\bv?(\d+\.\d+\.\d+(?:-[\w.]+)?)\b/

/** Versión de proyectos sin package.json en la raíz: VERSION, pyproject.toml, Cargo.toml o la primera del CHANGELOG. */
function versionFromFiles(dir: string, entries: Set<string>): string | undefined {
  const head = (f: string, n = 4096) => {
    try { return fs.readFileSync(path.join(dir, f), 'utf8').slice(0, n) } catch { return '' }
  }
  if (entries.has('VERSION')) {
    const v = head('VERSION', 64).trim().match(SEMVER)?.[1]
    if (v) return v
  }
  for (const f of ['pyproject.toml', 'Cargo.toml']) {
    if (!entries.has(f)) continue
    const v = head(f).match(/^version\s*=\s*["']([^"']+)["']/m)?.[1]
    if (v) return v
  }
  const changelog = [...entries].find((f) => /^(CHANGELOG|HISTORY)(\.md)?$/i.test(f))
  if (changelog) {
    // primera cabecera con versión: "## 0.5.1 — fecha", "## [1.2.0]", "# v2.0.0"
    const m = head(changelog, 16384).match(/^#{1,3}\s*\[?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/m)
    if (m) return m[1]
  }
  return undefined
}

function analyze(fsDir: string, root: string, mapPath: (p: string) => string, fetch: FetchMode = 'none'): FoundDir {
  const entries = new Set(fs.readdirSync(fsDir))
  const rel = path.relative(root, fsDir)
  const d: FoundDir = { absPath: mapPath(fsDir), fsPath: fsDir, rel, root, name: path.basename(fsDir), stack: [], hasClaudeMd: entries.has('CLAUDE.md') || entries.has('.claude'), isGit: false, isWorktree: false, domains: [], remotes: [] }

  let pkg: Parameters<typeof detectType>[2] = null
  if (entries.has('package.json')) {
    const info = pkgInfo(fsDir)
    if (info) {
      pkg = info.pkg
      d.version = info.version
      if (info.version) d.versionFile = 'package.json'
      d.description = info.description
      d.stack.push(...info.stack)
      d.framework = info.framework
    }
  }
  // Monorepos (apps/web, frontend, backend…): versión, framework y stack de los subproyectos si la raíz no los da
  if (!d.version || !d.framework) {
    const subs = subDirs(fsDir).map(pkgInfo).filter((x): x is PkgInfo => !!x)
    const main = subs.find((s) => s.framework) ?? subs[0]
    const withVersion = subs.find((s) => /\/(web|frontend|app|client)$/.test(s.dir) && s.version) ?? (main?.version ? main : undefined)
    if (!d.version && withVersion) { d.version = withVersion.version; d.versionFile = path.join(path.relative(fsDir, withVersion.dir), 'package.json') }
    d.framework ??= main?.framework
    for (const s of subs) for (const t of s.stack) if (!d.stack.includes(t)) d.stack.push(t)
  }
  d.version ??= versionFromFiles(fsDir, entries)
  // scripts dev de la raíz y de sus subproyectos (frontend/, web/, backend/…): la URL de desarrollo sale del frontend
  const scriptsOf = (x: unknown) => (x as { scripts?: Record<string, string> } | null)?.scripts
  const subScripts = subDirs(fsDir).map(pkgInfo).filter((x): x is PkgInfo => !!x).map((x) => ({ dir: path.basename(x.dir), scripts: scriptsOf(x.pkg) }))
  d.local = localInfo(fsDir, entries, [{ dir: '', scripts: scriptsOf(pkg) }, ...subScripts])
  if (entries.has('composer.json')) d.stack.push('PHP')
  if (entries.has('wp-config.php') || entries.has('wp-content')) d.stack.push('WordPress')
  if (entries.has('pyproject.toml') || entries.has('requirements.txt')) d.stack.push('Python')
  if (entries.has('go.mod')) d.stack.push('Go')
  if (entries.has('Cargo.toml')) d.stack.push('Rust')
  if (entries.has('pubspec.yaml')) d.stack.push('Flutter')
  if (entries.has('Dockerfile') || [...entries].some((f) => f.startsWith('docker-compose') || f.startsWith('compose.'))) d.stack.push('Docker')
  d.stack = [...new Set(d.stack)]
  const t = detectType(fsDir, entries, pkg)
  d.suggestedType = t.type
  d.suggestedPlatform = t.platform
  d.domains = detectDomains(fsDir, entries, pkg)
  if (!d.suggestedType) {
    const sub = detectFromSubprojects(fsDir)
    d.suggestedType = sub.type
    d.suggestedPlatform = sub.platform
    d.domains = [...new Set([...d.domains, ...sub.domains])].slice(0, 10)
  }

  if (entries.has('.git')) {
    d.isGit = true
    const gp = path.join(fsDir, '.git')
    if (fs.statSync(gp).isFile()) {
      // worktree: ".git" es un fichero "gitdir: /ruta/repo/.git/worktrees/nombre"
      d.isWorktree = true
      const m = fs.readFileSync(gp, 'utf8').match(/gitdir:\s*(.+)/)
      if (m) d.worktreeOf = m[1].trim().split('/.git/worktrees/')[0]
    }
    d.branch = git(fsDir, 'rev-parse', '--abbrev-ref', 'HEAD') || undefined
    const lc = git(fsDir, 'log', '-1', '--format=%cI')
    d.lastCommitAt = lc ? new Date(lc) : undefined
    d.lastCommitMsg = git(fsDir, 'log', '-1', '--format=%s').slice(0, 200) || undefined
    const cc = git(fsDir, 'rev-list', '--count', 'HEAD')
    d.commitCount = cc ? Number(cc) : undefined
    const r = git(fsDir, 'remote', 'get-url', 'origin')
    d.remote = r ? cleanRemote(r) : undefined
    const st = git(fsDir, 'status', '--porcelain')
    // cambios en ficheros versionados por un lado; ficheros nuevos que git no sigue («??») por otro
    const lines = st ? st.split('\n') : []
    d.uncommitted = d.lastCommitAt ? lines.filter((l) => !l.startsWith('??')).length : undefined
    d.untracked = d.lastCommitAt ? lines.filter((l) => l.startsWith('??')).length : undefined
    if (!d.isWorktree) {
      d.remotes = readRemotes(fsDir)
      const recent = d.lastCommitAt && Date.now() - d.lastCommitAt.getTime() < 183 * 864e5
      if (d.remotes.length && (fetch === 'all' || (fetch === 'active' && recent))) {
        const r = gitFetch(fsDir)
        d.fetched = true
        if (!r.ok) d.fetchError = r.error
      }
      d.git = readBranchState(fsDir)
      if (d.versionFile) {
        d.branchVersions = branchVersions(fsDir, d.versionFile)
        d.codeVersion = INTEGRATION.map((b) => d.branchVersions![b]).find(Boolean)
      }
    }
  }

  let mt = 0
  for (const f of entries) {
    if (SKIP.has(f)) continue
    try { mt = Math.max(mt, fs.statSync(path.join(fsDir, f)).mtimeMs) } catch { /* sin acceso */ }
  }
  d.modifiedAt = mt ? new Date(mt) : undefined
  return d
}

export function findProjects(root: string, opts: { maxDepth?: number; mapPath?: (p: string) => string; fetch?: FetchMode } = {}): FoundDir[] {
  const maxDepth = opts.maxDepth ?? 5
  const mapPath = opts.mapPath ?? ((p) => p)
  const out: FoundDir[] = []
  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return
    let entries: string[]
    try { entries = fs.readdirSync(dir) } catch { return }
    if (depth > 0 && (entries.includes('.git') || MARKERS.some((m) => entries.includes(m)))) {
      out.push(analyze(dir, root, mapPath, opts.fetch))
      return
    }
    for (const e of entries.sort()) {
      if (SKIP.has(e) || e.startsWith('.') || SECRET.test(e)) continue
      const p = path.join(dir, e)
      try {
        const st = fs.lstatSync(p)
        if (st.isDirectory() && !st.isSymbolicLink()) walk(p, depth + 1)
      } catch { /* sin acceso */ }
    }
  }
  walk(root, 0)
  out.push(...addGitWorktrees(out, root, mapPath))
  return out
}

interface GitWorktree { path: string; branch?: string; prunable: boolean }

/** Worktrees de un repositorio según git (sin el propio repositorio). */
function listWorktrees(repo: string): GitWorktree[] {
  const list: GitWorktree[] = []
  for (const block of git(repo, 'worktree', 'list', '--porcelain').split(/\n\n+/)) {
    const lines = block.split('\n')
    const p = lines.find((l) => l.startsWith('worktree '))?.slice(9)
    if (!p) continue
    const branch = lines.find((l) => l.startsWith('branch '))?.slice(7).replace(/^refs\/heads\//, '')
    list.push({ path: p, branch, prunable: lines.some((l) => l.startsWith('prunable')) })
  }
  return list.slice(1)
}

/**
 * Completa los worktrees que git conoce y el recorrido no encontró: fuera de la raíz (p. ej. Orca)
 * o en carpetas ocultas (.claude/worktrees). Marca los fusionados y los que ya no existen.
 */
function addGitWorktrees(found: FoundDir[], root: string, mapPath: (p: string) => string): FoundDir[] {
  const known = new Map(found.map((d) => [d.fsPath, d]))
  const extra: FoundDir[] = []
  for (const main of [...found]) {
    if (!main.isGit || main.isWorktree) continue
    const worktrees = listWorktrees(main.fsPath)
    if (!worktrees.length) continue
    const merged = new Set(git(main.fsPath, 'branch', '--merged', 'HEAD', '--format=%(refname:short)').split('\n').filter(Boolean))
    for (const w of worktrees) {
      if (SECRET.test(w.path)) continue
      let d = known.get(w.path)
      if (!d) {
        d = !w.prunable && fs.existsSync(w.path)
          ? analyze(w.path, root, mapPath)
          : { absPath: mapPath(w.path), fsPath: w.path, rel: path.relative(root, w.path), root, name: path.basename(w.path), stack: [], domains: [], remotes: [], hasClaudeMd: false, isGit: true, isWorktree: true, branch: w.branch, missing: true }
        known.set(w.path, d)
        extra.push(d)
      }
      d.isWorktree = true
      d.worktreeOf = main.absPath
      const branch = d.branch ?? w.branch
      if (branch && branch !== main.branch) d.merged = merged.has(branch)
    }
  }
  return extra
}

const BACKUP_RE = /(backup|_old|old_|corrupted|copia|original|\btemp\b|_mal$| --$| v1(\.\d+)?$|_\d{8}|public_html\d|public_html_)/i

function isBackup(d: FoundDir): boolean {
  return BACKUP_RE.test(d.name) || /\/(backup|backups|Backup Web realizadas)\//i.test('/' + d.rel + '/')
}

function lastActivity(d: FoundDir): Date | undefined {
  return d.lastCommitAt ?? d.modifiedAt
}

function classifyKind(d: FoundDir, top: string): Kind {
  const p = '/' + d.rel + '/'
  const owner = d.remote ? remoteKey(d.remote) : ''
  const thirdParty = !!owner && !MY_OWNERS.some((o) => owner.includes(o))
  if (top === 'Clientes' || top === 'Trabajo') return /\/Proyectos test\//i.test(p) ? 'EXPERIMENT' : 'CLIENT'
  if (/\/(Sesi[oó]n|Sesiion|Workshop|Cursos|Formaci[oó]n|Proyectos para formaci[oó]n|Testing )/i.test(p)) return 'TRAINING'
  if (thirdParty) return 'EXPERIMENT'
  if (/\/(Test Dev|Tests y demos|test-ck|ck-test|test-all-agents|tests?)\//i.test(p) || /^test/i.test(d.name)) return 'EXPERIMENT'
  return 'OWN'
}

function clientFrom(d: FoundDir, top: string): string | undefined {
  if (top !== 'Clientes' && top !== 'Trabajo') return undefined
  const c = d.rel.split(path.sep)[1]?.replace(/\\/g, '').trim()
  if (!c || /^Proyectos test$/i.test(c)) return undefined
  return c
}

function displayName(d: FoundDir): string {
  if (d.remote) {
    const last = remoteKey(d.remote).split('/').pop()
    if (last) return last
  }
  if (GENERIC.has(d.name.toLowerCase())) {
    const parts = d.rel.split(path.sep)
    return `${parts[parts.length - 2] ?? ''} / ${d.name}`.trim()
  }
  return d.name
}

function statusFrom(main: FoundDir, mainKind: LocKind, now: Date): Status {
  if (mainKind === 'BACKUP') return 'ARCHIVED'
  const a = lastActivity(main)
  if (!a) return 'DORMANT'
  const days = (now.getTime() - a.getTime()) / 864e5
  if (days <= 30) return 'ACTIVE'
  if (days <= 183) return 'MAINTENANCE'
  return 'DORMANT'
}

/** Agrupa carpetas en proyectos: mismo remoto o worktree del mismo repo → un proyecto. */
export function groupProjects(dirs: FoundDir[], now = new Date()): ScannedProject[] {
  const byPath = new Map(dirs.map((d) => [d.absPath, d]))
  const keyOf = new Map<FoundDir, string>()
  for (const d of dirs) {
    if (d.isWorktree && d.worktreeOf) {
      const main = byPath.get(d.worktreeOf)
      // el worktree comparte remoto con su principal, aunque el principal no esté en este escaneo
      const remote = main?.remote ?? d.remote
      if (remote) { keyOf.set(d, 'git:' + remoteKey(remote)); continue }
      keyOf.set(d, 'local:' + d.worktreeOf); continue
    }
    if (d.remote) { keyOf.set(d, 'git:' + remoteKey(d.remote)); continue }
    keyOf.set(d, 'local:' + d.absPath)
  }
  // worktrees sin .git legible: "<repo>/worktrees/<repo>-xxx" o "<repo>-<rama>" junto al repo
  for (const d of dirs) {
    const k = keyOf.get(d)!
    if (!k.startsWith('local:') || d.remote) continue
    const parent = path.dirname(d.absPath)
    const sibling = dirs.find((o) => o !== d && keyOf.get(o)!.startsWith('git:') && (path.dirname(o.absPath) === parent || path.dirname(o.absPath) === path.dirname(parent)) && d.name.startsWith(o.name + '-'))
    if (sibling) keyOf.set(d, keyOf.get(sibling)!)
  }

  const groups = new Map<string, FoundDir[]>()
  for (const d of dirs) {
    const k = keyOf.get(d)!
    groups.set(k, [...(groups.get(k) ?? []), d])
  }

  const projects: ScannedProject[] = []
  for (const [key, members] of groups) {
    const rank = (d: FoundDir) => (d.isWorktree || /\/worktrees\//.test(d.absPath) ? 2 : 0) + (isBackup(d) ? 4 : 0)
    const sorted = [...members].sort((a, b) => rank(a) - rank(b) || (lastActivity(b)?.getTime() ?? 0) - (lastActivity(a)?.getTime() ?? 0))
    const main = sorted[0]
    const onlyWorktrees = members.every((d) => d.isWorktree)
    const locKind = (d: FoundDir): LocKind => d === main && !onlyWorktrees ? (isBackup(d) ? 'BACKUP' : 'MAIN') : d.isWorktree || /\/worktrees\//.test(d.absPath) ? 'WORKTREE' : isBackup(d) ? 'BACKUP' : 'COPY'
    const top = main.rel.split(path.sep)[0]
    const acts = members.map(lastActivity).filter(Boolean) as Date[]
    const lastAct = acts.length ? new Date(Math.max(...acts.map((x) => x.getTime()))) : undefined
    const status = statusFrom({ ...main, lastCommitAt: lastAct ?? main.lastCommitAt }, locKind(main), now)
    projects.push({
      slug: key.startsWith('git:') ? key.slice(4) : 'local/' + main.rel.replace(/\\/g, '/').toLowerCase(),
      name: displayName(main),
      kind: classifyKind(main, top),
      status,
      clientName: clientFrom(main, top),
      main,
      locations: sorted.map((d) => ({ dir: d, kind: locKind(d) })),
      lastActivityAt: lastAct,
      onlyWorktrees,
    })
  }
  return projects.sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v)
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(projects: ScannedProject[]): string {
  const head = ['nombre', 'tipo', 'estado', 'cliente', 'version', 'framework', 'stack', 'ultima_actividad', 'ultimo_commit', 'sin_commit', 'repo', 'ubicacion_principal', 'otras_ubicaciones']
  const rows = projects.map((p) => [
    p.name, p.kind, p.status, p.clientName, p.main.version, p.main.framework, p.main.stack.join(' '), p.lastActivityAt, p.main.lastCommitMsg, p.main.uncommitted,
    p.main.remote, p.main.absPath, p.locations.filter((l) => l.dir !== p.main).map((l) => `${l.kind}:${l.dir.absPath}`).join(' | '),
  ])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}
