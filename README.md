# Central

CRM personal de Paulo (iServisat): clientes, proyectos, webs, presupuestos, agenda y correo, con servidor MCP propio.

## Fase 1 (esta versión)

- **Proyectos**: inventario automático de tus carpetas (versión, framework, stack, git, cambios sin commit). Agrupa worktrees, copias y backups bajo un único proyecto y lo clasifica como cliente, propio, formación o experimento; estado según actividad (activo ≤30 días, mantenimiento ≤6 meses, parado, archivo).
- **Webs**: de clientes, propias y centralizadas, con comprobador de uptime propio (sin límite de plan).
- **Clientes**, **notas** y **servidor MCP** (`list_projects`, `get_project`, `list_websites`, `list_clients`, `add_note`).
- Esquema ya preparado para **presupuestos con fases**, **tarifas**, **datos de marca/logo**, **cuentas de correo** y **mensajes guardados** (fases 2 y 3).

## Arranque local

```bash
cp .env.example .env          # y rellena las contraseñas
docker compose up -d          # Postgres en localhost:5433
bun install
bunx prisma db push            # crea las tablas
bun run scan                  # importa /ruta/a/tus/proyectos (SCAN_ROOTS)
bun run dev                   # http://localhost:3099
```

## Añadir más carpetas

```bash
bun run scan "/ruta/a/otra/carpeta"          # la importa y la recuerda
bun run scan "/ruta" --csv inventario/revision.csv   # solo genera el inventario para revisarlo
```

Volver a escanear actualiza versión, git y estado. Lo que edites a mano (tipo, cliente, fase, descripción) se respeta, y el estado también si marcas "Fijar estado".

## Webs

Fichero de texto, una por línea: `dominio ; cliente|propia|central ; Cliente ; Etiqueta`

```bash
bun run websites:import inventario/webs.txt
bun run uptime                                  # comprobación manual
bun run tareas:instalar                         # tareas del Mac: escaneo cada hora y uptime cada 10 min
bun run tareas:quitar | tareas:estado
```

En producción, programa `GET /api/cron/uptime?token=$CRON_TOKEN` cada 5–15 minutos (cron de Easypanel o n8n).

## MCP

```json
"central": {
  "command": "bun",
  "args": ["/ruta/a/Central/src/mcp/server.ts"],
  "env": { "DATABASE_URL": "postgresql://central:central@localhost:5433/central" }
}
```

## Despliegue

`Dockerfile` listo para Easypanel en Hetzner (Next.js standalone). Define `DATABASE_URL`, `CENTRAL_PASSWORD`, `CENTRAL_SESSION_SECRET` y `CRON_TOKEN`.
