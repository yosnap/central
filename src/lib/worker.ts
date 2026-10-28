/**
 * Cola de trabajos para el trabajador del Mac. Con Central en producción (`CENTRAL_RUNTIME=production`), lo que necesita
 * el Mac se encola aquí; el trabajador pregunta (solo salen conexiones del Mac), lo hace y devuelve el resultado.
 * En el Mac (modo local) no se usa: todo se ejecuta directamente.
 */
import { timingSafeEqual } from 'node:crypto'
import type { Prisma } from '@/generated/prisma/client'
import { prisma } from './prisma'

/** Tipos de trabajo que el trabajador sabe hacer; ningún otro se acepta. */
export const JOB_TYPES = ['assistant', 'scan', 'folders', 'local-status', 'env-file', 'audit', 'server-install', 'container-env'] as const
export type JobType = (typeof JOB_TYPES)[number]

export const isRemote = () => process.env.CENTRAL_RUNTIME === 'production'
const ONLINE_MS = 60_000
const STALE_MS = 15 * 60_000
const SCAN_EVERY_MS = 60 * 60_000
const AUDIT_EVERY_MS = 24 * 60 * 60_000
const ENV_BACKUP_EVERY_MS = 24 * 60 * 60_000

/** Las fechas viajan como texto en el JSON del trabajador: se vuelven a convertir en fechas al importar. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/
export function revive(v: unknown): unknown {
  if (typeof v === 'string') return ISO.test(v) ? new Date(v) : v
  if (Array.isArray(v)) return v.map(revive)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))
  return v
}

/** Pide un escaneo al Mac con las carpetas que Central conoce, para que diga cuáles siguen existiendo. */
export async function enqueueScan(fetch: 'none' | 'active' | 'all' = 'active') {
  const busy = await prisma.workerJob.count({ where: { type: 'scan', status: { in: ['pending', 'running'] } } })
  if (busy) return null
  const known = (await prisma.projectLocation.findMany({ select: { path: true } })).map((l) => l.path)
  return enqueue('scan', { fetch, known })
}

export function workerAuthorized(req: Request) {
  const token = process.env.CENTRAL_WORKER_TOKEN ?? ''
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  return token.length >= 32 && got.length === token.length && timingSafeEqual(Buffer.from(got), Buffer.from(token))
}

export async function enqueue(type: JobType, payload: Prisma.InputJsonValue) {
  return prisma.workerJob.create({ data: { type, payload } })
}

/** ¿Ha dado señales el Mac en el último minuto? */
export async function macOnline() {
  const b = await prisma.workerBeat.findUnique({ where: { id: 'mac' } })
  return { online: !!b && Date.now() - b.lastSeenAt.getTime() < ONLINE_MS, lastSeenAt: b?.lastSeenAt ?? null, hostname: b?.hostname ?? null, roots: b?.roots ?? [] }
}

/** Trabajos pendientes de un tipo cuyo `payload[key]` vale `value` (p. ej. los del asistente de un presupuesto). */
export function pendingFor(type: JobType, key: string, value: string) {
  return prisma.workerJob.findMany({ where: { type, status: { in: ['pending', 'running'] }, payload: { path: [key], equals: value } }, orderBy: { createdAt: 'asc' } })
}

/** Latido del trabajador: apunta que está vivo, da por fallidos los trabajos colgados y le entrega los pendientes. */
export async function beatAndClaim(info: { hostname?: string; version?: string; roots?: string[]; adminKey?: string }, limit = 3) {
  const now = new Date()
  await prisma.workerBeat.upsert({ where: { id: 'mac' }, update: { lastSeenAt: now, ...info }, create: { id: 'mac', lastSeenAt: now, ...info } })
  const stale = await prisma.workerJob.findMany({ where: { status: 'running', startedAt: { lt: new Date(now.getTime() - STALE_MS) } }, select: { id: true } })
  for (const j of stale) await finishJob(j.id, { error: 'El Mac no ha terminado el trabajo a tiempo' })
  // escaneo cada hora mientras el Mac esté conectado (lo que antes hacía la tarea horaria del Mac)
  const lastScan = await prisma.workerJob.findFirst({ where: { type: 'scan' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  if (!lastScan || now.getTime() - lastScan.createdAt.getTime() > SCAN_EVERY_MS) await enqueueScan('active')
  // auditoría de dependencias de los proyectos en producción una vez al día
  const lastAudit = await prisma.workerJob.findFirst({ where: { type: 'audit' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  if (!lastAudit || now.getTime() - lastAudit.createdAt.getTime() > AUDIT_EVERY_MS) {
    const { auditTargets } = await import('./audit-import')
    await enqueue('audit', { targets: (await auditTargets()).map(({ projectId, path }) => ({ projectId, path })) })
  }
  // copia diaria del entorno desplegado (pruebas y producción) de los proyectos con contenedores enlazados
  const lastEnv = await prisma.workerJob.findFirst({ where: { type: 'container-env', payload: { path: ['daily'], equals: true } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  if (!lastEnv || now.getTime() - lastEnv.createdAt.getTime() > ENV_BACKUP_EVERY_MS) {
    const { deployedEnvs, envTargets } = await import('./secrets-store')
    for (const { projectId, environment } of await deployedEnvs()) {
      await enqueue('container-env', { projectId, environment, daily: true, targets: await envTargets(projectId, environment) })
    }
  }
  const pending = await prisma.workerJob.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' }, take: limit })
  const claimed = []
  for (const j of pending) {
    // solo uno se lo queda aunque haya dos trabajadores a la vez
    const r = await prisma.workerJob.updateMany({ where: { id: j.id, status: 'pending' }, data: { status: 'running', startedAt: now, attempts: { increment: 1 } } })
    if (r.count) claimed.push({ id: j.id, type: j.type, payload: j.payload })
  }
  return claimed
}

type Done = { result?: unknown; error?: string }

/**
 * Qué hace Central con el resultado de cada tipo de trabajo. Si un manejador devuelve algo, se guarda eso en lugar del
 * resultado (p. ej. para no dejar variables de entorno en claro en la cola).
 */
const handlers: Partial<Record<JobType, (payload: Prisma.JsonValue, done: Done) => Promise<unknown>>> = {
  assistant: async (payload, done) => {
    const { quoteId } = payload as { quoteId: string }
    const { finishAssistant } = await import('./quote-ai')
    const fail = (msg: string) => prisma.quoteMessage.create({ data: { quoteId, role: 'assistant', content: msg, error: true } })
    if (done.error) { await fail(done.error); return }
    // una respuesta inválida también se ve en el chat, no solo en la cola
    try { await finishAssistant(quoteId, done.result as import('./claude-cli').CliResult) } catch (e) { await fail((e as Error).message); throw e }
  },
  scan: async (_payload, done) => {
    if (done.error) return
    const { roots, projects, existing } = revive(done.result) as { roots: string[]; projects: import('./scanner').ScannedProject[]; existing: string[] }
    const { importProjects, pathMap } = await import('./scan-import')
    const there = new Set(existing)
    await importProjects(projects, roots, pathMap(), () => {}, (p) => there.has(p))
    // estado de los repositorios en GitHub/GitLab con el token de Ajustes (en producción no hay sesión de gh)
    await (await import('./repo-sync')).syncRepos({ activeOnly: true }).catch(() => {})
  },
  audit: async (_payload, done) => {
    if (done.error) return
    const { results } = done.result as { results: ({ projectId: string; findings: import('./audit').Finding[] } | { projectId: string; error: string })[] }
    const { importAudit } = await import('./audit-import')
    for (const r of results) await importAudit(r.projectId, 'error' in r ? { error: r.error } : { findings: r.findings })
    await (await import('./kuma-push')).pushSecurity().catch(() => null)
  },
  'server-install': async (payload, done) => {
    if (done.error) return
    const { serverId, user } = payload as { serverId: string; user: string }
    const { ok, log } = done.result as { ok: boolean; log: string }
    if (!ok) throw new Error(log.slice(-400))
    await prisma.server.update({ where: { id: serverId }, data: { adminUser: user, pausedUntil: null, nextAt: null } })
    await (await import('./servers/collect')).runServers({ force: true, ids: [serverId] })
  },
  'container-env': async (payload, done) => {
    if (done.error) return
    const { projectId, environment } = payload as { projectId: string; environment: string }
    const { entries, from, errors } = done.result as { entries: import('./env-file').EnvEntry[]; from: string[]; errors: string[] }
    if (!entries.length) throw new Error(errors[0] ?? 'Los contenedores no tienen variables propias')
    const { saveBackup } = await import('./secrets-store')
    const saved = await saveBackup(projectId, environment, entries, 'server')
    return { saved, count: entries.length, from, errors }
  },
}

export async function finishJob(id: string, done: Done) {
  const job = await prisma.workerJob.findUnique({ where: { id } })
  if (!job || job.status === 'done' || job.status === 'error') return
  let error = done.error ?? null
  let result = done.result
  try {
    const kept = await handlers[job.type as JobType]?.(job.payload, done)
    if (kept !== undefined) result = kept
  } catch (e) { error = (e as Error).message }
  // las variables de entorno nunca se guardan en la cola, ni siquiera si su manejador falla
  if (job.type === 'container-env' && result === done.result) result = undefined
  await prisma.workerJob.update({
    where: { id },
    data: { status: error ? 'error' : 'done', error, result: error ? undefined : (result as Prisma.InputJsonValue | undefined), finishedAt: new Date() },
  })
}
