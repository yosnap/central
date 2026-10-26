import { KeyRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { unlockedUntil } from '@/lib/unlock'
import { fmtDateTime } from '@/lib/format'
import { Card } from '@/components/ui'
import { SecretsPanel } from './secrets-panel'

/** Bloque Secretos de la ficha. Solo manda al navegador nombres y fechas, nunca valores. */
export async function SecretsSection({ projectId, slug }: { projectId: string; slug: string }) {
  const [secrets, backups, until] = await Promise.all([
    prisma.projectSecret.findMany({ where: { projectId }, select: { id: true, environment: true, key: true, notes: true, updatedAt: true }, orderBy: { key: 'asc' } }),
    prisma.envBackup.findMany({ where: { projectId }, select: { id: true, environment: true, keyCount: true, source: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    unlockedUntil(),
  ])
  const fileBase = slug.split('/').pop()?.replace(/[^A-Za-z0-9._-]/g, '-') || 'proyecto'
  return (
    <Card
      title="Secretos"
      note="Variables de entorno, claves y contraseñas por entorno. Se guardan cifradas; para verlas, copiarlas o descargarlas hay que escribir la contraseña de Central."
      action={<KeyRound className="size-6 text-muted" aria-hidden />}
      className="xl:col-span-3"
    >
      <SecretsPanel
        projectId={projectId}
        fileBase={fileBase}
        unlockedUntil={until}
        secrets={secrets.map((s) => ({ id: s.id, environment: s.environment, key: s.key, notes: s.notes, updated: fmtDateTime(s.updatedAt) }))}
        backups={backups.map((b) => ({ id: b.id, environment: b.environment, keyCount: b.keyCount, source: b.source, created: fmtDateTime(b.createdAt) }))}
      />
    </Card>
  )
}
