/** Agenda: los eventos de los calendarios elegidos de todas las cuentas de Google, con su cliente o proyecto ligado. */
import { prisma } from './prisma'
import { eventEnd, eventStart, listEvents, type GEvent, type GoogleConfig } from './google'

export type AgendaEvent = {
  key: string; connectionId: string; account: string; calendarId: string; calendar: string; color?: string
  id: string; summary: string; description?: string; location?: string; htmlLink?: string
  start: Date; end: Date | null; allDay: boolean; attendees: string[]
  link: { client: { id: string; name: string } | null; project: { id: string; name: string } | null } | null
}

/** Calendarios elegidos en Ajustes, con su cuenta, para leer eventos o crear uno nuevo. */
export async function pickedCalendars() {
  const conns = await prisma.integrationConnection.findMany({ where: { provider: 'GOOGLE' }, orderBy: { account: 'asc' } })
  return conns.flatMap((c) => ((c.config as GoogleConfig | null)?.calendars ?? []).filter((x) => x.selected)
    .map((x) => ({ connectionId: c.id, account: c.account ?? '', calendarId: x.id, name: x.label || x.summary, color: x.color })))
}

export async function agenda(from: Date, to: Date) {
  const cals = await pickedCalendars()
  const errors: string[] = []
  const lists = await Promise.all(cals.map(async (c) => {
    try { return (await listEvents(c.connectionId, c.calendarId, from, to)).map((e) => ({ c, e })) } catch (err) { errors.push(`${c.name}: ${(err as Error).message}`); return [] }
  }))
  const flat = lists.flat()
  const links = flat.length ? await prisma.calendarEventLink.findMany({
    where: { OR: flat.map(({ c, e }) => ({ calendarId: c.calendarId, eventId: e.id })) },
    include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
  }) : []
  const events: AgendaEvent[] = flat.map(({ c, e }: { c: (typeof cals)[number]; e: GEvent }) => {
    const l = links.find((x) => x.calendarId === c.calendarId && x.eventId === e.id)
    return {
      key: `${c.calendarId}:${e.id}`, connectionId: c.connectionId, account: c.account, calendarId: c.calendarId, calendar: c.name, color: c.color,
      id: e.id, summary: e.summary || '(sin título)', description: e.description, location: e.location, htmlLink: e.htmlLink,
      start: eventStart(e), end: eventEnd(e), allDay: !e.start.dateTime, attendees: (e.attendees ?? []).map((a) => a.email.toLowerCase()),
      link: l ? { client: l.client, project: l.project } : null,
    }
  }).sort((a, b) => a.start.getTime() - b.start.getTime())
  // el mismo evento compartido en dos calendarios elegidos sale una vez
  const seen = new Set<string>()
  return { events: events.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))), errors, calendars: cals }
}
