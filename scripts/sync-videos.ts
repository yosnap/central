import 'dotenv/config'
const { syncAllChannels } = await import('../src/lib/videos')
const { prisma } = await import('../src/lib/prisma')
for (const r of await syncAllChannels()) console.log(`${r.name}: ${'error' in r && r.error ? `ERROR ${r.error}` : `${r.found} vídeos, ${r.assigned} asignados`}`)
await prisma.$disconnect()
