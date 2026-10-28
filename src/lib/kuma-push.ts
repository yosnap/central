/**
 * Estado de seguridad hacia los monitores push de Uptime Kuma: dependencias de cada proyecto en producción y parches
 * de seguridad de cada servidor. Se envía con cada comprobación de webs (cada 10 minutos); Kuma avisa al pasar a rojo.
 */
import { compareVersions } from './audit'
import { AUDIT_WHERE } from './audit-import'
import { ALERT_WHERE } from './completeness'
import { kumaConnection } from './kuma-connection'
import { prisma } from './prisma'
import type { Snapshot } from './servers/snapshot'

const AUDIT_STALE_MS = 3 * 86_400_000

async function push(base: string, token: string, up: boolean, msg: string) {
  const q = new URLSearchParams({ status: up ? 'up' : 'down', msg: msg.slice(0, 250) })
  const r = await fetch(`${base}/api/push/${encodeURIComponent(token)}?${q}`, { signal: AbortSignal.timeout(10_000) })
  return r.ok
}

/** Resumen de lo que hay que actualizar en un proyecto; null si está al día. */
export async function dependencyAlert(projectId: string) {
  const rows = await prisma.projectAdvisory.findMany({ where: { projectId, ...ALERT_WHERE }, orderBy: [{ severity: 'asc' }, { package: 'asc' }] })
  if (!rows.length) return null
  // por paquete, la versión que corrige todos sus avisos
  const target = new Map<string, { installed: string; fixedIn: string }>()
  for (const r of rows) {
    const cur = target.get(r.package)
    if (!cur || compareVersions(r.fixedIn!, cur.fixedIn) > 0) target.set(r.package, { installed: r.installed, fixedIn: r.fixedIn! })
  }
  const pkgs = [...target].map(([name, t]) => `${name} ${t.installed} → ${t.fixedIn}`)
  return `${rows.length} ${rows.length === 1 ? 'vulnerabilidad' : 'vulnerabilidades'} a actualizar: ${pkgs.join(', ')}`
}

export async function pushSecurity() {
  const conn = await kumaConnection()
  if (!conn) return null
  let sent = 0, failed = 0
  const send = async (token: string, up: boolean, msg: string) => {
    try { if (await push(conn.url, token, up, msg)) sent++; else failed++ } catch { failed++ }
  }

  const projects = await prisma.project.findMany({ where: { ...AUDIT_WHERE, kumaPushToken: { not: null } }, select: { id: true, kumaPushToken: true, auditedAt: true, auditError: true } })
  for (const p of projects) {
    const alert = await dependencyAlert(p.id)
    // sin auditoría reciente no se sabe si está al día: mejor en rojo que en verde a ciegas
    const stale = !p.auditedAt || Date.now() - p.auditedAt.getTime() > AUDIT_STALE_MS
    const msg = alert ?? (stale ? `Sin auditoría de dependencias en 3 días${p.auditError ? `: ${p.auditError}` : ''}` : 'Dependencias sin vulnerabilidades a actualizar')
    await send(p.kumaPushToken!, !alert && !stale, msg)
  }

  const servers = await prisma.server.findMany({ where: { kumaPushToken: { not: null } }, select: { kumaPushToken: true, snapshot: true } })
  for (const s of servers) {
    const m = (s.snapshot as Snapshot | null)?.cards?.maintenance
    // sin lectura no hay dato de parches: de eso ya avisa la vigilancia del servidor
    if (!m) continue
    await send(s.kumaPushToken!, m.security === 0, m.security ? `${m.security} ${m.security === 1 ? 'parche' : 'parches'} de seguridad ${m.security === 1 ? 'pendiente' : 'pendientes'}: apt upgrade${m.reboot ? ' (y reinicio pendiente)' : ''}` : 'Sin parches de seguridad pendientes')
  }
  return { sent, failed }
}
