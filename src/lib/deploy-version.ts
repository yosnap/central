/**
 * Versión que corre en cada servicio, sin rellenarla a mano. Por orden:
 * 1. la ruta de versión de su web (la escrita o una que se encuentra sola: /api/version, /version, /api/health…);
 * 2. la versión de la imagen Docker de su contenedor (org.opencontainers.image.version);
 * 3. la etiqueta de la imagen si parece una versión (app:1.4.2).
 * La del servicio de producción es la versión en producción del proyecto.
 */
import { fetchVersion } from './live-version'
import { prisma } from './prisma'

const CANDIDATE_PATHS = ['/api/version', '/version', '/api/health', '/health', '/version.json', '/api/status']
const PROBE_EVERY_MS = 24 * 3_600_000

export function versionFromImage(image: string | null | undefined) {
  const tag = image?.split('/').pop()?.split(':')[1]
  return tag && /^v?\d+\.\d+(\.\d+)?([-+][A-Za-z0-9.]+)?$/.test(tag) ? tag : null
}

/** Busca una ruta que devuelva la versión. */
async function findVersionPath(url: string) {
  for (const path of CANDIDATE_PATHS) {
    const v = await fetchVersion(url, path)
    if (v) return { path, version: v }
  }
  return null
}

/**
 * Lee y guarda la versión de un servicio. `force` (tras un despliegue) vuelve a buscar la ruta aunque se haya
 * probado hace poco; sin él, la búsqueda de ruta se hace como mucho una vez al día.
 */
export async function refreshServiceVersion(serviceId: string, { force = false } = {}) {
  const s = await prisma.projectService.findUnique({
    where: { id: serviceId },
    select: { id: true, url: true, versionPath: true, environment: true, projectId: true, liveVersionAt: true, containers: { select: { version: true, image: true } } },
  })
  if (!s) return null
  let version: string | null = null
  let versionPath = s.versionPath
  if (s.url) {
    if (versionPath) version = await fetchVersion(s.url, versionPath)
    else if (force || !s.liveVersionAt || Date.now() - s.liveVersionAt.getTime() > PROBE_EVERY_MS) {
      const found = await findVersionPath(s.url)
      if (found) ({ path: versionPath, version } = found)
    }
  }
  version ??= s.containers.map((c) => c.version ?? versionFromImage(c.image)).find(Boolean) ?? null
  const now = new Date()
  // también cuando no hay versión: así la búsqueda de ruta no se repite cada 10 minutos
  await prisma.projectService.update({ where: { id: s.id }, data: { liveVersionAt: now, ...(version ? { liveVersion: version } : {}), ...(versionPath !== s.versionPath ? { versionPath } : {}) } })
  if (version && s.environment === 'production') await prisma.project.update({ where: { id: s.projectId }, data: { deployedVersion: version } })
  return version
}
