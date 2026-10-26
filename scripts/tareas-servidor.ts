/**
 * Tareas programadas de Central en producción (servicio «tareas» del compose): lo que en el Mac hacía launchd.
 * Cada minuto lee los servidores a los que les toca; cada 10 minutos comprueba las webs y sincroniza Uptime Kuma.
 */
import { runServers } from '../src/lib/servers/collect'
import { runUptime } from '../src/lib/uptime'
import { syncKuma } from '../src/lib/kuma'

const MIN = 60_000
const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a)
const busy = { servers: false, uptime: false }

async function servers() {
  if (busy.servers) return
  busy.servers = true
  try {
    const r = await runServers()
    if (r.length) log(`servidores: ${r.map((x) => `${x.name} ${x.ok ? 'OK' : 'ERROR'}`).join(', ')}`)
  } catch (e) { log('servidores:', (e as Error).message) } finally { busy.servers = false }
}

async function uptime() {
  if (busy.uptime) return
  busy.uptime = true
  try {
    const r = await runUptime()
    log(`uptime: ${r.filter((x) => x.up).length}/${r.length} en línea`)
    await syncKuma().catch((e: Error) => log('Uptime Kuma:', e.message))
  } catch (e) { log('uptime:', (e as Error).message) } finally { busy.uptime = false }
}

log('tareas de Central en marcha')
void servers()
void uptime()
setInterval(servers, MIN)
setInterval(uptime, 10 * MIN)
