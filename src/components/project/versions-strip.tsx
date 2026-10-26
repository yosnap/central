import { cn } from '@/components/ui'
import { compareVersions } from '@/lib/version'

type Props = {
  local: { version: string | null; branch: string | null }
  code: { version: string | null; branch: string | null }
  staging: string | null
  production: string | null
}

/**
 * Las versiones del proyecto una al lado de otra: la carpeta local, la rama de integración (develop o main), pruebas y
 * producción. Lo que va por detrás de la rama de integración se marca, para ver de un vistazo qué falta por actualizar.
 */
export function VersionsStrip({ local, code, staging, production }: Props) {
  const behind = (v: string | null) => (v && code.version ? (compareVersions(v, code.version) ?? 0) < 0 : false)
  const ahead = (v: string | null) => (v && code.version ? (compareVersions(v, code.version) ?? 0) > 0 : false)
  const tiles = [
    { label: 'Local', version: local.version, sub: local.branch ? `carpeta en ${local.branch}` : 'carpeta del Mac', note: behind(local.version) ? `por detrás de ${code.branch ?? 'la rama de integración'}` : null },
    { label: code.branch ?? 'Código', version: code.version, sub: 'rama de integración', note: null },
    ...(staging ? [{ label: 'Pruebas', version: staging, sub: 'servicio de pruebas', note: behind(staging) ? 'pendiente de desplegar' : null }] : []),
    { label: 'Producción', version: production, sub: production ? 'leída de la web o del contenedor' : 'sin leer: la web no publica su versión', note: behind(production) ? 'pendiente de desplegar' : ahead(production) ? 'va por delante del código' : null },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className={cn('rounded-2xl border p-4', t.note ? 'border-warn/40 bg-warn-soft' : 'border-line bg-panel')}>
          <div className="text-sm font-medium text-muted">{t.label}</div>
          <div className={cn('num mt-1 text-2xl font-semibold', !t.version && 'text-muted')}>{t.version ? `v${t.version.replace(/^v/, '')}` : '—'}</div>
          <div className="mt-1 truncate text-sm text-muted">{t.sub}</div>
          {t.note && <div className="mt-1 text-sm font-medium text-warn">{t.note}</div>}
        </div>
      ))}
    </div>
  )
}
