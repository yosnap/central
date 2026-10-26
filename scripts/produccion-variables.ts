/**
 * Prepara las variables de entorno de Central en producción y las copia al portapapeles para pegarlas en Dokploy
 * (Central › compose › Entorno). Nunca las muestra: en pantalla solo salen los nombres.
 *
 * - Del .env del Mac: contraseña, secretos de sesión y API, y la MISMA clave de cifrado (si cambia, los secretos
 *   guardados en la BD dejan de poder leerse).
 * - Generadas una vez y guardadas en ~/Library/Application Support/Central/produccion.env (solo para ti):
 *   la contraseña de PostgreSQL y el token del trabajador del Mac.
 * - La clave SSH de solo lectura de infobar y las huellas de los servidores vigilados, en base64.
 * - Deja también lista la configuración del trabajador (trabajador.env) con la URL, el token y las carpetas.
 *
 *   bun run produccion:variables
 */
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { prisma } from '../src/lib/prisma'

const URL_PROD = 'https://central.sn4p.dev'
const DIR = path.join(os.homedir(), 'Library', 'Application Support', 'Central')
const PROD_FILE = path.join(DIR, 'produccion.env')
const WORKER_FILE = path.join(DIR, 'trabajador.env')

const readEnvFile = (file: string) => Object.fromEntries((fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '').split('\n')
  .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m![1], m![2].replace(/^"(.*)"$/, '$1')]))
const writePrivate = (file: string, vars: Record<string, string>) => {
  fs.mkdirSync(DIR, { recursive: true })
  fs.writeFileSync(file, Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 })
  fs.chmodSync(file, 0o600)
}
const fail = (m: string) => { console.error(m); process.exit(1) }

// generadas una vez: si ya existen, se reutilizan (cambiar la de PostgreSQL rompería la base de datos de producción)
const saved = readEnvFile(PROD_FILE)
const generated = {
  POSTGRES_PASSWORD: saved.POSTGRES_PASSWORD || randomBytes(24).toString('hex'),
  CENTRAL_WORKER_TOKEN: saved.CENTRAL_WORKER_TOKEN || randomBytes(32).toString('hex'),
  CRON_TOKEN: process.env.CRON_TOKEN || saved.CRON_TOKEN || randomBytes(24).toString('hex'),
  CENTRAL_API_TOKEN: process.env.CENTRAL_API_TOKEN || saved.CENTRAL_API_TOKEN || randomBytes(32).toString('hex'),
}
writePrivate(PROD_FILE, generated)

for (const k of ['CENTRAL_PASSWORD', 'CENTRAL_SESSION_SECRET', 'CENTRAL_ENCRYPTION_KEY']) if (!process.env[k]) fail(`Falta ${k} en el .env del Mac`)

// clave de solo lectura (solo permite ejecutar el script de lectura de infobar) y huellas de los servidores
const keyFile = path.join(os.homedir(), '.ssh', 'infobar_ed25519')
if (!fs.existsSync(keyFile)) fail(`No encuentro ${keyFile}`)
const servers = await prisma.server.findMany({ select: { host: true, sshPort: true } })
const knownHosts = servers.map((s) => {
  const target = s.sshPort === 22 ? s.host : `[${s.host}]:${s.sshPort}`
  try { return execFileSync('ssh-keygen', ['-F', target], { encoding: 'utf8' }).split('\n').filter((l) => l && !l.startsWith('#')).join('\n') } catch { return '' }
}).filter(Boolean)
const missing = servers.length - knownHosts.length
const roots = (await prisma.scanRoot.findMany({ select: { path: true } })).map((r) => r.path)
await prisma.$disconnect()

const vars: Record<string, string> = {
  CENTRAL_PASSWORD: process.env.CENTRAL_PASSWORD!,
  CENTRAL_SESSION_SECRET: process.env.CENTRAL_SESSION_SECRET!,
  CENTRAL_ENCRYPTION_KEY: process.env.CENTRAL_ENCRYPTION_KEY!,
  ...generated,
  CENTRAL_SSH_KEY_B64: fs.readFileSync(keyFile).toString('base64'),
  CENTRAL_SSH_KNOWN_HOSTS_B64: Buffer.from(knownHosts.join('\n') + '\n').toString('base64'),
}

// configuración del trabajador del Mac (la usa «bun run trabajador:instalar»)
writePrivate(WORKER_FILE, { CENTRAL_URL: URL_PROD, CENTRAL_WORKER_TOKEN: generated.CENTRAL_WORKER_TOKEN, CENTRAL_WORKER_ROOTS: roots.join(';') })

execFileSync('pbcopy', { input: Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n') + '\n' })
console.log('Copiadas al portapapeles (pégalas en Dokploy › Central › Entorno):')
for (const k of Object.keys(vars)) console.log(`  ${k}`)
console.log(`Huellas SSH de ${knownHosts.length} de ${servers.length} servidores${missing ? ` (faltan ${missing}: conéctate una vez a ellos desde el Mac)` : ''}.`)
console.log(`Configuración del trabajador guardada en ${WORKER_FILE} (carpetas: ${roots.length}).`)
