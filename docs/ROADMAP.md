# Roadmap

La visión completa está en `VISION.md`. Aquí, el orden de construcción.

## Fase 1 — Inventario y despliegue (hecha, v0.2.0)

- [x] Esquema base, escáner con agrupación y clasificación, importación a BD y CSV
- [x] Resumen, proyectos, ficha, webs, clientes (listado con buscador y filtros, alta, ficha editable con proyectos, webs, presupuestos y notas), notas
- [x] Despliegue y servicios por proyecto en la BD, enlazados con el uptime
- [x] Avisos de información pendiente (navegación, página Pendientes, ficha)
- [x] Uptime propio + cron · MCP con 6 herramientas
- [x] Ajustes (v0.3.0): credenciales de sn4p.dev cifradas con prueba de conexión; claves de YouTube/Bunny; canales conectados a proyectos con filtro y propósito; sincronización (botón, script, cron); bloque Vídeos en la ficha con enlaces manuales
- [x] Sistema de componentes de UI (ver `UI.md`): letra grande, espacio amplio, paleta azul, select, combobox, modales, toasts
- [x] Secretos por entorno cifrados con desbloqueo por contraseña, importación y copias del fichero de variables; repositorio editable y fijado frente al escáner; aviso de versión en producción desfasada
- [x] Todos los worktrees vía git (también fuera de la raíz), huérfanos y fusionados; repos movidos sin duplicar; tareas del Mac (escaneo cada hora, uptime cada 10 min) y «Escanear ahora»; versión en producción leída de la ruta de versión de cada servicio
- [x] Carpetas raíz desde Ajustes (añadir y escanear, quitar) y proyectos excluidos de Central, respetados por el escáner

## Fase 1.5 — Qué es cada proyecto (hecha)

- [x] `Project.type`, `parentId` (sistema al que pertenece) y `platform` (WordPress, PrestaShop, n8n…), con propuesta automática del escáner (también en monorepos) y aceptación una a una o en bloque desde Pendientes
- [x] Ficha del sistema con sus addons/módulos; los addons muestran los dominios del sistema, solo lectura
- [x] Dominios sugeridos leídos de la configuración, como propuesta que se añade con un clic
- [x] `Installation`: en qué webs está instalado un plugin, con su versión y aviso si hay una más nueva
- [x] Reglas nuevas en Pendientes: falta el tipo; addon sin sistema; plugin sin plataforma. A addons, plugins y contenido no se les pide despliegue
- [x] Filtro y columna «Qué es» en Proyectos; el MCP devuelve el tipo

## Fase 2 — Repositorio local frente a origin (hecha)

- [x] `RepoRemote` multi-proveedor (GitHub, GitLab, Gitea, autoalojados; el proveedor de un host propio se detecta por su API)
- [x] `git fetch` sin preguntas en el escáner (`--fetch-active`, `--fetch`) y botón en la ficha; por rama, commits por delante/detrás; ramas solo locales con trabajo sin subir; ramas remotas sin copia local; stash
- [x] API de GitHub (token de Ajustes o sesión de `gh`), GitLab y Gitea con token: último push, PRs/MRs, issues, CI, último release, visibilidad
- [x] Aviso de proyectos activos sin remoto (Pendientes y ficha); Resumen con lo no guardado fuera del disco
- [x] Tarea horaria: escaneo con fetch de los activos y sincronización con los proveedores
- [x] MCP `get_repo_status`

## Fase 3 — Salud, tráfico y SEO de las webs

- [ ] SSL y caducidad de dominio; gráfico de respuesta 7/30 días
- [ ] Conectar con Google **desde la ficha del proyecto**; enlace web ↔ propiedad de Search Console y GA4
- [ ] `AnalyticsSnapshot` diario; bloque de tráfico y SEO en la ficha con comparación de periodos
- [ ] Datos de Screpy por web
- [ ] MCP `get_site_metrics`

## Fase 3a — Uptime Kuma y avisos (hecha, 2026-10-26)

- [x] Montar Uptime Kuma 2.x (de momento en el Mac, servicio `kuma` del `docker-compose.yml`, puerto 3098; pasar a un VPS es cambiar la URL en Ajustes)
- [x] Avisos por Telegram con reintento y aviso de recuperación; aviso de SSL a 7, 14 y 21 días (ajuste global de Uptime Kuma)
- [ ] Canal de correo (SMTP) en Uptime Kuma, marcado «activado por defecto»: falta darlo de alta
- [x] Conexión en Ajustes (URL, credenciales, clave de API de métricas) cifrada
- [x] `src/lib/kuma.ts`: alta, actualización y borrado automáticos de monitores desde las webs vigiladas de Central; `Website.kumaMonitorId`; añade a cada monitor los canales por defecto que le falten
- [x] Lectura de `/metrics` para mostrar estado, ms y días de SSL en Webs y en la ficha
- [ ] Opcional: páginas de estado por cliente; webhook a n8n

## Fase 3b — Servidores (modelo CostGuard / infobar)

- [x] Decidido: opción A (Central lee con los mismos scripts remotos); Central es la fuente y CostGuard lee de Central — ver `SERVIDORES.md` §1
- [x] Modelos `Server`, `ServerSample`, `ServerHour`, `ServerCheck`, `ServerContainer`, `ServerAttackIp`; `ProjectService.serverId`
- [x] Alta de servidor en Servidores (mismo `alta-servidor.sh`, usuario `infobar`), con confirmación de huella
- [x] Recogida por SSH cada 5 min (1 min en incidencia) + medición de puertos desde fuera
- [x] Página Servidores con tarjetas, protección (13 comprobaciones con su arreglo) y servicios Docker
- [x] Emparejar contenedores con servicios de proyecto; ficha del proyecto con web + contenedor + servidor
- [x] Avisos en Resumen/Pendientes con proyectos afectados
- [x] MCP `list_servers`, `get_server`, `get_project_health`; `GET /api/servidores` para CostGuard
- [ ] Probado contra un servidor real
- [ ] CostGuard lee la lista y el estado de Central (en su repositorio)

## Fase 4 — Material comercial, vídeos y marketing

- [ ] SeaweedFS (S3) local como almacenamiento (servicio ya en `docker-compose.yml`)
- [ ] Miniaturas y capturas automáticas (Playwright) + subida manual → SeaweedFS
- [ ] `ProjectLink` (demo, docs, API docs, tiendas) y `ProjectAsset`
- [ ] `PortfolioEntry` con permiso del cliente; envío a sn4p.dev por su API (`INTEGRACIONES.md` §1)
- [ ] Marketing: conectar Meta desde la ficha y guardar `SocialSnapshot` diario
- [ ] Kit de vídeo para las herramientas de vídeo
- [ ] MCP `export_portfolio`, `get_video_kit`, `get_marketing_metrics`

## Fase 5 — Limpieza de disco

- [ ] Medición de espacio por ubicación (`DiskUsage`)
- [ ] Informe: dependencias y builds de proyectos parados, worktrees fusionados, copias idénticas, `git gc`
- [ ] Ejecución con confirmación por acción

## Fase 6 — Presupuestos y fases

- [x] Marca y logo, tarifas (Ajustes), editor de presupuesto, PDF con logo (`/presupuestos/[id]/pdf`), numeración
- [x] Fases con % de facturación y tablero de seguimiento («Fases por facturar» en Presupuestos)
- [x] MCP `list_quotes`, `get_quote`, `create_quote`, `update_phase`
- [x] Presupuestos por fases o paquetes (precio fijo o rango), secciones del documento y Word (.docx)
- [x] Asistente de presupuestos en la ficha: analiza documentos o tareas y propone; se aplica con un botón

## Fase 7 — Agenda, correo y notas

- [x] Google Calendar (ver, crear y ligar eventos); Gmail y Workspace en solo lectura
- [ ] Microsoft 365 e IMAP (no hacen falta por ahora)
- [x] Mensajes importantes ligados a cliente o proyecto; tokens cifrados
- [x] MCP `search_messages`, `list_events`

## Fase 8 — Producción e integraciones

- [x] Despliegue en Dokploy · Sn4p.dev (central.sn4p.dev): web, tareas, PostgreSQL y Uptime Kuma; datos migrados
- [x] Trabajador del Mac (en lugar de `bun run sync`): asistente y escaneo por cola, solo conexiones de salida
- [ ] MCP por HTTP con token (conector remoto) · webhooks a n8n
