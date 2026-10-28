/**
 * Monitores de Uptime Kuma creados y actualizados desde las webs vigiladas de Central,
 * a través de su API de socket.io (la misma que usa su panel). No registra credenciales.
 */
import { randomBytes } from 'node:crypto'
import { io, type Socket } from 'socket.io-client'
import { AUDIT_WHERE } from './audit-import'
import { applyKumaMetrics, kumaConnection, readKumaMetrics, type KumaConnection } from './kuma-connection'
import { prisma } from './prisma'

type Ack = { ok: boolean; msg?: string; monitorID?: number; token?: string }
type KumaMonitor = { id: number; name: string; url: string; type: string; description?: string | null } & Record<string, unknown>
type KumaNotification = { id: number; name: string; isDefault: boolean | number }

// Marca en la descripción para reconocer los monitores que gestiona Central
const MARK = 'Gestionado por Central · web '
// Monitores push: Central les envía el estado (kuma-push.ts); si deja de enviarlo, también caen
const DEPS_MARK = 'Gestionado por Central · dependencias '
const PATCH_MARK = 'Gestionado por Central · parches '
const PUSH_INTERVAL = 3600

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
    // sin cerrar el socket, un login que no responde deja el proceso colgado
    const login = await client.call('login', { username: conn.username, password: conn.password, token: '' }).catch((e: Error) => { socket.close(); throw e })
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

const defaultNotifications = (notifications: KumaNotification[]) => Object.fromEntries(notifications.filter((n) => n.isDefault).map((n) => [n.id, true]))

function pushMonitor(name: string, description: string, pushToken: string, notifications: KumaNotification[]) {
  return {
    type: 'push', name, description, pushToken, interval: PUSH_INTERVAL, retryInterval: 60, maxretries: 0,
    // mientras siga en rojo, recuerda el aviso una vez al día (Central envía cada 10 minutos: 144 latidos)
    resendInterval: 144, upsideDown: false, accepted_statuscodes: ['200-299'], conditions: [], active: true,
    notificationIDList: defaultNotifications(notifications),
  }
}

type PushRow = { id: string; name: string; kumaPushId: number | null; kumaPushToken: string | null }

/** Crea los monitores push que falten (o renombra los que cambiaron) y devuelve los ids que deben existir. */
async function syncPush(client: KumaClient, rows: PushRow[], label: string, mark: string, save: (id: string, kumaPushId: number, kumaPushToken: string) => Promise<unknown>) {
  const keep = new Set<number>()
  let created = 0, updated = 0
  for (const row of rows) {
    const name = `${row.name} · ${label}`
    const existing = row.kumaPushId ? client.monitors[String(row.kumaPushId)] : undefined
    if (!existing) {
      const token = randomBytes(24).toString('base64url')
      const r = await client.call('add', pushMonitor(name, `${mark}${row.id}`, token, client.notifications))
      if (!r.ok || !r.monitorID) throw new Error(r.msg ?? 'Uptime Kuma no ha creado el monitor push')
      await save(row.id, r.monitorID, token)
      keep.add(r.monitorID)
      created++
      continue
    }
    keep.add(existing.id)
    if (existing.name !== name || existing.pushToken !== row.kumaPushToken) {
      const r = await client.call('editMonitor', { ...existing, name, pushToken: row.kumaPushToken ?? existing.pushToken })
      if (!r.ok) throw new Error(r.msg ?? 'Uptime Kuma no ha actualizado el monitor push')
      updated++
    }
  }
  return { keep, created, updated }
}

function monitorFor(site: { id: string; url: string; label: string | null; project: { name: string } | null; service: { name: string } | null }, notifications: KumaNotification[]) {
  const name = site.label ?? (site.project ? `${site.project.name} · ${site.service?.name ?? 'web'}` : site.url.replace(/^https?:\/\//, ''))
  return {
    type: 'http', name, url: site.url, method: 'GET', description: `${MARK}${site.id}`,
    interval: 60, retryInterval: 60, maxretries: 1, resendInterval: 0, timeout: 48,
    expiryNotification: true, ignoreTls: false, upsideDown: false, maxredirects: 10,
    accepted_statuscodes: ['200-299'], conditions: [], active: true,
    notificationIDList: defaultNotifications(notifications),
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
    // dependencias de cada proyecto en producción y parches de seguridad de cada servidor ya leído (sin lectura no hay dato)
    const pushSelect = { id: true, name: true, kumaPushId: true, kumaPushToken: true } as const
    const deps = await syncPush(client, await prisma.project.findMany({ where: AUDIT_WHERE, select: pushSelect }), 'dependencias', DEPS_MARK,
      (id, kumaPushId, kumaPushToken) => prisma.project.update({ where: { id }, data: { kumaPushId, kumaPushToken } }))
    const patches = await syncPush(client, await prisma.server.findMany({ where: { lastOkAt: { not: null } }, select: pushSelect }), 'parches de seguridad', PATCH_MARK,
      (id, kumaPushId, kumaPushToken) => prisma.server.update({ where: { id }, data: { kumaPushId, kumaPushToken } }))
    created += deps.created + patches.created
    updated += deps.updated + patches.updated
    // Monitores de Central cuya web, proyecto o servidor ya no se vigila o ya no existe
    const keep = new Set([...wanted.map((s) => s.kumaMonitorId).filter(Boolean), ...deps.keep, ...patches.keep])
    for (const m of Object.values(client.monitors)) {
      const d = String(m.description ?? '')
      if (![MARK, DEPS_MARK, PATCH_MARK].some((x) => d.startsWith(x)) || keep.has(m.id)) continue
      const r = await client.call('deleteMonitor', m.id)
      if (r.ok) deleted++
    }
    await prisma.website.updateMany({ where: { monitored: false, kumaMonitorId: { not: null } }, data: { kumaMonitorId: null, kumaStatus: null, kumaMs: null } })
    await prisma.project.updateMany({ where: { NOT: AUDIT_WHERE, kumaPushId: { not: null } }, data: { kumaPushId: null, kumaPushToken: null } })
    await prisma.server.updateMany({ where: { lastOkAt: null, kumaPushId: { not: null } }, data: { kumaPushId: null, kumaPushToken: null } })
  } finally {
    client.close()
  }
  if (conn.apiKey) await applyKumaMetrics(await readKumaMetrics(conn))
  return { created, updated, deleted }
}
