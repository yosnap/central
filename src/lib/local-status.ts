/** Estado en vivo de un proyecto en el Mac: sus contenedores de Docker Compose y si responde su URL de desarrollo. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
export type LocalContainer = { name: string; service: string; state: string; status: string; ports: string }

/** Contenedores del proyecto de Compose en el Docker del Mac, o null si Docker no responde. */
export async function localContainers(composeProject: string | null): Promise<LocalContainer[] | null> {
  if (!composeProject || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(composeProject)) return []
  try {
    const { stdout } = await run('docker', ['ps', '-a', '--filter', `label=com.docker.compose.project=${composeProject}`,
      '--format', '{{.Names}}\t{{.Label "com.docker.compose.service"}}\t{{.State}}\t{{.Status}}\t{{.Ports}}'], { timeout: 3000 })
    return stdout.split('\n').filter(Boolean).map((l) => {
      const [name, service, state, status, ports] = l.split('\t')
      return { name, service, state, status, ports: ports ?? '' }
    })
  } catch {
    return null
  }
}

/** Si la URL local responde ahora (cualquier respuesta HTTP cuenta). */
export async function localUrlUp(url: string | null) {
  if (!url || !/^http:\/\/(localhost|127\.0\.0\.1):\d+/.test(url)) return null
  try {
    await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(1500) })
    return true
  } catch {
    return false
  }
}
