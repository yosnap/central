import { prisma } from '@/lib/prisma'
import { revokeApiKey } from '@/lib/api-key-actions'
import { isApiScope, type ApiScope } from '@/lib/api/scopes'
import { fmtDateTime } from '@/lib/format'
import { Card, ConfirmAction, Empty, Pill, Table } from '@/components/ui'
import { ApiKeyCreateForm } from './api-key-create-form'

const SCOPE_SHORT: Record<ApiScope, string> = { lectura: 'Lectura', presupuestos: 'Presupuestos', escritura: 'Escritura' }

/** Apps conectadas: claves de la API v1 (/api/v1) con sus permisos, último uso y revocación. */
export async function ApiKeysCard() {
  const keys = await prisma.apiKey.findMany({ orderBy: [{ revokedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'desc' }], select: { id: true, name: true, prefix: true, scopes: true, createdAt: true, lastUsedAt: true, revokedAt: true } })
  return (
    <Card title="Apps conectadas" note="Claves para que otras apps (AgoraOne…) lean Central por su API (/api/v1) y, con el permiso de escritura, creen y cambien clientes, proyectos, notas y fases de presupuestos (nunca borran). La clave completa solo se ve al crearla; aquí queda su principio para reconocerla. Revocarla la invalida al momento.">
      <ApiKeyCreateForm />
      {keys.length === 0 ? <Empty title="Sin apps conectadas">Crea una clave con el formulario de arriba y pégala en la app que se va a conectar.</Empty> : (
        <Table head={['App', 'Clave', 'Permisos', 'Creada', 'Último uso', '']}>
          {keys.map((k) => (
            <tr key={k.id} className={k.revokedAt ? 'opacity-60' : ''}>
              <td className="font-semibold">{k.name}</td>
              <td className="font-mono text-sm">{k.prefix}…</td>
              <td><span className="flex flex-wrap gap-2">{k.scopes.filter(isApiScope).map((s) => <Pill key={s} tone="accent">{SCOPE_SHORT[s]}</Pill>)}</span></td>
              <td className="whitespace-nowrap text-muted">{fmtDateTime(k.createdAt)}</td>
              <td className="whitespace-nowrap text-muted">{k.lastUsedAt ? fmtDateTime(k.lastUsedAt) : 'Nunca'}</td>
              <td className="text-right">
                {k.revokedAt ? <Pill tone="bad">Revocada · {fmtDateTime(k.revokedAt)}</Pill> : (
                  <ConfirmAction action={revokeApiKey} fields={{ id: k.id }} title={`Revocar la clave de «${k.name}»`} description="La app dejará de poder leer Central al momento. No se puede deshacer: si la necesitas otra vez, crea una clave nueva." confirmLabel="Revocar clave" success="Clave revocada">Revocar</ConfirmAction>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
