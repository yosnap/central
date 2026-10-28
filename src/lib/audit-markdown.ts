/** Las vulnerabilidades abiertas de un proyecto como issue de GitHub en Markdown, listo para pegar. */
import { compareVersions } from './audit'

type Row = { advisoryId: string; package: string; installed: string; fixedIn: string | null; severity: string; summary: string | null; url: string | null; dev: boolean; lockfile: string | null; ignoredAt: Date | null }

const SEVERITY: Record<string, string> = { critical: 'Crítica', high: 'Alta', moderate: 'Media', low: 'Baja', unknown: 'Sin valorar' }
const PLURAL: Record<string, string> = { critical: 'críticas', high: 'altas', moderate: 'medias', low: 'bajas', unknown: 'sin valorar' }
const ORDER = ['critical', 'high', 'moderate', 'low', 'unknown']
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()

export function auditIssueMarkdown(project: string, auditedAt: Date | null, advisories: Row[]) {
  const open = advisories.filter((a) => !a.ignoredAt).sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity) || a.package.localeCompare(b.package))
  // por paquete, la versión que corrige todos sus avisos
  const target = new Map<string, { installed: string; fixedIn: string | null; lockfile: string | null }>()
  for (const a of open) {
    const cur = target.get(a.package)
    if (!cur || (a.fixedIn && (!cur.fixedIn || compareVersions(a.fixedIn, cur.fixedIn) > 0))) target.set(a.package, { installed: a.installed, fixedIn: a.fixedIn ?? cur?.fixedIn ?? null, lockfile: a.lockfile })
  }
  const count = (s: string) => open.filter((a) => a.severity === s).length
  const resumen = ORDER.filter(count).map((s) => `${count(s)} ${count(s) === 1 ? SEVERITY[s].toLowerCase() : PLURAL[s]}`).join(', ')
  return [
    `# Seguridad: actualizar dependencias con vulnerabilidades (${project})`,
    '',
    `La auditoría de dependencias${auditedAt ? ` del ${auditedAt.toISOString().slice(0, 10)}` : ''} encontró ${open.length} ${open.length === 1 ? 'vulnerabilidad abierta' : 'vulnerabilidades abiertas'}${resumen ? ` (${resumen})` : ''}.`,
    '',
    '## Paquetes a actualizar',
    '',
    ...[...target].map(([name, t]) => `- [ ] \`${name}\` ${t.installed} → ${t.fixedIn ?? 'sin versión corregida todavía'}${t.lockfile ? ` (${t.lockfile})` : ''}`),
    '',
    '## Detalle',
    '',
    '| Gravedad | Paquete | Instalada | Corregida en | Aviso | Resumen |',
    '|---|---|---|---|---|---|',
    ...open.map((a) => `| ${SEVERITY[a.severity] ?? a.severity} | ${cell(a.package)}${a.dev ? ' (desarrollo)' : ''} | ${cell(a.installed)} | ${cell(a.fixedIn ?? '—')} | ${a.url ? `[${a.advisoryId}](${a.url})` : a.advisoryId} | ${cell(a.summary ?? '')} |`),
    '',
    '## Cómo cerrarlo',
    '',
    '1. Actualizar cada paquete a la versión corregida (o superior) y regenerar el lockfile.',
    '2. Pasar typecheck, tests y build.',
    '3. Desplegar y volver a auditar desde Central: el aviso desaparece solo.',
    '',
  ].join('\n')
}
