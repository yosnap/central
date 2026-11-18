# API v1 para apps conectadas

API HTTP JSON de solo lectura (más el alta de presupuestos en borrador) para que otras apps, como AgoraOne,
lean Central sin su código ni su base de datos. Vive en `src/app/api/v1/`; la lógica de cada consulta está en
`src/lib/api/` y la comparte con el MCP (`src/mcp/server.ts`), así que los dos devuelven lo mismo.

## Claves y permisos

Las claves se crean en **Ajustes → Apps conectadas**: un nombre (la app) y uno o varios permisos.

| Permiso | Qué permite |
|---|---|
| `lectura` | Clientes, proyectos, webs, servidores, alertas, pendientes y agenda |
| `presupuestos` | Presupuestos (ver, PDF, Word y crear borradores) y tarifas |
| `escritura` | Reservado para las escrituras de una versión posterior; hoy no abre ninguna ruta |

Los permisos no se heredan: una clave con solo `presupuestos` no lee clientes.

- La clave completa (`cen_` y 43 caracteres) **solo se ve una vez**, al crearla. Central guarda su SHA-256 y los
  12 primeros caracteres para reconocerla en la lista; la comparación es en tiempo constante.
- Revocar una clave la invalida al momento. No se borra: queda en la lista como «Revocada».
- Cada uso actualiza «Último uso» (como mucho una vez por minuto).
- Límite: 120 peticiones por minuto y clave (en memoria del proceso). Pasado, `429` con `Retry-After`.
- Central nunca registra la cabecera `Authorization` ni la clave.

Cada petición lleva la cabecera `Authorization: Bearer <clave>`. `src/proxy.ts` deja pasar `/api/v1/` sin la
cookie de sesión porque cada ruta exige su clave (`src/lib/api/auth.ts`).

## Respuestas

JSON con `cache-control: no-store` y fechas en ISO 8601 (UTC). Importes de presupuestos en euros.
Nunca incluyen IPs, direcciones SSH, rutas de clave, tokens ni secretos.

| Código | Cuándo | Cuerpo |
|---|---|---|
| `401` | Sin clave, con una clave desconocida o revocada | `{ "error": "unauthorized" }` |
| `403` | La clave no tiene el permiso de la ruta | `{ "error": "forbidden", "scope": "presupuestos" }` |
| `400` | Parámetros o cuerpo no válidos | `{ "error": "invalid", "detail": "…" }` |
| `404` | No existe | `{ "error": "not_found" }` |
| `422` | `POST presupuestos` con un cliente que no existe | `{ "error": "invalid", "detail": "…" }` |
| `429` | Límite superado | `{ "error": "rate_limited" }` |
| `500` | Fallo interno (sin detalles) | `{ "error": "internal" }` |

## Rutas

| Ruta | Permiso | Devuelve |
|---|---|---|
| `GET /api/v1/estado` | cualquiera | `{ version, api, scopes, runtime }` (`runtime`: `production` o `local`) |
| `GET /api/v1/clientes` | lectura | `{ clients }`: contacto (correo, teléfono, NIF, dirección) y número de proyectos y webs |
| `GET /api/v1/clientes/{id}` | lectura | Ficha: contacto, proyectos, webs y últimas 20 notas |
| `GET /api/v1/proyectos` | lectura | `{ projects, nextCursor }`. Filtros: `estado` (ACTIVE, MAINTENANCE, DORMANT, ARCHIVED), `tipo` (CLIENT, OWN, TRAINING, EXPERIMENT), `cliente`, `q`, `cursor`, `limite` (1–200, 50 por defecto) |
| `GET /api/v1/proyectos/{id}` | lectura | Ficha: repositorio, ubicaciones, servicios, webs y últimas notas |
| `GET /api/v1/webs` | lectura | `{ websites }`. Filtros: `tipo` (CLIENT, OWN, CENTRAL), `caidas=1` |
| `GET /api/v1/servidores` | lectura | `{ servers }`: estado, CPU, memoria, disco, servicios, protección y proyectos |
| `GET /api/v1/servidores/{id}` | lectura | Ficha: tarjetas, comprobaciones, contenedores, dominios y proyectos |
| `GET /api/v1/alertas` | lectura | `{ alerts }`: abiertas, primero las críticas |
| `GET /api/v1/pendientes` | lectura | `{ pending }`: proyectos a los que les falta información y qué |
| `GET /api/v1/agenda` | lectura | `{ events, errors? }`. `desde`, `hasta` (AAAA-MM-DD, como mucho 62 días), `cliente`; por defecto, 14 días desde hoy |
| `GET /api/v1/presupuestos` | presupuestos | `{ quotes }`. Filtros: `cliente`, `estado` (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED) |
| `GET /api/v1/presupuestos/{id}` | presupuestos | Presupuesto completo por id o número (`P-2026-001`) |
| `GET /api/v1/presupuestos/{id}/pdf` | presupuestos | PDF (por id); con `?descargar=1`, como adjunto |
| `GET /api/v1/presupuestos/{id}/docx` | presupuestos | Word editable (por id) |
| `POST /api/v1/presupuestos` | presupuestos | Crea un **borrador** con el siguiente número del año: `201 { id, number, status: "DRAFT" }` |
| `GET /api/v1/tarifas` | presupuestos | `{ rates }`: tarifas en uso, precio sin IVA en euros |

`POST /api/v1/presupuestos` usa el mismo esquema que la herramienta `create_quote` del MCP
(`createQuoteSchema` en `src/lib/api/quotes.ts`): `client` (id o nombre exacto), `title`, `items`
(`description`, `unitPrice`, opcionales `priceMax`, `quantity`, `unit`, `details`) y, opcionales, `phases`,
`scope`, `includes`, `excludes`, `assumptions`, `thirdPartyCosts`, `schedule`, `vat`, `notes` y `validDays`.
Nunca envía el presupuesto ni cambia su estado.

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
```

## Pruebas

`bun test` ejecuta `src/lib/api/auth.test.ts`: 401 sin cabecera, con clave desconocida o revocada; 403 sin el
permiso; 429 pasado el límite; que la clave y su huella no salen en respuestas ni registros; y que la forma de los
servidores no lleva dirección, IP, rutas de clave ni secretos.
