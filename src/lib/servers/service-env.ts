/**
 * Variables de entorno de un contenedor de un servidor, leídas por SSH con la clave de administración (solo lectura).
 * Para guardar los secretos de producción en Central: nunca se registran ni se devuelven al navegador.
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import type { EnvEntry } from '../env-file'
import { ENV_KEY } from '../env-file'
import { ADMIN_KEY } from './install'

const run = promisify(execFile)
const NAME = /^[A-Za-z0-9_.-]+$/
// las que pone la imagen o Docker, no el proyecto
const SYSTEM = /^(PATH|HOSTNAME|HOME|TERM|LANG|LC_ALL|PWD|SHLVL|NODE_VERSION|YARN_VERSION|NPM_CONFIG_\w+|PYTHON_\w+|GPG_KEY|PHP_\w+|GOLANG_VERSION|GOPATH|JAVA_HOME|JAVA_VERSION|PGDATA|PG_MAJOR|PG_VERSION|GOSU_VERSION)$/

type Target = { host: string; sshPort: number; adminUser: string | null }

export async function readContainerEnv(server: Target, container: { name: string; kind: string }): Promise<EnvEntry[]> {
  if (!existsSync(ADMIN_KEY)) throw new Error('Falta la clave de administración de Central en este equipo')
  if (!NAME.test(container.name)) throw new Error('Nombre de contenedor no válido')
  const cmd = container.kind === 'swarm'
    ? `docker service inspect --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' ${container.name}`
    : `docker inspect --format '{{json .Config.Env}}' ${container.name}`
  const { stdout } = await run('ssh', [
    '-T', '-p', String(server.sshPort), '-i', ADMIN_KEY, '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8',
    '-o', 'StrictHostKeyChecking=yes', '--', `${server.adminUser ?? 'root'}@${server.host}`, cmd,
  ], { timeout: 30_000, maxBuffer: 2_000_000 }).catch(() => { throw new Error(`No se pudo leer ${container.name} en el servidor`) })
  const list = JSON.parse(stdout.trim() || 'null') as string[] | null
  return (list ?? []).flatMap((line) => {
    const i = line.indexOf('=')
    const key = i > 0 ? line.slice(0, i) : ''
    return ENV_KEY.test(key) && !SYSTEM.test(key) ? [{ key, value: line.slice(i + 1) }] : []
  })
}
