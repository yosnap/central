'use server'

/** Agenda: crear eventos en Google Calendar y ligarlos a un cliente o proyecto de Central. */
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createEvent, eventEnd, eventStart } from './google'
import { resolveTarget as target } from './link-targets'
import { prisma } from './prisma'
import { requireSession } from './session'

const TZ = 'Europe/Madrid'
const refresh = () => {
  revalidatePath('/agenda')
  revalidatePath('/clientes', 'layout')
  revalidatePath('/proyectos', 'layout')
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige el día')
const time = z.string().regex(/^$|^\d{2}:\d{2}$/, 'Hora no válida')
const New = z.object({
  calendar: z.string().min(1, 'Elige el calendario'),
  summary: z.string().trim().min(1, 'Ponle título').max(300),
  date: day,
  from: time.default(''),
  to: time.default(''),
  allDay: z.string().optional(),
  description: z.string().trim().max(5000).optional(),
  location: z.string().trim().max(300).optional(),
  target: z.string().default(''),
})

export async function createCalendarEvent(form: FormData) {
  await requireSession()
  const r = New.safeParse(Object.fromEntries(form))
  if (!r.success) return { error: r.error.issues.map((i) => i.message).join('. ') }
  const d = r.data
  const [connectionId, calendarId] = d.calendar.split('|')
  const allDay = !!d.allDay || !d.from
  let start, end
  if (allDay) {
    const next = new Date(`${d.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    start = { date: d.date }; end = { date: next.toISOString().slice(0, 10) }
  } else {
    // sin hora de fin, una hora de duración
    const [h, m] = d.from.split(':').map(Number)
    const to = d.to || `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    if (to <= d.from) return { error: 'La hora de fin tiene que ser posterior a la de inicio' }
    start = { dateTime: `${d.date}T${d.from}:00`, timeZone: TZ }; end = { dateTime: `${d.date}T${to}:00`, timeZone: TZ }
  }
  let ev
  try { ev = await createEvent(connectionId, calendarId, { summary: d.summary, description: d.description || undefined, location: d.location || undefined, start, end }) } catch (e) { return { error: (e as Error).message } }
  if (d.target) {
    await prisma.calendarEventLink.create({
      data: { connectionId, calendarId, eventId: ev.id, summary: d.summary, start: eventStart(ev), end: eventEnd(ev), allDay, htmlLink: ev.htmlLink, ...(await target(d.target)) },
    })
  }
  refresh()
}

const Link = z.object({
  connectionId: z.string().min(1), calendarId: z.string().min(1), eventId: z.string().min(1),
  summary: z.string().max(300), start: z.string(), end: z.string().optional(), allDay: z.string().optional(), htmlLink: z.string().optional(),
  value: z.string().default(''),
})

/** Liga (o desliga, con valor vacío) un evento de la agenda a un cliente o proyecto. */
export async function linkEvent(form: FormData) {
  await requireSession()
  const d = Link.parse(Object.fromEntries(form))
  const where = { calendarId_eventId: { calendarId: d.calendarId, eventId: d.eventId } }
  if (!d.value) {
    await prisma.calendarEventLink.deleteMany({ where: { calendarId: d.calendarId, eventId: d.eventId } })
  } else {
    const data = { summary: d.summary || '(sin título)', start: new Date(d.start), end: d.end ? new Date(d.end) : null, allDay: d.allDay === 'true', htmlLink: d.htmlLink || null, ...(await target(d.value)) }
    await prisma.calendarEventLink.upsert({ where, update: data, create: { connectionId: d.connectionId, calendarId: d.calendarId, eventId: d.eventId, ...data } })
  }
  refresh()
}
