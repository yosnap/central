/**
 * Servidor MCP de Central (stdio). Conéctalo en Claude Desktop / Claude Code:
 *   "central": { "command": "bun", "args": ["/ruta/a/Central/src/mcp/server.ts"],
 *                "env": { "DATABASE_URL": "postgresql://central:central@localhost:5435/central" } }
 */
import 'dotenv/config'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { searchMail } from '../lib/google'
import { listClients } from '../lib/api/clients'
import { agendaEvents } from '../lib/api/events'
import { listPending } from '../lib/api/pending'
import { PROJECT_KINDS, PROJECT_STATUSES, getProject, listProjects } from '../lib/api/projects'
import { QUOTE_STATUSES, createQuote, createQuoteShape, getQuote, listQuotes } from '../lib/api/quotes'
import { listWebsites } from '../lib/api/websites'
import { updateQuotePhase } from '../lib/api/mutations/quote-phases'

const server = new McpServer({ name: 'central', version: '0.1.0' })
const text = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] })

server.registerTool('list_projects', {
  description: 'Lista proyectos de Central con estado, versión, stack, cliente y última actividad. Filtra por tipo, estado, cliente o texto.',
  inputSchema: {
    kind: z.enum(PROJECT_KINDS).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    client: z.string().optional().describe('Nombre (o parte) del cliente'),
    query: z.string().optional().describe('Texto en el nombre o tecnología del stack'),
    limit: z.number().int().min(1).max(200).default(50),
  },
}, async ({ kind, status, client, query, limit }) => text((await listProjects({ kind, status, client, query, limit })).projects))

server.registerTool('get_project', {
  description: 'Ficha completa de un proyecto: repositorio, ubicaciones en disco, webs y notas.',
  inputSchema: { id: z.string().describe('id del proyecto (de list_projects)') },
}, async ({ id }) => {
  const p = await getProject(id)
  return p ? text(p) : { content: [{ type: 'text', text: 'Proyecto no encontrado' }], isError: true }
})

server.registerTool('list_websites', {
  description: 'Webs monitorizadas con su último estado (en línea / caída), código HTTP y tiempo de respuesta.',
  inputSchema: { kind: z.enum(['CLIENT', 'OWN', 'CENTRAL']).optional(), onlyDown: z.boolean().default(false) },
}, async ({ kind, onlyDown }) => text(await listWebsites({ kind, onlyDown })))

server.registerTool('add_note', {
  description: 'Guarda una nota en Central asociada a un proyecto, un cliente o una web.',
  inputSchema: { body: z.string().min(1), projectId: z.string().optional(), clientName: z.string().optional(), websiteId: z.string().optional() },
}, async ({ body, projectId, clientName, websiteId }) => {
  const client = clientName ? await prisma.client.findFirst({ where: { name: { equals: clientName, mode: 'insensitive' } } }) : null
  if (clientName && !client) return { content: [{ type: 'text', text: `No existe el cliente "${clientName}"` }], isError: true }
  const n = await prisma.note.create({ data: { body, projectId, websiteId, clientId: client?.id, source: 'mcp' } })
  return text({ saved: n.id })
})

server.registerTool('list_pending', {
  description: 'Proyectos de clientes o propios (activos o en mantenimiento) a los que les falta información: despliegue, dominios, hosting, cliente, fase o descripción.',
  inputSchema: {},
}, async () => text(await listPending()))

server.registerTool('get_repo_status', {
  description: 'Repositorio de un proyecto frente a origin: commits sin subir y por bajar por rama, ramas solo locales o remotas, stash, y datos del proveedor (visibilidad, último push, PRs, issues, CI, release).',
  inputSchema: { id: z.string().describe('id del proyecto (de list_projects)') },
}, async ({ id }) => {
  const p = await prisma.project.findUnique({ where: { id }, include: { remotes: true } })
  if (!p) return text({ error: 'No existe' })
  return text({
    name: p.name, branch: p.defaultBranch, lastCommitAt: p.lastCommitAt, uncommitted: p.uncommitted,
    ahead: p.aheadTotal, behind: p.behindTotal, stash: p.stashCount, lastFetchAt: p.lastFetchAt, fetchError: p.fetchError,
    branches: p.branchStatus, localOnlyBranches: p.localOnlyBranches, remoteOnlyBranches: p.remoteOnlyBranches,
    remotes: p.remotes.map((r) => ({ name: r.name, provider: r.provider, url: r.url, visibility: r.visibility, defaultBranch: r.defaultBranch, lastPushAt: r.lastPushAt, openPrs: r.openPrs, openIssues: r.openIssues, ci: r.ciStatus, latestRelease: r.latestRelease, archived: r.archived, error: r.syncError, syncedAt: r.syncedAt })),
  })
})

server.registerTool('list_clients', {
  description: 'Clientes con número de proyectos y webs.',
  inputSchema: {},
}, async () => text((await listClients()).map((c) => ({ id: c.id, name: c.name, projects: c.projects, websites: c.websites }))))

server.registerTool('list_servers', {
  description: 'Servidores vigilados con su estado (green/amber/red/grey), CPU, memoria, disco, servicios Docker, protección y los proyectos que aloja.',
  inputSchema: {},
}, async () => {
  const { listServersPublic } = await import('../lib/servers/public')
  return text(await listServersPublic())
})

server.registerTool('get_server', {
  description: 'Ficha de un servidor: tarjetas de salud, comprobaciones de protección con su arreglo, contenedores y proyectos.',
  inputSchema: { id: z.string().describe('id del servidor (de list_servers)') },
}, async ({ id }) => {
  const { getServerPublic } = await import('../lib/servers/public')
  const s = await getServerPublic(id)
  return s ? text(s) : { content: [{ type: 'text', text: 'Servidor no encontrado' }], isError: true }
})

server.registerTool('get_project_health', {
  description: 'Salud de un proyecto: cada servicio con su web (en línea, ms, SSL), su contenedor y el estado del servidor donde vive.',
  inputSchema: { id: z.string().describe('id del proyecto (de list_projects)') },
}, async ({ id }) => {
  const { visibleStatus } = await import('../lib/servers/collect')
  const p = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true, name: true,
      services: { select: { name: true, environment: true, url: true, website: { select: { lastStatus: true, lastMs: true, kumaStatus: true, kumaMs: true, sslDaysLeft: true } }, containers: { select: { name: true, state: true, detail: true } }, server: { select: { id: true, name: true, status: true, error: true, lastOkAt: true, intervalSec: true } } } },
    },
  })
  if (!p) return { content: [{ type: 'text', text: 'Proyecto no encontrado' }], isError: true }
  return text({ id: p.id, name: p.name, services: p.services.map((s) => ({ ...s, server: s.server ? { id: s.server.id, name: s.server.name, status: visibleStatus(s.server), error: s.server.error } : null })) })
})

server.registerTool('list_quotes', {
  description: 'Presupuestos con número, título, cliente, estado (un enviado fuera de plazo sale EXPIRED) y total con IVA en euros (totalMax si hay fases de precio variable). Filtra por cliente o estado.',
  inputSchema: {
    client: z.string().optional().describe('Nombre (o parte) del cliente'),
    status: z.enum(QUOTE_STATUSES).optional(),
  },
}, async ({ client, status }) => text(await listQuotes({ client, status })))

server.registerTool('get_quote', {
  description: 'Un presupuesto completo: partidas, base, IVA, total y fases con su importe y estado. Importes en euros.',
  inputSchema: { id: z.string().describe('Id o número (P-2026-001) del presupuesto') },
}, async ({ id }) => {
  const q = await getQuote(id)
  return q ? text(q) : { content: [{ type: 'text', text: 'Presupuesto no encontrado' }], isError: true }
})

server.registerTool('create_quote', {
  description: 'Crea un presupuesto en borrador con el siguiente número del año: desglose por fases o paquetes (precio fijo, o rango con priceMax; nunca por horas), hitos de pago y secciones del documento. Precios sin IVA, en euros. Devuelve su id y número.',
  inputSchema: createQuoteShape,
}, async (input) => {
  const r = await createQuote(input)
  if (!r.ok) return { content: [{ type: 'text', text: `No hay ningún cliente «${input.client}». Usa list_clients.` }], isError: true }
  return text({ id: r.id, number: r.number })
})

server.registerTool('update_phase', {
  description: 'Cambia el estado o la fecha prevista de una fase de un presupuesto (PENDING, IN_PROGRESS, DONE, INVOICED).',
  inputSchema: {
    quote: z.string().describe('Id o número (P-2026-001) del presupuesto'),
    phase: z.string().describe('Id o nombre de la fase'),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'INVOICED']).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
}, async ({ quote, phase, status, dueDate }) => {
  const p = await prisma.quotePhase.findFirst({ where: { quote: { OR: [{ id: quote }, { number: quote }] }, OR: [{ id: phase }, { name: { equals: phase, mode: 'insensitive' } }] } })
  if (!p) return { content: [{ type: 'text', text: 'Fase no encontrada. Usa get_quote para ver sus fases.' }], isError: true }
  const updated = await updateQuotePhase(p.id, { status, dueDate: dueDate ? new Date(`${dueDate}T12:00:00Z`) : undefined })
  return text({ id: updated.id, name: updated.name, status: updated.status, dueDate: updated.dueDate, completedAt: updated.completedAt })
})

server.registerTool('search_messages', {
  description: 'Busca correos. Por defecto en los guardados en Central (ligados a cliente o proyecto); con live=true busca también en Gmail con su sintaxis (from:, subject:, newer_than:7d…). Solo lectura.',
  inputSchema: {
    query: z.string().optional().describe('Texto a buscar (asunto, remitente o contenido); en live, sintaxis de Gmail'),
    client: z.string().optional().describe('Nombre (o parte) del cliente, para los guardados'),
    live: z.boolean().default(false),
    limit: z.number().int().min(1).max(50).default(20),
  },
}, async ({ query, client, live, limit }) => {
  const savedRows = await prisma.savedMessage.findMany({
    where: {
      ...(client ? { client: { name: { contains: client, mode: 'insensitive' } } } : {}),
      ...(query ? { OR: ['subject', 'fromAddress', 'body', 'snippet'].map((f) => ({ [f]: { contains: query, mode: 'insensitive' } })) } : {}),
    },
    orderBy: { receivedAt: 'desc' }, take: limit, include: { client: { select: { name: true } }, project: { select: { name: true } } },
  })
  const saved = savedRows.map((m) => ({ id: m.id, from: m.fromAddress, subject: m.subject, date: m.receivedAt, client: m.client?.name, project: m.project?.name, snippet: m.snippet, body: m.body?.slice(0, 2000) }))
  if (!live) return text({ saved })
  const accounts = await prisma.integrationConnection.findMany({ where: { provider: 'GOOGLE' }, select: { id: true, account: true } })
  const gmail = (await Promise.all(accounts.map((a) => searchMail(a.id, query || 'in:inbox', limit).then((r) => r.map((h) => ({ account: a.account, from: h.from, subject: h.subject, date: h.date, snippet: h.snippet }))).catch((e: Error) => [{ account: a.account, error: e.message }])))).flat()
  return text({ saved, gmail })
})

server.registerTool('list_events', {
  description: 'Eventos de la agenda (calendarios de Google elegidos en Ajustes) entre dos fechas, con el cliente o proyecto ligado. Por defecto, los próximos 14 días.',
  inputSchema: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    client: z.string().optional().describe('Solo los ligados a este cliente (nombre o parte)'),
  },
}, async ({ from, to, client }) => {
  const start = from ? new Date(`${from}T00:00:00`) : new Date()
  const end = to ? new Date(`${to}T23:59:59`) : new Date(start.getTime() + 14 * 864e5)
  return text(await agendaEvents(start, end, client))
})

await server.connect(new StdioServerTransport())
