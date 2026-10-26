/**
 * Ciclo de lectura: cada servidor se lee cuando le toca (5 min normal, 1 min en incidencia; 30 min de pausa tras un
 * rechazo de clave, autenticación o huella), se interpreta y se guarda. Un fallo deja el servidor en rojo con el
 * motivo y conserva la última lectura buena.
 */
import type { Prisma, Server } from '../../generated/prisma/client'
import { prisma } from '../prisma'
import { exposedPorts } from './external'
import { assignServersByDomain, matchContainers } from './match'
import { interpret } from './parse'
import { refreshServiceVersion, versionFromImage } from '../deploy-version'
import { roleOf } from './role'
import { runCollect } from './ssh'
import type { Snapshot } from './snapshot'
import { cards, checks, checksSummary, levels, type Level, type Web } from './status'

const PAUSE_AFTER_REJECT_MS = 30 * 60_000
const PARALLEL = 4
const DAY = 86_400_000

/** Gris si la última lectura buena tiene más de 3 ciclos o no hay ninguna. */
export function visibleStatus(s: Pick<Server, 'status' | 'lastOkAt' | 'intervalSec'>): Level {
  if (!s.lastOkAt || Date.now() - s.lastOkAt.getTime() > 3 * s.intervalSec * 1000) return s.status === 'red' ? 'red' : 'grey'
  return (s.status as Level) ?? 'grey'
}

async function websFor(serverId: string): Promise<Web[]> {
  const sites = await prisma.website.findMany({ where: { service: { serverId } }, select: { url: true, lastStatus: true, lastMs: true, lastCode: true, kumaStatus: true, kumaMs: true, sslDaysLeft: true } })
  return sites.map((w) => ({
    url: w.url,
    up: w.kumaStatus ? w.kumaStatus === 'up' : w.lastStatus ? w.lastStatus === 'up' : null,
    ms: w.kumaMs ?? w.lastMs, code: w.lastCode, sslDays: w.sslDaysLeft,
  }))
}

export async function readServer(server: Server) {
  const now = new Date()
  const res = await runCollect(server)
  if (!res.ok) {
    await prisma.server.update({
      where: { id: server.id },
      data: {
        status: 'red', liveStatus: 'red', error: res.error, lastAttemptAt: now,
        nextAt: new Date(now.getTime() + server.incidentSec * 1000),
        pausedUntil: res.rejected ? new Date(now.getTime() + PAUSE_AFTER_REJECT_MS) : null,
      },
    })
    await prisma.serverSample.create({ data: { serverId: server.id, at: now, status: 'red' } })
    return { ok: false as const, error: res.error }
  }

  const r = interpret(res.out)
  const exposed = await exposedPorts(server.host, r.ports)
  const ctx = { webs: await websFor(server.id), exposed, knownIps: server.knownIps, sshPort: server.sshPort, allowMail: server.allowMail }
  const t = cards(r, ctx)
  const c = checks(r, ctx)
  const { live, global } = levels(t, c)
  const incident = live === 'amber' || live === 'red'
  const snapshot = {
    readAt: now.toISOString(), version: r.version, rootVersion: r.rootVersion, root: r.root, complete: r.complete,
    cpu: r.cpu ?? null, memory: r.memory ?? null, disk: r.disk ?? null, uptimeSec: r.uptimeSec ?? null,
    sessions: r.sessions ?? null, ports: r.ports ?? null, exposed,
    attempts: r.attempts ? { total: r.attempts.total, hour: r.attempts.hour } : r.attempts === null ? null : undefined,
    updates: r.updates ?? null, mail: r.mail ?? null, domains: r.domains ?? null, fail2ban: r.fail2ban ?? null,
    cards: t as Snapshot['cards'], protection: checksSummary(c),
  } satisfies Snapshot

  await prisma.server.update({
    where: { id: server.id },
    data: {
      status: global, liveStatus: live, error: r.complete ? null : 'lectura incompleta', lastAttemptAt: now, lastOkAt: now,
      nextAt: new Date(now.getTime() + (incident ? server.incidentSec : server.intervalSec) * 1000), pausedUntil: null,
      scriptVersion: r.version != null ? String(r.version) : null, snapshot: snapshot as Prisma.InputJsonValue,
    },
  })

  for (const x of c) {
    await prisma.serverCheck.upsert({
      where: { serverId_key: { serverId: server.id, key: x.key } },
      create: { serverId: server.id, key: x.key, ok: x.ok, detail: x.detail, fix: x.fix || null, checkedAt: now },
      update: { ok: x.ok, detail: x.detail, fix: x.fix || null, checkedAt: now },
    })
  }
  await prisma.serverCheck.deleteMany({ where: { serverId: server.id, key: { notIn: c.map((x) => x.key) } } })

  // Sin lectura de root no hay lista de servicios: se conserva la anterior
  const deployed: { containerId: string; at: Date; image: string | null }[] = []
  if (r.services) {
    const before = new Map((await prisma.serverContainer.findMany({ where: { serverId: server.id }, select: { name: true, startedAt: true } })).map((c) => [c.name, c.startedAt]))
    for (const s of r.services) {
      const state = !s.ok ? 'down' : s.stopped ? 'stopped' : 'ok'
      // sin la sección de detalle (script antiguo) se conservan la imagen y los dominios que hubiera
      const det = r.details?.[s.name]
      const extra = r.details ? { image: det?.image ?? null, domains: det?.domains ?? [], version: det?.version ?? versionFromImage(det?.image), startedAt: det?.startedAt ?? null } : {}
      const role = roleOf(det?.image, s.name)
      const saved = await prisma.serverContainer.upsert({
        where: { serverId_name: { serverId: server.id, name: s.name } },
        create: { serverId: server.id, name: s.name, kind: s.kind, state, desired: s.desired, running: s.running, detail: s.detail, role, ...extra, seenAt: now },
        update: { kind: s.kind, state, desired: s.desired, running: s.running, detail: s.detail, ...(r.details ? { role } : {}), ...extra, seenAt: now },
      })
      // ha vuelto a arrancar (o el servicio de Swarm se ha actualizado): un despliegue. La primera lectura solo fija la referencia
      const prev = before.get(s.name)
      if (prev && det?.startedAt && det.startedAt.getTime() !== prev.getTime()) deployed.push({ containerId: saved.id, at: det.startedAt, image: det.image })
    }
    await prisma.serverContainer.deleteMany({ where: { serverId: server.id, name: { notIn: r.services.map((s) => s.name) } } })
  }

  // IPs atacantes solo si el origen es fiable (las sesiones no viven en el cgroup de sshd)
  if (r.attempts?.trusted) {
    for (const x of r.attempts.ips) {
      await prisma.serverAttackIp.upsert({
        where: { serverId_ip: { serverId: server.id, ip: x.ip } },
        create: { serverId: server.id, ip: x.ip, attempts: x.n, firstAt: now, lastAt: now },
        update: { attempts: x.n, lastAt: now },
      })
    }
  }

  const services = (t.services ?? null) as unknown as { ok: number; total: number } | null
  await prisma.serverSample.create({
    data: {
      serverId: server.id, at: now, status: global,
      cpu: r.cpu?.pct, load: r.cpu?.load, mem: (t.memory?.pct as number) ?? null, disk: (t.disk?.pct as number) ?? null,
      servicesOk: services?.ok, servicesTotal: services?.total, sessions: r.sessions?.length, attempts: r.attempts?.hour, exposed: exposed ?? [],
    },
  })
  await aggregateHour(server.id, now)
  await matchContainers(server.id)
  await recordDeployments(server.id, deployed)
  return { ok: true as const, status: global }
}

/** Guarda cada despliegue y lee al momento la versión nueva de su servicio de proyecto. */
async function recordDeployments(serverId: string, list: { containerId: string; at: Date; image: string | null }[]) {
  for (const d of list) {
    const c = await prisma.serverContainer.findUniqueOrThrow({ where: { id: d.containerId }, select: { name: true, projectServiceId: true, projectService: { select: { liveVersion: true } } } })
    const previousVersion = c.projectService?.liveVersion ?? null
    const version = c.projectServiceId ? await refreshServiceVersion(c.projectServiceId, { force: true }) : null
    await prisma.deployment.create({ data: { serverId, containerId: d.containerId, containerName: c.name, projectServiceId: c.projectServiceId, at: d.at, image: d.image, version, previousVersion } })
  }
}

async function aggregateHour(serverId: string, at: Date) {
  const hour = new Date(Math.floor(at.getTime() / 3_600_000) * 3_600_000)
  const rows = await prisma.serverSample.findMany({ where: { serverId, at: { gte: hour, lt: new Date(hour.getTime() + 3_600_000) } } })
  const vals = (k: 'cpu' | 'mem' | 'disk') => rows.map((x) => x[k]).filter((v): v is number => v != null)
  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : null)
  const cpu = vals('cpu')
  const data = {
    cpuAvg: cpu.length ? Math.round((cpu.reduce((a, b) => a + b, 0) / cpu.length) * 10) / 10 : null, cpuMax: max(cpu),
    memMax: max(vals('mem')), diskMax: max(vals('disk')),
    attempts: max(rows.map((x) => x.attempts).filter((v): v is number => v != null)),
    worst: rows.reduce<Level>((w, x) => (['grey', 'green', 'amber', 'red'].indexOf(x.status) > ['grey', 'green', 'amber', 'red'].indexOf(w) ? (x.status as Level) : w), 'grey'),
  }
  await prisma.serverHour.upsert({ where: { serverId_hour: { serverId, hour } }, create: { serverId, hour, ...data }, update: data })
}

/** Muestras 7 días, agregados por hora 90 días, IPs atacantes 90 días, despliegues un año. */
async function prune() {
  const now = Date.now()
  await prisma.serverSample.deleteMany({ where: { at: { lt: new Date(now - 7 * DAY) } } })
  await prisma.serverHour.deleteMany({ where: { hour: { lt: new Date(now - 90 * DAY) } } })
  await prisma.serverAttackIp.deleteMany({ where: { lastAt: { lt: new Date(now - 90 * DAY) } } })
  await prisma.deployment.deleteMany({ where: { at: { lt: new Date(now - 365 * DAY) } } })
}

/** Lee los servidores a los que les toca (o todos con `force`), de 4 en 4. */
export async function runServers(opts: { force?: boolean; ids?: string[] } = {}) {
  const now = new Date()
  const soon = new Date(now.getTime() + 5000)
  const servers = await prisma.server.findMany({
    where: {
      ...(opts.ids ? { id: { in: opts.ids } } : {}),
      ...(opts.force ? {} : { AND: [{ OR: [{ nextAt: null }, { nextAt: { lte: soon } }] }, { OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }] }] }),
    },
  })
  const results: { name: string; ok: boolean; detail: string }[] = []
  for (let i = 0; i < servers.length; i += PARALLEL) {
    const batch = servers.slice(i, i + PARALLEL)
    const r = await Promise.all(batch.map((s) => readServer(s).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : 'error' }))))
    batch.forEach((s, j) => { const x = r[j]; results.push({ name: s.name, ok: x.ok, detail: x.ok ? x.status : x.error }) })
  }
  if (servers.length) {
    const assigned = await assignServersByDomain()
    // un servicio recién asignado necesita emparejarse con su contenedor
    if (assigned) for (const s of await prisma.server.findMany({ select: { id: true } })) await matchContainers(s.id)
    await prune()
  }
  return results
}
