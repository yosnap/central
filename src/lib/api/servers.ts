/**
 * Servidores para la API v1: la vista pública de `servers/public` sin la dirección SSH (`host`, `sshPort`),
 * que puede ser una IP. Nunca hay rutas de clave ni secretos.
 */
export function withoutAddress<T extends { host?: unknown; sshPort?: unknown }>(s: T): Omit<T, 'host' | 'sshPort'> {
  const { host: _host, sshPort: _port, ...rest } = s
  return rest
}

// la vista pública se carga al usarla: así este módulo se prueba sin BD
const pub = () => import('../servers/public')

export async function listServers() { return (await (await pub()).listServersPublic()).map(withoutAddress) }

export async function getServer(id: string) {
  const s = await (await pub()).getServerPublic(id)
  return s ? withoutAddress(s) : null
}
