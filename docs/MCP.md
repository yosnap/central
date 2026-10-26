# Servidor MCP

`src/mcp/server.ts`, transporte stdio.

| Herramienta | Qué hace |
|---|---|
| `list_projects` | Proyectos filtrados por tipo, estado, cliente o texto |
| `get_project` | Ficha completa: repo, despliegue, servicios, ubicaciones, webs, notas |
| `list_websites` | Webs con su último estado; `onlyDown` para ver solo las caídas |
| `list_pending` | Proyectos activos o en mantenimiento a los que les falta información y qué falta |
| `list_clients` | Clientes con número de proyectos y webs |
| `add_note` | Guarda una nota en un proyecto, cliente o web |
| `list_servers` | Servidores con su estado, CPU, memoria, disco, servicios Docker, protección y proyectos que aloja |
| `get_server` | Ficha de un servidor: tarjetas, comprobaciones con su arreglo, contenedores, dominios del proxy y proyectos |
| `list_quotes` | Presupuestos con cliente, estado visible y total con IVA; filtra por cliente o estado |
| `get_quote` | Un presupuesto (por id o número) con partidas, base, IVA, total y fases con su importe |
| `create_quote` | Crea un presupuesto en borrador: fases o paquetes (fijos o con rango), hitos de pago y secciones (cliente existente, siguiente número del año) |
| `update_phase` | Cambia el estado o la fecha de una fase |
| `search_messages` | Correos guardados (por texto o cliente); con `live`, también búsqueda en Gmail |
| `list_events` | Eventos de la agenda entre dos fechas, con el cliente o proyecto ligado |
| `get_project_health` | Cada servicio de un proyecto con su web, su contenedor y el estado de su servidor |

## Configuración (Claude Desktop / Claude Code / Orca)

```json
{
  "mcpServers": {
    "central": {
      "command": "bun",
      "args": ["/ruta/a/Central/src/mcp/server.ts"],
      "env": { "DATABASE_URL": "postgresql://central:central@localhost:5433/central" }
    }
  }
}
```

Siguiente paso previsto: transporte HTTP con token para usarlo como conector remoto.
