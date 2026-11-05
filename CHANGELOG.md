# Changelog

## 0.4.13 — 2026-11-05

- Servicios: cada nombre sugerido explica debajo, en letra pequeña, qué va en él (agente: Hermes, OpenClaw…; herramienta: Postiz, Plausible…; base de datos: PostgreSQL, MySQL…; caché, almacenamiento, correo…).

## 0.4.12 — 2026-11-05

- Servicios: tipos nuevos para los servicios Docker: worker, programador (cron), servidor MCP, agente IA (Hermes, OpenClaw, Paperclip, Flowise, Dify…) y herramienta de terceros (Postiz, Plausible, Umami, Listmonk, Chatwoot, Cal.com, Metabase…). Al enlazarlos a un proyecto se llaman como su papel o su producto, y las herramientas y agentes con dominio se vigilan y muestran su versión.
- El nombre de un servicio sugiere también worker, programador, mcp, agente y herramienta.

## 0.4.11 — 2026-11-05

- Repositorio: una rama local creada desde origin/develop u origin/main (git la deja siguiendo a esa rama) ya no sale «por bajar» con todo lo que develop avanzó después. Si no tiene commits propios, aparece en «Ramas locales ya fusionadas (se pueden borrar)».

## 0.4.10 — 2026-11-05

- Servidores: la tarjeta Protección copia o descarga lo pendiente como issue en Markdown (servidor, comandos de cada arreglo y cómo hacerlo sin quedarse fuera), para pasárselo a un agente o abrirlo en GitHub.
- Worktrees: al borrar uno fusionado se elige si también se borra su rama local (marcado por defecto) y la de GitHub (desmarcado; solo si está fusionada en origin). Nunca se fuerza: lo que no se puede borrar con seguridad se queda y se avisa.

## 0.4.9 — 2026-11-05

- Servidores: si el Mac no entra para instalar infobar, la ventana y el aviso explican los pasos en orden: añadir la clave de Central en el proveedor (mejor como clave por defecto, para que cada servidor nuevo se instale a la primera) o guardar en el Mac la clave que dio el proveedor, con su frase en el Llavero.

## 0.4.8 — 2026-11-04

- Clasificación de proyectos: tipos nuevos (servidor MCP, CLI, librería o paquete, agente o subagente, plugin o kit de agente, plantilla o repositorio para clonar, documentación) y plataformas nuevas (GitHub, Claude Code, Codex, npm, PyPI, VS Code / Cursor). El escáner propone MCP, CLI y plugin de agente en lugar de «librería».
- Webs: cada web suelta se puede editar (URL, nombre, tipo, cliente, proyecto, vigilar) y borrar con confirmación; las de un servicio enlazan a la ficha de su proyecto.
- Repositorio: si la rama está al día con origin, el botón «Traer de origin y actualizar» pasa a «Al día con origin» y queda desactivado.

## 0.4.7 — 2026-11-03

- Servidores: los proyectos desplegados con Compose (en Dokploy, junto a servicios de Swarm) vuelven a salir en la lista de servicios Docker del servidor, con su imagen y sus dominios.

## 0.4.6 — 2026-10-31

- Un servicio sin «Vigilar» ya no sale como caído ni en línea con un resultado antiguo: al dejar de vigilarlo se borra su último estado (también el que ya estaba guardado).
- Infraestructura del servidor: el panel (Dokploy, Easypanel, Coolify…) y lo que arranca con él (su base de datos, su caché, su proxy) se reconocen solos, salen aparte en la ficha del servidor y no cuentan como «sin proyecto» ni en Pendientes. También se puede elegir a mano en el desplegable de proyecto.
- El dominio propio del panel rellena «Abrir panel» si estaba vacío, y «Vigilar panel» lo lleva a Webs centralizadas y a Uptime Kuma.
- Webs centralizadas explica qué son: lo compartido que no es de un proyecto (paneles, n8n, APIs comunes).

## 0.4.5 — 2026-10-31

- Webs solo lista las webs vigiladas y las sueltas: un servicio sin «Vigilar» (como una API) no aparece en Webs, solo en la ficha de su proyecto.

## 0.4.4 — 2026-10-31

- Quitar «Vigilar» a un servicio ya no deja su web suelta y vigilada: sigue ligada al servicio, con su nombre, y sale «Sin vigilar» en Webs (ni caída ni en Uptime Kuma). Las webs que se quedaron sueltas vuelven a su servicio por la URL.

## 0.4.3 — 2026-10-31

- Webs: el nombre de la web de un servicio sigue al servicio y al proyecto («Proyecto · api», con «(pruebas)» si es de pruebas) aunque se renombren después.
- Una API o un backend se da por en línea aunque su raíz responda 4xx (en el comprobador propio y en Uptime Kuma).
- Al enlazar un contenedor de backend o API se crea el servicio «api», no «web».

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
