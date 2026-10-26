# Escáner de carpetas

`src/lib/scanner.ts` + `scripts/scan.ts`.

## Qué detecta

Una carpeta es un proyecto si tiene `.git` o alguno de: `package.json`, `composer.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `wp-config.php`, `Cargo.toml`, `pubspec.yaml`, `angular.json`. No baja más dentro de un proyecto. Profundidad máxima 5.

Se saltan `node_modules`, `vendor`, `.next`, `dist`, carpetas ocultas y cualquier carpeta cuyo nombre parezca de credenciales (`claves`, `api keys`, `secret`, `proxies`, `credentials`).

## Qué extrae

Versión y descripción (`package.json`; si no está en la raíz, de los subproyectos `apps/*`, `packages/*`, `frontend`, `backend`… y si no, de `VERSION`, `pyproject.toml`, `Cargo.toml` o la primera versión del `CHANGELOG`), framework con versión (también de los subproyectos de un monorepo), stack (dependencias conocidas + PHP, WordPress, Python, Go, Rust, Flutter, Docker), presencia de `CLAUDE.md`, y de git: rama, último commit (fecha y mensaje), número de commits, ficheros versionados con cambios sin commit (`uncommitted`) y, aparte, ficheros nuevos que git no sigue (`untracked`), y remoto (sin credenciales en la URL).

## Cómo agrupa

1. Mismo remoto git → un proyecto.
2. Worktree (`.git` es un fichero) → al proyecto del repo principal.
3. Carpeta `<repo>-<algo>` junto al repo (worktrees copiados) → al mismo proyecto.
4. Lo demás, un proyecto por carpeta.

La ubicación principal es la que no es worktree ni backup y tiene la actividad más reciente.

## Qué es cada proyecto (propuesta)

El escáner propone tipo, plataforma y dominios (`src/lib/project-type.ts`); el usuario los confirma en la ficha o todos a la vez desde Pendientes. Nunca cambia lo ya confirmado.

- **Tipo y plataforma**: cabecera `Plugin Name:`/`Theme Name:` → plugin de WordPress (WooCommerce o Elementor según la cabecera); `config.xml` de módulo → PrestaShop; `n8n` en `package.json` → n8n; ficheros de Shopify → Shopify; `manifest.json` con `manifest_version` → extensión de Chrome; `expo`, `react-native`, Flutter, Capacitor → app móvil; `electron`, `tauri` → escritorio; `@modelcontextprotocol/sdk` o `bin` → librería; WordPress con WooCommerce → e-commerce; WordPress o Astro sin base de datos → web; framework de frontend → aplicación web; backend sin frontend (o FastAPI, Flask, Django) → API; formación → contenido. En monorepos, si la raíz no aclara nada, mira `apps/*`, `packages/*`, `frontend`, `backend`, `web`, `api`…
- **Dominios**: `site` de `astro.config.*`, `homepage` de `package.json`, `CNAME`, alias de `vercel.json`, reglas `Host()` de `docker-compose` y, del fichero de ejemplo de variables (nunca del real), solo las que apuntan al propio sitio (`SITE_URL`, `APP_URL`, `NEXTAUTH_URL`…). Se descartan localhost, IPs privadas, textos de ejemplo y servicios de terceros (CDN, almacenamiento, pagos, analítica…).

## Repositorio frente a origin

En la carpeta principal de cada repositorio el escáner lee sus remotos (`git remote -v`) y el estado de cada rama según la última información traída: commits por delante y por detrás de la rama que sigue, ramas sin rama remota que tienen commits en ningún remoto, ramas remotas sin copia local y stash. «Sin subir» cuenta cada commit una vez aunque esté en varias ramas; «por bajar» es el de la rama actual, sin contar los cambios que ya están en local con otro hash (rebase, force-push; se guardan aparte en `rewrittenCommits`), y con sus autores (`behindAuthors`) para distinguir lo de otras personas o bots. Si el remoto no es de una cuenta propia, la ficha indica que son novedades del autor original.

Con `--fetch-active` (tarea horaria) o `--fetch` hace antes `git fetch --all --prune` con las credenciales del Mac, sin preguntar nunca (`GIT_TERMINAL_PROMPT=0`, SSH en modo batch) y con límite de tiempo. Solo actualiza referencias remotas. Si falla, se guarda el motivo en `fetchError`. Código: `src/lib/git-state.ts`. Los datos del proveedor los añade `src/lib/repo-sync.ts` (`bun run repos:sync`).

## Identidad del proyecto y repos movidos

Cada proyecto se identifica por su remoto normalizado (`github.com/titular/repo`). Si un repositorio cambia de titular, de organización o de nombre y actualizas el remoto (`git remote set-url`), el escáner no encuentra esa identidad, pero reconoce el proyecto por su carpeta principal ya registrada: actualiza la identidad y el repositorio y conserva cliente, fase, servicios, secretos y notas. El escaneo lo indica como «Movido».

Un proyecto sin remoto cuya carpeta se mueve o se renombra no tiene nada en común con el registro anterior y aparece como proyecto nuevo; el antiguo queda «sin carpeta» (ver abajo) y en Pendientes se une al nuevo con «Es el mismo que…».

## En el Mac (entorno Local)

`src/lib/local-env.ts` añade a la carpeta principal, sin abrir nunca un fichero de variables: los **nombres** de sus ficheros de variables (`.env`, `.env.local`, `.env.production`…) con su entorno (`.env.production` → producción; `staging`, `preview`, `test` → pruebas; el resto → local; `example`, `sample`, `template` → plantilla, no se importa), los servicios de su `docker-compose.yml`/`compose.yaml` (imagen, si se construye y puertos publicados; nunca sus variables), el nombre del proyecto de Compose y la URL de desarrollo (puerto del script `dev` de `package.json` o el primer puerto publicado de una app del compose). La ficha (tarjeta «Entornos», pestaña Local) pregunta en vivo al Docker del Mac qué contenedores de ese proyecto están en marcha y si responde la URL; «Importar» lee en ese momento el fichero de variables y guarda cada una cifrada en su entorno.

## Proyectos sin carpeta

Al terminar un escaneo, el proyecto que no se ha encontrado y del que no existe ninguna de sus carpetas se marca con `goneAt` («sin carpeta en disco»). Solo cuentan las carpetas que están dentro de una raíz escaneada que existe: con el disco externo desconectado no se marca nada. Sale de Proyectos y de la información pendiente, y aparece en **Pendientes › Sin carpeta en disco** con dos salidas: «Eliminar de Central» (no toca el disco) o «Es el mismo que…», que pasa al proyecto nuevo servicios, webs, notas, presupuestos, vídeos, secretos, copias de variables e instalaciones, y los datos que el nuevo no tenga (cliente, fase, tipo, despliegue…). Si el proyecto vuelve a aparecer en un escaneo, se le quita la marca. Código: `markGone` en `src/lib/scan-import.ts` y `src/lib/project-cleanup-actions.ts`.

## Carpetas raíz

Se gestionan en Ajustes: «Añadir carpeta» la guarda y la escanea en el momento (tiene que existir en el equipo). La ruta se escribe o se elige con «Explorar…», un explorador propio que lista solo carpetas del equipo donde corre Central, marca las que ya son proyectos y se salta las ocultas y las de credenciales; «Quitar» deja de escanearla, pero sus proyectos ya importados se quedan. `SCAN_ROOTS` solo se usa si todavía no hay ninguna raíz guardada.

Un grupo que solo trae worktrees (su repositorio principal está en otra raíz, como pasa con Orca) se asocia al proyecto por su remoto y solo añade ubicaciones: no cambia la versión, la rama ni el último commit del proyecto.

## Proyectos excluidos

«Excluir de Central» en la ficha saca un proyecto de listados, resumen, pendientes, clientes, Ajustes y del MCP sin borrarlo. El escáner lo sigue actualizando pero lo deja excluido, así que no vuelve a aparecer. Se recupera en Proyectos › Excluidos. Borrar no serviría: el siguiente escaneo lo volvería a crear.

## Cuándo se escanea

- `bun run scan`: sin carpeta usa las raíces guardadas (`ScanRoot`) o, si no hay ninguna, `SCAN_ROOTS`.
- Botón «Escanear ahora» en Ajustes (solo si las carpetas raíz existen en el equipo donde corre Central).
- Tarea del Mac cada hora (`bun run tareas:instalar`, ver `scripts/tareas-mac.sh`). El servidor no puede escanear: no ve el disco del Mac.

La importación vive en `src/lib/scan-import.ts` y la comparten el script, el botón y la tarea.

## Worktrees fuera de la raíz

Además del recorrido, el escáner pregunta a cada repositorio principal por sus worktrees (`git worktree list --porcelain`) y analiza los que el recorrido no encontró: los que viven fuera de la carpeta escaneada (por ejemplo en `/Volumes/<disco>/Orca`) y los de carpetas ocultas (`.claude/worktrees/`). Nunca abre una ruta que parezca de credenciales.

Por cada worktree guarda rama, último commit y ficheros sin commit, y marca:

- **Fusionada**: su rama aparece en `git branch --merged` de la rama actual del principal. Si además no tiene cambios sin commit ni ficheros nuevos sin versionar (borrar el worktree los borraría), la ficha indica que se puede borrar.
- **Huérfano**: git lo marca `prunable` o la carpeta ya no existe. La ficha muestra el comando `git -C <principal> worktree prune`; Central nunca lo ejecuta.

Al importar, se quitan las ubicaciones antiguas de un proyecto cuya carpeta ya no existe y que git ya no apunta.

## Cómo clasifica

- `Clientes/<X>` o `Trabajo/<X>` → cliente `X` (salvo `Trabajo/Proyectos test` → experimento).
- Rutas con `Sesión`, `Workshop`, `Cursos`, `Formación`, `Testing ` → formación.
- Remoto de un tercero (no yosnap, CodeIA-Academy, EquipoCaptaru, CRMDev-tech, Coetools…) → experimento.
- `Test Dev`, `Tests y demos`, `test-*` → experimento.
- Resto → propio.

Lista de cuentas propias: `MY_OWNERS` en `scanner.ts`.

## Uso

```bash
bun run scan                                         # SCAN_ROOTS de .env
bun run scan "/Volumes/OtroDisco/Proyectos"        # otra carpeta
bun run scan "/ruta" --csv inventario/revision.csv # solo CSV, no toca la BD
```

Primer inventario: `inventario/proyectos-2026-10-25.csv` (200 proyectos a partir de 251 carpetas).
