import Link from 'next/link'
import { RefreshCw, Server } from 'lucide-react'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/session'
import { addServer } from '@/lib/server-actions'
import { runServers, visibleStatus } from '@/lib/servers/collect'
import type { Snapshot } from '@/lib/servers/snapshot'
import { ServerForm } from '@/components/servers/server-form'
import { ActionForm, Card, Empty, PageTitle, Pill, SubmitButton } from '@/components/ui'
import { LEVEL_LABEL, LEVEL_TONE, ago } from '@/lib/format'
import { Brand } from '@/components/brand-logo'

export const dynamic = 'force-dynamic'

async function readAll() {
  'use server'
  await requireSession()
  await runServers({ force: true })
  revalidatePath('/servidores')
}

const pctText = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)} %`)

export default async function ServersPage() {
  await requireSession()
  const servers = await prisma.server.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { services: true } } } })
  const bad = servers.filter((s) => ['red', 'grey'].includes(visibleStatus(s))).length
  return (
    <>
      <PageTitle
        title="Servidores"
        sub={servers.length ? `${servers.length} servidores · ${bad} con algo que actuar o sin dato` : 'Ninguno dado de alta'}
        action={servers.length > 0 && <ActionForm action={readAll} success="Servidores leídos"><SubmitButton variant="secondary" pendingText="Leyendo…"><RefreshCw className="size-5" aria-hidden />Leer ahora</SubmitButton></ActionForm>}
      />
      {servers.length === 0 ? (
        <Empty icon={<Server className="size-8" aria-hidden />} title="Aún no hay servidores">
          Da de alta uno abajo. Central lo leerá por SSH cada 5 minutos con el usuario de solo lectura <code>infobar</code>.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {servers.map((s) => {
            const snap = s.snapshot as Snapshot | null
            const level = visibleStatus(s)
            const c = snap?.cards ?? {}
            return (
              <Link key={s.id} href={`/servidores/${s.id}`} className="rounded-2xl border border-line bg-panel p-6 shadow-sm transition hover:border-accent">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold tracking-tight">{s.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <Brand name={s.provider} /><Brand name={s.panel} /><span className="truncate">{s.host}</span>
                    </p>
                  </div>
                  <Pill tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Pill>
                </div>
                {s.error && <p className="mt-3 text-sm text-bad">{s.error}</p>}
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {([['CPU', c.cpu?.pct], ['Memoria', c.memory?.pct], ['Disco', c.disk?.pct]] as const).map(([label, v]) => (
                    <div key={label} className="rounded-xl bg-ground px-2 py-2">
                      <dt className="text-sm text-muted">{label}</dt>
                      <dd className="num text-lg font-semibold">{pctText(v as number | undefined)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-sm text-muted">
                  {c.services ? `${c.services.ok}/${c.services.total} servicios · ` : ''}
                  {snap?.protection ? `protección ${snap.protection.done}/${snap.protection.total} · ` : ''}
                  {s._count.services} servicios de proyecto · leído {ago(s.lastOkAt)}
                </p>
              </Link>
            )
          })}
        </div>
      )}
      <Card title="Dar de alta un servidor" className="mt-6" note={<>Central entra solo por SSH con el usuario de solo lectura <code>infobar</code>; no hace falta el usuario del panel. Si <code>infobar</code> ya está instalado (por ejemplo, por CostGuard), lo lee al momento; si no, en su ficha verás el comando para instalarlo.</>}>
        <ServerForm action={addServer} />
      </Card>
    </>
  )
}
