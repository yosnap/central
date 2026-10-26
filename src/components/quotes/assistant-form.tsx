'use client'

import { Paperclip, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { sendToAssistant } from '@/lib/assistant-actions'
import { ActionForm, Button, Pill, SubmitButton, Textarea } from '@/components/ui'

function Thinking() {
  const { pending } = useFormStatus()
  return pending ? <p className="text-sm text-muted">El asistente está leyendo y preparando la propuesta. Puede tardar un par de minutos; no cierres la página.</p> : null
}

/** Mensaje para el asistente con documentos adjuntos (PDF, Word o texto). */
export function AssistantForm({ quoteId, first }: { quoteId: string; first: boolean }) {
  const form = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const sync = (next: File[]) => {
    const dt = new DataTransfer()
    next.forEach((f) => dt.items.add(f))
    if (input.current) input.current.files = dt.files
    setFiles(next)
  }
  return (
    <ActionForm ref={form} action={sendToAssistant} error="El asistente no ha podido responder" className="flex flex-col gap-3"
      onSuccess={() => { form.current?.reset(); sync([]) }}>
      <input type="hidden" name="quoteId" value={quoteId} />
      <Textarea name="text" rows={first ? 5 : 3} aria-label="Mensaje para el asistente"
        placeholder={first ? 'Pega aquí el listado de tareas o cuéntale el proyecto, y adjunta los documentos que te haya pasado el cliente…' : 'Pídele cambios: «la fase 3 a precio cerrado», «añade mantenimiento anual», «forma de pago por fases»…'}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.current?.requestSubmit() }} />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <Pill key={`${f.name}-${i}`} tone="accent">
              {f.name}
              <button type="button" className="cursor-pointer" aria-label={`Quitar ${f.name}`} onClick={() => sync(files.filter((_, j) => j !== i))}><X className="size-3.5" aria-hidden /></button>
            </Pill>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => input.current?.click()}><Paperclip className="size-5" aria-hidden />Adjuntar documentos</Button>
        <input ref={input} type="file" name="files" multiple accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.html" className="hidden"
          onChange={(e) => sync([...files, ...Array.from(e.target.files ?? [])])} />
        <span className="text-sm text-muted">PDF, Word o texto · ⌘ + Intro para enviar</span>
        <SubmitButton className="ml-auto" pendingText="Pensando…"><Send className="size-5" aria-hidden />{first ? 'Analizar y proponer' : 'Enviar'}</SubmitButton>
      </div>
      <Thinking />
    </ActionForm>
  )
}
