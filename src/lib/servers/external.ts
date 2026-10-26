/**
 * Qué puertos se alcanzan de verdad desde Internet: desde dentro no se ve el cortafuegos del proveedor.
 * Se prueba por TCP desde el Mac cada puerto que el servidor dice tener en escucha (1,5 s, 16 a la vez, máx. 64).
 */
import { lookup } from 'node:dns/promises'
import { connect } from 'node:net'

const TIMEOUT_MS = 1500
const PARALLEL = 16
const MAX_PORTS = 64

function reachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connect({ host, port })
    const done = (ok: boolean) => { s.destroy(); resolve(ok) }
    s.setTimeout(TIMEOUT_MS, () => done(false))
    s.once('connect', () => done(true))
    s.once('error', () => done(false))
  })
}

/** Puertos alcanzables, o null si no hay lista de puertos o no se resuelve el host (sin dato). */
export async function exposedPorts(host: string, listening: number[] | undefined): Promise<number[] | null> {
  if (!listening?.length) return null
  try { await lookup(host) } catch { return null }
  const ports = listening.slice(0, MAX_PORTS)
  const open: number[] = []
  for (let i = 0; i < ports.length; i += PARALLEL) {
    const batch = ports.slice(i, i + PARALLEL)
    const r = await Promise.all(batch.map((p) => reachable(host, p)))
    batch.forEach((p, j) => { if (r[j]) open.push(p) })
  }
  return open
}
