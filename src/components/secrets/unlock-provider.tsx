'use client'

import { Lock, LockOpen } from 'lucide-react'
import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { lockSecrets, unlockSecrets } from '@/lib/secret-actions'
import { Button, Field, Input, Modal, Notice, Pill, toast } from '@/components/ui'

type Locked = { locked: true }
type Pending = { run: () => Promise<unknown>; resolve: (v: unknown) => void }

type Ctx = {
  until: number | null
  /** Ejecuta una acción de lectura; si está bloqueado, pide la contraseña y la repite. Devuelve null si se cancela. */
  withUnlock: <T>(fn: () => Promise<Locked | T>) => Promise<T | null>
  lockNow: () => Promise<void>
}

const UnlockContext = createContext<Ctx | null>(null)

export function useUnlock() {
  const ctx = useContext(UnlockContext)
  if (!ctx) throw new Error('useUnlock fuera de UnlockProvider')
  return ctx
}

const isLocked = (r: unknown): r is Locked => !!r && typeof r === 'object' && 'locked' in r

export function UnlockProvider({ initialUntil, onLock, children }: { initialUntil: number | null; onLock?: () => void; children: ReactNode }) {
  const [until, setUntil] = useState(initialUntil)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const pending = useRef<Pending | null>(null)

  const withUnlock = async <T,>(fn: () => Promise<Locked | T>) => {
    const r = await fn()
    if (!isLocked(r)) return r
    setUntil(null)
    return new Promise<T | null>((resolve) => {
      pending.current = { run: fn, resolve: resolve as (v: unknown) => void }
      setFailed(false)
      setOpen(true)
    })
  }

  const close = (o: boolean) => {
    if (o || busy) return
    setOpen(false)
    pending.current?.resolve(null)
    pending.current = null
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const password = String(new FormData(e.currentTarget).get('password') ?? '')
    setBusy(true)
    const res = await unlockSecrets(password)
    setBusy(false)
    if (!res.ok) return setFailed(true)
    setUntil(res.until ?? null)
    setOpen(false)
    const p = pending.current
    pending.current = null
    if (p) {
      const r = await p.run()
      p.resolve(isLocked(r) ? null : r)
    }
  }

  const lockNow = async () => {
    await lockSecrets()
    setUntil(null)
    onLock?.()
    toast.success('Secretos bloqueados')
  }

  return (
    <UnlockContext.Provider value={{ until, withUnlock, lockNow }}>
      {children}
      <Modal open={open} onOpenChange={close} size="sm" title="Desbloquear secretos" description="Escribe la contraseña de Central. Quedarán desbloqueados 15 minutos.">
        <form onSubmit={submit} className="flex flex-col gap-4 pb-3">
          <Field label="Contraseña" htmlFor="unlock-password">
            <Input id="unlock-password" name="password" type="password" autoFocus required autoComplete="current-password" />
          </Field>
          {failed && <Notice tone="bad" title="Contraseña incorrecta" />}
          <Button type="submit" disabled={busy} aria-busy={busy}>Desbloquear</Button>
        </form>
      </Modal>
    </UnlockContext.Provider>
  )
}

/** Indica si los secretos están desbloqueados y permite bloquearlos o desbloquearlos. */
export function UnlockStatus() {
  const { until, withUnlock, lockNow } = useUnlock()
  const active = until !== null && until > Date.now()
  const time = until ? new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(until) : ''
  return active ? (
    <div className="flex items-center gap-2">
      <Pill tone="warn"><LockOpen className="size-4" aria-hidden />Desbloqueado hasta las {time}</Pill>
      <Button variant="ghost" size="sm" onClick={lockNow}><Lock className="size-4" aria-hidden />Bloquear</Button>
    </div>
  ) : (
    <Button variant="secondary" size="sm" onClick={() => withUnlock(async () => ({ locked: true as const }))}>
      <Lock className="size-4" aria-hidden />Bloqueado · desbloquear
    </Button>
  )
}
