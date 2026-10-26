/**
 * Importa webs desde un fichero de texto, una por línea:
 *   dominio-o-url ; tipo ; cliente (opcional) ; etiqueta (opcional)
 * tipo: cliente | propia | central
 *   bloommarbella.es ; cliente ; Bloom Marbella
 *   codeia.dev ; propia
 *   n8n.midominio.com ; central ; ; n8n
 * Uso: bun run websites:import inventario/webs.txt
 */
import 'dotenv/config'
import fs from 'node:fs'
const { prisma } = await import('../src/lib/prisma')

const file = process.argv[2]
if (!file) { console.error('Indica el fichero: bun run websites:import inventario/webs.txt'); process.exit(1) }
const KIND = { cliente: 'CLIENT', propia: 'OWN', central: 'CENTRAL' } as const
let n = 0
for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
  const line = raw.trim()
  if (!line || line.startsWith('#')) continue
  const [u, k = 'cliente', c, label] = line.split(';').map((s) => s.trim())
  const url = /^https?:\/\//.test(u) ? u : `https://${u}`
  const kind = KIND[(k.toLowerCase() as keyof typeof KIND)] ?? 'CLIENT'
  const client = c ? await prisma.client.upsert({ where: { name: c }, update: {}, create: { name: c } }) : null
  await prisma.website.upsert({
    where: { url },
    update: { kind, label: label || undefined, clientId: client?.id },
    create: { url, kind, label: label || null, clientId: client?.id ?? null },
  })
  n++
}
console.log(`Importadas ${n} webs.`)
await prisma.$disconnect()
