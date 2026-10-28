/**
 * Sube a producción lo trabajado en el Mac: clientes, proyectos, webs y servidores con sus enlaces (src/lib/data-sync.ts).
 * No borra nada en producción ni toca sus presupuestos. Usa el CENTRAL_API_TOKEN de producción (el que guarda
 * «bun run produccion:variables»); con --url a otra dirección, el del entorno.
 *
 *   bun run produccion:subir [-- --prueba] [-- --url http://localhost:3099]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { exportData } from '../src/lib/data-sync'
import { prisma } from '../src/lib/prisma'

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }
const URL_PROD = 'https://central.sn4p.dev'
const url = (arg('--url') ?? URL_PROD).replace(/\/$/, '')
const prodFile = path.join(os.homedir(), 'Library', 'Application Support', 'Central', 'produccion.env')
const saved = fs.existsSync(prodFile) ? fs.readFileSync(prodFile, 'utf8').match(/^CENTRAL_API_TOKEN=(.*)$/m)?.[1] : undefined
const token = (url === URL_PROD ? saved ?? process.env.CENTRAL_API_TOKEN : process.env.CENTRAL_API_TOKEN) ?? ''

const data = await exportData()
await prisma.$disconnect()
for (const [model, rows] of Object.entries(data)) console.log(`  ${model}: ${rows.length}`)
if (process.argv.includes('--prueba')) process.exit(0)
if (token.length < 32) { console.error('Falta CENTRAL_API_TOKEN (ejecuta antes bun run produccion:variables)'); process.exit(1) }

console.log(`Subiendo a ${url}…`)
const r = await fetch(`${url}/api/importar`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(data) })
if (!r.ok) { console.error(`${url} responde ${r.status}: ${(await r.text()).slice(0, 300)}`); process.exit(1) }
const { results, errors } = (await r.json()) as { results: { model: string; created: number; updated: number; failed: number }[]; errors: string[] }
for (const x of results) console.log(`  ${x.model}: ${x.created} nuevos, ${x.updated} actualizados${x.failed ? `, ${x.failed} con error` : ''}`)
for (const e of errors) console.log(`  error: ${e}`)
