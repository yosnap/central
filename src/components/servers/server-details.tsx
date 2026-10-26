import { updateServerField } from '@/lib/server-actions'
import { Card, InlineField } from '@/components/ui'
import { Brand } from '@/components/brand-logo'
import { PANELS, PROVIDERS, brandOptions } from '@/lib/brands'

type Server = { id: string; name: string; host: string; sshPort: number; provider: string | null; panel: string | null; panelUrl: string | null; adminUser: string | null; knownIps: string[]; allowMail: boolean; notes: string | null }

/** Datos del servidor, editables en su sitio. */
export function ServerDetails({ server: s, action }: { server: Server; action?: React.ReactNode }) {
  const f = (field: string) => ({ action: updateServerField, fields: { id: s.id, field } })
  return (
    <Card title="Datos del servidor" note="Central entra solo por SSH con el usuario de solo lectura infobar; no necesita el usuario ni la contraseña del panel." action={action}>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        <InlineField {...f('name')} label="Nombre" value={s.name} />
        <InlineField {...f('host')} label="Host" value={s.host} hint="IP o nombre del servidor." />
        <InlineField {...f('sshPort')} label="Puerto SSH" value={String(s.sshPort)} kind="number" />
        <InlineField {...f('provider')} label="Proveedor" value={s.provider ?? ''} kind="combobox" options={PROVIDERS.map((p) => ({ value: p.label, label: p.label }))} display={s.provider ? <Brand name={s.provider} /> : undefined} placeholder="Elige o escribe uno nuevo" />
        <InlineField {...f('panel')} label="Panel" value={s.panel ?? ''} kind="combobox" options={brandOptions(PANELS)} display={s.panel ? <Brand name={s.panel} /> : undefined} placeholder="Sin panel" />
        <InlineField {...f('panelUrl')} label="URL del panel" value={s.panelUrl ?? ''} placeholder="Solo para el botón «Abrir panel»" />
        <InlineField {...f('adminUser')} label="Usuario administrador" value={s.adminUser ?? ''} placeholder="root"
          hint="Solo para instalar o actualizar infobar; la contraseña se pide en ese momento y no se guarda." />
        <InlineField {...f('knownIps')} label="IPs conocidas" value={s.knownIps.join(', ')} placeholder="Ninguna"
          hint="Orígenes de sesión esperados; una sesión desde otra IP sale en ámbar." />
        <InlineField {...f('allowMail')} label="Servidor de correo" value={s.allowMail ? 'true' : 'false'} kind="select"
          options={[{ value: 'false', label: 'No' }, { value: 'true', label: 'Sí: sus puertos de correo están permitidos' }]} />
        <InlineField {...f('notes')} label="Notas" value={s.notes ?? ''} kind="textarea" className="md:col-span-2 xl:col-span-3" />
      </div>
    </Card>
  )
}
