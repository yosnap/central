import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Tareas programadas del Mac (launchd). Las instala scripts/tareas-mac.sh.
export const MAC_TASKS = [
  { id: 'com.iservisat.central.scan', label: 'Escaneo y repositorios', every: 'cada hora (trae de origin los activos y consulta a GitHub/GitLab)' },
  { id: 'com.iservisat.central.uptime', label: 'Comprobación de webs', every: 'cada 10 minutos' },
  { id: 'com.iservisat.central.servidores', label: 'Lectura de servidores', every: 'cada minuto' },
] as const

export function macTaskInstalled(id: string) {
  return fs.existsSync(path.join(os.homedir(), 'Library', 'LaunchAgents', `${id}.plist`))
}
