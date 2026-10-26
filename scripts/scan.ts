/**
 * Uso:
 *   bun run scan                                  → recorre SCAN_ROOTS o las raíces guardadas e importa a la base de datos
 *   bun run scan /otra/carpeta                    → recorre esa carpeta (y la recuerda como raíz)
 *   bun run scan --csv inventario/proyectos.csv   → no toca la BD: escribe el inventario para revisarlo
 *   --map /ruta/local=/ruta/real                  → guarda rutas reales cuando escaneas desde otra máquina
 *   --fetch | --fetch-active                      → git fetch antes de leer el estado (todos o solo con actividad en 6 meses)
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { toCsv, type ScannedProject } from '../src/lib/scanner'

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const csvOut = flag('--csv')
const fetchAll = args.includes('--fetch')
const fetchActive = args.includes('--fetch-active')
for (const f of ['--fetch', '--fetch-active']) if (args.includes(f)) args.splice(args.indexOf(f), 1)
const mapArg = flag('--map')

const { importProjects, pathMap, resolveRoots, scanRoots } = await import('../src/lib/scan-import')
const { prisma } = await import('../src/lib/prisma')

const roots = await resolveRoots(args)
if (!roots.length) {
  console.error('Indica una carpeta, define SCAN_ROOTS o escanea antes una carpeta para guardarla como raíz')
  process.exit(1)
}
console.log(`[${new Date().toISOString()}] Escaneo`)
const map = pathMap(mapArg)
const all = scanRoots(roots, map, console.log, fetchAll ? 'all' : fetchActive ? 'active' : 'none')

const count = (f: (p: ScannedProject) => string) => all.reduce<Record<string, number>>((acc, p) => ((acc[f(p)] = (acc[f(p)] ?? 0) + 1), acc), {})
console.log('Por tipo:', count((p) => p.kind))
console.log('Por estado:', count((p) => p.status))

if (csvOut) {
  fs.mkdirSync(path.dirname(csvOut), { recursive: true })
  fs.writeFileSync(csvOut, toCsv(all))
  console.log(`Inventario escrito en ${csvOut}`)
} else {
  const r = await importProjects(all, roots, map, console.log)
  console.log(`Importados ${r.projects} proyectos${r.moved.length ? `; ${r.moved.length} con el repositorio movido` : ''}.`)
}
await prisma.$disconnect()
