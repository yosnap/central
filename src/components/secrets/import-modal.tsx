'use client'

import { FileUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { importEnv } from '@/lib/secret-actions'
import { envLabel } from '@/lib/environments'
import { ActionForm, Button, Checkbox, Field, Modal, Notice, SubmitButton, Textarea } from '@/components/ui'

/** Importa un fichero de variables pegado o elegido del disco. El fichero se lee en el navegador. */
export function ImportModal({ projectId, environment, open, onOpenChange }: { projectId: string; environment: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [content, setContent] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const done = () => {
    setContent('')
    onOpenChange(false)
  }
  return (
    <Modal open={open} onOpenChange={onOpenChange} size="lg" title={`Importar variables · ${envLabel(environment)}`} description="Pega el contenido del fichero o elígelo del disco. Se guarda cifrado y queda una copia con la fecha.">
      <ActionForm action={importEnv} success="Variables importadas" onSuccess={done} className="flex flex-col gap-5 pb-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="environment" value={environment} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => file.current?.click()}><FileUp className="size-5" aria-hidden />Elegir fichero</Button>
          <span className="text-sm text-muted">o pégalo abajo</span>
          <input
            ref={file}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (f) setContent(await f.text())
              e.target.value = ''
            }}
          />
        </div>
        <Field label="Contenido" htmlFor="env-content">
          <Textarea id="env-content" name="content" rows={12} required value={content} onChange={(e) => setContent(e.target.value)} placeholder={'DATABASE_URL=postgres://…\nAPI_KEY=…'} autoComplete="off" spellCheck={false} className="font-mono text-sm" />
        </Field>
        <Checkbox name="replace" label="Sustituir todos los secretos de este entorno" description="Si no lo marcas, solo se añaden o actualizan las variables del fichero. Antes de sustituir se guarda una copia de lo que hay." />
        <Notice tone="info">El contenido no se guarda nunca en claro: va cifrado en la base de datos.</Notice>
        <SubmitButton className="self-start" pendingText="Importando…">Importar</SubmitButton>
      </ActionForm>
    </Modal>
  )
}
