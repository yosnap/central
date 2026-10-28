# Integraciones

Cómo se conecta Central con cada servicio. Dos niveles:

- **Ajustes** (`/ajustes`): las cuentas y credenciales que sirven a muchos proyectos — usuario de sn4p.dev, claves de API de YouTube y Bunny, canales de vídeo y a qué proyectos van. *(hecho)*
- **Ficha del proyecto**: lo propio de cada proyecto — su propiedad de Search Console y GA4 (con qué cuenta), su página de Meta, sus vídeos. Se configura al darlo de alta o completarlo.

Todo secreto se guarda cifrado (`IntegrationConnection.secret`, AES-256-GCM).

---

## 1. Portfolio: sn4p.dev

El portfolio es **sn4p.dev** (Astro + Hono + Drizzle/SQLite, en su propio repositorio). Documentación de su API: `docs/api-endpoints.md` de ese repo; Swagger en `https://sn4p.dev/api/docs`.

### Autenticación

- `POST /api/admin/login` con `{ username, password }` → `accessToken` (15 min) y `refreshToken` (7 días).
- `POST /api/admin/refresh` con `{ refreshToken }` para renovar.
- Credenciales en **Ajustes › Portfolio · sn4p.dev** (URL, usuario y contraseña cifrada), con botón *Probar conexión*. Las variables `SN4P_*` de `.env.example` quedan solo como alternativa. *(hecho: `src/lib/sn4p.ts`)*

### Envío de un proyecto

1. Subir cada imagen: `POST /api/uploads/image` (multipart, campo `file`) → `{ url: "/uploads/images/AAAA/MM/fichero" }`. Las miniaturas viven en SeaweedFS local (§4), así que se suben a sn4p.dev en el momento de publicar.
2. Crear: `POST /api/portfolio` 🔒 o actualizar: `PUT /api/portfolio/:id` 🔒.

Mapeo desde Central:

| sn4p.dev | Central |
|---|---|
| `titleEs` / `titleEn` | `PortfolioEntry.titleEs` / `titleEn` (por defecto, nombre del proyecto) |
| `descriptionEs` / `descriptionEn` | `PortfolioEntry.descriptionEs` / `descriptionEn` |
| `technologies` (array) | `Project.stack` (editable en la entrada) |
| `images` (array de URL) | `ProjectAsset` de tipo miniatura/captura marcados "para portfolio", ya subidos |
| `linkDemo` | servicio web de producción o `ProjectLink` tipo demo |
| `linkGithub` | `Project.repoUrl` solo si el repo es público |
| `linkCaseStudy` | `ProjectLink` tipo caso de estudio |
| `category` (`web`, `mobile`, `desktop`, `ai`, `other`) | derivado de `Project.type` (SaaS/web/e-commerce → `web`, app móvil → `mobile`, escritorio → `desktop`, MCP/agentes → `ai`, resto → `other`), editable |
| `status` (`completed`, `in_progress`, `planned`) | derivado de `deployStatus` + fase, editable |
| `featured`, `orderIndex` | `PortfolioEntry.featured`, `order` |

Central guarda el `id` que devuelve sn4p.dev en `PortfolioEntry.externalId` para actualizar en lugar de duplicar. Nada se envía sin el permiso del cliente marcado.

---

## 2. Google: Search Console y Analytics (por proyecto)

- En la ficha del proyecto, bloque **Tráfico y SEO**: botón *Conectar con Google*. El OAuth pide los permisos de Search Console (`webmasters.readonly`) y Analytics (`analytics.readonly`).
- Tras conectar se elige **la propiedad** de Search Console y **la propiedad de GA4** que corresponden a cada web del proyecto.
- Se guarda **con qué cuenta de Google** se conectó (`IntegrationConnection.account`), porque distintos proyectos pueden usar cuentas distintas (la tuya, la del cliente, la de Captaru…).
- Una tarea diaria guarda las métricas en `AnalyticsSnapshot`; la ficha muestra los últimos 28 días frente a los 28 anteriores sin llamar a Google en cada visita.

---

## 2b. Google: correo y agenda *(hecho)*

- **Cliente OAuth** de Google Cloud (tipo «Aplicación web», URI de redirección `<origen>/api/google/callback`): el ID y el secreto se pegan en Ajustes › Google y se guardan cifrados (`IntegrationConnection` `GOOGLE_APP`). Ajustes muestra los pasos.
- **Cuentas**: cada cuenta conectada (Sn4p, iServisat, Codeia…) es una `IntegrationConnection` `GOOGLE` con su correo, los tokens cifrados (se renuevan solos) y los calendarios elegidos con el nombre con que se ven (`config.calendars`). Permisos: `gmail.readonly`, `calendar.readonly`, `calendar.events`.
- **Correo** (`/correo`): búsqueda con la sintaxis de Gmail en todas las cuentas, lectura del mensaje y «Guardar» ligado a cliente o proyecto (sugerido por el remitente). Central nunca envía correo.
- **Agenda** (`/agenda`): eventos de los calendarios elegidos agrupados por día, crear eventos y ligarlos a cliente o proyecto (sugerido por los asistentes).
- Mientras la app de Google esté «en pruebas», Google caduca el permiso a los 7 días: publícala (uso propio, sin verificación) o usa el tipo «Interno» si todas las cuentas son del mismo Workspace.
- Código: `src/lib/google.ts` (OAuth, Gmail y Calendar con fetch, sin librerías), `src/lib/agenda.ts`.

## 3. Vídeos y marketing

### Canales (Ajustes) *(hecho)*

- **Claves de API**: una o varias de YouTube Data API v3 y de Bunny Stream.
- **Canales**: canal de YouTube (id `UC…`) o biblioteca de Bunny, con su clave.
- **Conexión canal → proyectos**: cada canal se conecta a uno o varios proyectos, con propósito (demostración, venta, marketing, tutorial) y un filtro opcional por texto en el título (para un canal compartido como el de CodeIA).
- **Sincronizar** (botón, `bun run videos:sync` o `GET /api/cron/videos?token=…`): lee los vídeos del canal y los añade a la ficha de cada proyecto conectado. Código: `src/lib/videos.ts`.

### Dónde están los vídeos

Cada proyecto lista sus vídeos con **origen**, **propósito** y enlace:

- **Origen**: YouTube (canal de CodeIA u otro canal; se guarda el canal), Bunny Stream (biblioteca y enlace), fichero en SeaweedFS, otro enlace.
- **Propósito**: demostración, venta, marketing, tutorial.
- Se generan con varias herramientas (skill de vídeos, repositorio `fabrica-videos`, HyperFrames). Central no los genera: guarda dónde están y, para YouTube, puede leer los vídeos del canal (YouTube Data API) para enlazarlos al proyecto.
- Algunos vídeos se suben solos a YouTube: Central los recoge al sincronizar el canal y los propone para el proyecto que corresponda.

### Marketing (Meta)

- Proyectos con acciones de marketing (p. ej. Bloom Marbella) tienen un bloque **Marketing**.
- Se conecta la página de Facebook / cuenta de Instagram (Meta Graph API) **desde la ficha del proyecto**.
- Central guarda **solo las analíticas**: publicaciones, alcance, impresiones, interacciones, reproducciones de vídeo, seguidores, por fecha. No guarda los vídeos publicados ni su contenido.
- Histórico diario en `SocialSnapshot` para ver la evolución.

---

## 4. Almacenamiento: SeaweedFS (compatible con S3)

- Miniaturas, capturas y ficheros subidos se guardan en **SeaweedFS** con su API S3, en local (servicio `storage` de `docker-compose.yml`, puerto `8334` en el host).
- Bucket `central`; claves `projects/<projectId>/thumbnails/<fecha>-desktop.webp`, `…-mobile.webp`, `projects/<projectId>/assets/<fichero>`.
- Cliente: `@aws-sdk/client-s3` con `forcePathStyle: true` y `S3_ENDPOINT=http://localhost:8334`.
- En producción se puede apuntar a otro SeaweedFS o a cualquier S3 cambiando solo las variables.

Variables: `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_URL`.

---

## 5. Repositorios: GitHub y GitLab

- GitHub: token personal guardado en Ajustes o, si no hay, la sesión de `gh` del Mac (se pide en el momento; no se guarda). Hecho en la fase 2 (`src/lib/repo-sync.ts`). GitLab: token por instancia (gitlab.com, GitLab de Blocknovas…). Gitea/autoalojados (p. ej. `git.rcassociats.com`): token si tienen API, si no solo `git fetch`.
- Se configura una vez por proveedor/instancia y cada `RepoRemote` usa la suya según el host.

---

## 6. Tokens y secretos

Todos los tokens (Google, Meta, YouTube, GitHub, GitLab, Bunny, sn4p.dev) se guardan cifrados con AES-256-GCM (`CENTRAL_ENCRYPTION_KEY`) en `IntegrationConnection`. Nunca en logs ni en respuestas del MCP.
