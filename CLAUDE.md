# CLAUDE.md — Central

## Qué es

Central es el CRM personal de Paulo (iServisat): un único sitio para clientes, proyectos de código, webs (de clientes, propias y centralizadas), presupuestos con fases, agenda, correo y notas. Expone un servidor MCP para que Claude y otras apps lean y escriban en él.

Monousuario. No es un SaaS (para eso existe CRMDev; no mezclar).

## Instrucciones de interacción

- Háblame siempre en español.
- No usar emoticonos en la interfaz; iconos SVG o librería si hacen falta.
- Antes de un cambio grande, plan corto en `plans/` y luego código.
- Mantén `docs/` al día cuando cambie el modelo de datos, un flujo o una decisión.

## Stack

- **Bun** como runtime y gestor de paquetes: `bun install`, `bun run <script>`, `bunx` en lugar de `npx`, scripts `.ts` con `bun` directamente (sin tsx). Lockfile `bun.lock`; no usar npm, pnpm ni yarn.
- Next.js 16 (App Router, Server Components, Server Actions, `src/proxy.ts`)
- TypeScript estricto · Zod 4 para validar entradas
- Prisma 7 + PostgreSQL, generador `prisma-client` con salida en `src/generated/prisma` y adaptador `@prisma/adapter-pg`
- Tailwind CSS 4 (tokens en `src/app/globals.css`, `@theme`)
- `@modelcontextprotocol/sdk` para el servidor MCP (stdio)
- Docker; producción en Dokploy (Sn4p.dev, central.sn4p.dev) con el trabajador del Mac para lo que necesita el Mac

## Comandos

```bash
docker compose up -d     # Postgres :5433, SeaweedFS :8334, Uptime Kuma :3098
bun install              # ejecuta prisma generate (postinstall)
bunx prisma migrate dev --name <cambio>   # cambios de esquema (migraciones; producción aplica migrate deploy al arrancar)
bun run dev
bun run typecheck
bun run build
bun run scan [-- <carpeta>] [--csv salida.csv] [--map /local=/real]
bun run websites:import inventario/webs.txt
bun run uptime
bun run servidores        # lee los servidores a los que les toca (-- --todos: todos ya)
bun run tareas:instalar   # launchd: escaneo cada hora, uptime cada 10 min, servidores cada minuto (también tareas:quitar, tareas:estado)
bun run mcp
bun run produccion:variables   # variables de producción al portapapeles para Dokploy (sin mostrarlas)
bun run trabajador:instalar    # trabajador del Mac en launchd (con Central en producción; también :quitar y :estado)
```

## Estructura

```
prisma/schema.prisma        modelo de datos completo (fases 1–3)
scripts/scan.ts             CLI del escáner de carpetas → BD o CSV (importación en src/lib/scan-import.ts)
scripts/tareas-mac.sh       tareas programadas del Mac (launchd)
scripts/uptime.ts           comprobación manual de webs
scripts/servidores.ts       lectura de servidores por SSH y registro que usa remote/alta-servidor.sh
remote/                     scripts que se instalan en los servidores (infobar), copiados de CostGuard
src/lib/servers/            lectura SSH, parseo, estados y protección, puertos desde fuera, emparejado con proyectos
scripts/import-websites.ts  alta masiva de webs desde un .txt
src/lib/scanner.ts          lógica del escáner (sin dependencias de Next)
src/lib/uptime.ts           comprobador de uptime
src/lib/completeness.ts     reglas de información pendiente (un único sitio)
src/lib/quotes.ts           cálculos de presupuestos (céntimos, totales y rangos, hitos, numeración); contenido común en quote-doc.ts, PDF en quote-pdf.tsx, Word en quote-docx.ts
src/lib/google.ts           Google con OAuth propio: Gmail (solo lectura) y Calendar; agenda en agenda.ts, ligar a cliente/proyecto en link-targets.ts
src/lib/quote-ai.ts         asistente de presupuestos con Claude Code del Mac (claude -p, solo Read en storage/quotes/<id>)
src/lib/project-actions.ts  Server Actions de la ficha de proyecto
src/lib/settings-actions.ts Server Actions de Ajustes
src/lib/crypto.ts           cifrado AES-256-GCM de secretos (CENTRAL_ENCRYPTION_KEY)
src/lib/videos.ts           sincronización de canales YouTube/Bunny
src/lib/sn4p.ts             cliente de la API del portfolio sn4p.dev
src/lib/prisma.ts           cliente Prisma (singleton)
src/lib/auth.ts, session.ts sesión monousuario con cookie firmada (HMAC)
src/proxy.ts                redirige a /login sin cookie
src/app/                    páginas: / (resumen), pendientes, proyectos, webs, servidores, clientes, presupuestos, agenda, correo, ajustes, login
src/app/api/cron/uptime     endpoint para el cron de uptime (token)
src/app/api/servidores      lista y estado de servidores para CostGuard (CENTRAL_API_TOKEN)
src/mcp/server.ts           servidor MCP
src/components/ui/          biblioteca de componentes (formularios, select, combobox, modal, toast…); catálogo en /componentes
docs/                       arquitectura, modelo de datos, escáner, roadmap, decisiones
plans/                      planes de trabajo por tarea
inventario/                 CSV de revisión del escáner (ignorado en git)
```

## Reglas del código

- Acceso a datos solo desde Server Components, Server Actions, scripts o el MCP. Nada de Prisma en el cliente.
- Toda Server Action empieza con `await requireSession()` y valida con Zod.
- Lo que el usuario edita a mano manda sobre el escáner: el escáner nunca sobrescribe `name`, `kind`, `clientId`, `description`, `phase`, y respeta `status` si `statusLocked`.
- Servidores: en la BD solo la ruta de la clave SSH, nunca la clave; la API y el MCP no devuelven rutas de clave ni IPs.
- El escáner jamás abre carpetas de credenciales (regex `SECRET` en `scanner.ts`) ni lee `.env`.
- Credenciales y tokens de integraciones: siempre con `encryptJson` en `IntegrationConnection.secret`; nunca en texto plano, logs ni respuestas del MCP.
- Fechas en `Europe/Madrid` al mostrar (`src/lib/format.ts`).
- Textos de UI en español, en sentence case.
- Interfaz solo con los componentes de `@/components/ui` (guía en `docs/UI.md`): nada de `<select>`, `<datalist>`, casillas nativas, `alert()` ni `confirm()`. Letra grande, espacio amplio y paleta azul con los tokens de `globals.css`.

## Documentación

- `docs/VISION.md` — visión completa del producto (léelo antes de diseñar algo nuevo)
- `docs/ROADMAP.md` — orden de construcción por fases
- `docs/INTEGRACIONES.md` — sn4p.dev, Google, vídeos y Meta, SeaweedFS, GitHub/GitLab, tokens
- `docs/SERVIDORES.md` — uptime de webs y vigilancia de servidores (modelo CostGuard/infobar)
- `docs/UI.md` — sistema de componentes y reglas de interfaz
- `docs/MODELO-DATOS.md`, `docs/ESCANER.md`, `docs/MCP.md`, `docs/ARQUITECTURA.md`, `docs/DECISIONES.md`

## Estado

Fase 1 hecha (proyectos, despliegue y servicios, avisos de pendientes, webs, clientes, notas, MCP). Los datos de despliegue van a la BD, no a ficheros en cada repo. Ver `docs/ROADMAP.md`.
