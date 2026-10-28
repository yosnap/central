'use server'

import { revalidatePath } from 'next/cache'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'
import { decryptJson, encryptJson } from './crypto'
import { ENV_KEY, formatEnv, parseEnv, type EnvEntry } from './env-file'
import { prisma } from './prisma'
import { requireSession } from './session'
import { lock, unlockWithPassword, unlockedUntil } from './unlock'
import { applyEntries, envTargets, pullServerEnv, saveBackup, type BackupSource } from './secrets-store'
import { enqueue, isRemote, macOnline, pendingFor } from './worker'

// Ninguna acción registra ni devuelve valores salvo las que exigen el desbloqueo.

const Env = z.enum(['production', 'staging', 'development'])
type Locked = { locked: true }
const LOCKED: Locked = { locked: true }

async function requireUnlocked() {
  await requireSession()
  return (await unlockedUntil()) !== null
}

const decrypt = (payload: string) => decryptJson<string>(payload) ?? ''

async function currentEntries(projectId: string, environment: string): Promise<EnvEntry[]> {
  const rows = await prisma.projectSecret.findMany({ where: { projectId, environment }, orderBy: { key: 'asc' } })
  return rows.map((r) => ({ key: r.key, value: decrypt(r.value) }))
}

const backup = (projectId: string, environment: string, entries: EnvEntry[], source: BackupSource, content?: string) => saveBackup(projectId, environment, entries, source, content)

/** Sustituye todos los secretos de un entorno por `entries`. */
async function replaceAll(projectId: string, environment: string, entries: EnvEntry[]) {
  await prisma.$transaction([
    prisma.projectSecret.deleteMany({ where: { projectId, environment } }),
    prisma.projectSecret.createMany({ data: entries.map((e) => ({ projectId, environment, key: e.key, value: encryptJson(e.value) })) }),
  ])
}

const refresh = (projectId: string) => revalidatePath(`/proyectos/${projectId}`)

// --- Desbloqueo ---

export async function unlockSecrets(password: string): Promise<{ ok: boolean; until?: number }> {
  await requireSession()
  if (!(await unlockWithPassword(password))) {
    await new Promise((r) => setTimeout(r, 600)) // frena los intentos repetidos
    return { ok: false }
  }
  return { ok: true, until: (await unlockedUntil()) ?? undefined }
}

export async function lockSecrets() {
  await requireSession()
  await lock()
}

// --- Escritura (no revela nada: basta la sesión) ---

const SecretForm = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  environment: Env,
  key: z.string().trim().regex(ENV_KEY).max(120),
  value: z.string().max(20000).optional(),
  notes: z.string().trim().max(500).optional(),
})

export async function saveSecret(form: FormData) {
  await requireSession()
  const d = SecretForm.parse(Object.fromEntries(form))
  const notes = d.notes || null
  if (d.id) {
    // Al editar, un valor vacío significa «no cambiar»
    await prisma.projectSecret.update({
      where: { id: d.id, projectId: d.projectId },
      data: { key: d.key, environment: d.environment, notes, ...(d.value ? { value: encryptJson(d.value) } : {}) },
    })
  } else {
    await prisma.projectSecret.upsert({
      where: { projectId_environment_key: { projectId: d.projectId, environment: d.environment, key: d.key } },
      update: { value: encryptJson(d.value ?? ''), notes },
      create: { projectId: d.projectId, environment: d.environment, key: d.key, value: encryptJson(d.value ?? ''), notes },
    })
  }
  refresh(d.projectId)
}

export async function deleteSecret(form: FormData) {
  await requireSession()
  const { id, projectId } = z.object({ id: z.string(), projectId: z.string() }).parse(Object.fromEntries(form))
  await prisma.projectSecret.delete({ where: { id, projectId } })
  refresh(projectId)
}

const ImportForm = z.object({
  projectId: z.string(),
  environment: Env,
  content: z.string().min(1).max(200000),
  replace: z.coerce.boolean().optional(),
})

export async function importEnv(form: FormData) {
  await requireSession()
  await importContent(ImportForm.parse(Object.fromEntries(form)))
}

/** Importa un fichero de variables de la carpeta local del proyecto: se lee solo ahora, al pulsar, y se guarda cifrado. */
export async function importLocalEnvFile(form: FormData) {
  await requireSession()
  const { projectId, name, environment } = z.object({ projectId: z.string(), name: z.string().regex(/^\.env(\.[A-Za-z0-9_.-]+)?$/), environment: Env }).parse(Object.fromEntries(form))
  const main = await prisma.projectLocation.findFirst({ where: { projectId, kind: 'MAIN', missing: false }, select: { path: true } })
  if (!main) return { error: 'El proyecto no tiene carpeta principal en este Mac' }
  const file = path.join(main.path, name)
  if (path.dirname(file) !== path.resolve(main.path)) return { error: 'Fichero no válido' }
  const content = await readFile(file, 'utf8').catch(() => null)
  if (content == null) return { error: `No se puede leer ${name}` }
  if (content.length > 200000) return { error: `${name} es demasiado grande` }
  await importContent({ projectId, environment, content, replace: false })
}

/**
 * Lee el entorno desplegado en los contenedores enlazados a los servicios del entorno: si ha cambiado, guarda una
 * versión nueva de la copia (origen «Servidor») y actualiza los secretos con esos valores (sin borrar los que solo
 * están en Central).
 * En producción lo hace el trabajador del Mac (la clave de administración vive en el Mac).
 */
export async function importFromServers(projectId: string, environment: string): Promise<Locked | { error: string } | { queued: true } | { saved: boolean; applied: boolean; count: number; from: string[] }> {
  if (!(await requireUnlocked())) return LOCKED
  const env = Env.parse(environment)
  if (isRemote()) {
    const targets = await envTargets(projectId, env)
    if (!targets.length) return { error: 'Este entorno no tiene contenedores de un servidor enlazados' }
    if (!(await macOnline()).online) return { error: 'El Mac no está conectado: enciende el trabajador (bun run trabajador:instalar) y vuelve a intentarlo.' }
    const waiting = (await pendingFor('container-env', 'projectId', projectId)).some((j) => (j.payload as { environment?: string }).environment === env)
    if (!waiting) await enqueue('container-env', { projectId, environment: env, targets })
    return { queued: true }
  }
  try {
    const r = await pullServerEnv(projectId, env)
    refresh(projectId)
    return r
  } catch (e) { return { error: (e as Error).message } }
}

const saveEntries = applyEntries

async function importContent(d: z.infer<typeof ImportForm>) {
  const entries = parseEnv(d.content)
  if (!entries.length) throw new Error('El fichero no tiene variables')
  if (d.replace) {
    await backup(d.projectId, d.environment, await currentEntries(d.projectId, d.environment), 'restore')
    await replaceAll(d.projectId, d.environment, entries)
  } else await saveEntries(d.projectId, d.environment, entries)
  await backup(d.projectId, d.environment, entries, 'import', d.content)
  refresh(d.projectId)
}

export async function backupNow(form: FormData) {
  await requireSession()
  const { projectId, environment } = z.object({ projectId: z.string(), environment: Env }).parse(Object.fromEntries(form))
  const entries = await currentEntries(projectId, environment)
  if (!entries.length) throw new Error('No hay secretos en este entorno')
  if (!(await backup(projectId, environment, entries, 'manual'))) throw new Error('No hay cambios desde la última copia')
  refresh(projectId)
}

// --- Lectura (exige desbloqueo) ---

export async function revealSecret(id: string): Promise<Locked | { value: string }> {
  if (!(await requireUnlocked())) return LOCKED
  const s = await prisma.projectSecret.findUniqueOrThrow({ where: { id } })
  return { value: decrypt(s.value) }
}

export async function exportEnv(projectId: string, environment: string): Promise<Locked | { content: string }> {
  if (!(await requireUnlocked())) return LOCKED
  return { content: formatEnv(await currentEntries(projectId, Env.parse(environment))) }
}

export async function readBackup(id: string): Promise<Locked | { content: string; environment: string; createdAt: Date }> {
  if (!(await requireUnlocked())) return LOCKED
  const b = await prisma.envBackup.findUniqueOrThrow({ where: { id } })
  return { content: decryptJson<string>(b.content) ?? '', environment: b.environment, createdAt: b.createdAt }
}

export async function restoreBackup(id: string): Promise<Locked | { ok: true }> {
  if (!(await requireUnlocked())) return LOCKED
  const b = await prisma.envBackup.findUniqueOrThrow({ where: { id } })
  const entries = parseEnv(decryptJson<string>(b.content) ?? '')
  // Antes de sustituir, guarda lo que hay para poder volver atrás
  await backup(b.projectId, b.environment, await currentEntries(b.projectId, b.environment), 'restore')
  await replaceAll(b.projectId, b.environment, entries)
  refresh(b.projectId)
  return { ok: true }
}
