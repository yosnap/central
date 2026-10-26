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
- **Escáner**: CLI que corre en el Mac (donde están las carpetas). Lee metadatos, nunca contenido sensible, y escribe en la BD (local o la de producción, según `DATABASE_URL`).
- **Uptime**: propio, sin dependencia de Screpy. Cada comprobación guarda un `UptimeCheck`; se conservan 30 días. Disparado por cron HTTP o `bun run uptime`.
- **MCP**: servidor stdio que usa el mismo cliente Prisma. Pensado para ejecutarse en el Mac apuntando a la BD.

## Despliegue (Easypanel / Hetzner)

1. Servicio PostgreSQL en Easypanel.
2. App desde este repo con el `Dockerfile` (salida `standalone`). Variables: `DATABASE_URL`, `CENTRAL_PASSWORD`, `CENTRAL_SESSION_SECRET`, `CRON_TOKEN`.
3. Tras desplegar: `bunx prisma migrate deploy` (o `db push` mientras no haya migraciones).
4. Cron cada 10 min: `curl -fsS "https://<dominio>/api/cron/uptime?token=$CRON_TOKEN"`.
5. El escáner sigue corriendo en el Mac con `DATABASE_URL` de producción (vía túnel o IP permitida).
