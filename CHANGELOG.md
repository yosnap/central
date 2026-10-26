# Changelog

## 0.3.1 — 2026-10-25

- Bun como runtime y gestor de paquetes: scripts con `bun`, CLIs con `bunx`, Next.js con `bun --bun`, Dockerfile sobre `oven/bun`; se retira tsx.
- Uptime Kuma documentado como herramienta de vigilancia y avisos (fase 3a).

## 0.3.0 — 2026-10-25

- Página Ajustes: credenciales de sn4p.dev (contraseña cifrada) con prueba de conexión.
- Claves de API de YouTube y Bunny Stream cifradas (AES-256-GCM, `CENTRAL_ENCRYPTION_KEY`).
- Canales de vídeo conectados a proyectos, con propósito y filtro por título; sincronización desde Ajustes, `npm run videos:sync` o `/api/cron/videos`.
- Bloque Vídeos en la ficha del proyecto: vídeos de los canales y enlaces añadidos a mano.

## 0.2.0 — 2026-10-25

- Despliegue por proyecto en la base de datos: estado (sin desplegar, en pruebas, en producción, retirado), hosting, versión desplegada.
- Servicios y dominios por entorno (web, api, admin, n8n…) desde un formulario en la ficha; los que tienen URL se vigilan en Webs.
- Avisos de información pendiente: contador en la navegación, página Pendientes (activos, nuevos, todos), aviso en la ficha y en el resumen.
- Herramienta MCP `list_pending`.

## 0.1.0 — 2026-10-25

- Esquema de datos de Central (clientes, proyectos, ubicaciones, webs, uptime, notas, presupuestos, fases, tarifas, marca, correo).
- Escáner de carpetas con agrupación de worktrees y copias, clasificación y exportación CSV.
- Páginas de resumen, proyectos, ficha de proyecto, webs y clientes; login monousuario.
- Comprobador de uptime con endpoint de cron.
- Servidor MCP con 5 herramientas.
- Documentación para agentes (CLAUDE.md, AGENTS.md, docs/).
