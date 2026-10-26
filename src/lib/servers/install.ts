/**
 * Instala o actualiza infobar en un servidor desde Central, sin terminal: lo mismo que remote/alta-servidor.sh.
 * Entra UNA vez con el usuario administrador y su contraseña (o una clave del Mac), sube los scripts de remote/
 * a una carpeta temporal y ejecuta instalar-en-servidor.sh como root (con sudo si hace falta).
 * La contraseña solo vive en memoria durante la conexión: no se guarda ni se escribe en ningún registro.
 * La huella del servidor tiene que estar ya en ~/.ssh/known_hosts (si no, la ficha pide confirmarla antes).
 */
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { readdir } from 'node:fs/promises'
import { Client, utils, type AnyAuthMethod } from 'ssh2'

const run = promisify(execFile)
const KEY = `${homedir()}/.ssh/infobar_ed25519`
const FILES = ['instalar-en-servidor.sh', 'recoger.sh', 'recoger-root.sh']
export const ADMIN_USER_RE = /^[a-z_][a-z0-9_.-]{0,31}$/

const ADMIN_KEY = `${homedir()}/.ssh/central_admin_ed25519`

/**
 * Clave de administrador de Central (sin frase), para servidores que solo aceptan claves: se añade una vez en el panel
 * del proveedor y la instalación entra con ella. Se crea la primera vez que se pide.
 */
export async function adminPublicKey() {
  if (!existsSync(ADMIN_KEY)) await run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'central-admin', '-f', ADMIN_KEY])
  return (await readFile(`${ADMIN_KEY}.pub`, 'utf8')).trim()
}

/** Métodos de acceso que acepta el servidor para ese usuario (sin enviar ninguna credencial). */
async function acceptedMethods(host: string, port: number, user: string) {
  const r = await run('ssh', ['-n', '-o', 'PreferredAuthentications=none', '-o', 'PubkeyAuthentication=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=yes', '-p', String(port), `${user}@${host}`, 'true'], { timeout: 12_000 })
    .then(() => ({ stderr: '' }), (e: { stderr?: string }) => ({ stderr: e.stderr ?? '' }))
  return r.stderr.match(/Permission denied \(([^)]*)\)/)?.[1]?.split(',') ?? null
}

/** La clave dedicada de este Mac (sin frase): se crea la primera vez. */
async function publicKey() {
  if (!existsSync(KEY)) await run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'infobar@central', '-f', KEY])
  return (await readFile(`${KEY}.pub`, 'utf8')).trim().split(/\s+/).slice(0, 2).join(' ')
}

/** Huellas SHA256 que este Mac ya confía para el host. */
async function knownFingerprints(host: string, port: number) {
  const target = port === 22 ? host : `[${host}]:${port}`
  const { stdout } = await run('ssh-keygen', ['-l', '-F', target]).catch(() => ({ stdout: '' }))
  return new Set([...stdout.matchAll(/SHA256:[A-Za-z0-9+/]+/g)].map((m) => m[0]))
}

/** Contraseña guardada en el Llavero de macOS para ese host y usuario (macOS pide permiso la primera vez). Nunca se guarda en Central. */
async function keychainPassword(host: string, user: string) {
  if (process.platform !== 'darwin') return undefined
  for (const kind of ['find-internet-password', 'find-generic-password']) {
    const r = await run('security', [kind, '-s', host, '-a', user, '-w'], { timeout: 30_000 }).catch(() => null)
    const pw = r?.stdout.replace(/\n$/, '')
    if (pw) return pw
  }
  return undefined
}

/**
 * Claves privadas del Mac que valdrían como con `ssh` en la terminal: las que `ssh -G` usaría para ese host
 * (respeta ~/.ssh/config) y el resto de ~/.ssh. Se saltan las que tienen frase de paso y la de infobar (solo lee).
 */
async function adminKeys(host: string, port: number, user: string, passphrase?: string) {
  const dir = `${homedir()}/.ssh`
  // claves cuya frase de paso está en el Llavero de macOS: se cargan en el agente sin preguntar
  if (process.platform === 'darwin') await run('ssh-add', ['--apple-load-keychain'], { timeout: 5000 }).catch(() => {})
  const { stdout } = await run('ssh', ['-G', '-p', String(port), `${user}@${host}`]).catch(() => ({ stdout: '' }))
  const fromConfig = [...stdout.matchAll(/^identityfile (.+)$/gm)].map((m) => m[1].replace(/^~/, homedir()))
  const agent = stdout.match(/^identityagent (.+)$/m)?.[1]?.replace(/^~/, homedir())
  const others = (await readdir(dir).catch(() => [] as string[])).filter((f) => !/\.pub$|known_hosts|config|authorized_keys|infobar/.test(f)).map((f) => path.join(dir, f))
  const keys: { file: string; key: Buffer; passphrase?: string }[] = []
  for (const file of [...new Set([...fromConfig, ...others])]) {
    if (file.includes('infobar') || !existsSync(file)) continue
    const key = await readFile(file).catch(() => null)
    if (!key || key.length > 20_000 || !/PRIVATE KEY/.test(key.toString('utf8', 0, 200))) continue
    if (!(utils.parseKey(key) instanceof Error)) keys.push({ file, key })
    // con frase de paso: se prueba lo escrito en «Contraseña» como frase de la clave
    else if (passphrase && !(utils.parseKey(key, passphrase) instanceof Error)) keys.push({ file, key, passphrase })
  }
  const agentSock = agent && agent !== 'none' && !agent.startsWith('SSH_AUTH_SOCK') ? agent : process.env.SSH_AUTH_SOCK
  return { keys, agent: agentSock && existsSync(agentSock) ? agentSock : undefined }
}

/** `privateKey`: una clave pegada en la ventana (p. ej. la que muestra Dokploy); solo vive en memoria durante la conexión. */
type Opts = { host: string; port: number; user: string; password?: string; privateKey?: string }

export async function installInfobar({ host, port, user, password, privateKey }: Opts): Promise<{ ok: boolean; log: string }> {
  if (!ADMIN_USER_RE.test(user)) return { ok: false, log: 'Usuario no válido' }
  password ||= await keychainPassword(host, user)
  const creds = await adminKeys(host, port, user, password)
  if (privateKey?.trim()) {
    const key = Buffer.from(privateKey.trim().replace(/\r\n?/g, '\n') + '\n')
    const plain = !(utils.parseKey(key) instanceof Error)
    if (!plain && (!password || utils.parseKey(key, password) instanceof Error)) return { ok: false, log: 'La clave pegada no es una clave privada válida (o tiene frase de paso: escríbela en «Contraseña»)' }
    creds.keys.unshift({ file: 'pegada', key, passphrase: plain ? undefined : password })
  }
  const pub = await publicKey()
  const trusted = await knownFingerprints(host, port)
  if (!trusted.size) return { ok: false, log: 'Este Mac aún no confía en la clave del servidor: confírmala primero en su ficha.' }
  const scripts = await Promise.all(FILES.map(async (f) => [f, await readFile(path.join(process.cwd(), 'remote', f))] as const))
  type Exec = (cmd: string, stdin?: string | Buffer) => Promise<{ code: number; out: string }>
  let exec: Exec
  let close = () => {}
  let log = ''

  // 1) el ssh del Mac, igual que en la terminal (agente, claves de ~/.ssh y la de Central), con la huella estricta
  const openssh: Exec = (cmd, stdin) => new Promise((resolve) => {
    const args = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=8', '-o', 'ServerAliveInterval=5',
      ...(existsSync(ADMIN_KEY) ? ['-i', ADMIN_KEY] : []), '-p', String(port), '--', `${user}@${host}`, cmd]
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    const timer = setTimeout(() => child.kill('SIGKILL'), 120_000)
    child.stdout.on('data', (d: Buffer) => { out += d.toString('utf8') })
    child.stderr.on('data', (d: Buffer) => { out += d.toString('utf8') })
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out }) })
    child.on('error', () => { clearTimeout(timer); resolve({ code: 255, out: 'no se pudo lanzar ssh' }) })
    child.stdin.end(stdin ?? '')
  })
  if ((await openssh('true')).code === 0) exec = openssh
  else {
  // 2) si no entra con claves: contraseña, frase de paso o clave pegada, con la biblioteca ssh2
  const conn = new Client()
  close = () => conn.end()
  exec = (cmd, stdin) => new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err)
      let out = ''
      stream.on('data', (d: Buffer) => { out += d.toString('utf8') })
      stream.stderr.on('data', (d: Buffer) => { out += d.toString('utf8') })
      stream.on('close', (code: number | null) => resolve({ code: code ?? 1, out }))
      if (stdin !== undefined) stream.end(stdin)
      else stream.end()
    })
  })

  try {
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', () => resolve()).on('error', reject)
      // como ssh en la terminal: agente, claves del Mac y, si no entra, contraseña
      const methods: AnyAuthMethod[] = [
        ...(creds.agent ? [{ type: 'agent', username: user, agent: creds.agent } as AnyAuthMethod] : []),
        ...creds.keys.map((k) => ({ type: 'publickey', username: user, key: k.key, passphrase: k.passphrase }) as AnyAuthMethod),
        ...(password ? [{ type: 'password', username: user, password } as AnyAuthMethod, { type: 'keyboard-interactive', username: user, prompt: (_n: string, _i: string, _l: string, prompts: unknown[], finish: (r: string[]) => void) => finish(prompts.map(() => password)) } as AnyAuthMethod] : []),
      ]
      conn.connect({
        host, port, username: user, readyTimeout: 15_000,
        authHandler: (_methodsLeft, _partial, next) => next((methods.shift() ?? false) as AnyAuthMethod),
        // solo un servidor cuya huella ya se confirmó
        hostVerifier: (key: Buffer) => trusted.has(`SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`),
      })
    })
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    if (/authentication/i.test(m)) {
      const methods = await acceptedMethods(host, port, user)
      if (methods && !methods.includes('password') && !methods.includes('keyboard-interactive')) return { ok: false, log: `Este servidor no deja entrar a ${user} con contraseña, solo con clave. Añade la clave de Central (en esta misma ventana) en el panel de tu proveedor y vuelve a pulsar «Instalar» sin contraseña.` }
    }
    return { ok: false, log: /authentication/i.test(m) ? (password ? `No entra como ${user}: ni con las claves de este Mac (${creds.keys.length}) ni con la contraseña` : `No entra como ${user} con ninguna de las ${creds.keys.length} claves de este Mac${creds.agent ? ' ni con el agente SSH' : ''}: escribe la contraseña`) : /verification/i.test(m) ? 'La huella del servidor no coincide con la confirmada' : `No se pudo conectar: ${m}` }
  }

  }

  try {
    const isRoot = (await exec('id -u')).out.trim() === '0'
    if (!isRoot && (await exec('command -v sudo')).code !== 0) return { ok: false, log: `El servidor no tiene sudo y ${user} no es root: entra como root.` }
    const dir = (await exec('mktemp -d /tmp/infobar-alta.XXXXXX')).out.trim()
    if (!/^\/tmp\/infobar-alta\.[A-Za-z0-9]{6}$/.test(dir)) return { ok: false, log: 'No se pudo crear la carpeta temporal en el servidor' }
    for (const [f, body] of scripts) await exec(`cat > ${dir}/${f}`, body)
    const install = `bash ${dir}/instalar-en-servidor.sh '${pub}'; rc=$?; rm -rf ${dir}; exit $rc`
    // con sudo, la contraseña va por stdin (-S), nunca en la orden
    const r = isRoot ? await exec(install) : await exec(`sudo -S -p '' sh -c "${install.replaceAll('"', '\\"').replaceAll('$', '\\$')}"`, `${password ?? ''}\n`)
    log = r.out.replace(/\[sudo\][^\n]*\n?/g, '').trim()
    if (r.code !== 0) return { ok: false, log: /incorrect password|sorry, try again|not in the sudoers/i.test(log) ? `sudo ha rechazado a ${user}: entra como root o usa un usuario con sudo.` : log || `La instalación terminó con el código ${r.code}` }
    // la clave de administración de Central queda autorizada para este usuario: así las próximas actualizaciones
    // (y el mantenimiento desde el Mac) entran sin contraseña. Sin duplicarla y con salto de línea final, para no
    // pegarla a la última clave del fichero.
    const adminPub = await adminPublicKey()
    const body = adminPub.split(/\s+/)[1]
    const add = await exec(`umask 077; mkdir -p ~/.ssh && f=~/.ssh/authorized_keys && touch "$f" && if grep -qF '${body}' "$f"; then echo ya; else [ -s "$f" ] && [ -n "$(tail -c1 "$f")" ] && echo >> "$f"; cat >> "$f" && echo nueva; fi`, `${adminPub}\n`)
    log += add.out.includes('nueva') ? `\nClave de administración de Central autorizada para ${user}.` : add.out.includes('ya') ? '' : `\nNo se pudo autorizar la clave de administración: ${add.out.trim()}`
    return { ok: true, log }
  } finally {
    close()
  }
}
