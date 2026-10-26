import { updateQuoteField } from '@/lib/quote-actions'
import { Card, InlineField } from '@/components/ui'

export type ScheduleRow = { when: string; what: string }
export type QuoteContent = {
  id: string; scope: string | null; includes: string[]; excludes: string[]; assumptions: string[]
  thirdPartyCosts: string | null; notes: string | null; schedule: ScheduleRow[]
}

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <span className="text-muted">{empty}</span>
  return <ul className="list-disc pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
}

/** Las secciones del documento: alcance, cronograma, qué incluye y qué no, costes de terceros, supuestos y notas. */
export function ContentCard({ q }: { q: QuoteContent }) {
  const edit = (field: string) => ({ action: updateQuoteField, fields: { id: q.id, field } })
  const text = (v: string | null) => (v ? <span className="whitespace-pre-wrap">{v}</span> : undefined)
  return (
    <Card title="Contenido del presupuesto" className="xl:col-span-3" note="Lo que sale en el PDF y en el Word además del desglose. En las listas, un elemento por línea; en el cronograma, «cuándo: qué».">
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <InlineField {...edit('scope')} label="Objeto y alcance" kind="textarea" value={q.scope ?? ''} placeholder="Qué se hace, para qué y con qué tecnología" display={text(q.scope)} className="lg:col-span-2" />
        <InlineField {...edit('schedule')} label="Cronograma" kind="textarea" value={q.schedule.map((r) => (r.when ? `${r.when}: ${r.what}` : r.what)).join('\n')} placeholder="Semanas 1–2: arranque y configuración"
          display={q.schedule.length ? <ul className="flex flex-col gap-1">{q.schedule.map((r, i) => <li key={i}>{r.when && <span className="font-semibold">{r.when}: </span>}{r.what}</li>)}</ul> : undefined} />
        <InlineField {...edit('includes')} label="Incluye" kind="textarea" value={q.includes.join('\n')} display={<List items={q.includes} empty="—" />} />
        <InlineField {...edit('excludes')} label="No incluye" kind="textarea" value={q.excludes.join('\n')} display={<List items={q.excludes} empty="—" />} />
        <InlineField {...edit('assumptions')} label="Supuestos y condiciones" kind="textarea" value={q.assumptions.join('\n')} display={<List items={q.assumptions} empty="—" />} />
        <InlineField {...edit('thirdPartyCosts')} label="Costes de terceros (a cargo del cliente)" kind="textarea" value={q.thirdPartyCosts ?? ''} placeholder="Infraestructura, APIs, cuentas de tiendas…" display={text(q.thirdPartyCosts)} />
        <InlineField {...edit('notes')} label="Notas finales" kind="textarea" value={q.notes ?? ''} placeholder="Precios variables, validez, cambios de alcance…" display={text(q.notes)} />
      </div>
    </Card>
  )
}
