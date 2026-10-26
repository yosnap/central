'use server'

/** Ajustes de Google: cliente OAuth, cuentas conectadas y qué calendarios se ven en la agenda. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { decryptJson, encryptJson } from './crypto'
import { syncCalendars, type GoogleConfig } from './google'
import { prisma } from './prisma'
import { requireSession } from './session'

const refresh = () => {
  revalidatePath('/ajustes')
  revalidatePath('/agenda')
  revalidatePath('/correo')
}

const App = z.object({
  clientId: z.string().trim().regex(/\.apps\.googleusercontent\.com$/, 'El ID de cliente termina en .apps.googleusercontent.com'),
  clientSecret: z.string().trim().max(200),
})

/** El JSON que descarga Google Cloud al crear el cliente («client_secret_….json»): de ahí salen el ID y el secreto. */
async function fromJson(form: FormData) {
  const file = form.get('json')
  if (!(file instanceof File) || !file.size) return null
  if (file.size > 20_000) throw new Error('Ese fichero no parece el JSON del cliente OAuth')
  let j: { web?: { client_id?: string; client_secret?: string; redirect_uris?: string[] }; installed?: unknown }
  try { j = JSON.parse(await file.text()) } catch { throw new Error('El fichero no es un JSON válido') }
  if (j.installed) throw new Error('Ese cliente es de tipo «Escritorio»; crea uno de tipo «Aplicación web»')
  if (!j.web?.client_id || !j.web.client_secret) throw new Error('El JSON no trae el ID y el secreto del cliente')
  return { clientId: j.web.client_id, clientSecret: j.web.client_secret, redirects: j.web.redirect_uris ?? [] }
}

export async function saveGoogleApp(form: FormData) {
  await requireSession()
  let json
  try { json = await fromJson(form) } catch (e) { return { error: (e as Error).message } }
  const expected = String(form.get('callback') ?? '')
  if (json && expected && !json.redirects.includes(expected)) {
    return { error: `En Google Cloud, añade este URI de redirección autorizado al cliente y vuelve a descargar el JSON: ${expected}` }
  }
  const r = App.safeParse(json ? { clientId: json.clientId, clientSecret: json.clientSecret } : Object.fromEntries(form))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: 'GOOGLE_APP' } })
  // el secreto vacío conserva el guardado; el ID siempre se puede cambiar
  const prev = decryptJson<{ clientSecret: string }>(existing?.secret)
  const clientSecret = r.data.clientSecret || prev?.clientSecret
  if (!clientSecret) return { error: 'Falta el secreto del cliente' }
  const data = { label: 'Cliente OAuth de Google', account: r.data.clientId, secret: encryptJson({ clientId: r.data.clientId, clientSecret }) }
  if (existing) await prisma.integrationConnection.update({ where: { id: existing.id }, data })
  else await prisma.integrationConnection.create({ data: { provider: 'GOOGLE_APP', ...data } })
  refresh()
}

/** Quita la cuenta de Central (no toca nada en Google). Los mensajes guardados se conservan. */
export async function disconnectGoogle(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  await prisma.mailAccount.updateMany({ where: { connectionId: id }, data: { connectionId: null, enabled: false } })
  await prisma.integrationConnection.delete({ where: { id } })
  refresh()
}

export async function refreshCalendars(form: FormData) {
  await requireSession()
  try { await syncCalendars(z.string().min(1).parse(form.get('id'))) } catch (e) { return { error: (e as Error).message } }
  refresh()
}

/** Calendarios elegidos de una cuenta y el nombre con el que se ven (Sn4p, iServisat, Codeia…). */
export async function saveCalendars(form: FormData) {
  await requireSession()
  const id = z.string().min(1).parse(form.get('id'))
  const c = await prisma.integrationConnection.findUniqueOrThrow({ where: { id } })
  const selected = new Set(form.getAll('selected').map(String))
  const config = (c.config as GoogleConfig | null) ?? {}
  const calendars = (config.calendars ?? []).map((cal) => ({
    ...cal, selected: selected.has(cal.id), label: String(form.get(`label:${cal.id}`) ?? '').trim().slice(0, 40) || undefined,
  }))
  await prisma.integrationConnection.update({ where: { id }, data: { config: { ...config, calendars } } })
  refresh()
}
