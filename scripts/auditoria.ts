// Auditoría de dependencias de los proyectos en producción (osv-scanner) y envío del estado a Uptime Kuma.
import 'dotenv/config'
const { runAudit } = await import('../src/lib/audit-import')
const { prisma } = await import('../src/lib/prisma')
const n = await runAudit((m) => console.log(m))
console.log(`${n} proyectos en producción auditados`)
try {
  const s = await (await import('../src/lib/kuma-push')).pushSecurity()
  if (s) console.log(`Uptime Kuma: estado enviado a ${s.sent} monitores${s.failed ? `, ${s.failed} fallidos` : ''}`)
} catch (e) {
  console.log(`Uptime Kuma: ${e instanceof Error ? e.message : 'error'}`)
}
await prisma.$disconnect()
