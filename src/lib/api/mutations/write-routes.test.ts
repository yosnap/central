/**
 * Rutas de escritura de la API v1 de punta a punta (handler real, autenticación real y funciones comunes) con una BD
 * en memoria: permisos, validación (400/422), versión (409), estado fijado a mano, registro de cambios, que nunca
 * respondan 500 por datos del cliente y que no exista ningún DELETE. También la función común que usa la web.
 */
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { generateApiKey } from '../keys'

type Row = Record<string, unknown>
type Where = Record<string, unknown>
const TABLES = ['client', 'project', 'quote', 'quotePhase', 'website', 'note', 'apiChange', 'apiKey'] as const
type Table = (typeof TABLES)[number]
let db: Record<Table, Row[]>
let seq = 0

function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'OR') return (v as Where[]).some((w) => matches(row, w))
    if (v && typeof v === 'object' && 'equals' in v) return String(row[k]).toLowerCase() === String((v as { equals: string }).equals).toLowerCase()
    return row[k] === v
  })
}
const pick = (row: Row | undefined, select?: Record<string, boolean>) =>
  !row ? null : select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : { ...row }

function model(t: Table) {
  return {
    findMany: async ({ where }: { where?: Where } = {}) => db[t].filter((r) => matches(r, where)).map((r) => ({ ...r })),
    findFirst: async ({ where, select }: { where?: Where; select?: Record<string, boolean> }) => pick(db[t].find((r) => matches(r, where)), select),
    findUnique: async ({ where, select }: { where: Where; select?: Record<string, boolean> }) => pick(db[t].find((r) => matches(r, where)), select),
    findUniqueOrThrow: async ({ where }: { where: Where }) => {
      const r = db[t].find((x) => matches(x, where))
      if (!r) throw new Error('no encontrado')
      return { ...r }
    },
    create: async ({ data }: { data: Row }) => {
      const now = new Date()
      const row = { id: `${t}-${++seq}`, createdAt: now, updatedAt: now, pinned: false, ...data }
      db[t].push(row)
      return { ...row }
    },
    update: async ({ where, data, select }: { where: Where; data: Row; select?: Record<string, boolean> }) => {
      const r = db[t].find((x) => matches(x, where))
      if (!r) throw new Error('no encontrado')
      Object.assign(r, data, { updatedAt: new Date() })
      return pick(r, select)
    },
  }
}

const RAW_TABLE: Record<string, Table> = { '"Client"': 'client', '"Project"': 'project', '"QuotePhase"': 'quotePhase' }
const fakePrisma: Record<string, unknown> = {
  $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(fakePrisma),
  $executeRaw: async () => 1,
  $queryRaw: async (_s: TemplateStringsArray, table: { text?: string; sql?: string }, id: string) => {
    const t = RAW_TABLE[table.text ?? table.sql ?? '']
    return db[t].filter((r) => r.id === id).map((r) => ({ id: r.id }))
  },
  ...Object.fromEntries(TABLES.map((t) => [t, model(t)])),
}
mock.module('../../prisma', () => ({ prisma: fakePrisma }))
mock.module('next/cache', () => ({ revalidatePath: () => {} }))

const clientes = await import('../../../app/api/v1/clientes/route')
const cliente = await import('../../../app/api/v1/clientes/[id]/route')
const notas = await import('../../../app/api/v1/notas/route')
const proyecto = await import('../../../app/api/v1/proyectos/[id]/route')
const presupuesto = await import('../../../app/api/v1/presupuestos/[id]/route')
const fase = await import('../../../app/api/v1/presupuestos/[id]/fases/[faseId]/route')
const { updateClient } = await import('./clients')
const { updateQuotePhase } = await import('./quote-phases')

const keys = { lectura: generateApiKey(), escritura: generateApiKey(), todo: generateApiKey(), soloEscritura: generateApiKey() }

function seed() {
  seq = 0
  const at = new Date('2026-11-01T10:00:00Z')
  db = {
    apiKey: [
      { id: 'k-lectura', name: 'Lectora', prefix: keys.lectura.prefix, hash: keys.lectura.hash, scopes: ['lectura'], revokedAt: null, lastUsedAt: null },
      { id: 'k-escritura', name: 'AgoraOne', prefix: keys.escritura.prefix, hash: keys.escritura.hash, scopes: ['lectura', 'escritura'], revokedAt: null, lastUsedAt: null },
      { id: 'k-solo-escritura', name: 'Antigua', prefix: keys.soloEscritura.prefix, hash: keys.soloEscritura.hash, scopes: ['escritura'], revokedAt: null, lastUsedAt: null },
      { id: 'k-todo', name: 'AgoraOne completa', prefix: keys.todo.prefix, hash: keys.todo.hash, scopes: ['lectura', 'escritura', 'presupuestos'], revokedAt: null, lastUsedAt: null },
    ],
    client: [{ id: 'c1', name: 'Acme', company: null, email: 'hola@acme.es', phone: null, taxId: null, address: null, createdAt: at, updatedAt: at }],
    project: [
      { id: 'p1', name: 'Web Acme', kind: 'CLIENT', status: 'ACTIVE', statusLocked: false, phase: null, description: null, clientId: 'c1', excluded: false, updatedAt: at },
      { id: 'p2', name: 'Archivado a mano', kind: 'OWN', status: 'ARCHIVED', statusLocked: true, phase: 'Entrega', description: null, clientId: null, excluded: false, updatedAt: at },
      { id: 'p3', name: 'Excluido', kind: 'OWN', status: 'ACTIVE', statusLocked: false, phase: null, description: null, clientId: null, excluded: true, updatedAt: at },
    ],
    quote: [{ id: 'q1', number: 'P-2026-001' }, { id: 'q2', number: 'P-2026-002' }],
    quotePhase: [
      { id: 'f1', quoteId: 'q1', name: 'Anticipo', description: null, percent: 30, dueDate: null, status: 'PENDING', completedAt: null },
      { id: 'f2', quoteId: 'q2', name: 'Final', description: null, percent: 70, dueDate: null, status: 'PENDING', completedAt: null },
    ],
    website: [{ id: 'w1', url: 'https://acme.es' }],
    note: [],
    apiChange: [],
  }
}
beforeEach(seed)

type RouteFn = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>
async function call(fn: RouteFn, method: string, path: string, opts: { key?: string; body?: unknown; raw?: string; params?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.key) headers.authorization = `Bearer ${opts.key}`
  const req = new Request(`http://localhost:3099/api/v1${path}`, { method, headers, body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)) })
  const res = await fn(req, { params: Promise.resolve(opts.params ?? {}) })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> & { error?: string; detail?: string } }
}
const W = keys.escritura.key
const versionOfClient = async () => ((await call(cliente.GET as RouteFn, 'GET', '/clientes/c1', { key: W, params: { id: 'c1' } })).json.version as string)

describe('permisos', () => {
  const writes: [string, RouteFn, string, Record<string, string>][] = [
    ['POST clientes', clientes.POST as RouteFn, 'POST', {}],
    ['PATCH clientes/{id}', cliente.PATCH as RouteFn, 'PATCH', { id: 'c1' }],
    ['POST notas', notas.POST as RouteFn, 'POST', {}],
    ['PATCH proyectos/{id}', proyecto.PATCH as RouteFn, 'PATCH', { id: 'p1' }],
    ['PATCH fases', fase.PATCH as RouteFn, 'PATCH', { id: 'q1', faseId: 'f1' }],
  ]
  for (const [name, fn, method, params] of writes) {
    test(`${name}: 401 sin clave y 403 con una clave de lectura, sin escribir nada`, async () => {
      expect((await call(fn, method, '/x', { body: { name: 'X' }, params })).status).toBe(401)
      const r = await call(fn, method, '/x', { key: keys.lectura.key, body: { name: 'X' }, params })
      expect(r.status).toBe(403)
      expect(r.json).toEqual({ error: 'forbidden', scope: 'escritura' })
      expect(db.client).toHaveLength(1)
      expect(db.apiChange).toHaveLength(0)
    })
  }

  test('escritura sin lectura: 403 por lectura, también con una versión vieja (no devuelve la ficha en un 409)', async () => {
    for (const [name, fn, method, params] of writes) {
      const r = await call(fn, method, '/x', { key: keys.soloEscritura.key, body: { version: 'a'.repeat(20), phone: '1', name: 'X', body: 'x', clientId: 'c1' }, params })
      expect([name, r.status, r.json.scope, 'current' in r.json]).toEqual([name, 403, 'lectura', false])
    }
    expect(db.apiChange).toHaveLength(0)
  })

  test('al crear una clave, escritura lleva siempre lectura', async () => {
    const { withImpliedScopes } = await import('../scopes')
    expect(withImpliedScopes(['escritura'])).toEqual(['lectura', 'escritura'])
    expect(withImpliedScopes(['presupuestos', 'escritura', 'escritura'])).toEqual(['lectura', 'presupuestos', 'escritura'])
    expect(withImpliedScopes(['presupuestos'])).toEqual(['presupuestos'])
  })

  test('las fases piden además el permiso de presupuestos', async () => {
    const r = await call(fase.PATCH as RouteFn, 'PATCH', '/x', { key: W, body: { version: 'a'.repeat(20), status: 'DONE' }, params: { id: 'q1', faseId: 'f1' } })
    expect(r.status).toBe(403)
    expect(r.json.scope).toBe('presupuestos')
  })

  test('ninguna ruta de la API v1 exporta DELETE', async () => {
    for (const m of [clientes, cliente, notas, proyecto, presupuesto, fase]) expect('DELETE' in m).toBe(false)
  })
})

describe('clientes', () => {
  test('alta: 201 con el cliente limpio y su versión, y queda en el registro con el nombre de la app', async () => {
    const r = await call(clientes.POST as RouteFn, 'POST', '/clientes', { key: W, body: { name: '  Nueva SL ', email: 'a@nueva.es', taxId: 'B12345678', address: null } })
    expect(r.status).toBe(201)
    const c = r.json.client as Row
    expect(c).toMatchObject({ name: 'Nueva SL', email: 'a@nueva.es', taxId: 'B12345678', address: null })
    expect(typeof c.version).toBe('string')
    expect(db.apiChange).toEqual([expect.objectContaining({ keyId: 'k-escritura', keyName: 'AgoraOne', action: 'create', entity: 'client', entityId: c.id })])
    expect((db.apiChange[0].changes as Row).name).toEqual({ from: null, to: 'Nueva SL' })
  })

  test('alta con un nombre que ya existe (sin distinguir mayúsculas): 409 duplicate', async () => {
    const r = await call(clientes.POST as RouteFn, 'POST', '/clientes', { key: W, body: { name: 'ACME' } })
    expect(r.status).toBe(409)
    expect(r.json.error).toBe('duplicate')
    expect(db.client).toHaveLength(1)
  })

  test('validación: 400 si no es JSON; 422 con campos desconocidos, correo malo, nombre vacío o textos largos', async () => {
    expect((await call(clientes.POST as RouteFn, 'POST', '/clientes', { key: W, raw: '{nombre' })).status).toBe(400)
    for (const body of [{ name: 'X', id: 'c9' }, { name: 'X', email: 'no-es-correo' }, { name: '   ' }, { name: 'X', address: 'a'.repeat(501) }, {}, []]) {
      const r = await call(clientes.POST as RouteFn, 'POST', '/clientes', { key: W, body })
      expect(r.status).toBe(422)
      expect(r.json.error).toBe('invalid')
    }
    expect(db.client).toHaveLength(1)
  })

  test('cambio con la versión leída: 200, solo lo que cambia, y registro de antes y después', async () => {
    const version = await versionOfClient()
    const r = await call(cliente.PATCH as RouteFn, 'PATCH', '/clientes/c1', { key: W, params: { id: 'c1' }, body: { version, phone: '600 000 000', email: 'hola@acme.es' } })
    expect(r.status).toBe(200)
    const c = r.json.client as Row
    expect(c.phone).toBe('600 000 000')
    expect(c.version).not.toBe(version)
    expect(db.apiChange).toHaveLength(1)
    expect(db.apiChange[0].changes).toEqual({ phone: { from: null, to: '600 000 000' } })
  })

  test('con una versión vieja: 409 conflict con el cliente actual y sin cambiar nada', async () => {
    const old = await versionOfClient()
    await call(cliente.PATCH as RouteFn, 'PATCH', '/clientes/c1', { key: W, params: { id: 'c1' }, body: { version: old, company: 'Acme SL' } })
    const r = await call(cliente.PATCH as RouteFn, 'PATCH', '/clientes/c1', { key: W, params: { id: 'c1' }, body: { version: old, company: 'Otra' } })
    expect(r.status).toBe(409)
    expect(r.json.error).toBe('conflict')
    expect((r.json.current as Row).company).toBe('Acme SL')
    expect(db.client[0].company).toBe('Acme SL')
  })

  test('sin versión o con un cliente que no existe: 422 y 404', async () => {
    expect((await call(cliente.PATCH as RouteFn, 'PATCH', '/clientes/c1', { key: W, params: { id: 'c1' }, body: { phone: '1' } })).status).toBe(422)
    expect((await call(cliente.PATCH as RouteFn, 'PATCH', '/clientes/c1', { key: W, params: { id: 'c1' }, body: { version: await versionOfClient() } })).status).toBe(422)
    expect((await call(cliente.PATCH as RouteFn, 'PATCH', '/clientes/zz', { key: W, params: { id: 'zz' }, body: { version: 'a'.repeat(20), phone: '1' } })).status).toBe(404)
  })

  test('la función común que usa la web cambia sin versión y no apunta nada en el registro', async () => {
    const c = await updateClient('c1', { company: 'Desde la web' })
    expect(c.company).toBe('Desde la web')
    expect(db.apiChange).toHaveLength(0)
  })
})

describe('notas', () => {
  test('201 en un proyecto, con source api y registro', async () => {
    const r = await call(notas.POST as RouteFn, 'POST', '/notas', { key: W, body: { body: 'Llamar el lunes', projectId: 'p1' } })
    expect(r.status).toBe(201)
    expect(r.json.note).toMatchObject({ body: 'Llamar el lunes', projectId: 'p1', source: 'api' })
    expect(db.apiChange[0]).toMatchObject({ entity: 'note', keyName: 'AgoraOne' })
  })

  test('422 sin destino, con dos destinos o vacía', async () => {
    for (const body of [{ body: 'x' }, { body: 'x', clientId: 'c1', projectId: 'p1' }, { body: '', clientId: 'c1' }]) {
      expect((await call(notas.POST as RouteFn, 'POST', '/notas', { key: W, body })).status).toBe(422)
    }
    expect(db.note).toHaveLength(0)
  })

  test('404 con un destino que no existe o con un proyecto excluido (como si no existiera)', async () => {
    for (const body of [{ body: 'x', websiteId: 'w9' }, { body: 'x', clientId: 'c9' }, { body: 'x', projectId: 'p3' }]) {
      const r = await call(notas.POST as RouteFn, 'POST', '/notas', { key: W, body })
      expect([JSON.stringify(body), r.status, r.json.error]).toEqual([JSON.stringify(body), 404, 'not_found'])
    }
    expect(db.note).toHaveLength(0)
  })
})

describe('proyectos', () => {
  const version = async (id: string) => ((await call(proyecto.GET as RouteFn, 'GET', `/proyectos/${id}`, { key: W, params: { id } })).json.version as string)

  test('cambia estado y fase de un proyecto sin fijar', async () => {
    const r = await call(proyecto.PATCH as RouteFn, 'PATCH', '/proyectos/p1', { key: W, params: { id: 'p1' }, body: { version: await version('p1'), status: 'MAINTENANCE', phase: 'Soporte' } })
    expect(r.status).toBe(200)
    expect(r.json.project).toMatchObject({ status: 'MAINTENANCE', phase: 'Soporte', statusLocked: false })
  })

  test('con el estado fijado a mano no lo cambia (409 status_locked) salvo que se diga qué hacer con el fijado', async () => {
    const v = await version('p2')
    const r = await call(proyecto.PATCH as RouteFn, 'PATCH', '/proyectos/p2', { key: W, params: { id: 'p2' }, body: { version: v, status: 'ACTIVE' } })
    expect(r.status).toBe(409)
    expect(r.json.error).toBe('status_locked')
    expect(db.project[1].status).toBe('ARCHIVED')
    const ok = await call(proyecto.PATCH as RouteFn, 'PATCH', '/proyectos/p2', { key: W, params: { id: 'p2' }, body: { version: v, status: 'ACTIVE', statusLocked: true } })
    expect(ok.status).toBe(200)
    expect(db.project[1]).toMatchObject({ status: 'ACTIVE', statusLocked: true })
  })

  test('la fase se puede cambiar aunque el estado esté fijado', async () => {
    const r = await call(proyecto.PATCH as RouteFn, 'PATCH', '/proyectos/p2', { key: W, params: { id: 'p2' }, body: { version: await version('p2'), phase: null } })
    expect(r.status).toBe(200)
    expect(db.project[1]).toMatchObject({ status: 'ARCHIVED', phase: null })
  })

  test('422 con un estado que no existe; 404 con un proyecto excluido', async () => {
    expect((await call(proyecto.PATCH as RouteFn, 'PATCH', '/proyectos/p1', { key: W, params: { id: 'p1' }, body: { version: await version('p1'), status: 'BORRADO' } })).status).toBe(422)
    expect((await call(proyecto.PATCH as RouteFn, 'PATCH', '/proyectos/p3', { key: W, params: { id: 'p3' }, body: { version: 'a'.repeat(20), phase: 'x' } })).status).toBe(404)
  })
})

describe('fases de presupuesto', () => {
  const T = keys.todo.key
  const phaseVersion = (id: string) => {
    const p = db.quotePhase.find((f) => f.id === id) as Row
    return import('./quote-phases').then((m) => m.quotePhaseVersion(p as Parameters<typeof m.quotePhaseVersion>[0]))
  }

  test('hecha: apunta cuándo; por número de presupuesto; registro con la app', async () => {
    const r = await call(fase.PATCH as RouteFn, 'PATCH', '/x', { key: T, params: { id: 'P-2026-001', faseId: 'f1' }, body: { version: await phaseVersion('f1'), status: 'DONE', dueDate: '2026-12-01' } })
    expect(r.status).toBe(200)
    const p = r.json.phase as Row
    expect(p).toMatchObject({ status: 'DONE', dueDate: '2026-12-01T12:00:00.000Z' })
    expect(p.completedAt).not.toBeNull()
    expect(db.apiChange[0]).toMatchObject({ entity: 'quotePhase', entityId: 'f1', keyName: 'AgoraOne completa' })
  })

  test('una fase de otro presupuesto: 404; fecha imposible: 422; versión vieja: 409', async () => {
    expect((await call(fase.PATCH as RouteFn, 'PATCH', '/x', { key: T, params: { id: 'q1', faseId: 'f2' }, body: { version: await phaseVersion('f2'), status: 'DONE' } })).status).toBe(404)
    expect((await call(fase.PATCH as RouteFn, 'PATCH', '/x', { key: T, params: { id: 'q1', faseId: 'f1' }, body: { version: await phaseVersion('f1'), dueDate: '2026-02-31' } })).status).toBe(422)
    expect((await call(fase.PATCH as RouteFn, 'PATCH', '/x', { key: T, params: { id: 'q1', faseId: 'f1' }, body: { version: 'b'.repeat(20), status: 'DONE' } })).status).toBe(409)
    expect(db.quotePhase[0].status).toBe('PENDING')
  })

  test('función común (web y MCP): de hecha a facturada conserva la fecha; al volver atrás se borra', async () => {
    const done = await updateQuotePhase('f1', { status: 'DONE' })
    const invoiced = await updateQuotePhase('f1', { status: 'INVOICED' })
    expect(invoiced.completedAt).toEqual(done.completedAt)
    expect((await updateQuotePhase('f1', { status: 'PENDING' })).completedAt).toBeNull()
    expect(db.apiChange).toHaveLength(0)
  })
})

describe('base de datos ocupada', () => {
  test('un tiempo de espera o conflicto de la transacción (P2028, P2034) da 503 con Retry-After, nunca 500', async () => {
    const { Prisma } = await import('../../../generated/prisma/client')
    const original = fakePrisma.$transaction
    try {
      for (const code of ['P2028', 'P2034']) {
        fakePrisma.$transaction = async () => { throw new Prisma.PrismaClientKnownRequestError('Transaction already closed', { code, clientVersion: 'prueba' }) }
        const req = new Request('http://localhost:3099/api/v1/clientes', { method: 'POST', headers: { authorization: `Bearer ${W}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Ocupada' }) })
        const res = await (clientes.POST as RouteFn)(req, { params: Promise.resolve({}) })
        expect([code, res.status, res.headers.get('retry-after'), ((await res.json()) as Row).error]).toEqual([code, 503, '2', 'busy'])
      }
    } finally { fakePrisma.$transaction = original }
  })
})
