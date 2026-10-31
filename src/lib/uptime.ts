import { refreshServiceVersion } from './deploy-version'
import { prisma } from './prisma'
import { isApiService } from './website-label'

/** Comprueba una URL: "up" si responde 2xx/3xx en menos de 15 s (una API, también con 4xx: su raíz no tiene página). */
export async function checkUrl(url: string, { api = false } = {}) {
  const started = Date.now()
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'Central-uptime/0.1' } })
    const ms = Date.now() - started
    return { up: res.status < (api ? 500 : 400), code: res.status, ms, error: null as string | null }
  } catch (e) {
    return { up: false, code: null, ms: null, error: e instanceof Error ? e.message.slice(0, 200) : 'error' }
  }
}

/** Comprueba todas las webs monitorizadas y guarda el resultado. */
export async function runUptime() {
  const sites = await prisma.website.findMany({ where: { monitored: true }, include: { service: { select: { id: true, name: true } } } })
  const results = await Promise.all(
    sites.map(async (s) => {
      const r = await checkUrl(s.url, { api: isApiService(s.service?.name) })
      await prisma.uptimeCheck.create({ data: { websiteId: s.id, up: r.up, code: r.code, ms: r.ms, error: r.error } })
      await prisma.website.update({ where: { id: s.id }, data: { lastStatus: r.up ? 'up' : 'down', lastCode: r.code, lastMs: r.ms, lastCheckedAt: new Date() } })
      // versión del servicio (ruta de versión, la que se encuentre sola o la de su imagen); la de producción es la del proyecto
      const version = r.up && s.service ? await refreshServiceVersion(s.service.id) : null
      return { url: s.url, ...r, version }
    }),
  )
  // conserva 30 días de historial
  await prisma.uptimeCheck.deleteMany({ where: { checkedAt: { lt: new Date(Date.now() - 30 * 864e5) } } })
  return results
}
