/**
 * Lleva a producción lo trabajado en el Mac: clientes, proyectos, webs y servidores con sus enlaces.
 * `exportData` lo lee de la BD local (scripts/produccion-subir.ts) e `importData` lo aplica en producción
 * (POST /api/importar). Nunca borra: lo que solo existe en producción se queda, y los presupuestos no se tocan.
 *
 * Cada fila se busca por id y, si no está, por su clave natural (slug, url, nombre, ruta…): el escáner de producción
 * crea sus propios ids. Si se encuentra con otro id, las referencias de las tablas siguientes se reasignan a ese id.
 */
import { Prisma } from '@/generated/prisma/client'
import { prisma } from './prisma'
import { revive } from './worker'

type Row = Record<string, unknown>
type Spec = {
  model: string
  /** claves naturales (únicas) para encontrar la fila si el id no coincide */
  keys?: string[][]
  /** columna → tabla a la que apunta (para reasignar ids) */
  refs?: Record<string, string>
  /** solo estos campos (además del id) */
  only?: string[]
  /** campos Json que admiten null */
  json?: string[]
}

// Del servidor solo la configuración: el estado lo lee producción.
const SERVER_FIELDS = ['name', 'host', 'sshPort', 'collectUser', 'adminUser', 'keyPath', 'hostKey', 'provider', 'panel', 'panelUrl', 'knownIps', 'allowMail', 'intervalSec', 'incidentSec', 'notes']

// En orden: cada tabla solo apunta a las anteriores (salvo Project.parentId, que va en una segunda pasada).
export const SPECS: Spec[] = [
  { model: 'client', keys: [['name']] },
  { model: 'project', keys: [['slug']], refs: { clientId: 'client' }, json: ['branchVersions', 'branchStatus', 'envFiles', 'localCompose'] },
  { model: 'projectLocation', keys: [['path']], refs: { projectId: 'project' } },
  { model: 'repoRemote', keys: [['projectId', 'name']], refs: { projectId: 'project' } },
  { model: 'website', keys: [['url']], refs: { clientId: 'client', projectId: 'project' } },
  { model: 'installation', keys: [['projectId', 'websiteId']], refs: { projectId: 'project', websiteId: 'website' } },
  { model: 'server', keys: [['name']], only: SERVER_FIELDS },
  { model: 'projectService', refs: { projectId: 'project', websiteId: 'website', serverId: 'server' } },
  { model: 'serverContainer', keys: [['serverId', 'name']], refs: { serverId: 'server', projectServiceId: 'projectService' } },
  { model: 'projectSecret', keys: [['projectId', 'environment', 'key']], refs: { projectId: 'project' } },
  { model: 'envBackup', refs: { projectId: 'project' } },
  { model: 'projectAdvisory', keys: [['projectId', 'advisoryId', 'package', 'installed']], refs: { projectId: 'project' } },
  { model: 'note', refs: { clientId: 'client', projectId: 'project', websiteId: 'website' } },
  { model: 'scanRoot', keys: [['path']] },
]

type Delegate = {
  findMany: (a?: object) => Promise<Row[]>
  findFirst: (a: object) => Promise<Row | null>
  create: (a: object) => Promise<Row>
  update: (a: object) => Promise<Row>
}
const table = (model: string) => (prisma as unknown as Record<string, Delegate>)[model]
const pick = (row: Row, only?: string[]) => (only ? Object.fromEntries(Object.entries(row).filter(([k]) => k === 'id' || only.includes(k))) : row)

export async function exportData() {
  const data: Record<string, Row[]> = {}
  for (const s of SPECS) data[s.model] = (await table(s.model).findMany()).map((r) => pick(r, s.only))
  return data
}

export type ImportResult = { model: string; created: number; updated: number; failed: number }[]

export async function importData(raw: unknown): Promise<{ results: ImportResult; errors: string[] }> {
  const data = revive(raw) as Record<string, Row[] | undefined>
  const ids = new Map<string, Map<string, string>>() // tabla → id local → id en producción
  const mapId = (model: string, id: unknown) => (typeof id === 'string' ? ids.get(model)?.get(id) ?? id : id)
  const results: ImportResult = []
  const errors: string[] = []
  const parents: { id: string; parentId: string }[] = []

  for (const s of SPECS) {
    const rows = data[s.model] ?? []
    const map = new Map<string, string>()
    ids.set(s.model, map)
    const r = { model: s.model, created: 0, updated: 0, failed: 0 }
    for (const row0 of rows) {
      const row: Row = { ...pick(row0, s.only) }
      for (const [col, target] of Object.entries(s.refs ?? {})) if (row[col] != null) row[col] = mapId(target, row[col])
      for (const f of s.json ?? []) if (row[f] === null) row[f] = Prisma.DbNull
      if (s.model === 'project') {
        if (typeof row.parentId === 'string') parents.push({ id: row.id as string, parentId: row.parentId })
        delete row.parentId
      }
      try {
        let found = await table(s.model).findFirst({ where: { id: row.id }, select: { id: true } })
        for (const key of s.keys ?? []) {
          if (found) break
          found = await table(s.model).findFirst({ where: Object.fromEntries(key.map((k) => [k, row[k]])), select: { id: true } })
        }
        const { id, ...rest } = row
        if (found) {
          await table(s.model).update({ where: { id: found.id }, data: rest })
          map.set(id as string, found.id as string)
          r.updated++
        } else {
          await table(s.model).create({ data: row })
          r.created++
        }
      } catch (e) {
        r.failed++
        if (errors.length < 30) errors.push(`${s.model} ${String(row.id)}: ${(e as Error).message.split('\n').filter(Boolean).pop()?.slice(0, 300)}`)
      }
    }
    results.push(r)
  }

  // sistema al que pertenece cada proyecto, ya con los ids de producción
  for (const p of parents) {
    await prisma.project.update({ where: { id: mapId('project', p.id) as string }, data: { parentId: mapId('project', p.parentId) as string } })
      .catch((e: Error) => { if (errors.length < 30) errors.push(`project ${p.id} (sistema): ${e.message.split('\n').pop()?.slice(0, 300)}`) })
  }
  return { results, errors }
}
