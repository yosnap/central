/**
 * Forma real de servidores y alertas en la API v1: se ejecuta el código de `servers/public` y `collectAlerts` con una
 * BD falsa cargada con lo que hoy puede haber (error de lectura con la ruta de la clave, panel e URLs por IP, dominios
 * del proxy con IPs, comprobaciones que citan IPs). Falla si sale una IP o una ruta de clave.
 */
import { describe, expect, mock, test } from 'bun:test'

const STALE = new Date(Date.now() - 86_400_000)
const server = {
  id: 'srv1', name: 'hetzner-1', host: '203.0.113.7', sshPort: 2222, provider: 'Hetzner', panel: 'easypanel', panelUrl: 'http://203.0.113.7:3000',
  status: 'red', liveStatus: 'red', error: 'falta la clave ~/.ssh/infobar_ed25519', lastOkAt: STALE, lastAttemptAt: new Date(), nextAt: null, intervalSec: 300,
  keyPath: '~/.ssh/infobar_ed25519', knownIps: ['198.51.100.4'], hostKey: 'ssh-ed25519 AAAA…',
  snapshot: {
    readAt: STALE.toISOString(), root: true, domains: ['app.ejemplo.es', '203.0.113.7', '2001:db8::1'],
    cards: { cpu: { pct: 20 }, memory: { pct: 40 }, disk: { pct: 50 }, services: { ok: 3, total: 4, down: ['api'], stopped: [] }, maintenance: { security: 2, reboot: true } },
    protection: { level: 'red', summary: 'SSH abierto a 0.0.0.0 desde 198.51.100.4' },
  },
  services: [{ id: 'svc1', name: 'web', environment: 'production', url: 'https://web.203.0.113.7.sslip.io', project: { id: 'p1', name: 'Web cliente' }, containers: [{ name: 'web', state: 'running', detail: 'escucha en 10.0.0.5:3000' }] }],
  containers: [{ name: 'web', kind: 'app', state: 'running', detail: 'IP interna 172.18.0.3', projectServiceId: 'svc1' }],
  checks: [
    { key: 'ssh-root', ok: false, detail: 'root entra por SSH desde 198.51.100.4', fix: 'edita /etc/ssh/sshd_config y revisa /root/.ssh/authorized_keys' },
    { key: 'firewall', ok: true, detail: 'ufw activo', fix: null },
  ],
}
const website = { id: 'w1', url: 'http://203.0.113.7:8080', label: null, lastStatus: 'down', lastMs: null, lastCode: 502, lastCheckedAt: new Date(), kumaStatus: 'down', kumaMs: null, kumaCheckedAt: new Date(), sslDaysLeft: 3, projectId: 'p1' }

const model = (rows: unknown[]) => ({ findMany: async () => rows, findUnique: async () => rows[0] ?? null, findFirst: async () => rows[0] ?? null, count: async () => rows.length })
mock.module('../prisma', () => ({
  prisma: new Proxy({}, { get: (_t, name) => (name === 'server' ? model([server]) : name === 'website' ? model([website]) : model([])) }),
}))

const { listServers, getServer } = await import('./servers')
const { collectAlerts } = await import('../alerts')
const { scrubDeep, redactText } = await import('./scrub')

const IP = /(?:\d{1,3}[.-]){3}\d{1,3}|2001:db8/
const KEY_PATH = /\.ssh|infobar_ed25519|authorized_keys|~\//
const BANNED_FIELDS = ['host', 'sshPort', 'panelUrl', 'keyPath', 'knownIps', 'hostKey', 'ip', 'secret']

function fields(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => fields(x, out))
  else if (v && typeof v === 'object' && !(v instanceof Date)) for (const [k, x] of Object.entries(v)) { out.push(k); fields(x, out) }
  return out
}

function expectClean(v: unknown) {
  const text = JSON.stringify(v)
  expect(text).not.toMatch(IP)
  expect(text).not.toMatch(KEY_PATH)
  for (const f of BANNED_FIELDS) expect(fields(v)).not.toContain(f)
}

describe('servidores por la API', () => {
  test('lista sin dirección, panel, IPs ni ruta de la clave', async () => {
    const list = await listServers()
    expect(list).toHaveLength(1)
    expectClean(list)
    expect(list[0].error).toBe('falta la clave [ruta oculta]')
    expect(list[0].projects[0].url).toBeNull()
  })

  test('ficha igual de limpia, conservando lo que no es sensible', async () => {
    const s = await getServer('srv1')
    expect(s).not.toBeNull()
    expectClean(s)
    expect(s?.domains).toEqual(['app.ejemplo.es'])
    expect(s?.name).toBe('hetzner-1')
    expect(JSON.stringify(s)).toContain('/etc/ssh/sshd_config')
  })
})

describe('alertas por la API', () => {
  test('el código de la ruta no deja IPs ni rutas de clave en títulos ni detalles', async () => {
    const raw = await collectAlerts()
    // sin limpiar sí salen: la prueba vigila un riesgo real
    expect(JSON.stringify(raw)).toMatch(KEY_PATH)
    const alerts = scrubDeep(raw)
    expect(alerts.length).toBeGreaterThan(2)
    expectClean(alerts)
    expect(alerts.map((a) => a.href)).toContain('/servidores/srv1')
  })
})

describe('limpieza de texto', () => {
  test('respeta horas, versiones y rutas del sistema', () => {
    expect(redactText('a las 12:30:45, versión 16.4.3, /etc/ssh/sshd_config')).toBe('a las 12:30:45, versión 16.4.3, /etc/ssh/sshd_config')
    expect(redactText('desde 10.0.0.1 y fe80::1, clave /Users/ana/.ssh/id_rsa')).toBe('desde [IP oculta] y [IP oculta], clave [ruta oculta]')
    expect(scrubDeep({ version: '1.2.3.4', url: 'https://[2001:db8::2]:8443/x', web: 'https://ejemplo.es' })).toEqual({ version: '1.2.3.4', url: null, web: 'https://ejemplo.es' })
    expect(scrubDeep({ a: 'https://web.203.0.113.7.sslip.io', b: 'http://203-0-113-7.nip.io:3000', c: 'IP:10.0.0.1', d: 'serie 1.2.3.4.5', e: 'web.ejemplo.es' }))
      .toEqual({ a: null, b: null, c: 'IP:[IP oculta]', d: 'serie 1.2.3.4.5', e: 'web.ejemplo.es' })
    expect(redactText('servicio en api.198.51.100.4.sslip.io caído')).toBe('servicio en api.[IP oculta].sslip.io caído')
  })

  test('los números sueltos (teléfonos, NIF, códigos postales) no son direcciones, aunque el analizador de URL los lea como IPv4', () => {
    expect(scrubDeep({ phone: '600000000', taxId: '12345678', zip: '28001' }, { paths: false })).toEqual({ phone: '600000000', taxId: '12345678', zip: '28001' })
    expect(scrubDeep({ ip: '10.0.0.1:22', url: 'http://10.0.0.1/' }, { paths: false })).toEqual({ ip: null, url: null })
  })
})
