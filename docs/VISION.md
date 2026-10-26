# Central — visión de producto

Documento vivo con todas las ideas de Paulo para Central. Lo que ya está construido se marca **(hecho)**; el resto es diseño pendiente. El orden de construcción está en `ROADMAP.md`.

---

## 1. Para qué existe

1. **Organizar y compactar** toda la información que hoy está repartida en carpetas (`/ruta/a/tus/proyectos` y las que se añadan): qué proyectos hay, de quién son, en qué estado, dónde están publicados y qué sobra en disco.
2. **Una sola fuente de verdad** para el bot y los agentes (vía MCP): cualquier pregunta sobre un proyecto, un cliente o una web se responde desde Central.
3. **Material comercial reutilizable**: cada proyecto con su miniatura, enlaces, métricas y textos para enviarlo al portfolio o montar vídeos sin buscar nada a mano.
4. **Gestión del negocio**: presupuestos con logo y fases, agenda, correo y notas por cliente.

Principio: **los datos se editan en Central y viven en su base de datos**, no en ficheros dentro de cada repo. El escáner aporta lo que se puede detectar; lo demás se completa en formularios, y Central avisa de lo que falta (hecho, ver `MODELO-DATOS.md` › Información pendiente).

---

## 2. El proyecto, en el centro

### 2.1 Tipo de proyecto

Además de *para quién* es (`kind`: cliente, propio, formación, experimento — hecho), cada proyecto tiene un **tipo**: qué es.

| Tipo | Ejemplos | Qué cambia en la ficha |
|---|---|---|
| Web corporativa / landing | yotei, sn4p.dev | Dominios, miniatura, Search Console, Analytics |
| Aplicación web / SaaS | Habiteka, Captaru, CRMDev | Servicios (web, api, admin), documentación, versión desplegada |
| E-commerce | Luckyled, Bloom Marbella | Tienda, pasarela, métricas de tráfico |
| API / backend | restaurants-backend, chef-gpt | URL de la API y de su documentación (OpenAPI/Swagger) |
| Addon / módulo de un sistema | addon para Habiteka, módulo de CRMDev | **Sistema al que pertenece**; hereda sus dominios |
| Plugin / tema de una plataforma | plugin de WordPress, módulo de PrestaShop, nodo de n8n | **Plataforma** y **dónde está instalado** |
| App móvil | cardiapp_movil, codeia-mobile | Tiendas (App Store, Google Play), builds |
| App de escritorio | Tauri / Electron | Descargas, versión publicada |
| Extensión de navegador | Lead Manager Pro, extensión de precios | Chrome Web Store |
| Servidor MCP / CLI / librería | jev-mcp, MCP WordPress, devdock | Registro (npm, Smithery), documentación |
| Automatización | flujos n8n / Make | Instancia donde corre, cliente |
| Contenido / formación | sesiones de CodeIA, cursos | Curso o sesión a la que pertenece |

El escáner propondrá un tipo a partir de lo que detecta (`wp-content` o cabecera de plugin → plugin WordPress; `manifest.json` de extensión → extensión; `expo` → app móvil; `@modelcontextprotocol/sdk` → MCP; `tauri`/`electron` → escritorio). El usuario lo confirma o corrige.

### 2.2 Pertenencia: sistemas y plataformas

Dos relaciones distintas:

- **Pertenece a un sistema propio** (`parent`): el proyecto es una pieza de otro proyecto de Central. Ej.: un addon para Habiteka, un módulo de CRMDev, `escenara-planes` dentro de Escenara. La ficha del sistema lista sus piezas; la del addon enlaza al sistema.
- **Es para una plataforma externa** (`platform`): WordPress, PrestaShop, WooCommerce, Shopify, n8n, Chrome, Elementor… No es un proyecto de Central sino un catálogo fijo.

Un plugin de WordPress no tiene "su" dominio: tiene **instalaciones** (en qué webs está instalado y con qué versión). Eso conecta con el monitor de WordPress que ya tiene CRMDev como idea.

### 2.3 Dominios sugeridos (reglas)

Solo se sugiere un dominio si **es del proyecto** o del **sistema al que pertenece**:

- Web, SaaS, e-commerce, API: dominios detectados en su configuración (`site` de Astro, `homepage`, `NEXT_PUBLIC_*_URL` de `.env.example`, `vercel.json`, `CNAME`, etiquetas de `docker-compose`/Easypanel, enlaces del README). Nunca se lee `.env`.
- Addon o módulo: no se sugieren dominios propios; se muestran los del sistema padre (heredados, solo lectura).
- Plugin de plataforma: en lugar de dominios, se sugieren **instalaciones** (webs de Central con esa plataforma).
- Lo sugerido entra como *propuesta* en el formulario; no se guarda hasta que se confirma.

---

## 3. La ficha del proyecto

Todo a mano al entrar. Secciones:

1. **Identidad** — nombre, cliente, para quién, tipo, sistema/plataforma, fase, descripción. *(parcialmente hecho)*
2. **Despliegue y servicios** — estado (sin desplegar, pruebas, producción, retirado), hosting, versión desplegada, servicios por entorno con su URL. *(hecho)*
3. **Repositorio: local frente a origin** — ver §4.
4. **Salud de la web y del servidor** — uptime, tiempo de respuesta, último código HTTP de cada servicio *(hecho)*; caducidad del SSL y del dominio; gráfico de 7/30 días; **servidor donde está desplegado** con su estado (CPU, memoria, disco, contenedores, seguridad), ver `SERVIDORES.md`.
5. **Tráfico y SEO** — Search Console y Analytics, ver §5.
6. **Material comercial** — miniatura, capturas, vídeos (origen y propósito), demo, documentación, envío a sn4p.dev, ver §6.
6b. **Marketing** — analíticas de Meta (Facebook/Instagram) del proyecto, ver §6.1.
7. **Ubicaciones en disco** — principal, worktrees, copias, backups *(hecho)*; espacio que ocupa cada una y propuesta de limpieza (§7).
8. **Negocio** — presupuestos y fases, horas, notas *(notas hecho)*, mensajes guardados del cliente.

---

## 4. Repositorio: local frente a origin

Comparar lo que hay en el disco con lo que hay en el remoto:

- **Proveedor**: GitHub, GitLab (gitlab.com o autoalojado, p. ej. Blocknovas) o Gitea/otros (p. ej. `git.rcassociats.com`). Un proyecto puede tener varios remotos.
- **Por rama**: commits por delante / por detrás de `origin`, ramas locales sin subir, ramas remotas que no existen en local.
- **Sin subir**: ficheros sin commit *(hecho)*, commits sin push, stash.
- **Proyectos sin remoto**: aviso fuerte si un proyecto activo no tiene copia fuera del disco (hoy hay casos, p. ej. `crm-certificand` con 105 ficheros sin commit y sin remoto).
- **Del lado del proveedor** (API con token): último push, PRs/MRs abiertas, issues abiertas, estado de CI, releases/tags, visibilidad (público/privado).

Cómo: el escáner hace `git fetch` (con las credenciales git del Mac, opcional porque tarda) y calcula `ahead/behind`; la API de GitHub (token o `gh`) y GitLab (token) aporta el resto. Tokens cifrados en la BD.

---

## 5. Tráfico y SEO

Por web (no por proyecto: un proyecto puede tener varias webs):

- **Google Search Console**: clics, impresiones, CTR y posición media de los últimos 28 días frente a los 28 anteriores; consultas y páginas principales; estado de indexación.
- **Google Analytics 4**: usuarios, sesiones, páginas vistas, páginas principales, fuentes de tráfico.
- **Screpy** (ya conectado en Claude): puntuación SEO, Core Web Vitals, backlinks, posiciones de palabras clave, visibilidad en IA.
- **Plausible / Umami** si alguna web los usa.

Cómo: **la conexión se hace desde la ficha del proyecto, cuando se da de alta o se completa**. Botón *Conectar con Google* → se elige la propiedad de Search Console y la de GA4 de cada web, y queda registrado **con qué cuenta de Google** se conectó (puede ser distinta en cada proyecto). Una tarea diaria guarda una foto de las métricas (`AnalyticsSnapshot`) para tener histórico y comparar sin llamar a Google en cada visita. Detalle en `INTEGRACIONES.md` §2.

---

## 6. Material comercial: portfolio y vídeos

Objetivo: que cada proyecto pueda salir hacia el **portfolio** (yosnap-portfolio / sn4p.dev) o hacia un **vídeo** con toda su información, sin buscar nada.

- **Miniatura y capturas**: captura automática de la URL de producción (escritorio y móvil) con Playwright, refrescada semanalmente o a demanda; además se pueden subir capturas propias. Se guardan en **SeaweedFS (S3) en local** (`INTEGRACIONES.md` §4).
- **Enlaces**: web, demo, documentación, documentación de la API (OpenAPI/Swagger/Redoc), vídeos (YouTube/Vimeo), tiendas de apps, Chrome Web Store, npm, repositorio público.
- **Textos comerciales**: resumen de una línea, descripción larga, problema/solución, funcionalidades destacadas, tecnologías (desde el stack), resultados con cifras (desde Analytics/Search Console cuando aplique).
- **Permiso del cliente**: casilla obligatoria "se puede mostrar públicamente" y nivel (con nombre del cliente, anónimo, no mostrar). Nada sale al portfolio sin ella.
- **Exportación al portfolio sn4p.dev**: con su API (`POST/PUT /api/portfolio`, imágenes por `POST /api/uploads/image`), textos en español e inglés, categoría y estado derivados del proyecto. Detalle y mapeo de campos en `INTEGRACIONES.md` §1.
- **Vídeos del proyecto**: cada vídeo con su **origen** (YouTube — canal de CodeIA u otro —, Bunny Stream, SeaweedFS, enlace) y **propósito** (demostración, venta, marketing, tutorial). Los vídeos se hacen fuera (skill, `fabrica-videos`, HyperFrames); Central guarda dónde están y puede recoger los que se suben solos a YouTube.
- **Kit para vídeo**: paquete con capturas, textos, métricas y enlaces para alimentar esas herramientas.

### 6.1 Marketing

Proyectos con acciones de marketing (p. ej. Bloom Marbella) conectan su página de Facebook / Instagram (Meta) desde la ficha. Central guarda **solo las analíticas** por fecha (alcance, impresiones, interacciones, reproducciones, seguidores), no el contenido publicado. Detalle en `INTEGRACIONES.md` §3.

Testimonios: solo reales y con permiso; Central no genera testimonios.

---

## 7. Limpieza y espacio en disco

Informe, nunca borrado automático:

- `node_modules`, `.next`, `dist`, `build` de proyectos parados (lo que más ocupa; se recupera con `bun install`).
- Worktrees cuya rama ya está fusionada y sin cambios → `git worktree remove`.
- Copias y backups idénticos a su repo → mover a `_archivo` o comprimir.
- `git gc` para compactar historiales (sin reescribir historia).
- Proyectos sin remoto: primero subirlos, después limpiar.

Cada acción muestra el espacio que libera y requiere confirmación.

---

## 7b. Servidores y avisos

Las webs se vigilan con **Uptime Kuma** (open source, autoalojado fuera de los servidores vigilados), que avisa por Telegram y correo en cuanto una cae; Central le da de alta los monitores a partir de los servicios de cada proyecto y lee su estado. Detalle en `SERVIDORES.md` §0.

Cada VPS donde hay proyectos desplegados se vigila con el mismo modelo que CostGuard/infobar: SSH con un usuario de solo lectura, sin agente. CPU, memoria, disco, servicios de Docker con sus réplicas, sesiones e intentos de acceso, puertos abiertos desde Internet, 12 comprobaciones de protección y mantenimiento pendiente. Cada servicio de proyecto indica en qué servidor vive, así la ficha muestra web + contenedor + servidor. Detalle en `SERVIDORES.md`.

## 8. Clientes, presupuestos, agenda y correo

- **Clientes**: datos fiscales, contactos, proyectos, webs, presupuestos, notas, mensajes. *(base hecha)*
- **Presupuestos**: datos de marca y logo, tarifas, partidas, IVA, numeración, PDF con logo, fases con % a facturar y seguimiento. *(hecho)*
- **Agenda**: calendarios Sn4p, iServisat y Codeia; eventos ligados a cliente/proyecto. *(hecho con Google Calendar)*
- **Correo**: Gmail, Google Workspace, Microsoft 365, IMAP del hosting; guardar mensajes importantes y ligarlos a cliente. Credenciales cifradas. *(hecho con Gmail y Workspace, solo lectura)*

---

## 9. Para el bot (MCP)

Hecho: `list_projects`, `get_project`, `list_websites`, `list_clients`, `list_pending`, `add_note`.

Previstas: `get_repo_status` (local vs origin), `get_site_metrics` (uptime + Search Console + GA4), `get_portfolio_entry` / `export_portfolio`, `get_video_kit`, `list_installations` (dónde está instalado un plugin), `create_quote`, `update_phase`, `search_messages`, `list_events`, `update_project` (rellenar datos pendientes desde el chat).

Despliegue del MCP: hoy stdio en el Mac; después HTTP con token para usarlo como conector remoto cuando Central esté en producción.

---

## 10. Local y producción

- **Fase actual: local.** Postgres en Docker y Central en el Mac, con acceso directo a las carpetas y a git.
- **Después: producción en un dominio** (Easypanel · Hetzner). El Mac **empuja** los datos con `bun run sync` y un token; no hace falta abrir un túnel. El escáner y la limpieza siguen corriendo en el Mac; las integraciones en la nube (uptime, Search Console, GA4, GitHub/GitLab) corren en el servidor.

---

## 11. Modelo de datos previsto (además de lo que ya existe)

| Modelo / campo | Para qué |
|---|---|
| `Project.type` (enum de §2.1) | Qué es el proyecto |
| `Project.parentId` → `Project` | Sistema propio al que pertenece (addon, módulo) |
| `Project.platform` (enum: WordPress, PrestaShop, WooCommerce, Shopify, n8n, Chrome, Elementor, otra) | Plataforma externa |
| `Installation` (projectId, websiteId, versión, fecha) | Dónde está instalado un plugin/addon |
| `RepoRemote` (projectId, proveedor, url, rama por defecto, ahead, behind, ramas sin subir, último push, PRs, issues, CI, visibilidad, lastFetchAt) | Local frente a origin |
| `ProjectLink` (projectId, tipo: web, demo, docs, api-docs, vídeo, tienda, npm, otro; url; título) | Enlaces comerciales y de documentación |
| `ProjectAsset` (projectId, tipo: miniatura, captura, logo; clave S3 en SeaweedFS; origen: automático/subido; para portfolio; capturedAt) | Miniaturas y capturas |
| `PortfolioEntry` (projectId, externalId en sn4p.dev, publicado, permiso del cliente, nivel, títulos y descripciones ES/EN, categoría, estado, destacado, orden, lastSyncedAt) | Lo que sale a sn4p.dev |
| `SocialAccount` (projectId, red: Facebook/Instagram; id de página/cuenta; conexión) | Marketing en Meta |
| `SocialSnapshot` (socialAccountId, fecha, métricas JSON) | Histórico de analíticas de Meta |
| `AnalyticsProperty` (websiteId, proveedor: GSC, GA4, Screpy, Plausible; id de propiedad) | Enlace web ↔ propiedad |
| `AnalyticsSnapshot` (propertyId, fecha, métricas JSON) | Histórico diario de métricas |
| `DiskUsage` (locationId, bytes totales, bytes recuperables, medido) | Informe de limpieza |
| `Website.sslExpiresAt`, `Website.domainExpiresAt` | Avisos de caducidad |

Cada uno entra en el esquema cuando se construya su fase, con su plan en `plans/`.

---

## 12. Preguntas abiertas

Resueltas el 2026-10-25:

- Portfolio: **sn4p.dev**, con su API de portfolio (ver `INTEGRACIONES.md` §1).
- Search Console / GA4: se conectan **desde la ficha de cada proyecto** al darlo de alta, registrando la cuenta usada.
- Vídeos: varias herramientas; Central solo registra **dónde están** (YouTube con su canal, Bunny, etc.) y para qué son.
- Almacenamiento: **SeaweedFS con API S3 en local**.
- "Viteca" se asume que es **Habiteka**.

- Acceso a sn4p.dev y canales de vídeo: se configuran en **Ajustes** de Central (hecho en v0.3.0).

Pendientes: ninguna por ahora.
