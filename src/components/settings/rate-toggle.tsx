'use client'

import { useTransition } from 'react'
import { setRateActive } from '@/lib/brand-actions'
import { Switch, toast } from '@/components/ui'

/** Tarifa en uso o retirada: las retiradas no se ofrecen al añadir partidas. */
export function RateToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Switch aria-label="En uso" defaultChecked={active} disabled={pending}
      onCheckedChange={(on) => start(async () => {
        try { await setRateActive(id, on); toast.success(on ? 'Tarifa en uso' : 'Tarifa retirada') } catch { toast.error('No se ha podido guardar') }
      })} />
  )
}
