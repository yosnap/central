/** Conexión con Uptime Kuma guardada en Ajustes (credenciales cifradas) y lectura de /metrics. */
import { decryptJson } from './crypto'
import { prisma } from './prisma'

export type KumaConnection = { id: string; url: string; username: string; password: string; apiKey: string | null }

export async function kumaConnection(): Promise<KumaConnection | null> {
  const c = await prisma.integrationConnection.findFirst({ where: { provider: 'UPTIME_KUMA' } })
  if (!c?.baseUrl || !c.account) return null
  const secret = decryptJson<{ password: string; apiKey?: string }>(c.secret)
  if (!secret?.password) return null
  return { id: c.id, url: c.baseUrl.replace(/\/$/, ''), username: c.account, password: secret.password, apiKey: secret.apiKey || null }
}

export type KumaMetric = { id: number | null; name: string; url: string | null; status: string; ms: number | null; sslDays: number | null }

const STATUS = ['down', 'up', 'pending', 'maintenance']

/** Lee el estado de cada monitor del endpoint de métricas (Prometheus), con la clave de API. */
export async function readKumaMetrics(conn: KumaConnection): Promise<KumaMetric[]> {
  if (!conn.apiKey) throw new Error('Falta la clave de API de métricas')
  const res = await fetch(`${conn.url}/metrics`, {
    headers: { authorization: `Basic ${Buffer.from(`:${conn.apiKey}`).toString('base64')}` },
    signal: AbortSignal.timeout(10000),
  })
  if (res.status === 401) throw new Error('La clave de API de métricas no es válida')
  if (!res.ok) throw new Error(`Uptime Kuma respondió ${res.status}`)
  const byKey = new Map<string, KumaMetric>()
  for (const line of (await res.text()).split('\n')) {
    const m = line.match(/^(monitor_status|monitor_response_time|monitor_cert_days_remaining)\{([^}]*)\}\s+(-?[\d.]+)/)
    if (!m) continue
    const labels = Object.fromEntries([...m[2].matchAll(/(\w+)="((?:[^"\\]|\\.)*)"/g)].map((x) => [x[1], x[2]]))
    const key = labels.monitor_id ?? labels.monitor_name
    const cur = byKey.get(key) ?? { id: labels.monitor_id ? Number(labels.monitor_id) : null, name: labels.monitor_name, url: labels.monitor_url && labels.monitor_url !== 'null' ? labels.monitor_url : null, status: 'pending', ms: null, sslDays: null }
    const v = Number(m[3])
    if (m[1] === 'monitor_status') cur.status = STATUS[v] ?? 'pending'
    if (m[1] === 'monitor_response_time') cur.ms = v >= 0 ? Math.round(v) : null
    if (m[1] === 'monitor_cert_days_remaining') cur.sslDays = Math.floor(v)
    byKey.set(key, cur)
  }
  return [...byKey.values()]
}

/** Guarda en cada web el estado, los ms y los días de SSL que da Uptime Kuma. */
export async function applyKumaMetrics(metrics: KumaMetric[]) {
  const sites = await prisma.website.findMany({ where: { kumaMonitorId: { not: null } }, select: { id: true, kumaMonitorId: true, url: true } })
  const now = new Date()
  for (const s of sites) {
    const m = metrics.find((x) => x.id === s.kumaMonitorId) ?? metrics.find((x) => x.id === null && x.url === s.url)
    if (!m) continue
    await prisma.website.update({ where: { id: s.id }, data: { kumaStatus: m.status, kumaMs: m.ms, sslDaysLeft: m.sslDays, kumaCheckedAt: now } })
  }
}
