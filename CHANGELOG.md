# Changelog

## 0.4.2 — 2026-10-28

- Secretos: copiar del servidor pone al día los secretos con lo desplegado (y guarda copia nueva solo si cambió); el botón solo sale en entornos con contenedores enlazados.
- Ficha del proyecto con cabecera fija al hacer scroll (nombre, estado, datos y botones).
- Worktrees: «Borrar» en los ya fusionados y sin cambios, y «Limpiar» para los huérfanos; desde producción lo hace el trabajador del Mac.
- Servicios con el logo de su tecnología: bases de datos y almacenamiento por la imagen del contenedor (PostgreSQL, MySQL, MongoDB, Redis, MinIO, SeaweedFS, n8n…), la aplicación con el framework del proyecto (Next.js, Nuxt, Astro, Laravel…) y un icono genérico para el resto.
- Orden de los servicios de cada entorno arrastrando (dnd-kit), también con el teclado.

## 0.4.1 — 2026-10-28

- Copias de secretos del entorno desplegado (pruebas y producción) cada día, leídas de los contenedores enlazados; también desde producción con el trabajador del Mac.
- «Copiar del servidor» guarda una versión nueva de la copia sin tocar los secretos; ninguna copia se guarda si es igual a la última.
- `bun run secretos:copias` y tarea diaria en el Mac.

## 0.4.0 — 2026-10-28

- Logo y favicon propios; la versión de Central se muestra en la navegación (sale de `package.json`).
- Qué es cada proyecto: tipo, sistema al que pertenece y plataforma propuestos por el escáner, también en monorepos; dominios sugeridos e instalaciones de plugins. Nuevo tipo «Skill de agente».
- Repositorio local frente a origin: remotos de GitHub, GitLab y Gitea, ramas por delante o por detrás, ramas solo locales, CI, PRs e issues; aviso de proyectos sin remoto.
- Servidores por SSH (modelo infobar): estado, protección con 13 comprobaciones, servicios Docker enlazados con los servicios de cada proyecto, puertos medidos desde fuera y API para CostGuard.
- Uptime Kuma: monitores creados desde las webs vigiladas, métricas en Webs y en la ficha, y monitores push de dependencias y parches de seguridad.
- Auditoría diaria de dependencias (osv-scanner y endoflife.date), tarjeta Seguridad en la ficha y exportación de los avisos como issue en Markdown.
- Centro de alertas: campana en la navegación y página Alertas.
- Secretos por entorno cifrados, con copias y «Traer del servidor» desde los contenedores enlazados.
- Presupuestos por fases o paquetes con PDF y Word, y asistente con Claude Code del Mac.
- Google Calendar y Gmail en solo lectura, ligados a clientes y proyectos.
- Producción en Dokploy (central.sn4p.dev) con el trabajador del Mac en launchd.
- Nombre del proyecto editable en Clasificación.
- Servidores desde producción: la huella confirmada se guarda en la BD y «Instalar» lo hace el trabajador del Mac con sus claves.
- `bun run produccion:subir`: lleva a producción clientes, proyectos, webs y servidores trabajados en el Mac, sin borrar ni tocar presupuestos.

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
