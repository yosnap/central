/**
 * Copia del entorno desplegado (pruebas y producción) de los proyectos con contenedores enlazados, leído con la clave
 * de administración del Mac. Solo guarda una versión nueva si algo ha cambiado. Nunca muestra valores.
 * Con Central en producción lo hace a diario el trabajador del Mac (trabajo `container-env`).
 *
 *   bun run secretos:copias
 */
import { prisma } from '../src/lib/prisma'
import { deployedEnvs, pullServerEnv } from '../src/lib/secrets-store'

const names = new Map((await prisma.project.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]))
for (const { projectId, environment } of await deployedEnvs()) {
  const label = `${names.get(projectId) ?? projectId} · ${environment}`
  try {
    const r = await pullServerEnv(projectId, environment)
    console.log(`${r.saved ? 'copia nueva' : r.applied ? 'rellenados ' : 'sin cambios'}  ${label} (${r.count} variables)`)
  } catch (e) {
    console.log(`error        ${label}: ${(e as Error).message}`)
  }
}
await prisma.$disconnect()
