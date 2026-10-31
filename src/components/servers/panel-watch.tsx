'use client'

import { useTransition } from 'react'
import { setPanelMonitor } from '@/lib/server-actions'
import { Switch, toast } from '@/components/ui'

/** «Vigilar panel» del servidor: se guarda al cambiarlo (aparece en Webs centralizadas y en Uptime Kuma). */
export function PanelWatch({ id, checked }: { id: string; checked: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Switch aria-label="Vigilar el panel" label="Vigilar panel" defaultChecked={checked} disabled={pending}
      onCheckedChange={(on) => start(async () => {
        try { await setPanelMonitor(id, on); toast.success(on ? 'Se vigila el panel' : 'Ya no se vigila el panel') } catch { toast.error('No se ha podido guardar') }
      })} />
  )
}
