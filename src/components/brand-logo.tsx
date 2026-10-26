import { brandOf } from '@/lib/brands'
import { cn } from '@/components/ui'

/** Los colores muy oscuros se pintan con el color del texto para que se vean en modo oscuro. */
function isDark(hex: string) {
  const n = parseInt(hex, 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 60
}

/** Logo de un proveedor o panel; sin logo conocido, sus iniciales. */
export function BrandLogo({ name, className }: { name: string | null | undefined; className?: string }) {
  const brand = brandOf(name)
  if (!brand) return null
  if (brand.icon) {
    const dark = isDark(brand.icon.hex)
    return (
      <svg viewBox="0 0 24 24" role="img" aria-label={brand.label} className={cn('size-5 shrink-0', dark && 'text-ink', className)} fill={dark ? 'currentColor' : `#${brand.icon.hex}`}>
        <path d={brand.icon.path} />
      </svg>
    )
  }
  const initials = brand.label.split(/[\s.-]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return <span role="img" aria-label={brand.label} className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[0.6rem] font-bold text-accent-strong', className)}>{initials}</span>
}

/** Logo con su nombre al lado. */
export function Brand({ name, className }: { name: string | null | undefined; className?: string }) {
  const brand = brandOf(name)
  if (!brand) return null
  return <span className={cn('inline-flex items-center gap-2', className)}><BrandLogo name={name} />{brand.label}</span>
}
