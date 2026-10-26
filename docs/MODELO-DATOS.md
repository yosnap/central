# Modelo de datos

Fuente de verdad: `prisma/schema.prisma`.

| Modelo | Fase | Para qué |
|---|---|---|
| `Client` | 1 | Cliente: nombre único, empresa, NIF, contacto. Agrupa proyectos, webs, presupuestos, notas y mensajes |
| `Project` | 1 | Proyecto de código. `kind` (cliente, propio, formación, experimento), `status` (activo, mantenimiento, parado, archivo), `phase` libre, versión, framework, stack, datos git |
| `Project` (despliegue) | 1 | `deployStatus` (sin indicar, sin desplegar, en pruebas, en producción, retirado), `hosting`, `deployedVersion`, `reviewedAt` (null = nuevo sin revisar) |
| `ProjectService` | 1 | Dominios y servicios del proyecto por entorno (web, api, admin, n8n…), con URL, hosting y notas. Si tiene URL y `monitor`, crea/enlaza su `Website` para el uptime. `versionPath` (opcional) se lee en cada comprobación y guarda `liveVersion`; si es de producción, rellena `Project.deployedVersion` |
| `Project` (qué es) | 1.5 | `type` (web, aplicación, e-commerce, API, addon, plugin/tema, app móvil, escritorio, extensión, MCP/CLI/librería, automatización, contenido), `platform` (WordPress, WooCommerce, PrestaShop, Shopify, n8n, Chrome, Elementor, otra) y `parentId` (sistema propio). Los confirma el usuario; el escáner solo escribe `suggestedType`, `suggestedPlatform` y `suggestedDomains` |
| `Installation` | 1.5 | Dónde está instalado un plugin, tema o addon: proyecto, web, versión, notas, fecha. Único por proyecto y web |
| `Project` (frente a origin) | 2 | `branchStatus` (ramas con upstream, por delante y por detrás; una rama sin upstream configurado se compara con la remota del mismo nombre y queda marcada `implicit`), `localOnlyBranches` (con commits que no están en ningún remoto), `remoteOnlyBranches`, `stashCount`, `aheadTotal` (commits en ningún remoto), `behindTotal` (rama actual), `lastFetchAt`, `fetchError` |
| `RepoRemote` | 2 | Cada remoto git del proyecto: proveedor (GitHub, GitLab, Gitea, otro), host, `titular/repo`, y del proveedor visibilidad, rama por defecto, último push, PRs/MRs, issues, CI, último release, archivado, error y fecha de sincronización |
| `Project` (entornos) | 3b | `environments` (casillas: local, pruebas, producción; vacías = se deducen), `envFiles` (nombres de ficheros de variables y su entorno), `localCompose` (servicios, imagen y puertos), `composeProject`, `localUrl` |
| `Project` (sin carpeta) | 3b | `goneAt`: el escaneo no encuentra ninguna de sus carpetas (dentro de una raíz escaneada); Pendientes pregunta si eliminarlo o unirlo al renombrado |
| `Project` (exclusión) | 1 | `excluded`, `excludedAt`: proyecto fuera de Central. No cuenta en listados, avisos ni MCP; el escáner lo respeta |
| `Project` (repositorio) | 1 | `repoUrl` lo lee el escáner del remoto de git; si se escribe a mano, `repoLocked` lo fija y el escáner no lo cambia. Una carpeta sin remoto ya no borra el que había |
| `ProjectSecret` | 1 | Secreto de un proyecto por entorno (producción, pruebas, desarrollo): `key` en claro, `value` cifrado con `encryptJson`, notas. Único por proyecto, entorno y clave |
| `EnvBackup` | 1 | Copia cifrada de un fichero de variables completo por entorno, con número de claves y origen (importación, antes de sustituir, manual) |
| `ProjectLocation` | 1 | Cada carpeta del disco de un proyecto: principal, worktree, copia o backup, con rama, último commit, ficheros sin commit (`uncommitted`) y nuevos sin versionar (`untracked`), `merged` (rama fusionada) y `missing` (worktree huérfano) |
| `ScanRoot` | 1 | Carpetas raíz escaneadas y cuándo |
| `Website` | 1 | Web con `kind` (cliente, propia, centralizada), último estado, código y ms |
| `Website` (Uptime Kuma) | 3a | `kumaMonitorId` (monitor creado por Central), `kumaStatus`, `kumaMs`, `sslDaysLeft`, `kumaCheckedAt`, leídos de `/metrics` |
| `UptimeCheck` | 1 | Historial de comprobaciones (30 días) |
| `Server` | 3b | Servidor vigilado por SSH: nombre, host, puerto, usuario de recogida (`infobar`), ruta de la clave (nunca la clave), proveedor, panel y su URL, IPs conocidas, `allowMail`, intervalos normal e incidencia, estado global y vivo, error, próxima lectura, pausa tras rechazo y `snapshot` (última lectura buena interpretada) |
| `ServerSample` / `ServerHour` | 3b | Muestras de cada lectura (7 días) y agregado por hora (90 días): CPU, memoria, disco, servicios, sesiones, intentos, puertos expuestos, estado |
| `ServerCheck` | 3b | Las 13 comprobaciones de protección: `ok` (null = no se pudo mirar), texto y comando de arreglo |
| `ServerContainer` | 3b | Servicio de Swarm o contenedor del servidor con estado y réplicas; `projectServiceId` lo empareja con su servicio de proyecto (`matchManual` = elegido a mano) |
| `Deployment` | 3b | Despliegue detectado (el contenedor volvió a arrancar o el servicio de Swarm se actualizó): servidor, contenedor, servicio de proyecto, fecha, imagen, versión anterior y nueva (un año) |
| `ServerAttackIp` | 3b | IPs con más intentos de acceso SSH (90 días) |
| `ProjectService.serverId` | 3b | Servidor donde está desplegado el servicio; se elige en la ficha o se asigna solo si el proxy de un único servidor sirve su dominio |
| `Note` | 1 | Nota libre ligada a cliente, proyecto o web; `source` = app, mcp, email |
| `IntegrationConnection` | 1 | Conexión de Ajustes: proveedor (sn4p.dev, YouTube, Bunny, Google, Meta, GitHub, GitLab, Microsoft), cuenta, URL base, `secret` cifrado, último OK/error |
| `VideoChannel` | 1 | Canal de YouTube o biblioteca de Bunny, con su clave (`connectionId`) y última sincronización |
| `VideoChannelLink` | 1 | Canal → proyecto, con propósito y filtro opcional por título |
| `ProjectVideo` | 1 | Vídeo de un proyecto (sincronizado de un canal o añadido a mano): título, URL, miniatura, propósito, fecha |
| `BrandSettings` | 2 | Datos fiscales y de marca para presupuestos: nombre, NIF, dirección, IBAN, logo (`logoData`/`logoType`: PNG o JPG guardado en la BD, para la app y el PDF), IVA por defecto, pie, criterios de precio del asistente (`pricingGuide`) y colores corporativos (`primaryColor`, `secondaryColor`: se sacan del logo al subirlo; los usan el PDF y el Word, con marca de agua y esquinas) |
| `Rate` | 2 | Tarifas reutilizables (hora, proyecto, mes, unidad) |
| `Quote` | 2 | Presupuesto numerado (`P-2026-001`, correlativo por año), estado, validez, IVA, cliente y proyecto; secciones del documento (`scope`, `includes`, `excludes`, `assumptions`, `thirdPartyCosts`, `schedule`, `notes`) y `aiSessionId` del asistente. Un enviado con la validez pasada se muestra caducado (`visibleStatus` en `src/lib/quotes.ts`) |
| `QuoteItem` | 2 | Fase o paquete del desglose: nombre (`description`), qué incluye (`details`), precio sin IVA (`unitPrice`; «desde» si hay `priceMax`, «hasta», y entonces es variable), cantidad y unidad para paquetes recurrentes, posición |
| `QuoteMessage` | 2 | Conversación con el asistente de presupuestos: rol, texto, adjuntos, propuesta JSON (`proposal`) y cuándo se aplicó |
| `QuotePhase` | 2 | Hitos de pago (forma de pago) con % del total, fecha y estado (pendiente, en curso, hecha, facturada) |
| `MailAccount` | 3 | Buzón de una cuenta conectada (hoy Gmail y Workspace), ligado a su `IntegrationConnection` (`connectionId`), donde están los tokens cifrados |
| `SavedMessage` | 3 | Correo importante guardado desde Gmail: remitente, destinatarios, asunto, texto (`body`), hilo (`threadId`), fecha, y cliente o proyecto ligado. Se conserva aunque se borre en Gmail |
| `CalendarEventLink` | 3 | Evento de Google Calendar ligado a un cliente o proyecto (cuenta, calendario, id del evento, título y fechas en caché para las fichas y el MCP) |

## Reglas de estado de proyecto

- Activo: actividad (último commit o, sin git, última modificación) en ≤ 30 días.
- Mantenimiento: ≤ 6 meses.
- Parado: más de 6 meses.
- Archivo: la carpeta principal parece un backup o copia antigua.
- `statusLocked = true` congela el estado frente al escáner.

## Información pendiente

Las reglas viven en `src/lib/completeness.ts` (`projectIssues`). Hoy avisan de: proyecto nuevo sin revisar, despliegue sin indicar, en producción o pruebas sin servicios o sin hosting, proyecto de cliente sin cliente, sin fase y sin descripción. Solo cuentan los proyectos de clientes y propios no archivados; el contador de la navegación muestra los activos y en mantenimiento.

Para pedir un dato nuevo: añade el campo al modelo, al formulario de la ficha y una regla en `projectIssues`.
