/**
 * Monitores de Uptime Kuma creados y actualizados desde las webs vigiladas de Central,
 * a través de su API de socket.io (la misma que usa su panel). No registra credenciales.
 */
import { io, type Socket } from 'socket.io-client'
import { applyKumaMetrics, kumaConnection, readKumaMetrics, type KumaConnection } from './kuma-connection'
import { prisma } from './prisma'

type Ack = { ok: boolean; msg?: string; monitorID?: number; token?: string }
type KumaMonitor = { id: number; name: string; url: string; type: string; description?: string | null } & Record<string, unknown>
type KumaNotification = { id: number; name: string; isDefault: boolean | number }

// Marca en la descripción para reconocer los monitores que gestiona Central
const MARK = 'Gestionado por Central · web '

class KumaClient {
  monitors: Record<string, KumaMonitor> = {}
  notifications: KumaNotification[] = []
  private constructor(private socket: Socket) {}

  static async connect(conn: KumaConnection): Promise<KumaClient> {
    const socket = io(conn.url, { transports: ['websocket'], reconnection: false, timeout: 10000 })
    const client = new KumaClient(socket)
    // tras el login, Uptime Kuma envía la lista de monitores y de avisos; sin ellas se duplicarían monitores
    const lists = Promise.all([
      new Promise<void>((r) => socket.once('monitorList', (list: Record<string, KumaMonitor>) => { client.monitors = list; r() })),
      new Promise<void>((r) => socket.once('notificationList', (list: KumaNotification[]) => { client.notifications = list; r() })),
    ])
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve())
      socket.once('connect_error', () => reject(new Error('No se puede conectar con Uptime Kuma')))
    })
    const login = await client.call('login', { username: conn.username, password: conn.password, token: '' })
    if (!login.ok) {
      socket.close()
      throw new Error('Usuario o contraseña de Uptime Kuma incorrectos')
    }
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Uptime Kuma no ha enviado la lista de monitores')), 10000))
    try {
      await Promise.race([lists, timeout])
    } catch (e) {
      socket.close()
      throw e
    }
    return client
  }

  call(event: string, ...args: unknown[]): Promise<Ack> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Uptime Kuma no responde (${event})`)), 15000)
      this.socket.emit(event, ...args, (res: Ack) => { clearTimeout(t); resolve(res) })
    })
  }

  close() { this.socket.close() }
}

/** Prueba la conexión: login y lectura de métricas. */
export async function testKumaConnection(conn: KumaConnection) {
  const client = await KumaClient.connect(conn)
  client.close()
  await readKumaMetrics(conn)
}

function monitorFor(site: { id: string; url: string; label: string | null; project: { name: string } | null; service: { name: string } | null }, notifications: KumaNotification[]) {
  const name = site.label ?? (site.project ? `${site.project.name} · ${site.service?.name ?? 'web'}` : site.url.replace(/^https?:\/\//, ''))
  return {
    type: 'http', name, url: site.url, method: 'GET', description: `${MARK}${site.id}`,
    interval: 60, retryInterval: 60, maxretries: 1, resendInterval: 0, timeout: 48,
    expiryNotification: true, ignoreTls: false, upsideDown: false, maxredirects: 10,
    accepted_statuscodes: ['200-299'], conditions: [], active: true,
    notificationIDList: Object.fromEntries(notifications.filter((n) => n.isDefault).map((n) => [n.id, true])),
  }
}

/** Crea, actualiza o borra monitores para que coincidan con las webs vigiladas de Central. */
export async function syncKuma(): Promise<{ created: number; updated: number; deleted: number } | null> {
  const conn = await kumaConnection()
  if (!conn) return null
  const client = await KumaClient.connect(conn)
  let created = 0, updated = 0, deleted = 0
  try {
    const sites = await prisma.website.findMany({ include: { project: { select: { name: true } }, service: { select: { name: true } } } })
    const wanted = sites.filter((s) => s.monitored)
    for (const site of wanted) {
      const desired = monitorFor(site, client.notifications)
      const existing = site.kumaMonitorId ? client.monitors[String(site.kumaMonitorId)] : undefined
      if (!existing) {
        const r = await client.call('add', desired)
        if (!r.ok || !r.monitorID) throw new Error(r.msg ?? 'Uptime Kuma no ha creado el monitor')
        await prisma.website.update({ where: { id: site.id }, data: { kumaMonitorId: r.monitorID } })
        created++
        continue
      }
      // los canales por defecto creados después también se añaden; los puestos a mano se respetan
      const current = (existing.notificationIDList ?? {}) as Record<string, boolean>
      const missing = Object.keys(desired.notificationIDList).some((id) => !current[id])
      if (existing.url !== desired.url || existing.name !== desired.name || missing) {
        const notificationIDList = { ...current, ...desired.notificationIDList }
        const r = await client.call('editMonitor', { ...existing, url: desired.url, name: desired.name, notificationIDList })
        if (!r.ok) throw new Error(r.msg ?? 'Uptime Kuma no ha actualizado el monitor')
        updated++
      }
    }
    // Monitores de Central cuya web ya no se vigila o ya no existe
    const keep = new Set(wanted.map((s) => s.kumaMonitorId).filter(Boolean))
    for (const m of Object.values(client.monitors)) {
      if (!String(m.description ?? '').startsWith(MARK) || keep.has(m.id)) continue
      const r = await client.call('deleteMonitor', m.id)
      if (r.ok) deleted++
    }
    await prisma.website.updateMany({ where: { monitored: false, kumaMonitorId: { not: null } }, data: { kumaMonitorId: null, kumaStatus: null, kumaMs: null } })
  } finally {
    client.close()
  }
  if (conn.apiKey) await applyKumaMetrics(await readKumaMetrics(conn))
  return { created, updated, deleted }
}
