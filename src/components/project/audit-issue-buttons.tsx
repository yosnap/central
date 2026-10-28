'use client'

import { Copy, Download } from 'lucide-react'
import { Button, toast } from '@/components/ui'
import { downloadText } from '@/components/secrets/download'

/** Copia o descarga la auditoría como issue de GitHub en Markdown. */
export function AuditIssueButtons({ markdown, fileName }: { markdown: string; fileName: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(markdown)
    toast.success('Issue copiado: pégalo en GitHub')
  }
  return (
    <>
      <Button variant="secondary" onClick={copy}><Copy className="size-5" aria-hidden />Copiar como issue</Button>
      <Button variant="secondary" onClick={() => downloadText(fileName, markdown)}><Download className="size-5" aria-hidden />Descargar .md</Button>
    </>
  )
}
