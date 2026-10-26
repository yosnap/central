/**
 * Google (Gmail y Calendar) con OAuth web, sin librerías: el cliente OAuth se pega en Ajustes y cada cuenta conectada
 * guarda sus tokens cifrados en `IntegrationConnection.secret`. Solo lectura de correo; en la agenda, leer y crear.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { decryptJson, encryptJson } from './crypto'
import { prisma } from './prisma'

export const SCOPES = [
  'openid', 'email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
]
export const callbackPath = '/api/google/callback'

type App = { clientId: string; clientSecret: string }
type Tokens = { accessToken: string; refreshToken: string; expiresAt: number }
export type CalendarPick = { id: string; summary: string; label?: string; color?: string; selected: boolean; primary?: boolean }
export type GoogleConfig = { calendars?: CalendarPick[] }

export async function googleApp(): Promise<App | null> {
  const c = await prisma.integrationConnection.findFirst({ where: { provider: 'GOOGLE_APP' } })
  return decryptJson<App>(c?.secret)
}

// ───────── state firmado (evita que otra web complete el OAuth en tu nombre) ─────────

const key = () => {
  const s = process.env.CENTRAL_SESSION_SECRET
  if (!s) throw new Error('Falta CENTRAL_SESSION_SECRET')
  return `google-oauth:${s}`
}
export function signState() {
  const v = `${Date.now() + 10 * 60_000}.${randomBytes(8).toString('hex')}`
  return `${v}.${createHmac('sha256', key()).update(v).digest('hex')}`
}
export function verifyState(state?: string | null) {
  const [exp, nonce, sig] = (state ?? '').split('.')
  if (!exp || !nonce || !sig || Number(exp) < Date.now()) return false
  const good = createHmac('sha256', key()).update(`${exp}.${nonce}`).digest('hex')
  return sig.length === good.length && timingSafeEqual(Buffer.from(sig), Buffer.from(good))
}

export function authUrl(app: App, redirectUri: string, loginHint?: string) {
  const q = new URLSearchParams({
    client_id: app.clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: signState(), ...(loginHint ? { login_hint: loginHint } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

async function tokenRequest(body: Record<string, string>) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) })
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!r.ok || !j.access_token) throw new Error(j.error === 'invalid_grant' ? 'invalid_grant' : `Google: ${j.error_description ?? j.error ?? r.status}`)
  return j
}

/** Termina el OAuth: guarda la cuenta (o la actualiza) con sus tokens cifrados y su buzón. */
export async function completeOAuth(code: string, redirectUri: string) {
  const app = await googleApp()
  if (!app) throw new Error('Falta el cliente OAuth de Google en Ajustes')
  const t = await tokenRequest({ code, client_id: app.clientId, client_secret: app.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  const info = (await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${t.access_token}` } })).json()) as { email?: string }
  if (!info.email) throw new Error('Google no ha devuelto el correo de la cuenta')
  const existing = await prisma.integrationConnection.findFirst({ where: { provider: 'GOOGLE', account: info.email } })
  const old = decryptJson<Tokens>(existing?.secret)
  // Google solo manda el refresh_token la primera vez (o con prompt=consent): si no viene, se conserva el anterior
  const tokens: Tokens = { accessToken: t.access_token!, refreshToken: t.refresh_token ?? old?.refreshToken ?? '', expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 }
  if (!tokens.refreshToken) throw new Error('Google no ha dado permiso permanente; vuelve a conectar la cuenta')
  const data = { label: info.email, account: info.email, secret: encryptJson(tokens), lastOkAt: new Date(), lastError: null }
  const conn = existing
    ? await prisma.integrationConnection.update({ where: { id: existing.id }, data })
    : await prisma.integrationConnection.create({ data: { provider: 'GOOGLE', ...data } })
  await prisma.mailAccount.upsert({
    where: { address: info.email },
    update: { connectionId: conn.id, enabled: true },
    create: { address: info.email, provider: info.email.endsWith('@gmail.com') ? 'GMAIL' : 'GOOGLE_WORKSPACE', connectionId: conn.id },
  })
  await syncCalendars(conn.id).catch(() => {})
  return conn
}

/** Token de acceso válido de una cuenta; lo renueva si caduca en menos de un minuto. */
async function accessToken(connectionId: string) {
  const c = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } })
  const t = decryptJson<Tokens>(c.secret)
  if (!t?.refreshToken) throw new Error(`${c.account}: hay que volver a conectar la cuenta`)
  if (t.expiresAt > Date.now() + 60_000) return t.accessToken
  const app = await googleApp()
  if (!app) throw new Error('Falta el cliente OAuth de Google en Ajustes')
  try {
    const r = await tokenRequest({ refresh_token: t.refreshToken, client_id: app.clientId, client_secret: app.clientSecret, grant_type: 'refresh_token' })
    const next: Tokens = { ...t, accessToken: r.access_token!, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }
    await prisma.integrationConnection.update({ where: { id: c.id }, data: { secret: encryptJson(next), lastOkAt: new Date(), lastError: null } })
    return next.accessToken
  } catch (e) {
    const msg = (e as Error).message === 'invalid_grant' ? 'Google ha retirado el permiso: vuelve a conectar la cuenta' : (e as Error).message
    await prisma.integrationConnection.update({ where: { id: c.id }, data: { lastError: msg } })
    throw new Error(`${c.account}: ${msg}`)
  }
}

async function gapi<T>(connectionId: string, url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${await accessToken(connectionId)}`, 'content-type': 'application/json' } })
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(`Google ${r.status}: ${j.error?.message ?? r.statusText}`)
  }
  return (r.status === 204 ? null : await r.json()) as T
}

// ───────── Calendar ─────────

/** Lee los calendarios de la cuenta y los guarda en su configuración, respetando cuáles estaban elegidos. */
export async function syncCalendars(connectionId: string) {
  const r = await gapi<{ items: { id: string; summary: string; backgroundColor?: string; primary?: boolean; accessRole: string }[] }>(connectionId, 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader')
  const c = await prisma.integrationConnection.findUniqueOrThrow({ where: { id: connectionId } })
  const prev = ((c.config as GoogleConfig | null)?.calendars ?? [])
  const calendars: CalendarPick[] = r.items.map((x) => {
    const p = prev.find((y) => y.id === x.id)
    return { id: x.id, summary: x.summary, color: x.backgroundColor, primary: x.primary, label: p?.label, selected: p ? p.selected : !!x.primary }
  })
  await prisma.integrationConnection.update({ where: { id: connectionId }, data: { config: { ...(c.config as object | null), calendars } } })
  return calendars
}

export type GEvent = {
  id: string; summary?: string; description?: string; location?: string; htmlLink?: string; status?: string
  start: { date?: string; dateTime?: string }; end?: { date?: string; dateTime?: string }
  attendees?: { email: string }[]; organizer?: { email?: string }
}

export async function listEvents(connectionId: string, calendarId: string, from: Date, to: Date) {
  const q = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250' })
  const r = await gapi<{ items: GEvent[] }>(connectionId, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${q}`)
  return r.items.filter((e) => e.status !== 'cancelled')
}

export async function createEvent(connectionId: string, calendarId: string, ev: { summary: string; description?: string; location?: string; start: { date?: string; dateTime?: string; timeZone?: string }; end: { date?: string; dateTime?: string; timeZone?: string } }) {
  return gapi<GEvent>(connectionId, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body: JSON.stringify(ev) })
}

export const eventStart = (e: GEvent) => new Date(e.start.dateTime ?? `${e.start.date}T00:00:00`)
export const eventEnd = (e: GEvent) => (e.end ? new Date(e.end.dateTime ?? `${e.end.date}T00:00:00`) : null)

// ───────── Gmail (solo lectura) ─────────

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] }
type GMessage = { id: string; threadId: string; snippet?: string; internalDate?: string; labelIds?: string[]; payload?: Part }

const header = (m: GMessage, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')

export type MailHit = { id: string; threadId: string; from: string; to: string; subject: string; snippet: string; date: Date; unread: boolean }

const hit = (m: GMessage): MailHit => ({
  id: m.id, threadId: m.threadId, from: header(m, 'From'), to: header(m, 'To'), subject: header(m, 'Subject') || '(sin asunto)',
  snippet: m.snippet ?? '', date: new Date(Number(m.internalDate ?? 0)), unread: !!m.labelIds?.includes('UNREAD'),
})

/** Busca con la sintaxis de Gmail (from:, subject:, has:attachment…). */
export async function searchMail(connectionId: string, q: string, max = 20) {
  const list = await gapi<{ messages?: { id: string }[] }>(connectionId, `https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q, maxResults: String(max) })}`)
  const meta = 'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date'
  const msgs = await Promise.all((list.messages ?? []).map((m) => gapi<GMessage>(connectionId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?${meta}`)))
  return msgs.map(hit)
}

/** Mensaje completo con su texto: el text/plain o, si no hay, el HTML sin etiquetas. */
export async function getMail(connectionId: string, id: string) {
  const m = await gapi<GMessage>(connectionId, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`)
  const find = (p: Part | undefined, type: string): string | null => {
    if (!p) return null
    if (p.mimeType === type && p.body?.data) return b64(p.body.data)
    for (const c of p.parts ?? []) { const r = find(c, type); if (r) return r }
    return null
  }
  const html = find(m.payload, 'text/html')
  const text = find(m.payload, 'text/plain') ?? (html ? html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n') : '')
  return { ...hit(m), body: text.trim() }
}

/** Dirección de correo de un «Nombre <correo>». */
export const emailOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim().toLowerCase()
