import Form from 'next/form'
import Link from 'next/link'
import { CalendarDays, ExternalLink, MapPin } from 'lucide-react'
import { requireSession } from '@/lib/session'
import { agenda, type AgendaEvent } from '@/lib/agenda'
import { linkEvent } from '@/lib/agenda-actions'
import { clientFor, linkTargets } from '@/lib/link-targets'
import { ActionForm, ButtonLink, Card, Empty, InlineField, Notice, PageTitle, Pill, Select, SubmitButton } from '@/components/ui'
import { NewEventButton } from '@/components/agenda/new-event-button'
import { dayKey, fmtDay, fmtTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { semanas?: string; cliente?: string }
const RANGES = [{ value: '1', label: 'Esta semana' }, { value: '2', label: 'Dos semanas' }, { value: '4', label: 'Cuatro semanas' }, { value: '12', label: 'Tres meses' }]

function linkFields(e: AgendaEvent) {
  return {
    connectionId: e.connectionId, calendarId: e.calendarId, eventId: e.id, summary: e.summary, start: e.start.toISOString(),
    end: e.end?.toISOString() ?? '', allDay: String(e.allDay), htmlLink: e.htmlLink ?? '',
  }
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const weeks = Number(sp.semanas) || 2
  const from = new Date(); from.setHours(0, 0, 0, 0)
  const to = new Date(from.getTime() + weeks * 7 * 864e5)
  const [{ events, errors, calendars }, { options, clients }] = await Promise.all([agenda(from, to), linkTargets()])
  const shown = sp.cliente ? events.filter((e) => e.link?.client?.id === sp.cliente) : events
  const days = [...new Set(shown.map((e) => dayKey(e.start)))]
  const calendarOptions = calendars.map((c) => ({ value: `${c.connectionId}|${c.calendarId}`, label: c.name, hint: c.account }))

  return (
    <>
      <PageTitle title="Agenda" sub={calendars.length ? `${shown.length} eventos en ${calendars.length} calendarios` : 'Sin calendarios conectados'}
        action={<NewEventButton calendars={calendarOptions} targets={options} today={dayKey(new Date())} />} />
      {calendars.length === 0 && (
        <Notice tone="info" title="Conecta tus calendarios de Google" className="mb-6" action={<ButtonLink href="/ajustes#google" variant="secondary">Ir a Ajustes</ButtonLink>}>
          En Ajustes › Google conecta las cuentas (Sn4p, iServisat, Codeia) y elige qué calendarios quieres ver aquí.
        </Notice>
      )}
      {errors.map((e) => <Notice key={e} tone="warn" title="Un calendario no se ha podido leer" className="mb-4">{e}</Notice>)}
      <Form action="/agenda" className="mb-6 flex flex-wrap gap-3">
        <Select name="semanas" defaultValue={String(weeks)} aria-label="Periodo" submitOnChange options={RANGES} />
        <Select name="cliente" defaultValue={sp.cliente ?? ''} aria-label="Cliente" submitOnChange options={[{ value: '', label: 'Todos los eventos' }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
      </Form>

      {calendars.length > 0 && days.length === 0 && <Card><Empty icon={<CalendarDays className="size-10" aria-hidden />} title="Nada en la agenda para este periodo" /></Card>}
      <div className="flex flex-col gap-6">
        {days.map((d) => (
          <Card key={d} title={fmtDay(shown.find((e) => dayKey(e.start) === d)!.start)}>
            <ul className="flex flex-col divide-y divide-line">
              {shown.filter((e) => dayKey(e.start) === d).map((e) => {
                const suggested = !e.link && clientFor(e.attendees, clients)
                const value = e.link?.project ? `p:${e.link.project.id}` : e.link?.client ? `c:${e.link.client.id}` : ''
                return (
                  <li key={e.key} className="grid gap-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[7rem_1fr_18rem]">
                    <div className="num text-lg font-semibold">{e.allDay ? <span className="text-base font-medium text-muted">Todo el día</span> : <>{fmtTime(e.start)}{e.end && <span className="block text-sm font-normal text-muted">hasta {fmtTime(e.end)}</span>}</>}</div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">{e.summary}</span>
                        <Pill><span className="size-2.5 rounded-full" style={{ background: e.color ?? '#999' }} aria-hidden />{e.calendar}</Pill>
                        {e.htmlLink && <a href={e.htmlLink} target="_blank" rel="noreferrer" className="text-muted hover:text-accent-strong" aria-label="Abrir en Google Calendar"><ExternalLink className="size-4" aria-hidden /></a>}
                      </div>
                      {e.location && <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-4" aria-hidden />{e.location}</p>}
                      {e.link?.client && <p className="mt-1 text-sm">Cliente: <Link href={`/clientes/${e.link.client.id}`} className="font-semibold text-accent-strong hover:underline">{e.link.client.name}</Link>{e.link.project && <> · <Link href={`/proyectos/${e.link.project.id}`} className="hover:underline">{e.link.project.name}</Link></>}</p>}
                      {suggested && (
                        <ActionForm action={linkEvent} success={`Ligado a ${suggested.name}`} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          {Object.entries(linkFields(e)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <input type="hidden" name="value" value={`c:${suggested.id}`} />
                          <span className="text-muted">Asiste alguien de {suggested.name}.</span>
                          <SubmitButton size="sm" variant="secondary">Ligar a {suggested.name}</SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                    <InlineField action={linkEvent} fields={linkFields(e)} label="Cliente o proyecto" hideLabel kind="combobox" allowCustom={false}
                      options={[{ value: '', label: 'Sin ligar' }, ...options]} value={value} placeholder="Ligar a cliente o proyecto" success="Guardado" />
                  </li>
                )
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
