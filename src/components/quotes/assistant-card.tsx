import { Bot, Check, FileText, RotateCcw, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { applyProposal, clearConversation } from '@/lib/assistant-actions'
import { parseProposal, type Proposal } from '@/lib/quote-ai'
import { moneyRange } from '@/lib/quotes'
import { ActionForm, AutoRefresh, Card, ConfirmAction, Notice, Pill, SubmitButton, cn } from '@/components/ui'
import { isRemote, macOnline, pendingFor } from '@/lib/worker'
import { ago } from '@/lib/format'
import { AssistantForm } from './assistant-form'
import { Markdown } from './markdown'

const cents = (v: number) => Math.round(v * 100)

function ProposalPreview({ id, p, applied, latest }: { id: string; p: Proposal; applied: Date | null; latest: boolean }) {
  const min = p.items.reduce((s, i) => s + cents(i.price * (i.quantity ?? 1)), 0)
  const max = p.items.reduce((s, i) => s + cents((i.priceMax ?? i.price) * (i.quantity ?? 1)), 0)
  return (
    <div className="mt-4 rounded-2xl border border-line bg-panel p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <FileText className="size-5 text-accent-strong" aria-hidden />
        <span className="font-semibold">{p.title}</span>
        <span className="ml-auto num font-semibold">{moneyRange(min, max)} sin IVA</span>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {p.items.map((i, n) => (
          <li key={n} className="flex gap-3">
            <span className="min-w-0 flex-1">{i.name}</span>
            <span className="num whitespace-nowrap text-muted">{moneyRange(cents(i.price), i.priceMax == null ? null : cents(i.priceMax))}{i.quantity && i.quantity !== 1 ? ` × ${i.quantity}` : ''}</span>
          </li>
        ))}
      </ul>
      {p.payments.length > 0 && <p className="mt-2 text-sm text-muted">Pago: {p.payments.map((x) => `${x.percent} % ${x.name.toLowerCase()}`).join(' · ')}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {applied ? <Pill tone="ok"><Check className="size-4" aria-hidden />Aplicada {ago(applied)}</Pill> : null}
        {(!applied || !latest) && (
          <ActionForm action={applyProposal} success="Propuesta aplicada al presupuesto">
            <input type="hidden" name="id" value={id} />
            <SubmitButton size="sm" variant={latest && !applied ? 'primary' : 'secondary'} pendingText="Aplicando…">{applied ? 'Volver a aplicar' : 'Aplicar al presupuesto'}</SubmitButton>
          </ActionForm>
        )}
        <span className="text-sm text-muted">Sustituye el desglose, las secciones y la forma de pago.</span>
      </div>
    </div>
  )
}

/** Chat con Claude Code para preparar el presupuesto a partir de documentos o un listado de tareas. */
export async function AssistantCard({ quoteId, empty }: { quoteId: string; empty: boolean }) {
  const [messages, pending, mac] = await Promise.all([
    prisma.quoteMessage.findMany({ where: { quoteId }, orderBy: { createdAt: 'asc' } }),
    isRemote() ? pendingFor('assistant', 'quoteId', quoteId) : [],
    isRemote() ? macOnline() : null,
  ])
  const lastProposal = [...messages].reverse().find((m) => m.proposal)?.id
  return (
    <Card title="Asistente de presupuestos" className="xl:col-span-3"
      note="Pásale los documentos del cliente o un listado de tareas: los analiza y propone el presupuesto por fases o paquetes (sin horas), con rangos cuando hay incertidumbre. Usa Claude Code de este Mac."
      action={messages.length > 0 && (
        <ConfirmAction action={clearConversation} fields={{ quoteId }} variant="ghost" title="Empezar de nuevo" confirmLabel="Borrar conversación"
          description="Se borran la conversación y los documentos subidos. El presupuesto no se toca." success="Conversación borrada">
          <RotateCcw className="size-4" aria-hidden />Empezar de nuevo
        </ConfirmAction>
      )}>
      {messages.length > 0 && (
        <ol className="mb-5 flex max-h-[42rem] flex-col gap-4 overflow-y-auto pr-1">
          {messages.map((m) => {
            const p = m.proposal ? parseProposal(m.proposal) : null
            const mine = m.role === 'user'
            return (
              <li key={m.id} className={cn('rounded-2xl p-4', mine ? 'ml-auto max-w-3xl bg-accent-soft' : m.error ? 'border border-bad/40 bg-bad/5' : 'border border-line bg-ground')}>
                <div className="mb-2 flex items-center gap-2 text-sm text-muted">
                  {mine ? 'Tú' : <><Bot className="size-4" aria-hidden />Asistente</>}<span>· {ago(m.createdAt)}</span>
                </div>
                {m.content ? (mine ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown text={m.content} />) : null}
                {m.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{m.attachments.map((a) => <Pill key={a}><FileText className="size-3.5" aria-hidden />{a}</Pill>)}</div>}
                {p?.success && <ProposalPreview id={m.id} p={p.data} applied={m.appliedAt} latest={m.id === lastProposal} />}
              </li>
            )
          })}
        </ol>
      )}
      {messages.length === 0 && (
        <p className="mb-4 flex items-start gap-2 text-muted"><Sparkles className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden />
          {empty ? 'Empieza por aquí: adjunta el documento del cliente o pega las tareas y el asistente prepara el desglose, el alcance, lo que incluye y no incluye, el cronograma y la forma de pago.' : 'Puedes pedirle que revise el presupuesto actual o que lo rehaga con nuevos documentos.'}
        </p>
      )}
      {pending.length > 0 && (
        <Notice tone={mac?.online ? 'info' : 'warn'} title={mac?.online ? 'El asistente está trabajando en tu Mac' : 'Esperando a que se conecte tu Mac'} className="mb-4">
          {mac?.online ? 'Lee los documentos y prepara la propuesta; aparecerá aquí sola en un par de minutos.' : 'El asistente usa Claude Code de tu Mac. En cuanto el Mac esté encendido y con el trabajador en marcha, responderá.'}
          <AutoRefresh />
        </Notice>
      )}
      {isRemote() && !pending.length && mac && !mac.online && (
        <Notice tone="warn" title="Tu Mac no está conectado" className="mb-4">Puedes escribir igualmente: el mensaje queda en cola y el asistente responde cuando el Mac se conecte.</Notice>
      )}
      <AssistantForm quoteId={quoteId} first={messages.length === 0} />
    </Card>
  )
}
