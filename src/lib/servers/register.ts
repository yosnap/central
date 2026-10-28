/**
 * Alta de servidores. La usan Ajustes y remote/alta-servidor.sh (vía scripts/servidores.ts registrar), con los
 * códigos de salida que espera el script: 0 hecho o se puede, 2 nombre no válido, 3 nombre de otro servidor,
 * 4 ya estaba, 5 no se lee como infobar, 6 host o puerto no válidos.
 */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import { prisma } from '../prisma'
import { hostTarget, KNOWN_HOST_RE } from './install'
import { runCollect } from './ssh'

const run = promisify(execFile)
export const NAME_RE = /^[\p{L}\p{N}_ .-]{1,40}$/u
export const HOST_RE = /^[A-Za-z0-9][A-Za-z0-9.-]{0,252}$/
export const validPort = (p: number) => Number.isInteger(p) && p > 0 && p < 65536

export type RegisterCode = 0 | 2 | 3 | 4 | 5 | 6

export async function register(mode: 'check' | 'test', name: string, host: string, port: number): Promise<{ code: RegisterCode; error?: string; id?: string }> {
  name = name.trim()
  if (!NAME_RE.test(name)) return { code: 2 }
  if (!HOST_RE.test(host) || !validPort(port)) return { code: 6 }
  const same = await prisma.server.findUnique({ where: { name } })
  if (same && (same.host !== host || same.sshPort !== port)) return { code: 3 }
  if (mode === 'check') return { code: 0 }
  const target = { host, sshPort: port, collectUser: 'infobar', keyPath: '~/.ssh/infobar_ed25519' }
  const res = await runCollect(target)
  if (!res.ok) return { code: 5, error: res.error }
  if (same) return { code: 4, id: same.id }
  const created = await prisma.server.create({ data: { name, host, sshPort: port } })
  return { code: 0, id: created.id }
}

/** Huella ed25519 del servidor (para confirmarla antes de confiar en ella). */
export async function hostFingerprint(host: string, port: number) {
  if (!HOST_RE.test(host) || !validPort(port)) throw new Error('Host o puerto no válidos')
  const { stdout } = await run('ssh-keyscan', ['-T', '5', '-t', 'ed25519', '-p', String(port), host], { timeout: 10_000 })
  const line = stdout.split('\n').find((l) => l.trim() && !l.startsWith('#'))
  if (!line) throw new Error('El servidor no ha dado su clave ed25519')
  const key = line.trim().split(/\s+/)[2] // «host tipo clave»
  return { line: line.trim(), fingerprint: `SHA256:${createHash('sha256').update(Buffer.from(key, 'base64')).digest('base64').replace(/=+$/, '')}` }
}

/** Añade la clave de host a ~/.ssh/known_hosts solo si sigue siendo la que el usuario confirmó, y la guarda en la BD. */
export async function trustHost(host: string, port: number, fingerprint: string) {
  const now = await hostFingerprint(host, port)
  if (now.fingerprint !== fingerprint) throw new Error('La huella del servidor ha cambiado desde que la viste: no se confía')
  await appendKnownHost(now.line)
  await prisma.server.updateMany({ where: { host, sshPort: port }, data: { hostKey: now.line } })
}

const KNOWN_HOSTS = () => `${homedir()}/.ssh/known_hosts`
/** «host tipo clave»: la clave en base64 identifica la línea aunque el host esté cifrado (HashKnownHosts). */
const keyBlob = (line: string) => line.trim().split(/\s+/)[2] ?? ''

async function appendKnownHost(line: string) {
  await mkdir(`${homedir()}/.ssh`, { recursive: true, mode: 0o700 })
  await appendFile(KNOWN_HOSTS(), `${line}\n`, { mode: 0o600 })
}

/** Línea de known_hosts que este equipo ya confía para el servidor (la ed25519 si hay varias). */
async function knownLine(host: string, port: number) {
  const { stdout } = await run('ssh-keygen', ['-F', hostTarget(host, port)]).catch(() => ({ stdout: '' }))
  const lines = stdout.split('\n').map((l) => l.trim()).filter((l) => KNOWN_HOST_RE.test(l))
  return lines.find((l) => l.split(/\s+/)[1] === 'ssh-ed25519') ?? lines[0] ?? null
}

/**
 * La huella confirmada vive en la BD y ~/.ssh/known_hosts se repone a partir de ella: en producción el fichero se
 * pierde con cada despliegue. Un servidor sin huella guardada toma la que este equipo ya confía.
 */
export async function syncKnownHosts(servers: { id: string; host: string; sshPort: number; hostKey: string | null }[]) {
  const file = await readFile(KNOWN_HOSTS(), 'utf8').catch(() => '')
  for (const s of servers) {
    if (!s.hostKey) {
      const line = await knownLine(s.host, s.sshPort)
      if (line) await prisma.server.update({ where: { id: s.id }, data: { hostKey: line } })
    } else if (KNOWN_HOST_RE.test(s.hostKey) && !file.includes(keyBlob(s.hostKey))) await appendKnownHost(s.hostKey)
  }
}
