# Servidores y uptime

Tres piezas:

0. **Uptime Kuma** *(montado en el Mac: servicio `kuma` del `docker-compose.yml`, http://localhost:3098)*: la herramienta open source que vigila todas las webs y **avisa en cuanto una cae**. Ver §0.

1. **Webs y servicios** *(hecho)*: cada URL de un servicio de proyecto (o web suelta) se comprueba por HTTP desde Central: en línea/caída, código, tiempo de respuesta, histórico de 30 días. Ver `src/lib/uptime.ts`.
2. **Servidores** *(hecho, fase 3b)*: el estado de cada VPS donde están desplegados los proyectos, con el mismo enfoque que **CostGuard / infobar** (`/ruta/a/tus/proyectos/Personales/CostGuard/codeia-cost-guard`, guía en su `docs/guia-servidores.md`). **Central es la fuente**: los servidores se dan de alta en Central y CostGuard los lee de `GET /api/servidores` (con `Authorization: Bearer $CENTRAL_API_TOKEN`); no se importa nada de CostGuard. Código en `src/lib/servers/`, scripts del servidor en `remote/`, lectura con `bun run servidores` (tarea del Mac cada minuto).

---

## 0. Uptime Kuma: vigilancia de webs y avisos

### Elección

| Opción | Open source | Por qué sí / no |
|---|---|---|
| **Uptime Kuma 2.x** | Sí (MIT) | **Elegida.** Autoalojada en Docker/Easypanel, panel web cómodo, HTTP/keyword/TCP/ping/DNS/certificado SSL/Docker/push, decenas de canales de aviso (Telegram, correo SMTP, Discord, Slack, ntfy, webhook…), páginas de estado públicas por cliente. La 2.0 trae soporte de MariaDB y Docker sin root. |
| Gatus | Sí | Buena alternativa si se quiere todo por fichero YAML generado desde Central y una API REST de lectura; menos cómoda para gestionar a mano. |
| Better Stack | No (SaaS de pago) | Descartada: no es open source. |

### Dónde se instala

- **Fuera de los servidores que vigila**: si Uptime Kuma vive en el mismo VPS que las webs y ese VPS cae, no avisa. Opciones: un VPS pequeño aparte (otro proveedor o al menos otra máquina) o el Mac en local durante la fase 1 (solo vigila mientras el Mac está encendido).
- Despliegue con la imagen oficial `louislam/uptime-kuma:2` en Easypanel, con su volumen de datos y un dominio tipo `status.iservisat…`.

### Avisos

- Canal principal: **Telegram** (bot propio) para avisos inmediatos; **correo** como respaldo. Opcional: ntfy para notificaciones push en el móvil, webhook a n8n para automatizar (p. ej. abrir una incidencia en Central).
- Aviso al caer y al recuperarse, con reintentos (p. ej. 2 fallos seguidos antes de avisar) para evitar falsas alarmas.
- Aviso de caducidad del certificado SSL (Uptime Kuma lo trae) 14 y 7 días antes.

### Integración con Central

- **Central es la fuente de verdad** de qué se vigila: cada `ProjectService` con URL y "Vigilar", y cada web suelta de Webs.
- **Alta automática de monitores**: al guardar un servicio con URL, Central crea/actualiza el monitor en Uptime Kuma (nombre `Proyecto · servicio`, etiqueta con el cliente y el tipo de web) y guarda su id (`Website.kumaMonitorId`). Uptime Kuma no tiene API REST oficial de escritura; se usa su API de socket.io (como la librería comunitaria `uptime-kuma-api`) desde un pequeño módulo `src/lib/kuma.ts`. Si da problemas, plan B: alta manual en Uptime Kuma y enlace por nombre.
- **Lectura del estado**: Central lee el endpoint `/metrics` (Prometheus, con clave de API de Uptime Kuma) para mostrar en Webs y en la ficha el estado, el tiempo de respuesta y los días de SSL que quedan.
- El comprobador propio de Central (`src/lib/uptime.ts`) se queda como respaldo y para el histórico de la ficha; los **avisos** los manda Uptime Kuma.
- Ajustes de Central guardará la conexión: URL de Uptime Kuma, usuario/clave y clave de API de métricas, cifrados (`IntegrationConnection`, proveedor `UPTIME_KUMA`).
- **Páginas de estado por cliente** (opcional): una página pública de Uptime Kuma con las webs de cada cliente para compartirla.

### Vulnerabilidades y parches de seguridad (monitores push)

- **Qué se audita**: cada proyecto en producción (`AUDIT_WHERE` en `src/lib/audit-import.ts`: despliegue en producción, entorno de producción marcado o algún servicio de producción), desde su carpeta principal, una vez al día con `osv-scanner` (lockfiles de npm/bun/pnpm/yarn, composer, pip, go, cargo, pub; sin carpetas ocultas ni `node_modules`). El framework del escáner se contrasta con endoflife.date: una rama sin soporte cuenta como aviso alto.
- **Dónde se ejecuta**: en el Mac. En local, tarea de launchd diaria (`bun run auditoria`, instalada con `tareas:instalar`). Con Central en producción, el trabajador recibe un trabajo `audit` al día con las rutas, y solo audita las que están dentro de `CENTRAL_WORKER_ROOTS`. Requisito: `brew install osv-scanner`.
- **Qué avisa** (`ALERT_WHERE` en `src/lib/completeness.ts`): vulnerabilidades críticas o altas, no de desarrollo, con versión corregida, ni resueltas ni ignoradas. Entran en Pendientes; la ficha del proyecto las lista todas en «Seguridad», donde se puede ignorar cada una, auditar en el momento o copiar y descargar las abiertas como issue de GitHub en Markdown (`src/lib/audit-markdown.ts`: paquetes a actualizar con casillas, tabla de detalle y pasos para cerrarlo).
- **Uptime Kuma**: `syncKuma()` crea un monitor push por proyecto en producción («Proyecto · dependencias») y por servidor ya leído («Servidor · parches de seguridad», con los `parches_seguridad` de la última lectura). `pushSecurity()` (`src/lib/kuma-push.ts`) envía el estado con cada comprobación de webs (script `uptime` y `/api/cron/uptime`): `down` con el resumen (paquete, versión instalada → versión que lo corrige) o `up`. El monitor espera un envío cada hora, así que también cae si Central deja de enviar; un proyecto sin auditoría en 3 días se pone en rojo. Mientras sigue en rojo, Kuma repite el aviso una vez al día.

---

## 1. Cómo se recoge (modelo infobar, sin agente)

- No se instala ningún agente que envíe datos. Central entra cada pocos minutos por **SSH como el usuario `infobar`** con una clave propia. Esa clave **solo puede ejecutar** `/usr/local/bin/infobar-recoger` (`restrict,command=` en `authorized_keys`).
- `infobar-recoger` (`recoger.sh`) solo lee y devuelve secciones `### nombre`: sistema, memoria, disco, sesiones, puertos, intentos de acceso SSH, actualizaciones y bastionado.
- Lo que necesita root (servicios de Docker/Swarm, contenedores, fail2ban, configuración efectiva de sshd, cortafuegos) lo lee `recoger-root.sh`, único programa permitido con `sudo` y sin argumentos.
- Desde fuera (desde Central) se miden además las webs y **qué puertos se alcanzan de verdad desde Internet**, porque desde dentro no se ve el cortafuegos del proveedor.
- Ritmo: cada 5 min; si un servidor está en ámbar o rojo pasa a **modo incidencia** y se revisa cada minuto.
- Tiempo máximo por recogida: 20 s; lo que no llega completo se marca "sin dato", nunca como cero.

### Reutilizar lo de CostGuard

Se usan **los mismos scripts remotos** de infobar, copiados en `remote/` (`alta-servidor.sh`, `instalar-en-servidor.sh`, `recoger.sh` versión 3, `recoger-root.sh` versión 2, `cerrar-puerto-docker.sh`, `desinstalar-del-servidor.sh`) y el mismo usuario `infobar`. Un servidor ya instalado para CostGuard no hay que reinstalarlo: Central usa la clave `~/.ssh/infobar_ed25519` del Mac y el `known_hosts` normal.

Decidido (opción A): Central implementa en TypeScript el lado del Mac (`src/lib/servers/`: `ssh.ts`, `parse.ts`, `status.ts`, `external.ts`, `collect.ts`, `match.ts`, `register.ts`) con las mismas reglas y umbrales; la especificación de referencia está en `plans/reports/scout-261026-1303-referencia-costguard-servidores.md`. `alta-servidor.sh` registra en Central (`bun scripts/servidores.ts registrar`), no en CostGuard.

Alta: en **Servidores › Dar de alta** (nombre, host, puerto, proveedor, panel). Central lo lee al momento; si la clave del servidor no es de confianza, la ficha muestra la huella para confirmarla, y si `infobar` no está instalado, el comando `remote/alta-servidor.sh` que hay que lanzar en la terminal.

Nunca se copian claves privadas al repo ni a la BD: Central guarda la **ruta** de la clave, no la clave.

---

## 2. Qué se muestra por servidor

| Tarjeta | Verde | Ámbar / rojo |
|---|---|---|
| Webs del servidor | responden en < 1,5 s | lentas / error o 5xx |
| Procesador, memoria, disco | < 80–85 % | > 80–85 % / > 95 % |
| Servicios (Docker/Swarm) | todos con sus réplicas | alguno caído (rojo) |
| Dentro ahora | nadie o IPs conocidas | sesión desde IP desconocida |
| Intentos 1 h | lo normal | pico (> 3× la media) |
| Bloqueadas | fail2ban activo | sin fail2ban |
| Puertos abiertos desde Internet | solo 22, 80, 443 | otro alcanzable (rojo) |
| Protección | 12/12 comprobaciones | lo que falte, con el comando para arreglarlo |
| Mantenimiento | al día | reinicio o parches de seguridad pendientes |

Gris = dato viejo (más de 3 ciclos sin leer), con el motivo (`timeout`, `red`, `autenticacion`, `clave de host no confiada`).

Las 13 comprobaciones de protección (las 12 de la guía más «sin reinicio pendiente», como en el código de CostGuard) y sus arreglos son las de `guia-servidores.md` de CostGuard (SSH sin contraseña, sin login interactivo, root sin contraseña, fail2ban, ufw, solo 22/80/443, parches automáticos, sin parches pendientes, sin reinicio pendiente, sudo con contraseña, solo root con UID 0, NTP).

---

## 3. Relación con proyectos y webs

- Cada **servicio de proyecto** (`ProjectService`) puede indicar en qué **servidor** está desplegado y con qué **panel** (Easypanel, Dokploy, Docker a secas).
- Los **servicios de Docker/Swarm** que reporta el servidor se emparejan con los servicios de proyecto (por nombre de servicio/contenedor o dominio), así la ficha del proyecto muestra: web en línea + contenedor con sus réplicas + estado del servidor donde vive.
- La ficha del servidor lista qué proyectos y webs aloja. Si un servidor cae, Pendientes/Resumen muestran qué proyectos afecta.
- **Uptime por proyecto** = el de sus servicios (web, api, admin…) + el estado del servidor que los aloja.

---

## 3b. Versiones y despliegues

- `recoger-root.sh` versión 4 devuelve, por servicio de Swarm o contenedor, su imagen, sus dominios, su arranque (`StartedAt`, o `UpdatedAt` del servicio de Swarm) y la versión de su imagen (`org.opencontainers.image.version`). La ficha del servidor ofrece «Actualizar» si tiene una versión anterior; se instala desde Central con usuario y contraseña (no se guarda) o desde `remote/alta-servidor.sh`.
- **Despliegue** (`Deployment`): si el arranque de un contenedor cambia entre dos lecturas, Central guarda fecha, imagen, versión anterior y nueva, y lee al momento la versión de su servicio. Se ven en las fichas del proyecto y del servidor (se guardan un año).
- **Versión de cada servicio** (`src/lib/deploy-version.ts`): la ruta de versión de su web (la escrita o una encontrada sola entre `/api/version`, `/version`, `/api/health`, `/health`, `/version.json`, `/api/status`, como mucho una vez al día), si no la versión de la imagen de su contenedor, y si no la etiqueta de la imagen cuando parece una versión. Se lee en cada comprobación de webs, tras cada despliegue y al enlazar un contenedor; la del servicio de producción es `Project.deployedVersion`.

## 4. Modelo de datos previsto

| Modelo | Campos principales |
|---|---|
| `Server` | nombre, host, puerto SSH, usuario de recogida (`infobar`), usuario admin (para el botón Terminal), ruta de la clave, proveedor (Hetzner, Contabo, Scaleway…), panel (`easypanel`/`dokploy`/`docker`) y su URL, IPs conocidas, intervalos normal/incidencia, último estado y error |
| `ServerSample` | serverId, fecha, CPU, memoria, disco, carga, servicios ok/total, sesiones, intentos, puertos expuestos, estado global, JSON de secciones |
| `ServerCheck` | serverId, comprobación de protección, ok/no, detalle, fecha |
| `ServerContainer` | serverId, nombre del servicio/contenedor, réplicas deseadas/actuales, imagen, enlace opcional a `ProjectService` |
| `ServerAttackIp` | serverId, IP, intentos, primera/última vez (como `ips_atacantes` de CostGuard) |
| `ProjectService.serverId` | dónde está desplegado cada servicio |

Retención: muestras detalladas 7 días, agregados por hora 90 días (igual que el histórico de CostGuard).

---

## 5. Avisos

- Servidor en rojo o gris → aviso en Resumen y en la navegación, con los proyectos afectados.
- Protección incompleta → aparece en **Pendientes** del servidor con el comando para arreglarlo.
- Web caída o lenta → aviso en Resumen *(hecho para caídas)*.
- **Centro de alertas** (`src/lib/alerts.ts`, calculado al momento, sin tabla propia): campana en la navegación con el número y las más graves, y `/alertas` con todas en una tabla filtrable por tipo. Críticas: web caída, certificado a ≤ 3 días, servidor en rojo (con el motivo: puertos de más, servicios caídos, CPU/memoria/disco, protección crítica) o sin datos, vulnerabilidad crítica por actualizar. Avisos: web lenta (> 1500 ms), certificado a ≤ 14 días, protección incompleta, reinicio pendiente, parches de seguridad, vulnerabilidad alta, auditoría fallida o con más de 3 días.
- Notificaciones fuera de Central: Uptime Kuma (webs, dependencias y parches de seguridad; ver §0).

## 6. MCP

Hechas: `list_servers` (estado de cada uno), `get_server` (tarjetas, protección, servicios, proyectos que aloja) y `get_project_health` (webs, contenedor y servidor de cada servicio de un proyecto). Ver `MCP.md`.
