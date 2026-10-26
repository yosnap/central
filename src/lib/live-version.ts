/** Lee la versión desplegada de una web desde una ruta suya (p. ej. /version o /api/health). */

const VERSION = /^v?\d+\.\d+(\.\d+)?([-+][\w.]+)?$/

function fromJson(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const nested = (k: string) => (o[k] && typeof o[k] === 'object' ? (o[k] as Record<string, unknown>).version : undefined)
  for (const v of [o.version, o.appVersion, o.app_version, nested('data'), nested('build'), nested('app')]) {
    if (typeof v === 'string' && VERSION.test(v.trim())) return v.trim()
  }
  return null
}

export async function fetchVersion(siteUrl: string, versionPath: string): Promise<string | null> {
  try {
    const url = new URL(versionPath, siteUrl)
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json, text/plain', 'user-agent': 'Central-version/0.1' } })
    if (!res.ok) return null
    const text = (await res.text()).slice(0, 20000)
    try {
      return fromJson(JSON.parse(text))
    } catch {
      const first = text.trim().split('\n')[0]?.trim() ?? ''
      return VERSION.test(first) ? first : null
    }
  } catch {
    return null
  }
}
