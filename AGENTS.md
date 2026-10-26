# AGENTS.md — Central

Guía para agentes de código (Orca, Claude Code, Codex, etc.) que trabajen en este repo. Las normas completas están en `CLAUDE.md`; esto es lo mínimo para empezar sin romper nada.

## Antes de tocar código

1. Lee `CLAUDE.md`, `docs/VISION.md`, `docs/ARQUITECTURA.md` y `docs/ROADMAP.md`.
2. Si la tarea es de una fase del roadmap, crea o actualiza `plans/<fecha>-<tema>.md` con el alcance y los pasos.
3. Trabaja en una rama o worktree propio: `feat/<tema>`.

## Runtime

Bun (runtime y gestor de paquetes). Usa `bun install`, `bun run`, `bunx`. No generes `package-lock.json` ni uses npm/pnpm/yarn.

## Comprobaciones obligatorias antes de terminar

```bash
bun run typecheck
bun run build
```

Si cambias `prisma/schema.prisma`: `bunx prisma db push` en local y documenta el cambio en `docs/MODELO-DATOS.md`.

## Reparto sugerido por áreas

| Área | Ficheros | Notas |
|---|---|---|
| Datos | `prisma/schema.prisma`, `docs/MODELO-DATOS.md` | Un cambio de modelo, un plan |
| Escáner | `src/lib/scanner.ts`, `scripts/scan.ts`, `docs/ESCANER.md` | Probar con `--csv` antes de importar |
| Webs y uptime | `src/lib/uptime.ts`, `src/app/webs`, `src/app/api/cron` | |
| Presupuestos | `src/app/presupuestos`, modelos `Quote*`, `Rate`, `BrandSettings` | Fase 2 |
| Correo y agenda | modelos `MailAccount`, `SavedMessage` | Fase 3, credenciales cifradas |
| MCP | `src/mcp/server.ts`, `docs/MCP.md` | Toda herramienta nueva, documentada |
| UI | `src/components/ui.tsx`, `src/app/globals.css` | Reutilizar componentes y tokens |

## No hacer

- No leer ni copiar `.env`, carpetas de claves ni secretos de otros proyectos al escanear.
- No sobrescribir campos editados a mano desde el escáner.
- No añadir multi-tenant, Stripe ni registro de usuarios: Central es monousuario.
- No commitear `inventario/*.csv` (contienen rutas y datos de clientes).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
