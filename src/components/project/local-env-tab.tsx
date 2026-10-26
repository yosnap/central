import { FileKey2 } from 'lucide-react'
import { importLocalEnvFile } from '@/lib/secret-actions'
import { localContainers, localUrlUp } from '@/lib/local-status'
import type { ComposeService, EnvFile } from '@/lib/local-env'
import { envLabel } from '@/lib/environments'
import { ActionForm, Pill, SubmitButton, Table } from '@/components/ui'
import { isRemote } from '@/lib/worker'

type Props = { projectId: string; path: string | null; localUrl: string | null; composeProject: string | null; compose: ComposeService[]; envFiles: EnvFile[]; secretsByEnv: Record<string, number> }

/** Pestaña Local: cómo se lanza el proyecto en este Mac. */
export async function LocalEnvTab({ projectId, path, localUrl, composeProject, compose, envFiles, secretsByEnv }: Props) {
  // en producción no hay Docker ni carpetas del Mac: se ve lo que trajo el último escaneo, sin estado en vivo
  const remote = isRemote()
  const [containers, up] = remote ? [undefined, null] : await Promise.all([localContainers(composeProject), localUrlUp(localUrl)])
  const running = (service: string) => containers?.find((c) => c.service === service)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 text-base">
        {localUrl ? <>
          <a href={localUrl} target="_blank" rel="noreferrer" className="font-medium text-accent-strong hover:underline">{localUrl}</a>
          {up === true ? <Pill tone="ok">Respondiendo</Pill> : up === false ? <Pill>Parado</Pill> : null}
        </> : <span className="text-muted">Sin URL de desarrollo detectada (script dev de package.json o puertos del compose).</span>}
        {path && <span className="break-all text-sm text-muted">{path}</span>}
      </div>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Docker Compose</h3>
        {compose.length === 0 ? <p className="text-muted">Sin docker-compose en la carpeta.</p> : (
          <>
            {containers === null && <p className="mb-2 text-sm text-muted">Docker no responde en este Mac: no se puede ver qué está en marcha.</p>}
            {remote && <p className="mb-2 text-sm text-muted">Qué está en marcha solo se ve con Central abierto en el Mac.</p>}
            <Table head={['Servicio', 'Imagen', 'Puertos', 'Ahora']}>
              {compose.map((s) => {
                const c = running(s.name)
                return (
                  <tr key={s.name}>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-sm text-muted">{s.image ?? (s.build ? 'se construye desde la carpeta' : '—')}</td>
                    <td className="num text-sm">{s.ports.length ? s.ports.map((p) => <a key={p.host} href={`http://localhost:${p.host}`} target="_blank" rel="noreferrer" className="mr-2 text-accent-strong hover:underline">{p.host}→{p.container}</a>) : <span className="text-muted">sin publicar</span>}</td>
                    <td>{c ? <Pill tone={c.state === 'running' ? 'ok' : 'muted'}>{c.state === 'running' ? 'En marcha' : 'Parado'}</Pill> : containers ? <span className="text-sm text-muted">no creado</span> : '—'}</td>
                  </tr>
                )
              })}
            </Table>
          </>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Ficheros de variables</h3>
        <p className="mb-3 text-sm text-muted">Central solo ve sus nombres. «Importar» lo lee en ese momento y guarda cada variable cifrada en su entorno.</p>
        {envFiles.length === 0 ? <p className="text-muted">No hay ficheros de variables en la carpeta.</p> : (
          <ul className="flex flex-col gap-2">
            {envFiles.map((f) => (
              <li key={f.name} className="flex flex-wrap items-center gap-3">
                <FileKey2 className="size-5 text-muted" aria-hidden />
                <code className="font-medium">{f.name}</code>
                {f.environment ? <>
                  <Pill>{envLabel(f.environment)}</Pill>
                  {remote ? <span className="text-sm text-muted">desde aquí, súbelo en «Secretos» › Importar</span> : (
                    <ActionForm action={importLocalEnvFile} success={`${f.name} importado`}>
                      <input type="hidden" name="projectId" value={projectId} /><input type="hidden" name="name" value={f.name} /><input type="hidden" name="environment" value={f.environment} />
                      <SubmitButton variant="secondary" size="sm" pendingText="Importando…">Importar</SubmitButton>
                    </ActionForm>
                  )}
                  {secretsByEnv[f.environment] ? <span className="text-sm text-muted">{secretsByEnv[f.environment]} variables guardadas en {envLabel(f.environment).toLowerCase()}</span> : null}
                </> : <span className="text-sm text-muted">ejemplo o plantilla: no se importa</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
