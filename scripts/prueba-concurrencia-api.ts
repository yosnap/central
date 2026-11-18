/**
 * Prueba de concurrencia de las escrituras de la API v1 contra la BD local de desarrollo (no la de producción).
 * `bun test` usa una BD en memoria sin aislamiento: esto comprueba de verdad el cerrojo de la fila (`FOR UPDATE`) y el
 * consultivo de los nombres. Crea sus datos con el prefijo «prueba-concurrencia» y los borra al terminar, pase lo que
 * pase. Uso: `bun run test:bd` con `docker compose up -d`.
 */
import 'dotenv/config'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
let dbHost = ''
try { dbHost = new URL(process.env.DATABASE_URL ?? '').hostname } catch { /* sin URL válida */ }
if (!LOCAL_HOSTS.has(dbHost) || process.env.NODE_ENV === 'production') {
  console.error('Esta prueba solo se ejecuta contra la BD local de desarrollo (DATABASE_URL en localhost).')
  process.exit(2)
}

const { prisma } = await import('../src/lib/prisma')
const { createClient, updateClient, clientVersion } = await import('../src/lib/api/mutations/clients')
const { updateProjectState, projectVersion } = await import('../src/lib/api/mutations/projects')
const { updateQuotePhase, quotePhaseVersion } = await import('../src/lib/api/mutations/quote-phases')
const { MutationError } = await import('../src/lib/api/mutations/errors')

const TAG = 'prueba-concurrencia'
const N = 8
const actor = { keyId: `${TAG}-clave`, keyName: TAG }
let failures = 0

/** Lanza N escrituras a la vez y cuenta cuántas terminan bien y con qué error acaban las demás. */
async function race(name: string, run: (i: number) => Promise<unknown>, expectWins: number, expectCode: string) {
  const results = await Promise.allSettled(Array.from({ length: N }, (_, i) => run(i)))
  const wins = results.filter((r) => r.status === 'fulfilled').length
  const codes = results.flatMap((r) => (r.status === 'rejected' ? [r.reason instanceof MutationError ? r.reason.code : `otro: ${r.reason instanceof Error ? r.reason.message : 'error'}`] : []))
  const ok = wins === expectWins && codes.every((c) => c === expectCode)
  if (!ok) failures++
  console.log(`${ok ? 'OK ' : 'MAL'} ${name}: ${wins} de ${N} bien, el resto ${[...new Set(codes)].join(', ') || '—'}`)
}

try {
  const client = await createClient({ name: `${TAG} cliente` }, { actor })
  await race('PATCH de un cliente con la misma versión', (i) => updateClient(client.id, { phone: `60000000${i}` }, { actor, expectedVersion: client.version }), 1, 'conflict')
  const after = await prisma.client.findUniqueOrThrow({ where: { id: client.id } })
  const logged = await prisma.apiChange.count({ where: { keyId: actor.keyId, entity: 'client', action: 'update', entityId: client.id } })
  const coherent = clientVersion(after) !== client.version && logged === 1
  if (!coherent) failures++
  console.log(`${coherent ? 'OK ' : 'MAL'} el cliente quedó con un solo cambio registrado (${logged})`)

  await race('altas simultáneas con el mismo nombre', () => createClient({ name: `${TAG} repetido` }, { actor }), 1, 'duplicate')

  const project = await prisma.project.create({ data: { slug: `${TAG}-proyecto`, name: `${TAG} proyecto`, status: 'ACTIVE' } })
  await race('PATCH de un proyecto con la misma versión', (i) => updateProjectState(project.id, { phase: `Fase ${i}` }, { actor, expectedVersion: projectVersion(project) }), 1, 'conflict')

  const quote = await prisma.quote.create({ data: { number: `${TAG}-001`, title: TAG, clientId: client.id, phases: { create: [{ name: 'Anticipo', percent: 50 }] } }, include: { phases: true } })
  const phase = quote.phases[0]
  await race('PATCH de una fase con la misma versión', (i) => updateQuotePhase(phase.id, { status: i % 2 ? 'DONE' : 'IN_PROGRESS' }, { actor, expectedVersion: quotePhaseVersion(phase), quoteId: quote.id }), 1, 'conflict')
} catch (e) {
  failures++
  console.error(`MAL excepción: ${e instanceof Error ? e.message : 'error'}`)
} finally {
  await prisma.apiChange.deleteMany({ where: { keyId: actor.keyId } })
  await prisma.quote.deleteMany({ where: { number: { startsWith: TAG } } })
  await prisma.project.deleteMany({ where: { slug: { startsWith: TAG } } })
  await prisma.client.deleteMany({ where: { name: { startsWith: TAG } } })
  const left = await prisma.client.count({ where: { name: { startsWith: TAG } } }) + await prisma.project.count({ where: { slug: { startsWith: TAG } } })
    + await prisma.quote.count({ where: { number: { startsWith: TAG } } }) + await prisma.apiChange.count({ where: { keyId: actor.keyId } })
  console.log(`limpieza: quedan ${left} filas de prueba`)
  await prisma.$disconnect()
}
process.exit(failures ? 1 : 0)
