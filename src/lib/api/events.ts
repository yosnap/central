/** Eventos de la agenda (calendarios de Google elegidos en Ajustes): consulta común de la API v1 y el MCP. */
import { agenda } from '../agenda'

export async function agendaEvents(start: Date, end: Date, client?: string) {
  const { events, errors } = await agenda(start, end)
  const rows = events
    .filter((e) => !client || e.link?.client?.name.toLowerCase().includes(client.toLowerCase()))
    .map((e) => ({ summary: e.summary, calendar: e.calendar, start: e.start, end: e.end, allDay: e.allDay, location: e.location, client: e.link?.client?.name, project: e.link?.project?.name, link: e.htmlLink }))
  return { events: rows, ...(errors.length ? { errors } : {}) }
}
