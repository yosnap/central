# Arquitectura

```
                ┌─────────────────────────────── Central (Next.js 16) ───────────────────────────────┐
 Navegador ───▶ │ proxy.ts → páginas (Server Components) → Server Actions (Zod) → Prisma → PostgreSQL │
                └────────────────────────────────────────────────────────────────────────────────────┘
                         ▲                         ▲                          ▲
       scripts/scan.ts ──┘   /api/cron/uptime ─────┘        src/mcp/server.ts ┘  (stdio)
   (carpetas del Mac)       (cron Easypanel / n8n)        (Claude Desktop, Claude Code, otras apps)
```

## Piezas

- **Runtime**: Bun en local y en producción (`oven/bun`), también para el escáner, los scripts y el MCP.
- **Web**: Next.js App Router. Las páginas consultan Prisma directamente en el servidor. Las escrituras son Server Actions con `requireSession()` y Zod.
- **Sesión**: monousuario. `CENTRAL_PASSWORD` en el entorno; al entrar se crea una cookie `central_session` firmada con HMAC-SHA256 (`CENTRAL_SESSION_SECRET`), 30 días. `proxy.ts` redirige sin cookie; cada página valida la firma.
- **Escáner**: corre en el Mac (donde están las carpetas). Lee metadatos, nunca contenido sensible. Con Central en el Mac escribe directamente en la BD; con Central en producción lo hace el trabajador del Mac y sube el resultado.
- **Uptime**: propio, sin dependencia de Screpy. Cada comprobación guarda un `UptimeCheck`; se conservan 30 días. Disparado por cron HTTP o `bun run uptime`.
- **MCP**: servidor stdio que usa el mismo cliente Prisma. Pensado para ejecutarse en el Mac apuntando a la BD.

## Despliegue (Dokploy · Sn4p.dev, central.sn4p.dev)

- **Código**: repositorio privado `yosnap/central`; Dokploy despliega el compose `docker-compose.prod.yml` en cada push a `main`.
- **Servicios**: `web` (Next, puerto 3000, dominio), `tareas` (`scripts/tareas-servidor.ts`: servidores cada minuto, uptime y Uptime Kuma cada 10 minutos), `db` (PostgreSQL) y `kuma` (Uptime Kuma); solo `web` se publica. Una sola imagen (`Dockerfile`, Bun) con `openssh-client`.
- **Esquema**: migraciones de Prisma (`prisma/migrations`, línea base `0_init`); `web` aplica `prisma migrate deploy` al arrancar. Para cambios nuevos: `bunx prisma migrate dev --name <cambio>`.
- **Variables**: `bun run produccion:variables` las prepara en el Mac y las copia al portapapeles para pegarlas en Dokploy (Entorno), sin mostrarlas. Usa la misma `CENTRAL_ENCRYPTION_KEY` que el Mac, para que los secretos de la BD sigan valiendo. La clave SSH de solo lectura de infobar y las huellas de los servidores van en base64 (`CENTRAL_SSH_KEY_B64`, `CENTRAL_SSH_KNOWN_HOSTS_B64`); `scripts/docker-entrypoint.sh` las escribe al arrancar; las huellas confirmadas después viven en la BD.
- **Datos**: `bun run produccion:subir` lleva a producción lo trabajado en el Mac (clientes, proyectos con sus carpetas, remotos, servicios, secretos cifrados y avisos, webs, servidores con su huella, enlaces de contenedores y carpetas de escaneo) por `POST /api/importar` con `CENTRAL_API_TOKEN` (`src/lib/data-sync.ts`). Busca cada fila por id y, si no, por su clave natural, y reasigna las referencias; nunca borra y no toca presupuestos, tarifas, marca, correo, agenda ni históricos. `-- --prueba` solo cuenta lo que subiría.
- **Modo producción** (`CENTRAL_RUNTIME=production`): lo que solo puede hacer el Mac (asistente con Claude Code, escaneo, `git fetch`) va por la cola `WorkerJob`.

## Trabajador del Mac

Proceso en launchd (`bun run trabajador:instalar`) que solo sale del Mac hacia Central (`/api/worker/*` con `CENTRAL_WORKER_TOKEN`): cada 5 s avisa de que está vivo, recoge trabajos y devuelve el resultado. Nada entra en el Mac. Solo acepta tipos fijos (`assistant`, `scan`, `audit`, `server-install`, `container-env`, `worktree`), valida cada dato con Zod y nunca ejecuta opciones que vengan de Central: el comando de Claude Code se fija en `src/lib/claude-cli.ts` (solo Read, sin MCP, modo restringido) y las carpetas que escanea las decide el Mac (`CENTRAL_WORKER_ROOTS`). Configuración en `~/Library/Application Support/Central/trabajador.env`. Con el Mac apagado, los trabajos esperan en cola y la ficha lo indica.
