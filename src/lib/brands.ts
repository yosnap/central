/**
 * Proveedores de servidores y paneles conocidos, con su logo (simple-icons, CC0). Cualquier otro nombre vale:
 * se guarda tal cual y se muestra con sus iniciales.
 */
import {
  siAkamai, siCaprover, siCloudflare, siCloudflarepages, siFirebase, siFlydotio, siGithubpages, siNetlify, siRailway, siRender, siSupabase, siVercel, siContabo, siCoolify, siCpanel, siDigitalocean, siDocker, siGodaddy, siGooglecloud,
  siHetzner, siHostinger, siIonos, siNamecheap, siOvh, siPlesk, siPortainer, siScaleway, siVultr,
  siPostgresql, siMysql, siMariadb, siMongodb, siRedis, siMinio, siN8n, siNginx, siWordpress, siTraefikproxy, siRabbitmq, siElasticsearch,
  siNuxt, siAstro, siSvelte, siRemix, siReact, siVuedotjs, siAngular, siLaravel, siDjango, siExpress, siNestjs, siHono, siFastapi, siFlask, siVite, siGatsby,
  siSymfony, siRubyonrails, siGo, siDeno, siPayloadcms, siMedusa, siFastify, siSolid, siQwik, siExpo, siFlutter,
  siClickhouse, siSqlite, siMeilisearch, siUmami, siPlausibleanalytics, siGhost, siStrapi, siDirectus, siApache, siNodedotjs, siNextdotjs, siPhp, siPython, siBun,
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

/** Tecnologías que corren en un contenedor (bases de datos, almacenamiento, automatización…), por orden de prioridad. */
const TECH: { re: RegExp; brand: Brand }[] = [
  { re: /postgres|postgis|pgvector|timescale/, brand: b('postgresql', 'PostgreSQL', siPostgresql) },
  { re: /mariadb/, brand: b('mariadb', 'MariaDB', siMariadb) },
  { re: /mysql/, brand: b('mysql', 'MySQL', siMysql) },
  { re: /mongo/, brand: b('mongodb', 'MongoDB', siMongodb) },
  { re: /redis|valkey|keydb|dragonfly/, brand: b('redis', 'Redis', siRedis) },
  { re: /clickhouse/, brand: b('clickhouse', 'ClickHouse', siClickhouse) },
  { re: /sqlite|libsql/, brand: b('sqlite', 'SQLite', siSqlite) },
  { re: /minio/, brand: b('minio', 'MinIO', siMinio) },
  { re: /seaweedfs/, brand: b('seaweedfs', 'SeaweedFS') },
  { re: /rabbitmq/, brand: b('rabbitmq', 'RabbitMQ', siRabbitmq) },
  { re: /elasticsearch|opensearch/, brand: b('elasticsearch', 'Elasticsearch', siElasticsearch) },
  { re: /meilisearch/, brand: b('meilisearch', 'Meilisearch', siMeilisearch) },
  { re: /n8n/, brand: b('n8n', 'n8n', siN8n) },
  { re: /wordpress|woocommerce/, brand: b('wordpress', 'WordPress', siWordpress) },
  { re: /ghost/, brand: b('ghost', 'Ghost', siGhost) },
  { re: /strapi/, brand: b('strapi', 'Strapi', siStrapi) },
  { re: /directus/, brand: b('directus', 'Directus', siDirectus) },
  { re: /umami/, brand: b('umami', 'Umami', siUmami) },
  { re: /plausible/, brand: b('plausible', 'Plausible', siPlausibleanalytics) },
  { re: /traefik/, brand: b('traefik', 'Traefik', siTraefikproxy) },
  { re: /nginx/, brand: b('nginx', 'Nginx', siNginx) },
  { re: /httpd|apache/, brand: b('apache', 'Apache', siApache) },
  { re: /next/, brand: b('nextjs', 'Next.js', siNextdotjs) },
  { re: /\bbun\b|oven\/bun/, brand: b('bun', 'Bun', siBun) },
  { re: /\bnode\b/, brand: b('nodejs', 'Node.js', siNodedotjs) },
  { re: /php/, brand: b('php', 'PHP', siPhp) },
  { re: /python/, brand: b('python', 'Python', siPython) },
]

/** Tecnología de un contenedor por su imagen (y, si no se reconoce, por su nombre): «postgres:17» → PostgreSQL. */
export function techOf(image: string | null | undefined, name?: string | null): Brand | null {
  for (const text of [image, name]) {
    const t = (text ?? '').toLowerCase().replace(/@sha256:.*$/, '')
    if (!t) continue
    const hit = TECH.find((x) => x.re.test(t))
    if (hit) return hit.brand
  }
  return null
}

/** Frameworks y lenguajes de una aplicación, por su nombre («Next.js 16.4.2», «Laravel 11»…). Los más concretos primero. */
const FRAMEWORKS: { re: RegExp; brand: Brand }[] = [
  { re: /^next/, brand: b('nextjs', 'Next.js', siNextdotjs) },
  { re: /^nuxt/, brand: b('nuxt', 'Nuxt', siNuxt) },
  { re: /^astro/, brand: b('astro', 'Astro', siAstro) },
  { re: /^(svelte|sveltekit)/, brand: b('svelte', 'Svelte', siSvelte) },
  { re: /^remix/, brand: b('remix', 'Remix', siRemix) },
  { re: /^gatsby/, brand: b('gatsby', 'Gatsby', siGatsby) },
  { re: /^(solid|solidstart)/, brand: b('solid', 'Solid', siSolid) },
  { re: /^qwik/, brand: b('qwik', 'Qwik', siQwik) },
  { re: /^angular/, brand: b('angular', 'Angular', siAngular) },
  { re: /^vue/, brand: b('vue', 'Vue', siVuedotjs) },
  { re: /^expo/, brand: b('expo', 'Expo', siExpo) },
  { re: /^(react|react native)/, brand: b('react', 'React', siReact) },
  { re: /^vite/, brand: b('vite', 'Vite', siVite) },
  { re: /^payload/, brand: b('payload', 'Payload', siPayloadcms) },
  { re: /^medusa/, brand: b('medusa', 'Medusa', siMedusa) },
  { re: /^strapi/, brand: b('strapi', 'Strapi', siStrapi) },
  { re: /^directus/, brand: b('directus', 'Directus', siDirectus) },
  { re: /^nestjs|^nest\b/, brand: b('nestjs', 'NestJS', siNestjs) },
  { re: /^express/, brand: b('express', 'Express', siExpress) },
  { re: /^fastify/, brand: b('fastify', 'Fastify', siFastify) },
  { re: /^hono/, brand: b('hono', 'Hono', siHono) },
  { re: /^laravel/, brand: b('laravel', 'Laravel', siLaravel) },
  { re: /^symfony/, brand: b('symfony', 'Symfony', siSymfony) },
  { re: /^(wordpress|woocommerce)/, brand: b('wordpress', 'WordPress', siWordpress) },
  { re: /^django/, brand: b('django', 'Django', siDjango) },
  { re: /^fastapi/, brand: b('fastapi', 'FastAPI', siFastapi) },
  { re: /^flask/, brand: b('flask', 'Flask', siFlask) },
  { re: /^(rails|ruby on rails)/, brand: b('rails', 'Rails', siRubyonrails) },
  { re: /^flutter/, brand: b('flutter', 'Flutter', siFlutter) },
  { re: /^deno/, brand: b('deno', 'Deno', siDeno) },
  { re: /^bun/, brand: b('bun', 'Bun', siBun) },
  { re: /^(node|node\.js)/, brand: b('nodejs', 'Node.js', siNodedotjs) },
  { re: /^go\b/, brand: b('go', 'Go', siGo) },
  { re: /^php/, brand: b('php', 'PHP', siPhp) },
  { re: /^python/, brand: b('python', 'Python', siPython) },
]

/** Framework del proyecto por el texto que guarda el escáner (o el primero de su stack que se reconozca). */
export function frameworkOf(...names: (string | null | undefined)[]): Brand | null {
  for (const n of names) {
    const t = (n ?? '').toLowerCase().trim()
    const hit = t && FRAMEWORKS.find((x) => x.re.test(t))
    if (hit) return hit.brand
  }
  return null
}
