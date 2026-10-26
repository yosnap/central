/**
 * Escaneo de carpetas raíz sin base de datos: lo usan la importación (scan-import.ts) y el trabajador del Mac,
 * que escanea en el Mac y sube el resultado cuando Central está en producción.
 */
import path from 'node:path'
import { findProjects, groupProjects, type FetchMode, type ScannedProject } from './scanner'

export type PathMap = { mapPath: (p: string) => string; unmapPath: (p: string) => string }

export function pathMap(mapArg?: string): PathMap {
  const [from, to] = mapArg ? mapArg.split('=') : []
  return {
    mapPath: (p) => (from && p.startsWith(from) ? to + p.slice(from.length) : p),
    unmapPath: (p) => (to && p.startsWith(to) ? from + p.slice(to.length) : p),
  }
}

export function scanRoots(roots: string[], { mapPath }: PathMap, log: (m: string) => void = () => {}, fetch: FetchMode = 'none'): ScannedProject[] {
  const all: ScannedProject[] = []
  for (const r of roots) {
    const root = path.resolve(r)
    log(`Escaneando ${mapPath(root)}…`)
    const dirs = findProjects(root, { mapPath, fetch })
    const projects = groupProjects(dirs)
    log(`  ${dirs.length} carpetas → ${projects.length} proyectos`)
    all.push(...projects)
  }
  return all
}
