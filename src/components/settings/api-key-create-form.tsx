'use client'

import { useRef, useState, useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { Copy, KeyRound, Loader2 } from 'lucide-react'
import { createApiKey } from '@/lib/api-key-actions'
import { API_SCOPES, SCOPE_LABEL } from '@/lib/api/scopes'
import { Button, Checkbox, Field, Input, Notice, toast } from '@/components/ui'

/** Alta de una clave. La clave completa se muestra una sola vez, aquí, hasta que se oculta o se sale de la página. */
export function ApiKeyCreateForm() {
  const form = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null)

  const submit = (data: FormData) =>
    start(async () => {
      try {
        const r = await createApiKey(data)
        if ('error' in r) { toast.error(r.error); return }
        setCreated({ key: r.key, name: String(data.get('name') ?? '') })
        form.current?.reset()
        toast.success('Clave creada')
      } catch (e) {
        unstable_rethrow(e)
        toast.error('No se ha podido crear la clave. Inténtalo de nuevo.')
      }
    })

  const copy = async () => {
    if (!created) return
    try { await navigator.clipboard.writeText(created.key); toast.success('Clave copiada') } catch { toast.error('No se ha podido copiar; selecciónala y cópiala a mano') }
  }

  return (
    <div className="mb-6 flex flex-col gap-5">
      {created && (
        <Notice tone="warn" title={`Clave de «${created.name}»: cópiala ahora`} action={<Button variant="secondary" size="sm" onClick={() => setCreated(null)}>Ya la he copiado</Button>}>
          <p className="mb-3">No se volverá a mostrar. Pégala en la app que se conecta; si la pierdes, revócala y crea otra.</p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-panel px-4 py-2 font-mono text-sm select-all">{created.key}</code>
            <Button variant="secondary" size="sm" onClick={copy}><Copy className="size-5" aria-hidden />Copiar</Button>
          </div>
        </Notice>
      )}
      <form ref={form} action={submit} className="grid gap-4 md:grid-cols-[2fr_3fr_auto] md:items-end">
        <Field label="App" htmlFor="ak-name"><Input id="ak-name" name="name" placeholder="AgoraOne en el Mac" maxLength={80} required /></Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-base font-medium">Permisos</legend>
          {API_SCOPES.map((s) => <Checkbox key={s} name="scopes" value={s} label={SCOPE_LABEL[s]} defaultChecked={s === 'lectura'} />)}
        </fieldset>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <KeyRound className="size-5" aria-hidden />}
          Crear clave
        </Button>
      </form>
    </div>
  )
}
