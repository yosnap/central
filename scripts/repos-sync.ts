/**
 * Uso:
 *   bun run repos:sync            → todos los remotos de proyectos no excluidos
 *   bun run repos:sync --active   → solo los de proyectos activos o en mantenimiento
 */
import 'dotenv/config'
const { syncRepos } = await import('../src/lib/repo-sync')
const { prisma } = await import('../src/lib/prisma')
const r = await syncRepos({ activeOnly: process.argv.includes('--active') })
console.log(`[${new Date().toISOString()}] Repositorios sincronizados: ${r.ok} de ${r.total}`)
await prisma.$disconnect()
