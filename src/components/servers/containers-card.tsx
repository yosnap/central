import { Card, Pill, type Option } from '@/components/ui'
import { ContainersTable, type ContainerRow } from './containers-table'

/** Servicios Docker o Swarm del servidor y a qué proyecto pertenecen. */
export function ContainersCard({ containers, options }: { containers: ContainerRow[]; options: Option[] }) {
  const count = (st: string) => containers.filter((c) => c.state === st).length
  const unlinked = containers.filter((c) => !c.projectServiceId && !c.infra).length
  const infra = containers.filter((c) => c.infra).length
  return (
    <Card
      title="Servicios Docker"
      note="Central reconoce el proyecto por el dominio y el nombre, y el panel con su base de datos, su caché y su proxy como infraestructura del servidor. Si no lo encuentra o se equivoca, pulsa el lápiz y busca el proyecto: si aún no tiene ese servicio, se crea con su dominio."
      action={containers.length > 0 && <div className="flex flex-wrap gap-2">
        {count('down') > 0 && <Pill tone="bad">{count('down')} caídos</Pill>}{count('stopped') > 0 && <Pill tone="warn">{count('stopped')} parados</Pill>}
        <Pill tone="ok">{count('ok')} en marcha</Pill>{infra > 0 && <Pill>{infra} del servidor</Pill>}{unlinked > 0 && <Pill>{unlinked} sin proyecto</Pill>}
      </div>}
    >
      {containers.length === 0 ? <p className="text-muted">Sin datos: hace falta la lectura de root para ver Docker.</p> : <ContainersTable containers={containers} options={options} />}
    </Card>
  )
}
