/** Forma de `Server.snapshot`: la última lectura buena ya interpretada, lista para pintar. */
import type { Reading } from './parse'
import type { Level } from './status'

type CardBase = { level: Level }
export type Snapshot = {
  readAt: string
  version: number | null
  rootVersion?: number | null
  root: boolean
  complete: boolean
  cpu: Reading['cpu'] | null
  memory: Reading['memory'] | null
  disk: Reading['disk'] | null
  uptimeSec: number | null
  sessions: Reading['sessions'] | null
  ports: number[] | null
  exposed: number[] | null
  attempts?: { total: number; hour: number } | null // null = el servidor no tiene fuente de intentos
  updates: Reading['updates'] | null
  mail: Reading['mail'] | null
  domains: string[] | null
  fail2ban: Reading['fail2ban'] | null
  protection: { done: number; total: number; level: Level }
  cards: Partial<{
    cpu: CardBase & { pct: number }
    memory: CardBase & { pct: number }
    disk: CardBase & { pct: number }
    webs: CardBase & { down: number; slow: number }
    certificate: CardBase & { days: number }
    sessions: CardBase & { count: number; strange: string[] }
    attempts: CardBase & { hour: number; day: number }
    banned: CardBase & { now: number | null }
    ports: CardBase & { odd: number[]; exposed: number[] }
    maintenance: CardBase & { pending: number; security: number; reboot: boolean }
    services: CardBase & { ok: number; total: number; down: string[]; stopped: string[] }
  }>
}
