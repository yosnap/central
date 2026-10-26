/**
 * Trabajador del Mac: con Central en producción, hace lo que solo puede hacer este Mac. Solo sale hacia Central:
 * cada pocos segundos avisa de que está vivo, recoge trabajos y devuelve el resultado. Nada entra en el Mac.
 *
 * Seguridad: solo acepta los tipos de trabajo de `handlers`, valida cada dato con Zod y nunca ejecuta comandos ni
 * opciones que vengan de Central: el comando de Claude Code se construye en src/lib/claude-cli.ts con opciones fijas.
 *
 *   CENTRAL_URL=https://central.sn4p.dev  CENTRAL_WORKER_TOKEN=…  bun run trabajador
 */
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { z } from 'zod'
import { runAssistant } from '../src/lib/claude-cli'
import { pathMap, scanRoots } from '../src/lib/scan-roots'

const BASE = (process.env.CENTRAL_URL ?? '').replace(/\/$/, '')
const TOKEN = process.env.CENTRAL_WORKER_TOKEN ?? ''
const EVERY_MS = 5000
const VERSION = '1'
// una carpeta por presupuesto: Claude Code sigue la conversación (--resume) desde la misma carpeta
const WORK = path.join(os.homedir(), 'Library', 'Application Support', 'Central', 'quotes')
// carpetas que el Mac deja escanear; las decide el Mac, no Central (separadas por «;»)
const ROOTS = (process.env.CENTRAL_WORKER_ROOTS ?? '').split(';').map((r) => r.trim()).filter((r) => path.isAbsolute(r))

if (!/^https?:\/\//.test(BASE) || TOKEN.length < 32) {
  console.error('Faltan CENTRAL_URL o CENTRAL_WORKER_TOKEN (32+ caracteres)')
  process.exit(1)
}

const api = (p: string, init: RequestInit = {}) =>
  fetch(`${BASE}${p}`, { ...init, headers: { ...init.headers, authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' } })
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a)

const safeName = z.string().min(1).max(200).refine((n) => n === path.basename(n) && !n.startsWith('.'), 'Nombre de fichero no válido')
const Assistant = z.object({
  quoteId: z.string().regex(/^[\w-]{1,40}$/),
  run: z.object({
    system: z.string().max(40_000),
    fresh: z.string().max(200_000),
    resume: z.object({ sessionId: z.string().uuid(), prompt: z.string().max(200_000) }).optional(),
  }),
  files: z.array(safeName).max(20),
})

const Scan = z.object({ fetch: z.enum(['none', 'active', 'all']), known: z.array(z.string().max(1000)).max(20_000) })

const handlers: Record<string, (payload: unknown) => Promise<unknown>> = {
  /**
   * Escaneo de las carpetas de CENTRAL_WORKER_ROOTS (nunca otras). De las rutas que conoce Central solo se dice si
   * siguen existiendo, y solo las que están dentro de esas carpetas.
   */
  async scan(payload) {
    const { fetch, known } = Scan.parse(payload)
    const roots = ROOTS.filter((r) => existsSync(r))
    if (!roots.length) throw new Error('El Mac no tiene carpetas que escanear: define CENTRAL_WORKER_ROOTS en el trabajador (o el disco no está conectado)')
    const inside = (p: string) => roots.some((r) => p === r || p.startsWith(r.replace(/\/$/, '') + '/'))
    const projects = scanRoots(roots, pathMap(), log, fetch)
    return { roots, projects, existing: [...roots, ...known.filter((p) => inside(p) && existsSync(p))] }
  },

  /** Una vuelta del asistente de presupuestos: baja los documentos nuevos a su carpeta y ejecuta Claude Code. */
  async assistant(payload) {
    const { quoteId, run, files } = Assistant.parse(payload)
    const dir = path.join(WORK, quoteId)
    await fs.mkdir(dir, { recursive: true })
    for (const name of files) {
      const r = await api(`/api/worker/files/${encodeURIComponent(quoteId)}/${encodeURIComponent(name)}`)
      if (!r.ok) throw new Error(`No se ha podido bajar «${name}» (${r.status})`)
      await fs.writeFile(path.join(dir, name), Buffer.from(await r.arrayBuffer()))
    }
    return runAssistant(run, dir)
  },
}

type Job = { id: string; type: string; payload: unknown }
const running = new Set<string>()

async function work(job: Job) {
  running.add(job.id)
  log('trabajo', job.type, job.id)
  let body: { result?: unknown; error?: string }
  try {
    const fn = handlers[job.type]
    body = fn ? { result: await fn(job.payload) } : { error: `Este trabajador no sabe hacer «${job.type}»; actualízalo` }
  } catch (e) {
    body = { error: (e instanceof z.ZodError ? 'Datos del trabajo no válidos' : (e as Error).message).slice(0, 1500) }
  }
  for (let i = 0; i < 5; i++) {
    const r = await api(`/api/worker/jobs/${encodeURIComponent(job.id)}`, { method: 'POST', body: JSON.stringify(body) }).catch(() => null)
    if (r?.ok) break
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)))
  }
  log(body.error ? `error: ${body.error}` : 'hecho', job.id)
  running.delete(job.id)
}

async function beat() {
  try {
    const r = await api('/api/worker/beat', { method: 'POST', body: JSON.stringify({ hostname: os.hostname(), version: VERSION, roots: ROOTS }) })
    if (r.status === 401) { log('token rechazado: revisa CENTRAL_WORKER_TOKEN'); return }
    if (!r.ok) { log('Central responde', r.status); return }
    const { jobs } = (await r.json()) as { jobs: Job[] }
    for (const j of jobs) if (!running.has(j.id)) void work(j)
  } catch (e) {
    log('sin conexión con Central:', (e as Error).message)
  }
}

log(`trabajador del Mac conectado a ${BASE}`)
await beat()
setInterval(beat, EVERY_MS)
