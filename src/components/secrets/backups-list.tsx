'use client'

import { Download, History } from 'lucide-react'
import { useState, useTransition } from 'react'
import { readBackup, restoreBackup } from '@/lib/secret-actions'
import { Button, Empty, Modal, Pill, Table, toast } from '@/components/ui'
import { downloadText } from './download'
import type { BackupRow } from './types'
import { useUnlock } from './unlock-provider'

const SOURCE = { import: 'Importación', restore: 'Antes de sustituir', manual: 'Copia manual', server: 'Servidor' } as Record<string, string>

export function BackupsList({ backups, fileBase }: { backups: BackupRow[]; fileBase: string }) {
  const { withUnlock } = useUnlock()
  const [restoring, setRestoring] = useState<BackupRow | null>(null)
  const [pending, start] = useTransition()

  if (!backups.length) return <Empty title="Sin copias en este entorno">Se crea una al importar un fichero o con «Copia ahora».</Empty>

  const download = async (b: BackupRow) => {
    const r = await withUnlock(() => readBackup(b.id))
    if (r) downloadText(`${fileBase}.${b.environment}.${b.created.replace(/[^0-9]/g, '')}.env`, r.content)
  }

  const restore = () =>
    start(async () => {
      if (!restoring) return
      const r = await withUnlock(() => restoreBackup(restoring.id))
      if (r) toast.success('Copia restaurada')
      setRestoring(null)
    })

  return (
    <>
      <Table head={['Fecha', 'Origen', 'Variables', '']}>
        {backups.map((b) => (
          <tr key={b.id}>
            <td className="whitespace-nowrap">{b.created}</td>
            <td><Pill>{SOURCE[b.source] ?? b.source}</Pill></td>
            <td className="num">{b.keyCount}</td>
            <td className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => download(b)}><Download className="size-4" aria-hidden />Descargar</Button>
                <Button variant="ghost" size="sm" onClick={() => setRestoring(b)}><History className="size-4" aria-hidden />Restaurar</Button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
      <Modal
        open={!!restoring}
        onOpenChange={(o) => !o && !pending && setRestoring(null)}
        size="sm"
        title="Restaurar esta copia"
        description={restoring ? `Los secretos de este entorno se sustituirán por los ${restoring.keyCount} de la copia del ${restoring.created}. Antes se guarda una copia de lo que hay ahora.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRestoring(null)} disabled={pending}>Cancelar</Button>
            <Button onClick={restore} disabled={pending} aria-busy={pending}>Restaurar</Button>
          </>
        }
      />
    </>
  )
}
