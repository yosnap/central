# API v1 para apps conectadas

API HTTP JSON para que otras apps, como AgoraOne, lean Central sin su código ni su base de datos y, con el permiso
`escritura`, creen y cambien clientes, notas, proyectos y fases de presupuestos (nunca borran). Vive en `src/app/api/v1/`; la lógica de cada consulta está en
`src/lib/api/` y la comparte con el MCP (`src/mcp/server.ts`), así que los dos devuelven lo mismo.

## Claves y permisos

Las claves se crean en **Ajustes → Apps conectadas**: un nombre (la app) y uno o varios permisos.

| Permiso | Qué permite |
|---|---|
| `lectura` | Clientes, proyectos, webs, servidores, alertas, pendientes y agenda |
| `presupuestos` | Presupuestos (ver, PDF, Word y crear borradores) y tarifas |
| `escritura` | Crear y cambiar clientes, notas, estado y fase de proyectos y, junto con `presupuestos`, el estado y la fecha de las fases de un presupuesto. Nunca borrar. **Implica `lectura`**: al crear la clave se le añade, y las rutas de escritura exigen las dos |

Fuera de eso, los permisos no se heredan: una clave con solo `presupuestos` no lee clientes. `escritura` lleva
`lectura` porque una escritura devuelve la entidad (y, si hay conflicto, la actual): sin ella serviría para leer.

- La clave completa (`cen_` y 43 caracteres) **solo se ve una vez**, al crearla. Central guarda su SHA-256 y los
  12 primeros caracteres para reconocerla en la lista; la comparación es en tiempo constante.
- Revocar una clave la invalida al momento. No se borra: queda en la lista como «Revocada».
- Cada uso actualiza «Último uso» (como mucho una vez por minuto).
- Límite: 120 peticiones por minuto y clave, sumando todas las rutas (en memoria del proceso: con varias réplicas,
  cada una cuenta aparte). Pasado, `429` con `Retry-After`.
- Central nunca registra la cabecera `Authorization` ni la clave.

Cada petición lleva la cabecera `Authorization: Bearer <clave>`. `src/proxy.ts` deja pasar `/api/v1/` sin la
cookie de sesión porque cada ruta exige su clave (`src/lib/api/auth.ts`).

## Respuestas

JSON con `cache-control: no-store` y fechas en ISO 8601 (UTC). Importes de presupuestos en euros.
Nunca incluyen IPs, direcciones SSH, rutas de clave, tokens ni secretos (`src/lib/api/scrub.ts`):

- Toda respuesta JSON pasa por `scrubDeep`: un valor que es una dirección con una IP (`203.0.113.7:3000`,
  `http://[2001:db8::1]`, `https://web.203.0.113.7.sslip.io`, y también las formas abreviadas, decimales u
  hexadecimales como `127.1`, `http://2130706433/`, `0x7f.0.0.1` o `10.1:22`) sale como `null` (en una lista,
  desaparece). Un valor sin esquema ni `.`, `:` o `[` (un teléfono, un NIF, un código postal) se deja tal cual y una IP en un
  texto se cambia por `[IP oculta]`. Los campos de versión no se tocan.
- Servidores y alertas, además, sin `host`, `sshPort` ni `panelUrl`, y con las rutas de usuario o de clave
  (`~/…`, `/Users/…`, `/home/…`, `/root/…`, `.ssh/…`, `id_ed25519`, `*.pem`) cambiadas por `[ruta oculta]`.
- Los errores de lectura de un calendario de Google salen como «No se ha podido leer el calendario «X»»; el detalle
  queda en el registro del servidor.

| Código | Cuándo | Cuerpo |
|---|---|---|
| `401` | Sin clave, con una clave desconocida o revocada | `{ "error": "unauthorized" }` |
| `403` | La clave no tiene el permiso de la ruta | `{ "error": "forbidden", "scope": "presupuestos" }` |
| `400` | Parámetros no válidos; cuerpo que no es JSON o pasa de 256 KiB | `{ "error": "invalid", "detail": "…" }` |
| `404` | No existe | `{ "error": "not_found" }` (en escrituras, con `detail`) |
| `422` | Escrituras: cuerpo JSON que no cumple el esquema (campo desconocido, tipo, tope, fecha imposible, sin `version`). `POST presupuestos` con un cliente que no existe | `{ "error": "invalid", "detail": "campo: motivo; …" }` |
| `409` | Escrituras: la `version` no es la actual (`conflict`), nombre de cliente repetido (`duplicate`) o estado fijado a mano (`status_locked`) | `{ "error": "conflict", "detail": "…", "current": { … } }` |
| `409` | `POST presupuestos` choca varias veces con otra alta por el número (muy raro): reintenta | `{ "error": "invalid", "detail": "…" }` |
| `405` | Un método que la ruta no tiene (no hay ningún `DELETE`) | vacío |
| `503` | Escrituras: la BD está ocupada (tiempo de espera o conflicto de la transacción, P2024/P2028/P2034). Con `Retry-After`; repetir la petición con la misma `version` es seguro | `{ "error": "busy", "detail": "…" }` |
| `429` | Límite superado | `{ "error": "rate_limited" }` |
| `500` | Fallo interno (sin detalles) | `{ "error": "internal" }` |

## Rutas

| Ruta | Permiso | Devuelve |
|---|---|---|
| `GET /api/v1/estado` | cualquiera | `{ version, api, scopes, runtime }` (`runtime`: `production` o `local`) |
| `GET /api/v1/clientes` | lectura | `{ clients }`: contacto (correo, teléfono, NIF, dirección), número de proyectos y webs, y `version` |
| `GET /api/v1/clientes/{id}` | lectura | Ficha: contacto, proyectos, webs, últimas 20 notas y `version` |
| `POST /api/v1/clientes` | escritura | Alta: `201 { client }` |
| `PATCH /api/v1/clientes/{id}` | escritura | Cambia sus datos: `{ client }` |
| `POST /api/v1/notas` | escritura | Nota en un cliente, un proyecto o una web: `201 { note }` |
| `GET /api/v1/proyectos` | lectura | `{ projects, nextCursor }`, del más al menos activo (los que no tienen actividad, primero; el id desempata). Un cursor que ya no está en la lista da 400. Filtros: `estado` (ACTIVE, MAINTENANCE, DORMANT, ARCHIVED), `tipo` (CLIENT, OWN, TRAINING, EXPERIMENT), `cliente`, `q`, `cursor`, `limite` (1–200, 50 por defecto) |
| `GET /api/v1/proyectos/{id}` | lectura | Ficha: repositorio, ubicaciones, servicios, webs, últimas notas, `version` (del software) y `editVersion` (la huella que `PATCH` pide como `version`) |
| `PATCH /api/v1/proyectos/{id}` | escritura | Cambia estado, `statusLocked` y fase: `{ project }` |
| `GET /api/v1/webs` | lectura | `{ websites }`. Filtros: `tipo` (CLIENT, OWN, CENTRAL), `caidas=1` |
| `GET /api/v1/servidores` | lectura | `{ servers }`: estado, CPU, memoria, disco, servicios, protección y proyectos |
| `GET /api/v1/servidores/{id}` | lectura | Ficha: tarjetas, comprobaciones, contenedores, dominios y proyectos |
| `GET /api/v1/alertas` | lectura | `{ alerts }`: abiertas, primero las críticas |
| `GET /api/v1/pendientes` | lectura | `{ pending }`: proyectos a los que les falta información y qué |
| `GET /api/v1/agenda` | lectura | `{ events, errors? }`. `desde`, `hasta` (AAAA-MM-DD, días de Europe/Madrid, ambos incluidos, como mucho 62), `cliente`; por defecto, 14 días desde ahora. Un día que no existe (2026-02-31) da 400 |
| `GET /api/v1/presupuestos` | presupuestos | `{ quotes }`. Filtros: `cliente`, `estado` (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED) |
| `GET /api/v1/presupuestos/{id}` | presupuestos | Presupuesto completo por id o número (`P-2026-001`); cada fase con su `id` y `version` |
| `PATCH /api/v1/presupuestos/{id}/fases/{faseId}` | escritura y presupuestos | Estado y fecha prevista de una fase: `{ phase }` |
| `GET /api/v1/presupuestos/{id}/pdf` | presupuestos | PDF por id o número; con `?descargar=1`, como adjunto |
| `GET /api/v1/presupuestos/{id}/docx` | presupuestos | Word editable, por id o número |
| `POST /api/v1/presupuestos` | presupuestos | Crea un **borrador** con el siguiente número del año: `201 { id, number, status: "DRAFT" }` |
| `GET /api/v1/tarifas` | presupuestos | `{ rates }`: tarifas en uso, precio sin IVA en euros |

`POST /api/v1/presupuestos` usa el mismo esquema que la herramienta `create_quote` del MCP
(`createQuoteSchema` en `src/lib/api/quotes.ts`): `client` (id o nombre exacto), `title`, `items`
(`description`, `unitPrice`, opcionales `priceMax`, `quantity`, `unit`, `details`) y, opcionales, `phases`,
`scope`, `includes`, `excludes`, `assumptions`, `thirdPartyCosts`, `schedule`, `vat`, `notes` y `validDays`.
Topes: importes y cantidades entre 0 y 99.999.999,99 (`Decimal(10,2)`), `priceMax` no menor que `unitPrice`, hasta
100 partidas, 50 hitos, 50 líneas por lista (1000 caracteres cada una) y 50 entradas de cronograma; el cuerpo, hasta
256 KiB. Lo que se pasa da 400. El número se reserva con un cerrojo de Postgres dentro de la transacción, así que altas
simultáneas por la API reciben números distintos; si aun así choca con un alta de la web, se repite con el siguiente.
Nunca envía el presupuesto ni cambia su estado.

## Escrituras

Para que una app cambie Central solo después de que el usuario vea el cambio exacto y lo confirme, y sin pisar lo
que otro haya cambiado mientras tanto:

- **Solo crear y cambiar.** No hay ningún `DELETE` ni nada que borre o archive de golpe (un `DELETE` da 405). Las
  notas solo se crean.
- **Versión obligatoria** en cada `PATCH`: la `version` que dio la última lectura (`GET` de la ficha, de la lista
  de clientes o del presupuesto, en cada fase). Es una huella de los campos que se editan a mano, no de
  `updatedAt`, así que el escáner o una comprobación de uptime no la cambian. Si alguien cambió algo de eso entre la
  lectura y la escritura (en la web, el MCP u otra app), `409 conflict` con la entidad actual en `current`, sin
  tocar nada: la app la vuelve a enseñar y el usuario confirma otra vez. La comprobación y la escritura van en una
  transacción con la fila bloqueada (`SELECT … FOR UPDATE`): de varios cambios simultáneos con la misma versión,
  gana uno y el resto recibe 409.
- **Validación estricta** (Zod, `src/lib/api/mutations/`), la misma que usa la web: campos desconocidos, tipos,
  topes de longitud y fechas imposibles dan 422 con el detalle de cada campo. `null` o `""` vacían un campo opcional.
- **Respuesta limpia**: la entidad tal como queda, con su nueva `version` (sin tokens ni IPs, como todas).
- **Registro**: cada escritura deja una fila en `ApiChange` con la fecha, la clave y el nombre de la app, la acción,
  la entidad y los **nombres** de los campos que cambiaron. Nunca guarda valores (ni antes ni después) ni el texto de
  una nota, así que no retiene datos personales. Un `PATCH` que no cambia nada no escribe ni registra.

| Ruta | Cuerpo |
|---|---|
| `POST clientes` | `name` (obligatorio, hasta 120, único sin distinguir mayúsculas: si ya existe, 409 `duplicate`); opcionales `company` (160), `email` (200, válido), `phone` (40), `taxId` (30), `address` (500) |
| `PATCH clientes/{id}` | `version` y al menos uno de los campos de arriba |
| `POST notas` | `body` (1–5000) y exactamente uno de `clientId`, `projectId` o `websiteId`; queda con `source: "api"`. Un destino que no existe, o un proyecto excluido, da 404 |
| `PATCH proyectos/{id}` | `version` y al menos uno de `status` (ACTIVE, MAINTENANCE o DORMANT; ARCHIVED da 422), `statusLocked` (solo `true`; `false` da 422) y `phase` (texto libre, hasta 80, o `null`). Un proyecto excluido da 404 |
| `PATCH presupuestos/{id}/fases/{faseId}` | `version` y al menos uno de `status` (PENDING, IN_PROGRESS, DONE, INVOICED) y `dueDate` (AAAA-MM-DD o `null`). Al pasar a DONE o INVOICED se apunta `completedAt` (de hecha a facturada se conserva); al volver atrás, se borra. La fase tiene que ser de ese presupuesto (id o número); si no, 404 |

**Estado fijado a mano.** El escáner recalcula el estado de un proyecto en cada pasada salvo que tenga
`statusLocked`. Si el proyecto lo tiene y el `PATCH` cambia `status` sin decir nada de `statusLocked`, responde
`409 status_locked` y no cambia nada: la app debe enseñar que está fijado y mandar `statusLocked: true` (sigue fijado
con el estado nuevo). Sin fijar, el estado nuevo puede cambiarlo el siguiente escaneo; para que se quede,
`statusLocked: true`, como la casilla de la ficha.

**Archivar y quitar el fijado solo en Central.** Por la API no se archiva: `status: "ARCHIVED"` da 422 («Archivar se
hace en Central»), porque archivar saca el proyecto de auditorías y alertas y, en la siguiente sincronización, borra su
monitor de Uptime Kuma con su historial. Tampoco se quita el estado fijado: `statusLocked: false` da 422, porque sin él
el escáner lo recalcula y puede dejarlo archivado (por ejemplo, si su carpeta principal es una copia de seguridad) sin
que nadie lo vea. Un proyecto ya archivado sí se puede volver a activar por la API.

## Ejemplos

Guarda la clave en una variable de tu terminal (no en ficheros del repo):

```bash
export CENTRAL_URL=http://localhost:3099          # o https://central.sn4p.dev
read -rs CENTRAL_KEY && export CENTRAL_KEY        # pega la clave y pulsa Intro

curl -fsS -H "Authorization: Bearer $CENTRAL_KEY" "$CENTRAL_URL/api/v1/estado"
curl -fsS -H "Authorization: Bearer $CENTRAL_KEY" "$CENTRAL_URL/api/v1/clientes"
curl -fsS -H "Authorization: Bearer $CENTRAL_KEY" "$CENTRAL_URL/api/v1/proyectos?estado=ACTIVE&limite=20"
curl -fsS -H "Authorization: Bearer $CENTRAL_KEY" "$CENTRAL_URL/api/v1/agenda?desde=2026-11-18&hasta=2026-11-30"
curl -fsS -H "Authorization: Bearer $CENTRAL_KEY" -o presupuesto.pdf "$CENTRAL_URL/api/v1/presupuestos/<id>/pdf"

curl -fsS -X POST -H "Authorization: Bearer $CENTRAL_KEY" -H 'content-type: application/json' \
  -d '{"client":"Cliente de ejemplo","title":"Web corporativa","items":[{"description":"Diseño y desarrollo","unitPrice":1800}]}' \
  "$CENTRAL_URL/api/v1/presupuestos"

# escrituras (clave con lectura y escritura): leer la versión y mandarla con el cambio
curl -fsS -X POST -H "Authorization: Bearer $CENTRAL_KEY" -H 'content-type: application/json' \
  -d '{"name":"Cliente de ejemplo","email":"hola@ejemplo.es"}' "$CENTRAL_URL/api/v1/clientes"
curl -fsS -X PATCH -H "Authorization: Bearer $CENTRAL_KEY" -H 'content-type: application/json' \
  -d '{"version":"<version>","phone":"600 000 000"}' "$CENTRAL_URL/api/v1/clientes/<id>"
curl -fsS -X PATCH -H "Authorization: Bearer $CENTRAL_KEY" -H 'content-type: application/json' \
  -d '{"version":"<version de la fase>","status":"DONE"}' "$CENTRAL_URL/api/v1/presupuestos/P-2026-001/fases/<faseId>"
```

## Pruebas

`bun test`:

- `src/lib/api/auth.test.ts`: 401 sin cabecera, con clave desconocida o revocada; 403 sin el permiso; 429 pasado el
  límite, que cuenta todas las rutas juntas; la clave y su huella no salen en respuestas ni registros.
- `src/lib/api/scrub.test.ts`: ejecuta `servers/public` y `collectAlerts` con una BD falsa con rutas de clave, IPs,
  `panelUrl` y dominios `sslip.io`, y falla si algo de eso sale.
- `src/lib/api/quotes.test.ts`: topes del borrador y reintento cuando el número choca.
- `src/lib/api/mutations/write-routes.test.ts`: las rutas de escritura de punta a punta con una BD en memoria: 401 y
  403 (también fases sin `presupuestos`), 400/422, 409 por versión y por estado fijado (sin cambiar nada), 404,
  registro con el nombre de la app, que no hay `DELETE`, que una clave solo de escritura no lee nada (403), 503 si la
  transacción no termina y las funciones comunes que usan la web y el MCP.
- `bun run test:bd` (`scripts/prueba-concurrencia-api.ts`, aparte de `bun test`): concurrencia real contra la BD
  local de desarrollo (se niega a correr con otra). 8 cambios simultáneos con la misma versión en un cliente, un
  proyecto y una fase: gana uno y el resto da conflicto; 8 altas con el mismo nombre: una y el resto `duplicate`.
  Sin el `FOR UPDATE`, falla. Crea sus datos y los borra al terminar.
- `src/lib/api/events.test.ts`: días de la agenda en Europe/Madrid, también en los cambios de hora y con otra zona
  en el proceso.
