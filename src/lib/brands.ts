/**
 * Proveedores de servidores y paneles conocidos, con su logo (simple-icons, CC0). Cualquier otro nombre vale:
 * se guarda tal cual y se muestra con sus iniciales.
 */
import {
  siAkamai, siCaprover, siCloudflare, siCloudflarepages, siFirebase, siFlydotio, siGithubpages, siNetlify, siRailway, siRender, siSupabase, siVercel, siContabo, siCoolify, siCpanel, siDigitalocean, siDocker, siGodaddy, siGooglecloud,
  siHetzner, siHostinger, siIonos, siNamecheap, siOvh, siPlesk, siPortainer, siScaleway, siVultr,
} from 'simple-icons'

export type Brand = { key: string; label: string; icon?: { path: string; hex: string } }
const b = (key: string, label: string, icon?: { path: string; hex: string }): Brand => ({ key, label, icon: icon && { path: icon.path, hex: icon.hex } })

export const PROVIDERS: Brand[] = [
  b('hetzner', 'Hetzner', siHetzner), b('contabo', 'Contabo', siContabo), b('ovh', 'OVHcloud', siOvh),
  b('digitalocean', 'DigitalOcean', siDigitalocean), b('scaleway', 'Scaleway', siScaleway), b('hostinger', 'Hostinger', siHostinger),
  b('ionos', 'IONOS', siIonos), b('vultr', 'Vultr', siVultr), b('akamai', 'Akamai (Linode)', siAkamai),
  b('googlecloud', 'Google Cloud', siGooglecloud), b('cloudflare', 'Cloudflare', siCloudflare), b('godaddy', 'GoDaddy', siGodaddy),
  b('namecheap', 'Namecheap', siNamecheap),
]

export const PANELS: Brand[] = [
  b('easypanel', 'Easypanel'), b('dokploy', 'Dokploy'), b('coolify', 'Coolify', siCoolify), b('cpanel', 'cPanel', siCpanel),
  b('plesk', 'Plesk', siPlesk), b('caprover', 'CapRover', siCaprover), b('portainer', 'Portainer', siPortainer), b('docker', 'Docker', siDocker),
]

/** Plataformas donde se publica sin servidor propio. */
export const PLATFORMS: Brand[] = [
  b('vercel', 'Vercel', siVercel), b('netlify', 'Netlify', siNetlify), b('cloudflarepages', 'Cloudflare Pages', siCloudflarepages),
  b('hostinger', 'Hostinger', siHostinger), b('railway', 'Railway', siRailway), b('render', 'Render', siRender), b('flydotio', 'Fly.io', siFlydotio),
  b('githubpages', 'GitHub Pages', siGithubpages), b('supabase', 'Supabase', siSupabase), b('firebase', 'Firebase', siFirebase),
  b('googlecloud', 'Google Cloud', siGooglecloud), b('hostingcliente', 'Hosting del cliente'),
]

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '')
const ALIASES: Record<string, string> = { flyio: 'flydotio', ovhcloud: 'ovh', linode: 'akamai', akamailinode: 'akamai', gcp: 'googlecloud', do: 'digitalocean' }

/** Marca conocida para un nombre guardado (clave o etiqueta, sin importar mayúsculas), o una sin logo. */
export function brandOf(name: string | null | undefined): Brand | null {
  if (!name?.trim()) return null
  const n = norm(name)
  const key = ALIASES[n] ?? n
  return [...PROVIDERS, ...PANELS, ...PLATFORMS].find((x) => x.key === key || norm(x.label) === n) ?? { key: n, label: name.trim() }
}

export const brandOptions = (list: Brand[]) => list.map((x) => ({ value: x.key, label: x.label }))
