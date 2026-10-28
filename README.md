# Central

Central es el CRM personal de Paulo (iServisat): un único sitio para todo lo que hoy está repartido entre carpetas,
servidores, paneles y correo. Reúne los proyectos de código, los clientes, las webs y los servidores donde se
despliegan, los presupuestos, la agenda y las notas, y lo expone por MCP para que Claude y otras apps lo consulten.

Es monousuario y no es un SaaS.

## Qué hace

- **Proyectos**: inventario automático de las carpetas del Mac (versión, framework, stack, git, worktrees, copias),
  qué es cada proyecto, su estado frente a origin (GitHub, GitLab, Gitea), sus entornos (local, pruebas, producción)
  con sus servicios y dominios, despliegues detectados y versión publicada.
- **Secretos**: variables de cada entorno cifradas, con copias versionadas, también leídas del entorno desplegado.
- **Seguridad**: auditoría diaria de dependencias (osv-scanner y endoflife.date) con avisos y exportación como issue.
- **Webs**: de clientes, propias y servicios centralizados, vigiladas con Uptime Kuma y un comprobador propio.
- **Servidores**: estado y protección de cada VPS por SSH de solo lectura (modelo infobar), servicios Docker
  enlazados con los proyectos y puertos medidos desde fuera.
- **Clientes, presupuestos y agenda**: presupuestos por fases con PDF y Word y un asistente con Claude Code,
  Google Calendar y Gmail en solo lectura ligados a clientes y proyectos.
- **Alertas y pendientes**: un único sitio que decide qué necesita atención.
- **MCP**: servidor stdio para consultar y anotar Central desde Claude Desktop, Claude Code y otras apps.

## Cómo funciona

- **Producción**: Central corre en Dokploy, en el servidor Sn4p.dev, en `central.sn4p.dev` (web, tareas
  programadas, PostgreSQL y Uptime Kuma en un mismo compose).
- **Trabajador del Mac**: lo que solo puede hacer el Mac (escanear carpetas, `git fetch`, el asistente con Claude
  Code, leer servidores con la clave de administración) se pide por una cola; el Mac solo hace conexiones de salida.
- **En local**: el mismo Central puede correr en el Mac, con acceso directo a las carpetas.

Detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

## Stack

Bun, Next.js 16 (App Router, Server Components, Server Actions), TypeScript estricto, Zod, Prisma 7 con
PostgreSQL, Tailwind CSS 4 y el SDK de MCP. Docker en local y en producción.

## Arranque local

```bash
cp .env.example .env          # y rellena los valores
docker compose up -d          # PostgreSQL, SeaweedFS y Uptime Kuma
bun install                   # genera el cliente de Prisma
bunx prisma migrate deploy    # crea las tablas
bun run scan                  # importa las carpetas de SCAN_ROOTS
bun run dev                   # http://localhost:3099
```

Los demás comandos (servidores, uptime, auditoría, copias de secretos, tareas de launchd, trabajador del Mac,
variables y datos de producción) están en [CLAUDE.md](CLAUDE.md).

## MCP

```json
"central": {
  "command": "bun",
  "args": ["/ruta/a/Central/src/mcp/server.ts"],
  "env": { "DATABASE_URL": "postgresql://usuario:contraseña@localhost:5433/central" }
}
```

Herramientas y uso en [docs/MCP.md](docs/MCP.md).

## Documentación

- [Visión](docs/VISION.md) y [hoja de ruta](docs/ROADMAP.md)
- [Arquitectura](docs/ARQUITECTURA.md), [modelo de datos](docs/MODELO-DATOS.md) y [decisiones](docs/DECISIONES.md)
- [Escáner](docs/ESCANER.md), [servidores y uptime](docs/SERVIDORES.md) e [integraciones](docs/INTEGRACIONES.md)
- [Interfaz](docs/UI.md) y [MCP](docs/MCP.md)
- Cambios por versión en [CHANGELOG.md](CHANGELOG.md)
