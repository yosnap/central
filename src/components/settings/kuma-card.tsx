import { Activity, ExternalLink, RefreshCw } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { saveKuma, syncKumaNow, testKuma } from '@/lib/kuma-actions'
import { ActionForm, ButtonLink, Card, Field, Input, Notice, Pill, SubmitButton } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

/** Conexión con Uptime Kuma: vigila las webs y avisa por Telegram y correo. */
export async function KumaCard() {
  const [conn, monitored, linked] = await Promise.all([
    prisma.integrationConnection.findFirst({ where: { provider: 'UPTIME_KUMA' } }),
    prisma.website.count({ where: { monitored: true } }),
    prisma.website.count({ where: { monitored: true, kumaMonitorId: { not: null } } }),
  ])
  const url = conn?.baseUrl ?? 'http://localhost:3098'
  return (
    <Card
      title="Uptime Kuma"
      note="Vigila cada web de Central y avisa por Telegram y correo cuando cae, cuando vuelve y antes de que caduque el SSL. Central crea y actualiza los monitores sola."
      action={<ButtonLink href={url} target="_blank" rel="noreferrer" variant="ghost" size="sm"><ExternalLink className="size-4" aria-hidden />Abrir Uptime Kuma</ButtonLink>}
    >
      {conn && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Activity className="size-5 text-muted" aria-hidden />
          {conn.lastError ? <Pill tone="bad">{conn.lastError}</Pill> : conn.lastOkAt ? <Pill tone="ok">Conectado · {fmtDateTime(conn.lastOkAt)}</Pill> : <Pill>Sin probar</Pill>}
          <span className="text-sm text-muted">{linked} de {monitored} webs vigiladas tienen monitor</span>
          <ActionForm action={testKuma} success="Prueba terminada"><SubmitButton variant="secondary" size="sm">Probar conexión</SubmitButton></ActionForm>
          <ActionForm action={syncKumaNow} success="Monitores sincronizados"><SubmitButton variant="secondary" size="sm" pendingText="Sincronizando…"><RefreshCw className="size-4" aria-hidden />Sincronizar monitores</SubmitButton></ActionForm>
        </div>
      )}
      {!conn && (
        <Notice tone="info" title="Primeros pasos" className="mb-5">
          <ol className="ml-5 list-decimal space-y-1">
            <li>Abre Uptime Kuma y crea tu usuario administrador.</li>
            <li>En <em>Ajustes › Notificaciones</em> añade Telegram (token del bot de @BotFather y tu chat id) y correo (SMTP). En cada uno marca «Activado por defecto».</li>
            <li>En <em>Ajustes › Claves de API</em> crea una clave para las métricas.</li>
            <li>Escribe aquí la URL, el usuario, la contraseña y la clave.</li>
          </ol>
        </Notice>
      )}
      <ActionForm action={saveKuma} success="Conexión con Uptime Kuma guardada" className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1.5fr_auto]">
        <Field label="URL" htmlFor="kuma-url"><Input id="kuma-url" name="url" defaultValue={url} required /></Field>
        <Field label="Usuario" htmlFor="kuma-user"><Input id="kuma-user" name="username" defaultValue={conn?.account ?? ''} required autoComplete="off" /></Field>
        <Field label="Contraseña" htmlFor="kuma-pass"><Input id="kuma-pass" name="password" type="password" placeholder={conn ? 'Guardada (dejar vacío)' : ''} autoComplete="off" /></Field>
        <Field label="Clave de API de métricas" htmlFor="kuma-key"><Input id="kuma-key" name="apiKey" type="password" placeholder={conn ? 'Guardada (dejar vacío)' : 'uk1_…'} autoComplete="off" /></Field>
        <SubmitButton className="self-end">Guardar</SubmitButton>
      </ActionForm>
    </Card>
  )
}
