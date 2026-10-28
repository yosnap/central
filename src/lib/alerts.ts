/**
 * Centro de alertas: todo lo que hay que atender en webs, certificados, servidores y dependencias, calculado al momento
 * con los datos que ya guarda Central. Un único sitio para decidir qué es alerta: la campana y /alertas usan esto.
 */
import { ALERT_WHERE } from './completeness'
import { AUDIT_WHERE } from './audit-import'
import { prisma } from './prisma'
import { visibleStatus } from './servers/collect'
import type { Snapshot } from './servers/snapshot'

export type AlertKind = 'web' | 'ssl' | 'server' | 'patches' | 'deps'
export type AlertLevel = 'critical' | 'warning'
export type Alert = { key: string; kind: AlertKind; level: AlertLevel; title: string; detail: string; href: string; at: Date | null }

export const ALERT_KIND_LABEL: Record<AlertKind, string> = { web: 'Webs', ssl: 'Certificados', server: 'Servidores', patches: 'Parches', deps: 'Dependencias' }

/** Mismo umbral de web lenta que la tarjeta «Webs» de Servidores. */
export const SLOW_MS = 1500
const AUDIT_STALE_MS = 3 * 86_400_000
const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '')

async function webAlerts(): Promise<Alert[]> {
  const sites = await prisma.website.findMany({
    where: { monitored: true },
    select: { id: true, url: true, label: true, lastStatus: true, lastMs: true, lastCode: true, lastCheckedAt: true, kumaStatus: true, kumaMs: true, kumaCheckedAt: true, sslDaysLeft: true, projectId: true },
  })
  const out: Alert[] = []
  for (const s of sites) {
    const name = s.label ?? host(s.url)
    const href = s.projectId ? `/proyectos/${s.projectId}` : '/webs'
    const at = s.kumaCheckedAt ?? s.lastCheckedAt
    // Uptime Kuma manda si tiene dato; si no, la comprobación propia
    const up = s.kumaStatus ? s.kumaStatus === 'up' : s.lastStatus ? s.lastStatus === 'up' : null
    const ms = s.kumaMs ?? s.lastMs
    if (up === false) out.push({ key: `web-down-${s.id}`, kind: 'web', level: 'critical', title: name, detail: `Caída${s.lastCode ? ` (código ${s.lastCode})` : ''}`, href, at })
    else if (up && ms != null && ms > SLOW_MS) out.push({ key: `web-slow-${s.id}`, kind: 'web', level: 'warning', title: name, detail: `Lenta: ${ms} ms`, href, at })
    if (s.sslDaysLeft != null && s.sslDaysLeft <= 14) {
      out.push({ key: `ssl-${s.id}`, kind: 'ssl', level: s.sslDaysLeft <= 3 ? 'critical' : 'warning', title: name, detail: s.sslDaysLeft < 0 ? 'Certificado caducado' : `El certificado caduca en ${s.sslDaysLeft} días`, href, at: s.kumaCheckedAt })
    }
  }
  return out
}

const CARD_LABEL: Record<string, string> = {
  cpu: 'CPU', memory: 'memoria', disk: 'disco', webs: 'webs', certificate: 'certificado', sessions: 'sesiones extrañas',
  attempts: 'intentos de acceso', banned: 'IPs bloqueadas', ports: 'puertos abiertos', maintenance: 'mantenimiento', services: 'servicios',
}

/** Por qué está en rojo un servidor: las tarjetas en rojo de su última lectura, con el detalle que más ayuda. */
function redReasons(snap: Snapshot | null) {
  if (!snap) return []
  const c = snap.cards
  const out = Object.entries(c).filter(([, v]) => v?.level === 'red').map(([k]) => {
    if (k === 'ports' && c.ports) return `puertos abiertos a Internet de más (${c.ports.odd.join(', ')})`
    if (k === 'services' && c.services) return `servicios caídos (${[...c.services.down, ...c.services.stopped].join(', ')})`
    if (k === 'cpu' && c.cpu) return `CPU al ${Math.round(c.cpu.pct)} %`
    if (k === 'memory' && c.memory) return `memoria al ${Math.round(c.memory.pct)} %`
    if (k === 'disk' && c.disk) return `disco al ${Math.round(c.disk.pct)} %`
    return CARD_LABEL[k] ?? k
  })
  if (snap.protection?.level === 'red') out.push('protección crítica sin hacer')
  return out
}

async function serverAlertsList(): Promise<Alert[]> {
  const servers = await prisma.server.findMany({
    select: { id: true, name: true, status: true, error: true, lastOkAt: true, lastAttemptAt: true, intervalSec: true, snapshot: true, checks: { where: { ok: false }, select: { detail: true } } },
  })
  const out: Alert[] = []
  for (const s of servers) {
    const href = `/servidores/${s.id}`
    const level = visibleStatus(s)
    const snap = s.snapshot as Snapshot | null
    if (level === 'red') {
      const why = s.error ? [s.error] : redReasons(snap)
      out.push({ key: `server-red-${s.id}`, kind: 'server', level: 'critical', title: s.name, detail: why.length ? `En rojo: ${why.join('; ')}` : 'En rojo', href, at: s.lastAttemptAt })
    }
    else if (level === 'grey') out.push({ key: `server-grey-${s.id}`, kind: 'server', level: 'critical', title: s.name, detail: s.error ? `Sin datos: ${s.error}` : 'Sin datos recientes', href, at: s.lastOkAt })
    if (s.checks.length) out.push({ key: `server-checks-${s.id}`, kind: 'server', level: 'warning', title: s.name, detail: `Protección incompleta: ${s.checks.map((c) => c.detail).join(', ')}`, href, at: s.lastOkAt })
    const m = snap?.cards?.maintenance
    if (m?.security) out.push({ key: `patches-${s.id}`, kind: 'patches', level: 'warning', title: s.name, detail: `${m.security} ${m.security === 1 ? 'parche' : 'parches'} de seguridad ${m.security === 1 ? 'pendiente' : 'pendientes'}: apt upgrade`, href, at: s.lastOkAt })
    if (m?.reboot) out.push({ key: `reboot-${s.id}`, kind: 'server', level: 'warning', title: s.name, detail: 'Reinicio pendiente tras actualizar', href, at: s.lastOkAt })
  }
  return out
}

async function dependencyAlerts(): Promise<Alert[]> {
  const projects = await prisma.project.findMany({
    where: AUDIT_WHERE,
    select: { id: true, name: true, auditedAt: true, auditError: true, advisories: { where: ALERT_WHERE, select: { package: true, severity: true, firstSeenAt: true } } },
  })
  const out: Alert[] = []
  for (const p of projects) {
    const href = `/proyectos/${p.id}`
    if (p.advisories.length) {
      const critical = p.advisories.some((a) => a.severity === 'critical')
      const pkgs = [...new Set(p.advisories.map((a) => a.package))]
      out.push({
        key: `deps-${p.id}`, kind: 'deps', level: critical ? 'critical' : 'warning', title: p.name,
        detail: `${p.advisories.length} ${p.advisories.length === 1 ? 'vulnerabilidad' : 'vulnerabilidades'} por actualizar: ${pkgs.slice(0, 4).join(', ')}${pkgs.length > 4 ? ` y ${pkgs.length - 4} más` : ''}`,
        href, at: p.advisories.reduce<Date | null>((min, a) => (!min || a.firstSeenAt < min ? a.firstSeenAt : min), null),
      })
    }
    if (p.auditError) out.push({ key: `audit-error-${p.id}`, kind: 'deps', level: 'warning', title: p.name, detail: `La auditoría ha fallado: ${p.auditError}`, href, at: p.auditedAt })
    else if (!p.auditedAt || Date.now() - p.auditedAt.getTime() > AUDIT_STALE_MS) out.push({ key: `audit-stale-${p.id}`, kind: 'deps', level: 'warning', title: p.name, detail: p.auditedAt ? 'Sin auditar las dependencias en 3 días' : 'Dependencias sin auditar todavía', href, at: p.auditedAt })
  }
  return out
}

/** Todas las alertas abiertas: primero las críticas, después por tipo y nombre. */
export async function collectAlerts(): Promise<Alert[]> {
  const all = (await Promise.all([webAlerts(), serverAlertsList(), dependencyAlerts()])).flat()
  const kinds = Object.keys(ALERT_KIND_LABEL)
  return all.sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1) || kinds.indexOf(a.kind) - kinds.indexOf(b.kind) || a.title.localeCompare(b.title, 'es'))
}
