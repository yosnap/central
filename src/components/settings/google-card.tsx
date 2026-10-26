import { Plus, RefreshCw } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { callbackPath, type GoogleConfig } from '@/lib/google'
import { disconnectGoogle, refreshCalendars, saveCalendars, saveGoogleApp } from '@/lib/google-actions'
import { ActionForm, ButtonLink, Card, Checkbox, ConfirmAction, Field, Input, Notice, Pill, SubmitButton } from '@/components/ui'
import { fmtDateTime } from '@/lib/format'

const RESULT: Record<string, { tone: 'ok' | 'warn' | 'bad'; title: string }> = {
  ok: { tone: 'ok', title: 'Cuenta conectada' },
  cancelado: { tone: 'warn', title: 'Has cancelado la conexión en Google' },
  caducado: { tone: 'warn', title: 'La conexión ha caducado; vuelve a pulsar «Conectar cuenta»' },
  'sin-cliente': { tone: 'warn', title: 'Primero guarda el cliente OAuth de Google (abajo)' },
  error: { tone: 'bad', title: 'No se ha podido conectar la cuenta' },
}

/** Google: cliente OAuth, cuentas conectadas (Gmail y Calendar) y calendarios que se ven en la agenda. */
export async function GoogleCard({ result, account, reason, origin }: { result?: string; account?: string; reason?: string; origin: string }) {
  const [app, accounts] = await Promise.all([
    prisma.integrationConnection.findFirst({ where: { provider: 'GOOGLE_APP' }, select: { account: true } }),
    prisma.integrationConnection.findMany({ where: { provider: 'GOOGLE' }, orderBy: { account: 'asc' } }),
  ])
  const r = result ? RESULT[result] : null
  return (
    <section id="google">
      <Card title="Google: correo y agenda" className="xl:col-span-2"
        note="Gmail en solo lectura (buscar y guardar mensajes importantes) y Google Calendar (ver y crear eventos). Puedes conectar varias cuentas: Sn4p, iServisat, Codeia… Los permisos se guardan cifrados."
        action={app && <ButtonLink href="/api/google/connect"><Plus className="size-5" aria-hidden />Conectar cuenta</ButtonLink>}>
        {r && <Notice tone={r.tone} title={r.title} className="mb-5">{result === 'ok' ? `${account} ya está en Central. Elige abajo qué calendarios quieres ver en la agenda.` : reason}</Notice>}

        {accounts.length > 0 && (
          <div className="mb-6 flex flex-col gap-4">
            {accounts.map((a) => {
              const cals = (a.config as GoogleConfig | null)?.calendars ?? []
              return (
                <section key={a.id} className="rounded-2xl border border-line p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-semibold">{a.account}</span>
                    {a.lastError ? <Pill tone="bad">{a.lastError}</Pill> : <Pill tone="ok">Conectada{a.lastOkAt ? ` · ${fmtDateTime(a.lastOkAt)}` : ''}</Pill>}
                    <div className="ml-auto flex gap-2">
                      {a.lastError && <ButtonLink href={`/api/google/connect?cuenta=${encodeURIComponent(a.account ?? '')}`} variant="secondary" size="sm">Volver a conectar</ButtonLink>}
                      <ActionForm action={refreshCalendars} success="Calendarios actualizados"><input type="hidden" name="id" value={a.id} /><SubmitButton variant="ghost" size="sm" pendingText="Leyendo…"><RefreshCw className="size-4" aria-hidden />Releer calendarios</SubmitButton></ActionForm>
                      <ConfirmAction action={disconnectGoogle} fields={{ id: a.id }} title={`Quitar ${a.account}`} confirmLabel="Quitar cuenta" success="Cuenta quitada"
                        description="Central deja de leer su correo y su agenda. Los mensajes guardados se conservan. En Google no se toca nada; si quieres, retira también el acceso en myaccount.google.com › Seguridad.">Quitar</ConfirmAction>
                    </div>
                  </div>
                  {cals.length === 0 ? <p className="text-sm text-muted">Sin calendarios leídos todavía. Pulsa «Releer calendarios».</p> : (
                    <ActionForm action={saveCalendars} success="Calendarios guardados" className="flex flex-col gap-3">
                      <input type="hidden" name="id" value={a.id} />
                      {cals.map((c) => (
                        <div key={c.id} className="grid items-center gap-3 md:grid-cols-[minmax(14rem,1fr)_16rem]">
                          <Checkbox name="selected" value={c.id} defaultChecked={c.selected}
                            label={<span className="inline-flex items-center gap-2"><span className="size-3 rounded-full" style={{ background: c.color ?? '#999' }} aria-hidden />{c.summary}{c.primary ? ' (principal)' : ''}</span>} />
                          <Input name={`label:${c.id}`} defaultValue={c.label ?? ''} placeholder="Nombre en la agenda (p. ej. Sn4p)" aria-label={`Nombre de ${c.summary} en la agenda`} />
                        </div>
                      ))}
                      <SubmitButton variant="secondary" size="sm" className="self-start">Guardar calendarios</SubmitButton>
                    </ActionForm>
                  )}
                </section>
              )
            })}
          </div>
        )}

        <details className="rounded-2xl border border-line p-5" open={!app}>
          <summary className="cursor-pointer text-lg font-semibold">{app ? 'Cliente OAuth de Google (guardado)' : 'Primer paso: crear el cliente OAuth de Google'}</summary>
          <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-base">
            <li>En <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">Google Cloud</a>, crea un proyecto (por ejemplo «Central»).</li>
            <li>Activa la <a href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">API de Gmail</a> y la <a href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">API de Google Calendar</a>.</li>
            <li>En <a href="https://console.cloud.google.com/auth/overview" target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">Google Auth Platform</a> configura la pantalla de permisos: tipo «Externo» (o «Interno» si todas las cuentas son del mismo Workspace) y añade tus cuentas como usuarios de prueba.</li>
            <li>En <a href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer" className="text-accent-strong hover:underline">Clientes</a>, crea uno de tipo «Aplicación web» con este URI de redirección: <code className="rounded bg-ground px-1.5 py-0.5 font-mono text-sm">{origin}{callbackPath}</code></li>
            <li>Descarga el JSON del cliente, impórtalo aquí abajo y pulsa «Conectar cuenta».</li>
          </ol>
          <p className="mt-3 text-sm text-muted">Mientras la app esté «en pruebas», Google pide volver a conectar cada 7 días; para evitarlo, publícala (para uso propio no hace falta verificarla) o usa el tipo «Interno» en Workspace.</p>
          <ActionForm action={saveGoogleApp} success="Cliente OAuth guardado" className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="callback" value={`${origin}${callbackPath}`} />
            <Field label="JSON del cliente (el que descarga Google Cloud)" htmlFor="g-json" hint="Se lee aquí y se guarda cifrado; el fichero no se conserva.">
              <Input id="g-json" name="json" type="file" accept="application/json,.json" required className="cursor-pointer py-2.5" />
            </Field>
            <SubmitButton>Importar</SubmitButton>
          </ActionForm>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted">O escribe el ID y el secreto a mano</summary>
            <ActionForm action={saveGoogleApp} success="Cliente OAuth guardado" className="mt-3 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
              <Field label="ID de cliente" htmlFor="g-id"><Input id="g-id" name="clientId" defaultValue={app?.account ?? ''} placeholder="…apps.googleusercontent.com" required /></Field>
              <Field label="Secreto del cliente" htmlFor="g-secret"><Input id="g-secret" name="clientSecret" type="password" placeholder={app ? 'Guardado (dejar vacío)' : 'GOCSPX-…'} required={!app} autoComplete="off" /></Field>
              <SubmitButton className="self-end">Guardar</SubmitButton>
            </ActionForm>
          </details>
        </details>
      </Card>
    </section>
  )
}
