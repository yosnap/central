import { auditNow, ignoreAdvisory, restoreAdvisory } from '@/lib/audit-actions'
import { ActionForm, Card, ConfirmAction, Empty, Notice, Pill, SubmitButton, Table, type Tone } from '@/components/ui'
import { ago } from '@/lib/format'
import { auditIssueMarkdown } from '@/lib/audit-markdown'
import { AuditIssueButtons } from './audit-issue-buttons'

type Advisory = {
  id: string; advisoryId: string; package: string; ecosystem: string; installed: string; fixedIn: string | null
  severity: string; summary: string | null; url: string | null; dev: boolean; lockfile: string | null; firstSeenAt: Date; ignoredAt: Date | null
}

const SEVERITY: Record<string, { label: string; tone: Tone }> = {
  critical: { label: 'Crítica', tone: 'bad' }, high: { label: 'Alta', tone: 'bad' }, moderate: { label: 'Media', tone: 'warn' },
  low: { label: 'Baja', tone: 'muted' }, unknown: { label: 'Sin valorar', tone: 'muted' },
}

/** Vulnerabilidades de las dependencias (osv-scanner) y rama del framework sin soporte. Solo en proyectos en producción. */
export function SecurityCard({ projectId, projectName, auditedAt, auditError, advisories }: { projectId: string; projectName: string; auditedAt: Date | null; auditError: string | null; advisories: Advisory[] }) {
  return (
    <Card
      title="Seguridad"
      note={`Vulnerabilidades de las dependencias y soporte del framework. Las críticas y altas con versión corregida avisan en Pendientes y en Uptime Kuma. ${auditedAt ? `Última auditoría ${ago(auditedAt)}.` : 'Todavía sin auditar.'}`}
      className="xl:col-span-3"
    >
      {auditError && <Notice tone="warn" title="La última auditoría ha fallado" className="mb-5">{auditError}</Notice>}
      {advisories.length === 0 ? (
        <Empty title={auditedAt ? 'Sin vulnerabilidades conocidas' : 'Sin auditar todavía'}>
          {auditedAt ? 'Las dependencias de sus lockfiles no tienen avisos abiertos.' : 'Se audita una vez al día; puedes hacerlo ahora.'}
        </Empty>
      ) : (
        <Table head={['Paquete', 'Instalada', 'Corregida en', 'Gravedad', 'Aviso', '']}>
          {advisories.map((a) => {
            const sev = SEVERITY[a.severity] ?? SEVERITY.unknown
            return (
              <tr key={a.id} className={a.ignoredAt ? 'opacity-60' : undefined}>
                <td>
                  <span className="font-semibold">{a.package}</span>
                  <span className="ml-2 text-sm text-muted">{a.lockfile ?? a.ecosystem}{a.dev ? ' · desarrollo' : ''}</span>
                </td>
                <td className="num">{a.installed}</td>
                <td className="num">{a.fixedIn ?? '—'}</td>
                <td><Pill tone={a.ignoredAt ? 'muted' : sev.tone}>{a.ignoredAt ? 'Ignorada' : sev.label}</Pill></td>
                <td className="min-w-64">
                  {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-strong hover:underline">{a.advisoryId}</a> : a.advisoryId}
                  {a.summary && <p className="text-sm text-muted">{a.summary}</p>}
                  <p className="text-sm text-muted">Visto {ago(a.firstSeenAt)}</p>
                </td>
                <td className="text-right">
                  {a.ignoredAt ? (
                    <ActionForm action={restoreAdvisory} success="Aviso restaurado"><input type="hidden" name="id" value={a.id} /><SubmitButton variant="ghost" size="sm">Restaurar</SubmitButton></ActionForm>
                  ) : (
                    <ConfirmAction action={ignoreAdvisory} fields={{ id: a.id }} title="Ignorar este aviso" description={`${a.advisoryId} en ${a.package} ${a.installed} seguirá en la lista, pero ya no avisará en Pendientes ni en Uptime Kuma.`} confirmLabel="Ignorar" success="Aviso ignorado">Ignorar</ConfirmAction>
                  )}
                </td>
              </tr>
            )
          })}
        </Table>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <ActionForm action={auditNow} success="Auditoría hecha">
          <input type="hidden" name="id" value={projectId} />
          <SubmitButton variant="secondary" pendingText="Auditando…">Auditar ahora</SubmitButton>
        </ActionForm>
        {advisories.some((a) => !a.ignoredAt) && (
          <AuditIssueButtons markdown={auditIssueMarkdown(projectName, auditedAt, advisories)} fileName={`seguridad-${projectName.replace(/[^A-Za-z0-9._-]/g, '-')}.md`} />
        )}
      </div>
    </Card>
  )
}
