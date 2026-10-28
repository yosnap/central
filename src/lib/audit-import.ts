/**
 * Guarda el resultado de la auditoría de dependencias y decide qué avisa: lo que entra en Pendientes y pone en rojo
 * el monitor «dependencias» de Uptime Kuma (el criterio, ALERT_WHERE, vive en completeness.ts con el resto de avisos).
 */
import type { Prisma } from '@/generated/prisma/client'
import { compareVersions, type Finding } from './audit'
import { prisma } from './prisma'

/** Proyectos que se auditan y tienen monitor en Uptime Kuma: los que están en producción. */
export const AUDIT_WHERE = {
  excluded: false, goneAt: null, status: { not: 'ARCHIVED' },
  OR: [{ deployStatus: 'PRODUCTION' }, { environments: { has: 'production' } }, { services: { some: { environment: 'production' } } }],
} satisfies Prisma.ProjectWhereInput

/** Carpeta principal de cada proyecto que se audita. */
export async function auditTargets() {
  const projects = await prisma.project.findMany({
    where: AUDIT_WHERE,
    select: { id: true, name: true, locations: { where: { kind: 'MAIN', missing: false }, select: { path: true }, take: 1 } },
    orderBy: { name: 'asc' },
  })
  return projects.flatMap((p) => (p.locations[0] ? [{ projectId: p.id, name: p.name, path: p.locations[0].path }] : []))
}

// framework del escáner → producto de endoflife.date
const EOL_PRODUCTS: Record<string, string> = { 'Next.js': 'nextjs', Angular: 'angular', Nuxt: 'nuxt', Vue: 'vue', React: 'react', Svelte: 'svelte', Astro: 'astro' }
type Cycle = { cycle: string; eol: string | boolean; latest?: string }
const cycles = new Map<string, Promise<Cycle[] | null>>()

function loadCycles(product: string) {
  if (!cycles.has(product)) {
    cycles.set(product, fetch(`https://endoflife.date/api/${product}.json`, { signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? (r.json() as Promise<Cycle[]>) : null))
      .catch(() => null))
  }
  return cycles.get(product)!
}

const ended = (c: Cycle, today: string) => c.eol === true || (typeof c.eol === 'string' && c.eol <= today)

/** Aviso si la rama del framework («Next.js 14.2.3») ya no recibe parches de seguridad. */
export async function eolFinding(framework: string | null): Promise<Finding | null> {
  const m = framework?.match(/^(.+?)\s+v?(\d[\w.]*)/)
  const product = m && EOL_PRODUCTS[m[1]]
  if (!m || !product) return null
  const list = await loadCycles(product)
  if (!list?.length) return null
  const version = m[2]
  // la rama más concreta que encaja: «3.5» antes que «3»
  const cycle = list.filter((c) => version === c.cycle || version.startsWith(`${c.cycle}.`)).sort((a, b) => b.cycle.length - a.cycle.length)[0]
  const today = new Date().toISOString().slice(0, 10)
  if (!cycle || !ended(cycle, today)) return null
  const supported = list.filter((c) => !ended(c, today)).sort((a, b) => compareVersions(b.cycle, a.cycle))[0]
  return {
    advisoryId: `EOL:${product}-${cycle.cycle}`, package: m[1], ecosystem: 'framework', installed: version,
    fixedIn: supported?.latest ?? supported?.cycle ?? null, severity: 'high',
    summary: `La rama ${cycle.cycle} de ${m[1]} ya no recibe parches de seguridad${typeof cycle.eol === 'string' ? ` desde el ${cycle.eol}` : ''}`,
    url: `https://endoflife.date/${product}`, dev: false, lockfile: null,
  }
}

/** Guarda una auditoría: altas y actualizaciones de lo visto, y da por resuelto lo que ya no aparece. */
export async function importAudit(projectId: string, result: { findings: Finding[] } | { error: string }) {
  const now = new Date()
  if ('error' in result) {
    await prisma.project.update({ where: { id: projectId }, data: { auditError: result.error.slice(0, 500) } })
    return
  }
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { framework: true } })
  const eol = await eolFinding(p.framework)
  const findings = eol ? [...result.findings, eol] : result.findings
  const seen: string[] = []
  for (const f of findings) {
    const key = { projectId, advisoryId: f.advisoryId, package: f.package, installed: f.installed }
    const data = { ecosystem: f.ecosystem, fixedIn: f.fixedIn, severity: f.severity, summary: f.summary, url: f.url, dev: f.dev, lockfile: f.lockfile, lastSeenAt: now, resolvedAt: null }
    const row = await prisma.projectAdvisory.upsert({ where: { projectId_advisoryId_package_installed: key }, create: { ...key, ...data, firstSeenAt: now }, update: data })
    seen.push(row.id)
  }
  await prisma.projectAdvisory.updateMany({ where: { projectId, resolvedAt: null, id: { notIn: seen } }, data: { resolvedAt: now } })
  // lo resuelto hace más de 90 días ya no aporta nada
  await prisma.projectAdvisory.deleteMany({ where: { projectId, resolvedAt: { lt: new Date(now.getTime() - 90 * 86_400_000) } } })
  await prisma.project.update({ where: { id: projectId }, data: { auditedAt: now, auditError: null } })
}

/** Auditoría completa en este Mac (modo local): cada proyecto en producción desde su carpeta principal. */
export async function runAudit(log: (msg: string) => void = () => {}, ids?: string[]) {
  const { auditDir } = await import('./audit')
  const { existsSync } = await import('node:fs')
  const targets = (await auditTargets()).filter((t) => !ids || ids.includes(t.projectId))
  for (const t of targets) {
    if (!existsSync(t.path)) { log(`${t.name}: la carpeta no está (¿disco desconectado?)`); continue }
    try {
      const findings = await auditDir(t.path)
      await importAudit(t.projectId, { findings })
      log(`${t.name}: ${findings.length} vulnerabilidades`)
    } catch (e) {
      await importAudit(t.projectId, { error: (e as Error).message })
      log(`${t.name}: ${(e as Error).message}`)
    }
  }
  return targets.length
}
