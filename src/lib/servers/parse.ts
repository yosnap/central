/**
 * Salida de recoger.sh (versión 3) y recoger-root (versión 2): secciones "### nombre". Mismas reglas que CostGuard:
 * solo "\n" separa líneas, una sección repetida no vale, las secciones con marco exigen "n" y "fin" coherentes,
 * y si "fin_root" no trae "omitidos 0" se descarta todo lo de root ("sin dato", nunca ceros).
 */

/** Versión de recoger-root.sh en remote/: si el servidor tiene una anterior, la ficha ofrece actualizarla. */
export const ROOT_SCRIPT_VERSION = 4

const SECTIONS = new Set([
  'version', 'sistema', 'memoria', 'disco', 'sesiones', 'puertos', 'intentos', 'actualizaciones', 'bastionado',
  'version_root', 'servicios', 'contenedores', 'bastionado_root', 'fail2ban', 'inventario', 'webs', 'servicios_detalle', 'fin_root', 'correo', 'espera',
])
const ROOT_SECTIONS = ['servicios', 'contenedores', 'bastionado_root', 'fail2ban', 'inventario', 'webs', 'servicios_detalle']
const FRAMED = ['intentos', 'inventario', 'webs', 'servicios_detalle']

export type Sections = Record<string, string[]>

export function analyze(text: string) {
  const out: Sections = {}
  const seen = new Set<string>()
  const framed = new Set<string>()
  let current: string | null = null, finSeen = false, cut = false, afterFin = false
  for (const line of text.split('\n')) {
    if (line.startsWith('### ')) {
      const name = line.slice(4).trim()
      if (name === 'fin') { finSeen = true; current = null; continue }
      afterFin ||= finSeen
      if (name === 'cortada') {
        cut = true
        if (current) delete out[current] // la sección abierta acaba en una línea partida
        current = null
      } else if (!SECTIONS.has(name)) {
        current = null
      } else if (seen.has(name)) {
        delete out[name]
        current = null
      } else {
        seen.add(name)
        out[name] = []
        current = name
      }
    } else if (current) {
      out[current].push(line.trimEnd())
    }
  }
  for (const body of Object.values(out)) while (body.length && !body[body.length - 1]) body.pop()
  const root = 'version_root' in out && out.fin_root?.length === 1 && out.fin_root[0] === 'omitidos 0'
  if (!root) for (const n of ROOT_SECTIONS) delete out[n]
  for (const name of FRAMED) {
    const body = out[name]
    if (!body?.length) continue
    const head = body[0].match(/^n (\d+)$/)
    if (!head) { if (body[0].startsWith('n ')) delete out[name]; continue }
    const inner = body.slice(1, -1)
    const close = body.length >= 2 ? body[body.length - 1].match(/^fin (\d+) (\d+)$/) : null
    if (close && close[2] === '0' && Number(head[1]) === Number(close[1]) && Number(head[1]) === inner.length) {
      out[name] = inner
      framed.add(name)
    } else delete out[name]
  }
  return { sections: out, framed, complete: finSeen && !cut && !afterFin, root }
}

const num = (x: unknown, def = 0) => { const v = Number(x); return Number.isFinite(v) ? v : def }
const keyValue = (lines: string[]) => {
  const d: Record<string, string> = {}
  for (const l of lines) { const i = l.indexOf(' '); const k = i < 0 ? l : l.slice(0, i); if (k) d[k] = i < 0 ? '' : l.slice(i + 1).trim() }
  return d
}
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/

export type Service = { name: string; kind: 'swarm' | 'container'; ok: boolean; stopped: boolean; detail: string; desired: number | null; running: number | null }
export type InventoryItem = { name: string; status: string; composeProject: string | null; composeService: string | null; swarmService: string | null }
export type Reading = {
  version: number | null
  rootVersion: number | null
  root: boolean
  complete: boolean
  cpu?: { pct: number; load: number; cores: number }
  uptimeSec?: number
  memory?: { total: number; used: number }
  disk?: { total: number; used: number }
  sessions?: { user: string; from: string }[]
  ports?: number[]
  attempts?: { total: number; hour: number; ips: { ip: string; n: number }[]; trusted: boolean } | null // null = sin fuente
  updates?: { pending: number; reboot: boolean; held: number }
  services?: Service[]
  mail?: { name: string; ports: number[] }
  inventory?: InventoryItem[]
  domains?: string[]
  /** Imagen y dominios de cada servicio (recoger-root versión 3). */
  details?: Record<string, { image: string | null; domains: string[]; startedAt: Date | null; version: string | null }>
  fail2ban?: { installed: boolean; now?: number; total?: number }
  hardening?: Record<string, string>
}

function services(swarm: string[], containers: string[]): Service[] {
  const out: Service[] = []
  for (const l of swarm) {
    const [name, rep = ''] = l.split('\t')
    const r = rep.trim().match(/^(\d+)\/(\d+)/)
    if (!name || !r) continue
    // 0/0 es parado (Dokploy y Easypanel escalan a cero al pulsar «stop»): no está caído, pero tampoco verde
    const completed = rep.includes('completed')
    out.push({ name: name.slice(0, 64), kind: 'swarm', ok: r[1] === r[2] || completed, stopped: r[2] === '0' && !completed, detail: rep.trim().slice(0, 16), running: Number(r[1]), desired: Number(r[2]) })
  }
  if (out.length) return out
  for (const l of containers) {
    const p = l.split('\t')
    if (p.length < 2 || !p[0]) continue
    const endedWell = p[1] === 'exited' && (p[2] ?? '').startsWith('Exited (0)') // migraciones, builds
    out.push({ name: p[0].slice(0, 64), kind: 'container', ok: p[1] === 'running' || endedWell, stopped: false, detail: p[1].slice(0, 16), running: p[1] === 'running' ? 1 : 0, desired: 1 })
  }
  return out
}

// Servidores de correo y los puertos que sirven: con ellos en marcha esos puertos son legítimos (palabra a palabra, no como trozo)
const SMTP = [25, 465, 587], IMAP = [993, 995]
const MAIL: Record<string, [string, number[]]> = {
  mailu: ['Mailu', [...SMTP, ...IMAP]], mailcow: ['mailcow', [...SMTP, ...IMAP]], mailserver: ['docker-mailserver', [...SMTP, ...IMAP]],
  poste: ['Poste.io', [...SMTP, ...IMAP]], stalwart: ['Stalwart', [...SMTP, ...IMAP]], iredmail: ['iRedMail', [...SMTP, ...IMAP]],
  mailinabox: ['Mail-in-a-Box', [...SMTP, ...IMAP]], postfix: ['Postfix', SMTP], exim: ['Exim', SMTP], exim4: ['Exim', SMTP],
  opensmtpd: ['OpenSMTPD', SMTP], dovecot: ['Dovecot', IMAP],
}

function mail(swarm: string[], containers: string[], system: string[]) {
  const running = [
    ...swarm.filter((l) => /^(\d+)\/\1(\s|$)/.test((l.split('\t')[1] ?? '').trim()) && !l.includes('\t0/0')).map((l) => l.split('\t')[0]),
    ...containers.map((l) => l.split('\t')).filter((p) => p.length >= 2 && p[1] === 'running').map((p) => p[0]),
    ...system.map((l) => l.trim()),
  ]
  const names: string[] = [], ports = new Set<number>()
  for (const n of running) for (const w of n.toLowerCase().split(/[^a-z0-9]+/)) {
    const m = MAIL[w]
    if (!m) continue
    if (!names.includes(m[0])) names.push(m[0])
    m[1].forEach((p) => ports.add(p))
  }
  return names.length ? { name: names.slice(0, 3).join(' + '), ports: [...ports].sort((a, b) => a - b) } : undefined
}

function attempts(lines: string[]): Reading['attempts'] {
  const kv: Record<string, string> = {}
  const ips: { ip: string; n: number }[] = []
  for (const l of lines) {
    const p = l.split(' ')
    if (p[0] === 'h') continue
    if (p[0] === 'ip') { if (p.length === 3 && /^[0-9a-fA-F.:]{3,45}$/.test(p[1]) && /^\d+$/.test(p[2])) ips.push({ ip: p[1], n: Number(p[2]) }); continue }
    if (p[0] in kv) return undefined // clave repetida: no vale
    kv[p[0]] = p.slice(1).join(' ')
  }
  if (kv.fuente !== 'unit') return null
  if (!/^\d+$/.test(kv.total ?? '') || !/^\d+$/.test(kv.hora ?? '')) return undefined
  const total = Number(kv.total)
  const sum = ips.reduce((a, x) => a + x.n, 0)
  return { total, hour: Number(kv.hora), ips: sum <= total ? ips.slice(0, 12) : [], trusted: kv.aislamiento === 'si' }
}

function inventory(lines: string[]): InventoryItem[] {
  const out: InventoryItem[] = []
  const str = (s: string | undefined) => { try { const v = JSON.parse(s ?? 'null'); return typeof v === 'string' && v ? v : null } catch { return null } }
  for (const l of lines) {
    const p = l.split('\t')
    if (p[0] !== 'c' || p.length !== 12) continue
    const name = (str(p[1]) ?? '').replace(/^\//, '')
    if (!NAME.test(name)) continue
    out.push({ name, status: str(p[2]) ?? '', composeProject: str(p[8]), composeService: str(p[9]), swarmService: str(p[10]) })
  }
  return out
}

/** Secciones → datos del servidor. */
export function interpret(text: string): Reading {
  const { sections: sec, framed, complete, root } = analyze(text)
  const v = (sec.version ?? [''])[0].trim()
  const vr = (sec.version_root ?? [''])[0].trim()
  const d: Reading = { version: /^\d{1,3}$/.test(v) ? Number(v) : null, rootVersion: /^\d{1,3}$/.test(vr) ? Number(vr) : null, root, complete }
  const s = sec.sistema ?? []
  if (s.length >= 2) {
    const load = num(s[0].split(/\s+/)[0])
    const cores = /^\d+$/.test(s[1].trim()) ? Number(s[1]) : 0
    if (cores > 0 && cores <= 1024) d.cpu = { pct: Math.round(Math.min(100, (100 * load) / cores) * 10) / 10, load, cores }
    if (s.length >= 3 && d.cpu) d.uptimeSec = Math.floor(num(s[2]))
  }
  const m = (sec.memoria ?? [''])[0].split(/\s+/).filter(Boolean)
  if (m.length === 2) d.memory = { total: num(m[0]), used: Math.max(0, num(m[0]) - num(m[1])) }
  const k = (sec.disco ?? [''])[0].split(/\s+/).filter(Boolean)
  if (k.length === 2) d.disk = { total: num(k[0]), used: num(k[1]) }
  if (sec.sesiones) d.sessions = sec.sesiones.filter((l) => l.trim()).map((l) => ({ user: l.split(/\s+/)[0].slice(0, 32), from: (l.match(/\(([^)]*)\)/)?.[1] ?? '').slice(0, 64) }))
  if (sec.puertos) d.ports = [...new Set(sec.puertos.join(' ').split(/\s+/).filter((p) => /^\d+$/.test(p)).map(Number).filter((p) => p > 0 && p < 65536))].sort((a, b) => a - b)
  if (sec.intentos && framed.has('intentos')) d.attempts = attempts(sec.intentos)
  const a = sec.actualizaciones ?? []
  if (a.length) {
    let pending = Math.floor(num(a[0]))
    const all = pending
    // «espera»: lo que apt upgrade instalaría de verdad; nunca por debajo de los parches de seguridad
    const e = (sec.espera ?? [''])[0].split(' ')
    if (e.length === 2 && e[0] === 'instalables' && /^\d{1,9}$/.test(e[1])) pending = Math.min(all, Math.max(Number(e[1]), Math.floor(num(keyValue(sec.bastionado ?? []).parches_seguridad))))
    d.updates = { pending, reboot: a[1] === 'reinicio', held: all - pending }
  }
  if (sec.servicios || sec.contenedores) d.services = services(sec.servicios ?? [], sec.contenedores ?? [])
  d.mail = mail(sec.servicios ?? [], sec.contenedores ?? [], sec.correo ?? [])
  if (sec.inventario && framed.has('inventario')) d.inventory = inventory(sec.inventario)
  if (sec.webs && framed.has('webs') && sec.webs.includes('fuente ok')) d.domains = sec.webs.filter((l) => l.startsWith('web ')).map((l) => l.slice(4).trim()).filter((x) => DOMAIN.test(x)).slice(0, 200)
  if (sec.servicios_detalle && framed.has('servicios_detalle') && sec.servicios_detalle.includes('fuente ok')) {
    const det: NonNullable<Reading['details']> = {}
    for (const l of sec.servicios_detalle) {
      const [t, name, val] = l.split(' ')
      if (!name || !val || !NAME.test(name) || !['i', 'd', 's', 'v'].includes(t)) continue
      const x = (det[name] ??= { image: null, domains: [], startedAt: null, version: null })
      if (t === 's' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(val)) x.startedAt = new Date(val)
      if (t === 'v' && /^v?\d+\.\d+(\.\d+)?([-+][A-Za-z0-9.]+)?$/.test(val)) x.version = val
      if (t === 'i' && /^[A-Za-z0-9][A-Za-z0-9._/:-]{0,199}$/.test(val)) x.image = val
      if (t === 'd' && DOMAIN.test(val) && x.domains.length < 20) x.domains.push(val)
    }
    d.details = det
  }
  if (sec.fail2ban) {
    const f = keyValue(sec.fail2ban)
    d.fail2ban = sec.fail2ban.includes('no-instalado') ? { installed: false } : { installed: true, now: Math.floor(num(f.ahora)), total: Math.floor(num(f.total)) }
  }
  if (sec.bastionado || sec.bastionado_root) d.hardening = { ...keyValue(sec.bastionado ?? []), ...keyValue(sec.bastionado_root ?? []) }
  return d
}
