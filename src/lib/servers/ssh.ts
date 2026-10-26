/**
 * Lectura de un servidor por SSH como el usuario de recogida (infobar). La clave solo puede ejecutar
 * /usr/local/bin/infobar-recoger (command= en authorized_keys), así que no se pasa ninguna orden.
 * Mismas opciones y topes que CostGuard: 20 s en total, 128 KiB de salida, 8 KiB de errores.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

const LIMIT_MS = 20_000
const MAX_OUT = 128 * 1024
const MAX_ERR = 8 * 1024

const SAFE_OPTIONS = [
  'IdentitiesOnly=yes', 'BatchMode=yes', 'ConnectTimeout=5', 'ServerAliveInterval=3', 'ServerAliveCountMax=2',
  'StrictHostKeyChecking=yes', 'ForwardAgent=no', 'ForwardX11=no', 'ClearAllForwardings=yes', 'PermitLocalCommand=no',
  'ProxyCommand=none', 'ControlMaster=no', 'ControlPath=none', 'LogLevel=ERROR',
]

export type SshTarget = { host: string; sshPort: number; collectUser: string; keyPath: string }
export type SshResult = { ok: true; out: string } | { ok: false; error: string; rejected: boolean }

export const expandHome = (p: string) => (p.startsWith('~/') ? `${homedir()}${p.slice(1)}` : p)

/** Motivo legible del fallo, en el mismo orden que CostGuard. `rejected` = no reintentar en 30 min. */
export function classifySshError(stderr: string, code: number | null): { error: string; rejected: boolean } {
  const e = stderr.toLowerCase()
  if (/host key verification failed|no matching host key|host key for/.test(e)) return { error: 'clave de host no confiada', rejected: true }
  if (/permission denied|too many authentication failures/.test(e)) return { error: 'autenticacion', rejected: true }
  if (/timed out|timeout/.test(e)) return { error: 'timeout', rejected: false }
  if (/could not resolve|no route|network is unreachable|refused/.test(e)) return { error: 'red', rejected: false }
  return { error: `ssh salio con ${code ?? '?'}`, rejected: false }
}

export function sshArgs(t: SshTarget) {
  return ['-T', '-p', String(t.sshPort), '-i', expandHome(t.keyPath), ...SAFE_OPTIONS.flatMap((o) => ['-o', o]), '--', `${t.collectUser}@${t.host}`]
}

export function runCollect(t: SshTarget): Promise<SshResult> {
  if (!existsSync(expandHome(t.keyPath))) return Promise.resolve({ ok: false, error: `falta la clave ${t.keyPath}`, rejected: true })
  return new Promise((resolve) => {
    // grupo propio para poder cortar ssh y lo que cuelgue de él
    const child = spawn('ssh', sshArgs(t), { stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    let out = Buffer.alloc(0), err = '', cut = false, timedOut = false
    const kill = () => { try { process.kill(-child.pid!, 'SIGKILL') } catch { child.kill('SIGKILL') } }
    const timer = setTimeout(() => { timedOut = true; kill() }, LIMIT_MS)
    child.stdout.on('data', (d: Buffer) => {
      if (cut) return
      out = Buffer.concat([out, d])
      if (out.length > MAX_OUT) { out = out.subarray(0, MAX_OUT); cut = true; kill() }
    })
    child.stderr.on('data', (d: Buffer) => { if (err.length < MAX_ERR) err += d.toString('utf8').slice(0, MAX_ERR - err.length) })
    child.on('error', () => { clearTimeout(timer); resolve({ ok: false, error: 'no se pudo lanzar ssh', rejected: false }) })
    child.on('close', (code) => {
      clearTimeout(timer)
      let text = out.toString('utf8')
      if (cut) text += '\n### cortada\n'
      // un código distinto de 0 solo es error si no llegó la lectura
      if (/^### version$/m.test(text)) return resolve({ ok: true, out: text })
      if (timedOut) return resolve({ ok: false, error: 'timeout', rejected: false })
      resolve({ ok: false, ...classifySshError(err, code) })
    })
  })
}
