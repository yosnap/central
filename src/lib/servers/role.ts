/** Qué es un servicio Docker, deducido de su imagen (o, sin ella, de su nombre). */

export const ROLE_LABEL: Record<string, string> = {
  app: 'Aplicación', database: 'Base de datos', cache: 'Caché', proxy: 'Proxy', queue: 'Cola', automation: 'Automatización',
  storage: 'Almacenamiento', monitoring: 'Vigilancia', panel: 'Panel', other: 'Otro',
}

const RULES: [string, RegExp][] = [
  ['database', /postgres|postgis|mysql|mariadb|mongo|clickhouse|cockroach|timescale|supabase\/postgres|pgvector|couchdb|neo4j|qdrant|weaviate|meilisearch|elasticsearch|opensearch|typesense/],
  ['cache', /redis|valkey|memcached|dragonfly|keydb/],
  ['queue', /rabbitmq|kafka|nats|redpanda|mosquitto|emqx/],
  ['proxy', /traefik|nginx-proxy|caddy|haproxy|envoy/],
  ['automation', /n8n|activepieces|windmill|node-red|huginn/],
  ['storage', /minio|seaweedfs|garage|filebrowser|nextcloud/],
  ['monitoring', /uptime-kuma|grafana|prometheus|loki|netdata|glances|beszel|dozzle/],
  ['panel', /easypanel|dokploy|coolify|portainer|caprover/],
]

export function roleOf(image: string | null | undefined, name: string): string {
  const text = `${image ?? ''} ${name}`.toLowerCase()
  for (const [role, re] of RULES) if (re.test(text)) return role
  // por el nombre: «proyecto_db», «proyecto-redis-1»…
  if (/(^|[_.-])(db|database|pg)([_.-]|\d|$)/.test(name.toLowerCase())) return 'database'
  return image || /[_-](web|app|api|front|backend)/.test(name.toLowerCase()) ? 'app' : 'other'
}
