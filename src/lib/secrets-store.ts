/**
 * Copias cifradas de los ficheros de variables (EnvBackup) y lectura del entorno desplegado en los contenedores.
 * Lo usan las Server Actions de secretos, la cola del trabajador y scripts/secretos-copias.ts. Nunca registra valores.
 */
import { decryptJson, encryptJson } from './crypto'
import { formatEnv, parseEnv, type EnvEntry } from './env-file'
import { prisma } from './prisma'

export type BackupSource = 'import' | 'restore' | 'manual' | 'server'
/** Entornos desplegados que se copian a diario desde sus contenedores. */
export const DEPLOYED_ENVS = ['production', 'staging'] as const

/** Mismas variables con los mismos valores, sin importar el orden ni los comentarios. */
const signature = (entries: EnvEntry[]) => JSON.stringify([...entries].sort((a, b) => a.key.localeCompare(b.key)).map((e) => [e.key, e.value]))

/**
 * Guarda una versión nueva de la copia del entorno solo si cambia algo respecto a la última: si es igual, no guarda
 * y devuelve `false`.
 */
export async function saveBackup(projectId: string, environment: string, entries: EnvEntry[], source: BackupSource, content?: string) {
  if (!entries.length) return false
  const last = await prisma.envBackup.findFirst({ where: { projectId, environment }, orderBy: { createdAt: 'desc' }, select: { content: true } })
  const previous = last ? parseEnv(decryptJson<string>(last.content) ?? '') : null
  if (previous && signature(previous) === signature(entries)) return false
  await prisma.envBackup.create({ data: { projectId, environment, content: encryptJson(content ?? formatEnv(entries)), keyCount: entries.length, source } })
  return true
}

export type EnvTarget = { host: string; sshPort: number; adminUser: string | null; hostKey: string | null; name: string; kind: string }

/** Contenedores enlazados a los servicios de un entorno, las aplicaciones primero (en un choque de nombre gana su valor). */
export async function envTargets(projectId: string, environment: string): Promise<EnvTarget[]> {
  const rows = await prisma.serverContainer.findMany({
    where: { projectService: { projectId, environment } },
    select: { name: true, kind: true, role: true, server: { select: { host: true, sshPort: true, adminUser: true, hostKey: true } } },
  })
  const isApp = (r: string | null) => !r || r === 'app' || r === 'other'
  rows.sort((a, b) => Number(isApp(b.role)) - Number(isApp(a.role)))
  return rows.map((r) => ({ ...r.server, name: r.name, kind: r.kind }))
}

/** Une las variables de varios contenedores: la primera aparición gana. */
export function mergeEnv(lists: EnvEntry[][]) {
  const merged = new Map<string, string>()
  for (const list of lists) for (const e of list) if (!merged.has(e.key)) merged.set(e.key, e.value)
  return [...merged].map(([key, value]) => ({ key, value }))
}

/** Proyectos y entornos desplegados con algún contenedor enlazado: lo que se copia a diario. */
export async function deployedEnvs() {
  const rows = await prisma.projectService.findMany({
    where: { environment: { in: [...DEPLOYED_ENVS] }, containers: { some: {} }, project: { excluded: false } },
    select: { projectId: true, environment: true },
    distinct: ['projectId', 'environment'],
  })
  return rows
}

/** Variables leídas de una lista de contenedores con la clave de administración de este equipo. */
export async function readTargets(targets: Pick<EnvTarget, 'host' | 'sshPort' | 'adminUser' | 'name' | 'kind'>[]) {
  const { readContainerEnv } = await import('./servers/service-env')
  const lists: EnvEntry[][] = []
  const from: string[] = []
  for (const t of targets) {
    const entries = await readContainerEnv(t, t)
    if (entries.length) from.push(t.name)
    lists.push(entries)
  }
  return { entries: mergeEnv(lists), from }
}

/** Añade o actualiza variables en los secretos del entorno, cifradas; no borra las que no vienen. */
export async function applyEntries(projectId: string, environment: string, entries: EnvEntry[]) {
  for (const e of entries) {
    await prisma.projectSecret.upsert({
      where: { projectId_environment_key: { projectId, environment, key: e.key } },
      update: { value: encryptJson(e.value) },
      create: { projectId, environment, key: e.key, value: encryptJson(e.value) },
    })
  }
}

/**
 * Lo leído de los contenedores: si cambia respecto a la última copia, versión nueva de la copia y secretos al día con
 * lo desplegado. Si no cambia, solo rellena los secretos cuando el entorno aún no tiene ninguno.
 */
export async function storeServerEnv(projectId: string, environment: string, entries: EnvEntry[]) {
  const saved = await saveBackup(projectId, environment, entries, 'server')
  const applied = saved || !(await prisma.projectSecret.count({ where: { projectId, environment } }))
  if (applied) await applyEntries(projectId, environment, entries)
  return { saved, applied }
}

/** En el Mac: lee el entorno desplegado y lo guarda (storeServerEnv). */
export async function pullServerEnv(projectId: string, environment: string) {
  const targets = await envTargets(projectId, environment)
  if (!targets.length) throw new Error('Este entorno no tiene contenedores de un servidor enlazados')
  const { entries, from } = await readTargets(targets)
  if (!entries.length) throw new Error('Los contenedores no tienen variables propias')
  return { ...(await storeServerEnv(projectId, environment, entries)), count: entries.length, from }
}
