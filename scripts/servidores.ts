// Lectura de servidores por SSH (tarea del Mac cada minuto: cada servidor se lee cuando le toca).
//   bun run servidores                 los que toca
//   bun run servidores -- --todos      todos ya
//   bun scripts/servidores.ts registrar [--comprobar|--probar] nombre host puerto   (lo usa remote/alta-servidor.sh)
import 'dotenv/config'
const { prisma } = await import('../src/lib/prisma')
const args = process.argv.slice(2)

if (args[0] === 'registrar') {
  const { register } = await import('../src/lib/servers/register')
  const mode = args[1] === '--comprobar' ? 'check' : 'test'
  const [name, host, port] = args[1]?.startsWith('--') ? args.slice(2) : args.slice(1)
  const r = await register(mode, name ?? '', host ?? '', Number(port ?? 22))
  if (r.error) console.error(r.error)
  if (r.id && mode === 'test') {
    const { runServers } = await import('../src/lib/servers/collect')
    await runServers({ force: true, ids: [r.id] })
  }
  await prisma.$disconnect()
  process.exit(r.code)
}

const { runServers } = await import('../src/lib/servers/collect')
const results = await runServers({ force: args.includes('--todos') })
for (const r of results) console.log(`${r.ok ? 'OK   ' : 'ERROR'} ${r.name}: ${r.detail}`)
await prisma.$disconnect()
