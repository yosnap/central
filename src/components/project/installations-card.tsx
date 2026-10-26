import { addInstallation, removeInstallation } from '@/lib/project-actions'
import { ActionForm, Card, Combobox, ConfirmAction, Empty, Input, Pill, SubmitButton, Table } from '@/components/ui'
import { fmtDate } from '@/lib/format'

type Installation = { id: string; version: string | null; notes: string | null; installedAt: Date; website: { id: string; url: string; label: string | null; lastStatus: string | null } }

/** Un plugin o tema no tiene dominios propios: tiene instalaciones en webs. */
export function InstallationsCard({ projectId, version, installations, websites }: {
  projectId: string
  version: string | null
  installations: Installation[]
  websites: { id: string; url: string; label: string | null }[]
}) {
  const host = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <Card title="Instalaciones" note="Webs en las que está instalado este plugin o tema, y con qué versión." className="xl:col-span-3">
      {installations.length === 0 ? <Empty title="Sin instalaciones todavía">Añade abajo las webs donde está instalado.</Empty> : (
        <Table head={['Web', 'Versión instalada', 'Notas', 'Desde', '']}>
          {installations.map((i) => (
            <tr key={i.id}>
              <td>
                <a href={i.website.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-strong hover:underline">{i.website.label ?? host(i.website.url)}</a>
                {i.website.lastStatus === 'down' && <span className="ml-2"><Pill tone="bad">Caída</Pill></span>}
              </td>
              <td className="num">
                {i.version ?? '—'}
                {i.version && version && i.version !== version && <span className="ml-2"><Pill tone="warn">Hay {version}</Pill></span>}
              </td>
              <td className="text-muted">{i.notes ?? ''}</td>
              <td className="whitespace-nowrap text-muted">{fmtDate(i.installedAt)}</td>
              <td className="text-right">
                <ConfirmAction action={removeInstallation} fields={{ id: i.id }} title="Quitar esta instalación" description={`Deja de constar que está instalado en ${host(i.website.url)}.`} confirmLabel="Quitar" success="Instalación quitada">Quitar</ConfirmAction>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <ActionForm action={addInstallation} success="Instalación guardada" className="mt-6 grid gap-3 md:grid-cols-[2fr_minmax(9rem,1fr)_2fr_auto]">
        <input type="hidden" name="id" value={projectId} />
        <Combobox name="website" aria-label="Web" required allowCustom placeholder="Web donde está instalado" searchPlaceholder="Buscar web o escribir dominio…" options={websites.map((w) => ({ value: w.id, label: w.label ?? host(w.url), hint: w.label ? host(w.url) : undefined }))} />
        <Input name="version" aria-label="Versión instalada" placeholder={version ?? 'Versión'} />
        <Input name="notes" aria-label="Notas" placeholder="Notas (opcional)" />
        <SubmitButton variant="secondary">Añadir instalación</SubmitButton>
      </ActionForm>
    </Card>
  )
}
