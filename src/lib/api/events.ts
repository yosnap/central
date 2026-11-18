/** Eventos de la agenda (calendarios de Google elegidos en Ajustes): consulta común de la API v1 y el MCP. */
import { agenda } from '../agenda'

/**
 * Con `genericErrors`, un calendario que falla sale como «No se ha podido leer el calendario «X»» y el mensaje de
 * Google se queda en el registro del servidor (la API v1). El MCP, local, sigue viendo el mensaje.
 */
export async function agendaEvents(start: Date, end: Date, client?: string, { genericErrors = false } = {}) {
  const { events, errors, failed } = await agenda(start, end)
  const rows = events
    .filter((e) => !client || e.link?.client?.name.toLowerCase().includes(client.toLowerCase()))
    .map((e) => ({ summary: e.summary, calendar: e.calendar, start: e.start, end: e.end, allDay: e.allDay, location: e.location, client: e.link?.client?.name, project: e.link?.project?.name, link: e.htmlLink }))
  if (genericErrors && errors.length) console.error(`[api] agenda: ${errors.length} calendario(s) sin leer: ${errors.join(' | ')}`)
  const shown = genericErrors ? failed.map((c) => `No se ha podido leer el calendario «${c}»`) : errors
  return { events: rows, ...(shown.length ? { errors: shown } : {}) }
}

const MADRID = 'Europe/Madrid'

/** Diferencia en ms entre la hora de Madrid y UTC en un instante (3.600.000 en invierno, 7.200.000 en verano). */
function madridOffset(at: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: MADRID, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(at)).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(at / 1000) * 1000
}

/**
 * Las 00:00 de un día AAAA-MM-DD en Europe/Madrid, sea cual sea la zona del proceso (el contenedor va en UTC).
 * null si el día no existe (2026-02-31).
 */
export function madridDayStart(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const utc = Date.UTC(y, mo - 1, d)
  const check = new Date(utc)
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null
  // primera aproximación con el desfase de las 00:00 UTC; luego el desfase exacto en ese instante (el cambio de hora
  // en Madrid es a las 2:00 o 3:00, después de medianoche, así que no hay ambigüedad)
  const guess = utc - madridOffset(utc)
  return new Date(utc - madridOffset(guess))
}

/** Fin (inclusive) del día AAAA-MM-DD en Madrid: las 00:00 del siguiente menos 1 ms. */
export function madridDayEnd(day: string): Date | null {
  const start = madridDayStart(day)
  if (!start) return null
  const next = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + 1)).toISOString().slice(0, 10)
  return new Date(madridDayStart(next)!.getTime() - 1)
}
