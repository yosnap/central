'use client'

import { useTransition } from 'react'
import { setServiceMonitor } from '@/lib/service-actions'
import { Switch, toast } from '@/components/ui'

/** «Vigilar» de un servicio: se guarda al cambiarlo (con URL, aparece en Webs y en Uptime Kuma). */
export function MonitorToggle({ id, checked }: { id: string; checked: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Switch aria-label="Vigilar uptime" label="Vigilar" defaultChecked={checked} disabled={pending}
      onCheckedChange={(on) => start(async () => {
        try { await setServiceMonitor(id, on); toast.success(on ? 'Se vigila' : 'Ya no se vigila') } catch { toast.error('No se ha podido guardar') }
      })} />
  )
}
