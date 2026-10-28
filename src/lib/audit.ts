/**
 * Auditoría de dependencias de una carpeta con osv-scanner (lee los lockfiles de npm/bun, composer, pip, go, cargo, pub…).
 * Sin dependencias de Next: la usan el script del Mac y el trabajador. Nunca abre .env ni ejecuta código del proyecto.
 */
import { spawn } from 'node:child_process'

export type Finding = {
  advisoryId: string
  package: string
  ecosystem: string
  installed: string
  fixedIn: string | null
  severity: Severity
  summary: string | null
  url: string | null
  dev: boolean
  lockfile: string | null // relativo a la carpeta del proyecto
}
export type Severity = 'critical' | 'high' | 'moderate' | 'low' | 'unknown'

type OsvEvent = { introduced?: string; fixed?: string }
type OsvVuln = {
  id: string
  aliases?: string[]
  summary?: string
  database_specific?: { severity?: string }
  affected?: { package?: { name?: string; ecosystem?: string }; ranges?: { events?: OsvEvent[] }[] }[]
}
type OsvPackage = {
  package: { name: string; version: string; ecosystem: string }
  dependency_groups?: string[]
  groups?: { ids: string[]; aliases?: string[]; max_severity?: string }[]
  vulnerabilities?: OsvVuln[]
}
type OsvOutput = { results?: { source?: { path?: string }; packages?: OsvPackage[] }[] }

const BIN = process.env.OSV_SCANNER_BIN ?? 'osv-scanner'
const TIMEOUT_MS = 5 * 60_000

/** Compara versiones por sus números (1.10.3 > 1.9.0); lo que no es número se ignora. */
export function compareVersions(a: string, b: string) {
  const pa = a.replace(/^v/, '').split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0)
  const pb = b.replace(/^v/, '').split(/[.+-]/).map((x) => Number.parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

function severityOf(v: OsvVuln, score?: string): Severity {
  const s = v.database_specific?.severity?.toLowerCase()
  if (s === 'critical' || s === 'high' || s === 'moderate' || s === 'low') return s
  if (s === 'medium') return 'moderate'
  const n = Number(score)
  if (!score || Number.isNaN(n)) return 'unknown'
  return n >= 9 ? 'critical' : n >= 7 ? 'high' : n >= 4 ? 'moderate' : 'low'
}

/** Primera versión corregida del tramo afectado en el que cae la versión instalada. */
function fixedFor(v: OsvVuln, name: string, installed: string): string | null {
  const candidates: string[] = []
  for (const a of v.affected ?? []) {
    if (a.package?.name && a.package.name !== name) continue
    for (const r of a.ranges ?? []) {
      const ev = r.events ?? []
      const intro = ev.find((e) => e.introduced)?.introduced ?? '0'
      const fixed = ev.find((e) => e.fixed)?.fixed
      if (fixed && compareVersions(installed, intro) >= 0 && compareVersions(installed, fixed) < 0) candidates.push(fixed)
    }
  }
  return candidates.sort(compareVersions)[0] ?? null
}

/** Convierte la salida JSON de osv-scanner en avisos: uno por grupo de alias (GHSA y su CVE cuentan una vez). */
export function parseOsv(out: OsvOutput, dir = ''): Finding[] {
  const found = new Map<string, Finding>()
  const base = dir.replace(/\/$/, '') + '/'
  for (const r of out.results ?? []) {
    const src = r.source?.path ?? null
    const lockfile = src ? (src.startsWith(base) ? src.slice(base.length) : src) : null
    for (const p of r.packages ?? []) {
      const { name, version, ecosystem } = p.package
      for (const g of p.groups ?? []) {
        const vulns = (p.vulnerabilities ?? []).filter((v) => g.ids.includes(v.id))
        const v = vulns.find((x) => x.id.startsWith('GHSA-')) ?? vulns[0]
        if (!v) continue
        const f: Finding = {
          advisoryId: v.id, package: name, ecosystem, installed: version,
          fixedIn: fixedFor(v, name, version), severity: severityOf(v, g.max_severity),
          summary: v.summary?.slice(0, 300) ?? null, url: `https://osv.dev/vulnerability/${encodeURIComponent(v.id)}`,
          dev: (p.dependency_groups ?? []).includes('dev'), lockfile,
        }
        found.set(`${f.advisoryId}|${name}|${version}`, f)
      }
    }
  }
  return [...found.values()]
}

/** Ejecuta osv-scanner sobre una carpeta. Código 1 = hay vulnerabilidades; 128 = no hay lockfiles (sin avisos). */
export function auditDir(dir: string): Promise<Finding[]> {
  return new Promise((resolve, reject) => {
    // sin carpetas ocultas (.claude/worktrees, .git…) ni node_modules: solo los lockfiles del propio proyecto
    const child = spawn(BIN, ['scan', 'source', '--format', 'json', '--recursive', '--x-exclude', 'r:(^|/)(\\.[^/]+|node_modules)$', dir], { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    const timer = setTimeout(() => child.kill('SIGTERM'), TIMEOUT_MS)
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { err += d })
    child.on('error', (e) => {
      clearTimeout(timer)
      reject(new Error((e as NodeJS.ErrnoException).code === 'ENOENT' ? 'Falta osv-scanner en el Mac: brew install osv-scanner' : e.message))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 128) return resolve([])
      if (code !== 0 && code !== 1) return reject(new Error(`osv-scanner terminó con código ${code}: ${err.trim().split('\n').pop() ?? ''}`.slice(0, 500)))
      try { resolve(parseOsv(JSON.parse(out) as OsvOutput, dir)) } catch { reject(new Error('osv-scanner no ha devuelto JSON válido')) }
    })
  })
}
