import Link from 'next/link'
import { CalendarDays, ExternalLink, Star } from 'lucide-react'
import { Card, Empty } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

type Msg = { id: string; fromAddress: string; subject: string; snippet: string | null; receivedAt: Date; threadId: string | null; account: { address: string } | null }
type Ev = { id: string; summary: string; start: Date; allDay: boolean; htmlLink: string | null }

/** Correos guardados y eventos de la agenda ligados al cliente. */
export function ClientCommsCard({ clientId, messages, events }: { clientId: string; messages: Msg[]; events: Ev[] }) {
  const now = Date.now()
  const next = events.filter((e) => e.start.getTime() >= now - 864e5)
  const past = events.filter((e) => e.start.getTime() < now - 864e5).slice(-5).reverse() // los cinco más recientes
  return (
    <>
      <Card title="Correos guardados" className="xl:col-span-2" action={<Link href={`/correo?vista=guardados`} className="text-sm text-accent-strong hover:underline">Ir a Correo</Link>}>
        {messages.length === 0 ? <Empty icon={<Star className="size-8" aria-hidden />} title="Sin correos guardados">En Correo, busca sus mensajes y pulsa «Guardar».</Empty> : (
          <ul className="flex flex-col divide-y divide-line">
            {messages.map((m) => (
              <li key={m.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{m.subject}</span>
                  <span className="text-sm text-muted">{fmtDateTime(m.receivedAt)}</span>
                  {m.account && m.threadId && <a href={`https://mail.google.com/mail/u/${encodeURIComponent(m.account.address)}/#all/${m.threadId}`} target="_blank" rel="noreferrer" aria-label="Abrir en Gmail" className="text-muted hover:text-accent-strong"><ExternalLink className="size-4" aria-hidden /></a>}
                </div>
                <div className="truncate text-sm text-muted">{m.fromAddress} · {m.snippet}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Agenda" action={<Link href={`/agenda?cliente=${clientId}&semanas=12`} className="text-sm text-accent-strong hover:underline">Ver en la agenda</Link>}>
        {events.length === 0 ? <Empty icon={<CalendarDays className="size-8" aria-hidden />} title="Sin eventos ligados">En la Agenda, liga sus reuniones a este cliente.</Empty> : (
          <div className="flex flex-col gap-4">
            {[['Próximos', next], ['Anteriores', past]].map(([title, list]) => (list as Ev[]).length > 0 && (
              <section key={title as string}>
                <h3 className="mb-1 text-sm font-semibold text-muted">{title as string}</h3>
                <ul className="flex flex-col gap-1.5">
                  {(list as Ev[]).map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center gap-2">
                      <span className="num text-sm text-muted">{e.allDay ? fmtDateTime(e.start).split(',')[0] : fmtDateTime(e.start)}</span>
                      {e.htmlLink ? <a href={e.htmlLink} target="_blank" rel="noreferrer" className="font-medium hover:underline">{e.summary}</a> : <span className="font-medium">{e.summary}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
