/**
 * Lo que se ve de un proyecto en el Mac, sin abrir nunca un fichero de variables:
 * - los NOMBRES de sus ficheros de variables y a qué entorno corresponde cada uno;
 * - los servicios de su Docker Compose (imagen y puertos publicados; nunca sus variables);
 * - su URL de desarrollo (script dev de package.json o primer puerto publicado del compose).
 * Sin dependencias de Next: la usa el escáner.
 */
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { roleOf } from './servers/role'

export type EnvFile = { name: string; environment: 'development' | 'staging' | 'production' | null } // null = ejemplo o plantilla
export type ComposeService = { name: string; image: string | null; build: boolean; ports: { host: number; container: number }[] }
export type LocalInfo = { envFiles: EnvFile[]; compose: ComposeService[]; composeProject: string | null; devUrl: string | null }

const ENV_FILE = /^\.env(\.[A-Za-z0-9_.-]+)?$/
const COMPOSE_FILE = /^(docker-)?compose(\.[A-Za-z0-9_-]+)?\.ya?ml$/

function envOf(name: string): EnvFile['environment'] {
  const suffix = name.replace(/^\.env\.?/, '').toLowerCase()
  if (/(example|sample|template|dist|defaults?)/.test(suffix)) return null
  if (/(^|\.)(prod|production)($|\.)/.test(suffix)) return 'production'
  if (/(^|\.)(staging|stage|preview|test|qa)($|\.)/.test(suffix)) return 'staging'
  return 'development' // .env, .env.local, .env.development…
}

/** Ficheros de variables por su nombre (no se abren). */
export const envFiles = (entries: Iterable<string>): EnvFile[] =>
  [...entries].filter((f) => ENV_FILE.test(f)).sort().map((name) => ({ name, environment: envOf(name) }))

function portPair(p: unknown): { host: number; container: number } | null {
  if (typeof p === 'number') return null // solo contenedor: no se publica
  if (typeof p === 'object' && p) {
    const o = p as { published?: unknown; target?: unknown }
    return Number(o.published) > 0 && Number(o.target) > 0 ? { host: Number(o.published), container: Number(o.target) } : null
  }
  // "3000:3000", "127.0.0.1:5433:5432", "8080:80/tcp"
  const parts = String(p).split('/')[0].split(':')
  if (parts.length < 2) return null
  const host = Number(parts[parts.length - 2]), container = Number(parts[parts.length - 1])
  return host > 0 && container > 0 ? { host, container } : null
}

function readCompose(dir: string, entries: Set<string>) {
  const file = [...entries].filter((f) => COMPOSE_FILE.test(f)).sort((a, b) => a.length - b.length)[0]
  if (!file) return { services: [], project: null }
  try {
    const text = fs.readFileSync(path.join(dir, file), 'utf8').slice(0, 500_000)
    const doc = parse(text, { maxAliasCount: 50 }) as { name?: unknown; services?: Record<string, Record<string, unknown>> } | null
    const services = Object.entries(doc?.services ?? {}).slice(0, 50).map(([name, s]) => ({
      name: name.slice(0, 64),
      image: typeof s?.image === 'string' ? s.image.slice(0, 200) : null,
      build: !!s?.build,
      ports: (Array.isArray(s?.ports) ? s.ports : []).map(portPair).filter((x): x is { host: number; container: number } => !!x).slice(0, 10),
    }))
    // Compose llama al proyecto como la carpeta (en minúsculas, sin caracteres raros) salvo que el fichero diga otro
    const project = typeof doc?.name === 'string' ? doc.name : path.basename(dir).toLowerCase().replace(/[^a-z0-9_-]/g, '')
    return { services, project }
  } catch {
    return { services: [], project: null }
  }
}

const DEFAULT_PORT: [RegExp, number][] = [[/\bnext\b/, 3000], [/\bvite\b/, 5173], [/\bastro\b/, 4321], [/\bnuxt\b/, 3000], [/\bremix\b/, 3000], [/\bsvelte-kit\b/, 5173], [/\bng serve\b/, 4200]]

function devPort(script: string | undefined) {
  if (!script) return null
  const m = script.match(/(?:-p|--port)[ =](\d{2,5})\b/) ?? script.match(/\bPORT=(\d{2,5})\b/)
  if (m) return Number(m[1])
  return DEFAULT_PORT.find(([re]) => re.test(script))?.[1] ?? null
}

// el frontend antes que el resto: es lo que se abre en el navegador
const FRONT_FIRST = (d: string) => (d === '' ? 1 : /^(frontend|front|web|client|app|apps)$/i.test(d) ? 0 : 2)

export function localInfo(dir: string, entries: Set<string>, scripts: { dir: string; scripts?: Record<string, string> }[] = []): LocalInfo {
  const { services, project } = readCompose(dir, entries)
  const fromScripts = [...scripts].sort((a, b) => FRONT_FIRST(a.dir) - FRONT_FIRST(b.dir)).map((x) => devPort(x.scripts?.dev)).find((p) => p != null)
  // del compose, solo una aplicación (no bases de datos, cachés, almacenamiento…), y antes la del frontend
  const apps = services.filter((s) => { const r = roleOf(s.image, s.name); return s.ports.length && (r === 'app' || (s.build && r === 'other')) }).sort((a, b) => FRONT_FIRST(a.name) - FRONT_FIRST(b.name))
  const port = fromScripts ?? apps[0]?.ports[0]?.host ?? null
  return { envFiles: envFiles(entries), compose: services, composeProject: services.length ? project : null, devUrl: port ? `http://localhost:${port}` : null }
}
