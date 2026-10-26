import type { ReactNode } from 'react'
import { cn } from '@/components/ui'
import type { Snapshot } from '@/lib/servers/snapshot'
import type { Level } from '@/lib/servers/status'
import { fmtBytes } from '@/lib/format'

const COLOR: Record<Level, string> = { green: 'text-ok', amber: 'text-warn', red: 'text-bad', grey: 'text-muted' }

function Tile({ label, level, value, note }: { label: string; level?: Level; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-sm">
      <div className="text-base text-muted">{label}</div>
      <div className={cn('num mt-1 text-3xl font-semibold tracking-tight', COLOR[level ?? 'grey'])}>{value}</div>
      {note && <div className="mt-1 text-sm text-muted">{note}</div>}
    </div>
  )
}

/** Tarjetas de salud del servidor; las que no tienen dato salen en gris con «sin dato». */
export function ServerCards({ snap }: { snap: Snapshot }) {
  const c = snap.cards
  const none = 'Sin dato'
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile label="Procesador" level={c.cpu?.level} value={c.cpu ? `${Math.round(c.cpu.pct)} %` : none} note={snap.cpu ? `carga ${snap.cpu.load} · ${snap.cpu.cores} núcleos` : undefined} />
      <Tile label="Memoria" level={c.memory?.level} value={c.memory ? `${Math.round(c.memory.pct)} %` : none} note={snap.memory ? `${fmtBytes(snap.memory.used)} de ${fmtBytes(snap.memory.total)}` : undefined} />
      <Tile label="Disco" level={c.disk?.level} value={c.disk ? `${Math.round(c.disk.pct)} %` : none} note={snap.disk ? `${fmtBytes(snap.disk.used)} de ${fmtBytes(snap.disk.total)}` : undefined} />
      <Tile label="Servicios" level={c.services?.level} value={c.services ? `${c.services.ok}/${c.services.total}` : none}
        note={c.services ? [c.services.down.length && `${c.services.down.length} caídos`, c.services.stopped.length && `${c.services.stopped.length} parados`].filter(Boolean).join(' · ') || 'todos en marcha' : 'necesita la lectura de root'} />
      <Tile label="Webs del servidor" level={c.webs?.level} value={c.webs ? (c.webs.down ? `${c.webs.down} caídas` : c.webs.slow ? `${c.webs.slow} lentas` : 'En línea') : none} note={c.certificate ? `SSL: ${c.certificate.days} días` : undefined} />
      <Tile label="Dentro ahora" level={c.sessions?.level} value={c.sessions ? c.sessions.count : none} note={c.sessions?.strange.length ? `desde ${c.sessions.strange.join(', ')}` : undefined} />
      <Tile label="Intentos de acceso (1 h)" level={c.attempts?.level} value={c.attempts ? c.attempts.hour : none} note={c.attempts ? `${c.attempts.day} en 24 h` : undefined} />
      <Tile label="Bloqueadas" level={c.banned?.level} value={snap.fail2ban ? (snap.fail2ban.installed ? snap.fail2ban.now ?? 0 : 'Sin fail2ban') : none} note={snap.fail2ban?.installed ? `${snap.fail2ban.total ?? 0} en total` : undefined} />
      <Tile label="Puertos abiertos desde Internet" level={c.ports?.level} value={c.ports ? (c.ports.odd.length ? c.ports.odd.join(', ') : 'Solo los públicos') : none} note={c.ports ? c.ports.exposed.join(', ') : undefined} />
      <Tile label="Mantenimiento" level={c.maintenance?.level} value={c.maintenance ? (c.maintenance.reboot ? 'Reinicio pendiente' : c.maintenance.security ? `${c.maintenance.security} de seguridad` : 'Al día') : none} note={c.maintenance ? `${c.maintenance.pending} actualizaciones pendientes` : undefined} />
      <Tile label="Protección" level={snap.protection.level} value={`${snap.protection.done}/${snap.protection.total}`} note="comprobaciones que se han podido mirar" />
    </div>
  )
}
