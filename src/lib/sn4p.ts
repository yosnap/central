/** Cliente mínimo de la API de sn4p.dev (portfolio). Credenciales desde la conexión SN4P de Ajustes. */
import { prisma } from './prisma'
import { decryptJson } from './crypto'

export async function sn4pLogin() {
  const conn = await prisma.integrationConnection.findFirst({ where: { provider: 'SN4P' } })
  if (!conn?.baseUrl || !conn.account) throw new Error('Configura sn4p.dev en Ajustes')
  const pw = decryptJson<{ password: string }>(conn.secret)?.password
  const res = await fetch(`${conn.baseUrl.replace(/\/$/, '')}/api/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: conn.account, password: pw }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.accessToken) throw new Error(body.error ?? `sn4p.dev respondió ${res.status}`)
  return { baseUrl: conn.baseUrl.replace(/\/$/, ''), token: body.accessToken as string, connectionId: conn.id }
}

/** Comprueba las credenciales y guarda el resultado en la conexión. */
export async function sn4pTest() {
  const conn = await prisma.integrationConnection.findFirst({ where: { provider: 'SN4P' } })
  if (!conn) return { ok: false, error: 'Sin configurar' }
  try {
    await sn4pLogin()
    await prisma.integrationConnection.update({ where: { id: conn.id }, data: { lastOkAt: new Date(), lastError: null } })
    return { ok: true }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Error'
    await prisma.integrationConnection.update({ where: { id: conn.id }, data: { lastError: error } })
    return { ok: false, error }
  }
}
