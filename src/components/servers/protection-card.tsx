import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react'
import { Card } from '@/components/ui'
import { AuditIssueButtons } from '@/components/project/audit-issue-buttons'
import { protectionIssueMarkdown } from '@/lib/servers/protection-markdown'

type Check = { key: string; ok: boolean | null; detail: string | null; fix: string | null }

type Server = { name: string; host: string; sshPort: number; adminUser: string | null }

/** Comprobaciones de protección, con el comando para arreglar lo que falta y lo pendiente como issue para un agente o GitHub. */
export function ProtectionCard({ checks, server }: { checks: Check[]; server: Server }) {
  const sorted = [...checks].sort((a, b) => Number(a.ok === false ? 0 : a.ok === null ? 1 : 2) - Number(b.ok === false ? 0 : b.ok === null ? 1 : 2))
  return (
    <Card
      title="Protección"
      note="Lo que no se ha podido mirar suele necesitar la lectura de root (sudo de infobar)."
      action={checks.some((c) => c.ok === false) && (
        <div className="flex flex-wrap gap-2">
          <AuditIssueButtons markdown={protectionIssueMarkdown(server, checks)} fileName={`proteccion-${server.name.replace(/[^A-Za-z0-9._-]/g, '-')}.md`} />
        </div>
      )}
    >
      {checks.length === 0 ? <p className="text-muted">Aún sin lectura.</p> : (
        <ul className="divide-y divide-line">
          {sorted.map((c) => (
            <li key={c.key} className="flex gap-3 py-3">
              {c.ok === true ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-label="Bien" />
                : c.ok === false ? <XCircle className="mt-0.5 size-5 shrink-0 text-bad" aria-label="Falta" />
                  : <HelpCircle className="mt-0.5 size-5 shrink-0 text-muted" aria-label="Sin dato" />}
              <div className="min-w-0">
                <p className={c.ok === null ? 'text-muted' : ''}>{c.detail}{c.ok === null && ' · no se pudo mirar'}</p>
                {c.ok === false && c.fix && <code className="mt-1 block whitespace-pre-wrap break-words rounded-lg bg-ground px-3 py-2 text-sm">{c.fix}</code>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
