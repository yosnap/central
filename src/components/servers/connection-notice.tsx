import { trustServerHost } from '@/lib/server-actions'
import { hostFingerprint } from '@/lib/servers/register'
import { ConfirmAction, Notice } from '@/components/ui'
import { InstallButton } from './install-button'
import { fmtDateTime } from '@/lib/format'

type Server = { id: string; name: string; host: string; sshPort: number; adminUser: string | null; error: string | null; pausedUntil: Date | null; lastOkAt: Date | null }

/** Qué hacer cuando Central no puede leer el servidor. */
export async function ConnectionNotice({ server: s }: { server: Server }) {
  if (!s.error || s.error === 'lectura incompleta') return null
  const paused = s.pausedUntil && s.pausedUntil > new Date() ? ` No se reintenta hasta las ${fmtDateTime(s.pausedUntil)} (o pulsa «Leer ahora»).` : ''
  const last = s.lastOkAt ? ` Se muestra la última lectura buena (${fmtDateTime(s.lastOkAt)}).` : ''

  if (s.error === 'clave de host no confiada') {
    const fp = await hostFingerprint(s.host, s.sshPort).catch((e: unknown) => ({ error: e instanceof Error ? e.message : 'error' }))
    return (
      <Notice tone="warn" title="Este Mac aún no confía en la clave del servidor" className="mb-6"
        action={'fingerprint' in fp && (
          <ConfirmAction action={trustServerHost} fields={{ id: s.id, fingerprint: fp.fingerprint }} title="Confiar en el servidor" danger={false} variant="secondary" confirmLabel="Confiar"
            description={<>Comprueba que la huella coincide con la de tu proveedor o con <code>ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</code> en el servidor: <code>{fp.fingerprint}</code></>}>
            Confiar en esta huella
          </ConfirmAction>
        )}>
        {'fingerprint' in fp ? <>Huella ed25519: <code>{fp.fingerprint}</code>.{last}</> : <>No se pudo pedir la huella: {fp.error}.</>}
      </Notice>
    )
  }
  if (s.error === 'autenticacion' || s.error.startsWith('falta la clave')) {
    return (
      <Notice tone="warn" title="infobar no está instalado en el servidor (o no acepta la clave de este Mac)" className="mb-6"
        action={<InstallButton id={s.id} host={s.host} user={s.adminUser} label="Instalar infobar" variant="primary" />}>
        Pulsa «Instalar infobar» y escribe el usuario administrador del servidor y su contraseña. Central hace el resto.{paused}
      </Notice>
    )
  }
  return <Notice tone="bad" title={`No se puede leer: ${s.error}`} className="mb-6">Revisa que el servidor esté encendido y que el puerto {s.sshPort} sea accesible desde este Mac.{paused}{last}</Notice>
}
