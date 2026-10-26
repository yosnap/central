/**
 * Colores de cada tarjeta, estado global y comprobaciones de protección («qué falta»), con las mismas reglas que CostGuard.
 * green = bien · amber = mirar · red = actuar · grey = sin dato (o dato viejo).
 */
import type { Reading } from './parse'

export type Level = 'green' | 'amber' | 'red' | 'grey'
const ORDER: Record<Level, number> = { grey: 0, green: 1, amber: 2, red: 3 }
export const worst = (...ls: (Level | undefined | null)[]): Level => {
  const xs = ls.filter((l): l is Level => !!l)
  return xs.length ? xs.reduce((a, b) => (ORDER[b] > ORDER[a] ? b : a)) : 'grey'
}

export const PUBLIC_PORTS = [22, 80, 443]
const MAIL_PORTS = [25, 110, 143, 465, 587, 993, 995]
const pct = (part: number, total: number) => (total ? Math.round((1000 * part) / total) / 10 : 0)
const threshold = (p: number, amber: number, red: number): Level => (p >= red ? 'red' : p >= amber ? 'amber' : 'green')

export type Web = { url: string; up: boolean | null; ms: number | null; code: number | null; sslDays: number | null }
export type Ctx = { webs: Web[]; exposed: number[] | null; knownIps: string[]; sshPort: number; allowMail: boolean }
export type Card = { level: Level } & Record<string, unknown>

/** Puertos que se aceptan abiertos: 22/80/443, el SSH del servidor y, si se permite, los del correo detectado. */
export const allowedPorts = (r: Reading, ctx: Ctx) => new Set([...PUBLIC_PORTS, ctx.sshPort, ...(ctx.allowMail && r.mail ? r.mail.ports : [])])

export function cards(r: Reading, ctx: Ctx): Record<string, Card> {
  const t: Record<string, Card> = {}
  if (r.cpu) t.cpu = { level: threshold(r.cpu.pct, 80, 95), pct: r.cpu.pct }
  if (r.memory) t.memory = { level: threshold(pct(r.memory.used, r.memory.total), 85, 95), pct: pct(r.memory.used, r.memory.total) }
  if (r.disk) t.disk = { level: threshold(pct(r.disk.used, r.disk.total), 85, 95), pct: pct(r.disk.used, r.disk.total) }
  if (ctx.webs.length) {
    const bad = ctx.webs.filter((w) => w.up === false || (w.code ?? 0) >= 500)
    const slow = ctx.webs.filter((w) => (w.ms ?? 0) > 1500)
    t.webs = { level: bad.length ? 'red' : slow.length ? 'amber' : 'green', down: bad.length, slow: slow.length }
    // el certificado va aparte: cambia una vez al día y no cuenta para la salud viva
    const days = ctx.webs.map((w) => w.sslDays).filter((d): d is number => d != null)
    if (days.length) { const min = Math.min(...days); t.certificate = { level: min < 3 ? 'red' : min < 14 ? 'amber' : 'green', days: min } }
  }
  if (r.sessions) {
    const strange = r.sessions.filter((s) => s.from && !ctx.knownIps.includes(s.from.trim()))
    t.sessions = { level: strange.length && ctx.knownIps.length ? 'amber' : 'green', count: r.sessions.length, strange: strange.map((s) => s.from) }
  }
  if (r.attempts) t.attempts = { level: r.attempts.hour > Math.max(30, (3 * r.attempts.total) / 24) ? 'amber' : 'green', hour: r.attempts.hour, day: r.attempts.total }
  if (r.fail2ban) t.banned = { level: r.fail2ban.installed ? 'green' : 'amber', now: r.fail2ban.now ?? null }
  if (ctx.exposed) {
    const allowed = allowedPorts(r, ctx)
    const odd = ctx.exposed.filter((p) => !allowed.has(p))
    t.ports = { level: odd.length ? 'red' : 'green', odd, exposed: ctx.exposed }
  }
  if (r.updates) {
    const security = Number(r.hardening?.parches_seguridad ?? 0) || 0
    t.maintenance = { level: r.updates.reboot || security ? 'amber' : 'green', pending: r.updates.pending, security, reboot: r.updates.reboot }
  }
  if (r.services) {
    const down = r.services.filter((s) => !s.ok).map((s) => s.name)
    const stopped = r.services.filter((s) => s.ok && s.stopped).map((s) => s.name)
    t.services = { level: down.length ? 'red' : stopped.length ? 'amber' : 'green', ok: r.services.filter((s) => s.ok && !s.stopped).length, total: r.services.length, down, stopped }
  }
  return t
}

export type Check = { key: string; ok: boolean | null; detail: string; fix: string }

export function checks(r: Reading, ctx: Ctx): Check[] {
  const b = r.hardening ?? {}
  const c: Check[] = []
  const add = (key: string, ok: boolean | null, detail: string, fix: string) => c.push({ key, ok, detail, fix: ok ? '' : fix })
  const sshd = (k: string) => (r.root ? b[`sshd_${k}`] ?? null : null)

  let v = sshd('passwordauthentication')
  add('ssh_contrasena', v == null ? null : v === 'no', 'SSH sin contraseñas',
    "echo 'PasswordAuthentication no' | sudo tee /etc/ssh/sshd_config.d/00-sin-contrasena.conf && sudo sshd -t && sudo systemctl reload ssh  (en sshd gana el primer valor: 00 va antes que 50-cloud-init)")
  v = sshd('kbdinteractiveauthentication')
  add('ssh_teclado', v == null ? null : v === 'no', 'SSH sin login interactivo', 'KbdInteractiveAuthentication no en sshd_config')
  v = sshd('permitrootlogin')
  add('ssh_root', v == null ? null : ['no', 'prohibit-password', 'without-password'].includes(v), 'root no entra con contraseña', 'PermitRootLogin prohibit-password (o no)')
  v = sshd('permitemptypasswords')
  add('ssh_vacias', v == null ? null : v === 'no', 'sin contraseñas vacías', 'PermitEmptyPasswords no')
  add('fail2ban', !r.root ? null : !!r.fail2ban?.installed && b.fail2ban_activo === 'active', 'fail2ban vigilando SSH', 'apt install fail2ban (el jail sshd viene activo en Ubuntu)')
  add('cortafuegos', !r.root ? null : b.ufw === 'active' || ['DROP', 'REJECT'].includes(b.input_politica ?? ''), 'cortafuegos activo',
    'ufw default deny incoming; ufw allow 22,80,443/tcp; ufw enable (o el cortafuegos del proveedor). Ojo: docker publica puertos saltándose ufw')
  if (ctx.exposed) {
    const allowed = allowedPorts(r, ctx)
    const odd = ctx.exposed.filter((p) => !allowed.has(p))
    const ofMail = odd.filter((p) => MAIL_PORTS.includes(p))
    const close = 'sudo bash cerrar-puerto-docker.sh <puerto> (remote/; docker se salta ufw) o el cortafuegos del proveedor'
    const fix = r.mail && ofMail.length && !ctx.allowMail
      ? `${ofMail.join(', ')} son del correo (${r.mail.name}): si lo usas, marca «Servidor de correo» en la ficha del servidor; si no, ciérralos`
      : r.mail && ofMail.length
        ? `${ofMail.join(', ')} abiertos, pero ${r.mail.name} no los sirve: ciérralos o revisa qué los usa. ${close}`
        : `cerrar ${odd.join(', ')}: ${close}`
    add('puertos', !odd.length, ctx.allowMail && r.mail ? `solo 22/80/443 y los del correo (${r.mail.name}) abiertos a Internet` : 'solo 22/80/443 abiertos a Internet', fix)
  }
  if ('auto_upgrades' in b) add('auto_updates', b.auto_upgrades === 'si' && b.unattended_instalado === 'si', 'parches de seguridad automáticos', 'apt install unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades')
  if ('parches_seguridad' in b) { const n = Number(b.parches_seguridad) || 0; add('parches', n === 0, 'sin parches de seguridad pendientes', `${n} pendientes: apt upgrade`) }
  if (r.updates) add('reinicio', !r.updates.reboot, 'sin reinicio pendiente', 'reiniciar para cargar el kernel y las librerías nuevas')
  if ('sudo_nopasswd' in b) {
    const files = (b.sudo_nopasswd_ficheros ?? '').replace(/^,+|,+$/g, '').replaceAll(',', ', ')
    add('sudo', b.sudo_nopasswd === '0', 'sudo pide contraseña',
      `regla NOPASSWD en ${files || '/etc/sudoers.d/'} (míralo: sudo grep -rn NOPASSWD /etc/sudoers.d/). Si es de otro usuario (p. ej. ubuntu de cloud-init): sudo rm ese fichero. Si es la tuya: antes sudo passwd tu-usuario y prueba con su tu-usuario -c true`)
  }
  if ('uid0_extra' in b) add('uid0', b.uid0_extra === '0', 'solo root con UID 0', 'revisar /etc/passwd: hay cuentas con UID 0 además de root')
  if ('hora_sincronizada' in b) {
    const ok = b.hora_sincronizada === 'yes'
    add('hora', ok ? true : (r.uptimeSec ?? 0) < 900 ? null : false, 'hora sincronizada (NTP)', 'sudo timedatectl set-ntp true') // tras arrancar, NTP tarda unos minutos
  }
  return c
}

const CRITICAL = ['ssh_contrasena', 'ssh_root', 'ssh_vacias', 'cortafuegos', 'puertos']
export function checksSummary(c: Check[]) {
  const known = c.filter((x) => x.ok !== null)
  const failing = c.filter((x) => x.ok === false)
  const level: Level = failing.some((x) => CRITICAL.includes(x.key)) ? 'red' : failing.length ? 'amber' : known.length ? 'green' : 'grey'
  return { done: c.filter((x) => x.ok === true).length, total: known.length, level }
}

/** Salud viva (la que acelera la lectura) y estado global. */
export function levels(t: Record<string, Card>, c: Check[]) {
  const live = worst(...Object.entries(t).filter(([k]) => !['maintenance', 'certificate', 'webs', 'services'].includes(k)).map(([, v]) => v.level),
    t.services && (t.services.down as string[]).length ? 'red' : t.services ? 'green' : undefined)
  const global = worst(live, t.services?.level, t.maintenance?.level, t.certificate?.level, t.webs?.level, checksSummary(c).level)
  return { live, global }
}
