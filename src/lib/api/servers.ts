/**
 * Servidores para la API v1: la vista pública de `servers/public` sin la dirección SSH (`host`, `sshPort`) ni la URL
 * del panel (`panelUrl`, a menudo `http://<IP>:3000`), y con todo el texto limpio de IPs y rutas de usuario o de clave
 * (`scrubDeep`): errores de lectura, comprobaciones, dominios y URLs de servicios.
 */
import { scrubDeep, type Scrubbed } from './scrub'

export function publicServerView<T extends { host?: unknown; sshPort?: unknown; panelUrl?: unknown }>(s: T): Scrubbed<Omit<T, 'host' | 'sshPort' | 'panelUrl'>> {
  const { host: _host, sshPort: _port, panelUrl: _panel, ...rest } = s
  return scrubDeep(rest)
}

// la vista pública se carga al usarla: así este módulo se prueba sin BD
const pub = () => import('../servers/public')

export async function listServers() { return (await (await pub()).listServersPublic()).map(publicServerView) }

export async function getServer(id: string) {
  const s = await (await pub()).getServerPublic(id)
  return s ? publicServerView(s) : null
}
