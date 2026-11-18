import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { RATE_LIMIT, createApiAuth, type KeyStore, type StoredKey } from './auth'
import { VISIBLE_PREFIX_LENGTH, bearerKey, generateApiKey, hashApiKey, sameHash } from './keys'
import { apiRoute, json } from './route'

type Key = ReturnType<typeof generateApiKey>

function memoryStore(rows: (StoredKey & { prefix: string })[]) {
  const touched: string[] = []
  const store: KeyStore = {
    async findByPrefix(prefix) { return rows.filter((r) => r.prefix === prefix) },
    async touch(id) { touched.push(id) },
  }
  return { store, touched }
}

function stored(k: Key, id: string, scopes: string[], revokedAt: Date | null = null) {
  return { id, name: `app ${id}`, prefix: k.prefix, hash: k.hash, scopes, revokedAt, lastUsedAt: null }
}

const req = (key?: string, method = 'GET') =>
  new Request('http://localhost:3099/api/v1/prueba', { method, headers: key ? { authorization: `Bearer ${key}` } : {} })

const noParams = { params: Promise.resolve({}) }

let reading: Key, quotes: Key, revoked: Key
let clock: number
let calls: number
let logs: string[]
let spies: ReturnType<typeof spyOn>[]

function setup() {
  const mem = memoryStore([stored(reading, 'k-lectura', ['lectura']), stored(quotes, 'k-presupuestos', ['presupuestos']), stored(revoked, 'k-revocada', ['lectura', 'presupuestos'], new Date('2026-11-01'))])
  const auth = createApiAuth(mem.store, () => clock)
  const handler = async () => { calls += 1; return json({ ok: true }) }
  return { auth, touched: mem.touched, readRoute: apiRoute('lectura', handler, auth), quoteRoute: apiRoute('presupuestos', handler, auth), anyRoute: apiRoute(null, handler, auth) }
}

beforeEach(() => {
  reading = generateApiKey(); quotes = generateApiKey(); revoked = generateApiKey()
  clock = Date.parse('2026-11-18T12:00:00Z'); calls = 0; logs = []
  spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => spyOn(console, m).mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')) }))
})
afterEach(() => { for (const s of spies) s.mockRestore() })

describe('claves', () => {
  test('formato, prefijo visible y huella SHA-256', () => {
    const k = generateApiKey()
    expect(k.key).toMatch(/^cen_[A-Za-z0-9_-]{43}$/)
    expect(k.prefix).toBe(k.key.slice(0, VISIBLE_PREFIX_LENGTH))
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(k.hash).toBe(hashApiKey(k.key))
    expect(generateApiKey().key).not.toBe(k.key)
  })

  test('comparación de huellas', () => {
    const k = generateApiKey()
    expect(sameHash(k.hash, hashApiKey(k.key))).toBe(true)
    expect(sameHash(k.hash, generateApiKey().hash)).toBe(false)
    expect(sameHash(k.hash, '')).toBe(false)
  })

  test('solo acepta Bearer con la forma de una clave de Central', () => {
    const k = generateApiKey()
    expect(bearerKey(req(k.key))).toBe(k.key)
    expect(bearerKey(req())).toBeNull()
    expect(bearerKey(req('otra-cosa'))).toBeNull()
    expect(bearerKey(new Request('http://x', { headers: { authorization: `Basic ${k.key}` } }))).toBeNull()
  })
})

describe('autenticación de /api/v1', () => {
  test('sin cabecera: 401 y no llega a la ruta', async () => {
    const { readRoute } = setup()
    const r = await readRoute(req(), noParams)
    expect(r.status).toBe(401)
    expect(r.headers.get('www-authenticate')).toBe('Bearer')
    expect(calls).toBe(0)
  })

  test('clave desconocida: 401', async () => {
    const { readRoute } = setup()
    expect((await readRoute(req(generateApiKey().key), noParams)).status).toBe(401)
  })

  test('clave revocada: 401, aunque tenga el permiso', async () => {
    const { readRoute, anyRoute } = setup()
    expect((await readRoute(req(revoked.key), noParams)).status).toBe(401)
    expect((await anyRoute(req(revoked.key), noParams)).status).toBe(401)
    expect(calls).toBe(0)
  })

  test('clave de lectura en POST presupuestos: 403', async () => {
    const { quoteRoute } = setup()
    const r = await quoteRoute(req(reading.key, 'POST'), noParams)
    expect(r.status).toBe(403)
    expect(await r.json()).toEqual({ error: 'forbidden', scope: 'presupuestos' })
    expect(calls).toBe(0)
  })

  test('clave de presupuestos en GET clientes: 403', async () => {
    const { readRoute } = setup()
    expect((await readRoute(req(quotes.key), noParams)).status).toBe(403)
    expect(calls).toBe(0)
  })

  test('clave válida con su permiso: 200 y apunta el último uso', async () => {
    const { readRoute, quoteRoute, anyRoute, touched } = setup()
    expect((await readRoute(req(reading.key), noParams)).status).toBe(200)
    expect((await quoteRoute(req(quotes.key, 'POST'), noParams)).status).toBe(200)
    expect((await anyRoute(req(quotes.key), noParams)).status).toBe(200)
    expect(calls).toBe(3)
    expect(touched).toContain('k-lectura')
  })

  test(`límite de ${RATE_LIMIT} peticiones por minuto y clave: 429 y vuelve al minuto`, async () => {
    const { readRoute } = setup()
    for (let i = 0; i < RATE_LIMIT; i++) expect((await readRoute(req(reading.key), noParams)).status).toBe(200)
    const over = await readRoute(req(reading.key), noParams)
    expect(over.status).toBe(429)
    expect(Number(over.headers.get('retry-after'))).toBeGreaterThan(0)
    // otra clave no comparte el límite
    expect((await readRoute(req(revoked.key), noParams)).status).toBe(401)
    clock += 60_000
    expect((await readRoute(req(reading.key), noParams)).status).toBe(200)
  })

  test('el límite es por clave y lo comparten todas las rutas', async () => {
    const { readRoute, anyRoute } = setup()
    for (let i = 0; i < RATE_LIMIT / 2; i++) {
      expect((await readRoute(req(reading.key), noParams)).status).toBe(200)
      expect((await anyRoute(req(reading.key), noParams)).status).toBe(200)
    }
    expect((await anyRoute(req(reading.key), noParams)).status).toBe(429)
    expect((await readRoute(req(reading.key), noParams)).status).toBe(429)
    expect((await anyRoute(req(quotes.key), noParams)).status).toBe(200)
  })

  test('la clave nunca aparece en respuestas ni registros', async () => {
    const { auth, readRoute, quoteRoute } = setup()
    const failing = apiRoute('lectura', async () => { throw new Error('fallo de la base de datos') }, auth)
    const responses = [
      await readRoute(req(reading.key), noParams), await readRoute(req(quotes.key), noParams), await quoteRoute(req(revoked.key), noParams),
      await readRoute(req(`${reading.key}x`), noParams), await failing(req(reading.key), noParams),
    ]
    expect(responses.map((r) => r.status)).toEqual([200, 403, 401, 401, 500])
    for (const r of responses) {
      const text = `${await r.text()} ${JSON.stringify([...r.headers])}`
      for (const k of [reading, quotes, revoked]) { expect(text).not.toContain(k.key); expect(text).not.toContain(k.hash) }
    }
    expect(logs.length).toBeGreaterThan(0)
    for (const line of logs) for (const k of [reading, quotes, revoked]) { expect(line).not.toContain(k.key); expect(line).not.toContain(k.hash) }
  })

  test('entrada no válida: 400 con el detalle', async () => {
    const { auth } = setup()
    const { z } = await import('zod')
    const route = apiRoute('lectura', async () => { z.object({ n: z.number() }).parse({ n: 'x' }); return json({}) }, auth)
    const r = await route(req(reading.key), noParams)
    expect(r.status).toBe(400)
    expect((await r.json()).error).toBe('invalid')
  })
})
