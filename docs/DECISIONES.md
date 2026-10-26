# Decisiones

## 2026-10-25 · App propia desde cero, no sobre CRMDev
CRMDev es un SaaS multi-tenant con Stripe. Central es monousuario y personal; se reutilizan ideas, no código.

## 2026-10-25 · Uptime propio en lugar de Screpy
Screpy limita proyectos por plan. Un `fetch` periódico cubre disponibilidad y tiempo de respuesta sin límite. Screpy queda para SEO.

## 2026-10-25 · Escáner como CLI en el Mac
Las carpetas están en el disco local (`/Volumes/<disco>`). El servidor en Hetzner no las ve; el CLI escribe en la BD que indique `DATABASE_URL`.

## 2026-10-25 · Sesión monousuario con cookie firmada
Sin proveedor de auth: contraseña en entorno + HMAC. Si se necesita 2FA o más usuarios, migrar a Better Auth.

## 2026-10-25 · Prisma 7 con generador `prisma-client`
Cliente generado en `src/generated/prisma` (ignorado en git) y adaptador `@prisma/adapter-pg`, sin motor binario de consultas.

## 2026-10-25 · Datos de despliegue en la base de datos, no en un fichero por proyecto
Se descartó un `central.json` en cada repo. Despliegue, hosting y dominios se editan en el formulario de la ficha y se guardan en `Project` / `ProjectService`. El CRM avisa de lo que falta (`src/lib/completeness.ts`).

## 2026-10-25 · Primera fase en local
Postgres en Docker y Central en el Mac, con acceso directo a las carpetas. La subida a producción se hará empujando datos desde el Mac con un token, no abriendo un túnel.

## 2026-10-25 · Tipo de proyecto separado de "para quién"
`kind` dice para quién (cliente, propio, formación, experimento); `type` dirá qué es (web, SaaS, addon, plugin…). Pertenencia a un sistema propio (`parentId`) y a una plataforma externa (`platform`) son relaciones distintas.

## 2026-10-25 · Métricas por web, no por proyecto
Search Console, GA4 y uptime cuelgan de `Website`, porque un proyecto puede tener varias webs. La ficha del proyecto las agrega.

## 2026-10-25 · Las integraciones se conectan desde la ficha del proyecto
Search Console, GA4, Meta y los vídeos se conectan al dar de alta o completar un proyecto, y se guarda con qué cuenta. No hay un paso de configuración global previo.

## 2026-10-25 · Portfolio = sn4p.dev por API
Central publica en sn4p.dev con `POST/PUT /api/portfolio` y sube las imágenes con `POST /api/uploads/image`. Guarda el id remoto para no duplicar.

## 2026-10-25 · Vídeos: Central registra, no genera
Los vídeos se hacen con otras herramientas. Central guarda origen (YouTube y canal, Bunny, S3, enlace) y propósito. De Meta solo se guardan analíticas.

## 2026-10-25 · Almacenamiento en SeaweedFS con API S3
Miniaturas y ficheros en SeaweedFS local (S3). El código usa el SDK de S3, así que cambiar de proveedor es cambiar variables.

## 2026-10-25 · Ajustes para cuentas compartidas, ficha para lo propio del proyecto
Las credenciales y canales que sirven a varios proyectos (sn4p.dev, YouTube, Bunny) se gestionan en `/ajustes`; cada canal se conecta a sus proyectos y sus vídeos aparecen en ellos. Lo específico de un proyecto (propiedades de Google, página de Meta) se conecta desde su ficha. Las credenciales no van en `.env` sino cifradas en la BD.

## 2026-10-25 · Servidores con el modelo de CostGuard / infobar
La vigilancia de servidores reutiliza el enfoque ya probado en CostGuard: SSH con el usuario `infobar` limitado a un script de solo lectura, sin agente, mismos scripts remotos y mismo formato de secciones, para que un servidor dado de alta en CostGuard sirva también para Central. Central guarda la ruta de la clave, nunca la clave.

## 2026-10-25 · Uptime Kuma para vigilar webs y avisar
Herramienta open source elegida para el uptime y las notificaciones (Telegram + correo). Better Stack se descarta por no ser open source; Gatus queda como alternativa. Se instala fuera de los servidores que vigila. Central sigue siendo la fuente de verdad de qué URLs se vigilan y crea los monitores en Uptime Kuma; el comprobador propio queda como respaldo e histórico. Sustituye en parte a la decisión anterior "Uptime propio en lugar de Screpy": el propio no envía avisos.

## 2026-10-25 · Bun como runtime y gestor de paquetes
Central usa Bun: `bun install` (lockfile `bun.lock`), `bun run` para los scripts, `bunx` para las CLIs y `bun` para ejecutar TypeScript directamente (se quita tsx). `build` y `start` usan `bun --bun next …`; el servidor de desarrollo corre sobre Node (`next dev -p 3099`) porque con `--bun` Bun no resuelve los paquetes externos con hash que Turbopack genera para `@prisma/client` y la app da error 500. Next sigue usando su propio empaquetador (Turbopack) para la web. La imagen Docker parte de `oven/bun`. Bun carga `.env` solo; `dotenv` se mantiene para la CLI de Prisma.

## 2026-10-25 · Puerto 3099 y SeaweedFS en 8334
Central se lanza en local en el puerto 3099 (`bun run dev`), reservado para ella. SeaweedFS publica su API S3 en el 8334 del Mac y el panel en el 9334, porque el 8333 y el 9333 los usa otro proyecto.

## 2026-10-25 · Secretos de proyecto cifrados y con desbloqueo
Cada proyecto guarda sus secretos por entorno (`ProjectSecret`) y copias de su fichero de variables (`EnvBackup`). Valores y copias van cifrados con AES-256-GCM (`encryptJson`, clave `CENTRAL_ENCRYPTION_KEY` fuera de la BD); solo los nombres de las variables van en claro para poder listarlos. Ver, copiar, descargar o restaurar exige volver a escribir la contraseña de Central y queda desbloqueado 15 minutos (cookie `central_unlock`, httpOnly, firmada). El fichero se importa siempre a mano en el navegador: el escáner sigue sin leerlo nunca. El MCP no expone secretos. Restaurar o sustituir guarda antes una copia de lo que había.

## 2026-10-25 · Tareas del Mac con launchd y versión en producción por ruta
Mientras Central viva en local, el escaneo (cada hora) y la comprobación de webs (cada 10 minutos) los lanza `launchd` en el Mac (`scripts/tareas-mac.sh`, `ProcessType` estándar: con prioridad de segundo plano el escaneo tardaba más de 5 minutos). En producción, el uptime pasa al cron HTTP; el escaneo sigue siendo cosa del Mac. La versión en producción se lee de una ruta de versión opcional de cada servicio (`/version`, `/api/health`…) en cada comprobación de uptime; si el servicio es de producción, rellena `deployedVersion`. Funciona con cualquier hosting y no depende de la fase de servidores. Central expone la suya en `/api/version`.

## 2026-10-25 · Identidad del proyecto: remoto y, si cambia, carpeta principal
El escáner identifica un proyecto por su remoto normalizado y, si no lo encuentra, por la ruta de su carpeta principal. Así un repositorio movido de titular u organización conserva su ficha (cliente, servicios, secretos) en lugar de duplicarse.

## 2026-10-25 · El escáner propone, el usuario confirma (tipo, plataforma, dominios)
El tipo, la plataforma y los dominios que deduce el escáner se guardan aparte (`suggested*`) y se recalculan en cada escaneo; lo confirmado (`type`, `platform`, `parentId`, servicios) solo lo cambia el usuario. Los dominios nunca se dan de alta solos. Addons, plugins y contenido no se despliegan por sí mismos: no se les pide despliegue, y los plugins registran instalaciones en lugar de dominios.

## 2026-10-25 · Repositorios: git fetch sin preguntas y GitHub con la sesión de gh
El estado frente a origin se calcula con git local; `git fetch` corre sin pedir nunca credenciales y solo actualiza referencias remotas. Se lanza a mano desde la ficha y cada hora para los proyectos con actividad en los últimos 6 meses (unos 90 s). Para la API de GitHub se usa el token de Ajustes o, si no hay, la sesión de `gh` del Mac, sin guardarlo; GitLab y Gitea necesitan token por instancia, cifrado. «Sin subir» cuenta commits que no están en ningún remoto (sin duplicar por ramas).

## 2026-10-25 · Excluir en lugar de borrar proyectos
Un proyecto que no interesa (pruebas, experimentos) se excluye: sigue en la BD con `excluded`, el escáner lo actualiza sin volver a incluirlo y no cuenta en ningún listado, aviso ni en el MCP. Borrarlo no sirve porque el siguiente escaneo lo recrearía desde su carpeta. Las carpetas raíz guardadas (`ScanRoot`), que se gestionan en Ajustes, mandan sobre `SCAN_ROOTS`.

## 2026-10-26 · Presupuestos por fases o paquetes, y asistente con Claude Code del Mac
Los presupuestos no se cobran por horas: el desglose son fases, hitos o paquetes con precio fijo o variable (`unitPrice` como «desde» y `priceMax` como «hasta»), y el total sale en rango si hay alguno variable. La forma de pago son hitos con % del total (`QuotePhase`). El asistente de la ficha usa Claude Code del Mac (`claude -p` con la suscripción, modelo Opus, salida JSON validada con su esquema y con Zod) en lugar de la API: sin clave ni coste por uso, a cambio de que solo funcione con Central en este Mac. Se ejecuta en modo restringido, solo con la herramienta Read y sin MCP, en la carpeta del presupuesto (`storage/quotes/<id>`), y sigue la conversación con `--resume`. Sus criterios de precio son `BrandSettings.pricingGuide` (Ajustes) más los últimos presupuestos de Central. PDF y Word salen del mismo contenido (`src/lib/quote-doc.ts`).

## 2026-10-26 · Correo y agenda solo con Google, por OAuth propio y sin librerías
El correo y la agenda se conectan con Google (Gmail, Workspace y Calendar), que es donde están las cuentas Sn4p, iServisat y Codeia; Microsoft 365 e IMAP quedan fuera hasta que hagan falta. El cliente OAuth lo crea Paulo en su Google Cloud y se pega en Ajustes (cifrado), en lugar de ir en `.env`, para poder conectar varias cuentas desde la interfaz. Las llamadas van con `fetch` contra las APIs REST (sin `googleapis`). El correo es de solo lectura: Central busca y guarda copias de los mensajes importantes ligados a cliente o proyecto, nunca envía. En la agenda sí crea eventos.
