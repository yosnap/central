import Form from 'next/form'
import Link from 'next/link'
import { ExternalLink, Mail, Search, Star } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { emailOf, getMail, searchMail, type MailHit } from '@/lib/google'
import { deleteSavedMessage, linkSavedMessage, saveMessage } from '@/lib/mail-actions'
import { clientFor, linkTargets } from '@/lib/link-targets'
import { ActionForm, Button, ButtonLink, Card, Combobox, ConfirmAction, Empty, InlineField, Input, Notice, PageTitle, Pill, Select, SubmitButton, Tabs } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

export const dynamic = 'force-dynamic'

type SP = { q?: string; cuenta?: string; ver?: string; vista?: string }
const gmailLink = (account: string, threadId: string) => `https://mail.google.com/mail/u/${encodeURIComponent(account)}/#all/${threadId}`
const sender = (from: string) => from.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || from

export default async function MailPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireSession()
  const sp = await searchParams
  const q = sp.q?.trim() || 'in:inbox'
  const [accounts, { options, clients }, saved] = await Promise.all([
    prisma.integrationConnection.findMany({ where: { provider: 'GOOGLE' }, select: { id: true, account: true }, orderBy: { account: 'asc' } }),
    linkTargets(),
    prisma.savedMessage.findMany({ orderBy: { receivedAt: 'desc' }, take: 200, include: { account: { select: { address: true } }, client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } } }),
  ])
  const searched = accounts.filter((a) => !sp.cuenta || a.id === sp.cuenta)
  const errors: string[] = []
  const hits = (await Promise.all(searched.map(async (a) => {
    try { return (await searchMail(a.id, q, 25)).map((h) => ({ ...h, connectionId: a.id, account: a.account ?? '' })) } catch (e) { errors.push(`${a.account}: ${(e as Error).message}`); return [] }
  }))).flat().sort((a, b) => b.date.getTime() - a.date.getTime())
  const savedIds = new Set(saved.map((s) => s.externalId))
  // mensaje abierto: «<conexión>:<id>»
  const [openConn, openId] = sp.ver?.split(':') ?? []
  const open = openConn && openId ? await getMail(openConn, openId).catch((e: Error) => { errors.push(e.message); return null }) : null
  const keep = (extra: Record<string, string>) => `/correo?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.cuenta ? { cuenta: sp.cuenta } : {}), ...extra })}`

  const SaveForm = ({ h }: { h: MailHit & { connectionId: string } }) => {
    const s = clientFor([emailOf(h.from), ...h.to.split(',').map(emailOf)], clients)
    return (
      <ActionForm action={saveMessage} success="Mensaje guardado" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="connectionId" value={h.connectionId} /><input type="hidden" name="messageId" value={h.id} />
        <div className="w-64"><Combobox name="value" aria-label="Ligar a" defaultValue={s ? `c:${s.id}` : ''} allowCustom={false} placeholder="Ligar a cliente o proyecto" searchPlaceholder="Buscar…" options={options} /></div>
        <SubmitButton size="sm" variant="secondary" pendingText="Guardando…"><Star className="size-4" aria-hidden />Guardar</SubmitButton>
      </ActionForm>
    )
  }

  const searchTab = (
    <div className="flex flex-col gap-5">
      <Form action="/correo" className="grid gap-3 md:grid-cols-[minmax(18rem,2fr)_minmax(12rem,1fr)_auto]">
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Buscar como en Gmail: from:cliente.com, subject:presupuesto, has:attachment…" aria-label="Buscar correo" className="pl-12" />
        </div>
        <Select name="cuenta" defaultValue={sp.cuenta ?? ''} aria-label="Cuenta" submitOnChange options={[{ value: '', label: 'Todas las cuentas' }, ...accounts.map((a) => ({ value: a.id, label: a.account ?? '' }))]} />
        <Button type="submit">Buscar</Button>
      </Form>
      {open && (
        <article className="rounded-2xl border border-accent/30 bg-panel p-5">
          <div className="mb-3 flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold">{open.subject}</h2>
              <p className="text-sm text-muted">{open.from} · {fmtDateTime(open.date)}{open.to && <> · para {open.to}</>}</p>
            </div>
            <ButtonLink href={keep({})} variant="ghost" size="sm">Cerrar</ButtonLink>
          </div>
          <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-ground p-4 text-base">{open.body || open.snippet}</div>
          {!savedIds.has(open.id) && <div className="mt-4"><SaveForm h={{ ...open, connectionId: openConn }} /></div>}
        </article>
      )}
      {hits.length === 0 ? <Empty icon={<Mail className="size-10" aria-hidden />} title="Ningún correo con esa búsqueda" /> : (
        <ul className="flex flex-col divide-y divide-line">
          {hits.map((h) => (
            <li key={`${h.connectionId}:${h.id}`} className="flex flex-col gap-2 py-4 first:pt-0 lg:flex-row lg:items-center">
              <Link href={keep({ ver: `${h.connectionId}:${h.id}` })} className="min-w-0 flex-1 rounded-xl hover:bg-ground/60">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={h.unread ? 'font-bold' : 'font-semibold'}>{sender(h.from)}</span>
                  <span className="text-sm text-muted">{fmtDateTime(h.date)}</span>
                  {accounts.length > 1 && <Pill>{h.account}</Pill>}
                  {savedIds.has(h.id) && <Pill tone="ok">Guardado</Pill>}
                </div>
                <div className="truncate font-medium">{h.subject}</div>
                <div className="truncate text-sm text-muted">{h.snippet}</div>
              </Link>
              {!savedIds.has(h.id) && <SaveForm h={h} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const savedTab = saved.length === 0 ? <Empty icon={<Star className="size-10" aria-hidden />} title="Aún no has guardado ningún correo">Busca un mensaje y pulsa «Guardar» para tenerlo ligado a su cliente.</Empty> : (
    <ul className="flex flex-col divide-y divide-line">
      {saved.map((m) => (
        <li key={m.id} className="grid gap-3 py-4 first:pt-0 lg:grid-cols-[1fr_18rem_auto]">
          <details className="min-w-0">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{sender(m.fromAddress)}</span><span className="text-sm text-muted">{fmtDateTime(m.receivedAt)}</span>{m.account && <Pill>{m.account.address}</Pill>}</div>
              <div className="font-medium">{m.subject}</div>
              <div className="truncate text-sm text-muted">{m.snippet}</div>
            </summary>
            {m.body && <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-ground p-4">{m.body}</div>}
          </details>
          <InlineField action={linkSavedMessage} fields={{ id: m.id }} label="Ligado a" hideLabel kind="combobox" allowCustom={false} options={[{ value: '', label: 'Sin ligar' }, ...options]}
            value={m.project ? `p:${m.project.id}` : m.client ? `c:${m.client.id}` : ''} placeholder="Ligar a cliente o proyecto" />
          <div className="flex items-start gap-2">
            {m.account && m.threadId && <ButtonLink href={gmailLink(m.account.address, m.threadId)} target="_blank" rel="noreferrer" variant="ghost" size="sm"><ExternalLink className="size-4" aria-hidden />Gmail</ButtonLink>}
            <ConfirmAction action={deleteSavedMessage} fields={{ id: m.id }} title="Quitar de guardados" confirmLabel="Quitar" success="Quitado"
              description="Se borra la copia de Central. En Gmail no se toca nada.">Quitar</ConfirmAction>
          </div>
        </li>
      ))}
    </ul>
  )

  return (
    <>
      <PageTitle title="Correo" sub={accounts.length ? `${accounts.map((a) => a.account).join(' · ')} · solo lectura` : 'Sin cuentas conectadas'} />
      {accounts.length === 0 && (
        <Notice tone="info" title="Conecta tus cuentas de Gmail" className="mb-6" action={<ButtonLink href="/ajustes#google" variant="secondary">Ir a Ajustes</ButtonLink>}>
          En Ajustes › Google conecta las cuentas para buscar correo y guardar los mensajes importantes ligados a cada cliente.
        </Notice>
      )}
      {errors.map((e) => <Notice key={e} tone="warn" title="Una cuenta no se ha podido leer" className="mb-4">{e}</Notice>)}
      <Card>
        <Tabs defaultValue={sp.vista === 'guardados' ? 'saved' : 'search'} tabs={[
          { value: 'search', label: 'Buscar', content: searchTab },
          { value: 'saved', label: <>Guardados<span className="num text-muted">{saved.length}</span></>, content: savedTab },
        ]} />
      </Card>
    </>
  )
}
