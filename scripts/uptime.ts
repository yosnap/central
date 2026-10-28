import 'dotenv/config'
const { runUptime } = await import('../src/lib/uptime')
const { prisma } = await import('../src/lib/prisma')
const r = await runUptime()
const { syncKuma } = await import('../src/lib/kuma')
try {
  const k = await syncKuma()
  if (k) console.log(`Uptime Kuma: ${k.created} creados, ${k.updated} actualizados, ${k.deleted} borrados`)
  const s = await (await import('../src/lib/kuma-push')).pushSecurity()
  if (s) console.log(`Uptime Kuma: estado de seguridad enviado a ${s.sent} monitores${s.failed ? `, ${s.failed} fallidos` : ''}`)
} catch (e) {
  console.log(`Uptime Kuma: ${e instanceof Error ? e.message : 'error'}`)
}
for (const x of r) console.log(`${x.up ? 'OK  ' : 'CAÍDA'} ${String(x.ms ?? '—').padStart(5)} ms  ${x.code ?? x.error}  ${x.url}`)
await prisma.$disconnect()
